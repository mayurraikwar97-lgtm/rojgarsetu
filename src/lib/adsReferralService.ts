import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type {
  AdvertisementActionType,
  AdvertisementCampaign,
  AdvertisementCategory,
  AdvertisementClick,
  AdvertisementImpression,
  AdvertisementPlacement,
  AdvertisementRecord,
  AdvertisementStatus,
  AdvertiserApprovalStatus,
  AdvertiserProfile,
  Language,
  PlatformReferralConfig,
  PublicWorkerProfile,
  ReferralCodeIndexRecord,
  ReferralPayoutRecord,
  ReferralRewardRecord,
  ReferralWallet,
  WorkerPrivateInfo,
  WorkerReferralRecord,
} from '../types/domain';

// ============================================================
// DEFAULT CATEGORY RELEVANCE CATALOG FOR SPONSORED ADS
// ============================================================

export interface AdTargetCategoryOption {
  id: string;
  labelEn: string;
  labelHi: string;
  labelMr: string;
  exampleBusinessesEn: string;
  exampleBusinessesMr: string;
  aliases: string[];
}

export const DEFAULT_AD_TARGET_CATEGORIES: AdTargetCategoryOption[] = [
  {
    id: 'carpenter',
    labelEn: 'Carpenter',
    labelHi: 'बढ़ई / सुतार (Carpenter)',
    labelMr: 'सुतार (Carpenter)',
    exampleBusinessesEn: 'Doors, Plywood, Wood, Furniture & Carpentry Hardware Shops',
    exampleBusinessesMr: 'दरवाजे, प्लायवूड, फर्निचर व सुतार साहित्य दुकाने',
    aliases: ['carpenter', 'carpenters', 'wood', 'furniture', 'doors', 'plywood'],
  },
  {
    id: 'plumber',
    labelEn: 'Plumber',
    labelHi: 'प्लंबर (Plumber)',
    labelMr: 'प्लंबर (Plumber)',
    exampleBusinessesEn: 'Plumbing Material Shops, Pipes, Fittings, Sanitaryware & Water Tanks',
    exampleBusinessesMr: 'प्लंबिंग साहित्य, पाईप्स, फिटिंग्ज, सॅनिटरीवेअर व पाण्याच्या टाक्या',
    aliases: ['plumber', 'plumbers', 'plumbing', 'sanitaryware', 'pipes'],
  },
  {
    id: 'electrician',
    labelEn: 'Electrician',
    labelHi: 'इलेक्ट्रीशियन (Electrician)',
    labelMr: 'इलेक्ट्रिशियन (Electrician)',
    exampleBusinessesEn: 'Electrical Shops, Wires, Switches, Lights, Inverters & Contractors',
    exampleBusinessesMr: 'इलेक्ट्रिकल दुकाने, वायर, स्विच, लाईट्स, इन्व्हर्टर व कॉन्ट्रॅक्टर',
    aliases: ['electrician', 'electricians', 'electrical', 'wiring', 'solar'],
  },
  {
    id: 'construction',
    labelEn: 'Construction & Daily Labour',
    labelHi: 'निर्माण कामगार / मज़दूर (Construction)',
    labelMr: 'बांधकाम कामगार व मजूर (Construction)',
    exampleBusinessesEn: 'Architects, Civil Engineers, Building Contractors, Cement, Steel, Sand, Bricks & Tiles',
    exampleBusinessesMr: 'आर्किटेक्ट, सिव्हिल इंजिनिअर, बिल्डिंग कॉन्ट्रॅक्टर, सिमेंट, स्टील, वाळू व विटा',
    aliases: [
      'construction',
      'construction workers',
      'daily_labour',
      'daily labour',
      'mason',
      'helpers and general labour',
      'agricultural workers',
    ],
  },
  {
    id: 'painter',
    labelEn: 'Painter',
    labelHi: 'पेंटर (Painter)',
    labelMr: 'पेंटर (Painter)',
    exampleBusinessesEn: 'Paint Shops, Waterproofing, Putty, Brushes & Coating Brands',
    exampleBusinessesMr: 'पेंट दुकाने, वॉटरप्रूफिंग, पुट्टी व रंगकाम साहित्य',
    aliases: ['painter', 'painters', 'painting', 'waterproofing'],
  },
  {
    id: 'mechanic',
    labelEn: 'Mechanic & Technician',
    labelHi: 'मैकेनिक / तकनीशियन (Mechanic)',
    labelMr: 'मेकॅनिक / तंत्रज्ञ (Mechanic)',
    exampleBusinessesEn: 'Auto Spare Parts, Tyres, Batteries, Garage Tools & Lubricants',
    exampleBusinessesMr: 'ऑटो स्पेअर पार्ट्स, टायर्स, बॅटरी, गॅरेज टूल्स व ऑईल',
    aliases: ['mechanic', 'technicians and mechanics', 'auto', 'garage', 'two_wheeler', 'four_wheeler'],
  },
  {
    id: 'cleaner',
    labelEn: 'Cleaning & Housekeeping',
    labelHi: 'सफ़ाई एवं हाउसकीपिंग (Cleaning)',
    labelMr: 'स्वच्छता व हाऊसकीपिंग (Cleaning)',
    exampleBusinessesEn: 'Cleaning Chemicals, Pest Control, Water Tank Cleaning & Supplies',
    exampleBusinessesMr: 'स्वच्छता साहित्य, पेस्ट कंट्रोल व टाकी स्वच्छता सेवा',
    aliases: ['cleaner', 'housekeeping and cleaning staff', 'cleaning', 'pest control'],
  },
  {
    id: 'ac_repair',
    labelEn: 'AC & Cooling Service',
    labelHi: 'एसी रिपेयर व सर्विस (AC Repair)',
    labelMr: 'एसी दुरुस्ती व सर्व्हिस (AC Repair)',
    exampleBusinessesEn: 'AC Dealers, Spare Parts, Gas Refill & Cooling Appliances',
    exampleBusinessesMr: 'एसी विक्रेते, स्पेअर पार्ट्स व कूलिंग उपकरणे',
    aliases: ['ac_repair', 'ac repair', 'cooling', 'hvac'],
  },
  {
    id: 'appliance_repair',
    labelEn: 'Appliance Repair',
    labelHi: 'उपकरण रिपेयर (Appliance Repair)',
    labelMr: 'घरगुती उपकरणे दुरुस्ती (Appliance)',
    exampleBusinessesEn: 'Home Appliance Stores, Spare Parts, RO Water Purifiers & Electronics',
    exampleBusinessesMr: 'घरगुती उपकरण दुकाने, RO वॉटर प्युरिफायर व इलेक्ट्रॉनिक्स',
    aliases: ['appliance_repair', 'appliance repair', 'electronics', 'ro'],
  },
  {
    id: 'driver',
    labelEn: 'Driver & Transport',
    labelHi: 'ड्राइवर एवं परिवहन (Driver & Transport)',
    labelMr: 'ड्रायव्हर व वाहतूक (Driver & Transport)',
    exampleBusinessesEn: 'Transport Agencies, Fuel/Tyre Shops, Insurance & Vehicle Rentals',
    exampleBusinessesMr: 'ट्रान्सपोर्ट एजन्सी, टायर्स, वाहन विमा व भाड्याने वाहने',
    aliases: ['driver', 'drivers and delivery staff', 'bike_transport', 'transport', 'bike rider'],
  },
  {
    id: 'other_services',
    labelEn: 'General / Other Services',
    labelHi: 'अन्य स्थानीय सेवाएँ (Other Services)',
    labelMr: 'इतर स्थानिक सेवा (Other Services)',
    exampleBusinessesEn: 'Hardware, Welding, Tailoring, Security, Event & Local MSME Shops',
    exampleBusinessesMr: 'हार्डवेअर, वेल्डिंग, टेलरिंग, सुरक्षा व स्थानिक व्यवसाय',
    aliases: ['other_services', 'other', 'general', 'welders and fabricators', 'tailors and garment workers', 'security guards'],
  },
];

export const DEFAULT_REFERRAL_CONFIG: PlatformReferralConfig = {
  paidRegistrationEnabled: true,
  registrationFeeInr: 250,
  referralRewardInr: 50,
  holdingDays: 7,
  programNoticeEn:
    'One-time worker registration fee is ₹250 (includes Verified Worker ID, Digital ID Card & Registration Certificate). Earn ₹50 single-level referral reward for each directly referred worker whose ₹250 payment & mobile OTP are verified.',
  programNoticeHi:
    'एकमुश्त कामगार पंजीकरण शुल्क ₹250 है (सत्यापित कामगार आईडी, डिजिटल पहचान पत्र और पंजीकरण प्रमाण-पत्र सहित)। प्रत्येक सीधे रेफर किए गए सत्यापित कामगार पर ₹50 पुरस्कार पाएं।',
  programNoticeMr:
    'एकदाच कामगार नोंदणी शुल्क ₹250 आहे (सत्यापित कामगार आयडी, डिजिटल ओळखपत्र व नोंदणी प्रमाणपत्रासह). तुमच्या रेफरल कोडवरून ₹250 नोंदणी व OTP सत्यापित झाल्यावर थेट ₹50 बक्षीस मिळवा.',
  updatedByUid: 'system',
};

// ============================================================
// SAFE URL & CONTACT SANITIZERS
// ============================================================

export function sanitizeAdWebsiteUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeIndianPhoneDigits(raw?: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function buildCallHref(raw?: string): string | null {
  const d = normalizeIndianPhoneDigits(raw);
  if (d.length < 10) return null;
  return `tel:+91${d}`;
}

export function buildWhatsAppAdHref(raw?: string, adTitle?: string): string | null {
  const d = normalizeIndianPhoneDigits(raw);
  if (d.length < 10) return null;
  const msg = encodeURIComponent(
    `Hello, I saw your sponsored advertisement "${adTitle || 'Listing'}" on ROJGAR SETU and would like more details.`
  );
  return `https://wa.me/91${d}?text=${msg}`;
}

// ============================================================
// CATEGORY NORMALIZATION & STRICT MATCHING ENGINE
// ============================================================

export function normalizeAdCategoryKey(raw: string): string {
  const clean = (raw || '').trim().toLowerCase().replace(/^custom_/, '');
  if (!clean) return '';
  const slugified = clean
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  for (const opt of DEFAULT_AD_TARGET_CATEGORIES) {
    if (
      opt.id === clean ||
      opt.id === slugified ||
      opt.aliases.includes(clean) ||
      opt.aliases.includes(slugified)
    ) {
      return opt.id;
    }
  }
  return slugified || clean;
}

export function getTodayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIsoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, days));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isAdvertisementCurrentlyLive(ad: AdvertisementRecord, todayIso = getTodayIsoDate()): boolean {
  if (ad.status !== 'active') return false;
  if (ad.startDate && todayIso < ad.startDate) return false;
  if (ad.endDate && todayIso > ad.endDate) return false;
  if (ad.totalImpressionLimit > 0 && ad.impressionsCount >= ad.totalImpressionLimit) return false;
  return true;
}

export interface AdMatchContext {
  category?: string; // Empty or 'all' for homepage
  state?: string;
  district?: string;
  city?: string;
  customCategories?: AdvertisementCategory[];
}

/**
 * Strictly matches ONLY active, non-expired, within-limit advertisements relevant to the selected category and location.
 * Never returns unrelated category ads when a specific category is selected.
 */
export function getMatchingActiveAds(
  ads: AdvertisementRecord[],
  ctx: AdMatchContext
): AdvertisementRecord[] {
  const todayIso = getTodayIsoDate();
  const requestedNorm = ctx.category && ctx.category !== 'all' ? normalizeAdCategoryKey(ctx.category) : '';

  // Also map any custom admin AdvertisementCategory linked to the requested service category
  const matchingCustomSlugs = new Set<string>();
  if (requestedNorm && ctx.customCategories) {
    for (const c of ctx.customCategories) {
      if (!c.active) continue;
      const linkedNorms = (c.linkedServiceCategories || []).map(normalizeAdCategoryKey);
      if (linkedNorms.includes(requestedNorm) || c.slug.toLowerCase() === requestedNorm) {
        matchingCustomSlugs.add(c.slug.toLowerCase());
      }
    }
  }

  const reqState = (ctx.state || '').trim().toLowerCase();
  const reqDistrict = (ctx.district || '').trim().toLowerCase();
  const reqCity = (ctx.city || '').trim().toLowerCase();

  const scored: Array<{ ad: AdvertisementRecord; score: number }> = [];

  for (const ad of ads) {
    if (!isAdvertisementCurrentlyLive(ad, todayIso)) continue;

    // 1. Strict Category Check
    if (requestedNorm) {
      const adNorms = (ad.targetCategories || []).map(normalizeAdCategoryKey);
      const rawLower = (ad.targetCategories || []).map((c) => c.trim().toLowerCase());
      const matchesCat =
        adNorms.includes(requestedNorm) ||
        rawLower.some((r) => matchingCustomSlugs.has(r));
      if (!matchesCat) continue;
    }

    // 2. Location Targeting Check (never exposes private customer location to advertisers)
    let locScore = 0;
    if (ad.allLocations) {
      locScore = 1;
    } else {
      const states = (ad.targetStates || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const districts = (ad.targetDistricts || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const cities = (ad.targetCities || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const areas = (ad.targetAreas || []).map((s) => s.trim().toLowerCase()).filter(Boolean);

      const hasAnyLocationFilter =
        states.length > 0 || districts.length > 0 || cities.length > 0 || areas.length > 0;

      if (!hasAnyLocationFilter) {
        locScore = 1;
      } else {
        const cityHit = reqCity && (cities.some((c) => reqCity.includes(c) || c.includes(reqCity)) || areas.some((a) => reqCity.includes(a) || a.includes(reqCity)));
        const districtHit = reqDistrict && districts.some((d) => reqDistrict.includes(d) || d.includes(reqDistrict));
        const stateHit = reqState && states.some((s) => reqState.includes(s) || s.includes(reqState));

        if (cityHit) locScore = 4;
        else if (districtHit) locScore = 3;
        else if (stateHit && districts.length === 0 && cities.length === 0) locScore = 2;
        else if (!reqState && !reqDistrict && !reqCity) locScore = 1;
        else continue; // Ad targets a different location
      }
    }

    const totalScore = (ad.priority || 5) * 10 + locScore;
    scored.push({ ad, score: totalScore });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.ad);
}

// ============================================================
// ANONYMOUS AD ANALYTICS (ZERO CUSTOMER PII)
// ============================================================

const SESSION_HASH_KEY = 'rs_ad_anon_session_v1';
const viewedInMemory = new Set<string>();

export function getAnonymousAdSessionHash(): string {
  if (typeof window === 'undefined') return 'ssr_session_01';
  try {
    let existing = window.sessionStorage.getItem(SESSION_HASH_KEY);
    if (!existing || existing.length < 8) {
      existing = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_HASH_KEY, existing);
    }
    return existing.slice(0, 60);
  } catch {
    return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export async function recordAdvertisementImpression(params: {
  ad: AdvertisementRecord;
  category: string;
  state?: string;
  district?: string;
  placement: AdvertisementPlacement;
}): Promise<boolean> {
  const sessionHash = getAnonymousAdSessionHash();
  const dedupeKey = `${sessionHash}:${params.ad.id}:${params.placement}`;
  if (viewedInMemory.has(dedupeKey)) return false;
  viewedInMemory.add(dedupeKey);

  const safeCategory = (params.category || 'homepage').slice(0, 80);
  const safeState = (params.state || 'All').slice(0, 80);
  const safeDistrict = (params.district || 'All').slice(0, 80);

  // Server-side bot & dedupe validation
  try {
    const resp = await fetch('/api/ads/validate-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'impression',
        adId: params.ad.id,
        advertiserUid: params.ad.ownerUid,
        category: safeCategory,
        state: safeState,
        district: safeDistrict,
        placement: params.placement,
        sessionHash,
      }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { allowed?: boolean };
      if (data.allowed === false) return false;
    }
  } catch {
    // Non-blocking fallback
  }

  try {
    const impId = `imp_${params.ad.id.slice(0, 24)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'advertisementImpressions', impId), {
      adId: params.ad.id,
      advertiserUid: params.ad.ownerUid,
      category: safeCategory,
      state: safeState,
      district: safeDistrict,
      placement: params.placement,
      sessionHash,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'advertisements', params.ad.id), {
      impressionsCount: increment(1),
      uniqueViewsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return true;
  } catch {
    return false;
  }
}

export async function recordAdvertisementClick(params: {
  ad: AdvertisementRecord;
  category: string;
  state?: string;
  district?: string;
  placement: AdvertisementPlacement;
  actionType: AdvertisementActionType;
}): Promise<boolean> {
  const sessionHash = getAnonymousAdSessionHash();
  const safeCategory = (params.category || 'homepage').slice(0, 80);
  const safeState = (params.state || 'All').slice(0, 80);
  const safeDistrict = (params.district || 'All').slice(0, 80);

  try {
    const resp = await fetch('/api/ads/validate-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'click',
        adId: params.ad.id,
        advertiserUid: params.ad.ownerUid,
        category: safeCategory,
        state: safeState,
        district: safeDistrict,
        placement: params.placement,
        actionType: params.actionType,
        sessionHash,
      }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { allowed?: boolean };
      if (data.allowed === false) return false;
    }
  } catch {
    // Non-blocking fallback
  }

  try {
    const clickId = `clk_${params.ad.id.slice(0, 24)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const counterPatch: Record<string, unknown> = {
      clicksCount: increment(1),
      updatedAt: serverTimestamp(),
    };
    if (params.actionType === 'call') counterPatch.callClicksCount = increment(1);
    if (params.actionType === 'whatsapp') counterPatch.whatsappClicksCount = increment(1);
    if (params.actionType === 'website') counterPatch.websiteClicksCount = increment(1);

    const batch = writeBatch(db);
    batch.set(doc(db, 'advertisementClicks', clickId), {
      adId: params.ad.id,
      advertiserUid: params.ad.ownerUid,
      category: safeCategory,
      state: safeState,
      district: safeDistrict,
      placement: params.placement,
      actionType: params.actionType,
      sessionHash,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'advertisements', params.ad.id), counterPatch);
    await batch.commit();
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// ADVERTISEMENT & ADVERTISER FIRESTORE SUBSCRIPTIONS & CRUD
// ============================================================

export function subscribeActiveAdvertisements(cb: (ads: AdvertisementRecord[]) => void): () => void {
  const q = query(collection(db, 'advertisements'), where('status', '==', 'active'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementRecord));
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeAllAdvertisementsAdmin(cb: (ads: AdvertisementRecord[]) => void): () => void {
  const q = query(collection(db, 'advertisements'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementRecord));
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeOwnerAdvertisements(
  ownerUid: string,
  cb: (ads: AdvertisementRecord[]) => void
): () => void {
  const q = query(collection(db, 'advertisements'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementRecord));
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeAdvertiserProfile(
  ownerUid: string,
  cb: (profile: AdvertiserProfile | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'advertisers', ownerUid),
    (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as AdvertiserProfile) : null);
    },
    () => cb(null)
  );
}

export function subscribeAllAdvertisersAdmin(cb: (list: AdvertiserProfile[]) => void): () => void {
  const q = query(collection(db, 'advertisers'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertiserProfile)));
    },
    () => cb([])
  );
}

export function subscribeAdvertisementCategories(cb: (list: AdvertisementCategory[]) => void): () => void {
  const q = query(collection(db, 'advertisementCategories'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementCategory)));
    },
    () => cb([])
  );
}

export function subscribeAdAnalyticsAdmin(
  cbImpressions: (list: AdvertisementImpression[]) => void,
  cbClicks: (list: AdvertisementClick[]) => void
): () => void {
  const u1 = onSnapshot(
    query(collection(db, 'advertisementImpressions'), orderBy('createdAt', 'desc')),
    (snap) => cbImpressions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementImpression))),
    () => cbImpressions([])
  );
  const u2 = onSnapshot(
    query(collection(db, 'advertisementClicks'), orderBy('createdAt', 'desc')),
    (snap) => cbClicks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvertisementClick))),
    () => cbClicks([])
  );
  return () => {
    u1();
    u2();
  };
}

export async function saveAdvertiserProfile(
  uid: string,
  isUpdate: boolean,
  data: Omit<AdvertiserProfile, 'id' | 'ownerUid' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const refDoc = doc(db, 'advertisers', uid);
  const cleanPayload: Record<string, unknown> = {
    businessName: data.businessName.trim().slice(0, 160),
    contactPerson: data.contactPerson.trim().slice(0, 120),
    mobile: data.mobile.trim().slice(0, 20),
    businessAddress: data.businessAddress.trim().slice(0, 300),
    state: data.state.trim().slice(0, 80),
    district: data.district.trim().slice(0, 80),
    city: data.city.trim().slice(0, 100),
    businessCategory: data.businessCategory.trim().slice(0, 80),
    updatedAt: serverTimestamp(),
  };
  if (data.whatsappNumber?.trim()) cleanPayload.whatsappNumber = data.whatsappNumber.trim().slice(0, 20);
  if (data.email?.trim()) cleanPayload.email = data.email.trim().slice(0, 200);
  const safeSite = sanitizeAdWebsiteUrl(data.websiteUrl);
  if (safeSite) cleanPayload.websiteUrl = safeSite.slice(0, 300);

  if (isUpdate) {
    await updateDoc(refDoc, cleanPayload);
  } else {
    await setDoc(refDoc, {
      ...cleanPayload,
      ownerUid: uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
}

export async function submitAdvertisementForApproval(params: {
  ownerUid: string;
  advertiserId?: string;
  advertiserName: string;
  title: string;
  description: string;
  bannerImageUrl: string;
  targetCategories: string[];
  targetStates: string[];
  targetDistricts: string[];
  targetCities: string[];
  targetAreas?: string[];
  allLocations: boolean;
  contactAction: AdvertisementActionType;
  callNumber?: string;
  whatsappNumber?: string;
  websiteUrl?: string;
  ctaLabel?: string;
  startDate: string;
  endDate: string;
  preferredDurationDays?: number;
  status?: AdvertisementStatus;
  priority?: number;
  dailyImpressionLimit?: number;
  totalImpressionLimit?: number;
  budgetInr?: number;
  adminNotes?: string;
  createdByAdmin: boolean;
  approvedByUid?: string;
}): Promise<string> {
  const adId = `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safeSite = sanitizeAdWebsiteUrl(params.websiteUrl);
  const cats = Array.from(new Set(params.targetCategories.map((c) => c.trim()).filter(Boolean))).slice(0, 15);
  if (cats.length === 0) throw new Error('Select at least one target service category.');

  const payload: Record<string, unknown> = {
    ownerUid: params.ownerUid,
    advertiserName: params.advertiserName.trim().slice(0, 160),
    title: params.title.trim().slice(0, 140),
    description: params.description.trim().slice(0, 400),
    bannerImageUrl: params.bannerImageUrl.trim(),
    targetCategories: cats,
    targetStates: (params.targetStates || []).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    targetDistricts: (params.targetDistricts || []).map((s) => s.trim()).filter(Boolean).slice(0, 30),
    targetCities: (params.targetCities || []).map((s) => s.trim()).filter(Boolean).slice(0, 30),
    allLocations: Boolean(params.allLocations),
    contactAction: params.contactAction,
    startDate: params.startDate || getTodayIsoDate(),
    endDate: params.endDate || addDaysIsoDate(params.preferredDurationDays || 30),
    status: params.createdByAdmin ? params.status || 'active' : 'pending',
    priority: params.createdByAdmin ? Math.min(10, Math.max(1, Number(params.priority) || 5)) : 5,
    dailyImpressionLimit: Math.max(0, Number(params.dailyImpressionLimit) || 0),
    totalImpressionLimit: Math.max(0, Number(params.totalImpressionLimit) || 0),
    createdByAdmin: params.createdByAdmin,
    impressionsCount: 0,
    uniqueViewsCount: 0,
    clicksCount: 0,
    callClicksCount: 0,
    whatsappClicksCount: 0,
    websiteClicksCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.advertiserId) payload.advertiserId = params.advertiserId;
  if (params.targetAreas && params.targetAreas.length > 0) {
    payload.targetAreas = params.targetAreas.map((s) => s.trim()).filter(Boolean).slice(0, 30);
  }
  if (params.callNumber?.trim()) payload.callNumber = params.callNumber.trim().slice(0, 20);
  if (params.whatsappNumber?.trim()) payload.whatsappNumber = params.whatsappNumber.trim().slice(0, 20);
  if (safeSite) payload.websiteUrl = safeSite.slice(0, 300);
  if (params.ctaLabel?.trim()) payload.ctaLabel = params.ctaLabel.trim().slice(0, 40);
  if (params.preferredDurationDays && params.preferredDurationDays >= 1) {
    payload.preferredDurationDays = Math.min(730, Math.round(params.preferredDurationDays));
  }
  if (params.createdByAdmin && typeof params.budgetInr === 'number' && params.budgetInr >= 0) {
    payload.budgetInr = params.budgetInr;
  }
  if (params.createdByAdmin && params.adminNotes?.trim()) {
    payload.adminNotes = params.adminNotes.trim().slice(0, 500);
  }
  if (params.createdByAdmin && params.approvedByUid) {
    payload.approvedByUid = params.approvedByUid;
  }

  await setDoc(doc(db, 'advertisements', adId), payload);

  // Also record a campaign doc when admin sets a budget
  if (params.createdByAdmin && params.approvedByUid) {
    const campId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await setDoc(doc(db, 'advertisementCampaigns', campId), {
      advertiserUid: params.ownerUid,
      advertisementId: adId,
      campaignName: `${params.advertiserName.trim()} — ${params.title.trim()}`.slice(0, 160),
      budgetInr: Math.max(0, Number(params.budgetInr) || 0),
      paymentStatus: (Number(params.budgetInr) || 0) > 0 ? 'unpaid' : 'waived',
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status === 'active' ? 'running' : 'scheduled',
      createdByUid: params.approvedByUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }

  return adId;
}

export async function adminUpdateAdvertiserStatus(params: {
  advertiserId: string;
  status: AdvertiserApprovalStatus;
  adminUid: string;
  adminEmail: string;
  adminNotes?: string;
}): Promise<void> {
  await updateDoc(doc(db, 'advertisers', params.advertiserId), {
    status: params.status,
    reviewedByUid: params.adminUid,
    ...(params.adminNotes !== undefined ? { adminNotes: params.adminNotes.slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    `advertiser_${params.status}`,
    'advertisers',
    params.advertiserId,
    params.adminNotes || `Updated advertiser status to ${params.status}`
  );
}

export async function adminUpdateAdvertisement(params: {
  adId: string;
  patch: Partial<
    Pick<
      AdvertisementRecord,
      | 'title'
      | 'description'
      | 'advertiserName'
      | 'bannerImageUrl'
      | 'targetCategories'
      | 'targetStates'
      | 'targetDistricts'
      | 'targetCities'
      | 'allLocations'
      | 'contactAction'
      | 'callNumber'
      | 'whatsappNumber'
      | 'websiteUrl'
      | 'ctaLabel'
      | 'startDate'
      | 'endDate'
      | 'status'
      | 'priority'
      | 'dailyImpressionLimit'
      | 'totalImpressionLimit'
      | 'budgetInr'
      | 'adminNotes'
    >
  >;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const cleanPatch: Record<string, unknown> = {
    ...params.patch,
    updatedAt: serverTimestamp(),
  };
  if (params.patch.status === 'approved' || params.patch.status === 'active') {
    cleanPatch.approvedByUid = params.adminUid;
  }
  await updateDoc(doc(db, 'advertisements', params.adId), cleanPatch);
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    `ad_update_${params.patch.status || 'edit'}`,
    'advertisements',
    params.adId,
    `Updated ad (${Object.keys(params.patch).join(', ')})`
  );
}

export async function adminDeleteAdvertisement(
  adId: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  await deleteDoc(doc(db, 'advertisements', adId));
  await writeAdminAuditLog(adminUid, adminEmail, 'ad_deleted', 'advertisements', adId, 'Deleted advertisement');
}

export async function adminCreateAdvertisementCategory(params: {
  nameEn: string;
  nameHi?: string;
  nameMr?: string;
  linkedServiceCategories: string[];
  adminUid: string;
  adminEmail: string;
}): Promise<string> {
  const slug = params.nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  if (slug.length < 2) throw new Error('Category name must have at least 2 alphanumeric characters.');
  const linked = params.linkedServiceCategories.filter(Boolean).slice(0, 15);
  if (linked.length === 0) throw new Error('Select at least one linked Rojgar Setu service category.');

  await setDoc(doc(db, 'advertisementCategories', slug), {
    slug,
    nameEn: params.nameEn.trim().slice(0, 100),
    ...(params.nameHi?.trim() ? { nameHi: params.nameHi.trim().slice(0, 100) } : {}),
    ...(params.nameMr?.trim() ? { nameMr: params.nameMr.trim().slice(0, 100) } : {}),
    linkedServiceCategories: linked,
    active: true,
    createdByUid: params.adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    'ad_category_created',
    'advertisementCategories',
    slug,
    `Created custom ad category ${params.nameEn}`
  );
  return slug;
}

// ============================================================
// WORKER REFERRAL & FUTURE-READY REWARD ENGINE
// ============================================================

const REFERRAL_SESSION_STORAGE_KEY = 'rs_captured_referral_code_v1';

export function captureReferralCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const refParam = (params.get('ref') || params.get('referral') || '').trim().toUpperCase();
    if (refParam && /^[A-Z0-9_-]{4,32}$/.test(refParam)) {
      window.sessionStorage.setItem(REFERRAL_SESSION_STORAGE_KEY, refParam);
      return refParam;
    }
    return window.sessionStorage.getItem(REFERRAL_SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function clearCapturedReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(REFERRAL_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildWorkerReferralLink(referralCode: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://rojgarsetu.in';
  return `${origin}/?route=register-worker&ref=${encodeURIComponent(referralCode.toUpperCase())}`;
}

export function buildReferralShareMessage(referralCode: string, lang: Language): string {
  const link = buildWorkerReferralLink(referralCode);
  if (lang === 'mr') {
    return `नमस्कार! "कामगार नाही, आपलीच माणसं!" रोजगार सेतूवर ₹250 एकदाच शुल्कात अधिकृत डिजिटल कामगार ओळखपत्र आणि नोंदणी प्रमाणपत्र मिळवा. माझ्या रेफरल कोड (${referralCode.toUpperCase()}) वरून नोंदणी करा: ${link}`;
  }
  if (lang === 'hi') {
    return `नमस्कार! "कामगार नाही, आपलीच माणसं!" रोजगार सेतु पर ₹250 एकमुश्त पंजीकरण के साथ अपना सत्यापित कामगार आईडी कार्ड और प्रमाण-पत्र प्राप्त करें। मेरे रेफरल कोड (${referralCode.toUpperCase()}) से जुड़ें: ${link}`;
  }
  return `Hello! "कामगार नाही, आपलीच माणसं!" Join ROJGAR SETU with one-time ₹250 registration to receive your Verified Digital Worker ID Card & Official Registration Certificate. Register using my referral code (${referralCode.toUpperCase()}): ${link}`;
}

export function buildReferralWhatsAppShareUrl(referralCode: string, lang: Language): string {
  const text = buildReferralShareMessage(referralCode, lang);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function hashMobileForReferralFraudCheck(mobile: string): Promise<string> {
  const normalized = normalizeIndianPhoneDigits(mobile);
  const input = `RS_REF_MOBILE_V1:${normalized}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash if SubtleCrypto is unavailable
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fb_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function generateCandidateReferralCode(workerName: string, uid: string, attempt: number): string {
  const firstWord = (workerName || 'WORKER')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 8);
  const prefix = firstWord.length >= 3 ? firstWord : 'RSWORK';
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  const seed = `${uid}_${Date.now()}_${attempt}_${Math.random()}`;
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * alphabet.length);
    suffix += alphabet[(idx + seed.charCodeAt(i % seed.length)) % alphabet.length];
  }
  return `${prefix}-${suffix}`;
}

export async function lookupReferralCode(code: string): Promise<ReferralCodeIndexRecord | null> {
  const normalized = (code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(normalized)) return null;
  try {
    const snap = await getDoc(doc(db, 'referralCodeIndex', normalized));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ReferralCodeIndexRecord;
  } catch {
    return null;
  }
}

/**
 * Guarantees every registered worker (new or existing) has a unique non-guessable referral code
 * indexed in `referralCodeIndex/{code}`, saved on `publicWorkers/{uid}`, and paired with a `referralWallets/{uid}` doc.
 */
export async function ensureWorkerReferralCode(
  workerProfile: PublicWorkerProfile,
  workerPrivate?: WorkerPrivateInfo | null
): Promise<string> {
  if (workerProfile.referralCode && /^[A-Z0-9_-]{4,32}$/.test(workerProfile.referralCode)) {
    // Ensure index & wallet exist (idempotent)
    const idxRef = doc(db, 'referralCodeIndex', workerProfile.referralCode);
    const idxSnap = await getDoc(idxRef).catch(() => null);
    if (idxSnap && !idxSnap.exists()) {
      await setDoc(idxRef, {
        referralCode: workerProfile.referralCode,
        ownerUid: workerProfile.ownerUid,
        workerName: workerProfile.displayName.slice(0, 120),
        registrationId: workerProfile.registrationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    const walletRef = doc(db, 'referralWallets', workerProfile.ownerUid);
    const walletSnap = await getDoc(walletRef).catch(() => null);
    if (walletSnap && !walletSnap.exists()) {
      await setDoc(walletRef, {
        ownerUid: workerProfile.ownerUid,
        referralCode: workerProfile.referralCode,
        totalReferrals: 0,
        verifiedPaidReferrals: 0,
        pendingBalanceInr: 0,
        approvedBalanceInr: 0,
        paidBalanceInr: 0,
        totalEarnedInr: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    return workerProfile.referralCode;
  }

  let chosenCode = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateCandidateReferralCode(workerProfile.displayName, workerProfile.ownerUid, attempt);
    const snap = await getDoc(doc(db, 'referralCodeIndex', candidate)).catch(() => null);
    if (!snap || !snap.exists()) {
      chosenCode = candidate;
      break;
    }
  }
  if (!chosenCode) {
    chosenCode = `RS-${workerProfile.ownerUid.slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  await setDoc(doc(db, 'referralCodeIndex', chosenCode), {
    referralCode: chosenCode,
    ownerUid: workerProfile.ownerUid,
    workerName: workerProfile.displayName.slice(0, 120),
    registrationId: workerProfile.registrationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'publicWorkers', workerProfile.ownerUid), {
    referralCode: chosenCode,
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  if (workerPrivate) {
    await updateDoc(doc(db, 'workerPrivate', workerProfile.ownerUid), {
      referralCode: chosenCode,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }

  const walletRef = doc(db, 'referralWallets', workerProfile.ownerUid);
  const walletSnap = await getDoc(walletRef).catch(() => null);
  if (!walletSnap || !walletSnap.exists()) {
    await setDoc(walletRef, {
      ownerUid: workerProfile.ownerUid,
      referralCode: chosenCode,
      totalReferrals: 0,
      verifiedPaidReferrals: 0,
      pendingBalanceInr: 0,
      approvedBalanceInr: 0,
      paidBalanceInr: 0,
      totalEarnedInr: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }

  return chosenCode;
}

/**
 * Records a locked one-time referral attribution when a new worker completes registration.
 * Strictly blocks self-referrals, never changes an existing referral owner, and awards ₹0 during Free Launch.
 */
export async function recordWorkerReferralAttribution(params: {
  referralCode: string;
  sourceChannel: 'url_link' | 'manual_code';
  referredUid: string;
  referredWorkerName: string;
  referredRegistrationId: string;
  referredMobile: string;
}): Promise<{ recorded: boolean; referrerName?: string; reason?: string }> {
  const code = (params.referralCode || '').trim().toUpperCase();
  if (!code) return { recorded: false, reason: 'No referral code provided.' };

  const existingRefSnap = await getDoc(doc(db, 'workerReferrals', params.referredUid)).catch(() => null);
  if (existingRefSnap?.exists()) {
    return { recorded: false, reason: 'Referral owner is already locked for this account.' };
  }

  const codeRecord = await lookupReferralCode(code);
  if (!codeRecord) {
    return { recorded: false, reason: 'Referral code not found.' };
  }
  if (codeRecord.ownerUid === params.referredUid) {
    return { recorded: false, reason: 'Self-referral is not allowed.' };
  }

  const mobileHash = await hashMobileForReferralFraudCheck(params.referredMobile);

  await setDoc(doc(db, 'workerReferrals', params.referredUid), {
    referrerUid: codeRecord.ownerUid,
    referrerName: codeRecord.workerName.slice(0, 120),
    referralCode: codeRecord.referralCode,
    referredUid: params.referredUid,
    referredWorkerName: params.referredWorkerName.trim().slice(0, 120),
    referredRegistrationId: params.referredRegistrationId.slice(0, 40),
    referredMobileHash: mobileHash,
    sourceChannel: params.sourceChannel,
    registrationPaymentStatus: 'payment_pending',
    registrationFeePaidInr: 0,
    rewardStatus: 'pending_verification',
    rewardAmountInr: 0,
    otpVerified: true,
    singleLevelVerified: true,
    locked: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  clearCapturedReferralCode();
  return { recorded: true, referrerName: codeRecord.workerName };
}

// ============================================================
// REFERRAL SUBSCRIPTIONS & ADMIN PAYOUT/SIMULATION WORKFLOWS
// ============================================================

export function subscribeReferralConfig(cb: (cfg: PlatformReferralConfig) => void): () => void {
  return onSnapshot(
    doc(db, 'platform_settings', 'referral_config'),
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_REFERRAL_CONFIG, ...(snap.data() as Partial<PlatformReferralConfig>) });
      } else {
        cb(DEFAULT_REFERRAL_CONFIG);
      }
    },
    () => cb(DEFAULT_REFERRAL_CONFIG)
  );
}

export async function adminSaveReferralConfig(
  cfg: Pick<PlatformReferralConfig, 'paidRegistrationEnabled' | 'registrationFeeInr' | 'referralRewardInr' | 'holdingDays'>,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const refDoc = doc(db, 'platform_settings', 'referral_config');
  const snap = await getDoc(refDoc);
  const payload = {
    paidRegistrationEnabled: Boolean(cfg.paidRegistrationEnabled),
    registrationFeeInr: Math.max(0, Math.min(50000, Number(cfg.registrationFeeInr) || 250)),
    referralRewardInr: Math.max(0, Math.min(10000, Number(cfg.referralRewardInr) || 50)),
    holdingDays: Math.max(0, Math.min(90, Number(cfg.holdingDays) || 7)),
    programNoticeEn: DEFAULT_REFERRAL_CONFIG.programNoticeEn,
    programNoticeHi: DEFAULT_REFERRAL_CONFIG.programNoticeHi,
    programNoticeMr: DEFAULT_REFERRAL_CONFIG.programNoticeMr,
    updatedByUid: adminUid,
    updatedAt: serverTimestamp(),
  };
  if (snap.exists()) {
    await updateDoc(refDoc, payload);
  } else {
    await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
  }
  await writeAdminAuditLog(
    adminUid,
    adminEmail,
    'referral_config_updated',
    'platform_settings',
    'referral_config',
    `paidRegistrationEnabled=${payload.paidRegistrationEnabled}, fee=₹${payload.registrationFeeInr}, reward=₹${payload.referralRewardInr}`
  );
}

export function subscribeWorkerReferralDashboard(
  workerUid: string,
  callbacks: {
    onReferrals: (list: WorkerReferralRecord[]) => void;
    onRewards: (list: ReferralRewardRecord[]) => void;
    onWallet: (wallet: ReferralWallet | null) => void;
    onPayouts: (list: ReferralPayoutRecord[]) => void;
  }
): () => void {
  const u1 = onSnapshot(
    query(collection(db, 'workerReferrals'), where('referrerUid', '==', workerUid)),
    (snap) => callbacks.onReferrals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkerReferralRecord))),
    () => callbacks.onReferrals([])
  );
  const u2 = onSnapshot(
    query(collection(db, 'referralRewards'), where('referrerUid', '==', workerUid)),
    (snap) => callbacks.onRewards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralRewardRecord))),
    () => callbacks.onRewards([])
  );
  const u3 = onSnapshot(
    doc(db, 'referralWallets', workerUid),
    (snap) => callbacks.onWallet(snap.exists() ? ({ id: snap.id, ...snap.data() } as ReferralWallet) : null),
    () => callbacks.onWallet(null)
  );
  const u4 = onSnapshot(
    query(collection(db, 'referralPayouts'), where('referrerUid', '==', workerUid)),
    (snap) => callbacks.onPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralPayoutRecord))),
    () => callbacks.onPayouts([])
  );
  return () => {
    u1();
    u2();
    u3();
    u4();
  };
}

export function subscribeAdminReferralsData(callbacks: {
  onReferrals: (list: WorkerReferralRecord[]) => void;
  onRewards: (list: ReferralRewardRecord[]) => void;
  onPayouts: (list: ReferralPayoutRecord[]) => void;
}): () => void {
  const u1 = onSnapshot(
    query(collection(db, 'workerReferrals'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onReferrals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkerReferralRecord))),
    () => callbacks.onReferrals([])
  );
  const u2 = onSnapshot(
    query(collection(db, 'referralRewards'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onRewards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralRewardRecord))),
    () => callbacks.onRewards([])
  );
  const u3 = onSnapshot(
    query(collection(db, 'referralPayouts'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralPayoutRecord))),
    () => callbacks.onPayouts([])
  );
  return () => {
    u1();
    u2();
    u3();
  };
}

export async function callServerReferralEligibilityCheck(payload: {
  referrerUid: string;
  referredUid: string;
  referrerMobileHash?: string;
  referredMobileHash: string;
  existingReferredMobileHashes: string[];
  existingRewardReferralIds: string[];
  referralId: string;
  registrationPaymentStatus: WorkerReferralRecord['registrationPaymentStatus'];
  registrationFeePaidInr: number;
  paymentReference?: string;
  paidRegistrationEnabled: boolean;
  configuredFeeInr: number;
  configuredRewardInr: number;
  otpVerified?: boolean;
  referralLevel?: number;
  testSimulation?: boolean;
}): Promise<{
  eligible: boolean;
  rewardAmountInr: number;
  rewardStatus: 'free_not_eligible' | 'pending_verification' | 'rejected';
  fraudFlags: string[];
  reason: string;
  auditHash: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required.');
  const resp = await fetch('/api/referrals/evaluate-eligibility', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error((data as { error?: string }).error || 'Server eligibility check failed.');
  }
  return data;
}

async function recomputeAndSaveReferrerWallet(referrerUid: string, referralCode: string): Promise<void> {
  const [refsSnap, rewardsSnap] = await Promise.all([
    getDocs(query(collection(db, 'workerReferrals'), where('referrerUid', '==', referrerUid))),
    getDocs(query(collection(db, 'referralRewards'), where('referrerUid', '==', referrerUid))),
  ]);

  let verifiedPaidReferrals = 0;
  refsSnap.docs.forEach((d) => {
    const r = d.data() as WorkerReferralRecord;
    if (r.registrationPaymentStatus === 'paid_verified') verifiedPaidReferrals += 1;
  });

  let pendingBalanceInr = 0;
  let approvedBalanceInr = 0;
  let paidBalanceInr = 0;
  rewardsSnap.docs.forEach((d) => {
    const rw = d.data() as ReferralRewardRecord;
    if (rw.status === 'pending') pendingBalanceInr += rw.rewardAmountInr;
    if (rw.status === 'approved') approvedBalanceInr += rw.rewardAmountInr;
    if (rw.status === 'paid') paidBalanceInr += rw.rewardAmountInr;
  });

  const walletRef = doc(db, 'referralWallets', referrerUid);
  const existing = await getDoc(walletRef);
  const payload = {
    ownerUid: referrerUid,
    referralCode: referralCode || existing.data()?.referralCode || 'RS-CODE',
    totalReferrals: refsSnap.size,
    verifiedPaidReferrals,
    pendingBalanceInr,
    approvedBalanceInr,
    paidBalanceInr,
    totalEarnedInr: pendingBalanceInr + approvedBalanceInr + paidBalanceInr,
    updatedAt: serverTimestamp(),
  };
  if (existing.exists()) {
    await updateDoc(walletRef, payload);
  } else {
    await setDoc(walletRef, { ...payload, createdAt: serverTimestamp() });
  }
}

export async function adminVerifyPaidReferralAndCreateReward(params: {
  referral: WorkerReferralRecord;
  paymentReference: string;
  feePaidInr: number;
  config: PlatformReferralConfig;
  allReferrals: WorkerReferralRecord[];
  allRewards: ReferralRewardRecord[];
  adminUid: string;
  adminEmail: string;
  isSimulation?: boolean;
}): Promise<{ eligible: boolean; rewardAmountInr: number; reason: string; fraudFlags: string[] }> {
  const otherMobileHashes = params.allReferrals
    .filter((r) => r.id !== params.referral.id && r.referredMobileHash)
    .map((r) => r.referredMobileHash);
  const existingRewardReferralIds = params.allRewards.map((rw) => rw.referralId);

  const decision = await callServerReferralEligibilityCheck({
    referrerUid: params.referral.referrerUid,
    referredUid: params.referral.referredUid,
    referredMobileHash: params.referral.referredMobileHash,
    existingReferredMobileHashes: otherMobileHashes,
    existingRewardReferralIds,
    referralId: params.referral.id,
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: params.feePaidInr,
    paymentReference: params.paymentReference,
    paidRegistrationEnabled: params.config.paidRegistrationEnabled,
    configuredFeeInr: params.config.registrationFeeInr,
    configuredRewardInr: params.config.referralRewardInr,
    testSimulation: Boolean(params.isSimulation),
  });

  if (!decision.eligible) {
    await updateDoc(doc(db, 'workerReferrals', params.referral.id), {
      rewardStatus: decision.rewardStatus,
      fraudFlags: decision.fraudFlags,
      adminNotes: decision.reason.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    return decision;
  }

  const rewardId = `rw_${params.referral.id}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'workerReferrals', params.referral.id), {
    registrationPaymentStatus: 'paid_verified',
    registrationFeePaidInr: params.feePaidInr,
    paymentReference: params.paymentReference.trim().slice(0, 120),
    rewardStatus: 'pending_verification',
    rewardAmountInr: decision.rewardAmountInr,
    adminNotes: decision.reason.slice(0, 500),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'referralRewards', rewardId), {
    referralId: params.referral.id,
    referrerUid: params.referral.referrerUid,
    referrerName: params.referral.referrerName,
    referredUid: params.referral.referredUid,
    referredWorkerName: params.referral.referredWorkerName,
    referralCode: params.referral.referralCode,
    registrationFeeInr: params.feePaidInr,
    rewardAmountInr: decision.rewardAmountInr,
    status: 'pending',
    eligibilityReason: decision.reason.slice(0, 300),
    paymentReference: params.paymentReference.trim().slice(0, 120),
    reviewedByUid: params.adminUid,
    ...(params.isSimulation ? { isSimulation: true } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  await recomputeAndSaveReferrerWallet(params.referral.referrerUid, params.referral.referralCode);
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    params.isSimulation ? 'referral_reward_simulated' : 'referral_payment_verified',
    'referralRewards',
    rewardId,
    `₹${decision.rewardAmountInr} pending reward created for ${params.referral.referrerName}`
  );
  return decision;
}

export async function adminDecideReferralReward(params: {
  reward: ReferralRewardRecord;
  decision: 'approved' | 'rejected';
  adminUid: string;
  adminEmail: string;
  adminNotes?: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'referralRewards', params.reward.id), {
    status: params.decision,
    reviewedByUid: params.adminUid,
    ...(params.adminNotes ? { adminNotes: params.adminNotes.slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'workerReferrals', params.reward.referralId), {
    rewardStatus: params.decision,
    ...(params.adminNotes ? { adminNotes: params.adminNotes.slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  await recomputeAndSaveReferrerWallet(params.reward.referrerUid, params.reward.referralCode);
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    `referral_reward_${params.decision}`,
    'referralRewards',
    params.reward.id,
    `${params.decision} ₹${params.reward.rewardAmountInr} for ${params.reward.referrerName}`
  );
}

export async function adminRecordManualReferralPayout(params: {
  rewards: ReferralRewardRecord[];
  payoutMethod: ReferralPayoutRecord['payoutMethod'];
  transactionReference: string;
  notes?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<string> {
  if (params.rewards.length === 0) throw new Error('Select at least one approved reward to record payout.');
  const referrerUid = params.rewards[0].referrerUid;
  const referrerName = params.rewards[0].referrerName;
  const referralCode = params.rewards[0].referralCode;
  const totalAmount = params.rewards.reduce((sum, r) => sum + r.rewardAmountInr, 0);
  if (totalAmount <= 0) throw new Error('Payout amount must be greater than ₹0.');

  const payoutId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'referralPayouts', payoutId), {
    referrerUid,
    referrerName,
    rewardIds: params.rewards.map((r) => r.id).slice(0, 50),
    amountInr: totalAmount,
    payoutMethod: params.payoutMethod,
    transactionReference: params.transactionReference.trim().slice(0, 120),
    status: 'recorded_paid',
    ...(params.notes?.trim() ? { notes: params.notes.trim().slice(0, 500) } : {}),
    recordedByUid: params.adminUid,
    paidAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const rw of params.rewards) {
    batch.update(doc(db, 'referralRewards', rw.id), {
      status: 'paid',
      payoutId,
      reviewedByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'workerReferrals', rw.referralId), {
      rewardStatus: 'paid',
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  await recomputeAndSaveReferrerWallet(referrerUid, referralCode);
  await writeAdminAuditLog(
    params.adminUid,
    params.adminEmail,
    'referral_payout_recorded',
    'referralPayouts',
    payoutId,
    `Recorded manual payout ₹${totalAmount} (${params.payoutMethod} · ${params.transactionReference}) to ${referrerName}`
  );
  return payoutId;
}

async function writeAdminAuditLog(
  adminUid: string,
  adminEmail: string,
  action: string,
  targetCollection: string,
  targetId: string,
  details: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, 'auditLogs', logId), {
    adminUid,
    adminEmail,
    action: action.slice(0, 120),
    targetCollection: targetCollection.slice(0, 80),
    targetId: targetId.slice(0, 128),
    details: details.slice(0, 500),
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
}

export function exportReferralsToCsv(
  referrals: WorkerReferralRecord[],
  rewards: ReferralRewardRecord[]
): void {
  const rewardByRef = new Map<string, ReferralRewardRecord>();
  rewards.forEach((r) => rewardByRef.set(r.referralId, r));

  const headers = [
    'Referral ID',
    'Referrer Name',
    'Referral Code',
    'Referred Worker Name',
    'Referred Reg ID',
    'Source Channel',
    'Payment Status',
    'Fee Paid (INR)',
    'Reward Status',
    'Reward Amount (INR)',
    'Payment Ref',
    'Fraud Flags',
    'Simulation',
  ];

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = referrals.map((r) => {
    const rw = rewardByRef.get(r.id);
    return [
      r.id,
      r.referrerName,
      r.referralCode,
      r.referredWorkerName,
      r.referredRegistrationId,
      r.sourceChannel,
      r.registrationPaymentStatus,
      r.registrationFeePaidInr,
      rw?.status || r.rewardStatus,
      rw?.rewardAmountInr ?? r.rewardAmountInr,
      r.paymentReference || rw?.paymentReference || '',
      (r.fraudFlags || []).join('; '),
      r.isSimulation ? 'YES' : 'NO',
    ]
      .map(escapeCsv)
      .join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rojgar_setu_referrals_${getTodayIsoDate()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type { AdvertisementCampaign };
