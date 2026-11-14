import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Camera,
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  Mic,
  Send,
  Sparkles,
  Square,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getVehicleTypeLabel } from '../data/vehicleTypes';
import { useLanguage } from '../i18n/LanguageContext';
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

interface AiAssistantResponse {
  transcript: string;
  intent: 'hire_worker' | 'rent_vehicle' | 'find_work' | 'general_help';
  matchedCategory: string;
  vehicleType: string;
  fromLocation: string;
  toLocation: string;
  tripType: string;
  urgency: string;
  suggestedTitle: string;
  replyText: string;
}

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

export const AIVoiceAssistantModal: React.FC<AIVoiceAssistantModalProps> = ({
  open,
  onClose,
  workers,
  vehicles,
  userLocationHint = '',
  onApplyPrefill,
}) => {
  const { lang } = useLanguage();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioClip, setAudioClip] = useState<{ base64: string; mimeType: string; seconds: number } | null>(null);
  const [photoData, setPhotoData] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiResult, setAiResult] = useState<AiAssistantResponse | null>(null);

  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const matchingWorkersPreview = useMemo(() => {
    if (!aiResult || aiResult.intent === 'rent_vehicle') return [];
    const catLower = (aiResult.matchedCategory || '').toLowerCase();
    const locLower = (aiResult.fromLocation || '').toLowerCase();
    return workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => {
        if (!catLower) return true;
        return (
          w.primarySkill.toLowerCase().includes(catLower) ||
          catLower.includes(w.primarySkill.toLowerCase()) ||
          w.skills.some((s) => catLower.includes(s.toLowerCase()) || s.toLowerCase().includes(catLower))
        );
      })
      .sort((a, b) => {
        const aLoc = locLower && (a.district.toLowerCase().includes(locLower) || a.cityOrVillage.toLowerCase().includes(locLower)) ? 1 : 0;
        const bLoc = locLower && (b.district.toLowerCase().includes(locLower) || b.cityOrVillage.toLowerCase().includes(locLower)) ? 1 : 0;
        if (aLoc !== bLoc) return bLoc - aLoc;
        return b.ratingAvg - a.ratingAvg;
      })
      .slice(0, 3);
  }, [aiResult, workers]);

  const matchingVehiclesPreview = useMemo(() => {
    if (!aiResult || aiResult.intent !== 'rent_vehicle') return [];
    const vType = normalizeVehicleType(aiResult.vehicleType, `${aiResult.transcript} ${textInput}`);
    const locLower = (aiResult.fromLocation || '').toLowerCase();
    return vehicles
      .filter((v) => v.verificationStatus !== 'suspended')
      .filter((v) => !vType || v.vehicleType === vType)
      .sort((a, b) => {
        const aLoc = locLower && (a.district.toLowerCase().includes(locLower) || a.cityOrVillage.toLowerCase().includes(locLower)) ? 1 : 0;
        const bLoc = locLower && (b.district.toLowerCase().includes(locLower) || b.cityOrVillage.toLowerCase().includes(locLower)) ? 1 : 0;
        if (aLoc !== bLoc) return bLoc - aLoc;
        return a.ratePerKm - b.ratePerKm;
      })
      .slice(0, 3);
  }, [aiResult, vehicles, textInput]);

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
      // Ignore autoplay errors silently; user can click Speak Reply button manually
    } finally {
      setTtsLoading(false);
    }
  };

  const startRecording = async () => {
    setErrorMsg('');
    stopAudioPlayback();
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(
        tr(
          lang,
          'Microphone recording is unavailable in this browser. Please type your request below.',
          'इस ब्राउज़र में माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे टाइप करें।',
          'या ब्राउझरमध्ये मायक्रोफोन उपलब्ध नाही. कृपया खाली टाइप करा.'
        )
      );
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
      setErrorMsg(
        tr(
          lang,
          'Microphone permission denied. Allow mic access or type your request.',
          'माइक्रोफ़ोन अनुमति अस्वीकृत। कृपया अनुमति दें या टाइप करें।',
          'मायक्रोफोन परवानगी नाकारली. परवानगी द्या किंवा खाली टाइप करा.'
        )
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg(
        tr(
          lang,
          'Photo must be under 6 MB.',
          'फोटो 6 MB से कम होना चाहिए।',
          'फोटो 6 MB पेक्षा लहान असावा.'
        )
      );
      return;
    }
    const base64 = await blobToBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoData({
      base64,
      mimeType: file.type || 'image/jpeg',
      previewUrl,
    });
    setErrorMsg('');
  };

  const handleSubmitAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() && !audioClip && !photoData) {
      setErrorMsg(
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
    setErrorMsg('');
    stopAudioPlayback();

    try {
      const res = await fetch('/api/ai/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput.trim(),
          audioBase64: audioClip?.base64 || '',
          audioMimeType: audioClip?.mimeType || 'audio/webm',
          imageBase64: photoData?.base64 || '',
          imageMimeType: photoData?.mimeType || 'image/jpeg',
          language: lang,
          userLocation: userLocationHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'AI Assistant could not process the request.');
        return;
      }

      const result = data as AiAssistantResponse;
      setAiResult(result);
      if (result.transcript && !textInput.trim()) {
        setTextInput(result.transcript);
      }
      if (result.replyText) {
        playTtsReply(result.replyText);
      }
    } catch {
      setErrorMsg(
        tr(
          lang,
          'Network error reaching AI assistant.',
          'AI सहायक से संपर्क करने में नेटवर्क त्रुटि।',
          'AI सहाय्यकाशी संपर्क साधताना नेटवर्क त्रुटी आली.'
        )
      );
    } finally {
      setLoading(false);
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
      vehicleType: isVehicle ? vType : '',
      fromLocation: aiResult.fromLocation,
      toLocation: aiResult.toLocation,
      tripType: normalizeTripType(aiResult.tripType),
      urgency:
        aiResult.urgency === 'tomorrow'
          ? 'tomorrow'
          : aiResult.urgency === 'scheduled'
          ? 'scheduled'
          : 'today',
      title: aiResult.suggestedTitle,
      note: aiResult.transcript || textInput,
      transcript: aiResult.transcript,
    });
    onClose();
  };

  const quickExamples = [
    tr(
      lang,
      'Need a carpenter today for door fitting',
      'मुझे दरवाजा फिट करने के लिए आज मिस्त्री चाहिए',
      'मला आज दरवाजा बसवण्यासाठी सुतार पाहिजे'
    ),
    tr(
      lang,
      'Need a Bike Taxi from Chandrapur station to Market',
      'चंद्रपुर स्टेशन से बाजार जाने के लिए बाइक टैक्सी चाहिए',
      'चंद्रपूर स्टेशनवरून बाजारात जाण्यासाठी बाईक टॅक्सी पाहिजे'
    ),
    tr(
      lang,
      'Need Chhota Hathi / Trolley for local goods shifting',
      'सामान ले जाने के लिए छोटा हाथी / ट्रॉली चाहिए',
      'सामान नेण्यासाठी छोटा हत्ती किंवा लोकल ट्रॉली पाहिजे'
    ),
    tr(
      lang,
      'House wiring work, need an electrician urgently',
      'घर की वायरिंग के लिए तुरंत इलेक्ट्रीशियन चाहिए',
      'माझ्या घरातील वायरिंगचे काम करायचे आहे, इलेक्ट्रिशियन पाहिजे'
    ),
  ];

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
                  'Workers, Bike Taxi, Auto, Car, Trolley & Tempo (No Heavy Trucks)',
                  'कामगार, बाइक टैक्सी, ऑटो, कार, ट्रॉली व टेम्पो (ट्रक छोड़कर)',
                  'कामगार, बाईक टॅक्सी, ऑटो, कार, ट्रॉली व टेम्पो (ट्रक सोडून)'
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
                  onClick={() => setTextInput(ex)}
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

            {/* Recorded Audio / Photo Attachments Preview */}
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
                      onClick={() => setPhotoData(null)}
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
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={tr(
                  lang,
                  'e.g., "Need a plumber for leaking pipe" or "Need Auto from Chandrapur to Warora tomorrow"',
                  'जैसे: "दरवाजा लगाने के लिए मिस्त्री चाहिए" या "ऑटो भाड़े पर चाहिए"',
                  'उदा: "इलेक्ट्रिशियन पाहिजे" किंवा "चंद्रपूरसाठी ऑटो भाड्याने पाहिजे"'
                )}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="flex justify-end">
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

          {/* AI Response & Live Matches */}
          {aiResult && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white space-y-4 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E06D1B]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                    {aiResult.intent === 'rent_vehicle'
                      ? tr(lang, 'Local Transport Detected', 'लोकल वाहन आवश्यकता पहचानी गई', 'लोकल ट्रान्सपोर्टची गरज ओळखली')
                      : tr(lang, 'Worker Requirement Detected', 'कामगार आवश्यकता पहचानी गई', 'कामगाराची गरज ओळखली')}
                  </span>
                </div>

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
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded p-3.5 text-sm text-slate-900 leading-relaxed">
                {aiResult.replyText}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Category', 'श्रेणी', 'श्रेणी')}</div>
                  <div className="font-bold text-[#0B3B75] mt-0.5 truncate">
                    {aiResult.vehicleType
                      ? getVehicleTypeLabel(
                          normalizeVehicleType(aiResult.vehicleType, `${aiResult.transcript} ${textInput}`) || aiResult.vehicleType,
                          lang
                        )
                      : aiResult.matchedCategory || 'General'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Location', 'स्थान', 'ठिकाण')}</div>
                  <div className="font-bold text-slate-800 mt-0.5 truncate">
                    {aiResult.fromLocation || userLocationHint || tr(lang, 'Near you', 'आपके पास', 'तुमच्या जवळ')}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Destination', 'गंतव्य', 'कुठे जायचे')}</div>
                  <div className="font-bold text-slate-800 mt-0.5 truncate">
                    {aiResult.toLocation || '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">{tr(lang, 'Timing', 'समय', 'वेळ')}</div>
                  <div className="font-bold text-[#15803D] mt-0.5 uppercase">
                    {aiResult.urgency || 'today'}
                  </div>
                </div>
              </div>

              {/* Matching Results Preview */}
              {aiResult.intent === 'rent_vehicle' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3B75]">
                    {aiResult.vehicleType === 'bike_taxi' ? (
                      <Bike className="w-4 h-4 text-[#E06D1B]" />
                    ) : (
                      <Car className="w-4 h-4 text-[#E06D1B]" />
                    )}
                    <span>
                      {tr(lang, 'Matching Local Transport Available', 'उपलब्ध स्थानीय वाहन', 'उपलब्ध लोकल वाहने')} (
                      {matchingVehiclesPreview.length})
                    </span>
                  </div>
                  {matchingVehiclesPreview.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {matchingVehiclesPreview.map((v) => (
                        <div key={v.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                          <div className="font-bold text-[#0B3B75] truncate">{v.vehicleTitle}</div>
                          <div className="text-slate-600 truncate">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {v.cityOrVillage}, {v.district}
                          </div>
                          <div className="font-mono-tabular font-bold text-[#15803D]">
                            ₹{v.ratePerKm}/km · ₹{v.ratePerDay}/day
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {tr(
                        lang,
                        'Proceed to Local Transport to view nearby Bike Taxi, Auto, Car, Trolley or Mini Tempo.',
                        'नजदीकी बाइक टैक्सी, ऑटो, कार, ट्रॉली या टेम्पो देखने के लिए आगे बढ़ें।',
                        'जवळची बाईक टॅक्सी, ऑटो, कार, ट्रॉली किंवा टेम्पो पाहण्यासाठी पुढे जा.'
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3B75]">
                    <Users className="w-4 h-4 text-[#15803D]" />
                    <span>
                      {tr(lang, 'Matching Workers Nearby', 'नजदीकी उपलब्ध कामगार', 'जवळचे उपलब्ध कामगार')} (
                      {matchingWorkersPreview.length})
                    </span>
                  </div>
                  {matchingWorkersPreview.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {matchingWorkersPreview.map((w) => (
                        <div key={w.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                          <div className="font-bold text-[#0B3B75] truncate">{w.displayName}</div>
                          <div className="text-[#C25E00] truncate">{w.primarySkill}</div>
                          <div className="font-mono-tabular font-bold text-[#15803D]">
                            ₹{w.expectedWage}/{w.wageUnit} · {w.district}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {tr(
                        lang,
                        'Apply this search in Instant Hire to view workers or broadcast an instant request.',
                        'तुरंत हायर में जाकर उपलब्ध कामगार देखें या तुरंत रिक्वेस्ट भेजें।',
                        'तात्काळ हायरमध्ये जाऊन कामगार पहा किंवा विनंती पाठवा.'
                      )}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyAndOpenHire}
                className="w-full py-3 px-4 rounded-md bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {aiResult.intent === 'rent_vehicle'
                    ? tr(lang, 'Open Local Transport & Book →', 'लोकल ट्रांसपोर्ट खोलें और बुक करें →', 'लोकल ट्रान्सपोर्ट उघडा व बुक करा →')
                    : tr(lang, 'Apply to Instant Hire & Book →', 'तुरंत हायर में लागू करें और बुक करें →', 'तात्काळ हायरमध्ये उघडा आणि बुक करा →')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
