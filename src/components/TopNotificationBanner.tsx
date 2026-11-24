import React, { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  PackageCheck,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { getToneChannelConfig, getToneTypeForEvent } from '../lib/dealWorkflow';
import type { Language, NotificationToneType, PageRoute } from '../types/domain';

export interface TopAlertNotificationItem {
  id: string;
  notificationId?: string;
  dedupeKey?: string;
  title: string;
  body: string;
  route?: PageRoute;
  jobId?: string;
  demoJobId?: string;
  voiceScript?: string;
  lang?: Language;
  approxLocationLabel?: string;
  distanceKm?: number;
  playSound?: boolean;
  speakVoice?: boolean;
  toneType?: NotificationToneType;
  eventType?: string;
  category?: string;
  receivedAtMs: number;
  speechBlockedHint?: boolean;
}

interface TopNotificationBannerProps {
  item: TopAlertNotificationItem | null;
  queuedCount: number;
  lang: Language;
  voiceMuted: boolean;
  onOpen: (item: TopAlertNotificationItem) => void;
  onDismiss: () => void;
  onReplayTone: (toneType: NotificationToneType) => void;
  onReplayVoice: (item: TopAlertNotificationItem, toneType: NotificationToneType) => void;
  onToggleMute: () => void;
}

const AUTO_DISMISS_MS = 8500;

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function formatAlertTimestamp(receivedAtMs: number, lang: Language): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - receivedAtMs) / 1000));
  if (diffSec < 45) {
    return tr(lang, 'Just now', 'अभी', 'आत्ताच');
  }
  try {
    return new Date(receivedAtMs).toLocaleTimeString(
      lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN',
      { hour: '2-digit', minute: '2-digit' }
    );
  } catch {
    return tr(lang, 'Now', 'अभी', 'आत्ताच');
  }
}

function getAlertVisualTheme(item: TopAlertNotificationItem, activeTone: NotificationToneType) {
  const ev = (item.eventType || '').toLowerCase();
  const isMessage = ev.includes('message') || ev.includes('chat');
  const isOrderUpdate =
    item.category === 'bookingNotifications' ||
    ev.includes('booking') ||
    ev.includes('on_the_way') ||
    ev.includes('arrived') ||
    ev.includes('work_started');

  if (isMessage) {
    return {
      Icon: MessageSquare,
      iconBg: 'bg-[#15803D] text-white',
      accentBar: 'bg-[#15803D]',
      ringBorder: 'border-emerald-300',
      badgeBg: 'bg-emerald-50 text-[#15803D] border-emerald-200',
      badgeLabel: { en: 'New Message', hi: 'नया संदेश', mr: 'नवीन संदेश' },
    };
  }

  if (activeTone === 'new_job') {
    return {
      Icon: Briefcase,
      iconBg: 'bg-[#E06D1B] text-white',
      accentBar: 'bg-[#E06D1B]',
      ringBorder: 'border-amber-300',
      badgeBg: 'bg-amber-50 text-[#B45309] border-amber-200',
      badgeLabel: { en: 'Job Alert', hi: 'नया काम', mr: 'नवीन काम' },
    };
  }

  if (activeTone === 'deal_accepted') {
    return {
      Icon: CheckCircle2,
      iconBg: 'bg-[#15803D] text-white',
      accentBar: 'bg-[#15803D]',
      ringBorder: 'border-emerald-300',
      badgeBg: 'bg-emerald-50 text-[#15803D] border-emerald-200',
      badgeLabel: { en: 'Confirmed', hi: 'काम पक्का', mr: 'काम निश्चित' },
    };
  }

  if (activeTone === 'deal_cancelled') {
    return {
      Icon: XCircle,
      iconBg: 'bg-rose-600 text-white',
      accentBar: 'bg-rose-600',
      ringBorder: 'border-rose-300',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeLabel: { en: 'Update', hi: 'अपडेट', mr: 'अपडेट' },
    };
  }

  if (isOrderUpdate || activeTone === 'deal_completed') {
    return {
      Icon: PackageCheck,
      iconBg: 'bg-[#0B3B75] text-white',
      accentBar: 'bg-[#0B3B75]',
      ringBorder: 'border-blue-300',
      badgeBg: 'bg-blue-50 text-[#0B3B75] border-blue-200',
      badgeLabel: { en: 'Order Update', hi: 'ऑर्डर अपडेट', mr: 'ऑर्डर अपडेट' },
    };
  }

  const toneCfg = getToneChannelConfig(activeTone);
  return {
    Icon: BellRing,
    iconBg: 'bg-[#0B3B75] text-white',
    accentBar: 'bg-[#0B3B75]',
    ringBorder: 'border-slate-300',
    badgeBg: toneCfg.badgeColorClass,
    badgeLabel: toneCfg.label,
  };
}

export const TopNotificationBanner: React.FC<TopNotificationBannerProps> = ({
  item,
  queuedCount,
  lang,
  voiceMuted,
  onOpen,
  onDismiss,
  onReplayTone,
  onReplayVoice,
  onToggleMute,
}) => {
  const [paused, setPaused] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  // Refresh relative timestamp while visible
  useEffect(() => {
    if (!item) return;
    const interval = window.setInterval(() => setNowTick((n) => n + 1), 15000);
    return () => window.clearInterval(interval);
  }, [item]);

  // Auto-dismiss after AUTO_DISMISS_MS unless hovered/paused or waiting for user audio tap
  useEffect(() => {
    if (!item || paused || item.speechBlockedHint) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item, paused, onDismiss]);

  if (!item) return null;

  void nowTick;
  const activeTone = getToneTypeForEvent({
    toneType: item.toneType,
    eventType: item.eventType,
    category: item.category,
  });
  const theme = getAlertVisualTheme(item, activeTone);
  const IconComp = theme.Icon;
  const timeLabel = formatAlertTimestamp(item.receivedAtMs, lang);

  return (
    <div
      aria-live="polite"
      className="fixed top-2 sm:top-3 inset-x-0 z-[60] flex justify-center px-3 pointer-events-none"
    >
      <div
        role="status"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={(e) => {
          setPaused(true);
          touchStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const startY = touchStartYRef.current;
          const endY = e.changedTouches[0]?.clientY ?? null;
          touchStartYRef.current = null;
          if (startY !== null && endY !== null && startY - endY > 36) {
            onDismiss();
            return;
          }
          setPaused(false);
        }}
        className={`pointer-events-auto animate-rs-toast-in w-full max-w-md rounded-2xl bg-white/98 backdrop-blur-md border ${theme.ringBorder} shadow-[0_14px_34px_rgba(11,59,117,0.18)] overflow-hidden`}
      >
        {/* Top slim color accent bar */}
        <div className={`h-1 w-full ${theme.accentBar}`} />

        <div className="p-3 sm:p-3.5">
          <div className="flex items-start gap-3">
            {/* App / Alert Avatar Icon */}
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={tr(lang, 'Open notification', 'सूचना खोलें', 'सूचना उघडा')}
              className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0 shadow-xs cursor-pointer`}
            >
              <IconComp className="w-5 h-5" />
            </button>

            {/* Clickable Message Content */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(item);
                }
              }}
              className="flex-1 min-w-0 cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3B75] truncate">
                    ROJGAR SETU
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold leading-none shrink-0 ${theme.badgeBg}`}
                  >
                    {theme.badgeLabel[lang]}
                  </span>
                  {queuedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#0B3B75] text-white text-[10px] font-mono-tabular font-bold leading-none shrink-0">
                      +{queuedCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                  {timeLabel}
                </span>
              </div>

              <div className="font-display text-sm font-bold text-slate-900 group-hover:text-[#0B3B75] truncate mt-0.5">
                {item.title}
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 leading-snug mt-0.5">
                {item.body}
              </p>

              {item.approxLocationLabel && (
                <p className="text-[11px] font-medium text-slate-500 truncate mt-1">
                  {item.approxLocationLabel}
                  {typeof item.distanceKm === 'number' && Number.isFinite(item.distanceKm)
                    ? ` · ${item.distanceKm.toFixed(1)} km`
                    : ''}
                </p>
              )}

              {item.speechBlockedHint && (
                <p className="text-[11px] font-semibold text-[#C25E00] mt-1">
                  {tr(
                    lang,
                    'Tap Listen below to hear the voice announcement.',
                    'वॉइस संदेश सुनने के लिए नीचे "सुनें" पर टैप करें।',
                    'आवाजात सूचना ऐकण्यासाठी खाली "ऐका" वर टॅप करा.'
                  )}
                </p>
              )}
            </div>

            {/* Dismiss X */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label={tr(lang, 'Dismiss notification', 'सूचना बंद करें', 'सूचना बंद करा')}
              className="p-1.5 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Action Footer */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {item.voiceScript ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplayVoice(item, activeTone);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-[#0B3B75] hover:bg-slate-100 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                  <span>{tr(lang, 'Listen', 'सुनें', 'ऐका')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplayTone(activeTone);
                  }}
                  aria-label={tr(lang, 'Replay alert tone', 'टोन फिर से सुनें', 'टोन पुन्हा ऐका')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                  <span className="hidden sm:inline">{tr(lang, 'Tone', 'टोन', 'टोन')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                aria-label={
                  voiceMuted
                    ? tr(lang, 'Unmute alerts', 'ध्वनि चालू करें', 'आवाज सुरू करा')
                    : tr(lang, 'Mute alerts', 'म्यूट करें', 'म्यूट करा')
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {voiceMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-600" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>
                  {voiceMuted
                    ? tr(lang, 'Muted', 'म्यूट', 'म्यूट')
                    : tr(lang, 'Mute', 'म्यूट करें', 'म्यूट')}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                {tr(lang, 'Dismiss', 'बंद करें', 'बंद करा')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(item);
                }}
                className="inline-flex items-center gap-0.5 px-3 py-1.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-extrabold shadow-xs cursor-pointer"
              >
                <span>{tr(lang, 'Open', 'खोलें', 'उघडा')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Auto-dismiss progress indicator */}
        {!paused && !item.speechBlockedHint && (
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden">
            <div
              key={item.id}
              className={`h-full ${theme.accentBar} animate-rs-toast-progress`}
              style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
