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

export function getFirebaseVapidKey(): string {
  return (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
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
