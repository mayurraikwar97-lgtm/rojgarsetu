import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  getToneChannelConfig,
  getVisibleDealStatusLabel,
  toVisibleDealStage,
  VISIBLE_DEAL_STAGE_ORDER,
} from '../lib/dealWorkflow';
import {
  getEffectiveDealStatus,
  sendDealMessage,
  subscribeDealMessages,
} from '../lib/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type { DealMessage, DealStatus, JobApplication, JobPosting, Language } from '../types/domain';
import { DealLiveLocationMap } from './DealLiveLocationMap';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

export function getDealStatusBadgeStyle(status: DealStatus | JobApplication): string {
  const stage =
    typeof status === 'string'
      ? toVisibleDealStage({ dealStatus: status, status })
      : toVisibleDealStage(status);
  switch (stage) {
    case 'WORK_CONFIRMED':
    case 'WORK_IN_PROGRESS':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'WORK_COMPLETED':
      return 'bg-[#0B3B75] text-white border-[#0B3B75]';
    case 'OFFER_SENT':
      return 'bg-amber-100 text-[#C25E00] border-amber-300';
    case 'CANCELLED':
      return 'bg-red-100 text-red-900 border-red-300';
    default:
      return 'bg-blue-100 text-[#0B3B75] border-blue-300';
  }
}

interface DealCoordinationPanelProps {
  application: JobApplication;
  job?: JobPosting;
  viewerUid: string;
  viewerRole: 'customer' | 'worker';
  viewerName: string;
  defaultExpanded?: boolean;
}

export const DealCoordinationPanel: React.FC<DealCoordinationPanelProps> = ({
  application,
  job,
  viewerUid,
  viewerRole,
  viewerName,
  defaultExpanded = false,
}) => {
  const { lang } = useLanguage();
  const effectiveStatus = getEffectiveDealStatus(application);
  const visibleStage = toVisibleDealStage(application);
  const visibleStatusLabel = getVisibleDealStatusLabel(effectiveStatus, lang);
  const isAcceptedOrActive =
    effectiveStatus === 'OFFER_ACCEPTED' ||
    effectiveStatus === 'DEAL_CONFIRMED' ||
    effectiveStatus === 'WORK_IN_PROGRESS';

  const [expanded, setExpanded] = useState(defaultExpanded || isAcceptedOrActive);
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isAcceptedOrActive) setExpanded(true);
  }, [isAcceptedOrActive]);

  useEffect(() => {
    if (!expanded) return;
    const unsub = subscribeDealMessages(application.id, setMessages);
    return () => unsub();
  }, [application.id, expanded]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendDealMessage({
        app: application,
        senderUid: viewerUid,
        senderRole: viewerRole,
        senderName: viewerName,
        text: draft.trim(),
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const stepIndex = VISIBLE_DEAL_STAGE_ORDER.indexOf(visibleStage);
  const isClosed = visibleStage === 'CANCELLED';

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
      {/* Synchronized Deal Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-bold ${getDealStatusBadgeStyle(
              effectiveStatus
            )}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {visibleStatusLabel}
          </span>
          {(application.offerAmount || application.proposedWage) > 0 && (
            <span className="text-xs font-mono-tabular font-bold text-[#15803D]">
              {application.agreedPrice
                ? `${tr(lang, 'Agreed', 'तय दर', 'निश्चित दर')}: ₹${application.agreedPrice.toLocaleString('en-IN')}`
                : `${tr(lang, 'Offer', 'ऑफर', 'ऑफर')}: ₹${(application.offerAmount ?? application.proposedWage).toLocaleString('en-IN')}`}
            </span>
          )}
          {application.estimatedArrivalTime && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              <Clock className="w-3 h-3 text-[#E06D1B]" />
              ETA: {application.estimatedArrivalTime}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {expanded
            ? tr(lang, 'Hide Chat & Live Map', 'चैट व मानचित्र छुपाएं', 'चॅट व नकाशा लपवा')
            : tr(lang, 'Open Chat & Live Location', 'चैट व लाइव लोकेशन खोलें', 'चॅट व लाइव्ह लोकेशन उघडा')}
        </button>
      </div>

      {/* Simplified 5-Step Deal Lifecycle Progress Bar */}
      {isClosed ? (
        <div
          className={`text-[11px] font-semibold px-2.5 py-1 rounded border inline-flex items-center gap-1.5 ${
            getToneChannelConfig('deal_cancelled').badgeColorClass
          }`}
        >
          {visibleStatusLabel}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          {VISIBLE_DEAL_STAGE_ORDER.map((stage, idx) => {
            const done = stepIndex >= idx;
            const stageLabel = getVisibleDealStatusLabel(stage, lang);
            return (
              <div key={stage} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    done ? 'bg-[#15803D]' : 'bg-slate-200'
                  }`}
                />
                <div
                  className={`text-[10px] leading-tight truncate text-center ${
                    done ? 'font-bold text-[#0B3B75]' : 'text-slate-400'
                  }`}
                  title={stageLabel}
                >
                  {stageLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Live Two-Way Location Map */}
          <DealLiveLocationMap
            application={application}
            job={job}
            viewerUid={viewerUid}
            viewerRole={viewerRole}
            viewerName={viewerName}
          />

          {/* Two-Way Real-Time Chat Thread */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#0B3B75]">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#E06D1B]" />
                {tr(lang, 'Direct Two-Way Deal Chat', 'दो-तरफ़ा सीधी बातचीत', 'दोन-मार्ग थेट संवाद')} (
                {messages.length})
              </span>
              {messages.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#15803D]">
                  <CheckCircle2 className="w-3 h-3" />
                  Synced Live
                </span>
              )}
            </div>

            {messages.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-1">
                {tr(
                  lang,
                  'No messages yet. Send a quick update about tools, landmark, or arrival.',
                  'अभी कोई संदेश नहीं है। काम या पहुंचने की जानकारी भेजें।',
                  'अद्याप कोणतेही संदेश नाहीत. कामाची किंवा पोहोचण्याची माहिती पाठवा.'
                )}
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {messages.map((m) => {
                  const isMine = m.senderUid === viewerUid;
                  return (
                    <div
                      key={m.id}
                      className={`p-2 rounded text-xs max-w-[88%] ${
                        isMine
                          ? 'ml-auto bg-[#0B3B75] text-white'
                          : 'mr-auto bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div
                        className={`text-[10px] font-bold mb-0.5 ${
                          isMine ? 'text-amber-300' : 'text-[#C25E00]'
                        }`}
                      >
                        {m.senderName} ({m.senderRole === 'customer' ? 'Customer' : 'Worker'})
                      </div>
                      <div className="leading-snug">{m.text}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isClosed && effectiveStatus !== 'WORK_COMPLETED' && (
              <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={tr(
                    lang,
                    'Type a message (notifies the other party immediately)...',
                    'संदेश लिखें...',
                    'संदेश टाइप करा...'
                  )}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  {tr(lang, 'Send', 'भेजें', 'पाठवा')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
