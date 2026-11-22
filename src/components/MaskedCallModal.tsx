import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  initiateMaskedCallSession,
  subscribeDealMaskedCalls,
  updateMaskedCallStatus,
} from '../lib/firestoreService';
import type {
  JobApplication,
  Language,
  MaskedCallSession,
} from '../types/domain';

interface MaskedCallModalProps {
  open: boolean;
  onClose: () => void;
  application: JobApplication;
  viewerUid: string;
  viewerRole: 'customer' | 'worker';
  callerSafeName: string;
  receiverSafeName: string;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const MaskedCallModal: React.FC<MaskedCallModalProps> = ({
  open,
  onClose,
  application,
  viewerUid,
  viewerRole,
  callerSafeName,
  receiverSafeName,
}) => {
  const { lang } = useLanguage();
  const [sessions, setSessions] = useState<MaskedCallSession[]>([]);
  const [activeSession, setActiveSession] = useState<MaskedCallSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeDealMaskedCalls(application.id, (items) => {
      setSessions(items);
      const live = items.find((s) => s.status === 'ringing' || s.status === 'connected') || null;
      setActiveSession(live);
    });
    return () => unsub();
  }, [open, application.id]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'connected') {
      setElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.status]);

  if (!open) return null;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const created = await initiateMaskedCallSession({
        application,
        callerUid: viewerUid,
        callerRole: viewerRole,
        callerSafeName,
        receiverSafeName,
      });
      setActiveSession(created);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tr(
              lang,
              'Unable to start in-app masked call right now.',
              'अभी इन-ऐप मास्क्ड कॉल शुरू नहीं हो सकी।',
              'सध्या इन-ॲप मास्क्ड कॉल सुरू करता आला नाही.'
            )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAnswerCall = async (session: MaskedCallSession) => {
    setBusy(true);
    setErrorMsg('');
    try {
      await updateMaskedCallStatus(session.id, 'connected');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to connect call.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndOrDecline = async (session: MaskedCallSession, nextStatus: 'ended' | 'declined') => {
    setBusy(true);
    setErrorMsg('');
    try {
      await updateMaskedCallStatus(session.id, nextStatus);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to end call.');
    } finally {
      setBusy(false);
    }
  };

  const isIncomingRinging =
    activeSession &&
    activeSession.status === 'ringing' &&
    activeSession.initiatedByUid !== viewerUid;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, 'In-App Masked Calling', 'इन-ऐप मास्क्ड कॉलिंग', 'इन-ॲप मास्क्ड कॉलिंग')}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        {/* Top bar */}
        <div className="bg-[#0B3B75] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold leading-tight">
                {tr(lang, 'In-App Masked Call', 'इन-ऐप सुरक्षित कॉल', 'इन-ॲप सुरक्षित मास्क्ड कॉल')}
              </h3>
              <p className="text-[11px] text-blue-200">
                {tr(
                  lang,
                  'Personal mobile numbers are completely hidden',
                  'व्यक्तिगत मोबाइल नंबर पूरी तरह गोपनीय रहता है',
                  'वैयक्तिक मोबाईल नंबर पूर्णपणे गोपनीय ठेवला जातो'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Privacy Guarantee Box */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2.5 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                {tr(lang, 'Privacy Shield Active', 'गोपनीयता सुरक्षा सक्रिय', 'गोपनीयता सुरक्षा सक्रिय')}
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                {tr(
                  lang,
                  'Both parties connect via a temporary Rojgar Setu masked relay bridge. No personal phone number is revealed to either user.',
                  'दोनों पक्ष अस्थायी रोजगार सेतु मास्क्ड ब्रिज से जुड़ते हैं। किसी का भी व्यक्तिगत नंबर नहीं दिखाया जाता।',
                  'दोन्ही पक्ष तात्पुरत्या रोजगार सेतू मास्क्ड ब्रिजद्वारे जोडले जातात. कोणाचाही वैयक्तिक मोबाईल नंबर दिसत नाही.'
                )}
              </p>
            </div>
          </div>

          {/* Counterparty Display */}
          <div className="text-center py-3 space-y-1.5">
            <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-[#0B3B75]/20 flex items-center justify-center mx-auto font-display text-2xl font-extrabold text-[#0B3B75]">
              {receiverSafeName.slice(0, 1).toUpperCase()}
            </div>
            <div className="font-display text-lg font-extrabold text-[#0B3B75]">
              {receiverSafeName}
            </div>
            <div className="text-xs font-mono-tabular text-slate-500">
              {activeSession
                ? `${tr(lang, 'Masked Bridge', 'मास्क्ड ब्रिज', 'मास्क्ड ब्रिज')}: ${activeSession.maskedVirtualNumber}`
                : tr(lang, 'Number Masked · In-App Bridge Ready', 'नंबर गोपनीय · इन-ऐप ब्रिज तैयार', 'नंबर गोपनीय · इन-ॲप ब्रिज तयार')}
            </div>
            {activeSession && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 text-[11px] font-mono-tabular font-bold text-[#0B3B75]">
                <span>{activeSession.maskedBridgeCode}</span>
                <span>·</span>
                <span className={activeSession.status === 'connected' ? 'text-[#15803D]' : 'text-[#E06D1B]'}>
                  {activeSession.status === 'connected'
                    ? `${tr(lang, 'Connected', 'कनेक्टेड', 'कनेक्टेड')} ${formatTimer(elapsedSec)}`
                    : tr(lang, 'Ringing in-app...', 'कॉल जा रही है...', 'इन-ॲप रिंग सुरू...')}
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Call Controls */}
          {!activeSession ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleStartCall}
              className="w-full h-12 rounded-xl bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              <span>
                {tr(
                  lang,
                  `Start Masked Call to ${receiverSafeName}`,
                  `${receiverSafeName} को मास्क्ड कॉल करें`,
                  `${receiverSafeName} यांना मास्क्ड कॉल करा`
                )}
              </span>
            </button>
          ) : isIncomingRinging ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAnswerCall(activeSession)}
                className="h-12 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{tr(lang, 'Answer', 'उठाएँ', 'उचला')}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleEndOrDecline(activeSession, 'declined')}
                className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{tr(lang, 'Decline', 'अस्वीकार', 'नकारा')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMuted((v) => !v)}
                  className={`h-11 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    muted
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{muted ? tr(lang, 'Muted', 'म्यूट', 'म्यूट') : tr(lang, 'Mic On', 'माइक चालू', 'माईक सुरू')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerOn((v) => !v)}
                  className={`h-11 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    speakerOn
                      ? 'bg-blue-50 border-blue-200 text-[#0B3B75]'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{tr(lang, 'Speaker', 'स्पीकर', 'स्पीकर')}</span>
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleEndOrDecline(activeSession, 'ended')}
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{tr(lang, 'End Masked Call', 'कॉल समाप्त करें', 'कॉल बंद करा')}</span>
              </button>
            </div>
          )}

          {/* Recent masked call log for this order */}
          {sessions.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tr(lang, 'Masked Call Activity', 'मास्क्ड कॉल गतिविधि', 'मास्क्ड कॉल इतिहास')}
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {sessions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5 text-slate-600"
                  >
                    <span className="font-semibold truncate">
                      {s.callerSafeName} → {s.receiverSafeName}
                    </span>
                    <span className="font-mono-tabular uppercase text-[10px] font-bold text-[#0B3B75] shrink-0">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
