import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isServerWorkerOtpRequired } from './otpEngine.js';

const BOOTSTRAPPED_ADMIN_EMAIL = 'mayurraikwar97@gmail.com';
const DEFAULT_PROJECT_ID = 'gen-lang-client-0174765083';

const adEventRateBuckets = new Map<string, number[]>();
const adImpressionDedupe = new Map<string, number>();

const BOT_UA_PATTERN = /(bot|crawler|spider|slurp|headless|phantom|selenium|puppeteer|playwright|curl|wget|python-requests|httpclient)/i;

const FORBIDDEN_PII_KEYS = new Set([
  'email',
  'mobile',
  'phone',
  'phoneNumber',
  'uid',
  'userId',
  'customerUid',
  'customerName',
  'name',
  'fullName',
  'address',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'ip',
]);

function getAuthApp(rootDir: string): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];
  let projectId = DEFAULT_PROJECT_ID;
  try {
    const raw = fs.readFileSync(path.resolve(rootDir, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId) projectId = parsed.projectId;
  } catch {
    // Use default project ID
  }
  return initializeApp({ projectId });
}

async function verifyBearerUser(
  req: Request,
  rootDir: string
): Promise<{ decoded: DecodedIdToken; isAdmin: boolean } | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const app = getAuthApp(rootDir);
    const decoded = await getAuth(app).verifyIdToken(match[1]);
    const isAdmin =
      decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
    return { decoded, isAdmin };
  } catch {
    return null;
  }
}

function checkRateLimit(bucketKey: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = (adEventRateBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    adEventRateBuckets.set(bucketKey, prev);
    return false;
  }
  prev.push(now);
  adEventRateBuckets.set(bucketKey, prev);
  return true;
}

export interface AdEventValidationInput {
  eventType?: unknown;
  adId?: unknown;
  advertiserUid?: unknown;
  category?: unknown;
  state?: unknown;
  district?: unknown;
  placement?: unknown;
  actionType?: unknown;
  sessionHash?: unknown;
  [key: string]: unknown;
}

export interface AdEventValidationResult {
  allowed: boolean;
  deduped?: boolean;
  reason?: string;
}

export function validateAdTrackingPayload(
  body: AdEventValidationInput,
  userAgent: string
): AdEventValidationResult {
  if (!body || typeof body !== 'object') {
    return { allowed: false, reason: 'Invalid payload.' };
  }
  if (BOT_UA_PATTERN.test(userAgent || '')) {
    return { allowed: false, reason: 'Automated bot traffic is excluded from ad analytics.' };
  }

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PII_KEYS.has(key)) {
      return { allowed: false, reason: `PII field "${key}" is strictly forbidden in ad analytics.` };
    }
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  if (eventType !== 'impression' && eventType !== 'click') {
    return { allowed: false, reason: 'Unsupported eventType.' };
  }

  const adId = typeof body.adId === 'string' ? body.adId.trim() : '';
  const advertiserUid = typeof body.advertiserUid === 'string' ? body.advertiserUid.trim() : '';
  const sessionHash = typeof body.sessionHash === 'string' ? body.sessionHash.trim() : '';
  const placement = typeof body.placement === 'string' ? body.placement.trim() : '';

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(adId)) {
    return { allowed: false, reason: 'Invalid adId.' };
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(advertiserUid)) {
    return { allowed: false, reason: 'Invalid advertiserUid.' };
  }
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(sessionHash)) {
    return { allowed: false, reason: 'Invalid anonymous sessionHash.' };
  }
  if (!['homepage', 'category_selection', 'service_form', 'service_info'].includes(placement)) {
    return { allowed: false, reason: 'Invalid ad placement.' };
  }

  if (eventType === 'click') {
    const actionType = typeof body.actionType === 'string' ? body.actionType : '';
    if (!['call', 'whatsapp', 'website'].includes(actionType)) {
      return { allowed: false, reason: 'Invalid click actionType.' };
    }
  }

  // Dedupe impressions per (sessionHash + adId + placement) for 15 minutes
  const now = Date.now();
  if (eventType === 'impression') {
    const dedupeKey = `${sessionHash}:${adId}:${placement}`;
    const lastTs = adImpressionDedupe.get(dedupeKey) || 0;
    if (now - lastTs < 15 * 60 * 1000) {
      return { allowed: false, deduped: true, reason: 'Duplicate session impression ignored.' };
    }
    adImpressionDedupe.set(dedupeKey, now);
    // Keep map bounded
    if (adImpressionDedupe.size > 5000) {
      const oldestKey = adImpressionDedupe.keys().next().value;
      if (oldestKey) adImpressionDedupe.delete(oldestKey);
    }
  }

  // Rate limit per anonymous session
  const rateLimit = eventType === 'click' ? 12 : 40;
  if (!checkRateLimit(`${eventType}:${sessionHash}`, rateLimit, 5 * 60 * 1000)) {
    return { allowed: false, reason: 'Rate limit exceeded for ad events.' };
  }

  return { allowed: true };
}

export interface ReferralEligibilityInput {
  referrerUid: string;
  referredUid: string;
  referrerMobileHash?: string;
  referredMobileHash: string;
  existingReferredMobileHashes?: string[];
  existingRewardReferralIds?: string[];
  referralId: string;
  registrationPaymentStatus:
    | 'free_launch'
    | 'payment_pending'
    | 'paid_verified'
    | 'payment_failed'
    | 'refunded'
    | 'cancelled';
  registrationFeePaidInr: number;
  paymentReference?: string;
  paidRegistrationEnabled: boolean;
  configuredFeeInr: number;
  configuredRewardInr: number;
  otpVerified?: boolean;
  referralLevel?: number;
  testSimulation?: boolean;
}

export interface ReferralEligibilityDecision {
  eligible: boolean;
  rewardAmountInr: number;
  rewardStatus: 'free_not_eligible' | 'pending_verification' | 'rejected';
  fraudFlags: string[];
  reason: string;
  serverVerifiedAt: string;
  auditHash: string;
}

/**
 * Authoritative server-side referral fraud prevention & reward calculator.
 * Enforces single-level referral only, OTP verification, anti-self-referral,
 * duplicate account/reward protection, and verified ₹250 payment checks.
 */
export function evaluateReferralRewardEligibility(
  input: ReferralEligibilityInput
): ReferralEligibilityDecision {
  const fraudFlags: string[] = [];
  const configuredFee = Math.max(0, Number(input.configuredFeeInr) || 250);
  const configuredReward = Math.max(0, Math.min(10000, Number(input.configuredRewardInr) || 50));
  const serverVerifiedAt = new Date().toISOString();

  const buildResult = (
    eligible: boolean,
    rewardAmountInr: number,
    rewardStatus: ReferralEligibilityDecision['rewardStatus'],
    reason: string
  ): ReferralEligibilityDecision => {
    const auditHash = crypto
      .createHash('sha256')
      .update(
        `${input.referralId}|${input.referrerUid}|${input.referredUid}|${rewardAmountInr}|${rewardStatus}|${serverVerifiedAt}`
      )
      .digest('hex')
      .slice(0, 24);
    return {
      eligible,
      rewardAmountInr,
      rewardStatus,
      fraudFlags,
      reason,
      serverVerifiedAt,
      auditHash,
    };
  };

  // 0. Strict Single-Level Enforcement (NO multi-level / MLM / tier-2 rewards)
  const level = input.referralLevel === undefined ? 1 : Number(input.referralLevel);
  if (!Number.isFinite(level) || level !== 1) {
    fraudFlags.push('MULTI_LEVEL_BLOCKED');
    return buildResult(
      false,
      0,
      'rejected',
      'Only single-level direct referrals are eligible for the ₹50 reward. Multi-level/chain rewards are strictly blocked.'
    );
  }

  // 1. Self-referral block (UID or same mobile hash)
  if (!input.referrerUid || !input.referredUid || input.referrerUid === input.referredUid) {
    fraudFlags.push('SELF_REFERRAL_UID');
    return buildResult(false, 0, 'rejected', 'Self-referral is strictly blocked (same account UID).');
  }
  if (
    input.referrerMobileHash &&
    input.referredMobileHash &&
    input.referrerMobileHash === input.referredMobileHash
  ) {
    fraudFlags.push('SELF_REFERRAL_MOBILE');
    return buildResult(
      false,
      0,
      'rejected',
      'Self-referral is strictly blocked (referrer and referred worker share the same mobile number).'
    );
  }

  // 1b. Mobile OTP Verification Check (enforced only when WORKER_OTP_REQUIRED=true)
  if (isServerWorkerOtpRequired() && input.otpVerified === false) {
    fraudFlags.push('OTP_NOT_VERIFIED');
    return buildResult(
      false,
      0,
      'rejected',
      'Referred worker mobile OTP verification is required before crediting any referral reward.'
    );
  }

  // 2. Duplicate mobile/account check
  const existingHashes = Array.isArray(input.existingReferredMobileHashes)
    ? input.existingReferredMobileHashes
    : [];
  if (input.referredMobileHash && existingHashes.includes(input.referredMobileHash)) {
    fraudFlags.push('DUPLICATE_MOBILE_ACCOUNT');
    return buildResult(
      false,
      0,
      'rejected',
      'Duplicate mobile number detected across existing referred registrations. Reward rejected.'
    );
  }

  // 3. Duplicate reward issuance check
  const existingRewards = Array.isArray(input.existingRewardReferralIds)
    ? input.existingRewardReferralIds
    : [];
  if (existingRewards.includes(input.referralId)) {
    fraudFlags.push('DUPLICATE_REWARD_PAYOUT');
    return buildResult(
      false,
      0,
      'rejected',
      'A referral reward has already been recorded for this referred worker. Duplicate reward blocked.'
    );
  }

  // 4. Paid Registration mode check (unless admin runs explicit isolated testSimulation)
  if (!input.paidRegistrationEnabled && !input.testSimulation) {
    return buildResult(
      false,
      0,
      'free_not_eligible',
      'Paid registration is currently paused. Referral attribution is recorded, and ₹50 rewards apply only for verified ₹250 registrations.'
    );
  }

  // 5. Payment verification check (rejects unpaid, failed, pending, refunded, cancelled registrations)
  const safePaymentStatus =
    typeof input.registrationPaymentStatus === 'string' && input.registrationPaymentStatus.trim()
      ? input.registrationPaymentStatus.trim()
      : 'unknown';
  if (safePaymentStatus !== 'paid_verified') {
    fraudFlags.push(`PAYMENT_${safePaymentStatus.toUpperCase()}`);
    return buildResult(
      false,
      0,
      'rejected',
      `Registration payment status is "${safePaymentStatus}". Reward requires verified ₹${configuredFee} payment.`
    );
  }

  const paidAmount = Number(input.registrationFeePaidInr) || 0;
  if (paidAmount < configuredFee) {
    fraudFlags.push('INSUFFICIENT_FEE_AMOUNT');
    return buildResult(
      false,
      0,
      'rejected',
      `Paid amount ₹${paidAmount} is less than required ₹${configuredFee} registration fee.`
    );
  }

  if (!input.paymentReference || input.paymentReference.trim().length < 4) {
    fraudFlags.push('MISSING_PAYMENT_REFERENCE');
    return buildResult(
      false,
      0,
      'rejected',
      'Verified payment gateway reference / UTR transaction ID is required before crediting reward.'
    );
  }

  // 6. All fraud, OTP, single-level, and payment checks passed — issue server-calculated ₹50 reward
  return buildResult(
    true,
    configuredReward,
    'pending_verification',
    `Verified ₹${paidAmount} registration payment (${input.paymentReference.trim()}). Single-level direct referral verified: ₹${configuredReward} reward eligible (subject to admin approval).`
  );
}

export async function handleEvaluateReferralEligibility(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  const match = (params.authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { httpStatus: 401, payload: { error: 'Authentication required. Please sign in.' } };
  }
  let isAdmin = false;
  try {
    const app = getAuthApp(params.rootDir);
    const decoded = await getAuth(app).verifyIdToken(match[1]);
    isAdmin = decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
  } catch {
    return { httpStatus: 401, payload: { error: 'Authentication required. Please sign in.' } };
  }

  const body = (params.body || {}) as Partial<ReferralEligibilityInput>;

  const wantsPaidOrSim =
    body.testSimulation === true ||
    body.registrationPaymentStatus === 'paid_verified' ||
    body.paidRegistrationEnabled === true;

  if (wantsPaidOrSim && !isAdmin) {
    return {
      httpStatus: 403,
      payload: {
        error: 'Only platform administrators can verify paid registrations or evaluate paid referral rewards.',
      },
    };
  }

  const decision = evaluateReferralRewardEligibility({
    referrerUid: String(body.referrerUid || '').trim(),
    referredUid: String(body.referredUid || '').trim(),
    referrerMobileHash: body.referrerMobileHash ? String(body.referrerMobileHash).trim() : undefined,
    referredMobileHash: String(body.referredMobileHash || '').trim(),
    existingReferredMobileHashes: Array.isArray(body.existingReferredMobileHashes)
      ? body.existingReferredMobileHashes.map((v) => String(v))
      : [],
    existingRewardReferralIds: Array.isArray(body.existingRewardReferralIds)
      ? body.existingRewardReferralIds.map((v) => String(v))
      : [],
    referralId: String(body.referralId || '').trim(),
    registrationPaymentStatus: (body.registrationPaymentStatus || 'payment_pending') as ReferralEligibilityInput['registrationPaymentStatus'],
    registrationFeePaidInr: Number(body.registrationFeePaidInr) || 0,
    paymentReference: body.paymentReference ? String(body.paymentReference).trim() : undefined,
    paidRegistrationEnabled: Boolean(body.paidRegistrationEnabled),
    configuredFeeInr: Number(body.configuredFeeInr) || 250,
    configuredRewardInr: Number(body.configuredRewardInr) || 50,
    otpVerified: body.otpVerified !== undefined ? Boolean(body.otpVerified) : true,
    referralLevel: body.referralLevel !== undefined ? Number(body.referralLevel) : 1,
    testSimulation: Boolean(body.testSimulation),
  });

  return { httpStatus: 200, payload: decision as unknown as Record<string, unknown> };
}

export function registerAdsAndReferralsRoutes(app: Express, rootDir: string): void {
  // 1. Validate & deduplicate anonymous ad impression/click events (zero PII)
  app.post('/api/ads/validate-event', (req: Request, res: Response) => {
    const ua = String(req.headers['user-agent'] || '');
    const result = validateAdTrackingPayload((req.body || {}) as AdEventValidationInput, ua);
    res.status(result.allowed ? 200 : result.deduped ? 200 : 400).json(result);
  });

  // 2. Server-side referral reward & fraud evaluation engine (Authenticated)
  app.post('/api/referrals/evaluate-eligibility', async (req: Request, res: Response) => {
    const out = await handleEvaluateReferralEligibility({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(out.httpStatus).json(out.payload);
  });
}
