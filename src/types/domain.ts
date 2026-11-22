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
  | 'demo-testing'
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
export type VerificationMethod = 'sms_otp' | 'firebase_phone' | 'test_pin';

export type DealStatus =
  | 'REQUESTED'
  | 'NOTIFIED'
  | 'OFFER_RECEIVED'
  | 'OFFER_ACCEPTED'
  | 'DEAL_CONFIRMED'
  | 'WORK_IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type DealNotificationEventType =
  | 'hiring_request_created'
  | 'worker_offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'job_request_accepted'
  | 'job_request_rejected'
  | 'customer_message'
  | 'worker_message'
  | 'customer_location_shared'
  | 'worker_location_shared'
  | 'deal_confirmed'
  | 'work_started'
  | 'work_completed'
  | 'deal_cancelled'
  | 'worker_quotation'
  | 'booking_accepted'
  | 'worker_arrived'
  | 'job_completed'
  | 'booking_cancelled'
  | 'new_application';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  preferredLanguage: Language;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ServiceRadiusKm = 5 | 10 | 20 | 30;

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
  photoDocId?: string;
  preferredLanguage?: Language;
  preferredRadiusKm?: ServiceRadiusKm;
  voiceAlertsEnabled?: boolean;
  completedJobsCount: number;
  ratingAvg: number;
  lastRatedApplicationId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkerPrivateInfo {
  ownerUid: string;
  fullName: string;
  mobile: string;
  mobileVerified: boolean;
  verificationMethod?: VerificationMethod;
  testPinHash?: string;
  email?: string;
  ageConfirmed: boolean;
  preferredWorkLocation?: string;
  liveLocationConsent: boolean;
  privacyConsent: boolean;
  idVerificationStatus: 'not_submitted' | 'voluntary_pending' | 'verified';
  certificateNotes?: string;
  photoUrl?: string;
  photoDocId?: string;
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
  verificationMethod?: VerificationMethod;
  testPinHash?: string;
  email: string;
  businessAddress: string;
  gstNumber?: string;
  establishmentDetails?: string;
  workforceNotes?: string;
  photoDocId?: string;
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
  workPhotoUrls?: string[];
  orderKind?: 'work' | 'bike_transport';
  pickupLocationLabel?: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationLocationLabel?: string;
  destinationLat?: number;
  destinationLng?: number;
  transportItemType?: 'person' | 'goods';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'flagged';
  dealStatus?: DealStatus;
  acceptedApplicationId?: string;
  acceptedWorkerUid?: string;
  notifiedWorkerUids?: string[];
  approxLocationLabel?: string;
  initialRadiusKm?: ServiceRadiusKm;
  currentRadiusKm?: ServiceRadiusKm;
  radiusStageUpdatedAt?: unknown;
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
  workerPhotoDocId?: string;
  proposedWage: number;
  note?: string;
  status: 'applied' | 'invited' | 'accepted' | 'declined' | 'work_completed';
  dealStatus?: DealStatus;
  initiatedBy?: 'customer_invite' | 'customer_broadcast' | 'worker_apply';
  jobCategory?: string;
  jobDistrict?: string;
  jobLocationLabel?: string;
  jobDate?: string;
  startTime?: string;
  customerName?: string;
  offerAmount?: number;
  travelCharges?: number;
  estimatedArrivalTime?: string;
  offerMessage?: string;
  offerSubmittedAt?: unknown;
  agreedPrice?: number;
  dealConfirmedAt?: unknown;
  workStartedAt?: unknown;
  completedAt?: unknown;
  cancelledAt?: unknown;
  cancelledByUid?: string;
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
  verificationMethod?: VerificationMethod;
  testPinHash?: string;
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

export type NotificationToneType =
  | 'new_job'
  | 'new_offer'
  | 'deal_accepted'
  | 'deal_completed'
  | 'deal_cancelled'
  | 'general';

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
  voiceAlertsEnabled?: boolean;
  soundEnabled?: boolean;
  toneNewJobEnabled?: boolean;
  toneNewOfferEnabled?: boolean;
  toneDealConfirmedEnabled?: boolean;
  toneDealClosedEnabled?: boolean;
  preferredCategories?: string[];
  preferredRadiusKm?: ServiceRadiusKm;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotificationRecord {
  id: string;
  recipientUid: string;
  recipientRole: 'worker' | 'employer' | 'admin' | 'demo_worker';
  senderUid?: string;
  senderName?: string;
  isDemo: boolean;
  category: NotificationCategoryKey;
  eventType?: DealNotificationEventType | string;
  toneType?: NotificationToneType;
  dealStatus?: DealStatus;
  title: string;
  body: string;
  voiceScript?: string;
  approxLocationLabel?: string;
  distanceKm?: number;
  customerName?: string;
  jobCategory?: string;
  playSound?: boolean;
  speakVoice?: boolean;
  metadataLabel?: string;
  language: Language;
  targetRoute: PageRoute;
  targetJobId?: string;
  targetApplicationId?: string;
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

export type DemoUserRole = 'customer' | 'worker';
export type DemoLocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'manual_fallback';
export type DemoLocationSource = 'gps' | 'search' | 'manual_test';
export type DemoShareSource = 'gps_watch' | 'gps_once' | 'simulated_move';

export type DemoWorkOrderStatus =
  | 'requested'
  | 'accepted'
  | 'customer_confirmed'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'declined'
  | 'cancelled';

export interface DemoModeConfig {
  id?: string;
  enabled: boolean;
  testOnlyOtpMode: boolean;
  maxUsers: number;
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoUserProfile {
  id: string;
  uniqueUserId: string;
  ownerUid: string;
  slotLabel?: string;
  deviceLabel?: string;
  testPinHash?: string;
  role: DemoUserRole;
  category: string;
  displayName: string;
  mobile10: string;
  maskedMobile: string;
  testVerificationStatus: 'demo_test_verified';
  availabilityStatus: 'available' | 'busy' | 'offline';
  state: string;
  district: string;
  cityOrVillage: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  locationPermissionStatus: DemoLocationPermissionStatus;
  locationSource: DemoLocationSource;
  photoDocId?: string;
  pushEnabled?: boolean;
  isDemo: true;
  lastActiveAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoWorkOrder {
  id: string;
  orderCode: string;
  ownerUid: string;
  customerDemoUserId: string;
  customerName: string;
  customerUniqueId: string;
  serviceCategory: string;
  title: string;
  description: string;
  state: string;
  district: string;
  cityOrVillage: string;
  requestLat: number;
  requestLng: number;
  offeredWage: number;
  wageUnit: WageUnit;
  status: DemoWorkOrderStatus;
  matchedWorkerIds: string[];
  matchedWorkerOwnerUids: string[];
  rejectedWorkerIds: string[];
  acceptedWorkerId?: string;
  acceptedWorkerOwnerUid?: string;
  acceptedWorkerName?: string;
  acceptedWorkerUniqueId?: string;
  acceptedWorkerPhotoDocId?: string;
  customerConfirmedAt?: unknown;
  completedAt?: unknown;
  closedAt?: unknown;
  customerLocationSharing: boolean;
  workerLocationSharing: boolean;
  completionNotes?: string;
  workerRating?: number;
  isDemo: true;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoLiveLocationShare {
  id: string;
  orderId: string;
  ownerUid: string;
  authorizedOwnerUids: string[];
  demoUserId: string;
  participantRole: 'customer' | 'worker';
  participantName: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  sharingActive: boolean;
  permissionState: DemoLocationPermissionStatus;
  source: DemoShareSource;
  isDemo: true;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DemoNotificationRecord {
  id: string;
  dedupeKey: string;
  recipientDemoUserId: string;
  recipientName: string;
  recipientRole: DemoUserRole;
  recipientOwnerUid: string;
  senderOwnerUid: string;
  ownerUid: string;
  orderId: string;
  eventType:
    | 'job_request'
    | 'job_accepted'
    | 'customer_confirmed'
    | 'job_started'
    | 'job_rejected'
    | 'job_completed'
    | 'deal_closed'
    | 'location_started'
    | 'location_stopped';
  title: string;
  body: string;
  inAppDelivered: boolean;
  browserNotificationStatus: 'delivered' | 'permission_default' | 'permission_denied' | 'unsupported';
  fcmPushStatus: 'sent' | 'failed' | 'skipped_no_token';
  fcmErrorReason?: string;
  read: boolean;
  isDemo: true;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProfilePhotoRecord {
  id?: string;
  ownerUid: string;
  subjectId: string;
  role: 'worker' | 'customer';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  photoData: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcceptedCustomerPhotoRecord {
  id?: string;
  ownerUid: string;
  workerUid: string;
  sourceType: 'job_application' | 'demo_work_order';
  sourceId: string;
  photoData: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DealMessage {
  id: string;
  applicationId: string;
  jobId: string;
  employerUid: string;
  workerUid: string;
  senderUid: string;
  senderRole: 'customer' | 'worker';
  senderName: string;
  text: string;
  createdAt?: unknown;
}

export interface DealLocationShare {
  id: string;
  applicationId: string;
  jobId: string;
  ownerUid: string;
  authorizedUids: string[];
  role: 'customer' | 'worker';
  participantName: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  sharingActive: boolean;
  source: 'gps_watch' | 'gps_once' | 'manual_pin' | 'simulated_move';
  createdAt?: unknown;
  updatedAt?: unknown;
}

