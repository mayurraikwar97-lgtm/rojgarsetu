import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Camera,
  Car,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Mic,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import {
  calculateDistanceKm,
  getDistrictCoordinates,
  INDIA_STATES_DISTRICTS,
} from '../data/indiaLocations';
import { getVehicleTypeLabel, VEHICLE_TYPE_CATALOG } from '../data/vehicleTypes';
import { useLanguage } from '../i18n/LanguageContext';
import {
  classifyRequestRuleBased,
  type StructuredWorkClassification,
} from '../lib/aiFallbackClassifier';
import { broadcastSmartJobAlerts, callNotificationApi, createJobPosting } from '../lib/firestoreService';
import type {
  AiHirePrefill,
  Language,
  PublicWorkerProfile,
  VehicleListing,
  VehicleTripType,
  VehicleType,
} from '../types/domain';

interface AIVoiceAssistantModalProps {
  open: boolean;
  onClose: () => void;
  workers: PublicWorkerProfile[];
  vehicles: VehicleListing[];
  userLocationHint?: string;
  onApplyPrefill: (prefill: AiHirePrefill) => void;
}

type AiNoticeState = {
  type: 'SERVICE_UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'NOT_CONFIGURED' | 'NETWORK_ERROR';
  userMessage: string;
  dismissedForManual: boolean;
} | null;

const DEFAULT_FRIENDLY_AI_DOWN_MSG =
  'AI सेवा सध्या तात्पुरती उपलब्ध नाही. काळजी करू नका! आम्ही तुमची कामाची मागणी सामान्य सर्च प्रणालीद्वारे शोधण्याचा प्रयत्न करत आहोत.';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read media file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a compact JPEG data URL thumbnail (<= 75 KB) so uploaded job photos
 * remain safely linked in Firestore job documents even when AI analysis fails.
 */
async function compressImageForJobAttachment(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxEdge = 420;
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.62);
        resolve(compressed.length <= 85000 ? compressed : '');
      } catch {
        resolve('');
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve('');
    };
    img.src = objUrl;
  });
}

function normalizeVehicleType(raw: string, fallbackText = ''): VehicleType | '' {
  const valid: VehicleType[] = [
    'bike_taxi',
    'auto_rickshaw',
    'car_sedan',
    'suv_innova',
    'trolley_cart',
    'mini_tempo',
    'pickup_tempo',
    'tractor',
  ];
  if (valid.includes(raw as VehicleType)) return raw as VehicleType;
  const t = `${raw} ${fallbackText}`.toLowerCase();
  if (/bike|two.?wheeler|scoot|बाईक|दुचाकी|बाइक/.test(t)) return 'bike_taxi';
  if (/trolley|loader|cart|ट्रॉली|लोडर/.test(t)) return 'trolley_cart';
  if (/chhota|hathi|tata ace|mini.?tempo|छोटा हत्ती|छोटा हाथी|छोटी गाडी|छोटी गाड़ी/.test(t)) return 'mini_tempo';
  if (/pickup|407|bolero|मोठी गाडी|बड़ी गाड़ी|पिकअप/.test(t)) return 'pickup_tempo';
  if (/tractor|ट्रॅक्टर|ट्रैक्टर/.test(t)) return 'tractor';
  if (/innova|suv|ertiga|7.?seat|इनोवा|इनोव्हा/.test(t)) return 'suv_innova';
  if (/auto|rickshaw|ऑटो|रिक्षा|रिक्शा/.test(t)) return 'auto_rickshaw';
  if (/car|taxi|cab|sedan|कार|टॅक्सी|टैक्सी/.test(t)) return 'car_sedan';
  return '';
}

function normalizeTripType(raw: string): VehicleTripType {
  const valid: VehicleTripType[] = ['one_way', 'round_trip', 'hourly', 'full_day'];
  return valid.includes(raw as VehicleTripType) ? (raw as VehicleTripType) : 'one_way';
}

function resolveCoordsForLocationName(locName: string): { lat: number; lng: number } | null {
  const q = locName.trim().toLowerCase();
  if (!q) return null;
  for (const st of INDIA_STATES_DISTRICTS) {
    for (const dist of st.districts) {
      const shortName = dist.name.split('(')[0].trim().toLowerCase();
      if (q.includes(shortName) || shortName.includes(q)) {
        return { lat: dist.lat, lng: dist.lng };
      }
    }
  }
  return null;
}

function makeClientRequestId(): string {
  return `rsreq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const AIVoiceAssistantModal: React.FC<AIVoiceAssistantModalProps> = ({
  open,
  onClose,
  workers,
  vehicles,
  userLocationHint = '',
  onApplyPrefill,
}) => {
  const { lang } = useLanguage();
  const { user, employerProfile, customerPreference, signInWithGoogle } = useAuth();

  const [textInput, setTextInput] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [audioClip, setAudioClip] = useState<{ base64: string; mimeType: string; seconds: number } | null>(null);
  const [photoData, setPhotoData] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    compressedAttachment: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState('');
  const [aiNotice, setAiNotice] = useState<AiNoticeState>(null);
  const [aiResult, setAiResult] = useState<StructuredWorkClassification | null>(null);

  // Editable details in result/fallback card (location, workers count, radius, category)
  const [editedLocation, setEditedLocation] = useState('');
  const [editedToLocation, setEditedToLocation] = useState('');
  const [editedWorkersCount, setEditedWorkersCount] = useState<string>('');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(50);

  const [publishing, setPublishing] = useState(false);
  const [publishedJobId, setPublishedJobId] = useState('');
  const [clientRequestId, setClientRequestId] = useState<string>(() => makeClientRequestId());

  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const preSpeechTextRef = useRef<string>('');

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      try {
        speechRecRef.current?.stop();
      } catch {
        // ignore stop errors
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const effectiveLocation = (editedLocation || aiResult?.fromLocation || userLocationHint || '').trim();
  const effectiveReferenceCoords = useMemo(() => {
    if (effectiveLocation) {
      const resolved = resolveCoordsForLocationName(effectiveLocation);
      if (resolved) return resolved;
    }
    if (typeof customerPreference?.defaultLat === 'number' && typeof customerPreference?.defaultLng === 'number') {
      return { lat: customerPreference.defaultLat, lng: customerPreference.defaultLng };
    }
    return null;
  }, [effectiveLocation, customerPreference]);

  const matchingWorkersPreview = useMemo(() => {
    if (!aiResult || aiResult.intent === 'rent_vehicle') return [];
    const catLower = (aiResult.matchedCategory || '').toLowerCase();
    const subLower = (aiResult.subcategory || '').toLowerCase();
    const catObj = EMPLOYMENT_CATEGORIES.find((c) => c.en.toLowerCase() === catLower);
    const locLower = effectiveLocation.toLowerCase();

    return workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => {
        if (!catLower) return true;
        return (
          w.primarySkill.toLowerCase().includes(catLower) ||
          catLower.includes(w.primarySkill.toLowerCase()) ||
          w.skills.some((s) => catLower.includes(s.toLowerCase()) || s.toLowerCase().includes(catLower)) ||
          (subLower &&
            (w.primarySkill.toLowerCase().includes(subLower) ||
              w.skills.some((s) => s.toLowerCase().includes(subLower)))) ||
          (catObj
            ? catObj.skillsEn.some(
                (cs) =>
                  w.primarySkill.toLowerCase().includes(cs.toLowerCase()) ||
                  w.skills.some((ws) => ws.toLowerCase().includes(cs.toLowerCase()))
              )
            : false)
        );
      })
      .map((w) => {
        const distKm =
          effectiveReferenceCoords && typeof w.approxLat === 'number' && typeof w.approxLng === 'number'
            ? calculateDistanceKm(effectiveReferenceCoords.lat, effectiveReferenceCoords.lng, w.approxLat, w.approxLng)
            : null;
        return { worker: w, distKm };
      })
      .filter(({ worker: w, distKm }) => {
        if (searchRadiusKm === 0) return true;
        if (distKm !== null) return distKm <= searchRadiusKm;
        if (!locLower) return true;
        return (
          w.district.toLowerCase().includes(locLower) ||
          w.cityOrVillage.toLowerCase().includes(locLower) ||
          w.state.toLowerCase().includes(locLower)
        );
      })
      .sort((a, b) => {
        if (a.distKm !== null && b.distKm !== null && a.distKm !== b.distKm) {
          return a.distKm - b.distKm;
        }
        return b.worker.ratingAvg - a.worker.ratingAvg;
      })
      .slice(0, 6);
  }, [aiResult, workers, effectiveLocation, effectiveReferenceCoords, searchRadiusKm]);

  const matchingVehiclesPreview = useMemo(() => {
    if (!aiResult || aiResult.intent !== 'rent_vehicle') return [];
    const vType = normalizeVehicleType(aiResult.vehicleType, `${aiResult.transcript} ${textInput}`);
    const locLower = effectiveLocation.toLowerCase();

    return vehicles
      .filter((v) => v.verificationStatus !== 'suspended')
      .filter((v) => !vType || v.vehicleType === vType)
      .map((v) => {
        const distKm =
          effectiveReferenceCoords && typeof v.approxLat === 'number' && typeof v.approxLng === 'number'
            ? calculateDistanceKm(effectiveReferenceCoords.lat, effectiveReferenceCoords.lng, v.approxLat, v.approxLng)
            : null;
        return { vehicle: v, distKm };
      })
      .filter(({ vehicle: v, distKm }) => {
        if (searchRadiusKm === 0) return true;
        if (distKm !== null) return distKm <= searchRadiusKm;
        if (!locLower) return true;
        return (
          v.district.toLowerCase().includes(locLower) ||
          v.cityOrVillage.toLowerCase().includes(locLower) ||
          v.state.toLowerCase().includes(locLower)
        );
      })
      .sort((a, b) => {
        if (a.distKm !== null && b.distKm !== null && a.distKm !== b.distKm) {
          return a.distKm - b.distKm;
        }
        return a.vehicle.ratePerKm - b.vehicle.ratePerKm;
      })
      .slice(0, 6);
  }, [aiResult, vehicles, textInput, effectiveLocation, effectiveReferenceCoords, searchRadiusKm]);

  if (!open) return null;

  const stopAudioPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const playTtsReply = async (replyText: string) => {
    stopAudioPlayback();
    if (!replyText.trim()) return;
    setTtsLoading(true);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (!data.audioBase64) return;
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioPlayerRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
      setIsPlayingAudio(true);
    } catch {
      // Never surface raw TTS errors to user
    } finally {
      setTtsLoading(false);
    }
  };

  const startRecording = async () => {
    setFormErrorMsg('');
    stopAudioPlayback();

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecCtor) {
      try {
        preSpeechTextRef.current = textInput.trim();
        const recognition = new SpeechRecCtor();
        recognition.lang = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event) => {
          let captured = '';
          for (let i = 0; i < event.results.length; i++) {
            captured += event.results[i][0].transcript + ' ';
          }
          const combined = [preSpeechTextRef.current, captured.trim()].filter(Boolean).join(' ').trim();
          setTextInput(combined);
        };
        recognition.onerror = () => {
          // Audio MediaRecorder continues independently even if browser speech recognizer errors
        };
        recognition.start();
        speechRecRef.current = recognition;
      } catch {
        speechRecRef.current = null;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      if (!SpeechRecCtor) {
        setFormErrorMsg(
          tr(
            lang,
            'Microphone recording is unavailable in this browser. Please type your request below.',
            'इस ब्राउज़र में माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे टाइप करें।',
            'या ब्राउझरमध्ये मायक्रोफोन उपलब्ध नाही. कृपया खाली टाइप करा.'
          )
        );
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      let elapsed = 0;
      setRecordSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        try {
          speechRecRef.current?.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
        setIsRecording(false);
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 200) {
          const base64 = await blobToBase64(blob);
          setAudioClip({ base64, mimeType, seconds: Math.max(1, elapsed) });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        elapsed += 1;
        setRecordSeconds(elapsed);
        if (elapsed >= 30 && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 1000);
    } catch {
      try {
        speechRecRef.current?.stop();
      } catch {
        // ignore
      }
      setFormErrorMsg(
        tr(
          lang,
          'Microphone permission denied. Allow mic access or type your request below.',
          'माइक्रोफ़ोन अनुमति अस्वीकृत। कृपया अनुमति दें या टाइप करें।',
          'मायक्रोफोन परवानगी नाकारली. परवानगी द्या किंवा खाली टाइप करा.'
        )
      );
    }
  };

  const stopRecording = () => {
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setFormErrorMsg(
        tr(
          lang,
          'Photo must be under 6 MB.',
          'फोटो 6 MB से कम होना चाहिए।',
          'फोटो 6 MB पेक्षा लहान असावा.'
        )
      );
      return;
    }
    const [base64, compressedAttachment] = await Promise.all([
      blobToBase64(file),
      compressImageForJobAttachment(file),
    ]);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setPhotoData({
      base64,
      mimeType: file.type || 'image/jpeg',
      previewUrl,
      compressedAttachment,
    });
    setFormErrorMsg('');
  };

  const clearPhotoData = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPhotoData(null);
  };

  const applyClassificationToState = (resObj: StructuredWorkClassification) => {
    setAiResult(resObj);
    setEditedLocation(resObj.fromLocation || userLocationHint || '');
    setEditedToLocation(resObj.toLocation || '');
    setEditedWorkersCount(
      resObj.workersRequired && resObj.workersRequired > 0 ? String(resObj.workersRequired) : ''
    );
    if (resObj.transcript && !textInput.trim()) {
      setTextInput(resObj.transcript);
    }
  };

  const runRuleBasedFallbackLocally = (
    activeText: string,
    noticeType: 'SERVICE_UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'NOT_CONFIGURED' | 'NETWORK_ERROR',
    serverMsg?: string,
    serverClassification?: StructuredWorkClassification
  ) => {
    const fallback =
      serverClassification ||
      classifyRequestRuleBased({
        text: activeText,
        language: lang,
        userLocationHint,
        hasPhoto: Boolean(photoData),
      });

    // Preserve text & photo strictly without ever pretending photo was AI analyzed
    applyClassificationToState({
      ...fallback,
      photoAnalyzed: false,
      classificationSource: 'rule_based_fallback',
    });

    setAiNotice({
      type: noticeType,
      userMessage: serverMsg || DEFAULT_FRIENDLY_AI_DOWN_MSG,
      dismissedForManual: false,
    });
  };

  const submitToAssistant = async (overrideText?: string, contextSummary?: string) => {
    const activeText = (overrideText ?? textInput).trim();
    if (!activeText && !audioClip && !photoData) {
      setFormErrorMsg(
        tr(
          lang,
          'Speak with the mic, type a request, or attach a photo first.',
          'कृपया बोलें, लिखें या काम का फोटो जोड़ें।',
          'कृपया माईकने बोला, टाइप करा किंवा कामाचा फोटो जोडा.'
        )
      );
      return;
    }

    setLoading(true);
    setFormErrorMsg('');
    setAiNotice(null);
    setPublishedJobId('');
    setClientRequestId(makeClientRequestId());
    stopAudioPlayback();

    try {
      const res = await fetch('/api/ai/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeText,
          audioBase64: contextSummary ? '' : audioClip?.base64 || '',
          audioMimeType: audioClip?.mimeType || 'audio/webm',
          imageBase64: photoData?.base64 || '',
          imageMimeType: photoData?.mimeType || 'image/jpeg',
          language: lang,
          userLocation: userLocationHint,
          ...(contextSummary ? { conversationContext: contextSummary } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        aiUnavailable?: boolean;
        errorType?: 'SERVICE_UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'NOT_CONFIGURED';
        userMessage?: string;
        fallbackClassification?: StructuredWorkClassification;
        error?: string;
        message?: string;
      } & Partial<StructuredWorkClassification>;

      if (!res.ok || data.aiUnavailable) {
        // Fallback immediately without showing raw JSON/503 stack errors
        const nType = data.errorType || (res.status === 429 ? 'QUOTA_EXHAUSTED' : 'SERVICE_UNAVAILABLE');
        runRuleBasedFallbackLocally(
          activeText,
          nType,
          data.userMessage || DEFAULT_FRIENDLY_AI_DOWN_MSG,
          data.fallbackClassification
        );
        return;
      }

      const normalized: StructuredWorkClassification = {
        transcript: data.transcript || activeText || 'Work Request',
        intent: data.intent || 'hire_worker',
        matchedCategory: data.matchedCategory || 'Carpenters',
        subcategory: data.subcategory || '',
        requiredService: data.requiredService || '',
        workersRequired: typeof data.workersRequired === 'number' && data.workersRequired > 0 ? data.workersRequired : null,
        vehicleType: (normalizeVehicleType(String(data.vehicleType || ''), activeText) || '') as VehicleType | '',
        fromLocation: data.fromLocation || '',
        toLocation: data.toLocation || '',
        tripType: data.tripType || '',
        urgency: (data.urgency === 'tomorrow' || data.urgency === 'scheduled' ? data.urgency : 'today'),
        estimatedWage: Number(data.estimatedWage) || 0,
        suggestedTitle: data.suggestedTitle || data.matchedCategory || 'Work Requirement',
        missingDetails: Array.isArray(data.missingDetails) ? data.missingDetails : [],
        followUpQuestion: data.followUpQuestion || '',
        readyToPublish: Boolean(data.readyToPublish),
        replyText: data.replyText || '',
        photoAnalyzed: Boolean(data.photoAnalyzed ?? photoData),
        classificationSource: data.classificationSource || 'ai_primary',
        modelUsed: data.modelUsed,
      };

      applyClassificationToState(normalized);
      if (normalized.replyText) {
        void playTtsReply(normalized.replyText);
      }
    } catch {
      runRuleBasedFallbackLocally(activeText, 'NETWORK_ERROR', DEFAULT_FRIENDLY_AI_DOWN_MSG);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await submitToAssistant();
  };

  const handleContinueWithoutAi = () => {
    const fallback = classifyRequestRuleBased({
      text: textInput.trim() || aiResult?.transcript || '',
      language: lang,
      userLocationHint: editedLocation || userLocationHint,
      hasPhoto: Boolean(photoData),
    });
    if (!aiResult) {
      applyClassificationToState(fallback);
    }
    setAiNotice((prev) => (prev ? { ...prev, dismissedForManual: true } : null));
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || !aiResult) return;
    const reply = followUpInput.trim();
    const combinedText = `${textInput.trim()} ${reply}`.trim();
    setTextInput(combinedText);
    setFollowUpInput('');

    if (aiResult.classificationSource === 'rule_based_fallback' || aiNotice) {
      // Update classification directly via rule-based engine if currently in manual mode
      const updated = classifyRequestRuleBased({
        text: combinedText,
        language: lang,
        userLocationHint: editedLocation || userLocationHint,
        hasPhoto: Boolean(photoData),
      });
      applyClassificationToState(updated);
      return;
    }

    const contextSummary = `Previous request: "${aiResult.transcript}". Detected category: ${aiResult.matchedCategory || aiResult.vehicleType}. Previous location: ${editedLocation || aiResult.fromLocation || 'unknown'}. Assistant asked: "${aiResult.followUpQuestion || aiResult.replyText}".`;
    await submitToAssistant(reply, contextSummary);
  };

  const handleDirectPublishConfirmedJob = async () => {
    if (!aiResult || aiResult.intent === 'rent_vehicle') return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    if (publishing || publishedJobId) return;

    const locVal = (editedLocation || aiResult.fromLocation || customerPreference?.defaultDistrict || '').trim();
    if (locVal.length < 2) {
      setFormErrorMsg(
        tr(
          lang,
          'Please enter the city, village, or locality for this work request.',
          'कृपया कार्य के लिए शहर, गाँव या क्षेत्र लिखें।',
          'कृपया कामासाठी शहर, गाव किंवा पत्ता टाका.'
        )
      );
      return;
    }

    setPublishing(true);
    setFormErrorMsg('');
    try {
      const stateName = customerPreference?.defaultState || employerProfile?.state || INDIA_STATES_DISTRICTS[0].name;
      const distName =
        locVal ||
        customerPreference?.defaultDistrict ||
        employerProfile?.district ||
        INDIA_STATES_DISTRICTS[0].districts[0].name;
      const coords =
        resolveCoordsForLocationName(distName) ||
        getDistrictCoordinates(stateName, distName) || { lat: 21.1458, lng: 79.0882 };
      const wage = Number(aiResult.estimatedWage) > 0 ? Math.min(500000, Number(aiResult.estimatedWage)) : 600;
      const workersCount = Math.max(
        1,
        Math.min(500, Number(editedWorkersCount) || aiResult.workersRequired || 1)
      );
      const descParts = [
        (textInput || aiResult.transcript || aiResult.suggestedTitle).trim(),
        aiResult.requiredService ? `Service: ${aiResult.requiredService}` : '',
        photoData && !aiResult.photoAnalyzed
          ? 'Photo attached by customer as reference (not AI-analyzed).'
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 2000);

      const directJobPayload = {
        employerUid: user.uid,
        employerName: employerProfile?.businessName || user.displayName || 'ROJGAR SETU Customer',
        title: (aiResult.suggestedTitle || aiResult.matchedCategory || 'Work Requirement').slice(0, 140),
        category: aiResult.matchedCategory || 'Construction Workers',
        description: descParts.length >= 10 ? descParts : `${descParts} Work requirement in ${distName}`.slice(0, 2000),
        workersRequired: workersCount,
        requiredSkills: [
          aiResult.subcategory || aiResult.matchedCategory || 'General Work',
        ].slice(0, 15),
        state: stateName,
        district: distName.slice(0, 80),
        cityOrVillage: locVal.slice(0, 100),
        workLocationLabel: locVal.slice(0, 160),
        lat: customerPreference?.defaultLat ?? coords.lat,
        lng: customerPreference?.defaultLng ?? coords.lng,
        jobDate: new Date().toISOString().split('T')[0],
        startTime: '09:30',
        duration: aiResult.urgency === 'tomorrow' ? 'Tomorrow' : 'Today / Urgent',
        workType: 'daily_wage' as const,
        offeredWage: wage,
        wageUnit: 'daily' as const,
        paymentTerms: 'Direct cash / UPI on work completion',
        contactPreference: 'phone_after_confirm' as const,
        isWomenFriendly: false,
        isAccessible: false,
        biddingEnabled: true,
        initialRadiusKm: 10 as const,
        currentRadiusKm: 10 as const,
        ...(photoData?.compressedAttachment ? { photoAttachment: photoData.compressedAttachment } : {}),
        ...(photoData ? { photoAnalyzed: Boolean(aiResult.photoAnalyzed) } : {}),
      };

      const jobId = await createJobPosting(directJobPayload, clientRequestId);
      setPublishedJobId(jobId);

      let batchTargetUids: string[] = [];
      let batchRadius = 10;
      if (workers.length > 0) {
        const broadcastRes = await broadcastSmartJobAlerts({
          jobId,
          job: directJobPayload,
          workers,
          stageRadiusKm: 10,
          autoExpandIfEmpty: true,
        }).catch(() => undefined);
        if (broadcastRes) {
          batchTargetUids = broadcastRes.newlyNotifiedUids;
          batchRadius = broadcastRes.finalRadiusKm;
        }
      }

      void callNotificationApi('/api/notifications/send-matching-job', {
        jobId,
        stageRadiusKm: batchRadius,
        ...(batchTargetUids.length > 0 ? { targetWorkerUids: batchTargetUids } : {}),
      }).catch(() => undefined);
    } catch (err) {
      setFormErrorMsg(err instanceof Error ? err.message : 'Unable to save work request.');
    } finally {
      setPublishing(false);
    }
  };

  const handleApplyAndOpenHire = () => {
    if (!aiResult) return;
    stopAudioPlayback();
    const isVehicle = aiResult.intent === 'rent_vehicle';
    const vType = normalizeVehicleType(aiResult.vehicleType, `${aiResult.transcript} ${textInput}`);
    onApplyPrefill({
      mode: isVehicle ? 'transport' : 'workers',
      category: !isVehicle ? aiResult.matchedCategory : '',
      subcategory: aiResult.subcategory || '',
      requiredService: aiResult.requiredService || '',
      workersRequired: Math.max(1, Number(editedWorkersCount) || aiResult.workersRequired || 1),
      vehicleType: isVehicle ? vType : '',
      fromLocation: editedLocation || aiResult.fromLocation,
      toLocation: editedToLocation || aiResult.toLocation,
      tripType: normalizeTripType(aiResult.tripType),
      urgency:
        aiResult.urgency === 'tomorrow'
          ? 'tomorrow'
          : aiResult.urgency === 'scheduled'
          ? 'scheduled'
          : 'today',
      title: aiResult.suggestedTitle,
      note: textInput || aiResult.transcript,
      transcript: aiResult.transcript || textInput,
      photoAttachment: photoData?.compressedAttachment || undefined,
      photoAnalyzed: photoData ? Boolean(aiResult.photoAnalyzed) : undefined,
    });
    onClose();
  };

  const handleManualSwitchMode = (nextMode: 'hire_worker' | 'rent_vehicle') => {
    const base: StructuredWorkClassification = aiResult || {
      transcript: textInput.trim() || 'Manual Work / Transport Search',
      intent: nextMode,
      matchedCategory: nextMode === 'hire_worker' ? 'Carpenters' : 'Bike Taxi / Two-Wheeler',
      subcategory: '',
      requiredService: '',
      workersRequired: 1,
      vehicleType: nextMode === 'rent_vehicle' ? 'bike_taxi' : '',
      fromLocation: editedLocation || userLocationHint || '',
      toLocation: editedToLocation || '',
      tripType: nextMode === 'rent_vehicle' ? 'one_way' : '',
      urgency: 'today',
      estimatedWage: 600,
      suggestedTitle: textInput.trim().slice(0, 80) || 'Work Request',
      missingDetails: [],
      followUpQuestion: '',
      readyToPublish: true,
      replyText: '',
      photoAnalyzed: false,
      classificationSource: 'rule_based_fallback',
    };

    setAiResult({
      ...base,
      intent: nextMode,
      vehicleType: nextMode === 'rent_vehicle' ? (base.vehicleType || 'bike_taxi') : '',
      matchedCategory:
        nextMode === 'hire_worker'
          ? EMPLOYMENT_CATEGORIES.some((c) => c.en === base.matchedCategory)
            ? base.matchedCategory
            : 'Carpenters'
          : getVehicleTypeLabel(base.vehicleType || 'bike_taxi', lang),
    });
  };

  const quickExamples = [
    tr(
      lang,
      'Need a carpenter today for door fitting.',
      'मुझे दरवाजा फिट करने के लिए आज बढ़ई / सुतार चाहिए।',
      'मला आज दरवाजा बसवण्यासाठी सुतार पाहिजे.'
    ),
    tr(
      lang,
      'Need a Bike Taxi from Chandrapur station to Market',
      'चंद्रपुर स्टेशन से बाजार जाने के लिए बाइक टैक्सी चाहिए',
      'चंद्रपूर स्टेशनवरून बाजारात जाण्यासाठी बाईक टॅक्सी पाहिजे'
    ),
    tr(
      lang,
      'Need Chhota Hathi / Auto or Tempo in Nagpur',
      'नागपुर में सामान के लिए छोटा हाथी / ऑटो या टेम्पो चाहिए',
      'नागपूरमध्ये सामानासाठी छोटा हत्ती / ऑटो किंवा टेम्पो पाहिजे'
    ),
    tr(
      lang,
      'House wiring work, need an electrician urgently',
      'घर की वायरिंग के लिए तुरंत इलेक्ट्रीशियन चाहिए',
      'माझ्या घरातील वायरिंगचे काम करायचे आहे, इलेक्ट्रिशियन पाहिजे'
    ),
  ];

  const expandRadius = () => {
    if (searchRadiusKm === 25) setSearchRadiusKm(50);
    else if (searchRadiusKm === 50) setSearchRadiusKm(150);
    else setSearchRadiusKm(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ROJGAR SETU AI Voice and Photo Assistant"
    >
      <div className="w-full max-w-2xl bg-white rounded-t-xl sm:rounded-lg border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#0B3B75] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#E06D1B] sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E06D1B] flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold">
                {tr(
                  lang,
                  'Speak or Send Photo · AI Work & Local Transport Finder',
                  'बोलकर या फोटो से कामगार और लोकल ट्रांसपोर्ट खोजें',
                  'बोलून किंवा फोटो पाठवून कामगार व लोकल ट्रान्सपोर्ट शोधा'
                )}
              </h2>
              <p className="text-[11px] text-blue-100">
                {tr(
                  lang,
                  'Workers, Bike Taxi, Auto, Car, Trolley, Chhota Hathi & Tempo (No Heavy Trucks)',
                  'कामगार, बाइक टैक्सी, ऑटो, कार, ट्रॉली, छोटा हाथी व टेम्पो (ट्रक छोड़कर)',
                  'कामगार, बाईक टॅक्सी, ऑटो, कार, ट्रॉली, छोटा हत्ती व टेम्पो (ट्रक सोडून)'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudioPlayback();
              onClose();
            }}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded hover:bg-blue-800 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick Spoken / Text Examples */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {tr(lang, 'Tap an example or speak below:', 'उदाहरण चुनें या नीचे बोलें:', 'उदाहरण निवडा किंवा खाली बोला:')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickExamples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setTextInput(ex);
                    setClientRequestId(makeClientRequestId());
                  }}
                  className="text-left px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 hover:border-[#0B3B75] hover:bg-blue-50/40 text-xs text-slate-700 cursor-pointer"
                >
                  “{ex}”
                </button>
              ))}
            </div>
          </div>

          {/* Input Form: Mic + Photo + Editable Text */}
          <form onSubmit={handleSubmitAi} className="space-y-3 bg-[#F4F6F9] border border-slate-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#E06D1B] text-white text-xs sm:text-sm font-bold hover:bg-[#c55b10] transition-colors cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  {tr(lang, 'Start Speaking (Mic)', 'बोलना शुरू करें (माइक)', 'बोलणे सुरू करा (माईक)')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-red-600 text-white text-xs sm:text-sm font-bold animate-pulse cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  {tr(
                    lang,
                    `Stop Recording (${recordSeconds}s)`,
                    `रिकॉर्डिंग रोकें (${recordSeconds}s)`,
                    `रेकॉर्डिंग थांबवा (${recordSeconds}s)`
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#15803D]" />
                {tr(lang, 'Camera / Photo', 'फोटो / कैमरा', 'कॅमेरा / फोटो')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {speechSupported && isRecording && (
              <p className="text-[11px] font-medium text-[#0B3B75]">
                {tr(
                  lang,
                  'Live speech recognition active — spoken words will stay editable below.',
                  'लाइव वॉइस टाइपिंग सक्रिय — आपके शब्द नीचे संपादित किए जा सकेंगे।',
                  'थेट आवाज टायपिंग सुरू आहे — बोललेले शब्द खाली जतन होतील.'
                )}
              </p>
            )}

            {/* Recorded Audio / Photo Attachments Preview (Always Preserved on AI Failures) */}
            {(audioClip || photoData) && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {audioClip && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-amber-50 border border-amber-300 text-xs font-semibold text-amber-950">
                    <Mic className="w-3.5 h-3.5 text-[#E06D1B]" />
                    <span>
                      {tr(lang, 'Voice clip', 'आवाज़ रिकॉर्डिंग', 'आवाज रेकॉर्डिंग')} ({audioClip.seconds}s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudioClip(null)}
                      aria-label="Remove voice clip"
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {photoData && (
                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-white border border-slate-300 text-xs">
                    <img
                      src={photoData.previewUrl}
                      alt="Uploaded work item"
                      className="w-9 h-9 object-cover rounded"
                    />
                    <span className="font-semibold text-slate-700">
                      {tr(lang, 'Photo attached', 'फोटो संलग्न', 'फोटो जोडला')}
                    </span>
                    <button
                      type="button"
                      onClick={clearPhotoData}
                      aria-label="Remove photo"
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(
                  lang,
                  'Type or edit your request before sending:',
                  'भेजने से पहले अपना अनुरोध लिखें या सुधारें:',
                  'पाठवण्यापूर्वी तुमची विनंती टाइप करा किंवा तपासा:'
                )}
              </label>
              <textarea
                rows={2}
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  setClientRequestId(makeClientRequestId());
                }}
                placeholder={tr(
                  lang,
                  'e.g., "Need a carpenter today for door fitting" or "Need Auto from Chandrapur to Warora"',
                  'जैसे: "दरवाजा लगाने के लिए आज बढ़ई चाहिए" या "ऑटो किराए पर चाहिए"',
                  'उदा: "इलेक्ट्रिशियन पाहिजे" किंवा "चंद्रपूरसाठी बाईक टॅक्सी / ऑटो पाहिजे"'
                )}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>

            {formErrorMsg && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formErrorMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!textInput.trim() && !photoData) {
                    setFormErrorMsg(
                      tr(
                        lang,
                        'Enter your work or transport requirement above to search directly.',
                        'सीधे खोजने के लिए ऊपर काम या वाहन की आवश्यकता लिखें।',
                        'थेट शोधण्यासाठी वर कामाची किंवा वाहनाची माहिती टाइप करा.'
                      )
                    );
                    return;
                  }
                  runRuleBasedFallbackLocally(
                    textInput.trim(),
                    'SERVICE_UNAVAILABLE',
                    DEFAULT_FRIENDLY_AI_DOWN_MSG
                  );
                  setAiNotice((prev) => (prev ? { ...prev, dismissedForManual: true } : null));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                {tr(lang, 'Normal Search (No AI)', 'सामान्य सर्च से खोजें', 'सामान्य सर्चने शोधा')}
              </button>

              <button
                type="submit"
                disabled={loading || isRecording}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-[#072A54] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tr(lang, 'Understanding...', 'समझ रहे हैं...', 'समजून घेत आहे...')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {tr(lang, 'Find Workers / Vehicle', 'कामगार या गाड़ी खोजें', 'कामगार किंवा गाडी शोधा')}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Friendly AI Unavailable Banner with Retry + Continue Without AI (NO raw errors/503/JSON) */}
          {aiNotice && !aiNotice.dismissedForManual && (
            <div
              role="status"
              className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs sm:text-sm text-amber-950">
                  <p className="font-bold leading-snug">{aiNotice.userMessage}</p>
                  {aiNotice.type === 'QUOTA_EXHAUSTED' ? (
                    <p className="text-xs text-amber-900">
                      {tr(
                        lang,
                        'AI quota limit was temporarily reached. Normal database search is active below and your text/photo are preserved.',
                        'AI सीमा अस्थायी रूप से पूरी हो गई है। नीचे सामान्य डेटाबेस खोज चालू है और आपका टेक्स्ट/फोटो सुरक्षित है।',
                        'AI वापर मर्यादा तात्पुरती पूर्ण झाली आहे. खाली सामान्य डेटाबेस शोध सुरू आहे आणि तुमचा मजकूर/फोटो सुरक्षित आहे.'
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-900">
                      {tr(
                        lang,
                        'Normal keyword search & real database matching are active below. Your entered text and photo remain preserved.',
                        'नीचे सामान्य सर्च और वास्तविक डेटाबेस मिलान सक्रिय है। आपका लिखा संदेश और फोटो सुरक्षित हैं।',
                        'खाली सामान्य सर्च व प्रत्यक्ष डेटाबेस जुळणी सुरू आहे. तुमचा मजकूर व फोटो सुरक्षित ठेवले आहेत.'
                      )}
                    </p>
                  )}
                  {audioClip && !textInput.trim() && (
                    <p className="text-xs font-semibold text-[#0B3B75]">
                      {tr(
                        lang,
                        'Voice audio was recorded; please type a few keywords in the box above while AI voice transcription is unavailable.',
                        'आवाज़ रिकॉर्ड हुई है; AI उपलब्ध न होने के कारण कृपया ऊपर कुछ शब्द टाइप करें।',
                        'आवाज रेकॉर्ड झाला आहे; AI तात्पुरती बंद असल्याने कृपया वरील बॉक्समध्ये थोडक्यात टाइप करा.'
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void submitToAssistant()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {tr(lang, 'Retry AI', 'AI पुनः प्रयास करें', 'पुन्हा प्रयत्न करा (Retry)')}
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithoutAi}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#15803D] bg-white text-[#15803D] text-xs font-bold hover:bg-emerald-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {tr(lang, 'Continue Without AI', 'AI के बिना आगे बढ़ें', 'AI शिवाय पुढे जा (Continue Without AI)')}
                </button>
              </div>
            </div>
          )}

          {/* Classification & Live Database Matches */}
          {aiResult && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white space-y-4 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E06D1B]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                    {aiResult.intent === 'rent_vehicle'
                      ? tr(lang, 'Local Transport Detected', 'लोकल वाहन आवश्यकता', 'लोकल ट्रान्सपोर्ट गरज')
                      : tr(lang, 'Work Requirement Detected', 'कामगार आवश्यकता', 'कामगाराची गरज')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      aiResult.classificationSource === 'rule_based_fallback'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-blue-100 text-[#0B3B75]'
                    }`}
                  >
                    {aiResult.classificationSource === 'rule_based_fallback'
                      ? tr(lang, 'Normal Search Engine', 'सामान्य सर्च प्रणाली', 'सामान्य सर्च प्रणाली')
                      : aiResult.classificationSource === 'ai_backup'
                      ? `Backup AI (${aiResult.modelUsed || 'Flash-Lite'})`
                      : `AI (${aiResult.modelUsed || 'Gemini'})`}
                  </span>
                </div>

                {aiResult.replyText && (
                  <button
                    type="button"
                    disabled={ttsLoading}
                    onClick={() =>
                      isPlayingAudio ? stopAudioPlayback() : playTtsReply(aiResult.replyText)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-bold text-[#0B3B75] hover:bg-slate-100 cursor-pointer self-start sm:self-auto"
                  >
                    {isPlayingAudio ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-red-600" />
                        {tr(lang, 'Stop Voice', 'आवाज़ रोकें', 'आवाज थांबवा')}
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#15803D]" />
                        {ttsLoading
                          ? tr(lang, 'Loading voice...', 'आवाज़ लोड...', 'आवाज लोड...')
                          : tr(lang, 'Hear Reply', 'आवाज़ में सुनें', 'आवाजात ऐका')}
                      </>
                    )}
                  </button>
                )}
              </div>

              {aiResult.replyText && (
                <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-xs sm:text-sm text-slate-900 leading-relaxed">
                  {aiResult.replyText}
                </div>
              )}

              {/* Honest Photo Attachment Status */}
              {photoData && (
                <div
                  className={`flex items-center gap-3 p-2.5 rounded border text-xs ${
                    aiResult.photoAnalyzed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <img
                    src={photoData.previewUrl}
                    alt="Attached work reference"
                    className="w-11 h-11 object-cover rounded border border-slate-300 shrink-0"
                  />
                  <div>
                    <div className="font-bold">
                      {aiResult.photoAnalyzed
                        ? tr(lang, 'Photo analyzed by AI & attached', 'फोटो AI द्वारा जांचा गया और संलग्न है', 'फोटो AI ने तपासला असून जोडलेला आहे')
                        : tr(
                            lang,
                            'Photo saved & attached (not AI-analyzed)',
                            'फोटो अनुरोध के साथ सुरक्षित है (AI विश्लेषण नहीं हुआ)',
                            'फोटो विनंतीसोबत सुरक्षित जोडला आहे (AI तपासणी झाली नाही)'
                          )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {aiResult.photoAnalyzed
                        ? tr(lang, 'Your image will remain linked if you publish.', 'जॉब प्रकाशित करने पर यह फोटो जुड़ा रहेगा।', 'काम प्रकाशित केल्यावर हा फोटो सोबत जोडलेला राहील.')
                        : tr(
                            lang,
                            'AI visual inspection was unavailable, so the image has NOT been analyzed. It remains linked to your manual job request.',
                            'AI उपलब्ध न होने से फोटो का विश्लेषण नहीं किया गया है, लेकिन यह आपकी काम रिक्वेस्ट के साथ जुड़ा रहेगा।',
                            'AI उपलब्ध नसल्याने फोटोचे विश्लेषण केलेले नाही; मात्र तो तुमच्या काम विनंतीसोबत सुरक्षित जोडलेला राहील.'
                          )}
                    </p>
                  </div>
                </div>
              )}

              {/* Structured Classification Breakdown + Manual Mode Toggle & Editable Fields */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleManualSwitchMode('hire_worker')}
                  className={`px-3 py-1.5 rounded font-bold border cursor-pointer ${
                    aiResult.intent !== 'rent_vehicle'
                      ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {tr(lang, 'Worker Search', 'कामगार खोज', 'कामगार शोध')}
                </button>
                <button
                  type="button"
                  onClick={() => handleManualSwitchMode('rent_vehicle')}
                  className={`px-3 py-1.5 rounded font-bold border cursor-pointer ${
                    aiResult.intent === 'rent_vehicle'
                      ? 'bg-[#E06D1B] border-[#E06D1B] text-white'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {tr(lang, 'Local Transport (No Trucks)', 'लोकल वाहन (ट्रक छोड़कर)', 'लोकल ट्रान्सपोर्ट (ट्रक सोडून)')}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Category', 'श्रेणी', 'श्रेणी')}</div>
                  {aiResult.intent === 'rent_vehicle' ? (
                    <select
                      aria-label="Vehicle Type"
                      value={normalizeVehicleType(aiResult.vehicleType, textInput) || 'bike_taxi'}
                      onChange={(e) =>
                        setAiResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                vehicleType: e.target.value as VehicleType,
                                matchedCategory: getVehicleTypeLabel(e.target.value, lang),
                              }
                            : prev
                        )
                      }
                      className="mt-1 w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-[#0B3B75]"
                    >
                      {VEHICLE_TYPE_CATALOG.map((vt) => (
                        <option key={vt.value} value={vt.value}>
                          {lang === 'hi' ? vt.hi.split('(')[0].trim() : lang === 'mr' ? vt.mr.split('(')[0].trim() : vt.en.split('(')[0].trim()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      aria-label="Worker Category"
                      value={aiResult.matchedCategory}
                      onChange={(e) =>
                        setAiResult((prev) =>
                          prev ? { ...prev, matchedCategory: e.target.value } : prev
                        )
                      }
                      className="mt-1 w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-[#0B3B75]"
                    >
                      {EMPLOYMENT_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.en}>
                          {c.en}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Subcategory / Service', 'उप-श्रेणी / कार्य', 'उप-प्रकार / सेवा')}</div>
                  <div className="font-bold text-slate-800 mt-1 truncate">
                    {aiResult.subcategory || aiResult.requiredService || '—'}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">
                    {tr(lang, 'Location', 'स्थान', 'ठिकाण')}
                    {!editedLocation && (
                      <span className="text-amber-700 font-bold ml-1">*</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editedLocation}
                    onChange={(e) => setEditedLocation(e.target.value)}
                    placeholder={tr(lang, 'Enter city / town...', 'शहर / गाँव लिखें...', 'शहर / गाव टाका...')}
                    className={`mt-1 w-full px-2 py-1 rounded border text-xs font-semibold ${
                      !editedLocation ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>

                {aiResult.intent === 'rent_vehicle' ? (
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{tr(lang, 'Destination', 'गंतव्य', 'कुठे जायचे')}</div>
                    <input
                      type="text"
                      value={editedToLocation}
                      onChange={(e) => setEditedToLocation(e.target.value)}
                      placeholder={tr(lang, 'Drop point...', 'कहाँ जाना है...', 'कुठे जायचे...')}
                      className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">
                      {tr(lang, 'Workers Needed', 'कामगार संख्या', 'कामगार संख्या')}
                      {!editedWorkersCount && (
                        <span className="text-amber-700 font-bold ml-1">?</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={editedWorkersCount}
                      onChange={(e) => setEditedWorkersCount(e.target.value)}
                      placeholder={tr(lang, 'e.g. 1', 'जैसे 1', 'उदा. 1')}
                      className={`mt-1 w-full px-2 py-1 rounded border text-xs font-mono-tabular font-semibold ${
                        !editedWorkersCount ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Search Radius Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <span className="font-bold text-slate-700 inline-flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#0B3B75]" />
                  {tr(lang, 'Database Search Radius:', 'डेटाबेस खोज दायरा:', 'डेटाबेस शोध अंतर:')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { km: 25, label: '25 km' },
                    { km: 50, label: '50 km' },
                    { km: 150, label: '150 km' },
                    { km: 0, label: tr(lang, 'All India', 'पूरा भारत', 'संपूर्ण भारत') },
                  ].map((opt) => (
                    <button
                      key={opt.km}
                      type="button"
                      onClick={() => setSearchRadiusKm(opt.km)}
                      className={`px-2.5 py-1 rounded border text-xs font-bold cursor-pointer ${
                        searchRadiusKm === opt.km
                          ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real Registered Matching Results (NEVER fake data) */}
              {aiResult.intent === 'rent_vehicle' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3B75]">
                    {aiResult.vehicleType === 'bike_taxi' ? (
                      <Bike className="w-4 h-4 text-[#E06D1B]" />
                    ) : (
                      <Car className="w-4 h-4 text-[#E06D1B]" />
                    )}
                    <span>
                      {tr(lang, 'Registered Local Transport Available', 'पंजीकृत स्थानीय वाहन उपलब्ध', 'नोंदणीकृत लोकल वाहने')} (
                      {matchingVehiclesPreview.length})
                    </span>
                  </div>
                  {matchingVehiclesPreview.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {matchingVehiclesPreview.map(({ vehicle: v, distKm }) => (
                        <div key={v.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                          <div className="font-bold text-[#0B3B75] truncate">{v.vehicleTitle}</div>
                          <div className="text-slate-600 truncate">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {v.cityOrVillage}, {v.district}
                            {distKm !== null ? ` · ${distKm} km` : ''}
                          </div>
                          <div className="font-mono-tabular font-bold text-[#15803D]">
                            ₹{v.ratePerKm}/km · ₹{v.ratePerDay}/day
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-2">
                      <p className="font-semibold">
                        {tr(
                          lang,
                          `No registered ${getVehicleTypeLabel(aiResult.vehicleType || 'bike_taxi', 'en')} found${searchRadiusKm > 0 ? ` within ${searchRadiusKm} km` : ''}${effectiveLocation ? ` near ${effectiveLocation}` : ''}.`,
                          `${effectiveLocation ? `${effectiveLocation} के पास ` : ''}${searchRadiusKm > 0 ? `${searchRadiusKm} किमी के भीतर ` : ''}कोई पंजीकृत वाहन नहीं मिला।`,
                          `${effectiveLocation ? `${effectiveLocation} जवळ ` : ''}${searchRadiusKm > 0 ? `${searchRadiusKm} किमी मध्ये ` : ''}नोंदणीकृत वाहन सापडले नाही.`
                        )}
                      </p>
                      {searchRadiusKm > 0 && (
                        <button
                          type="button"
                          onClick={expandRadius}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-[#0B3B75] text-[#0B3B75] font-bold hover:bg-blue-50 cursor-pointer"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          {tr(lang, 'Expand Search Radius', 'खोज दायरा बढ़ाएँ', 'शोध अंतर वाढवा')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3B75]">
                    <Users className="w-4 h-4 text-[#15803D]" />
                    <span>
                      {tr(lang, 'Registered Matching Workers', 'पंजीकृत उपलब्ध कामगार', 'नोंदणीकृत जुळणारे कामगार')} (
                      {matchingWorkersPreview.length})
                    </span>
                  </div>
                  {matchingWorkersPreview.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {matchingWorkersPreview.map(({ worker: w, distKm }) => (
                        <div key={w.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                          <div className="font-bold text-[#0B3B75] truncate">{w.displayName}</div>
                          <div className="text-[#C25E00] truncate">{w.primarySkill}</div>
                          <div className="font-mono-tabular font-bold text-[#15803D]">
                            ₹{w.expectedWage}/{w.wageUnit} · {w.district}
                            {distKm !== null ? ` (${distKm} km)` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-2">
                      <p className="font-semibold">
                        {tr(
                          lang,
                          `No registered ${aiResult.matchedCategory} found${searchRadiusKm > 0 ? ` within ${searchRadiusKm} km` : ''}${effectiveLocation ? ` near ${effectiveLocation}` : ''}.`,
                          `${effectiveLocation ? `${effectiveLocation} के पास ` : ''}${searchRadiusKm > 0 ? `${searchRadiusKm} किमी के भीतर ` : ''}${aiResult.matchedCategory} वर्ग में कोई पंजीकृत कामगार नहीं मिला।`,
                          `${effectiveLocation ? `${effectiveLocation} जवळ ` : ''}${searchRadiusKm > 0 ? `${searchRadiusKm} किमी मध्ये ` : ''}${aiResult.matchedCategory} श्रेणीत नोंदणीकृत कामगार सापडले नाहीत.`
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {searchRadiusKm > 0 && (
                          <button
                            type="button"
                            onClick={expandRadius}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-[#0B3B75] text-[#0B3B75] font-bold hover:bg-blue-50 cursor-pointer"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            {tr(lang, 'Expand Search Radius', 'खोज दायरा बढ़ाएँ', 'शोध अंतर वाढवा (Expand Radius)')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleApplyAndOpenHire}
                  className="flex-1 py-3 px-4 rounded-md bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {aiResult.intent === 'rent_vehicle'
                      ? tr(lang, 'Open Local Transport & Book →', 'लोकल ट्रांसपोर्ट खोलें और बुक करें →', 'लोकल ट्रान्सपोर्ट उघडा व बुक करा →')
                      : tr(lang, 'Apply to Instant Hire & Book →', 'तुरंत हायर में लागू करें और बुक करें →', 'तात्काळ हायरमध्ये उघडा आणि बुक करा →')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {aiResult.intent !== 'rent_vehicle' && !publishedJobId && (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={handleDirectPublishConfirmedJob}
                    className="py-3 px-4 rounded-md bg-[#15803D] text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {publishing
                        ? tr(lang, 'Saving Request...', 'अनुरोध सहेजा जा रहा है...', 'विनंती जतन होत आहे...')
                        : tr(lang, 'Save & Publish Job Request', 'जॉब अनुरोध सहेजें व प्रकाशित करें', 'कामाची विनंती जतन व प्रकाशित करा')}
                    </span>
                  </button>
                )}
              </div>

              {publishedJobId && (
                <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                  {tr(
                    lang,
                    `Job request saved to database (ID: ${publishedJobId})${photoData ? ' with photo attachment' : ''} and matching worker alerts dispatched.`,
                    `काम अनुरोध डेटाबेस में सहेजा गया (ID: ${publishedJobId}) और कामगारों को सूचना भेजी गई।`,
                    `कामाची विनंती डेटाबेसमध्ये जतन झाली आहे (ID: ${publishedJobId}) आणि कामगारांना सूचना पाठवल्या आहेत.`
                  )}
                </div>
              )}

              {aiResult.followUpQuestion && !publishedJobId && (
                <form onSubmit={handleFollowUpSubmit} className="pt-2 border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder={aiResult.followUpQuestion}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                  <button
                    type="submit"
                    disabled={loading || !followUpInput.trim()}
                    className="px-3.5 py-2 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {tr(lang, 'Clarify', 'जवाब भेजें', 'उत्तर द्या')}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
