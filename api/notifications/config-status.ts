import { sendJson, type ServerlessRequest, type ServerlessResponse } from '../_utils.js';

export default function handler(req: ServerlessRequest, res: ServerlessResponse): void {
  const hasVapidKey = Boolean((process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim());
  const serviceJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const hasAdminMessaging = Boolean(serviceJson);
  const canonicalUrl = (process.env.VITE_CANONICAL_APP_URL || process.env.APP_URL || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const httpsActive = forwardedProto.includes('https') || canonicalUrl.startsWith('https://');
  const demoModeEnvEnabled = (process.env.VITE_DEMO_MODE_ENABLED || 'true').trim().toLowerCase() !== 'false';

  const missingSetupItems: string[] = [];
  if (!hasVapidKey) {
    missingSetupItems.push(
      'VITE_FIREBASE_VAPID_KEY is not set in environment variables (required by browsers to subscribe to Web Push).'
    );
  }
  if (!hasAdminMessaging) {
    missingSetupItems.push(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not set in Vercel environment variables (required for server-side FCM push dispatch).'
    );
  }

  sendJson(res, 200, {
    ok: true,
    hasVapidKey,
    hasAdminMessaging,
    adminCredentialMode: hasAdminMessaging ? 'service_account_json' : 'missing',
    projectId: 'gen-lang-client-0174765083',
    databaseId: 'ai-studio-7bd2ffb9-a189-4838-a21e-7da9c4e7b2b7',
    httpsActive,
    demoModeEnvEnabled,
    missingSetupItems,
  });
}
