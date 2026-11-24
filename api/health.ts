import type { ServerlessRequest, ServerlessResponse } from './_utils.js';
import { getQueryParam, sendJson } from './_utils.js';
import { getOtpPublicConfig } from '../src/server/otpEngine.js';

export default function handler(req: ServerlessRequest, res: ServerlessResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const mode = getQueryParam(req, 'mode').toLowerCase();
  const otp = getOtpPublicConfig();

  if (mode === 'public-config') {
    const mapsApiKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
    const firebaseVapidKey = (process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim();
    sendJson(res, 200, {
      mapsApiKey,
      firebaseVapidKey,
      smsGatewayConfigured: otp.smsProviderConfigured,
      otp,
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    service: 'rojgar-setu',
    runtime: 'vercel-serverless',
    otp,
    timestamp: new Date().toISOString(),
  });
}
