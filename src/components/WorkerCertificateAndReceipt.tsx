import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck2,
  IndianRupee,
  Loader2,
  Lock,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  SERVICE_RADIUS_STAGES,
  getLocalizedCategoryLabel,
} from '../lib/smartVoiceJobAlert';
import {
  WORKER_REGISTRATION_FEE_INR,
  createServerRegistrationOrder,
  fetchPaymentGatewayConfig,
  isWorkerPaidBenefitsActive,
  loadRazorpayCheckoutScript,
  submitWorkerRegistrationPaymentProof,
  verifyGatewaySignatureOnServer,
  type CreatedPaymentOrder,
  type PaymentGatewayPublicConfig,
} from '../lib/workerPaymentService';
import type {
  Language,
  PublicWorkerProfile,
  RegistrationPaymentStatus,
  ServiceRadiusKm,
  WorkerPrivateInfo,
  WorkerRegistrationPayment,
} from '../types/domain';
import { RojgarSetuLogo } from './RojgarSetuLogo';
import { SecureAvatar } from './SecureAvatar';

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: (resp: { error?: { description?: string; reason?: string } }) => void) => void;
}

interface RazorpayWindow {
  Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function formatIsoDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const PaymentStatusBadge: React.FC<{ status: RegistrationPaymentStatus; lang?: Language }> = ({
  status,
  lang = 'en',
}) => {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-extrabold uppercase">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {tr(lang, 'Verified', 'सत्यापित', 'सत्यापित')}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold uppercase">
        <XCircle className="w-3.5 h-3.5" />
        {tr(lang, 'Failed', 'विफल', 'अयशस्वी')}
      </span>
    );
  }
  if (status === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 text-xs font-extrabold uppercase">
        <RefreshCw className="w-3.5 h-3.5" />
        {tr(lang, 'Refunded', 'रिफंड किया गया', 'परतावा झाला')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[#C25E00] text-xs font-extrabold uppercase">
      <Clock className="w-3.5 h-3.5" />
      {tr(lang, 'Pending Verification', 'सत्यापन लंबित', 'सत्यापन प्रलंबित')}
    </span>
  );
};

interface WorkerPaymentCheckoutCardProps {
  workerUid: string;
  workerName: string;
  workerSkill: string;
  workerLocation: string;
  workerMobile: string;
  provisionalAppId: string;
  otpVerified: boolean;
  referredByCode?: string;
  referredByUid?: string;
  existingPayment?: WorkerRegistrationPayment | null;
  preAcceptedPolicies?: boolean;
  onPaymentSubmitted?: () => void;
}

export const WorkerPaymentCheckoutCard: React.FC<WorkerPaymentCheckoutCardProps> = ({
  workerUid,
  workerName,
  workerSkill,
  workerLocation,
  workerMobile,
  provisionalAppId,
  otpVerified,
  referredByCode,
  referredByUid,
  existingPayment,
  preAcceptedPolicies = false,
  onPaymentSubmitted,
}) => {
  const { lang } = useLanguage();
  const [config, setConfig] = useState<PaymentGatewayPublicConfig | null>(null);
  const [order, setOrder] = useState<CreatedPaymentOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [orderError, setOrderError] = useState('');

  const [utrInput, setUtrInput] = useState(existingPayment?.status === 'failed' ? '' : existingPayment?.utrOrGatewayRef || '');
  const [payerNameOrUpi, setPayerNameOrUpi] = useState(existingPayment?.payerUpiOrName || '');
  const [refundAccepted, setRefundAccepted] = useState(preAcceptedPolicies || Boolean(existingPayment?.refundPolicyAccepted));
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [launchingRazorpay, setLaunchingRazorpay] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const loadOrderAndQr = async () => {
    setLoadingOrder(true);
    setOrderError('');
    try {
      const [cfg, created] = await Promise.all([
        fetchPaymentGatewayConfig(),
        createServerRegistrationOrder(),
      ]);
      setConfig(cfg);
      setOrder(created);
      const dataUrl = await QRCode.toDataURL(created.upiUri, {
        width: 220,
        margin: 2,
        color: { dark: '#0B3B75', light: '#FFFFFF' },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Unable to initialize registration payment order.');
    } finally {
      setLoadingOrder(false);
    }
  };

  useEffect(() => {
    void loadOrderAndQr();
  }, [workerUid]);

  const handleCopyUpi = async () => {
    if (!order?.officialUpiId) return;
    try {
      await navigator.clipboard.writeText(order.officialUpiId);
      setCopiedUpi(true);
      window.setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const validateBeforePayment = (): boolean => {
    if (!order) {
      setSubmitError('Payment order is not initialized yet. Please retry.');
      return false;
    }
    if (!otpVerified) {
      setSubmitError(
        tr(
          lang,
          'Mobile OTP verification must be completed before paying the ₹250 registration fee.',
          '₹250 शुल्क भुगतान से पहले मोबाइल OTP सत्यापन अनिवार्य है।',
          '₹250 नोंदणी शुल्क भरण्यापूर्वी मोबाईल OTP सत्यापन आवश्यक आहे.'
        )
      );
      return false;
    }
    if (!refundAccepted) {
      setSubmitError(
        tr(
          lang,
          'Please accept the ₹250 Registration Refund Policy before proceeding.',
          'कृपया आगे बढ़ने से पहले ₹250 पंजीकरण रिफंड नीति स्वीकार करें।',
          'कृपया पुढे जाण्यापूर्वी ₹250 नोंदणी परतावा धोरण स्वीकारा.'
        )
      );
      return false;
    }
    return true;
  };

  const handlePayViaRazorpay = async () => {
    setSubmitError('');
    setSubmitSuccess('');
    if (!validateBeforePayment() || !order?.razorpayKeyId || !order.gatewayOrderId) return;

    setLaunchingRazorpay(true);
    try {
      const loaded = await loadRazorpayCheckoutScript();
      const RazorpayCtor = (window as unknown as RazorpayWindow).Razorpay;
      if (!loaded || !RazorpayCtor) {
        setSubmitError('Unable to load Razorpay Checkout script. Please check your internet connection and retry.');
        setLaunchingRazorpay(false);
        return;
      }

      const rzp = new RazorpayCtor({
        key: order.razorpayKeyId,
        amount: order.amountInr * 100,
        currency: 'INR',
        name: 'ROJGAR SETU',
        description: `One-Time Worker Registration Fee (₹${order.amountInr})`,
        order_id: order.gatewayOrderId,
        prefill: {
          name: workerName,
          contact: workerMobile.replace(/\D/g, '').slice(-10),
        },
        notes: {
          workerUid,
          orderRef: order.orderRef,
          provisionalAppId,
        },
        theme: { color: '#0B3B75' },
        modal: {
          ondismiss: () => {
            setLaunchingRazorpay(false);
            setSubmitError(
              tr(
                lang,
                'Payment window was closed before completion. Your registration remains pending — you can retry safely anytime.',
                'भुगतान पूरा होने से पहले विंडो बंद हो गई। आपका पंजीकरण लंबित है — आप कभी भी पुनः प्रयास कर सकते हैं।',
                'पेमेंट पूर्ण होण्यापूर्वी विंडो बंद झाली. तुमची नोंदणी प्रलंबित आहे — तुम्ही पुन्हा प्रयत्न करू शकता.'
              )
            );
          },
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const verification = await verifyGatewaySignatureOnServer({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderRef: order.orderRef,
            });
            setSubmitSuccess(
              verification.activatedOnServer
                ? tr(
                    lang,
                    `₹250 payment verified & captured! Verified Worker ID ${verification.verifiedWorkerId || ''} and Digital Registration Certificate are now active.${verification.referralCredited ? ' ₹50 referral reward credited.' : ''}`,
                    `₹250 भुगतान सत्यापित हो गया! आपका सत्यापित कामगार ID ${verification.verifiedWorkerId || ''} और पंजीकरण प्रमाणपत्र सक्रिय हो गया है।`,
                    `₹250 पेमेंट यशस्वीरित्या सत्यापित झाले! तुमचा सत्यापित कामगार ID ${verification.verifiedWorkerId || ''} आणि नोंदणी प्रमाणपत्र आता सुरू झाले आहे.`
                  )
                : tr(
                    lang,
                    'Razorpay payment signature and ₹250 capture verified on server! Syncing your verified account now.',
                    'Razorpay भुगतान सत्यापित हो गया! आपका खाता अपडेट हो रहा है।',
                    'Razorpay पेमेंट सर्व्हरवर सत्यापित झाले! तुमचे खाते अद्यतनित होत आहे.'
                  )
            );
            onPaymentSubmitted?.();
          } catch (verifyErr) {
            setSubmitError(
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Backend payment verification failed. If money was debited, Razorpay webhook will reconcile automatically.'
            );
          } finally {
            setLaunchingRazorpay(false);
          }
        },
      });

      rzp.on('payment.failed', (failResp) => {
        setLaunchingRazorpay(false);
        const desc = failResp?.error?.description || failResp?.error?.reason || 'Payment failed at gateway.';
        setSubmitError(
          tr(
            lang,
            `Payment failed: ${desc}. No paid benefits were activated. Please retry.`,
            `भुगतान विफल: ${desc}। कृपया पुनः प्रयास करें।`,
            `पेमेंट अयशस्वी: ${desc}. कृपया पुन्हा प्रयत्न करा.`
          )
        );
      });

      rzp.open();
    } catch (err) {
      setLaunchingRazorpay(false);
      setSubmitError(err instanceof Error ? err.message : 'Unable to launch Razorpay Checkout.');
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    if (!validateBeforePayment() || !order) return;

    setSubmitting(true);
    try {
      await submitWorkerRegistrationPaymentProof({
        workerUid,
        workerName,
        workerSkill,
        workerLocation,
        workerMobile,
        provisionalAppId,
        paymentMethod: 'upi_qr',
        orderRef: order.orderRef,
        utrOrGatewayRef: utrInput.trim(),
        payerUpiOrName: payerNameOrUpi.trim() || undefined,
        gatewayOrderId: order.gatewayOrderId,
        refundPolicyAccepted: refundAccepted,
        noEmploymentGuaranteeAccepted: true,
        otpVerified,
        referredByCode,
        referredByUid,
      });
      setSubmitSuccess(
        tr(
          lang,
          '₹250 UTR reference submitted! Status is PENDING VERIFICATION. Account activation happens ONLY after official bank/admin verification (screenshots are never used for activation).',
          '₹250 UTR विवरण जमा हो गया है! स्थिति: सत्यापन लंबित। बैंक/एडमिन सत्यापन के बाद ही खाता सक्रिय होगा।',
          '₹250 UTR तपशील सादर झाला आहे! स्थिती: सत्यापन प्रलंबित. अधिकृत बँक/अ‍ॅडमिन तपासणीनंतरच खाते सुरू होईल.'
        )
      );
      onPaymentSubmitted?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit payment details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (existingPayment?.status === 'verified') {
    return null;
  }

  return (
    <section className="bg-white border-2 border-[#0B3B75] rounded-2xl overflow-hidden shadow-xs">
      <div className="h-1.5 flex">
        <div className="flex-1 bg-[#E06D1B]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#15803D]" />
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E06D1B]">
              {tr(lang, 'MANDATORY ONE-TIME WORKER REGISTRATION FEE', 'अनिवार्य एकमुश्त कामगार पंजीकरण शुल्क', 'अनिवार्य एकवेळ कामगार नोंदणी शुल्क')}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75] flex items-center gap-1.5">
              <IndianRupee className="w-5 h-5 text-[#15803D]" />
              <span>₹{WORKER_REGISTRATION_FEE_INR}</span>
              <span className="text-sm font-bold text-slate-500">
                ({tr(lang, 'One-Time Only · Secure Gateway Verification', 'केवल एक बार · सुरक्षित सत्यापन', 'फक्त एकदाच · सुरक्षित सत्यापन')})
              </span>
            </h2>
            <p className="text-xs font-semibold text-[#15803D]">
              “कामगार नाही, आपलीच माणसं!” · {tr(lang, 'Application Ref:', 'आवेदन संख्या:', 'अर्ज क्रमांक:')}{' '}
              <span className="font-mono-tabular text-[#0B3B75]">{provisionalAppId}</span>
            </p>
          </div>

          {existingPayment ? (
            <PaymentStatusBadge status={existingPayment.status} lang={lang} />
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-[#C25E00] text-xs font-extrabold">
              <Lock className="w-3.5 h-3.5" />
              {tr(lang, 'Account Locked Until Payment Verified', 'सत्यापन तक खाता लॉक', 'पेमेंट सत्यापनापर्यंत खाते बंद')}
            </span>
          )}
        </div>

        {/* What ₹250 Covers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {[
            {
              icon: BadgeCheck,
              title: tr(lang, 'Unique Verified Worker ID', 'अद्वितीय सत्यापित कामगार ID', 'अद्वितीय सत्यापित कामगार ID'),
              desc: 'RS-W-XXXXXX',
            },
            {
              icon: CreditCard,
              title: tr(lang, 'Digital Worker ID Card', 'डिजिटल कामगार पहचान पत्र', 'डिजिटल कामगार ओळखपत्र'),
              desc: tr(lang, 'Printable Official Card', 'प्रिंट योग्य कार्ड', 'प्रिंट करण्यायोग्य कार्ड'),
            },
            {
              icon: Award,
              title: tr(lang, 'Registration Certificate', 'पंजीकरण प्रमाणपत्र', 'नोंदणी प्रमाणपत्र'),
              desc: tr(lang, 'Verified Certificate No.', 'प्रमाणपत्र क्रमांक सहित', 'प्रमाणपत्र क्रमांकासह'),
            },
            {
              icon: Receipt,
              title: tr(lang, 'Receipt + ₹50 Referral Code', 'रसीद + ₹50 रेफरल कोड', 'पावती + ₹50 रेफरल कोड'),
              desc: tr(lang, 'Single-Level Verified Rewards', 'सीधा सिंगल-लेवल रेफरल', 'थेट सिंगल-लेव्हल बक्षीस'),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
                <Icon className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#0B3B75]">{item.title}</div>
                  <div className="text-[11px] text-slate-500">{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mandatory Disclosures BEFORE payment */}
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 text-xs text-amber-950 space-y-2">
          <div className="font-extrabold flex items-center gap-1.5 text-[#0B3B75]">
            <AlertTriangle className="w-4 h-4 text-[#E06D1B] shrink-0" />
            <span>
              {tr(lang, 'What ₹250 Covers, Refund Policy & No Employment Guarantee', '₹250 शुल्क विवरण, रिफंड नीति और घोषणा', '₹250 शुल्काचे तपशील, परतावा धोरण व घोषणापत्र')}
            </span>
          </div>
          <p className="leading-relaxed">
            <strong>{tr(lang, 'Refund Policy:', 'रिफंड नीति:', 'परतावा धोरण:')}</strong>{' '}
            {config?.refundPolicySummary ||
              'One-time ₹250 registration fee is refundable only for verified duplicate/failed transactions or valid cancellation before benefit activation within 7 days. Refunded payments revoke paid benefits and reverse any ₹50 referral reward.'}
          </p>
          <p className="leading-relaxed">
            <strong>{tr(lang, 'No Employment Guarantee:', 'रोजगार की गारंटी नहीं:', 'रोजगाराची हमी नाही:')}</strong>{' '}
            {config?.noEmploymentGuaranteeNotice ||
              'Rojgar Setu connects workers with nearby customers and job opportunities. Paying ₹250 does NOT guarantee employment or fixed income.'}
          </p>
          <p className="leading-relaxed text-[#0B3B75] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-[#15803D]" />
            {tr(
              lang,
              'Security Policy: We never store card numbers or UPI PINs, and worker accounts are NEVER activated from payment screenshots.',
              'सुरक्षा नीति: हम कभी भी कार्ड नंबर या UPI PIN सहेजते नहीं हैं और भुगतान के स्क्रीनशॉट से खाता सक्रिय नहीं होता।',
              'सुरक्षा धोरण: कार्ड क्रमांक किंवा UPI PIN कधीही साठवला जात नाही आणि पेमेंट स्क्रीनशॉटवरून खाते कधीही सुरू केले जात नाही.'
            )}
          </p>
          <div className="space-y-1.5 pt-1 text-slate-800 border-t border-amber-200/70">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={refundAccepted}
                onChange={(e) => setRefundAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {tr(
                  lang,
                  'I have read and accept the ₹250 Registration Refund Policy.',
                  'मैंने ₹250 पंजीकरण रिफंड नीति पढ़ ली है और स्वीकार करता/करती हूँ।',
                  'मी ₹250 नोंदणी परतावा धोरण वाचले असून ते मला मान्य आहे.'
                )}{' '}
                *
              </span>
            </label>
          </div>
        </div>

        {existingPayment?.status === 'failed' && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">
                {tr(lang, 'Previous Payment Failed', 'पिछला भुगतान विफल रहा', 'मागील पेमेंट अयशस्वी झाले')}
              </div>
              <p className="mt-0.5">
                {existingPayment.adminNotes ||
                  tr(
                    lang,
                    'Your previous payment attempt could not be verified. Please retry below.',
                    'आपका पिछला भुगतान सत्यापित नहीं हो सका। कृपया नीचे पुनः प्रयास करें।',
                    'तुमचा मागील पेमेंट प्रयत्न सत्यापित होऊ शकला नाही. कृपया खाली पुन्हा प्रयत्न करा.'
                  )}
              </p>
            </div>
          </div>
        )}

        {existingPayment?.status === 'refunded' && (
          <div className="rounded-xl bg-slate-100 border border-slate-300 p-3.5 text-xs text-slate-800 flex items-start gap-2">
            <RefreshCw className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">
                {tr(lang, 'Registration Payment Refunded', 'पंजीकरण शुल्क रिफंड किया गया', 'नोंदणी शुल्क परत केले गेले आहे')}
              </div>
              <p className="mt-0.5">
                Ref: <span className="font-mono-tabular font-bold">{existingPayment.refundReference || 'N/A'}</span> ·{' '}
                {existingPayment.refundReason || 'Paid benefits and associated referral rewards have been deactivated.'}
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {existingPayment?.status !== 'refunded' && (
          <>
            {loadingOrder ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#0B3B75]" />
                <span>{tr(lang, 'Creating unique ₹250 server payment order...', '₹250 का सुरक्षित पेमेंट ऑर्डर तैयार हो रहा है...', '₹250 चा सुरक्षित पेमेंट ऑर्डर तयार होत आहे...')}</span>
              </div>
            ) : orderError ? (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-center justify-between gap-2">
                <span>{orderError}</span>
                <button
                  type="button"
                  onClick={() => void loadOrderAndQr()}
                  className="px-3 py-1.5 rounded-lg bg-[#0B3B75] text-white font-bold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : order ? (
              <div className="space-y-4">
                {/* Primary Razorpay Standard Checkout when configured on server */}
                {order.mode === 'gateway' && order.razorpayKeyId && order.gatewayOrderId ? (
                  <div className="rounded-xl border-2 border-[#15803D] bg-emerald-50/40 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold uppercase text-[#15803D] flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Razorpay Verified Checkout · UPI / Card / NetBanking</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono-tabular mt-0.5">
                          Order Ref: <strong>{order.orderRef}</strong> · Razorpay Order: <strong>{order.gatewayOrderId}</strong>
                        </div>
                      </div>
                      <span className="font-mono-tabular text-lg font-extrabold text-[#0B3B75]">₹{order.amountInr}</span>
                    </div>

                    <button
                      type="button"
                      disabled={launchingRazorpay}
                      onClick={() => void handlePayViaRazorpay()}
                      className="w-full h-12 rounded-xl bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      {launchingRazorpay ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      <span>
                        {tr(
                          lang,
                          `Pay ₹${order.amountInr} Securely via Razorpay (Instant Verification)`,
                          `Razorpay से ₹${order.amountInr} सुरक्षित भुगतान करें (तुरंत सत्यापन)`,
                          `Razorpay द्वारे ₹${order.amountInr} सुरक्षित भरा (तात्काळ सत्यापन)`
                        )}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-600 text-center">
                      Server verifies HMAC-SHA256 signature + captured ₹250 status with Razorpay before issuing your Worker ID &amp; Certificate.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-slate-800 space-y-1">
                    <div className="font-extrabold text-[#0B3B75]">
                      Online Razorpay Checkout Pending Server Keys · Approved Official UPI QR Active
                    </div>
                    <p>
                      Instant Razorpay Checkout activates automatically once <code className="font-mono-tabular font-bold">RAZORPAY_KEY_ID</code>,{' '}
                      <code className="font-mono-tabular font-bold">RAZORPAY_KEY_SECRET</code>, and{' '}
                      <code className="font-mono-tabular font-bold">RAZORPAY_WEBHOOK_SECRET</code> are configured on Vercel. Until then, you may pay via the Approved Official UPI QR below (activated strictly after Admin bank verification — never from screenshots).
                    </p>
                  </div>
                )}

                {/* Approved Official UPI QR + Strict Admin Bank Verification Fallback */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center space-y-3">
                    <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#0B3B75]">
                      <QrCode className="w-4 h-4 text-[#E06D1B]" />
                      <span>
                        {tr(lang, 'Approved Official UPI QR', 'अनुमोदित आधिकारिक UPI QR', 'मान्यताप्राप्त अधिकृत UPI QR')}
                      </span>
                    </div>

                    {qrDataUrl && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 inline-block shadow-2xs">
                        <img
                          src={qrDataUrl}
                          alt="Official Rojgar Setu ₹250 Registration UPI QR"
                          className="w-44 h-44 mx-auto"
                        />
                      </div>
                    )}

                    <div className="space-y-1 text-xs">
                      <div className="font-extrabold text-[#0B3B75]">{order.officialUpiPayeeName}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <code className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono-tabular font-bold text-slate-800">
                          {order.officialUpiId}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopyUpi()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-bold text-[#0B3B75] hover:bg-slate-100 cursor-pointer"
                        >
                          {copiedUpi ? <Check className="w-3 h-3 text-[#15803D]" /> : <Copy className="w-3 h-3" />}
                          {copiedUpi ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                        Order Ref: <strong>{order.orderRef}</strong> · Amount: <strong>₹{order.amountInr}</strong>
                      </div>
                    </div>

                    <a
                      href={order.upiUri}
                      className="w-full h-10 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>
                        {tr(lang, 'Open UPI App (₹250)', 'UPI ऐप खोलें (₹250)', 'UPI ॲप उघडा (₹250)')}
                      </span>
                    </a>
                  </div>

                  {/* UTR Submission Form (Strictly Pending Until Bank/Admin Verification) */}
                  <form onSubmit={handleSubmitProof} className="lg:col-span-7 space-y-3.5">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#0B3B75] mb-1">
                          {tr(
                            lang,
                            'UPI UTR / Bank Transaction Reference Number * (For Admin Bank Verification)',
                            'UPI UTR / ट्रांज़ैक्शन रेफ़रेंस नंबर * (एडमिन बैंक सत्यापन हेतु)',
                            'UPI UTR / बँक ट्रान्झॅक्शन क्रमांक * (अ‍ॅडमिन बँक तपासणीसाठी)'
                          )}
                        </label>
                        <input
                          type="text"
                          required
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 36))}
                          placeholder="e.g., 431298765432"
                          className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white font-mono-tabular text-sm font-bold text-[#0B3B75] focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {tr(
                            lang,
                            'Payer Name or UPI ID (Optional — helps faster admin bank matching)',
                            'भुगतानकर्ता का नाम या UPI ID (वैकल्पिक)',
                            'पेमेंट करणाऱ्याचे नाव किंवा UPI ID (ऐच्छिक)'
                          )}
                        </label>
                        <input
                          type="text"
                          value={payerNameOrUpi}
                          onChange={(e) => setPayerNameOrUpi(e.target.value.slice(0, 100))}
                          placeholder="e.g., Ramesh Patel / ramesh@okaxis"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-11 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                      <span>
                        {existingPayment?.status === 'pending'
                          ? tr(lang, 'Update ₹250 UTR Reference (Pending Admin Verification)', '₹250 UTR विवरण अपडेट करें', '₹250 UTR तपशील अद्यतनित करा')
                          : tr(lang, 'Submit ₹250 UTR Reference for Admin Bank Verification', 'एडमिन सत्यापन हेतु ₹250 UTR जमा करें', 'अ‍ॅडमिन तपासणीसाठी ₹250 UTR सादर करा')}
                      </span>
                    </button>

                    {/* Transaction History Summary for Current Worker */}
                    {existingPayment && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                        <div className="font-extrabold text-[#0B3B75] uppercase tracking-wide text-[11px]">
                          {tr(lang, 'Transaction History', 'भुगतान इतिहास', 'पेमेंट व्यवहार इतिहास')}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono-tabular text-slate-700">
                            {existingPayment.orderRef} · Ref: <strong>{existingPayment.utrOrGatewayRef}</strong>
                          </span>
                          <PaymentStatusBadge status={existingPayment.status} lang={lang} />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Amount: ₹{existingPayment.amountInr} · Method: {existingPayment.paymentMethod.replace(/_/g, ' ').toUpperCase()}
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

export const WorkerPaymentReceiptCard: React.FC<{
  payment: WorkerRegistrationPayment;
}> = ({ payment }) => {
  const { lang } = useLanguage();
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="bg-[#0B3B75] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-300" />
          <div>
            <div className="font-display text-sm font-extrabold tracking-wide">
              ROJGAR SETU · OFFICIAL PAYMENT RECEIPT
            </div>
            <div className="text-[11px] text-blue-100">
              Abujmad Foundation · “कामगार नाही, आपलीच माणसं!”
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{tr(lang, 'Print Receipt', 'रसीद प्रिंट करें', 'पावती प्रिंट करा')}</span>
        </button>
      </div>

      <div className="p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="text-slate-500">Receipt No.</div>
            <div className="font-mono-tabular text-sm font-extrabold text-[#0B3B75]">
              {payment.receiptNo || 'PROVISIONAL (Awaiting Verification)'}
            </div>
          </div>
          <PaymentStatusBadge status={payment.status} lang={lang} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div>
            <div className="text-slate-500">Worker Name</div>
            <div className="font-bold text-[#0B3B75] mt-0.5">{payment.workerName}</div>
          </div>
          <div>
            <div className="text-slate-500">Worker / App ID</div>
            <div className="font-mono-tabular font-bold text-[#C25E00] mt-0.5">
              {payment.verifiedWorkerId || payment.provisionalAppId}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Registration Fee Paid</div>
            <div className="font-mono-tabular text-base font-extrabold text-[#15803D] mt-0.5">
              ₹{payment.amountInr} (One-Time)
            </div>
          </div>
          <div>
            <div className="text-slate-500">Order Reference</div>
            <div className="font-mono-tabular font-semibold text-slate-800 mt-0.5">{payment.orderRef}</div>
          </div>
          <div>
            <div className="text-slate-500">UTR / Gateway Ref</div>
            <div className="font-mono-tabular font-semibold text-slate-800 mt-0.5">{payment.utrOrGatewayRef}</div>
          </div>
          <div>
            <div className="text-slate-500">Payment Method &amp; Date</div>
            <div className="font-semibold text-slate-800 mt-0.5 uppercase">
              {payment.paymentMethod.replace(/_/g, ' ')} · {formatIsoDate(payment.verifiedAtIso)}
            </div>
          </div>
        </div>

        {payment.status === 'refunded' && (
          <div className="rounded-lg bg-slate-100 border border-slate-300 px-3.5 py-2.5 text-slate-700">
            <strong>Refund Details:</strong> Ref{' '}
            <span className="font-mono-tabular font-bold">{payment.refundReference || 'N/A'}</span> ·{' '}
            {payment.refundReason || 'Refund processed by Admin.'}
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          <strong>Disclosure:</strong> This receipt acknowledges the one-time ₹250 worker registration payment on Rojgar Setu. Paid benefits (Verified Worker ID, Official Certificate &amp; Referral Rewards) remain active only while payment status is VERIFIED. Registration does not guarantee employment or fixed income.
        </p>
      </div>
    </section>
  );
};

export const WorkerRegistrationCertificateCard: React.FC<{
  workerProfile: PublicWorkerProfile;
  payment?: WorkerRegistrationPayment | null;
}> = ({ workerProfile, payment }) => {
  const { lang } = useLanguage();
  const isVerified = isWorkerPaidBenefitsActive(workerProfile);

  if (!isVerified) {
    return (
      <section className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-600">
        <Lock className="w-5 h-5 text-[#E06D1B] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-extrabold text-[#0B3B75] text-sm">
            {tr(
              lang,
              'Official Registration Certificate Locked Until ₹250 Payment Verification',
              '₹250 भुगतान सत्यापन तक आधिकारिक पंजीकरण प्रमाणपत्र लॉक है',
              '₹250 पेमेंट सत्यापन होईपर्यंत अधिकृत नोंदणी प्रमाणपत्र लॉक आहे'
            )}
          </div>
          <p>
            {tr(
              lang,
              'Once your one-time ₹250 registration fee is verified, your printable Official Rojgar Setu Worker Registration Certificate and Verified Worker ID (RS-W-...) will unlock here automatically.',
              'जैसे ही आपका एकमुश्त ₹250 शुल्क सत्यापित होता है, आपका प्रिंट योग्य आधिकारिक पंजीकरण प्रमाणपत्र और सत्यापित कामगार ID यहाँ खुल जाएगा।',
              'तुमचे ₹250 नोंदणी शुल्क सत्यापित होताच तुमचे अधिकृत नोंदणी प्रमाणपत्र आणि सत्यापित कामगार ID (RS-W-...) येथे आपोआप उपलब्ध होईल.'
            )}
          </p>
        </div>
      </section>
    );
  }

  const certNo =
    workerProfile.certificateNo ||
    payment?.certificateNo ||
    `RS-CERT-${new Date().getFullYear()}-${workerProfile.registrationId.replace(/[^A-Z0-9]/g, '').slice(-6)}`;

  return (
    <section className="bg-white border-2 border-[#0B3B75] rounded-2xl overflow-hidden shadow-xs">
      <div className="h-2 flex">
        <div className="flex-1 bg-[#E06D1B]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#15803D]" />
      </div>

      <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50/80 to-white space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <RojgarSetuLogo className="w-11 h-11" />
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#E06D1B]">
                ROJGAR SETU · ABUJMAD FOUNDATION
              </div>
              <h3 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75]">
                {tr(lang, 'OFFICIAL WORKER REGISTRATION CERTIFICATE', 'आधिकारिक कामगार पंजीकरण प्रमाणपत्र', 'अधिकृत कामगार नोंदणी प्रमाणपत्र')}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tr(lang, 'Print Certificate', 'प्रमाणपत्र प्रिंट करें', 'प्रमाणपत्र प्रिंट करा')}</span>
          </button>
        </div>

        <div className="text-center space-y-2 py-2">
          <div className="text-xs font-extrabold text-[#15803D]">“कामगार नाही, आपलीच माणसं!”</div>
          <p className="text-xs sm:text-sm text-slate-600">
            {tr(
              lang,
              'This is to certify that the skilled workforce member named below is officially registered and payment-verified on the Rojgar Setu Public-Service Employment Portal.',
              'यह प्रमाणित किया जाता है कि नीचे उल्लिखित कुशल कामगार रोजगार सेतु जन-सेवा पोर्टल पर आधिकारिक रूप से पंजीकृत एवं सत्यापित है।',
              'याद्वारे प्रमाणित करण्यात येते की खालील कुशल कामगार रोजगार सेतू जनसेवा पोर्टलवर अधिकृतपणे नोंदणीकृत व सत्यापित आहेत.'
            )}
          </p>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B3B75] pt-1">
            {workerProfile.displayName}
          </div>
          <div className="text-sm font-bold text-[#E06D1B]">
            {getLocalizedCategoryLabel(workerProfile.primarySkill, lang)} · {workerProfile.cityOrVillage}, {workerProfile.district}, {workerProfile.state}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-xl p-4 text-xs">
          <div>
            <div className="text-slate-500">Verified Worker ID</div>
            <div className="font-mono-tabular text-sm font-extrabold text-[#0B3B75] mt-0.5">
              {workerProfile.registrationId}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Certificate Number</div>
            <div className="font-mono-tabular text-sm font-extrabold text-[#15803D] mt-0.5">
              {certNo}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Verified On</div>
            <div className="font-semibold text-slate-800 mt-0.5">
              {formatIsoDate(workerProfile.verifiedAtIso || payment?.verifiedAtIso)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-bold text-[#15803D]">
            <ShieldCheck className="w-4 h-4" />
            Verified via Rojgar Setu Digital Registry
          </span>
          <span>
            Note: Registration certifies verified listing on Rojgar Setu and does not guarantee employment.
          </span>
        </div>
      </div>
    </section>
  );
};

export const WorkerDigitalIdCard: React.FC<{
  workerProfile: PublicWorkerProfile;
  workerPrivate?: WorkerPrivateInfo | null;
  payment?: WorkerRegistrationPayment | null;
  onEditProfile?: () => void;
  onUpdateRadius?: (km: ServiceRadiusKm) => Promise<void>;
  updatingRadius?: boolean;
}> = ({
  workerProfile,
  workerPrivate,
  payment,
  onEditProfile,
  onUpdateRadius,
  updatingRadius = false,
}) => {
  const { lang } = useLanguage();
  const isPaidVerified = isWorkerPaidBenefitsActive(workerProfile);
  const effectiveStatus: RegistrationPaymentStatus =
    payment?.status ||
    workerProfile.registrationPaymentStatus ||
    (isPaidVerified ? 'verified' : 'pending');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="h-1.5 flex">
        <div className="flex-1 bg-[#E06D1B]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#15803D]" />
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <RojgarSetuLogo className="w-9 h-9" />
            <div>
              <div className="font-display text-sm font-extrabold text-[#0B3B75]">
                ROJGAR SETU · DIGITAL WORKER IDENTITY CARD
              </div>
              <div className="text-xs font-mono-tabular font-bold text-[#E06D1B]">
                {isPaidVerified ? 'Verified Worker ID: ' : 'Provisional App ID: '}
                {workerProfile.registrationId}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={effectiveStatus} lang={lang} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {tr(lang, 'Print ID', 'ID प्रिंट करें', 'ID प्रिंट करा')}
            </button>
            {onEditProfile && (
              <button
                type="button"
                onClick={onEditProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                {tr(lang, 'Edit Profile', 'प्रोफ़ाइल बदलें', 'प्रोफाईल बदला')}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <SecureAvatar
            photoDocId={workerProfile.photoDocId}
            name={workerProfile.displayName}
            sizeClass="w-16 h-16"
            textSizeClass="text-xl"
          />
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-extrabold text-[#0B3B75]">
                {workerProfile.displayName}
              </h3>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${
                  isPaidVerified
                    ? 'bg-emerald-50 text-[#15803D] border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isPaidVerified ? <BadgeCheck className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {isPaidVerified
                  ? tr(lang, 'Verified Worker', 'सत्यापित कामगार', 'सत्यापित कामगार')
                  : tr(lang, 'Pending ₹250 Verification', '₹250 सत्यापन लंबित', '₹250 सत्यापन प्रलंबित')}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {getLocalizedCategoryLabel(workerProfile.primarySkill, lang)} · {workerProfile.experienceYears}{' '}
              {tr(lang, 'yrs exp', 'वर्ष अनुभव', 'वर्षे अनुभव')}
            </div>
            <div className="text-xs text-slate-500">
              {workerProfile.cityOrVillage}, {workerProfile.district}, {workerProfile.state}
              {workerPrivate?.mobile ? ` · Mobile: ${workerPrivate.mobile}` : ''}
            </div>
            {isPaidVerified && (workerProfile.paymentReceiptNo || payment?.receiptNo) && (
              <div className="text-[11px] font-mono-tabular text-[#15803D] font-semibold">
                Receipt: {workerProfile.paymentReceiptNo || payment?.receiptNo}
                {workerProfile.certificateNo || payment?.certificateNo
                  ? ` · Cert: ${workerProfile.certificateNo || payment?.certificateNo}`
                  : ''}
              </div>
            )}
          </div>
        </div>

        {onUpdateRadius && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-[#0B3B75]">
              {tr(lang, 'Job Alert Distance Radius', 'काम अलर्ट दूरी दायरा', 'कामाचे अंतर मर्यादा')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SERVICE_RADIUS_STAGES.map((km: ServiceRadiusKm) => {
                const active = (workerProfile.preferredRadiusKm || 10) === km;
                return (
                  <button
                    key={km}
                    type="button"
                    disabled={updatingRadius}
                    onClick={() => void onUpdateRadius(km)}
                    className={`h-9 px-3 rounded-lg border text-xs font-mono-tabular font-bold cursor-pointer ${
                      active
                        ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-[#0B3B75]'
                    }`}
                  >
                    {km} km
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
