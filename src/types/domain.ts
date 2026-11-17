export type Language = 'en' | 'hi' | 'mr';

export type UserRole = 'worker' | 'employer' | 'admin';

export type PageRoute =
  | 'home'
  | 'hire'
  | 'transport'
  | 'find-work'
  | 'find-workers'
  | 'skills-training'
  | 'register-worker'
  | 'register-employer'
  | 'register-vehicle'
  | 'post-job'
  | 'worker-dashboard'
  | 'employer-dashboard'
  | 'admin'
  | 'about'
  | 'partnerships'
  | 'pricing'
  | 'trust-safety'
  | 'contact';

export type VehicleType =
  | 'bike_taxi'
  | 'auto_rickshaw'
  | 'car_sedan'
  | 'suv_innova'
  | 'trolley_cart'
  | 'mini_tempo'
  | 'pickup_tempo'
  | 'tractor';
export type VehicleTripType = 'one_way' | 'round_trip' | 'hourly' | 'full_day';

export type WageUnit = 'daily' | 'monthly' | 'hourly' | 'contract';
export type WorkType = 'full_time' | 'part_time' | 'daily_wage' | 'contract';
export type JobWorkType = WorkType | 'temporary' | 'urgent' | 'bulk';
export type VerificationStatus = 'pending' | 'verified' | 'suspended';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  preferredLanguage: Language;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicWorkerProfile {
  id: string;
  ownerUid: string;
  registrationId: string;
  displayName: string;
  primarySkill: string;
  skills: string[];
  experienceYears: number;
  expectedWage: number;
  wageUnit: WageUnit;
  preferredWorkType: WorkType;
  availabilityStatus: 'available' | 'busy' | 'offline';
  state: string;
  district: string;
  cityOrVillage: string;
  approxLat: number;
  approxLng: number;
  languagesKnown: string[];
  gender?: 'female' | 'male' | 'other' | 'prefer_not_to_say';
  education?: string;
  verificationStatus: VerificationStatus;
  isWomenEnterprise?: boolean;
  completedJobsCount: number;
  ratingAvg: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkerPrivateInfo {
  ownerUid: string;
  fullName: string;
  mobile: string;
  mobileVerified: boolean;
  email?: string;
  ageConfirmed: boolean;
  preferredWorkLocation?: string;
  liveLocationConsent: boolean;
  privacyConsent: boolean;
  idVerificationStatus: 'not_submitted' | 'voluntary_pending' | 'verified';
  certificateNotes?: string;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicEmployerProfile {
  id: string;
  ownerUid: string;
  registrationId: string;
  businessName: string;
  businessType: string;
  industryCategory: string;
  state: string;
  district: string;
  requiredCategories: string[];
  verificationStatus: VerificationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmployerPrivateInfo {
  ownerUid: string;
  contactPerson: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  businessAddress: string;
  gstNumber?: string;
  establishmentDetails?: string;
  workforceNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JobPosting {
  id: string;
  employerUid: string;
  employerName: string;
  title: string;
  category: string;
  description: string;
  workersRequired: number;
  requiredSkills: string[];
  state: string;
  district: string;
  cityOrVillage: string;
  workLocationLabel: string;
  lat: number;
  lng: number;
  jobDate?: string;
  startTime?: string;
  duration?: string;
  workType: JobWorkType;
  offeredWage: number;
  wageUnit: WageUnit;
  paymentTerms: string;
  contactPreference: 'platform_message' | 'phone_after_confirm';
  isWomenFriendly: boolean;
  isAccessible: boolean;
  biddingEnabled: boolean;
  photoAttachment?: string;
  photoAnalyzed?: boolean;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'flagged';
  applicationsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  employerUid: string;
  workerUid: string;
  workerRegistrationId: string;
  workerName: string;
  workerPrimarySkill: string;
  proposedWage: number;
  note?: string;
  status: 'applied' | 'invited' | 'accepted' | 'declined' | 'work_completed';
  liveTrackingAuthorized: boolean;
  workerRating?: number;
  employerFeedback?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PartnershipEnquiry {
  id: string;
  submitterUid: string;
  organisationName: string;
  departmentOrInstitution: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  state: string;
  district: string;
  partnershipInterest: string;
  message: string;
  attachmentName?: string;
  status: 'received' | 'under_review' | 'responded' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GrievanceReport {
  id: string;
  reporterUid: string;
  category: 'fraudulent_job' | 'non_payment' | 'harassment' | 'unsafe_workplace' | 'account_appeal' | 'other';
  targetReference?: string;
  subject: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformAnnouncement {
  id: string;
  titleEn: string;
  titleHi: string;
  titleMr: string;
  bodyEn: string;
  bodyHi: string;
  bodyMr: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetCollection: string;
  targetId: string;
  details?: string;
  createdAt?: unknown;
}

export interface VehicleListing {
  id: string;
  ownerUid: string;
  registrationId: string;
  ownerDisplayName: string;
  vehicleType: VehicleType;
  vehicleTitle: string;
  vehicleNumberMasked: string;
  seatingOrCapacity: string;
  acAvailable: boolean;
  withDriver: boolean;
  ratePerKm: number;
  ratePerDay: number;
  minFare: number;
  availabilityStatus: 'available' | 'busy' | 'offline';
  state: string;
  district: string;
  cityOrVillage: string;
  approxLat: number;
  approxLng: number;
  languagesKnown: string[];
  serviceNotes?: string;
  verificationStatus: VerificationStatus;
  completedTripsCount: number;
  ratingAvg: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VehiclePrivateInfo {
  ownerUid: string;
  ownerName: string;
  mobile: string;
  mobileVerified: boolean;
  email?: string;
  rcOrLicenseNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VehicleBooking {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  vehicleType: VehicleType;
  ownerUid: string;
  customerUid: string;
  customerName: string;
  pickupLocation: string;
  dropLocation: string;
  tripType: VehicleTripType;
  travelDate: string;
  travelTime: string;
  passengersCount: number;
  offeredFare: number;
  note?: string;
  status: 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerPreference {
  id?: string;
  ownerUid: string;
  defaultState?: string;
  defaultDistrict?: string;
  defaultCityOrVillage?: string;
  defaultLat?: number;
  defaultLng?: number;
  savedAddressLabel?: string;
  frequentWorkerCategories: string[];
  frequentVehicleTypes: VehicleType[];
  totalHireOrders: number;
  totalTransportOrders: number;
  lastOrderTitle?: string;
  lastOrderCategory?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiHirePrefill {
  mode: 'workers' | 'transport';
  category?: string;
  subcategory?: string;
  requiredService?: string;
  workersRequired?: number;
  vehicleType?: VehicleType | '';
  fromLocation?: string;
  toLocation?: string;
  tripType?: VehicleTripType;
  urgency?: 'today' | 'tomorrow' | 'scheduled';
  title?: string;
  note?: string;
  transcript?: string;
  photoAttachment?: string;
  photoAnalyzed?: boolean;
}

export type NotificationCategoryKey =
  | 'matchingJobs'
  | 'nearbyJobs'
  | 'applicationUpdates'
  | 'bookingNotifications'
  | 'announcements';

export interface DeviceTokenRecord {
  id: string;
  ownerUid: string;
  role: 'worker' | 'employer' | 'admin' | 'demo_worker';
  isDemo: boolean;
  demoAccountId?: string;
  token: string;
  platform: 'android' | 'ios' | 'desktop';
  browser: string;
  preferredLanguage: Language;
  enabled: boolean;
  userAgentShort: string;
  lastSeenAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationPreferences {
  id?: string;
  ownerUid: string;
  masterEnabled: boolean;
  matchingJobs: boolean;
  nearbyJobs: boolean;
  applicationUpdates: boolean;
  bookingNotifications: boolean;
  announcements: boolean;
  preferredLanguage: Language;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotificationRecord {
  id: string;
  recipientUid: string;
  recipientRole: 'worker' | 'employer' | 'admin' | 'demo_worker';
  isDemo: boolean;
  category: NotificationCategoryKey;
  title: string;
  body: string;
  language: Language;
  targetRoute: PageRoute;
  targetJobId?: string;
  targetDemoJobId?: string;
  dedupeKey: string;
  deliveryStatus: 'sent' | 'failed' | 'in_app_only';
  errorMessage?: string;
  read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationDeliveryLog {
  id: string;
  notificationBatchId: string;
  recipientUid: string;
  recipientLabel: string;
  recipientRole: 'worker' | 'employer' | 'admin' | 'demo_worker';
  isDemo: boolean;
  category: NotificationCategoryKey;
  title: string;
  body: string;
  language: Language;
  targetUrl: string;
  status: 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  fcmMessageId?: string;
  sentByUid: string;
  createdAt?: unknown;
}

export interface DemoWorkerAccount {
  id: string;
  adminUid: string;
  assignedUid?: string;
  name: string;
  maskedMobile: string;
  primarySkill: string;
  skills: string[];
  state: string;
  district: string;
  cityOrVillage: string;
  preferredLanguage: Language;
  notificationsEnabled: boolean;
  status: 'DEMO';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoJobPosting {
  id: string;
  adminUid: string;
  title: string;
  category: string;
  description: string;
  workersRequired: number;
  offeredWage: number;
  wageUnit: WageUnit;
  workType: JobWorkType;
  state: string;
  district: string;
  cityOrVillage: string;
  status: 'open' | 'closed';
  isDemo: true;
  applicationsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoJobApplication {
  id: string;
  demoJobId: string;
  demoJobTitle: string;
  demoAccountId: string;
  applicantUid: string;
  workerName: string;
  proposedWage: number;
  note?: string;
  status: 'applied' | 'reviewed';
  isDemo: true;
  createdAt?: unknown;
  updatedAt?: unknown;
}

