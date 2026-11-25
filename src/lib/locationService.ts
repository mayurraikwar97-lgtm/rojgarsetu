import type { Language } from '../types/domain';
import { findNearestDistrict } from '../data/indiaLocations';

export type GeoErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INSECURE_CONTEXT'
  | 'GEOLOCATION_UNSUPPORTED'
  | 'UNKNOWN';

export class GeolocationDetectionError extends Error {
  readonly code: GeoErrorCode;
  readonly rawCode?: number;

  constructor(code: GeoErrorCode, message: string, rawCode?: number) {
    super(message);
    this.name = 'GeolocationDetectionError';
    this.code = code;
    this.rawCode = rawCode;
  }
}

export interface ReverseGeoResult {
  lat: number;
  lng: number;
  state: string;
  district: string;
  cityOrVillage: string;
  formattedAddress: string;
  postalCode?: string;
  accuracyMeters?: number;
  isApproximate?: boolean;
  source: 'google' | 'fallback' | 'coords_only';
}

export interface GeoSearchCandidate {
  lat: number;
  lng: number;
  state: string;
  district: string;
  cityOrVillage: string;
  formattedAddress: string;
  postalCode?: string;
}

export function isInsideIndiaBounds(lat: number, lng: number): boolean {
  return lat >= 6.0 && lat <= 38.0 && lng >= 67.0 && lng <= 98.0;
}

export function formatCoordinatesLabel(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

export function classifyGeolocationErrorCode(err: unknown): GeoErrorCode {
  if (err instanceof GeolocationDetectionError) {
    return err.code;
  }
  const obj = err && typeof err === 'object' ? (err as { code?: unknown; message?: unknown }) : null;
  const rawCode = typeof obj?.code === 'number' ? obj.code : Number(obj?.code);
  const rawMsg = (
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : typeof obj?.message === 'string'
          ? obj.message
          : ''
  ).toLowerCase();

  if (rawMsg.includes('insecure_context') || rawMsg.includes('only secure origins')) {
    return 'INSECURE_CONTEXT';
  }
  if (rawMsg.includes('geolocation_unsupported') || rawMsg.includes('not supported')) {
    return 'GEOLOCATION_UNSUPPORTED';
  }
  if (rawCode === 1 || rawMsg.includes('permission_denied') || rawMsg.includes('user denied') || rawMsg.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  if (rawCode === 2 || rawMsg.includes('position_unavailable') || rawMsg.includes('location unavailable') || rawMsg.includes('gps')) {
    return 'POSITION_UNAVAILABLE';
  }
  if (rawCode === 3 || rawMsg.includes('timeout') || rawMsg.includes('timed out')) {
    return 'TIMEOUT';
  }
  return 'UNKNOWN';
}

export function formatGeolocationError(
  err: unknown,
  lang: Language
): { code: GeoErrorCode; message: string } {
  const code = classifyGeolocationErrorCode(err);

  const pick = (en: string, hi: string, mr: string) =>
    lang === 'mr' ? mr : lang === 'hi' ? hi : en;

  switch (code) {
    case 'PERMISSION_DENIED':
      return {
        code,
        message: pick(
          'Location permission was denied. Please tap the lock/site icon in your browser address bar, set Location to "Allow", and tap "Get My Current Location" again — or enter your City, Area, and 6-digit PIN code manually below.',
          'लोकेशन की अनुमति अस्वीकार कर दी गई है। कृपया ब्राउज़र के एड्रेस बार में लॉक/साइट आइकन पर टैप करके Location को "Allow" करें और फिर से "मेरा वर्तमान स्थान प्राप्त करें" दबाएँ — या नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'लोकेशनची परवानगी नाकारली गेली आहे. कृपया ब्राउझरच्या अ‍ॅड्रेस बारमधील लॉक/साइट चिन्हावर टॅप करून Location ला "Allow" करा आणि पुन्हा "माझे सध्याचे लोकेशन मिळवा" दाबा — किंवा खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
    case 'POSITION_UNAVAILABLE':
      return {
        code,
        message: pick(
          'Unable to detect your GPS position right now. Please make sure your phone/device GPS (Location Services) is turned ON and retry — or enter your City, Area, and 6-digit PIN code manually below.',
          'अभी आपकी GPS लोकेशन प्राप्त नहीं हो सकी। कृपया सुनिश्चित करें कि आपके फ़ोन/डिवाइस की GPS (लोकेशन सेवा) चालू है और पुनः प्रयास करें — या नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'सध्या तुमचे GPS लोकेशन मिळू शकले नाही. कृपया तुमच्या मोबाईल/डिव्हाइसचा GPS (Location) सुरू असल्याची खात्री करा आणि पुन्हा प्रयत्न करा — किंवा खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
    case 'TIMEOUT':
      return {
        code,
        message: pick(
          'GPS location request timed out (indoor signal may be weak). Please step near a window or tap "Get My Current Location" again — or enter your City, Area, and 6-digit PIN code manually below.',
          'GPS लोकेशन प्राप्त करने में समय समाप्त हो गया (अंदर सिग्नल कमज़ोर हो सकता है)। कृपया फिर से "मेरा वर्तमान स्थान प्राप्त करें" दबाएँ — या नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'GPS लोकेशन मिळण्यासाठी लागणारा वेळ संपला (घरात सिग्नल कमकुवत असू शकतो). कृपया पुन्हा "माझे सध्याचे लोकेशन मिळवा" दाबा — किंवा खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
    case 'INSECURE_CONTEXT':
      return {
        code,
        message: pick(
          'GPS requires a secure HTTPS connection. Please open ROJGAR SETU over HTTPS or enter your City, Area, and 6-digit PIN code manually below.',
          'GPS के लिए सुरक्षित HTTPS कनेक्शन आवश्यक है। कृपया रोजगार सेतु को HTTPS पर खोलें या नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'GPS साठी सुरक्षित HTTPS कनेक्शन आवश्यक आहे. कृपया रोजगार सेतू HTTPS वर उघडा किंवा खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
    case 'GEOLOCATION_UNSUPPORTED':
      return {
        code,
        message: pick(
          'Your browser does not support GPS geolocation. Please enter your City, Area, and 6-digit PIN code manually below.',
          'आपका ब्राउज़र GPS लोकेशन का समर्थन नहीं करता है। कृपया नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'तुमचा ब्राउझर GPS लोकेशनला समर्थन देत नाही. कृपया खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
    default:
      return {
        code,
        message: pick(
          'Could not detect your current location automatically. Please retry "Get My Current Location" or enter your City, Area, and 6-digit PIN code manually below.',
          'आपकी वर्तमान लोकेशन अपने आप पता नहीं लग सकी। कृपया "मेरा वर्तमान स्थान प्राप्त करें" पुनः दबाएँ या नीचे अपना शहर, क्षेत्र और 6 अंकों का पिनकोड मैन्युअल रूप से दर्ज करें।',
          'तुमचे सध्याचे लोकेशन आपोआप शोधता आले नाही. कृपया "माझे सध्याचे लोकेशन मिळवा" पुन्हा दाबा किंवा खाली तुमचे शहर, परिसर आणि ६ अंकी पिनकोड स्वतः टाका.'
        ),
      };
  }
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
  lang: Language
): Promise<ReverseGeoResult> {
  try {
    const res = await fetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&lang=${lang}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.state || data.district || data.cityOrVillage || data.formattedAddress) {
        return {
          lat,
          lng,
          state: data.state || '',
          district: data.district || '',
          cityOrVillage: data.cityOrVillage || data.locality || data.district || '',
          formattedAddress:
            data.formattedAddress ||
            [data.cityOrVillage || data.locality, data.district, data.state].filter(Boolean).join(', ') ||
            formatCoordinatesLabel(lat, lng),
          postalCode: data.postalCode || '',
          source: data.source === 'google_geocoding_v4' ? 'google' : 'fallback',
        };
      }
    }
  } catch {
    // Graceful fallback below when offline or reverse geocode service is unreachable
  }

  const nearest = findNearestDistrict(lat, lng);
  if (nearest.isWithinIndiaBounds) {
    return {
      lat,
      lng,
      state: nearest.state,
      district: nearest.district,
      cityOrVillage: nearest.district,
      formattedAddress: `${nearest.district}, ${nearest.state}`,
      postalCode: '',
      source: 'fallback',
    };
  }

  return {
    lat,
    lng,
    state: '',
    district: '',
    cityOrVillage: '',
    formattedAddress: formatCoordinatesLabel(lat, lng),
    postalCode: '',
    source: 'coords_only',
  };
}

export async function searchLocations(
  query: string,
  lang: Language
): Promise<GeoSearchCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await fetch(
    `/api/geocode/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Location search failed');
  }
  const data = await res.json();
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    return data.candidates as GeoSearchCandidate[];
  }
  if (typeof data.lat === 'number' && typeof data.lng === 'number') {
    return [
      {
        lat: Number(data.lat),
        lng: Number(data.lng),
        state: data.state || '',
        district: data.district || '',
        cityOrVillage: data.cityOrVillage || data.district || trimmed,
        formattedAddress: data.formattedAddress || trimmed,
        postalCode: data.postalCode || '',
      },
    ];
  }
  return [];
}

function requestSingleBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function isSecureGeolocationOrigin(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext === true) return true;
  const host = window.location?.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return true;
  }
  return window.location?.protocol === 'https:';
}

/**
 * Reliable, user-gesture-safe browser geolocation across Android Chrome, iOS Safari, and Desktop:
 * 1. Verifies navigator.geolocation support and HTTPS secure context.
 * 2. Calls getCurrentPosition directly inside the click call stack with high-accuracy settings
 *    (enableHighAccuracy: true, timeout: 15000, maximumAge: 30000) — never races a premature timer
 *    against the browser permission prompt.
 * 3. Immediately surfaces PERMISSION_DENIED without hiding it or faking coordinates.
 * 4. If high-accuracy GPS returns POSITION_UNAVAILABLE or TIMEOUT (e.g. indoor signal), performs
 *    one clean network-assisted fallback (enableHighAccuracy: false, timeout: 12000, maximumAge: 60000).
 * 5. Reverse-geocodes the genuine coordinates and returns exact lat, lng, accuracy, address, and PIN.
 */
export async function detectBestGpsLocation(lang: Language): Promise<ReverseGeoResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeolocationDetectionError(
      'GEOLOCATION_UNSUPPORTED',
      formatGeolocationError('GEOLOCATION_UNSUPPORTED', lang).message
    );
  }

  if (!isSecureGeolocationOrigin()) {
    throw new GeolocationDetectionError(
      'INSECURE_CONTEXT',
      formatGeolocationError('INSECURE_CONTEXT', lang).message
    );
  }

  let position: GeolocationPosition;
  try {
    position = await requestSingleBrowserPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  } catch (primaryErr) {
    const primaryCode = classifyGeolocationErrorCode(primaryErr);
    const primaryRawCode =
      primaryErr && typeof primaryErr === 'object' && 'code' in primaryErr
        ? Number((primaryErr as { code?: unknown }).code)
        : undefined;

    // Never retry or swallow PERMISSION_DENIED — user explicitly denied or browser blocked it
    if (primaryCode === 'PERMISSION_DENIED') {
      throw new GeolocationDetectionError(
        'PERMISSION_DENIED',
        formatGeolocationError(primaryErr, lang).message,
        primaryRawCode ?? 1
      );
    }

    // For POSITION_UNAVAILABLE or TIMEOUT (common indoors or on desktop), try one network-assisted fix
    try {
      position = await requestSingleBrowserPosition({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    } catch (fallbackErr) {
      const finalCode = classifyGeolocationErrorCode(fallbackErr);
      const finalRawCode =
        fallbackErr && typeof fallbackErr === 'object' && 'code' in fallbackErr
          ? Number((fallbackErr as { code?: unknown }).code)
          : primaryRawCode;
      const effectiveCode = finalCode === 'UNKNOWN' ? primaryCode : finalCode;
      throw new GeolocationDetectionError(
        effectiveCode,
        formatGeolocationError(effectiveCode, lang).message,
        finalRawCode
      );
    }
  }

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GeolocationDetectionError(
      'POSITION_UNAVAILABLE',
      formatGeolocationError('POSITION_UNAVAILABLE', lang).message,
      2
    );
  }

  const accuracyMeters = Number.isFinite(position.coords.accuracy)
    ? Math.round(position.coords.accuracy)
    : undefined;
  const inIndia = isInsideIndiaBounds(lat, lng);

  const resolved = await reverseGeocodeCoords(lat, lng, lang);
  return {
    ...resolved,
    lat,
    lng,
    accuracyMeters,
    isApproximate: !inIndia || (typeof accuracyMeters === 'number' && accuracyMeters > 3000),
  };
}
