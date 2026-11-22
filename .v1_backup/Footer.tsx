import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { PageRoute } from '../types/domain';
import { RojgarSetuLogo } from './RojgarSetuLogo';

interface FooterProps {
  onNavigate: (route: PageRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { lang, t } = useLanguage();

  const go = (route: PageRoute) => {
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#072A54] text-slate-200 border-t-4 border-[#E06D1B] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-blue-900">
          {/* Column 1: Initiative Identity */}
          <div className="space-y-3">
            <RojgarSetuLogo variant="horizontal" inverted className="max-w-full scale-[0.86] origin-left" />
            <p className="text-sm font-semibold text-amber-300">{t.brand.slogan}</p>
            <p className="text-xs text-blue-100 leading-relaxed">{t.brand.initiativeLine}</p>
            <p className="text-xs text-blue-200/80 leading-relaxed">{t.brand.dignityLine}</p>
          </div>

          {/* Column 2: Citizen & Workforce Services */}
          <div>
            <h3 className="font-display text-sm font-bold text-white pb-2 mb-3 border-b border-blue-800">
              {t.nav.opportunities}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-blue-100">
              <li>
                <button type="button" onClick={() => go('register-worker')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.hero.ctaWorker}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('register-employer')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.employerReg}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('find-work')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.findWork}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('find-workers')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.findWorkers}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('skills-training')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.skills}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Policies & Useful Links */}
          <div>
            <h3 className="font-display text-sm font-bold text-white pb-2 mb-3 border-b border-blue-800">
              {t.nav.trustSafety}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-blue-100">
              <li>
                <button type="button" onClick={() => go('about')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.about}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('partnerships')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.partnerships}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('pricing')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.nav.pricing}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('trust-safety')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.trustSafety.tabs.privacy} & {t.trustSafety.tabs.terms}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('trust-safety')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  {t.trustSafety.tabs.grievance}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Helpdesk & Organisation */}
          <div className="space-y-2.5 text-xs sm:text-sm text-blue-100">
            <h3 className="font-display text-sm font-bold text-white pb-2 mb-3 border-b border-blue-800">
              {t.nav.contact}
            </h3>
            <p className="font-semibold text-white">ABUJMAD FOUNDATION</p>
            <p className="text-xs text-blue-200/80">{t.about.toBeConfirmed}</p>
            <p className="text-xs text-blue-200/80">{t.contact.supportNote}</p>
            <button
              type="button"
              onClick={() => go('contact')}
              className="inline-block text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4 cursor-pointer pt-1"
            >
              {t.nav.contact}
            </button>
          </div>
        </div>

        {/* Bottom Portal Disclaimer */}
        <div className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-blue-200/90">
          <p className="max-w-3xl leading-relaxed">
            <strong className="text-white">
              {lang === 'hi' ? 'अस्वीकरण:' : lang === 'mr' ? 'अस्वीकरण:' : 'Disclaimer:'}
            </strong>{' '}
            ROJGAR SETU is a private social-impact employment initiative proposed under ABUJMAD FOUNDATION. It is NOT an official government portal, government department, or government-endorsed service.
          </p>
          <p className="whitespace-nowrap shrink-0 text-blue-100">
            © {new Date().getFullYear()} ROJGAR SETU · ABUJMAD FOUNDATION
          </p>
        </div>
      </div>
    </footer>
  );
};
