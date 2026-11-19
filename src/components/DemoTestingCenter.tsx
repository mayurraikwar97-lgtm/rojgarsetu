import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Hammer,
  KeyRound,
  LocateFixed,
  Lock,
  MapPin,
  MessageSquareOff,
  Navigation,
  Play,
  Power,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  StopCircle,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useLanguage } from '../i18n/LanguageContext';
import {
  closeDemoDeal,
  completeDemoWorkOrder,
  computeLiveDistanceLabel,
  confirmDemoWorkOrder,
  createDemoWorkOrder,
  deleteDemoUserAndReleaseMobile,
  FIVE_TEST_USER_PRESETS,
  formatTimeValue,
  isDemoModeEnvEnabled,
  markDemoNotificationRead,
  provisionFiveTestUsers,
  registerDemoUser,
  resetDemoTestingSandbox,
  respondToDemoWorkOrder,
  setDemoModeEnabled,
  startDemoWorkInProgress,
  stopDemoLocationShare,
  subscribeDemoLocationShares,
  subscribeDemoModeConfig,
  subscribeDemoNotifications,
  subscribeDemoUsers,
  subscribeDemoWorkOrders,
  touchDemoUserLastActive,
  updateDemoUserAvailability,
  updateDemoUserLocation,
  updateDemoUserPhoto,
  updateDemoUserPushStatus,
  upsertDemoLocationShare,
  verifyTestAccountPinLogin,
} from '../lib/demoService';
import { callNotificationApi } from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildAcceptedDemoOrderGrantId,
  buildDemoUserPhotoDocId,
  deleteProfilePhotoRecord,
  grantAcceptedCustomerPhoto,
  isCustomerPhotoVisibleForJobStatus,
  uploadProfilePhotoRecord,
} from '../lib/photoStorageService';
import { validateSecurityPin } from '../lib/pinAuth';
import type {
  DemoLiveLocationShare,
  DemoLocationPermissionStatus,
  DemoModeConfig,
  DemoNotificationRecord,
  DemoUserProfile,
  DemoUserRole,
  DemoWorkOrder,
  PageRoute,
  WageUnit,
} from '../types/domain';
import { NotificationOptInButton } from './NotificationOptInButton';
import { ProfilePhotoUploader, type SelectedProfilePhoto } from './ProfilePhotoUploader';
import { SecureAvatar } from './SecureAvatar';

interface DemoTestingCenterProps {
  onNavigate: (route: PageRoute) => void;
}

const DEMO_CATEGORIES = ['Electrician', 'Plumber', 'Carpenter', 'Driver'];

const STATUS_BADGE_MAP: Record<DemoWorkOrder['status'], { label: string; cls: string }> = {
  requested: { label: 'NEW REQUEST', cls: 'bg-amber-100 text-[#C25E00]' },
  accepted: { label: 'WORKER ACCEPTED', cls: 'bg-emerald-100 text-[#15803D]' },
  customer_confirmed: { label: 'CUSTOMER CONFIRMED', cls: 'bg-blue-100 text-[#0B3B75]' },
  in_progress: { label: 'WORK IN PROGRESS', cls: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'WORK COMPLETED', cls: 'bg-teal-100 text-teal-800' },
  closed: { label: 'DEAL CLOSED', cls: 'bg-[#15803D] text-white' },
  declined: { label: 'DECLINED', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'CANCELLED', cls: 'bg-slate-200 text-slate-700' },
};

export const DemoTestingCenter: React.FC<DemoTestingCenterProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const { user, isAdmin, signInWithGoogle } = useAuth();

  const [config, setConfig] = useState<DemoModeConfig | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUserProfile[]>([]);
  const [workOrders, setWorkOrders] = useState<DemoWorkOrder[]>([]);
  const [locationShares, setLocationShares] = useState<DemoLiveLocationShare[]>([]);
  const [notifications, setNotifications] = useState<DemoNotificationRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'workspace' | 'registration'>('workspace');
  const [activeDemoUserId, setActiveDemoUserId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  // Mobile + Test PIN Login state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);

  // Registration Form state
  const [regRole, setRegRole] = useState<DemoUserRole>('worker');
  const [regCategory, setRegCategory] = useState<string>('Electrician');
  const [regSlotLabel, setRegSlotLabel] = useState<string>('Worker A – Electrician');
  const [regDeviceLabel, setRegDeviceLabel] = useState<string>('Mobile 1');
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPin, setRegPin] = useState('1234');
  const [regConfirmPin, setRegConfirmPin] = useState('1234');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regSelectedPhoto, setRegSelectedPhoto] = useState<SelectedProfilePhoto | null>(null);
  const [photoUpdating, setPhotoUpdating] = useState(false);
  const [regState, setRegState] = useState('Maharashtra');
  const [regDistrict, setRegDistrict] = useState('Chandrapur');
  const [regCity, setRegCity] = useState('Chandrapur');
  const [regLat, setRegLat] = useState<number>(19.9615);
  const [regLng, setRegLng] = useState<number>(79.2961);
  const [regAccuracy, setRegAccuracy] = useState<number>(50);
  const [regPermission, setRegPermission] = useState<DemoLocationPermissionStatus>('prompt');
  const [regSource, setRegSource] = useState<'gps' | 'search' | 'manual_test'>('manual_test');
  const [regTestVerifyAck, setRegTestVerifyAck] = useState(true);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const syncedPhotoGrantsRef = useRef<Set<string>>(new Set());

  // Customer Job Request Form state
  const [jobCategory, setJobCategory] = useState('Electrician');
  const [jobTitle, setJobTitle] = useState('Urgent Electrician Wiring Repair (TEST)');
  const [jobDesc, setJobDesc] = useState('Main switchboard inspection and socket repair needed urgently.');
  const [jobWage, setJobWage] = useState<number>(600);
  const [jobWageUnit, setJobWageUnit] = useState<WageUnit>('daily');

  // Completion / Deal Closure modal state
  const [closingOrderId, setClosingOrderId] = useState<string>('');
  const [completionRating, setCompletionRating] = useState<number>(5);
  const [completionNotes, setCompletionNotes] = useState<string>(
    'Work verified across devices and deal closed cleanly in Test Mode.'
  );

  // Browser notification & Push diagnostics
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [pushConfig, setPushConfig] = useState<{
    hasVapidKey: boolean;
    hasAdminMessaging: boolean;
    httpsActive: boolean;
    missingSetupItems: string[];
  } | null>(null);

  // Live watchPosition tracking ref
  const watchRef = useRef<{ watchId: number; orderId: string; role: 'customer' | 'worker' } | null>(null);

  const envEnabled = isDemoModeEnvEnabled();
  const firestoreEnabled = config?.enabled ?? false;
  const demoGateOpen = envEnabled && (firestoreEnabled || isAdmin);

  useEffect(() => {
    const u0 = subscribeDemoModeConfig(setConfig);
    return () => u0();
  }, []);

  useEffect(() => {
    if (!user?.emailVerified) return;
    const u1 = subscribeDemoUsers(user.uid, isAdmin, setDemoUsers);
    const u2 = subscribeDemoWorkOrders(user.uid, isAdmin, setWorkOrders);
    const u3 = subscribeDemoLocationShares(user.uid, isAdmin, setLocationShares);
    const u4 = subscribeDemoNotifications(user.uid, isAdmin, setNotifications);
    void callNotificationApi<{
      hasVapidKey?: boolean;
      hasAdminMessaging?: boolean;
      httpsActive?: boolean;
      missingSetupItems?: string[];
    }>('/api/notifications/config-status')
      .then((res) => {
        if (res.data) {
          setPushConfig({
            hasVapidKey: Boolean(res.data.hasVapidKey),
            hasAdminMessaging: Boolean(res.data.hasAdminMessaging),
            httpsActive: Boolean(res.data.httpsActive),
            missingSetupItems: res.data.missingSetupItems || [],
          });
        }
      })
      .catch(() => undefined);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [user?.uid, user?.emailVerified, isAdmin]);

  // Prefer selecting an account owned by the current phone/Google UID first
  useEffect(() => {
    if (!user) return;
    if (demoUsers.length > 0 && !demoUsers.some((u) => u.id === activeDemoUserId)) {
      const ownAccount = demoUsers.find((u) => u.ownerUid === user.uid);
      const cust = demoUsers.find((u) => u.role === 'customer');
      setActiveDemoUserId(ownAccount?.id || cust?.id || demoUsers[0].id);
    }
  }, [demoUsers, activeDemoUserId, user]);

  const stopLocalWatch = () => {
    if (watchRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current.watchId);
      watchRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLocalWatch();
    };
  }, []);

  const activeUser = useMemo(
    () => demoUsers.find((u) => u.id === activeDemoUserId) || null,
    [demoUsers, activeDemoUserId]
  );

  const activeUserCanAct = Boolean(
    activeUser && user && (activeUser.ownerUid === user.uid || isAdmin)
  );

  const activeUserNotifications = useMemo(() => {
    if (!activeUser) return [];
    return notifications.filter((n) => n.recipientDemoUserId === activeUser.id);
  }, [notifications, activeUser]);

  const activeUserOrders = useMemo(() => {
    if (!activeUser) return [];
    if (activeUser.role === 'customer') {
      return workOrders.filter((o) => o.customerDemoUserId === activeUser.id);
    }
    return workOrders.filter(
      (o) =>
        o.acceptedWorkerId === activeUser.id ||
        o.matchedWorkerIds.includes(activeUser.id)
    );
  }, [workOrders, activeUser]);

  // Automatically grant accepted worker access to Customer's private profile photo once an order reaches accepted+ stage
  useEffect(() => {
    if (!activeUser || activeUser.role !== 'customer' || !activeUser.photoDocId || !activeUserCanAct) {
      return;
    }
    for (const order of activeUserOrders) {
      if (
        isCustomerPhotoVisibleForJobStatus(order.status) &&
        order.acceptedWorkerOwnerUid
      ) {
        const key = `${order.id}:${activeUser.photoDocId}:${order.acceptedWorkerOwnerUid}`;
        if (syncedPhotoGrantsRef.current.has(key)) continue;
        syncedPhotoGrantsRef.current.add(key);
        void grantAcceptedCustomerPhoto({
          customerUid: activeUser.ownerUid,
          workerUid: order.acceptedWorkerOwnerUid,
          sourceType: 'demo_work_order',
          sourceId: order.id,
          customerPhotoDocId: activeUser.photoDocId,
        }).catch(() => {
          syncedPhotoGrantsRef.current.delete(key);
        });
      }
    }
  }, [activeUser, activeUserCanAct, activeUserOrders]);

  // Tests 1, 2, 3 live progress summary
  const scenarioProgress = useMemo(() => {
    const specs = [
      { id: 'TEST 1', category: 'Electrician', label: 'Customer A → Electrician (Worker A · Mobile 1)' },
      { id: 'TEST 2', category: 'Plumber', label: 'Customer B → Plumber (Worker B · Mobile 2)' },
      { id: 'TEST 3', category: 'Carpenter', label: 'Customer A/B → Carpenter (Worker C · Mobile 3)' },
    ];
    return specs.map((spec) => {
      const worker = demoUsers.find(
        (u) => u.role === 'worker' && u.category.toLowerCase() === spec.category.toLowerCase()
      );
      const latestOrder = workOrders.find(
        (o) => o.serviceCategory.toLowerCase() === spec.category.toLowerCase()
      );
      const orderNotifs = latestOrder
        ? notifications.filter((n) => n.orderId === latestOrder.id)
        : [];
      const anyNotified = orderNotifs.length > 0;
      const pushSent = orderNotifs.some((n) => n.fcmPushStatus === 'sent');
      const gpsShared = latestOrder
        ? locationShares.some((s) => s.orderId === latestOrder.id)
        : false;
      const closed = latestOrder?.status === 'closed';
      return {
        ...spec,
        workerRegistered: Boolean(worker),
        order: latestOrder || null,
        anyNotified,
        pushSent,
        gpsShared,
        closed,
      };
    });
  }, [demoUsers, workOrders, notifications, locationShares]);

  const handleSwitchDemoUser = (u: DemoUserProfile) => {
    stopLocalWatch();
    setActiveDemoUserId(u.id);
    setBanner({
      kind: 'info',
      text: `Active Test Profile: ${u.displayName} (${u.uniqueUserId}) — ${u.deviceLabel || 'Test Device'} · Role: ${u.role.toUpperCase()} · Category: ${u.category}`,
    });
    if (user && (u.ownerUid === user.uid || isAdmin)) {
      void touchDemoUserLastActive(u.id);
    }
  };

  const handlePinLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const loggedIn = await verifyTestAccountPinLogin(demoUsers, loginMobile, loginPin);
      stopLocalWatch();
      setActiveDemoUserId(loggedIn.id);
      setActiveTab('workspace');
      setBanner({
        kind: 'ok',
        text: `Test Login Verified for +91 ${loggedIn.mobile10}: ${loggedIn.displayName} (${loggedIn.category}).`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Test PIN login failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEnableAndProvision = async () => {
    if (!user) return;
    setBusy(true);
    setBanner(null);
    try {
      if (isAdmin && !firestoreEnabled) {
        await setDemoModeEnabled(user.uid, true);
      }
      const res = await provisionFiveTestUsers(user.uid, demoUsers);
      setBanner({
        kind: 'ok',
        text: `5 Family Test Accounts Ready in Firestore! (${res.createdCount} created, ${res.skippedCount} already existed). Default Test PIN: 1234.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to provision 5 test users.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApplyPresetSlot = (slotKey: string) => {
    const preset = FIVE_TEST_USER_PRESETS.find((p) => p.slotKey === slotKey);
    if (!preset) return;
    setRegRole(preset.role);
    setRegCategory(preset.category);
    setRegSlotLabel(preset.slotLabel);
    setRegDeviceLabel(preset.deviceLabel);
    setRegName(preset.displayName);
    setRegMobile(preset.mobile10);
    setRegPin('1234');
    setRegConfirmPin('1234');
    setRegSelectedPhoto(null);
    setRegCity(preset.cityOrVillage);
    setRegLat(Number((19.9615 + preset.latOffset).toFixed(6)));
    setRegLng(Number((79.2961 + preset.lngOffset).toFixed(6)));
  };

  const handleDetectGpsForForm = async () => {
    setGpsDetecting(true);
    setBanner(null);
    try {
      const loc = await detectBestGpsLocation(lang);
      setRegLat(loc.lat);
      setRegLng(loc.lng);
      setRegAccuracy(loc.accuracyMeters || 35);
      setRegState(loc.state || regState);
      setRegDistrict(loc.district || regDistrict);
      setRegCity(loc.cityOrVillage || loc.district || regCity);
      setRegPermission('granted');
      setRegSource('gps');
      setBanner({
        kind: 'ok',
        text: `GPS captured (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}, ±${loc.accuracyMeters || 35}m): ${loc.formattedAddress}`,
      });
    } catch {
      setRegPermission('denied');
      setRegSource('manual_test');
      setBanner({
        kind: 'err',
        text: 'Browser GPS permission denied or unavailable. District coordinates remain ready as fallback.',
      });
    } finally {
      setGpsDetecting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (demoUsers.length >= 5) {
      setBanner({
        kind: 'err',
        text: 'Maximum 5 test accounts allowed in Temporary Test Mode. Delete or reset a test slot to register another number.',
      });
      return;
    }
    const pinCheck = validateSecurityPin(regPin, regConfirmPin);
    if (!pinCheck.ok) {
      setBanner({
        kind: 'err',
        text:
          pinCheck.code === 'PIN_MISMATCH'
            ? 'Security PIN and Confirm PIN do not match.'
            : 'Please enter a valid 4-to-6 digit Security PIN.',
      });
      return;
    }
    if (!regTestVerifyAck) {
      setBanner({ kind: 'err', text: 'Please acknowledge test-only demo verification.' });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const created = await registerDemoUser({
        ownerUid: user.uid,
        role: regRole,
        category: regRole === 'customer' ? 'Customer' : regCategory,
        displayName: regName,
        mobile: regMobile,
        pin: pinCheck.cleanPin,
        slotLabel: regSlotLabel,
        deviceLabel: regDeviceLabel,
        state: regState,
        district: regDistrict,
        cityOrVillage: regCity,
        lat: regLat,
        lng: regLng,
        accuracyMeters: regAccuracy,
        locationPermissionStatus: regPermission,
        locationSource: regSource,
      });

      let photoMsg = '';
      if (regSelectedPhoto) {
        try {
          const photoDocId = buildDemoUserPhotoDocId(created.id);
          await uploadProfilePhotoRecord({
            photoId: photoDocId,
            ownerUid: user.uid,
            subjectId: created.id,
            role: created.role === 'customer' ? 'customer' : 'worker',
            mimeType: regSelectedPhoto.mimeType,
            sizeBytes: regSelectedPhoto.sizeBytes,
            photoData: regSelectedPhoto.photoData,
          });
          await updateDemoUserPhoto(created.id, photoDocId);
          photoMsg = ' Profile photo saved securely.';
        } catch (photoErr) {
          photoMsg =
            photoErr instanceof Error
              ? ` (Account created, but photo upload failed: ${photoErr.message})`
              : ' (Account created, but photo upload failed)';
        }
      }

      setActiveDemoUserId(created.id);
      setRegName('');
      setRegMobile('');
      setRegSelectedPhoto(null);
      setActiveTab('workspace');
      setBanner({
        kind: 'ok',
        text: `Registered [TEST MODE] ${created.role.toUpperCase()} "${created.displayName}" (${created.uniqueUserId}) on ${created.deviceLabel || 'this device'}! Mobile +91 ${created.mobile10} locked against duplicates.${photoMsg}`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Demo user registration failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleActiveUserPhotoSelect = async (photo: SelectedProfilePhoto) => {
    if (!activeUser || !user || !activeUserCanAct) return;
    setPhotoUpdating(true);
    setBanner(null);
    try {
      const photoDocId = buildDemoUserPhotoDocId(activeUser.id);
      await uploadProfilePhotoRecord({
        photoId: photoDocId,
        ownerUid: activeUser.ownerUid,
        subjectId: activeUser.id,
        role: activeUser.role === 'customer' ? 'customer' : 'worker',
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        photoData: photo.photoData,
      });
      await updateDemoUserPhoto(activeUser.id, photoDocId);
      setBanner({
        kind: 'ok',
        text:
          activeUser.role === 'customer'
            ? 'Customer profile photo updated! Strictly visible ONLY to you, Admin, and Workers who accept your job.'
            : 'Worker profile photo updated securely!',
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to update profile photo.',
      });
    } finally {
      setPhotoUpdating(false);
    }
  };

  const handleActiveUserPhotoRemove = async () => {
    if (!activeUser || !user || !activeUserCanAct) return;
    setPhotoUpdating(true);
    setBanner(null);
    try {
      if (activeUser.photoDocId) {
        await deleteProfilePhotoRecord(activeUser.photoDocId);
      }
      await updateDemoUserPhoto(activeUser.id, null);
      setBanner({
        kind: 'info',
        text: `Removed profile photo for ${activeUser.displayName}.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to remove profile photo.',
      });
    } finally {
      setPhotoUpdating(false);
    }
  };

  const handleUpdateActiveUserGps = async () => {
    if (!activeUser) return;
    setGpsDetecting(true);
    setBanner(null);
    try {
      const loc = await detectBestGpsLocation(lang);
      await updateDemoUserLocation(activeUser.id, {
        lat: loc.lat,
        lng: loc.lng,
        accuracyMeters: loc.accuracyMeters || 35,
        permissionStatus: 'granted',
        source: 'gps',
        state: loc.state || activeUser.state,
        district: loc.district || activeUser.district,
        cityOrVillage: loc.cityOrVillage || activeUser.cityOrVillage,
      });
      setBanner({
        kind: 'ok',
        text: `Updated GPS location for ${activeUser.displayName}: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${loc.accuracyMeters || 35}m).`,
      });
    } catch {
      await updateDemoUserLocation(activeUser.id, {
        lat: activeUser.lat,
        lng: activeUser.lng,
        accuracyMeters: activeUser.accuracyMeters,
        permissionStatus: 'denied',
        source: 'manual_test',
      });
      setBanner({
        kind: 'err',
        text: 'GPS permission denied/unavailable in browser. Permission status recorded as DENIED in Firestore.',
      });
    } finally {
      setGpsDetecting(false);
    }
  };

  const handleSubmitJobRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser || activeUser.role !== 'customer') return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await createDemoWorkOrder({
        customer: activeUser,
        allDemoUsers: demoUsers,
        serviceCategory: jobCategory,
        title: jobTitle,
        description: jobDesc,
        offeredWage: jobWage,
        wageUnit: jobWageUnit,
        requestLat: activeUser.lat,
        requestLng: activeUser.lng,
        cityOrVillage: activeUser.cityOrVillage,
        district: activeUser.district,
        state: activeUser.state,
      });
      const firstDiag = res.diagnostics[0];
      setBanner({
        kind: res.matchedWorkers.length > 0 ? 'ok' : 'info',
        text:
          res.matchedWorkers.length > 0
            ? `${jobCategory} job submitted! Matched ONLY ${res.matchedWorkers.length} available ${jobCategory}(s): ${res.matchedWorkers
                .map((w) => `${w.displayName} (${w.distanceKm.toFixed(2)} km)`)
                .join(', ')}. Unrelated worker categories were NOT notified. Notifications: In-App OK · Browser: ${firstDiag?.browserNotificationStatus || 'n/a'} · Push: ${firstDiag?.fcmPushStatus || 'n/a'}.`
            : `Job saved, but 0 available "${jobCategory}" workers matched right now. Ensure the ${jobCategory} account is registered and set to "Available for Jobs".`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit job request.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleWorkerDecision = async (order: DemoWorkOrder, decision: 'accepted' | 'declined') => {
    if (!activeUser || activeUser.role !== 'worker') return;
    setBusy(true);
    setBanner(null);
    try {
      const customer = demoUsers.find((u) => u.id === order.customerDemoUserId);
      const diag = await respondToDemoWorkOrder({
        order,
        worker: activeUser,
        customer,
        decision,
      });
      setBanner({
        kind: 'ok',
        text:
          decision === 'accepted'
            ? `Accepted "${order.title}"! Two-way authorized live location sharing is now UNLOCKED. Customer notified (In-App: OK · Browser: ${diag?.browserNotificationStatus || 'n/a'} · Push: ${diag?.fcmPushStatus || 'n/a'}).`
            : `Rejected "${order.title}". Customer notified.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to update decision.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmWorker = async (order: DemoWorkOrder) => {
    if (!activeUser || activeUser.role !== 'customer') return;
    setBusy(true);
    setBanner(null);
    try {
      const worker = demoUsers.find((u) => u.id === order.acceptedWorkerId);
      const diag = await confirmDemoWorkOrder({
        order,
        customer: activeUser,
        worker,
      });
      setBanner({
        kind: 'ok',
        text: `Customer Confirmed ${order.acceptedWorkerName || 'Worker'}! Worker notified (In-App: OK · Push: ${diag?.fcmPushStatus || 'n/a'}).`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to confirm worker.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStartWorkInProgress = async (order: DemoWorkOrder) => {
    if (!activeUser) return;
    setBusy(true);
    setBanner(null);
    try {
      const customer = demoUsers.find((u) => u.id === order.customerDemoUserId);
      await startDemoWorkInProgress({
        order,
        actor: activeUser,
        customer,
      });
      setBanner({
        kind: 'ok',
        text: `Order "${order.title}" is now WORK IN PROGRESS. Customer notified.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to start work stage.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStartLiveLocationShare = async (
    order: DemoWorkOrder,
    role: 'customer' | 'worker'
  ) => {
    if (!activeUser) return;
    if (!['accepted', 'customer_confirmed', 'in_progress'].includes(order.status)) {
      setBanner({
        kind: 'err',
        text: 'Privacy Lock: Location sharing is blocked before worker acceptance or after completion/deal closure.',
      });
      return;
    }

    stopLocalWatch();
    setBusy(true);
    setBanner(null);

    try {
      let lat = activeUser.lat;
      let lng = activeUser.lng;
      let accuracy = activeUser.accuracyMeters || 35;
      let perm: DemoLocationPermissionStatus = 'granted';
      const src: 'gps_once' | 'gps_watch' | 'simulated_move' = 'gps_once';

      try {
        const res = await detectBestGpsLocation(lang);
        lat = res.lat;
        lng = res.lng;
        accuracy = res.accuracyMeters || 25;
      } catch {
        perm = activeUser.locationPermissionStatus === 'denied' ? 'denied' : 'manual_fallback';
      }

      await upsertDemoLocationShare({
        order,
        participant: activeUser,
        participantRole: role,
        lat,
        lng,
        accuracyMeters: accuracy,
        sharingActive: true,
        permissionState: perm,
        source: src,
      });

      if (typeof navigator !== 'undefined' && navigator.geolocation && perm === 'granted') {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            void upsertDemoLocationShare({
              order,
              participant: activeUser,
              participantRole: role,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracyMeters: Math.round(pos.coords.accuracy || 25),
              sharingActive: true,
              permissionState: 'granted',
              source: 'gps_watch',
            });
          },
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
        watchRef.current = { watchId, orderId: order.id, role };
      }

      setBanner({
        kind: 'ok',
        text: `Live location sharing STARTED for ${activeUser.displayName} (${role.toUpperCase()}). Coordinates & live distance visible ONLY to authorized job partner.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to start live location sharing.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateMove = async (
    order: DemoWorkOrder,
    role: 'customer' | 'worker',
    currentShare?: DemoLiveLocationShare
  ) => {
    if (!activeUser) return;
    setBusy(true);
    try {
      const baseLat = currentShare?.lat ?? activeUser.lat;
      const baseLng = currentShare?.lng ?? activeUser.lng;
      const nextLat = Number((baseLat + 0.0022).toFixed(6));
      const nextLng = Number((baseLng + 0.0018).toFixed(6));
      await upsertDemoLocationShare({
        order,
        participant: activeUser,
        participantRole: role,
        lat: nextLat,
        lng: nextLng,
        accuracyMeters: 15,
        sharingActive: true,
        permissionState: activeUser.locationPermissionStatus,
        source: 'simulated_move',
      });
      setBanner({
        kind: 'ok',
        text: `Simulated live movement saved (${nextLat}, ${nextLng}). Distance recalculated live!`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to update movement coordinates.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStopLiveShare = async (order: DemoWorkOrder, role: 'customer' | 'worker') => {
    if (!activeUser) return;
    stopLocalWatch();
    setBusy(true);
    try {
      await stopDemoLocationShare({
        order,
        participant: activeUser,
        participantRole: role,
      });
      setBanner({
        kind: 'info',
        text: `Stopped sharing location for ${activeUser.displayName}. Coordinates hidden from job partner.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkCompleted = async (order: DemoWorkOrder) => {
    if (!activeUser) return;
    setBusy(true);
    setBanner(null);
    try {
      stopLocalWatch();
      const customer = demoUsers.find((u) => u.id === order.customerDemoUserId);
      const worker = demoUsers.find((u) => u.id === order.acceptedWorkerId);
      await completeDemoWorkOrder({
        order,
        actor: activeUser,
        customer,
        worker,
      });
      setBanner({
        kind: 'ok',
        text: `Work marked COMPLETED for "${order.title}". Live location sharing stopped automatically. Customer can now confirm Deal Closure.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to mark work completed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCloseDeal = async (order: DemoWorkOrder) => {
    if (!activeUser || activeUser.role !== 'customer') return;
    setBusy(true);
    setBanner(null);
    try {
      stopLocalWatch();
      const worker = demoUsers.find((u) => u.id === order.acceptedWorkerId);
      await closeDemoDeal({
        order,
        customer: activeUser,
        worker,
        rating: completionRating,
        completionNotes,
      });
      setClosingOrderId('');
      setBanner({
        kind: 'ok',
        text: `DEAL CLOSED for "${order.title}" (${completionRating}/5 ★). Two-way GPS sharing permanently ended & final record saved to Firestore.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to close deal.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPerm('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      new Notification('ROJGAR SETU Test Alerts Enabled', {
        body: 'Browser notifications are active for 5-Mobile Pre-Launch Test Mode.',
        icon: '/pwa-192x192.png',
      });
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border-2 border-[#E06D1B] rounded-lg p-8 text-center space-y-4">
          <Lock className="w-10 h-10 text-[#0B3B75] mx-auto" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-100 text-[#C25E00] text-xs font-bold uppercase">
            <FlaskConical className="w-3.5 h-3.5" />
            TEST MODE · 5-MOBILE PRE-LAUNCH SANDBOX
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">
            ROJGAR SETU — 5-Mobile End-to-End Family Testing
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Sign in on each family phone with Google to unlock the OTP-free Test Registration &amp; Job Matching sandbox (Worker A Electrician, Worker B Plumber, Worker C Carpenter, Customer A, Customer B). Normal production OTP security remains untouched.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-6 py-3 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 cursor-pointer"
          >
            Sign In with Google to Enter Test Mode
          </button>
        </div>
      </div>
    );
  }

  if (!demoGateOpen) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#15803D] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">
            Temporary Test Mode is Disabled
          </h1>
          <p className="text-sm text-slate-600">
            {!envEnabled
              ? 'Demo/Test Mode is turned OFF via VITE_DEMO_MODE_ENABLED=false for public launch.'
              : 'Demo/Test Mode is currently turned OFF by the platform administrator.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Temporary Test Mode Banner */}
      <div className="bg-[#072A54] text-white border-2 border-[#E06D1B] rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#E06D1B] text-white text-[11px] font-bold uppercase tracking-wider">
            <FlaskConical className="w-3.5 h-3.5" />
            TEST MODE ACTIVE · OTP-FREE 5-MOBILE PRE-LAUNCH SANDBOX
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            ROJGAR SETU — 5 Family Mobile End-to-End Testing Console
          </h1>
          <p className="text-xs text-blue-100 max-w-3xl">
            Register up to 5 real accounts across 5 phones (Worker A Electrician, Worker B Plumber, Worker C Carpenter, Customer A, Customer B) with Mobile + Test PIN login, category-scoped notifications, 7-stage deal closing, and two-way authorized GPS tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {demoUsers.length < 5 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnableAndProvision}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Create 5 Preset Test Users
            </button>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await setDemoModeEnabled(user.uid, !firestoreEnabled);
                  setBusy(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded text-xs font-bold cursor-pointer ${
                  firestoreEnabled
                    ? 'bg-red-700 text-white hover:bg-red-800'
                    : 'bg-[#15803D] text-white hover:bg-emerald-800'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {firestoreEnabled ? 'Turn Test Mode OFF' : 'Turn Test Mode ON'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="px-3.5 py-2.5 rounded border border-blue-400 text-white text-xs font-semibold hover:bg-blue-900 cursor-pointer"
              >
                Admin Oversight →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Honest SMS & Admin Warning */}
      <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
        <div className="flex items-start gap-2">
          <MessageSquareOff className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
          <span>
            <strong>SMS Notice (Honest Pre-Launch Status):</strong> No paid SMS OTP/Alert gateway is purchased yet. SMS OTP is temporarily bypassed strictly for these 5 Test Mode accounts, while In-App, Browser Alerts, and PWA Web Push handle live notifications.
          </span>
        </div>
        {!firestoreEnabled && isAdmin && (
          <span className="font-bold text-red-700 shrink-0">
            Admin Note: Firestore demo_config is currently OFF for non-admins.
          </span>
        )}
      </div>

      {banner && (
        <div
          role="status"
          className={`p-3.5 rounded-md border text-xs sm:text-sm font-semibold flex items-start gap-2 ${
            banner.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : banner.kind === 'err'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-[#0B3B75]'
          }`}
        >
          {banner.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#15803D]" />
          ) : banner.kind === 'err' ? (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          ) : (
            <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#0B3B75]" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Tests 1, 2, 3 Live Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-[#0B3B75] flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#E06D1B]" />
            <span>Tests 1, 2 &amp; 3 — Real Category-Matched Workflow Tracker</span>
          </h2>
          <span className="text-[11px] font-mono-tabular text-slate-500">
            3 Workers (Electrician, Plumber, Carpenter) · 2 Customers · 5 Max Accounts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {scenarioProgress.map((s) => (
            <div key={s.id} className="border border-slate-200 rounded-md p-3 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-tabular font-bold text-[#E06D1B]">{s.id}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    s.closed
                      ? 'bg-[#15803D] text-white'
                      : s.order
                      ? 'bg-blue-100 text-[#0B3B75]'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.order ? s.order.status : 'WAITING'}
                </span>
              </div>
              <div className="font-bold text-[#0B3B75]">{s.label}</div>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono-tabular pt-1">
                <span className={`px-1.5 py-0.5 rounded ${s.workerRegistered ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                  Worker {s.workerRegistered ? 'OK' : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${s.order ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                  Order {s.order ? 'OK' : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${s.anyNotified ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                  In-App {s.anyNotified ? 'OK' : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${s.gpsShared ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                  GPS {s.gpsShared ? 'OK' : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${s.closed ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                  Closed {s.closed ? 'OK' : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5-User Session Switcher + Mobile PIN Test Login */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-[#0B3B75] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#E06D1B]" />
            <span>Active 5-Mobile Test Accounts ({demoUsers.length}/5 Registered)</span>
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Active Device Workspace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('registration')}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                activeTab === 'registration'
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Register Phone / Accounts ({demoUsers.length}/5)
            </button>
          </div>
        </div>

        {/* Secure Test Login with Registered Mobile + PIN */}
        {demoUsers.length > 0 && (
          <form
            onSubmit={handlePinLoginSubmit}
            className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-col sm:flex-row sm:items-end gap-2.5 text-xs"
          >
            <div className="flex items-center gap-1.5 font-bold text-[#0B3B75] sm:pb-1.5 shrink-0">
              <KeyRound className="w-4 h-4 text-[#E06D1B]" />
              <span>Test Login (Mobile + PIN):</span>
            </div>
            <input
              type="tel"
              required
              maxLength={10}
              placeholder="10-digit Mobile (e.g. 9000000001)"
              value={loginMobile}
              onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 min-w-[170px] px-2.5 py-1.5 border border-slate-300 rounded font-mono-tabular bg-white"
            />
            <div className="relative flex items-center">
              <input
                type={showLoginPin ? 'text' : 'password'}
                required
                minLength={4}
                maxLength={6}
                placeholder="4–6 digit PIN (e.g. 1234)"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-44 pl-2.5 pr-8 py-1.5 border border-slate-300 rounded font-mono-tabular bg-white"
              />
              <button
                type="button"
                onClick={() => setShowLoginPin((v) => !v)}
                aria-label={showLoginPin ? 'Hide PIN' : 'Show PIN'}
                className="absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showLoginPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-3.5 py-1.5 rounded bg-[#0B3B75] text-white font-bold hover:bg-slate-800 cursor-pointer shrink-0"
            >
              Verify &amp; Switch Account
            </button>
          </form>
        )}

        {demoUsers.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded p-5 text-center space-y-3">
            <p className="text-sm text-slate-600">
              No test users registered yet. On each family phone, register its specific slot (Mobile 1..5) using the form below, or auto-create all 5 presets here.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleEnableAndProvision}
                className="px-4 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Auto-Create 5 Preset Users
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('registration')}
                className="px-4 py-2 rounded border border-[#0B3B75] text-[#0B3B75] text-xs font-bold hover:bg-blue-50 cursor-pointer"
              >
                Register This Phone Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {demoUsers.map((u) => {
              const isSelected = u.id === activeUser?.id;
              const isOwnedHere = u.ownerUid === user.uid;
              const unreadCount = notifications.filter(
                (n) => n.recipientDemoUserId === u.id && !n.read
              ).length;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSwitchDemoUser(u)}
                  className={`text-left p-3 rounded-md border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B3B75] text-white border-[#0B3B75] ring-2 ring-[#E06D1B]'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-[#0B3B75]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-[#E06D1B] text-white'
                          : u.role === 'customer'
                          ? 'bg-blue-100 text-[#0B3B75]'
                          : 'bg-amber-100 text-[#C25E00]'
                      }`}
                    >
                      {u.category}
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-mono-tabular font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <SecureAvatar
                      name={u.displayName}
                      photoDocId={u.photoDocId}
                      sizeClass="w-8 h-8"
                      textSizeClass="text-[11px]"
                    />
                    <div className="min-w-0">
                      <div className={`font-display text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#0B3B75]'}`}>
                        {u.displayName}
                      </div>
                      <div className={`text-[11px] font-mono-tabular ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                        +91 {u.mobile10}
                      </div>
                    </div>
                  </div>
                  <div className={`text-[10px] mt-1 flex items-center justify-between ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    <span>{u.deviceLabel || (isOwnedHere ? 'This Phone' : 'Other Phone')}</span>
                    <span>{u.pushEnabled ? 'PUSH ON' : 'PUSH OFF'}</span>
                  </div>
                  <div className={`text-[10px] mt-0.5 flex items-center justify-between ${isSelected ? 'text-emerald-300' : 'text-slate-500'}`}>
                    <span>{u.role === 'customer' ? 'CUSTOMER' : u.availabilityStatus.toUpperCase()}</span>
                    <span>GPS: {u.locationPermissionStatus.toUpperCase()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* TAB 1: ACTIVE USER WORKSPACE */}
      {activeTab === 'workspace' && activeUser && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Profile & Role Actions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active User Profile Card */}
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              {!activeUserCanAct && (
                <div className="bg-amber-50 border border-amber-300 rounded p-2.5 text-xs text-amber-950 flex items-start gap-2">
                  <Smartphone className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
                  <span>
                    <strong>Multi-Device Ownership Note:</strong> This profile belongs to another family phone&apos;s Google Sign-In ({activeUser.deviceLabel || 'Remote Device'}). Switch to the account registered on <strong>this</strong> phone to perform write actions cleanly under Firestore rules.
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <SecureAvatar
                    name={activeUser.displayName}
                    photoDocId={activeUser.photoDocId}
                    sizeClass="w-14 h-14"
                    textSizeClass="text-lg"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-[#C25E00] font-bold">
                        TEST MODE · VERIFIED
                      </span>
                      <span className="font-bold text-[#0B3B75]">{activeUser.uniqueUserId}</span>
                      {activeUser.deviceLabel && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {activeUser.deviceLabel}
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#0B3B75] mt-1">
                      {activeUser.displayName}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Role: <strong>{activeUser.role.toUpperCase()}</strong> · Category: <strong>{activeUser.category}</strong> · Mobile: <span className="font-mono-tabular">+91 {activeUser.mobile10}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeUser.role === 'worker' && (
                    <select
                      aria-label="Worker Availability"
                      disabled={!activeUserCanAct}
                      value={activeUser.availabilityStatus}
                      onChange={(e) =>
                        void updateDemoUserAvailability(
                          activeUser.id,
                          e.target.value as DemoUserProfile['availabilityStatus']
                        )
                      }
                      className="px-3 py-2 border border-slate-300 rounded text-xs font-bold bg-white text-[#0B3B75] disabled:opacity-50"
                    >
                      <option value="available">Available for Jobs</option>
                      <option value="busy">Busy</option>
                      <option value="offline">Offline</option>
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={gpsDetecting || !activeUserCanAct}
                    onClick={handleUpdateActiveUserGps}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                    {gpsDetecting ? 'Detecting GPS...' : 'Capture My Phone GPS'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Saved GPS Coordinates:</span>
                  <div className="font-mono-tabular font-bold text-[#0B3B75]">
                    {activeUser.lat.toFixed(5)}, {activeUser.lng.toFixed(5)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">GPS Permission &amp; Accuracy:</span>
                  <div className="font-semibold text-slate-800 uppercase">
                    {activeUser.locationPermissionStatus} (±{activeUser.accuracyMeters}m)
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Area:</span>
                  <div className="font-semibold text-slate-800">
                    {activeUser.cityOrVillage}, {activeUser.district}
                  </div>
                </div>
              </div>

              {activeUserCanAct && (
                <div className="pt-1">
                  <ProfilePhotoUploader
                    existingPhotoDocId={activeUser.photoDocId}
                    selectedPhoto={null}
                    onSelectPhoto={(photo) => void handleActiveUserPhotoSelect(photo)}
                    onRemovePhoto={() => void handleActiveUserPhotoRemove()}
                    compact={true}
                    roleLabel={
                      photoUpdating
                        ? 'Saving profile photo...'
                        : `Profile Photo (${activeUser.displayName})`
                    }
                    privacyNote={
                      activeUser.role === 'customer'
                        ? 'Private Customer Photo: visible only to you, Admin, and the Worker after job acceptance.'
                        : 'Optional Worker Photo: displayed to customers and Admin.'
                    }
                  />
                </div>
              )}
            </section>

            {/* Customer: Submit New Job Request */}
            {activeUser.role === 'customer' && (
              <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#E06D1B]" />
                  <h3 className="font-display text-base font-bold text-[#0B3B75]">
                    1. Place Real Category-Matched Job Order
                  </h3>
                </div>

                <form onSubmit={handleSubmitJobRequest} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Select Service Category *
                      </label>
                      <select
                        value={jobCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setJobCategory(cat);
                          setJobTitle(`Urgent ${cat} Service Required (TEST)`);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-semibold"
                      >
                        {DEMO_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Job Title *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Work Description *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Offered Wage (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={jobWage}
                        onChange={(e) => setJobWage(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                      <select
                        value={jobWageUnit}
                        onChange={(e) => setJobWageUnit(e.target.value as WageUnit)}
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="hourly">Hourly</option>
                        <option value="contract">Fixed / Contract</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !activeUserCanAct}
                      className="col-span-2 sm:col-span-1 py-2.5 px-4 rounded bg-[#E06D1B] text-white font-bold hover:bg-[#c55b10] cursor-pointer disabled:opacity-60"
                    >
                      {busy ? 'Sending...' : `Send ${jobCategory} Request`}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Job Orders + 7-Stage Deal Closing + Two-Way Live Location */}
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#0B3B75] flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-[#E06D1B]" />
                  <span>
                    {activeUser.role === 'customer'
                      ? `My Job Orders & 7-Stage Deal Lifecycle (${activeUserOrders.length})`
                      : `Matched ${activeUser.category} Requests (${activeUserOrders.length})`}
                  </span>
                </h3>
              </div>

              {activeUserOrders.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 py-3">
                  {activeUser.role === 'customer'
                    ? 'No job orders submitted yet. Place a job request above to notify matching workers.'
                    : `No ${activeUser.category} job orders matched to you yet. Unrelated categories (e.g. Plumber vs Electrician) stay strictly hidden.`}
                </p>
              ) : (
                <div className="space-y-4">
                  {activeUserOrders.map((order) => {
                    const isAcceptedByMe =
                      activeUser.role === 'worker' && order.acceptedWorkerId === activeUser.id;
                    const isDeclinedByMe =
                      activeUser.role === 'worker' &&
                      (order.rejectedWorkerIds || []).includes(activeUser.id);
                    const locationUnlocked =
                      ['accepted', 'customer_confirmed', 'in_progress'].includes(order.status) &&
                      (activeUser.role === 'customer' || isAcceptedByMe);

                    const myRole: 'customer' | 'worker' = activeUser.role;
                    const partnerRole: 'customer' | 'worker' =
                      myRole === 'customer' ? 'worker' : 'customer';

                    const myShare = locationShares.find(
                      (s) => s.orderId === order.id && s.participantRole === myRole
                    );
                    const partnerShare = locationShares.find(
                      (s) => s.orderId === order.id && s.participantRole === partnerRole
                    );

                    const mySharingOn = Boolean(myShare?.sharingActive) && locationUnlocked;
                    const partnerSharingOn = Boolean(partnerShare?.sharingActive) && locationUnlocked;

                    const liveDistance =
                      mySharingOn && partnerSharingOn
                        ? computeLiveDistanceLabel(myShare, partnerShare)
                        : partnerSharingOn
                        ? computeLiveDistanceLabel(
                            { lat: activeUser.lat, lng: activeUser.lng },
                            partnerShare
                          )
                        : null;

                    const statusBadge = STATUS_BADGE_MAP[order.status] || STATUS_BADGE_MAP.requested;

                    return (
                      <div
                        key={order.id}
                        className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/40"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular">
                              <span className="font-bold text-[#0B3B75]">{order.orderCode}</span>
                              <span>·</span>
                              <span className={`px-2 py-0.5 rounded font-bold uppercase ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                            <h4 className="font-display text-sm font-bold text-[#0B3B75] mt-1">
                              {order.title}
                            </h4>
                            <p className="text-xs text-slate-600">{order.description}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Service: <strong>{order.serviceCategory}</strong> · Customer:{' '}
                              <strong>{order.customerName}</strong> · ₹{order.offeredWage}/{order.wageUnit}
                              {order.acceptedWorkerName && (
                                <>
                                  {' · '}Accepted by: <strong className="text-[#15803D]">{order.acceptedWorkerName}</strong>
                                </>
                              )}
                            </p>
                            {/* Accepted Partner Photo Display (strict privacy for customer photo) */}
                            {activeUser.role === 'customer' && order.acceptedWorkerName && (
                              <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-xs">
                                <SecureAvatar
                                  name={order.acceptedWorkerName}
                                  photoDocId={
                                    order.acceptedWorkerPhotoDocId ||
                                    demoUsers.find((u) => u.id === order.acceptedWorkerId)?.photoDocId
                                  }
                                  sizeClass="w-8 h-8"
                                  textSizeClass="text-[10px]"
                                />
                                <div>
                                  <div className="font-bold text-[#0B3B75]">{order.acceptedWorkerName}</div>
                                  <div className="text-[10px] text-[#15803D] font-semibold">Accepted Worker Profile</div>
                                </div>
                              </div>
                            )}
                            {activeUser.role === 'worker' && (
                              isAcceptedByMe && isCustomerPhotoVisibleForJobStatus(order.status) ? (
                                <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded bg-blue-50 border border-blue-200 text-xs">
                                  <SecureAvatar
                                    name={order.customerName}
                                    acceptedGrantId={buildAcceptedDemoOrderGrantId(order.id)}
                                    sizeClass="w-8 h-8"
                                    textSizeClass="text-[10px]"
                                  />
                                  <div>
                                    <div className="font-bold text-[#0B3B75]">{order.customerName}</div>
                                    <div className="text-[10px] text-slate-600">Customer Photo (Authorized Job Partner)</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>Customer photo stays hidden until you accept and customer confirms the job.</span>
                                </div>
                              )
                            )}
                          </div>

                          {/* Stage 2: Worker Accept / Reject Controls */}
                          {activeUser.role === 'worker' &&
                            order.status === 'requested' &&
                            !isDeclinedByMe && (
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={busy || !activeUserCanAct}
                                  onClick={() => handleWorkerDecision(order, 'accepted')}
                                  className="px-3.5 py-2 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                                >
                                  Accept Job
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !activeUserCanAct}
                                  onClick={() => handleWorkerDecision(order, 'declined')}
                                  className="px-3.5 py-2 rounded border border-red-300 bg-white text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                          {activeUser.role === 'worker' && isDeclinedByMe && (
                            <span className="text-xs font-bold text-red-700">You rejected this request</span>
                          )}
                        </div>

                        {/* Stage 3 & 4 Progression Controls */}
                        <div className="flex flex-wrap gap-2">
                          {activeUser.role === 'customer' && order.status === 'accepted' && (
                            <button
                              type="button"
                              disabled={busy || !activeUserCanAct}
                              onClick={() => handleConfirmWorker(order)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              Confirm Worker (CUSTOMER CONFIRMED)
                            </button>
                          )}

                          {isAcceptedByMe &&
                            (order.status === 'accepted' || order.status === 'customer_confirmed') && (
                              <button
                                type="button"
                                disabled={busy || !activeUserCanAct}
                                onClick={() => handleStartWorkInProgress(order)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800 cursor-pointer disabled:opacity-50"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Start Work (WORK IN PROGRESS)
                              </button>
                            )}

                          {['accepted', 'customer_confirmed', 'in_progress'].includes(order.status) && (
                            <button
                              type="button"
                              disabled={busy || !activeUserCanAct}
                              onClick={() => handleMarkCompleted(order)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              Mark Work Completed (Stops GPS)
                            </button>
                          )}
                        </div>

                        {/* Authorized Two-Way Live Location Sharing Box */}
                        <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-bold text-[#0B3B75] flex items-center gap-1.5">
                              <LocateFixed className="w-4 h-4 text-[#E06D1B]" />
                              <span>Authorized Two-Way Live Location</span>
                            </div>
                            {liveDistance && (
                              <span className="px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-mono-tabular font-bold text-[#15803D]">
                                Live Distance: {liveDistance.label}
                              </span>
                            )}
                          </div>

                          {order.status === 'closed' ? (
                            <div className="text-xs text-[#15803D] bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>
                                <strong>DEAL CLOSED ({order.workerRating || 5}/5 ★)</strong> — &ldquo;{order.completionNotes}&rdquo;. Two-way live location sharing permanently ended for privacy.
                              </span>
                            </div>
                          ) : order.status === 'completed' ? (
                            <div className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded p-2.5 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-700" />
                              <span>
                                <strong>WORK COMPLETED:</strong> Live location sharing automatically stopped. Customer can submit final rating &amp; Close Deal below.
                              </span>
                            </div>
                          ) : !locationUnlocked ? (
                            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                              <span>
                                <strong>Privacy Protected:</strong> Live coordinates remain hidden until the worker accepts this request and authorizes sharing.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {/* My Sharing Controls */}
                              <div className="border border-slate-200 rounded p-3 space-y-2">
                                <div className="font-bold text-slate-700">
                                  My Live Location ({myRole.toUpperCase()})
                                </div>
                                {mySharingOn && myShare ? (
                                  <div className="space-y-1.5">
                                    <div className="font-mono-tabular text-[#15803D] font-bold">
                                      SHARING ACTIVE: {myShare.lat.toFixed(5)}, {myShare.lng.toFixed(5)}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Accuracy: ±{myShare.accuracyMeters}m · Source: {myShare.source} · Updated: {formatTimeValue(myShare.updatedAt)}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        disabled={busy || !activeUserCanAct}
                                        onClick={() => handleSimulateMove(order, myRole, myShare)}
                                        className="px-2.5 py-1.5 rounded bg-[#0B3B75] text-white font-semibold hover:bg-slate-800 cursor-pointer"
                                      >
                                        Simulate Move (+0.25 km)
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy || !activeUserCanAct}
                                        onClick={() => handleStopLiveShare(order, myRole)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-700 text-white font-semibold hover:bg-red-800 cursor-pointer"
                                      >
                                        <StopCircle className="w-3.5 h-3.5" />
                                        Stop Sharing Location
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-slate-600">
                                      Your live location is currently OFF (hidden from {partnerRole}).
                                    </p>
                                    <button
                                      type="button"
                                      disabled={busy || !activeUserCanAct}
                                      onClick={() => handleStartLiveLocationShare(order, myRole)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#15803D] text-white font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      Share My Live GPS Location
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Partner Live Location View */}
                              <div className="border border-slate-200 rounded p-3 space-y-2">
                                <div className="font-bold text-slate-700">
                                  {partnerRole === 'worker' ? 'Accepted Worker' : 'Customer'} Live Location
                                </div>
                                {partnerSharingOn && partnerShare ? (
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-[#0B3B75]">
                                      {partnerShare.participantName}
                                    </div>
                                    <div className="font-mono-tabular text-[#15803D] font-bold">
                                      {partnerShare.lat.toFixed(5)}, {partnerShare.lng.toFixed(5)}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Accuracy: ±{partnerShare.accuracyMeters}m · Updated: {formatTimeValue(partnerShare.updatedAt)}
                                    </div>
                                    <a
                                      href={`https://www.google.com/maps?q=${partnerShare.lat},${partnerShare.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B3B75] hover:underline"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View Pin in Google Maps
                                    </a>
                                  </div>
                                ) : (
                                  <p className="text-slate-500">
                                    {partnerRole === 'worker' ? 'Worker' : 'Customer'} has not turned on live location sharing (or stopped sharing). Coordinates stay private.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Stage 7: Customer Final Deal Closure + Rating */}
                          {activeUser.role === 'customer' &&
                            ['completed', 'in_progress', 'customer_confirmed'].includes(order.status) && (
                              <div className="pt-2 border-t border-slate-100">
                                {closingOrderId === order.id ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      value={completionRating}
                                      onChange={(e) => setCompletionRating(Number(e.target.value))}
                                      className="px-2 py-1.5 border border-slate-300 rounded text-xs"
                                    >
                                      {[5, 4, 3, 2, 1].map((r) => (
                                        <option key={r} value={r}>
                                          {r} ★
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={completionNotes}
                                      onChange={(e) => setCompletionNotes(e.target.value)}
                                      className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                                    />
                                    <button
                                      type="button"
                                      disabled={busy || !activeUserCanAct}
                                      onClick={() => handleCloseDeal(order)}
                                      className="px-3 py-1.5 rounded bg-[#15803D] text-white text-xs font-bold cursor-pointer"
                                    >
                                      Confirm Deal Closed
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!activeUserCanAct}
                                    onClick={() => setClosingOrderId(order.id)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                                  >
                                    <Star className="w-3.5 h-3.5 text-amber-300" />
                                    Rate &amp; Close Deal (DEAL CLOSED)
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Notifications Across All Channels */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#0B3B75] flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#E06D1B]" />
                  <span>Notification Channels &amp; Push Status</span>
                </h3>
              </div>

              {/* Channel Diagnostic Breakdown */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded border bg-emerald-50 border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-950">1. In-App Notification Channel</span>
                  <span className="font-mono-tabular font-bold text-[#15803D]">REAL-TIME READY</span>
                </div>

                <div className="p-3 rounded border bg-slate-50 border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B3B75]">2. Browser Notification API</span>
                    <span className="font-mono-tabular font-bold uppercase text-slate-700">
                      {browserPerm}
                    </span>
                  </div>
                  {browserPerm !== 'granted' && browserPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleRequestBrowserPermission}
                      className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      Allow Browser Notifications
                    </button>
                  )}
                </div>

                <div
                  className={`p-3 rounded border space-y-2 ${
                    pushConfig?.hasVapidKey && pushConfig?.hasAdminMessaging
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B3B75]">3. PWA / FCM Web Push Channel</span>
                    <span className="font-mono-tabular font-bold text-xs">
                      {pushConfig?.hasVapidKey && pushConfig?.hasAdminMessaging ? 'CONFIGURED' : 'NEEDS ENV SETUP'}
                    </span>
                  </div>
                  {pushConfig && (!pushConfig.hasVapidKey || !pushConfig.hasAdminMessaging) && (
                    <p className="text-[11px] text-amber-950">
                      <strong>Root Cause:</strong> {pushConfig.missingSetupItems.join(' ')}
                    </p>
                  )}
                  <NotificationOptInButton
                    role={activeUser.role === 'customer' ? 'employer' : 'demo_worker'}
                    isDemo={true}
                    demoAccountId={activeUser.id}
                    compact={true}
                    onStatusChange={(enabled) => {
                      if (activeUserCanAct) {
                        void updateDemoUserPushStatus(activeUser.id, enabled);
                      }
                    }}
                  />
                </div>

                <div className="p-3 rounded border bg-slate-50 border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">4. SMS OTP &amp; SMS Gateway</span>
                  <span className="font-mono-tabular font-bold text-[#C25E00]">BYPASSED (NOT PURCHASED)</span>
                </div>
              </div>

              {/* Active Demo User Notification Inbox */}
              <div className="border-t border-slate-200 pt-3 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inbox for {activeUser.displayName} ({activeUserNotifications.length})
                </div>
                {activeUserNotifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    No notifications yet for this test account.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                    {activeUserNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded border text-xs space-y-1.5 ${
                          n.read ? 'bg-white border-slate-200' : 'bg-blue-50/60 border-[#0B3B75]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[#0B3B75]">{n.title}</span>
                          {!n.read && activeUserCanAct && (
                            <button
                              type="button"
                              onClick={() => void markDemoNotificationRead(n.id)}
                              className="text-[10px] font-bold text-[#E06D1B] hover:underline shrink-0 cursor-pointer"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                        <p className="text-slate-600">{n.body}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono-tabular pt-1">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#15803D]">
                            In-App: OK
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Browser: {n.browserNotificationStatus}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              n.fcmPushStatus === 'sent'
                                ? 'bg-emerald-50 text-[#15803D]'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            FCM Push: {n.fcmPushStatus}
                          </span>
                        </div>
                        {n.fcmErrorReason && (
                          <p className="text-[10px] text-red-700">{n.fcmErrorReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: DEMO REGISTRATION & DUPLICATE MOBILE / USER MANAGEMENT */}
      {(activeTab === 'registration' || !activeUser) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Manual Demo Registration Form */}
          <form
            onSubmit={handleRegisterSubmit}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#E06D1B]" />
              <h3 className="font-display text-base font-bold text-[#0B3B75]">
                Temporary OTP-Free Registration (Max 5)
              </h3>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-amber-950">
              <strong>Test-Only Security Guard:</strong> OTP bypass applies strictly to these 5 test slots. Duplicate mobile numbers are blocked by Firestore transaction lock (<code className="font-mono-tabular">demo_mobile_registry</code>).
            </div>

            {demoUsers.length >= 5 && (
              <div className="bg-red-50 border border-red-200 rounded p-2.5 text-red-800 font-semibold">
                All 5 Test Mode slots are filled ({demoUsers.length}/5). Delete an existing slot or reset sandbox to register a new number.
              </div>
            )}

            {/* Quick Prefill Family Phone Preset Selector */}
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-700">Quick Prefill 5 Family Phone Slots:</div>
              <div className="flex flex-wrap gap-1.5">
                {FIVE_TEST_USER_PRESETS.map((p) => (
                  <button
                    key={p.slotKey}
                    type="button"
                    onClick={() => handleApplyPresetSlot(p.slotKey)}
                    className="px-2 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-[#0B3B75] text-[11px] font-semibold text-[#0B3B75] cursor-pointer"
                  >
                    {p.deviceLabel}: {p.category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                <select
                  value={regRole}
                  onChange={(e) => {
                    const r = e.target.value as DemoUserRole;
                    setRegRole(r);
                    if (r === 'customer') setRegCategory('Customer');
                    else if (regCategory === 'Customer') setRegCategory('Electrician');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value="customer">Customer</option>
                  <option value="worker">Worker</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                {regRole === 'customer' ? (
                  <input
                    type="text"
                    disabled
                    value="Customer"
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-slate-100 text-slate-600"
                  />
                ) : (
                  <select
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                  >
                    {DEMO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  placeholder="e.g. Worker A (Electrician)"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Device Label
                </label>
                <input
                  type="text"
                  placeholder="Mobile 1"
                  value={regDeviceLabel}
                  onChange={(e) => setRegDeviceLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  10-Digit Mobile (Unique) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  4–6 Digit Test PIN *
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    required
                    minLength={4}
                    maxLength={6}
                    placeholder="1234"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPin((v) => !v)}
                    aria-label={showRegPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showRegPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirm PIN *
                </label>
                <input
                  type={showRegPin ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={6}
                  placeholder="1234"
                  value={regConfirmPin}
                  onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <select
                value={regState}
                onChange={(e) => {
                  const st = e.target.value;
                  setRegState(st);
                  const found = INDIA_STATES_DISTRICTS.find((s) => s.name === st);
                  const dist = found?.districts[0];
                  if (dist) {
                    setRegDistrict(dist.name);
                    setRegCity(dist.name);
                    setRegLat(dist.lat);
                    setRegLng(dist.lng);
                  }
                }}
                className="px-2 py-2 border border-slate-300 rounded bg-white"
              >
                {INDIA_STATES_DISTRICTS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={regDistrict}
                onChange={(e) => {
                  const d = e.target.value;
                  setRegDistrict(d);
                  setRegCity(d);
                  const coords = getDistrictCoordinates(regState, d);
                  setRegLat(coords.lat);
                  setRegLng(coords.lng);
                }}
                className="px-2 py-2 border border-slate-300 rounded bg-white"
              >
                {INDIA_STATES_DISTRICTS.find((s) => s.name === regState)?.districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={regCity}
                onChange={(e) => setRegCity(e.target.value)}
                placeholder="City / Ward"
                className="px-2.5 py-2 border border-slate-300 rounded"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
              <div className="font-mono-tabular text-[11px] text-slate-700">
                GPS: {regLat.toFixed(4)}, {regLng.toFixed(4)} ({regPermission.toUpperCase()})
              </div>
              <button
                type="button"
                disabled={gpsDetecting}
                onClick={handleDetectGpsForForm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0B3B75] text-white font-bold cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                {gpsDetecting ? 'Detecting...' : 'Capture Phone GPS'}
              </button>
            </div>

            <ProfilePhotoUploader
              selectedPhoto={regSelectedPhoto}
              onSelectPhoto={setRegSelectedPhoto}
              onRemovePhoto={() => setRegSelectedPhoto(null)}
              compact={true}
              privacyNote={
                regRole === 'customer'
                  ? 'Optional Customer Photo: hidden until a worker accepts your job.'
                  : 'Optional Worker Photo: shown alongside your name in test job orders.'
              }
            />

            <label className="flex items-start gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={regTestVerifyAck}
                onChange={(e) => setRegTestVerifyAck(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Mark account as <strong>Test-Only Verified (Demo Mode)</strong> without faking real SMS OTP.
              </span>
            </label>

            <button
              type="submit"
              disabled={busy || demoUsers.length >= 5}
              className="w-full py-2.5 rounded bg-[#E06D1B] text-white font-bold hover:bg-[#c55b10] cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Registering in Firestore...' : 'Register Family Test Account'}
            </button>
          </form>

          {/* Registered Demo Users List */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#0B3B75] flex items-center gap-2">
                <Hammer className="w-5 h-5 text-[#E06D1B]" />
                <span>Saved Test Accounts in Firestore ({demoUsers.length}/5)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {demoUsers.length < 5 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleEnableAndProvision}
                    className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Auto-Create 5 Preset Users
                  </button>
                )}
                {demoUsers.length > 0 && isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      stopLocalWatch();
                      await resetDemoTestingSandbox(demoUsers, workOrders, locationShares, notifications);
                      setActiveDemoUserId('');
                      setBanner({ kind: 'info', text: 'Test sandbox cleared cleanly from Firestore.' });
                      setBusy(false);
                    }}
                    className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                  >
                    Reset Sandbox
                  </button>
                )}
              </div>
            </div>

            {demoUsers.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-500 py-4">
                No test users registered yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {demoUsers.map((u) => {
                  const canDelete = Boolean(user && (u.ownerUid === user.uid || isAdmin));
                  return (
                    <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <SecureAvatar
                          name={u.displayName}
                          photoDocId={u.photoDocId}
                          sizeClass="w-10 h-10"
                          textSizeClass="text-xs"
                        />
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular font-bold text-[#0B3B75]">{u.uniqueUserId}</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[#C25E00] font-bold text-[10px]">
                              TEST-ONLY VERIFIED
                            </span>
                            {u.deviceLabel && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                {u.deviceLabel}
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-slate-900">{u.displayName}</div>
                          <div className="text-slate-600">
                            {u.role.toUpperCase()} · {u.category} · Mobile: <span className="font-mono-tabular">+91 {u.mobile10}</span> · GPS: {u.lat.toFixed(4)}, {u.lng.toFixed(4)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            handleSwitchDemoUser(u);
                            setActiveTab('workspace');
                          }}
                          className="px-3 py-1.5 rounded bg-[#0B3B75] text-white font-bold cursor-pointer"
                        >
                          Select Account
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            aria-label="Delete demo user"
                            onClick={() => void deleteDemoUserAndReleaseMobile(u)}
                            className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
