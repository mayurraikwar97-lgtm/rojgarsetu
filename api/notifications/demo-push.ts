import { readJsonBody, sendJson, type ServerlessRequest, type ServerlessResponse } from '../_utils.js';
import { handleDemoPushDispatch } from '../../src/server/notificationsEngine.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = await readJsonBody(req);
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const result = await handleDemoPushDispatch({
    authHeader,
    body,
    rootDir: process.cwd(),
  });

  sendJson(res, result.httpStatus, result.payload);
}
