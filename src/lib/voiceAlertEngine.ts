import type { Language, NotificationToneType } from '../types/domain';

export interface VoicePlaybackResult {
  audioChimePlayed: boolean;
  speechStatus: 'spoken' | 'blocked_or_silent' | 'unsupported' | 'disabled';
  reason?: string;
}

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

interface ToneNote {
  freq: number;
  offset: number;
  duration: number;
  peak: number;
  type: OscillatorType;
  harmonicFreq?: number;
}

const TONE_PROFILES: Record<NotificationToneType, ToneNote[]> = {
  // Loud, urgent attention alert for new category job broadcasts
  new_job: [
    { freq: 880, offset: 0, duration: 0.14, peak: 0.28, type: 'triangle', harmonicFreq: 1760 },
    { freq: 1174.66, offset: 0.15, duration: 0.14, peak: 0.28, type: 'triangle', harmonicFreq: 2349.32 },
    { freq: 1396.91, offset: 0.3, duration: 0.16, peak: 0.3, type: 'triangle', harmonicFreq: 2793.83 },
    { freq: 1760, offset: 0.48, duration: 0.28, peak: 0.3, type: 'triangle', harmonicFreq: 880 },
  ],
  // Crisp bright double-bell for worker offer arriving to customer
  new_offer: [
    { freq: 659.25, offset: 0, duration: 0.15, peak: 0.26, type: 'sine', harmonicFreq: 1318.51 },
    { freq: 987.77, offset: 0.16, duration: 0.17, peak: 0.27, type: 'sine', harmonicFreq: 1975.53 },
    { freq: 1318.51, offset: 0.35, duration: 0.26, peak: 0.28, type: 'sine' },
  ],
  // Warm triumphant rising fanfare when deal/work is confirmed
  deal_accepted: [
    { freq: 523.25, offset: 0, duration: 0.13, peak: 0.27, type: 'triangle', harmonicFreq: 1046.5 },
    { freq: 659.25, offset: 0.13, duration: 0.13, peak: 0.27, type: 'triangle', harmonicFreq: 1318.51 },
    { freq: 783.99, offset: 0.26, duration: 0.15, peak: 0.28, type: 'triangle', harmonicFreq: 1567.98 },
    { freq: 1046.5, offset: 0.42, duration: 0.34, peak: 0.3, type: 'sine', harmonicFreq: 523.25 },
  ],
  // Clean positive completion bell
  deal_completed: [
    { freq: 783.99, offset: 0, duration: 0.16, peak: 0.25, type: 'sine', harmonicFreq: 1567.98 },
    { freq: 1046.5, offset: 0.18, duration: 0.32, peak: 0.27, type: 'sine', harmonicFreq: 2093 },
  ],
  // Distinct descending two-note notice when cancelled/declined
  deal_cancelled: [
    { freq: 587.33, offset: 0, duration: 0.18, peak: 0.24, type: 'triangle' },
    { freq: 392.0, offset: 0.2, duration: 0.3, peak: 0.24, type: 'triangle' },
  ],
  // Standard chime fallback
  general: [
    { freq: 880, offset: 0, duration: 0.16, peak: 0.22, type: 'triangle' },
    { freq: 1174.66, offset: 0.17, duration: 0.24, peak: 0.24, type: 'sine' },
  ],
};

function getSpeechLangTag(lang: Language): string {
  if (lang === 'mr') return 'mr-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'en-IN';
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function unlockAudioOnUserGesture(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    audioUnlocked = true;
  } catch {
    // Ignore audio context errors on restricted browsers
  }
}

export async function playNotificationTone(
  toneType: NotificationToneType = 'general',
  gainScale = 1
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }
    if (ctx.state !== 'running') {
      return false;
    }

    const clampedScale = Math.max(0.2, Math.min(1.25, gainScale));
    const now = ctx.currentTime + 0.01;
    const profile = TONE_PROFILES[toneType] || TONE_PROFILES.general;

    for (const note of profile) {
      const start = now + note.offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, start);

      const targetPeak = Math.min(0.36, note.peak * clampedScale);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(targetPeak, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.duration + 0.025);

      if (note.harmonicFreq) {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(note.harmonicFreq, start);
        subGain.gain.setValueAtTime(0.0001, start);
        subGain.gain.exponentialRampToValueAtTime(targetPeak * 0.35, start + 0.018);
        subGain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(start);
        subOsc.stop(start + note.duration + 0.025);
      }
    }

    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

export async function playNotificationChime(): Promise<boolean> {
  return playNotificationTone('new_job');
}

function selectPreferredVoice(voices: SpeechSynthesisVoice[], lang: Language): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const preferredTags =
    lang === 'mr'
      ? ['mr-IN', 'mr', 'hi-IN', 'hi']
      : lang === 'hi'
      ? ['hi-IN', 'hi']
      : ['en-IN', 'en-GB', 'en-US', 'en'];

  for (const tag of preferredTags) {
    const lowerTag = tag.toLowerCase();
    const match = voices.find((v) => v.lang.toLowerCase() === lowerTag || v.lang.toLowerCase().startsWith(lowerTag));
    if (match) return match;
  }
  return null;
}

export function stopVoiceAlert(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore speech cancel failures
  }
}

export async function speakJobAlert(params: {
  text: string;
  lang: Language;
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  rate?: number;
  toneType?: NotificationToneType;
}): Promise<VoicePlaybackResult> {
  const { text, lang, soundEnabled = true, voiceEnabled = true, rate = 0.96, toneType = 'new_job' } = params;

  let chimePlayed = false;
  if (soundEnabled) {
    chimePlayed = await playNotificationTone(toneType);
  }

  if (!voiceEnabled) {
    return { audioChimePlayed: chimePlayed, speechStatus: 'disabled' };
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return {
      audioChimePlayed: chimePlayed,
      speechStatus: 'unsupported',
      reason: 'Browser Web Speech API (speechSynthesis) is not supported in this browser.',
    };
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return { audioChimePlayed: chimePlayed, speechStatus: 'disabled' };
  }

  // Wait briefly after chime if chime actually played so words do not overlap the chime
  if (chimePlayed) {
    await new Promise((resolve) => setTimeout(resolve, 360));
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    let voices = synth.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = setTimeout(finish, 300);
        const handler = () => {
          clearTimeout(timer);
          synth.removeEventListener?.('voiceschanged', handler);
          finish();
        };
        synth.addEventListener?.('voiceschanged', handler);
      });
      voices = synth.getVoices();
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = getSpeechLangTag(lang);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    const chosenVoice = selectPreferredVoice(voices, lang);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    const spokenOutcome = await new Promise<VoicePlaybackResult>((resolve) => {
      let resolved = false;
      const done = (status: VoicePlaybackResult['speechStatus'], reason?: string) => {
        if (resolved) return;
        resolved = true;
        resolve({
          audioChimePlayed: chimePlayed,
          speechStatus: status,
          ...(reason ? { reason } : {}),
        });
      };

      const guardTimer = setTimeout(() => {
        if (synth.speaking || audioUnlocked) {
          done('spoken');
        } else {
          done(
            'blocked_or_silent',
            'Browser autoplay policy requires a user tap before playing voice audio.'
          );
        }
      }, 900);

      utterance.onstart = () => {
        clearTimeout(guardTimer);
        audioUnlocked = true;
        done('spoken');
      };

      utterance.onerror = (ev) => {
        clearTimeout(guardTimer);
        const errCode = (ev as SpeechSynthesisErrorEvent)?.error || 'speech_error';
        if (errCode === 'not-allowed') {
          done(
            'blocked_or_silent',
            'Autoplay blocked by browser. Tap "Play Voice Alert" to listen.'
          );
        } else {
          done('blocked_or_silent', `Speech synthesis notice: ${errCode}`);
        }
      };

      synth.speak(utterance);
    });

    return spokenOutcome;
  } catch (err) {
    return {
      audioChimePlayed: chimePlayed,
      speechStatus: 'blocked_or_silent',
      reason: err instanceof Error ? err.message : 'Unable to trigger voice synthesis.',
    };
  }
}

export function getVoiceCapabilities(): {
  speechSupported: boolean;
  audioSupported: boolean;
  availableVoiceCount: number;
  hasMarathiVoice: boolean;
  hasHindiVoice: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      speechSupported: false,
      audioSupported: false,
      availableVoiceCount: 0,
      hasMarathiVoice: false,
      hasHindiVoice: false,
    };
  }
  const speechSupported = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const voices = speechSupported ? window.speechSynthesis.getVoices() : [];
  const audioSupported = Boolean(
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
  return {
    speechSupported,
    audioSupported,
    availableVoiceCount: voices.length,
    hasMarathiVoice: voices.some((v) => v.lang.toLowerCase().startsWith('mr')),
    hasHindiVoice: voices.some((v) => v.lang.toLowerCase().startsWith('hi')),
  };
}
