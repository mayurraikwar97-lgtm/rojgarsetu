import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { subscribeForegroundPush } from './lib/pushNotifications';
import {
  subscribeAllApplicationsAdmin,
  subscribeAnnouncements,
  subscribeJobs,
  subscribePublicEmployers,
  subscribePublicWorkers,
  subscribeVehicleListings,
} from './lib/firestoreService';
import type {
  AiHirePrefill,
  JobPosting,
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
  'about',
  'partnerships',
  'pricing',
  'trust-safety',
  'contact',
];

function isValidRoute(value: string | undefined | null): value is PageRoute {
  return Boolean(value && VALID_ROUTES.includes(value as PageRoute));
}

const AppShell: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [route, setRoute] = useState<PageRoute>('home');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [highlightedJobId, setHighlightedJobId] = useState('');
  const [highlightedDemoJobId, setHighlightedDemoJobId] = useState('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [foregroundPush, setForegroundPush] = useState<{
    title: string;
    body: string;
    route?: PageRoute;
    jobId?: string;
    demoJobId?: string;
  } | null>(null);

  const [workers, setWorkers] = useState<PublicWorkerProfile[]>([]);
  const [employers, setEmployers] = useState<PublicEmployerProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [adminAppsCount, setAdminAppsCount] = useState(0);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLocationHint, setAiLocationHint] = useState('');
  const [aiPrefill, setAiPrefill] = useState<AiHirePrefill | null>(null);

  const navigate = useCallback((nextRoute: PageRoute, nextCategory?: string) => {
    setRoute(nextRoute);
    setCategoryFilter(nextCategory ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToTarget = useCallback(
    (targetRoute: PageRoute, jobId?: string, demoJobId?: string) => {
      if (jobId) setHighlightedJobId(jobId);
      if (demoJobId) setHighlightedDemoJobId(demoJobId);
      navigate(targetRoute);
    },
    [navigate]
  );

  // Parse deep links from URL query parameters on boot (?route=find-work&jobId=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('route');
    const jId = params.get('jobId') || '';
    const djId = params.get('demoJobId') || '';
    const cat = params.get('category') || '';

    if (jId) setHighlightedJobId(jId);
    if (djId) setHighlightedDemoJobId(djId);
    if (isValidRoute(r)) {
      setRoute(r);
      if (cat) setCategoryFilter(cat);
    } else if (jId) {
      setRoute('find-work');
    } else if (djId) {
      setRoute('worker-dashboard');
    }

    if (r || jId || djId || cat) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Handle Service Worker notification click deep-link messages when app is already open
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        route?: string;
        jobId?: string;
        demoJobId?: string;
      } | null;
      if (data?.type === 'ROJGAR_SETU_DEEP_LINK') {
        const nextRoute = isValidRoute(data.route)
          ? data.route
          : data.demoJobId
          ? 'worker-dashboard'
          : data.jobId
          ? 'find-work'
          : 'home';
        navigateToTarget(nextRoute, data.jobId, data.demoJobId);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigateToTarget]);

  // Listen to foreground FCM messages while user has app open
  useEffect(() => {
    if (!user?.emailVerified) return;
    let unsub: () => void = () => undefined;
    let active = true;
    void subscribeForegroundPush((payload) => {
      if (!active) return;
      const targetRoute = isValidRoute(payload.route)
        ? payload.route
        : payload.demoJobId
        ? 'worker-dashboard'
        : payload.jobId
        ? 'find-work'
        : 'home';
      setForegroundPush({
        title: payload.title,
        body: payload.body,
        route: targetRoute,
        jobId: payload.jobId,
        demoJobId: payload.demoJobId,
      });
    }).then((fn) => {
      if (active) unsub = fn;
      else fn();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user?.uid, user?.emailVerified]);

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

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      {/* Live Foreground Push Notification Toast */}
      {foregroundPush && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white border-2 border-[#E06D1B] rounded-lg shadow-xl p-4 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C25E00]">
              <BellRing className="w-4 h-4 text-[#E06D1B] shrink-0" />
              <span>ROJGAR SETU Notification</span>
            </div>
            <button
              type="button"
              onClick={() => setForegroundPush(null)}
              aria-label="Close notification"
              className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-[#0B3B75]">{foregroundPush.title}</div>
            <p className="text-xs text-slate-600 mt-0.5">{foregroundPush.body}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForegroundPush(null)}
              className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const target = foregroundPush;
                setForegroundPush(null);
                navigateToTarget(
                  target.route || 'home',
                  target.jobId,
                  target.demoJobId
                );
              }}
              className="px-3.5 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              Open
            </button>
          </div>
        </div>
      )}
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
        onOpenAiAssistant={() => {
          setAiLocationHint('');
          setAiOpen(true);
        }}
      />

      <main id="main-content" className="flex-1">
        {route === 'home' && (
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
        {route === 'post-job' && <PostJobView onNavigate={(r) => navigate(r)} />}
        {route === 'worker-dashboard' && (
          <WorkerDashboardView
            jobs={jobs}
            onNavigate={navigate}
            onNavigateToTarget={navigateToTarget}
            highlightedDemoJobId={highlightedDemoJobId}
            onClearHighlightedDemoJob={() => setHighlightedDemoJobId('')}
          />
        )}
        {route === 'employer-dashboard' && (
          <EmployerDashboardView
            jobs={jobs}
            onNavigate={navigate}
            onNavigateToTarget={navigateToTarget}
          />
        )}
        {route === 'admin' && (
          <AdminDashboardView
            workers={workers}
            employers={employers}
            jobs={jobs}
            announcements={announcements}
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
