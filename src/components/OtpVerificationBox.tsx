import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Smartphone } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  isFirebasePhoneAuthEnvEnabled,
  mapFirebasePhoneError,
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
} from '../lib/firebasePhoneOtp';
import type { FirebasePhoneSession } from '../lib/firebasePhoneOtp';
import type { Language } from '../types/domain';

interface OtpVerificationBoxProps {
  mobile: string;
  onMobileChange: (value: string) => void;
  verified: boolean;
  onVerified: (mobile: string, verificationProof?: string) => void;
}

interface OtpConfigState {
  checked: boolean;
  smsProviderConfigured: boolean;
  firebasePhoneAuthEnabled: boolean;
  providerLabel?: string;
}

function normalizeTenDigitIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
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

  const recaptchaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/otp/config', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return safeParseJson(res);
      })
      .then((data) => {
        if (!active || !data) return;
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
        setOtpConfig((prev) => ({ ...prev, checked: true }));
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
        'SMS service temporarily unavailable. OTP API endpoint was not found on this deployment.',
        'SMS सेवा अस्थायी रूप से अनुपलब्ध है। इस सर्वर पर OTP API उपलब्ध नहीं है।',
        'SMS सेवा सध्या उपलब्ध नाही. या सर्व्हरवर OTP API एंडपॉइंट सापडला नाही.'
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
          'SMS provider configuration missing. Real OTP SMS cannot be sent until a server SMS gateway (MSG91 / Fast2SMS / Twilio / DLT) or Firebase Phone Auth is configured.',
          'SMS प्रदाता कॉन्फ़िगरेशन उपलब्ध नहीं है। जब तक सर्वर SMS गेटवे (MSG91 / Fast2SMS / Twilio / DLT) या Firebase Phone Auth सेट नहीं होता, असली OTP SMS नहीं भेजा जा सकता।',
          'SMS प्रदाता कॉन्फिगरेशन उपलब्ध नाही. सर्व्हरवर SMS गेटवे (MSG91 / Fast2SMS / Twilio / DLT) किंवा Firebase Phone Auth सेट केल्याशिवाय खरा OTP SMS पाठवता येत नाही.'
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
      setErrorMsg(
        tr(
          lang,
          'SMS service temporarily unavailable. Network connection failed.',
          'नेटवर्क त्रुटि: SMS सेवा से संपर्क नहीं हो सका।',
          'नेटवर्क त्रुटी: SMS सेवेशी संपर्क होऊ शकला नाही.'
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
            onVerified(cleanedMobile);
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
      onVerified(verifiedMobile, proof);
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
    <div className="space-y-2">
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
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
          <CheckCircle2 className="w-4 h-4" />
          {t.workerForm.otpVerified} (+91 {cleanedMobile})
        </p>
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

      {otpConfig.checked && !otpConfig.smsProviderConfigured && !otpConfig.firebasePhoneAuthEnabled && !verified && !errorMsg && (
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
