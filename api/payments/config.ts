import { sendJson, type ServerlessRequest, type ServerlessResponse } from '../_utils.js';
import { handlePaymentConfig } from '../../src/server/paymentReferralEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const out = handlePaymentConfig();
  sendJson(res, out.httpStatus, out.payload);
}
