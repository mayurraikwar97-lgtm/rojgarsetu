/* ROJGAR SETU Firebase Cloud Messaging Background Service Worker */
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: 'AIzaSyBsz6oLTCJstiNNXU5YR-J-AIQP4cuYmOA',
  authDomain: 'gen-lang-client-0174765083.firebaseapp.com',
  projectId: 'gen-lang-client-0174765083',
  storageBucket: 'gen-lang-client-0174765083.firebasestorage.app',
  messagingSenderId: '6490744736',
  appId: '1:6490744736:web:d6499d4415dcdf887526c5',
});

const messaging = firebase.messaging();

function getSwToneVibration(toneType) {
  switch (toneType) {
    case 'new_job':
      return [260, 90, 260, 90, 360];
    case 'new_offer':
      return [180, 80, 180];
    case 'deal_accepted':
      return [140, 70, 140, 70, 320];
    case 'deal_completed':
      return [200, 100, 240];
    case 'deal_cancelled':
      return [300, 120, 200];
    default:
      return [200, 100, 200];
  }
}

function getSwTagPrefix(toneType) {
  switch (toneType) {
    case 'new_job':
      return 'rojgar-job';
    case 'new_offer':
      return 'rojgar-offer';
    case 'deal_accepted':
      return 'rojgar-confirmed';
    case 'deal_completed':
    case 'deal_cancelled':
      return 'rojgar-closed';
    default:
      return 'rojgar-alert';
  }
}

messaging.onBackgroundMessage((payload) => {
  // CRITICAL: When FCM sends top-level `notification` / `webpush.notification`,
  // Chrome/Android/Safari automatically displays the OS notification with sound & vibration
  // (even when the screen is off or browser is closed). Calling showNotification again
  // here would create duplicate alerts. Only render manually for data-only background messages.
  if (payload && payload.notification) {
    return;
  }

  const data = payload && payload.data ? payload.data : {};
  const title = data.title || 'ROJGAR SETU';
  const body = data.body || 'New update on ROJGAR SETU.';
  const toneType = data.toneType || 'general';
  const dedupeKey = data.dedupeKey || data.notificationId || '';
  const baseTag = dedupeKey || data.jobId || data.demoJobId || 'alert';
  const tag = `${getSwTagPrefix(toneType)}-${baseTag}`.slice(0, 96);
  const normalizedRoute =
    data.route === 'find-work' || (!data.route && data.jobId)
      ? 'worker-dashboard'
      : data.route || 'worker-dashboard';
  const clickUrl =
    data.clickUrl && !String(data.clickUrl).includes('route=find-work')
      ? data.clickUrl
      : data.jobId
      ? `/?route=${encodeURIComponent(normalizedRoute)}&jobId=${encodeURIComponent(data.jobId)}`
      : `/?route=${encodeURIComponent(normalizedRoute)}`;
  const isSilent = data.playSound === 'false';
  const openActionTitle = data.lang === 'mr' ? 'उघडा' : data.lang === 'hi' ? 'खोलें' : 'OPEN';

  return self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    renotify: true,
    requireInteraction: true,
    silent: isSilent,
    ...(isSilent ? {} : { vibrate: getSwToneVibration(toneType) }),
    actions: [{ action: 'open', title: openActionTitle }],
    data: {
      clickUrl,
      route: normalizedRoute,
      jobId: data.jobId || '',
      demoJobId: data.demoJobId || '',
      notificationId: data.notificationId || '',
      dedupeKey,
      title,
      body,
      voiceScript: data.voiceScript || '',
      lang: data.lang || 'en',
      approxLocationLabel: data.approxLocationLabel || '',
      distanceKm: data.distanceKm || '',
      toneType,
      eventType: data.eventType || '',
      playSound: data.playSound !== 'false',
      speakVoice: data.speakVoice !== 'false',
      speak: data.speak === '0' ? '0' : '1',
    },
  });
});

function extractNotificationData(notification) {
  const raw = notification && notification.data ? notification.data : {};
  const fcmMsgData =
    raw && raw.FCM_MSG && raw.FCM_MSG.data && typeof raw.FCM_MSG.data === 'object'
      ? raw.FCM_MSG.data
      : {};
  const fcmNotif =
    raw && raw.FCM_MSG && raw.FCM_MSG.notification && typeof raw.FCM_MSG.notification === 'object'
      ? raw.FCM_MSG.notification
      : {};
  return Object.assign(
    {
      title: notification && notification.title ? notification.title : fcmNotif.title || '',
      body: notification && notification.body ? notification.body : fcmNotif.body || '',
    },
    fcmMsgData,
    raw
  );
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') {
    return;
  }

  const data = extractNotificationData(event.notification);
  const rawRoute = data.route === 'find-work' ? 'worker-dashboard' : data.route || '';
  const fallbackRoute = rawRoute || 'worker-dashboard';
  const fallbackUrl = data.jobId
    ? `/?route=${encodeURIComponent(fallbackRoute)}&jobId=${encodeURIComponent(data.jobId)}`
    : `/?route=${encodeURIComponent(fallbackRoute)}`;
  const rawUrl =
    data.clickUrl ||
    (event.notification &&
      event.notification.data &&
      event.notification.data.FCM_MSG &&
      event.notification.data.FCM_MSG.fcmOptions &&
      event.notification.data.FCM_MSG.fcmOptions.link) ||
    fallbackUrl;

  const targetUrlObj = new URL(rawUrl, self.location.origin);
  if (targetUrlObj.searchParams.get('route') === 'find-work') {
    targetUrlObj.searchParams.set('route', 'worker-dashboard');
  } else if (rawRoute && !targetUrlObj.searchParams.has('route')) {
    targetUrlObj.searchParams.set('route', String(rawRoute));
  }
  if (data.jobId && !targetUrlObj.searchParams.has('jobId')) {
    targetUrlObj.searchParams.set('jobId', String(data.jobId));
  }
  if (data.demoJobId && !targetUrlObj.searchParams.has('demoJobId')) {
    targetUrlObj.searchParams.set('demoJobId', String(data.demoJobId));
  }
  if (data.speak && !targetUrlObj.searchParams.has('speak')) {
    targetUrlObj.searchParams.set('speak', String(data.speak));
  }
  if (data.lang && !targetUrlObj.searchParams.has('lang')) {
    targetUrlObj.searchParams.set('lang', String(data.lang));
  }
  const notifKey = data.dedupeKey || data.notificationId || '';
  if (notifKey && !targetUrlObj.searchParams.has('notifKey')) {
    targetUrlObj.searchParams.set('notifKey', String(notifKey));
  }
  if (data.notificationId && !targetUrlObj.searchParams.has('notifId')) {
    targetUrlObj.searchParams.set('notifId', String(data.notificationId));
  }
  targetUrlObj.searchParams.set('fromPush', '1');
  const targetUrl = targetUrlObj.href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const sameOriginClients = clientList.filter((c) => c.url && c.url.startsWith(self.location.origin));
      const preferredClient =
        sameOriginClients.find((c) => c.visibilityState === 'visible') || sameOriginClients[0];

      if (preferredClient && 'focus' in preferredClient) {
        preferredClient.postMessage({
          type: 'ROJGAR_SETU_DEEP_LINK',
          fromPush: true,
          clickUrl: targetUrl,
          route: rawRoute || targetUrlObj.searchParams.get('route') || '',
          jobId: data.jobId || '',
          demoJobId: data.demoJobId || '',
          notificationId: data.notificationId || '',
          dedupeKey: data.dedupeKey || '',
          title: data.title || '',
          body: data.body || '',
          voiceScript: data.voiceScript || '',
          lang: data.lang || '',
          approxLocationLabel: data.approxLocationLabel || '',
          distanceKm: data.distanceKm || '',
          toneType: data.toneType || 'general',
          eventType: data.eventType || '',
          playSound: data.playSound !== false && data.playSound !== 'false',
          speakVoice: data.speakVoice !== false && data.speakVoice !== 'false',
          speak: data.speak === '1' || data.speak === true,
        });
        return preferredClient.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
