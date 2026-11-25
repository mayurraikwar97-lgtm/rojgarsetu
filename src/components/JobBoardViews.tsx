import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  Briefcase,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  PlusCircle,
  Search,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { SERVICE_CATALOG_V2, getServiceCategoryLabel } from '../data/serviceCatalogV2';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError, isAuthenticatedUser } from '../lib/firebase';
import {
  extractLastName,
  getApproximateCoordinates,
  getSafeCustomerLabelForJobOrApp,
  getWorkerVisibleCustomerName,
  isFemaleCustomerProtected,
} from '../lib/customerPrivacy';
import {
  broadcastSmartJobAlerts,
  callNotificationApi,
  createJobPosting,
  recordCustomerOrderPreference,
  saveOrderExactAddress,
  submitWorkerOffer,
} from '../lib/firestoreService';
import {
  detectBestGpsLocation,
  formatCoordinatesLabel,
  formatGeolocationError,
} from '../lib/locationService';
import {
  buildApproxLocationLabel,
  buildSmartJobVoiceScript,
  calculateValidDistanceKm,
  getPublicJobLocationText,
  isJobConfirmationClosed,
  SERVICE_RADIUS_STAGES,
} from '../lib/smartVoiceJobAlert';
import { getJobPhotoUrls, MAX_WORK_PHOTOS } from '../lib/workPhotoService';
import { WorkPhotoUploader } from './WorkPhotoUploader';
import { speakJobAlert, stopVoiceAlert, unlockAudioOnUserGesture } from '../lib/voiceAlertEngine';
import {
  getCustomProfessionLabel,
  subscribeApprovedProfessions,
} from '../lib/customProfessionService';
import type {
  CustomProfessionRecord,
  JobPosting,
  JobWorkType,
  PageRoute,
  PublicWorkerProfile,
  ServiceRadiusKm,
  WageUnit,
} from '../types/domain';
import { AddProfessionModal } from './AddProfessionModal';
import { ProfessionThumbnail } from './ProfessionThumbnail';
import { SecureAvatar } from './SecureAvatar';
import { SponsoredAdSlider } from './SponsoredAdSlider';

interface FindWorkViewProps {
  jobs: JobPosting[];
  initialCategory?: string;
  highlightedJobId?: string;
  onClearHighlightedJob?: () => void;
  onNavigate: (route: PageRoute) => void;
}

export const FindWorkView: React.FC<FindWorkViewProps> = ({
  jobs,
  initialCategory = '',
  highlightedJobId = '',
  onClearHighlightedJob,
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, workerProfile, signInWithGoogle } = useAuth();

  const [search, setSearch] = useState(initialCategory);
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [areaPincodeFilter, setAreaPincodeFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [pwdOnly, setPwdOnly] = useState(false);

  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);
  const [proposedWage, setProposedWage] = useState<number>(0);
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>('Within 1 hour');
  const [applyNote, setApplyNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [speakingJobId, setSpeakingJobId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const findWorkDistricts = useMemo(() => {
    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === stateFilter);
    return st ? st.districts.map((d) => d.name) : [];
  }, [stateFilter]);

  const highlightedJobRecord = useMemo(
    () => (highlightedJobId ? jobs.find((j) => j.id === highlightedJobId) || null : null),
    [jobs, highlightedJobId]
  );
  const highlightedJobAlreadyConfirmed = Boolean(
    highlightedJobRecord && isJobConfirmationClosed(highlightedJobRecord)
  );
  const highlightedJobConfirmedByMe = Boolean(
    highlightedJobRecord && user && highlightedJobRecord.acceptedWorkerUid === user.uid
  );

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const locQ = areaPincodeFilter.trim().toLowerCase();
    const list = jobs
      .filter((j) => j.status === 'open' && !isJobConfirmationClosed(j))
      .filter((j) => !stateFilter || j.state === stateFilter)
      .filter((j) => !districtFilter || j.district === districtFilter)
      .filter((j) => {
        if (!locQ) return true;
        const locBlob = `${j.cityOrVillage || ''} ${j.district || ''} ${j.state || ''} ${j.approxLocationLabel || ''} ${j.workLocationLabel || ''}`.toLowerCase();
        return locBlob.includes(locQ);
      })
      .filter((j) => !workTypeFilter || j.workType === workTypeFilter)
      .filter((j) => !womenOnly || j.isWomenFriendly)
      .filter((j) => !pwdOnly || j.isAccessible)
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          j.category.toLowerCase().includes(q) ||
          j.district.toLowerCase().includes(q) ||
          (j.cityOrVillage || '').toLowerCase().includes(q) ||
          (j.approxLocationLabel || '').toLowerCase().includes(q) ||
          j.employerName.toLowerCase().includes(q) ||
          j.requiredSkills.some((s) => s.toLowerCase().includes(q))
      );

    if (highlightedJobId) {
      list.sort((a, b) => (a.id === highlightedJobId ? -1 : b.id === highlightedJobId ? 1 : 0));
    }
    return list;
  }, [jobs, search, stateFilter, districtFilter, areaPincodeFilter, workTypeFilter, womenOnly, pwdOnly, highlightedJobId]);

  useEffect(() => {
    if (!highlightedJobId) return;
    const el = document.getElementById(`job-card-${highlightedJobId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedJobId, filteredJobs.length]);

  const handleOpenApply = (job: JobPosting) => {
    setErrorMsg('');
    setApplyingJob(job);
    setProposedWage(job.offeredWage > 0 ? job.offeredWage : workerProfile?.expectedWage || 500);
    setEstimatedArrivalTime('Within 1 hour');
    setApplyNote('');
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob || !user || !workerProfile) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const numericWage = Number(proposedWage) || applyingJob.offeredWage || workerProfile.expectedWage;
      await submitWorkerOffer({
        job: applyingJob,
        worker: workerProfile,
        workerUid: user.uid,
        offeredPrice: numericWage,
        estimatedArrivalTime: estimatedArrivalTime.trim() || 'Within 1 hour',
        offerMessage: applyNote.trim().slice(0, 600),
      });
      setAppliedJobIds((prev) => [...prev, applyingJob.id]);
      setApplyingJob(null);
      if (highlightedJobId === applyingJob.id && onClearHighlightedJob) {
        onClearHighlightedJob();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send offer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
            {t.nav.findWork}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t.brand.supporting}</p>
        </div>
        {!workerProfile && (
          <button
            type="button"
            onClick={() => onNavigate('register-worker')}
            className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.hero.ctaWorker}
          </button>
        )}
      </div>

      {/* Filters: Skill, State, District, Area / Pincode & Work Type */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.jobs.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setDistrictFilter('');
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
          >
            <option value="">{t.mapSection.allStates}</option>
            {INDIA_STATES_DISTRICTS.map((st) => (
              <option key={st.name} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            disabled={!stateFilter}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {lang === 'mr' ? 'सर्व जिल्हे' : lang === 'hi' ? 'सभी ज़िले' : 'All Districts'}
            </option>
            {findWorkDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#E06D1B] absolute left-3 top-3" />
            <input
              type="text"
              value={areaPincodeFilter}
              onChange={(e) => setAreaPincodeFilter(e.target.value)}
              placeholder={
                lang === 'mr'
                  ? 'परिसर / ६-अंकी पिनकोड...'
                  : lang === 'hi'
                  ? 'क्षेत्र / 6-अंकीय पिनकोड...'
                  : 'Area / 6-digit Pincode...'
              }
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
            />
          </div>
          <select
            value={workTypeFilter}
            onChange={(e) => setWorkTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
          >
            <option value="">All Work Types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="daily_wage">Daily Wage</option>
            <option value="contract">Contract</option>
            <option value="temporary">Temporary</option>
            <option value="urgent">Urgent</option>
            <option value="bulk">Bulk Recruitment</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-700">
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>{t.jobs.womenFriendly}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pwdOnly}
                onChange={(e) => setPwdOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>{t.jobs.accessibleWork}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {workerProfile && (
              <button
                type="button"
                onClick={() => {
                  setStateFilter(workerProfile.state || '');
                  setDistrictFilter(workerProfile.district || '');
                  setAreaPincodeFilter(workerProfile.cityOrVillage || '');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#0B3B75] font-bold hover:bg-blue-100 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                <span>
                  {lang === 'mr'
                    ? `माझा परिसर (${workerProfile.district})`
                    : lang === 'hi'
                    ? `मेरा क्षेत्र (${workerProfile.district})`
                    : `My Area (${workerProfile.district})`}
                </span>
              </button>
            )}
            {(stateFilter || districtFilter || areaPincodeFilter || search || workTypeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStateFilter('');
                  setDistrictFilter('');
                  setAreaPincodeFilter('');
                  setWorkTypeFilter('');
                }}
                className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
              >
                {lang === 'mr' ? 'फिल्टर काढा' : lang === 'hi' ? 'फ़िल्टर हटाएँ' : 'Clear Filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {highlightedJobId && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 flex items-center justify-between gap-3 border-2 ${
            highlightedJobConfirmedByMe
              ? 'bg-emerald-50 border-emerald-400'
              : highlightedJobAlreadyConfirmed
              ? 'bg-slate-100 border-slate-300'
              : 'bg-amber-50 border-[#E06D1B]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0B3B75]">
            {highlightedJobConfirmedByMe ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            ) : (
              <BellRing
                className={`w-4 h-4 shrink-0 ${
                  highlightedJobAlreadyConfirmed ? 'text-slate-500' : 'text-[#E06D1B]'
                }`}
              />
            )}
            <span>
              {highlightedJobConfirmedByMe
                ? lang === 'mr'
                  ? `काम कन्फर्म झाले — "${highlightedJobRecord?.title || ''}" हे काम तुम्ही कन्फर्म केले आहे. ग्राहक संपर्क व पुढील माहितीसाठी कामगार डॅशबोर्ड उघडा.`
                  : lang === 'hi'
                  ? `काम कन्फर्म हुआ — "${highlightedJobRecord?.title || ''}" आपने कन्फर्म किया है। ग्राहक संपर्क व अगले चरण के लिए कामगार डैशबोर्ड खोलें।`
                  : `Job Confirmed — You confirmed "${highlightedJobRecord?.title || ''}". Open Worker Dashboard for customer contact & next steps.`
                : highlightedJobAlreadyConfirmed
                ? lang === 'mr'
                  ? `"${highlightedJobRecord?.title || ''}" हे काम दुसऱ्या कामगाराने आधीच कन्फर्म केले आहे. तुमची न्याय्य बारी बदललेली नाही — पुढील कामात तुम्हाला प्राधान्य मिळेल.`
                  : lang === 'hi'
                  ? `"${highlightedJobRecord?.title || ''}" पहले ही किसी अन्य कामगार द्वारा कन्फर्म हो चुका है। आपकी बारी सुरक्षित है — अगले काम में आपको प्राथमिकता मिलेगी।`
                  : `"${highlightedJobRecord?.title || ''}" has already been confirmed by another worker. Your fair-rotation turn is unaffected — you will be prioritized for the next matching job.`
                : lang === 'mr'
                ? 'ROJGAR SETU अलर्टमधून हे काम उघडले आहे. खाली तपशील पाहून अर्ज करा.'
                : lang === 'hi'
                ? 'ROJGAR SETU नोटिफिकेशन से यह काम खोला गया है। नीचे विवरण देखें और आवेदन करें।'
                : 'Opened directly from your ROJGAR SETU push notification. Review details below and tap Apply.'}
            </span>
          </div>
          {onClearHighlightedJob && (
            <button
              type="button"
              onClick={onClearHighlightedJob}
              className="text-xs font-bold text-[#C25E00] hover:underline shrink-0 cursor-pointer"
            >
              {lang === 'mr' ? 'बंद करा' : lang === 'hi' ? 'बंद करें' : 'Dismiss'}
            </button>
          )}
        </div>
      )}

      {filteredJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600 max-w-md mx-auto">{t.jobs.noJobs}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map((job) => {
            const isApplied = appliedJobIds.includes(job.id);
            const isHighlighted = highlightedJobId === job.id;
            const catItem = EMPLOYMENT_CATEGORIES.find((c) => c.en === job.category);
            const catTitle = catItem
              ? lang === 'hi'
                ? catItem.hi
                : lang === 'mr'
                ? catItem.mr
                : catItem.en
              : job.category;

            return (
              <div
                key={job.id}
                id={`job-card-${job.id}`}
                className={`bg-white rounded-lg p-6 flex flex-col justify-between gap-4 ${
                  isHighlighted
                    ? 'border-2 border-[#E06D1B] ring-2 ring-amber-200'
                    : 'border border-slate-200'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        {catTitle} · {job.workType.replace('_', ' ')}
                        {isHighlighted ? ' · 🔔 Notification Match' : ''}
                      </p>
                      <h2 className="font-display text-lg font-bold text-[#0B3B75] mt-0.5">
                        {job.title}
                      </h2>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-tabular text-base font-bold text-[#15803D]">
                        ₹{job.offeredWage.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500">/ {job.wageUnit}</div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">{job.description}</p>

                  {(() => {
                    const cardPhotos = getJobPhotoUrls(job);
                    if (cardPhotos.length === 0) return null;
                    return (
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                        <span className="block text-[11px] font-semibold text-[#0B3B75]">
                          {`Uploaded Work Photos (${cardPhotos.length})`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {cardPhotos.map((url, idx) => (
                            <img
                              key={`${job.id}-photo-${idx}`}
                              src={url}
                              alt={`Work site photo ${idx + 1} for ${job.title}`}
                              className="w-16 h-16 rounded object-cover border border-slate-300 shrink-0 bg-white"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    {(() => {
                      const approxLoc = getPublicJobLocationText(job, false);
                      const distKm = calculateValidDistanceKm(
                        job.lat,
                        job.lng,
                        workerProfile?.approxLat,
                        workerProfile?.approxLng
                      );
                      const isSpeaking = speakingJobId === job.id;
                      const preferredLang = workerProfile?.preferredLanguage || lang;
                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {approxLoc}
                                {distKm !== null ? ` (~${distKm} km away)` : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                unlockAudioOnUserGesture();
                                if (isSpeaking) {
                                  stopVoiceAlert();
                                  setSpeakingJobId(null);
                                  return;
                                }
                                const script = buildSmartJobVoiceScript({
                                  lang: preferredLang,
                                  customerName: getSafeCustomerLabelForJobOrApp({
                                    job,
                                    viewerRole: 'worker',
                                  }),
                                  category: job.category,
                                  jobTitle: job.title,
                                  jobDescription: job.title || job.description,
                                  approxLocationLabel: approxLoc,
                                  distanceKm: distKm,
                                });
                                setSpeakingJobId(job.id);
                                void speakJobAlert({
                                  text: script,
                                  lang: preferredLang,
                                  soundEnabled: false,
                                  voiceEnabled: true,
                                }).finally(() => {
                                  setSpeakingJobId((prev) => (prev === job.id ? null : prev));
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] font-semibold text-[#0B3B75] hover:bg-slate-100 cursor-pointer"
                            >
                              {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-[#E06D1B]" />}
                              <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                            </button>
                          </div>
                          <p className="font-mono-tabular">
                            {job.workersRequired} {t.jobs.workersUnit} · {job.paymentTerms}
                          </p>
                          <p className="text-slate-500">
                            Skills: {job.requiredSkills.join(', ')}
                            {job.isWomenFriendly ? ' · Women-friendly' : ''}
                            {job.isAccessible ? ' · Accessible (PwD)' : ''}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Exact address is revealed after offer acceptance.
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 font-medium">
                    {getSafeCustomerLabelForJobOrApp({
                      job,
                      viewerRole: 'worker',
                    })}
                  </span>

                  {isApplied ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                      <CheckCircle2 className="w-4 h-4" />
                      {t.jobs.appliedLabel}
                    </span>
                  ) : !user ? (
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      {t.nav.signIn}
                    </button>
                  ) : !workerProfile ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('register-worker')}
                      className="px-4 py-2 rounded-md border border-[#0B3B75] text-[#0B3B75] text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      {t.hero.ctaWorker}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenApply(job)}
                      className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      {t.jobs.applyBtn}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Application Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSubmitApplication}
            className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-[#0B3B75]">
              {applyingJob.title}
            </h3>
            <p className="text-xs text-slate-600">
              {getSafeCustomerLabelForJobOrApp({
                job: applyingJob,
                viewerRole: 'worker',
              })}{' '}
              · Offered ₹{applyingJob.offeredWage} / {applyingJob.wageUnit}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.jobs.proposedWageLabel} (Offer Price ₹)
              </label>
              <input
                type="number"
                min={0}
                value={proposedWage}
                onChange={(e) => setProposedWage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Arrival Time
              </label>
              <input
                type="text"
                value={estimatedArrivalTime}
                onChange={(e) => setEstimatedArrivalTime(e.target.value)}
                placeholder="e.g., 30 mins, Today 4 PM, Tomorrow 9 AM"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.jobs.noteLabel}
              </label>
              <textarea
                rows={3}
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Describe tools, experience, or availability..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            {errorMsg && <p className="text-xs text-red-700">{errorMsg}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApplyingJob(null)}
                className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                {submitting ? t.common.loading : t.jobs.submitApplication}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface FindWorkersViewProps {
  workers: PublicWorkerProfile[];
  onNavigate: (route: PageRoute) => void;
}

export const FindWorkersView: React.FC<FindWorkersViewProps> = ({ workers, onNavigate }) => {
  const { lang, t } = useLanguage();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [areaPincodeFilter, setAreaPincodeFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);

  useEffect(() => {
    return subscribeApprovedProfessions(setApprovedProfessions);
  }, []);

  const workerDistrictOptions = useMemo(() => {
    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === stateFilter);
    return st ? st.districts.map((d) => d.name) : [];
  }, [stateFilter]);

  const approvedProfessionSlugs = useMemo(
    () => new Set(approvedProfessions.filter((p) => p.status === 'approved').map((p) => p.slug)),
    [approvedProfessions]
  );

  // Never publicly expose an unverified custom profession category name until Admin approves it
  const getPublicProfessionLabel = (w: PublicWorkerProfile): string => {
    const isUnverifiedCustom =
      Boolean(w.customProfessionId) &&
      (w.customProfessionStatus === 'pending' || w.customProfessionStatus === 'rejected') &&
      !approvedProfessionSlugs.has(w.customProfessionId || '');
    if (isUnverifiedCustom) {
      return lang === 'mr'
        ? 'कुशल कामगार (व्यवसाय सत्यापन प्रलंबित)'
        : lang === 'hi'
        ? 'कुशल कामगार (व्यवसाय सत्यापन लंबित)'
        : 'Skilled Worker (Profession Review Pending)';
    }
    return w.primarySkill;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const locQ = areaPincodeFilter.trim().toLowerCase();
    return workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => !stateFilter || w.state === stateFilter)
      .filter((w) => !districtFilter || w.district === districtFilter)
      .filter((w) => {
        if (!locQ) return true;
        const locBlob = `${w.cityOrVillage || ''} ${w.district || ''} ${w.state || ''}`.toLowerCase();
        return locBlob.includes(locQ);
      })
      .filter((w) => !availFilter || w.availabilityStatus === availFilter)
      .filter((w) => {
        if (!q) return true;
        const publicSkill = getPublicProfessionLabel(w).toLowerCase();
        const isUnverifiedCustom =
          Boolean(w.customProfessionId) &&
          (w.customProfessionStatus === 'pending' || w.customProfessionStatus === 'rejected') &&
          !approvedProfessionSlugs.has(w.customProfessionId || '');
        const matchingApprovedProf = w.customProfessionId
          ? approvedProfessions.find((p) => p.slug === w.customProfessionId)
          : undefined;
        const profSearchText = matchingApprovedProf
          ? `${matchingApprovedProf.nameEn} ${matchingApprovedProf.nameHi || ''} ${matchingApprovedProf.nameMr || ''} ${(matchingApprovedProf.keywords || []).join(' ')}`.toLowerCase()
          : '';
        return (
          w.displayName.toLowerCase().includes(q) ||
          publicSkill.includes(q) ||
          profSearchText.includes(q) ||
          w.district.toLowerCase().includes(q) ||
          w.cityOrVillage.toLowerCase().includes(q) ||
          (!isUnverifiedCustom && (w.workDescription || '').toLowerCase().includes(q)) ||
          (!isUnverifiedCustom && w.skills.some((s) => s.toLowerCase().includes(q)))
        );
      });
  }, [workers, search, stateFilter, districtFilter, areaPincodeFilter, availFilter, approvedProfessions, approvedProfessionSlugs, lang]);

  const extractedPincode = (areaPincodeFilter.match(/\b\d{6}\b/) || [])[0] || '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
            {t.nav.findWorkers}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t.forEmployers.subheading}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('post-job')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          {t.jobs.postTitle}
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                lang === 'mr'
                  ? 'व्यवसाय, कौशल्य किंवा नाव...'
                  : lang === 'hi'
                  ? 'व्यवसाय, कौशल या नाम...'
                  : 'Profession, skill, or name...'
              }
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setDistrictFilter('');
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
          >
            <option value="">{t.mapSection.allStates}</option>
            {INDIA_STATES_DISTRICTS.map((st) => (
              <option key={st.name} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            disabled={!stateFilter}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {lang === 'mr' ? 'सर्व जिल्हे' : lang === 'hi' ? 'सभी ज़िले' : 'All Districts'}
            </option>
            {workerDistrictOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#E06D1B] absolute left-3 top-3" />
            <input
              type="text"
              value={areaPincodeFilter}
              onChange={(e) => setAreaPincodeFilter(e.target.value)}
              placeholder={
                lang === 'mr'
                  ? 'परिसर / ६-अंकी पिनकोड...'
                  : lang === 'hi'
                  ? 'क्षेत्र / 6-अंकीय पिनकोड...'
                  : 'Area / 6-digit Pincode...'
              }
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
            />
          </div>
          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
          >
            <option value="">All Availability</option>
            <option value="available">Available Immediately</option>
            <option value="busy">Currently Engaged</option>
          </select>
        </div>

        {(stateFilter || districtFilter || areaPincodeFilter || search || availFilter) && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold">
              {filtered.length}{' '}
              {lang === 'mr' ? 'कामगार जुळले' : lang === 'hi' ? 'कामगार मिले' : 'matching worker(s)'}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStateFilter('');
                setDistrictFilter('');
                setAreaPincodeFilter('');
                setAvailFilter('');
              }}
              className="font-bold text-[#0B3B75] hover:underline cursor-pointer"
            >
              {lang === 'mr' ? 'फिल्टर काढा' : lang === 'hi' ? 'फ़िल्टर हटाएँ' : 'Clear Filters'}
            </button>
          </div>
        )}
      </div>

      {/* Approved Specialized Profession Filter Chips */}
      {approvedProfessions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            {lang === 'mr'
              ? 'मंजूर विशेष व्यवसाय:'
              : lang === 'hi'
              ? 'स्वीकृत विशेष व्यवसाय:'
              : 'Approved Professions:'}
          </span>
          {approvedProfessions.map((p) => {
            const active = search.trim().toLowerCase() === p.nameEn.toLowerCase();
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => setSearch(active ? '' : p.nameEn)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-[#0B3B75]'
                }`}
              >
                {getCustomProfessionLabel(p, lang)}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-8">
        <SponsoredAdSlider
          compact
          category={search.trim() || 'all'}
          categoryLabel={search.trim() || undefined}
          state={stateFilter}
          district={districtFilter}
          city={extractedPincode ? '' : areaPincodeFilter.trim()}
          pincode={extractedPincode}
          placement="service_info"
          onNavigate={(r) => onNavigate(r)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600">{t.common.noRecords}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((w) => {
            const isUnverifiedCustom =
              Boolean(w.customProfessionId) &&
              (w.customProfessionStatus === 'pending' || w.customProfessionStatus === 'rejected') &&
              !approvedProfessionSlugs.has(w.customProfessionId || '');
            return (
              <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SecureAvatar
                      name={w.displayName}
                      photoDocId={w.photoDocId}
                      sizeClass="w-11 h-11"
                      textSizeClass="text-sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-mono-tabular text-slate-500 truncate">{w.registrationId}</p>
                      <h2 className="font-display text-base font-bold text-[#0B3B75] truncate">{w.displayName}</h2>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#15803D] shrink-0">
                    {w.verificationStatus === 'verified' ? t.common.verified : t.common.pending}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#C25E00]">{getPublicProfessionLabel(w)}</p>
                {!isUnverifiedCustom && (
                  <p className="text-xs text-slate-600">
                    Skills: {w.skills.join(' · ')}
                  </p>
                )}
                {!isUnverifiedCustom && w.workDescription && (
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 rounded p-2 border border-slate-100">
                    {w.workDescription}
                  </p>
                )}
                {!isUnverifiedCustom && w.workPhotoUrls && w.workPhotoUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {w.workPhotoUrls.slice(0, 4).map((url, idx) => (
                      <img
                        key={`${w.id}_wp_${idx}`}
                        src={url}
                        alt={`${w.displayName} work ${idx + 1}`}
                        className="w-full h-12 object-cover rounded border border-slate-200"
                      />
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                  <p>
                    {w.cityOrVillage}, {w.district}, {w.state}
                  </p>
                  <p className="font-mono-tabular">
                    Exp: {w.experienceYears} yrs
                    {w.expectedWage > 0
                      ? ` · Expected: ₹${w.expectedWage.toLocaleString('en-IN')} / ${w.wageUnit}`
                      : ''}
                  </p>
                  <p className="text-slate-500">Languages: {w.languagesKnown.join(', ')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface PostJobViewProps {
  workers?: PublicWorkerProfile[];
  onNavigate: (route: PageRoute) => void;
}

const NORMAL_WORK_CATEGORIES = EMPLOYMENT_CATEGORIES.filter((c) => c.group !== 'transport');

export const PostJobView: React.FC<PostJobViewProps> = ({ workers = [], onNavigate }) => {
  const { lang, t } = useLanguage();
  const { user, employerProfile, employerPrivate, signInWithGoogle } = useAuth();
  const tr = (en: string, hi: string, mr: string) => (lang === 'mr' ? mr : lang === 'hi' ? hi : en);

  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const successCardRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(NORMAL_WORK_CATEGORIES[0].en);
  const [description, setDescription] = useState('');
  const [workersRequired, setWorkersRequired] = useState(1);
  const [skillsInput, setSkillsInput] = useState('');
  const [stateName, setStateName] = useState(employerProfile?.state || 'Maharashtra');
  const [districtName, setDistrictName] = useState(employerProfile?.district || 'Chandrapur');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [workLocationLabel, setWorkLocationLabel] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [workPhotoUrls, setWorkPhotoUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [jobDate, setJobDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('1 day');
  const [workType, setWorkType] = useState<JobWorkType>('daily_wage');
  const [offeredWage, setOfferedWage] = useState(600);
  const [wageUnit, setWageUnit] = useState<WageUnit>('daily');
  const [paymentTerms, setPaymentTerms] = useState('Direct UPI / Cash after work');
  const [contactPreference, setContactPreference] = useState<'platform_message' | 'phone_after_confirm'>('phone_after_confirm');
  const [isWomenFriendly, setIsWomenFriendly] = useState(false);
  const [isAccessible, setIsAccessible] = useState(false);
  const [biddingEnabled, setBiddingEnabled] = useState(true);
  const [initialRadiusKm, setInitialRadiusKm] = useState<ServiceRadiusKm>(5);

  const [saving, setSaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdJobId, setCreatedJobId] = useState('');
  const [createdJobSummary, setCreatedJobSummary] = useState<{
    id: string;
    title: string;
    category: string;
    location: string;
    notifiedCount: number;
    radiusKm: ServiceRadiusKm;
  } | null>(null);
  const [pushDispatchNotice, setPushDispatchNotice] = useState('');
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);
  const [showAddProfessionModal, setShowAddProfessionModal] = useState(false);
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    return subscribeApprovedProfessions(setApprovedProfessions);
  }, []);

  // Sync defaults cleanly when auth / employerProfile loads asynchronously
  useEffect(() => {
    if (employerProfile?.state && INDIA_STATES_DISTRICTS.some((s) => s.name === employerProfile.state)) {
      setStateName((prev) => (prev === 'Maharashtra' ? employerProfile.state : prev));
      const matchedSt = INDIA_STATES_DISTRICTS.find((s) => s.name === employerProfile.state);
      if (employerProfile.district && matchedSt?.districts.some((d) => d.name === employerProfile.district)) {
        setDistrictName((prev) => (prev === 'Chandrapur' ? employerProfile.district : prev));
      }
    }
    const defaultName =
      employerPrivate?.contactPerson ||
      employerProfile?.businessName ||
      user?.displayName ||
      '';
    if (defaultName) {
      setContactName((prev) => (prev.trim() ? prev : defaultName));
    }
    if (employerPrivate?.mobile) {
      const cleanMob = employerPrivate.mobile.replace(/\D/g, '').slice(-10);
      if (cleanMob.length === 10) {
        setContactMobile((prev) => (prev.trim() ? prev : cleanMob));
      }
    }
  }, [employerProfile, employerPrivate, user]);

  const stateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName) || INDIA_STATES_DISTRICTS[0];

  // Ensure every catalog category (including AC Repair, Appliance Repair, Drivers) & custom "+" category is selectable in <select>
  const extraCatalogCategories = useMemo(() => {
    const existing = new Set([
      ...NORMAL_WORK_CATEGORIES.map((c) => c.en.toLowerCase()),
      ...approvedProfessions.map((p) => p.nameEn.toLowerCase()),
    ]);
    return SERVICE_CATALOG_V2.filter(
      (s) => !s.isTransport && !existing.has(s.canonicalCategory.toLowerCase())
    );
  }, [approvedProfessions]);

  const isCustomSelectedCategoryMissingFromLists = useMemo(() => {
    const clean = category.trim().toLowerCase();
    if (!clean) return false;
    const inStandard = NORMAL_WORK_CATEGORIES.some((c) => c.en.toLowerCase() === clean);
    const inExtra = extraCatalogCategories.some((s) => s.canonicalCategory.toLowerCase() === clean);
    const inApproved = approvedProfessions.some((p) => p.nameEn.toLowerCase() === clean);
    return !inStandard && !inExtra && !inApproved;
  }, [category, extraCatalogCategories, approvedProfessions]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setErrorMsg('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMsg(
        formatUiError(
          err,
          tr(
            'Google sign-in was cancelled or blocked. Please try again.',
            'Google साइन-इन रद्द या ब्लॉक हो गया। कृपया पुनः प्रयास करें।',
            'Google साइन-इन रद्द किंवा ब्लॉक झाले. कृपया पुन्हा प्रयत्न करा.'
          ),
          lang
        )
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleShareJobGps = async () => {
    setGpsBusy(true);
    setErrorMsg('');
    try {
      const geo = await detectBestGpsLocation(lang);
      setPinnedCoords({ lat: geo.lat, lng: geo.lng });
      if (geo.state && INDIA_STATES_DISTRICTS.some((s) => s.name === geo.state)) {
        setStateName(geo.state);
        const st = INDIA_STATES_DISTRICTS.find((s) => s.name === geo.state);
        if (geo.district && st?.districts.some((d) => d.name === geo.district)) {
          setDistrictName(geo.district);
        } else if (st?.districts[0]?.name) {
          setDistrictName(st.districts[0].name);
        }
      } else if (geo.district) {
        setDistrictName(geo.district);
      }
      if (geo.cityOrVillage) {
        setCityOrVillage(geo.cityOrVillage);
        clearFieldError('cityOrVillage');
      }
      if (geo.formattedAddress) {
        setWorkLocationLabel(geo.formattedAddress.slice(0, 160));
        clearFieldError('workLocationLabel');
      }
      if (geo.postalCode) {
        const cleanPin = geo.postalCode.replace(/\D/g, '').slice(0, 6);
        if (cleanPin.length === 6) {
          setPincode(cleanPin);
          clearFieldError('pincode');
        }
      }
    } catch (err) {
      setErrorMsg(formatGeolocationError(err, lang).message);
      window.setTimeout(() => errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
    } finally {
      setGpsBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPushDispatchNotice('');

    if (!user) {
      setErrorMsg(
        tr(
          'Please sign in with Google first to publish your job.',
          'काम पोस्ट करने के लिए कृपया पहले Google से साइन-इन करें।',
          'कामाची जाहिरात टाकण्यासाठी कृपया आधी Google ने साइन-इन करा.'
        )
      );
      window.setTimeout(() => errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
      return;
    }

    if (!isAuthenticatedUser(user)) {
      setErrorMsg(
        tr(
          'Your Google sign-in session could not be verified. Please sign in with Google again to publish a job.',
          'आपका Google सत्र सत्यापित नहीं हो सका। कृपया Google से पुनः साइन-इन करें।',
          'तुमचे Google लॉगिन सत्र पडताळता आले नाही. कृपया Google ने पुन्हा साइन-इन करा.'
        )
      );
      window.setTimeout(() => errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
      return;
    }

    if (photoUploading) {
      setErrorMsg(
        tr(
          'Please wait until your work photos finish uploading.',
          'कृपया काम की फ़ोटो अपलोड होने तक प्रतीक्षा करें।',
          'कृपया कामाचे फोटो अपलोड पूर्ण होईपर्यंत थोडे थांबा.'
        )
      );
      return;
    }

    // Explicit localized validation for every required field so Submit never stalls silently
    const nextErrors: Record<string, string> = {};
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();
    const cleanDesc = description.trim();
    const cleanCity = cityOrVillage.trim();
    const cleanArea = workLocationLabel.trim();
    const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);
    const cleanContactName = contactName.trim();
    const cleanContactMobile = contactMobile.replace(/\D/g, '').slice(-10);
    const resolvedDistrict = districtName.trim() || stateObj?.districts[0]?.name || stateName;

    if (cleanTitle.length < 3) {
      nextErrors.title = tr(
        'Please enter a job title (at least 3 characters).',
        'कृपया काम का शीर्षक लिखें (कम से कम 3 अक्षर)।',
        'कृपया कामाचे शीर्षक लिहा (किमान ३ अक्षरे).'
      );
    }

    if (cleanCategory.length < 2) {
      nextErrors.category = tr(
        'Please select a profession/category or add a custom one using "+".',
        'कृपया काम की श्रेणी चुनें या "+" से नई श्रेणी जोड़ें।',
        'कृपया कामाचा व्यवसाय निवडा किंवा "+" बटणाने नवीन व्यवसाय जोडा.'
      );
    }

    if (cleanDesc.length < 3) {
      nextErrors.description = tr(
        'Please briefly describe the work (at least 3 characters).',
        'कृपया काम का संक्षिप्त विवरण लिखें (कम से कम 3 अक्षर)।',
        'कृपया कामाचे थोडक्यात वर्णन लिहा (किमान ३ अक्षरे).'
      );
    }

    if (cleanCity.length < 2 && !pinnedCoords && cleanPin.length !== 6) {
      nextErrors.cityOrVillage = tr(
        'Please enter your city/village, detect GPS location, or enter a 6-digit PIN code.',
        'कृपया अपना शहर/गाँव लिखें, GPS लोकेशन लें, या 6 अंकों का पिनकोड दर्ज करें।',
        'कृपया तुमचे गाव/शहर लिहा, GPS लोकेशन घ्या, किंवा ६ अंकी पिनकोड टाका.'
      );
    }

    if (cleanPin.length > 0 && !/^[1-9]\d{5}$/.test(cleanPin)) {
      nextErrors.pincode = tr(
        'Please enter a valid 6-digit pincode (e.g. 442401).',
        'कृपया सही 6 अंकों का पिनकोड दर्ज करें (जैसे 442401)।',
        'कृपया वैध ६ अंकी पिनकोड टाका (उदा. 442401).'
      );
    }

    if (cleanContactName.length < 2) {
      nextErrors.contactName = tr(
        'Please enter your name (at least 2 characters).',
        'कृपया अपना नाम लिखें (कम से कम 2 अक्षर)।',
        'कृपया तुमचे नाव लिहा (किमान २ अक्षरे).'
      );
    }

    if (cleanContactMobile.length > 0 && !/^[6-9]\d{9}$/.test(cleanContactMobile)) {
      nextErrors.contactMobile = tr(
        'Please enter a valid 10-digit Indian mobile number (starting with 6–9).',
        'कृपया सही 10 अंकों का मोबाइल नंबर लिखें (6–9 से शुरू)।',
        'कृपया वैध १० अंकी मोबाईल नंबर टाका (६ ते ९ ने सुरू होणारा).'
      );
    }

    const numericWorkers = Number(workersRequired);
    if (!Number.isFinite(numericWorkers) || numericWorkers < 1 || numericWorkers > 5000) {
      nextErrors.workersRequired = tr(
        'Workers required must be between 1 and 5000.',
        'कामगारों की संख्या 1 से 5000 के बीच होनी चाहिए।',
        'लागणाऱ्या कामगारांची संख्या १ ते ५००० च्या दरम्यान असावी.'
      );
    }

    const numericWage = Number(offeredWage);
    if (!Number.isFinite(numericWage) || numericWage < 0 || numericWage > 500000) {
      nextErrors.offeredWage = tr(
        'Offered wage must be between ₹0 and ₹5,00,000.',
        'प्रस्तावित वेतन ₹0 से ₹5,00,000 के बीच होना चाहिए।',
        'प्रस्तावित मजुरी ₹0 ते ₹5,00,000 च्या दरम्यान असावी.'
      );
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstErrorText = Object.values(nextErrors)[0];
      setErrorMsg(
        tr(
          `Please fix the highlighted fields before publishing: ${firstErrorText}`,
          `पोस्ट करने से पहले चिह्नित फ़ील्ड ठीक करें: ${firstErrorText}`,
          `जाहिरात प्रकाशित करण्यापूर्वी खालील माहिती तपासा: ${firstErrorText}`
        )
      );
      window.setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 20);
      return;
    }

    setFieldErrors({});
    const coords = pinnedCoords || getDistrictCoordinates(stateName, resolvedDistrict);
    const reqSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);
    if (reqSkills.length === 0) reqSkills.push(cleanCategory);

    setSaving(true);
    try {
      const effectiveCity = cleanCity.length >= 2 ? cleanCity : resolvedDistrict;
      const effectiveArea = cleanArea.length >= 2 ? cleanArea : effectiveCity;
      const baseApprox = buildApproxLocationLabel({
        cityOrVillage: effectiveCity,
        district: resolvedDistrict,
        state: stateName,
      });
      const approxLocationLabel =
        cleanPin && !baseApprox.includes(cleanPin)
          ? `${baseApprox} (${cleanPin})`.slice(0, 160)
          : baseApprox.slice(0, 160);
      const finalWorkLocationLabel =
        cleanPin && !effectiveArea.includes(cleanPin)
          ? `${effectiveArea} · PIN ${cleanPin}`.slice(0, 160)
          : effectiveArea.slice(0, 160);
      const approxCoords = getApproximateCoordinates(coords.lat, coords.lng);
      const genderProtected = isFemaleCustomerProtected({
        gender: employerProfile?.gender || employerPrivate?.gender,
      });
      const resolvedLastName =
        employerProfile?.lastName ||
        employerPrivate?.lastName ||
        extractLastName(cleanContactName || employerPrivate?.contactPerson || user.displayName || '');
      const rawWorkerVisibleName = getWorkerVisibleCustomerName({
        employerProfile,
        employerPrivate,
        fullName: cleanContactName,
        fallbackName: cleanContactName || user.displayName || 'Customer',
        viewerRole: 'worker',
      }).trim();
      const workerVisibleName = rawWorkerVisibleName.length >= 2 ? rawWorkerVisibleName : 'Customer';
      const trimmedExactAddress = (
        finalWorkLocationLabel ||
        employerPrivate?.businessAddress?.trim() ||
        `${effectiveCity}, ${resolvedDistrict}${cleanPin ? ` ${cleanPin}` : ''}`
      ).slice(0, 300);
      const hasExactVault = trimmedExactAddress.length >= 4;

      const jobPayload = {
        employerUid: user.uid,
        employerName: workerVisibleName,
        customerGenderProtected: genderProtected,
        ...(resolvedLastName && resolvedLastName !== 'Customer'
          ? { customerLastName: resolvedLastName.slice(0, 60) }
          : {}),
        hasExactAddressVault: hasExactVault,
        title: cleanTitle.slice(0, 140),
        category: cleanCategory.slice(0, 80),
        description: cleanDesc.slice(0, 2000),
        workersRequired: Math.max(1, Math.min(5000, Math.round(numericWorkers))),
        requiredSkills: reqSkills,
        state: stateName,
        district: resolvedDistrict,
        cityOrVillage: effectiveCity.slice(0, 100),
        ...(cleanPin ? { pincode: cleanPin } : {}),
        workLocationLabel: approxLocationLabel.slice(0, 160),
        approxLocationLabel: approxLocationLabel.slice(0, 160),
        initialRadiusKm,
        currentRadiusKm: initialRadiusKm,
        lat: approxCoords.lat,
        lng: approxCoords.lng,
        jobDate,
        startTime,
        duration: duration.trim().slice(0, 60),
        workType,
        offeredWage: Math.max(0, Math.min(500000, Math.round(numericWage))),
        wageUnit,
        paymentTerms: paymentTerms.trim().slice(0, 200),
        contactPreference,
        isWomenFriendly,
        isAccessible,
        biddingEnabled,
        orderKind: 'work' as const,
        ...(workPhotoUrls.length > 0 ? { workPhotoUrls: workPhotoUrls.slice(0, MAX_WORK_PHOTOS) } : {}),
      };

      const id = await createJobPosting(jobPayload);

      // Save private exact address & customer preference in parallel without blocking job creation
      await Promise.allSettled([
        hasExactVault
          ? saveOrderExactAddress({
              jobId: id,
              employerUid: user.uid,
              exactAddress: trimmedExactAddress,
              exactLat: coords.lat,
              exactLng: coords.lng,
            })
          : Promise.resolve(),
        recordCustomerOrderPreference(user.uid, {
          kind: 'hire',
          categoryOrVehicleType: cleanCategory,
          orderTitle: cleanTitle,
          state: stateName,
          district: resolvedDistrict,
          cityOrVillage: effectiveCity,
          lat: coords.lat,
          lng: coords.lng,
        }),
      ]);

      // Fair-rotation Batch 1 in-app alert dispatch (non-fatal if no workers match yet)
      let inAppNotified = 0;
      let batchTargetUids: string[] = [];
      let batchFinalRadius = initialRadiusKm;
      if (workers.length > 0) {
        try {
          const broadcastRes = await broadcastSmartJobAlerts({
            jobId: id,
            job: jobPayload,
            workers,
            stageRadiusKm: initialRadiusKm,
            autoExpandIfEmpty: true,
          });
          inAppNotified = broadcastRes.notifiedCount;
          batchTargetUids = broadcastRes.newlyNotifiedUids;
          batchFinalRadius = broadcastRes.finalRadiusKm;
        } catch (dispatchErr) {
          console.warn('Fair-rotation alert dispatch notice:', dispatchErr);
        }
      }

      setCreatedJobId(id);
      setCreatedJobSummary({
        id,
        title: cleanTitle,
        category: cleanCategory,
        location: approxLocationLabel,
        notifiedCount: inAppNotified,
        radiusKm: batchFinalRadius,
      });

      if (inAppNotified > 0) {
        setPushDispatchNotice(
          tr(
            `Batch 1 notified ${inAppNotified} priority worker(s) within ${batchFinalRadius} km via fair rotation.`,
            `बैच 1: समान बारी प्रणाली से ${batchFinalRadius} किमी में ${inAppNotified} प्राथमिकता वाले कामगारों को अलर्ट भेजा गया।`,
            `बॅच १: समान संधी रोटेशनद्वारे ${batchFinalRadius} किमी मधील ${inAppNotified} कामगारांना तात्काळ अलर्ट पाठवला आहे.`
          )
        );
      } else {
        setPushDispatchNotice(
          tr(
            'Your job is now live on the Find Work board. Nearby workers matching this skill can apply immediately.',
            'आपकी काम की पोस्ट अब "काम खोजें" बोर्ड पर लाइव है। आसपास के योग्य कामगार तुरंत आवेदन कर सकते हैं।',
            'तुमची कामाची जाहिरात "काम शोधा" बोर्डवर थेट सुरू झाली आहे. जवळचे योग्य कामगार लगेच संपर्क करू शकतील.'
          )
        );
      }

      // Reset task fields for clean next post & scroll smoothly to confirmation card
      setTitle('');
      setDescription('');
      setSkillsInput('');
      setWorkPhotoUrls([]);
      window.setTimeout(() => {
        successCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);

      // Fire background FCM push notification non-blockingly (with 10s timeout) so UI never stalls
      void callNotificationApi<{
        ok?: boolean;
        matchedWorkersCount?: number;
        sentCount?: number;
        inAppOnlyCount?: number;
        message?: string;
      }>('/api/notifications/send-matching-job', {
        jobId: id,
        stageRadiusKm: batchFinalRadius,
        ...(batchTargetUids.length > 0 ? { targetWorkerUids: batchTargetUids } : {}),
      })
        .then((res) => {
          const totalMatched = Math.max(inAppNotified, res.data?.matchedWorkersCount || 0);
          if ((res.data?.sentCount || 0) > 0) {
            setPushDispatchNotice(
              tr(
                `Batch 1 notified ${totalMatched} priority worker(s) via fair rotation (${res.data.sentCount} push delivery).`,
                `बैच 1: समान बारी प्रणाली से ${totalMatched} कामगारों को सूचना भेजी गई (${res.data.sentCount} पुश अलर्ट)।`,
                `बॅच १: समान संधी रोटेशनने ${totalMatched} कामगारांना अलर्ट पाठवला (${res.data.sentCount} पुश नोटिफिकेशन).`
              )
            );
          }
        })
        .catch(() => {
          // Non-blocking: job is already saved and in-app alerts already dispatched
        });
    } catch (err) {
      setErrorMsg(
        formatUiError(
          err,
          tr(
            'Unable to publish job right now. Please check your connection and try again.',
            'अभी काम पोस्ट नहीं हो सका। कृपया इंटरनेट जांचें और पुनः प्रयास करें।',
            'सध्या कामाची जाहिरात जतन करता आली नाही. कृपया इंटरनेट तपासून पुन्हा प्रयत्न करा.'
          ),
          lang
        )
      );
      window.setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 20);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="mb-7">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
          {t.jobs.postTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t.jobs.postSubtitle}</p>
      </div>

      {!user ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#0B3B75]">{t.common.signInRequired}</p>
            <p className="text-xs text-slate-600">
              {tr(
                'Sign in once with Google to publish your job and alert verified local workers directly.',
                'काम पोस्ट करने और नज़दीकी कामगारों को तुरंत अलर्ट भेजने के लिए Google से साइन-इन करें।',
                'कामाची जाहिरात टाकण्यासाठी आणि जवळच्या कामगारांना थेट अलर्ट पाठवण्यासाठी एकदा Google ने साइन-इन करा.'
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-60 shrink-0"
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{t.nav.signIn}</span>
          </button>
        </div>
      ) : (
        <>
          {createdJobId && createdJobSummary && (
            <div
              ref={successCardRef}
              className="mb-6 bg-emerald-50 border-2 border-[#15803D]/40 rounded-xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#15803D] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-100 text-[#15803D] text-[11px] font-extrabold uppercase tracking-wide">
                    {tr('Job Published Successfully', 'काम सफलतापूर्वक पोस्ट हो गया', 'कामाची जाहिरात यशस्वीरीत्या प्रकाशित झाली')}
                  </div>
                  <h2 className="font-display text-lg font-extrabold text-[#0B3B75] mt-1">
                    {createdJobSummary.title}
                  </h2>
                  <p className="text-xs text-slate-700 mt-1">
                    <strong>{tr('Category:', 'श्रेणी:', 'व्यवसाय:')}</strong> {createdJobSummary.category} ·{' '}
                    <strong>{tr('Location:', 'स्थान:', 'ठिकाण:')}</strong> {createdJobSummary.location} ·{' '}
                    <span className="font-mono-tabular text-slate-500">ID: {createdJobSummary.id}</span>
                  </p>
                  {pushDispatchNotice && (
                    <p className="text-xs font-semibold text-emerald-900 mt-2 bg-white/80 border border-emerald-200 rounded-lg px-3 py-2">
                      {pushDispatchNotice}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('employer-dashboard')}
                  className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                >
                  {tr('Track Responses in Dashboard', 'डैशबोर्ड में प्रतिक्रिया देखें', 'डॅशबोर्डवर प्रतिसाद पहा')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('find-workers')}
                  className="px-4 py-2 rounded-lg border border-[#0B3B75] bg-white hover:bg-blue-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
                >
                  {tr('Browse Matching Workers', 'योग्य कामगार देखें', 'कामगार शोधा')}
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              ref={errorBannerRef}
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs sm:text-sm font-semibold text-red-800 flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form
            noValidate
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-5 shadow-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.jobTitle} *
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearFieldError('title');
                  }}
                  placeholder={tr(
                    'e.g., Electrician needed for house wiring',
                    'जैसे: घर की वायरिंग के लिए इलेक्ट्रीशियन चाहिए',
                    'उदा. घरगुती वायरिंगसाठी इलेक्ट्रिशियन हवा आहे'
                  )}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm ${
                    fieldErrors.title ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.category} *
                </label>
                <div className="flex items-center gap-2">
                  <ProfessionThumbnail
                    label={category}
                    hint={category}
                    size="sm"
                  />
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      clearFieldError('category');
                    }}
                    className={`flex-1 min-w-0 h-10 px-3 py-2 border rounded-lg text-sm bg-white ${
                      fieldErrors.category ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                    }`}
                  >
                    <optgroup
                      label={tr('Standard Categories', 'प्रमुख रोजगार श्रेणियाँ', 'प्रमुख रोजगार श्रेणी')}
                    >
                      {NORMAL_WORK_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.en}>
                          {lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en}
                        </option>
                      ))}
                      {extraCatalogCategories.map((svc) => (
                        <option key={svc.id} value={svc.canonicalCategory}>
                          {getServiceCategoryLabel(svc, lang)}
                        </option>
                      ))}
                    </optgroup>
                    {approvedProfessions.length > 0 && (
                      <optgroup
                        label={tr('Approved Specialized Professions', 'स्वीकृत विशेष व्यवसाय', 'मंजूर विशेष व्यवसाय')}
                      >
                        {approvedProfessions.map((p) => (
                          <option key={p.slug} value={p.nameEn}>
                            {getCustomProfessionLabel(p, lang)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {isCustomSelectedCategoryMissingFromLists && (
                      <option value={category}>{category}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddProfessionModal(true)}
                    title={tr('Add New Skill / Category', 'नया काम / श्रेणी जोड़ें', 'नवीन काम / व्यवसाय जोडा')}
                    className="h-10 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#E06D1B] hover:bg-[#C65B12] text-white text-xs font-extrabold shrink-0 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{tr('Add', 'जोड़ें', 'जोडा')}</span>
                  </button>
                </div>
                {fieldErrors.category && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.category}</p>
                )}
              </div>
            </div>

            {/* Compact Photo-Thumbnail Quick Category Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {SERVICE_CATALOG_V2.filter((s) => !s.isTransport).map((svc) => {
                const isSelected = category === svc.canonicalCategory;
                const label = getServiceCategoryLabel(svc, lang);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setCategory(svc.canonicalCategory);
                      clearFieldError('category');
                    }}
                    className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-[#0B3B75] text-[#0B3B75]'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#0B3B75]/60'
                    }`}
                  >
                    <ProfessionThumbnail
                      id={svc.id}
                      label={label}
                      hint={`${svc.en} ${svc.canonicalCategory}`}
                      size="xs"
                      accentBg={svc.accentBg}
                      accentBorder={svc.accentBorder}
                      accentText={svc.accentText}
                    />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
              {approvedProfessions.slice(0, 6).map((prof) => {
                const isSelected = category === prof.nameEn;
                const label = getCustomProfessionLabel(prof, lang);
                return (
                  <button
                    key={prof.slug}
                    type="button"
                    onClick={() => {
                      setCategory(prof.nameEn);
                      clearFieldError('category');
                    }}
                    className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-[#0B3B75] text-[#0B3B75]'
                        : 'bg-white border-indigo-200/90 text-slate-700 hover:border-[#0B3B75]/60'
                    }`}
                  >
                    <ProfessionThumbnail
                      id={prof.slug}
                      label={label}
                      hint={prof.nameEn}
                      size="xs"
                      accentBg="bg-indigo-50"
                      accentBorder="border-indigo-200"
                      accentText="text-[#0B3B75]"
                    />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowAddProfessionModal(true)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-[#E06D1B] bg-orange-50/70 hover:bg-orange-100 text-[#C25E00] text-xs font-extrabold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tr('Add Custom', 'नया जोड़ें', 'नवीन जोडा')}</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t.jobs.description} *
                </label>
                <span
                  className={`text-[11px] font-mono-tabular ${
                    description.trim().length < 10 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'
                  }`}
                >
                  {description.trim().length}/10+ {tr('chars', 'अक्षर', 'अक्षरे')}
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldError('description');
                }}
                placeholder={tr(
                  'Describe the work details, tools needed, or timing clearly (minimum 10 characters)...',
                  'काम की जानकारी, आवश्यक औज़ार या समय विस्तार से लिखें (कम से कम 10 अक्षर)...',
                  'कामाची माहिती, लागणारे साहित्य किंवा वेळेचा तपशील लिहा (किमान १० अक्षरे)...'
                )}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm ${
                  fieldErrors.description ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                }`}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.description}</p>
              )}
            </div>

            {/* Customer Contact Details (Privacy Protected — No OTP Fraud) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B3B75]">
                  <Phone className="w-3.5 h-3.5 text-[#E06D1B]" />
                  <span>
                    {tr(
                      'Contact Details (Private & Protected)',
                      'संपर्क विवरण (गोपनीय और सुरक्षित)',
                      'संपर्क माहिती (खाजगी व सुरक्षित)'
                    )}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {tr(
                    'No OTP call required · Number hidden on public job card',
                    'OTP कॉल नहीं · नंबर पब्लिक कार्ड पर नहीं दिखता',
                    'कॉल OTP नाही · नंबर जाहीर कार्डवर दिसत नाही'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('Your Name / Business Name *', 'आपका नाम / व्यवसाय का नाम *', 'तुमचे नाव / व्यवसायाचे नाव *')}
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={contactName}
                    onChange={(e) => {
                      setContactName(e.target.value);
                      clearFieldError('contactName');
                    }}
                    placeholder={tr('e.g., Rajesh Patil', 'जैसे: राजेश पाटिल', 'उदा. राजेश पाटील')}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${
                      fieldErrors.contactName ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.contactName && (
                    <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.contactName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('10-Digit Mobile Number *', '10 अंकों का मोबाइल नंबर *', '१० अंकी मोबाईल नंबर *')}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={contactMobile}
                    onChange={(e) => {
                      setContactMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                      clearFieldError('contactMobile');
                    }}
                    placeholder={tr('e.g., 9876543210', 'जैसे: 9876543210', 'उदा. 9876543210')}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono-tabular bg-white ${
                      fieldErrors.contactMobile ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.contactMobile && (
                    <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.contactMobile}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.workersRequired} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={workersRequired}
                  onChange={(e) => {
                    setWorkersRequired(Number(e.target.value));
                    clearFieldError('workersRequired');
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono-tabular ${
                    fieldErrors.workersRequired ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.workersRequired && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.workersRequired}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.requiredSkills}{' '}
                  <span className="font-normal text-slate-500">
                    ({tr('optional — defaults to selected category', 'वैकल्पिक', 'ऐच्छिक')})
                  </span>
                </label>
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder={tr(
                    `e.g., ${category}, Repair, Installation`,
                    `जैसे: ${category}, रिपेयर, फिटिंग`,
                    `उदा. ${category}, दुरुस्ती, फिटिंग`
                  )}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.workerForm.state} *
                </label>
                <select
                  value={stateName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStateName(val);
                    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === val);
                    setDistrictName(st?.districts[0]?.name || val);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {INDIA_STATES_DISTRICTS.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.workerForm.district} *
                </label>
                <select
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {stateObj?.districts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.workerForm.cityVillage} *
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={cityOrVillage}
                  onChange={(e) => {
                    setCityOrVillage(e.target.value);
                    clearFieldError('cityOrVillage');
                  }}
                  placeholder={tr('City / Village', 'शहर / गाँव', 'शहर / गाव')}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    fieldErrors.cityOrVillage ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.cityOrVillage && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.cityOrVillage}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tr('Pincode (6-digit) *', 'पिनकोड (6 अंक) *', 'पिनकोड (६ अंकी) *')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    clearFieldError('pincode');
                  }}
                  placeholder="442401"
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono-tabular ${
                    fieldErrors.pincode ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.pincode && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.pincode}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.workLocationLabel} *
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={workLocationLabel}
                  onChange={(e) => {
                    setWorkLocationLabel(e.target.value);
                    clearFieldError('workLocationLabel');
                  }}
                  placeholder={tr('Area / Colony', 'इलाका / कॉलोनी', 'परिसर / कॉलनी')}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    fieldErrors.workLocationLabel ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.workLocationLabel && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.workLocationLabel}</p>
                )}
              </div>
            </div>

            {/* UPLOAD WORK PHOTOS (Gallery + Camera + Progress + Preview + Replace/Remove) */}
            <WorkPhotoUploader
              photos={workPhotoUrls}
              onChange={setWorkPhotoUrls}
              ownerUid={user.uid}
              folder="work"
              disabled={saving}
              onUploadingChange={setPhotoUploading}
            />

            {/* Approximate Work Area GPS Helper (Exact Location shared only AFTER offer acceptance) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                <strong className="text-[#0B3B75]">
                  {tr('Approximate Work Area (GPS):', 'अनुमानित कार्य क्षेत्र (GPS):', 'अंदाजे कामाचा परिसर (GPS):')}
                </strong>{' '}
                {pinnedCoords
                  ? tr(
                      `Detected ${formatCoordinatesLabel(pinnedCoords.lat, pinnedCoords.lng)} — exact address stays hidden until you confirm a worker.`,
                      `लोकेशन प्राप्त ${formatCoordinatesLabel(pinnedCoords.lat, pinnedCoords.lng)} — सटीक पता कन्फर्म होने के बाद ही साझा होगा।`,
                      `लोकेशन सापडले ${formatCoordinatesLabel(pinnedCoords.lat, pinnedCoords.lng)} — कामगार निश्चित केल्यानंतरच अचूक पत्ता शेअर होतो.`
                    )
                  : tr(
                      'Optional: auto-fill city, pincode & coordinates for nearby workers, or type manually above.',
                      'वैकल्पिक: शहर, पिनकोड व निर्देशांक अपने-आप भरने के लिए GPS उपयोग करें या ऊपर मैन्युअल भरें।',
                      'ऐच्छिक: गाव, पिनकोड व अचूक लोकेशन आपोआप भरण्यासाठी GPS वापरा किंवा वर स्वतः भरा.'
                    )}
              </div>
              <button
                type="button"
                disabled={gpsBusy}
                onClick={handleShareJobGps}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer disabled:opacity-60"
              >
                <LocateFixed className={`w-4 h-4 text-amber-300 ${gpsBusy ? 'animate-spin' : ''}`} />
                <span>
                  {gpsBusy
                    ? tr('Detecting GPS...', 'GPS खोज रहे हैं...', 'GPS शोधत आहे...')
                    : tr(
                        'Get My Current Location',
                        'मेरा वर्तमान स्थान प्राप्त करें',
                        'माझे सध्याचे लोकेशन मिळवा'
                      )}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.jobDate}
                </label>
                <input
                  type="date"
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.startTime}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.duration}
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.workType}
                </label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as JobWorkType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="daily_wage">{tr('Daily Wage', 'दैनिक वेतन', 'रोजंदारी')}</option>
                  <option value="urgent">{tr('Urgent Requirement', 'तुरंत आवश्यक', 'तातडीचे काम')}</option>
                  <option value="contract">{tr('Contract', 'ठेका / कॉन्ट्रैक्ट', 'कंत्राट')}</option>
                  <option value="full_time">{tr('Full-time', 'फुल-टाइम', 'पूर्ण वेळ')}</option>
                  <option value="part_time">{tr('Part-time', 'पार्ट-टाइम', 'अर्धवेळ')}</option>
                  <option value="temporary">{tr('Temporary', 'अस्थायी', 'तात्पुरते')}</option>
                  <option value="bulk">{tr('Bulk Workforce', 'बल्क कामगार', 'मोठ्या संख्येने कामगार')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.offeredWage} *
                </label>
                <input
                  type="number"
                  min={0}
                  max={500000}
                  value={offeredWage}
                  onChange={(e) => {
                    setOfferedWage(Number(e.target.value));
                    clearFieldError('offeredWage');
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono-tabular ${
                    fieldErrors.offeredWage ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.offeredWage && (
                  <p className="mt-1 text-xs font-semibold text-red-700">{fieldErrors.offeredWage}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.workerForm.wageUnit}
                </label>
                <select
                  value={wageUnit}
                  onChange={(e) => setWageUnit(e.target.value as WageUnit)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="daily">{tr('Daily', 'प्रति दिन', 'प्रति दिन')}</option>
                  <option value="monthly">{tr('Monthly', 'प्रति माह', 'प्रति महिना')}</option>
                  <option value="hourly">{tr('Hourly', 'प्रति घंटा', 'प्रति तास')}</option>
                  <option value="contract">{tr('Contract', 'ठेका / फिक्स्ड', 'कंत्राट')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.paymentTerms}
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.jobs.contactPref}
                </label>
                <select
                  value={contactPreference}
                  onChange={(e) => setContactPreference(e.target.value as typeof contactPreference)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="phone_after_confirm">
                    {tr('Phone after confirmation', 'कन्फर्म होने के बाद फ़ोन', 'निश्चित झाल्यावर फोन')}
                  </option>
                  <option value="platform_message">
                    {tr('Platform updates only', 'केवल ऐप अपडेट', 'फक्त अ‍ॅप अपडेट्स')}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(
                  'Initial Notification Radius Stage (Staged: 2 → 5 → 10 → 20 → 30 km)',
                  'प्रारंभिक अलर्ट दायरा (2 → 5 → 10 → 20 → 30 किमी)',
                  'सुरुवातीचा अलर्ट परिसर (2 → 5 → 10 → 20 → 30 किमी)'
                )}
              </label>
              <select
                value={initialRadiusKm}
                onChange={(e) => setInitialRadiusKm(Number(e.target.value) as ServiceRadiusKm)}
                className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono-tabular"
              >
                {SERVICE_RADIUS_STAGES.map((km) => (
                  <option key={km} value={km}>
                    {km} km {tr('initial broadcast radius', 'प्रारंभिक दायरा', 'सुरुवातीचा परिसर')}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 text-sm text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWomenFriendly}
                  onChange={(e) => setIsWomenFriendly(e.target.checked)}
                />
                <span>{t.jobs.womenFriendly}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAccessible}
                  onChange={(e) => setIsAccessible(e.target.checked)}
                />
                <span>{t.jobs.accessibleWork}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={biddingEnabled}
                  onChange={(e) => setBiddingEnabled(e.target.checked)}
                />
                <span>{t.jobs.allowQuotes}</span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm font-semibold text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {!employerProfile && (
                <button
                  type="button"
                  onClick={() => onNavigate('register-employer')}
                  className="text-xs font-semibold text-[#0B3B75] hover:underline text-left cursor-pointer"
                >
                  {tr(
                    'Optional: Save a permanent Employer / Business Profile →',
                    'वैकल्पिक: स्थायी नियोक्ता / व्यवसाय प्रोफ़ाइल बनाएं →',
                    'ऐच्छिक: कायमस्वरूपी व्यवसाय / ग्राहक प्रोफाईल तयार करा →'
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={saving || photoUploading}
                className="sm:ml-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold shadow-xs disabled:opacity-60 cursor-pointer transition-colors"
              >
                {(saving || photoUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {photoUploading
                    ? tr('Uploading Work Photos...', 'फ़ोटो अपलोड हो रही हैं...', 'कामाचे फोटो अपलोड होत आहेत...')
                    : saving
                    ? tr('Publishing Job & Alerting Workers...', 'काम पोस्ट हो रहा है और अलर्ट भेजा जा रहा है...', 'कामाची जाहिरात जतन होत आहे...')
                    : t.jobs.publishBtn}
                </span>
              </button>
            </div>
          </form>
        </>
      )}
      <AddProfessionModal
        open={showAddProfessionModal}
        onClose={() => setShowAddProfessionModal(false)}
        lang={lang}
        user={user}
        existingProfessions={approvedProfessions}
        onAdded={(res) => {
          setCategory(res.canonicalName);
          clearFieldError('category');
          setSkillsInput((prev) =>
            prev.trim()
              ? prev.toLowerCase().includes(res.canonicalName.toLowerCase())
                ? prev
                : `${res.canonicalName}, ${prev}`
              : res.canonicalName
          );
        }}
      />
    </div>
  );
};
