import {
  extractClientIp,
  readJsonBody,
  resolveRouteAction,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
} from '../_utils.js';
import { getOtpPublicConfig, handleOtpRequest, handleOtpVerify } from '../../src/server/otpEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const action = resolveRouteAction(req, 'otp');

  switch (action) {
    case 'config': {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      sendJson(res, 200, getOtpPublicConfig());
      return;
    }

    case 'request': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST for OTP requests.' });
        return;
      }
      const body = await readJsonBody(req);
      const result = await handleOtpRequest(body, extractClientIp(req));
      sendJson(res, result.status, result.body);
      return;
    }

    case 'verify': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { verified: false, error: 'METHOD_NOT_ALLOWED', message: 'Use POST for OTP verification.' });
        return;
      }
      const body = await readJsonBody(req);
      const result = await handleOtpVerify(body, extractClientIp(req));
      sendJson(res, result.status, result.body);
      return;
    }

    default: {
      sendJson(res, 404, { ok: false, error: 'OTP_ENDPOINT_NOT_FOUND' });
    }
  }
}
