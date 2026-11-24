import React, { useEffect, useState } from 'react';
import {
  AirVent,
  Bike,
  Briefcase,
  Camera,
  Car,
  Droplets,
  Hammer,
  HardHat,
  Music,
  Paintbrush,
  Scissors,
  Shield,
  Sparkles,
  Sun,
  Tv,
  Video,
  Wrench,
  Zap,
} from 'lucide-react';

import thumbElectrician from '../assets/images/thumb_electrician_1795527318891.jpg';
import thumbPlumber from '../assets/images/thumb_plumber_1795527325901.jpg';
import thumbCarpenter from '../assets/images/thumb_carpenter_1795527323338.jpg';
import thumbCleaner from '../assets/images/thumb_cleaner_1795527324515.jpg';
import thumbPainter from '../assets/images/thumb_painter_1795527322331.jpg';
import thumbMechanic from '../assets/images/thumb_mechanic_1795527326537.jpg';
import thumbAcRepair from '../assets/images/thumb_ac_repair_1795527324588.jpg';
import thumbApplianceRepair from '../assets/images/thumb_appliance_repair_1795527323133.jpg';
import thumbDriver from '../assets/images/thumb_driver_1795527328256.jpg';
import thumbDailyLabour from '../assets/images/thumb_daily_labour_1795527327585.jpg';
import thumbBikeTransport from '../assets/images/thumb_bike_transport_1795527334268.jpg';
import thumbOtherServices from '../assets/images/thumb_other_services_1795527331073.jpg';
import thumbPhotographer from '../assets/images/thumb_photographer_1795527329867.jpg';

const DIRECT_PHOTO_MAP: Record<string, string> = {
  electrician: thumbElectrician,
  electricians: thumbElectrician,
  plumber: thumbPlumber,
  plumbers: thumbPlumber,
  carpenter: thumbCarpenter,
  carpenters: thumbCarpenter,
  cleaner: thumbCleaner,
  cleaners: thumbCleaner,
  housekeeping: thumbCleaner,
  painter: thumbPainter,
  painters: thumbPainter,
  mechanic: thumbMechanic,
  mechanics: thumbMechanic,
  ac_repair: thumbAcRepair,
  'ac-repair': thumbAcRepair,
  appliance_repair: thumbApplianceRepair,
  'appliance-repair': thumbApplianceRepair,
  driver: thumbDriver,
  drivers: thumbDriver,
  daily_labour: thumbDailyLabour,
  'daily-labour': thumbDailyLabour,
  construction: thumbDailyLabour,
  helpers: thumbDailyLabour,
  labour: thumbDailyLabour,
  bike_transport: thumbBikeTransport,
  'bike-transport': thumbBikeTransport,
  transport: thumbBikeTransport,
  other_services: thumbOtherServices,
  'other-services': thumbOtherServices,
  other: thumbOtherServices,
  cameraman: thumbPhotographer,
  photographer: thumbPhotographer,
  photography: thumbPhotographer,
  videographer: thumbPhotographer,
};

/**
 * Resolves a lightweight bundled photo thumbnail URL for built-in categories
 * and well-known professions (such as Cameraman / Photographer).
 * Returns null for unrecognized custom professions so a crisp fallback badge renders immediately.
 */
export function resolveProfessionPhotoUrl(idOrSlug?: string, labelHint?: string): string | null {
  const cleanId = (idOrSlug || '').toLowerCase().trim();
  if (cleanId && DIRECT_PHOTO_MAP[cleanId]) {
    return DIRECT_PHOTO_MAP[cleanId];
  }

  const hay = `${cleanId} ${labelHint || ''}`.toLowerCase();
  if (!hay.trim()) return null;

  // Photographer / Cameraman / Videographer
  if (
    hay.includes('cameraman') ||
    hay.includes('camera') ||
    hay.includes('photographer') ||
    hay.includes('photography') ||
    hay.includes('videograph') ||
    hay.includes('कॅमेरा') ||
    hay.includes('फोटोग्राफ')
  ) {
    return thumbPhotographer;
  }

  // Bike Rider / Delivery / Local Transport
  if (
    hay.includes('bike') ||
    hay.includes('rider') ||
    hay.includes('parcel') ||
    hay.includes('transport') ||
    hay.includes('बाईक') ||
    hay.includes('बाइक')
  ) {
    return thumbBikeTransport;
  }

  // AC Repair / Cooling
  if (
    hay.includes('ac repair') ||
    hay.includes('ac_repair') ||
    hay.includes('air condition') ||
    hay.includes('cooler') ||
    hay.includes('एसी')
  ) {
    return thumbAcRepair;
  }

  // Appliance Repair
  if (
    hay.includes('appliance') ||
    hay.includes('fridge') ||
    hay.includes('refrigerator') ||
    hay.includes('washing machine') ||
    hay.includes('ro purifier') ||
    hay.includes('उपकरण')
  ) {
    return thumbApplianceRepair;
  }

  // Electrician
  if (
    hay.includes('electric') ||
    hay.includes('wiring') ||
    hay.includes('इलेक्ट्रिशियन') ||
    hay.includes('इलेक्ट्रीशियन')
  ) {
    return thumbElectrician;
  }

  // Plumber
  if (hay.includes('plumb') || hay.includes('प्लंबर')) {
    return thumbPlumber;
  }

  // Carpenter
  if (hay.includes('carpent') || hay.includes('wood') || hay.includes('सुतार') || hay.includes('बढ़ई')) {
    return thumbCarpenter;
  }

  // Painter
  if (hay.includes('paint') || hay.includes('पेंटर') || hay.includes('रंगारी')) {
    return thumbPainter;
  }

  // Cleaner / Housekeeping
  if (
    hay.includes('clean') ||
    hay.includes('housekeep') ||
    hay.includes('maid') ||
    hay.includes('स्वच्छता') ||
    hay.includes('सफ़ाई') ||
    hay.includes('सफाई')
  ) {
    return thumbCleaner;
  }

  // Mechanic / Technician
  if (
    hay.includes('mechanic') ||
    hay.includes('garage') ||
    hay.includes('puncture') ||
    hay.includes('मेकॅनिक') ||
    hay.includes('मैकेनिक')
  ) {
    return thumbMechanic;
  }

  // Driver
  if (hay.includes('driver') || hay.includes('ड्रायव्हर') || hay.includes('ड्राइवर')) {
    return thumbDriver;
  }

  // Daily Labour / Helper / Construction / Mason
  if (
    hay.includes('labour') ||
    hay.includes('labor') ||
    hay.includes('helper') ||
    hay.includes('construction') ||
    hay.includes('mason') ||
    hay.includes('मज़दूर') ||
    hay.includes('मजूर') ||
    hay.includes('बांधकाम') ||
    hay.includes('दैनिक कामगार')
  ) {
    return thumbDailyLabour;
  }

  // Built-in "Other Services" category specifically (NOT arbitrary new custom professions)
  if (
    cleanId === 'other_services' ||
    hay.includes('other services') ||
    hay.includes('other skilled and unskilled') ||
    hay.includes('इतर सेवा') ||
    hay.includes('अन्य सेवा')
  ) {
    return thumbOtherServices;
  }

  return null;
}

export function getProfessionFallbackIcon(
  idOrSlug?: string,
  labelHint?: string
): React.ComponentType<{ className?: string }> | null {
  const hint = `${idOrSlug || ''} ${labelHint || ''}`.toLowerCase();
  if (hint.includes('electric')) return Zap;
  if (hint.includes('plumb')) return Droplets;
  if (hint.includes('carpent') || hint.includes('wood')) return Hammer;
  if (hint.includes('clean') || hint.includes('housekeep')) return Sparkles;
  if (hint.includes('paint')) return Paintbrush;
  if (hint.includes('mechanic') || hint.includes('repair')) return Wrench;
  if (hint.includes('ac ') || hint.includes('ac_')) return AirVent;
  if (hint.includes('appliance') || hint.includes('tv')) return Tv;
  if (hint.includes('driver')) return Car;
  if (hint.includes('labour') || hint.includes('helper') || hint.includes('construction')) return HardHat;
  if (hint.includes('bike') || hint.includes('transport')) return Bike;
  if (hint.includes('camera') || hint.includes('photo')) return Camera;
  if (hint.includes('video') || hint.includes('drone') || hint.includes('reel')) return Video;
  if (hint.includes('dj') || hint.includes('music') || hint.includes('sound') || hint.includes('band')) return Music;
  if (hint.includes('tailor') || hint.includes('salon') || hint.includes('barber') || hint.includes('stitch')) return Scissors;
  if (hint.includes('solar')) return Sun;
  if (hint.includes('cctv') || hint.includes('security') || hint.includes('guard')) return Shield;
  if (hint.includes('beauty') || hint.includes('makeup') || hint.includes('mehendi') || hint.includes('decor')) return Sparkles;
  if (hint.includes('other_services') || hint.includes('other services')) return Briefcase;
  return null;
}

function getInitials(label: string): string {
  const clean = (label || '').trim();
  if (!clean) return 'RS';
  const words = clean.split(/[\s/&,-]+/).filter(Boolean);
  if (words.length >= 2) {
    return `${Array.from(words[0])[0] || ''}${Array.from(words[1])[0] || ''}`.toUpperCase();
  }
  return Array.from(clean).slice(0, 2).join('').toUpperCase();
}

const SIZE_CLASSES = {
  xs: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', text: 'text-[11px]', px: 32 },
  sm: { box: 'w-9 h-9 rounded-lg', icon: 'w-4 h-4', text: 'text-xs', px: 36 },
  md: { box: 'w-10 h-10 sm:w-11 sm:h-11 rounded-lg', icon: 'w-4 h-4 sm:w-5 sm:h-5', text: 'text-xs sm:text-sm', px: 44 },
  lg: { box: 'w-11 h-11 rounded-xl', icon: 'w-5 h-5', text: 'text-sm', px: 44 },
} as const;

export interface ProfessionThumbnailProps {
  id?: string;
  label: string;
  hint?: string;
  size?: keyof typeof SIZE_CLASSES;
  accentBg?: string;
  accentBorder?: string;
  accentText?: string;
  className?: string;
}

export const ProfessionThumbnail: React.FC<ProfessionThumbnailProps> = ({
  id,
  label,
  hint,
  size = 'md',
  accentBg = 'bg-blue-50',
  accentBorder = 'border-blue-200/80',
  accentText = 'text-[#0B3B75]',
  className = '',
}) => {
  const photoUrl = resolveProfessionPhotoUrl(id, `${label} ${hint || ''}`);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const sz = SIZE_CLASSES[size];

  if (photoUrl && !imgFailed) {
    return (
      <div
        className={`${sz.box} overflow-hidden border border-slate-200/90 bg-slate-100 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}
      >
        <img
          src={photoUrl}
          alt={label}
          width={sz.px}
          height={sz.px}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  const FallbackIcon = getProfessionFallbackIcon(id, `${label} ${hint || ''}`);

  return (
    <div
      className={`${sz.box} border flex items-center justify-center shrink-0 ${accentBg} ${accentBorder} ${className}`}
      aria-hidden="true"
    >
      {FallbackIcon ? (
        <FallbackIcon className={`${sz.icon} ${accentText}`} />
      ) : (
        <span className={`font-display font-extrabold leading-none tracking-tight ${sz.text} ${accentText}`}>
          {getInitials(label)}
        </span>
      )}
    </div>
  );
};
