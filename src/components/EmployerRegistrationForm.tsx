import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import { saveEmployerRegistration } from '../lib/firestoreService';
import {
  buildCustomerPhotoDocId,
  deleteProfilePhotoRecord,
  uploadProfilePhotoRecord,
} from '../lib/photoStorageService';
import type { PageRoute, VerificationMethod } from '../types/domain';
import { NotificationOptInButton } from './NotificationOptInButton';
import { OtpVerificationBox } from './OtpVerificationBox';
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
      setContactPerson(user.displayName || '');
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
    if (!user.emailVerified) {
      failValidation(
        'Your Google account email is not verified. Please sign in with a verified Google account to register.',
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
    if (!mobileVerified) {
      failValidation(
        'Please complete mobile OTP verification before submitting. (If live SMS is unavailable, use authorized Demo Registration Mode for pre-launch testing.)'
      );
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
        },
        {
          ownerUid: user.uid,
          contactPerson: contactPerson.trim().slice(0, 120),
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
      setErrorMsg(formatUiError(err, 'Failed to save customer / employer registration. Please review your details and retry.'));
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
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.employerForm.mobile} *
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
