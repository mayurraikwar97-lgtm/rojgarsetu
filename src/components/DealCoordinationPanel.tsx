import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  getSixStepLabel,
  getToneChannelConfig,
  SIX_STEP_STAGE_ORDER,
  toSixStepDealStage,
  toVisibleDealStage,
} from '../lib/dealWorkflow';
import { getEffectiveDealStatus } from '../lib/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type { DealStatus, JobApplication, JobPosting, Language } from '../types/domain';
import { DealLiveLocationMap } from './DealLiveLocationMap';
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

  useEffect(() => {
    if (isAcceptedOrActive) setExpanded(true);
  }, [isAcceptedOrActive]);

  useEffect(() => {
    if (forceChatOpenKey > 0) setExpanded(true);
  }, [forceChatOpenKey]);

  const stepIndex =
    sixStage === 'CANCELLED' ? -1 : SIX_STEP_STAGE_ORDER.indexOf(sixStage);
  const isClosed = sixStage === 'CANCELLED';
  const counterpartyName =
    viewerRole === 'customer'
      ? application.workerName
      : application.customerName || job?.employerName || 'Customer';

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
    </div>
  );
};
