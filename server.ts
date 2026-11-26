import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { EMPLOYMENT_CATEGORIES } from './src/data/categories.ts';
import { calculateDistanceKm, findNearestDistrict, INDIA_STATES_DISTRICTS } from './src/data/indiaLocations.ts';
import { classifyRequestRuleBased } from './src/lib/aiFallbackClassifier.ts';
import { registerNotificationRoutes } from './src/server/notificationsEngine.ts';
import { registerAdsAndReferralsRoutes } from './src/server/adsAndReferralsEngine.ts';
import { registerPrivacyAndCallRoutes } from './src/server/privacyAndCallEngine.ts';
import { registerPaymentAndFinanceRoutes } from './src/server/paymentReferralEngine.ts';
import { getOtpPublicConfig, handleOtpRequest, handleOtpVerify } from './src/server/otpEngine.ts';
import { getMapsApiKey, handleGeocodeReverse, handleGeocodeSearch } from './src/server/geocodeEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const ipRateBuckets = new Map<string, number[]>();
function checkEndpointRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (ipRateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    ipRateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  ipRateBuckets.set(key, recent);
  if (ipRateBuckets.size > 5000) {
    for (const [k, list] of ipRateBuckets.entries()) {
      if (list.length === 0 || now - list[list.length - 1] > windowMs) {
        ipRateBuckets.delete(k);
      }
    }
  }
  return true;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : '';
  return (raw || req.ip || 'unknown').trim();
}

const SUPPORTED_TEXT_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const SUPPORTED_TTS_MODELS = new Set(['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']);
const PROHIBITED_DEPRECATED_MODEL_RE = /gemini-1\.5|gemini-2\.0|^gemini-pro$/i;

const FRIENDLY_AI_UNAVAILABLE_MSG =
  'AI सेवा सध्या तात्पुरती उपलब्ध नाही. काळजी करू नका! आम्ही तुमची कामाची मागणी सामान्य सर्च प्रणालीद्वारे शोधण्याचा प्रयत्न करत आहोत.';

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveGeminiTextModels(): { primary: string; backup: string | null } {
  const rawPrimary = (process.env.GEMINI_PRIMARY_MODEL || 'gemini-4-hydrogen').trim();
  const rawBackup = (process.env.GEMINI_BACKUP_MODEL || 'gemini-3.1-flash-lite').trim();

  const primary =
    SUPPORTED_TEXT_MODELS.has(rawPrimary) && !PROHIBITED_DEPRECATED_MODEL_RE.test(rawPrimary)
      ? rawPrimary
      : 'gemini-4-hydrogen';

  if (rawPrimary !== primary) {
    console.warn(`Unsupported/deprecated GEMINI_PRIMARY_MODEL "${rawPrimary}" ignored; using "${primary}".`);
  }

  let backup: string | null = null;
  if (rawBackup && rawBackup !== primary) {
    if (SUPPORTED_TEXT_MODELS.has(rawBackup) && !PROHIBITED_DEPRECATED_MODEL_RE.test(rawBackup)) {
      backup = rawBackup;
    } else {
      console.warn(`Unsupported/deprecated GEMINI_BACKUP_MODEL "${rawBackup}" skipped.`);
    }
  }

  return { primary, backup };
}

function resolveGeminiTtsModel(): string {
  const raw = (process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts').trim();
  return SUPPORTED_TTS_MODELS.has(raw) ? raw : 'gemini-3.8-flash-lite-tts';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('AI_REQUEST_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface ClassifiedGeminiError {
  status: number;
  isQuotaExhausted: boolean;
  isAuthOrKeyError: boolean;
  isModelNotFound: boolean;
  isRetryable: boolean;
  shortCode: string;
}

function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const rawObj = (err && typeof err === 'object' ? err : {}) as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  const msg = (err instanceof Error ? err.message : String(rawObj.message || err || '')).toLowerCase();
  const statusMatch = msg.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  const numericStatus =
    typeof rawObj.status === 'number'
      ? rawObj.status
      : typeof rawObj.code === 'number'
      ? rawObj.code
      : statusMatch
      ? Number(statusMatch[1])
      : 500;

  const isAuthOrKeyError =
    numericStatus === 401 ||
    numericStatus === 403 ||
    /api_key_invalid|permission_denied|invalid api key/.test(msg);

  const isHardQuota =
    /quota|billing|free\s*tier.*exceeded|exceeded\s+your\s+current\s+quota/.test(msg) ||
    (/resource_exhausted/.test(msg) && /quota|daily|plan/.test(msg));

  const isQuotaExhausted = numericStatus === 429 && isHardQuota;
  const isModelNotFound = numericStatus === 404 || /not_found|model.*not\s*found/.test(msg);

  const isRetryable =
    !isAuthOrKeyError &&
    !isQuotaExhausted &&
    (numericStatus === 503 ||
      numericStatus === 429 ||
      numericStatus >= 500 ||
      /unavailable|high demand|overloaded|ai_request_timeout|etimedout|econnreset|fetch failed|rate/.test(msg));

  const shortCode = isQuotaExhausted
    ? 'QUOTA_EXHAUSTED'
    : isAuthOrKeyError
    ? 'AUTH_CONFIG_ERROR'
    : isModelNotFound
    ? 'MODEL_NOT_FOUND'
    : numericStatus === 503 || /unavailable|high demand/.test(msg)
    ? 'MODEL_UNAVAILABLE_503'
    : msg.includes('ai_request_timeout')
    ? 'TIMEOUT'
    : `ERR_${numericStatus}`;

  return {
    status: numericStatus,
    isQuotaExhausted,
    isAuthOrKeyError,
    isModelNotFound,
    isRetryable,
    shortCode,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(
    express.json({
      limit: '15mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'rojgar-setu',
      otp: getOtpPublicConfig(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/public-config', (_req: Request, res: Response) => {
    const mapsApiKey = getMapsApiKey();
    const firebaseVapidKey = (process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim();
    const otpConfig = getOtpPublicConfig();
    res.json({
      mapsApiKey,
      firebaseVapidKey,
      smsGatewayConfigured: otpConfig.smsProviderConfigured,
      otp: otpConfig,
    });
  });

  app.get('/api/otp/config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getOtpPublicConfig());
  });

  registerNotificationRoutes(app, __dirname);
  registerAdsAndReferralsRoutes(app, __dirname);
  registerPrivacyAndCallRoutes(app, __dirname);
  registerPaymentAndFinanceRoutes(app, __dirname);

  // Google Maps Geocoding API v4 Reverse Proxy (shared with Vercel api/platform.ts)
  app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';
    const out = await handleGeocodeReverse({ lat, lng, lang });
    res.status(out.httpStatus).json(out.payload);
  });

  // Google Maps Geocoding API v4 Forward Address Search Proxy (shared with Vercel api/platform.ts)
  app.get('/api/geocode/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';
    const out = await handleGeocodeSearch({ q, lang });
    res.status(out.httpStatus).json(out.payload);
  });

  // Server-Side Gemini AI Voice & Photo Job / Vehicle Assistant with Retry, Backup Model & Rule-Based Fallback
  app.post('/api/ai/voice-assistant', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 1500) : '';
    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
    const rawAudioMime = typeof req.body?.audioMimeType === 'string' ? req.body.audioMimeType : 'audio/webm';
    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
    const rawImageMime = typeof req.body?.imageMimeType === 'string' ? req.body.imageMimeType : 'image/jpeg';
    const language = req.body?.language === 'hi' || req.body?.language === 'mr' ? req.body.language : 'en';
    const userLocation = typeof req.body?.userLocation === 'string' ? req.body.userLocation.trim().slice(0, 120) : '';
    const conversationContext = typeof req.body?.conversationContext === 'string' ? req.body.conversationContext.trim().slice(0, 1200) : '';

    if (!text && !audioBase64 && !imageBase64) {
      res.status(400).json({ error: 'EMPTY_REQUEST', message: 'Speak, type a request, or attach a photo.' });
      return;
    }

    if (audioBase64.length > 11_000_000 || imageBase64.length > 11_000_000) {
      res.status(400).json({ error: 'MEDIA_TOO_LARGE', message: 'Attached audio or photo exceeds the 8 MB limit.' });
      return;
    }

    const allowedAudioMimes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']);
    const allowedImageMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const normalizedAudioMime = rawAudioMime.split(';')[0].trim().toLowerCase();
    const normalizedImageMime = rawImageMime.split(';')[0].trim().toLowerCase();

    if (audioBase64 && !allowedAudioMimes.has(normalizedAudioMime)) {
      res.status(400).json({ error: 'INVALID_MEDIA_TYPE', message: 'Unsupported audio format.' });
      return;
    }
    if (imageBase64 && !allowedImageMimes.has(normalizedImageMime)) {
      res.status(400).json({ error: 'INVALID_MEDIA_TYPE', message: 'Unsupported image format. Please use JPG, PNG, or WebP.' });
      return;
    }

    const audioMimeType = normalizedAudioMime || 'audio/webm';
    const imageMimeType = normalizedImageMime || 'image/jpeg';

    const buildFallbackPayload = () =>
      classifyRequestRuleBased({
        text,
        language,
        userLocationHint: userLocation,
        hasPhoto: Boolean(imageBase64),
      });

    if (!checkEndpointRateLimit(`ai:${clientIp}`, 25, 5 * 60 * 1000)) {
      res.status(429).json({
        aiUnavailable: true,
        errorType: 'QUOTA_EXHAUSTED',
        userMessage: FRIENDLY_AI_UNAVAILABLE_MSG,
        fallbackClassification: buildFallbackPayload(),
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn('[AI Assistant] GEMINI_API_KEY not configured; returning rule-based fallback.');
      res.status(503).json({
        aiUnavailable: true,
        errorType: 'NOT_CONFIGURED',
        userMessage: FRIENDLY_AI_UNAVAILABLE_MSG,
        fallbackClassification: buildFallbackPayload(),
      });
      return;
    }

    const categoryNames = EMPLOYMENT_CATEGORIES.map((c) => c.en).join(', ');
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType === 'image/jpg' ? 'image/jpeg' : imageMimeType,
          data: imageBase64,
        },
      });
    }

    const promptText = [
      conversationContext ? `Previous conversation context:\n${conversationContext}` : '',
      text ? `User input: "${text}"` : 'Analyze the attached voice recording and/or photo.',
      userLocation ? `User current location hint: "${userLocation}"` : '',
      `Respond naturally in ${language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English'} (or match the spoken language if clearly Hindi/Marathi/English).`,
    ]
      .filter(Boolean)
      .join('\n');
    parts.push({ text: promptText });

    const systemInstruction = `You are ROJGAR SETU's friendly Indian workforce, Bike Taxi, and Local Transport AI assistant.
Understand natural Hindi, Marathi, English, or mixed Hinglish speech, text, and work/damage photos (e.g., broken door -> Carpenters / Door Fitting, electrical panel -> Electricians, leaking tap -> Plumbers, Chandrapur to Nagpur bike/auto/car/trolley/tempo -> rent_vehicle).
Available worker categories: ${categoryNames}.
Available local transport vehicle types (NO heavy highway trucks):
- bike_taxi (Bike Taxi / Two-Wheeler rider for 1 passenger or small urgent parcel)
- auto_rickshaw (Auto Rickshaw)
- car_sedan (Car / Sedan / Hatchback)
- suv_innova (SUV / Innova / Bolero 6-7 seater)
- trolley_cart (Hand Trolley / E-Rickshaw Loader / Pedal Cart for local bazaar shifting)
- mini_tempo (Small Goods Tempo / Chhota Hathi / Tata Ace)
- pickup_tempo (Medium-Large Local Goods / Bolero Pickup / 407 Tempo, local only)
- tractor (Tractor + Trolley for local sand/brick/farm shifting)
Always set intent='rent_vehicle' when the user asks for a Bike Taxi, Auto, Car, Cab, SUV, Trolley, E-Loader, Chhota Hathi, Pickup Tempo, or Tractor. Set intent='hire_worker' when asking for a worker/mistri/labourer/plumber/electrician/carpenter/driver-only.
Also populate subcategory (e.g. 'Door Fitting', 'House Wiring', 'Pipe & Tap Repair') and requiredService (e.g. 'Door installation'), plus workersRequired (integer if mentioned or 0 if unspecified).
If location, destination (for transport), or workersRequired is missing, ask a short clarifying question in followUpQuestion and replyText. Set readyToPublish=true when the core skill/vehicle and location are clear.
Return concise, practical JSON.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        transcript: { type: Type.STRING, description: 'Clear transcription or summary of what user requested.' },
        intent: { type: Type.STRING, description: 'One of: hire_worker, rent_vehicle, find_work, general_help' },
        matchedCategory: { type: Type.STRING, description: 'Exact category from available worker categories, or Bike Taxi / Local Transport.' },
        subcategory: { type: Type.STRING, description: 'Specific subcategory such as Door Fitting, House Wiring, or empty string.' },
        requiredService: { type: Type.STRING, description: 'Concise description of required service e.g. Door installation.' },
        workersRequired: { type: Type.NUMBER, description: 'Number of workers requested (0 if not specified).' },
        vehicleType: { type: Type.STRING, description: 'One of: bike_taxi, auto_rickshaw, car_sedan, suv_innova, trolley_cart, mini_tempo, pickup_tempo, tractor, or empty string.' },
        fromLocation: { type: Type.STRING, description: 'Starting city, district, or work location if mentioned.' },
        toLocation: { type: Type.STRING, description: 'Destination city/place if trip/ride mentioned, else empty.' },
        tripType: { type: Type.STRING, description: 'One of: one_way, round_trip, hourly, full_day, or empty.' },
        urgency: { type: Type.STRING, description: 'One of: today, tomorrow, scheduled' },
        estimatedWage: { type: Type.NUMBER, description: 'Suggested daily wage or fare in INR (0 if unspecified).' },
        suggestedTitle: { type: Type.STRING, description: 'Short 4-8 word booking/job title.' },
        followUpQuestion: { type: Type.STRING, description: 'Short clarifying question if location, timing, workers count, or destination is missing, else empty string.' },
        readyToPublish: { type: Type.BOOLEAN, description: 'True if enough details exist to summarize and confirm publishing.' },
        replyText: { type: Type.STRING, description: 'Helpful 2-3 sentence spoken/text reply summarizing detected requirement and asking any missing detail.' },
      },
      required: [
        'transcript',
        'intent',
        'matchedCategory',
        'subcategory',
        'requiredService',
        'workersRequired',
        'vehicleType',
        'fromLocation',
        'toLocation',
        'tripType',
        'urgency',
        'estimatedWage',
        'suggestedTitle',
        'followUpQuestion',
        'readyToPublish',
        'replyText',
      ],
    };

    const { primary, backup } = resolveGeminiTextModels();
    const invokeModelWithRetry = async (modelName: string, maxAttempts: number) => {
      const thinkingLevel = modelName === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      let lastClassified: ClassifiedGeminiError | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: { parts },
              config: {
                thinkingConfig: { thinkingLevel },
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
              },
            }),
            12000
          );
          const raw = (response.text || '{}').trim();
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return { ok: true as const, parsed };
        } catch (err) {
          lastClassified = classifyGeminiError(err);
          console.warn(
            `[AI Assistant] Model=${modelName} attempt=${attempt}/${maxAttempts} failed code=${lastClassified.shortCode}`
          );
          if (!lastClassified.isRetryable || attempt >= maxAttempts) {
            break;
          }
          const backoffMs = Math.min(2500, 450 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150));
          await sleep(backoffMs);
        }
      }
      return { ok: false as const, error: lastClassified! };
    };

    const primaryRes = await invokeModelWithRetry(primary, 3);
    if (primaryRes.ok) {
      res.json({
        ...primaryRes.parsed,
        aiStatus: 'ok',
        classificationSource: 'ai_primary',
        modelUsed: primary,
        photoAnalyzed: Boolean(imageBase64),
      });
      return;
    }

    // Try verified backup Gemini model when primary fails (except auth/key config errors or hard exhausted key quota)
    let finalErr = primaryRes.error;
    if (backup && !primaryRes.error.isAuthOrKeyError && !primaryRes.error.isQuotaExhausted) {
      console.warn(`[AI Assistant] Switching to verified backup model "${backup}" after ${primary} failed.`);
      const backupRes = await invokeModelWithRetry(backup, 2);
      if (backupRes.ok) {
        res.json({
          ...backupRes.parsed,
          aiStatus: 'ok',
          classificationSource: 'ai_backup',
          modelUsed: backup,
          photoAnalyzed: Boolean(imageBase64),
        });
        return;
      }
      finalErr = backupRes.error;
    }

    const errorType = finalErr.isQuotaExhausted
      ? 'QUOTA_EXHAUSTED'
      : finalErr.isAuthOrKeyError
      ? 'NOT_CONFIGURED'
      : 'SERVICE_UNAVAILABLE';

    console.error(`[AI Assistant] All AI models failed (${errorType}: ${finalErr.shortCode}). Serving rule-based fallback.`);
    res.status(errorType === 'QUOTA_EXHAUSTED' ? 429 : 503).json({
      aiUnavailable: true,
      errorType,
      userMessage: FRIENDLY_AI_UNAVAILABLE_MSG,
      fallbackClassification: buildFallbackPayload(),
    });
  });

  // Server-Side Gemini Text-to-Speech with Retry & Graceful Handling
  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkEndpointRateLimit(`tts:${clientIp}`, 30, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Voice playback temporarily busy.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED' });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 600) : '';
    if (!text) {
      res.status(400).json({ error: 'MISSING_TEXT' });
      return;
    }

    const ttsModel = resolveGeminiTtsModel();
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: ttsModel,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text,
                    speechMetadata: {
                      style: 'Warm, clear, helpful Indian service assistant',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
          }),
          10000
        );

        const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) {
          res.status(503).json({ error: 'NO_AUDIO_RETURNED' });
          return;
        }

        res.json({ audioBase64, mimeType: 'audio/wav' });
        return;
      } catch (err) {
        const classified = classifyGeminiError(err);
        console.warn(`[AI TTS] Model=${ttsModel} attempt=${attempt}/2 failed code=${classified.shortCode}`);
        if (!classified.isRetryable || attempt >= 2) {
          res.status(classified.isQuotaExhausted ? 429 : 503).json({
            error: classified.isQuotaExhausted ? 'QUOTA_EXHAUSTED' : 'TTS_UNAVAILABLE',
            message: 'Voice playback is temporarily unavailable.',
          });
          return;
        }
        await sleep(400);
      }
    }
  });

  app.post('/api/otp/request', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await handleOtpRequest(req.body as Record<string, unknown>, getClientIp(req));
    res.status(result.status).json(result.body);
  });

  app.post('/api/otp/verify', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await handleOtpVerify(req.body as Record<string, unknown>, getClientIp(req));
    res.status(result.status).json(result.body);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const enableHmr = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr ? { server: httpServer } : false,
        ...(enableHmr ? {} : { ws: false }),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ROJGAR SETU server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
