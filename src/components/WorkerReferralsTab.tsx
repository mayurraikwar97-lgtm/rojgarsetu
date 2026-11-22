import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Gift,
  IndianRupee,
  Info,
  Loader2,
  MessageCircle,
  Share2,
  ShieldCheck,
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
import type {
  Language,
  PlatformReferralConfig,
  PublicWorkerProfile,
  ReferralPayoutRecord,
  ReferralRewardRecord,
  ReferralWallet,
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
  const [referralCode, setReferralCode] = useState(workerProfile.referralCode || '');
  const [initializingCode, setInitializingCode] = useState(!workerProfile.referralCode);
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | 'msg' | null>(null);

  const [config, setConfig] = useState<PlatformReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [referrals, setReferrals] = useState<WorkerReferralRecord[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRecord[]>([]);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [payouts, setPayouts] = useState<ReferralPayoutRecord[]>([]);

  useEffect(() => {
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
  }, [workerProfile.ownerUid, workerProfile.referralCode]);

  useEffect(() => {
    const uCfg = subscribeReferralConfig(setConfig);
    const uDash = subscribeWorkerReferralDashboard(workerProfile.ownerUid, {
      onReferrals: setReferrals,
      onRewards: setRewards,
      onWallet: setWallet,
      onPayouts: setPayouts,
    });
    return () => {
      uCfg();
      uDash();
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
    const pendingInr =
      wallet?.pendingBalanceInr ??
      rewards.filter((r) => r.status === 'pending').reduce((s, r) => s + r.rewardAmountInr, 0);
    const approvedInr =
      wallet?.approvedBalanceInr ??
      rewards.filter((r) => r.status === 'approved').reduce((s, r) => s + r.rewardAmountInr, 0);
    const paidInr =
      wallet?.paidBalanceInr ??
      rewards.filter((r) => r.status === 'paid').reduce((s, r) => s + r.rewardAmountInr, 0);
    return {
      totalReferrals: Math.max(wallet?.totalReferrals || 0, referrals.length),
      pendingInr,
      approvedInr,
      paidInr,
    };
  }, [wallet, referrals.length, rewards]);

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

  return (
    <div className="space-y-5">
      {/* Free Registration Notice + Future ₹250 -> ₹50 Reward Architecture Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#0B3B75] shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-[#0B3B75] space-y-1">
          <div className="font-extrabold">
            {config.paidRegistrationEnabled
              ? tr(
                  lang,
                  `Referral Reward Program Active: ₹${config.referralRewardInr} reward per verified ₹${config.registrationFeeInr} paid registration`,
                  `रेफरल पुरस्कार सक्रिय: प्रत्येक सत्यापित ₹${config.registrationFeeInr} पंजीकरण पर ₹${config.referralRewardInr} पुरस्कार`,
                  `रेफरल बक्षीस योजना सुरू: प्रत्येक सत्यापित ₹${config.registrationFeeInr} नोंदणीवर ₹${config.referralRewardInr} बक्षीस`
                )
              : tr(
                  lang,
                  'Worker Registration is Currently 100% FREE — Build Your Referral Network Now!',
                  'कामगार पंजीकरण अभी 100% निःशुल्क है — अभी अपना रेफरल नेटवर्क बनाएँ!',
                  'कामगार नोंदणी सध्या 100% मोफत आहे — आजच तुमचे रेफरल नेटवर्क वाढवा!'
                )}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {lang === 'mr'
              ? config.programNoticeMr || DEFAULT_REFERRAL_CONFIG.programNoticeMr
              : lang === 'hi'
              ? config.programNoticeHi || DEFAULT_REFERRAL_CONFIG.programNoticeHi
              : config.programNoticeEn || DEFAULT_REFERRAL_CONFIG.programNoticeEn}
          </p>
        </div>
      </div>

      {/* Personal Referral Code & WhatsApp Sharing Card */}
      <section className="bg-white border-2 border-[#0B3B75] rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#E06D1B]">
              {tr(lang, 'MY REFERRALS', 'मेरे रेफरल', 'माझे रेफरल')}
            </div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
              {tr(
                lang,
                'Invite Fellow Workers on WhatsApp',
                'व्हाट्सएप पर साथी कामगारों को आमंत्रित करें',
                'व्हॉट्सॲपवर इतर कामगारांना निमंत्रित करा'
              )}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-bold">
            <Gift className="w-3.5 h-3.5" />
            <span>
              {tr(lang, 'Future Reward: ₹50 / Paid Referral', 'भविष्य पुरस्कार: ₹50 / सशुल्क रेफरल', 'भविष्य बक्षीस: ₹50 / सशुल्क रेफरल')}
            </span>
          </span>
        </div>

        {initializingCode ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#0B3B75]" />
            <span>{tr(lang, 'Generating your unique referral code...', 'आपका रेफरल कोड तैयार हो रहा है...', 'तुमचा युनिक रेफरल कोड तयार होत आहे...')}</span>
          </div>
        ) : (
          <>
            {/* Code & Link Boxes */}
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

            {/* Primary WhatsApp Share Button + Message Preview */}
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

      {/* Referral & Reward Summary Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <IndianRupee className="w-3.5 h-3.5 text-[#E06D1B]" />
            {tr(lang, 'Pending Rewards', 'लंबित पुरस्कार', 'प्रलंबित बक्षीस')}
          </div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#C25E00] mt-1">
            ₹{stats.pendingInr}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0B3B75]" />
            {tr(lang, 'Approved Rewards', 'स्वीकृत पुरस्कार', 'मंजूर बक्षीस')}
          </div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
            ₹{stats.approvedInr}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-[#15803D]" />
            {tr(lang, 'Paid Rewards', 'भुगतान किया गया', 'मिळालेले बक्षीस')}
          </div>
          <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
            ₹{stats.paidInr}
          </div>
        </div>
      </section>

      {/* Referral History Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
          {tr(lang, 'Workers Joined Through Your Link', 'आपके लिंक से जुड़े कामगार', 'तुमच्या लिंकवरून नोंदणी झालेले कामगार')} ({referrals.length})
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
            {referrals.map((ref) => (
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
                    Payment: <strong>{ref.registrationPaymentStatus.replace(/_/g, ' ')}</strong>
                    {ref.registrationFeePaidInr > 0 ? ` · ₹${ref.registrationFeePaidInr}` : ' · Free Launch'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                      ref.rewardStatus === 'paid'
                        ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                        : ref.rewardStatus === 'approved'
                        ? 'bg-blue-50 text-[#0B3B75] border border-blue-200'
                        : ref.rewardStatus === 'pending_verification'
                        ? 'bg-amber-50 text-[#C25E00] border border-amber-200'
                        : ref.rewardStatus === 'rejected'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {ref.rewardStatus.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono-tabular font-extrabold text-[#0B3B75]">
                    ₹{ref.rewardAmountInr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recorded Payouts History (if any) */}
      {payouts.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-extrabold text-[#15803D]">
            {tr(lang, 'Recorded Reward Payouts', 'दर्ज किए गए पुरस्कार भुगतान', 'जमा झालेल्या बक्षीस नोंदी')}
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {payouts.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#0B3B75]">
                    ₹{p.amountInr} · {p.payoutMethod.toUpperCase()}
                  </div>
                  <div className="text-slate-500">
                    Ref: <span className="font-mono-tabular">{p.transactionReference}</span> · {p.paidAt.slice(0, 10)}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#15803D] font-bold uppercase">
                  PAID
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Referral Terms & Conditions */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600">
        <div className="font-bold text-[#0B3B75] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
          <span>{tr(lang, 'Referral Program Terms & Fair-Use Rules', 'रेफरल नियम एवं शर्तें', 'रेफरल नियम व अटी')}</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {tr(
              lang,
              'Worker registration is currently FREE. No ₹250 fee is charged right now, and ₹0 reward is credited for free registrations.',
              'कामगार पंजीकरण अभी निःशुल्क है। अभी कोई ₹250 शुल्क नहीं है और निःशुल्क पंजीकरण पर ₹0 पुरस्कार है।',
              'कामगार नोंदणी सध्या मोफत आहे. सध्या ₹250 शुल्क आकारले जात नाही व मोफत नोंदणीवर ₹0 बक्षीस लागू आहे.'
            )}
          </li>
          <li>
            {tr(
              lang,
              'When paid registration (₹250) is activated in the future, each genuinely referred new worker who completes verified payment earns ₹50 reward after server verification and admin approval.',
              'भविष्य में ₹250 सशुल्क पंजीकरण सक्रिय होने पर प्रत्येक सत्यापित नए कामगार के पंजीकरण पर ₹50 पुरस्कार सत्यापन के बाद मिलेगा।',
              'भविष्यात ₹250 सशुल्क नोंदणी सुरू झाल्यावर प्रत्येक सत्यापित नवीन कामगाराच्या पेमेंटनंतर ₹50 बक्षीस अ‍ॅडमिन मंजुरीने जमा होईल.'
            )}
          </li>
          <li>
            {tr(
              lang,
              'Self-referrals, duplicate mobile numbers, refunded/cancelled registrations, and fake accounts are automatically rejected.',
              'स्वयं-रेफरल, डुप्लिकेट मोबाइल नंबर, रद्द या रिफंड पंजीकरण स्वतः अस्वीकृत कर दिए जाते हैं।',
              'स्वतःचा रेफरल, डुप्लिकेट मोबाईल नंबर, रद्द किंवा रिफंड केलेली नोंदणी आपोआप नाकारली जाते.'
            )}
          </li>
        </ul>
      </section>
    </div>
  );
};
