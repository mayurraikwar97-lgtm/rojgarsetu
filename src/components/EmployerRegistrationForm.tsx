import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  extractLastName,
  getWorkerVisibleCustomerName,
} from '../lib/customerPrivacy';
import { formatUiError, isAuthenticatedUser } from '../lib/firebase';
import { saveEmployerRegistration } from '../lib/firestoreService';
import {
  buildCustomerPhotoDocId,
  deleteProfilePhotoRecord,
  uploadProfilePhotoRecord,
} from '../lib/photoStorageService';
import type {
  CustomerGender,
  CustomerProfileVisibility,
  PageRoute,
  VerificationMethod,
} from '../types/domain';
import { NotificationOptInButton } from './NotificationOptInButton';
import { ProfilePhotoUploader, type SelectedProfilePhoto } from './ProfilePhotoUploader';
import { PWAInstallButton } from './PWAControls';
import { SecureAvatar } from './SecureAvatar';

interface EmployerRegistrationFormProps {
  onNavigate: (route: PageRoute) => void;
}

export const EmployerRegistrationForm: React.FC<EmployerRegistrationFormProps> = ({ onNavigate }) => {
  const { lang, t } = useLanguage();
  const { user, authError, clearAuthError, employerProfile, employerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();
  const authBannerRef = useRef<HTMLDivElement | null>(null);
  const errorBoxRef = useRef<HTMLDivElement | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<CustomerGender>('prefer_not_to_say');
  const [profileVisibility, setProfileVisibility] = useState<CustomerProfileVisibility>('standard');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | undefined>(undefined);
  const [testPinHash, setTestPinHash] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [email, setEmail] = useState('');
  const [stateName, setStateName] = useState('Chhattisgarh');
  const [districtName, setDistrictName] = useState('Raipur');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('MSME / Small Business');
  const [industryCategory, setIndustryCategory] = useState('Construction & Infrastructure');
  const [gstNumber, setGstNumber] = useState('');
  const [establishmentDetails, setEstablishmentDetails] = useState('');
  const [workforceNotes, setWorkforceNotes] = useState('');
  const [requiredCategories, setRequiredCategories] = useState<string[]>([EMPLOYMENT_CATEGORIES[0].en]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedId, setSavedId] = useState('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  useEffect(() => {
    if (employerProfile && employerPrivate) {
      setBusinessName(employerProfile.businessName);
      setContactPerson(employerPrivate.contactPerson);
      const savedGender = employerProfile.gender || employerPrivate.gender || 'prefer_not_to_say';
      setGender(savedGender);
      const savedLast =
        employerProfile.lastName ||
        employerPrivate.lastName ||
        extractLastName(employerPrivate.contactPerson);
      setLastName(savedLast === 'Customer' ? '' : savedLast);
      setProfileVisibility(
        savedGender === 'female'
          ? employerProfile.profileVisibility === 'private_strict'
            ? 'private_strict'
            : 'last_name_only'
          : employerProfile.profileVisibility || employerPrivate.profileVisibility || 'standard'
      );
      setMobile(employerPrivate.mobile);
      setMobileVerified(employerPrivate.mobileVerified);
      setVerificationMethod(employerPrivate.verificationMethod);
      setTestPinHash(employerPrivate.testPinHash || '');
      setEmail(employerPrivate.email);
      setStateName(employerProfile.state);
      setDistrictName(employerProfile.district);
      setBusinessAddress(employerPrivate.businessAddress);
      setBusinessType(employerProfile.businessType);
      setIndustryCategory(employerProfile.industryCategory);
      setGstNumber(employerPrivate.gstNumber || '');
      setEstablishmentDetails(employerPrivate.establishmentDetails || '');
      setWorkforceNotes(employerPrivate.workforceNotes || '');
      setRequiredCategories(employerProfile.requiredCategories || []);
      setSavedId(employerProfile.registrationId);
    } else if (user) {
      const display = user.displayName || '';
      setContactPerson(display);
      const derivedLast = extractLastName(display);
      if (derivedLast && derivedLast !== 'Customer') {
        setLastName(derivedLast);
      }
      setEmail(user.email || '');
    }
  }, [employerProfile, employerPrivate, user]);

  const currentStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName);

  const toggleCategory = (catEn: string) => {
    setRequiredCategories((prev) => {
      if (prev.includes(catEn)) {
        return prev.length > 1 ? prev.filter((c) => c !== catEn) : prev;
      }
      if (prev.length >= 15) return prev;
      return [...prev, catEn];
    });
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
        t.common.signInRequired || 'Please sign in with Google before submitting customer registration.',
        authBannerRef
      );
      return;
    }
    if (!isAuthenticatedUser(user)) {
      failValidation(
        'Please sign in with Google to complete customer registration.',
        authBannerRef
      );
      return;
    }
    if (businessName.trim().length < 2 || contactPerson.trim().length < 2) {
      failValidation('Please fill out business / hirer name and contact person (minimum 2 characters each).');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      failValidation('Please enter a valid 10-digit Indian mobile number starting with 6–9.');
      return;
    }
    if (email.trim().length < 3 || !email.includes('@')) {
      failValidation('Please enter a valid email address.');
      return;
    }
    if (businessAddress.trim().length < 4) {
      failValidation('Please enter a valid worksite or business address (minimum 4 characters).');
      return;
    }
    if (requiredCategories.length === 0) {
      failValidation('Please select at least one worker category you need to hire.');
      return;
    }

    const regId =
      employerProfile?.registrationId ||
      `RS-E-${user.uid.slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    setSaving(true);
    try {
      const existingPhotoId = employerPrivate?.photoDocId || '';
      let resolvedPhotoDocId: string | undefined = existingPhotoId || undefined;

      if (selectedPhoto) {
        const photoId = buildCustomerPhotoDocId(user.uid);
        await uploadProfilePhotoRecord({
          photoId,
          ownerUid: user.uid,
          subjectId: user.uid,
          role: 'customer',
          mimeType: selectedPhoto.mimeType,
          sizeBytes: selectedPhoto.sizeBytes,
          photoData: selectedPhoto.photoData,
        });
        resolvedPhotoDocId = photoId;
      } else if (removePhoto && existingPhotoId) {
        await deleteProfilePhotoRecord(existingPhotoId);
        resolvedPhotoDocId = employerProfile ? '' : undefined;
      }

      const cleanFull = contactPerson.trim().slice(0, 120);
      const resolvedLastName =
        lastName.trim().slice(0, 60) || extractLastName(cleanFull);
      const resolvedFirstName = cleanFull.split(/\s+/)[0]?.slice(0, 60) || '';
      const resolvedVisibility: CustomerProfileVisibility =
        gender === 'female' && profileVisibility === 'standard'
          ? 'last_name_only'
          : profileVisibility;

      await saveEmployerRegistration(
        user.uid,
        Boolean(employerProfile),
        {
          ownerUid: user.uid,
          registrationId: regId,
          businessName: businessName.trim().slice(0, 160),
          businessType,
          industryCategory,
          state: stateName,
          district: districtName,
          requiredCategories: requiredCategories.slice(0, 15),
          verificationStatus: employerProfile?.verificationStatus || 'pending',
          gender,
          lastName: resolvedLastName === 'Customer' ? '' : resolvedLastName,
          profileVisibility: resolvedVisibility,
          hidePhotoUntilConfirm: gender === 'female' || resolvedVisibility === 'private_strict',
          maskedCallingOnly: true,
        },
        {
          ownerUid: user.uid,
          contactPerson: cleanFull,
          firstName: resolvedFirstName,
          lastName: resolvedLastName === 'Customer' ? '' : resolvedLastName,
          gender,
          profileVisibility: resolvedVisibility,
          mobile: mobile.trim(),
          mobileVerified,
          ...(verificationMethod ? { verificationMethod } : {}),
          ...(testPinHash ? { testPinHash } : {}),
          email: email.trim().slice(0, 200),
          businessAddress: businessAddress.trim().slice(0, 300),
          gstNumber: gstNumber.trim().slice(0, 30),
          establishmentDetails: establishmentDetails.trim().slice(0, 600),
          workforceNotes: workforceNotes.trim().slice(0, 600),
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
      setErrorMsg(
        formatUiError(
          err,
          lang === 'mr'
            ? 'ग्राहक / नियोक्ता नोंदणी जतन करता आली नाही. कृपया तपशील तपासून पुन्हा प्रयत्न करा.'
            : lang === 'hi'
              ? 'ग्राहक / नियोक्ता पंजीकरण सहेजा नहीं जा सका। कृपया विवरण जाँचकर पुनः प्रयास करें।'
              : 'Failed to save customer / employer registration. Please review your details and retry.',
          lang
        )
      );
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
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
          {t.employerForm.title}
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base">{t.employerForm.subtitle}</p>
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
              <p className="text-sm text-slate-600 mt-1">{t.common.signInRequired}</p>
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
        <section className="mb-8 bg-white border-2 border-[#0B3B75] rounded-lg overflow-hidden shadow-sm">
          <div className="bg-[#0B3B75] text-white px-6 py-4 flex items-start gap-3 border-b-2 border-[#E06D1B]">
            <CheckCircle2 className="w-7 h-7 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold">
                Welcome to ROJGAR SETU!
              </h2>
              <p className="text-sm sm:text-base text-blue-100 font-semibold mt-0.5">
                तुम्ही आता कामगार शोधू शकता आणि नवीन कामाची मागणी नोंदवू शकता.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <SecureAvatar
                  name={contactPerson || businessName || 'Customer'}
                  photoDocId={employerPrivate?.photoDocId}
                  sizeClass="w-12 h-12"
                />
                <div>
                  <div className="text-slate-500 text-xs font-medium">Customer ID</div>
                  <div className="font-mono-tabular font-extrabold text-[#C25E00] mt-0.5">{savedId}</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-medium">{t.employerForm.businessName}</div>
                <div className="font-bold text-[#0B3B75] mt-0.5">{businessName}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-medium">Location</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {districtName}, {stateName}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PWAInstallButton variant="primary" />
              <NotificationOptInButton role="employer" />
              <button
                type="button"
                onClick={() => onNavigate('post-job')}
                className="px-5 py-2.5 rounded-md bg-[#15803D] text-white text-sm font-bold hover:bg-emerald-800 cursor-pointer min-h-[44px]"
              >
                Post a Job
              </button>
              <button
                type="button"
                onClick={() => onNavigate('employer-dashboard')}
                className="px-5 py-2.5 rounded-md border border-[#0B3B75] text-[#0B3B75] text-sm font-bold hover:bg-blue-50 cursor-pointer min-h-[44px]"
              >
                Customer Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowSuccessScreen(false)}
                className="px-4 py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Edit Details
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
              <p className="text-sm font-semibold text-green-950">{t.employerForm.successMsg}</p>
              <p className="text-xs text-green-900 mt-0.5 font-mono-tabular">
                Customer ID: <strong>{savedId}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => onNavigate('post-job')}
              className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              Post a Job
            </button>
            <button
              type="button"
              onClick={() => onNavigate('employer-dashboard')}
              className="px-4 py-2 rounded-md border border-green-700 text-green-900 text-xs font-semibold hover:bg-green-100 whitespace-nowrap cursor-pointer"
            >
              Customer Dashboard
            </button>
          </div>
        </div>
      )}

      {!showSuccessScreen && (
      <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.businessName} *
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.contactPerson} *
            </label>
            <input
              type="text"
              required
              value={contactPerson}
              onChange={(e) => {
                const next = e.target.value;
                setContactPerson(next);
                if (!lastName.trim()) {
                  const derived = extractLastName(next);
                  if (derived && derived !== 'Customer') {
                    setLastName(derived);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Gender, Last Name & Privacy Protection Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#0B3B75]">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" />
              <span>
                {lang === 'mr'
                  ? 'ग्राहक गोपनीयता व महिला सुरक्षा कवच'
                  : lang === 'hi'
                  ? 'ग्राहक गोपनीयता व महिला सुरक्षा कवच'
                  : 'Customer Privacy & Safety Protection'}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              {lang === 'mr'
                ? 'कामगाराला दिसणारे नाव:'
                : lang === 'hi'
                ? 'कामगार को दिखने वाला नाम:'
                : 'Worker sees:'}{' '}
              <strong className="text-[#0B3B75]">
                {getWorkerVisibleCustomerName({
                  gender,
                  profileVisibility:
                    gender === 'female' && profileVisibility === 'standard'
                      ? 'last_name_only'
                      : profileVisibility,
                  lastName: lastName.trim() || undefined,
                  fullName: contactPerson,
                  businessName,
                  viewerRole: 'worker',
                })}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'mr' ? 'लिंग (Gender) *' : lang === 'hi' ? 'लिंग (Gender) *' : 'Gender *'}
              </label>
              <select
                value={gender}
                onChange={(e) => {
                  const next = e.target.value as CustomerGender;
                  setGender(next);
                  if (next === 'female' && profileVisibility === 'standard') {
                    setProfileVisibility('last_name_only');
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="female">
                  {lang === 'mr' ? 'महिला (फक्त आडनाव सुरक्षा)' : lang === 'hi' ? 'महिला (केवल उपनाम सुरक्षा)' : 'Female (Last Name Only Privacy)'}
                </option>
                <option value="male">{lang === 'mr' ? 'पुरुष' : lang === 'hi' ? 'पुरुष' : 'Male'}</option>
                <option value="other">{lang === 'mr' ? 'इतर' : lang === 'hi' ? 'अन्य' : 'Other'}</option>
                <option value="prefer_not_to_say">
                  {lang === 'mr' ? 'सांगू इच्छित नाही' : lang === 'hi' ? 'बताना नहीं चाहते' : 'Prefer not to say'}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'mr' ? 'आडनाव (Last Name)' : lang === 'hi' ? 'उपनाम (Last Name)' : 'Last Name / Surname'}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={lang === 'mr' ? 'उदा. देशमुख, कुलकर्णी' : lang === 'hi' ? 'जैसे: देशमुख, शर्मा' : 'e.g., Deshmukh, Sharma'}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'mr' ? 'प्रोफाईल दृश्यता' : lang === 'hi' ? 'प्रोफ़ाइल दृश्यता' : 'Profile Visibility'}
              </label>
              <select
                value={gender === 'female' && profileVisibility === 'standard' ? 'last_name_only' : profileVisibility}
                onChange={(e) => setProfileVisibility(e.target.value as CustomerProfileVisibility)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="last_name_only">
                  {lang === 'mr' ? 'फक्त आडनाव (Last Name Only)' : lang === 'hi' ? 'केवल उपनाम (Last Name Only)' : 'Last Name Only'}
                </option>
                <option value="private_strict">
                  {lang === 'mr' ? 'उच्च गोपनीयता (आडनाव + फोटो लपवा)' : lang === 'hi' ? 'उच्च गोपनीयता (उपनाम + फ़ोटो छुपाएँ)' : 'Strict Privacy (Last Name + Hide Photo)'}
                </option>
                {gender !== 'female' && (
                  <option value="standard">
                    {lang === 'mr' ? 'सामान्य (पूर्ण / व्यवसायाचे नाव)' : lang === 'hi' ? 'सामान्य (पूरा / व्यापार नाम)' : 'Standard (Display / Business Name)'}
                  </option>
                )}
              </select>
            </div>
          </div>

          {gender === 'female' && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-950 flex items-start gap-2">
              <Lock className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>
                {lang === 'mr'
                  ? 'महिला ग्राहक सुरक्षा कवच सक्रिय: कामगारांना फक्त तुमचे आडनाव दिसेल, वैयक्तिक मोबाईल नंबर लपवला जाईल (इन-ॲप मास्क्ड कॉल उपलब्ध), आणि अचूक पत्ता ऑर्डर निश्चित झाल्यावरच संबंधित कामगाराला दिसेल.'
                  : lang === 'hi'
                  ? 'महिला ग्राहक सुरक्षा कवच सक्रिय: कामगारों को केवल आपका उपनाम दिखेगा, व्यक्तिगत मोबाइल नंबर छुपा रहेगा (इन-ऐप मास्क्ड कॉल), और सटीक पता केवल ऑर्डर कन्फर्म होने पर संबंधित कामगार को ही दिखेगा।'
                  : 'Female Customer Safety Shield Active: Workers only ever see your Last Name (never your full name), your personal mobile stays hidden with In-App Masked Calling, and your exact address is revealed only to the assigned worker after order confirmation.'}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.mobile} *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-tabular font-semibold text-slate-500">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={mobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobile(digits);
                  setMobileVerified(false);
                  setVerificationMethod(undefined);
                  setTestPinHash('');
                }}
                placeholder="98XXXXXXXX"
                className="w-full pl-11 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:border-[#0B3B75] focus:outline-none font-mono-tabular"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {lang === 'mr'
                ? 'ओटीपी आवश्यक नाही — गुगल खात्याने थेट नोंदणी पूर्ण होते.'
                : lang === 'hi'
                ? 'OTP आवश्यक नहीं है — गूगल खाते से सीधे पंजीकरण पूरा होता है।'
                : 'No OTP required — verified directly with your Google Sign-In.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.email} *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <ProfilePhotoUploader
          existingPhotoDocId={employerPrivate?.photoDocId}
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
          roleLabel={
            lang === 'hi'
              ? 'ग्राहक / नियोक्ता प्रोफ़ाइल फ़ोटो (वैकल्पिक)'
              : lang === 'mr'
                ? 'ग्राहक / नियोक्ता प्रोफाइल फोटो (ऐच्छिक)'
                : 'Customer / Employer Profile Photo (Optional)'
          }
          privacyNote={
            lang === 'hi'
              ? 'गोपनीयता सुरक्षा: आपकी फ़ोटो सार्वजनिक रूप से नहीं दिखती। यह केवल आपकी प्रोफ़ाइल, एडमिन पैनल और जॉब स्वीकार होने के बाद संबंधित कामगार को ही दिखाई जाती है।'
              : lang === 'mr'
                ? 'गोपनीयता सुरक्षा: तुमचा फोटो सार्वजनिक दिसत नाही. तो फक्त तुमच्या प्रोफाइलवर, अ‍ॅडमिनकडे आणि काम स्वीकारल्यानंतर संबंधित कामगारालाच दिसेल.'
                : 'Privacy protected: Your photo is never public. It is shown only on your profile, to Admin, and to a worker strictly after job acceptance.'
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.state} *
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
              {t.employerForm.district} *
            </label>
            <select
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {currentStateObj?.districts.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.employerForm.businessAddress} *
          </label>
          <input
            type="text"
            required
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.businessType}
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="MSME / Small Business">MSME / Small Business</option>
              <option value="Factory / Manufacturing Unit">Factory / Manufacturing Unit</option>
              <option value="Contractor / Infrastructure">Contractor / Infrastructure</option>
              <option value="Retail Shop / Commercial">Retail Shop / Commercial</option>
              <option value="Institution / School / Hospital">Institution / School / Hospital</option>
              <option value="Household / Individual Employer">Household / Individual Employer</option>
              <option value="Agricultural Enterprise">Agricultural Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.industryCategory}
            </label>
            <input
              type="text"
              value={industryCategory}
              onChange={(e) => setIndustryCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.gstOpt}
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.establishmentDetails}
            </label>
            <textarea
              rows={2}
              value={establishmentDetails}
              onChange={(e) => setEstablishmentDetails(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.workforceNotes}
            </label>
            <textarea
              rows={2}
              value={workforceNotes}
              onChange={(e) => setWorkforceNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {t.employerForm.requiredCategories} (Select up to 15)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50/50">
            {EMPLOYMENT_CATEGORIES.map((c) => {
              const label = lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en;
              const checked = requiredCategories.includes(c.en);
              return (
                <label key={c.id} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.en)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
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
              <strong>Sign-In Required:</strong> Sign in with Google before clicking Submit so your Customer registration can be saved securely.
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

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? t.common.loading : employerProfile ? (lang === 'hi' ? 'प्रोफ़ाइल अपडेट करें' : lang === 'mr' ? 'माहिती अपडेट करा' : 'Update Customer Profile') : t.employerForm.submitBtn}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
