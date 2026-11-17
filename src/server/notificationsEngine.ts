import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';
import { calculateDistanceKm } from '../data/indiaLocations.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'mayurraikwar97@gmail.com';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
  messagingSenderId?: string;
}

type CredentialMode = 'service_account_json' | 'google_application_credentials' | 'cloud_run_adc' | 'unconfigured';

interface AdminRuntime {
  app: App;
  db: Firestore;
  messaging: Messaging;
  credentialMode: CredentialMode;
  hasMessagingCredentials: boolean;
  config: FirebaseAppletConfig;
}

let cachedRuntime: AdminRuntime | null = null;
const rateBuckets = new Map<string, number[]>();

function loadAppletConfig(rootDir: string): FirebaseAppletConfig {
  const raw = fs.readFileSync(path.resolve(rootDir, 'firebase-applet-config.json'), 'utf8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

function checkRateLimit(uid: string, limit = 25, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const prev = (rateBuckets.get(uid) || []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    rateBuckets.set(uid, prev);
    return false;
  }
  prev.push(now);
  rateBuckets.set(uid, prev);
  return true;
}

function getAdminRuntime(rootDir: string): AdminRuntime {
  if (cachedRuntime) return cachedRuntime;

  const config = loadAppletConfig(rootDir);
  let credentialMode: CredentialMode = 'unconfigured';
  let hasMessagingCredentials = false;
  let app: App;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) credentialMode = 'service_account_json';
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credentialMode = 'google_application_credentials';
    else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) credentialMode = 'cloud_run_adc';
    hasMessagingCredentials = credentialMode !== 'unconfigured';
  } else {
    const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawServiceAccount) {
      try {
        const parsed = JSON.parse(rawServiceAccount);
        app = initializeApp({
          credential: cert(parsed),
          projectId: config.projectId,
        });
        credentialMode = 'service_account_json';
        hasMessagingCredentials = true;
      } catch (err) {
        console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON format:', err);
        app = initializeApp({ projectId: config.projectId });
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId,
      });
      credentialMode = 'google_application_credentials';
      hasMessagingCredentials = true;
    } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId,
      });
      credentialMode = 'cloud_run_adc';
      hasMessagingCredentials = true;
    } else {
      app = initializeApp({ projectId: config.projectId });
    }
  }

  const db = getFirestore(app, config.firestoreDatabaseId);
  const messaging = getMessaging(app);
  cachedRuntime = {
    app,
    db,
    messaging,
    credentialMode,
    hasMessagingCredentials,
    config,
  };
  return cachedRuntime;
}

async function verifyRequestUser(
  req: Request,
  runtime: AdminRuntime
): Promise<{ decoded: DecodedIdToken; isAdmin: boolean } | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await getAuth(runtime.app).verifyIdToken(match[1]);
    let isAdmin = decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
    if (!isAdmin && runtime.hasMessagingCredentials) {
      try {
        const adminSnap = await runtime.db.collection('admins').doc(decoded.uid).get();
        if (adminSnap.exists) isAdmin = true;
      } catch {
        // Ignore if Firestore admin lookup lacks IAM permissions
      }
    }
    return { decoded, isAdmin };
  } catch (err) {
    console.warn('ID token verification failed:', err);
    return null;
  }
}

function getLanguageOrDefault(val: unknown): 'en' | 'hi' | 'mr' {
  return val === 'hi' || val === 'mr' ? val : 'en';
}

function buildLocalizedJobMessage(params: {
  lang: 'en' | 'hi' | 'mr';
  title: string;
  category: string;
  district: string;
  offeredWage: number;
  wageUnit: string;
  isDemo?: boolean;
}): { title: string; body: string } {
  const prefix = params.isDemo ? '[DEMO] ' : '';
  const wagePart = params.offeredWage > 0 ? `₹${params.offeredWage}/${params.wageUnit}` : '';

  if (params.lang === 'mr') {
    return {
      title: `${prefix}नवीन काम: ${params.title}`,
      body: `${params.category} · ${params.district}${wagePart ? ` · ${wagePart}` : ''}. तपशील पाहण्यासाठी क्लिक करा.`,
    };
  }
  if (params.lang === 'hi') {
    return {
      title: `${prefix}नया काम: ${params.title}`,
      body: `${params.category} · ${params.district}${wagePart ? ` · ${wagePart}` : ''}. विवरण देखने के लिए टैप करें।`,
    };
  }
  return {
    title: `${prefix}New Job Match: ${params.title}`,
    body: `${params.category} · ${params.district}${wagePart ? ` · ${wagePart}` : ''}. Tap to view & apply.`,
  };
}

function buildLocalizedCustomerEventMessage(params: {
  lang: 'en' | 'hi' | 'mr';
  eventType: string;
  workerName: string;
  jobTitle: string;
  proposedWage?: number;
}): { title: string; body: string } {
  const { lang, eventType, workerName, jobTitle, proposedWage } = params;
  const safeName = workerName || 'Worker';
  const safeJob = jobTitle || 'Work Request';

  if (lang === 'mr') {
    switch (eventType) {
      case 'worker_quotation':
        return {
          title: `नवीन दर प्रस्ताव: ${safeJob}`,
          body: `${safeName} यांनी ₹${proposedWage || 0} दरासह प्रस्ताव पाठवला आहे.`,
        };
      case 'booking_accepted':
        return {
          title: `बुकिंग स्वीकारली: ${safeJob}`,
          body: `${safeName} यांनी तुमचे काम स्वीकारले आहे.`,
        };
      case 'worker_arrived':
        return {
          title: `कामगार पोहोचले: ${safeJob}`,
          body: `${safeName} कामाच्या ठिकाणी पोहोचले आहेत.`,
        };
      case 'job_completed':
        return {
          title: `काम पूर्ण झाले: ${safeJob}`,
          body: `${safeJob} पूर्ण झाले आहे. डॅशबोर्डवर रेटिंग द्या.`,
        };
      case 'booking_cancelled':
        return {
          title: `बुकिंग रद्द: ${safeJob}`,
          body: `${safeJob} साठीची बुकिंग अद्ययावत झाली आहे.`,
        };
      default:
        return {
          title: `नवीन कामगार अर्ज: ${safeJob}`,
          body: `${safeName} यांनी तुमच्या कामासाठी अर्ज केला आहे.`,
        };
    }
  }

  if (lang === 'hi') {
    switch (eventType) {
      case 'worker_quotation':
        return {
          title: `नया वेतन प्रस्ताव: ${safeJob}`,
          body: `${safeName} ने ₹${proposedWage || 0} का कोटेशन भेजा है।`,
        };
      case 'booking_accepted':
        return {
          title: `बुकिंग स्वीकृत: ${safeJob}`,
          body: `${safeName} ने आपका कार्य अनुरोध स्वीकार कर लिया है।`,
        };
      case 'worker_arrived':
        return {
          title: `कामगार पहुंचे: ${safeJob}`,
          body: `${safeName} कार्य स्थल पर पहुंच गए हैं।`,
        };
      case 'job_completed':
        return {
          title: `कार्य पूर्ण: ${safeJob}`,
          body: `${safeJob} पूर्ण हो गया है। कृपया डैशबोर्ड पर रेटिंग दें।`,
        };
      case 'booking_cancelled':
        return {
          title: `बुकिंग अपडेट: ${safeJob}`,
          body: `${safeJob} की बुकिंग स्थिति बदल दी गई है।`,
        };
      default:
        return {
          title: `नया कामगार आवेदन: ${safeJob}`,
          body: `${safeName} ने आपके काम के लिए आवेदन किया है।`,
        };
    }
  }

  switch (eventType) {
    case 'worker_quotation':
      return {
        title: `New Quotation: ${safeJob}`,
        body: `${safeName} submitted a proposed rate of ₹${proposedWage || 0}.`,
      };
    case 'booking_accepted':
      return {
        title: `Booking Accepted: ${safeJob}`,
        body: `${safeName} accepted your work/transport booking.`,
      };
    case 'worker_arrived':
      return {
        title: `Worker Arrival Update: ${safeJob}`,
        body: `${safeName} has arrived at the worksite.`,
      };
    case 'job_completed':
      return {
        title: `Job Completed: ${safeJob}`,
        body: `${safeJob} is marked complete. Rate your experience in the dashboard.`,
      };
    case 'booking_cancelled':
      return {
        title: `Booking Cancelled: ${safeJob}`,
        body: `Booking status for ${safeJob} has been updated.`,
      };
    default:
      return {
        title: `New Worker Application: ${safeJob}`,
        body: `${safeName} applied for your requirement.`,
      };
  }
}

interface DeliveryTarget {
  uid: string;
  label: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  isDemo: boolean;
  language: 'en' | 'hi' | 'mr';
  tokens: Array<{ docId: string; token: string }>;
  title: string;
  body: string;
  category: 'matchingJobs' | 'nearbyJobs' | 'applicationUpdates' | 'bookingNotifications' | 'announcements';
  targetRoute: string;
  targetJobId?: string;
  targetDemoJobId?: string;
  clickUrl: string;
  dedupeKey: string;
}

async function dispatchAndRecordTargets(params: {
  runtime: AdminRuntime;
  targets: DeliveryTarget[];
  sentByUid: string;
}): Promise<{
  ok: boolean;
  errorCode?: string;
  message: string;
  attemptedTokens: number;
  sentCount: number;
  failedCount: number;
  inAppOnlyCount: number;
  errors: Array<{ uid: string; code: string; message: string }>;
}> {
  const { runtime, targets, sentByUid } = params;
  const batchId = `batch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  if (targets.length === 0) {
    return {
      ok: true,
      message: 'No matching recipients found.',
      attemptedTokens: 0,
      sentCount: 0,
      failedCount: 0,
      inAppOnlyCount: 0,
      errors: [],
    };
  }

  let attemptedTokens = 0;
  let sentCount = 0;
  let failedCount = 0;
  let inAppOnlyCount = 0;
  const errors: Array<{ uid: string; code: string; message: string }> = [];

  for (const target of targets) {
    // Deduplication check
    try {
      const dupSnap = await runtime.db
        .collection('notifications')
        .where('recipientUid', '==', target.uid)
        .where('dedupeKey', '==', target.dedupeKey)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        continue;
      }
    } catch {
      // Proceed if query fails due to unconfigured credentials; handled below
    }

    if (target.tokens.length === 0) {
      inAppOnlyCount += 1;
      try {
        await runtime.db.collection('notifications').add({
          recipientUid: target.uid,
          recipientRole: target.role,
          isDemo: target.isDemo,
          category: target.category,
          title: target.title.slice(0, 160),
          body: target.body.slice(0, 500),
          language: target.language,
          targetRoute: target.targetRoute,
          ...(target.targetJobId ? { targetJobId: target.targetJobId } : {}),
          ...(target.targetDemoJobId ? { targetDemoJobId: target.targetDemoJobId } : {}),
          dedupeKey: target.dedupeKey,
          deliveryStatus: 'in_app_only',
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn('Unable to write in-app notification:', err);
      }
      continue;
    }

    if (!runtime.hasMessagingCredentials) {
      failedCount += target.tokens.length;
      attemptedTokens += target.tokens.length;
      const errMsg =
        'Server Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or GCP ADC) are not configured to send real FCM push notifications.';
      errors.push({ uid: target.uid, code: 'ADMIN_CREDENTIALS_MISSING', message: errMsg });
      continue;
    }

    const tokenStrings = target.tokens.map((t) => t.token);
    attemptedTokens += tokenStrings.length;

    try {
      const multicastRes = await runtime.messaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: target.title.slice(0, 140),
          body: target.body.slice(0, 400),
        },
        data: {
          title: target.title.slice(0, 140),
          body: target.body.slice(0, 400),
          clickUrl: target.clickUrl,
          route: target.targetRoute,
          jobId: target.targetJobId || '',
          demoJobId: target.targetDemoJobId || '',
          dedupeKey: target.dedupeKey,
        },
        webpush: {
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          },
          fcmOptions: {
            link: target.clickUrl,
          },
        },
      });

      let targetAnySuccess = false;
      let firstErrorCode = '';
      let firstErrorMsg = '';
      let firstMessageId = '';

      for (let i = 0; i < multicastRes.responses.length; i += 1) {
        const resp = multicastRes.responses[i];
        const tokenMeta = target.tokens[i];
        if (resp.success) {
          sentCount += 1;
          targetAnySuccess = true;
          if (!firstMessageId && resp.messageId) firstMessageId = resp.messageId;
          await runtime.db.collection('notification_delivery_logs').add({
            notificationBatchId: batchId,
            recipientUid: target.uid,
            recipientLabel: target.label.slice(0, 140),
            recipientRole: target.role,
            isDemo: target.isDemo,
            category: target.category,
            title: target.title.slice(0, 160),
            body: target.body.slice(0, 500),
            language: target.language,
            targetUrl: target.clickUrl.slice(0, 300),
            status: 'sent',
            fcmMessageId: resp.messageId || '',
            sentByUid,
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          failedCount += 1;
          const code = resp.error?.code || 'FCM_SEND_FAILED';
          const msg = resp.error?.message || 'Push delivery failed';
          if (!firstErrorCode) firstErrorCode = code;
          if (!firstErrorMsg) firstErrorMsg = msg;
          errors.push({ uid: target.uid, code, message: msg });

          // Deactivate stale/unregistered tokens cleanly
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            await runtime.db
              .collection('device_tokens')
              .doc(tokenMeta.docId)
              .update({
                enabled: false,
                updatedAt: FieldValue.serverTimestamp(),
              })
              .catch(() => undefined);
          }

          await runtime.db.collection('notification_delivery_logs').add({
            notificationBatchId: batchId,
            recipientUid: target.uid,
            recipientLabel: target.label.slice(0, 140),
            recipientRole: target.role,
            isDemo: target.isDemo,
            category: target.category,
            title: target.title.slice(0, 160),
            body: target.body.slice(0, 500),
            language: target.language,
            targetUrl: target.clickUrl.slice(0, 300),
            status: 'failed',
            errorCode: code.slice(0, 120),
            errorMessage: msg.slice(0, 400),
            sentByUid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      await runtime.db.collection('notifications').add({
        recipientUid: target.uid,
        recipientRole: target.role,
        isDemo: target.isDemo,
        category: target.category,
        title: target.title.slice(0, 160),
        body: target.body.slice(0, 500),
        language: target.language,
        targetRoute: target.targetRoute,
        ...(target.targetJobId ? { targetJobId: target.targetJobId } : {}),
        ...(target.targetDemoJobId ? { targetDemoJobId: target.targetDemoJobId } : {}),
        dedupeKey: target.dedupeKey,
        deliveryStatus: targetAnySuccess ? 'sent' : 'failed',
        ...(firstErrorMsg && !targetAnySuccess ? { errorMessage: firstErrorMsg.slice(0, 400) } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'FCM dispatch error';
      failedCount += tokenStrings.length;
      errors.push({ uid: target.uid, code: 'FCM_EXCEPTION', message });
      try {
        await runtime.db.collection('notification_delivery_logs').add({
          notificationBatchId: batchId,
          recipientUid: target.uid,
          recipientLabel: target.label.slice(0, 140),
          recipientRole: target.role,
          isDemo: target.isDemo,
          category: target.category,
          title: target.title.slice(0, 160),
          body: target.body.slice(0, 500),
          language: target.language,
          targetUrl: target.clickUrl.slice(0, 300),
          status: 'failed',
          errorCode: 'FCM_EXCEPTION',
          errorMessage: message.slice(0, 400),
          sentByUid,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // Ignore secondary logging errors
      }
    }
  }

  return {
    ok: failedCount === 0,
    ...(errors.length > 0 && sentCount === 0 ? { errorCode: errors[0].code } : {}),
    message:
      sentCount > 0
        ? `Sent ${sentCount} push notification(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
        : failedCount > 0
        ? errors[0]?.message || 'Push delivery failed.'
        : `Recorded ${inAppOnlyCount} in-app notification(s) (no push device tokens registered yet).`,
    attemptedTokens,
    sentCount,
    failedCount,
    inAppOnlyCount,
    errors,
  };
}

export function registerNotificationRoutes(
  app: { get: (p: string, h: (req: Request, res: Response) => void | Promise<void>) => void; post: (p: string, h: (req: Request, res: Response) => void | Promise<void>) => void },
  rootDir: string
): void {
  const runtime = getAdminRuntime(rootDir);

  // Honest Readiness Checklist Endpoint
  app.get('/api/notifications/config-status', (req: Request, res: Response) => {
    const hasVapidKey = Boolean((process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim());
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
    const httpsActive = req.secure || forwardedProto.includes('https') || req.hostname === 'localhost';

    const missingSetupItems: string[] = [];
    if (!hasVapidKey) {
      missingSetupItems.push(
        'VITE_FIREBASE_VAPID_KEY is not set in environment variables (required by browsers to subscribe to Web Push).'
      );
    }
    if (!runtime.hasMessagingCredentials) {
      missingSetupItems.push(
        'FIREBASE_SERVICE_ACCOUNT_JSON (or Google Application Default Credentials) is not configured on the server for FCM delivery.'
      );
    }

    res.json({
      ok: true,
      hasVapidKey,
      hasAdminMessaging: runtime.hasMessagingCredentials,
      adminCredentialMode: runtime.credentialMode,
      projectId: runtime.config.projectId,
      databaseId: runtime.config.firestoreDatabaseId,
      httpsActive,
      missingSetupItems,
    });
  });

  // Match & Notify Eligible Workers when a Job is Posted
  app.post('/api/notifications/send-matching-job', async (req: Request, res: Response) => {
    const authUser = await verifyRequestUser(req, runtime);
    if (!authUser) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Valid sign-in required.' });
      return;
    }
    if (!checkRateLimit(authUser.decoded.uid)) {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many notification requests. Please wait a few minutes.' });
      return;
    }
    if (!runtime.hasMessagingCredentials) {
      res.status(503).json({
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message: 'Server Firebase Admin credentials are not configured yet to query and dispatch matching notifications.',
      });
      return;
    }

    const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId.trim() : '';
    if (!jobId) {
      res.status(400).json({ error: 'MISSING_JOB_ID' });
      return;
    }

    try {
      const jobSnap = await runtime.db.collection('jobs').doc(jobId).get();
      if (!jobSnap.exists) {
        res.status(404).json({ error: 'JOB_NOT_FOUND' });
        return;
      }
      const job = jobSnap.data()!;
      if (job.employerUid !== authUser.decoded.uid && !authUser.isAdmin) {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }

      const [workersSnap, tokensSnap, prefsSnap] = await Promise.all([
        runtime.db.collection('publicWorkers').get(),
        runtime.db.collection('device_tokens').where('enabled', '==', true).where('isDemo', '==', false).get(),
        runtime.db.collection('notification_preferences').get(),
      ]);

      const prefsByUid = new Map<string, FirebaseFirestore.DocumentData>();
      prefsSnap.docs.forEach((d) => prefsByUid.set(d.id, d.data()));

      const tokensByUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
      tokensSnap.docs.forEach((d) => {
        const data = d.data();
        const list = tokensByUid.get(data.ownerUid) || [];
        list.push({ docId: d.id, token: data.token, preferredLanguage: data.preferredLanguage });
        tokensByUid.set(data.ownerUid, list);
      });

      const jobCatLower = String(job.category || '').toLowerCase();
      const jobSkillsLower = Array.isArray(job.requiredSkills)
        ? job.requiredSkills.map((s: string) => String(s).toLowerCase())
        : [];
      const jobDistrictLower = String(job.district || '').toLowerCase();
      const jobLat = Number(job.lat);
      const jobLng = Number(job.lng);

      const targets: DeliveryTarget[] = [];

      for (const wDoc of workersSnap.docs) {
        const w = wDoc.data();
        if (w.verificationStatus === 'suspended' || w.availabilityStatus === 'offline') continue;
        if (w.ownerUid === job.employerUid) continue;

        const wPrimaryLower = String(w.primarySkill || '').toLowerCase();
        const wSkillsLower = Array.isArray(w.skills)
          ? w.skills.map((s: string) => String(s).toLowerCase())
          : [];

        const skillMatches =
          wPrimaryLower === jobCatLower ||
          wSkillsLower.some((s) => s === jobCatLower || jobSkillsLower.includes(s)) ||
          jobSkillsLower.some((reqSkill) => wPrimaryLower.includes(reqSkill));

        const distKm =
          Number.isFinite(jobLat) &&
          Number.isFinite(jobLng) &&
          Number.isFinite(Number(w.approxLat)) &&
          Number.isFinite(Number(w.approxLng))
            ? calculateDistanceKm(jobLat, jobLng, Number(w.approxLat), Number(w.approxLng))
            : Number.POSITIVE_INFINITY;

        const locationMatches =
          String(w.district || '').toLowerCase() === jobDistrictLower || distKm <= 50;

        if (!skillMatches && !locationMatches) continue;

        const pref = prefsByUid.get(w.ownerUid);
        if (pref && pref.masterEnabled === false) continue;
        if (skillMatches && pref && pref.matchingJobs === false) continue;
        if (!skillMatches && locationMatches && pref && pref.nearbyJobs === false) continue;

        const userTokens = tokensByUid.get(w.ownerUid) || [];
        const lang = getLanguageOrDefault(pref?.preferredLanguage || userTokens[0]?.preferredLanguage);
        const msg = buildLocalizedJobMessage({
          lang,
          title: String(job.title || 'Work Opportunity'),
          category: String(job.category || ''),
          district: String(job.district || ''),
          offeredWage: Number(job.offeredWage) || 0,
          wageUnit: String(job.wageUnit || 'daily'),
          isDemo: false,
        });

        targets.push({
          uid: String(w.ownerUid),
          label: String(w.displayName || 'Worker'),
          role: 'worker',
          isDemo: false,
          language: lang,
          tokens: userTokens.map((t) => ({ docId: t.docId, token: t.token })),
          title: msg.title,
          body: msg.body,
          category: skillMatches ? 'matchingJobs' : 'nearbyJobs',
          targetRoute: 'find-work',
          targetJobId: jobId,
          clickUrl: `/?route=find-work&jobId=${encodeURIComponent(jobId)}`,
          dedupeKey: `job_${jobId}_${w.ownerUid}`,
        });
      }

      const result = await dispatchAndRecordTargets({
        runtime,
        targets: targets.slice(0, 100),
        sentByUid: authUser.decoded.uid,
      });
      res.json({ matchedWorkersCount: targets.length, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Matching notification error';
      res.status(500).json({ ok: false, errorCode: 'SERVER_ERROR', message });
    }
  });

  // Notify Customer on Worker Application, Quotation, Booking Update, or Arrival
  app.post('/api/notifications/send-customer-event', async (req: Request, res: Response) => {
    const authUser = await verifyRequestUser(req, runtime);
    if (!authUser) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!checkRateLimit(authUser.decoded.uid, 40)) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }
    if (!runtime.hasMessagingCredentials) {
      res.status(503).json({
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message: 'Server Firebase Admin credentials are not configured yet for push delivery.',
      });
      return;
    }

    const recipientUid = typeof req.body?.recipientUid === 'string' ? req.body.recipientUid.trim() : '';
    const eventType = typeof req.body?.eventType === 'string' ? req.body.eventType.trim() : 'new_application';
    const workerName = typeof req.body?.workerName === 'string' ? req.body.workerName.trim().slice(0, 100) : '';
    const jobTitle = typeof req.body?.jobTitle === 'string' ? req.body.jobTitle.trim().slice(0, 140) : '';
    const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId.trim() : '';
    const bookingId = typeof req.body?.bookingId === 'string' ? req.body.bookingId.trim() : '';
    const proposedWage = Number(req.body?.proposedWage) || 0;
    const targetRoute = typeof req.body?.targetRoute === 'string' ? req.body.targetRoute : 'employer-dashboard';

    if (!recipientUid) {
      res.status(400).json({ error: 'MISSING_RECIPIENT' });
      return;
    }

    try {
      if (!authUser.isAdmin) {
        const callerUid = authUser.decoded.uid;
        let authorized = false;

        if (jobId) {
          const jobSnap = await runtime.db.collection('jobs').doc(jobId).get();
          if (jobSnap.exists) {
            const jobData = jobSnap.data() as { employerUid?: string };
            if (jobData.employerUid === callerUid) {
              const appSnap = await runtime.db
                .collection('applications')
                .where('jobId', '==', jobId)
                .where('workerUid', '==', recipientUid)
                .limit(1)
                .get();
              authorized = !appSnap.empty;
            } else if (jobData.employerUid === recipientUid) {
              const appSnap = await runtime.db
                .collection('applications')
                .where('jobId', '==', jobId)
                .where('workerUid', '==', callerUid)
                .limit(1)
                .get();
              authorized = !appSnap.empty;
            }
          }
        } else if (bookingId) {
          const bookingSnap = await runtime.db.collection('vehicleBookings').doc(bookingId).get();
          if (bookingSnap.exists) {
            const bData = bookingSnap.data() as { ownerUid?: string; customerUid?: string };
            authorized =
              (bData.ownerUid === callerUid && bData.customerUid === recipientUid) ||
              (bData.customerUid === callerUid && bData.ownerUid === recipientUid);
          }
        }

        if (!authorized) {
          res.status(403).json({
            ok: false,
            errorCode: 'FORBIDDEN',
            message: 'Caller is not authorized to notify this recipient for the specified job or booking.',
          });
          return;
        }
      }

      const [prefSnap, tokenSnap] = await Promise.all([
        runtime.db.collection('notification_preferences').doc(recipientUid).get(),
        runtime.db
          .collection('device_tokens')
          .where('ownerUid', '==', recipientUid)
          .where('enabled', '==', true)
          .get(),
      ]);

      const pref = prefSnap.exists ? prefSnap.data() : undefined;
      if (pref && pref.masterEnabled === false) {
        res.json({ ok: true, skipped: true, message: 'Recipient disabled notifications.' });
        return;
      }

      const lang = getLanguageOrDefault(pref?.preferredLanguage || tokenSnap.docs[0]?.data()?.preferredLanguage);
      const msg = buildLocalizedCustomerEventMessage({
        lang,
        eventType,
        workerName,
        jobTitle,
        proposedWage,
      });

      const target: DeliveryTarget = {
        uid: recipientUid,
        label: 'Customer / Employer',
        role: 'employer',
        isDemo: false,
        language: lang,
        tokens: tokenSnap.docs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
        title: msg.title,
        body: msg.body,
        category: eventType.includes('booking') ? 'bookingNotifications' : 'applicationUpdates',
        targetRoute,
        ...(jobId ? { targetJobId: jobId } : {}),
        clickUrl: `/?route=${encodeURIComponent(targetRoute)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`,
        dedupeKey: `event_${eventType}_${jobId || 'na'}_${Date.now()}`,
      };

      const result = await dispatchAndRecordTargets({
        runtime,
        targets: [target],
        sentByUid: authUser.decoded.uid,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Customer notification failed';
      res.status(500).json({ ok: false, errorCode: 'SERVER_ERROR', message });
    }
  });

  // Admin Live Notification Demo & Audit Endpoint
  app.post('/api/notifications/admin-demo', async (req: Request, res: Response) => {
    const authUser = await verifyRequestUser(req, runtime);
    if (!authUser || !authUser.isAdmin) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Admin privileges required.' });
      return;
    }
    if (!checkRateLimit(authUser.decoded.uid, 50)) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }

    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    const confirmed = req.body?.confirmed === true;
    const customTitle = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 140) : '';
    const customBody = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 400) : '';
    const lang = getLanguageOrDefault(req.body?.language);

    if (!runtime.hasMessagingCredentials) {
      res.status(503).json({
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message:
          'Server Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or Cloud Run ADC) are not configured. No fake push notifications were sent.',
        attemptedTokens: 0,
        sentCount: 0,
        failedCount: 0,
      });
      return;
    }

    try {
      const targets: DeliveryTarget[] = [];

      if (action === 'test_self') {
        const myTokens = await runtime.db
          .collection('device_tokens')
          .where('ownerUid', '==', authUser.decoded.uid)
          .where('enabled', '==', true)
          .get();

        if (myTokens.empty) {
          res.status(400).json({
            ok: false,
            errorCode: 'NO_ADMIN_DEVICE_TOKEN',
            message: 'No enabled device token found for your admin account. Click "Enable Notifications" on this device first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          });
          return;
        }

        targets.push({
          uid: authUser.decoded.uid,
          label: authUser.decoded.email || 'Admin Device',
          role: 'admin',
          isDemo: true,
          language: lang,
          tokens: myTokens.docs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
          title: customTitle || '[DEMO] ROJGAR SETU Push Test',
          body:
            customBody ||
            'Live FCM test confirmed on your registered ROJGAR SETU mobile/browser device.',
          category: 'announcements',
          targetRoute: 'admin',
          clickUrl: '/?route=admin',
          dedupeKey: `admin_self_${Date.now()}`,
        });
      } else if (action === 'test_worker') {
        const targetUid = typeof req.body?.targetUid === 'string' ? req.body.targetUid.trim() : '';
        const targetLabel = typeof req.body?.targetLabel === 'string' ? req.body.targetLabel.trim() : 'Selected Worker';
        if (!targetUid) {
          res.status(400).json({ ok: false, errorCode: 'MISSING_TARGET', message: 'Select a worker first.' });
          return;
        }
        const workerTokens = await runtime.db
          .collection('device_tokens')
          .where('ownerUid', '==', targetUid)
          .where('enabled', '==', true)
          .get();

        if (workerTokens.empty) {
          res.status(400).json({
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEVICE',
            message: 'Selected worker has not enabled push notifications on a mobile/browser device yet.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          });
          return;
        }

        targets.push({
          uid: targetUid,
          label: targetLabel,
          role: workerTokens.docs[0].data().isDemo ? 'demo_worker' : 'worker',
          isDemo: Boolean(workerTokens.docs[0].data().isDemo),
          language: lang,
          tokens: workerTokens.docs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
          title: customTitle || '[DEMO] Test Notification from ROJGAR SETU',
          body: customBody || 'Admin live notification verification message.',
          category: 'announcements',
          targetRoute: 'worker-dashboard',
          clickUrl: '/?route=worker-dashboard',
          dedupeKey: `admin_worker_${targetUid}_${Date.now()}`,
        });
      } else if (action === 'test_all_demo_workers') {
        if (!confirmed) {
          res.status(400).json({ ok: false, errorCode: 'CONFIRMATION_REQUIRED', message: 'Explicit confirmation required.' });
          return;
        }
        const demoTokens = await runtime.db
          .collection('device_tokens')
          .where('isDemo', '==', true)
          .where('enabled', '==', true)
          .get();

        if (demoTokens.empty) {
          res.status(400).json({
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEMO_DEVICE',
            message: 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          });
          return;
        }

        const byUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
        demoTokens.docs.forEach((d) => {
          const data = d.data();
          const list = byUid.get(data.ownerUid) || [];
          list.push({ docId: d.id, token: data.token, preferredLanguage: data.preferredLanguage });
          byUid.set(data.ownerUid, list);
        });

        for (const [uid, tokList] of byUid.entries()) {
          const targetLang = getLanguageOrDefault(tokList[0]?.preferredLanguage || lang);
          targets.push({
            uid,
            label: `DEMO Tester (${uid.slice(0, 6)})`,
            role: 'demo_worker',
            isDemo: true,
            language: targetLang,
            tokens: tokList.map((t) => ({ docId: t.docId, token: t.token })),
            title: customTitle || '[DEMO] ROJGAR SETU Test Worker Broadcast',
            body: customBody || 'Demo broadcast received on your registered test mobile device.',
            category: 'announcements',
            targetRoute: 'worker-dashboard',
            clickUrl: '/?route=worker-dashboard',
            dedupeKey: `admin_all_demo_${uid}_${Date.now()}`,
          });
        }
      } else if (action === 'demo_job_blast') {
        const demoJobId = typeof req.body?.demoJobId === 'string' ? req.body.demoJobId.trim() : '';
        if (!demoJobId) {
          res.status(400).json({ ok: false, errorCode: 'MISSING_DEMO_JOB_ID', message: 'Demo Job ID is required.' });
          return;
        }
        const djSnap = await runtime.db.collection('demo_jobs').doc(demoJobId).get();
        if (!djSnap.exists) {
          res.status(404).json({ ok: false, errorCode: 'DEMO_JOB_NOT_FOUND', message: 'Demo job not found.' });
          return;
        }
        const dj = djSnap.data()!;

        const demoTokens = await runtime.db
          .collection('device_tokens')
          .where('isDemo', '==', true)
          .where('enabled', '==', true)
          .get();

        if (demoTokens.empty) {
          res.status(400).json({
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEMO_DEVICE',
            message: 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          });
          return;
        }

        const byUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
        demoTokens.docs.forEach((d) => {
          const data = d.data();
          const list = byUid.get(data.ownerUid) || [];
          list.push({ docId: d.id, token: data.token, preferredLanguage: data.preferredLanguage });
          byUid.set(data.ownerUid, list);
        });

        for (const [uid, tokList] of byUid.entries()) {
          const targetLang = getLanguageOrDefault(tokList[0]?.preferredLanguage || lang);
          const msg = buildLocalizedJobMessage({
            lang: targetLang,
            title: String(dj.title || 'Sample Job'),
            category: String(dj.category || 'General'),
            district: String(dj.district || 'Chandrapur'),
            offeredWage: Number(dj.offeredWage) || 0,
            wageUnit: String(dj.wageUnit || 'daily'),
            isDemo: true,
          });
          targets.push({
            uid,
            label: `DEMO Tester (${uid.slice(0, 6)})`,
            role: 'demo_worker',
            isDemo: true,
            language: targetLang,
            tokens: tokList.map((t) => ({ docId: t.docId, token: t.token })),
            title: msg.title,
            body: msg.body,
            category: 'matchingJobs',
            targetRoute: 'worker-dashboard',
            targetDemoJobId: demoJobId,
            clickUrl: `/?route=worker-dashboard&demoJobId=${encodeURIComponent(demoJobId)}`,
            dedupeKey: `demo_job_${demoJobId}_${uid}_${Date.now()}`,
          });
        }
      } else if (action === 'demo_announcement') {
        if (!confirmed) {
          res.status(400).json({ ok: false, errorCode: 'CONFIRMATION_REQUIRED', message: 'Confirmation required.' });
          return;
        }
        const audience = req.body?.audience === 'all_opted_in' ? 'all_opted_in' : 'demo_only';
        const q =
          audience === 'demo_only'
            ? runtime.db.collection('device_tokens').where('isDemo', '==', true).where('enabled', '==', true)
            : runtime.db.collection('device_tokens').where('enabled', '==', true);

        const snap = await q.get();
        if (snap.empty) {
          res.status(400).json({
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEVICE',
            message:
              audience === 'demo_only'
                ? 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.'
                : 'No opted-in device tokens are registered yet.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          });
          return;
        }

        const byUid = new Map<string, Array<{ docId: string; token: string; isDemo?: boolean; preferredLanguage?: string }>>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const list = byUid.get(data.ownerUid) || [];
          list.push({
            docId: d.id,
            token: data.token,
            isDemo: Boolean(data.isDemo),
            preferredLanguage: data.preferredLanguage,
          });
          byUid.set(data.ownerUid, list);
        });

        for (const [uid, tokList] of byUid.entries()) {
          const targetLang = getLanguageOrDefault(tokList[0]?.preferredLanguage || lang);
          targets.push({
            uid,
            label: tokList[0]?.isDemo ? `DEMO Tester (${uid.slice(0, 6)})` : `User (${uid.slice(0, 6)})`,
            role: tokList[0]?.isDemo ? 'demo_worker' : 'worker',
            isDemo: Boolean(tokList[0]?.isDemo),
            language: targetLang,
            tokens: tokList.map((t) => ({ docId: t.docId, token: t.token })),
            title: customTitle || '[DEMO] ROJGAR SETU Important Announcement',
            body:
              customBody ||
              'New skill training & local work alerts are now active via ROJGAR SETU.',
            category: 'announcements',
            targetRoute: 'home',
            clickUrl: '/?route=home',
            dedupeKey: `admin_ann_${uid}_${Date.now()}`,
          });
        }
      } else {
        res.status(400).json({ ok: false, errorCode: 'UNKNOWN_ACTION', message: 'Invalid demo notification action.' });
        return;
      }

      const dispatchResult = await dispatchAndRecordTargets({
        runtime,
        targets,
        sentByUid: authUser.decoded.uid,
      });

      // Write audit log entry
      await runtime.db
        .collection('auditLogs')
        .add({
          adminUid: authUser.decoded.uid,
          adminEmail: authUser.decoded.email || 'admin@rojgarsetu',
          action: `notification_${action}`,
          targetCollection: 'notification_delivery_logs',
          targetId: action,
          details: `Sent=${dispatchResult.sentCount}, Failed=${dispatchResult.failedCount}, Attempted=${dispatchResult.attemptedTokens}`,
          createdAt: FieldValue.serverTimestamp(),
        })
        .catch(() => undefined);

      res.json(dispatchResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Admin demo notification error';
      res.status(500).json({ ok: false, errorCode: 'SERVER_ERROR', message });
    }
  });

  app.post('/api/notifications/demo-push', async (req: Request, res: Response) => {
    const result = await handleDemoPushDispatch({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
  });
}

export async function handleDemoPushDispatch(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
  const runtime = getAdminRuntime(params.rootDir);
  const match = params.authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      httpStatus: 401,
      payload: { ok: false, fcmPushStatus: 'failed', reason: 'Missing Authorization Bearer token.' },
    };
  }

  let callerUid = '';
  let isAdmin = false;
  try {
    const decoded = await getAuth(runtime.app).verifyIdToken(match[1]);
    callerUid = decoded.uid;
    isAdmin = decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
    if (!isAdmin && runtime.hasMessagingCredentials) {
      try {
        const adminSnap = await runtime.db.collection('admins').doc(decoded.uid).get();
        if (adminSnap.exists) isAdmin = true;
      } catch {
        // Ignore optional admin lookup error
      }
    }
  } catch {
    return {
      httpStatus: 401,
      payload: { ok: false, fcmPushStatus: 'failed', reason: 'Invalid Firebase ID token.' },
    };
  }

  if (!checkRateLimit(callerUid, 60)) {
    return {
      httpStatus: 429,
      payload: { ok: false, fcmPushStatus: 'failed', reason: 'Rate limit exceeded for demo push dispatch.' },
    };
  }

  const orderId = typeof params.body.orderId === 'string' ? params.body.orderId.trim() : '';
  const recipientOwnerUid =
    typeof params.body.recipientOwnerUid === 'string' ? params.body.recipientOwnerUid.trim() : '';
  const recipientName =
    typeof params.body.recipientName === 'string' ? params.body.recipientName.trim().slice(0, 120) : 'Demo User';
  const recipientRole = params.body.recipientRole === 'customer' ? 'employer' : 'demo_worker';
  const title = typeof params.body.title === 'string' ? params.body.title.trim().slice(0, 140) : '[DEMO] ROJGAR SETU Alert';
  const body = typeof params.body.body === 'string' ? params.body.body.trim().slice(0, 400) : 'New Demo Mode update.';
  const dedupeKey =
    typeof params.body.dedupeKey === 'string' && params.body.dedupeKey.trim()
      ? params.body.dedupeKey.trim().slice(0, 128)
      : `demo_${orderId}_${recipientOwnerUid}_${Date.now()}`;

  if (!orderId || !recipientOwnerUid) {
    return {
      httpStatus: 400,
      payload: { ok: false, fcmPushStatus: 'failed', reason: 'orderId and recipientOwnerUid are required.' },
    };
  }

  if (!runtime.hasMessagingCredentials) {
    return {
      httpStatus: 200,
      payload: {
        ok: false,
        fcmPushStatus: 'failed',
        attemptedTokens: 0,
        sentCount: 0,
        failedCount: 0,
        reason:
          'Server Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or Cloud Run ADC) are not configured for cross-device FCM push.',
      },
    };
  }

  try {
    if (!isAdmin) {
      const orderSnap = await runtime.db.collection('demo_work_orders').doc(orderId).get();
      if (!orderSnap.exists) {
        return {
          httpStatus: 404,
          payload: { ok: false, fcmPushStatus: 'failed', reason: 'Demo work order not found.' },
        };
      }
      const orderData = orderSnap.data() as {
        ownerUid?: string;
        matchedWorkerOwnerUids?: string[];
        acceptedWorkerOwnerUid?: string;
      };
      const participants = new Set<string>([
        ...(orderData.ownerUid ? [orderData.ownerUid] : []),
        ...(Array.isArray(orderData.matchedWorkerOwnerUids) ? orderData.matchedWorkerOwnerUids : []),
        ...(orderData.acceptedWorkerOwnerUid ? [orderData.acceptedWorkerOwnerUid] : []),
      ]);
      if (!participants.has(callerUid) || !participants.has(recipientOwnerUid)) {
        return {
          httpStatus: 403,
          payload: {
            ok: false,
            fcmPushStatus: 'failed',
            reason: 'Caller or recipient is not an authorized participant on this demo work order.',
          },
        };
      }
    }

    const tokenSnap = await runtime.db
      .collection('device_tokens')
      .where('ownerUid', '==', recipientOwnerUid)
      .where('enabled', '==', true)
      .get();

    if (tokenSnap.empty) {
      return {
        httpStatus: 200,
        payload: {
          ok: false,
          fcmPushStatus: 'skipped_no_token',
          attemptedTokens: 0,
          sentCount: 0,
          failedCount: 0,
          reason:
            'No active FCM Web Push token registered on the recipient mobile browser yet. Click "Enable Mobile Push Notifications" on that device first.',
        },
      };
    }

    const tokens = tokenSnap.docs.map((d) => ({
      docId: d.id,
      token: String((d.data() as { token?: string }).token || ''),
    })).filter((t) => Boolean(t.token));

    if (tokens.length === 0) {
      return {
        httpStatus: 200,
        payload: {
          ok: false,
          fcmPushStatus: 'skipped_no_token',
          attemptedTokens: 0,
          sentCount: 0,
          failedCount: 0,
          reason: 'Recipient has no valid active push token.',
        },
      };
    }

    const firstTokenLang = getLanguageOrDefault((tokenSnap.docs[0].data() as { preferredLanguage?: string })?.preferredLanguage);
    const dispatchResult = await dispatchAndRecordTargets({
      runtime,
      targets: [
        {
          uid: recipientOwnerUid,
          label: recipientName,
          role: recipientRole,
          isDemo: true,
          language: firstTokenLang,
          tokens,
          title,
          body,
          category: 'bookingNotifications',
          targetRoute: 'demo-testing',
          targetDemoJobId: orderId,
          clickUrl: `/?route=demo-testing&demoJobId=${encodeURIComponent(orderId)}`,
          dedupeKey,
        },
      ],
      sentByUid: callerUid,
    });

    const fcmPushStatus = dispatchResult.sentCount > 0 ? 'sent' : 'failed';
    return {
      httpStatus: 200,
      payload: {
        ok: dispatchResult.sentCount > 0,
        fcmPushStatus,
        attemptedTokens: dispatchResult.attemptedTokens,
        sentCount: dispatchResult.sentCount,
        failedCount: dispatchResult.failedCount,
        reason:
          dispatchResult.sentCount > 0
            ? ''
            : dispatchResult.errors?.[0]?.message || dispatchResult.message || 'FCM push delivery failed.',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server push dispatch error';
    return {
      httpStatus: 500,
      payload: { ok: false, fcmPushStatus: 'failed', reason: message },
    };
  }
}
