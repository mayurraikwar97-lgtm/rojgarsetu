import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import type { Messaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence setup notice:', err);
});
export const googleProvider = new GoogleAuthProvider();

let messagingPromise: Promise<Messaging | null> | null = null;
export function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(app) : null))
      .catch(() => null);
  }
  return messagingPromise;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'mayurraikwar97@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ online: boolean }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { online: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { online: false };
    }
    return { online: true };
  }
}

export function formatUiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!raw) return fallback;

  if (raw.startsWith('DUPLICATE_MOBILE:')) {
    return raw.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim();
  }

  let effectiveMsg = raw;
  let errorPath = '';
  let emailVerified: boolean | null | undefined;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
      if (typeof parsed.error === 'string' && parsed.error) {
        effectiveMsg = parsed.error;
      }
      if (typeof parsed.path === 'string') {
        errorPath = parsed.path;
      }
      emailVerified = parsed.authInfo?.emailVerified;
    } catch {
      // keep raw message
    }
  }

  if (effectiveMsg.startsWith('DUPLICATE_MOBILE:')) {
    return effectiveMsg.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim();
  }

  const lower = effectiveMsg.toLowerCase();
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    if (emailVerified === false) {
      return 'Your signed-in Google email is not verified. Please sign in with a verified Google account to submit registration.';
    }
    if (errorPath.includes('mobileUniquenessLocks') || errorPath.includes('demo_mobile_registry')) {
      return 'This mobile number is already registered with another account. Duplicate mobile numbers are not allowed.';
    }
    if (errorPath.includes('profilePhotos')) {
      return 'Unable to save profile photo due to security/size checks. Please try a JPG/PNG/WebP image under 5 MB or submit without a photo.';
    }
    if (errorPath.includes('jobs') || errorPath.includes('applications')) {
      return 'Could not publish the job right now due to account permission or field validation checks. Please ensure you are signed in with a verified Google account and all required fields are filled properly.';
    }
    return 'Request could not be saved due to account permission or field validation rules. Verify that you are signed in with a verified Google account and all required fields are complete.';
  }

  if (lower.includes('client is offline') || lower.includes('unavailable') || lower.includes('network')) {
    return 'Network connection error while contacting ROJGAR SETU servers. Please check your internet and try again.';
  }

  if (lower.includes('auth/popup-closed-by-user')) {
    return 'Sign-in window was closed before completion. Click Sign In again to continue.';
  }
  if (lower.includes('auth/popup-blocked')) {
    return 'Browser blocked the Google Sign-In popup. Please allow popups for this site and try again.';
  }
  if (lower.includes('auth/unauthorized-domain')) {
    return 'This domain is not yet authorized in Firebase Authentication settings.';
  }

  return effectiveMsg;
}
