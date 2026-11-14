import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { saveEmployerRegistration } from '../lib/firestoreService';
import type { PageRoute } from '../types/domain';
import { OtpVerificationBox } from './OtpVerificationBox';

interface EmployerRegistrationFormProps {
  onNavigate: (route: PageRoute) => void;
}

export const EmployerRegistrationForm: React.FC<EmployerRegistrationFormProps> = ({ onNavigate }) => {
  const { lang, t } = useLanguage();
  const { user, employerProfile, employerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
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

  useEffect(() => {
    if (employerProfile && employerPrivate) {
      setBusinessName(employerProfile.businessName);
      setContactPerson(employerPrivate.contactPerson);
      setMobile(employerPrivate.mobile);
      setMobileVerified(employerPrivate.mobileVerified);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      setErrorMsg(t.common.signInRequired);
      return;
    }
    if (businessName.trim().length < 2 || contactPerson.trim().length < 2) {
      setErrorMsg('Please fill out business name and contact person.');
      return;
    }
    if (!mobileVerified) {
      setErrorMsg('Please complete mobile OTP verification.');
      return;
    }
    if (businessAddress.trim().length < 4) {
      setErrorMsg('Please enter a valid worksite or business address.');
      return;
    }

    const regId =
      employerProfile?.registrationId ||
      `RS-E-${user.uid.slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    setSaving(true);
    try {
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
          email: email.trim().slice(0, 200),
          businessAddress: businessAddress.trim().slice(0, 300),
          gstNumber: gstNumber.trim().slice(0, 30),
          establishmentDetails: establishmentDetails.trim().slice(0, 600),
          workforceNotes: workforceNotes.trim().slice(0, 600),
        }
      );

      await refreshUserProfiles();
      setSavedId(regId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save employer registration.');
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
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      )}

      {savedId && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-950">{t.employerForm.successMsg}</p>
              <p className="text-xs text-green-900 mt-0.5 font-mono-tabular">
                Registration ID: <strong>{savedId}</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNavigate('post-job')}
              className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              {t.jobs.postTitle}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('employer-dashboard')}
              className="px-4 py-2 rounded-md border border-green-700 text-green-900 text-xs font-semibold hover:bg-green-100 whitespace-nowrap cursor-pointer"
            >
              {t.nav.employerDashboard}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
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
              onMobileChange={(v) => {
                setMobile(v);
                setMobileVerified(false);
              }}
              verified={mobileVerified}
              onVerified={(m) => {
                setMobile(m);
                setMobileVerified(true);
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
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || !user}
            className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? t.common.loading : t.employerForm.submitBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
