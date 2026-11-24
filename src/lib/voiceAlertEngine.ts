import type { Language, NotificationToneType } from '../types/domain';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;
let speechWarmedUp = false;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let pendingSpeakTimer: number | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

/**
 * Call from user gesture (pointerdown / click / keydown) to unlock Web Audio & warm up Web Speech voices
 * so subsequent notification tones and spoken alerts play cleanly across Chrome, Safari, and Android.
 */
export function unlockAudioOnUserGesture(): boolean {
  if (typeof window === 'undefined') return false;

  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => {
          audioUnlocked = true;
        }).catch(() => undefined);
      } else if (ctx.state === 'running') {
        audioUnlocked = true;
      }
    } catch {
      // Ignore AudioContext resume errors
    }
  }

  if ('speechSynthesis' in window && !speechWarmedUp) {
    try {
      const synth = window.speechSynthesis;
      synth.getVoices();
      if (synth.paused) {
        synth.resume();
      }
      speechWarmedUp = true;
    } catch {
      // Ignore speechSynthesis warmup errors
    }
  }

  return audioUnlocked || speechWarmedUp;
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function isSpeechCurrentlyPlaying(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
  } catch {
    return false;
  }
}

/**
 * Cleanly sanitizes notification title/body into concise spoken alert text
 * when a dedicated voiceScript is not provided.
 */
export function buildSpokenNotificationText(params: {
  voiceScript?: string;
  title?: string;
  body?: string;
  lang?: Language;
}): string {
  const clean = (raw: string): string =>
    raw
      .replace(/https?:\/\/\S+/gi, '')
      // Strip decorative symbols & emoji ranges that read awkwardly aloud
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
      .replace(/[•|]+/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

  if (params.voiceScript && params.voiceScript.trim().length > 0) {
    return clean(params.voiceScript).slice(0, 280);
  }

  const title = clean(params.title || '');
  const body = clean(params.body || '');
  if (!title && !body) return '';
  if (!body || body.toLowerCase() === title.toLowerCase()) {
    return title.slice(0, 240);
  }
  if (!title) {
    return body.slice(0, 240);
  }
  const combined = title.endsWith('.') || title.endsWith('।') || title.endsWith('!')
    ? `${title} ${body}`
    : `${title}. ${body}`;
  return combined.slice(0, 260);
}

interface ToneNote {
  freq: number;
  start: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

const TONE_PATTERNS: Record<NotificationToneType, { notes: ToneNote[]; totalMs: number }> = {
  new_job: {
    notes: [
      { freq: 659.25, start: 0, duration: 0.13, gain: 0.14, type: 'triangle' },
      { freq: 880, start: 0.13, duration: 0.14, gain: 0.16, type: 'triangle' },
      { freq: 1174.66, start: 0.28, duration: 0.22, gain: 0.15, type: 'sine' },
    ],
    totalMs: 520,
  },
  new_offer: {
    notes: [
      { freq: 587.33, start: 0, duration: 0.14, gain: 0.13, type: 'sine' },
      { freq: 783.99, start: 0.16, duration: 0.19, gain: 0.15, type: 'sine' },
    ],
    totalMs: 380,
  },
  deal_accepted: {
    notes: [
      { freq: 523.25, start: 0, duration: 0.11, gain: 0.13, type: 'sine' },
      { freq: 659.25, start: 0.11, duration: 0.11, gain: 0.14, type: 'sine' },
      { freq: 783.99, start: 0.22, duration: 0.12, gain: 0.15, type: 'sine' },
      { freq: 1046.5, start: 0.34, duration: 0.24, gain: 0.16, type: 'triangle' },
    ],
    totalMs: 600,
  },
  deal_cancelled: {
    notes: [
      { freq: 493.88, start: 0, duration: 0.16, gain: 0.13, type: 'sine' },
      { freq: 392.0, start: 0.18, duration: 0.24, gain: 0.13, type: 'sine' },
    ],
    totalMs: 440,
  },
  deal_completed: {
    notes: [
      { freq: 523.25, start: 0, duration: 0.1, gain: 0.12, type: 'sine' },
      { freq: 783.99, start: 0.12, duration: 0.12, gain: 0.14, type: 'sine' },
      { freq: 1046.5, start: 0.26, duration: 0.22, gain: 0.15, type: 'sine' },
    ],
    totalMs: 500,
  },
  general: {
    notes: [
      { freq: 740, start: 0, duration: 0.12, gain: 0.11, type: 'sine' },
      { freq: 987.77, start: 0.13, duration: 0.16, gain: 0.12, type: 'sine' },
    ],
    totalMs: 320,
  },
};

export async function playNotificationTone(
  toneType: NotificationToneType = 'new_job'
): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return false;
    audioUnlocked = true;

    const pattern = TONE_PATTERNS[toneType] || TONE_PATTERNS.general;
    const now = ctx.currentTime;

    for (const note of pattern.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    await new Promise((r) => setTimeout(r, pattern.totalMs));
    return true;
  } catch {
    return false;
  }
}

export async function playJobAlertTone(): Promise<boolean> {
  return playNotificationTone('new_job');
}

export function getBcp47ForLanguage(lang: Language): string {
  if (lang === 'mr') return 'mr-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'en-IN';
}

export function pickBestVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  lang: Language
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const preferredTags =
    lang === 'mr'
      ? ['mr-in', 'mr', 'hi-in', 'hi', 'en-in', 'en']
      : lang === 'hi'
      ? ['hi-in', 'hi', 'mr-in', 'en-in', 'en']
      : ['en-in', 'en-gb', 'en-us', 'en'];

  for (const tag of preferredTags) {
    const googleMatch = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(tag) &&
        (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural'))
    );
    if (googleMatch) return googleMatch;

    const exact = voices.find((v) => v.lang.toLowerCase() === tag);
    if (exact) return exact;
    const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(tag));
    if (prefix) return prefix;
  }
  return voices.find((v) => v.default) || voices[0] || null;
}

async function waitForVoices(timeoutMs = 700): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length > 0) return immediate;

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', onVoices);
      resolve(synth.getVoices());
    };
    const onVoices = () => {
      if (synth.getVoices().length > 0) done();
    };
    synth.addEventListener?.('voiceschanged', onVoices);
    window.setTimeout(done, timeoutMs);
  });
}

export interface SpeakAlertOptions {
  text: string;
  lang: Language;
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  rate?: number;
  toneType?: NotificationToneType;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeakAlertResult {
  tonePlayed: boolean;
  speechStatus: 'spoken' | 'disabled' | 'unsupported' | 'blocked_or_silent';
  selectedVoiceName?: string;
  reason?: string;
}

export function stopVoiceAlert(): void {
  if (pendingSpeakTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  activeUtterance = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export async function speakJobAlert(options: SpeakAlertOptions): Promise<SpeakAlertResult> {
  const {
    text,
    lang,
    soundEnabled = true,
    voiceEnabled = true,
    rate = 0.96,
    toneType = 'new_job',
    onStart,
    onEnd,
  } = options;

  let tonePlayed = false;
  if (soundEnabled) {
    tonePlayed = await playNotificationTone(toneType);
  }

  if (!voiceEnabled) {
    return { tonePlayed, speechStatus: 'disabled' };
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return { tonePlayed, speechStatus: 'disabled' };
  }

  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return { tonePlayed, speechStatus: 'unsupported' };
  }

  try {
    const synth = window.speechSynthesis;
    const voices = await waitForVoices(700);
    const chosenVoice = pickBestVoiceForLanguage(voices, lang);

    // Clear any scheduled utterance timer first
    if (pendingSpeakTimer !== null) {
      window.clearTimeout(pendingSpeakTimer);
      pendingSpeakTimer = null;
    }

    // Only call cancel() if currently speaking/pending, then wait 65ms to avoid Chrome/Safari silent-drop bug
    const needsCancelDelay = Boolean(synth.speaking || synth.pending);
    if (needsCancelDelay) {
      try {
        synth.cancel();
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 65));
    }

    try {
      if (synth.paused) {
        synth.resume();
      }
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(trimmedText);
    utterance.lang = chosenVoice?.lang || getBcp47ForLanguage(lang);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Hold a module-level strong ref so Chrome does not GC the utterance mid-speech
    activeUtterance = utterance;

    const speechStatus = await new Promise<'spoken' | 'blocked_or_silent'>((resolve) => {
      let started = false;
      let resolved = false;

      const finish = (status: 'spoken' | 'blocked_or_silent') => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(startGuard);
        resolve(status);
      };

      utterance.onstart = () => {
        started = true;
        onStart?.();
        finish('spoken');
      };

      utterance.onend = () => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        onEnd?.();
        finish('spoken');
      };

      utterance.onerror = (evt) => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        onEnd?.();
        const errCode = (evt as SpeechSynthesisErrorEvent | undefined)?.error;
        if (errCode === 'interrupted' || errCode === 'canceled') {
          finish(started ? 'spoken' : 'blocked_or_silent');
          return;
        }
        finish(started ? 'spoken' : 'blocked_or_silent');
      };

      // Guard if browser blocks autoplay speech without firing onstart/onerror
      const startGuard = window.setTimeout(() => {
        if (started || synth.speaking) {
          finish('spoken');
        } else {
          if (activeUtterance === utterance) {
            activeUtterance = null;
          }
          finish('blocked_or_silent');
        }
      }, 1800);

      try {
        synth.speak(utterance);
        // Kick resume right after speak for Android Chrome / Safari edge cases
        if (synth.paused) {
          synth.resume();
        }
      } catch {
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        finish('blocked_or_silent');
      }
    });

    return {
      tonePlayed,
      speechStatus,
      selectedVoiceName: chosenVoice?.name,
    };
  } catch {
    return { tonePlayed, speechStatus: 'blocked_or_silent' };
  }
}

export function getSpeechSupportInfo(): {
  audioSupported: boolean;
  speechSupported: boolean;
  voiceCount: number;
  hasIndianVoice: boolean;
} {
  if (typeof window === 'undefined') {
    return { audioSupported: false, speechSupported: false, voiceCount: 0, hasIndianVoice: false };
  }
  const audioSupported = Boolean(
    window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
  const speechSupported =
    'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const voices = speechSupported ? window.speechSynthesis.getVoices() : [];
  const hasIndianVoice = voices.some((v) => {
    const l = v.lang.toLowerCase();
    return l.startsWith('mr') || l.startsWith('hi') || l.startsWith('en-in');
  });
  return {
    audioSupported,
    speechSupported,
    voiceCount: voices.length,
    hasIndianVoice,
  };
}
