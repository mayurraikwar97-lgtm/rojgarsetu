import { readRawBody, sendJson, type ServerlessRequest, type ServerlessResponse } from '../_utils.js';
import { handleRazorpayWebhook } from '../../src/server/paymentReferralEngine.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const rawBody = await readRawBody(req);
  const sigHeader =
    typeof req.headers['x-razorpay-signature'] === 'string'
      ? req.headers['x-razorpay-signature']
      : '';
  const out = await handleRazorpayWebhook({
    rawBody,
    signatureHeader: sigHeader,
    rootDir: process.cwd(),
  });
  sendJson(res, out.httpStatus, out.payload);
}
