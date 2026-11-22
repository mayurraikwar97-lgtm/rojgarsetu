import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Briefcase, Camera, CheckCircle2, LocateFixed, MapPin, PlusCircle, Search, Users, Volume2, VolumeX } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  callNotificationApi,
  createJobPosting,
  notifyMatchingWorkersInApp,
  submitWorkerOffer,
} from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildApproxLocationLabel,
  buildSmartJobVoiceScript,
  calculateValidDistanceKm,
  getPublicJobLocationText,
  SERVICE_RADIUS_STAGES,
} from '../lib/smartVoiceJobAlert';
import { MAX_WORK_PHOTOS, uploadCustomerWorkPhoto } from '../lib/workPhotoService';
import { speakJobAlert, stopVoiceAlert, unlockAudioOnUserGesture } from '../lib/voiceAlertEngine';
import type {
  JobPosting,
  JobWorkType,
  PageRoute,
  PublicWorkerProfile,
  ServiceRadiusKm,
  WageUnit,
} from '../types/domain';
import { SecureAvatar } from './SecureAvatar';

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

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = jobs
      .filter((j) => j.status === 'open')
      .filter((j) => !stateFilter || j.state === stateFilter)
      .filter((j) => !workTypeFilter || j.workType === workTypeFilter)
      .filter((j) => !womenOnly || j.isWomenFriendly)
      .filter((j) => !pwdOnly || j.isAccessible)
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          j.category.toLowerCase().includes(q) ||
          j.district.toLowerCase().includes(q) ||
          j.employerName.toLowerCase().includes(q) ||
          j.requiredSkills.some((s) => s.toLowerCase().includes(q))
      );

    if (highlightedJobId) {
      list.sort((a, b) => (a.id === highlightedJobId ? -1 : b.id === highlightedJobId ? 1 : 0));
    }
    return list;
  }, [jobs, search, stateFilter, workTypeFilter, womenOnly, pwdOnly, highlightedJobId]);

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

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            onChange={(e) => setStateFilter(e.target.value)}
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

        <div className="flex flex-wrap gap-6 text-xs font-medium text-slate-700">
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
      </div>

      {highlightedJobId && (
        <div className="mb-6 bg-amber-50 border-2 border-[#E06D1B] rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0B3B75]">
            <BellRing className="w-4 h-4 text-[#E06D1B] shrink-0" />
            <span>
              Opened directly from your ROJGAR SETU push notification. Review details below and tap Apply.
            </span>
          </div>
          {onClearHighlightedJob && (
            <button
              type="button"
              onClick={onClearHighlightedJob}
              className="text-xs font-bold text-[#C25E00] hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
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

                  {job.photoAttachment && (
                    <div className="flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-200">
                      <img
                        src={job.photoAttachment}
                        alt={`Work site photo for ${job.title}`}
                        className="w-14 h-14 rounded object-cover border border-slate-200 shrink-0"
                      />
                      <span className="text-[11px] font-medium text-slate-600">
                        {job.photoAnalyzed
                          ? 'Site photo attached (AI-analyzed)'
                          : 'Site photo attached by customer (not AI-analyzed)'}
                      </span>
                    </div>
                  )}

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
                  <span className="text-xs text-slate-500 font-medium">{job.employerName}</span>

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
              {applyingJob.employerName} · Offered ₹{applyingJob.offeredWage} / {applyingJob.wageUnit}
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
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => !stateFilter || w.state === stateFilter)
      .filter((w) => !availFilter || w.availabilityStatus === availFilter)
      .filter(
        (w) =>
          !q ||
          w.displayName.toLowerCase().includes(q) ||
          w.primarySkill.toLowerCase().includes(q) ||
          w.district.toLowerCase().includes(q) ||
          w.skills.some((s) => s.toLowerCase().includes(q))
      );
  }, [workers, search, stateFilter, availFilter]);

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

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by skill, district, or worker name..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
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
          value={availFilter}
          onChange={(e) => setAvailFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Availability</option>
          <option value="available">Available Immediately</option>
          <option value="busy">Currently Engaged</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600">{t.common.noRecords}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((w) => (
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
              <p className="text-xs font-semibold text-[#C25E00]">{w.primarySkill}</p>
              <p className="text-xs text-slate-600">
                Skills: {w.skills.join(' · ')}
              </p>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <p>
                  {w.cityOrVillage}, {w.district}, {w.state}
                </p>
                <p className="font-mono-tabular">
                  Exp: {w.experienceYears} yrs · Expected: ₹{w.expectedWage.toLocaleString('en-IN')} / {w.wageUnit}
                </p>
                <p className="text-slate-500">Languages: {w.languagesKnown.join(', ')}</p>
              </div>
            </div>
          ))}
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
  const { user, employerProfile, signInWithGoogle } = useAuth();

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

  const handleUploadJobPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    const slots = MAX_WORK_PHOTOS - workPhotoUrls.length;
    if (slots <= 0) return;
    setPhotoUploading(true);
    setErrorMsg('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, slots)) {
        const res = await uploadCustomerWorkPhoto({ file, ownerUid: user.uid, folder: 'work' });
        urls.push(res.url);
      }
      setWorkPhotoUrls((prev) => [...prev, ...urls].slice(0, MAX_WORK_PHOTOS));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to upload work photo.');
    } finally {
      setPhotoUploading(false);
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
      const approxLocationLabel = buildApproxLocationLabel({
        cityOrVillage: cityOrVillage.trim(),
        district: districtName,
        state: stateName,
      });
      const jobPayload = {
        employerUid: user.uid,
        employerName: employerProfile.businessName,
        title: title.trim().slice(0, 140),
        category,
        description: description.trim().slice(0, 2000),
        workersRequired: Number(workersRequired) || 1,
        requiredSkills: reqSkills,
        state: stateName,
        district: districtName,
        cityOrVillage: cityOrVillage.trim().slice(0, 100),
        workLocationLabel: workLocationLabel.trim().slice(0, 160),
        approxLocationLabel: approxLocationLabel.slice(0, 160),
        initialRadiusKm,
        currentRadiusKm: initialRadiusKm,
        lat: coords.lat,
        lng: coords.lng,
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
      setCreatedJobId(id);
      setWorkPhotoUrls([]);

      let inAppNotified = 0;
      if (workers.length > 0) {
        inAppNotified = await notifyMatchingWorkersInApp({
          jobId: id,
          job: jobPayload,
          workers,
          stageRadiusKm: initialRadiusKm,
          autoExpandIfEmpty: true,
        });
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
          stageRadiusKm: initialRadiusKm,
        });
        if ((res.data.sentCount || 0) > 0) {
          setPushDispatchNotice(
            `Notified ${Math.max(inAppNotified, res.data.matchedWorkersCount || 0)} matching worker(s) (${res.data.sentCount} push delivery).`
          );
        } else if (inAppNotified > 0 || (res.data.matchedWorkersCount || 0) > 0) {
          setPushDispatchNotice(
            `${Math.max(inAppNotified, res.data.matchedWorkersCount || 0)} matching worker(s) notified immediately in-app.`
          );
        }
      } catch {
        if (inAppNotified > 0) {
          setPushDispatchNotice(`${inAppNotified} matching worker(s) notified immediately in-app.`);
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
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {NORMAL_WORK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.en}>
                      {lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en}
                    </option>
                  ))}
                </select>
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
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
                  {t.jobs.workLocationLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={workLocationLabel}
                  onChange={(e) => setWorkLocationLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* Work Photos Upload (1 or more) + SHARE JOB LOCATION */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 cursor-pointer">
                  <Camera className="w-4 h-4 text-[#E06D1B]" />
                  <span>
                    {photoUploading
                      ? 'Uploading photo...'
                      : `Upload Work Photos (${workPhotoUrls.length}/${MAX_WORK_PHOTOS})`}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={photoUploading || workPhotoUrls.length >= MAX_WORK_PHOTOS}
                    onChange={(e) => {
                      void handleUploadJobPhotos(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={handleShareJobGps}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
                >
                  <LocateFixed className="w-4 h-4" />
                  <span>{gpsBusy ? 'Detecting GPS...' : 'SHARE JOB LOCATION'}</span>
                </button>
              </div>

              {pinnedCoords && (
                <p className="text-xs font-semibold text-[#15803D]">
                  GPS pinned ({pinnedCoords.lat.toFixed(4)}, {pinnedCoords.lng.toFixed(4)}) — workers will see approximate distance &amp; area before quoting.
                </p>
              )}

              {workPhotoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {workPhotoUrls.map((url, idx) => (
                    <div key={`postjob-photo-${idx}`} className="relative">
                      <img
                        src={url}
                        alt={`Work photo ${idx + 1}`}
                        className="w-16 h-16 rounded object-cover border border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setWorkPhotoUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label="Remove photo"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-700 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                disabled={saving}
                className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 cursor-pointer"
              >
                {saving ? t.common.loading : t.jobs.publishBtn}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
