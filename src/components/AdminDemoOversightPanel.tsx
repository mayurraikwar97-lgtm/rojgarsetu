import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  FlaskConical,
  LocateFixed,
  MapPin,
  Navigation,
  Power,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  computeLiveDistanceLabel,
  formatTimeValue,
  isDemoModeEnvEnabled,
  provisionFiveTestUsers,
  setDemoModeEnabled,
  subscribeDemoLocationShares,
  subscribeDemoModeConfig,
  subscribeDemoNotifications,
  subscribeDemoUsers,
  subscribeDemoWorkOrders,
} from '../lib/demoService';
import { callNotificationApi } from '../lib/firestoreService';
import type {
  DemoLiveLocationShare,
  DemoModeConfig,
  DemoNotificationRecord,
  DemoUserProfile,
  DemoWorkOrder,
  PageRoute,
} from '../types/domain';

interface AdminDemoOversightPanelProps {
  onNavigate?: (route: PageRoute) => void;
}

export const AdminDemoOversightPanel: React.FC<AdminDemoOversightPanelProps> = ({
  onNavigate,
}) => {
  const { user, isAdmin } = useAuth();
  const [config, setConfig] = useState<DemoModeConfig | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUserProfile[]>([]);
  const [workOrders, setWorkOrders] = useState<DemoWorkOrder[]>([]);
  const [locationShares, setLocationShares] = useState<DemoLiveLocationShare[]>([]);
  const [notifications, setNotifications] = useState<DemoNotificationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pushStatus, setPushStatus] = useState<{
    hasVapidKey: boolean;
    hasAdminMessaging: boolean;
    missingSetupItems: string[];
  } | null>(null);

  const envEnabled = isDemoModeEnvEnabled();
  const firestoreEnabled = config?.enabled ?? false;
  const effectiveEnabled = envEnabled && firestoreEnabled;

  useEffect(() => {
    const u0 = subscribeDemoModeConfig(setConfig);
    return () => u0();
  }, []);

  useEffect(() => {
    if (!user?.emailVerified || !isAdmin) return;
    const u1 = subscribeDemoUsers(user.uid, true, setDemoUsers);
    const u2 = subscribeDemoWorkOrders(user.uid, true, setWorkOrders);
    const u3 = subscribeDemoLocationShares(user.uid, true, setLocationShares);
    const u4 = subscribeDemoNotifications(user.uid, true, setNotifications);
    void callNotificationApi<{
      hasVapidKey?: boolean;
      hasAdminMessaging?: boolean;
      missingSetupItems?: string[];
    }>('/api/notifications/config-status')
      .then((res) => {
        if (res.data) {
          setPushStatus({
            hasVapidKey: Boolean(res.data.hasVapidKey),
            hasAdminMessaging: Boolean(res.data.hasAdminMessaging),
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

  const metrics = useMemo(() => {
    const customers = demoUsers.filter((u) => u.role === 'customer');
    const workers = demoUsers.filter((u) => u.role === 'worker');
    const workerCategories = Array.from(new Set(workers.map((w) => w.category)));
    const availableWorkers = workers.filter((w) => w.availabilityStatus === 'available');
    const unavailableWorkers = workers.filter((w) => w.availabilityStatus !== 'available');
    const activeShares = locationShares.filter((s) => s.sharingActive);
    const acceptedJobs = workOrders.filter((o) =>
      ['accepted', 'customer_confirmed', 'in_progress'].includes(o.status)
    );
    const completedJobs = workOrders.filter((o) => o.status === 'completed');
    const closedDeals = workOrders.filter((o) => o.status === 'closed');
    const failedNotifications = notifications.filter(
      (n) => n.fcmPushStatus === 'failed' || n.fcmPushStatus === 'skipped_no_token'
    );

    return {
      totalUsers: demoUsers.length,
      customersCount: customers.length,
      workersCount: workers.length,
      workerCategoriesCount: workerCategories.length,
      availableCount: availableWorkers.length,
      unavailableCount: unavailableWorkers.length,
      totalJobs: workOrders.length,
      acceptedCount: acceptedJobs.length,
      completedCount: completedJobs.length,
      closedCount: closedDeals.length,
      activeSharesCount: activeShares.length,
      totalNotifications: notifications.length,
      failedNotificationsCount: failedNotifications.length,
    };
  }, [demoUsers, workOrders, locationShares, notifications]);

  if (!user || !isAdmin) return null;

  const handleToggleDemoMode = async (next: boolean) => {
    setBusy(true);
    setBanner(null);
    try {
      await setDemoModeEnabled(user.uid, next);
      setBanner({
        kind: 'ok',
        text: next
          ? 'Pre-Launch Demo Mode ENABLED in Firestore (`platform_settings/demo_config`). Remember to disable it before public launch!'
          : 'Pre-Launch Demo Mode DISABLED cleanly in Firestore. All non-admin demo testing access is now locked.',
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to update Demo Mode toggle.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSeedFiveUsers = async () => {
    setBusy(true);
    setBanner(null);
    try {
      if (!firestoreEnabled) {
        await setDemoModeEnabled(user.uid, true);
      }
      const res = await provisionFiveTestUsers(user.uid, demoUsers);
      setBanner({
        kind: 'ok',
        text: `5-User Demo Test Set ready: ${res.createdCount} newly registered, ${res.skippedCount} already present in Firestore.`,
      });
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to provision 5 test users.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Demo Mode Control Header */}
      <section className="bg-white border-2 border-[#E06D1B]/60 rounded-lg p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C25E00]">
              <FlaskConical className="w-4 h-4" />
              <span>FINAL PRE-LAUNCH TESTING — 5-USER DEMO OVERSIGHT</span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#0B3B75]">
              ROJGAR SETU Demo Mode Control & Live Monitoring
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl">
              Temporary testing sandbox controlled by Admin Firestore setting (<code className="font-mono-tabular">platform_settings/demo_config</code>) and <code className="font-mono-tabular">VITE_DEMO_MODE_ENABLED</code>. Normal production SMS OTP & verification rules remain strictly enforced.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleToggleDemoMode(!firestoreEnabled)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                firestoreEnabled
                  ? 'bg-red-700 text-white hover:bg-red-800'
                  : 'bg-[#15803D] text-white hover:bg-emerald-800'
              }`}
            >
              <Power className="w-4 h-4" />
              {firestoreEnabled ? 'Disable Demo Mode (Pre-Launch Lock)' : 'Enable Demo Mode'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleSeedFiveUsers}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Provision 5 Test Users
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('demo-testing')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                Open 5-User Test Console
              </button>
            )}
          </div>
        </div>

        {/* Env + Firestore status strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className={`p-3 rounded border ${effectiveEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
            <div className="font-bold uppercase text-[11px]">Demo Mode Runtime Gate</div>
            <div className="mt-1 font-semibold">
              {effectiveEnabled ? 'ACTIVE (Pre-Launch Testing ON)' : firestoreEnabled ? 'BLOCKED BY ENV (VITE_DEMO_MODE_ENABLED=false)' : 'DISABLED (Safe for Public Launch)'}
            </div>
          </div>
          <div className="p-3 rounded border bg-slate-50 border-slate-200 text-slate-800">
            <div className="font-bold uppercase text-[11px] text-slate-500">Production Security Check</div>
            <div className="mt-1 font-semibold flex items-center gap-1.5 text-[#15803D]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Production SMS OTP & PII Isolation Unchanged
            </div>
          </div>
          <div className={`p-3 rounded border ${pushStatus?.hasVapidKey && pushStatus?.hasAdminMessaging ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
            <div className="font-bold uppercase text-[11px]">PWA / FCM Push Channel Status</div>
            <div className="mt-1 font-semibold">
              {pushStatus
                ? pushStatus.hasVapidKey && pushStatus.hasAdminMessaging
                  ? 'FCM Web Push Configured'
                  : `Incomplete: ${!pushStatus.hasVapidKey ? 'VITE_FIREBASE_VAPID_KEY missing' : ''} ${!pushStatus.hasAdminMessaging ? 'Service Account missing' : ''}`.trim()
                : 'Checking config...'}
            </div>
          </div>
        </div>

        {banner && (
          <div
            className={`p-3 rounded border text-xs font-semibold flex items-start gap-2 ${
              banner.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{banner.text}</span>
          </div>
        )}
      </section>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#0B3B75]">{metrics.totalUsers} / 5</div>
          <div className="text-xs text-slate-600 mt-1">
            Accounts ({metrics.customersCount} Cust · {metrics.workersCount} Wrk / {metrics.workerCategoriesCount} Cat)
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#15803D]">
            {metrics.availableCount} / {metrics.unavailableCount}
          </div>
          <div className="text-xs text-slate-600 mt-1">Workers Avail / Busy</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#0B3B75]">{metrics.totalJobs}</div>
          <div className="text-xs text-slate-600 mt-1">Job Requests</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#15803D]">
            {metrics.acceptedCount} / {metrics.completedCount + metrics.closedCount}
          </div>
          <div className="text-xs text-slate-600 mt-1">Accepted / Done ({metrics.closedCount} Closed)</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-[#E06D1B]">{metrics.activeSharesCount}</div>
          <div className="text-xs text-slate-600 mt-1">Active 2-Way GPS</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="font-mono-tabular text-2xl font-bold text-red-700">
            {metrics.totalNotifications} / {metrics.failedNotificationsCount}
          </div>
          <div className="text-xs text-slate-600 mt-1">Notifs Total / Push Unsent</div>
        </div>
      </div>

      {/* 1. All 5 Registered Demo Users */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#0B3B75] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E06D1B]" />
            <span>Registered Demo Test Users ({demoUsers.length})</span>
          </h3>
          <span className="text-xs font-mono-tabular text-slate-500">
            Duplicate Mobiles Protected by <code className="font-bold">demo_mobile_registry</code>
          </span>
        </div>

        {demoUsers.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            No demo users registered yet. Click &ldquo;Provision 5 Test Users&rdquo; above or register them in the 5-User Test Console.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Unique User ID</th>
                  <th className="py-2 pr-3">Name & Mobile</th>
                  <th className="py-2 pr-3">Role & Category</th>
                  <th className="py-2 pr-3">Verification</th>
                  <th className="py-2 pr-3">Availability</th>
                  <th className="py-2 pr-3">GPS Permission & Coords</th>
                  <th className="py-2">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demoUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular font-bold text-[#0B3B75] whitespace-nowrap">
                      {u.uniqueUserId}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{u.displayName}</div>
                      <div className="font-mono-tabular text-slate-500">+91 {u.mobile10}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        u.role === 'customer' ? 'bg-blue-50 text-[#0B3B75]' : 'bg-amber-50 text-[#C25E00]'
                      }`}>
                        {u.role}
                      </span>{' '}
                      <span className="font-semibold text-slate-700">{u.category}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-[#C25E00] font-bold text-[10px] whitespace-nowrap">
                        DEMO TEST-ONLY
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.role === 'customer' ? (
                        <span className="text-slate-500">Customer Active</span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            u.availabilityStatus === 'available'
                              ? 'bg-emerald-50 text-[#15803D]'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.availabilityStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1 font-semibold">
                        <LocateFixed className={`w-3.5 h-3.5 ${u.locationPermissionStatus === 'granted' ? 'text-[#15803D]' : 'text-amber-600'}`} />
                        <span className="uppercase">{u.locationPermissionStatus}</span>
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-500">
                        {u.lat.toFixed(4)}, {u.lng.toFixed(4)} ({u.cityOrVillage})
                      </div>
                    </td>
                    <td className="py-2.5 font-mono-tabular text-[11px] text-slate-500 whitespace-nowrap">
                      {formatTimeValue(u.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Job Requests, Accept/Reject & Two-Way Live Location Status */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-[#0B3B75] flex items-center gap-2">
          <Navigation className="w-5 h-5 text-[#E06D1B]" />
          <span>Demo Job Requests, Responses & Live Location Sharing ({workOrders.length})</span>
        </h3>

        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            No demo job requests submitted yet. Submit a job request as User 1 (Customer) in the 5-User Test Console.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Order & Time</th>
                  <th className="py-2 pr-3">Customer → Service</th>
                  <th className="py-2 pr-3">Matched / Assigned Worker</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Location Sharing (2-Way)</th>
                  <th className="py-2">Live Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((order) => {
                  const custShare = locationShares.find(
                    (s) => s.orderId === order.id && s.participantRole === 'customer' && s.sharingActive
                  );
                  const wrkShare = locationShares.find(
                    (s) => s.orderId === order.id && s.participantRole === 'worker' && s.sharingActive
                  );
                  const dist = computeLiveDistanceLabel(custShare, wrkShare);

                  return (
                    <tr key={order.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-mono-tabular font-bold text-[#0B3B75]">{order.orderCode}</div>
                        <div className="text-[11px] text-slate-500">{formatTimeValue(order.createdAt)}</div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-900">{order.title}</div>
                        <div className="text-slate-600">
                          {order.customerName} → <strong>{order.serviceCategory}</strong> (₹{order.offeredWage})
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        {order.acceptedWorkerName ? (
                          <div>
                            <div className="font-semibold text-[#15803D]">{order.acceptedWorkerName}</div>
                            <div className="font-mono-tabular text-[11px] text-slate-500">{order.acceptedWorkerUniqueId}</div>
                          </div>
                        ) : (
                          <div className="text-slate-600">
                            Matched ({order.matchedWorkerIds.length}):{' '}
                            {order.matchedWorkerIds
                              .map((wid) => demoUsers.find((u) => u.id === wid)?.displayName || wid.slice(0, 8))
                              .join(', ') || 'None'}
                            {order.rejectedWorkerIds.length > 0 && (
                              <span className="text-red-700 block">Declined: {order.rejectedWorkerIds.length}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            ['completed', 'closed', 'accepted', 'customer_confirmed', 'in_progress'].includes(order.status)
                              ? 'bg-emerald-50 text-[#15803D]'
                              : order.status === 'declined' || order.status === 'cancelled'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-[#C25E00]'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 space-y-0.5 font-mono-tabular text-[11px]">
                        <div>
                          Customer: <strong className={custShare ? 'text-[#15803D]' : 'text-slate-500'}>{custShare ? 'SHARING ON' : 'OFF'}</strong>
                        </div>
                        <div>
                          Worker: <strong className={wrkShare ? 'text-[#15803D]' : 'text-slate-500'}>{wrkShare ? 'SHARING ON' : 'OFF'}</strong>
                        </div>
                      </td>
                      <td className="py-2.5 font-mono-tabular font-bold text-[#0B3B75]">
                        {dist ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                            {dist.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Requires both sharing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Notification Delivery Status Across All 3 Channels */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-[#0B3B75] flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#E06D1B]" />
          <span>3-Channel Notification Delivery Diagnostics ({notifications.length})</span>
        </h3>

        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No demo job/accept/completion notifications dispatched yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Event & Message</th>
                  <th className="py-2 pr-3">In-App</th>
                  <th className="py-2 pr-3">Browser Notification</th>
                  <th className="py-2">PWA / FCM Push & Exact Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.slice(0, 40).map((n) => (
                  <tr key={n.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular text-[11px] text-slate-500 whitespace-nowrap">
                      {formatTimeValue(n.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{n.recipientName}</div>
                      <div className="text-[11px] uppercase text-slate-500">{n.recipientRole}</div>
                    </td>
                    <td className="py-2.5 pr-3 max-w-xs">
                      <div className="font-bold text-[#0B3B75]">{n.title}</div>
                      <div className="text-slate-600 truncate">{n.body}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1 font-bold text-[#15803D]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> DELIVERED
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular uppercase text-[11px]">
                      {n.browserNotificationStatus === 'delivered' ? (
                        <span className="text-[#15803D] font-bold">DELIVERED</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">{n.browserNotificationStatus}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-[11px]">
                      <div className={`font-bold uppercase inline-flex items-center gap-1 ${
                        n.fcmPushStatus === 'sent' ? 'text-[#15803D]' : 'text-red-700'
                      }`}>
                        {n.fcmPushStatus === 'sent' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {n.fcmPushStatus}
                      </div>
                      {n.fcmErrorReason && (
                        <div className="text-red-700 mt-0.5 max-w-sm">{n.fcmErrorReason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="bg-amber-50 border border-amber-300 rounded-md p-4 flex items-start gap-2.5 text-xs text-amber-950">
        <ShieldAlert className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
        <div>
          <strong>Pre-Launch Security Checklist:</strong> Before announcing public launch, click <strong>&ldquo;Disable Demo Mode (Pre-Launch Lock)&rdquo;</strong> above and set <code className="font-mono-tabular">VITE_DEMO_MODE_ENABLED=&quot;false&quot;</code> in Vercel environment variables so all test bypass routes remain completely locked in production.
        </div>
      </div>
    </div>
  );
};
