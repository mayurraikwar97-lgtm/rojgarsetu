import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  GraduationCap,
  HardHat,
  Info,
  Landmark,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  GOVT_SCHEMES_CATALOG,
  OFFICIAL_VERIFY_NOTE,
  pickText,
  type GovtSchemeItem,
  type SchemeAudience,
  type SchemeGovLevel,
} from '../data/govtSchemes';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language, PageRoute } from '../types/domain';

interface GovtSchemesViewProps {
  initialAudience?: SchemeAudience | 'all';
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function getGovLevelLabel(level: SchemeGovLevel, lang: Language): string {
  if (level === 'central') {
    return tr(lang, 'Central Government', 'केंद्र सरकार', 'केंद्र सरकार');
  }
  if (level === 'maharashtra') {
    return tr(lang, 'Maharashtra Government', 'महाराष्ट्र शासन', 'महाराष्ट्र शासन');
  }
  return tr(lang, 'Central & Maharashtra Govt', 'केंद्र एवं महाराष्ट्र शासन', 'केंद्र व महाराष्ट्र शासन');
}

function getAudienceLabel(audience: SchemeAudience, lang: Language): string {
  switch (audience) {
    case 'unemployed':
      return tr(lang, 'For Unemployed', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी');
    case 'workers':
      return tr(lang, 'For Workers', 'कामगारों के लिए', 'कामगारांसाठी');
    case 'entrepreneurs':
      return tr(lang, 'For Entrepreneurs & MSME', 'उद्योजकों के लिए', 'उद्योजकांसाठी');
    case 'women_youth':
      return tr(lang, 'Women & Youth', 'महिला एवं युवा', 'महिला व युवक');
  }
}

export const GovtSchemesView: React.FC<GovtSchemesViewProps> = ({
  initialAudience = 'all',
  onNavigate,
}) => {
  const { lang } = useLanguage();
  const [audienceFilter, setAudienceFilter] = useState<SchemeAudience | 'all'>(initialAudience);
  const [govFilter, setGovFilter] = useState<'all' | 'central' | 'maharashtra'>('all');
  const [query, setQuery] = useState('');
  const [selectedScheme, setSelectedScheme] = useState<GovtSchemeItem | null>(null);

  useEffect(() => {
    setAudienceFilter(initialAudience);
  }, [initialAudience]);

  const filteredSchemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GOVT_SCHEMES_CATALOG.filter((item) => {
      if (audienceFilter !== 'all' && item.audience !== audienceFilter) return false;
      if (govFilter === 'central' && item.govLevel === 'maharashtra') return false;
      if (govFilter === 'maharashtra' && item.govLevel === 'central') return false;
      if (!q) return true;
      const haystack = [
        item.name.en,
        item.name.hi,
        item.name.mr,
        item.department.en,
        item.department.hi,
        item.department.mr,
        item.whoCanApply.en,
        item.whoCanApply.hi,
        item.whoCanApply.mr,
        item.mainBenefits.en,
        item.mainBenefits.hi,
        item.mainBenefits.mr,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [audienceFilter, govFilter, query]);

  const pageHeading =
    audienceFilter === 'unemployed'
      ? tr(
          lang,
          'Guidance & Government Schemes for Unemployed Youth',
          'बेरोजगारों के लिए सरकारी योजनाएं एवं रोजगार मार्गदर्शन',
          'बेरोजगारांसाठी सरकारी योजना व रोजगार मार्गदर्शन'
        )
      : audienceFilter === 'entrepreneurs'
      ? tr(
          lang,
          'Government Schemes & Support for Entrepreneurs & Small Businesses',
          'उद्योजकों एवं छोटे व्यवसायों के लिए सरकारी योजनाएं व मार्गदर्शन',
          'उद्योजक व लघु व्यवसायांसाठी सरकारी योजना व मार्गदर्शन'
        )
      : tr(
          lang,
          'Government Schemes & Employment Guidance Centre',
          'सरकारी योजनाएं एवं रोजगार मार्गदर्शन केंद्र',
          'सरकारी योजना व रोजगार मार्गदर्शन केंद्र'
        );

  const pageSubtitle =
    audienceFilter === 'unemployed'
      ? tr(
          lang,
          'Explore official Central & Maharashtra employment exchanges, free skill programmes, apprenticeships, job fairs, and direct local work opportunities.',
          'केंद्र व महाराष्ट्र के आधिकारिक रोजगार पोर्टल, निःशुल्क कौशल प्रशिक्षण, अप्रेंटिसशिप, रोजगार मेले और स्थानीय काम के अवसरों की जानकारी।',
          'केंद्र व महाराष्ट्राचे अधिकृत रोजगार पोर्टल, मोफत कौशल्य प्रशिक्षण, शिकाऊ उमेदवारी, रोजगार मेळावे व स्थानिक कामाच्या संधींची माहिती.'
        )
      : audienceFilter === 'entrepreneurs'
      ? tr(
          lang,
          'Verified information on PMEGP, CMEGP Maharashtra, MUDRA loans, Stand-Up India, Startup India, Udyam MSME registration, and self-employment training.',
          'PMEGP, CMEGP महाराष्ट्र, मुद्रा ऋण, स्टैंड-अप इंडिया, स्टार्टअप इंडिया, उद्यम MSME पंजीकरण और स्वरोजगार प्रशिक्षण की विश्वसनीय जानकारी।',
          'PMEGP, CMEGP महाराष्ट्र, मुद्रा कर्ज, स्टँड-अप इंडिया, स्टार्टअप इंडिया, उद्यम MSME नोंदणी व स्वयंरोजगार मार्गदर्शनाची विश्वासार्ह माहिती.'
        )
      : tr(
          lang,
          'A single public-service directory of verified Central and Maharashtra Government schemes for unemployed youth, workers, women, and small entrepreneurs.',
          'बेरोजगार युवाओं, कामगारों, महिलाओं और छोटे उद्यमियों के लिए केंद्र व महाराष्ट्र शासन की प्रमाणित योजनाओं की एकीकृत मार्गदर्शिका।',
          'बेरोजगार युवक, कामगार, महिला आणि लघु उद्योजकांसाठी केंद्र व महाराष्ट्र शासनाच्या प्रमाणित योजनांचे एकच मार्गदर्शन केंद्र.'
        );

  const audienceTabs: {
    id: SchemeAudience | 'all';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'all', label: tr(lang, 'All Schemes', 'सभी योजनाएं', 'सर्व योजना'), icon: Landmark },
    { id: 'unemployed', label: tr(lang, 'For Unemployed', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी'), icon: GraduationCap },
    { id: 'workers', label: tr(lang, 'For Workers', 'कामगारों के लिए', 'कामगारांसाठी'), icon: HardHat },
    { id: 'entrepreneurs', label: tr(lang, 'For Entrepreneurs', 'उद्योजकों के लिए', 'उद्योजकांसाठी'), icon: Building2 },
    { id: 'women_youth', label: tr(lang, 'Women & Youth', 'महिला एवं युवा', 'महिला व युवक'), icon: Users },
  ];

  return (
    <div className="bg-[#F4F6F9] min-h-screen pb-14">
      {/* Institutional Banner */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-5">
          <div className="space-y-2 max-w-4xl">
            <p className="text-xs font-bold text-[#C25E00]">
              {tr(
                lang,
                'ROJGAR SETU · Public-Service Information Centre',
                'रोजगार सेतु · जनसेवा एवं रोजगार सूचना केंद्र',
                'रोजगार सेतु · जनसेवा व रोजगार माहिती केंद्र'
              )}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B3B75] tracking-tight text-balance">
              {pageHeading}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{pageSubtitle}</p>
          </div>

          {/* Independent Public-Service Disclaimer (No False Government Claim) */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950">
            <Info className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {tr(
                lang,
                'Information Notice: ROJGAR SETU is an independent public-service employment platform and is NOT an official Government of India or Government of Maharashtra website. All links below direct you to authentic official government portals. Always verify current eligibility, benefits, and deadlines on the respective department website.',
                'महत्त्वपूर्ण सूचना: रोजगार सेतु एक स्वतंत्र जनसेवा रोजगार मंच है और भारत सरकार या महाराष्ट्र शासन का आधिकारिक पोर्टल नहीं है। नीचे दिए गए सभी लिंक प्रामाणिक सरकारी वेबसाइटों पर जाते हैं। अद्यतन पात्रता व लाभ की पुष्टि संबंधित विभाग की आधिकारिक वेबसाइट पर अवश्य करें।',
                'महत्त्वाची सूचना: रोजगार सेतु हा एक स्वतंत्र जनसेवा रोजगार मंच असून तो भारत सरकार किंवा महाराष्ट्र शासनाचे अधिकृत संकेतस्थळ नाही. खालील सर्व दुवे अधिकृत शासकीय पोर्टल्सवर नेतात. अद्ययावत पात्रता, लाभ व अटींसाठी संबंधित विभागाच्या अधिकृत वेबसाइटला भेट द्या.'
              )}
            </p>
          </div>

          {/* Quick Platform Actions for Job Seekers / Entrepreneurs */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('find-work')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#0B3B75] text-white text-xs sm:text-sm font-bold hover:bg-[#072A54] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Briefcase className="w-4 h-4" />
              {tr(lang, 'Find Work Now', 'अभी काम खोजें', 'आता काम शोधा')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register-worker')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#15803D] text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              {tr(lang, 'Free Worker Registration', 'निःशुल्क कामगार पंजीकरण', 'मोफत कामगार नोंदणी')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('skills-training')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-slate-300 bg-white text-[#0B3B75] text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" />
              {tr(lang, 'Skills & Training Directory', 'कौशल एवं प्रशिक्षण', 'कौशल्य व प्रशिक्षण')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register-employer')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-slate-300 bg-white text-[#0B3B75] text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {tr(lang, 'Employer Registration', 'नियोक्ता / उद्योजक पंजीकरण', 'नियोक्ता / उद्योजक नोंदणी')}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Audience Tabs */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Scheme categories">
              {audienceTabs.map((tab) => {
                const Icon = tab.icon;
                const active = audienceFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAudienceFilter(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#0B3B75] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search PMEGP, e-Shram, MUDRA...',
                  'योजना खोजें (PMEGP, ई-श्रम, मुद्रा)...',
                  'योजना शोधा (PMEGP, ई-श्रम, मुद्रा)...'
                )}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
              />
            </div>
          </div>

          {/* Central vs Maharashtra Filter */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                {tr(lang, 'Authority:', 'शासन स्तर:', 'शासन स्तर:')}
              </span>
              {(
                [
                  { id: 'all', label: tr(lang, 'All (Central + Maharashtra)', 'सभी (केंद्र + महाराष्ट्र)', 'सर्व (केंद्र + महाराष्ट्र)') },
                  { id: 'central', label: tr(lang, 'Central Government', 'केंद्र सरकार', 'केंद्र सरकार') },
                  { id: 'maharashtra', label: tr(lang, 'Maharashtra Government', 'महाराष्ट्र शासन', 'महाराष्ट्र शासन') },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGovFilter(g.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    govFilter === g.id
                      ? 'bg-[#E06D1B] text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-mono-tabular font-semibold text-slate-500">
              {filteredSchemes.length}{' '}
              {tr(lang, 'verified schemes listed', 'प्रमाणित योजनाएं उपलब्ध', 'प्रमाणित योजना उपलब्ध')}
            </p>
          </div>
        </div>

        {/* Contextual Guidance Bar for Unemployed or Entrepreneurs */}
        {(audienceFilter === 'unemployed' || audienceFilter === 'entrepreneurs') && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            {audienceFilter === 'unemployed' ? (
              <>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#C25E00]">01.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Employment Exchange & Job Fairs', 'रोजगार पंजीकरण एवं रोजगार मेले', 'रोजगार नोंदणी व रोजगार मेळावे')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Register free on NCS (ncs.gov.in) and Mahaswayam (rojgar.mahaswayam.gov.in) to receive district job fair schedules and verified employer openings.',
                      'जिला रोजगार मेले और प्रमाणित नौकरियों के लिए NCS और महास्वयं पोर्टल पर निःशुल्क पंजीकरण करें।',
                      'जिल्हा रोजगार मेळावे व अधिकृत नोकऱ्यांसाठी NCS आणि महास्वयंम पोर्टलवर मोफत नोंदणी करा.'
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#15803D]">02.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Skill Training & Apprenticeships', 'कौशल प्रशिक्षण एवं अप्रेंटिसशिप', 'कौशल्य प्रशिक्षण व शिकाऊ उमेदवारी')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Upgrade practical skills via PMKVY / Skill India Digital Hub or gain paid industrial experience through NAPS apprenticeships.',
                      'PMKVY / स्किल इंडिया से प्रमाणित प्रशिक्षण लें या NAPS के माध्यम से उद्योगों में प्रत्यक्ष अप्रेंटिसशिप करें।',
                      'PMKVY / स्किल इंडियाद्वारे प्रमाणित प्रशिक्षण घ्या किंवा NAPS मधून उद्योगांमध्ये प्रत्यक्ष अनुभव मिळवा.'
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#0B3B75]">03.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Direct Local Work on Rojgar Setu', 'रोजगार सेतु पर सीधा स्थानीय काम', 'रोजगार सेतु वर थेट स्थानिक काम')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Register free as a worker to get your digital Rojgar Setu ID Card and receive instant nearby work alerts within 2–10 km.',
                      'निःशुल्क कामगार पंजीकरण कर अपना रोजगार सेतु आईडी कार्ड पाएं और 2–10 किमी के भीतर काम की सूचनाएं प्राप्त करें।',
                      'मोफत कामगार नोंदणी करून रोजगार सेतु ओळखपत्र मिळवा आणि २–१० किमी परिसरातील कामाचे तात्काळ अलर्ट मिळवा.'
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#C25E00]">01.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Register Your Enterprise (Udyam)', 'उद्यम MSME पंजीकरण करें', 'उद्यम MSME नोंदणी करा')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Start with free Udyam registration on udyamregistration.gov.in to qualify for priority MSME credit, subsidies, and public procurement.',
                      'प्राथमिकता क्षेत्र ऋण और MSME लाभों के लिए udyamregistration.gov.in पर निःशुल्क उद्यम पंजीकरण करें।',
                      'प्राधान्य बँक कर्ज व MSME योजनांसाठी udyamregistration.gov.in वर मोफत उद्यम नोंदणी करा.'
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#15803D]">02.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Explore Credit & Subsidy Portals', 'ऋण एवं सब्सिडी योजनाएं चुनें', 'कर्ज व अनुदान योजना निवडा')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Compare PMEGP (Central), CMEGP (Maharashtra), MUDRA, Stand-Up India, and PM Vishwakarma based on your business sector and scale.',
                      'अपने व्यवसाय के अनुसार PMEGP, CMEGP महाराष्ट्र, मुद्रा, स्टैंड-अप इंडिया और पीएम विश्वकर्मा की शर्तें जांचें।',
                      'व्यवसायाच्या स्वरूपानुसार PMEGP, CMEGP महाराष्ट्र, मुद्रा, स्टँड-अप इंडिया व पीएम विश्वकर्मा योजना तपासा.'
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#0B3B75]">03.</div>
                  <h2 className="font-display text-base font-bold text-[#0B3B75]">
                    {tr(lang, 'Hire Skilled Local Staff Directly', 'सीधे स्थानीय कुशल कामगार हायर करें', 'थेट स्थानिक कुशल कामगार मिळवा')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {tr(
                      lang,
                      'Use Rojgar Setu to register your business as an employer and hire verified technicians, helpers, drivers, or staff without middlemen.',
                      'बिना बिचौलियों के अपने व्यवसाय के लिए स्थानीय तकनीशियन, हेल्पर, ड्राइवर और कर्मचारी सीधे हायर करें।',
                      'मध्यस्थांशिवाय आपल्या व्यवसायासाठी स्थानिक तंत्रज्ञ, हेल्पर, चालक व कर्मचारी थेट रोजगार सेतु वरून मिळवा.'
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Scheme Cards Grid */}
        {filteredSchemes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
            <Compass className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              {tr(
                lang,
                'No matching government schemes found for this filter.',
                'इस खोज के लिए कोई योजना नहीं मिली।',
                'या शोधासाठी कोणतीही योजना आढळली नाही.'
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setAudienceFilter('all');
                setGovFilter('all');
                setQuery('');
              }}
              className="text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer"
            >
              {tr(lang, 'Reset filters', 'फ़िल्टर रीसेट करें', 'फिल्टर रीसेट करा')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredSchemes.map((scheme) => {
              const govColor =
                scheme.govLevel === 'maharashtra'
                  ? 'text-[#C25E00]'
                  : scheme.govLevel === 'central'
                  ? 'text-[#0B3B75]'
                  : 'text-[#15803D]';
              return (
                <article
                  key={scheme.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 flex flex-col justify-between gap-4 hover:border-[#0B3B75]/50 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                      <span className={govColor}>{getGovLevelLabel(scheme.govLevel, lang)}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="text-slate-600">{getAudienceLabel(scheme.audience, lang)}</span>
                      {scheme.lastVerifiedDate && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-500 font-normal font-mono-tabular">
                            {tr(lang, 'Verified', 'सत्यापित', 'तपासणी')}: {scheme.lastVerifiedDate}
                          </span>
                        </>
                      )}
                    </div>

                    <div>
                      <h2 className="font-display text-lg font-bold text-[#0B3B75] leading-snug">
                        {pickText(scheme.name, lang)}
                      </h2>
                      <p className="text-xs font-medium text-slate-500 mt-1">
                        {pickText(scheme.department, lang)}
                      </p>
                    </div>

                    <dl className="space-y-2 text-xs sm:text-sm pt-2 border-t border-slate-100">
                      <div>
                        <dt className="font-bold text-slate-800 inline">
                          {tr(lang, 'Who can apply: ', 'कौन आवेदन कर सकता है: ', 'कोण अर्ज करू शकते: ')}
                        </dt>
                        <dd className="text-slate-600 inline">{pickText(scheme.whoCanApply, lang)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-800 inline">
                          {tr(lang, 'Main benefits: ', 'मुख्य लाभ: ', 'मुख्य फायदे: ')}
                        </dt>
                        <dd className="text-slate-600 inline">{pickText(scheme.mainBenefits, lang)}</dd>
                      </div>
                    </dl>

                    {!scheme.lastVerifiedDate && (
                      <p className="text-[11px] text-amber-800 font-medium">
                        {pickText(OFFICIAL_VERIFY_NOTE, lang)}
                      </p>
                    )}
                  </div>

                  {/* Two Required Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedScheme(scheme)}
                      className="flex-1 min-w-[150px] min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs sm:text-sm font-bold hover:bg-[#072A54] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4" />
                      <span>
                        {tr(lang, 'View Scheme Details', 'योजना की जानकारी देखें', 'योजनेची माहिती पाहा')}
                      </span>
                    </button>
                    <a
                      href={scheme.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[150px] min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-[#15803D] bg-white text-[#15803D] text-xs sm:text-sm font-bold hover:bg-emerald-50 transition-colors whitespace-nowrap"
                    >
                      <span>
                        {tr(lang, 'Official Application Website', 'आधिकारिक आवेदन वेबसाइट', 'अधिकृत अर्ज वेबसाइट')}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheme Detail Modal */}
      {selectedScheme && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scheme-modal-title"
          onClick={() => setSelectedScheme(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0B3B75] text-white px-5 py-4 flex items-start justify-between gap-4 border-b-2 border-[#E06D1B]">
              <div>
                <p className="text-xs font-semibold text-amber-300">
                  {getGovLevelLabel(selectedScheme.govLevel, lang)} · {getAudienceLabel(selectedScheme.audience, lang)}
                </p>
                <h2 id="scheme-modal-title" className="font-display text-lg sm:text-xl font-bold mt-0.5 leading-snug">
                  {pickText(selectedScheme.name, lang)}
                </h2>
                <p className="text-xs text-blue-100 mt-1">{pickText(selectedScheme.department, lang)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScheme(null)}
                aria-label="Close"
                className="p-1.5 rounded bg-[#072A54] text-white hover:bg-blue-900 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 text-sm">
              <dl className="divide-y divide-slate-200">
                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#0B3B75]">
                    {tr(lang, 'Operating Department / Authority', 'संचालक विभाग / प्राधिकरण', 'संबंधित विभाग / प्राधिकरण')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.department, lang)}</dd>
                </div>

                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#0B3B75]">
                    {tr(lang, 'Who Can Apply', 'कौन आवेदन कर सकता है', 'कोण अर्ज करू शकते')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.whoCanApply, lang)}</dd>
                </div>

                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#15803D]">
                    {tr(lang, 'Main Benefits', 'मुख्य लाभ', 'मुख्य फायदे')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.mainBenefits, lang)}</dd>
                </div>

                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#0B3B75]">
                    {tr(lang, 'Eligibility Conditions', 'पात्रता शर्तें', 'पात्रता अटी')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.eligibility, lang)}</dd>
                </div>

                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#0B3B75]">
                    {tr(lang, 'Required Documents', 'आवश्यक दस्तावेज़', 'आवश्यक कागदपत्रे')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.documents, lang)}</dd>
                </div>

                <div className="py-3 space-y-1">
                  <dt className="text-xs font-bold text-[#C25E00]">
                    {tr(lang, 'Application Process', 'आवेदन प्रक्रिया', 'अर्ज प्रक्रिया')}
                  </dt>
                  <dd className="text-slate-700 leading-relaxed">{pickText(selectedScheme.applicationProcess, lang)}</dd>
                </div>

                <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {tr(lang, 'Official Portal:', 'आधिकारिक पोर्टल:', 'अधिकृत पोर्टल:')}{' '}
                    <strong className="font-mono-tabular text-[#0B3B75]">{selectedScheme.officialPortalLabel}</strong>
                  </span>
                  <span className="font-mono-tabular">
                    {selectedScheme.lastVerifiedDate
                      ? `${tr(lang, 'Last verified:', 'अंतिम सत्यापन:', 'शेवटची पडताळणी:')} ${selectedScheme.lastVerifiedDate}`
                      : pickText(OFFICIAL_VERIFY_NOTE, lang)}
                  </span>
                </div>
              </dl>

              <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 flex items-start gap-2.5 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>{pickText(OFFICIAL_VERIFY_NOTE, lang)}</span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedScheme(null)}
                  className="px-4 py-2.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {tr(lang, 'Close', 'बंद करें', 'बंद करा')}
                </button>
                <a
                  href={selectedScheme.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#15803D] text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors"
                >
                  <span>
                    {tr(lang, 'Official Application Website', 'आधिकारिक आवेदन वेबसाइट', 'अधिकृत अर्ज वेबसाइट')}
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
