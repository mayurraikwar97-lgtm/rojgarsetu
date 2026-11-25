import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Compass, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import {
  calculateDistanceKm,
  getDistrictCoordinates,
  INDIA_STATES_DISTRICTS,
} from '../data/indiaLocations';
import {
  detectBestGpsLocation,
  formatCoordinatesLabel,
  formatGeolocationError,
} from '../lib/locationService';
import { useLanguage } from '../i18n/LanguageContext';
import type { JobPosting, PageRoute, PublicWorkerProfile } from '../types/domain';

interface EmploymentMapProps {
  jobs: JobPosting[];
  workers: PublicWorkerProfile[];
  onNavigate?: (route: PageRoute, categoryFilter?: string) => void;
}

interface MapMarkerItem {
  id: string;
  kind: 'job' | 'worker';
  title: string;
  subtitle: string;
  locationLabel: string;
  wageLabel: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

const MapCameraController: React.FC<{ center: { lat: number; lng: number }; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo(center);
      map.setZoom(zoom);
    }
  }, [map, center, zoom]);
  return null;
};

const InteractiveMarkerPin: React.FC<{
  item: MapMarkerItem;
  onSelect?: () => void;
}> = ({ item, onSelect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.lat, lng: item.lng }}
        title={item.title}
        onClick={() => setOpen(true)}
      >
        <Pin
          background={item.kind === 'job' ? '#0B3B75' : '#15803D'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
        />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={handleClose} maxWidth={260}>
          <div className="p-1 text-slate-900 space-y-1">
            <p className="text-[11px] font-semibold text-amber-800">
              {item.kind === 'job' ? 'Opportunity' : 'Registered Skill Profile'}
            </p>
            <h4 className="text-sm font-bold leading-snug">{item.title}</h4>
            <p className="text-xs text-slate-600">{item.subtitle}</p>
            <p className="text-xs text-slate-500">{item.locationLabel}</p>
            <p className="text-xs font-semibold text-[#0B3B75] tabular-nums">{item.wageLabel}</p>
            {onSelect && (
              <button
                type="button"
                onClick={onSelect}
                className="mt-1 text-xs font-semibold text-[#C25E00] underline cursor-pointer"
              >
                View Details
              </button>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapStatusWatcher: React.FC<{ onStatusError: () => void }> = ({ onStatusError }) => {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      onStatusError();
    }
  }, [status, onStatusError]);
  return null;
};

export const EmploymentMap: React.FC<EmploymentMapProps> = ({ jobs, workers, onNavigate }) => {
  const { lang, t } = useLanguage();
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [cityQuery, setCityQuery] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(0); // 0 = All
  const [activeLayer, setActiveLayer] = useState<'jobs' | 'workers'>('jobs');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      fetch('/api/public-config')
        .then((r) => r.json())
        .then((data) => {
          if (data?.mapsApiKey) {
            setApiKey(data.mapsApiKey);
          }
        })
        .catch(() => {
          // Keep empty fallback
        });
    }
  }, [apiKey]);

  const stateObj = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === selectedState),
    [selectedState]
  );

  const referenceCoords = useMemo(() => {
    if (userCoords) return userCoords;
    if (selectedState && selectedDistrict) {
      return getDistrictCoordinates(selectedState, selectedDistrict);
    }
    if (selectedState && stateObj?.districts[0]) {
      return { lat: stateObj.districts[0].lat, lng: stateObj.districts[0].lng };
    }
    return { lat: 21.1458, lng: 79.0882 };
  }, [userCoords, selectedState, selectedDistrict, stateObj]);

  const zoomLevel = useMemo(() => {
    if (userCoords) return 11;
    if (selectedDistrict) return 10;
    if (selectedState) return 7;
    return 5;
  }, [userCoords, selectedDistrict, selectedState]);

  const requestUserLocation = async () => {
    setGeoStatus(
      lang === 'mr'
        ? 'GPS द्वारे तुमचे सध्याचे ठिकाण शोधत आहे...'
        : lang === 'hi'
        ? 'GPS से आपकी वर्तमान लोकेशन खोजी जा रही है...'
        : 'Detecting your current location via GPS...'
    );
    try {
      const detected = await detectBestGpsLocation(lang);
      const coordStr = formatCoordinatesLabel(detected.lat, detected.lng);
      setUserCoords({ lat: detected.lat, lng: detected.lng });
      if (detected.isApproximate) {
        setGeoStatus(
          `Network estimate (${detected.accuracyMeters ? `${Math.round(detected.accuracyMeters / 1000)} km accuracy` : 'low precision'}): ${detected.formattedAddress || detected.district} (${coordStr}). Use State/District filters if inaccurate.`
        );
        return;
      }
      if (detected.state) setSelectedState(detected.state);
      if (detected.district) setSelectedDistrict(detected.district);
      setGeoStatus(
        `GPS location active: ${detected.formattedAddress || `${detected.cityOrVillage}, ${detected.district}, ${detected.state}`} (${coordStr}).`
      );
    } catch (err) {
      setGeoStatus(formatGeolocationError(err, lang).message);
    }
  };

  const markerItems: MapMarkerItem[] = useMemo(() => {
    const cityTerm = cityQuery.trim().toLowerCase();

    if (activeLayer === 'jobs') {
      return jobs
        .filter((j) => j.status === 'open')
        .filter((j) => !selectedState || j.state === selectedState)
        .filter((j) => !selectedDistrict || j.district === selectedDistrict)
        .filter(
          (j) =>
            !cityTerm ||
            j.cityOrVillage.toLowerCase().includes(cityTerm) ||
            j.workLocationLabel.toLowerCase().includes(cityTerm) ||
            j.category.toLowerCase().includes(cityTerm)
        )
        .map((j) => {
          const dist = calculateDistanceKm(referenceCoords.lat, referenceCoords.lng, j.lat, j.lng);
          return {
            id: j.id,
            kind: 'job' as const,
            title: j.title,
            subtitle: `${j.category} · ${j.employerName}`,
            locationLabel: `${j.cityOrVillage}, ${j.district}, ${j.state}`,
            wageLabel: `₹${j.offeredWage.toLocaleString('en-IN')} / ${j.wageUnit}`,
            lat: j.lat,
            lng: j.lng,
            distanceKm: dist,
          };
        })
        .filter((item) => radiusKm === 0 || (item.distanceKm ?? 0) <= radiusKm);
    }

    return workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => !selectedState || w.state === selectedState)
      .filter((w) => !selectedDistrict || w.district === selectedDistrict)
      .filter(
        (w) =>
          !cityTerm ||
          w.cityOrVillage.toLowerCase().includes(cityTerm) ||
          w.primarySkill.toLowerCase().includes(cityTerm)
      )
      .map((w) => {
        const dist = calculateDistanceKm(
          referenceCoords.lat,
          referenceCoords.lng,
          w.approxLat,
          w.approxLng
        );
        return {
          id: w.id,
          kind: 'worker' as const,
          title: w.displayName,
          subtitle: `${w.primarySkill} · ${w.skills.slice(0, 3).join(', ')}`,
          locationLabel: `${w.cityOrVillage}, ${w.district}, ${w.state}`,
          wageLabel: `₹${w.expectedWage.toLocaleString('en-IN')} / ${w.wageUnit}`,
          lat: w.approxLat,
          lng: w.approxLng,
          distanceKm: dist,
        };
      })
      .filter((item) => radiusKm === 0 || (item.distanceKm ?? 0) <= radiusKm);
  }, [activeLayer, jobs, workers, selectedState, selectedDistrict, cityQuery, referenceCoords, radiusKm]);

  return (
    <section className="py-16 bg-slate-50 border-y border-slate-200" id="employment-map">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75] tracking-tight text-balance">
            {t.mapSection.heading}
          </h2>
          <p className="mt-2 text-slate-600 text-base leading-relaxed">
            {t.mapSection.subheading}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="inline-flex rounded-md bg-slate-100 p-1" role="tablist">
              <button
                type="button"
                onClick={() => setActiveLayer('jobs')}
                className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded transition-colors cursor-pointer ${
                  activeLayer === 'jobs' ? 'bg-[#0B3B75] text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {t.mapSection.layerJobs} ({jobs.filter((j) => j.status === 'open').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('workers')}
                className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded transition-colors cursor-pointer ${
                  activeLayer === 'workers' ? 'bg-[#15803D] text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {t.mapSection.layerWorkers} ({workers.filter((w) => w.verificationStatus !== 'suspended').length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestUserLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#C25E00]" />
                {t.mapSection.useMyLocation}
              </button>
              {userCoords && (
                <button
                  type="button"
                  onClick={() => {
                    setUserCoords(null);
                    setGeoStatus('');
                  }}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t.mapSection.clearLocation}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.mapSection.stateLabel}
              </label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              >
                <option value="">{t.mapSection.allStates}</option>
                {INDIA_STATES_DISTRICTS.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.mapSection.districtLabel}
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedState}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              >
                <option value="">{t.mapSection.allDistricts}</option>
                {stateObj?.districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.mapSection.cityLabel}
              </label>
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="City / Village / Skill..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.mapSection.radiusLabel}
              </label>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              >
                <option value={0}>{t.mapSection.allIndia}</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={150}>150 km</option>
              </select>
            </div>
          </div>

          {geoStatus && (
            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              {geoStatus}
            </p>
          )}
        </div>

        {/* Map + Results Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
            {apiKey && !mapLoadFailed ? (
              <div className="h-[460px] w-full relative">
                <APIProvider
                  apiKey={apiKey}
                  libraries={['marker']}
                  language={lang}
                  region="IN"
                >
                  <MapStatusWatcher onStatusError={() => setMapLoadFailed(true)} />
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: 21.1458, lng: 79.0882 }}
                    defaultZoom={5}
                    gestureHandling="greedy"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <MapCameraController center={referenceCoords} zoom={zoomLevel} />
                    {markerItems.map((item) => (
                      <InteractiveMarkerPin
                        key={item.id}
                        item={item}
                        onSelect={
                          onNavigate
                            ? () => onNavigate(item.kind === 'job' ? 'find-work' : 'find-workers')
                            : undefined
                        }
                      />
                    ))}
                  </GoogleMap>
                </APIProvider>
              </div>
            ) : (
              <div className="h-[460px] w-full flex flex-col justify-between p-6 bg-slate-100/70">
                <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-md p-4">
                  <Navigation className="w-5 h-5 text-[#0B3B75] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {t.mapSection.fallbackBanner}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                      Focus Coordinates: {referenceCoords.lat.toFixed(4)}° N, {referenceCoords.lng.toFixed(4)}° E
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto py-4">
                  {INDIA_STATES_DISTRICTS.slice(0, 6).map((st) => (
                    <button
                      key={st.name}
                      type="button"
                      onClick={() => {
                        setSelectedState(st.name);
                        setSelectedDistrict(st.districts[0]?.name || '');
                      }}
                      className={`p-3 text-left rounded-md border transition-colors cursor-pointer ${
                        selectedState === st.name
                          ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{st.name}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {st.districts[0]?.name}
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-500">
                  {t.mapSection.consentTitle}: {t.mapSection.consentDesc}
                </p>
              </div>
            )}
          </div>

          {/* Right List of Matching Location Records */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col h-[460px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-display text-sm font-bold text-[#0B3B75]">
                {activeLayer === 'jobs' ? t.mapSection.layerJobs : t.mapSection.layerWorkers}
              </h3>
              <span className="text-xs font-mono-tabular text-slate-500">
                {markerItems.length} results
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-2">
              {markerItems.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <MapPin className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">{t.common.noRecords}</p>
                </div>
              ) : (
                markerItems.map((item) => (
                  <div key={item.id} className="py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <span className="text-xs font-mono-tabular font-semibold text-[#0B3B75] whitespace-nowrap">
                        {item.wageLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.subtitle}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{item.locationLabel}</span>
                      {typeof item.distanceKm === 'number' && (
                        <span className="font-mono-tabular">
                          ~{item.distanceKm} {t.mapSection.distanceUnit}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200 flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>{t.mapSection.privacyNote}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
