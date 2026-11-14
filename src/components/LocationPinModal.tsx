import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { CheckCircle2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  detectBestGpsLocation,
  reverseGeocodeCoords,
  searchLocations,
  type GeoSearchCandidate,
} from '../lib/locationService';

interface LocationPinModalProps {
  open: boolean;
  onClose: () => void;
  initialLat: number;
  initialLng: number;
  initialLabel?: string;
  onConfirmLocation: (loc: {
    lat: number;
    lng: number;
    state: string;
    district: string;
    cityOrVillage: string;
    formattedAddress: string;
  }) => void;
}

const MapPanner: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);
  return null;
};

export const LocationPinModal: React.FC<LocationPinModalProps> = ({
  open,
  onClose,
  initialLat,
  initialLng,
  initialLabel = '',
  onConfirmLocation,
}) => {
  const { lang } = useLanguage();
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [pinLat, setPinLat] = useState<number>(initialLat);
  const [pinLng, setPinLng] = useState<number>(initialLng);
  const [resolvedState, setResolvedState] = useState<string>('');
  const [resolvedDistrict, setResolvedDistrict] = useState<string>('');
  const [resolvedCity, setResolvedCity] = useState<string>('');
  const [resolvedAddress, setResolvedAddress] = useState<string>(initialLabel);
  const [searchInput, setSearchInput] = useState<string>('');
  const [candidates, setCandidates] = useState<GeoSearchCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    setPinLat(initialLat);
    setPinLng(initialLng);
    setResolvedAddress(initialLabel);
    setNotice('');
    setCandidates([]);
    void (async () => {
      try {
        const res = await reverseGeocodeCoords(initialLat, initialLng, lang);
        setResolvedState(res.state);
        setResolvedDistrict(res.district);
        setResolvedCity(res.cityOrVillage);
        setResolvedAddress(res.formattedAddress);
      } catch {
        // ignore
      }
    })();
  }, [open, initialLat, initialLng, initialLabel, lang]);

  useEffect(() => {
    if (!apiKey) {
      fetch('/api/public-config')
        .then((r) => r.json())
        .then((d) => {
          if (d?.mapsApiKey) setApiKey(d.mapsApiKey);
        })
        .catch(() => {});
    }
  }, [apiKey]);

  if (!open) return null;

  const handlePinSelect = async (lat: number, lng: number) => {
    setPinLat(lat);
    setPinLng(lng);
    setBusy(true);
    setNotice('');
    try {
      const res = await reverseGeocodeCoords(lat, lng, lang);
      setResolvedState(res.state);
      setResolvedDistrict(res.district);
      setResolvedCity(res.cityOrVillage);
      setResolvedAddress(res.formattedAddress);
    } catch {
      setNotice(
        lang === 'mr'
          ? 'निवडलेल्या बिंदूचा पत्ता तपासता आला नाही.'
          : lang === 'hi'
          ? 'चुने गए स्थान का पता प्राप्त नहीं हो सका।'
          : 'Could not reverse-geocode the selected pin.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const list = await searchLocations(searchInput.trim(), lang);
      setCandidates(list);
      if (list.length > 0) {
        const first = list[0];
        setPinLat(first.lat);
        setPinLng(first.lng);
        setResolvedState(first.state);
        setResolvedDistrict(first.district);
        setResolvedCity(first.cityOrVillage);
        setResolvedAddress(first.formattedAddress);
      } else {
        setNotice(
          lang === 'mr'
            ? 'ठिकाण सापडले नाही. गाव, शहर किंवा पिनकोड टाका.'
            : lang === 'hi'
            ? 'स्थान नहीं मिला। गाँव, शहर या पिनकोड डालें।'
            : 'Location not found. Try a town, ward, or 6-digit pincode.'
        );
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGpsInsideModal = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await detectBestGpsLocation(lang);
      setPinLat(res.lat);
      setPinLng(res.lng);
      setResolvedState(res.state);
      setResolvedDistrict(res.district);
      setResolvedCity(res.cityOrVillage);
      setResolvedAddress(res.formattedAddress);
      if (res.isApproximate) {
        setNotice(
          lang === 'mr'
            ? `सूचना: ब्राउझर नेटवर्क लोकेशन ~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} किमी अंदाजे आहे. नकाशावर बरोबर पिन टॅप करा किंवा वॉर्ड/शहर शोधा.`
            : lang === 'hi'
            ? `सूचना: ब्राउज़र नेटवर्क लोकेशन लगभग ${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} किमी दूर हो सकती है। नक्शे पर सही पिन टैप करें या शहर/पिनकोड खोजें।`
            : `Note: Browser IP/Wi-Fi location has ~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} km variance. Tap the exact spot on the map or search your town/pincode.`
        );
      }
    } catch {
      setNotice(
        lang === 'mr'
          ? 'डिव्हाइस GPS उपलब्ध नाही. कृपया शहर/पिनकोड शोधा किंवा नकाशावर टॅप करा.'
          : lang === 'hi'
          ? 'डिवाइस GPS उपलब्ध नहीं है। कृपया शहर/पिनकोड खोजें या नक्शे पर टैप करें।'
          : 'Device GPS unavailable. Search your town/pincode or tap directly on the map.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-[#0B3B75] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F28C28]" />
              {lang === 'mr'
                ? 'नकाशावर अचूक लोकेशन सेट करा'
                : lang === 'hi'
                ? 'नक्शे पर सटीक लोकेशन सेट करें'
                : 'Pin Exact Location on Map'}
            </h3>
            <p className="text-xs text-slate-200 mt-0.5">
              {lang === 'mr'
                ? 'चुकीचे GPS दुरुस्त करण्यासाठी शहर/पिनकोड शोधा किंवा नकाशावर थेट टॅप करा'
                : lang === 'hi'
                ? 'गलत GPS ठीक करने के लिए शहर/पिनकोड खोजें या नक्शे पर सीधे टैप करें'
                : 'Search your ward/pincode or tap directly on the map to fix GPS drift'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  lang === 'mr'
                    ? 'गाव, वॉर्ड, शहर किंवा 6-अंकी पिनकोड...'
                    : lang === 'hi'
                    ? 'गाँव, मोहल्ला, शहर या 6-अंकीय पिनकोड...'
                    : 'Village, ward, landmark, or 6-digit pincode...'
                }
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-semibold disabled:opacity-60"
            >
              {lang === 'mr' ? 'शोधा' : lang === 'hi' ? 'खोजें' : 'Search'}
            </button>
            <button
              type="button"
              onClick={handleGpsInsideModal}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60"
            >
              <LocateFixed className="w-4 h-4" />
              GPS
            </button>
          </form>

          {candidates.length > 1 && (
            <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
              <p className="text-[11px] font-bold text-slate-600 uppercase">
                {lang === 'mr'
                  ? 'योग्य ठिकाण निवडा:'
                  : lang === 'hi'
                  ? 'सही स्थान चुनें:'
                  : 'Select matching place:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map((c, idx) => (
                  <button
                    key={`${c.lat}-${c.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setPinLat(c.lat);
                      setPinLng(c.lng);
                      setResolvedState(c.state);
                      setResolvedDistrict(c.district);
                      setResolvedCity(c.cityOrVillage);
                      setResolvedAddress(c.formattedAddress);
                    }}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white hover:border-[#0B3B75] hover:bg-blue-50 text-left"
                  >
                    {c.formattedAddress}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notice && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2 text-xs font-medium">
              {notice}
            </div>
          )}

          <div className="h-[290px] w-full rounded border border-slate-200 overflow-hidden bg-slate-100 relative">
            {apiKey ? (
              <APIProvider apiKey={apiKey}>
                <GoogleMap
                  defaultCenter={{ lat: pinLat, lng: pinLng }}
                  defaultZoom={13}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling="greedy"
                  onClick={(ev) => {
                    const latLng = ev.detail.latLng;
                    if (latLng) {
                      void handlePinSelect(latLng.lat, latLng.lng);
                    }
                  }}
                >
                  <MapPanner lat={pinLat} lng={pinLng} />
                  <AdvancedMarker position={{ lat: pinLat, lng: pinLng }} title="Selected Location">
                    <Pin background="#C25E00" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                  </AdvancedMarker>
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-center text-sm text-slate-600">
                {lang === 'mr'
                  ? 'वर शहर किंवा पिनकोड सर्च करा — तुमचे अचूक ठिकाण लगेच सेट होईल.'
                  : lang === 'hi'
                  ? 'ऊपर शहर या पिनकोड सर्च करें — आपका सटीक स्थान तुरंत सेट हो जाएगा।'
                  : 'Search your town or 6-digit pincode above to set your exact coordinates.'}
              </div>
            )}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-emerald-950">
              <p className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                {resolvedCity || resolvedDistrict || 'Selected Location'}
                {resolvedDistrict ? `, ${resolvedDistrict}` : ''}
                {resolvedState ? `, ${resolvedState}` : ''}
              </p>
              <p className="text-emerald-800 mt-0.5 line-clamp-1">{resolvedAddress}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onConfirmLocation({
                  lat: pinLat,
                  lng: pinLng,
                  state: resolvedState,
                  district: resolvedDistrict,
                  cityOrVillage: resolvedCity || resolvedDistrict,
                  formattedAddress: resolvedAddress || `${resolvedCity}, ${resolvedDistrict}`,
                });
                onClose();
              }}
              className="px-4 py-2 rounded bg-[#C25E00] hover:bg-[#9F4D00] text-white text-sm font-bold whitespace-nowrap"
            >
              {lang === 'mr'
                ? 'हेच लोकेशन पक्के करा'
                : lang === 'hi'
                ? 'यही लोकेशन पक्की करें'
                : 'Confirm This Location'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
