import React, { useEffect, useState } from 'react';
import {
  Bell,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Send,
  Settings2,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  markNotificationRead,
  saveNotificationPreferences,
  submitDemoJobApplication,
  subscribeDemoAccounts,
  subscribeDemoApplicationsByUser,
  subscribeDemoJobs,
  subscribeNotificationPreferences,
  subscribeUserDeviceTokens,
  subscribeUserNotifications,
} from '../lib/firestoreService';
import type {
  AppNotificationRecord,
  DemoJobApplication,
  DemoJobPosting,
  DemoWorkerAccount,
  DeviceTokenRecord,
  Language,
  NotificationCategoryKey,
  NotificationPreferences,
  PageRoute,
} from '../types/domain';
import { NotificationOptInButton } from './NotificationOptInButton';
import { PWAInstallButton } from './PWAControls';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function formatTs(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '—';
  const maybe = ts as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString('en-IN');
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString('en-IN');
  return '—';
}

interface UserNotificationCenterProps {
  mode: 'worker' | 'employer';
  onNavigateToTarget: (route: PageRoute, jobId?: string, demoJobId?: string) => void;
  highlightedDemoJobId?: string;
  onClearHighlightedDemoJob?: () => void;
}

export const UserNotificationCenter: React.FC<UserNotificationCenterProps> = ({
  mode,
  onNavigateToTarget,
  highlightedDemoJobId,
  onClearHighlightedDemoJob,
}) => {
  const { lang } = useLanguage();
  const { user, workerProfile } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [tokens, setTokens] = useState<DeviceTokenRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Isolated Demo Worker Sandbox State
  const [showDemoMode, setShowDemoMode] = useState(Boolean(highlightedDemoJobId));
  const [demoAccounts, setDemoAccounts] = useState<DemoWorkerAccount[]>([]);
  const [demoJobs, setDemoJobs] = useState<DemoJobPosting[]>([]);
  const [demoApps, setDemoApps] = useState<DemoJobApplication[]>([]);
  const [selectedDemoAccountId, setSelectedDemoAccountId] = useState('');
  const [activeDemoJob, setActiveDemoJob] = useState<DemoJobPosting | null>(null);
  const [demoProposedWage, setDemoProposedWage] = useState<number>(600);
  const [demoApplyNote, setDemoApplyNote] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState('');

  useEffect(() => {
    if (!user?.emailVerified) {
      setPrefs(null);
      setTokens([]);
      setNotifications([]);
      return;
    }
    const u1 = subscribeNotificationPreferences(user.uid, setPrefs);
    const u2 = subscribeUserDeviceTokens(user.uid, setTokens);
    const u3 = subscribeUserNotifications(user.uid, setNotifications);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid, user?.emailVerified]);

  useEffect(() => {
    if (!user?.emailVerified || mode !== 'worker') return;
    if (!showDemoMode && !highlightedDemoJobId) return;
    const u1 = subscribeDemoAccounts(setDemoAccounts);
    const u2 = subscribeDemoJobs(setDemoJobs);
    const u3 = subscribeDemoApplicationsByUser(user.uid, setDemoApps);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user?.uid, user?.emailVerified, mode, showDemoMode, highlightedDemoJobId]);

  useEffect(() => {
    if (highlightedDemoJobId) {
      setShowDemoMode(true);
      const found = demoJobs.find((j) => j.id === highlightedDemoJobId);
      if (found) {
        setActiveDemoJob(found);
        setDemoProposedWage(found.offeredWage);
      }
    }
  }, [highlightedDemoJobId, demoJobs]);

  useEffect(() => {
    if (demoAccounts.length > 0 && !selectedDemoAccountId) {
      const mine = demoAccounts.find((a) => a.assignedUid === user?.uid);
      setSelectedDemoAccountId(mine?.id || demoAccounts[0].id);
    }
  }, [demoAccounts, selectedDemoAccountId, user?.uid]);

  if (!user) return null;

  const effectivePrefs = {
    matchingJobs: prefs?.matchingJobs ?? true,
    nearbyJobs: prefs?.nearbyJobs ?? true,
    applicationUpdates: prefs?.applicationUpdates ?? true,
    bookingNotifications: prefs?.bookingNotifications ?? true,
    announcements: prefs?.announcements ?? true,
  };

  const togglePref = async (key: NotificationCategoryKey) => {
    setSavingKey(key);
    try {
      await saveNotificationPreferences(user.uid, {
        [key]: !effectivePrefs[key],
        preferredLanguage: lang,
      });
    } finally {
      setSavingKey(null);
    }
  };

  const categoryLabels: Array<{
    key: NotificationCategoryKey;
    label: string;
    showForEmployer?: boolean;
  }> = [
    {
      key: 'matchingJobs',
      label: tr(
        lang,
        'New matching job notifications',
        'कौशल के अनुसार नए काम की सूचनाएं',
        'कौशल्यानुसार नवीन कामाच्या सूचना'
      ),
      showForEmployer: false,
    },
    {
      key: 'nearbyJobs',
      label: tr(
        lang,
        'Nearby job notifications',
        'नज़दीकी कार्य अवसर सूचनाएं',
        'जवळच्या कामाच्या सूचना'
      ),
      showForEmployer: false,
    },
    {
      key: 'applicationUpdates',
      label: tr(
        lang,
        'Job application & quotation updates',
        'आवेदन एवं कोटेशन अपडेट',
        'अर्ज व दर प्रस्ताव अपडेट'
      ),
      showForEmployer: true,
    },
    {
      key: 'bookingNotifications',
      label: tr(
        lang,
        'Booking & arrival notifications',
        'बुकिंग एवं आगमन सूचनाएं',
        'बुकिंग व आगमनाच्या सूचना'
      ),
      showForEmployer: true,
    },
    {
      key: 'announcements',
      label: tr(
        lang,
        'Important announcements',
        'महत्वपूर्ण घोषणाएं',
        'महत्त्वाच्या घोषणा'
      ),
      showForEmployer: true,
    },
  ];

  const visibleToggles =
    mode === 'employer'
      ? categoryLabels.filter((c) => c.showForEmployer)
      : categoryLabels;

  const activeTokensCount = tokens.filter((t) => t.enabled).length;

  const handleOpenNotification = async (item: AppNotificationRecord) => {
    if (!item.read) {
      await markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.targetDemoJobId) {
      setShowDemoMode(true);
      const found = demoJobs.find((j) => j.id === item.targetDemoJobId);
      if (found) {
        setActiveDemoJob(found);
        setDemoProposedWage(found.offeredWage);
      }
      onNavigateToTarget('worker-dashboard', undefined, item.targetDemoJobId);
      return;
    }
    onNavigateToTarget(item.targetRoute || 'find-work', item.targetJobId);
  };

  const handleDemoApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDemoJob) return;
    const selectedDemoAcc = demoAccounts.find((a) => a.id === selectedDemoAccountId);
    const demoAccountId = selectedDemoAcc?.id || 'demo_self_tester';
    const workerName = selectedDemoAcc?.name || workerProfile?.displayName || user.displayName || 'Demo Test Worker';

    setDemoBusy(true);
    setDemoMsg('');
    try {
      await submitDemoJobApplication({
        demoJobId: activeDemoJob.id,
        demoJobTitle: activeDemoJob.title,
        demoAccountId,
        applicantUid: user.uid,
        workerName,
        proposedWage: Number(demoProposedWage) || activeDemoJob.offeredWage,
        ...(demoApplyNote.trim() ? { note: demoApplyNote.trim().slice(0, 400) } : {}),
      });
      setDemoMsg(
        tr(
          lang,
          'Demo application submitted! It is now visible in Admin Live Demo Panel.',
          'डेमो आवेदन सफलतापूर्वक भेजा गया! यह एडमिन लाइव डेमो पैनल में दिखाई देगा।',
          'डेमो अर्ज यशस्वीरीत्या पाठवला! तो आता अ‍ॅडमिन लाइव्ह डेमो पॅनेलमध्ये दिसेल.'
        )
      );
      setActiveDemoJob(null);
      setDemoApplyNote('');
      if (onClearHighlightedDemoJob) onClearHighlightedDemoJob();
    } catch (err) {
      setDemoMsg(err instanceof Error ? err.message : 'Unable to submit demo application.');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile App & Notification Preferences Card */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#E06D1B]" />
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                {tr(
                  lang,
                  'Mobile App & Notification Settings',
                  'मोबाइल ऐप एवं सूचना सेटिंग्स',
                  'मोबाईल अ‍ॅप व सूचना सेटिंग्ज'
                )}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {tr(
                lang,
                `Registered push devices: ${activeTokensCount}. Enable alerts to receive instant job & booking notifications on your mobile.`,
                `सक्रिय पुश डिवाइस: ${activeTokensCount}। मोबाइल पर तुरंत काम की सूचना पाने के लिए सूचनाएं चालू करें।`,
                `सक्रिय पुश डिव्हाइसेस: ${activeTokensCount}. मोबाईलवर तात्काळ कामाच्या सूचना मिळवण्यासाठी सूचना सुरू करा.`
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton variant="primary" />
            <NotificationOptInButton role={mode === 'employer' ? 'employer' : 'worker'} />
          </div>
        </div>

        {/* Granular Toggles */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Settings2 className="w-3.5 h-3.5" />
            <span>
              {tr(
                lang,
                'Notification Categories',
                'सूचना श्रेणियां',
                'सूचनांचे प्रकार'
              )}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleToggles.map((item) => {
              const checked = effectivePrefs[item.key];
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-medium text-slate-800 cursor-pointer hover:bg-slate-50"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    disabled={savingKey === item.key}
                    checked={checked}
                    onChange={() => togglePref(item.key)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0B3B75]"
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* Registered Devices List */}
        {tokens.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {tr(lang, 'Connected Devices', 'जुड़े हुए डिवाइस', 'जोडलेली डिव्हाइसेस')}
            </div>
            <div className="flex flex-wrap gap-2">
              {tokens.map((tk) => (
                <div
                  key={tk.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium ${
                    tk.enabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>
                    {tk.platform.toUpperCase()} · {tk.browser} {tk.isDemo ? '(DEMO)' : ''}
                  </span>
                  <span className="font-mono-tabular font-bold">
                    {tk.enabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Notification History */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#0B3B75]">
            {tr(lang, 'Notification History', 'सूचना इतिहास', 'सूचनांचा इतिहास')} ({notifications.length})
          </h2>
          {mode === 'worker' && (
            <button
              type="button"
              onClick={() => setShowDemoMode((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-xs font-bold text-[#C25E00] hover:bg-amber-100 cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {showDemoMode
                ? tr(lang, 'Hide Demo Test Mode', 'डेमो टेस्ट बंद करें', 'डेमो टेस्ट लपवा')
                : tr(lang, 'Demo Worker Push Test', 'डेमो टेस्ट मोड', 'डेमो वर्कर टेस्ट मोड')}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            {tr(
              lang,
              'No notifications received yet. Matching job alerts and updates will appear here.',
              'अभी तक कोई सूचना नहीं मिली है। नए काम और अपडेट यहां दिखाई देंगे।',
              'अद्याप कोणतीही सूचना आलेली नाही. नवीन कामाच्या व अर्जांच्या सूचना येथे दिसतील.'
            )}
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !n.read ? 'bg-blue-50/40 -mx-3 px-3 rounded' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-slate-500">
                    <span>{formatTs(n.createdAt)}</span>
                    <span>·</span>
                    <span className="uppercase font-semibold text-[#0B3B75]">{n.category}</span>
                    <span>·</span>
                    <span
                      className={`font-bold uppercase ${
                        n.deliveryStatus === 'sent'
                          ? 'text-[#15803D]'
                          : n.deliveryStatus === 'failed'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {n.deliveryStatus}
                    </span>
                    {n.isDemo && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[#C25E00] font-bold">
                        DEMO
                      </span>
                    )}
                  </div>
                  <div className="font-display text-sm font-bold text-[#0B3B75]">{n.title}</div>
                  <p className="text-xs text-slate-600">{n.body}</p>
                  {n.errorMessage && (
                    <p className="text-[11px] text-red-700">Error: {n.errorMessage}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenNotification(n)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] text-xs font-semibold text-[#0B3B75] hover:bg-blue-50 cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {tr(lang, 'Open', 'खोलें', 'उघडा')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Isolated Demo Worker Portal Mode */}
      {mode === 'worker' && showDemoMode && (
        <section className="bg-amber-50/60 border-2 border-amber-400 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C25E00]">
                <FlaskConical className="w-4 h-4" />
                <span>[DEMO] Isolated Test Worker Portal</span>
              </div>
              <h3 className="font-display text-lg font-bold text-[#0B3B75] mt-0.5">
                {tr(
                  lang,
                  'Test Mobile Push & Demo Job Applications Safely',
                  'मोबाइल पुश नोटिफिकेशन और डेमो जॉब आवेदन परीक्षण',
                  'मोबाईल पुश नोटिफिकेशन व डेमो जॉब चाचणी'
                )}
              </h3>
              <p className="text-xs text-slate-600">
                {tr(
                  lang,
                  'Demo accounts and demo job applications stay strictly separated from real worker counts and public job listings.',
                  'डेमो खाते और आवेदन वास्तविक प्लेटफॉर्म डेटा और आंकड़ों से पूरी तरह अलग रखे जाते हैं।',
                  'डेमो खाती व डेमो अर्ज वास्तविक आकडेवारीपासून पूर्णपणे वेगळे ठेवले आहेत.'
                )}
              </p>
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-md p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Admin-Created DEMO Account (Optional)
                </label>
                <select
                  value={selectedDemoAccountId}
                  onChange={(e) => setSelectedDemoAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white"
                >
                  {demoAccounts.length === 0 ? (
                    <option value="">No DEMO worker accounts created by Admin yet</option>
                  ) : (
                    demoAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        [DEMO] {acc.name} · {acc.primarySkill} · {acc.district} ({acc.maskedMobile})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <NotificationOptInButton
                  role="demo_worker"
                  isDemo={true}
                  demoAccountId={selectedDemoAccountId || undefined}
                />
              </div>
            </div>
          </div>

          {demoMsg && (
            <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{demoMsg}</span>
            </div>
          )}

          {/* Open Demo Jobs */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold text-[#0B3B75] flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#E06D1B]" />
              <span>[DEMO] Sample Jobs ({demoJobs.length})</span>
            </h4>
            {demoJobs.length === 0 ? (
              <p className="text-xs text-slate-600">
                No [DEMO] jobs posted yet. An Admin can create and blast a sample job from the Admin Live Demo Panel.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {demoJobs.map((dj) => {
                  const alreadyApplied = demoApps.some((a) => a.demoJobId === dj.id);
                  const isHighlighted = highlightedDemoJobId === dj.id;
                  return (
                    <div
                      key={dj.id}
                      className={`bg-white rounded-lg p-4 border space-y-2 ${
                        isHighlighted ? 'border-2 border-[#E06D1B] ring-2 ring-amber-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-amber-100 text-[#C25E00]">
                            DEMO JOB
                          </span>
                          <h5 className="font-display text-sm font-bold text-[#0B3B75] mt-1">
                            {dj.title}
                          </h5>
                        </div>
                        <div className="text-right font-mono-tabular text-xs font-bold text-[#15803D]">
                          ₹{dj.offeredWage}/{dj.wageUnit}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">{dj.description}</p>
                      <p className="text-[11px] text-slate-500">
                        {dj.category} · {dj.cityOrVillage}, {dj.district}, {dj.state} · {dj.workersRequired} worker(s)
                      </p>
                      <div className="pt-2 flex justify-end">
                        {alreadyApplied ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Demo Application Sent
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDemoJob(dj);
                              setDemoProposedWage(dj.offeredWage);
                            }}
                            className="px-3.5 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                          >
                            Open & Apply (Demo)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {activeDemoJob && (
            <form
              onSubmit={handleDemoApply}
              className="bg-white border-2 border-[#0B3B75] rounded-lg p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-display text-base font-bold text-[#0B3B75]">
                  Apply to [DEMO] Job: {activeDemoJob.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveDemoJob(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposed Wage (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={demoProposedWage}
                    onChange={(e) => setDemoProposedWage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={demoApplyNote}
                    onChange={(e) => setDemoApplyNote(e.target.value)}
                    placeholder="Available tomorrow morning"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={demoBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#15803D] text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                {demoBusy ? 'Submitting...' : 'Submit Demo Application'}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
};
