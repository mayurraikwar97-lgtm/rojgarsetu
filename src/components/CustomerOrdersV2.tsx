import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Radar,
  RefreshCw,
  ShieldCheck,
  Star,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getWorkerVisibleCustomerName,
  isFemaleCustomerProtected,
} from '../lib/customerPrivacy';
import {
  getSixStepLabel,
  SIX_STEP_STAGE_ORDER,
  toSixStepDealStage,
} from '../lib/dealWorkflow';
import {
  cancelDeal,
  cancelOpenJobByCustomer,
  completeDeal,
  expandJobSearchRadius,
  getEffectiveDealStatus,
  requestRevisedQuote,
  respondToWorkerOffer,
  submitCustomerRating,
  subscribeEmployerApplications,
} from '../lib/firestoreService';
import {
  getLocalizedCategoryLabel,
  getNextRadiusStage,
  normalizeRadiusKm,
} from '../lib/smartVoiceJobAlert';
import type {
  AppNotificationRecord,
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  PublicWorkerProfile,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';
import { CustomerPrivacyControls } from './CustomerPrivacyControls';
import { DealCoordinationPanel } from './DealCoordinationPanel';
import { SecureAvatar } from './SecureAvatar';
import { UserNotificationCenter } from './UserNotificationCenter';

interface CustomerOrdersV2Props {
  jobs: JobPosting[];
  workers: PublicWorkerProfile[];
  notifications?: AppNotificationRecord[];
  unreadNotificationsCount?: number;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
  onNavigateToTarget?: (route: PageRoute, jobId?: string, demoJobId?: string) => void;
  highlightedJobId?: string;
  onClearHighlightedJob?: () => void;
}

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

export const CustomerOrdersV2: React.FC<CustomerOrdersV2Props> = ({
  jobs,
  workers,
  notifications = [],
  unreadNotificationsCount = 0,
  onNavigate,
  onNavigateToTarget,
  highlightedJobId = '',
}) => {
  const { lang } = useLanguage();
  const { user, authReady, employerProfile, employerPrivate, signInWithGoogle } = useAuth();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyControls, setShowPrivacyControls] = useState(false);

  // Star Rating state per applicationId
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, { stars: number; note: string }>>({});
  const [openChatCounters, setOpenChatCounters] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authReady || !user) return;
    return subscribeEmployerApplications(user.uid, setApplications);
  }, [authReady, user]);

  const workersByUid = useMemo(() => {
    const map = new Map<string, PublicWorkerProfile>();
    workers.forEach((w) => map.set(w.ownerUid, w));
    return map;
  }, [workers]);

  // Privacy-safe name shown to workers (Female customers & Last-Name-Only users strictly show Last Name only)
  const customerName = useMemo(() => {
    return getWorkerVisibleCustomerName({
      employerProfile,
      employerPrivate,
      fallbackName: user?.displayName || user?.email?.split('@')[0] || 'Customer',
      viewerRole: 'worker',
    });
  }, [employerProfile, employerPrivate, user]);

  const isFemaleProtected = useMemo(
    () =>
      isFemaleCustomerProtected({
        gender: employerProfile?.gender || employerPrivate?.gender,
      }),
    [employerProfile?.gender, employerPrivate?.gender]
  );

  // Customer's own jobs
  const myJobs = useMemo(() => {
    if (!user) return [];
    return jobs
      .filter((j) => j.employerUid === user.uid)
      .sort((a, b) => {
        if (highlightedJobId && a.id === highlightedJobId) return -1;
        if (highlightedJobId && b.id === highlightedJobId) return 1;
        return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
      });
  }, [jobs, user, highlightedJobId]);

  const appsByJobId = useMemo(() => {
    const map = new Map<string, JobApplication[]>();
    applications.forEach((a) => {
      const list = map.get(a.jobId) || [];
      list.push(a);
      map.set(a.jobId, list);
    });
    return map;
  }, [applications]);

  const activeJobs = useMemo(() => {
    return myJobs.filter(
      (j) =>
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        j.dealStatus !== 'WORK_COMPLETED' &&
        j.dealStatus !== 'CANCELLED'
    );
  }, [myJobs]);

  // Completed Deals (all preserved in Firestore, latest 3 visible by default!)
  const completedDeals = useMemo(() => {
    return applications
      .filter((a) => a.status === 'work_completed' || a.dealStatus === 'WORK_COMPLETED')
      .sort((a, b) => getTimestampMs(b.completedAt || b.updatedAt) - getTimestampMs(a.completedAt || a.updatedAt));
  }, [applications]);

  const unratedCompleted = useMemo(
    () => completedDeals.filter((a) => !a.workerRating),
    [completedDeals]
  );

  const visibleCompletedHistory = showArchivedHistory
    ? completedDeals
    : completedDeals.slice(0, 3);

  const handleConfirmWorker = async (app: JobApplication, job: JobPosting) => {
    if (!user) return;
    setBusyId(app.id);
    setErrorMsg('');
    setFeedbackMsg('');
    try {
      const allowPhotoGrant =
        Boolean(employerPrivate?.photoDocId) &&
        employerProfile?.profileVisibility !== 'private_strict' &&
        !isFemaleProtected;
      await respondToWorkerOffer({
        app,
        decision: 'accepted',
        customerName,
        jobLocationLabel: job.approxLocationLabel || job.workLocationLabel || job.district,
        photoGrantContext: allowPhotoGrant && employerPrivate?.photoDocId
          ? {
              customerUid: user.uid,
              workerUid: app.workerUid,
              customerPhotoDocId: employerPrivate.photoDocId,
            }
          : undefined,
      });
      setFeedbackMsg(
        tr(
          lang,
          `Confirmed ${app.workerName}! You can now share your exact location and track arrival on the map.`,
          `${app.workerName} को कन्फर्म किया गया! अब आप सटीक लोकेशन साझा कर सकते हैं और नक्शे पर ट्रैक कर सकते हैं।`,
          `${app.workerName} यांना निश्चित केले! आता तुम्ही अचूक लोकेशन शेअर करू शकता आणि नकाशावर ट्रॅक करू शकता.`
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to confirm worker.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineOffer = async (app: JobApplication, job: JobPosting) => {
    setBusyId(app.id);
    setErrorMsg('');
    try {
      await respondToWorkerOffer({
        app,
        decision: 'declined',
        customerName,
        jobLocationLabel: job.approxLocationLabel || job.district,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to decline offer.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestRevisedQuote = async (app: JobApplication) => {
    setBusyId(app.id);
    setErrorMsg('');
    try {
      await requestRevisedQuote({ app, customerName });
      setFeedbackMsg(
        tr(
          lang,
          `Asked ${app.workerName} for a revised price quote.`,
          `${app.workerName} से संशोधित दर का अनुरोध किया गया।`,
          `${app.workerName} यांना सुधारित दराची विनंती पाठवली.`
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to request revised quote.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExpandRadius = async (job: JobPosting) => {
    setBusyId(job.id);
    setErrorMsg('');
    try {
      const res = await expandJobSearchRadius({ job, workers });
      setFeedbackMsg(
        tr(
          lang,
          `Expanded search to ${res.currentRadiusKm} km (${res.totalNotifiedCount} workers notified).`,
          `खोज ${res.currentRadiusKm} किमी तक बढ़ाई गई (${res.totalNotifiedCount} कामगारों को सूचना भेजी)।`,
          `शोध अंतर ${res.currentRadiusKm} किमी पर्यंत वाढवले (${res.totalNotifiedCount} कामगारांना रिक्वेस्ट पाठवली).`
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to expand search radius.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelOpenJob = async (job: JobPosting) => {
    setBusyId(job.id);
    setErrorMsg('');
    try {
      await cancelOpenJobByCustomer(job.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cancel request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitRating = async (app: JobApplication) => {
    if (!user) return;
    const draft = ratingDrafts[app.id] || { stars: 5, note: '' };
    setBusyId(app.id);
    setErrorMsg('');
    try {
      await submitCustomerRating({
        app,
        customerUid: user.uid,
        customerName,
        rating: draft.stars,
        feedback: draft.note,
      });
      setFeedbackMsg(
        tr(
          lang,
          `Thank you! Rated ${app.workerName} ${draft.stars}/5 stars.`,
          `धन्यवाद! ${app.workerName} को ${draft.stars}/5 स्टार रेटिंग दी गई।`,
          `धन्यवाद! ${app.workerName} यांना ${draft.stars}/5 स्टार रेटिंग दिली.`
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit rating.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomerCompleteAndCancel = async (app: JobApplication, action: 'complete' | 'cancel') => {
    if (!user) return;
    setBusyId(app.id);
    setErrorMsg('');
    try {
      if (action === 'complete') {
        const draft = ratingDrafts[app.id] || { stars: 5, note: '' };
        await completeDeal({
          app,
          actorUid: user.uid,
          actorRole: 'customer',
          actorName: customerName,
          rating: draft.stars,
          feedback: draft.note,
        });
      } else {
        await cancelDeal({
          app,
          actorUid: user.uid,
          actorRole: 'customer',
          actorName: customerName,
          reason: 'Cancelled by customer',
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update order.');
    } finally {
      setBusyId(null);
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
          <ClipboardList className="w-7 h-7 text-[#0B3B75]" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-[#0B3B75]">
          {tr(lang, 'My Orders & Live Tracking', 'मेरे ऑर्डर व लाइव ट्रैकिंग', 'माझ्या ऑर्डर्स व लाइव्ह ट्रॅकिंग')}
        </h1>
        <p className="text-sm text-slate-600">
          {tr(
            lang,
            'Sign in to view worker offers, confirm workers, share location, and rate completed services.',
            'कामगारों के ऑफर देखने, कन्फर्म करने और लाइव लोकेशन ट्रैक करने के लिए लॉगिन करें।',
            'कामगारांच्या ऑफर पाहण्यासाठी, कामगार निश्चित करण्यासाठी आणि लाइव्ह लोकेशन ट्रॅक करण्यासाठी लॉगिन करा.'
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F8FAFC] pb-24 md:pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-[#0B3B75]">
              {tr(lang, 'My Orders', 'मेरे ऑर्डर', 'माझ्या ऑर्डर्स')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {tr(
                lang,
                'Track live progress, confirm workers, chat & share exact location securely.',
                'लाइव स्थिति देखें, कामगार कन्फर्म करें, चैट करें और सुरक्षित लोकेशन साझा करें।',
                'लाइव्ह स्थिती पहा, कामगार निश्चित करा, चॅट करा आणि सुरक्षित लोकेशन शेअर करा.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrivacyControls((v) => !v)}
              className={`h-10 px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                showPrivacyControls || isFemaleProtected
                  ? 'border-emerald-300 bg-emerald-50 text-[#15803D]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{tr(lang, 'Privacy & Visibility', 'गोपनीयता नियंत्रण', 'गोपनीयता नियंत्रण')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {tr(lang, 'Alerts & Tone', 'अलर्ट टोन', 'अलर्ट टोन')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="h-10 px-4 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{tr(lang, 'New Request', 'नई रिक्वेस्ट', 'नवीन रिक्वेस्ट')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        <BrandSloganBanner variant="dashboard" />

        {showPrivacyControls && <CustomerPrivacyControls />}

        {feedbackMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              {feedbackMsg}
            </span>
            <button type="button" onClick={() => setFeedbackMsg('')} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700">
            {errorMsg}
          </div>
        )}

        {showSettings && (
          <UserNotificationCenter
            mode="employer"
            onNavigateToTarget={(r, jobId, demoJobId) => {
              if (onNavigateToTarget) onNavigateToTarget(r, jobId, demoJobId);
              else onNavigate(r);
            }}
          />
        )}

        {/* Pending Rating Prompt (immediately after Worker marks WORK DONE) */}
        {unratedCompleted.map((app) => {
          const draft = ratingDrafts[app.id] || { stars: 5, note: '' };
          return (
            <div
              key={`rate_${app.id}`}
              className="bg-white border-2 border-[#15803D] rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#15803D]">
                    {tr(lang, 'Work Completed · Rate Your Worker', 'काम पूरा हुआ · रेटिंग दें', 'काम पूर्ण झाले · कामगाराला रेटिंग द्या')}
                  </div>
                  <h2 className="font-display text-lg font-extrabold text-[#0B3B75] mt-0.5">
                    {app.jobTitle} · {app.workerName}
                  </h2>
                </div>
                <div className="font-mono-tabular text-base font-extrabold text-[#15803D]">
                  ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setRatingDrafts((prev) => ({
                        ...prev,
                        [app.id]: { ...draft, stars: star },
                      }))
                    }
                    className="p-1 cursor-pointer"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= draft.stars
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-mono-tabular font-extrabold text-[#0B3B75] ml-1">
                  {draft.stars}/5
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={draft.note}
                  onChange={(e) =>
                    setRatingDrafts((prev) => ({
                      ...prev,
                      [app.id]: { ...draft, note: e.target.value },
                    }))
                  }
                  placeholder={tr(lang, 'Optional feedback (e.g., punctual & neat work)...', 'वैकल्पिक समीक्षा...', 'ऐच्छिक अभिप्राय...')}
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="button"
                  disabled={busyId === app.id}
                  onClick={() => handleSubmitRating(app)}
                  className="h-11 px-5 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold cursor-pointer shrink-0"
                >
                  {tr(lang, 'Submit Rating', 'रेटिंग सबमिट करें', 'रेटिंग सबमिट करा')}
                </button>
              </div>
            </div>
          );
        })}

        {/* ================= ACTIVE ORDERS ================= */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
            {tr(lang, 'Active Orders', 'सक्रिय ऑर्डर', 'सुरू असलेल्या ऑर्डर्स')} ({activeJobs.length})
          </h2>

          {activeJobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-display text-base font-extrabold text-[#0B3B75]">
                {tr(lang, 'No active service requests', 'कोई सक्रिय ऑर्डर नहीं है', 'सध्या कोणतीही सुरू ऑर्डर नाही')}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="h-11 px-5 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold cursor-pointer"
              >
                {tr(lang, 'Book a Service Now', 'नई सेवा बुक करें', 'आता सेवा बुक करा')}
              </button>
            </div>
          ) : (
            activeJobs.map((job) => {
              const jobApps = (appsByJobId.get(job.id) || []).filter((a) => a.status !== 'declined');
              const confirmedApp = jobApps.find((a) => a.status === 'accepted');
              const offerApps = jobApps.filter((a) => a.status === 'applied');
              const currentRadius = normalizeRadiusKm(job.currentRadiusKm ?? job.initialRadiusKm ?? 2, 2);
              const nextRadius = getNextRadiusStage(currentRadius);
              const notifiedCount = Array.isArray(job.notifiedWorkerUids) ? job.notifiedWorkerUids.length : 0;

              return (
                <div
                  key={job.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 ${
                    highlightedJobId === job.id ? 'border-[#0B3B75] ring-2 ring-[#0B3B75]/10' : 'border-slate-200'
                  }`}
                >
                  {/* Order Top Info */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#E06D1B]">
                        {getLocalizedCategoryLabel(job.category, lang)}
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                        {job.subService || job.title}
                      </h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                        <span>{job.workLocationLabel || job.approxLocationLabel}</span>
                      </div>
                    </div>

                    {!confirmedApp && (
                      <div className="flex items-center gap-2">
                        {nextRadius && (
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => handleExpandRadius(job)}
                            className="h-9 px-3 rounded-lg border border-[#E06D1B] text-[#E06D1B] hover:bg-amber-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${busyId === job.id ? 'animate-spin' : ''}`} />
                            <span>
                              {tr(lang, `Expand to ${nextRadius} km`, `${nextRadius} किमी तक बढ़ाएँ`, `${nextRadius} किमी वाढवा`)}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === job.id}
                          onClick={() => handleCancelOpenJob(job)}
                          className="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-red-700 hover:border-red-200 text-xs font-bold cursor-pointer"
                        >
                          {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Case A: Searching for Workers (No offer yet) */}
                  {!confirmedApp && offerApps.length === 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-[#0B3B75]">
                        <Radar className="w-4 h-4 text-[#E06D1B]" />
                        <span>
                          {notifiedCount > 0
                            ? tr(
                                lang,
                                `Request sent to ${notifiedCount} nearby worker(s) within ${currentRadius} km. Waiting for acceptance...`,
                                `${currentRadius} किमी में ${notifiedCount} कामगारों को रिक्वेस्ट भेजी गई। स्वीकृति की प्रतीक्षा है...`,
                                `${currentRadius} किमी मध्ये ${notifiedCount} कामगारांना रिक्वेस्ट पाठवली आहे. प्रतिसादाची प्रतीक्षा आहे...`
                              )
                            : tr(
                                lang,
                                `Searching within ${currentRadius} km... Tap Expand to search wider.`,
                                `${currentRadius} किमी में खोज जारी है... अधिक कामगारों के लिए दायरा बढ़ाएँ।`,
                                `${currentRadius} किमी मध्ये शोध सुरू आहे... अधिक कामगारांसाठी अंतर वाढवा.`
                              )}
                        </span>
                      </div>
                      {/* Step 1 of 6 mini bar */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {SIX_STEP_STAGE_ORDER.map((stage, idx) => (
                          <div key={stage} className="space-y-1">
                            <div className={`h-1.5 rounded-full ${idx === 0 ? 'bg-[#E06D1B]' : 'bg-slate-200'}`} />
                            <div className={`text-[10px] ${idx === 0 ? 'font-bold text-[#E06D1B]' : 'text-slate-400'}`}>
                              {getSixStepLabel(stage, lang)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Case B: Worker Found / Offers Received -> Customer CONFIRMS WORKER */}
                  {!confirmedApp && offerApps.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#15803D]">
                        {tr(
                          lang,
                          `Worker Found (${offerApps.length}) · Review & Confirm`,
                          `कामगार मिला (${offerApps.length}) · कन्फर्म करें`,
                          `कामगार मिळाला (${offerApps.length}) · तपासून निश्चित करा`
                        )}
                      </div>
                      {offerApps.map((app) => {
                        const wProfile = workersByUid.get(app.workerUid);
                        const totalQuote = (app.offerAmount ?? app.proposedWage) + (app.travelCharges || 0);
                        const busy = busyId === app.id;
                        return (
                          <div
                            key={app.id}
                            className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <SecureAvatar
                                  photoDocId={app.workerPhotoDocId || wProfile?.photoDocId}
                                  name={app.workerName}
                                  sizeClass="w-11 h-11"
                                  textSizeClass="text-sm"
                                />
                                <div>
                                  <div className="text-base font-extrabold text-[#0B3B75]">
                                    {app.workerName}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                    <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                      {wProfile?.ratingAvg ? wProfile.ratingAvg.toFixed(1) : 'New'}
                                    </span>
                                    {wProfile?.experienceYears ? (
                                      <span>· {wProfile.experienceYears} yrs exp</span>
                                    ) : null}
                                    {app.estimatedArrivalTime && <span>· ETA {app.estimatedArrivalTime}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-bold uppercase text-slate-400">
                                  {tr(lang, "Worker's Rate", 'कामगार का दर', 'कामगाराचा दर')}
                                </div>
                                <div className="font-mono-tabular text-xl font-extrabold text-[#15803D]">
                                  ₹{totalQuote.toLocaleString('en-IN')}
                                </div>
                              </div>
                            </div>

                            {(app.offerMessage || app.note) && (
                              <p className="text-xs text-slate-700 bg-white rounded-lg p-2.5 border border-slate-200/80">
                                {app.offerMessage || app.note}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleConfirmWorker(app, job)}
                                className="flex-1 min-w-[165px] h-12 px-4 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                                <span>{tr(lang, 'CONFIRM WORKER', 'कामगार कन्फर्म करें', 'कामगार निश्चित करा')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRequestRevisedQuote(app)}
                                className="h-12 px-3.5 rounded-xl border border-[#0B3B75] bg-white text-[#0B3B75] hover:bg-blue-50 text-xs font-bold cursor-pointer"
                              >
                                {tr(lang, 'Revise Quote', 'दर बदलें', 'दर सुधारा')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenChatCounters((prev) => ({
                                    ...prev,
                                    [app.id]: (prev[app.id] || 0) + 1,
                                  }))
                                }
                                className="h-12 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {tr(lang, 'Chat', 'चैट', 'चॅट')}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeclineOffer(app, job)}
                                className="h-12 px-3 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>

                            <DealCoordinationPanel
                              application={app}
                              job={job}
                              viewerUid={user.uid}
                              viewerRole="customer"
                              viewerName={customerName}
                              forceChatOpenKey={openChatCounters[app.id] || 0}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Case C: Confirmed Worker -> Live 6-Step Tracker + Chat + Share Location & Live Map */}
                  {confirmedApp && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50/60 border border-blue-200/80 p-3.5">
                        <div className="flex items-center gap-3">
                          <SecureAvatar
                            photoDocId={confirmedApp.workerPhotoDocId || workersByUid.get(confirmedApp.workerUid)?.photoDocId}
                            name={confirmedApp.workerName}
                            sizeClass="w-11 h-11"
                            textSizeClass="text-sm"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#15803D]">
                              {tr(lang, 'Confirmed Worker', 'कन्फर्म कामगार', 'निश्चित कामगार')} ·{' '}
                              {getSixStepLabel(
                                toSixStepDealStage(confirmedApp),
                                lang,
                                getEffectiveDealStatus(confirmedApp) === 'WORKER_ARRIVED'
                              )}
                            </div>
                            <div className="text-base font-extrabold text-[#0B3B75]">
                              {confirmedApp.workerName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === confirmedApp.id}
                            onClick={() => handleCustomerCompleteAndCancel(confirmedApp, 'complete')}
                            className="h-10 px-4 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{tr(lang, 'Mark Work Done', 'काम पूरा करें', 'काम पूर्ण करा')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === confirmedApp.id}
                            onClick={() => handleCustomerCompleteAndCancel(confirmedApp, 'cancel')}
                            className="h-10 px-3 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold cursor-pointer"
                          >
                            {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
                          </button>
                        </div>
                      </div>

                      <DealCoordinationPanel
                        application={confirmedApp}
                        job={job}
                        viewerUid={user.uid}
                        viewerRole="customer"
                        viewerName={customerName}
                        defaultExpanded
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* ================= COMPLETED HISTORY (LATEST 3 VISIBLE) ================= */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
              {tr(lang, 'Completed Deals (Latest 3)', 'पूर्ण डील इतिहास (नवीनतम 3)', 'पूर्ण व्यवहारांचा इतिहास (शेवटचे ३)')}
            </h2>
            <span className="text-xs font-mono-tabular font-semibold text-slate-500">
              {completedDeals.length} {tr(lang, 'total saved', 'कुल सुरक्षित', 'एकूण जतन')}
            </span>
          </div>

          {completedDeals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              {tr(lang, 'Your completed service history will appear here.', 'आपके पूर्ण ऑर्डर यहाँ दिखेंगे।', 'तुमच्या पूर्ण झालेल्या सेवांचा इतिहास येथे दिसेल.')}
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {visibleCompletedHistory.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-extrabold text-[#0B3B75]">{app.jobTitle}</div>
                      <div className="text-xs text-slate-500">
                        {tr(lang, 'Worker', 'कामगार', 'कामगार')}: <span className="font-semibold text-slate-700">{app.workerName}</span> · {app.jobDistrict}
                      </div>
                    </div>
                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                      <div className="font-mono-tabular text-sm font-extrabold text-[#15803D]">
                        ₹{(app.agreedPrice ?? app.offerAmount ?? app.proposedWage).toLocaleString('en-IN')}
                      </div>
                      {app.workerRating ? (
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>{app.workerRating}/5</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {completedDeals.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowArchivedHistory((v) => !v)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B3B75] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {showArchivedHistory ? (
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
                          `View Archived History (${completedDeals.length - 3})`,
                          `पुराना इतिहास देखें (${completedDeals.length - 3})`,
                          `जुना इतिहास पहा (${completedDeals.length - 3})`
                        )}
                      </span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
