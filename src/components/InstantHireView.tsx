import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Crosshair,
  Droplets,
  Flame,
  Hammer,
  HardHat,
  Home,
  LocateFixed,
  MapPin,
  Mic,
  Paintbrush,
  Plus,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Store,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import {
  calculateDistanceKm,
  getDistrictCoordinates,
  INDIA_STATES_DISTRICTS,
} from '../data/indiaLocations';
import { useLanguage } from '../i18n/LanguageContext';
import {
  callNotificationApi,
  createInstantHireRequest,
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
  JobWorkType,
  Language,
  PageRoute,
  PublicWorkerProfile,
  WageUnit,
} from '../types/domain';
import { LocationPinModal } from './LocationPinModal';

interface InstantHireViewProps {
  workers: PublicWorkerProfile[];
  initialCategory?: string;
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

const FEATURED_TRADE_IDS = [
  'electricians',
  'plumbers',
  'carpenters',
  'construction-workers',
  'drivers',
  'painters',
  'technicians-mechanics',
  'welders',
  'helpers-general-labour',
  'cooks-kitchen-staff',
  'housekeeping-cleaning-staff',
  'delivery-personnel',
  'agricultural-workers',
  'domestic-workers',
  'security-guards',
  'shop-retail-employees',
];

function getTradeIcon(categoryId: string): React.ComponentType<{ className?: string }> {
  switch (categoryId) {
    case 'electricians':
      return Zap;
    case 'plumbers':
      return Droplets;
    case 'carpenters':
      return Hammer;
    case 'construction-workers':
      return HardHat;
    case 'drivers':
      return Car;
    case 'painters':
      return Paintbrush;
    case 'technicians-mechanics':
      return Wrench;
    case 'welders':
      return Flame;
    case 'cooks-kitchen-staff':
      return UtensilsCrossed;
    case 'housekeeping-cleaning-staff':
      return Sparkles;
    case 'delivery-personnel':
      return Truck;
    case 'agricultural-workers':
      return Sprout;
    case 'domestic-workers':
      return Home;
    case 'security-guards':
      return ShieldCheck;
    case 'shop-retail-employees':
      return Store;
    default:
      return Users;
  }
}

export const InstantHireView: React.FC<InstantHireViewProps> = ({
  workers,
  initialCategory = '',
  aiPrefill = null,
  onClearAiPrefill,
  onOpenAiAssistant,
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, employerProfile, customerPreference, signInWithGoogle } = useAuth();

  // Accurate Location & Geocoding state
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

  // Worker filters
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailableNow, setOnlyAvailableNow] = useState(true);
  const [sortBy, setSortBy] = useState<'nearest' | 'lowest_rate' | 'top_rated'>('nearest');

  // Swiggy/Blinkit-style worker selection tray
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  // 1-step Worker Checkout Modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'workers' | 'broadcast'>('workers');
  const [workTitle, setWorkTitle] = useState('');
  const [timingMode, setTimingMode] = useState<'urgent' | 'tomorrow' | 'scheduled'>('urgent');
  const [jobDate, setJobDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:30');
  const [locality, setLocality] = useState('');
  const [offeredWage, setOfferedWage] = useState<number>(600);
  const [wageUnit, setWageUnit] = useState<WageUnit>('daily');
  const [workersRequired, setWorkersRequired] = useState<number>(1);
  const [workNote, setWorkNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [bookingResult, setBookingResult] = useState<{
    jobId: string;
    invitedCount: number;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

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

  // Apply AI Assistant Prefill cleanly
  useEffect(() => {
    if (!aiPrefill || aiPrefill.mode === 'transport') return;
    if (aiPrefill.category) setSelectedCategory(aiPrefill.category);
    if (aiPrefill.title) setWorkTitle(aiPrefill.title);
    if (aiPrefill.note) setWorkNote(aiPrefill.note);
    if (aiPrefill.urgency === 'tomorrow') setTimingMode('tomorrow');
    else if (aiPrefill.urgency === 'scheduled') setTimingMode('scheduled');
    else setTimingMode('urgent');

    if (aiPrefill.fromLocation) {
      setLocationSearchInput(aiPrefill.fromLocation);
      void searchCityLocation(aiPrefill.fromLocation);
    }
    onClearAiPrefill?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill]);

  const activeStateObj = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === selectedState),
    [selectedState]
  );

  const featuredCategories = useMemo(
    () =>
      FEATURED_TRADE_IDS.map((id) => EMPLOYMENT_CATEGORIES.find((c) => c.id === id)).filter(
        (c): c is NonNullable<typeof c> => Boolean(c)
      ),
    []
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
      tr(
        lang,
        `Location pinned: ${pin.label}`,
        `चुना गया स्थान: ${pin.label}`,
        `निवडलेले ठिकाण: ${pin.label}`
      )
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
            `Could not find "${q}". Try another town name, pincode, or tap "Pin on Map".`,
            `"${q}" नहीं मिला। कृपया नज़दीकी शहर लिखें या "Pin on Map" दबाएँ।`,
            `"${q}" सापडले नाही. जवळचे शहर टाइप करा किंवा "नकाशावर पिन करा" वापरा.`
          )
        );
        return;
      }
      applyCandidateLocation(list[0], 'search');
      if (list.length > 1) {
        setSearchCandidates(list);
      }
    } catch {
      setGpsWarningMsg('Unable to search city right now.');
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
      } else {
        setSelectedState('');
      }
      setSelectedDistrict(pin.district || '');
      setLocationSearchInput(pin.cityOrVillage || pin.district);
      if (radiusKm === 0) setRadiusKm(50);

      if (res.isApproximate) {
        setGpsWarningMsg(
          tr(
            lang,
            `Browser network/IP GPS (~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} km accuracy): ${pin.label}. Tap "Pin on Map" or search your town/pincode if inaccurate.`,
            `ब्राउज़र नेटवर्क लोकेशन (~${res.accuracyMeters ? Math.round(res.accuracyMeters / 1000) : '?'} किमी दूर): ${pin.label}। गलत हो तो "Pin on Map" दबाएँ या पिनकोड लिखें।`,
            `ब्राउझर नेटवर्क GPS अंदाजे (${res.accuracyMeters ? `~${Math.round(res.accuracyMeters / 1000)} किमी` : 'अंदाजे'}): ${pin.label}. चुकीचे वाटल्यास "नकाशावर पिन करा" दाबा किंवा शहर/पिनकोड टाका.`
          )
        );
      } else {
        setGpsStatusMsg(
          tr(
            lang,
            `Exact GPS active: ${pin.label}`,
            `सटीक GPS लोकेशन सक्रिय: ${pin.label}`,
            `अचूक GPS लोकेशन सक्रिय: ${pin.label}`
          )
        );
      }
    } catch {
      setGpsWarningMsg(
        tr(
          lang,
          'GPS permission declined or unavailable. Type your town/pincode or tap "Pin on Map".',
          'लोकेशन अनुमति अस्वीकृत। कृपया शहर/पिनकोड लिखें या "Pin on Map" दबाएँ।',
          'GPS उपलब्ध नाही. कृपया शहराचे नाव/पिनकोड टाका किंवा "नकाशावर पिन करा" दाबा.'
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
          'Saved as your default hire location!',
          'आपकी डिफ़ॉल्ट हायर लोकेशन प्रोफ़ाइल पर सहेजी गई!',
          'तुमचे नेहमीचे कामगार हायर ठिकाण प्रोफाईलवर जतन केले!'
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

  // Enrich & filter workers using Radius when pinned, OR manual State/District when selected without GPS pin
  const enrichedWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const catObj = EMPLOYMENT_CATEGORIES.find((c) => c.en === selectedCategory);

    const list = workers
      .filter((w) => w.verificationStatus !== 'suspended')
      .filter((w) => !onlyAvailableNow || w.availabilityStatus === 'available')
      .map((w) => {
        const distKm =
          referenceCoords && typeof w.approxLat === 'number' && typeof w.approxLng === 'number'
            ? calculateDistanceKm(referenceCoords.lat, referenceCoords.lng, w.approxLat, w.approxLng)
            : null;
        return { worker: w, distKm };
      })
      .filter(({ worker: w, distKm }) => {
        if (radiusKm > 0 && distKm !== null) {
          return distKm <= radiusKm;
        }
        if (!locationPin && selectedState && w.state !== selectedState) return false;
        if (!locationPin && selectedDistrict && w.district !== selectedDistrict) return false;
        return true;
      })
      .filter(({ worker: w }) => {
        if (!selectedCategory) return true;
        const catLower = selectedCategory.toLowerCase();
        return (
          w.primarySkill.toLowerCase().includes(catLower) ||
          catLower.includes(w.primarySkill.toLowerCase()) ||
          w.skills.some((s) => catLower.includes(s.toLowerCase())) ||
          (catObj
            ? catObj.skillsEn.some(
                (cs) =>
                  w.primarySkill.toLowerCase().includes(cs.toLowerCase()) ||
                  w.skills.some((ws) => ws.toLowerCase().includes(cs.toLowerCase()))
              )
            : false)
        );
      })
      .filter(({ worker: w }) => {
        if (!q) return true;
        return (
          w.displayName.toLowerCase().includes(q) ||
          w.primarySkill.toLowerCase().includes(q) ||
          w.district.toLowerCase().includes(q) ||
          w.cityOrVillage.toLowerCase().includes(q) ||
          w.skills.some((s) => s.toLowerCase().includes(q))
        );
      });

    list.sort((a, b) => {
      if (sortBy === 'lowest_rate') return a.worker.expectedWage - b.worker.expectedWage;
      if (sortBy === 'top_rated') {
        if (b.worker.ratingAvg !== a.worker.ratingAvg) return b.worker.ratingAvg - a.worker.ratingAvg;
        return b.worker.experienceYears - a.worker.experienceYears;
      }
      if (a.worker.availabilityStatus !== b.worker.availabilityStatus) {
        if (a.worker.availabilityStatus === 'available') return -1;
        if (b.worker.availabilityStatus === 'available') return 1;
      }
      if (a.distKm !== null && b.distKm !== null && a.distKm !== b.distKm) {
        return a.distKm - b.distKm;
      }
      return b.worker.ratingAvg - a.worker.ratingAvg;
    });

    return list;
  }, [
    workers,
    onlyAvailableNow,
    referenceCoords,
    radiusKm,
    locationPin,
    selectedState,
    selectedDistrict,
    selectedCategory,
    searchQuery,
    sortBy,
  ]);

  const selectedWorkers = useMemo(
    () => workers.filter((w) => selectedWorkerIds.includes(w.id)),
    [workers, selectedWorkerIds]
  );

  const toggleWorkerInTray = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const openCheckoutWithWorkers = (targetWorkers: PublicWorkerProfile[], mode: 'workers' | 'broadcast') => {
    setCheckoutMode(mode);
    setBookingResult(null);
    setCheckoutError('');

    const primaryTrade =
      selectedCategory || targetWorkers[0]?.primarySkill || EMPLOYMENT_CATEGORIES[0].en;

    const avgWage =
      targetWorkers.length > 0
        ? Math.round(targetWorkers.reduce((sum, w) => sum + (w.expectedWage || 500), 0) / targetWorkers.length)
        : 600;

    setWorkTitle(
      workTitle ||
        tr(lang, `Instant Hire: ${primaryTrade}`, `तुरंत हायर: ${primaryTrade}`, `तातडीची नेमणूक: ${primaryTrade}`)
    );
    setOfferedWage(avgWage);
    setWageUnit(targetWorkers[0]?.wageUnit || 'daily');
    setWorkersRequired(Math.max(1, targetWorkers.length));
    setLocality(
      locationPin?.label ||
        targetWorkers[0]?.cityOrVillage ||
        selectedDistrict ||
        employerProfile?.district ||
        ''
    );
    setCheckoutOpen(true);
  };

  const handleHireSingleNow = (worker: PublicWorkerProfile) => {
    const nextIds = selectedWorkerIds.includes(worker.id)
      ? selectedWorkerIds
      : [...selectedWorkerIds, worker.id];
    setSelectedWorkerIds(nextIds);
    const nextWorkers = workers.filter((w) => nextIds.includes(w.id));
    openCheckoutWithWorkers(nextWorkers, 'workers');
  };

  const handleOpenTrayCheckout = () => {
    if (selectedWorkers.length === 0) return;
    openCheckoutWithWorkers(selectedWorkers, 'workers');
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    if (!user) return;

    const checkoutWorkers = checkoutMode === 'workers' ? selectedWorkers : [];
    const effState =
      locationPin?.state ||
      selectedState ||
      checkoutWorkers[0]?.state ||
      employerProfile?.state ||
      'Maharashtra';
    const effDistrict =
      locationPin?.district ||
      selectedDistrict ||
      checkoutWorkers[0]?.district ||
      employerProfile?.district ||
      INDIA_STATES_DISTRICTS.find((s) => s.name === effState)?.districts[0]?.name ||
      'Chandrapur';
    const coords = locationPin
      ? { lat: locationPin.lat, lng: locationPin.lng }
      : getDistrictCoordinates(effState, effDistrict);

    const cleanCategory =
      (selectedCategory || checkoutWorkers[0]?.primarySkill || 'General Service').trim().slice(0, 80);
    const cleanTitle = workTitle.trim().slice(0, 140) || `Instant ${cleanCategory} Requirement`;
    const safeTitle = cleanTitle.length >= 3 ? cleanTitle : `${cleanTitle} Work`;

    const timingLabel =
      timingMode === 'urgent'
        ? 'Urgent / Today'
        : timingMode === 'tomorrow'
        ? 'Tomorrow'
        : `Scheduled ${jobDate} at ${startTime}`;

    const rawDesc = workNote.trim();
    const cleanDesc =
      rawDesc.length >= 10
        ? rawDesc.slice(0, 2000)
        : `${safeTitle} (${timingLabel}) in ${effDistrict}, ${effState}. ${rawDesc}`.slice(0, 2000);

    const safeLocality = locality.trim().length >= 2 ? locality.trim() : effDistrict;
    const customerName = (
      employerProfile?.businessName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'ROJGAR SETU Customer'
    )
      .trim()
      .slice(0, 160);

    const resolvedWorkType: JobWorkType = timingMode === 'urgent' ? 'urgent' : 'daily_wage';
    const scheduledDateStr =
      timingMode === 'urgent'
        ? new Date().toISOString().split('T')[0]
        : timingMode === 'tomorrow'
        ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
        : jobDate;

    setSubmitting(true);
    try {
      const result = await createInstantHireRequest(
        {
          employerUid: user.uid,
          employerName: customerName.length >= 2 ? customerName : 'Customer',
          title: safeTitle,
          category: cleanCategory.length >= 2 ? cleanCategory : 'General Labour',
          description: cleanDesc,
          workersRequired: Math.max(1, Math.min(5000, Number(workersRequired) || 1)),
          requiredSkills: [cleanCategory.length >= 2 ? cleanCategory : 'General Service'],
          state: effState,
          district: effDistrict,
          cityOrVillage: safeLocality.slice(0, 100),
          workLocationLabel: `${safeLocality}, ${effDistrict}`.slice(0, 160),
          lat: coords.lat,
          lng: coords.lng,
          jobDate: scheduledDateStr,
          startTime,
          duration: timingMode === 'urgent' ? 'Same Day' : '1 Day',
          workType: resolvedWorkType,
          offeredWage: Math.max(0, Number(offeredWage) || 0),
          wageUnit,
          paymentTerms: 'Direct UPI / Cash upon completion',
          contactPreference: 'phone_after_confirm',
          isWomenFriendly: false,
          isAccessible: false,
          biddingEnabled: true,
        },
        checkoutWorkers,
        rawDesc || `${timingLabel} · ${safeLocality}, ${effDistrict}`
      );

      await recordCustomerOrderPreference(user.uid, {
        kind: 'hire',
        categoryOrVehicleType: cleanCategory.length >= 2 ? cleanCategory : 'General Labour',
        orderTitle: safeTitle,
        state: effState,
        district: effDistrict,
        cityOrVillage: safeLocality.slice(0, 100),
        lat: coords.lat,
        lng: coords.lng,
      });

      void callNotificationApi('/api/notifications/send-matching-job', {
        jobId: result.jobId,
      }).catch(() => undefined);

      setBookingResult({
        jobId: result.jobId,
        invitedCount: result.invitedCount,
        title: safeTitle,
      });
      setSelectedWorkerIds([]);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to send instant hire request.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalTrayEstimate = useMemo(
    () => selectedWorkers.reduce((sum, w) => sum + (w.expectedWage || 0), 0),
    [selectedWorkers]
  );

  return (
    <div className="bg-[#F4F6F9] min-h-screen pb-24">
      {/* 1. Top Location, Frequent Hirer & Worker Search Header */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#E06D1B]">
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    lang,
                    'INSTANT WORKER & TECHNICIAN HIRING',
                    'त्वरित कामगार एवं मिस्त्री बुकिंग',
                    'तात्काळ कामगार व कारागीर नेमणूक'
                  )}
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
                {tr(
                  lang,
                  'Hire Verified Skilled & Unskilled Workers Nearby',
                  'अपने पास के कुशल और अकुशल कामगार तुरंत हायर करें',
                  'तुमच्या जवळील कुशल व अकुशल कामगार तात्काळ हायर करा'
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
                {tr(lang, 'AI Voice / Photo Search', 'AI बोलकर या फोटो से खोजें', 'AI बोलून / फोटोने शोधा')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('post-job')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#E06D1B] text-[#E06D1B] bg-white text-xs font-bold hover:bg-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {t.jobs.postTitle}
              </button>
            </div>
          </div>

          {/* Frequent Hirer Card pinned at TOP */}
          {user && customerPreference && (customerPreference.totalHireOrders > 0 || customerPreference.frequentWorkerCategories.length > 0 || customerPreference.savedAddressLabel) && (
            <div className="bg-amber-50/70 border border-[#E06D1B]/40 rounded-md p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B3B75]">
                  <Star className="w-4 h-4 text-[#E06D1B]" />
                  <span>
                    {tr(
                      lang,
                      `Frequent Hirer · ${customerPreference.totalHireOrders} worker orders placed`,
                      `नियमित ग्राहक · ${customerPreference.totalHireOrders} ऑर्डर पूरे`,
                      `नियमित ग्राहक (नेहमीची पसंती — सर्वात वर) · ${customerPreference.totalHireOrders} ऑर्डर`
                    )}
                  </span>
                </div>
                {customerPreference.savedAddressLabel && (
                  <span className="text-xs font-semibold text-emerald-800">
                    {tr(lang, 'Saved:', 'सहेजा पता:', 'नेहमीचा पत्ता:')}{' '}
                    {customerPreference.savedAddressLabel}
                  </span>
                )}
              </div>

              {customerPreference.frequentWorkerCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">
                    {tr(lang, 'Quick Re-Hire:', 'तुरंत दोहराएं:', 'पुन्हा हायर करा:')}
                  </span>
                  {customerPreference.frequentWorkerCategories.slice(0, 6).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded border text-xs font-bold cursor-pointer transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#E06D1B] border-[#E06D1B] text-white'
                          : 'bg-white border-amber-300 text-[#0B3B75] hover:bg-amber-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Accurate City Search + GPS + Pin on Map + State/District + Radius Bar */}
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
                  : tr(lang, 'Use GPS', 'सटीक GPS चुनें', 'GPS लोकेशन')}
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
                    'Type village, town or 6-digit pincode...',
                    'शहर, गांव या पिनकोड लिखें (जैसे चंद्रपुर)...',
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
                <option value={0}>{tr(lang, 'Any Distance / District', 'पूरा क्षेत्र', 'सर्व अंतर')}</option>
                <option value={25}>Within 25 km</option>
                <option value={50}>Within 50 km</option>
                <option value={150}>Within 150 km</option>
              </select>

              {(selectedState || selectedDistrict || locationPin) && (
                <button
                  type="button"
                  disabled={savingDefaultLoc}
                  onClick={handleSaveDefaultLocation}
                  className="px-2.5 py-1.5 rounded border border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                >
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

          {/* Search & Quick Category Strip */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search Electrician, Plumber, Carpenter, Driver, Helper, village or name...',
                  'इलेक्ट्रीशियन, प्लंबर, बढ़ई, ड्राइवर, नाम या गांव खोजें...',
                  'इलेक्ट्रिशियन, प्लंबर, सुतार, ड्रायव्हर, नाव किंवा गाव शोधा...'
                )}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="All 32 Employment Categories"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm font-semibold text-[#0B3B75] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              >
                <option value="">
                  {tr(lang, 'All 32 Trades & Categories', 'सभी 32 काम श्रेणियां', 'सर्व 32 कामाच्या श्रेणी')}
                </option>
                {EMPLOYMENT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.en}>
                    {lang === 'hi' ? cat.hi : lang === 'mr' ? cat.mr : cat.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5"
            role="tablist"
            aria-label="Quick hire trade categories"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`shrink-0 flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-md border text-xs font-bold transition-colors min-w-[92px] cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-[#0B3B75]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="whitespace-nowrap">{tr(lang, 'All Trades', 'सभी काम', 'सर्व कामगार')}</span>
            </button>

            {featuredCategories.map((cat) => {
              const Icon = getTradeIcon(cat.id);
              const isSelected = selectedCategory === cat.en;
              const shortLabel =
                lang === 'hi'
                  ? cat.hi.split('/')[0].trim()
                  : lang === 'mr'
                  ? cat.mr.split('/')[0].trim()
                  : cat.en;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? '' : cat.en)}
                  className={`shrink-0 flex flex-col items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md border text-xs font-bold transition-colors min-w-[106px] cursor-pointer ${
                    isSelected
                      ? 'bg-[#E06D1B] border-[#E06D1B] text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-[#0B3B75] hover:bg-blue-50/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap max-w-[120px] truncate">{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold text-[#0B3B75] font-mono-tabular">
              {enrichedWorkers.length}{' '}
              {tr(lang, 'workers ready', 'कामगार उपलब्ध', 'कामगार उपलब्ध')}
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

        {enrichedWorkers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md p-8 sm:p-10 text-center space-y-4">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1 max-w-lg mx-auto">
              <h2 className="font-display text-lg font-bold text-[#0B3B75]">
                {tr(
                  lang,
                  'No matching workers in this exact filter yet',
                  'इस फ़िल्टर में अभी कोई कामगार नहीं मिला',
                  'या फिल्टरमध्ये अद्याप कामगार उपलब्ध नाहीत'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {tr(
                  lang,
                  'Widen your location to All India, clear a filter, or send an Instant Broadcast Request.',
                  'पूरा भारत चुनें, फ़िल्टर बदलें या तुरंत काम की रिक्वेस्ट भेजें।',
                  'संपूर्ण भारत निवडा, फिल्टर बदला किंवा तातडीची गरज नोंदवा.'
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
                  {tr(lang, 'Show All India Workers', 'पूरे भारत के कामगार देखें', 'संपूर्ण भारतातील कामगार पहा')}
                </button>
              )}
              {onlyAvailableNow && (
                <button
                  type="button"
                  onClick={() => setOnlyAvailableNow(false)}
                  className="px-4 py-2 rounded border border-slate-300 bg-white text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                >
                  {tr(lang, 'Show Busy / All Workers', 'सभी कामगार दिखाएं', 'सर्व कामगार पहा')}
                </button>
              )}
              <button
                type="button"
                onClick={() => openCheckoutWithWorkers([], 'broadcast')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                {tr(
                  lang,
                  `Send Instant ${selectedCategory || 'Worker'} Request`,
                  `तुरंत ${selectedCategory || 'कामगार'} रिक्वेस्ट भेजें`,
                  `तातडीची ${selectedCategory || 'कामगार'} विनंती पाठवा`
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedWorkers.map(({ worker: w, distKm }) => {
              const isAdded = selectedWorkerIds.includes(w.id);
              const isAvail = w.availabilityStatus === 'available';

              return (
                <div
                  key={w.id}
                  className={`bg-white border rounded-md p-4 flex flex-col justify-between gap-3.5 transition-colors ${
                    isAdded ? 'border-[#0B3B75] ring-1 ring-[#0B3B75]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className={isAvail ? 'text-[#15803D]' : 'text-[#C25E00]'}>
                        {isAvail
                          ? tr(lang, 'Available Now', 'तुरंत उपलब्ध', 'तात्काळ उपलब्ध')
                          : w.availabilityStatus === 'busy'
                          ? tr(lang, 'Busy', 'व्यस्त', 'व्यस्त')
                          : tr(lang, 'Offline', 'ऑफलाइन', 'ऑफलाइन')}
                        {distKm !== null ? ` · ${distKm} km` : ''}
                      </span>

                      <span className="font-mono-tabular text-slate-500">
                        {w.verificationStatus === 'verified'
                          ? tr(lang, 'Verified', 'सत्यापित', 'सत्यापित')
                          : w.registrationId}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-base font-bold text-[#0B3B75] truncate">
                          {w.displayName}
                        </h2>
                        <p className="text-xs font-semibold text-[#C25E00] truncate">{w.primarySkill}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-tabular text-base font-extrabold text-[#15803D]">
                          ₹{w.expectedWage.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-500">/ {w.wageUnit}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 font-mono-tabular">
                      <span>
                        {w.experienceYears} {tr(lang, 'yrs exp', 'वर्ष अनुभव', 'वर्षे अनुभव')}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        {w.ratingAvg > 0 ? w.ratingAvg.toFixed(1) : 'New'}
                        {w.completedJobsCount > 0 ? ` (${w.completedJobsCount})` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1">{w.skills.join(' · ')}</p>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {w.cityOrVillage}, {w.district}, {w.state}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleWorkerInTray(w.id)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${
                        isAdded
                          ? 'bg-blue-50 border-[#0B3B75] text-[#0B3B75]'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {tr(lang, 'Selected', 'चयनित', 'निवडले')}
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          {tr(lang, 'Add to Hire', 'चुनें', 'जोडा')}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleHireSingleNow(w)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#E06D1B] text-white text-xs font-bold hover:bg-[#c55b10] transition-colors cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {tr(lang, 'Hire Now', 'तुरंत हायर', 'तात्काळ हायर')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Broadcast Strip at Bottom */}
        <div className="bg-white border border-slate-200 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
              {tr(
                lang,
                'Need a whole team or open instant dispatch in your district?',
                'पूरी टीम या जिले में तुरंत कामगार चाहिए?',
                'संपूर्ण टीम किंवा जिल्ह्यात तात्काळ कामगार हवे आहेत का?'
              )}
            </h3>
            <p className="text-xs text-slate-600">
              {tr(
                lang,
                'Broadcast a 1-step open request without waiting to pick individuals.',
                'बिना अलग-अलग चयन किए एक क्लिक में काम की मांग भेजें।',
                'स्वतंत्रपणे न निवडता एका क्लिकमध्ये कामाची तातडीची विनंती पाठवा.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCheckoutWithWorkers([], 'broadcast')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            {tr(lang, 'Broadcast Instant Request', 'तुरंत रिक्वेस्ट भेजें', 'तातडीची विनंती पाठवा')}
          </button>
        </div>
      </div>

      {/* 5. Sticky Bottom Swiggy / Blinkit-Style Hire Tray */}
      {selectedWorkers.length > 0 && !checkoutOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto">
          <div className="bg-[#072A54] text-white border-2 border-[#E06D1B] rounded-lg shadow-xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300 font-mono-tabular">
                {selectedWorkers.length}{' '}
                {tr(lang, selectedWorkers.length === 1 ? 'worker selected' : 'workers selected', 'कामगार चयनित', 'कामगार निवडले')}{' '}
                · Est. ₹{totalTrayEstimate.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-blue-100 truncate">
                {selectedWorkers.map((w) => w.displayName).join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedWorkerIds([])}
                aria-label="Clear selection"
                className="p-2 rounded border border-blue-700 text-blue-200 hover:bg-blue-900 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleOpenTrayCheckout}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#E06D1B] text-white text-xs sm:text-sm font-bold hover:bg-[#c55b10] whitespace-nowrap cursor-pointer"
              >
                <span>{tr(lang, 'Confirm Hire', 'हायर कन्फर्म करें', 'पुढे जा / हायर करा')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 1-Step Worker Instant Hire Checkout Modal */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Instant Hire Checkout"
        >
          <div className="w-full max-w-xl bg-white rounded-t-xl sm:rounded-lg border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="bg-[#0B3B75] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#E06D1B] sticky top-0 z-10">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold">
                  {tr(lang, '1-Step Instant Hire', '1-स्टेप त्वरित हायर', '१-पायरी तात्काळ नेमणूक')}
                </h2>
                <p className="text-xs text-blue-100">
                  {checkoutMode === 'workers'
                    ? tr(
                        lang,
                        `Direct invitation to ${selectedWorkers.length} selected worker(s)`,
                        `${selectedWorkers.length} चयनित कामगारों को सीधा निमंत्रण`,
                        `निवडलेल्या ${selectedWorkers.length} कामगारांना थेट आमंत्रण`
                      )
                    : tr(
                        lang,
                        'Open instant dispatch for available nearby workers',
                        'नजदीकी उपलब्ध कामगारों के लिए त्वरित मांग',
                        'जवळच्या उपलब्ध कामगारांसाठी तातडीची मागणी'
                      )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded hover:bg-blue-800 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingResult ? (
              <div className="p-6 sm:p-8 text-center space-y-5">
                <CheckCircle2 className="w-12 h-12 text-[#15803D] mx-auto" />
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-bold text-[#0B3B75]">
                    {tr(lang, 'Instant Hire Request Sent!', 'हायर रिक्वेस्ट भेज दी गई!', 'तातडीची विनंती पाठवली!')}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {bookingResult.invitedCount > 0
                      ? tr(
                          lang,
                          `Sent to ${bookingResult.invitedCount} worker(s) for “${bookingResult.title}”. Track acceptance live in your dashboard.`,
                          `“${bookingResult.title}” के लिए ${bookingResult.invitedCount} कामगारों को निमंत्रण भेजा गया।`,
                          `“${bookingResult.title}” साठी ${bookingResult.invitedCount} कामगारांना निमंत्रण पाठवले आहे.`
                        )
                      : tr(
                          lang,
                          `Published “${bookingResult.title}” live for nearby workers.`,
                          `“${bookingResult.title}” को नजदीकी कामगारों के लिए लाइव कर दिया गया है।`,
                          `“${bookingResult.title}” जवळच्या कामगारांसाठी प्रकाशित झाले आहे.`
                        )}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutOpen(false);
                      onNavigate('employer-dashboard');
                    }}
                    className="px-5 py-2.5 rounded bg-[#0B3B75] text-white text-xs sm:text-sm font-bold hover:bg-[#072A54] cursor-pointer"
                  >
                    {tr(lang, 'Track Live Responses', 'लाइव प्रतिक्रिया देखें', 'प्रतिसाद पहा')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(false)}
                    className="px-5 py-2.5 rounded border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {tr(lang, 'Continue Browsing', 'और देखें', 'पुढे पहा')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="p-5 space-y-4">
                {checkoutMode === 'workers' && selectedWorkers.length > 0 && (
                  <div className="bg-[#F4F6F9] border border-slate-200 rounded p-3 space-y-2">
                    <div className="text-xs font-bold text-[#0B3B75]">
                      {tr(lang, 'Selected Workers', 'चयनित कामगार', 'निवडलेले कामगार')} ({selectedWorkers.length})
                    </div>
                    <div className="divide-y divide-slate-200">
                      {selectedWorkers.map((w) => (
                        <div key={w.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{w.displayName}</span>
                            <span className="text-slate-500">
                              {' '}
                              · {w.primarySkill} · ₹{w.expectedWage}/{w.wageUnit}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              toggleWorkerInTray(w.id);
                              if (selectedWorkers.length <= 1) setCheckoutMode('broadcast');
                            }}
                            className="text-red-700 hover:underline font-semibold cursor-pointer"
                          >
                            {tr(lang, 'Remove', 'हटाएं', 'काढा')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'Work / Task Required *', 'काम का विवरण *', 'कामाचे स्वरूप *')}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={140}
                    value={workTitle}
                    onChange={(e) => setWorkTitle(e.target.value)}
                    placeholder="e.g., Door fitting carpenter needed / House wiring repair"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {tr(lang, 'When do you need the worker?', 'कब चाहिए?', 'केव्हा हवे आहे?')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'urgent', label: tr(lang, 'Today / Urgent', 'आज / तुरंत', 'आज / तातडीचे'), icon: Zap },
                        { id: 'tomorrow', label: tr(lang, 'Tomorrow', 'कल', 'उद्या'), icon: Clock },
                        { id: 'scheduled', label: tr(lang, 'Pick Date', 'तारीख चुनें', 'तारीख निवडा'), icon: Calendar },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTimingMode(opt.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded border text-xs font-bold cursor-pointer ${
                            timingMode === opt.id
                              ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {timingMode === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-3 mt-2.5">
                      <input
                        type="date"
                        value={jobDate}
                        onChange={(e) => setJobDate(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded text-xs font-mono-tabular"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Work Location / Area *', 'कार्य स्थान / क्षेत्र *', 'कामाचे ठिकाण / पत्ता *')}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="Sector, Colony, Village or Landmark"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Workers Needed', 'कामगार संख्या', 'कामगारांची संख्या')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={workersRequired}
                      onChange={(e) => setWorkersRequired(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Offered Rate (₹)', 'प्रस्तावित दर (₹)', 'प्रस्तावित दर (₹)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500000}
                      value={offeredWage}
                      onChange={(e) => setOfferedWage(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Rate Basis', 'वेतन इकाई', 'वेतन पद्धत')}
                    </label>
                    <select
                      value={wageUnit}
                      onChange={(e) => setWageUnit(e.target.value as WageUnit)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="daily">{tr(lang, 'Per Day', 'प्रति दिन', 'प्रति दिन')}</option>
                      <option value="hourly">{tr(lang, 'Per Hour', 'प्रति घंटा', 'प्रति तास')}</option>
                      <option value="contract">{tr(lang, 'Fixed Task / Contract', 'ठेका / फिक्स्ड', 'कंत्राट / ठराविक')}</option>
                      <option value="monthly">{tr(lang, 'Per Month', 'प्रति माह', 'प्रति महिना')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'Instructions / Details', 'अतिरिक्त निर्देश', 'कामाची माहिती')}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value)}
                    placeholder={tr(
                      lang,
                      'Tools needed, landmark, or brief description...',
                      'औजार, पता या काम की संक्षिप्त जानकारी...',
                      'लागणारे साहित्य, पत्ता किंवा कामाची थोडक्यात माहिती...'
                    )}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                {checkoutError && (
                  <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {checkoutError}
                  </p>
                )}

                {!user ? (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-[#0B3B75]">
                      {tr(
                        lang,
                        'Sign in once with Google to send this hire request & track worker responses.',
                        'रिक्वेस्ट भेजने के लिए Google से साइन इन करें।',
                        'विनंती पाठवण्यासाठी Google ने साइन इन करा.'
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
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting
                      ? tr(lang, 'Sending Hire Request...', 'रिक्वेस्ट भेजी जा रही है...', 'विनंती पाठवत आहे...')
                      : tr(lang, 'Confirm & Send Instant Hire Request', 'कन्फर्म करें और तुरंत हायर रिक्वेस्ट भेजें', 'निश्चित करा आणि तात्काळ विनंती पाठवा')}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Interactive Google Map Pin Modal */}
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
    </div>
  );
};
