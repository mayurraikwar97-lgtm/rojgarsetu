import React, { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, Loader2, Lock, PhoneOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  extractLastName,
  getWorkerVisibleCustomerName,
} from '../lib/customerPrivacy';
import { updateCustomerPrivacySettings } from '../lib/firestoreService';
import type {
  CustomerGender,
  CustomerProfileVisibility,
  Language,
} from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const CustomerPrivacyControls: React.FC = () => {
  const { lang } = useLanguage();
  const { user, employerProfile, employerPrivate, refreshUserProfiles } = useAuth();

  const [gender, setGender] = useState<CustomerGender>(
    employerProfile?.gender || employerPrivate?.gender || 'prefer_not_to_say'
  );
  const [lastName, setLastName] = useState(
    employerProfile?.lastName ||
      employerPrivate?.lastName ||
      extractLastName(employerPrivate?.contactPerson || user?.displayName || '')
  );
  const [profileVisibility, setProfileVisibility] = useState<CustomerProfileVisibility>(
    employerProfile?.profileVisibility ||
      employerPrivate?.profileVisibility ||
      ((employerProfile?.gender || employerPrivate?.gender) === 'female' ? 'last_name_only' : 'standard')
  );
  const [hidePhotoUntilConfirm, setHidePhotoUntilConfirm] = useState<boolean>(
    employerProfile?.hidePhotoUntilConfirm ?? true
  );
  const [maskedCallingOnly, setMaskedCallingOnly] = useState<boolean>(
    employerProfile?.maskedCallingOnly ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!employerProfile && !employerPrivate) return;
    const g = employerProfile?.gender || employerPrivate?.gender || 'prefer_not_to_say';
    setGender(g);
    const derivedLast =
      employerProfile?.lastName ||
      employerPrivate?.lastName ||
      extractLastName(employerPrivate?.contactPerson || user?.displayName || '');
    if (derivedLast && derivedLast !== 'Customer') {
      setLastName(derivedLast);
    }
    setProfileVisibility(
      g === 'female'
        ? employerProfile?.profileVisibility === 'private_strict'
          ? 'private_strict'
          : 'last_name_only'
        : employerProfile?.profileVisibility || employerPrivate?.profileVisibility || 'standard'
    );
    setHidePhotoUntilConfirm(employerProfile?.hidePhotoUntilConfirm ?? true);
    setMaskedCallingOnly(employerProfile?.maskedCallingOnly ?? true);
  }, [employerProfile, employerPrivate, user?.displayName]);

  if (!user || !employerProfile) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-[#0B3B75] font-display font-extrabold text-base">
          <ShieldCheck className="w-5 h-5 text-[#15803D]" />
          <span>{tr(lang, 'Customer Privacy & Safety Shield', 'ग्राहक गोपनीयता व सुरक्षा कवच', 'ग्राहक गोपनीयता व सुरक्षा कवच')}</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {tr(
            lang,
            'Complete your Customer/Employer profile registration to customize Gender Privacy Shield (Last Name only for female customers), profile visibility, and masked calling preferences.',
            'महिला ग्राहक गोपनीयता (केवल उपनाम), प्रोफ़ाइल दृश्यता और मास्क्ड कॉलिंग सेटिंग्स के लिए कृपया ग्राहक पंजीकरण पूरा करें।',
            'महिला ग्राहक गोपनीयता (फक्त आडनाव), प्रोफाईल दृश्यता आणि मास्क्ड कॉलिंग नियंत्रणासाठी कृपया ग्राहक नोंदणी पूर्ण करा.'
          )}
        </p>
      </div>
    );
  }

  const isFemale = gender === 'female';
  const effectiveVisibility: CustomerProfileVisibility =
    isFemale && profileVisibility === 'standard' ? 'last_name_only' : profileVisibility;

  const previewWorkerVisibleName = getWorkerVisibleCustomerName({
    gender,
    profileVisibility: effectiveVisibility,
    lastName: lastName.trim() || undefined,
    fullName: employerPrivate?.contactPerson || employerProfile.businessName,
    businessName: employerProfile.businessName,
    viewerRole: 'worker',
  });

  const handleGenderChange = (nextGender: CustomerGender) => {
    setGender(nextGender);
    if (nextGender === 'female' && profileVisibility === 'standard') {
      setProfileVisibility('last_name_only');
      setHidePhotoUntilConfirm(true);
      setMaskedCallingOnly(true);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      const cleanLast = lastName.trim().slice(0, 60);
      await updateCustomerPrivacySettings(user.uid, {
        gender,
        lastName: cleanLast || undefined,
        profileVisibility: effectiveVisibility,
        hidePhotoUntilConfirm: isFemale ? true : hidePhotoUntilConfirm,
        maskedCallingOnly: isFemale ? true : maskedCallingOnly,
      });
      await refreshUserProfiles();
      setSavedMsg(
        tr(
          lang,
          'Privacy & visibility settings saved. Workers will immediately see your updated privacy preferences.',
          'गोपनीयता सेटिंग्स सुरक्षित हो गईं। कामगारों को तुरंत आपकी अपडेट की गई गोपनीयता दिखेगी।',
          'गोपनीयता व दृश्यता सेटिंग्ज जतन झाल्या. कामगारांना तात्काळ तुमची निवडलेली गोपनीयता लागू होईल.'
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#15803D]">
            <ShieldCheck className="w-4 h-4" />
            <span>{tr(lang, 'Profile Visibility & Privacy Control', 'प्रोफ़ाइल दृश्यता व गोपनीयता नियंत्रण', 'प्रोफाईल दृश्यता व गोपनीयता नियंत्रण')}</span>
          </div>
          <h3 className="font-display text-lg font-extrabold text-[#0B3B75]">
            {tr(lang, 'Control What Workers See', 'तय करें कामगार को क्या दिखे', 'कामगाराला काय दिसावे हे तुम्ही ठरवा')}
          </h3>
        </div>

        {/* Live Preview Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr(lang, 'Name Shown to Workers', 'कामगार को दिखने वाला नाम', 'कामगाराला दिसणारे नाव')}
          </div>
          <div className="font-display text-sm font-extrabold text-[#0B3B75] flex items-center gap-1.5 mt-0.5">
            {isFemale && <Lock className="w-3.5 h-3.5 text-[#15803D]" />}
            <span>{previewWorkerVisibleName}</span>
          </div>
        </div>
      </div>

      {/* Female Privacy Shield Banner */}
      {isFemale && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950 space-y-1">
          <div className="font-extrabold flex items-center gap-1.5 text-[#15803D]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {tr(
                lang,
                'Female Customer Safety Shield Automatically Active',
                'महिला ग्राहक सुरक्षा कवच स्वतः सक्रिय है',
                'महिला ग्राहक सुरक्षा कवच आपोआप सक्रिय आहे'
              )}
            </span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-emerald-900">
            <li>
              {tr(
                lang,
                'Workers only ever see your Last Name — your full name is never shown.',
                'कामगारों को केवल आपका उपनाम (Last Name) दिखता है — पूरा नाम कभी नहीं दिखाया जाता।',
                'कामगारांना फक्त तुमचे आडनाव (Last Name) दिसते — पूर्ण नाव कधीही दाखवले जात नाही.'
              )}
            </li>
            <li>
              {tr(
                lang,
                'Personal mobile number is hidden; communication uses In-App Masked Calling & Chat.',
                'व्यक्तिगत मोबाइल नंबर गोपनीय रहता है; इन-ऐप मास्क्ड कॉल व चैट उपलब्ध है।',
                'वैयक्तिक मोबाईल नंबर गोपनीय असतो; संवादासाठी इन-ॲप मास्क्ड कॉल व चॅट उपलब्ध आहे.'
              )}
            </li>
            <li>
              {tr(
                lang,
                'Only approximate area is shown before confirmation; exact address unlocks only for your confirmed worker.',
                'पुष्टि से पहले केवल अनुमानित क्षेत्र दिखता है; सटीक पता केवल कन्फर्म कामगार को दिखता है।',
                'ऑर्डर निश्चित होईपर्यंत फक्त अंदाजे परिसर दिसतो; अचूक पत्ता फक्त निश्चित केलेल्या कामगारालाच दिसतो.'
              )}
            </li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#0B3B75]">
            {tr(lang, 'Gender (for Privacy Protection)', 'लिंग (गोपनीयता सुरक्षा हेतु)', 'लिंग (गोपनीयता संरक्षणासाठी)')}
          </label>
          <select
            value={gender}
            onChange={(e) => handleGenderChange(e.target.value as CustomerGender)}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
          >
            <option value="female">{tr(lang, 'Female (Last Name Only Shield)', 'महिला (केवल उपनाम सुरक्षा)', 'महिला (फक्त आडनाव सुरक्षा)')}</option>
            <option value="male">{tr(lang, 'Male', 'पुरुष', 'पुरुष')}</option>
            <option value="other">{tr(lang, 'Other', 'अन्य', 'इतर')}</option>
            <option value="prefer_not_to_say">{tr(lang, 'Prefer not to say', 'बताना नहीं चाहते', 'सांगू इच्छित नाही')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#0B3B75]">
            {tr(lang, 'Last Name / Surname (Shown When Masked)', 'उपनाम / सरनेम', 'आडनाव (Last Name)')}
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={60}
            placeholder={tr(lang, 'e.g., Kulkarni, Sharma, Patil', 'जैसे: कुलकर्णी, शर्मा, पाटिल', 'उदा. कुलकर्णी, शर्मा, पाटील')}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
          />
        </div>
      </div>

      {/* Visibility Options */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-[#0B3B75]">
          {tr(lang, 'Profile Visibility Level', 'प्रोफ़ाइल दृश्यता स्तर', 'प्रोफाईल दृश्यता स्तर')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              id: 'last_name_only' as CustomerProfileVisibility,
              label: tr(lang, 'Last Name Only', 'केवल उपनाम', 'फक्त आडनाव'),
              desc: tr(lang, 'Workers see surname only', 'कामगार को केवल सरनेम दिखे', 'कामगाराला फक्त आडनाव दिसेल'),
              disabled: false,
            },
            {
              id: 'private_strict' as CustomerProfileVisibility,
              label: tr(lang, 'Strict Privacy', 'अधिकतम गोपनीयता', 'उच्च गोपनीयता'),
              desc: tr(lang, 'Last name + hide photo', 'उपनाम + फ़ोटो गोपनीय', 'आडनाव + फोटो गोपनीय'),
              disabled: false,
            },
            {
              id: 'standard' as CustomerProfileVisibility,
              label: tr(lang, 'Standard Name', 'सामान्य नाम', 'सामान्य नाव'),
              desc: isFemale
                ? tr(lang, 'Disabled for Female Safety', 'महिला सुरक्षा हेतु बंद', 'महिला सुरक्षेसाठी बंद')
                : tr(lang, 'Show display/business name', 'व्यापार/पूरा नाम दिखाएँ', 'व्यवसाय/पूर्ण नाव दाखवा'),
              disabled: isFemale,
            },
          ].map((opt) => {
            const active = effectiveVisibility === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={opt.disabled}
                onClick={() => setProfileVisibility(opt.id)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  opt.disabled
                    ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    : active
                    ? 'bg-blue-50/70 border-[#0B3B75] ring-1 ring-[#0B3B75]/20 cursor-pointer'
                    : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <div className="text-xs font-extrabold text-[#0B3B75]">{opt.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Granular Privacy Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isFemale ? true : hidePhotoUntilConfirm}
            disabled={isFemale}
            onChange={(e) => setHidePhotoUntilConfirm(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#0B3B75]"
          />
          <div className="text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <EyeOff className="w-3.5 h-3.5 text-[#0B3B75]" />
              <span>{tr(lang, 'Keep Profile Photo Private', 'प्रोफ़ाइल फ़ोटो गोपनीय रखें', 'प्रोफाईल फोटो गोपनीय ठेवा')}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {tr(lang, 'Never shown publicly to browsing workers.', 'अन्य कामगारों को सार्वजनिक रूप से नहीं दिखेगा।', 'इतर कामगारांना सार्वजनिकरित्या दिसणार नाही.')}
            </div>
          </div>
        </label>

        <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isFemale ? true : maskedCallingOnly}
            disabled={isFemale}
            onChange={(e) => setMaskedCallingOnly(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#15803D]"
          />
          <div className="text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <PhoneOff className="w-3.5 h-3.5 text-[#15803D]" />
              <span>{tr(lang, 'In-App / Masked Calling Only', 'केवल इन-ऐप / मास्क्ड कॉलिंग', 'फक्त इन-ॲप / मास्क्ड कॉलिंग')}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {tr(lang, 'Personal mobile number stays hidden from workers.', 'व्यक्तिगत मोबाइल नंबर हमेशा गोपनीय रहता है।', 'वैयक्तिक मोबाईल नंबर कामगारांपासून गोपनीय राहतो.')}
            </div>
          </div>
        </label>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-900 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="h-10 px-5 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{tr(lang, 'Save Privacy Settings', 'गोपनीयता सेटिंग्स सेव करें', 'गोपनीयता सेटिंग्ज जतन करा')}</span>
        </button>
      </div>
    </div>
  );
};
