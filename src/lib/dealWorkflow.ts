import type { DealStatus, JobApplication, Language } from '../types/domain';

export type NotificationToneType =
  | 'new_job'
  | 'new_offer'
  | 'deal_accepted'
  | 'deal_completed'
  | 'deal_cancelled'
  | 'general';

export type VisibleDealStage =
  | 'NEW_REQUEST'
  | 'OFFER_SENT'
  | 'WORK_CONFIRMED'
  | 'WORK_IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'CANCELLED';

export interface ToneChannelConfig {
  toneType: NotificationToneType;
  channelId: string;
  channelName: string;
  vibratePattern: number[];
  vibrateMillis: number[];
  badgeColorClass: string;
  toastBorderClass: string;
  toastBgClass: string;
  label: {
    en: string;
    hi: string;
    mr: string;
  };
}

export const VISIBLE_DEAL_STAGE_ORDER: VisibleDealStage[] = [
  'NEW_REQUEST',
  'OFFER_SENT',
  'WORK_CONFIRMED',
  'WORK_IN_PROGRESS',
  'WORK_COMPLETED',
];

const VISIBLE_STAGE_LABELS: Record<VisibleDealStage, Record<Language, string>> = {
  NEW_REQUEST: {
    en: 'New Request',
    hi: 'नया अनुरोध',
    mr: 'नवीन विनंती',
  },
  OFFER_SENT: {
    en: 'Offer Sent',
    hi: 'ऑफर भेजा गया',
    mr: 'ऑफर पाठवला',
  },
  WORK_CONFIRMED: {
    en: 'Work Confirmed',
    hi: 'काम पक्का हुआ',
    mr: 'काम निश्चित झाले',
  },
  WORK_IN_PROGRESS: {
    en: 'Work In Progress',
    hi: 'काम चालू है',
    mr: 'काम सुरू आहे',
  },
  WORK_COMPLETED: {
    en: 'Work Completed',
    hi: 'काम पूरा हुआ',
    mr: 'काम पूर्ण झाले',
  },
  CANCELLED: {
    en: 'Cancelled',
    hi: 'रद्द',
    mr: 'रद्द केले',
  },
};

export function toVisibleDealStage(input?: {
  status?: JobApplication['status'] | string | null;
  dealStatus?: DealStatus | string | null;
}): VisibleDealStage {
  const status = String(input?.status || '').trim().toLowerCase();
  const deal = String(input?.dealStatus || '').trim().toUpperCase();

  if (deal === 'CANCELLED' || deal === 'REJECTED' || status === 'declined') {
    return 'CANCELLED';
  }
  if (deal === 'WORK_COMPLETED' || status === 'work_completed' || status === 'completed') {
    return 'WORK_COMPLETED';
  }
  if (deal === 'WORK_IN_PROGRESS' || status === 'in_progress') {
    return 'WORK_IN_PROGRESS';
  }
  if (
    deal === 'DEAL_CONFIRMED' ||
    deal === 'OFFER_ACCEPTED' ||
    status === 'accepted' ||
    status === 'customer_confirmed'
  ) {
    return 'WORK_CONFIRMED';
  }
  if (deal === 'OFFER_RECEIVED' || status === 'applied') {
    return 'OFFER_SENT';
  }
  return 'NEW_REQUEST';
}

export function getVisibleDealStatusLabel(
  input:
    | VisibleDealStage
    | { status?: JobApplication['status'] | string | null; dealStatus?: DealStatus | string | null }
    | string
    | undefined,
  lang: Language
): string {
  if (!input) {
    return VISIBLE_STAGE_LABELS.NEW_REQUEST[lang];
  }
  if (typeof input === 'string') {
    const upper = input.trim().toUpperCase();
    if (upper in VISIBLE_STAGE_LABELS) {
      return VISIBLE_STAGE_LABELS[upper as VisibleDealStage][lang];
    }
    return VISIBLE_STAGE_LABELS[toVisibleDealStage({ dealStatus: input, status: input })][lang];
  }
  return VISIBLE_STAGE_LABELS[toVisibleDealStage(input)][lang];
}

export function getToneTypeForEvent(input?: {
  toneType?: string | null;
  eventType?: string | null;
  dealStatus?: string | null;
  category?: string | null;
}): NotificationToneType {
  const explicit = String(input?.toneType || '').trim();
  if (
    explicit === 'new_job' ||
    explicit === 'new_offer' ||
    explicit === 'deal_accepted' ||
    explicit === 'deal_completed' ||
    explicit === 'deal_cancelled' ||
    explicit === 'general'
  ) {
    return explicit;
  }

  const event = String(input?.eventType || '').trim().toLowerCase();
  const deal = String(input?.dealStatus || '').trim().toUpperCase();
  const category = String(input?.category || '').trim();

  if (
    event === 'deal_cancelled' ||
    event === 'booking_cancelled' ||
    event === 'offer_rejected' ||
    event === 'job_request_rejected' ||
    deal === 'CANCELLED' ||
    deal === 'REJECTED'
  ) {
    return 'deal_cancelled';
  }

  if (event === 'work_completed' || event === 'job_completed' || deal === 'WORK_COMPLETED') {
    return 'deal_completed';
  }

  if (
    event === 'offer_accepted' ||
    event === 'deal_confirmed' ||
    event === 'work_started' ||
    event === 'job_request_accepted' ||
    event === 'booking_accepted' ||
    deal === 'DEAL_CONFIRMED' ||
    deal === 'OFFER_ACCEPTED' ||
    deal === 'WORK_IN_PROGRESS'
  ) {
    return 'deal_accepted';
  }

  if (
    event === 'worker_offer_sent' ||
    event === 'worker_quotation' ||
    event === 'new_application' ||
    deal === 'OFFER_RECEIVED'
  ) {
    return 'new_offer';
  }

  if (
    event === 'hiring_request_created' ||
    event === 'job_request' ||
    event === 'new_job_broadcast' ||
    category === 'matchingJobs' ||
    category === 'nearbyJobs' ||
    deal === 'REQUESTED' ||
    deal === 'NOTIFIED'
  ) {
    return 'new_job';
  }

  return 'general';
}

const TONE_CHANNEL_CONFIGS: Record<NotificationToneType, ToneChannelConfig> = {
  new_job: {
    toneType: 'new_job',
    channelId: 'rojgar_new_job_v1',
    channelName: 'New Job Requests',
    vibratePattern: [260, 90, 260, 90, 360],
    vibrateMillis: [260, 90, 260, 90, 360],
    badgeColorClass: 'bg-amber-100 text-amber-800 border-amber-300',
    toastBorderClass: 'border-amber-500',
    toastBgClass: 'bg-amber-50',
    label: {
      en: 'New Job Alert',
      hi: 'नए काम की सूचना',
      mr: 'नवीन कामाची सूचना',
    },
  },
  new_offer: {
    toneType: 'new_offer',
    channelId: 'rojgar_new_offer_v1',
    channelName: 'Worker Offers',
    vibratePattern: [180, 80, 180],
    vibrateMillis: [180, 80, 180],
    badgeColorClass: 'bg-blue-100 text-blue-800 border-blue-300',
    toastBorderClass: 'border-blue-600',
    toastBgClass: 'bg-blue-50',
    label: {
      en: 'New Worker Offer',
      hi: 'कारीगर का ऑफर',
      mr: 'कामगाराचा ऑफर',
    },
  },
  deal_accepted: {
    toneType: 'deal_accepted',
    channelId: 'rojgar_deal_confirmed_v1',
    channelName: 'Work Confirmed Alerts',
    vibratePattern: [140, 70, 140, 70, 320],
    vibrateMillis: [140, 70, 140, 70, 320],
    badgeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    toastBorderClass: 'border-emerald-600',
    toastBgClass: 'bg-emerald-50',
    label: {
      en: 'Work Confirmed',
      hi: 'काम पक्का हुआ',
      mr: 'काम निश्चित झाले',
    },
  },
  deal_completed: {
    toneType: 'deal_completed',
    channelId: 'rojgar_deal_closed_v1',
    channelName: 'Deal Updates',
    vibratePattern: [200, 100, 240],
    vibrateMillis: [200, 100, 240],
    badgeColorClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    toastBorderClass: 'border-indigo-600',
    toastBgClass: 'bg-indigo-50',
    label: {
      en: 'Work Completed',
      hi: 'काम पूरा हुआ',
      mr: 'काम पूर्ण झाले',
    },
  },
  deal_cancelled: {
    toneType: 'deal_cancelled',
    channelId: 'rojgar_deal_closed_v1',
    channelName: 'Deal Updates',
    vibratePattern: [300, 120, 200],
    vibrateMillis: [300, 120, 200],
    badgeColorClass: 'bg-rose-100 text-rose-800 border-rose-300',
    toastBorderClass: 'border-rose-500',
    toastBgClass: 'bg-rose-50',
    label: {
      en: 'Cancelled',
      hi: 'रद्द',
      mr: 'रद्द केले',
    },
  },
  general: {
    toneType: 'general',
    channelId: 'rojgar_general_v1',
    channelName: 'Rojgar Setu Alerts',
    vibratePattern: [160, 80, 160],
    vibrateMillis: [160, 80, 160],
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    toastBorderClass: 'border-slate-500',
    toastBgClass: 'bg-white',
    label: {
      en: 'Alert',
      hi: 'सूचना',
      mr: 'सूचना',
    },
  },
};

export function getToneChannelConfig(toneType?: string | null): ToneChannelConfig {
  const normalized = getToneTypeForEvent({ toneType });
  return TONE_CHANNEL_CONFIGS[normalized];
}
