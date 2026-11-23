import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, Share2, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../i18n/LanguageContext';
import { getCanonicalAppUrl } from '../lib/appConfig';
import type { Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

interface PWAInstallButtonProps {
  variant?: 'compact' | 'header' | 'primary' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, platform, browser, install } = usePWAInstall();
  const { lang, t } = useLanguage();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const canonicalUrl = getCanonicalAppUrl();

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    if (!canonicalUrl) return;
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(false);
    }
  };

  if (isInstalled && (variant === 'compact' || variant === 'header')) {
    return (
      <span
        role="status"
        aria-label="APP INSTALLED"
        className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-400/70 bg-emerald-950/70 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-emerald-200 whitespace-nowrap shrink-0 ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        <span>APP INSTALLED</span>
      </span>
    );
  }

  if (isInstalled) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#15803D] ${className}`}
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          {tr(
            lang,
            'APP INSTALLED · ROJGAR SETU is ready on this device',
            'APP INSTALLED · ROJGAR SETU ऐप इस मोबाइल पर इंस्टॉल है',
            'APP INSTALLED · ROJGAR SETU ॲप या मोबाईलवर इन्स्टॉल आहे'
          )}
        </span>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          aria-label="Install App — ॲप इन्स्टॉल करा"
          className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-[#E06D1B] hover:bg-[#c55b10] px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-extrabold text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="tracking-tight">INSTALL APP</span>
          <span className="hidden xs:inline sm:inline text-amber-100 font-bold">· ॲप इन्स्टॉल करा</span>
        </button>
        {showGuide && renderInstallGuideModal()}
      </>
    );
  }

  const buttonLabel =
    variant === 'compact'
      ? 'INSTALL APP · ॲप इन्स्टॉल करा'
      : tr(
          lang,
          'INSTALL APP · ॲप इन्स्टॉल करा',
          'INSTALL APP · ॲप इन्स्टॉल करा',
          'INSTALL APP · ॲप इन्स्टॉल करा'
        );

  const buttonClasses =
    variant === 'compact'
      ? 'inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-[#E06D1B] px-2.5 py-1 text-xs font-extrabold text-white hover:bg-[#c55b10] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'card'
      ? 'w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#0B3B75] px-5 py-3 text-sm font-bold text-white hover:bg-[#072A54] transition-colors cursor-pointer min-h-[44px]'
      : 'inline-flex items-center justify-center gap-2 rounded-md bg-[#0B3B75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#072A54] transition-colors cursor-pointer min-h-[44px]';

  function renderInstallGuideModal() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-guide-title"
      >
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden text-slate-900">
          <div className="bg-[#0B3B75] text-white px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-300 shrink-0" />
              <h3 id="pwa-install-guide-title" className="font-display text-sm sm:text-base font-bold">
                INSTALL APP · ॲप इन्स्टॉल करा
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label={t.common.close}
              className="p-1 rounded hover:bg-blue-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <img
                src="/pwa-192x192.png"
                alt="ROJGAR SETU"
                className="w-12 h-12 rounded-lg border border-slate-200 shrink-0"
              />
              <div>
                <div className="font-display font-bold text-[#0B3B75]">ROJGAR SETU</div>
                <div className="text-xs text-slate-600">
                  {tr(
                    lang,
                    'Install directly to your Home Screen — fast, offline-ready, no Play Store needed.',
                    'बिना Play Store के सीधे अपने मोबाइल होम स्क्रीन पर इंस्टॉल करें।',
                    'Play Store शिवाय थेट तुमच्या मोबाईल होम स्क्रीनवर इन्स्टॉल करा.'
                  )}
                </div>
              </div>
            </div>

            {platform === 'ios' ? (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3.5 space-y-2 text-xs sm:text-sm text-slate-800">
                <div className="font-bold text-[#0B3B75] flex items-center gap-1.5">
                  <Share2 className="w-4 h-4" />
                  <span>iPhone / iPad (Safari): Share → Add to Home Screen</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                  <li>
                    {tr(
                      lang,
                      'Open this ROJGAR SETU website in Safari browser.',
                      'यह ROJGAR SETU लिंक Safari ब्राउज़र में खोलें।',
                      'ही ROJGAR SETU वेबसाईट Safari ब्राउझरमध्ये उघडा.'
                    )}
                  </li>
                  <li>
                    {tr(
                      lang,
                      'Tap the Share icon (square with up arrow) at the bottom toolbar.',
                      'नीचे दिख रहे Share आइकन पर टैप करें।',
                      'खालील Share चिन्हावर टॅप करा.'
                    )}
                  </li>
                  <li>
                    {tr(
                      lang,
                      'Tap "Add to Home Screen", then tap "Add" in the top-right corner.',
                      '"Add to Home Screen" चुनें और ऊपर "Add" दबाएं।',
                      '"Add to Home Screen" निवडा आणि वर "Add" वर टॅप करा.'
                    )}
                  </li>
                </ol>
              </div>
            ) : platform === 'android' ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3.5 space-y-2 text-xs sm:text-sm text-slate-800">
                <div className="font-bold text-[#15803D]">
                  {tr(
                    lang,
                    `Android (${browser === 'samsung' ? 'Samsung Internet' : browser === 'edge' ? 'Edge' : 'Chrome'}):`,
                    'Android मोबाइल (Chrome / ब्राउज़र) के लिए:',
                    'Android मोबाईल (Chrome / ब्राउझर) साठी:'
                  )}
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                  <li>
                    {tr(
                      lang,
                      'Tap the browser menu icon (⋮) in the top-right corner.',
                      'ब्राउज़र के ऊपर दाईं ओर मेनू (⋮) पर टैप करें।',
                      'ब्राउझरच्या वरच्या उजव्या कोपऱ्यातील मेनू (⋮) वर टॅप करा.'
                    )}
                  </li>
                  <li>
                    {tr(
                      lang,
                      'Tap "Install app" or "Add to Home Screen".',
                      '"Install app" या "Add to Home Screen" चुनें।',
                      '"Install app" किंवा "Add to Home Screen" निवडा.'
                    )}
                  </li>
                  <li>
                    {tr(
                      lang,
                      'Confirm Install to place ROJGAR SETU on your mobile Home Screen.',
                      'पुष्टि करें — ROJGAR SETU ऐप आपके होम स्क्रीन पर जुड़ जाएगा।',
                      'Install वर टॅप करा — ROJGAR SETU ॲप होम स्क्रीनवर येईल.'
                    )}
                  </li>
                </ol>
              </div>
            ) : (
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-800">
                <div className="font-bold text-[#0B3B75]">
                  {tr(
                    lang,
                    'Install on Android, iPhone & Desktop:',
                    'Android, iPhone और डेस्कटॉप पर इंस्टॉल करें:',
                    'Android, iPhone व डेस्कटॉपवर इन्स्टॉल करा:'
                  )}
                </div>
                <ul className="list-disc list-inside space-y-1 leading-relaxed">
                  <li>
                    <strong>Android Chrome:</strong> Menu (⋮) → Install app / Add to Home Screen
                  </li>
                  <li>
                    <strong>iPhone Safari:</strong> Share → Add to Home Screen
                  </li>
                  <li>
                    <strong>Desktop Chrome / Edge:</strong> Click the Install icon in the address bar
                  </li>
                </ul>
              </div>
            )}

            {canonicalUrl && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {tr(lang, 'Official App Link', 'आधिकारिक ऐप लिंक', 'अधिकृत ॲप लिंक')}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={canonicalUrl}
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded bg-slate-50 text-xs font-mono-tabular text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? tr(lang, 'Copied', 'कॉपी हुआ', 'कॉपी झाले') : tr(lang, 'Copy', 'कॉपी', 'कॉपी')}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-md bg-[#0B3B75] py-2.5 text-sm font-bold text-white hover:bg-[#072A54] transition-colors cursor-pointer"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={handleClick} className={`${buttonClasses} ${className}`}>
        <Download className={variant === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span>{buttonLabel}</span>
      </button>
      {showGuide && renderInstallGuideModal()}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-md"
    >
      <WifiOff className="w-4 h-4 text-amber-700" />
      <span>{t.common.offlineBanner}</span>
    </div>
  );
};
