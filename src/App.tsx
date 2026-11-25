import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { isAuthenticatedUser } from './lib/firebase';
import {
  subscribeForegroundPush,
  syncPushTokenSilentlyIfGranted,
} from './lib/pushNotifications';
import {
  buildNotificationDedupeKeys,
  isNotificationAlreadyHandled,
  markBackgroundNotificationClicked,
  markNotificationShown,
} from './lib/notificationDedupe';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeAllApplicationsAdmin,
  subscribeAnnouncements,
  subscribeEmployerApplications,
  subscribeJobs,
  subscribeNotificationPreferences,
  subscribePublicEmployers,
  subscribePublicWorkers,
  subscribeUserNotifications,
  subscribeVehicleListings,
} from './lib/firestoreService';
import { buildSmartJobVoiceScript } from './lib/smartVoiceJobAlert';
import { getToneTypeForEvent } from './lib/dealWorkflow';
import {
  buildSpokenNotificationText,
  playNotificationTone,
  speakJobAlert,
  stopVoiceAlert,
  unlockAudioOnUserGesture,
} from './lib/voiceAlertEngine';
import { subscribeShopkeeperListings } from './lib/shopkeeperService';
import type {
  AiHirePrefill,
  AppNotificationRecord,
  JobApplication,
  JobPosting,
  Language,
  NotificationPreferences,
  NotificationToneType,
  PageRoute,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
  ShopkeeperListing,
  VehicleListing,
  VehicleType,
} from './types/domain';
import { Header } from './components/Header';
import { GovtSchemesView } from './components/GovtSchemesView';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/PWAControls';
import { CustomerHomeV2 } from './components/CustomerHomeV2';
import { WorkerAppV2 } from './components/WorkerAppV2';
import { CustomerOrdersV2 } from './components/CustomerOrdersV2';
import { WorkerRegistrationForm } from './components/WorkerRegistrationForm';
import { EmployerRegistrationForm } from './components/EmployerRegistrationForm';
import { VehicleRegistrationForm } from './components/VehicleRegistrationForm';
import { ShopkeeperRegistrationForm } from './components/ShopkeeperRegistrationForm';
import { LocalShopsView } from './components/LocalShopsView';
import { AIVoiceAssistantModal } from './components/AIVoiceAssistantModal';
import { LocalTransportView } from './components/LocalTransportView';
import { FindWorkersView, PostJobView } from './components/JobBoardViews';
import { AdminDashboardView } from './components/DashboardsView';
import {
  AboutUsView,
  ContactView,
  PartnershipsView,
  PricingPolicyView,
  SkillsTrainingView,
  TrustSafetyView,
} from './components/InstitutionalPages';
import { AdvertiserDashboardView } from './components/AdvertiserDashboardView';
import {
  TopNotificationBanner,
  type TopAlertNotificationItem,
} from './components/TopNotificationBanner';
import { captureReferralCodeFromUrl } from './lib/adsReferralService';

const VALID_ROUTES: PageRoute[] = [
  'home',
  'hire',
  'transport',
  'local-shops',
  'find-work',
  'find-workers',
  'skills-training',
  'govt-schemes',
  'for-unemployed',
  'for-entrepreneurs',
  'register-worker',
  'register-employer',
  'register-vehicle',
  'register-shopkeeper',
  'post-job',
  'worker-dashboard',
  'employer-dashboard',
  'admin',
  'demo-testing',
  'about',
  'partnerships',
  'pricing',
  'trust-safety',
  'contact',
  'advertise',
];

function isValidRoute(value: string | undefined | null): value is PageRoute {
  return Boolean(value && VALID_ROUTES.includes(value as PageRoute));
}

function isToneEnabledForUser(
  toneType: NotificationToneType,
  prefs: NotificationPreferences | null
): boolean {
  if (!prefs) return true;
  if (prefs.masterEnabled === false || prefs.soundEnabled === false) return false;
  switch (toneType) {
    case 'new_job':
      return prefs.toneNewJobEnabled !== false;
    case 'new_offer':
      return prefs.toneNewOfferEnabled !== false;
    case 'deal_accepted':
      return prefs.toneDealConfirmedEnabled !== false;
    case 'deal_completed':
    case 'deal_cancelled':
      return prefs.toneDealClosedEnabled !== false;
    default:
      return true;
  }
}

const AppShell: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [route, setRoute] = useState<PageRoute>('home');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [highlightedJobId, setHighlightedJobId] = useState('');
  const [, setHighlightedDemoJobId] = useState('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [capturedRefCode, setCapturedRefCode] = useState<string>(() => captureReferralCodeFromUrl());

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [bootSpeakRequest, setBootSpeakRequest] = useState<{
    jobId: string;
    lang?: Language;
    voiceScript?: string;
    fromPush?: boolean;
  } | null>(null);
  const [pendingPushReadIds, setPendingPushReadIds] = useState<string[]>([]);

  const [alertQueue, setAlertQueue] = useState<TopAlertNotificationItem[]>([]);
  const activeTopAlert = alertQueue[0] || null;
  const queuedAlertsCount = Math.max(0, alertQueue.length - 1);

  const [workers, setWorkers] = useState<PublicWorkerProfile[]>([]);
  const [employers, setEmployers] = useState<PublicEmployerProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
  const [shops, setShops] = useState<ShopkeeperListing[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [, setAdminAppsCount] = useState(0);
  const [customerApplications, setCustomerApplications] = useState<JobApplication[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const initialNotifLoadRef = useRef(true);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLocationHint, setAiLocationHint] = useState('');
  const [aiPrefill, setAiPrefill] = useState<AiHirePrefill | null>(null);

  const navigate = useCallback(
    (nextRoute: PageRoute, nextCategory?: string, options?: { skipScrollTop?: boolean }) => {
      setRoute(nextRoute);
      setCategoryFilter(nextCategory ?? '');
      if (!options?.skipScrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const resolveNotificationTargetRoute = useCallback(
    (params: {
      rawRoute?: string | null;
      jobId?: string;
      demoJobId?: string;
      recipientRole?: string;
      eventType?: string;
      category?: string;
    }): PageRoute => {
      const { rawRoute, jobId, demoJobId, recipientRole, eventType, category } = params;
      if (demoJobId) return 'worker-dashboard';

      const isCustomerEvent =
        recipientRole === 'employer' ||
        eventType === 'offer_received' ||
        eventType === 'worker_offer_sent' ||
        eventType === 'new_application' ||
        eventType === 'worker_message' ||
        eventType === 'worker_on_the_way' ||
        eventType === 'work_started' ||
        eventType === 'worker_arrived';

      const isWorkerJobAlert =
        recipientRole === 'worker' ||
        rawRoute === 'find-work' ||
        eventType === 'hiring_request_created' ||
        eventType === 'offer_accepted' ||
        eventType === 'customer_message' ||
        eventType === 'location_shared' ||
        category === 'matchingJobs' ||
        category === 'nearbyJobs';

      if (rawRoute === 'worker-dashboard' || rawRoute === 'employer-dashboard') {
        return rawRoute;
      }
      if (jobId && isCustomerEvent) return 'employer-dashboard';
      if (jobId && isWorkerJobAlert) return 'worker-dashboard';
      if (rawRoute === 'find-work' && jobId) return 'worker-dashboard';
      if (isValidRoute(rawRoute)) return rawRoute;
      if (isCustomerEvent) return 'employer-dashboard';
      if (jobId || isWorkerJobAlert) return 'worker-dashboard';
      return 'home';
    },
    []
  );

  const navigateToTarget = useCallback(
    (targetRoute: PageRoute, jobId?: string, demoJobId?: string) => {
      if (jobId) setHighlightedJobId(jobId);
      if (demoJobId) setHighlightedDemoJobId(demoJobId);
      const normalizedRoute =
        targetRoute === 'find-work' && jobId ? 'worker-dashboard' : targetRoute;
      navigate(normalizedRoute, undefined, {
        skipScrollTop: Boolean(jobId || demoJobId),
      });
    },
    [navigate]
  );

  const enqueueTopAlert = useCallback(
    (item: Omit<TopAlertNotificationItem, 'id' | 'receivedAtMs'>): boolean => {
      const keys = buildNotificationDedupeKeys({
        notificationId: item.notificationId,
        dedupeKey: item.dedupeKey,
        jobId: item.jobId,
        demoJobId: item.demoJobId,
        eventType: item.eventType,
        title: item.title,
        body: item.body,
      });
      if (keys.length > 0 && isNotificationAlreadyHandled(keys)) {
        return false;
      }
      if (keys.length > 0) {
        markNotificationShown(keys);
      }
      const nextItem: TopAlertNotificationItem = {
        ...item,
        id: item.notificationId || item.dedupeKey || `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        receivedAtMs: Date.now(),
      };
      setAlertQueue((prev) => {
        if (prev.some((existing) => existing.id === nextItem.id)) {
          return prev;
        }
        return [...prev, nextItem].slice(-6);
      });
      return true;
    },
    []
  );

  const dismissCurrentTopAlert = useCallback(() => {
    stopVoiceAlert();
    setAlertQueue((prev) => prev.slice(1));
  }, []);

  const triggerSmartVoicePlayback = useCallback(
    async (opts: {
      voiceScript?: string;
      title?: string;
      body?: string;
      lang?: Language;
      playSound?: boolean;
      speakVoice?: boolean;
      toneType?: NotificationToneType;
      eventType?: string;
    }) => {
      if (voiceMuted) return;
      if (notifPrefs && notifPrefs.masterEnabled === false) return;

      const resolvedTone = getToneTypeForEvent({
        toneType: opts.toneType,
        eventType: opts.eventType,
      });
      const resolvedLang = opts.lang || notifPrefs?.preferredLanguage || lang;
      const allowSound =
        opts.playSound !== false && isToneEnabledForUser(resolvedTone, notifPrefs);
      const allowVoice =
        opts.speakVoice !== false && (!notifPrefs || notifPrefs.voiceAlertsEnabled !== false);
      const spokenText = buildSpokenNotificationText({
        voiceScript: opts.voiceScript,
        title: opts.title,
        body: opts.body,
        lang: resolvedLang,
      });

      if (allowVoice && spokenText) {
        const res = await speakJobAlert({
          text: spokenText,
          lang: resolvedLang,
          soundEnabled: allowSound,
          voiceEnabled: true,
          toneType: resolvedTone,
        });
        if (res.speechStatus === 'blocked_or_silent') {
          setAlertQueue((prev) =>
            prev.length > 0 ? [{ ...prev[0], speechBlockedHint: true }, ...prev.slice(1)] : prev
          );
        }
      } else if (allowSound) {
        await playNotificationTone(resolvedTone);
      }
    },
    [voiceMuted, notifPrefs, lang]
  );

  // Unlock Web Audio & warm up Web Speech voices on user interaction
  useEffect(() => {
    const onGesture = () => {
      unlockAudioOnUserGesture();
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  // Subscribe to notification & voice preferences
  useEffect(() => {
    if (!isAuthenticatedUser(user)) {
      setNotifPrefs(null);
      return;
    }
    return subscribeNotificationPreferences(user!.uid, setNotifPrefs);
  }, [user]);

  // Silently refresh FCM device token on login, preference change, and when returning to foreground
  useEffect(() => {
    if (!isAuthenticatedUser(user)) return;
    if (notifPrefs && notifPrefs.masterEnabled === false) return;
    const isRegisteredWorker = workers.some((w) => w.ownerUid === user!.uid);
    const resolvedRole: 'worker' | 'employer' | 'admin' = isAdmin
      ? 'admin'
      : isRegisteredWorker
      ? 'worker'
      : 'employer';
    const targetLang = notifPrefs?.preferredLanguage || lang;

    void syncPushTokenSilentlyIfGranted({
      uid: user!.uid,
      role: resolvedRole,
      language: targetLang,
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncPushTokenSilentlyIfGranted({
          uid: user!.uid,
          role: resolvedRole,
          language: targetLang,
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [user, isAdmin, workers.length, notifPrefs?.masterEnabled, notifPrefs?.preferredLanguage, lang]);

  // Parse deep links from URL query parameters on boot (?route=worker-dashboard&jobId=...&speak=1&lang=mr&fromPush=1&notifKey=... or /register?ref=CODE)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('route');
    const jId = params.get('jobId') || '';
    const djId = params.get('demoJobId') || '';
    const cat = params.get('category') || '';
    const refParam = (params.get('ref') || params.get('referral') || '').trim().toUpperCase();
    const isRegisterPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') === '/register';
    const speak = params.get('speak') === '1';
    const fromPush = params.get('fromPush') === '1';
    const notifKey = params.get('notifKey') || '';
    const notifId = params.get('notifId') || '';
    const qLang = params.get('lang');
    const parsedLang: Language | undefined =
      qLang === 'mr' || qLang === 'hi' || qLang === 'en' ? qLang : undefined;

    if (fromPush || notifKey || notifId) {
      const clickKeys = buildNotificationDedupeKeys({
        notificationId: notifId || undefined,
        dedupeKey: notifKey || undefined,
        jobId: jId || undefined,
        demoJobId: djId || undefined,
      });
      if (clickKeys.length > 0) {
        markBackgroundNotificationClicked(clickKeys);
      }
      const idsToRead = [notifId, notifKey].filter(Boolean);
      if (idsToRead.length > 0) {
        setPendingPushReadIds((prev) => Array.from(new Set([...prev, ...idsToRead])));
      }
    }

    if (refParam && /^[A-Z0-9_-]{4,32}$/.test(refParam)) {
      const saved = captureReferralCodeFromUrl();
      setCapturedRefCode(saved || refParam);
    }

    if (jId) setHighlightedJobId(jId);
    if (djId) setHighlightedDemoJobId(djId);
    if (speak && jId) {
      setBootSpeakRequest({ jobId: jId, lang: parsedLang, fromPush });
    }
    if (r || jId || djId) {
      const resolvedBootRoute = resolveNotificationTargetRoute({
        rawRoute: r,
        jobId: jId || undefined,
        demoJobId: djId || undefined,
      });
      setRoute(resolvedBootRoute);
      if (cat) setCategoryFilter(cat);
    } else if (refParam || isRegisterPath) {
      setRoute('register-worker');
    }

    if (r || jId || djId || cat || speak || qLang || refParam || isRegisterPath || fromPush || notifKey || notifId) {
      const cleanPath = isRegisterPath ? '/' : window.location.pathname;
      const cleanUrl = cleanPath + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [resolveNotificationTargetRoute]);

  // Auto-mark Firestore notifications read when opened from a background OS push click
  useEffect(() => {
    if (!isAuthenticatedUser(user) || pendingPushReadIds.length === 0 || notifications.length === 0) return;
    const matched = notifications.filter(
      (n) =>
        !n.read &&
        (pendingPushReadIds.includes(n.id) ||
          (n.dedupeKey ? pendingPushReadIds.includes(n.dedupeKey) : false))
    );
    if (matched.length > 0) {
      matched.forEach((n) => {
        seenNotifIdsRef.current.add(n.id);
        void markNotificationRead(n.id).catch(() => undefined);
      });
      setPendingPushReadIds((prev) =>
        prev.filter((id) => !matched.some((n) => n.id === id || n.dedupeKey === id))
      );
    }
  }, [user, pendingPushReadIds, notifications]);

  // Auto-play TTS once matching job loads when opened via OS notification "Open & Listen"
  useEffect(() => {
    if (!bootSpeakRequest) return;
    const job = jobs.find((j) => j.id === bootSpeakRequest.jobId);
    if (!job && !bootSpeakRequest.voiceScript) return;

    const spokenLang = bootSpeakRequest.lang || notifPrefs?.preferredLanguage || lang;
    const script =
      bootSpeakRequest.voiceScript ||
      buildSmartJobVoiceScript({
        lang: spokenLang,
        customerName: job?.employerName || 'Customer',
        category: job?.category || 'Service',
        jobTitle: job?.title,
        jobDescription: job?.title || job?.description || 'New work request',
        approxLocationLabel: job?.approxLocationLabel || job?.cityOrVillage || job?.district || 'Nearby area',
        distanceKm: null,
      });

    const isFromBackgroundPush = Boolean(bootSpeakRequest.fromPush);
    setBootSpeakRequest(null);

    // Do not show a duplicate top banner if the user literally just tapped the OS push notification
    if (!isFromBackgroundPush) {
      enqueueTopAlert({
        title: job?.title || 'Smart Voice Job Alert',
        body: job?.approxLocationLabel || job?.district || 'Tap Listen to hear full details.',
        route: 'worker-dashboard',
        jobId: job?.id || bootSpeakRequest.jobId,
        voiceScript: script,
        lang: spokenLang,
        playSound: true,
        speakVoice: true,
        toneType: 'new_job',
      });
    }
    void triggerSmartVoicePlayback({
      voiceScript: script,
      lang: spokenLang,
      playSound: !isFromBackgroundPush,
      speakVoice: true,
      toneType: 'new_job',
    });
  }, [bootSpeakRequest, jobs, notifPrefs?.preferredLanguage, lang, triggerSmartVoicePlayback, enqueueTopAlert]);

  // Handle Service Worker notification click deep-link messages when app is already open
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        fromPush?: boolean;
        route?: string;
        jobId?: string;
        demoJobId?: string;
        notificationId?: string;
        dedupeKey?: string;
        title?: string;
        body?: string;
        voiceScript?: string;
        lang?: Language;
        speak?: boolean;
        eventType?: string;
      } | null;
      if (data?.type === 'ROJGAR_SETU_DEEP_LINK') {
        const clickKeys = buildNotificationDedupeKeys({
          notificationId: data.notificationId,
          dedupeKey: data.dedupeKey,
          jobId: data.jobId,
          demoJobId: data.demoJobId,
          eventType: data.eventType,
          title: data.title,
          body: data.body,
        });
        if (clickKeys.length > 0) {
          markBackgroundNotificationClicked(clickKeys);
        }
        const idsToRead = [data.notificationId, data.dedupeKey].filter((v): v is string => Boolean(v));
        if (idsToRead.length > 0) {
          setPendingPushReadIds((prev) => Array.from(new Set([...prev, ...idsToRead])));
        }
        // Dismiss any matching currently displayed banner so the user does not see a duplicate
        setAlertQueue((prev) =>
          prev.filter(
            (a) =>
              a.notificationId !== data.notificationId &&
              (!data.dedupeKey || a.dedupeKey !== data.dedupeKey)
          )
        );

        const nextRoute = resolveNotificationTargetRoute({
          rawRoute: data.route,
          jobId: data.jobId,
          demoJobId: data.demoJobId,
          eventType: data.eventType,
        });
        navigateToTarget(nextRoute, data.jobId, data.demoJobId);
        if (data.speak && (data.voiceScript || data.jobId)) {
          setBootSpeakRequest({
            jobId: data.jobId || '',
            lang: data.lang,
            voiceScript: data.voiceScript,
            fromPush: true,
          });
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigateToTarget, resolveNotificationTargetRoute]);

  // Listen to foreground FCM messages while user has app open
  useEffect(() => {
    if (!isAuthenticatedUser(user)) return;
    let unsub: () => void = () => undefined;
    let active = true;
    void subscribeForegroundPush((payload) => {
      if (!active) return;
      const targetRoute = resolveNotificationTargetRoute({
        rawRoute: payload.route,
        jobId: payload.jobId,
        demoJobId: payload.demoJobId,
        eventType: payload.eventType,
      });
      const spokenLang = payload.lang || notifPrefs?.preferredLanguage || lang;
      const resolvedTone = getToneTypeForEvent({
        toneType: payload.toneType,
        eventType: payload.eventType,
      });
      const shown = enqueueTopAlert({
        notificationId: payload.notificationId,
        dedupeKey: payload.dedupeKey,
        title: payload.title,
        body: payload.body,
        route: targetRoute,
        jobId: payload.jobId,
        demoJobId: payload.demoJobId,
        voiceScript: payload.voiceScript,
        lang: spokenLang,
        approxLocationLabel: payload.approxLocationLabel,
        distanceKm: payload.distanceKm,
        playSound: payload.playSound,
        speakVoice: payload.speakVoice,
        toneType: resolvedTone,
        eventType: payload.eventType,
      });
      if (shown) {
        void triggerSmartVoicePlayback({
          voiceScript: payload.voiceScript,
          title: payload.title,
          body: payload.body,
          lang: spokenLang,
          playSound: payload.playSound,
          speakVoice: payload.speakVoice,
          toneType: resolvedTone,
          eventType: payload.eventType,
        });
      }
    }).then((fn) => {
      if (active) unsub = fn;
      else fn();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user, notifPrefs?.preferredLanguage, lang, triggerSmartVoicePlayback, resolveNotificationTargetRoute, enqueueTopAlert]);

  useEffect(() => {
    const onQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    const u1 = subscribePublicWorkers(setWorkers);
    const u2 = subscribePublicEmployers(setEmployers);
    const u3 = subscribeJobs(setJobs);
    const u4 = subscribeAnnouncements(setAnnouncements);
    const u5 = subscribeVehicleListings(setVehicles);
    const u6 = subscribeShopkeeperListings(setShops);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdminAppsCount(0);
      return;
    }
    const u = subscribeAllApplicationsAdmin((apps) => setAdminAppsCount(apps.length));
    return () => u();
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.uid) {
      setCustomerApplications([]);
      return;
    }
    const u = subscribeEmployerApplications(user.uid, setCustomerApplications);
    return () => u();
  }, [user?.uid]);

  // Global real-time in-app notification subscription + WhatsApp-style top banner & voice alert
  useEffect(() => {
    seenNotifIdsRef.current = new Set();
    initialNotifLoadRef.current = true;
    if (!isAuthenticatedUser(user)) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeUserNotifications(user!.uid, (list) => {
      setNotifications(list);
      if (initialNotifLoadRef.current) {
        list.forEach((n) => seenNotifIdsRef.current.add(n.id));
        initialNotifLoadRef.current = false;
        return;
      }
      const freshUnreads = list.filter((n) => !n.read && !seenNotifIdsRef.current.has(n.id));
      list.forEach((n) => seenNotifIdsRef.current.add(n.id));
      if (freshUnreads.length === 0) return;

      // Queue distinct unread alerts (up to 3 newest at once) with dedupe against FCM onMessage
      let playedAudioForBatch = false;
      for (const newestUnread of freshUnreads.slice(0, 3)) {
        const spokenLang = newestUnread.language || notifPrefs?.preferredLanguage || lang;
        const resolvedTone = getToneTypeForEvent(newestUnread);
        const shown = enqueueTopAlert({
          notificationId: newestUnread.id,
          dedupeKey: newestUnread.dedupeKey,
          title: newestUnread.title,
          body: newestUnread.body,
          route: resolveNotificationTargetRoute({
            rawRoute: newestUnread.targetRoute,
            jobId: newestUnread.targetJobId,
            demoJobId: newestUnread.targetDemoJobId,
            recipientRole: newestUnread.recipientRole,
            eventType: newestUnread.eventType,
            category: newestUnread.category,
          }),
          jobId: newestUnread.targetJobId,
          demoJobId: newestUnread.targetDemoJobId,
          voiceScript: newestUnread.voiceScript,
          lang: spokenLang,
          approxLocationLabel: newestUnread.approxLocationLabel,
          distanceKm: newestUnread.distanceKm,
          playSound: newestUnread.playSound,
          speakVoice: newestUnread.speakVoice,
          toneType: resolvedTone,
          eventType: newestUnread.eventType,
          category: newestUnread.category,
        });

        if (shown && !playedAudioForBatch) {
          playedAudioForBatch = true;
          void triggerSmartVoicePlayback({
            voiceScript: newestUnread.voiceScript,
            title: newestUnread.title,
            body: newestUnread.body,
            lang: spokenLang,
            playSound: newestUnread.playSound,
            speakVoice: newestUnread.speakVoice,
            toneType: resolvedTone,
            eventType: newestUnread.eventType,
          });
        }
      }
    });
    return () => unsub();
  }, [user, notifPrefs, lang, voiceMuted, triggerSmartVoicePlayback, resolveNotificationTargetRoute, enqueueTopAlert]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleOpenNotificationItem = useCallback(
    (item: AppNotificationRecord) => {
      if (!item.read) {
        void markNotificationRead(item.id).catch(() => undefined);
      }
      const nextRoute = resolveNotificationTargetRoute({
        rawRoute: item.targetRoute,
        jobId: item.targetJobId,
        demoJobId: item.targetDemoJobId,
        recipientRole: item.recipientRole,
        eventType: item.eventType,
        category: item.category,
      });
      navigateToTarget(nextRoute, item.targetJobId, item.targetDemoJobId);
    },
    [navigateToTarget, resolveNotificationTargetRoute]
  );

  const handleOpenTopAlert = useCallback(
    (target: TopAlertNotificationItem) => {
      stopVoiceAlert();
      setAlertQueue((prev) => prev.filter((item) => item.id !== target.id));

      const matchingDoc = notifications.find(
        (n) =>
          !n.read &&
          ((target.notificationId && n.id === target.notificationId) ||
            (target.dedupeKey && n.dedupeKey === target.dedupeKey))
      );
      if (matchingDoc) {
        void markNotificationRead(matchingDoc.id).catch(() => undefined);
      } else if (target.notificationId) {
        void markNotificationRead(target.notificationId).catch(() => undefined);
      }

      navigateToTarget(
        target.route || 'worker-dashboard',
        target.jobId,
        target.demoJobId
      );
    },
    [navigateToTarget, notifications]
  );

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      {/* WhatsApp-Style Top Slide-Down Alert Banner */}
      <TopNotificationBanner
        item={activeTopAlert}
        queuedCount={queuedAlertsCount}
        lang={lang}
        voiceMuted={voiceMuted}
        onOpen={handleOpenTopAlert}
        onDismiss={dismissCurrentTopAlert}
        onReplayTone={(activeTone) => {
          unlockAudioOnUserGesture();
          void playNotificationTone(activeTone);
        }}
        onReplayVoice={(item, activeTone) => {
          unlockAudioOnUserGesture();
          const replayLang = item.lang || notifPrefs?.preferredLanguage || lang;
          const spokenText = buildSpokenNotificationText({
            voiceScript: item.voiceScript,
            title: item.title,
            body: item.body,
            lang: replayLang,
          });
          setAlertQueue((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, speechBlockedHint: false } : a))
          );
          if (!spokenText) {
            void playNotificationTone(activeTone);
            return;
          }
          void speakJobAlert({
            text: spokenText,
            lang: replayLang,
            soundEnabled: false,
            voiceEnabled: true,
            toneType: activeTone,
          });
        }}
        onToggleMute={() => {
          setVoiceMuted((prev) => {
            const next = !prev;
            if (next) stopVoiceAlert();
            return next;
          });
        }}
      />
      {/* Case A Demo Key Quota Exceeded Banner */}
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 bg-amber-100 border-b border-amber-300 px-4 py-2.5 text-xs sm:text-sm text-amber-950"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                The Google Maps free preview quota has been exceeded or authorization failed. District coordinate fallback remains active, or you can configure your own API key.{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:text-amber-900"
                >
                  View Quota Resolution Guide
                </a>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              aria-label="Dismiss banner"
              className="p-1 rounded hover:bg-amber-200 text-amber-900 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Header
        currentRoute={route}
        onNavigate={(r) => navigate(r)}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onOpenNotification={handleOpenNotificationItem}
        onMarkAllRead={() => void markAllNotificationsRead(notifications)}
        onOpenAiAssistant={() => {
          setAiLocationHint('');
          setAiOpen(true);
        }}
      />

      <main id="main-content" className="flex-1">
        {(route === 'home' || route === 'hire' || route === 'demo-testing') && (
          <CustomerHomeV2
            workers={workers}
            jobs={jobs}
            shops={shops}
            customerApplications={customerApplications}
            quickHireOnly={route === 'hire'}
            onNavigate={(nextRoute, nextCat, targetJobId) => {
              if (targetJobId) setHighlightedJobId(targetJobId);
              navigate(nextRoute, nextCat);
            }}
          />
        )}
        {route === 'local-shops' && (
          <LocalShopsView
            shops={shops}
            initialPincodeOrArea={categoryFilter}
            onNavigate={(r, cat) => navigate(r, cat)}
          />
        )}
        {route === 'transport' && (
          <LocalTransportView
            vehicles={vehicles}
            workers={workers}
            initialFilter={categoryFilter as VehicleType | 'passenger' | 'goods' | ''}
            aiPrefill={aiPrefill}
            onClearAiPrefill={() => setAiPrefill(null)}
            onOpenAiAssistant={(locHint) => {
              setAiLocationHint(locHint || '');
              setAiOpen(true);
            }}
            onNavigate={navigate}
          />
        )}
        {(route === 'worker-dashboard' || route === 'find-work') && (
          <WorkerAppV2
            jobs={jobs}
            notifications={notifications}
            unreadNotificationsCount={unreadNotificationsCount}
            onNavigate={navigate}
            onNavigateToTarget={navigateToTarget}
            highlightedJobId={highlightedJobId}
            onClearHighlightedJob={() => setHighlightedJobId('')}
          />
        )}
        {route === 'employer-dashboard' && (
          <CustomerOrdersV2
            jobs={jobs}
            workers={workers}
            notifications={notifications}
            unreadNotificationsCount={unreadNotificationsCount}
            onNavigate={navigate}
            onNavigateToTarget={navigateToTarget}
            highlightedJobId={highlightedJobId}
            onClearHighlightedJob={() => setHighlightedJobId('')}
          />
        )}
        {route === 'find-workers' && (
          <FindWorkersView workers={workers} onNavigate={(r) => navigate(r)} />
        )}
        {route === 'skills-training' && (
          <SkillsTrainingView onNavigate={(r, cat) => navigate(r, cat)} />
        )}
        {route === 'govt-schemes' && (
          <GovtSchemesView initialAudience="all" onNavigate={(r, cat) => navigate(r, cat)} />
        )}
        {route === 'for-unemployed' && (
          <GovtSchemesView initialAudience="unemployed" onNavigate={(r, cat) => navigate(r, cat)} />
        )}
        {route === 'for-entrepreneurs' && (
          <GovtSchemesView initialAudience="entrepreneurs" onNavigate={(r, cat) => navigate(r, cat)} />
        )}
        {route === 'register-worker' && (
          <WorkerRegistrationForm
            initialReferralCode={capturedRefCode}
            onNavigate={(r) => navigate(r)}
          />
        )}
        {route === 'register-employer' && (
          <EmployerRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'register-vehicle' && (
          <VehicleRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'register-shopkeeper' && (
          <ShopkeeperRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'post-job' && <PostJobView workers={workers} onNavigate={(r) => navigate(r)} />}
        {route === 'advertise' && (
          <AdvertiserDashboardView onNavigate={(r) => navigate(r)} />
        )}
        {route === 'admin' && (
          <AdminDashboardView
            workers={workers}
            employers={employers}
            jobs={jobs}
            announcements={announcements}
            onNavigate={(r) => navigate(r)}
          />
        )}
        {route === 'about' && <AboutUsView />}
        {route === 'partnerships' && <PartnershipsView />}
        {route === 'pricing' && <PricingPolicyView />}
        {route === 'trust-safety' && <TrustSafetyView />}
        {route === 'contact' && <ContactView />}
      </main>

      <Footer onNavigate={(r) => navigate(r)} />
      <MobileBottomNav
        currentRoute={route}
        onNavigate={(r) => navigate(r)}
        activeCustomerOrdersCount={
          user
            ? jobs.filter(
                (j) =>
                  j.employerUid === user.uid &&
                  j.status !== 'completed' &&
                  j.status !== 'cancelled'
              ).length
            : 0
        }
        activeWorkerAlertsCount={unreadNotificationsCount}
      />
      <OfflineIndicator />

      <AIVoiceAssistantModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        workers={workers}
        vehicles={vehicles}
        userLocationHint={aiLocationHint}
        onApplyPrefill={(prefill) => {
          setAiPrefill(prefill);
          if (prefill.mode === 'transport') {
            navigate('transport', prefill.vehicleType || '');
          } else {
            navigate('hire', prefill.category || '');
          }
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  );
}
