import React from 'react';

interface RojgarSetuLogoProps {
  variant?: 'horizontal' | 'icon' | 'vertical';
  inverted?: boolean;
  className?: string;
}

/**
 * ROJGAR SETU Official Emblem SVG:
 * Left: Briefcase + Rising Opportunity Arrow (EMPLOYMENT)
 * Centre: Suspension Arch Bridge (SETU)
 * Right: Diverse Indian Workers (Construction Worker, Skilled Technician, Professional)
 */
export const RojgarSetuEmblem: React.FC<{
  inverted?: boolean;
  className?: string;
}> = ({ inverted = false, className = 'w-16 h-11' }) => {
  const navy = inverted ? '#FFFFFF' : '#0B3B75';
  const innerLine = inverted ? '#072A54' : '#FFFFFF';
  const saffron = inverted ? '#FBBF24' : '#E06D1B';
  const green = inverted ? '#4ADE80' : '#15803D';

  return (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ROJGAR SETU bridge connecting employment opportunities and diverse Indian workers"
    >
      {/* LEFT: EMPLOYMENT (Briefcase + Rising Opportunity Arrow) */}
      <path d="M16 64 L38 36" stroke={saffron} strokeWidth="5.5" strokeLinecap="round" />
      <path
        d="M25 36 H39 V50"
        stroke={saffron}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 80 V74 C22 71.5 24 70 26.5 70 H35.5 C38 70 40 71.5 40 74 V80"
        stroke={navy}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="12" y="80" width="38" height="26" rx="4" fill={navy} />
      <line x1="12" y1="90" x2="50" y2="90" stroke={innerLine} strokeWidth="2.5" />
      <rect x="28" y="87" width="6" height="6" rx="1.5" fill={saffron} />

      {/* CENTRE: SETU BRIDGE (Connecting Left Employment to Right Workers) */}
      <rect x="8" y="109" width="224" height="7" rx="3.5" fill={navy} />
      <rect x="62" y="34" width="7" height="77" rx="2" fill={navy} />
      <rect x="159" y="34" width="7" height="77" rx="2" fill={navy} />
      <circle cx="65.5" cy="30" r="4.5" fill={saffron} />
      <circle cx="162.5" cy="30" r="4.5" fill={saffron} />
      <path
        d="M48 68 Q57 48 65.5 38 C88 72 140 72 162.5 38 Q169 46 174 60"
        stroke={saffron}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M68 109 Q114 56 160 109"
        stroke={navy}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <line x1="83" y1="56" x2="83" y2="109" stroke={navy} strokeWidth="2.5" />
      <line x1="98" y1="62" x2="98" y2="109" stroke={navy} strokeWidth="2.5" />
      <line x1="114" y1="64" x2="114" y2="109" stroke={saffron} strokeWidth="3" />
      <line x1="130" y1="62" x2="130" y2="109" stroke={navy} strokeWidth="2.5" />
      <line x1="145" y1="56" x2="145" y2="109" stroke={navy} strokeWidth="2.5" />

      {/* RIGHT: DIVERSE INDIAN WORKERS */}
      {/* 1. Construction Worker (Hard Hat) */}
      <path d="M177 73 C177 66 191 66 191 73 Z" fill={saffron} />
      <rect x="175" y="73" width="18" height="3" rx="1.5" fill={saffron} />
      <circle cx="184" cy="80" r="5" fill={navy} />
      <path d="M174 109 V93 C174 87 194 87 194 93 V109 Z" fill={navy} />
      <path
        d="M180 89 L184 96 L188 89"
        stroke={saffron}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. Skilled Technician */}
      <circle cx="205" cy="69" r="5.8" fill={green} />
      <path d="M194 109 V86 C194 79 216 79 216 86 V109 Z" fill={green} />
      <line x1="205" y1="81" x2="205" y2="96" stroke={innerLine} strokeWidth="2" strokeLinecap="round" />

      {/* 3. Service / Office Professional */}
      <circle cx="225" cy="76" r="5" fill={navy} />
      <path d="M216 109 V91 C216 85 234 85 234 91 V109 Z" fill={navy} />
      <path
        d="M222 87 L225 93 L228 87"
        stroke={innerLine}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Unifying Growth & Prosperity Waves Below Bridge */}
      <path d="M24 123 Q120 135 216 123" stroke={saffron} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M44 132 Q120 142 196 132" stroke={green} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
};

export const RojgarSetuLogo: React.FC<RojgarSetuLogoProps> = ({
  variant = 'horizontal',
  inverted = false,
  className = '',
}) => {
  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-[#0B3B75] p-1.5 border border-blue-900 ${className}`}
      >
        <div className="w-full h-full rounded-lg bg-white flex items-center justify-center p-1">
          <RojgarSetuEmblem className="w-full h-full" />
        </div>
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center text-center px-6 py-5 rounded-lg border ${
          inverted
            ? 'bg-[#072A54] border-blue-800 text-white'
            : 'bg-white border-slate-200 text-[#0B3B75]'
        } ${className}`}
      >
        <RojgarSetuEmblem inverted={inverted} className="w-40 h-26" />
        <div className="mt-2 font-display text-2xl font-extrabold tracking-wide">
          ROJGAR SETU
        </div>
        <div className={`text-base font-bold ${inverted ? 'text-amber-300' : 'text-[#E06D1B]'}`}>
          रोजगार सेतु
        </div>
        <div
          className={`mt-1 text-[10px] font-bold tracking-wider uppercase ${
            inverted ? 'text-emerald-300' : 'text-[#15803D]'
          }`}
        >
          EVERY HAND DESERVES AN OPPORTUNITY.
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3.5 ${className}`}>
      <div
        className={`shrink-0 rounded-md p-1 sm:p-1.5 border ${
          inverted ? 'bg-[#0B3B75] border-blue-700' : 'bg-white border-slate-200'
        }`}
      >
        <RojgarSetuEmblem inverted={inverted} className="w-14 h-9 sm:w-24 sm:h-14" />
      </div>
      <div
        className={`border-l pl-2 sm:pl-3.5 ${
          inverted ? 'border-blue-800' : 'border-slate-300'
        }`}
      >
        <div
          className={`font-display text-base sm:text-2xl font-extrabold tracking-tight leading-none ${
            inverted ? 'text-white' : 'text-[#0B3B75]'
          }`}
        >
          ROJGAR SETU
        </div>
        <div
          className={`mt-1 text-[11px] sm:text-sm font-bold leading-none ${
            inverted ? 'text-amber-300' : 'text-[#E06D1B]'
          }`}
        >
          रोजगार सेतु
        </div>
        <div
          className={`mt-1 text-[8px] sm:text-[10px] font-bold tracking-normal sm:tracking-wider uppercase leading-none ${
            inverted ? 'text-emerald-300' : 'text-[#15803D]'
          }`}
        >
          EVERY HAND DESERVES AN OPPORTUNITY.
        </div>
      </div>
    </div>
  );
};
