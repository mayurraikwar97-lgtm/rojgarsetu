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
  return 'en';
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
  const errCode = typeof errObj?.code === 'string' ? errObj.code.toLowerCase() : '';
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : typeof errObj?.message === 'string' ? errObj.message : '';
  if (!raw && !errCode) return resolvedFallback;

  let effectiveMsg = raw;
  let errorPath = '';
  let emailVerified: boolean | null | undefined;
  let parsedStructuredJson = false;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
      parsedStructuredJson = true;
      if (typeof parsed.error === 'string' && parsed.error) {
        effectiveMsg = parsed.error;
      }
      if (typeof parsed.path === 'string') {
        errorPath = parsed.path;
      }
      emailVerified = parsed.authInfo?.emailVerified;
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

  const lower = `${errCode} ${effectiveMsg}`.toLowerCase();

  if (
    lower.includes('auth/popup-closed-by-user') ||
    lower.includes('popup-closed-by-user')
  ) {
    return pickLocalized(
      lang,
      'Google sign-in window was closed before completion. Click Sign In again to continue.',
      'गूगल लॉगिन विंडो पूरी होने से पहले बंद हो गई। आगे बढ़ने के लिए कृपया फिर से लॉगिन करें।',
      'गुगल लॉगिन पूर्ण होण्यापूर्वी विंडो बंद झाली. पुढे जाण्यासाठी कृपया पुन्हा लॉगिन करा.'
    );
  }

  if (lower.includes('auth/popup-blocked') || lower.includes('popup-blocked')) {
    return pickLocalized(
      lang,
      'Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again.',
      'ब्राउज़र ने गूगल लॉगिन पॉपअप रोक दिया है। कृपया इस साइट के लिए पॉपअप की अनुमति दें और पुनः प्रयास करें।',
      'ब्राउझरने गुगल लॉगिन पॉपअप थांबवला आहे. कृपया या साइटसाठी पॉपअप सुरू करून पुन्हा प्रयत्न करा.'
    );
  }

  if (lower.includes('auth/unauthorized-domain')) {
    return pickLocalized(
      lang,
      'This domain is not yet authorized in Firebase Authentication settings.',
      'यह डोमेन अभी Firebase Authentication में अधिकृत नहीं है।',
      'हा डोमेन अद्याप Firebase Authentication मध्ये मंजूर नाही.'
    );
  }

  if (
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
      'Network unavailable while contacting ROJGAR SETU servers. Please check your internet connection and try again.',
      'रोजगार सेतु सर्वर से जुड़ने में नेटवर्क समस्या आ रही है। कृपया अपना इंटरनेट कनेक्शन जाँचें और पुनः प्रयास करें।',
      'रोजगार सेतू सर्व्हरशी संपर्क साधताना इंटरनेटची अडचण येत आहे. कृपया नेटवर्क तपासून पुन्हा प्रयत्न करा.'
    );
  }

  if (
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
      'Server error while processing your request. Please wait a moment and try again.',
      'आपकी रिक्वेस्ट प्रोसेस करते समय सर्वर त्रुटि हुई। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
      'तुमची रिक्वेस्ट प्रक्रिया करताना सर्व्हर त्रुटी आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
    );
  }

  if (
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
        'Unable to save profile photo due to size or security checks. Please try a JPG/PNG/WebP image under 5 MB or submit without a photo.',
        'सुरक्षा या आकार सीमा के कारण फ़ोटो सहेजी नहीं जा सकी। कृपया 5 MB से कम की JPG/PNG/WebP फ़ोटो चुनें या बिना फ़ोटो सबमिट करें।',
        'आकार किंवा सुरक्षा तपासणीमुळे फोटो जतन करता आला नाही. कृपया 5 MB पेक्षा लहान JPG/PNG/WebP फोटो निवडा किंवा फोटोशिवाय पुढे जा.'
      );
    }
    if (errorPath.includes('jobs') || errorPath.includes('applications')) {
      return pickLocalized(
        lang,
        'Database write failed due to security validation on your work request. Please sign out and sign back in with Google, verify your work category and 6-digit PIN code, and try again.',
        'आपकी काम की रिक्वेस्ट की सुरक्षा जाँच में डेटाबेस लेखन विफल रहा। कृपया गूगल से दोबारा लॉगिन करें, काम की श्रेणी व 6 अंकों का पिनकोड जाँचें और पुनः प्रयास करें।',
        'तुमच्या कामाच्या रिक्वेस्टची डेटाबेस सुरक्षा तपासणी पूर्ण होऊ शकली नाही. कृपया गुगल खात्याने पुन्हा लॉगिन करून कामाची श्रेणी व ६ अंकी पिनकोड तपासा आणि पुन्हा प्रयत्न करा.'
      );
    }
    return pickLocalized(
      lang,
      'Database write rejected due to account permissions or validation rules. Please verify your Google sign-in and required fields, then try again.',
      'खाता अनुमति या सत्यापन नियमों के कारण डेटाबेस लेखन अस्वीकार हुआ। कृपया गूगल लॉगिन व आवश्यक विवरण जाँचकर पुनः प्रयास करें।',
      'खाते परवानगी किंवा डेटा तपासणीमुळे डेटाबेस जतन अयशस्वी झाले. कृपया गुगल लॉगिन व सर्व आवश्यक माहिती तपासून पुन्हा प्रयत्न करा.'
    );
  }

  if (
    lower.includes('deadline-exceeded') ||
    lower.includes('resource-exhausted') ||
    lower.includes('aborted') ||
    lower.includes('failed-precondition')
  ) {
    return pickLocalized(
      lang,
      'Database write timed out or was interrupted. Please try submitting your request again.',
      'डेटाबेस में रिक्वेस्ट सहेजते समय समय समाप्त हो गया या बाधा आई। कृपया दोबारा प्रयास करें।',
      'डेटाबेसमध्ये रिक्वेस्ट जतन करताना वेळ संपला किंवा अडथळा आला. कृपया पुन्हा प्रयत्न करा.'
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
