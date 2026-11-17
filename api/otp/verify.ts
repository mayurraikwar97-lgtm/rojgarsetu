import type { ServerlessRequest, ServerlessResponse } from '../_utils.ts';
import { extractClientIp, readJsonBody, sendJson } from '../_utils.ts';
import { handleOtpVerify } from '../../src/server/otpEngine.ts';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { verified: false, error: 'METHOD_NOT_ALLOWED', message: 'Use POST for OTP verification.' });
    return;
  }

  const body = await readJsonBody(req);
  const result = await handleOtpVerify(body, extractClientIp(req));
  sendJson(res, result.status, result.body);
}
