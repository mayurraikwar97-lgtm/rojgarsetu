import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { calculateDistanceKm } from '../data/indiaLocations';
import { getFirebaseVapidKey } from './appConfig';
import { db, handleFirestoreError, OperationType } from './firebase';
import { callNotificationApi } from './firestoreService';
import {
  deleteProfilePhotoRecord,
  grantAcceptedCustomerPhoto,
} from './photoStorageService';
import { hashTestPin, normalizeTenDigitIndianMobile } from './pinAuth';
import type {
  DemoLiveLocationShare,
  DemoLocationPermissionStatus,
  DemoLocationSource,
  DemoModeConfig,
  DemoNotificationRecord,
  DemoShareSource,
  DemoUserProfile,
  DemoUserRole,
  DemoWorkOrder,
  WageUnit,
} from '../types/domain';

export const DEMO_CONFIG_DOC_PATH = 'platform_settings/demo_config';

export function isDemoModeEnvEnabled(): boolean {
  const raw = import.meta.env.VITE_DEMO_MODE_ENABLED;
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'false') {
    return false;
  }
  return true;
}

export { hashTestPin };

export function sanitizeIndianMobile10(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function maskIndianMobile(mobile10: string): string {
  const clean = normalizeTenDigitIndianMobile(mobile10);
  if (clean.length !== 10) return '+91 XXXXXXXXXX';
  return `+91 ${clean.slice(0, 2)}XXXX${clean.slice(6)}`;
}

function makeUniqueDemoUserId(role: DemoUserRole, category: string): string {
  const roleTag =
    role === 'customer'
      ? 'CUST'
      : category.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'WRK';
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || '10001';
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `RS-DEMO-${roleTag}-${ts}${rand}`.slice(0, 40);
}

function makeOrderCode(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return `DEMO-ORD-${ts}${rand}`;
}

export function formatTimeValue(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '—';
  const maybe = ts as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString('en-IN');
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString('en-IN');
  return '—';
}

function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
    const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
    return tb - ta;
  });
}

export function subscribeDemoModeConfig(
  onData: (config: DemoModeConfig | null) => void
): () => void {
  const ref = doc(db, 'platform_settings', 'demo_config');
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as DemoModeConfig) : null);
    },
    (err) => {
      console.warn('Demo config listener error:', err);
      onData(null);
    }
  );
}

export async function setDemoModeEnabled(
  adminUid: string,
  enabled: boolean
): Promise<void> {
  const ref = doc(db, 'platform_settings', 'demo_config');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        enabled,
        testOnlyOtpMode: true,
        maxUsers: 5,
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        enabled,
        testOnlyOtpMode: true,
        maxUsers: 5,
        updatedByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, DEMO_CONFIG_DOC_PATH);
  }
}

export function subscribeDemoUsers(
  _ownerUid: string,
  _isAdmin: boolean,
  onData: (users: DemoUserProfile[]) => void
): () => void {
  const path = 'demo_users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoUserProfile));
      list.sort((a, b) => a.uniqueUserId.localeCompare(b.uniqueUserId));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeDemoWorkOrders(
  ownerUid: string,
  isAdmin: boolean,
  onData: (orders: DemoWorkOrder[]) => void
): () => void {
  const path = 'demo_work_orders';
  if (isAdmin) {
    return onSnapshot(
      collection(db, path),
      (snap) => {
        onData(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoWorkOrder))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  }

  const buckets = {
    owned: new Map<string, DemoWorkOrder>(),
    matched: new Map<string, DemoWorkOrder>(),
    accepted: new Map<string, DemoWorkOrder>(),
  };

  const emit = () => {
    const merged = new Map<string, DemoWorkOrder>();
    for (const map of [buckets.owned, buckets.matched, buckets.accepted]) {
      for (const [id, ord] of map.entries()) merged.set(id, ord);
    }
    onData(sortByCreatedAtDesc(Array.from(merged.values())));
  };

  const u1 = onSnapshot(
    query(collection(db, path), where('ownerUid', '==', ownerUid)),
    (snap) => {
      buckets.owned.clear();
      snap.docs.forEach((d) => buckets.owned.set(d.id, { id: d.id, ...d.data() } as DemoWorkOrder));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  const u2 = onSnapshot(
    query(collection(db, path), where('matchedWorkerOwnerUids', 'array-contains', ownerUid)),
    (snap) => {
      buckets.matched.clear();
      snap.docs.forEach((d) => buckets.matched.set(d.id, { id: d.id, ...d.data() } as DemoWorkOrder));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  const u3 = onSnapshot(
    query(collection(db, path), where('acceptedWorkerOwnerUid', '==', ownerUid)),
    (snap) => {
      buckets.accepted.clear();
      snap.docs.forEach((d) => buckets.accepted.set(d.id, { id: d.id, ...d.data() } as DemoWorkOrder));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  return () => {
    u1();
    u2();
    u3();
  };
}

export function subscribeDemoLocationShares(
  ownerUid: string,
  isAdmin: boolean,
  onData: (shares: DemoLiveLocationShare[]) => void
): () => void {
  const path = 'demo_location_shares';
  const q = isAdmin
    ? collection(db, path)
    : query(collection(db, path), where('authorizedOwnerUids', 'array-contains', ownerUid));

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoLiveLocationShare)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeDemoNotifications(
  ownerUid: string,
  isAdmin: boolean,
  onData: (items: DemoNotificationRecord[]) => void
): () => void {
  const path = 'demo_notifications';
  if (isAdmin) {
    return onSnapshot(
      collection(db, path),
      (snap) => {
        onData(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoNotificationRecord))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  }

  const received = new Map<string, DemoNotificationRecord>();
  const sent = new Map<string, DemoNotificationRecord>();

  const emit = () => {
    const merged = new Map<string, DemoNotificationRecord>();
    for (const [id, n] of received.entries()) merged.set(id, n);
    for (const [id, n] of sent.entries()) merged.set(id, n);
    onData(sortByCreatedAtDesc(Array.from(merged.values())));
  };

  const u1 = onSnapshot(
    query(collection(db, path), where('recipientOwnerUid', '==', ownerUid)),
    (snap) => {
      received.clear();
      snap.docs.forEach((d) => received.set(d.id, { id: d.id, ...d.data() } as DemoNotificationRecord));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  const u2 = onSnapshot(
    query(collection(db, path), where('senderOwnerUid', '==', ownerUid)),
    (snap) => {
      sent.clear();
      snap.docs.forEach((d) => sent.set(d.id, { id: d.id, ...d.data() } as DemoNotificationRecord));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  return () => {
    u1();
    u2();
  };
}

export interface RegisterDemoUserInput {
  ownerUid: string;
  role: DemoUserRole;
  category: string;
  displayName: string;
  mobile: string;
  pin?: string;
  slotLabel?: string;
  deviceLabel?: string;
  state: string;
  district: string;
  cityOrVillage: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  locationPermissionStatus: DemoLocationPermissionStatus;
  locationSource: DemoLocationSource;
  availabilityStatus?: 'available' | 'busy' | 'offline';
  photoDocId?: string;
  pushEnabled?: boolean;
  fixedDocId?: string;
  fixedUniqueUserId?: string;
}

export async function registerDemoUser(input: RegisterDemoUserInput): Promise<DemoUserProfile> {
  const mobile10 = sanitizeIndianMobile10(input.mobile);
  if (!/^[6-9][0-9]{9}$/.test(mobile10)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
  }
  const cleanName = input.displayName.trim().slice(0, 120);
  if (cleanName.length < 2) {
    throw new Error('Full name must be at least 2 characters.');
  }

  const cleanPin = (input.pin || '1234').replace(/\D/g, '');
  if (cleanPin.length < 4 || cleanPin.length > 6) {
    throw new Error('Please choose a 4-to-6 digit Test Login PIN.');
  }

  const testPinHash = await hashTestPin(mobile10, cleanPin);

  const demoUserRef = input.fixedDocId
    ? doc(db, 'demo_users', input.fixedDocId)
    : doc(collection(db, 'demo_users'));
  const registryRef = doc(db, 'demo_mobile_registry', `mob_${mobile10}`);
  const uniqueUserId = input.fixedUniqueUserId || makeUniqueDemoUserId(input.role, input.category);

  const profilePayload = {
    uniqueUserId,
    ownerUid: input.ownerUid,
    ...(input.slotLabel ? { slotLabel: input.slotLabel.slice(0, 60) } : {}),
    ...(input.deviceLabel ? { deviceLabel: input.deviceLabel.slice(0, 60) } : {}),
    testPinHash,
    role: input.role,
    category: input.category.trim().slice(0, 80) || (input.role === 'customer' ? 'Customer' : 'Electrician'),
    displayName: cleanName,
    mobile10,
    maskedMobile: maskIndianMobile(mobile10),
    testVerificationStatus: 'demo_test_verified' as const,
    availabilityStatus: input.availabilityStatus || 'available',
    state: (input.state.trim() || 'Maharashtra').slice(0, 80),
    district: (input.district.trim() || 'Chandrapur').slice(0, 80),
    cityOrVillage: (input.cityOrVillage.trim() || 'Chandrapur').slice(0, 100),
    lat: Number.isFinite(input.lat) ? input.lat : 19.9615,
    lng: Number.isFinite(input.lng) ? input.lng : 79.2961,
    accuracyMeters: Math.max(0, Math.min(200000, Math.round(input.accuracyMeters || 50))),
    locationPermissionStatus: input.locationPermissionStatus,
    locationSource: input.locationSource,
    ...(input.photoDocId ? { photoDocId: input.photoDocId } : {}),
    pushEnabled: Boolean(input.pushEnabled),
    isDemo: true as const,
    lastActiveAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const regSnap = await tx.get(registryRef);
      if (regSnap.exists()) {
        throw new Error(
          `DUPLICATE_MOBILE: Mobile number +91 ${mobile10} is already registered in Demo Mode. Duplicate mobile numbers are strictly blocked.`
        );
      }
      const existingUserSnap = await tx.get(demoUserRef);
      if (existingUserSnap.exists()) {
        throw new Error(`Demo user slot "${demoUserRef.id}" is already registered.`);
      }
      tx.set(registryRef, {
        mobile10,
        demoUserId: demoUserRef.id,
        ownerUid: input.ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.set(demoUserRef, profilePayload);
    });
    return { id: demoUserRef.id, ...profilePayload };
  } catch (err) {
    if (err instanceof Error && (err.message.includes('DUPLICATE_MOBILE') || err.message.includes('already registered'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.CREATE, `demo_users/${demoUserRef.id}`);
  }
}

export async function verifyTestAccountPinLogin(
  users: DemoUserProfile[],
  mobileRaw: string,
  pinRaw: string
): Promise<DemoUserProfile> {
  const mobile10 = sanitizeIndianMobile10(mobileRaw);
  if (!/^[6-9][0-9]{9}$/.test(mobile10)) {
    throw new Error('Enter a valid 10-digit registered test mobile number.');
  }
  const found = users.find((u) => u.mobile10 === mobile10);
  if (!found) {
    throw new Error(`No Demo Test account found for +91 ${mobile10}. Please register it first.`);
  }
  const expectedHash = found.testPinHash;
  if (expectedHash) {
    const providedHash = await hashTestPin(mobile10, pinRaw || '');
    if (providedHash !== expectedHash) {
      throw new Error('Incorrect Test PIN for this mobile number.');
    }
  }
  await touchDemoUserLastActive(found.id);
  return found;
}

export interface FiveTestPresetSpec {
  slotKey: string;
  slotLabel: string;
  deviceLabel: string;
  uniqueUserId: string;
  role: DemoUserRole;
  category: string;
  displayName: string;
  mobile10: string;
  latOffset: number;
  lngOffset: number;
  cityOrVillage: string;
}

export const FIVE_TEST_USER_PRESETS: FiveTestPresetSpec[] = [
  {
    slotKey: 'demo_w1_electrician',
    slotLabel: 'Worker A – Electrician',
    deviceLabel: 'Mobile 1',
    uniqueUserId: 'RS-DEMO-W1-ELEC',
    role: 'worker',
    category: 'Electrician',
    displayName: 'Worker A (Electrician)',
    mobile10: '9000000001',
    latOffset: 0.011,
    lngOffset: 0.009,
    cityOrVillage: 'Tukum, Chandrapur',
  },
  {
    slotKey: 'demo_w2_plumber',
    slotLabel: 'Worker B – Plumber',
    deviceLabel: 'Mobile 2',
    uniqueUserId: 'RS-DEMO-W2-PLUMB',
    role: 'worker',
    category: 'Plumber',
    displayName: 'Worker B (Plumber)',
    mobile10: '9000000002',
    latOffset: -0.013,
    lngOffset: 0.014,
    cityOrVillage: 'Ramnagar, Chandrapur',
  },
  {
    slotKey: 'demo_w3_carpenter',
    slotLabel: 'Worker C – Carpenter',
    deviceLabel: 'Mobile 3',
    uniqueUserId: 'RS-DEMO-W3-CARP',
    role: 'worker',
    category: 'Carpenter',
    displayName: 'Worker C (Carpenter)',
    mobile10: '9000000003',
    latOffset: 0.018,
    lngOffset: -0.012,
    cityOrVillage: 'Bazar Ward, Chandrapur',
  },
  {
    slotKey: 'demo_c1_customer_a',
    slotLabel: 'Customer A – Hirer',
    deviceLabel: 'Mobile 4',
    uniqueUserId: 'RS-DEMO-C1-CUSTA',
    role: 'customer',
    category: 'Customer',
    displayName: 'Customer A (Family Hirer 1)',
    mobile10: '9000000004',
    latOffset: 0,
    lngOffset: 0,
    cityOrVillage: 'Civil Lines, Chandrapur',
  },
  {
    slotKey: 'demo_c2_customer_b',
    slotLabel: 'Customer B – Hirer',
    deviceLabel: 'Mobile 5',
    uniqueUserId: 'RS-DEMO-C2-CUSTB',
    role: 'customer',
    category: 'Customer',
    displayName: 'Customer B (Family Hirer 2)',
    mobile10: '9000000005',
    latOffset: -0.008,
    lngOffset: -0.011,
    cityOrVillage: 'MIDC Colony, Chandrapur',
  },
];

export async function provisionFiveTestUsers(
  ownerUid: string,
  existingUsers: DemoUserProfile[],
  baseCoords?: {
    lat: number;
    lng: number;
    state?: string;
    district?: string;
    source?: DemoLocationSource;
    permission?: DemoLocationPermissionStatus;
  }
): Promise<{ createdCount: number; skippedCount: number }> {
  const baseLat = baseCoords?.lat ?? 19.9615;
  const baseLng = baseCoords?.lng ?? 79.2961;
  const state = baseCoords?.state || 'Maharashtra';
  const district = baseCoords?.district || 'Chandrapur';
  const source: DemoLocationSource = baseCoords?.source || 'manual_test';
  const permission: DemoLocationPermissionStatus = baseCoords?.permission || 'prompt';

  let createdCount = 0;
  let skippedCount = 0;

  for (const preset of FIVE_TEST_USER_PRESETS) {
    const alreadyExists = existingUsers.some(
      (u) =>
        u.mobile10 === preset.mobile10 ||
        u.uniqueUserId === preset.uniqueUserId ||
        u.slotLabel === preset.slotLabel
    );
    if (alreadyExists) {
      skippedCount += 1;
      continue;
    }

    const scopedDocId = `${ownerUid.slice(0, 12)}_${preset.slotKey}`;
    try {
      await registerDemoUser({
        ownerUid,
        role: preset.role,
        category: preset.category,
        displayName: preset.displayName,
        mobile: preset.mobile10,
        pin: '1234',
        slotLabel: preset.slotLabel,
        deviceLabel: preset.deviceLabel,
        state,
        district,
        cityOrVillage: preset.cityOrVillage,
        lat: Number((baseLat + preset.latOffset).toFixed(6)),
        lng: Number((baseLng + preset.lngOffset).toFixed(6)),
        accuracyMeters: source === 'gps' ? 25 : 250,
        locationPermissionStatus: permission,
        locationSource: source,
        availabilityStatus: 'available',
        fixedDocId: scopedDocId,
        fixedUniqueUserId: preset.uniqueUserId,
      });
      createdCount += 1;
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('DUPLICATE_MOBILE') || err.message.includes('already registered'))
      ) {
        skippedCount += 1;
      } else {
        throw err;
      }
    }
  }

  return { createdCount, skippedCount };
}

export async function deleteDemoUserAndReleaseMobile(user: DemoUserProfile): Promise<void> {
  const userRef = doc(db, 'demo_users', user.id);
  const regRef = doc(db, 'demo_mobile_registry', `mob_${user.mobile10}`);
  const batch = writeBatch(db);
  batch.delete(userRef);
  batch.delete(regRef);
  try {
    await batch.commit();
    if (user.photoDocId) {
      await deleteProfilePhotoRecord(user.photoDocId);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `demo_users/${user.id}`);
  }
}

export async function updateDemoUserPhoto(
  demoUserId: string,
  photoDocId: string | null
): Promise<void> {
  const path = `demo_users/${demoUserId}`;
  try {
    await updateDoc(doc(db, 'demo_users', demoUserId), {
      photoDocId: photoDocId ? photoDocId : deleteField(),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function touchDemoUserLastActive(demoUserId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'demo_users', demoUserId), {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking activity timestamp
  }
}

export async function updateDemoUserPushStatus(
  demoUserId: string,
  pushEnabled: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'demo_users', demoUserId), {
      pushEnabled,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking status sync
  }
}

export async function updateDemoUserAvailability(
  demoUserId: string,
  availabilityStatus: 'available' | 'busy' | 'offline'
): Promise<void> {
  const path = `demo_users/${demoUserId}`;
  try {
    await updateDoc(doc(db, 'demo_users', demoUserId), {
      availabilityStatus,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateDemoUserLocation(
  demoUserId: string,
  loc: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    permissionStatus: DemoLocationPermissionStatus;
    source: DemoLocationSource;
    state?: string;
    district?: string;
    cityOrVillage?: string;
  }
): Promise<void> {
  const path = `demo_users/${demoUserId}`;
  try {
    await updateDoc(doc(db, 'demo_users', demoUserId), {
      lat: Number(loc.lat.toFixed(6)),
      lng: Number(loc.lng.toFixed(6)),
      accuracyMeters: Math.max(0, Math.min(200000, Math.round(loc.accuracyMeters))),
      locationPermissionStatus: loc.permissionStatus,
      locationSource: loc.source,
      ...(loc.state?.trim() ? { state: loc.state.trim().slice(0, 80) } : {}),
      ...(loc.district?.trim() ? { district: loc.district.trim().slice(0, 80) } : {}),
      ...(loc.cityOrVillage?.trim() ? { cityOrVillage: loc.cityOrVillage.trim().slice(0, 100) } : {}),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface ChannelDispatchDiagnostic {
  inAppDelivered: boolean;
  browserNotificationStatus: 'delivered' | 'permission_default' | 'permission_denied' | 'unsupported';
  fcmPushStatus: 'sent' | 'failed' | 'skipped_no_token';
  fcmErrorReason?: string;
}

async function triggerLocalBrowserNotification(
  title: string,
  body: string
): Promise<ChannelDispatchDiagnostic['browserNotificationStatus']> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `rojgar-setu-demo-${Date.now()}`,
          });
          return 'delivered';
        }
      }
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    } catch {
      // Fallback when browser tab restricts direct Notification constructor inside iframe
    }
    return 'delivered';
  }
  if (Notification.permission === 'denied') {
    return 'permission_denied';
  }
  return 'permission_default';
}

export async function dispatchDemoNotificationToUser(input: {
  recipient: DemoUserProfile;
  senderOwnerUid: string;
  orderId: string;
  eventType: DemoNotificationRecord['eventType'];
  title: string;
  body: string;
  dedupeKeyOverride?: string;
}): Promise<ChannelDispatchDiagnostic> {
  const cleanDedupe = (
    input.dedupeKeyOverride ||
    `${input.orderId}_${input.recipient.id}_${input.eventType}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  ).slice(0, 128);

  const notifRef = doc(db, 'demo_notifications', cleanDedupe);
  const existing = await getDoc(notifRef).catch(() => null);
  if (existing && existing.exists()) {
    const data = existing.data() as DemoNotificationRecord;
    return {
      inAppDelivered: data.inAppDelivered,
      browserNotificationStatus: data.browserNotificationStatus,
      fcmPushStatus: data.fcmPushStatus,
      ...(data.fcmErrorReason ? { fcmErrorReason: data.fcmErrorReason } : {}),
    };
  }

  const browserStatus = await triggerLocalBrowserNotification(input.title, input.body);

  let fcmPushStatus: ChannelDispatchDiagnostic['fcmPushStatus'] = 'failed';
  let fcmErrorReason = '';

  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    fcmErrorReason =
      'VITE_FIREBASE_VAPID_KEY is not configured in environment variables (required for browser Web Push tokens).';
  } else {
    try {
      const apiRes = await callNotificationApi<{
        ok?: boolean;
        fcmPushStatus?: ChannelDispatchDiagnostic['fcmPushStatus'];
        reason?: string;
      }>('/api/notifications/demo-push', {
        orderId: input.orderId,
        recipientOwnerUid: input.recipient.ownerUid,
        recipientDemoUserId: input.recipient.id,
        recipientName: input.recipient.displayName,
        recipientRole: input.recipient.role,
        title: input.title,
        body: input.body,
        dedupeKey: cleanDedupe,
        eventType: input.eventType,
      });
      if (apiRes.data?.fcmPushStatus) {
        fcmPushStatus = apiRes.data.fcmPushStatus;
        fcmErrorReason = apiRes.data.reason || '';
      } else {
        fcmPushStatus = 'failed';
        fcmErrorReason = 'No valid response from /api/notifications/demo-push.';
      }
    } catch (err) {
      fcmPushStatus = 'failed';
      fcmErrorReason =
        err instanceof Error
          ? err.message
          : 'Unable to invoke server FCM push endpoint.';
    }
  }

  try {
    await setDoc(notifRef, {
      dedupeKey: cleanDedupe,
      recipientDemoUserId: input.recipient.id,
      recipientName: input.recipient.displayName.slice(0, 120),
      recipientRole: input.recipient.role,
      recipientOwnerUid: input.recipient.ownerUid,
      senderOwnerUid: input.senderOwnerUid,
      ownerUid: input.senderOwnerUid,
      orderId: input.orderId,
      eventType: input.eventType,
      title: input.title.slice(0, 160),
      body: input.body.slice(0, 500),
      inAppDelivered: true,
      browserNotificationStatus: browserStatus,
      fcmPushStatus,
      ...(fcmErrorReason ? { fcmErrorReason: fcmErrorReason.slice(0, 400) } : {}),
      read: false,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `demo_notifications/${cleanDedupe}`);
  }

  return {
    inAppDelivered: true,
    browserNotificationStatus: browserStatus,
    fcmPushStatus,
    ...(fcmErrorReason ? { fcmErrorReason } : {}),
  };
}

export async function markDemoNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'demo_notifications', notifId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking read mark
  }
}

export async function createDemoWorkOrder(params: {
  customer: DemoUserProfile;
  allDemoUsers: DemoUserProfile[];
  serviceCategory: string;
  title: string;
  description: string;
  offeredWage: number;
  wageUnit: WageUnit;
  requestLat: number;
  requestLng: number;
  cityOrVillage: string;
  district: string;
  state: string;
}): Promise<{
  orderId: string;
  matchedWorkers: Array<DemoUserProfile & { distanceKm: number }>;
  diagnostics: ChannelDispatchDiagnostic[];
}> {
  const matchedWorkers = params.allDemoUsers
    .filter(
      (u) =>
        u.role === 'worker' &&
        u.category.toLowerCase() === params.serviceCategory.toLowerCase() &&
        u.availabilityStatus === 'available'
    )
    .map((u) => ({
      ...u,
      distanceKm: calculateDistanceKm(params.requestLat, params.requestLng, u.lat, u.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);

  const matchedWorkerIds = matchedWorkers.map((w) => w.id);
  const matchedWorkerOwnerUids = Array.from(new Set(matchedWorkers.map((w) => w.ownerUid))).slice(0, 10);
  const path = 'demo_work_orders';

  let orderId = '';
  try {
    const ref = doc(collection(db, path));
    await setDoc(ref, {
      orderCode: makeOrderCode(),
      ownerUid: params.customer.ownerUid,
      customerDemoUserId: params.customer.id,
      customerName: params.customer.displayName.slice(0, 120),
      customerUniqueId: params.customer.uniqueUserId,
      serviceCategory: params.serviceCategory.slice(0, 80),
      title: params.title.trim().slice(0, 160),
      description: params.description.trim().slice(0, 1000),
      state: (params.state.trim() || params.customer.state).slice(0, 80),
      district: (params.district.trim() || params.customer.district).slice(0, 80),
      cityOrVillage: (params.cityOrVillage.trim() || params.customer.cityOrVillage).slice(0, 100),
      requestLat: params.requestLat,
      requestLng: params.requestLng,
      offeredWage: Math.max(0, Number(params.offeredWage) || 0),
      wageUnit: params.wageUnit,
      status: 'requested',
      matchedWorkerIds,
      matchedWorkerOwnerUids,
      rejectedWorkerIds: [],
      customerLocationSharing: false,
      workerLocationSharing: false,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    orderId = ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  const notifTitle = `[DEMO] New ${params.serviceCategory} Request`;
  const diagnostics: ChannelDispatchDiagnostic[] = [];

  for (const worker of matchedWorkers) {
    const distStr =
      worker.distanceKm < 1
        ? `${Math.round(worker.distanceKm * 1000)}m`
        : `${worker.distanceKm.toFixed(1)}km`;
    const notifBody = `${params.customer.displayName} needs a ${params.serviceCategory} at ${params.cityOrVillage} (${distStr} away · ₹${params.offeredWage}/${params.wageUnit}).`;
    const diag = await dispatchDemoNotificationToUser({
      recipient: worker,
      senderOwnerUid: params.customer.ownerUid,
      orderId,
      eventType: 'job_request',
      title: notifTitle,
      body: notifBody,
    });
    diagnostics.push(diag);
  }

  await touchDemoUserLastActive(params.customer.id);
  return { orderId, matchedWorkers, diagnostics };
}

export async function respondToDemoWorkOrder(params: {
  order: DemoWorkOrder;
  worker: DemoUserProfile;
  customer: DemoUserProfile | undefined;
  decision: 'accepted' | 'declined';
}): Promise<ChannelDispatchDiagnostic | null> {
  const { order, worker, customer, decision } = params;
  const orderRef = doc(db, 'demo_work_orders', order.id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) {
        throw new Error('Job order no longer exists.');
      }
      const current = snap.data() as DemoWorkOrder;
      if (current.status !== 'requested') {
        throw new Error(
          `DUPLICATE_ACCEPT_BLOCKED: Job is already "${current.status}" (assigned to ${
            current.acceptedWorkerName || 'another worker'
          }).`
        );
      }

      if (decision === 'accepted') {
        tx.update(orderRef, {
          status: 'accepted',
          acceptedWorkerId: worker.id,
          acceptedWorkerOwnerUid: worker.ownerUid,
          acceptedWorkerName: worker.displayName.slice(0, 120),
          acceptedWorkerUniqueId: worker.uniqueUserId,
          ...(worker.photoDocId ? { acceptedWorkerPhotoDocId: worker.photoDocId } : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        const nextRejected = Array.from(
          new Set([...(current.rejectedWorkerIds || []), worker.id])
        ).slice(0, 10);
        const allMatchedDeclined =
          current.matchedWorkerIds.length > 0 &&
          current.matchedWorkerIds.every((id) => nextRejected.includes(id));

        tx.update(orderRef, {
          rejectedWorkerIds: nextRejected,
          status: allMatchedDeclined ? 'declined' : current.status,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('DUPLICATE_ACCEPT_BLOCKED')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `demo_work_orders/${order.id}`);
  }

  await touchDemoUserLastActive(worker.id);

  if (!customer) return null;

  const title =
    decision === 'accepted'
      ? `[DEMO] ${worker.category} Accepted Your Job!`
      : `[DEMO] ${worker.category} Declined Request`;
  const body =
    decision === 'accepted'
      ? `${worker.displayName} (${worker.uniqueUserId}) accepted "${order.title}". Please confirm worker & authorize location sharing.`
      : `${worker.displayName} declined "${order.title}".`;

  return dispatchDemoNotificationToUser({
    recipient: customer,
    senderOwnerUid: worker.ownerUid,
    orderId: order.id,
    eventType: decision === 'accepted' ? 'job_accepted' : 'job_rejected',
    title,
    body,
    dedupeKeyOverride: `${order.id}_${worker.id}_${decision}`,
  });
}

export async function confirmDemoWorkOrder(params: {
  order: DemoWorkOrder;
  customer: DemoUserProfile;
  worker: DemoUserProfile | undefined;
}): Promise<ChannelDispatchDiagnostic | null> {
  const { order, customer, worker } = params;
  const orderRef = doc(db, 'demo_work_orders', order.id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error('Order not found.');
      const current = snap.data() as DemoWorkOrder;
      if (current.status !== 'accepted') {
        throw new Error(`Order must be in "accepted" stage before customer confirmation (current: ${current.status}).`);
      }
      tx.update(orderRef, {
        status: 'customer_confirmed',
        customerConfirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('accepted')) throw err;
    handleFirestoreError(err, OperationType.UPDATE, `demo_work_orders/${order.id}`);
  }

  await touchDemoUserLastActive(customer.id);
  if (customer.photoDocId && worker?.ownerUid) {
    await grantAcceptedCustomerPhoto({
      customerUid: customer.ownerUid,
      workerUid: worker.ownerUid,
      sourceType: 'demo_work_order',
      sourceId: order.id,
      customerPhotoDocId: customer.photoDocId,
    });
  }
  if (!worker) return null;

  return dispatchDemoNotificationToUser({
    recipient: worker,
    senderOwnerUid: customer.ownerUid,
    orderId: order.id,
    eventType: 'customer_confirmed',
    title: `[DEMO] Customer Confirmed: ${order.title}`,
    body: `${customer.displayName} confirmed you for "${order.title}". You can now start work & share live location.`,
  });
}

export async function startDemoWorkInProgress(params: {
  order: DemoWorkOrder;
  actor: DemoUserProfile;
  customer: DemoUserProfile | undefined;
}): Promise<void> {
  const { order, actor, customer } = params;
  const orderRef = doc(db, 'demo_work_orders', order.id);
  try {
    await updateDoc(orderRef, {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `demo_work_orders/${order.id}`);
  }

  await touchDemoUserLastActive(actor.id);
  if (customer && actor.role === 'worker') {
    await dispatchDemoNotificationToUser({
      recipient: customer,
      senderOwnerUid: actor.ownerUid,
      orderId: order.id,
      eventType: 'job_started',
      title: `[DEMO] Work Started: ${order.title}`,
      body: `${actor.displayName} marked work IN PROGRESS.`,
    });
  }
}

export async function completeDemoWorkOrder(params: {
  order: DemoWorkOrder;
  actor: DemoUserProfile;
  customer: DemoUserProfile | undefined;
  worker: DemoUserProfile | undefined;
  completionNotes?: string;
}): Promise<void> {
  const { order, actor, customer, worker, completionNotes } = params;
  if (!['accepted', 'customer_confirmed', 'in_progress'].includes(order.status)) {
    throw new Error(`Cannot mark complete from status "${order.status}".`);
  }

  const orderRef = doc(db, 'demo_work_orders', order.id);
  const batch = writeBatch(db);

  batch.update(orderRef, {
    status: 'completed',
    customerLocationSharing: false,
    workerLocationSharing: false,
    completedAt: serverTimestamp(),
    ...(completionNotes?.trim() ? { completionNotes: completionNotes.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });

  const customerShareRef = doc(db, 'demo_location_shares', `${order.id}_customer`);
  const workerShareRef = doc(db, 'demo_location_shares', `${order.id}_worker`);
  const [cSnap, wSnap] = await Promise.all([getDoc(customerShareRef), getDoc(workerShareRef)]);
  if (cSnap.exists()) {
    batch.update(customerShareRef, { sharingActive: false, updatedAt: serverTimestamp() });
  }
  if (wSnap.exists()) {
    batch.update(workerShareRef, { sharingActive: false, updatedAt: serverTimestamp() });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `demo_work_orders/${order.id}`);
  }

  const title = `[DEMO] Work Completed: ${order.title}`;
  const body = `Work marked completed by ${actor.displayName}. Live GPS sharing stopped automatically. Customer can now confirm Deal Closure.`;

  for (const recipient of [customer, worker].filter((x): x is DemoUserProfile => Boolean(x))) {
    await dispatchDemoNotificationToUser({
      recipient,
      senderOwnerUid: actor.ownerUid,
      orderId: order.id,
      eventType: 'job_completed',
      title,
      body,
    });
  }
}

export async function closeDemoDeal(params: {
  order: DemoWorkOrder;
  customer: DemoUserProfile;
  worker: DemoUserProfile | undefined;
  rating: number;
  completionNotes: string;
}): Promise<void> {
  const { order, customer, worker, rating, completionNotes } = params;
  if (!['completed', 'in_progress', 'customer_confirmed'].includes(order.status)) {
    throw new Error(`Deal cannot be closed from status "${order.status}".`);
  }

  const orderRef = doc(db, 'demo_work_orders', order.id);
  const batch = writeBatch(db);

  batch.update(orderRef, {
    status: 'closed',
    customerLocationSharing: false,
    workerLocationSharing: false,
    workerRating: Math.max(1, Math.min(5, Math.round(rating || 5))),
    completionNotes: (completionNotes.trim() || 'Deal closed cleanly after 5-mobile test verification.').slice(0, 500),
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const customerShareRef = doc(db, 'demo_location_shares', `${order.id}_customer`);
  const workerShareRef = doc(db, 'demo_location_shares', `${order.id}_worker`);
  const [cSnap, wSnap] = await Promise.all([getDoc(customerShareRef), getDoc(workerShareRef)]);
  if (cSnap.exists()) {
    batch.update(customerShareRef, { sharingActive: false, updatedAt: serverTimestamp() });
  }
  if (wSnap.exists()) {
    batch.update(workerShareRef, { sharingActive: false, updatedAt: serverTimestamp() });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `demo_work_orders/${order.id}`);
  }

  const title = `[DEMO] Deal Closed (${rating}/5 ★): ${order.title}`;
  const body = `Customer ${customer.displayName} closed the deal (${rating}/5 ★). Two-way GPS sharing permanently stopped for this job.`;

  for (const recipient of [customer, worker].filter((x): x is DemoUserProfile => Boolean(x))) {
    await dispatchDemoNotificationToUser({
      recipient,
      senderOwnerUid: customer.ownerUid,
      orderId: order.id,
      eventType: 'deal_closed',
      title,
      body,
    });
  }
}

export async function upsertDemoLocationShare(params: {
  order: DemoWorkOrder;
  participant: DemoUserProfile;
  participantRole: 'customer' | 'worker';
  lat: number;
  lng: number;
  accuracyMeters: number;
  sharingActive: boolean;
  permissionState: DemoLocationPermissionStatus;
  source: DemoShareSource;
}): Promise<void> {
  if (
    params.sharingActive &&
    !['accepted', 'customer_confirmed', 'in_progress'].includes(params.order.status)
  ) {
    throw new Error(
      'Privacy Lock: Location sharing can only be enabled after the worker accepts the job and before deal closure.'
    );
  }

  const shareId = `${params.order.id}_${params.participantRole}`;
  const shareRef = doc(db, 'demo_location_shares', shareId);
  const orderRef = doc(db, 'demo_work_orders', params.order.id);
  const orderField =
    params.participantRole === 'customer' ? 'customerLocationSharing' : 'workerLocationSharing';

  const authorizedOwnerUids = Array.from(
    new Set([
      params.order.ownerUid,
      ...(params.order.acceptedWorkerOwnerUid ? [params.order.acceptedWorkerOwnerUid] : []),
      params.participant.ownerUid,
    ])
  ).slice(0, 4);

  try {
    const existing = await getDoc(shareRef);
    const batch = writeBatch(db);
    if (existing.exists()) {
      batch.update(shareRef, {
        authorizedOwnerUids,
        lat: Number(params.lat.toFixed(6)),
        lng: Number(params.lng.toFixed(6)),
        accuracyMeters: Math.max(0, Math.min(200000, Math.round(params.accuracyMeters))),
        sharingActive: params.sharingActive,
        permissionState: params.permissionState,
        source: params.source,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(shareRef, {
        orderId: params.order.id,
        ownerUid: params.participant.ownerUid,
        authorizedOwnerUids,
        demoUserId: params.participant.id,
        participantRole: params.participantRole,
        participantName: params.participant.displayName.slice(0, 120),
        lat: Number(params.lat.toFixed(6)),
        lng: Number(params.lng.toFixed(6)),
        accuracyMeters: Math.max(0, Math.min(200000, Math.round(params.accuracyMeters))),
        sharingActive: params.sharingActive,
        permissionState: params.permissionState,
        source: params.source,
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(orderRef, {
      [orderField]: params.sharingActive,
      ...(params.sharingActive &&
      ['accepted', 'customer_confirmed'].includes(params.order.status)
        ? { status: 'in_progress' }
        : {}),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await updateDemoUserLocation(params.participant.id, {
      lat: params.lat,
      lng: params.lng,
      accuracyMeters: params.accuracyMeters,
      permissionStatus: params.permissionState,
      source: params.source === 'simulated_move' ? 'manual_test' : 'gps',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `demo_location_shares/${shareId}`);
  }
}

export async function stopDemoLocationShare(params: {
  order: DemoWorkOrder;
  participant: DemoUserProfile;
  participantRole: 'customer' | 'worker';
}): Promise<void> {
  await upsertDemoLocationShare({
    order: params.order,
    participant: params.participant,
    participantRole: params.participantRole,
    lat: params.participant.lat,
    lng: params.participant.lng,
    accuracyMeters: params.participant.accuracyMeters,
    sharingActive: false,
    permissionState: params.participant.locationPermissionStatus,
    source: 'gps_once',
  });
}

export function computeLiveDistanceLabel(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): { km: number; label: string } | null {
  if (!a || !b) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return null;
  }
  const km = calculateDistanceKm(a.lat, a.lng, b.lat, b.lng);
  if (km < 1) {
    return { km, label: `${Math.round(km * 1000)} m (${km.toFixed(2)} km)` };
  }
  return { km, label: `${km.toFixed(2)} km` };
}

export async function resetDemoTestingSandbox(
  users: DemoUserProfile[],
  orders: DemoWorkOrder[],
  shares: DemoLiveLocationShare[],
  notifications: DemoNotificationRecord[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const u of users) {
    batch.delete(doc(db, 'demo_users', u.id));
    batch.delete(doc(db, 'demo_mobile_registry', `mob_${u.mobile10}`));
  }
  for (const o of orders) {
    batch.delete(doc(db, 'demo_work_orders', o.id));
  }
  for (const s of shares) {
    batch.delete(doc(db, 'demo_location_shares', s.id));
  }
  for (const n of notifications) {
    batch.delete(doc(db, 'demo_notifications', n.id));
  }
  await batch.commit();
  await Promise.allSettled(
    users
      .map((u) => u.photoDocId)
      .filter((id): id is string => Boolean(id))
      .map((photoId) => deleteProfilePhotoRecord(photoId))
  );
}
