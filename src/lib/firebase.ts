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
  const parenMatch = msg.match(/\((?:firestore|auth|functions|storage)\/([a-z0-9-]+)\)/i);
  if (parenMatch?.[1]) {
    return parenMatch[1].toLowerCase();
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
  if (lower.includes('aborted')) return 'aborted';
  if (lower.includes('internal server error') || lower.includes('firestore/internal')) return 'internal';
  return 'unknown';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errCode = extractFirebaseErrorCode(error);
  const errInfo: FirestoreErrorInfo = {
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
  console.error(`Firestore Error [${errCode}] (${operationType} ${path || ''}):`, errInfo);
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
      // Never leak malformed raw JSON to the UI
      return resolvedFallback;
    }
  }

  const checkPrefix = (prefix: string) =>
    raw.startsWith(prefix) || effectiveMsg.startsWith(prefix);

  if (checkPrefix('DUPLICATE_MOBILE:')) {
    return effectiveMsg.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim() || resolvedFallback;
  }

  if (checkPrefix('AUTH_REQUIRED:')) {
    return pickLocalized(
      lang,
      'Google sign-in is required before submitting your work request. Please sign in with Google and try again.',
      'काम की रिक्वेस्ट भेजने से पहले गूगल लॉगिन आवश्यक है। कृपया अपने गूगल खाते से लॉगिन करें और पुनः प्रयास करें।',
      'कामाची रिक्वेस्ट पाठवण्यापूर्वी गुगल लॉगिन आवश्यक आहे. कृपया गुगल खात्याने लॉगिन करून पुन्हा प्रयत्न करा.'
    );
  }

  if (checkPrefix('EMAIL_UNVERIFIED:')) {
    return pickLocalized(
      lang,
      'Your Google email address is not verified. Please sign in with a verified Google account to submit your request.',
      'आपका गूगल ईमेल सत्यापित नहीं है। रिक्वेस्ट भेजने के लिए कृपया सत्यापित गूगल खाते से लॉगिन करें।',
      'तुमचा गुगल ईमेल सत्यापित नाही. रिक्वेस्ट पाठवण्यासाठी कृपया सत्यापित गुगल खात्याने लॉगिन करा.'
    );
  }

  if (checkPrefix('MISSING_CATEGORY:')) {
    return pickLocalized(
      lang,
      'Please select a work category or custom profession before submitting your request.',
      'रिक्वेस्ट भेजने से पहले कृपया काम की श्रेणी या कस्टम व्यवसाय चुनें।',
      'रिक्वेस्ट पाठवण्यापूर्वी कृपया कामाची श्रेणी किंवा कस्टम व्यवसाय निवडा.'
    );
  }

  if (checkPrefix('INVALID_PINCODE:')) {
    return pickLocalized(
      lang,
      'Invalid PIN code. Please enter a valid 6-digit Indian PIN code (for example, 442401).',
      'अमान्य पिनकोड। कृपया सही 6 अंकों का भारतीय पिनकोड दर्ज करें (उदाहरण: 442401)।',
      'पिनकोड चुकीचा आहे. कृपया वैध ६ अंकी भारतीय पिनकोड भरा (उदा. 442401).'
    );
  }

  if (checkPrefix('LOCATION_PERMISSION_DENIED:')) {
    return pickLocalized(
      lang,
      'Location permission was denied by your browser or device. Please enable GPS permission or enter your 6-digit PIN code / select your area on the map.',
      'ब्राउज़र या डिवाइस ने लोकेशन अनुमति अस्वीकार कर दी है। कृपया GPS अनुमति चालू करें या अपना 6 अंकों का पिनकोड भरें / मैप से क्षेत्र चुनें।',
      'ब्राउझर किंवा डिव्हाइसने लोकेशनची परवानगी नाकारली आहे. कृपया GPS परवानगी द्या किंवा ६ अंकी पिनकोड भरा / नकाशावर ठिकाण निवडा.'
    );
  }

  if (checkPrefix('NETWORK_ERROR:')) {
    return pickLocalized(
      lang,
      'Network unavailable. Please check your internet connection and try submitting again.',
      'इंटरनेट नेटवर्क उपलब्ध नहीं है। कृपया अपना इंटरनेट कनेक्शन जाँचें और फिर से प्रयास करें।',
      'इंटरनेट नेटवर्क उपलब्ध नाही. कृपया तुमचे इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.'
    );
  }

  if (checkPrefix('SERVER_ERROR:')) {
    return pickLocalized(
      lang,
      'Server error while processing your request. Please wait a moment and try again.',
      'आपकी रिक्वेस्ट प्रोसेस करते समय सर्वर त्रुटि हुई। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
      'तुमची रिक्वेस्ट प्रक्रिया करताना सर्व्हर त्रुटी आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  if (checkPrefix('DB_WRITE_ERROR:')) {
    return pickLocalized(
      lang,
      'Database write failed while saving your work request. Please retry in a moment.',
      'आपकी काम की रिक्वेस्ट डेटाबेस में सहेजने में समस्या हुई। कृपया थोड़ी देर में पुनः प्रयास करें।',
      'तुमची कामाची रिक्वेस्ट डेटाबेसमध्ये जतन करता आली नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  const normalizedCode = errCode.replace(/^(firestore|auth|functions|storage)\//, '');
  const lower = `${errCode} ${effectiveMsg}`.toLowerCase();

  // 1. Popup / Google Auth client errors
  if (lower.includes('popup-closed-by-user')) {
    return pickLocalized(
      lang,
      'Google sign-in window was closed before completion. Click Sign In again to continue.',
      'गूगल लॉगिन विंडो पूरी होने से पहले बंद हो गई। आगे बढ़ने के लिए कृपया फिर से लॉगिन करें।',
      'गुगल लॉगिन पूर्ण होण्यापूर्वी विंडो बंद झाली. पुढे जाण्यासाठी कृपया पुन्हा लॉगिन करा.'
    );
  }

  if (lower.includes('popup-blocked')) {
    return pickLocalized(
      lang,
      'Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again.',
      'ब्राउज़र ने गूगल लॉगिन पॉपअप रोक दिया है। कृपया इस साइट के लिए पॉपअप की अनुमति दें और पुनः प्रयास करें।',
      'ब्राउझरने गुगल लॉगिन पॉपअप थांबवला आहे. कृपया या साइटसाठी पॉपअप सुरू करून पुन्हा प्रयत्न करा.'
    );
  }

  if (lower.includes('unauthorized-domain')) {
    return pickLocalized(
      lang,
      'This domain is not yet authorized in Firebase Authentication settings.',
      'यह डोमेन अभी Firebase Authentication में अधिकृत नहीं है।',
      'हा डोमेन अद्याप Firebase Authentication मध्ये मंजूर नाही.'
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
    return pickLocalized(
      lang,
      'Your Google sign-in session has expired or is missing. Please sign out and sign in with Google again, then retry.',
      'आपका गूगल लॉगिन सत्र समाप्त हो गया है या उपलब्ध नहीं है। कृपया फिर से गूगल लॉगिन करें और पुनः प्रयास करें।',
      'तुमचे गुगल लॉगिन सेशन संपले आहे किंवा उपलब्ध नाही. कृपया लॉग आउट करून पुन्हा गुगल लॉगिन करा आणि प्रयत्न करा.'
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
    return pickLocalized(
      lang,
      'Some form values or attached photos have an invalid format or exceed size limits. Please review your category, PIN code, and photos, then retry.',
      'फॉर्म के कुछ विवरण या संलग्न फ़ोटो का प्रारूप अमान्य है या आकार सीमा से अधिक है। कृपया श्रेणी, पिनकोड और फ़ोटो जाँचकर पुनः प्रयास करें।',
      'फॉर्ममधील काही माहिती किंवा जोडलेले फोटो चुकीच्या स्वरूपात आहेत किंवा आकार मर्यादेपेक्षा मोठे आहेत. कृपया श्रेणी, पिनकोड व फोटो तपासून पुन्हा प्रयत्न करा.'
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
    return pickLocalized(
      lang,
      'Service or internet connection is temporarily unavailable. Please check your network and try again in a moment.',
      'इंटरनेट या सर्वर सेवा अस्थायी रूप से उपलब्ध नहीं है। कृपया अपना नेटवर्क जाँचें और कुछ क्षण बाद पुनः प्रयास करें।',
      'इंटरनेट किंवा सर्व्हर सेवा तात्पुरती उपलब्ध नाही. कृपया नेटवर्क तपासून थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  // 5. FAILED-PRECONDITION (index/state mismatch)
  if (
    normalizedCode === 'failed-precondition' ||
    lower.includes('failed-precondition') ||
    lower.includes('requires an index')
  ) {
    return pickLocalized(
      lang,
      'This action could not be completed because a required database condition or index is not ready. Please refresh the page and try again.',
      'आवश्यक डेटाबेस शर्त या इंडेक्स तैयार न होने के कारण यह अनुरोध पूरा नहीं हो सका। कृपया पेज रीफ़्रेश करें और पुनः प्रयास करें।',
      'आवश्यक डेटाबेस अट किंवा इंडेक्स तयार नसल्यामुळे ही प्रक्रिया पूर्ण होऊ शकली नाही. कृपया पेज रीफ्रेश करून पुन्हा प्रयत्न करा.'
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
    return pickLocalized(
      lang,
      'An internal server error occurred while processing your request. Please wait a moment and try again.',
      'आपकी रिक्वेस्ट प्रोसेस करते समय आंतरिक सर्वर त्रुटि हुई। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
      'तुमची रिक्वेस्ट प्रक्रिया करताना अंतर्गत सर्व्हर त्रुटी आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  // 7. QUOTA / RESOURCE-EXHAUSTED
  if (
    normalizedCode === 'resource-exhausted' ||
    lower.includes('resource-exhausted') ||
    lower.includes('quota exceeded')
  ) {
    return pickLocalized(
      lang,
      'Daily database usage limit has been temporarily reached. Please try again shortly.',
      'दैनिक डेटाबेस उपयोग सीमा अस्थायी रूप से पूरी हो गई है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
      'दैनिक डेटाबेस वापर मर्यादा तात्पुरती पूर्ण झाली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  // 8. TIMEOUT / ABORTED
  if (
    normalizedCode === 'deadline-exceeded' ||
    normalizedCode === 'aborted' ||
    lower.includes('deadline-exceeded') ||
    lower.includes('aborted')
  ) {
    return pickLocalized(
      lang,
      'The database request timed out or was interrupted. Please try submitting again.',
      'डेटाबेस अनुरोध का समय समाप्त हो गया या बाधा आई। कृपया दोबारा प्रयास करें।',
      'डेटाबेस रिक्वेस्टचा वेळ संपला किंवा अडथळा आला. कृपया पुन्हा प्रयत्न करा.'
    );
  }

  // 9. PERMISSION-DENIED (Firestore security rules / ownership check)
  if (
    normalizedCode === 'permission-denied' ||
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('insufficient permissions')
  ) {
    if (emailVerified === false) {
      return pickLocalized(
        lang,
        'Your Google email address is not verified. Please sign in with a verified Google account to continue.',
        'आपका गूगल ईमेल सत्यापित नहीं है। आगे बढ़ने के लिए कृपया सत्यापित गूगल खाते से लॉगिन करें।',
        'तुमचे गुगल ईमेल खाते सत्यापित नाही. पुढे जाण्यासाठी कृपया सत्यापित गुगल खात्याने लॉगिन करा.'
      );
    }
    if (errorPath.includes('mobileUniquenessLocks') || errorPath.includes('demo_mobile_registry')) {
      return pickLocalized(
        lang,
        'This mobile number is already registered with another account. Duplicate mobile numbers are not allowed.',
        'यह मोबाइल नंबर पहले से किसी अन्य खाते में पंजीकृत है। डुप्लिकेट मोबाइल नंबर की अनुमति नहीं है।',
        'हा मोबाईल नंबर आधीच दुसऱ्या खात्याशी नोंदणीकृत आहे. एकच नंबर पुन्हा वापरता येणार नाही.'
      );
    }
    if (errorPath.includes('profilePhotos')) {
      return pickLocalized(
        lang,
        'Unable to save profile photo due to size or permission checks. Please try a JPG/PNG/WebP image under 5 MB or submit without a photo.',
        'सुरक्षा या आकार सीमा के कारण फ़ोटो सहेजी नहीं जा सकी। कृपया 5 MB से कम की JPG/PNG/WebP फ़ोटो चुनें या बिना फ़ोटो सबमिट करें।',
        'आकार किंवा परवानगी तपासणीमुळे फोटो जतन करता आला नाही. कृपया 5 MB पेक्षा लहान JPG/PNG/WebP फोटो निवडा किंवा फोटोशिवाय पुढे जा.'
      );
    }
    if (errorPath.includes('jobs') || errorPath.includes('applications')) {
      return pickLocalized(
        lang,
        'Permission denied by Firestore rules while saving this work request. Please ensure you are signed in with your Google account and all required fields (category, location/PIN) are valid, then retry.',
        'इस काम की रिक्वेस्ट को सहेजते समय Firestore अनुमति नियम से अस्वीकृति मिली। कृपया सत्यापित गूगल खाते से लॉगिन और श्रेणी व स्थान/पिनकोड जाँचकर पुनः प्रयास करें।',
        'ही कामाची रिक्वेस्ट जतन करताना Firestore परवानगी नियमाने अडवले. कृपया गुगल खात्याने लॉगिन केल्याची व कामाची श्रेणी, ठिकाण/पिनकोड अचूक असल्याची खात्री करून पुन्हा प्रयत्न करा.'
      );
    }
    return pickLocalized(
      lang,
      'Permission denied for this account or document. Please verify your Google sign-in and try again.',
      'इस खाते या रिकॉर्ड के लिए अनुमति नहीं है। कृपया अपना गूगल लॉगिन जाँचें और पुनः प्रयास करें।',
      'या खात्यासाठी किंवा नोंदीसाठी परवानगी नाकारली गेली आहे. कृपया तुमचे गुगल लॉगिन तपासून पुन्हा प्रयत्न करा.'
    );
  }

  // Never leak raw JSON objects or low-level Firebase technical strings directly into user UI
  if (
    parsedStructuredJson ||
    effectiveMsg.trim().startsWith('{') ||
    effectiveMsg.trim().startsWith('[') ||
    lower.startsWith('firebaseerror:') ||
    lower.includes('firestoreerror') ||
    lower.includes('firebase:')
  ) {
    return resolvedFallback;
  }

  return effectiveMsg;
}
