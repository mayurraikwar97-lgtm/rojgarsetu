import React, { useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface OtpVerificationBoxProps {
  mobile: string;
  onMobileChange: (value: string) => void;
  verified: boolean;
  onVerified: (mobile: string) => void;
}

export const OtpVerificationBox: React.FC<OtpVerificationBoxProps> = ({
  mobile,
  onMobileChange,
  verified,
  onVerified,
}) => {
  const { t } = useLanguage();
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [previewOtp, setPreviewOtp] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    const cleaned = mobile.trim().replace(/\s+/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setErrorMsg('Enter a valid 10-digit Indian mobile number starting with 6–9.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Unable to send OTP.');
      } else {
        setChallengeToken(data.challengeToken);
        if (data.mode === 'sandbox_preview' && data.previewOtp) {
          setPreviewOtp(data.previewOtp);
          setStatusMsg(`SMS gateway unconfigured in preview. Test verification code: ${data.previewOtp}`);
        } else {
          setStatusMsg('OTP dispatched via configured SMS provider.');
        }
      }
    } catch {
      setErrorMsg('Network error requesting OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobile.trim().replace(/\s+/g, ''),
          otp: otpInput.trim(),
          challengeToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setErrorMsg('Invalid or expired OTP code. Please try again.');
      } else {
        setPreviewOtp('');
        setStatusMsg('');
        onVerified(data.mobile);
      }
    } catch {
      setErrorMsg('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, ''))}
            placeholder="9876543210"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
          />
        </div>
        <button
          type="button"
          onClick={requestOtp}
          disabled={loading || verified}
          className="px-4 py-2 rounded-md border border-[#0B3B75] text-[#0B3B75] text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {verified ? t.workerForm.otpVerified : t.workerForm.sendOtp}
        </button>
      </div>

      {challengeToken && !verified && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
            placeholder={t.workerForm.otpPlaceholder}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={loading || otpInput.length !== 6}
            className="px-4 py-2 rounded-md bg-[#15803D] text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.workerForm.verifyOtp}
          </button>
        </div>
      )}

      {verified && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
          <CheckCircle2 className="w-4 h-4" />
          {t.workerForm.otpVerified}
        </p>
      )}

      {statusMsg && !verified && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 font-mono-tabular">
          {statusMsg} {previewOtp ? '' : ''}
        </p>
      )}

      {errorMsg && (
        <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
      )}
    </div>
  );
};
