import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { submitGrievanceReport, submitPartnershipEnquiry } from '../lib/firestoreService';
import type { GrievanceReport, Language } from '../types/domain';
import { RojgarSetuLogo } from './RojgarSetuLogo';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

/* ============================================================================
   1. ABOUT US VIEW
============================================================================ */

export const AboutUsView: React.FC = () => {
  const { lang, t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-5">
        <p className="text-xs font-semibold text-[#C25E00]">ABUJMAD FOUNDATION</p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B3B75] tracking-tight">
          {t.about.title}
        </h1>
        <p className="text-base text-slate-700 leading-relaxed">{t.about.body1}</p>
        <p className="text-base text-slate-700 leading-relaxed">{t.about.body2}</p>
        <p className="text-base text-slate-700 leading-relaxed">{t.about.body3}</p>

        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-950 font-medium">
          {t.about.foundationNote}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.about.visionTitle}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t.about.visionBody}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.about.missionTitle}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t.about.missionBody}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.about.objectivesTitle}</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {t.about.objectives.map((obj) => (
            <li key={obj} className="flex items-start gap-2.5 text-sm text-slate-700 border border-slate-100 rounded-md p-3.5 bg-slate-50/70">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>{obj}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Brand Identity & Official Logo Kit */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#C25E00]">
            {tr(lang, 'Brand Identity & Logo System', 'ब्रांड पहचान और आधिकारिक लोगो किट', 'ब्रँड ओळख व अधिकृत लोगो किट')}
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B3B75]">
            {tr(lang, 'ROJGAR SETU Official Emblem & Usage Kit', 'रोजगार सेतु प्रतीक चिन्ह एवं उपयोग किट', 'रोजगार सेतु चिन्ह आणि वापर किट')}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {tr(
              lang,
              'Our emblem represents a suspension bridge (Setu) uniting employment opportunities on the left with diverse Indian workers on the right—designed cleanly without any official government emblems.',
              'हमारा प्रतीक चिन्ह एक सेतु (ब्रिज) को दर्शाता है जो बाईं ओर रोजगार के अवसरों और दाईं ओर विविध भारतीय कामगारों को जोड़ता है—बिना किसी सरकारी प्रतीक चिन्ह के।',
              'आमचे बोधचिन्ह डावीकडील रोजगाराच्या संधी आणि उजवीकडील विविध भारतीय कामगार यांना जोडणाऱ्या सेतूचे प्रतीक आहे—कोणत्याही सरकारी चिन्हाशिवाय.'
            )}
          </p>
        </div>

        {/* Lockup Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-6 border border-slate-200 rounded-md p-5 bg-slate-50 flex flex-col justify-between gap-4">
            <div className="text-xs font-semibold text-[#0B3B75]">
              {tr(lang, 'Horizontal Logo (Headers, Documents & Banners)', 'क्षैतिज लोगो (हेडर, दस्तावेज़ व बैनर)', 'आडवा लोगो (हेडर, कागदपत्रे व बॅनर)')}
            </div>
            <div className="bg-white border border-slate-200 rounded p-4 flex items-center justify-center overflow-x-auto">
              <RojgarSetuLogo variant="horizontal" />
            </div>
          </div>

          <div className="lg:col-span-3 border border-slate-200 rounded-md p-5 bg-slate-50 flex flex-col justify-between gap-4">
            <div className="text-xs font-semibold text-[#0B3B75]">
              {tr(lang, 'Square App Icon', 'वर्गाकार ऐप आइकन', 'चौरस अ‍ॅप आयकॉन')}
            </div>
            <div className="bg-white border border-slate-200 rounded p-4 flex items-center justify-center gap-4">
              <RojgarSetuLogo variant="icon" className="w-20 h-20" />
              <img src="/icon.svg" alt="ROJGAR SETU 36px preview" className="w-9 h-9 rounded-md border border-slate-200" />
            </div>
          </div>

          <div className="lg:col-span-3 border border-slate-200 rounded-md p-5 bg-slate-50 flex flex-col justify-between gap-4">
            <div className="text-xs font-semibold text-[#0B3B75]">
              {tr(lang, 'Vertical / ID Lockup', 'ऊर्ध्वाधर / आईडी कार्ड लोगो', 'उभा / आयडी कार्ड लोगो')}
            </div>
            <div className="flex items-center justify-center">
              <RojgarSetuLogo variant="vertical" className="w-full py-3 px-3" />
            </div>
          </div>
        </div>

        {/* 3 Connected Elements Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-md p-4 space-y-1">
            <p className="text-xs font-bold text-[#E06D1B]">
              1. {tr(lang, 'EMPLOYMENT (रोजगार)', 'रोजगार (EMPLOYMENT)', 'रोजगार (EMPLOYMENT)')}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Left side briefcase and rising opportunity arrow representing jobs, contracts, and livelihood openings.',
                'बाईं ओर ब्रीफकेस और ऊपर उठता अवसर तीर—नौकरी, कार्य और आजीविका के अवसरों का प्रतीक।',
                'डाव्या बाजूला ब्रीफकेस आणि वर जाणारा बाण—रोजगार आणि उपजीविकेच्या संधींचे प्रतीक.'
              )}
            </p>
          </div>
          <div className="border border-slate-200 rounded-md p-4 space-y-1">
            <p className="text-xs font-bold text-[#0B3B75]">
              2. {tr(lang, 'SETU BRIDGE (सेतु)', 'सेतु (SETU BRIDGE)', 'सेतू (SETU BRIDGE)')}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Central suspension arch bridge connecting opportunities directly with India’s workforce with trust and transparency.',
                'केंद्र में बना मजबूत सेतु जो अवसरों और कामगारों को पारदर्शिता और भरोसे के साथ जोड़ता है।',
                'मध्यभागी असलेला मजबूत सेतू संधी आणि कामगार वर्गाला विश्वास व पारदर्शकतेने जोडतो.'
              )}
            </p>
          </div>
          <div className="border border-slate-200 rounded-md p-4 space-y-1">
            <p className="text-xs font-bold text-[#15803D]">
              3. {tr(lang, 'WORKERS (कामगार)', 'कामगार (WORKERS)', 'कामगार (WORKERS)')}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Right side diverse Indian workers: construction worker in hard hat, skilled technician, and service professional.',
                'दाईं ओर विविध भारतीय कामगार: निर्माण श्रमिक, कुशल तकनीशियन और सेवा पेशेवर।',
                'उजव्या बाजूला विविध भारतीय कामगार: बांधकाम कामगार, कुशल तंत्रज्ञ आणि सेवा व्यावसायिक.'
              )}
            </p>
          </div>
        </div>

        {/* Colour Palette & Download Buttons */}
        <div className="pt-2 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-[#0B3B75] inline-block border border-slate-300" />
              <span className="font-mono-tabular font-semibold text-slate-700">#0B3B75</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-[#E06D1B] inline-block border border-slate-300" />
              <span className="font-mono-tabular font-semibold text-slate-700">#E06D1B</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-[#15803D] inline-block border border-slate-300" />
              <span className="font-mono-tabular font-semibold text-slate-700">#15803D</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-white inline-block border border-slate-300" />
              <span className="font-mono-tabular font-semibold text-slate-700">#FFFFFF</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/logo-horizontal.svg"
              download="rojgar-setu-logo-horizontal.svg"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-[#072A54] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {tr(lang, 'Horizontal SVG', 'क्षैतिज SVG', 'आडवा SVG')}
            </a>
            <a
              href="/icon.svg"
              download="rojgar-setu-app-icon.svg"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-[#0B3B75] text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {tr(lang, 'Square Icon SVG', 'वर्गाकार आइकन SVG', 'चौरस आयकॉन SVG')}
            </a>
            <a
              href="/pwa-512x512.png"
              download="rojgar-setu-app-icon-512.png"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-[#0B3B75] text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {tr(lang, 'App Icon PNG (512px)', 'ऐप आइकन PNG (512px)', 'अ‍ॅप आयकॉन PNG (512px)')}
            </a>
          </div>
        </div>
      </section>

      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.about.orgInfoTitle}</h2>
        <div className="divide-y divide-slate-200 text-sm">
          <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="font-semibold text-slate-700">{t.about.founderLabel}</span>
            <span className="sm:col-span-2 text-slate-900 font-medium">ABUJMAD FOUNDATION (Proposed Section 8 Company)</span>
          </div>
          <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="font-semibold text-slate-700">{t.about.registrationLabel}</span>
            <span className="sm:col-span-2 text-slate-500">{t.about.toBeConfirmed}</span>
          </div>
          <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="font-semibold text-slate-700">{t.about.officeLabel}</span>
            <span className="sm:col-span-2 text-slate-500">{t.about.toBeConfirmed}</span>
          </div>
          <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="font-semibold text-slate-700">{t.about.contactLabel}</span>
            <span className="sm:col-span-2 text-slate-500">{t.about.toBeConfirmed}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   2. GOVERNMENT & INSTITUTIONAL PARTNERSHIPS VIEW
============================================================================ */

export const PartnershipsView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user, signInWithGoogle } = useAuth();

  const [organisationName, setOrganisationName] = useState('');
  const [departmentOrInstitution, setDepartmentOrInstitution] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nagpur');
  const [partnershipInterest, setPartnershipInterest] = useState('District Employment Pilot / Rozgar Mela');
  const [message, setMessage] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const stateEntry = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === state) || INDIA_STATES_DISTRICTS[0],
    [state]
  );

  const handleStateChange = (nextState: string) => {
    setState(nextState);
    const entry = INDIA_STATES_DISTRICTS.find((s) => s.name === nextState);
    if (entry && entry.districts.length > 0) {
      setDistrict(entry.districts[0].name);
    }
  };

  const handleDownloadBrief = () => {
    const brief = [
      'ROJGAR SETU — CONCEPT BRIEF & PROJECT OVERVIEW (SUMMARY)',
      '======================================================',
      'Initiative: ROJGAR SETU (रोजगार सेतु)',
      'Proposed Parent Body: ABUJMAD FOUNDATION (Social-Impact Section 8 Initiative)',
      'Slogan: Every Hand Deserves an Opportunity.',
      '',
      'IMPORTANT DISCLAIMER:',
      'ROJGAR SETU is an independent non-government digital workforce initiative.',
      'It is NOT a government website, government department, or officially endorsed government service.',
      '',
      '1. PURPOSE & MISSION',
      'To build an inclusive, multilingual (English, Hindi, Marathi) digital platform connecting',
      'skilled/unskilled workers, youth, women SHGs, and rural artisans with MSMEs, contractors,',
      'industries, households, and institutional employers across India.',
      '',
      '2. KEY CAPABILITIES',
      '- 32 structured A-to-Z workforce categories with multi-skill worker profiles.',
      '- Free Worker Registration during the initial launch campaign.',
      '- Privacy-first district-level employment mapping and opt-in booking-based tracking.',
      '- Transparent wage terms, completion ratings, and grievance redressal.',
      '- Institutional partnership channels for ITIs, Rozgar Melas, CSR, and MSME clusters.',
      '',
      '3. INSTITUTIONAL COLLABORATION MODELS',
      '- District skill-mapping and Rozgar Mela digital onboarding drives',
      '- Vocational training institute & ITI graduate placement connectivity',
      '- Women Self-Help Group (SHG) and rural artisan market-work linkages',
      '- MSME cluster workforce mobilization pilots',
      '',
      'Status: Legal registration and office details pending formal confirmation by ABUJMAD FOUNDATION.',
    ].join('\n');

    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ROJGAR-SETU-Concept-Brief.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmittedRef('');

    if (!user) {
      setErrorMsg(t.common.signInRequired);
      return;
    }
    if (organisationName.trim().length < 2 || departmentOrInstitution.trim().length < 2) {
      setErrorMsg(tr(lang, 'Please provide organisation and department details.', 'कृपया संगठन और विभाग विवरण दर्ज करें।', 'कृपया संस्था व विभागाचे नाव भरा.'));
      return;
    }
    if (contactPerson.trim().length < 2 || designation.trim().length < 2) {
      setErrorMsg(tr(lang, 'Please provide contact person and designation.', 'कृपया संपर्क व्यक्ति और पद भरें।', 'कृपया संपर्क व्यक्ती व पद भरा.'));
      return;
    }
    if (phone.trim().length < 8 || message.trim().length < 5) {
      setErrorMsg(tr(lang, 'Please enter a valid phone number and partnership message.', 'कृपया मान्य फोन नंबर और संदेश दर्ज करें।', 'कृपया वैध फोन क्रमांक आणि संदेश भरा.'));
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitPartnershipEnquiry({
        submitterUid: user.uid,
        organisationName: organisationName.trim(),
        departmentOrInstitution: departmentOrInstitution.trim(),
        contactPerson: contactPerson.trim(),
        designation: designation.trim(),
        email: email.trim(),
        phone: phone.trim(),
        state,
        district,
        partnershipInterest,
        message: message.trim(),
        ...(attachmentName.trim() ? { attachmentName: attachmentName.trim() } : {}),
      });
      setSubmittedRef(id);
      setOrganisationName('');
      setDepartmentOrInstitution('');
      setContactPerson('');
      setDesignation('');
      setPhone('');
      setMessage('');
      setAttachmentName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-4">
        <p className="text-xs font-semibold text-[#C25E00]">ABUJMAD FOUNDATION · Institutional Outreach</p>
        <h1 className="font-display text-3xl font-extrabold text-[#0B3B75]">{t.partnerships.title}</h1>
        <p className="text-base text-slate-600 leading-relaxed max-w-3xl">{t.partnerships.subtitle}</p>
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 font-medium">
          {t.partnerships.disclaimer}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.partnerships.collaborationListTitle}</h2>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {t.partnerships.collaborators.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#0B3B75] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">{t.partnerships.dprTitle}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{t.partnerships.dprDesc}</p>
            <button
              type="button"
              onClick={handleDownloadBrief}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t.partnerships.dprBtn}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.partnerships.formTitle}</h2>

          {!user && (
            <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-700">{t.common.signInRequired}</p>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.nav.signIn}
              </button>
            </div>
          )}

          {submittedRef && (
            <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
              {t.partnerships.successMsg}{' '}
              <span className="font-mono-tabular font-semibold">Ref: {submittedRef}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">{errorMsg}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.orgName} *</label>
                <input
                  type="text"
                  required
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.deptInst} *</label>
                <input
                  type="text"
                  required
                  value={departmentOrInstitution}
                  onChange={(e) => setDepartmentOrInstitution(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.contactPerson} *</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.designation} *</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.email} *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.phone} *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.workerForm.state} *</label>
                <select
                  value={state}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {INDIA_STATES_DISTRICTS.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.workerForm.district} *</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {stateEntry.districts.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.interest} *</label>
              <select
                value={partnershipInterest}
                onChange={(e) => setPartnershipInterest(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="District Employment Pilot / Rozgar Mela">District Employment Pilot / Rozgar Mela</option>
                <option value="Skill Development & ITI Placement">Skill Development & ITI Placement</option>
                <option value="CSR Livelihood Sponsorship">CSR Livelihood Sponsorship</option>
                <option value="MSME & Industrial Association Collaboration">MSME & Industrial Association Collaboration</option>
                <option value="Women SHG & Rural Enterprise Connectivity">Women SHG & Rural Enterprise Connectivity</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.message} *</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.partnerships.attachment}</label>
              <input
                type="file"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                className="block w-full text-xs text-slate-600"
              />
              {attachmentName && (
                <p className="text-xs text-slate-500 mt-1">Selected: {attachmentName}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !user}
              className="w-full py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t.common.loading : t.partnerships.submitBtn}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   3. SKILLS & TRAINING VIEW
============================================================================ */

export const SkillsTrainingView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'govt' | 'vocational' | 'apprenticeship'>('all');

  const items = t.skillsTraining.items.filter((i) => activeTab === 'all' || i.type === activeTab);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#15803D]">
          <GraduationCap className="w-4 h-4" />
          <span>Skill Awareness & Training Directory</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-[#0B3B75]">{t.skillsTraining.heading}</h1>
        <p className="text-base text-slate-600 max-w-3xl">{t.skillsTraining.subheading}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            {t.skillsTraining.govtNotice}
          </div>
          <div className="p-3.5 rounded-md bg-amber-50/70 border border-amber-200 text-xs text-amber-950 leading-relaxed">
            {t.skillsTraining.partnerNotice}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: t.categories.allGroups },
            { id: 'govt', label: t.skillsTraining.tabs.govt },
            { id: 'vocational', label: t.skillsTraining.tabs.vocational },
            { id: 'apprenticeship', label: t.skillsTraining.tabs.apprenticeship },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#0B3B75] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.title} className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <p className={`text-xs font-semibold ${item.type === 'govt' ? 'text-[#0B3B75]' : 'text-[#15803D]'}`}>
                {item.badge}
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">{item.title}</h2>
              <p className="text-xs font-medium text-slate-500">{item.org}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   4. PRICING & TRANSPARENCY VIEW
============================================================================ */

export const PricingPolicyView: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-4">
        <h1 className="font-display text-3xl font-extrabold text-[#0B3B75]">{t.pricing.title}</h1>
        <p className="text-base text-slate-600">{t.pricing.subtitle}</p>
        <div className="p-5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
          <h2 className="font-display text-lg font-bold text-[#15803D]">{t.pricing.campaignTitle}</h2>
          <p className="text-sm text-emerald-950">{t.pricing.campaignDesc}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.pricing.rulesTitle}</h2>
        <ul className="space-y-3">
          {t.pricing.rules.map((rule) => (
            <li key={rule} className="flex items-start gap-2.5 text-sm text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#0B3B75]">{t.pricing.modelsTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {t.pricing.models.map((m) => (
            <div key={m.title} className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
              <p className="text-xs font-semibold text-[#C25E00]">{m.audience}</p>
              <h3 className="font-display text-base font-bold text-[#0B3B75]">{m.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. TRUST, SAFETY, POLICIES, FAQs & GRIEVANCE REDRESSAL VIEW
============================================================================ */

type PolicyTab = 'privacy' | 'terms' | 'workerGuide' | 'employerGuide' | 'refund' | 'safety' | 'grievance' | 'faq';

export const TrustSafetyView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user, signInWithGoogle } = useAuth();

  const [tab, setTab] = useState<PolicyTab>('privacy');
  const [category, setCategory] = useState<GrievanceReport['category']>('fraudulent_job');
  const [targetReference, setTargetReference] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setReportId('');
    if (!user) {
      setErrorMsg(t.common.signInRequired);
      return;
    }
    if (subject.trim().length < 3 || description.trim().length < 10) {
      setErrorMsg(
        tr(
          lang,
          'Please enter a subject (at least 3 characters) and detailed description (at least 10 characters).',
          'कृपया कम से कम 3 अक्षरों का विषय और 10 अक्षरों का विवरण दर्ज करें।',
          'कृपया किमान ३ अक्षरांचा विषय आणि १० अक्षरांचे सविस्तर वर्णन भरा.'
        )
      );
      return;
    }
    setSubmitting(true);
    try {
      const id = await submitGrievanceReport({
        reporterUid: user.uid,
        category,
        ...(targetReference.trim() ? { targetReference: targetReference.trim() } : {}),
        subject: subject.trim(),
        description: description.trim(),
      });
      setReportId(id);
      setTargetReference('');
      setSubject('');
      setDescription('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const policyContent: Record<Exclude<PolicyTab, 'grievance' | 'faq'>, { title: string; points: string[] }> = {
    privacy: {
      title: t.trustSafety.tabs.privacy,
      points: [
        tr(
          lang,
          'Minimal & Lawful Data Collection: We collect only work-relevant skill, district/city area, and verified contact information necessary to connect workers and employers.',
          'न्यूनतम और वैध डेटा संग्रह: हम केवल काम से संबंधित कौशल, जिला/क्षेत्र और सत्यापित संपर्क जानकारी एकत्र करते हैं।',
          'किमान व कायदेशीर डेटा संकलन: कामगार आणि नियोक्त्यांना जोडण्यासाठी आवश्यक तेवढीच कौशल्य व जिल्हा माहिती गोळा केली जाते.'
        ),
        tr(
          lang,
          'No Aadhaar Mandate: Workers are never forced to upload Aadhaar numbers or sensitive personal identity documents to register.',
          'आधार अनिवार्य नहीं: पंजीकरण के लिए किसी भी कामगार से आधार या संवेदनशील दस्तावेज अनिवार्य रूप से नहीं मांगे जाते।',
          'आधार बंधनकारक नाही: नोंदणीसाठी कोणत्याही कामगारास आधार क्रमांक किंवा संवेदनशील कागदपत्रे देणे सक्तीचे नाही.'
        ),
        tr(
          lang,
          'Location Safeguard: Public employment maps display only approximate district/town coordinates. Booking-based live location sharing is off by default and activates only when explicitly authorized by the worker after accepting a job.',
          'लोकेशन सुरक्षा: सार्वजनिक मानचित्र पर केवल जिला/नगर स्तर की स्थिति दिखती है। लाइव लोकेशन केवल कार्य स्वीकृति के बाद कामगार की स्पष्ट सहमति से सक्रिय होती है।',
          'लोकेशन सुरक्षा: सार्वजनिक नकाशावर केवळ जिल्हा/शहर पातळीची माहिती दिसते. लाइव्ह लोकेशन कामगाराच्या स्पष्ट संमतीशिवाय सुरू होत नाही.'
        ),
      ],
    },
    terms: {
      title: t.trustSafety.tabs.terms,
      points: [
        tr(
          lang,
          'Private Social-Impact Platform: ROJGAR SETU is operated as a proposed initiative under ABUJMAD FOUNDATION and is not a government portal.',
          'निजी सामाजिक पहल: रोजगार सेतु ABUJMAD FOUNDATION के अंतर्गत प्रस्तावित एक पहल है और यह कोई सरकारी पोर्टल नहीं है।',
          'खाजगी सामाजिक उपक्रम: रोजगार सेतु हा ABUJMAD FOUNDATION अंतर्गत प्रस्तावित उपक्रम असून हे सरकारी पोर्टल नाही.'
        ),
        tr(
          lang,
          'No Automatic Employment Guarantee: ROJGAR SETU facilitates discovery and digital connections between workers and employers but does not guarantee employment, wages, or continuous work availability.',
          'रोजगार की स्वचालित गारंटी नहीं: मंच केवल कामगारों और नियोक्ताओं के बीच संपर्क सुविधा प्रदान करता है; यह निश्चित नौकरी या वेतन की गारंटी नहीं देता।',
          'रोजगाराची आपोआप हमी नाही: हे व्यासपीठ केवळ कामगार आणि नियोक्ते यांना जोडते; नोकरी किंवा वेतनाची हमी देत नाही.'
        ),
        tr(
          lang,
          'Accurate Representation: Users must maintain truthful skill, wage, and business information. Misleading job posts or fraudulent profiles face suspension.',
          'सही जानकारी: उपयोगकर्ताओं को अपने कौशल, वेतन और व्यवसाय की सत्य जानकारी देनी होगी। भ्रामक पोस्ट पर खाता निलंबित किया जा सकता है।',
          'अचूक माहिती: वापरकर्त्यांनी कौशल्ये, वेतन आणि व्यवसायाची खरी माहिती देणे आवश्यक आहे.'
        ),
      ],
    },
    workerGuide: {
      title: t.trustSafety.tabs.workerGuide,
      points: [
        tr(
          lang,
          'Confirm wage rate, working hours, payment method, and safety gear requirements clearly before reporting to a worksite.',
          'कार्यस्थल पर जाने से पहले वेतन दर, कार्य समय, भुगतान विधि और सुरक्षा उपकरणों की स्पष्ट पुष्टि करें।',
          'कामावर जाण्यापूर्वी मजुरीचा दर, कामाचे तास, पैसे देण्याची पद्धत आणि सुरक्षिततेची खात्री करून घ्या.'
        ),
        tr(
          lang,
          'Never pay any unofficial agent or middleman for viewing jobs or receiving alerts on ROJGAR SETU.',
          'रोजगार सेतु पर काम देखने या अलर्ट पाने के लिए किसी भी बिचौलिए को अनधिकृत शुल्क न दें।',
          'रोजगार सेतुवर काम पाहण्यासाठी किंवा सूचना मिळवण्यासाठी कोणत्याही मध्यस्थाला पैसे देऊ नका.'
        ),
        tr(
          lang,
          'Use the Grievance Redressal form immediately if an employer withholds agreed wages or maintains unsafe working conditions.',
          'यदि नियोक्ता तय वेतन रोके या असुरक्षित परिस्थितियां हों, तो तुरंत शिकायत निवारण फॉर्म का उपयोग करें।',
          'करारानुसार मजुरी न मिळाल्यास किंवा असुरक्षित परिस्थिती असल्यास त्वरित तक्रार नोंदवा.'
        ),
      ],
    },
    employerGuide: {
      title: t.trustSafety.tabs.employerGuide,
      points: [
        tr(
          lang,
          'Disclose exact offered wages, shift timings, work duration, and payment schedule upfront in every job post.',
          'प्रत्येक नौकरी पोस्ट में वेतन, समय, अवधि और भुगतान की शर्तें पहले से स्पष्ट लिखें।',
          'प्रत्येक कामाच्या जाहिरातीत वेतन, वेळ, कालावधी आणि पैसे देण्याच्या अटी स्पष्ट नमूद करा.'
        ),
        tr(
          lang,
          'Ensure safe, harassment-free workplaces, drinking water, basic first aid, and lawful timely compensation.',
          'सुरक्षित, सम्मानजनक कार्यस्थल, पेयजल, प्राथमिक चिकित्सा और समय पर वेतन सुनिश्चित करें।',
          'सुरक्षित व सन्मानजनक कार्यस्थळ, पिण्याचे पाणी, प्रथमोपचार आणि वेळेवर मजुरीची खात्री करा.'
        ),
        tr(
          lang,
          'Zero tolerance for discrimination, child labour (under 18), or forced retention of worker documents.',
          'भेदभाव, बाल श्रम (18 वर्ष से कम) या कामगारों के दस्तावेज जबरन रखने पर सख्त प्रतिबंध है।',
          'भेदभाव, बालकामगार (१८ वर्षांखालील) किंवा कामगारांची कागदपत्रे अडवून ठेवण्यास सक्त मनाई आहे.'
        ),
      ],
    },
    refund: {
      title: t.trustSafety.tabs.refund,
      points: [
        tr(
          lang,
          'During the Initial Registration Campaign, worker registration is 100% free and no fees are charged to workers.',
          'प्रारंभिक पंजीकरण अभियान के दौरान कामगार पंजीकरण 100% निःशुल्क है।',
          'प्रारंभिक नोंदणी मोहिमेदरम्यान कामगार नोंदणी १००% मोफत आहे.'
        ),
        tr(
          lang,
          'For any future paid employer subscription or verified transaction facilitation fee, cancellation terms and refund eligibility will be disclosed transparently prior to payment checkout.',
          'भविष्य की किसी भी सशुल्क नियोक्ता योजना के लिए रद्दीकरण और रिफंड नियम भुगतान से पहले स्पष्ट प्रदर्शित किए जाएंगे।',
          'भविष्यातील कोणत्याही सशुल्क नियोक्ता सेवेसाठी रद्दीकरण व परतावा नियम पेमेंटपूर्वी स्पष्ट केले जातील.'
        ),
      ],
    },
    safety: {
      title: t.trustSafety.tabs.safety,
      points: [
        tr(
          lang,
          'Protective Gear: Construction, welding, electrical, and industrial tasks require appropriate PPE provided or verified before work begins.',
          'सुरक्षा उपकरण: निर्माण, वेल्डिंग, इलेक्ट्रिकल और औद्योगिक कार्यों में आवश्यक सुरक्षा सामग्री अनिवार्य है।',
          'संरक्षक साधने: बांधकाम, वेल्डिंग, वीजकाम व औद्योगिक कामात आवश्यक सुरक्षा साधने वापरणे अनिवार्य आहे.'
        ),
        tr(
          lang,
          'Women Safety: Women-friendly listings commit to daytime or secure shift schedules, safe transit considerations, and zero-harassment oversight.',
          'महिला सुरक्षा: महिला-अनुकूल कार्य स्थलों पर सुरक्षित शिफ्ट समय और उत्पीड़न-मुक्त वातावरण अनिवार्य है।',
          'महिला सुरक्षा: महिलांसाठी अनुकूल कामाच्या ठिकाणी सुरक्षित वेळ आणि तक्रार निवारण व्यवस्था आवश्यक आहे.'
        ),
      ],
    },
  };

  const faqs = [
    {
      q: tr(lang, 'Is ROJGAR SETU a government portal?', 'क्या रोजगार सेतु एक सरकारी पोर्टल है?', 'रोजगार सेतु हे सरकारी पोर्टल आहे का?'),
      a: tr(
        lang,
        'No. ROJGAR SETU is an independent social-impact employment connectivity initiative proposed under ABUJMAD FOUNDATION. It is not owned by or affiliated with any government ministry.',
        'नहीं। रोजगार सेतु ABUJMAD FOUNDATION के अंतर्गत प्रस्तावित एक स्वतंत्र सामाजिक पहल है। यह किसी सरकारी मंत्रालय से संबद्ध नहीं है।',
        'नाही. रोजगार सेतु हा ABUJMAD FOUNDATION अंतर्गत प्रस्तावित स्वतंत्र सामाजिक उपक्रम आहे. हे कोणतेही सरकारी पोर्टल नाही.'
      ),
    },
    {
      q: tr(lang, 'Do workers have to pay any registration fee?', 'क्या कामगारों को पंजीकरण के लिए कोई शुल्क देना होगा?', 'कामगारांना नोंदणीसाठी कोणतेही शुल्क भरावे लागते का?'),
      a: tr(
        lang,
        'No. Worker registration is completely free during the initial registration campaign, and workers are never charged merely to receive job notifications.',
        'नहीं। प्रारंभिक अभियान के दौरान कामगार पंजीकरण पूर्णतः निःशुल्क है और केवल काम की सूचना पाने के लिए कोई शुल्क नहीं है।',
        'नाही. प्रारंभिक मोहिमेत कामगार नोंदणी पूर्णपणे मोफत आहे आणि नोकरीच्या सूचनांसाठी कोणतेही शुल्क नाही.'
      ),
    },
    {
      q: tr(lang, 'Is Aadhaar required to register as a worker?', 'क्या कामगार पंजीकरण के लिए आधार कार्ड अनिवार्य है?', 'कामगार नोंदणीसाठी आधार कार्ड आवश्यक आहे का?'),
      a: tr(
        lang,
        'No. Aadhaar and sensitive identity documents are NOT required to register or apply for jobs on ROJGAR SETU.',
        'नहीं। रोजगार सेतु पर पंजीकरण या आवेदन करने के लिए आधार कार्ड अनिवार्य नहीं है।',
        'नाही. रोजगार सेतुवर नोंदणी किंवा अर्ज करण्यासाठी आधार कार्ड सक्तीचे नाही.'
      ),
    },
    {
      q: tr(lang, 'When can an employer view my live location?', 'नियोक्ता मेरी लाइव लोकेशन कब देख सकता है?', 'नियोक्ता माझे लाइव्ह लोकेशन कधी पाहू शकतो?'),
      a: tr(
        lang,
        'Live location sharing is turned OFF by default. Public maps only display district/town area. Precise booking tracking works only when you accept a booking AND explicitly switch on authorization for that booking.',
        'लाइव लोकेशन डिफ़ॉल्ट रूप से बंद रहती है। सार्वजनिक मानचित्र केवल जिला/क्षेत्र दिखाता है। यह केवल बुकिंग स्वीकार करने और आपकी स्पष्ट अनुमति के बाद ही सक्रिय होती है।',
        'लाइव्ह लोकेशन डीफॉल्टनुसार बंद असते. केवळ काम स्वीकारल्यानंतर आणि तुम्ही स्वतः परवानगी दिल्यावरच ती त्या बुकिंगपुरती सुरू होते.'
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-4">
        <h1 className="font-display text-3xl font-extrabold text-[#0B3B75]">{t.trustSafety.title}</h1>
        <p className="text-base text-slate-600">{t.trustSafety.subtitle}</p>
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 font-medium">
          {t.trustSafety.platformDisclaimer}
        </div>
      </div>

      {/* Policy & Action Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'privacy', label: t.trustSafety.tabs.privacy },
            { id: 'terms', label: t.trustSafety.tabs.terms },
            { id: 'workerGuide', label: t.trustSafety.tabs.workerGuide },
            { id: 'employerGuide', label: t.trustSafety.tabs.employerGuide },
            { id: 'refund', label: t.trustSafety.tabs.refund },
            { id: 'safety', label: t.trustSafety.tabs.safety },
            { id: 'grievance', label: t.trustSafety.tabs.grievance },
            { id: 'faq', label: t.trustSafety.tabs.faq },
          ] as { id: PolicyTab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              tab === item.id
                ? 'bg-[#0B3B75] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== 'grievance' && tab !== 'faq' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[#0B3B75]">
            <FileText className="w-5 h-5" />
            <h2 className="font-display text-xl font-bold">{policyContent[tab].title}</h2>
          </div>
          <ul className="space-y-3">
            {policyContent[tab].points.map((pt) => (
              <li key={pt} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'grievance' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 text-[#0B3B75]">
            <AlertTriangle className="w-5 h-5 text-[#C25E00]" />
            <h2 className="font-display text-xl font-bold">{t.trustSafety.reportTitle}</h2>
          </div>

          {!user && (
            <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-700 inline-flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#0B3B75]" />
                {t.common.signInRequired}
              </p>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.nav.signIn}
              </button>
            </div>
          )}

          {reportId && (
            <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
              {t.trustSafety.reportSuccess}{' '}
              <span className="font-mono-tabular font-semibold">Ref: {reportId}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">{errorMsg}</div>
          )}

          <form onSubmit={handleReportSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.trustSafety.reportCategory} *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GrievanceReport['category'])}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="fraudulent_job">Fraudulent / Misleading Job</option>
                  <option value="non_payment">Wage / Payment Dispute</option>
                  <option value="harassment">Harassment / Misconduct</option>
                  <option value="unsafe_workplace">Unsafe Workplace</option>
                  <option value="account_appeal">Account Suspension Appeal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.trustSafety.reportTarget}
                </label>
                <input
                  type="text"
                  value={targetReference}
                  onChange={(e) => setTargetReference(e.target.value)}
                  placeholder="e.g., RS-E-2026-..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.trustSafety.reportSubject} *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.trustSafety.reportDesc} *
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !user}
              className="px-6 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t.common.loading : t.trustSafety.reportSubmit}
            </button>
          </form>
        </div>
      )}

      {tab === 'faq' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 text-[#0B3B75]">
            <HelpCircle className="w-5 h-5" />
            <h2 className="font-display text-xl font-bold">{t.trustSafety.tabs.faq}</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {faqs.map((item) => (
              <div key={item.q} className="py-4 space-y-1.5">
                <h3 className="font-display text-base font-bold text-[#0B3B75]">{item.q}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   6. CONTACT & SUPPORT VIEW
============================================================================ */

export const ContactView: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-3">
        <h1 className="font-display text-3xl font-extrabold text-[#0B3B75]">{t.contact.title}</h1>
        <p className="text-base text-slate-600">{t.contact.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-2 text-[#0B3B75] font-bold text-sm">
            <Mail className="w-4 h-4 text-[#C25E00]" />
            <span>{t.contact.emailLabel}</span>
          </div>
          <p className="text-sm text-slate-600">{t.about.toBeConfirmed}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-2 text-[#0B3B75] font-bold text-sm">
            <Building2 className="w-4 h-4 text-[#C25E00]" />
            <span>{t.contact.officeLabel}</span>
          </div>
          <p className="text-sm text-slate-600">{t.about.toBeConfirmed}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2 sm:col-span-2">
          <h2 className="font-display text-sm font-bold text-[#0B3B75]">{t.contact.hoursLabel}</h2>
          <p className="text-sm text-slate-600">{t.contact.supportNote}</p>
        </div>
      </div>
    </div>
  );
};
