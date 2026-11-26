import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  ExternalLink,
  LocateFixed,
  Lock,
  MapPin,
  Navigation,
  ShieldAlert,
  Square,
} from 'lucide-react';
import {
  classifyGeolocationErrorCode,
  detectBestGpsLocation,
  formatGeolocationError,
} from '../lib/locationService';
import {
  getEffectiveDealStatus,
  stopDealLocationSharing,
  subscribeDealLocationShares,
  updateDealLiveLocation,
} from '../lib/firestoreService';
import { getSafeCustomerLabelForJobOrApp } from '../lib/customerPrivacy';
import { useLanguage } from '../i18n/LanguageContext';
import type { DealLocationShare, JobApplication, JobPosting, Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

const LiveCameraAdjuster: React.FC<{ points: Array<{ lat: number; lng: number }> }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    map.panTo(points[0]);
    map.setZoom(14);
  }, [map, points]);
  return null;
};

const LiveStatusWatcher: React.FC<{ onFail: () => void }> = ({ onFail }) => {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onFail();
    }
  }, [status, onFail]);
  return null;
};

const CustomerLocationPin: React.FC<{
  lat: number;
  lng: number;
  label: string;
  accuracyMeters?: number;
}> = ({ lat, lng, label, accuracyMeters }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        title={`Customer Service Location: ${label}`}
        onClick={() => setOpen(true)}
      >
        <Pin background="#0B3B75" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={handleClose} maxWidth={240}>
          <div className="p-1 text-slate-900 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#C25E00]">
              Customer Service Location
            </div>
            <div className="text-xs font-bold text-[#0B3B75]">{label}</div>
            <div className="text-[11px] font-mono-tabular text-slate-600">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
            {typeof accuracyMeters === 'number' && accuracyMeters > 0 && (
              <div className="text-[10px] text-slate-500">±{Math.round(accuracyMeters)}m accuracy</div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface DealLiveLocationMapProps {
  application: JobApplication;
  job?: JobPosting;
  viewerUid: string;
  viewerRole: 'customer' | 'worker';
  viewerName: string;
  onLocationStatusChange?: (hasActiveShare: boolean) => void;
}

/**
 * One-Way Privacy Location Map:
 * - Customers can share/update their service GPS location so the assigned worker can see distance & navigate.
 * - Workers NEVER broadcast live GPS and Customers NEVER see worker GPS coordinates anywhere.
 */
export const DealLiveLocationMap: React.FC<DealLiveLocationMapProps> = ({
  application,
  job,
  viewerUid,
  viewerRole,
  viewerName,
  onLocationStatusChange,
}) => {
  const { lang } = useLanguage();
  const [shares, setShares] = useState<DealLocationShare[]>([]);
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [mapFailed, setMapFailed] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const watchIdRef = useRef<number | null>(null);

  const effectiveStatus = getEffectiveDealStatus(application);
  const isUnlocked =
    application.status === 'accepted' &&
    (effectiveStatus === 'OFFER_ACCEPTED' ||
      effectiveStatus === 'DEAL_CONFIRMED' ||
      effectiveStatus === 'WORKER_ON_THE_WAY' ||
      effectiveStatus === 'WORKER_ARRIVED' ||
      effectiveStatus === 'WORK_IN_PROGRESS');
  const isClosed =
    effectiveStatus === 'WORK_COMPLETED' ||
    effectiveStatus === 'CANCELLED' ||
    effectiveStatus === 'REJECTED';

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

  useEffect(() => {
    if (!isUnlocked && !isClosed) {
      setShares([]);
      return;
    }
    const unsub = subscribeDealLocationShares(application.id, setShares);
    return () => unsub();
  }, [application.id, isUnlocked, isClosed]);

  // Stop local GPS watch automatically when deal closes or unmounts
  useEffect(() => {
    if (!isUnlocked && watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
    }
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isUnlocked]);

  // Strictly customer-only live GPS share — worker coordinates are never read or rendered.
  const customerShare = useMemo(
    () =>
      shares.find(
        (s) =>
          s.role === 'customer' &&
          s.sharingActive &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng)
      ) || null,
    [shares]
  );

  const myCustomerShare = useMemo(
    () =>
      viewerRole === 'customer'
        ? shares.find((s) => s.role === 'customer' && s.ownerUid === viewerUid) || null
        : null,
    [shares, viewerRole, viewerUid]
  );

  const customerTarget = useMemo(() => {
    if (customerShare) {
      return {
        lat: customerShare.lat,
        lng: customerShare.lng,
        accuracyMeters: customerShare.accuracyMeters,
        isLive: true,
      };
    }
    if (job && Number.isFinite(job.lat) && Number.isFinite(job.lng)) {
      return {
        lat: job.lat,
        lng: job.lng,
        accuracyMeters: undefined,
        isLive: false,
      };
    }
    return null;
  }, [customerShare, job]);

  useEffect(() => {
    onLocationStatusChange?.(Boolean(customerShare));
  }, [customerShare, onLocationStatusChange]);

  const markerPoints = useMemo(() => {
    if (!customerTarget) return [];
    return [{ lat: customerTarget.lat, lng: customerTarget.lng }];
  }, [customerTarget]);

  const handleCustomerShareOnce = async () => {
    if (!isUnlocked || viewerRole !== 'customer') return;
    setGpsBusy(true);
    setStatusMsg('');
    try {
      const geo = await detectBestGpsLocation(lang);
      await updateDealLiveLocation({
        app: application,
        ownerUid: viewerUid,
        role: 'customer',
        participantName: viewerName,
        lat: geo.lat,
        lng: geo.lng,
        accuracyMeters: geo.isApproximate ? 3500 : 25,
        sharingActive: true,
        source: geo.isApproximate ? 'gps_once' : 'gps_watch',
      });
      setStatusMsg(
        geo.isApproximate
          ? tr(
              lang,
              `Shared service area (${geo.cityOrVillage || geo.district}) with your worker.`,
              `सेवा क्षेत्र (${geo.cityOrVillage || geo.district}) कामगार के साथ साझा किया गया।`,
              `तुमचे सेवा लोकेशन (${geo.cityOrVillage || geo.district}) कामगारासोबत शेअर केले आहे.`
            )
          : tr(
              lang,
              'Your service GPS location is now visible to the assigned worker.',
              'आपकी सेवा GPS लोकेशन अब नियुक्त कामगार को दिखाई दे रही है।',
              'तुमचे सेवा GPS लोकेशन आता नियुक्त कामगाराला दिसत आहे.'
            )
      );
    } catch (err) {
      setStatusMsg(formatGeolocationError(err, lang).message);
    } finally {
      setGpsBusy(false);
    }
  };

  const handleCustomerStartLiveWatch = () => {
    if (!isUnlocked || viewerRole !== 'customer') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void handleCustomerShareOnce();
      return;
    }
    setWatching(true);
    setStatusMsg(
      tr(
        lang,
        'Your service GPS pin is live for the assigned worker.',
        'आपका सेवा GPS पिन कामगार के लिए लाइव है।',
        'तुमचे सेवा GPS लोकेशन कामगारासाठी लाइव्ह सुरू आहे.'
      )
    );
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        void updateDealLiveLocation({
          app: application,
          ownerUid: viewerUid,
          role: 'customer',
          participantName: viewerName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy || 25,
          sharingActive: true,
          source: 'gps_watch',
        }).catch(() => undefined);
      },
      (geoErr) => {
        const code = classifyGeolocationErrorCode(geoErr);
        if (code === 'PERMISSION_DENIED') {
          if (watchIdRef.current !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          setWatching(false);
          setStatusMsg(formatGeolocationError(geoErr, lang).message);
          return;
        }
        void handleCustomerShareOnce();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    watchIdRef.current = id;
  };

  const handleCustomerStopSharing = async () => {
    if (viewerRole !== 'customer') return;
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
    setGpsBusy(true);
    try {
      if (myCustomerShare) {
        await updateDealLiveLocation({
          app: application,
          ownerUid: viewerUid,
          role: 'customer',
          participantName: viewerName,
          lat: myCustomerShare.lat,
          lng: myCustomerShare.lng,
          accuracyMeters: myCustomerShare.accuracyMeters,
          sharingActive: false,
          source: myCustomerShare.source,
        });
      } else {
        await stopDealLocationSharing(application.id);
      }
      setStatusMsg(
        tr(
          lang,
          'Service location sharing stopped.',
          'लोकेशन साझाकरण बंद कर दिया गया है।',
          'लोकेशन शेअरिंग बंद केले आहे.'
        )
      );
    } finally {
      setGpsBusy(false);
    }
  };

  if (!isUnlocked && !isClosed) {
    return null;
  }

  if (isClosed) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">
            {tr(lang, 'Location Sharing Stopped', 'लोकेशन साझाकरण बंद', 'लोकेशन शेअरिंग बंद झाले')}
          </strong>
          <p className="mt-0.5">
            {tr(
              lang,
              `Deal status is ${effectiveStatus}. Customer service location sharing ends automatically upon completion or cancellation.`,
              `डील स्थिति ${effectiveStatus} है। कार्य पूर्ण या रद्द होने पर लोकेशन साझाकरण अपने आप बंद हो जाता है।`,
              `डील स्थिती ${effectiveStatus} आहे. काम पूर्ण किंवा रद्द झाल्यावर लोकेशन शेअरिंग आपोआप बंद होते.`
            )}
          </p>
        </div>
      </div>
    );
  }

  const directionsUrl = customerTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${customerTarget.lat},${customerTarget.lng}`
      )}`
    : null;
  const customerDisplayLabel = getSafeCustomerLabelForJobOrApp({
    job,
    app: application,
    viewerRole,
  });
  const defaultCenter = markerPoints[0] || { lat: 21.1458, lng: 79.0882 };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LocateFixed className="w-4 h-4 text-[#15803D] shrink-0" />
          <div>
            <div className="text-xs font-bold text-[#0B3B75]">
              {viewerRole === 'worker'
                ? tr(
                    lang,
                    'Customer Worksite Location & Navigation',
                    'ग्राहक कार्यस्थल लोकेशन व रास्ता',
                    'ग्राहकाचे कामाचे लोकेशन व Google Maps रास्ता'
                  )
                : tr(
                    lang,
                    'Your Service Location (Shared With Assigned Worker)',
                    'आपकी सेवा लोकेशन (केवल नियुक्त कामगार के लिए)',
                    'तुमचे सेवा लोकेशन (फक्त नियुक्त कामगारासाठी)'
                  )}
            </div>
            <div className="text-[11px] text-slate-600">
              {viewerRole === 'worker'
                ? customerTarget
                  ? tr(
                      lang,
                      `Customer (${customerDisplayLabel}) worksite pin available for navigation. Your live GPS is never shared with customers.`,
                      `ग्राहक (${customerDisplayLabel}) की कार्यस्थल लोकेशन उपलब्ध है। आपकी लाइव GPS ग्राहक को नहीं दिखाई जाती।`,
                      `ग्राहक (${customerDisplayLabel}) चे कामाचे लोकेशन उपलब्ध आहे. तुमचे लाइव्ह GPS ग्राहकाला कधीही दाखवले जात नाही.`
                    )
                  : tr(
                      lang,
                      'Waiting for customer to share GPS worksite pin.',
                      'ग्राहक द्वारा GPS लोकेशन साझा करने की प्रतीक्षा है।',
                      'ग्राहकाने GPS लोकेशन शेअर करण्याची प्रतीक्षा आहे.'
                    )
                : tr(
                    lang,
                    'Share your worksite GPS so your worker can reach you easily. For worker privacy, worker live GPS is never displayed.',
                    'कामगार आसानी से पहुँच सके इसके लिए अपनी लोकेशन साझा करें। कामगार की निजता के लिए उनकी लाइव GPS नहीं दिखाई जाती।',
                    'कामगाराला तुमच्यापर्यंत सहज पोहोचण्यासाठी तुमचे लोकेशन शेअर करा. कामगाराच्या सुरक्षेसाठी त्यांचे लाइव्ह GPS दाखवले जात नाही.'
                  )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewerRole === 'customer' && (
            <>
              {!watching ? (
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={handleCustomerStartLiveWatch}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#15803D] text-white text-xs font-extrabold hover:bg-emerald-800 cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  <Navigation className="w-4 h-4" />
                  {myCustomerShare?.sharingActive
                    ? tr(lang, 'Update Service Location', 'लोकेशन अपडेट करें', 'लोकेशन अपडेट करा')
                    : tr(lang, 'Share Service Location', 'लोकेशन साझा करें', 'माझे लोकेशन शेअर करा')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={handleCustomerStopSharing}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-red-700 text-white text-xs font-extrabold hover:bg-red-800 cursor-pointer shadow-sm"
                >
                  <Square className="w-3.5 h-3.5" />
                  {tr(lang, 'Stop Sharing', 'साझाकरण बंद करें', 'शेअरिंग बंद करा')}
                </button>
              )}

              <button
                type="button"
                disabled={gpsBusy}
                onClick={handleCustomerShareOnce}
                className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-[#0B3B75] text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {tr(lang, 'Pin Once', 'एक बार पिन करें', 'एकदा पिन करा')}
              </button>

              {myCustomerShare?.sharingActive && !watching && (
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={handleCustomerStopSharing}
                  className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-300 bg-white text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  {tr(lang, 'Stop Sharing', 'बंद करें', 'बंद करा')}
                </button>
              )}
            </>
          )}

          {viewerRole === 'worker' && directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-extrabold hover:bg-slate-800 shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {tr(lang, 'Open Customer Location in Google Maps', 'ग्राहक लोकेशन Google Maps में खोलें', 'ग्राहकाचे लोकेशन Google Maps वर पहा')}
            </a>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="px-2.5 py-1.5 rounded bg-white border border-blue-200 text-[11px] text-[#0B3B75] font-medium">
          {statusMsg}
        </div>
      )}

      {/* Privacy & Customer Pin Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div
          className={`p-2.5 rounded border ${
            customerTarget ? 'bg-white border-emerald-300' : 'bg-white/70 border-slate-200'
          }`}
        >
          <div className="font-bold text-[#0B3B75] flex items-center justify-between">
            <span>
              {tr(lang, 'Customer Worksite', 'ग्राहक कार्यस्थल', 'ग्राहकाचे कामाचे ठिकाण')}: {customerDisplayLabel}
            </span>
            <span className={customerTarget?.isLive ? 'text-[#15803D]' : 'text-amber-700'}>
              {customerTarget?.isLive ? '● LIVE GPS' : customerTarget ? '● PINNED' : 'WAITING'}
            </span>
          </div>
          <div className="font-mono-tabular text-slate-600 mt-0.5">
            {customerTarget
              ? `${customerTarget.lat.toFixed(5)}, ${customerTarget.lng.toFixed(5)}${
                  customerTarget.accuracyMeters ? ` (±${Math.round(customerTarget.accuracyMeters)}m)` : ''
                }`
              : tr(
                  lang,
                  'No GPS coordinates shared yet.',
                  'अभी GPS निर्देशांक साझा नहीं किए गए।',
                  'अद्याप GPS लोकेशन शेअर केलेले नाही.'
                )}
          </div>
        </div>

        <div className="p-2.5 rounded border bg-slate-50 border-slate-200">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#15803D]" />
            <span>
              {tr(lang, 'Worker Privacy Protected', 'कामगार निजता सुरक्षित', 'कामगार गोपनीयता सुरक्षित')}
            </span>
          </div>
          <div className="text-slate-600 mt-0.5">
            {tr(
              lang,
              'Worker live GPS is private and never shown to customers. Coordinate arrival via call or chat.',
              'कामगार की लाइव GPS ग्राहक को नहीं दिखाई जाती। समय के लिए कॉल या चैट से संपर्क करें।',
              'कामगाराचे लाइव्ह GPS ग्राहकाला कधीही दाखवले जात नाही. वेळेसाठी कॉल किंवा चॅटद्वारे संपर्क साधा.'
            )}
          </div>
        </div>
      </div>

      {/* Interactive Google Map showing ONLY Customer Worksite Pin */}
      {customerTarget && apiKey && !mapFailed ? (
        <div className="h-56 w-full rounded-md overflow-hidden border border-slate-300 bg-slate-100">
          <APIProvider apiKey={apiKey}>
            <LiveStatusWatcher onFail={() => setMapFailed(true)} />
            <GoogleMap
              defaultCenter={defaultCenter}
              defaultZoom={14}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <LiveCameraAdjuster points={markerPoints} />
              <CustomerLocationPin
                lat={customerTarget.lat}
                lng={customerTarget.lng}
                label={customerDisplayLabel}
                accuracyMeters={customerTarget.accuracyMeters}
              />
            </GoogleMap>
          </APIProvider>
        </div>
      ) : customerTarget ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0" />
            <span>
              {tr(
                lang,
                `Customer worksite coordinates pinned (${customerTarget.lat.toFixed(4)}, ${customerTarget.lng.toFixed(4)}).`,
                `ग्राहक कार्यस्थल पिन किया गया (${customerTarget.lat.toFixed(4)}, ${customerTarget.lng.toFixed(4)})।`,
                `ग्राहकाचे कामाचे ठिकाण पिन केले आहे (${customerTarget.lat.toFixed(4)}, ${customerTarget.lng.toFixed(4)}).`
              )}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
