import React, { useEffect, useMemo, useState } from 'react';
import {
  AirVent,
  ArrowLeft,
  ArrowRight,
  Bike,
  Briefcase,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crosshair,
  Droplets,
  Hammer,
  HardHat,
  Loader2,
  MapPin,
  Paintbrush,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Tv,
  Wrench,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  INDIA_STATES_DISTRICTS,
  getDistrictCoordinates,
} from '../data/indiaLocations';
import {
  SERVICE_CATALOG_V2,
  getServiceCategoryLabel,
  getServiceTagline,
  getSubServiceLabel,
  type ServiceCategoryV2,
  type SubServiceItem,
} from '../data/serviceCatalogV2';
import { useLanguage } from '../i18n/LanguageContext';
import {
  extractLastName,
  getWorkerVisibleCustomerName,
  isFemaleCustomerProtected,
} from '../lib/customerPrivacy';
import { getSixStepLabel, toSixStepDealStage } from '../lib/dealWorkflow';
import {
  callNotificationApi,
  createInstantHireRequest,
  expandJobSearchRadius,
  recordCustomerOrderPreference,
  saveCustomerDefaultLocation,
  saveOrderExactAddress,
} from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildApproxLocationLabel,
  getNextRadiusStage,
} from '../lib/smartVoiceJobAlert';
import {
  customProfessionToServiceCategoryV2,
  subscribeApprovedProfessions,
} from '../lib/customProfessionService';
import type { CustomProfessionRecord } from '../types/domain';
import type {
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  PublicWorkerProfile,
  ServiceRadiusKm,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';
import { LocationPinModal } from './LocationPinModal';
import { WorkPhotoUploader } from './WorkPhotoUploader';
import { HomeIdentityHero, HomePublicPortalSections } from './HomePublicPortalSections';
import { SponsoredAdSlider } from './SponsoredAdSlider';

interface CustomerHomeV2Props {
  workers: PublicWorkerProfile[];
  jobs: JobPosting[];
  customerApplications: JobApplication[];
  quickHireOnly?: boolean;
  onNavigate: (route: PageRoute, categoryFilter?: string, targetJobId?: string) => void;
}

interface ActiveLocationState {
  lat: number;
  lng: number;
  label: string;
  state: string;
  district: string;
  cityOrVillage: string;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function getCategoryIcon(id: string): React.ComponentType<{ className?: string }> {
  switch (id) {
    case 'electrician':
      return Zap;
    case 'plumber':
      return Droplets;
    case 'carpenter':
      return Hammer;
    case 'cleaner':
      return Sparkles;
    case 'painter':
      return Paintbrush;
    case 'mechanic':
      return Wrench;
    case 'ac_repair':
      return AirVent;
    case 'appliance_repair':
      return Tv;
    case 'driver':
      return Car;
    case 'daily_labour':
      return HardHat;
    case 'bike_transport':
      return Bike;
    default:
      return Briefcase;
  }
}

export const CustomerHomeV2: React.FC<CustomerHomeV2Props> = ({
  workers,
  jobs,
  customerApplications,
  quickHireOnly = false,
  onNavigate,
}) => {
  const { lang } = useLanguage();
  const { user, workerProfile, employerProfile, employerPrivate, customerPreference, signInWithGoogle } = useAuth();

  // Step machine: 'home' -> 'subservices' -> 'order_form' -> 'searching'
  const [step, setStep] = useState<'home' | 'subservices' | 'order_form' | 'searching'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryV2 | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<SubServiceItem | null>(null);
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);

  useEffect(() => {
    return subscribeApprovedProfessions(setApprovedProfessions);
  }, []);

  // Location State
  const [location, setLocation] = useState<ActiveLocationState>(() => {
    const defaultState = customerPreference?.defaultState || employerProfile?.state || 'Maharashtra';
    const defaultDistrict = customerPreference?.defaultDistrict || employerProfile?.district || 'Chandrapur';
    const fallbackCoords = getDistrictCoordinates(defaultState, defaultDistrict);
    return {
      lat: customerPreference?.defaultLat ?? fallbackCoords.lat,
      lng: customerPreference?.defaultLng ?? fallbackCoords.lng,
      label:
        customerPreference?.savedAddressLabel ||
        `${customerPreference?.defaultCityOrVillage || defaultDistrict}, ${defaultState}`,
      state: defaultState,
      district: defaultDistrict,
      cityOrVillage: customerPreference?.defaultCityOrVillage || defaultDistrict,
    };
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  // Order Form State
  const [workDescription, setWorkDescription] = useState('');
  const [exactServiceAddress, setExactServiceAddress] = useState('');
  const [addressLandmark, setAddressLandmark] = useState('');
  const [workPhotoUrls, setWorkPhotoUrls] = useState<string[]>([]);
  const [preferredTimeType, setPreferredTimeType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Live Searching State (2 km -> 5 km -> 10 km)
  const [createdOrder, setCreatedOrder] = useState<{
    jobId: string;
    title: string;
    category: string;
    notifiedCount: number;
    currentRadiusKm: ServiceRadiusKm;
    expanding: boolean;
    statusMessage: string;
  } | null>(null);

  // Sync saved location preference once available
  useEffect(() => {
    if (!customerPreference) return;
    if (
      typeof customerPreference.defaultLat === 'number' &&
      typeof customerPreference.defaultLng === 'number'
    ) {
      setLocation({
        lat: customerPreference.defaultLat,
        lng: customerPreference.defaultLng,
        label:
          customerPreference.savedAddressLabel ||
          `${customerPreference.defaultCityOrVillage || customerPreference.defaultDistrict || ''}, ${customerPreference.defaultState || ''}`,
        state: customerPreference.defaultState || 'Maharashtra',
        district: customerPreference.defaultDistrict || 'Chandrapur',
        cityOrVillage: customerPreference.defaultCityOrVillage || customerPreference.defaultDistrict || 'Chandrapur',
      });
    }
  }, [customerPreference]);

  // Customer's active ongoing order banner (for instant jump to live tracker)
  const activeCustomerOrder = useMemo(() => {
    if (!user) return null;
    const myOpenJobs = jobs.filter(
      (j) =>
        j.employerUid === user.uid &&
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        j.dealStatus !== 'WORK_COMPLETED' &&
        j.dealStatus !== 'CANCELLED'
    );
    if (myOpenJobs.length === 0) return null;
    const latestJob = myOpenJobs[0];
    const matchingApp = customerApplications.find(
      (a) => a.jobId === latestJob.id && a.status !== 'declined'
    );
    return { job: latestJob, app: matchingApp };
  }, [jobs, customerApplications, user]);

  const approvedCustomCatalog = useMemo(() => {
    const builtInIds = new Set(SERVICE_CATALOG_V2.map((c) => c.id.toLowerCase()));
    const builtInNames = new Set(SERVICE_CATALOG_V2.map((c) => c.en.toLowerCase()));
    return approvedProfessions
      .filter((p) => p.status === 'approved')
      .filter((p) => !builtInIds.has(p.slug.toLowerCase()) && !builtInNames.has(p.nameEn.toLowerCase()))
      .map(customProfessionToServiceCategoryV2);
  }, [approvedProfessions]);

  const allCatalogCategories = useMemo(
    () => [...SERVICE_CATALOG_V2, ...approvedCustomCatalog],
    [approvedCustomCatalog]
  );

  // Filter categories & sub-services by search query (includes Admin-approved custom professions)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        categories: SERVICE_CATALOG_V2,
        customCategories: approvedCustomCatalog,
        matchingSubs: [] as Array<{ cat: ServiceCategoryV2; sub: SubServiceItem }>,
      };
    }

    const keywordsBySlug = new Map<string, string>();
    approvedProfessions.forEach((p) => {
      keywordsBySlug.set(
        p.slug,
        `${p.nameEn} ${p.nameHi || ''} ${p.nameMr || ''} ${p.description || ''} ${(p.keywords || []).join(' ')}`.toLowerCase()
      );
    });

    const matchingCats = allCatalogCategories.filter((cat) => {
      const extraKw = keywordsBySlug.get(cat.id.replace(/^custom_/, '')) || '';
      const catText = `${cat.en} ${cat.hi} ${cat.mr} ${cat.taglineEn} ${cat.taglineHi} ${cat.taglineMr} ${cat.canonicalCategory} ${extraKw}`.toLowerCase();
      if (catText.includes(q)) return true;
      return cat.subServices.some((s) => `${s.en} ${s.hi} ${s.mr}`.toLowerCase().includes(q));
    });

    const matchingSubs: Array<{ cat: ServiceCategoryV2; sub: SubServiceItem }> = [];
    allCatalogCategories.forEach((cat) => {
      if (cat.isTransport) return;
      cat.subServices.forEach((sub) => {
        if (`${sub.en} ${sub.hi} ${sub.mr}`.toLowerCase().includes(q)) {
          matchingSubs.push({ cat, sub });
        }
      });
    });

    return {
      categories: matchingCats,
      customCategories: [] as ServiceCategoryV2[],
      matchingSubs: matchingSubs.slice(0, 6),
    };
  }, [searchQuery, allCatalogCategories, approvedCustomCatalog, approvedProfessions]);

  const handleDetectGps = async () => {
    setGpsLoading(true);
    try {
      const geo = await detectBestGpsLocation(lang);
      const nextLoc: ActiveLocationState = {
        lat: geo.lat,
        lng: geo.lng,
        label: geo.formattedAddress || `${geo.cityOrVillage}, ${geo.district}`,
        state: geo.state || location.state,
        district: geo.district || location.district,
        cityOrVillage: geo.cityOrVillage || geo.district || location.cityOrVillage,
      };
      setLocation(nextLoc);
      if (user?.emailVerified) {
        void saveCustomerDefaultLocation(user.uid, {
          state: nextLoc.state,
          district: nextLoc.district,
          cityOrVillage: nextLoc.cityOrVillage,
          lat: nextLoc.lat,
          lng: nextLoc.lng,
          savedAddressLabel: nextLoc.label,
        }).catch(() => undefined);
      }
    } catch {
      setShowPinModal(true);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSelectCategory = (cat: ServiceCategoryV2) => {
    if (cat.isTransport) {
      onNavigate('transport');
      return;
    }
    setSelectedCategory(cat);
    setSelectedSubService(null);
    setFormError('');
    setStep('subservices');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSubService = (cat: ServiceCategoryV2, sub: SubServiceItem) => {
    setSelectedCategory(cat);
    setSelectedSubService(sub);
    setFormError('');
    setStep('order_form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedCategory || !selectedSubService) return;

    if (!user?.emailVerified) {
      await signInWithGoogle();
      return;
    }

    const genderProtected = isFemaleCustomerProtected({
      gender: employerProfile?.gender || employerPrivate?.gender,
    });
    const resolvedLastName =
      employerProfile?.lastName ||
      employerPrivate?.lastName ||
      extractLastName(employerPrivate?.contactPerson || user.displayName || '');
    const customerName = getWorkerVisibleCustomerName({
      employerProfile,
      employerPrivate,
      fallbackName: user.displayName || user.email?.split('@')[0] || 'Customer',
      viewerRole: 'worker',
    }).slice(0, 160);

    const subLabelEn = selectedSubService.en;
    const catLabelEn = selectedCategory.en;
    const title = `${catLabelEn}: ${subLabelEn}`.slice(0, 140);
    const cleanedDesc = workDescription.trim();
    const finalDescription =
      cleanedDesc.length >= 10
        ? cleanedDesc.slice(0, 2000)
        : `${subLabelEn} (${catLabelEn}) needed at ${location.cityOrVillage}, ${location.district}. ${cleanedDesc}`.trim().slice(0, 2000);

    const effState = location.state || 'Maharashtra';
    const effDistrict =
      location.district ||
      INDIA_STATES_DISTRICTS.find((s) => s.name === effState)?.districts[0]?.name ||
      'Chandrapur';
    const safeCity = (location.cityOrVillage || effDistrict).slice(0, 100);
    const approxLocationLabel = buildApproxLocationLabel({
      cityOrVillage: safeCity,
      district: effDistrict,
      state: effState,
    });

    const jobDate =
      preferredTimeType === 'now'
        ? new Date().toISOString().split('T')[0]
        : scheduledDate;
    const startTime =
      preferredTimeType === 'now'
        ? new Date().toTimeString().slice(0, 5)
        : scheduledTime;

    setSubmitting(true);
    setStep('searching');
    setCreatedOrder({
      jobId: '',
      title,
      category: selectedCategory.canonicalCategory,
      notifiedCount: 0,
      currentRadiusKm: 2,
      expanding: true,
      statusMessage: tr(
        lang,
        'Searching nearby available workers within 2 km...',
        'आपके नज़दीक 2 किमी में उपलब्ध कामगार खोज रहे हैं...',
        'आपल्या जवळचा कामगार शोधत आहोत...'
      ),
    });

    try {
      const idempotencyKey = `rs2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const trimmedExactAddress = (
        exactServiceAddress.trim() ||
        employerPrivate?.businessAddress?.trim() ||
        location.label
      ).slice(0, 320);
      const hasExactVault = trimmedExactAddress.length >= 4;

      const res = await createInstantHireRequest(
        {
          employerUid: user.uid,
          employerName: customerName.length >= 2 ? customerName : 'Customer',
          customerGenderProtected: genderProtected,
          ...(resolvedLastName && resolvedLastName !== 'Customer'
            ? { customerLastName: resolvedLastName.slice(0, 60) }
            : {}),
          hasExactAddressVault: hasExactVault,
          title,
          category: selectedCategory.canonicalCategory,
          subService: subLabelEn.slice(0, 100),
          preferredTimeType,
          description: finalDescription,
          workersRequired: 1,
          requiredSkills: [selectedCategory.canonicalCategory, subLabelEn].slice(0, 10),
          state: effState,
          district: effDistrict,
          cityOrVillage: safeCity,
          workLocationLabel: approxLocationLabel.slice(0, 160),
          approxLocationLabel: approxLocationLabel.slice(0, 160),
          initialRadiusKm: 2,
          currentRadiusKm: 2,
          lat: location.lat,
          lng: location.lng,
          jobDate,
          startTime,
          duration: selectedSubService.estimatedDuration,
          workType: preferredTimeType === 'now' ? 'urgent' : 'daily_wage',
          offeredWage: 0,
          wageUnit: 'contract',
          paymentTerms: 'Direct UPI / Cash after work completion',
          contactPreference: 'platform_message',
          isWomenFriendly: false,
          isAccessible: false,
          biddingEnabled: true,
          orderKind: 'work',
          ...(workPhotoUrls.length > 0 ? { workPhotoUrls } : {}),
        },
        [],
        finalDescription,
        idempotencyKey,
        workers
      );

      if (hasExactVault && res.jobId) {
        await saveOrderExactAddress({
          jobId: res.jobId,
          employerUid: user.uid,
          exactAddress: trimmedExactAddress,
          landmark: addressLandmark.trim().slice(0, 160),
          exactLat: location.lat,
          exactLng: location.lng,
        }).catch(() => undefined);
      }

      await recordCustomerOrderPreference(user.uid, {
        kind: 'hire',
        categoryOrVehicleType: selectedCategory.canonicalCategory,
        orderTitle: title,
        state: effState,
        district: effDistrict,
        cityOrVillage: safeCity,
        lat: location.lat,
        lng: location.lng,
      }).catch(() => undefined);

      // Trigger real FCM push broadcast (starts at 2 km, auto-expands 5 km -> 10 km if empty)
      let fcmMatched = res.notifiedCount;
      let finalRadius: ServiceRadiusKm = res.finalRadiusKm ?? 2;
      try {
        const pushRes = await callNotificationApi('/api/notifications/send-matching-job', {
          jobId: res.jobId,
          stageRadiusKm: 2,
          autoExpandIfEmpty: true,
        });
        const pushData = pushRes.data || {};
        if (typeof pushData.totalNotifiedCount === 'number' && pushData.totalNotifiedCount > fcmMatched) {
          fcmMatched = pushData.totalNotifiedCount;
        }
        if (
          pushData.currentRadiusKm === 2 ||
          pushData.currentRadiusKm === 5 ||
          pushData.currentRadiusKm === 10 ||
          pushData.currentRadiusKm === 20 ||
          pushData.currentRadiusKm === 30
        ) {
          finalRadius = pushData.currentRadiusKm;
        }
      } catch {
        // Non-blocking: in-app Firestore notification already succeeded
      }

      setCreatedOrder({
        jobId: res.jobId,
        title,
        category: selectedCategory.canonicalCategory,
        notifiedCount: fcmMatched,
        currentRadiusKm: finalRadius,
        expanding: false,
        statusMessage:
          fcmMatched > 0
            ? tr(
                lang,
                `Request sent to ${fcmMatched} nearby worker(s) within ${finalRadius} km.`,
                `${finalRadius} किमी के दायरे में ${fcmMatched} कामगारों को रिक्वेस्ट भेज दी गई है।`,
                `कामगाराला रिक्वेस्ट पाठवली आहे. (${finalRadius} किमी मध्ये ${fcmMatched} कामगार)`
              )
            : tr(
                lang,
                `Request saved. No worker matched within ${finalRadius} km yet — expand radius or check offers in My Orders.`,
                `रिक्वेस्ट सेव हो गई है। अभी ${finalRadius} किमी में उपलब्ध कामगार नहीं मिले — दायरा बढ़ाएँ।`,
                `रिक्वेस्ट जतन झाली आहे. ${finalRadius} किमी मध्ये सध्या उपलब्ध कामगार नाहीत — अंतर वाढवून पुन्हा शोधा.`
              ),
      });

      setWorkDescription('');
      setExactServiceAddress('');
      setAddressLandmark('');
      setWorkPhotoUrls([]);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : tr(
              lang,
              'Could not send request. Please try again.',
              'रिक्वेस्ट नहीं भेजी जा सकी। कृपया पुनः प्रयास करें।',
              'रिक्वेस्ट पाठवता आली नाही. कृपया पुन्हा प्रयत्न करा.'
            )
      );
      setStep('order_form');
      setCreatedOrder(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpandRadiusNow = async () => {
    if (!createdOrder?.jobId) return;
    const nextStage = getNextRadiusStage(createdOrder.currentRadiusKm);
    if (!nextStage) return;

    const jobObj = jobs.find((j) => j.id === createdOrder.jobId);
    if (!jobObj) return;

    setCreatedOrder((prev) => (prev ? { ...prev, expanding: true } : prev));
    try {
      const res = await expandJobSearchRadius({
        job: jobObj,
        workers,
        targetRadiusKm: nextStage,
      });
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              currentRadiusKm: res.currentRadiusKm,
              notifiedCount: Math.max(prev.notifiedCount, res.totalNotifiedCount),
              expanding: false,
              statusMessage: tr(
                lang,
                `Expanded search to ${res.currentRadiusKm} km · ${res.totalNotifiedCount} worker(s) notified.`,
                `खोज का दायरा ${res.currentRadiusKm} किमी तक बढ़ाया · ${res.totalNotifiedCount} कामगारों को सूचना भेजी।`,
                `शोध अंतर ${res.currentRadiusKm} किमी पर्यंत वाढवले · ${res.totalNotifiedCount} कामगारांना रिक्वेस्ट पाठवली.`
              ),
            }
          : prev
      );
    } catch {
      setCreatedOrder((prev) => (prev ? { ...prev, expanding: false } : prev));
    }
  };

  const resetToHome = () => {
    setStep('home');
    setSelectedCategory(null);
    setSelectedSubService(null);
    setCreatedOrder(null);
    setFormError('');
  };

  const openJobsCount = useMemo(
    () => jobs.filter((j) => j.status === 'open').length,
    [jobs]
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F8FAFC] pb-24 md:pb-12">
      {/* Sections 1–4: Public-Service Identity Hero with Mahatma Gandhi Portrait & Primary Actions (only on Home screen) */}
      {step === 'home' && !quickHireOnly && (
        <HomeIdentityHero
          workersCount={workers.length}
          openJobsCount={openJobsCount}
          onFindWork={() => onNavigate('find-work')}
          onFindWorkers={() => onNavigate('find-workers')}
          onJumpToServices={() => {
            const el = document.getElementById('popular-services');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      {/* Top Location & Search Strip */}
      <div id="popular-services" className="bg-white border-b border-slate-200/80 scroll-mt-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Location Display + Change */}
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#E06D1B]" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {tr(lang, 'Service Location', 'सेवा स्थान', 'सेवेचे ठिकाण')}
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#0B3B75] truncate max-w-[210px] sm:max-w-[280px] group-hover:text-[#E06D1B] transition-colors">
                  {location.label}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0B3B75] transition-colors cursor-pointer"
              >
                <Crosshair className={`w-3.5 h-3.5 text-[#E06D1B] ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{tr(lang, 'GPS', 'GPS', 'GPS')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {tr(lang, 'Change', 'बदलें', 'बदला')}
              </button>
            </div>
          </div>

          {/* Service Search Box (visible on Home) */}
          {step === 'home' && (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search electrician, plumber, AC...',
                  'इलेक्ट्रीशियन, प्लंबर, AC खोजें...',
                  'इलेक्ट्रिशियन, प्लंबर, AC शोधा...'
                )}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {/* ================= VIEW 1: SERVICE HOME ================= */}
        {step === 'home' && (
          <div className="space-y-6">
            {/* Active Order Quick-Jump Banner (only if customer has an ongoing job) */}
            {activeCustomerOrder && (
              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                    {tr(lang, 'Active Request', 'सक्रिय रिक्वेस्ट', 'सुरू असलेली रिक्वेस्ट')} ·{' '}
                    {getSixStepLabel(
                      toSixStepDealStage(activeCustomerOrder.app || activeCustomerOrder.job.dealStatus),
                      lang,
                      activeCustomerOrder.app?.dealStatus === 'WORKER_ARRIVED'
                    )}
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-[#0B3B75] truncate">
                    {activeCustomerOrder.job.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('employer-dashboard', undefined, activeCustomerOrder.job.id)}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#15803D] text-white text-xs sm:text-sm font-bold hover:bg-[#116830] transition-colors shrink-0 cursor-pointer"
                >
                  <span>{tr(lang, 'Track Live Order', 'लाइव ऑर्डर देखें', 'लाइव्ह ऑर्डर पहा')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Prominent Marathi Brand Slogan Banner */}
            <BrandSloganBanner variant="dashboard" />

            {/* Clean Greeting Headline */}
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B3B75] tracking-tight leading-snug">
                {tr(
                  lang,
                  'Hello! What work do you need done today?',
                  'नमस्कार! आज कौन सा काम करवाना है?',
                  'नमस्कार! आज कोणते काम करून घ्यायचे आहे?'
                )}
              </h1>
              <p className="text-sm text-slate-600">
                {tr(
                  lang,
                  'Select a service below to connect directly with verified nearby workers.',
                  'नीचे सेवा चुनें और अपने नज़दीकी कामगार से सीधे जुड़ें।',
                  'खालील सेवा निवडा आणि तुमच्या जवळच्या कामगाराशी थेट संपर्क साधा.'
                )}
              </p>
            </div>

            {/* Instant Matching Sub-Services when searching */}
            {searchResults.matchingSubs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-slate-500 px-1">
                  {tr(lang, 'Direct Service Matches', 'सीधी सेवा मिलान', 'थेट सेवा पर्याय')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {searchResults.matchingSubs.map(({ cat, sub }) => (
                    <button
                      key={`${cat.id}_${sub.id}`}
                      type="button"
                      onClick={() => handleSelectSubService(cat, sub)}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-[#0B3B75] bg-slate-50/70 hover:bg-white text-left transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0B3B75] truncate">
                          {getSubServiceLabel(sub, lang)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {getServiceCategoryLabel(cat, lang)} · {sub.estimatedDuration}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 12 Large Visual Service Category Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {searchResults.categories.map((cat) => {
                const Icon = getCategoryIcon(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`group text-left bg-white rounded-xl border p-4 sm:p-5 transition-all hover:shadow-md active:scale-[0.99] cursor-pointer flex flex-col justify-between min-h-[146px] sm:min-h-[164px] ${
                      cat.isTransport
                        ? 'border-emerald-300 hover:border-[#15803D]'
                        : 'border-slate-200/90 hover:border-[#0B3B75]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${cat.accentBg} ${cat.accentBorder}`}
                      >
                        <Icon className={`w-6 h-6 ${cat.accentText}`} />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="font-display text-sm sm:text-base font-extrabold text-[#0B3B75] group-hover:text-[#E06D1B] transition-colors leading-snug">
                        {getServiceCategoryLabel(cat, lang)}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {getServiceTagline(cat, lang)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Admin-Approved Dynamic Specialized Professions (A-to-Z Inclusivity) */}
            {searchResults.customCategories.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75]">
                      {tr(
                        lang,
                        'More Approved Professions & Local Skills',
                        'अन्य स्वीकृत व्यवसाय और स्थानीय कौशल',
                        'अधिक मंजूर व्यवसाय आणि स्थानिक कौशल्ये'
                      )}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {tr(
                        lang,
                        'Verified specialized professions available for instant location-based hiring.',
                        'सत्यापित विशेष व्यवसाय — नज़दीकी कामगार तुरंत बुक करें।',
                        'सत्यापित विशेष व्यवसाय — जवळच्या कुशल कामगारांना थेट कामाची विनंती पाठवा.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {searchResults.customCategories.map((cat) => {
                    const Icon = getCategoryIcon(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className="group text-left bg-white rounded-xl border border-indigo-200/80 hover:border-[#0B3B75] p-4 transition-all hover:shadow-md active:scale-[0.99] cursor-pointer flex flex-col justify-between min-h-[132px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cat.accentBg} ${cat.accentBorder}`}>
                            <Icon className={`w-5 h-5 ${cat.accentText}`} />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {tr(lang, 'Verified', 'सत्यापित', 'मंजूर')}
                          </span>
                        </div>
                        <div className="mt-2.5 space-y-0.5">
                          <div className="font-display text-sm font-extrabold text-[#0B3B75] group-hover:text-[#E06D1B] transition-colors leading-snug">
                            {getServiceCategoryLabel(cat, lang)}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {getServiceTagline(cat, lang)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {searchResults.categories.length === 0 && searchResults.customCategories.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
                <p className="text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'No matching service found.', 'कोई मेल खाती सेवा नहीं मिली।', 'जुळणारी सेवा सापडली नाही.')}
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold text-[#E06D1B] hover:underline cursor-pointer"
                >
                  {tr(lang, 'Show all services', 'सभी सेवाएँ देखें', 'सर्व सेवा पहा')}
                </button>
              </div>
            )}

            {/* Sponsored Local Business Advertisement Slider (Homepage Placement) */}
            <SponsoredAdSlider
              category="all"
              state={location.state}
              district={location.district}
              city={location.cityOrVillage}
              placement="homepage"
              onNavigate={(r) => onNavigate(r)}
            />

            {/* Compact Worker Callout only in quickHireOnly mode (full Home displays Section 6 below) */}
            {quickHireOnly && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-[#0B3B75]" />
                </div>
                <div>
                  <div className="text-sm sm:text-base font-extrabold text-[#0B3B75]">
                    {workerProfile
                      ? tr(lang, 'Switch to Worker Dashboard', 'कामगार डैशबोर्ड खोलें', 'कामगार डॅशबोर्ड उघडा')
                      : tr(lang, 'Are you a skilled worker or bike rider?', 'क्या आप कामगार या बाइक राइडर हैं?', 'तुम्ही कुशल कामगार किंवा बाईक रायडर आहात का?')}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {workerProfile
                      ? tr(lang, 'View nearby job opportunities and toggle your availability.', 'आस-पास के काम देखें और अपनी उपलब्धता चालू करें।', 'जवळच्या कामाच्या संधी पहा आणि उपलब्धता सुरू करा.')
                      : tr(lang, 'Get direct customer requests near you with zero commission.', 'बिना कमीशन अपने आस-पास सीधे काम के ऑर्डर पाएँ।', 'शून्य कमिशनमध्ये तुमच्या जवळ थेट कामाच्या ऑर्डर्स मिळवा.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(workerProfile ? 'worker-dashboard' : 'register-worker')}
                className="h-11 px-5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs sm:text-sm font-bold transition-colors shrink-0 cursor-pointer"
              >
                {workerProfile
                  ? tr(lang, 'Open Worker App', 'कामगार ऐप खोलें', 'कामगार ॲप उघडा')
                  : tr(lang, 'Register as Worker', 'कामगार पंजीकरण', 'कामगार नोंदणी करा')}
              </button>
            </div>
            )}
          </div>
        )}

        {/* ================= VIEW 2: CATEGORY SUB-SERVICES ONLY ================= */}
        {step === 'subservices' && selectedCategory && (
          <div className="max-w-3xl mx-auto space-y-5">
            <button
              type="button"
              onClick={resetToHome}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0B3B75] hover:text-[#E06D1B] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{tr(lang, 'All Services', 'सभी सेवाएँ', 'सर्व सेवा')}</span>
            </button>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-[#E06D1B]">
                {tr(lang, 'Step 1 of 2 · Choose Work Type', 'चरण 1 / 2 · काम का प्रकार चुनें', 'पायरी १ / २ · कामाचा प्रकार निवडा')}
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
                {getServiceCategoryLabel(selectedCategory, lang)}
              </h1>
              <p className="text-sm text-slate-600">
                {tr(
                  lang,
                  'Select the specific work you need. Only matching workers in this category will be notified.',
                  'अपना सटीक काम चुनें। केवल इसी श्रेणी के कामगारों को रिक्वेस्ट भेजी जाएगी।',
                  'तुम्हाला हवे असलेले नेमके काम निवडा. फक्त याच प्रकारच्या कामगारांना रिक्वेस्ट पाठवली जाईल.'
                )}
              </p>
            </div>

            {/* Category-Matched Sponsored Advertisement Slider (Strictly relevant to selectedCategory) */}
            <SponsoredAdSlider
              category={selectedCategory.id}
              categoryLabel={getServiceCategoryLabel(selectedCategory, lang)}
              state={location.state}
              district={location.district}
              city={location.cityOrVillage}
              placement="category_selection"
              onNavigate={(r) => onNavigate(r)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedCategory.subServices.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubService(selectedCategory, sub)}
                  className="bg-white border border-slate-200 hover:border-[#0B3B75] rounded-xl p-4 text-left flex items-center justify-between gap-3 transition-all hover:shadow-sm cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm sm:text-base font-extrabold text-[#0B3B75] group-hover:text-[#E06D1B] transition-colors">
                      {getSubServiceLabel(sub, lang)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#15803D]">
                        {tr(
                          lang,
                          'Worker quotes after review',
                          'कामगार काम/फ़ोटो देखकर दर बताएगा',
                          'कामगार काम व फोटो पाहून दर सांगेल'
                        )}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sub.estimatedDuration}
                      </span>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[#E06D1B] group-hover:text-white text-slate-500 flex items-center justify-center shrink-0 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= VIEW 3: SIMPLE CUSTOMER ORDER FORM ================= */}
        {step === 'order_form' && selectedCategory && selectedSubService && (
          <div className="max-w-2xl mx-auto space-y-5">
            <button
              type="button"
              onClick={() => setStep('subservices')}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0B3B75] hover:text-[#E06D1B] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{getServiceCategoryLabel(selectedCategory, lang)}</span>
            </button>

            <form
              onSubmit={handleSubmitOrder}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
            >
              {/* Selected Service Summary */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#E06D1B]">
                    {tr(lang, 'Step 2 of 2 · Send Request', 'चरण 2 / 2 · रिक्वेस्ट भेजें', 'पायरी २ / २ · रिक्वेस्ट पाठवा')}
                  </div>
                  <h1 className="font-display text-xl font-extrabold text-[#0B3B75] mt-0.5">
                    {getSubServiceLabel(selectedSubService, lang)}
                  </h1>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {getServiceCategoryLabel(selectedCategory, lang)} ·{' '}
                    <span className="font-semibold text-[#15803D]">
                      {tr(
                        lang,
                        'Worker will quote rate after reading work & photos',
                        'कामगार काम और फ़ोटो देखकर अपना दर बताएगा',
                        'कामगार काम वाचून किंवा फोटो पाहून दर सांगेल'
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('subservices')}
                  className="text-xs font-bold text-[#0B3B75] hover:underline shrink-0 cursor-pointer"
                >
                  {tr(lang, 'Change', 'बदलें', 'बदला')}
                </button>
              </div>

              {/* 1. Work Description */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'Work Description', 'काम का विवरण', 'कामाचे थोडक्यात वर्णन')}
                </label>
                <textarea
                  rows={3}
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder={tr(
                    lang,
                    'Describe the issue briefly (e.g., bathroom tap leaking since morning)...',
                    'काम के बारे में संक्षेप में लिखें (जैसे: बाथरूम का नल सुबह से टपक रहा है)...',
                    'कामाची थोडक्यात माहिती लिहा (उदा. सकाळपासून बाथरूमचा नळ गळत आहे)...'
                  )}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
                />
              </div>

              {/* 2. Optional Photo Upload (Camera + Gallery, 0 photos allowed) */}
              <div className="space-y-1.5">
                <div className="text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'Upload Photos (Optional)', 'फ़ोटो अपलोड करें (वैकल्पिक)', 'कामाचे फोटो अपलोड करा (ऐच्छिक)')}
                </div>
                <WorkPhotoUploader
                  ownerUid={user?.uid || 'guest'}
                  folder="work"
                  photos={workPhotoUrls}
                  onChange={setWorkPhotoUrls}
                />
              </div>

              {/* 3. Service Location */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'Service Location', 'काम का स्थान', 'कामाचे ठिकाण')}
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-[#E06D1B] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 break-words">
                        {location.label}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {tr(
                          lang,
                          'Only approximate area is shown until you confirm a worker.',
                          'कामगार कन्फर्म करने तक केवल अनुमानित क्षेत्र दिखाया जाएगा।',
                          'तुम्ही कामगार निश्चित करेपर्यंत फक्त अंदाजे परिसर दाखवला जातो.'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDetectGps}
                      disabled={gpsLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPinModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      {tr(lang, 'Pin Map', 'मैप पिन', 'नकाशा पिन')}
                    </button>
                  </div>
                </div>

                {/* Exact Service Address (Stored in Private Vault — Revealed ONLY after Order Confirmation to Assigned Worker) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(
                        lang,
                        'Exact House / Street Address (Locked Until Confirmed)',
                        'सटीक घर / गली पता (कन्फर्म होने तक गोपनीय)',
                        'अचूक घर / गल्ली पत्ता (निश्चित होईपर्यंत गोपनीय)'
                      )}
                    </label>
                    <input
                      type="text"
                      value={exactServiceAddress}
                      onChange={(e) => setExactServiceAddress(e.target.value)}
                      maxLength={300}
                      placeholder={tr(
                        lang,
                        'House / Flat No., Street, Colony...',
                        'मकान / फ्लैट नं., गली, कॉलोनी...',
                        'घर / फ्लॅट क्र., गल्ली, कॉलनी...'
                      )}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Nearby Landmark (Optional)', 'पास की पहचान (वैकल्पिक)', 'जवळची खूण (ऐच्छिक)')}
                    </label>
                    <input
                      type="text"
                      value={addressLandmark}
                      onChange={(e) => setAddressLandmark(e.target.value)}
                      maxLength={140}
                      placeholder={tr(
                        lang,
                        'e.g., Near Hanuman Mandir / Bus Stand',
                        'जैसे: हनुमान मंदिर / बस स्टैंड के पास',
                        'उदा. हनुमान मंदिराजवळ / बस स्टँडजवळ'
                      )}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Preferred Time (Now or Schedule Later) */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'When do you need the worker?', 'कामगार कब चाहिए?', 'कामगार कधी हवा आहे?')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferredTimeType('now')}
                    className={`h-12 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      preferredTimeType === 'now'
                        ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-[#0B3B75]'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{tr(lang, 'Now (Urgent)', 'अभी तुरंत', 'आता लगेच')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredTimeType('later')}
                    className={`h-12 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      preferredTimeType === 'later'
                        ? 'bg-[#0B3B75] border-[#0B3B75] text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-[#0B3B75]'
                    }`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    <span>{tr(lang, 'Schedule Later', 'बाद में शेड्यूल करें', 'नंतरची वेळ ठरवा')}</span>
                  </button>
                </div>

                {preferredTimeType === 'later' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <input
                      type="date"
                      value={scheduledDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800"
                    />
                  </div>
                )}
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              {/* Primary CTA: SEND REQUEST */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] disabled:opacity-60 text-white font-display text-base font-extrabold tracking-wide shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tr(lang, 'Sending Request...', 'रिक्वेस्ट भेजी जा रही है...', 'रिक्वेस्ट पाठवत आहोत...')}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {user?.emailVerified
                        ? tr(lang, 'SEND REQUEST', 'रिक्वेस्ट भेजें', 'रिक्वेस्ट पाठवा')
                        : tr(lang, 'SIGN IN & SEND REQUEST', 'लॉगिन करें और रिक्वेस्ट भेजें', 'लॉगिन करून रिक्वेस्ट पाठवा')}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Non-blocking Category-Matched Sponsored Ads cleanly below the order form */}
            <SponsoredAdSlider
              compact
              category={selectedCategory.id}
              categoryLabel={getServiceCategoryLabel(selectedCategory, lang)}
              state={location.state}
              district={location.district}
              city={location.cityOrVillage}
              placement="service_form"
              onNavigate={(r) => onNavigate(r)}
            />
          </div>
        )}

        {/* ================= VIEW 4: LIVE WORKER SEARCH (2 km -> 5 km -> 10 km) ================= */}
        {step === 'searching' && createdOrder && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-emerald-50 border border-emerald-200">
                {createdOrder.expanding ? (
                  <Radar className="w-8 h-8 text-[#E06D1B] animate-spin" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-[#15803D]" />
                )}
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
                  {createdOrder.expanding
                    ? tr(
                        lang,
                        'Searching nearby workers...',
                        'आपके नज़दीकी कामगार की तलाश है...',
                        'आपल्या जवळचा कामगार शोधत आहोत...'
                      )
                    : tr(
                        lang,
                        'Request Sent to Nearby Workers!',
                        'कामगार को रिक्वेस्ट भेज दी गई है!',
                        'कामगाराला रिक्वेस्ट पाठवली आहे.'
                      )}
                </h2>
                <p className="text-sm text-slate-600">{createdOrder.statusMessage}</p>
              </div>

              {/* Radius Stages Indicator: 2 km -> 5 km -> 10 km */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-1">
                {([2, 5, 10] as const).map((km) => {
                  const reached = createdOrder.currentRadiusKm >= km;
                  return (
                    <div
                      key={km}
                      className={`py-2 rounded-lg border text-xs font-mono-tabular font-bold ${
                        reached
                          ? 'bg-emerald-50 border-emerald-300 text-[#15803D]'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {km} km
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                {!createdOrder.expanding && createdOrder.jobId && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('employer-dashboard', undefined, createdOrder.jobId)
                    }
                    className="flex-1 h-12 px-5 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {tr(
                        lang,
                        'Track Order & View Offers',
                        'ऑर्डर ट्रैक करें और ऑफर देखें',
                        'ऑर्डर ट्रॅक करा व ऑफर पहा'
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {!createdOrder.expanding && getNextRadiusStage(createdOrder.currentRadiusKm) && (
                  <button
                    type="button"
                    onClick={handleExpandRadiusNow}
                    className="h-12 px-4 rounded-xl border border-[#E06D1B] text-[#E06D1B] hover:bg-amber-50 text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>
                      {tr(
                        lang,
                        `Expand to ${getNextRadiusStage(createdOrder.currentRadiusKm)} km`,
                        `${getNextRadiusStage(createdOrder.currentRadiusKm)} किमी तक बढ़ाएँ`,
                        `${getNextRadiusStage(createdOrder.currentRadiusKm)} किमी पर्यंत वाढवा`
                      )}
                    </span>
                  </button>
                )}
              </div>

              {!createdOrder.expanding && (
                <button
                  type="button"
                  onClick={resetToHome}
                  className="text-xs font-bold text-slate-500 hover:text-[#0B3B75] cursor-pointer"
                >
                  {tr(lang, 'Book Another Service', 'एक और सेवा बुक करें', 'दुसरी सेवा बुक करा')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sections 6–12: Public-Service Portal Sections (Registration, Govt Schemes, Skills, Live Jobs, Entrepreneurship, Partnerships, About & Contact) */}
      {step === 'home' && !quickHireOnly && (
        <HomePublicPortalSections
          jobs={jobs}
          workers={workers}
          onNavigate={onNavigate}
        />
      )}

      {/* Location Map Pin Modal */}
      <LocationPinModal
        open={showPinModal}
        initialLat={location.lat}
        initialLng={location.lng}
        initialLabel={location.label}
        onClose={() => setShowPinModal(false)}
        onConfirmLocation={(picked) => {
            const nextLoc: ActiveLocationState = {
              lat: picked.lat,
              lng: picked.lng,
              label: picked.formattedAddress || `${picked.cityOrVillage}, ${picked.district}`,
              state: picked.state || location.state,
              district: picked.district || location.district,
              cityOrVillage: picked.cityOrVillage || picked.district || location.cityOrVillage,
            };
            setLocation(nextLoc);
            setShowPinModal(false);
            if (user?.emailVerified) {
              void saveCustomerDefaultLocation(user.uid, {
                state: nextLoc.state,
                district: nextLoc.district,
                cityOrVillage: nextLoc.cityOrVillage,
                lat: nextLoc.lat,
                lng: nextLoc.lng,
                savedAddressLabel: nextLoc.label,
              }).catch(() => undefined);
            }
          }}
        />
    </div>
  );
};
