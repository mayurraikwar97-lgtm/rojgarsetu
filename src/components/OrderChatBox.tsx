import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { sendOrderMessage, subscribeOrderMessagesForParticipant } from '../lib/firestoreService';
import type { DealMessage, DealStatus, Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

interface OrderChatBoxProps {
  jobId: string;
  jobTitle: string;
  employerUid: string;
  workerUid: string;
  applicationId?: string;
  dealStatus?: DealStatus;
  viewerUid: string;
  viewerRole: 'customer' | 'worker';
  viewerName: string;
  counterpartyName?: string;
  readOnly?: boolean;
}

export const OrderChatBox: React.FC<OrderChatBoxProps> = ({
  jobId,
  jobTitle,
  employerUid,
  workerUid,
  applicationId,
  dealStatus,
  viewerUid,
  viewerRole,
  viewerName,
  counterpartyName,
  readOnly = false,
}) => {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');

  useEffect(() => {
    if (!jobId || !workerUid || !viewerUid) return;
    const unsub = subscribeOrderMessagesForParticipant({
      jobId,
      workerUid,
      viewerRole,
      viewerUid,
      onData: setMessages,
    });
    return () => unsub();
  }, [jobId, workerUid, viewerRole, viewerUid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || readOnly) return;
    setSending(true);
    setChatError('');
    try {
      const safeName =
        viewerName.trim().length >= 2
          ? viewerName.trim()
          : viewerRole === 'customer'
          ? 'Customer'
          : 'Worker';
      await sendOrderMessage({
        jobId,
        jobTitle,
        employerUid,
        workerUid,
        applicationId,
        dealStatus,
        senderUid: viewerUid,
        senderRole: viewerRole,
        senderName: safeName,
        text: draft.trim(),
      });
      setDraft('');
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : tr(
              lang,
              'Could not send message. Please try again.',
              'संदेश नहीं भेजा जा सका। कृपया पुनः प्रयास करें।',
              'संदेश पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.'
            )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-[#0B3B75]/25 bg-white p-3 space-y-2.5">
      <div className="flex items-center justify-between text-xs font-bold text-[#0B3B75]">
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#E06D1B]" />
          {counterpartyName
            ? tr(
                lang,
                `Order Chat with ${counterpartyName}`,
                `${counterpartyName} के साथ ऑर्डर चैट`,
                `${counterpartyName} सोबत ऑर्डर चॅट`
              )
            : tr(lang, 'Direct Order Chat', 'सीधी ऑर्डर चैट', 'थेट ऑर्डर चॅट')}{' '}
          ({messages.length})
        </span>
        {messages.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#15803D]">
            <CheckCircle2 className="w-3 h-3" />
            {tr(lang, 'Live', 'लाइव', 'लाइव्ह')}
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-1">
          {tr(
            lang,
            'No messages yet. Ask about work details, timing, or tools directly here.',
            'अभी कोई संदेश नहीं है। काम, समय या सामग्री के बारे में सीधे पूछें।',
            'अद्याप कोणतेही संदेश नाहीत. काम, वेळ किंवा साहित्याबद्दल येथे थेट विचारा.'
          )}
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
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
                  {m.senderName} ({m.senderRole === 'customer' ? tr(lang, 'Customer', 'ग्राहक', 'ग्राहक') : tr(lang, 'Worker', 'कामगार', 'कामगार')})
                </div>
                <div className="leading-snug">{m.text}</div>
              </div>
            );
          })}
        </div>
      )}

      {chatError && (
        <p className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
          {chatError}
        </p>
      )}

      {!readOnly && (
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tr(
              lang,
              'Type a message...',
              'संदेश लिखें...',
              'संदेश टाइप करा...'
            )}
            className="flex-1 min-h-[40px] px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="min-h-[40px] inline-flex items-center gap-1 px-3.5 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {tr(lang, 'Send', 'भेजें', 'पाठवा')}
          </button>
        </form>
      )}
    </div>
  );
};
