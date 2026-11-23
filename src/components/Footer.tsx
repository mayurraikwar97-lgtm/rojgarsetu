import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  BRAND_MESSAGE_MR,
  BRAND_SLOGAN_MR,
  BRAND_TAGLINE_MR,
} from '../lib/customerPrivacy';
import type { Language, PageRoute } from '../types/domain';
import { RojgarSetuLogo } from './RojgarSetuLogo';

interface FooterProps {
  onNavigate: (route: PageRoute) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();

  const go = (route: PageRoute) => {
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#072A54] text-slate-200 pb-20 md:pb-8 border-t border-blue-950">
      <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
        <div className="bg-[#E06D1B]" />
        <div className="bg-white" />
        <div className="bg-[#15803D]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <RojgarSetuLogo variant="icon" className="w-11 h-11 shrink-0 rounded-md bg-white p-0.5" />
              <div>
                <div className="font-display font-extrabold text-base text-white tracking-tight">
                  ROJGAR SETU
                </div>
                <div className="text-[11px] font-bold text-amber-300">
                  {tr(lang, 'Employment & Workforce Network', 'रोजगार सेतु', 'रोजगार सेतु')}
                </div>
              </div>
            </div>
            <p className="font-display text-sm font-extrabold text-amber-300">
              “{BRAND_SLOGAN_MR}”
            </p>
            <p className="text-xs font-bold text-white">
              {BRAND_TAGLINE_MR}
            </p>
            <p className="text-xs font-bold text-emerald-300">
              {BRAND_MESSAGE_MR}
            </p>
            <p className="text-xs text-blue-100/90 leading-relaxed">
              श्रम की गरिमा • स्वावलंबन • रोजगार
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {tr(
                lang,
                'An independent public-service employment, skill awareness, and local workforce connectivity platform for India.',
                'भारत के कामगारों, बेरोजगार युवाओं, महिलाओं और छोटे उद्योजकों के लिए एक स्वतंत्र जनसेवा रोजगार एवं कौशल मार्गदर्शन मंच।',
                'भारतातील कामगार, बेरोजगार युवक, महिला आणि लघु उद्योजकांसाठी स्वतंत्र जनसेवा रोजगार व कौशल्य मार्गदर्शन मंच.'
              )}
            </p>
          </div>

          {/* Portal Sections */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-white">
              {tr(lang, 'Employment & Services', 'रोजगार एवं सेवाएं', 'रोजगार व सेवा')}
            </h3>
            <ul className="space-y-2 text-xs text-blue-100">
              <li>
                <button type="button" onClick={() => go('hire')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Book Local Service (Hire)', 'तुरंत सेवा बुक करें', 'तात्काळ सेवा बुक करा')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('find-work')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Find Work / Worker App', 'काम खोजें / कामगार ऐप', 'काम शोधा / कामगार अ‍ॅप')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('find-workers')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Find Local Workers', 'कामगार खोजें', 'कामगार शोधा')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('transport')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Bike Rider & Local Transport', 'बाइक राइडर व लोकल ट्रांसपोर्ट', 'बाईक रायडर व लोकल ट्रान्सपोर्ट')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('register-worker')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Free Worker Registration', 'निःशुल्क कामगार पंजीकरण', 'मोफत कामगार नोंदणी')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('register-employer')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Employer Registration', 'नियोक्ता पंजीकरण', 'नियोक्ता नोंदणी')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('advertise')} className="hover:text-amber-300 font-semibold text-amber-200 cursor-pointer">
                  {tr(lang, 'Advertise With ROJGAR SETU', 'रोजगार सेतु पर विज्ञापन दें', 'रोजगार सेतुवर जाहिरात करा')}
                </button>
              </li>
            </ul>
          </div>

          {/* Government Schemes & Guidance */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-white">
              {tr(lang, 'Schemes & Skill Guidance', 'सरकारी योजनाएं एवं कौशल', 'सरकारी योजना व कौशल्य')}
            </h3>
            <ul className="space-y-2 text-xs text-blue-100">
              <li>
                <button type="button" onClick={() => go('govt-schemes')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Government Schemes Information', 'सरकारी योजनाएं एवं रोजगार मार्गदर्शन', 'सरकारी योजना व मार्गदर्शन')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('for-unemployed')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'For Unemployed Youth', 'बेरोजगारों के लिए', 'बेरोजगारांसाठी')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('for-entrepreneurs')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'For Entrepreneurs & MSME', 'उद्योजकों के लिए', 'उद्योजकांसाठी')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('skills-training')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Skills & Training Programmes', 'कौशल एवं प्रशिक्षण', 'कौशल्य व प्रशिक्षण')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('partnerships')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Government & Institutional Partnerships', 'सरकारी एवं संस्थागत साझेदारी', 'सरकारी व संस्थात्मक भागीदारी')}
                </button>
              </li>
            </ul>
          </div>

          {/* Governance & Support */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-white">
              {tr(lang, 'About & Support', 'परिचय एवं सहायता', 'परिचय व मदत')}
            </h3>
            <ul className="space-y-2 text-xs text-blue-100">
              <li>
                <button type="button" onClick={() => go('about')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'About ROJGAR SETU', 'हमारे बारे में', 'आमच्याबद्दल')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('pricing')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Pricing & Transparency Policy', 'शुल्क एवं पारदर्शिता नीति', 'दर व पारदर्शकता धोरण')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('trust-safety')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Trust, Safety & Grievance Redressal', 'सुरक्षा एवं शिकायत निवारण', 'सुरक्षा व तक्रार निवारण')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('contact')} className="hover:text-amber-300 cursor-pointer">
                  {tr(lang, 'Contact & Helpdesk', 'संपर्क एवं सहायता कक्ष', 'संपर्क व मदत कक्ष')}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Public-Service Disclaimer & Copyright */}
        <div className="pt-6 border-t border-blue-900 space-y-2 text-[11px] text-blue-200/90">
          <p className="leading-relaxed">
            {tr(
              lang,
              'Disclaimer: ROJGAR SETU is an independent public-service employment platform. It is NOT an official Government of India or Government of Maharashtra portal. Government scheme links direct users strictly to authentic official portals for public awareness.',
              'अस्वीकरण: रोजगार सेतु एक स्वतंत्र जनसेवा रोजगार मंच है। यह भारत सरकार या महाराष्ट्र शासन का आधिकारिक पोर्टल नहीं है। सरकारी योजनाओं के लिंक जन-जागरूकता हेतु केवल प्रामाणिक आधिकारिक सरकारी पोर्टलों पर जाते हैं।',
              'अस्वीकरण: रोजगार सेतु हा एक स्वतंत्र जनसेवा रोजगार मंच आहे. हे भारत सरकार किंवा महाराष्ट्र शासनाचे अधिकृत संकेतस्थळ नाही. सरकारी योजनांचे दुवे जन-जागृतीसाठी केवळ अधिकृत शासकीय पोर्टल्सवर नेतात.'
            )}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-slate-300">
            <span>© {new Date().getFullYear()} ROJGAR SETU</span>
            <span>
              {tr(
                lang,
                'Maps powered by Google Maps Platform. Exact customer address is shared only after worker confirmation.',
                'मैप्स Google Maps Platform द्वारा संचालित। सटीक पता केवल कामगार कन्फर्म होने के बाद साझा होता है।',
                'नकाशे Google Maps Platform द्वारे. अचूक पत्ता कामगार निश्चित झाल्यानंतरच शेअर होतो.'
              )}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
