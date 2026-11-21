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
import { calculateDistanceKm } from '../data/indiaLocations';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  getEffectiveDealStatus,
  stopDealLocationSharing,
  subscribeDealLocationShares,
  updateDealLiveLocation,
} from '../lib/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type { DealLocationShare, JobApplication, JobPosting, Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

const LiveCameraAdjuster: React.FC<{ points: Array<{ lat: number; lng: number }> }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(14);
      return;
    }
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    map.panTo({ lat: avgLat, lng: avgLng });
    map.setZoom(13);
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

const ParticipantPin: React.FC<{
  share: DealLocationShare;
}> = ({ share }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  const isWorker = share.role === 'worker';
  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: share.lat, lng: share.lng }}
        title={`${isWorker ? 'Worker' : 'Customer'}: ${share.participantName}`}
        onClick={() => setOpen(true)}
      >
        <Pin
          background={isWorker ? '#15803D' : '#0B3B75'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
        />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={handleClose} maxWidth={240}>
          <div className="p-1 text-slate-900 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#C25E00]">
              {isWorker ? 'Worker Live Pin' : 'Customer Live Pin'}
            </div>
            <div className="text-xs font-bold text-[#0B3B75]">{share.participantName}</div>
            <div className="text-[11px] font-mono-tabular text-slate-600">
              {share.lat.toFixed(5)}, {share.lng.toFixed(5)}
            </div>
            <div className="text-[10px] text-slate-500">±{Math.round(share.accuracyMeters)}m accuracy</div>
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
}

export const DealLiveLocationMap: React.FC<DealLiveLocationMapProps> = ({
  application,
  job,
  viewerUid,
  viewerRole,
  viewerName,
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
    effectiveStatus === 'OFFER_ACCEPTED' ||
    effectiveStatus === 'DEAL_CONFIRMED' ||
    effectiveStatus === 'WORK_IN_PROGRESS';
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

  const myShare = useMemo(
    () => shares.find((s) => s.role === viewerRole && s.ownerUid === viewerUid) || null,
    [shares, viewerRole, viewerUid]
  );
  const otherRole: 'customer' | 'worker' = viewerRole === 'customer' ? 'worker' : 'customer';
  const otherShare = useMemo(
    () => shares.find((s) => s.role === otherRole && s.sharingActive) || null,
    [shares, otherRole]
  );

  const activeMarkers = useMemo(() => {
    return shares.filter((s) => s.sharingActive && Number.isFinite(s.lat) && Number.isFinite(s.lng));
  }, [shares]);

  const markerPoints = useMemo(() => {
    const pts = activeMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));
    if (pts.length === 0 && job && Number.isFinite(job.lat) && Number.isFinite(job.lng)) {
      pts.push({ lat: job.lat, lng: job.lng });
    }
    return pts;
  }, [activeMarkers, job]);

  const distanceKm = useMemo(() => {
    if (!myShare?.sharingActive || !otherShare?.sharingActive) return null;
    return calculateDistanceKm(myShare.lat, myShare.lng, otherShare.lat, otherShare.lng);
  }, [myShare, otherShare]);

  const handleShareOnce = async () => {
    if (!isUnlocked) return;
    setGpsBusy(true);
    setStatusMsg('');
    try {
      const geo = await detectBestGpsLocation(lang);
      await updateDealLiveLocation({
        app: application,
        ownerUid: viewerUid,
        role: viewerRole,
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
              `Shared approximate location (${geo.cityOrVillage || geo.district}). Allow browser GPS for pinpoint accuracy.`,
              `अनुमानित लोकेशन साझा की गई (${geo.cityOrVillage || geo.district})।`,
              `अंदाजे लोकेशन शेअर केले (${geo.cityOrVillage || geo.district}).`
            )
          : tr(
              lang,
              'Your live GPS coordinates are now shared with the other party.',
              'आपकी लाइव GPS लोकेशन अब दूसरे पक्ष को दिखाई दे रही है।',
              'तुमचे लाइव्ह GPS लोकेशन आता समोरच्या व्यक्तीला दिसत आहे.'
            )
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Unable to read GPS location.');
    } finally {
      setGpsBusy(false);
    }
  };

  const handleStartLiveWatch = () => {
    if (!isUnlocked) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void handleShareOnce();
      return;
    }
    setWatching(true);
    setStatusMsg(
      tr(
        lang,
        'Live GPS stream active — coordinates update automatically as you move.',
        'लाइव GPS स्ट्रीम चालू है — चलते समय लोकेशन अपने आप अपडेट होगी।',
        'लाइव्ह GPS सुरू आहे — हालचालीनुसार लोकेशन आपोआप अपडेट होईल.'
      )
    );
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        void updateDealLiveLocation({
          app: application,
          ownerUid: viewerUid,
          role: viewerRole,
          participantName: viewerName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy || 25,
          sharingActive: true,
          source: 'gps_watch',
        }).catch(() => undefined);
      },
      () => {
        void handleShareOnce();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    watchIdRef.current = id;
  };

  const handleStopSharing = async () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
    setGpsBusy(true);
    try {
      if (myShare) {
        await updateDealLiveLocation({
          app: application,
          ownerUid: viewerUid,
          role: viewerRole,
          participantName: viewerName,
          lat: myShare.lat,
          lng: myShare.lng,
          accuracyMeters: myShare.accuracyMeters,
          sharingActive: false,
          source: myShare.source,
        });
      } else {
        await stopDealLocationSharing(application.id);
      }
      setStatusMsg(
        tr(
          lang,
          'Live location sharing stopped.',
          'लाइव लोकेशन साझाकरण बंद कर दिया गया है।',
          'लाइव्ह लोकेशन शेअरिंग बंद केले आहे.'
        )
      );
    } finally {
      setGpsBusy(false);
    }
  };

  if (!isUnlocked && !isClosed) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
        <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0B3B75]">
            {tr(lang, 'Exact Live Location Locked Before Acceptance', 'स्वीकृति से पहले सटीक लोकेशन गोपनीय है', 'काम मंजूर होण्यापूर्वी अचूक लोकेशन गोपनीय असते')}
          </strong>
          <p className="mt-0.5">
            {tr(
              lang,
              `Approximate work area: ${application.jobLocationLabel || application.jobDistrict || job?.district || 'District level only'}. Two-way live map unlocks automatically once offer is accepted.`,
              `अनुमानित क्षेत्र: ${application.jobLocationLabel || application.jobDistrict || job?.district || 'केवल जिला'}। ऑफर स्वीकार होने पर लाइव मानचित्र खुल जाएगा।`,
              `अंदाजे परिसर: ${application.jobLocationLabel || application.jobDistrict || job?.district || 'फक्त जिल्हा'}. ऑफर स्वीकारल्यानंतर दोन-मार्ग लाइव्ह मॅप सुरू होईल.`
            )}
          </p>
        </div>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">
            {tr(lang, 'Live Location Sharing Stopped', 'लाइव लोकेशन साझाकरण बंद', 'लाइव्ह लोकेशन शेअरिंग बंद झाले')}
          </strong>
          <p className="mt-0.5">
            {tr(
              lang,
              `Deal status is ${effectiveStatus}. Real-time location sharing is automatically terminated upon completion or cancellation.`,
              `डील स्थिति ${effectiveStatus} है। कार्य पूर्ण या रद्द होने पर लाइव लोकेशन अपने आप बंद हो जाती है।`,
              `डील स्थिती ${effectiveStatus} आहे. काम पूर्ण किंवा रद्द झाल्यावर लाइव्ह लोकेशन शेअरिंग आपोआप बंद होते.`
            )}
          </p>
        </div>
      </div>
    );
  }

  const navigationTarget = otherShare || (job && Number.isFinite(job.lat) && Number.isFinite(job.lng) ? { lat: job.lat, lng: job.lng } : null);
  const directionsUrl = navigationTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${navigationTarget.lat},${navigationTarget.lng}`)}`
    : null;

  const defaultCenter = markerPoints[0] || { lat: 21.1458, lng: 79.0882 };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LocateFixed className="w-4 h-4 text-[#15803D] shrink-0" />
          <div>
            <div className="text-xs font-bold text-[#0B3B75]">
              {tr(
                lang,
                'Two-Way Live Location & Navigation Map',
                'दो-तरफ़ा लाइव लोकेशन व नेविगेशन मानचित्र',
                'दोन-मार्ग लाइव्ह लोकेशन व नेव्हिगेशन नकाशा'
              )}
            </div>
            <div className="text-[11px] text-slate-600">
              {otherShare
                ? `${otherRole === 'worker' ? 'Worker' : 'Customer'} (${otherShare.participantName}) is live · ±${Math.round(otherShare.accuracyMeters)}m${
                    distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km away` : ''
                  }`
                : tr(
                    lang,
                    `Waiting for ${otherRole === 'worker' ? 'worker' : 'customer'} to share live GPS.`,
                    `दूसरे पक्ष (${otherRole === 'worker' ? 'कामगार' : 'ग्राहक'}) की लाइव लोकेशन की प्रतीक्षा।`,
                    `समोरच्या (${otherRole === 'worker' ? 'कामगार' : 'ग्राहक'}) लाइव्ह लोकेशनची प्रतीक्षा आहे.`
                  )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!watching ? (
            <button
              type="button"
              disabled={gpsBusy}
              onClick={handleStartLiveWatch}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#15803D] text-white text-[11px] font-bold hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
            >
              <Navigation className="w-3 h-3" />
              {myShare?.sharingActive
                ? tr(lang, 'Stream Live GPS', 'लाइव GPS चलाएं', 'लाइव्ह GPS सुरू करा')
                : tr(lang, 'Share My Live Location', 'मेरी लाइव लोकेशन साझा करें', 'माझे लाइव्ह लोकेशन शेअर करा')}
            </button>
          ) : (
            <button
              type="button"
              disabled={gpsBusy}
              onClick={handleStopSharing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-700 text-white text-[11px] font-bold hover:bg-red-800 cursor-pointer"
            >
              <Square className="w-3 h-3" />
              {tr(lang, 'Stop Live Stream', 'साझाकरण बंद करें', 'शेअरिंग बंद करा')}
            </button>
          )}

          <button
            type="button"
            disabled={gpsBusy}
            onClick={handleShareOnce}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-[#0B3B75] text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            {tr(lang, 'Update Pin', 'पिन अपडेट', 'पिन अपडेट')}
          </button>

          {myShare?.sharingActive && !watching && (
            <button
              type="button"
              disabled={gpsBusy}
              onClick={handleStopSharing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-300 bg-white text-red-700 text-[11px] font-semibold hover:bg-red-50 cursor-pointer"
            >
              {tr(lang, 'Turn Off', 'बंद करें', 'बंद करा')}
            </button>
          )}

          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0B3B75] text-white text-[11px] font-bold hover:bg-slate-800"
            >
              <ExternalLink className="w-3 h-3" />
              {tr(lang, 'Open Directions', 'रास्ता देखें', 'दिशा पहा (Maps)')}
            </a>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="px-2.5 py-1.5 rounded bg-white border border-blue-200 text-[11px] text-[#0B3B75] font-medium">
          {statusMsg}
        </div>
      )}

      {/* Participant Live Coordinate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div
          className={`p-2 rounded border ${
            myShare?.sharingActive ? 'bg-white border-emerald-300' : 'bg-white/70 border-slate-200'
          }`}
        >
          <div className="font-bold text-[#0B3B75] flex items-center justify-between">
            <span>
              {viewerRole === 'worker' ? 'You (Worker)' : 'You (Customer)'}: {viewerName}
            </span>
            <span className={myShare?.sharingActive ? 'text-[#15803D]' : 'text-slate-400'}>
              {myShare?.sharingActive ? '● LIVE' : 'OFF'}
            </span>
          </div>
          <div className="font-mono-tabular text-slate-600 mt-0.5">
            {myShare?.sharingActive
              ? `${myShare.lat.toFixed(5)}, ${myShare.lng.toFixed(5)} (±${Math.round(myShare.accuracyMeters)}m)`
              : tr(lang, 'Click "Share My Live Location" to pin your GPS', 'साझा करने के लिए ऊपर बटन दबाएं', 'शेअर करण्यासाठी वरील बटण दाबा')}
          </div>
        </div>

        <div
          className={`p-2 rounded border ${
            otherShare?.sharingActive ? 'bg-white border-blue-300' : 'bg-white/70 border-slate-200'
          }`}
        >
          <div className="font-bold text-[#0B3B75] flex items-center justify-between">
            <span>
              {otherRole === 'worker' ? `Worker: ${application.workerName}` : `Customer: ${application.customerName || 'Customer'}`}
            </span>
            <span className={otherShare?.sharingActive ? 'text-[#15803D]' : 'text-slate-400'}>
              {otherShare?.sharingActive ? '● LIVE' : 'WAITING'}
            </span>
          </div>
          <div className="font-mono-tabular text-slate-600 mt-0.5">
            {otherShare?.sharingActive
              ? `${otherShare.lat.toFixed(5)}, ${otherShare.lng.toFixed(5)} (±${Math.round(otherShare.accuracyMeters)}m)`
              : tr(lang, 'Waiting for live coordinate update', 'लाइव लोकेशन की प्रतीक्षा', 'लाइव्ह लोकेशनची प्रतीक्षा')}
          </div>
        </div>
      </div>

      {/* Interactive Google Map */}
      {apiKey && !mapFailed ? (
        <div className="h-56 w-full rounded-md overflow-hidden border border-slate-300 bg-slate-100">
          <APIProvider apiKey={apiKey}>
            <LiveStatusWatcher onFail={() => setMapFailed(true)} />
            <GoogleMap
              defaultCenter={defaultCenter}
              defaultZoom={13}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_git_agentskills_v1']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <LiveCameraAdjuster points={markerPoints} />
              {activeMarkers.map((s) => (
                <ParticipantPin key={s.id} share={s} />
              ))}
              {activeMarkers.length === 0 && job && Number.isFinite(job.lat) && Number.isFinite(job.lng) && (
                <AdvancedMarker position={{ lat: job.lat, lng: job.lng }} title={job.workLocationLabel}>
                  <Pin background="#E06D1B" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0" />
            <span>
              {tr(
                lang,
                `Live coordinate sharing active (${activeMarkers.length} active pin(s)). Use "Open Directions" for turn-by-turn navigation.`,
                `लाइव निर्देशांक सक्रिय (${activeMarkers.length} पिन)। नेविगेशन के लिए "रास्ता देखें" खोलें।`,
                `लाइव्ह लोकेशन सक्रिय (${activeMarkers.length} पिन). नेव्हिगेशनसाठी Google Maps दिशा पहा.`
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
