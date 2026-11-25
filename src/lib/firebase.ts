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

  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!raw) return resolvedFallback;

  if (raw.startsWith('DUPLICATE_MOBILE:')) {
    return raw.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim() || resolvedFallback;
  }

  if (raw.startsWith('AUTH_REQUIRED:')) {
    return pickLocalized(
      lang,
      'Please sign in with your verified Google account before submitting this request.',
      'यह रिक्वेस्ट भेजने से पहले कृपया अपने सत्यापित गूगल खाते से लॉगिन करें।',
      'रिक्वेस्ट पाठवण्यापूर्वी कृपया तुमच्या सत्यापित गुगल खात्याने लॉगिन करा.'
    );
  }

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

  if (effectiveMsg.startsWith('DUPLICATE_MOBILE:')) {
    return effectiveMsg.replace(/^DUPLICATE_MOBILE:\s*/i, '').trim() || resolvedFallback;
  }

  if (effectiveMsg.startsWith('AUTH_REQUIRED:')) {
    return pickLocalized(
      lang,
      'Please sign in with your verified Google account before submitting this request.',
      'यह रिक्वेस्ट भेजने से पहले कृपया अपने सत्यापित गूगल खाते से लॉगिन करें।',
      'रिक्वेस्ट पाठवण्यापूर्वी कृपया तुमच्या सत्यापित गुगल खात्याने लॉगिन करा.'
    );
  }

  const lower = effectiveMsg.toLowerCase();
  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('insufficient permissions')
  ) {
    if (emailVerified === false) {
      return pickLocalized(
        lang,
        'Your signed-in Google email is not verified. Please sign in with a verified Google account to continue.',
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
        'Could not send your work request right now. Please ensure you are signed in with a verified Google account and all required fields (service, location/pincode) are filled, then try again.',
        'अभी आपकी काम की रिक्वेस्ट भेजी नहीं जा सकी। कृपया सुनिश्चित करें कि आप सत्यापित गूगल खाते से लॉगिन हैं और सभी आवश्यक विवरण (सेवा, स्थान/पिनकोड) सही भरे हैं, फिर पुनः प्रयास करें।',
        'सध्या तुमची कामाची रिक्वेस्ट पाठवता आली नाही. कृपया तुम्ही सत्यापित गुगल खात्याने लॉगिन केल्याची आणि सर्व आवश्यक माहिती (काम, ठिकाण/पिनकोड) अचूक भरल्याची खात्री करून पुन्हा प्रयत्न करा.'
      );
    }
    return pickLocalized(
      lang,
      'Your request could not be saved due to account permission or form validation checks. Please verify your Google sign-in and required fields, then try again.',
      'खाता अनुमति या फ़ॉर्म जाँच के कारण आपकी रिक्वेस्ट सहेजी नहीं जा सकी। कृपया गूगल लॉगिन और सभी आवश्यक विवरण जाँचकर पुनः प्रयास करें।',
      'खाते परवानगी किंवा फॉर्म तपासणीमुळे तुमची विनंती जतन करता आली नाही. कृपया गुगल लॉगिन आणि सर्व आवश्यक माहिती तपासून पुन्हा प्रयत्न करा.'
    );
  }

  if (
    lower.includes('client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  ) {
    return pickLocalized(
      lang,
      'Network connection error while contacting ROJGAR SETU servers. Please check your internet and try again.',
      'रोजगार सेतु सर्वर से जुड़ने में नेटवर्क समस्या आ रही है। कृपया अपना इंटरनेट जाँचें और पुनः प्रयास करें।',
      'रोजगार सेतू सर्व्हरशी संपर्क साधताना इंटरनेटची अडचण येत आहे. कृपया नेटवर्क तपासून पुन्हा प्रयत्न करा.'
    );
  }

  if (lower.includes('auth/popup-closed-by-user')) {
    return pickLocalized(
      lang,
      'Sign-in window was closed before completion. Click Sign In again to continue.',
      'लॉगिन विंडो पूरी होने से पहले बंद हो गई। आगे बढ़ने के लिए कृपया फिर से लॉगिन करें।',
      'लॉगिन पूर्ण होण्यापूर्वी विंडो बंद झाली. पुढे जाण्यासाठी कृपया पुन्हा लॉगिन करा.'
    );
  }
  if (lower.includes('auth/popup-blocked')) {
    return pickLocalized(
      lang,
      'Browser blocked the Google Sign-In popup. Please allow popups for this site and try again.',
      'ब्राउज़र ने गूगल लॉगिन पॉपअप रोक दिया है। कृपया पॉपअप की अनुमति दें और पुनः प्रयास करें।',
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

  // Never leak raw JSON objects or low-level Firebase technical strings directly into user UI
  if (
    parsedStructuredJson ||
    effectiveMsg.trim().startsWith('{') ||
    effectiveMsg.trim().startsWith('[') ||
    lower.startsWith('firebaseerror:') ||
    lower.includes('firestoreerror')
  ) {
    return resolvedFallback;
  }

  return effectiveMsg;
}
