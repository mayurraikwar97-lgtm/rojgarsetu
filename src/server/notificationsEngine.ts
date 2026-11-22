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
import {
  SERVICE_RADIUS_STAGES,
  buildApproxLocationLabel,
  buildSmartJobNotificationContent,
  evaluateWorkerEligibilityForJob,
  getNextRadiusStage,
  normalizeRadiusKm,
} from '../lib/smartVoiceJobAlert.ts';
import {
  getToneChannelConfig,
  getToneTypeForEvent,
  type NotificationToneType,
} from '../lib/dealWorkflow.ts';

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

const DEFAULT_APPLET_CONFIG: FirebaseAppletConfig = {
  projectId: 'gen-lang-client-0174765083',
  firestoreDatabaseId: 'ai-studio-7bd2ffb9-a189-4838-a21e-7da9c4e7b2b7',
  messagingSenderId: '6490744736',
};

function loadAppletConfig(rootDir: string): FirebaseAppletConfig {
  try {
    const raw = fs.readFileSync(path.resolve(rootDir, 'firebase-applet-config.json'), 'utf8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return DEFAULT_APPLET_CONFIG;
  }
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

async function verifyAuthHeader(
  authHeader: string,
  runtime: AdminRuntime
): Promise<{ decoded: DecodedIdToken; isAdmin: boolean } | null> {
  const match = (authHeader || '').match(/^Bearer\s+(.+)$/i);
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

async function verifyRequestUser(
  req: Request,
  runtime: AdminRuntime
): Promise<{ decoded: DecodedIdToken; isAdmin: boolean } | null> {
  return verifyAuthHeader(req.headers.authorization || '', runtime);
}

export function computeAlreadyHandledWorkerUids(params: {
  existingNotifDocs: Array<{ recipientUid?: unknown; deliveryStatus?: unknown }>;
  tokensByUid: Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>;
}): {
  alreadyPushedSet: Set<string>;
  alreadyInAppSet: Set<string>;
  alreadyHandledSet: Set<string>;
} {
  const alreadyPushedSet = new Set<string>();
  const alreadyInAppSet = new Set<string>();
  const alreadyHandledSet = new Set<string>();

  for (const docData of params.existingNotifDocs) {
    const uid = typeof docData.recipientUid === 'string' ? docData.recipientUid.trim() : '';
    if (!uid) continue;
    alreadyInAppSet.add(uid);
    if (docData.deliveryStatus === 'sent') {
      alreadyPushedSet.add(uid);
      alreadyHandledSet.add(uid);
    }
  }

  for (const uid of alreadyInAppSet) {
    if (alreadyPushedSet.has(uid)) continue;
    const activeTokens = params.tokensByUid.get(uid) || [];
    if (activeTokens.length === 0) {
      alreadyHandledSet.add(uid);
    }
  }

  return { alreadyPushedSet, alreadyInAppSet, alreadyHandledSet };
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
  eta?: string;
  locationLabel?: string;
  messageSnippet?: string;
}): { title: string; body: string } {
  const { lang, eventType, workerName, jobTitle, proposedWage, eta, locationLabel, messageSnippet } = params;
  const safeName = workerName || 'Participant';
  const safeJob = jobTitle || 'Work Request';
  const priceText = proposedWage && proposedWage > 0 ? `₹${proposedWage}` : '';
  const etaText = eta ? ` · ETA: ${eta}` : '';
  const locText = locationLabel ? ` · ${locationLabel}` : '';
  const msgText = messageSnippet ? ` — "${messageSnippet.slice(0, 120)}"` : '';

  if (lang === 'mr') {
    switch (eventType) {
      case 'hiring_request_created':
        return {
          title: `नवीन कामाची विनंती: ${safeJob}`,
          body: `${safeName} यांनी कामाची विनंती पाठवली आहे${locText}${priceText ? ` · ${priceText}` : ''}. स्वीकारा, नकारा किंवा दर प्रस्ताव पाठवा.`,
        };
      case 'worker_offer_sent':
      case 'worker_quotation':
        return {
          title: `कामगाराचा नवीन दर प्रस्ताव: ${safeJob}`,
          body: `${safeName} यांनी ${priceText || 'नवीन दर'} ऑफर पाठवली आहे${etaText}${msgText}.`,
        };
      case 'offer_accepted':
      case 'deal_confirmed':
        return {
          title: `अभिनंदन! तुमचे काम निश्चित झाले आहे: ${safeJob}`,
          body: `अभिनंदन! ${safeName} यांनी ${safeJob} काम निश्चित केले आहे${priceText ? ` (${priceText})` : ''}${locText}. आता लाइव्ह लोकेशन आणि चॅट सुरू झाले आहे.`,
        };
      case 'offer_rejected':
        return {
          title: `ऑफर स्वीकारला नाही: ${safeJob}`,
          body: `${safeName} यांनी या कामासाठीचा प्रस्ताव नाकारला आहे.`,
        };
      case 'job_request_accepted':
      case 'booking_accepted':
        return {
          title: `अभिनंदन! काम निश्चित झाले: ${safeJob}`,
          body: `${safeName} यांनी काम निश्चित केले आहे${priceText ? ` (${priceText})` : ''}${locText}.`,
        };
      case 'job_request_rejected':
        return {
          title: `कामाची विनंती नाकारली: ${safeJob}`,
          body: `${safeName} सध्या या कामासाठी उपलब्ध नाहीत.`,
        };
      case 'customer_message':
      case 'worker_message':
        return {
          title: `नवीन संदेश — ${safeJob}`,
          body: `${safeName}: ${messageSnippet || 'नवीन संदेश प्राप्त झाला आहे.'}`,
        };
      case 'work_started':
      case 'worker_arrived':
        return {
          title: `काम सुरू झाले: ${safeJob}`,
          body: `${safeName} कामाच्या ठिकाणी पोहोचले / काम सुरू केले आहे.`,
        };
      case 'work_completed':
      case 'job_completed':
        return {
          title: `काम पूर्ण झाले: ${safeJob}`,
          body: `${safeJob} पूर्ण झाले आहे. लाइव्ह लोकेशन शेअरिंग सुरक्षितपणे बंद केले आहे.`,
        };
      case 'customer_location_shared':
        return {
          title: `ग्राहकाने अचूक लोकेशन शेअर केले: ${safeJob}`,
          body: `${safeName} यांनी अचूक पत्ता व पिन शेअर केला आहे${locText}. नकाशावर पहा आणि मार्ग (Directions) सुरू करा.`,
        };
      case 'worker_location_shared':
        return {
          title: `कामगाराने लाइव्ह लोकेशन शेअर केले: ${safeJob}`,
          body: `${safeName} यांचे लाइव्ह लोकेशन आता नकाशावर दिसत आहे${locText}.`,
        };
      case 'deal_cancelled':
      case 'booking_cancelled':
        return {
          title: `व्यवहार रद्द झाला: ${safeJob}`,
          body: `${safeName} यांनी ${safeJob} रद्द केले आहे. लोकेशन शेअरिंग बंद झाले आहे.`,
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
      case 'hiring_request_created':
        return {
          title: `नया कार्य अनुरोध: ${safeJob}`,
          body: `${safeName} ने कार्य अनुरोध भेजा है${locText}${priceText ? ` · ${priceText}` : ''}। स्वीकार करें, अस्वीकार करें या ऑफर भेजें।`,
        };
      case 'worker_offer_sent':
      case 'worker_quotation':
        return {
          title: `कामगार का नया ऑफर: ${safeJob}`,
          body: `${safeName} ने ${priceText || 'दर'} का ऑफर भेजा है${etaText}${msgText}।`,
        };
      case 'offer_accepted':
      case 'deal_confirmed':
        return {
          title: `बधाई हो! आपका काम पक्का हो गया है: ${safeJob}`,
          body: `बधाई हो! ${safeName} ने ${safeJob} के लिए काम पक्का कर दिया है${priceText ? ` (${priceText})` : ''}${locText}। अब लाइव लोकेशन और चैट चालू है।`,
        };
      case 'offer_rejected':
        return {
          title: `ऑफर अस्वीकृत: ${safeJob}`,
          body: `${safeName} ने इस काम का प्रस्ताव अस्वीकार कर दिया है।`,
        };
      case 'job_request_accepted':
      case 'booking_accepted':
        return {
          title: `बधाई हो! काम पक्का हुआ: ${safeJob}`,
          body: `${safeName} ने आपका कार्य अनुरोध पक्का कर दिया है${priceText ? ` (${priceText})` : ''}${locText}।`,
        };
      case 'job_request_rejected':
        return {
          title: `कार्य अनुरोध अस्वीकृत: ${safeJob}`,
          body: `${safeName} अभी इस कार्य के लिए उपलब्ध नहीं हैं।`,
        };
      case 'customer_message':
      case 'worker_message':
        return {
          title: `नया संदेश — ${safeJob}`,
          body: `${safeName}: ${messageSnippet || 'नया संदेश प्राप्त हुआ है।'}`,
        };
      case 'work_started':
      case 'worker_arrived':
        return {
          title: `काम शुरू हो गया: ${safeJob}`,
          body: `${safeName} ने कार्य शुरू कर दिया है / स्थल पर पहुंच गए हैं।`,
        };
      case 'work_completed':
      case 'job_completed':
        return {
          title: `कार्य पूर्ण: ${safeJob}`,
          body: `${safeJob} पूर्ण हो गया है। लाइव लोकेशन साझाकरण बंद कर दिया गया है।`,
        };
      case 'customer_location_shared':
        return {
          title: `ग्राहक ने सटीक लोकेशन साझा की: ${safeJob}`,
          body: `${safeName} ने सटीक लोकेशन पिन साझा किया है${locText}। नक्शे पर देखें और दिशा (Directions) प्राप्त करें।`,
        };
      case 'worker_location_shared':
        return {
          title: `कामगार ने लाइव लोकेशन साझा की: ${safeJob}`,
          body: `${safeName} की लाइव लोकेशन अब नक्शे पर दिख रही है${locText}।`,
        };
      case 'deal_cancelled':
      case 'booking_cancelled':
        return {
          title: `डील रद्द: ${safeJob}`,
          body: `${safeName} द्वारा ${safeJob} रद्द कर दिया गया है। लाइव लोकेशन बंद हो गई है।`,
        };
      default:
        return {
          title: `नया कामगार आवेदन: ${safeJob}`,
          body: `${safeName} ने आपके काम के लिए आवेदन किया है।`,
        };
    }
  }

  switch (eventType) {
    case 'hiring_request_created':
      return {
        title: `New Hiring Request: ${safeJob}`,
        body: `${safeName} requested a worker${locText}${priceText ? ` · ${priceText}` : ''}. Accept, Reject, or Send Offer.`,
      };
    case 'worker_offer_sent':
    case 'worker_quotation':
      return {
        title: `New Offer Received: ${safeJob}`,
        body: `${safeName} sent an offer of ${priceText || 'proposed rate'}${etaText}${msgText}.`,
      };
    case 'offer_accepted':
    case 'deal_confirmed':
      return {
        title: `Congratulations! Your work has been confirmed.`,
        body: `Work confirmed for "${safeJob}" with ${safeName}${priceText ? ` at ${priceText}` : ''}${locText}. Live location & chat are now active.`,
      };
    case 'offer_rejected':
      return {
        title: `Offer Not Accepted: ${safeJob}`,
        body: `${safeName} declined your offer for ${safeJob}.`,
      };
    case 'job_request_accepted':
    case 'booking_accepted':
      return {
        title: `Work Confirmed: ${safeJob}`,
        body: `${safeName} confirmed work for ${safeJob}${priceText ? ` (${priceText})` : ''}${locText}.`,
      };
    case 'job_request_rejected':
      return {
        title: `Request Declined: ${safeJob}`,
        body: `${safeName} declined the request for ${safeJob}.`,
      };
    case 'customer_message':
    case 'worker_message':
      return {
        title: `New Message — ${safeJob}`,
        body: `${safeName}: ${messageSnippet || 'Sent you a message in deal coordination.'}`,
      };
    case 'work_started':
    case 'worker_arrived':
      return {
        title: `Work Started: ${safeJob}`,
        body: `${safeName} has started work / arrived at the site for ${safeJob}.`,
      };
    case 'work_completed':
    case 'job_completed':
      return {
        title: `Work Completed: ${safeJob}`,
        body: `${safeJob} has been marked completed. Live location sharing is now stopped.`,
      };
    case 'customer_location_shared':
      return {
        title: `Customer Shared Exact Location: ${safeJob}`,
        body: `${safeName} shared their exact location pin${locText}. Tap to view on map and get directions.`,
      };
    case 'worker_location_shared':
      return {
        title: `Worker Shared Live Location: ${safeJob}`,
        body: `${safeName} is sharing their live location${locText}. Tap to view distance on the map.`,
      };
    case 'deal_cancelled':
    case 'booking_cancelled':
      return {
        title: `Deal Cancelled: ${safeJob}`,
        body: `${safeJob} was cancelled by ${safeName}. Live location sharing has been stopped.`,
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
  voiceScript?: string;
  approxLocationLabel?: string;
  distanceKm?: number | null;
  customerName?: string;
  jobCategory?: string;
  playSound?: boolean;
  speakVoice?: boolean;
  eventType?: string;
  toneType?: NotificationToneType;
  category: 'matchingJobs' | 'nearbyJobs' | 'applicationUpdates' | 'bookingNotifications' | 'announcements';
  targetRoute: string;
  targetJobId?: string;
  targetDemoJobId?: string;
  clickUrl: string;
  dedupeKey: string;
}

function isToneEnabledForPref(
  pref: FirebaseFirestore.DocumentData | undefined,
  toneType: NotificationToneType
): boolean {
  if (!pref) return true;
  if (pref.soundEnabled === false) return false;
  if (toneType === 'new_job' && pref.toneNewJobEnabled === false) return false;
  if (toneType === 'new_offer' && pref.toneNewOfferEnabled === false) return false;
  if (toneType === 'deal_accepted' && pref.toneDealConfirmedEnabled === false) return false;
  if ((toneType === 'deal_completed' || toneType === 'deal_cancelled') && pref.toneDealClosedEnabled === false) {
    return false;
  }
  return true;
}

function buildOptionalVoicePayloadFields(target: DeliveryTarget): Record<string, unknown> {
  const toneType = getToneTypeForEvent({
    toneType: target.toneType,
    eventType: target.eventType,
    category: target.category,
  });
  return {
    ...(target.eventType ? { eventType: target.eventType.slice(0, 60) } : {}),
    toneType,
    ...(target.voiceScript ? { voiceScript: target.voiceScript.slice(0, 680) } : {}),
    ...(target.approxLocationLabel ? { approxLocationLabel: target.approxLocationLabel.slice(0, 155) } : {}),
    ...(typeof target.distanceKm === 'number' &&
    Number.isFinite(target.distanceKm) &&
    target.distanceKm >= 0 &&
    target.distanceKm <= 5000
      ? { distanceKm: target.distanceKm }
      : {}),
    ...(target.customerName ? { customerName: target.customerName.slice(0, 155) } : {}),
    ...(target.jobCategory ? { jobCategory: target.jobCategory.slice(0, 75) } : {}),
    ...(typeof target.playSound === 'boolean' ? { playSound: target.playSound } : {}),
    ...(typeof target.speakVoice === 'boolean' ? { speakVoice: target.speakVoice } : {}),
  };
}

function collectStageTargets(params: {
  jobId: string;
  job: FirebaseFirestore.DocumentData;
  workersDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  tokensByUid: Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>;
  prefsByUid: Map<string, FirebaseFirestore.DocumentData>;
  stageRadiusKm: number;
  alreadyNotifiedSet: Set<string>;
}): DeliveryTarget[] {
  const { jobId, job, workersDocs, tokensByUid, prefsByUid, stageRadiusKm, alreadyNotifiedSet } = params;
  const targets: DeliveryTarget[] = [];

  const jobCategoryStr = String(job.category || '');
  const jobSkillsArr = Array.isArray(job.requiredSkills) ? job.requiredSkills.map((s: unknown) => String(s)) : [];
  const approxLocLabel =
    (typeof job.approxLocationLabel === 'string' && job.approxLocationLabel.trim()) ||
    buildApproxLocationLabel({
      cityOrVillage: String(job.cityOrVillage || ''),
      district: String(job.district || ''),
      state: String(job.state || ''),
    });
  const customerName = String(job.employerName || 'Customer').trim() || 'Customer';

  for (const wDoc of workersDocs) {
    const w = wDoc.data();
    const workerUid = String(w.ownerUid || wDoc.id || '');
    if (!workerUid) continue;

    const pref = prefsByUid.get(workerUid);
    const evalResult = evaluateWorkerEligibilityForJob({
      job: {
        employerUid: String(job.employerUid || ''),
        category: jobCategoryStr,
        requiredSkills: jobSkillsArr,
        district: String(job.district || ''),
        cityOrVillage: String(job.cityOrVillage || ''),
        lat: Number(job.lat),
        lng: Number(job.lng),
      },
      worker: {
        ownerUid: workerUid,
        displayName: String(w.displayName || 'Worker'),
        primarySkill: String(w.primarySkill || ''),
        skills: Array.isArray(w.skills) ? w.skills.map((s: unknown) => String(s)) : [],
        district: String(w.district || ''),
        cityOrVillage: String(w.cityOrVillage || ''),
        approxLat: Number(w.approxLat),
        approxLng: Number(w.approxLng),
        verificationStatus: String(w.verificationStatus || 'pending'),
        availabilityStatus: String(w.availabilityStatus || 'available'),
        preferredLanguage: w.preferredLanguage === 'hi' || w.preferredLanguage === 'mr' ? w.preferredLanguage : undefined,
        preferredRadiusKm: Number(w.preferredRadiusKm) || undefined,
      },
      pref: pref
        ? {
            masterEnabled: pref.masterEnabled,
            matchingJobs: pref.matchingJobs,
            voiceAlertsEnabled: pref.voiceAlertsEnabled,
            soundEnabled: pref.soundEnabled,
            preferredLanguage:
              pref.preferredLanguage === 'hi' || pref.preferredLanguage === 'mr' || pref.preferredLanguage === 'en'
                ? pref.preferredLanguage
                : undefined,
            preferredCategories: Array.isArray(pref.preferredCategories)
              ? pref.preferredCategories.map((c: unknown) => String(c))
              : undefined,
            preferredRadiusKm: Number(pref.preferredRadiusKm) || undefined,
          }
        : undefined,
      stageRadiusKm,
      alreadyNotifiedUids: alreadyNotifiedSet,
    });

    if (!evalResult.eligible) continue;

    const userTokens = tokensByUid.get(workerUid) || [];
    const lang = getLanguageOrDefault(
      pref?.preferredLanguage || w.preferredLanguage || userTokens[0]?.preferredLanguage
    );
    const playSound = isToneEnabledForPref(pref, 'new_job');
    const speakVoice = pref?.voiceAlertsEnabled !== false && w.voiceAlertsEnabled !== false;

    const msg = buildSmartJobNotificationContent({
      lang,
      customerName,
      title: String(job.title || 'Work Opportunity'),
      category: jobCategoryStr,
      description: String(job.description || job.title || ''),
      approxLocationLabel: approxLocLabel,
      distanceKm: evalResult.distanceKm,
      offeredWage: Number(job.offeredWage) || 0,
      wageUnit: String(job.wageUnit || 'daily'),
    });

    const dedupeKey = `job_${jobId}_${workerUid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 115);

    targets.push({
      uid: workerUid,
      label: String(w.displayName || 'Worker'),
      role: 'worker',
      isDemo: false,
      language: lang,
      tokens: userTokens.map((t) => ({ docId: t.docId, token: t.token })),
      title: msg.title,
      body: msg.body,
      voiceScript: msg.voiceScript,
      approxLocationLabel: approxLocLabel,
      distanceKm: evalResult.distanceKm,
      customerName,
      jobCategory: jobCategoryStr,
      playSound,
      speakVoice,
      eventType: 'hiring_request_created',
      toneType: 'new_job',
      category: 'matchingJobs',
      targetRoute: 'worker-dashboard',
      targetJobId: jobId,
      clickUrl: `/?route=worker-dashboard&jobId=${encodeURIComponent(jobId)}&speak=${speakVoice ? '1' : '0'}&lang=${lang}`,
      dedupeKey,
    });
  }

  return targets;
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
    // Deterministic doc ID dedupe check so client Firestore writes and server FCM writes never duplicate
    const safeDocId = target.dedupeKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    let alreadyRecordedInFirestore = false;
    if (safeDocId.length >= 8) {
      try {
        const directSnap = await runtime.db.collection('notifications').doc(safeDocId).get();
        if (directSnap.exists) {
          alreadyRecordedInFirestore = true;
          const prevStatus = directSnap.data()?.deliveryStatus;
          if (prevStatus === 'sent' || target.tokens.length === 0) {
            continue;
          }
        }
      } catch {
        // Proceed
      }
    }

    // Deduplication query check
    if (!alreadyRecordedInFirestore) {
      try {
        const dupSnap = await runtime.db
          .collection('notifications')
          .where('recipientUid', '==', target.uid)
          .where('dedupeKey', '==', target.dedupeKey)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          alreadyRecordedInFirestore = true;
          const prevStatus = dupSnap.docs[0]?.data()?.deliveryStatus;
          if (prevStatus === 'sent' || target.tokens.length === 0) {
            continue;
          }
        }
      } catch {
        // Proceed if query fails due to unconfigured credentials; handled below
      }
    }

    if (target.tokens.length === 0) {
      inAppOnlyCount += 1;
      try {
        const payloadDoc = {
          recipientUid: target.uid,
          recipientRole: target.role,
          isDemo: target.isDemo,
          category: target.category,
          title: target.title.slice(0, 160),
          body: target.body.slice(0, 500),
          ...buildOptionalVoicePayloadFields(target),
          language: target.language,
          targetRoute: target.targetRoute,
          ...(target.targetJobId ? { targetJobId: target.targetJobId } : {}),
          ...(target.targetDemoJobId ? { targetDemoJobId: target.targetDemoJobId } : {}),
          dedupeKey: target.dedupeKey,
          deliveryStatus: 'in_app_only',
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (safeDocId.length >= 8) {
          await runtime.db.collection('notifications').doc(safeDocId).set(payloadDoc, { merge: true });
        } else {
          await runtime.db.collection('notifications').add(payloadDoc);
        }
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
    const toneType = getToneTypeForEvent({
      toneType: target.toneType,
      eventType: target.eventType,
      category: target.category,
    });
    const toneCfg = getToneChannelConfig(toneType);
    const soundActive = target.playSound !== false;

    try {
      const notifTitle = target.title.slice(0, 140);
      const notifBody = target.body.slice(0, 400);
      const notifTag = `${toneCfg.channelId}_${safeDocId || target.dedupeKey || 'alert'}`.slice(0, 96);
      const sharedDataPayload: Record<string, string> = {
        title: notifTitle,
        body: notifBody,
        clickUrl: target.clickUrl,
        route: target.targetRoute,
        jobId: target.targetJobId || '',
        demoJobId: target.targetDemoJobId || '',
        dedupeKey: target.dedupeKey,
        lang: target.language,
        toneType,
        eventType: target.eventType || '',
        voiceScript: (target.voiceScript || '').slice(0, 680),
        approxLocationLabel: (target.approxLocationLabel || '').slice(0, 155),
        distanceKm:
          typeof target.distanceKm === 'number' && Number.isFinite(target.distanceKm)
            ? String(target.distanceKm)
            : '',
        customerName: (target.customerName || '').slice(0, 155),
        jobCategory: (target.jobCategory || '').slice(0, 75),
        playSound: soundActive ? 'true' : 'false',
        speakVoice: target.speakVoice === false ? 'false' : 'true',
        speak: target.speakVoice === false ? '0' : '1',
      };

      const multicastRes = await runtime.messaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: notifTitle,
          body: notifBody,
        },
        data: sharedDataPayload,
        android: {
          priority: 'high',
          ttl: 86400 * 1000,
          notification: {
            channelId: toneCfg.channelId,
            tag: notifTag,
            ...(soundActive ? { sound: 'default', defaultSound: true } : { defaultSound: false }),
            defaultVibrateTimings: false,
            vibrateTimingsMillis: soundActive ? toneCfg.vibrateMillis : [0],
            priority: 'max',
            visibility: 'public',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              ...(soundActive ? { sound: 'default' } : {}),
              'content-available': 1,
            },
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '86400',
          },
          notification: {
            title: notifTitle,
            body: notifBody,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: notifTag,
            renotify: true,
            requireInteraction: true,
            silent: !soundActive,
            ...(soundActive ? { vibrate: toneCfg.vibratePattern } : {}),
            actions: [{ action: 'open', title: 'OPEN' }],
            data: sharedDataPayload,
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

      let existingDupDocRef: FirebaseFirestore.DocumentReference | null = null;
      if (safeDocId.length >= 8) {
        const candidateSnap = await runtime.db.collection('notifications').doc(safeDocId).get().catch(() => null);
        if (candidateSnap?.exists) {
          existingDupDocRef = candidateSnap.ref;
        }
      }

      if (!alreadyRecordedInFirestore && !existingDupDocRef) {
        const payloadDoc = {
          recipientUid: target.uid,
          recipientRole: target.role,
          isDemo: target.isDemo,
          category: target.category,
          title: target.title.slice(0, 160),
          body: target.body.slice(0, 500),
          ...buildOptionalVoicePayloadFields(target),
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
        };
        if (safeDocId.length >= 8) {
          await runtime.db.collection('notifications').doc(safeDocId).set(payloadDoc, { merge: true });
        } else {
          await runtime.db.collection('notifications').add(payloadDoc);
        }
      } else if (existingDupDocRef) {
        await existingDupDocRef
          .set(
            {
              deliveryStatus: targetAnySuccess ? 'sent' : 'failed',
              ...(firstErrorMsg && !targetAnySuccess ? { errorMessage: firstErrorMsg.slice(0, 400) } : {}),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(() => undefined);
      }
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

export interface NotificationHandlerResult {
  httpStatus: number;
  payload: Record<string, unknown>;
}

export function handleNotificationConfigStatus(params: {
  rootDir: string;
  headers?: Record<string, unknown>;
  secure?: boolean;
  hostname?: string;
}): NotificationHandlerResult {
  const runtime = getAdminRuntime(params.rootDir);
  const hasVapidKey = Boolean((process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim());
  const forwardedProto = String(params.headers?.['x-forwarded-proto'] || '').toLowerCase();
  const canonicalUrl = (process.env.VITE_CANONICAL_APP_URL || process.env.APP_URL || '').trim();
  const httpsActive =
    Boolean(params.secure) ||
    forwardedProto.includes('https') ||
    canonicalUrl.startsWith('https://') ||
    params.hostname === 'localhost';
  const demoModeEnvEnabled = (process.env.VITE_DEMO_MODE_ENABLED || 'true').trim().toLowerCase() !== 'false';

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

  return {
    httpStatus: 200,
    payload: {
      ok: true,
      hasVapidKey,
      hasAdminMessaging: runtime.hasMessagingCredentials,
      adminCredentialMode: runtime.credentialMode,
      projectId: runtime.config.projectId,
      databaseId: runtime.config.firestoreDatabaseId,
      httpsActive,
      demoModeEnvEnabled,
      missingSetupItems,
    },
  };
}

export async function handleSendMatchingJob(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<NotificationHandlerResult> {
  const runtime = getAdminRuntime(params.rootDir);
  const authUser = await verifyAuthHeader(params.authHeader, runtime);
  if (!authUser) {
    return { httpStatus: 401, payload: { error: 'UNAUTHORIZED', message: 'Valid sign-in required.' } };
  }
  if (!checkRateLimit(authUser.decoded.uid)) {
    return {
      httpStatus: 429,
      payload: { error: 'RATE_LIMITED', message: 'Too many notification requests. Please wait a few minutes.' },
    };
  }
  if (!runtime.hasMessagingCredentials) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message: 'Server Firebase Admin credentials are not configured yet to query and dispatch matching notifications.',
      },
    };
  }

  const jobId = typeof params.body?.jobId === 'string' ? params.body.jobId.trim() : '';
  if (!jobId) {
    return { httpStatus: 400, payload: { error: 'MISSING_JOB_ID' } };
  }

  try {
    const jobSnap = await runtime.db.collection('jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      return { httpStatus: 404, payload: { error: 'JOB_NOT_FOUND' } };
    }
    const job = jobSnap.data()!;
    if (job.employerUid !== authUser.decoded.uid && !authUser.isAdmin) {
      return { httpStatus: 403, payload: { error: 'FORBIDDEN' } };
    }

    const [workersSnap, tokensSnap, prefsSnap, existingJobNotifsSnap] = await Promise.all([
      runtime.db.collection('publicWorkers').get(),
      runtime.db.collection('device_tokens').where('enabled', '==', true).get(),
      runtime.db.collection('notification_preferences').get(),
      runtime.db.collection('notifications').where('targetJobId', '==', jobId).get(),
    ]);

    const prefsByUid = new Map<string, FirebaseFirestore.DocumentData>();
    prefsSnap.docs.forEach((d) => prefsByUid.set(d.id, d.data()));

    const tokensByUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
    tokensSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.isDemo === true) return;
      const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '';
      const tokenStr = typeof data.token === 'string' ? data.token.trim() : '';
      if (!ownerUid || !tokenStr) return;
      const list = tokensByUid.get(ownerUid) || [];
      list.push({ docId: d.id, token: tokenStr, preferredLanguage: data.preferredLanguage });
      tokensByUid.set(ownerUid, list);
    });

    const requestedRadius = normalizeRadiusKm(
      params.body?.stageRadiusKm ?? job.currentRadiusKm ?? job.initialRadiusKm ?? 5,
      5
    );
    const autoExpandIfEmpty = params.body?.autoExpandIfEmpty !== false;

    const existingNotified: string[] = Array.isArray(job.notifiedWorkerUids)
      ? job.notifiedWorkerUids.map((u: unknown) => String(u))
      : [];

    // CRITICAL FIX: Do NOT block server FCM push just because client already wrote
    // in-app notification docs & notifiedWorkerUids. Only skip workers who ALREADY
    // succeeded FCM delivery (deliveryStatus === 'sent') or already have an in-app doc with 0 active tokens.
    const { alreadyHandledSet } = computeAlreadyHandledWorkerUids({
      existingNotifDocs: existingJobNotifsSnap.docs.map((d) => d.data()),
      tokensByUid,
    });

    let activeRadiusKm = requestedRadius;
    let targets = collectStageTargets({
      jobId,
      job,
      workersDocs: workersSnap.docs,
      tokensByUid,
      prefsByUid,
      stageRadiusKm: activeRadiusKm,
      alreadyNotifiedSet: alreadyHandledSet,
    });

    if (targets.length === 0 && autoExpandIfEmpty) {
      for (const candidateStage of SERVICE_RADIUS_STAGES) {
        if (candidateStage <= activeRadiusKm) continue;
        activeRadiusKm = candidateStage;
        targets = collectStageTargets({
          jobId,
          job,
          workersDocs: workersSnap.docs,
          tokensByUid,
          prefsByUid,
          stageRadiusKm: activeRadiusKm,
          alreadyNotifiedSet: alreadyHandledSet,
        });
        if (targets.length > 0) break;
      }
    }

    const cappedTargets = targets.slice(0, 100);
    const result = await dispatchAndRecordTargets({
      runtime,
      targets: cappedTargets,
      sentByUid: authUser.decoded.uid,
    });

    const updatedNotifiedUids = Array.from(
      new Set([...existingNotified, ...cappedTargets.map((t) => t.uid)])
    ).slice(0, 100);

    await runtime.db
      .collection('jobs')
      .doc(jobId)
      .update({
        currentRadiusKm: activeRadiusKm,
        radiusStageUpdatedAt: FieldValue.serverTimestamp(),
        notifiedWorkerUids: updatedNotifiedUids,
        ...(updatedNotifiedUids.length > 0 ? { dealStatus: 'NOTIFIED' } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    return {
      httpStatus: 200,
      payload: {
        matchedWorkersCount: cappedTargets.length,
        workersWithTokensCount: cappedTargets.filter((t) => t.tokens.length > 0).length,
        currentRadiusKm: activeRadiusKm,
        hasNextStage: getNextRadiusStage(activeRadiusKm) !== null,
        totalNotifiedCount: updatedNotifiedUids.length,
        ...result,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Matching notification error';
    return { httpStatus: 500, payload: { ok: false, errorCode: 'SERVER_ERROR', message } };
  }
}

export async function handleExpandJobRadius(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<NotificationHandlerResult> {
  const runtime = getAdminRuntime(params.rootDir);
  const authUser = await verifyAuthHeader(params.authHeader, runtime);
  if (!authUser) {
    return { httpStatus: 401, payload: { error: 'UNAUTHORIZED', message: 'Valid sign-in required.' } };
  }
  if (!checkRateLimit(authUser.decoded.uid, 30)) {
    return { httpStatus: 429, payload: { error: 'RATE_LIMITED', message: 'Too many expansion requests.' } };
  }
  if (!runtime.hasMessagingCredentials) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message: 'Server Firebase Admin credentials are not configured yet for push expansion.',
      },
    };
  }

  const jobId = typeof params.body?.jobId === 'string' ? params.body.jobId.trim() : '';
  if (!jobId) {
    return { httpStatus: 400, payload: { error: 'MISSING_JOB_ID' } };
  }

  try {
    const jobSnap = await runtime.db.collection('jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      return { httpStatus: 404, payload: { error: 'JOB_NOT_FOUND' } };
    }
    const job = jobSnap.data()!;
    if (job.employerUid !== authUser.decoded.uid && !authUser.isAdmin) {
      return { httpStatus: 403, payload: { error: 'FORBIDDEN' } };
    }

    const prevRadius = normalizeRadiusKm(job.currentRadiusKm ?? job.initialRadiusKm ?? 5, 5);
    const hasExplicitTarget = Boolean(params.body?.targetRadiusKm);
    const nextStage = hasExplicitTarget
      ? normalizeRadiusKm(params.body.targetRadiusKm, prevRadius)
      : getNextRadiusStage(prevRadius);

    const existingNotified: string[] = Array.isArray(job.notifiedWorkerUids)
      ? job.notifiedWorkerUids.map((u: unknown) => String(u))
      : [];

    if (!nextStage || (!hasExplicitTarget && nextStage <= prevRadius) || (hasExplicitTarget && nextStage < prevRadius)) {
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          previousRadiusKm: prevRadius,
          currentRadiusKm: prevRadius,
          hasNextStage: false,
          newlyNotifiedCount: 0,
          sentCount: 0,
          inAppOnlyCount: 0,
          totalNotifiedCount: existingNotified.length,
          message: 'Maximum 30 km radius stage already active.',
        },
      };
    }

    const [workersSnap, tokensSnap, prefsSnap, existingJobNotifsSnap] = await Promise.all([
      runtime.db.collection('publicWorkers').get(),
      runtime.db.collection('device_tokens').where('enabled', '==', true).get(),
      runtime.db.collection('notification_preferences').get(),
      runtime.db.collection('notifications').where('targetJobId', '==', jobId).get(),
    ]);

    const prefsByUid = new Map<string, FirebaseFirestore.DocumentData>();
    prefsSnap.docs.forEach((d) => prefsByUid.set(d.id, d.data()));

    const tokensByUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
    tokensSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.isDemo === true) return;
      const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '';
      const tokenStr = typeof data.token === 'string' ? data.token.trim() : '';
      if (!ownerUid || !tokenStr) return;
      const list = tokensByUid.get(ownerUid) || [];
      list.push({ docId: d.id, token: tokenStr, preferredLanguage: data.preferredLanguage });
      tokensByUid.set(ownerUid, list);
    });

    const { alreadyHandledSet } = computeAlreadyHandledWorkerUids({
      existingNotifDocs: existingJobNotifsSnap.docs.map((d) => d.data()),
      tokensByUid,
    });

    const targets = collectStageTargets({
      jobId,
      job,
      workersDocs: workersSnap.docs,
      tokensByUid,
      prefsByUid,
      stageRadiusKm: nextStage,
      alreadyNotifiedSet: alreadyHandledSet,
    }).slice(0, 100);

    const result = await dispatchAndRecordTargets({
      runtime,
      targets,
      sentByUid: authUser.decoded.uid,
    });

    const updatedNotifiedUids = Array.from(
      new Set([...existingNotified, ...targets.map((t) => t.uid)])
    ).slice(0, 100);

    await runtime.db
      .collection('jobs')
      .doc(jobId)
      .update({
        currentRadiusKm: nextStage,
        radiusStageUpdatedAt: FieldValue.serverTimestamp(),
        notifiedWorkerUids: updatedNotifiedUids,
        ...(updatedNotifiedUids.length > 0 ? { dealStatus: 'NOTIFIED' } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    return {
      httpStatus: 200,
      payload: {
        previousRadiusKm: prevRadius,
        currentRadiusKm: nextStage,
        hasNextStage: getNextRadiusStage(nextStage) !== null,
        newlyNotifiedCount: targets.length,
        totalNotifiedCount: updatedNotifiedUids.length,
        ...result,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Radius expansion failed';
    return { httpStatus: 500, payload: { ok: false, errorCode: 'SERVER_ERROR', message } };
  }
}

export async function handleSendCustomerEvent(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<NotificationHandlerResult> {
  const runtime = getAdminRuntime(params.rootDir);
  const authUser = await verifyAuthHeader(params.authHeader, runtime);
  if (!authUser) {
    return { httpStatus: 401, payload: { error: 'UNAUTHORIZED' } };
  }
  if (!checkRateLimit(authUser.decoded.uid, 40)) {
    return { httpStatus: 429, payload: { error: 'RATE_LIMITED' } };
  }
  if (!runtime.hasMessagingCredentials) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message: 'Server Firebase Admin credentials are not configured yet for push delivery.',
      },
    };
  }

  const recipientUid = typeof params.body?.recipientUid === 'string' ? params.body.recipientUid.trim() : '';
  const recipientRoleRaw = typeof params.body?.recipientRole === 'string' ? params.body.recipientRole.trim() : '';
  const eventType = typeof params.body?.eventType === 'string' ? params.body.eventType.trim() : 'new_application';
  const workerName = typeof params.body?.workerName === 'string' ? params.body.workerName.trim().slice(0, 100) : '';
  const jobTitle = typeof params.body?.jobTitle === 'string' ? params.body.jobTitle.trim().slice(0, 140) : '';
  const jobId = typeof params.body?.jobId === 'string' ? params.body.jobId.trim() : '';
  const bookingId = typeof params.body?.bookingId === 'string' ? params.body.bookingId.trim() : '';
  const proposedWage = Number(params.body?.proposedWage) || 0;
  const eta = typeof params.body?.eta === 'string' ? params.body.eta.trim().slice(0, 80) : '';
  const locationLabel = typeof params.body?.locationLabel === 'string' ? params.body.locationLabel.trim().slice(0, 140) : '';
  const messageSnippet = typeof params.body?.messageSnippet === 'string' ? params.body.messageSnippet.trim().slice(0, 180) : '';
  const requestedDedupeKey = typeof params.body?.dedupeKey === 'string' ? params.body.dedupeKey.trim().slice(0, 120) : '';
  const targetRoute = typeof params.body?.targetRoute === 'string' ? params.body.targetRoute : 'employer-dashboard';

  if (!recipientUid) {
    return { httpStatus: 400, payload: { error: 'MISSING_RECIPIENT' } };
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
            if (!appSnap.empty) {
              authorized = true;
            } else {
              const workerSnap = await runtime.db.collection('publicWorkers').doc(recipientUid).get();
              authorized = workerSnap.exists;
            }
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
        return {
          httpStatus: 403,
          payload: {
            ok: false,
            errorCode: 'FORBIDDEN',
            message: 'Caller is not authorized to notify this recipient for the specified job or booking.',
          },
        };
      }
    }

    const [prefSnap, tokenSnap] = await Promise.all([
      runtime.db.collection('notification_preferences').doc(recipientUid).get(),
      runtime.db.collection('device_tokens').where('ownerUid', '==', recipientUid).get(),
    ]);

    const activeTokenDocs = tokenSnap.docs.filter((d) => {
      const data = d.data();
      return data.enabled === true && Boolean(data.token);
    });

    const pref = prefSnap.exists ? prefSnap.data() : undefined;
    if (pref && pref.masterEnabled === false) {
      return { httpStatus: 200, payload: { ok: true, skipped: true, message: 'Recipient disabled notifications.' } };
    }

    const lang = getLanguageOrDefault(pref?.preferredLanguage || activeTokenDocs[0]?.data()?.preferredLanguage);
    const msg = buildLocalizedCustomerEventMessage({
      lang,
      eventType,
      workerName,
      jobTitle,
      proposedWage,
      eta,
      locationLabel,
      messageSnippet,
    });

    const resolvedRole: DeliveryTarget['role'] =
      recipientRoleRaw === 'worker' || targetRoute === 'worker-dashboard' || targetRoute === 'find-work'
        ? 'worker'
        : 'employer';

    const resolvedCategory: DeliveryTarget['category'] = eventType.includes('booking')
      ? 'bookingNotifications'
      : eventType === 'hiring_request_created'
      ? 'matchingJobs'
      : 'applicationUpdates';

    const resolvedTone = getToneTypeForEvent({
      toneType: typeof params.body?.toneType === 'string' ? params.body.toneType : undefined,
      eventType,
      category: resolvedCategory,
    });

    const playSound = isToneEnabledForPref(pref, resolvedTone);

    const target: DeliveryTarget = {
      uid: recipientUid,
      label: resolvedRole === 'worker' ? 'Worker' : 'Customer / Employer',
      role: resolvedRole,
      isDemo: false,
      language: lang,
      tokens: activeTokenDocs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
      title: msg.title,
      body: msg.body,
      eventType,
      toneType: resolvedTone,
      playSound,
      category: resolvedCategory,
      targetRoute,
      ...(jobId ? { targetJobId: jobId } : {}),
      clickUrl: `/?route=${encodeURIComponent(targetRoute)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`,
      dedupeKey: requestedDedupeKey || `event_${eventType}_${jobId || 'na'}_${Date.now()}`,
    };

    const result = await dispatchAndRecordTargets({
      runtime,
      targets: [target],
      sentByUid: authUser.decoded.uid,
    });
    return { httpStatus: 200, payload: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Customer notification failed';
    return { httpStatus: 500, payload: { ok: false, errorCode: 'SERVER_ERROR', message } };
  }
}

export async function handleAdminDemoNotification(params: {
  authHeader: string;
  body: Record<string, unknown>;
  rootDir: string;
}): Promise<NotificationHandlerResult> {
  const runtime = getAdminRuntime(params.rootDir);
  const authUser = await verifyAuthHeader(params.authHeader, runtime);
  if (!authUser || !authUser.isAdmin) {
    return { httpStatus: 403, payload: { error: 'FORBIDDEN', message: 'Admin privileges required.' } };
  }
  if (!checkRateLimit(authUser.decoded.uid, 50)) {
    return { httpStatus: 429, payload: { error: 'RATE_LIMITED' } };
  }

  const action = typeof params.body?.action === 'string' ? params.body.action : '';
  const confirmed = params.body?.confirmed === true;
  const customTitle = typeof params.body?.title === 'string' ? params.body.title.trim().slice(0, 140) : '';
  const customBody = typeof params.body?.body === 'string' ? params.body.body.trim().slice(0, 400) : '';
  const lang = getLanguageOrDefault(params.body?.language);

  if (!runtime.hasMessagingCredentials) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        errorCode: 'ADMIN_CREDENTIALS_MISSING',
        message:
          'Server Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or Cloud Run ADC) are not configured. No fake push notifications were sent.',
        attemptedTokens: 0,
        sentCount: 0,
        failedCount: 0,
      },
    };
  }

  try {
    const targets: DeliveryTarget[] = [];

    if (action === 'test_self') {
      const myTokensSnap = await runtime.db
        .collection('device_tokens')
        .where('ownerUid', '==', authUser.decoded.uid)
        .get();
      const myActiveDocs = myTokensSnap.docs.filter((d) => d.data().enabled === true && Boolean(d.data().token));

      if (myActiveDocs.length === 0) {
        return {
          httpStatus: 400,
          payload: {
            ok: false,
            errorCode: 'NO_ADMIN_DEVICE_TOKEN',
            message: 'No enabled device token found for your admin account. Click "Enable Notifications" on this device first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          },
        };
      }

      targets.push({
        uid: authUser.decoded.uid,
        label: authUser.decoded.email || 'Admin Device',
        role: 'admin',
        isDemo: true,
        language: lang,
        tokens: myActiveDocs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
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
      const targetUid = typeof params.body?.targetUid === 'string' ? params.body.targetUid.trim() : '';
      const targetLabel = typeof params.body?.targetLabel === 'string' ? params.body.targetLabel.trim() : 'Selected Worker';
      if (!targetUid) {
        return { httpStatus: 400, payload: { ok: false, errorCode: 'MISSING_TARGET', message: 'Select a worker first.' } };
      }
      const workerTokensSnap = await runtime.db
        .collection('device_tokens')
        .where('ownerUid', '==', targetUid)
        .get();
      const workerActiveDocs = workerTokensSnap.docs.filter((d) => d.data().enabled === true && Boolean(d.data().token));

      if (workerActiveDocs.length === 0) {
        return {
          httpStatus: 400,
          payload: {
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEVICE',
            message: 'Selected worker has not enabled push notifications on a mobile/browser device yet.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          },
        };
      }

      targets.push({
        uid: targetUid,
        label: targetLabel,
        role: workerActiveDocs[0].data().isDemo ? 'demo_worker' : 'worker',
        isDemo: Boolean(workerActiveDocs[0].data().isDemo),
        language: lang,
        tokens: workerActiveDocs.map((d) => ({ docId: d.id, token: String(d.data().token) })),
        title: customTitle || '[DEMO] Test Notification from ROJGAR SETU',
        body: customBody || 'Admin live notification verification message.',
        category: 'announcements',
        targetRoute: 'worker-dashboard',
        clickUrl: '/?route=worker-dashboard',
        dedupeKey: `admin_worker_${targetUid}_${Date.now()}`,
      });
    } else if (action === 'test_all_demo_workers') {
      if (!confirmed) {
        return { httpStatus: 400, payload: { ok: false, errorCode: 'CONFIRMATION_REQUIRED', message: 'Explicit confirmation required.' } };
      }
      const enabledSnap = await runtime.db
        .collection('device_tokens')
        .where('enabled', '==', true)
        .get();
      const demoDocs = enabledSnap.docs.filter((d) => Boolean(d.data().isDemo) && Boolean(d.data().token));

      if (demoDocs.length === 0) {
        return {
          httpStatus: 400,
          payload: {
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEMO_DEVICE',
            message: 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          },
        };
      }

      const byUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
      demoDocs.forEach((d) => {
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
      const demoJobId = typeof params.body?.demoJobId === 'string' ? params.body.demoJobId.trim() : '';
      if (!demoJobId) {
        return { httpStatus: 400, payload: { ok: false, errorCode: 'MISSING_DEMO_JOB_ID', message: 'Demo Job ID is required.' } };
      }
      const djSnap = await runtime.db.collection('demo_jobs').doc(demoJobId).get();
      if (!djSnap.exists) {
        return { httpStatus: 404, payload: { ok: false, errorCode: 'DEMO_JOB_NOT_FOUND', message: 'Demo job not found.' } };
      }
      const dj = djSnap.data()!;

      const enabledSnap = await runtime.db
        .collection('device_tokens')
        .where('enabled', '==', true)
        .get();
      const demoDocs = enabledSnap.docs.filter((d) => Boolean(d.data().isDemo) && Boolean(d.data().token));

      if (demoDocs.length === 0) {
        return {
          httpStatus: 400,
          payload: {
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEMO_DEVICE',
            message: 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          },
        };
      }

      const byUid = new Map<string, Array<{ docId: string; token: string; preferredLanguage?: string }>>();
      demoDocs.forEach((d) => {
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
        return { httpStatus: 400, payload: { ok: false, errorCode: 'CONFIRMATION_REQUIRED', message: 'Confirmation required.' } };
      }
      const audience = params.body?.audience === 'all_opted_in' ? 'all_opted_in' : 'demo_only';
      const snap = await runtime.db.collection('device_tokens').where('enabled', '==', true).get();
      const matchingDocs = snap.docs.filter((d) => {
        const data = d.data();
        if (!data.token) return false;
        return audience === 'demo_only' ? Boolean(data.isDemo) : true;
      });

      if (matchingDocs.length === 0) {
        return {
          httpStatus: 400,
          payload: {
            ok: false,
            errorCode: 'NO_ELIGIBLE_DEVICE',
            message:
              audience === 'demo_only'
                ? 'No eligible demo device is registered. Install the app on a test mobile and enable notifications first.'
                : 'No opted-in device tokens are registered yet.',
            attemptedTokens: 0,
            sentCount: 0,
            failedCount: 0,
          },
        };
      }

      const byUid = new Map<string, Array<{ docId: string; token: string; isDemo?: boolean; preferredLanguage?: string }>>();
      matchingDocs.forEach((d) => {
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
      return { httpStatus: 400, payload: { ok: false, errorCode: 'UNKNOWN_ACTION', message: 'Invalid demo notification action.' } };
    }

    const dispatchResult = await dispatchAndRecordTargets({
      runtime,
      targets,
      sentByUid: authUser.decoded.uid,
    });

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

    return { httpStatus: 200, payload: dispatchResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin demo notification error';
    return { httpStatus: 500, payload: { ok: false, errorCode: 'SERVER_ERROR', message } };
  }
}

export function registerNotificationRoutes(
  app: { get: (p: string, h: (req: Request, res: Response) => void | Promise<void>) => void; post: (p: string, h: (req: Request, res: Response) => void | Promise<void>) => void },
  rootDir: string
): void {
  app.get('/api/notifications/config-status', (req: Request, res: Response) => {
    const result = handleNotificationConfigStatus({
      rootDir,
      headers: req.headers as Record<string, unknown>,
      secure: req.secure,
      hostname: req.hostname,
    });
    res.status(result.httpStatus).json(result.payload);
  });

  app.post('/api/notifications/send-matching-job', async (req: Request, res: Response) => {
    const result = await handleSendMatchingJob({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
  });

  app.post('/api/notifications/expand-job-radius', async (req: Request, res: Response) => {
    const result = await handleExpandJobRadius({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
  });

  app.post('/api/notifications/send-customer-event', async (req: Request, res: Response) => {
    const result = await handleSendCustomerEvent({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
  });

  app.post('/api/notifications/admin-demo', async (req: Request, res: Response) => {
    const result = await handleAdminDemoNotification({
      authHeader: req.headers.authorization || '',
      body: (req.body || {}) as Record<string, unknown>,
      rootDir,
    });
    res.status(result.httpStatus).json(result.payload);
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
      .get();

    const activeTokenDocs = tokenSnap.docs.filter((d) => {
      const data = d.data() as { enabled?: boolean; token?: string };
      return data.enabled === true && Boolean(data.token);
    });

    if (activeTokenDocs.length === 0) {
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

    const tokens = activeTokenDocs.map((d) => ({
      docId: d.id,
      token: String((d.data() as { token?: string }).token || ''),
    })).filter((t) => Boolean(t.token));

    const firstTokenLang = getLanguageOrDefault((activeTokenDocs[0].data() as { preferredLanguage?: string })?.preferredLanguage);
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
