import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updatePhoneNumber,
} from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { auth } from './firebase';

export interface FirebasePhoneSession {
  mode: 'phone_provider' | 'sign_in';
  verificationId?: string;
  confirmationResult?: ConfirmationResult;
  e164Mobile: string;
}

export function isFirebasePhoneAuthEnvEnabled(): boolean {
  return String(import.meta.env.VITE_FIREBASE_PHONE_AUTH_ENABLED || '').trim().toLowerCase() === 'true';
}

export function mapFirebasePhoneError(err: unknown): {
  code: string;
  message: string;
} {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'Firebase Phone Authentication is disabled in Firebase Console. Enable Phone provider in Firebase Auth or configure server SMS gateway.',
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        message:
          'This domain is not listed under Firebase Authorized Domains. Add rojgarsetuindia.vercel.app in Firebase Console -> Authentication -> Settings -> Authorized domains.',
      };
    case 'auth/quota-exceeded':
      return {
        code,
        message: 'SMS quota exceeded for Firebase Phone Auth. Please try again later or check billing/quotas.',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Too many OTP attempts from this device or number. Please wait before trying again.',
      };
    case 'auth/invalid-phone-number':
      return {
        code,
        message: 'Invalid mobile number. Enter a valid 10-digit Indian mobile number (+91).',
      };
    case 'auth/invalid-verification-code':
      return {
        code,
        message: 'Incorrect OTP. Please check the 6-digit code and try again.',
      };
    case 'auth/code-expired':
    case 'auth/session-expired':
      return {
        code,
        message: 'OTP expired. Please request a new verification code.',
      };
    case 'auth/captcha-check-failed':
    case 'auth/missing-client-identifier':
      return {
        code,
        message: 'reCAPTCHA verification failed. Please reload and try sending OTP again.',
      };
    case 'auth/credential-already-in-use':
      return {
        code,
        message: 'This mobile number is already linked to another ROJGAR SETU account.',
      };
    default:
      return {
        code: code || 'FIREBASE_PHONE_ERROR',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'SMS service temporarily unavailable. Please try again shortly.',
      };
  }
}

export async function sendFirebasePhoneOtp(
  national10: string,
  recaptchaContainer: HTMLElement
): Promise<FirebasePhoneSession> {
  const e164Mobile = `+91${national10}`;
  recaptchaContainer.innerHTML = '';
  const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
    size: 'invisible',
  });

  try {
    await verifier.render();
    if (auth.currentUser) {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(e164Mobile, verifier);
      return {
        mode: 'phone_provider',
        verificationId,
        e164Mobile,
      };
    }

    const confirmationResult = await signInWithPhoneNumber(auth, e164Mobile, verifier);
    return {
      mode: 'sign_in',
      confirmationResult,
      e164Mobile,
    };
  } finally {
    try {
      verifier.clear();
    } catch {
      // ignore cleanup error
    }
  }
}

export async function verifyFirebasePhoneOtp(
  session: FirebasePhoneSession,
  otpCode: string
): Promise<{ verified: boolean; e164Mobile: string }> {
  if (session.mode === 'phone_provider') {
    if (!auth.currentUser || !session.verificationId) {
      throw new Error('OTP session expired. Please request a new code.');
    }
    const credential = PhoneAuthProvider.credential(session.verificationId, otpCode);
    await updatePhoneNumber(auth.currentUser, credential);
    return { verified: true, e164Mobile: session.e164Mobile };
  }

  if (!session.confirmationResult) {
    throw new Error('OTP session expired. Please request a new code.');
  }
  await session.confirmationResult.confirm(otpCode);
  return { verified: true, e164Mobile: session.e164Mobile };
}
