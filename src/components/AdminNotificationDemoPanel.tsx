import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  FlaskConical,
  Megaphone,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  callNotificationApi,
  createDemoAccount,
  createDemoJob,
  deleteDemoAccount,
  subscribeAllDemoApplicationsAdmin,
  subscribeAllDeviceTokensAdmin,
  subscribeDeliveryLogsAdmin,
  subscribeDemoAccounts,
  subscribeDemoJobs,
} from '../lib/firestoreService';
import { getBrowserNotificationState } from '../lib/pushNotifications';
import type {
  DemoJobApplication,
  DemoJobPosting,
  DemoWorkerAccount,
  DeviceTokenRecord,
  Language,
  NotificationDeliveryLog,
  PublicEmployerProfile,
  PublicWorkerProfile,
} from '../types/domain';
import { NotificationOptInButton } from './NotificationOptInButton';

function formatTs(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '—';
  const maybe = ts as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString('en-IN');
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString('en-IN');
  return '—';
}

interface ConfigStatusResponse {
  ok: boolean;
  hasVapidKey: boolean;
  hasAdminMessaging: boolean;
  adminCredentialMode: string;
  httpsActive: boolean;
  missingSetupItems: string[];
}

interface DispatchApiResponse {
  ok?: boolean;
  errorCode?: string;
  message?: string;
  attemptedTokens?: number;
  sentCount?: number;
  failedCount?: number;
  inAppOnlyCount?: number;
  errors?: Array<{ uid: string; code: string; message: string }>;
}

interface AdminNotificationDemoPanelProps {
  workers: PublicWorkerProfile[];
  employers: PublicEmployerProfile[];
}

export const AdminNotificationDemoPanel: React.FC<AdminNotificationDemoPanelProps> = ({
  workers,
  employers,
}) => {
  const { lang } = useLanguage();
  const { user } = useAuth();

  const [deviceTokens, setDeviceTokens] = useState<DeviceTokenRecord[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLog[]>([]);
  const [demoAccounts, setDemoAccounts] = useState<DemoWorkerAccount[]>([]);
  const [demoJobs, setDemoJobs] = useState<DemoJobPosting[]>([]);
  const [demoApps, setDemoApps] = useState<DemoJobApplication[]>([]);
  const [configStatus, setConfigStatus] = useState<ConfigStatusResponse | null>(null);

  const [selectedWorkerUid, setSelectedWorkerUid] = useState('');
  const [customTestTitle, setCustomTestTitle] = useState('[DEMO] ROJGAR SETU Job Alert');
  const [customTestBody, setCustomTestBody] = useState(
    'New door fitting & local work alert available near Chandrapur.'
  );
  const [annAudience, setAnnAudience] = useState<'demo_only' | 'all_opted_in'>('demo_only');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'failed'>('all');

  const [confirmModal, setConfirmModal] = useState<{
    action: 'test_all_demo_workers' | 'demo_announcement';
    title: string;
    description: string;
  } | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchApiResponse | null>(null);

  // Demo Worker Account Form
  const [dwName, setDwName] = useState('Ramesh Demo Mistri');
  const [dwMobile, setDwMobile] = useState('98XXXXXX42');
  const [dwSkill, setDwSkill] = useState('Carpenters');
  const [dwState, setDwState] = useState('Maharashtra');
  const [dwDistrict, setDwDistrict] = useState('Chandrapur');
  const [dwCity, setDwCity] = useState('Chandrapur');
  const [dwLang, setDwLang] = useState<Language>('mr');

  // Demo Job Form
  const [djTitle, setDjTitle] = useState('[DEMO] Door Fitting Work — Chandrapur');
  const [djCategory, setDjCategory] = useState('Carpenters');
  const [djDesc, setDjDesc] = useState(
    'Wooden main door frame and hinge fitting at Civil Lines. Demo verification task.'
  );
  const [djWorkers, setDjWorkers] = useState(1);
  const [djWage, setDjWage] = useState(850);
  const [djState, setDjState] = useState('Maharashtra');
  const [djDistrict, setDjDistrict] = useState('Chandrapur');
  const [djCity, setDjCity] = useState('Chandrapur');

  const browserState = getBrowserNotificationState();

  const loadConfigStatus = async () => {
    try {
      const res = await callNotificationApi<ConfigStatusResponse>('/api/notifications/config-status');
      setConfigStatus(res.data);
    } catch {
      setConfigStatus(null);
    }
  };

  useEffect(() => {
    loadConfigStatus();
    const u1 = subscribeAllDeviceTokensAdmin(setDeviceTokens);
    const u2 = subscribeDeliveryLogsAdmin(setDeliveryLogs);
    const u3 = subscribeDemoAccounts(setDemoAccounts);
    const u4 = subscribeDemoJobs(setDemoJobs);
    const u5 = subscribeAllDemoApplicationsAdmin(setDemoApps);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  const metrics = useMemo(() => {
    const enabledWorkerUids = new Set(
      deviceTokens.filter((t) => t.enabled && !t.isDemo).map((t) => t.ownerUid)
    );
    const activeTokensCount = deviceTokens.filter((t) => t.enabled).length;
    const activeDemoTokensCount = deviceTokens.filter((t) => t.enabled && t.isDemo).length;
    const sentLogs = deliveryLogs.filter((l) => l.status === 'sent').length;
    const failedLogs = deliveryLogs.filter((l) => l.status === 'failed').length;

    return {
      totalWorkers: workers.length,
      workersEnabled: workers.filter((w) => enabledWorkerUids.has(w.ownerUid)).length,
      workersDisabled: workers.filter((w) => !enabledWorkerUids.has(w.ownerUid)).length,
      totalCustomers: employers.length,
      activeTokensCount,
      activeDemoTokensCount,
      totalSentAttempted: deliveryLogs.length,
      deliveredCount: sentLogs,
      failedCount: failedLogs,
    };
  }, [workers, employers, deviceTokens, deliveryLogs]);

  const workerDropdownOptions = useMemo(() => {
    const enabledUids = new Set(deviceTokens.filter((t) => t.enabled).map((t) => t.ownerUid));
    const list: Array<{ uid: string; label: string; hasToken: boolean }> = [];
    workers.forEach((w) => {
      list.push({
        uid: w.ownerUid,
        label: `${w.displayName} (${w.primarySkill} · ${w.district})`,
        hasToken: enabledUids.has(w.ownerUid),
      });
    });
    demoAccounts.forEach((d) => {
      if (d.assignedUid && !list.some((x) => x.uid === d.assignedUid)) {
        list.push({
          uid: d.assignedUid,
          label: `[DEMO] ${d.name} (${d.primarySkill} · ${d.district})`,
          hasToken: enabledUids.has(d.assignedUid),
        });
      }
    });
    return list;
  }, [workers, demoAccounts, deviceTokens]);

  useEffect(() => {
    if (!selectedWorkerUid && workerDropdownOptions.length > 0) {
      const preferred = workerDropdownOptions.find((w) => w.hasToken) || workerDropdownOptions[0];
      setSelectedWorkerUid(preferred.uid);
    }
  }, [workerDropdownOptions, selectedWorkerUid]);

  const runAdminDemoApi = async (
    action:
      | 'test_self'
      | 'test_worker'
      | 'test_all_demo_workers'
      | 'demo_job_blast'
      | 'demo_announcement',
    extraBody: Record<string, unknown> = {}
  ) => {
    setBusyAction(action);
    setDispatchResult(null);
    try {
      const res = await callNotificationApi<DispatchApiResponse>('/api/notifications/admin-demo', {
        action,
        language: lang,
        title: customTestTitle,
        body: customTestBody,
        ...extraBody,
      });
      setDispatchResult(res.data);
    } catch (err) {
      setDispatchResult({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Request failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateDemoAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyAction('create_demo_worker');
    try {
      await createDemoAccount({
        adminUid: user.uid,
        name: dwName.trim() || 'Demo Worker',
        maskedMobile: dwMobile.trim() || '98XXXXXX00',
        primarySkill: dwSkill,
        skills: [dwSkill],
        state: dwState,
        district: dwDistrict,
        cityOrVillage: dwCity.trim() || dwDistrict,
        preferredLanguage: dwLang,
        notificationsEnabled: false,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateAndBlastDemoJob = async (sendImmediately: boolean) => {
    if (!user) return;
    setBusyAction('create_demo_job');
    setDispatchResult(null);
    try {
      const demoJobId = await createDemoJob({
        adminUid: user.uid,
        title: djTitle.trim().startsWith('[DEMO]') ? djTitle.trim() : `[DEMO] ${djTitle.trim()}`,
        category: djCategory,
        description: djDesc.trim(),
        workersRequired: Number(djWorkers) || 1,
        offeredWage: Number(djWage) || 0,
        wageUnit: 'daily',
        workType: 'daily_wage',
        state: djState,
        district: djDistrict,
        cityOrVillage: djCity.trim() || djDistrict,
      });
      if (sendImmediately) {
        await runAdminDemoApi('demo_job_blast', { demoJobId });
      } else {
        setDispatchResult({
          ok: true,
          message: `Demo job created (${demoJobId}). Click "Send Demo Job Notification" when ready.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const filteredLogs =
    historyFilter === 'failed'
      ? deliveryLogs.filter((l) => l.status === 'failed')
      : deliveryLogs;

  const dwStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === dwState);
  const djStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === djState);

  return (
    <div className="space-y-6">
      {/* Header Banner & Honest Setup Readiness Checklist */}
      <section className="bg-white border-2 border-[#0B3B75] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#0B3B75] text-white px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#E06D1B]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-amber-300 uppercase font-bold">
              <BellRing className="w-4 h-4" />
              <span>Firebase Cloud Messaging · Live Verification Console</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold mt-0.5">
              ROJGAR SETU – LIVE NOTIFICATION DEMO
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <NotificationOptInButton role="admin" isDemo={true} compact />
            <button
              type="button"
              onClick={loadConfigStatus}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-blue-400/60 bg-[#072A54] text-xs font-semibold text-white hover:bg-blue-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Honest Setup Checklist */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Honest Push Readiness Checklist (Zero Fake Delivery Claims)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2">
              {configStatus?.httpsActive ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-bold text-slate-800">HTTPS Context</div>
                <div className="text-slate-500">{configStatus?.httpsActive ? 'Active' : 'Checking...'}</div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2">
              {browserState.supported ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <div>
                <div className="font-bold text-slate-800">Browser Push API</div>
                <div className="text-slate-500">Permission: {browserState.permission}</div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2">
              {browserState.hasVapidKey ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-bold text-slate-800">Web Push VAPID Key</div>
                <div className="text-slate-500">
                  {browserState.hasVapidKey ? 'Configured' : 'Missing VITE_FIREBASE_VAPID_KEY'}
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2">
              {configStatus?.hasAdminMessaging ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-bold text-slate-800">Server Admin Messaging</div>
                <div className="text-slate-500">
                  {configStatus?.hasAdminMessaging
                    ? `Ready (${configStatus.adminCredentialMode})`
                    : 'Missing Server Credentials'}
                </div>
              </div>
            </div>
          </div>

          {configStatus && configStatus.missingSetupItems.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-300 p-3.5 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Action Required for Real Device Push Delivery:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {configStatus.missingSetupItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Live Metrics */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Workers', val: metrics.totalWorkers, cls: 'text-[#0B3B75]' },
            { label: 'Notif Enabled', val: metrics.workersEnabled, cls: 'text-[#15803D]' },
            { label: 'Notif Disabled', val: metrics.workersDisabled, cls: 'text-slate-600' },
            { label: 'Total Customers', val: metrics.totalCustomers, cls: 'text-[#0B3B75]' },
            { label: 'Active Tokens', val: metrics.activeTokensCount, cls: 'text-[#C25E00]' },
            { label: 'Demo Tokens', val: metrics.activeDemoTokensCount, cls: 'text-amber-700' },
            { label: 'Delivered', val: metrics.deliveredCount, cls: 'text-[#15803D]' },
            { label: 'Failed', val: metrics.failedCount, cls: 'text-red-700' },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 border border-slate-200 rounded p-3">
              <div className={`font-mono-tabular text-xl font-extrabold ${m.cls}`}>{m.val}</div>
              <div className="text-[11px] font-medium text-slate-600 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Server Dispatch Outcome Banner */}
      {dispatchResult && (
        <div
          role="status"
          className={`rounded-lg border p-4 text-xs sm:text-sm space-y-1 ${
            dispatchResult.ok && (dispatchResult.sentCount || 0) > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="font-bold flex items-center gap-2">
            {dispatchResult.ok && (dispatchResult.sentCount || 0) > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            )}
            <span>Server Response: {dispatchResult.message}</span>
          </div>
          <div className="font-mono-tabular text-xs">
            Attempted: {dispatchResult.attemptedTokens ?? 0} · Sent: {dispatchResult.sentCount ?? 0} ·
            Failed: {dispatchResult.failedCount ?? 0}
            {dispatchResult.errorCode ? ` · Code: ${dispatchResult.errorCode}` : ''}
          </div>
        </div>
      )}

      {/* Controls A - E: Live Test Controls */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <h3 className="font-display text-lg font-bold text-[#0B3B75]">
          Live Push Notification Test Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Test Notification Title
            </label>
            <input
              type="text"
              value={customTestTitle}
              onChange={(e) => setCustomTestTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Test Notification Message
            </label>
            <input
              type="text"
              value={customTestBody}
              onChange={(e) => setCustomTestBody(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* A & C */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              A. Test My Device & C. Broadcast to Opted-in Test Workers
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => runAdminDemoApi('test_self')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-60"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Send Test Notification to My Device
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setConfirmModal({
                    action: 'test_all_demo_workers',
                    title: 'Confirm [DEMO] Broadcast to Opted-in Test Workers',
                    description: `This will send a [DEMO] push notification only to opted-in demo test devices (${metrics.activeDemoTokensCount} registered). Real production workers will NOT be messaged.`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                Send to All Opted-in Test Workers
              </button>
            </div>
          </div>

          {/* B: Selected Worker */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              B. Send Test Notification to Selected Worker
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedWorkerUid}
                onChange={(e) => setSelectedWorkerUid(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded text-xs bg-white"
              >
                {workerDropdownOptions.length === 0 ? (
                  <option value="">No registered workers yet</option>
                ) : (
                  workerDropdownOptions.map((w) => (
                    <option key={w.uid} value={w.uid}>
                      {w.label} — {w.hasToken ? 'Push Active' : 'No Token'}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                disabled={!selectedWorkerUid || busyAction !== null}
                onClick={() => {
                  const chosen = workerDropdownOptions.find((w) => w.uid === selectedWorkerUid);
                  runAdminDemoApi('test_worker', {
                    targetUid: selectedWorkerUid,
                    targetLabel: chosen?.label || 'Selected Worker',
                  });
                }}
                className="px-4 py-2 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-50 shrink-0"
              >
                Send to Selected Worker
              </button>
            </div>
          </div>

          {/* E: Sample Announcement */}
          <div className="lg:col-span-2 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                E. Send Sample Announcement
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Choose audience before triggering a real FCM announcement push.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={annAudience}
                onChange={(e) => setAnnAudience(e.target.value as 'demo_only' | 'all_opted_in')}
                className="px-3 py-2 border border-slate-300 rounded text-xs bg-white"
              >
                <option value="demo_only">Opted-in Demo Test Devices Only</option>
                <option value="all_opted_in">All Opted-in Devices</option>
              </select>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setConfirmModal({
                    action: 'demo_announcement',
                    title: 'Confirm Announcement Push Dispatch',
                    description:
                      annAudience === 'demo_only'
                        ? `Send announcement push to ${metrics.activeDemoTokensCount} opted-in DEMO device(s)?`
                        : `Send announcement push to ALL ${metrics.activeTokensCount} opted-in ROJGAR SETU devices?`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Send Sample Announcement
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Module 8 & 9: Isolated Demo Test Worker Account & Demo Job Notification Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Demo Worker Account */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#E06D1B]" />
            <h3 className="font-display text-base font-bold text-[#0B3B75]">
              Demo Test Worker Account (Isolated)
            </h3>
          </div>
          <form onSubmit={handleCreateDemoAccount} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                placeholder="Sample Name"
                value={dwName}
                onChange={(e) => setDwName(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded"
              />
              <input
                type="text"
                required
                placeholder="Masked Mobile (98XXXXXX10)"
                value={dwMobile}
                onChange={(e) => setDwMobile(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded font-mono-tabular"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={dwSkill}
                onChange={(e) => setDwSkill(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded bg-white"
              >
                {EMPLOYMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.en}>
                    {c.en}
                  </option>
                ))}
              </select>
              <select
                value={dwLang}
                onChange={(e) => setDwLang(e.target.value as Language)}
                className="px-2.5 py-2 border border-slate-300 rounded bg-white"
              >
                <option value="mr">Marathi (मराठी)</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={dwState}
                onChange={(e) => {
                  const st = e.target.value;
                  setDwState(st);
                  const found = INDIA_STATES_DISTRICTS.find((s) => s.name === st);
                  setDwDistrict(found?.districts[0]?.name || '');
                }}
                className="px-2 py-2 border border-slate-300 rounded bg-white"
              >
                {INDIA_STATES_DISTRICTS.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
              <select
                value={dwDistrict}
                onChange={(e) => setDwDistrict(e.target.value)}
                className="px-2 py-2 border border-slate-300 rounded bg-white"
              >
                {dwStateObj?.districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={dwCity}
                onChange={(e) => setDwCity(e.target.value)}
                placeholder="City/Village"
                className="px-2.5 py-2 border border-slate-300 rounded"
              />
            </div>
            <button
              type="submit"
              disabled={busyAction !== null}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded bg-[#0B3B75] text-white font-bold hover:bg-slate-800 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Create DEMO Worker Account
            </button>
          </form>

          <div className="divide-y divide-slate-200 max-h-56 overflow-y-auto pt-2">
            {demoAccounts.map((acc) => (
              <div key={acc.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[#C25E00] font-bold text-[10px] mr-1.5">
                    {acc.status}
                  </span>
                  <strong className="text-[#0B3B75]">{acc.name}</strong>
                  <div className="text-slate-500">
                    {acc.primarySkill} · {acc.district} · {acc.maskedMobile} ·{' '}
                    {acc.assignedUid ? 'Linked to Mobile Tester' : 'Unlinked'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteDemoAccount(acc.id)}
                  aria-label="Delete demo account"
                  className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* D & Module 9: Create Demo Job + Send Demo Job Notification */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#0B3B75]">
              D. Admin Demo Job Creator & Live Notification Test
            </h3>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-[#C25E00] text-[11px] font-bold">
              [DEMO] ISOLATED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
              <input
                type="text"
                value={djTitle}
                onChange={(e) => setDjTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={djCategory}
                onChange={(e) => setDjCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                {EMPLOYMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.en}>
                    {c.en}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={djDesc}
                onChange={(e) => setDjDesc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Offered Daily Wage (₹)</label>
              <input
                type="number"
                min={0}
                value={djWage}
                onChange={(e) => setDjWage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Required Workers</label>
              <input
                type="number"
                min={1}
                max={100}
                value={djWorkers}
                onChange={(e) => setDjWorkers(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <select
                value={djState}
                onChange={(e) => {
                  const st = e.target.value;
                  setDjState(st);
                  const found = INDIA_STATES_DISTRICTS.find((s) => s.name === st);
                  setDjDistrict(found?.districts[0]?.name || '');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                {INDIA_STATES_DISTRICTS.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">District</label>
              <select
                value={djDistrict}
                onChange={(e) => {
                  setDjDistrict(e.target.value);
                  setDjCity(e.target.value);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                {djStateObj?.districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleCreateAndBlastDemoJob(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              Create & Send Demo Job Notification
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleCreateAndBlastDemoJob(false)}
              className="px-4 py-2.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Save Draft Demo Job Only
            </button>
          </div>

          {/* Existing Demo Jobs */}
          {demoJobs.length > 0 && (
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active [DEMO] Jobs ({demoJobs.length}) · Applications ({demoApps.length})
              </div>
              <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
                {demoJobs.map((dj) => (
                  <div key={dj.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-[#0B3B75]">{dj.title}</div>
                      <div className="text-slate-500">
                        {dj.district} · ₹{dj.offeredWage}/{dj.wageUnit} · {dj.applicationsCount} demo application(s)
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => runAdminDemoApi('demo_job_blast', { demoJobId: dj.id })}
                      className="px-3 py-1.5 rounded bg-[#0B3B75] text-white font-semibold hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      Send Demo Job Notification
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo Applications Received */}
          {demoApps.length > 0 && (
            <div className="border-t border-slate-200 pt-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                Incoming Demo Job Applications (Verification Log)
              </div>
              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto text-xs">
                {demoApps.map((app) => (
                  <div key={app.id} className="py-1.5 flex items-center justify-between">
                    <span>
                      <strong>{app.workerName}</strong> applied to {app.demoJobTitle} (₹{app.proposedWage})
                    </span>
                    <span className="text-slate-400 font-mono-tabular">{formatTs(app.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Controls F & G: Notification History & Failed Notifications */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-[#0B3B75]">
            F & G. Notification Delivery History & Failed Diagnostics
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHistoryFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                historyFilter === 'all'
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All History ({deliveryLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('failed')}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                historyFilter === 'failed'
                  ? 'bg-red-700 text-white'
                  : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
              }`}
            >
              Failed Notifications ({metrics.failedCount})
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">No delivery log entries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Title & Message</th>
                  <th className="py-2 pr-3">Lang</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Error / FCM Message ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {formatTs(log.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-800">{log.recipientLabel}</div>
                      <div className="text-[11px] text-slate-500">
                        {log.recipientRole} {log.isDemo ? '· DEMO' : ''}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 max-w-xs">
                      <div className="font-bold text-[#0B3B75]">{log.title}</div>
                      <div className="text-slate-600 truncate">{log.body}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular uppercase">{log.language}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono-tabular font-bold uppercase ${
                          log.status === 'sent'
                            ? 'bg-emerald-50 text-[#15803D]'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600 font-mono-tabular text-[11px]">
                      {log.status === 'sent'
                        ? log.fcmMessageId || 'Delivered'
                        : `${log.errorCode || 'FAILED'}: ${log.errorMessage || ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Explicit Confirmation Modal for Mass Test Dispatch */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-[#E06D1B] shrink-0" />
              <div>
                <h3 className="font-display text-base font-bold text-[#0B3B75]">
                  {confirmModal.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">{confirmModal.description}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await runAdminDemoApi(act, {
                    confirmed: true,
                    ...(act === 'demo_announcement' ? { audience: annAudience } : {}),
                  });
                }}
                className="px-4 py-2 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
              >
                Confirm & Send Push
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
