import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, ChevronDown, Globe, LogOut, Menu, Mic, Shield, UserCheck, UserPlus, X, Zap } from 'lucide-react';
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'ENGLISH' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'mr', label: 'मराठी' },
  ];

  const registerRoute: PageRoute = workerProfile
    ? 'worker-dashboard'
    : 'register-worker';

  const registerLabel = workerProfile
    ? t.nav.workerDashboard
    : lang === 'hi'
    ? 'पंजीकरण'
    : lang === 'mr'
    ? 'नोंदणी करा'
    : 'Register';

  const hireLabel =
    lang === 'hi' ? 'हायर करें' : lang === 'mr' ? 'हायर करा' : 'Hire';

  return (
    <>
      {/* 1. Top Institutional Utility & Accessibility Bar (MahaEGS Portal Style) */}
      <div className="bg-[#072A54] text-slate-100 border-b border-blue-950">
        <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
          <div className="bg-[#E06D1B]" />
          <div className="bg-white" />
          <div className="bg-[#15803D]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="#main-content"
              className="hidden md:inline-block text-blue-200 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              {lang === 'hi' ? 'मुख्य सामग्री पर जाएं' : lang === 'mr' ? 'मुख्य मजकुराकडे जा' : 'Skip to Main Content'}
            </a>
            <span className="hidden md:inline text-blue-400" aria-hidden="true">|</span>
            <p className="text-slate-200 font-medium truncate">
              {t.brand.disclaimerShort}
            </p>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Accessible Font Size Controls (A- / A / A+) */}
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

            <PWAInstallButton />

            {/* Mandatory 3-Language Switcher */}
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
                <span className="inline-flex items-center gap-1 font-medium truncate max-w-[130px]">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                  {user.displayName?.split(' ')[0] || user.email}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNav('admin')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-[#072A54] font-bold hover:bg-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Shield className="w-3 h-3" />
                    {t.nav.adminPanel}
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

      {/* 2. Institutional Portal Masthead Banner (Scrolls naturally like MahaEGS) */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-5 w-full md:w-auto min-w-0">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3B75] cursor-pointer shrink-0"
              aria-label="ROJGAR SETU Home"
            >
              <RojgarSetuLogo variant="horizontal" />
            </button>

            <div className="h-11 sm:h-14 w-px bg-slate-200 shrink-0" aria-hidden="true" />

            <figure className="flex items-center gap-2.5 shrink-0">
              <div className="w-11 h-14 sm:w-14 sm:h-[72px] rounded-md overflow-hidden border border-slate-300 bg-slate-100 p-0.5 shrink-0">
                <img
                  src={gandhiPortrait}
                  alt={
                    lang === 'hi'
                      ? 'महात्मा गांधी — श्रम की गरिमा एवं स्वावलंबन की प्रेरणा'
                      : lang === 'mr'
                      ? 'महात्मा गांधी — श्रमाची प्रतिष्ठा व स्वावलंबनाची प्रेरणा'
                      : 'Mahatma Gandhi — inspiration for dignity of labour and self-reliance'
                  }
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center rounded-sm"
                />
              </div>
              <figcaption className="hidden sm:block leading-tight">
                <div className="text-xs font-bold text-[#0B3B75]">
                  {lang === 'hi' ? 'महात्मा गांधी' : lang === 'mr' ? 'महात्मा गांधी' : 'Mahatma Gandhi'}
                </div>
                <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                  {lang === 'hi'
                    ? 'श्रम की गरिमा व स्वावलंबन'
                    : lang === 'mr'
                    ? 'श्रमाची प्रतिष्ठा व स्वावलंबन'
                    : 'Dignity of Labour'}
                </div>
              </figcaption>
            </figure>
          </div>

          <div className="hidden md:flex items-center gap-4 text-right shrink-0">
            <div>
              <p className="text-xs font-bold text-[#0B3B75] tracking-wide">
                ABUJMAD FOUNDATION
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {t.brand.supporting}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sticky Full-Width Deep Institutional Blue Navigation Strip */}
      <header className="sticky top-0 z-40 bg-[#0B3B75] text-white shadow-sm border-b-2 border-[#E06D1B]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-13 flex items-center justify-between gap-2 sm:gap-4">
          {/* Primary Portal Menu */}
          <nav className="hidden lg:flex items-center gap-0.5 text-[13px] font-semibold" aria-label="Primary Navigation">
            {(
              [
                { id: 'home', label: t.nav.home },
                { id: 'about', label: t.nav.about },
                { id: 'find-work', label: t.nav.findWork },
                { id: 'find-workers', label: t.nav.findWorkers },
                { id: 'skills-training', label: t.nav.skills },
                { id: 'partnerships', label: t.nav.partnerships },
              ] as { id: PageRoute; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`px-2.5 xl:px-3 py-3.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentRoute === item.id
                    ? 'bg-[#072A54] border-amber-400 text-amber-300'
                    : 'border-transparent text-white/95 hover:bg-[#072A54]/70 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}

            {/* More Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="inline-flex items-center gap-1 px-2.5 py-3.5 border-b-2 border-transparent text-white/95 hover:bg-[#072A54]/70 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.nav.more}
                <ChevronDown className="w-4 h-4" />
              </button>

              {moreOpen && (
                <div
                  className="absolute left-0 mt-0.5 w-64 rounded-b-md border border-slate-200 bg-white shadow-lg py-1.5 z-50 text-slate-800"
                  onMouseLeave={() => setMoreOpen(false)}
                >
                  {(
                    [
                      { id: 'hire', label: `${hireLabel} — ${lang === 'hi' ? 'तुरंत कामगार हायर करें' : lang === 'mr' ? 'तात्काळ कामगार हायर करा' : 'Instant Worker Hire'}` },
                      { id: 'transport', label: lang === 'hi' ? 'बाइक टैक्सी व लोकल ट्रांसपोर्ट (बिना ट्रक)' : lang === 'mr' ? 'बाईक टॅक्सी व लोकल ट्रान्सपोर्ट (ट्रक सोडून)' : 'Bike Taxi & Local Transport (No Trucks)' },
                      { id: 'register-worker', label: t.hero.ctaWorker },
                      { id: 'register-vehicle', label: lang === 'hi' ? 'बाइक टैक्सी / ऑटो / ट्रॉली / टेम्पो जोड़ें' : lang === 'mr' ? 'बाईक टॅक्सी / ऑटो / ट्रॉली / टेम्पो नोंदवा' : 'List Bike Taxi / Auto / Trolley / Tempo' },
                      { id: 'register-employer', label: t.nav.employerReg },
                      { id: 'post-job', label: t.jobs.postTitle },
                      { id: 'worker-dashboard', label: t.nav.workerDashboard },
                      { id: 'employer-dashboard', label: t.nav.employerDashboard },
                      { id: 'pricing', label: t.nav.pricing },
                      { id: 'trust-safety', label: t.nav.trustSafety },
                      { id: 'contact', label: t.nav.contact },
                      ...(isAdmin ? [{ id: 'admin' as PageRoute, label: t.nav.adminPanel }] : []),
                    ] as { id: PageRoute; label: string }[]
                  ).map((sub) => (
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

          {/* Mobile Title Marker inside sticky bar */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="lg:hidden inline-flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src="/icon.svg"
              alt="ROJGAR SETU"
              className="w-7 h-7 rounded border border-blue-400/40 shrink-0"
            />
            <span className="hidden min-[380px]:inline">{t.brand.name}</span>
          </button>

          {/* Right Immediate AI Voice + Register + Hire Action Pair & Mobile Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                title={lang === 'hi' ? 'बोलकर काम या गाड़ी खोजें' : lang === 'mr' ? 'बोलून काम / गाडी शोधा' : 'AI Voice Search'}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded border border-amber-400/80 bg-[#072A54] text-amber-300 text-[11px] sm:text-xs font-bold hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === 'hi' ? 'बोलकर खोजें' : lang === 'mr' ? 'AI आवाज' : 'AI Voice'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNav(registerRoute)}
              className={`inline-flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded border text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentRoute === registerRoute
                  ? 'bg-white text-[#0B3B75] border-white'
                  : 'bg-[#072A54] text-white border-blue-400/70 hover:bg-blue-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 hidden sm:inline" />
              <span>{registerLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('hire')}
              className={`inline-flex items-center justify-center gap-1 px-2.5 sm:px-4 py-1.5 rounded text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentRoute === 'hire'
                  ? 'bg-[#15803D] text-white ring-2 ring-white/80'
                  : 'bg-[#E06D1B] text-white hover:bg-[#c55b10]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{hireLabel}</span>
            </button>

            {employerProfile && (
              <button
                type="button"
                onClick={() => handleNav('employer-dashboard')}
                className="hidden xl:inline-flex items-center justify-center px-3 py-1.5 rounded border border-emerald-400/60 bg-emerald-800/40 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.nav.employerDashboard}
              </button>
            )}

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
                          {lang === 'hi'
                            ? 'सूचनाएं'
                            : lang === 'mr'
                            ? 'सूचना'
                            : 'Notifications'}{' '}
                          ({unreadCount} {lang === 'hi' ? 'अपठित' : lang === 'mr' ? 'न वाचलेल्या' : 'unread'})
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
                            {lang === 'hi' ? 'सभी पढ़ें' : lang === 'mr' ? 'सर्व वाचल्या' : 'Mark all read'}
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
                          {lang === 'hi'
                            ? 'अभी कोई सूचना नहीं है।'
                            : lang === 'mr'
                            ? 'अद्याप कोणतीही सूचना नाही.'
                            : 'No notifications yet.'}
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
                              {!item.read && (
                                <span className="w-2 h-2 rounded-full bg-[#E06D1B] shrink-0" />
                              )}
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
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded border border-blue-600 bg-[#072A54] text-white hover:bg-blue-900 cursor-pointer shrink-0"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-blue-900 bg-white text-slate-800 px-4 py-4 space-y-1 max-h-[75vh] overflow-y-auto">
            {(
              [
                { id: 'home', label: t.nav.home },
                { id: 'hire', label: `${hireLabel} — ${lang === 'hi' ? 'तुरंत कामगार हायर करें' : lang === 'mr' ? 'तात्काळ कामगार हायर करा' : 'Instant Worker Hire'}` },
                { id: 'transport', label: lang === 'hi' ? 'बाइक टैक्सी व लोकल ट्रांसपोर्ट (बिना ट्रक)' : lang === 'mr' ? 'बाईक टॅक्सी व लोकल ट्रान्सपोर्ट (ट्रक सोडून)' : 'Bike Taxi & Local Transport (No Trucks)' },
                { id: 'about', label: t.nav.about },
                { id: 'find-work', label: t.nav.findWork },
                { id: 'find-workers', label: t.nav.findWorkers },
                { id: 'skills-training', label: t.nav.skills },
                { id: 'register-worker', label: t.hero.ctaWorker },
                { id: 'register-vehicle', label: lang === 'hi' ? 'बाइक टैक्सी / ऑटो / ट्रॉली / टेम्पो जोड़ें' : lang === 'mr' ? 'बाईक टॅक्सी / ऑटो / ट्रॉली / टेम्पो नोंदवा' : 'List Bike Taxi / Auto / Trolley / Tempo' },
                { id: 'register-employer', label: t.nav.employerReg },
                { id: 'post-job', label: t.jobs.postTitle },
                { id: 'worker-dashboard', label: t.nav.workerDashboard },
                { id: 'employer-dashboard', label: t.nav.employerDashboard },
                { id: 'partnerships', label: t.nav.partnerships },
                { id: 'pricing', label: t.nav.pricing },
                { id: 'trust-safety', label: t.nav.trustSafety },
                { id: 'contact', label: t.nav.contact },
                ...(isAdmin ? [{ id: 'admin' as PageRoute, label: t.nav.adminPanel }] : []),
              ] as { id: PageRoute; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded text-sm font-medium cursor-pointer ${
                  currentRoute === item.id
                    ? 'bg-[#0B3B75] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-3 border-t border-slate-200">
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
