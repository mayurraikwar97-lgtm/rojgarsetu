import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { isDemoModeEnvEnabled } from '../lib/demoService';
import {
  isFirebasePhoneAuthEnvEnabled,
  mapFirebasePhoneError,
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
} from '../lib/firebasePhoneOtp';
import type { FirebasePhoneSession } from '../lib/firebasePhoneOtp';
import {
  hashTestPin,
  normalizeTenDigitIndianMobile,
  validateSecurityPin,
} from '../lib/pinAuth';
import type { Language, VerificationMethod } from '../types/domain';

export interface OtpVerificationMeta {
  method: VerificationMethod;
  verificationProof?: string;
  testPinHash?: string;
}

interface OtpVerificationBoxProps {
  mobile: string;
  onMobileChange: (value: string) => void;
  verified: boolean;
  onVerified: (mobile: string, meta?: OtpVerificationMeta) => void;
  allowTestPinFallback?: boolean;
  verifiedMethod?: VerificationMethod;
}

interface OtpConfigState {
  checked: boolean;
  smsProviderConfigured: boolean;
  firebasePhoneAuthEnabled: boolean;
  providerLabel?: string;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

async function safeParseJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const raw = await res.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const OtpVerificationBox: React.FC<OtpVerificationBoxProps> = ({
  mobile,
  onMobileChange,
  verified,
  onVerified,
  allowTestPinFallback = true,
  verifiedMethod,
}) => {
  const { lang, t } = useLanguage();
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [firebaseSession, setFirebaseSession] = useState<FirebasePhoneSession | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [otpConfig, setOtpConfig] = useState<OtpConfigState>({
    checked: false,
    smsProviderConfigured: true,
    firebasePhoneAuthEnabled: isFirebasePhoneAuthEnvEnabled(),
  });

  // Pre-launch Test PIN fallback states (active only when real SMS & Firebase Phone Auth are unconfigured)
  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [pinBusy, setPinBusy] = useState<boolean>(false);
  const [forcePinFallback, setForcePinFallback] = useState<boolean>(false);

  const recaptchaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/otp/config', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return safeParseJson(res);
      })
      .then((data) => {
        if (!active || !data) {
          if (active) setOtpConfig((prev) => ({ ...prev, checked: true, smsProviderConfigured: false }));
          return;
        }
        setOtpConfig({
          checked: true,
          smsProviderConfigured: Boolean(data.smsProviderConfigured),
          firebasePhoneAuthEnabled:
            Boolean(data.firebasePhoneAuthEnabled) || isFirebasePhoneAuthEnvEnabled(),
          providerLabel: typeof data.providerLabel === 'string' ? data.providerLabel : undefined,
        });
      })
      .catch(() => {
        if (!active) return;
        setOtpConfig((prev) => ({ ...prev, checked: true, smsProviderConfigured: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const cleanedMobile = normalizeTenDigitIndianMobile(mobile);
  const isValidIndianMobile = /^[6-9]\d{9}$/.test(cleanedMobile);
  const hasActiveChallenge = Boolean(challengeToken || firebaseSession);

  const showTestPinMode =
    allowTestPinFallback &&
    isDemoModeEnvEnabled() &&
    !verified &&
    ((otpConfig.checked && !otpConfig.smsProviderConfigured && !otpConfig.firebasePhoneAuthEnabled) ||
      forcePinFallback);

  const mapServerErrorToMessage = (
    status: number,
    data: Record<string, unknown> | null,
    fallbackEn: string
  ): string => {
    const code = typeof data?.error === 'string' ? data.error : '';
    const serverMsg = typeof data?.message === 'string' ? data.message : '';

    if (status === 404) {
      return tr(
        lang,
        'SMS OTP endpoint unavailable on this deployment. You can use Pre-Launch Test PIN verification below.',
        'इस सर्वर पर SMS OTP सेवा उपलब्ध नहीं है। आप नीचे दिए गए प्री-लॉन्च Test PIN से मोबाइल सत्यापित कर सकते हैं।',
        'या सर्व्हरवर SMS OTP सेवा उपलब्ध नाही. तुम्ही खालील Pre-Launch Test PIN वापरून मोबाईल पडताळणी करू शकता.'
      );
    }

    switch (code) {
      case 'INVALID_MOBILE':
        return tr(
          lang,
          'Invalid mobile number. Enter a valid 10-digit Indian mobile number (+91).',
          'अमान्य मोबाइल नंबर। कृपया +91 के साथ 10 अंकों का सही भारतीय मोबाइल नंबर दर्ज करें।',
          'अवैध मोबाईल नंबर. कृपया +91 सह १० अंकी योग्य भारतीय मोबाईल नंबर टाका.'
        );
      case 'SMS_PROVIDER_NOT_CONFIGURED':
      case 'SMS_GATEWAY_NOT_CONFIGURED':
        return tr(
          lang,
          'SMS Gateway is not configured yet. Please complete verification using the 4–6 digit Security PIN below.',
          'SMS गेटवे अभी सेट नहीं है। कृपया नीचे दिए गए 4–6 अंकों के सिक्योरिटी PIN से सत्यापन पूरा करें।',
          'SMS गेटवे अद्याप सेट नाही. कृपया खालील ४ ते ६ अंकी सुरक्षा PIN वापरून पडताळणी पूर्ण करा.'
        );
      case 'OTP_COOLDOWN_ACTIVE': {
        const wait = typeof data?.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 45;
        setCooldownSeconds(wait);
        return tr(
          lang,
          `Please wait ${wait}s before requesting another OTP.`,
          `नया OTP मंगाने से पहले कृपया ${wait} सेकंड प्रतीक्षा करें।`,
          `पुन्हा OTP मागवण्यापूर्वी कृपया ${wait} सेकंद थांबा.`
        );
      }
      case 'OTP_RATE_LIMITED':
        return tr(
          lang,
          'Too many attempts. Please wait a few minutes before trying again.',
          'बहुत अधिक प्रयास किए गए हैं। कृपया कुछ मिनट बाद पुनः प्रयास करें।',
          'खूप जास्त प्रयत्न झाले आहेत. कृपया काही मिनिटांनी पुन्हा प्रयत्न करा.'
        );
      case 'OTP_ATTEMPTS_EXCEEDED':
        return tr(
          lang,
          'Too many incorrect OTP attempts. Please request a new OTP.',
          'कई बार गलत OTP दर्ज किया गया। कृपया नया OTP मंगाएँ।',
          'अनेक वेळा चुकीचा OTP टाकला गेला. कृपया नवीन OTP मागवा.'
        );
      case 'OTP_EXPIRED':
        return tr(
          lang,
          'OTP expired. Please request a new verification code.',
          'OTP की समय-सीमा समाप्त हो गई है। कृपया नया OTP मंगाएँ।',
          'OTP ची मुदत संपली आहे. कृपया नवीन OTP मागवा.'
        );
      case 'INCORRECT_OTP':
        return (
          serverMsg ||
          tr(
            lang,
            'Incorrect OTP. Please verify the 6-digit code.',
            'गलत OTP। कृपया 6 अंकों का सही कोड दर्ज करें।',
            'चुकीचा OTP. कृपया ६ अंकी योग्य कोड तपासा.'
          )
        );
      case 'SMS_DISPATCH_FAILED':
      case 'SMS_SERVICE_UNAVAILABLE':
        return tr(
          lang,
          'SMS service temporarily unavailable. Please try again in a moment.',
          'SMS सेवा अस्थायी रूप से अनुपलब्ध है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
          'SMS सेवा सध्या तात्पुरती उपलब्ध नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
        );
      default:
        return serverMsg || fallbackEn;
    }
  };

  const requestOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    setPinError('');

    if (!isValidIndianMobile) {
      setErrorMsg(
        tr(
          lang,
          'Invalid mobile number. Enter a valid 10-digit Indian mobile number (+91, starting with 6–9).',
          'अमान्य मोबाइल नंबर। 6–9 से शुरू होने वाला 10 अंकों का सही मोबाइल नंबर दर्ज करें।',
          'अवैध मोबाईल नंबर. ६ ते ९ ने सुरू होणारा १० अंकी योग्य भारतीय मोबाईल नंबर टाका.'
        )
      );
      return;
    }

    if (cooldownSeconds > 0) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanedMobile,
          previousChallengeToken: challengeToken || undefined,
        }),
      });
      const data = await safeParseJson(res);

      if (res.ok && data && typeof data.challengeToken === 'string') {
        setFirebaseSession(null);
        setChallengeToken(data.challengeToken);
        setOtpInput('');
        const cooldown = typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 45;
        setCooldownSeconds(cooldown);
        setStatusMsg(
          tr(
            lang,
            `OTP sent successfully to +91 ${cleanedMobile}. Valid for 5 minutes.`,
            `+91 ${cleanedMobile} पर OTP सफलतापूर्वक भेजा गया। यह 5 मिनट के लिए मान्य है।`,
            `+91 ${cleanedMobile} वर OTP यशस्वीरित्या पाठवला आहे. हा ५ मिनिटांसाठी वैध आहे.`
          )
        );
        return;
      }

      const errorCode = typeof data?.error === 'string' ? data.error : '';
      const canFallbackToFirebasePhone =
        (res.status === 503 || res.status === 404 || errorCode === 'SMS_PROVIDER_NOT_CONFIGURED') &&
        otpConfig.firebasePhoneAuthEnabled &&
        recaptchaRef.current;

      if (canFallbackToFirebasePhone && recaptchaRef.current) {
        try {
          const session = await sendFirebasePhoneOtp(cleanedMobile, recaptchaRef.current);
          setChallengeToken('');
          setFirebaseSession(session);
          setOtpInput('');
          setCooldownSeconds(45);
          setStatusMsg(
            tr(
              lang,
              `OTP sent successfully to +91 ${cleanedMobile} via Firebase Phone Auth.`,
              `Firebase के माध्यम से +91 ${cleanedMobile} पर OTP सफलतापूर्वक भेजा गया।`,
              `Firebase द्वारे +91 ${cleanedMobile} वर OTP यशस्वीरित्या पाठवला आहे.`
            )
          );
          return;
        } catch (fbErr) {
          const mapped = mapFirebasePhoneError(fbErr);
          setErrorMsg(mapped.message);
          return;
        }
      }

      if (
        (res.status === 503 ||
          res.status === 404 ||
          errorCode === 'SMS_PROVIDER_NOT_CONFIGURED' ||
          errorCode === 'SMS_GATEWAY_NOT_CONFIGURED') &&
        allowTestPinFallback &&
        isDemoModeEnvEnabled()
      ) {
        setForcePinFallback(true);
      }

      setErrorMsg(
        mapServerErrorToMessage(
          res.status,
          data,
          tr(
            lang,
            'SMS service temporarily unavailable. Unable to send OTP.',
            'SMS सेवा अस्थायी रूप से अनुपलब्ध है। OTP भेजा नहीं जा सका।',
            'SMS सेवा तात्पुरती उपलब्ध नाही. OTP पाठवता आला नाही.'
          )
        )
      );
    } catch {
      if (allowTestPinFallback && isDemoModeEnvEnabled()) {
        setForcePinFallback(true);
      }
      setErrorMsg(
        tr(
          lang,
          'SMS service temporarily unavailable. Use the Security PIN verification below.',
          'SMS सेवा अनुपलब्ध है। कृपया नीचे दिए गए सिक्योरिटी PIN से सत्यापन करें।',
          'SMS सेवा उपलब्ध नाही. कृपया खालील सुरक्षा PIN ने पडताळणी करा.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErrorMsg('');
    const trimmedOtp = otpInput.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setErrorMsg(
        tr(
          lang,
          'Please enter the 6-digit OTP sent to your mobile number.',
          'कृपया अपने मोबाइल पर प्राप्त 6 अंकों का OTP दर्ज करें।',
          'कृपया तुमच्या मोबाईलवर आलेला ६ अंकी OTP टाका.'
        )
      );
      return;
    }

    setLoading(true);
    try {
      if (firebaseSession) {
        try {
          const fbRes = await verifyFirebasePhoneOtp(firebaseSession, trimmedOtp);
          if (fbRes.verified) {
            setFirebaseSession(null);
            setStatusMsg('');
            setOtpInput('');
            setCooldownSeconds(0);
            onVerified(cleanedMobile, { method: 'firebase_phone' });
          }
          return;
        } catch (fbErr) {
          const mapped = mapFirebasePhoneError(fbErr);
          setErrorMsg(mapped.message);
          if (mapped.code === 'auth/code-expired' || mapped.code === 'auth/session-expired') {
            setFirebaseSession(null);
            setOtpInput('');
          }
          return;
        }
      }

      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanedMobile,
          otp: trimmedOtp,
          challengeToken,
        }),
      });
      const data = await safeParseJson(res);

      if (!res.ok || !data?.verified) {
        const errCode = typeof data?.error === 'string' ? data.error : '';
        setErrorMsg(
          mapServerErrorToMessage(
            res.status,
            data,
            tr(
              lang,
              'Incorrect or expired OTP. Please try again.',
              'गलत या समाप्त OTP। कृपया पुनः प्रयास करें।',
              'चुकीचा किंवा मुदत संपलेला OTP. कृपया पुन्हा प्रयत्न करा.'
            )
          )
        );
        if (
          errCode === 'OTP_ATTEMPTS_EXCEEDED' ||
          errCode === 'OTP_EXPIRED' ||
          errCode === 'INVALID_TOKEN' ||
          errCode === 'OTP_ALREADY_USED'
        ) {
          setChallengeToken('');
          setOtpInput('');
        }
        return;
      }

      setStatusMsg('');
      setChallengeToken('');
      setOtpInput('');
      setCooldownSeconds(0);
      const verifiedMobile = typeof data.mobile === 'string' ? data.mobile : cleanedMobile;
      const proof = typeof data.verificationProof === 'string' ? data.verificationProof : undefined;
      onVerified(verifiedMobile, {
        method: 'sms_otp',
        ...(proof ? { verificationProof: proof } : {}),
      });
    } catch {
      setErrorMsg(
        tr(
          lang,
          'SMS service temporarily unavailable while verifying OTP.',
          'OTP सत्यापित करते समय नेटवर्क त्रुटि हुई।',
          'OTP तपासताना नेटवर्क त्रुटी आली.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWithPin = async () => {
    setPinError('');
    setErrorMsg('');

    if (!isValidIndianMobile) {
      setPinError(
        tr(
          lang,
          'Please enter a valid 10-digit Indian mobile number (+91, starting with 6–9) first.',
          'पहले 6–9 से शुरू होने वाला 10 अंकों का सही भारतीय मोबाइल नंबर दर्ज करें।',
          'प्रथम ६ ते ९ ने सुरू होणारा १० अंकी योग्य भारतीय मोबाईल नंबर टाका.'
        )
      );
      return;
    }

    const validation = validateSecurityPin(pinInput, confirmPinInput);
    if (!validation.ok) {
      if (validation.code === 'INVALID_PIN_FORMAT') {
        setPinError(
          tr(
            lang,
            'Security PIN must be 4 to 6 numeric digits (e.g., 4829).',
            'सिक्योरिटी PIN 4 से 6 अंकों का होना चाहिए (उदा. 4829)।',
            'सुरक्षा PIN ४ ते ६ अंकी असणे आवश्यक आहे (उदा. 4829).'
          )
        );
      } else {
        setPinError(
          tr(
            lang,
            'Security PIN and Confirm PIN do not match. Please re-check.',
            'सिक्योरिटी PIN और कन्फर्म PIN मेल नहीं खाते। कृपया जांचें।',
            'सुरक्षा PIN आणि Confirm PIN जुळत नाहीत. कृपया पुन्हा तपासा.'
          )
        );
      }
      return;
    }

    setPinBusy(true);
    try {
      const testPinHash = await hashTestPin(cleanedMobile, validation.cleanPin);
      setPinInput('');
      setConfirmPinInput('');
      setStatusMsg('');
      setErrorMsg('');
      onVerified(cleanedMobile, {
        method: 'test_pin',
        testPinHash,
      });
    } finally {
      setPinBusy(false);
    }
  };

  const sendButtonLabel = verified
    ? t.workerForm.otpVerified
    : loading && !hasActiveChallenge
    ? tr(lang, 'Sending...', 'भेजा जा रहा है...', 'पाठवत आहे...')
    : cooldownSeconds > 0
    ? tr(lang, `Resend in ${cooldownSeconds}s`, `${cooldownSeconds}s में पुनः भेजें`, `${cooldownSeconds}s मध्ये पुन्हा पाठवा`)
    : hasActiveChallenge
    ? tr(lang, 'Resend OTP', 'OTP पुनः भेजें', 'OTP पुन्हा पाठवा')
    : t.workerForm.sendOtp;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex flex-1 items-center">
          <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <span className="pl-9 pr-2 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-md text-xs font-bold text-[#0B3B75] select-none font-mono-tabular">
            +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={14}
            value={mobile}
            onChange={(e) => {
              const next = normalizeTenDigitIndianMobile(e.target.value);
              onMobileChange(next);
              setChallengeToken('');
              setFirebaseSession(null);
              setOtpInput('');
              setStatusMsg('');
              setErrorMsg('');
              setPinError('');
            }}
            placeholder="9876543210"
            className="w-full px-3 py-2 border border-slate-300 rounded-r-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
          />
        </div>
        <button
          type="button"
          onClick={requestOtp}
          disabled={loading || verified || cooldownSeconds > 0 || !isValidIndianMobile}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-[#0B3B75] text-[#0B3B75] text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
        >
          {cooldownSeconds > 0 ? <Clock className="w-3.5 h-3.5" /> : hasActiveChallenge && !verified ? <RefreshCw className="w-3.5 h-3.5" /> : null}
          {sendButtonLabel}
        </button>
      </div>

      {/* Invisible Firebase Phone Auth reCAPTCHA mount container */}
      <div ref={recaptchaRef} />

      {hasActiveChallenge && !verified && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.workerForm.otpPlaceholder}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={loading || otpInput.length !== 6}
            className="px-4 py-2 rounded-md bg-[#15803D] text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? tr(lang, 'Verifying...', 'सत्यापन जारी...', 'पडताळणी सुरू...') : t.workerForm.verifyOtp}
          </button>
        </div>
      )}

      {verified && (
        <div className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {verifiedMethod === 'test_pin'
              ? tr(
                  lang,
                  `Verified with Security PIN (+91 ${cleanedMobile}) — Pre-Launch Test Mode`,
                  `सिक्योरिटी PIN द्वारा सत्यापित (+91 ${cleanedMobile}) — प्री-लॉन्च टेस्ट मोड`,
                  `सुरक्षा PIN द्वारे पडताळणी पूर्ण (+91 ${cleanedMobile}) — प्री-लॉन्च टेस्ट मोड`
                )
              : `${t.workerForm.otpVerified} (+91 ${cleanedMobile})`}
          </span>
        </div>
      )}

      {statusMsg && !verified && (
        <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 font-medium">
          {statusMsg}
        </p>
      )}

      {errorMsg && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </p>
      )}

      {showTestPinMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3B75]">
              <KeyRound className="w-4 h-4 text-[#E06D1B]" />
              <span>
                {tr(
                  lang,
                  'Pre-Launch PIN Verification (SMS Gateway Pending)',
                  'प्री-लॉन्च PIN सत्यापन (SMS गेटवे अभी लंबित)',
                  'प्री-लॉन्च PIN पडताळणी (SMS गेटवे अद्याप सुरू नाही)'
                )}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 text-[10px] font-bold uppercase tracking-wide">
              TEST MODE
            </span>
          </div>

          <p className="text-[11px] text-slate-700 leading-relaxed">
            {tr(
              lang,
              'Live SMS OTP delivery is disabled until an SMS gateway is active. Set a 4–6 digit Security PIN to verify this mobile number and complete your registration now.',
              'लाइव SMS OTP गेटवे अभी सक्रिय नहीं है। अपना मोबाइल नंबर सत्यापित करने और रजिस्ट्रेशन पूरा करने के लिए 4–6 अंकों का सिक्योरिटी PIN सेट करें।',
              'थेट SMS OTP गेटवे अद्याप सक्रिय नाही. मोबाईल नंबर पडताळून नोंदणी पूर्ण करण्यासाठी ४ ते ६ अंकी सुरक्षा PIN सेट करा.'
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {tr(lang, 'Security PIN (4–6 digits) *', 'सिक्योरिटी PIN (4–6 अंक) *', 'सुरक्षा PIN (४–६ अंक) *')}
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setPinError('');
                  }}
                  placeholder={tr(lang, 'e.g. 4829', 'उदा. 4829', 'उदा. 4829')}
                  className="w-full px-3 py-1.5 pr-9 border border-slate-300 bg-white rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {tr(lang, 'Confirm Security PIN *', 'PIN की पुष्टि करें *', 'सुरक्षा PIN पुन्हा टाका *')}
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPinInput}
                onChange={(e) => {
                  setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPinError('');
                }}
                placeholder={tr(lang, 'Re-enter PIN', 'दोबारा PIN लिखें', 'PIN पुन्हा टाका')}
                className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>
          </div>

          {pinError && (
            <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
              {pinError}
            </p>
          )}

          <button
            type="button"
            disabled={pinBusy || !isValidIndianMobile || pinInput.length < 4}
            onClick={handleVerifyWithPin}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#E06D1B] text-white text-xs sm:text-sm font-bold hover:bg-[#c55b10] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {pinBusy
                ? tr(lang, 'Verifying PIN...', 'PIN सत्यापित हो रहा है...', 'PIN तपासत आहे...')
                : tr(lang, 'Verify Mobile with Security PIN', 'सिक्योरिटी PIN से सत्यापित करें', 'सुरक्षा PIN द्वारे मोबाईल पडताळा')}
            </span>
          </button>
        </div>
      )}

      {otpConfig.checked && !otpConfig.smsProviderConfigured && !otpConfig.firebasePhoneAuthEnabled && !verified && !showTestPinMode && !errorMsg && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
          {tr(
            lang,
            'SMS Gateway configuration pending on server. Administrator must configure MSG91 / Fast2SMS / Twilio / DLT credentials or Firebase Phone Auth to deliver real SMS OTPs.',
            'सर्वर पर SMS गेटवे सेटिंग अधूरी है। असली OTP SMS भेजने के लिए एडमिन को MSG91 / Fast2SMS / Twilio / DLT या Firebase Phone Auth सेट करना होगा।',
            'सर्व्हरवर SMS गेटवे सेटिंग बाकी आहे. खरा OTP SMS पाठवण्यासाठी अ‍ॅडमिनने MSG91 / Fast2SMS / Twilio / DLT किंवा Firebase Phone Auth सेट करणे आवश्यक आहे.'
          )}
        </p>
      )}
    </div>
  );
};
