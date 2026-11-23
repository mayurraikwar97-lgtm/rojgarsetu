import { readJsonBody, sendJson, type ServerlessRequest, type ServerlessResponse } from '../_utils.js';
import { handleRecordGatewayAttempt } from '../../src/server/paymentReferralEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const body = await readJsonBody(req);
  const out = await handleRecordGatewayAttempt({
    authHeader,
    body,
    rootDir: process.cwd(),
  });
  sendJson(res, out.httpStatus, out.payload);
}
