import {
  readJsonBody,
  resolveRouteAction,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
} from '../_utils.js';
import {
  handleAdminDemoNotification,
  handleAdminTargetedBroadcast,
  handleDemoPushDispatch,
  handleExpandJobRadius,
  handleNotificationConfigStatus,
  handleSendCustomerEvent,
  handleSendMatchingJob,
} from '../../src/server/notificationsEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  const action = resolveRouteAction(req, 'notifications');
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

  if (action === 'config-status') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    const result = handleNotificationConfigStatus({
      rootDir: process.cwd(),
      headers: req.headers as Record<string, unknown>,
    });
    sendJson(res, result.httpStatus, result.payload);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = await readJsonBody(req);
  const rootDir = process.cwd();

  switch (action) {
    case 'send-matching-job': {
      const result = await handleSendMatchingJob({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    case 'expand-job-radius': {
      const result = await handleExpandJobRadius({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    case 'send-customer-event': {
      const result = await handleSendCustomerEvent({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    case 'admin-demo': {
      const result = await handleAdminDemoNotification({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    case 'admin-targeted': {
      const result = await handleAdminTargetedBroadcast({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    case 'demo-push': {
      const result = await handleDemoPushDispatch({ authHeader, body, rootDir });
      sendJson(res, result.httpStatus, result.payload);
      return;
    }
    default: {
      sendJson(res, 404, { ok: false, error: 'NOTIFICATION_ENDPOINT_NOT_FOUND' });
    }
  }
}
