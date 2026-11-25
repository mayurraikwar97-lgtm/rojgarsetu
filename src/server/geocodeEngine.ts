import { calculateDistanceKm, findNearestDistrict, INDIA_STATES_DISTRICTS } from '../data/indiaLocations.js';

export interface GoogleGeoResultItem {
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

export interface GeocodeEngineResponse {
  httpStatus: number;
  payload: Record<string, unknown>;
}

export function getMapsApiKey(): string {
  return (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

export function matchCuratedStateAndDistrict(
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
    for (const term of cleanCandidates) {
      const exact = matchedState.districts.find(
        (d) =>
          d.name.toLowerCase() === term ||
          d.name.toLowerCase().split('(')[0].trim() === term
      );
      if (exact) return { state: matchedState.name, district: exact.name };
    }

    for (const term of cleanCandidates) {
      if (term.length < 3) continue;
      const fuzzy = matchedState.districts.find((d) => {
        const base = d.name.toLowerCase().split('(')[0].trim();
        return base === term || d.name.toLowerCase().includes(term) || term.includes(base);
      });
      if (fuzzy) return { state: matchedState.name, district: fuzzy.name };
    }

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

export function extractGoogleGeoFields(
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

export async function handleGeocodeReverse(params: {
  lat: number;
  lng: number;
  lang?: string;
}): Promise<GeocodeEngineResponse> {
  const { lat, lng } = params;
  const lang = params.lang === 'hi' || params.lang === 'mr' ? params.lang : 'en';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { httpStatus: 400, payload: { error: 'INVALID_COORDINATES' } };
  }

  const isWithinIndiaBounds = lat >= 6.0 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
  const apiKey = getMapsApiKey();

  if (apiKey) {
    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
      url.searchParams.append('location.latitude', String(lat));
      url.searchParams.append('location.longitude', String(lng));
      url.searchParams.append('languageCode', lang);

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
        return {
          httpStatus: 200,
          payload: {
            source: 'fallback',
            quotaExceeded: true,
            isWithinIndiaBounds: fallback.isWithinIndiaBounds,
            formattedAddress: fallback.isWithinIndiaBounds
              ? `${fallback.district}, ${fallback.state}`
              : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            locality: fallback.isWithinIndiaBounds ? fallback.district : '',
            cityOrVillage: fallback.isWithinIndiaBounds ? fallback.district : '',
            state: fallback.isWithinIndiaBounds ? fallback.state : '',
            district: fallback.isWithinIndiaBounds ? fallback.district : '',
            postalCode: '',
            lat,
            lng,
          },
        };
      }

      if (gRes.ok) {
        const data = (await gRes.json()) as { results?: GoogleGeoResultItem[] };
        const results = data.results || [];
        const first = results[0];
        if (first) {
          const parsed = extractGoogleGeoFields(results, first, lat, lng);
          return {
            httpStatus: 200,
            payload: {
              source: 'google_geocoding_v4',
              isWithinIndiaBounds: parsed.countryCode === 'IN' || isWithinIndiaBounds,
              ...parsed,
            },
          };
        }
      }
    } catch (err) {
      console.warn('Reverse geocode API v4 error, using district fallback:', err);
    }
  }

  const nearest = findNearestDistrict(lat, lng);
  return {
    httpStatus: 200,
    payload: {
      source: 'fallback',
      isWithinIndiaBounds: nearest.isWithinIndiaBounds,
      formattedAddress: nearest.isWithinIndiaBounds
        ? `${nearest.district}, ${nearest.state}`
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      locality: nearest.isWithinIndiaBounds ? nearest.district : '',
      cityOrVillage: nearest.isWithinIndiaBounds ? nearest.district : '',
      district: nearest.isWithinIndiaBounds ? nearest.district : '',
      state: nearest.isWithinIndiaBounds ? nearest.state : '',
      postalCode: '',
      lat,
      lng,
    },
  };
}

export async function handleGeocodeSearch(params: {
  q: string;
  lang?: string;
}): Promise<GeocodeEngineResponse> {
  const q = (params.q || '').trim();
  const lang = params.lang === 'hi' || params.lang === 'mr' ? params.lang : 'en';

  if (q.length < 2) {
    return { httpStatus: 400, payload: { error: 'QUERY_TOO_SHORT' } };
  }

  const apiKey = getMapsApiKey();
  if (apiKey) {
    try {
      const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(q)}`);
      url.searchParams.append('regionCode', 'IN');
      url.searchParams.append('languageCode', lang);

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
        return { httpStatus: 429, payload: { error: 'QUOTA_EXCEEDED' } };
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
          return {
            httpStatus: 200,
            payload: {
              source: 'google_geocoding_v4',
              ...top,
              candidates,
            },
          };
        }
      }
    } catch (err) {
      console.warn('Forward geocode API v4 error:', err);
    }
  }

  // Fallback for 6-digit Indian PIN codes if Google Geocoding API key is absent/unavailable
  const pinMatch = q.match(/\b(\d{6})\b/);
  if (pinMatch) {
    const cleanPin = pinMatch[1];
    try {
      const pRes = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (pRes.ok) {
        const pData = (await pRes.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ Name?: string; Block?: string; District?: string; State?: string }>;
        }>;
        const offices = pData?.[0]?.Status === 'Success' ? pData[0].PostOffice || [] : [];
        if (offices.length > 0) {
          const primaryOffice = offices[0];
          const curated = matchCuratedStateAndDistrict(
            primaryOffice.State || '',
            [primaryOffice.District || '', primaryOffice.Block || '', primaryOffice.Name || '']
          );
          const matchedStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === curated.state);
          const matchedDistObj =
            matchedStateObj?.districts.find((d) => d.name === curated.district) ||
            matchedStateObj?.districts[0];
          if (matchedDistObj) {
            const localityName = primaryOffice.Name || primaryOffice.Block || curated.district;
            const topCandidate = {
              formattedAddress: `${localityName}, ${curated.district}, ${curated.state} ${cleanPin}`,
              locality: localityName,
              cityOrVillage: localityName,
              district: curated.district,
              state: curated.state,
              postalCode: cleanPin,
              lat: matchedDistObj.lat,
              lng: matchedDistObj.lng,
            };
            return {
              httpStatus: 200,
              payload: {
                source: 'india_post_pincode_fallback',
                ...topCandidate,
                candidates: [topCandidate],
              },
            };
          }
        }
      }
    } catch (pinErr) {
      console.warn('India Post PIN fallback unavailable:', pinErr);
    }
  }

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
      if (firstDist) {
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
  }

  if (fallbackCandidates.length > 0) {
    return {
      httpStatus: 200,
      payload: {
        source: 'curated_india_fallback',
        ...fallbackCandidates[0],
        candidates: fallbackCandidates.slice(0, 5),
      },
    };
  }

  return {
    httpStatus: 404,
    payload: { error: 'LOCATION_NOT_FOUND', candidates: [] },
  };
}
