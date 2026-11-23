import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Compass, CreditCard, Gift, IndianRupee, Loader2, MapPin, Plus, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import { saveWorkerRegistration } from '../lib/firestoreService';
import {
  captureReferralCodeFromUrl,
  ensureWorkerReferralCode,
  lookupReferralCode,
  recordWorkerReferralAttribution,
} from '../lib/adsReferralService';
import { detectBestGpsLocation } from '../lib/locationService';
import {
  buildWorkerPhotoDocId,
  deleteProfilePhotoRecord,
  uploadProfilePhotoRecord,
} from '../lib/photoStorageService';
import {
  WORKER_REGISTRATION_FEE_INR,
  createServerRegistrationOrder,
  fetchPaymentGatewayConfig,
  isWorkerPaidBenefitsActive,
  isWorkerPaymentPaid,
  loadRazorpayCheckoutScript,
  maskMobileNumber,
  recordGatewayAttemptOnServer,
  submitWorkerRegistrationPaymentProof,
  subscribeWorkerOwnPayment,
  verifyGatewaySignatureOnServer,
  type PaymentGatewayPublicConfig,
} from '../lib/workerPaymentService';
import {
  OTHER_PROFESSION_OPTION_VALUE,
  findDuplicateProfession,
  getCustomProfessionLabel,
  submitCustomProfessionByWorker,
  subscribeApprovedProfessions,
} from '../lib/customProfessionService';
import type {
  CustomProfessionRecord,
  CustomProfessionStatus,
  PageRoute,
  VerificationMethod,
  WageUnit,
  WorkType,
  WorkerRegistrationPayment,
} from '../types/domain';
import { LocationPinModal } from './LocationPinModal';
import { NotificationOptInButton } from './NotificationOptInButton';
import { OtpVerificationBox } from './OtpVerificationBox';
import { ProfilePhotoUploader, type SelectedProfilePhoto } from './ProfilePhotoUploader';
import { PWAInstallButton } from './PWAControls';
import { SecureAvatar } from './SecureAvatar';
import { WorkPhotoUploader } from './WorkPhotoUploader';
import {
  PaymentStatusBadge,
  WorkerDigitalIdCard,
  WorkerPaymentCheckoutCard,
  WorkerPaymentHistoryCard,
  WorkerPaymentReceiptCard,
  WorkerRegistrationCertificateCard,
  downloadOfficialPaymentReceipt,
} from './WorkerCertificateAndReceipt';

interface WorkerRegistrationFormProps {
  initialReferralCode?: string;
  onNavigate: (route: PageRoute) => void;
}

export const WorkerRegistrationForm: React.FC<WorkerRegistrationFormProps> = ({
  initialReferralCode = '',
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, authError, clearAuthError, workerProfile, workerPrivate, signInWithGoogle, refreshUserProfiles } = useAuth();
  const authBannerRef = useRef<HTMLDivElement | null>(null);
  const errorBoxRef = useRef<HTMLDivElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | undefined>(undefined);
  const [testPinHash, setTestPinHash] = useState('');
  const [email, setEmail] = useState('');
  const [stateName, setStateName] = useState('Chhattisgarh');
  const [districtName, setDistrictName] = useState('Narayanpur (Abujhmad)');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [approxLat, setApproxLat] = useState<number>(19.7176);
  const [approxLng, setApproxLng] = useState<number>(81.2468);
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [gender, setGender] = useState<'female' | 'male' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [education, setEducation] = useState('10th / Secondary');
  const [primarySkill, setPrimarySkill] = useState(EMPLOYMENT_CATEGORIES[0].en);
  const [skills, setSkills] = useState<string[]>([EMPLOYMENT_CATEGORIES[0].en]);
  const [newSkillText, setNewSkillText] = useState('');
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);
  const [customProfessionName, setCustomProfessionName] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [workPhotoUrls, setWorkPhotoUrls] = useState<string[]>([]);
  const [workPhotoUploading, setWorkPhotoUploading] = useState(false);
  const [customProfessionSubmittedMsg, setCustomProfessionSubmittedMsg] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(2);
  const [expectedWage, setExpectedWage] = useState<number>(600);
  const [wageUnit, setWageUnit] = useState<WageUnit>('daily');
  const [preferredWorkType, setPreferredWorkType] = useState<WorkType>('daily_wage');
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'busy' | 'offline'>('available');
  const [preferredWorkLocation, setPreferredWorkLocation] = useState('');
  const [languagesInput, setLanguagesInput] = useState('Hindi, English');
  const [certificateNotes, setCertificateNotes] = useState('');
  const [idVerificationStatus, setIdVerificationStatus] = useState<'not_submitted' | 'voluntary_pending'>('not_submitted');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [liveLocationConsent, setLiveLocationConsent] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);
  const [ownPayment, setOwnPayment] = useState<WorkerRegistrationPayment | null>(null);

  const [saving, setSaving] = useState(false);
  const [payingRazorpay, setPayingRazorpay] = useState(false);
  const [paymentStatusMsg, setPaymentStatusMsg] = useState('');
  const [paymentErrorMsg, setPaymentErrorMsg] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayPublicConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedId, setSavedId] = useState('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const verifyingPaymentRef = useRef(false);

  // Worker Referral Attribution State (100% Free Registration; optional referral code)
  const [referralCodeInput, setReferralCodeInput] = useState<string>(() =>
    (initialReferralCode || captureReferralCodeFromUrl() || '').trim().toUpperCase()
  );
  const [capturedFromUrl, setCapturedFromUrl] = useState<boolean>(() =>
    Boolean(initialReferralCode || captureReferralCodeFromUrl())
  );
  const [resolvedReferrer, setResolvedReferrer] = useState<{
    referralCode: string;
    ownerUid: string;
    workerName: string;
  } | null>(null);
  const [referralLookupState, setReferralLookupState] = useState<
    'idle' | 'checking' | 'valid' | 'invalid' | 'self'
  >('idle');
  const [myGeneratedReferralCode, setMyGeneratedReferralCode] = useState('');

  useEffect(() => {
    const incoming = (initialReferralCode || '').trim().toUpperCase();
    if (incoming && !workerProfile && !referralCodeInput) {
      setReferralCodeInput(incoming);
      setCapturedFromUrl(true);
    }
  }, [initialReferralCode, workerProfile, referralCodeInput]);

  useEffect(() => {
    if (workerProfile) return;
    const normalized = referralCodeInput.trim().toUpperCase();
    if (!normalized) {
      setResolvedReferrer(null);
      setReferralLookupState('idle');
      return;
    }
    if (!/^[A-Z0-9_-]{4,32}$/.test(normalized)) {
      setResolvedReferrer(null);
      setReferralLookupState('invalid');
      return;
    }
    let cancelled = false;
    setReferralLookupState('checking');
    const timer = window.setTimeout(() => {
      void lookupReferralCode(normalized).then((rec) => {
        if (cancelled) return;
        if (!rec) {
          setResolvedReferrer(null);
          setReferralLookupState('invalid');
          return;
        }
        if (user && rec.ownerUid === user.uid) {
          setResolvedReferrer(null);
          setReferralLookupState('self');
          return;
        }
        setResolvedReferrer({
          referralCode: rec.referralCode,
          ownerUid: rec.ownerUid,
          workerName: rec.workerName,
        });
        setReferralLookupState('valid');
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [referralCodeInput, user, workerProfile]);

  useEffect(() => {
    if (workerProfile && workerPrivate) {
      setFullName(workerPrivate.fullName || workerProfile.displayName);
      setMobile(workerPrivate.mobile || '');
      setMobileVerified(workerPrivate.mobileVerified);
      setVerificationMethod(workerPrivate.verificationMethod);
      setTestPinHash(workerPrivate.testPinHash || '');
      setEmail(workerPrivate.email || '');
      setStateName(workerProfile.state);
      setDistrictName(workerProfile.district);
      setCityOrVillage(workerProfile.cityOrVillage);
      setApproxLat(workerProfile.approxLat);
      setApproxLng(workerProfile.approxLng);
      setPhotoUrl(workerPrivate.photoUrl || '');
      setGender(workerProfile.gender || 'prefer_not_to_say');
      setAgeConfirmed(workerPrivate.ageConfirmed);
      setEducation(workerProfile.education || '');
      const isBuiltIn = EMPLOYMENT_CATEGORIES.some((c) => c.en === workerProfile.primarySkill);
      const isApprovedCustom = approvedProfessions.some((p) => p.nameEn === workerProfile.primarySkill);
      if (workerProfile.customProfessionName && !isBuiltIn && !isApprovedCustom) {
        setPrimarySkill(OTHER_PROFESSION_OPTION_VALUE);
        setCustomProfessionName(workerProfile.customProfessionName);
      } else {
        setPrimarySkill(workerProfile.primarySkill);
        setCustomProfessionName(workerProfile.customProfessionName || '');
      }
      setSkills(workerProfile.skills || [workerProfile.primarySkill]);
      setWorkDescription(workerProfile.workDescription || '');
      setWorkPhotoUrls(workerProfile.workPhotoUrls || []);
      setExperienceYears(workerProfile.experienceYears);
      setExpectedWage(workerProfile.expectedWage);
      setWageUnit(workerProfile.wageUnit);
      setPreferredWorkType(workerProfile.preferredWorkType);
      setAvailabilityStatus(workerProfile.availabilityStatus);
      setPreferredWorkLocation(workerPrivate.preferredWorkLocation || '');
      setLanguagesInput((workerProfile.languagesKnown || []).join(', '));
      setCertificateNotes(workerPrivate.certificateNotes || '');
      setIdVerificationStatus(
        workerPrivate.idVerificationStatus === 'voluntary_pending' ? 'voluntary_pending' : 'not_submitted'
      );
      setPrivacyConsent(workerPrivate.privacyConsent);
      setLiveLocationConsent(workerPrivate.liveLocationConsent);
      setRefundPolicyAccepted(Boolean(workerPrivate.refundPolicyAccepted ?? isWorkerPaidBenefitsActive(workerProfile)));
      setSavedId(workerProfile.registrationId);
    } else if (user) {
      setFullName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [workerProfile, workerPrivate, user, approvedProfessions]);

  useEffect(() => {
    return subscribeApprovedProfessions(setApprovedProfessions);
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnPayment(null);
      return;
    }
    return subscribeWorkerOwnPayment(user.uid, setOwnPayment);
  }, [user]);

  useEffect(() => {
    let active = true;
    void fetchPaymentGatewayConfig()
      .then((cfg) => {
        if (active) setGatewayConfig(cfg);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const isOtherProfessionSelected = primarySkill === OTHER_PROFESSION_OPTION_VALUE;
  const liveCustomDuplicate = isOtherProfessionSelected
    ? findDuplicateProfession({
        inputName: customProfessionName,
        existingCustomProfessions: approvedProfessions,
      })
    : null;

  const isAlreadyPaid = isWorkerPaymentPaid(workerProfile, ownPayment);
  const isAdminApproved = isWorkerPaidBenefitsActive(workerProfile);

  const currentStateObj = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName);

  const handleStateChange = (nextState: string) => {
    setStateName(nextState);
    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === nextState);
    const firstDist = st?.districts[0]?.name || '';
    setDistrictName(firstDist);
    const coords = getDistrictCoordinates(nextState, firstDist);
    setApproxLat(coords.lat);
    setApproxLng(coords.lng);
  };

  const handleDistrictChange = (nextDist: string) => {
    setDistrictName(nextDist);
    const coords = getDistrictCoordinates(stateName, nextDist);
    setApproxLat(coords.lat);
    setApproxLng(coords.lng);
  };

  const handleCaptureBrowserLocation = async () => {
    setGpsDetecting(true);
    setGpsStatusMsg('');
    try {
      const detected = await detectBestGpsLocation(lang);
      setApproxLat(detected.lat);
      setApproxLng(detected.lng);
      if (detected.state && INDIA_STATES_DISTRICTS.some((s) => s.name === detected.state)) {
        setStateName(detected.state);
      }
      if (detected.district) setDistrictName(detected.district);
      if (detected.cityOrVillage) setCityOrVillage(detected.cityOrVillage);
      setGpsStatusMsg(
        detected.isApproximate
          ? `Network estimate (${detected.accuracyMeters ? `~${Math.round(detected.accuracyMeters / 1000)} km` : 'coarse'}): ${detected.formattedAddress}. Tap "Pin on Map" if inaccurate.`
          : `Detected: ${detected.formattedAddress}`
      );
    } catch {
      setGpsStatusMsg('Unable to access device GPS. Please select State/District or Pin on Map.');
    } finally {
      setGpsDetecting(false);
    }
  };

  const addSkill = () => {
    const trimmed = newSkillText.trim();
    if (!trimmed) return;
    if (skills.length >= 15) return;
    if (!skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setNewSkillText('');
  };

  const failValidation = (msg: string, targetRef: React.RefObject<HTMLElement | null> = errorBoxRef) => {
    setErrorMsg(msg);
    window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 20);
  };

  const validateAndPersistRegistration = async (): Promise<{
    regId: string;
    workerLocation: string;
    resolvedPrimarySkill: string;
  } | null> => {
    setErrorMsg('');
    setPaymentErrorMsg('');
    clearAuthError();

    if (!user) {
      failValidation(
        t.common.signInRequired || 'Please sign in with Google above or below before completing registration.',
        authBannerRef
      );
      return null;
    }
    if (!user.emailVerified) {
      failValidation(
        'Your Google account email is not verified. Please sign in with a verified Google account to register.',
        authBannerRef
      );
      return null;
    }
    if (fullName.trim().length < 2) {
      failValidation('Please enter your full name (minimum 2 characters).');
      return null;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      failValidation('Please enter a valid 10-digit Indian mobile number starting with 6–9.');
      return null;
    }
    if (!mobileVerified) {
      failValidation(
        'Please complete mobile OTP verification before submitting. (If live SMS is unavailable, use authorized Demo Registration Mode for pre-launch testing.)'
      );
      return null;
    }
    if (cityOrVillage.trim().length < 2) {
      failValidation('Please enter your city, town, or village (minimum 2 characters).');
      return null;
    }
    const expNum = Number(experienceYears);
    if (!Number.isFinite(expNum) || expNum < 0 || expNum > 70) {
      failValidation('Experience years must be between 0 and 70.');
      return null;
    }
    const wageNum = Number(expectedWage);
    if (workPhotoUploading) {
      failValidation(
        lang === 'mr'
          ? 'कृपया कामाचे फोटो अपलोड पूर्ण होईपर्यंत थांबा.'
          : lang === 'hi'
          ? 'कृपया कार्य फ़ोटो अपलोड पूरा होने तक प्रतीक्षा करें।'
          : 'Please wait for your work photos to finish uploading before submitting.'
      );
      return null;
    }
    if (isOtherProfessionSelected && customProfessionName.trim().length < 2) {
      failValidation(
        lang === 'mr'
          ? 'कृपया "तुमचा व्यवसाय लिहा" (किमान 2 अक्षरे) भरा.'
          : lang === 'hi'
          ? 'कृपया "अपना व्यवसाय लिखें" (कम से कम 2 अक्षर) भरें।'
          : 'Please enter your profession name (minimum 2 characters) when "Other Profession / Add Your Profession" is selected.'
      );
      return null;
    }
    if (!Number.isFinite(wageNum) || wageNum < 0 || wageNum > 500000) {
      failValidation('Expected wage must be between ₹0 and ₹5,00,000.');
      return null;
    }
    if (!ageConfirmed) {
      failValidation('Age confirmation (18+) is mandatory to register.');
      return null;
    }
    if (!privacyConsent) {
      failValidation('Please accept the privacy and worker guidelines consent.');
      return null;
    }
    if (!refundPolicyAccepted) {
      failValidation('Please read and accept the ₹250 Registration Fee Refund Policy before proceeding.');
      return null;
    }

    const langs = languagesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (langs.length === 0) langs.push('Hindi');

    const regId =
      workerProfile?.registrationId ||
      savedId ||
      `RS-APP-${user.uid.slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const workerLocation = `${cityOrVillage.trim()}, ${districtName}, ${stateName}`;

    // Resolve Custom Profession / Approved Dynamic Profession (no extra fee, no duplicate entries)
    let resolvedPrimarySkill = primarySkill;
    let resolvedCustomProfessionId: string | undefined;
    let resolvedCustomProfessionName: string | undefined;
    let resolvedCustomProfessionStatus: CustomProfessionStatus | undefined;

    if (isOtherProfessionSelected) {
      const cleanedCustom = customProfessionName.trim().replace(/\s+/g, ' ').slice(0, 80);
      const dupCheck = findDuplicateProfession({
        inputName: cleanedCustom,
        existingCustomProfessions: approvedProfessions,
      });
      if (dupCheck && (dupCheck.source === 'builtin_category' || dupCheck.source === 'service_catalog')) {
        resolvedPrimarySkill = dupCheck.existingName;
      } else if (dupCheck && dupCheck.source === 'custom_approved' && dupCheck.customRecord) {
        resolvedPrimarySkill = dupCheck.customRecord.nameEn;
        resolvedCustomProfessionId = dupCheck.customRecord.slug;
        resolvedCustomProfessionName = dupCheck.customRecord.nameEn;
        if (workerProfile?.customProfessionStatus === 'approved') {
          resolvedCustomProfessionStatus = 'approved';
        }
      } else {
        const submission = await submitCustomProfessionByWorker({
          uid: user.uid,
          professionName: cleanedCustom,
          workDescription: workDescription.trim() || undefined,
          experienceYears: Number(experienceYears) || 0,
          expectedWage: Number(expectedWage) || 0,
          wageUnit,
          preferredLocation: (preferredWorkLocation.trim() || workerLocation).slice(0, 140),
          sampleWorkPhotoUrls: workPhotoUrls,
          workerName: fullName.trim().slice(0, 120),
          workerRegistrationId: regId,
          existingApprovedProfessions: approvedProfessions,
        });
        resolvedPrimarySkill = submission.canonicalName;
        resolvedCustomProfessionId = submission.professionId;
        resolvedCustomProfessionName = submission.canonicalName;
        if (submission.status === 'pending') {
          resolvedCustomProfessionStatus = 'pending';
          setCustomProfessionSubmittedMsg(
            lang === 'mr'
              ? `तुमचा नवीन व्यवसाय "${submission.canonicalName}" अ‍ॅडमिन मंजुरीसाठी पाठवला आहे. मंजुरीनंतर ग्राहक या व्यवसायासाठी तुम्हाला शोधू शकतील.`
              : lang === 'hi'
              ? `आपका नया व्यवसाय "${submission.canonicalName}" एडमिन स्वीकृति के लिए भेजा गया है। स्वीकृति के बाद ग्राहक इसे खोज सकेंगे।`
              : `Your custom profession "${submission.canonicalName}" has been submitted to the Admin Dashboard for approval. Once approved, customers can search and book this profession.`
          );
        }
      }
    } else {
      const selectedDynamic = approvedProfessions.find((p) => p.nameEn === primarySkill);
      if (selectedDynamic) {
        resolvedCustomProfessionId = selectedDynamic.slug;
        resolvedCustomProfessionName = selectedDynamic.nameEn;
        if (workerProfile?.customProfessionStatus === 'approved') {
          resolvedCustomProfessionStatus = 'approved';
        }
      }
    }

    const normalizedSkills = Array.from(
      new Set([
        resolvedPrimarySkill,
        ...skills.filter((s) => s !== OTHER_PROFESSION_OPTION_VALUE),
      ])
    ).slice(0, 15);

    const existingPhotoId = workerProfile?.photoDocId || workerPrivate?.photoDocId || '';
    let resolvedPhotoDocId: string | undefined = existingPhotoId || undefined;

    if (selectedPhoto) {
      const photoId = buildWorkerPhotoDocId(user.uid);
      await uploadProfilePhotoRecord({
        photoId,
        ownerUid: user.uid,
        subjectId: user.uid,
        role: 'worker',
        mimeType: selectedPhoto.mimeType,
        sizeBytes: selectedPhoto.sizeBytes,
        photoData: selectedPhoto.photoData,
      });
      resolvedPhotoDocId = photoId;
    } else if (removePhoto && existingPhotoId) {
      await deleteProfilePhotoRecord(existingPhotoId);
      resolvedPhotoDocId = workerProfile ? '' : undefined;
    }

    const isNewWorker = !workerProfile;
    const validReferrerForCreate =
      isNewWorker && resolvedReferrer && resolvedReferrer.ownerUid !== user.uid
        ? resolvedReferrer
        : null;

    const publicWorkerData = {
      ownerUid: user.uid,
      registrationId: regId,
      displayName: fullName.trim().slice(0, 120),
      primarySkill: resolvedPrimarySkill,
      skills: normalizedSkills,
      experienceYears: Number(experienceYears) || 0,
      expectedWage: Number(expectedWage) || 0,
      wageUnit,
      preferredWorkType,
      availabilityStatus,
      state: stateName,
      district: districtName,
      cityOrVillage: cityOrVillage.trim().slice(0, 100),
      approxLat,
      approxLng,
      languagesKnown: langs,
      gender,
      education: education.trim().slice(0, 100),
      verificationStatus: workerProfile?.verificationStatus || 'pending',
      isWomenEnterprise: gender === 'female',
      ...(resolvedPhotoDocId !== undefined ? { photoDocId: resolvedPhotoDocId } : {}),
      ...(resolvedCustomProfessionId ? { customProfessionId: resolvedCustomProfessionId } : {}),
      ...(resolvedCustomProfessionName ? { customProfessionName: resolvedCustomProfessionName } : {}),
      ...(resolvedCustomProfessionStatus ? { customProfessionStatus: resolvedCustomProfessionStatus } : {}),
      ...(workDescription.trim() ? { workDescription: workDescription.trim().slice(0, 500) } : {}),
      ...(workPhotoUrls.length > 0 ? { workPhotoUrls: workPhotoUrls.slice(0, 4) } : {}),
      completedJobsCount: workerProfile?.completedJobsCount || 0,
      ratingAvg: workerProfile?.ratingAvg || 0,
      ...(workerProfile?.referralCode ? { referralCode: workerProfile.referralCode } : {}),
      ...(workerProfile?.referredByCode
        ? {
            referredByCode: workerProfile.referredByCode,
            ...(workerProfile.referredByUid ? { referredByUid: workerProfile.referredByUid } : {}),
            ...(workerProfile.referredByName ? { referredByName: workerProfile.referredByName } : {}),
          }
        : validReferrerForCreate
        ? {
            referredByCode: validReferrerForCreate.referralCode,
            referredByUid: validReferrerForCreate.ownerUid,
            referredByName: validReferrerForCreate.workerName.slice(0, 120),
          }
        : {}),
    };

    const privateWorkerData = {
      ownerUid: user.uid,
      fullName: fullName.trim().slice(0, 120),
      mobile: mobile.trim(),
      mobileVerified,
      ...(verificationMethod ? { verificationMethod } : {}),
      ...(testPinHash ? { testPinHash } : {}),
      email: email.trim().slice(0, 200),
      ageConfirmed,
      preferredWorkLocation: preferredWorkLocation.trim().slice(0, 160),
      liveLocationConsent,
      privacyConsent,
      refundPolicyAccepted,
      noEmploymentGuaranteeAccepted: true,
      idVerificationStatus,
      certificateNotes: certificateNotes.trim().slice(0, 500),
      photoUrl: photoUrl.trim().slice(0, 1000),
      ...(resolvedPhotoDocId !== undefined ? { photoDocId: resolvedPhotoDocId } : {}),
      ...(workerPrivate?.referralCode ? { referralCode: workerPrivate.referralCode } : {}),
      ...(workerPrivate?.referredByCode
        ? {
            referredByCode: workerPrivate.referredByCode,
            ...(workerPrivate.referredByUid ? { referredByUid: workerPrivate.referredByUid } : {}),
          }
        : validReferrerForCreate
        ? {
            referredByCode: validReferrerForCreate.referralCode,
            referredByUid: validReferrerForCreate.ownerUid,
          }
        : {}),
    };

    await saveWorkerRegistration(user.uid, Boolean(workerProfile), publicWorkerData, privateWorkerData);

    if (isWorkerPaidBenefitsActive(workerProfile)) {
      try {
        const assignedCode = await ensureWorkerReferralCode(
          { id: user.uid, ...publicWorkerData },
          privateWorkerData
        );
        setMyGeneratedReferralCode(assignedCode);
      } catch {
        // Non-blocking
      }
    }

    if (validReferrerForCreate) {
      try {
        await recordWorkerReferralAttribution({
          referralCode: validReferrerForCreate.referralCode,
          sourceChannel: capturedFromUrl ? 'url_link' : 'manual_code',
          referredUid: user.uid,
          referredWorkerName: fullName.trim().slice(0, 120),
          referredRegistrationId: regId,
          referredMobile: mobile.trim(),
        });
      } catch {
        // Non-blocking
      }
    }

    setSelectedPhoto(null);
    setRemovePhoto(false);
    setSavedId(regId);
    return { regId, workerLocation, resolvedPrimarySkill };
  };

  const handlePayAndCompleteRegistration = async () => {
    if (payingRazorpay || saving) return;
    setErrorMsg('');
    setPaymentErrorMsg('');
    setPaymentStatusMsg('');

    // Prevent duplicate payment if already PAID
    if (isAlreadyPaid) {
      setSaving(true);
      try {
        const saved = await validateAndPersistRegistration();
        if (!saved) return;
        await refreshUserProfiles();
        setShowSuccessScreen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setErrorMsg(formatUiError(err, 'Unable to update worker profile. Please try again.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    setPayingRazorpay(true);
    try {
      // 1. Validate & save worker registration details linked to this user's UID
      const saved = await validateAndPersistRegistration();
      if (!saved || !user) {
        setPayingRazorpay(false);
        return;
      }

      // 2. Create ₹250 (25000 paise) Razorpay order securely on backend
      const order = await createServerRegistrationOrder({ registrationId: saved.regId });
      if (order.mode !== 'gateway' || !order.razorpayKeyId || !order.gatewayOrderId) {
        const missing = (order.missingGatewayEnvVars || gatewayConfig?.missingGatewayEnvVars || []).join(', ');
        setPaymentErrorMsg(
          order.configError ||
            `Razorpay Test Mode checkout requires server payment gateway credentials${missing ? ` (${missing})` : ''}. Your registration draft (${saved.regId}) has been saved; complete payment below once gateway credentials are active.`
        );
        await refreshUserProfiles();
        setShowSuccessScreen(true);
        setPayingRazorpay(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // 3. Load Razorpay Checkout script and open modal
      const loaded = await loadRazorpayCheckoutScript();
      type RazorpayCtorType = new (options: Record<string, unknown>) => {
        open: () => void;
        on: (
          event: string,
          cb: (resp: {
            error?: { description?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } };
          }) => void
        ) => void;
      };
      const RazorpayCtor = (window as unknown as { Razorpay?: RazorpayCtorType }).Razorpay;
      if (!loaded || !RazorpayCtor) {
        setPaymentErrorMsg('Unable to load Razorpay Checkout. Please check your internet connection and retry.');
        setPayingRazorpay(false);
        return;
      }

      const rzp = new RazorpayCtor({
        key: order.razorpayKeyId,
        amount: 25000, // Exact ₹250 in paise
        currency: 'INR',
        name: 'ROJGAR SETU',
        description: 'Worker Registration Fee — Worker ID Card & Registration Certificate',
        order_id: order.gatewayOrderId,
        prefill: {
          name: fullName.trim(),
          email: email.trim() || user.email || undefined,
          contact: mobile.replace(/\D/g, '').slice(-10),
        },
        notes: {
          workerUid: user.uid,
          registrationId: saved.regId,
          orderRef: order.orderRef,
        },
        theme: { color: '#0B3B75' },
        modal: {
          ondismiss: () => {
            setPayingRazorpay(false);
            setPaymentErrorMsg(
              'Payment was cancelled before completion. Your registration is NOT marked PAID. Click "Pay ₹250 & Complete Registration" to retry.'
            );
            void recordGatewayAttemptOnServer({
              outcome: 'cancelled',
              gatewayOrderId: order.gatewayOrderId,
              orderRef: order.orderRef,
              reason: 'Worker closed Razorpay Checkout before payment completion.',
            }).finally(() => void refreshUserProfiles());
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          if (verifyingPaymentRef.current) return;
          verifyingPaymentRef.current = true;
          try {
            // 4. Verify signature + captured ₹250 status on server
            const verification = await verifyGatewaySignatureOnServer({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderRef: order.orderRef,
              registrationId: saved.regId,
              workerName: fullName.trim().slice(0, 120),
              workerSkill: saved.resolvedPrimarySkill,
              workerLocation: saved.workerLocation,
              workerMobileMasked: maskMobileNumber(mobile.trim()),
            });

            // Fallback sync to Firestore if backend server has no Firebase Admin service account configured
            if (!verification.activatedOnServer) {
              await submitWorkerRegistrationPaymentProof({
                workerUid: user.uid,
                workerName: fullName.trim().slice(0, 120),
                workerSkill: saved.resolvedPrimarySkill,
                workerLocation: saved.workerLocation,
                workerMobile: mobile.trim(),
                provisionalAppId: saved.regId,
                paymentMethod: 'gateway',
                orderRef: order.orderRef,
                utrOrGatewayRef: response.razorpay_payment_id,
                payerUpiOrName: 'Razorpay Server-Verified PAID',
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                refundPolicyAccepted: true,
                noEmploymentGuaranteeAccepted: true,
                otpVerified: mobileVerified,
                referredByCode: workerProfile?.referredByCode || resolvedReferrer?.referralCode,
                referredByUid: workerProfile?.referredByUid || resolvedReferrer?.ownerUid,
              }).catch(() => undefined);
            }

            setPaymentStatusMsg(
              `₹250 PAID & Verified! Payment ID: ${response.razorpay_payment_id}. Registration ${saved.regId} has been sent to the ROJGAR SETU Admin Dashboard for approval.`
            );
            await refreshUserProfiles();
            setShowSuccessScreen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (verifyErr) {
            setPaymentErrorMsg(
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Server payment verification failed. Please retry or contact ROJGAR SETU support.'
            );
          } finally {
            verifyingPaymentRef.current = false;
            setPayingRazorpay(false);
          }
        },
      });

      rzp.on('payment.failed', (failResp) => {
        setPayingRazorpay(false);
        const desc = failResp?.error?.description || failResp?.error?.reason || 'Payment failed at Razorpay.';
        setPaymentErrorMsg(
          `Payment Failed: ${desc}. Payment status has NOT been marked PAID. Please click "Retry Payment — Pay ₹250 & Complete Registration" to try again.`
        );
        void recordGatewayAttemptOnServer({
          outcome: 'failed',
          gatewayOrderId: failResp?.error?.metadata?.order_id || order.gatewayOrderId,
          gatewayPaymentId: failResp?.error?.metadata?.payment_id,
          orderRef: order.orderRef,
          reason: desc,
        }).finally(() => void refreshUserProfiles());
      });

      rzp.open();
    } catch (err) {
      setPayingRazorpay(false);
      setPaymentErrorMsg(formatUiError(err, 'Unable to initiate ₹250 Razorpay payment. Please try again.'));
      window.setTimeout(() => {
        errorBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 20);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handlePayAndCompleteRegistration();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#15803D] mb-1">{t.hero.campaignNote}</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B3B75]">
          {t.workerForm.title}
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base">{t.workerForm.subtitle}</p>
      </div>

      {!user && (
        <div
          ref={authBannerRef}
          className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B3B75]">
                {t.workerForm.authRequiredTitle}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{t.workerForm.authRequiredDesc}</p>
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.workerForm.signInBtn}
            </button>
          </div>
          {authError && (
            <p className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </p>
          )}
        </div>
      )}

      {/* Clear ₹250 Registration Fee & Benefits Disclosure Banner (Shown before payment) */}
      {!isWorkerPaidBenefitsActive(workerProfile) && !showSuccessScreen && (
        <div className="mb-6 bg-white border-2 border-[#0B3B75] rounded-xl overflow-hidden shadow-2xs">
          <div className="h-1 flex">
            <div className="flex-1 bg-[#E06D1B]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#15803D]" />
          </div>
          <div className="p-4 sm:p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[#15803D]" />
                <h2 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75]">
                  {lang === 'mr'
                    ? `एकवेळ कामगार नोंदणी शुल्क: ₹${WORKER_REGISTRATION_FEE_INR}`
                    : lang === 'hi'
                    ? `एकमुश्त कामगार पंजीकरण शुल्क: ₹${WORKER_REGISTRATION_FEE_INR}`
                    : `One-Time Worker Registration Fee: ₹${WORKER_REGISTRATION_FEE_INR}`}
                </h2>
              </div>
              <span className="text-xs font-extrabold text-[#15803D]">“कामगार नाही, आपलीच माणसं!”</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {lang === 'mr'
                ? 'तुमची प्रोफाईल जतन केल्यानंतर ₹250 एकवेळ शुल्क अधिकृत UPI QR किंवा पेमेंट गेटवेद्वारे भरा. पेमेंट सत्यापित झाल्यावरच तुमचा युनिक कामगार ID (RS-W-...), डिजिटल ओळखपत्र, नोंदणी प्रमाणपत्र, पेमेंट पावती आणि ₹50 सिंगल-लेव्हल रेफरल कोड सुरू होईल.'
                : lang === 'hi'
                ? 'प्रोफ़ाइल सहेजने के बाद आधिकारिक UPI QR या पेमेंट गेटवे से ₹250 एकमुश्त शुल्क जमा करें। भुगतान सत्यापित होने पर ही आपका अद्वितीय कामगार ID (RS-W-...), डिजिटल पहचान पत्र, पंजीकरण प्रमाणपत्र, भुगतान रसीद और ₹50 सिंगल-लेवल रेफरल कोड सक्रिय होगा।'
                : 'After saving your details below, pay the one-time ₹250 registration fee via Official UPI QR or configured Payment Gateway. Your unique Verified Worker ID (RS-W-...), Digital Worker ID Card, Official Registration Certificate, Payment Receipt, and ₹50 Single-Level Referral Code activate only after payment verification.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500">Registration Fee</div>
                <div className="font-mono-tabular text-sm font-extrabold text-[#0B3B75] mt-0.5">
                  ₹{WORKER_REGISTRATION_FEE_INR}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500">Payment Method</div>
                <div className="font-extrabold text-[#0B3B75] mt-0.5">Razorpay</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500">Payment Status</div>
                <div className="mt-0.5">
                  <PaymentStatusBadge
                    status={ownPayment?.status || workerProfile?.registrationPaymentStatus || 'pending'}
                    lang={lang}
                  />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500">Payment Receipt</div>
                <div className="mt-0.5">
                  {ownPayment && ownPayment.status === 'verified' ? (
                    <button
                      type="button"
                      onClick={() => downloadOfficialPaymentReceipt(ownPayment)}
                      className="text-xs font-extrabold text-[#15803D] underline cursor-pointer"
                    >
                      Download
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">After verification</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E06D1B] shrink-0 mt-0.5" />
              <span>
                <strong>Disclosure:</strong> Registration fee payment does not guarantee employment or job allocation. Refunds apply only to verified duplicate/failed transactions or valid cancellation before benefit activation within 7 days.
              </span>
            </div>
          </div>
        </div>
      )}

      {savedId && showSuccessScreen && (
        <section className="mb-8 space-y-5">
          <div className="bg-white border-2 border-[#15803D] rounded-xl overflow-hidden shadow-sm">
            <div
              className={`px-6 py-4 flex items-start gap-3 text-white ${
                isAdminApproved ? 'bg-[#15803D]' : isAlreadyPaid ? 'bg-[#0B3B75]' : 'bg-[#0B3B75]'
              }`}
            >
              <CheckCircle2 className="w-7 h-7 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold">
                  {isAdminApproved
                    ? 'Admin Approved ROJGAR SETU Worker!'
                    : isAlreadyPaid
                    ? '₹250 PAID — Registration Sent to ROJGAR SETU Admin Dashboard'
                    : 'Registration Saved — Complete ₹250 Payment Below'}
                </h2>
                <p className="text-sm text-blue-50 font-semibold mt-0.5">
                  {isAdminApproved
                    ? 'आपकी कामगार प्रोफ़ाइल और ₹250 पंजीकरण सत्यापित है · “कामगार नाही, आपलीच माणसं!”'
                    : isAlreadyPaid
                    ? 'Your ₹250 fee is PAID and verified on our server. Your Worker ID Card & Registration Certificate will be generated automatically once ROJGAR SETU Admin approves your registration.'
                    : 'तुमची माहिती जतन झाली आहे. नोंदणी पूर्ण करण्यासाठी खाली ₹250 पेमेंट करा.'}
                </p>
              </div>
            </div>

            {paymentStatusMsg && (
              <div className="mx-6 mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>{paymentStatusMsg}</span>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm">
                <div className="flex items-center gap-3">
                  <SecureAvatar
                    name={fullName || 'Worker'}
                    photoDocId={workerProfile?.photoDocId || workerPrivate?.photoDocId}
                    sizeClass="w-12 h-12"
                  />
                  <div>
                    <div className="text-slate-500 text-xs font-medium">
                      {lang === 'hi' ? 'कामगार नाम' : lang === 'mr' ? 'कामगार नाव' : 'Worker Name'}
                    </div>
                    <div className="font-bold text-[#0B3B75] mt-0.5">{fullName}</div>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">
                    {isAdminApproved ? 'Verified Worker ID' : 'Worker Registration ID'}
                  </div>
                  <div className="font-mono-tabular font-extrabold text-[#C25E00] mt-0.5">
                    {workerProfile?.registrationId || savedId}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Payment Status</div>
                  <div className="mt-1">
                    <PaymentStatusBadge
                      status={ownPayment?.status || workerProfile?.registrationPaymentStatus || 'pending'}
                      lang={lang}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">
                    {lang === 'hi' ? 'पंजीकृत कौशल' : lang === 'mr' ? 'नोंदवलेली कौशल्ये' : 'Registered Skills'}
                  </div>
                  <div className="font-semibold text-slate-800 mt-0.5">{skills.join(' · ')}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-slate-500 text-xs font-medium">
                    {lang === 'hi' ? 'स्थान' : lang === 'mr' ? 'ठिकाण' : 'Location'}
                  </div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {cityOrVillage}, {districtName}, {stateName}
                  </div>
                </div>
                {isAdminApproved &&
                  (myGeneratedReferralCode || workerProfile?.referralCode) && (
                    <div className="sm:col-span-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-[#E06D1B]" />
                        <span className="text-xs text-slate-600 font-medium">Your Verified Referral Code:</span>
                        <span className="font-mono-tabular font-extrabold text-[#0B3B75]">
                          {myGeneratedReferralCode || workerProfile?.referralCode}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#15803D]">
                        Earn ₹50 per verified direct referral in Worker Dashboard → My Referrals
                      </span>
                    </div>
                  )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <PWAInstallButton variant="primary" />
                <NotificationOptInButton role="worker" />
                <button
                  type="button"
                  onClick={() => onNavigate('worker-dashboard')}
                  className="px-5 py-2.5 rounded-md bg-[#15803D] text-white text-sm font-bold hover:bg-emerald-800 cursor-pointer min-h-[44px]"
                >
                  Open Worker Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuccessScreen(false)}
                  className="px-4 py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {lang === 'hi' ? 'प्रोफ़ाइल संपादित करें' : lang === 'mr' ? 'प्रोफाईल बदला' : 'Edit Profile'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: ₹250 Payment Checkout (shown ONLY if not yet PAID — prevents duplicate payments) */}
          {user && !isAlreadyPaid && (
            <WorkerPaymentCheckoutCard
              workerUid={user.uid}
              workerName={fullName.trim() || workerProfile?.displayName || 'Worker'}
              workerSkill={primarySkill}
              workerLocation={`${cityOrVillage}, ${districtName}, ${stateName}`}
              workerMobile={mobile.trim()}
              provisionalAppId={workerProfile?.registrationId || savedId}
              otpVerified={mobileVerified}
              referredByCode={workerProfile?.referredByCode || resolvedReferrer?.referralCode}
              referredByUid={workerProfile?.referredByUid || resolvedReferrer?.ownerUid}
              existingPayment={ownPayment}
              preAcceptedPolicies={refundPolicyAccepted}
              onPaymentSubmitted={() => void refreshUserProfiles()}
            />
          )}

          {/* Registration Payment Status & History */}
          <WorkerPaymentHistoryCard workerProfile={workerProfile} payment={ownPayment} />

          {/* Receipt Card (shown as soon as payment record exists) */}
          {ownPayment && <WorkerPaymentReceiptCard payment={ownPayment} />}

          {/* Official Registration Certificate Card (shows Awaiting Admin Approval when PAID, unlocks ONLY after Admin approval) */}
          {workerProfile && (
            <WorkerRegistrationCertificateCard
              workerProfile={workerProfile}
              payment={ownPayment}
            />
          )}

          {/* Verified Digital ID Card (generated ONLY after ROJGAR SETU Admin approval) */}
          {workerProfile && isAdminApproved && (
            <WorkerDigitalIdCard
              workerProfile={workerProfile}
              workerPrivate={workerPrivate}
              payment={ownPayment}
            />
          )}
        </section>
      )}

      {savedId && !showSuccessScreen && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-950">{t.workerForm.successMsg}</p>
              <p className="text-xs text-green-900 mt-0.5 font-mono-tabular">
                {t.workerForm.uniqueIdLabel}: <strong>{savedId}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => onNavigate('worker-dashboard')}
              className="px-4 py-2 rounded-md bg-[#15803D] text-white text-xs font-semibold hover:bg-green-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Worker Dashboard
            </button>
          </div>
        </div>
      )}

      {!showSuccessScreen && (
      <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.fullName} *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.emailOpt}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.workerForm.mobile} *
          </label>
          <OtpVerificationBox
            mobile={mobile}
            allowTestPinFallback={false}
            onOpenDemoMode={() => onNavigate('demo-testing')}
            onMobileChange={(v) => {
              setMobile(v);
              setMobileVerified(false);
              setVerificationMethod(undefined);
              setTestPinHash('');
            }}
            verified={mobileVerified}
            verifiedMethod={verificationMethod}
            onVerified={(m, meta) => {
              setMobile(m);
              setMobileVerified(true);
              setVerificationMethod(meta?.method);
              setTestPinHash(meta?.testPinHash || '');
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.state} *
            </label>
            <select
              value={stateName}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            >
              {INDIA_STATES_DISTRICTS.map((st) => (
                <option key={st.name} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.district} *
            </label>
            <select
              value={districtName}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            >
              {currentStateObj?.districts.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.cityVillage} *
            </label>
            <input
              type="text"
              required
              value={cityOrVillage}
              onChange={(e) => setCityOrVillage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>
        </div>

        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-md p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-700">
              <span className="font-semibold">{t.workerForm.currentLocationOpt}:</span>{' '}
              <span className="font-mono-tabular">
                {approxLat.toFixed(4)}° N, {approxLng.toFixed(4)}° E
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={gpsDetecting}
                onClick={handleCaptureBrowserLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-[#0B3B75] hover:bg-slate-100 cursor-pointer disabled:opacity-60"
              >
                <Compass className="w-3.5 h-3.5" />
                {gpsDetecting ? 'Detecting...' : t.workerForm.captureCoords}
              </button>
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-xs font-semibold text-[#0B3B75] hover:bg-blue-50 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                {lang === 'mr' ? 'नकाशावर पिन करा' : lang === 'hi' ? 'नक्शे पर पिन करें' : 'Pin on Map'}
              </button>
            </div>
          </div>
          {gpsStatusMsg && <p className="text-xs text-[#15803D] font-medium">{gpsStatusMsg}</p>}
          <LocationPinModal
            open={showPinModal}
            onClose={() => setShowPinModal(false)}
            initialLat={approxLat}
            initialLng={approxLng}
            initialLabel={cityOrVillage || districtName}
            onConfirmLocation={(loc) => {
              setApproxLat(loc.lat);
              setApproxLng(loc.lng);
              if (loc.state && INDIA_STATES_DISTRICTS.some((s) => s.name === loc.state)) {
                setStateName(loc.state);
              }
              if (loc.district) setDistrictName(loc.district);
              if (loc.cityOrVillage) setCityOrVillage(loc.cityOrVillage);
              setGpsStatusMsg(`Pinned exact location: ${loc.formattedAddress}`);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.genderOpt}
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.education}
            </label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="No formal schooling">No formal schooling</option>
              <option value="Primary / 8th Pass">Primary / 8th Pass</option>
              <option value="10th / Secondary">10th / Secondary</option>
              <option value="12th / Senior Secondary">12th / Senior Secondary</option>
              <option value="ITI / Vocational Certificate">ITI / Vocational Certificate</option>
              <option value="Diploma / Graduate">Diploma / Graduate</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <ProfilePhotoUploader
              existingPhotoDocId={workerProfile?.photoDocId || workerPrivate?.photoDocId}
              selectedPhoto={selectedPhoto}
              removedExisting={removePhoto}
              onSelectPhoto={(photo) => {
                setSelectedPhoto(photo);
                setRemovePhoto(false);
              }}
              onRemovePhoto={() => {
                setSelectedPhoto(null);
                setRemovePhoto(true);
              }}
              roleLabel={t.workerForm.photoOpt}
              privacyNote={
                lang === 'hi'
                  ? 'फ़ोटो वैकल्पिक है। प्रोफ़ाइल फ़ोटो केवल पंजीकृत ग्राहकों और एडमिन को काम की खोज में दिखाई देती है।'
                  : lang === 'mr'
                    ? 'फोटो ऐच्छिक आहे. तुमचा फोटो शोध परिणामांत आणि कामाच्या अर्जावर नोंदणीकृत ग्राहकांना दिसेल.'
                    : 'Optional. Your photo helps customers recognize you in worker search results and job applications.'
              }
            />
          </div>
        </div>

        {/* Multi-skill & Custom Profession section */}
        <div className="space-y-4 pt-2 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.workerForm.primarySkill} *
              </label>
              <select
                value={primarySkill}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrimarySkill(val);
                  if (val !== OTHER_PROFESSION_OPTION_VALUE && !skills.includes(val)) {
                    setSkills((prev) =>
                      [val, ...prev.filter((s) => s !== OTHER_PROFESSION_OPTION_VALUE)].slice(0, 15)
                    );
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <optgroup
                  label={
                    lang === 'mr'
                      ? 'प्रमुख रोजगार श्रेणी'
                      : lang === 'hi'
                      ? 'प्रमुख रोजगार श्रेणियाँ'
                      : 'Standard Professions'
                  }
                >
                  {EMPLOYMENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.en}>
                      {lang === 'hi' ? c.hi : lang === 'mr' ? c.mr : c.en}
                    </option>
                  ))}
                </optgroup>
                {approvedProfessions.length > 0 && (
                  <optgroup
                    label={
                      lang === 'mr'
                        ? 'मंजूर विशेष व्यवसाय (नवीन श्रेणी)'
                        : lang === 'hi'
                        ? 'स्वीकृत विशेष व्यवसाय (नई श्रेणियाँ)'
                        : 'Approved Specialized Professions'
                    }
                  >
                    {approvedProfessions.map((p) => (
                      <option key={p.slug} value={p.nameEn}>
                        {getCustomProfessionLabel(p, lang)}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={OTHER_PROFESSION_OPTION_VALUE}>
                  {lang === 'mr'
                    ? '➕ इतर व्यवसाय / तुमचा व्यवसाय जोडा (Other Profession / Add Your Profession)'
                    : lang === 'hi'
                    ? '➕ अन्य व्यवसाय / अपना व्यवसाय जोड़ें (Other Profession / Add Your Profession)'
                    : '➕ Other Profession / Add Your Profession'}
                </option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                {lang === 'mr'
                  ? 'तुमचा व्यवसाय यादीत नसल्यास शेवटचा पर्याय "इतर व्यवसाय / तुमचा व्यवसाय जोडा" निवडा.'
                  : lang === 'hi'
                  ? 'यदि आपका काम सूची में नहीं है, तो अंतिम विकल्प "अन्य व्यवसाय / अपना व्यवसाय जोड़ें" चुनें।'
                  : 'Don’t see your profession? Select "Other Profession / Add Your Profession" at the end of the list.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.workerForm.additionalSkills}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={t.workerForm.addSkillPlaceholder}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-slate-300 text-xs font-semibold text-[#0B3B75] hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.workerForm.addSkillBtn}
                </button>
              </div>
            </div>
          </div>

          {/* Custom Profession / Add Your Own Skill Panel */}
          {isOtherProfessionSelected && (
            <div className="rounded-xl border-2 border-[#0B3B75]/30 bg-blue-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0B3B75]">
                    {lang === 'mr'
                      ? 'नवीन व्यवसाय / स्वतःचे कौशल्य जोडा (Custom Profession)'
                      : lang === 'hi'
                      ? 'अपना व्यवसाय / कौशल जोड़ें (Custom Profession)'
                      : 'Add Your Own Profession / Skill'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {lang === 'mr'
                      ? 'रोजगार सेतू हे A-to-Z सर्वांसाठी खुले व्यासपीठ आहे. नवीन व्यवसाय अ‍ॅडमिन मंजुरीनंतर ग्राहकांच्या शोधात दिसेल.'
                      : lang === 'hi'
                      ? 'रोज़गार सेतु सभी कामगारों के लिए A-to-Z मंच है। एडमिन स्वीकृति के बाद आपका व्यवसाय ग्राहकों की खोज में दिखेगा।'
                      : 'Rojgar Setu is an inclusive A-to-Z platform. Your custom profession will be reviewed by Admin before becoming a public searchable category.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 self-start px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {lang === 'mr'
                    ? 'अतिरिक्त शुल्क ₹0'
                    : lang === 'hi'
                    ? 'अतिरिक्त शुल्क ₹0'
                    : 'No Extra Fee (₹0)'}
                </span>
              </div>

              {/* 1. Enter Your Profession (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-[#0B3B75] mb-1">
                  {lang === 'mr'
                    ? 'तुमचा व्यवसाय लिहा (Enter Your Profession) *'
                    : lang === 'hi'
                    ? 'अपना व्यवसाय लिखें (Enter Your Profession) *'
                    : 'Enter Your Profession *'}
                </label>
                <input
                  type="text"
                  required={isOtherProfessionSelected}
                  maxLength={80}
                  value={customProfessionName}
                  onChange={(e) => setCustomProfessionName(e.target.value)}
                  placeholder={
                    lang === 'mr'
                      ? 'उदा. CCTV Installer, Solar Panel Technician, Photographer, Event Decorator, Tailor...'
                      : lang === 'hi'
                      ? 'उदा. CCTV Installer, Solar Panel Technician, Photographer, Event Decorator, Tailor...'
                      : 'e.g., CCTV Installer, Solar Panel Technician, Photographer, Video Editor, Pet Care...'
                  }
                  className="w-full px-3 py-2.5 border border-blue-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                />
                {liveCustomDuplicate && liveCustomDuplicate.existingName && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      {lang === 'mr'
                        ? `हा व्यवसाय आधीच उपलब्ध आहे: "${liveCustomDuplicate.existingName}". डुप्लिकेट टाळण्यासाठी तो निवडा.`
                        : lang === 'hi'
                        ? `यह व्यवसाय पहले से उपलब्ध है: "${liveCustomDuplicate.existingName}"। डुप्लिकेट से बचने के लिए इसे चुनें।`
                        : `This profession already exists as "${liveCustomDuplicate.existingName}". Switch to it to avoid duplicates.`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = liveCustomDuplicate.existingName;
                        const inBuiltIn = EMPLOYMENT_CATEGORIES.some((c) => c.en === target);
                        const inApproved = approvedProfessions.some((p) => p.nameEn === target);
                        if (inBuiltIn || inApproved) {
                          setPrimarySkill(target);
                          setCustomProfessionName('');
                          setSkills((prev) =>
                            Array.from(
                              new Set([target, ...prev.filter((s) => s !== OTHER_PROFESSION_OPTION_VALUE)])
                            ).slice(0, 15)
                          );
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-[#0B3B75] text-white font-semibold hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      {lang === 'mr' ? 'हा व्यवसाय निवडा' : lang === 'hi' ? 'इसे चुनें' : 'Select Existing'}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Describe Your Work / Skills (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'mr'
                    ? 'तुमच्या कामाचे / कौशल्याचे वर्णन (पर्यायी)'
                    : lang === 'hi'
                    ? 'अपने काम / कौशल का विवरण लिखें (वैकल्पिक)'
                    : 'Describe Your Work / Skills (Optional)'}
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder={
                    lang === 'mr'
                      ? 'तुम्ही कोणती कामे करता, कोणती उपकरणे/सेवा देता ते थोडक्यात लिहा...'
                      : lang === 'hi'
                      ? 'आप किस प्रकार का कार्य करते हैं, कौन से उपकरण या सेवाएँ देते हैं लिखें...'
                      : 'Briefly describe the services you offer, tools you bring, or specialized skills...'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                />
              </div>

              {/* 3, 5, 6: Work Experience (Optional), Preferred Work Location, Expected Daily/Monthly Charges (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'mr'
                      ? 'कामाचा अनुभव — वर्षे (पर्यायी)'
                      : lang === 'hi'
                      ? 'कार्य अनुभव — वर्ष (वैकल्पिक)'
                      : 'Work Experience (Optional)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'mr'
                      ? 'पसंतीचे कामाचे ठिकाण'
                      : lang === 'hi'
                      ? 'पसंदीदा कार्य स्थान'
                      : 'Preferred Work Location'}
                  </label>
                  <input
                    type="text"
                    value={preferredWorkLocation}
                    onChange={(e) => setPreferredWorkLocation(e.target.value)}
                    placeholder={
                      lang === 'mr'
                        ? 'उदा. तालुका / शहर / जिल्हा'
                        : lang === 'hi'
                        ? 'उदा. ब्लॉक / शहर / ज़िला'
                        : 'e.g., City / Block / District'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'mr'
                      ? 'अपेक्षित दैनिक / मासिक दर ₹ (पर्यायी)'
                      : lang === 'hi'
                      ? 'अपेक्षित दैनिक / मासिक शुल्क ₹ (वैकल्पिक)'
                      : 'Expected Daily or Monthly Charges ₹ (Optional)'}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={500000}
                      value={expectedWage}
                      onChange={(e) => setExpectedWage(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-mono-tabular"
                    />
                    <select
                      value={wageUnit}
                      onChange={(e) => setWageUnit(e.target.value as WageUnit)}
                      className="px-2 py-2 border border-slate-300 rounded-md text-xs bg-white shrink-0"
                    >
                      <option value="daily">{lang === 'mr' ? 'दैनिक' : lang === 'hi' ? 'दैनिक' : 'Daily'}</option>
                      <option value="monthly">{lang === 'mr' ? 'मासिक' : lang === 'hi' ? 'मासिक' : 'Monthly'}</option>
                      <option value="hourly">{lang === 'mr' ? 'ताशी' : lang === 'hi' ? 'घंटे' : 'Hourly'}</option>
                      <option value="contract">{lang === 'mr' ? 'कंत्राट' : lang === 'hi' ? 'ठेका' : 'Contract'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Upload Work Photos (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'mr'
                    ? 'कामाचे फोटो अपलोड करा (पर्यायी — कमाल 4 फोटो)'
                    : lang === 'hi'
                    ? 'कार्य के फ़ोटो अपलोड करें (वैकल्पिक — अधिकतम 4 फ़ोटो)'
                    : 'Upload Work Photos (Optional — up to 4 photos)'}
                </label>
                <WorkPhotoUploader
                  photos={workPhotoUrls}
                  onChange={setWorkPhotoUrls}
                  ownerUid={user?.uid || 'worker'}
                  folder="work"
                  disabled={!user}
                  onUploadingChange={setWorkPhotoUploading}
                />
              </div>

              {customProfessionSubmittedMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{customProfessionSubmittedMsg}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {skills
              .filter((s) => s !== OTHER_PROFESSION_OPTION_VALUE)
              .map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-medium text-slate-800"
                >
                  {s}
                  {s !== primarySkill && (
                    <button
                      type="button"
                      onClick={() => setSkills((prev) => prev.filter((item) => item !== s))}
                      className="text-slate-500 hover:text-red-700 cursor-pointer"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.experienceYears}
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.expectedWage}
            </label>
            <input
              type="number"
              min={0}
              max={500000}
              value={expectedWage}
              onChange={(e) => setExpectedWage(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.wageUnit}
            </label>
            <select
              value={wageUnit}
              onChange={(e) => setWageUnit(e.target.value as WageUnit)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="hourly">Hourly</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.preferredWorkType}
            </label>
            <select
              value={preferredWorkType}
              onChange={(e) => setPreferredWorkType(e.target.value as WorkType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="daily_wage">Daily Wage</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.availability}
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value as typeof availabilityStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="available">Available Immediately</option>
              <option value="busy">Currently Engaged</option>
              <option value="offline">Not Looking Right Now</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.preferredWorkLocation}
            </label>
            <input
              type="text"
              value={preferredWorkLocation}
              onChange={(e) => setPreferredWorkLocation(e.target.value)}
              placeholder="Local block / District / Nearby city"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.languagesKnown}
            </label>
            <input
              type="text"
              value={languagesInput}
              onChange={(e) => setLanguagesInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.certificatesOpt}
            </label>
            <input
              type="text"
              value={certificateNotes}
              onChange={(e) => setCertificateNotes(e.target.value)}
              placeholder="ITI Trade / PMKVY / Driving Licence class..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.workerForm.idStatus}
            </label>
            <select
              value={idVerificationStatus}
              onChange={(e) => setIdVerificationStatus(e.target.value as typeof idVerificationStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="not_submitted">Not Submitted (Optional)</option>
              <option value="voluntary_pending">Request Voluntary Verification Later</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 flex items-start gap-3 text-xs text-slate-700 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-[#0B3B75] shrink-0 mt-0.5" />
          <p>{t.workerForm.idNotice}</p>
        </div>

        {/* Optional Worker Referral Code Section (₹250 Registration → ₹50 Single-Level Referral Reward) */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0B3B75]">
              <Gift className="w-4 h-4 text-[#E06D1B]" />
              <span>
                {lang === 'mr'
                  ? 'रेफरल कोड (ऐच्छिक) · ₹250 एकवेळ नोंदणी शुल्क'
                  : lang === 'hi'
                  ? 'रेफरल कोड (वैकल्पिक) · ₹250 एकमुश्त पंजीकरण शुल्क'
                  : 'Worker Referral Code (Optional) · ₹250 One-Time Registration'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#15803D]">
              {lang === 'mr' ? 'सत्यापित रेफरलवर ₹50 बक्षीस' : lang === 'hi' ? 'सत्यापित रेफरल पर ₹50 पुरस्कार' : '₹50 Single-Level Reward'}
            </span>
          </div>

          {workerProfile?.referredByCode ? (
            <div className="text-xs text-emerald-900 font-semibold">
              {lang === 'mr'
                ? `नोंदणीकृत रेफरल: ${workerProfile.referredByName || 'कामगार'} (${workerProfile.referredByCode}) — कायमस्वरूपी जतन`
                : lang === 'hi'
                ? `सत्यापित रेफरल: ${workerProfile.referredByName || 'कामगार'} (${workerProfile.referredByCode}) — स्थायी रूप से लॉक`
                : `Referred by: ${workerProfile.referredByName || 'Registered Worker'} (${workerProfile.referredByCode}) — Permanently locked`}
            </div>
          ) : !workerProfile ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => {
                    setCapturedFromUrl(false);
                    setReferralCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32));
                  }}
                  placeholder={
                    lang === 'mr'
                      ? 'मित्र कामगाराचा रेफरल कोड (उदा. PRASHANT-7K4M)'
                      : lang === 'hi'
                      ? 'साथी कामगार का रेफरल कोड (उदा. PRASHANT-7K4M)'
                      : 'Enter verified worker referral code (e.g., PRASHANT-7K4M)'
                  }
                  className="flex-1 px-3 py-2 border border-slate-300 bg-white rounded-md text-sm font-mono-tabular uppercase"
                />
              </div>
              {referralLookupState === 'valid' && resolvedReferrer && (
                <p className="text-xs font-bold text-[#15803D] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'mr'
                      ? `रेफर करणारे कामगार: ${resolvedReferrer.workerName} (${resolvedReferrer.referralCode}) — ₹250 पेमेंट सत्यापित झाल्यावर ₹50 बक्षीस लागू होईल.`
                      : lang === 'hi'
                      ? `रेफर करने वाले कामगार: ${resolvedReferrer.workerName} (${resolvedReferrer.referralCode}) — ₹250 भुगतान सत्यापित होने पर ₹50 पुरस्कार मान्य होगा।`
                      : `Referred by: ${resolvedReferrer.workerName} (${resolvedReferrer.referralCode}) — Eligible for ₹50 single-level reward once ₹250 payment is verified.`}
                  </span>
                </p>
              )}
              {referralLookupState === 'self' && (
                <p className="text-xs font-semibold text-red-700">
                  {lang === 'mr'
                    ? 'स्वतःचा रेफरल कोड वापरता येत नाही.'
                    : lang === 'hi'
                    ? 'अपना स्वयं का रेफरल कोड उपयोग नहीं किया जा सकता।'
                    : 'Self-referral is not allowed.'}
                </p>
              )}
              {referralLookupState === 'invalid' && referralCodeInput.trim().length > 0 && (
                <p className="text-xs font-medium text-amber-800">
                  {lang === 'mr'
                    ? 'हा रेफरल कोड सापडला नाही. तुम्ही कोडशिवायही नोंदणी करू शकता.'
                    : lang === 'hi'
                    ? 'यह रेफरल कोड नहीं मिला। आप बिना कोड के भी पंजीकरण कर सकते हैं।'
                    : 'Referral code not found. You can leave this blank and proceed with registration.'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              {lang === 'mr'
                ? 'तुमचा वैयक्तिक रेफरल कोड ₹250 पेमेंट सत्यापित झाल्यावर कामगार डॅशबोर्डमधील "माझे रेफरल" विभागात सुरू होईल.'
                : lang === 'hi'
                ? 'आपका व्यक्तिगत रेफरल कोड ₹250 सत्यापन के बाद कामगार डैशबोर्ड के "मेरे रेफरल" टैब में सक्रिय होगा।'
                : 'Your personal referral code activates in Worker Dashboard → My Referrals once your ₹250 registration is verified.'}
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-200">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.ageConfirm} *</span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.privacyConsent} *</span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={refundPolicyAccepted}
              onChange={(e) => setRefundPolicyAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              {lang === 'mr'
                ? 'एकवेळ ₹250 नोंदणी शुल्काचे परतावा धोरण (फक्त सत्यापित दुहेरी/अयशस्वी पेमेंट किंवा लाभ सक्रिय होण्यापूर्वी ७ दिवसांत वैध रद्दबातल) मला मान्य आहे. *'
                : lang === 'hi'
                ? 'मैं ₹250 एकमुश्त पंजीकरण शुल्क की रिफंड नीति (केवल सत्यापित डुप्लिकेट/विफल लेनदेन या लाभ सक्रिय होने से पहले 7 दिनों में रद्दीकरण) स्वीकार करता/करती हूँ। *'
                : 'I accept the ₹250 One-Time Registration Refund Policy (refunds apply only to verified duplicate/failed transactions or valid cancellation before benefit activation within 7 days; refunded registrations revoke paid benefits and reverse referral rewards). *'}
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={liveLocationConsent}
              onChange={(e) => setLiveLocationConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>{t.workerForm.liveLocConsent}</span>
          </label>
        </div>

        {/* ================= VISIBLE ₹250 WORKER REGISTRATION PAYMENT SECTION ================= */}
        <section
          aria-label="ROJGAR SETU Worker Registration Fee"
          className="rounded-xl border-2 border-[#0B3B75] bg-slate-50/70 overflow-hidden shadow-xs"
        >
          <div className="h-1.5 flex">
            <div className="flex-1 bg-[#E06D1B]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#15803D]" />
          </div>

          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75]">
                    ROJGAR SETU – Worker Registration Fee
                  </h2>
                  {gatewayConfig?.razorpayMode === 'test' && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-[#9A3412] text-[10px] font-extrabold uppercase">
                      Razorpay Test Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Purpose: <strong className="text-[#0B3B75]">Worker ID Card &amp; Registration Certificate</strong> (generated after ROJGAR SETU Admin approval)
                </p>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold uppercase text-slate-500">Amount</div>
                <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D]">
                  ₹{WORKER_REGISTRATION_FEE_INR}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-lg p-3.5 text-xs">
              <div>
                <div className="text-slate-500 font-semibold">Amount</div>
                <div className="font-mono-tabular font-extrabold text-[#0B3B75] mt-0.5">₹250 (One-Time)</div>
              </div>
              <div>
                <div className="text-slate-500 font-semibold">Purpose</div>
                <div className="font-bold text-[#0B3B75] mt-0.5">Worker ID Card &amp; Registration Certificate</div>
              </div>
              <div>
                <div className="text-slate-500 font-semibold">Payment Status</div>
                <div className="mt-0.5">
                  <PaymentStatusBadge
                    status={ownPayment?.status || workerProfile?.registrationPaymentStatus || 'pending'}
                    lang={lang}
                  />
                </div>
              </div>
            </div>

            {paymentErrorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm font-semibold text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{paymentErrorMsg}</span>
              </div>
            )}

            {paymentStatusMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#15803D]" />
                <span>{paymentStatusMsg}</span>
              </div>
            )}

            {isAlreadyPaid ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950 space-y-1">
                <div className="font-extrabold text-[#15803D] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>₹250 Registration Fee Already PAID (Duplicate Payment Blocked)</span>
                </div>
                <p>
                  {isAdminApproved
                    ? `Approved Worker ID: ${workerProfile?.registrationId}. Your Worker ID Card & Registration Certificate are active.`
                    : `Payment ID: ${ownPayment?.gatewayPaymentId || ownPayment?.utrOrGatewayRef || 'Verified'}. Your registration is queued in the ROJGAR SETU Admin Dashboard for approval.`}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>
                  Secured by <strong>Razorpay</strong>. Payment signature and ₹250 capture are verified on our server before marking your registration <strong>PAID</strong> and sending it to the ROJGAR SETU Admin Dashboard for approval. Registration fee payment does not guarantee employment or job allocation.
                </span>
              </p>
            )}

            {errorMsg && (
              <div
                ref={errorBoxRef}
                role="alert"
                className="p-3.5 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!user && (
              <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                <span>
                  <strong>Sign-In Required:</strong> Sign in with Google before clicking Pay ₹250 &amp; Complete Registration so your payment and registration are linked securely to your worker account.
                </span>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-4 py-2 rounded-md bg-[#0B3B75] text-white font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.workerForm.signInBtn}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
              {isAlreadyPaid ? (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-lg bg-[#0B3B75] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? t.common.loading : t.workerForm.updateBtn}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={payingRazorpay || saving}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {payingRazorpay || saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                  <span>
                    {payingRazorpay
                      ? 'Opening Razorpay Checkout...'
                      : ownPayment?.status === 'failed'
                      ? 'Retry — Pay ₹250 & Complete Registration'
                      : 'Pay ₹250 & Complete Registration'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      </form>
      )}
    </div>
  );
};
