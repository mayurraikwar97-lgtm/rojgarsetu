import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DevicePlatform = 'android' | 'ios' | 'desktop';
export type BrowserFamily = 'chrome' | 'safari' | 'edge' | 'samsung' | 'firefox' | 'other';

function detectDeviceEnvironment(): { platform: DevicePlatform; browser: BrowserFamily } {
  if (typeof window === 'undefined') {
    return { platform: 'desktop', browser: 'other' };
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && 'ontouchend' in document);
  const isAndroid = /android/.test(ua);
  const platform: DevicePlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  let browser: BrowserFamily = 'other';
  if (/samsungbrowser/.test(ua)) browser = 'samsung';
  else if (/edg/.test(ua)) browser = 'edge';
  else if (/firefox|fxios/.test(ua)) browser = 'firefox';
  else if (/crios|chrome/.test(ua)) browser = 'chrome';
  else if (/safari/.test(ua)) browser = 'safari';

  return { platform, browser };
}

function checkStandaloneInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkStandaloneInstalled());
  const [env, setEnv] = useState<{ platform: DevicePlatform; browser: BrowserFamily }>({
    platform: 'desktop',
    browser: 'other',
  });

  useEffect(() => {
    setIsInstalled(checkStandaloneInstalled());
    setEnv(detectDeviceEnvironment());

    // Check Web App Installed Related Apps API where supported (Android Chrome / Desktop Chromium)
    const navWithRelated = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string }>>;
    };
    if (typeof navWithRelated.getInstalledRelatedApps === 'function') {
      navWithRelated
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsInstalled(true);
          }
        })
        .catch(() => undefined);
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return 'accepted';
    }
    return 'dismissed';
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: env.platform === 'ios',
    platform: env.platform,
    browser: env.browser,
    install,
  };
}
