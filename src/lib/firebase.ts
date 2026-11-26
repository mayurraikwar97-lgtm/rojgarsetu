import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
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
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isAuthenticatedUser(user: User | null | undefined): user is User {
  if (!user || !user.uid || user.isAnonymous) return false;
  if (user.emailVerified) return true;
  return Array.isArray(user.providerData) && user.providerData.some((p) => p?.providerId === 'google.com');
}

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
  code?: string;
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

export function extractFirebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const rawCode = (error as { code?: unknown }).code;
    if (typeof rawCode === 'string' && rawCode.trim()) {
      return rawCode.trim().toLowerCase();
    }
  }
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg) as { code?: unknown; error?: unknown };
      if (typeof parsed.code === 'string' && parsed.code.trim() && parsed.code !== 'unknown') {
        return parsed.code.trim().toLowerCase();
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return extractFirebaseErrorCode(parsed.error);
      }
    } catch {
      // Fall through to string matching
    }
  }
  const parenMatch = msg.match(/\(((?:firestore|auth|functions|storage)\/[a-z0-9-]+)\)/i);
  if (parenMatch?.[1]) {
    const full = parenMatch[1].toLowerCase();
    return full.startsWith('auth/') ? full : full.replace(/^(firestore|functions|storage)\//, '');
  }
  const lower = msg.toLowerCase();
  if (lower.includes('unauthenticated') || lower.includes('id-token-expired') || lower.includes('user-token-expired')) {
    return 'unauthenticated';
  }
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return 'permission-denied';
  }
  if (lower.includes('invalid-argument') || lower.includes('unsupported field value') || lower.includes('exceeds the maximum allowed size')) {
    return 'invalid-argument';
  }
  if (lower.includes('failed-precondition') || lower.includes('requires an index')) {
    return 'failed-precondition';
  }
  if (lower.includes('unavailable') || lower.includes('client is offline') || lower.includes('network-request-failed')) {
    return 'unavailable';
  }
  if (lower.includes('deadline-exceeded')) return 'deadline-exceeded';
  if (lower.includes('resource-exhausted') || lower.includes('quota exceeded')) return 'resource-exhausted';
  if (lower.includes('not-found') || lower.includes('no document to update')) return 'not-found';
  if (lower.includes('already-exists')) return 'already-exists';
  if (lower.includes('cancelled') || lower.includes('canceled')) return 'cancelled';
  if (lower.includes('out-of-range')) return 'out-of-range';
  if (lower.includes('data-loss')) return 'data-loss';
  if (lower.includes('unimplemented')) return 'unimplemented';
  if (lower.includes('aborted')) return 'aborted';
  if (lower.includes('internal server error') || lower.includes('firestore/internal')) return 'internal';
  return 'unknown';
}

function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errCode = extractFirebaseErrorCode(error);
  return {
    code: errCode,
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
}

/**
 * Non-throwing diagnostic logger for asynchronous onSnapshot listeners so
 * transient auth/permission/network listener errors never become uncaught
 * runtime exceptions in the browser.
 */
export function logFirestoreListenerError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.warn(
    `Firestore Listener Error [${errInfo.code || 'unknown'}] (${operationType} ${path || ''}):`,
    errInfo
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error(
    `Firestore Error [${errInfo.code || 'unknown'}] (${operationType} ${path || ''}):`,
    errInfo
  );
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

type UiLang = 'en' | 'hi' | 'mr';

function resolveActiveUiLang(explicitLang?: UiLang): UiLang {
  if (explicitLang === 'en' || explicitLang === 'hi' || explicitLang === 'mr') {
    return explicitLang;
  }
  try {
    if (typeof document !== 'undefined') {
      const docLang = document.documentElement?.lang;
      if (docLang === 'en' || docLang === 'hi' || docLang === 'mr') {
        return docLang;
      }
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('rojgar_setu_lang');
      if (saved === 'en' || saved === 'hi' || saved === 'mr') {
        return saved;
      }
    }
  } catch {
    // Ignore storage/DOM access issues
  }
  return 'mr';
}

function pickLocalized(lang: UiLang, en: string, hi: string, mr: string): string {
  if (lang === 'mr') return mr;
  if (lang === 'hi') return hi;
  return en;
}

function withErrorCode(code: string | null | undefined, message: string): string {
  const cleanCode = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (!cleanCode || cleanCode === 'unknown') return message;
  return `[${cleanCode}] ${message}`;
}

export function formatUiError(
  err: unknown,
  fallback?: string,
  explicitLang?: UiLang
): string {
  const lang = resolveActiveUiLang(explicitLang);
  const resolvedFallback =
    fallback ||
    pickLocalized(
      lang,
      'Something went wrong. Please check your details and try again.',
      'कुछ तकनीकी समस्या आ गई है। कृपया विवरण जाँचें और पुनः प्रयास करें।',
      'काही तांत्रिक अडचण आली आहे. कृपया तपशील तपासा आणि पुन्हा प्रयत्न करा.'
    );

  const errObj = err && typeof err === 'object' ? (err as { code?: unknown; message?: unknown }) : null;
  let errCode = typeof errObj?.code === 'string' ? errObj.code.toLowerCase().trim() : '';
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : typeof errObj?.message === 'string'
          ? errObj.message
          : '';
  if (!raw && !errCode) return resolvedFallback;

  let effectiveMsg = raw;
  let errorPath = '';
  let emailVerified: boolean | null | undefined;
  let userId: string | null | undefined;
  let parsedStructuredJson = false;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
      parsedStructuredJson = true;
      if (typeof parsed.code === 'string' && parsed.code.trim()) {
        errCode = parsed.code.trim().toLowerCase();
      }
      if (typeof parsed.error === 'string' && parsed.error) {
        effectiveMsg = parsed.error;
      }
      if (typeof parsed.path === 'string') {
        errorPath = parsed.path;
      }
      emailVerified = parsed.authInfo?.emailVerified;
      userId = parsed.authInfo?.userId;
    } catch {
      return resolvedFallback;
    }
  }

  if (!errCode || errCode === 'unknown') {
    const extracted = extractFirebaseErrorCode(effectiveMsg || err);
    if (extracted !== 'unknown') {
      errCode = extracted;
    }
  }

  const checkPrefix = (prefix: string) =>
    raw.startsWith(prefix) || effectiveMsg.startsWith(prefix);

  if (checkPrefix('DUPLICATE_MOBILE:')) {
    return effectiveMsg.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim() || resolvedFallback;
  }

  if (checkPrefix('AUTH_REQUIRED:')) {
    return withErrorCode(
      'unauthenticated',
      pickLocalized(
        lang,
        'Google sign-in is required before submitting your work request. Please sign in with Google and try again.',
        'काम की रिक्वेस्ट भेजने से पहले गूगल लॉगिन आवश्यक है। कृपया अपने गूगल खाते से लॉगिन करें और पुनः प्रयास करें।',
        'कामाची रिक्वेस्ट पाठवण्यापूर्वी गुगल लॉगिन आवश्यक आहे. कृपया गुगल खात्याने लॉगिन करून पुन्हा प्रयत्न करा.'
      )
    );
  }

  if (checkPrefix('EMAIL_UNVERIFIED:')) {
    return withErrorCode(
      'email-unverified',
      pickLocalized(
        lang,
        'Your Google email address is not verified. Please sign in with a verified Google account to submit your request.',
        'आपका गूगल ईमेल सत्यापित नहीं है। रिक्वेस्ट भेजने के लिए कृपया सत्यापित गूगल खाते से लॉगिन करें।',
        'तुमचा गुगल ईमेल सत्यापित नाही. रिक्वेस्ट पाठवण्यासाठी कृपया सत्यापित गुगल खात्याने लॉगिन करा.'
      )
    );
  }

  if (checkPrefix('MISSING_CATEGORY:')) {
    return withErrorCode(
      'invalid-argument',
      pickLocalized(
        lang,
        'Work category is missing. Please select a work category or custom profession before submitting.',
        'काम की श्रेणी नहीं चुनी गई है। रिक्वेस्ट भेजने से पहले कृपया काम की श्रेणी या कस्टम व्यवसाय चुनें।',
        'कामाची श्रेणी निवडलेली नाही. रिक्वेस्ट पाठवण्यापूर्वी कृपया कामाची श्रेणी किंवा कस्टम व्यवसाय निवडा.'
      )
    );
  }

  if (checkPrefix('INVALID_PINCODE:')) {
    return withErrorCode(
      'invalid-argument',
      pickLocalized(
        lang,
        'Invalid PIN code. Please enter a valid 6-digit Indian PIN code (for example, 442401).',
        'अमान्य पिनकोड। कृपया सही 6 अंकों का भारतीय पिनकोड दर्ज करें (उदाहरण: 442401)।',
        'पिनकोड चुकीचा आहे. कृपया वैध ६ अंकी भारतीय पिनकोड भरा (उदा. 442401).'
      )
    );
  }

  if (checkPrefix('LOCATION_PERMISSION_DENIED:')) {
    return withErrorCode(
      'location-permission-denied',
      pickLocalized(
        lang,
        'Location permission was denied by your browser or device. Please enable GPS permission or enter your 6-digit PIN code / select your area on the map.',
        'ब्राउज़र या डिवाइस ने लोकेशन अनुमति अस्वीकार कर दी है। कृपया GPS अनुमति चालू करें या अपना 6 अंकों का पिनकोड भरें / मैप से क्षेत्र चुनें।',
        'ब्राउझर किंवा डिव्हाइसने लोकेशनची परवानगी नाकारली आहे. कृपया GPS परवानगी द्या किंवा ६ अंकी पिनकोड भरा / नकाशावर ठिकाण निवडा.'
      )
    );
  }

  if (checkPrefix('NETWORK_ERROR:')) {
    return withErrorCode(
      'unavailable',
      pickLocalized(
        lang,
        'Network unavailable. Please check your internet connection and try submitting again.',
        'इंटरनेट नेटवर्क उपलब्ध नहीं है। कृपया अपना इंटरनेट कनेक्शन जाँचें और फिर से प्रयास करें।',
        'इंटरनेट नेटवर्क उपलब्ध नाही. कृपया तुमचे इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.'
      )
    );
  }

  if (checkPrefix('SERVER_ERROR:')) {
    return withErrorCode(
      'internal',
      pickLocalized(
        lang,
        'Server error while processing your request. Please wait a moment and try again.',
        'आपकी रिक्वेस्ट प्रोसेस करते समय सर्वर त्रुटि हुई। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
        'तुमची रिक्वेस्ट प्रक्रिया करताना सर्व्हर त्रुटी आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
      )
    );
  }

  if (checkPrefix('DB_WRITE_ERROR:')) {
    return withErrorCode(
      errCode && errCode !== 'unknown' ? errCode : 'db-write-error',
      pickLocalized(
        lang,
        'Database write failed while saving your work request. Please retry in a moment.',
        'आपकी काम की रिक्वेस्ट डेटाबेस में सहेजने में समस्या हुई। कृपया थोड़ी देर में पुनः प्रयास करें।',
        'तुमची कामाची रिक्वेस्ट डेटाबेसमध्ये जतन करता आली नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
      )
    );
  }

  const normalizedCode = errCode.replace(/^(firestore|auth|functions|storage)\//, '');
  const displayCode = errCode.startsWith('auth/') ? errCode : normalizedCode;
  const lower = `${errCode} ${effectiveMsg}`.toLowerCase();

  // 1. Popup / Google Auth client errors
  if (lower.includes('popup-closed-by-user')) {
    return withErrorCode(
      'auth/popup-closed-by-user',
      pickLocalized(
        lang,
        'Google sign-in window was closed before completion. Click Sign In again to continue.',
        'गूगल लॉगिन विंडो पूरी होने से पहले बंद हो गई। आगे बढ़ने के लिए कृपया फिर से लॉगिन करें।',
        'गुगल लॉगिन पूर्ण होण्यापूर्वी विंडो बंद झाली. पुढे जाण्यासाठी कृपया पुन्हा लॉगिन करा.'
      )
    );
  }

  if (lower.includes('popup-blocked')) {
    return withErrorCode(
      'auth/popup-blocked',
      pickLocalized(
        lang,
        'Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again.',
        'ब्राउज़र ने गूगल लॉगिन पॉपअप रोक दिया है। कृपया इस साइट के लिए पॉपअप की अनुमति दें और पुनः प्रयास करें।',
        'ब्राउझरने गुगल लॉगिन पॉपअप थांबवला आहे. कृपया या साइटसाठी पॉपअप सुरू करून पुन्हा प्रयत्न करा.'
      )
    );
  }

  if (lower.includes('unauthorized-domain')) {
    return withErrorCode(
      'auth/unauthorized-domain',
      pickLocalized(
        lang,
        'This domain is not yet authorized in Firebase Authentication settings.',
        'यह डोमेन अभी Firebase Authentication में अधिकृत नहीं है।',
        'हा डोमेन अद्याप Firebase Authentication मध्ये मंजूर नाही.'
      )
    );
  }

  // 2. UNAUTHENTICATED (expired / missing / invalid auth token)
  if (
    normalizedCode === 'unauthenticated' ||
    normalizedCode === 'id-token-expired' ||
    normalizedCode === 'user-token-expired' ||
    normalizedCode === 'user-token-revoked' ||
    lower.includes('unauthenticated') ||
    lower.includes('id-token-expired') ||
    lower.includes('user-token-expired') ||
    (parsedStructuredJson && !userId && lower.includes('permission'))
  ) {
    return withErrorCode(
      displayCode && displayCode !== 'unknown' ? displayCode : 'unauthenticated',
      pickLocalized(
        lang,
        'Your Google sign-in session is missing or expired. Please sign out and sign in with Google again, then retry.',
        'आपका गूगल लॉगिन सत्र उपलब्ध नहीं है या समाप्त हो गया है। कृपया लॉग आउट करके फिर से गूगल लॉगिन करें और पुनः प्रयास करें।',
        'तुमचे गुगल लॉगिन सेशन उपलब्ध नाही किंवा संपले आहे. कृपया लॉग आउट करून पुन्हा गुगल लॉगिन करा आणि प्रयत्न करा.'
      )
    );
  }

  // 3. INVALID-ARGUMENT (bad field value / data type / oversized payload)
  if (
    normalizedCode === 'invalid-argument' ||
    lower.includes('invalid-argument') ||
    lower.includes('unsupported field value') ||
    lower.includes('exceeds the maximum allowed size') ||
    lower.includes('invalid data')
  ) {
    return withErrorCode(
      'invalid-argument',
      pickLocalized(
        lang,
        'Some request fields or attached photos have an invalid format or exceed size limits. Please review your category, 6-digit PIN code, and photos, then retry.',
        'रिक्वेस्ट के कुछ विवरण या संलग्न फ़ोटो का प्रारूप अमान्य है या आकार सीमा से अधिक है। कृपया श्रेणी, 6 अंकों का पिनकोड और फ़ोटो जाँचकर पुनः प्रयास करें।',
        'रिक्वेस्ट मधील काही माहिती किंवा जोडलेले फोटो चुकीच्या स्वरूपात आहेत किंवा आकार मर्यादेपेक्षा मोठे आहेत. कृपया श्रेणी, ६ अंकी पिनकोड व फोटो तपासून पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 4. UNAVAILABLE (network offline or Firestore service temporarily unreachable)
  if (
    normalizedCode === 'unavailable' ||
    normalizedCode === 'network-request-failed' ||
    lower.includes('auth/network-request-failed') ||
    lower.includes('client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('err_internet_disconnected')
  ) {
    return withErrorCode(
      displayCode && displayCode !== 'unknown' ? displayCode : 'unavailable',
      pickLocalized(
        lang,
        'Firestore service or internet connection is temporarily unavailable. Please check your network and try again in a moment.',
        'Firestore सेवा या इंटरनेट कनेक्शन अस्थायी रूप से उपलब्ध नहीं है। कृपया अपना नेटवर्क जाँचें और कुछ क्षण बाद पुनः प्रयास करें।',
        'Firestore सेवा किंवा इंटरनेट कनेक्शन तात्पुरते उपलब्ध नाही. कृपया नेटवर्क तपासून थोड्या वेळाने पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 5. FAILED-PRECONDITION (index/state mismatch)
  if (
    normalizedCode === 'failed-precondition' ||
    lower.includes('failed-precondition') ||
    lower.includes('requires an index')
  ) {
    return withErrorCode(
      'failed-precondition',
      pickLocalized(
        lang,
        'Database precondition failed (a required index or document state is not ready). Please refresh the page and try again.',
        'आवश्यक डेटाबेस शर्त या इंडेक्स तैयार न होने के कारण अनुरोध पूरा नहीं हो सका। कृपया पेज रीफ़्रेश करें और पुनः प्रयास करें।',
        'आवश्यक डेटाबेस अट किंवा इंडेक्स तयार नसल्यामुळे ही प्रक्रिया पूर्ण होऊ शकली नाही. कृपया पेज रीफ्रेश करून पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 6. INTERNAL / HTTP 5xx server error
  if (
    normalizedCode === 'internal' ||
    lower.includes('http 500') ||
    lower.includes('http 502') ||
    lower.includes('http 503') ||
    lower.includes('http 504') ||
    lower.includes('internal server error') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable')
  ) {
    return withErrorCode(
      'internal',
      pickLocalized(
        lang,
        'An internal database or server error occurred while processing your request. Please wait a moment and try again.',
        'आपकी रिक्वेस्ट प्रोसेस करते समय आंतरिक डेटाबेस या सर्वर त्रुटि हुई। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
        'तुमची रिक्वेस्ट प्रक्रिया करताना अंतर्गत डेटाबेस किंवा सर्व्हर त्रुटी आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 7. QUOTA / RESOURCE-EXHAUSTED
  if (
    normalizedCode === 'resource-exhausted' ||
    lower.includes('resource-exhausted') ||
    lower.includes('quota exceeded')
  ) {
    return withErrorCode(
      'resource-exhausted',
      pickLocalized(
        lang,
        'Database usage quota limit has been temporarily reached. Please try again shortly.',
        'डेटाबेस उपयोग सीमा अस्थायी रूप से पूरी हो गई है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
        'डेटाबेस वापर मर्यादा तात्पुरती पूर्ण झाली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 8. TIMEOUT / ABORTED
  if (
    normalizedCode === 'deadline-exceeded' ||
    normalizedCode === 'aborted' ||
    lower.includes('deadline-exceeded') ||
    lower.includes('aborted')
  ) {
    return withErrorCode(
      normalizedCode === 'aborted' ? 'aborted' : 'deadline-exceeded',
      pickLocalized(
        lang,
        'The database request timed out or was interrupted before completion. Please try submitting again.',
        'डेटाबेस अनुरोध का समय समाप्त हो गया या बाधा आई। कृपया दोबारा प्रयास करें।',
        'डेटाबेस रिक्वेस्टचा वेळ संपला किंवा अडथळा आला. कृपया पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 9. NOT-FOUND / ALREADY-EXISTS / CANCELLED
  if (normalizedCode === 'not-found') {
    return withErrorCode(
      'not-found',
      pickLocalized(
        lang,
        'The requested database record was not found. Please refresh and try again.',
        'अनुरोधित डेटाबेस रिकॉर्ड नहीं मिला। कृपया पेज रीफ़्रेश करें और पुनः प्रयास करें।',
        'मागितलेली डेटाबेस नोंद सापडली नाही. कृपया पेज रीफ्रेश करून पुन्हा प्रयत्न करा.'
      )
    );
  }

  if (normalizedCode === 'already-exists') {
    return withErrorCode(
      'already-exists',
      pickLocalized(
        lang,
        'A duplicate record with this ID already exists. Please refresh to view your saved request.',
        'इस आईडी के साथ रिकॉर्ड पहले से मौजूद है। कृपया अपनी सहेजी गई रिक्वेस्ट देखने के लिए रीफ़्रेश करें।',
        'या आयडीची नोंद आधीच अस्तित्वात आहे. कृपया तुमची जतन केलेली रिक्वेस्ट पाहण्यासाठी रीफ्रेश करा.'
      )
    );
  }

  if (normalizedCode === 'cancelled') {
    return withErrorCode(
      'cancelled',
      pickLocalized(
        lang,
        'The request was cancelled before it could complete. Please try again.',
        'अनुरोध पूरा होने से पहले रद्द हो गया। कृपया पुनः प्रयास करें।',
        'रिक्वेस्ट पूर्ण होण्यापूर्वी रद्द झाली. कृपया पुन्हा प्रयत्न करा.'
      )
    );
  }

  // 10. PERMISSION-DENIED (Firestore security rules / ownership check)
  if (
    normalizedCode === 'permission-denied' ||
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('insufficient permissions')
  ) {
    if (emailVerified === false) {
      return withErrorCode(
        'permission-denied',
        pickLocalized(
          lang,
          'Firestore denied access because your Google email is not verified. Please sign in with a verified Google account.',
          'आपका गूगल ईमेल सत्यापित न होने के कारण Firestore ने अनुमति अस्वीकार की। कृपया सत्यापित गूगल खाते से लॉगिन करें।',
          'तुमचा गुगल ईमेल सत्यापित नसल्याने Firestore ने परवानगी नाकारली. कृपया सत्यापित गुगल खात्याने लॉगिन करा.'
        )
      );
    }
    if (errorPath.includes('mobileUniquenessLocks') || errorPath.includes('demo_mobile_registry')) {
      return withErrorCode(
        'permission-denied',
        pickLocalized(
          lang,
          'This mobile number is already registered with another account. Duplicate mobile numbers are not allowed.',
          'यह मोबाइल नंबर पहले से किसी अन्य खाते में पंजीकृत है। डुप्लिकेट मोबाइल नंबर की अनुमति नहीं है।',
          'हा मोबाईल नंबर आधीच दुसऱ्या खात्याशी नोंदणीकृत आहे. एकच नंबर पुन्हा वापरता येणार नाही.'
        )
      );
    }
    if (errorPath.includes('profilePhotos')) {
      return withErrorCode(
        'permission-denied',
        pickLocalized(
          lang,
          'Unable to save profile photo due to size or Firestore permission checks. Please try a JPG/PNG/WebP image under 5 MB or submit without a photo.',
          'आकार सीमा या Firestore अनुमति नियम के कारण फ़ोटो सहेजी नहीं जा सकी। कृपया 5 MB से कम की JPG/PNG/WebP फ़ोटो चुनें या बिना फ़ोटो सबमिट करें।',
          'आकार मर्यादा किंवा Firestore परवानगी तपासणीमुळे फोटो जतन करता आला नाही. कृपया 5 MB पेक्षा लहान JPG/PNG/WebP फोटो निवडा किंवा फोटोशिवाय पुढे जा.'
        )
      );
    }
    if (errorPath.includes('jobs') || errorPath.includes('applications')) {
      return withErrorCode(
        'permission-denied',
        pickLocalized(
          lang,
          `Firestore rules denied this write (${errorPath || 'jobs'}). Check that you are signed in with Google and that work category, 6-digit PIN code, and account ID are valid.`,
          `Firestore सुरक्षा नियम ने इस रिक्वेस्ट (${errorPath || 'jobs'}) को अस्वीकार किया। कृपया जाँचें कि आप गूगल से लॉगिन हैं और काम की श्रेणी व 6 अंकों का पिनकोड सही है।`,
          `Firestore सुरक्षा नियमाने ही रिक्वेस्ट (${errorPath || 'jobs'}) नाकारली. कृपया गुगल खात्याने लॉगिन केल्याची तसेच कामाची श्रेणी व ६ अंकी पिनकोड अचूक असल्याची खात्री करा.`
        )
      );
    }
    return withErrorCode(
      'permission-denied',
      pickLocalized(
        lang,
        `Firestore rules denied access${errorPath ? ` (${errorPath})` : ''}. Please verify your Google sign-in and try again.`,
        `Firestore सुरक्षा नियम ने अनुमति अस्वीकार की${errorPath ? ` (${errorPath})` : ''}। कृपया अपना गूगल लॉगिन जाँचें और पुनः प्रयास करें।`,
        `Firestore सुरक्षा नियमाने परवानगी नाकारली${errorPath ? ` (${errorPath})` : ''}. कृपया तुमचे गुगल लॉगिन तपासून पुन्हा प्रयत्न करा.`
      )
    );
  }

  // Any other real Firebase/Firestore/Auth code: surface the exact code + concise reason without leaking raw JSON
  if (displayCode && displayCode !== 'unknown') {
    const cleanReason =
      effectiveMsg && !effectiveMsg.trim().startsWith('{') && !effectiveMsg.trim().startsWith('[')
        ? effectiveMsg.replace(/^FirebaseError:\s*/i, '').trim().slice(0, 140)
        : '';
    return withErrorCode(
      displayCode,
      cleanReason ? `${resolvedFallback} (${cleanReason})` : resolvedFallback
    );
  }

  // Never leak raw JSON objects directly into user UI
  if (parsedStructuredJson || effectiveMsg.trim().startsWith('{') || effectiveMsg.trim().startsWith('[')) {
    return resolvedFallback;
  }

  return effectiveMsg;
}
