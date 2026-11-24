import type { Language } from '../types/domain';

/**
 * Clean client-side feature flags for OTP & Voice Call OTP.
 * Disabled by default for worker registration so workers can fill the form
 * and proceed directly to the ₹250 Razorpay payment without OTP friction.
 *
 * To re-enable in the future without rewriting any OTP code/routes:
 *   VITE_WORKER_OTP_REQUIRED="true"  (and server WORKER_OTP_REQUIRED="true")
 *   VITE_VOICE_OTP_ENABLED="true"    (and server VOICE_OTP_ENABLED="true")
 */
export function isWorkerRegistrationOtpEnabled(): boolean {
  const raw = String(import.meta.env.VITE_WORKER_OTP_REQUIRED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isVehicleRegistrationOtpEnabled(): boolean {
  const raw = String(import.meta.env.VITE_VEHICLE_OTP_REQUIRED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isVoiceOtpEnabled(): boolean {
  const raw = String(import.meta.env.VITE_VOICE_OTP_ENABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export const OTP_FRAUD_WARNING_MR =
  'सावधान: रोजगार सेतु / कामगार सेतु अ‍ॅप ओटीपी मागत नाही व कोणीही कॉलद्वारे ओटीपी मागणार नाही; मागितल्यास देऊ नका — फ्रॉड कॉलपासून सावधान!';

export const OTP_FRAUD_WARNING_HI =
  'सावधान: रोजगार सेतु / कामगार सेतु ऐप ओटीपी नहीं मांगता और कोई भी कॉल के ज़रिए ओटीपी नहीं मांगेगा; मांगे जाने पर न दें — फ्रॉड कॉल से सावधान!';

export const OTP_FRAUD_WARNING_EN =
  'Caution: Rojgar Setu / Kamgar Setu App does not ask for OTP and no one will ask for OTP via phone call; if asked, do not share — beware of fraud calls!';

export function getOtpFraudWarningLocalized(lang: Language): {
  primaryMr: string;
  secondaryLocalized: string | null;
} {
  if (lang === 'mr') {
    return { primaryMr: OTP_FRAUD_WARNING_MR, secondaryLocalized: null };
  }
  return {
    primaryMr: OTP_FRAUD_WARNING_MR,
    secondaryLocalized: lang === 'hi' ? OTP_FRAUD_WARNING_HI : OTP_FRAUD_WARNING_EN,
  };
}
