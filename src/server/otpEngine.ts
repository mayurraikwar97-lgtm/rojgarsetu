import crypto from 'node:crypto';

export const OTP_TTL_SECONDS = 300; // 5 minutes
export const OTP_COOLDOWN_SECONDS = 45; // resend cooldown
export const OTP_FAILURE_COOLDOWN_SECONDS = 30; // retry cooldown after SMS dispatch failure
export const MAX_OTP_VERIFY_ATTEMPTS = 5;

export type SmsProviderKind = '2factor' | 'msg91' | 'fast2sms' | 'twilio_verify' | 'twilio_sms' | 'webhook';

export interface NormalizedIndianMobile {
  valid: boolean;
  national10: string;
  digits91: string;
  e164: string;
}

export interface OtpChallengePayload {
  v: 1;
  jti: string;
  mobile: string;
  otpHash: string;
  provider: SmsProviderKind;
  issuedAt: number;
  expiresAt: number;
}

export interface OtpVerificationProofPayload {
  v: 1;
  jti: string;
  mobile: string;
  e164: string;
  verifiedAt: number;
  expiresAt: number;
}

export interface OtpHttpResult {
  status: number;
  body: Record<string, unknown>;
}

interface ChallengeRuntimeState {
  attempts: number;
  used: boolean;
  expiresAt: number;
}

interface ResolvedSmsProvider {
  configured: boolean;
  provider: SmsProviderKind | null;
  providerLabel: string;
  dltConfigured: boolean;
  missingConfig: string[];
}

const rateBuckets = new Map<string, number[]>();
const mobileCooldownMap = new Map<string, number>();
const challengeStates = new Map<string, ChallengeRuntimeState>();
let ephemeralSecretFallback: string | null = null;

function getProviderSecretMaterial(): string {
  return (
    process.env.TWOFACTOR_API_KEY ||
    process.env.MSG91_AUTH_KEY ||
    process.env.FAST2SMS_API_KEY ||
    process.env.TWILIO_AUTH_TOKEN ||
    process.env.SMS_PROVIDER_API_KEY ||
    ''
  ).trim();
}

function getOtpHmacSecret(): string {
  const explicit = (process.env.OTP_HMAC_SECRET || '').trim();
  if (explicit && explicit !== 'CHANGE_IN_PRODUCTION') {
    return explicit;
  }

  const providerSecret = getProviderSecretMaterial();
  if (providerSecret) {
    // Derive a consistent deterministic key from the configured server SMS credential
    // so stateless serverless invocations (request vs verify) validate each other securely
    // even if OTP_HMAC_SECRET was omitted in deployment env settings.
    return crypto.createHmac('sha256', providerSecret).update('rojgar-setu-otp-hmac-v1').digest('hex');
  }

  if (!ephemeralSecretFallback) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('SECURITY NOTICE: OTP_HMAC_SECRET is not set; using ephemeral per-process HMAC secret.');
    }
    ephemeralSecretFallback = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSecretFallback;
}

export function normalizeIndianMobile(rawInput: unknown): NormalizedIndianMobile {
  if (typeof rawInput !== 'string') {
    return { valid: false, national10: '', digits91: '', e164: '' };
  }
  let stripped = rawInput.trim().replace(/[\s\-()]/g, '');
  if (stripped.startsWith('+91')) {
    stripped = stripped.slice(3);
  } else if (stripped.startsWith('91') && stripped.length === 12) {
    stripped = stripped.slice(2);
  } else if (stripped.startsWith('0') && stripped.length === 11) {
    stripped = stripped.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(stripped)) {
    return { valid: false, national10: '', digits91: '', e164: '' };
  }

  return {
    valid: true,
    national10: stripped,
    digits91: `91${stripped}`,
    e164: `+91${stripped}`,
  };
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  if (rateBuckets.size > 5000) {
    for (const [k, list] of rateBuckets.entries()) {
      if (list.length === 0 || now - list[list.length - 1] > windowMs) {
        rateBuckets.delete(k);
      }
    }
  }
  return true;
}

function pruneRuntimeMaps(): void {
  const now = Date.now();
  if (challengeStates.size > 2000) {
    for (const [k, st] of challengeStates.entries()) {
      if (st.expiresAt < now) challengeStates.delete(k);
    }
  }
  if (mobileCooldownMap.size > 2000) {
    for (const [mob, until] of mobileCooldownMap.entries()) {
      if (until < now) mobileCooldownMap.delete(mob);
    }
  }
}

function signPayload<T extends object>(payload: T): string {
  const secret = getOtpHmacSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T>(token: string): T | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const secret = getOtpHmacSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function computeOtpHash(jti: string, mobile: string, otp: string): string {
  return crypto
    .createHmac('sha256', getOtpHmacSecret())
    .update(`${jti}:${mobile}:${otp}`)
    .digest('hex');
}

export function resolveSmsProviderConfig(): ResolvedSmsProvider {
  const explicitProvider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  const dltSenderId = (process.env.SMS_DLT_SENDER_ID || process.env.MSG91_SENDER_ID || process.env.FAST2SMS_SENDER_ID || '').trim();
  const dltTemplateId = (process.env.SMS_DLT_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID || process.env.FAST2SMS_TEMPLATE_ID || '').trim();
  const dltEntityId = (process.env.SMS_DLT_ENTITY_ID || '').trim();
  const dltConfigured = Boolean(dltSenderId && dltTemplateId);

  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioVerifySid = (process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  const twilioFrom = (process.env.TWILIO_FROM_NUMBER || '').trim();
  const twilioMessagingSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();

  const twoFactorKey = (process.env.TWOFACTOR_API_KEY || '').trim();
  const twoFactorTemplate = (process.env.TWOFACTOR_TEMPLATE_NAME || process.env.SMS_DLT_TEMPLATE_ID || '').trim();
  const twoFactorSenderId = (process.env.TWOFACTOR_SENDER_ID || dltSenderId || '').trim();

  const msg91Key = (process.env.MSG91_AUTH_KEY || '').trim();
  const msg91Template = (process.env.MSG91_TEMPLATE_ID || process.env.SMS_DLT_TEMPLATE_ID || '').trim();

  const fast2smsKey = (process.env.FAST2SMS_API_KEY || '').trim();

  const webhookKey = (process.env.SMS_PROVIDER_API_KEY || '').trim();
  const webhookUrl = (process.env.SMS_GATEWAY_WEBHOOK_URL || '').trim();

  if (explicitProvider === '2factor' || (!explicitProvider && twoFactorKey)) {
    const missing: string[] = [];
    if (!twoFactorKey) missing.push('TWOFACTOR_API_KEY');
    if (!twoFactorTemplate) {
      missing.push(
        'TWOFACTOR_TEMPLATE_NAME (approved 2Factor SMS template required for SMS-only OTP; Voice Call fallback is disabled)'
      );
    }
    return {
      configured: Boolean(twoFactorKey && twoFactorTemplate),
      provider: '2factor',
      providerLabel: twoFactorSenderId
        ? '2Factor.in Transactional SMS (TSMS) Gateway'
        : '2Factor.in SMS OTP Gateway',
      dltConfigured: Boolean(twoFactorTemplate),
      missingConfig: missing,
    };
  }

  if (explicitProvider === 'msg91' || (!explicitProvider && msg91Key)) {
    const missing: string[] = [];
    if (!msg91Key) missing.push('MSG91_AUTH_KEY');
    if (!msg91Template) missing.push('MSG91_TEMPLATE_ID (DLT approved OTP template)');
    return {
      configured: missing.length === 0,
      provider: 'msg91',
      providerLabel: 'MSG91 OTP/DLT Gateway',
      dltConfigured: Boolean(msg91Template),
      missingConfig: missing,
    };
  }

  if (explicitProvider === 'fast2sms' || (!explicitProvider && fast2smsKey)) {
    const missing: string[] = [];
    if (!fast2smsKey) missing.push('FAST2SMS_API_KEY');
    const route = (process.env.FAST2SMS_ROUTE || (dltConfigured ? 'dlt' : 'otp')).trim().toLowerCase();
    if (route === 'dlt') {
      if (!dltSenderId) missing.push('FAST2SMS_SENDER_ID or SMS_DLT_SENDER_ID');
      if (!dltTemplateId) missing.push('FAST2SMS_TEMPLATE_ID or SMS_DLT_TEMPLATE_ID');
    }
    return {
      configured: missing.length === 0,
      provider: 'fast2sms',
      providerLabel: 'Fast2SMS Indian Gateway',
      dltConfigured: route !== 'dlt' || dltConfigured,
      missingConfig: missing,
    };
  }

  if (explicitProvider === 'twilio' || (!explicitProvider && (twilioSid || twilioToken))) {
    const missing: string[] = [];
    if (!twilioSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!twilioToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!twilioVerifySid && !twilioFrom && !twilioMessagingSid) {
      missing.push('TWILIO_VERIFY_SERVICE_SID or TWILIO_FROM_NUMBER');
    }
    return {
      configured: missing.length === 0,
      provider: twilioVerifySid ? 'twilio_verify' : 'twilio_sms',
      providerLabel: twilioVerifySid ? 'Twilio Verify' : 'Twilio Programmable SMS',
      dltConfigured: true,
      missingConfig: missing,
    };
  }

  if (explicitProvider === 'webhook' || webhookKey || webhookUrl) {
    const missing: string[] = [];
    if (!webhookKey) missing.push('SMS_PROVIDER_API_KEY');
    if (!webhookUrl) missing.push('SMS_GATEWAY_WEBHOOK_URL');
    return {
      configured: missing.length === 0,
      provider: 'webhook',
      providerLabel: 'Custom DLT SMS Webhook',
      dltConfigured: Boolean(dltSenderId && dltTemplateId && dltEntityId) || dltConfigured,
      missingConfig: missing,
    };
  }

  return {
    configured: false,
    provider: null,
    providerLabel: 'Not Configured',
    dltConfigured: false,
    missingConfig: [
      'TWOFACTOR_API_KEY or SMS_PROVIDER (2factor | msg91 | fast2sms | twilio | webhook) + credentials, OR Firebase Phone Authentication (VITE_FIREBASE_PHONE_AUTH_ENABLED=true)',
    ],
  };
}

export function getOtpPublicConfig(): {
  smsProviderConfigured: boolean;
  providerType: SmsProviderKind | null;
  providerLabel: string;
  channel: 'SMS';
  deliveryChannel: 'sms_only';
  voiceFallbackDisabled: boolean;
  dltConfigured: boolean;
  firebasePhoneAuthEnabled: boolean;
  cooldownSeconds: number;
  otpExpiresInSeconds: number;
  countryCode: '+91';
  missingConfig: string[];
} {
  const cfg = resolveSmsProviderConfig();
  return {
    smsProviderConfigured: cfg.configured,
    providerType: cfg.provider,
    providerLabel: cfg.providerLabel,
    channel: 'SMS',
    deliveryChannel: 'sms_only',
    voiceFallbackDisabled: true,
    dltConfigured: cfg.dltConfigured,
    firebasePhoneAuthEnabled:
      (process.env.VITE_FIREBASE_PHONE_AUTH_ENABLED || process.env.FIREBASE_PHONE_AUTH_ENABLED || '').trim().toLowerCase() === 'true',
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
    otpExpiresInSeconds: OTP_TTL_SECONDS,
    countryCode: '+91',
    missingConfig: cfg.missingConfig,
  };
}

function buildOtpMessage(otp: string): string {
  const customTpl = (process.env.SMS_OTP_MESSAGE_TEMPLATE || '').trim();
  if (customTpl) {
    return customTpl.replace(/\{OTP\}|\{#var#\}/gi, otp);
  }
  return `Your ROJGAR SETU verification OTP is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface DispatchResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  providerMessageId?: string;
}

async function dispatchSmsViaConfiguredProvider(
  provider: SmsProviderKind,
  mobile: NormalizedIndianMobile,
  otp: string
): Promise<DispatchResult> {
  const dltSenderId = (process.env.SMS_DLT_SENDER_ID || process.env.MSG91_SENDER_ID || process.env.FAST2SMS_SENDER_ID || '').trim();
  const dltTemplateId = (process.env.SMS_DLT_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID || process.env.FAST2SMS_TEMPLATE_ID || '').trim();
  const dltEntityId = (process.env.SMS_DLT_ENTITY_ID || '').trim();
  const message = buildOtpMessage(otp);

  try {
    if (provider === '2factor') {
      const apiKey = (process.env.TWOFACTOR_API_KEY || '').trim();
      const templateName = (process.env.TWOFACTOR_TEMPLATE_NAME || dltTemplateId || '').trim();
      const senderId = (process.env.TWOFACTOR_SENDER_ID || dltSenderId || '').trim();

      if (!apiKey) {
        return {
          ok: false,
          errorCode: 'SMS_PROVIDER_NOT_CONFIGURED',
          message: '2Factor API key is missing on the server.',
        };
      }

      // CRITICAL: On 2Factor, calling /SMS/{phone}/{otp} without an approved SMS templateName
      // routes through 2Factor's automated Voice Call fallback. Require templateName strictly
      // so OTPs are ONLY delivered via SMS and never via Voice Call.
      if (!templateName) {
        return {
          ok: false,
          errorCode: 'SMS_TEMPLATE_REQUIRED',
          message:
            '2Factor SMS delivery requires TWOFACTOR_TEMPLATE_NAME (approved DLT SMS template). Voice Call OTP fallback is disabled.',
        };
      }

      const encodedKey = encodeURIComponent(apiKey);
      const safeSanitize = (rawText: string) =>
        rawText.split(apiKey).join('***').replace(/\s+/g, ' ').trim().slice(0, 200);

      let res: globalThis.Response;
      if (senderId) {
        // Official 2Factor Transactional SMS (TSMS) endpoint — strictly SMS-only channel, no voice routing
        const tsmsEndpoint = `https://2factor.in/API/V1/${encodedKey}/ADDON_SERVICES/SEND/TSMS`;
        res = await fetchWithTimeout(tsmsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: senderId,
            To: mobile.digits91,
            TemplateName: templateName,
            VAR1: otp,
          }),
        });
      } else {
        // Official 2Factor Manual SMS OTP endpoint WITH explicit approved template name (no Voice fallback)
        const encodedPhone = encodeURIComponent(mobile.digits91);
        const encodedOtp = encodeURIComponent(otp);
        const encodedTemplate = encodeURIComponent(templateName);
        const smsEndpoint = `https://2factor.in/API/V1/${encodedKey}/SMS/${encodedPhone}/${encodedOtp}/${encodedTemplate}`;
        res = await fetchWithTimeout(smsEndpoint, { method: 'GET' });
      }

      const text = await res.text();
      let parsed: { Status?: string; Details?: string } = {};
      try {
        parsed = JSON.parse(text) as { Status?: string; Details?: string };
      } catch {
        parsed = {};
      }

      if (!res.ok || parsed.Status !== 'Success') {
        const rawDetail = typeof parsed.Details === 'string' && parsed.Details.trim() ? parsed.Details : text;
        const cleanDetail = safeSanitize(rawDetail) || `HTTP ${res.status}`;
        console.error('[OTP 2Factor SMS] Dispatch failed status=', res.status, 'detail=', cleanDetail);
        return {
          ok: false,
          errorCode: 'SMS_DISPATCH_FAILED',
          message: `SMS delivery failed (${cleanDetail}). Voice Call fallback is disabled.`,
        };
      }

      if (typeof parsed.Details === 'string' && /\b(voice|call|obd)\b/i.test(parsed.Details)) {
        console.error('[OTP 2Factor SMS] Rejected unexpected Voice route detail:', safeSanitize(parsed.Details));
        return {
          ok: false,
          errorCode: 'VOICE_FALLBACK_DETECTED',
          message:
            '2Factor attempted a Voice Call route instead of SMS. Verify DLT SMS approval/credits and disable Voice fallback in your 2Factor dashboard.',
        };
      }

      return {
        ok: true,
        providerMessageId: typeof parsed.Details === 'string' ? parsed.Details : undefined,
      };
    }

    if (provider === 'msg91') {
      const authKey = (process.env.MSG91_AUTH_KEY || '').trim();
      const templateId = (process.env.MSG91_TEMPLATE_ID || dltTemplateId).trim();
      const payload: Record<string, unknown> = {
        template_id: templateId,
        mobile: mobile.digits91,
        otp,
        otp_length: 6,
        otp_expiry: 5,
      };
      if (dltSenderId) payload.sender = dltSenderId;

      const res = await fetchWithTimeout('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      if (!res.ok || parsed.type === 'error') {
        console.error('[OTP MSG91] Dispatch failed:', res.status, text.slice(0, 300));
        return {
          ok: false,
          errorCode: 'SMS_DISPATCH_FAILED',
          message: 'SMS service temporarily unavailable. Please retry in a moment.',
        };
      }
      return {
        ok: true,
        providerMessageId: typeof parsed.request_id === 'string' ? parsed.request_id : undefined,
      };
    }

    if (provider === 'fast2sms') {
      const apiKey = (process.env.FAST2SMS_API_KEY || '').trim();
      const route = (process.env.FAST2SMS_ROUTE || (dltTemplateId && dltSenderId ? 'dlt' : 'otp')).trim().toLowerCase();
      const bodyPayload: Record<string, unknown> =
        route === 'dlt'
          ? {
              route: 'dlt',
              sender_id: dltSenderId,
              message: dltTemplateId,
              variables_values: otp,
              flash: 0,
              numbers: mobile.national10,
              ...(dltEntityId ? { entity_id: dltEntityId } : {}),
            }
          : route === 'q'
          ? {
              route: 'q',
              message,
              flash: 0,
              numbers: mobile.national10,
            }
          : {
              route: 'otp',
              variables_values: otp,
              flash: 0,
              numbers: mobile.national10,
            };

      const res = await fetchWithTimeout('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: apiKey,
        },
        body: JSON.stringify(bodyPayload),
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      if (!res.ok || parsed.return === false) {
        console.error('[OTP Fast2SMS] Dispatch failed:', res.status, text.slice(0, 300));
        return {
          ok: false,
          errorCode: 'SMS_DISPATCH_FAILED',
          message: 'SMS service temporarily unavailable. Please check Fast2SMS/DLT configuration or retry shortly.',
        };
      }
      return {
        ok: true,
        providerMessageId: typeof parsed.request_id === 'string' ? parsed.request_id : undefined,
      };
    }

    if (provider === 'twilio_verify') {
      const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
      const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
      const verifySid = (process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
      const authHeader = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;

      const form = new URLSearchParams();
      form.set('To', mobile.e164);
      form.set('Channel', 'sms');

      const res = await fetchWithTimeout(
        `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifySid)}/Verifications`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      if (!res.ok) {
        console.error('[OTP Twilio Verify] Dispatch failed:', res.status, text.slice(0, 300));
        return {
          ok: false,
          errorCode: 'SMS_DISPATCH_FAILED',
          message: 'SMS service temporarily unavailable. Unable to dispatch OTP via Twilio Verify.',
        };
      }
      return {
        ok: true,
        providerMessageId: typeof parsed.sid === 'string' ? parsed.sid : undefined,
      };
    }

    if (provider === 'twilio_sms') {
      const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
      const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
      const fromNumber = (process.env.TWILIO_FROM_NUMBER || '').trim();
      const messagingSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
      const authHeader = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;

      const form = new URLSearchParams();
      form.set('To', mobile.e164);
      if (messagingSid) {
        form.set('MessagingServiceSid', messagingSid);
      } else {
        form.set('From', fromNumber);
      }
      form.set('Body', message);

      const res = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      if (!res.ok) {
        console.error('[OTP Twilio SMS] Dispatch failed:', res.status, text.slice(0, 300));
        return {
          ok: false,
          errorCode: 'SMS_DISPATCH_FAILED',
          message: 'SMS service temporarily unavailable. Unable to send OTP SMS.',
        };
      }
      return {
        ok: true,
        providerMessageId: typeof parsed.sid === 'string' ? parsed.sid : undefined,
      };
    }

    // Custom HTTPS SMS / DLT Webhook
    const webhookUrl = (process.env.SMS_GATEWAY_WEBHOOK_URL || '').trim();
    const webhookKey = (process.env.SMS_PROVIDER_API_KEY || '').trim();
    const res = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookKey}`,
      },
      body: JSON.stringify({
        to: mobile.e164,
        mobile: mobile.national10,
        digits91: mobile.digits91,
        countryCode: '+91',
        otp,
        message,
        expiresInMinutes: 5,
        ...(dltSenderId ? { dltSenderId, senderId: dltSenderId } : {}),
        ...(dltTemplateId ? { dltTemplateId, templateId: dltTemplateId } : {}),
        ...(dltEntityId ? { dltEntityId, entityId: dltEntityId } : {}),
      }),
    });

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    if (!res.ok || parsed.ok === false) {
      console.error('[OTP Webhook] Dispatch failed:', res.status, text.slice(0, 300));
      return {
        ok: false,
        errorCode: 'SMS_DISPATCH_FAILED',
        message: 'Configured SMS gateway failed to deliver OTP. Please retry shortly.',
      };
    }
    return {
      ok: true,
      providerMessageId: typeof parsed.messageId === 'string' ? parsed.messageId : undefined,
    };
  } catch (err) {
    console.error('[OTP Dispatch] Network/timeout error:', err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      errorCode: 'SMS_DISPATCH_FAILED',
      message: 'SMS service temporarily unavailable. Please check your connection and try again.',
    };
  }
}

export async function handleOtpRequest(
  body: Record<string, unknown> | undefined,
  clientIp: string
): Promise<OtpHttpResult> {
  pruneRuntimeMaps();

  const rawChannel = typeof body?.channel === 'string' ? body.channel.trim().toUpperCase() : 'SMS';
  if (rawChannel && rawChannel !== 'SMS') {
    return {
      status: 400,
      body: {
        error: 'VOICE_OTP_DISABLED',
        channel: 'SMS',
        deliveryChannel: 'sms_only',
        voiceFallbackDisabled: true,
        message: 'Voice Call OTP is disabled. Only channel: "SMS" is supported.',
      },
    };
  }

  const normalized = normalizeIndianMobile(body?.mobile);
  if (!normalized.valid) {
    return {
      status: 400,
      body: {
        error: 'INVALID_MOBILE',
        message: 'Invalid mobile number. Enter a valid 10-digit Indian mobile number (+91).',
      },
    };
  }

  // Enforce per-IP & per-mobile sliding-window rate limits
  if (
    !checkRateLimit(`otp-req-ip:${clientIp}`, 12, 10 * 60 * 1000) ||
    !checkRateLimit(`otp-req-mob:${normalized.national10}`, 5, 15 * 60 * 1000)
  ) {
    return {
      status: 429,
      body: {
        error: 'OTP_RATE_LIMITED',
        message: 'Too many OTP requests. Please wait a few minutes before requesting another code.',
      },
    };
  }

  // Enforce resend cooldown both in-memory and statelessly via previousChallengeToken
  const now = Date.now();
  const memCooldownUntil = mobileCooldownMap.get(normalized.national10) || 0;
  if (memCooldownUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((memCooldownUntil - now) / 1000));
    return {
      status: 429,
      body: {
        error: 'OTP_COOLDOWN_ACTIVE',
        retryAfterSeconds,
        message: `Please wait ${retryAfterSeconds}s before requesting another OTP.`,
      },
    };
  }

  if (typeof body?.previousChallengeToken === 'string' && body.previousChallengeToken.trim()) {
    const prev = verifySignedPayload<OtpChallengePayload>(body.previousChallengeToken.trim());
    if (prev && prev.mobile === normalized.national10 && prev.issuedAt + OTP_COOLDOWN_SECONDS * 1000 > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((prev.issuedAt + OTP_COOLDOWN_SECONDS * 1000 - now) / 1000));
      return {
        status: 429,
        body: {
          error: 'OTP_COOLDOWN_ACTIVE',
          retryAfterSeconds,
          message: `Please wait ${retryAfterSeconds}s before requesting another OTP.`,
        },
      };
    }
  }

  const providerConfig = resolveSmsProviderConfig();
  if (!providerConfig.configured || !providerConfig.provider) {
    const missingTemplateOnly =
      providerConfig.provider === '2factor' &&
      Boolean((process.env.TWOFACTOR_API_KEY || '').trim()) &&
      !providerConfig.dltConfigured;

    return {
      status: 503,
      body: {
        error: missingTemplateOnly ? 'SMS_TEMPLATE_REQUIRED' : 'SMS_PROVIDER_NOT_CONFIGURED',
        channel: 'SMS',
        deliveryChannel: 'sms_only',
        voiceFallbackDisabled: true,
        message: missingTemplateOnly
          ? '2Factor SMS delivery failed: TWOFACTOR_TEMPLATE_NAME (approved DLT SMS template name) is required in Vercel Environment Variables to send SMS only. Voice Call OTP is disabled.'
          : 'SMS provider configuration missing. Real OTP SMS cannot be sent until a server SMS gateway (2Factor with approved SMS template, MSG91, Fast2SMS, Twilio, or DLT Webhook) or Firebase Phone Auth is configured.',
        missingConfig: providerConfig.missingConfig,
      },
    };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const jti = crypto.randomBytes(12).toString('hex');
  const expiresAt = now + OTP_TTL_SECONDS * 1000;
  const otpHash =
    providerConfig.provider === 'twilio_verify'
      ? 'twilio_verify_managed'
      : computeOtpHash(jti, normalized.national10, otp);

  const dispatchResult = await dispatchSmsViaConfiguredProvider(providerConfig.provider, normalized, otp);
  if (!dispatchResult.ok) {
    mobileCooldownMap.set(normalized.national10, now + OTP_FAILURE_COOLDOWN_SECONDS * 1000);
    return {
      status: 503,
      body: {
        error: dispatchResult.errorCode || 'SMS_DISPATCH_FAILED',
        channel: 'SMS',
        deliveryChannel: 'sms_only',
        voiceFallbackDisabled: true,
        retryAfterSeconds: OTP_FAILURE_COOLDOWN_SECONDS,
        message: dispatchResult.message || 'SMS delivery failed. Voice Call fallback is disabled.',
      },
    };
  }

  const challengeToken = signPayload<OtpChallengePayload>({
    v: 1,
    jti,
    mobile: normalized.national10,
    otpHash,
    provider: providerConfig.provider,
    issuedAt: now,
    expiresAt,
  });

  challengeStates.set(jti, { attempts: 0, used: false, expiresAt });
  mobileCooldownMap.set(normalized.national10, now + OTP_COOLDOWN_SECONDS * 1000);

  return {
    status: 200,
    body: {
      ok: true,
      mode: providerConfig.provider,
      providerLabel: providerConfig.providerLabel,
      channel: 'SMS',
      deliveryChannel: 'sms_only',
      voiceFallbackDisabled: true,
      deliveryStatus: 'dispatched',
      mobile: normalized.national10,
      e164: normalized.e164,
      challengeToken,
      expiresInSeconds: OTP_TTL_SECONDS,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      ...(dispatchResult.providerMessageId ? { providerMessageId: dispatchResult.providerMessageId } : {}),
    },
  };
}

export async function handleOtpVerify(
  body: Record<string, unknown> | undefined,
  clientIp: string
): Promise<OtpHttpResult> {
  pruneRuntimeMaps();

  if (!checkRateLimit(`otp-ver-ip:${clientIp}`, 25, 10 * 60 * 1000)) {
    return {
      status: 429,
      body: {
        verified: false,
        error: 'OTP_RATE_LIMITED',
        message: 'Too many OTP verification attempts. Please wait a few minutes.',
      },
    };
  }

  const normalized = normalizeIndianMobile(body?.mobile);
  const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
  const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken.trim() : '';

  if (!normalized.valid) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'INVALID_MOBILE',
        message: 'Invalid mobile number. Enter a valid 10-digit Indian mobile number (+91).',
      },
    };
  }

  if (!/^\d{6}$/.test(otp) || !challengeToken) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'MISSING_FIELDS',
        message: 'Enter the 6-digit OTP sent to your mobile number.',
      },
    };
  }

  const payload = verifySignedPayload<OtpChallengePayload>(challengeToken);
  if (!payload || !payload.jti) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired OTP session. Please request a new OTP.',
      },
    };
  }

  const now = Date.now();
  if (now > payload.expiresAt) {
    challengeStates.delete(payload.jti);
    return {
      status: 400,
      body: {
        verified: false,
        error: 'OTP_EXPIRED',
        message: 'OTP expired. Please request a new code.',
      },
    };
  }

  if (payload.mobile !== normalized.national10) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'MOBILE_MISMATCH',
        message: 'Mobile number does not match the OTP request.',
      },
    };
  }

  const state = challengeStates.get(payload.jti);
  if (state?.used) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'OTP_ALREADY_USED',
        message: 'This OTP has already been verified. Request a new OTP if you changed your number.',
      },
    };
  }

  if (state && state.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    return {
      status: 429,
      body: {
        verified: false,
        error: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect OTP attempts. Please request a new code.',
      },
    };
  }

  if (payload.provider === 'twilio_verify') {
    const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const verifySid = (process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
    if (!sid || !token || !verifySid) {
      return {
        status: 503,
        body: {
          verified: false,
          error: 'SMS_PROVIDER_NOT_CONFIGURED',
          message: 'Twilio Verify configuration missing on server.',
        },
      };
    }

    try {
      const form = new URLSearchParams();
      form.set('To', normalized.e164);
      form.set('Code', otp);
      const res = await fetchWithTimeout(
        `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifySid)}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      const parsed = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || parsed.status !== 'approved') {
        const nextAttempts = (state?.attempts ?? 0) + 1;
        challengeStates.set(payload.jti, { attempts: nextAttempts, used: false, expiresAt: payload.expiresAt });
        if (nextAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
          return {
            status: 429,
            body: {
              verified: false,
              error: 'OTP_ATTEMPTS_EXCEEDED',
              message: 'Too many incorrect OTP attempts. Please request a new code.',
            },
          };
        }
        return {
          status: 400,
          body: {
            verified: false,
            error: 'INCORRECT_OTP',
            attemptsRemaining: MAX_OTP_VERIFY_ATTEMPTS - nextAttempts,
            message: `Incorrect OTP. ${MAX_OTP_VERIFY_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
          },
        };
      }
    } catch {
      return {
        status: 503,
        body: {
          verified: false,
          error: 'SMS_SERVICE_UNAVAILABLE',
          message: 'SMS verification service temporarily unavailable.',
        },
      };
    }
  } else {
    const attemptHash = computeOtpHash(payload.jti, normalized.national10, otp);
    const attemptBuf = Buffer.from(attemptHash, 'hex');
    const storedBuf = Buffer.from(payload.otpHash, 'hex');

    if (attemptBuf.length !== storedBuf.length || !crypto.timingSafeEqual(attemptBuf, storedBuf)) {
      const nextAttempts = (state?.attempts ?? 0) + 1;
      challengeStates.set(payload.jti, {
        attempts: nextAttempts,
        used: false,
        expiresAt: payload.expiresAt,
      });

      if (nextAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        return {
          status: 429,
          body: {
            verified: false,
            error: 'OTP_ATTEMPTS_EXCEEDED',
            message: 'Too many incorrect OTP attempts. Please request a new code.',
          },
        };
      }

      return {
        status: 400,
        body: {
          verified: false,
          error: 'INCORRECT_OTP',
          attemptsRemaining: MAX_OTP_VERIFY_ATTEMPTS - nextAttempts,
          message: `Incorrect OTP. ${MAX_OTP_VERIFY_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
        },
      };
    }
  }

  challengeStates.set(payload.jti, {
    attempts: state?.attempts ?? 0,
    used: true,
    expiresAt: payload.expiresAt,
  });

  const verificationProof = signPayload<OtpVerificationProofPayload>({
    v: 1,
    jti: payload.jti,
    mobile: normalized.national10,
    e164: normalized.e164,
    verifiedAt: now,
    expiresAt: now + 30 * 60 * 1000,
  });

  return {
    status: 200,
    body: {
      verified: true,
      mobile: normalized.national10,
      e164: normalized.e164,
      verifiedAt: new Date(now).toISOString(),
      verificationProof,
    },
  };
}

export function verifyOtpProofToken(proofToken: string, expectedMobile: string): boolean {
  const normalized = normalizeIndianMobile(expectedMobile);
  if (!normalized.valid || !proofToken) return false;
  const parsed = verifySignedPayload<OtpVerificationProofPayload>(proofToken);
  if (!parsed || parsed.mobile !== normalized.national10) return false;
  return Date.now() <= parsed.expiresAt;
}
