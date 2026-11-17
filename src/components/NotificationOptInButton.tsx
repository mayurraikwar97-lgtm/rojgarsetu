import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { subscribeUserDeviceTokens } from '../lib/firestoreService';
import {
  disablePushNotificationsForUser,
  enablePushNotificationsForUser,
  getBrowserNotificationState,
} from '../lib/pushNotifications';
import type { DeviceTokenRecord, Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

interface NotificationOptInButtonProps {
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  isDemo?: boolean;
  demoAccountId?: string;
  compact?: boolean;
  className?: string;
  onStatusChange?: (enabled: boolean) => void;
}

export const NotificationOptInButton: React.FC<NotificationOptInButtonProps> = ({
  role,
  isDemo = false,
  demoAccountId,
  compact = false,
  className = '',
  onStatusChange,
}) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [tokens, setTokens] = useState<DeviceTokenRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusKind, setStatusKind] = useState<'ok' | 'warn' | 'info'>('info');
  const browserState = getBrowserNotificationState();

  useEffect(() => {
    if (!user?.emailVerified) {
      setTokens([]);
      return;
    }
    return subscribeUserDeviceTokens(user.uid, setTokens);
  }, [user?.uid, user?.emailVerified]);

  const hasEnabledToken = tokens.some((t) => t.enabled);

  const handleEnable = async () => {
    if (!user) return;
    setBusy(true);
    setStatusMsg('');
    try {
      const res = await enablePushNotificationsForUser({
        uid: user.uid,
        role,
        language: lang,
        isDemo,
        demoAccountId,
      });
      setStatusMsg(res.message);
      setStatusKind(res.ok ? 'ok' : 'warn');
      if (res.ok) onStatusChange?.(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    setBusy(true);
    setStatusMsg('');
    try {
      await disablePushNotificationsForUser(user.uid);
      setStatusMsg(
        tr(
          lang,
          'Push notifications disabled for this device.',
          'इस डिवाइस पर पुश सूचनाएं बंद कर दी गई हैं।',
          'या डिव्हाइसवर पुश सूचना बंद केल्या आहेत.'
        )
      );
      setStatusKind('info');
      onStatusChange?.(false);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {hasEnabledToken ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-[#15803D]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {tr(
                lang,
                'Notifications Enabled',
                'सूचनाएं चालू हैं',
                'सूचना चालू आहेत'
              )}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={handleDisable}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <BellOff className="w-3.5 h-3.5" />
              {tr(lang, 'Disable Alerts', 'सूचना बंद करें', 'सूचना बंद करा')}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnable}
            className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#E06D1B] text-white font-bold hover:bg-[#c55b10] transition-colors cursor-pointer disabled:opacity-60 min-h-[44px] ${
              compact ? 'px-3.5 py-2 text-xs' : 'px-5 py-2.5 text-sm'
            }`}
          >
            {busy ? <BellRing className="w-4 h-4 animate-pulse" /> : <Bell className="w-4 h-4" />}
            <span>
              {busy
                ? tr(lang, 'Activating...', 'चालू हो रहा है...', 'सुरू होत आहे...')
                : tr(lang, 'Enable Notifications', 'Enable Notifications', 'Enable Notifications')}
            </span>
          </button>
        )}
      </div>

      {browserState.permission === 'denied' && !statusMsg && (
        <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {tr(
              lang,
              'Browser notifications are blocked. Allow Notifications in your browser Site Settings for ROJGAR SETU.',
              'ब्राउज़र में सूचनाएं ब्लॉक हैं। सेटिंग्स में जाकर ROJGAR SETU के लिए Notifications की अनुमति दें।',
              'ब्राउझरमध्ये सूचना ब्लॉक केल्या आहेत. कृपया Site Settings मधून Notifications ला परवानगी द्या.'
            )}
          </span>
        </div>
      )}

      {statusMsg && (
        <div
          className={`text-xs rounded px-3 py-2 border ${
            statusKind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusKind === 'warn'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
};
