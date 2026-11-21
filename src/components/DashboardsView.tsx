import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bike,
  BookmarkCheck,
  Briefcase,
  Car,
  CheckCircle2,
  Crosshair,
  Download,
  FileText,
  History,
  LocateFixed,
  Lock,
  MapPin,
  Megaphone,
  PlusCircle,
  Printer,
  Radar,
  Shield,
  Star,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { RojgarSetuLogo } from './RojgarSetuLogo';
import { SecureAvatar } from './SecureAvatar';
import { UserNotificationCenter } from './UserNotificationCenter';
import { AdminNotificationDemoPanel } from './AdminNotificationDemoPanel';
import { DealCoordinationPanel, getDealStatusBadgeStyle } from './DealCoordinationPanel';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getVehicleTypeLabel } from '../data/vehicleTypes';
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
  adminToggleAnnouncement,
  adminUpdateEnquiryStatus,
  adminUpdateGrievanceStatus,
  adminUpdateJobStatus,
  adminUpdateVerification,
  callNotificationApi,
  cancelDeal,
  completeDeal,
  confirmDealByParticipant,
  doesWorkerMatchJob,
  expandJobSearchRadius,
  getEffectiveDealStatus,
  markAllNotificationsRead,
  markNotificationRead,
  respondToHiringInvite,
  respondToWorkerOffer,
  saveCustomerDefaultLocation,
  startWorkByWorker,
  submitWorkerOffer,
  subscribeAdminAuditLogs,
  subscribeAdminEnquiries,
  subscribeAdminGrievances,
  subscribeAllApplicationsAdmin,
  subscribeCustomerVehicleBookings,
  subscribeEmployerApplications,
  subscribeOwnerVehicleBookings,
  subscribeOwnerVehicles,
  subscribeWorkerApplications,
  updateVehicleAvailability,
  updateVehicleBookingStatus,
} from '../lib/firestoreService';
import {
  buildSmartJobVoiceScript,
  calculateValidDistanceKm,
  getNextRadiusStage,
  getPublicJobLocationText,
  normalizeRadiusKm,
} from '../lib/smartVoiceJobAlert';
import { speakJobAlert, stopVoiceAlert, unlockAudioOnUserGesture } from '../lib/voiceAlertEngine';
import type {
  AppNotificationRecord,
  AuditLog,
  GrievanceReport,
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  PartnershipEnquiry,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
  ServiceRadiusKm,
  VehicleBooking,
  VehicleListing,
  VehicleType,
} from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
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
  const { user, workerProfile, workerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [ownerVehicles, setOwnerVehicles] = useState<VehicleListing[]>([]);
  const [ownerVehicleBookings, setOwnerVehicleBookings] = useState<VehicleBooking[]>([]);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [availUpdating, setAvailUpdating] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);
  const [speakingJobId, setSpeakingJobId] = useState<string | null>(null);
  const [offerDraftTargetId, setOfferDraftTargetId] = useState<string | null>(null);
  const [offerPriceInput, setOfferPriceInput] = useState<number>(500);
  const [offerEtaInput, setOfferEtaInput] = useState<string>('Within 1 hour');
  const [offerMsgInput, setOfferMsgInput] = useState<string>('');

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

  const matchingJobs = useMemo(() => {
    if (!workerProfile) return [];
    const appliedJobIdSet = new Set(applications.map((a) => a.jobId));
    return jobs
      .filter((j) => j.status === 'open')
      .filter((j) => !appliedJobIdSet.has(j.id) && !dismissedJobIds.includes(j.id))
      .filter((j) => doesWorkerMatchJob(j, workerProfile).matches)
      .slice(0, 12);
  }, [jobs, workerProfile, applications, dismissedJobIds]);

  const incomingInvites = useMemo(
    () => applications.filter((a) => a.status === 'invited'),
    [applications]
  );

  const spotlightJob = useMemo(() => {
    if (!highlightedJobId) return undefined;
    const candidate = jobsById[highlightedJobId];
    return candidate && candidate.status === 'open' ? candidate : undefined;
  }, [highlightedJobId, jobsById]);

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
    setOfferPriceInput(defaultWage > 0 ? defaultWage : workerProfile?.expectedWage || 500);
    setOfferEtaInput('Within 1 hour');
    setOfferMsgInput('');
  };

  const handleSubmitOfferForJob = async (
    e: React.FormEvent,
    job: JobPosting,
    existingApp?: JobApplication
  ) => {
    e.preventDefault();
    if (!user || !workerProfile) return;
    setBusyActionId(existingApp?.id || job.id);
    setFeedbackBanner('');
    try {
      await submitWorkerOffer({
        job,
        worker: workerProfile,
        workerUid: user.uid,
        offeredPrice: Number(offerPriceInput) || job.offeredWage || workerProfile.expectedWage,
        estimatedArrivalTime: offerEtaInput.trim() || 'Within 1 hour',
        offerMessage: offerMsgInput.trim(),
        existingApplicationId: existingApp?.id,
      });
      setOfferDraftTargetId(null);
      setOfferMsgInput('');
      setFeedbackBanner(
        tr(
          lang,
          'Offer sent! Customer has been notified with your price and ETA.',
          'ऑफर भेज दिया गया! ग्राहक को आपके दर और समय की सूचना मिल गई है।',
          'ऑफर पाठवली! ग्राहकाला तुमचा दर व येण्याची वेळ कळवली आहे.'
        )
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const handleWorkerConfirmDeal = async (app: JobApplication) => {
    if (!user || !workerProfile) return;
    setBusyActionId(app.id);
    try {
      await confirmDealByParticipant({
        app,
        actorUid: user.uid,
        actorRole: 'worker',
        actorName: workerProfile.displayName,
      });
      setFeedbackBanner(tr(lang, 'Deal confirmed! Two-way live location is active.', 'डील कन्फर्म हो गई!', 'डील निश्चित झाली!'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleWorkerStartWork = async (app: JobApplication) => {
    if (!workerProfile) return;
    setBusyActionId(app.id);
    try {
      await startWorkByWorker({
        app,
        workerName: workerProfile.displayName,
      });
      setFeedbackBanner(tr(lang, 'Work marked In Progress! Customer notified.', 'कार्य शुरू चिह्नित किया गया!', 'काम सुरू झाले म्हणून नोंदवले!'));
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
      setFeedbackBanner(tr(lang, 'Deal cancelled and live location stopped.', 'डील रद्द की गई और लाइव लोकेशन बंद हुई।', 'डील रद्द केली आणि लाइव्ह लोकेशन बंद केले.'));
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Registration Card */}
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
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
              {workerProfile.displayName}
            </h1>
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.availability}
            </label>
            <select
              value={workerProfile.availabilityStatus}
              disabled={availUpdating || workerProfile.verificationStatus === 'suspended'}
              onChange={(e) => handleAvailabilityChange(e.target.value as PublicWorkerProfile['availabilityStatus'])}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-medium text-slate-800"
            >
              <option value="available">{tr(lang, 'Available for Work', 'काम के लिए उपलब्ध', 'कामासाठी उपलब्ध')}</option>
              <option value="busy">{tr(lang, 'Currently Busy', 'व्यस्त', 'व्यस्त')}</option>
              <option value="offline">{tr(lang, 'Offline / On Break', 'ऑफलाइन', 'ऑफलाइन')}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('register-worker')}
            className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer self-end"
          >
            {t.workerForm.updateBtn}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('find-work')}
            className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer self-end"
          >
            {t.nav.findWork}
          </button>
        </div>
      </div>

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

      {/* Quick Metrics */}
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
                'Issued under ROJGAR SETU (ABUJMAD FOUNDATION) for identification on work requests.',
                'कार्य अवसरों पर पहचान के लिए रोजगार सेतु (ABUJMAD FOUNDATION) द्वारा जारी।',
                'कामाच्या ठिकाणी ओळखीसाठी रोजगार सेतु (ABUJMAD FOUNDATION) अंतर्गत जारी.'
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
            <span>ABUJMAD FOUNDATION · Social-Impact Workforce Initiative</span>
            <span>Not a Government ID</span>
          </div>
        </div>
      </section>

      {/* Real-Time Unread Notification Alert Banner */}
      {unreadNotificationsCount > 0 && (
        <section className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-[#E06D1B] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
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
                  onClick={() => void markNotificationRead(n.id)}
                  className="bg-white border border-amber-200 rounded px-3 py-2 flex items-start justify-between gap-2 cursor-pointer hover:bg-amber-50/50"
                >
                  <div>
                    <div className="text-xs font-bold text-[#0B3B75]">{n.title}</div>
                    <p className="text-[11px] text-slate-600">{n.body}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold uppercase text-[#C25E00] shrink-0">
                    {n.dealStatus || 'NEW'}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Smart Voice Job Alert Spotlight (Deep-Linked from Push / In-App Notification) */}
      {spotlightJob && (
        <section className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#E06D1B] text-white text-[10px] font-mono-tabular font-bold uppercase">
                <BellRing className="w-3 h-3" />
                {tr(lang, 'SMART VOICE JOB ALERT', 'स्मार्ट वॉइस जॉब अलर्ट', 'स्मार्ट व्हॉइस जॉब अलर्ट')} · {spotlightJob.category}
              </span>
              <h2 className="font-display text-lg font-bold text-[#0B3B75] mt-1">{spotlightJob.title}</h2>
              <p className="text-xs font-semibold text-slate-700">
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
                  {tr(lang, 'Dismiss', 'बंद करें', 'बंद करा')}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-700 bg-white border border-amber-200 rounded p-2.5">
            {spotlightJob.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
              <strong>{tr(lang, 'Approximate Area:', 'अनुमानित क्षेत्र:', 'अंदाजे परिसर:')}</strong>{' '}
              {getPublicJobLocationText(spotlightJob, false)}
            </span>
            {(() => {
              const distKm = calculateValidDistanceKm(
                spotlightJob.lat,
                spotlightJob.lng,
                workerProfile.approxLat,
                workerProfile.approxLng
              );
              return distKm !== null ? (
                <span className="font-mono-tabular font-bold text-[#0B3B75]">~{distKm} km away</span>
              ) : null;
            })()}
            {(spotlightJob.jobDate || spotlightJob.startTime) && (
              <span className="font-mono-tabular">
                {spotlightJob.jobDate} {spotlightJob.startTime}
              </span>
            )}
            {spotlightJob.offeredWage > 0 && (
              <span className="font-mono-tabular font-bold text-[#15803D]">
                ₹{spotlightJob.offeredWage.toLocaleString('en-IN')} / {spotlightJob.wageUnit}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            {tr(
              lang,
              'Exact house/street address is shared securely once your offer is accepted.',
              'सटीक पता ऑफर स्वीकार होने के बाद साझा किया जाता है।',
              'अचूक पत्ता ऑफर स्वीकारल्यानंतर सुरक्षितपणे शेअर केला जातो.'
            )}
          </p>

          {!applications.some((a) => a.jobId === spotlightJob.id) && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busyActionId === spotlightJob.id}
                onClick={() => {
                  setBusyActionId(spotlightJob.id);
                  void submitWorkerOffer({
                    job: spotlightJob,
                    worker: workerProfile,
                    workerUid: user.uid,
                    offeredPrice: spotlightJob.offeredWage > 0 ? spotlightJob.offeredWage : workerProfile.expectedWage,
                    estimatedArrivalTime: 'Ready today',
                    offerMessage: 'Accepted your budget & job details. Ready to work.',
                  })
                    .then(() => {
                      if (onClearHighlightedJob) onClearHighlightedJob();
                    })
                    .finally(() => setBusyActionId(null));
                }}
                className="px-3.5 py-1.5 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                {tr(lang, 'Accept', 'स्वीकार करें', 'स्वीकारा')}
              </button>
              <button
                type="button"
                onClick={() => handleOpenOfferEditor(`spotlight_${spotlightJob.id}`, spotlightJob.offeredWage)}
                className="px-3.5 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                {tr(lang, 'Send Offer', 'ऑफर भेजें', 'ऑफर पाठवा')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedJobIds((prev) => [...prev, spotlightJob.id]);
                  if (onClearHighlightedJob) onClearHighlightedJob();
                }}
                className="px-3.5 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {tr(lang, 'Reject', 'अस्वीकार', 'नको')}
              </button>
            </div>
          )}

          {offerDraftTargetId === `spotlight_${spotlightJob.id}` && (
            <form
              onSubmit={(e) => handleSubmitOfferForJob(e, spotlightJob)}
              className="bg-white border border-slate-300 rounded p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={offerPriceInput}
                  onChange={(e) => setOfferPriceInput(Number(e.target.value))}
                  placeholder="Price ₹"
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono-tabular"
                />
                <input
                  type="text"
                  value={offerEtaInput}
                  onChange={(e) => setOfferEtaInput(e.target.value)}
                  placeholder="ETA (e.g. 30 mins)"
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
              <input
                type="text"
                value={offerMsgInput}
                onChange={(e) => setOfferMsgInput(e.target.value)}
                placeholder="Message to customer"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busyActionId === spotlightJob.id}
                  className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold cursor-pointer"
                >
                  Send Offer
                </button>
                <button
                  type="button"
                  onClick={() => setOfferDraftTargetId(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Incoming Customer Hiring Requests & Matching Category Broadcasts (Accept / Reject / Send Offer) */}
      {(incomingInvites.length > 0 || matchingJobs.length > 0) && (
        <section className="bg-white border-2 border-[#0B3B75] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B3B75] flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#E06D1B]" />
                <span>
                  {tr(
                    lang,
                    'Incoming Hiring Requests & Service Leads',
                    'नए कार्य अनुरोध एवं अवसर',
                    'नवीन कामाच्या विनंत्या व संधी'
                  )}{' '}
                  ({incomingInvites.length + matchingJobs.length})
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                {tr(
                  lang,
                  'Accept immediately, reject, or send your price + estimated arrival time offer directly to the customer.',
                  'तुरंत स्वीकार करें, अस्वीकार करें, या अपना दर और पहुंचने का समय भेजें।',
                  'तात्काळ स्वीकारा, नाकारा किंवा तुमचा दर आणि पोहोचण्याची वेळ पाठवा.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('find-work', workerProfile.primarySkill)}
              className="text-xs font-semibold text-[#C25E00] hover:underline cursor-pointer"
            >
              {t.nav.findWork} →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Invites First */}
            {incomingInvites.map((app) => {
              const job = jobsById[app.jobId];
              const isEditingOffer = offerDraftTargetId === `invite_${app.id}`;
              const inviteApproxLoc = job
                ? getPublicJobLocationText(job, false)
                : app.jobLocationLabel || app.jobDistrict || 'Local area';
              const inviteDistKm = job
                ? calculateValidDistanceKm(job.lat, job.lng, workerProfile.approxLat, workerProfile.approxLng)
                : null;
              return (
                <div key={app.id} className="border-2 border-[#E06D1B] bg-amber-50/40 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-[#E06D1B] text-white text-[10px] font-mono-tabular font-bold uppercase">
                        DIRECT HIRING REQUEST · {getEffectiveDealStatus(app)}
                      </span>
                      <h3 className="font-display text-base font-bold text-[#0B3B75] mt-1">{app.jobTitle}</h3>
                      <p className="text-xs font-semibold text-slate-700">
                        Customer: {app.customerName || job?.employerName || 'Customer'}
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular text-sm font-bold text-[#15803D]">
                      ₹{app.proposedWage.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      {inviteApproxLoc}
                      {inviteDistKm !== null ? ` (~${inviteDistKm} km)` : ''}
                      {(app.jobDate || job?.jobDate) ? ` · ${app.jobDate || job?.jobDate}` : ''}
                      {(app.startTime || job?.startTime) ? ` ${app.startTime || job?.startTime}` : ''}
                    </span>
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
                  {app.note && <p className="text-xs text-slate-700 bg-white rounded p-2 border border-amber-200">{app.note}</p>}

                  {!isEditingOffer ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyActionId === app.id}
                        onClick={() => handleInviteDecision(app, 'accepted')}
                        className="px-3 py-1.5 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                      >
                        {t.dashboards.acceptBtn}
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === app.id}
                        onClick={() => handleOpenOfferEditor(`invite_${app.id}`, app.proposedWage)}
                        className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        {tr(lang, 'Send Offer', 'ऑफर भेजें', 'ऑफर पाठवा')}
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === app.id}
                        onClick={() => handleInviteDecision(app, 'declined')}
                        className="px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {tr(lang, 'Reject', 'अस्वीकार', 'नाकारा')}
                      </button>
                    </div>
                  ) : (
                    job && (
                      <form
                        onSubmit={(e) => handleSubmitOfferForJob(e, job, app)}
                        className="bg-white border border-slate-300 rounded p-3 space-y-2"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={0}
                            value={offerPriceInput}
                            onChange={(e) => setOfferPriceInput(Number(e.target.value))}
                            placeholder="Price ₹"
                            className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono-tabular"
                          />
                          <input
                            type="text"
                            value={offerEtaInput}
                            onChange={(e) => setOfferEtaInput(e.target.value)}
                            placeholder="ETA (e.g. 30 mins)"
                            className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <input
                          type="text"
                          value={offerMsgInput}
                          onChange={(e) => setOfferMsgInput(e.target.value)}
                          placeholder="Message to customer (optional)"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={busyActionId === app.id}
                            className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold cursor-pointer"
                          >
                            Submit Offer
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferDraftTargetId(null)}
                            className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )
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
              return (
                <div key={job.id} className="border border-slate-300 rounded-lg p-4 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-[#0B3B75] text-[10px] font-mono-tabular font-bold uppercase">
                        {job.category} · {job.dealStatus || 'OPEN'}
                      </span>
                      <h3 className="font-display text-sm font-bold text-[#0B3B75] mt-1">{job.title}</h3>
                      <p className="text-xs font-semibold text-slate-700">Customer: {job.employerName}</p>
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-[#15803D] shrink-0">
                      ₹{job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{job.description}</p>
                  <p className="text-[11px] text-slate-500">
                    {approxLoc}
                    {distKm !== null ? ` (~${distKm} km)` : ''}
                    {job.jobDate ? ` · ${job.jobDate}` : ''}
                    {job.startTime ? ` ${job.startTime}` : ''}
                  </p>

                  {!isEditingOffer ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleListenJobVoice(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 text-xs font-semibold text-[#0B3B75] hover:bg-slate-100 cursor-pointer"
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />}
                        <span>{isSpeaking ? 'Stop' : 'Voice'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === job.id}
                        onClick={() => {
                          setBusyActionId(job.id);
                          void submitWorkerOffer({
                            job,
                            worker: workerProfile,
                            workerUid: user.uid,
                            offeredPrice: job.offeredWage > 0 ? job.offeredWage : workerProfile.expectedWage,
                            estimatedArrivalTime: 'Ready today',
                            offerMessage: 'Accepted your budget & job details. Ready to work.',
                          }).finally(() => setBusyActionId(null));
                        }}
                        className="px-3 py-1.5 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                      >
                        {tr(lang, 'Accept', 'स्वीकार करें', 'स्वीकारा')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenOfferEditor(`job_${job.id}`, job.offeredWage)}
                        className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        {tr(lang, 'Send Offer', 'ऑफर भेजें', 'ऑफर पाठवा')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedJobIds((prev) => [...prev, job.id])}
                        className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {tr(lang, 'Reject', 'छोड़ें', 'नको')}
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => handleSubmitOfferForJob(e, job)}
                      className="bg-slate-50 border border-slate-300 rounded p-3 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          value={offerPriceInput}
                          onChange={(e) => setOfferPriceInput(Number(e.target.value))}
                          placeholder="Price ₹"
                          className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono-tabular bg-white"
                        />
                        <input
                          type="text"
                          value={offerEtaInput}
                          onChange={(e) => setOfferEtaInput(e.target.value)}
                          placeholder="ETA (e.g. 30 mins)"
                          className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                        />
                      </div>
                      <input
                        type="text"
                        value={offerMsgInput}
                        onChange={(e) => setOfferMsgInput(e.target.value)}
                        placeholder="Message to customer"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyActionId === job.id}
                          className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold cursor-pointer"
                        >
                          Send Offer
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferDraftTargetId(null)}
                          className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
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
              const job = jobsById[app.jobId];
              return (
                <div key={app.id} className="py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                        <span
                          className={`px-2 py-0.5 rounded border font-bold uppercase ${getDealStatusBadgeStyle(
                            dealStatus
                          )}`}
                        >
                          {dealStatus}
                        </span>
                        <span>· ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}</span>
                        {app.estimatedArrivalTime && <span>· ETA: {app.estimatedArrivalTime}</span>}
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0B3B75]">{app.jobTitle}</h3>
                      {(app.customerName || job?.employerName) && (
                        <p className="text-xs font-semibold text-slate-700">
                          Customer: {app.customerName || job?.employerName}
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
                            {tr(lang, 'Customer Photo (Accepted Job)', 'ग्राहक फोटो (स्वीकृत कार्य)', 'ग्राहक फोटो (मंजूर काम)')}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                          <Lock className="w-3 h-3" />
                          <span>
                            {tr(
                              lang,
                              'Customer photo & exact location stay hidden until accepted',
                              'काम स्वीकार होने तक ग्राहक फोटो व सटीक लोकेशन गोपनीय रहते हैं',
                              'काम मंजूर होईपर्यंत ग्राहकाचा फोटो व अचूक लोकेशन गोपनीय राहतात'
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
                            onClick={() => handleInviteDecision(app, 'accepted')}
                            className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                          >
                            {t.dashboards.acceptBtn}
                          </button>
                          <button
                            type="button"
                            disabled={busyActionId === app.id}
                            onClick={() => handleInviteDecision(app, 'declined')}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {t.dashboards.declineBtn}
                          </button>
                        </>
                      )}

                      {dealStatus === 'OFFER_ACCEPTED' && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerConfirmDeal(app)}
                          className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                        >
                          {tr(lang, 'Confirm Deal', 'डील कन्फर्म करें', 'डील पक्की करा')}
                        </button>
                      )}

                      {dealStatus === 'DEAL_CONFIRMED' && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerStartWork(app)}
                          className="px-3 py-1.5 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                        >
                          {tr(lang, 'Start Work', 'काम शुरू करें', 'काम सुरू करा')}
                        </button>
                      )}

                      {dealStatus === 'WORK_IN_PROGRESS' && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerCompleteDeal(app)}
                          className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                        >
                          {tr(lang, 'Mark Work Completed', 'काम पूर्ण चिह्नित करें', 'काम पूर्ण नोंदवा')}
                        </button>
                      )}

                      {(dealStatus === 'OFFER_ACCEPTED' ||
                        dealStatus === 'DEAL_CONFIRMED' ||
                        dealStatus === 'WORK_IN_PROGRESS') && (
                        <button
                          type="button"
                          disabled={busyActionId === app.id}
                          onClick={() => handleWorkerCancelDeal(app)}
                          className="px-3 py-1.5 rounded-md border border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          {tr(lang, 'Cancel Deal', 'रद्द करें', 'रद्द करा')}
                        </button>
                      )}
                    </div>
                  </div>

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
}

export const EmployerDashboardView: React.FC<EmployerDashboardProps> = ({
  jobs,
  workers = [],
  notifications = [],
  unreadNotificationsCount = 0,
  onNavigate,
  onNavigateToTarget,
}) => {
  const { lang, t } = useLanguage();
  const { user, employerProfile, employerPrivate, customerPreference, signInWithGoogle } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [customerVehicleBookings, setCustomerVehicleBookings] = useState<VehicleBooking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandingJobId, setExpandingJobId] = useState<string | null>(null);
  const [completingAppId, setCompletingAppId] = useState<string | null>(null);
  const [ratingVal, setRatingVal] = useState<number>(5);
  const [feedbackVal, setFeedbackVal] = useState('');
  const [gpsUpdating, setGpsUpdating] = useState(false);
  const [locNotice, setLocNotice] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const syncedPhotoGrantsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.emailVerified) {
      setApplications([]);
      setCustomerVehicleBookings([]);
      return;
    }
    const u1 = subscribeEmployerApplications(user.uid, setApplications);
    const u2 = subscribeCustomerVehicleBookings(user.uid, setCustomerVehicleBookings);
    return () => {
      u1();
      u2();
    };
  }, [user?.uid, user?.emailVerified]);

  const jobsById = useMemo(() => {
    const mapObj: Record<string, JobPosting> = {};
    jobs.forEach((j) => {
      mapObj[j.id] = j;
    });
    return mapObj;
  }, [jobs]);

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

  const handleStatusDecision = async (app: JobApplication, decision: 'accepted' | 'declined') => {
    if (!user) return;
    setBusyId(app.id);
    setActionNotice('');
    try {
      const jobLoc = app.jobLocationLabel || jobsById[app.jobId]?.workLocationLabel || jobsById[app.jobId]?.district || '';
      await respondToWorkerOffer({
        app,
        decision,
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
      setActionNotice(
        decision === 'accepted'
          ? tr(
              lang,
              `Offer accepted! ${app.workerName} has been notified ("Congratulations! Offer Accepted") and live location sharing is now unlocked.`,
              `ऑफर स्वीकार हो गया! ${app.workerName} को तुरंत सूचना भेज दी गई है।`,
              `ऑफर स्वीकारली! ${app.workerName} ला तात्काळ सूचना पाठवली आहे.`
            )
          : tr(
              lang,
              `Offer declined and ${app.workerName} notified.`,
              `ऑफर अस्वीकृत और ${app.workerName} को सूचित किया गया।`,
              `ऑफर नाकारली आणि ${app.workerName} ला कळवले.`
            )
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomerConfirmDeal = async (app: JobApplication) => {
    if (!user) return;
    setBusyId(app.id);
    try {
      await confirmDealByParticipant({
        app,
        actorUid: user.uid,
        actorRole: 'customer',
        actorName: customerDisplayName,
      });
      setActionNotice(tr(lang, 'Deal confirmed! Worker notified and live location is active.', 'डील कन्फर्म हो गई!', 'डील निश्चित झाली!'));
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
      setActionNotice(tr(lang, 'Deal cancelled and live location stopped.', 'डील रद्द और लाइव लोकेशन बंद।', 'डील रद्द केली आणि लाइव्ह लोकेशन बंद केले.'));
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
      setActionNotice(
        tr(
          lang,
          'Work marked completed! Both dashboards synced and live location sharing automatically stopped.',
          'कार्य पूर्ण! लाइव लोकेशन साझाकरण बंद कर दिया गया है।',
          'काम पूर्ण झाले! दोन्ही डॅशबोर्ड अपडेट झाले व लाइव्ह लोकेशन बंद केले.'
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
              'Hire workers or book local transport in one step, or register your company/contractor unit.',
              'तुरंत एक चरण में कामगार हायर करें या लोकल ट्रांसपोर्ट बुक करें, या अपना व्यवसाय पंजीकृत करें।',
              'तात्काळ एका पायरीत कामगार हायर करा किंवा लोकल ट्रान्सपोर्ट बुक करा.'
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
              onClick={() => onNavigate('transport')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#15803D] text-white text-sm font-semibold hover:bg-emerald-800 cursor-pointer"
            >
              <Bike className="w-4 h-4" />
              {tr(lang, 'Local Transport & Bike Taxi', 'लोकल ट्रांसपोर्ट व बाइक टैक्सी', 'लोकल ट्रान्सपोर्ट व बाईक टॅक्सी')}
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* PINNED AT VERY TOP: Frequent Customer Profile, Saved Location & 1-Tap Re-Order */}
      <section className="bg-white border-2 border-[#0B3B75] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#0B3B75] px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-white border-b-2 border-[#E06D1B]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-300" />
            <h2 className="font-display text-sm sm:text-base font-bold">
              {tr(
                lang,
                'Frequent Customer Profile · Saved Location & 1-Click Re-Order',
                'नियमित ग्राहक प्रोफ़ाइल · सहेजा गया पता व 1-क्लिक री-ऑर्डर',
                'नियमित ग्राहक प्रोफाईल · पत्ता व १-क्लिक पुन्हा ऑर्डर (सर्वात वर)'
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
                {tr(lang, 'Saved Work / Pickup Location', 'सहेजा गया कार्य / पिकअप पता', 'जतन केलेला पत्ता (कामाचे ठिकाण)')}
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
              <button
                type="button"
                onClick={() => onNavigate('transport')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                <Bike className="w-3.5 h-3.5" />
                {tr(lang, 'Book Transport', 'वाहन बुक करें', 'वाहन बुक करा')}
              </button>
            </div>
          </div>

          {locNotice && (
            <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-xs font-medium text-[#0B3B75]">
              {locNotice}
            </div>
          )}

          {(frequentStats.workerCats.length > 0 || frequentStats.vehicleTypes.length > 0) && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              {frequentStats.workerCats.length > 0 && (
                <div className="space-y-1.5">
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

              {frequentStats.vehicleTypes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {tr(lang, 'Frequent Local Transport (1-Click Re-Book):', 'अक्सर बुक किए जाने वाले वाहन:', 'वारंवार बुक केलेली वाहने (पुन्हा ऑर्डर):')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentStats.vehicleTypes.map((vt) => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => onNavigate('transport', vt)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-300 text-xs font-bold text-[#15803D] hover:bg-emerald-100 cursor-pointer"
                      >
                        <Car className="w-3 h-3" />
                        {getVehicleTypeLabel(vt, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

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
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
              {employerProfile?.businessName || user.displayName || user.email}
            </h1>
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
            onClick={() => onNavigate('transport')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#15803D] text-white text-sm font-semibold hover:bg-emerald-800 cursor-pointer"
          >
            <Bike className="w-4 h-4" />
            {tr(lang, 'Local Transport', 'लोकल ट्रांसपोर्ट', 'लोकल ट्रान्सपोर्ट')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(employerProfile ? 'post-job' : 'register-employer')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {employerProfile ? t.jobs.postTitle : t.nav.employerReg}
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
            <span>ABUJMAD FOUNDATION · Social-Impact Workforce Initiative</span>
            <span>Not a Government Document</span>
          </div>
        </div>
      </section>
      )}

      {/* Posted Jobs */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#0B3B75]">
          {t.dashboards.postedJobs} ({myJobs.length})
        </h2>

        {myJobs.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">{t.common.noRecords}</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {myJobs.map((job) => {
              const currentRadiusKm = normalizeRadiusKm(job.currentRadiusKm ?? job.initialRadiusKm ?? 5, 5);
              const nextRadiusKm = getNextRadiusStage(currentRadiusKm);
              const notifiedCount = Array.isArray(job.notifiedWorkerUids) ? job.notifiedWorkerUids.length : 0;
              return (
                <div key={job.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-mono-tabular text-slate-500 flex flex-wrap items-center gap-2">
                      <span>
                        {job.category} · <strong className="uppercase text-[#0B3B75]">{job.status}</strong> ·{' '}
                        {job.applicationsCount} {tr(lang, 'applications', 'आवेदन', 'अर्ज')}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0B3B75] font-bold">
                        Radius: {currentRadiusKm} km · {notifiedCount} alerted
                      </span>
                    </p>
                    <h3 className="font-display text-base font-bold text-[#0B3B75]">{job.title}</h3>
                    <p className="text-xs text-slate-600">
                      {job.workLocationLabel}, {job.district} · ₹{job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit} ·{' '}
                      {job.workersRequired} {t.jobs.workersUnit}
                    </p>
                  </div>
                  {job.status === 'open' && (
                    <div className="flex flex-wrap gap-2 self-start sm:self-center">
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
              );
            })}
          </div>
        )}
      </section>

      {/* Real-Time Unread Notification Alert Banner */}
      {unreadNotificationsCount > 0 && (
        <section className="bg-amber-50 border-2 border-[#E06D1B] rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-[#E06D1B] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
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
                  onClick={() => void markNotificationRead(n.id)}
                  className="bg-white border border-amber-200 rounded px-3 py-2 flex items-start justify-between gap-2 cursor-pointer hover:bg-amber-50/50"
                >
                  <div>
                    <div className="text-xs font-bold text-[#0B3B75]">{n.title}</div>
                    <p className="text-[11px] text-slate-600">{n.body}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold uppercase text-[#C25E00] shrink-0">
                    {n.dealStatus || 'NEW'}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {actionNotice && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {actionNotice}
        </div>
      )}

      {/* Received Offers & Applications */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'Worker Offers, Hiring Requests & Active Deals', 'प्राप्त ऑफर, आवेदन एवं डील', 'आलेल्या ऑफर्स व सक्रिय व्यवहार')} ({applications.length})
          </h2>
          {applications.some((a) => a.status === 'applied') && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-[#C25E00] text-xs font-bold">
              {applications.filter((a) => a.status === 'applied').length} awaiting decision
            </span>
          )}
        </div>

        {applications.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">{t.common.noRecords}</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {applications.map((app) => {
              const dealStatus = getEffectiveDealStatus(app);
              const job = jobsById[app.jobId];
              return (
                <div key={app.id} className="py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <SecureAvatar
                        name={app.workerName}
                        photoDocId={app.workerPhotoDocId}
                        sizeClass="w-11 h-11"
                        textSizeClass="text-sm"
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                          <span>{app.workerRegistrationId} · {app.workerPrimarySkill}</span>
                          <span
                            className={`px-2 py-0.5 rounded border font-bold uppercase ${getDealStatusBadgeStyle(
                              dealStatus
                            )}`}
                          >
                            {dealStatus}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#0B3B75]">
                          {app.workerName} — {app.jobTitle}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {app.agreedPrice ? 'Agreed Price' : 'Offered Price'}:{' '}
                          <strong className="font-mono-tabular text-[#15803D]">
                            ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}
                          </strong>
                          {app.estimatedArrivalTime ? ` · ETA: ${app.estimatedArrivalTime}` : ''}
                          {(app.offerMessage || app.note) ? ` · “${app.offerMessage || app.note}”` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {app.status === 'applied' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => handleStatusDecision(app, 'accepted')}
                            className="px-3.5 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                          >
                            {tr(lang, 'Accept Offer', 'ऑफर स्वीकार करें', 'ऑफर स्वीकारा')}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => handleStatusDecision(app, 'declined')}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {tr(lang, 'Reject Offer', 'अस्वीकार करें', 'नाकारा')}
                          </button>
                        </>
                      )}

                      {dealStatus === 'OFFER_ACCEPTED' && (
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => handleCustomerConfirmDeal(app)}
                          className="px-3 py-1.5 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                        >
                          {tr(lang, 'Confirm Deal', 'डील कन्फर्म करें', 'डील पक्की करा')}
                        </button>
                      )}

                      {app.status === 'accepted' && completingAppId !== app.id && (
                        <button
                          type="button"
                          onClick={() => setCompletingAppId(app.id)}
                          className="px-3 py-1.5 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                        >
                          {t.dashboards.completeBtn}
                        </button>
                      )}

                      {(dealStatus === 'OFFER_ACCEPTED' ||
                        dealStatus === 'DEAL_CONFIRMED' ||
                        dealStatus === 'WORK_IN_PROGRESS') && (
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => handleCustomerCancelDeal(app)}
                          className="px-3 py-1.5 rounded-md border border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          {tr(lang, 'Cancel Deal', 'डील रद्द करें', 'रद्द करा')}
                        </button>
                      )}

                      {app.status === 'work_completed' && (
                        <span className="text-xs font-semibold text-[#15803D] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {app.workerRating || 5}/5
                        </span>
                      )}
                    </div>
                  </div>

                  {completingAppId === app.id && (
                    <form
                      onSubmit={(e) => handleMarkCompleted(e, app)}
                      className="bg-slate-50 border border-slate-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
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

                  {/* Shared Deal Status Timeline, Two-Way Chat & Two-Way Live Map */}
                  <DealCoordinationPanel
                    application={app}
                    job={job}
                    viewerUid={user.uid}
                    viewerRole="customer"
                    viewerName={customerDisplayName}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Customer Local Transport Bookings */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'My Local Transport & Bike Taxi Bookings', 'मेरी स्थानीय वाहन व बाइक टैक्सी बुकिंग', 'माझी लोकल ट्रान्सपोर्ट व बाईक टॅक्सी बुकिंग')} ({customerVehicleBookings.length})
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('transport')}
            className="text-xs font-semibold text-[#15803D] hover:underline cursor-pointer"
          >
            {tr(lang, 'Book Another Vehicle', 'नया वाहन बुक करें', 'नवीन वाहन बुक करा')} →
          </button>
        </div>

        {customerVehicleBookings.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">{t.common.noRecords}</p>
        ) : (
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
        )}
      </section>

      <UserNotificationCenter
        mode="employer"
        onNavigateToTarget={onNavigateToTarget || ((r) => onNavigate(r))}
      />
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
  | 'jobs'
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
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [isAdmin]);

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
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#C25E00]">ABUJMAD FOUNDATION · Governance Console</p>
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
            { id: 'jobs', label: `Jobs (${jobs.length})`, icon: FileText },
            { id: 'notifications', label: '📲 Live Notification Demo', icon: BellRing },
            { id: 'grievances', label: `${t.dashboards.grievances} (${grievances.length})`, icon: AlertTriangle },
            { id: 'enquiries', label: `${t.dashboards.enquiries} (${enquiries.length})`, icon: Shield },
            { id: 'announcements', label: `${t.dashboards.announcements} (${announcements.length})`, icon: Megaphone },
            { id: 'audit', label: `${t.dashboards.auditLogs} (${auditLogs.length})`, icon: CheckCircle2 },
          ] as { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((item) => {
          const Icon = item.icon;
          const isNotif = item.id === 'notifications';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                tab === item.id
                  ? isNotif
                    ? 'bg-[#E06D1B] text-white'
                    : 'bg-[#0B3B75] text-white'
                  : isNotif
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

      {tab === 'notifications' && (
        <AdminNotificationDemoPanel workers={workers} employers={employers} />
      )}

      {/* Tab Content */}
      {tab === 'workers' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">Registered Workers</h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-workers.csv',
                  ['Registration ID', 'Name', 'Primary Skill', 'State', 'District', 'Wage', 'Status'],
                  workers.map((w) => [w.registrationId, w.displayName, w.primarySkill, w.state, w.district, w.expectedWage, w.verificationStatus])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.dashboards.exportCsv}
            </button>
          </div>
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
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((w) => (
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
                      <td className="py-3 pr-4 font-semibold uppercase text-xs">{w.verificationStatus}</td>
                      <td className="py-3 flex flex-wrap gap-2">
                        {w.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={async () => {
                              setBusyId(w.id);
                              await adminUpdateVerification('publicWorkers', w.id, 'verified', user.uid, adminEmail);
                              setBusyId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                          >
                            {t.dashboards.adminVerify}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'employers' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">Registered Employers</h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'rojgar-setu-employers.csv',
                  ['Registration ID', 'Business Name', 'Type', 'State', 'District', 'Status'],
                  employers.map((e) => [e.registrationId, e.businessName, e.businessType, e.state, e.district, e.verificationStatus])
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
                    <th className="py-2 pr-4">Business</th>
                    <th className="py-2 pr-4">Industry</th>
                    <th className="py-2 pr-4">District</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employers.map((emp) => (
                    <tr key={emp.id}>
                      <td className="py-3 pr-4 font-mono-tabular text-xs">{emp.registrationId}</td>
                      <td className="py-3 pr-4 font-semibold text-[#0B3B75]">
                        <div className="flex items-center gap-2.5">
                          <SecureAvatar
                            name={emp.businessName}
                            photoDocId={buildCustomerPhotoDocId(emp.ownerUid)}
                            sizeClass="w-8 h-8"
                            textSizeClass="text-[11px]"
                          />
                          <span>{emp.businessName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{emp.industryCategory}</td>
                      <td className="py-3 pr-4 text-slate-600">{emp.district}, {emp.state}</td>
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
                  ))}
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
