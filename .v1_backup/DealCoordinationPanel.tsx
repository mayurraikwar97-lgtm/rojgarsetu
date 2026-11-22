import React, { useEffect, useState } from 'react';
import {
  Clock,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  getToneChannelConfig,
  getVisibleDealStatusLabel,
  toVisibleDealStage,
  VISIBLE_DEAL_STAGE_ORDER,
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
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'LOCATION_SHARED':
      return 'bg-teal-100 text-teal-900 border-teal-300';
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
  const visibleStage = toVisibleDealStage(application, hasSharedLocation);
  const visibleStatusLabel = getVisibleDealStatusLabel(visibleStage, lang, hasSharedLocation);
  const isAcceptedOrActive =
    application.status === 'accepted' &&
    (effectiveStatus === 'OFFER_ACCEPTED' ||
      effectiveStatus === 'DEAL_CONFIRMED' ||
      effectiveStatus === 'WORK_IN_PROGRESS');

  const [expanded, setExpanded] = useState(defaultExpanded || isAcceptedOrActive);

  useEffect(() => {
    if (isAcceptedOrActive) setExpanded(true);
  }, [isAcceptedOrActive]);

  useEffect(() => {
    if (forceChatOpenKey > 0) setExpanded(true);
  }, [forceChatOpenKey]);

  const stepIndex = VISIBLE_DEAL_STAGE_ORDER.indexOf(visibleStage);
  const isClosed = visibleStage === 'CANCELLED';
  const counterpartyName =
    viewerRole === 'customer'
      ? application.workerName
      : application.customerName || job?.employerName || 'Customer';

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
      {/* Synchronized Deal Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-bold ${getDealStatusBadgeStyle(
              application,
              hasSharedLocation
            )}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {visibleStatusLabel}
          </span>
          {(application.offerAmount || application.proposedWage) > 0 && (
            <span className="text-xs font-mono-tabular font-bold text-[#15803D]">
              {application.agreedPrice
                ? `${tr(lang, 'Agreed', 'तय दर', 'निश्चित दर')}: ₹${application.agreedPrice.toLocaleString('en-IN')}`
                : `${tr(lang, 'Offer', 'ऑफर', 'ऑफर')}: ₹${(application.offerAmount ?? application.proposedWage).toLocaleString('en-IN')}${
                    application.travelCharges && application.travelCharges > 0
                      ? ` + ₹${application.travelCharges.toLocaleString('en-IN')} travel`
                      : ''
                  }`}
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
            ? isAcceptedOrActive
              ? tr(lang, 'Hide Chat & Share Location', 'चैट व लोकेशन छुपाएं', 'चॅट व लोकेशन लपवा')
              : tr(lang, 'Hide Chat', 'चैट छुपाएं', 'चॅट लपवा')
            : isAcceptedOrActive
            ? tr(lang, 'Open Chat & Share Location', 'चैट व लोकेशन खोलें', 'चॅट व लोकेशन उघडा')
            : tr(lang, 'Open Chat', 'चैट खोलें', 'चॅट उघडा')}
        </button>
      </div>

      {/* Simplified Deal Lifecycle Progress Bar */}
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
            const stageLabel = getVisibleDealStatusLabel(stage, lang, hasSharedLocation);
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
          {/* Unified Two-Way Real-Time Order Chat (available before and after offer acceptance) */}
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

          {/* Exact Location Sharing — STRICTLY SHOWN ONLY AFTER OFFER ACCEPTANCE */}
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
