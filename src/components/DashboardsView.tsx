import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bike,
  BookmarkCheck,
  Briefcase,
  Camera,
  Car,
  CheckCircle2,
  Crosshair,
  Download,
  FileText,
  Gift,
  History,
  LocateFixed,
  Lock,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  PlusCircle,
  Printer,
  Radar,
  Shield,
  Star,
  Store,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { BrandSloganBanner } from './BrandSloganBanner';
import { RojgarSetuLogo } from './RojgarSetuLogo';
import { SecureAvatar } from './SecureAvatar';
import { UserNotificationCenter } from './UserNotificationCenter';
import { AdminNotificationDemoPanel } from './AdminNotificationDemoPanel';
import { AdminAdsManagementPanel } from './AdminAdsManagementPanel';
import { AdminProfessionsPanel } from './AdminProfessionsPanel';
import { AdminReferralsPanel } from './AdminReferralsPanel';
import { AdminShopkeepersPanel } from './AdminShopkeepersPanel';
import { subscribeAllProfessionsAdmin } from '../lib/customProfessionService';
import type { CustomProfessionRecord } from '../types/domain';
import { PaymentStatusBadge } from './WorkerCertificateAndReceipt';
import { ApproximateJobLocationMap } from './ApproximateJobLocationMap';
import { DealCoordinationPanel, getDealStatusBadgeStyle } from './DealCoordinationPanel';
import { OrderChatBox } from './OrderChatBox';
import { getJobPhotoUrls } from '../lib/workPhotoService';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getVehicleTypeLabel } from '../data/vehicleTypes';
import { SERVICE_CATALOG_V2 } from '../data/serviceCatalogV2';
import { useLanguage } from '../i18n/LanguageContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildAcceptedApplicationGrantId,
  buildCustomerPhotoDocId,
  grantAcceptedCustomerPhoto,
  isCustomerPhotoVisibleForJobStatus,
} from '../lib/photoStorageService';
import {
  adminCreateAnnouncement,
  adminFetchAllEmployerPrivate,
  adminToggleAnnouncement,
  adminUpdateEnquiryStatus,
  adminUpdateGrievanceStatus,
  adminUpdateJobStatus,
  adminUpdateVerification,
  adminUpdateWorkerAvailability,
  callNotificationApi,
  cancelDeal,
  completeDeal,
  confirmWorkOffer,
  doesWorkerMatchJob,
  expandJobSearchRadius,
  getEffectiveDealStatus,
  markAllNotificationsRead,
  markNotificationRead,
  respondToHiringInvite,
  saveCustomerDefaultLocation,
  submitCustomerRating,
  submitWorkerOffer,
  subscribeAdminAuditLogs,
  subscribeAdminEnquiries,
  subscribeAdminGrievances,
  subscribeAllApplicationsAdmin,
  subscribeAllCustomerOrderMessages,
  subscribeCustomerVehicleBookings,
  subscribeEmployerApplications,
  subscribeOwnerVehicleBookings,
  subscribeOwnerVehicles,
  subscribeWorkerApplications,
  updateVehicleAvailability,
  updateVehicleBookingStatus,
} from '../lib/firestoreService';
import {
  getToneChannelConfig,
  getToneTypeForEvent,
  getVisibleDealStatusLabel,
  toVisibleDealStage,
} from '../lib/dealWorkflow';
import {
  buildSmartJobVoiceScript,
  calculateValidDistanceKm,
  getNextRadiusStage,
  getPublicJobLocationText,
  normalizeRadiusKm,
} from '../lib/smartVoiceJobAlert';
import {
  playNotificationTone,
  speakJobAlert,
  stopVoiceAlert,
  unlockAudioOnUserGesture,
} from '../lib/voiceAlertEngine';
import {
  DEFAULT_REFERRAL_CONFIG,
  subscribeAdminReferralsData,
  subscribeReferralConfig,
} from '../lib/adsReferralService';
import {
  adminVerifyWorkerRegistrationPayment,
  subscribeAdminFinanceData,
} from '../lib/workerPaymentService';
import type {
  AppNotificationRecord,
  AuditLog,
  DealMessage,
  EmployerPrivateInfo,
  GrievanceReport,
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  PartnershipEnquiry,
  PlatformAnnouncement,
  PlatformReferralConfig,
  PublicEmployerProfile,
  PublicWorkerProfile,
  ReferralRewardRecord,
  ServiceRadiusKm,
  VehicleBooking,
  VehicleListing,
  VehicleType,
  WorkerReferralRecord,
  WorkerRegistrationPayment,
} from '../types/domain';
import { ProfessionThumbnail } from './ProfessionThumbnail';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function formatRequestDateTime(job?: JobPosting, app?: JobApplication): string {
  const datePart = app?.jobDate || job?.jobDate || '';
  const timePart = app?.startTime || job?.startTime || '';
  if (datePart || timePart) {
    return `${datePart}${datePart && timePart ? ' · ' : ''}${timePart}`;
  }
  const rawTs = (job?.createdAt || app?.createdAt) as
    | { toDate?: () => Date; seconds?: number }
    | undefined;
  let d: Date | null = null;
  if (rawTs && typeof rawTs.toDate === 'function') {
    d = rawTs.toDate();
  } else if (rawTs && typeof rawTs.seconds === 'number') {
    d = new Date(rawTs.seconds * 1000);
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | undefined)[][]) {
  const escape = (val: string | number | boolean | undefined) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatFirestoreTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '—';
  const maybe = ts as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') {
    return maybe.toDate().toLocaleString('en-IN');
  }
  if (typeof maybe.seconds === 'number') {
    return new Date(maybe.seconds * 1000).toLocaleString('en-IN');
  }
  return '—';
}

/* ============================================================================
   1. WORKER DASHBOARD
============================================================================ */

interface WorkerDashboardProps {
  jobs: JobPosting[];
  notifications?: AppNotificationRecord[];
  unreadNotificationsCount?: number;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
  onNavigateToTarget?: (route: PageRoute, jobId?: string, demoJobId?: string) => void;
  highlightedJobId?: string;
  onClearHighlightedJob?: () => void;
  highlightedDemoJobId?: string;
  onClearHighlightedDemoJob?: () => void;
}

export const WorkerDashboardView: React.FC<WorkerDashboardProps> = ({
  jobs,
  notifications = [],
  unreadNotificationsCount = 0,
  onNavigate,
  onNavigateToTarget,
  highlightedJobId,
  onClearHighlightedJob,
  highlightedDemoJobId,
  onClearHighlightedDemoJob,
}) => {
  const { lang, t } = useLanguage();
  const { user, authReady, workerProfile, workerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [ownerVehicles, setOwnerVehicles] = useState<VehicleListing[]>([]);
  const [ownerVehicleBookings, setOwnerVehicleBookings] = useState<VehicleBooking[]>([]);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [availUpdating, setAvailUpdating] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);
  const [speakingJobId, setSpeakingJobId] = useState<string | null>(null);
  const [offerDraftTargetId, setOfferDraftTargetId] = useState<string | null>(null);
  const [offerPriceInput, setOfferPriceInput] = useState<string>('');
  const [offerTravelInput, setOfferTravelInput] = useState<string>('');
  const [offerMsgInput, setOfferMsgInput] = useState<string>('');
  const [openMapJobIds, setOpenMapJobIds] = useState<Record<string, boolean>>({});
  const [openChatJobIds, setOpenChatJobIds] = useState<Record<string, boolean>>({});
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState<string | null>(null);
  const [fetchedSpotlightJob, setFetchedSpotlightJob] = useState<JobPosting | null>(null);
  const [spotlightLoading, setSpotlightLoading] = useState(false);
  const newRequestSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!user?.emailVerified) {
      setApplications([]);
      setOwnerVehicles([]);
      setOwnerVehicleBookings([]);
      return;
    }
    const u1 = subscribeWorkerApplications(user.uid, setApplications);
    const u2 = subscribeOwnerVehicles(user.uid, setOwnerVehicles);
    const u3 = subscribeOwnerVehicleBookings(user.uid, setOwnerVehicleBookings);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid, user?.emailVerified]);

  const jobsById = useMemo(() => {
    const record: Record<string, JobPosting> = {};
    jobs.forEach((j) => {
      record[j.id] = j;
    });
    return record;
  }, [jobs]);

  // Direct Firestore fallback fetch for deep-linked notification jobId if not yet present in live jobs feed
  useEffect(() => {
    if (!highlightedJobId) {
      setFetchedSpotlightJob(null);
      setSpotlightLoading(false);
      return;
    }
    if (jobsById[highlightedJobId]) {
      setFetchedSpotlightJob(null);
      setSpotlightLoading(false);
      return;
    }
    let cancelled = false;
    setSpotlightLoading(true);
    getDoc(doc(db, 'jobs', highlightedJobId))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setFetchedSpotlightJob({ id: snap.id, ...(snap.data() as Omit<JobPosting, 'id'>) });
        } else {
          setFetchedSpotlightJob(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedSpotlightJob(null);
      })
      .finally(() => {
        if (!cancelled) setSpotlightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [highlightedJobId, jobsById]);

  const matchingJobs = useMemo(() => {
    if (!workerProfile) return [];
    const appliedJobIdSet = new Set(applications.map((a) => a.jobId));
    return jobs
      .filter((j) => j.status === 'open')
      .filter((j) => !appliedJobIdSet.has(j.id) && !dismissedJobIds.includes(j.id))
      .filter((j) => j.id !== highlightedJobId)
      .filter((j) => doesWorkerMatchJob(j, workerProfile).matches)
      .slice(0, 12);
  }, [jobs, workerProfile, applications, dismissedJobIds, highlightedJobId]);

  const incomingInvites = useMemo(
    () => applications.filter((a) => a.status === 'invited'),
    [applications]
  );

  const spotlightJob = useMemo(() => {
    if (!highlightedJobId) return undefined;
    return (
      jobsById[highlightedJobId] ||
      (fetchedSpotlightJob && fetchedSpotlightJob.id === highlightedJobId
        ? fetchedSpotlightJob
        : undefined)
    );
  }, [highlightedJobId, jobsById, fetchedSpotlightJob]);

  const spotlightApp = useMemo(() => {
    if (!highlightedJobId) return undefined;
    return applications.find((a) => a.jobId === highlightedJobId);
  }, [highlightedJobId, applications]);

  const hasWorkerProfile = Boolean(workerProfile);
  const hasSpotlightJob = Boolean(spotlightJob);

  useEffect(() => {
    if (!highlightedJobId || !hasWorkerProfile) return;
    const timer = window.setTimeout(() => {
      newRequestSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [highlightedJobId, hasWorkerProfile, hasSpotlightJob]);

  const buildFallbackJobFromApp = (app: JobApplication): JobPosting => ({
    id: app.jobId,
    employerUid: app.employerUid,
    employerName: app.customerName || 'Customer',
    title: app.jobTitle,
    category: app.jobCategory || workerProfile?.primarySkill || 'General',
    description: app.note || app.jobTitle,
    workType: 'daily_wage',
    offeredWage: app.proposedWage || 0,
    wageUnit: 'daily',
    workersRequired: 1,
    requiredSkills: [app.jobCategory || workerProfile?.primarySkill || 'General'],
    state: workerProfile?.state || '',
    district: app.jobDistrict || workerProfile?.district || '',
    cityOrVillage: app.jobLocationLabel || workerProfile?.cityOrVillage || '',
    workLocationLabel: app.jobLocationLabel || '',
    approxLocationLabel: app.jobLocationLabel || app.jobDistrict || '',
    lat: workerProfile?.approxLat || 0,
    lng: workerProfile?.approxLng || 0,
    jobDate: app.jobDate,
    startTime: app.startTime,
    paymentTerms: 'On work completion',
    contactPreference: 'platform_message',
    biddingEnabled: true,
    isWomenFriendly: false,
    isAccessible: false,
    status: 'open',
    applicationsCount: 1,
  });

  const handleListenJobVoice = (job: JobPosting) => {
    unlockAudioOnUserGesture();
    if (speakingJobId === job.id) {
      stopVoiceAlert();
      setSpeakingJobId(null);
      return;
    }
    const approxLoc = getPublicJobLocationText(job, false);
    const distKm = calculateValidDistanceKm(
      job.lat,
      job.lng,
      workerProfile?.approxLat,
      workerProfile?.approxLng
    );
    const voiceLang = workerProfile?.preferredLanguage || lang;
    const script = buildSmartJobVoiceScript({
      lang: voiceLang,
      customerName: job.employerName,
      category: job.category,
      jobTitle: job.title,
      jobDescription: job.title || job.description,
      approxLocationLabel: approxLoc,
      distanceKm: distKm,
    });
    setSpeakingJobId(job.id);
    void speakJobAlert({
      text: script,
      lang: voiceLang,
      soundEnabled: false,
      voiceEnabled: true,
    }).finally(() => {
      setSpeakingJobId((prev) => (prev === job.id ? null : prev));
    });
  };

  const handleAvailabilityChange = async (nextStatus: PublicWorkerProfile['availabilityStatus']) => {
    if (!user || !workerProfile || workerProfile.verificationStatus === 'suspended') return;
    setAvailUpdating(true);
    setFeedbackBanner('');
    try {
      await updateDoc(doc(db, 'publicWorkers', user.uid), {
        availabilityStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await refreshUserProfiles();
      setFeedbackBanner(tr(lang, 'Availability updated.', 'उपलब्धता अपडेट की गई।', 'उपलब्धता अद्ययावत केली.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicWorkers/${user.uid}`);
    } finally {
      setAvailUpdating(false);
    }
  };

  const handleInviteDecision = async (app: JobApplication, decision: 'accepted' | 'declined') => {
    if (!workerProfile) return;
    setBusyActionId(app.id);
    setFeedbackBanner('');
    try {
      await respondToHiringInvite({
        app,
        decision,
        workerName: workerProfile.displayName,
        jobLocationLabel: app.jobLocationLabel || jobsById[app.jobId]?.workLocationLabel,
      });
      setFeedbackBanner(
        decision === 'accepted'
          ? tr(
              lang,
              'Request accepted! Customer notified and two-way live map is ready below.',
              'अनुरोध स्वीकार हो गया! ग्राहक को सूचना भेजी गई है।',
              'विनंती स्वीकारली! ग्राहकाला सूचना पाठवली आहे.'
            )
          : tr(lang, 'Request declined.', 'अनुरोध अस्वीकार किया गया।', 'विनंती नाकारली.')
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOpenOfferEditor = (targetId: string, defaultWage: number) => {
    setOfferDraftTargetId(targetId);
    const suggested = defaultWage > 0 ? defaultWage : workerProfile?.expectedWage || 0;
    setOfferPriceInput(suggested > 0 ? String(suggested) : '');
    setOfferTravelInput('');
    setOfferMsgInput('');
  };

  const handleSubmitOfferForJob = async (
    e: React.FormEvent,
    job: JobPosting,
    existingApp?: JobApplication
  ) => {
    e.preventDefault();
    if (!user || !workerProfile) return;
    const parsedPrice = Number(offerPriceInput);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFeedbackBanner(
        tr(
          lang,
          'Please enter your price (₹) before sending your offer.',
          'ऑफर भेजने से पहले कृपया अपना दर (₹) दर्ज करें।',
          'ऑफर पाठवण्यापूर्वी कृपया तुमचा दर (₹) टाका.'
        )
      );
      return;
    }
    const parsedTravel = offerTravelInput.trim() ? Math.max(0, Math.round(Number(offerTravelInput) || 0)) : 0;
    setBusyActionId(existingApp?.id || job.id);
    setFeedbackBanner('');
    try {
      await submitWorkerOffer({
        job,
        worker: workerProfile,
        workerUid: user.uid,
        offeredPrice: Math.round(parsedPrice),
        travelCharges: parsedTravel,
        offerMessage: offerMsgInput.trim(),
        existingApplicationId: existingApp?.id,
      });
      setOfferDraftTargetId(null);
      setOfferTravelInput('');
      setOfferMsgInput('');
      setFeedbackBanner(
        tr(
          lang,
          'Offer sent! Customer has been notified immediately with sound.',
          'ऑफर भेज दिया गया! ग्राहक को तुरंत सूचना भेज दी गई है।',
          'ऑफर पाठवली! ग्राहकाला तात्काळ सूचना पाठवली आहे.'
        )
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const handleWorkerCompleteDeal = async (app: JobApplication) => {
    if (!user || !workerProfile) return;
    setBusyActionId(app.id);
    try {
      await completeDeal({
        app,
        actorUid: user.uid,
        actorRole: 'worker',
        actorName: workerProfile.displayName,
      });
      void playNotificationTone('deal_completed');
      setFeedbackBanner(tr(lang, 'Work marked completed and live location stopped.', 'कार्य पूर्ण! लाइव लोकेशन बंद कर दी गई।', 'काम पूर्ण झाले आणि लाइव्ह लोकेशन बंद केले.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleWorkerCancelDeal = async (app: JobApplication) => {
    if (!user || !workerProfile) return;
    setBusyActionId(app.id);
    try {
      await cancelDeal({
        app,
        actorUid: user.uid,
        actorRole: 'worker',
        actorName: workerProfile.displayName,
      });
      void playNotificationTone('deal_cancelled');
      setFeedbackBanner(tr(lang, 'Work cancelled and live location stopped.', 'कार्य रद्द किया गया और लाइव लोकेशन बंद हुई।', 'काम रद्द केले आणि लाइव्ह लोकेशन बंद केले.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleVehicleBookingDecision = async (
    b: VehicleBooking,
    nextStatus: 'accepted' | 'declined' | 'completed'
  ) => {
    await updateVehicleBookingStatus(b.id, nextStatus);
    void callNotificationApi('/api/notifications/send-customer-event', {
      recipientUid: b.customerUid,
      bookingId: b.id,
      eventType:
        nextStatus === 'accepted'
          ? 'booking_accepted'
          : nextStatus === 'completed'
          ? 'job_completed'
          : 'booking_cancelled',
      workerName: b.vehicleTitle,
      jobTitle: `${b.vehicleTitle} (${b.pickupLocation} → ${b.dropLocation})`,
      targetRoute: 'employer-dashboard',
    }).catch(() => undefined);
  };

  if (!authReady) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
          <h1 className="font-display text-xl font-bold text-[#0B3B75]">
            {tr(lang, 'Loading Customer Request & Dashboard...', 'ग्राहक अनुरोध लोड हो रहा है...', 'ग्राहक विनंती लोड होत आहे...')}
          </h1>
          <p className="text-xs text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#0B3B75] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.workerTitle}</h1>
          <p className="text-sm text-slate-600">{t.common.signInRequired}</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {t.nav.signIn}
          </button>
        </div>
      </div>
    );
  }

  if (!workerProfile && ownerVehicles.length === 0 && ownerVehicleBookings.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.workerTitle}</h1>
          <p className="text-sm text-slate-600">
            {tr(
              lang,
              'You have not created a Worker or Auto/Car Profile yet. Register free to receive your unique ID.',
              'आपने अभी तक कामगार या वाहन प्रोफाइल नहीं बनाया है। अपनी विशिष्ट पंजीकरण आईडी प्राप्त करने के लिए निःशुल्क पंजीकरण करें।',
              'तुम्ही अद्याप कामगार किंवा वाहन प्रोफाइल तयार केलेले नाही. मोफत नोंदणी करा.'
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('register-worker')}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              {t.hero.ctaWorker}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register-vehicle')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#E06D1B] text-white text-sm font-semibold hover:bg-[#c55b10] cursor-pointer"
            >
              <Car className="w-4 h-4" />
              {tr(lang, 'List Bike Taxi / Auto / Trolley / Tempo', 'बाइक टैक्सी / ऑटो / ट्रॉली / टेम्पो जोड़ें', 'बाईक टॅक्सी / ऑटो / ट्रॉली / टेम्पो नोंदवा')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!workerProfile) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0B3B75]">
              {tr(lang, 'My Local Transport Fleet & Ride Requests', 'मेरे स्थानीय वाहन एवं बुकिंग अनुरोध', 'माझी लोकल वाहने व बुकिंग विनंत्या')}
            </h1>
            <p className="text-sm text-slate-600">
              {user.displayName || user.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('register-vehicle')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
            >
              <Car className="w-4 h-4" />
              {tr(lang, 'Add Another Vehicle', 'एक और वाहन जोड़ें', 'आणखी वाहन जोडा')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register-worker')}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
            >
              {t.hero.ctaWorker}
            </button>
          </div>
        </div>

        {/* Owner Vehicles */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'My Listed Vehicles', 'मेरे पंजीकृत वाहन', 'माझी नोंदवलेली वाहने')} ({ownerVehicles.length})
          </h2>
          <div className="divide-y divide-slate-200">
            {ownerVehicles.map((v) => (
              <div key={v.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono-tabular text-[#C25E00] font-semibold">
                    {v.registrationId} · {v.vehicleNumberMasked}
                  </div>
                  <div className="font-display text-base font-bold text-[#0B3B75]">{v.vehicleTitle}</div>
                  <div className="text-xs text-slate-600">
                    {v.cityOrVillage}, {v.district} · ₹{v.ratePerKm}/km · ₹{v.ratePerDay}/day
                  </div>
                </div>
                <select
                  value={v.availabilityStatus}
                  onChange={(e) =>
                    updateVehicleAvailability(v.id, e.target.value as VehicleListing['availabilityStatus'])
                  }
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white self-start sm:self-center"
                >
                  <option value="available">{tr(lang, 'Available', 'उपलब्ध', 'उपलब्ध')}</option>
                  <option value="busy">{tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')}</option>
                  <option value="offline">{tr(lang, 'Offline', 'ऑफलाइन', 'ऑफलाइन')}</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* Incoming Vehicle Bookings */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'Incoming Ride & Rental Bookings', 'आए हुए वाहन बुकिंग अनुरोध', 'आलेल्या वाहन बुकिंग विनंत्या')} ({ownerVehicleBookings.length})
          </h2>
          {ownerVehicleBookings.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">{t.common.noRecords}</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {ownerVehicleBookings.map((b) => (
                <div key={b.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-mono-tabular text-slate-500">
                      <strong className="uppercase text-[#0B3B75]">{b.status}</strong> · {b.travelDate} {b.travelTime} · ₹{b.offeredFare.toLocaleString('en-IN')}
                    </div>
                    <div className="font-display text-base font-bold text-[#0B3B75]">
                      {b.vehicleTitle} — {b.customerName}
                    </div>
                    <div className="text-xs text-slate-600">
                      {b.pickupLocation} → {b.dropLocation} ({b.tripType.replace('_', ' ')}, {b.passengersCount} pax)
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.status === 'requested' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVehicleBookingDecision(b, 'accepted')}
                          className="px-3 py-1.5 rounded bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                        >
                          {t.dashboards.acceptBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVehicleBookingDecision(b, 'declined')}
                          className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          {t.dashboards.declineBtn}
                        </button>
                      </>
                    )}
                    {b.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => handleVehicleBookingDecision(b, 'completed')}
                        className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-semibold cursor-pointer"
                      >
                        {tr(lang, 'Mark Trip Completed', 'यात्रा पूर्ण करें', 'प्रवास पूर्ण करा')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <UserNotificationCenter
          mode="worker"
          onNavigateToTarget={onNavigateToTarget || ((r) => onNavigate(r))}
          highlightedDemoJobId={highlightedDemoJobId}
          onClearHighlightedDemoJob={onClearHighlightedDemoJob}
        />
      </div>
    );
  }

  const verStatusLabel =
    workerProfile.verificationStatus === 'verified'
      ? t.common.verified
      : workerProfile.verificationStatus === 'suspended'
      ? t.common.suspended
      : t.common.pending;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {feedbackBanner && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {feedbackBanner}
        </div>
      )}

      {workerProfile.verificationStatus === 'suspended' && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            {tr(
              lang,
              'Your worker profile is currently suspended pending review. You may submit an account appeal via the Trust, Safety & Grievance Centre.',
              'आपका कामगार प्रोफाइल समीक्षा हेतु निलंबित है। आप विश्वास एवं सुरक्षा केंद्र के माध्यम से अपील दर्ज कर सकते हैं।',
              'तुमचे कामगार प्रोफाइल पुनरावलोकनासाठी निलंबित केले आहे. तुम्ही विश्वास व सुरक्षा केंद्रातून अपील करू शकता.'
            )}
          </div>
        </div>
      )}

      {/* PRIORITY #1 AT VERY TOP OF WORKER SCREEN: NEW CUSTOMER REQUEST */}
      <section
        id="new-customer-request"
        ref={newRequestSectionRef}
        className="bg-white border-2 border-[#0B3B75] rounded-lg p-5 sm:p-6 space-y-5 shadow-sm scroll-mt-24"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#E06D1B]" />
              <span>
                {tr(
                  lang,
                  'NEW CUSTOMER REQUEST',
                  'नया ग्राहक अनुरोध (NEW CUSTOMER REQUEST)',
                  'नवीन ग्राहक विनंती (NEW CUSTOMER REQUEST)'
                )}{' '}
                ({(spotlightJob ? 1 : 0) + incomingInvites.length + matchingJobs.length})
              </span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {tr(
                lang,
                `Showing requests for your category (${workerProfile.primarySkill}). Review description, uploaded photos & approximate area, then SEND OFFER or CHAT directly with the customer.`,
                `आपकी श्रेणी (${workerProfile.primarySkill}) के लिए नए अनुरोध। विवरण, अपलोड फोटो व अनुमानित क्षेत्र देखें, फिर ऑफर भेजें या सीधे चैट करें।`,
                `तुमच्या श्रेणीसाठी (${workerProfile.primarySkill}) नवीन विनंत्या. माहिती, फोटो व अंदाजे परिसर पाहून ऑफर पाठवा किंवा थेट चॅट करा.`
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={workerProfile.availabilityStatus}
              disabled={availUpdating || workerProfile.verificationStatus === 'suspended'}
              onChange={(e) => handleAvailabilityChange(e.target.value as PublicWorkerProfile['availabilityStatus'])}
              aria-label={t.workerForm.availability}
              className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white font-semibold text-slate-800"
            >
              <option value="available">{tr(lang, 'Available', 'उपलब्ध', 'उपलब्ध')}</option>
              <option value="busy">{tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')}</option>
              <option value="offline">{tr(lang, 'Offline', 'ऑफलाइन', 'ऑफलाइन')}</option>
            </select>
            <button
              type="button"
              onClick={() => onNavigate('find-work', workerProfile.primarySkill)}
              className="text-xs font-semibold text-[#C25E00] hover:underline cursor-pointer whitespace-nowrap"
            >
              {t.nav.findWork} →
            </button>
          </div>
        </div>

        {/* Loading state while deep-linked notification job hydrates */}
        {highlightedJobId && !spotlightJob && (spotlightLoading || jobs.length === 0) && (
          <div className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-5 text-sm font-semibold text-[#0B3B75]">
            {tr(
              lang,
              'Loading customer hiring request...',
              'ग्राहक का अनुरोध लोड हो रहा है...',
              'ग्राहकाची विनंती लोड होत आहे...'
            )}
          </div>
        )}

        {/* Deep-Linked Customer Request Spotlight (opened directly via Notification OPEN) */}
        {spotlightJob && (
          <div className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-5 space-y-4 shadow-sm">
            {/* 1. Category, Customer Name, Date & Time */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#E06D1B] text-white text-[11px] font-mono-tabular font-extrabold uppercase">
                    <BellRing className="w-3.5 h-3.5" />
                    {tr(lang, 'NEW CUSTOMER REQUEST', 'नया ग्राहक अनुरोध', 'नवीन ग्राहक विनंती')} · {spotlightJob.category}
                  </span>
                  {formatRequestDateTime(spotlightJob, spotlightApp) && (
                    <span className="px-2 py-0.5 rounded bg-white border border-amber-300 text-[11px] font-mono-tabular font-semibold text-slate-700">
                      {formatRequestDateTime(spotlightJob, spotlightApp)}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                  {spotlightJob.title}
                </h2>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  {tr(lang, 'Customer:', 'ग्राहक:', 'ग्राहक:')} {spotlightJob.employerName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleListenJobVoice(spotlightJob)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  {speakingJobId === spotlightJob.id ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>
                    {speakingJobId === spotlightJob.id
                      ? tr(lang, 'Stop Voice', 'रोकें', 'थांबवा')
                      : tr(lang, 'Listen Voice Alert', 'वॉइस अलर्ट सुनें', 'व्हॉइस अलर्ट ऐका')}
                  </span>
                </button>
                {onClearHighlightedJob && (
                  <button
                    type="button"
                    onClick={onClearHighlightedJob}
                    className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {tr(lang, 'Close', 'बंद करें', 'बंद करा')}
                  </button>
                )}
              </div>
            </div>

            {/* 2. Work Description & Uploaded Work Photos */}
            <div className="space-y-2.5">
              <div className="text-xs sm:text-sm text-slate-800 bg-white border border-amber-200 rounded-md p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {tr(lang, 'Work Description', 'काम का विवरण', 'कामाचे वर्णन')}
                </div>
                <p>{spotlightJob.description}</p>
              </div>

              {(() => {
                const spotlightPhotos = getJobPhotoUrls(spotlightJob);
                if (spotlightPhotos.length === 0) return null;
                return (
                  <div className="bg-white border border-amber-200 rounded-md p-3 space-y-2">
                    <p className="text-xs font-bold text-[#0B3B75] inline-flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#E06D1B]" />
                      <span>
                        {tr(
                          lang,
                          `Uploaded Work Photos (${spotlightPhotos.length}) — Tap to Zoom`,
                          `अपलोड किए गए काम के फोटो (${spotlightPhotos.length}) — ज़ूम करने हेतु टैप करें`,
                          `अपलोड केलेले कामाचे फोटो (${spotlightPhotos.length}) — मोठे पाहण्यासाठी टॅप करा`
                        )}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {spotlightPhotos.map((photoUrl, idx) => (
                        <button
                          key={`spot-photo-${idx}`}
                          type="button"
                          onClick={() => setLightboxPhotoUrl(photoUrl)}
                          className="w-24 h-24 rounded-md overflow-hidden border-2 border-amber-300 bg-slate-50 hover:opacity-90 cursor-pointer"
                        >
                          <img
                            src={photoUrl}
                            alt={`Work order photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 3. Approximate Customer Location */}
            {(() => {
              const distKm = calculateValidDistanceKm(
                spotlightJob.lat,
                spotlightJob.lng,
                workerProfile.approxLat,
                workerProfile.approxLng
              );
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-800 bg-white border border-amber-200 rounded-md px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0" />
                      <strong>{tr(lang, 'Approximate Customer Location:', 'अनुमानित ग्राहक स्थान:', 'ग्राहकाचे अंदाजे ठिकाण:')}</strong>{' '}
                      {getPublicJobLocationText(spotlightJob, false)}
                    </span>
                    {distKm !== null && (
                      <span className="font-mono-tabular font-bold text-[#0B3B75]">~{distKm} km away</span>
                    )}
                    {spotlightJob.offeredWage > 0 && (
                      <span className="font-mono-tabular font-bold text-[#15803D]">
                        {tr(lang, 'Budget:', 'बजट:', 'बजेट:')} ₹{spotlightJob.offeredWage.toLocaleString('en-IN')} / {spotlightJob.wageUnit}
                      </span>
                    )}
                  </div>

                  {(!spotlightApp || spotlightApp.status !== 'accepted') && (
                    <ApproximateJobLocationMap job={spotlightJob} distanceKm={distKm} />
                  )}
                </div>
              );
            })()}

            {/* 4 & 5. Primary Action Buttons: SEND OFFER + CHAT (or Active Deal Panel if already offered/accepted) */}
            {!spotlightApp && spotlightJob.status !== 'open' ? (
              <div className="rounded-md bg-slate-100 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                {tr(
                  lang,
                  `This hiring request is currently "${spotlightJob.status}" and is no longer accepting new offers.`,
                  `यह अनुरोध वर्तमान में "${spotlightJob.status}" है और अब नए ऑफर स्वीकार नहीं कर रहा है।`,
                  `ही विनंती सध्या "${spotlightJob.status}" आहे आणि नवीन ऑफर स्वीकारत नाही.`
                )}
              </div>
            ) : !spotlightApp || spotlightApp.status === 'invited' ? (
              <>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenOfferEditor(`spotlight_${spotlightJob.id}`, spotlightJob.offeredWage)}
                    className="flex-1 min-w-[160px] min-h-[50px] px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold hover:bg-slate-800 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    {tr(lang, 'SEND OFFER', 'ऑफर भेजें (SEND OFFER)', 'ऑफर पाठवा (SEND OFFER)')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenChatJobIds((prev) => ({
                        ...prev,
                        [`spotlight_${spotlightJob.id}`]: !prev[`spotlight_${spotlightJob.id}`],
                      }))
                    }
                    className="flex-1 min-w-[140px] min-h-[50px] px-5 py-2.5 rounded-md border-2 border-[#0B3B75] bg-white text-[#0B3B75] text-sm font-extrabold hover:bg-blue-50 inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{tr(lang, 'CHAT', 'चैट (CHAT)', 'चॅट (CHAT)')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (spotlightApp) {
                        void handleInviteDecision(spotlightApp, 'declined');
                      } else {
                        setDismissedJobIds((prev) => [...prev, spotlightJob.id]);
                      }
                      if (onClearHighlightedJob) onClearHighlightedJob();
                    }}
                    className="min-h-[50px] px-4 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                  >
                    {tr(lang, 'Decline', 'छोड़ें', 'नाकारा')}
                  </button>
                </div>

                {offerDraftTargetId === `spotlight_${spotlightJob.id}` && (
                  <form
                    onSubmit={(e) => handleSubmitOfferForJob(e, spotlightJob, spotlightApp)}
                    className="bg-white border-2 border-[#0B3B75] rounded-md p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {tr(lang, 'Enter Your Price (₹) *', 'अपना दर दर्ज करें (₹) *', 'तुमचा दर टाका (₹) *')}
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={offerPriceInput}
                          onChange={(e) => setOfferPriceInput(e.target.value)}
                          placeholder={tr(lang, 'Enter Your Price (₹)', 'दर (₹)', 'दर (₹)')}
                          className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {tr(
                            lang,
                            'Travel Charges (Optional)',
                            'यात्रा शुल्क (वैकल्पिक)',
                            'प्रवास खर्च (ऐच्छिक)'
                          )}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={offerTravelInput}
                          onChange={(e) => setOfferTravelInput(e.target.value)}
                          placeholder={tr(lang, '0 (Optional)', '0 (वैकल्पिक)', '0 (ऐच्छिक)')}
                          className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {tr(lang, 'Message (Optional)', 'संदेश (वैकल्पिक)', 'संदेश (ऐच्छिक)')}
                      </label>
                      <input
                        type="text"
                        value={offerMsgInput}
                        onChange={(e) => setOfferMsgInput(e.target.value)}
                        placeholder={tr(
                          lang,
                          'Message to customer (optional)',
                          'ग्राहक के लिए संदेश (वैकल्पिक)',
                          'ग्राहकासाठी संदेश (ऐच्छिक)'
                        )}
                        className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busyActionId === (spotlightApp?.id || spotlightJob.id)}
                        className="flex-1 min-h-[48px] px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                      >
                        {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferDraftTargetId(null)}
                        className="min-h-[48px] px-4 py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  </form>
                )}

                {openChatJobIds[`spotlight_${spotlightJob.id}`] && (
                  <OrderChatBox
                    jobId={spotlightJob.id}
                    jobTitle={spotlightJob.title}
                    employerUid={spotlightJob.employerUid}
                    workerUid={user.uid}
                    applicationId={spotlightApp?.id}
                    dealStatus={spotlightJob.dealStatus || 'REQUESTED'}
                    viewerUid={user.uid}
                    viewerRole="worker"
                    viewerName={workerProfile.displayName}
                    counterpartyName={spotlightJob.employerName}
                  />
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-emerald-200 rounded-md p-3">
                  <div className="text-xs sm:text-sm font-bold text-[#0B3B75]">
                    {getVisibleDealStatusLabel(spotlightApp, lang)} ·{' '}
                    <span className="font-mono-tabular text-[#15803D]">
                      ₹{(spotlightApp.agreedPrice ?? spotlightApp.offerAmount ?? spotlightApp.proposedWage).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {spotlightApp.status === 'accepted' && (
                    <button
                      type="button"
                      disabled={busyActionId === spotlightApp.id}
                      onClick={() => handleWorkerCompleteDeal(spotlightApp)}
                      className="min-h-[44px] px-4 py-2 rounded-md bg-[#15803D] text-white text-xs sm:text-sm font-extrabold hover:bg-emerald-800 cursor-pointer"
                    >
                      {tr(lang, 'WORK DONE', 'काम पूरा हुआ (WORK DONE)', 'काम पूर्ण झाले (WORK DONE)')}
                    </button>
                  )}
                </div>
                <DealCoordinationPanel
                  application={spotlightApp}
                  job={spotlightJob}
                  viewerUid={user.uid}
                  viewerRole="worker"
                  viewerName={workerProfile.displayName}
                  defaultExpanded={true}
                />
              </div>
            )}
          </div>
        )}

        {!spotlightJob && incomingInvites.length === 0 && matchingJobs.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            {tr(
              lang,
              `No new customer requests for ${workerProfile.primarySkill} right now. You will be alerted immediately when a customer sends a request.`,
              `अभी ${workerProfile.primarySkill} के लिए कोई नया ग्राहक अनुरोध नहीं है। नया अनुरोध आते ही आपको तुरंत सूचना मिलेगी।`,
              `सध्या ${workerProfile.primarySkill} साठी नवीन ग्राहक विनंती नाही. नवीन विनंती आल्यावर तुम्हाला तात्काळ सूचना मिळेल.`
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Invites First */}
            {incomingInvites
              .filter((app) => app.jobId !== highlightedJobId)
              .map((app) => {
              const job = jobsById[app.jobId];
              const isEditingOffer = offerDraftTargetId === `invite_${app.id}`;
              const inviteApproxLoc = job
                ? getPublicJobLocationText(job, false)
                : app.jobLocationLabel || app.jobDistrict || 'Local area';
              const inviteDistKm = job
                ? calculateValidDistanceKm(job.lat, job.lng, workerProfile.approxLat, workerProfile.approxLng)
                : null;
              const invitePhotos = job ? getJobPhotoUrls(job) : [];
              const mapOpen = Boolean(job && openMapJobIds[`invite_${app.id}`]);
              return (
                <div key={app.id} className="border-2 border-[#E06D1B] bg-amber-50/40 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-[#E06D1B] text-white text-[10px] font-bold">
                        {tr(lang, 'Direct Request', 'सीधा अनुरोध', 'थेट विनंती')} · {getVisibleDealStatusLabel(app, lang)}
                      </span>
                      <h3 className="font-display text-base font-bold text-[#0B3B75] mt-1">{app.jobTitle}</h3>
                      <p className="text-xs font-semibold text-slate-700">
                        {tr(lang, 'Customer:', 'ग्राहक:', 'ग्राहक:')} {app.customerName || job?.employerName || 'Customer'}
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular text-sm font-bold text-[#15803D]">
                      ₹{app.proposedWage.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      <MapPin className="w-3.5 h-3.5 inline text-[#E06D1B] mr-0.5" />
                      {inviteApproxLoc}
                      {inviteDistKm !== null ? ` (~${inviteDistKm} km)` : ''}
                      {(app.jobDate || job?.jobDate) ? ` · ${app.jobDate || job?.jobDate}` : ''}
                      {(app.startTime || job?.startTime) ? ` ${app.startTime || job?.startTime}` : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {job && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMapJobIds((prev) => ({
                              ...prev,
                              [`invite_${app.id}`]: !prev[`invite_${app.id}`],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 bg-white text-[11px] font-semibold text-[#0B3B75] hover:bg-blue-50 cursor-pointer"
                        >
                          <MapPin className="w-3 h-3 text-[#E06D1B]" />
                          <span>
                            {mapOpen
                              ? tr(lang, 'Hide Map', 'मैप बंद', 'मॅप बंद')
                              : tr(lang, 'Approx Map', 'अनुमानित मैप', 'अंदाजे मॅप')}
                          </span>
                        </button>
                      )}
                      {job && (
                        <button
                          type="button"
                          onClick={() => handleListenJobVoice(job)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 bg-white text-[11px] font-semibold text-[#0B3B75] hover:bg-amber-50 cursor-pointer"
                        >
                          {speakingJobId === job.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-[#E06D1B]" />}
                          <span>{speakingJobId === job.id ? 'Stop' : 'Listen'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {app.note && <p className="text-xs text-slate-700 bg-white rounded p-2 border border-amber-200">{app.note}</p>}

                  {invitePhotos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-[#0B3B75] inline-flex items-center gap-1">
                        <Camera className="w-3 h-3 text-[#E06D1B]" />
                        <span>
                          {tr(
                            lang,
                            `Work Photos (${invitePhotos.length})`,
                            `काम के फोटो (${invitePhotos.length})`,
                            `कामाचे फोटो (${invitePhotos.length})`
                          )}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {invitePhotos.map((url, idx) => (
                          <button
                            key={`inv-p-${app.id}-${idx}`}
                            type="button"
                            onClick={() => setLightboxPhotoUrl(url)}
                            className="w-16 h-16 rounded overflow-hidden border border-amber-300 bg-white hover:opacity-90 cursor-pointer"
                          >
                            <img src={url} alt={`Order photo ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {mapOpen && job && <ApproximateJobLocationMap job={job} distanceKm={inviteDistKm} />}

                  {!isEditingOffer ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyActionId === app.id}
                        onClick={() => handleOpenOfferEditor(`invite_${app.id}`, app.proposedWage)}
                        className="flex-1 min-h-[48px] px-4 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                      >
                        {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenChatJobIds((prev) => ({
                            ...prev,
                            [`invite_${app.id}`]: !prev[`invite_${app.id}`],
                          }))
                        }
                        className="min-h-[48px] px-4 py-2.5 rounded-md border-2 border-[#0B3B75] bg-white text-[#0B3B75] text-sm font-extrabold hover:bg-blue-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{tr(lang, 'CHAT', 'चैट', 'चॅट')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === app.id}
                        onClick={() => handleInviteDecision(app, 'declined')}
                        className="min-h-[48px] px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                      >
                        {tr(lang, 'Decline', 'अस्वीकार', 'नाकारा')}
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => handleSubmitOfferForJob(e, job || buildFallbackJobFromApp(app), app)}
                      className="bg-white border-2 border-[#0B3B75] rounded-md p-3 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {tr(lang, 'Enter Your Price (₹) *', 'अपना दर दर्ज करें (₹) *', 'तुमचा दर टाका (₹) *')}
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={offerPriceInput}
                            onChange={(e) => setOfferPriceInput(e.target.value)}
                            placeholder={tr(lang, 'Enter Your Price (₹)', 'दर (₹)', 'दर (₹)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {tr(lang, 'Travel Charges (Optional)', 'यात्रा शुल्क (वैकल्पिक)', 'प्रवास खर्च (ऐच्छिक)')}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={offerTravelInput}
                            onChange={(e) => setOfferTravelInput(e.target.value)}
                            placeholder={tr(lang, '0 (Optional)', '0 (वैकल्पिक)', '0 (ऐच्छिक)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={offerMsgInput}
                        onChange={(e) => setOfferMsgInput(e.target.value)}
                        placeholder={tr(lang, 'Message (Optional)', 'संदेश (वैकल्पिक)', 'संदेश (ऐच्छिक)')}
                        className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyActionId === app.id}
                          className="flex-1 min-h-[46px] px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold cursor-pointer"
                        >
                          {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferDraftTargetId(null)}
                          className="min-h-[46px] px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </form>
                  )}

                  {openChatJobIds[`invite_${app.id}`] && (
                    <OrderChatBox
                      jobId={app.jobId}
                      jobTitle={app.jobTitle}
                      employerUid={app.employerUid}
                      workerUid={user.uid}
                      applicationId={app.id}
                      dealStatus={getEffectiveDealStatus(app)}
                      viewerUid={user.uid}
                      viewerRole="worker"
                      viewerName={workerProfile.displayName}
                      counterpartyName={app.customerName || job?.employerName || 'Customer'}
                    />
                  )}
                </div>
              );
            })}

            {/* Category-Matched Broadcast Hiring Requests */}
            {matchingJobs.map((job) => {
              const isEditingOffer = offerDraftTargetId === `job_${job.id}`;
              const approxLoc = getPublicJobLocationText(job, false);
              const distKm = calculateValidDistanceKm(
                job.lat,
                job.lng,
                workerProfile.approxLat,
                workerProfile.approxLng
              );
              const isSpeaking = speakingJobId === job.id;
              const jobPhotos = getJobPhotoUrls(job);
              const mapOpen = Boolean(openMapJobIds[`job_${job.id}`]);
              return (
                <div key={job.id} className="border border-slate-300 rounded-lg p-4 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-[#0B3B75] text-[10px] font-bold">
                          {job.category} · {getVisibleDealStatusLabel('NEW_ORDER', lang)}
                        </span>
                        {job.orderKind === 'bike_transport' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-[#C25E00] text-[10px] font-bold">
                            <Bike className="w-3 h-3" />
                            {job.transportItemType === 'goods'
                              ? tr(lang, 'Goods', 'सामान', 'सामान')
                              : tr(lang, 'Ride', 'सवारी', 'प्रवास')}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-sm font-bold text-[#0B3B75] mt-1">{job.title}</h3>
                      <p className="text-xs font-semibold text-slate-700">
                        {tr(lang, 'Customer:', 'ग्राहक:', 'ग्राहक:')} {job.employerName}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-[#15803D] shrink-0">
                      ₹{job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{job.description}</p>

                  {job.orderKind === 'bike_transport' &&
                    (job.pickupLocationLabel || job.destinationLocationLabel) && (
                      <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-[11px] text-slate-700 space-y-0.5">
                        {job.pickupLocationLabel && (
                          <p>
                            <strong>{tr(lang, 'Pickup:', 'पिकअप:', 'पिकअप:')}</strong> {job.pickupLocationLabel}
                          </p>
                        )}
                        {job.destinationLocationLabel && (
                          <p>
                            <strong>{tr(lang, 'Destination:', 'गंतव्य:', 'जाण्याचे ठिकाण:')}</strong>{' '}
                            {job.destinationLocationLabel}
                          </p>
                        )}
                      </div>
                    )}

                  {jobPhotos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-[#0B3B75] inline-flex items-center gap-1">
                        <Camera className="w-3 h-3 text-[#E06D1B]" />
                        <span>
                          {tr(
                            lang,
                            `Photos (${jobPhotos.length}) — Tap to Zoom`,
                            `फोटो (${jobPhotos.length}) — ज़ूम करने हेतु टैप करें`,
                            `फोटो (${jobPhotos.length}) — मोठे पाहण्यासाठी टॅप करा`
                          )}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {jobPhotos.map((url, idx) => (
                          <button
                            key={`job-p-${job.id}-${idx}`}
                            type="button"
                            onClick={() => setLightboxPhotoUrl(url)}
                            className="w-16 h-16 rounded overflow-hidden border border-slate-300 bg-slate-50 hover:opacity-90 cursor-pointer"
                          >
                            <img src={url} alt={`Order photo ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                    <span>
                      <MapPin className="w-3 h-3 inline text-[#E06D1B] mr-0.5" />
                      {approxLoc}
                      {distKm !== null ? ` (~${distKm} km)` : ''}
                      {formatRequestDateTime(job) ? ` · ${formatRequestDateTime(job)}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMapJobIds((prev) => ({
                          ...prev,
                          [`job_${job.id}`]: !prev[`job_${job.id}`],
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 bg-blue-50 text-[11px] font-semibold text-[#0B3B75] hover:bg-blue-100 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-[#E06D1B]" />
                      <span>
                        {mapOpen
                          ? tr(lang, 'Hide Map', 'मैप बंद', 'मॅप बंद')
                          : tr(lang, 'Approx Map', 'अनुमानित मैप', 'अंदाजे मॅप')}
                      </span>
                    </button>
                  </div>

                  {mapOpen && <ApproximateJobLocationMap job={job} distanceKm={distKm} />}

                  {!isEditingOffer ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenOfferEditor(`job_${job.id}`, job.offeredWage)}
                        className="flex-1 min-h-[46px] px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                      >
                        {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenChatJobIds((prev) => ({
                            ...prev,
                            [`job_${job.id}`]: !prev[`job_${job.id}`],
                          }))
                        }
                        className="min-h-[46px] px-4 py-2 rounded-md border-2 border-[#0B3B75] bg-white text-[#0B3B75] text-sm font-extrabold hover:bg-blue-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{tr(lang, 'CHAT', 'चैट', 'चॅट')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleListenJobVoice(job)}
                        className="min-h-[46px] inline-flex items-center gap-1 px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-[#0B3B75] hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />}
                        <span>{isSpeaking ? 'Stop' : 'Voice'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedJobIds((prev) => [...prev, job.id])}
                        className="min-h-[46px] px-3 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                      >
                        {tr(lang, 'Decline', 'छोड़ें', 'नाकारा')}
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => handleSubmitOfferForJob(e, job)}
                      className="bg-slate-50 border-2 border-[#0B3B75] rounded-md p-3 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {tr(lang, 'Enter Your Price (₹) *', 'अपना दर दर्ज करें (₹) *', 'तुमचा दर टाका (₹) *')}
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={offerPriceInput}
                            onChange={(e) => setOfferPriceInput(e.target.value)}
                            placeholder={tr(lang, 'Enter Your Price (₹)', 'दर (₹)', 'दर (₹)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular font-bold bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {tr(lang, 'Travel Charges (Optional)', 'यात्रा शुल्क (वैकल्पिक)', 'प्रवास खर्च (ऐच्छिक)')}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={offerTravelInput}
                            onChange={(e) => setOfferTravelInput(e.target.value)}
                            placeholder={tr(lang, '0 (Optional)', '0 (वैकल्पिक)', '0 (ऐच्छिक)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular bg-white"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={offerMsgInput}
                        onChange={(e) => setOfferMsgInput(e.target.value)}
                        placeholder={tr(lang, 'Message (Optional)', 'संदेश (वैकल्पिक)', 'संदेश (ऐच्छिक)')}
                        className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyActionId === job.id}
                          className="flex-1 min-h-[46px] px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold cursor-pointer"
                        >
                          {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferDraftTargetId(null)}
                          className="min-h-[46px] px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </form>
                  )}

                  {openChatJobIds[`job_${job.id}`] && (
                    <OrderChatBox
                      jobId={job.id}
                      jobTitle={job.title}
                      employerUid={job.employerUid}
                      workerUid={user.uid}
                      dealStatus={job.dealStatus || 'REQUESTED'}
                      viewerUid={user.uid}
                      viewerRole="worker"
                      viewerName={workerProfile.displayName}
                      counterpartyName={job.employerName}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Unread Notification Quick Bar (below NEW CUSTOMER REQUEST so top priority stays strictly Customer Request) */}
      {unreadNotificationsCount > 0 && (
        <section className="bg-amber-50 border border-[#E06D1B] rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#E06D1B] shrink-0" />
              <h2 className="font-display text-sm font-bold text-[#0B3B75]">
                {tr(lang, 'Unread Notifications', 'अपठित सूचनाएं', 'न वाचलेल्या सूचना')} ({unreadNotificationsCount})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void markAllNotificationsRead(notifications)}
              className="text-xs font-bold text-[#C25E00] hover:underline cursor-pointer"
            >
              {tr(lang, 'Mark all read', 'सभी पढ़े चिह्नित करें', 'सर्व वाचल्या म्हणून नोंदवा')}
            </button>
          </div>
          <div className="space-y-1.5">
            {notifications
              .filter((n) => !n.read)
              .slice(0, 4)
              .map((n) => (
                <div
                  key={n.id}
                  className="bg-white border border-amber-200 rounded px-3 py-2 flex items-center justify-between gap-3 hover:bg-amber-50/50"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0B3B75]">{n.title}</div>
                    <p className="text-[11px] text-slate-600">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] font-bold text-[#C25E00]">
                      {n.dealStatus
                        ? getVisibleDealStatusLabel(n.dealStatus, lang)
                        : getToneChannelConfig(getToneTypeForEvent(n)).label[lang]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void markNotificationRead(n.id);
                        if (onNavigateToTarget) {
                          onNavigateToTarget('worker-dashboard', n.targetJobId, n.targetDemoJobId);
                        }
                        newRequestSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-extrabold hover:bg-slate-800 cursor-pointer"
                    >
                      OPEN
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Applications, Active Deals, Two-Way Chat & Live Location */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.dashboards.myApplications}</h2>
          <p className="text-xs text-slate-500">
            {tr(
              lang,
              `Default live-location preference: ${workerPrivate?.liveLocationConsent ? 'Opted-in for confirmed bookings' : 'Off by default'}`,
              `लाइव लोकेशन प्राथमिकता: ${workerPrivate?.liveLocationConsent ? 'पुष्ट बुकिंग हेतु सक्षम' : 'डिफ़ॉल्ट रूप से बंद'}`,
              `लाइव्ह लोकेशन प्राधान्य: ${workerPrivate?.liveLocationConsent ? 'निश्चित बुकिंगसाठी संमती' : 'डीफॉल्टनुसार बंद'}`
            )}
          </p>
        </div>

        {applications.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">{t.common.noRecords}</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {applications.map((app) => {
              const dealStatus = getEffectiveDealStatus(app);
              const visibleStage = toVisibleDealStage(app);
              const visibleLabel = getVisibleDealStatusLabel(app, lang);
              const job = jobsById[app.jobId];
              return (
                <div key={app.id} className="py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                        <span
                          className={`px-2 py-0.5 rounded border font-sans font-bold ${getDealStatusBadgeStyle(
                            dealStatus
                          )}`}
                        >
                          {visibleLabel}
                        </span>
                        <span>· ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}</span>
                        {app.travelCharges && app.travelCharges > 0 ? (
                          <span>
                            · +₹{app.travelCharges.toLocaleString('en-IN')}{' '}
                            {tr(lang, 'travel', 'यात्रा', 'प्रवास')}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0B3B75]">{app.jobTitle}</h3>
                      {(app.customerName || job?.employerName) && (
                        <p className="text-xs font-semibold text-slate-700">
                          {tr(lang, 'Customer:', 'ग्राहक:', 'ग्राहक:')} {app.customerName || job?.employerName}
                        </p>
                      )}
                      {visibleStage === 'OFFER_SENT' && (
                        <p className="text-xs font-semibold text-[#C25E00]">
                          {tr(
                            lang,
                            'Waiting for customer to accept your offer.',
                            'ग्राहक द्वारा आपका ऑफर स्वीकार करने की प्रतीक्षा है।',
                            'ग्राहकाने तुमची ऑफर स्वीकारण्याची प्रतीक्षा आहे.'
                          )}
                        </p>
                      )}
                      {(visibleStage === 'OFFER_ACCEPTED' || visibleStage === 'LOCATION_SHARED') && (
                        <p className="text-xs font-bold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 inline-block">
                          {tr(
                            lang,
                            'Offer Accepted! Use Live Location & Chat below.',
                            'ऑफर स्वीकार हो गया! नीचे लाइव लोकेशन व चैट का उपयोग करें।',
                            'ऑफर स्वीकारली गेली! खाली लाइव्ह लोकेशन आणि चॅट वापरा.'
                          )}
                        </p>
                      )}
                      {(app.offerMessage || app.note) && (
                        <p className="text-xs text-slate-600">{app.offerMessage || app.note}</p>
                      )}
                      {isCustomerPhotoVisibleForJobStatus(app.status) ? (
                        <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[11px]">
                          <SecureAvatar
                            name={app.customerName || 'Customer'}
                            acceptedGrantId={buildAcceptedApplicationGrantId(app.id)}
                            sizeClass="w-7 h-7"
                            textSizeClass="text-[10px]"
                          />
                          <span className="font-semibold text-[#0B3B75]">
                            {tr(lang, 'Customer Photo (Confirmed Work)', 'ग्राहक फोटो (पक्का काम)', 'ग्राहक फोटो (निश्चित काम)')}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                          <Lock className="w-3 h-3" />
                          <span>
                            {tr(
                              lang,
                              'Customer photo & exact location stay hidden until offer is accepted',
                              'ऑफर स्वीकार होने तक ग्राहक फोटो व सटीक लोकेशन गोपनीय रहते हैं',
                              'ऑफर स्वीकारेपर्यंत ग्राहकाचा फोटो व अचूक पत्ता गोपनीय राहतात'
                            )}
                          </span>
                        </p>
                      )}
                      {app.status === 'work_completed' && (
                        <p className="text-xs text-[#15803D] font-medium inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" />
                          {tr(lang, 'Rating', 'रेटिंग', 'रेटिंग')}: {app.workerRating || '—'}/5
                          {app.employerFeedback ? ` — “${app.employerFeedback}”` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {app.status === 'invited' && (
                        <>
                          <button
                            type="button"
                            disabled={busyActionId === app.id}
                            onClick={() => handleOpenOfferEditor(`app_inv_${app.id}`, app.proposedWage)}
                            className="min-h-[44px] px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-extrabold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                          >
                            {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                          </button>
                          <button
                            type="button"
                            disabled={busyActionId === app.id}
                            onClick={() => handleInviteDecision(app, 'declined')}
                            className="min-h-[44px] px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                          >
                            {tr(lang, 'Decline', 'अस्वीकार', 'नाकारा')}
                          </button>
                        </>
                      )}

                      {(dealStatus === 'DEAL_CONFIRMED' ||
                        dealStatus === 'OFFER_ACCEPTED' ||
                        dealStatus === 'WORK_IN_PROGRESS') && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerCompleteDeal(app)}
                          className="min-h-[46px] px-5 py-2 rounded-md bg-[#15803D] text-white text-xs sm:text-sm font-extrabold hover:bg-emerald-800 whitespace-nowrap cursor-pointer"
                        >
                          {tr(lang, 'WORK DONE', 'काम पूरा हुआ (WORK DONE)', 'काम पूर्ण झाले (WORK DONE)')}
                        </button>
                      )}

                      {(visibleStage === 'OFFER_SENT' ||
                        visibleStage === 'OFFER_ACCEPTED' ||
                        visibleStage === 'LOCATION_SHARED') && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerCancelDeal(app)}
                          className="min-h-[44px] px-4 py-2 rounded-md border border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap cursor-pointer"
                        >
                          {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
                        </button>
                      )}
                    </div>
                  </div>

                  {app.status === 'invited' && offerDraftTargetId === `app_inv_${app.id}` && (
                    <form
                      onSubmit={(e) => handleSubmitOfferForJob(e, job || buildFallbackJobFromApp(app), app)}
                      className="bg-slate-50 border-2 border-[#0B3B75] rounded-md p-3 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {tr(lang, 'Enter Your Price (₹) *', 'अपना दर दर्ज करें (₹) *', 'तुमचा दर टाका (₹) *')}
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={offerPriceInput}
                            onChange={(e) => setOfferPriceInput(e.target.value)}
                            placeholder={tr(lang, 'Enter Your Price (₹)', 'दर (₹)', 'दर (₹)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular font-bold bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {tr(lang, 'Travel Charges (Optional)', 'यात्रा शुल्क (वैकल्पिक)', 'प्रवास खर्च (ऐच्छिक)')}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={offerTravelInput}
                            onChange={(e) => setOfferTravelInput(e.target.value)}
                            placeholder={tr(lang, '0 (Optional)', '0 (वैकल्पिक)', '0 (ऐच्छिक)')}
                            className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono-tabular bg-white"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={offerMsgInput}
                        onChange={(e) => setOfferMsgInput(e.target.value)}
                        placeholder={tr(lang, 'Message (Optional)', 'संदेश (वैकल्पिक)', 'संदेश (ऐच्छिक)')}
                        className="w-full min-h-[42px] px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyActionId === app.id}
                          className="flex-1 min-h-[44px] px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-extrabold cursor-pointer"
                        >
                          {tr(lang, 'SEND OFFER', 'ऑफर भेजें', 'ऑफर पाठवा')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferDraftTargetId(null)}
                          className="min-h-[44px] px-4 py-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Shared Deal Status Timeline, Two-Way Chat & Two-Way Live Map */}
                  <DealCoordinationPanel
                    application={app}
                    job={job}
                    viewerUid={user.uid}
                    viewerRole="worker"
                    viewerName={workerProfile.displayName}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Worker Profile Summary & Quick Metrics (below Offers & Active Work) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <SecureAvatar
            name={workerProfile.displayName}
            photoDocId={workerProfile.photoDocId || workerPrivate?.photoDocId}
            sizeClass="w-16 h-16"
            textSizeClass="text-xl"
          />
          <div className="space-y-2">
            <p className="text-xs font-mono-tabular font-semibold text-[#C25E00]">
              {t.workerForm.uniqueIdLabel}: {workerProfile.registrationId} · {t.dashboards.profileStatus}:{' '}
              <span
                className={
                  workerProfile.verificationStatus === 'verified'
                    ? 'text-[#15803D]'
                    : workerProfile.verificationStatus === 'suspended'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }
              >
                {verStatusLabel}
              </span>
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0B3B75]">
              {workerProfile.displayName}
            </h2>
            <p className="text-sm text-slate-600">
              {workerProfile.primarySkill} · {workerProfile.cityOrVillage}, {workerProfile.district}, {workerProfile.state} ·{' '}
              <span className="font-mono-tabular font-semibold text-[#0B3B75]">
                ₹{workerProfile.expectedWage.toLocaleString('en-IN')} / {workerProfile.wageUnit}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              {tr(lang, 'Skills', 'कौशल', 'कौशल्ये')}: {workerProfile.skills.join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('register-worker')}
            className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
          >
            {t.workerForm.updateBtn}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('find-work')}
            className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {t.nav.findWork}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#0B3B75]">{applications.length}</div>
          <div className="text-xs text-slate-600 mt-1">{t.dashboards.myApplications}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#15803D]">
            {applications.filter((a) => a.status === 'accepted').length}
          </div>
          <div className="text-xs text-slate-600 mt-1">{tr(lang, 'Active Bookings', 'सक्रिय बुकिंग', 'सक्रिय बुकिंग')}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#0B3B75]">
            {workerProfile.completedJobsCount}
          </div>
          <div className="text-xs text-slate-600 mt-1">{t.impact.metrics.completed}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#C25E00]">
            {workerProfile.ratingAvg > 0 ? workerProfile.ratingAvg.toFixed(1) : '0.0'}
          </div>
          <div className="text-xs text-slate-600 mt-1">{tr(lang, 'Average Rating', 'औसत रेटिंग', 'सरासरी रेटिंग')}</div>
        </div>
      </div>

      {/* Official Digital Registration Card (ID Card & Document Format) */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">
              {tr(lang, 'Digital Worker Registration Card', 'डिजिटल कामगार पंजीकरण कार्ड', 'डिजिटल कामगार नोंदणी कार्ड')}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                lang,
                'Issued under ROJGAR SETU for identification on work requests.',
                'कार्य अवसरों पर पहचान के लिए रोजगार सेतु द्वारा जारी।',
                'कामाच्या ठिकाणी ओळखीसाठी रोजगार सेतु अंतर्गत जारी.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer self-start sm:self-center print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            {tr(lang, 'Print ID Card', 'आईडी कार्ड प्रिंट करें', 'आयडी कार्ड प्रिंट करा')}
          </button>
        </div>

        <div className="max-w-xl rounded-lg border-2 border-[#0B3B75] overflow-hidden bg-white">
          <div className="h-1.5 w-full grid grid-cols-3" aria-hidden="true">
            <div className="bg-[#E06D1B]" />
            <div className="bg-slate-100" />
            <div className="bg-[#15803D]" />
          </div>
          <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
            <RojgarSetuLogo variant="horizontal" className="scale-[0.82] origin-left" />
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {tr(lang, 'Worker ID', 'कामगार आईडी', 'कामगार आयडी')}
              </div>
              <div className="font-mono-tabular text-xs sm:text-sm font-extrabold text-[#0B3B75]">
                {workerProfile.registrationId}
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <SecureAvatar
              name={workerProfile.displayName}
              photoDocId={workerProfile.photoDocId || workerPrivate?.photoDocId}
              sizeClass="w-16 h-16"
              textSizeClass="text-lg"
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs w-full">
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'Name', 'नाम', 'नाव')}</div>
                <div className="font-display text-sm font-bold text-[#0B3B75] mt-0.5">{workerProfile.displayName}</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'Primary Skill', 'मुख्य कौशल', 'मुख्य कौशल्य')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{workerProfile.primarySkill}</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'District & State', 'जिला व राज्य', 'जिल्हा व राज्य')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {workerProfile.cityOrVillage}, {workerProfile.district}, {workerProfile.state}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{t.dashboards.profileStatus}</div>
                <div className="font-semibold text-[#15803D] mt-0.5">{verStatusLabel}</div>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-5 py-2 bg-[#072A54] text-[10px] text-blue-100 flex items-center justify-between">
            <span>ROJGAR SETU · Social-Impact Workforce Platform</span>
            <span>Not a Government ID</span>
          </div>
        </div>
      </section>

      {/* Listed Vehicles & Incoming Auto/Car Bookings (if owner has listed any) */}
      {(ownerVehicles.length > 0 || ownerVehicleBookings.length > 0) && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">
              {tr(lang, 'My Local Transport Listings & Bookings', 'मेरे वाहन एवं बुकिंग', 'माझी लोकल वाहने व बुकिंग')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('register-vehicle')}
              className="text-xs font-semibold text-[#C25E00] hover:underline cursor-pointer"
            >
              + {tr(lang, 'Add Vehicle', 'वाहन जोड़ें', 'वाहन जोडा')}
            </button>
          </div>
          {ownerVehicles.length > 0 && (
            <div className="divide-y divide-slate-200">
              {ownerVehicles.map((v) => (
                <div key={v.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-[#0B3B75]">{v.vehicleTitle}</span>{' '}
                    <span className="font-mono-tabular text-slate-500">({v.vehicleNumberMasked})</span> · ₹{v.ratePerKm}/km
                  </div>
                  <select
                    value={v.availabilityStatus}
                    onChange={(e) =>
                      updateVehicleAvailability(v.id, e.target.value as VehicleListing['availabilityStatus'])
                    }
                    className="px-2.5 py-1 border border-slate-300 rounded text-xs font-semibold bg-white self-start sm:self-center"
                  >
                    <option value="available">{tr(lang, 'Available', 'उपलब्ध', 'उपलब्ध')}</option>
                    <option value="busy">{tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')}</option>
                    <option value="offline">{tr(lang, 'Offline', 'ऑफलाइन', 'ऑफलाइन')}</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          {ownerVehicleBookings.length > 0 && (
            <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
              {ownerVehicleBookings.map((b) => (
                <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-mono-tabular text-slate-500">
                      <strong className="uppercase text-[#0B3B75]">{b.status}</strong> · {b.travelDate} {b.travelTime} · ₹{b.offeredFare}
                    </div>
                    <div className="font-bold text-slate-800">{b.customerName}: {b.pickupLocation} → {b.dropLocation}</div>
                  </div>
                  <div className="flex gap-2">
                    {b.status === 'requested' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVehicleBookingDecision(b, 'accepted')}
                          className="px-2.5 py-1 rounded bg-[#15803D] text-white font-semibold cursor-pointer"
                        >
                          {t.dashboards.acceptBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVehicleBookingDecision(b, 'declined')}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                        >
                          {t.dashboards.declineBtn}
                        </button>
                      </>
                    )}
                    {b.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => handleVehicleBookingDecision(b, 'completed')}
                        className="px-2.5 py-1 rounded bg-[#0B3B75] text-white font-semibold cursor-pointer"
                      >
                        {tr(lang, 'Complete', 'पूर्ण', 'पूर्ण')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <UserNotificationCenter
        mode="worker"
        onNavigateToTarget={onNavigateToTarget || ((r) => onNavigate(r))}
        highlightedDemoJobId={highlightedDemoJobId}
        onClearHighlightedDemoJob={onClearHighlightedDemoJob}
      />

      {lightboxPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[88vh] bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhotoUrl(null)}
              className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900 cursor-pointer"
              aria-label="Close photo"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhotoUrl}
              alt="Customer uploaded work photo"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   2. EMPLOYER DASHBOARD
============================================================================ */

interface EmployerDashboardProps {
  jobs: JobPosting[];
  workers?: PublicWorkerProfile[];
  notifications?: AppNotificationRecord[];
  unreadNotificationsCount?: number;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
  onNavigateToTarget?: (route: PageRoute, jobId?: string, demoJobId?: string) => void;
  highlightedJobId?: string;
  onClearHighlightedJob?: () => void;
}

export const EmployerDashboardView: React.FC<EmployerDashboardProps> = ({
  jobs,
  workers = [],
  notifications = [],
  unreadNotificationsCount = 0,
  onNavigate,
  onNavigateToTarget,
  highlightedJobId = '',
  onClearHighlightedJob,
}) => {
  const { lang, t } = useLanguage();
  const { user, authReady, employerProfile, employerPrivate, customerPreference, signInWithGoogle } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [orderMessages, setOrderMessages] = useState<DealMessage[]>([]);
  const [customerVehicleBookings, setCustomerVehicleBookings] = useState<VehicleBooking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandingJobId, setExpandingJobId] = useState<string | null>(null);
  const [completingAppId, setCompletingAppId] = useState<string | null>(null);
  const [ratingVal, setRatingVal] = useState<number>(5);
  const [feedbackVal, setFeedbackVal] = useState('');
  const [postRatings, setPostRatings] = useState<Record<string, number>>({});
  const [postFeedbacks, setPostFeedbacks] = useState<Record<string, string>>({});
  const [gpsUpdating, setGpsUpdating] = useState(false);
  const [locNotice, setLocNotice] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [chatOpenCounters, setChatOpenCounters] = useState<Record<string, number>>({});
  const [openPreOfferChats, setOpenPreOfferChats] = useState<Record<string, boolean>>({});
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState<string | null>(null);
  const customerOrdersRef = useRef<HTMLElement | null>(null);
  const syncedPhotoGrantsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.emailVerified) {
      setApplications([]);
      setOrderMessages([]);
      setCustomerVehicleBookings([]);
      return;
    }
    const u1 = subscribeEmployerApplications(user.uid, setApplications);
    const u2 = subscribeCustomerVehicleBookings(user.uid, setCustomerVehicleBookings);
    const u3 = subscribeAllCustomerOrderMessages(user.uid, setOrderMessages);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid, user?.emailVerified]);

  const jobsById = useMemo(() => {
    const mapObj: Record<string, JobPosting> = {};
    jobs.forEach((j) => {
      mapObj[j.id] = j;
    });
    return mapObj;
  }, [jobs]);

  const workersByUid = useMemo(() => {
    const mapObj: Record<string, PublicWorkerProfile> = {};
    workers.forEach((w) => {
      if (w.ownerUid) mapObj[w.ownerUid] = w;
      if (w.id) mapObj[w.id] = w;
    });
    return mapObj;
  }, [workers]);

  // Idempotently grant accepted workers access to customer's private photo (including worker-accepted invites)
  useEffect(() => {
    if (!user?.emailVerified || !employerPrivate?.photoDocId) return;
    const customerPhotoDocId = employerPrivate.photoDocId;
    for (const app of applications) {
      if (isCustomerPhotoVisibleForJobStatus(app.status)) {
        const key = `${app.id}:${customerPhotoDocId}:${app.workerUid}`;
        if (syncedPhotoGrantsRef.current.has(key)) continue;
        syncedPhotoGrantsRef.current.add(key);
        void grantAcceptedCustomerPhoto({
          customerUid: user.uid,
          workerUid: app.workerUid,
          sourceType: 'job_application',
          sourceId: app.id,
          customerPhotoDocId,
        }).catch(() => {
          syncedPhotoGrantsRef.current.delete(key);
        });
      }
    }
  }, [user?.uid, user?.emailVerified, employerPrivate?.photoDocId, applications]);

  const myJobs = useMemo(
    () => (user ? jobs.filter((j) => j.employerUid === user.uid) : []),
    [jobs, user]
  );

  const applicationsByJobId = useMemo(() => {
    const grouped: Record<string, JobApplication[]> = {};
    const statusWeight = (status: JobApplication['status']) => {
      if (status === 'accepted') return 0;
      if (status === 'applied') return 1;
      if (status === 'invited') return 2;
      if (status === 'work_completed') return 3;
      return 4;
    };
    applications.forEach((app) => {
      if (!grouped[app.jobId]) grouped[app.jobId] = [];
      grouped[app.jobId].push(app);
    });
    Object.keys(grouped).forEach((jid) => {
      grouped[jid].sort((a, b) => statusWeight(a.status) - statusWeight(b.status));
    });
    return grouped;
  }, [applications]);

  const preOfferChatsByJobId = useMemo(() => {
    const grouped: Record<
      string,
      Array<{ workerUid: string; workerName: string; lastMessage: string; count: number }>
    > = {};
    const perJobWorker: Record<
      string,
      Record<string, { workerUid: string; workerName: string; lastMessage: string; count: number }>
    > = {};

    orderMessages.forEach((msg) => {
      if (!msg.jobId || !msg.workerUid) return;
      const existingApps = applicationsByJobId[msg.jobId] || [];
      if (existingApps.some((a) => a.workerUid === msg.workerUid)) return;
      if (!perJobWorker[msg.jobId]) perJobWorker[msg.jobId] = {};
      const workerInfo = workersByUid[msg.workerUid];
      const existing = perJobWorker[msg.jobId][msg.workerUid];
      const resolvedName =
        workerInfo?.displayName ||
        (msg.senderRole === 'worker' ? msg.senderName : existing?.workerName || 'Worker');
      perJobWorker[msg.jobId][msg.workerUid] = {
        workerUid: msg.workerUid,
        workerName: resolvedName,
        lastMessage: msg.text,
        count: (existing?.count || 0) + 1,
      };
    });

    Object.entries(perJobWorker).forEach(([jid, workerMap]) => {
      grouped[jid] = Object.values(workerMap);
    });
    return grouped;
  }, [orderMessages, applicationsByJobId, workersByUid]);

  const unifiedOrders = useMemo(() => {
    const seenJobIds = new Set<string>();
    const entries: Array<{
      jobId: string;
      job?: JobPosting;
      apps: JobApplication[];
      preOfferChats: Array<{ workerUid: string; workerName: string; lastMessage: string; count: number }>;
    }> = [];

    myJobs.forEach((job) => {
      seenJobIds.add(job.id);
      entries.push({
        jobId: job.id,
        job,
        apps: applicationsByJobId[job.id] || [],
        preOfferChats: preOfferChatsByJobId[job.id] || [],
      });
    });

    Object.keys(applicationsByJobId).forEach((jid) => {
      if (seenJobIds.has(jid)) return;
      seenJobIds.add(jid);
      entries.push({
        jobId: jid,
        job: jobsById[jid],
        apps: applicationsByJobId[jid] || [],
        preOfferChats: preOfferChatsByJobId[jid] || [],
      });
    });

    const isOrderActive = (entry: (typeof entries)[number]) => {
      if (entry.job && (entry.job.status === 'open' || entry.job.status === 'in_progress')) {
        return true;
      }
      return entry.apps.some(
        (a) => a.status === 'applied' || a.status === 'accepted' || a.status === 'invited'
      );
    };

    entries.sort((a, b) => {
      if (highlightedJobId) {
        const aHit = a.jobId === highlightedJobId ? 1 : 0;
        const bHit = b.jobId === highlightedJobId ? 1 : 0;
        if (aHit !== bHit) return bHit - aHit;
      }
      const aActive = isOrderActive(a) ? 1 : 0;
      const bActive = isOrderActive(b) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aHasOffers = a.apps.length + a.preOfferChats.length > 0 ? 1 : 0;
      const bHasOffers = b.apps.length + b.preOfferChats.length > 0 ? 1 : 0;
      if (aHasOffers !== bHasOffers) return bHasOffers - aHasOffers;
      return 0;
    });

    return entries;
  }, [myJobs, applicationsByJobId, preOfferChatsByJobId, jobsById, highlightedJobId]);

  const hasCustomerUser = Boolean(user);
  const unifiedOrderCount = unifiedOrders.length;

  useEffect(() => {
    if (!highlightedJobId || !hasCustomerUser) return;
    const timer = window.setTimeout(() => {
      customerOrdersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [highlightedJobId, hasCustomerUser, unifiedOrderCount]);

  const frequentStats = useMemo(() => {
    const hireOrders = Math.max(customerPreference?.totalHireOrders ?? 0, myJobs.length);
    const transportOrders = Math.max(
      customerPreference?.totalTransportOrders ?? 0,
      customerVehicleBookings.length
    );

    const workerCats = [...(customerPreference?.frequentWorkerCategories ?? [])];
    myJobs.forEach((j) => {
      if (j.category && !workerCats.includes(j.category)) workerCats.push(j.category);
    });

    const vehicleTypes = [...(customerPreference?.frequentVehicleTypes ?? [])] as VehicleType[];
    customerVehicleBookings.forEach((b) => {
      if (b.vehicleType && !vehicleTypes.includes(b.vehicleType)) {
        vehicleTypes.push(b.vehicleType);
      }
    });

    const latestOrderTitle =
      customerPreference?.lastOrderTitle ||
      myJobs[0]?.title ||
      customerVehicleBookings[0]?.vehicleTitle ||
      '';

    return {
      hireOrders,
      transportOrders,
      totalOrders: hireOrders + transportOrders,
      workerCats: workerCats.slice(0, 6),
      vehicleTypes: vehicleTypes.slice(0, 6),
      latestOrderTitle,
    };
  }, [customerPreference, myJobs, customerVehicleBookings]);

  const customerDisplayName =
    employerProfile?.businessName || user?.displayName || user?.email?.split('@')[0] || 'Customer';

  const handleUpdateSavedGps = async () => {
    if (!user?.emailVerified) return;
    setGpsUpdating(true);
    setLocNotice('');
    try {
      const geo = await detectBestGpsLocation(lang);
      const label = [geo.cityOrVillage, geo.district, geo.state].filter(Boolean).join(', ');
      await saveCustomerDefaultLocation(user.uid, {
        state: geo.state,
        district: geo.district,
        cityOrVillage: geo.cityOrVillage || geo.district,
        lat: geo.lat,
        lng: geo.lng,
        savedAddressLabel: geo.formattedAddress || label,
      });
      setLocNotice(
        geo.isApproximate
          ? tr(
              lang,
              `Approximate IP/Wi-Fi location saved (${label}). Refine inside Hire Now -> Map Pin if needed.`,
              `अनुमानित लोकेशन सहेजी गई (${label})। आवश्यकता हो तो मानचित्र पिन से सुधारें।`,
              `अंदाजे लोकेशन जतन केले (${label}). गरज असल्यास मॅप पिनने अचूक करा.`
            )
          : tr(
              lang,
              `Accurate GPS location pinned to your profile (${label}).`,
              `सटीक GPS लोकेशन प्रोफ़ाइल में सहेजी गई (${label})।`,
              `तुमच्या प्रोफाईलवर अचूक GPS पत्ता जतन केला (${label}).`
            )
      );
    } catch {
      setLocNotice(
        tr(
          lang,
          'Could not read device GPS. Allow location permission or set pin in Hire Now.',
          'GPS प्राप्त नहीं हो सका। लोकेशन अनुमति दें या मानचित्र पिन सेट करें।',
          'GPS मिळू शकले नाही. लोकेशन परवानगी द्या किंवा हायर पेजवर पिन निवडा.'
        )
      );
    } finally {
      setGpsUpdating(false);
    }
  };

  const handleConfirmWorkOffer = async (app: JobApplication) => {
    if (!user || busyId === app.id || app.status === 'accepted' || app.status === 'work_completed') return;
    unlockAudioOnUserGesture();
    setBusyId(app.id);
    setActionNotice('');
    try {
      const jobLoc = app.jobLocationLabel || jobsById[app.jobId]?.workLocationLabel || jobsById[app.jobId]?.district || '';
      await confirmWorkOffer({
        app,
        customerName: customerDisplayName,
        jobLocationLabel: jobLoc,
        photoGrantContext: employerPrivate?.photoDocId
          ? {
              customerUid: user.uid,
              workerUid: app.workerUid,
              customerPhotoDocId: employerPrivate.photoDocId,
            }
          : undefined,
      });
      void playNotificationTone('deal_accepted');
      setActionNotice(
        tr(
          lang,
          `Offer accepted with ${app.workerName}! Both sides notified — tap "SHARE LOCATION" below so the worker can navigate to you.`,
          `${app.workerName} का ऑफर स्वीकार हो गया! दोनों को सूचना भेजी गई है — अब नीचे "लोकेशन साझा करें" पर टैप करें।`,
          `${app.workerName} ची ऑफर स्वीकारली! दोघांनाही सूचना पाठवली आहे — आता खाली "लोकेशन शेअर करा" वर टॅप करा.`
        )
      );
    } catch (err) {
      setActionNotice(
        err instanceof Error
          ? err.message
          : tr(
              lang,
              'Could not accept this offer. Another worker may already be confirmed for this order.',
              'यह ऑफर स्वीकार नहीं हो सका। संभव है इस ऑर्डर के लिए दूसरा कामगार पहले ही चुना गया हो।',
              'ही ऑफर स्वीकारता आली नाही. या ऑर्डरसाठी दुसरा कामगार आधीच निश्चित झाला असू शकतो.'
            )
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitPostCompletionRating = async (e: React.FormEvent, app: JobApplication) => {
    e.preventDefault();
    if (!user) return;
    const chosenRating = postRatings[app.id] ?? 5;
    const chosenFeedback = (postFeedbacks[app.id] || '').trim();
    setBusyId(app.id);
    setActionNotice('');
    try {
      await submitCustomerRating({
        app,
        customerUid: user.uid,
        customerName: customerDisplayName,
        rating: chosenRating,
        feedback: chosenFeedback || undefined,
      });
      setActionNotice(
        tr(
          lang,
          `Thank you! Saved ${chosenRating}/5 rating for ${app.workerName}.`,
          `धन्यवाद! ${app.workerName} के लिए ${chosenRating}/5 रेटिंग सहेजी गई।`,
          `धन्यवाद! ${app.workerName} साठी ${chosenRating}/5 रेटिंग जतन केली आहे.`
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomerCancelDeal = async (app: JobApplication) => {
    if (!user) return;
    setBusyId(app.id);
    try {
      await cancelDeal({
        app,
        actorUid: user.uid,
        actorRole: 'customer',
        actorName: customerDisplayName,
      });
      void playNotificationTone('deal_cancelled');
      setActionNotice(tr(lang, 'Work cancelled and live location stopped.', 'काम रद्द और लाइव लोकेशन बंद।', 'काम रद्द केले आणि लाइव्ह लोकेशन बंद केले.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkCompleted = async (e: React.FormEvent, app: JobApplication) => {
    e.preventDefault();
    if (!user) return;
    setBusyId(app.id);
    try {
      await completeDeal({
        app,
        actorUid: user.uid,
        actorRole: 'customer',
        actorName: customerDisplayName,
        rating: ratingVal,
        feedback: feedbackVal.trim() || undefined,
        photoGrantContext: employerPrivate?.photoDocId
          ? {
              customerUid: user.uid,
              workerUid: app.workerUid,
              customerPhotoDocId: employerPrivate.photoDocId,
            }
          : undefined,
      });
      setCompletingAppId(null);
      setFeedbackVal('');
      setRatingVal(5);
      void playNotificationTone('deal_completed');
      setActionNotice(
        tr(
          lang,
          'Work marked completed! Rating saved and live location sharing automatically stopped.',
          'कार्य पूर्ण! रेटिंग सहेजी गई और लाइव लोकेशन बंद कर दी गई।',
          'काम पूर्ण झाले! रेटिंग जतन झाली व लाइव्ह लोकेशन बंद केले.'
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateJobStatus = async (job: JobPosting, nextStatus: 'completed' | 'cancelled') => {
    if (job.status === 'completed' || job.status === 'cancelled') return;
    setBusyId(job.id);
    try {
      await updateDoc(doc(db, 'jobs', job.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `jobs/${job.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleExpandJobRadius = async (job: JobPosting) => {
    setExpandingJobId(job.id);
    setActionNotice('');
    try {
      const currentKm = normalizeRadiusKm(job.currentRadiusKm ?? job.initialRadiusKm ?? 5, 5);
      const nextKm = getNextRadiusStage(currentKm);
      if (!nextKm) return;

      const result = await expandJobSearchRadius({
        job,
        workers,
        targetRadiusKm: nextKm as ServiceRadiusKm,
      });

      setActionNotice(
        tr(
          lang,
          `Expanded search radius for "${job.title}" to ${result.currentRadiusKm} km (${result.newlyNotifiedCount} additional worker(s) alerted, ${result.totalNotifiedCount} total notified).`,
          `"${job.title}" का दायरा ${result.currentRadiusKm} किमी किया गया (${result.newlyNotifiedCount} नए कामगारों को सूचना मिली)।`,
          `"${job.title}" साठी शोध परिसर ${result.currentRadiusKm} किमी केला (${result.newlyNotifiedCount} नवीन कामगारांना सूचना पाठवली).`
        )
      );
    } finally {
      setExpandingJobId(null);
    }
  };

  const handleExportEmployerReport = () => {
    downloadCsv(
      `rojgar-setu-employer-${employerProfile?.registrationId || 'report'}.csv`,
      ['Job Title', 'Worker Name', 'Worker ID', 'Primary Skill', 'Proposed Wage', 'Status', 'Rating'],
      applications.map((a) => [
        a.jobTitle,
        a.workerName,
        a.workerRegistrationId,
        a.workerPrimarySkill,
        a.proposedWage,
        a.status,
        a.workerRating ?? '',
      ])
    );
  };

  if (!authReady) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
          <h1 className="font-display text-xl font-bold text-[#0B3B75]">
            {tr(lang, 'Loading Your Orders & Worker Offers...', 'आपके ऑर्डर और ऑफर लोड हो रहे हैं...', 'तुमच्या ऑर्डर आणि ऑफर लोड होत आहेत...')}
          </h1>
          <p className="text-xs text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#0B3B75] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.employerTitle}</h1>
          <p className="text-sm text-slate-600">{t.common.signInRequired}</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {t.nav.signIn}
          </button>
        </div>
      </div>
    );
  }

  if (
    !employerProfile &&
    !customerPreference &&
    myJobs.length === 0 &&
    applications.length === 0 &&
    customerVehicleBookings.length === 0
  ) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.employerTitle}</h1>
          <p className="text-sm text-slate-600">
            {tr(
              lang,
              'Hire verified local workers directly in one step, or register your company/contractor unit.',
              'तुरंत एक चरण में सत्यापित स्थानीय कामगार हायर करें, या अपना व्यवसाय पंजीकृत करें।',
              'तात्काळ एका पायरीत स्थानिक कामगार हायर करा किंवा तुमचा व्यवसाय नोंदवा.'
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('hire')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#E06D1B] text-white text-sm font-semibold hover:bg-[#c55b10] cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {tr(lang, 'Hire Workers Now', 'तुरंत कामगार हायर करें', 'तात्काळ कामगार हायर करा')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register-employer')}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              {t.nav.employerReg}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const verStatusLabel = employerProfile
    ? employerProfile.verificationStatus === 'verified'
      ? t.common.verified
      : employerProfile.verificationStatus === 'suspended'
      ? t.common.suspended
      : t.common.pending
    : tr(lang, 'Instant Hire Customer', 'त्वरित हायर ग्राहक', 'तात्काळ हायर ग्राहक');

  const savedLocDisplay =
    customerPreference?.savedAddressLabel ||
    [
      customerPreference?.defaultCityOrVillage,
      customerPreference?.defaultDistrict,
      customerPreference?.defaultState,
    ]
      .filter(Boolean)
      .join(', ');

  const pendingOffersCount = applications.filter((a) => a.status === 'applied').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {actionNotice && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {actionNotice}
        </div>
      )}

      {/* PRIORITY #1 TOP SECTION: Customer Orders (1. Job Details -> 2. Uploaded Work Photos -> 3. Received Worker Offers -> 4. CHAT -> 5. ACCEPT OFFER -> 6. SHARE LOCATION after acceptance) */}
      <section
        id="customer-active-orders"
        ref={customerOrdersRef}
        className="bg-white border-2 border-[#0B3B75] rounded-lg p-5 sm:p-6 space-y-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
              {tr(
                lang,
                'MY ORDERS & WORKER OFFERS',
                'मेरे ऑर्डर व कामगार ऑफर',
                'माझ्या ऑर्डर्स व कामगार ऑफर्स'
              )}{' '}
              ({unifiedOrders.length})
            </h1>
            {pendingOffersCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-[#C25E00] text-xs font-bold">
                {pendingOffersCount}{' '}
                {tr(lang, 'offer(s) awaiting acceptance', 'ऑफर स्वीकृति बाकी', 'ऑफर स्वीकृती बाकी')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {highlightedJobId && onClearHighlightedJob && (
              <button
                type="button"
                onClick={onClearHighlightedJob}
                className="px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {tr(lang, 'Show All Orders', 'सभी ऑर्डर दिखाएं', 'सर्व ऑर्डर्स पहा')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('hire')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#E06D1B] text-white text-xs font-extrabold hover:bg-[#c55b10] cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              {tr(lang, 'Hire', 'हायर करें', 'हायर करा')}
            </button>
          </div>
        </div>

        {unifiedOrders.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-slate-600">
              {tr(
                lang,
                'You have no service orders yet. Click "Hire" to request a worker and upload optional work photos.',
                'अभी तक आपका कोई सेवा ऑर्डर नहीं है। कामगार बुलाने के लिए "हायर करें" पर क्लिक करें।',
                'अद्याप तुमची कोणतीही सेवा ऑर्डर नाही. कामगार बोलवण्यासाठी "हायर करा" वर क्लिक करा.'
              )}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('hire')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#E06D1B] text-white text-sm font-extrabold hover:bg-[#c55b10] cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {tr(lang, 'Hire', 'हायर करें', 'हायर करा')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {unifiedOrders.map(({ jobId, job, apps: jobApps, preOfferChats }) => {
              const firstApp = jobApps[0];
              const isHighlighted = Boolean(highlightedJobId && jobId === highlightedJobId);
              const photoUrls = job ? getJobPhotoUrls(job) : [];
              const dateTimeText = formatRequestDateTime(job, firstApp);
              const approxAreaText = job
                ? getPublicJobLocationText(job)
                : firstApp?.jobLocationLabel || '';
              const currentRadiusKm = job
                ? normalizeRadiusKm(job.currentRadiusKm ?? job.initialRadiusKm ?? 5, 5)
                : null;
              const nextRadiusKm = currentRadiusKm ? getNextRadiusStage(currentRadiusKm) : null;
              const notifiedCount = Array.isArray(job?.notifiedWorkerUids)
                ? job.notifiedWorkerUids.length
                : 0;
              const isSingleWorkerJob = (job?.workersRequired || 1) <= 1;

              return (
                <article
                  key={jobId}
                  className={`rounded-lg border-2 p-4 sm:p-5 space-y-4 ${
                    isHighlighted
                      ? 'border-[#E06D1B] bg-amber-50/40 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* 1. CUSTOMER'S JOB DETAILS */}
                  <div className="space-y-2 border-b border-slate-200 pb-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {isHighlighted && (
                            <span className="px-2 py-0.5 rounded bg-[#E06D1B] text-white text-[11px] font-extrabold uppercase tracking-wide">
                              {tr(lang, 'OPENED ORDER', 'खोला गया ऑर्डर', 'उघडलेली ऑर्डर')}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-[#0B3B75] text-white font-bold">
                            {job?.category || firstApp?.workerPrimarySkill || 'Service'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono-tabular uppercase font-bold text-[#0B3B75]">
                            {job?.status || (firstApp?.status === 'work_completed' ? 'completed' : 'active')}
                          </span>
                          {dateTimeText && (
                            <span className="font-mono-tabular text-slate-600 font-semibold">
                              · {dateTimeText}
                            </span>
                          )}
                          {currentRadiusKm !== null && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0B3B75] font-mono-tabular font-bold">
                              Radius: {currentRadiusKm} km · {notifiedCount}{' '}
                              {tr(lang, 'alerted', 'सूचित', 'सूचित')}
                            </span>
                          )}
                        </div>

                        <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                          {job?.title || firstApp?.jobTitle || 'Service Request'}
                        </h2>

                        {job?.description && (
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {job.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                          {approxAreaText && (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                              {approxAreaText}
                            </span>
                          )}
                          {job && (
                            <span className="font-mono-tabular font-semibold text-slate-700">
                              {tr(lang, 'Budget:', 'बजट:', 'बजेट:')} ₹
                              {job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit} ·{' '}
                              {job.workersRequired} {t.jobs.workersUnit}
                            </span>
                          )}
                        </div>
                      </div>

                      {job && job.status === 'open' && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {nextRadiusKm && (
                            <button
                              type="button"
                              disabled={expandingJobId === job.id}
                              onClick={() => void handleExpandJobRadius(job)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] disabled:opacity-60 cursor-pointer"
                            >
                              <Radar className="w-3.5 h-3.5" />
                              <span>
                                {expandingJobId === job.id
                                  ? tr(lang, 'Expanding...', 'बढ़ा रहे हैं...', 'वाढवत आहे...')
                                  : tr(
                                      lang,
                                      `Expand Radius → ${nextRadiusKm} km`,
                                      `दायरा बढ़ाएं → ${nextRadiusKm} किमी`,
                                      `परिसर वाढवा → ${nextRadiusKm} किमी`
                                    )}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => handleUpdateJobStatus(job, 'completed')}
                            className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                          >
                            {tr(lang, 'Mark Completed', 'पूर्ण चिह्नित करें', 'पूर्ण नोंदवा')}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => handleUpdateJobStatus(job, 'cancelled')}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {t.common.cancel}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. UPLOADED WORK PHOTOS (Clickable Fullscreen Zoom) */}
                  {photoUrls.length > 0 && (
                    <div className="space-y-2 border-b border-slate-200 pb-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0B3B75]">
                        <Camera className="w-4 h-4 text-[#E06D1B]" />
                        <span>
                          {tr(
                            lang,
                            `Uploaded Work Photos (${photoUrls.length})`,
                            `अपलोड की गई कार्य फ़ोटो (${photoUrls.length})`,
                            `अपलोड केलेले कामाचे फोटो (${photoUrls.length})`
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {photoUrls.map((photoUrl, idx) => (
                          <button
                            key={`${jobId}-photo-${idx}`}
                            type="button"
                            onClick={() => setLightboxPhotoUrl(photoUrl)}
                            className="group relative aspect-square rounded-md overflow-hidden border border-slate-300 bg-slate-100 hover:border-[#0B3B75] cursor-pointer"
                          >
                            <img
                              src={photoUrl}
                              alt={`Work photo ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-bold">
                              {idx + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. RECEIVED WORKER OFFERS + PRE-OFFER WORKER CHATS */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#0B3B75]">
                        {tr(
                          lang,
                          `Received Worker Offers (${jobApps.length})`,
                          `प्राप्त कामगार ऑफर (${jobApps.length})`,
                          `आलेल्या कामगार ऑफर्स (${jobApps.length})`
                        )}
                      </h3>
                      {preOfferChats.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-bold text-[#0B3B75]">
                          {preOfferChats.length}{' '}
                          {tr(
                            lang,
                            'worker chat(s) before offer',
                            'ऑफर से पहले कामगार चैट',
                            'ऑफरपूर्वीचे कामगार चॅट'
                          )}
                        </span>
                      )}
                    </div>

                    {/* Pre-Offer Worker Chat Threads (workers who asked questions before sending an offer) */}
                    {preOfferChats.length > 0 && (
                      <div className="space-y-2.5">
                        {preOfferChats.map((chatInfo) => {
                          const wInfo = workersByUid[chatInfo.workerUid];
                          const chatKey = `${jobId}:${chatInfo.workerUid}`;
                          const isChatOpen = Boolean(openPreOfferChats[chatKey]);
                          return (
                            <div
                              key={chatKey}
                              className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2.5"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <SecureAvatar
                                    name={chatInfo.workerName}
                                    photoDocId={wInfo?.photoDocId}
                                    sizeClass="w-10 h-10"
                                    textSizeClass="text-xs"
                                  />
                                  <div className="space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <span className="font-bold text-[#0B3B75]">
                                        {chatInfo.workerName}
                                      </span>
                                      {wInfo?.primarySkill && (
                                        <span className="text-slate-600 font-medium">
                                          · {wInfo.primarySkill}
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-[#0B3B75]">
                                        {tr(
                                          lang,
                                          `${chatInfo.count} msg(s) · Pre-Offer Chat`,
                                          `${chatInfo.count} संदेश · ऑफर-पूर्व चैट`,
                                          `${chatInfo.count} संदेश · ऑफरपूर्वी चॅट`
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700">“{chatInfo.lastMessage}”</p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenPreOfferChats((prev) => ({
                                      ...prev,
                                      [chatKey]: !prev[chatKey],
                                    }))
                                  }
                                  className="min-h-[42px] px-4 py-2 rounded-md border-2 border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-extrabold hover:bg-blue-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer self-start sm:self-center"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  <span>
                                    {isChatOpen
                                      ? tr(lang, 'HIDE CHAT', 'चैट छुपाएं', 'चॅट लपवा')
                                      : tr(lang, 'CHAT', 'चैट', 'चॅट')}
                                  </span>
                                </button>
                              </div>

                              {isChatOpen && (
                                <OrderChatBox
                                  jobId={jobId}
                                  jobTitle={job?.title || 'Service Request'}
                                  employerUid={user.uid}
                                  workerUid={chatInfo.workerUid}
                                  dealStatus={job?.dealStatus || 'REQUESTED'}
                                  viewerUid={user.uid}
                                  viewerRole="customer"
                                  viewerName={customerDisplayName}
                                  counterpartyName={chatInfo.workerName}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Submitted Worker Offers & Active Deals */}
                    {jobApps.length === 0 ? (
                      preOfferChats.length === 0 && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-3">
                          {tr(
                            lang,
                            'Waiting for nearby registered workers in this category to send offers or start chat...',
                            'इस श्रेणी के नज़दीकी पंजीकृत कामगारों के ऑफर या चैट संदेश की प्रतीक्षा है...',
                            'या श्रेणीतील जवळच्या नोंदणीकृत कामगारांच्या ऑफर किंवा चॅट संदेशाची प्रतीक्षा आहे...'
                          )}
                        </p>
                      )
                    ) : (
                      <div className="space-y-3">
                        {jobApps.map((app) => {
                          const dealStatus = getEffectiveDealStatus(app);
                          const visibleStage = toVisibleDealStage(app);
                          const visibleLabel = getVisibleDealStatusLabel(app, lang);
                          const workerInfo = workersByUid[app.workerUid];
                          const distKm = calculateValidDistanceKm(
                            job?.lat ?? customerPreference?.defaultLat,
                            job?.lng ?? customerPreference?.defaultLng,
                            workerInfo?.approxLat,
                            workerInfo?.approxLng
                          );
                          const anotherWorkerAlreadyAccepted =
                            isSingleWorkerJob &&
                            Boolean(job?.acceptedApplicationId) &&
                            job?.acceptedApplicationId !== app.id;
                          const selectedPostRating = postRatings[app.id] ?? 5;

                          return (
                            <div
                              key={app.id}
                              className={`rounded-lg border p-3.5 sm:p-4 space-y-3 ${
                                app.status === 'accepted'
                                  ? 'border-emerald-300 bg-emerald-50/30'
                                  : 'border-slate-200 bg-slate-50/40'
                              }`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <SecureAvatar
                                    name={app.workerName}
                                    photoDocId={app.workerPhotoDocId || workerInfo?.photoDocId}
                                    sizeClass="w-12 h-12"
                                    textSizeClass="text-sm"
                                  />
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                                      <span className="font-sans font-semibold text-slate-700">
                                        {app.workerPrimarySkill}
                                      </span>
                                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                                        <Star className="w-3.5 h-3.5 text-amber-500" />
                                        {workerInfo && workerInfo.ratingAvg > 0
                                          ? `${workerInfo.ratingAvg.toFixed(1)}/5`
                                          : tr(lang, 'New', 'नया', 'नवीन')}
                                        {workerInfo && workerInfo.completedJobsCount > 0
                                          ? ` (${workerInfo.completedJobsCount} ${tr(lang, 'done', 'पूर्ण', 'पूर्ण')})`
                                          : ''}
                                      </span>
                                      {distKm !== null && (
                                        <span className="inline-flex items-center gap-0.5 font-semibold text-[#0B3B75]">
                                          <MapPin className="w-3 h-3 text-[#E06D1B]" />
                                          ~{distKm} km
                                        </span>
                                      )}
                                      {workerInfo && (
                                        <span
                                          className={`px-2 py-0.5 rounded font-sans text-[10px] font-bold ${
                                            workerInfo.availabilityStatus === 'available'
                                              ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                              : workerInfo.availabilityStatus === 'busy'
                                              ? 'bg-amber-50 text-[#C25E00] border border-amber-200'
                                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                                          }`}
                                        >
                                          {workerInfo.availabilityStatus === 'available'
                                            ? tr(lang, 'Available Now', 'उपलब्ध', 'उपलब्ध')
                                            : workerInfo.availabilityStatus === 'busy'
                                            ? tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')
                                            : tr(lang, 'Offline', 'ऑफ़लाइन', 'ऑफलाइन')}
                                        </span>
                                      )}
                                      <span
                                        className={`px-2 py-0.5 rounded border font-sans font-bold ${getDealStatusBadgeStyle(
                                          dealStatus
                                        )}`}
                                      >
                                        {visibleLabel}
                                      </span>
                                    </div>
                                    <h4 className="font-display text-base font-bold text-[#0B3B75]">
                                      {app.workerName}
                                    </h4>
                                    <p className="text-xs text-slate-600">
                                      {app.agreedPrice
                                        ? tr(lang, 'Accepted Price', 'स्वीकृत दर', 'स्वीकारलेला दर')
                                        : tr(lang, 'Offered Price', 'प्रस्तावित दर', 'ऑफर दर')}
                                      :{' '}
                                      <strong className="font-mono-tabular text-sm text-[#15803D]">
                                        ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}
                                      </strong>
                                      {app.travelCharges && app.travelCharges > 0 ? (
                                        <span className="font-mono-tabular text-slate-700 font-semibold">
                                          {' '}
                                          + ₹{app.travelCharges.toLocaleString('en-IN')}{' '}
                                          {tr(lang, 'travel', 'यात्रा शुल्क', 'प्रवास खर्च')}
                                        </span>
                                      ) : null}
                                      {(app.offerMessage || app.note) ? ` · “${app.offerMessage || app.note}”` : ''}
                                    </p>
                                  </div>
                                </div>

                                {/* 4. CHAT & 5. ACCEPT OFFER (plus WORK DONE / Cancel after acceptance) */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {(app.status === 'applied' || app.status === 'invited') && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setChatOpenCounters((prev) => ({
                                            ...prev,
                                            [app.id]: (prev[app.id] || 0) + 1,
                                          }))
                                        }
                                        className="min-h-[46px] px-4 py-2 rounded-md border-2 border-[#0B3B75] bg-white text-[#0B3B75] text-sm font-extrabold hover:bg-blue-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        <span>{tr(lang, 'CHAT', 'चैट', 'चॅट')}</span>
                                      </button>
                                      {app.status === 'applied' &&
                                        (anotherWorkerAlreadyAccepted ? (
                                          <span className="px-3 py-2 rounded-md bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-600">
                                            {tr(
                                              lang,
                                              'Worker Already Selected',
                                              'कामगार पहले ही चुना जा चुका है',
                                              'कामगार आधीच निवडला आहे'
                                            )}
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={busyId === app.id}
                                            onClick={() => void handleConfirmWorkOffer(app)}
                                            className="min-h-[46px] px-5 py-2 rounded-md bg-[#15803D] text-white text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                                          >
                                            {busyId === app.id
                                              ? tr(lang, 'Accepting...', 'स्वीकार हो रहा है...', 'स्वीकारत आहे...')
                                              : tr(lang, 'ACCEPT OFFER', 'ऑफर स्वीकारें', 'ऑफर स्वीकारा')}
                                          </button>
                                        ))}
                                    </>
                                  )}

                                  {(visibleStage === 'OFFER_ACCEPTED' || visibleStage === 'LOCATION_SHARED') &&
                                    completingAppId !== app.id && (
                                      <button
                                        type="button"
                                        onClick={() => setCompletingAppId(app.id)}
                                        className="min-h-[46px] px-4 py-2 rounded-md bg-[#15803D] text-white text-xs font-extrabold hover:bg-emerald-800 whitespace-nowrap cursor-pointer"
                                      >
                                        {tr(lang, 'WORK DONE & RATE', 'काम पूर्ण व रेटिंग', 'काम पूर्ण व रेटिंग')}
                                      </button>
                                    )}

                                  {(visibleStage === 'OFFER_ACCEPTED' || visibleStage === 'LOCATION_SHARED') && (
                                    <button
                                      type="button"
                                      disabled={busyId === app.id}
                                      onClick={() => void handleCustomerCancelDeal(app)}
                                      className="min-h-[46px] px-4 py-2 rounded-md border border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap cursor-pointer"
                                    >
                                      {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
                                    </button>
                                  )}

                                  {app.status === 'work_completed' && typeof app.workerRating === 'number' && (
                                    <span className="px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-300 text-xs font-bold text-[#15803D] inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      {tr(lang, 'COMPLETED', 'पूर्ण', 'पूर्ण')} · ★ {app.workerRating}/5
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Customer 1-5 Star Rating Form shown automatically after WORK DONE */}
                              {app.status === 'work_completed' && typeof app.workerRating !== 'number' && (
                                <form
                                  onSubmit={(e) => handleSubmitPostCompletionRating(e, app)}
                                  className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-4 space-y-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-extrabold text-[#0B3B75]">
                                        {tr(
                                          lang,
                                          `Work Done! Rate ${app.workerName}`,
                                          `काम पूर्ण हुआ! ${app.workerName} को रेटिंग दें`,
                                          `काम पूर्ण झाले! ${app.workerName} ला रेटिंग द्या`
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-600">
                                        {tr(
                                          lang,
                                          'Select 1 to 5 stars and optional feedback to save on the worker profile.',
                                          'कामगार के प्रोफ़ाइल पर सहेजने के लिए 1 से 5 स्टार और वैकल्पिक फीडबैक दें।',
                                          'कामगाराच्या प्रोफाईलवर जतन करण्यासाठी 1 ते 5 स्टार आणि ऐच्छिक अभिप्राय द्या.'
                                        )}
                                      </p>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded bg-[#0B3B75] text-white text-[11px] font-bold">
                                      {tr(lang, 'COMPLETED', 'पूर्ण', 'पूर्ण')}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((starNum) => (
                                      <button
                                        key={`star-${app.id}-${starNum}`}
                                        type="button"
                                        onClick={() =>
                                          setPostRatings((prev) => ({ ...prev, [app.id]: starNum }))
                                        }
                                        className={`min-h-[42px] px-3 py-1.5 rounded-md border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                                          selectedPostRating >= starNum
                                            ? 'bg-amber-400 border-amber-500 text-[#072A54]'
                                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        <Star className="w-3.5 h-3.5" />
                                        <span>{starNum}</span>
                                      </button>
                                    ))}
                                    <span className="text-xs font-bold text-[#0B3B75] ml-1">
                                      {selectedPostRating} / 5
                                    </span>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      type="text"
                                      value={postFeedbacks[app.id] || ''}
                                      onChange={(e) =>
                                        setPostFeedbacks((prev) => ({ ...prev, [app.id]: e.target.value }))
                                      }
                                      placeholder={tr(
                                        lang,
                                        'Optional feedback about work quality...',
                                        'काम की गुणवत्ता के बारे में वैकल्पिक फीडबैक...',
                                        'कामाच्या गुणवत्तेबद्दल ऐच्छिक अभिप्राय...'
                                      )}
                                      className="flex-1 min-h-[44px] px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                                    />
                                    <button
                                      type="submit"
                                      disabled={busyId === app.id}
                                      className="min-h-[44px] px-5 py-2 rounded-md bg-[#15803D] text-white text-xs sm:text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                                    >
                                      {busyId === app.id
                                        ? tr(lang, 'Saving...', 'सहेजा जा रहा है...', 'जतन करत आहे...')
                                        : tr(lang, 'SUBMIT RATING', 'रेटिंग सबमिट करें', 'रेटिंग सबमिट करा')}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {app.status === 'work_completed' && app.employerFeedback && (
                                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                                  <strong>{tr(lang, 'Your Feedback:', 'आपकी प्रतिक्रिया:', 'तुमचा अभिप्राय:')}</strong> “{app.employerFeedback}”
                                </p>
                              )}

                              {completingAppId === app.id && (
                                <form
                                  onSubmit={(e) => handleMarkCompleted(e, app)}
                                  className="bg-white border border-slate-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                                >
                                  <div className="sm:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                      {t.dashboards.ratingLabel}
                                    </label>
                                    <select
                                      value={ratingVal}
                                      onChange={(e) => setRatingVal(Number(e.target.value))}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                                    >
                                      {[5, 4, 3, 2, 1].map((n) => (
                                        <option key={n} value={n}>{n} / 5</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="sm:col-span-6">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                      {t.dashboards.feedbackLabel}
                                    </label>
                                    <input
                                      type="text"
                                      value={feedbackVal}
                                      onChange={(e) => setFeedbackVal(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                                    />
                                  </div>
                                  <div className="sm:col-span-3 flex gap-2">
                                    <button
                                      type="submit"
                                      disabled={busyId === app.id}
                                      className="flex-1 py-2 px-3 rounded-md bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                                    >
                                      {t.common.save}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCompletingAppId(null)}
                                      className="py-2 px-3 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                                    >
                                      {t.common.cancel}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {/* 6. WORK STATUS, UNIFIED CHAT & POST-ACCEPTANCE SHARE LOCATION ONLY */}
                              <DealCoordinationPanel
                                application={app}
                                job={job}
                                viewerUid={user.uid}
                                viewerRole="customer"
                                viewerName={customerDisplayName}
                                forceChatOpenKey={chatOpenCounters[app.id] || 0}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Unread Notification Quick Bar (below Orders so Customer's Order & Offers stay at top) */}
      {unreadNotificationsCount > 0 && (
        <section className="bg-amber-50 border border-[#E06D1B] rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#E06D1B] shrink-0" />
              <h2 className="font-display text-sm font-bold text-[#0B3B75]">
                {tr(lang, 'Unread Worker Offers & Alerts', 'अपठित कामगार ऑफर व सूचनाएं', 'न वाचलेले ऑफर व सूचना')} ({unreadNotificationsCount})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void markAllNotificationsRead(notifications)}
              className="text-xs font-bold text-[#C25E00] hover:underline cursor-pointer"
            >
              {tr(lang, 'Mark all read', 'सभी पढ़े चिह्नित करें', 'सर्व वाचल्या म्हणून नोंदवा')}
            </button>
          </div>
          <div className="space-y-1.5">
            {notifications
              .filter((n) => !n.read)
              .slice(0, 4)
              .map((n) => (
                <div
                  key={n.id}
                  className="bg-white border border-amber-200 rounded px-3 py-2 flex items-center justify-between gap-3 hover:bg-amber-50/50"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0B3B75]">{n.title}</div>
                    <p className="text-[11px] text-slate-600">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] font-bold text-[#C25E00]">
                      {n.dealStatus
                        ? getVisibleDealStatusLabel(n.dealStatus, lang)
                        : getToneChannelConfig(getToneTypeForEvent(n)).label[lang]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void markNotificationRead(n.id);
                        if (onNavigateToTarget) {
                          onNavigateToTarget('employer-dashboard', n.targetJobId, n.targetDemoJobId);
                        }
                        customerOrdersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-extrabold hover:bg-slate-800 cursor-pointer"
                    >
                      OPEN
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Customer Profile Header (Normal Hiring Only — No Bike/Transport Hire buttons) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <SecureAvatar
            name={employerProfile?.businessName || user.displayName || 'Customer'}
            photoDocId={employerPrivate?.photoDocId}
            sizeClass="w-16 h-16"
            textSizeClass="text-xl"
          />
          <div className="space-y-1.5">
            <p className="text-xs font-mono-tabular font-semibold text-[#C25E00]">
              {employerProfile ? `ID: ${employerProfile.registrationId} · ` : ''}
              {t.dashboards.profileStatus}:{' '}
              <span
                className={
                  employerProfile?.verificationStatus === 'verified'
                    ? 'text-[#15803D]'
                    : employerProfile?.verificationStatus === 'suspended'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }
              >
                {verStatusLabel}
              </span>
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
              {employerProfile?.businessName || user.displayName || user.email}
            </h2>
            <p className="text-sm text-slate-600">
              {employerProfile
                ? `${employerProfile.businessType} · ${employerProfile.industryCategory} · ${employerProfile.district}, ${employerProfile.state}`
                : tr(
                    lang,
                    'Instant Hire Customer · Active Bookings & Worker Responses',
                    'त्वरित हायर ग्राहक · सक्रिय बुकिंग एवं कामगार प्रतिक्रिया',
                    'तात्काळ हायर ग्राहक · सक्रिय बुकिंग व कामगारांचे प्रतिसाद'
                  )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('hire')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#E06D1B] text-white text-sm font-semibold hover:bg-[#c55b10] cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {tr(lang, 'Hire Workers', 'कामगार हायर करें', 'कामगार हायर करा')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('post-job')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t.jobs.postTitle}
          </button>
          {employerProfile && (
            <button
              type="button"
              onClick={() => onNavigate('register-employer')}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
            >
              {tr(lang, 'Update Profile / Photo', 'प्रोफ़ाइल / फोटो बदलें', 'प्रोफाईल / फोटो बदला')}
            </button>
          )}
          <button
            type="button"
            onClick={handleExportEmployerReport}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {t.dashboards.exportCsv}
          </button>
        </div>
      </div>

      {/* Saved Location & 1-Click Re-Hire (Normal Worker Services Only) */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#0B3B75] px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-white border-b-2 border-[#E06D1B]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-300" />
            <h2 className="font-display text-sm sm:text-base font-bold">
              {tr(
                lang,
                'Saved Location & 1-Click Re-Hire',
                'सहेजा गया पता व 1-क्लिक री-हायर',
                'जतन केलेला पत्ता व १-क्लिक पुन्हा हायर'
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono-tabular">
            <span className="px-2 py-0.5 rounded bg-white/15 text-amber-200 font-bold">
              {frequentStats.totalOrders}{' '}
              {tr(lang, 'Orders', 'ऑर्डर', 'ऑर्डर')}
            </span>
            {frequentStats.totalOrders >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#15803D] text-white font-bold">
                <BookmarkCheck className="w-3.5 h-3.5" />
                {tr(lang, 'Frequent Customer', 'नियमित ग्राहक', 'नियमित ग्राहक')}
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {tr(lang, 'Saved Work Location', 'सहेजा गया कार्य पता', 'जतन केलेला कामाचा पत्ता')}
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B3B75]">
                <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0" />
                <span>
                  {savedLocDisplay ||
                    tr(
                      lang,
                      'No default GPS location saved yet',
                      'अभी तक कोई डिफ़ॉल्ट GPS पता नहीं सहेजा गया',
                      'अद्याप डीफॉल्ट GPS पत्ता जतन केलेला नाही'
                    )}
                </span>
              </div>
              {frequentStats.latestOrderTitle && (
                <p className="text-xs text-slate-600">
                  {tr(lang, 'Last Order:', 'पिछला ऑर्डर:', 'शेवटची ऑर्डर:')}{' '}
                  <strong className="text-slate-800">{frequentStats.latestOrderTitle}</strong>
                </p>
              )}
            </div>

            <div className="md:col-span-5 flex flex-wrap md:justify-end gap-2">
              <button
                type="button"
                disabled={gpsUpdating}
                onClick={handleUpdateSavedGps}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 bg-slate-50 text-xs font-bold text-[#0B3B75] hover:bg-slate-100 cursor-pointer disabled:opacity-60"
              >
                <Crosshair className="w-3.5 h-3.5 text-[#15803D]" />
                {gpsUpdating
                  ? tr(lang, 'Detecting GPS...', 'GPS खोज रहे हैं...', 'GPS शोधत आहे...')
                  : tr(lang, 'Update GPS Pin', 'GPS लोकेशन अपडेट करें', 'GPS पत्ता अपडेट करा')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('hire')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {tr(lang, 'Hire Worker', 'कामगार हायर', 'कामगार हायर')}
              </button>
            </div>
          </div>

          {locNotice && (
            <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-xs font-medium text-[#0B3B75]">
              {locNotice}
            </div>
          )}

          {frequentStats.workerCats.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {tr(lang, 'Frequently Hired Workers (1-Click Re-Hire):', 'अक्सर हायर किए जाने वाले कामगार:', 'वारंवार हायर केलेले कामगार (पुन्हा ऑर्डर):')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {frequentStats.workerCats.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onNavigate('hire', cat)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-50 border border-amber-300 text-xs font-bold text-[#0B3B75] hover:bg-amber-100 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-[#E06D1B]" />
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Official Digital Employer Registration Certificate (when registered as formal employer) */}
      {employerProfile && (
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">
              {tr(lang, 'Employer Registration Certificate', 'नियोक्ता पंजीकरण प्रमाणपत्र', 'नियोक्ता नोंदणी प्रमाणपत्र')}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                lang,
                'Verified digital identification for ROJGAR SETU job postings and workforce outreach.',
                'रोजगार सेतु पर कार्य पोस्टिंग के लिए डिजिटल पहचान प्रमाण।',
                'रोजगार सेतुवर कामाच्या जाहिरातींसाठी डिजिटल ओळख प्रमाणपत्र.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer self-start sm:self-center print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            {tr(lang, 'Print Certificate', 'प्रमाणपत्र प्रिंट करें', 'प्रमाणपत्र प्रिंट करा')}
          </button>
        </div>

        <div className="max-w-xl rounded-lg border-2 border-[#0B3B75] overflow-hidden bg-white">
          <div className="h-1.5 w-full grid grid-cols-3" aria-hidden="true">
            <div className="bg-[#E06D1B]" />
            <div className="bg-slate-100" />
            <div className="bg-[#15803D]" />
          </div>
          <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
            <RojgarSetuLogo variant="horizontal" className="scale-[0.82] origin-left" />
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {tr(lang, 'Employer ID', 'नियोक्ता आईडी', 'नियोक्ता आयडी')}
              </div>
              <div className="font-mono-tabular text-xs sm:text-sm font-extrabold text-[#0B3B75]">
                {employerProfile.registrationId}
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <SecureAvatar
              name={employerProfile.businessName}
              photoDocId={employerPrivate?.photoDocId}
              sizeClass="w-14 h-14"
              textSizeClass="text-base"
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs w-full">
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'Organisation / Business', 'संस्था / व्यवसाय', 'संस्था / व्यवसाय')}</div>
                <div className="font-display text-sm font-bold text-[#0B3B75] mt-0.5">{employerProfile.businessName}</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'Category', 'श्रेणी', 'श्रेणी')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {employerProfile.businessType} · {employerProfile.industryCategory}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{tr(lang, 'Location', 'स्थान', 'ठिकाण')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {employerProfile.district}, {employerProfile.state}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">{t.dashboards.profileStatus}</div>
                <div className="font-semibold text-[#15803D] mt-0.5">{verStatusLabel}</div>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-5 py-2 bg-[#072A54] text-[10px] text-blue-100 flex items-center justify-between">
            <span>ROJGAR SETU · Social-Impact Workforce Platform</span>
            <span>Not a Government Document</span>
          </div>
        </div>
      </section>
      )}

      {/* Existing Vehicle Bookings (shown ONLY if customer actually has standalone transport bookings) */}
      {customerVehicleBookings.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'Existing Vehicle Bookings', 'मौजूदा वाहन बुकिंग', 'असलेली वाहन बुकिंग')} ({customerVehicleBookings.length})
          </h2>
          <div className="divide-y divide-slate-200">
            {customerVehicleBookings.map((b) => (
              <div key={b.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-mono-tabular text-slate-500">
                    <strong className="uppercase text-[#0B3B75]">{b.status}</strong> ·{' '}
                    <span className="text-[#0B3B75] font-semibold">{getVehicleTypeLabel(b.vehicleType, lang)}</span> ·{' '}
                    {b.travelDate} {b.travelTime} ·{' '}
                    <span className="font-bold text-[#15803D]">₹{b.offeredFare.toLocaleString('en-IN')}</span>
                  </p>
                  <h3 className="font-display text-base font-bold text-[#0B3B75]">{b.vehicleTitle}</h3>
                  <p className="text-xs text-slate-600">
                    {b.pickupLocation} → {b.dropLocation} · {b.tripType.replace('_', ' ')} ({b.passengersCount} pax)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status === 'requested' && (
                    <button
                      type="button"
                      onClick={() => updateVehicleBookingStatus(b.id, 'cancelled')}
                      className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {t.common.cancel}
                    </button>
                  )}
                  {b.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() => updateVehicleBookingStatus(b.id, 'completed')}
                      className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                    >
                      {tr(lang, 'Mark Completed', 'पूर्ण चिह्नित करें', 'पूर्ण म्हणून नोंदवा')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <UserNotificationCenter
        mode="employer"
        onNavigateToTarget={onNavigateToTarget || ((r) => onNavigate(r))}
      />

      {lightboxPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[88vh] bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhotoUrl(null)}
              className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900 cursor-pointer"
              aria-label="Close photo"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhotoUrl}
              alt="Customer uploaded work photo"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   3. ADMIN PANEL
============================================================================ */

interface AdminDashboardProps {
  workers: PublicWorkerProfile[];
  employers: PublicEmployerProfile[];
  jobs: JobPosting[];
  announcements: PlatformAnnouncement[];
  onNavigate?: (route: PageRoute) => void;
}

type AdminTab =
  | 'workers'
  | 'employers'
  | 'shopkeepers'
  | 'jobs'
  | 'professions'
  | 'categories'
  | 'advertisements'
  | 'referrals'
  | 'notifications'
  | 'grievances'
  | 'enquiries'
  | 'announcements'
  | 'audit';

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({
  workers,
  employers,
  jobs,
  announcements,
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, isAdmin, signInWithGoogle } = useAuth();

  const [tab, setTab] = useState<AdminTab>('workers');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [enquiries, setEnquiries] = useState<PartnershipEnquiry[]>([]);
  const [grievances, setGrievances] = useState<GrievanceReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [employerPrivateMap, setEmployerPrivateMap] = useState<Record<string, EmployerPrivateInfo>>({});
  const [workerPayments, setWorkerPayments] = useState<WorkerRegistrationPayment[]>([]);
  const [adminReferrals, setAdminReferrals] = useState<WorkerReferralRecord[]>([]);
  const [adminRewards, setAdminRewards] = useState<ReferralRewardRecord[]>([]);
  const [adminCustomProfessions, setAdminCustomProfessions] = useState<CustomProfessionRecord[]>([]);
  const [referralConfig, setReferralConfig] = useState<PlatformReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [workerApprovalMessage, setWorkerApprovalMessage] = useState('');
  const [grievanceNotes, setGrievanceNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // New Announcement form state
  const [titleEn, setTitleEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [titleMr, setTitleMr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyHi, setBodyHi] = useState('');
  const [bodyMr, setBodyMr] = useState('');
  const [annError, setAnnError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeAllApplicationsAdmin(setApplications);
    const u2 = subscribeAdminEnquiries(setEnquiries);
    const u3 = subscribeAdminGrievances(setGrievances);
    const u4 = subscribeAdminAuditLogs(setAuditLogs);
    const u5 = subscribeAdminFinanceData({
      onPayments: setWorkerPayments,
      onWithdrawals: () => undefined,
      onLedger: () => undefined,
    });
    const u6 = subscribeAdminReferralsData({
      onReferrals: setAdminReferrals,
      onRewards: setAdminRewards,
      onPayouts: () => undefined,
    });
    const u7 = subscribeReferralConfig(setReferralConfig);
    const u8 = subscribeAllProfessionsAdmin(setAdminCustomProfessions);
    let mounted = true;
    void adminFetchAllEmployerPrivate().then((map) => {
      if (mounted) setEmployerPrivateMap(map);
    });
    return () => {
      mounted = false;
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
    };
  }, [isAdmin]);

  const pendingCustomProfessionsCount = useMemo(
    () => adminCustomProfessions.filter((p) => p.status === 'pending').length,
    [adminCustomProfessions]
  );

  const paymentByWorkerUid = useMemo(() => {
    const map: Record<string, WorkerRegistrationPayment> = {};
    for (const p of workerPayments) {
      map[p.workerUid] = p;
    }
    return map;
  }, [workerPayments]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <Shield className="w-8 h-8 text-[#0B3B75] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.adminTitle}</h1>
          <p className="text-sm text-slate-600">{t.common.signInRequired}</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {t.nav.signIn}
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-red-200 rounded-lg p-8 text-center space-y-3">
          <Lock className="w-8 h-8 text-red-700 mx-auto" />
          <h1 className="font-display text-xl font-bold text-[#0B3B75]">{t.dashboards.adminTitle}</h1>
          <p className="text-sm text-slate-600">
            {tr(
              lang,
              'Access restricted to authorized ROJGAR SETU platform administrators.',
              'यह पृष्ठ केवल अधिकृत रोजगार सेतु प्रशासकों के लिए आरक्षित है।',
              'हे पान केवळ अधिकृत रोजगार सेतु प्रशासकांसाठी राखीव आहे.'
            )}
          </p>
        </div>
      </div>
    );
  }

  const adminEmail = user.email || 'admin@rojgarsetu';

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnError('');
    if (
      titleEn.trim().length < 2 ||
      titleHi.trim().length < 2 ||
      titleMr.trim().length < 2 ||
      bodyEn.trim().length < 2 ||
      bodyHi.trim().length < 2 ||
      bodyMr.trim().length < 2
    ) {
      setAnnError(
        tr(
          lang,
          'Please enter title and message in all three languages (English, Hindi, Marathi).',
          'कृपया तीनों भाषाओं (अंग्रेजी, हिंदी, मराठी) में शीर्षक और संदेश भरें।',
          'कृपया तीनही भाषांमध्ये (इंग्रजी, हिंदी, मराठी) शीर्षक व संदेश भरा.'
        )
      );
      return;
    }
    setBusyId('create-ann');
    try {
      await adminCreateAnnouncement(
        {
          titleEn: titleEn.trim(),
          titleHi: titleHi.trim(),
          titleMr: titleMr.trim(),
          bodyEn: bodyEn.trim(),
          bodyHi: bodyHi.trim(),
          bodyMr: bodyMr.trim(),
          active: true,
        },
        user.uid,
        adminEmail
      );
      setTitleEn('');
      setTitleHi('');
      setTitleMr('');
      setBodyEn('');
      setBodyHi('');
      setBodyMr('');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <BrandSloganBanner variant="dashboard" />

      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#C25E00]">ROJGAR SETU · Governance Console</p>
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">{t.dashboards.adminTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-mono-tabular">
          <div className="px-3 py-2 rounded border border-slate-200 bg-slate-50">
            Workers: <strong>{workers.length}</strong>
          </div>
          <div className="px-3 py-2 rounded border border-slate-200 bg-slate-50">
            Employers: <strong>{employers.length}</strong>
          </div>
          <div className="px-3 py-2 rounded border border-slate-200 bg-slate-50">
            Jobs: <strong>{jobs.length}</strong>
          </div>
          <div className="px-3 py-2 rounded border border-slate-200 bg-slate-50">
            Applications: <strong>{applications.length}</strong>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'workers', label: `Workers (${workers.length})`, icon: Users },
            { id: 'employers', label: `Employers (${employers.length})`, icon: Briefcase },
            { id: 'shopkeepers', label: 'Shopkeepers (₹500)', icon: Store },
            { id: 'jobs', label: `Jobs (${jobs.length})`, icon: FileText },
            {
              id: 'professions',
              label:
                pendingCustomProfessionsCount > 0
                  ? `Professions & Custom Skills (${pendingCustomProfessionsCount} Pending)`
                  : `Professions & Custom Skills (${adminCustomProfessions.length})`,
              icon: PlusCircle,
            },
            { id: 'categories', label: `Services & Radius (${SERVICE_CATALOG_V2.length})`, icon: Radar },
            { id: 'advertisements', label: 'Advertisement Management', icon: Megaphone },
            { id: 'referrals', label: 'Payments, Referrals & Finance', icon: Gift },
            { id: 'notifications', label: '📲 Live Notification Demo', icon: BellRing },
            { id: 'grievances', label: `${t.dashboards.grievances} (${grievances.length})`, icon: AlertTriangle },
            { id: 'enquiries', label: `${t.dashboards.enquiries} (${enquiries.length})`, icon: Shield },
            { id: 'announcements', label: `${t.dashboards.announcements} (${announcements.length})`, icon: Megaphone },
            { id: 'audit', label: `${t.dashboards.auditLogs} (${auditLogs.length})`, icon: CheckCircle2 },
          ] as { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((item) => {
          const Icon = item.icon;
          const isHighlight =
            item.id === 'shopkeepers' ||
            item.id === 'professions' ||
            item.id === 'notifications' ||
            item.id === 'advertisements' ||
            item.id === 'referrals';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                tab === item.id
                  ? isHighlight
                    ? 'bg-[#E06D1B] text-white'
                    : 'bg-[#0B3B75] text-white'
                  : isHighlight
                  ? 'bg-amber-50 border border-amber-300 text-[#C25E00] hover:bg-amber-100'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'shopkeepers' && <AdminShopkeepersPanel />}

      {tab === 'professions' && <AdminProfessionsPanel />}

      {tab === 'advertisements' && <AdminAdsManagementPanel />}

      {tab === 'referrals' && <AdminReferralsPanel />}

      {tab === 'notifications' && (
        <AdminNotificationDemoPanel workers={workers} employers={employers} />
      )}

      {tab === 'categories' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                Service Categories, Subcategories &amp; Matching Radius
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Progressive nearby matching starts at <strong>2 km</strong>, expands to <strong>5 km</strong>, and reaches <strong>10 km</strong>. Bike Rider / Transport stays isolated from general service orders.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-[#15803D]">Stage 1: 2 km</span>
              <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-[#C25E00]">Stage 2: 5 km</span>
              <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0B3B75]">Stage 3: 10 km</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICE_CATALOG_V2.map((cat) => (
              <div
                key={cat.id}
                className="rounded-lg border border-slate-200 p-4 space-y-2.5 bg-slate-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProfessionThumbnail
                      id={cat.id}
                      label={cat.en}
                      hint={`${cat.en} ${cat.canonicalCategory}`}
                      size="sm"
                      accentBg={cat.accentBg}
                      accentBorder={cat.accentBorder}
                      accentText={cat.accentText}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[#0B3B75] truncate">
                        {cat.en}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {cat.mr} · {cat.hi}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-[#15803D] shrink-0">
                    Worker Quote
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  DB Category: <span className="font-semibold text-slate-800">{cat.canonicalCategory}</span>
                  {cat.isTransport && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-[#C25E00] font-semibold">
                      Separate Flow
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cat.subServices.map((sub) => (
                    <span
                      key={sub.id}
                      className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                    >
                      {sub.en}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {tab === 'workers' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                ROJGAR SETU — Registered Workers
              </h2>
              <p className="text-xs text-slate-500">
                Review ₹250 Razorpay payment status and approve registrations to generate Worker ID Card &amp; Registration Certificate.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-workers.csv',
                  ['Registration ID', 'Name', 'Primary Skill', 'State', 'District', 'Wage', '₹250 Payment Status', 'Payment ID', 'Approval Status'],
                  workers.map((w) => {
                    const pay = paymentByWorkerUid[w.id];
                    const payStatus = pay?.status || w.registrationPaymentStatus || 'pending';
                    return [
                      w.registrationId,
                      w.displayName,
                      w.primarySkill,
                      w.state,
                      w.district,
                      w.expectedWage,
                      payStatus === 'verified' ? 'PAID' : payStatus.toUpperCase(),
                      pay?.gatewayPaymentId || pay?.utrOrGatewayRef || '',
                      w.verificationStatus,
                    ];
                  })
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.dashboards.exportCsv}
            </button>
          </div>
          {workerApprovalMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-[#15803D] flex items-center justify-between gap-2">
              <span>{workerApprovalMessage}</span>
              <button
                type="button"
                onClick={() => setWorkerApprovalMessage('')}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {workers.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Primary Skill</th>
                    <th className="py-2 pr-4">District</th>
                    <th className="py-2 pr-4">₹250 Fee Status</th>
                    <th className="py-2 pr-4">Availability</th>
                    <th className="py-2 pr-4">Approval Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((w) => {
                    const isAvailable = (w.availabilityStatus || 'available') !== 'offline';
                    const pay = paymentByWorkerUid[w.id];
                    const effectivePayStatus = pay?.status || w.registrationPaymentStatus || 'pending';
                    const paymentIdRef = pay?.gatewayPaymentId || pay?.utrOrGatewayRef || '';
                    const isPaidAwaitingAdmin =
                      effectivePayStatus === 'verified' &&
                      (w.verificationStatus !== 'verified' || !w.paidBenefitsActive);
                    return (
                    <tr key={w.id}>
                      <td className="py-3 pr-4 font-mono-tabular text-xs">{w.registrationId}</td>
                      <td className="py-3 pr-4 font-semibold text-[#0B3B75]">
                        <div className="flex items-center gap-2.5">
                          <SecureAvatar
                            name={w.displayName}
                            photoDocId={w.photoDocId}
                            sizeClass="w-8 h-8"
                            textSizeClass="text-[11px]"
                          />
                          <span>{w.displayName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{w.primarySkill}</td>
                      <td className="py-3 pr-4 text-slate-600">{w.district}, {w.state}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col items-start gap-1">
                          <PaymentStatusBadge status={effectivePayStatus} />
                          {paymentIdRef && (
                            <span className="font-mono-tabular text-[10px] text-slate-500">
                              {paymentIdRef}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            isAvailable
                              ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isAvailable ? 'Available' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-semibold uppercase text-xs text-slate-800">
                            {w.verificationStatus}
                          </span>
                          {isPaidAwaitingAdmin && (
                            <span className="text-[10px] font-bold text-[#9A3412] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Awaiting Admin Approval
                            </span>
                          )}
                          {w.verificationStatus === 'verified' && w.certificateNo && (
                            <span className="font-mono-tabular text-[10px] text-[#15803D]">
                              {w.certificateNo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === `avail-${w.id}`}
                          onClick={async () => {
                            setBusyId(`avail-${w.id}`);
                            try {
                              await adminUpdateWorkerAvailability(
                                w.id,
                                isAvailable ? 'offline' : 'available',
                                user.uid,
                                adminEmail
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer border ${
                            isAvailable
                              ? 'border-amber-300 text-[#C25E00] hover:bg-amber-50'
                              : 'border-emerald-300 text-[#15803D] hover:bg-emerald-50'
                          }`}
                        >
                          {isAvailable ? 'Set Offline' : 'Set Available'}
                        </button>
                        {(w.verificationStatus !== 'verified' || isPaidAwaitingAdmin) && (
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={async () => {
                              setBusyId(w.id);
                              setWorkerApprovalMessage('');
                              try {
                                if (pay && (!pay.verifiedWorkerId || !pay.certificateNo)) {
                                  const res = await adminVerifyWorkerRegistrationPayment({
                                    payment: pay,
                                    config: referralConfig,
                                    allReferrals: adminReferrals,
                                    allRewards: adminRewards,
                                    adminUid: user.uid,
                                    adminEmail,
                                    adminNotes: 'Approved from ROJGAR SETU Registered Workers table.',
                                    autoApproveReferral: true,
                                  });
                                  setWorkerApprovalMessage(
                                    `Approved ${w.displayName}! Generated Worker ID ${res.verifiedWorkerId} & Certificate ${res.certificateNo}.`
                                  );
                                } else {
                                  await adminUpdateVerification('publicWorkers', w.id, 'verified', user.uid, adminEmail);
                                  setWorkerApprovalMessage(`Verified ${w.displayName}.`);
                                }
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                          >
                            {isPaidAwaitingAdmin ? 'Approve & Issue ID/Cert' : t.dashboards.adminVerify}
                          </button>
                        )}
                        {w.verificationStatus !== 'suspended' ? (
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={async () => {
                              setBusyId(w.id);
                              await adminUpdateVerification('publicWorkers', w.id, 'suspended', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded border border-red-300 text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminSuspend}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={async () => {
                              setBusyId(w.id);
                              await adminUpdateVerification('publicWorkers', w.id, 'pending', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminRestore}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'employers' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                Registered Customers & Employers (Authorized Admin Complete View)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full name, gender, mobile, email & address are visible strictly to authorized Admin. Workers see only Last Name for Female / masked customers.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-customers-admin.csv',
                  ['Registration ID', 'Business Name', 'Full Contact Name', 'Gender', 'Last Name', 'Visibility', 'Mobile', 'Email', 'Full Address', 'State', 'District', 'Status'],
                  employers.map((e) => {
                    const priv = employerPrivateMap[e.ownerUid];
                    return [
                      e.registrationId,
                      e.businessName,
                      priv?.contactPerson || '',
                      e.gender || priv?.gender || '',
                      e.lastName || priv?.lastName || '',
                      e.profileVisibility || priv?.profileVisibility || 'standard',
                      priv?.mobile || '',
                      priv?.email || '',
                      priv?.businessAddress || '',
                      e.state,
                      e.district,
                      e.verificationStatus,
                    ];
                  })
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.dashboards.exportCsv}
            </button>
          </div>
          {employers.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Customer / Business</th>
                    <th className="py-2 pr-4">Privacy & Gender</th>
                    <th className="py-2 pr-4">Authorized Contact & Address</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employers.map((emp) => {
                    const priv = employerPrivateMap[emp.ownerUid];
                    const resolvedGender = emp.gender || priv?.gender || 'prefer_not_to_say';
                    const resolvedVisibility = emp.profileVisibility || priv?.profileVisibility || 'standard';
                    return (
                    <tr key={emp.id}>
                      <td className="py-3 pr-4 font-mono-tabular text-xs">{emp.registrationId}</td>
                      <td className="py-3 pr-4 font-semibold text-[#0B3B75]">
                        <div className="flex items-center gap-2.5">
                          <SecureAvatar
                            name={priv?.contactPerson || emp.businessName}
                            photoDocId={priv?.photoDocId || buildCustomerPhotoDocId(emp.ownerUid)}
                            sizeClass="w-8 h-8"
                            textSizeClass="text-[11px]"
                          />
                          <div>
                            <div className="font-bold text-[#0B3B75]">{priv?.contactPerson || emp.businessName}</div>
                            <div className="text-[11px] font-normal text-slate-500">
                              {emp.businessName} · {emp.industryCategory}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              resolvedGender === 'female'
                                ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {resolvedGender === 'female' ? 'Female (Shielded)' : resolvedGender}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0B3B75] font-semibold text-[10px]">
                            {resolvedVisibility}
                          </span>
                        </div>
                        {(emp.lastName || priv?.lastName) && (
                          <div className="text-[11px] text-slate-600">
                            Worker-visible surname: <strong>{emp.lastName || priv?.lastName}</strong>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-700 space-y-0.5 max-w-xs">
                        {priv ? (
                          <>
                            <div className="font-mono-tabular font-semibold text-slate-900">
                              {priv.mobile} {priv.mobileVerified ? '✓' : ''} · {priv.email}
                            </div>
                            <div className="text-[11px] text-slate-600 break-words">
                              {priv.businessAddress}, {emp.district}, {emp.state}
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-500">
                            {emp.district}, {emp.state}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-semibold uppercase text-xs">{emp.verificationStatus}</td>
                      <td className="py-3 flex flex-wrap gap-2">
                        {emp.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            disabled={busyId === emp.id}
                            onClick={async () => {
                              setBusyId(emp.id);
                              await adminUpdateVerification('publicEmployers', emp.id, 'verified', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminVerify}
                          </button>
                        )}
                        {emp.verificationStatus !== 'suspended' ? (
                          <button
                            type="button"
                            disabled={busyId === emp.id}
                            onClick={async () => {
                              setBusyId(emp.id);
                              await adminUpdateVerification('publicEmployers', emp.id, 'suspended', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded border border-red-300 text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminSuspend}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === emp.id}
                            onClick={async () => {
                              setBusyId(emp.id);
                              await adminUpdateVerification('publicEmployers', emp.id, 'pending', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminRestore}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">Job Postings Moderation</h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-jobs.csv',
                  ['Job ID', 'Title', 'Employer', 'Category', 'State', 'District', 'Wage', 'Status'],
                  jobs.map((j) => [j.id, j.title, j.employerName, j.category, j.state, j.district, j.offeredWage, j.status])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.dashboards.exportCsv}
            </button>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <div key={job.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono-tabular text-slate-500">
                      {job.category} · {job.district}, {job.state} · Status: <strong className="uppercase">{job.status}</strong>
                    </p>
                    <h3 className="font-display text-sm font-bold text-[#0B3B75]">{job.title}</h3>
                    <p className="text-xs text-slate-600">{job.employerName}</p>
                  </div>
                  <div className="flex gap-2">
                    {job.status !== 'open' && (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={async () => {
                          setBusyId(job.id);
                          await adminUpdateJobStatus(job.id, 'open', user.uid, adminEmail);
                          setBusyId(null);
                        }}
                        className="px-2.5 py-1 rounded bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                      >
                        Reopen
                      </button>
                    )}
                    {job.status !== 'flagged' && (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={async () => {
                          setBusyId(job.id);
                          await adminUpdateJobStatus(job.id, 'flagged', user.uid, adminEmail);
                          setBusyId(null);
                        }}
                        className="px-2.5 py-1 rounded border border-amber-300 text-amber-800 text-xs font-semibold cursor-pointer"
                      >
                        Flag
                      </button>
                    )}
                    {job.status !== 'cancelled' && (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={async () => {
                          setBusyId(job.id);
                          await adminUpdateJobStatus(job.id, 'cancelled', user.uid, adminEmail);
                          setBusyId(null);
                        }}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-700 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'grievances' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.dashboards.grievances}</h2>
          {grievances.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {grievances.map((g) => (
                <div key={g.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono-tabular text-slate-500 uppercase">
                      {g.category} · {g.status} {g.targetReference ? `· Ref: ${g.targetReference}` : ''}
                    </span>
                    <span className="text-xs text-slate-400">{formatFirestoreTimestamp(g.createdAt)}</span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#0B3B75]">{g.subject}</h3>
                  <p className="text-xs text-slate-600">{g.description}</p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Resolution / admin notes..."
                      value={grievanceNotes[g.id] ?? g.adminNotes ?? ''}
                      onChange={(e) => setGrievanceNotes((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs"
                    />
                    <div className="flex gap-1.5">
                      {(['under_review', 'resolved', 'dismissed'] as GrievanceReport['status'][]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={busyId === g.id}
                          onClick={async () => {
                            setBusyId(g.id);
                            await adminUpdateGrievanceStatus(
                              g.id,
                              st,
                              grievanceNotes[g.id] ?? g.adminNotes ?? '',
                              user.uid,
                              adminEmail
                            );
                            setBusyId(null);
                          }}
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'enquiries' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.dashboards.enquiries}</h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-partnership-enquiries.csv',
                  ['Organisation', 'Department', 'Contact', 'Designation', 'Email', 'Phone', 'State', 'District', 'Interest', 'Status'],
                  enquiries.map((e) => [
                    e.organisationName,
                    e.departmentOrInstitution,
                    e.contactPerson,
                    e.designation,
                    e.email,
                    e.phone,
                    e.state,
                    e.district,
                    e.partnershipInterest,
                    e.status,
                  ])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.dashboards.exportCsv}
            </button>
          </div>
          {enquiries.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {enquiries.map((eq) => (
                <div key={eq.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono-tabular text-slate-500 uppercase">
                      {eq.partnershipInterest} · {eq.state}, {eq.district} · Status: {eq.status}
                    </span>
                    <span className="text-xs text-slate-400">{formatFirestoreTimestamp(eq.createdAt)}</span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#0B3B75]">
                    {eq.organisationName} — {eq.departmentOrInstitution}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {eq.contactPerson} ({eq.designation}) · {eq.email} · {eq.phone}
                  </p>
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">{eq.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {(['under_review', 'responded', 'archived'] as PartnershipEnquiry['status'][]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busyId === eq.id}
                        onClick={async () => {
                          setBusyId(eq.id);
                          await adminUpdateEnquiryStatus(eq.id, st, user.uid, adminEmail);
                          setBusyId(null);
                        }}
                        className="px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Mark {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateAnnouncement} className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">Publish Trilingual Banner</h2>
            {annError && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{annError}</div>}
            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                placeholder="Title (English)"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <textarea
                rows={2}
                placeholder="Message (English)"
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="शीर्षक (हिंदी)"
                value={titleHi}
                onChange={(e) => setTitleHi(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <textarea
                rows={2}
                placeholder="संदेश (हिंदी)"
                value={bodyHi}
                onChange={(e) => setBodyHi(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="शीर्षक (मराठी)"
                value={titleMr}
                onChange={(e) => setTitleMr(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <textarea
                rows={2}
                placeholder="संदेश (मराठी)"
                value={bodyMr}
                onChange={(e) => setBodyMr(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busyId === 'create-ann'}
              className="w-full py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Publish Announcement
            </button>
          </form>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">Existing Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">{t.common.noRecords}</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {announcements.map((a) => (
                  <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#0B3B75]">{a.titleEn}</h3>
                      <p className="text-xs text-slate-600">{a.bodyEn}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={async () => {
                        setBusyId(a.id);
                        await adminToggleAnnouncement(a.id, !a.active, user.uid, adminEmail);
                        setBusyId(null);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shrink-0 ${
                        a.active
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                          : 'bg-slate-100 border border-slate-300 text-slate-600'
                      }`}
                    >
                      {a.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.dashboards.auditLogs}</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">{t.common.noRecords}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Admin</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 font-mono-tabular text-slate-500">{formatFirestoreTimestamp(log.createdAt)}</td>
                      <td className="py-2.5 pr-4">{log.adminEmail}</td>
                      <td className="py-2.5 pr-4 font-semibold text-[#0B3B75]">{log.action}</td>
                      <td className="py-2.5 pr-4 font-mono-tabular">{log.targetCollection}/{log.targetId}</td>
                      <td className="py-2.5 text-slate-600">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
