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
  variant?: 'compact' | 'primary' | 'card';
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

  if (isInstalled && variant === 'compact') {
    return null;
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
            'ROJGAR SETU App Installed on This Device',
            'ROJGAR SETU ऐप इस मोबाइल पर इंस्टॉल है',
            'ROJGAR SETU अ‍ॅप या मोबाईलवर इन्स्टॉल आहे'
          )}
        </span>
      </div>
    );
  }

  const buttonLabel =
    variant === 'compact'
      ? tr(lang, 'Install App', 'ऐप इंस्टॉल', 'अ‍ॅप इन्स्टॉल')
      : tr(
          lang,
          '📲 Install ROJGAR SETU App',
          '📲 Install ROJGAR SETU App',
          '📲 Install ROJGAR SETU App'
        );

  const buttonClasses =
    variant === 'compact'
      ? 'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'card'
      ? 'w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#0B3B75] px-5 py-3 text-sm font-bold text-white hover:bg-[#072A54] transition-colors cursor-pointer min-h-[44px]'
      : 'inline-flex items-center justify-center gap-2 rounded-md bg-[#0B3B75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#072A54] transition-colors cursor-pointer min-h-[44px]';

  return (
    <>
      <button type="button" onClick={handleClick} className={`${buttonClasses} ${className}`}>
        <Download className={variant === 'compact' ? 'w-3.5 h-3.5 text-[#0B3B75]' : 'w-4 h-4'} />
        <span>{buttonLabel}</span>
      </button>

      {showGuide && (
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
                  📲 Install ROJGAR SETU App
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
                      'Install directly to your Home Screen — no Play Store download needed.',
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
                    {tr(lang, 'For iPhone / iPad (Safari):', 'iPhone / iPad (Safari) के लिए:', 'iPhone / iPad (Safari) साठी:')}
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                    <li>
                      {tr(
                        lang,
                        'Open this ROJGAR SETU link in Safari browser.',
                        'यह ROJGAR SETU लिंक Safari ब्राउज़र में खोलें।',
                        'ही ROJGAR SETU लिंक Safari ब्राउझरमध्ये उघडा.'
                      )}
                    </li>
                    <li>
                      {tr(
                        lang,
                        'Tap the Share icon at the bottom or top toolbar.',
                        'नीचे या ऊपर दिख रहे Share आइकन पर टैप करें।',
                        'खालील किंवा वरील Share चिन्हावर टॅप करा.'
                      )}
                    </li>
                    <li>
                      {tr(
                        lang,
                        'Scroll down and tap "Add to Home Screen", then tap Add.',
                        '"Add to Home Screen" चुनें और ऊपर Add दबाएं।',
                        '"Add to Home Screen" निवडा आणि Add वर टॅप करा.'
                      )}
                    </li>
                  </ol>
                </div>
              ) : platform === 'android' ? (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3.5 space-y-2 text-xs sm:text-sm text-slate-800">
                  <div className="font-bold text-[#15803D]">
                    {tr(
                      lang,
                      `For Android (${browser === 'samsung' ? 'Samsung Internet' : browser === 'edge' ? 'Edge' : 'Chrome'}):`,
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
                        'Install वर टॅप करा — ROJGAR SETU अ‍ॅप होम स्क्रीनवर येईल.'
                      )}
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-800">
                  <div className="font-bold text-[#0B3B75]">
                    {tr(
                      lang,
                      'Desktop & Mobile Browser Instructions:',
                      'डेस्कटॉप व मोबाइल ब्राउज़र निर्देश:',
                      'डेस्कटॉप व मोबाईल ब्राउझर सूचना:'
                    )}
                  </div>
                  <p className="leading-relaxed">
                    {tr(
                      lang,
                      'On Android Chrome: Open browser menu (⋮) → Install app / Add to Home Screen. On iPhone Safari: Share → Add to Home Screen. On Desktop Chrome/Edge: Click the Install icon in the address bar.',
                      'Android Chrome: मेनू (⋮) → Install app / Add to Home Screen। iPhone Safari: Share → Add to Home Screen। Desktop Chrome/Edge: एड्रेस बार में Install आइकन दबाएं।',
                      'Android Chrome: मेनू (⋮) → Install app / Add to Home Screen. iPhone Safari: Share → Add to Home Screen. Desktop Chrome/Edge: अ‍ॅड्रेस बारमधील Install चिन्हावर क्लिक करा.'
                    )}
                  </p>
                </div>
              )}

              {canonicalUrl && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {tr(lang, 'Official App Link', 'आधिकारिक ऐप लिंक', 'अधिकृत अ‍ॅप लिंक')}
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
      )}
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
