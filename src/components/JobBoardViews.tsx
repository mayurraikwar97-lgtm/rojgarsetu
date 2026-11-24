import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Briefcase, CheckCircle2, LocateFixed, MapPin, Plus, PlusCircle, Search, Users, Volume2, VolumeX } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { SERVICE_CATALOG_V2, getServiceCategoryLabel } from '../data/serviceCatalogV2';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
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
  saveOrderExactAddress,
  submitWorkerOffer,
} from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
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

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(NORMAL_WORK_CATEGORIES[0].en);
  const [description, setDescription] = useState('');
  const [workersRequired, setWorkersRequired] = useState(1);
  const [skillsInput, setSkillsInput] = useState('Masonry, Site Support');
  const [stateName, setStateName] = useState(employerProfile?.state || 'Chhattisgarh');
  const [districtName, setDistrictName] = useState(employerProfile?.district || 'Raipur');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [workLocationLabel, setWorkLocationLabel] = useState('');
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [workPhotoUrls, setWorkPhotoUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [jobDate, setJobDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('15 days');
  const [workType, setWorkType] = useState<JobWorkType>('daily_wage');
  const [offeredWage, setOfferedWage] = useState(650);
  const [wageUnit, setWageUnit] = useState<WageUnit>('daily');
  const [paymentTerms, setPaymentTerms] = useState('Weekly bank/UPI settlement');
  const [contactPreference, setContactPreference] = useState<'platform_message' | 'phone_after_confirm'>('phone_after_confirm');
  const [isWomenFriendly, setIsWomenFriendly] = useState(false);
  const [isAccessible, setIsAccessible] = useState(false);
  const [biddingEnabled, setBiddingEnabled] = useState(true);
  const [initialRadiusKm, setInitialRadiusKm] = useState<ServiceRadiusKm>(5);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdJobId, setCreatedJobId] = useState('');
  const [pushDispatchNotice, setPushDispatchNotice] = useState('');
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);
  const [showAddProfessionModal, setShowAddProfessionModal] = useState(false);
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    return subscribeApprovedProfessions(setApprovedProfessions);
  }, []);

  const stateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName);

  const handleShareJobGps = async () => {
    setGpsBusy(true);
    setErrorMsg('');
    try {
      const geo = await detectBestGpsLocation(lang);
      setPinnedCoords({ lat: geo.lat, lng: geo.lng });
      if (geo.state && INDIA_STATES_DISTRICTS.some((s) => s.name === geo.state)) {
        setStateName(geo.state);
      }
      if (geo.district) setDistrictName(geo.district);
      if (geo.cityOrVillage) setCityOrVillage(geo.cityOrVillage);
      if (geo.formattedAddress) setWorkLocationLabel(geo.formattedAddress.slice(0, 160));
    } catch {
      setErrorMsg('Unable to detect GPS location. Please enter city/village manually.');
    } finally {
      setGpsBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPushDispatchNotice('');
    if (!user || !employerProfile) return;

    const coords = pinnedCoords || getDistrictCoordinates(stateName, districtName);
    const reqSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);
    if (reqSkills.length === 0) reqSkills.push(category);

    setSaving(true);
    try {
      const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);
      const baseApprox = buildApproxLocationLabel({
        cityOrVillage: cityOrVillage.trim(),
        district: districtName,
        state: stateName,
      });
      const approxLocationLabel =
        cleanPin.length === 6 && !baseApprox.includes(cleanPin)
          ? `${baseApprox} (${cleanPin})`
          : baseApprox;
      const finalWorkLocationLabel =
        cleanPin.length === 6 && !workLocationLabel.includes(cleanPin)
          ? `${workLocationLabel.trim()} · PIN ${cleanPin}`.slice(0, 160)
          : workLocationLabel.trim();
      const approxCoords = getApproximateCoordinates(coords.lat, coords.lng);
      const genderProtected = isFemaleCustomerProtected({
        gender: employerProfile.gender || employerPrivate?.gender,
      });
      const resolvedLastName =
        employerProfile.lastName ||
        employerPrivate?.lastName ||
        extractLastName(employerPrivate?.contactPerson || user.displayName || '');
      const workerVisibleName = getWorkerVisibleCustomerName({
        employerProfile,
        employerPrivate,
        fallbackName: user.displayName || 'Customer',
        viewerRole: 'worker',
      });
      const trimmedExactAddress = (
        finalWorkLocationLabel ||
        employerPrivate?.businessAddress?.trim() ||
        ''
      ).slice(0, 320);
      const hasExactVault = trimmedExactAddress.length >= 4;

      const jobPayload = {
        employerUid: user.uid,
        employerName: workerVisibleName,
        customerGenderProtected: genderProtected,
        ...(resolvedLastName && resolvedLastName !== 'Customer'
          ? { customerLastName: resolvedLastName.slice(0, 60) }
          : {}),
        hasExactAddressVault: hasExactVault,
        title: title.trim().slice(0, 140),
        category,
        description: description.trim().slice(0, 2000),
        workersRequired: Number(workersRequired) || 1,
        requiredSkills: reqSkills,
        state: stateName,
        district: districtName,
        cityOrVillage: cityOrVillage.trim().slice(0, 100),
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
        offeredWage: Number(offeredWage) || 0,
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
      if (hasExactVault) {
        await saveOrderExactAddress({
          jobId: id,
          employerUid: user.uid,
          exactAddress: trimmedExactAddress,
          exactLat: coords.lat,
          exactLng: coords.lng,
        }).catch(() => undefined);
      }
      setCreatedJobId(id);
      setWorkPhotoUrls([]);
      setPincode('');

      let inAppNotified = 0;
      let batchTargetUids: string[] = [];
      let batchFinalRadius = initialRadiusKm;
      if (workers.length > 0) {
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
      }

      try {
        const res = await callNotificationApi<{
          ok?: boolean;
          matchedWorkersCount?: number;
          sentCount?: number;
          inAppOnlyCount?: number;
          message?: string;
        }>('/api/notifications/send-matching-job', {
          jobId: id,
          stageRadiusKm: batchFinalRadius,
          ...(batchTargetUids.length > 0 ? { targetWorkerUids: batchTargetUids } : {}),
        });
        if ((res.data.sentCount || 0) > 0) {
          setPushDispatchNotice(
            `Batch 1 notified ${Math.max(inAppNotified, res.data.matchedWorkersCount || 0)} priority worker(s) via fair rotation (${res.data.sentCount} push delivery).`
          );
        } else if (inAppNotified > 0 || (res.data.matchedWorkersCount || 0) > 0) {
          setPushDispatchNotice(
            `Batch 1 notified ${Math.max(inAppNotified, res.data.matchedWorkersCount || 0)} priority worker(s) immediately in-app (fair rotation).`
          );
        }
      } catch {
        if (inAppNotified > 0) {
          setPushDispatchNotice(`Batch 1 notified ${inAppNotified} priority worker(s) immediately in-app (fair rotation).`);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to publish job.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
          {t.jobs.postTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t.jobs.postSubtitle}</p>
      </div>

      {!user ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-700">{t.common.signInRequired}</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold cursor-pointer"
          >
            {t.nav.signIn}
          </button>
        </div>
      ) : !employerProfile ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-amber-950">
            Please complete Employer Registration before publishing a job requirement.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('register-employer')}
            className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            {t.nav.employerReg}
          </button>
        </div>
      ) : (
        <>
          {createdJobId && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-green-950">
                  Job published successfully (ID: <span className="font-mono-tabular">{createdJobId}</span>).
                </p>
                {pushDispatchNotice && (
                  <p className="text-xs text-emerald-800 mt-1">{pushDispatchNotice}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('employer-dashboard')}
                className="px-4 py-2 rounded-md bg-[#15803D] text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                {t.nav.employerDashboard}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.jobTitle} *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 min-w-0 h-10 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <optgroup
                      label={
                        lang === 'mr'
                          ? 'प्रमुख रोजगार श्रेणी'
                          : lang === 'hi'
                          ? 'प्रमुख रोजगार श्रेणियाँ'
                          : 'Standard Categories'
                      }
                    >
                      {NORMAL_WORK_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.en}>
                          {lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en}
                        </option>
                      ))}
                    </optgroup>
                    {approvedProfessions.length > 0 && (
                      <optgroup
                        label={
                          lang === 'mr'
                            ? 'मंजूर विशेष व्यवसाय'
                            : lang === 'hi'
                            ? 'स्वीकृत विशेष व्यवसाय'
                            : 'Approved Specialized Professions'
                        }
                      >
                        {approvedProfessions.map((p) => (
                          <option key={p.slug} value={p.nameEn}>
                            {getCustomProfessionLabel(p, lang)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddProfessionModal(true)}
                    title={
                      lang === 'mr'
                        ? 'नवीन काम / व्यवसाय जोडा'
                        : lang === 'hi'
                        ? 'नया काम / श्रेणी जोड़ें'
                        : 'Add New Skill / Category'
                    }
                    className="h-10 inline-flex items-center gap-1 px-3 py-2 rounded-md bg-[#E06D1B] hover:bg-[#C65B12] text-white text-xs font-extrabold shrink-0 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'mr' ? 'जोडा' : lang === 'hi' ? 'जोड़ें' : 'Add'}</span>
                  </button>
                </div>
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
                    onClick={() => setCategory(svc.canonicalCategory)}
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
                    onClick={() => setCategory(prof.nameEn)}
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.jobs.description} *
              </label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.workersRequired} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={workersRequired}
                  onChange={(e) => setWorkersRequired(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.requiredSkills} *
                </label>
                <input
                  type="text"
                  required
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.workerForm.state} *
                </label>
                <select
                  value={stateName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStateName(val);
                    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === val);
                    setDistrictName(st?.districts[0]?.name || '');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {INDIA_STATES_DISTRICTS.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.workerForm.district} *
                </label>
                <select
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {stateObj?.districts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.workerForm.cityVillage} *
                </label>
                <input
                  type="text"
                  required
                  value={cityOrVillage}
                  onChange={(e) => setCityOrVillage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'mr' ? 'पिनकोड (६ अंकी)' : lang === 'hi' ? 'पिनकोड (6 अंक)' : 'Pincode (6-digit)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 442401"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.workLocationLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={workLocationLabel}
                  onChange={(e) => setWorkLocationLabel(e.target.value)}
                  placeholder={lang === 'mr' ? 'परिसर / कॉलनी' : lang === 'hi' ? 'इलाका / कॉलोनी' : 'Area / Colony'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
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
                <strong className="text-[#0B3B75]">Approximate Work Area (GPS):</strong>{' '}
                {pinnedCoords
                  ? `Pinned (${pinnedCoords.lat.toFixed(4)}, ${pinnedCoords.lng.toFixed(4)}) — workers see approximate distance before quoting. Exact location is shared only after you accept an offer.`
                  : 'Optional: pin your area so nearby workers see approximate distance. Exact location stays hidden until offer acceptance.'}
              </div>
              <button
                type="button"
                disabled={gpsBusy}
                onClick={handleShareJobGps}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 cursor-pointer disabled:opacity-60"
              >
                <LocateFixed className="w-4 h-4 text-[#E06D1B]" />
                <span>{gpsBusy ? 'Detecting GPS...' : 'Pin Work Area (GPS)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.jobDate}
                </label>
                <input
                  type="date"
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.startTime}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.duration}
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.workType}
                </label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as JobWorkType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="daily_wage">Daily Wage</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                  <option value="urgent">Urgent Requirement</option>
                  <option value="bulk">Bulk Workforce</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.offeredWage} *
                </label>
                <input
                  type="number"
                  min={0}
                  value={offeredWage}
                  onChange={(e) => setOfferedWage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.workerForm.wageUnit}
                </label>
                <select
                  value={wageUnit}
                  onChange={(e) => setWageUnit(e.target.value as WageUnit)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.paymentTerms}
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.jobs.contactPref}
                </label>
                <select
                  value={contactPreference}
                  onChange={(e) => setContactPreference(e.target.value as typeof contactPreference)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="phone_after_confirm">Phone after confirmation</option>
                  <option value="platform_message">Platform updates only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Notification Radius Stage (Staged: 5 → 10 → 20 → 30 km)
              </label>
              <select
                value={initialRadiusKm}
                onChange={(e) => setInitialRadiusKm(Number(e.target.value) as ServiceRadiusKm)}
                className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-mono-tabular"
              >
                {SERVICE_RADIUS_STAGES.map((km) => (
                  <option key={km} value={km}>
                    {km} km initial broadcast radius
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
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || photoUploading}
                className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {photoUploading
                  ? 'Uploading Work Photos...'
                  : saving
                  ? t.common.loading
                  : t.jobs.publishBtn}
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
