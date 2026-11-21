import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Briefcase,
  Car,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  MapPin,
  Megaphone,
  Mic,
  Package,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  JobPosting,
  PageRoute,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
} from '../types/domain';
import { EmploymentMap } from './EmploymentMap';
import { PWAInstallButton } from './PWAControls';
import { ResilientImage } from './ResilientImage';
import heroIndiaWorkforceImg from '../assets/images/hero_india_workforce_1794635763585.jpg';
import gandhiDignityLabourImg from '../assets/images/gandhi_dignity_labour_1794635762419.jpg';
import skilledTradesIndiaImg from '../assets/images/skilled_trades_india_1794635764177.jpg';
import ruralAgricultureIndiaImg from '../assets/images/rural_agriculture_india_1794635764633.jpg';
import womenEnterpriseIndiaImg from '../assets/images/women_enterprise_india_1794635764453.jpg';

interface HomeViewProps {
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
  onOpenAiAssistant?: () => void;
  workers: PublicWorkerProfile[];
  employers: PublicEmployerProfile[];
  jobs: JobPosting[];
  announcements: PlatformAnnouncement[];
  totalApplicationsCount: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenAiAssistant,
  workers,
  employers,
  jobs,
  announcements,
  totalApplicationsCount,
}) => {
  const { lang, t } = useLanguage();
  const [catQuery, setCatQuery] = useState('');
  const [catGroup, setCatGroup] = useState<string>('all');

  const activeAnnouncements = useMemo(
    () => announcements.filter((a) => a.active),
    [announcements]
  );

  const openJobs = useMemo(
    () => jobs.filter((j) => j.status === 'open').slice(0, 5),
    [jobs]
  );

  const filteredCategories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return EMPLOYMENT_CATEGORIES.filter((c) => {
      if (catGroup !== 'all' && c.group !== catGroup) return false;
      if (!q) return true;
      return (
        c.en.toLowerCase().includes(q) ||
        c.hi.toLowerCase().includes(q) ||
        c.mr.toLowerCase().includes(q) ||
        c.skillsEn.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [catQuery, catGroup]);

  // Real platform statistics strictly derived from Firestore records (zero when empty)
  const impactStats = useMemo(() => {
    const activeWorkers = workers.filter((w) => w.availabilityStatus === 'available').length;
    const womenWorkers = workers.filter((w) => w.gender === 'female').length;
    const completedJobs = jobs.filter((j) => j.status === 'completed').length;
    const jobApplicationsSum = jobs.reduce((acc, j) => acc + (j.applicationsCount || 0), 0);

    const stateCounts: Record<string, number> = {};
    jobs.forEach((j) => {
      stateCounts[j.state] = (stateCounts[j.state] || 0) + 1;
    });

    const districtCounts: Record<string, number> = {};
    workers.forEach((w) => {
      const key = `${w.district}, ${w.state}`;
      districtCounts[key] = (districtCounts[key] || 0) + 1;
    });

    return {
      totalWorkers: workers.length,
      activeWorkers,
      totalEmployers: employers.length,
      totalJobs: jobs.length,
      applicationsCount: Math.max(totalApplicationsCount, jobApplicationsSum),
      completedJobs,
      womenWorkers,
      stateBreakdown: Object.entries(stateCounts).sort((a, b) => b[1] - a[1]),
      districtBreakdown: Object.entries(districtCounts).sort((a, b) => b[1] - a[1]),
    };
  }, [workers, employers, jobs, totalApplicationsCount]);

  const portalServices: {
    num: string;
    route: PageRoute;
    label: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      num: '01',
      route: 'register-worker',
      label: t.hero.ctaWorker,
      sub: t.hero.campaignNote,
      icon: UserPlus,
    },
    {
      num: '02',
      route: 'find-work',
      label: t.nav.findWork,
      sub: lang === 'hi' ? 'जिला और कौशल के अनुसार काम खोजें' : lang === 'mr' ? 'जिल्हा व कौशल्यानुसार काम शोधा' : 'Search opportunities by district & skill',
      icon: Search,
    },
    {
      num: '03',
      route: 'register-employer',
      label: t.nav.employerReg,
      sub: lang === 'hi' ? 'व्यवसाय, ठेकेदार एवं उद्योग पंजीकरण' : lang === 'mr' ? 'व्यवसाय, कंत्राटदार व उद्योग नोंदणी' : 'Register business, contractor or household',
      icon: Briefcase,
    },
    {
      num: '04',
      route: 'post-job',
      label: t.jobs.postTitle,
      sub: lang === 'hi' ? 'स्पष्ट वेतन शर्तों के साथ कामगार मांग पोस्ट करें' : lang === 'mr' ? 'स्पष्ट वेतनासह कामगारांची गरज नोंदवा' : 'Publish workforce demand with transparent wages',
      icon: FileCheck2,
    },
    {
      num: '05',
      route: 'skills-training',
      label: t.nav.skills,
      sub: lang === 'hi' ? 'सरकारी योजना जानकारी एवं व्यावसायिक प्रशिक्षण' : lang === 'mr' ? 'सरकारी योजना माहिती व व्यावसायिक प्रशिक्षण' : 'Govt scheme info & vocational training tracks',
      icon: GraduationCap,
    },
    {
      num: '06',
      route: 'trust-safety',
      label: t.trustSafety.tabs.grievance,
      sub: lang === 'hi' ? 'सुरक्षा, नीतियां एवं शिकायत निवारण कक्ष' : lang === 'mr' ? 'सुरक्षा, धोरणे व तक्रार निवारण केंद्र' : 'Policies, workplace safety & grievance desk',
      icon: ShieldAlert,
    },
  ];

  const announcementHeadline =
    activeAnnouncements.length > 0
      ? lang === 'hi'
        ? `${activeAnnouncements[0].titleHi}: ${activeAnnouncements[0].bodyHi}`
        : lang === 'mr'
        ? `${activeAnnouncements[0].titleMr}: ${activeAnnouncements[0].bodyMr}`
        : `${activeAnnouncements[0].titleEn}: ${activeAnnouncements[0].bodyEn}`
      : `${t.hero.campaignNote} · ${t.brand.disclaimerShort}`;

  return (
    <div className="bg-[#F4F6F9]">
      {/* Announcements / Circular Notice Bar (MahaEGS Updates Strip) */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-1.5 bg-[#0B3B75] text-white font-bold px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 self-start sm:self-auto">
            <Megaphone className="w-3.5 h-3.5 text-amber-300" />
            <span>{lang === 'hi' ? 'सूचना पट्ट' : lang === 'mr' ? 'महत्त्वाच्या सूचना' : 'Portal Notice'}</span>
          </div>
          <p className="text-slate-700 font-medium flex-1 truncate">{announcementHeadline}</p>
          <button
            type="button"
            onClick={() => onNavigate('find-work')}
            className="text-xs font-bold text-[#0B3B75] hover:text-[#E06D1B] whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            {t.nav.opportunities} →
          </button>
        </div>
      </div>

      {/* B. Hero Showcase Banner + Quick Citizen Portal Grid (MahaEGS Above-the-Fold Split) */}
      <section className="py-6 sm:py-8 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Showcase Banner */}
            <div className="lg:col-span-7 flex flex-col rounded-md overflow-hidden border border-slate-200 bg-[#072A54] text-white">
              <div className="relative h-56 sm:h-64 w-full">
                <ResilientImage
                  src={heroIndiaWorkforceImg}
                  alt={t.hero.imageCaption}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#072A54] via-[#072A54]/45 to-transparent" />
                <div className="absolute bottom-3 left-5 right-5">
                  <p className="text-xs font-semibold text-amber-300">
                    {t.brand.slogan}
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-[1.15] tracking-tight text-balance">
                    {t.hero.heading}
                  </h1>
                  <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
                    {t.hero.subheading}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('hire')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-[#E06D1B] text-white text-xs sm:text-sm font-bold hover:bg-[#c55b10] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      {lang === 'hi'
                        ? 'तुरंत हायर करें'
                        : lang === 'mr'
                        ? 'तात्काळ हायर करा'
                        : 'Hire Now'}
                    </button>
                    {onOpenAiAssistant && (
                      <button
                        type="button"
                        onClick={onOpenAiAssistant}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-[#15803D] text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        {lang === 'hi'
                          ? 'बोलकर काम / गाड़ी खोजें'
                          : lang === 'mr'
                          ? 'बोलून काम / गाडी शोधा'
                          : 'Speak to Find (AI)'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('register-worker')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-white text-[#0B3B75] text-xs sm:text-sm font-bold hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t.hero.ctaWorker}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <PWAInstallButton
                      variant="primary"
                      className="!bg-white/10 !border !border-white/30 !text-white hover:!bg-white/20 !py-2.5 !text-xs sm:!text-sm"
                    />
                  </div>
                  <p className="text-xs font-semibold text-emerald-300">
                    {t.hero.campaignNote}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Citizen & Workforce Quick-Service Portal Directory */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col">
              <div className="bg-[#0B3B75] px-5 py-3.5 flex items-center justify-between border-b-2 border-[#E06D1B]">
                <h2 className="font-display text-sm sm:text-base font-bold text-white">
                  {lang === 'hi'
                    ? 'नागरिक एवं कार्यबल सेवाएं'
                    : lang === 'mr'
                    ? 'नागरिक व कामगार ऑनलाइन सेवा'
                    : 'Citizen & Workforce Services'}
                </h2>
                <span className="text-xs font-mono-tabular text-amber-300 font-semibold">
                  01–06
                </span>
              </div>

              <div className="divide-y divide-slate-200 flex-1 flex flex-col justify-between">
                {portalServices.map((srv) => {
                  const Icon = srv.icon;
                  return (
                    <button
                      key={srv.route}
                      type="button"
                      onClick={() => onNavigate(srv.route)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-mono-tabular text-xs font-bold text-[#E06D1B] mt-0.5 shrink-0">
                          {srv.num}
                        </span>
                        <Icon className="w-4 h-4 text-[#0B3B75] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#0B3B75] group-hover:underline truncate">
                            {srv.label}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {srv.sub}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B3B75] shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 1-Tap Blinkit / Swiggy Style Quick Hire Trade Strip */}
          <div className="mt-6 bg-[#F4F6F9] border border-slate-200 rounded-md p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#E06D1B] shrink-0" />
                <h2 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
                  {lang === 'hi'
                    ? 'तुरंत कामगार चाहिए? एक टैप में चुनें और हायर करें'
                    : lang === 'mr'
                    ? 'कामगार हवा आहे? एका क्लिकवर निवडा आणि तात्काळ हायर करा'
                    : 'Need a worker fast? Tap a trade to hire immediately'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('hire')}
                className="text-xs font-bold text-[#E06D1B] hover:underline whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                {lang === 'hi' ? 'सभी कामगार देखें →' : lang === 'mr' ? 'सर्व कामगार पहा →' : 'Browse All Nearby →'}
              </button>
            </div>

            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              {[
                'Electricians',
                'Plumbers',
                'Carpenters',
                'Construction Workers',
                'Drivers',
                'Painters',
                'Technicians and Mechanics',
                'Helpers and General Labour',
                'Cooks and Kitchen Staff',
                'Housekeeping and Cleaning Staff',
              ].map((tradeEn) => {
                const cat = EMPLOYMENT_CATEGORIES.find((c) => c.en === tradeEn);
                if (!cat) return null;
                const label =
                  lang === 'hi'
                    ? cat.hi.split('/')[0].trim()
                    : lang === 'mr'
                    ? cat.mr.split('/')[0].trim()
                    : cat.en;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onNavigate('hire', cat.en)}
                    className="shrink-0 px-3.5 py-2 rounded bg-white border border-slate-300 hover:border-[#E06D1B] hover:bg-amber-50/40 text-xs font-bold text-[#0B3B75] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dedicated Local Transport & Bike Taxi Strip (Separate from Worker Hire, No Heavy Trucks) */}
          <div className="mt-4 bg-white border border-slate-200 rounded-md p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-[#15803D] shrink-0" />
                <h2 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
                  {lang === 'hi'
                    ? 'बाइक टैक्सी, ऑटो, कार व स्थानीय मालगाड़ी (ट्रक छोड़कर लोकल ट्रांसपोर्ट)'
                    : lang === 'mr'
                    ? 'बाईक टॅक्सी, ऑटो, कार व ट्रॉली / टेम्पो (ट्रक सोडून लोकल ट्रान्सपोर्ट)'
                    : 'Bike Taxi, Auto, Car & Local Goods Transport (No Heavy Trucks)'}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('register-vehicle')}
                  className="text-xs font-bold text-[#0B3B75] hover:underline whitespace-nowrap cursor-pointer"
                >
                  + {lang === 'hi' ? 'गाड़ी / बाइक जोड़ें' : lang === 'mr' ? 'गाडी / बाईक नोंदवा' : 'Register Vehicle'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('transport')}
                  className="text-xs font-bold text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {lang === 'hi' ? 'सभी वाहन बुक करें →' : lang === 'mr' ? 'सर्व वाहने पहा →' : 'Book Local Transport →'}
                </button>
              </div>
            </div>

            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              {[
                {
                  id: 'bike_taxi',
                  icon: 'bike',
                  en: 'Bike Taxi',
                  hi: 'बाइक टैक्सी',
                  mr: 'बाईक टॅक्सी',
                },
                {
                  id: 'auto_rickshaw',
                  icon: 'car',
                  en: 'Auto Rickshaw',
                  hi: 'ऑटो रिक्शा',
                  mr: 'ऑटो रिक्षा',
                },
                {
                  id: 'car_sedan',
                  icon: 'car',
                  en: 'Car / Taxi',
                  hi: 'कार / टैक्सी',
                  mr: 'कार / टॅक्सी',
                },
                {
                  id: 'suv_innova',
                  icon: 'car',
                  en: 'SUV / 7-Seater',
                  hi: 'SUV / 7-सीटर',
                  mr: 'SUV / 7-सीटर',
                },
                {
                  id: 'trolley_cart',
                  icon: 'goods',
                  en: 'Local Trolley / Loader',
                  hi: 'ट्रॉली / ई-लोडर',
                  mr: 'लोकल ट्रॉली / ई-लोडर',
                },
                {
                  id: 'mini_tempo',
                  icon: 'goods',
                  en: 'Chhota Hathi / Mini Tempo',
                  hi: 'छोटा हाथी / मिनी टेम्पो',
                  mr: 'छोटा हत्ती / छोटी गाडी',
                },
                {
                  id: 'pickup_tempo',
                  icon: 'goods',
                  en: 'Pickup / 407 Local',
                  hi: 'पिकअप / 407 (छोटी-मध्यम)',
                  mr: 'पिकअप / ४०७ मोठी गाडी',
                },
                {
                  id: 'tractor',
                  icon: 'goods',
                  en: 'Tractor Trolley',
                  hi: 'ट्रैक्टर ट्रॉली',
                  mr: 'ट्रॅक्टर ट्रॉली',
                },
              ].map((item) => {
                const label = lang === 'hi' ? item.hi : lang === 'mr' ? item.mr : item.en;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate('transport', item.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      item.icon === 'goods'
                        ? 'bg-emerald-50/70 border-emerald-200 text-[#15803D] hover:bg-emerald-100/70'
                        : 'bg-blue-50/60 border-blue-200 text-[#0B3B75] hover:bg-blue-100/70'
                    }`}
                  >
                    {item.icon === 'bike' ? (
                      <Bike className="w-3.5 h-3.5 text-[#E06D1B]" />
                    ) : item.icon === 'goods' ? (
                      <Package className="w-3.5 h-3.5 text-[#15803D]" />
                    ) : (
                      <Car className="w-3.5 h-3.5 text-[#0B3B75]" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* K. Prominent Platform Dashboard Strip (MahaEGS "विभागाचा डॅशबोर्ड" Placement — Real Counts Only) */}
      <section className="py-10 bg-[#F4F6F9] border-b border-slate-200" id="impact-dashboard">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-3 border-b border-slate-300">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B3B75]">
                {t.impact.heading}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">{t.impact.subheading}</p>
            </div>
            <p className="text-xs font-medium text-slate-600 max-w-md md:text-right">
              {t.impact.launchNotice}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
            {[
              { label: t.impact.metrics.workers, value: impactStats.totalWorkers, border: 'border-t-[#0B3B75]' },
              { label: t.impact.metrics.activeWorkers, value: impactStats.activeWorkers, border: 'border-t-[#15803D]' },
              { label: t.impact.metrics.employers, value: impactStats.totalEmployers, border: 'border-t-[#E06D1B]' },
              { label: t.impact.metrics.jobsPosted, value: impactStats.totalJobs, border: 'border-t-[#0B3B75]' },
              { label: t.impact.metrics.applications, value: impactStats.applicationsCount, border: 'border-t-[#E06D1B]' },
              { label: t.impact.metrics.completed, value: impactStats.completedJobs, border: 'border-t-[#15803D]' },
              { label: t.impact.metrics.womenWorkers, value: impactStats.womenWorkers, border: 'border-t-[#0B3B75]' },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`bg-white border border-slate-200 border-t-2 ${stat.border} rounded-md p-4`}
              >
                <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75]">
                  {stat.value.toLocaleString('en-IN')}
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-600 leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* C & Dignity Section: Institutional Mission & Mahatma Gandhi Tribute */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Dignity of Labour Archival Card */}
          <div className="lg:col-span-4 bg-[#F4F6F9] border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-[#0B3B75] px-4 py-2.5 text-xs font-bold text-white">
              {t.dignitySection.kicker}
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded overflow-hidden border border-slate-200 aspect-[3/4] max-w-[230px] mx-auto">
                <ResilientImage
                  src={gandhiDignityLabourImg}
                  alt="Archival portrait symbolizing dignity of labour and self-reliance"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-display text-base font-bold text-[#0B3B75] leading-snug">
                {t.dignitySection.heading}
              </h2>
              <blockquote className="text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded p-3.5 leading-relaxed">
                “{t.dignitySection.quote}”
              </blockquote>
              <p className="text-xs text-slate-600 leading-relaxed">{t.dignitySection.body}</p>
              <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-2.5">
                {t.dignitySection.attributionNote}
              </p>
            </div>
          </div>

          {/* 8 Mission Pillars */}
          <div className="lg:col-span-8 space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75] text-balance">
                {t.mission.heading}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                {t.mission.intro}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {t.mission.points.map((pt, idx) => (
                <div
                  key={pt.title}
                  className="border border-slate-200 rounded-md p-4 bg-[#F4F6F9]/60 space-y-1.5"
                >
                  <span className="text-xs font-mono-tabular font-bold text-[#E06D1B]">
                    0{idx + 1}.
                  </span>
                  <h3 className="font-display text-sm font-bold text-[#0B3B75]">{pt.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{pt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* D. Employment Categories — A to Z */}
      <section className="py-12 bg-[#F4F6F9] border-b border-slate-200" id="categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-[#0B3B75] px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#E06D1B]">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t.categories.heading}
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                  {t.categories.subheading}
                </p>
              </div>
              <div className="w-full lg:w-80 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="search"
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder={t.categories.searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Group Filter Tabs */}
              <div className="flex flex-wrap gap-1.5" role="tablist">
                <button
                  type="button"
                  onClick={() => setCatGroup('all')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    catGroup === 'all'
                      ? 'bg-[#0B3B75] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.categories.allGroups} (32)
                </button>
                {Object.entries(t.categories.groups).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCatGroup(key)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      catGroup === key
                        ? 'bg-[#0B3B75] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filteredCategories.length === 0 ? (
                <div className="border border-slate-200 rounded p-8 text-center text-slate-600 text-sm">
                  {t.categories.noResults}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {filteredCategories.map((cat) => {
                    const title = lang === 'hi' ? cat.hi : lang === 'mr' ? cat.mr : cat.en;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => onNavigate('find-work', cat.en)}
                        className="text-left bg-[#F4F6F9]/60 border border-slate-200 rounded p-4 hover:border-[#0B3B75] hover:bg-blue-50/40 transition-colors flex flex-col justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="font-mono-tabular font-bold text-[#0B3B75]">
                              {String(cat.index).padStart(2, '0')}
                            </span>
                            <span className="truncate ml-2">{t.categories.groups[cat.group]}</span>
                          </div>
                          <h3 className="font-display text-sm font-bold text-[#0B3B75] leading-snug">
                            {title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                            {cat.skillsEn.join(' · ')}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-[#C25E00] inline-flex items-center gap-1 pt-1">
                          {t.categories.exploreAction}
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* E. How ROJGAR SETU Works + Live Job Feed */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B3B75]">{t.howItWorks.heading}</h2>
            <p className="mt-1 text-sm text-slate-600">{t.howItWorks.subheading}</p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {t.howItWorks.steps.map((s) => (
                <div
                  key={s.step}
                  className="border border-slate-200 border-t-2 border-t-[#E06D1B] rounded-md p-5 bg-[#F4F6F9]/50 space-y-2"
                >
                  <div className="font-mono-tabular text-xl font-extrabold text-[#0B3B75]">{s.step}</div>
                  <h3 className="font-display text-base font-bold text-[#0B3B75]">{s.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* F & G. Worker & Employer Portal Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* For Workers Panel */}
            <div className="border border-slate-200 rounded-md overflow-hidden flex flex-col bg-white">
              <div className="bg-[#0B3B75] px-5 py-3.5 text-white font-display font-bold text-base">
                {t.forWorkers.heading}
              </div>
              <div className="h-48 w-full">
                <ResilientImage
                  src={skilledTradesIndiaImg}
                  alt={t.forWorkers.heading}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.forWorkers.subheading}</p>
                  <ul className="mt-4 space-y-2">
                    {t.forWorkers.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('register-worker')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#0B3B75] text-white text-xs sm:text-sm font-bold hover:bg-[#072A54] transition-colors cursor-pointer"
                >
                  {t.forWorkers.cta}
                </button>
              </div>
            </div>

            {/* For Employers Panel */}
            <div className="border border-slate-200 rounded-md overflow-hidden flex flex-col bg-white">
              <div className="bg-[#15803D] px-5 py-3.5 text-white font-display font-bold text-base">
                {t.forEmployers.heading}
              </div>
              <div className="h-48 w-full">
                <ResilientImage
                  src={ruralAgricultureIndiaImg}
                  alt={t.forEmployers.heading}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.forEmployers.subheading}</p>
                  <ul className="mt-4 space-y-2">
                    {t.forEmployers.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <Briefcase className="w-4 h-4 text-[#E06D1B] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('register-employer')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#E06D1B] text-white text-xs sm:text-sm font-bold hover:bg-[#c55b10] transition-colors cursor-pointer"
                >
                  {t.forEmployers.cta}
                </button>
              </div>
            </div>
          </div>

          {/* Live Open Job Postings Directory */}
          <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
            <div className="bg-[#0B3B75] px-5 py-3 flex items-center justify-between text-white">
              <h2 className="font-display text-base font-bold">{t.nav.opportunities}</h2>
              <button
                type="button"
                onClick={() => onNavigate('find-work')}
                className="text-xs font-semibold text-amber-300 hover:underline cursor-pointer"
              >
                {t.nav.findWork} →
              </button>
            </div>
            {openJobs.length === 0 ? (
              <div className="p-6 text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>{t.jobs.noJobs}</span>
                <button
                  type="button"
                  onClick={() => onNavigate('post-job')}
                  className="px-4 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.jobs.postTitle}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {openJobs.map((job) => (
                  <div key={job.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">
                        {job.category} · {job.district}, {job.state}
                      </p>
                      <h3 className="text-sm font-bold text-[#0B3B75]">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono-tabular text-xs font-bold text-[#15803D]">
                        ₹{job.offeredWage.toLocaleString('en-IN')} / {job.wageUnit}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('find-work', job.category)}
                        className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-semibold cursor-pointer"
                      >
                        {t.jobs.applyBtn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* H. Location-Based Employment Map + State/District Tables */}
      <EmploymentMap jobs={jobs} workers={workers} onNavigate={onNavigate} />

      <section className="py-10 bg-[#F4F6F9] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-[#0B3B75] px-4 py-2.5 flex items-center justify-between text-white text-sm font-bold">
              <span>{t.impact.stateDistribution}</span>
              <MapPin className="w-4 h-4 text-amber-300" />
            </div>
            <div className="p-4">
              {impactStats.stateBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">{t.impact.noDataYet}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {impactStats.stateBreakdown.map(([st, count]) => (
                    <div key={st} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-slate-700">{st}</span>
                      <span className="font-mono-tabular font-bold text-[#0B3B75]">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-[#15803D] px-4 py-2.5 flex items-center justify-between text-white text-sm font-bold">
              <span>{t.impact.districtDistribution}</span>
              <Users className="w-4 h-4 text-emerald-200" />
            </div>
            <div className="p-4">
              {impactStats.districtBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">{t.impact.noDataYet}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {impactStats.districtBreakdown.map(([dist, count]) => (
                    <div key={dist} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-slate-700">{dist}</span>
                      <span className="font-mono-tabular font-bold text-[#15803D]">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* I. Women & Inclusive Employment */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5">
            <div className="rounded-md overflow-hidden border border-slate-200 h-full min-h-[260px]">
              <ResilientImage
                src={womenEnterpriseIndiaImg}
                alt={t.womenInclusive.heading}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0B3B75] text-balance">
                {t.womenInclusive.heading}
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                {t.womenInclusive.subheading}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {t.womenInclusive.cards.map((c) => (
                <div key={c.title} className="border border-slate-200 rounded-md p-4 bg-[#F4F6F9]/60">
                  <h3 className="font-display text-sm font-bold text-[#0B3B75]">{c.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* J. Skills & Training + Institutional Useful Links Directory */}
      <section className="py-12 bg-[#F4F6F9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0B3B75]">
                {t.skillsTraining.heading}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{t.skillsTraining.subheading}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('skills-training')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              {t.nav.skills}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {t.skillsTraining.items.slice(0, 3).map((item) => (
              <div
                key={item.title}
                className="bg-white border border-slate-200 border-t-2 border-t-[#15803D] rounded-md p-5 space-y-2"
              >
                <p className="text-xs font-semibold text-[#15803D]">{item.badge}</p>
                <h3 className="font-display text-base font-bold text-[#0B3B75]">{item.title}</h3>
                <p className="text-xs text-slate-500">{item.org}</p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Useful Institutional Links Box (MahaEGS "उपयुक्त दुवे" Style) */}
          <div className="bg-white border border-slate-200 rounded-md p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#0B3B75] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-sm font-bold text-[#0B3B75]">
                  {lang === 'hi' ? 'महत्वपूर्ण एवं संस्थागत लिंक' : lang === 'mr' ? 'उपयुक्त व संस्थात्मक दुवे' : 'Institutional & Governance Links'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{t.partnerships.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('partnerships')}
                className="px-3.5 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer"
              >
                {t.nav.partnerships}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="px-3.5 py-2 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                {t.nav.pricing}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('trust-safety')}
                className="px-3.5 py-2 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                {t.nav.trustSafety}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
