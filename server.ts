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

function getMapsApiKey(): string {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

interface GoogleGeoResultItem {
  placeId?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  postalAddress?: {
    regionCode?: string;
    administrativeArea?: string;
    locality?: string;
    sublocality?: string;
    postalCode?: string;
  };
}

function matchCuratedStateAndDistrict(
  rawState?: string,
  candidateDistricts?: string[],
  lat?: number,
  lng?: number
): { state: string; district: string } {
  const sNorm = (rawState || '').trim().toLowerCase();
  const matchedState = INDIA_STATES_DISTRICTS.find(
    (s) =>
      sNorm &&
      (s.name.toLowerCase() === sNorm ||
        s.name.toLowerCase().includes(sNorm) ||
        sNorm.includes(s.name.toLowerCase()))
  );

  const cleanCandidates = (candidateDistricts || [])
    .map((v) => (v || '').trim())
    .filter((v) => v && !/\bdivision\b/i.test(v))
    .map((v) => v.toLowerCase().replace(/\s+district$/i, '').trim())
    .filter(Boolean);

  if (matchedState) {
    // 1. Exact district name match across all non-division candidates
    for (const term of cleanCandidates) {
      const exact = matchedState.districts.find(
        (d) =>
          d.name.toLowerCase() === term ||
          d.name.toLowerCase().split('(')[0].trim() === term
      );
      if (exact) return { state: matchedState.name, district: exact.name };
    }

    // 2. Partial match on curated districts (never matching division strings)
    for (const term of cleanCandidates) {
      if (term.length < 3) continue;
      const fuzzy = matchedState.districts.find((d) => {
        const base = d.name.toLowerCase().split('(')[0].trim();
        return base === term || d.name.toLowerCase().includes(term) || term.includes(base);
      });
      if (fuzzy) return { state: matchedState.name, district: fuzzy.name };
    }

    // 3. Coordinate fallback constrained to matchedState (maps Talukas like Warora -> Chandrapur)
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      let bestDist = matchedState.districts[0];
      let bestKm = Number.POSITIVE_INFINITY;
      for (const dist of matchedState.districts) {
        const km = calculateDistanceKm(lat, lng, dist.lat, dist.lng);
        if (km < bestKm) {
          bestKm = km;
          bestDist = dist;
        }
      }
      if (bestDist) return { state: matchedState.name, district: bestDist.name };
    }

    return {
      state: matchedState.name,
      district: matchedState.districts[0]?.name || '',
    };
  }

  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    const nearest = findNearestDistrict(lat, lng);
    if (nearest.isWithinIndiaBounds) {
      return { state: nearest.state, district: nearest.district };
    }
  }

  return {
    state: rawState || '',
    district: (candidateDistricts || []).find((v) => v && !/\bdivision\b/i.test(v)) || '',
  };
}

function extractGoogleGeoFields(
  results: GoogleGeoResultItem[],
  primary: GoogleGeoResultItem,
  lat: number,
  lng: number
) {
  const getCompFrom = (item: GoogleGeoResultItem, typeName: string) =>
    item.addressComponents?.find((c) => c.types?.includes(typeName))?.longText || '';

  const allFromType = (typeName: string) =>
    results.map((r) => getCompFrom(r, typeName)).filter(Boolean);

  const countryCode =
    primary.postalAddress?.regionCode ||
    results.map((r) => r.addressComponents?.find((c) => c.types?.includes('country'))?.shortText).find(Boolean) ||
    '';

  const rawState =
    primary.postalAddress?.administrativeArea ||
    allFromType('administrative_area_level_1')[0] ||
    '';

  const candidateDistricts = [
    ...allFromType('administrative_area_level_3'),
    ...allFromType('administrative_area_level_2'),
    ...results.map((r) => r.postalAddress?.locality || '').filter(Boolean),
    ...allFromType('locality'),
  ];

  const sublocality =
    primary.postalAddress?.sublocality ||
    allFromType('sublocality_level_1')[0] ||
    allFromType('sublocality')[0] ||
    '';
  const locality =
    primary.postalAddress?.locality ||
    allFromType('locality')[0] ||
    allFromType('administrative_area_level_3')[0] ||
    '';
  const postalCode =
    primary.postalAddress?.postalCode ||
    allFromType('postal_code')[0] ||
    '';

  const curated = matchCuratedStateAndDistrict(rawState, candidateDistricts, lat, lng);

  const cityOrVillage =
    (sublocality && locality && sublocality.toLowerCase() !== locality.toLowerCase()
      ? `${sublocality}, ${locality}`
      : locality || sublocality) || curated.district;

  return {
    countryCode,
    formattedAddress: primary.formattedAddress || `${cityOrVillage}, ${curated.district}, ${curated.state}`,
    locality: locality || sublocality || curated.district,
    cityOrVillage,
    district: curated.district,
    state: curated.state || rawState,
    postalCode,
    lat,
    lng,
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
    const otpConfig = getOtpPublicConfig();
    res.json({
      mapsApiKey,
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

  // Google Maps Geocoding API v4 Reverse Proxy (handles CORS & attribution header)
  app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'INVALID_COORDINATES' });
      return;
    }

    const isWithinIndiaBounds = lat >= 6.0 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
    const apiKey = getMapsApiKey();

    if (apiKey) {
      try {
        const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
        url.searchParams.append('location.latitude', String(lat));
        url.searchParams.append('location.longitude', String(lng));
        url.searchParams.append('languageCode', lang === 'hi' || lang === 'mr' ? lang : 'en');

        const gRes = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.addressComponents,results.postalAddress,results.types',
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          },
        });

        if (gRes.status === 429) {
          const fallback = findNearestDistrict(lat, lng);
          res.json({
            source: 'fallback',
            quotaExceeded: true,
            isWithinIndiaBounds: fallback.isWithinIndiaBounds,
            formattedAddress: fallback.isWithinIndiaBounds
              ? `${fallback.district}, ${fallback.state}`
              : 'Outside India (VPN/Proxy detected)',
            locality: fallback.isWithinIndiaBounds ? fallback.district : '',
            state: fallback.isWithinIndiaBounds ? fallback.state : '',
            district: fallback.isWithinIndiaBounds ? fallback.district : '',
            lat,
            lng,
          });
          return;
        }

        if (gRes.ok) {
          const data = (await gRes.json()) as { results?: GoogleGeoResultItem[] };
          const results = data.results || [];
          const first = results[0];
          if (first) {
            const parsed = extractGoogleGeoFields(results, first, lat, lng);
            res.json({
              source: 'google_geocoding_v4',
              isWithinIndiaBounds: parsed.countryCode === 'IN' || isWithinIndiaBounds,
              ...parsed,
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Reverse geocode API v4 error, using district fallback:', err);
      }
    }

    const nearest = findNearestDistrict(lat, lng);
    res.json({
      source: 'fallback',
      isWithinIndiaBounds: nearest.isWithinIndiaBounds,
      formattedAddress: nearest.isWithinIndiaBounds
        ? `${nearest.district}, ${nearest.state}`
        : 'Outside India (VPN/Proxy detected)',
      locality: nearest.isWithinIndiaBounds ? nearest.district : '',
      district: nearest.isWithinIndiaBounds ? nearest.district : '',
      state: nearest.isWithinIndiaBounds ? nearest.state : '',
      lat,
      lng,
    });
  });

  // Google Maps Geocoding API v4 Forward Address Search Proxy
  app.get('/api/geocode/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';
    if (q.length < 2) {
      res.status(400).json({ error: 'QUERY_TOO_SHORT' });
      return;
    }

    const apiKey = getMapsApiKey();
    if (apiKey) {
      try {
        const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(q)}`);
        url.searchParams.append('regionCode', 'IN');
        url.searchParams.append('languageCode', lang === 'hi' || lang === 'mr' ? lang : 'en');

        const gRes = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress,results.addressComponents,results.postalAddress',
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          },
        });

        if (gRes.status === 429) {
          res.status(429).json({ error: 'QUOTA_EXCEEDED' });
          return;
        }

        if (gRes.ok) {
          const data = (await gRes.json()) as { results?: GoogleGeoResultItem[] };
          const validResults = (data.results || []).filter(
            (r) => r.location?.latitude !== undefined && r.location?.longitude !== undefined
          );
          if (validResults.length > 0) {
            const candidates = validResults.slice(0, 5).map((item) => {
              const itemLat = Number(item.location!.latitude);
              const itemLng = Number(item.location!.longitude);
              const parsed = extractGoogleGeoFields([item], item, itemLat, itemLng);
              return {
                formattedAddress: parsed.formattedAddress,
                locality: parsed.locality,
                cityOrVillage: parsed.cityOrVillage,
                district: parsed.district,
                state: parsed.state,
                postalCode: parsed.postalCode,
                lat: parsed.lat,
                lng: parsed.lng,
              };
            });
            const top = candidates[0];
            res.json({
              source: 'google_geocoding_v4',
              ...top,
              candidates,
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Forward geocode API v4 error:', err);
      }
    }

    // Curated India district fuzzy match fallback
    const qLower = q.toLowerCase();
    const fallbackCandidates: Array<{
      formattedAddress: string;
      locality: string;
      cityOrVillage: string;
      district: string;
      state: string;
      postalCode: string;
      lat: number;
      lng: number;
    }> = [];

    for (const st of INDIA_STATES_DISTRICTS) {
      for (const dist of st.districts) {
        if (
          dist.name.toLowerCase().includes(qLower) ||
          qLower.includes(dist.name.toLowerCase().split('(')[0].trim())
        ) {
          fallbackCandidates.push({
            formattedAddress: `${dist.name}, ${st.name}`,
            locality: dist.name,
            cityOrVillage: dist.name,
            district: dist.name,
            state: st.name,
            postalCode: '',
            lat: dist.lat,
            lng: dist.lng,
          });
        }
      }
      if (fallbackCandidates.length === 0 && st.name.toLowerCase().includes(qLower)) {
        const firstDist = st.districts[0];
        fallbackCandidates.push({
          formattedAddress: `${firstDist.name}, ${st.name}`,
          locality: firstDist.name,
          cityOrVillage: firstDist.name,
          district: firstDist.name,
          state: st.name,
          postalCode: '',
          lat: firstDist.lat,
          lng: firstDist.lng,
        });
      }
    }

    if (fallbackCandidates.length > 0) {
      const top = fallbackCandidates[0];
      res.json({
        source: 'curated_directory',
        ...top,
        candidates: fallbackCandidates.slice(0, 5),
      });
      return;
    }

    res.status(404).json({ error: 'LOCATION_NOT_FOUND', message: 'City or district not found. Try a major town or district name.' });
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
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
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
