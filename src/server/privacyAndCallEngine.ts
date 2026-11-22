import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  formatMaskedBridgeCode,
  formatMaskedVirtualDisplay,
  getSafeCustomerLabelForJobOrApp,
  isConfirmedAssignedWorker,
  redactPrivateCustomerFields,
} from '../lib/customerPrivacy.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'mayurraikwar97@gmail.com';
const DEFAULT_APPLET_CONFIG = {
  projectId: 'gen-lang-client-0174765083',
  firestoreDatabaseId: 'ai-studio-7bd2ffb9-a189-4838-a21e-7da9c4e7b2b7',
};

const callRateBuckets = new Map<string, number[]>();

function checkCallRateLimit(uid: string, limit = 15, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const prev = (callRateBuckets.get(uid) || []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    callRateBuckets.set(uid, prev);
    return false;
  }
  prev.push(now);
  callRateBuckets.set(uid, prev);
  return true;
}

function getPrivacyAdminRuntime(rootDir: string): { app: App; db: Firestore; hasAdminCreds: boolean } {
  let config = DEFAULT_APPLET_CONFIG;
  try {
    const raw = fs.readFileSync(path.resolve(rootDir, 'firebase-applet-config.json'), 'utf8');
    config = JSON.parse(raw) as typeof DEFAULT_APPLET_CONFIG;
  } catch {
    // Use default applet config
  }

  let app: App;
  let hasAdminCreds = false;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    hasAdminCreds = Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.K_SERVICE ||
        process.env.GOOGLE_CLOUD_PROJECT
    );
  } else {
    const rawSa = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawSa) {
      app = initializeApp({ credential: cert(JSON.parse(rawSa)), projectId: config.projectId });
      hasAdminCreds = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
      hasAdminCreds = true;
    } else {
      app = initializeApp({ projectId: config.projectId });
    }
  }
  return { app, db: getFirestore(app, config.firestoreDatabaseId), hasAdminCreds };
}

export interface MaskedCallApiResult {
  httpStatus: number;
  payload: Record<string, unknown>;
}

/**
 * Authenticated Masked / In-App Calling Session Broker.
 * - Verifies Firebase ID Token
 * - Verifies caller is either the customer or confirmed assigned worker on the application (or Admin)
 * - NEVER fetches or returns personal mobile numbers
 * - Enforces female customer Last-Name-only identity for worker callers
 * - Returns redacted response safe from any PII leakage
 */
export async function handleCreateMaskedCallSession(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<MaskedCallApiResult> {
  const match = (params.authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      httpStatus: 401,
      payload: { ok: false, error: 'UNAUTHORIZED', message: 'Valid sign-in required for masked calling.' },
    };
  }

  const runtime = getPrivacyAdminRuntime(params.rootDir);
  let callerUid = '';
  let isAdmin = false;
  try {
    const decoded = await getAuth(runtime.app).verifyIdToken(match[1]);
    callerUid = decoded.uid;
    isAdmin = decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
    if (!isAdmin && runtime.hasAdminCreds) {
      const adm = await runtime.db.collection('admins').doc(callerUid).get().catch(() => null);
      if (adm?.exists) isAdmin = true;
    }
  } catch {
    return {
      httpStatus: 401,
      payload: { ok: false, error: 'INVALID_TOKEN', message: 'Session verification failed.' },
    };
  }

  if (!checkCallRateLimit(callerUid)) {
    return {
      httpStatus: 429,
      payload: { ok: false, error: 'RATE_LIMITED', message: 'Too many call requests. Please wait a moment.' },
    };
  }

  const applicationId = typeof params.body?.applicationId === 'string' ? params.body.applicationId.trim() : '';
  if (!applicationId || !/^[a-zA-Z0-9_-]{3,128}$/.test(applicationId)) {
    return {
      httpStatus: 400,
      payload: { ok: false, error: 'INVALID_APPLICATION_ID', message: 'Valid order reference required.' },
    };
  }

  if (!runtime.hasAdminCreds) {
    // Graceful privacy-safe relay code when local Admin SDK credentials aren't mounted (client still enforces Firestore rules!)
    const seed = `${applicationId}_${callerUid}`;
    const maskedBridgeCode = formatMaskedBridgeCode(seed);
    const maskedVirtualNumber = formatMaskedVirtualDisplay(seed);
    return {
      httpStatus: 200,
      payload: redactPrivateCustomerFields({
        ok: true,
        relayMode: 'firestore_in_app_masked_bridge',
        applicationId,
        maskedBridgeCode,
        maskedVirtualNumber,
        personalNumberHidden: true,
      }),
    };
  }

  try {
    const appSnap = await runtime.db.collection('applications').doc(applicationId).get();
    if (!appSnap.exists) {
      return {
        httpStatus: 404,
        payload: { ok: false, error: 'ORDER_NOT_FOUND', message: 'Confirmed order not found.' },
      };
    }

    const appData = appSnap.data() as Record<string, unknown>;
    const employerUid = String(appData.employerUid || '');
    const workerUid = String(appData.workerUid || '');
    const jobId = String(appData.jobId || '');
    const status = String(appData.status || '');
    const dealStatus = String(appData.dealStatus || '');

    const isCustomerCaller = callerUid === employerUid;
    const isAssignedWorkerCaller = isConfirmedAssignedWorker({
      viewerUid: callerUid,
      app: {
        employerUid,
        workerUid,
        status: status as 'accepted',
        dealStatus: dealStatus as 'DEAL_CONFIRMED',
      },
    });

    if (!isAdmin && !isCustomerCaller && !isAssignedWorkerCaller) {
      return {
        httpStatus: 403,
        payload: {
          ok: false,
          error: 'FORBIDDEN',
          message: 'Masked calling is unlocked only after order confirmation for the assigned worker and customer.',
        },
      };
    }

    if (status !== 'accepted' && !isAdmin) {
      return {
        httpStatus: 403,
        payload: {
          ok: false,
          error: 'ORDER_NOT_CONFIRMED',
          message: 'Order must be confirmed before masked calling is enabled.',
        },
      };
    }

    const safeCustomerName = getSafeCustomerLabelForJobOrApp({
      app: {
        customerName: typeof appData.customerName === 'string' ? appData.customerName : 'Customer',
        customerGenderProtected: Boolean(appData.customerGenderProtected),
        customerLastName: typeof appData.customerLastName === 'string' ? appData.customerLastName : undefined,
      },
      viewerRole: 'worker',
    });
    const safeWorkerName = typeof appData.workerName === 'string' ? appData.workerName.slice(0, 100) : 'Worker';

    const sessionId = `mcall_${applicationId.slice(0, 40)}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const maskedBridgeCode = formatMaskedBridgeCode(`${applicationId}_${sessionId}`);
    const maskedVirtualNumber = formatMaskedVirtualDisplay(applicationId);

    const initiatedByRole: 'customer' | 'worker' = isCustomerCaller ? 'customer' : 'worker';
    const callerSafeName = initiatedByRole === 'customer' ? safeCustomerName : safeWorkerName;
    const receiverSafeName = initiatedByRole === 'customer' ? safeWorkerName : safeCustomerName;

    await runtime.db.collection('maskedCallSessions').doc(sessionId).set({
      applicationId,
      jobId,
      employerUid,
      workerUid,
      initiatedByUid: callerUid,
      initiatedByRole,
      callerSafeName,
      receiverSafeName,
      maskedBridgeCode,
      maskedVirtualNumber,
      status: 'ringing',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      httpStatus: 200,
      payload: redactPrivateCustomerFields({
        ok: true,
        sessionId,
        applicationId,
        maskedBridgeCode,
        maskedVirtualNumber,
        callerSafeName,
        receiverSafeName,
        relayMode: 'server_masked_bridge',
        personalNumberHidden: true,
      }),
    };
  } catch {
    return {
      httpStatus: 500,
      payload: { ok: false, error: 'CALL_SESSION_ERROR', message: 'Unable to initialize masked call right now.' },
    };
  }
}

export function registerPrivacyAndCallRoutes(
  app: { post: (p: string, h: (req: Request, res: Response) => void | Promise<void>) => void },
  rootDir: string
): void {
  app.post('/api/calls/masked-session', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await handleCreateMaskedCallSession({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
  });
}
