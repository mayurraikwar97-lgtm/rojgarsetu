import {
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  collection,
} from 'firebase/firestore';
import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { getFirebaseVapidKey } from './appConfig';
import { db, getFirebaseMessaging } from './firebase';
import type { Language, NotificationPreferences, NotificationToneType } from '../types/domain';
import { getToneTypeForEvent } from './dealWorkflow';

export interface PushOptInResult {
  ok: boolean;
  reason?:
    | 'UNSUPPORTED'
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
}

export function getBrowserNotificationState(): BrowserNotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      supported: false,
      permission: 'unsupported',
      hasVapidKey: Boolean(getFirebaseVapidKey()),
      isStandalone: false,
    };
  }
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  return {
    supported: true,
    permission: Notification.permission,
    hasVapidKey: Boolean(getFirebaseVapidKey()),
    isStandalone,
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

export async function ensureNotificationPreferencesDoc(
  uid: string,
  language: Language,
  masterEnabled: boolean
): Promise<void> {
  const ref = doc(db, 'notification_preferences', uid);
  const snap = await getDocs(
    query(collection(db, 'notification_preferences'), where('ownerUid', '==', uid))
  );
  if (snap.empty) {
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

export async function enablePushNotificationsForUser(params: {
  uid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  language: Language;
  isDemo?: boolean;
  demoAccountId?: string;
}): Promise<PushOptInResult> {
  const { uid, role, language, isDemo = false, demoAccountId } = params;

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED',
      message:
        'This browser does not support Web Push notifications. Use Chrome on Android/Desktop or Safari (16.4+ installed to Home Screen) on iPhone.',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      ok: false,
      reason: 'PERMISSION_DENIED',
      message:
        'Notification permission is blocked in your browser settings. Open Site Settings → Notifications → Allow for ROJGAR SETU.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: 'PERMISSION_DISMISSED',
      message: 'Notification permission was not granted. You can enable it anytime when ready.',
    };
  }

  try {
    await ensureNotificationPreferencesDoc(uid, language, true);
  } catch (err) {
    console.warn('Could not save notification preferences:', err);
  }

  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    return {
      ok: false,
      reason: 'MISSING_VAPID_KEY',
      preferenceSaved: true,
      message:
        'Notification preferences saved, but VITE_FIREBASE_VAPID_KEY is not configured yet for Web Push token generation.',
    };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return {
      ok: false,
      reason: 'UNSUPPORTED',
      preferenceSaved: true,
      message:
        'Firebase Messaging is unavailable in this browser context. On iPhone, first add ROJGAR SETU to Home Screen via Safari.',
    };
  }

  let swReg: ServiceWorkerRegistration;
  try {
    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    await navigator.serviceWorker.ready;
  } catch (err) {
    return {
      ok: false,
      reason: 'SW_ERROR',
      preferenceSaved: true,
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
        preferenceSaved: true,
        message: 'Browser did not return a push token. Please verify HTTPS and VAPID configuration.',
      };
    }

    const tokenId = hashTokenDocId(uid, fcmToken);
    const meta = detectTokenClientMeta();
    const tokenDocRef = doc(db, 'device_tokens', tokenId);

    const existingSnap = await getDocs(
      query(collection(db, 'device_tokens'), where('ownerUid', '==', uid))
    );
    const existingSelf = existingSnap.docs.find((d) => d.id === tokenId);

    if (existingSelf) {
      await updateDoc(tokenDocRef, {
        role,
        isDemo,
        ...(demoAccountId ? { demoAccountId } : {}),
        token: fcmToken,
        platform: meta.platform,
        browser: meta.browser,
        preferredLanguage: language,
        enabled: true,
        userAgentShort: meta.userAgentShort,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(tokenDocRef, {
        ownerUid: uid,
        role,
        isDemo,
        ...(demoAccountId ? { demoAccountId } : {}),
        token: fcmToken,
        platform: meta.platform,
        browser: meta.browser,
        preferredLanguage: language,
        enabled: true,
        userAgentShort: meta.userAgentShort,
        lastSeenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

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
      preferenceSaved: true,
      message: 'Mobile push notifications are now active on this device.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'TOKEN_ERROR',
      preferenceSaved: true,
      message: err instanceof Error ? err.message : 'Unable to register FCM device token.',
    };
  }
}

/**
 * Silently refreshes and saves the user's FCM device token on login / app load
 * ONLY when browser Notification permission is already 'granted' (no permission prompt).
 * Keeps worker & customer device tokens fresh so background / screen-off push delivery stays reliable.
 */
export async function syncPushTokenSilentlyIfGranted(params: {
  uid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  language: Language;
}): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) return false;

  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    await navigator.serviceWorker.ready;

    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!fcmToken) return false;

    const tokenId = hashTokenDocId(params.uid, fcmToken);
    const meta = detectTokenClientMeta();
    const tokenDocRef = doc(db, 'device_tokens', tokenId);

    const existingSnap = await getDocs(
      query(collection(db, 'device_tokens'), where('ownerUid', '==', params.uid))
    );
    const existingSelf = existingSnap.docs.find((d) => d.id === tokenId);

    if (existingSelf) {
      await updateDoc(tokenDocRef, {
        role: params.role,
        isDemo: false,
        token: fcmToken,
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
        isDemo: false,
        token: fcmToken,
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
    return true;
  } catch (err) {
    console.warn('Silent push token sync skipped:', err);
    return false;
  }
}

export async function disablePushNotificationsForUser(uid: string): Promise<void> {
  try {
    const prefSnap = await getDocs(
      query(collection(db, 'notification_preferences'), where('ownerUid', '==', uid))
    );
    if (!prefSnap.empty) {
      await updateDoc(doc(db, 'notification_preferences', uid), {
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

export async function subscribeForegroundPush(
  onReceive: (payload: {
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
  }) => void
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
