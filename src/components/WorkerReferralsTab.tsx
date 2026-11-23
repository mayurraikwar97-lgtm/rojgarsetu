import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  IndianRupee,
  Loader2,
  Lock,
  MessageCircle,
  Share2,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  DEFAULT_REFERRAL_CONFIG,
  buildReferralShareMessage,
  buildReferralWhatsAppShareUrl,
  buildWorkerReferralLink,
  ensureWorkerReferralCode,
  subscribeReferralConfig,
  subscribeWorkerReferralDashboard,
} from '../lib/adsReferralService';
import {
  SINGLE_LEVEL_REFERRAL_REWARD_INR,
  WORKER_REGISTRATION_FEE_INR,
  isWorkerPaidBenefitsActive,
  subscribeWorkerWithdrawals,
  workerSubmitWithdrawalRequest,
} from '../lib/workerPaymentService';
import type {
  Language,
  PlatformReferralConfig,
  PublicWorkerProfile,
  ReferralPayoutRecord,
  ReferralRewardRecord,
  ReferralWallet,
  ReferralWithdrawalRequest,
  WorkerPrivateInfo,
  WorkerReferralRecord,
} from '../types/domain';

interface WorkerReferralsTabProps {
  workerProfile: PublicWorkerProfile;
  workerPrivate?: WorkerPrivateInfo | null;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const WorkerReferralsTab: React.FC<WorkerReferralsTabProps> = ({
  workerProfile,
  workerPrivate,
}) => {
  const { lang } = useLanguage();
  const isPaidVerified = isWorkerPaidBenefitsActive(workerProfile);

  const [referralCode, setReferralCode] = useState(workerProfile.referralCode || '');
  const [initializingCode, setInitializingCode] = useState(isPaidVerified && !workerProfile.referralCode);
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | 'msg' | null>(null);

  const [config, setConfig] = useState<PlatformReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [referrals, setReferrals] = useState<WorkerReferralRecord[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRecord[]>([]);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [payouts, setPayouts] = useState<ReferralPayoutRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<ReferralWithdrawalRequest[]>([]);

  // Withdrawal form state
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('50');
  const [upiId, setUpiId] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(workerProfile.displayName || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    if (!isPaidVerified) {
      setInitializingCode(false);
      return;
    }
    let active = true;
    setInitializingCode(true);
    void ensureWorkerReferralCode(workerProfile, workerPrivate)
      .then((code) => {
        if (active) {
          setReferralCode(code);
          setInitializingCode(false);
        }
      })
      .catch(() => {
        if (active) setInitializingCode(false);
      });
    return () => {
      active = false;
    };
  }, [isPaidVerified, workerProfile.ownerUid, workerProfile.referralCode]);

  useEffect(() => {
    const uCfg = subscribeReferralConfig(setConfig);
    const uDash = subscribeWorkerReferralDashboard(workerProfile.ownerUid, {
      onReferrals: setReferrals,
      onRewards: setRewards,
      onWallet: setWallet,
      onPayouts: setPayouts,
    });
    const uWd = subscribeWorkerWithdrawals(workerProfile.ownerUid, setWithdrawals);
    return () => {
      uCfg();
      uDash();
      uWd();
    };
  }, [workerProfile.ownerUid]);

  const personalLink = useMemo(
    () => (referralCode ? buildWorkerReferralLink(referralCode) : ''),
    [referralCode]
  );

  const whatsappUrl = useMemo(
    () => (referralCode ? buildReferralWhatsAppShareUrl(referralCode, lang) : '#'),
    [referralCode, lang]
  );

  const sharePreviewMessage = useMemo(
    () => (referralCode ? buildReferralShareMessage(referralCode, lang) : ''),
    [referralCode, lang]
  );

  const stats = useMemo(() => {
    const successfulReferrals = referrals.filter(
      (r) =>
        r.registrationPaymentStatus === 'paid_verified' &&
        r.rewardStatus !== 'rejected' &&
        r.rewardStatus !== 'reversed'
    ).length;
    const pendingReferrals = referrals.filter(
      (r) =>
        r.registrationPaymentStatus === 'payment_pending' ||
        r.rewardStatus === 'pending_verification'
    ).length;

    const pendingRewardsInr = rewards
      .filter((r) => r.status === 'pending' || r.status === 'held')
      .reduce((s, r) => s + r.rewardAmountInr, 0);
    const approvedRewardsInr = rewards
      .filter((r) => r.status === 'approved')
      .reduce((s, r) => s + r.rewardAmountInr, 0);
    const directPaidRewardsInr = rewards
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + r.rewardAmountInr, 0);
    const legacyDirectPaidInr = rewards
      .filter((r) => r.status === 'paid' && r.payoutId?.startsWith('pay_'))
      .reduce((s, r) => s + r.rewardAmountInr, 0);
    const reversedInr = rewards
      .filter((r) => r.status === 'reversed')
      .reduce((s, r) => s + r.rewardAmountInr, 0);

    const pendingWithdrawalInr = withdrawals
      .filter((w) => w.status === 'pending' || w.status === 'approved')
      .reduce((s, w) => s + w.amountInr, 0);
    const withdrawnInr = withdrawals
      .filter((w) => w.status === 'paid')
      .reduce((s, w) => s + w.amountInr, 0);

    const totalEarningsInr = Math.max(
      wallet?.totalEarnedInr ?? 0,
      approvedRewardsInr + directPaidRewardsInr
    );
    const computedAvailable = Math.max(
      0,
      approvedRewardsInr + directPaidRewardsInr - legacyDirectPaidInr - withdrawnInr - pendingWithdrawalInr
    );
    const availableBalanceInr =
      typeof wallet?.availableBalanceInr === 'number'
        ? Math.min(wallet.availableBalanceInr, computedAvailable)
        : computedAvailable;

    return {
      totalReferrals: Math.max(wallet?.totalReferrals || 0, referrals.length),
      successfulReferrals: Math.max(wallet?.verifiedPaidReferrals || 0, successfulReferrals),
      pendingReferrals: Math.max(wallet?.pendingReferrals || 0, pendingReferrals),
      totalEarningsInr,
      availableBalanceInr,
      pendingRewardsInr,
      pendingWithdrawalInr,
      withdrawnInr: withdrawnInr + legacyDirectPaidInr,
      reversedInr,
    };
  }, [wallet, referrals, rewards, withdrawals]);

  useEffect(() => {
    if (stats.availableBalanceInr >= 50) {
      setWithdrawAmount(String(stats.availableBalanceInr));
    }
  }, [stats.availableBalanceInr]);

  const copyText = async (text: string, which: 'code' | 'link' | 'msg') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(which);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');
    setSubmittingWithdraw(true);
    try {
      const id = await workerSubmitWithdrawalRequest({
        workerUid: workerProfile.ownerUid,
        workerName: workerProfile.displayName,
        referralCode: referralCode || workerProfile.referralCode || 'RS-CODE',
        amountInr: Number(withdrawAmount),
        availableBalanceInr: stats.availableBalanceInr,
        payoutMethod: withdrawMethod,
        upiId: withdrawMethod === 'upi' ? upiId : undefined,
        accountHolderName: withdrawMethod === 'bank_transfer' ? accountHolderName : undefined,
        accountNumber: withdrawMethod === 'bank_transfer' ? accountNumber : undefined,
        ifscCode: withdrawMethod === 'bank_transfer' ? ifscCode : undefined,
        bankName: withdrawMethod === 'bank_transfer' ? bankName : undefined,
      });
      setWithdrawSuccess(
        tr(
          lang,
          `Withdrawal request (${id}) submitted for ₹${Math.floor(Number(withdrawAmount))}. Admin will verify and settle directly to your UPI/Bank account.`,
          `₹${Math.floor(Number(withdrawAmount))} निकासी अनुरोध (${id}) दर्ज हो गया है। एडमिन सत्यापन के बाद राशि सीधे आपके खाते में भेजी जाएगी।`,
          `₹${Math.floor(Number(withdrawAmount))} पैसे काढण्याची विनंती (${id}) सादर झाली आहे. अ‍ॅडमिन तपासणीनंतर रक्कम तुमच्या खात्यात जमा होईल.`
        )
      );
      setUpiId('');
      setAccountNumber('');
      setIfscCode('');
      setBankName('');
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : 'Unable to submit withdrawal request.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Verification Gate for Unverified Workers */}
      {!isPaidVerified ? (
        <section className="bg-amber-50 border-2 border-[#E06D1B] rounded-2xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-[#E06D1B] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#C25E00]">
                {tr(lang, 'VERIFIED WORKERS ONLY', 'केवल सत्यापित कामगारों के लिए', 'फक्त सत्यापित कामगारांसाठी')}
              </div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  'Complete ₹250 Registration Verification to Unlock Your Referral Code & ₹50 Rewards',
                  'अपना रेफरल कोड और ₹50 पुरस्कार अनलॉक करने के लिए ₹250 पंजीकरण सत्यापन पूरा करें',
                  'तुमचा रेफरल कोड व ₹50 बक्षीस सुरू करण्यासाठी ₹250 नोंदणी सत्यापन पूर्ण करा'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {tr(
                  lang,
                  'Once your one-time ₹250 worker registration payment is verified in the Profile tab, your unique Referral Code, WhatsApp invite link, and Separate Referral Wallet (₹50 per directly referred verified worker) activate automatically.',
                  'प्रोफ़ाइल टैब में आपका एकमुश्त ₹250 भुगतान सत्यापित होते ही आपका रेफरल कोड, व्हाट्सएप लिंक और रेफरल वॉलेट (प्रत्येक सत्यापित सीधे रेफरल पर ₹50) अपने आप सक्रिय हो जाएगा।',
                  'प्रोफाईल टॅबमध्ये तुमचे ₹250 एकवेळ नोंदणी शुल्क सत्यापित होताच तुमचा युनिक रेफरल कोड, व्हॉट्सॲप लिंक आणि रेफरल वॉलेट (प्रत्येक थेट सत्यापित रेफरलवर ₹50) आपोआप सुरू होईल.'
                )}
              </p>
            </div>
          </div>
        </section>
      ) : (
        /* Personal Referral Code & WhatsApp Sharing Card */
        <section className="bg-white border-2 border-[#0B3B75] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#E06D1B]">
                {tr(lang, 'SINGLE-LEVEL REFERRAL PROGRAM', 'सिंगल-लेवल रेफरल प्रोग्राम', 'सिंगल-लेव्हल रेफरल योजना')} · “कामगार नाही, आपलीच माणसं!”
              </div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  `Invite Workers on WhatsApp · Earn ₹${config.referralRewardInr || SINGLE_LEVEL_REFERRAL_REWARD_INR} per Verified ₹${config.registrationFeeInr || WORKER_REGISTRATION_FEE_INR} Registration`,
                  `व्हाट्सएप पर साथियों को जोड़ें · प्रत्येक सत्यापित ₹${config.registrationFeeInr || WORKER_REGISTRATION_FEE_INR} पंजीकरण पर ₹${config.referralRewardInr || SINGLE_LEVEL_REFERRAL_REWARD_INR} कमाएँ`,
                  `व्हॉट्सॲपवर कामगारांना जोडा · प्रत्येक सत्यापित ₹${config.registrationFeeInr || WORKER_REGISTRATION_FEE_INR} नोंदणीवर ₹${config.referralRewardInr || SINGLE_LEVEL_REFERRAL_REWARD_INR} मिळवा`
                )}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-extrabold">
              <Gift className="w-3.5 h-3.5" />
              <span>₹{config.referralRewardInr || SINGLE_LEVEL_REFERRAL_REWARD_INR} Direct Referral</span>
            </span>
          </div>

          {initializingCode ? (
            <div className="flex items-center gap-2 text-sm text-slate-600 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#0B3B75]" />
              <span>{tr(lang, 'Generating your unique referral code...', 'आपका रेफरल कोड तैयार हो रहा है...', 'तुमचा युनिक रेफरल कोड तयार होत आहे...')}</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    {tr(lang, 'My Referral Code', 'मेरा रेफरल कोड', 'माझा रेफरल कोड')}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-lg font-extrabold text-[#0B3B75] tracking-wide">
                      {referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyText(referralCode, 'code')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-[#0B3B75] hover:bg-slate-100 cursor-pointer"
                    >
                      {copiedKey === 'code' ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    {tr(lang, 'My Personal Referral Link', 'मेरा व्यक्तिगत रेफरल लिंक', 'माझी वैयक्तिक रेफरल लिंक')}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="text-xs font-mono-tabular text-slate-700 truncate">
                      {personalLink}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyText(personalLink, 'link')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'link' ? tr(lang, 'Copied!', 'कॉपी हुआ!', 'कॉपी झाले!') : tr(lang, 'Copy Link', 'लिंक कॉपी करें', 'लिंक कॉपी करा')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {sharePreviewMessage}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#116830] text-white text-sm font-extrabold shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{tr(lang, 'Share on WhatsApp', 'व्हाट्सएप पर शेयर करें', 'व्हॉट्सॲपवर शेअर करा')}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyText(sharePreviewMessage, 'msg')}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-[#E06D1B]" />
                    <span>{copiedKey === 'msg' ? 'Message Copied!' : tr(lang, 'Copy Invite Message', 'संदेश कॉपी करें', 'संदेश कॉपी करा')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Separate Referral Wallet Summary Cards */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#15803D]" />
            <span>{tr(lang, 'Separate Referral Wallet', 'अलग रेफरल वॉलेट', 'स्वतंत्र रेफरल वॉलेट')}</span>
          </h3>
          {stats.reversedInr > 0 && (
            <span className="text-[11px] font-bold text-red-700">
              Reversed: ₹{stats.reversedInr}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#0B3B75]" />
              {tr(lang, 'Total Referrals', 'कुल रेफरल', 'एकूण रेफरल')}
            </div>
            <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
              {stats.totalReferrals}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
              {tr(lang, 'Successful', 'सफल रेफरल', 'यशस्वी रेफरल')}
            </div>
            <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
              {stats.successfulReferrals}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#E06D1B]" />
              {tr(lang, 'Pending', 'लंबित रेफरल', 'प्रलंबित रेफरल')}
            </div>
            <div className="font-mono-tabular text-2xl font-extrabold text-[#C25E00] mt-1">
              {stats.pendingReferrals}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-[#0B3B75]" />
              {tr(lang, 'Total Earnings', 'कुल कमाई', 'एकूण बक्षीस')}
            </div>
            <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
              ₹{stats.totalEarningsInr}
            </div>
            {stats.pendingRewardsInr > 0 && (
              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                +₹{stats.pendingRewardsInr} pending approval
              </div>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1 bg-emerald-50 border-2 border-[#15803D] rounded-xl p-4">
            <div className="text-[11px] font-bold text-[#15803D] uppercase flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {tr(lang, 'Available Balance', 'उपलब्ध शेष', 'उपलब्ध शिल्लक')}
            </div>
            <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
              ₹{stats.availableBalanceInr}
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
              Withdrawn: ₹{stats.withdrawnInr}
              {stats.pendingWithdrawalInr > 0 ? ` · Req: ₹${stats.pendingWithdrawalInr}` : ''}
            </div>
          </div>
        </div>
      </section>

      {/* Withdrawal Request Form (Private UPI / Bank Details Stored Securely) */}
      {isPaidVerified && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-extrabold text-[#0B3B75] flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-[#E06D1B]" />
                <span>{tr(lang, 'Request Referral Balance Withdrawal', 'रेफरल शेष निकासी अनुरोध', 'रेफरल रक्कम काढण्याची विनंती')}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr(
                  lang,
                  'Minimum withdrawal ₹50. Your UPI ID or Bank account details are stored privately and masked on all summaries.',
                  'न्यूनतम निकासी ₹50। आपका UPI या बैंक खाता विवरण सुरक्षित रूप से निजी रखा जाता है।',
                  'किमान ₹50 काढता येतात. तुमचा UPI किंवा बँक तपशील गोपनीय ठेवला जातो.'
                )}
              </p>
            </div>
            <div className="text-xs font-mono-tabular font-extrabold text-[#15803D] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              Available: ₹{stats.availableBalanceInr}
            </div>
          </div>

          <form onSubmit={handleWithdrawalSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payout Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('upi')}
                    className={`h-10 rounded-lg border font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      withdrawMethod === 'upi'
                        ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('bank_transfer')}
                    className={`h-10 rounded-lg border font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      withdrawMethod === 'bank_transfer'
                        ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Bank
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Withdrawal Amount (₹) *</label>
                <input
                  type="number"
                  min={50}
                  max={Math.max(50, stats.availableBalanceInr)}
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono-tabular font-bold text-sm text-[#0B3B75]"
                />
              </div>

              {withdrawMethod === 'upi' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Your UPI ID *</label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g., name@okaxis or 98xxxxxx12@ybl"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              )}
            </div>

            {withdrawMethod === 'bank_transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Account Number *</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 24))}
                    placeholder="Account number"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    placeholder="SBIN0001234"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono-tabular uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name (Optional)</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., State Bank of India"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>
            )}

            {withdrawError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}
            {withdrawSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingWithdraw || stats.availableBalanceInr < 50}
              className="h-11 px-5 rounded-xl bg-[#15803D] hover:bg-[#116830] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              {submittingWithdraw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              <span>
                {stats.availableBalanceInr < 50
                  ? tr(lang, 'Need at least ₹50 Available Balance to Withdraw', 'निकासी के लिए कम से कम ₹50 उपलब्ध होना चाहिए', 'पैसे काढण्यासाठी किमान ₹50 शिल्लक आवश्यक')
                  : tr(lang, 'Submit Withdrawal Request', 'निकासी अनुरोध भेजें', 'पैसे काढण्याची विनंती पाठवा')}
              </span>
            </button>
          </form>
        </section>
      )}

      {/* Withdrawal History */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
          {tr(lang, 'Withdrawal History', 'निकासी इतिहास', 'पैसे काढण्याचा इतिहास')} ({withdrawals.length})
        </h3>
        {withdrawals.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            {tr(lang, 'No withdrawal requests submitted yet.', 'अभी तक कोई निकासी अनुरोध नहीं है।', 'अद्याप कोणतीही पैसे काढण्याची विनंती नाही.')}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {withdrawals.map((w) => (
              <div key={w.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#0B3B75]">
                    ₹{w.amountInr} · {w.payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}{' '}
                    <span className="font-mono-tabular font-normal text-slate-500">({w.maskedDestination})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Request ID: <span className="font-mono-tabular">{w.id}</span>
                    {w.transactionReference ? ` · UTR: ${w.transactionReference}` : ''}
                    {w.paidAtIso ? ` · Paid ${w.paidAtIso.slice(0, 10)}` : ''}
                  </div>
                  {w.adminNotes && <div className="text-[11px] text-slate-600 mt-0.5">{w.adminNotes}</div>}
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase self-start sm:self-center ${
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
            ))}
          </div>
        )}
      </section>

      {/* Complete Referral & Reward Transaction History */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
          {tr(lang, 'Complete Referral Transaction History', 'संपूर्ण रेफरल लेनदेन इतिहास', 'संपूर्ण रेफरल व्यवहार इतिहास')} ({referrals.length})
        </h3>
        {referrals.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-500 py-4 text-center">
            {tr(
              lang,
              'No referrals recorded yet. Share your WhatsApp invite link with fellow skilled workers!',
              'अभी तक कोई रेफरल दर्ज नहीं है। अपने व्हाट्सएप लिंक से साथियों को जोड़ें!',
              'अद्याप कोणताही रेफरल नाही. तुमची व्हॉट्सॲप लिंक इतर कामगारांना शेअर करा!'
            )}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {referrals.map((ref) => {
              const linkedReward = rewards.find((rw) => rw.referralId === ref.id);
              const displayStatus = linkedReward?.status || ref.rewardStatus;
              return (
                <div
                  key={ref.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div>
                    <div className="font-bold text-[#0B3B75]">
                      {ref.referredWorkerName}{' '}
                      <span className="font-mono-tabular text-[11px] font-normal text-slate-500">
                        ({ref.referredRegistrationId})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Level 1 Direct · Reg Payment:{' '}
                      <strong className="uppercase">{ref.registrationPaymentStatus.replace(/_/g, ' ')}</strong>
                      {ref.registrationFeePaidInr > 0 ? ` (₹${ref.registrationFeePaidInr})` : ''}
                    </div>
                    {linkedReward?.reversedReason && (
                      <div className="text-[11px] text-red-700 font-semibold mt-0.5">
                        Reversed: {linkedReward.reversedReason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                        displayStatus === 'paid'
                          ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                          : displayStatus === 'approved'
                          ? 'bg-blue-50 text-[#0B3B75] border border-blue-200'
                          : displayStatus === 'pending' || displayStatus === 'pending_verification' || displayStatus === 'held'
                          ? 'bg-amber-50 text-[#C25E00] border border-amber-200'
                          : displayStatus === 'rejected' || displayStatus === 'reversed'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {displayStatus.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono-tabular font-extrabold text-[#0B3B75]">
                      ₹{displayStatus === 'reversed' || displayStatus === 'rejected' ? 0 : linkedReward?.rewardAmountInr ?? ref.rewardAmountInr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Legacy Direct Payouts (if any exist from prior records) */}
      {payouts.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h4 className="font-display text-sm font-extrabold text-[#15803D]">
            Direct Admin Payout Records ({payouts.length})
          </h4>
          <div className="divide-y divide-slate-100">
            {payouts.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                <span>
                  ₹{p.amountInr} · {p.payoutMethod.toUpperCase()} · Ref:{' '}
                  <span className="font-mono-tabular">{p.transactionReference}</span>
                </span>
                <span className="text-slate-500">{p.paidAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Single-Level Fair-Use Policy */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600">
        <div className="font-bold text-[#0B3B75] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
          <span>{tr(lang, 'Single-Level Referral Rules & Anti-Fraud Policy', 'सिंगल-लेवल रेफरल नियम एवं सुरक्षा नीति', 'सिंगल-लेव्हल रेफरल नियम व सुरक्षा धोरण')}</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Single-Level Direct Rewards Only:</strong> You earn ₹50 only for workers you directly refer who complete mobile OTP verification and verified ₹250 registration payment. No multi-level or chain commissions apply.
          </li>
          <li>
            <strong>Automatic Reversal on Refund or Fraud:</strong> Self-referrals, duplicate mobile accounts, unverified OTPs, failed payments, and refunded registrations earn ₹0 (any credited reward is automatically reversed upon refund).
          </li>
          <li>
            <strong>Admin Approval &amp; Payout Transparency:</strong> All rewards and withdrawals are audited in Rojgar Setu&apos;s financial ledger and paid via UPI or Bank Transfer.
          </li>
        </ul>
      </section>
    </div>
  );
};
