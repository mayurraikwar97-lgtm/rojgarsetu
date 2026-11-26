import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { EMPLOYMENT_CATEGORIES } from '../data/categories';
import { SERVICE_CATALOG_V2, type ServiceCategoryV2 } from '../data/serviceCatalogV2';
import type {
  CustomProfessionGroup,
  CustomProfessionRecord,
  CustomProfessionStatus,
  Language,
  WageUnit,
} from '../types/domain';
import { db, handleFirestoreError, logFirestoreListenerError, OperationType } from './firebase';

export const OTHER_PROFESSION_OPTION_VALUE = '__OTHER_CUSTOM_PROFESSION__';

export interface SuggestedDynamicProfessionTemplate {
  nameEn: string;
  nameHi: string;
  nameMr: string;
  group: CustomProfessionGroup;
  keywords: string[];
  description: string;
}

export const SUGGESTED_DYNAMIC_PROFESSIONS: SuggestedDynamicProfessionTemplate[] = [
  {
    nameEn: 'CCTV Installer',
    nameHi: 'सीसीटीवी इंस्टॉलर',
    nameMr: 'सीसीटीव्ही इंस्टॉलर',
    group: 'industrial',
    keywords: ['CCTV', 'Security Camera', 'DVR Setup', 'Surveillance'],
    description: 'CCTV camera installation, DVR/NVR wiring, mobile viewing & maintenance.',
  },
  {
    nameEn: 'Photographer',
    nameHi: 'फोटोग्राफर',
    nameMr: 'फोटोग्राफर',
    group: 'enterprise',
    keywords: ['Wedding Photography', 'Event Shoot', 'Portrait', 'Candid'],
    description: 'Wedding, event, portrait, passport and commercial photography services.',
  },
  {
    nameEn: 'Video Editor',
    nameHi: 'वीडियो एडिटर',
    nameMr: 'व्हिडिओ एडिटर',
    group: 'office',
    keywords: ['Video Editing', 'Reels', 'Wedding Video', 'Color Grading'],
    description: 'Event highlights, promotional reels, wedding films and social video editing.',
  },
  {
    nameEn: 'Solar Panel Technician',
    nameHi: 'सोलर पैनल तकनीशियन',
    nameMr: 'सोलर पॅनेल तंत्रज्ञ',
    group: 'trades',
    keywords: ['Solar Rooftop', 'Inverter Setup', 'Solar Maintenance', 'Battery'],
    description: 'Rooftop solar panel installation, inverter wiring and system servicing.',
  },
  {
    nameEn: 'AC Repair Technician',
    nameHi: 'एसी रिपेयर तकनीशियन',
    nameMr: 'एसी दुरुस्ती तंत्रज्ञ',
    group: 'industrial',
    keywords: ['AC Service', 'Gas Refill', 'Split AC', 'Cooling Repair'],
    description: 'Split & window AC installation, servicing, gas refilling and fault repair.',
  },
  {
    nameEn: 'Artist & Sculptor',
    nameHi: 'कलाकार एवं मूर्तिकार',
    nameMr: 'कलाकार आणि मूर्तिकार',
    group: 'enterprise',
    keywords: ['Sculptor', 'Idol Making', 'Wall Art', 'Painting'],
    description: 'Custom murals, portraits, clay/stone sculpture, festival idols and signage.',
  },
  {
    nameEn: 'Tailor',
    nameHi: 'दर्ज़ी (टेलर)',
    nameMr: 'शिंपी (टेलर)',
    group: 'enterprise',
    keywords: ['Blouse Stitching', 'Suit Tailoring', 'Alteration', 'Dressmaking'],
    description: 'Custom garment stitching, blouse & kurta tailoring, alterations and repairs.',
  },
  {
    nameEn: 'Beauty Professional',
    nameHi: 'ब्यूटी प्रोफेशनल / ब्यूटीशियन',
    nameMr: 'ब्युटी प्रोफेशनल / ब्युटिशियन',
    group: 'services',
    keywords: ['Bridal Makeup', 'Hair Styling', 'Mehendi', 'Salon at Home'],
    description: 'Bridal makeup, mehendi, hair styling and home salon beauty services.',
  },
  {
    nameEn: 'Event Decorator',
    nameHi: 'इवेंट डेकोरेटर',
    nameMr: 'इव्हेंट डेकोरेटर',
    group: 'hospitality',
    keywords: ['Flower Decoration', 'Stage Setup', 'Mandap', 'Birthday Decor'],
    description: 'Wedding stage, floral mandap, lighting and birthday/function decoration.',
  },
  {
    nameEn: 'Pet Care',
    nameHi: 'पेट केयर / पालतू देखभाल',
    nameMr: 'पेट केअर / पाळीव प्राणी देखभाल',
    group: 'services',
    keywords: ['Dog Walking', 'Pet Grooming', 'Pet Sitting', 'Animal Care'],
    description: 'Dog walking, pet grooming, feeding and temporary home pet care.',
  },
  {
    nameEn: 'Machine Operator',
    nameHi: 'मशीन ऑपरेटर',
    nameMr: 'मशीन ऑपरेटर',
    group: 'industrial',
    keywords: ['CNC', 'JCB', 'Lathe', 'Factory Machine'],
    description: 'Industrial, workshop and earthmoving machine operation and upkeep.',
  },
];

/**
 * Generates a deterministic, Firestore-safe slug (`^[a-z0-9_]{2,64}$`) for duplicate prevention.
 * Handles ASCII English names directly and falls back cleanly for purely non-Latin Devanagari names.
 */
export function normalizeProfessionSlug(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[&/+]/g, ' and ')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleaned.length >= 2) {
    return cleaned.slice(0, 60);
  }

  // Deterministic hash fallback for pure Marathi / Hindi Devanagari titles
  const unicodeClean = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (unicodeClean.length < 2) return '';
  let hash = 2166136261;
  for (let i = 0; i < unicodeClean.length; i += 1) {
    hash ^= unicodeClean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `prof_${(hash >>> 0).toString(36)}`;
}

export function normalizeProfessionCompareKey(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[().,/&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_PROFESSION_ACRONYMS = new Set([
  'ac', 'cctv', 'dj', 'tv', 'led', 'ro', 'it', 'jcb', 'cnc', 'hvac', 'ev', 'gps', 'wifi', 'ups', 'pc', 'atm',
]);

/**
 * Cleanly formats a user-entered profession name (collapses extra whitespace,
 * title-cases ASCII words while keeping acronyms like AC/CCTV/DJ and Devanagari intact).
 */
export function formatProfessionDisplayName(raw: string): string {
  const collapsed = (raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!collapsed) return '';
  return collapsed
    .split(' ')
    .map((word) => {
      if (!/^[A-Za-z0-9/&.-]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (KNOWN_PROFESSION_ACRONYMS.has(lower)) return lower.toUpperCase();
      if (word.length <= 1) return word.toUpperCase();
      if (/[a-z]/.test(word) && /[A-Z]/.test(word.slice(1))) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export interface DuplicateProfessionMatch {
  source: 'builtin_category' | 'service_catalog' | 'custom_approved' | 'custom_pending';
  existingName: string;
  existingId: string;
  customRecord?: CustomProfessionRecord;
}

/**
 * Checks built-in EMPLOYMENT_CATEGORIES, SERVICE_CATALOG_V2, and existing dynamic customProfessions
 * to prevent duplicate profession entries.
 */
export function findDuplicateProfession(params: {
  inputName: string;
  existingCustomProfessions: CustomProfessionRecord[];
  ignoreProfessionId?: string;
}): DuplicateProfessionMatch | null {
  const compareKey = normalizeProfessionCompareKey(params.inputName);
  const slug = normalizeProfessionSlug(params.inputName);
  if (!compareKey || !slug) return null;

  const stripPlural = (s: string) => (s.length > 4 && s.endsWith('s') ? s.slice(0, -1) : s);
  const compareNoPlural = stripPlural(compareKey);

  // 1. Check built-in EMPLOYMENT_CATEGORIES (EN/HI/MR)
  for (const cat of EMPLOYMENT_CATEGORIES) {
    if (cat.id === 'other-skilled-unskilled') continue;
    const names = [cat.en, cat.hi, cat.mr].map(normalizeProfessionCompareKey);
    const catSlug = normalizeProfessionSlug(cat.en);
    if (
      names.includes(compareKey) ||
      names.some((n) => stripPlural(n) === compareNoPlural && compareNoPlural.length >= 4) ||
      catSlug === slug ||
      stripPlural(catSlug) === stripPlural(slug)
    ) {
      return {
        source: 'builtin_category',
        existingName: cat.en,
        existingId: cat.id,
      };
    }
  }

  // 2. Check core SERVICE_CATALOG_V2 items (excluding 'other_services')
  for (const svc of SERVICE_CATALOG_V2) {
    if (svc.id === 'other_services') continue;
    const names = [svc.en, svc.hi, svc.mr, svc.canonicalCategory].map(normalizeProfessionCompareKey);
    const svcSlug = normalizeProfessionSlug(svc.en);
    if (names.includes(compareKey) || svcSlug === slug) {
      return {
        source: 'service_catalog',
        existingName: svc.canonicalCategory,
        existingId: svc.id,
      };
    }
  }

  // 3. Check existing dynamic customProfessions (approved or pending)
  for (const prof of params.existingCustomProfessions) {
    if (params.ignoreProfessionId && prof.id === params.ignoreProfessionId) continue;
    if (prof.status === 'rejected') continue;
    const names = [prof.nameEn, prof.nameHi || '', prof.nameMr || '']
      .map(normalizeProfessionCompareKey)
      .filter(Boolean);
    if (
      prof.slug === slug ||
      stripPlural(prof.slug) === stripPlural(slug) ||
      names.includes(compareKey) ||
      names.some((n) => stripPlural(n) === compareNoPlural && compareNoPlural.length >= 4)
    ) {
      return {
        source: prof.status === 'approved' ? 'custom_approved' : 'custom_pending',
        existingName: prof.nameEn,
        existingId: prof.id,
        customRecord: prof,
      };
    }
  }

  return null;
}

export function getCustomProfessionLabel(prof: Pick<CustomProfessionRecord, 'nameEn' | 'nameHi' | 'nameMr'>, lang: Language): string {
  if (lang === 'mr' && prof.nameMr?.trim()) return prof.nameMr.trim();
  if (lang === 'hi' && prof.nameHi?.trim()) return prof.nameHi.trim();
  return prof.nameEn;
}

/**
 * Converts an Admin-approved CustomProfessionRecord into a Customer-ready ServiceCategoryV2
 * so it works identically in CustomerHomeV2 search, booking, location matching, and ads.
 */
export function customProfessionToServiceCategoryV2(prof: CustomProfessionRecord): ServiceCategoryV2 {
  const en = prof.nameEn.trim();
  const hi = (prof.nameHi || prof.nameEn).trim();
  const mr = (prof.nameMr || prof.nameEn).trim();
  const baseTagline = prof.description?.trim()
    ? prof.description.trim().slice(0, 68)
    : `Verified local ${en} professionals near you`;

  const kwSubs = (prof.keywords || [])
    .filter((k) => k.trim().length >= 2 && k.trim().toLowerCase() !== en.toLowerCase())
    .slice(0, 4)
    .map((kw, idx) => ({
      id: `${prof.slug}_kw_${idx}`,
      en: kw.trim(),
      hi: kw.trim(),
      mr: kw.trim(),
      startingPrice: prof.expectedWage && prof.expectedWage > 0 ? Math.min(prof.expectedWage, 999) : 249,
      estimatedDuration: 'Flexible',
    }));

  return {
    id: `custom_${prof.slug}`,
    canonicalCategory: en,
    en,
    hi,
    mr,
    taglineEn: baseTagline,
    taglineHi: prof.description?.trim() ? baseTagline : `आपके पास सत्यापित ${hi} कामगार`,
    taglineMr: prof.description?.trim() ? baseTagline : `तुमच्या परिसरातील ${mr} कारागीर`,
    startingPrice: prof.expectedWage && prof.expectedWage > 0 ? Math.min(prof.expectedWage, 999) : 249,
    accentBg: 'bg-teal-50',
    accentText: 'text-teal-800',
    accentBorder: 'border-teal-200/80',
    subServices: [
      {
        id: `${prof.slug}_general`,
        en: `${en} service / consultation`,
        hi: `${hi} सेवा / काम`,
        mr: `${mr} सेवा / काम`,
        startingPrice: prof.expectedWage && prof.expectedWage > 0 ? Math.min(prof.expectedWage, 999) : 249,
        estimatedDuration: 'Flexible',
      },
      ...kwSubs,
    ],
  };
}

// ============================================================
// FIRESTORE REAL-TIME SUBSCRIPTIONS
// ============================================================

export function subscribeApprovedProfessions(
  callback: (items: CustomProfessionRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'customProfessions'), where('status', '==', 'approved'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomProfessionRecord, 'id'>) }))
        .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
      callback(items);
    },
    (err) => {
      console.warn('[CustomProfessions] approved subscription error:', err);
      callback([]);
    }
  );
}

export function subscribeAllProfessionsAdmin(
  callback: (items: CustomProfessionRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'customProfessions'),
    (snap) => {
      const statusOrder: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomProfessionRecord, 'id'>) }))
        .sort((a, b) => {
          const sa = statusOrder[a.status] ?? 9;
          const sb = statusOrder[b.status] ?? 9;
          if (sa !== sb) return sa - sb;
          return a.nameEn.localeCompare(b.nameEn);
        });
      callback(items);
    },
    (err) => {
      logFirestoreListenerError(err, OperationType.LIST, 'customProfessions');
      callback([]);
    }
  );
}

export function subscribeWorkerSubmittedProfessions(
  uid: string,
  callback: (items: CustomProfessionRecord[]) => void
): Unsubscribe {
  if (!uid) {
    callback([]);
    return () => undefined;
  }
  const q = query(collection(db, 'customProfessions'), where('createdByUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CustomProfessionRecord, 'id'>),
      }));
      callback(items);
    },
    () => callback([])
  );
}

// ============================================================
// WORKER CUSTOM PROFESSION SUBMISSION
// ============================================================

export interface SubmitCustomProfessionResult {
  professionId: string;
  canonicalName: string;
  status: 'pending' | 'approved';
  reusedExisting: boolean;
}

export async function submitCustomProfessionByWorker(params: {
  uid: string;
  professionName: string;
  workDescription?: string;
  experienceYears?: number;
  expectedWage?: number;
  wageUnit?: WageUnit;
  preferredLocation?: string;
  sampleWorkPhotoUrls?: string[];
  workerName: string;
  workerRegistrationId: string;
  existingApprovedProfessions: CustomProfessionRecord[];
}): Promise<SubmitCustomProfessionResult> {
  const cleanName = formatProfessionDisplayName(params.professionName);
  if (cleanName.length < 2) {
    throw new Error('Please enter your profession name (at least 2 characters).');
  }

  const slug = normalizeProfessionSlug(cleanName);
  if (!slug || slug.length < 2) {
    throw new Error('Please enter a valid profession name.');
  }

  // Check against already-loaded approved professions & built-ins
  const dup = findDuplicateProfession({
    inputName: cleanName,
    existingCustomProfessions: params.existingApprovedProfessions,
  });

  if (dup?.source === 'builtin_category' || dup?.source === 'service_catalog') {
    return {
      professionId: dup.existingId,
      canonicalName: dup.existingName,
      status: 'approved',
      reusedExisting: true,
    };
  }

  if (dup?.source === 'custom_approved' && dup.customRecord) {
    return {
      professionId: dup.customRecord.id,
      canonicalName: dup.customRecord.nameEn,
      status: 'approved',
      reusedExisting: true,
    };
  }

  // Check Firestore doc by deterministic slug to prevent duplicates across workers
  const ref = doc(db, 'customProfessions', slug);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data() as Omit<CustomProfessionRecord, 'id'>;
      if (existing.status === 'approved') {
        return {
          professionId: slug,
          canonicalName: existing.nameEn,
          status: 'approved',
          reusedExisting: true,
        };
      }
      if (existing.status === 'pending') {
        return {
          professionId: slug,
          canonicalName: existing.nameEn,
          status: 'pending',
          reusedExisting: true,
        };
      }
    }
  } catch {
    // Non-admin read on another worker's pending/rejected doc will be denied by rules —
    // gracefully reuse linkage without creating a duplicate.
    return {
      professionId: slug,
      canonicalName: cleanName,
      status: 'approved',
      reusedExisting: true,
    };
  }

  const keywords = Array.from(
    new Set(
      [
        cleanName,
        ...cleanName
          .split(/[\s,/&-]+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 3),
      ].slice(0, 12)
    )
  );

  const cleanPhotos = (params.sampleWorkPhotoUrls || []).filter(Boolean).slice(0, 4);
  const cleanDesc = (params.workDescription || '').trim().slice(0, 500);
  const cleanLoc = (params.preferredLocation || '').trim().slice(0, 140);

  const payload: Record<string, unknown> = {
    slug,
    nameEn: cleanName,
    nameHi: cleanName,
    nameMr: cleanName,
    group: 'services' as CustomProfessionGroup,
    keywords: keywords.length > 0 ? keywords : [cleanName],
    status: 'approved',
    source: 'worker_submission',
    createdByUid: params.uid,
    submittedByWorkerName: params.workerName.trim().slice(0, 120),
    submittedByWorkerRegistrationId: params.workerRegistrationId.trim().slice(0, 40),
    usageCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanDesc) payload.description = cleanDesc;
  if (cleanLoc) payload.submittedLocation = cleanLoc;
  if (cleanPhotos.length > 0) payload.sampleWorkPhotoUrls = cleanPhotos;
  if (typeof params.expectedWage === 'number' && params.expectedWage >= 0) {
    payload.expectedWage = Math.min(500000, Math.round(params.expectedWage));
  }
  if (params.wageUnit) payload.wageUnit = params.wageUnit;
  if (typeof params.experienceYears === 'number' && params.experienceYears >= 0) {
    payload.experienceYears = Math.min(70, Math.round(params.experienceYears));
  }

  try {
    await setDoc(ref, payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('already exists')) {
      return {
        professionId: slug,
        canonicalName: cleanName,
        status: 'approved',
        reusedExisting: true,
      };
    }
    handleFirestoreError(err, OperationType.CREATE, `customProfessions/${slug}`);
  }

  return {
    professionId: slug,
    canonicalName: cleanName,
    status: 'approved',
    reusedExisting: false,
  };
}

export interface AddLiveCustomProfessionResult {
  professionId: string;
  canonicalName: string;
  status: CustomProfessionStatus;
  reusedExisting: boolean;
  categoryV2?: ServiceCategoryV2;
}

/**
 * Adds a new custom profession/skill directly from the "+" button so it is immediately
 * available as a selectable job title / service category for customers and new workers.
 */
export async function addLiveCustomProfession(params: {
  uid: string;
  submittedByName?: string;
  professionName: string;
  description?: string;
  existingApprovedProfessions: CustomProfessionRecord[];
}): Promise<AddLiveCustomProfessionResult> {
  const cleanName = formatProfessionDisplayName(params.professionName);
  if (cleanName.length < 2) {
    throw new Error('Please enter a valid skill or profession name (at least 2 characters).');
  }

  const slug = normalizeProfessionSlug(cleanName);
  if (!slug || slug.length < 2) {
    throw new Error('Please enter a valid skill or profession name.');
  }

  const dup = findDuplicateProfession({
    inputName: cleanName,
    existingCustomProfessions: params.existingApprovedProfessions,
  });

  if (dup?.source === 'builtin_category' || dup?.source === 'service_catalog') {
    const matchedV2 = SERVICE_CATALOG_V2.find(
      (c) =>
        c.id === dup.existingId ||
        normalizeProfessionCompareKey(c.canonicalCategory) ===
          normalizeProfessionCompareKey(dup.existingName) ||
        normalizeProfessionCompareKey(c.en) === normalizeProfessionCompareKey(dup.existingName)
    );
    return {
      professionId: dup.existingId,
      canonicalName: dup.existingName,
      status: 'approved',
      reusedExisting: true,
      categoryV2: matchedV2,
    };
  }

  if (dup?.source === 'custom_approved' && dup.customRecord) {
    return {
      professionId: dup.customRecord.id,
      canonicalName: dup.customRecord.nameEn,
      status: 'approved',
      reusedExisting: true,
      categoryV2: customProfessionToServiceCategoryV2(dup.customRecord),
    };
  }

  const ref = doc(db, 'customProfessions', slug);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = {
        id: snap.id,
        ...(snap.data() as Omit<CustomProfessionRecord, 'id'>),
      };
      return {
        professionId: slug,
        canonicalName: existing.nameEn,
        status: existing.status,
        reusedExisting: true,
        categoryV2: customProfessionToServiceCategoryV2(existing),
      };
    }
  } catch {
    // Existing doc belongs to another user and is pending/rejected; avoid overwrite
  }

  const keywords = Array.from(
    new Set(
      [
        cleanName,
        ...cleanName
          .split(/[\s,/&-]+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2),
      ].slice(0, 12)
    )
  );

  const cleanDesc = (params.description || '').trim().slice(0, 500);
  const payload: Record<string, unknown> = {
    slug,
    nameEn: cleanName,
    nameHi: cleanName,
    nameMr: cleanName,
    group: 'services' as CustomProfessionGroup,
    keywords: keywords.length > 0 ? keywords : [cleanName],
    status: 'approved',
    source: 'worker_submission',
    createdByUid: params.uid,
    usageCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanDesc) payload.description = cleanDesc;
  if (params.submittedByName?.trim()) {
    payload.submittedByWorkerName = params.submittedByName.trim().slice(0, 120);
  }

  await setDoc(ref, payload);

  const liveRecord: CustomProfessionRecord = {
    id: slug,
    slug,
    nameEn: cleanName,
    nameHi: cleanName,
    nameMr: cleanName,
    description: cleanDesc || undefined,
    group: 'services',
    keywords: keywords.length > 0 ? keywords : [cleanName],
    status: 'approved',
    source: 'worker_submission',
    createdByUid: params.uid,
    usageCount: 1,
  };

  return {
    professionId: slug,
    canonicalName: cleanName,
    status: 'approved',
    reusedExisting: false,
    categoryV2: customProfessionToServiceCategoryV2(liveRecord),
  };
}

// ============================================================
// ADMIN DYNAMIC PROFESSION MANAGEMENT (APPROVE / REJECT / EDIT / CREATE)
// ============================================================

async function syncApprovedProfessionToAdCategory(params: {
  slug: string;
  nameEn: string;
  nameHi?: string;
  nameMr?: string;
  adminUid: string;
}): Promise<void> {
  const adCatRef = doc(db, 'advertisementCategories', params.slug);
  try {
    const snap = await getDoc(adCatRef);
    const payload: Record<string, unknown> = {
      slug: params.slug,
      nameEn: params.nameEn,
      linkedServiceCategories: [params.nameEn, params.slug],
      active: true,
      createdByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    };
    if (params.nameHi?.trim()) payload.nameHi = params.nameHi.trim().slice(0, 100);
    if (params.nameMr?.trim()) payload.nameMr = params.nameMr.trim().slice(0, 100);
    if (!snap.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(adCatRef, payload);
    } else {
      await updateDoc(adCatRef, payload);
    }
  } catch (err) {
    console.warn('[CustomProfessions] ad category sync skipped:', err);
  }
}

async function syncWorkersForCustomProfession(params: {
  professionId: string;
  canonicalName: string;
  nextStatus: 'approved' | 'rejected';
}): Promise<number> {
  let updatedCount = 0;
  try {
    const q = query(
      collection(db, 'publicWorkers'),
      where('customProfessionId', '==', params.professionId)
    );
    const snap = await getDocs(q);
    for (const workerDoc of snap.docs) {
      const data = workerDoc.data() as { skills?: string[]; primarySkill?: string };
      const existingSkills = Array.isArray(data.skills) ? data.skills : [];
      const nextSkills =
        params.nextStatus === 'approved'
          ? Array.from(new Set([params.canonicalName, ...existingSkills])).slice(0, 15)
          : existingSkills;
      await updateDoc(workerDoc.ref, {
        ...(params.nextStatus === 'approved'
          ? { primarySkill: params.canonicalName, skills: nextSkills }
          : {}),
        customProfessionName: params.canonicalName,
        customProfessionStatus: params.nextStatus,
        updatedAt: serverTimestamp(),
      });
      updatedCount += 1;
    }
  } catch (err) {
    console.warn('[CustomProfessions] worker sync warning:', err);
  }
  return updatedCount;
}

export async function adminApproveOrEditCustomProfession(params: {
  profession: CustomProfessionRecord;
  nameEn: string;
  nameHi?: string;
  nameMr?: string;
  description?: string;
  group: CustomProfessionGroup;
  keywords: string[];
  adminNotes?: string;
  adminUid: string;
  adminEmail: string;
  allExistingProfessions: CustomProfessionRecord[];
}): Promise<{ syncedWorkers: number }> {
  const cleanEn = params.nameEn.trim().slice(0, 80);
  if (cleanEn.length < 2) {
    throw new Error('Profession English name must be at least 2 characters.');
  }

  // Prevent renaming into a duplicate of another existing category
  const dup = findDuplicateProfession({
    inputName: cleanEn,
    existingCustomProfessions: params.allExistingProfessions,
    ignoreProfessionId: params.profession.id,
  });
  if (dup) {
    throw new Error(`Duplicate profession detected: "${dup.existingName}" already exists.`);
  }

  const cleanKeywords = Array.from(
    new Set([cleanEn, ...params.keywords.map((k) => k.trim()).filter(Boolean)])
  ).slice(0, 12);

  const ref = doc(db, 'customProfessions', params.profession.id);
  const updatePayload: Record<string, unknown> = {
    nameEn: cleanEn,
    group: params.group,
    keywords: cleanKeywords,
    status: 'approved',
    approvedByUid: params.adminUid,
    updatedAt: serverTimestamp(),
  };
  if (params.nameHi?.trim()) updatePayload.nameHi = params.nameHi.trim().slice(0, 80);
  if (params.nameMr?.trim()) updatePayload.nameMr = params.nameMr.trim().slice(0, 80);
  if (params.description?.trim()) updatePayload.description = params.description.trim().slice(0, 500);
  if (params.adminNotes?.trim()) updatePayload.adminNotes = params.adminNotes.trim().slice(0, 500);

  try {
    await updateDoc(ref, updatePayload);
    const syncedWorkers = await syncWorkersForCustomProfession({
      professionId: params.profession.id,
      canonicalName: cleanEn,
      nextStatus: 'approved',
    });
    await syncApprovedProfessionToAdCategory({
      slug: params.profession.slug,
      nameEn: cleanEn,
      nameHi: params.nameHi,
      nameMr: params.nameMr,
      adminUid: params.adminUid,
    });
    await addDoc(collection(db, 'auditLogs'), {
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: 'approve_custom_profession',
      targetCollection: 'customProfessions',
      targetId: params.profession.id,
      details: `Approved custom profession "${cleanEn}" (${params.profession.slug}) and synced ${syncedWorkers} worker(s).`,
      createdAt: serverTimestamp(),
    });
    return { syncedWorkers };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `customProfessions/${params.profession.id}`);
    return { syncedWorkers: 0 };
  }
}

export async function adminRejectCustomProfession(params: {
  profession: CustomProfessionRecord;
  reason: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const ref = doc(db, 'customProfessions', params.profession.id);
  try {
    await updateDoc(ref, {
      status: 'rejected',
      adminNotes: (params.reason || 'Rejected by Admin').trim().slice(0, 500),
      approvedByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    });
    await syncWorkersForCustomProfession({
      professionId: params.profession.id,
      canonicalName: params.profession.nameEn,
      nextStatus: 'rejected',
    });
    await addDoc(collection(db, 'auditLogs'), {
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: 'reject_custom_profession',
      targetCollection: 'customProfessions',
      targetId: params.profession.id,
      details: `Rejected custom profession "${params.profession.nameEn}": ${params.reason || 'No reason provided'}`,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `customProfessions/${params.profession.id}`);
  }
}

export async function adminCreateDynamicProfession(params: {
  nameEn: string;
  nameHi?: string;
  nameMr?: string;
  description?: string;
  group: CustomProfessionGroup;
  keywords: string[];
  adminUid: string;
  adminEmail: string;
  allExistingProfessions: CustomProfessionRecord[];
}): Promise<string> {
  const cleanEn = params.nameEn.trim().slice(0, 80);
  if (cleanEn.length < 2) {
    throw new Error('Profession name must be at least 2 characters.');
  }

  const dup = findDuplicateProfession({
    inputName: cleanEn,
    existingCustomProfessions: params.allExistingProfessions,
  });
  if (dup) {
    throw new Error(`Profession "${dup.existingName}" already exists (${dup.source.replace(/_/g, ' ')}). Duplicate entries are blocked.`);
  }

  const slug = normalizeProfessionSlug(cleanEn);
  if (!slug || slug.length < 2) {
    throw new Error('Could not generate a valid slug for this profession.');
  }

  const cleanKeywords = Array.from(
    new Set([cleanEn, ...params.keywords.map((k) => k.trim()).filter(Boolean)])
  ).slice(0, 12);

  const ref = doc(db, 'customProfessions', slug);
  const payload: Record<string, unknown> = {
    slug,
    nameEn: cleanEn,
    group: params.group,
    keywords: cleanKeywords,
    status: 'approved',
    source: 'admin_created',
    createdByUid: params.adminUid,
    approvedByUid: params.adminUid,
    usageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.nameHi?.trim()) payload.nameHi = params.nameHi.trim().slice(0, 80);
  if (params.nameMr?.trim()) payload.nameMr = params.nameMr.trim().slice(0, 80);
  if (params.description?.trim()) payload.description = params.description.trim().slice(0, 500);

  try {
    await setDoc(ref, payload);
    await syncApprovedProfessionToAdCategory({
      slug,
      nameEn: cleanEn,
      nameHi: params.nameHi,
      nameMr: params.nameMr,
      adminUid: params.adminUid,
    });
    await addDoc(collection(db, 'auditLogs'), {
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: 'create_dynamic_profession',
      targetCollection: 'customProfessions',
      targetId: slug,
      details: `Admin created & published dynamic profession "${cleanEn}" (${slug}).`,
      createdAt: serverTimestamp(),
    });
    return slug;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `customProfessions/${slug}`);
    return slug;
  }
}

export async function adminDeleteCustomProfession(params: {
  profession: CustomProfessionRecord;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customProfessions', params.profession.id));
    await addDoc(collection(db, 'auditLogs'), {
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: 'delete_custom_profession',
      targetCollection: 'customProfessions',
      targetId: params.profession.id,
      details: `Deleted custom profession "${params.profession.nameEn}".`,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `customProfessions/${params.profession.id}`);
  }
}
