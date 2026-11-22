import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import {
  canViewExactServiceAddress,
  getSafeCustomerLabelForJobOrApp,
} from '../lib/customerPrivacy';
import {
  getSixStepLabel,
  getToneChannelConfig,
  SIX_STEP_STAGE_ORDER,
  toSixStepDealStage,
  toVisibleDealStage,
} from '../lib/dealWorkflow';
import {
  getEffectiveDealStatus,
  getOrderExactAddress,
} from '../lib/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  DealStatus,
  JobApplication,
  JobPosting,
  Language,
  OrderExactAddressRecord,
} from '../types/domain';
import { DealLiveLocationMap } from './DealLiveLocationMap';
import { MaskedCallModal } from './MaskedCallModal';
import { OrderChatBox } from './OrderChatBox';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

export function getDealStatusBadgeStyle(
  status: DealStatus | JobApplication,
  hasSharedLocation = false
): string {
  const stage = toVisibleDealStage(status, hasSharedLocation);
  switch (stage) {
    case 'OFFER_ACCEPTED':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    case 'LOCATION_SHARED':
      return 'bg-sky-50 text-[#0B3B75] border-sky-200';
    case 'WORK_COMPLETED':
      return 'bg-[#0B3B75] text-white border-[#0B3B75]';
    case 'OFFER_SENT':
      return 'bg-amber-50 text-[#C25E00] border-amber-200';
    case 'CANCELLED':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

interface DealCoordinationPanelProps {
  application: JobApplication;
  job?: JobPosting;
  viewerUid: string;
  viewerRole: 'customer' | 'worker';
  viewerName: string;
  defaultExpanded?: boolean;
  forceChatOpenKey?: number;
}

export const DealCoordinationPanel: React.FC<DealCoordinationPanelProps> = ({
  application,
  job,
  viewerUid,
  viewerRole,
  viewerName,
  defaultExpanded = false,
  forceChatOpenKey = 0,
}) => {
  const { lang } = useLanguage();
  const [hasSharedLocation, setHasSharedLocation] = useState(false);
  const effectiveStatus = getEffectiveDealStatus(application);
  const sixStage = toSixStepDealStage(application, hasSharedLocation);
  const arrived = effectiveStatus === 'WORKER_ARRIVED';
  const currentStageLabel = getSixStepLabel(sixStage, lang, arrived);

  const isAcceptedOrActive =
    application.status === 'accepted' &&
    (effectiveStatus === 'OFFER_ACCEPTED' ||
      effectiveStatus === 'DEAL_CONFIRMED' ||
      effectiveStatus === 'WORKER_ON_THE_WAY' ||
      effectiveStatus === 'WORKER_ARRIVED' ||
      effectiveStatus === 'WORK_IN_PROGRESS');

  const [expanded, setExpanded] = useState(defaultExpanded || isAcceptedOrActive);
  const [maskedCallOpen, setMaskedCallOpen] = useState(false);
  const [exactAddressRecord, setExactAddressRecord] = useState<OrderExactAddressRecord | null>(null);

  useEffect(() => {
    if (isAcceptedOrActive) setExpanded(true);
  }, [isAcceptedOrActive]);

  useEffect(() => {
    if (forceChatOpenKey > 0) setExpanded(true);
  }, [forceChatOpenKey]);

  const exactAddressAllowed = canViewExactServiceAddress({
    viewerUid,
    job,
    app: application,
  });

  useEffect(() => {
    if (!exactAddressAllowed || !application.jobId) {
      setExactAddressRecord(null);
      return;
    }
    let active = true;
    void getOrderExactAddress(application.jobId).then((rec) => {
      if (active) setExactAddressRecord(rec);
    });
    return () => {
      active = false;
    };
  }, [exactAddressAllowed, application.jobId, application.status, application.dealStatus]);

  const stepIndex =
    sixStage === 'CANCELLED' ? -1 : SIX_STEP_STAGE_ORDER.indexOf(sixStage);
  const isClosed = sixStage === 'CANCELLED';
  const safeCustomerLabel = getSafeCustomerLabelForJobOrApp({
    job,
    app: application,
    viewerRole,
  });
  const counterpartyName =
    viewerRole === 'customer' ? application.workerName : safeCustomerLabel;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3.5">
      {/* Synchronized Status & Price Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${getDealStatusBadgeStyle(
              application,
              hasSharedLocation
            )}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {currentStageLabel}
          </span>
          {(application.offerAmount || application.proposedWage) > 0 && (
            <span className="text-xs font-mono-tabular font-extrabold text-[#15803D]">
              {application.agreedPrice
                ? `${tr(lang, 'Agreed', 'तय दर', 'निश्चित दर')}: ₹${application.agreedPrice.toLocaleString('en-IN')}`
                : `${tr(lang, 'Quote', 'ऑफर', 'दर')}: ₹${(application.offerAmount ?? application.proposedWage).toLocaleString('en-IN')}${
                    application.travelCharges && application.travelCharges > 0
                      ? ` + ₹${application.travelCharges.toLocaleString('en-IN')}`
                      : ''
                  }`}
            </span>
          )}
          {application.estimatedArrivalTime && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              <Clock className="w-3 h-3 text-[#E06D1B]" />
              {application.estimatedArrivalTime}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAcceptedOrActive && (
            <button
              type="button"
              onClick={() => setMaskedCallOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white text-xs font-extrabold cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{tr(lang, 'In-App Masked Call', 'मास्क्ड कॉल', 'मास्क्ड कॉल')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {expanded
              ? isAcceptedOrActive
                ? tr(lang, 'Hide Chat & Map', 'चैट व मैप छुपाएं', 'चॅट व नकाशा लपवा')
                : tr(lang, 'Hide Chat', 'चैट छुपाएं', 'चॅट लपवा')
              : isAcceptedOrActive
              ? tr(lang, 'Open Chat & Live Map', 'चैट व लाइव मैप खोलें', 'चॅट व लाइव्ह नकाशा उघडा')
              : tr(lang, 'Open Chat', 'चैट खोलें', 'चॅट उघडा')}
          </button>
        </div>
      </div>

      {/* Unified 6-Step Real-Time Job Progress Tracker */}
      {isClosed ? (
        <div
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border inline-flex items-center gap-1.5 ${
            getToneChannelConfig('deal_cancelled').badgeColorClass
          }`}
        >
          {currentStageLabel}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-0.5">
          {SIX_STEP_STAGE_ORDER.map((stage, idx) => {
            const done = stepIndex >= idx;
            const current = stepIndex === idx;
            const label = getSixStepLabel(stage, lang, arrived && stage === 'WORKER_ON_THE_WAY');
            return (
              <div key={stage} className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 ${
                      done
                        ? current
                          ? 'bg-[#E06D1B] text-white'
                          : 'bg-[#15803D] text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done && !current ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                  </div>
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      done ? (current ? 'bg-[#E06D1B]' : 'bg-[#15803D]') : 'bg-slate-200'
                    }`}
                  />
                </div>
                <div
                  className={`text-[10px] leading-tight ${
                    current
                      ? 'font-extrabold text-[#E06D1B]'
                      : done
                      ? 'font-bold text-[#0B3B75]'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Privacy-Gated Address Card: Approximate before confirmation, Exact ONLY after confirmation for assigned worker */}
          {!isAcceptedOrActive && viewerRole === 'worker' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2">
              <Lock className="w-4 h-4 text-[#E06D1B] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-extrabold">
                  {tr(lang, 'Approximate Area Only · Privacy Protected', 'केवल अनुमानित क्षेत्र · गोपनीयता सुरक्षित', 'फक्त अंदाजे परिसर · गोपनीयता सुरक्षित')}
                </div>
                <p className="text-[11px] text-amber-900">
                  {job?.approxLocationLabel || application.jobLocationLabel || application.jobDistrict} —{' '}
                  {tr(
                    lang,
                    'Exact service address and in-app masked calling unlock automatically once the customer confirms your offer.',
                    'ग्राहक द्वारा आपका ऑफर कन्फर्म करने के बाद ही सटीक पता व इन-ऐप मास्क्ड कॉल खुलेगा।',
                    'ग्राहकाने तुमचा दर निश्चित केल्यावरच अचूक पत्ता आणि इन-ॲप मास्क्ड कॉल उपलब्ध होईल.'
                  )}
                </p>
              </div>
            </div>
          )}

          {exactAddressAllowed && isAcceptedOrActive && exactAddressRecord && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-xs text-emerald-950 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-extrabold text-[#15803D] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Exact Service Address (Unlocked for Confirmed Order)',
                      'सटीक सेवा पता (कन्फर्म ऑर्डर हेतु अनलॉक)',
                      'अचूक सेवेचा पत्ता (निश्चित ऑर्डरसाठी खुला)'
                    )}
                  </span>
                </div>
                {Number.isFinite(exactAddressRecord.exactLat) && Number.isFinite(exactAddressRecord.exactLng) && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${exactAddressRecord.exactLat},${exactAddressRecord.exactLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#0B3B75] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{tr(lang, 'Navigate', 'रास्ता देखें', 'दिशा पहा')}</span>
                  </a>
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 break-words">
                {exactAddressRecord.exactAddress}
              </div>
              {exactAddressRecord.landmark && (
                <div className="text-[11px] text-slate-700">
                  <strong>{tr(lang, 'Landmark:', 'पास की पहचान:', 'जवळची खूण:')}</strong> {exactAddressRecord.landmark}
                </div>
              )}
              <div className="text-[10px] text-emerald-800">
                {tr(
                  lang,
                  'Personal mobile number stays masked. Use In-App Masked Call or Chat below.',
                  'व्यक्तिगत मोबाइल नंबर गोपनीय है। नीचे इन-ऐप मास्क्ड कॉल या चैट का उपयोग करें।',
                  'वैयक्तिक मोबाईल नंबर गोपनीय आहे. संवादासाठी इन-ॲप मास्क्ड कॉल किंवा चॅट वापरा.'
                )}
              </div>
            </div>
          )}

          {/* Two-Way Real-Time Order Chat */}
          <OrderChatBox
            jobId={application.jobId}
            jobTitle={application.jobTitle}
            employerUid={application.employerUid}
            workerUid={application.workerUid}
            applicationId={application.id}
            dealStatus={effectiveStatus}
            viewerUid={viewerUid}
            viewerRole={viewerRole}
            viewerName={viewerName}
            counterpartyName={counterpartyName}
            readOnly={isClosed || effectiveStatus === 'WORK_COMPLETED'}
          />

          {/* Exact Location Sharing & Live Map — STRICTLY UNLOCKED ONLY AFTER CUSTOMER CONFIRMS WORKER */}
          {isAcceptedOrActive && (
            <DealLiveLocationMap
              application={application}
              job={job}
              viewerUid={viewerUid}
              viewerRole={viewerRole}
              viewerName={viewerName}
              onLocationStatusChange={setHasSharedLocation}
            />
          )}
        </div>
      )}

      {/* In-App Masked Calling Modal (Zero personal mobile exposure) */}
      {isAcceptedOrActive && (
        <MaskedCallModal
          open={maskedCallOpen}
          onClose={() => setMaskedCallOpen(false)}
          application={application}
          viewerUid={viewerUid}
          viewerRole={viewerRole}
          callerSafeName={viewerName}
          receiverSafeName={counterpartyName}
        />
      )}
    </div>
  );
};
