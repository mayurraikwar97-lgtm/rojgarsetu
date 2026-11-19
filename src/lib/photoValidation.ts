export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_STORED_PHOTO_CHARS = 450_000;

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export type PhotoValidationErrorCode = 'EMPTY_FILE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE';

export type PhotoValidationResult =
  | { ok: true; mimeType: AllowedPhotoMimeType }
  | { ok: false; code: PhotoValidationErrorCode };

const EXTENSION_TO_MIME: Record<string, AllowedPhotoMimeType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function validateProfilePhotoFile(file: {
  name: string;
  type: string;
  size: number;
}): PhotoValidationResult {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, code: 'EMPTY_FILE' };
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return { ok: false, code: 'FILE_TOO_LARGE' };
  }

  const lowerName = (file.name || '').toLowerCase().trim();
  const matchedExt = ALLOWED_PHOTO_EXTENSIONS.find((ext) => lowerName.endsWith(ext));
  const rawType = (file.type || '').toLowerCase().trim();
  const normalizedType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;

  const isValidMime = (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(normalizedType);

  if (rawType && !isValidMime) {
    return { ok: false, code: 'INVALID_TYPE' };
  }
  if (!matchedExt && !isValidMime) {
    return { ok: false, code: 'INVALID_TYPE' };
  }

  const resolvedMime: AllowedPhotoMimeType = isValidMime
    ? (normalizedType as AllowedPhotoMimeType)
    : matchedExt
      ? EXTENSION_TO_MIME[matchedExt]
      : 'image/jpeg';

  return { ok: true, mimeType: resolvedMime };
}

export function buildWorkerPhotoDocId(uid: string): string {
  return `wrk_${uid}`;
}

export function buildCustomerPhotoDocId(uid: string): string {
  return `cust_${uid}`;
}

export function buildDemoUserPhotoDocId(demoUserId: string): string {
  return `demo_${demoUserId}`;
}

export function buildAcceptedApplicationGrantId(applicationId: string): string {
  return `app_${applicationId}`;
}

export function buildAcceptedDemoOrderGrantId(orderId: string): string {
  return `demo_${orderId}`;
}

/**
 * Customer photo MUST NOT be visible unless an accepted/in-progress/completed job exists.
 */
export function isCustomerPhotoVisibleForJobStatus(status?: string | null): boolean {
  if (!status) return false;
  return (
    status === 'accepted' ||
    status === 'customer_confirmed' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'closed' ||
    status === 'work_completed'
  );
}
