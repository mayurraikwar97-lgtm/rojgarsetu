import React, { useEffect, useMemo, useState } from 'react';
import {
  AirVent,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Briefcase,
  CalendarClock,
  Camera,
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
  Music,
  Paintbrush,
  Phone,
  Plus,
  Radar,
  RefreshCw,
  Scissors,
  Search,
  Shield,
  Sparkles,
  Store,
  Sun,
  Tv,
  Users,
  Video,
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
import { formatUiError } from '../lib/firebase';
import {
  callNotificationApi,
  createInstantHireRequest,
  dispatchNextJobBatch,
  expandJobSearchRadius,
  recordCustomerOrderPreference,
  retryJobFairRotationDispatch,
  saveCustomerDefaultLocation,
  saveOrderExactAddress,
} from '../lib/firestoreService';
import { detectBestGpsLocation, searchLocations } from '../lib/locationService';
import {
  DEFAULT_BATCH_ESCALATION_WINDOW_MS,
  buildApproxLocationLabel,
  getNextRadiusStage,
  isJobConfirmationClosed,
} from '../lib/smartVoiceJobAlert';
import {
  customProfessionToServiceCategoryV2,
  subscribeApprovedProfessions,
} from '../lib/customProfessionService';
import { getShopCategoryLabel } from '../data/shopCategories';
import type { CustomProfessionRecord } from '../types/domain';
import type {
  JobApplication,
  JobPosting,
  Language,
  PageRoute,
  PublicWorkerProfile,
  ServiceRadiusKm,
  ShopkeeperListing,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';
import { AddProfessionModal } from './AddProfessionModal';
import { LocationPinModal } from './LocationPinModal';
import { WorkPhotoUploader } from './WorkPhotoUploader';
import { HomeIdentityHero, HomePublicPortalSections } from './HomePublicPortalSections';
import { ProfessionThumbnail } from './ProfessionThumbnail';
import { SponsoredAdSlider } from './SponsoredAdSlider';

interface CustomerHomeV2Props {
  workers: PublicWorkerProfile[];
  jobs: JobPosting[];
  shops?: ShopkeeperListing[];
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
  pincode?: string;
}

function extractSixDigitPincode(raw?: string): string {
  const match = (raw || '').match(/\b\d{6}\b/);
  return match ? match[0] : '';
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const CustomerHomeV2: React.FC<CustomerHomeV2Props> = ({
  workers,
  jobs,
  shops = [],
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
  const [pincodeQuery, setPincodeQuery] = useState('');
  const [pincodeBusy, setPincodeBusy] = useState(false);
  const [showAddProfessionModal, setShowAddProfessionModal] = useState(false);
  const [addProfessionNotice, setAddProfessionNotice] = useState('');

  // Order Form State
  const [workDescription, setWorkDescription] = useState('');
  const [exactServiceAddress, setExactServiceAddress] = useState('');
  const [addressLandmark, setAddressLandmark] = useState('');
  const [orderPincode, setOrderPincode] = useState('');
  const [workPhotoUrls, setWorkPhotoUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [preferredTimeType, setPreferredTimeType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Live Searching State (fair-rotation small batches + staged radius 2 km -> 5 km -> 10 km)
  const [createdOrder, setCreatedOrder] = useState<{
    jobId: string;
    title: string;
    category: string;
    notifiedCount: number;
    currentRadiusKm: ServiceRadiusKm;
    batchIndex: number;
    remainingEligibleCount: number;
    hasNextBatch: boolean;
    confirmed: boolean;
    expanding: boolean;
    autoEscalating: boolean;
    allBatchesExhausted: boolean;
    batchDispatchedAtMs: number;
    retrying: boolean;
    statusMessage: string;
  } | null>(null);
  const [secondsUntilNextBatch, setSecondsUntilNextBatch] = useState<number>(
    Math.ceil(DEFAULT_BATCH_ESCALATION_WINDOW_MS / 1000)
  );

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
      const detectedPin = geo.postalCode || extractSixDigitPincode(geo.formattedAddress);
      const nextLoc: ActiveLocationState = {
        lat: geo.lat,
        lng: geo.lng,
        label: geo.formattedAddress || `${geo.cityOrVillage}, ${geo.district}`,
        state: geo.state || location.state,
        district: geo.district || location.district,
        cityOrVillage: geo.cityOrVillage || geo.district || location.cityOrVillage,
        pincode: detectedPin || location.pincode,
      };
      setLocation(nextLoc);
      if (detectedPin) setOrderPincode(detectedPin);
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
    const detectedPin = location.pincode || extractSixDigitPincode(location.label);
    if (detectedPin && !orderPincode) {
      setOrderPincode(detectedPin);
    }
    setStep('order_form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedCategory || !selectedSubService) {
      setFormError(
        tr(
          lang,
          'Please choose a service category and work type first.',
          'कृपया पहले सेवा श्रेणी और काम का प्रकार चुनें।',
          'कृपया आधी कामाची श्रेणी आणि कामाचा प्रकार निवडा.'
        )
      );
      return;
    }

    if (photoUploading) {
      setFormError(
        tr(
          lang,
          'Please wait until the selected work photos finish uploading.',
          'कृपया चुनी गई काम की फ़ोटो अपलोड होने तक प्रतीक्षा करें।',
          'कृपया निवडलेले कामाचे फोटो अपलोड होईपर्यंत थोडे थांबा.'
        )
      );
      return;
    }

    const cleanPin = orderPincode.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length > 0 && !/^[1-9]\d{5}$/.test(cleanPin)) {
      setFormError(
        tr(
          lang,
          'Please enter a valid 6-digit Indian pincode (or leave it blank to use your GPS location).',
          'कृपया सही 6 अंकों का भारतीय पिनकोड दर्ज करें (या GPS लोकेशन के लिए खाली छोड़ें)।',
          'कृपया वैध ६ अंकी पिनकोड भरा (किंवा GPS लोकेशन वापरण्यासाठी रिकामा ठेवा).'
        )
      );
      return;
    }

    if (preferredTimeType === 'later' && !scheduledDate.trim()) {
      setFormError(
        tr(
          lang,
          'Please select a preferred date for your scheduled booking.',
          'कृपया शेड्यूल किए गए काम के लिए तारीख चुनें।',
          'कृपया नंतरच्या वेळेसाठी तारीख निवडा.'
        )
      );
      return;
    }

    if (!user) {
      try {
        await signInWithGoogle();
      } catch (authErr) {
        setFormError(
          formatUiError(authErr) ||
            tr(
              lang,
              'Google sign-in was cancelled or failed. Please sign in to send your request.',
              'गूगल लॉगिन रद्द या विफल हो गया। रिक्वेस्ट भेजने के लिए कृपया लॉगिन करें।',
              'गुगल लॉगिन रद्द झाले किंवा अयशस्वी झाले. रिक्वेस्ट पाठवण्यासाठी कृपया लॉगिन करा.'
            )
        );
      }
      return;
    }

    if (!user.emailVerified) {
      setFormError(
        tr(
          lang,
          'Please sign in with a verified Google account to submit your request.',
          'रिक्वेस्ट भेजने के लिए कृपया सत्यापित गूगल खाते से लॉगिन करें।',
          'रिक्वेस्ट पाठवण्यासाठी कृपया सत्यापित गुगल खात्याने लॉगिन करा.'
        )
      );
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
    const resolvedPincode = cleanPin || location.pincode || extractSixDigitPincode(location.label);
    const baseApproxLabel = buildApproxLocationLabel({
      cityOrVillage: safeCity,
      district: effDistrict,
      state: effState,
    });
    const approxLocationLabel =
      resolvedPincode && !baseApproxLabel.includes(resolvedPincode)
        ? `${baseApproxLabel} (${resolvedPincode})`.slice(0, 160)
        : baseApproxLabel.slice(0, 160);

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
      batchIndex: 0,
      remainingEligibleCount: 0,
      hasNextBatch: false,
      confirmed: false,
      expanding: true,
      autoEscalating: false,
      allBatchesExhausted: false,
      batchDispatchedAtMs: Date.now(),
      retrying: false,
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
          workLocationLabel: approxLocationLabel,
          approxLocationLabel,
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
        void saveOrderExactAddress({
          jobId: res.jobId,
          employerUid: user.uid,
          exactAddress: trimmedExactAddress,
          landmark: addressLandmark.trim().slice(0, 160),
          exactLat: location.lat,
          exactLng: location.lng,
        }).catch(() => undefined);
      }

      void recordCustomerOrderPreference(user.uid, {
        kind: 'hire',
        categoryOrVehicleType: selectedCategory.canonicalCategory,
        orderTitle: title,
        state: effState,
        district: effDistrict,
        cityOrVillage: safeCity,
        lat: location.lat,
        lng: location.lng,
      }).catch(() => undefined);

      const initialMatched = res.notifiedCount;
      const initialRadius: ServiceRadiusKm = res.finalRadiusKm ?? 2;
      const initialBatchIndex = res.batchIndex ?? (res.notifiedCount > 0 ? 1 : 0);
      const initialRemaining = res.remainingEligibleCount ?? 0;
      const initialHasNext = res.hasNextBatch ?? getNextRadiusStage(initialRadius) !== null;
      const noWorkersAnywhere = initialMatched === 0 && !initialHasNext;

      // Immediately confirm job creation & Batch 1 status so the UI never stalls on background FCM push
      setCreatedOrder({
        jobId: res.jobId,
        title,
        category: selectedCategory.canonicalCategory,
        notifiedCount: initialMatched,
        currentRadiusKm: initialRadius,
        batchIndex: Math.max(1, initialBatchIndex),
        remainingEligibleCount: initialRemaining,
        hasNextBatch: initialHasNext,
        confirmed: false,
        expanding: false,
        autoEscalating: false,
        allBatchesExhausted: noWorkersAnywhere,
        batchDispatchedAtMs: Date.now(),
        retrying: false,
        statusMessage:
          initialMatched > 0
            ? tr(
                lang,
                `Batch ${Math.max(1, initialBatchIndex)} sent to ${initialMatched} priority worker(s) within ${initialRadius} km (fair rotation).`,
                `बैच ${Math.max(1, initialBatchIndex)}: ${initialRadius} किमी के दायरे में ${initialMatched} कामगारों को रिक्वेस्ट भेज दी गई है (समान बारी प्रणाली)।`,
                `बॅच ${Math.max(1, initialBatchIndex)}: ${initialRadius} किमी मध्ये ${initialMatched} कामगारांना प्राधान्याने रिक्वेस्ट पाठवली आहे.`
              )
            : tr(
                lang,
                'Your request is live! No matching workers were immediately available nearby—you can browse matching workers directly or retry sending alerts.',
                'आपकी रिक्वेस्ट लाइव हो गई है! अभी नज़दीक में कोई उपलब्ध कामगार नहीं मिला—आप सीधे कामगार देख सकते हैं या अलर्ट दोबारा भेज सकते हैं।',
                'तुमची रिक्वेस्ट पोस्ट झाली आहे! सध्या जवळपास उपलब्ध कामगार आढळले नाहीत—तुम्ही थेट कामगार पाहू शकता किंवा पुन्हा अलर्ट पाठवू शकता.'
              ),
      });

      setWorkDescription('');
      setExactServiceAddress('');
      setAddressLandmark('');
      setWorkPhotoUrls([]);

      // Trigger real FCM push broadcast in the background synchronized to Batch 1 workers
      void callNotificationApi('/api/notifications/send-matching-job', {
        jobId: res.jobId,
        stageRadiusKm: initialRadius,
        autoExpandIfEmpty: true,
        ...(res.newlyNotifiedUids && res.newlyNotifiedUids.length > 0
          ? { targetWorkerUids: res.newlyNotifiedUids }
          : {}),
      })
        .then((pushRes) => {
          const pushData = pushRes.data || {};
          setCreatedOrder((prev) => {
            if (!prev || prev.jobId !== res.jobId || prev.confirmed) return prev;
            const nextMatched =
              typeof pushData.totalNotifiedCount === 'number' && pushData.totalNotifiedCount > prev.notifiedCount
                ? pushData.totalNotifiedCount
                : prev.notifiedCount;
            const nextBatch =
              typeof pushData.batchIndex === 'number' && pushData.batchIndex > prev.batchIndex
                ? pushData.batchIndex
                : prev.batchIndex;
            const nextRemaining =
              typeof pushData.remainingEligibleCount === 'number'
                ? pushData.remainingEligibleCount
                : prev.remainingEligibleCount;
            const nextHasBatch =
              typeof pushData.hasNextBatch === 'boolean' ? pushData.hasNextBatch : prev.hasNextBatch;
            const nextRadius: ServiceRadiusKm =
              pushData.currentRadiusKm === 2 ||
              pushData.currentRadiusKm === 5 ||
              pushData.currentRadiusKm === 10 ||
              pushData.currentRadiusKm === 20 ||
              pushData.currentRadiusKm === 30
                ? pushData.currentRadiusKm
                : prev.currentRadiusKm;
            if (
              nextMatched === prev.notifiedCount &&
              nextRadius === prev.currentRadiusKm &&
              nextBatch === prev.batchIndex &&
              nextHasBatch === prev.hasNextBatch
            ) {
              return prev;
            }
            return {
              ...prev,
              notifiedCount: nextMatched,
              currentRadiusKm: nextRadius,
              batchIndex: Math.max(1, nextBatch),
              remainingEligibleCount: nextRemaining,
              hasNextBatch: nextHasBatch,
              allBatchesExhausted: nextMatched === 0 && !nextHasBatch,
              statusMessage:
                nextMatched > 0
                  ? tr(
                      lang,
                      `Batch ${Math.max(1, nextBatch)} sent to ${nextMatched} priority worker(s) within ${nextRadius} km (fair rotation).`,
                      `बैच ${Math.max(1, nextBatch)}: ${nextRadius} किमी के दायरे में ${nextMatched} कामगारों को रिक्वेस्ट भेज दी गई है (समान बारी प्रणाली)।`,
                      `बॅच ${Math.max(1, nextBatch)}: ${nextRadius} किमी मध्ये ${nextMatched} कामगारांना प्राधान्याने रिक्वेस्ट पाठवली आहे.`
                    )
                  : prev.statusMessage,
            };
          });
        })
        .catch(() => undefined);
    } catch (err) {
      setFormError(
        formatUiError(err) ||
          tr(
            lang,
            'Could not send request. Please check your details and try again.',
            'रिक्वेस्ट नहीं भेजी जा सकी। कृपया विवरण जाँचें और पुनः प्रयास करें।',
            'रिक्वेस्ट पाठवता आली नाही. कृपया तपशील तपासा आणि पुन्हा प्रयत्न करा.'
          )
      );
      setStep('order_form');
      setCreatedOrder(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifyNextBatchNow = async (isAutoEscalation = false) => {
    if (!createdOrder?.jobId || createdOrder.confirmed) return;
    const jobObj = jobs.find((j) => j.id === createdOrder.jobId);
    if (!jobObj) return;

    if (isJobConfirmationClosed(jobObj)) {
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              confirmed: true,
              hasNextBatch: false,
              expanding: false,
              autoEscalating: false,
              allBatchesExhausted: false,
              retrying: false,
              statusMessage: tr(
                lang,
                'A worker has confirmed your job! Alerts to other workers are now closed.',
                'एक कामगार ने आपका काम कन्फर्म कर दिया है! अन्य कामगारों को अलर्ट बंद कर दिए गए हैं।',
                'एका कामगाराने तुमचे काम निश्चित केले आहे! इतर कामगारांचे अलर्ट बंद झाले आहेत.'
              ),
            }
          : prev
      );
      return;
    }

    setCreatedOrder((prev) =>
      prev
        ? {
            ...prev,
            expanding: true,
            autoEscalating: isAutoEscalation,
            allBatchesExhausted: false,
            statusMessage: tr(
              lang,
              'Alerting next batch of nearby workers...',
              'अगले नज़दीकी कामगारों को अलर्ट भेजा जा रहा है...',
              'जवळच्या पुढील कामगारांना अलर्ट पाठवला जात आहे...'
            ),
          }
        : prev
    );
    try {
      const res = await dispatchNextJobBatch({ job: jobObj, workers });
      const exhaustedNow = !res.closed && res.newlyNotifiedCount === 0 && !res.hasNextBatch;
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              currentRadiusKm: res.currentRadiusKm,
              notifiedCount: Math.max(prev.notifiedCount, res.totalNotifiedCount),
              batchIndex: Math.max(prev.batchIndex, res.batchIndex),
              remainingEligibleCount: res.remainingEligibleCount,
              hasNextBatch: !res.closed && res.hasNextBatch,
              confirmed: res.closed,
              expanding: false,
              autoEscalating: false,
              allBatchesExhausted: exhaustedNow,
              batchDispatchedAtMs: Date.now(),
              retrying: false,
              statusMessage: res.closed
                ? tr(
                    lang,
                    'A worker has confirmed your job! Alerts to other workers are now closed.',
                    'एक कामगार ने आपका काम कन्फर्म कर दिया है! अन्य कामगारों को अलर्ट बंद कर दिए गए हैं।',
                    'एका कामगाराने तुमचे काम निश्चित केले आहे! इतर कामगारांचे अलर्ट बंद झाले आहेत.'
                  )
                : res.newlyNotifiedCount > 0
                ? tr(
                    lang,
                    `Batch ${res.batchIndex} sent to ${res.newlyNotifiedCount} more priority worker(s) (${res.totalNotifiedCount} total within ${res.currentRadiusKm} km).`,
                    `बैच ${res.batchIndex}: ${res.newlyNotifiedCount} और कामगारों को अलर्ट भेजा गया (${res.currentRadiusKm} किमी में कुल ${res.totalNotifiedCount})।`,
                    `बॅच ${res.batchIndex}: आणखी ${res.newlyNotifiedCount} कामगारांना अलर्ट पाठवला (${res.currentRadiusKm} किमी मध्ये एकूण ${res.totalNotifiedCount}).`
                  )
                : tr(
                    lang,
                    'All nearby matching workers were alerted without a confirmation yet. Browse matching workers directly or retry sending alerts.',
                    'सभी नज़दीकी कामगारों को अलर्ट भेजा जा चुका है पर अभी कन्फर्मेशन नहीं मिला। आप सीधे कामगार देख सकते हैं या फिर से अलर्ट भेज सकते हैं।',
                    'जवळच्या सर्व पात्र कामगारांना अलर्ट पाठवला आहे, परंतु अद्याप कन्फर्मेशन मिळाले नाही. तुम्ही थेट कामगार पाहू शकता किंवा पुन्हा अलर्ट पाठवू शकता.'
                  ),
            }
          : prev
      );
    } catch {
      setCreatedOrder((prev) =>
        prev ? { ...prev, expanding: false, autoEscalating: false } : prev
      );
    }
  };

  const handleRetryJobNow = async () => {
    if (!createdOrder?.jobId || createdOrder.confirmed || createdOrder.retrying) return;
    const jobObj = jobs.find((j) => j.id === createdOrder.jobId);
    if (!jobObj) return;

    setCreatedOrder((prev) =>
      prev
        ? {
            ...prev,
            retrying: true,
            expanding: true,
            autoEscalating: false,
            allBatchesExhausted: false,
            statusMessage: tr(
              lang,
              'Re-alerting nearby workers in fair rotation order...',
              'नज़दीकी कामगारों को फिर से समान बारी क्रम में अलर्ट भेजा जा रहा है...',
              'जवळच्या कामगारांना पुन्हा न्याय्य क्रमाने अलर्ट पाठवला जात आहे...'
            ),
          }
        : prev
    );

    try {
      const res = await retryJobFairRotationDispatch({ job: jobObj, workers });
      const exhaustedNow = !res.closed && res.totalNotifiedCount === 0 && !res.hasNextBatch;
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              currentRadiusKm: res.currentRadiusKm,
              notifiedCount: res.totalNotifiedCount,
              batchIndex: Math.max(1, res.batchIndex),
              remainingEligibleCount: res.remainingEligibleCount,
              hasNextBatch: !res.closed && res.hasNextBatch,
              confirmed: res.closed,
              expanding: false,
              autoEscalating: false,
              allBatchesExhausted: exhaustedNow,
              batchDispatchedAtMs: Date.now(),
              retrying: false,
              statusMessage: res.closed
                ? tr(
                    lang,
                    'A worker has confirmed your job! Alerts to other workers are now closed.',
                    'एक कामगार ने आपका काम कन्फर्म कर दिया है! अन्य कामगारों को अलर्ट बंद कर दिए गए हैं।',
                    'एका कामगाराने तुमचे काम निश्चित केले आहे! इतर कामगारांचे अलर्ट बंद झाले आहेत.'
                  )
                : res.totalNotifiedCount > 0
                ? tr(
                    lang,
                    `Retry started — Batch 1 sent to ${res.totalNotifiedCount} nearby worker(s) within ${res.currentRadiusKm} km.`,
                    `दोबारा अलर्ट शुरू — बैच 1 के ${res.totalNotifiedCount} नज़दीकी कामगारों को सूचना भेजी गई (${res.currentRadiusKm} किमी)।`,
                    `पुन्हा अलर्ट सुरू — बॅच 1 मधील ${res.totalNotifiedCount} जवळच्या कामगारांना रिक्वेस्ट पाठवली (${res.currentRadiusKm} किमी).`
                  )
                : tr(
                    lang,
                    'Still no matching workers available nearby. Browse matching workers directly to contact one right away.',
                    'अभी भी नज़दीक में उपलब्ध कामगार नहीं मिले। तुरंत संपर्क के लिए सीधे कामगारों की सूची देखें।',
                    'अद्याप जवळपास उपलब्ध कामगार आढळले नाहीत. त्वरित संपर्कासाठी थेट कामगारांची यादी पहा.'
                  ),
            }
          : prev
      );
    } catch {
      setCreatedOrder((prev) =>
        prev ? { ...prev, retrying: false, expanding: false } : prev
      );
    }
  };

  // Watch live job status: stop alerts immediately when a worker confirms
  useEffect(() => {
    if (step !== 'searching' || !createdOrder?.jobId) return;
    const liveJob = jobs.find((j) => j.id === createdOrder.jobId);
    if (!liveJob) return;

    if (isJobConfirmationClosed(liveJob) && !createdOrder.confirmed) {
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              confirmed: true,
              hasNextBatch: false,
              expanding: false,
              autoEscalating: false,
              allBatchesExhausted: false,
              retrying: false,
              statusMessage: tr(
                lang,
                'A worker has confirmed your job! Alerts to other workers are now closed.',
                'एक कामगार ने आपका काम कन्फर्म कर दिया है! अन्य कामगारों को अलर्ट बंद कर दिए गए हैं।',
                'एका कामगाराने तुमचे काम निश्चित केले आहे! इतर कामगारांचे अलर्ट बंद झाले आहेत.'
              ),
            }
          : prev
      );
    }
  }, [step, createdOrder?.jobId, createdOrder?.confirmed, jobs, lang]);

  // Live 1s countdown for current batch window -> auto-escalate next batch OR show exhausted fallback without penalizing workers
  useEffect(() => {
    if (
      step !== 'searching' ||
      !createdOrder?.jobId ||
      createdOrder.confirmed ||
      createdOrder.expanding ||
      createdOrder.retrying ||
      createdOrder.allBatchesExhausted
    ) {
      return;
    }

    const liveJob = jobs.find((j) => j.id === createdOrder.jobId);
    if (liveJob && isJobConfirmationClosed(liveJob)) {
      return;
    }

    let triggered = false;
    const tick = () => {
      const elapsed = Date.now() - createdOrder.batchDispatchedAtMs;
      const remainingSec = Math.max(
        0,
        Math.ceil((DEFAULT_BATCH_ESCALATION_WINDOW_MS - elapsed) / 1000)
      );
      setSecondsUntilNextBatch(remainingSec);

      if (elapsed >= DEFAULT_BATCH_ESCALATION_WINDOW_MS && !triggered) {
        triggered = true;
        if (createdOrder.hasNextBatch) {
          void handleNotifyNextBatchNow(true);
        } else {
          setCreatedOrder((prev) =>
            prev && !prev.confirmed
              ? {
                  ...prev,
                  allBatchesExhausted: true,
                  autoEscalating: false,
                  expanding: false,
                  statusMessage: tr(
                    lang,
                    'No worker confirmed within the batch window. You can browse matching workers directly or retry/repost the job.',
                    'निर्धारित समय में किसी कामगार ने कन्फर्म नहीं किया। आप सीधे कामगार देख सकते हैं या अलर्ट फिर से भेज सकते हैं।',
                    'दिलेल्या वेळेत कोणत्याही कामगाराने काम कन्फर्म केले नाही. तुम्ही थेट कामगार पाहू शकता किंवा पुन्हा अलर्ट पाठवू शकता.'
                  ),
                }
              : prev
          );
        }
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    createdOrder?.jobId,
    createdOrder?.batchIndex,
    createdOrder?.batchDispatchedAtMs,
    createdOrder?.expanding,
    createdOrder?.retrying,
    createdOrder?.confirmed,
    createdOrder?.hasNextBatch,
    createdOrder?.allBatchesExhausted,
    jobs,
  ]);

  const handleExpandRadiusNow = async () => {
    if (!createdOrder?.jobId || createdOrder.confirmed) return;
    const nextStage = getNextRadiusStage(createdOrder.currentRadiusKm);
    if (!nextStage) return;

    const jobObj = jobs.find((j) => j.id === createdOrder.jobId);
    if (!jobObj) return;

    setCreatedOrder((prev) =>
      prev
        ? {
            ...prev,
            expanding: true,
            autoEscalating: true,
            allBatchesExhausted: false,
            statusMessage: tr(
              lang,
              'Alerting next batch of nearby workers...',
              'अगले नज़दीकी कामगारों को अलर्ट भेजा जा रहा है...',
              'जवळच्या पुढील कामगारांना अलर्ट पाठवला जात आहे...'
            ),
          }
        : prev
    );
    try {
      const res = await expandJobSearchRadius({
        job: jobObj,
        workers,
        targetRadiusKm: nextStage,
      });
      const exhaustedNow =
        !res.closed &&
        res.newlyNotifiedCount === 0 &&
        (res.remainingEligibleCount ?? 0) === 0 &&
        !res.hasNextStage;
      setCreatedOrder((prev) =>
        prev
          ? {
              ...prev,
              currentRadiusKm: res.currentRadiusKm,
              notifiedCount: Math.max(prev.notifiedCount, res.totalNotifiedCount),
              batchIndex: Math.max(prev.batchIndex, res.batchIndex ?? prev.batchIndex),
              remainingEligibleCount: res.remainingEligibleCount ?? 0,
              hasNextBatch: !res.closed && ((res.remainingEligibleCount ?? 0) > 0 || res.hasNextStage),
              confirmed: Boolean(res.closed),
              expanding: false,
              autoEscalating: false,
              allBatchesExhausted: exhaustedNow,
              batchDispatchedAtMs: Date.now(),
              retrying: false,
              statusMessage: res.closed
                ? tr(
                    lang,
                    'A worker has confirmed your job! Alerts to other workers are now closed.',
                    'एक कामगार ने आपका काम कन्फर्म कर दिया है! अन्य कामगारों को अलर्ट बंद कर दिए गए हैं।',
                    'एका कामगाराने तुमचे काम निश्चित केले आहे! इतर कामगारांचे अलर्ट बंद झाले आहेत.'
                  )
                : tr(
                    lang,
                    `Expanded search to ${res.currentRadiusKm} km · ${res.totalNotifiedCount} worker(s) notified.`,
                    `खोज का दायरा ${res.currentRadiusKm} किमी तक बढ़ाया · ${res.totalNotifiedCount} कामगारों को सूचना भेजी।`,
                    `शोध अंतर ${res.currentRadiusKm} किमी पर्यंत वाढवले · ${res.totalNotifiedCount} कामगारांना रिक्वेस्ट पाठवली.`
                  ),
            }
          : prev
      );
    } catch {
      setCreatedOrder((prev) =>
        prev ? { ...prev, expanding: false, autoEscalating: false } : prev
      );
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

  const activePincode = useMemo(
    () => location.pincode || extractSixDigitPincode(location.label),
    [location.pincode, location.label]
  );

  const nearbyLocalShops = useMemo(() => {
    if (shops.length === 0) return [];
    const pin = activePincode.trim();
    const distLower = (location.district || '').trim().toLowerCase();
    const cityLower = (location.cityOrVillage || '').trim().toLowerCase();

    const scored = shops.map((shop) => {
      let score = shop.paidListingActive || shop.registrationPaymentStatus === 'verified' ? 4 : 0;
      if (pin && shop.pincode === pin) score += 10;
      else if (pin && shop.pincode.slice(0, 3) === pin.slice(0, 3)) score += 5;
      if (distLower && shop.district.toLowerCase().includes(distLower)) score += 3;
      if (cityLower && shop.cityOrVillage.toLowerCase().includes(cityLower)) score += 2;
      return { shop, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((item) => item.shop);
  }, [shops, activePincode, location.district, location.cityOrVillage]);

  const handleApplyPincodeOrArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = pincodeQuery.trim();
    if (raw.length < 3) return;
    setPincodeBusy(true);
    const typedPin = extractSixDigitPincode(raw);
    try {
      const results = await searchLocations(raw, lang);
      const top = results[0];
      if (top) {
        const resolvedPin = typedPin || extractSixDigitPincode(top.formattedAddress);
        const cleanLabel =
          resolvedPin && !top.formattedAddress.includes(resolvedPin)
            ? `${top.cityOrVillage || top.district}, ${resolvedPin}`
            : top.formattedAddress || `${top.cityOrVillage || raw}, ${top.district || location.district}`;
        const nextLoc: ActiveLocationState = {
          lat: top.lat,
          lng: top.lng,
          label: cleanLabel,
          state: top.state || location.state,
          district: top.district || location.district,
          cityOrVillage: top.cityOrVillage || top.district || raw,
          pincode: resolvedPin || undefined,
        };
        setLocation(nextLoc);
        setPincodeQuery('');
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
      } else {
        // Graceful local fallback so typed area/pincode is still honored immediately
        const nextLoc: ActiveLocationState = {
          ...location,
          label: typedPin ? `${location.cityOrVillage}, ${typedPin}` : `${raw}, ${location.district}`,
          cityOrVillage: typedPin ? location.cityOrVillage : raw,
          pincode: typedPin || location.pincode,
        };
        setLocation(nextLoc);
        setPincodeQuery('');
      }
    } catch {
      const nextLoc: ActiveLocationState = {
        ...location,
        label: typedPin ? `${location.cityOrVillage}, ${typedPin}` : `${raw}, ${location.district}`,
        cityOrVillage: typedPin ? location.cityOrVillage : raw,
        pincode: typedPin || location.pincode,
      };
      setLocation(nextLoc);
      setPincodeQuery('');
    } finally {
      setPincodeBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F8FAFC] pb-24 md:pb-12">
      {/* Sections 1–4: Public-Service Identity Hero with Mahatma Gandhi Portrait & Primary Actions (only on Home screen) */}
      {step === 'home' && !quickHireOnly && (
        <HomeIdentityHero
          workersCount={workers.length}
          openJobsCount={openJobsCount}
          onFindWork={() => onNavigate('find-work')}
          onFindWorkers={() => onNavigate('find-workers')}
          onFindShops={() => onNavigate('local-shops', activePincode || location.district || '')}
          onPostJob={() => onNavigate('post-job')}
          onJumpToServices={() => {
            const el = document.getElementById('popular-services');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      {/* Top Location, Pincode & Search Strip */}
      <div id="popular-services" className="bg-white border-b border-slate-200/80 scroll-mt-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Location Display + Quick Pincode/Area Input + GPS / Pin */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
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
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>{tr(lang, 'Service Area & Pincode', 'सेवा क्षेत्र व पिनकोड', 'सेवा परिसर व पिनकोड')}</span>
                    {activePincode && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-mono-tabular font-bold text-[#0B3B75]">
                        PIN {activePincode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#0B3B75] truncate max-w-[200px] sm:max-w-[250px] group-hover:text-[#E06D1B] transition-colors">
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
                  {tr(lang, 'Map', 'मैप', 'नकाशा')}
                </button>
              </div>
            </div>

            {/* Inline Pincode / Area Quick Set */}
            <form
              onSubmit={handleApplyPincodeOrArea}
              className="flex items-center gap-1.5 w-full sm:w-auto sm:max-w-[250px]"
            >
              <input
                type="text"
                value={pincodeQuery}
                onChange={(e) => setPincodeQuery(e.target.value)}
                maxLength={40}
                placeholder={tr(
                  lang,
                  'Enter Pincode / Area (e.g. 442401)',
                  'पिनकोड / क्षेत्र लिखें (उदा. 442401)',
                  'पिनकोड / परिसर टाका (उदा. 442401)'
                )}
                className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/20 focus:border-[#0B3B75]"
              />
              <button
                type="submit"
                disabled={pincodeBusy || pincodeQuery.trim().length < 3}
                className="h-9 px-2.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
              >
                {pincodeBusy ? '...' : tr(lang, 'Set', 'सेट', 'सेट')}
              </button>
            </form>
          </div>

          {/* Service Search Box (visible on Home) */}
          {step === 'home' && (
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search electrician, plumber, cameraman...',
                  'इलेक्ट्रीशियन, प्लंबर, कैमरामैन खोजें...',
                  'इलेक्ट्रिशियन, प्लंबर, कॅमेरामन शोधा...'
                )}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
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
                      className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-[#0B3B75] bg-slate-50/70 hover:bg-white text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProfessionThumbnail
                          id={cat.id}
                          label={getServiceCategoryLabel(cat, lang)}
                          hint={`${cat.en} ${cat.canonicalCategory}`}
                          size="xs"
                          accentBg={cat.accentBg}
                          accentBorder={cat.accentBorder}
                          accentText={cat.accentText}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#0B3B75] truncate">
                            {getSubServiceLabel(sub, lang)}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {getServiceCategoryLabel(cat, lang)} · {sub.estimatedDuration}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addProfessionNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                  <span>{addProfessionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddProfessionNotice('')}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer shrink-0"
                >
                  {tr(lang, 'OK', 'ठीक है', 'ठीक आहे')}
                </button>
              </div>
            )}

            {/* Compact, Space-Efficient Service Category Grid (Small Photo Thumbnails + Live Custom + "+" Add Tile) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {[...searchResults.categories, ...searchResults.customCategories].map((cat) => {
                const isCustom = approvedCustomCatalog.some((c) => c.id === cat.id);
                const localizedLabel = getServiceCategoryLabel(cat, lang);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`group text-left bg-white rounded-xl border p-2.5 sm:p-3 transition-all hover:shadow-sm active:scale-[0.98] cursor-pointer flex flex-col items-center sm:items-start text-center sm:text-left justify-between min-h-[90px] sm:min-h-[100px] ${
                      cat.isTransport
                        ? 'border-emerald-300 hover:border-[#15803D]'
                        : isCustom
                        ? 'border-indigo-200/90 hover:border-[#0B3B75]'
                        : 'border-slate-200/90 hover:border-[#0B3B75]'
                    }`}
                  >
                    <div className="w-full flex items-center justify-center sm:justify-between gap-1.5">
                      <ProfessionThumbnail
                        id={cat.id}
                        label={localizedLabel}
                        hint={`${cat.en} ${cat.canonicalCategory}`}
                        size="md"
                        accentBg={cat.accentBg}
                        accentBorder={cat.accentBorder}
                        accentText={cat.accentText}
                        className="transition-transform group-hover:scale-105"
                      />
                      {isCustom && (
                        <span className="hidden sm:inline-block text-[10px] font-bold text-[#15803D] leading-none">
                          {tr(lang, 'Live', 'लाइव', 'लाइव्ह')}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 w-full space-y-0.5">
                      <div className="font-display text-xs sm:text-[13px] font-extrabold text-[#0B3B75] group-hover:text-[#E06D1B] transition-colors leading-tight line-clamp-2">
                        {localizedLabel}
                      </div>
                      <p className="hidden sm:block text-[10px] text-slate-500 truncate leading-tight">
                        {getServiceTagline(cat, lang)}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* "+" Add New Skill / Category Tile right at the end of the professions list */}
              <button
                type="button"
                onClick={() => setShowAddProfessionModal(true)}
                aria-label={tr(
                  lang,
                  'Add new skill or category',
                  'नया काम या श्रेणी जोड़ें',
                  'नवीन काम किंवा व्यवसाय जोडा'
                )}
                className="group text-left bg-amber-50/60 hover:bg-amber-50 rounded-xl border-2 border-dashed border-[#E06D1B]/60 hover:border-[#E06D1B] p-2.5 sm:p-3 transition-all hover:shadow-sm active:scale-[0.98] cursor-pointer flex flex-col items-center sm:items-start text-center sm:text-left justify-between min-h-[90px] sm:min-h-[100px]"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#E06D1B] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="mt-2 w-full space-y-0.5">
                  <div className="font-display text-xs sm:text-[13px] font-extrabold text-[#C25E00] leading-tight line-clamp-2">
                    {tr(lang, '+ Add Skill', '+ काम जोड़ें', '+ व्यवसाय जोडा')}
                  </div>
                  <p className="hidden sm:block text-[10px] text-amber-800/80 truncate leading-tight">
                    {tr(lang, 'Cameraman, DJ, more', 'कैमरामैन, DJ, अन्य', 'कॅमेरामन, DJ, इतर')}
                  </p>
                </div>
              </button>
            </div>

            {searchResults.categories.length === 0 && searchResults.customCategories.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
                <p className="text-sm font-bold text-[#0B3B75]">
                  {tr(lang, 'No matching service found.', 'कोई मेल खाती सेवा नहीं मिली।', 'जुळणारी सेवा सापडली नाही.')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {searchQuery.trim().length >= 2 && (
                    <button
                      type="button"
                      onClick={() => setShowAddProfessionModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E06D1B] hover:bg-[#C65B12] text-white text-xs font-extrabold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {tr(
                          lang,
                          `Add "${searchQuery.trim()}" as a new service`,
                          `"${searchQuery.trim()}" नई सेवा जोड़ें`,
                          `"${searchQuery.trim()}" नवीन सेवा जोडा`
                        )}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                  >
                    {tr(lang, 'Show all services', 'सभी सेवाएँ देखें', 'सर्व सेवा पहा')}
                  </button>
                </div>
              </div>
            )}

            {/* Sponsored Local Business Advertisement Slider (Homepage Placement) */}
            <SponsoredAdSlider
              category="all"
              state={location.state}
              district={location.district}
              city={location.cityOrVillage}
              pincode={activePincode}
              placement="homepage"
              onNavigate={(r) => onNavigate(r)}
            />

            {/* Vocal for Local · स्थानिककडून सामान (Nearby Local Shops Strip) */}
            <div className="bg-white border border-amber-200/90 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-[#E06D1B]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-extrabold text-[#15803D]">
                      <span>{tr(lang, 'Vocal for Local', 'वोकल फॉर लोकल', 'व्होकल फॉर लोकल')}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[#C25E00]">
                        {tr(lang, 'Buy from Local Shops', 'स्थानीय से सामान खरीदें', 'स्थानिककडून सामान खरेदी करा')}
                      </span>
                    </div>
                    <h2 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75] leading-snug">
                      {activePincode
                        ? tr(
                            lang,
                            `Nearby Local Shops · PIN ${activePincode}`,
                            `नज़दीकी स्थानीय दुकानें · पिन ${activePincode}`,
                            `जवळची स्थानिक दुकाने · पिन ${activePincode}`
                          )
                        : tr(
                            lang,
                            `Local Shops in ${location.district || 'Your Area'}`,
                            `${location.district || 'आपके क्षेत्र'} की स्थानीय दुकानें`,
                            `${location.district || 'तुमच्या परिसरातील'} स्थानिक दुकाने`
                          )}
                    </h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('local-shops', activePincode || location.district)}
                    className="px-3.5 py-2 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{tr(lang, 'Browse Local Shops', 'स्थानीय दुकानें देखें', 'स्थानिक दुकाने पहा')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('register-shopkeeper')}
                    className="px-3.5 py-2 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-xs font-bold cursor-pointer"
                  >
                    {tr(lang, 'Register Shop', 'दुकान पंजीकरण', 'दुकान नोंदवा')}
                  </button>
                </div>
              </div>

              {nearbyLocalShops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {nearbyLocalShops.map((shop) => (
                    <div
                      key={shop.id}
                      className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3 flex flex-col justify-between gap-2.5 hover:border-[#0B3B75] transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {shop.logoDataUrl ? (
                          <img
                            src={shop.logoDataUrl}
                            alt={shop.shopName}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                            <Store className="w-5 h-5 text-[#E06D1B]" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-[#C25E00] truncate">
                            {shop.customCategoryName || getShopCategoryLabel(shop.shopCategory, lang)}
                          </div>
                          <div className="font-display text-sm font-extrabold text-[#0B3B75] truncate">
                            {shop.shopName}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#E06D1B] shrink-0" />
                            <span className="truncate">
                              {shop.cityOrVillage}, {shop.district} · {shop.pincode}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                        <span className="text-slate-600 font-medium truncate">
                          {shop.openingTime} – {shop.closingTime}
                        </span>
                        <a
                          href={`tel:${shop.contactPhone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#15803D] hover:bg-[#116830] text-white font-bold shrink-0"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{tr(lang, 'Call', 'कॉल', 'कॉल')}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50/60 border border-amber-200/80 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-700">
                  <span>
                    {tr(
                      lang,
                      'Own a Kirana, Hardware, Medical, Electronics, Garment or any local shop? Create your Vocal for Local shop profile so nearby customers buy local from you.',
                      'क्या आपकी किराना, हार्डवेयर, मेडिकल, इलेक्ट्रॉनिक्स या कोई स्थानीय दुकान है? अपनी "वोकल फॉर लोकल" दुकान प्रोफ़ाइल जोड़ें और आस-पास के ग्राहकों तक पहुंचें।',
                      'तुमचे किराणा, हार्डवेअर, मेडिकल, इलेक्ट्रॉनिक्स किंवा कोणतेही स्थानिक दुकान आहे का? "व्होकल फॉर लोकल" अंतर्गत तुमचे दुकान नोंदवा आणि जवळच्या ग्राहकांपर्यंत पोहोचा.'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('register-shopkeeper')}
                    className="text-xs font-extrabold text-[#0B3B75] hover:text-[#E06D1B] underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {tr(lang, 'List Your Shop Now →', 'अभी दुकान जोड़ें →', 'आता दुकान नोंदवा →')}
                  </button>
                </div>
              )}
            </div>

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

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3.5">
              <ProfessionThumbnail
                id={selectedCategory.id}
                label={getServiceCategoryLabel(selectedCategory, lang)}
                hint={`${selectedCategory.en} ${selectedCategory.canonicalCategory}`}
                size="lg"
                accentBg={selectedCategory.accentBg}
                accentBorder={selectedCategory.accentBorder}
                accentText={selectedCategory.accentText}
              />
              <div className="space-y-1 min-w-0">
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
            </div>

            {/* Category-Matched Sponsored Advertisement Slider (Strictly relevant to selectedCategory) */}
            <SponsoredAdSlider
              category={selectedCategory.id}
              categoryLabel={getServiceCategoryLabel(selectedCategory, lang)}
              state={location.state}
              district={location.district}
              city={location.cityOrVillage}
              pincode={activePincode}
              placement="category_selection"
              onNavigate={(r) => onNavigate(r)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedCategory.subServices.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubService(selectedCategory, sub)}
                  className="bg-white border border-slate-200 hover:border-[#0B3B75] rounded-xl p-3 text-left flex items-center justify-between gap-2.5 transition-all hover:shadow-sm cursor-pointer group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-sm font-extrabold text-[#0B3B75] group-hover:text-[#E06D1B] transition-colors">
                      {getSubServiceLabel(sub, lang)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
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
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#E06D1B] group-hover:text-white text-slate-500 flex items-center justify-center shrink-0 transition-colors">
                    <ChevronRight className="w-4 h-4" />
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
              noValidate
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
            >
              {/* Selected Service Summary */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-start gap-3 min-w-0">
                  <ProfessionThumbnail
                    id={selectedCategory.id}
                    label={getServiceCategoryLabel(selectedCategory, lang)}
                    hint={`${selectedCategory.en} ${selectedCategory.canonicalCategory}`}
                    size="md"
                    accentBg={selectedCategory.accentBg}
                    accentBorder={selectedCategory.accentBorder}
                    accentText={selectedCategory.accentText}
                  />
                  <div className="min-w-0">
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
                  disabled={submitting}
                  onUploadingChange={setPhotoUploading}
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

                {/* Exact Service Address & Pincode (Address Locked Until Confirmed) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
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
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr(lang, 'Pincode (6 digits)', 'पिनकोड (6 अंक)', 'पिनकोड (६ अंक)')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={orderPincode}
                      onChange={(e) => {
                        setOrderPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (formError) setFormError('');
                      }}
                      placeholder="442401"
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-mono-tabular text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/25 focus:border-[#0B3B75]"
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
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Primary CTA: SEND REQUEST */}
              <button
                type="submit"
                disabled={submitting || photoUploading}
                className="w-full h-14 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] disabled:opacity-60 text-white font-display text-base font-extrabold tracking-wide shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tr(lang, 'Sending Request...', 'रिक्वेस्ट भेजी जा रही है...', 'रिक्वेस्ट पाठवत आहोत...')}</span>
                  </>
                ) : photoUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tr(lang, 'Uploading Photos...', 'फ़ोटो अपलोड हो रही हैं...', 'फोटो अपलोड होत आहेत...')}</span>
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

        {/* ================= VIEW 4: LIVE WORKER SEARCH (Fair-Rotation Batches & Timeout Fallback) ================= */}
        {step === 'searching' && createdOrder && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
              <div
                className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border ${
                  createdOrder.confirmed
                    ? 'bg-emerald-50 border-emerald-300'
                    : createdOrder.allBatchesExhausted
                    ? 'bg-amber-50 border-amber-300'
                    : createdOrder.expanding || createdOrder.autoEscalating
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                {createdOrder.confirmed ? (
                  <CheckCircle2 className="w-8 h-8 text-[#15803D]" />
                ) : createdOrder.allBatchesExhausted ? (
                  <AlertCircle className="w-8 h-8 text-[#C25E00]" />
                ) : createdOrder.expanding || createdOrder.autoEscalating ? (
                  <Radar className="w-8 h-8 text-[#E06D1B] animate-spin" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-[#15803D]" />
                )}
              </div>

              <div className="space-y-2">
                {createdOrder.confirmed && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-xs font-extrabold text-[#15803D]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{tr(lang, 'Job Confirmed', 'काम कन्फर्म हुआ', 'काम कन्फर्म झाले')}</span>
                  </div>
                )}

                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B3B75]">
                  {createdOrder.confirmed
                    ? tr(
                        lang,
                        'Worker Confirmed Your Job!',
                        'कामगार ने आपका काम कन्फर्म कर दिया!',
                        'कामगाराने तुमचे काम कन्फर्म केले!'
                      )
                    : createdOrder.autoEscalating
                    ? tr(
                        lang,
                        'Alerting next batch of nearby workers...',
                        'अगले नज़दीकी कामगारों को अलर्ट भेजा जा रहा है...',
                        'जवळच्या पुढील कामगारांना अलर्ट पाठवला जात आहे...'
                      )
                    : createdOrder.expanding
                    ? tr(
                        lang,
                        'Searching nearby workers...',
                        'आपके नज़दीकी कामगार की तलाश है...',
                        'आपल्या जवळचा कामगार शोधत आहोत...'
                      )
                    : createdOrder.allBatchesExhausted
                    ? tr(
                        lang,
                        'No Worker Confirmed in Batch Window',
                        'समय सीमा में कोई कामगार कन्फर्म नहीं हुआ',
                        'वेळेत कोणत्याही कामगाराने कन्फर्म केले नाही'
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

              {/* Active Batch Escalation Countdown Indicator */}
              {!createdOrder.confirmed &&
                !createdOrder.expanding &&
                !createdOrder.allBatchesExhausted &&
                createdOrder.jobId && (
                  <div className="rounded-xl bg-blue-50/80 border border-blue-200 px-4 py-2.5 text-left flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0B3B75]">
                      <Clock className="w-4 h-4 text-[#E06D1B] shrink-0" />
                      <span>
                        {createdOrder.hasNextBatch
                          ? tr(
                              lang,
                              `Batch ${createdOrder.batchIndex} active · Auto-alerting next batch in ${secondsUntilNextBatch}s`,
                              `बैच ${createdOrder.batchIndex} सक्रिय · ${secondsUntilNextBatch} सेकंड में अगले नज़दीकी कामगारों को अलर्ट भेजा जाएगा`,
                              `बॅच ${createdOrder.batchIndex} सुरू · ${secondsUntilNextBatch} सेकंदात जवळच्या पुढील कामगारांना अलर्ट पाठवला जाईल`
                            )
                          : tr(
                              lang,
                              `Final batch (${createdOrder.batchIndex}) waiting for confirmation · ${secondsUntilNextBatch}s left`,
                              `अंतिम बैच (${createdOrder.batchIndex}) कन्फर्मेशन की प्रतीक्षा में · ${secondsUntilNextBatch} सेकंड शेष`,
                              `अंतिम बॅच (${createdOrder.batchIndex}) कन्फर्मेशनची प्रतीक्षा · ${secondsUntilNextBatch} सेकंद बाकी`
                            )}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-extrabold text-[#C25E00] shrink-0">
                      {secondsUntilNextBatch}s
                    </span>
                  </div>
                )}

              {/* All Eligible Batches Timed Out — Clear Fallback Options */}
              {createdOrder.allBatchesExhausted && !createdOrder.confirmed && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-left space-y-3">
                  <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                    {tr(
                      lang,
                      'All nearby eligible batches were alerted without confirmation yet. Non-responding workers were not penalized. Choose your next step below:',
                      'सभी नज़दीकी पात्र बैचों को अलर्ट भेजा जा चुका है। आप नीचे से सीधे कामगार चुन सकते हैं या दोबारा अलर्ट भेज सकते हैं:',
                      'जवळच्या सर्व पात्र बॅचेसना अलर्ट पाठवला गेला आहे. तुम्ही खालील पर्यायातून थेट कामगार निवडू शकता किंवा पुन्हा अलर्ट पाठवू शकता:'
                    )}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('find-workers', createdOrder.category)}
                      className="flex-1 h-11 px-4 rounded-xl bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span>
                        {tr(
                          lang,
                          'Browse Matching Workers',
                          'मिलते-जुलते कामगार देखें',
                          'योग्य कामगार थेट पहा'
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={createdOrder.retrying}
                      onClick={handleRetryJobNow}
                      className="flex-1 h-11 px-4 rounded-xl bg-[#E06D1B] hover:bg-[#c55b10] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${createdOrder.retrying ? 'animate-spin' : ''}`} />
                      <span>
                        {tr(
                          lang,
                          'Retry / Repost Alerts',
                          'दोबारा अलर्ट भेजें',
                          'पुन्हा अलर्ट पाठवा'
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              )}

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
                    className={`flex-1 h-12 px-5 rounded-xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer ${
                      createdOrder.confirmed
                        ? 'bg-[#15803D] hover:bg-[#116931]'
                        : 'bg-[#0B3B75] hover:bg-[#072A54]'
                    }`}
                  >
                    <span>
                      {createdOrder.confirmed
                        ? tr(
                            lang,
                            'Open Confirmed Order & Contact Worker',
                            'कन्फर्म ऑर्डर खोलें व संपर्क करें',
                            'कन्फर्म ऑर्डर उघडा व संपर्क करा'
                          )
                        : tr(
                            lang,
                            'Track Order & View Offers',
                            'ऑर्डर ट्रैक करें और ऑफर देखें',
                            'ऑर्डर ट्रॅक करा व ऑफर पहा'
                          )}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {!createdOrder.expanding &&
                  !createdOrder.confirmed &&
                  !createdOrder.allBatchesExhausted &&
                  createdOrder.hasNextBatch && (
                    <button
                      type="button"
                      onClick={() => void handleNotifyNextBatchNow(false)}
                      className="h-12 px-4 rounded-xl border border-[#0B3B75] text-[#0B3B75] hover:bg-blue-50 text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {createdOrder.remainingEligibleCount > 0
                          ? tr(
                              lang,
                              `Alert Next Batch (${createdOrder.remainingEligibleCount} waiting)`,
                              `अगले बैच को अलर्ट भेजें (${createdOrder.remainingEligibleCount} प्रतीक्षा में)`,
                              `पुढील बॅचला अलर्ट पाठवा (${createdOrder.remainingEligibleCount} प्रतीक्षेत)`
                            )
                          : tr(
                              lang,
                              `Expand to ${getNextRadiusStage(createdOrder.currentRadiusKm) ?? 30} km`,
                              `${getNextRadiusStage(createdOrder.currentRadiusKm) ?? 30} किमी तक बढ़ाएँ`,
                              `${getNextRadiusStage(createdOrder.currentRadiusKm) ?? 30} किमी पर्यंत वाढवा`
                            )}
                      </span>
                    </button>
                  )}

                {!createdOrder.expanding &&
                  !createdOrder.confirmed &&
                  !createdOrder.allBatchesExhausted &&
                  createdOrder.remainingEligibleCount > 0 &&
                  getNextRadiusStage(createdOrder.currentRadiusKm) && (
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
                <div className="flex items-center justify-center gap-4 pt-1">
                  {createdOrder.allBatchesExhausted && !createdOrder.confirmed && (
                    <button
                      type="button"
                      onClick={() => setStep('order_form')}
                      className="text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer"
                    >
                      {tr(lang, 'Edit & Repost Job', 'काम संपादित कर फिर पोस्ट करें', 'काम बदलून पुन्हा पोस्ट करा')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetToHome}
                    className="text-xs font-bold text-slate-500 hover:text-[#0B3B75] cursor-pointer"
                  >
                    {tr(lang, 'Book Another Service', 'एक और सेवा बुक करें', 'दुसरी सेवा बुक करा')}
                  </button>
                </div>
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
          shops={shops}
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
      {/* "+" Add New Skill / Category Modal */}
      <AddProfessionModal
        open={showAddProfessionModal}
        onClose={() => setShowAddProfessionModal(false)}
        lang={lang}
        user={user}
        existingProfessions={approvedProfessions}
        initialValue={searchQuery.trim()}
        onAdded={(res) => {
          setSearchQuery('');
          setAddProfessionNotice(
            res.reusedExisting
              ? tr(
                  lang,
                  `"${res.canonicalName}" is already available and ready to select!`,
                  `"${res.canonicalName}" पहले से उपलब्ध है — आप इसे चुन सकते हैं!`,
                  `"${res.canonicalName}" आधीपासून उपलब्ध आहे — तुम्ही निवडू शकता!`
                )
              : tr(
                  lang,
                  `"${res.canonicalName}" added live! Now selectable by customers and new workers.`,
                  `"${res.canonicalName}" जोड़ दिया गया है! अब ग्राहक व नए कामगार इसे चुन सकते हैं।`,
                  `"${res.canonicalName}" यशस्वीरित्या जोडले! आता ग्राहक व नवीन कामगार ते निवडू शकतात.`
                )
          );
          if (res.categoryV2) {
            handleSelectCategory(res.categoryV2);
          }
        }}
      />
    </div>
  );
};
