import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FlaskConical,
  Gift,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_REFERRAL_CONFIG,
  adminDecideReferralReward,
  adminRecordManualReferralPayout,
  adminSaveReferralConfig,
  adminVerifyPaidReferralAndCreateReward,
  callServerReferralEligibilityCheck,
  exportReferralsToCsv,
  subscribeAdminReferralsData,
  subscribeReferralConfig,
} from '../lib/adsReferralService';
import type {
  PlatformReferralConfig,
  ReferralPayoutRecord,
  ReferralRewardRecord,
  WorkerReferralRecord,
} from '../types/domain';

export const AdminReferralsPanel: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<PlatformReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [referrals, setReferrals] = useState<WorkerReferralRecord[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRecord[]>([]);
  const [payouts, setPayouts] = useState<ReferralPayoutRecord[]>([]);

  // Config editor state
  const [paidEnabled, setPaidEnabled] = useState(false);
  const [feeInr, setFeeInr] = useState(250);
  const [rewardInr, setRewardInr] = useState(50);
  const [holdingDays, setHoldingDays] = useState(7);
  const [savingCfg, setSavingCfg] = useState(false);

  // Manual Payout Modal state
  const [payoutTargetReward, setPayoutTargetReward] = useState<ReferralRewardRecord | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<ReferralPayoutRecord['payoutMethod']>('upi');
  const [payoutTxRef, setPayoutTxRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [recordingPayout, setRecordingPayout] = useState(false);

  // Paid Registration Verification / Test Simulator state
  const [simResults, setSimResults] = useState<
    Array<{ scenario: string; passed: boolean; detail: string }>
  >([]);
  const [runningSim, setRunningSim] = useState(false);

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
    const uData = subscribeAdminReferralsData({
      onReferrals: setReferrals,
      onRewards: setRewards,
      onPayouts: setPayouts,
    });
    return () => {
      uCfg();
      uData();
    };
  }, []);

  const kpis = useMemo(() => {
    const pendingInr = rewards.filter((r) => r.status === 'pending').reduce((s, r) => s + r.rewardAmountInr, 0);
    const approvedInr = rewards.filter((r) => r.status === 'approved').reduce((s, r) => s + r.rewardAmountInr, 0);
    const paidInr = rewards.filter((r) => r.status === 'paid').reduce((s, r) => s + r.rewardAmountInr, 0);
    return {
      totalReferrals: referrals.length,
      pendingInr,
      approvedInr,
      paidInr,
    };
  }, [referrals, rewards]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSavingCfg(true);
    setErrorMsg('');
    setFeedback('');
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
      setFeedback(
        paidEnabled
          ? `Paid registration config saved (ENABLED: ₹${feeInr} fee → ₹${rewardInr} reward).`
          : 'Referral config saved — Worker Registration remains 100% FREE (Paid Mode OFF).'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save referral settings.');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleVerifyPaidReferral = async (ref: WorkerReferralRecord) => {
    if (!user?.email) return;
    const payRef = window.prompt(
      `Enter verified payment gateway transaction ID for ₹${config.registrationFeeInr} paid by ${ref.referredWorkerName}:`
    );
    if (!payRef || payRef.trim().length < 4) return;

    setBusyId(ref.id);
    setErrorMsg('');
    setFeedback('');
    try {
      const res = await adminVerifyPaidReferralAndCreateReward({
        referral: ref,
        paymentReference: payRef.trim(),
        feePaidInr: config.registrationFeeInr,
        config,
        allReferrals: referrals,
        allRewards: rewards,
        adminUid: user.uid,
        adminEmail: user.email,
      });
      if (res.eligible) {
        setFeedback(res.reason);
      } else {
        setErrorMsg(res.reason);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleRewardDecision = async (rw: ReferralRewardRecord, decision: 'approved' | 'rejected') => {
    if (!user?.email) return;
    setBusyId(rw.id);
    setErrorMsg('');
    try {
      await adminDecideReferralReward({
        reward: rw,
        decision,
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(`Reward ₹${rw.rewardAmountInr} for ${rw.referrerName} marked ${decision.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update reward.');
    } finally {
      setBusyId('');
    }
  };

  const handleRecordPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetReward || !user?.email) return;
    if (payoutTxRef.trim().length < 3) {
      setErrorMsg('Please enter a real UTR / UPI / Bank Transaction Reference.');
      return;
    }
    setRecordingPayout(true);
    setErrorMsg('');
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
        `Manual payout ₹${payoutTargetReward.rewardAmountInr} recorded for ${payoutTargetReward.referrerName} (Ref: ${payoutTxRef.trim()}).`
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

  // Isolated Server-Side Verification of Part 14 Scenarios 8, 9, 10 (without charging live workers!)
  const handleRunServerVerificationSuite = async () => {
    setRunningSim(true);
    setSimResults([]);
    setErrorMsg('');
    try {
      const results: Array<{ scenario: string; passed: boolean; detail: string }> = [];

      // 1. Free Registration Launch -> ₹0 Reward
      const sFree = await callServerReferralEligibilityCheck({
        referrerUid: 'worker_prashant_01',
        referredUid: 'worker_ramesh_02',
        referrerMobileHash: 'hash_prashant_111',
        referredMobileHash: 'hash_ramesh_222',
        existingReferredMobileHashes: [],
        existingRewardReferralIds: [],
        referralId: 'sim_free_01',
        registrationPaymentStatus: 'free_launch',
        registrationFeePaidInr: 0,
        paidRegistrationEnabled: false,
        configuredFeeInr: 250,
        configuredRewardInr: 50,
        testSimulation: false,
      });
      results.push({
        scenario: 'Free Launch Registration (₹0 Fee)',
        passed: !sFree.eligible && sFree.rewardAmountInr === 0 && sFree.rewardStatus === 'free_not_eligible',
        detail: sFree.reason,
      });

      // 2. Simulated Verified ₹250 Paid Registration -> Server calculates ₹50 Reward
      const sPaid = await callServerReferralEligibilityCheck({
        referrerUid: 'worker_prashant_01',
        referredUid: 'worker_ramesh_02',
        referrerMobileHash: 'hash_prashant_111',
        referredMobileHash: 'hash_ramesh_222',
        existingReferredMobileHashes: [],
        existingRewardReferralIds: [],
        referralId: 'sim_paid_02',
        registrationPaymentStatus: 'paid_verified',
        registrationFeePaidInr: 250,
        paymentReference: 'SIM_RAZORPAY_250_OK',
        paidRegistrationEnabled: false,
        configuredFeeInr: 250,
        configuredRewardInr: 50,
        testSimulation: true,
      });
      results.push({
        scenario: 'Future Paid Mode Simulation (₹250 Verified → ₹50 Reward)',
        passed: sPaid.eligible && sPaid.rewardAmountInr === 50 && sPaid.rewardStatus === 'pending_verification',
        detail: sPaid.reason,
      });

      // 3. Self-Referral Attempt -> Blocked
      const sSelf = await callServerReferralEligibilityCheck({
        referrerUid: 'worker_prashant_01',
        referredUid: 'worker_prashant_01',
        referrerMobileHash: 'hash_prashant_111',
        referredMobileHash: 'hash_prashant_111',
        existingReferredMobileHashes: [],
        existingRewardReferralIds: [],
        referralId: 'sim_self_03',
        registrationPaymentStatus: 'paid_verified',
        registrationFeePaidInr: 250,
        paymentReference: 'SIM_SELF_REF',
        paidRegistrationEnabled: true,
        configuredFeeInr: 250,
        configuredRewardInr: 50,
        testSimulation: true,
      });
      results.push({
        scenario: 'Anti-Fraud: Self-Referral Blocked',
        passed: !sSelf.eligible && sSelf.rewardAmountInr === 0 && sSelf.fraudFlags.includes('SELF_REFERRAL_UID'),
        detail: sSelf.reason,
      });

      // 4. Duplicate Reward / Duplicate Mobile Attempt -> Blocked
      const sDup = await callServerReferralEligibilityCheck({
        referrerUid: 'worker_prashant_01',
        referredUid: 'worker_ramesh_02',
        referrerMobileHash: 'hash_prashant_111',
        referredMobileHash: 'hash_ramesh_222',
        existingReferredMobileHashes: [],
        existingRewardReferralIds: ['sim_paid_02'],
        referralId: 'sim_paid_02',
        registrationPaymentStatus: 'paid_verified',
        registrationFeePaidInr: 250,
        paymentReference: 'SIM_DUP_REWARD',
        paidRegistrationEnabled: true,
        configuredFeeInr: 250,
        configuredRewardInr: 50,
        testSimulation: true,
      });
      results.push({
        scenario: 'Anti-Fraud: Duplicate Reward Blocked',
        passed: !sDup.eligible && sDup.rewardAmountInr === 0 && sDup.fraudFlags.includes('DUPLICATE_REWARD_PAYOUT'),
        detail: sDup.reason,
      });

      // 5. Failed / Refunded Payment -> Blocked
      const sRefund = await callServerReferralEligibilityCheck({
        referrerUid: 'worker_prashant_01',
        referredUid: 'worker_suresh_03',
        referrerMobileHash: 'hash_prashant_111',
        referredMobileHash: 'hash_suresh_333',
        existingReferredMobileHashes: [],
        existingRewardReferralIds: [],
        referralId: 'sim_refund_05',
        registrationPaymentStatus: 'refunded',
        registrationFeePaidInr: 250,
        paymentReference: 'SIM_REFUND_05',
        paidRegistrationEnabled: true,
        configuredFeeInr: 250,
        configuredRewardInr: 50,
        testSimulation: true,
      });
      results.push({
        scenario: 'Anti-Fraud: Refunded / Cancelled Payment Blocked',
        passed: !sRefund.eligible && sRefund.rewardAmountInr === 0,
        detail: sRefund.reason,
      });

      setSimResults(results);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setRunningSim(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Referrals</div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
            {kpis.totalReferrals}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase text-slate-500">Pending Rewards</div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#C25E00] mt-1">
            ₹{kpis.pendingInr}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase text-slate-500">Approved (Unpaid)</div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
            ₹{kpis.approvedInr}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase text-slate-500">Recorded Paid</div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
            ₹{kpis.paidInr}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Future-Ready Paid Registration Config + Server-Side Fraud Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleSaveConfig}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#E06D1B]" />
              <span>Referral & Future Paid-Registration Config</span>
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                config.paidRegistrationEnabled
                  ? 'bg-amber-100 text-[#C25E00] border border-amber-300'
                  : 'bg-emerald-50 text-[#15803D] border border-emerald-200'
              }`}
            >
              {config.paidRegistrationEnabled ? 'PAID MODE ON' : 'FREE LAUNCH (OFF)'}
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
            <span>
              Keep Paid Registration <strong>OFF</strong> during Free Launch. When activated in the future, verified ₹{feeInr} paid registrations automatically qualify referrers for ₹{rewardInr} rewards after server-side fraud verification.
            </span>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-bold text-[#0B3B75] cursor-pointer">
            <input
              type="checkbox"
              checked={paidEnabled}
              onChange={(e) => setPaidEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Enable Future Paid Worker Registration (Default: OFF)</span>
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
              <label className="block font-bold text-slate-700 mb-1">Holding Days</label>
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
            <span>Save Referral Configuration</span>
          </button>
        </form>

        {/* Server-Side ₹250 -> ₹50 & Anti-Fraud Test Verification Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#15803D]" />
              <span>Server-Side ₹250 → ₹50 & Anti-Fraud Test Suite</span>
            </h3>
            <button
              type="button"
              disabled={runningSim}
              onClick={() => void handleRunServerVerificationSuite()}
              className="px-3.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {runningSim && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Run 5-Case Server Test</span>
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Safely tests backend reward calculation & fraud rejection against <code>/api/referrals/evaluate-eligibility</code> without charging live workers.
          </p>
          {simResults.length > 0 && (
            <div className="space-y-2 pt-1">
              {simResults.map((r) => (
                <div
                  key={r.scenario}
                  className={`p-2.5 rounded-lg border text-xs ${
                    r.passed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {r.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                    )}
                    <span>{r.scenario}</span>
                  </div>
                  <div className="text-[11px] opacity-85 mt-0.5">{r.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Worker Referrals Table + Export CSV */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
            All Worker Referrals ({referrals.length})
          </h3>
          <button
            type="button"
            onClick={() => exportReferralsToCsv(referrals, rewards)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B3B75] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Report</span>
          </button>
        </div>

        {referrals.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No worker referrals recorded yet. Workers can share their unique referral link from the "My Referrals" tab.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {referrals.map((ref) => (
              <div
                key={ref.id}
                className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[#0B3B75]">
                    {ref.referredWorkerName}{' '}
                    <span className="font-normal text-slate-500">({ref.referredRegistrationId})</span>
                    {' ← referred by '}
                    <span className="text-[#15803D]">{ref.referrerName}</span>{' '}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded">{ref.referralCode}</code>
                  </div>
                  <div className="text-slate-600">
                    Source: <strong>{ref.sourceChannel}</strong> · Payment:{' '}
                    <strong>{ref.registrationPaymentStatus}</strong> (₹{ref.registrationFeePaidInr}) · Reward:{' '}
                    <strong>{ref.rewardStatus}</strong> (₹{ref.rewardAmountInr})
                  </div>
                  {ref.fraudFlags && ref.fraudFlags.length > 0 && (
                    <div className="text-red-700 font-bold">Fraud Flags: {ref.fraudFlags.join(', ')}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {config.paidRegistrationEnabled &&
                    ref.registrationPaymentStatus !== 'paid_verified' &&
                    ref.rewardStatus !== 'paid' && (
                      <button
                        type="button"
                        disabled={busyId === ref.id}
                        onClick={() => void handleVerifyPaidReferral(ref)}
                        className="px-3 py-1.5 rounded bg-[#0B3B75] text-white font-bold cursor-pointer"
                      >
                        Verify ₹{config.registrationFeeInr} Payment
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referral Rewards Approval & Manual Payout Recording */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#15803D]" />
          <span>Referral Rewards & Manual Payout Queue ({rewards.length})</span>
        </h3>
        {rewards.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">
            No referral rewards generated yet (Worker registration is currently Free Launch mode).
          </p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {rewards.map((rw) => (
              <div
                key={rw.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-[#0B3B75]">
                    {rw.referrerName} · <span className="text-[#15803D]">₹{rw.rewardAmountInr}</span>{' '}
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] uppercase font-bold">
                      {rw.status}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    For worker: {rw.referredWorkerName} · Payment Ref: {rw.paymentReference || 'N/A'}
                  </div>
                  <div className="text-[11px] text-slate-500">{rw.eligibilityReason}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {rw.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === rw.id}
                        onClick={() => void handleRewardDecision(rw, 'approved')}
                        className="px-3 py-1.5 rounded bg-[#15803D] text-white font-bold cursor-pointer"
                      >
                        Approve Reward
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rw.id}
                        onClick={() => void handleRewardDecision(rw, 'rejected')}
                        className="px-3 py-1.5 rounded border border-red-300 text-red-700 font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {rw.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => setPayoutTargetReward(rw)}
                      className="px-3 py-1.5 rounded bg-[#E06D1B] text-white font-bold cursor-pointer"
                    >
                      Record Manual Payout
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Manual Payout Form */}
      {payoutTargetReward && (
        <form
          onSubmit={handleRecordPayoutSubmit}
          className="bg-amber-50 border-2 border-[#E06D1B] rounded-xl p-5 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-display text-sm font-extrabold text-[#0B3B75] flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-[#E06D1B]" />
              <span>
                Record Actual Payout: ₹{payoutTargetReward.rewardAmountInr} to {payoutTargetReward.referrerName}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setPayoutTargetReward(null)}
              className="text-slate-600 font-bold hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <p className="text-slate-700">
            Only record a payout AFTER transferring funds manually via UPI / Bank Transfer. Never mark unpaid rewards as paid.
          </p>
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

      {/* Recorded Payouts Audit Table */}
      {payouts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h4 className="font-display text-sm font-extrabold text-[#15803D] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Recorded Payout Transactions ({payouts.length})</span>
          </h4>
          <div className="divide-y divide-slate-100">
            {payouts.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                <span>
                  <strong>{p.referrerName}</strong> · ₹{p.amountInr} via {p.payoutMethod.toUpperCase()} · Ref:{' '}
                  <code>{p.transactionReference}</code>
                </span>
                <span className="text-slate-500 font-mono-tabular">{p.paidAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
