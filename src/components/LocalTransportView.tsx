import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  BookmarkCheck,
  Car,
  CheckCircle2,
  Crosshair,
  History,
  LocateFixed,
  MapPin,
  Mic,
  Package,
  PlusCircle,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  calculateDistanceKm,
  getDistrictCoordinates,
  INDIA_STATES_DISTRICTS,
} from '../data/indiaLocations';
import { getVehicleTypeLabel, VEHICLE_TYPE_CATALOG } from '../data/vehicleTypes';
import { useLanguage } from '../i18n/LanguageContext';
import {
  createVehicleBooking,
  recordCustomerOrderPreference,
  saveCustomerDefaultLocation,
} from '../lib/firestoreService';
import {
  detectBestGpsLocation,
  searchLocations,
  type GeoSearchCandidate,
} from '../lib/locationService';
import type {
  AiHirePrefill,
  Language,
  PageRoute,
  VehicleListing,
  VehicleTripType,
  VehicleType,
} from '../types/domain';
import { LocationPinModal } from './LocationPinModal';

interface LocalTransportViewProps {
  vehicles: VehicleListing[];
  initialFilter?: VehicleType | 'passenger' | 'goods' | '';
  aiPrefill?: AiHirePrefill | null;
  onClearAiPrefill?: () => void;
  onOpenAiAssistant: (locationHint?: string) => void;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
}

interface LocationPin {
  lat: number;
  lng: number;
  label: string;
  state: string;
  district: string;
  cityOrVillage: string;
  source: 'gps' | 'search' | 'saved' | 'map';
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

function getVehicleIcon(type: VehicleType): React.ComponentType<{ className?: string }> {
  if (type === 'bike_taxi') return Bike;
  if (type === 'trolley_cart' || type === 'mini_tempo' || type === 'pickup_tempo' || type === 'tractor') {
    return Package;
  }
  return Car;
}

export const LocalTransportView: React.FC<LocalTransportViewProps> = ({
  vehicles,
  initialFilter = '',
  aiPrefill = null,
  onClearAiPrefill,
  onOpenAiAssistant,
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, employerProfile, customerPreference, signInWithGoogle } = useAuth();

  const [transportGroup, setTransportGroup] = useState<'all' | 'passenger' | 'goods'>(
    initialFilter === 'passenger' || initialFilter === 'goods' ? initialFilter : 'all'
  );
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | ''>(
    initialFilter && initialFilter !== 'passenger' && initialFilter !== 'goods' ? initialFilter : ''
  );
  const [vehicleAcOnly, setVehicleAcOnly] = useState(false);
  const [vehicleDriverOnly, setVehicleDriverOnly] = useState(false);
  const [onlyAvailableNow, setOnlyAvailableNow] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'nearest' | 'lowest_rate' | 'top_rated'>('nearest');

  // Location state
  const [selectedState, setSelectedState] = useState(
    customerPreference?.defaultState || employerProfile?.state || ''
  );
  const [selectedDistrict, setSelectedDistrict] = useState(
    customerPreference?.defaultDistrict || employerProfile?.district || ''
  );
  const [locationPin, setLocationPin] = useState<LocationPin | null>(null);
  const [locationSearchInput, setLocationSearchInput] = useState(
    customerPreference?.defaultCityOrVillage || ''
  );
  const [searchCandidates, setSearchCandidates] = useState<GeoSearchCandidate[]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');
  const [gpsWarningMsg, setGpsWarningMsg] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [savingDefaultLoc, setSavingDefaultLoc] = useState(false);

  // 1-step Booking Modal
  const [bookingVehicle, setBookingVehicle] = useState<VehicleListing | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [tripType, setTripType] = useState<VehicleTripType>('one_way');
  const [travelDate, setTravelDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [travelTime, setTravelTime] = useState('09:00');
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [offeredFare, setOfferedFare] = useState<number>(100);
  const [vehicleNote, setVehicleNote] = useState('');
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleBookingDone, setVehicleBookingDone] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (initialFilter === 'passenger' || initialFilter === 'goods') {
      setTransportGroup(initialFilter);
      setSelectedVehicleType('');
    } else if (initialFilter) {
      setSelectedVehicleType(initialFilter);
      const meta = VEHICLE_TYPE_CATALOG.find((v) => v.value === initialFilter);
      if (meta) setTransportGroup(meta.group);
    }
  }, [initialFilter]);

  // Auto-load saved default location from customerPreference once
  useEffect(() => {
    if (!customerPreference || locationPin) return;
    if (customerPreference.defaultState) setSelectedState(customerPreference.defaultState);
    if (customerPreference.defaultDistrict) setSelectedDistrict(customerPreference.defaultDistrict);
    if (customerPreference.defaultCityOrVillage) {
      setLocationSearchInput(customerPreference.defaultCityOrVillage);
    }
    if (
      typeof customerPreference.defaultLat === 'number' &&
      typeof customerPreference.defaultLng === 'number'
    ) {
      setLocationPin({
        lat: customerPreference.defaultLat,
        lng: customerPreference.defaultLng,
        label:
          customerPreference.savedAddressLabel ||
          `${customerPreference.defaultCityOrVillage || customerPreference.defaultDistrict || ''}, ${customerPreference.defaultState || ''}`,
        state: customerPreference.defaultState || '',
        district: customerPreference.defaultDistrict || '',
        cityOrVillage: customerPreference.defaultCityOrVillage || '',
        source: 'saved',
      });
    }
  }, [customerPreference, locationPin]);

  useEffect(() => {
    if (!aiPrefill || aiPrefill.mode !== 'transport') return;
    if (aiPrefill.vehicleType) {
      setSelectedVehicleType(aiPrefill.vehicleType);
      const meta = VEHICLE_TYPE_CATALOG.find((v) => v.value === aiPrefill.vehicleType);
      if (meta) setTransportGroup(meta.group);
    }
    if (aiPrefill.fromLocation) {
      setPickupLocation(aiPrefill.fromLocation);
      setLocationSearchInput(aiPrefill.fromLocation);
      void searchCityLocation(aiPrefill.fromLocation);
    }
    if (aiPrefill.toLocation) setDropLocation(aiPrefill.toLocation);
    if (aiPrefill.tripType) setTripType(aiPrefill.tripType);
    if (aiPrefill.note) setVehicleNote(aiPrefill.note);
    onClearAiPrefill?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill]);

  const activeStateObj = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === selectedState),
    [selectedState]
  );

  const referenceCoords = useMemo(() => {
    if (locationPin) return { lat: locationPin.lat, lng: locationPin.lng };
    if (selectedState && selectedDistrict) {
      return getDistrictCoordinates(selectedState, selectedDistrict);
    }
    if (selectedState && activeStateObj?.districts[0]) {
      return {
        lat: activeStateObj.districts[0].lat,
        lng: activeStateObj.districts[0].lng,
      };
    }
    return null;
  }, [locationPin, selectedState, selectedDistrict, activeStateObj]);

  const applyCandidateLocation = (cand: GeoSearchCandidate, source: LocationPin['source'] = 'search') => {
    const pin: LocationPin = {
      lat: cand.lat,
      lng: cand.lng,
      label: cand.formattedAddress || `${cand.cityOrVillage}, ${cand.state}`,
      state: cand.state || '',
      district: cand.district || '',
      cityOrVillage: cand.cityOrVillage || cand.district || '',
      source,
    };
    setLocationPin(pin);
    if (pin.state && INDIA_STATES_DISTRICTS.some((s) => s.name === pin.state)) {
      setSelectedState(pin.state);
    } else {
      setSelectedState('');
    }
    setSelectedDistrict(pin.district || '');
    setLocationSearchInput(pin.cityOrVillage || pin.district);
    if (radiusKm === 0) setRadiusKm(50);
    setSearchCandidates([]);
    setGpsWarningMsg('');
    setGpsStatusMsg(
      tr(lang, `Location pinned: ${pin.label}`, `स्थान सेट: ${pin.label}`, `ठिकाण सेट झाले: ${pin.label}`)
    );
  };

  const searchCityLocation = async (queryText: string) => {
    const q = queryText.trim();
    if (q.length < 2) return;
    setGpsLoading(true);
    setGpsWarningMsg('');
    setGpsStatusMsg('');
    setSearchCandidates([]);

    try {
      const list = await searchLocations(q, lang);
      if (list.length === 0) {
        setGpsWarningMsg(
          tr(
            lang,
            `Could not find "${q}". Try another town name, 6-digit pincode, or tap "Pin on Map".`,
            `"${q}" नहीं मिला। दूसरा शहर, पिनकोड लिखें या "Pin on Map" दबाएँ।`,
            `"${q}" सापडले नाही. जवळचे शहर, पिनकोड टाका किंवा "नकाशावर पिन करा" वापरा.`
          )
        );
        return;
      }
      applyCandidateLocation(list[0], 'search');
      if (list.length > 1) {
        setSearchCandidates(list);
      }
    } catch (err) {
      setGpsWarningMsg(err instanceof Error ? err.message : 'Unable to search location right now.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleUseGps = async () => {
    setGpsLoading(true);
    setGpsStatusMsg('');
    setGpsWarningMsg('');
    setSearchCandidates([]);

    try {
      const res = await detectBestGpsLocation(lang);
      const pin: LocationPin = {
        lat: res.lat,
        lng: res.lng,
        label: res.formattedAddress || `${res.cityOrVillage}, ${res.district}, ${res.state}`,
        state: res.state,
        district: res.district,
        cityOrVillage: res.cityOrVillage,
        source: 'gps',
      };
      setLocationPin(pin);
      if (pin.state && INDIA_STATES_DISTRICTS.some((s) => s.name === pin.state)) {
        setSelectedState(pin.state);
      }
      setSelectedDistrict(pin.district || '');
      setLocationSearchInput(pin.cityOrVillage || pin.district);
      if (radiusKm === 0) setRadiusKm(50);

      if (res.isApproximate) {
        setGpsWarningMsg(
          tr(
            lang,
            `Network/IP GPS estimate (~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} km accuracy): ${pin.label}. Tap "Pin on Map" or search your exact town/pincode if this looks wrong.`,
            `ब्राउज़र नेटवर्क लोकेशन (~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} किमी दूर): ${pin.label}। गलत होने पर "Pin on Map" दबाएँ या पिनकोड लिखें।`,
            `ब्राउझर नेटवर्क GPS अंदाजे (${res.accuracyMeters ? `~${Math.round(res.accuracyMeters / 1000)} किमी` : 'अंदाजे'}): ${pin.label}. चुकीचे असल्यास "नकाशावर पिन करा" दाबा किंवा शहर/पिनकोड टाका.`
          )
        );
      } else {
        setGpsStatusMsg(
          tr(
            lang,
            `Exact GPS active: ${pin.label}`,
            `सटीक GPS सक्रिय: ${pin.label}`,
            `अचूक GPS लोकेशन सक्रिय: ${pin.label}`
          )
        );
      }
    } catch {
      setGpsWarningMsg(
        tr(
          lang,
          'GPS permission declined or unavailable. Search your town/pincode or tap "Pin on Map".',
          'GPS उपलब्ध नहीं है। शहर/पिनकोड खोजें या "Pin on Map" का उपयोग करें।',
          'GPS उपलब्ध नाही. शहर/पिनकोड शोधा किंवा "नकाशावर पिन करा" वापरा.'
        )
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSaveDefaultLocation = async () => {
    if (!user?.emailVerified) {
      await signInWithGoogle();
      return;
    }
    const effState = locationPin?.state || selectedState;
    const effDist = locationPin?.district || selectedDistrict;
    const effCity = locationPin?.cityOrVillage || locationSearchInput.trim() || effDist;
    if (!effState && !effDist && !effCity) return;

    setSavingDefaultLoc(true);
    try {
      await saveCustomerDefaultLocation(user.uid, {
        state: effState,
        district: effDist,
        cityOrVillage: effCity,
        lat: locationPin?.lat,
        lng: locationPin?.lng,
        savedAddressLabel: locationPin?.label || `${effCity}${effDist ? `, ${effDist}` : ''}`,
      });
      setGpsStatusMsg(
        tr(
          lang,
          'Saved as your default pickup location!',
          'आपकी डिफ़ॉल्ट पिकअप लोकेशन सहेजी गई!',
          'तुमचे नेहमीचे पिकअप ठिकाण प्रोफाईलवर जतन केले!'
        )
      );
    } finally {
      setSavingDefaultLoc(false);
    }
  };

  const resetLocation = () => {
    setSelectedState('');
    setSelectedDistrict('');
    setLocationPin(null);
    setLocationSearchInput('');
    setSearchCandidates([]);
    setRadiusKm(0);
    setGpsStatusMsg('');
    setGpsWarningMsg('');
  };

  const visibleCatalog = useMemo(
    () =>
      VEHICLE_TYPE_CATALOG.filter((item) =>
        transportGroup === 'all' ? true : item.group === transportGroup
      ),
    [transportGroup]
  );

  const enrichedVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = vehicles
      .filter((v) => v.verificationStatus !== 'suspended')
      .filter((v) => !onlyAvailableNow || v.availabilityStatus === 'available')
      .filter((v) => {
        if (selectedVehicleType) return v.vehicleType === selectedVehicleType;
        if (transportGroup === 'all') return true;
        const meta = VEHICLE_TYPE_CATALOG.find((c) => c.value === v.vehicleType);
        return meta?.group === transportGroup;
      })
      .filter((v) => !vehicleAcOnly || v.acAvailable)
      .filter((v) => !vehicleDriverOnly || v.withDriver)
      .map((v) => {
        const distKm =
          referenceCoords && typeof v.approxLat === 'number' && typeof v.approxLng === 'number'
            ? calculateDistanceKm(referenceCoords.lat, referenceCoords.lng, v.approxLat, v.approxLng)
            : null;
        return { vehicle: v, distKm };
      })
      .filter(({ vehicle: v, distKm }) => {
        if (radiusKm > 0 && distKm !== null) {
          return distKm <= radiusKm;
        }
        if (!locationPin && selectedState && v.state !== selectedState) return false;
        if (!locationPin && selectedDistrict && v.district !== selectedDistrict) return false;
        return true;
      })
      .filter(({ vehicle: v }) => {
        if (!q) return true;
        return (
          v.vehicleTitle.toLowerCase().includes(q) ||
          v.ownerDisplayName.toLowerCase().includes(q) ||
          v.district.toLowerCase().includes(q) ||
          v.cityOrVillage.toLowerCase().includes(q) ||
          getVehicleTypeLabel(v.vehicleType, lang).toLowerCase().includes(q) ||
          (v.serviceNotes || '').toLowerCase().includes(q)
        );
      });

    list.sort((a, b) => {
      if (sortBy === 'lowest_rate') return a.vehicle.ratePerKm - b.vehicle.ratePerKm;
      if (sortBy === 'top_rated') return b.vehicle.ratingAvg - a.vehicle.ratingAvg;
      if (a.vehicle.availabilityStatus !== b.vehicle.availabilityStatus) {
        if (a.vehicle.availabilityStatus === 'available') return -1;
        if (b.vehicle.availabilityStatus === 'available') return 1;
      }
      if (a.distKm !== null && b.distKm !== null && a.distKm !== b.distKm) {
        return a.distKm - b.distKm;
      }
      return a.vehicle.ratePerKm - b.vehicle.ratePerKm;
    });

    return list;
  }, [
    vehicles,
    onlyAvailableNow,
    selectedVehicleType,
    transportGroup,
    vehicleAcOnly,
    vehicleDriverOnly,
    referenceCoords,
    radiusKm,
    locationPin,
    selectedState,
    selectedDistrict,
    searchQuery,
    sortBy,
    lang,
  ]);

  const openVehicleBookingModal = (v: VehicleListing) => {
    setBookingVehicle(v);
    setVehicleBookingDone(null);
    setVehicleError('');
    setPickupLocation(
      (prev) =>
        prev ||
        locationPin?.label ||
        customerPreference?.savedAddressLabel ||
        `${v.cityOrVillage}, ${v.district}`
    );
    setPassengersCount(v.vehicleType === 'bike_taxi' ? 1 : 2);
    setOfferedFare(v.minFare > 0 ? v.minFare : v.ratePerDay);
  };

  const handleConfirmVehicleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bookingVehicle) return;
    setVehicleError('');

    if (pickupLocation.trim().length < 2 || dropLocation.trim().length < 2) {
      setVehicleError(
        tr(lang, 'Enter both Pickup and Drop locations.', 'पिकअप और ड्रॉप दोनों स्थान भरें।', 'पिकअप आणि ड्रॉप दोन्ही ठिकाणे भरा.')
      );
      return;
    }

    const customerName = (
      user.displayName ||
      employerProfile?.businessName ||
      user.email?.split('@')[0] ||
      'Customer'
    )
      .trim()
      .slice(0, 120);

    setVehicleSubmitting(true);
    try {
      const bookingId = await createVehicleBooking({
        vehicleId: bookingVehicle.id,
        vehicleTitle: bookingVehicle.vehicleTitle,
        vehicleType: bookingVehicle.vehicleType,
        ownerUid: bookingVehicle.ownerUid,
        customerUid: user.uid,
        customerName: customerName.length >= 2 ? customerName : 'Customer',
        pickupLocation: pickupLocation.trim().slice(0, 160),
        dropLocation: dropLocation.trim().slice(0, 160),
        tripType,
        travelDate,
        travelTime,
        passengersCount: Math.max(1, Math.min(100, Number(passengersCount) || 1)),
        offeredFare: Math.max(0, Number(offeredFare) || 0),
        ...(vehicleNote.trim() ? { note: vehicleNote.trim().slice(0, 600) } : {}),
      });

      await recordCustomerOrderPreference(user.uid, {
        kind: 'transport',
        categoryOrVehicleType: bookingVehicle.vehicleType,
        orderTitle: `${bookingVehicle.vehicleTitle} (${pickupLocation.trim().slice(0, 45)} -> ${dropLocation.trim().slice(0, 45)})`,
        state: locationPin?.state || selectedState || bookingVehicle.state,
        district: locationPin?.district || selectedDistrict || bookingVehicle.district,
        cityOrVillage: locationPin?.cityOrVillage || locationSearchInput.trim() || bookingVehicle.cityOrVillage,
        lat: locationPin?.lat,
        lng: locationPin?.lng,
      });

      setVehicleBookingDone({ id: bookingId, title: bookingVehicle.vehicleTitle });
    } catch (err) {
      setVehicleError(err instanceof Error ? err.message : 'Unable to send vehicle booking.');
    } finally {
      setVehicleSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F4F6F9] min-h-screen pb-16">
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#E06D1B]">
                <Bike className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    lang,
                    'BIKE TAXI · RIDES · LOCAL GOODS TRANSPORT (NO HEAVY TRUCKS)',
                    'बाइक टैक्सी · ऑटो · कार · ट्रॉली एवं स्थानीय मालगाड़ी (भारी ट्रक छोड़कर)',
                    'बाईक टॅक्सी · ऑटो · कार · ट्रॉली व लोकल मालवाहू गाड्या (ट्रक सोडून)'
                  )}
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  'Book Bike Taxi, Auto, Car, Trolley & Local Goods',
                  'बाइक टैक्सी, ऑटो, कार, ट्रॉली या छोटा टेम्पो बुक करें',
                  'बाईक टॅक्सी, ऑटो, कार, ट्रॉली किंवा लोकल मालवाहू गाडी बुक करा'
                )}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAiAssistant(locationPin?.label || selectedDistrict || selectedState)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5 text-amber-300" />
                {tr(lang, 'AI Voice Booking', 'AI बोलकर बुक करें', 'AI बोलून बुक करा')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('register-vehicle')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#E06D1B] text-[#E06D1B] bg-white text-xs font-bold hover:bg-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {tr(lang, 'List Your Bike / Auto / Trolley', 'अपनी बाइक / ऑटो / ट्रॉली जोड़ें', 'तुमची बाईक / ऑटो / ट्रॉली नोंदवा')}
              </button>
            </div>
          </div>

          {/* Frequent Transport Hirer Card pinned at TOP */}
          {user && customerPreference && (customerPreference.totalTransportOrders > 0 || customerPreference.frequentVehicleTypes.length > 0 || customerPreference.savedAddressLabel) && (
            <div className="bg-amber-50/70 border border-[#E06D1B]/40 rounded-md p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B3B75]">
                  <History className="w-4 h-4 text-[#E06D1B]" />
                  <span>
                    {tr(
                      lang,
                      `Frequent Customer Profile · ${customerPreference.totalTransportOrders} transport orders`,
                      `नियमित ग्राहक प्रोफ़ाइल · ${customerPreference.totalTransportOrders} बुकिंग`,
                      `नियमित ग्राहक प्रोफाईल (सर्वात वर) · ${customerPreference.totalTransportOrders} बुकिंग`
                    )}
                  </span>
                </div>
                {customerPreference.savedAddressLabel && (
                  <span className="text-xs font-semibold text-emerald-800 inline-flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    {customerPreference.savedAddressLabel}
                  </span>
                )}
              </div>

              {customerPreference.frequentVehicleTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">
                    {tr(lang, 'Quick Repeat:', 'दोबारा बुक करें:', 'पुन्हा बुक करा:')}
                  </span>
                  {customerPreference.frequentVehicleTypes.slice(0, 5).map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => {
                        setSelectedVehicleType(vt);
                        const meta = VEHICLE_TYPE_CATALOG.find((c) => c.value === vt);
                        if (meta) setTransportGroup(meta.group);
                      }}
                      className={`px-2.5 py-1 rounded border text-xs font-bold cursor-pointer transition-colors ${
                        selectedVehicleType === vt
                          ? 'bg-[#E06D1B] border-[#E06D1B] text-white'
                          : 'bg-white border-amber-300 text-[#0B3B75] hover:bg-amber-100'
                      }`}
                    >
                      {getVehicleTypeLabel(vt, lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GPS + Search + Map Pin Bar */}
          <div className="bg-[#F4F6F9] border border-slate-200 rounded-md p-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                {gpsLoading
                  ? tr(lang, 'Detecting...', 'खोज रहे हैं...', 'शोधत आहे...')
                  : tr(lang, 'Use GPS', 'GPS लोकेशन', 'GPS लोकेशन')}
              </button>

              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                {tr(lang, 'Pin on Map', 'नक्शे पर पिन करें', 'नकाशावर पिन करा')}
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchCityLocation(locationSearchInput);
                }}
                className="flex items-center gap-1 flex-1 min-w-[200px] max-w-sm"
              >
                <input
                  type="text"
                  value={locationSearchInput}
                  onChange={(e) => setLocationSearchInput(e.target.value)}
                  placeholder={tr(
                    lang,
                    'Village, town or 6-digit pincode...',
                    'गाँव, शहर या पिनकोड लिखें...',
                    'गाव, शहर किंवा पिनकोड टाइप करा...'
                  )}
                  className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                />
                <button
                  type="submit"
                  disabled={gpsLoading || locationSearchInput.trim().length < 2}
                  className="px-2.5 py-1.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {tr(lang, 'Set', 'सेट करें', 'सेट करा')}
                </button>
              </form>

              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict('');
                  setLocationPin(null);
                  setGpsStatusMsg('');
                  setGpsWarningMsg('');
                }}
                aria-label="Filter by State"
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-800"
              >
                <option value="">{t.mapSection.allStates}</option>
                {INDIA_STATES_DISTRICTS.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedDistrict}
                disabled={!selectedState}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setLocationPin(null);
                  setGpsWarningMsg('');
                }}
                aria-label="Filter by District"
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{t.mapSection.allDistricts}</option>
                {activeStateObj?.districts.map((dist) => (
                  <option key={dist.name} value={dist.name}>
                    {dist.name}
                  </option>
                ))}
              </select>

              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                aria-label="Distance Radius"
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold font-mono-tabular text-[#0B3B75]"
              >
                <option value={0}>{tr(lang, 'Any Distance', 'पूरा क्षेत्र', 'सर्व अंतर')}</option>
                <option value={15}>Within 15 km</option>
                <option value={50}>Within 50 km</option>
                <option value={150}>Within 150 km</option>
              </select>

              {(selectedState || selectedDistrict || locationPin) && (
                <button
                  type="button"
                  disabled={savingDefaultLoc}
                  onClick={handleSaveDefaultLocation}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  {tr(lang, 'Save Default', 'पता सहेजें', 'पत्ता सेव्ह करा')}
                </button>
              )}

              {(selectedState || locationPin || radiusKm > 0) && (
                <button
                  type="button"
                  onClick={resetLocation}
                  className="text-xs font-semibold text-slate-600 hover:text-[#0B3B75] px-1.5 cursor-pointer whitespace-nowrap"
                >
                  {tr(lang, 'All India', 'पूरा भारत', 'संपूर्ण भारत')}
                </button>
              )}
            </div>

            {searchCandidates.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-600">
                  {tr(lang, 'Matches:', 'सही स्थान चुनें:', 'योग्य ठिकाण निवडा:')}
                </span>
                {searchCandidates.map((c, idx) => (
                  <button
                    key={`${c.lat}-${c.lng}-${idx}`}
                    type="button"
                    onClick={() => applyCandidateLocation(c, 'search')}
                    className="text-xs px-2 py-0.5 rounded bg-white border border-slate-300 hover:border-[#0B3B75] text-slate-800 cursor-pointer"
                  >
                    {c.formattedAddress}
                  </button>
                ))}
              </div>
            )}

            {gpsStatusMsg && (
              <p className="text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
                <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                <span>{gpsStatusMsg}</span>
              </p>
            )}

            {gpsWarningMsg && (
              <p className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>{gpsWarningMsg}</span>
              </p>
            )}
          </div>

          {/* Group Switcher: All | Bike Taxi & Passenger Rides | Local Goods (Trolley / Small & Medium Vehicles, No Heavy Trucks) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => {
                setTransportGroup('all');
                setSelectedVehicleType('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                transportGroup === 'all'
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>{tr(lang, 'All Local Transport', 'सभी स्थानीय वाहन', 'सर्व लोकल ट्रान्सपोर्ट')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTransportGroup('passenger');
                setSelectedVehicleType('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                transportGroup === 'passenger'
                  ? 'bg-[#E06D1B] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>
                {tr(lang, 'Bike Taxi, Auto & Car', 'बाइक टैक्सी, ऑटो व कार', 'बाईक टॅक्सी, ऑटो व कार')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTransportGroup('goods');
                setSelectedVehicleType('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                transportGroup === 'goods'
                  ? 'bg-[#15803D] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>
                {tr(
                  lang,
                  'Local Trolley & Mini Goods (No Trucks)',
                  'ट्रॉली, छोटा हाथी व पिकअप (ट्रक नहीं)',
                  'लोकल ट्रॉली व मालवाहू गाड्या (ट्रक सोडून)'
                )}
              </span>
            </button>
          </div>

          {/* Search + AC/Driver + Vehicle Category Chips */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search Bike Taxi, Auto, Car, Trolley, Chhota Hathi, Pickup or driver...',
                  'बाइक टैक्सी, ऑटो, कार, ट्रॉली, छोटा हाथी या पिकअप खोजें...',
                  'बाईक टॅक्सी, ऑटो, कार, ट्रॉली, छोटा हत्ती किंवा पिकअप शोधा...'
                )}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E06D1B]"
              />
            </div>
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-md px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vehicleAcOnly}
                  onChange={(e) => setVehicleAcOnly(e.target.checked)}
                />
                <span>AC Only</span>
              </label>
              <label className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-md px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vehicleDriverOnly}
                  onChange={(e) => setVehicleDriverOnly(e.target.checked)}
                />
                <span>{tr(lang, 'With Driver', 'ड्राइवर सहित', 'ड्रायव्हरसह')}</span>
              </label>
            </div>
          </div>

          <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5">
            <button
              type="button"
              onClick={() => setSelectedVehicleType('')}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold transition-colors cursor-pointer ${
                selectedVehicleType === ''
                  ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-[#0B3B75]'
              }`}
            >
              <span>{tr(lang, 'All Types', 'सभी प्रकार', 'सर्व प्रकार')}</span>
            </button>
            {visibleCatalog.map((vt) => {
              const Icon = getVehicleIcon(vt.value);
              const active = selectedVehicleType === vt.value;
              const label = lang === 'hi' ? vt.hi.split('(')[0].trim() : lang === 'mr' ? vt.mr.split('(')[0].trim() : vt.en.split('(')[0].trim();
              return (
                <button
                  key={vt.value}
                  type="button"
                  onClick={() => setSelectedVehicleType(active ? '' : vt.value)}
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#E06D1B] border-[#E06D1B] text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-[#0B3B75]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold text-[#0B3B75] font-mono-tabular">
              {enrichedVehicles.length}{' '}
              {tr(lang, 'local vehicles ready', 'स्थानीय वाहन उपलब्ध', 'लोकल वाहने उपलब्ध')}
            </p>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded px-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailableNow}
                onChange={(e) => setOnlyAvailableNow(e.target.checked)}
                className="rounded border-slate-300 text-[#15803D]"
              />
              <span>{tr(lang, 'Available Now Only', 'केवल तुरंत उपलब्ध', 'फक्त तात्काळ उपलब्ध')}</span>
            </label>
          </div>

          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded p-1 self-start sm:self-auto">
            {(
              [
                { id: 'nearest', label: tr(lang, 'Nearest First', 'सबसे नजदीक', 'सर्वात जवळचे') },
                { id: 'lowest_rate', label: tr(lang, 'Lowest Rate', 'कम दर', 'कमी दर') },
                { id: 'top_rated', label: tr(lang, 'Top Rated', 'शीर्ष रेटिंग', 'सर्वोत्तम रेटिंग') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortBy(opt.id)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  sortBy === opt.id ? 'bg-[#0B3B75] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {enrichedVehicles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md p-8 sm:p-10 text-center space-y-4">
            <Bike className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1 max-w-lg mx-auto">
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                {tr(
                  lang,
                  'No matching local transport vehicles in this exact filter yet',
                  'इस क्षेत्र में अभी कोई स्थानीय वाहन सूचीबद्ध नहीं है',
                  'या भागात अद्याप या प्रकारचे वाहन नोंदवलेले नाही'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {tr(
                  lang,
                  'Switch to All India, widen radius, or register your Bike Taxi, Auto, Trolley or Mini Tempo.',
                  'पूरा भारत चुनें, दूरी बढ़ाएँ, या अपनी बाइक टैक्सी, ऑटो, ट्रॉली या टेम्पो जोड़ें।',
                  'संपूर्ण भारत निवडा, अंतर वाढवा किंवा तुमची बाईक टॅक्सी, ऑटो, ट्रॉली किंवा छोटा हत्ती नोंदवा.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {(selectedState || locationPin || radiusKm > 0) && (
                <button
                  type="button"
                  onClick={resetLocation}
                  className="px-4 py-2 rounded border border-slate-300 bg-white text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                >
                  {tr(lang, 'Show All India Vehicles', 'पूरे भारत के वाहन देखें', 'संपूर्ण भारतातील वाहने पहा')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('register-vehicle')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                {tr(lang, 'Register Bike / Auto / Trolley', 'अपना वाहन पंजीकृत करें', 'तुमचे वाहन नोंदवा')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedVehicles.map(({ vehicle: v, distKm }) => {
              const isAvail = v.availabilityStatus === 'available';
              const Icon = getVehicleIcon(v.vehicleType);
              return (
                <div
                  key={v.id}
                  className="bg-white border border-slate-200 hover:border-[#E06D1B] rounded-md p-4 flex flex-col justify-between gap-3.5 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className={isAvail ? 'text-[#15803D]' : 'text-[#C25E00]'}>
                        {isAvail
                          ? tr(lang, 'Available Now', 'तुरंत उपलब्ध', 'तात्काळ उपलब्ध')
                          : tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')}
                        {distKm !== null ? ` · ${distKm} km` : ''}
                      </span>
                      <span className="font-mono-tabular text-slate-500">{v.vehicleNumberMasked}</span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase text-[#0B3B75]">
                          {getVehicleTypeLabel(v.vehicleType, lang)}
                        </p>
                        <h2 className="font-display text-base font-bold text-[#0B3B75] truncate">
                          {v.vehicleTitle}
                        </h2>
                        <p className="text-xs font-semibold text-[#C25E00] truncate">
                          {v.ownerDisplayName} · {v.seatingOrCapacity}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-tabular text-base font-extrabold text-[#15803D]">
                          ₹{v.ratePerKm}/km
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-tabular">
                          ₹{v.ratePerDay}/day
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
                      <span>{v.withDriver ? tr(lang, 'With Rider/Driver', 'ड्राइवर सहित', 'चालकासह') : 'Self Drive'}</span>
                      <span>·</span>
                      <span>{v.acAvailable ? 'AC' : 'Non-AC'}</span>
                      <span>·</span>
                      <span>Min ₹{v.minFare}</span>
                    </div>

                    {v.serviceNotes && (
                      <p className="text-xs text-slate-600 line-clamp-1">{v.serviceNotes}</p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {v.cityOrVillage}, {v.district}, {v.state}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openVehicleBookingModal(v)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] transition-colors cursor-pointer"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tr(lang, 'Book Now', 'तुरंत बुक करें', 'तात्काळ बुक करा')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Pin on Map Modal */}
      <LocationPinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        initialLat={referenceCoords?.lat ?? 19.9615}
        initialLng={referenceCoords?.lng ?? 79.2961}
        initialLabel={locationPin?.label || selectedDistrict || ''}
        onConfirmLocation={(loc) =>
          applyCandidateLocation(
            {
              lat: loc.lat,
              lng: loc.lng,
              state: loc.state,
              district: loc.district,
              cityOrVillage: loc.cityOrVillage,
              formattedAddress: loc.formattedAddress,
            },
            'map'
          )
        }
      />

      {/* 1-Step Booking Modal */}
      {bookingVehicle && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Book Local Transport"
        >
          <div className="w-full max-w-xl bg-white rounded-t-xl sm:rounded-lg border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="bg-[#0B3B75] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#E06D1B] sticky top-0 z-10">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold">
                  {getVehicleTypeLabel(bookingVehicle.vehicleType, lang)}
                </h2>
                <p className="text-xs text-blue-100">
                  {bookingVehicle.vehicleTitle} · {bookingVehicle.ownerDisplayName} · ₹{bookingVehicle.ratePerKm}/km
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingVehicle(null)}
                aria-label="Close modal"
                className="p-1.5 rounded hover:bg-blue-800 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {vehicleBookingDone ? (
              <div className="p-6 sm:p-8 text-center space-y-5">
                <CheckCircle2 className="w-12 h-12 text-[#15803D] mx-auto" />
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                    {tr(lang, 'Booking Request Sent!', 'बुकिंग अनुरोध भेज दिया गया!', 'बुकिंग विनंती पाठवली!')}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {tr(
                      lang,
                      `Your request for ${vehicleBookingDone.title} has been sent. Track confirmation in your Profile.`,
                      `${vehicleBookingDone.title} के लिए आपका अनुरोध भेज दिया गया है।`,
                      `${vehicleBookingDone.title} साठी तुमची विनंती पाठवली आहे.`
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingVehicle(null);
                      onNavigate('employer-dashboard');
                    }}
                    className="px-5 py-2.5 rounded bg-[#0B3B75] text-white text-xs sm:text-sm font-bold hover:bg-[#072A54] cursor-pointer"
                  >
                    {tr(lang, 'Track in Profile', 'प्रोफ़ाइल में देखें', 'प्रोफाईलवर पहा')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingVehicle(null)}
                    className="px-5 py-2.5 rounded border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {tr(lang, 'Close', 'बंद करें', 'बंद करा')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmVehicleBooking} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Pickup Location *', 'पिकअप स्थान *', 'कुठून उचलायचे / जायचे *')}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={160}
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder="e.g., Chandrapur Main Chowk"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Drop / Destination *', 'कहाँ जाना है (ड्रॉप) *', 'कुठे पोहोचवायचे / जायचे *')}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={160}
                      value={dropLocation}
                      onChange={(e) => setDropLocation(e.target.value)}
                      placeholder="e.g., Market Yard / Ballarpur"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {tr(lang, 'Trip Type', 'यात्रा प्रकार', 'प्रवास / भाडे प्रकार')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'one_way', label: tr(lang, 'One Way', 'एक तरफ़ा', 'एकेरी') },
                        { id: 'round_trip', label: tr(lang, 'Round Trip', 'आना-जाना', 'जाऊन-येऊन') },
                        { id: 'hourly', label: tr(lang, 'Hourly', 'प्रति घंटा', 'तासावर') },
                        { id: 'full_day', label: tr(lang, 'Full Day', 'पूरा दिन', 'पूर्ण दिवस') },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTripType(opt.id)}
                        className={`px-2.5 py-2 rounded border text-xs font-bold cursor-pointer ${
                          tripType === opt.id
                            ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Date *', 'तारीख *', 'तारीख *')}
                    </label>
                    <input
                      type="date"
                      required
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Time *', 'समय *', 'वेळ *')}
                    </label>
                    <input
                      type="time"
                      required
                      value={travelTime}
                      onChange={(e) => setTravelTime(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Passengers / Load', 'यात्री / संख्या', 'प्रवासी / नग')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={passengersCount}
                      onChange={(e) => setPassengersCount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Offered Fare (₹)', 'किराया (₹)', 'भाडे (₹)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500000}
                      value={offeredFare}
                      onChange={(e) => setOfferedFare(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'Goods / Ride Note', 'सामान या यात्रा नोट', 'सामान / प्रवासाची माहिती')}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={vehicleNote}
                    onChange={(e) => setVehicleNote(e.target.value)}
                    placeholder="Landmark, items weight, or quick parcel details..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                {vehicleError && (
                  <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {vehicleError}
                  </p>
                )}

                {!user ? (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-[#0B3B75]">
                      {tr(
                        lang,
                        'Sign in once with Google to confirm this booking.',
                        'बुकिंग कन्फर्म करने के लिए Google से साइन इन करें।',
                        'बुकिंग निश्चित करण्यासाठी Google ने साइन इन करा.'
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="w-full py-2.5 px-4 rounded bg-[#0B3B75] text-white text-sm font-bold hover:bg-[#072A54] cursor-pointer"
                    >
                      {t.nav.signIn}
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={vehicleSubmitting}
                    className="w-full py-3 px-4 rounded bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {vehicleSubmitting
                      ? tr(lang, 'Sending Booking...', 'बुक हो रहा है...', 'बुकिंग पाठवत आहे...')
                      : tr(lang, 'Confirm & Book Now', 'कन्फर्म करें और बुक करें', 'निश्चित करा आणि बुक करा')}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
