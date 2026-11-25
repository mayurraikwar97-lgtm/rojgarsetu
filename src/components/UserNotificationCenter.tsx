import React, { useEffect, useState } from 'react';
import {
  Bell,
  Briefcase,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Send,
  Settings2,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { useLanguage } from '../i18n/LanguageContext';
import { db, isAuthenticatedUser } from '../lib/firebase';
import {
  markAllNotificationsRead,
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
import { sanitizeNotificationTextForPrivacy } from '../lib/customerPrivacy';
import { SERVICE_RADIUS_STAGES, buildSmartJobVoiceScript } from '../lib/smartVoiceJobAlert';
import { getToneChannelConfig, getToneTypeForEvent } from '../lib/dealWorkflow';
import {
  buildSpokenNotificationText,
  playNotificationTone,
  speakJobAlert,
  stopVoiceAlert,
  unlockAudioOnUserGesture,
} from '../lib/voiceAlertEngine';
import type {
  AppNotificationRecord,
  DemoJobApplication,
  DemoJobPosting,
  DemoWorkerAccount,
  DeviceTokenRecord,
  Language,
  NotificationCategoryKey,
  NotificationPreferences,
  NotificationToneType,
  PageRoute,
  PublicWorkerProfile,
  ServiceRadiusKm,
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
  const { user, workerProfile, refreshUserProfiles } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [tokens, setTokens] = useState<DeviceTokenRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [voiceTestStatus, setVoiceTestStatus] = useState('');
  const [toneTestStatus, setToneTestStatus] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState(false);

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
    if (!isAuthenticatedUser(user) || !user) {
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
  }, [user]);

  useEffect(() => {
    if (!isAuthenticatedUser(user) || !user || mode !== 'worker') return;
    if (!showDemoMode && !highlightedDemoJobId) return;
    const u1 = subscribeDemoAccounts(setDemoAccounts);
    const u2 = subscribeDemoJobs(setDemoJobs);
    const u3 = subscribeDemoApplicationsByUser(user.uid, setDemoApps);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user, mode, showDemoMode, highlightedDemoJobId]);

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
    voiceAlertsEnabled: prefs?.voiceAlertsEnabled ?? workerProfile?.voiceAlertsEnabled ?? true,
    soundEnabled: prefs?.soundEnabled ?? true,
    toneNewJobEnabled: prefs?.toneNewJobEnabled ?? true,
    toneNewOfferEnabled: prefs?.toneNewOfferEnabled ?? true,
    toneDealConfirmedEnabled: prefs?.toneDealConfirmedEnabled ?? true,
    toneDealClosedEnabled: prefs?.toneDealClosedEnabled ?? true,
    preferredLanguage: (prefs?.preferredLanguage || workerProfile?.preferredLanguage || lang) as Language,
    preferredRadiusKm: (prefs?.preferredRadiusKm || workerProfile?.preferredRadiusKm || 30) as ServiceRadiusKm,
    preferredCategories: prefs?.preferredCategories ?? [],
  };

  const togglePref = async (key: NotificationCategoryKey) => {
    setSavingKey(key);
    try {
      await saveNotificationPreferences(user.uid, {
        [key]: !effectivePrefs[key],
        preferredLanguage: effectivePrefs.preferredLanguage,
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveWorkerVoicePref = async (
    key: string,
    updates: Parameters<typeof saveNotificationPreferences>[1]
  ) => {
    setSavingKey(key);
    try {
      await saveNotificationPreferences(user.uid, updates);
      if (workerProfile) {
        await refreshUserProfiles().catch(() => undefined);
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleAvailabilityChange = async (nextStatus: PublicWorkerProfile['availabilityStatus']) => {
    if (!workerProfile || workerProfile.verificationStatus === 'suspended') return;
    setSavingKey('availability');
    try {
      await updateDoc(doc(db, 'publicWorkers', user.uid), {
        availabilityStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await refreshUserProfiles().catch(() => undefined);
    } finally {
      setSavingKey(null);
    }
  };

  const handleTogglePreferredCategory = async (categoryEn: string) => {
    const current = effectivePrefs.preferredCategories;
    const next = current.includes(categoryEn)
      ? current.filter((c) => c !== categoryEn)
      : [...current, categoryEn].slice(0, 35);
    await handleSaveWorkerVoicePref('preferredCategories', { preferredCategories: next });
  };

  const handleTestTone = async (toneType: NotificationToneType) => {
    unlockAudioOnUserGesture();
    const played = await playNotificationTone(toneType);
    const cfg = getToneChannelConfig(toneType);
    setToneTestStatus(
      played
        ? tr(
            lang,
            `Played "${cfg.label.en}" alert tone.`,
            `"${cfg.label.hi}" अलर्ट टोन बजाई गई।`,
            `"${cfg.label.mr}" अलर्ट टोन वाजवली.`
          )
        : tr(
            lang,
            'Browser blocked audio autoplay — tap anywhere on the page and press Test Tone again.',
            'ब्राउज़र ने ऑडियो रोका है — स्क्रीन पर टैप करके फिर से टेस्ट बटन दबाएं।',
            'ब्राउझरने ऑडिओ थांबवला आहे — पानावर टॅप करून पुन्हा टेस्ट दाबा.'
          )
    );
  };

  const handleTestVoicePreview = async () => {
    unlockAudioOnUserGesture();
    if (isTestingVoice) {
      stopVoiceAlert();
      setIsTestingVoice(false);
      return;
    }
    const targetLang = effectivePrefs.preferredLanguage;
    const sampleScript = buildSmartJobVoiceScript({
      lang: targetLang,
      customerName: 'Mayur Raikwar',
      category: workerProfile?.primarySkill || 'Carpenters',
      jobTitle: 'Door fitting & repair',
      jobDescription:
        targetLang === 'mr'
          ? 'दरवाजा फिटिंग'
          : targetLang === 'hi'
          ? 'दरवाज़ा फिटिंग'
          : 'door installation',
      approxLocationLabel: workerProfile
        ? `${workerProfile.cityOrVillage || workerProfile.district}, ${workerProfile.district}`
        : 'Chandrapur, Maharashtra',
      distanceKm: 3.2,
    });
    setIsTestingVoice(true);
    setVoiceTestStatus('');
    const result = await speakJobAlert({
      text: sampleScript,
      lang: targetLang,
      soundEnabled: effectivePrefs.soundEnabled,
      voiceEnabled: effectivePrefs.voiceAlertsEnabled,
    });
    setIsTestingVoice(false);
    if (result.speechStatus === 'spoken') {
      setVoiceTestStatus(
        tr(
          lang,
          `Voice preview played (${targetLang.toUpperCase()}).`,
          `आवाज़ पूर्वावलोकन चलाया गया (${targetLang.toUpperCase()})।`,
          `आवाज चाचणी यशस्वी (${targetLang.toUpperCase()}).`
        )
      );
    } else if (result.speechStatus === 'disabled') {
      setVoiceTestStatus(
        tr(
          lang,
          'Voice announcements are currently turned off. Chime only.',
          'वॉइस घोषणा बंद है। केवल अलर्ट ध्वनि चली।',
          'व्हॉईस अलर्ट बंद आहे. फक्त बीप वाजली.'
        )
      );
    } else {
      setVoiceTestStatus(result.reason || 'Voice playback unavailable on this browser.');
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
    const fallbackRoute: PageRoute = mode === 'worker' ? 'worker-dashboard' : 'employer-dashboard';
    const rawTarget = item.targetRoute || fallbackRoute;
    const normalizedRoute: PageRoute =
      item.targetJobId &&
      (mode === 'worker' || item.recipientRole === 'worker' || rawTarget === 'find-work')
        ? 'worker-dashboard'
        : rawTarget;
    onNavigateToTarget(normalizedRoute, item.targetJobId);
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

        {/* Distinct Notification Sound & Tone Preferences (Both Customer & Worker) */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                <Volume2 className="w-4 h-4 text-[#E06D1B]" />
                <span>
                  {tr(
                    lang,
                    'Notification Sound & Tone Settings',
                    'सूचना ध्वनि एवं अलग-अलग टोन सेटिंग्स',
                    'सूचना आवाज व वेगवेगळ्या टोन सेटिंग्ज'
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {tr(
                  lang,
                  'Distinct loud tones for job requests, worker offers, work confirmation, and completion/cancellation.',
                  'नए काम, ऑफर, काम पक्का होने और पूर्ण/रद्द होने के लिए अलग-अलग तेज़ अलर्ट टोन।',
                  'नवीन काम, ऑफर, काम निश्चित झाल्यावर आणि पूर्ण/रद्द झाल्यावर वेगवेगळे मोठे अलर्ट आवाज.'
                )}
              </p>
            </div>

            <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0B3B75] cursor-pointer self-start sm:self-center">
              <input
                type="checkbox"
                disabled={savingKey === 'soundEnabled'}
                checked={effectivePrefs.soundEnabled}
                onChange={() =>
                  void handleSaveWorkerVoicePref('soundEnabled', {
                    soundEnabled: !effectivePrefs.soundEnabled,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 accent-[#0B3B75]"
              />
              <span>{tr(lang, 'Master Sound On', 'मास्टर ध्वनि चालू', 'मुख्य आवाज सुरू')}</span>
            </label>
          </div>

          {toneTestStatus && (
            <p className="text-[11px] font-medium text-[#0B3B75] bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
              {toneTestStatus}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              [
                {
                  prefKey: 'toneNewJobEnabled' as const,
                  toneType: 'new_job' as const,
                  title: tr(lang, 'New Job Request Tone', 'नया काम अनुरोध टोन', 'नवीन कामाची विनंती टोन'),
                  desc: tr(
                    lang,
                    'Urgent triple-bell alert for matching category workers',
                    'संबंधित श्रेणी के कामगारों के लिए तेज़ घंटी अलर्ट',
                    'संबंधित कामगारांसाठी जलद तीन-घंटी अलर्ट'
                  ),
                },
                {
                  prefKey: 'toneNewOfferEnabled' as const,
                  toneType: 'new_offer' as const,
                  title: tr(lang, 'New Worker Offer Tone', 'नया कारीगर ऑफर टोन', 'नवीन कामगार ऑफर टोन'),
                  desc: tr(
                    lang,
                    'Crisp chime when a worker sends price & ETA to customer',
                    'कामगार द्वारा दर व समय भेजने पर ग्राहक के लिए टोन',
                    'कामगाराने दर व वेळ पाठवल्यावर ग्राहकासाठी टोन'
                  ),
                },
                {
                  prefKey: 'toneDealConfirmedEnabled' as const,
                  toneType: 'deal_accepted' as const,
                  title: tr(lang, 'Work Confirmed Tone', 'काम पक्का होने का टोन', 'काम निश्चित टोन'),
                  desc: tr(
                    lang,
                    'Rising fanfare when customer confirms work ("Congratulations!")',
                    'ग्राहक द्वारा काम पक्का करने पर विशेष ध्वनि',
                    'ग्राहकाने काम निश्चित केल्यावर अभिनंदन टोन'
                  ),
                },
                {
                  prefKey: 'toneDealClosedEnabled' as const,
                  toneType: 'deal_completed' as const,
                  title: tr(
                    lang,
                    'Work Completed / Cancelled Tone',
                    'काम पूरा / रद्द होने का टोन',
                    'काम पूर्ण / रद्द टोन'
                  ),
                  desc: tr(
                    lang,
                    'Distinct chime for completed work & notice for cancellation',
                    'काम पूरा होने व रद्द होने के लिए अलग-अलग टोन',
                    'काम पूर्ण व रद्द होण्यासाठी वेगळा आवाज'
                  ),
                },
              ]
            ).map((item) => {
              const checked = effectivePrefs[item.prefKey];
              return (
                <div
                  key={item.prefKey}
                  className="rounded-md border border-slate-200 bg-slate-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      disabled={savingKey === item.prefKey || !effectivePrefs.soundEnabled}
                      checked={checked}
                      onChange={() =>
                        void handleSaveWorkerVoicePref(item.prefKey, {
                          [item.prefKey]: !checked,
                        })
                      }
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 accent-[#0B3B75] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0B3B75]">{item.title}</div>
                      <p className="text-[11px] text-slate-600 leading-snug">{item.desc}</p>
                    </div>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleTestTone(item.toneType)}
                      className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-xs font-bold text-[#0B3B75] hover:bg-blue-50 whitespace-nowrap cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                      {item.prefKey === 'toneDealClosedEnabled'
                        ? tr(lang, 'Test Done', 'पूर्ण टेस्ट', 'पूर्ण टोन')
                        : tr(lang, 'Test Tone', 'टोन सुनें', 'टोन ऐका')}
                    </button>
                    {item.prefKey === 'toneDealClosedEnabled' && (
                      <button
                        type="button"
                        onClick={() => void handleTestTone('deal_cancelled')}
                        className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-300 bg-white text-xs font-bold text-rose-700 hover:bg-rose-50 whitespace-nowrap cursor-pointer"
                      >
                        {tr(lang, 'Test Cancel', 'रद्द टेस्ट', 'रद्द टोन')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500">
            {tr(
              lang,
              'Note: Distinct in-app tones play automatically when Rojgar Setu is open. When the browser is closed on Android, notifications use your device OS notification channels and vibration patterns.',
              'नोट: ऐप खुले रहने पर अलग-अलग इन-ऐप टोन बजती हैं। ब्राउज़र बंद होने पर Android पर सिस्टम नोटिफिकेशन चैनल व वाइब्रेशन काम करता है।',
              'टीप: अ‍ॅप सुरू असताना वेगवेगळे इन-अ‍ॅप टोन वाजतात. ब्राउझर बंद असताना Android वर सिस्टम नोटिफिकेशन चॅनेल व व्हायब्रेशन वापरले जाते.'
            )}
          </p>
        </div>

        {/* Worker Smart Voice Job Alert Controls */}
        {mode === 'worker' && (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                  <Volume2 className="w-4 h-4 text-[#E06D1B]" />
                  <span>
                    {tr(
                      lang,
                      'Smart Voice Job Alert Preferences',
                      'स्मार्ट वॉइस जॉब अलर्ट सेटिंग्स',
                      'स्मार्ट व्हॉईस जॉब अलर्ट सेटिंग्ज'
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {tr(
                    lang,
                    'Hear spoken customer job alerts in Marathi, Hindi, or English with chime & radius controls.',
                    'मराठी, हिंदी या अंग्रेजी में बोलकर काम के अलर्ट सुनें।',
                    'मराठी, हिंदी किंवा इंग्रजीतून बोलणारा कामाचा अलर्ट ऐका.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestVoicePreview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer self-start sm:self-center"
              >
                {isTestingVoice ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isTestingVoice
                  ? tr(lang, 'Stop Preview', 'बंद करें', 'थांबवा')
                  : tr(lang, 'Test Voice Alert', 'वॉइस टेस्ट सुनें', 'आवाज चाचणी ऐका')}
              </button>
            </div>

            {voiceTestStatus && (
              <p className="text-[11px] font-medium text-[#0B3B75] bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                {voiceTestStatus}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 cursor-pointer">
                <span>{tr(lang, 'Voice Announcements (TTS)', 'वॉइस अलर्ट (बोलकर)', 'व्हॉईस अलर्ट (बोलून)')}</span>
                <input
                  type="checkbox"
                  disabled={savingKey === 'voiceAlertsEnabled'}
                  checked={effectivePrefs.voiceAlertsEnabled}
                  onChange={() =>
                    void handleSaveWorkerVoicePref('voiceAlertsEnabled', {
                      voiceAlertsEnabled: !effectivePrefs.voiceAlertsEnabled,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-[#0B3B75]"
                />
              </label>

              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 cursor-pointer">
                <span>{tr(lang, 'Alert Sound Chime', 'अलर्ट घंटी ध्वनि', 'अलर्ट आवाज (घंटी)')}</span>
                <input
                  type="checkbox"
                  disabled={savingKey === 'soundEnabled'}
                  checked={effectivePrefs.soundEnabled}
                  onChange={() =>
                    void handleSaveWorkerVoicePref('soundEnabled', {
                      soundEnabled: !effectivePrefs.soundEnabled,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-[#0B3B75]"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {tr(lang, 'Voice Alert Language', 'अलर्ट भाषा', 'अलर्ट भाषा')}
                </label>
                <select
                  value={effectivePrefs.preferredLanguage}
                  disabled={savingKey === 'preferredLanguage'}
                  onChange={(e) =>
                    void handleSaveWorkerVoicePref('preferredLanguage', {
                      preferredLanguage: e.target.value as Language,
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white"
                >
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {tr(lang, 'Alert Radius Limit', 'कार्य दायरा', 'अंतर मर्यादा')}
                </label>
                <select
                  value={effectivePrefs.preferredRadiusKm}
                  disabled={savingKey === 'preferredRadiusKm'}
                  onChange={(e) =>
                    void handleSaveWorkerVoicePref('preferredRadiusKm', {
                      preferredRadiusKm: Number(e.target.value) as ServiceRadiusKm,
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono-tabular font-semibold bg-white"
                >
                  {SERVICE_RADIUS_STAGES.map((km) => (
                    <option key={km} value={km}>
                      {tr(lang, `Within ${km} km`, `${km} किमी तक`, `${km} किमी पर्यंत`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {workerProfile && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {tr(lang, 'Worker Availability (Broadcast Eligibility)', 'उपलब्धता स्थिति', 'उपलब्धता स्थिती')}
                  </label>
                  <select
                    value={workerProfile.availabilityStatus}
                    disabled={savingKey === 'availability' || workerProfile.verificationStatus === 'suspended'}
                    onChange={(e) =>
                      void handleAvailabilityChange(e.target.value as PublicWorkerProfile['availabilityStatus'])
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white"
                  >
                    <option value="available">{tr(lang, 'Available (Receive Job Alerts)', 'उपलब्ध (अलर्ट चालू)', 'उपलब्ध (सूचना सुरू)')}</option>
                    <option value="busy">{tr(lang, 'Busy (Pause New Broadcasts)', 'व्यस्त (नए अलर्ट बंद)', 'व्यस्त (नवीन सूचना बंद)')}</option>
                    <option value="offline">{tr(lang, 'Offline (Pause New Broadcasts)', 'ऑफलाइन (अलर्ट बंद)', 'ऑफलाइन (सूचना बंद)')}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      {tr(
                        lang,
                        'Preferred Trade Filter (empty = primary skill)',
                        'पसंदीदा कार्य श्रेणी',
                        'पसंतीची काम श्रेणी'
                      )}
                    </label>
                    {effectivePrefs.preferredCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleSaveWorkerVoicePref('preferredCategories', { preferredCategories: [] })}
                        className="text-[10px] font-bold text-[#C25E00] hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 border border-slate-200 rounded bg-slate-50">
                    {EMPLOYMENT_CATEGORIES.map((cat) => {
                      const active = effectivePrefs.preferredCategories.includes(cat.en);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => void handleTogglePreferredCategory(cat.en)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                            active
                              ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {lang === 'mr' ? cat.mr.split('/')[0].trim() : lang === 'hi' ? cat.hi.split('/')[0].trim() : cat.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              {tr(
                lang,
                'Note: Live voice announcements speak automatically while Rojgar Setu is open. When the app is closed in background, your phone receives the OS push notification with sound/vibration; tapping "Open & Listen" speaks the full job alert immediately.',
                'नोट: ऐप खुले रहने पर वॉइस अलर्ट स्वतः बोलता है। बैकग्राउंड में आने वाली सूचना पर टैप करने पर पूरा वॉइस संदेश तुरंत सुनाई देता है।',
                'टीप: अ‍ॅप सुरू असताना व्हॉईस अलर्ट आपोआप बोलतो. अ‍ॅप बंद असल्यास मोबाईलवर पुश सूचना येते आणि "उघडा व ऐका" वर टॅप करताच आवाज सुरू होतो.'
              )}
            </p>
          </div>
        )}

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-[#0B3B75]">
              {tr(lang, 'Notification History', 'सूचना इतिहास', 'सूचनांचा इतिहास')} ({notifications.length})
            </h2>
            {notifications.some((n) => !n.read) && (
              <span className="px-2 py-0.5 rounded-full bg-[#E06D1B] text-white text-[11px] font-mono-tabular font-bold">
                {notifications.filter((n) => !n.read).length} unread
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead(notifications)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#15803D]" />
                {tr(lang, 'Mark All Read', 'सभी पढ़े हुए चिह्नित करें', 'सर्व वाचल्या म्हणून नोंदवा')}
              </button>
            )}
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
            {notifications.slice(0, 20).map((n) => {
              const toneCfg = getToneChannelConfig(getToneTypeForEvent(n));
              return (
                <div
                  key={n.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !n.read ? 'bg-blue-50/40 -mx-3 px-3 rounded' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-slate-500">
                      <span>{formatTs(n.createdAt)}</span>
                      <span
                        className={`px-2 py-0.5 rounded border font-sans font-bold ${toneCfg.badgeColorClass}`}
                      >
                        {toneCfg.label[lang]}
                      </span>
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
                    <div className="font-display text-sm font-bold text-[#0B3B75]">
                      {sanitizeNotificationTextForPrivacy(n.title)}
                    </div>
                    <p className="text-xs text-slate-600">
                      {sanitizeNotificationTextForPrivacy(n.body)}
                    </p>
                    {n.errorMessage && (
                      <p className="text-[11px] text-red-700">Error: {n.errorMessage}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        unlockAudioOnUserGesture();
                        const spokenText = buildSpokenNotificationText({
                          voiceScript: n.voiceScript,
                          title: sanitizeNotificationTextForPrivacy(n.title),
                          body: sanitizeNotificationTextForPrivacy(n.body),
                          lang: n.language || lang,
                        });
                        if (spokenText) {
                          void speakJobAlert({
                            text: spokenText,
                            lang: n.language || lang,
                            soundEnabled: false,
                            voiceEnabled: true,
                            toneType: getToneTypeForEvent(n),
                          });
                        }
                      }}
                      aria-label={tr(lang, 'Listen to notification', 'सूचना आवाज में सुनें', 'सूचना आवाजात ऐका')}
                      className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded border border-amber-200 bg-amber-50 text-xs font-bold text-[#0B3B75] hover:bg-amber-100 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#E06D1B]" />
                      <span>{tr(lang, 'Listen', 'सुनें', 'ऐका')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(n)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#0B3B75] text-xs font-extrabold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {tr(lang, 'OPEN', 'खोलें (OPEN)', 'उघडा (OPEN)')}
                    </button>
                  </div>
                </div>
              );
            })}
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
