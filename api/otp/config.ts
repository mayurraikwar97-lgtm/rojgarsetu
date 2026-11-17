import type { ServerlessRequest, ServerlessResponse } from '../_utils.ts';
import { sendJson } from '../_utils.ts';
import { getOtpPublicConfig } from '../../src/server/otpEngine.ts';

export default function handler(req: ServerlessRequest, res: ServerlessResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  sendJson(res, 200, getOtpPublicConfig());
}
