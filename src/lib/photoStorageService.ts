import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AcceptedCustomerPhotoRecord, ProfilePhotoRecord } from '../types/domain';
import {
  ALLOWED_PHOTO_EXTENSIONS,
  ALLOWED_PHOTO_MIME_TYPES,
  type AllowedPhotoMimeType,
  buildAcceptedApplicationGrantId,
  buildAcceptedDemoOrderGrantId,
  buildCustomerPhotoDocId,
  buildDemoUserPhotoDocId,
  buildWorkerPhotoDocId,
  isCustomerPhotoVisibleForJobStatus,
  MAX_PROFILE_PHOTO_BYTES,
  MAX_STORED_PHOTO_CHARS,
  type PhotoValidationErrorCode,
  type PhotoValidationResult,
  validateProfilePhotoFile,
} from './photoValidation';

export {
  ALLOWED_PHOTO_EXTENSIONS,
  ALLOWED_PHOTO_MIME_TYPES,
  type AllowedPhotoMimeType,
  buildAcceptedApplicationGrantId,
  buildAcceptedDemoOrderGrantId,
  buildCustomerPhotoDocId,
  buildDemoUserPhotoDocId,
  buildWorkerPhotoDocId,
  isCustomerPhotoVisibleForJobStatus,
  MAX_PROFILE_PHOTO_BYTES,
  MAX_STORED_PHOTO_CHARS,
  type PhotoValidationErrorCode,
  type PhotoValidationResult,
  validateProfilePhotoFile,
};

export interface ProcessedProfilePhoto {
  photoData: string;
  mimeType: AllowedPhotoMimeType;
  sizeBytes: number;
}

export async function processProfilePhotoFile(file: File): Promise<ProcessedProfilePhoto> {
  const validation = validateProfilePhotoFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!validation.ok) {
    throw new Error(validation.code);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('IMAGE_READ_FAILED'));
      }
    };
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('INVALID_IMAGE_DATA'));
    el.src = dataUrl;
  });

  const maxDimension = 384;
  const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
  const targetWidth = Math.max(1, Math.round((img.width || maxDimension) * scale));
  const targetHeight = Math.max(1, Math.round((img.height || maxDimension) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const outputMime: AllowedPhotoMimeType =
    validation.mimeType === 'image/png' ? 'image/webp' : validation.mimeType;

  let encoded = canvas.toDataURL(outputMime, 0.84);
  if (!encoded.startsWith('data:image/')) {
    encoded = canvas.toDataURL('image/jpeg', 0.84);
  }

  const qualities = [0.76, 0.66, 0.54, 0.44];
  for (const q of qualities) {
    if (encoded.length <= MAX_STORED_PHOTO_CHARS) break;
    encoded = canvas.toDataURL('image/jpeg', q);
  }

  if (encoded.length > MAX_STORED_PHOTO_CHARS) {
    throw new Error('COMPRESSED_PHOTO_TOO_LARGE');
  }

  const finalMime: AllowedPhotoMimeType = encoded.startsWith('data:image/webp')
    ? 'image/webp'
    : encoded.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

  return {
    photoData: encoded,
    mimeType: finalMime,
    sizeBytes: file.size,
  };
}

// Scoped in-memory cache keyed by active Firebase Auth UID so different signed-in users never share cached reads
const photoCache = new Map<string, string | null>();
const inflightRequests = new Map<string, Promise<string | null>>();
const listeners = new Set<(key: string) => void>();

function scopedKey(kind: 'profile' | 'grant', id: string): string {
  const viewerUid = auth.currentUser?.uid || 'anon';
  return `${viewerUid}:${kind}:${id}`;
}

export function subscribePhotoCacheUpdates(cb: (key: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyPhotoUpdate(id: string): void {
  for (const cb of listeners) {
    cb(id);
  }
}

export function clearPhotoCache(): void {
  photoCache.clear();
  inflightRequests.clear();
}

export async function uploadProfilePhotoRecord(params: {
  photoId: string;
  ownerUid: string;
  subjectId: string;
  role: 'worker' | 'customer';
  mimeType: AllowedPhotoMimeType;
  sizeBytes: number;
  photoData: string;
}): Promise<string> {
  const ref = doc(db, 'profilePhotos', params.photoId);
  const existingSnap = await getDoc(ref);
  const createdAtValue = existingSnap.exists()
    ? (existingSnap.data() as ProfilePhotoRecord).createdAt || serverTimestamp()
    : serverTimestamp();

  const payload: ProfilePhotoRecord = {
    ownerUid: params.ownerUid,
    subjectId: params.subjectId,
    role: params.role,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    photoData: params.photoData,
    createdAt: createdAtValue,
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  photoCache.set(scopedKey('profile', params.photoId), params.photoData);
  notifyPhotoUpdate(params.photoId);
  return params.photoId;
}

export async function deleteProfilePhotoRecord(photoId: string): Promise<void> {
  if (!photoId) return;
  try {
    await deleteDoc(doc(db, 'profilePhotos', photoId));
  } catch {
    // Ignore missing document errors
  }
  photoCache.delete(scopedKey('profile', photoId));
  notifyPhotoUpdate(photoId);
}

export async function fetchProfilePhotoData(photoId: string): Promise<string | null> {
  if (!photoId || !auth.currentUser) return null;
  const key = scopedKey('profile', photoId);
  if (photoCache.has(key)) {
    return photoCache.get(key) ?? null;
  }
  const pending = inflightRequests.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      const snap = await getDoc(doc(db, 'profilePhotos', photoId));
      const val = snap.exists() ? ((snap.data() as ProfilePhotoRecord).photoData || null) : null;
      photoCache.set(key, val);
      return val;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, task);
  return task;
}

export async function grantAcceptedCustomerPhoto(params: {
  customerUid: string;
  workerUid: string;
  sourceType: 'job_application' | 'demo_work_order';
  sourceId: string;
  customerPhotoDocId: string;
}): Promise<boolean> {
  if (!params.customerUid || !params.workerUid || !params.sourceId || !params.customerPhotoDocId) {
    return false;
  }
  try {
    const photoData = await fetchProfilePhotoData(params.customerPhotoDocId);
    if (!photoData) return false;

    const grantId =
      params.sourceType === 'job_application'
        ? buildAcceptedApplicationGrantId(params.sourceId)
        : buildAcceptedDemoOrderGrantId(params.sourceId);

    const grantRef = doc(db, 'acceptedCustomerPhotos', grantId);
    const existing = await getDoc(grantRef);
    const payload: AcceptedCustomerPhotoRecord = {
      ownerUid: params.customerUid,
      workerUid: params.workerUid,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      photoData,
      createdAt: existing.exists()
        ? (existing.data() as AcceptedCustomerPhotoRecord).createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(grantRef, payload);
    photoCache.set(scopedKey('grant', grantId), photoData);
    notifyPhotoUpdate(grantId);
    return true;
  } catch {
    return false;
  }
}

export async function fetchAcceptedCustomerPhotoData(grantId: string): Promise<string | null> {
  if (!grantId || !auth.currentUser) return null;
  const key = scopedKey('grant', grantId);
  if (photoCache.has(key)) {
    return photoCache.get(key) ?? null;
  }
  const pending = inflightRequests.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      const snap = await getDoc(doc(db, 'acceptedCustomerPhotos', grantId));
      const val = snap.exists()
        ? ((snap.data() as AcceptedCustomerPhotoRecord).photoData || null)
        : null;
      photoCache.set(key, val);
      return val;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, task);
  return task;
}
