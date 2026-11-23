import {
  readJsonBody,
  resolveRouteAction,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
} from '../_utils.js';
import {
  handleCreatePaymentOrder,
  handlePaymentConfig,
  handleRecordGatewayAttempt,
  handleValidateUpiUtr,
  handleVerifyGatewayPayment,
} from '../../src/server/paymentReferralEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  const action = resolveRouteAction(req, 'payments');
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

  switch (action) {
    case 'config': {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const out = handlePaymentConfig();
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'create-order': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const body = await readJsonBody(req);
      const out = await handleCreatePaymentOrder({
        authHeader,
        body,
        rootDir: process.cwd(),
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'verify-gateway': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { verified: false, error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const body = await readJsonBody(req);
      const out = await handleVerifyGatewayPayment({
        authHeader,
        body,
        rootDir: process.cwd(),
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'record-attempt': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const body = await readJsonBody(req);
      const out = await handleRecordGatewayAttempt({
        authHeader,
        body,
        rootDir: process.cwd(),
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'validate-upi-utr': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { valid: false, error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const body = await readJsonBody(req);
      const out = await handleValidateUpiUtr({
        authHeader,
        body,
        rootDir: process.cwd(),
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    default: {
      sendJson(res, 404, { ok: false, error: 'PAYMENT_ENDPOINT_NOT_FOUND' });
    }
  }
}
