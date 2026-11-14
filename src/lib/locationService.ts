import type { Language } from '../types/domain';
import { findNearestDistrict } from '../data/indiaLocations';

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
  source: 'google' | 'fallback';
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
      if (data.state || data.district || data.cityOrVillage) {
        return {
          lat,
          lng,
          state: data.state || '',
          district: data.district || '',
          cityOrVillage: data.cityOrVillage || data.district || '',
          formattedAddress: data.formattedAddress || data.cityOrVillage || '',
          postalCode: data.postalCode || '',
          source: 'google',
        };
      }
    }
  } catch {
    // Fallback below when offline or network error
  }

  const nearest = findNearestDistrict(lat, lng);
  return {
    lat,
    lng,
    state: nearest.state,
    district: nearest.district,
    cityOrVillage: nearest.district,
    formattedAddress: `${nearest.district}, ${nearest.state}`,
    source: 'fallback',
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
  if (data.lat && data.lng) {
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

/**
 * Collects multiple GPS/network fixes via watchPosition over up to 3.2s so desktop/mobile
 * browsers don't lock onto a stale or coarse initial Wi-Fi/IP cell reading.
 */
export function detectBestGpsLocation(lang: Language): Promise<ReverseGeoResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'));
      return;
    }

    let bestPos: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const finalize = async (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracyMeters = Math.round(pos.coords.accuracy || 0);
      const inIndia = isInsideIndiaBounds(lat, lng);

      const resolved = await reverseGeocodeCoords(lat, lng, lang);
      resolve({
        ...resolved,
        accuracyMeters,
        isApproximate: !inIndia || accuracyMeters > 3000,
      });
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // High-accuracy GPS/device fix obtained — resolve immediately
        if (pos.coords.accuracy <= 100) {
          void finalize(pos);
        }
      },
      (err) => {
        if (bestPos) {
          void finalize(bestPos);
        } else if (!settled) {
          settled = true;
          cleanup();
          reject(err);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 9000 }
    );

    timerId = setTimeout(() => {
      if (settled) return;
      if (bestPos) {
        void finalize(bestPos);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => void finalize(pos),
          (err) => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(err);
            }
          },
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
        );
      }
    }, 3200);
  });
}
