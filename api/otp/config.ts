import type { ServerlessRequest, ServerlessResponse } from '../_utils.js';
import { sendJson } from '../_utils.js';
import { getOtpPublicConfig } from '../../src/server/otpEngine.js';

export default function handler(req: ServerlessRequest, res: ServerlessResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  sendJson(res, 200, getOtpPublicConfig());
}
