import React, { useEffect, useRef, useState } from 'react';
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
  Download,
  ExternalLink,
  FileCheck2,
  History,
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
  isWorkerPaymentPaid,
  loadRazorpayCheckoutScript,
  maskMobileNumber,
  recordGatewayAttemptOnServer,
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
  on: (
    event: string,
    handler: (resp: {
      error?: {
        description?: string;
        reason?: string;
        metadata?: { order_id?: string; payment_id?: string };
      };
    }) => void
  ) => void;
}

interface RazorpayWindow {
  Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
}

const EXACT_NO_GUARANTEE_DISCLOSURE =
  'Registration fee payment does not guarantee employment or job allocation.';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIsoDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPaymentMethodLabel(method?: string): string {
  if (!method || method === 'gateway' || method === 'payment_gateway' || method === 'razorpay') return 'Razorpay';
  if (method === 'upi_qr') return 'Official UPI QR';
  return method.replace(/_/g, ' ').toUpperCase();
}

export function downloadOfficialPaymentReceipt(payment: WorkerRegistrationPayment): void {
  if (typeof window === 'undefined' || payment.status !== 'verified') return;
  const receiptNo = payment.receiptNo || payment.orderRef || 'RS-RECEIPT';
  const safeFileTag = receiptNo.replace(/[^A-Za-z0-9_-]/g, '');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Rojgar Setu Payment Receipt - ${escapeHtml(receiptNo)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .card { max-width: 720px; margin: 0 auto; background: #ffffff; border: 2px solid #0B3B75; border-radius: 14px; overflow: hidden; }
    .tri { display: flex; height: 6px; }
    .tri div:nth-child(1) { flex: 1; background: #E06D1B; }
    .tri div:nth-child(2) { flex: 1; background: #ffffff; }
    .tri div:nth-child(3) { flex: 1; background: #15803D; }
    .hdr { background: #0B3B75; color: #ffffff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
    .hdr h1 { margin: 0; font-size: 18px; letter-spacing: 0.4px; }
    .hdr p { margin: 4px 0 0; font-size: 12px; color: #dbeafe; }
    .badge { background: #dcfce7; color: #15803D; border: 1px solid #86efac; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .body { padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
    .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .val { font-size: 14px; color: #0f172a; font-weight: 700; margin-top: 3px; word-break: break-word; }
    .amt { color: #15803D; font-size: 18px; font-weight: 800; }
    .note { margin-top: 18px; font-size: 12px; color: #475569; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="tri"><div></div><div></div><div></div></div>
    <div class="hdr">
      <div>
        <h1>ROJGAR SETU · OFFICIAL PAYMENT RECEIPT</h1>
        <p>Abujmad Foundation · “कामगार नाही, आपलीच माणसं!”</p>
      </div>
      <span class="badge">Successful · Verified</span>
    </div>
    <div class="body">
      <div class="grid">
        <div><div class="label">Receipt Number</div><div class="val">${escapeHtml(receiptNo)}</div></div>
        <div><div class="label">Verified Worker ID</div><div class="val">${escapeHtml(payment.verifiedWorkerId || payment.provisionalAppId)}</div></div>
        <div><div class="label">Worker Name</div><div class="val">${escapeHtml(payment.workerName)}</div></div>
        <div><div class="label">Registration Fee Paid</div><div class="val amt">₹${escapeHtml(String(payment.amountInr))} (One-Time)</div></div>
        <div><div class="label">Payment Method</div><div class="val">${escapeHtml(formatPaymentMethodLabel(payment.paymentMethod))}</div></div>
        <div><div class="label">Verification Date</div><div class="val">${escapeHtml(formatIsoDate(payment.verifiedAtIso))}</div></div>
        <div><div class="label">Razorpay / Portal Order ID</div><div class="val">${escapeHtml(payment.gatewayOrderId || payment.orderRef)}</div></div>
        <div><div class="label">Razorpay Payment ID / Ref</div><div class="val">${escapeHtml(payment.gatewayPaymentId || payment.utrOrGatewayRef)}</div></div>
        <div><div class="label">Certificate Number</div><div class="val">${escapeHtml(payment.certificateNo || 'Issued')}</div></div>
        <div><div class="label">Primary Skill &amp; Location</div><div class="val">${escapeHtml(payment.workerSkill)} · ${escapeHtml(payment.workerLocation)}</div></div>
      </div>
      <div class="note">
        <strong>Official Disclosure:</strong> ${escapeHtml(EXACT_NO_GUARANTEE_DISCLOSURE)} Paid registration benefits remain active only while payment status is Verified.
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RojgarSetu-Receipt-${safeFileTag || 'Verified'}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const PaymentStatusBadge: React.FC<{ status: RegistrationPaymentStatus; lang?: Language }> = ({
  status,
  lang = 'en',
}) => {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-extrabold uppercase">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {tr(lang, 'PAID', 'भुगतान पूर्ण (PAID)', 'भरले (PAID)')}
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
      {tr(lang, 'Pending', 'लंबित', 'प्रलंबित')}
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
  const verifyingRef = useRef(false);

  const loadOrderAndQr = async () => {
    setLoadingOrder(true);
    setOrderError('');
    try {
      const [cfg, created] = await Promise.all([
        fetchPaymentGatewayConfig(),
        createServerRegistrationOrder({ registrationId: provisionalAppId }),
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
                'Payment window was closed before completion. Your registration remains pending — no benefits were activated. You can retry safely anytime.',
                'भुगतान पूरा होने से पहले विंडो बंद हो गई। आपका पंजीकरण लंबित है — आप कभी भी पुनः प्रयास कर सकते हैं।',
                'पेमेंट पूर्ण होण्यापूर्वी विंडो बंद झाली. तुमची नोंदणी प्रलंबित आहे — तुम्ही पुन्हा प्रयत्न करू शकता.'
              )
            );
            void recordGatewayAttemptOnServer({
              outcome: 'cancelled',
              gatewayOrderId: order.gatewayOrderId,
              orderRef: order.orderRef,
              reason: 'Worker dismissed Razorpay Checkout before completing payment.',
            }).finally(() => onPaymentSubmitted?.());
          },
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          if (verifyingRef.current) return;
          verifyingRef.current = true;
          try {
            const verification = await verifyGatewaySignatureOnServer({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderRef: order.orderRef,
              registrationId: provisionalAppId,
              workerName,
              workerSkill,
              workerLocation,
              workerMobileMasked: maskMobileNumber(workerMobile),
            });
            setSubmitSuccess(
              verification.activatedOnServer
                ? tr(
                    lang,
                    '₹250 PAID & verified on server! Your registration has been sent to the ABUJMAD FOUNDATION Admin Dashboard. Your Worker ID Card & Registration Certificate will be generated after Admin approval.',
                    '₹250 भुगतान सत्यापित (PAID) हो गया! आपका पंजीकरण ABUJMAD FOUNDATION एडमिन डैशबोर्ड पर भेज दिया गया है। एडमिन स्वीकृति के बाद आपका ID कार्ड और प्रमाणपत्र जारी होगा।',
                    '₹250 पेमेंट यशस्वी (PAID) व सर्व्हरवर सत्यापित झाले! तुमची नोंदणी ABUJMAD FOUNDATION अ‍ॅडमिन डॅशबोर्डवर तपासणीसाठी पाठवली आहे. अ‍ॅडमिन मंजुरीनंतर कामगार ID कार्ड व प्रमाणपत्र तयार होईल.'
                  )
                : tr(
                    lang,
                    'Razorpay payment signature and ₹250 capture verified on server! Syncing your PAID status with Admin Dashboard now.',
                    'Razorpay भुगतान सत्यापित हो गया! आपका पंजीकरण एडमिन डैशबोर्ड पर अपडेट हो रहा है।',
                    'Razorpay पेमेंट सर्व्हरवर सत्यापित झाले! तुमची नोंदणी अ‍ॅडमिन डॅशबोर्डवर अद्यतनित होत आहे.'
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
            verifyingRef.current = false;
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
            `Payment failed: ${desc}. Registration was NOT activated. Please retry.`,
            `भुगतान विफल: ${desc}। पंजीकरण सक्रिय नहीं हुआ है। कृपया पुनः प्रयास करें।`,
            `पेमेंट अयशस्वी: ${desc}. नोंदणी सुरू झालेली नाही. कृपया पुन्हा प्रयत्न करा.`
          )
        );
        void recordGatewayAttemptOnServer({
          outcome: 'failed',
          gatewayOrderId: failResp?.error?.metadata?.order_id || order.gatewayOrderId,
          gatewayPaymentId: failResp?.error?.metadata?.payment_id,
          orderRef: order.orderRef,
          reason: desc,
        }).finally(() => onPaymentSubmitted?.());
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

        {/* Clear 4-Field Payment Summary (Fee, Method, Status, Receipt) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Registration Fee</div>
            <div className="font-mono-tabular text-base font-extrabold text-[#0B3B75] mt-0.5">
              ₹{WORKER_REGISTRATION_FEE_INR}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Method</div>
            <div className="font-extrabold text-[#0B3B75] mt-0.5">
              {order?.razorpayMode === 'test' || config?.razorpayMode === 'test'
                ? 'Razorpay (Test Mode)'
                : 'Razorpay'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Status</div>
            <div className="mt-1">
              <PaymentStatusBadge status={existingPayment?.status || 'pending'} lang={lang} />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Receipt</div>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <Lock className="w-3 h-3" />
                Download unlocks after verified payment
              </span>
            </div>
          </div>
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
          <p className="leading-relaxed font-semibold text-amber-950">
            <strong>{tr(lang, 'No Employment Guarantee:', 'रोजगार की गारंटी नहीं:', 'रोजगाराची हमी नाही:')}</strong>{' '}
            {config?.noEmploymentGuaranteeNotice || EXACT_NO_GUARANTEE_DISCLOSURE}
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
                {/* Primary Razorpay Standard Checkout (Test Mode Enforced) */}
                {order.mode === 'gateway' && order.razorpayKeyId && order.gatewayOrderId ? (
                  <div className="rounded-xl border-2 border-[#15803D] bg-emerald-50/40 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xs font-extrabold uppercase text-[#15803D] flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Razorpay Verified Checkout · UPI / Card / NetBanking</span>
                          </div>
                          {order.razorpayMode === 'test' && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-[#9A3412] text-[10px] font-extrabold uppercase tracking-wide">
                              RAZORPAY TEST MODE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono-tabular mt-1">
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
                          `Pay ₹${order.amountInr} via Razorpay${order.razorpayMode === 'test' ? ' (Test Mode)' : ''}`,
                          `Razorpay से ₹${order.amountInr} सुरक्षित भुगतान करें`,
                          `Razorpay द्वारे ₹${order.amountInr} सुरक्षित भरा`
                        )}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-600 text-center">
                      Backend verifies HMAC-SHA256 signature and confirms <strong>captured</strong> ₹250 status directly with Razorpay before issuing your Verified Worker ID &amp; Official Receipt.
                    </p>
                  </div>
                ) : order.razorpayMode === 'live_blocked' || config?.razorpayMode === 'live_blocked' ? (
                  <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-xs text-red-900 space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-red-800">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Razorpay Live Mode Blocked — Test Mode Only Enforced</span>
                    </div>
                    <p>
                      {order.configError ||
                        config?.configError ||
                        'RAZORPAY_KEY_ID is set to a Live Mode key (rzp_live_*). Replace it with your Razorpay Test Mode key (rzp_test_*) in Vercel Environment Variables until production live mode is explicitly approved.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-slate-800 space-y-1.5">
                    <div className="font-extrabold text-[#0B3B75]">
                      Razorpay Test Mode Configuration Required · Approved Official UPI QR Active
                    </div>
                    <p>
                      {order.configError ||
                        config?.configError ||
                        'Online Razorpay Test Mode Checkout activates automatically once server-side Razorpay Test Mode credentials are configured in Vercel Environment Variables.'}
                      {(order.missingGatewayEnvVars || config?.missingGatewayEnvVars || []).length > 0 && (
                        <>
                          {' '}
                          Missing server variables:{' '}
                          <code className="font-mono-tabular font-bold">
                            {(order.missingGatewayEnvVars || config?.missingGatewayEnvVars || []).join(', ')}
                          </code>
                          .
                        </>
                      )}{' '}
                      Gateway secrets stay strictly server-side and are never exposed to the browser.
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
  const isVerified = payment.status === 'verified';
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isVerified}
            onClick={() => downloadOfficialPaymentReceipt(payment)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{tr(lang, 'Download Receipt', 'रसीद डाउनलोड करें', 'पावती डाउनलोड करा')}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tr(lang, 'Print', 'प्रिंट', 'प्रिंट')}</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="text-slate-500">Receipt No.</div>
            <div className="font-mono-tabular text-sm font-extrabold text-[#0B3B75]">
              {payment.receiptNo || 'PROVISIONAL (Awaiting Server Verification)'}
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
            <div className="text-slate-500">Verified Worker / App ID</div>
            <div className="font-mono-tabular font-bold text-[#C25E00] mt-0.5">
              {payment.verifiedWorkerId || payment.provisionalAppId}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Registration Fee</div>
            <div className="font-mono-tabular text-base font-extrabold text-[#15803D] mt-0.5">
              ₹{payment.amountInr} (One-Time)
            </div>
          </div>
          <div>
            <div className="text-slate-500">Razorpay / Portal Order ID</div>
            <div className="font-mono-tabular font-semibold text-slate-800 mt-0.5 break-all">
              {payment.gatewayOrderId || payment.orderRef}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Razorpay Payment ID / UTR</div>
            <div className="font-mono-tabular font-semibold text-slate-800 mt-0.5 break-all">
              {payment.gatewayPaymentId || payment.utrOrGatewayRef}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Payment Method &amp; Date</div>
            <div className="font-semibold text-slate-800 mt-0.5">
              {formatPaymentMethodLabel(payment.paymentMethod)} · {formatIsoDate(payment.verifiedAtIso)}
            </div>
          </div>
        </div>

        {payment.status === 'refunded' && (
          <div className="rounded-lg bg-slate-100 border border-slate-300 px-3.5 py-2.5 text-slate-700">
            <strong>Refund Details:</strong> Ref{' '}
            <span className="font-mono-tabular font-bold">{payment.refundReference || 'N/A'}</span> ·{' '}
            {payment.refundReason || 'Refund processed.'}
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          <strong>Disclosure:</strong> {EXACT_NO_GUARANTEE_DISCLOSURE} Paid benefits (Verified Worker ID, Official Certificate &amp; ₹50 Single-Level Referral Code) remain active only while payment status is Successful / Verified.
        </p>
      </div>
    </section>
  );
};

export const WorkerPaymentHistoryCard: React.FC<{
  workerProfile?: PublicWorkerProfile | null;
  payment?: WorkerRegistrationPayment | null;
}> = ({ workerProfile, payment }) => {
  const { lang } = useLanguage();
  const isVerified =
    payment?.status === 'verified' || isWorkerPaidBenefitsActive(workerProfile);
  const effectiveStatus: RegistrationPaymentStatus =
    payment?.status ||
    workerProfile?.registrationPaymentStatus ||
    (isVerified ? 'verified' : 'pending');

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#0B3B75]" />
          <h3 className="font-display text-sm font-extrabold text-[#0B3B75]">
            {tr(lang, 'Registration Payment Status & History', 'पंजीकरण भुगतान स्थिति और इतिहास', 'नोंदणी पेमेंट स्थिती व इतिहास')}
          </h3>
        </div>
        <PaymentStatusBadge status={effectiveStatus} lang={lang} />
      </div>

      <div className="p-5 space-y-4 text-xs">
        {/* Required 4-Item Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Registration Fee</div>
            <div className="font-mono-tabular text-base font-extrabold text-[#0B3B75] mt-0.5">
              ₹{payment?.amountInr || WORKER_REGISTRATION_FEE_INR}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Method</div>
            <div className="font-extrabold text-[#0B3B75] mt-0.5">
              {formatPaymentMethodLabel(payment?.paymentMethod || 'payment_gateway')}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Status</div>
            <div className="mt-1">
              <PaymentStatusBadge status={effectiveStatus} lang={lang} />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Payment Receipt</div>
            <div className="mt-1">
              {payment && payment.status === 'verified' ? (
                <button
                  type="button"
                  onClick={() => downloadOfficialPaymentReceipt(payment)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#15803D] hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">
                  {effectiveStatus === 'failed'
                    ? 'Payment failed — retry above'
                    : effectiveStatus === 'refunded'
                    ? 'Refunded'
                    : 'Available after verified capture'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Record */}
        {payment ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Order ID</th>
                  <th className="px-3.5 py-2.5 font-bold">Payment ID / Ref</th>
                  <th className="px-3.5 py-2.5 font-bold">Amount</th>
                  <th className="px-3.5 py-2.5 font-bold">Method</th>
                  <th className="px-3.5 py-2.5 font-bold">Status</th>
                  <th className="px-3.5 py-2.5 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3.5 py-2.5 font-mono-tabular font-semibold text-[#0B3B75]">
                    {payment.gatewayOrderId || payment.orderRef}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono-tabular text-slate-700">
                    {payment.gatewayPaymentId || payment.utrOrGatewayRef || '—'}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono-tabular font-extrabold text-[#15803D]">
                    ₹{payment.amountInr}
                  </td>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                    {formatPaymentMethodLabel(payment.paymentMethod)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <PaymentStatusBadge status={payment.status} lang={lang} />
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600">
                    {formatIsoDate(payment.verifiedAtIso || payment.refundedAtIso)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-3.5 text-slate-600">
            {tr(
              lang,
              'No completed ₹250 registration transaction recorded yet. Complete Razorpay checkout above to activate your Verified Worker ID and Receipt.',
              'अभी तक कोई पूर्ण ₹250 पंजीकरण भुगतान दर्ज नहीं है। सत्यापित कामगार ID और रसीद के लिए ऊपर भुगतान पूरा करें।',
              'अद्याप कोणतेही पूर्ण ₹250 नोंदणी पेमेंट नोंदवलेले नाही. सत्यापित कामगार ID व पावतीसाठी वर पेमेंट पूर्ण करा.'
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed">
          <strong>Disclosure:</strong> {EXACT_NO_GUARANTEE_DISCLOSURE}
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
  const isPaid = isWorkerPaymentPaid(workerProfile, payment);

  if (!isVerified) {
    return (
      <section className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-600">
        <Lock className="w-5 h-5 text-[#E06D1B] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-extrabold text-[#0B3B75] text-sm">
            {isPaid
              ? tr(
                  lang,
                  '₹250 Registration Fee PAID — Awaiting ABUJMAD FOUNDATION Admin Approval',
                  '₹250 शुल्क भुगतान पूर्ण (PAID) — ABUJMAD FOUNDATION एडमिन स्वीकृति लंबित',
                  '₹250 नोंदणी शुल्क भरले (PAID) — ABUJMAD FOUNDATION अ‍ॅडमिन मंजुरी प्रलंबित'
                )
              : tr(
                  lang,
                  'Official Registration Certificate Locked Until ₹250 Payment & Admin Approval',
                  '₹250 भुगतान और एडमिन स्वीकृति तक आधिकारिक पंजीकरण प्रमाणपत्र लॉक है',
                  '₹250 पेमेंट आणि अ‍ॅडमिन मंजुरी होईपर्यंत अधिकृत नोंदणी प्रमाणपत्र लॉक आहे'
                )}
          </div>
          <p>
            {isPaid
              ? tr(
                  lang,
                  'Your ₹250 registration fee is PAID and sent to the ABUJMAD FOUNDATION Admin Dashboard. Your Official Worker ID Card (RS-W-...) and Registration Certificate will be generated automatically once Admin approves your registration.',
                  'आपका ₹250 शुल्क PAID हो गया है और ABUJMAD FOUNDATION एडमिन डैशबोर्ड पर सत्यापन हेतु भेजा गया है। एडमिन स्वीकृति के बाद आपका ID कार्ड और प्रमाणपत्र यहाँ खुल जाएगा।',
                  'तुमचे ₹250 नोंदणी शुल्क भरले (PAID) गेले असून ABUJMAD FOUNDATION अ‍ॅडमिन डॅशबोर्डवर तपासणीसाठी पाठवले आहे. अ‍ॅडमिन मंजुरीनंतर कामगार ID कार्ड व प्रमाणपत्र येथे आपोआप तयार होईल.'
                )
              : tr(
                  lang,
                  'Once your one-time ₹250 registration fee is paid and approved by ABUJMAD FOUNDATION Admin, your printable Official Worker Registration Certificate and Verified Worker ID (RS-W-...) will unlock here automatically.',
                  'एकमुश्त ₹250 शुल्क भुगतान और ABUJMAD FOUNDATION एडमिन स्वीकृति के बाद आपका आधिकारिक पंजीकरण प्रमाणपत्र और सत्यापित कामगार ID यहाँ खुल जाएगा।',
                  '₹250 नोंदणी शुल्क भरून ABUJMAD FOUNDATION अ‍ॅडमिन मंजुरी मिळाल्यानंतर तुमचे अधिकृत नोंदणी प्रमाणपत्र आणि सत्यापित कामगार ID येथे उपलब्ध होईल.'
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
  const isPaymentPaid = isWorkerPaymentPaid(workerProfile, payment);
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
            {isPaidVerified && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                {tr(lang, 'Print ID', 'ID प्रिंट करें', 'ID प्रिंट करा')}
              </button>
            )}
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
                    : isPaymentPaid
                    ? 'bg-blue-50 text-[#0B3B75] border-blue-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isPaidVerified ? <BadgeCheck className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {isPaidVerified
                  ? tr(lang, 'Admin Approved Worker', 'सत्यापित कामगार', 'सत्यापित कामगार')
                  : isPaymentPaid
                  ? tr(lang, '₹250 PAID · Awaiting Admin Approval', '₹250 भुगतान पूर्ण · एडमिन स्वीकृति लंबित', '₹250 भरले · अ‍ॅडमिन मंजुरी प्रलंबित')
                  : tr(lang, 'Pending ₹250 Payment', '₹250 भुगतान लंबित', '₹250 पेमेंट प्रलंबित')}
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
