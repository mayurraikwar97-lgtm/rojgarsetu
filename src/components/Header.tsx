import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Mic,
  Shield,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import type { AppNotificationRecord, Language, PageRoute } from '../types/domain';
import { PWAInstallButton } from './PWAControls';
import { RojgarSetuLogo } from './RojgarSetuLogo';
import gandhiPortrait from '../assets/images/gandhi_dignity_labour_1794635762419.jpg';

interface HeaderProps {
  currentRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  onOpenAiAssistant?: () => void;
  notifications?: AppNotificationRecord[];
  unreadCount?: number;
  onOpenNotification?: (item: AppNotificationRecord) => void;
  onMarkAllRead?: () => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  onNavigate,
  onOpenAiAssistant,
  notifications = [],
  unreadCount = 0,
  onOpenNotification,
  onMarkAllRead,
}) => {
  const { lang, setLang, t } = useLanguage();
  const { user, workerProfile, employerProfile, isAdmin, signInWithGoogle, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => {
    const size = fontScale === 'sm' ? '14px' : fontScale === 'lg' ? '18px' : '16px';
    document.documentElement.style.fontSize = size;
  }, [fontScale]);

  const handleNav = (route: PageRoute) => {
    onNavigate(route);
    setMobileOpen(false);
    setMoreOpen(false);
    setNotifOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'mr', label: 'मराठी' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'en', label: 'ENGLISH' },
  ];

  const primaryNavItems: { id: PageRoute; label: string; fullTitle: string }[] = [
    {
      id: 'home',
      label: tr(lang, 'Home', 'मुख्य पृष्ठ', 'मुख्य पृष्ठ'),
      fullTitle: tr(lang, 'Home', 'मुख्य पृष्ठ', 'मुख्य पृष्ठ'),
    },
    {
      id: 'about',
      label: tr(lang, 'About Us', 'हमारे बारे में', 'आमच्याबद्दल'),
      fullTitle: tr(lang, 'About Us', 'हमारे बारे में', 'आमच्याबद्दल'),
    },
    {
      id: 'find-work',
      label: tr(lang, 'Find Work', 'काम खोजें', 'काम शोधा'),
      fullTitle: tr(lang, 'Find Work', 'काम खोजें', 'काम शोधा'),
    },
    {
      id: 'find-workers',
      label: tr(lang, 'Find Workers', 'कामगार खोजें', 'कामगार शोधा'),
      fullTitle: tr(lang, 'Find Workers', 'कामगार खोजें', 'कामगार शोधा'),
    },
    {
      id: 'skills-training',
      label: tr(lang, 'Skills & Training', 'कौशल एवं प्रशिक्षण', 'कौशल्य व प्रशिक्षण'),
      fullTitle: tr(lang, 'Skills & Training', 'कौशल एवं प्रशिक्षण', 'कौशल्य व प्रशिक्षण'),
    },
    {
      id: 'partnerships',
      label: tr(lang, 'Partnerships', 'संस्थागत साझेदारी', 'संस्थागत भागीदारी'),
      fullTitle: tr(
        lang,
        'Government & Institutional Partnerships',
        'सरकारी एवं संस्थागत साझेदारी',
        'सरकारी व संस्थात्मक भागीदारी'
      ),
    },
    {
      id: 'govt-schemes',
      label: tr(lang, 'Govt Schemes', 'सरकारी योजनाएं', 'सरकारी योजना'),
      fullTitle: tr(lang, 'Government Schemes', 'सरकारी योजनाएं', 'सरकारी योजना'),
    },
    {
      id: 'for-unemployed',
      label: tr(lang, 'For Unemployed', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी'),
      fullTitle: tr(lang, 'For Unemployed', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी'),
    },
    {
      id: 'for-entrepreneurs',
      label: tr(lang, 'Entrepreneurs', 'उद्योजकों के लिए', 'उद्योजकांसाठी'),
      fullTitle: tr(lang, 'For Entrepreneurs', 'उद्योजकों के लिए', 'उद्योजकांसाठी'),
    },
  ];

  const moreDropdownItems: { id: PageRoute; label: string }[] = [
    {
      id: 'hire',
      label: tr(lang, 'Instant Service Booking (Hire)', 'तुरंत सेवा बुक करें (Hire)', 'तात्काळ सेवा बुक करा (Hire)'),
    },
    {
      id: 'employer-dashboard',
      label: tr(lang, 'My Orders (Customer Tracker)', 'मेरे ऑर्डर (ग्राहक ट्रैकर)', 'माझे ऑर्डर (ग्राहक ट्रॅकर)'),
    },
    {
      id: 'worker-dashboard',
      label: tr(lang, 'Worker Dashboard', 'कामगार डैशबोर्ड', 'कामगार डॅशबोर्ड'),
    },
    {
      id: 'transport',
      label: tr(lang, 'Bike Rider & Local Transport', 'बाइक राइडर व लोकल ट्रांसपोर्ट', 'बाईक रायडर व लोकल ट्रान्सपोर्ट'),
    },
    {
      id: 'register-worker',
      label: tr(lang, 'Worker Registration (₹250)', 'कामगार पंजीकरण (₹250)', 'कामगार नोंदणी (₹250)'),
    },
    {
      id: 'register-employer',
      label: tr(lang, 'Employer Registration', 'नियोक्ता पंजीकरण', 'नियोक्ता नोंदणी'),
    },
    {
      id: 'register-vehicle',
      label: tr(lang, 'Register Bike / Auto / Tempo', 'बाइक / ऑटो / टेम्पो पंजीकरण', 'बाईक / ऑटो / टेम्पो नोंदणी'),
    },
    {
      id: 'post-job',
      label: tr(lang, 'Post a Job Opening', 'काम / नौकरी पोस्ट करें', 'कामाची जाहिरात टाका'),
    },
    {
      id: 'advertise',
      label: tr(lang, 'Advertise With Rojgar Setu', 'रोजगार सेतु पर विज्ञापन दें', 'रोजगार सेतुवर जाहिरात करा'),
    },
    {
      id: 'pricing',
      label: tr(lang, 'Pricing & Transparency', 'शुल्क एवं पारदर्शिता', 'दर व पारदर्शकता'),
    },
    {
      id: 'trust-safety',
      label: tr(lang, 'Trust, Safety & Grievance Desk', 'सुरक्षा एवं शिकायत निवारण', 'सुरक्षा व तक्रार निवारण'),
    },
    {
      id: 'contact',
      label: tr(lang, 'Contact & Helpdesk', 'संपर्क एवं सहायता', 'संपर्क व मदत कक्ष'),
    },
    ...(isAdmin ? [{ id: 'admin' as PageRoute, label: t.nav.adminPanel }] : []),
  ];

  return (
    <>
      {/* 1. Top Indian Public-Service Utility & Accessibility Bar */}
      <div className="bg-[#072A54] text-slate-100 border-b border-blue-950">
        <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
          <div className="bg-[#E06D1B]" />
          <div className="bg-white" />
          <div className="bg-[#15803D]" />
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <a
              href="#main-content"
              className="hidden md:inline-block text-blue-200 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              {tr(lang, 'Skip to Main Content', 'मुख्य सामग्री पर जाएं', 'मुख्य मजकुराकडे जा')}
            </a>
            <span className="hidden md:inline text-blue-400" aria-hidden="true">|</span>
            <p className="text-slate-200 font-medium truncate">
              {tr(
                lang,
                'ABUJMAD FOUNDATION · Independent Public-Service Workforce Platform (Not a Government Portal)',
                'ABUJMAD FOUNDATION · स्वतंत्र जनसेवा रोजगार मंच (आधिकारिक सरकारी पोर्टल नहीं)',
                'ABUJMAD FOUNDATION · स्वतंत्र जनसेवा रोजगार मंच (अधिकृत शासकीय पोर्टल नाही)'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Font Size Controls */}
            <div
              className="hidden sm:inline-flex items-center rounded border border-blue-700 bg-[#0B3B75] p-0.5"
              role="group"
              aria-label="Text size adjustment"
            >
              {(
                [
                  { id: 'sm', label: 'A-' },
                  { id: 'md', label: 'A' },
                  { id: 'lg', label: 'A+' },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setFontScale(sz.id)}
                  className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                    fontScale === sz.id ? 'bg-white text-[#072A54]' : 'text-blue-100 hover:bg-blue-800'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            <div className="shrink-0">
              <PWAInstallButton variant="header" />
            </div>

            {/* 3-Language Switcher */}
            <div
              className="inline-flex items-center gap-0.5 bg-[#0B3B75] border border-blue-700 rounded p-0.5"
              role="group"
              aria-label="Language selector"
            >
              <Globe className="w-3.5 h-3.5 text-amber-300 ml-1 hidden sm:block" aria-hidden="true" />
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLang(item.code)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    lang === item.code
                      ? 'bg-[#E06D1B] text-white'
                      : 'text-blue-100 hover:bg-blue-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {user ? (
              <div className="hidden sm:flex items-center gap-2 text-slate-100">
                <span className="inline-flex items-center gap-1 font-medium truncate max-w-[115px]">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="truncate">{user.displayName?.split(' ')[0] || user.email}</span>
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNav('admin')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-[#072A54] font-bold hover:bg-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Shield className="w-3 h-3" />
                    {tr(lang, 'Admin', 'एडमिन', 'अ‍ॅडमिन')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 text-blue-100 hover:text-white font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t.nav.signOut}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded border border-blue-600 bg-[#0B3B75] text-white font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.nav.signIn}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Institutional Portal Masthead with Prominent ROJGAR SETU Logo & Clear Mahatma Gandhi Portrait */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo, Large Name & Slogans */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 sm:gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3B75] cursor-pointer min-w-0"
            aria-label="ROJGAR SETU Home"
          >
            <RojgarSetuLogo variant="icon" className="w-12 h-12 sm:w-16 sm:h-16 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-[#0B3B75] leading-none">
                  ROJGAR SETU
                </span>
                <span className="hidden sm:inline font-display text-sm sm:text-base font-bold text-[#C25E00]">
                  रोजगार सेतु
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-extrabold tracking-wide text-[#15803D] mt-1">
                EVERY HAND DESERVES AN OPPORTUNITY.
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
                श्रम की गरिमा • स्वावलंबन • रोजगार
              </p>
            </div>
          </button>

          {/* Clearly Visible, Dignified, Uncropped Mahatma Gandhi Portrait */}
          <figure className="flex items-center gap-3 shrink-0 pl-3 border-l border-slate-200">
            <div className="w-14 h-[72px] sm:w-[70px] sm:h-[90px] rounded-md overflow-hidden border border-slate-300 bg-[#F6F2EA] p-0.5 shrink-0 shadow-xs">
              <img
                src={gandhiPortrait}
                alt={tr(
                  lang,
                  'Mahatma Gandhi — inspiration for dignity of labour, self-reliance and employment',
                  'महात्मा गांधी — श्रम की गरिमा, स्वावलंबन एवं रोजगार की प्रेरणा',
                  'महात्मा गांधी — श्रमाची प्रतिष्ठा, स्वावलंबन व रोजगाराची प्रेरणा'
                )}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-sm"
              />
            </div>
            <figcaption className="hidden md:block leading-snug max-w-[190px]">
              <div className="font-display text-sm font-extrabold text-[#0B3B75]">
                {tr(lang, 'Mahatma Gandhi', 'महात्मा गांधी', 'महात्मा गांधी')}
              </div>
              <div className="text-xs font-semibold text-[#C25E00] mt-0.5">
                श्रम की गरिमा • स्वावलंबन • रोजगार
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                ABUJMAD FOUNDATION
              </div>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* 3. Sticky Full-Width Deep Navy Navigation Strip (All 10 Original Portal Sections) */}
      <header className="sticky top-0 z-40 bg-[#0B3B75] text-white shadow-sm border-b-2 border-[#E06D1B]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 h-12 flex items-center justify-between gap-2">
          {/* Desktop 10-Item Public-Service Navigation */}
          <nav
            className="hidden xl:flex items-center gap-0.5 text-[12px] font-semibold min-w-0"
            aria-label="Primary Navigation"
          >
            {primaryNavItems.map((item) => {
              const isActive =
                currentRoute === item.id ||
                (item.id === 'home' && currentRoute === 'hire');
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.fullTitle}
                  onClick={() => handleNav(item.id)}
                  className={`px-2 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#072A54] border-amber-400 text-amber-300'
                      : 'border-transparent text-white/95 hover:bg-[#072A54]/70 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* 10. अन्य / More Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="inline-flex items-center gap-1 px-2 py-3 border-b-2 border-transparent text-white/95 hover:bg-[#072A54]/70 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{tr(lang, 'More', 'अन्य', 'इतर')}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {moreOpen && (
                <div
                  className="absolute left-0 mt-0.5 w-64 rounded-b-md border border-slate-200 bg-white shadow-xl py-1.5 z-50 text-slate-800"
                  onMouseLeave={() => setMoreOpen(false)}
                >
                  {moreDropdownItems.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleNav(sub.id)}
                      className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer ${
                        currentRoute === sub.id ? 'text-[#0B3B75] bg-blue-50' : 'text-slate-700'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Compact Bar Title on < XL screens */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="xl:hidden inline-flex items-center gap-2 font-display text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img src="/icon.svg" alt="ROJGAR SETU" className="w-7 h-7 rounded border border-blue-400/40 shrink-0" />
            <span>ROJGAR SETU</span>
          </button>

          {/* Right Quick Actions: Voice Search, My Orders / Worker Shortcut, Hire CTA, Notifications, Mobile Menu */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                title={tr(lang, 'Voice Search', 'बोलकर खोजें', 'बोलून शोधा')}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-amber-400/70 bg-[#072A54] text-amber-300 text-[11px] font-bold hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline xl:hidden 2xl:inline">
                  {tr(lang, 'Voice', 'बोलें', 'आवाज')}
                </span>
              </button>
            )}

            {workerProfile && (
              <button
                type="button"
                onClick={() => handleNav('worker-dashboard')}
                className="hidden md:inline-flex items-center px-2.5 py-1.5 rounded border border-emerald-400/60 bg-emerald-800/40 text-white text-[11px] font-bold hover:bg-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {tr(lang, 'Worker App', 'कामगार ऐप', 'कामगार अ‍ॅप')}
              </button>
            )}

            {(employerProfile || user) && !workerProfile && (
              <button
                type="button"
                onClick={() => handleNav('employer-dashboard')}
                className="hidden md:inline-flex items-center px-2.5 py-1.5 rounded border border-blue-400/60 bg-[#072A54] text-white text-[11px] font-bold hover:bg-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {tr(lang, 'My Orders', 'मेरे ऑर्डर', 'माझे ऑर्डर')}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNav('hire')}
              className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentRoute === 'hire'
                  ? 'bg-[#15803D] text-white ring-2 ring-white/80'
                  : 'bg-[#E06D1B] text-white hover:bg-[#c55b10]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{tr(lang, 'Hire', 'हायर करें', 'हायर करा')}</span>
            </button>

            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  className="relative inline-flex items-center justify-center w-9 h-9 rounded border border-blue-400/70 bg-[#072A54] text-white hover:bg-blue-900 cursor-pointer shrink-0"
                >
                  <Bell className="w-4 h-4 text-amber-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E06D1B] text-white text-[10px] font-mono-tabular font-extrabold flex items-center justify-center border border-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#072A54] text-white flex items-center justify-between gap-2">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-300" />
                        <span>
                          {tr(lang, 'Notifications', 'सूचनाएं', 'सूचना')} ({unreadCount})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && onMarkAllRead && (
                          <button
                            type="button"
                            onClick={() => onMarkAllRead()}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-white cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {tr(lang, 'Mark all read', 'सभी पढ़ें', 'सर्व वाचल्या')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setNotifOpen(false)}
                          className="p-0.5 rounded hover:bg-blue-900 text-blue-200 cursor-pointer"
                          aria-label="Close notifications"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500 text-center">
                          {tr(lang, 'No notifications yet.', 'अभी कोई सूचना नहीं है।', 'अद्याप कोणतीही सूचना नाही.')}
                        </p>
                      ) : (
                        notifications.slice(0, 15).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              if (onOpenNotification) onOpenNotification(item);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer space-y-1 ${
                              !item.read ? 'bg-amber-50/70' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono-tabular font-bold uppercase text-[#C25E00]">
                                {item.dealStatus || item.eventType || item.category}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#0B3B75] text-white text-[10px] font-extrabold shrink-0">
                                OPEN
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#0B3B75] leading-snug">
                              {item.title}
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{item.body}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle Menu"
              aria-expanded={mobileOpen}
              className="xl:hidden inline-flex items-center justify-center w-9 h-9 rounded border border-blue-600 bg-[#072A54] text-white hover:bg-blue-900 cursor-pointer shrink-0"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Full Mobile / Tablet Navigation Drawer with All 10 Sections */}
        {mobileOpen && (
          <div className="xl:hidden border-t border-blue-900 bg-white text-slate-800 px-4 py-4 space-y-1 max-h-[75vh] overflow-y-auto shadow-xl">
            <p className="px-3 pb-1 text-[11px] font-bold text-[#C25E00]">
              {tr(lang, 'Portal Sections', 'मुख्य विभाग', 'मुख्य विभाग')}
            </p>
            {primaryNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded text-sm font-semibold cursor-pointer ${
                  currentRoute === item.id
                    ? 'bg-[#0B3B75] text-white'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                {item.fullTitle}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-slate-200">
              <p className="px-3 pb-1 text-[11px] font-bold text-[#15803D]">
                {tr(lang, 'Quick Services & Dashboards', 'त्वरित सेवाएं एवं डैशबोर्ड', 'तात्काळ सेवा व डॅशबोर्ड')}
              </p>
              {moreDropdownItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm font-medium cursor-pointer ${
                    currentRoute === item.id
                      ? 'bg-blue-50 text-[#0B3B75] font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200">
              {user ? (
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2.5 px-3 rounded border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  {t.nav.signOut} ({user.email})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-2.5 px-3 rounded bg-[#0B3B75] text-sm font-semibold text-white hover:bg-[#072A54] cursor-pointer"
                >
                  {t.nav.signIn}
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
