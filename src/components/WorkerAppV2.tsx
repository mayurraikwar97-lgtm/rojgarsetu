import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  AlertCircle,
  BellRing,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Gift,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  Play,
  Power,
  ShieldCheck,
  Star,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { useLanguage } from '../i18n/LanguageContext';
import {
  cancelDeal,
  completeDeal,
  doesWorkerMatchJob,
  getEffectiveDealStatus,
  markWorkerArrived,
  markWorkerOnTheWay,
  respondToHiringInvite,
  startWorkByWorker,
  submitWorkerOffer,
  subscribeWorkerApplications,
  updateWorkerAvailabilityStatus,
  updateWorkerPreferredRadius,
} from '../lib/firestoreService';
import { getSafeCustomerLabelForJobOrApp } from '../lib/customerPrivacy';
import {
  SERVICE_RADIUS_STAGES,
  calculateValidDistanceKm,
  getLocalizedCategoryLabel,
  getPublicJobLocationText,
  isJobConfirmationClosed,
} from '../lib/smartVoiceJobAlert';
import {
  isWorkerPaidBenefitsActive,
  isWorkerPaymentPaid,
  subscribeWorkerOwnPayment,
} from '../lib/workerPaymentService';
import type {
  AppNotificationRecord,
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  ServiceRadiusKm,
  WorkerRegistrationPayment,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';
import { DealCoordinationPanel } from './DealCoordinationPanel';
import { UserNotificationCenter } from './UserNotificationCenter';
import {
  PaymentStatusBadge,
  WorkerDigitalIdCard,
  WorkerPaymentCheckoutCard,
  WorkerPaymentHistoryCard,
  WorkerPaymentReceiptCard,
  WorkerRegistrationCertificateCard,
} from './WorkerCertificateAndReceipt';
import { WorkerReferralsTab } from './WorkerReferralsTab';

interface WorkerAppV2Props {
  jobs: JobPosting[];
  notifications?: AppNotificationRecord[];
  unreadNotificationsCount?: number;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
  onNavigateToTarget?: (route: PageRoute, jobId?: string, demoJobId?: string) => void;
  highlightedJobId?: string;
  onClearHighlightedJob?: () => void;
}

type WorkerTab = 'new_requests' | 'active_job' | 'completed' | 'earnings' | 'referrals' | 'profile';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export const WorkerAppV2: React.FC<WorkerAppV2Props> = ({
  jobs,
  notifications = [],
  unreadNotificationsCount = 0,
  onNavigate,
  onNavigateToTarget,
  highlightedJobId = '',
  onClearHighlightedJob,
}) => {
  const { lang } = useLanguage();
  const { user, authReady, workerProfile, workerPrivate, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<WorkerTab>('new_requests');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [updatingRadius, setUpdatingRadius] = useState(false);
  const [areaPincodeFilter, setAreaPincodeFilter] = useState('');

  // Direct cold-start fallback if notification deep-linked to a jobId not yet in live list
  const [fetchedSpotlightJob, setFetchedSpotlightJob] = useState<JobPosting | null>(null);

  // Accept / Quote Sheet per jobId
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteEta, setQuoteEta] = useState('30 mins');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [dismissedJobIds, setDismissedJobIds] = useState<string[]>([]);

  // Completed Jobs Latest-3 toggle
  const [showArchivedCompleted, setShowArchivedCompleted] = useState(false);

  // Photo Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [ownPayment, setOwnPayment] = useState<WorkerRegistrationPayment | null>(null);

  useEffect(() => {
    if (!authReady || !user) return;
    const u1 = subscribeWorkerApplications(user.uid, setApplications);
    const u2 = subscribeWorkerOwnPayment(user.uid, setOwnPayment);
    return () => {
      u1();
      u2();
    };
  }, [authReady, user]);

  // If notification clicked OPEN with highlightedJobId, switch straight to New Requests (or Active Job if already accepted)
  useEffect(() => {
    if (!highlightedJobId) return;
    const existingApp = applications.find((a) => a.jobId === highlightedJobId);
    if (existingApp && existingApp.status === 'accepted') {
      setActiveTab('active_job');
    } else {
      setActiveTab('new_requests');
    }

    const inLiveList = jobs.some((j) => j.id === highlightedJobId);
    if (!inLiveList) {
      let cancelled = false;
      void getDoc(doc(db, 'jobs', highlightedJobId))
        .then((snap) => {
          if (!cancelled && snap.exists()) {
            setFetchedSpotlightJob({ id: snap.id, ...snap.data() } as JobPosting);
          }
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    } else {
      setFetchedSpotlightJob(null);
    }
  }, [highlightedJobId, jobs, applications]);

  const appsByJobId = useMemo(() => {
    const map = new Map<string, JobApplication>();
    applications.forEach((a) => map.set(a.jobId, a));
    return map;
  }, [applications]);

  // 1. New Requests: Direct invites + matching open nearby jobs (never showing already-accepted/completed/declined)
  const newRequestItems = useMemo(() => {
    if (!workerProfile) return [];
    const seen = new Set<string>();
    const list: Array<{ job: JobPosting; app?: JobApplication; distanceKm: number | null; isSpotlight: boolean }> = [];

    const pushJob = (job: JobPosting, isSpotlight: boolean) => {
      if (!job || seen.has(job.id)) return;
      if (dismissedJobIds.includes(job.id) && !isSpotlight) return;
      if (job.employerUid === workerProfile.ownerUid) return;
      if (job.status === 'completed' || job.status === 'cancelled') return;

      const app = appsByJobId.get(job.id);
      if (app && (app.status === 'accepted' || app.status === 'work_completed' || app.status === 'declined')) {
        return;
      }
      // If job already confirmed/closed by another worker, immediately remove from queue
      if (isJobConfirmationClosed(job) && job.acceptedWorkerUid !== workerProfile.ownerUid) {
        return;
      }
      // If job already accepted by another worker, skip
      if (job.acceptedWorkerUid && job.acceptedWorkerUid !== workerProfile.ownerUid) {
        return;
      }
      // If worker already sent offer and customer didn't request revision, show in Active tab instead (unless spotlight)
      if (app && app.status === 'applied' && !app.quoteRevisionRequested && !isSpotlight) {
        return;
      }

      const dist = calculateValidDistanceKm(
        job.lat,
        job.lng,
        workerProfile.approxLat,
        workerProfile.approxLng
      );
      seen.add(job.id);
      list.push({ job, app, distanceKm: dist, isSpotlight });
    };

    // Priority 1: Spotlight job from OPEN notification
    if (highlightedJobId) {
      const found = jobs.find((j) => j.id === highlightedJobId) || (fetchedSpotlightJob?.id === highlightedJobId ? fetchedSpotlightJob : null);
      if (found) pushJob(found, true);
    }

    // Priority 2: Invited or quote-revision applications
    applications.forEach((a) => {
      if (a.status === 'invited' || (a.status === 'applied' && a.quoteRevisionRequested)) {
        const j = jobs.find((x) => x.id === a.jobId);
        if (j) pushJob(j, j.id === highlightedJobId);
      }
    });

    // Priority 3: Open jobs matching worker category (respecting active small-batch fair rotation)
    jobs.forEach((j) => {
      if (j.status !== 'open' || isJobConfirmationClosed(j)) return;
      const notifiedList = Array.isArray(j.notifiedWorkerUids) ? j.notifiedWorkerUids : [];
      const notified = notifiedList.includes(workerProfile.ownerUid);
      const isBatchDispatched = (Number(j.dispatchBatchIndex) || 0) >= 1 && notifiedList.length > 0;
      if (isBatchDispatched && !notified) {
        return;
      }
      const matchCheck = doesWorkerMatchJob(j, { ...workerProfile, availabilityStatus: 'available' });
      if (notified || matchCheck.matches) {
        pushJob(j, j.id === highlightedJobId);
      }
    });

    return list.sort((a, b) => {
      if (a.isSpotlight !== b.isSpotlight) return a.isSpotlight ? -1 : 1;
      return getTimestampMs(b.job.createdAt) - getTimestampMs(a.job.createdAt);
    });
  }, [jobs, applications, appsByJobId, workerProfile, highlightedJobId, fetchedSpotlightJob, dismissedJobIds]);

  // 1b. Jobs this worker was alerted/invited for (or opened via notification) that another worker already confirmed
  const confirmedByOtherNotices = useMemo(() => {
    if (!workerProfile) return [];
    const seen = new Set<string>();
    const results: Array<{ job: JobPosting; isSpotlight: boolean }> = [];
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

    const consider = (job: JobPosting | null | undefined, isSpotlight: boolean) => {
      if (!job || seen.has(job.id)) return;
      if (dismissedJobIds.includes(job.id) && !isSpotlight) return;
      if (job.employerUid === workerProfile.ownerUid) return;
      const myApp = appsByJobId.get(job.id);
      if (myApp?.status === 'accepted' || job.acceptedWorkerUid === workerProfile.ownerUid) return;
      const filledByOther =
        isJobConfirmationClosed(job) &&
        job.status !== 'cancelled' &&
        job.dealStatus !== 'CANCELLED' &&
        (Boolean(job.acceptedWorkerUid && job.acceptedWorkerUid !== workerProfile.ownerUid) ||
          Boolean(job.acceptedApplicationId) ||
          job.dealStatus === 'DEAL_CONFIRMED' ||
          job.dealStatus === 'WORKER_ON_THE_WAY' ||
          job.dealStatus === 'WORK_IN_PROGRESS' ||
          job.status === 'in_progress');
      if (!filledByOther) return;
      seen.add(job.id);
      results.push({ job, isSpotlight });
    };

    if (highlightedJobId) {
      const target =
        jobs.find((j) => j.id === highlightedJobId) ||
        (fetchedSpotlightJob?.id === highlightedJobId ? fetchedSpotlightJob : null);
      consider(target, true);
    }

    jobs.forEach((j) => {
      const wasNotified =
        Array.isArray(j.notifiedWorkerUids) && j.notifiedWorkerUids.includes(workerProfile.ownerUid);
      const hadApp = appsByJobId.has(j.id);
      const updatedMs = getTimestampMs(j.updatedAt || j.createdAt);
      if ((wasNotified || hadApp) && (updatedMs === 0 || updatedMs >= twelveHoursAgo)) {
        consider(j, j.id === highlightedJobId);
      }
    });

    return results
      .sort((a, b) => {
        if (a.isSpotlight !== b.isSpotlight) return a.isSpotlight ? -1 : 1;
        return getTimestampMs(b.job.updatedAt || b.job.createdAt) - getTimestampMs(a.job.updatedAt || a.job.createdAt);
      })
      .slice(0, 3);
  }, [jobs, appsByJobId, workerProfile, highlightedJobId, fetchedSpotlightJob, dismissedJobIds]);

  // 2. Active Jobs (confirmed deals + pending offers waiting for customer confirmation)
  const activeApps = useMemo(() => {
    return applications
      .filter((a) => a.status === 'accepted' || a.status === 'applied')
      .sort((a, b) => {
        if (a.status === 'accepted' && b.status !== 'accepted') return -1;
        if (b.status === 'accepted' && a.status !== 'accepted') return 1;
        return getTimestampMs(b.updatedAt || b.createdAt) - getTimestampMs(a.updatedAt || a.createdAt);
      });
  }, [applications]);

  // 3. Completed Deals (All preserved in Firestore; latest 3 visible by default!)
  const completedApps = useMemo(() => {
    return applications
      .filter((a) => a.status === 'work_completed' || a.dealStatus === 'WORK_COMPLETED')
      .sort((a, b) => getTimestampMs(b.completedAt || b.updatedAt) - getTimestampMs(a.completedAt || a.updatedAt));
  }, [applications]);

  const visibleCompletedApps = showArchivedCompleted ? completedApps : completedApps.slice(0, 3);

  // 4. Earnings Metrics
  const earningsStats = useMemo(() => {
    const totalEarned = completedApps.reduce(
      (sum, a) => sum + (a.agreedPrice ?? a.offerAmount ?? a.proposedWage ?? 0),
      0
    );
    const ratedApps = completedApps.filter((a) => typeof a.workerRating === 'number' && a.workerRating > 0);
    const avgRating =
      ratedApps.length > 0
        ? Math.round((ratedApps.reduce((s, a) => s + (a.workerRating || 0), 0) / ratedApps.length) * 10) / 10
        : workerProfile?.ratingAvg || 0;
    return {
      totalEarned,
      completedCount: Math.max(completedApps.length, workerProfile?.completedJobsCount || 0),
      avgRating,
    };
  }, [completedApps, workerProfile]);

  const handleToggleAvailability = async () => {
    if (!user || !workerProfile) return;
    const nextStatus = workerProfile.availabilityStatus === 'available' ? 'offline' : 'available';
    setTogglingAvailability(true);
    setActionError('');
    try {
      await updateWorkerAvailabilityStatus(user.uid, nextStatus);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update availability.');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleQuickRadiusChange = async (nextRadius: ServiceRadiusKm) => {
    if (!user || !workerProfile) return;
    setUpdatingRadius(true);
    setActionError('');
    try {
      await updateWorkerPreferredRadius(user.uid, nextRadius);
      setActionFeedback(
        tr(
          lang,
          `Nearby job alert radius updated to ${nextRadius} km.`,
          `नज़दीकी काम अलर्ट का दायरा ${nextRadius} किमी सेट किया गया।`,
          `जवळच्या कामाचा अलर्ट परिसर ${nextRadius} किमी सेट केला.`
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update alert radius.');
    } finally {
      setUpdatingRadius(false);
    }
  };

  const handleOpenAcceptForm = (job: JobPosting, existingApp?: JobApplication) => {
    setAcceptingJobId(job.id);
    const priorWorkerQuote =
      existingApp?.offerAmount && existingApp.offerAmount > 0
        ? String(existingApp.offerAmount)
        : '';
    setQuoteAmount(priorWorkerQuote);
    setQuoteEta('30 mins');
    setQuoteMessage('');
    setActionError('');
  };

  const handleSubmitAcceptOffer = async (job: JobPosting, existingApp?: JobApplication) => {
    if (!user || !workerProfile) return;
    const rawNum = Number(quoteAmount);
    if (!Number.isFinite(rawNum) || rawNum < 1) {
      setActionError(
        tr(
          lang,
          'Please enter your rate (₹) after reading the work description and viewing photos.',
          'कृपया काम का विवरण पढ़कर और फ़ोटो देखकर अपना दर (₹) दर्ज करें।',
          'कृपया कामाचे वर्णन वाचून व फोटो पाहून तुमचा दर (₹) टाका.'
        )
      );
      return;
    }
    const parsedPrice = Math.round(rawNum);
    setActionBusyId(job.id);
    setActionError('');
    setActionFeedback('');
    try {
      await submitWorkerOffer({
        job,
        worker: workerProfile,
        workerUid: user.uid,
        offeredPrice: parsedPrice,
        estimatedArrivalTime: quoteEta.trim() || '30 mins',
        offerMessage:
          quoteMessage.trim() ||
          tr(
            lang,
            `Ready to take this work for ₹${parsedPrice}.`,
            `मैं ₹${parsedPrice} में यह काम करने के लिए तैयार हूँ।`,
            `मी ₹${parsedPrice} मध्ये हे काम करण्यासाठी तयार आहे.`
          ),
        existingApplicationId: existingApp?.id,
      });
      setAcceptingJobId(null);
      onClearHighlightedJob?.();
      setActionFeedback(
        tr(
          lang,
          'Job accepted & price sent to customer! Waiting for customer confirmation.',
          'काम स्वीकार किया और दर ग्राहक को भेज दी! ग्राहक की पुष्टि की प्रतीक्षा है।',
          'काम स्वीकारले व दर ग्राहकाला पाठवला! ग्राहकाच्या निश्चितीची प्रतीक्षा आहे.'
        )
      );
      setActiveTab('active_job');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      if (rawMsg.toLowerCase().includes('already been confirmed') || rawMsg.toLowerCase().includes('already confirmed')) {
        setActionError(
          tr(
            lang,
            'This job was just confirmed by another worker. Your fair-rotation priority for upcoming jobs remains unaffected.',
            'यह काम अभी किसी अन्य कामगार द्वारा कन्फर्म कर दिया गया है। आने वाले कामों के लिए आपकी समान बारी सुरक्षित है।',
            'हे काम आत्ताच दुसऱ्या कामगाराने कन्फर्म केले आहे. पुढील कामांसाठी तुमची समान बारी सुरक्षित आहे.'
          )
        );
        setAcceptingJobId(null);
      } else {
        setActionError(rawMsg || 'Unable to send acceptance.');
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmInvitedJob = async (job: JobPosting, app: JobApplication) => {
    if (!user || !workerProfile) return;
    setActionBusyId(job.id);
    setActionError('');
    setActionFeedback('');
    try {
      await respondToHiringInvite({
        app,
        decision: 'accepted',
        workerName: workerProfile.displayName,
        jobLocationLabel: job.approxLocationLabel || job.workLocationLabel || job.district,
      });
      setAcceptingJobId(null);
      onClearHighlightedJob?.();
      setActionFeedback(
        tr(
          lang,
          `Job Confirmed! "${job.subService || job.title}" is now assigned to you. Contact the customer below and tap ON THE WAY when ready.`,
          `काम कन्फर्म हुआ! "${job.subService || job.title}" आपको सौंप दिया गया है। नीचे ग्राहक से संपर्क करें और निकलने पर "रास्ते में हूँ" दबाएँ।`,
          `काम कन्फर्म झाले! "${job.subService || job.title}" तुम्हाला मिळाले आहे. खाली ग्राहकाशी संपर्क साधा व निघताना "निघालो आहे" दाबा.`
        )
      );
      setActiveTab('active_job');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      if (rawMsg.toLowerCase().includes('already confirmed') || rawMsg.toLowerCase().includes('already been confirmed')) {
        setActionError(
          tr(
            lang,
            'This job was already confirmed by another worker. Your fair-rotation priority for upcoming jobs remains unaffected.',
            'यह काम पहले ही किसी अन्य कामगार द्वारा कन्फर्म कर दिया गया है। आने वाले कामों में आपकी समान बारी सुरक्षित है।',
            'हे काम आधीच दुसऱ्या कामगाराने कन्फर्म केले आहे. पुढील कामांसाठी तुमची समान बारी सुरक्षित आहे.'
          )
        );
      } else {
        setActionError(rawMsg || 'Unable to confirm job.');
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeclineJob = async (job: JobPosting, existingApp?: JobApplication) => {
    setActionBusyId(job.id);
    setActionError('');
    try {
      if (existingApp && workerProfile) {
        await respondToHiringInvite({
          app: existingApp,
          decision: 'declined',
          workerName: workerProfile.displayName,
          jobLocationLabel: job.approxLocationLabel || job.district,
        });
      }
      setDismissedJobIds((prev) => [...prev, job.id]);
      if (highlightedJobId === job.id) onClearHighlightedJob?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to decline request.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleWorkerStageAction = async (
    app: JobApplication,
    stageAction: 'on_the_way' | 'arrived' | 'start_work' | 'work_done' | 'cancel'
  ) => {
    if (!user || !workerProfile) return;
    setActionBusyId(app.id);
    setActionError('');
    setActionFeedback('');
    try {
      if (stageAction === 'on_the_way') {
        await markWorkerOnTheWay({ app, workerName: workerProfile.displayName });
        setActionFeedback(tr(lang, 'Customer notified that you are ON THE WAY.', 'ग्राहक को सूचित किया कि आप रास्ते में हैं।', 'तुम्ही निघाला आहात अशी सूचना ग्राहकाला पाठवली.'));
      } else if (stageAction === 'arrived') {
        await markWorkerArrived({ app, workerName: workerProfile.displayName });
        setActionFeedback(tr(lang, 'Customer notified that you have ARRIVED.', 'ग्राहक को सूचित किया कि आप पहुँच गए हैं।', 'तुम्ही पोहोचला आहात अशी सूचना ग्राहकाला पाठवली.'));
      } else if (stageAction === 'start_work') {
        await startWorkByWorker({ app, workerName: workerProfile.displayName });
        setActionFeedback(tr(lang, 'Work marked as STARTED.', 'काम शुरू होने की सूचना भेज दी गई।', 'काम सुरू झाल्याची नोंद झाली.'));
      } else if (stageAction === 'work_done') {
        await completeDeal({
          app,
          actorUid: user.uid,
          actorRole: 'worker',
          actorName: workerProfile.displayName,
        });
        setActionFeedback(tr(lang, 'Work marked DONE! Customer notified to submit rating.', 'काम पूर्ण हो गया! ग्राहक को रेटिंग के लिए सूचित किया गया।', 'काम पूर्ण झाले! ग्राहकाला रेटिंग देण्यासाठी सूचना पाठवली.'));
        setActiveTab('completed');
      } else if (stageAction === 'cancel') {
        await cancelDeal({
          app,
          actorUid: user.uid,
          actorRole: 'worker',
          actorName: workerProfile.displayName,
          reason: 'Cancelled by worker',
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update job status.');
    } finally {
      setActionBusyId(null);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#0B3B75]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto">
          <Briefcase className="w-7 h-7 text-[#0B3B75]" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-[#0B3B75]">
          {tr(lang, "Today's Job Opportunities", 'आज का काम का अवसर', 'आजची कामाची संधी')}
        </h1>
        <p className="text-sm text-slate-600">
          {tr(
            lang,
            'Sign in to receive nearby job requests and manage your active work.',
            'अपने आस-पास के काम पाने के लिए लॉगिन करें।',
            'तुमच्या जवळच्या कामाच्या संधी मिळवण्यासाठी लॉगिन करा.'
          )}
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="h-12 px-6 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold cursor-pointer"
        >
          {tr(lang, 'Sign In with Google', 'Google से लॉगिन करें', 'Google ने लॉगिन करा')}
        </button>
      </div>
    );
  }

  if (!workerProfile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Wrench className="w-7 h-7 text-[#E06D1B]" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-[#0B3B75]">
          {tr(lang, 'Register as a Rojgar Setu Worker', 'रोजगार सेतु कामगार पंजीकरण', 'रोजगार सेतू कामगार नोंदणी')}
        </h1>
        <p className="text-sm text-slate-600">
          {tr(
            lang,
            'Complete your ₹250 one-time verified Worker Registration to receive your Unique Worker ID, Digital ID Card, Registration Certificate, and nearby job requests within 2 km – 10 km.',
            '₹250 एकमुश्त सत्यापित कामगार पंजीकरण पूरा करें और अपना डिजिटल ID कार्ड, पंजीकरण प्रमाणपत्र व 2–10 किमी के दायरे में काम पाएँ।',
            '₹250 एकवेळ सत्यापित कामगार नोंदणी पूर्ण करा आणि तुमचे डिजिटल ओळखपत्र, प्रमाणपत्र व २–१० किमी परिसरातील कामाच्या संधी मिळवा.'
          )}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('register-worker')}
          className="h-12 px-6 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-extrabold cursor-pointer"
        >
          {tr(lang, 'Complete Worker Registration', 'कामगार पंजीकरण शुरू करें', 'कामगार नोंदणी सुरू करा')}
        </button>
      </div>
    );
  }

  const isAvailable = workerProfile.availabilityStatus === 'available';

  const tabs: Array<{ id: WorkerTab; label: string; count?: number }> = [
    { id: 'new_requests', label: tr(lang, 'New Requests', 'नई रिक्वेस्ट', 'नवीन संधी'), count: newRequestItems.length },
    { id: 'active_job', label: tr(lang, 'My Active Job', 'सक्रिय काम', 'सुरू काम'), count: activeApps.length },
    { id: 'completed', label: tr(lang, 'Completed', 'पूर्ण काम', 'पूर्ण कामे'), count: Math.min(3, completedApps.length) },
    { id: 'earnings', label: tr(lang, 'Earnings', 'कमाई', 'उत्पन्न') },
    { id: 'referrals', label: tr(lang, 'My Referrals', 'मेरे रेफरल', 'माझे रेफरल') },
    { id: 'profile', label: tr(lang, 'Profile', 'प्रोफ़ाइल', 'प्रोफाईल') },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F8FAFC] pb-24 md:pb-12">
      {/* Top Worker Header + Prominent AVAILABLE / OFFLINE Toggle */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#E06D1B]">
                {getLocalizedCategoryLabel(workerProfile.primarySkill, lang)} · {workerProfile.cityOrVillage}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B3B75]">
                {tr(lang, "Today's Job Opportunities", 'आज का काम का अवसर', 'आजची कामाची संधी')}
              </h1>
            </div>

            {/* Large Tactile AVAILABLE / OFFLINE Switch */}
            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={togglingAvailability}
              className={`h-12 px-5 rounded-xl border-2 font-extrabold text-sm inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer shrink-0 ${
                isAvailable
                  ? 'bg-[#15803D] border-[#15803D] text-white hover:bg-[#116830]'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {isAvailable
                  ? tr(lang, 'AVAILABLE · Online', 'उपलब्ध · ऑनलाइन', 'उपलब्ध (AVAILABLE)')
                  : tr(lang, 'OFFLINE · Paused', 'ऑफ़लाइन · बंद', 'ऑफलाइन (OFFLINE)')}
              </span>
            </button>
          </div>

          {/* Prominent Worker Alert Zone (Area / Pincode + Quick Radius Selector) */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2 min-w-0 text-xs">
              <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0">
                <span className="font-bold text-[#0B3B75]">
                  {tr(lang, 'Nearby Alert Zone:', 'नज़दीकी अलर्ट क्षेत्र:', 'जवळचा अलर्ट परिसर:')}{' '}
                </span>
                <span className="font-semibold text-slate-700">
                  {[workerProfile.cityOrVillage, workerProfile.district, workerProfile.state]
                    .filter(Boolean)
                    .join(', ')}
                </span>
                {workerPrivate?.preferredWorkLocation && (
                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[11px] font-semibold text-[#0B3B75]">
                    {workerPrivate.preferredWorkLocation}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-600">
                {tr(lang, 'Alert Radius:', 'अलर्ट दूरी:', 'अलर्ट अंतर:')}
              </span>
              {SERVICE_RADIUS_STAGES.map((km) => {
                const active = (workerProfile.preferredRadiusKm || 5) === km;
                return (
                  <button
                    key={km}
                    type="button"
                    disabled={updatingRadius}
                    onClick={() => handleQuickRadiusChange(km)}
                    className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0B3B75] text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-[#0B3B75]'
                    }`}
                  >
                    {km} km
                  </button>
                );
              })}
            </div>
          </div>

          {!isAvailable && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-semibold text-amber-900">
              {tr(
                lang,
                'You are currently OFFLINE. New customer job requests will not be sent until you switch back to AVAILABLE.',
                'आप अभी ऑफ़लाइन हैं। जब तक आप "उपलब्ध" चालू नहीं करते, नए काम की सूचना नहीं आएगी।',
                'तुम्ही सध्या OFFLINE आहात. तुम्ही पुन्हा AVAILABLE सुरू करेपर्यंत नवीन कामाची रिक्वेस्ट येणार नाही.'
              )}
            </div>
          )}

          {/* Clean 5-Section Tab Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B3B75] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.id === 'referrals' && <Gift className="w-3.5 h-3.5 text-[#E06D1B]" />}
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-extrabold ${
                        active ? 'bg-white/20 text-white' : 'bg-white text-[#0B3B75]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Worker Tab Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-4">
        <BrandSloganBanner variant="dashboard" />

        {actionFeedback && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              {actionFeedback}
            </span>
            <button type="button" onClick={() => setActionFeedback('')} className="text-emerald-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700">
            {actionError}
          </div>
        )}

        {/* ================= TAB 1: NEW REQUESTS ================= */}
        {activeTab === 'new_requests' && (() => {
          const locQ = areaPincodeFilter.trim().toLowerCase();
          const filteredRequests = locQ
            ? newRequestItems.filter(({ job }) => {
                const locBlob = `${job.cityOrVillage || ''} ${job.district || ''} ${job.state || ''} ${job.approxLocationLabel || ''} ${job.workLocationLabel || ''} ${job.title || ''}`.toLowerCase();
                return locBlob.includes(locQ);
              })
            : newRequestItems;
          return (
          <div className="space-y-4">
            {newRequestItems.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <MapPin className="w-4 h-4 text-[#E06D1B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={areaPincodeFilter}
                    onChange={(e) => setAreaPincodeFilter(e.target.value)}
                    placeholder={tr(
                      lang,
                      'Filter requests by area or 6-digit pincode...',
                      'क्षेत्र या 6-अंकीय पिनकोड से फ़िल्टर करें...',
                      'परिसर किंवा ६-अंकी पिनकोडने शोधा...'
                    )}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-[#0B3B75]"
                  />
                </div>
                {areaPincodeFilter && (
                  <button
                    type="button"
                    onClick={() => setAreaPincodeFilter('')}
                    className="text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer self-start sm:self-auto"
                  >
                    {tr(lang, 'Clear area filter', 'फ़िल्टर हटाएँ', 'फिल्टर काढा')}
                  </button>
                )}
              </div>
            )}

            {/* Notice for alerted jobs already confirmed by another worker (prevents double-confirmation) */}
            {confirmedByOtherNotices.length > 0 && (
              <div className="space-y-2.5">
                {confirmedByOtherNotices.map(({ job, isSpotlight }) => (
                  <div
                    key={`filled_${job.id}`}
                    className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                      isSpotlight
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200/70'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-[11px] font-extrabold text-amber-900">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {tr(
                            lang,
                            'Confirmed by Another Worker',
                            'अन्य कामगार ने कन्फर्म किया',
                            'दुसऱ्या कामगाराने कन्फर्म केले'
                          )}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {getLocalizedCategoryLabel(job.category, lang)}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-[#0B3B75]">
                        {job.subService || job.title}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {tr(
                          lang,
                          'This job has already been confirmed by another worker and is now closed. Your fair-rotation turn is not affected — you remain prioritized for upcoming jobs.',
                          'यह काम पहले ही किसी अन्य कामगार द्वारा कन्फर्म किया जा चुका है। आपकी समान बारी पर कोई असर नहीं पड़ा है — अगले काम में आपको प्राथमिकता मिलेगी।',
                          'हे काम आधीच दुसऱ्या कामगाराने कन्फर्म केले आहे व आता बंद झाले आहे. तुमच्या समान बारीवर कोणताही परिणाम झालेला नाही — पुढील कामात तुम्हाला प्राधान्य राहील.'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedJobIds((prev) => (prev.includes(job.id) ? prev : [...prev, job.id]));
                        if (highlightedJobId === job.id) onClearHighlightedJob?.();
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white cursor-pointer shrink-0"
                      aria-label="Dismiss notice"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {filteredRequests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <BellRing className="w-8 h-8 text-slate-300 mx-auto" />
                <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                  {areaPincodeFilter
                    ? tr(lang, 'No matching requests in this area/pincode', 'इस क्षेत्र/पिनकोड में कोई रिक्वेस्ट नहीं मिली', 'या परिसर/पिनकोडमध्ये सध्या रिक्वेस्ट नाही')
                    : tr(lang, 'No new job requests right now', 'अभी कोई नई रिक्वेस्ट नहीं है', 'सध्या कोणतीही नवीन कामाची रिक्वेस्ट नाही')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  {tr(
                    lang,
                    'Keep your status AVAILABLE. You will receive an instant notification sound as soon as a nearby customer requests your service.',
                    'अपनी स्थिति "उपलब्ध" रखें। जैसे ही कोई ग्राहक सेवा माँगेगा, आपको तुरंत अलर्ट मिलेगा।',
                    'तुमची स्थिती AVAILABLE ठेवा. जवळच्या ग्राहकाने रिक्वेस्ट पाठवताच तुम्हाला तात्काळ अलर्ट येईल.'
                  )}
                </p>
              </div>
            ) : (
              filteredRequests.map(({ job, app, distanceKm, isSpotlight }) => {
                const isAcceptOpen = acceptingJobId === job.id;
                const busy = actionBusyId === job.id;
                const photos = Array.isArray(job.workPhotoUrls) ? job.workPhotoUrls : [];
                return (
                  <div
                    key={job.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 ${
                      isSpotlight ? 'border-[#E06D1B] ring-2 ring-[#E06D1B]/15' : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E06D1B]">
                          {tr(lang, 'NEW JOB REQUEST', 'नया काम अनुरोध', 'नवीन कामाची रिक्वेस्ट')} ·{' '}
                          {getLocalizedCategoryLabel(job.category, lang)}
                        </div>
                        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                          {job.subService || job.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="font-bold text-[#0B3B75]">
                            {tr(lang, 'Customer', 'ग्राहक', 'ग्राहक')}:{' '}
                            {getSafeCustomerLabelForJobOrApp({
                              job,
                              app,
                              viewerRole: 'worker',
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                            {getPublicJobLocationText(job, false)}
                            {distanceKm !== null ? ` (~${distanceKm} km)` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {job.preferredTimeType === 'later' && job.jobDate
                              ? `${job.jobDate} ${job.startTime || ''}`
                              : tr(lang, 'Needed Now', 'अभी तुरंत', 'आता लगेच')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#15803D]">
                          {tr(
                            lang,
                            'Quote Your Rate',
                            'काम देखकर दर बताएँ',
                            'काम व फोटो पाहून दर सांगा'
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Customer revised quote prompt */}
                    {app?.quoteRevisionRequested && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-900">
                        {tr(
                          lang,
                          'Customer requested a revised price quote. Update your price below.',
                          'ग्राहक ने संशोधित दर का अनुरोध किया है। नीचे नया दर भेजें।',
                          'ग्राहकाने सुधारित दर मागितला आहे. खाली नवीन दर पाठवा.'
                        )}
                      </div>
                    )}

                    {/* Work Description */}
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      {job.description}
                    </p>

                    {/* Uploaded Customer Photos (Zoomable) */}
                    {photos.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-slate-500">
                          {tr(lang, 'Customer Work Photos (Tap to zoom)', 'ग्राहक द्वारा अपलोड फ़ोटो (ज़ूम करें)', 'ग्राहकाने अपलोड केलेले फोटो (झूम करण्यासाठी टॅप करा)')}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {photos.map((url, idx) => (
                            <button
                              key={`${job.id}_photo_${idx}`}
                              type="button"
                              onClick={() => setLightboxPhoto(url)}
                              className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-[#0B3B75] cursor-pointer"
                            >
                              <img
                                src={url}
                                alt={`Work reference ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Primary Actions: Confirm Direct Invite OR Accept & Quote Rate / Decline */}
                    {!isAcceptOpen ? (
                      <div className="space-y-2.5 pt-1">
                        {app?.status === 'invited' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleConfirmInvitedJob(job, app)}
                            className="w-full h-12 rounded-xl bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>
                              {tr(
                                lang,
                                `CONFIRM JOB${app.proposedWage > 0 ? ` (₹${app.proposedWage.toLocaleString('en-IN')})` : ''}`,
                                `काम कन्फर्म करें${app.proposedWage > 0 ? ` (₹${app.proposedWage.toLocaleString('en-IN')})` : ''}`,
                                `काम कन्फर्म करा${app.proposedWage > 0 ? ` (₹${app.proposedWage.toLocaleString('en-IN')})` : ''}`
                              )}
                            </span>
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleOpenAcceptForm(job, app)}
                            className={`h-12 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer ${
                              app?.status === 'invited'
                                ? 'border border-[#0B3B75] bg-white hover:bg-blue-50 text-[#0B3B75]'
                                : 'bg-[#15803D] hover:bg-[#116830] text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {app?.status === 'invited'
                                ? tr(lang, 'QUOTE OTHER RATE', 'अन्य दर बताएँ', 'वेगळा दर सांगा')
                                : tr(lang, 'ACCEPT JOB', 'काम स्वीकारें', 'काम स्वीकारा')}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeclineJob(job, app)}
                            className="h-12 rounded-xl border border-slate-300 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{tr(lang, 'DECLINE', 'अस्वीकार', 'नकारा')}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Simple 1-Step Worker Rate Quote After Reviewing Work & Photos */
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-3">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#15803D]">
                          {tr(
                            lang,
                            'Enter Your Rate After Checking Work & Photos',
                            'काम और फ़ोटो देखकर अपना दर बताएँ',
                            'काम वाचून किंवा फोटो पाहून तुमचा दर सांगा'
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {tr(lang, 'Your Rate Quote (₹) *', 'आपका दर (₹) *', 'तुमचा दर (₹) *')}
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={quoteAmount}
                              onChange={(e) => setQuoteAmount(e.target.value)}
                              placeholder={tr(lang, 'Enter rate in ₹', 'दर लिखें (₹)', 'दर टाका (₹)')}
                              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white font-mono-tabular text-base font-extrabold text-[#0B3B75]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {tr(lang, 'Arrival Time', 'पहुँचने का समय', 'पोहोचण्याची वेळ')}
                            </label>
                            <input
                              type="text"
                              value={quoteEta}
                              onChange={(e) => setQuoteEta(e.target.value)}
                              placeholder="e.g. 20 mins"
                              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={quoteMessage}
                          onChange={(e) => setQuoteMessage(e.target.value)}
                          placeholder={tr(
                            lang,
                            'Optional short note (e.g., I carry spare taps/parts)...',
                            'वैकल्पिक संदेश (जैसे: मेरे पास स्पेयर पार्ट्स हैं)...',
                            'ऐच्छिक संदेश (उदा. माझ्याकडे साहित्य उपलब्ध आहे)...'
                          )}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSubmitAcceptOffer(job, app)}
                            className="flex-1 h-11 rounded-lg bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{tr(lang, 'Send Acceptance & Price', 'स्वीकृति और दर भेजें', 'स्वीकृती व दर पाठवा')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcceptingJobId(null)}
                            className="h-11 px-4 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-600 cursor-pointer"
                          >
                            {tr(lang, 'Cancel', 'रद्द', 'रद्द')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          );
        })()}

        {/* ================= TAB 2: MY ACTIVE JOB ================= */}
        {activeTab === 'active_job' && (
          <div className="space-y-4">
            {activeApps.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                  {tr(lang, 'No active job yet', 'अभी कोई सक्रिय काम नहीं है', 'सध्या कोणतेही सुरू असलेले काम नाही')}
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('new_requests')}
                  className="text-xs font-bold text-[#E06D1B] hover:underline cursor-pointer"
                >
                  {tr(lang, 'View New Requests', 'नई रिक्वेस्ट देखें', 'नवीन संधी पहा')}
                </button>
              </div>
            ) : (
              activeApps.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);
                const ds = getEffectiveDealStatus(app);
                const isConfirmed = app.status === 'accepted';
                const busy = actionBusyId === app.id;
                const price = app.agreedPrice ?? app.offerAmount ?? app.proposedWage;

                return (
                  <div
                    key={app.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 ${
                      isConfirmed ? 'border-emerald-300 ring-1 ring-emerald-200/70' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-xs font-extrabold text-emerald-900">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                              {tr(lang, 'Job Confirmed', 'काम कन्फर्म हुआ', 'काम कन्फर्म झाले')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs font-extrabold text-amber-900">
                              <Clock className="w-3.5 h-3.5 text-[#E06D1B]" />
                              {tr(lang, 'Waiting for Customer Confirmation', 'ग्राहक की पुष्टि की प्रतीक्षा', 'ग्राहकाच्या निश्चितीची प्रतीक्षा')}
                            </span>
                          )}
                          {job?.category && (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {getLocalizedCategoryLabel(job.category, lang)}
                            </span>
                          )}
                        </div>
                        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                          {app.jobTitle}
                        </h2>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#0B3B75]">
                            {tr(lang, 'Customer', 'ग्राहक', 'ग्राहक')}:{' '}
                            {getSafeCustomerLabelForJobOrApp({
                              job,
                              app,
                              viewerRole: 'worker',
                            })}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                            {job ? getPublicJobLocationText(job, isConfirmed) : app.jobLocationLabel || app.jobDistrict}
                          </span>
                          {(job?.jobDate || app.jobDate) && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {job?.preferredTimeType === 'later'
                                  ? `${job.jobDate} ${job.startTime || ''}`
                                  : tr(lang, 'Needed Now', 'अभी तुरंत', 'आता लगेच')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="font-mono-tabular text-lg font-extrabold text-[#15803D]">
                        ₹{price.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Clear Confirmation Summary & Next Steps for Confirming Worker */}
                    {isConfirmed && (
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
                          <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
                          <span>
                            {tr(
                              lang,
                              'Assigned exclusively to you — other worker alerts are closed.',
                              'यह काम अब केवल आपको सौंपा गया है — अन्य कामगारों के अलर्ट बंद कर दिए गए हैं।',
                              'हे काम आता फक्त तुम्हाला मिळाले आहे — इतर कामगारांचे अलर्ट बंद झाले आहेत.'
                            )}
                          </span>
                        </div>
                        {job?.description && (
                          <p className="text-xs text-slate-700 leading-relaxed bg-white/80 rounded-lg px-3 py-2 border border-emerald-100">
                            {job.description}
                          </p>
                        )}
                        <div className="flex items-start gap-2 text-xs text-emerald-950 font-medium">
                          <PhoneCall className="w-3.5 h-3.5 text-[#0B3B75] shrink-0 mt-0.5" />
                          <span>
                            {tr(
                              lang,
                              'Next steps: Use Secure Call or Order Chat below to coordinate with the customer and view the unlocked service address, then tap ON THE WAY when leaving.',
                              'अगला कदम: नीचे सुरक्षित कॉल या ऑर्डर चैट से ग्राहक से बात करें और अनलॉक पता देखें, फिर निकलते समय "रास्ते में हूँ" दबाएँ।',
                              'पुढील पायरी: खालील सुरक्षित कॉल किंवा चॅटद्वारे ग्राहकाशी संपर्क साधा व अनलॉक पत्ता पहा, आणि निघताना "निघालो आहे" दाबा.'
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Sequential Worker Action Buttons (strictly after Customer Confirmation!) */}
                    {isConfirmed && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {(ds === 'OFFER_ACCEPTED' || ds === 'DEAL_CONFIRMED') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleWorkerStageAction(app, 'on_the_way')}
                            className="flex-1 min-w-[160px] h-12 px-4 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Navigation className="w-4 h-4 text-amber-300" />
                            <span>{tr(lang, 'ON THE WAY', 'रास्ते में हूँ', 'निघालो आहे')}</span>
                          </button>
                        )}

                        {(ds === 'OFFER_ACCEPTED' || ds === 'DEAL_CONFIRMED' || ds === 'WORKER_ON_THE_WAY') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleWorkerStageAction(app, 'arrived')}
                            className="flex-1 min-w-[150px] h-12 px-4 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>{tr(lang, 'ARRIVED', 'पहुँच गया', 'पोहोचलो')}</span>
                          </button>
                        )}

                        {(ds === 'WORKER_ON_THE_WAY' || ds === 'WORKER_ARRIVED' || ds === 'DEAL_CONFIRMED' || ds === 'OFFER_ACCEPTED') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleWorkerStageAction(app, 'start_work')}
                            className="flex-1 min-w-[150px] h-12 px-4 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-4 h-4" />
                            <span>{tr(lang, 'START WORK', 'काम शुरू करें', 'काम सुरू करा')}</span>
                          </button>
                        )}

                        {ds === 'WORK_IN_PROGRESS' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleWorkerStageAction(app, 'work_done')}
                            className="flex-1 min-w-[180px] h-12 px-5 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            <span>{tr(lang, 'WORK DONE', 'काम पूरा हुआ', 'काम पूर्ण झाले')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleWorkerStageAction(app, 'cancel')}
                          className="h-12 px-3.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                        >
                          {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
                        </button>
                      </div>
                    )}

                    {/* 6-Step Progress + Order Chat + Live Map (Map unlocked strictly when confirmed) */}
                    <DealCoordinationPanel
                      application={app}
                      job={job}
                      viewerUid={user.uid}
                      viewerRole="worker"
                      viewerName={workerProfile.displayName}
                      defaultExpanded={isConfirmed}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= TAB 3: COMPLETED JOBS (LATEST 3 VISIBLE) ================= */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                {tr(lang, 'Recent Completed Jobs (Latest 3)', 'हाल के पूर्ण काम (नवीनतम 3)', 'अलीकडील पूर्ण कामे (शेवटचे ३)')}
              </h2>
              <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                {completedApps.length} {tr(lang, 'total saved', 'कुल सुरक्षित', 'एकूण जतन')}
              </span>
            </div>

            {completedApps.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                {tr(lang, 'Completed jobs will appear here.', 'पूर्ण किए गए काम यहाँ दिखेंगे।', 'पूर्ण झालेली कामे येथे दिसतील.')}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {visibleCompletedApps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-extrabold text-[#0B3B75]">{app.jobTitle}</div>
                        <div className="text-xs text-slate-500">
                          {getSafeCustomerLabelForJobOrApp({
                            app,
                            viewerRole: 'worker',
                          })}{' '}
                          · {app.jobLocationLabel || app.jobDistrict}
                        </div>
                        {app.employerFeedback && (
                          <p className="text-xs text-slate-600 italic">“{app.employerFeedback}”</p>
                        )}
                      </div>
                      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                        <div className="font-mono-tabular text-base font-extrabold text-[#15803D]">
                          ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}
                        </div>
                        {app.workerRating ? (
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>{app.workerRating}/5</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {tr(lang, 'Completed', 'पूर्ण', 'पूर्ण')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {completedApps.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowArchivedCompleted((v) => !v)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B3B75] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {showArchivedCompleted ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>{tr(lang, 'Show Latest 3 Only', 'केवल नवीनतम 3 दिखाएँ', 'फक्त शेवटचे ३ दाखवा')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>
                          {tr(
                            lang,
                            `View Older Archived Jobs (${completedApps.length - 3})`,
                            `पुराने काम देखें (${completedApps.length - 3})`,
                            `जुनी जतन केलेली कामे पहा (${completedApps.length - 3})`
                          )}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= TAB 4: EARNINGS ================= */}
        {activeTab === 'earnings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tr(lang, 'Total Earnings', 'कुल कमाई', 'एकूण उत्पन्न')}
                </div>
                <div className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#15803D] flex items-center gap-1">
                  <IndianRupee className="w-6 h-6" />
                  <span>{earningsStats.totalEarned.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tr(lang, 'Completed Jobs', 'पूर्ण काम', 'पूर्ण कामे')}
                </div>
                <div className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#0B3B75]">
                  {earningsStats.completedCount}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tr(lang, 'Customer Rating', 'ग्राहक रेटिंग', 'ग्राहक रेटिंग')}
                </div>
                <div className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-amber-600 flex items-center gap-1.5">
                  <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
                  <span>{earningsStats.avgRating > 0 ? earningsStats.avgRating.toFixed(1) : 'New'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
              {tr(
                lang,
                'Rojgar Setu charges 0% commission. All earnings are paid directly by the customer via Cash or UPI.',
                'रोजगार सेतु 0% कमीशन लेता है। आपकी पूरी कमाई ग्राहक सीधे नकद या UPI से देते हैं।',
                'रोजगार सेतूवर ०% कमिशन आहे. तुमचे संपूर्ण पैसे ग्राहक थेट रोख किंवा UPI द्वारे देतात.'
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: PROFILE (WORKER REGISTRATION ID, ₹250 PAYMENT, CERTIFICATE & RECEIPT) ================= */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            {!isWorkerPaidBenefitsActive(workerProfile) && (
              <div
                className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm ${
                  isWorkerPaymentPaid(workerProfile, ownPayment)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-extrabold text-[#0B3B75]">
                    {isWorkerPaymentPaid(workerProfile, ownPayment)
                      ? tr(
                          lang,
                          '₹250 Fee PAID — Sent to ROJGAR SETU Admin Dashboard for Approval',
                          '₹250 शुल्क भुगतान पूर्ण (PAID) — रोजगार सेतु एडमिन स्वीकृति लंबित',
                          '₹250 नोंदणी शुल्क भरले (PAID) — रोजगार सेतु अ‍ॅडमिन मंजुरी प्रलंबित'
                        )
                      : tr(
                          lang,
                          '₹250 One-Time Registration Fee Required for Worker ID Card & Certificate',
                          'कामगार ID कार्ड और प्रमाणपत्र के लिए ₹250 पंजीकरण शुल्क आवश्यक है',
                          'कामगार ID कार्ड व प्रमाणपत्रासाठी ₹250 नोंदणी शुल्क आवश्यक आहे'
                        )}
                  </div>
                  <p className="text-xs text-slate-700">
                    {isWorkerPaymentPaid(workerProfile, ownPayment)
                      ? tr(
                          lang,
                          'Your ₹250 registration payment is PAID and verified on our server. Your Official Worker ID Card (RS-W-...) and Registration Certificate will unlock automatically once Admin approves your registration.',
                          'आपका ₹250 भुगतान सत्यापित (PAID) हो गया है। एडमिन स्वीकृति के बाद आपका कामगार ID कार्ड और प्रमाणपत्र यहाँ खुल जाएगा।',
                          'तुमचे ₹250 पेमेंट यशस्वी (PAID) झाले आहे. अ‍ॅडमिन मंजुरीनंतर तुमचे अधिकृत कामगार ID कार्ड व प्रमाणपत्र येथे आपोआप सुरू होईल.'
                        )
                      : tr(
                          lang,
                          'Complete your ₹250 payment below to submit your registration to ROJGAR SETU Admin for Worker ID Card & Certificate approval.',
                          'अपना कामगार ID कार्ड और प्रमाणपत्र प्राप्त करने के लिए नीचे ₹250 भुगतान पूरा करें।',
                          'कामगार ID कार्ड व प्रमाणपत्र मिळवण्यासाठी खाली ₹250 पेमेंट पूर्ण करा.'
                        )}
                  </p>
                </div>
                <PaymentStatusBadge
                  status={ownPayment?.status || workerProfile.registrationPaymentStatus || 'pending'}
                  lang={lang}
                />
              </div>
            )}

            {/* Upgraded Digital Worker Identity Card */}
            <WorkerDigitalIdCard
              workerProfile={workerProfile}
              workerPrivate={workerPrivate}
              payment={ownPayment}
              onEditProfile={() => onNavigate('register-worker')}
              updatingRadius={updatingRadius}
              onUpdateRadius={async (km) => {
                setUpdatingRadius(true);
                try {
                  await updateWorkerPreferredRadius(user.uid, km);
                } finally {
                  setUpdatingRadius(false);
                }
              }}
            />

            {/* Custom Profession Status & Work Portfolio */}
            {(workerProfile.customProfessionName ||
              workerProfile.workDescription ||
              (workerProfile.workPhotoUrls && workerProfile.workPhotoUrls.length > 0)) && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B3B75]">
                      {tr(lang, 'Profession & Work Portfolio', 'व्यवसाय और कार्य विवरण', 'व्यवसाय आणि कामाचा पोर्टफोलिओ')}
                    </h3>
                    <p className="text-xs font-semibold text-[#C25E00] mt-0.5">
                      {workerProfile.customProfessionName || workerProfile.primarySkill}
                    </p>
                  </div>
                  {workerProfile.customProfessionStatus && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        workerProfile.customProfessionStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : workerProfile.customProfessionStatus === 'rejected'
                          ? 'bg-red-50 text-red-800 border-red-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {workerProfile.customProfessionStatus === 'approved'
                        ? tr(lang, 'Approved & Searchable', 'स्वीकृत एवं खोज योग्य', 'मंजूर व शोधात उपलब्ध')
                        : workerProfile.customProfessionStatus === 'rejected'
                        ? tr(lang, 'Profession Rejected', 'व्यवसाय अस्वीकृत', 'व्यवसाय नाकारला')
                        : tr(lang, 'Pending Admin Approval', 'एडमिन स्वीकृति लंबित', 'अ‍ॅडमिन मंजुरी प्रलंबित')}
                    </span>
                  )}
                </div>

                {workerProfile.workDescription && (
                  <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                    {workerProfile.workDescription}
                  </p>
                )}

                {workerProfile.workPhotoUrls && workerProfile.workPhotoUrls.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500">
                      {tr(lang, 'Uploaded Work Photos', 'अपलोड किए गए कार्य फ़ोटो', 'अपलोड केलेले कामाचे फोटो')}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {workerProfile.workPhotoUrls.map((url, idx) => (
                        <button
                          key={`${url.slice(0, 32)}_${idx}`}
                          type="button"
                          onClick={() => setLightboxPhoto(url)}
                          className="rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100 hover:border-[#0B3B75] cursor-pointer"
                        >
                          <img
                            src={url}
                            alt={`Work sample ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ₹250 Registration Payment Checkout (shown ONLY if not yet PAID — prevents duplicate payment) */}
            {!isWorkerPaymentPaid(workerProfile, ownPayment) && !isWorkerPaidBenefitsActive(workerProfile) && (
              <WorkerPaymentCheckoutCard
                workerUid={user.uid}
                workerName={workerProfile.displayName}
                workerSkill={workerProfile.primarySkill}
                workerLocation={`${workerProfile.cityOrVillage}, ${workerProfile.district}, ${workerProfile.state}`}
                workerMobile={workerPrivate?.mobile || ''}
                provisionalAppId={workerProfile.registrationId}
                otpVerified={Boolean(workerPrivate?.mobileVerified)}
                referredByCode={workerProfile.referredByCode}
                referredByUid={workerProfile.referredByUid}
                existingPayment={ownPayment}
                preAcceptedPolicies={Boolean(workerPrivate?.refundPolicyAccepted)}
              />
            )}

            {/* Official Worker Registration Certificate (Unlocked strictly after ₹250 verification) */}
            <WorkerRegistrationCertificateCard
              workerProfile={workerProfile}
              payment={ownPayment}
            />

            {/* Registration Payment Status & History (Always visible in Worker Dashboard) */}
            <WorkerPaymentHistoryCard
              workerProfile={workerProfile}
              payment={ownPayment}
            />

            {/* Official Payment Receipt (Shown whenever a payment record exists) */}
            {ownPayment && <WorkerPaymentReceiptCard payment={ownPayment} />}

            {/* Notification Sound & Push Preferences */}
            <UserNotificationCenter
              mode="worker"
              onNavigateToTarget={(r, jobId, demoJobId) => {
                if (onNavigateToTarget) {
                  onNavigateToTarget(r, jobId, demoJobId);
                } else {
                  onNavigate(r);
                }
              }}
            />
          </div>
        )}

        {/* ================= TAB 6: MY REFERRALS ================= */}
        {activeTab === 'referrals' && (
          <WorkerReferralsTab
            workerProfile={workerProfile}
            workerPrivate={workerPrivate}
          />
        )}
      </div>

      {/* Fullscreen Zoomable Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Close photo"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxPhoto}
            alt="Customer work detail"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
