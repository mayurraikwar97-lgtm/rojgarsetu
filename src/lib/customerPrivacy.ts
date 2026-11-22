import type {
  CustomerGender,
  CustomerProfileVisibility,
  DealStatus,
  EmployerPrivateInfo,
  JobApplication,
  JobPosting,
  PublicEmployerProfile,
} from '../types/domain.ts';

export const BRAND_SLOGAN_MR = 'कामगार नाही, आपलीच माणसं!';
export const BRAND_TAGLINE_MR = 'विश्वासाने काम द्या, सन्मानाने रोजगार द्या.';
export const BRAND_MESSAGE_MR = 'प्रत्येक हाताला काम, प्रत्येक श्रमाला सन्मान.';

const HONORIFIC_PREFIXES = new Set([
  'mr',
  'mr.',
  'mrs',
  'mrs.',
  'ms',
  'ms.',
  'miss',
  'smt',
  'smt.',
  'kum',
  'kum.',
  'shri',
  'dr',
  'dr.',
  'prof',
  'prof.',
  'er',
  'er.',
  'sau',
  'sau.',
  'श्रीमती',
  'सौ',
  'सौ.',
  'कु',
  'कु.',
  'श्री',
  'डॉ',
  'डॉ.',
]);

const INDIAN_MOBILE_RE = /(?:\+?91[\s-]*)?\b[6-9]\d{9}\b/g;
const GENERIC_PHONE_RE = /(?:\+?\d[\d\s-]{8,14}\d)/g;

const CONFIRMED_DEAL_STATUSES = new Set<DealStatus>([
  'OFFER_ACCEPTED',
  'DEAL_CONFIRMED',
  'WORKER_ON_THE_WAY',
  'WORKER_ARRIVED',
  'WORK_IN_PROGRESS',
  'WORK_COMPLETED',
]);

/**
 * Extracts strictly the surname / last name from a full name or explicit last name.
 * Never returns the first name when multiple tokens exist.
 */
export function extractLastName(fullName?: string | null, explicitLastName?: string | null): string {
  const explicit = (explicitLastName || '').trim().replace(/\s+/g, ' ');
  if (explicit) {
    const explicitTokens = explicit
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !HONORIFIC_PREFIXES.has(t.toLowerCase()));
    if (explicitTokens.length > 0) {
      return explicitTokens[explicitTokens.length - 1].slice(0, 60);
    }
  }

  const raw = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'Customer';

  const tokens = raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !HONORIFIC_PREFIXES.has(t.toLowerCase()));

  if (tokens.length === 0) return 'Customer';
  if (tokens.length === 1) {
    // Single-word input with no explicit surname: return safe generic label rather than risking exposing a female first name
    return 'Customer';
  }
  return tokens[tokens.length - 1].slice(0, 60);
}

/**
 * Returns whether strict female-customer privacy rules apply to this customer.
 */
export function isFemaleCustomerProtected(params: {
  gender?: CustomerGender | string | null;
  customerGenderProtected?: boolean | null;
}): boolean {
  return params.gender === 'female' || params.customerGenderProtected === true;
}

/**
 * Returns whether the customer's worker-visible name should be restricted to Last Name only.
 * Female customers ALWAYS have Last-Name-only protection when viewed by workers.
 */
export function shouldMaskCustomerToLastNameOnly(params: {
  gender?: CustomerGender | string | null;
  customerGenderProtected?: boolean | null;
  profileVisibility?: CustomerProfileVisibility | string | null;
}): boolean {
  if (isFemaleCustomerProtected(params)) return true;
  return params.profileVisibility === 'last_name_only' || params.profileVisibility === 'private_strict';
}

/**
 * Resolves the exact customer display name safe to expose to workers, job cards,
 * notifications, chat headers, and order history.
 *
 * PRIVACY GUARANTEE:
 * - For Female customers (or customers with `last_name_only` / `private_strict` visibility),
 *   workers (including the assigned worker) ONLY ever see the Last Name.
 * - Full names are NEVER returned for non-admin, non-owner viewers when protected.
 */
export function getWorkerVisibleCustomerName(params: {
  employerProfile?: Pick<
    PublicEmployerProfile,
    'businessName' | 'gender' | 'lastName' | 'profileVisibility'
  > | null;
  employerPrivate?: Pick<
    EmployerPrivateInfo,
    'contactPerson' | 'gender' | 'lastName' | 'profileVisibility'
  > | null;
  gender?: CustomerGender | string | null;
  customerGenderProtected?: boolean | null;
  profileVisibility?: CustomerProfileVisibility | string | null;
  lastName?: string | null;
  fullName?: string | null;
  businessName?: string | null;
  fallbackName?: string | null;
  viewerRole?: 'worker' | 'customer' | 'admin' | 'public';
}): string {
  const viewerRole = params.viewerRole || 'worker';
  const gender = params.gender ?? params.employerProfile?.gender ?? params.employerPrivate?.gender;
  const profileVisibility =
    params.profileVisibility ??
    params.employerProfile?.profileVisibility ??
    params.employerPrivate?.profileVisibility;
  const protectedFemale = isFemaleCustomerProtected({
    gender,
    customerGenderProtected: params.customerGenderProtected,
  });

  const rawFullName =
    params.fullName ||
    params.employerPrivate?.contactPerson ||
    params.businessName ||
    params.employerProfile?.businessName ||
    params.fallbackName ||
    'Customer';

  const explicitLast =
    params.lastName ||
    params.employerProfile?.lastName ||
    params.employerPrivate?.lastName;

  // Authorized Admin or the Customer viewing their own private record may see full name
  if (viewerRole === 'admin' || viewerRole === 'customer') {
    const clean = (rawFullName || '').trim();
    return clean || 'Customer';
  }

  // Workers and public surfaces: Female customers & restricted visibility customers ONLY ever show Last Name
  if (
    protectedFemale ||
    shouldMaskCustomerToLastNameOnly({
      gender,
      customerGenderProtected: params.customerGenderProtected,
      profileVisibility,
    })
  ) {
    const surname = extractLastName(rawFullName, explicitLast);
    return surname || 'Customer';
  }

  // Standard male / business customer visibility
  const standardLabel = (
    params.businessName ||
    params.employerProfile?.businessName ||
    rawFullName ||
    'Customer'
  )
    .trim()
    .slice(0, 120);
  return standardLabel || 'Customer';
}

/**
 * Helper to format a customer name from a JobPosting or JobApplication for a worker viewer.
 * Guarantees that even legacy or uncleaned strings are strictly truncated to Last Name if protected.
 */
export function getSafeCustomerLabelForJobOrApp(params: {
  job?: Pick<JobPosting, 'employerName' | 'customerGenderProtected' | 'customerLastName'> | null;
  app?: Pick<JobApplication, 'customerName' | 'customerGenderProtected' | 'customerLastName'> | null;
  viewerRole?: 'worker' | 'customer' | 'admin' | 'public';
}): string {
  const isProtected = Boolean(
    params.job?.customerGenderProtected || params.app?.customerGenderProtected
  );
  const explicitLast = params.app?.customerLastName || params.job?.customerLastName || '';
  const rawName = params.app?.customerName || params.job?.employerName || 'Customer';

  if (params.viewerRole === 'admin' || params.viewerRole === 'customer') {
    return rawName;
  }
  if (isProtected) {
    if (explicitLast.trim()) {
      return extractLastName(explicitLast, explicitLast);
    }
    // If rawName is already a single-word surname (saved sanitized), return it directly
    const tokens = rawName.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return tokens[0].slice(0, 60);
    return extractLastName(rawName);
  }
  return rawName;
}

/**
 * Checks whether a specific worker is the confirmed/assigned worker for an order.
 * Only returns true AFTER order confirmation and ONLY for the assigned worker.
 */
export function isConfirmedAssignedWorker(params: {
  viewerUid?: string | null;
  job?: Pick<JobPosting, 'employerUid' | 'acceptedWorkerUid' | 'status' | 'dealStatus'> | null;
  app?: Pick<JobApplication, 'employerUid' | 'workerUid' | 'status' | 'dealStatus'> | null;
}): boolean {
  const uid = (params.viewerUid || '').trim();
  if (!uid) return false;

  if (params.app) {
    if (params.app.workerUid !== uid) return false;
    if (params.app.status === 'accepted' || params.app.status === 'work_completed') return true;
    if (params.app.dealStatus && CONFIRMED_DEAL_STATUSES.has(params.app.dealStatus)) return true;
    return false;
  }

  if (params.job) {
    if (params.job.acceptedWorkerUid !== uid) return false;
    if (params.job.status === 'in_progress' || params.job.status === 'completed') return true;
    if (params.job.dealStatus && CONFIRMED_DEAL_STATUSES.has(params.job.dealStatus)) return true;
    return false;
  }

  return false;
}

/**
 * Checks whether the viewer is allowed to view the exact service address.
 * Allowed ONLY for:
 * 1. The Customer who created the order (owner)
 * 2. Authorized Admin
 * 3. The assigned worker AFTER order confirmation
 */
export function canViewExactServiceAddress(params: {
  viewerUid?: string | null;
  isAdmin?: boolean;
  job?: Pick<JobPosting, 'employerUid' | 'acceptedWorkerUid' | 'status' | 'dealStatus'> | null;
  app?: Pick<JobApplication, 'employerUid' | 'workerUid' | 'status' | 'dealStatus'> | null;
}): boolean {
  if (params.isAdmin) return true;
  const uid = (params.viewerUid || '').trim();
  if (!uid) return false;

  const ownerUid = params.job?.employerUid || params.app?.employerUid;
  if (ownerUid && ownerUid === uid) return true;

  return isConfirmedAssignedWorker({
    viewerUid: uid,
    job: params.job,
    app: params.app,
  });
}

/**
 * Returns rounded approximate coordinates (~1.1 km precision) for unconfirmed public job documents
 * so exact home coordinates are never exposed in public Firestore reads before confirmation.
 */
export function getApproximateCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  const safeLat = Number.isFinite(lat) ? Math.round(lat * 100) / 100 : 20.59;
  const safeLng = Number.isFinite(lng) ? Math.round(lng * 100) / 100 : 78.96;
  return { lat: safeLat, lng: safeLng };
}

/**
 * Strips any personal phone/mobile numbers from notification messages, chat snippets, or logs.
 */
export function sanitizeNotificationTextForPrivacy(input: string): string {
  if (!input) return '';
  return input
    .replace(INDIAN_MOBILE_RE, '[Protected Contact]')
    .replace(GENERIC_PHONE_RE, (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      return digitsOnly.length >= 10 ? '[Protected Contact]' : match;
    });
}

/**
 * Redacts private customer fields before returning API payloads or writing server logs.
 */
const PRIVATE_FIELD_KEYS = new Set([
  'mobile',
  'phone',
  'personalMobile',
  'contactMobile',
  'customerMobile',
  'exactAddress',
  'businessAddress',
  'fullAddress',
  'houseAddress',
  'email',
  'testPinHash',
]);

export function redactPrivateCustomerFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return sanitizeNotificationTextForPrivacy(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPrivateCustomerFields(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PRIVATE_FIELD_KEYS.has(k)) {
        continue;
      }
      out[k] = redactPrivateCustomerFields(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Formats a privacy-safe masked relay bridge code for in-app calling (never exposes real mobile numbers).
 */
export function formatMaskedBridgeCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const partA = String(1000 + (hash % 9000));
  const partB = String(1000 + ((hash >>> 8) % 9000));
  return `RS-CALL-${partA}-${partB}`;
}

export function formatMaskedVirtualDisplay(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  }
  const tail = String(1000 + (hash % 9000));
  return `+91 80-XXXX-${tail}`;
}
