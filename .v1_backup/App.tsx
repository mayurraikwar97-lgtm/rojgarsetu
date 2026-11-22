import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Volume2, VolumeX, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import {
  subscribeForegroundPush,
  syncPushTokenSilentlyIfGranted,
} from './lib/pushNotifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeAllApplicationsAdmin,
  subscribeAnnouncements,
  subscribeJobs,
  subscribeNotificationPreferences,
  subscribePublicEmployers,
  subscribePublicWorkers,
  subscribeUserNotifications,
  subscribeVehicleListings,
} from './lib/firestoreService';
import { buildSmartJobVoiceScript } from './lib/smartVoiceJobAlert';
import { getToneChannelConfig, getToneTypeForEvent } from './lib/dealWorkflow';
import {
  playNotificationTone,
  speakJobAlert,
  stopVoiceAlert,
  unlockAudioOnUserGesture,
} from './lib/voiceAlertEngine';
import type {
  AiHirePrefill,
  AppNotificationRecord,
  JobPosting,
  Language,
  NotificationPreferences,
  NotificationToneType,
  PageRoute,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
  VehicleListing,
  VehicleType,
} from './types/domain';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OfflineIndicator } from './components/PWAControls';
import { HomeView } from './components/HomeView';
import { WorkerRegistrationForm } from './components/WorkerRegistrationForm';
import { EmployerRegistrationForm } from './components/EmployerRegistrationForm';
import { VehicleRegistrationForm } from './components/VehicleRegistrationForm';
import { AIVoiceAssistantModal } from './components/AIVoiceAssistantModal';
import { InstantHireView } from './components/InstantHireView';
import { LocalTransportView } from './components/LocalTransportView';
import { FindWorkersView, FindWorkView, PostJobView } from './components/JobBoardViews';
import {
  AdminDashboardView,
  EmployerDashboardView,
  WorkerDashboardView,
} from './components/DashboardsView';
import {
  AboutUsView,
  ContactView,
  PartnershipsView,
  PricingPolicyView,
  SkillsTrainingView,
  TrustSafetyView,
} from './components/InstitutionalPages';

const VALID_ROUTES: PageRoute[] = [
  'home',
  'hire',
  'transport',
  'find-work',
  'find-workers',
  'skills-training',
  'register-worker',
  'register-employer',
  'register-vehicle',
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
  const [highlightedDemoJobId, setHighlightedDemoJobId] = useState('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [bootSpeakRequest, setBootSpeakRequest] = useState<{
    jobId: string;
    lang?: Language;
    voiceScript?: string;
  } | null>(null);

  const [foregroundPush, setForegroundPush] = useState<{
    title: string;
    body: string;
    route?: PageRoute;
    jobId?: string;
    demoJobId?: string;
    voiceScript?: string;
    lang?: Language;
    approxLocationLabel?: string;
    distanceKm?: number;
    playSound?: boolean;
    speakVoice?: boolean;
    toneType?: NotificationToneType;
    eventType?: string;
    speechBlockedHint?: boolean;
  } | null>(null);

  const [workers, setWorkers] = useState<PublicWorkerProfile[]>([]);
  const [employers, setEmployers] = useState<PublicEmployerProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [adminAppsCount, setAdminAppsCount] = useState(0);
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
        eventType === 'new_application' ||
        eventType === 'worker_message' ||
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

  const triggerSmartVoicePlayback = useCallback(
    async (opts: {
      voiceScript?: string;
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
      const allowSound =
        opts.playSound !== false && isToneEnabledForUser(resolvedTone, notifPrefs);
      const allowVoice =
        opts.speakVoice !== false && (!notifPrefs || notifPrefs.voiceAlertsEnabled !== false);

      if (allowVoice && opts.voiceScript) {
        const res = await speakJobAlert({
          text: opts.voiceScript,
          lang: opts.lang || notifPrefs?.preferredLanguage || lang,
          soundEnabled: allowSound,
          voiceEnabled: true,
          toneType: resolvedTone,
        });
        if (res.speechStatus === 'blocked_or_silent') {
          setForegroundPush((prev) => (prev ? { ...prev, speechBlockedHint: true } : prev));
        }
      } else if (allowSound) {
        await playNotificationTone(resolvedTone);
      }
    },
    [voiceMuted, notifPrefs, lang]
  );

  // Unlock Web Audio & Web Speech on first user gesture
  useEffect(() => {
    const onPointerDown = () => {
      unlockAudioOnUserGesture();
    };
    window.addEventListener('pointerdown', onPointerDown, { once: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Subscribe to notification & voice preferences
  useEffect(() => {
    if (!user?.emailVerified) {
      setNotifPrefs(null);
      return;
    }
    return subscribeNotificationPreferences(user.uid, setNotifPrefs);
  }, [user?.uid, user?.emailVerified]);

  // Silently refresh FCM device token whenever permission is already granted
  useEffect(() => {
    if (!user?.emailVerified) return;
    if (notifPrefs && notifPrefs.masterEnabled === false) return;
    const isRegisteredWorker = workers.some((w) => w.ownerUid === user.uid);
    const resolvedRole: 'worker' | 'employer' | 'admin' = isAdmin
      ? 'admin'
      : isRegisteredWorker
      ? 'worker'
      : 'employer';
    void syncPushTokenSilentlyIfGranted({
      uid: user.uid,
      role: resolvedRole,
      language: notifPrefs?.preferredLanguage || lang,
    });
  }, [user?.uid, user?.emailVerified, isAdmin, workers.length, notifPrefs?.masterEnabled, notifPrefs?.preferredLanguage, lang]);

  // Parse deep links from URL query parameters on boot (?route=worker-dashboard&jobId=...&speak=1&lang=mr)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('route');
    const jId = params.get('jobId') || '';
    const djId = params.get('demoJobId') || '';
    const cat = params.get('category') || '';
    const speak = params.get('speak') === '1';
    const qLang = params.get('lang');
    const parsedLang: Language | undefined =
      qLang === 'mr' || qLang === 'hi' || qLang === 'en' ? qLang : undefined;

    if (jId) setHighlightedJobId(jId);
    if (djId) setHighlightedDemoJobId(djId);
    if (speak && jId) {
      setBootSpeakRequest({ jobId: jId, lang: parsedLang });
    }
    if (r || jId || djId) {
      const resolvedBootRoute = resolveNotificationTargetRoute({
        rawRoute: r,
        jobId: jId || undefined,
        demoJobId: djId || undefined,
      });
      setRoute(resolvedBootRoute);
      if (cat) setCategoryFilter(cat);
    }

    if (r || jId || djId || cat || speak || qLang) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [resolveNotificationTargetRoute]);

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

    setBootSpeakRequest(null);
    setForegroundPush({
      title: job?.title || 'Smart Voice Job Alert',
      body: job?.approxLocationLabel || job?.district || 'Tap Replay Voice to hear full details.',
      route: 'worker-dashboard',
      jobId: job?.id || bootSpeakRequest.jobId,
      voiceScript: script,
      lang: spokenLang,
      playSound: true,
      speakVoice: true,
      toneType: 'new_job',
    });
    void triggerSmartVoicePlayback({
      voiceScript: script,
      lang: spokenLang,
      playSound: true,
      speakVoice: true,
      toneType: 'new_job',
    });
  }, [bootSpeakRequest, jobs, notifPrefs?.preferredLanguage, lang, triggerSmartVoicePlayback]);

  // Handle Service Worker notification click deep-link messages when app is already open
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        route?: string;
        jobId?: string;
        demoJobId?: string;
        voiceScript?: string;
        lang?: Language;
        speak?: boolean;
      } | null;
      if (data?.type === 'ROJGAR_SETU_DEEP_LINK') {
        const nextRoute = resolveNotificationTargetRoute({
          rawRoute: data.route,
          jobId: data.jobId,
          demoJobId: data.demoJobId,
          eventType: (data as { eventType?: string }).eventType,
        });
        navigateToTarget(nextRoute, data.jobId, data.demoJobId);
        if (data.speak && (data.voiceScript || data.jobId)) {
          setBootSpeakRequest({
            jobId: data.jobId || '',
            lang: data.lang,
            voiceScript: data.voiceScript,
          });
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigateToTarget, resolveNotificationTargetRoute]);

  // Listen to foreground FCM messages while user has app open
  useEffect(() => {
    if (!user?.emailVerified) return;
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
      setForegroundPush({
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
      void triggerSmartVoicePlayback({
        voiceScript: payload.voiceScript,
        lang: spokenLang,
        playSound: payload.playSound,
        speakVoice: payload.speakVoice,
        toneType: resolvedTone,
        eventType: payload.eventType,
      });
    }).then((fn) => {
      if (active) unsub = fn;
      else fn();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user?.uid, user?.emailVerified, notifPrefs?.preferredLanguage, lang, triggerSmartVoicePlayback, resolveNotificationTargetRoute]);

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
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
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

  // Global real-time in-app notification subscription + instant live toast & voice alert
  useEffect(() => {
    seenNotifIdsRef.current = new Set();
    initialNotifLoadRef.current = true;
    if (!user?.emailVerified) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeUserNotifications(user.uid, (list) => {
      setNotifications(list);
      if (initialNotifLoadRef.current) {
        list.forEach((n) => seenNotifIdsRef.current.add(n.id));
        initialNotifLoadRef.current = false;
        return;
      }
      const newestUnread = list.find((n) => !n.read && !seenNotifIdsRef.current.has(n.id));
      list.forEach((n) => seenNotifIdsRef.current.add(n.id));
      if (newestUnread) {
        const spokenLang = newestUnread.language || notifPrefs?.preferredLanguage || lang;
        const resolvedTone = getToneTypeForEvent(newestUnread);
        setForegroundPush({
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
        });
        if (
          newestUnread.category === 'matchingJobs' ||
          newestUnread.eventType === 'hiring_request_created' ||
          Boolean(newestUnread.voiceScript)
        ) {
          void triggerSmartVoicePlayback({
            voiceScript: newestUnread.voiceScript,
            lang: spokenLang,
            playSound: newestUnread.playSound,
            speakVoice: newestUnread.speakVoice,
            toneType: resolvedTone,
            eventType: newestUnread.eventType,
          });
        } else if (
          !voiceMuted &&
          newestUnread.playSound !== false &&
          isToneEnabledForUser(resolvedTone, notifPrefs)
        ) {
          void playNotificationTone(resolvedTone);
        }
      }
    });
    return () => unsub();
  }, [user?.uid, user?.emailVerified, notifPrefs, lang, voiceMuted, triggerSmartVoicePlayback, resolveNotificationTargetRoute]);

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

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      {/* Live Foreground Push & Smart Voice Alert Toast */}
      {foregroundPush && (() => {
        const activeTone = getToneTypeForEvent({
          toneType: foregroundPush.toneType,
          eventType: foregroundPush.eventType,
        });
        const toneCfg = getToneChannelConfig(activeTone);
        return (
          <div
            role="status"
            className={`fixed top-16 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white border-2 ${toneCfg.toastBorderClass} rounded-lg shadow-xl p-4 space-y-2.5`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <BellRing className="w-4 h-4 text-[#E06D1B] shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                  ROJGAR SETU
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold ${toneCfg.badgeColorClass}`}
                >
                  {toneCfg.label[lang]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopVoiceAlert();
                  setForegroundPush(null);
                }}
                aria-label="Close notification"
                className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <div className="font-display text-sm font-bold text-[#0B3B75]">{foregroundPush.title}</div>
              <p className="text-xs text-slate-600 mt-0.5">{foregroundPush.body}</p>
              {foregroundPush.speechBlockedHint && (
                <p className="text-[11px] font-semibold text-[#C25E00] mt-1">
                  Tap Replay Voice below to hear the spoken job announcement.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  unlockAudioOnUserGesture();
                  void playNotificationTone(activeTone);
                }}
                className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                <span>Replay Tone</span>
              </button>
              {foregroundPush.voiceScript && (
                <button
                  type="button"
                  onClick={() => {
                    unlockAudioOnUserGesture();
                    setForegroundPush((prev) => (prev ? { ...prev, speechBlockedHint: false } : prev));
                    void speakJobAlert({
                      text: foregroundPush.voiceScript!,
                      lang: foregroundPush.lang || notifPrefs?.preferredLanguage || lang,
                      soundEnabled: false,
                      voiceEnabled: true,
                      toneType: activeTone,
                    });
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#0B3B75] text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                  <span>Replay Voice</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setVoiceMuted((prev) => {
                    const next = !prev;
                    if (next) stopVoiceAlert();
                    return next;
                  });
                }}
                className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {voiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{voiceMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopVoiceAlert();
                  setForegroundPush(null);
                }}
                className="min-h-[40px] px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = foregroundPush;
                  stopVoiceAlert();
                  setForegroundPush(null);
                  navigateToTarget(
                    target.route || 'worker-dashboard',
                    target.jobId,
                    target.demoJobId
                  );
                }}
                className="min-h-[40px] px-4 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-extrabold hover:bg-slate-800 cursor-pointer"
              >
                OPEN
              </button>
            </div>
          </div>
        );
      })()}
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
        {(route === 'home' || route === 'demo-testing') && (
          <HomeView
            onNavigate={navigate}
            onOpenAiAssistant={() => {
              setAiLocationHint('');
              setAiOpen(true);
            }}
            workers={workers}
            employers={employers}
            jobs={jobs}
            announcements={announcements}
            totalApplicationsCount={adminAppsCount}
          />
        )}
        {route === 'hire' && (
          <InstantHireView
            workers={workers}
            initialCategory={categoryFilter}
            aiPrefill={aiPrefill}
            onClearAiPrefill={() => setAiPrefill(null)}
            onOpenAiAssistant={(locHint) => {
              setAiLocationHint(locHint || '');
              setAiOpen(true);
            }}
            onNavigate={navigate}
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
        {route === 'find-work' && (
          <FindWorkView
            jobs={jobs}
            initialCategory={categoryFilter}
            highlightedJobId={highlightedJobId}
            onClearHighlightedJob={() => setHighlightedJobId('')}
            onNavigate={(r) => navigate(r)}
          />
        )}
        {route === 'find-workers' && (
          <FindWorkersView workers={workers} onNavigate={(r) => navigate(r)} />
        )}
        {route === 'skills-training' && <SkillsTrainingView />}
        {route === 'register-worker' && (
          <WorkerRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'register-employer' && (
          <EmployerRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'register-vehicle' && (
          <VehicleRegistrationForm onNavigate={(r) => navigate(r)} />
        )}
        {route === 'post-job' && <PostJobView workers={workers} onNavigate={(r) => navigate(r)} />}
        {route === 'worker-dashboard' && (
          <WorkerDashboardView
            jobs={jobs}
            notifications={notifications}
            unreadNotificationsCount={unreadNotificationsCount}
            onNavigate={navigate}
            onNavigateToTarget={navigateToTarget}
            highlightedJobId={highlightedJobId}
            onClearHighlightedJob={() => setHighlightedJobId('')}
            highlightedDemoJobId={highlightedDemoJobId}
            onClearHighlightedDemoJob={() => setHighlightedDemoJobId('')}
          />
        )}
        {route === 'employer-dashboard' && (
          <EmployerDashboardView
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
