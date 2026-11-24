import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { grantAcceptedCustomerPhoto } from './photoStorageService';
import { normalizeTenDigitIndianMobile } from './pinAuth';
import {
  DEFAULT_ROTATION_BATCH_SIZE,
  SERVICE_RADIUS_STAGES,
  buildApproxLocationLabel,
  buildSmartJobNotificationContent,
  calculateValidDistanceKm,
  doesCategoryMatch,
  evaluateWorkerEligibilityForJob,
  getNextRadiusStage,
  isJobConfirmationClosed,
  normalizeCategoryToken,
  normalizeRadiusKm,
  rankWorkersForFairRotation,
  resolveRotationBatchSize,
  selectNextFairRotationBatch,
} from './smartVoiceJobAlert';
import {
  formatMaskedBridgeCode,
  formatMaskedVirtualDisplay,
  getApproximateCoordinates,
  sanitizeNotificationTextForPrivacy,
} from './customerPrivacy';
import type {
  AppNotificationRecord,
  AuditLog,
  CustomerGender,
  CustomerPreference,
  CustomerProfileVisibility,
  DealLocationShare,
  DealMessage,
  DealNotificationEventType,
  DealStatus,
  DemoJobApplication,
  DemoJobPosting,
  DemoWorkerAccount,
  DeviceTokenRecord,
  EmployerPrivateInfo,
  GrievanceReport,
  JobApplication,
  JobPosting,
  Language,
  MaskedCallSession,
  MaskedCallStatus,
  NotificationCategoryKey,
  NotificationDeliveryLog,
  NotificationPreferences,
  NotificationToneType,
  OrderExactAddressRecord,
  PartnershipEnquiry,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
  ServiceRadiusKm,
  VehicleBooking,
  VehicleListing,
  VehiclePrivateInfo,
  VehicleType,
  VerificationStatus,
  WorkerPrivateInfo,
} from '../types/domain';
import { getToneTypeForEvent } from './dealWorkflow';

export { normalizeCategoryToken };

export function subscribePublicWorkers(onData: (items: PublicWorkerProfile[]) => void): () => void {
  const path = 'publicWorkers';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PublicWorkerProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePublicEmployers(onData: (items: PublicEmployerProfile[]) => void): () => void {
  const path = 'publicEmployers';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PublicEmployerProfile)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeJobs(onData: (items: JobPosting[]) => void): () => void {
  const path = 'jobs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobPosting)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAnnouncements(onData: (items: PlatformAnnouncement[]) => void): () => void {
  const path = 'announcements';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformAnnouncement)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeWorkerApplications(
  workerUid: string,
  onData: (items: JobApplication[]) => void
): () => void {
  const path = 'applications';
  const q = query(collection(db, path), where('workerUid', '==', workerUid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobApplication)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeEmployerApplications(
  employerUid: string,
  onData: (items: JobApplication[]) => void
): () => void {
  const path = 'applications';
  const q = query(collection(db, path), where('employerUid', '==', employerUid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobApplication)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllApplicationsAdmin(onData: (items: JobApplication[]) => void): () => void {
  const path = 'applications';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobApplication)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAdminEnquiries(onData: (items: PartnershipEnquiry[]) => void): () => void {
  const path = 'partnershipEnquiries';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnershipEnquiry)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAdminGrievances(onData: (items: GrievanceReport[]) => void): () => void {
  const path = 'grievances';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GrievanceReport)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAdminAuditLogs(onData: (items: AuditLog[]) => void): () => void {
  const path = 'auditLogs';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function computeMobileLockId(rawMobile: string): Promise<string> {
  const clean10 = normalizeTenDigitIndianMobile(rawMobile);
  const input = `rojgar-setu-mobile-lock-v1:${clean10}`;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `mob_${hex}`;
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `mob_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function saveWorkerRegistration(
  uid: string,
  _isExisting: boolean,
  publicData: Omit<PublicWorkerProfile, 'id' | 'createdAt' | 'updatedAt'>,
  privateData: Omit<WorkerPrivateInfo, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const pubRef = doc(db, 'publicWorkers', uid);
  const privRef = doc(db, 'workerPrivate', uid);
  const normalizedMobile = normalizeTenDigitIndianMobile(privateData.mobile);
  const newLockId = await computeMobileLockId(normalizedMobile);
  const newLockRef = doc(db, 'mobileUniquenessLocks', newLockId);

  let oldLockId: string | null = null;
  try {
    const existingPrivSnap = await getDoc(privRef);
    const prevMobile = existingPrivSnap.exists() ? (existingPrivSnap.data()?.mobile as string | undefined) : undefined;
    if (prevMobile) {
      const candidateOld = await computeMobileLockId(prevMobile);
      if (candidateOld !== newLockId) {
        oldLockId = candidateOld;
      }
    }
  } catch {
    oldLockId = null;
  }

  try {
    await runTransaction(db, async (tx) => {
      const oldLockRef = oldLockId ? doc(db, 'mobileUniquenessLocks', oldLockId) : null;
      const [pubSnap, privSnap, newLockSnap, oldLockSnap] = await Promise.all([
        tx.get(pubRef),
        tx.get(privRef),
        tx.get(newLockRef),
        oldLockRef ? tx.get(oldLockRef) : Promise.resolve(null),
      ]);

      if (newLockSnap.exists()) {
        const lockOwner = (newLockSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
        if (lockOwner && lockOwner !== uid) {
          throw new Error(
            `DUPLICATE_MOBILE: Mobile number +91 ${normalizedMobile} is already registered with another account.`
          );
        }
      }

      const cleanPub = { ...publicData };
      if (!cleanPub.photoDocId) delete cleanPub.photoDocId;
      if (!cleanPub.customProfessionId) delete cleanPub.customProfessionId;
      if (!cleanPub.customProfessionName) delete cleanPub.customProfessionName;
      if (!cleanPub.customProfessionStatus) delete cleanPub.customProfessionStatus;
      if (!cleanPub.workDescription) delete cleanPub.workDescription;
      if (!cleanPub.workPhotoUrls || cleanPub.workPhotoUrls.length === 0) delete cleanPub.workPhotoUrls;
      const cleanPriv = { ...privateData, mobile: normalizedMobile };
      if (!cleanPriv.photoDocId) delete cleanPriv.photoDocId;

      if (!pubSnap.exists()) {
        tx.set(pubRef, {
          ...cleanPub,
          verificationStatus: 'pending',
          registrationPaymentStatus: 'pending',
          paidBenefitsActive: false,
          completedJobsCount: 0,
          ratingAvg: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(pubRef, {
          displayName: cleanPub.displayName,
          primarySkill: cleanPub.primarySkill,
          skills: cleanPub.skills,
          experienceYears: cleanPub.experienceYears,
          expectedWage: cleanPub.expectedWage,
          wageUnit: cleanPub.wageUnit,
          preferredWorkType: cleanPub.preferredWorkType,
          availabilityStatus: cleanPub.availabilityStatus,
          state: cleanPub.state,
          district: cleanPub.district,
          cityOrVillage: cleanPub.cityOrVillage,
          approxLat: cleanPub.approxLat,
          approxLng: cleanPub.approxLng,
          languagesKnown: cleanPub.languagesKnown,
          ...(cleanPub.gender ? { gender: cleanPub.gender } : {}),
          ...(cleanPub.education ? { education: cleanPub.education } : {}),
          ...(typeof cleanPub.isWomenEnterprise === 'boolean' ? { isWomenEnterprise: cleanPub.isWomenEnterprise } : {}),
          ...(cleanPub.preferredLanguage ? { preferredLanguage: cleanPub.preferredLanguage } : {}),
          ...(cleanPub.preferredRadiusKm ? { preferredRadiusKm: cleanPub.preferredRadiusKm } : {}),
          ...(typeof cleanPub.voiceAlertsEnabled === 'boolean' ? { voiceAlertsEnabled: cleanPub.voiceAlertsEnabled } : {}),
          ...(publicData.photoDocId === ''
            ? { photoDocId: deleteField() }
            : cleanPub.photoDocId
              ? { photoDocId: cleanPub.photoDocId }
              : {}),
          ...(cleanPub.customProfessionId ? { customProfessionId: cleanPub.customProfessionId } : {}),
          ...(cleanPub.customProfessionName ? { customProfessionName: cleanPub.customProfessionName } : {}),
          ...(cleanPub.customProfessionStatus ? { customProfessionStatus: cleanPub.customProfessionStatus } : {}),
          ...(cleanPub.workDescription ? { workDescription: cleanPub.workDescription } : {}),
          ...(cleanPub.workPhotoUrls && cleanPub.workPhotoUrls.length > 0
            ? { workPhotoUrls: cleanPub.workPhotoUrls.slice(0, 4) }
            : {}),
          updatedAt: serverTimestamp(),
        });
      }

      if (!privSnap.exists()) {
        tx.set(privRef, {
          ...cleanPriv,
          registrationPaymentStatus: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(privRef, {
          fullName: cleanPriv.fullName,
          mobile: cleanPriv.mobile,
          mobileVerified: cleanPriv.mobileVerified,
          ...(cleanPriv.verificationMethod ? { verificationMethod: cleanPriv.verificationMethod } : {}),
          ...(cleanPriv.testPinHash ? { testPinHash: cleanPriv.testPinHash } : {}),
          ...(cleanPriv.email ? { email: cleanPriv.email } : {}),
          ageConfirmed: cleanPriv.ageConfirmed,
          ...(cleanPriv.preferredWorkLocation ? { preferredWorkLocation: cleanPriv.preferredWorkLocation } : {}),
          liveLocationConsent: cleanPriv.liveLocationConsent,
          privacyConsent: cleanPriv.privacyConsent,
          ...(typeof cleanPriv.refundPolicyAccepted === 'boolean'
            ? { refundPolicyAccepted: cleanPriv.refundPolicyAccepted }
            : {}),
          ...(typeof cleanPriv.noEmploymentGuaranteeAccepted === 'boolean'
            ? { noEmploymentGuaranteeAccepted: cleanPriv.noEmploymentGuaranteeAccepted }
            : {}),
          idVerificationStatus: cleanPriv.idVerificationStatus,
          ...(cleanPriv.certificateNotes ? { certificateNotes: cleanPriv.certificateNotes } : {}),
          ...(cleanPriv.photoUrl ? { photoUrl: cleanPriv.photoUrl } : {}),
          ...(privateData.photoDocId === ''
            ? { photoDocId: deleteField() }
            : cleanPriv.photoDocId
              ? { photoDocId: cleanPriv.photoDocId }
              : {}),
          updatedAt: serverTimestamp(),
        });
      }

      if (newLockSnap.exists()) {
        tx.update(newLockRef, {
          role: 'worker',
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(newLockRef, {
          ownerUid: uid,
          role: 'worker',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (oldLockRef && oldLockSnap?.exists()) {
        const oldOwner = (oldLockSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
        if (oldOwner === uid) {
          tx.delete(oldLockRef);
        }
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE_MOBILE:')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `publicWorkers/${uid}`);
  }
}

export async function saveEmployerRegistration(
  uid: string,
  _isExisting: boolean,
  publicData: Omit<PublicEmployerProfile, 'id' | 'createdAt' | 'updatedAt'>,
  privateData: Omit<EmployerPrivateInfo, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const pubRef = doc(db, 'publicEmployers', uid);
  const privRef = doc(db, 'employerPrivate', uid);
  const normalizedMobile = normalizeTenDigitIndianMobile(privateData.mobile);
  const newLockId = await computeMobileLockId(normalizedMobile);
  const newLockRef = doc(db, 'mobileUniquenessLocks', newLockId);

  let oldLockId: string | null = null;
  try {
    const existingPrivSnap = await getDoc(privRef);
    const prevMobile = existingPrivSnap.exists() ? (existingPrivSnap.data()?.mobile as string | undefined) : undefined;
    if (prevMobile) {
      const candidateOld = await computeMobileLockId(prevMobile);
      if (candidateOld !== newLockId) {
        oldLockId = candidateOld;
      }
    }
  } catch {
    oldLockId = null;
  }

  try {
    await runTransaction(db, async (tx) => {
      const oldLockRef = oldLockId ? doc(db, 'mobileUniquenessLocks', oldLockId) : null;
      const [pubSnap, privSnap, newLockSnap, oldLockSnap] = await Promise.all([
        tx.get(pubRef),
        tx.get(privRef),
        tx.get(newLockRef),
        oldLockRef ? tx.get(oldLockRef) : Promise.resolve(null),
      ]);

      if (newLockSnap.exists()) {
        const lockOwner = (newLockSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
        if (lockOwner && lockOwner !== uid) {
          throw new Error(
            `DUPLICATE_MOBILE: Mobile number +91 ${normalizedMobile} is already registered with another account.`
          );
        }
      }

      const cleanPub: Record<string, unknown> = { ...publicData };
      Object.keys(cleanPub).forEach((k) => {
        if (cleanPub[k] === undefined || cleanPub[k] === '') {
          delete cleanPub[k];
        }
      });

      const cleanPriv: Record<string, unknown> = { ...privateData, mobile: normalizedMobile };
      if (!cleanPriv.photoDocId) delete cleanPriv.photoDocId;
      Object.keys(cleanPriv).forEach((k) => {
        if (cleanPriv[k] === undefined || cleanPriv[k] === '') {
          delete cleanPriv[k];
        }
      });

      if (!pubSnap.exists()) {
        tx.set(pubRef, {
          ...cleanPub,
          verificationStatus: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(pubRef, {
          businessName: publicData.businessName,
          businessType: publicData.businessType,
          industryCategory: publicData.industryCategory,
          state: publicData.state,
          district: publicData.district,
          requiredCategories: publicData.requiredCategories,
          ...(publicData.gender ? { gender: publicData.gender } : {}),
          ...(publicData.lastName ? { lastName: publicData.lastName } : {}),
          ...(publicData.profileVisibility ? { profileVisibility: publicData.profileVisibility } : {}),
          ...(typeof publicData.hidePhotoUntilConfirm === 'boolean'
            ? { hidePhotoUntilConfirm: publicData.hidePhotoUntilConfirm }
            : {}),
          ...(typeof publicData.maskedCallingOnly === 'boolean'
            ? { maskedCallingOnly: publicData.maskedCallingOnly }
            : {}),
          updatedAt: serverTimestamp(),
        });
      }

      if (!privSnap.exists()) {
        tx.set(privRef, {
          ...cleanPriv,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(privRef, {
          contactPerson: cleanPriv.contactPerson,
          ...(cleanPriv.firstName ? { firstName: cleanPriv.firstName } : {}),
          ...(cleanPriv.lastName ? { lastName: cleanPriv.lastName } : {}),
          ...(cleanPriv.gender ? { gender: cleanPriv.gender } : {}),
          ...(cleanPriv.profileVisibility ? { profileVisibility: cleanPriv.profileVisibility } : {}),
          mobile: cleanPriv.mobile,
          mobileVerified: cleanPriv.mobileVerified,
          ...(cleanPriv.verificationMethod ? { verificationMethod: cleanPriv.verificationMethod } : {}),
          ...(cleanPriv.testPinHash ? { testPinHash: cleanPriv.testPinHash } : {}),
          email: cleanPriv.email,
          businessAddress: cleanPriv.businessAddress,
          ...(cleanPriv.gstNumber ? { gstNumber: cleanPriv.gstNumber } : {}),
          ...(cleanPriv.establishmentDetails ? { establishmentDetails: cleanPriv.establishmentDetails } : {}),
          ...(cleanPriv.workforceNotes ? { workforceNotes: cleanPriv.workforceNotes } : {}),
          ...(privateData.photoDocId === ''
            ? { photoDocId: deleteField() }
            : cleanPriv.photoDocId
              ? { photoDocId: cleanPriv.photoDocId }
              : {}),
          updatedAt: serverTimestamp(),
        });
      }

      if (newLockSnap.exists()) {
        tx.update(newLockRef, {
          role: 'employer',
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(newLockRef, {
          ownerUid: uid,
          role: 'employer',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (oldLockRef && oldLockSnap?.exists()) {
        const oldOwner = (oldLockSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
        if (oldOwner === uid) {
          tx.delete(oldLockRef);
        }
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE_MOBILE:')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `publicEmployers/${uid}`);
  }
}

export function doesWorkerMatchJob(
  job: Pick<JobPosting, 'category' | 'requiredSkills' | 'district' | 'employerUid'>,
  worker: Pick<
    PublicWorkerProfile,
    'ownerUid' | 'primarySkill' | 'skills' | 'district' | 'verificationStatus' | 'availabilityStatus'
  > & { customProfessionStatus?: PublicWorkerProfile['customProfessionStatus'] }
): { matches: boolean; skillMatches: boolean; locationMatches: boolean } {
  if (worker.ownerUid && job.employerUid && worker.ownerUid === job.employerUid) {
    return { matches: false, skillMatches: false, locationMatches: false };
  }
  if (worker.verificationStatus === 'suspended' || worker.availabilityStatus !== 'available') {
    return { matches: false, skillMatches: false, locationMatches: false };
  }
  if (worker.customProfessionStatus === 'pending' || worker.customProfessionStatus === 'rejected') {
    return { matches: false, skillMatches: false, locationMatches: false };
  }
  const skillMatches = doesCategoryMatch(
    job.category || '',
    job.requiredSkills || [],
    worker.primarySkill || '',
    worker.skills || []
  );

  const locationMatches =
    Boolean(job.district) &&
    Boolean(worker.district) &&
    job.district.toLowerCase().trim() === worker.district.toLowerCase().trim();

  return {
    matches: skillMatches,
    skillMatches,
    locationMatches,
  };
}

function sanitizeSafeId(raw: string, fallbackPrefix = 'ntf'): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 115);
  if (clean.length >= 8) return clean;
  return `${fallbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getEffectiveDealStatus(
  app: Pick<JobApplication, 'status' | 'dealStatus' | 'offerSubmittedAt'>
): DealStatus {
  if (app.dealStatus) return app.dealStatus;
  switch (app.status) {
    case 'invited':
      return 'NOTIFIED';
    case 'applied':
      return 'OFFER_RECEIVED';
    case 'accepted':
      return 'OFFER_ACCEPTED';
    case 'work_completed':
      return 'WORK_COMPLETED';
    case 'declined':
      return 'REJECTED';
    default:
      return 'REQUESTED';
  }
}

export async function dispatchTwoWayDealNotification(params: {
  recipientUid: string;
  recipientRole: 'worker' | 'employer';
  senderUid: string;
  senderName: string;
  category: NotificationCategoryKey;
  eventType: DealNotificationEventType;
  dealStatus?: DealStatus;
  title: string;
  body: string;
  language?: Language;
  voiceScript?: string;
  approxLocationLabel?: string;
  distanceKm?: number | null;
  customerName?: string;
  jobCategory?: string;
  playSound?: boolean;
  speakVoice?: boolean;
  toneType?: NotificationToneType;
  metadataLabel?: string;
  targetRoute: string;
  targetJobId?: string;
  targetApplicationId?: string;
  dedupeKey: string;
  pushPayload?: {
    workerName: string;
    jobTitle: string;
    proposedWage?: number;
    eta?: string;
    locationLabel?: string;
    messageSnippet?: string;
  };
}): Promise<void> {
  if (!params.recipientUid || params.recipientUid === params.senderUid) return;
  const safeId = sanitizeSafeId(params.dedupeKey, 'ntf');
  const notifRef = doc(db, 'notifications', safeId);
  const resolvedTone = getToneTypeForEvent({
    toneType: params.toneType,
    eventType: params.eventType,
    dealStatus: params.dealStatus,
    category: params.category,
  });

  const validDist =
    typeof params.distanceKm === 'number' &&
    Number.isFinite(params.distanceKm) &&
    params.distanceKm >= 0 &&
    params.distanceKm <= 5000
      ? params.distanceKm
      : undefined;

  const safeLanguage: Language =
    params.language === 'hi' || params.language === 'mr' ? params.language : 'en';
  const rawTitle = (params.title || 'ROJGAR SETU Alert').trim().slice(0, 160);
  const safeTitle = rawTitle.length >= 2 ? rawTitle : 'ROJGAR SETU Alert';
  const rawBody = (params.body || 'New work update on ROJGAR SETU.').trim().slice(0, 500);
  const safeBody = rawBody.length >= 2 ? rawBody : 'New work update on ROJGAR SETU.';

  try {
    // Call setDoc directly without a pre-read getDoc: Firestore rules reject getDoc on
    // non-existent or other-user notification docs while enforcing !exists(...) on create.
    await setDoc(notifRef, {
      recipientUid: params.recipientUid,
      recipientRole: params.recipientRole,
      senderUid: params.senderUid,
      senderName: (params.senderName || 'ROJGAR SETU User').slice(0, 140),
      isDemo: false,
      category: params.category,
      eventType: params.eventType,
      toneType: resolvedTone,
      ...(params.dealStatus ? { dealStatus: params.dealStatus } : {}),
      title: safeTitle,
      body: safeBody,
      ...(params.voiceScript ? { voiceScript: params.voiceScript.slice(0, 680) } : {}),
      ...(params.approxLocationLabel ? { approxLocationLabel: params.approxLocationLabel.slice(0, 155) } : {}),
      ...(validDist !== undefined ? { distanceKm: validDist } : {}),
      ...(params.customerName ? { customerName: params.customerName.slice(0, 155) } : {}),
      ...(params.jobCategory ? { jobCategory: params.jobCategory.slice(0, 75) } : {}),
      ...(typeof params.playSound === 'boolean' ? { playSound: params.playSound } : {}),
      ...(typeof params.speakVoice === 'boolean' ? { speakVoice: params.speakVoice } : {}),
      ...(params.metadataLabel ? { metadataLabel: params.metadataLabel.slice(0, 240) } : {}),
      language: safeLanguage,
      targetRoute: params.targetRoute.slice(0, 60),
      ...(params.targetJobId ? { targetJobId: params.targetJobId } : {}),
      ...(params.targetApplicationId ? { targetApplicationId: params.targetApplicationId } : {}),
      dedupeKey: safeId,
      deliveryStatus: 'in_app_only',
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('In-app notification record creation skipped or rejected:', err);
  }

  // Also trigger backend FCM push if messaging credentials are configured
  if (params.pushPayload) {
    void callNotificationApi('/api/notifications/send-customer-event', {
      recipientUid: params.recipientUid,
      recipientRole: params.recipientRole,
      eventType: params.eventType,
      toneType: resolvedTone,
      workerName: params.pushPayload.workerName,
      jobTitle: params.pushPayload.jobTitle,
      ...(params.targetJobId ? { jobId: params.targetJobId } : {}),
      ...(typeof params.pushPayload.proposedWage === 'number'
        ? { proposedWage: params.pushPayload.proposedWage }
        : {}),
      ...(params.pushPayload.eta ? { eta: params.pushPayload.eta } : {}),
      ...(params.pushPayload.locationLabel ? { locationLabel: params.pushPayload.locationLabel } : {}),
      ...(params.pushPayload.messageSnippet ? { messageSnippet: params.pushPayload.messageSnippet } : {}),
      dedupeKey: safeId,
      targetRoute: params.targetRoute,
    }).catch(() => undefined);
  }
}

export async function createJobPosting(
  payload: Omit<JobPosting, 'id' | 'status' | 'applicationsCount' | 'createdAt' | 'updatedAt'>,
  idempotencyKey?: string
): Promise<string> {
  const path = 'jobs';
  const safeKey = idempotencyKey ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) : '';
  const approxLocationLabel =
    payload.approxLocationLabel ||
    buildApproxLocationLabel({
      cityOrVillage: payload.cityOrVillage,
      district: payload.district,
      state: payload.state,
    });
  const initialRadiusKm = normalizeRadiusKm(payload.initialRadiusKm ?? 2, 2);
  const currentRadiusKm = normalizeRadiusKm(payload.currentRadiusKm ?? initialRadiusKm, initialRadiusKm);

  try {
    const baseDoc = {
      ...payload,
      approxLocationLabel: approxLocationLabel.slice(0, 160),
      initialRadiusKm,
      currentRadiusKm,
      radiusStageUpdatedAt: serverTimestamp(),
      status: 'open' as const,
      dealStatus: payload.dealStatus || ('REQUESTED' as const),
      applicationsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (safeKey && safeKey.length >= 8) {
      const targetRef = doc(db, path, safeKey);
      const existingSnap = await getDoc(targetRef);
      if (existingSnap.exists()) {
        return existingSnap.id;
      }
      await setDoc(targetRef, baseDoc);
      return safeKey;
    }

    const ref = await addDoc(collection(db, path), baseDoc);
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

function extractTimestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (value && typeof value === 'object') {
    const maybeObj = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybeObj.toMillis === 'function') {
      const ms = maybeObj.toMillis();
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
    if (typeof maybeObj.seconds === 'number' && Number.isFinite(maybeObj.seconds) && maybeObj.seconds > 0) {
      return maybeObj.seconds * 1000;
    }
  }
  return 0;
}

/**
 * Updates a worker's fair-rotation position ONLY when a job is genuinely confirmed.
 * Idempotent per applicationId (re-confirming the same application never double-increments).
 * NEVER call this when dispatching alerts or when a worker misses/declines a notification.
 */
export async function recordWorkerConfirmedJobRotation(params: {
  workerUid: string;
  applicationId: string;
  confirmedAtMs?: number;
}): Promise<boolean> {
  const { workerUid, applicationId, confirmedAtMs } = params;
  if (!workerUid || !applicationId) return false;

  try {
    const workerRef = doc(db, 'publicWorkers', workerUid);
    const workerSnap = await getDoc(workerRef);
    if (!workerSnap.exists()) return false;

    const data = workerSnap.data() as Partial<PublicWorkerProfile>;
    if (data.lastConfirmedApplicationId === applicationId) {
      return false;
    }

    const prevCount =
      typeof data.confirmedJobsCount === 'number' &&
      Number.isFinite(data.confirmedJobsCount) &&
      data.confirmedJobsCount >= 0
        ? Math.floor(data.confirmedJobsCount)
        : 0;
    const prevLastMs =
      typeof data.lastConfirmedJobAtMs === 'number' &&
      Number.isFinite(data.lastConfirmedJobAtMs) &&
      data.lastConfirmedJobAtMs >= 0
        ? Math.floor(data.lastConfirmedJobAtMs)
        : 0;
    const nextConfirmedMs = Math.max(prevLastMs, Math.floor(confirmedAtMs ?? Date.now()));

    await updateDoc(workerRef, {
      confirmedJobsCount: prevCount + 1,
      lastConfirmedJobAtMs: nextConfirmedMs,
      lastConfirmedApplicationId: applicationId.slice(0, 140),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch {
    // Non-blocking: never break deal confirmation flow if rotation metadata sync fails
    return false;
  }
}

export type SmartBroadcastJobInput = Pick<
  JobPosting,
  | 'employerUid'
  | 'employerName'
  | 'title'
  | 'category'
  | 'requiredSkills'
  | 'district'
  | 'state'
  | 'cityOrVillage'
  | 'workLocationLabel'
  | 'jobDate'
  | 'startTime'
  | 'offeredWage'
  | 'wageUnit'
  | 'description'
> & {
  lat?: number;
  lng?: number;
  approxLocationLabel?: string;
  initialRadiusKm?: ServiceRadiusKm;
  currentRadiusKm?: ServiceRadiusKm;
  workersRequired?: number;
  status?: JobPosting['status'];
  dealStatus?: DealStatus;
  acceptedApplicationId?: string;
  acceptedWorkerUid?: string;
  dispatchBatchIndex?: number;
  dispatchBatchSize?: number;
  lastBatchDispatchedAtMs?: number;
  eligiblePoolCount?: number;
};

export interface SmartBroadcastBatchResult {
  notifiedCount: number;
  finalRadiusKm: ServiceRadiusKm;
  hasNextStage: boolean;
  hasNextBatch: boolean;
  remainingEligibleCount: number;
  batchIndex: number;
  totalEligibleCount: number;
  newlyNotifiedUids: string[];
  notifiedWorkerUids: string[];
  closed: boolean;
}

export async function broadcastSmartJobAlerts(params: {
  jobId: string;
  job: SmartBroadcastJobInput;
  workers: PublicWorkerProfile[];
  alreadyNotifiedUids?: string[];
  stageRadiusKm?: ServiceRadiusKm;
  autoExpandIfEmpty?: boolean;
  batchSize?: number;
  dedupeSuffix?: string;
}): Promise<SmartBroadcastBatchResult> {
  const {
    jobId,
    job,
    workers,
    alreadyNotifiedUids = [],
    stageRadiusKm,
    autoExpandIfEmpty = true,
    batchSize,
    dedupeSuffix,
  } = params;

  const seenUids = new Set(alreadyNotifiedUids.filter(Boolean));
  let activeRadius: ServiceRadiusKm = normalizeRadiusKm(
    stageRadiusKm ?? job.currentRadiusKm ?? job.initialRadiusKm ?? 2,
    2
  );
  const resolvedBatchSize = resolveRotationBatchSize(
    job.workersRequired,
    batchSize ?? job.dispatchBatchSize ?? DEFAULT_ROTATION_BATCH_SIZE
  );
  const priorBatchIndex =
    typeof job.dispatchBatchIndex === 'number' && Number.isFinite(job.dispatchBatchIndex) && job.dispatchBatchIndex >= 0
      ? Math.floor(job.dispatchBatchIndex)
      : 0;

  if (isJobConfirmationClosed(job)) {
    return {
      notifiedCount: 0,
      finalRadiusKm: activeRadius,
      hasNextStage: false,
      hasNextBatch: false,
      remainingEligibleCount: 0,
      batchIndex: priorBatchIndex,
      totalEligibleCount: 0,
      newlyNotifiedUids: [],
      notifiedWorkerUids: Array.from(seenUids),
      closed: true,
    };
  }

  const evaluateAtStage = (radiusKm: ServiceRadiusKm) =>
    workers
      .map((w) => {
        const evalRes = evaluateWorkerEligibilityForJob({
          job: {
            employerUid: job.employerUid,
            category: job.category,
            requiredSkills: job.requiredSkills || [],
            district: job.district,
            cityOrVillage: job.cityOrVillage,
            approxLocationLabel: job.approxLocationLabel,
            workLocationLabel: job.workLocationLabel,
            lat: Number(job.lat),
            lng: Number(job.lng),
          },
          worker: {
            ownerUid: w.ownerUid,
            displayName: w.displayName,
            primarySkill: w.primarySkill,
            skills: w.skills || [],
            district: w.district,
            cityOrVillage: w.cityOrVillage,
            approxLat: w.approxLat,
            approxLng: w.approxLng,
            verificationStatus: w.verificationStatus,
            availabilityStatus: w.availabilityStatus,
            preferredLanguage: w.preferredLanguage,
            preferredRadiusKm: w.preferredRadiusKm,
            lastConfirmedJobAtMs: w.lastConfirmedJobAtMs,
            confirmedJobsCount: w.confirmedJobsCount,
            createdAtMs: extractTimestampMs(w.createdAt),
          },
          stageRadiusKm: radiusKm,
          alreadyNotifiedUids: seenUids,
        });
        return {
          ownerUid: w.ownerUid,
          worker: w,
          evalRes,
          lastConfirmedJobAtMs: w.lastConfirmedJobAtMs,
          confirmedJobsCount: w.confirmedJobsCount,
          samePincode: evalRes.samePincode,
          sameCity: evalRes.sameCity,
          sameDistrict: evalRes.sameDistrict,
          distanceKm: evalRes.distanceKm,
          createdAtMs: extractTimestampMs(w.createdAt),
        };
      })
      .filter((entry) => entry.evalRes.eligible);

  let matchedEntries = evaluateAtStage(activeRadius);

  if (matchedEntries.length === 0 && autoExpandIfEmpty) {
    for (const candidateStage of SERVICE_RADIUS_STAGES) {
      if (candidateStage <= activeRadius) continue;
      activeRadius = candidateStage;
      matchedEntries = evaluateAtStage(activeRadius);
      if (matchedEntries.length > 0) break;
    }
  }

  const rankedEntries = rankWorkersForFairRotation(matchedEntries);
  const batchSelection = selectNextFairRotationBatch(rankedEntries, {
    batchSize: resolvedBatchSize,
    alreadyNotifiedUids: seenUids,
  });

  const approxLocLabel =
    job.approxLocationLabel ||
    buildApproxLocationLabel({
      cityOrVillage: job.cityOrVillage,
      district: job.district,
      state: job.state,
    });
  const wageSummary = job.offeredWage > 0 ? `₹${job.offeredWage}/${job.wageUnit}` : '';

  const notifiedUids: string[] = [...alreadyNotifiedUids];
  const newlyNotifiedUids: string[] = [];
  let dispatchedCount = 0;

  for (const { worker: w, evalRes } of batchSelection.batch) {
    notifiedUids.push(w.ownerUid);
    newlyNotifiedUids.push(w.ownerUid);
    dispatchedCount += 1;

    const workerLang: Language = w.preferredLanguage || 'en';
    const speakVoice = w.voiceAlertsEnabled !== false;
    const msg = buildSmartJobNotificationContent({
      lang: workerLang,
      customerName: job.employerName,
      title: job.title,
      category: job.category,
      description: job.description || job.title,
      approxLocationLabel: approxLocLabel,
      distanceKm: evalRes.distanceKm,
      offeredWage: job.offeredWage,
      wageUnit: job.wageUnit,
    });

    await dispatchTwoWayDealNotification({
      recipientUid: w.ownerUid,
      recipientRole: 'worker',
      senderUid: job.employerUid,
      senderName: job.employerName,
      category: 'matchingJobs',
      eventType: 'hiring_request_created',
      toneType: 'new_job',
      dealStatus: 'NOTIFIED',
      title: msg.title,
      body: msg.body,
      language: workerLang,
      voiceScript: msg.voiceScript,
      approxLocationLabel: approxLocLabel,
      distanceKm: evalRes.distanceKm,
      customerName: job.employerName,
      jobCategory: job.category,
      playSound: true,
      speakVoice,
      metadataLabel: `${job.category} · ${approxLocLabel}${evalRes.distanceKm !== null ? ` (~${evalRes.distanceKm} km)` : ''}${wageSummary ? ` · ${wageSummary}` : ''}`,
      targetRoute: 'worker-dashboard',
      targetJobId: jobId,
      dedupeKey: sanitizeSafeId(`job_${jobId}_${w.ownerUid}${dedupeSuffix ? `_${dedupeSuffix}` : ''}`),
    });
  }

  const mergedNotified = Array.from(new Set(notifiedUids)).slice(0, 100);
  const mergedNotifiedSet = new Set(mergedNotified);
  const nextBatchIndex = dispatchedCount > 0 ? Math.min(50, priorBatchIndex + 1) : priorBatchIndex;
  const totalPoolEstimate = Math.min(500, seenUids.size + batchSelection.totalEligibleCount);
  const remainingBeyondCurrentRadius =
    batchSelection.remainingCount > 0
      ? batchSelection.remainingCount
      : evaluateAtStage(30).filter((entry) => !mergedNotifiedSet.has(entry.ownerUid)).length;

  await updateDoc(doc(db, 'jobs', jobId), {
    currentRadiusKm: activeRadius,
    radiusStageUpdatedAt: serverTimestamp(),
    dispatchBatchIndex: nextBatchIndex,
    dispatchBatchSize: resolvedBatchSize,
    lastBatchDispatchedAtMs: Date.now(),
    eligiblePoolCount: totalPoolEstimate,
    ...(dispatchedCount > 0 ? { dealStatus: 'NOTIFIED', notifiedWorkerUids: mergedNotified } : {}),
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  return {
    notifiedCount: dispatchedCount,
    finalRadiusKm: activeRadius,
    hasNextStage: getNextRadiusStage(activeRadius) !== null,
    hasNextBatch: remainingBeyondCurrentRadius > 0,
    remainingEligibleCount: remainingBeyondCurrentRadius,
    batchIndex: nextBatchIndex,
    totalEligibleCount: batchSelection.totalEligibleCount,
    newlyNotifiedUids,
    notifiedWorkerUids: mergedNotified,
    closed: false,
  };
}

export async function notifyMatchingWorkersInApp(params: {
  jobId: string;
  job: SmartBroadcastJobInput;
  workers: PublicWorkerProfile[];
  alreadyNotifiedUids?: string[];
  stageRadiusKm?: ServiceRadiusKm;
  autoExpandIfEmpty?: boolean;
  batchSize?: number;
}): Promise<number> {
  const res = await broadcastSmartJobAlerts(params);
  return res.notifiedCount;
}

/**
 * Dispatches the next fair-rotation batch of workers if the job is still open & unconfirmed.
 * Stops immediately once a worker confirms the job. If all eligible workers in the current
 * radius have been notified, cleanly advances to the next radius stage and notifies its top batch.
 */
export async function dispatchNextJobBatch(params: {
  job: JobPosting;
  workers: PublicWorkerProfile[];
  batchSize?: number;
}): Promise<{
  closed: boolean;
  previousRadiusKm: ServiceRadiusKm;
  currentRadiusKm: ServiceRadiusKm;
  batchIndex: number;
  newlyNotifiedCount: number;
  newlyNotifiedUids: string[];
  remainingEligibleCount: number;
  hasNextBatch: boolean;
  hasNextStage: boolean;
  totalNotifiedCount: number;
}> {
  const { job, workers, batchSize } = params;
  let freshJob: JobPosting = job;

  try {
    const freshSnap = await getDoc(doc(db, 'jobs', job.id));
    if (freshSnap.exists()) {
      freshJob = { id: freshSnap.id, ...freshSnap.data() } as JobPosting;
    }
  } catch {
    // Fallback to passed snapshot
  }

  const prevRadius = normalizeRadiusKm(freshJob.currentRadiusKm ?? freshJob.initialRadiusKm ?? 2, 2);
  const existingNotified = Array.isArray(freshJob.notifiedWorkerUids)
    ? freshJob.notifiedWorkerUids
    : [];

  if (isJobConfirmationClosed(freshJob)) {
    return {
      closed: true,
      previousRadiusKm: prevRadius,
      currentRadiusKm: prevRadius,
      batchIndex: Number(freshJob.dispatchBatchIndex) || 0,
      newlyNotifiedCount: 0,
      newlyNotifiedUids: [],
      remainingEligibleCount: 0,
      hasNextBatch: false,
      hasNextStage: false,
      totalNotifiedCount: existingNotified.length,
    };
  }

  const resolvedBatchSize = resolveRotationBatchSize(
    freshJob.workersRequired,
    batchSize ?? freshJob.dispatchBatchSize ?? DEFAULT_ROTATION_BATCH_SIZE
  );

  // 1) Try next un-notified batch in the SAME radius first
  let broadcastResult = await broadcastSmartJobAlerts({
    jobId: freshJob.id,
    job: freshJob,
    workers,
    alreadyNotifiedUids: existingNotified,
    stageRadiusKm: prevRadius,
    autoExpandIfEmpty: false,
    batchSize: resolvedBatchSize,
  });

  // 2) If current radius pool is exhausted, advance to the next radius stage automatically
  if (broadcastResult.notifiedCount === 0 && !broadcastResult.closed) {
    const nextStage = getNextRadiusStage(prevRadius);
    if (nextStage) {
      broadcastResult = await broadcastSmartJobAlerts({
        jobId: freshJob.id,
        job: freshJob,
        workers,
        alreadyNotifiedUids: existingNotified,
        stageRadiusKm: nextStage,
        autoExpandIfEmpty: true,
        batchSize: resolvedBatchSize,
      });
    }
  }

  // Trigger server FCM push for the exact newly selected fair-rotation batch
  if (broadcastResult.newlyNotifiedUids.length > 0 && !broadcastResult.closed) {
    void callNotificationApi('/api/notifications/expand-job-radius', {
      jobId: freshJob.id,
      targetRadiusKm: broadcastResult.finalRadiusKm,
      targetWorkerUids: broadcastResult.newlyNotifiedUids,
      allowSameRadiusBatch: true,
      batchSize: resolvedBatchSize,
    }).catch(() => undefined);
  }

  return {
    closed: broadcastResult.closed,
    previousRadiusKm: prevRadius,
    currentRadiusKm: broadcastResult.finalRadiusKm,
    batchIndex: broadcastResult.batchIndex,
    newlyNotifiedCount: broadcastResult.notifiedCount,
    newlyNotifiedUids: broadcastResult.newlyNotifiedUids,
    remainingEligibleCount: broadcastResult.remainingEligibleCount,
    hasNextBatch: broadcastResult.hasNextBatch,
    hasNextStage: broadcastResult.hasNextStage,
    totalNotifiedCount: broadcastResult.notifiedWorkerUids.length,
  };
}

/**
 * Computes how many eligible un-notified workers remain across all radius stages (up to 30 km).
 * Used to determine whether all eligible batches for an open job have been exhausted.
 */
export function countRemainingEligibleWorkersForJob(
  job: JobPosting,
  workers: PublicWorkerProfile[]
): number {
  if (isJobConfirmationClosed(job)) return 0;
  const seenUids = new Set(
    Array.isArray(job.notifiedWorkerUids) ? job.notifiedWorkerUids.filter(Boolean) : []
  );
  let count = 0;
  for (const w of workers) {
    const evalRes = evaluateWorkerEligibilityForJob({
      job: {
        employerUid: job.employerUid,
        category: job.category,
        requiredSkills: job.requiredSkills || [],
        district: job.district,
        cityOrVillage: job.cityOrVillage,
        approxLocationLabel: job.approxLocationLabel,
        workLocationLabel: job.workLocationLabel,
        lat: Number(job.lat),
        lng: Number(job.lng),
      },
      worker: {
        ownerUid: w.ownerUid,
        displayName: w.displayName,
        primarySkill: w.primarySkill,
        skills: w.skills || [],
        district: w.district,
        cityOrVillage: w.cityOrVillage,
        approxLat: w.approxLat,
        approxLng: w.approxLng,
        verificationStatus: w.verificationStatus,
        availabilityStatus: w.availabilityStatus,
        preferredLanguage: w.preferredLanguage,
        preferredRadiusKm: w.preferredRadiusKm,
        lastConfirmedJobAtMs: w.lastConfirmedJobAtMs,
        confirmedJobsCount: w.confirmedJobsCount,
        createdAtMs: extractTimestampMs(w.createdAt),
      },
      stageRadiusKm: 30,
      alreadyNotifiedUids: seenUids,
    });
    if (evalRes.eligible) count += 1;
  }
  return count;
}

/**
 * Restarts a fresh fair-rotation dispatch cycle for an open unconfirmed job when all batches
 * timed out without a confirmation. NEVER alters any worker's rotation timestamp/count.
 */
export async function retryJobFairRotationDispatch(params: {
  job: JobPosting;
  workers: PublicWorkerProfile[];
  batchSize?: number;
}): Promise<{
  closed: boolean;
  currentRadiusKm: ServiceRadiusKm;
  batchIndex: number;
  notifiedCount: number;
  newlyNotifiedUids: string[];
  remainingEligibleCount: number;
  hasNextBatch: boolean;
  totalNotifiedCount: number;
}> {
  const { job, workers, batchSize } = params;
  let freshJob: JobPosting = job;

  try {
    const freshSnap = await getDoc(doc(db, 'jobs', job.id));
    if (freshSnap.exists()) {
      freshJob = { id: freshSnap.id, ...freshSnap.data() } as JobPosting;
    }
  } catch {
    // Fallback to passed snapshot
  }

  const initialRadius = normalizeRadiusKm(freshJob.initialRadiusKm ?? 2, 2);
  if (isJobConfirmationClosed(freshJob)) {
    return {
      closed: true,
      currentRadiusKm: normalizeRadiusKm(freshJob.currentRadiusKm ?? initialRadius, initialRadius),
      batchIndex: Number(freshJob.dispatchBatchIndex) || 0,
      notifiedCount: 0,
      newlyNotifiedUids: [],
      remainingEligibleCount: 0,
      hasNextBatch: false,
      totalNotifiedCount: Array.isArray(freshJob.notifiedWorkerUids)
        ? freshJob.notifiedWorkerUids.length
        : 0,
    };
  }

  const resolvedBatchSize = resolveRotationBatchSize(
    freshJob.workersRequired,
    batchSize ?? freshJob.dispatchBatchSize ?? DEFAULT_ROTATION_BATCH_SIZE
  );
  const retryTag = `r${Math.floor(Date.now() / 1000)}`;

  // Reset only the job's dispatch tracking fields (workers' rotation positions remain untouched)
  await updateDoc(doc(db, 'jobs', freshJob.id), {
    notifiedWorkerUids: [],
    dispatchBatchIndex: 0,
    dispatchBatchSize: resolvedBatchSize,
    currentRadiusKm: initialRadius,
    lastBatchDispatchedAtMs: Date.now(),
    radiusStageUpdatedAt: serverTimestamp(),
    dealStatus: 'REQUESTED',
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  const resetJob: JobPosting = {
    ...freshJob,
    notifiedWorkerUids: [],
    dispatchBatchIndex: 0,
    currentRadiusKm: initialRadius,
  };

  const broadcastResult = await broadcastSmartJobAlerts({
    jobId: freshJob.id,
    job: resetJob,
    workers,
    alreadyNotifiedUids: [],
    stageRadiusKm: initialRadius,
    autoExpandIfEmpty: true,
    batchSize: resolvedBatchSize,
    dedupeSuffix: retryTag,
  });

  if (broadcastResult.newlyNotifiedUids.length > 0 && !broadcastResult.closed) {
    void callNotificationApi('/api/notifications/send-matching-job', {
      jobId: freshJob.id,
      stageRadiusKm: broadcastResult.finalRadiusKm,
      targetWorkerUids: broadcastResult.newlyNotifiedUids,
      forceRetry: true,
      dedupeSuffix: retryTag,
      batchSize: resolvedBatchSize,
    }).catch(() => undefined);
  }

  return {
    closed: broadcastResult.closed,
    currentRadiusKm: broadcastResult.finalRadiusKm,
    batchIndex: broadcastResult.batchIndex,
    notifiedCount: broadcastResult.notifiedCount,
    newlyNotifiedUids: broadcastResult.newlyNotifiedUids,
    remainingEligibleCount: broadcastResult.remainingEligibleCount,
    hasNextBatch: broadcastResult.hasNextBatch,
    totalNotifiedCount: broadcastResult.notifiedWorkerUids.length,
  };
}

export async function expandJobSearchRadius(params: {
  job: JobPosting;
  workers: PublicWorkerProfile[];
  targetRadiusKm?: ServiceRadiusKm;
  batchSize?: number;
}): Promise<{
  previousRadiusKm: ServiceRadiusKm;
  currentRadiusKm: ServiceRadiusKm;
  hasNextStage: boolean;
  newlyNotifiedCount: number;
  totalNotifiedCount: number;
  remainingEligibleCount?: number;
  batchIndex?: number;
  closed?: boolean;
}> {
  const { job, workers, targetRadiusKm, batchSize } = params;
  let freshJob: JobPosting = job;

  try {
    const freshSnap = await getDoc(doc(db, 'jobs', job.id));
    if (freshSnap.exists()) {
      freshJob = { id: freshSnap.id, ...freshSnap.data() } as JobPosting;
    }
  } catch {
    // Fallback to passed snapshot
  }

  const prevRadius = normalizeRadiusKm(freshJob.currentRadiusKm ?? freshJob.initialRadiusKm ?? 2, 2);
  const existingNotified = Array.isArray(freshJob.notifiedWorkerUids)
    ? freshJob.notifiedWorkerUids
    : [];

  if (isJobConfirmationClosed(freshJob)) {
    return {
      previousRadiusKm: prevRadius,
      currentRadiusKm: prevRadius,
      hasNextStage: false,
      newlyNotifiedCount: 0,
      totalNotifiedCount: existingNotified.length,
      remainingEligibleCount: 0,
      batchIndex: Number(freshJob.dispatchBatchIndex) || 0,
      closed: true,
    };
  }

  const nextRadius = targetRadiusKm ?? getNextRadiusStage(prevRadius);

  if (!nextRadius || nextRadius <= prevRadius) {
    return {
      previousRadiusKm: prevRadius,
      currentRadiusKm: prevRadius,
      hasNextStage: false,
      newlyNotifiedCount: 0,
      totalNotifiedCount: existingNotified.length,
      remainingEligibleCount: 0,
      batchIndex: Number(freshJob.dispatchBatchIndex) || 0,
      closed: false,
    };
  }

  const resolvedBatchSize = resolveRotationBatchSize(
    freshJob.workersRequired,
    batchSize ?? freshJob.dispatchBatchSize ?? DEFAULT_ROTATION_BATCH_SIZE
  );

  const broadcastResult = await broadcastSmartJobAlerts({
    jobId: freshJob.id,
    job: freshJob,
    workers,
    alreadyNotifiedUids: existingNotified,
    stageRadiusKm: nextRadius,
    autoExpandIfEmpty: false,
    batchSize: resolvedBatchSize,
  });

  // Trigger server FCM push for newly eligible fair-rotation batch cleanly without blocking UI
  void callNotificationApi('/api/notifications/expand-job-radius', {
    jobId: freshJob.id,
    targetRadiusKm: nextRadius,
    ...(broadcastResult.newlyNotifiedUids.length > 0
      ? { targetWorkerUids: broadcastResult.newlyNotifiedUids }
      : {}),
    allowSameRadiusBatch: true,
    batchSize: resolvedBatchSize,
  }).catch(() => undefined);

  return {
    previousRadiusKm: prevRadius,
    currentRadiusKm: nextRadius,
    hasNextStage: getNextRadiusStage(nextRadius) !== null,
    newlyNotifiedCount: broadcastResult.notifiedCount,
    totalNotifiedCount: broadcastResult.notifiedWorkerUids.length,
    remainingEligibleCount: broadcastResult.remainingEligibleCount,
    batchIndex: broadcastResult.batchIndex,
    closed: broadcastResult.closed,
  };
}

export async function createInstantHireRequest(
  jobPayload: Omit<JobPosting, 'id' | 'status' | 'applicationsCount' | 'createdAt' | 'updatedAt'>,
  selectedWorkers: PublicWorkerProfile[],
  inviteNote?: string,
  idempotencyKey?: string,
  allMatchingWorkersPool?: PublicWorkerProfile[]
): Promise<{
  jobId: string;
  invitedCount: number;
  notifiedCount: number;
  finalRadiusKm?: ServiceRadiusKm;
  newlyNotifiedUids?: string[];
  batchIndex?: number;
  remainingEligibleCount?: number;
  hasNextBatch?: boolean;
}> {
  const safeKey = idempotencyKey ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) : '';
  let alreadyExisted = false;
  if (safeKey && safeKey.length >= 8) {
    try {
      const snap = await getDoc(doc(db, 'jobs', safeKey));
      alreadyExisted = snap.exists();
    } catch {
      alreadyExisted = false;
    }
  }

  const approxLocLabel =
    jobPayload.approxLocationLabel ||
    buildApproxLocationLabel({
      cityOrVillage: jobPayload.cityOrVillage,
      district: jobPayload.district,
      state: jobPayload.state,
    });
  const initialStageKm = normalizeRadiusKm(jobPayload.initialRadiusKm ?? 2, 2);

  const approxCoords = getApproximateCoordinates(jobPayload.lat, jobPayload.lng);

  // Create job document first so Firestore security rule `get(/databases/.../jobs/$(jobId))`
  // resolves cleanly when creating invited applications and notifications immediately afterward.
  // PRIVACY: Public job documents store ONLY approximate location & rounded ~1 km coordinates.
  const jobId = await createJobPosting(
    {
      ...jobPayload,
      workLocationLabel: approxLocLabel.slice(0, 160),
      approxLocationLabel: approxLocLabel.slice(0, 160),
      lat: approxCoords.lat,
      lng: approxCoords.lng,
      initialRadiusKm: initialStageKm,
      currentRadiusKm: normalizeRadiusKm(jobPayload.currentRadiusKm ?? initialStageKm, initialStageKm),
      dealStatus: selectedWorkers.length > 0 ? 'NOTIFIED' : 'REQUESTED',
      notifiedWorkerUids: selectedWorkers.map((w) => w.ownerUid).slice(0, 80),
    },
    safeKey || undefined
  );

  if (alreadyExisted) {
    return { jobId, invitedCount: selectedWorkers.length, notifiedCount: 0, finalRadiusKm: initialStageKm };
  }

  const safeTitle = sanitizeNotificationTextForPrivacy(jobPayload.title.trim()).slice(0, 140) || 'Instant Hire Request';
  const safeNote = sanitizeNotificationTextForPrivacy((inviteNote ?? '').trim()).slice(0, 600);
  const createdAppIds: Array<{ worker: PublicWorkerProfile; appId: string }> = [];

  if (selectedWorkers.length > 0) {
    const batch = writeBatch(db);
    for (const worker of selectedWorkers) {
      const appId = sanitizeSafeId(`app_${jobId}_${worker.ownerUid}`);
      const appRef = doc(db, 'applications', appId);
      createdAppIds.push({ worker, appId });
      batch.set(appRef, {
        jobId,
        jobTitle: safeTitle,
        employerUid: jobPayload.employerUid,
        customerName: (jobPayload.employerName.trim() || 'Customer').slice(0, 160),
        ...(typeof jobPayload.customerGenderProtected === 'boolean'
          ? { customerGenderProtected: jobPayload.customerGenderProtected }
          : {}),
        ...(jobPayload.customerLastName ? { customerLastName: jobPayload.customerLastName.slice(0, 60) } : {}),
        jobCategory: (jobPayload.category.trim() || 'General').slice(0, 80),
        jobDistrict: (jobPayload.district.trim() || 'India').slice(0, 80),
        jobLocationLabel: approxLocLabel.slice(0, 160),
        ...(jobPayload.jobDate ? { jobDate: jobPayload.jobDate.slice(0, 30) } : {}),
        ...(jobPayload.startTime ? { startTime: jobPayload.startTime.slice(0, 30) } : {}),
        workerUid: worker.ownerUid,
        workerRegistrationId: worker.registrationId,
        workerName: worker.displayName,
        workerPrimarySkill: worker.primarySkill,
        ...(worker.photoDocId ? { workerPhotoDocId: worker.photoDocId } : {}),
        proposedWage: jobPayload.offeredWage > 0 ? jobPayload.offeredWage : worker.expectedWage,
        ...(safeNote ? { note: safeNote } : {}),
        status: 'invited',
        dealStatus: 'NOTIFIED',
        initiatedBy: 'customer_invite',
        liveTrackingAuthorized: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applications/instant-hire-${jobId}`);
    }

    // Dispatch guaranteed in-app + optional push notifications for each invited worker AFTER commit
    for (const entry of createdAppIds) {
      const w = entry.worker;
      const distKm = calculateValidDistanceKm(jobPayload.lat, jobPayload.lng, w.approxLat, w.approxLng);
      const workerLang: Language = w.preferredLanguage || 'en';
      const msg = buildSmartJobNotificationContent({
        lang: workerLang,
        customerName: jobPayload.employerName,
        title: safeTitle,
        category: jobPayload.category,
        description: safeNote || jobPayload.description || safeTitle,
        approxLocationLabel: approxLocLabel,
        distanceKm: distKm,
        offeredWage: jobPayload.offeredWage,
        wageUnit: jobPayload.wageUnit,
      });

      await dispatchTwoWayDealNotification({
        recipientUid: w.ownerUid,
        recipientRole: 'worker',
        senderUid: jobPayload.employerUid,
        senderName: jobPayload.employerName,
        category: 'matchingJobs',
        eventType: 'hiring_request_created',
        toneType: 'new_job',
        dealStatus: 'NOTIFIED',
        title: msg.title,
        body: msg.body,
        language: workerLang,
        voiceScript: msg.voiceScript,
        approxLocationLabel: approxLocLabel,
        distanceKm: distKm,
        customerName: jobPayload.employerName,
        jobCategory: jobPayload.category,
        playSound: true,
        speakVoice: w.voiceAlertsEnabled !== false,
        metadataLabel: `${jobPayload.category} · ${approxLocLabel}${distKm !== null ? ` (~${distKm} km)` : ''}`,
        targetRoute: 'worker-dashboard',
        targetJobId: jobId,
        targetApplicationId: entry.appId,
        dedupeKey: sanitizeSafeId(`job_${jobId}_${w.ownerUid}`),
        pushPayload: {
          workerName: jobPayload.employerName,
          jobTitle: safeTitle,
          proposedWage: jobPayload.offeredWage,
          locationLabel: approxLocLabel,
        },
      });
    }
  }

  // Broadcast fair-rotation small-batch voice job alerts when broadcasting to eligible workers
  let extraNotified = 0;
  let finalRadiusKm: ServiceRadiusKm = initialStageKm;
  let newlyNotifiedUids: string[] = selectedWorkers.map((w) => w.ownerUid);
  let batchIndex = selectedWorkers.length > 0 ? 1 : 0;
  let remainingEligibleCount = 0;
  let hasNextBatch = false;

  if (allMatchingWorkersPool && allMatchingWorkersPool.length > 0 && selectedWorkers.length === 0) {
    const broadcastRes = await broadcastSmartJobAlerts({
      jobId,
      job: {
        ...jobPayload,
        approxLocationLabel: approxLocLabel,
        initialRadiusKm: initialStageKm,
      },
      workers: allMatchingWorkersPool,
      alreadyNotifiedUids: selectedWorkers.map((w) => w.ownerUid),
      stageRadiusKm: initialStageKm,
      autoExpandIfEmpty: true,
    });
    extraNotified = broadcastRes.notifiedCount;
    finalRadiusKm = broadcastRes.finalRadiusKm;
    newlyNotifiedUids = broadcastRes.newlyNotifiedUids;
    batchIndex = broadcastRes.batchIndex;
    remainingEligibleCount = broadcastRes.remainingEligibleCount;
    hasNextBatch = broadcastRes.hasNextBatch;
  }

  return {
    jobId,
    invitedCount: selectedWorkers.length,
    notifiedCount: selectedWorkers.length + extraNotified,
    finalRadiusKm,
    newlyNotifiedUids,
    batchIndex,
    remainingEligibleCount,
    hasNextBatch,
  };
}

export async function applyToJob(
  payload: Omit<JobApplication, 'id' | 'status' | 'liveTrackingAuthorized' | 'createdAt' | 'updatedAt'> & {
    jobMeta?: Pick<
      JobPosting,
      'category' | 'district' | 'cityOrVillage' | 'workLocationLabel' | 'jobDate' | 'startTime' | 'employerName'
    >;
  }
): Promise<string> {
  const deterministicAppId = sanitizeSafeId(`app_${payload.jobId}_${payload.workerUid}`);
  const appRef = doc(db, 'applications', deterministicAppId);
  const jobRef = doc(db, 'jobs', payload.jobId);

  try {
    const existingSnap = await getDoc(appRef);
    const { jobMeta, ...cleanPayload } = payload;
    const locLabel = jobMeta
      ? buildApproxLocationLabel({
          cityOrVillage: jobMeta.cityOrVillage,
          district: jobMeta.district,
        })
      : payload.jobLocationLabel || '';

    const safeTravelCharges =
      typeof cleanPayload.travelCharges === 'number' &&
      Number.isFinite(cleanPayload.travelCharges) &&
      cleanPayload.travelCharges > 0
        ? Math.min(100000, Math.round(cleanPayload.travelCharges))
        : 0;

    if (existingSnap.exists()) {
      await updateDoc(appRef, {
        proposedWage: cleanPayload.proposedWage,
        offerAmount: cleanPayload.offerAmount ?? cleanPayload.proposedWage,
        ...(safeTravelCharges > 0 ? { travelCharges: safeTravelCharges } : {}),
        ...(cleanPayload.estimatedArrivalTime
          ? { estimatedArrivalTime: cleanPayload.estimatedArrivalTime.slice(0, 80) }
          : {}),
        ...(cleanPayload.offerMessage
          ? { offerMessage: cleanPayload.offerMessage.slice(0, 600) }
          : {}),
        ...(cleanPayload.note ? { note: cleanPayload.note.slice(0, 600) } : {}),
        status: 'applied',
        dealStatus: 'OFFER_RECEIVED',
        offerSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(appRef, {
        ...cleanPayload,
        ...(safeTravelCharges > 0 ? { travelCharges: safeTravelCharges } : {}),
        ...(jobMeta?.employerName ? { customerName: jobMeta.employerName.slice(0, 160) } : {}),
        ...(jobMeta?.category ? { jobCategory: jobMeta.category.slice(0, 80) } : {}),
        ...(jobMeta?.district ? { jobDistrict: jobMeta.district.slice(0, 80) } : {}),
        ...(locLabel ? { jobLocationLabel: locLabel.slice(0, 160) } : {}),
        ...(jobMeta?.jobDate ? { jobDate: jobMeta.jobDate.slice(0, 30) } : {}),
        ...(jobMeta?.startTime ? { startTime: jobMeta.startTime.slice(0, 30) } : {}),
        offerAmount: cleanPayload.offerAmount ?? cleanPayload.proposedWage,
        offerSubmittedAt: serverTimestamp(),
        status: 'applied',
        dealStatus: 'OFFER_RECEIVED',
        initiatedBy: cleanPayload.initiatedBy || 'worker_apply',
        liveTrackingAuthorized: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(jobRef, {
        applicationsCount: increment(1),
        dealStatus: 'OFFER_RECEIVED',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }

    const travelLabel = safeTravelCharges > 0 ? ` + ₹${safeTravelCharges} travel` : '';
    const displayOfferPrice = payload.offerAmount ?? payload.proposedWage;

    await dispatchTwoWayDealNotification({
      recipientUid: payload.employerUid,
      recipientRole: 'employer',
      senderUid: payload.workerUid,
      senderName: payload.workerName,
      category: 'applicationUpdates',
      eventType: 'worker_offer_sent',
      toneType: 'new_offer',
      dealStatus: 'OFFER_RECEIVED',
      title: `New Worker Offer: ${payload.jobTitle}`,
      body: `${payload.workerName} (${payload.workerPrimarySkill}) offered ₹${displayOfferPrice}${travelLabel}${payload.offerMessage || payload.note ? ` — "${(payload.offerMessage || payload.note || '').slice(0, 100)}"` : ''}`,
      metadataLabel: `₹${displayOfferPrice}${travelLabel}`,
      targetRoute: 'employer-dashboard',
      targetJobId: payload.jobId,
      targetApplicationId: deterministicAppId,
      dedupeKey: sanitizeSafeId(`offer_${deterministicAppId}_${Date.now()}`),
      pushPayload: {
        workerName: payload.workerName,
        jobTitle: payload.jobTitle,
        proposedWage: displayOfferPrice + safeTravelCharges,
        eta: payload.estimatedArrivalTime,
        messageSnippet: payload.offerMessage || payload.note,
      },
    });

    return deterministicAppId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/${deterministicAppId}`);
  }
}

export async function submitWorkerOffer(params: {
  job: JobPosting;
  worker: PublicWorkerProfile;
  workerUid: string;
  offeredPrice: number;
  travelCharges?: number;
  estimatedArrivalTime?: string;
  offerMessage: string;
  existingApplicationId?: string;
}): Promise<string> {
  const {
    job,
    worker,
    workerUid,
    offeredPrice,
    travelCharges,
    estimatedArrivalTime,
    offerMessage,
    existingApplicationId,
  } = params;

  // Immediately block new offers if this job was already confirmed by another worker
  if (isJobConfirmationClosed(job)) {
    throw new Error('This job has already been confirmed by another worker.');
  }
  const latestJobSnap = await getDoc(doc(db, 'jobs', job.id)).catch(() => null);
  if (latestJobSnap?.exists()) {
    const latestJob = latestJobSnap.data() as JobPosting;
    if (isJobConfirmationClosed(latestJob) && latestJob.acceptedWorkerUid !== workerUid) {
      throw new Error('This job has already been confirmed by another worker.');
    }
  }

  const price = Math.max(1, Math.round(Number(offeredPrice) || job.offeredWage || worker.expectedWage || 100));
  const safeTravel =
    typeof travelCharges === 'number' && Number.isFinite(travelCharges) && travelCharges > 0
      ? Math.min(100000, Math.round(travelCharges))
      : 0;
  const eta = (estimatedArrivalTime || '').trim().slice(0, 80);
  const message = offerMessage.trim().slice(0, 600);
  const travelLabel = safeTravel > 0 ? ` + ₹${safeTravel} travel` : '';

  if (existingApplicationId) {
    const appRef = doc(db, 'applications', existingApplicationId);
    try {
      await updateDoc(appRef, {
        status: 'applied',
        dealStatus: 'OFFER_RECEIVED',
        proposedWage: price,
        offerAmount: price,
        ...(safeTravel > 0 ? { travelCharges: safeTravel } : {}),
        ...(eta ? { estimatedArrivalTime: eta } : {}),
        ...(message ? { offerMessage: message, note: message } : {}),
        offerSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'jobs', job.id), {
        dealStatus: 'OFFER_RECEIVED',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      await dispatchTwoWayDealNotification({
        recipientUid: job.employerUid,
        recipientRole: 'employer',
        senderUid: workerUid,
        senderName: worker.displayName,
        category: 'applicationUpdates',
        eventType: 'worker_offer_sent',
        toneType: 'new_offer',
        dealStatus: 'OFFER_RECEIVED',
        title: `New Offer from ${worker.displayName}: ${job.title}`,
        body: `${worker.displayName} (${worker.primarySkill}) sent an offer of ₹${price}${travelLabel}${message ? ` — "${message.slice(0, 100)}"` : ''}`,
        metadataLabel: `₹${price}${travelLabel}`,
        targetRoute: 'employer-dashboard',
        targetJobId: job.id,
        targetApplicationId: existingApplicationId,
        dedupeKey: sanitizeSafeId(`offer_${existingApplicationId}_${Date.now()}`),
        pushPayload: {
          workerName: worker.displayName,
          jobTitle: job.title,
          proposedWage: price + safeTravel,
          ...(eta ? { eta } : {}),
          messageSnippet: message,
        },
      });
      return existingApplicationId;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applications/${existingApplicationId}`);
    }
  }

  return applyToJob({
    jobId: job.id,
    jobTitle: job.title,
    employerUid: job.employerUid,
    workerUid,
    workerRegistrationId: worker.registrationId,
    workerName: worker.displayName,
    workerPrimarySkill: worker.primarySkill,
    ...(worker.photoDocId ? { workerPhotoDocId: worker.photoDocId } : {}),
    proposedWage: price,
    offerAmount: price,
    ...(safeTravel > 0 ? { travelCharges: safeTravel } : {}),
    ...(eta ? { estimatedArrivalTime: eta } : {}),
    offerMessage: message,
    note: message || `Offer ₹${price}${travelLabel}`,
    jobMeta: job,
  });
}

export async function respondToHiringInvite(params: {
  app: JobApplication;
  decision: 'accepted' | 'declined';
  workerName: string;
  jobLocationLabel?: string;
}): Promise<void> {
  const { app, decision, workerName, jobLocationLabel } = params;
  // Prevent duplicate confirmation clicks
  if (
    decision === 'accepted' &&
    (app.status === 'accepted' || app.dealStatus === 'DEAL_CONFIRMED' || app.dealStatus === 'WORK_IN_PROGRESS')
  ) {
    return;
  }

  const nextDealStatus: DealStatus = decision === 'accepted' ? 'DEAL_CONFIRMED' : 'CANCELLED';
  const path = `applications/${app.id}`;

  try {
    let isSingleWorkerOrder = true;
    if (decision === 'accepted') {
      const jobSnap = await getDoc(doc(db, 'jobs', app.jobId)).catch(() => null);
      if (jobSnap?.exists()) {
        const jobData = jobSnap.data() as JobPosting;
        const requiredCount = Number(jobData.workersRequired) || 1;
        isSingleWorkerOrder = requiredCount <= 1;
        if (
          isSingleWorkerOrder &&
          ((jobData.acceptedApplicationId && jobData.acceptedApplicationId !== app.id) ||
            (jobData.acceptedWorkerUid && jobData.acceptedWorkerUid !== app.workerUid) ||
            (isJobConfirmationClosed(jobData) && jobData.acceptedWorkerUid !== app.workerUid))
        ) {
          throw new Error('Another worker has already confirmed this job.');
        }
      }
    }

    await updateDoc(doc(db, 'applications', app.id), {
      status: decision,
      dealStatus: nextDealStatus,
      liveTrackingAuthorized: decision === 'accepted',
      ...(decision === 'accepted'
        ? { dealConfirmedAt: serverTimestamp() }
        : { cancelledAt: serverTimestamp(), cancelledByUid: app.workerUid }),
      updatedAt: serverTimestamp(),
    });

    if (decision === 'accepted') {
      await updateDoc(doc(db, 'jobs', app.jobId), {
        status: 'in_progress',
        dealStatus: 'DEAL_CONFIRMED',
        acceptedApplicationId: app.id,
        acceptedWorkerUid: app.workerUid,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      // Update fair rotation ONLY when this worker genuinely confirms the job
      await recordWorkerConfirmedJobRotation({
        workerUid: app.workerUid,
        applicationId: app.id,
      });

      // Close competing pending invitations/offers on single-worker jobs immediately
      if (isSingleWorkerOrder) {
        try {
          const siblingSnap = await getDocs(
            query(
              collection(db, 'applications'),
              where('employerUid', '==', app.employerUid),
              where('jobId', '==', app.jobId)
            )
          );
          for (const sibDoc of siblingSnap.docs) {
            if (sibDoc.id === app.id) continue;
            const sibData = sibDoc.data() as JobApplication;
            if (sibData.status === 'applied' || sibData.status === 'invited') {
              await updateDoc(doc(db, 'applications', sibDoc.id), {
                status: 'declined',
                dealStatus: 'REJECTED',
                liveTrackingAuthorized: false,
                cancelledAt: serverTimestamp(),
                cancelledByUid: app.workerUid,
                updatedAt: serverTimestamp(),
              }).catch(() => undefined);
            }
          }
        } catch {
          // Non-blocking safeguard (worker may not have list permission on sibling docs)
        }
      }
    }

    await dispatchTwoWayDealNotification({
      recipientUid: app.employerUid,
      recipientRole: 'employer',
      senderUid: app.workerUid,
      senderName: workerName || app.workerName,
      category: 'bookingNotifications',
      eventType: decision === 'accepted' ? 'deal_confirmed' : 'job_request_rejected',
      toneType: decision === 'accepted' ? 'deal_accepted' : 'deal_cancelled',
      dealStatus: nextDealStatus,
      title:
        decision === 'accepted'
          ? `Work Confirmed: ${app.jobTitle}`
          : `Request Declined: ${app.jobTitle}`,
      body:
        decision === 'accepted'
          ? `${workerName || app.workerName} accepted and confirmed "${app.jobTitle}" at ₹${app.proposedWage}${jobLocationLabel ? ` (${jobLocationLabel})` : ''}. Live location & chat are now active.`
          : `${workerName || app.workerName} declined your request for ${app.jobTitle}.`,
      metadataLabel: `₹${app.proposedWage} · ${decision === 'accepted' ? 'Work Confirmed' : 'Cancelled'}`,
      targetRoute: 'employer-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`invite_resp_${app.id}_${decision}_${Date.now()}`),
      pushPayload: {
        workerName: workerName || app.workerName,
        jobTitle: app.jobTitle,
        proposedWage: app.proposedWage,
        locationLabel: jobLocationLabel || app.jobLocationLabel,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Another worker has already confirmed')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function respondToWorkerOffer(params: {
  app: JobApplication;
  decision: 'accepted' | 'declined';
  customerName: string;
  jobLocationLabel?: string;
  photoGrantContext?: {
    customerUid: string;
    workerUid: string;
    customerPhotoDocId?: string;
  };
}): Promise<void> {
  const { app, decision, customerName, jobLocationLabel, photoGrantContext } = params;
  // Prevent duplicate confirmation clicks
  if (
    decision === 'accepted' &&
    (app.status === 'accepted' || app.dealStatus === 'DEAL_CONFIRMED' || app.dealStatus === 'WORK_IN_PROGRESS')
  ) {
    return;
  }

  const agreedPrice = (app.offerAmount ?? app.proposedWage) + (app.travelCharges || 0);
  const nextDealStatus: DealStatus = decision === 'accepted' ? 'DEAL_CONFIRMED' : 'CANCELLED';
  const loc = jobLocationLabel || app.jobLocationLabel || app.jobDistrict || '';
  const path = `applications/${app.id}`;

  try {
    let isSingleWorkerOrder = true;
    if (decision === 'accepted') {
      const jobSnap = await getDoc(doc(db, 'jobs', app.jobId)).catch(() => null);
      if (jobSnap?.exists()) {
        const jobData = jobSnap.data() as JobPosting;
        const requiredCount = Number(jobData.workersRequired) || 1;
        isSingleWorkerOrder = requiredCount <= 1;
        if (
          isSingleWorkerOrder &&
          jobData.acceptedApplicationId &&
          jobData.acceptedApplicationId !== app.id
        ) {
          throw new Error('Another worker has already been accepted for this order.');
        }
      }
    }

    await updateDoc(doc(db, 'applications', app.id), {
      status: decision,
      dealStatus: nextDealStatus,
      ...(decision === 'accepted'
        ? {
            agreedPrice,
            dealConfirmedAt: serverTimestamp(),
            liveTrackingAuthorized: true,
          }
        : {
            liveTrackingAuthorized: false,
            cancelledAt: serverTimestamp(),
            cancelledByUid: app.employerUid,
          }),
      updatedAt: serverTimestamp(),
    });

    if (decision === 'accepted') {
      await updateDoc(doc(db, 'jobs', app.jobId), {
        status: 'in_progress',
        dealStatus: 'DEAL_CONFIRMED',
        acceptedApplicationId: app.id,
        acceptedWorkerUid: app.workerUid,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      // Update fair rotation ONLY when this worker's job is genuinely confirmed
      await recordWorkerConfirmedJobRotation({
        workerUid: app.workerUid,
        applicationId: app.id,
      });

      // For single-worker orders, automatically close/decline competing pending offers so multiple workers cannot be accepted
      if (isSingleWorkerOrder) {
        try {
          const siblingSnap = await getDocs(
            query(
              collection(db, 'applications'),
              where('employerUid', '==', app.employerUid),
              where('jobId', '==', app.jobId)
            )
          );
          for (const sibDoc of siblingSnap.docs) {
            if (sibDoc.id === app.id) continue;
            const sibData = sibDoc.data() as JobApplication;
            if (sibData.status === 'applied' || sibData.status === 'invited') {
              await updateDoc(doc(db, 'applications', sibDoc.id), {
                status: 'declined',
                dealStatus: 'REJECTED',
                liveTrackingAuthorized: false,
                cancelledAt: serverTimestamp(),
                cancelledByUid: app.employerUid,
                updatedAt: serverTimestamp(),
              }).catch(() => undefined);
            }
          }
        } catch {
          // Non-blocking safeguard
        }
      }

      if (photoGrantContext?.customerPhotoDocId) {
        await grantAcceptedCustomerPhoto({
          customerUid: photoGrantContext.customerUid,
          workerUid: photoGrantContext.workerUid,
          sourceType: 'job_application',
          sourceId: app.id,
          customerPhotoDocId: photoGrantContext.customerPhotoDocId,
        }).catch(() => undefined);
      }
    }

    await dispatchTwoWayDealNotification({
      recipientUid: app.workerUid,
      recipientRole: 'worker',
      senderUid: app.employerUid,
      senderName: customerName,
      category: 'applicationUpdates',
      eventType: decision === 'accepted' ? 'deal_confirmed' : 'offer_rejected',
      toneType: decision === 'accepted' ? 'deal_accepted' : 'deal_cancelled',
      dealStatus: nextDealStatus,
      title:
        decision === 'accepted'
          ? 'Offer Accepted! Your work is confirmed.'
          : `Offer Not Accepted: ${app.jobTitle}`,
      body:
        decision === 'accepted'
          ? `${customerName} accepted your offer for "${app.jobTitle}" at ₹${agreedPrice}${loc ? ` · ${loc}` : ''}. Live location & chat are now active.`
          : `${customerName} declined your offer for "${app.jobTitle}".`,
      metadataLabel:
        decision === 'accepted'
          ? `Offer Accepted · ₹${agreedPrice}${loc ? ` · ${loc}` : ''}`
          : app.jobTitle,
      targetRoute: 'worker-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`offer_resp_${app.id}_${decision}_${Date.now()}`),
      pushPayload: {
        workerName: customerName,
        jobTitle: app.jobTitle,
        proposedWage: agreedPrice,
        locationLabel: loc,
      },
    });

    // Notify Customer too when offer is accepted so BOTH customer and worker receive confirmation alert + sound
    if (decision === 'accepted') {
      await dispatchTwoWayDealNotification({
        recipientUid: app.employerUid,
        recipientRole: 'employer',
        senderUid: app.employerUid,
        senderName: app.workerName,
        category: 'bookingNotifications',
        eventType: 'deal_confirmed',
        toneType: 'deal_accepted',
        dealStatus: 'DEAL_CONFIRMED',
        title: `Offer Accepted: ${app.workerName}`,
        body: `Confirmed "${app.jobTitle}" with ${app.workerName} at ₹${agreedPrice}. Tap "SHARE LOCATION" so the worker can navigate to you.`,
        metadataLabel: `Offer Accepted · ₹${agreedPrice}`,
        targetRoute: 'employer-dashboard',
        targetJobId: app.jobId,
        targetApplicationId: app.id,
        dedupeKey: sanitizeSafeId(`offer_resp_cust_${app.id}_${Date.now()}`),
        pushPayload: {
          workerName: app.workerName,
          jobTitle: app.jobTitle,
          proposedWage: agreedPrice,
          locationLabel: loc,
        },
      }).catch(() => undefined);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Another worker has already been accepted')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function confirmWorkOffer(params: {
  app: JobApplication;
  customerName: string;
  jobLocationLabel?: string;
  photoGrantContext?: {
    customerUid: string;
    workerUid: string;
    customerPhotoDocId?: string;
  };
}): Promise<void> {
  return respondToWorkerOffer({ ...params, decision: 'accepted' });
}

export async function confirmDealByParticipant(params: {
  app: JobApplication;
  actorUid: string;
  actorRole: 'customer' | 'worker';
  actorName: string;
}): Promise<void> {
  const { app, actorUid, actorRole, actorName } = params;
  const agreedPrice = app.agreedPrice ?? app.offerAmount ?? app.proposedWage;
  const path = `applications/${app.id}`;

  try {
    await updateDoc(doc(db, 'applications', app.id), {
      status: 'accepted',
      dealStatus: 'DEAL_CONFIRMED',
      dealConfirmedAt: serverTimestamp(),
      ...(actorRole === 'worker' ? { liveTrackingAuthorized: true } : { agreedPrice, liveTrackingAuthorized: true }),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'jobs', app.jobId), {
      dealStatus: 'DEAL_CONFIRMED',
      status: 'in_progress',
      acceptedApplicationId: app.id,
      acceptedWorkerUid: app.workerUid,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    // Update fair rotation ONLY when this worker's job is genuinely confirmed (idempotent per applicationId)
    await recordWorkerConfirmedJobRotation({
      workerUid: app.workerUid,
      applicationId: app.id,
    });

    const counterpartyUid = actorRole === 'customer' ? app.workerUid : app.employerUid;
    const counterpartyRole = actorRole === 'customer' ? 'worker' : 'employer';
    const counterpartyRoute = actorRole === 'customer' ? 'worker-dashboard' : 'employer-dashboard';

    await dispatchTwoWayDealNotification({
      recipientUid: counterpartyUid,
      recipientRole: counterpartyRole,
      senderUid: actorUid,
      senderName: actorName,
      category: 'bookingNotifications',
      eventType: 'deal_confirmed',
      toneType: 'deal_accepted',
      dealStatus: 'DEAL_CONFIRMED',
      title: 'Congratulations! Your work has been confirmed.',
      body: `${actorName} confirmed work for "${app.jobTitle}" (Agreed: ₹${agreedPrice}). Two-way live location & chat are now active.`,
      metadataLabel: `Work Confirmed · ₹${agreedPrice}`,
      targetRoute: counterpartyRoute,
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`deal_conf_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName: actorName,
        jobTitle: app.jobTitle,
        proposedWage: agreedPrice,
        locationLabel: app.jobLocationLabel || app.jobDistrict,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function requestRevisedQuote(params: {
  app: JobApplication;
  customerName: string;
}): Promise<void> {
  const { app, customerName } = params;
  const path = `applications/${app.id}`;
  try {
    await updateDoc(doc(db, 'applications', app.id), {
      quoteRevisionRequested: true,
      updatedAt: serverTimestamp(),
    });

    await dispatchTwoWayDealNotification({
      recipientUid: app.workerUid,
      recipientRole: 'worker',
      senderUid: app.employerUid,
      senderName: customerName,
      category: 'applicationUpdates',
      eventType: 'quote_revision_requested',
      toneType: 'new_offer',
      dealStatus: 'OFFER_RECEIVED',
      title: `Revised Price Requested: ${app.jobTitle}`,
      body: `${customerName} asked for a revised price quote for "${app.jobTitle}". Open the order to update your offer.`,
      metadataLabel: 'Revised quote requested',
      targetRoute: 'worker-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`quote_rev_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName: customerName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markWorkerOnTheWay(params: {
  app: JobApplication;
  workerName: string;
}): Promise<void> {
  const { app, workerName } = params;
  const path = `applications/${app.id}`;
  try {
    await updateDoc(doc(db, 'applications', app.id), {
      dealStatus: 'WORKER_ON_THE_WAY',
      onTheWayAt: serverTimestamp(),
      liveTrackingAuthorized: true,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'jobs', app.jobId), {
      dealStatus: 'WORKER_ON_THE_WAY',
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    await dispatchTwoWayDealNotification({
      recipientUid: app.employerUid,
      recipientRole: 'employer',
      senderUid: app.workerUid,
      senderName: workerName,
      category: 'bookingNotifications',
      eventType: 'worker_on_the_way',
      toneType: 'deal_accepted',
      dealStatus: 'WORKER_ON_THE_WAY',
      title: `Worker On The Way: ${app.jobTitle}`,
      body: `${workerName} is on the way to your location for "${app.jobTitle}".`,
      metadataLabel: 'Worker On The Way',
      targetRoute: 'employer-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`on_the_way_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markWorkerArrived(params: {
  app: JobApplication;
  workerName: string;
}): Promise<void> {
  const { app, workerName } = params;
  const path = `applications/${app.id}`;
  try {
    await updateDoc(doc(db, 'applications', app.id), {
      dealStatus: 'WORKER_ARRIVED',
      arrivedAt: serverTimestamp(),
      liveTrackingAuthorized: true,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'jobs', app.jobId), {
      dealStatus: 'WORKER_ARRIVED',
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    await dispatchTwoWayDealNotification({
      recipientUid: app.employerUid,
      recipientRole: 'employer',
      senderUid: app.workerUid,
      senderName: workerName,
      category: 'bookingNotifications',
      eventType: 'worker_arrived',
      toneType: 'deal_accepted',
      dealStatus: 'WORKER_ARRIVED',
      title: `Worker Arrived: ${app.jobTitle}`,
      body: `${workerName} has arrived at your location for "${app.jobTitle}".`,
      metadataLabel: 'Worker Arrived',
      targetRoute: 'employer-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`arrived_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function startWorkByWorker(params: {
  app: JobApplication;
  workerName: string;
}): Promise<void> {
  const { app, workerName } = params;
  const path = `applications/${app.id}`;
  try {
    await updateDoc(doc(db, 'applications', app.id), {
      dealStatus: 'WORK_IN_PROGRESS',
      workStartedAt: serverTimestamp(),
      liveTrackingAuthorized: true,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'jobs', app.jobId), {
      dealStatus: 'WORK_IN_PROGRESS',
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    await dispatchTwoWayDealNotification({
      recipientUid: app.employerUid,
      recipientRole: 'employer',
      senderUid: app.workerUid,
      senderName: workerName,
      category: 'bookingNotifications',
      eventType: 'work_started',
      toneType: 'deal_accepted',
      dealStatus: 'WORK_IN_PROGRESS',
      title: `Work Started: ${app.jobTitle}`,
      body: `${workerName} has started work on "${app.jobTitle}".`,
      metadataLabel: 'Work Started',
      targetRoute: 'employer-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`work_start_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function stopDealLocationSharing(applicationId: string): Promise<void> {
  const shareIds = [`${applicationId}_customer`, `${applicationId}_worker`];
  for (const sid of shareIds) {
    const shareRef = doc(db, 'dealLocationShares', sid);
    try {
      const snap = await getDoc(shareRef);
      if (snap.exists() && snap.data()?.sharingActive === true) {
        await updateDoc(shareRef, {
          sharingActive: false,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore if share record doesn't exist or already stopped
    }
  }
}

async function syncWorkerProfileRating(
  workerUid: string,
  applicationId: string,
  rating: number
): Promise<void> {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  try {
    const workerRef = doc(db, 'publicWorkers', workerUid);
    const snap = await getDoc(workerRef);
    if (!snap.exists()) return;
    const data = snap.data() as PublicWorkerProfile;
    if (data.lastRatedApplicationId === applicationId) {
      return;
    }
    const prevCount = Math.max(0, Number(data.completedJobsCount) || 0);
    const prevAvg = Math.max(0, Math.min(5, Number(data.ratingAvg) || 0));
    const nextCount = prevCount + 1;
    const nextAvg = Math.round(((prevAvg * prevCount + clamped) / nextCount) * 100) / 100;

    await updateDoc(workerRef, {
      completedJobsCount: nextCount,
      ratingAvg: Math.max(1, Math.min(5, nextAvg)),
      lastRatedApplicationId: applicationId,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking: rating is already persisted on applications/{applicationId}
  }
}

export async function completeDeal(params: {
  app: JobApplication;
  actorUid: string;
  actorRole: 'customer' | 'worker';
  actorName: string;
  rating?: number;
  feedback?: string;
  photoGrantContext?: {
    customerUid: string;
    workerUid: string;
    customerPhotoDocId?: string;
  };
}): Promise<void> {
  const { app, actorUid, actorRole, actorName, rating, feedback, photoGrantContext } = params;
  const path = `applications/${app.id}`;
  const clampedRating =
    typeof rating === 'number' && Number.isFinite(rating)
      ? Math.max(1, Math.min(5, Math.round(rating)))
      : undefined;

  try {
    await updateDoc(doc(db, 'applications', app.id), {
      status: 'work_completed',
      dealStatus: 'WORK_COMPLETED',
      liveTrackingAuthorized: false,
      completedAt: serverTimestamp(),
      ...(typeof clampedRating === 'number' && actorRole === 'customer'
        ? { workerRating: clampedRating }
        : {}),
      ...(feedback?.trim() && actorRole === 'customer'
        ? { employerFeedback: feedback.trim().slice(0, 500) }
        : {}),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'jobs', app.jobId), {
      status: 'completed',
      dealStatus: 'WORK_COMPLETED',
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    if (actorRole === 'customer' && typeof clampedRating === 'number') {
      await syncWorkerProfileRating(app.workerUid, app.id, clampedRating);
    }

    // Immediately turn off live location sharing on deal completion
    await stopDealLocationSharing(app.id);

    if (photoGrantContext?.customerPhotoDocId) {
      await grantAcceptedCustomerPhoto({
        customerUid: photoGrantContext.customerUid,
        workerUid: photoGrantContext.workerUid,
        sourceType: 'job_application',
        sourceId: app.id,
        customerPhotoDocId: photoGrantContext.customerPhotoDocId,
      }).catch(() => undefined);
    }

    const counterpartyUid = actorRole === 'customer' ? app.workerUid : app.employerUid;
    const counterpartyRole = actorRole === 'customer' ? 'worker' : 'employer';
    const counterpartyRoute = actorRole === 'customer' ? 'worker-dashboard' : 'employer-dashboard';

    await dispatchTwoWayDealNotification({
      recipientUid: counterpartyUid,
      recipientRole: counterpartyRole,
      senderUid: actorUid,
      senderName: actorName,
      category: 'bookingNotifications',
      eventType: 'work_completed',
      toneType: 'deal_completed',
      dealStatus: 'WORK_COMPLETED',
      title:
        actorRole === 'worker'
          ? `Work Done: ${app.jobTitle}`
          : `Work Completed: ${app.jobTitle}`,
      body:
        actorRole === 'worker'
          ? `${actorName} marked "${app.jobTitle}" as WORK DONE. Tap OPEN to rate the worker (1–5 stars).`
          : `${actorName} marked "${app.jobTitle}" as completed${
              typeof clampedRating === 'number' ? ` with a ${clampedRating}/5 rating` : ''
            }. Live location sharing has stopped.`,
      metadataLabel:
        actorRole === 'worker'
          ? 'Work Done · Please Rate Worker'
          : 'Work Completed · Live location stopped',
      targetRoute: counterpartyRoute,
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`work_done_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName: actorName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function submitCustomerRating(params: {
  app: JobApplication;
  customerUid: string;
  customerName: string;
  rating: number;
  feedback?: string;
}): Promise<void> {
  const { app, customerUid, customerName, rating, feedback } = params;
  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
  const cleanFeedback = feedback?.trim().slice(0, 500);

  if (app.status !== 'work_completed') {
    await completeDeal({
      app,
      actorUid: customerUid,
      actorRole: 'customer',
      actorName: customerName,
      rating: clampedRating,
      feedback: cleanFeedback,
    });
    return;
  }

  const path = `applications/${app.id}`;
  try {
    await updateDoc(doc(db, 'applications', app.id), {
      workerRating: clampedRating,
      ...(cleanFeedback ? { employerFeedback: cleanFeedback } : {}),
      updatedAt: serverTimestamp(),
    });

    await syncWorkerProfileRating(app.workerUid, app.id, clampedRating);

    await dispatchTwoWayDealNotification({
      recipientUid: app.workerUid,
      recipientRole: 'worker',
      senderUid: customerUid,
      senderName: customerName,
      category: 'bookingNotifications',
      eventType: 'work_completed',
      toneType: 'deal_completed',
      dealStatus: 'WORK_COMPLETED',
      title: `New ${clampedRating}/5 Rating Received`,
      body: `${customerName} rated you ${clampedRating}/5 for "${app.jobTitle}"${
        cleanFeedback ? `: “${cleanFeedback}”` : '.'
      }`,
      metadataLabel: `Rated ${clampedRating}/5`,
      targetRoute: 'worker-dashboard',
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`rating_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName: customerName,
        jobTitle: app.jobTitle,
      },
    }).catch(() => undefined);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cancelDeal(params: {
  app: JobApplication;
  actorUid: string;
  actorRole: 'customer' | 'worker';
  actorName: string;
  reason?: string;
}): Promise<void> {
  const { app, actorUid, actorRole, actorName, reason } = params;
  const path = `applications/${app.id}`;

  try {
    await updateDoc(doc(db, 'applications', app.id), {
      status: 'declined',
      dealStatus: 'CANCELLED',
      liveTrackingAuthorized: false,
      cancelledAt: serverTimestamp(),
      cancelledByUid: actorUid,
      ...(reason?.trim() && actorRole === 'worker' ? { note: reason.trim().slice(0, 600) } : {}),
      ...(reason?.trim() && actorRole === 'customer' ? { employerFeedback: reason.trim().slice(0, 500) } : {}),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'jobs', app.jobId), {
      status: 'cancelled',
      dealStatus: 'CANCELLED',
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    // Immediately stop live location sharing on cancellation
    await stopDealLocationSharing(app.id);

    const counterpartyUid = actorRole === 'customer' ? app.workerUid : app.employerUid;
    const counterpartyRole = actorRole === 'customer' ? 'worker' : 'employer';
    const counterpartyRoute = actorRole === 'customer' ? 'worker-dashboard' : 'employer-dashboard';

    await dispatchTwoWayDealNotification({
      recipientUid: counterpartyUid,
      recipientRole: counterpartyRole,
      senderUid: actorUid,
      senderName: actorName,
      category: 'bookingNotifications',
      eventType: 'deal_cancelled',
      toneType: 'deal_cancelled',
      dealStatus: 'CANCELLED',
      title: `Cancelled: ${app.jobTitle}`,
      body: `${actorName} cancelled the deal for "${app.jobTitle}"${reason ? ` (${reason.slice(0, 100)})` : ''}. Live location sharing has been stopped.`,
      metadataLabel: 'Cancelled · Live location stopped',
      targetRoute: counterpartyRoute,
      targetJobId: app.jobId,
      targetApplicationId: app.id,
      dedupeKey: sanitizeSafeId(`deal_cancel_${app.id}_${Date.now()}`),
      pushPayload: {
        workerName: actorName,
        jobTitle: app.jobTitle,
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateApplicationByWorker(
  applicationId: string,
  updates: { status?: 'applied' | 'accepted' | 'declined'; dealStatus?: DealStatus; liveTrackingAuthorized?: boolean; note?: string }
): Promise<void> {
  const path = `applications/${applicationId}`;
  try {
    await updateDoc(doc(db, 'applications', applicationId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateApplicationByEmployer(
  applicationId: string,
  updates: {
    status: 'invited' | 'accepted' | 'declined' | 'work_completed';
    dealStatus?: DealStatus;
    agreedPrice?: number;
    workerRating?: number;
    employerFeedback?: string;
  },
  photoGrantContext?: {
    customerUid: string;
    workerUid: string;
    customerPhotoDocId?: string;
  }
): Promise<void> {
  const path = `applications/${applicationId}`;
  try {
    await updateDoc(doc(db, 'applications', applicationId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    if (
      (updates.status === 'accepted' || updates.status === 'work_completed') &&
      photoGrantContext?.customerPhotoDocId
    ) {
      await grantAcceptedCustomerPhoto({
        customerUid: photoGrantContext.customerUid,
        workerUid: photoGrantContext.workerUid,
        sourceType: 'job_application',
        sourceId: applicationId,
        customerPhotoDocId: photoGrantContext.customerPhotoDocId,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function submitPartnershipEnquiry(
  payload: Omit<PartnershipEnquiry, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'partnershipEnquiries';
  try {
    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'received',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function submitGrievanceReport(
  payload: Omit<GrievanceReport, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'grievances';
  try {
    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminUpdateVerification(
  collectionName: 'publicWorkers' | 'publicEmployers',
  docId: string,
  verificationStatus: VerificationStatus,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const targetRef = doc(db, collectionName, docId);
  const logRef = doc(collection(db, 'auditLogs'));
  const batch = writeBatch(db);
  batch.update(targetRef, {
    verificationStatus,
    updatedAt: serverTimestamp(),
  });
  batch.set(logRef, {
    adminUid,
    adminEmail,
    action: `set_verification_${verificationStatus}`,
    targetCollection: collectionName,
    targetId: docId,
    details: `Updated ${collectionName}/${docId} verification status to ${verificationStatus}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${docId}`);
  }
}

export async function updateWorkerAvailabilityStatus(
  workerUid: string,
  availabilityStatus: 'available' | 'busy' | 'offline'
): Promise<void> {
  const path = `publicWorkers/${workerUid}`;
  try {
    await updateDoc(doc(db, 'publicWorkers', workerUid), {
      availabilityStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateWorkerPreferredRadius(
  workerUid: string,
  preferredRadiusKm: ServiceRadiusKm
): Promise<void> {
  const path = `publicWorkers/${workerUid}`;
  try {
    await updateDoc(doc(db, 'publicWorkers', workerUid), {
      preferredRadiusKm,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cancelOpenJobByCustomer(jobId: string): Promise<void> {
  const path = `jobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'jobs', jobId), {
      status: 'cancelled',
      dealStatus: 'CANCELLED',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminUpdateWorkerAvailability(
  workerUid: string,
  availabilityStatus: 'available' | 'busy' | 'offline',
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'publicWorkers', workerUid), {
    availabilityStatus,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: `set_worker_availability_${availabilityStatus}`,
    targetCollection: 'publicWorkers',
    targetId: workerUid,
    details: `Updated worker ${workerUid} availability to ${availabilityStatus}`,
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `publicWorkers/${workerUid}`);
  }
}

export async function adminUpdateJobStatus(
  jobId: string,
  status: JobPosting['status'],
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'jobs', jobId), { status, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: `set_job_status_${status}`,
    targetCollection: 'jobs',
    targetId: jobId,
    details: `Updated job status to ${status}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `jobs/${jobId}`);
  }
}

export async function adminUpdateGrievanceStatus(
  grievanceId: string,
  status: GrievanceReport['status'],
  adminNotes: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'grievances', grievanceId), { status, adminNotes, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: `update_grievance_${status}`,
    targetCollection: 'grievances',
    targetId: grievanceId,
    details: adminNotes.slice(0, 200),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `grievances/${grievanceId}`);
  }
}

export async function adminUpdateEnquiryStatus(
  enquiryId: string,
  status: PartnershipEnquiry['status'],
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'partnershipEnquiries', enquiryId), { status, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: `update_enquiry_${status}`,
    targetCollection: 'partnershipEnquiries',
    targetId: enquiryId,
    details: `Marked partnership enquiry as ${status}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `partnershipEnquiries/${enquiryId}`);
  }
}

export async function adminCreateAnnouncement(
  payload: Omit<PlatformAnnouncement, 'id' | 'createdAt' | 'updatedAt'>,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const annRef = doc(collection(db, 'announcements'));
  const batch = writeBatch(db);
  batch.set(annRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: 'create_announcement',
    targetCollection: 'announcements',
    targetId: annRef.id,
    details: payload.titleEn.slice(0, 120),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'announcements');
  }
}

export async function adminToggleAnnouncement(
  id: string,
  active: boolean,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'announcements', id), { active, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, 'auditLogs')), {
    adminUid,
    adminEmail,
    action: active ? 'activate_announcement' : 'deactivate_announcement',
    targetCollection: 'announcements',
    targetId: id,
    details: `Set announcement active=${active}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `announcements/${id}`);
  }
}

export function subscribeVehicleListings(onData: (items: VehicleListing[]) => void): () => void {
  const path = 'vehicleListings';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VehicleListing)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeOwnerVehicles(
  ownerUid: string,
  onData: (items: VehicleListing[]) => void
): () => void {
  const path = 'vehicleListings';
  const q = query(collection(db, path), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VehicleListing)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCustomerVehicleBookings(
  customerUid: string,
  onData: (items: VehicleBooking[]) => void
): () => void {
  const path = 'vehicleBookings';
  const q = query(collection(db, path), where('customerUid', '==', customerUid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VehicleBooking)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeOwnerVehicleBookings(
  ownerUid: string,
  onData: (items: VehicleBooking[]) => void
): () => void {
  const path = 'vehicleBookings';
  const q = query(collection(db, path), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VehicleBooking)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function saveVehicleListing(
  publicData: Omit<
    VehicleListing,
    'id' | 'verificationStatus' | 'completedTripsCount' | 'ratingAvg' | 'createdAt' | 'updatedAt'
  >,
  privateData: Omit<VehiclePrivateInfo, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const pubRef = doc(collection(db, 'vehicleListings'));
  const privRef = doc(db, 'vehiclePrivate', pubRef.id);
  const batch = writeBatch(db);

  batch.set(pubRef, {
    ...publicData,
    verificationStatus: 'pending',
    completedTripsCount: 0,
    ratingAvg: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(privRef, {
    ...privateData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return pubRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `vehicleListings/${pubRef.id}`);
  }
}

export async function updateVehicleAvailability(
  vehicleId: string,
  availabilityStatus: VehicleListing['availabilityStatus']
): Promise<void> {
  const path = `vehicleListings/${vehicleId}`;
  try {
    await updateDoc(doc(db, 'vehicleListings', vehicleId), {
      availabilityStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createVehicleBooking(
  payload: Omit<VehicleBooking, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'vehicleBookings';
  try {
    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'requested',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateVehicleBookingStatus(
  bookingId: string,
  status: VehicleBooking['status']
): Promise<void> {
  const path = `vehicleBookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'vehicleBookings', bookingId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeCustomerPreference(
  uid: string,
  onData: (pref: CustomerPreference | null) => void
): () => void {
  const path = `customerPreferences/${uid}`;
  return onSnapshot(
    doc(db, 'customerPreferences', uid),
    (snap) => {
      if (snap.exists()) {
        onData({ id: snap.id, ...snap.data() } as CustomerPreference);
      } else {
        onData(null);
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export async function saveCustomerDefaultLocation(
  uid: string,
  location: {
    state: string;
    district: string;
    cityOrVillage: string;
    lat?: number;
    lng?: number;
    savedAddressLabel?: string;
  }
): Promise<void> {
  const path = `customerPreferences/${uid}`;
  const ref = doc(db, 'customerPreferences', uid);
  const safeFields = {
    ...(location.state.trim() ? { defaultState: location.state.trim().slice(0, 80) } : {}),
    ...(location.district.trim() ? { defaultDistrict: location.district.trim().slice(0, 80) } : {}),
    ...(location.cityOrVillage.trim() ? { defaultCityOrVillage: location.cityOrVillage.trim().slice(0, 100) } : {}),
    ...(typeof location.lat === 'number' && Number.isFinite(location.lat) ? { defaultLat: location.lat } : {}),
    ...(typeof location.lng === 'number' && Number.isFinite(location.lng) ? { defaultLng: location.lng } : {}),
    ...(location.savedAddressLabel?.trim()
      ? { savedAddressLabel: location.savedAddressLabel.trim().slice(0, 160) }
      : {}),
  };

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        ...safeFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerUid: uid,
        ...safeFields,
        frequentWorkerCategories: [],
        frequentVehicleTypes: [],
        totalHireOrders: 0,
        totalTransportOrders: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function recordCustomerOrderPreference(
  uid: string,
  input: {
    kind: 'hire' | 'transport';
    categoryOrVehicleType: string;
    orderTitle: string;
    state?: string;
    district?: string;
    cityOrVillage?: string;
    lat?: number;
    lng?: number;
  }
): Promise<void> {
  const path = `customerPreferences/${uid}`;
  const ref = doc(db, 'customerPreferences', uid);
  try {
    const snap = await getDoc(ref);
    const prev = snap.exists() ? (snap.data() as CustomerPreference) : null;

    const prevWorkers = Array.isArray(prev?.frequentWorkerCategories) ? prev.frequentWorkerCategories : [];
    const prevVehicles = Array.isArray(prev?.frequentVehicleTypes) ? prev.frequentVehicleTypes : [];

    const nextWorkers =
      input.kind === 'hire' && input.categoryOrVehicleType
        ? [input.categoryOrVehicleType, ...prevWorkers.filter((c) => c !== input.categoryOrVehicleType)].slice(0, 10)
        : prevWorkers.slice(0, 10);

    const nextVehicles =
      input.kind === 'transport' && input.categoryOrVehicleType
        ? [
            input.categoryOrVehicleType as VehicleType,
            ...prevVehicles.filter((v) => v !== input.categoryOrVehicleType),
          ].slice(0, 10)
        : prevVehicles.slice(0, 10);

    const locFields = {
      ...(input.state?.trim() ? { defaultState: input.state.trim().slice(0, 80) } : {}),
      ...(input.district?.trim() ? { defaultDistrict: input.district.trim().slice(0, 80) } : {}),
      ...(input.cityOrVillage?.trim() ? { defaultCityOrVillage: input.cityOrVillage.trim().slice(0, 100) } : {}),
      ...(typeof input.lat === 'number' && Number.isFinite(input.lat) ? { defaultLat: input.lat } : {}),
      ...(typeof input.lng === 'number' && Number.isFinite(input.lng) ? { defaultLng: input.lng } : {}),
    };

    if (snap.exists()) {
      await updateDoc(ref, {
        ...locFields,
        frequentWorkerCategories: nextWorkers,
        frequentVehicleTypes: nextVehicles,
        totalHireOrders: (prev?.totalHireOrders ?? 0) + (input.kind === 'hire' ? 1 : 0),
        totalTransportOrders: (prev?.totalTransportOrders ?? 0) + (input.kind === 'transport' ? 1 : 0),
        lastOrderTitle: input.orderTitle.trim().slice(0, 160) || 'Recent Order',
        lastOrderCategory: input.categoryOrVehicleType.trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerUid: uid,
        ...locFields,
        frequentWorkerCategories: nextWorkers,
        frequentVehicleTypes: nextVehicles,
        totalHireOrders: input.kind === 'hire' ? 1 : 0,
        totalTransportOrders: input.kind === 'transport' ? 1 : 0,
        lastOrderTitle: input.orderTitle.trim().slice(0, 160) || 'Recent Order',
        lastOrderCategory: input.categoryOrVehicleType.trim().slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeNotificationPreferences(
  uid: string,
  onData: (pref: NotificationPreferences | null) => void
): () => void {
  const path = `notification_preferences/${uid}`;
  return onSnapshot(
    doc(db, 'notification_preferences', uid),
    (snap) => {
      onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as NotificationPreferences) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export async function saveNotificationPreferences(
  uid: string,
  updates: Partial<
    Pick<
      NotificationPreferences,
      | 'masterEnabled'
      | 'matchingJobs'
      | 'nearbyJobs'
      | 'applicationUpdates'
      | 'bookingNotifications'
      | 'announcements'
      | 'preferredLanguage'
      | 'voiceAlertsEnabled'
      | 'soundEnabled'
      | 'toneNewJobEnabled'
      | 'toneNewOfferEnabled'
      | 'toneDealConfirmedEnabled'
      | 'toneDealClosedEnabled'
      | 'preferredCategories'
      | 'preferredRadiusKm'
    >
  >
): Promise<void> {
  const path = `notification_preferences/${uid}`;
  const ref = doc(db, 'notification_preferences', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerUid: uid,
        masterEnabled: updates.masterEnabled ?? true,
        matchingJobs: updates.matchingJobs ?? true,
        nearbyJobs: updates.nearbyJobs ?? true,
        applicationUpdates: updates.applicationUpdates ?? true,
        bookingNotifications: updates.bookingNotifications ?? true,
        announcements: updates.announcements ?? true,
        preferredLanguage: updates.preferredLanguage ?? 'en',
        voiceAlertsEnabled: updates.voiceAlertsEnabled ?? true,
        soundEnabled: updates.soundEnabled ?? true,
        toneNewJobEnabled: updates.toneNewJobEnabled ?? true,
        toneNewOfferEnabled: updates.toneNewOfferEnabled ?? true,
        toneDealConfirmedEnabled: updates.toneDealConfirmedEnabled ?? true,
        toneDealClosedEnabled: updates.toneDealClosedEnabled ?? true,
        preferredRadiusKm: updates.preferredRadiusKm ?? 30,
        ...(Array.isArray(updates.preferredCategories)
          ? { preferredCategories: updates.preferredCategories.slice(0, 35) }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Sync non-PII worker broadcast preferences onto publicWorkers/{uid} if a worker profile exists
    const workerSync: Record<string, unknown> = {};
    if (updates.preferredLanguage) workerSync.preferredLanguage = updates.preferredLanguage;
    if (updates.preferredRadiusKm) workerSync.preferredRadiusKm = updates.preferredRadiusKm;
    if (typeof updates.voiceAlertsEnabled === 'boolean') {
      workerSync.voiceAlertsEnabled = updates.voiceAlertsEnabled;
    }
    if (Object.keys(workerSync).length > 0) {
      const workerRef = doc(db, 'publicWorkers', uid);
      const workerSnap = await getDoc(workerRef);
      if (workerSnap.exists()) {
        await updateDoc(workerRef, {
          ...workerSync,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserDeviceTokens(
  uid: string,
  onData: (tokens: DeviceTokenRecord[]) => void
): () => void {
  const path = 'device_tokens';
  const q = query(collection(db, path), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeviceTokenRecord)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllDeviceTokensAdmin(
  onData: (tokens: DeviceTokenRecord[]) => void
): () => void {
  const path = 'device_tokens';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeviceTokenRecord)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeUserNotifications(
  uid: string,
  onData: (items: AppNotificationRecord[]) => void
): () => void {
  const path = 'notifications';
  const q = query(collection(db, path), where('recipientUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotificationRecord));
      list.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number } | null)?.seconds ?? Number.MAX_SAFE_INTEGER;
        const tb = (b.createdAt as { seconds?: number } | null)?.seconds ?? Number.MAX_SAFE_INTEGER;
        return tb - ta;
      });
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(notifications: AppNotificationRecord[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  for (let i = 0; i < unread.length; i += 400) {
    const chunk = unread.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit().catch(() => undefined);
  }
}

export function subscribeDealMessages(
  applicationId: string,
  onData: (items: DealMessage[]) => void
): () => void {
  const path = 'dealMessages';
  const q = query(collection(db, path), where('applicationId', '==', applicationId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DealMessage));
      list.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return ta - tb;
      });
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

/**
 * Subscribes to ALL real-time messages for a specific (jobId, workerUid) conversation —
 * seamlessly combining messages sent BEFORE an offer is submitted and AFTER offer/acceptance.
 * Queries on a single participant field (workerUid or employerUid) so no composite index is required
 * and Firestore security rules allowlist passes strictly.
 */
export function subscribeOrderMessagesForParticipant(params: {
  jobId: string;
  workerUid: string;
  viewerRole: 'customer' | 'worker';
  viewerUid: string;
  onData: (items: DealMessage[]) => void;
}): () => void {
  const path = 'dealMessages';
  const filterField = params.viewerRole === 'worker' ? 'workerUid' : 'employerUid';
  const q = query(collection(db, path), where(filterField, '==', params.viewerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DealMessage))
        .filter((m) => m.jobId === params.jobId && m.workerUid === params.workerUid);
      list.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return ta - tb;
      });
      params.onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllCustomerOrderMessages(
  employerUid: string,
  onData: (items: DealMessage[]) => void
): () => void {
  const path = 'dealMessages';
  const q = query(collection(db, path), where('employerUid', '==', employerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DealMessage));
      list.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return ta - tb;
      });
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function sendOrderMessage(params: {
  jobId: string;
  jobTitle: string;
  employerUid: string;
  workerUid: string;
  applicationId?: string;
  dealStatus?: DealStatus;
  senderUid: string;
  senderRole: 'customer' | 'worker';
  senderName: string;
  text: string;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, 1000);
  if (!cleanText) return;
  const path = 'dealMessages';
  const threadAppId =
    params.applicationId && params.applicationId.trim().length > 0
      ? params.applicationId.trim()
      : sanitizeSafeId(`pre_${params.jobId}_${params.workerUid}`);

  try {
    const safeSenderName =
      params.senderName.trim().length >= 2 ? params.senderName.trim().slice(0, 120) : 'Participant';
    await addDoc(collection(db, path), {
      applicationId: threadAppId,
      jobId: params.jobId,
      employerUid: params.employerUid,
      workerUid: params.workerUid,
      senderUid: params.senderUid,
      senderRole: params.senderRole,
      senderName: safeSenderName,
      text: cleanText,
      createdAt: serverTimestamp(),
    });

    const recipientUid = params.senderRole === 'customer' ? params.workerUid : params.employerUid;
    const recipientRole = params.senderRole === 'customer' ? 'worker' : 'employer';
    const targetRoute = params.senderRole === 'customer' ? 'worker-dashboard' : 'employer-dashboard';
    const eventType: DealNotificationEventType =
      params.senderRole === 'customer' ? 'customer_message' : 'worker_message';

    await dispatchTwoWayDealNotification({
      recipientUid,
      recipientRole,
      senderUid: params.senderUid,
      senderName: safeSenderName,
      category: 'applicationUpdates',
      eventType,
      dealStatus: params.dealStatus || 'REQUESTED',
      title: `Chat from ${safeSenderName}: ${params.jobTitle}`,
      body: `${safeSenderName}: "${cleanText.slice(0, 160)}"`,
      metadataLabel: params.jobTitle,
      targetRoute,
      targetJobId: params.jobId,
      ...(params.applicationId ? { targetApplicationId: params.applicationId } : {}),
      dedupeKey: sanitizeSafeId(`msg_${params.jobId}_${params.senderUid}_${Date.now()}`),
      pushPayload: {
        workerName: safeSenderName,
        jobTitle: params.jobTitle,
        messageSnippet: cleanText.slice(0, 160),
      },
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function sendDealMessage(params: {
  app: JobApplication;
  senderUid: string;
  senderRole: 'customer' | 'worker';
  senderName: string;
  text: string;
}): Promise<void> {
  await sendOrderMessage({
    jobId: params.app.jobId,
    jobTitle: params.app.jobTitle,
    employerUid: params.app.employerUid,
    workerUid: params.app.workerUid,
    applicationId: params.app.id,
    dealStatus: getEffectiveDealStatus(params.app),
    senderUid: params.senderUid,
    senderRole: params.senderRole,
    senderName: params.senderName,
    text: params.text,
  });
}

export function subscribeDealLocationShares(
  applicationId: string,
  onData: (shares: DealLocationShare[]) => void
): () => void {
  const path = 'dealLocationShares';
  const q = query(collection(db, path), where('applicationId', '==', applicationId));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DealLocationShare)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function updateDealLiveLocation(params: {
  app: JobApplication;
  ownerUid: string;
  role: 'customer' | 'worker';
  participantName: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  sharingActive: boolean;
  source?: DealLocationShare['source'];
}): Promise<void> {
  const shareId = sanitizeSafeId(`${params.app.id}_${params.role}`);
  const shareRef = doc(db, 'dealLocationShares', shareId);
  const path = `dealLocationShares/${shareId}`;

  try {
    const existing = await getDoc(shareRef);
    const wasActive = existing.exists() && existing.data()?.sharingActive === true;
    const authorizedUids = [params.app.employerUid, params.app.workerUid];
    const safeParticipantName =
      params.participantName.trim().length >= 2
        ? params.participantName.trim().slice(0, 120)
        : params.role === 'customer'
          ? 'Customer'
          : 'Worker';
    if (!existing.exists()) {
      await setDoc(shareRef, {
        applicationId: params.app.id,
        jobId: params.app.jobId,
        ownerUid: params.ownerUid,
        authorizedUids,
        role: params.role,
        participantName: safeParticipantName,
        lat: Number(params.lat),
        lng: Number(params.lng),
        accuracyMeters: Math.max(0, Math.min(200000, Number(params.accuracyMeters) || 50)),
        sharingActive: params.sharingActive,
        source: params.source || 'gps_once',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(shareRef, {
        participantName: safeParticipantName,
        lat: Number(params.lat),
        lng: Number(params.lng),
        accuracyMeters: Math.max(0, Math.min(200000, Number(params.accuracyMeters) || 50)),
        sharingActive: params.sharingActive,
        source: params.source || 'gps_once',
        updatedAt: serverTimestamp(),
      });
    }

    // Immediately notify counterparty when location sharing is turned ON
    if (params.sharingActive && !wasActive) {
      const isCustomerSharing = params.role === 'customer';
      const recipientUid = isCustomerSharing ? params.app.workerUid : params.app.employerUid;
      const recipientRole = isCustomerSharing ? 'worker' : 'employer';
      const targetRoute = isCustomerSharing ? 'worker-dashboard' : 'employer-dashboard';
      const eventType: DealNotificationEventType = isCustomerSharing
        ? 'customer_location_shared'
        : 'worker_location_shared';

      await dispatchTwoWayDealNotification({
        recipientUid,
        recipientRole,
        senderUid: params.ownerUid,
        senderName: safeParticipantName,
        category: 'bookingNotifications',
        eventType,
        toneType: 'deal_accepted',
        dealStatus: getEffectiveDealStatus(params.app),
        title: isCustomerSharing
          ? `Customer Shared Exact Location: ${params.app.jobTitle}`
          : `Worker Shared Live Location: ${params.app.jobTitle}`,
        body: isCustomerSharing
          ? `${safeParticipantName} shared their exact location pin. Open dashboard to view on map and tap GET DIRECTIONS.`
          : `${safeParticipantName} started sharing live location for "${params.app.jobTitle}". Open dashboard to track arrival.`,
        metadataLabel: isCustomerSharing ? 'Exact Location Shared' : 'Worker Live Location',
        targetRoute,
        targetJobId: params.app.jobId,
        targetApplicationId: params.app.id,
        dedupeKey: sanitizeSafeId(`loc_share_${params.app.id}_${params.role}_${Date.now()}`),
        pushPayload: {
          workerName: safeParticipantName,
          jobTitle: params.app.jobTitle,
          locationLabel: params.app.jobLocationLabel || params.app.jobDistrict || '',
        },
      }).catch(() => undefined);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchAllNotificationRecipientsForJob(jobId: string): Promise<string[]> {
  try {
    const snap = await getDocs(query(collection(db, 'notifications'), where('targetJobId', '==', jobId)));
    return snap.docs.map((d) => String(d.data().recipientUid || '')).filter(Boolean);
  } catch {
    return [];
  }
}

export function subscribeDeliveryLogsAdmin(
  onData: (items: NotificationDeliveryLog[]) => void
): () => void {
  const path = 'notification_delivery_logs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationDeliveryLog)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeDemoAccounts(
  onData: (items: DemoWorkerAccount[]) => void
): () => void {
  const path = 'demo_accounts';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoWorkerAccount)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function createDemoAccount(
  payload: Omit<DemoWorkerAccount, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'demo_accounts';
  try {
    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'DEMO',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteDemoAccount(accountId: string): Promise<void> {
  const path = `demo_accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'demo_accounts', accountId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeDemoJobs(
  onData: (items: DemoJobPosting[]) => void
): () => void {
  const path = 'demo_jobs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoJobPosting)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function createDemoJob(
  payload: Omit<DemoJobPosting, 'id' | 'isDemo' | 'status' | 'applicationsCount' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'demo_jobs';
  try {
    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'open',
      isDemo: true,
      applicationsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeDemoApplicationsByUser(
  uid: string,
  onData: (items: DemoJobApplication[]) => void
): () => void {
  const path = 'demo_applications';
  const q = query(collection(db, path), where('applicantUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoJobApplication)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllDemoApplicationsAdmin(
  onData: (items: DemoJobApplication[]) => void
): () => void {
  const path = 'demo_applications';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoJobApplication)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function submitDemoJobApplication(
  payload: Omit<DemoJobApplication, 'id' | 'status' | 'isDemo' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const appRef = doc(collection(db, 'demo_applications'));
  const jobRef = doc(db, 'demo_jobs', payload.demoJobId);
  const batch = writeBatch(db);
  batch.set(appRef, {
    ...payload,
    status: 'applied',
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(jobRef, {
    applicationsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return appRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `demo_applications/${appRef.id}`);
  }
}

export async function callNotificationApi<T = Record<string, unknown>>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: T }> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  const response = await fetch(endpoint, {
    method: body ? 'POST' : 'GET',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, data };
}

// ============================================================
// CUSTOMER PRIVACY VAULT, VISIBILITY SETTINGS & MASKED CALLING
// ============================================================

export async function updateCustomerPrivacySettings(
  uid: string,
  settings: {
    gender: CustomerGender;
    lastName?: string;
    profileVisibility: CustomerProfileVisibility;
    hidePhotoUntilConfirm: boolean;
    maskedCallingOnly: boolean;
  }
): Promise<void> {
  const pubRef = doc(db, 'publicEmployers', uid);
  const privRef = doc(db, 'employerPrivate', uid);
  const enforcedVisibility: CustomerProfileVisibility =
    settings.gender === 'female' && settings.profileVisibility === 'standard'
      ? 'last_name_only'
      : settings.profileVisibility;

  try {
    const pubPayload: Record<string, unknown> = {
      gender: settings.gender,
      profileVisibility: enforcedVisibility,
      hidePhotoUntilConfirm: settings.gender === 'female' ? true : settings.hidePhotoUntilConfirm,
      maskedCallingOnly: settings.gender === 'female' ? true : settings.maskedCallingOnly,
      updatedAt: serverTimestamp(),
    };
    if (settings.lastName && settings.lastName.trim()) {
      pubPayload.lastName = settings.lastName.trim().slice(0, 60);
    }
    await updateDoc(pubRef, pubPayload);

    const privSnap = await getDoc(privRef).catch(() => null);
    if (privSnap?.exists()) {
      const privPayload: Record<string, unknown> = {
        gender: settings.gender,
        profileVisibility: enforcedVisibility,
        updatedAt: serverTimestamp(),
      };
      if (settings.lastName && settings.lastName.trim()) {
        privPayload.lastName = settings.lastName.trim().slice(0, 60);
      }
      await updateDoc(privRef, privPayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `publicEmployers/${uid}`);
  }
}

export async function saveOrderExactAddress(params: {
  jobId: string;
  employerUid: string;
  exactAddress: string;
  landmark?: string;
  exactLat: number;
  exactLng: number;
}): Promise<void> {
  const cleanAddr = params.exactAddress.trim().slice(0, 300);
  if (cleanAddr.length < 4) return;
  const ref = doc(db, 'orderExactAddresses', params.jobId);
  try {
    await setDoc(ref, {
      jobId: params.jobId,
      employerUid: params.employerUid,
      exactAddress: cleanAddr,
      ...(params.landmark?.trim() ? { landmark: params.landmark.trim().slice(0, 160) } : {}),
      exactLat: Number.isFinite(params.exactLat) ? params.exactLat : 20.59,
      exactLng: Number.isFinite(params.exactLng) ? params.exactLng : 78.96,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orderExactAddresses/${params.jobId}`);
  }
}

export async function getOrderExactAddress(jobId: string): Promise<OrderExactAddressRecord | null> {
  if (!jobId) return null;
  try {
    const snap = await getDoc(doc(db, 'orderExactAddresses', jobId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as OrderExactAddressRecord;
  } catch {
    // Expected permission denial for unassigned workers or unconfirmed orders
    return null;
  }
}

export async function initiateMaskedCallSession(params: {
  application: JobApplication;
  callerUid: string;
  callerRole: 'customer' | 'worker';
  callerSafeName: string;
  receiverSafeName: string;
}): Promise<MaskedCallSession> {
  const { application, callerUid, callerRole, callerSafeName, receiverSafeName } = params;

  // Attempt server-brokered masked call session first (returns redacted bridge metadata)
  let serverBridgeCode = '';
  let serverVirtualNum = '';
  try {
    const apiRes = await callNotificationApi<{
      ok?: boolean;
      sessionId?: string;
      maskedBridgeCode?: string;
      maskedVirtualNumber?: string;
      relayMode?: string;
    }>('/api/calls/masked-session', {
      applicationId: application.id,
    });
    if (apiRes.status === 200 && apiRes.data?.ok) {
      serverBridgeCode = apiRes.data.maskedBridgeCode || '';
      serverVirtualNum = apiRes.data.maskedVirtualNumber || '';
      if (apiRes.data.relayMode === 'server_masked_bridge' && apiRes.data.sessionId) {
        return {
          id: apiRes.data.sessionId,
          applicationId: application.id,
          jobId: application.jobId,
          employerUid: application.employerUid,
          workerUid: application.workerUid,
          initiatedByUid: callerUid,
          initiatedByRole: callerRole,
          callerSafeName: callerSafeName.slice(0, 120),
          receiverSafeName: receiverSafeName.slice(0, 120),
          maskedBridgeCode: serverBridgeCode,
          maskedVirtualNumber: serverVirtualNum,
          status: 'ringing',
        };
      }
    }
  } catch {
    // Fall back to direct Firestore maskedCallSessions guarded by isActiveAcceptedDeal security rule
  }

  const sessionId = sanitizeSafeId(`mcall_${application.id.slice(0, 32)}_${Date.now()}`);
  const maskedBridgeCode = serverBridgeCode || formatMaskedBridgeCode(`${application.id}_${sessionId}`);
  const maskedVirtualNumber = serverVirtualNum || formatMaskedVirtualDisplay(application.id);

  const payload = {
    applicationId: application.id,
    jobId: application.jobId,
    employerUid: application.employerUid,
    workerUid: application.workerUid,
    initiatedByUid: callerUid,
    initiatedByRole: callerRole,
    callerSafeName: callerSafeName.trim().slice(0, 120) || 'Participant',
    receiverSafeName: receiverSafeName.trim().slice(0, 120) || 'Participant',
    maskedBridgeCode,
    maskedVirtualNumber,
    status: 'ringing' as MaskedCallStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'maskedCallSessions', sessionId), payload);
    return {
      id: sessionId,
      ...payload,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `maskedCallSessions/${sessionId}`);
  }
}

export function subscribeDealMaskedCalls(
  applicationId: string,
  onData: (sessions: MaskedCallSession[]) => void
): () => void {
  const q = query(
    collection(db, 'maskedCallSessions'),
    where('applicationId', '==', applicationId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as MaskedCallSession))
        .sort((a, b) => {
          const aMs = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          const bMs = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          return bMs - aMs;
        });
      onData(items);
    },
    () => onData([])
  );
}

export async function updateMaskedCallStatus(
  sessionId: string,
  status: MaskedCallStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'maskedCallSessions', sessionId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `maskedCallSessions/${sessionId}`);
  }
}

export async function adminFetchAllEmployerPrivate(): Promise<Record<string, EmployerPrivateInfo>> {
  try {
    const snap = await getDocs(collection(db, 'employerPrivate'));
    const map: Record<string, EmployerPrivateInfo> = {};
    snap.docs.forEach((d) => {
      map[d.id] = d.data() as EmployerPrivateInfo;
    });
    return map;
  } catch {
    return {};
  }
}


