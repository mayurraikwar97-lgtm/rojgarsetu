import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Gift,
  IndianRupee,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isWorkerRegistrationOtpEnabled } from '../lib/otpFeatureFlags';
import {
  DEFAULT_REFERRAL_CONFIG,
  adminRecordManualReferralPayout,
  adminSaveReferralConfig,
  exportReferralsToCsv,
  subscribeAdminReferralsData,
  subscribeReferralConfig,
} from '../lib/adsReferralService';
import {
  adminFetchPayoutSecret,
  adminMarkPaymentFailed,
  adminProcessWithdrawalRequest,
  adminRefundWorkerRegistrationPayment,
  adminUpdateReferralRewardStatus,
  adminVerifyWorkerRegistrationPayment,
  computeClientFinancialReport,
  exportFinancialLedgerCsv,
  exportRegistrationPaymentsCsv,
  exportWithdrawalsCsv,
  runServerFiveDemoWorkersVerification,
  subscribeAdminFinanceData,
  type ServerFiveDemoWorkersReport,
} from '../lib/workerPaymentService';
import type {
  FinancialLedgerEntry,
  PlatformReferralConfig,
  ReferralPayoutRecord,
  ReferralRewardRecord,
  ReferralWithdrawalRequest,
  RegistrationPaymentStatus,
  WorkerPayoutSecret,
  WorkerReferralRecord,
  WorkerRegistrationPayment,
} from '../types/domain';
import { PaymentStatusBadge } from './WorkerCertificateAndReceipt';

type FinanceSubTab = 'payments' | 'referrals' | 'withdrawals' | 'ledger' | 'verification';

export const AdminReferralsPanel: React.FC = () => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<FinanceSubTab>('payments');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'awaiting_approval' | RegistrationPaymentStatus>('all');

  const [config, setConfig] = useState<PlatformReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [payments, setPayments] = useState<WorkerRegistrationPayment[]>([]);
  const [referrals, setReferrals] = useState<WorkerReferralRecord[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRecord[]>([]);
  const [payouts, setPayouts] = useState<ReferralPayoutRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<ReferralWithdrawalRequest[]>([]);
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);

  // Config editor state
  const [paidEnabled, setPaidEnabled] = useState(true);
  const [feeInr, setFeeInr] = useState(250);
  const [rewardInr, setRewardInr] = useState(50);
  const [holdingDays, setHoldingDays] = useState(7);
  const [savingCfg, setSavingCfg] = useState(false);

  // Inline payment action state (no window.prompt!)
  const [activePaymentAction, setActivePaymentAction] = useState<{
    paymentId: string;
    mode: 'verify' | 'fail' | 'refund';
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [refundRefInput, setRefundRefInput] = useState('');
  const [autoApproveReferral, setAutoApproveReferral] = useState(true);

  // Inline reward reversal state
  const [reversingRewardId, setReversingRewardId] = useState('');
  const [reverseReason, setReverseReason] = useState('');

  // Inline withdrawal payout & secret reveal state
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, WorkerPayoutSecret | null>>({});
  const [loadingSecretId, setLoadingSecretId] = useState('');
  const [payingWithdrawalId, setPayingWithdrawalId] = useState('');
  const [withdrawalUtr, setWithdrawalUtr] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');

  // Legacy Direct Reward Manual Payout state
  const [payoutTargetReward, setPayoutTargetReward] = useState<ReferralRewardRecord | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<ReferralPayoutRecord['payoutMethod']>('upi');
  const [payoutTxRef, setPayoutTxRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [recordingPayout, setRecordingPayout] = useState(false);

  // 5-Demo-Worker Server Verification Suite
  const [demoReport, setDemoReport] = useState<ServerFiveDemoWorkersReport | null>(null);
  const [runningDemoSuite, setRunningDemoSuite] = useState(false);

  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const uCfg = subscribeReferralConfig((cfg) => {
      setConfig(cfg);
      setPaidEnabled(Boolean(cfg.paidRegistrationEnabled));
      setFeeInr(cfg.registrationFeeInr ?? 250);
      setRewardInr(cfg.referralRewardInr ?? 50);
      setHoldingDays(cfg.holdingDays ?? 7);
    });
    const uRef = subscribeAdminReferralsData({
      onReferrals: setReferrals,
      onRewards: setRewards,
      onPayouts: setPayouts,
    });
    const uFin = subscribeAdminFinanceData({
      onPayments: setPayments,
      onWithdrawals: setWithdrawals,
      onLedger: setLedger,
    });
    return () => {
      uCfg();
      uRef();
      uFin();
    };
  }, []);

  const financialReport = useMemo(
    () => computeClientFinancialReport({ payments, rewards, withdrawals }),
    [payments, rewards, withdrawals]
  );

  const awaitingApprovalCount = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.status === 'pending' ||
          (p.status === 'verified' && (!p.verifiedWorkerId || !p.certificateNo))
      ).length,
    [payments]
  );

  const filteredPayments = useMemo(() => {
    if (paymentStatusFilter === 'all') return payments;
    if (paymentStatusFilter === 'awaiting_approval') {
      return payments.filter(
        (p) =>
          p.status === 'pending' ||
          (p.status === 'verified' && (!p.verifiedWorkerId || !p.certificateNo))
      );
    }
    return payments.filter((p) => p.status === paymentStatusFilter);
  }, [payments, paymentStatusFilter]);

  const clearAlerts = () => {
    setFeedback('');
    setErrorMsg('');
  };

  const handleConfirmPaymentAction = async (payment: WorkerRegistrationPayment) => {
    if (!user?.email || !activePaymentAction) return;
    setBusyId(payment.id);
    clearAlerts();
    try {
      if (activePaymentAction.mode === 'verify') {
        const res = await adminVerifyWorkerRegistrationPayment({
          payment,
          config,
          allReferrals: referrals,
          allRewards: rewards,
          adminUid: user.uid,
          adminEmail: user.email,
          adminNotes: actionNotes,
          autoApproveReferral,
        });
        setFeedback(
          `Verified ₹${payment.amountInr} for ${payment.workerName}! Issued Worker ID ${res.verifiedWorkerId}, Receipt ${res.receiptNo}, Certificate ${res.certificateNo}. ${res.referralOutcome}`
        );
      } else if (activePaymentAction.mode === 'fail') {
        await adminMarkPaymentFailed({
          payment,
          reason: actionNotes || 'UTR could not be matched with official bank statement.',
          adminUid: user.uid,
        });
        setFeedback(`Marked ₹${payment.amountInr} payment for ${payment.workerName} as FAILED. Paid benefits remain blocked.`);
      } else if (activePaymentAction.mode === 'refund') {
        if (refundRefInput.trim().length < 3) {
          throw new Error('Please enter a refund transaction reference (UTR / Bank Refund Ref).');
        }
        const res = await adminRefundWorkerRegistrationPayment({
          payment,
          refundReference: refundRefInput.trim(),
          refundReason: actionNotes || 'Admin approved registration refund.',
          adminUid: user.uid,
          adminEmail: user.email,
        });
        setFeedback(
          `Refunded ₹${payment.amountInr} to ${payment.workerName} (Ref: ${refundRefInput.trim()}). Paid benefits deactivated.` +
            (res.rewardReversed ? ` Linked ₹${res.reversedAmountInr} referral reward automatically REVERSED.` : '')
        );
      }
      setActivePaymentAction(null);
      setActionNotes('');
      setRefundRefInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment action failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleRewardStatusUpdate = async (
    rw: ReferralRewardRecord,
    nextStatus: 'approved' | 'rejected' | 'held' | 'reversed',
    notes?: string
  ) => {
    if (!user?.email) return;
    setBusyId(rw.id);
    clearAlerts();
    try {
      await adminUpdateReferralRewardStatus({
        reward: rw,
        nextStatus,
        adminUid: user.uid,
        adminEmail: user.email,
        notes,
      });
      setFeedback(`Referral reward ₹${rw.rewardAmountInr} for ${rw.referrerName} marked ${nextStatus.toUpperCase()}.`);
      setReversingRewardId('');
      setReverseReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update reward status.');
    } finally {
      setBusyId('');
    }
  };

  const handleToggleRevealSecret = async (withdrawalId: string) => {
    if (withdrawalId in revealedSecrets) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[withdrawalId];
        return next;
      });
      return;
    }
    setLoadingSecretId(withdrawalId);
    setErrorMsg('');
    try {
      const sec = await adminFetchPayoutSecret(withdrawalId);
      setRevealedSecrets((prev) => ({ ...prev, [withdrawalId]: sec }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch private payout details.');
    } finally {
      setLoadingSecretId('');
    }
  };

  const handleWithdrawalDecision = async (
    w: ReferralWithdrawalRequest,
    nextStatus: 'approved' | 'paid' | 'rejected'
  ) => {
    if (!user?.email) return;
    setBusyId(w.id);
    clearAlerts();
    try {
      await adminProcessWithdrawalRequest({
        withdrawal: w,
        nextStatus,
        transactionReference: nextStatus === 'paid' ? withdrawalUtr.trim() : undefined,
        adminNotes: withdrawalNotes.trim() || undefined,
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(
        `Withdrawal ₹${w.amountInr} for ${w.workerName} marked ${nextStatus.toUpperCase()}` +
          (nextStatus === 'paid' ? ` (UTR: ${withdrawalUtr.trim()}).` : '.')
      );
      setPayingWithdrawalId('');
      setWithdrawalUtr('');
      setWithdrawalNotes('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process withdrawal.');
    } finally {
      setBusyId('');
    }
  };

  const handleRecordPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetReward || !user?.email) return;
    if (payoutTxRef.trim().length < 3) {
      setErrorMsg('Please enter a valid UTR / UPI / Bank Transaction Reference.');
      return;
    }
    setRecordingPayout(true);
    clearAlerts();
    try {
      await adminRecordManualReferralPayout({
        rewards: [payoutTargetReward],
        payoutMethod,
        transactionReference: payoutTxRef.trim(),
        notes: payoutNotes.trim(),
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(
        `Direct payout ₹${payoutTargetReward.rewardAmountInr} recorded for ${payoutTargetReward.referrerName} (Ref: ${payoutTxRef.trim()}).`
      );
      setPayoutTargetReward(null);
      setPayoutTxRef('');
      setPayoutNotes('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record payout.');
    } finally {
      setRecordingPayout(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSavingCfg(true);
    clearAlerts();
    try {
      await adminSaveReferralConfig(
        {
          paidRegistrationEnabled: paidEnabled,
          registrationFeeInr: feeInr,
          referralRewardInr: rewardInr,
          holdingDays,
        },
        user.uid,
        user.email
      );
      setFeedback(`Saved program settings (₹${feeInr} registration fee → ₹${rewardInr} single-level reward).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save program config.');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleRunFiveDemoSuite = async () => {
    setRunningDemoSuite(true);
    clearAlerts();
    try {
      const report = await runServerFiveDemoWorkersVerification();
      setDemoReport(report);
      if (report.allPassed) {
        setFeedback('All 5 Demo Worker end-to-end financial, anti-fraud, refund-reversal & withdrawal checks PASSED.');
      } else {
        setErrorMsg('One or more verification checks failed. Inspect the breakdown below.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to run server verification suite.');
    } finally {
      setRunningDemoSuite(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Always-Visible Financial Summary Report Card (Separating Revenue, Rewards, Refunds, Net Balance) */}
      <section className="bg-white border-2 border-[#0B3B75] rounded-2xl overflow-hidden shadow-xs">
        <div className="h-1.5 flex">
          <div className="flex-1 bg-[#E06D1B]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#15803D]" />
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E06D1B]">
                FINANCIAL SUMMARY &amp; RECONCILIATION REPORT
              </div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                ₹250 Worker Registration &amp; ₹50 Single-Level Referral Accounting
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportRegistrationPaymentsCsv(payments)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-[#0B3B75] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Payments CSV
              </button>
              <button
                type="button"
                onClick={() => exportReferralsToCsv(referrals, rewards)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-[#0B3B75] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Referrals CSV
              </button>
              <button
                type="button"
                onClick={() => exportWithdrawalsCsv(withdrawals)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-[#0B3B75] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Withdrawals CSV
              </button>
              <button
                type="button"
                onClick={() => exportFinancialLedgerCsv(ledger)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-[11px] font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Ledger CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-4">
              <div className="text-[11px] font-bold uppercase text-[#0B3B75]">1. Gross Registration Revenue</div>
              <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
                ₹{financialReport.grossRegistrationRevenueInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                Verified: <strong>{financialReport.verifiedRegistrationCount}</strong> · Pending:{' '}
                <strong>{financialReport.pendingRegistrationCount}</strong> · Failed:{' '}
                <strong>{financialReport.failedRegistrationCount}</strong>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4">
              <div className="text-[11px] font-bold uppercase text-[#C25E00]">2. Referral Rewards (Net)</div>
              <div className="font-mono-tabular text-2xl font-extrabold text-[#C25E00] mt-1">
                ₹{financialReport.referralRewardsNetInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                Gross: ₹{financialReport.referralRewardsGrossInr} · Reversed: ₹{financialReport.referralRewardsReversedInr}
              </div>
            </div>

            <div className="rounded-xl bg-red-50/70 border border-red-200 p-4">
              <div className="text-[11px] font-bold uppercase text-red-700">3. Registration Refunds</div>
              <div className="font-mono-tabular text-2xl font-extrabold text-red-700 mt-1">
                ₹{financialReport.refundsInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                Refunded Workers: <strong>{financialReport.refundedCount}</strong>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 border-2 border-[#15803D] p-4">
              <div className="text-[11px] font-bold uppercase text-[#15803D]">4. Net Balance</div>
              <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
                ₹{financialReport.netBalanceInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-900 mt-1">
                Withdrawals Paid: ₹{financialReport.withdrawalsPaidInr} · Pending: ₹{financialReport.withdrawalsPendingInr}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono-tabular">
            Formula: Net Balance (₹{financialReport.netBalanceInr}) = Gross Registration Revenue (₹
            {financialReport.grossRegistrationRevenueInr}) − Refunds (₹{financialReport.refundsInr}) − Net Referral
            Rewards (₹{financialReport.referralRewardsNetInr})
          </div>
        </div>
      </section>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            {
              id: 'payments',
              label: `₹250 Payments (${payments.length})`,
              badge: awaitingApprovalCount,
              icon: CreditCard,
            },
            {
              id: 'referrals',
              label: `Referrals & ₹50 Rewards (${referrals.length})`,
              badge: rewards.filter((r) => r.status === 'pending').length,
              icon: Gift,
            },
            {
              id: 'withdrawals',
              label: `Withdrawals (${withdrawals.length})`,
              badge: withdrawals.filter((w) => w.status === 'pending').length,
              icon: Wallet,
            },
            {
              id: 'ledger',
              label: `Financial Ledger (${ledger.length})`,
              badge: 0,
              icon: BookOpen,
            },
            {
              id: 'verification',
              label: '5-Demo-Worker Test & Config',
              badge: 0,
              icon: FlaskConical,
            },
          ] as Array<{
            id: FinanceSubTab;
            label: string;
            badge: number;
            icon: React.ComponentType<{ className?: string }>;
          }>
        ).map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                active
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-extrabold ${
                    active ? 'bg-[#E06D1B] text-white' : 'bg-amber-100 text-[#C25E00]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= SUB-TAB 1: ₹250 WORKER REGISTRATION PAYMENTS ================= */}
      {subTab === 'payments' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
              Worker ₹250 Registration Payments ({filteredPayments.length})
            </h3>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'awaiting_approval', label: `Awaiting Approval (${awaitingApprovalCount})` },
                  { id: 'verified', label: 'PAID' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'failed', label: 'Failed' },
                  { id: 'refunded', label: 'Refunded' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setPaymentStatusFilter(st.id)}
                  className={`px-3 py-1 rounded-md font-bold uppercase cursor-pointer ${
                    paymentStatusFilter === st.id
                      ? 'bg-[#E06D1B] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No worker registration payments matching this filter yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {filteredPayments.map((p) => {
                const isActionOpen = activePaymentAction?.paymentId === p.id;
                const isAdminApproved = p.status === 'verified' && Boolean(p.verifiedWorkerId && p.certificateNo);
                const isPaidAwaitingApproval = p.status === 'verified' && !isAdminApproved;
                const needsAdminApproval =
                  p.status === 'pending' || p.status === 'failed' || isPaidAwaitingApproval;
                const orderIdDisplay = p.gatewayOrderId || p.orderRef;
                const paymentIdDisplay = p.gatewayPaymentId || p.utrOrGatewayRef;
                return (
                  <div key={p.id} className="py-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-[#0B3B75]">{p.workerName}</span>
                          <PaymentStatusBadge status={p.status} />
                          {isPaidAwaitingApproval && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-[#9A3412] border border-amber-300 text-[10px] font-extrabold uppercase">
                              PAID · Awaiting Admin Approval
                            </span>
                          )}
                          {isAdminApproved && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#15803D] border border-emerald-300 text-[10px] font-extrabold uppercase">
                              Approved · ID &amp; Cert Issued
                            </span>
                          )}
                          <span className="font-mono-tabular font-extrabold text-[#15803D]">₹{p.amountInr}</span>
                          {p.otpVerified ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#15803D] border border-emerald-200 text-[10px] font-bold">
                              OTP Verified
                            </span>
                          ) : isWorkerRegistrationOtpEnabled() ? (
                            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                              OTP Missing
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold">
                              Direct Reg (No OTP)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">
                          {p.workerSkill} · {p.workerLocation} · Mobile: {p.workerMobileMasked}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-700">
                          Reg ID: <strong>{p.verifiedWorkerId || p.provisionalAppId}</strong> · Order ID:{' '}
                          <strong>{orderIdDisplay}</strong> · Payment ID: <strong>{paymentIdDisplay}</strong>
                          {p.payerUpiOrName ? ` · Payer: ${p.payerUpiOrName}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Method: <strong className="uppercase">{p.paymentMethod.replace(/_/g, ' ')}</strong>
                          {p.gatewaySignatureVerified ? ' · Razorpay Signature Verified' : ''}
                          {p.referredByCode ? ` · Referred By Code: ${p.referredByCode}` : ''}
                          {p.receiptNo ? ` · Receipt: ${p.receiptNo}` : ''}
                          {p.certificateNo ? ` · Cert: ${p.certificateNo}` : ''}
                          {p.refundReference ? ` · Refund Ref: ${p.refundReference}` : ''}
                        </div>
                        {p.adminNotes && (
                          <div className="text-[11px] text-amber-800 font-semibold">Notes: {p.adminNotes}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {needsAdminApproval && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setActivePaymentAction({ paymentId: p.id, mode: 'verify' });
                              setActionNotes('');
                              setAutoApproveReferral(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white font-bold cursor-pointer"
                          >
                            {isPaidAwaitingApproval
                              ? 'Approve & Generate Worker ID + Certificate'
                              : 'Verify ₹250 & Issue Worker ID'}
                          </button>
                        )}
                        {p.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setActivePaymentAction({ paymentId: p.id, mode: 'fail' });
                              setActionNotes('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold cursor-pointer"
                          >
                            Mark Failed
                          </button>
                        )}
                        {p.status === 'verified' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setActivePaymentAction({ paymentId: p.id, mode: 'refund' });
                              setRefundRefInput('');
                              setActionNotes('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refund ₹250
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Confirm Drawer (Verify / Fail / Refund) */}
                    {isActionOpen && activePaymentAction && (
                      <div className="rounded-xl bg-slate-50 border border-slate-300 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-[#0B3B75]">
                            {activePaymentAction.mode === 'verify'
                              ? isPaidAwaitingApproval
                                ? `Approve PAID Registration & Issue ID Card + Certificate for ${p.workerName} (Payment ID: ${paymentIdDisplay})`
                                : `Confirm Verification for ${p.workerName} (Ref: ${paymentIdDisplay})`
                              : activePaymentAction.mode === 'fail'
                              ? `Mark Payment Failed for ${p.workerName}`
                              : `Refund ₹${p.amountInr} & Automatically Reverse Linked ₹50 Referral Reward`}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActivePaymentAction(null)}
                            className="text-slate-500 hover:underline font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        {activePaymentAction.mode === 'verify' && (
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoApproveReferral}
                              onChange={(e) => setAutoApproveReferral(e.target.checked)}
                              className="rounded border-slate-300"
                            />
                            <span>
                              Auto-approve valid single-level ₹{config.referralRewardInr || 50} referral reward to
                              referrer&apos;s wallet (if referred)
                            </span>
                          </label>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activePaymentAction.mode === 'refund' && (
                            <input
                              type="text"
                              value={refundRefInput}
                              onChange={(e) => setRefundRefInput(e.target.value)}
                              placeholder="Bank / UPI Refund UTR Reference *"
                              className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                            />
                          )}
                          <input
                            type="text"
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder={
                              activePaymentAction.mode === 'verify'
                                ? 'Admin approval note (optional)'
                                : activePaymentAction.mode === 'fail'
                                ? 'Reason for payment failure *'
                                : 'Refund reason *'
                            }
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void handleConfirmPaymentAction(p)}
                          className={`px-4 py-2 rounded-lg text-white font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                            activePaymentAction.mode === 'verify'
                              ? 'bg-[#15803D] hover:bg-[#116830]'
                              : 'bg-red-700 hover:bg-red-800'
                          }`}
                        >
                          {busyId === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {activePaymentAction.mode === 'verify'
                              ? 'Confirm Approval & Generate Worker ID + Certificate'
                              : activePaymentAction.mode === 'fail'
                              ? 'Confirm Mark Failed'
                              : 'Confirm Refund & Reverse Referral Reward'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ================= SUB-TAB 2: REFERRALS & ₹50 REWARDS ================= */}
      {subTab === 'referrals' && (
        <div className="space-y-5">
          {/* Referral Relationships Table */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
              Single-Level Referral Relationships ({referrals.length})
            </h3>
            {referrals.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No worker referrals recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {referrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#0B3B75]">
                        {ref.referredWorkerName}{' '}
                        <span className="font-mono-tabular font-normal text-slate-500">
                          ({ref.referredRegistrationId})
                        </span>
                        {' ← directly referred by '}
                        <span className="text-[#15803D]">{ref.referrerName}</span>{' '}
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded">{ref.referralCode}</code>
                      </div>
                      <div className="text-slate-600">
                        Payment: <strong className="uppercase">{ref.registrationPaymentStatus.replace(/_/g, ' ')}</strong>{' '}
                        (₹{ref.registrationFeePaidInr}) · Reward:{' '}
                        <strong className="uppercase">{ref.rewardStatus.replace(/_/g, ' ')}</strong> (₹{ref.rewardAmountInr})
                      </div>
                      {ref.fraudFlags && ref.fraudFlags.length > 0 && (
                        <div className="text-red-700 font-bold">Fraud Flags: {ref.fraudFlags.join(', ')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ₹50 Referral Reward Transactions Approval / Hold / Reverse Queue */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-[#15803D]" />
              <span>₹50 Referral Reward Transactions ({rewards.length})</span>
            </h3>
            {rewards.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No referral rewards generated yet. Rewards are created automatically when a referred worker&apos;s ₹250
                payment is verified.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {rewards.map((rw) => (
                  <div key={rw.id} className="py-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#0B3B75] flex flex-wrap items-center gap-2">
                          <span>{rw.referrerName}</span>
                          <span className="font-mono-tabular text-[#15803D] font-extrabold">₹{rw.rewardAmountInr}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] uppercase font-extrabold">
                            {rw.status}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          Referred Worker: <strong>{rw.referredWorkerName}</strong> · Payment Ref:{' '}
                          <span className="font-mono-tabular">{rw.paymentReference || 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{rw.eligibilityReason}</div>
                        {rw.reversedReason && (
                          <div className="text-[11px] text-red-700 font-bold">Reversed: {rw.reversedReason}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {(rw.status === 'pending' || rw.status === 'held') && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === rw.id}
                              onClick={() => void handleRewardStatusUpdate(rw, 'approved')}
                              className="px-2.5 py-1.5 rounded bg-[#15803D] text-white font-bold cursor-pointer"
                            >
                              Approve ₹{rw.rewardAmountInr}
                            </button>
                            {rw.status !== 'held' && (
                              <button
                                type="button"
                                disabled={busyId === rw.id}
                                onClick={() => void handleRewardStatusUpdate(rw, 'held', 'Held for fraud review')}
                                className="px-2.5 py-1.5 rounded bg-amber-100 text-[#C25E00] font-bold cursor-pointer"
                              >
                                Hold
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyId === rw.id}
                              onClick={() => void handleRewardStatusUpdate(rw, 'rejected', 'Rejected by admin')}
                              className="px-2.5 py-1.5 rounded border border-red-300 text-red-700 font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {rw.status === 'approved' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPayoutTargetReward(rw)}
                              className="px-2.5 py-1.5 rounded bg-[#E06D1B] text-white font-bold cursor-pointer"
                            >
                              Direct Payout
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReversingRewardId(rw.id);
                                setReverseReason('');
                              }}
                              className="px-2.5 py-1.5 rounded border border-red-300 text-red-700 font-bold cursor-pointer"
                            >
                              Reverse
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {reversingRewardId === rw.id && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={reverseReason}
                          onChange={(e) => setReverseReason(e.target.value)}
                          placeholder="Reason for reversal (e.g., Fraud / Duplicate / Refund)"
                          className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded border border-red-300 bg-white"
                        />
                        <button
                          type="button"
                          disabled={busyId === rw.id}
                          onClick={() =>
                            void handleRewardStatusUpdate(
                              rw,
                              'reversed',
                              reverseReason || 'Fraud / compliance reversal by Admin'
                            )
                          }
                          className="px-3 py-1.5 rounded bg-red-700 text-white font-bold cursor-pointer"
                        >
                          Confirm Reverse
                        </button>
                        <button
                          type="button"
                          onClick={() => setReversingRewardId('')}
                          className="text-slate-600 font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Direct Payout Form */}
          {payoutTargetReward && (
            <form
              onSubmit={handleRecordPayoutSubmit}
              className="bg-amber-50 border-2 border-[#E06D1B] rounded-xl p-5 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-extrabold text-[#0B3B75]">
                  Record Direct Payout: ₹{payoutTargetReward.rewardAmountInr} to {payoutTargetReward.referrerName}
                </h4>
                <button
                  type="button"
                  onClick={() => setPayoutTargetReward(null)}
                  className="text-slate-600 font-bold hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as ReferralPayoutRecord['payoutMethod'])}
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="upi">UPI Transfer</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="cash_voucher">Cash / Office Receipt</option>
                </select>
                <input
                  type="text"
                  required
                  value={payoutTxRef}
                  onChange={(e) => setPayoutTxRef(e.target.value)}
                  placeholder="UTR / UPI Transaction ID *"
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={recordingPayout}
                className="px-5 py-2 rounded-lg bg-[#15803D] text-white font-extrabold cursor-pointer"
              >
                {recordingPayout ? 'Recording...' : 'Confirm & Record Paid Transaction'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ================= SUB-TAB 3: WORKER WITHDRAWAL REQUESTS ================= */}
      {subTab === 'withdrawals' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
              Worker Referral Withdrawal Requests ({withdrawals.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sensitive UPI IDs and Bank Account numbers remain masked by default. Authorized Admin can reveal them on
              demand to disburse payout.
            </p>
          </div>

          {withdrawals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No withdrawal requests submitted yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {withdrawals.map((w) => {
                const secret = revealedSecrets[w.id];
                const isRevealed = w.id in revealedSecrets;
                return (
                  <div key={w.id} className="py-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-[#0B3B75]">{w.workerName}</span>
                          <span className="font-mono-tabular text-sm font-extrabold text-[#15803D]">
                            ₹{w.amountInr}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              w.status === 'paid'
                                ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                : w.status === 'approved'
                                ? 'bg-blue-50 text-[#0B3B75] border border-blue-200'
                                : w.status === 'rejected'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-[#C25E00] border border-amber-200'
                            }`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <div className="text-slate-600 font-mono-tabular">
                          Code: {w.referralCode} · Destination: <strong>{w.maskedDestination}</strong>
                          {w.transactionReference ? ` · Paid UTR: ${w.transactionReference}` : ''}
                        </div>
                        {w.adminNotes && <div className="text-[11px] text-slate-500">Notes: {w.adminNotes}</div>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={loadingSecretId === w.id}
                          onClick={() => void handleToggleRevealSecret(w.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold text-[#0B3B75] cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{isRevealed ? 'Hide Payout Info' : 'Reveal Payout Info'}</span>
                        </button>

                        {w.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => void handleWithdrawalDecision(w, 'approved')}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0B3B75] text-white font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {(w.status === 'pending' || w.status === 'approved') && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPayingWithdrawalId(w.id);
                                setWithdrawalUtr('');
                                setWithdrawalNotes('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#15803D] text-white font-bold cursor-pointer"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              disabled={busyId === w.id}
                              onClick={() => void handleWithdrawalDecision(w, 'rejected')}
                              className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isRevealed && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-[#0B3B75] space-y-1">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                          <span>Authorized Admin View — Private Worker Payout Details</span>
                        </div>
                        {secret ? (
                          secret.payoutMethod === 'upi' ? (
                            <div className="font-mono-tabular">
                              UPI ID: <strong>{secret.upiId}</strong>
                            </div>
                          ) : (
                            <div className="font-mono-tabular space-y-0.5">
                              <div>
                                Account Holder: <strong>{secret.accountHolderName}</strong>
                              </div>
                              <div>
                                Account No: <strong>{secret.accountNumber}</strong> · IFSC:{' '}
                                <strong>{secret.ifscCode}</strong>
                                {secret.bankName ? ` · ${secret.bankName}` : ''}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="text-slate-600">No private payout record found for this withdrawal.</div>
                        )}
                      </div>
                    )}

                    {payingWithdrawalId === w.id && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2.5">
                        <div className="font-bold text-[#0B3B75]">
                          Settle ₹{w.amountInr} Payout to {w.workerName}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={withdrawalUtr}
                            onChange={(e) => setWithdrawalUtr(e.target.value)}
                            placeholder="Bank / UPI Transfer UTR Reference *"
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                          />
                          <input
                            type="text"
                            value={withdrawalNotes}
                            onChange={(e) => setWithdrawalNotes(e.target.value)}
                            placeholder="Optional payout note"
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => void handleWithdrawalDecision(w, 'paid')}
                            className="px-4 py-1.5 rounded-lg bg-[#15803D] text-white font-extrabold cursor-pointer"
                          >
                            Confirm Paid &amp; Log to Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayingWithdrawalId('')}
                            className="text-slate-600 font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ================= SUB-TAB 4: IMMUTABLE FINANCIAL LEDGER ================= */}
      {subTab === 'ledger' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
                Immutable Financial Transaction Ledger ({ledger.length})
              </h3>
              <p className="text-xs text-slate-500">
                Append-only accounting trail for all verified ₹250 registrations, refunds, ₹50 rewards, reversals, and
                settled withdrawals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportFinancialLedgerCsv(ledger)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3B75] text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Ledger CSV
            </button>
          </div>

          {ledger.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No financial ledger entries recorded yet. Entries are written automatically when Admin verifies payments,
              approves rewards, processes refunds, or settles withdrawals.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {ledger.map((e) => (
                <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          e.entryType === 'registration_payment'
                            ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                            : e.entryType === 'registration_refund'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : e.entryType === 'referral_reward_reversal'
                            ? 'bg-blue-50 text-[#0B3B75] border border-blue-200'
                            : 'bg-amber-50 text-[#C25E00] border border-amber-200'
                        }`}
                      >
                        {e.entryType.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-[#0B3B75]">{e.workerName}</span>
                      <span className="font-mono-tabular text-[11px] text-slate-500">Ref: {e.paymentOrUtrRef}</span>
                    </div>
                    <div className="text-slate-600">{e.description}</div>
                    <div className="text-[10px] text-slate-400">Recorded by: {e.recordedByEmail}</div>
                  </div>
                  <div
                    className={`font-mono-tabular text-sm font-extrabold shrink-0 ${
                      e.direction === 'credit' ? 'text-[#15803D]' : 'text-red-700'
                    }`}
                  >
                    {e.direction === 'credit' ? '+' : '−'}₹{e.amountInr}
                  </div>
                </div>
              ))}
            </div>
          )}

          {payouts.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="font-bold text-[#0B3B75]">Legacy Direct Payouts ({payouts.length})</div>
              {payouts.map((p) => (
                <div key={p.id} className="flex justify-between text-slate-600">
                  <span>
                    {p.referrerName} · ₹{p.amountInr} ({p.payoutMethod}) · {p.transactionReference}
                  </span>
                  <span>{p.paidAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= SUB-TAB 5: 5-DEMO-WORKER VERIFICATION SUITE & CONFIG ================= */}
      {subTab === 'verification' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Interactive 5-Demo-Worker End-to-End Verification Runner */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#15803D]" />
                  <span>5-Demo-Worker End-to-End Verification Suite</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifies ₹250 payment, single-level ₹50 referral, failed payment blocking, self-referral/duplicate/level-2
                  guards, refund + automatic ₹50 reversal, withdrawal payout, and exact Net Balance math on the server.
                </p>
              </div>
              <button
                type="button"
                disabled={runningDemoSuite}
                onClick={() => void handleRunFiveDemoSuite()}
                className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {runningDemoSuite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Run 5-Demo-Worker Audit</span>
              </button>
            </div>

            {demoReport && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
                    <div className="text-[10px] font-bold text-[#0B3B75] uppercase">Gross Revenue</div>
                    <div className="font-mono-tabular text-base font-extrabold text-[#0B3B75]">
                      ₹{demoReport.financialSummary.grossRegistrationRevenueInr}
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                    <div className="text-[10px] font-bold text-red-700 uppercase">Refunds</div>
                    <div className="font-mono-tabular text-base font-extrabold text-red-700">
                      ₹{demoReport.financialSummary.refundsInr}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <div className="text-[10px] font-bold text-[#C25E00] uppercase">Net Rewards</div>
                    <div className="font-mono-tabular text-base font-extrabold text-[#C25E00]">
                      ₹{demoReport.financialSummary.referralRewardsNetInr}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-2.5">
                    <div className="text-[10px] font-bold text-[#15803D] uppercase">Net Balance</div>
                    <div className="font-mono-tabular text-base font-extrabold text-[#15803D]">
                      ₹{demoReport.financialSummary.netBalanceInr}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {demoReport.steps.map((s) => (
                    <div
                      key={s.workerLabel}
                      className={`p-3 rounded-xl border text-xs ${
                        s.passed
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-red-50 border-red-200 text-red-950'
                      }`}
                    >
                      <div className="font-extrabold flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          {s.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span>{s.workerLabel}</span>
                        </span>
                        <span className="font-mono-tabular text-[11px] uppercase">
                          {s.paymentStatus} · Reward {s.rewardDeltaInr >= 0 ? `+₹${s.rewardDeltaInr}` : `−₹${Math.abs(s.rewardDeltaInr)}`}
                        </span>
                      </div>
                      <div className="font-semibold mt-0.5">{s.scenario}</div>
                      <div className="text-[11px] opacity-85 mt-0.5">{s.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Program Settings */}
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-extrabold text-[#0B3B75]">Program Settings</h3>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  config.paidRegistrationEnabled
                    ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                    : 'bg-amber-100 text-[#C25E00] border border-amber-300'
                }`}
              >
                {config.paidRegistrationEnabled ? '₹250 ACTIVE' : 'PAUSED'}
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-[#0B3B75] cursor-pointer">
              <input
                type="checkbox"
                checked={paidEnabled}
                onChange={(e) => setPaidEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Paid Registration &amp; Single-Level ₹50 Referral Active</span>
            </label>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reg. Fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={feeInr}
                  onChange={(e) => setFeeInr(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono-tabular font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reward (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={rewardInr}
                  onChange={(e) => setRewardInr(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono-tabular font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Refund Days</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={holdingDays}
                  onChange={(e) => setHoldingDays(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono-tabular font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingCfg}
              className="px-4 py-2 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {savingCfg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Program Configuration</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
