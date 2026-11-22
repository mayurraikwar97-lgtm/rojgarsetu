import React, { useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  APILoadingStatus,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { calculateDistanceKm } from '../data/indiaLocations';
import { useLanguage } from '../i18n/LanguageContext';
import type { JobPosting, Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

const MapLoadWatcher: React.FC<{ onFail: () => void }> = ({ onFail }) => {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onFail();
    }
  }, [status, onFail]);
  return null;
};

/**
 * Masks exact house coordinates to ~500m-1km approximate area before offer acceptance
 * so customer privacy is strictly preserved while workers can judge travel distance.
 */
function toApproxCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

interface ApproximateJobLocationMapProps {
  job: JobPosting;
  distanceKm?: number | null;
}

export const ApproximateJobLocationMap: React.FC<ApproximateJobLocationMapProps> = ({
  job,
  distanceKm,
}) => {
  const { lang } = useLanguage();
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      fetch('/api/public-config')
        .then((r) => r.json())
        .then((d) => {
          if (d?.mapsApiKey) setApiKey(d.mapsApiKey);
        })
        .catch(() => undefined);
    }
  }, [apiKey]);

  const isBikeTransport = job.orderKind === 'bike_transport';

  const pickupPoint = useMemo(() => {
    const rawLat = isBikeTransport && Number.isFinite(job.pickupLat) ? Number(job.pickupLat) : Number(job.lat);
    const rawLng = isBikeTransport && Number.isFinite(job.pickupLng) ? Number(job.pickupLng) : Number(job.lng);
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || (rawLat === 0 && rawLng === 0)) {
      return null;
    }
    return {
      lat: toApproxCoord(rawLat),
      lng: toApproxCoord(rawLng),
    };
  }, [isBikeTransport, job.pickupLat, job.pickupLng, job.lat, job.lng]);

  const destinationPoint = useMemo(() => {
    if (!isBikeTransport) return null;
    const rawLat = Number(job.destinationLat);
    const rawLng = Number(job.destinationLng);
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || (rawLat === 0 && rawLng === 0)) {
      return null;
    }
    return {
      lat: toApproxCoord(rawLat),
      lng: toApproxCoord(rawLng),
    };
  }, [isBikeTransport, job.destinationLat, job.destinationLng]);

  const tripDistanceKm = useMemo(() => {
    if (!isBikeTransport || !pickupPoint || !destinationPoint) return null;
    return calculateDistanceKm(pickupPoint.lat, pickupPoint.lng, destinationPoint.lat, destinationPoint.lng);
  }, [isBikeTransport, pickupPoint, destinationPoint]);

  const center = useMemo(() => {
    if (pickupPoint && destinationPoint) {
      return {
        lat: (pickupPoint.lat + destinationPoint.lat) / 2,
        lng: (pickupPoint.lng + destinationPoint.lng) / 2,
      };
    }
    return pickupPoint || { lat: 21.1458, lng: 79.0882 };
  }, [pickupPoint, destinationPoint]);

  const areaLabel =
    job.approxLocationLabel ||
    [job.cityOrVillage, job.district, job.state].filter(Boolean).join(', ') ||
    'Approximate Work Area';

  const externalAreaUrl = pickupPoint
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pickupPoint.lat},${pickupPoint.lng}`)}`
    : null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[#0B3B75] font-bold">
          <MapPin className="w-3.5 h-3.5 text-[#E06D1B] shrink-0" />
          <span>
            {isBikeTransport
              ? tr(lang, 'Pickup & Destination Area Map', 'पिकअप व गंतव्य क्षेत्र मानचित्र', 'पिकअप व गंतव्य परिसर नकाशा')
              : tr(lang, 'Approximate Customer Area', 'अनुमानित ग्राहक क्षेत्र', 'ग्राहकाचा अंदाजे परिसर')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof distanceKm === 'number' && Number.isFinite(distanceKm) && (
            <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0B3B75] font-bold text-[11px]">
              ~{distanceKm.toFixed(1)} km {tr(lang, 'from you', 'आपसे', 'तुमच्यापासून')}
            </span>
          )}
          {tripDistanceKm !== null && (
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
              {tr(lang, 'Trip', 'दूरी', 'प्रवास')}: ~{tripDistanceKm.toFixed(1)} km
            </span>
          )}
          {externalAreaUrl && (
            <a
              href={externalAreaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-white text-[#0B3B75] font-semibold text-[11px] hover:bg-slate-100"
            >
              <ExternalLink className="w-3 h-3" />
              {tr(lang, 'Open Area Map', 'एरिया मैप', 'एरिया नकाशा')}
            </a>
          )}
        </div>
      </div>

      {isBikeTransport ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
          <div className="bg-white border border-emerald-200 rounded px-2.5 py-1.5">
            <span className="font-bold text-emerald-800 uppercase text-[10px]">
              {tr(lang, 'Pickup (Approx)', 'पिकअप (अनुमानित)', 'पिकअप (अंदाजे)')}:
            </span>{' '}
            <span className="text-slate-800 font-medium">{job.pickupLocationLabel || areaLabel}</span>
          </div>
          <div className="bg-white border border-orange-200 rounded px-2.5 py-1.5">
            <span className="font-bold text-[#C25E00] uppercase text-[10px]">
              {tr(lang, 'Destination', 'गंतव्य', 'गंतव्य ठिकाण')}:
            </span>{' '}
            <span className="text-slate-800 font-medium">{job.destinationLocationLabel || areaLabel}</span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-600 flex items-center gap-1">
          <Navigation className="w-3 h-3 text-slate-500 shrink-0" />
          <span>
            <strong>{areaLabel}</strong> —{' '}
            {tr(
              lang,
              'Approximate area shown for quoting. Exact house pin unlocks after offer acceptance.',
              'दर बताने के लिए अनुमानित क्षेत्र। सटीक पता ऑफर स्वीकार होने के बाद दिखेगा।',
              'दर देण्यासाठी अंदाजे परिसर दाखवला आहे. ऑफर स्वीकारल्यानंतर अचूक पिन दिसेल.'
            )}
          </span>
        </p>
      )}

      {apiKey && !mapFailed && pickupPoint ? (
        <div className="h-44 w-full rounded overflow-hidden border border-slate-300 bg-slate-100">
          <APIProvider apiKey={apiKey}>
            <MapLoadWatcher onFail={() => setMapFailed(true)} />
            <GoogleMap
              defaultCenter={center}
              defaultZoom={destinationPoint ? 11 : 13}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <AdvancedMarker
                position={pickupPoint}
                title={isBikeTransport ? 'Approximate Pickup Area' : 'Approximate Work Area'}
              >
                <Pin
                  background={isBikeTransport ? '#15803D' : '#E06D1B'}
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                />
              </AdvancedMarker>
              {destinationPoint && (
                <AdvancedMarker position={destinationPoint} title="Destination Area">
                  <Pin background="#0B3B75" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : null}
    </div>
  );
};
