import type { Language } from '../types/domain';

export interface VoicePlaybackResult {
  audioChimePlayed: boolean;
  speechStatus: 'spoken' | 'blocked_or_silent' | 'unsupported' | 'disabled';
  reason?: string;
}

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

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

export async function playNotificationChime(): Promise<boolean> {
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

    const now = ctx.currentTime;
    const notes = [
      { freq: 880, start: now, duration: 0.16, peak: 0.14 },
      { freq: 1174.66, start: now + 0.17, duration: 0.24, peak: 0.16 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, note.start);

      gain.gain.setValueAtTime(0.0001, note.start);
      gain.gain.exponentialRampToValueAtTime(note.peak, note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(note.start);
      osc.stop(note.start + note.duration + 0.02);
    }
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
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
}): Promise<VoicePlaybackResult> {
  const { text, lang, soundEnabled = true, voiceEnabled = true, rate = 0.96 } = params;

  let chimePlayed = false;
  if (soundEnabled) {
    chimePlayed = await playNotificationChime();
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
