import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  callServerReferralEligibilityCheck,
  ensureWorkerReferralCode,
  getTodayIsoDate,
} from './adsReferralService';
import type {
  FinancialLedgerEntry,
  FinancialReportSummary,
  PaymentMethodType,
  PlatformReferralConfig,
  PublicWorkerProfile,
  ReferralRewardRecord,
  ReferralWallet,
  ReferralWithdrawalRequest,
  WorkerPayoutSecret,
  WorkerPrivateInfo,
  WorkerReferralRecord,
  WorkerRegistrationPayment,
  WithdrawalRequestStatus,
} from '../types/domain';

export const WORKER_REGISTRATION_FEE_INR = 250;
export const SINGLE_LEVEL_REFERRAL_REWARD_INR = 50;

export interface PaymentGatewayPublicConfig {
  registrationFeeInr: number;
  referralRewardInr: number;
  gatewayConfigured: boolean;
  webhookConfigured?: boolean;
  serverAdminDbConfigured?: boolean;
  gatewayProvider: 'razorpay' | 'upi_qr';
  razorpayMode?: 'test' | 'live_blocked' | 'unconfigured';
  testModeEnforced?: boolean;
  configError?: string;
  razorpayKeyId?: string;
  missingGatewayEnvVars?: string[];
  officialUpiId: string;
  officialUpiPayeeName: string;
  refundPolicySummary: string;
  noEmploymentGuaranteeNotice: string;
}

export interface CreatedPaymentOrder {
  mode: 'gateway' | 'upi_qr';
  gatewayProvider: 'razorpay' | 'upi_qr';
  razorpayMode?: 'test' | 'live_blocked' | 'unconfigured';
  testModeEnforced?: boolean;
  configError?: string;
  gatewayConfigured?: boolean;
  missingGatewayEnvVars?: string[];
  razorpayKeyId?: string;
  gatewayOrderId?: string;
  orderRef: string;
  orderToken: string;
  amountInr: number;
  officialUpiId: string;
  officialUpiPayeeName: string;
  upiUri: string;
  createdAtIso: string;
}

let razorpayScriptPromise: Promise<boolean> | null = null;

export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve(true);
  }
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean((window as unknown as { Razorpay?: unknown }).Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean((window as unknown as { Razorpay?: unknown }).Razorpay));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return razorpayScriptPromise;
}

/**
 * Returns true ONLY after ABUJMAD FOUNDATION Admin has approved the worker registration
 * (unlocking Verified Worker ID RS-W-..., Digital Worker ID Card, and Registration Certificate).
 */
export function isWorkerPaidBenefitsActive(worker: PublicWorkerProfile | null | undefined): boolean {
  if (!worker) return false;
  if (worker.paidBenefitsActive === true && worker.verificationStatus === 'verified') {
    return true;
  }
  if (worker.paidBenefitsActive === false) {
    return false;
  }
  if (
    worker.registrationPaymentStatus === 'pending' ||
    worker.registrationPaymentStatus === 'failed' ||
    worker.registrationPaymentStatus === 'refunded'
  ) {
    return false;
  }
  // Backwards compatibility for pre-existing verified workers created before ₹250 activation
  return Boolean(
    worker.verificationStatus === 'verified' &&
      worker.registrationId &&
      worker.registrationId.startsWith('RS-W-')
  );
}

/**
 * Returns true once the worker's ₹250 registration fee has been server-verified as PAID
 * (even while ABUJMAD FOUNDATION Admin approval for ID Card & Certificate is still pending).
 */
export function isWorkerPaymentPaid(
  worker: PublicWorkerProfile | null | undefined,
  payment?: WorkerRegistrationPayment | null
): boolean {
  if (payment?.status === 'verified') return true;
  if (worker?.registrationPaymentStatus === 'verified') return true;
  return false;
}

export function maskMobileNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXX';
  return `XXXXXX${digits.slice(-4)}`;
}

export function maskPayoutDestinationClient(params: {
  payoutMethod: 'upi' | 'bank_transfer';
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
}): string {
  if (params.payoutMethod === 'upi') {
    const raw = (params.upiId || '').trim();
    const parts = raw.split('@');
    if (parts.length === 2) {
      const handle = parts[0];
      const prefix = handle.slice(0, Math.min(2, handle.length));
      return `UPI ${prefix}***@${parts[1]}`;
    }
    return 'UPI ****';
  }
  const digits = (params.accountNumber || '').replace(/\D/g, '');
  const last4 = digits.slice(-4) || 'XXXX';
  const ifsc = (params.ifscCode || '').trim().toUpperCase();
  return `A/C ****${last4}${ifsc ? ` · ${ifsc}` : ''}`;
}

export function buildVerifiedWorkerId(uid: string): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `RS-W-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${suffix}`;
}

export function buildReceiptNumber(uid: string): string {
  const datePart = getTodayIsoDate().replace(/-/g, '');
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const rnd = Math.floor(100 + Math.random() * 900);
  return `RS-RCP-${datePart}-${tag}${rnd}`;
}

export function buildCertificateNumber(uid: string): string {
  const year = new Date().getFullYear();
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `RS-CERT-${year}-${tag}-${rnd}`;
}

export async function fetchPaymentGatewayConfig(): Promise<PaymentGatewayPublicConfig> {
  const resp = await fetch('/api/payments/config');
  if (!resp.ok) {
    return {
      registrationFeeInr: WORKER_REGISTRATION_FEE_INR,
      referralRewardInr: SINGLE_LEVEL_REFERRAL_REWARD_INR,
      gatewayConfigured: false,
      gatewayProvider: 'upi_qr',
      razorpayMode: 'unconfigured',
      testModeEnforced: true,
      configError: 'Unable to fetch server payment configuration.',
      officialUpiId: 'rojgarsetu.abujmad@upi',
      officialUpiPayeeName: 'Rojgar Setu Abujmad Foundation',
      refundPolicySummary:
        'One-time ₹250 registration fee is refundable only for verified duplicate/failed transactions or valid cancellation before benefit activation within 7 days.',
      noEmploymentGuaranteeNotice:
        'Registration fee payment does not guarantee employment or job allocation.',
    };
  }
  return (await resp.json()) as PaymentGatewayPublicConfig;
}

export async function createServerRegistrationOrder(params?: {
  registrationId?: string;
}): Promise<CreatedPaymentOrder> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in first to initiate registration payment.');
  const resp = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amountInr: WORKER_REGISTRATION_FEE_INR,
      ...(params?.registrationId ? { registrationId: params.registrationId } : {}),
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error((data as { error?: string }).error || 'Unable to create payment order.');
  }
  return data as CreatedPaymentOrder;
}

export async function validateUpiUtrOnServer(utr: string): Promise<{
  valid: boolean;
  normalizedUtr: string;
  reason: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in first.');
  const resp = await fetch('/api/payments/validate-upi-utr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ utr }),
  });
  const data = (await resp.json()) as { valid?: boolean; normalizedUtr?: string; reason?: string; error?: string };
  if (!resp.ok || !data.valid) {
    throw new Error(data.reason || data.error || 'Invalid or duplicate UTR reference.');
  }
  return {
    valid: true,
    normalizedUtr: data.normalizedUtr || utr.trim().toUpperCase(),
    reason: data.reason || 'Valid UTR.',
  };
}

export async function verifyGatewaySignatureOnServer(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderRef?: string;
  registrationId?: string;
  workerName?: string;
  workerSkill?: string;
  workerLocation?: string;
  workerMobileMasked?: string;
}): Promise<{
  verified: boolean;
  captured?: boolean;
  paymentStatus?: string;
  adminApprovalPending?: boolean;
  provisionalAppId?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  alreadyVerified?: boolean;
  razorpayMode?: string;
  verifiedAtIso?: string;
  activatedOnServer?: boolean;
  verifiedWorkerId?: string;
  receiptNo?: string;
  certificateNo?: string;
  referralCredited?: boolean;
  referralMessage?: string;
  reason?: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required.');
  const resp = await fetch('/api/payments/verify-gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as {
    verified?: boolean;
    captured?: boolean;
    paymentStatus?: string;
    adminApprovalPending?: boolean;
    provisionalAppId?: string;
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    alreadyVerified?: boolean;
    razorpayMode?: string;
    verifiedAtIso?: string;
    activatedOnServer?: boolean;
    verifiedWorkerId?: string;
    receiptNo?: string;
    certificateNo?: string;
    referralCredited?: boolean;
    referralMessage?: string;
    reason?: string;
    error?: string;
  };
  if (!resp.ok || !data.verified) {
    throw new Error(data.error || data.reason || 'Payment gateway verification failed.');
  }
  return {
    verified: true,
    captured: data.captured,
    paymentStatus: data.paymentStatus,
    adminApprovalPending: data.adminApprovalPending,
    provisionalAppId: data.provisionalAppId,
    gatewayOrderId: data.gatewayOrderId,
    gatewayPaymentId: data.gatewayPaymentId,
    alreadyVerified: data.alreadyVerified,
    razorpayMode: data.razorpayMode,
    verifiedAtIso: data.verifiedAtIso,
    activatedOnServer: data.activatedOnServer,
    verifiedWorkerId: data.verifiedWorkerId,
    receiptNo: data.receiptNo,
    certificateNo: data.certificateNo,
    referralCredited: data.referralCredited,
    referralMessage: data.referralMessage,
    reason: data.reason,
  };
}

export async function recordGatewayAttemptOnServer(params: {
  outcome: 'failed' | 'cancelled';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  orderRef?: string;
  reason?: string;
}): Promise<{ ok: boolean; status?: string }> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { ok: false };
    const resp = await fetch('/api/payments/record-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!resp.ok) return { ok: false };
    return (await resp.json()) as { ok: boolean; status?: string };
  } catch {
    return { ok: false };
  }
}

export interface ServerDemoVerificationStep {
  workerLabel: string;
  scenario: string;
  passed: boolean;
  details: string;
  paymentStatus: 'pending' | 'verified' | 'failed' | 'refunded';
  rewardDeltaInr: number;
}

export interface ServerFiveDemoWorkersReport {
  allPassed: boolean;
  steps: ServerDemoVerificationStep[];
  financialSummary: FinancialReportSummary;
  singleLevelChainRewardInr: number;
}

export async function runServerFiveDemoWorkersVerification(): Promise<ServerFiveDemoWorkersReport> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Admin sign-in required.');
  const resp = await fetch('/api/admin/payments/run-demo-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error((data as { error?: string }).error || 'Unable to run 5-demo-worker verification suite.');
  }
  return data as ServerFiveDemoWorkersReport;
}

/**
 * Submits a worker's ₹250 registration payment proof (UPI QR UTR or Gateway ref).
 * Status is strictly saved as 'pending' — never activates paid benefits or verified Worker ID from frontend!
 */
export async function submitWorkerRegistrationPaymentProof(params: {
  workerUid: string;
  workerName: string;
  workerSkill: string;
  workerLocation: string;
  workerMobile: string;
  provisionalAppId: string;
  paymentMethod: PaymentMethodType;
  orderRef: string;
  utrOrGatewayRef: string;
  payerUpiOrName?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  refundPolicyAccepted: boolean;
  noEmploymentGuaranteeAccepted: boolean;
  otpVerified: boolean;
  referredByCode?: string;
  referredByUid?: string;
}): Promise<string> {
  if (!params.refundPolicyAccepted || !params.noEmploymentGuaranteeAccepted) {
    throw new Error('Please accept the Refund Policy and No Employment Guarantee disclosure before submitting payment.');
  }
  if (!params.otpVerified) {
    throw new Error('Mobile OTP verification must be completed before submitting registration payment.');
  }

  const utrValidation = await validateUpiUtrOnServer(params.utrOrGatewayRef);
  const paymentDocId = params.workerUid; // 1 canonical payment doc per worker prevents duplicate payments
  const paymentRef = doc(db, 'workerRegistrationPayments', paymentDocId);
  const existingSnap = await getDoc(paymentRef);

  if (existingSnap.exists()) {
    const existing = existingSnap.data() as WorkerRegistrationPayment;
    if (existing.status === 'verified') {
      throw new Error('Your ₹250 registration payment is already verified.');
    }
    if (existing.status === 'refunded') {
      throw new Error('Your previous payment was refunded. Please contact Rojgar Setu support for re-registration.');
    }
    await updateDoc(paymentRef, {
      paymentMethod: params.paymentMethod,
      orderRef: params.orderRef.trim().slice(0, 80),
      utrOrGatewayRef: utrValidation.normalizedUtr.slice(0, 120),
      ...(params.payerUpiOrName?.trim() ? { payerUpiOrName: params.payerUpiOrName.trim().slice(0, 120) } : {}),
      ...(params.gatewayOrderId ? { gatewayOrderId: params.gatewayOrderId.slice(0, 120) } : {}),
      ...(params.gatewayPaymentId ? { gatewayPaymentId: params.gatewayPaymentId.slice(0, 120) } : {}),
      status: 'pending',
      gatewaySignatureVerified: false,
      refundPolicyAccepted: true,
      noEmploymentGuaranteeAccepted: true,
      otpVerified: params.otpVerified,
      updatedAt: serverTimestamp(),
    });
    return paymentDocId;
  }

  await setDoc(paymentRef, {
    workerUid: params.workerUid,
    workerName: params.workerName.trim().slice(0, 120),
    workerSkill: params.workerSkill.trim().slice(0, 80),
    workerLocation: params.workerLocation.trim().slice(0, 160),
    workerMobileMasked: maskMobileNumber(params.workerMobile),
    provisionalAppId: params.provisionalAppId.trim().slice(0, 40),
    amountInr: WORKER_REGISTRATION_FEE_INR,
    paymentMethod: params.paymentMethod,
    status: 'pending',
    orderRef: params.orderRef.trim().slice(0, 80),
    utrOrGatewayRef: utrValidation.normalizedUtr.slice(0, 120),
    ...(params.payerUpiOrName?.trim() ? { payerUpiOrName: params.payerUpiOrName.trim().slice(0, 120) } : {}),
    ...(params.gatewayOrderId ? { gatewayOrderId: params.gatewayOrderId.slice(0, 120) } : {}),
    ...(params.gatewayPaymentId ? { gatewayPaymentId: params.gatewayPaymentId.slice(0, 120) } : {}),
    gatewaySignatureVerified: false,
    refundPolicyAccepted: true,
    noEmploymentGuaranteeAccepted: true,
    otpVerified: params.otpVerified,
    ...(params.referredByCode ? { referredByCode: params.referredByCode.trim().slice(0, 32) } : {}),
    ...(params.referredByUid ? { referredByUid: params.referredByUid.trim().slice(0, 128) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return paymentDocId;
}

export function subscribeWorkerOwnPayment(
  workerUid: string,
  cb: (payment: WorkerRegistrationPayment | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'workerRegistrationPayments', workerUid),
    (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkerRegistrationPayment) : null);
    },
    () => cb(null)
  );
}

export function subscribeWorkerWithdrawals(
  workerUid: string,
  cb: (list: ReferralWithdrawalRequest[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'referralWithdrawals'), where('workerUid', '==', workerUid)),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ReferralWithdrawalRequest))
        .sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          return tb - ta;
        });
      cb(items);
    },
    () => cb([])
  );
}

export function subscribeAdminFinanceData(callbacks: {
  onPayments: (list: WorkerRegistrationPayment[]) => void;
  onWithdrawals: (list: ReferralWithdrawalRequest[]) => void;
  onLedger: (list: FinancialLedgerEntry[]) => void;
}): () => void {
  const u1 = onSnapshot(
    query(collection(db, 'workerRegistrationPayments'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkerRegistrationPayment))),
    () => callbacks.onPayments([])
  );
  const u2 = onSnapshot(
    query(collection(db, 'referralWithdrawals'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onWithdrawals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralWithdrawalRequest))),
    () => callbacks.onWithdrawals([])
  );
  const u3 = onSnapshot(
    query(collection(db, 'financialLedger'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialLedgerEntry))),
    () => callbacks.onLedger([])
  );
  return () => {
    u1();
    u2();
    u3();
  };
}

export async function recomputeWorkerReferralWalletFull(
  referrerUid: string,
  referralCode?: string
): Promise<ReferralWallet> {
  const [refsSnap, rewardsSnap, withdrawalsSnap] = await Promise.all([
    getDocs(query(collection(db, 'workerReferrals'), where('referrerUid', '==', referrerUid))),
    getDocs(query(collection(db, 'referralRewards'), where('referrerUid', '==', referrerUid))),
    getDocs(query(collection(db, 'referralWithdrawals'), where('workerUid', '==', referrerUid))),
  ]);

  let verifiedPaidReferrals = 0;
  let pendingReferrals = 0;
  refsSnap.docs.forEach((d) => {
    const r = d.data() as WorkerReferralRecord;
    if (r.registrationPaymentStatus === 'paid_verified' && r.rewardStatus !== 'rejected' && r.rewardStatus !== 'reversed') {
      verifiedPaidReferrals += 1;
    } else if (
      r.registrationPaymentStatus === 'payment_pending' ||
      r.registrationPaymentStatus === 'free_launch' ||
      r.rewardStatus === 'pending_verification'
    ) {
      pendingReferrals += 1;
    }
  });

  let pendingBalanceInr = 0;
  let approvedBalanceInr = 0;
  let paidBalanceInr = 0;
  let reversedBalanceInr = 0;
  let legacyDirectPaidInr = 0;

  rewardsSnap.docs.forEach((d) => {
    const rw = d.data() as ReferralRewardRecord;
    if (rw.status === 'pending' || rw.status === 'held') pendingBalanceInr += rw.rewardAmountInr;
    if (rw.status === 'approved') approvedBalanceInr += rw.rewardAmountInr;
    if (rw.status === 'paid') {
      paidBalanceInr += rw.rewardAmountInr;
      if (rw.payoutId && rw.payoutId.startsWith('pay_')) {
        legacyDirectPaidInr += rw.rewardAmountInr;
      }
    }
    if (rw.status === 'reversed') reversedBalanceInr += rw.rewardAmountInr;
  });

  let pendingWithdrawalInr = 0;
  let withdrawnBalanceInr = 0;
  withdrawalsSnap.docs.forEach((d) => {
    const w = d.data() as ReferralWithdrawalRequest;
    if (w.status === 'pending' || w.status === 'approved') pendingWithdrawalInr += w.amountInr;
    if (w.status === 'paid') withdrawnBalanceInr += w.amountInr;
  });

  const totalApprovedAndPaid = approvedBalanceInr + paidBalanceInr;
  const availableBalanceInr = Math.max(
    0,
    totalApprovedAndPaid - legacyDirectPaidInr - withdrawnBalanceInr - pendingWithdrawalInr
  );
  const totalEarnedInr = totalApprovedAndPaid;

  const walletRef = doc(db, 'referralWallets', referrerUid);
  const existing = await getDoc(walletRef);
  const resolvedCode =
    referralCode || (existing.exists() ? String(existing.data()?.referralCode || 'RS-CODE') : 'RS-CODE');

  const payload = {
    ownerUid: referrerUid,
    referralCode: resolvedCode,
    totalReferrals: refsSnap.size,
    verifiedPaidReferrals,
    pendingReferrals,
    pendingBalanceInr,
    approvedBalanceInr,
    paidBalanceInr: paidBalanceInr + withdrawnBalanceInr,
    availableBalanceInr,
    pendingWithdrawalInr,
    withdrawnBalanceInr,
    reversedBalanceInr,
    totalEarnedInr,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await updateDoc(walletRef, payload);
  } else {
    await setDoc(walletRef, { ...payload, createdAt: serverTimestamp() });
  }

  return { id: referrerUid, ...payload };
}

async function writeFinancialLedgerEntryIfNotExists(
  entryId: string,
  entry: Omit<FinancialLedgerEntry, 'id' | 'createdAt'>
): Promise<void> {
  const ref = doc(db, 'financialLedger', entryId);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // Immutable & idempotent — prevents duplicate financial ledger entries
  await setDoc(ref, {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

/**
 * Admin verifies a ₹250 worker registration payment:
 * 1. Marks payment 'verified', issues unique RS-W Worker ID, Official Receipt No, and Certificate No.
 * 2. Activates paid benefits & personal referral code on publicWorkers.
 * 3. Writes +₹250 'registration_payment' entry to financialLedger.
 * 4. Evaluates single-level ₹50 referral reward server-side (anti-fraud, OTP check, no duplicates).
 */
export async function adminVerifyWorkerRegistrationPayment(params: {
  payment: WorkerRegistrationPayment;
  config: PlatformReferralConfig;
  allReferrals: WorkerReferralRecord[];
  allRewards: ReferralRewardRecord[];
  adminUid: string;
  adminEmail: string;
  adminNotes?: string;
  autoApproveReferral?: boolean;
}): Promise<{
  verifiedWorkerId: string;
  receiptNo: string;
  certificateNo: string;
  referralOutcome: string;
}> {
  const alreadyIssuedIdAndCert = Boolean(
    params.payment.status === 'verified' &&
      params.payment.verifiedWorkerId &&
      params.payment.verifiedWorkerId.startsWith('RS-W-') &&
      params.payment.certificateNo
  );
  if (alreadyIssuedIdAndCert) {
    throw new Error('This registration payment is already approved and Worker ID & Certificate have been issued.');
  }

  const workerUid = params.payment.workerUid;
  const workerPubRef = doc(db, 'publicWorkers', workerUid);
  const workerPrivRef = doc(db, 'workerPrivate', workerUid);
  const [pubSnap, privSnap] = await Promise.all([getDoc(workerPubRef), getDoc(workerPrivRef)]);

  const existingPub = pubSnap.exists() ? ({ id: pubSnap.id, ...pubSnap.data() } as PublicWorkerProfile) : null;
  const existingPriv = privSnap.exists() ? (privSnap.data() as WorkerPrivateInfo) : null;

  const verifiedWorkerId =
    existingPub?.registrationId && existingPub.registrationId.startsWith('RS-W-')
      ? existingPub.registrationId
      : buildVerifiedWorkerId(workerUid);
  const receiptNo = params.payment.receiptNo || buildReceiptNumber(workerUid);
  const certificateNo = params.payment.certificateNo || buildCertificateNumber(workerUid);
  const verifiedAtIso = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(doc(db, 'workerRegistrationPayments', params.payment.id), {
    status: 'verified',
    verifiedWorkerId,
    receiptNo,
    certificateNo,
    verifiedByUid: params.adminUid,
    verifiedAtIso,
    ...(params.adminNotes?.trim() ? { adminNotes: params.adminNotes.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });

  if (pubSnap.exists()) {
    batch.update(workerPubRef, {
      registrationId: verifiedWorkerId,
      verificationStatus: 'verified',
      registrationPaymentStatus: 'verified',
      paidBenefitsActive: true,
      paymentReceiptNo: receiptNo,
      certificateNo,
      verifiedAtIso,
      updatedAt: serverTimestamp(),
    });
  }

  if (privSnap.exists()) {
    batch.update(workerPrivRef, {
      registrationPaymentStatus: 'verified',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  // Immutable financial ledger entry for Gross Registration Revenue (+₹250)
  await writeFinancialLedgerEntryIfNotExists(`led_reg_${params.payment.id}`, {
    entryType: 'registration_payment',
    direction: 'credit',
    amountInr: params.payment.amountInr,
    workerUid,
    workerName: params.payment.workerName,
    referenceId: params.payment.id,
    paymentOrUtrRef: params.payment.utrOrGatewayRef,
    description: `Verified ₹${params.payment.amountInr} one-time worker registration (${verifiedWorkerId} · Receipt ${receiptNo})`,
    recordedByUid: params.adminUid,
    recordedByEmail: params.adminEmail,
    ...(params.payment.isDemo ? { isDemo: true } : {}),
  });

  // Activate worker's personal referral code now that payment is verified
  if (existingPub) {
    try {
      await ensureWorkerReferralCode(
        { ...existingPub, registrationId: verifiedWorkerId, verificationStatus: 'verified' },
        existingPriv
      );
    } catch {
      // Non-blocking
    }
  }

  // Evaluate single-level ₹50 referral reward if this worker was referred
  let referralOutcome = 'No referral code attached to this registration.';
  const refSnap = await getDoc(doc(db, 'workerReferrals', workerUid));
  if (refSnap.exists()) {
    const referral = { id: refSnap.id, ...refSnap.data() } as WorkerReferralRecord;
    const otherMobileHashes = params.allReferrals
      .filter((r) => r.id !== referral.id && r.referredMobileHash)
      .map((r) => r.referredMobileHash);
    const existingRewardReferralIds = params.allRewards.map((rw) => rw.referralId);

    const decision = await callServerReferralEligibilityCheck({
      referrerUid: referral.referrerUid,
      referredUid: referral.referredUid,
      referredMobileHash: referral.referredMobileHash,
      existingReferredMobileHashes: otherMobileHashes,
      existingRewardReferralIds,
      referralId: referral.id,
      registrationPaymentStatus: 'paid_verified',
      registrationFeePaidInr: params.payment.amountInr,
      paymentReference: params.payment.utrOrGatewayRef,
      paidRegistrationEnabled: true,
      configuredFeeInr: params.config.registrationFeeInr || WORKER_REGISTRATION_FEE_INR,
      configuredRewardInr: params.config.referralRewardInr || SINGLE_LEVEL_REFERRAL_REWARD_INR,
      otpVerified: params.payment.otpVerified,
      referralLevel: 1,
    });

    if (!decision.eligible) {
      await updateDoc(doc(db, 'workerReferrals', referral.id), {
        registrationPaymentStatus: 'paid_verified',
        registrationFeePaidInr: params.payment.amountInr,
        paymentReference: params.payment.utrOrGatewayRef.slice(0, 120),
        paymentId: params.payment.id,
        otpVerified: params.payment.otpVerified,
        singleLevelVerified: true,
        rewardStatus: 'rejected',
        rewardAmountInr: 0,
        fraudFlags: decision.fraudFlags,
        adminNotes: decision.reason.slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      referralOutcome = `Referral rejected by anti-fraud check: ${decision.reason}`;
    } else {
      const rewardId = `rw_${referral.id}`; // Deterministic ID guarantees zero duplicate rewards
      const rewardSnap = await getDoc(doc(db, 'referralRewards', rewardId));
      if (rewardSnap.exists()) {
        referralOutcome = 'Referral reward already recorded for this worker (duplicate blocked).';
      } else {
        const finalRewardStatus = params.autoApproveReferral ? 'approved' : 'pending';
        const refBatch = writeBatch(db);
        refBatch.update(doc(db, 'workerReferrals', referral.id), {
          registrationPaymentStatus: 'paid_verified',
          registrationFeePaidInr: params.payment.amountInr,
          paymentReference: params.payment.utrOrGatewayRef.slice(0, 120),
          paymentId: params.payment.id,
          otpVerified: params.payment.otpVerified,
          singleLevelVerified: true,
          rewardStatus: params.autoApproveReferral ? 'approved' : 'pending_verification',
          rewardAmountInr: decision.rewardAmountInr,
          adminNotes: decision.reason.slice(0, 500),
          updatedAt: serverTimestamp(),
        });
        refBatch.set(doc(db, 'referralRewards', rewardId), {
          referralId: referral.id,
          referrerUid: referral.referrerUid,
          referrerName: referral.referrerName,
          referredUid: referral.referredUid,
          referredWorkerName: referral.referredWorkerName,
          referralCode: referral.referralCode,
          registrationFeeInr: params.payment.amountInr,
          rewardAmountInr: decision.rewardAmountInr,
          status: finalRewardStatus,
          eligibilityReason: decision.reason.slice(0, 300),
          paymentId: params.payment.id,
          paymentReference: params.payment.utrOrGatewayRef.slice(0, 120),
          reviewedByUid: params.adminUid,
          ...(params.payment.isDemo ? { isSimulation: true } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await refBatch.commit();

        if (params.autoApproveReferral) {
          await writeFinancialLedgerEntryIfNotExists(`led_rw_${rewardId}`, {
            entryType: 'referral_reward_credit',
            direction: 'debit',
            amountInr: decision.rewardAmountInr,
            workerUid: referral.referrerUid,
            workerName: referral.referrerName,
            referenceId: rewardId,
            paymentOrUtrRef: params.payment.utrOrGatewayRef,
            description: `Single-level ₹${decision.rewardAmountInr} referral reward credited to ${referral.referrerName} for ${referral.referredWorkerName}`,
            recordedByUid: params.adminUid,
            recordedByEmail: params.adminEmail,
            ...(params.payment.isDemo ? { isDemo: true } : {}),
          });
        }
        await recomputeWorkerReferralWalletFull(referral.referrerUid, referral.referralCode);
        referralOutcome = params.autoApproveReferral
          ? `Single-level ₹${decision.rewardAmountInr} referral reward approved & credited to ${referral.referrerName}.`
          : `Single-level ₹${decision.rewardAmountInr} referral reward created (Pending Admin Approval) for ${referral.referrerName}.`;
      }
    }
  }

  return { verifiedWorkerId, receiptNo, certificateNo, referralOutcome };
}

export async function adminMarkPaymentFailed(params: {
  payment: WorkerRegistrationPayment;
  reason: string;
  adminUid: string;
}): Promise<void> {
  const workerUid = params.payment.workerUid;
  const [pubSnap, privSnap, refSnap] = await Promise.all([
    getDoc(doc(db, 'publicWorkers', workerUid)),
    getDoc(doc(db, 'workerPrivate', workerUid)),
    getDoc(doc(db, 'workerReferrals', workerUid)),
  ]);

  const batch = writeBatch(db);
  batch.update(doc(db, 'workerRegistrationPayments', params.payment.id), {
    status: 'failed',
    adminNotes: params.reason.trim().slice(0, 500) || 'Payment verification failed.',
    verifiedByUid: params.adminUid,
    updatedAt: serverTimestamp(),
  });
  if (pubSnap.exists()) {
    batch.update(doc(db, 'publicWorkers', workerUid), {
      registrationPaymentStatus: 'failed',
      paidBenefitsActive: false,
      updatedAt: serverTimestamp(),
    });
  }
  if (privSnap.exists()) {
    batch.update(doc(db, 'workerPrivate', workerUid), {
      registrationPaymentStatus: 'failed',
      updatedAt: serverTimestamp(),
    });
  }
  if (refSnap.exists()) {
    batch.update(doc(db, 'workerReferrals', workerUid), {
      registrationPaymentStatus: 'payment_failed',
      rewardStatus: 'rejected',
      rewardAmountInr: 0,
      adminNotes: `Registration payment failed: ${params.reason.trim().slice(0, 300)}`,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * Admin refunds a ₹250 worker registration payment:
 * 1. Marks payment 'refunded' with refund ref & reason.
 * 2. Deactivates paid benefits on publicWorkers.
 * 3. Writes ₹250 'registration_refund' entry to financialLedger.
 * 4. Automatically reverses any ₹50 referral reward linked to this worker & recomputes referrer's wallet!
 */
export async function adminRefundWorkerRegistrationPayment(params: {
  payment: WorkerRegistrationPayment;
  refundReference: string;
  refundReason: string;
  adminUid: string;
  adminEmail: string;
}): Promise<{ rewardReversed: boolean; reversedAmountInr: number }> {
  if (params.payment.status !== 'verified') {
    throw new Error('Only a verified payment can be refunded.');
  }

  const workerUid = params.payment.workerUid;
  const rewardId = `rw_${workerUid}`;
  const [pubSnap, privSnap, refSnap, rewardSnap] = await Promise.all([
    getDoc(doc(db, 'publicWorkers', workerUid)),
    getDoc(doc(db, 'workerPrivate', workerUid)),
    getDoc(doc(db, 'workerReferrals', workerUid)),
    getDoc(doc(db, 'referralRewards', rewardId)),
  ]);

  const refundedAtIso = new Date().toISOString();
  const safeRef = params.refundReference.trim().slice(0, 120) || `REF-${Date.now()}`;
  const safeReason = params.refundReason.trim().slice(0, 300) || 'Admin approved registration refund.';

  const batch = writeBatch(db);
  batch.update(doc(db, 'workerRegistrationPayments', params.payment.id), {
    status: 'refunded',
    refundReference: safeRef,
    refundReason: safeReason,
    refundedAtIso,
    verifiedByUid: params.adminUid,
    updatedAt: serverTimestamp(),
  });
  if (pubSnap.exists()) {
    batch.update(doc(db, 'publicWorkers', workerUid), {
      registrationPaymentStatus: 'refunded',
      paidBenefitsActive: false,
      updatedAt: serverTimestamp(),
    });
  }
  if (privSnap.exists()) {
    batch.update(doc(db, 'workerPrivate', workerUid), {
      registrationPaymentStatus: 'refunded',
      updatedAt: serverTimestamp(),
    });
  }

  let rewardReversed = false;
  let reversedAmountInr = 0;
  let referrerUidToRecompute = '';
  let referrerCodeToRecompute = '';
  let referrerNameForLedger = '';

  if (refSnap.exists()) {
    const refData = refSnap.data() as WorkerReferralRecord;
    referrerUidToRecompute = refData.referrerUid;
    referrerCodeToRecompute = refData.referralCode;
    referrerNameForLedger = refData.referrerName;
    batch.update(doc(db, 'workerReferrals', workerUid), {
      registrationPaymentStatus: 'refunded',
      rewardStatus: 'reversed',
      rewardAmountInr: 0,
      adminNotes: `Reversed due to ₹250 registration refund (${safeRef}): ${safeReason}`.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  }

  if (rewardSnap.exists()) {
    const rw = rewardSnap.data() as ReferralRewardRecord;
    if (rw.status !== 'reversed' && rw.status !== 'rejected') {
      rewardReversed = true;
      reversedAmountInr = rw.rewardAmountInr;
      referrerUidToRecompute = rw.referrerUid;
      referrerCodeToRecompute = rw.referralCode;
      referrerNameForLedger = rw.referrerName;
      batch.update(doc(db, 'referralRewards', rewardId), {
        status: 'reversed',
        reversedReason: `Registration refunded (${safeRef}): ${safeReason}`.slice(0, 300),
        reviewedByUid: params.adminUid,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();

  // Immutable ledger entry for ₹250 Refund
  await writeFinancialLedgerEntryIfNotExists(`led_refund_${params.payment.id}`, {
    entryType: 'registration_refund',
    direction: 'debit',
    amountInr: params.payment.amountInr,
    workerUid,
    workerName: params.payment.workerName,
    referenceId: params.payment.id,
    paymentOrUtrRef: safeRef,
    description: `Refunded ₹${params.payment.amountInr} registration fee (${safeReason})`,
    recordedByUid: params.adminUid,
    recordedByEmail: params.adminEmail,
    ...(params.payment.isDemo ? { isDemo: true } : {}),
  });

  if (rewardReversed && reversedAmountInr > 0 && referrerUidToRecompute) {
    await writeFinancialLedgerEntryIfNotExists(`led_rev_${rewardId}`, {
      entryType: 'referral_reward_reversal',
      direction: 'credit',
      amountInr: reversedAmountInr,
      workerUid: referrerUidToRecompute,
      workerName: referrerNameForLedger || 'Referrer',
      referenceId: rewardId,
      paymentOrUtrRef: safeRef,
      description: `Reversed ₹${reversedAmountInr} referral reward due to refunded registration of ${params.payment.workerName}`,
      recordedByUid: params.adminUid,
      recordedByEmail: params.adminEmail,
      ...(params.payment.isDemo ? { isDemo: true } : {}),
    });
  }

  if (referrerUidToRecompute) {
    await recomputeWorkerReferralWalletFull(referrerUidToRecompute, referrerCodeToRecompute);
  }

  return { rewardReversed, reversedAmountInr };
}

export async function adminUpdateReferralRewardStatus(params: {
  reward: ReferralRewardRecord;
  nextStatus: 'approved' | 'rejected' | 'held' | 'reversed';
  adminUid: string;
  adminEmail: string;
  notes?: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'referralRewards', params.reward.id), {
    status: params.nextStatus,
    reviewedByUid: params.adminUid,
    ...(params.notes?.trim() ? { adminNotes: params.notes.trim().slice(0, 500) } : {}),
    ...(params.nextStatus === 'reversed' && params.notes?.trim()
      ? { reversedReason: params.notes.trim().slice(0, 300) }
      : {}),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'workerReferrals', params.reward.referralId), {
    rewardStatus: params.nextStatus,
    ...(params.nextStatus === 'rejected' || params.nextStatus === 'reversed' ? { rewardAmountInr: 0 } : {}),
    ...(params.notes?.trim() ? { adminNotes: params.notes.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  if (params.nextStatus === 'approved') {
    await writeFinancialLedgerEntryIfNotExists(`led_rw_${params.reward.id}`, {
      entryType: 'referral_reward_credit',
      direction: 'debit',
      amountInr: params.reward.rewardAmountInr,
      workerUid: params.reward.referrerUid,
      workerName: params.reward.referrerName,
      referenceId: params.reward.id,
      paymentOrUtrRef: params.reward.paymentReference || params.reward.id,
      description: `Admin approved ₹${params.reward.rewardAmountInr} single-level referral reward for ${params.reward.referrerName}`,
      recordedByUid: params.adminUid,
      recordedByEmail: params.adminEmail,
      ...(params.reward.isSimulation ? { isDemo: true } : {}),
    });
  } else if (params.nextStatus === 'reversed') {
    await writeFinancialLedgerEntryIfNotExists(`led_rev_${params.reward.id}`, {
      entryType: 'referral_reward_reversal',
      direction: 'credit',
      amountInr: params.reward.rewardAmountInr,
      workerUid: params.reward.referrerUid,
      workerName: params.reward.referrerName,
      referenceId: params.reward.id,
      paymentOrUtrRef: params.reward.paymentReference || params.reward.id,
      description: `Reversed ₹${params.reward.rewardAmountInr} referral reward (${params.notes?.trim() || 'Fraud / compliance reversal'})`,
      recordedByUid: params.adminUid,
      recordedByEmail: params.adminEmail,
      ...(params.reward.isSimulation ? { isDemo: true } : {}),
    });
  }

  await recomputeWorkerReferralWalletFull(params.reward.referrerUid, params.reward.referralCode);
}

/**
 * Worker submits a withdrawal request from their available Referral Wallet balance.
 * Sensitive UPI/Bank details are stored strictly in workerPayoutSecrets (owner + admin only).
 */
export async function workerSubmitWithdrawalRequest(params: {
  workerUid: string;
  workerName: string;
  referralCode: string;
  amountInr: number;
  availableBalanceInr: number;
  payoutMethod: 'upi' | 'bank_transfer';
  upiId?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
}): Promise<string> {
  const amt = Math.floor(Number(params.amountInr) || 0);
  if (amt < 50) {
    throw new Error('Minimum withdrawal amount is ₹50.');
  }
  if (amt > params.availableBalanceInr) {
    throw new Error(`Requested amount ₹${amt} exceeds your available balance of ₹${params.availableBalanceInr}.`);
  }

  if (params.payoutMethod === 'upi') {
    const cleanUpi = (params.upiId || '').trim();
    if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(cleanUpi)) {
      throw new Error('Please enter a valid UPI ID (e.g., name@upi or mobile@okaxis).');
    }
  } else {
    if (!params.accountHolderName?.trim() || (params.accountNumber || '').replace(/\D/g, '').length < 8) {
      throw new Error('Please enter valid Account Holder Name and Bank Account Number.');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test((params.ifscCode || '').trim())) {
      throw new Error('Please enter a valid 11-character IFSC code (e.g., SBIN0001234).');
    }
  }

  const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const maskedDestination = maskPayoutDestinationClient({
    payoutMethod: params.payoutMethod,
    upiId: params.upiId,
    accountNumber: params.accountNumber,
    ifscCode: params.ifscCode,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'referralWithdrawals', withdrawalId), {
      workerUid: params.workerUid,
      workerName: params.workerName.trim().slice(0, 120),
      referralCode: params.referralCode.trim().slice(0, 32),
      amountInr: amt,
      payoutMethod: params.payoutMethod,
      maskedDestination,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'workerPayoutSecrets', withdrawalId), {
      withdrawalId,
      ownerUid: params.workerUid,
      payoutMethod: params.payoutMethod,
      ...(params.payoutMethod === 'upi' && params.upiId
        ? { upiId: params.upiId.trim().slice(0, 100) }
        : {}),
      ...(params.payoutMethod === 'bank_transfer'
        ? {
            accountHolderName: (params.accountHolderName || '').trim().slice(0, 120),
            accountNumber: (params.accountNumber || '').replace(/\s+/g, '').slice(0, 40),
            ifscCode: (params.ifscCode || '').trim().toUpperCase().slice(0, 20),
            ...(params.bankName?.trim() ? { bankName: params.bankName.trim().slice(0, 100) } : {}),
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return withdrawalId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'referralWithdrawals');
  }
}

export async function adminFetchPayoutSecret(withdrawalId: string): Promise<WorkerPayoutSecret | null> {
  const snap = await getDoc(doc(db, 'workerPayoutSecrets', withdrawalId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkerPayoutSecret) : null;
}

export async function adminProcessWithdrawalRequest(params: {
  withdrawal: ReferralWithdrawalRequest;
  nextStatus: Exclude<WithdrawalRequestStatus, 'pending'>;
  transactionReference?: string;
  adminNotes?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  if (params.nextStatus === 'paid' && (!params.transactionReference || params.transactionReference.trim().length < 4)) {
    throw new Error('Enter a valid UTR / bank transfer reference before marking withdrawal Paid.');
  }

  const updatePayload: Record<string, unknown> = {
    status: params.nextStatus,
    reviewedByUid: params.adminUid,
    ...(params.adminNotes?.trim() ? { adminNotes: params.adminNotes.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  };

  if (params.nextStatus === 'paid') {
    updatePayload.transactionReference = params.transactionReference!.trim().slice(0, 120);
    updatePayload.paidAtIso = new Date().toISOString();
  }

  await updateDoc(doc(db, 'referralWithdrawals', params.withdrawal.id), updatePayload);

  if (params.nextStatus === 'paid') {
    await writeFinancialLedgerEntryIfNotExists(`led_wd_${params.withdrawal.id}`, {
      entryType: 'withdrawal_payout',
      direction: 'debit',
      amountInr: params.withdrawal.amountInr,
      workerUid: params.withdrawal.workerUid,
      workerName: params.withdrawal.workerName,
      referenceId: params.withdrawal.id,
      paymentOrUtrRef: params.transactionReference!.trim().slice(0, 120),
      description: `Settled referral withdrawal ₹${params.withdrawal.amountInr} to ${params.withdrawal.workerName} (${params.withdrawal.maskedDestination})`,
      recordedByUid: params.adminUid,
      recordedByEmail: params.adminEmail,
      ...(params.withdrawal.isDemo ? { isDemo: true } : {}),
    });
  }

  await recomputeWorkerReferralWalletFull(params.withdrawal.workerUid, params.withdrawal.referralCode);
}

export function computeClientFinancialReport(params: {
  payments: Pick<WorkerRegistrationPayment, 'amountInr' | 'status'>[];
  rewards: Pick<ReferralRewardRecord, 'rewardAmountInr' | 'status'>[];
  withdrawals: Pick<ReferralWithdrawalRequest, 'amountInr' | 'status'>[];
}): FinancialReportSummary {
  let grossRegistrationRevenueInr = 0;
  let verifiedRegistrationCount = 0;
  let pendingRegistrationCount = 0;
  let failedRegistrationCount = 0;
  let refundsInr = 0;
  let refundedCount = 0;

  for (const p of params.payments) {
    const amt = Number(p.amountInr) || 0;
    if (p.status === 'verified') {
      verifiedRegistrationCount += 1;
      grossRegistrationRevenueInr += amt;
    } else if (p.status === 'refunded') {
      refundedCount += 1;
      grossRegistrationRevenueInr += amt;
      refundsInr += amt;
    } else if (p.status === 'pending') {
      pendingRegistrationCount += 1;
    } else if (p.status === 'failed') {
      failedRegistrationCount += 1;
    }
  }

  let referralRewardsGrossInr = 0;
  let referralRewardsReversedInr = 0;
  let referralRewardsNetInr = 0;
  for (const rw of params.rewards) {
    const amt = Number(rw.rewardAmountInr) || 0;
    if (rw.status === 'approved' || rw.status === 'paid') {
      referralRewardsGrossInr += amt;
      referralRewardsNetInr += amt;
    } else if (rw.status === 'reversed') {
      referralRewardsGrossInr += amt;
      referralRewardsReversedInr += amt;
    }
  }

  let withdrawalsPaidInr = 0;
  let withdrawalsPendingInr = 0;
  for (const w of params.withdrawals) {
    const amt = Number(w.amountInr) || 0;
    if (w.status === 'paid') withdrawalsPaidInr += amt;
    else if (w.status === 'pending' || w.status === 'approved') withdrawalsPendingInr += amt;
  }

  return {
    grossRegistrationRevenueInr,
    verifiedRegistrationCount,
    pendingRegistrationCount,
    failedRegistrationCount,
    refundsInr,
    refundedCount,
    referralRewardsGrossInr,
    referralRewardsReversedInr,
    referralRewardsNetInr,
    withdrawalsPaidInr,
    withdrawalsPendingInr,
    netBalanceInr: grossRegistrationRevenueInr - refundsInr - referralRewardsNetInr,
  };
}

function downloadCsvFile(filename: string, headers: string[], rows: unknown[][]): void {
  const esc = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRegistrationPaymentsCsv(payments: WorkerRegistrationPayment[]): void {
  downloadCsvFile(
    `rojgar_setu_registration_payments_${getTodayIsoDate()}.csv`,
    [
      'Payment ID',
      'Worker Name',
      'Provisional App ID',
      'Verified Worker ID',
      'Amount (INR)',
      'Method',
      'Status',
      'Order Ref',
      'UTR / Gateway Ref',
      'Receipt No',
      'Certificate No',
      'OTP Verified',
      'Referred By Code',
      'Refund Ref',
      'Verified At',
    ],
    payments.map((p) => [
      p.id,
      p.workerName,
      p.provisionalAppId,
      p.verifiedWorkerId || '',
      p.amountInr,
      p.paymentMethod,
      p.status,
      p.orderRef,
      p.utrOrGatewayRef,
      p.receiptNo || '',
      p.certificateNo || '',
      p.otpVerified ? 'YES' : 'NO',
      p.referredByCode || '',
      p.refundReference || '',
      p.verifiedAtIso || '',
    ])
  );
}

export function exportWithdrawalsCsv(withdrawals: ReferralWithdrawalRequest[]): void {
  downloadCsvFile(
    `rojgar_setu_referral_withdrawals_${getTodayIsoDate()}.csv`,
    [
      'Withdrawal ID',
      'Worker Name',
      'Referral Code',
      'Amount (INR)',
      'Method',
      'Masked Destination',
      'Status',
      'Transaction Ref',
      'Paid At',
      'Admin Notes',
    ],
    withdrawals.map((w) => [
      w.id,
      w.workerName,
      w.referralCode,
      w.amountInr,
      w.payoutMethod,
      w.maskedDestination,
      w.status,
      w.transactionReference || '',
      w.paidAtIso || '',
      w.adminNotes || '',
    ])
  );
}

export function exportFinancialLedgerCsv(entries: FinancialLedgerEntry[]): void {
  downloadCsvFile(
    `rojgar_setu_financial_ledger_${getTodayIsoDate()}.csv`,
    [
      'Entry ID',
      'Type',
      'Direction',
      'Amount (INR)',
      'Worker Name',
      'Reference ID',
      'Payment/UTR Ref',
      'Description',
      'Recorded By',
    ],
    entries.map((e) => [
      e.id,
      e.entryType,
      e.direction,
      e.amountInr,
      e.workerName,
      e.referenceId,
      e.paymentOrUtrRef,
      e.description,
      e.recordedByEmail,
    ])
  );
}
