import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Handshake,
  Info,
  Landmark,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  GOVT_SCHEMES_CATALOG,
  OFFICIAL_VERIFY_NOTE,
  pickText,
  type SchemeAudience,
} from '../data/govtSchemes';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  JobPosting,
  Language,
  PageRoute,
  PublicWorkerProfile,
  ShopkeeperListing,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';
import { RojgarSetuLogo } from './RojgarSetuLogo';
import gandhiPortrait from '../assets/images/gandhi_dignity_labour_1794635762419.jpg';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

/* ============================================================================
   SECTIONS 1–4: PUBLIC-SERVICE IDENTITY HERO WITH MAHATMA GANDHI PORTRAIT
============================================================================ */

interface HomeIdentityHeroProps {
  workersCount: number;
  openJobsCount: number;
  onFindWork: () => void;
  onFindWorkers: () => void;
  onFindShops: () => void;
  onPostJob: () => void;
  onJumpToServices: () => void;
}

export const HomeIdentityHero: React.FC<HomeIdentityHeroProps> = ({
  workersCount,
  openJobsCount,
  onFindWork,
  onFindWorkers,
  onFindShops,
  onPostJob,
  onJumpToServices,
}) => {
  const { lang } = useLanguage();
  const showLiveWorkerCount = workersCount >= 10;
  const showLiveJobCount = openJobsCount >= 5;

  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left 8 cols: Identity, Main Slogan & Primary Buttons ("काम शोधा" / "कामगार शोधा") */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <RojgarSetuLogo variant="icon" className="w-12 h-12 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#C25E00]">
                    ROJGAR SETU ·{' '}
                    {tr(
                      lang,
                      'National Public-Service Workforce Platform',
                      'राष्ट्रीय जनसेवा एवं रोजगार मंच',
                      'राष्ट्रीय जनसेवा व रोजगार मंच'
                    )}
                  </p>
                  <p className="text-xs font-bold text-[#15803D] mt-0.5">
                    श्रम की गरिमा • स्वावलंबन • रोजगार
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h1 className="font-display text-2xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-[#0B3B75] leading-[1.15] tracking-tight text-balance">
                  कामगार नाही, आपलीच माणसं!
                </h1>
                <p className="font-display text-base sm:text-lg font-extrabold text-[#E06D1B]">
                  विश्वासाने काम द्या, सन्मानाने रोजगार द्या.
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#15803D]">
                  प्रत्येक हाताला काम, प्रत्येक श्रमाला सन्मान. · EVERY HAND DESERVES AN OPPORTUNITY.
                </p>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                  {tr(
                    lang,
                    'Direct local employment for workers, households, businesses, unemployed youth, and small entrepreneurs — combining instant nearby service booking with verified Central & Maharashtra Government schemes.',
                    'कामगारों, परिवारों, व्यवसायों, बेरोजगार युवाओं और छोटे उद्योजकों के लिए सीधा स्थानीय रोजगार — आसान सेवा बुकिंग के साथ केंद्र व महाराष्ट्र शासन की प्रमाणित योजनाओं की संपूर्ण जानकारी।',
                    'कामगार, कुटुंबे, व्यवसाय, बेरोजगार युवक आणि लघु उद्योजकांसाठी थेट स्थानिक रोजगार — सोप्या सेवा बुकिंगसह केंद्र व महाराष्ट्र शासनाच्या प्रमाणित योजनांची संपूर्ण माहिती.'
                  )}
                </p>
              </div>
            </div>

            {/* Section 4: Clear Primary Actions ("कामगार शोधा", "कामाची जाहिरात टाका", "काम शोधा", "दुकान शोधा") */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 max-w-4xl">
                <button
                  type="button"
                  onClick={onJumpToServices}
                  className="min-h-[50px] px-3 py-3 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white font-display text-[13px] sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-4 h-4 text-white shrink-0" />
                  <span>{tr(lang, 'Find Workers', 'कामगार खोजें', 'कामगार शोधा')}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={onPostJob}
                  className="min-h-[50px] px-3 py-3 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white font-display text-[13px] sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span>{tr(lang, 'Post a Job', 'काम पोस्ट करें', 'कामाची जाहिरात टाका')}</span>
                </button>

                <button
                  type="button"
                  onClick={onFindWork}
                  className="min-h-[50px] px-3 py-3 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white font-display text-[13px] sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Briefcase className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>{tr(lang, 'Find Work', 'काम खोजें', 'काम शोधा')}</span>
                </button>

                <button
                  type="button"
                  onClick={onFindShops}
                  className="min-h-[50px] px-3 py-3 rounded-lg bg-amber-50 hover:bg-amber-100 border-2 border-[#E06D1B] text-[#0B3B75] font-display text-[13px] sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Store className="w-4 h-4 text-[#E06D1B] shrink-0" />
                  <span>{tr(lang, 'Find Shops', 'दुकान खोजें', 'दुकान शोधा')}</span>
                </button>
              </div>

              {/* Local Trust Strip (Confidence-first — avoids discouraging early-stage zero counters) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 max-w-3xl">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 px-3 py-2 text-xs font-bold text-[#15803D]">
                  <Handshake className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Direct Contact · Zero Middlemen',
                      'सीधा संपर्क · बिना बिचौलियों के',
                      'मध्यस्थांशिवाय थेट संपर्क'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-blue-50/70 border border-blue-200/80 px-3 py-2 text-xs font-bold text-[#0B3B75]">
                  <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Location & Pincode Matching (2–10 km)',
                      'लोकेशन व पिनकोड आधारित मिलान',
                      'लोकेशन व पिनकोडनुसार जवळची जुळणी'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-amber-50/70 border border-amber-200/80 px-3 py-2 text-xs font-bold text-[#9A3412]">
                  <ShieldCheck className="w-4 h-4 text-[#E06D1B] shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Verified Digital Worker ID',
                      'डिजिटल कामगार पहचान पत्र',
                      'सत्यापित डिजिटल कामगार आयडी'
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-0.5">
                {showLiveWorkerCount ? (
                  <span className="font-mono-tabular font-semibold text-[#0B3B75]">
                    {workersCount.toLocaleString('en-IN')}+{' '}
                    {tr(lang, 'Registered Workers', 'पंजीकृत कामगार', 'नोंदणीकृत कामगार')}
                  </span>
                ) : (
                  <span className="font-semibold text-[#0B3B75]">
                    {tr(
                      lang,
                      'Growing Local Worker Network Across Maharashtra & India',
                      'महाराष्ट्र व भारत भर में बढ़ता स्थानीय कामगार नेटवर्क',
                      'महाराष्ट्र व देशभरात वाढणारे स्थानिक कामगार नेटवर्क'
                    )}
                  </span>
                )}
                {showLiveJobCount && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono-tabular font-semibold text-[#15803D]">
                      {openJobsCount.toLocaleString('en-IN')}{' '}
                      {tr(lang, 'Live Opportunities', 'सक्रिय अवसर', 'सध्या उपलब्ध कामे')}
                    </span>
                  </>
                )}
                <span aria-hidden="true" className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={onFindWorkers}
                  className="font-bold text-[#0B3B75] hover:text-[#E06D1B] hover:underline cursor-pointer"
                >
                  {tr(lang, 'Browse Worker Directory →', 'कामगार निर्देशिका देखें →', 'कामगार यादी पहा →')}
                </button>
              </div>
            </div>
          </div>

          {/* Right 4 cols: Prominent, Clearly Visible, Uncropped Mahatma Gandhi Identity Card */}
          <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-[#FAF8F4] overflow-hidden flex flex-col">
            <div className="bg-[#0B3B75] px-4 py-2 flex items-center justify-between text-white text-xs font-bold border-b-2 border-[#E06D1B]">
              <span>{tr(lang, 'Mahatma Gandhi — Our Inspiration', 'महात्मा गांधी — हमारी प्रेरणा', 'महात्मा गांधी — आमची प्रेरणा')}</span>
            </div>
            <div className="p-4 flex sm:flex-row lg:flex-row items-center gap-4 flex-1">
              <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-md overflow-hidden border border-slate-300 bg-[#F6F2EA] p-1 shrink-0 shadow-xs">
                <img
                  src={gandhiPortrait}
                  alt={tr(
                    lang,
                    'Mahatma Gandhi spinning charkha — symbol of dignity of labour and self-reliance',
                    'चरखा चलाते महात्मा गांधी — श्रम की गरिमा और स्वावलंबन के प्रतीक',
                    'चरखा चालवणारे महात्मा गांधी — श्रमाची प्रतिष्ठा व स्वावलंबनाचे प्रतीक'
                  )}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-sm"
                />
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-extrabold text-[#C25E00]">
                  श्रम की गरिमा • स्वावलंबन • रोजगार
                </p>
                <blockquote className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                  {tr(
                    lang,
                    '“Self-reliance and dignified work build a strong nation.”',
                    '“श्रम का सम्मान और स्वावलंबन ही सशक्त राष्ट्र की नींव है।”',
                    '“श्रमाचा सन्मान आणि स्वावलंबन हीच सशक्त राष्ट्राची पायाभरणी आहे.”'
                  )}
                </blockquote>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {tr(
                    lang,
                    'Inspired by Gandhian ideals of honest labour and rural-urban livelihood dignity.',
                    'गांधीवादी श्रम गरिमा और ग्राम-नगर आजीविका स्वावलंबन से प्रेरित जनसेवा पहल।',
                    'गांधीवादी श्रम प्रतिष्ठा आणि ग्रामीण-शहरी स्वावलंबन विचारांनी प्रेरित जनसेवा उपक्रम.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ============================================================================
   SECTIONS 6–12: COMPLETE PUBLIC-SERVICE PORTAL SECTIONS BELOW SERVICE GRID
============================================================================ */

interface HomePublicPortalSectionsProps {
  jobs: JobPosting[];
  workers: PublicWorkerProfile[];
  shops?: ShopkeeperListing[];
  onNavigate: (route: PageRoute, categoryFilter?: string, targetJobId?: string) => void;
}

export const HomePublicPortalSections: React.FC<HomePublicPortalSectionsProps> = ({
  jobs,
  shops = [],
  onNavigate,
}) => {
  const { lang } = useLanguage();
  const [schemeTab, setSchemeTab] = useState<SchemeAudience>('unemployed');

  const previewSchemes = useMemo(
    () => GOVT_SCHEMES_CATALOG.filter((s) => s.audience === schemeTab).slice(0, 4),
    [schemeTab]
  );

  const openJobs = useMemo(
    () => jobs.filter((j) => j.status === 'open').slice(0, 4),
    [jobs]
  );

  return (
    <div className="space-y-0 mt-10 border-t border-slate-200">
      {/* SECTION 6: WORKER REGISTRATION & EMPLOYER REGISTRATION */}
      <section className="py-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <BrandSloganBanner variant="promo" />

          <div>
            <p className="text-xs font-bold text-[#C25E00]">
              {tr(lang, 'Direct Registration', 'सीधा पंजीकरण', 'थेट नोंदणी')}
            </p>
            <h2 className="font-display text-2xl font-extrabold text-[#0B3B75] mt-0.5">
              {tr(
                lang,
                'Worker, Shopkeeper & Employer Registration',
                'कामगार, दुकानदार एवं नियोक्ता पंजीकरण',
                'कामगार, दुकानदार व नियोक्ता नोंदणी'
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Worker Registration Card */}
            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-6 flex flex-col justify-between gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Worker Fee ₹250 · Digital Worker ID & Zero Hidden Charges',
                      'कामगार शुल्क ₹250 · डिजिटल आईडी कार्ड व कोई छिपा शुल्क नहीं',
                      'कामगार नोंदणी ₹250 · डिजिटल ओळखपत्र व शून्य लपविलेले शुल्क'
                    )}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                  {tr(lang, 'Register as a Worker', 'कामगार के रूप में पंजीकरण करें', 'कामगार म्हणून नोंदणी करा')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {tr(
                    lang,
                    'Complete simple 2-minute registration to receive your Digital Rojgar Setu Worker ID Card, Registration Certificate, instant nearby job alerts (2–10 km), and keep 100% of your earnings with zero commission.',
                    '2 मिनट में आसान पंजीकरण करें, डिजिटल रोजगार सेतु कामगार आईडी कार्ड व प्रमाण-पत्र पाएं, 2–10 किमी के भीतर काम के अलर्ट पाएं और बिना किसी कमीशन के पूरी कमाई अपने पास रखें।',
                    '२ मिनिटांत सोपी नोंदणी करा — डिजिटल कामगार ओळखपत्र, नोंदणी प्रमाणपत्र, २–१० किमी परिसरातील कामाचे अलर्ट मिळवा आणि शून्य कमिशनमध्ये संपूर्ण कमाई स्वतःकडे ठेवा.'
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    {tr(lang, 'Digital Worker ID', 'डिजिटल आईडी कार्ड', 'डिजिटल ओळखपत्र')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    {tr(lang, 'Official Certificate', 'पंजीकरण प्रमाण-पत्र', 'नोंदणी प्रमाणपत्र')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    {tr(lang, '0% Commission', '0% कमीशन', '0% कमिशन')}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('register-worker')}
                  className="px-4 py-2.5 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Register as Worker', 'कामगार पंजीकरण करें', 'कामगार नोंदणी करा')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('register-vehicle')}
                  className="px-3.5 py-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Bike / Auto / Tempo', 'बाइक / ऑटो / टेम्पो', 'बाईक / ऑटो / टेम्पो')}
                </button>
              </div>
            </div>

            {/* Shopkeeper Registration Card (Vocal for Local · स्थानिककडून सामान) */}
            <div className="rounded-lg border-2 border-[#E06D1B]/40 bg-amber-50/35 p-6 flex flex-col justify-between gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#C25E00]">
                  <Store className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Vocal for Local · Buy from Local Shops',
                      'वोकल फॉर लोकल · स्थानीय से सामान',
                      'व्होकल फॉर लोकल · स्थानिककडून सामान'
                    )}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                  {tr(
                    lang,
                    'Register Your Local Shop',
                    'अपनी स्थानीय दुकान जोड़ें',
                    'तुमचे स्थानिक दुकान नोंदवा'
                  )}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {tr(
                    lang,
                    'Promote your local shop and goods to nearby customers ("Buy from Local Shops") or hire local staff directly with pincode visibility and zero middlemen.',
                    '“स्थानीय से सामान” अभियान के तहत अपने पिनकोड के ग्राहकों तक दुकान व सामान पहुंचाएं और सीधे स्थानीय स्टाफ हायर करें।',
                    '“स्थानिककडून सामान” अभियानांतर्गत तुमच्या पिनकोडमधील ग्राहकांपर्यंत दुकान व वस्तू पोहोचवा किंवा थेट स्थानिक कामगार शोधा.'
                  )}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    {tr(lang, 'Pincode Visibility', 'पिनकोड अनुसार खोज', 'पिनकोडनुसार शोध')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    {tr(lang, 'Direct Call & WhatsApp', 'सीधा कॉल व WhatsApp', 'थेट कॉल व WhatsApp')}
                  </span>
                  {shops.length > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-[#0B3B75]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                      {shops.length} {tr(lang, 'Local Shops Live', 'दुकानें लाइव', 'दुकाने लाइव्ह')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('register-shopkeeper')}
                  className="px-4 py-2.5 rounded-md bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Register Shop', 'दुकान पंजीकरण', 'दुकान नोंदवा')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('local-shops')}
                  className="px-3.5 py-2.5 rounded-md border border-[#15803D] bg-white hover:bg-emerald-50 text-[#15803D] text-xs font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Browse Local Shops', 'स्थानीय दुकानें देखें', 'स्थानिक दुकाने पहा')}
                </button>
              </div>
            </div>

            {/* Employer Registration Card */}
            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-6 flex flex-col justify-between gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B3B75]">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>{tr(lang, 'For Households, Contractors & MSMEs', 'परिवार, ठेकेदार एवं MSME हेतु', 'कुटुंब, कंत्राटदार व MSME साठी')}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                  {tr(lang, 'Register as an Employer', 'नियोक्ता / ग्राहक पंजीकरण करें', 'नियोक्ता / ग्राहक नोंदणी करा')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {tr(
                    lang,
                    'Hire verified local electricians, plumbers, helpers, drivers, or staff directly with transparent quotes, live post-confirmation GPS tracking, and zero commissions.',
                    'स्थानीय इलेक्ट्रीशियन, प्लंबर, हेल्पर, ड्राइवर और कर्मचारी सीधे हायर करें — पारदर्शी दर, लाइव लोकेशन और बिना बिचौलियों के।',
                    'स्थानिक इलेक्ट्रिशियन, प्लंबर, हेल्पर, चालक व कर्मचारी थेट हायर करा — पारदर्शक दर आणि मध्यस्थांशिवाय.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('register-employer')}
                  className="px-4 py-2.5 rounded-md bg-[#15803D] hover:bg-[#116830] text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Register as Employer', 'नियोक्ता पंजीकरण करें', 'नियोक्ता नोंदणी करा')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('post-job')}
                  className="px-3.5 py-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold transition-colors cursor-pointer"
                >
                  {tr(lang, 'Post a Job Opening', 'काम पोस्ट करें', 'कामाची जाहिरात टाका')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: GOVERNMENT SCHEMES INFORMATION ("सरकारी योजनाएं एवं रोजगार मार्गदर्शन") */}
      <section className="py-10 bg-[#F4F6F9] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#15803D]">
                {tr(
                  lang,
                  'Central Government & Maharashtra Government Portals',
                  'केंद्र सरकार एवं महाराष्ट्र शासन पोर्टल जानकारी',
                  'केंद्र सरकार व महाराष्ट्र शासन योजना माहिती'
                )}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  'Government Schemes & Employment Guidance',
                  'सरकारी योजनाएं एवं रोजगार मार्गदर्शन',
                  'सरकारी योजना व रोजगार मार्गदर्शन'
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('govt-schemes')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-amber-300" />
              <span>{tr(lang, 'View All Government Schemes', 'सभी सरकारी योजनाएं देखें', 'सर्व सरकारी योजना पहा')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Audience Selector */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {(
              [
                { id: 'unemployed', label: tr(lang, 'Unemployed Youth', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी') },
                { id: 'workers', label: tr(lang, 'Workers & Labour', 'कामगारों के लिए', 'कामगारांसाठी') },
                { id: 'entrepreneurs', label: tr(lang, 'Entrepreneurs & MSME', 'उद्योजकों के लिए', 'उद्योजकांसाठी') },
                { id: 'women_youth', label: tr(lang, 'Women & Youth', 'महिला एवं युवा', 'महिला व युवक') },
              ] as { id: SchemeAudience; label: string }[]
            ).map((tItem) => (
              <button
                key={tItem.id}
                type="button"
                role="tab"
                aria-selected={schemeTab === tItem.id}
                onClick={() => setSchemeTab(tItem.id)}
                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  schemeTab === tItem.id
                    ? 'bg-[#0B3B75] text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tItem.label}
              </button>
            ))}
          </div>

          {/* 4 Verified Scheme Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previewSchemes.map((scheme) => (
              <article
                key={scheme.id}
                className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-xs font-semibold flex flex-wrap items-center gap-2">
                    <span className={scheme.govLevel === 'maharashtra' ? 'text-[#C25E00]' : 'text-[#0B3B75]'}>
                      {scheme.govLevel === 'maharashtra'
                        ? tr(lang, 'Maharashtra Government', 'महाराष्ट्र शासन', 'महाराष्ट्र शासन')
                        : scheme.govLevel === 'central'
                        ? tr(lang, 'Central Government', 'केंद्र सरकार', 'केंद्र सरकार')
                        : tr(lang, 'Central & Maharashtra Govt', 'केंद्र एवं महाराष्ट्र शासन', 'केंद्र व महाराष्ट्र शासन')}
                    </span>
                    {scheme.lastVerifiedDate && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-normal font-mono-tabular">
                          {scheme.lastVerifiedDate}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0B3B75] leading-snug">
                    {pickText(scheme.name, lang)}
                  </h3>
                  <p className="text-xs text-slate-500">{pickText(scheme.department, lang)}</p>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                    {pickText(scheme.mainBenefits, lang)}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(
                        schemeTab === 'unemployed'
                          ? 'for-unemployed'
                          : schemeTab === 'entrepreneurs'
                          ? 'for-entrepreneurs'
                          : 'govt-schemes'
                      )
                    }
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{tr(lang, 'View Scheme Details', 'योजना की जानकारी देखें', 'योजनेची माहिती पाहा')}</span>
                  </button>
                  <a
                    href={scheme.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-md border border-[#15803D] bg-white hover:bg-emerald-50 text-[#15803D] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>{tr(lang, 'Official Website', 'आधिकारिक आवेदन वेबसाइट', 'अधिकृत अर्ज वेबसाइट')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <p className="text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-[#0B3B75] shrink-0 mt-0.5" />
            <span>{pickText(OFFICIAL_VERIFY_NOTE, lang)}</span>
          </p>
        </div>
      </section>

      {/* SECTION 8: SKILL DEVELOPMENT & TRAINING */}
      <section className="py-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#15803D]">
                {tr(lang, 'Training, Apprenticeships & Job Fairs', 'प्रशिक्षण, अप्रेंटिसशिप एवं रोजगार मेले', 'प्रशिक्षण, शिकाऊ उमेदवारी व रोजगार मेळावे')}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-[#0B3B75] mt-0.5">
                {tr(lang, 'Skill Development & Training', 'कौशल विकास एवं प्रशिक्षण', 'कौशल्य विकास व प्रशिक्षण')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('skills-training')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0B3B75] text-[#0B3B75] hover:bg-blue-50 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>{tr(lang, 'Explore All Training Programmes', 'सभी प्रशिक्षण कार्यक्रम देखें', 'सर्व प्रशिक्षण कार्यक्रम पहा')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                num: '01.',
                title: tr(lang, 'Skill Development (PMKVY)', 'कौशल विकास कार्यक्रम', 'कौशल्य विकास कार्यक्रम'),
                desc: tr(
                  lang,
                  'Certified short-term trade courses and Recognition of Prior Learning (RPL) via Skill India Digital Hub.',
                  'स्किल इंडिया डिजिटल हब द्वारा प्रमाणित अल्पकालिक प्रशिक्षण और अनुभवी कामगार प्रमाणन।',
                  'स्किल इंडिया डिजिटल हबद्वारे प्रमाणित प्रशिक्षण व अनुभवी कामगारांसाठी RPL प्रमाणपत्र.'
                ),
              },
              {
                num: '02.',
                title: tr(lang, 'Vocational & ITI Training Centres', 'व्यावसायिक व ITI प्रशिक्षण केंद्र', 'व्यावसायिक व ITI प्रशिक्षण केंद्रे'),
                desc: tr(
                  lang,
                  'Discover district ITI courses for electrical, plumbing, welding, fitter, AC repair, and tailoring trades.',
                  'इलेक्ट्रिकल, प्लंबिंग, वेल्डिंग, फिटर, एसी रिपेयर और सिलाई के जिला ITI व व्यावसायिक केंद्रों की जानकारी।',
                  'इलेक्ट्रिकल, प्लंबिंग, वेल्डिंग, फिटर, एसी दुरुस्ती व शिवणकाम प्रशिक्षण केंद्रांची माहिती.'
                ),
              },
              {
                num: '03.',
                title: tr(lang, 'Apprenticeship (NAPS)', 'अप्रेंटिसशिप जानकारी (NAPS)', 'शिकाऊ उमेदवारी (NAPS)'),
                desc: tr(
                  lang,
                  'Practical industrial training with monthly stipend under the National Apprenticeship Promotion Scheme.',
                  'राष्ट्रीय शिक्षुता संवर्धन योजना के तहत उद्योगों में प्रत्यक्ष कार्य अनुभव और मासिक स्टाइपेंड।',
                  'राष्ट्रीय शिकाऊ उमेदवारी योजनेतून उद्योगांमध्ये प्रत्यक्ष अनुभव व विद्यावेतन.'
                ),
              },
              {
                num: '04.',
                title: tr(lang, 'Employment Fairs & Career Guidance', 'रोजगार मेले एवं करियर मार्गदर्शन', 'रोजगार मेळावे व करिअर मार्गदर्शन'),
                desc: tr(
                  lang,
                  'District Rozgar Melas via NCS and Mahaswayam portals alongside free career & job-readiness guidance.',
                  'NCS व महास्वयं पोर्टल पर जिला रोजगार मेले और युवाओं के लिए सरल करियर मार्गदर्शन।',
                  'NCS व महास्वयंम पोर्टलवरील जिल्हा रोजगार मेळावे व युवकांसाठी करिअर मार्गदर्शन.'
                ),
              },
            ].map((item) => (
              <div key={item.num} className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-5 space-y-2">
                <div className="font-mono-tabular text-xs font-bold text-[#C25E00]">{item.num}</div>
                <h3 className="font-display text-base font-bold text-[#0B3B75]">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: LIVE EMPLOYMENT OPPORTUNITIES */}
      <section className="py-10 bg-[#F4F6F9] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#0B3B75]">
                {tr(lang, 'Live Local Listings', 'सक्रिय स्थानीय अवसर', 'सध्या उपलब्ध स्थानिक कामे')}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-[#0B3B75] mt-0.5">
                {tr(lang, 'Employment Opportunities', 'रोजगार के अवसर', 'रोजगाराच्या संधी')}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('find-work')}
                className="px-4 py-2 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'View All Jobs', 'सभी काम देखें', 'सर्व कामे पहा')} →
              </button>
              <button
                type="button"
                onClick={() => onNavigate('post-job')}
                className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'Post Job', 'काम पोस्ट करें', 'काम पोस्ट करा')}
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            {openJobs.length === 0 ? (
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-600">
                <span>
                  {tr(
                    lang,
                    'No open job postings right now. Register as a worker to receive instant alerts as soon as customers post nearby work.',
                    'इस समय कोई खुला काम पोस्ट नहीं है। नजदीकी काम आते ही सूचना पाने के लिए कामगार पंजीकरण करें।',
                    'सध्या कोणतीही खुली जाहिरात नाही. जवळचे काम येताच अलर्ट मिळवण्यासाठी कामगार नोंदणी करा.'
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('register-worker')}
                  className="px-4 py-2 rounded-md bg-[#15803D] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {tr(lang, 'Register Now', 'अभी पंजीकरण करें', 'आता नोंदणी करा')}
                </button>
              </div>
            ) : (
              openJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[#C25E00]">{job.category}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.approxLocationLabel || `${job.cityOrVillage || job.district}, ${job.state}`}
                      </span>
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-[#0B3B75] truncate">
                      {job.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {job.offeredWage > 0 && (
                      <span className="font-mono-tabular text-xs sm:text-sm font-extrabold text-[#15803D]">
                        ₹{job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('worker-dashboard', undefined, job.id)}
                      className="px-4 py-2 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {tr(lang, 'View & Apply', 'देखें व आवेदन करें', 'पहा व अर्ज करा')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* SECTION 10: ENTREPRENEURSHIP & SELF-EMPLOYMENT GUIDANCE */}
      <section className="py-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#C25E00]">
                {tr(lang, 'Self-Employment & Small Business Support', 'स्वरोजगार एवं लघु उद्योग सहायता', 'स्वयंरोजगार व लघु उद्योग सहाय्य')}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-[#0B3B75] mt-0.5">
                {tr(
                  lang,
                  'Entrepreneurship & Self-Employment Guidance',
                  'उद्यमिता एवं स्वरोजगार मार्गदर्शन',
                  'उद्योजकता व स्वयंरोजगार मार्गदर्शन'
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('for-entrepreneurs')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#E06D1B] hover:bg-[#c55b10] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
            >
              <span>{tr(lang, 'All Entrepreneur Schemes', 'सभी उद्योजक योजनाएं देखें', 'सर्व उद्योजक योजना पहा')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: 'PMEGP & CMEGP Maharashtra',
                desc: tr(
                  lang,
                  'Credit-linked margin money & capital subsidy portals for starting new manufacturing, service, or rural micro-enterprises.',
                  'नए विनिर्माण, सेवा और ग्रामीण सूक्ष्म उद्योगों के लिए केंद्र (PMEGP) व महाराष्ट्र शासन (CMEGP) की ऋण-संलग्न सब्सिडी योजनाएं।',
                  'नवीन उत्पादन, सेवा व ग्रामीण सूक्ष्म उद्योगांसाठी केंद्र (PMEGP) व महाराष्ट्र शासनाच्या (CMEGP) कर्ज-संलग्न अनुदान योजना.'
                ),
                url: 'https://maha-cmegp.gov.in',
                portal: 'maha-cmegp.gov.in',
              },
              {
                title: 'MUDRA, Stand-Up India & PM Vishwakarma',
                desc: tr(
                  lang,
                  'Institutional credit support for small shopkeepers, women & SC/ST greenfield entrepreneurs, and traditional craftspeople.',
                  'छोटे दुकानदारों, महिला व SC/ST उद्यमियों तथा पारंपरिक कारीगरों के लिए संस्थागत व्यवसाय ऋण व प्रशिक्षण योजनाएं।',
                  'लहान दुकानदार, महिला व SC/ST उद्योजक तसेच पारंपरिक कारागिरांसाठी संस्थात्मक व्यवसाय कर्ज व प्रशिक्षण योजना.'
                ),
                url: 'https://www.mudra.org.in',
                portal: 'mudra.org.in',
              },
              {
                title: 'Udyam MSME & Startup India',
                desc: tr(
                  lang,
                  'Free official Udyam MSME registration certificate, DPIIT Startup recognition, mentorship, and public procurement access.',
                  'निःशुल्क उद्यम MSME प्रमाणपत्र, DPIIT स्टार्टअप मान्यता, मेंटरशिप और सरकारी खरीद पोर्टल तक पहुंच।',
                  'मोफत उद्यम MSME प्रमाणपत्र, DPIIT स्टार्टअप मान्यता, मेंटॉरशिप आणि शासकीय खरेदीत संधी.'
                ),
                url: 'https://udyamregistration.gov.in',
                portal: 'udyamregistration.gov.in',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-[#0B3B75]">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => onNavigate('for-entrepreneurs')}
                    className="font-bold text-[#0B3B75] hover:underline cursor-pointer"
                  >
                    {tr(lang, 'View Scheme Details', 'जानकारी देखें', 'माहिती पाहा')}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#15803D] hover:underline"
                  >
                    <span>{item.portal}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 11: GOVERNMENT & INSTITUTIONAL PARTNERSHIPS */}
      <section className="py-10 bg-[#F4F6F9] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B3B75]">
                <Handshake className="w-4 h-4 text-[#E06D1B]" />
                <span>ROJGAR SETU · {tr(lang, 'Institutional Collaboration', 'संस्थागत सहयोग', 'संस्थात्मक सहकार्य')}</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  'Government & Institutional Partnerships',
                  'सरकारी एवं संस्थागत साझेदारी',
                  'सरकारी व संस्थात्मक भागीदारी'
                )}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {tr(
                  lang,
                  'Collaborate with ROJGAR SETU for district Rozgar Melas, ITI graduate placement connectivity, Women Self-Help Group (SHG) market linkages, MSME workforce clusters, and CSR livelihood pilots.',
                  'जिला रोजगार मेले, ITI प्लेसमेंट, महिला बचत गट (SHG) आजीविका, MSME क्लस्टर और CSR रोजगार पहल के लिए रोजगार सेतु के साथ जुड़ें।',
                  'जिल्हा रोजगार मेळावे, ITI प्लेसमेंट, महिला बचत गट (SHG), MSME क्लस्टर आणि CSR उपक्रमांसाठी रोजगार सेतु सोबत सहभागी व्हा.'
                )}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" /> {tr(lang, 'District Rozgar Melas', 'जिला रोजगार मेले', 'जिल्हा रोजगार मेळावे')}</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" /> {tr(lang, 'ITI & Skill Centres', 'ITI एवं प्रशिक्षण संस्थान', 'ITI व कौशल्य केंद्रे')}</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" /> {tr(lang, 'Women SHGs & MSMEs', 'महिला SHG व MSME', 'महिला बचत गट व MSME')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('partnerships')}
              className="px-5 py-3 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold whitespace-nowrap shrink-0 self-start lg:self-center cursor-pointer"
            >
              {tr(lang, 'Submit Partnership Enquiry', 'साझेदारी प्रस्ताव भेजें', 'भागीदारी प्रस्ताव पाठवा')} →
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 12: ABOUT ROJGAR SETU & CONTACT INFORMATION */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-[#F8FAFC] p-6 space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#15803D]">
              <Users className="w-4 h-4" />
              <span>{tr(lang, 'About ROJGAR SETU', 'रोजगार सेतु के बारे में', 'रोजगार सेतु विषयी')}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
              {tr(
                lang,
                'A People-First Digital Bridge for India’s Workforce',
                'भारत के कार्यबल के लिए जन-केंद्रित डिजिटल सेतु',
                'भारतातील श्रमशक्तीसाठी लोकाभिमुख डिजिटल सेतू'
              )}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {tr(
                lang,
                'ROJGAR SETU is an independent social-impact employment platform. It is designed to respect the dignity of labour, simplify local hiring without brokers, and bring authentic government scheme guidance to every citizen in Marathi, Hindi, and English.',
                'रोजगार सेतु एक स्वतंत्र सामाजिक रोजगार मंच है जो श्रम की गरिमा का सम्मान करते हुए बिना दलालों के स्थानीय रोजगार और मराठी, हिंदी व अंग्रेजी में प्रामाणिक सरकारी योजना मार्गदर्शन प्रदान करता है।',
                'रोजगार सेतु हा एक स्वतंत्र सामाजिक रोजगार मंच असून तो श्रमाचा सन्मान राखून मध्यस्थांशिवाय स्थानिक रोजगार आणि मराठी, हिंदी व इंग्रजीमध्ये अधिकृत सरकारी योजनांची माहिती देतो.'
              )}
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('about')}
                className="px-4 py-2 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'Read About Us', 'हमारे बारे में पढ़ें', 'आमच्याबद्दल वाचा')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('trust-safety')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                <span>{tr(lang, 'Trust, Safety & Grievance Desk', 'सुरक्षा एवं शिकायत निवारण', 'सुरक्षा व तक्रार कक्ष')}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-[#F8FAFC] p-6 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#C25E00]">
                <Mail className="w-4 h-4" />
                <span>{tr(lang, 'Contact & Citizen Helpdesk', 'संपर्क एवं सहायता कक्ष', 'संपर्क व मदत कक्ष')}</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                {tr(lang, 'Need Assistance or Want to Connect?', 'सहायता चाहिए या संपर्क करना चाहते हैं?', 'मदत हवी आहे किंवा संपर्क साधायचा आहे?')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {tr(
                  lang,
                  'Reach out for worker onboarding support, employer assistance, district partnership enquiries, or grievance redressal.',
                  'कामगार पंजीकरण सहायता, नियोक्ता मदद, जिला साझेदारी या शिकायत निवारण के लिए हमारे सहायता कक्ष से संपर्क करें।',
                  'कामगार नोंदणी सहाय्य, नियोक्ता मदत, जिल्हा भागीदारी किंवा तक्रार निवारणासाठी आमच्या मदत कक्षाशी संपर्क साधा.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="px-4 py-2.5 rounded-md bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'Open Contact & Helpdesk', 'संपर्क पृष्ठ खोलें', 'संपर्क पृष्ठ उघडा')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="px-4 py-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'Pricing & Transparency', 'शुल्क एवं पारदर्शिता', 'दर व पारदर्शकता')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
