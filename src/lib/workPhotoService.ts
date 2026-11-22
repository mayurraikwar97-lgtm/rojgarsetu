import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';

export const MAX_WORK_PHOTOS = 6;
const MAX_INPUT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB source
const MAX_FALLBACK_DATA_URL_LENGTH = 78000; // Safe within Firestore rules (<= 85000 chars)

export interface UploadedWorkPhoto {
  url: string;
  storageMode: 'firebase_storage' | 'firestore_compressed';
  name: string;
}

function isSupportedImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the selected photo file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read the selected photo. Please try again.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Unsupported or corrupted photo format. Please choose a JPG, PNG, or WebP photo.'));
    img.src = src;
  });
}

async function compressImageToBlobAndDataUrl(
  file: File,
  maxDimension: number,
  maxDataUrlChars: number
): Promise<{ blob: Blob; dataUrl: string }> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Only image files (JPG, PNG, WebP) are supported.');
  }
  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new Error('Photo is larger than 10 MB. Please choose a smaller image.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(120, Math.round(img.width * scale));
  const height = Math.max(120, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported in this browser.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.84;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxDataUrlChars && quality > 0.36) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > maxDataUrlChars) {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.max(120, Math.round(width * 0.65));
    smallCanvas.height = Math.max(120, Math.round(height * 0.65));
    const sCtx = smallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
      sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
      dataUrl = smallCanvas.toDataURL('image/jpeg', 0.58);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Could not prepare photo for upload.'));
      },
      'image/jpeg',
      0.84
    );
  });

  return { blob, dataUrl };
}

/**
 * Uploads a customer work photo to Firebase Storage (`work_orders/{ownerUid}/{folder}_{ts}_{rand}.jpg`)
 * using resumable upload with real-time progress reporting (0–100%).
 * Falls back to a compact compressed data URL only if Firebase Storage bucket/CORS is unavailable,
 * so order creation is never blocked.
 */
export async function uploadCustomerWorkPhoto(params: {
  file: File;
  ownerUid: string;
  folder?: 'work' | 'goods';
  onProgress?: (percent: number) => void;
}): Promise<UploadedWorkPhoto> {
  const { file, ownerUid, folder = 'work', onProgress } = params;
  onProgress?.(10);
  const { blob, dataUrl } = await compressImageToBlobAndDataUrl(
    file,
    1080,
    MAX_FALLBACK_DATA_URL_LENGTH
  );
  onProgress?.(25);

  const safeUid = ownerUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user';
  const rand = Math.random().toString(36).slice(2, 8);
  const storagePath = `work_orders/${safeUid}/${folder}_${Date.now()}_${rand}.jpg`;

  try {
    const storageRef = ref(storage, storagePath);
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=86400',
      });

      const timer = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch {
          // ignore cancel errors
        }
        reject(new Error('STORAGE_TIMEOUT'));
      }, 8500);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.round(25 + (snapshot.bytesTransferred / snapshot.totalBytes) * 70);
            onProgress?.(Math.min(95, pct));
          }
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
        () => {
          clearTimeout(timer);
          getDownloadURL(uploadTask.snapshot.ref)
            .then((url) => resolve(url))
            .catch(reject);
        }
      );
    });

    if (downloadUrl && downloadUrl.startsWith('http')) {
      onProgress?.(100);
      return {
        url: downloadUrl,
        storageMode: 'firebase_storage',
        name: file.name,
      };
    }
  } catch (err) {
    console.warn('Firebase Storage upload unavailable, using compressed inline photo fallback:', err);
  }

  // Fallback compact data URL guaranteed to stay under Firestore rules size cap
  onProgress?.(85);
  const compact =
    dataUrl.length <= MAX_FALLBACK_DATA_URL_LENGTH
      ? dataUrl
      : (await compressImageToBlobAndDataUrl(file, 480, MAX_FALLBACK_DATA_URL_LENGTH)).dataUrl;

  onProgress?.(100);
  return {
    url: compact.slice(0, MAX_FALLBACK_DATA_URL_LENGTH),
    storageMode: 'firestore_compressed',
    name: file.name,
  };
}

export function getJobPhotoUrls(job?: {
  workPhotoUrls?: string[];
  photoAttachment?: string;
} | null): string[] {
  if (!job) return [];
  const list: string[] = [];
  if (Array.isArray(job.workPhotoUrls)) {
    for (const u of job.workPhotoUrls) {
      if (typeof u === 'string' && u.trim() && !list.includes(u.trim())) {
        list.push(u.trim());
      }
    }
  }
  if (typeof job.photoAttachment === 'string' && job.photoAttachment.trim()) {
    if (!list.includes(job.photoAttachment.trim())) {
      list.unshift(job.photoAttachment.trim());
    }
  }
  return list.slice(0, MAX_WORK_PHOTOS);
}
