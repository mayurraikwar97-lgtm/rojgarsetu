/**
 * Unified foreground & background-click notification deduplication registry.
 * Prevents duplicate WhatsApp-style banners and double audio/voice playback when:
 *   1. Both FCM onMessage (foreground push) and Firestore realtime listener fire for the same alert.
 *   2. A user taps an OS background notification and opens/focuses the app.
 */

const DISPLAY_TTL_MS = 2 * 60 * 1000; // 2 minutes
const CLICK_SUPPRESS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'rs_notif_dedupe_v1';

interface DedupeEntry {
  key: string;
  expiresAt: number;
  kind: 'shown' | 'clicked';
}

const memoryCache = new Map<string, DedupeEntry>();

function pruneExpired(now: number): void {
  for (const [k, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(k);
    }
  }
}

function hydrateFromSessionStorage(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DedupeEntry[];
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const item of parsed) {
      if (item && typeof item.key === 'string' && typeof item.expiresAt === 'number' && item.expiresAt > now) {
        const existing = memoryCache.get(item.key);
        if (!existing || existing.expiresAt < item.expiresAt) {
          memoryCache.set(item.key, item);
        }
      }
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function persistToSessionStorage(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const now = Date.now();
    pruneExpired(now);
    const list = Array.from(memoryCache.values()).slice(-80);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

hydrateFromSessionStorage();

function normalizePart(v?: string | null): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

/**
 * Generates all candidate dedupe keys for a notification payload so FCM messages
 * and Firestore notification docs match even if one only has dedupeKey or jobId+title.
 */
export function buildNotificationDedupeKeys(input: {
  notificationId?: string | null;
  dedupeKey?: string | null;
  jobId?: string | null;
  demoJobId?: string | null;
  eventType?: string | null;
  title?: string | null;
  body?: string | null;
}): string[] {
  const keys: string[] = [];
  const notifId = normalizePart(input.notificationId);
  const dedupeKey = normalizePart(input.dedupeKey);

  if (notifId) keys.push(`id:${notifId}`);
  if (dedupeKey) keys.push(`dk:${dedupeKey}`);

  // Deterministic docId in notificationsEngine strips non-[a-zA-Z0-9_-] from dedupeKey
  if (dedupeKey) {
    const safeId = dedupeKey.replace(/[^a-z0-9_-]/g, '');
    if (safeId && safeId !== notifId) {
      keys.push(`id:${safeId}`);
    }
  }

  const titleNorm = normalizePart(input.title);
  const bodyNorm = normalizePart(input.body);
  const jobNorm = normalizePart(input.jobId || input.demoJobId);
  const eventNorm = normalizePart(input.eventType);

  if (titleNorm || bodyNorm) {
    keys.push(`sig:${eventNorm}|${jobNorm}|${titleNorm}|${bodyNorm.slice(0, 80)}`);
  }

  return Array.from(new Set(keys));
}

/**
 * Returns true if this notification was already displayed or opened from a background push.
 */
export function isNotificationAlreadyHandled(keys: string[]): boolean {
  const now = Date.now();
  pruneExpired(now);
  for (const k of keys) {
    const entry = memoryCache.get(k);
    if (entry && entry.expiresAt > now) {
      return true;
    }
  }
  return false;
}

/**
 * Records notification keys as recently shown in the foreground top alert banner.
 */
export function markNotificationShown(keys: string[]): void {
  const now = Date.now();
  const expiresAt = now + DISPLAY_TTL_MS;
  for (const k of keys) {
    const prev = memoryCache.get(k);
    if (!prev || prev.expiresAt < expiresAt) {
      memoryCache.set(k, { key: k, expiresAt, kind: 'shown' });
    }
  }
  persistToSessionStorage();
}

/**
 * Records notification keys as opened via an OS background push click so that
 * opening/focusing the app does not re-pop a duplicate top banner.
 */
export function markBackgroundNotificationClicked(keys: string[]): void {
  const now = Date.now();
  const expiresAt = now + CLICK_SUPPRESS_TTL_MS;
  for (const k of keys) {
    memoryCache.set(k, { key: k, expiresAt, kind: 'clicked' });
  }
  persistToSessionStorage();
}
