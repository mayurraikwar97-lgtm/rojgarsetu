import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Compass, MapPin, Plus, ShieldAlert, X } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import { saveWorkerRegistration } from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildWorkerPhotoDocId,
  deleteProfilePhotoRecord,
  uploadProfilePhotoRecord,
} from '../lib/photoStorageService';
import type { PageRoute, VerificationMethod, WageUnit, WorkType } from '../types/domain';
import { LocationPinModal } from './LocationPinModal';
import { NotificationOptInButton } from './NotificationOptInButton';
import { OtpVerificationBox } from './OtpVerificationBox';
import { ProfilePhotoUploader, type SelectedProfilePhoto } from './ProfilePhotoUploader';
import { PWAInstallButton } from './PWAControls';
import { SecureAvatar } from './SecureAvatar';

interface WorkerRegistrationFormProps {
  onNavigate: (route: PageRoute) => void;
}

export const WorkerRegistrationForm: React.FC<WorkerRegistrationFormProps> = ({ onNavigate }) => {
  const { lang, t } = useLanguage();
  const { user, authError, clearAuthError, workerProfile, workerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();
  const authBannerRef = useRef<HTMLDivElement | null>(null);
  const errorBoxRef = useRef<HTMLDivElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | undefined>(undefined);
  const [testPinHash, setTestPinHash] = useState('');
  const [email, setEmail] = useState('');
  const [stateName, setStateName] = useState('Chhattisgarh');
  const [districtName, setDistrictName] = useState('Narayanpur (Abujhmad)');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [approxLat, setApproxLat] = useState<number>(19.7176);
  const [approxLng, setApproxLng] = useState<number>(81.2468);
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [gender, setGender] = useState<'female' | 'male' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [education, setEducation] = useState('10th / Secondary');
  const [primarySkill, setPrimarySkill] = useState(EMPLOYMENT_CATEGORIES[0].en);
  const [skills, setSkills] = useState<string[]>([EMPLOYMENT_CATEGORIES[0].en]);
  const [newSkillText, setNewSkillText] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(2);
  const [expectedWage, setExpectedWage] = useState<number>(600);
  const [wageUnit, setWageUnit] = useState<WageUnit>('daily');
  const [preferredWorkType, setPreferredWorkType] = useState<WorkType>('daily_wage');
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'busy' | 'offline'>('available');
  const [preferredWorkLocation, setPreferredWorkLocation] = useState('');
  const [languagesInput, setLanguagesInput] = useState('Hindi, English');
  const [certificateNotes, setCertificateNotes] = useState('');
  const [idVerificationStatus, setIdVerificationStatus] = useState<'not_submitted' | 'voluntary_pending'>('not_submitted');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [liveLocationConsent, setLiveLocationConsent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedId, setSavedId] = useState('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    if (workerProfile && workerPrivate) {
      setFullName(workerPrivate.fullName || workerProfile.displayName);
      setMobile(workerPrivate.mobile || '');
      setMobileVerified(workerPrivate.mobileVerified);
      setVerificationMethod(workerPrivate.verificationMethod);
      setTestPinHash(workerPrivate.testPinHash || '');
      setEmail(workerPrivate.email || '');
      setStateName(workerProfile.state);
      setDistrictName(workerProfile.district);
      setCityOrVillage(workerProfile.cityOrVillage);
      setApproxLat(workerProfile.approxLat);
      setApproxLng(workerProfile.approxLng);
      setPhotoUrl(workerPrivate.photoUrl || '');
      setGender(workerProfile.gender || 'prefer_not_to_say');
      setAgeConfirmed(workerPrivate.ageConfirmed);
      setEducation(workerProfile.education || '');
      setPrimarySkill(workerProfile.primarySkill);
      setSkills(workerProfile.skills || [workerProfile.primarySkill]);
      setExperienceYears(workerProfile.experienceYears);
      setExpectedWage(workerProfile.expectedWage);
      setWageUnit(workerProfile.wageUnit);
      setPreferredWorkType(workerProfile.preferredWorkType);
      setAvailabilityStatus(workerProfile.availabilityStatus);
      setPreferredWorkLocation(workerPrivate.preferredWorkLocation || '');
      setLanguagesInput((workerProfile.languagesKnown || []).join(', '));
      setCertificateNotes(workerPrivate.certificateNotes || '');
      setIdVerificationStatus(
        workerPrivate.idVerificationStatus === 'voluntary_pending' ? 'voluntary_pending' : 'not_submitted'
      );
      setPrivacyConsent(workerPrivate.privacyConsent);
      setLiveLocationConsent(workerPrivate.liveLocationConsent);
      setSavedId(workerProfile.registrationId);
    } else if (user) {
      setFullName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [workerProfile, workerPrivate, user]);

  const currentStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName);

  const handleStateChange = (nextState: string) => {
    setStateName(nextState);
    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === nextState);
    const firstDist = st?.districts[0]?.name || '';
    setDistrictName(firstDist);
    const coords = getDistrictCoordinates(nextState, firstDist);
    setApproxLat(coords.lat);
    setApproxLng(coords.lng);
  };

  const handleDistrictChange = (nextDist: string) => {
    setDistrictName(nextDist);
    const coords = getDistrictCoordinates(stateName, nextDist);
    setApproxLat(coords.lat);
    setApproxLng(coords.lng);
  };

  const handleCaptureBrowserLocation = async () => {
    setGpsDetecting(true);
    setGpsStatusMsg('');
    try {
      const detected = await detectBestGpsLocation(lang);
      setApproxLat(detected.lat);
      setApproxLng(detected.lng);
      if (detected.state && INDIA_STATES_DISTRICTS.some((s) => s.name === detected.state)) {
        setStateName(detected.state);
      }
      if (detected.district) setDistrictName(detected.district);
      if (detected.cityOrVillage) setCityOrVillage(detected.cityOrVillage);
      setGpsStatusMsg(
        detected.isApproximate
          ? `Network estimate (${detected.accuracyMeters ? `~${Math.round(detected.accuracyMeters / 1000)} km` : 'coarse'}): ${detected.formattedAddress}. Tap "Pin on Map" if inaccurate.`
          : `Detected: ${detected.formattedAddress}`
      );
    } catch {
      setGpsStatusMsg('Unable to access device GPS. Please select State/District or Pin on Map.');
    } finally {
      setGpsDetecting(false);
    }
  };

  const addSkill = () => {
    const trimmed = newSkillText.trim();
    if (!trimmed) return;
    if (skills.length >= 15) return;
    if (!skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setNewSkillText('');
  };

  const failValidation = (msg: string, targetRef: React.RefObject<HTMLElement | null> = errorBoxRef) => {
    setErrorMsg(msg);
    window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 20);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    clearAuthError();

    if (!user) {
      failValidation(
        t.common.signInRequired || 'Please sign in with Google above or below before submitting registration.',
        authBannerRef
      );
      return;
    }
    if (!user.emailVerified) {
      failValidation(
        'Your Google account email is not verified. Please sign in with a verified Google account to register.',
        authBannerRef
      );
      return;
    }
    if (fullName.trim().length < 2) {
      failValidation('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      failValidation('Please enter a valid 10-digit Indian mobile number starting with 6–9.');
      return;
    }
    if (!mobileVerified) {
      failValidation(
        'Please complete mobile OTP verification before submitting. (If live SMS is unavailable, use authorized Demo Registration Mode for pre-launch testing.)'
      );
      return;
    }
    if (cityOrVillage.trim().length < 2) {
      failValidation('Please enter your city, town, or village (minimum 2 characters).');
      return;
    }
    const expNum = Number(experienceYears);
    if (!Number.isFinite(expNum) || expNum < 0 || expNum > 70) {
      failValidation('Experience years must be between 0 and 70.');
      return;
    }
    const wageNum = Number(expectedWage);
    if (!Number.isFinite(wageNum) || wageNum < 0 || wageNum > 500000) {
      failValidation('Expected wage must be between ₹0 and ₹5,00,000.');
      return;
    }
    if (!ageConfirmed) {
      failValidation('Age confirmation (18+) is mandatory to register.');
      return;
    }
    if (!privacyConsent) {
      failValidation('Please accept the privacy and worker guidelines consent.');
      return;
    }

    const langs = languagesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (langs.length === 0) langs.push('Hindi');

    const normalizedSkills = Array.from(new Set([primarySkill, ...skills])).slice(0, 15);
    const regId =
      workerProfile?.registrationId ||
      `RS-W-${user.uid.slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    setSaving(true);
    try {
      const existingPhotoId = workerProfile?.photoDocId || workerPrivate?.photoDocId || '';
      let resolvedPhotoDocId: string | undefined = existingPhotoId || undefined;

      if (selectedPhoto) {
        const photoId = buildWorkerPhotoDocId(user.uid);
        await uploadProfilePhotoRecord({
          photoId,
          ownerUid: user.uid,
          subjectId: user.uid,
          role: 'worker',
          mimeType: selectedPhoto.mimeType,
          sizeBytes: selectedPhoto.sizeBytes,
          photoData: selectedPhoto.photoData,
        });
        resolvedPhotoDocId = photoId;
      } else if (removePhoto && existingPhotoId) {
        await deleteProfilePhotoRecord(existingPhotoId);
        resolvedPhotoDocId = workerProfile ? '' : undefined;
      }

      await saveWorkerRegistration(
        user.uid,
        Boolean(workerProfile),
        {
          ownerUid: user.uid,
          registrationId: regId,
          displayName: fullName.trim().slice(0, 120),
          primarySkill,
          skills: normalizedSkills,
          experienceYears: Number(experienceYears) || 0,
          expectedWage: Number(expectedWage) || 0,
          wageUnit,
          preferredWorkType,
          availabilityStatus,
          state: stateName,
          district: districtName,
          cityOrVillage: cityOrVillage.trim().slice(0, 100),
          approxLat,
          approxLng,
          languagesKnown: langs,
          gender,
          education: education.trim().slice(0, 100),
          verificationStatus: workerProfile?.verificationStatus || 'pending',
          isWomenEnterprise: gender === 'female',
          ...(resolvedPhotoDocId !== undefined ? { photoDocId: resolvedPhotoDocId } : {}),
          completedJobsCount: workerProfile?.completedJobsCount || 0,
          ratingAvg: workerProfile?.ratingAvg || 0,
        },
        {
          ownerUid: user.uid,
          fullName: fullName.trim().slice(0, 120),
          mobile: mobile.trim(),
          mobileVerified,
          ...(verificationMethod ? { verificationMethod } : {}),
          ...(testPinHash ? { testPinHash } : {}),
          email: email.trim().slice(0, 200),
          ageConfirmed,
          preferredWorkLocation: preferredWorkLocation.trim().slice(0, 160),
          liveLocationConsent,
          privacyConsent,
          idVerificationStatus,
          certificateNotes: certificateNotes.trim().slice(0, 500),
          photoUrl: photoUrl.trim().slice(0, 1000),
          ...(resolvedPhotoDocId !== undefined ? { photoDocId: resolvedPhotoDocId } : {}),
        }
      );

      setSelectedPhoto(null);
      setRemovePhoto(false);
      await refreshUserProfiles();
      setSavedId(regId);
      setShowSuccessScreen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(formatUiError(err, 'Unable to save worker registration. Please review your details and try again.'));
      window.setTimeout(() => {
        errorBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 20);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#15803D] mb-1">{t.hero.campaignNote}</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
          {t.workerForm.title}
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base">{t.workerForm.subtitle}</p>
      </div>

      {!user && (
        <div
          ref={authBannerRef}
          className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B3B75]">
                {t.workerForm.authRequiredTitle}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{t.workerForm.authRequiredDesc}</p>
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.workerForm.signInBtn}
            </button>
          </div>
          {authError && (
            <p className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </p>
          )}
        </div>
      )}

      {savedId && showSuccessScreen && (
        <section className="mb-8 bg-white border-2 border-[#15803D] rounded-lg overflow-hidden shadow-sm">
          <div className="bg-[#15803D] text-white px-6 py-4 flex items-start gap-3">
            <CheckCircle2 className="w-7 h-7 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold">
                Welcome to ROJGAR SETU!
              </h2>
              <p className="text-sm sm:text-base text-emerald-50 font-semibold mt-0.5">
                आपका कामगार नोंदणी अर्ज यशस्वी झाला आहे.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <SecureAvatar
                  name={fullName || 'Worker'}
                  photoDocId={workerProfile?.photoDocId || workerPrivate?.photoDocId}
                  sizeClass="w-12 h-12"
                />
                <div>
                  <div className="text-slate-500 text-xs font-medium">
                    {lang === 'hi' ? 'कामगार नाम' : lang === 'mr' ? 'कामगार नाव' : 'Worker Name'}
                  </div>
                  <div className="font-bold text-[#0B3B75] mt-0.5">{fullName}</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-medium">{t.workerForm.uniqueIdLabel}</div>
                <div className="font-mono-tabular font-extrabold text-[#C25E00] mt-0.5">{savedId}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-medium">{t.dashboards.profileStatus}</div>
                <div className="font-bold text-[#15803D] uppercase mt-0.5">
                  {workerProfile?.verificationStatus || 'pending'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-medium">
                  {lang === 'hi' ? 'पंजीकृत कौशल' : lang === 'mr' ? 'नोंदवलेली कौशल्ये' : 'Registered Skills'}
                </div>
                <div className="font-semibold text-slate-800 mt-0.5">{skills.join(' · ')}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-slate-500 text-xs font-medium">
                  {lang === 'hi' ? 'स्थान' : lang === 'mr' ? 'ठिकाण' : 'Location'}
                </div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {cityOrVillage}, {districtName}, {stateName}
                </div>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm font-medium text-[#0B3B75]">
              रोजगार सेतु मोबाईलमध्ये इन्स्टॉल करा. तुमच्या कौशल्यानुसार नवीन कामाच्या संधींच्या सूचना थेट मोबाईलवर मिळवा.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PWAInstallButton variant="primary" />
              <NotificationOptInButton role="worker" />
              <button
                type="button"
                onClick={() => onNavigate('worker-dashboard')}
                className="px-5 py-2.5 rounded-md bg-[#15803D] text-white text-sm font-bold hover:bg-emerald-800 cursor-pointer min-h-[44px]"
              >
                Open Worker Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowSuccessScreen(false)}
                className="px-4 py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {lang === 'hi' ? 'प्रोफ़ाइल संपादित करें' : lang === 'mr' ? 'प्रोफाईल बदला' : 'Edit Profile'}
              </button>
            </div>
          </div>
        </section>
      )}

      {savedId && !showSuccessScreen && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-950">{t.workerForm.successMsg}</p>
              <p className="text-xs text-green-900 mt-0.5 font-mono-tabular">
                {t.workerForm.uniqueIdLabel}: <strong>{savedId}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => onNavigate('worker-dashboard')}
              className="px-4 py-2 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-green-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Worker Dashboard
            </button>
          </div>
        </div>
      )}

      {!showSuccessScreen && (
      <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.fullName} *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.emailOpt}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.workerForm.mobile} *
          </label>
          <OtpVerificationBox
            mobile={mobile}
            allowTestPinFallback={false}
            onOpenDemoMode={() => onNavigate('demo-testing')}
            onMobileChange={(v) => {
              setMobile(v);
              setMobileVerified(false);
              setVerificationMethod(undefined);
              setTestPinHash('');
            }}
            verified={mobileVerified}
            verifiedMethod={verificationMethod}
            onVerified={(m, meta) => {
              setMobile(m);
              setMobileVerified(true);
              setVerificationMethod(meta?.method);
              setTestPinHash(meta?.testPinHash || '');
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.state} *
            </label>
            <select
              value={stateName}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
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
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            >
              {currentStateObj?.districts.map((d) => (
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
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>
        </div>

        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-md p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-700">
              <span className="font-semibold">{t.workerForm.currentLocationOpt}:</span>{' '}
              <span className="font-mono-tabular">
                {approxLat.toFixed(4)}° N, {approxLng.toFixed(4)}° E
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={gpsDetecting}
                onClick={handleCaptureBrowserLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-100 cursor-pointer disabled:opacity-60"
              >
                <Compass className="w-3.5 h-3.5" />
                {gpsDetecting ? 'Detecting...' : t.workerForm.captureCoords}
              </button>
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-xs font-semibold text-[#0B3B75] hover:bg-blue-50 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                {lang === 'mr' ? 'नकाशावर पिन करा' : lang === 'hi' ? 'नक्शे पर पिन करें' : 'Pin on Map'}
              </button>
            </div>
          </div>
          {gpsStatusMsg && <p className="text-xs text-[#15803D] font-medium">{gpsStatusMsg}</p>}
          <LocationPinModal
            open={showPinModal}
            onClose={() => setShowPinModal(false)}
            initialLat={approxLat}
            initialLng={approxLng}
            initialLabel={cityOrVillage || districtName}
            onConfirmLocation={(loc) => {
              setApproxLat(loc.lat);
              setApproxLng(loc.lng);
              if (loc.state && INDIA_STATES_DISTRICTS.some((s) => s.name === loc.state)) {
                setStateName(loc.state);
              }
              if (loc.district) setDistrictName(loc.district);
              if (loc.cityOrVillage) setCityOrVillage(loc.cityOrVillage);
              setGpsStatusMsg(`Pinned exact location: ${loc.formattedAddress}`);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.genderOpt}
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.education}
            </label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="No formal schooling">No formal schooling</option>
              <option value="Primary / 8th Pass">Primary / 8th Pass</option>
              <option value="10th / Secondary">10th / Secondary</option>
              <option value="12th / Senior Secondary">12th / Senior Secondary</option>
              <option value="ITI / Vocational Certificate">ITI / Vocational Certificate</option>
              <option value="Diploma / Graduate">Diploma / Graduate</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <ProfilePhotoUploader
              existingPhotoDocId={workerProfile?.photoDocId || workerPrivate?.photoDocId}
              selectedPhoto={selectedPhoto}
              removedExisting={removePhoto}
              onSelectPhoto={(photo) => {
                setSelectedPhoto(photo);
                setRemovePhoto(false);
              }}
              onRemovePhoto={() => {
                setSelectedPhoto(null);
                setRemovePhoto(true);
              }}
              roleLabel={t.workerForm.photoOpt}
              privacyNote={
                lang === 'hi'
                  ? 'फ़ोटो वैकल्पिक है। प्रोफ़ाइल फ़ोटो केवल पंजीकृत ग्राहकों और एडमिन को काम की खोज में दिखाई देती है।'
                  : lang === 'mr'
                    ? 'फोटो ऐच्छिक आहे. तुमचा फोटो शोध परिणामांत आणि कामाच्या अर्जावर नोंदणीकृत ग्राहकांना दिसेल.'
                    : 'Optional. Your photo helps customers recognize you in worker search results and job applications.'
              }
            />
          </div>
        </div>

        {/* Multi-skill section */}
        <div className="space-y-4 pt-2 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.workerForm.primarySkill} *
              </label>
              <select
                value={primarySkill}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrimarySkill(val);
                  if (!skills.includes(val)) {
                    setSkills((prev) => [val, ...prev].slice(0, 15));
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                {EMPLOYMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.en}>
                    {lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.workerForm.additionalSkills}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={t.workerForm.addSkillPlaceholder}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-slate-300 text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.workerForm.addSkillBtn}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-medium text-slate-800"
              >
                {s}
                {s !== primarySkill && (
                  <button
                    type="button"
                    onClick={() => setSkills((prev) => prev.filter((item) => item !== s))}
                    className="text-slate-500 hover:text-red-700 cursor-pointer"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.experienceYears}
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.expectedWage}
            </label>
            <input
              type="number"
              min={0}
              max={500000}
              value={expectedWage}
              onChange={(e) => setExpectedWage(Number(e.target.value))}
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
              {t.workerForm.preferredWorkType}
            </label>
            <select
              value={preferredWorkType}
              onChange={(e) => setPreferredWorkType(e.target.value as WorkType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="daily_wage">Daily Wage</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.availability}
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value as typeof availabilityStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="available">Available Immediately</option>
              <option value="busy">Currently Engaged</option>
              <option value="offline">Not Looking Right Now</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.preferredWorkLocation}
            </label>
            <input
              type="text"
              value={preferredWorkLocation}
              onChange={(e) => setPreferredWorkLocation(e.target.value)}
              placeholder="Local block / District / Nearby city"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.languagesKnown}
            </label>
            <input
              type="text"
              value={languagesInput}
              onChange={(e) => setLanguagesInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.certificatesOpt}
            </label>
            <input
              type="text"
              value={certificateNotes}
              onChange={(e) => setCertificateNotes(e.target.value)}
              placeholder="ITI Trade / PMKVY / Driving Licence class..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.idStatus}
            </label>
            <select
              value={idVerificationStatus}
              onChange={(e) => setIdVerificationStatus(e.target.value as typeof idVerificationStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="not_submitted">Not Submitted (Optional)</option>
              <option value="voluntary_pending">Request Voluntary Verification Later</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 flex items-start gap-3 text-xs text-slate-700 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-[#0B3B75] shrink-0 mt-0.5" />
          <p>{t.workerForm.idNotice}</p>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-200">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.ageConfirm} *</span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.privacyConsent} *</span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={liveLocationConsent}
              onChange={(e) => setLiveLocationConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.liveLocConsent}</span>
          </label>
        </div>

        {errorMsg && (
          <div
            ref={errorBoxRef}
            role="alert"
            className="p-3.5 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!user && (
          <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
            <span>
              <strong>Sign-In Required:</strong> Sign in with Google before clicking Submit so your registration can be saved securely.
            </span>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-4 py-2 rounded-md bg-[#0B3B75] text-white font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.workerForm.signInBtn}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? t.common.loading : workerProfile ? t.workerForm.updateBtn : t.workerForm.submitBtn}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
