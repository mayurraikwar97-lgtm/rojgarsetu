import { EMPLOYMENT_CATEGORIES } from '../data/categories.ts';
import { calculateDistanceKm } from '../data/indiaLocations.ts';
import type { Language, ServiceRadiusKm } from '../types/domain.ts';

export const SERVICE_RADIUS_STAGES: readonly ServiceRadiusKm[] = [2, 5, 10, 20, 30] as const;

export function normalizeRadiusKm(value: unknown, fallback: ServiceRadiusKm = 2): ServiceRadiusKm {
  const num = Number(value);
  if (num === 2 || num === 5 || num === 10 || num === 20 || num === 30) return num;
  if (num > 0 && num <= 2) return 2;
  if (num > 2 && num <= 5) return 5;
  if (num > 5 && num <= 10) return 10;
  if (num > 10 && num <= 20) return 20;
  if (num > 20) return 30;
  return fallback;
}

export function getNextRadiusStage(currentRadiusKm: unknown): ServiceRadiusKm | null {
  const current = normalizeRadiusKm(currentRadiusKm, 2);
  const idx = SERVICE_RADIUS_STAGES.indexOf(current);
  if (idx < 0 || idx >= SERVICE_RADIUS_STAGES.length - 1) return null;
  return SERVICE_RADIUS_STAGES[idx + 1];
}

export const BIKE_TRANSPORT_CATEGORY_NAME = 'Bike Hire & Transport';

const TRANSPORT_RIDER_TOKENS = new Set<string>([
  'bike_transport',
  'driver',
  'auto_taxi_operator',
  'delivery_personnel',
  'transport_logistics',
]);

export function isBikeOrTransportCategory(raw: string): boolean {
  const token = normalizeCategoryToken(raw);
  return TRANSPORT_RIDER_TOKENS.has(token);
}

export function normalizeCategoryToken(raw: string): string {
  const clean = (raw || '').toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!clean) return '';
  if (
    clean.includes('bike hire') ||
    clean.includes('bike taxi') ||
    clean.includes('bike rider') ||
    clean.includes('bike transport') ||
    clean === 'rider' ||
    clean.includes('रायडर') ||
    clean.includes('राइडर') ||
    clean.includes('बाईक भाडे') ||
    clean.includes('बाईक टॅक्सी') ||
    clean.includes('बाइक टैक्सी')
  ) {
    return 'bike_transport';
  }
  if (
    clean.includes('transport') ||
    clean.includes('logistics') ||
    clean.includes('वाहतूक') ||
    clean.includes('परिवहन') ||
    clean.includes('ट्रान्सपोर्ट') ||
    clean.includes('ट्रांसपोर्ट')
  ) {
    return 'transport_logistics';
  }
  if (
    clean.includes('daily labour') ||
    clean.includes('daily labor') ||
    clean.includes('general labour') ||
    clean.includes('general labor') ||
    clean.includes('helpers and general') ||
    clean === 'helper' ||
    clean === 'helpers' ||
    clean === 'labour' ||
    clean === 'labor' ||
    clean.includes('हेल्पर') ||
    clean.includes('मजदूर') ||
    clean.includes('कामगार')
  ) {
    if (!clean.includes('बांधकाम') && !clean.includes('कृषी') && !clean.includes('घरगुती') && !clean.includes('औद्योगिक') && !clean.includes('वाहतूक')) {
      return 'helpers_and_general_labour';
    }
  }
  if (clean.includes('carpenter') || clean.includes('सुतार') || clean.includes('बढ़ई') || clean.includes('कारपेंटर')) return 'carpenter';
  if (clean.includes('electrician') || clean.includes('इलेक्ट्रिशियन') || clean.includes('इलेक्ट्रीशियन') || clean.includes('वीजतंत्री')) {
    return 'electrician';
  }
  if (clean.includes('plumber') || clean.includes('प्लंबर') || clean.includes('नलसाज') || clean.includes('नळ कारागीर')) {
    return 'plumber';
  }
  if (clean.includes('auto') && (clean.includes('taxi') || clean.includes('rickshaw') || clean.includes('commercial'))) return 'auto_taxi_operator';
  if (clean.includes('tractor') || clean.includes('ट्रॅक्टर') || clean.includes('ट्रैक्टर')) return 'tractor_operator';
  if (clean.includes('driver') || clean.includes('ड्रायव्हर') || clean.includes('ड्राइवर') || clean.includes('चालक')) {
    return 'driver';
  }
  if (
    clean.includes('mason') ||
    clean.includes('masonry') ||
    clean.includes('गवंडी') ||
    clean.includes('राजमिस्त्री') ||
    clean.includes('construction worker') ||
    clean.includes('बांधकाम कामगार') ||
    clean.includes('निर्माण श्रमिक')
  ) {
    return 'construction_worker';
  }
  if (clean.includes('painter') || clean.includes('पेंटर') || clean.includes('रंगारी')) return 'painter';
  if (clean.includes('welder') || clean.includes('वेल्डर')) return 'welder';
  if (clean.includes('fitter') || clean.includes('machine operator') || clean.includes('फिटर')) return 'fitter_operator';
  if (clean.includes('factory') || clean.includes('industrial') || clean.includes('फैक्ट्री') || clean.includes('कारखाना')) {
    return 'factory_worker';
  }
  if (clean.includes('cook') || clean.includes('kitchen') || clean.includes('रसोइया') || clean.includes('स्वयंपाकी')) {
    return 'cook_kitchen';
  }
  if (clean.includes('security guard') || clean.includes('सुरक्षा गार्ड') || clean.includes('सुरक्षा रक्षक')) {
    return 'security_guard';
  }
  if (clean.includes('delivery') || clean.includes('डिलीवरी') || clean.includes('डिलिव्हरी')) return 'delivery_personnel';
  if (
    clean.includes('ac repair') ||
    clean.includes('air conditioner') ||
    clean.includes('appliance') ||
    clean.includes('fridge') ||
    clean.includes('washing machine') ||
    clean.includes('mechanic') ||
    clean.includes('technician') ||
    clean.includes('मेकॅनिक') ||
    clean.includes('मैकेनिक') ||
    clean.includes('उपकरण')
  ) {
    return 'technician_mechanic';
  }
  if (clean.includes('housekeeping') || clean.includes('cleaning') || clean.includes('cleaner') || clean.includes('स्वच्छता') || clean.includes('हाउसकीपिंग')) {
    return 'housekeeping_cleaning';
  }
  if (clean.includes('domestic') || clean.includes('घरगुती') || clean.includes('घरेलू')) return 'domestic_worker';
  if (clean.includes('agricultur') || clean.includes('शेतमजूर') || clean.includes('कृषि श्रमिक')) return 'agricultural_worker';
  if (clean.includes('healthcare') || clean.includes('caregiver') || clean.includes('आरोग्य') || clean.includes('स्वास्थ्य')) {
    return 'healthcare_caregiver';
  }
  if (clean.includes('teacher') || clean.includes('tutor') || clean.includes('शिक्षक')) return 'teacher_tutor';
  if (clean.includes('accountant') || clean.includes('अकाउंटंट') || clean.includes('अकाउंटेंट')) return 'accountant';
  if (clean.includes('data entry') || clean.includes('डेटा एंट्री')) return 'data_entry_operator';
  if (clean.includes('computer operator') || clean.includes('संगणक चालक')) return 'computer_operator';
  if (clean.includes('office assistant') || clean.includes('कार्यालय सहाय्यक') || clean.includes('कार्यालय सहायक')) {
    return 'office_assistant';
  }
  if (clean.includes('tailor') || clean.includes('freelancer')) return 'freelancer_self_employed';
  if (clean.includes('women entrepreneur') || clean.includes('महिला उद्योजक') || clean.includes('महिला उद्यमी')) {
    return 'women_entrepreneur';
  }
  return clean.replace(/s$/, '');
}

function getCategoryCanonicalSkillsOnly(categoryOrSkill: string): Set<string> {
  const tokens = new Set<string>();
  const norm = normalizeCategoryToken(categoryOrSkill);
  if (norm) tokens.add(norm);
  const rawLower = (categoryOrSkill || '').toLowerCase().trim();
  const matchedCat = EMPLOYMENT_CATEGORIES.find(
    (c) =>
      c.en.toLowerCase() === rawLower ||
      normalizeCategoryToken(c.en) === norm
  );
  if (matchedCat) {
    tokens.add(normalizeCategoryToken(matchedCat.en));
    matchedCat.skillsEn.forEach((sk) => {
      const skNorm = normalizeCategoryToken(sk);
      if (skNorm) tokens.add(skNorm);
    });
  }
  return tokens;
}

export function doesCategoryMatch(
  jobCategory: string,
  jobRequiredSkills: string[],
  workerPrimarySkill: string,
  workerSkills: string[],
  workerPreferredCategories?: string[]
): boolean {
  const jobCatNorm = normalizeCategoryToken(jobCategory);
  if (!jobCatNorm) return false;

  const workerPrimaryNorm = normalizeCategoryToken(workerPrimarySkill);
  const workerSkillNorms = (workerSkills || []).map(normalizeCategoryToken).filter(Boolean);

  // Strict Bike Hire / Transport isolation: ONLY Bike Rider / Transport workers receive Bike Hire / Transport orders!
  if (jobCatNorm === 'bike_transport') {
    const isTransportWorker =
      TRANSPORT_RIDER_TOKENS.has(workerPrimaryNorm) ||
      workerSkillNorms.some((ws) => TRANSPORT_RIDER_TOKENS.has(ws));
    if (!isTransportWorker) return false;
    const prefCats = Array.isArray(workerPreferredCategories)
      ? workerPreferredCategories.map(normalizeCategoryToken).filter(Boolean)
      : [];
    if (prefCats.length === 0) return true;
    return prefCats.some((pref) => TRANSPORT_RIDER_TOKENS.has(pref));
  }

  // Normal work orders: strict canonical category matching (no cross-category leakage!)
  const jobPrimarySkills = getCategoryCanonicalSkillsOnly(jobCategory);
  const jobReqNorms = (jobRequiredSkills || []).map(normalizeCategoryToken).filter(Boolean);
  const allowedJobTokens = new Set<string>([jobCatNorm, ...jobPrimarySkills]);
  // Only include required skills that belong to this job's own canonical trade (prevents cross-trade bleed)
  jobReqNorms.forEach((sk) => {
    if (sk === jobCatNorm || jobPrimarySkills.has(sk)) {
      allowedJobTokens.add(sk);
    }
  });

  const skillMatches =
    Boolean(workerPrimaryNorm && (workerPrimaryNorm === jobCatNorm || allowedJobTokens.has(workerPrimaryNorm))) ||
    workerSkillNorms.some((ws) => ws === jobCatNorm || jobPrimarySkills.has(ws));

  if (!skillMatches) return false;

  const prefCats = Array.isArray(workerPreferredCategories)
    ? workerPreferredCategories.map(normalizeCategoryToken).filter(Boolean)
    : [];

  if (prefCats.length === 0) return true;

  return prefCats.some((pref) => pref === jobCatNorm || allowedJobTokens.has(pref));
}

/**
 * Computes privacy-safe approximate location label (City/Area + District)
 * without exposing exact house number, street address, or flat details before acceptance.
 */
export function buildApproxLocationLabel(input: {
  cityOrVillage?: string;
  district?: string;
  state?: string;
}): string {
  const city = (input.cityOrVillage || '').trim();
  const district = (input.district || '').trim();
  const state = (input.state || '').trim();

  // Strip leading house/flat numbers if someone accidentally put a street line into cityOrVillage
  const sanitizedCity = city
    .replace(/^(house|flat|plot|room|shop|h\.?no\.?|s\.?no\.?)\s*#?\s*\d+[a-z\-\/]*[\s,]*/i, '')
    .trim();

  const parts: string[] = [];
  if (sanitizedCity && sanitizedCity.toLowerCase() !== district.toLowerCase()) {
    parts.push(sanitizedCity);
  }
  if (district) {
    parts.push(district);
  }
  if (parts.length === 0 && state) {
    parts.push(state);
  }
  return parts.join(', ').slice(0, 140) || 'Local Area';
}

export function getPublicJobLocationText(
  job: {
    approxLocationLabel?: string;
    cityOrVillage?: string;
    district?: string;
    state?: string;
    workLocationLabel?: string;
  },
  isAcceptedParticipant = false
): string {
  if (isAcceptedParticipant && job.workLocationLabel) {
    return [job.workLocationLabel, job.district, job.state].filter(Boolean).join(', ');
  }
  if (job.approxLocationLabel) return job.approxLocationLabel;
  return buildApproxLocationLabel({
    cityOrVillage: job.cityOrVillage,
    district: job.district,
    state: job.state,
  });
}

export function getLocalizedCategoryLabel(categoryEnOrAny: string, lang: Language): string {
  const norm = normalizeCategoryToken(categoryEnOrAny);
  const found = EMPLOYMENT_CATEGORIES.find(
    (c) =>
      c.en.toLowerCase() === categoryEnOrAny.toLowerCase() ||
      normalizeCategoryToken(c.en) === norm
  );
  if (!found) return categoryEnOrAny;
  if (lang === 'mr') {
    if (found.id === 'carpenters') return 'कारपेंटर (सुतार)';
    if (found.id === 'electricians') return 'इलेक्ट्रिशियन';
    if (found.id === 'plumbers') return 'प्लंबर';
    return found.mr.split('/')[0].trim();
  }
  if (lang === 'hi') {
    if (found.id === 'carpenters') return 'बढ़ई (कारपेंटर)';
    if (found.id === 'electricians') return 'इलेक्ट्रीशियन';
    if (found.id === 'plumbers') return 'प्लंबर';
    return found.hi.split('/')[0].trim();
  }
  return found.en.endsWith('s') && found.en.length > 4 ? found.en.slice(0, -1) : found.en;
}

export function calculateValidDistanceKm(
  lat1: unknown,
  lng1: unknown,
  lat2: unknown,
  lng2: unknown
): number | null {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);
  if (
    !Number.isFinite(aLat) ||
    !Number.isFinite(aLng) ||
    !Number.isFinite(bLat) ||
    !Number.isFinite(bLng)
  ) {
    return null;
  }
  if (
    (Math.abs(aLat) < 0.1 && Math.abs(aLng) < 0.1) ||
    (Math.abs(bLat) < 0.1 && Math.abs(bLng) < 0.1)
  ) {
    return null;
  }
  const km = calculateDistanceKm(aLat, aLng, bLat, bLng);
  return Math.round(km * 10) / 10;
}

export function buildSmartJobVoiceScript(params: {
  lang: Language;
  customerName: string;
  category: string;
  jobTitle?: string;
  jobDescription?: string;
  approxLocationLabel: string;
  distanceKm?: number | null;
}): string {
  const { lang, customerName, category, jobTitle, jobDescription, approxLocationLabel, distanceKm } = params;
  const safeCustomer = (customerName || 'Customer').trim().slice(0, 80);
  const rawTask = (jobDescription || jobTitle || category || 'service').trim();
  const cleanTask = rawTask.replace(/\s+/g, ' ').slice(0, 110);
  const localizedCat = getLocalizedCategoryLabel(category, lang);
  const safeArea = approxLocationLabel || 'your area';
  const hasDist = typeof distanceKm === 'number' && Number.isFinite(distanceKm);
  const distRounded = hasDist ? Math.max(0.5, Math.round(distanceKm * 10) / 10) : null;

  if (lang === 'mr') {
    const locClause = distRounded !== null
      ? `अंदाजे ठिकाण: ${safeArea}, सुमारे ${distRounded} किलोमीटर अंतरावर.`
      : `अंदाजे ठिकाण: ${safeArea}.`;
    return `रोजगार सेतूवर नवीन कामाची संधी! ${safeCustomer} यांना ${cleanTask} साठी ${localizedCat} ची आवश्यकता आहे. ${locClause} आपण हे काम करू शकत असाल तर रोजगार सेतू ॲप उघडा आणि आपली ऑफर पाठवा.`;
  }

  if (lang === 'hi') {
    const locClause = distRounded !== null
      ? `लगभग स्थान: ${safeArea}, करीब ${distRounded} किलोमीटर दूर।`
      : `लगभग स्थान: ${safeArea}।`;
    return `रोजगार सेतु पर नया काम का अवसर! ${safeCustomer} को ${cleanTask} के लिए ${localizedCat} की आवश्यकता है। ${locClause} यदि आप यह काम कर सकते हैं, तो रोजगार सेतु ऐप खोलें और अपना ऑफर भेजें।`;
  }

  const locClause = distRounded !== null
    ? `Approximate area: ${safeArea}, about ${distRounded} kilometers away.`
    : `Approximate area: ${safeArea}.`;
  return `New job opportunity on Rojgar Setu! ${safeCustomer} needs a ${localizedCat} for ${cleanTask}. ${locClause} If you can take this work, open the Rojgar Setu app and submit your offer.`;
}

export function buildSmartJobNotificationContent(params: {
  lang: Language;
  customerName: string;
  title: string;
  category: string;
  description?: string;
  approxLocationLabel: string;
  distanceKm?: number | null;
  offeredWage?: number;
  wageUnit?: string;
}): { title: string; body: string; voiceScript: string } {
  const {
    lang,
    customerName,
    title,
    category,
    description,
    approxLocationLabel,
    distanceKm,
    offeredWage = 0,
    wageUnit = 'daily',
  } = params;

  const localizedCat = getLocalizedCategoryLabel(category, lang);
  const distText =
    typeof distanceKm === 'number' && Number.isFinite(distanceKm) ? ` (~${distanceKm} km)` : '';
  const wagePart = offeredWage > 0 ? ` · ₹${offeredWage}/${wageUnit}` : '';

  const voiceScript = buildSmartJobVoiceScript({
    lang,
    customerName,
    category,
    jobTitle: title,
    jobDescription: description || title,
    approxLocationLabel,
    distanceKm,
  });

  if (lang === 'mr') {
    return {
      title: `नवीन काम उपलब्ध! · ${localizedCat}`.slice(0, 155),
      body: `आपल्या परिसरात ${localizedCat}चे काम आले आहे (${approxLocationLabel}${distText}${wagePart}). नवीन ग्राहक ऑर्डर – त्वरित तपासा.`.slice(0, 480),
      voiceScript,
    };
  }
  if (lang === 'hi') {
    return {
      title: `नया ${localizedCat} काम: ${title}`.slice(0, 155),
      body: `${customerName} · ${approxLocationLabel}${distText}${wagePart}। ऐप खोलें और ऑफर भेजें।`.slice(0, 480),
      voiceScript,
    };
  }
  return {
    title: `New ${localizedCat} Job: ${title}`.slice(0, 155),
    body: `${customerName} · ${approxLocationLabel}${distText}${wagePart}. Open to view details & send offer.`.slice(0, 480),
    voiceScript,
  };
}

export interface EligibilityWorkerInput {
  ownerUid: string;
  displayName: string;
  primarySkill: string;
  skills: string[];
  district: string;
  cityOrVillage?: string;
  approxLat?: number;
  approxLng?: number;
  verificationStatus: string;
  availabilityStatus: string;
  preferredLanguage?: Language;
  preferredRadiusKm?: number;
}

export interface EligibilityJobInput {
  employerUid: string;
  category: string;
  requiredSkills: string[];
  district: string;
  cityOrVillage?: string;
  lat: number;
  lng: number;
}

export interface EligibilityPrefInput {
  masterEnabled?: boolean;
  matchingJobs?: boolean;
  voiceAlertsEnabled?: boolean;
  soundEnabled?: boolean;
  preferredLanguage?: Language;
  preferredCategories?: string[];
  preferredRadiusKm?: number;
}

export interface WorkerEligibilityEvaluation {
  eligible: boolean;
  reason:
    | 'matched'
    | 'self_employer'
    | 'suspended'
    | 'not_available'
    | 'already_notified'
    | 'notifications_disabled'
    | 'category_mismatch'
    | 'outside_radius';
  distanceKm: number | null;
  effectiveRadiusLimitKm: number;
}

export function evaluateWorkerEligibilityForJob(params: {
  job: EligibilityJobInput;
  worker: EligibilityWorkerInput;
  pref?: EligibilityPrefInput | null;
  stageRadiusKm: number;
  alreadyNotifiedUids?: Set<string>;
}): WorkerEligibilityEvaluation {
  const { job, worker, pref, stageRadiusKm, alreadyNotifiedUids } = params;

  if (!worker.ownerUid || (job.employerUid && worker.ownerUid === job.employerUid)) {
    return { eligible: false, reason: 'self_employer', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }
  if (alreadyNotifiedUids?.has(worker.ownerUid)) {
    return { eligible: false, reason: 'already_notified', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }
  if (worker.verificationStatus === 'suspended') {
    return { eligible: false, reason: 'suspended', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }
  if (worker.availabilityStatus !== 'available') {
    return { eligible: false, reason: 'not_available', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }
  if (pref && (pref.masterEnabled === false || pref.matchingJobs === false)) {
    return { eligible: false, reason: 'notifications_disabled', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }

  const categoryMatched = doesCategoryMatch(
    job.category,
    job.requiredSkills,
    worker.primarySkill,
    worker.skills,
    pref?.preferredCategories
  );
  if (!categoryMatched) {
    return { eligible: false, reason: 'category_mismatch', distanceKm: null, effectiveRadiusLimitKm: stageRadiusKm };
  }

  const workerMaxRadius = normalizeRadiusKm(pref?.preferredRadiusKm ?? worker.preferredRadiusKm ?? 30, 30);
  const normalizedStage = normalizeRadiusKm(stageRadiusKm, 2);
  const effectiveRadius = Math.min(normalizedStage, workerMaxRadius);

  const sameCity =
    Boolean(job.cityOrVillage && worker.cityOrVillage) &&
    job.cityOrVillage!.toLowerCase().trim() === worker.cityOrVillage!.toLowerCase().trim();
  const sameDistrict =
    Boolean(job.district && worker.district) &&
    job.district.toLowerCase().trim() === worker.district.toLowerCase().trim();

  const distKm = calculateValidDistanceKm(job.lat, job.lng, worker.approxLat, worker.approxLng);

  if (distKm !== null) {
    if (
      distKm <= effectiveRadius ||
      (sameCity && normalizedStage >= 5 && distKm <= Math.max(effectiveRadius, 12)) ||
      (sameDistrict && normalizedStage >= 20 && workerMaxRadius >= 20 && distKm <= 120)
    ) {
      return {
        eligible: true,
        reason: 'matched',
        distanceKm: distKm,
        effectiveRadiusLimitKm: effectiveRadius,
      };
    }
    return {
      eligible: false,
      reason: 'outside_radius',
      distanceKm: distKm,
      effectiveRadiusLimitKm: effectiveRadius,
    };
  }

  // Fallback when worker lacks valid GPS coordinates: match same city immediately or same district from stage >= 10 km
  if (sameCity || (sameDistrict && normalizedStage >= 10)) {
    return {
      eligible: true,
      reason: 'matched',
      distanceKm: null,
      effectiveRadiusLimitKm: effectiveRadius,
    };
  }

  return {
    eligible: false,
    reason: 'outside_radius',
    distanceKm: null,
    effectiveRadiusLimitKm: effectiveRadius,
  };
}
