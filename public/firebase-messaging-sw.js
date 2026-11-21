/* ROJGAR SETU Firebase Cloud Messaging Background Service Worker */
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBsz6oLTCJstiNNXU5YR-J-AIQP4cuYmOA',
  authDomain: 'gen-lang-client-0174765083.firebaseapp.com',
  projectId: 'gen-lang-client-0174765083',
  storageBucket: 'gen-lang-client-0174765083.firebasestorage.app',
  messagingSenderId: '6490744736',
  appId: '1:6490744736:web:d6499d4415dcdf887526c5',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload && payload.data ? payload.data : {};
  const notif = payload && payload.notification ? payload.notification : {};
  const title = notif.title || data.title || 'ROJGAR SETU';
  const body = notif.body || data.body || 'New update on ROJGAR SETU.';
  const tag = data.dedupeKey || data.jobId || data.demoJobId || 'rojgar-setu-alert';
  const clickUrl = data.clickUrl || '/';
  const isSilent = data.playSound === 'false';
  const openActionTitle =
    data.lang === 'mr' ? 'उघडा व ऐका' : data.lang === 'hi' ? 'खोलें व सुनें' : 'Open & Listen';

  return self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    renotify: true,
    requireInteraction: true,
    silent: isSilent,
    ...(isSilent ? {} : { vibrate: [220, 100, 220] }),
    actions: [{ action: 'open_listen', title: openActionTitle }],
    data: {
      clickUrl,
      route: data.route || '',
      jobId: data.jobId || '',
      demoJobId: data.demoJobId || '',
      voiceScript: data.voiceScript || '',
      lang: data.lang || 'en',
      approxLocationLabel: data.approxLocationLabel || '',
      distanceKm: data.distanceKm || '',
      playSound: data.playSound !== 'false',
      speakVoice: data.speakVoice !== 'false',
      speak: data.speak === '0' ? '0' : '1',
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification && event.notification.data ? event.notification.data : {};
  const rawUrl = data.clickUrl || '/';
  const targetUrlObj = new URL(rawUrl, self.location.origin);
  if (data.speak && !targetUrlObj.searchParams.has('speak')) {
    targetUrlObj.searchParams.set('speak', data.speak);
  }
  if (data.lang && !targetUrlObj.searchParams.has('lang')) {
    targetUrlObj.searchParams.set('lang', data.lang);
  }
  const targetUrl = targetUrlObj.href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'ROJGAR_SETU_DEEP_LINK',
            clickUrl: targetUrl,
            route: data.route || '',
            jobId: data.jobId || '',
            demoJobId: data.demoJobId || '',
            voiceScript: data.voiceScript || '',
            lang: data.lang || '',
            approxLocationLabel: data.approxLocationLabel || '',
            distanceKm: data.distanceKm || '',
            playSound: data.playSound !== false,
            speakVoice: data.speakVoice !== false,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
