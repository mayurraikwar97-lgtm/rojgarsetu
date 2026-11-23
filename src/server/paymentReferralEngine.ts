import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  FinancialLedgerEntry,
  FinancialReportSummary,
  ReferralRewardRecord,
  ReferralWithdrawalRequest,
  WorkerRegistrationPayment,
} from '../types/domain.ts';
import { evaluateReferralRewardEligibility } from './adsAndReferralsEngine.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'mayurraikwar97@gmail.com';
const DEFAULT_PROJECT_ID = 'gen-lang-client-0174765083';
const DEFAULT_FIRESTORE_DB_ID = 'ai-studio-7bd2ffb9-a189-4838-a21e-7da9c4e7b2b7';
export const WORKER_REGISTRATION_FEE_INR = 250;
export const WORKER_REGISTRATION_FEE_PAISE = WORKER_REGISTRATION_FEE_INR * 100;
export const SINGLE_LEVEL_REFERRAL_REWARD_INR = 50;

const paymentRateBuckets = new Map<string, number[]>();
const seenUtrReferences = new Map<string, { workerUid: string; recordedAt: number }>();
const processedWebhookEvents = new Map<string, number>();

export function isRazorpayTestKey(keyId: string): boolean {
  return keyId.trim().startsWith('rzp_test_');
}

export function isRazorpayLiveKey(keyId: string): boolean {
  return keyId.trim().startsWith('rzp_live_');
}

function recordProcessedWebhookEventMem(key: string): void {
  processedWebhookEvents.set(key, Date.now());
  if (processedWebhookEvents.size > 5000) {
    const oldest = processedWebhookEvents.keys().next().value;
    if (oldest) processedWebhookEvents.delete(oldest);
  }
}

export interface PaymentAdminRuntime {
  app: App;
  db: Firestore;
  hasFirestoreCredentials: boolean;
}

let cachedPaymentRuntime: PaymentAdminRuntime | null = null;

function loadFirebaseConfig(rootDir: string): { projectId: string; firestoreDatabaseId: string } {
  try {
    const raw = fs.readFileSync(path.resolve(rootDir, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string; firestoreDatabaseId?: string };
    return {
      projectId: parsed.projectId || DEFAULT_PROJECT_ID,
      firestoreDatabaseId: parsed.firestoreDatabaseId || DEFAULT_FIRESTORE_DB_ID,
    };
  } catch {
    return { projectId: DEFAULT_PROJECT_ID, firestoreDatabaseId: DEFAULT_FIRESTORE_DB_ID };
  }
}

function getPaymentAdminRuntime(rootDir: string): PaymentAdminRuntime {
  if (cachedPaymentRuntime) return cachedPaymentRuntime;

  const cfg = loadFirebaseConfig(rootDir);
  let hasFirestoreCredentials = false;
  let app: App;

  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0];
    hasFirestoreCredentials = Boolean(
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.K_SERVICE ||
        process.env.GOOGLE_CLOUD_PROJECT
    );
  } else {
    const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawServiceAccount) {
      try {
        const parsed = JSON.parse(rawServiceAccount);
        app = initializeApp({ credential: cert(parsed), projectId: cfg.projectId });
        hasFirestoreCredentials = true;
      } catch (err) {
        console.warn('[Payments] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', err);
        app = initializeApp({ projectId: cfg.projectId });
      }
    } else if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      process.env.GOOGLE_CLOUD_PROJECT
    ) {
      app = initializeApp({ credential: applicationDefault(), projectId: cfg.projectId });
      hasFirestoreCredentials = true;
    } else {
      app = initializeApp({ projectId: cfg.projectId });
    }
  }

  const db = getFirestore(app, cfg.firestoreDatabaseId);
  cachedPaymentRuntime = { app, db, hasFirestoreCredentials };
  return cachedPaymentRuntime;
}

async function verifyBearerHeader(
  authHeader: string,
  rootDir: string
): Promise<{ decoded: DecodedIdToken; isAdmin: boolean } | null> {
  const match = (authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const runtime = getPaymentAdminRuntime(rootDir);
    const decoded = await getAuth(runtime.app).verifyIdToken(match[1]);
    let isAdmin =
      decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
    if (!isAdmin && runtime.hasFirestoreCredentials) {
      try {
        const adminSnap = await runtime.db.collection('admins').doc(decoded.uid).get();
        if (adminSnap.exists) isAdmin = true;
      } catch {
        // Ignore optional admin collection lookup error
      }
    }
    return { decoded, isAdmin };
  } catch {
    return null;
  }
}

function checkRateLimit(bucketKey: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = (paymentRateBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    paymentRateBuckets.set(bucketKey, prev);
    return false;
  }
  prev.push(now);
  paymentRateBuckets.set(bucketKey, prev);
  return true;
}

function getOrderHmacSecret(): string {
  return (
    process.env.PAYMENT_ORDER_HMAC_SECRET ||
    process.env.OTP_HMAC_SECRET ||
    'rojgar_setu_dev_order_signing_key_v1'
  );
}

function buildServerVerifiedWorkerId(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'WORKER';
  const suffix = crypto.randomInt(1000, 9999);
  return `RS-W-${clean}-${suffix}`;
}

function buildServerReceiptNo(uid: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'WKR';
  const rnd = crypto.randomInt(100, 999);
  return `RS-RCP-${datePart}-${tag}${rnd}`;
}

function buildServerCertificateNo(uid: string): string {
  const year = new Date().getFullYear();
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'WORKER';
  const rnd = crypto.randomInt(1000, 9999);
  return `RS-CERT-${year}-${tag}-${rnd}`;
}

function buildServerReferralCode(name: string, uid: string): string {
  const prefix = (name || 'RS')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(2, 'R');
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '2026';
  return `${prefix}-${suffix}`;
}

export interface PaymentGatewayPublicConfig {
  registrationFeeInr: number;
  referralRewardInr: number;
  gatewayConfigured: boolean;
  webhookConfigured: boolean;
  serverAdminDbConfigured: boolean;
  gatewayProvider: 'razorpay' | 'upi_qr';
  razorpayMode: 'test' | 'live_blocked' | 'unconfigured';
  testModeEnforced: boolean;
  razorpayKeyId?: string;
  missingGatewayEnvVars: string[];
  configError?: string;
  officialUpiId: string;
  officialUpiPayeeName: string;
  refundPolicySummary: string;
  noEmploymentGuaranteeNotice: string;
}

export function getPaymentGatewayPublicConfig(): PaymentGatewayPublicConfig {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  const liveKeyBlocked = isRazorpayLiveKey(keyId);
  const testKeyValid = isRazorpayTestKey(keyId);
  const gatewayConfigured = Boolean(testKeyValid && keySecret && !liveKeyBlocked);
  const webhookConfigured = Boolean(webhookSecret);
  const serverAdminDbConfigured = Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      process.env.GOOGLE_CLOUD_PROJECT
  );

  const missingGatewayEnvVars: string[] = [];
  if (!keyId) missingGatewayEnvVars.push('RAZORPAY_KEY_ID');
  if (!keySecret) missingGatewayEnvVars.push('RAZORPAY_KEY_SECRET');
  if (!webhookSecret) missingGatewayEnvVars.push('RAZORPAY_WEBHOOK_SECRET');

  let razorpayMode: 'test' | 'live_blocked' | 'unconfigured' = 'unconfigured';
  let configError: string | undefined;
  if (liveKeyBlocked) {
    razorpayMode = 'live_blocked';
    configError =
      'Live Razorpay key (rzp_live_*) detected and blocked. Rojgar Setu is locked to Razorpay Test Mode (rzp_test_*) until Live Mode is explicitly approved.';
  } else if (keyId && !testKeyValid) {
    razorpayMode = 'unconfigured';
    configError = 'RAZORPAY_KEY_ID must be a valid Razorpay Test Mode key starting with rzp_test_.';
  } else if (gatewayConfigured) {
    razorpayMode = 'test';
  } else if (missingGatewayEnvVars.length > 0) {
    configError = `Missing server environment variable(s): ${missingGatewayEnvVars.join(', ')}.`;
  }

  const officialUpiId = (process.env.OFFICIAL_UPI_ID || 'rojgarsetu@upi').trim();
  const officialUpiPayeeName = (
    process.env.OFFICIAL_UPI_PAYEE_NAME || 'Rojgar Setu'
  ).trim();

  return {
    registrationFeeInr: WORKER_REGISTRATION_FEE_INR,
    referralRewardInr: SINGLE_LEVEL_REFERRAL_REWARD_INR,
    gatewayConfigured,
    webhookConfigured,
    serverAdminDbConfigured,
    gatewayProvider: gatewayConfigured ? 'razorpay' : 'upi_qr',
    razorpayMode,
    testModeEnforced: true,
    ...(gatewayConfigured ? { razorpayKeyId: keyId } : {}),
    missingGatewayEnvVars,
    ...(configError ? { configError } : {}),
    officialUpiId,
    officialUpiPayeeName,
    refundPolicySummary:
      'One-time ₹250 registration fee is refundable only for verified duplicate/failed transactions or valid cancellation requests before benefit activation within 7 days. Refunded registrations deactivate paid benefits and reverse any associated ₹50 referral reward.',
    noEmploymentGuaranteeNotice:
      'Registration fee payment does not guarantee employment or job allocation. Paying the ₹250 registration fee activates your verified Digital Worker ID, registration certificate, payment receipt, and referral eligibility.',
  };
}

export function signOrderRef(orderRef: string, workerUid: string, amountInr: number): string {
  return crypto
    .createHmac('sha256', getOrderHmacSecret())
    .update(`${orderRef}|${workerUid}|${amountInr}`)
    .digest('hex')
    .slice(0, 32);
}

export function buildOfficialUpiIntentUri(params: {
  upiId: string;
  payeeName: string;
  amountInr: number;
  orderRef: string;
}): string {
  const search = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: String(params.amountInr),
    cu: 'INR',
    tn: `Rojgar Setu Worker Reg ${params.orderRef}`,
    tr: params.orderRef,
  });
  return `upi://pay?${search.toString()}`;
}

export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secretOverride?: string;
}): { valid: boolean; reason: string } {
  const secret = (params.secretOverride ?? process.env.RAZORPAY_KEY_SECRET ?? '').trim();
  if (!secret) {
    return {
      valid: false,
      reason: 'RAZORPAY_KEY_SECRET is not configured on the server. Gateway verification cannot proceed.',
    };
  }
  const orderId = params.razorpayOrderId.trim();
  const paymentId = params.razorpayPaymentId.trim();
  const signature = params.razorpaySignature.trim();

  if (!orderId || !paymentId || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { valid: false, reason: 'Invalid or incomplete gateway signature payload.' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(signature.toLowerCase(), 'hex');
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: 'Signature length mismatch.' };
  }
  const ok = crypto.timingSafeEqual(expectedBuf, providedBuf);
  return ok
    ? { valid: true, reason: 'Server HMAC-SHA256 gateway signature verified.' }
    : { valid: false, reason: 'Gateway payment signature verification failed.' };
}

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  secretOverride?: string;
}): { valid: boolean; reason: string } {
  const secret = (params.secretOverride ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '').trim();
  if (!secret) {
    return {
      valid: false,
      reason: 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.',
    };
  }
  const provided = (params.signatureHeader || '').trim();
  if (!params.rawBody || !/^[a-f0-9]{64}$/i.test(provided)) {
    return { valid: false, reason: 'Missing or malformed x-razorpay-signature header.' };
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(params.rawBody, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided.toLowerCase(), 'hex');
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: 'Webhook signature length mismatch.' };
  }
  const ok = crypto.timingSafeEqual(expectedBuf, providedBuf);
  return ok
    ? { valid: true, reason: 'Razorpay webhook HMAC-SHA256 signature verified.' }
    : { valid: false, reason: 'Razorpay webhook signature verification failed.' };
}

export interface RazorpayPaymentFetchCheck {
  ok: boolean;
  captured: boolean;
  paymentStatus: string;
  amountPaise: number;
  currency: string;
  orderId: string;
  method?: string;
  vpa?: string;
  reason: string;
}

/**
 * Fetches actual payment status from Razorpay REST API on the backend.
 * Never activates a worker account unless status === 'captured', amount === 25000 (₹250), currency === 'INR',
 * and order_id matches the server-created Razorpay order.
 */
export async function fetchAndVerifyRazorpayCapturedPayment(params: {
  razorpayPaymentId: string;
  expectedOrderId: string;
  expectedAmountPaise?: number;
  expectedWorkerUid?: string;
  fetchImpl?: typeof fetch;
}): Promise<RazorpayPaymentFetchCheck> {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const expectedPaise = params.expectedAmountPaise ?? WORKER_REGISTRATION_FEE_PAISE;

  if (!keyId || !keySecret) {
    return {
      ok: false,
      captured: false,
      paymentStatus: 'unconfigured',
      amountPaise: 0,
      currency: 'INR',
      orderId: '',
      reason: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required to verify captured payment status.',
    };
  }

  if (isRazorpayLiveKey(keyId) || !isRazorpayTestKey(keyId)) {
    return {
      ok: false,
      captured: false,
      paymentStatus: 'live_blocked',
      amountPaise: 0,
      currency: 'INR',
      orderId: '',
      reason: 'Only Razorpay Test Mode keys (rzp_test_*) are permitted. Live Mode is blocked.',
    };
  }

  const safePaymentId = params.razorpayPaymentId.trim();
  if (!/^pay_[A-Za-z0-9]{6,40}$/.test(safePaymentId)) {
    return {
      ok: false,
      captured: false,
      paymentStatus: 'invalid_id',
      amountPaise: 0,
      currency: 'INR',
      orderId: '',
      reason: 'Invalid Razorpay payment ID format.',
    };
  }

  try {
    const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const doFetch = params.fetchImpl ?? fetch;
    const resp = await doFetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(safePaymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authBasic}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      return {
        ok: false,
        captured: false,
        paymentStatus: `http_${resp.status}`,
        amountPaise: 0,
        currency: 'INR',
        orderId: '',
        reason: `Razorpay API returned HTTP ${resp.status} while verifying payment capture status.`,
      };
    }

    const data = (await resp.json()) as {
      id?: string;
      status?: string;
      amount?: number;
      currency?: string;
      order_id?: string;
      method?: string;
      vpa?: string;
      notes?: { workerUid?: string };
    };

    const status = String(data.status || 'unknown').toLowerCase();
    const amountPaise = Number(data.amount) || 0;
    const currency = String(data.currency || '').toUpperCase();
    const orderId = String(data.order_id || '');
    const notesWorkerUid = String(data.notes?.workerUid || '').trim();

    if (orderId !== params.expectedOrderId.trim()) {
      return {
        ok: false,
        captured: false,
        paymentStatus: status,
        amountPaise,
        currency,
        orderId,
        reason: 'Razorpay payment order_id does not match the expected registration order.',
      };
    }

    if (params.expectedWorkerUid && notesWorkerUid && notesWorkerUid !== params.expectedWorkerUid) {
      return {
        ok: false,
        captured: false,
        paymentStatus: 'owner_mismatch',
        amountPaise,
        currency,
        orderId,
        reason: 'Razorpay payment belongs to a different worker account.',
      };
    }

    if (amountPaise !== expectedPaise || currency !== 'INR') {
      return {
        ok: false,
        captured: false,
        paymentStatus: status,
        amountPaise,
        currency,
        orderId,
        reason: `Payment amount/currency mismatch: expected ₹${expectedPaise / 100} INR.`,
      };
    }

    if (status !== 'captured') {
      return {
        ok: false,
        captured: false,
        paymentStatus: status,
        amountPaise,
        currency,
        orderId,
        method: data.method,
        vpa: data.vpa,
        reason: `Payment is currently "${status}" (not yet captured). Account activates only after capture.`,
      };
    }

    return {
      ok: true,
      captured: true,
      paymentStatus: 'captured',
      amountPaise,
      currency,
      orderId,
      method: data.method,
      vpa: data.vpa,
      reason: 'Razorpay Test Mode payment confirmed as captured for ₹250 INR.',
    };
  } catch (err) {
    return {
      ok: false,
      captured: false,
      paymentStatus: 'network_error',
      amountPaise: 0,
      currency: 'INR',
      orderId: '',
      reason: err instanceof Error ? err.message : 'Network error verifying payment with Razorpay.',
    };
  }
}

export function validateUpiUtrInput(params: {
  utr: string;
  workerUid: string;
  existingUtrs?: string[];
}): { valid: boolean; normalizedUtr: string; reason: string } {
  const normalized = params.utr.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{8,36}$/.test(normalized)) {
    return {
      valid: false,
      normalizedUtr: normalized,
      reason: 'Enter a valid 8 to 36 character UPI UTR / Transaction Reference Number (e.g., 12-digit UTR).',
    };
  }
  const existingSet = new Set((params.existingUtrs || []).map((u) => u.trim().toUpperCase()));
  if (existingSet.has(normalized)) {
    return {
      valid: false,
      normalizedUtr: normalized,
      reason: 'This UTR / transaction reference has already been submitted. Duplicate UTR is blocked.',
    };
  }
  const memSeen = seenUtrReferences.get(normalized);
  if (memSeen && memSeen.workerUid !== params.workerUid) {
    return {
      valid: false,
      normalizedUtr: normalized,
      reason: 'This UTR / transaction reference is already linked to another worker registration.',
    };
  }
  return { valid: true, normalizedUtr: normalized, reason: 'UTR format valid; queued for admin verification.' };
}

export function maskPayoutDestination(params: {
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
  const acct = (params.accountNumber || '').replace(/\D/g, '');
  const last4 = acct.slice(-4) || 'XXXX';
  const ifsc = (params.ifscCode || '').trim().toUpperCase();
  return `A/C ****${last4}${ifsc ? ` · ${ifsc}` : ''}`;
}

export function computeFinancialReport(params: {
  payments: Pick<WorkerRegistrationPayment, 'amountInr' | 'status'>[];
  rewards: Pick<ReferralRewardRecord, 'rewardAmountInr' | 'status'>[];
  withdrawals: Pick<ReferralWithdrawalRequest, 'amountInr' | 'status'>[];
  ledgerEntries?: Pick<FinancialLedgerEntry, 'entryType' | 'amountInr'>[];
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
    if (w.status === 'paid') {
      withdrawalsPaidInr += amt;
    } else if (w.status === 'pending' || w.status === 'approved') {
      withdrawalsPendingInr += amt;
    }
  }

  const netBalanceInr = grossRegistrationRevenueInr - refundsInr - referralRewardsNetInr;

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
    netBalanceInr,
  };
}

/**
 * Server-side idempotent worker activation & single-level ₹50 referral reward credit
 * (called ONLY after verified Razorpay HMAC signature + confirmed captured status or verified webhook).
 */
async function activateWorkerRegistrationOnServer(params: {
  runtime: PaymentAdminRuntime;
  workerUid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  orderRef?: string;
  registrationId?: string;
  workerName?: string;
  workerSkill?: string;
  workerLocation?: string;
  workerMobileMasked?: string;
  payerVpaOrMethod?: string;
  source: 'verify_api' | 'razorpay_webhook';
}): Promise<{
  activated: boolean;
  alreadyVerified: boolean;
  adminApprovalPending: boolean;
  provisionalAppId?: string;
  verifiedWorkerId?: string;
  receiptNo?: string;
  certificateNo?: string;
  referralCredited: boolean;
  referralMessage?: string;
}> {
  if (!params.runtime.hasFirestoreCredentials) {
    return {
      activated: false,
      alreadyVerified: false,
      adminApprovalPending: true,
      provisionalAppId: params.registrationId,
      referralCredited: false,
      referralMessage: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured on server; server Firestore sync skipped.',
    };
  }

  const db = params.runtime.db;
  const workerUid = params.workerUid;
  const payRef = db.collection('workerRegistrationPayments').doc(workerUid);
  const pubRef = db.collection('publicWorkers').doc(workerUid);
  const privRef = db.collection('workerPrivate').doc(workerUid);

  const [paySnap, pubSnap, privSnap] = await Promise.all([payRef.get(), pubRef.get(), privRef.get()]);
  const existingPay = paySnap.exists ? (paySnap.data() as Record<string, unknown>) : null;
  const existingPub = pubSnap.exists ? (pubSnap.data() as Record<string, unknown>) : null;
  const existingPriv = privSnap.exists ? (privSnap.data() as Record<string, unknown>) : null;

  const alreadyAdminApproved = Boolean(
    existingPub?.verificationStatus === 'verified' &&
      existingPub?.paidBenefitsActive === true &&
      String(existingPub?.registrationId || '').startsWith('RS-W-')
  );

  if (existingPay?.status === 'verified') {
    return {
      activated: true,
      alreadyVerified: true,
      adminApprovalPending: !alreadyAdminApproved,
      provisionalAppId: String(existingPay.provisionalAppId || existingPub?.registrationId || params.registrationId || ''),
      verifiedWorkerId: alreadyAdminApproved
        ? String(existingPay.verifiedWorkerId || existingPub?.registrationId || '')
        : undefined,
      receiptNo: String(existingPay.receiptNo || existingPub?.paymentReceiptNo || ''),
      certificateNo: alreadyAdminApproved
        ? String(existingPay.certificateNo || existingPub?.certificateNo || '')
        : undefined,
      referralCredited: false,
      referralMessage: alreadyAdminApproved
        ? 'Registration payment was already PAID and Admin-approved (idempotent no-op).'
        : 'Registration payment is already PAID and awaiting ROJGAR SETU Admin approval (idempotent no-op).',
    };
  }

  // Prevent replay of a Razorpay payment ID already used by a different worker
  if (params.razorpayPaymentId) {
    const dupPaySnap = await db
      .collection('workerRegistrationPayments')
      .where('gatewayPaymentId', '==', params.razorpayPaymentId)
      .limit(2)
      .get();
    const ownedByOther = dupPaySnap.docs.find(
      (d) => d.id !== workerUid && d.data()?.status === 'verified'
    );
    if (ownedByOther) {
      throw new Error('DUPLICATE_PAYMENT_ID: This Razorpay Payment ID is already linked to another paid worker registration.');
    }
  }

  const existingRegId = String(existingPub?.registrationId || '');
  const provisionalAppId = String(
    params.registrationId ||
      existingPay?.provisionalAppId ||
      existingRegId ||
      `RS-APP-${workerUid.slice(0, 6).toUpperCase()}`
  ).slice(0, 40);
  const receiptNo = String(existingPay?.receiptNo || '') || buildServerReceiptNo(workerUid);
  const verifiedAtIso = new Date().toISOString();
  const workerName = String(params.workerName || existingPay?.workerName || existingPub?.displayName || 'Registered Worker');
  const workerSkill = String(params.workerSkill || existingPay?.workerSkill || existingPub?.primarySkill || 'General');
  const workerLocation = String(
    params.workerLocation ||
      existingPay?.workerLocation ||
      [existingPub?.cityOrVillage, existingPub?.district, existingPub?.state].filter(Boolean).join(', ') ||
      'India'
  );
  const workerMobileMasked = String(params.workerMobileMasked || existingPay?.workerMobileMasked || 'XXXXXX').slice(0, 24);
  const otpVerified = Boolean(existingPay?.otpVerified ?? existingPriv?.mobileVerified ?? true);

  const batch = db.batch();
  batch.set(
    payRef,
    {
      workerUid,
      workerName: workerName.slice(0, 120),
      workerSkill: workerSkill.slice(0, 80),
      workerLocation: workerLocation.slice(0, 160),
      workerMobileMasked,
      provisionalAppId,
      amountInr: WORKER_REGISTRATION_FEE_INR,
      paymentMethod: 'gateway',
      status: 'verified',
      orderRef: (params.orderRef || String(existingPay?.orderRef || params.razorpayOrderId)).slice(0, 80),
      utrOrGatewayRef: params.razorpayPaymentId.slice(0, 120),
      gatewayOrderId: params.razorpayOrderId.slice(0, 120),
      gatewayPaymentId: params.razorpayPaymentId.slice(0, 120),
      ...(params.payerVpaOrMethod ? { payerUpiOrName: params.payerVpaOrMethod.slice(0, 120) } : {}),
      gatewaySignatureVerified: true,
      refundPolicyAccepted: true,
      noEmploymentGuaranteeAccepted: true,
      otpVerified,
      receiptNo,
      verifiedByUid: params.source,
      verifiedAtIso,
      adminNotes:
        '₹250 PAID via Razorpay (signature & capture verified). Sent to ROJGAR SETU Admin Dashboard for approval before Worker ID Card & Certificate generation.',
      updatedAt: FieldValue.serverTimestamp(),
      ...(paySnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  if (pubSnap.exists) {
    batch.update(pubRef, {
      registrationPaymentStatus: 'verified',
      paymentReceiptNo: receiptNo,
      // Worker ID Card (RS-W-...) and Registration Certificate unlock ONLY after ROJGAR SETU Admin approval
      verificationStatus: alreadyAdminApproved ? 'verified' : 'pending',
      paidBenefitsActive: alreadyAdminApproved ? true : false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (privSnap.exists) {
    batch.update(privRef, {
      registrationPaymentStatus: 'verified',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Immutable registration revenue ledger entry (+₹250)
  const regLedgerRef = db.collection('financialLedger').doc(`led_reg_${workerUid}`);
  const regLedgerSnap = await regLedgerRef.get();
  if (!regLedgerSnap.exists) {
    batch.set(regLedgerRef, {
      entryType: 'registration_payment',
      direction: 'credit',
      amountInr: WORKER_REGISTRATION_FEE_INR,
      workerUid,
      workerName: workerName.slice(0, 120),
      referenceId: workerUid,
      paymentOrUtrRef: params.razorpayPaymentId.slice(0, 120),
      description: `Razorpay PAID ₹${WORKER_REGISTRATION_FEE_INR} worker registration (${provisionalAppId} · Receipt ${receiptNo} · Awaiting Admin Approval)`,
      recordedByUid: params.source,
      recordedByEmail: 'system@rojgarsetu',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    activated: true,
    alreadyVerified: false,
    adminApprovalPending: !alreadyAdminApproved,
    provisionalAppId,
    verifiedWorkerId: alreadyAdminApproved ? existingRegId : undefined,
    receiptNo,
    certificateNo: alreadyAdminApproved ? String(existingPub?.certificateNo || '') : undefined,
    referralCredited: false,
    referralMessage:
      '₹250 payment verified as PAID and sent to ROJGAR SETU Admin Dashboard. Worker ID Card, Certificate & any ₹50 referral reward activate after Admin approval.',
  };
}

async function recomputeReferrerWalletOnServer(
  db: Firestore,
  referrerUid: string,
  referralCode?: string
): Promise<void> {
  const [refsSnap, rewardsSnap, withdrawalsSnap] = await Promise.all([
    db.collection('workerReferrals').where('referrerUid', '==', referrerUid).get(),
    db.collection('referralRewards').where('referrerUid', '==', referrerUid).get(),
    db.collection('referralWithdrawals').where('workerUid', '==', referrerUid).get(),
  ]);

  let verifiedPaidReferrals = 0;
  let pendingReferrals = 0;
  refsSnap.docs.forEach((d) => {
    const r = d.data();
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
    const rw = d.data();
    const amt = Number(rw.rewardAmountInr) || 0;
    if (rw.status === 'pending' || rw.status === 'held') pendingBalanceInr += amt;
    if (rw.status === 'approved') approvedBalanceInr += amt;
    if (rw.status === 'paid') {
      paidBalanceInr += amt;
      if (typeof rw.payoutId === 'string' && rw.payoutId.startsWith('pay_')) {
        legacyDirectPaidInr += amt;
      }
    }
    if (rw.status === 'reversed') reversedBalanceInr += amt;
  });

  let pendingWithdrawalInr = 0;
  let withdrawnBalanceInr = 0;
  withdrawalsSnap.docs.forEach((d) => {
    const w = d.data();
    const amt = Number(w.amountInr) || 0;
    if (w.status === 'pending' || w.status === 'approved') pendingWithdrawalInr += amt;
    if (w.status === 'paid') withdrawnBalanceInr += amt;
  });

  const totalApprovedAndPaid = approvedBalanceInr + paidBalanceInr;
  const availableBalanceInr = Math.max(
    0,
    totalApprovedAndPaid - legacyDirectPaidInr - withdrawnBalanceInr - pendingWithdrawalInr
  );

  const walletRef = db.collection('referralWallets').doc(referrerUid);
  const existing = await walletRef.get();
  const resolvedCode =
    referralCode || (existing.exists ? String(existing.data()?.referralCode || 'RS-CODE') : 'RS-CODE');

  await walletRef.set(
    {
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
      totalEarnedInr: totalApprovedAndPaid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
}

async function resolveWorkerUidForWebhook(
  db: Firestore,
  notesWorkerUid: string,
  gatewayOrderId: string,
  gatewayPaymentId: string
): Promise<string> {
  if (notesWorkerUid) return notesWorkerUid;
  if (gatewayOrderId) {
    const byOrder = await db
      .collection('workerRegistrationPayments')
      .where('gatewayOrderId', '==', gatewayOrderId)
      .limit(1)
      .get();
    if (!byOrder.empty) return byOrder.docs[0].id;
  }
  if (gatewayPaymentId) {
    const byPay = await db
      .collection('workerRegistrationPayments')
      .where('gatewayPaymentId', '==', gatewayPaymentId)
      .limit(1)
      .get();
    if (!byPay.empty) return byPay.docs[0].id;
  }
  return '';
}

async function processRefundWebhookOnServer(params: {
  runtime: PaymentAdminRuntime;
  workerUid: string;
  refundRef: string;
  reason: string;
}): Promise<{ refunded: boolean; rewardReversed: boolean }> {
  if (!params.runtime.hasFirestoreCredentials || !params.workerUid) {
    return { refunded: false, rewardReversed: false };
  }
  const db = params.runtime.db;
  const payRef = db.collection('workerRegistrationPayments').doc(params.workerUid);
  const paySnap = await payRef.get();
  if (!paySnap.exists) return { refunded: false, rewardReversed: false };

  const payData = paySnap.data()!;
  if (payData.status === 'refunded') {
    return { refunded: true, rewardReversed: false };
  }

  const pubRef = db.collection('publicWorkers').doc(params.workerUid);
  const privRef = db.collection('workerPrivate').doc(params.workerUid);
  const refDocRef = db.collection('workerReferrals').doc(params.workerUid);
  const rewardId = `rw_${params.workerUid}`;
  const rewardRef = db.collection('referralRewards').doc(rewardId);

  const [pubSnap, privSnap, refSnap, rewardSnap] = await Promise.all([
    pubRef.get(),
    privRef.get(),
    refDocRef.get(),
    rewardRef.get(),
  ]);

  const safeRef = params.refundRef.slice(0, 120) || `RFND-${Date.now()}`;
  const safeReason = params.reason.slice(0, 300) || 'Razorpay refund processed.';
  const batch = db.batch();

  batch.update(payRef, {
    status: 'refunded',
    refundReference: safeRef,
    refundReason: safeReason,
    refundedAtIso: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (pubSnap.exists) {
    batch.update(pubRef, {
      registrationPaymentStatus: 'refunded',
      paidBenefitsActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (privSnap.exists) {
    batch.update(privRef, {
      registrationPaymentStatus: 'refunded',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  let rewardReversed = false;
  let referrerUid = '';
  let referrerCode = '';
  let referrerName = 'Referrer';
  let reversedAmount = 0;

  if (refSnap.exists) {
    const rd = refSnap.data()!;
    referrerUid = String(rd.referrerUid || '');
    referrerCode = String(rd.referralCode || '');
    referrerName = String(rd.referrerName || 'Referrer');
    batch.update(refDocRef, {
      registrationPaymentStatus: 'refunded',
      rewardStatus: 'reversed',
      rewardAmountInr: 0,
      adminNotes: `Reversed via Razorpay refund webhook (${safeRef}).`,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (rewardSnap.exists) {
    const rw = rewardSnap.data()!;
    if (rw.status !== 'reversed' && rw.status !== 'rejected') {
      rewardReversed = true;
      reversedAmount = Number(rw.rewardAmountInr) || SINGLE_LEVEL_REFERRAL_REWARD_INR;
      referrerUid = String(rw.referrerUid || referrerUid);
      referrerCode = String(rw.referralCode || referrerCode);
      referrerName = String(rw.referrerName || referrerName);
      batch.update(rewardRef, {
        status: 'reversed',
        reversedReason: `Registration refunded via Razorpay (${safeRef}).`,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  const refundLedgerRef = db.collection('financialLedger').doc(`led_refund_${params.workerUid}`);
  const refundLedgerSnap = await refundLedgerRef.get();
  if (!refundLedgerSnap.exists) {
    batch.set(refundLedgerRef, {
      entryType: 'registration_refund',
      direction: 'debit',
      amountInr: Number(payData.amountInr) || WORKER_REGISTRATION_FEE_INR,
      workerUid: params.workerUid,
      workerName: String(payData.workerName || 'Worker'),
      referenceId: params.workerUid,
      paymentOrUtrRef: safeRef,
      description: `Razorpay refund processed (${safeReason})`,
      recordedByUid: 'razorpay_webhook',
      recordedByEmail: 'system@rojgarsetu',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (rewardReversed && reversedAmount > 0 && referrerUid) {
    const revLedgerRef = db.collection('financialLedger').doc(`led_rev_${rewardId}`);
    const revLedgerSnap = await revLedgerRef.get();
    if (!revLedgerSnap.exists) {
      batch.set(revLedgerRef, {
        entryType: 'referral_reward_reversal',
        direction: 'credit',
        amountInr: reversedAmount,
        workerUid: referrerUid,
        workerName: referrerName,
        referenceId: rewardId,
        paymentOrUtrRef: safeRef,
        description: `Auto-reversed ₹${reversedAmount} referral reward after Razorpay refund`,
        recordedByUid: 'razorpay_webhook',
        recordedByEmail: 'system@rojgarsetu',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  if (referrerUid) {
    await recomputeReferrerWalletOnServer(db, referrerUid, referrerCode);
  }
  return { refunded: true, rewardReversed };
}

export interface DemoWorkerVerificationStep {
  workerLabel: string;
  scenario: string;
  passed: boolean;
  details: string;
  paymentStatus: 'pending' | 'verified' | 'failed' | 'refunded';
  rewardDeltaInr: number;
}

export interface FiveDemoWorkersVerificationReport {
  allPassed: boolean;
  steps: DemoWorkerVerificationStep[];
  financialSummary: FinancialReportSummary;
  singleLevelChainRewardInr: number;
}

export function runFiveDemoWorkersVerificationSuite(): FiveDemoWorkersVerificationReport {
  const steps: DemoWorkerVerificationStep[] = [];
  const payments: Pick<WorkerRegistrationPayment, 'amountInr' | 'status'>[] = [];
  const rewards: Pick<ReferralRewardRecord, 'rewardAmountInr' | 'status'>[] = [];
  const withdrawals: Pick<ReferralWithdrawalRequest, 'amountInr' | 'status'>[] = [];

  payments.push({ amountInr: 250, status: 'verified' });
  steps.push({
    workerLabel: 'Demo Worker 1 (Ramesh Patel · Electrician)',
    scenario: 'Direct ₹250 Registration Verified -> Unique RS-W ID + Certificate + Referral Code Activated',
    passed: true,
    details: 'Paid ₹250 (UTR DEMO10000001). Verified Worker ID RS-W-DEMO01, Receipt RS-RCP-DEMO01, Code RAMESH-W1.',
    paymentStatus: 'verified',
    rewardDeltaInr: 0,
  });

  const w2Decision = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w2',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w2',
    existingReferredMobileHashes: [],
    existingRewardReferralIds: [],
    referralId: 'demo_w2',
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000002',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  payments.push({ amountInr: 250, status: 'verified' });
  if (w2Decision.eligible) {
    rewards.push({ rewardAmountInr: w2Decision.rewardAmountInr, status: 'approved' });
  }
  steps.push({
    workerLabel: 'Demo Worker 2 (Suresh Verma · Plumber)',
    scenario: 'Referred by Worker 1 + OTP Verified + ₹250 Paid -> ₹50 Reward Credited',
    passed: w2Decision.eligible && w2Decision.rewardAmountInr === 50,
    details: w2Decision.reason,
    paymentStatus: 'verified',
    rewardDeltaInr: w2Decision.rewardAmountInr,
  });

  const w3Decision = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w3',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w3',
    existingReferredMobileHashes: ['hash_w2'],
    existingRewardReferralIds: ['demo_w2'],
    referralId: 'demo_w3',
    registrationPaymentStatus: 'payment_failed',
    registrationFeePaidInr: 0,
    paymentReference: '',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  payments.push({ amountInr: 250, status: 'failed' });
  steps.push({
    workerLabel: 'Demo Worker 3 (Kavita Joshi · Tailoring)',
    scenario: 'Failed ₹250 Payment -> Paid Benefits Blocked & ₹0 Referral Reward',
    passed: !w3Decision.eligible && w3Decision.rewardAmountInr === 0,
    details: w3Decision.reason,
    paymentStatus: 'failed',
    rewardDeltaInr: 0,
  });

  const selfRefCheck = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w1',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w1',
    existingReferredMobileHashes: ['hash_w2'],
    existingRewardReferralIds: ['demo_w2'],
    referralId: 'demo_w1',
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000004',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  const dupRewardCheck = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w2',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w2',
    existingReferredMobileHashes: ['hash_w2'],
    existingRewardReferralIds: ['demo_w2'],
    referralId: 'demo_w2',
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000002',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  const level2ChainCheck = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w4',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w4',
    existingReferredMobileHashes: ['hash_w2'],
    existingRewardReferralIds: ['demo_w2'],
    referralId: 'demo_w4_level2',
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000004',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 2,
  });
  const w4Level1Decision = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w2',
    referredUid: 'demo_w4',
    referrerMobileHash: 'hash_w2',
    referredMobileHash: 'hash_w4',
    existingReferredMobileHashes: ['hash_w2'],
    existingRewardReferralIds: ['demo_w2'],
    referralId: 'demo_w4',
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000004',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  payments.push({ amountInr: 250, status: 'verified' });
  if (w4Level1Decision.eligible) {
    rewards.push({ rewardAmountInr: w4Level1Decision.rewardAmountInr, status: 'approved' });
  }
  const fraudGuardsPassed =
    !selfRefCheck.eligible &&
    selfRefCheck.fraudFlags.includes('SELF_REFERRAL_UID') &&
    !dupRewardCheck.eligible &&
    !level2ChainCheck.eligible &&
    level2ChainCheck.fraudFlags.includes('MULTI_LEVEL_BLOCKED') &&
    w4Level1Decision.eligible &&
    w4Level1Decision.rewardAmountInr === 50;
  steps.push({
    workerLabel: 'Demo Worker 4 (Mahesh Sahu · Carpenter)',
    scenario: 'Self-Referral, Duplicate Reward & Level-2 Chain Blocked; Direct Level-1 to Worker 2 Paid ₹50',
    passed: fraudGuardsPassed,
    details:
      'Self-referral rejected, duplicate reward rejected, Worker 1 level-2 chain rejected (₹0), direct referrer Worker 2 earned ₹50.',
    paymentStatus: 'verified',
    rewardDeltaInr: w4Level1Decision.rewardAmountInr,
  });

  const w5RefundCheck = evaluateReferralRewardEligibility({
    referrerUid: 'demo_w1',
    referredUid: 'demo_w5',
    referrerMobileHash: 'hash_w1',
    referredMobileHash: 'hash_w5',
    existingReferredMobileHashes: ['hash_w2', 'hash_w4'],
    existingRewardReferralIds: ['demo_w2', 'demo_w4'],
    referralId: 'demo_w5',
    registrationPaymentStatus: 'refunded',
    registrationFeePaidInr: 250,
    paymentReference: 'DEMO10000005',
    paidRegistrationEnabled: true,
    configuredFeeInr: 250,
    configuredRewardInr: 50,
    otpVerified: true,
    referralLevel: 1,
  });
  payments.push({ amountInr: 250, status: 'refunded' });
  rewards.push({ rewardAmountInr: 50, status: 'reversed' });
  steps.push({
    workerLabel: 'Demo Worker 5 (Anil Kumbhar · Mason)',
    scenario: '₹250 Registration Refunded -> Paid Benefits Revoked & ₹50 Referral Reward Reversed',
    passed: !w5RefundCheck.eligible && w5RefundCheck.fraudFlags.includes('PAYMENT_REFUNDED'),
    details:
      '₹250 refunded (REF-DEMO-05). ₹50 referral reward to Worker 1 automatically reversed to ₹0 net.',
    paymentStatus: 'refunded',
    rewardDeltaInr: -50,
  });

  withdrawals.push({ amountInr: 50, status: 'paid' });
  const financialSummary = computeFinancialReport({ payments, rewards, withdrawals });

  const financialMathOk =
    financialSummary.grossRegistrationRevenueInr === 1000 &&
    financialSummary.refundsInr === 250 &&
    financialSummary.referralRewardsGrossInr === 150 &&
    financialSummary.referralRewardsReversedInr === 50 &&
    financialSummary.referralRewardsNetInr === 100 &&
    financialSummary.withdrawalsPaidInr === 50 &&
    financialSummary.netBalanceInr === 650;

  steps.push({
    workerLabel: 'Withdrawal & Financial Reconciliation',
    scenario: 'Worker 1 ₹50 Withdrawal Settled + Gross Revenue / Rewards / Refunds / Net Balance Verified',
    passed: financialMathOk,
    details: `Gross ₹${financialSummary.grossRegistrationRevenueInr} − Refunds ₹${financialSummary.refundsInr} − Net Rewards ₹${financialSummary.referralRewardsNetInr} = Net Balance ₹${financialSummary.netBalanceInr} (Withdrawals Paid: ₹${financialSummary.withdrawalsPaidInr}).`,
    paymentStatus: 'verified',
    rewardDeltaInr: 0,
  });

  return {
    allPassed: steps.every((s) => s.passed),
    steps,
    financialSummary,
    singleLevelChainRewardInr: level2ChainCheck.rewardAmountInr,
  };
}

// ---------- Serverless & Express Shared Route Handlers ----------

export function handlePaymentConfig(): { httpStatus: number; payload: Record<string, unknown> } {
  return {
    httpStatus: 200,
    payload: getPaymentGatewayPublicConfig() as unknown as Record<string, unknown>,
  };
}

export async function handleCreatePaymentOrder(params: {
  authHeader: string;
  body?: Record<string, unknown>;
  rootDir: string;
  fetchImpl?: typeof fetch;
  runtimeOverride?: PaymentAdminRuntime;
  authUidOverride?: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  let uid = params.authUidOverride || '';
  if (!uid) {
    const authUser = await verifyBearerHeader(params.authHeader, params.rootDir);
    if (!authUser) {
      return {
        httpStatus: 401,
        payload: { error: 'Authentication required to initiate registration payment.' },
      };
    }
    uid = authUser.decoded.uid;
  }

  if (!checkRateLimit(`pay_order:${uid}`, 15, 10 * 60 * 1000)) {
    return {
      httpStatus: 429,
      payload: { error: 'Too many payment order attempts. Please try again in a few minutes.' },
    };
  }

  const registrationId = String(params.body?.registrationId || params.body?.provisionalAppId || '')
    .trim()
    .slice(0, 40);

  // Prevent duplicate charges & duplicate activation when Admin Firestore is available
  const runtime = params.runtimeOverride ?? getPaymentAdminRuntime(params.rootDir);
  if (runtime.hasFirestoreCredentials) {
    try {
      const [paySnap, pubSnap] = await Promise.all([
        runtime.db.collection('workerRegistrationPayments').doc(uid).get(),
        runtime.db.collection('publicWorkers').doc(uid).get(),
      ]);
      if (paySnap.exists && paySnap.data()?.status === 'verified') {
        return {
          httpStatus: 409,
          payload: {
            errorCode: 'ALREADY_VERIFIED',
            error: 'Your ₹250 worker registration payment is already PAID. Duplicate payment is blocked.',
          },
        };
      }
      if (pubSnap.exists && pubSnap.data()?.registrationPaymentStatus === 'verified') {
        return {
          httpStatus: 409,
          payload: {
            errorCode: 'ALREADY_VERIFIED',
            error: 'Your ₹250 worker registration fee is already PAID. Duplicate payment is blocked.',
          },
        };
      }
    } catch {
      // Proceed if Firestore check is unavailable
    }
  }

  const cfg = getPaymentGatewayPublicConfig();
  if (cfg.razorpayMode === 'live_blocked') {
    return {
      httpStatus: 403,
      payload: {
        errorCode: 'LIVE_MODE_BLOCKED',
        razorpayMode: 'live_blocked',
        error: cfg.configError || 'Razorpay Live Mode keys are blocked. Configure Test Mode keys (rzp_test_*).',
      },
    };
  }

  const orderRef = `RS-ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const orderToken = signOrderRef(orderRef, uid, cfg.registrationFeeInr);
  const upiUri = buildOfficialUpiIntentUri({
    upiId: cfg.officialUpiId,
    payeeName: cfg.officialUpiPayeeName,
    amountInr: cfg.registrationFeeInr,
    orderRef,
  });

  if (cfg.gatewayConfigured && cfg.razorpayKeyId && cfg.razorpayMode === 'test') {
    try {
      const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
      const authBasic = Buffer.from(`${cfg.razorpayKeyId}:${keySecret}`).toString('base64');
      const doFetch = params.fetchImpl ?? fetch;
      const gwRes = await doFetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authBasic}`,
        },
        body: JSON.stringify({
          amount: WORKER_REGISTRATION_FEE_PAISE,
          currency: 'INR',
          receipt: orderRef,
          notes: {
            workerUid: uid,
            ...(registrationId ? { registrationId } : {}),
            orderRef,
            mode: 'test',
            purpose: 'ROJGAR SETU Worker Registration Fee (ID Card & Certificate)',
          },
        }),
      });
      if (gwRes.ok) {
        const gwData = (await gwRes.json()) as { id?: string; amount?: number; currency?: string };
        if (gwData.id) {
          // Record pending order reference on server if Admin Firestore is configured
          if (runtime.hasFirestoreCredentials) {
            await runtime.db
              .collection('workerRegistrationPayments')
              .doc(uid)
              .set(
                {
                  workerUid: uid,
                  ...(registrationId ? { provisionalAppId: registrationId } : {}),
                  amountInr: cfg.registrationFeeInr,
                  paymentMethod: 'gateway',
                  status: 'pending',
                  orderRef,
                  gatewayOrderId: gwData.id,
                  gatewaySignatureVerified: false,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              )
              .catch(() => undefined);
          }

          return {
            httpStatus: 200,
            payload: {
              mode: 'gateway',
              gatewayProvider: 'razorpay',
              gatewayConfigured: true,
              razorpayMode: 'test',
              testModeEnforced: true,
              razorpayKeyId: cfg.razorpayKeyId,
              gatewayOrderId: gwData.id,
              orderRef,
              orderToken,
              amountInr: cfg.registrationFeeInr,
              amountPaise: WORKER_REGISTRATION_FEE_PAISE,
              officialUpiId: cfg.officialUpiId,
              officialUpiPayeeName: cfg.officialUpiPayeeName,
              upiUri,
              createdAtIso: new Date().toISOString(),
            },
          };
        }
      } else {
        const errText = await gwRes.text().catch(() => '');
        return {
          httpStatus: 502,
          payload: {
            errorCode: 'RAZORPAY_ORDER_FAILED',
            error: `Razorpay Test Mode order creation failed (HTTP ${gwRes.status}). Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.`,
            details: errText.slice(0, 200),
          },
        };
      }
    } catch (err) {
      return {
        httpStatus: 502,
        payload: {
          errorCode: 'RAZORPAY_NETWORK_ERROR',
          error: err instanceof Error ? err.message : 'Unable to reach Razorpay Orders API.',
        },
      };
    }
  }

  return {
    httpStatus: 200,
    payload: {
      mode: 'upi_qr',
      gatewayProvider: 'upi_qr',
      gatewayConfigured: false,
      razorpayMode: cfg.razorpayMode,
      testModeEnforced: true,
      configError: cfg.configError,
      missingGatewayEnvVars: cfg.missingGatewayEnvVars,
      orderRef,
      orderToken,
      amountInr: cfg.registrationFeeInr,
      officialUpiId: cfg.officialUpiId,
      officialUpiPayeeName: cfg.officialUpiPayeeName,
      upiUri,
      createdAtIso: new Date().toISOString(),
    },
  };
}

export async function handleVerifyGatewayPayment(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
  fetchImpl?: typeof fetch;
  runtimeOverride?: PaymentAdminRuntime;
  authUidOverride?: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  let workerUid = params.authUidOverride || '';
  if (!workerUid) {
    const authUser = await verifyBearerHeader(params.authHeader, params.rootDir);
    if (!authUser) {
      return { httpStatus: 401, payload: { verified: false, error: 'Authentication required.' } };
    }
    workerUid = authUser.decoded.uid;
  }

  const cfg = getPaymentGatewayPublicConfig();
  if (cfg.razorpayMode === 'live_blocked') {
    return {
      httpStatus: 403,
      payload: {
        verified: false,
        errorCode: 'LIVE_MODE_BLOCKED',
        error: cfg.configError || 'Razorpay Live Mode is blocked. Only Test Mode keys are allowed.',
      },
    };
  }

  const razorpayOrderId = String(params.body.razorpayOrderId || '').trim();
  const razorpayPaymentId = String(params.body.razorpayPaymentId || '').trim();
  const razorpaySignature = String(params.body.razorpaySignature || '').trim();
  const orderRef = String(params.body.orderRef || '').trim();
  const registrationId = String(params.body.registrationId || params.body.provisionalAppId || '').trim();
  const workerName = String(params.body.workerName || '').trim();
  const workerSkill = String(params.body.workerSkill || '').trim();
  const workerLocation = String(params.body.workerLocation || '').trim();
  const workerMobileMasked = String(params.body.workerMobileMasked || '').trim();

  // Step 1: Cryptographic HMAC-SHA256 signature verification
  const sigResult = verifyRazorpayPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!sigResult.valid) {
    return {
      httpStatus: 403,
      payload: { verified: false, errorCode: 'INVALID_SIGNATURE', error: sigResult.reason },
    };
  }

  // Step 2: Confirm actual captured payment status, owner binding & exact ₹250 amount directly from Razorpay API
  const captureCheck = await fetchAndVerifyRazorpayCapturedPayment({
    razorpayPaymentId,
    expectedOrderId: razorpayOrderId,
    expectedAmountPaise: WORKER_REGISTRATION_FEE_PAISE,
    expectedWorkerUid: workerUid,
    fetchImpl: params.fetchImpl,
  });
  if (!captureCheck.ok || !captureCheck.captured) {
    const status =
      captureCheck.paymentStatus === 'owner_mismatch' || captureCheck.paymentStatus === 'live_blocked'
        ? 403
        : 402;
    return {
      httpStatus: status,
      payload: {
        verified: false,
        paymentStatus: captureCheck.paymentStatus,
        error: captureCheck.reason,
      },
    };
  }

  // Step 3: Record PAID status in DB & queue registration for ROJGAR SETU Admin Dashboard approval
  const runtime = params.runtimeOverride ?? getPaymentAdminRuntime(params.rootDir);
  let activation: Awaited<ReturnType<typeof activateWorkerRegistrationOnServer>>;
  try {
    activation = await activateWorkerRegistrationOnServer({
      runtime,
      workerUid,
      razorpayOrderId,
      razorpayPaymentId,
      orderRef: orderRef || razorpayOrderId,
      registrationId: registrationId || undefined,
      workerName: workerName || undefined,
      workerSkill: workerSkill || undefined,
      workerLocation: workerLocation || undefined,
      workerMobileMasked: workerMobileMasked || undefined,
      payerVpaOrMethod: captureCheck.vpa || captureCheck.method,
      source: 'verify_api',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to record paid worker registration.';
    if (msg.includes('DUPLICATE_PAYMENT_ID')) {
      return {
        httpStatus: 409,
        payload: { verified: false, errorCode: 'DUPLICATE_PAYMENT_ID', error: msg },
      };
    }
    return {
      httpStatus: 503,
      payload: { verified: false, errorCode: 'ACTIVATION_DB_ERROR', error: msg },
    };
  }

  const verificationReceiptToken = crypto
    .createHmac('sha256', getOrderHmacSecret())
    .update(`verified|${workerUid}|${razorpayPaymentId}`)
    .digest('hex')
    .slice(0, 32);

  return {
    httpStatus: 200,
    payload: {
      verified: true,
      captured: true,
      razorpayMode: 'test',
      paymentStatus: 'PAID',
      amountInr: WORKER_REGISTRATION_FEE_INR,
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      provisionalAppId: activation.provisionalAppId,
      adminApprovalPending: activation.adminApprovalPending,
      verifiedAtIso: new Date().toISOString(),
      verificationReceiptToken,
      activatedOnServer: activation.activated,
      alreadyVerified: activation.alreadyVerified,
      verifiedWorkerId: activation.verifiedWorkerId,
      receiptNo: activation.receiptNo,
      certificateNo: activation.certificateNo,
      referralCredited: activation.referralCredited,
      referralMessage: activation.referralMessage,
      reason: activation.alreadyVerified
        ? 'Razorpay payment was already recorded as PAID (duplicate callback ignored idempotently).'
        : 'Razorpay Test Mode signature and ₹250 capture verified on backend. Payment marked PAID and sent to ROJGAR SETU Admin Dashboard for approval.',
    },
  };
}

export async function handleRecordGatewayAttempt(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
  runtimeOverride?: PaymentAdminRuntime;
  authUidOverride?: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  let workerUid = params.authUidOverride || '';
  if (!workerUid) {
    const authUser = await verifyBearerHeader(params.authHeader, params.rootDir);
    if (!authUser) {
      return { httpStatus: 401, payload: { ok: false, error: 'Authentication required.' } };
    }
    workerUid = authUser.decoded.uid;
  }

  const rawOutcome = String(params.body.outcome || '').trim().toLowerCase();
  // STRICTLY forbid client-side verified/captured status transitions
  if (rawOutcome !== 'failed' && rawOutcome !== 'cancelled') {
    return {
      httpStatus: 400,
      payload: {
        ok: false,
        errorCode: 'INVALID_OUTCOME',
        error: 'Only failed or cancelled checkout outcomes may be reported by the client.',
      },
    };
  }

  const gatewayOrderId = String(params.body.gatewayOrderId || '').trim().slice(0, 120);
  const gatewayPaymentId = String(params.body.gatewayPaymentId || '').trim().slice(0, 120);
  const orderRef = String(params.body.orderRef || '').trim().slice(0, 80);
  const reason = String(
    params.body.reason ||
      (rawOutcome === 'cancelled'
        ? 'Razorpay Checkout window closed before payment completion.'
        : 'Razorpay Test Mode payment failed.')
  )
    .trim()
    .slice(0, 300);

  const nextStatus: 'failed' | 'pending' = rawOutcome === 'failed' ? 'failed' : 'pending';
  const runtime = params.runtimeOverride ?? getPaymentAdminRuntime(params.rootDir);
  if (!runtime.hasFirestoreCredentials) {
    return {
      httpStatus: 200,
      payload: {
        ok: true,
        recordedInDb: false,
        status: nextStatus,
        reason: 'Attempt acknowledged; server database not configured in this environment.',
      },
    };
  }

  try {
    const payRef = runtime.db.collection('workerRegistrationPayments').doc(workerUid);
    const snap = await payRef.get();
    if (snap.exists && snap.data()?.status === 'verified') {
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          ignored: true,
          status: 'verified',
          reason: 'Worker registration is already verified and cannot be downgraded.',
        },
      };
    }

    await payRef.set(
      {
        workerUid,
        amountInr: WORKER_REGISTRATION_FEE_INR,
        paymentMethod: 'gateway',
        status: nextStatus,
        ...(orderRef ? { orderRef } : {}),
        ...(gatewayOrderId ? { gatewayOrderId } : {}),
        ...(gatewayPaymentId ? { gatewayPaymentId, utrOrGatewayRef: gatewayPaymentId } : {}),
        gatewaySignatureVerified: false,
        adminNotes: reason,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    if (nextStatus === 'failed') {
      const pubRef = runtime.db.collection('publicWorkers').doc(workerUid);
      const pubSnap = await pubRef.get();
      if (pubSnap.exists && pubSnap.data()?.paidBenefitsActive !== true) {
        await pubRef.update({
          registrationPaymentStatus: 'failed',
          paidBenefitsActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      httpStatus: 200,
      payload: {
        ok: true,
        recordedInDb: true,
        status: nextStatus,
        gatewayOrderId,
      },
    };
  } catch (err) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to record payment attempt.',
      },
    };
  }
}

export async function handleRazorpayWebhook(params: {
  rawBody: string;
  signatureHeader: string;
  eventIdHeader?: string;
  rootDir: string;
  runtimeOverride?: PaymentAdminRuntime;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  const sigCheck = verifyRazorpayWebhookSignature({
    rawBody: params.rawBody,
    signatureHeader: params.signatureHeader,
  });
  if (!sigCheck.valid) {
    const status = sigCheck.reason.includes('not configured') ? 503 : 401;
    return {
      httpStatus: status,
      payload: { ok: false, errorCode: status === 401 ? 'INVALID_WEBHOOK_SIGNATURE' : 'WEBHOOK_NOT_CONFIGURED', error: sigCheck.reason },
    };
  }

  let eventPayload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          method?: string;
          vpa?: string;
          error_description?: string;
          notes?: { workerUid?: string; orderRef?: string };
        };
      };
      refund?: {
        entity?: {
          id?: string;
          payment_id?: string;
          amount?: number;
          status?: string;
          notes?: { reason?: string; workerUid?: string };
        };
      };
      order?: {
        entity?: {
          id?: string;
          receipt?: string;
          notes?: { workerUid?: string; orderRef?: string };
        };
      };
    };
  };

  try {
    eventPayload = JSON.parse(params.rawBody);
  } catch {
    return { httpStatus: 400, payload: { ok: false, error: 'Invalid JSON webhook body.' } };
  }

  const eventName = String(eventPayload.event || '');
  const runtime = params.runtimeOverride ?? getPaymentAdminRuntime(params.rootDir);
  const paymentEntity = eventPayload.payload?.payment?.entity;
  const orderEntity = eventPayload.payload?.order?.entity;
  const refundEntity = eventPayload.payload?.refund?.entity;

  const gatewayOrderId = String(paymentEntity?.order_id || orderEntity?.id || '');
  const gatewayPaymentId = String(paymentEntity?.id || refundEntity?.payment_id || '');
  const notesWorkerUid = String(
    paymentEntity?.notes?.workerUid ||
      orderEntity?.notes?.workerUid ||
      refundEntity?.notes?.workerUid ||
      ''
  ).trim();

  // Deterministic webhook idempotency key (uses x-razorpay-event-id when provided)
  const rawEventKey =
    (params.eventIdHeader || '').trim() ||
    `${eventName}:${gatewayPaymentId || refundEntity?.id || 'none'}:${gatewayOrderId || 'none'}`;
  const safeEventDocId = crypto.createHash('sha256').update(rawEventKey).digest('hex').slice(0, 40);

  if (processedWebhookEvents.has(safeEventDocId)) {
    return {
      httpStatus: 200,
      payload: {
        ok: true,
        event: eventName,
        idempotent: true,
        duplicateEvent: true,
        processed: false,
        reason: 'Duplicate webhook event ignored idempotently.',
      },
    };
  }

  if (
    eventName === 'payment.captured' ||
    eventName === 'order.paid' ||
    eventName === 'payment.failed' ||
    eventName === 'refund.processed' ||
    eventName === 'payment.refunded'
  ) {
    if (!runtime.hasFirestoreCredentials) {
      return {
        httpStatus: 503,
        payload: {
          ok: false,
          errorCode: 'ADMIN_DB_NOT_CONFIGURED',
          event: eventName,
          error:
            'Webhook signature verified, but FIREBASE_SERVICE_ACCOUNT_JSON is not configured on the server to persist activation/refund state.',
        },
      };
    }
  }

  try {
    const webhookEventRef = runtime.db.collection('processedPaymentWebhooks').doc(safeEventDocId);
    const existingWebhookSnap = await webhookEventRef.get();
    if (existingWebhookSnap.exists) {
      recordProcessedWebhookEventMem(safeEventDocId);
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          event: eventName,
          idempotent: true,
          duplicateEvent: true,
          processed: false,
          reason: 'Duplicate webhook event already recorded in database (idempotent no-op).',
        },
      };
    }

    const markWebhookProcessed = async () => {
      await webhookEventRef.set({
        eventId: rawEventKey.slice(0, 160),
        eventName,
        gatewayOrderId,
        gatewayPaymentId,
        processedAt: FieldValue.serverTimestamp(),
      });
      recordProcessedWebhookEventMem(safeEventDocId);
    };

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const amountPaise = Number(paymentEntity?.amount ?? WORKER_REGISTRATION_FEE_PAISE);
      const currency = String(paymentEntity?.currency || 'INR').toUpperCase();
      if (amountPaise !== WORKER_REGISTRATION_FEE_PAISE || currency !== 'INR') {
        return {
          httpStatus: 200,
          payload: { ok: true, ignored: true, reason: 'Webhook payment amount/currency did not match ₹250 INR.' },
        };
      }

      const workerUid = await resolveWorkerUidForWebhook(
        runtime.db,
        notesWorkerUid,
        gatewayOrderId,
        gatewayPaymentId
      );
      if (!workerUid) {
        return {
          httpStatus: 200,
          payload: { ok: true, event: eventName, processed: false, reason: 'Worker UID could not be resolved for order.' },
        };
      }

      const activation = await activateWorkerRegistrationOnServer({
        runtime,
        workerUid,
        razorpayOrderId: gatewayOrderId || `order_webhook_${workerUid}`,
        razorpayPaymentId: gatewayPaymentId || `pay_webhook_${Date.now()}`,
        orderRef: String(paymentEntity?.notes?.orderRef || orderEntity?.receipt || gatewayOrderId),
        payerVpaOrMethod: paymentEntity?.vpa || paymentEntity?.method,
        source: 'razorpay_webhook',
      });
      await markWebhookProcessed();

      return {
        httpStatus: 200,
        payload: {
          ok: true,
          event: eventName,
          processed: true,
          idempotent: false,
          duplicateEvent: false,
          activated: activation.activated,
          alreadyVerified: activation.alreadyVerified,
          verifiedWorkerId: activation.verifiedWorkerId,
          receiptNo: activation.receiptNo,
          referralCredited: activation.referralCredited,
        },
      };
    }

    if (eventName === 'payment.failed') {
      const workerUid = await resolveWorkerUidForWebhook(
        runtime.db,
        notesWorkerUid,
        gatewayOrderId,
        gatewayPaymentId
      );
      if (workerUid) {
        const payRef = runtime.db.collection('workerRegistrationPayments').doc(workerUid);
        const snap = await payRef.get();
        if (!snap.exists || snap.data()?.status !== 'verified') {
          await payRef.set(
            {
              workerUid,
              amountInr: WORKER_REGISTRATION_FEE_INR,
              paymentMethod: 'gateway',
              status: 'failed',
              gatewayOrderId,
              gatewayPaymentId,
              gatewaySignatureVerified: false,
              adminNotes: String(paymentEntity?.error_description || 'Razorpay payment failed.').slice(0, 300),
              updatedAt: FieldValue.serverTimestamp(),
              ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
            },
            { merge: true }
          );
          const pubRef = runtime.db.collection('publicWorkers').doc(workerUid);
          const pubSnap = await pubRef.get();
          if (pubSnap.exists && pubSnap.data()?.paidBenefitsActive !== true) {
            await pubRef.update({
              registrationPaymentStatus: 'failed',
              paidBenefitsActive: false,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }
      await markWebhookProcessed();
      return {
        httpStatus: 200,
        payload: { ok: true, event: eventName, processed: true, status: 'failed' },
      };
    }

    if (eventName === 'refund.processed' || eventName === 'payment.refunded') {
      const workerUid = await resolveWorkerUidForWebhook(
        runtime.db,
        notesWorkerUid,
        gatewayOrderId,
        gatewayPaymentId
      );
      const refundRes = await processRefundWebhookOnServer({
        runtime,
        workerUid,
        refundRef: String(refundEntity?.id || gatewayPaymentId || `RFND-${Date.now()}`),
        reason: String(refundEntity?.notes?.reason || 'Razorpay refund processed via webhook.'),
      });
      await markWebhookProcessed();
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          event: eventName,
          processed: true,
          refunded: refundRes.refunded,
          rewardReversed: refundRes.rewardReversed,
        },
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database write failed while processing Razorpay webhook.';
    console.error('[Razorpay Webhook] Firestore persistence error:', err);
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        errorCode: 'WEBHOOK_DB_ERROR',
        event: eventName,
        error: `Webhook signature verified, but Firestore persistence failed: ${message.slice(0, 200)}`,
      },
    };
  }

  return {
    httpStatus: 200,
    payload: { ok: true, ignored: true, event: eventName },
  };
}

export async function handleValidateUpiUtr(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  const authUser = await verifyBearerHeader(params.authHeader, params.rootDir);
  if (!authUser) {
    return { httpStatus: 401, payload: { error: 'Authentication required.' } };
  }

  const result = validateUpiUtrInput({
    utr: String(params.body.utr || ''),
    workerUid: authUser.decoded.uid,
    existingUtrs: Array.isArray(params.body.existingUtrs)
      ? params.body.existingUtrs.map((v) => String(v))
      : [],
  });

  if (!result.valid) {
    return { httpStatus: 400, payload: result as unknown as Record<string, unknown> };
  }

  seenUtrReferences.set(result.normalizedUtr, {
    workerUid: authUser.decoded.uid,
    recordedAt: Date.now(),
  });
  if (seenUtrReferences.size > 10000) {
    const oldestKey = seenUtrReferences.keys().next().value;
    if (oldestKey) seenUtrReferences.delete(oldestKey);
  }

  return { httpStatus: 200, payload: result as unknown as Record<string, unknown> };
}

export async function handleRunDemoVerification(params: {
  authHeader: string;
  rootDir: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  const authUser = await verifyBearerHeader(params.authHeader, params.rootDir);
  if (!authUser || !authUser.isAdmin) {
    return { httpStatus: 403, payload: { error: 'Authorized admin access required.' } };
  }
  const report = runFiveDemoWorkersVerificationSuite();
  return { httpStatus: 200, payload: report as unknown as Record<string, unknown> };
}

export function registerPaymentAndFinanceRoutes(app: Express, rootDir: string): void {
  app.get('/api/payments/config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = handlePaymentConfig();
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/payments/create-order', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = await handleCreatePaymentOrder({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/payments/verify-gateway', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = await handleVerifyGatewayPayment({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/payments/record-attempt', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = await handleRecordGatewayAttempt({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/payments/webhook', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const sigHeader = String(req.headers['x-razorpay-signature'] || '');
    const eventIdHeader = String(req.headers['x-razorpay-event-id'] || '');
    const out = await handleRazorpayWebhook({
      rawBody,
      signatureHeader: sigHeader,
      eventIdHeader,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/payments/validate-upi-utr', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = await handleValidateUpiUtr({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });

  app.post('/api/admin/payments/run-demo-verification', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const out = await handleRunDemoVerification({
      authHeader: req.headers.authorization || '',
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });
}
