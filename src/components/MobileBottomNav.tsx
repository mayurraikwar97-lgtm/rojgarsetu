import React from 'react';
import { Briefcase, ClipboardList, Home, Landmark, Shield, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language, PageRoute } from '../types/domain';

interface MobileBottomNavProps {
  currentRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  activeCustomerOrdersCount?: number;
  activeWorkerAlertsCount?: number;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  onNavigate,
  activeCustomerOrdersCount = 0,
  activeWorkerAlertsCount = 0,
}) => {
  const { lang } = useLanguage();
  const { workerProfile, isAdmin } = useAuth();

  const items: Array<{
    key: string;
    route: PageRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    activeMatch: (r: PageRoute) => boolean;
  }> = [
    {
      key: 'home',
      route: 'home',
      label: tr(lang, 'Home', 'मुख्य', 'मुख्य'),
      icon: Home,
      activeMatch: (r) => r === 'home' || r === 'hire',
    },
    {
      key: 'orders',
      route: 'employer-dashboard',
      label: tr(lang, 'Orders', 'ऑर्डर', 'ऑर्डर्स'),
      icon: ClipboardList,
      badge: activeCustomerOrdersCount,
      activeMatch: (r) => r === 'employer-dashboard',
    },
    {
      key: 'worker',
      route: workerProfile ? 'worker-dashboard' : 'find-work',
      label: tr(lang, 'Worker', 'कामगार', 'कामगार'),
      icon: Briefcase,
      badge: activeWorkerAlertsCount,
      activeMatch: (r) => r === 'worker-dashboard' || r === 'find-work' || r === 'register-worker',
    },
    {
      key: 'schemes',
      route: 'govt-schemes',
      label: tr(lang, 'Schemes', 'योजनाएं', 'योजना'),
      icon: Landmark,
      activeMatch: (r) =>
        r === 'govt-schemes' || r === 'for-unemployed' || r === 'for-entrepreneurs',
    },
    {
      key: 'transport',
      route: isAdmin ? 'admin' : 'transport',
      label: isAdmin
        ? tr(lang, 'Admin', 'एडमिन', 'अॅडमिन')
        : tr(lang, 'Transport', 'गाड़ी', 'वाहन'),
      icon: isAdmin ? Shield : Truck,
      activeMatch: (r) => (isAdmin ? r === 'admin' : r === 'transport' || r === 'register-vehicle'),
    },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.activeMatch(currentRoute);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onNavigate(item.route);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition-colors cursor-pointer ${
                active ? 'text-[#0B3B75]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-5 h-[2.5px] rounded-b bg-[#E06D1B]" aria-hidden="true" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'text-[#E06D1B]' : 'text-slate-500'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#15803D] text-white text-[9px] font-extrabold font-mono-tabular flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[11px] leading-none ${active ? 'font-extrabold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
