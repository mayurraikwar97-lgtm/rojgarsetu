import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Megaphone,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  BRAND_MESSAGE_MR,
  BRAND_SLOGAN_MR,
  BRAND_TAGLINE_MR,
} from '../lib/customerPrivacy';
import {
  buildCallHref,
  buildWhatsAppAdHref,
  getMatchingActiveAds,
  recordAdvertisementClick,
  recordAdvertisementImpression,
  sanitizeAdWebsiteUrl,
  subscribeActiveAdvertisements,
  subscribeAdvertisementCategories,
} from '../lib/adsReferralService';
import type {
  AdvertisementCategory,
  AdvertisementPlacement,
  AdvertisementRecord,
  Language,
  PageRoute,
} from '../types/domain';

interface SponsoredAdSliderProps {
  /** Selected service category ID or canonical name; omit or pass 'all' on Homepage */
  category?: string;
  /** Optional readable category label for subtle partner callout */
  categoryLabel?: string;
  state?: string;
  district?: string;
  city?: string;
  placement: AdvertisementPlacement;
  onNavigate?: (route: PageRoute) => void;
  /** Compact variant for inside category forms or secondary pages */
  compact?: boolean;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const SponsoredAdSlider: React.FC<SponsoredAdSliderProps> = ({
  category = '',
  categoryLabel = '',
  state = '',
  district = '',
  city = '',
  placement,
  onNavigate,
  compact = false,
}) => {
  const { lang } = useLanguage();
  const [allActiveAds, setAllActiveAds] = useState<AdvertisementRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<AdvertisementCategory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const impressionTrackedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const u1 = subscribeActiveAdvertisements((list) => {
      setAllActiveAds(list);
      setLoaded(true);
    });
    const u2 = subscribeAdvertisementCategories(setCustomCategories);
    return () => {
      u1();
      u2();
    };
  }, []);

  // Reset dismissal when user switches category
  useEffect(() => {
    setDismissed(false);
    setCurrentIndex(0);
  }, [category]);

  const matchedAds = useMemo(
    () =>
      getMatchingActiveAds(allActiveAds, {
        category,
        state,
        district,
        city,
        customCategories,
      }),
    [allActiveAds, category, state, district, city, customCategories]
  );

  // Keep index bounded if ad list shrinks
  useEffect(() => {
    if (matchedAds.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= matchedAds.length) {
      setCurrentIndex(0);
    }
  }, [matchedAds.length, currentIndex]);

  const currentAd = matchedAds[currentIndex] || null;

  // Auto-slide every 5.5 seconds (pauses on hover/touch; never triggers click tracking)
  useEffect(() => {
    if (paused || dismissed || matchedAds.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matchedAds.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, dismissed, matchedAds.length]);

  // Deduplicated session impression tracking when an active ad becomes visible
  useEffect(() => {
    if (!currentAd || dismissed) return;
    const key = `${currentAd.id}:${placement}:${category || 'homepage'}`;
    if (impressionTrackedRef.current.has(key)) return;
    impressionTrackedRef.current.add(key);

    void recordAdvertisementImpression({
      ad: currentAd,
      category: category || 'homepage',
      state,
      district,
      placement,
    });
  }, [currentAd?.id, dismissed, placement, category, state, district]);

  const handlePrev = useCallback(() => {
    if (matchedAds.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + matchedAds.length) % matchedAds.length);
  }, [matchedAds.length]);

  const handleNext = useCallback(() => {
    if (matchedAds.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % matchedAds.length);
  }, [matchedAds.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX !== null && endX !== null) {
      const delta = endX - startX;
      if (Math.abs(delta) > 40) {
        if (delta < 0) handleNext();
        else handlePrev();
      }
    }
    window.setTimeout(() => setPaused(false), 1800);
  };

  if (dismissed) return null;

  // When no active approved ads exist yet for this category, display a subtle, non-intrusive
  // local business invitation strip (never displays unrelated ads or blocks booking).
  if (loaded && matchedAds.length === 0) {
    if (compact) return null;
    return (
      <aside
        aria-label={tr(lang, 'Sponsored Advertisement Slot', 'प्रायोजित विज्ञापन स्थान', 'प्रायोजित जाहिरात स्थान')}
        className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-[#E06D1B]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {tr(lang, 'Sponsored Advertisement', 'प्रायोजित विज्ञापन', 'प्रायोजित जाहिरात')}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#0B3B75] truncate">
              {categoryLabel
                ? tr(
                    lang,
                    `Own a shop or business related to ${categoryLabel}? Promote it to local customers here.`,
                    `क्या आपका ${categoryLabel} से जुड़ा दुकान या व्यवसाय है? यहाँ ग्राहकों तक विज्ञापन पहुँचाएँ।`,
                    `${categoryLabel} संबंधित दुकान किंवा व्यवसाय आहे का? स्थानिक ग्राहकांपर्यंत जाहिरात पोहोचवा.`
                  )
                : tr(
                    lang,
                    'Advertise your local hardware, building material, or service shop on ROJGAR SETU.',
                    'रोजगार सेतु पर अपनी स्थानीय दुकान, मटेरियल सप्लाई या सेवा का विज्ञापन करें।',
                    'रोजगार सेतूवर तुमच्या स्थानिक दुकान, साहित्य सप्लाय किंवा व्यवसायाची जाहिरात करा.'
                  )}
            </p>
            <p className="text-[11px] font-bold text-[#E06D1B] mt-0.5">
              “{BRAND_SLOGAN_MR}” · <span className="text-[#15803D]">{BRAND_TAGLINE_MR}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('advertise')}
              className="px-3.5 py-2 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              {tr(lang, 'Advertise With Us', 'विज्ञापन दें', 'जाहिरात करा')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={tr(lang, 'Hide advertisement banner', 'विज्ञापन छिपाएँ', 'जाहिरात लपवा')}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  if (!currentAd) return null;

  const callHref = buildCallHref(currentAd.callNumber);
  const whatsappHref = buildWhatsAppAdHref(currentAd.whatsappNumber || currentAd.callNumber, currentAd.title);
  const websiteHref = sanitizeAdWebsiteUrl(currentAd.websiteUrl);

  const primaryAction = (() => {
    if (currentAd.contactAction === 'call' && callHref) {
      return {
        type: 'call' as const,
        href: callHref,
        label: currentAd.ctaLabel || tr(lang, 'CALL NOW', 'कॉल करें', 'कॉल करा'),
        icon: Phone,
        cls: 'bg-[#15803D] hover:bg-[#116830] text-white',
        external: false,
      };
    }
    if (currentAd.contactAction === 'whatsapp' && whatsappHref) {
      return {
        type: 'whatsapp' as const,
        href: whatsappHref,
        label: currentAd.ctaLabel || tr(lang, 'WHATSAPP', 'व्हाट्सएप', 'व्हॉट्सॲप'),
        icon: MessageCircle,
        cls: 'bg-[#15803D] hover:bg-[#116830] text-white',
        external: true,
      };
    }
    if (currentAd.contactAction === 'website' && websiteHref) {
      return {
        type: 'website' as const,
        href: websiteHref,
        label: currentAd.ctaLabel || tr(lang, 'VISIT WEBSITE', 'वेबसाइट देखें', 'वेबसाईट पहा'),
        icon: ExternalLink,
        cls: 'bg-[#0B3B75] hover:bg-[#072A54] text-white',
        external: true,
      };
    }
    // Safe fallback if primary contact field was blank
    if (callHref) {
      return {
        type: 'call' as const,
        href: callHref,
        label: tr(lang, 'CALL NOW', 'कॉल करें', 'कॉल करा'),
        icon: Phone,
        cls: 'bg-[#15803D] hover:bg-[#116830] text-white',
        external: false,
      };
    }
    if (whatsappHref) {
      return {
        type: 'whatsapp' as const,
        href: whatsappHref,
        label: tr(lang, 'WHATSAPP', 'व्हाट्सएप', 'व्हॉट्सॲप'),
        icon: MessageCircle,
        cls: 'bg-[#15803D] hover:bg-[#116830] text-white',
        external: true,
      };
    }
    if (websiteHref) {
      return {
        type: 'website' as const,
        href: websiteHref,
        label: tr(lang, 'VISIT WEBSITE', 'वेबसाइट देखें', 'वेबसाईट पहा'),
        icon: ExternalLink,
        cls: 'bg-[#0B3B75] hover:bg-[#072A54] text-white',
        external: true,
      };
    }
    return null;
  })();

  const handleActionClick = (actionType: 'call' | 'whatsapp' | 'website') => {
    void recordAdvertisementClick({
      ad: currentAd,
      category: category || 'homepage',
      state,
      district,
      placement,
      actionType,
    });
  };

  return (
    <aside
      aria-label={tr(lang, 'Sponsored Advertisement', 'प्रायोजित विज्ञापन', 'प्रायोजित जाहिरात')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
    >
      {/* Top Sponsored Label & Subtle Controls Bar */}
      <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[#C25E00]">
            <Megaphone className="w-3 h-3 shrink-0" />
            <span>{tr(lang, 'Sponsored Advertisement', 'प्रायोजित विज्ञापन', 'प्रायोजित जाहिरात')}</span>
          </span>
          {categoryLabel && (
            <span className="hidden sm:inline text-slate-500 truncate">
              · {categoryLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {matchedAds.length > 1 && (
            <span className="font-mono-tabular text-[10px] font-bold text-slate-500">
              {currentIndex + 1}/{matchedAds.length}
            </span>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('advertise')}
              className="text-[11px] font-semibold text-[#0B3B75] hover:underline cursor-pointer hidden sm:inline"
            >
              {tr(lang, 'Advertise here', 'यहाँ विज्ञापन दें', 'येथे जाहिरात करा')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={tr(lang, 'Close advertisement', 'विज्ञापन बंद करें', 'जाहिरात बंद करा')}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Single Clean Responsive Slide Card (1 ad visible at a time on mobile & desktop) */}
      <div className={`grid grid-cols-1 sm:grid-cols-12 items-stretch ${compact ? '' : ''}`}>
        {/* Ad Banner Visual */}
        <div className="sm:col-span-5 md:col-span-4 bg-slate-100 relative overflow-hidden min-h-[140px] sm:min-h-[156px] max-h-[200px]">
          <img
            src={currentAd.bannerImageUrl}
            alt={`${currentAd.advertiserName} — ${currentAd.title}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Ad Content & Clear Single Primary CTA */}
        <div className="sm:col-span-7 md:col-span-8 p-3.5 sm:p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-[#15803D] truncate">
              {currentAd.advertiserName}
              {currentAd.targetCities?.[0] || currentAd.targetDistricts?.[0]
                ? ` · ${currentAd.targetCities?.[0] || currentAd.targetDistricts?.[0]}`
                : ''}
            </div>
            <h3 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75] leading-snug line-clamp-1">
              {currentAd.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {currentAd.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {primaryAction && (
                <a
                  href={primaryAction.href}
                  target={primaryAction.external ? '_blank' : undefined}
                  rel={primaryAction.external ? 'noopener noreferrer' : undefined}
                  onClick={() => handleActionClick(primaryAction.type)}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap ${primaryAction.cls}`}
                >
                  <primaryAction.icon className="w-3.5 h-3.5" />
                  <span>{primaryAction.label}</span>
                </a>
              )}

              {/* Optional secondary WhatsApp/Call quick link if both exist */}
              {primaryAction?.type !== 'whatsapp' && whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleActionClick('whatsapp')}
                  className="inline-flex items-center justify-center gap-1 min-h-[40px] px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#15803D] text-xs font-bold whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {primaryAction?.type !== 'call' && callHref && (
                <a
                  href={callHref}
                  onClick={() => handleActionClick('call')}
                  className="inline-flex items-center justify-center gap-1 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{tr(lang, 'Call', 'कॉल', 'कॉल')}</span>
                </a>
              )}
            </div>

            {/* Manual Slider Prev/Next Controls */}
            {matchedAds.length > 1 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label={tr(lang, 'Previous advertisement', 'पिछला विज्ञापन', 'मागील जाहिरात')}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 px-1">
                  {matchedAds.slice(0, 6).map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Slide ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === currentIndex ? 'w-4 bg-[#E06D1B]' : 'w-1.5 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label={tr(lang, 'Next advertisement', 'अगला विज्ञापन', 'पुढील जाहिरात')}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Marathi Brand Slogan Strip on Sponsored Advertisements */}
      <div className="px-3.5 py-1.5 bg-[#0B3B75] text-white flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]">
        <span className="font-display font-extrabold text-amber-300">
          “{BRAND_SLOGAN_MR}”
        </span>
        <span className="font-semibold text-blue-100">{BRAND_TAGLINE_MR}</span>
        <span className="font-bold text-emerald-300 hidden md:inline">{BRAND_MESSAGE_MR}</span>
      </div>
    </aside>
  );
};
