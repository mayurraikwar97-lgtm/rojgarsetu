import type { PageRoute } from '../types/domain';

export function getCanonicalAppUrl(): string {
  const configured = (import.meta.env.VITE_CANONICAL_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

let runtimeVapidKeyCache: string | null = null;
let runtimeVapidKeyPromise: Promise<string> | null = null;

export function getFirebaseVapidKey(): string {
  const buildTime = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  if (buildTime) return buildTime;
  return runtimeVapidKeyCache || '';
}

export async function resolveFirebaseVapidKey(): Promise<string> {
  const immediate = getFirebaseVapidKey();
  if (immediate) return immediate;
  if (runtimeVapidKeyCache !== null) return runtimeVapidKeyCache;
  if (!runtimeVapidKeyPromise) {
    runtimeVapidKeyPromise = fetch('/api/public-config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { firebaseVapidKey?: string } | null) => {
        const key = typeof data?.firebaseVapidKey === 'string' ? data.firebaseVapidKey.trim() : '';
        runtimeVapidKeyCache = key;
        return key;
      })
      .catch(() => {
        runtimeVapidKeyCache = '';
        return '';
      })
      .finally(() => {
        runtimeVapidKeyPromise = null;
      });
  }
  return runtimeVapidKeyPromise;
}

export function buildDeepLinkPath(params: {
  route: PageRoute;
  jobId?: string;
  demoJobId?: string;
  category?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('route', params.route);
  if (params.jobId) qs.set('jobId', params.jobId);
  if (params.demoJobId) qs.set('demoJobId', params.demoJobId);
  if (params.category) qs.set('category', params.category);
  return `/?${qs.toString()}`;
}

export function buildCanonicalDeepLink(params: {
  route: PageRoute;
  jobId?: string;
  demoJobId?: string;
  category?: string;
}): string {
  const base = getCanonicalAppUrl();
  const rel = buildDeepLinkPath(params);
  return base ? `${base}${rel}` : rel;
}
