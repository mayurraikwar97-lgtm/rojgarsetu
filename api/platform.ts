import {
  getQueryParam,
  readJsonBody,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
} from './_utils.js';
import {
  handleEvaluateReferralEligibility,
  validateAdTrackingPayload,
  type AdEventValidationInput,
} from '../src/server/adsAndReferralsEngine.js';
import { handleRunDemoVerification } from '../src/server/paymentReferralEngine.js';
import { handleCreateMaskedCallSession } from '../src/server/privacyAndCallEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const action = getQueryParam(req, 'action').toLowerCase();
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const rootDir = process.cwd();

  switch (action) {
    case 'referrals-evaluate-eligibility': {
      const body = await readJsonBody(req);
      const out = await handleEvaluateReferralEligibility({
        authHeader,
        body,
        rootDir,
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'ads-validate-event': {
      const body = await readJsonBody(req);
      const ua = String(req.headers['user-agent'] || '');
      const result = validateAdTrackingPayload(body as unknown as AdEventValidationInput, ua);
      const status = result.allowed || result.deduped ? 200 : 400;
      sendJson(res, status, result as unknown as Record<string, unknown>);
      return;
    }

    case 'calls-masked-session': {
      const body = await readJsonBody(req);
      const out = await handleCreateMaskedCallSession({
        authHeader,
        body,
        rootDir,
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    case 'admin-run-demo-verification': {
      const out = await handleRunDemoVerification({
        authHeader,
        rootDir,
      });
      sendJson(res, out.httpStatus, out.payload);
      return;
    }

    default: {
      sendJson(res, 404, { ok: false, error: 'PLATFORM_ENDPOINT_NOT_FOUND' });
    }
  }
}
