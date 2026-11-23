import React from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  BRAND_MESSAGE_MR,
  BRAND_SLOGAN_MR,
  BRAND_TAGLINE_MR,
} from '../lib/customerPrivacy';

interface BrandSloganBannerProps {
  variant?: 'hero' | 'dashboard' | 'promo' | 'compact';
  className?: string;
}

export const BrandSloganBanner: React.FC<BrandSloganBannerProps> = ({
  variant = 'dashboard',
  className = '',
}) => {
  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl bg-[#0B3B75] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-l-4 border-[#E06D1B] ${className}`}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className="font-display text-sm sm:text-base font-extrabold text-amber-300 tracking-tight">
            {BRAND_SLOGAN_MR}
          </span>
          <span className="hidden sm:inline text-blue-200/70">•</span>
          <span className="text-xs font-semibold text-white/95">
            {BRAND_TAGLINE_MR}
          </span>
        </div>
        <span className="text-[11px] font-bold text-emerald-300">
          {BRAND_MESSAGE_MR}
        </span>
      </div>
    );
  }

  if (variant === 'promo') {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-gradient-to-r from-[#0B3B75] via-[#0B3B75] to-[#0E4A8F] text-white overflow-hidden shadow-xs ${className}`}
      >
        <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
          <div className="bg-[#E06D1B]" />
          <div className="bg-white" />
          <div className="bg-[#15803D]" />
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="font-display text-base sm:text-lg font-extrabold text-amber-300 leading-snug">
              “{BRAND_SLOGAN_MR}”
            </div>
            <div className="text-xs sm:text-sm font-semibold text-blue-100">
              {BRAND_TAGLINE_MR}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 shrink-0">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{BRAND_MESSAGE_MR}</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={`rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden ${className}`}
      >
        <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
          <div className="bg-[#E06D1B]" />
          <div className="bg-slate-100" />
          <div className="bg-[#15803D]" />
        </div>
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <p className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75] tracking-tight leading-snug">
              “{BRAND_SLOGAN_MR}”
            </p>
            <p className="text-xs sm:text-sm font-bold text-[#E06D1B]">
              {BRAND_TAGLINE_MR}
            </p>
          </div>
          <div className="md:text-right border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4 shrink-0">
            <p className="text-xs sm:text-sm font-extrabold text-[#15803D]">
              {BRAND_MESSAGE_MR}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              ROJGAR SETU
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: 'dashboard'
  return (
    <div
      className={`rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs ${className}`}
    >
      <div className="h-1 w-full grid grid-cols-3" aria-hidden="true">
        <div className="bg-[#E06D1B]" />
        <div className="bg-slate-100" />
        <div className="bg-[#15803D]" />
      </div>
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75] leading-snug">
            “{BRAND_SLOGAN_MR}”
          </div>
          <div className="text-xs font-bold text-[#E06D1B]">{BRAND_TAGLINE_MR}</div>
        </div>
        <div className="text-xs font-extrabold text-[#15803D] sm:text-right shrink-0">
          {BRAND_MESSAGE_MR}
        </div>
      </div>
    </div>
  );
};
