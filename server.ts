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
import { registerNotificationRoutes } from './src/server/notificationsEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const OTP_SECRET =
  process.env.OTP_HMAC_SECRET ||
  (() => {
    if (IS_PROD) {
      console.warn('SECURITY NOTICE: OTP_HMAC_SECRET is not set; using ephemeral per-process HMAC secret.');
    }
    return crypto.randomBytes(32).toString('hex');
  })();

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

const otpChallengeStates = new Map<string, { attempts: number; used: boolean; expiresAt: number }>();
const MAX_OTP_VERIFY_ATTEMPTS = 5;

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

interface OtpPayload {
  jti: string;
  mobile: string;
  otpHash: string;
  expiresAt: number;
}

function signOtpPayload(payload: OtpPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', OTP_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyOtpToken(token: string): OtpPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', OTP_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OtpPayload;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'rojgar-setu', timestamp: new Date().toISOString() });
  });

  app.get('/api/public-config', (_req: Request, res: Response) => {
    const mapsApiKey = getMapsApiKey();
    res.json({
      mapsApiKey,
      smsGatewayConfigured: Boolean(process.env.SMS_PROVIDER_API_KEY && process.env.SMS_GATEWAY_WEBHOOK_URL),
    });
  });

  registerNotificationRoutes(app, __dirname);

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

  // Server-Side Gemini AI Voice & Photo Job / Vehicle Assistant
  app.post('/api/ai/voice-assistant', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkEndpointRateLimit(`ai:${clientIp}`, 25, 5 * 60 * 1000)) {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many AI assistant requests. Please wait a few minutes and try again.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_NOT_CONFIGURED',
        message: 'Gemini AI key is not configured on the server.',
      });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
    const audioMimeType = typeof req.body?.audioMimeType === 'string' ? req.body.audioMimeType : 'audio/webm';
    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
    const imageMimeType = typeof req.body?.imageMimeType === 'string' ? req.body.imageMimeType : 'image/jpeg';
    const language = req.body?.language === 'hi' || req.body?.language === 'mr' ? req.body.language : 'en';
    const userLocation = typeof req.body?.userLocation === 'string' ? req.body.userLocation.trim() : '';
    const conversationContext = typeof req.body?.conversationContext === 'string' ? req.body.conversationContext.trim().slice(0, 1200) : '';

    if (!text && !audioBase64 && !imageBase64) {
      res.status(400).json({ error: 'EMPTY_REQUEST', message: 'Speak, type a request, or attach a photo.' });
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
          mimeType: imageMimeType,
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

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `You are ROJGAR SETU's friendly Indian workforce, Bike Taxi, and Local Transport AI assistant.
Understand natural Hindi, Marathi, English, or mixed Hinglish speech, text, and work/damage photos (e.g., broken door -> Carpenters, electrical panel -> Electricians, leaking tap -> Plumbers, Chandrapur to Nagpur bike/auto/car/trolley/tempo -> rent_vehicle).
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
Always set intent='rent_vehicle' when the user asks for a Bike Taxi, Auto, Car, Cab, SUV, Trolley, E-Loader, Chhota Hathi, Pickup Tempo, or Tractor (e.g., 'बाईक', 'ऑटो', 'कार', 'ट्रॉली', 'छोटी गाडी', 'टेम्पो', 'गाडी भाड्याने'). Set intent='hire_worker' when asking for a worker/mistri/labourer/plumber/electrician/driver-only.
If location, destination (for transport), or key timing/wage detail is missing, list them briefly in missingDetails and ask a short clarifying question in followUpQuestion and replyText. Set readyToPublish=true when the core skill/vehicle and location are clear.
Return concise, practical JSON.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING, description: 'Clear transcription or summary of what user requested.' },
              intent: { type: Type.STRING, description: 'One of: hire_worker, rent_vehicle, find_work, general_help' },
              matchedCategory: { type: Type.STRING, description: 'Exact category from available worker categories, or Bike Taxi / Local Transport.' },
              vehicleType: { type: Type.STRING, description: 'One of: bike_taxi, auto_rickshaw, car_sedan, suv_innova, trolley_cart, mini_tempo, pickup_tempo, tractor, or empty string.' },
              fromLocation: { type: Type.STRING, description: 'Starting city, district, or work location if mentioned.' },
              toLocation: { type: Type.STRING, description: 'Destination city/place if trip/ride mentioned, else empty.' },
              tripType: { type: Type.STRING, description: 'One of: one_way, round_trip, hourly, full_day, or empty.' },
              urgency: { type: Type.STRING, description: 'One of: today, tomorrow, scheduled' },
              estimatedWage: { type: Type.NUMBER, description: 'Suggested daily wage or fare in INR (0 if unspecified).' },
              suggestedTitle: { type: Type.STRING, description: 'Short 4-8 word booking/job title.' },
              followUpQuestion: { type: Type.STRING, description: 'Short clarifying question if location, timing, or destination is missing, else empty string.' },
              readyToPublish: { type: Type.BOOLEAN, description: 'True if enough details exist to summarize and confirm publishing.' },
              replyText: { type: Type.STRING, description: 'Helpful 2-3 sentence spoken/text reply summarizing detected requirement and asking any missing detail.' },
            },
            required: ['transcript', 'intent', 'matchedCategory', 'vehicleType', 'fromLocation', 'toLocation', 'tripType', 'urgency', 'estimatedWage', 'suggestedTitle', 'followUpQuestion', 'readyToPublish', 'replyText'],
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      console.error('Gemini AI voice assistant error:', err);
      const message = err instanceof Error ? err.message : 'AI assistant error';
      res.status(500).json({ error: 'AI_ASSISTANT_ERROR', message });
    }
  });

  // Server-Side Gemini Text-to-Speech (gemini-3.8-flash-lite-tts)
  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkEndpointRateLimit(`tts:${clientIp}`, 30, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many voice playback requests.' });
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

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
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
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(500).json({ error: 'NO_AUDIO_RETURNED' });
        return;
      }

      res.json({ audioBase64, mimeType: 'audio/wav' });
    } catch (err) {
      console.error('Gemini TTS error:', err);
      res.status(500).json({ error: 'TTS_ERROR', message: err instanceof Error ? err.message : 'TTS failed' });
    }
  });

  app.post('/api/otp/request', async (req: Request, res: Response) => {
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim().replace(/\s+/g, '') : '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ error: 'INVALID_MOBILE', message: 'Enter a valid 10-digit Indian mobile number.' });
      return;
    }

    const clientIp = getClientIp(req);
    if (
      !checkEndpointRateLimit(`otp-req-ip:${clientIp}`, 12, 10 * 60 * 1000) ||
      !checkEndpointRateLimit(`otp-req-mob:${mobile}`, 5, 10 * 60 * 1000)
    ) {
      res.status(429).json({
        error: 'OTP_RATE_LIMITED',
        message: 'Too many OTP requests. Please wait a few minutes before requesting another code.',
      });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const jti = crypto.randomBytes(12).toString('hex');
    const otpHash = crypto.createHmac('sha256', OTP_SECRET).update(`${jti}:${mobile}:${otp}`).digest('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const challengeToken = signOtpPayload({ jti, mobile, otpHash, expiresAt });

    const now = Date.now();
    for (const [k, st] of otpChallengeStates.entries()) {
      if (st.expiresAt < now) otpChallengeStates.delete(k);
    }
    otpChallengeStates.set(jti, { attempts: 0, used: false, expiresAt });

    const smsApiKey = (process.env.SMS_PROVIDER_API_KEY || '').trim();
    const smsWebhookUrl = (process.env.SMS_GATEWAY_WEBHOOK_URL || '').trim();

    if (smsApiKey) {
      if (!smsWebhookUrl) {
        res.status(503).json({
          error: 'SMS_GATEWAY_NOT_CONFIGURED',
          message: 'SMS_PROVIDER_API_KEY is present, but SMS_GATEWAY_WEBHOOK_URL transport endpoint is not configured.',
        });
        return;
      }
      try {
        const smsRes = await fetch(smsWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${smsApiKey}`,
          },
          body: JSON.stringify({
            to: `+91${mobile}`,
            message: `Your ROJGAR SETU verification OTP is ${otp}. Valid for 5 minutes.`,
          }),
        });
        if (!smsRes.ok) {
          res.status(502).json({
            error: 'SMS_DISPATCH_FAILED',
            message: 'Configured SMS provider failed to deliver OTP.',
          });
          return;
        }
        res.json({
          mode: 'sms_gateway',
          challengeToken,
          expiresInSeconds: 300,
        });
        return;
      } catch {
        res.status(502).json({
          error: 'SMS_DISPATCH_FAILED',
          message: 'Unable to reach configured SMS gateway.',
        });
        return;
      }
    }

    res.json({
      mode: 'sandbox_preview',
      challengeToken,
      previewOtp: otp,
      expiresInSeconds: 300,
    });
  });

  app.post('/api/otp/verify', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkEndpointRateLimit(`otp-ver-ip:${clientIp}`, 20, 10 * 60 * 1000)) {
      res.status(429).json({
        verified: false,
        error: 'OTP_RATE_LIMITED',
        message: 'Too many OTP verification attempts. Please wait a few minutes.',
      });
      return;
    }

    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim().replace(/\s+/g, '') : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';

    if (!mobile || !otp || !challengeToken) {
      res.status(400).json({ verified: false, error: 'MISSING_FIELDS', message: 'Mobile, OTP, and challenge token are required.' });
      return;
    }

    const payload = verifyOtpToken(challengeToken);
    if (!payload || !payload.jti) {
      res.status(400).json({ verified: false, error: 'INVALID_TOKEN', message: 'Invalid OTP session. Please request a new code.' });
      return;
    }

    if (Date.now() > payload.expiresAt) {
      otpChallengeStates.delete(payload.jti);
      res.status(400).json({ verified: false, error: 'OTP_EXPIRED', message: 'OTP expired. Please request a new code.' });
      return;
    }

    if (payload.mobile !== mobile) {
      res.status(400).json({ verified: false, error: 'MOBILE_MISMATCH', message: 'Mobile number does not match the OTP request.' });
      return;
    }

    const state = otpChallengeStates.get(payload.jti);
    if (state?.used) {
      res.status(400).json({ verified: false, error: 'INVALID_TOKEN', message: 'This OTP has already been used. Request a new code.' });
      return;
    }
    if (state && state.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      res.status(429).json({
        verified: false,
        error: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect OTP attempts. Please request a new code.',
      });
      return;
    }

    const attemptHash = crypto.createHmac('sha256', OTP_SECRET).update(`${payload.jti}:${mobile}:${otp}`).digest('hex');
    const attemptBuf = Buffer.from(attemptHash, 'hex');
    const storedBuf = Buffer.from(payload.otpHash, 'hex');
    if (attemptBuf.length !== storedBuf.length || !crypto.timingSafeEqual(attemptBuf, storedBuf)) {
      const nextAttempts = (state?.attempts ?? 0) + 1;
      otpChallengeStates.set(payload.jti, {
        attempts: nextAttempts,
        used: false,
        expiresAt: payload.expiresAt,
      });
      if (nextAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        res.status(429).json({
          verified: false,
          error: 'OTP_ATTEMPTS_EXCEEDED',
          message: 'Maximum OTP attempts exceeded. Please request a new code.',
        });
        return;
      }
      res.status(400).json({
        verified: false,
        error: 'INCORRECT_OTP',
        message: `Incorrect OTP. ${MAX_OTP_VERIFY_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
      });
      return;
    }

    otpChallengeStates.set(payload.jti, {
      attempts: state?.attempts ?? 0,
      used: true,
      expiresAt: payload.expiresAt,
    });

    res.json({
      verified: true,
      mobile,
      verifiedAt: new Date().toISOString(),
    });
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
