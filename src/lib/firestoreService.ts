import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type {
  AppNotificationRecord,
  AuditLog,
  CustomerPreference,
  DemoJobApplication,
  DemoJobPosting,
  DemoWorkerAccount,
  DeviceTokenRecord,
  EmployerPrivateInfo,
  GrievanceReport,
  JobApplication,
  JobPosting,
  NotificationDeliveryLog,
  NotificationPreferences,
  PartnershipEnquiry,
  PlatformAnnouncement,
  PublicEmployerProfile,
  PublicWorkerProfile,
  VehicleBooking,
  VehicleListing,
  VehiclePrivateInfo,
  VehicleType,
  VerificationStatus,
  WorkerPrivateInfo,
} from '../types/domain';

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

export async function saveWorkerRegistration(
  uid: string,
  isExisting: boolean,
  publicData: Omit<PublicWorkerProfile, 'id' | 'createdAt' | 'updatedAt'>,
  privateData: Omit<WorkerPrivateInfo, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const pubRef = doc(db, 'publicWorkers', uid);
  const privRef = doc(db, 'workerPrivate', uid);
  const batch = writeBatch(db);

  if (!isExisting) {
    batch.set(pubRef, {
      ...publicData,
      verificationStatus: 'pending',
      completedJobsCount: 0,
      ratingAvg: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(privRef, {
      ...privateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(pubRef, {
      displayName: publicData.displayName,
      primarySkill: publicData.primarySkill,
      skills: publicData.skills,
      experienceYears: publicData.experienceYears,
      expectedWage: publicData.expectedWage,
      wageUnit: publicData.wageUnit,
      preferredWorkType: publicData.preferredWorkType,
      availabilityStatus: publicData.availabilityStatus,
      state: publicData.state,
      district: publicData.district,
      cityOrVillage: publicData.cityOrVillage,
      approxLat: publicData.approxLat,
      approxLng: publicData.approxLng,
      languagesKnown: publicData.languagesKnown,
      ...(publicData.gender ? { gender: publicData.gender } : {}),
      ...(publicData.education ? { education: publicData.education } : {}),
      ...(typeof publicData.isWomenEnterprise === 'boolean' ? { isWomenEnterprise: publicData.isWomenEnterprise } : {}),
      updatedAt: serverTimestamp(),
    });
    batch.update(privRef, {
      fullName: privateData.fullName,
      mobile: privateData.mobile,
      mobileVerified: privateData.mobileVerified,
      ...(privateData.email ? { email: privateData.email } : {}),
      ageConfirmed: privateData.ageConfirmed,
      ...(privateData.preferredWorkLocation ? { preferredWorkLocation: privateData.preferredWorkLocation } : {}),
      liveLocationConsent: privateData.liveLocationConsent,
      privacyConsent: privateData.privacyConsent,
      idVerificationStatus: privateData.idVerificationStatus,
      ...(privateData.certificateNotes ? { certificateNotes: privateData.certificateNotes } : {}),
      ...(privateData.photoUrl ? { photoUrl: privateData.photoUrl } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `publicWorkers/${uid}`);
  }
}

export async function saveEmployerRegistration(
  uid: string,
  isExisting: boolean,
  publicData: Omit<PublicEmployerProfile, 'id' | 'createdAt' | 'updatedAt'>,
  privateData: Omit<EmployerPrivateInfo, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const pubRef = doc(db, 'publicEmployers', uid);
  const privRef = doc(db, 'employerPrivate', uid);
  const batch = writeBatch(db);

  if (!isExisting) {
    batch.set(pubRef, {
      ...publicData,
      verificationStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(privRef, {
      ...privateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(pubRef, {
      businessName: publicData.businessName,
      businessType: publicData.businessType,
      industryCategory: publicData.industryCategory,
      state: publicData.state,
      district: publicData.district,
      requiredCategories: publicData.requiredCategories,
      updatedAt: serverTimestamp(),
    });
    batch.update(privRef, {
      contactPerson: privateData.contactPerson,
      mobile: privateData.mobile,
      mobileVerified: privateData.mobileVerified,
      email: privateData.email,
      businessAddress: privateData.businessAddress,
      ...(privateData.gstNumber ? { gstNumber: privateData.gstNumber } : {}),
      ...(privateData.establishmentDetails ? { establishmentDetails: privateData.establishmentDetails } : {}),
      ...(privateData.workforceNotes ? { workforceNotes: privateData.workforceNotes } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `publicEmployers/${uid}`);
  }
}

export async function createJobPosting(
  payload: Omit<JobPosting, 'id' | 'status' | 'applicationsCount' | 'createdAt' | 'updatedAt'>,
  idempotencyKey?: string
): Promise<string> {
  const path = 'jobs';
  const safeKey = idempotencyKey ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) : '';
  try {
    if (safeKey && safeKey.length >= 8) {
      const targetRef = doc(db, path, safeKey);
      const existingSnap = await getDoc(targetRef);
      if (existingSnap.exists()) {
        return existingSnap.id;
      }
      await setDoc(targetRef, {
        ...payload,
        status: 'open',
        applicationsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return safeKey;
    }

    const ref = await addDoc(collection(db, path), {
      ...payload,
      status: 'open',
      applicationsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createInstantHireRequest(
  jobPayload: Omit<JobPosting, 'id' | 'status' | 'applicationsCount' | 'createdAt' | 'updatedAt'>,
  selectedWorkers: PublicWorkerProfile[],
  inviteNote?: string,
  idempotencyKey?: string
): Promise<{ jobId: string; invitedCount: number }> {
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

  // Create job document first so Firestore security rule `get(/databases/.../jobs/$(jobId))`
  // resolves cleanly when creating invited applications immediately afterward.
  const jobId = await createJobPosting(jobPayload, safeKey || undefined);

  if (selectedWorkers.length === 0 || alreadyExisted) {
    return { jobId, invitedCount: alreadyExisted ? selectedWorkers.length : 0 };
  }

  const batch = writeBatch(db);
  const safeTitle = jobPayload.title.trim().slice(0, 140) || 'Instant Hire Request';
  const safeNote = (inviteNote ?? '').trim().slice(0, 600);

  for (const worker of selectedWorkers) {
    const appRef = doc(collection(db, 'applications'));
    batch.set(appRef, {
      jobId,
      jobTitle: safeTitle,
      employerUid: jobPayload.employerUid,
      workerUid: worker.ownerUid,
      workerRegistrationId: worker.registrationId,
      workerName: worker.displayName,
      workerPrimarySkill: worker.primarySkill,
      proposedWage: jobPayload.offeredWage > 0 ? jobPayload.offeredWage : worker.expectedWage,
      ...(safeNote ? { note: safeNote } : {}),
      status: 'invited',
      liveTrackingAuthorized: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return { jobId, invitedCount: selectedWorkers.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/instant-hire-${jobId}`);
  }
}

export async function applyToJob(
  payload: Omit<JobApplication, 'id' | 'status' | 'liveTrackingAuthorized' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const appRef = doc(collection(db, 'applications'));
  const jobRef = doc(db, 'jobs', payload.jobId);
  const batch = writeBatch(db);
  batch.set(appRef, {
    ...payload,
    status: 'applied',
    liveTrackingAuthorized: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(jobRef, {
    applicationsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/${appRef.id}`);
  }
}

export async function updateApplicationByWorker(
  applicationId: string,
  updates: { status?: 'applied' | 'accepted' | 'declined'; liveTrackingAuthorized?: boolean; note?: string }
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
    workerRating?: number;
    employerFeedback?: string;
  }
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
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

