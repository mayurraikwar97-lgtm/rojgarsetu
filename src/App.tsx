import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
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

const AppShell: React.FC = () => {
  const { isAdmin } = useAuth();
  const [route, setRoute] = useState<PageRoute>('home');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [workers, setWorkers] = useState<PublicWorkerProfile[]>([]);
  const [employers, setEmployers] = useState<PublicEmployerProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [adminAppsCount, setAdminAppsCount] = useState(0);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLocationHint, setAiLocationHint] = useState('');
  const [aiPrefill, setAiPrefill] = useState<AiHirePrefill | null>(null);

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

  const navigate = (nextRoute: PageRoute, nextCategory?: string) => {
    setRoute(nextRoute);
    setCategoryFilter(nextCategory ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
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
          <WorkerDashboardView jobs={jobs} onNavigate={navigate} />
        )}
        {route === 'employer-dashboard' && (
          <EmployerDashboardView jobs={jobs} onNavigate={navigate} />
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
