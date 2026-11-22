import type { DealStatus, JobApplication, Language, NotificationToneType } from '../types/domain.ts';
export type { NotificationToneType };

export type VisibleDealStage =
  | 'NEW_ORDER'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'LOCATION_SHARED'
  | 'WORK_COMPLETED'
  | 'CANCELLED';

export const VISIBLE_DEAL_STAGE_ORDER: readonly VisibleDealStage[] = [
  'NEW_ORDER',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'LOCATION_SHARED',
  'WORK_COMPLETED',
] as const;

export function toVisibleDealStage(
  input?: Pick<JobApplication, 'status' | 'dealStatus'> | DealStatus | string | null,
  hasSharedLocation = false
): VisibleDealStage {
  if (!input) return 'NEW_ORDER';

  if (typeof input === 'string') {
    switch (input) {
      case 'NEW_ORDER':
      case 'NEW_REQUEST':
      case 'REQUESTED':
      case 'NOTIFIED':
      case 'invited':
        return 'NEW_ORDER';
      case 'OFFER_SENT':
      case 'OFFER_RECEIVED':
      case 'applied':
        return 'OFFER_SENT';
      case 'LOCATION_SHARED':
        return 'LOCATION_SHARED';
      case 'OFFER_ACCEPTED':
      case 'DEAL_CONFIRMED':
      case 'WORK_CONFIRMED':
      case 'WORK_IN_PROGRESS':
      case 'accepted':
        return hasSharedLocation ? 'LOCATION_SHARED' : 'OFFER_ACCEPTED';
      case 'WORK_COMPLETED':
      case 'work_completed':
      case 'completed':
        return 'WORK_COMPLETED';
      case 'CANCELLED':
      case 'REJECTED':
      case 'declined':
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'NEW_ORDER';
    }
  }

  if (input.dealStatus) {
    return toVisibleDealStage(input.dealStatus, hasSharedLocation);
  }
  return toVisibleDealStage(input.status, hasSharedLocation);
}

export function getVisibleDealStatusLabel(
  input: Pick<JobApplication, 'status' | 'dealStatus'> | DealStatus | VisibleDealStage | string | null | undefined,
  lang: Language,
  hasSharedLocation = false
): string {
  const stage = toVisibleDealStage(input, hasSharedLocation);
  switch (stage) {
    case 'NEW_ORDER':
      return lang === 'mr' ? 'नवीन ऑर्डर' : lang === 'hi' ? 'नया ऑर्डर' : 'New Order';
    case 'OFFER_SENT':
      return lang === 'mr' ? 'ऑफर पाठवली' : lang === 'hi' ? 'ऑफर भेजा गया' : 'Offer Sent';
    case 'OFFER_ACCEPTED':
      return lang === 'mr' ? 'ऑफर स्वीकारली' : lang === 'hi' ? 'ऑफर स्वीकार' : 'Offer Accepted';
    case 'LOCATION_SHARED':
      return lang === 'mr' ? 'लोकेशन शेअर केले' : lang === 'hi' ? 'लोकेशन साझा' : 'Location Shared';
    case 'WORK_COMPLETED':
      return lang === 'mr' ? 'काम पूर्ण झाले' : lang === 'hi' ? 'काम पूरा हुआ' : 'Work Completed';
    case 'CANCELLED':
      return lang === 'mr' ? 'रद्द झाले' : lang === 'hi' ? 'रद्द किया गया' : 'Cancelled';
    default:
      return lang === 'mr' ? 'नवीन ऑर्डर' : lang === 'hi' ? 'नया ऑर्डर' : 'New Order';
  }
}

export interface ToneChannelConfig {
  toneType: NotificationToneType;
  /** Versioned Android notification channel ID (v2) to bypass any older silent channel cached on Android devices */
  channelId: string;
  vibratePattern: number[];
  vibrateMillis: number[];
  badgeColorClass: string;
  toastBorderClass: string;
  label: {
    en: string;
    hi: string;
    mr: string;
  };
  description: {
    en: string;
    hi: string;
    mr: string;
  };
}

export const TONE_CHANNEL_CONFIGS: Record<NotificationToneType, ToneChannelConfig> = {
  new_job: {
    toneType: 'new_job',
    channelId: 'rojgar_new_job_sound_v2',
    vibratePattern: [280, 90, 280, 90, 380],
    vibrateMillis: [280, 90, 280, 90, 380],
    badgeColorClass: 'bg-amber-100 text-[#C25E00] border-amber-300',
    toastBorderClass: 'border-[#E06D1B]',
    label: {
      en: 'New Job Alert Tone',
      hi: 'नए काम का अलर्ट टोन',
      mr: 'नवीन कामाचा अलर्ट टोन',
    },
    description: {
      en: 'Loud triple-chime alert for matching worker job requests',
      hi: 'नए मेल खाने वाले काम के लिए तेज़ तीन-टोन अलर्ट',
      mr: 'नवीन कामाची संधी आल्यावर मोठा तिहेरी अलर्ट टोन',
    },
  },
  new_offer: {
    toneType: 'new_offer',
    channelId: 'rojgar_new_offer_sound_v2',
    vibratePattern: [200, 80, 220],
    vibrateMillis: [200, 80, 220],
    badgeColorClass: 'bg-blue-100 text-[#0B3B75] border-blue-300',
    toastBorderClass: 'border-[#0B3B75]',
    label: {
      en: 'Worker Offer Tone',
      hi: 'कामगार ऑफर टोन',
      mr: 'कामगार ऑफर टोन',
    },
    description: {
      en: 'Crisp dual-note chime when a worker sends a price offer',
      hi: 'कामगार का ऑफर मिलने पर दोहरी घंटी की आवाज़',
      mr: 'कामगाराने ऑफर पाठवल्यावर स्पष्ट दुहेरी अलर्ट टोन',
    },
  },
  deal_accepted: {
    toneType: 'deal_accepted',
    channelId: 'rojgar_deal_confirmed_sound_v2',
    vibratePattern: [160, 70, 160, 70, 340],
    vibrateMillis: [160, 70, 160, 70, 340],
    badgeColorClass: 'bg-emerald-100 text-[#15803D] border-emerald-300',
    toastBorderClass: 'border-[#15803D]',
    label: {
      en: 'Offer Accepted & Location Tone',
      hi: 'ऑफर स्वीकृत एवं लोकेशन टोन',
      mr: 'ऑफर स्वीकार व लोकेशन टोन',
    },
    description: {
      en: 'Clear rising chime when work is confirmed or exact location is shared',
      hi: 'काम पक्का होने या सटीक लोकेशन मिलने पर स्पष्ट टोन',
      mr: 'ऑफर स्वीकारल्यावर किंवा अचूक लोकेशन शेअर झाल्यावर स्पष्ट टोन',
    },
  },
  deal_completed: {
    toneType: 'deal_completed',
    channelId: 'rojgar_deal_closed_sound_v2',
    vibratePattern: [200, 100, 240],
    vibrateMillis: [200, 100, 240],
    badgeColorClass: 'bg-slate-800 text-white border-slate-700',
    toastBorderClass: 'border-[#0B3B75]',
    label: {
      en: 'Work Completed Tone',
      hi: 'काम पूर्ण होने का टोन',
      mr: 'काम पूर्ण झाल्याचा टोन',
    },
    description: {
      en: 'Warm completion chime when work is marked finished',
      hi: 'काम पूरा होने पर सुखद सूचना टोन',
      mr: 'काम पूर्ण झाल्यावर शांत सूचना टोन',
    },
  },
  deal_cancelled: {
    toneType: 'deal_cancelled',
    channelId: 'rojgar_deal_closed_sound_v2',
    vibratePattern: [300, 120, 200],
    vibrateMillis: [300, 120, 200],
    badgeColorClass: 'bg-red-100 text-red-800 border-red-300',
    toastBorderClass: 'border-red-600',
    label: {
      en: 'Cancellation Alert Tone',
      hi: 'रद्द होने का अलर्ट टोन',
      mr: 'रद्द झाल्याचा अलर्ट टोन',
    },
    description: {
      en: 'Distinct low double-tone when a request or deal is cancelled',
      hi: 'काम या डील रद्द होने पर अलग चेतावनी टोन',
      mr: 'ऑर्डर किंवा व्यवहार रद्द झाल्यावर वेगळा अलर्ट टोन',
    },
  },
  general: {
    toneType: 'general',
    channelId: 'rojgar_location_chat_v2',
    vibratePattern: [200, 100, 200],
    vibrateMillis: [200, 100, 200],
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    toastBorderClass: 'border-[#0B3B75]',
    label: {
      en: 'Chat & General Alert Tone',
      hi: 'चैट व सामान्य सूचना टोन',
      mr: 'चॅट व सामान्य सूचना टोन',
    },
    description: {
      en: 'Standard clear chime for chat messages and updates',
      hi: 'चैट संदेशों और अपडेट के लिए स्पष्ट टोन',
      mr: 'चॅट संदेश आणि अपडेटसाठी स्पष्ट अलर्ट टोन',
    },
  },
};

export function getToneTypeForEvent(input: {
  toneType?: NotificationToneType | string;
  eventType?: string;
  dealStatus?: DealStatus | string;
  category?: string;
}): NotificationToneType {
  if (
    input.toneType === 'new_job' ||
    input.toneType === 'new_offer' ||
    input.toneType === 'deal_accepted' ||
    input.toneType === 'deal_completed' ||
    input.toneType === 'deal_cancelled' ||
    input.toneType === 'general'
  ) {
    return input.toneType;
  }

  const ev = (input.eventType || '').toLowerCase();
  if (ev === 'hiring_request_created' || ev === 'new_job_broadcast') return 'new_job';
  if (ev === 'worker_offer_sent' || ev === 'worker_quotation' || ev === 'new_application') return 'new_offer';
  if (
    ev === 'offer_accepted' ||
    ev === 'deal_confirmed' ||
    ev === 'job_request_accepted' ||
    ev === 'booking_accepted' ||
    ev === 'work_started' ||
    ev === 'worker_arrived' ||
    ev === 'customer_location_shared' ||
    ev === 'worker_location_shared'
  ) {
    return 'deal_accepted';
  }
  if (ev === 'work_completed' || ev === 'job_completed') return 'deal_completed';
  if (
    ev === 'deal_cancelled' ||
    ev === 'booking_cancelled' ||
    ev === 'offer_rejected' ||
    ev === 'job_request_rejected'
  ) {
    return 'deal_cancelled';
  }
  if (ev === 'customer_message' || ev === 'worker_message') return 'general';

  const ds = (input.dealStatus || '').toUpperCase();
  if (ds === 'REQUESTED' || ds === 'NOTIFIED') return 'new_job';
  if (ds === 'OFFER_RECEIVED') return 'new_offer';
  if (ds === 'OFFER_ACCEPTED' || ds === 'DEAL_CONFIRMED' || ds === 'WORK_IN_PROGRESS') return 'deal_accepted';
  if (ds === 'WORK_COMPLETED') return 'deal_completed';
  if (ds === 'CANCELLED' || ds === 'REJECTED') return 'deal_cancelled';

  if (input.category === 'matchingJobs' || input.category === 'nearbyJobs') return 'new_job';
  return 'general';
}

export function getToneChannelConfig(toneType: NotificationToneType): ToneChannelConfig {
  return TONE_CHANNEL_CONFIGS[toneType] || TONE_CHANNEL_CONFIGS.general;
}
