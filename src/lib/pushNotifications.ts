import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { getFirebaseVapidKey, resolveFirebaseVapidKey } from './appConfig';
import { db, getFirebaseMessaging } from './firebase';
import type { Language, NotificationPreferences, NotificationToneType } from '../types/domain';
import { getToneTypeForEvent } from './dealWorkflow';

const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

export interface PushOptInResult {
  ok: boolean;
  reason?:
    | 'UNSUPPORTED'
    | 'IOS_REQUIRES_PWA'
    | 'PERMISSION_DENIED'
    | 'PERMISSION_DISMISSED'
    | 'MISSING_VAPID_KEY'
    | 'SW_ERROR'
    | 'TOKEN_ERROR';
  token?: string;
  preferenceSaved?: boolean;
  message: string;
}

export interface BrowserNotificationState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  hasVapidKey: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  requiresIOSHomeScreen: boolean;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function detectIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getBrowserNotificationState(): BrowserNotificationState {
  const isIOS = detectIsIOS();
  const isStandalone = detectIsStandalone();
  const requiresIOSHomeScreen = isIOS && !isStandalone;

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      supported: false,
      permission: 'unsupported',
      hasVapidKey: Boolean(getFirebaseVapidKey()),
      isStandalone,
      isIOS,
      requiresIOSHomeScreen,
    };
  }

  return {
    supported: !requiresIOSHomeScreen,
    permission: Notification.permission,
    hasVapidKey: Boolean(getFirebaseVapidKey()),
    isStandalone,
    isIOS,
    requiresIOSHomeScreen,
  };
}

function detectTokenClientMeta(): {
  platform: 'android' | 'ios' | 'desktop';
  browser: string;
  userAgentShort: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const lower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(lower);
  const isAndroid = /android/.test(lower);
  const platform: 'android' | 'ios' | 'desktop' = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  let browser = 'Browser';
  if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/crios|chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return {
    platform,
    browser,
    userAgentShort: ua.slice(0, 150) || 'unknown',
  };
}

function hashTokenDocId(uid: string, token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return `${cleanUid}_${hash.toString(16)}`;
}

/**
 * Waits for a specific ServiceWorkerRegistration (e.g. /firebase-messaging-sw.js)
 * to finish installing/activating so getToken() never races against a fresh install.
 */
async function waitForServiceWorkerActive(
  swReg: ServiceWorkerRegistration,
  timeoutMs = 8000
): Promise<ServiceWorkerRegistration> {
  if (swReg.active && swReg.active.state === 'activated') {
    return swReg;
  }

  const candidate = swReg.installing || swReg.waiting || swReg.active;
  if (!candidate) return swReg;

  if (candidate.state === 'activated') return swReg;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      candidate.removeEventListener('statechange', onStateChange);
      window.clearTimeout(timer);
      resolve();
    };
    const onStateChange = () => {
      if (candidate.state === 'activated' || candidate.state === 'redundant') {
        finish();
      }
    };
    const timer = window.setTimeout(finish, timeoutMs);
    candidate.addEventListener('statechange', onStateChange);
  });

  return swReg;
}

/**
 * Registers (or reuses & updates) the dedicated Firebase Cloud Messaging service worker
 * and ensures it is active before token generation.
 */
export async function getOrRegisterMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service Worker API is unavailable in this browser.');
  }

  let swReg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  if (!swReg) {
    swReg = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
      updateViaCache: 'none',
    });
  } else {
    // Non-blocking background update check so SW fixes propagate promptly
    void swReg.update().catch(() => undefined);
  }

  return waitForServiceWorkerActive(swReg);
}

/**
 * Upserts notification_preferences/{uid} using single-document getDoc (compliant with
 * Firestore security rules where `list` is admin-only and `get` is owner-allowed).
 */
export async function ensureNotificationPreferencesDoc(
  uid: string,
  language: Language,
  masterEnabled: boolean
): Promise<void> {
  const ref = doc(db, 'notification_preferences', uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const initial: Omit<NotificationPreferences, 'id'> = {
      ownerUid: uid,
      masterEnabled,
      matchingJobs: true,
      nearbyJobs: true,
      applicationUpdates: true,
      bookingNotifications: true,
      announcements: true,
      preferredLanguage: language,
      soundEnabled: true,
      toneNewJobEnabled: true,
      toneNewOfferEnabled: true,
      toneDealConfirmedEnabled: true,
      toneDealClosedEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
  } else {
    await updateDoc(ref, {
      masterEnabled,
      preferredLanguage: language,
      updatedAt: serverTimestamp(),
    });
  }
}

async function upsertDeviceTokenDoc(params: {
  uid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  language: Language;
  fcmToken: string;
  isDemo: boolean;
  demoAccountId?: string;
}): Promise<string> {
  const tokenId = hashTokenDocId(params.uid, params.fcmToken);
  const meta = detectTokenClientMeta();
  const tokenDocRef = doc(db, 'device_tokens', tokenId);

  const existingSnap = await getDoc(tokenDocRef);
  if (existingSnap.exists()) {
    await updateDoc(tokenDocRef, {
      role: params.role,
      isDemo: params.isDemo,
      ...(params.demoAccountId ? { demoAccountId: params.demoAccountId } : {}),
      token: params.fcmToken,
      platform: meta.platform,
      browser: meta.browser,
      preferredLanguage: params.language,
      enabled: true,
      userAgentShort: meta.userAgentShort,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(tokenDocRef, {
      ownerUid: params.uid,
      role: params.role,
      isDemo: params.isDemo,
      ...(params.demoAccountId ? { demoAccountId: params.demoAccountId } : {}),
      token: params.fcmToken,
      platform: meta.platform,
      browser: meta.browser,
      preferredLanguage: params.language,
      enabled: true,
      userAgentShort: meta.userAgentShort,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return tokenId;
}

export async function enablePushNotificationsForUser(params: {
  uid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  language: Language;
  isDemo?: boolean;
  demoAccountId?: string;
}): Promise<PushOptInResult> {
  const { uid, role, language, isDemo = false, demoAccountId } = params;

  const state = getBrowserNotificationState();
  if (state.requiresIOSHomeScreen) {
    return {
      ok: false,
      reason: 'IOS_REQUIRES_PWA',
      message: tr(
        language,
        'On iPhone/iPad, tap Share → Add to Home Screen first, then open ROJGAR SETU from your Home Screen to enable background push notifications.',
        'iPhone/iPad पर पहले Share → Add to Home Screen करें, फिर Home Screen से ROJGAR SETU खोलकर बैकग्राउंड पुश सूचनाएं चालू करें।',
        'iPhone/iPad वर आधी Share → Add to Home Screen करा, नंतर Home Screen वरून ROJGAR SETU उघडून बॅकग्राउंड पुश सूचना सुरू करा.'
      ),
    };
  }

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED',
      message: tr(
        language,
        'This browser does not support Web Push notifications. Use Chrome on Android/Desktop or Safari (16.4+ installed to Home Screen) on iPhone.',
        'यह ब्राउज़र वेब पुश सूचनाओं का समर्थन नहीं करता। कृपया Android/Desktop पर Chrome या iPhone पर Home Screen ऐप का उपयोग करें।',
        'हा ब्राउझर वेब पुश सूचनांना सपोर्ट करत नाही. कृपया Android/Desktop वर Chrome किंवा iPhone वर Home Screen अ‍ॅप वापरा.'
      ),
    };
  }

  if (Notification.permission === 'denied') {
    return {
      ok: false,
      reason: 'PERMISSION_DENIED',
      message: tr(
        language,
        'Notification permission is blocked in your browser settings. Open Site Settings → Notifications → Allow for ROJGAR SETU.',
        'ब्राउज़र सेटिंग्स में सूचनाएं ब्लॉक हैं। कृपया Site Settings → Notifications → Allow चुनें।',
        'ब्राउझर सेटिंग्जमध्ये सूचना ब्लॉक केल्या आहेत. कृपया Site Settings → Notifications → Allow करा.'
      ),
    };
  }

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: 'PERMISSION_DISMISSED',
      message: tr(
        language,
        'Notification permission was not granted. You can enable it anytime when ready.',
        'सूचना अनुमति नहीं दी गई। आप जब चाहें इसे फिर से चालू कर सकते हैं।',
        'सूचनांची परवानगी दिली गेली नाही. तुम्ही कधीही पुन्हा सुरू करू शकता.'
      ),
    };
  }

  let preferenceSaved = false;
  try {
    await ensureNotificationPreferencesDoc(uid, language, true);
    preferenceSaved = true;
  } catch (err) {
    console.warn('Could not save notification preferences:', err);
  }

  const vapidKey = await resolveFirebaseVapidKey();
  if (!vapidKey) {
    return {
      ok: false,
      reason: 'MISSING_VAPID_KEY',
      preferenceSaved,
      message: tr(
        language,
        'In-app alerts are active, but VITE_FIREBASE_VAPID_KEY is not configured yet for background Web Push tokens.',
        'इन-ऐप अलर्ट चालू हैं, लेकिन बैकग्राउंड वेब पुश टोकन के लिए VITE_FIREBASE_VAPID_KEY अभी सेट नहीं है।',
        'इन-अ‍ॅप अलर्ट सुरू आहेत, पण बॅकग्राउंड वेब पुशसाठी VITE_FIREBASE_VAPID_KEY अद्याप सेट केलेली नाही.'
      ),
    };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return {
      ok: false,
      reason: 'UNSUPPORTED',
      preferenceSaved,
      message: tr(
        language,
        'Firebase Messaging is unavailable in this browser context. On iPhone, open ROJGAR SETU from your Home Screen.',
        'इस ब्राउज़र में Firebase Messaging उपलब्ध नहीं है। iPhone पर Home Screen से ऐप खोलें।',
        'या ब्राउझरमध्ये Firebase Messaging उपलब्ध नाही. iPhone वर Home Screen वरून अ‍ॅप उघडा.'
      ),
    };
  }

  let swReg: ServiceWorkerRegistration;
  try {
    swReg = await getOrRegisterMessagingServiceWorker();
  } catch (err) {
    return {
      ok: false,
      reason: 'SW_ERROR',
      preferenceSaved,
      message: err instanceof Error ? err.message : 'Service worker registration failed.',
    };
  }

  try {
    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!fcmToken) {
      return {
        ok: false,
        reason: 'TOKEN_ERROR',
        preferenceSaved,
        message: tr(
          language,
          'Browser did not return a push token. Please verify HTTPS and VAPID configuration.',
          'ब्राउज़र से पुश टोकन प्राप्त नहीं हुआ। कृपया HTTPS और VAPID कॉन्फ़िगरेशन जांचें।',
          'ब्राउझरकडून पुश टोकन मिळाले नाही. कृपया HTTPS आणि VAPID सेटिंग तपासा.'
        ),
      };
    }

    await upsertDeviceTokenDoc({
      uid,
      role,
      language,
      fcmToken,
      isDemo,
      demoAccountId,
    });

    if (isDemo && demoAccountId) {
      try {
        await updateDoc(doc(db, 'demo_accounts', demoAccountId), {
          assignedUid: uid,
          notificationsEnabled: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Demo account link update notice:', err);
      }
    }

    return {
      ok: true,
      token: fcmToken,
      preferenceSaved,
      message: tr(
        language,
        'Background & live push notifications are now active on this device.',
        'इस डिवाइस पर लाइव और बैकग्राउंड पुश सूचनाएं अब चालू हो गई हैं।',
        'या डिव्हाइसवर लाइव्ह आणि बॅकग्राउंड पुश सूचना आता सुरू झाल्या आहेत.'
      ),
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'TOKEN_ERROR',
      preferenceSaved,
      message: err instanceof Error ? err.message : 'Unable to register FCM device token.',
    };
  }
}

let lastSilentSyncAt = 0;
let lastSilentSyncUid = '';

/**
 * Silently refreshes and saves the user's FCM device token on login / app load / foreground resume
 * ONLY when browser Notification permission is already 'granted' (never triggers a prompt).
 * Keeps worker & customer device tokens fresh so background / closed-app push delivery stays reliable.
 */
export async function syncPushTokenSilentlyIfGranted(params: {
  uid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  language: Language;
  force?: boolean;
}): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  const now = Date.now();
  if (!params.force && lastSilentSyncUid === params.uid && now - lastSilentSyncAt < 5 * 60 * 1000) {
    return true;
  }

  const vapidKey = await resolveFirebaseVapidKey();
  if (!vapidKey) return false;

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;

    const swReg = await getOrRegisterMessagingServiceWorker();

    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!fcmToken) return false;

    await upsertDeviceTokenDoc({
      uid: params.uid,
      role: params.role,
      language: params.language,
      fcmToken,
      isDemo: false,
    });

    lastSilentSyncAt = Date.now();
    lastSilentSyncUid = params.uid;
    return true;
  } catch (err) {
    console.warn('Silent push token sync skipped:', err);
    return false;
  }
}

export async function disablePushNotificationsForUser(uid: string): Promise<void> {
  try {
    const prefRef = doc(db, 'notification_preferences', uid);
    const prefSnap = await getDoc(prefRef);
    if (prefSnap.exists()) {
      await updateDoc(prefRef, {
        masterEnabled: false,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Preference disable warning:', err);
  }

  try {
    const tokenSnap = await getDocs(
      query(collection(db, 'device_tokens'), where('ownerUid', '==', uid))
    );
    await Promise.all(
      tokenSnap.docs.map((d) =>
        updateDoc(doc(db, 'device_tokens', d.id), {
          enabled: false,
          updatedAt: serverTimestamp(),
        })
      )
    );
  } catch (err) {
    console.warn('Token disable warning:', err);
  }

  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch {
    // Ignore if no token active in browser
  }
}

/**
 * Deactivates ONLY the current browser/device FCM token when the user logs out,
 * keeping multi-device tokens active on the user's other logged-in devices.
 */
export async function disableCurrentDeviceTokenOnLogout(uid: string): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }
  const vapidKey = await resolveFirebaseVapidKey();
  if (!vapidKey) return;

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;
    const swReg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
    if (!swReg) return;
    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    }).catch(() => '');

    if (currentToken) {
      const tokenId = hashTokenDocId(uid, currentToken);
      await updateDoc(doc(db, 'device_tokens', tokenId), {
        enabled: false,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    await deleteToken(messaging).catch(() => undefined);
  } catch {
    // Non-blocking cleanup on logout
  }
}

export interface ForegroundPushPayload {
  notificationId?: string;
  dedupeKey?: string;
  title: string;
  body: string;
  route?: string;
  jobId?: string;
  demoJobId?: string;
  lang?: Language;
  voiceScript?: string;
  approxLocationLabel?: string;
  distanceKm?: number;
  toneType?: NotificationToneType;
  eventType?: string;
  playSound?: boolean;
  speakVoice?: boolean;
}

export async function subscribeForegroundPush(
  onReceive: (payload: ForegroundPushPayload) => void
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'ROJGAR SETU';
    const body = payload.notification?.body || payload.data?.body || 'New notification received.';
    const distNum = payload.data?.distanceKm ? Number(payload.data.distanceKm) : NaN;
    const rawLang = payload.data?.lang;
    const toneType = getToneTypeForEvent({
      toneType: payload.data?.toneType,
      eventType: payload.data?.eventType,
    });
    onReceive({
      notificationId: payload.data?.notificationId || undefined,
      dedupeKey: payload.data?.dedupeKey || undefined,
      title,
      body,
      route: payload.data?.route,
      jobId: payload.data?.jobId,
      demoJobId: payload.data?.demoJobId,
      lang: rawLang === 'mr' || rawLang === 'hi' || rawLang === 'en' ? rawLang : undefined,
      voiceScript: payload.data?.voiceScript,
      approxLocationLabel: payload.data?.approxLocationLabel,
      ...(Number.isFinite(distNum) ? { distanceKm: distNum } : {}),
      toneType,
      eventType: payload.data?.eventType,
      playSound: payload.data?.playSound !== 'false',
      speakVoice: payload.data?.speakVoice !== 'false',
    });
  });
}
