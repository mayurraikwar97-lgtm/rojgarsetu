import type { Language } from '../types/domain';

export interface TranslationBundle {
  brand: {
    name: string;
    slogan: string;
    supporting: string;
    disclaimerShort: string;
    initiativeLine: string;
    dignityLine: string;
  };
  nav: {
    home: string;
    about: string;
    findWork: string;
    findWorkers: string;
    skills: string;
    opportunities: string;
    employerReg: string;
    partnerships: string;
    pricing: string;
    trustSafety: string;
    contact: string;
    loginRegister: string;
    workerDashboard: string;
    employerDashboard: string;
    adminPanel: string;
    more: string;
    signIn: string;
    signOut: string;
  };
  hero: {
    heading: string;
    subheading: string;
    ctaWorker: string;
    ctaEmployer: string;
    campaignNote: string;
    imageCaption: string;
  };
  mission: {
    heading: string;
    intro: string;
    points: { title: string; desc: string }[];
  };
  dignitySection: {
    kicker: string;
    heading: string;
    quote: string;
    body: string;
    attributionNote: string;
  };
  categories: {
    heading: string;
    subheading: string;
    searchPlaceholder: string;
    allGroups: string;
    groups: Record<string, string>;
    exploreAction: string;
    noResults: string;
  };
  howItWorks: {
    heading: string;
    subheading: string;
    steps: { step: string; title: string; desc: string }[];
  };
  forWorkers: {
    heading: string;
    subheading: string;
    benefits: string[];
    cta: string;
  };
  forEmployers: {
    heading: string;
    subheading: string;
    features: string[];
    cta: string;
  };
  mapSection: {
    heading: string;
    subheading: string;
    stateLabel: string;
    districtLabel: string;
    cityLabel: string;
    radiusLabel: string;
    allStates: string;
    allDistricts: string;
    allIndia: string;
    layerJobs: string;
    layerWorkers: string;
    consentTitle: string;
    consentDesc: string;
    useMyLocation: string;
    clearLocation: string;
    privacyNote: string;
    distanceUnit: string;
    fallbackBanner: string;
  };
  womenInclusive: {
    heading: string;
    subheading: string;
    cards: { title: string; desc: string }[];
  };
  skillsTraining: {
    heading: string;
    subheading: string;
    govtNotice: string;
    partnerNotice: string;
    tabs: { govt: string; vocational: string; apprenticeship: string };
    items: {
      type: 'govt' | 'vocational' | 'apprenticeship';
      title: string;
      org: string;
      desc: string;
      badge: string;
    }[];
  };
  impact: {
    heading: string;
    subheading: string;
    launchNotice: string;
    metrics: {
      workers: string;
      activeWorkers: string;
      employers: string;
      jobsPosted: string;
      applications: string;
      completed: string;
      womenWorkers: string;
    };
    stateDistribution: string;
    districtDistribution: string;
    noDataYet: string;
  };
  workerForm: {
    title: string;
    subtitle: string;
    authRequiredTitle: string;
    authRequiredDesc: string;
    signInBtn: string;
    fullName: string;
    mobile: string;
    sendOtp: string;
    verifyOtp: string;
    otpPlaceholder: string;
    otpVerified: string;
    emailOpt: string;
    state: string;
    district: string;
    cityVillage: string;
    currentLocationOpt: string;
    captureCoords: string;
    photoOpt: string;
    genderOpt: string;
    ageConfirm: string;
    education: string;
    primarySkill: string;
    additionalSkills: string;
    addSkillPlaceholder: string;
    addSkillBtn: string;
    experienceYears: string;
    expectedWage: string;
    wageUnit: string;
    preferredWorkType: string;
    availability: string;
    preferredWorkLocation: string;
    languagesKnown: string;
    certificatesOpt: string;
    idStatus: string;
    idNotice: string;
    privacyConsent: string;
    liveLocConsent: string;
    submitBtn: string;
    updateBtn: string;
    successMsg: string;
    uniqueIdLabel: string;
  };
  employerForm: {
    title: string;
    subtitle: string;
    businessName: string;
    contactPerson: string;
    mobile: string;
    email: string;
    state: string;
    district: string;
    businessAddress: string;
    businessType: string;
    industryCategory: string;
    establishmentDetails: string;
    gstOpt: string;
    requiredCategories: string;
    workforceNotes: string;
    submitBtn: string;
    successMsg: string;
  };
  jobs: {
    postTitle: string;
    postSubtitle: string;
    jobTitle: string;
    category: string;
    description: string;
    workersRequired: string;
    requiredSkills: string;
    workLocationLabel: string;
    jobDate: string;
    startTime: string;
    duration: string;
    workType: string;
    offeredWage: string;
    paymentTerms: string;
    contactPref: string;
    womenFriendly: string;
    accessibleWork: string;
    allowQuotes: string;
    publishBtn: string;
    applyBtn: string;
    appliedLabel: string;
    proposedWageLabel: string;
    noteLabel: string;
    submitApplication: string;
    searchPlaceholder: string;
    noJobs: string;
    workersUnit: string;
  };
  dashboards: {
    workerTitle: string;
    employerTitle: string;
    adminTitle: string;
    profileStatus: string;
    myApplications: string;
    openOpportunities: string;
    liveTrackingToggle: string;
    liveTrackingNotice: string;
    postedJobs: string;
    receivedApplications: string;
    acceptBtn: string;
    declineBtn: string;
    completeBtn: string;
    ratingLabel: string;
    feedbackLabel: string;
    exportCsv: string;
    adminVerify: string;
    adminSuspend: string;
    adminRestore: string;
    auditLogs: string;
    announcements: string;
    enquiries: string;
    grievances: string;
  };
  about: {
    title: string;
    body1: string;
    body2: string;
    body3: string;
    foundationNote: string;
    visionTitle: string;
    visionBody: string;
    missionTitle: string;
    missionBody: string;
    objectivesTitle: string;
    objectives: string[];
    orgInfoTitle: string;
    founderLabel: string;
    registrationLabel: string;
    officeLabel: string;
    contactLabel: string;
    toBeConfirmed: string;
  };
  partnerships: {
    title: string;
    subtitle: string;
    disclaimer: string;
    collaborationListTitle: string;
    collaborators: string[];
    dprTitle: string;
    dprDesc: string;
    dprBtn: string;
    formTitle: string;
    orgName: string;
    deptInst: string;
    contactPerson: string;
    designation: string;
    email: string;
    phone: string;
    interest: string;
    message: string;
    attachment: string;
    submitBtn: string;
    successMsg: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    campaignTitle: string;
    campaignDesc: string;
    rulesTitle: string;
    rules: string[];
    modelsTitle: string;
    models: { title: string; audience: string; desc: string }[];
  };
  trustSafety: {
    title: string;
    subtitle: string;
    platformDisclaimer: string;
    tabs: {
      privacy: string;
      terms: string;
      workerGuide: string;
      employerGuide: string;
      refund: string;
      safety: string;
      grievance: string;
      faq: string;
    };
    reportTitle: string;
    reportCategory: string;
    reportTarget: string;
    reportSubject: string;
    reportDesc: string;
    reportSubmit: string;
    reportSuccess: string;
  };
  contact: {
    title: string;
    subtitle: string;
    helplineLabel: string;
    emailLabel: string;
    officeLabel: string;
    hoursLabel: string;
    supportNote: string;
  };
  common: {
    loading: string;
    save: string;
    cancel: string;
    close: string;
    filter: string;
    reset: string;
    required: string;
    optional: string;
    installApp: string;
    offlineBanner: string;
    verified: string;
    pending: string;
    suspended: string;
    signInRequired: string;
    noRecords: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationBundle> = {
  en: {
    brand: {
      name: 'ROJGAR SETU',
      slogan: 'Every Hand Deserves an Opportunity.',
      supporting: "India's A to Z Work & Employment Network.",
      disclaimerShort: 'ROJGAR SETU · Independent non-government social-impact platform',
      initiativeLine: 'An independent employment and workforce connectivity platform for India.',
      dignityLine: 'Designed to promote dignity of labour, inclusive employment and digital access to work opportunities.',
    },
    nav: {
      home: 'Home',
      about: 'About Us',
      findWork: 'Find Work',
      findWorkers: 'Find Workers',
      skills: 'Skills & Training',
      opportunities: 'Employment Opportunities',
      employerReg: 'Employer Registration',
      partnerships: 'Govt. & Institutional Partnerships',
      pricing: 'Pricing & Transparency',
      trustSafety: 'Trust, Safety & Policies',
      contact: 'Contact Us',
      loginRegister: 'Login / Register',
      workerDashboard: 'Worker Dashboard',
      employerDashboard: 'Employer Dashboard',
      adminPanel: 'Admin Panel',
      more: 'More',
      signIn: 'Sign In with Google',
      signOut: 'Sign Out',
    },
    hero: {
      heading: 'Find Work. Discover Talent. Build a Better Future.',
      subheading: 'ROJGAR SETU connects workers, skilled professionals, job seekers, businesses and employers through one digital employment platform.',
      ctaWorker: 'REGISTER AS A WORKER',
      ctaEmployer: 'HIRE A WORKER',
      campaignNote: 'Registration Campaign Live — Registrations are open now; bookings & transactions start from 1 January.',
      imageCaption: 'Skilled trades, artisans, and technical workers across India building livelihoods with dignity.',
    },
    mission: {
      heading: 'Connecting Every Worker to Opportunity',
      intro: 'ROJGAR SETU is built to make employment discovery simpler, more transparent, and accessible across urban centres and rural districts alike.',
      points: [
        { title: 'Employment Accessibility', desc: 'Simple multilingual digital access for workers across literacy and technical backgrounds.' },
        { title: 'Digital Worker Registration', desc: 'Create a structured digital profile with a unique Worker Registration ID at zero fee during launch.' },
        { title: 'Skilled & Unskilled Connectivity', desc: 'Equal visibility for certified technicians, daily-wage workers, helpers, and specialized artisans.' },
        { title: 'Rural & Urban Opportunities', desc: 'District and village-level discovery bridging local livelihoods with industrial demand.' },
        { title: "Women's Participation", desc: 'Dedicated pathways for women workers, self-help groups, home-based work, and women entrepreneurs.' },
        { title: 'Youth Employment', desc: 'Connecting young job seekers with apprenticeships, entry-level roles, and vocational skilling.' },
        { title: 'Self-Employment Pathways', desc: 'Enabling independent technicians, freelancers, and local service providers to receive direct bookings.' },
        { title: 'Industrial & Business Demand', desc: 'Helping MSMEs, factories, contractors, shops, and households find reliable local talent.' },
      ],
    },
    dignitySection: {
      kicker: 'Dignity of Labour & Self-Reliance',
      heading: 'Honouring Every Craft, Every Skill, and Every Working Hand',
      quote: 'Work performed with honesty, skill, and self-reliance strengthens both the individual household and the nation.',
      body: 'Inspired by India’s enduring tradition of self-reliance and respect for manual and skilled labour, ROJGAR SETU upholds equal dignity for every profession—from agricultural hands and weavers to industrial operators and engineers.',
      attributionNote: 'Historical reference to Mahatma Gandhi is presented purely as cultural inspiration on the dignity of labour and does not imply endorsement or founding association.',
    },
    categories: {
      heading: 'Employment Categories — A to Z',
      subheading: 'Browse 32 structured workforce categories. Search by trade, skill, or sector and register multiple skills under a single profile.',
      searchPlaceholder: 'Search category or skill (e.g., Electrician, Tractor, Welding, Caregiver)...',
      allGroups: 'All Categories',
      groups: {
        trades: 'Construction & Trades',
        industrial: 'Industrial & Technical',
        transport: 'Transport & Delivery',
        agriculture: 'Agriculture & Rural',
        hospitality: 'Domestic & Hospitality',
        office: 'Office & Digital',
        services: 'Care, Retail & Education',
        enterprise: 'Self-Employed & Women-Led',
      },
      exploreAction: 'Find Opportunities',
      noResults: 'No matching categories found. Try another keyword.',
    },
    howItWorks: {
      heading: 'How ROJGAR SETU Works',
      subheading: 'A transparent four-step workflow connecting workers and employers directly.',
      steps: [
        { step: '01', title: 'Register', desc: 'Workers and employers create verified digital profiles with skills, location, and requirements.' },
        { step: '02', title: 'Discover', desc: 'Workers explore nearby opportunities and employers search verified talent by skill and distance.' },
        { step: '03', title: 'Connect', desc: 'Both sides communicate, review wage terms or quotations, and confirm work arrangements.' },
        { step: '04', title: 'Complete Work', desc: 'Work is completed safely, feedback is recorded, and verified work history builds lasting trust.' },
      ],
    },
    forWorkers: {
      heading: 'For Workers & Job Seekers',
      subheading: 'Built to give every worker a permanent, respectful digital identity and direct access to fair opportunities.',
      benefits: [
        'Free initial registration with zero hidden charges',
        'Personal digital worker profile with unique Registration ID',
        'Register multiple skills in one profile',
        'Real-time employment opportunity notifications',
        'Nearby work discovery by district, village, or radius',
        'Full-time, part-time, daily-wage & contract roles',
        'Self-employment & independent service visibility',
        'Verified work history, experience & skill credentials',
        'Transparent ratings, reviews & fee disclosure',
        'Direct access to government & partner skilling information',
      ],
      cta: 'REGISTER AS A WORKER',
    },
    forEmployers: {
      heading: 'For Employers, Contractors & Businesses',
      subheading: 'Find reliable local workers, technical specialists, or full teams for households, shops, MSMEs, and industrial sites.',
      features: [
        'Post full-time, part-time, daily-wage, contract, or urgent bulk requirements',
        'Search workers by skill, experience, and language',
        'Discover nearby talent across states and districts',
        'View worker capability profiles & verified work records',
        'Specify offered wages, duration, and payment terms upfront',
        'Request multiple workers or specialized teams',
        'Receive direct applications and wage quotations',
        'Compare profiles, availability, and ratings side-by-side',
        'Confirm bookings and record completion transparently',
      ],
      cta: 'REGISTER AS AN EMPLOYER',
    },
    mapSection: {
      heading: 'Location-Based Employment Map',
      subheading: 'Explore district-level employment opportunities and available workforce categories across India with privacy-first location controls.',
      stateLabel: 'Select State',
      districtLabel: 'Select District',
      cityLabel: 'City / Town / Village',
      radiusLabel: 'Search Radius',
      allStates: 'All States',
      allDistricts: 'All Districts',
      allIndia: 'All India',
      layerJobs: 'Job Opportunities',
      layerWorkers: 'Registered Workforce (Approx. Area)',
      consentTitle: 'Location Permission & Privacy',
      consentDesc: 'Sharing your browser location is optional and used only locally to calculate approximate distance in kilometres. Your precise coordinates are never exposed publicly.',
      useMyLocation: 'Use My Approximate Location',
      clearLocation: 'Clear My Location',
      privacyNote: 'Privacy safeguard: Public maps show only district/town-level coordinates. Precise worker tracking is disabled by default and activates only inside a confirmed booking when explicitly authorized by the worker.',
      distanceUnit: 'km away',
      fallbackBanner: 'Interactive Google Maps is initializing or awaiting API key configuration; district coordinate explorer remains active below.',
    },
    womenInclusive: {
      heading: 'Women & Inclusive Employment',
      subheading: 'Expanding safe, dignified, and flexible livelihoods for women, self-help groups, and persons with disabilities.',
      cards: [
        { title: 'Women Employment Pathways', desc: 'Filter for women-friendly workplaces, verified establishments, and daytime shifts.' },
        { title: 'Work-From-Home & Flexible Work', desc: 'Tailoring, digital data entry, tutoring, and home-based craft production opportunities.' },
        { title: 'Women-Led Enterprises & SHGs', desc: 'Dedicated visibility for women entrepreneurs, cooperative units, and rural artisans.' },
        { title: 'Safe Workplace Standards', desc: 'Mandatory employer safety commitments and dedicated harassment reporting channels.' },
        { title: 'Accessible Opportunities (PwD)', desc: 'Filter roles designed with workplace accessibility for persons with disabilities.' },
      ],
    },
    skillsTraining: {
      heading: 'Skills, Vocational Training & Schemes',
      subheading: 'Explore skill development pathways, apprenticeships, and certification information.',
      govtNotice: 'Official Public Scheme Reference — Links to verified Government of India initiatives for citizen awareness. ROJGAR SETU is not a government portal.',
      partnerNotice: 'General Training & Community Initiatives — Non-government vocational centres and employer apprenticeship tracks.',
      tabs: {
        govt: 'Government Skill Schemes',
        vocational: 'Vocational & Trade Training',
        apprenticeship: 'Apprenticeships & Certification',
      },
      items: [
        { type: 'govt', title: 'Pradhan Mantri Kaushal Vikas Yojana (PMKVY)', org: 'Ministry of Skill Development & Entrepreneurship (Govt. Reference)', desc: 'Short-term skill training and Recognition of Prior Learning (RPL) certification across 30+ sectors.', badge: 'Official Govt. Scheme Info' },
        { type: 'govt', title: 'Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)', org: 'Ministry of Rural Development (Govt. Reference)', desc: 'Placement-linked skill training aimed at rural youth from low-income households.', badge: 'Official Govt. Scheme Info' },
        { type: 'govt', title: 'National Apprenticeship Promotion Scheme (NAPS)', org: 'Directorate General of Training (Govt. Reference)', desc: 'On-the-job industrial apprenticeship training with stipend support in factories and MSMEs.', badge: 'Official Govt. Scheme Info' },
        { type: 'vocational', title: 'Solar Rooftop & Electrical Safety Workshop', org: 'Partner Skill Centre Network (Third-Party)', desc: 'Hands-on training in domestic wiring, inverter installation, and multimeter diagnostics.', badge: 'Partner Training' },
        { type: 'vocational', title: 'Women Self-Help Micro-Enterprise & Garment Craft', org: 'ROJGAR SETU Community Livelihood Track', desc: 'Practical training in commercial stitching, packaging, hygiene, and digital bookkeeping.', badge: 'Community Initiative' },
        { type: 'apprenticeship', title: 'Industrial CNC & Welding Shop-Floor Apprenticeship', org: 'MSME Industry Cluster Partners', desc: '6-month supervised floor training for ITI graduates and experienced helpers.', badge: 'Apprenticeship Track' },
      ],
    },
    impact: {
      heading: 'Employment Impact Dashboard',
      subheading: 'Live, verifiable platform figures computed directly from registered records—never fabricated or estimated.',
      launchNotice: 'Live Platform Data: Counts reflect real verified records in the database. Zero indicates initial pre-launch / early campaign phase.',
      metrics: {
        workers: 'Total Registered Workers',
        activeWorkers: 'Active Available Workers',
        employers: 'Registered Employers',
        jobsPosted: 'Jobs Posted',
        applications: 'Applications & Invites',
        completed: 'Jobs Successfully Completed',
        womenWorkers: 'Women Registered',
      },
      stateDistribution: 'State-Wise Employment Opportunities',
      districtDistribution: 'District-Wise Workforce Distribution',
      noDataYet: 'Data will appear automatically as registrations and postings are created.',
    },
    workerForm: {
      title: 'Worker Registration & Skill Profile',
      subtitle: 'Register free during the initial registration campaign. Add multiple skills and manage your work preferences.',
      authRequiredTitle: 'Sign in with Google to Save Your Official Worker Profile',
      authRequiredDesc: 'To protect your data and issue a unique Worker Registration ID, please sign in with your verified Google account.',
      signInBtn: 'Sign In with Google',
      fullName: 'Full Name',
      mobile: 'Mobile Number (10 digits)',
      sendOtp: 'Send OTP',
      verifyOtp: 'Verify OTP',
      otpPlaceholder: '6-digit OTP',
      otpVerified: 'Mobile Verified',
      emailOpt: 'Email Address (Optional)',
      state: 'State',
      district: 'District',
      cityVillage: 'City / Town / Village',
      currentLocationOpt: 'Current Location Coordinates (Optional & Consent-Based)',
      captureCoords: 'Use Approximate Location',
      photoOpt: 'Profile Photo URL (Optional)',
      genderOpt: 'Gender (Optional)',
      ageConfirm: 'I confirm that I am 18 years of age or older and legally eligible to work.',
      education: 'Education Level',
      primarySkill: 'Primary Skill / Trade Category',
      additionalSkills: 'Additional Skills (Multi-skill profile)',
      addSkillPlaceholder: 'Type skill (e.g., Solar Wiring, Pipe Fitting)',
      addSkillBtn: 'Add Skill',
      experienceYears: 'Work Experience (Years)',
      expectedWage: 'Expected Wage / Salary (INR)',
      wageUnit: 'Wage Basis',
      preferredWorkType: 'Preferred Work Type',
      availability: 'Current Availability',
      preferredWorkLocation: 'Preferred Work Location / Travel Area',
      languagesKnown: 'Languages Known (comma-separated)',
      certificatesOpt: 'Skill Certificates / Trade Details (Optional)',
      idStatus: 'Voluntary Identity Verification',
      idNotice: 'Aadhaar or sensitive identity documents are NOT required. Any future identity verification is strictly voluntary, lawful, and consent-based.',
      privacyConsent: 'I agree to the ROJGAR SETU Privacy Policy & Worker Guidelines, and consent to showing my non-personal skill profile to employers.',
      liveLocConsent: 'Allow booking-based location sharing only when I explicitly accept and authorize tracking for a specific confirmed job (off by default).',
      submitBtn: 'Complete Worker Registration',
      updateBtn: 'Update Worker Profile',
      successMsg: 'Your Worker Registration has been saved successfully.',
      uniqueIdLabel: 'Worker Registration ID',
    },
    employerForm: {
      title: 'Employer & Business Registration',
      subtitle: 'Register your company, factory, shop, contractor unit, institution, or household to post jobs and hire talent.',
      businessName: 'Employer / Business / Household Name',
      contactPerson: 'Contact Person Full Name',
      mobile: 'Mobile Number (10 digits)',
      email: 'Official Email Address',
      state: 'State',
      district: 'District',
      businessAddress: 'Business / Worksite Address (kept private)',
      businessType: 'Business / Establishment Type',
      industryCategory: 'Industry Category',
      establishmentDetails: 'Company / Establishment Registration Details (Optional)',
      gstOpt: 'GST Number (Optional, if applicable)',
      requiredCategories: 'Required Worker Categories',
      workforceNotes: 'Typical Workforce Requirements',
      submitBtn: 'Complete Employer Registration',
      successMsg: 'Employer profile saved successfully. You can now post job requirements.',
    },
    jobs: {
      postTitle: 'Post a New Job Requirement',
      postSubtitle: 'Specify required skills, wage terms, duration, and location clearly.',
      jobTitle: 'Job Title',
      category: 'Job Category',
      description: 'Job Description & Responsibilities',
      workersRequired: 'Number of Workers Required',
      requiredSkills: 'Required Skills (comma-separated)',
      workLocationLabel: 'Worksite Locality / Landmark',
      jobDate: 'Start Date',
      startTime: 'Reporting Time',
      duration: 'Duration (e.g., 5 days, Full-time)',
      workType: 'Engagement Type',
      offeredWage: 'Offered Wage (INR)',
      paymentTerms: 'Payment Terms (e.g., Daily evening cash/UPI, Monthly 5th)',
      contactPref: 'Communication Preference',
      womenFriendly: 'Women-friendly & safe workplace',
      accessibleWork: 'Accessible for Persons with Disabilities (PwD)',
      allowQuotes: 'Allow workers to submit wage quotations',
      publishBtn: 'Publish Job Requirement',
      applyBtn: 'Apply / Submit Quotation',
      appliedLabel: 'Application Submitted',
      proposedWageLabel: 'Your Expected / Quoted Wage (INR)',
      noteLabel: 'Message / Experience Note to Employer',
      submitApplication: 'Confirm Application',
      searchPlaceholder: 'Search jobs by title, skill, district, or employer...',
      noJobs: 'No matching job postings found yet. Employers can post opportunities directly from the Employer portal.',
      workersUnit: 'workers needed',
    },
    dashboards: {
      workerTitle: 'Worker Workspace & Applications',
      employerTitle: 'Employer Workspace & Hiring Console',
      adminTitle: 'ROJGAR SETU Administration Console',
      profileStatus: 'Profile Verification',
      myApplications: 'My Applications & Bookings',
      openOpportunities: 'Matching Opportunities',
      liveTrackingToggle: 'Authorize Booking Location Sharing',
      liveTrackingNotice: 'Shared only with this employer for this accepted booking. Can be revoked immediately.',
      postedJobs: 'Your Posted Requirements',
      receivedApplications: 'Worker Applications & Quotations',
      acceptBtn: 'Accept & Confirm',
      declineBtn: 'Decline',
      completeBtn: 'Mark Completed & Rate',
      ratingLabel: 'Work Rating (1–5)',
      feedbackLabel: 'Completion Feedback',
      exportCsv: 'Export CSV Report',
      adminVerify: 'Verify Profile',
      adminSuspend: 'Suspend Account',
      adminRestore: 'Restore Account',
      auditLogs: 'Administrative Audit Logs',
      announcements: 'Announcements & Banners',
      enquiries: 'Govt. Partnership Enquiries',
      grievances: 'Grievance & Safety Queue',
    },
    about: {
      title: 'About ROJGAR SETU',
      body1: 'ROJGAR SETU is an employment and workforce connectivity initiative designed to connect India’s skilled and unskilled workforce with businesses, industries, institutions and individuals seeking workers.',
      body2: 'The platform aims to reduce the gap between people seeking work and those providing employment opportunities. It promotes digital inclusion, skill visibility, local employment discovery, women’s participation and better access to work opportunities.',
      body3: 'ROJGAR SETU is built as an independent social-impact employment platform dedicated to transparent workforce connectivity and dignity of labour across India.',
      foundationNote: 'Important Notice: ROJGAR SETU is a private social-impact initiative and is NOT a government website, government department, or government-endorsed portal.',
      visionTitle: 'Our Vision',
      visionBody: 'To build an inclusive digital employment ecosystem connecting India’s workforce with businesses, industries, households, contractors and institutions.',
      missionTitle: 'Our Mission',
      missionBody: 'To create a unified digital platform where every individual can register their skills, discover employment opportunities, connect with employers and access work opportunities regardless of their location, education level or professional background.',
      objectivesTitle: 'Core Objectives & Social Impact',
      objectives: [
        'Bridge local discovery gaps between rural/urban workers and employers.',
        'Eliminate opaque middlemen by allowing transparent wage disclosure and direct matching.',
        'Champion dignity of labour across all 32 skilled and unskilled trades.',
        'Support women’s economic participation and accessible livelihoods.',
      ],
      orgInfoTitle: 'Platform & Governance Information',
      founderLabel: 'Platform Name',
      registrationLabel: 'Legal Registration Details',
      officeLabel: 'Registered Office Address',
      contactLabel: 'Official Contact Desk',
      toBeConfirmed: 'Pending formal confirmation & publication by ROJGAR SETU.',
    },
    partnerships: {
      title: 'Government & Institutional Partnerships',
      subtitle: 'ROJGAR SETU welcomes structured dialogue with public departments, district administrations, industry bodies, and NGOs to expand grassroots livelihood connectivity.',
      disclaimer: 'Transparency Notice: Submission of a partnership enquiry does not imply government approval, government ownership, or an official government partnership.',
      collaborationListTitle: 'Proposed Collaboration Ecosystem',
      collaborators: [
        'Central Government Ministries & Livelihood Missions',
        'State Government Labour & Employment Departments',
        'District Administrations & Rozgar Melas',
        'Skill Development Institutions & ITIs',
        'Industrial Associations & Chambers of Commerce',
        'MSMEs & Manufacturing Clusters',
        'NGOs, SHG Federations & Social Organisations',
        'Educational Institutions & Vocational Training Centres',
      ],
      dprTitle: 'Project Concept & Detailed Project Report (DPR)',
      dprDesc: 'Download the structured ROJGAR SETU Concept Brief for institutional briefings, CSR evaluations, and district pilot discussions.',
      dprBtn: 'Download Concept Brief (TXT/Summary)',
      formTitle: 'Submit Institutional Partnership Enquiry',
      orgName: 'Organisation Name',
      deptInst: 'Department / Institution',
      contactPerson: 'Contact Person',
      designation: 'Designation',
      email: 'Official Email',
      phone: 'Phone Number',
      interest: 'Partnership Interest Area',
      message: 'Proposal / Collaboration Message',
      attachment: 'Supporting Document Filename (Optional)',
      submitBtn: 'Submit Partnership Enquiry',
      successMsg: 'Thank you. Your institutional partnership enquiry has been recorded for review.',
    },
    pricing: {
      title: 'Transparent Revenue Model & Pricing Policy',
      subtitle: 'Clear, worker-first commitments governing initial launch and future sustainable operations.',
      campaignTitle: 'Initial Launch Campaign: Free Worker Registration',
      campaignDesc: 'Workers register completely free of charge during the initial registration campaign and never pay merely to receive job notifications.',
      rulesTitle: 'Mandatory Fair-Fee Principles',
      rules: [
        'No mandatory worker registration fees during the initial campaign.',
        'Workers are never charged merely for receiving job alerts or viewing openings.',
        'Any future optional worker services must be disclosed in advance and explicitly accepted.',
        'Commissions apply only on successfully completed transactions under disclosed terms.',
        'Exact applicable platform fee is always shown clearly before any booking confirmation.',
        'ROJGAR SETU does not promise guaranteed employment unless backed by a specific verified contract.',
      ],
      modelsTitle: 'Proposed Post-Launch Sustainability Channels',
      models: [
        { title: 'Employer Subscriptions', audience: 'For active businesses & MSMEs', desc: 'Monthly hiring plans for factories, contractors, and establishments with recurring needs.' },
        { title: 'Completed-Transaction Fee', audience: 'Transparent service commission', desc: 'Clearly disclosed small facilitation fee applied only upon verified work completion.' },
        { title: 'Bulk & Workforce Coordination', audience: 'For large projects & clusters', desc: 'Managed mobilization and onboarding support for bulk seasonal or industrial hiring.' },
        { title: 'Optional Promotional Listings', audience: 'For urgent visibility', desc: 'Optional highlighted job requirements for time-sensitive employer staffing.' },
      ],
    },
    trustSafety: {
      title: 'Trust, Safety & Transparency Centre',
      subtitle: 'Policies, workplace safety standards, and formal grievance redressal.',
      platformDisclaimer: 'Important Legal Clarification: ROJGAR SETU facilitates connections and opportunities between workers and employers but does not automatically guarantee employment, wages, or work availability.',
      tabs: {
        privacy: 'Privacy Policy',
        terms: 'Terms & Conditions',
        workerGuide: 'Worker Guidelines',
        employerGuide: 'Employer Guidelines',
        refund: 'Cancellation & Refund',
        safety: 'Safety Guidelines',
        grievance: 'Grievance Redressal',
        faq: 'FAQs',
      },
      reportTitle: 'File a Safety, Fraud, or Grievance Report',
      reportCategory: 'Issue Category',
      reportTarget: 'Job ID / Account Reference (Optional)',
      reportSubject: 'Subject',
      reportDesc: 'Detailed Description',
      reportSubmit: 'Submit Grievance Report',
      reportSuccess: 'Your grievance report has been logged with a tracking reference for review.',
    },
    contact: {
      title: 'Contact & Helpdesk',
      subtitle: 'Reach out for worker onboarding assistance, employer verification, or institutional inquiries.',
      helplineLabel: 'Citizen & Worker Support Desk',
      emailLabel: 'Official Communication Email',
      officeLabel: 'ROJGAR SETU Office',
      hoursLabel: 'Support Hours',
      supportNote: 'Monday to Saturday, 9:30 AM – 6:00 PM IST (Multilingual assistance in English, Hindi & Marathi).',
    },
    common: {
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      filter: 'Filter',
      reset: 'Reset',
      required: 'Required',
      optional: 'Optional',
      installApp: 'Install App',
      offlineBanner: 'Offline Mode — Showing cached interface.',
      verified: 'Verified',
      pending: 'Pending Review',
      suspended: 'Suspended',
      signInRequired: 'Please sign in with Google to perform this action.',
      noRecords: 'No records available yet.',
    },
  },
  hi: {
    brand: {
      name: 'रोजगार सेतु',
      slogan: 'हर हाथ को काम, हर हुनर को सम्मान!',
      supporting: 'भारत का A से Z कार्य एवं रोजगार नेटवर्क।',
      disclaimerShort: 'रोजगार सेतु · एक स्वतंत्र सामाजिक पहल · यह सरकारी पोर्टल नहीं है',
      initiativeLine: 'भारत के लिए एक स्वतंत्र रोजगार एवं कार्यबल संपर्क मंच।',
      dignityLine: 'श्रम की गरिमा, समावेशी रोजगार और काम के अवसरों तक डिजिटल पहुंच को बढ़ावा देने हेतु निर्मित।',
    },
    nav: {
      home: 'मुख्य पृष्ठ',
      about: 'हमारे बारे में',
      findWork: 'काम खोजें',
      findWorkers: 'कामगार खोजें',
      skills: 'कौशल एवं प्रशिक्षण',
      opportunities: 'रोजगार के अवसर',
      employerReg: 'नियोक्ता पंजीकरण',
      partnerships: 'सरकारी एवं संस्थागत साझेदारी',
      pricing: 'शुल्क एवं पारदर्शिता',
      trustSafety: 'विश्वास, सुरक्षा एवं नीतियां',
      contact: 'संपर्क करें',
      loginRegister: 'लॉगिन / पंजीकरण',
      workerDashboard: 'कामगार डैशबोर्ड',
      employerDashboard: 'नियोक्ता डैशबोर्ड',
      adminPanel: 'प्रशासन पैनल',
      more: 'अन्य',
      signIn: 'Google से साइन इन करें',
      signOut: 'लॉग आउट',
    },
    hero: {
      heading: 'काम खोजें। प्रतिभा खोजें। बेहतर भविष्य बनाएं।',
      subheading: 'रोजगार सेतु एक ही डिजिटल मंच के माध्यम से कामगारों, कुशल पेशेवरों, रोजगार चाहने वालों, व्यवसायों और नियोक्ताओं को जोड़ता है।',
      ctaWorker: 'कामगार के रूप में पंजीकरण करें',
      ctaEmployer: 'कामगार नियुक्त करें',
      campaignNote: 'अभी केवल पंजीकरण शुरू है — 1 जनवरी से सभी व्यवहार और बुकिंग शुरू होंगी।',
      imageCaption: 'भारत भर के कुशल कारीगर, तकनीशियन और श्रमिक सम्मानजनक आजीविका का निर्माण करते हुए।',
    },
    mission: {
      heading: 'हर कामगार को अवसर से जोड़ना',
      intro: 'रोजगार सेतु का उद्देश्य शहरों से लेकर ग्रामीण जिलों तक रोजगार की खोज को सरल, पारदर्शी और सभी के लिए सुलभ बनाना है।',
      points: [
        { title: 'रोजगार की सुलभता', desc: 'हर शिक्षा और तकनीकी स्तर के कामगारों के लिए सरल बहुभाषी डिजिटल पहुंच।' },
        { title: 'डिजिटल कामगार पंजीकरण', desc: 'अभियान अवधि में निःशुल्क विशिष्ट पंजीकरण आईडी के साथ अपना डिजिटल प्रोफाइल बनाएं।' },
        { title: 'कुशल एवं अकुशल जुड़ाव', desc: 'प्रमाणित तकनीशियनों, दैनिक वेतन भोगी श्रमिकों और कारीगरों को समान अवसर।' },
        { title: 'ग्रामीण एवं शहरी अवसर', desc: 'जिला और ग्राम स्तर पर स्थानीय कार्य को औद्योगिक मांग से जोड़ना।' },
        { title: 'महिला भागीदारी', desc: 'महिला कामगारों, स्वयं सहायता समूहों, घर से काम और महिला उद्यमियों के लिए विशेष मार्ग।' },
        { title: 'युवा रोजगार', desc: 'युवाओं को अप्रेंटिसशिप, प्रारंभिक नौकरियों और व्यावसायिक प्रशिक्षण से जोड़ना।' },
        { title: 'स्वरोजगार के अवसर', desc: 'स्वतंत्र तकनीशियनों और सेवा प्रदाताओं को सीधे कार्य प्राप्त करने में सहायता।' },
        { title: 'औद्योगिक एवं व्यावसायिक मांग', desc: 'MSME, कारखानों, ठेकेदारों, दुकानों और परिवारों को भरोसेमंद स्थानीय कार्यबल उपलब्ध कराना।' },
      ],
    },
    dignitySection: {
      kicker: 'श्रम की गरिमा और स्वावलंबन',
      heading: 'हर कौशल, हर हुनर और हर मेहनतकश हाथ का सम्मान',
      quote: 'ईमानदारी, कौशल और आत्मनिर्भरता से किया गया श्रम व्यक्ति और समाज दोनों को सशक्त बनाता है।',
      body: 'भारत की स्वावलंबन और श्रम-सम्मान की गौरवशाली परंपरा से प्रेरित होकर, रोजगार सेतु कृषि श्रमिकों और बुनकरों से लेकर औद्योगिक ऑपरेटरों तक प्रत्येक कार्य को समान गरिमा प्रदान करता है।',
      attributionNote: 'महात्मा गांधी का ऐतिहासिक संदर्भ केवल श्रम की गरिमा की प्रेरणा के रूप में प्रस्तुत है; यह किसी आधिकारिक समर्थन या स्थापना का दावा नहीं करता।',
    },
    categories: {
      heading: 'रोजगार श्रेणियां — A से Z',
      subheading: '32 संरचित कार्य श्रेणियां देखें। कौशल या व्यवसाय के अनुसार खोजें और एक ही प्रोफाइल में कई कौशल जोड़ें।',
      searchPlaceholder: 'श्रेणी या कौशल खोजें (जैसे: इलेक्ट्रीशियन, ट्रैक्टर, वेल्डिंग)...',
      allGroups: 'सभी श्रेणियां',
      groups: {
        trades: 'निर्माण एवं कारीगरी',
        industrial: 'औद्योगिक एवं तकनीकी',
        transport: 'परिवहन एवं डिलीवरी',
        agriculture: 'कृषि एवं ग्रामीण',
        hospitality: 'घरेलू एवं आतिथ्य',
        office: 'कार्यालय एवं डिजिटल',
        services: 'स्वास्थ्य, खुदरा एवं शिक्षा',
        enterprise: 'स्वरोजगार एवं महिला उद्यम',
      },
      exploreAction: 'अवसर देखें',
      noResults: 'कोई मेल खाने वाली श्रेणी नहीं मिली। कृपया अन्य शब्द आज़माएं।',
    },
    howItWorks: {
      heading: 'रोजगार सेतु कैसे काम करता है',
      subheading: 'कामगारों और नियोक्ताओं को सीधे जोड़ने की सरल चार-चरणीय प्रक्रिया।',
      steps: [
        { step: '01', title: 'पंजीकरण करें', desc: 'कामगार और नियोक्ता अपने कौशल, स्थान और आवश्यकताओं के साथ प्रोफाइल बनाते हैं।' },
        { step: '02', title: 'खोजें', desc: 'कामगार नजदीकी अवसर देखते हैं और नियोक्ता कौशल व दूरी के आधार पर कामगार चुनते हैं।' },
        { step: '03', title: 'संपर्क करें', desc: 'दोनों पक्ष संवाद करते हैं, मजदूरी शर्तों की तुलना करते हैं और कार्य तय करते हैं।' },
        { step: '04', title: 'कार्य पूर्ण करें', desc: 'कार्य सुरक्षित रूप से पूरा होता है, फीडबैक दर्ज होता है और विश्वसनीय रिकॉर्ड बनता है।' },
      ],
    },
    forWorkers: {
      heading: 'कामगारों और नौकरी चाहने वालों के लिए',
      subheading: 'प्रत्येक कामगार को एक स्थायी डिजिटल पहचान और उचित अवसरों तक सीधी पहुंच प्रदान करने के लिए निर्मित।',
      benefits: [
        'प्रारंभिक अभियान में पूर्णतः निःशुल्क पंजीकरण',
        'विशिष्ट पंजीकरण आईडी के साथ व्यक्तिगत डिजिटल प्रोफाइल',
        'एक ही प्रोफाइल में अनेक कौशल जोड़ने की सुविधा',
        'रोजगार अवसरों की त्वरित सूचनाएं',
        'जिले, गांव या दूरी के अनुसार नजदीकी काम की खोज',
        'पूर्णकालिक, अंशकालिक, दैनिक मजदूरी और अनुबंध कार्य',
        'स्वरोजगार और स्वतंत्र सेवाओं के अवसर',
        'अनुभव, कार्य इतिहास और कौशल विवरण',
        'पारदर्शी रेटिंग, समीक्षा और शुल्क नीति',
        'कौशल विकास योजनाओं की जानकारी तक सीधी पहुंच',
      ],
      cta: 'कामगार के रूप में पंजीकरण करें',
    },
    forEmployers: {
      heading: 'नियोक्ताओं, ठेकेदारों और व्यवसायों के लिए',
      subheading: 'कारखानों, दुकानों, ठेकेदारों, संस्थानों और घरों के लिए विश्वसनीय स्थानीय कामगार खोजें।',
      features: [
        'पूर्णकालिक, अंशकालिक, दैनिक, अनुबंध या थोक आवश्यकता पोस्ट करें',
        'कौशल, अनुभव और भाषा के आधार पर खोजें',
        'राज्य और जिले के अनुसार स्थानीय कामगार देखें',
        'कामगारों की क्षमता और सत्यापित रिकॉर्ड की समीक्षा करें',
        'वेतन, अवधि और भुगतान शर्तें स्पष्ट रूप से तय करें',
        'एक साथ कई कामगारों या टीम की मांग भेजें',
        'सीधे आवेदन और वेतन प्रस्ताव (Quotation) प्राप्त करें',
        'प्रोफाइल, उपलब्धता और रेटिंग की तुलना करें',
        'बुकिंग की पुष्टि करें और कार्य पूर्ण होने की समीक्षा दर्ज करें',
      ],
      cta: 'नियोक्ता के रूप में पंजीकरण करें',
    },
    mapSection: {
      heading: 'स्थान-आधारित रोजगार मानचित्र',
      subheading: 'गोपनीयता-सुरक्षित मानचित्र पर भारत भर के जिलों में उपलब्ध रोजगार और कार्यबल श्रेणियां खोजें।',
      stateLabel: 'राज्य चुनें',
      districtLabel: 'जिला चुनें',
      cityLabel: 'शहर / कस्बा / गांव',
      radiusLabel: 'खोज दायरा',
      allStates: 'सभी राज्य',
      allDistricts: 'सभी जिले',
      allIndia: 'संपूर्ण भारत',
      layerJobs: 'रोजगार के अवसर',
      layerWorkers: 'पंजीकृत कार्यबल (अनुमानित क्षेत्र)',
      consentTitle: 'लोकेशन अनुमति और गोपनीयता',
      consentDesc: 'ब्राउज़र लोकेशन साझा करना वैकल्पिक है और केवल किलोमीटर में अनुमानित दूरी दिखाने के लिए उपयोग होता है। आपका सटीक स्थान सार्वजनिक नहीं किया जाता।',
      useMyLocation: 'मेरा अनुमानित स्थान उपयोग करें',
      clearLocation: 'लोकेशन हटाएं',
      privacyNote: 'गोपनीयता सुरक्षा: सार्वजनिक मानचित्र पर केवल जिला/नगर स्तर की स्थिति दिखती है। सटीक लाइव ट्रैकिंग डिफ़ॉल्ट रूप से बंद रहती है और केवल स्वीकृत बुकिंग में कामगार की अनुमति से ही सक्रिय होती है।',
      distanceUnit: 'किमी दूर',
      fallbackBanner: 'Google Maps लोड हो रहा है या API कुंजी की प्रतीक्षा में है; नीचे जिला-आधारित खोज उपलब्ध है।',
    },
    womenInclusive: {
      heading: 'महिला एवं समावेशी रोजगार',
      subheading: 'महिलाओं, स्वयं सहायता समूहों और दिव्यांगजन के लिए सुरक्षित, लचीले और सम्मानजनक अवसरों का विस्तार।',
      cards: [
        { title: 'महिला रोजगार अवसर', desc: 'महिलाओं के अनुकूल कार्यस्थलों, सुरक्षित शिफ्ट और सत्यापित प्रतिष्ठानों की खोज।' },
        { title: 'घर से काम और लचीला समय', desc: 'सिलाई, डेटा एंट्री, शिक्षण और घरेलू हस्तशिल्प से जुड़े अवसर।' },
        { title: 'महिला उद्यमी एवं SHG', desc: 'महिला नेतृत्व वाले सूक्ष्म उद्यमों और सहकारी इकाइयों को विशेष मंच।' },
        { title: 'सुरक्षित कार्यस्थल मानक', desc: 'नियोक्ता सुरक्षा प्रतिबद्धता और उत्पीड़न के विरुद्ध त्वरित शिकायत प्रणाली।' },
        { title: 'दिव्यांगजन हेतु सुलभ कार्य', desc: 'दिव्यांग व्यक्तियों के लिए सुगम और अनुकूलित कार्य भूमिकाएं।' },
      ],
    },
    skillsTraining: {
      heading: 'कौशल विकास एवं प्रशिक्षण कार्यक्रम',
      subheading: 'व्यावसायिक प्रशिक्षण, अप्रेंटिसशिप और प्रमाणन योजनाओं की जानकारी प्राप्त करें।',
      govtNotice: 'सरकारी योजना संदर्भ — नागरिकों की जागरूकता के लिए भारत सरकार की योजनाओं की जानकारी। रोजगार सेतु कोई सरकारी वेबसाइट नहीं है।',
      partnerNotice: 'सामान्य प्रशिक्षण एवं सामुदायिक पहल — गैर-सरकारी प्रशिक्षण केंद्र और उद्योग अप्रेंटिसशिप अवसर।',
      tabs: {
        govt: 'सरकारी कौशल योजनाएं',
        vocational: 'व्यावसायिक प्रशिक्षण',
        apprenticeship: 'अप्रेंटिसशिप एवं प्रमाणन',
      },
      items: [
        { type: 'govt', title: 'प्रधानमंत्री कौशल विकास योजना (PMKVY)', org: 'कौशल विकास एवं उद्यमिता मंत्रालय (सरकारी संदर्भ)', desc: '30 से अधिक क्षेत्रों में अल्पकालिक कौशल प्रशिक्षण और पूर्व शिक्षण मान्यता (RPL) प्रमाणन।', badge: 'सरकारी योजना जानकारी' },
        { type: 'govt', title: 'दीन दयाल उपाध्याय ग्रामीण कौशल्य योजना (DDU-GKY)', org: 'ग्रामीण विकास मंत्रालय (सरकारी संदर्भ)', desc: 'ग्रामीण युवाओं के लिए रोजगार से जुड़ा कौशल प्रशिक्षण कार्यक्रम।', badge: 'सरकारी योजना जानकारी' },
        { type: 'govt', title: 'राष्ट्रीय शिक्षुता प्रोत्साहन योजना (NAPS)', org: 'प्रशिक्षण महानिदेशालय (सरकारी संदर्भ)', desc: 'कारखानों और MSME इकाइयों में स्टाइपेंड के साथ व्यावहारिक प्रशिक्षण।', badge: 'सरकारी योजना जानकारी' },
        { type: 'vocational', title: 'सोलर रूफटॉप एवं इलेक्ट्रिकल सुरक्षा कार्यशाला', org: 'सहयोगी प्रशिक्षण केंद्र नेटवर्क (तृतीय पक्ष)', desc: 'घरेलू वायरिंग, इन्वर्टर और सुरक्षा उपकरणों का व्यावहारिक प्रशिक्षण।', badge: 'सहयोगी प्रशिक्षण' },
        { type: 'vocational', title: 'महिला सूक्ष्म-उद्यम एवं परिधान निर्माण', org: 'रोजगार सेतु सामुदायिक आजीविका पहल', desc: 'सिलाई, पैकेजिंग और डिजिटल हिसाब-किताब का प्रशिक्षण।', badge: 'सामुदायिक पहल' },
        { type: 'apprenticeship', title: 'औद्योगिक CNC एवं वेल्डिंग शॉप-फ्लोर अप्रेंटिसशिप', org: 'MSME औद्योगिक क्लस्टर भागीदार', desc: 'ITI प्रशिक्षित युवाओं और सहायकों के लिए 6 माह का व्यावहारिक प्रशिक्षण।', badge: 'अप्रेंटिसशिप' },
      ],
    },
    impact: {
      heading: 'रोजगार प्रभाव डैशबोर्ड',
      subheading: 'डेटाबेस में दर्ज वास्तविक एवं सत्यापित आंकड़ों पर आधारित पारदर्शी प्रदर्शन विवरण।',
      launchNotice: 'वास्तविक प्लेटफॉर्म डेटा: सभी संख्याएं सीधे पंजीकृत रिकॉर्ड से प्रदर्शित होती हैं। शून्य (0) प्रारंभिक लॉन्च चरण को दर्शाता है।',
      metrics: {
        workers: 'कुल पंजीकृत कामगार',
        activeWorkers: 'सक्रिय उपलब्ध कामगार',
        employers: 'पंजीकृत नियोक्ता',
        jobsPosted: 'पोस्ट किए गए कार्य',
        applications: 'प्राप्त आवेदन एवं निमंत्रण',
        completed: 'सफलतापूर्वक पूर्ण कार्य',
        womenWorkers: 'पंजीकृत महिलाएं',
      },
      stateDistribution: 'राज्यवार रोजगार अवसर',
      districtDistribution: 'जिलेवार कार्यबल वितरण',
      noDataYet: 'लॉन्च और पंजीकरण के साथ वास्तविक डेटा स्वतः प्रदर्शित होगा।',
    },
    workerForm: {
      title: 'कामगार पंजीकरण एवं कौशल प्रोफाइल',
      subtitle: 'प्रारंभिक अभियान के दौरान निःशुल्क पंजीकरण करें और एक से अधिक कौशल जोड़ें।',
      authRequiredTitle: 'आधिकारिक कामगार प्रोफाइल सहेजने के लिए Google से साइन इन करें',
      authRequiredDesc: 'आपके डेटा की सुरक्षा और विशिष्ट पंजीकरण आईडी जारी करने के लिए कृपया अपने Google खाते से साइन इन करें।',
      signInBtn: 'Google से साइन इन करें',
      fullName: 'पूरा नाम',
      mobile: 'मोबाइल नंबर (10 अंक)',
      sendOtp: 'OTP भेजें',
      verifyOtp: 'OTP सत्यापित करें',
      otpPlaceholder: '6 अंकों का OTP',
      otpVerified: 'मोबाइल सत्यापित',
      emailOpt: 'ईमेल पता (वैकल्पिक)',
      state: 'राज्य',
      district: 'जिला',
      cityVillage: 'शहर / कस्बा / गांव',
      currentLocationOpt: 'वर्तमान स्थान निर्देशांक (वैकल्पिक व सहमति-आधारित)',
      captureCoords: 'अनुमानित लोकेशन चुनें',
      photoOpt: 'प्रोफाइल फोटो URL (वैकल्पिक)',
      genderOpt: 'लिंग (वैकल्पिक)',
      ageConfirm: 'मैं पुष्टि करता/करती हूं कि मेरी आयु 18 वर्ष या उससे अधिक है और मैं कार्य करने के लिए पात्र हूं।',
      education: 'शैक्षणिक योग्यता',
      primarySkill: 'मुख्य कौशल / कार्य श्रेणी',
      additionalSkills: 'अतिरिक्त कौशल (बहु-कौशल प्रोफाइल)',
      addSkillPlaceholder: 'कौशल लिखें (जैसे: सोलर वायरिंग, पाइप फिटिंग)',
      addSkillBtn: 'कौशल जोड़ें',
      experienceYears: 'कार्य अनुभव (वर्ष)',
      expectedWage: 'अपेक्षित दैनिक मजदूरी / मासिक वेतन (₹)',
      wageUnit: 'वेतन का प्रकार',
      preferredWorkType: 'पसंदीदा कार्य प्रकार',
      availability: 'कार्य उपलब्धता',
      preferredWorkLocation: 'पसंदीदा कार्य क्षेत्र',
      languagesKnown: 'ज्ञात भाषाएं (कॉमा से अलग करें)',
      certificatesOpt: 'कौशल प्रमाणपत्र विवरण (वैकल्पिक)',
      idStatus: 'स्वैच्छिक पहचान सत्यापन स्थिति',
      idNotice: 'आधार या संवेदनशील दस्तावेज अनिवार्य नहीं हैं। भविष्य का कोई भी पहचान सत्यापन पूर्णतः स्वैच्छिक और कानूनसम्मत होगा।',
      privacyConsent: 'मैं रोजगार सेतु की गोपनीयता नीति और कामगार दिशानिर्देशों से सहमत हूं।',
      liveLocConsent: 'केवल मेरे द्वारा कार्य बुकिंग स्वीकार करने और अनुमति देने पर ही लोकेशन साझा करने की अनुमति दें (डिफ़ॉल्ट रूप से बंद)।',
      submitBtn: 'कामगार पंजीकरण पूरा करें',
      updateBtn: 'प्रोफाइल अपडेट करें',
      successMsg: 'आपका कामगार पंजीकरण सफलतापूर्वक सहेजा गया है।',
      uniqueIdLabel: 'कामगार पंजीकरण आईडी',
    },
    employerForm: {
      title: 'नियोक्ता एवं व्यवसाय पंजीकरण',
      subtitle: 'नियुक्ति और कार्य पोस्ट करने के लिए अपनी कंपनी, कारखाना, दुकान, ठेकेदार इकाई या संस्था पंजीकृत करें।',
      businessName: 'नियोक्ता / व्यवसाय / संस्थान का नाम',
      contactPerson: 'संपर्क व्यक्ति का पूरा नाम',
      mobile: 'मोबाइल नंबर (10 अंक)',
      email: 'आधिकारिक ईमेल पता',
      state: 'राज्य',
      district: 'जिला',
      businessAddress: 'व्यवसाय / कार्यस्थल का पता (निजी रखा जाता है)',
      businessType: 'व्यवसाय / प्रतिष्ठान का प्रकार',
      industryCategory: 'उद्योग श्रेणी',
      establishmentDetails: 'कंपनी / प्रतिष्ठान विवरण (वैकल्पिक)',
      gstOpt: 'GST नंबर (वैकल्पिक, यदि लागू हो)',
      requiredCategories: 'आवश्यक कामगार श्रेणियां',
      workforceNotes: 'कार्यबल आवश्यकता विवरण',
      submitBtn: 'नियोक्ता पंजीकरण पूरा करें',
      successMsg: 'नियोक्ता प्रोफाइल सहेजा गया। अब आप कार्य आवश्यकताएं पोस्ट कर सकते हैं।',
    },
    jobs: {
      postTitle: 'नई कार्य आवश्यकता पोस्ट करें',
      postSubtitle: 'आवश्यक कौशल, वेतन, अवधि और कार्यस्थल का स्पष्ट विवरण दें।',
      jobTitle: 'कार्य का शीर्षक',
      category: 'कार्य श्रेणी',
      description: 'कार्य का विवरण एवं जिम्मेदारियां',
      workersRequired: 'आवश्यक कामगारों की संख्या',
      requiredSkills: 'आवश्यक कौशल (कॉमा से अलग)',
      workLocationLabel: 'कार्यस्थल का क्षेत्र / पता संकेत',
      jobDate: 'प्रारंभ तिथि',
      startTime: 'रिपोर्टिंग समय',
      duration: 'अवधि (जैसे: 5 दिन, स्थायी)',
      workType: 'कार्य प्रकार',
      offeredWage: 'प्रस्तावित वेतन / मजदूरी (₹)',
      paymentTerms: 'भुगतान शर्तें (जैसे: दैनिक शाम को, मासिक 5 तारीख)',
      contactPref: 'संपर्क प्राथमिकता',
      womenFriendly: 'महिलाओं के लिए सुरक्षित एवं अनुकूल कार्यस्थल',
      accessibleWork: 'दिव्यांगजन (PwD) के लिए सुलभ कार्य',
      allowQuotes: 'कामगारों को मजदूरी प्रस्ताव (Quotation) भेजने की अनुमति दें',
      publishBtn: 'कार्य आवश्यकता प्रकाशित करें',
      applyBtn: 'आवेदन / प्रस्ताव भेजें',
      appliedLabel: 'आवेदन भेजा गया',
      proposedWageLabel: 'आपकी अपेक्षित मजदूरी (₹)',
      noteLabel: 'नियोक्ता के लिए अनुभव संदेश',
      submitApplication: 'आवेदन की पुष्टि करें',
      searchPlaceholder: 'शीर्षक, कौशल, जिले या नियोक्ता के नाम से खोजें...',
      noJobs: 'अभी कोई कार्य उपलब्ध नहीं है। नियोक्ता नए अवसर सीधे पोस्ट कर सकते हैं।',
      workersUnit: 'कामगार आवश्यक',
    },
    dashboards: {
      workerTitle: 'कामगार कार्यक्षेत्र एवं आवेदन',
      employerTitle: 'नियोक्ता कार्यक्षेत्र एवं भर्ती प्रबंधन',
      adminTitle: 'रोजगार सेतु प्रशासन पैनल',
      profileStatus: 'प्रोफाइल सत्यापन स्थिति',
      myApplications: 'मेरे आवेदन और बुकिंग',
      openOpportunities: 'उपयुक्त रोजगार अवसर',
      liveTrackingToggle: 'बुकिंग लोकेशन साझा करने की अनुमति दें',
      liveTrackingNotice: 'यह केवल स्वीकृत कार्य के लिए इस नियोक्ता के साथ साझा होता है और कभी भी बंद किया जा सकता है।',
      postedJobs: 'आपकी पोस्ट की गई आवश्यकताएं',
      receivedApplications: 'प्राप्त आवेदन एवं प्रस्ताव',
      acceptBtn: 'स्वीकार करें',
      declineBtn: 'अस्वीकार करें',
      completeBtn: 'कार्य पूर्ण दर्ज करें व रेटिंग दें',
      ratingLabel: 'कार्य रेटिंग (1–5)',
      feedbackLabel: 'कार्य समाप्ति समीक्षा',
      exportCsv: 'CSV रिपोर्ट डाउनलोड करें',
      adminVerify: 'प्रोफाइल सत्यापित करें',
      adminSuspend: 'खाता निलंबित करें',
      adminRestore: 'खाता बहाल करें',
      auditLogs: 'प्रशासनिक ऑडिट लॉग',
      announcements: 'बैनर एवं घोषणाएं',
      enquiries: 'सरकारी साझेदारी पूछताछ',
      grievances: 'शिकायत एवं सुरक्षा कतार',
    },
    about: {
      title: 'रोजगार सेतु के बारे में',
      body1: 'रोजगार सेतु एक रोजगार एवं कार्यबल संपर्क पहल है, जिसे भारत के कुशल और अकुशल कार्यबल को व्यवसायों, उद्योगों, संस्थानों और कामगार चाहने वाले व्यक्तियों से जोड़ने के लिए बनाया गया है।',
      body2: 'इस मंच का उद्देश्य काम चाहने वालों और रोजगार प्रदाताओं के बीच की दूरी को कम करना है। यह डिजिटल समावेशन, कौशल पहचान, स्थानीय रोजगार खोज, महिलाओं की भागीदारी और बेहतर कार्य अवसरों को बढ़ावा देता है।',
      body3: 'रोजगार सेतु एक स्वतंत्र सामाजिक-प्रभाव रोजगार मंच है जो पूरे भारत में पारदर्शी कार्यबल जुड़ाव और श्रम की गरिमा के लिए समर्पित है।',
      foundationNote: 'महत्वपूर्ण सूचना: रोजगार सेतु एक निजी सामाजिक पहल है और यह कोई सरकारी वेबसाइट, सरकारी विभाग या सरकार द्वारा अनुमोदित पोर्टल नहीं है।',
      visionTitle: 'हमारी दृष्टि (Vision)',
      visionBody: 'भारत के कार्यबल को व्यवसायों, उद्योगों, परिवारों, ठेकेदारों और संस्थानों से जोड़ने वाला एक समावेशी डिजिटल रोजगार तंत्र बनाना।',
      missionTitle: 'हमारा मिशन (Mission)',
      missionBody: 'एक ऐसा एकीकृत डिजिटल मंच निर्मित करना जहां प्रत्येक व्यक्ति अपने स्थान, शिक्षा स्तर या पृष्ठभूमि की परवाह किए बिना अपने कौशल पंजीकृत कर सके और रोजगार अवसरों तक पहुंच प्राप्त कर सके।',
      objectivesTitle: 'मुख्य उद्देश्य एवं सामाजिक प्रभाव',
      objectives: [
        'ग्रामीण एवं शहरी कामगारों और नियोक्ताओं के बीच स्थानीय संपर्क अंतर को पाटना।',
        'पारदर्शी वेतन जानकारी और सीधे जुड़ाव द्वारा बिचौलियों पर निर्भरता कम करना।',
        'सभी 32 कुशल और अकुशल व्यवसायों में श्रम की गरिमा को बढ़ावा देना।',
        'महिलाओं की आर्थिक भागीदारी और सुलभ आजीविका का समर्थन करना।',
      ],
      orgInfoTitle: 'मंच एवं संचालन जानकारी',
      founderLabel: 'प्लेटफ़ॉर्म का नाम',
      registrationLabel: 'विधिक पंजीकरण विवरण',
      officeLabel: 'पंजीकृत कार्यालय का पता',
      contactLabel: 'आधिकारिक संपर्क डेस्क',
      toBeConfirmed: 'रोजगार सेतु द्वारा औपचारिक पुष्टि एवं प्रकाशन लंबित।',
    },
    partnerships: {
      title: 'सरकारी एवं संस्थागत साझेदारी',
      subtitle: 'रोजगार सेतु जमीनी स्तर पर आजीविका जुड़ाव बढ़ाने के लिए सरकारी विभागों, जिला प्रशासन, उद्योग संघों और NGOs के साथ संवाद हेतु तत्पर है।',
      disclaimer: 'पारदर्शिता सूचना: साझेदारी पूछताछ सबमिट करने का अर्थ सरकारी अनुमोदन, स्वामित्व या आधिकारिक सरकारी साझेदारी नहीं है।',
      collaborationListTitle: 'प्रस्तावित सहयोग क्षेत्र',
      collaborators: [
        'केंद्रीय एवं राज्य सरकार के श्रम व रोजगार विभाग',
        'जिला प्रशासन एवं स्थानीय रोजगार मेले',
        'कौशल विकास संस्थान एवं ITI केंद्र',
        'औद्योगिक संघ एवं चैंबर्स ऑफ कॉमर्स',
        'MSME इकाइयां एवं विनिर्माण क्लस्टर',
        'गैर-सरकारी संगठन (NGO), SHG समूह एवं सामाजिक संस्थाएं',
        'शैक्षणिक संस्थान एवं व्यावसायिक प्रशिक्षण केंद्र',
      ],
      dprTitle: 'परियोजना अवधारणा एवं विस्तृत परियोजना रिपोर्ट (DPR)',
      dprDesc: 'संस्थागत समीक्षा, CSR मूल्यांकन और जिला पायलट चर्चा के लिए रोजगार सेतु अवधारणा सारांश डाउनलोड करें।',
      dprBtn: 'अवधारणा सारांश डाउनलोड करें',
      formTitle: 'संस्थागत साझेदारी पूछताछ भेजें',
      orgName: 'संगठन का नाम',
      deptInst: 'विभाग / संस्थान',
      contactPerson: 'संपर्क व्यक्ति',
      designation: 'पदनाम',
      email: 'आधिकारिक ईमेल',
      phone: 'फ़ोन नंबर',
      interest: 'साझेदारी का क्षेत्र',
      message: 'प्रस्ताव / संदेश',
      attachment: 'सहायक दस्तावेज का नाम (वैकल्पिक)',
      submitBtn: 'साझेदारी पूछताछ सबमिट करें',
      successMsg: 'धन्यवाद। आपकी संस्थागत साझेदारी पूछताछ समीक्षा के लिए दर्ज कर ली गई है।',
    },
    pricing: {
      title: 'पारदर्शी राजस्व मॉडल एवं शुल्क नीति',
      subtitle: 'प्रारंभिक अभियान और भविष्य के टिकाऊ संचालन के लिए स्पष्ट कामगार-हितैषी नियम।',
      campaignTitle: 'प्रारंभिक अभियान: निःशुल्क कामगार पंजीकरण',
      campaignDesc: 'प्रारंभिक अभियान के दौरान कामगारों का पंजीकरण पूरी तरह निःशुल्क है और केवल नौकरी सूचना प्राप्त करने के लिए कोई शुल्क नहीं लिया जाता।',
      rulesTitle: 'अनिवार्य निष्पक्ष शुल्क सिद्धांत',
      rules: [
        'प्रारंभिक अभियान में कामगारों से कोई अनिवार्य पंजीकरण शुल्क नहीं।',
        'नौकरी अलर्ट प्राप्त करने के लिए कामगारों से कोई शुल्क नहीं लिया जाएगा।',
        'किसी भी भविष्य की वैकल्पिक सेवा शुल्क की सूचना पहले से स्पष्ट दी जाएगी।',
        'सेवा शुल्क केवल स्पष्ट शर्तों के तहत सफलतापूर्वक पूर्ण कार्यों पर लागू होगा।',
        'बुकिंग की पुष्टि से पहले सटीक शुल्क हमेशा स्क्रीन पर दिखाया जाएगा।',
        'विशिष्ट सत्यापित अनुबंध के बिना सुनिश्चित रोजगार का झूठा वादा नहीं किया जाता।',
      ],
      modelsTitle: 'लॉन्च के बाद प्रस्तावित राजस्व स्रोत',
      models: [
        { title: 'नियोक्ता सदस्यता योजनाएं', audience: 'सक्रिय व्यवसाय और MSME हेतु', desc: 'नियमित भर्ती करने वाले कारखानों और ठेकेदारों के लिए मासिक प्लान।' },
        { title: 'पूर्ण-कार्य सेवा शुल्क', audience: 'पारदर्शी लेनदेन शुल्क', desc: 'कार्य सफलतापूर्वक पूर्ण होने पर पूर्व-घोषित छोटा सुविधा शुल्क।' },
        { title: 'थोक भर्ती समन्वय', audience: 'बड़े प्रोजेक्ट और क्लस्टर हेतु', desc: 'बड़े पैमाने पर कार्यबल जुटाने और समन्वय के लिए विशेष सेवाएं।' },
        { title: 'वैकल्पिक प्रचार लिस्टिंग', audience: 'त्वरित आवश्यकता हेतु', desc: 'तत्काल स्टाफ आवश्यकता के लिए वैकल्पिक प्रमुख विज्ञापन।' },
      ],
    },
    trustSafety: {
      title: 'विश्वास, सुरक्षा एवं पारदर्शिता केंद्र',
      subtitle: 'नीतियां, कार्यस्थल सुरक्षा मानक और औपचारिक शिकायत निवारण।',
      platformDisclaimer: 'महत्वपूर्ण विधिक स्पष्टीकरण: रोजगार सेतु कामगारों और नियोक्ताओं के बीच संपर्क एवं अवसर सुगम बनाता है, लेकिन स्वतः रोजगार, मजदूरी या कार्य उपलब्धता की गारंटी नहीं देता।',
      tabs: {
        privacy: 'गोपनीयता नीति',
        terms: 'नियम एवं शर्तें',
        workerGuide: 'कामगार दिशानिर्देश',
        employerGuide: 'नियोक्ता दिशानिर्देश',
        refund: 'रद्दीकरण एवं रिफंड',
        safety: 'सुरक्षा दिशानिर्देश',
        grievance: 'शिकायत निवारण',
        faq: 'सामान्य प्रश्न (FAQ)',
      },
      reportTitle: 'धोखाधड़ी, भुगतान विवाद या सुरक्षा शिकायत दर्ज करें',
      reportCategory: 'शिकायत की श्रेणी',
      reportTarget: 'कार्य आईडी / खाता संदर्भ (वैकल्पिक)',
      reportSubject: 'विषय',
      reportDesc: 'विस्तृत विवरण',
      reportSubmit: 'शिकायत दर्ज करें',
      reportSuccess: 'आपकी शिकायत समीक्षा के लिए दर्ज कर ली गई है।',
    },
    contact: {
      title: 'संपर्क एवं सहायता केंद्र',
      subtitle: 'कामगार पंजीकरण सहायता, नियोक्ता सत्यापन या संस्थागत पूछताछ के लिए संपर्क करें।',
      helplineLabel: 'नागरिक एवं कामगार सहायता डेस्क',
      emailLabel: 'आधिकारिक संपर्क ईमेल',
      officeLabel: 'रोजगार सेतु कार्यालय',
      hoursLabel: 'सहायता समय',
      supportNote: 'सोमवार से शनिवार, प्रातः 9:30 से सायं 6:00 बजे तक (हिंदी, मराठी और अंग्रेजी में सहायता)।',
    },
    common: {
      loading: 'लोड हो रहा है...',
      save: 'सहेजें',
      cancel: 'रद्द करें',
      close: 'बंद करें',
      filter: 'फ़िल्टर',
      reset: 'रीसेट',
      required: 'अनिवार्य',
      optional: 'वैकल्पिक',
      installApp: 'ऐप इंस्टॉल करें',
      offlineBanner: 'ऑफ़लाइन मोड — कैश की गई सामग्री दिखाई जा रही है।',
      verified: 'सत्यापित',
      pending: 'समीक्षाधीन',
      suspended: 'निलंबित',
      signInRequired: 'यह कार्य करने के लिए कृपया Google से साइन इन करें।',
      noRecords: 'अभी कोई रिकॉर्ड उपलब्ध नहीं है।',
    },
  },
  mr: {
    brand: {
      name: 'रोजगार सेतु',
      slogan: 'प्रत्येक हाताला काम, प्रत्येक कौशल्याला सन्मान!',
      supporting: 'भारताचे A ते Z काम व रोजगार नेटवर्क.',
      disclaimerShort: 'रोजगार सेतु · स्वतंत्र सामाजिक उपक्रम · हे सरकारी पोर्टल नाही',
      initiativeLine: 'भारतासाठी स्वतंत्र रोजगार आणि कार्यबळ जोडणी व्यासपीठ.',
      dignityLine: 'श्रमाची प्रतिष्ठा, सर्वसमावेशक रोजगार आणि कामाच्या संधींपर्यंत डिजिटल पोहोच वाढवण्यासाठी तयार.',
    },
    nav: {
      home: 'मुख्यपृष्ठ',
      about: 'आमच्याविषयी',
      findWork: 'काम शोधा',
      findWorkers: 'कामगार शोधा',
      skills: 'कौशल्य व प्रशिक्षण',
      opportunities: 'रोजगाराच्या संधी',
      employerReg: 'नियोक्ता नोंदणी',
      partnerships: 'शासकीय व संस्थात्मक भागीदारी',
      pricing: 'शुल्क व पारदर्शकता',
      trustSafety: 'विश्वास, सुरक्षा व धोरणे',
      contact: 'संपर्क साधा',
      loginRegister: 'लॉगिन / नोंदणी',
      workerDashboard: 'कामगार डॅशबोर्ड',
      employerDashboard: 'नियोक्ता डॅशबोर्ड',
      adminPanel: 'प्रशासन पॅनेल',
      more: 'इतर',
      signIn: 'Google द्वारे साइन इन करा',
      signOut: 'लॉग आउट',
    },
    hero: {
      heading: 'काम शोधा. कुशल व्यक्ती शोधा. उज्ज्वल भविष्य घडवा.',
      subheading: 'रोजगार सेतु एकाच डिजिटल रोजगार व्यासपीठाद्वारे कामगार, कुशल व्यावसायिक, नोकरी शोधणारे, व्यवसाय आणि नियोक्त्यांना जोडते.',
      ctaWorker: 'कामगार म्हणून नोंदणी करा',
      ctaEmployer: 'कामगार नियुक्त करा',
      campaignNote: 'सध्या फक्त नोंदणी सुरू आहे — १ जानेवारीपासून व्यवहार व बुकिंग सुरू होतील.',
      imageCaption: 'भारतभरातील कुशल कारागीर, तंत्रज्ञ आणि कामगार सन्मानाने उपजीविका घडवताना.',
    },
    mission: {
      heading: 'प्रत्येक कामगाराला संधीशी जोडणे',
      intro: 'रोजगार सेतुचा उद्देश शहरी आणि ग्रामीण भागातील कामगारांसाठी रोजगार शोधणे अधिक सोपे, पारदर्शक आणि सर्वसमावेशक करणे आहे.',
      points: [
        { title: 'रोजगाराची सुलभता', desc: 'सर्व शैक्षणिक व तांत्रिक स्तरांतील कामगारांसाठी सोपी बहुभाषिक डिजिटल सुविधा.' },
        { title: 'डिजिटल कामगार नोंदणी', desc: 'प्रारंभिक मोहिमेत मोफत विशेष नोंदणी आयडीसह स्वतःचे डिजिटल प्रोफाइल तयार करा.' },
        { title: 'कुशल व अकुशल जोडणी', desc: 'प्रशिक्षित तंत्रज्ञ, रोजंदारी कामगार आणि कारागीर यांना समान संधी.' },
        { title: 'ग्रामीण व शहरी संधी', desc: 'जिल्हा व गाव पातळीवरील कामाला औद्योगिक आणि स्थानिक मागणीशी जोडणे.' },
        { title: 'महिलांचा सहभाग', desc: 'महिला कामगार, बचत गट, घरगुती व्यवसाय आणि महिला उद्योजकांसाठी विशेष संधी.' },
        { title: 'युवा रोजगार', desc: 'तरुणांना शिकाऊ उमेदवारी (Apprenticeship) आणि कौशल्य प्रशिक्षणाशी जोडणे.' },
        { title: 'स्वयंरोजगाराच्या संधी', desc: 'स्वतंत्र तंत्रज्ञ आणि व्यावसायिकांना थेट कामाच्या ऑर्डर्स मिळवून देणे.' },
        { title: 'औद्योगिक व व्यावसायिक गरजा', desc: 'MSME, कारखाने, कंत्राटदार, दुकाने आणि कुटुंबांना विश्वासार्ह स्थानिक कामगार मिळवून देणे.' },
      ],
    },
    dignitySection: {
      kicker: 'श्रमाची प्रतिष्ठा आणि स्वावलंबन',
      heading: 'प्रत्येक कला, प्रत्येक कौशल्य आणि प्रत्येक कष्टकरी हाताचा सन्मान',
      quote: 'प्रामाणिकपणा, कौशल्य आणि स्वावलंबनाने केलेले काम व्यक्ती आणि समाज दोघांनाही बळकट करते.',
      body: 'भारताच्या स्वावलंबन आणि श्रम-प्रतिष्ठेच्या परंपरेतून प्रेरणा घेऊन, रोजगार सेतु शेतमजूर आणि विणकरांपासून औद्योगिक तंत्रज्ञांपर्यंत प्रत्येक व्यवसायाचा समान आदर करते.',
      attributionNote: 'महात्मा गांधींचा ऐतिहासिक संदर्भ केवळ श्रमाच्या प्रतिष्ठेच्या प्रेरणेसाठी वापरला आहे; यातून कोणतेही अधिकृत समर्थन किंवा सहभाग सूचित होत नाही.',
    },
    categories: {
      heading: 'रोजगार श्रेण्या — A ते Z',
      subheading: '३२ सुसंघटित कार्य श्रेण्या पहा. कौशल्य किंवा व्यवसायानुसार शोधा आणि एकाच प्रोफाइलमध्ये अनेक कौशल्ये जोडा.',
      searchPlaceholder: 'श्रेणी किंवा कौशल्य शोधा (उदा. इलेक्ट्रिशियन, ट्रॅक्टर, वेल्डिंग)...',
      allGroups: 'सर्व श्रेण्या',
      groups: {
        trades: 'बांधकाम व कारागिरी',
        industrial: 'औद्योगिक व तांत्रिक',
        transport: 'वाहतूक व वितरण',
        agriculture: 'कृषी व ग्रामीण',
        hospitality: 'घरगुती व आतिथ्य',
        office: 'कार्यालय व डिजिटल',
        services: 'आरोग्य, किरकोळ व शिक्षण',
        enterprise: 'स्वयंरोजगार व महिला उद्योग',
      },
      exploreAction: 'संधी पहा',
      noResults: 'कोणतीही जुळणारी श्रेणी सापडली नाही. कृपया दुसरा शब्द वापरून पहा.',
    },
    howItWorks: {
      heading: 'रोजगार सेतु कसे कार्य करते',
      subheading: 'कामगार आणि नियोक्त्यांना थेट जोडणारी सोपी चार-टप्प्यांची प्रक्रिया.',
      steps: [
        { step: '०१', title: 'नोंदणी करा', desc: 'कामगार आणि नियोक्ते कौशल्य, स्थान आणि गरजेनुसार प्रोफाइल तयार करतात.' },
        { step: '०२', title: 'शोध घ्या', desc: 'कामगार जवळच्या संधी पाहतात आणि नियोक्ते कौशल्य व अंतरानुसार कामगार शोधतात.' },
        { step: '०३', title: 'संपर्क साधा', desc: 'दोन्ही बाजू संवाद साधतात, मजुरी दरांची तुलना करतात आणि काम निश्चित करतात.' },
        { step: '०४', title: 'काम पूर्ण करा', desc: 'काम सुरक्षितपणे पूर्ण होते, अभिप्राय नोंदवला जातो आणि विश्वासार्ह इतिहास तयार होतो.' },
      ],
    },
    forWorkers: {
      heading: 'कामगार आणि नोकरी शोधणाऱ्यांसाठी',
      subheading: 'प्रत्येक कामगाराला हक्काची डिजिटल ओळख आणि योग्य कामाच्या संधींपर्यंत थेट पोहोच देण्यासाठी.',
      benefits: [
        'प्रारंभिक मोहिमेत पूर्णपणे मोफत नोंदणी',
        'विशेष नोंदणी आयडीसह वैयक्तिक डिजिटल प्रोफाइल',
        'एकाच प्रोफाइलमध्ये अनेक कौशल्ये नोंदवण्याची सोय',
        'रोजगाराच्या संधींच्या तात्काळ सूचना',
        'जिल्हा, गाव किंवा अंतरानुसार जवळचे काम शोधण्याची सुविधा',
        'पूर्णवेळ, अर्धवेळ, रोजंदारी आणि कंत्राटी कामे',
        'स्वयंरोजगार व स्वतंत्र सेवा संधी',
        'अनुभव, कामाचा इतिहास आणि कौशल्य माहिती',
        'पारदर्शक रेटिंग, अभिप्राय आणि शुल्क धोरण',
        'कौशल्य विकास योजनांच्या माहितीपर्यंत थेट पोहोच',
      ],
      cta: 'कामगार म्हणून नोंदणी करा',
    },
    forEmployers: {
      heading: 'नियोक्ते, कंत्राटदार आणि व्यवसायांसाठी',
      subheading: 'कारखाने, दुकाने, कंत्राटदार, संस्था आणि घरांसाठी विश्वासार्ह स्थानिक कामगार शोधा.',
      features: [
        'पूर्णवेळ, अर्धवेळ, रोजंदारी, कंत्राटी किंवा तातडीची गरज पोस्ट करा',
        'कौशल्य, अनुभव आणि भाषेनुसार कामगार शोधा',
        'राज्य आणि जिल्ह्यानुसार जवळचे कामगार पहा',
        'कामगार प्रोफाइल आणि कामाचे रेकॉर्ड तपासा',
        'मजुरी, कालावधी आणि पेमेंट अटी स्पष्टपणे नमूद करा',
        'एकाच वेळी अनेक कामगार किंवा टीमची मागणी नोंदवा',
        'थेट अर्ज आणि मजुरी दर (Quotation) प्राप्त करा',
        'प्रोफाइल, उपलब्धता आणि रेटिंगची तुलना करा',
        'बुकिंग निश्चित करा आणि काम पूर्ण झाल्याचा अभिप्राय द्या',
      ],
      cta: 'नियोक्ता म्हणून नोंदणी करा',
    },
    mapSection: {
      heading: 'स्थान-आधारित रोजगार नकाशा',
      subheading: 'गोपनीयता-सुरक्षित नकाशावर भारतभरातील जिल्ह्यांमधील कामाच्या संधी आणि उपलब्ध कामगार पहा.',
      stateLabel: 'राज्य निवडा',
      districtLabel: 'जिल्हा निवडा',
      cityLabel: 'शहर / तालुका / गाव',
      radiusLabel: 'शोध अंतर',
      allStates: 'सर्व राज्ये',
      allDistricts: 'सर्व जिल्हे',
      allIndia: 'संपूर्ण भारत',
      layerJobs: 'कामाच्या संधी',
      layerWorkers: 'नोंदणीकृत कामगार (अंदाजे क्षेत्र)',
      consentTitle: 'लोकेशन परवानगी आणि गोपनीयता',
      consentDesc: 'ब्राउझर लोकेशन शेअर करणे ऐच्छिक आहे आणि ते फक्त किलोमीटरमधील अंदाजे अंतर मोजण्यासाठी वापरले जाते. तुमचे अचूक स्थान सार्वजनिक केले जात नाही.',
      useMyLocation: 'माझे अंदाजे स्थान वापरा',
      clearLocation: 'स्थान काढा',
      privacyNote: 'गोपनीयता संरक्षण: सार्वजनिक नकाशावर फक्त जिल्हा/शहर पातळीवरील स्थान दिसते. अचूक लाइव्ह ट्रॅकिंग डीफॉल्टनुसार बंद असते आणि कामगाराने स्वीकारलेल्या बुकिंगमध्ये संमती दिल्यावरच सुरू होते.',
      distanceUnit: 'किमी दूर',
      fallbackBanner: 'Google Maps लोड होत आहे किंवा API की प्रतीक्षेत आहे; खाली जिल्हा-आधारित शोध उपलब्ध आहे.',
    },
    womenInclusive: {
      heading: 'महिला व सर्वसमावेशक रोजगार',
      subheading: 'महिला, बचत गट आणि दिव्यांग व्यक्तींसाठी सुरक्षित, लवचिक आणि सन्मानजनक उपजीविकेच्या संधी.',
      cards: [
        { title: 'महिला रोजगार संधी', desc: 'महिलांसाठी सुरक्षित कार्यस्थळे, दिवसाच्या शिफ्ट आणि सत्यापित आस्थापना.' },
        { title: 'घरून काम व लवचिक वेळ', desc: 'शिलाईकाम, डेटा एंट्री, शिकवणी आणि घरगुती हस्तकला उत्पादनाच्या संधी.' },
        { title: 'महिला उद्योजक व बचत गट', desc: 'महिलांच्या नेतृत्वाखालील सूक्ष्म उद्योग आणि सहकारी युनिट्सना विशेष व्यासपीठ.' },
        { title: 'सुरक्षित कार्यस्थळ मानके', desc: 'नियोक्त्यांची सुरक्षा हमी आणि तक्रार निवारण यंत्रणा.' },
        { title: 'दिव्यांगांसाठी सुलभ संधी', desc: 'दिव्यांग व्यक्तींसाठी अनुकूल कामाच्या भूमिका आणि सुलभता फिल्टर.' },
      ],
    },
    skillsTraining: {
      heading: 'कौशल्य विकास व प्रशिक्षण कार्यक्रम',
      subheading: 'व्यावसायिक प्रशिक्षण, शिकाऊ उमेदवारी आणि प्रमाणपत्र योजनांची माहिती मिळवा.',
      govtNotice: 'शासकीय योजना संदर्भ — नागरिकांच्या माहितीसाठी भारत सरकारच्या अधिकृत उपक्रमांचा संदर्भ. रोजगार सेतु हे सरकारी पोर्टल नाही.',
      partnerNotice: 'सामान्य प्रशिक्षण व सामाजिक उपक्रम — बिगर-सरकारी प्रशिक्षण केंद्रे आणि औद्योगिक प्रशिक्षण संधी.',
      tabs: {
        govt: 'शासकीय कौशल्य योजना',
        vocational: 'व्यावसायिक प्रशिक्षण',
        apprenticeship: 'शिकाऊ उमेदवारी व प्रमाणपत्र',
      },
      items: [
        { type: 'govt', title: 'प्रधानमंत्री कौशल विकास योजना (PMKVY)', org: 'कौशल्य विकास व उद्योजकता मंत्रालय (शासकीय संदर्भ)', desc: '३०+ क्षेत्रांमध्ये अल्पकालीन प्रशिक्षण आणि पूर्व कौशल्य ओळख (RPL) प्रमाणपत्र.', badge: 'शासकीय योजना माहिती' },
        { type: 'govt', title: 'दीनदयाळ उपाध्याय ग्रामीण कौशल्य योजना (DDU-GKY)', org: 'ग्रामीण विकास मंत्रालय (शासकीय संदर्भ)', desc: 'ग्रामीण भागातील तरुणांसाठी रोजगाराशी जोडलेले कौशल्य प्रशिक्षण.', badge: 'शासकीय योजना माहिती' },
        { type: 'govt', title: 'राष्ट्रीय शिकाऊ उमेदवारी प्रोत्साहन योजना (NAPS)', org: 'प्रशिक्षण महासंचालनालय (शासकीय संदर्भ)', desc: 'कारखाने आणि MSME उद्योगांमध्ये स्टायपेंडसह प्रत्यक्ष कामाचे प्रशिक्षण.', badge: 'शासकीय योजना माहिती' },
        { type: 'vocational', title: 'सोलर रूफटॉप व इलेक्ट्रिकल सुरक्षा कार्यशाळा', org: 'सहयोगी प्रशिक्षण केंद्र नेटवर्क (तृतीय पक्ष)', desc: 'घरगुती वायरिंग, इन्व्हर्टर बसवणे आणि सुरक्षितता उपकरणांचे प्रत्यक्ष प्रशिक्षण.', badge: 'सहयोगी प्रशिक्षण' },
        { type: 'vocational', title: 'महिला सूक्ष्म-उद्योग व वस्त्रोद्योग प्रशिक्षण', org: 'रोजगार सेतु सामुदायिक उपजीविका विभाग', desc: 'व्यावसायिक शिलाई, पॅकेजिंग आणि डिजिटल हिशोब प्रशिक्षण.', badge: 'सामुदायिक उपक्रम' },
        { type: 'apprenticeship', title: 'औद्योगिक CNC व वेल्डिंग शॉप-फ्लोर प्रशिक्षण', org: 'MSME औद्योगिक क्लस्टर भागीदार', desc: 'ITI विद्यार्थी आणि सहाय्यकांसाठी ६ महिन्यांचे प्रत्यक्ष उद्योग प्रशिक्षण.', badge: 'शिकाऊ उमेदवारी' },
      ],
    },
    impact: {
      heading: 'रोजगार प्रभाव डॅशबोर्ड',
      subheading: 'डेटाबेसमधील प्रत्यक्ष आणि सत्यापित नोंदींवर आधारित पारदर्शक आकडेवारी.',
      launchNotice: 'थेट व्यासपीठ डेटा: आकडेवारी वास्तविक नोंदी दर्शवते. शून्य (0) हा प्रारंभिक मोहीम टप्पा दर्शवतो.',
      metrics: {
        workers: 'एकूण नोंदणीकृत कामगार',
        activeWorkers: 'उपलब्ध सक्रिय कामगार',
        employers: 'नोंदणीकृत नियोक्ते',
        jobsPosted: 'पोस्ट केलेल्या नोकऱ्या',
        applications: 'प्राप्त अर्ज व निमंत्रणे',
        completed: 'यशस्वी पूर्ण कामे',
        womenWorkers: 'नोंदणीकृत महिला',
      },
      stateDistribution: 'राज्यनिहाय रोजगार संधी',
      districtDistribution: 'जिल्हानिहाय कामगार वितरण',
      noDataYet: 'नोंदणी आणि कामाच्या पोस्ट्स वाढल्यावर वास्तविक डेटा येथे दिसेल.',
    },
    workerForm: {
      title: 'कामगार नोंदणी आणि कौशल्य प्रोफाइल',
      subtitle: 'प्रारंभिक मोहिमेदरम्यान मोफत नोंदणी करा आणि एकापेक्षा जास्त कौशल्ये जोडा.',
      authRequiredTitle: 'तुमचे कामगार प्रोफाइल जतन करण्यासाठी Google द्वारे साइन इन करा',
      authRequiredDesc: 'तुमचा डेटा सुरक्षित ठेवण्यासाठी आणि विशेष नोंदणी आयडी तयार करण्यासाठी कृपया Google खात्याने साइन इन करा.',
      signInBtn: 'Google द्वारे साइन इन करा',
      fullName: 'पूर्ण नाव',
      mobile: 'मोबाईल क्रमांक (१० अंकी)',
      sendOtp: 'OTP पाठवा',
      verifyOtp: 'OTP सत्यापित करा',
      otpPlaceholder: '६-अंकी OTP',
      otpVerified: 'मोबाईल सत्यापित',
      emailOpt: 'ईमेल पत्ता (ऐच्छिक)',
      state: 'राज्य',
      district: 'जिल्हा',
      cityVillage: 'शहर / तालुका / गाव',
      currentLocationOpt: 'सध्याचे स्थान निर्देशांक (ऐच्छिक व संमती-आधारित)',
      captureCoords: 'अंदाजे स्थान निवडा',
      photoOpt: 'प्रोफाइल फोटो URL (ऐच्छिक)',
      genderOpt: 'लिंग (ऐच्छिक)',
      ageConfirm: 'मी १८ वर्षे किंवा त्यापेक्षा जास्त वयाचा/ची असून कामासाठी पात्र असल्याची पुष्टी करतो/करते.',
      education: 'शिक्षण',
      primarySkill: 'मुख्य कौशल्य / काम श्रेणी',
      additionalSkills: 'अतिरिक्त कौशल्ये (बहु-कौशल्य प्रोफाइल)',
      addSkillPlaceholder: 'कौशल्य लिहा (उदा. सोलर वायरिंग, नळ जोडणी)',
      addSkillBtn: 'कौशल्य जोडा',
      experienceYears: 'कामाचा अनुभव (वर्षे)',
      expectedWage: 'अपेक्षित मजुरी / पगार (₹)',
      wageUnit: 'वेतन प्रकार',
      preferredWorkType: 'पसंतीचा कामाचा प्रकार',
      availability: 'कामाची उपलब्धता',
      preferredWorkLocation: 'पसंतीचे कामाचे ठिकाण',
      languagesKnown: 'अवगत भाषा (स्वल्पविरामाने वेगळ्या करा)',
      certificatesOpt: 'कौशल्य प्रमाणपत्र माहिती (ऐच्छिक)',
      idStatus: 'ऐच्छिक ओळख पडताळणी स्थिती',
      idNotice: 'आधार किंवा संवेदनशील कागदपत्रे अनिवार्य नाहीत. कोणतीही भविष्यातील ओळख पडताळणी पूर्णतः ऐच्छिक आणि कायदेशीर असेल.',
      privacyConsent: 'मी रोजगार सेतुचे गोपनीयता धोरण आणि कामगार मार्गदर्शक तत्त्वे मान्य करतो/करते.',
      liveLocConsent: 'फक्त मी काम स्वीकारलेल्या बुकिंगमध्ये अनुमती दिल्यावरच लोकेशन शेअर करण्याची परवानगी द्या (डीफॉल्ट बंद).',
      submitBtn: 'कामगार नोंदणी पूर्ण करा',
      updateBtn: 'प्रोफाइल अद्ययावत करा',
      successMsg: 'तुमची कामगार नोंदणी यशस्वीरित्या जतन केली गेली आहे.',
      uniqueIdLabel: 'कामगार नोंदणी आयडी',
    },
    employerForm: {
      title: 'नियोक्ता आणि व्यवसाय नोंदणी',
      subtitle: 'कामाच्या संधी पोस्ट करण्यासाठी आणि कामगार शोधण्यासाठी तुमचा व्यवसाय, कारखाना, दुकान किंवा संस्था नोंदवा.',
      businessName: 'नियोक्ता / व्यवसाय / संस्थेचे नाव',
      contactPerson: 'संपर्क व्यक्तीचे पूर्ण नाव',
      mobile: 'मोबाईल क्रमांक (१० अंकी)',
      email: 'अधिकृत ईमेल पत्ता',
      state: 'राज्य',
      district: 'जिल्हा',
      businessAddress: 'व्यवसाय / कामाच्या ठिकाणाचा पत्ता (खाजगी ठेवला जातो)',
      businessType: 'व्यवसाय / आस्थापनेचा प्रकार',
      industryCategory: 'उद्योग श्रेणी',
      establishmentDetails: 'कंपनी / आस्थापना तपशील (ऐच्छिक)',
      gstOpt: 'GST क्रमांक (ऐच्छिक, लागू असल्यास)',
      requiredCategories: 'आवश्यक कामगार श्रेण्या',
      workforceNotes: 'कामगार गरजेचा तपशील',
      submitBtn: 'नियोक्ता नोंदणी पूर्ण करा',
      successMsg: 'नियोक्ता प्रोफाइल जतन झाले. आता तुम्ही कामाच्या आवश्यकता पोस्ट करू शकता.',
    },
    jobs: {
      postTitle: 'नवीन कामाची आवश्यकता पोस्ट करा',
      postSubtitle: 'आवश्यक कौशल्ये, वेतन, कालावधी आणि ठिकाणाची स्पष्ट माहिती द्या.',
      jobTitle: 'कामाचे शीर्षक',
      category: 'काम श्रेणी',
      description: 'कामाचे वर्णन व जबाबदाऱ्या',
      workersRequired: 'लागणारे कामगार',
      requiredSkills: 'आवश्यक कौशल्ये (स्वल्पविरामाने वेगळी)',
      workLocationLabel: 'कामाचे ठिकाण / परिसर',
      jobDate: 'सुरुवातीची तारीख',
      startTime: 'कामाची वेळ',
      duration: 'कालावधी (उदा. ५ दिवस, कायमस्वरूपी)',
      workType: 'कामाचा प्रकार',
      offeredWage: 'देऊ केलेले वेतन / मजुरी (₹)',
      paymentTerms: 'पेमेंट अटी (उदा. रोज संध्याकाळी, दरमहा ५ तारखेला)',
      contactPref: 'संपर्क प्राधान्य',
      womenFriendly: 'महिलांसाठी सुरक्षित आणि अनुकूल कार्यस्थळ',
      accessibleWork: 'दिव्यांग व्यक्तींसाठी सुलभ काम',
      allowQuotes: 'कामगारांना दर प्रस्ताव (Quotation) पाठवण्याची परवानगी द्या',
      publishBtn: 'कामाची आवश्यकता प्रकाशित करा',
      applyBtn: 'अर्ज / दर प्रस्ताव पाठवा',
      appliedLabel: 'अर्ज सादर केला',
      proposedWageLabel: 'तुमची अपेक्षित मजुरी (₹)',
      noteLabel: 'नियोक्त्यासाठी अनुभव संदेश',
      submitApplication: 'अर्ज निश्चित करा',
      searchPlaceholder: 'कामाचे नाव, कौशल्य, जिल्हा किंवा नियोक्त्यानुसार शोधा...',
      noJobs: 'अद्याप जुळणारी कामे उपलब्ध नाहीत. नियोक्ते थेट नवीन कामे पोस्ट करू शकतात.',
      workersUnit: 'कामगार हवेत',
    },
    dashboards: {
      workerTitle: 'कामगार कार्यक्षेत्र व अर्ज',
      employerTitle: 'नियोक्ता कार्यक्षेत्र व भरती व्यवस्थापन',
      adminTitle: 'रोजगार सेतु प्रशासन पॅनेल',
      profileStatus: 'प्रोफाइल पडताळणी स्थिती',
      myApplications: 'माझे अर्ज आणि बुकिंग',
      openOpportunities: 'उपयुक्त कामाच्या संधी',
      liveTrackingToggle: 'बुकिंग लोकेशन शेअरिंगला परवानगी द्या',
      liveTrackingNotice: 'फक्त या स्वीकारलेल्या कामासाठी संबंधित नियोक्त्याशी शेअर केले जाते आणि कधीही बंद करता येते.',
      postedJobs: 'तुम्ही पोस्ट केलेल्या कामाच्या संधी',
      receivedApplications: 'प्राप्त कामगार अर्ज व प्रस्ताव',
      acceptBtn: 'स्वीकारा',
      declineBtn: 'नाकारा',
      completeBtn: 'काम पूर्ण नोंदवा व रेटिंग द्या',
      ratingLabel: 'कामाचे रेटिंग (१–५)',
      feedbackLabel: 'काम पूर्ण झाल्याचा अभिप्राय',
      exportCsv: 'CSV अहवाल डाउनलोड करा',
      adminVerify: 'प्रोफाइल सत्यापित करा',
      adminSuspend: 'खाते निलंबित करा',
      adminRestore: 'खाते पुन्हा सुरू करा',
      auditLogs: 'प्रशासनिक ऑडिट नोंदी',
      announcements: 'घोषणा व सूचना फलक',
      enquiries: 'शासकीय भागीदारी चौकशी',
      grievances: 'तक्रार व सुरक्षा विभाग',
    },
    about: {
      title: 'रोजगार सेतु विषयी',
      body1: 'रोजगार सेतु हा भारतातील कुशल आणि अकुशल कामगारांना व्यवसाय, उद्योग, संस्था आणि कामगारांची गरज असलेल्या व्यक्तींशी जोडणारा रोजगार व कार्यबळ जोडणी उपक्रम आहे.',
      body2: 'काम शोधणारे आणि रोजगार देणारे यांच्यातील दरी कमी करणे हा या व्यासपीठाचा मुख्य उद्देश आहे. हे व्यासपीठ डिजिटल समावेश, कौशल्याची ओळख, स्थानिक रोजगार शोध आणि महिलांचा सहभाग वाढवते.',
      body3: 'रोजगार सेतु हा संपूर्ण भारतात पारदर्शक कार्यबळ जोडणी आणि श्रमाच्या सन्मानासाठी समर्पित एक स्वतंत्र सामाजिक रोजगार मंच आहे.',
      foundationNote: 'महत्त्वाची सूचना: रोजगार सेतु हा एक खाजगी सामाजिक उपक्रम असून हे अधिकृत सरकारी संकेतस्थळ किंवा सरकारी विभाग नाही.',
      visionTitle: 'आमची दृष्टी (Vision)',
      visionBody: 'भारतातील कामगारांना व्यवसाय, उद्योग, कुटुंबे, कंत्राटदार आणि संस्थांशी जोडणारी सर्वसमावेशक डिजिटल रोजगार परिसंस्था निर्माण करणे.',
      missionTitle: 'आमचे ध्येय (Mission)',
      missionBody: 'असे एकसंध डिजिटल व्यासपीठ तयार करणे जिथे प्रत्येक व्यक्ती स्थान, शिक्षण किंवा पार्श्वभूमीची पर्वा न करता आपली कौशल्ये नोंदवू शकेल आणि रोजगाराच्या संधी मिळवू शकेल.',
      objectivesTitle: 'मुख्य उद्दिष्टे व सामाजिक प्रभाव',
      objectives: [
        'ग्रामीण व शहरी कामगार आणि नियोक्ते यांच्यातील स्थानिक संपर्क दरी भरून काढणे.',
        'पारदर्शक वेतन माहिती आणि थेट संवादाद्वारे मध्यस्थांवरील अवलंबित्व कमी करणे.',
        'सर्व ३२ कुशल व अकुशल व्यवसायांमध्ये श्रमाचा सन्मान वाढवणे.',
        'महिलांचा आर्थिक सहभाग आणि सुलभ उपजीविकेला प्रोत्साहन देणे.',
      ],
      orgInfoTitle: 'व्यासपीठ व प्रशासन माहिती',
      founderLabel: 'व्यासपीठाचे नाव',
      registrationLabel: 'कायदेशीर नोंदणी तपशील',
      officeLabel: 'नोंदणीकृत कार्यालय पत्ता',
      contactLabel: 'अधिकृत संपर्क कक्ष',
      toBeConfirmed: 'रोजगार सेतु कडून अधिकृत पुष्टी व प्रकाशनाच्या प्रतीक्षेत.',
    },
    partnerships: {
      title: 'शासकीय व संस्थात्मक भागीदारी',
      subtitle: 'तळागाळातील रोजगार जोडणी वाढवण्यासाठी रोजगार सेतु शासकीय विभाग, जिल्हा प्रशासन, उद्योग संघटना आणि NGO सोबत सहकार्यासाठी उत्सुक आहे.',
      disclaimer: 'पारदर्शकता सूचना: भागीदारी चौकशी सादर केल्याने सरकारी मंजुरी, मालकी किंवा अधिकृत सरकारी भागीदारी सूचित होत नाही.',
      collaborationListTitle: 'प्रस्तावित सहकार्य क्षेत्रे',
      collaborators: [
        'केंद्र व राज्य शासनाचे कामगार आणि रोजगार विभाग',
        'जिल्हा प्रशासन व स्थानिक रोजगार मेळावे',
        'कौशल्य विकास संस्था आणि ITI केंद्रे',
        'औद्योगिक संघटना आणि चेंबर्स ऑफ कॉमर्स',
        'MSME उद्योग आणि उत्पादन क्लस्टर्स',
        'स्वयंसेवी संस्था (NGO), बचत गट महासंघ आणि सामाजिक संस्था',
        'शैक्षणिक संस्था आणि व्यावसायिक प्रशिक्षण केंद्रे',
      ],
      dprTitle: 'प्रकल्प संकल्पना व सविस्तर प्रकल्प अहवाल (DPR)',
      dprDesc: 'संस्थात्मक चर्चा, CSR मूल्यमापन आणि जिल्हा पातळीवरील प्रयोगांसाठी रोजगार सेतु संकल्पना सारांश डाउनलोड करा.',
      dprBtn: 'संकल्पना सारांश डाउनलोड करा',
      formTitle: 'संस्थात्मक भागीदारी चौकशी पाठवा',
      orgName: 'संस्थेचे नाव',
      deptInst: 'विभाग / संस्था',
      contactPerson: 'संपर्क व्यक्ती',
      designation: 'हुद्दा / पद',
      email: 'अधिकृत ईमेल',
      phone: 'फोन क्रमांक',
      interest: 'सहकार्याचे क्षेत्र',
      message: 'प्रस्ताव / संदेश',
      attachment: 'सहाय्यक दस्तऐवजाचे नाव (ऐच्छिक)',
      submitBtn: 'भागीदारी चौकशी पाठवा',
      successMsg: 'धन्यवाद. तुमची संस्थात्मक भागीदारी चौकशी पुनरावलोकनासाठी नोंदवली गेली आहे.',
    },
    pricing: {
      title: 'पारदर्शक महसूल मॉडेल व शुल्क धोरण',
      subtitle: 'प्रारंभिक मोहीम आणि भविष्यातील टिकाऊ कार्यासाठी कामगार-केंद्रित नियम.',
      campaignTitle: 'प्रारंभिक मोहीम: कामगारांसाठी मोफत नोंदणी',
      campaignDesc: 'प्रारंभिक मोहिमेदरम्यान कामगार नोंदणी पूर्णपणे मोफत आहे आणि केवळ कामाच्या सूचना मिळवण्यासाठी कोणतेही शुल्क आकारले जात नाही.',
      rulesTitle: 'अनिवार्य न्याय्य शुल्क तत्त्वे',
      rules: [
        'प्रारंभिक मोहिमेत कामगारांकडून कोणतेही अनिवार्य नोंदणी शुल्क नाही.',
        'नोकरी अलर्ट मिळवण्यासाठी कामगारांकडून कधीही शुल्क घेतले जाणार नाही.',
        'भविष्यातील कोणत्याही ऐच्छिक सेवा शुल्काची माहिती आगाऊ दिली जाईल व संमती घेतली जाईल.',
        'सेवा शुल्क केवळ स्पष्ट अटींनुसार यशस्वी पूर्ण झालेल्या व्यवहारांवर लागू होईल.',
        'बुकिंग निश्चित करण्यापूर्वी अचूक शुल्क नेहमी स्पष्टपणे दाखवले जाईल.',
        'विशिष्ट सत्यापित कराराशिवाय निश्चित रोजगाराचे आश्वासन दिले जात नाही.',
      ],
      modelsTitle: 'लाँच नंतरचे प्रस्तावित महसूल स्रोत',
      models: [
        { title: 'नियोक्ता सदस्यता योजना', audience: 'सक्रिय व्यवसाय व MSME साठी', desc: 'नियमित भरती करणाऱ्या कारखाने व कंत्राटदारांसाठी मासिक योजना.' },
        { title: 'पूर्ण-काम सेवा शुल्क', audience: 'पारदर्शक व्यवहार शुल्क', desc: 'काम यशस्वीरित्या पूर्ण झाल्यावर पूर्व-निर्धारित अल्प सुविधा शुल्क.' },
        { title: 'मोठ्या प्रमाणात भरती समन्वय', audience: 'मोठे प्रकल्प व क्लस्टर्ससाठी', desc: 'मोठ्या प्रमाणातील कामगार भरतीसाठी विशेष समन्वय सेवा.' },
        { title: 'ऐच्छिक प्रमुख जाहिरात', audience: 'तातडीच्या गरजेसाठी', desc: 'तातडीच्या कर्मचारी भरतीसाठी कामाची आवश्यकता ठळक दाखवण्याचा पर्याय.' },
      ],
    },
    trustSafety: {
      title: 'विश्वास, सुरक्षा व पारदर्शकता केंद्र',
      subtitle: 'धोरणे, कार्यस्थळ सुरक्षा मानके आणि तक्रार निवारण यंत्रणा.',
      platformDisclaimer: 'महत्त्वाचे कायदेशीर स्पष्टीकरण: रोजगार सेतु कामगार आणि नियोक्ते यांच्यात संपर्क व संधी उपलब्ध करून देते, परंतु रोजगार, वेतन किंवा कामाच्या उपलब्धतेची आपोआप हमी देत नाही.',
      tabs: {
        privacy: 'गोपनीयता धोरण',
        terms: 'नियम व अटी',
        workerGuide: 'कामगार मार्गदर्शक तत्त्वे',
        employerGuide: 'नियोक्ता मार्गदर्शक तत्त्वे',
        refund: 'रद्दीकरण व परतावा धोरण',
        safety: 'सुरक्षा मार्गदर्शक तत्त्वे',
        grievance: 'तक्रार निवारण',
        faq: 'नेहमी विचारले जाणारे प्रश्न',
      },
      reportTitle: 'फसवणूक, वेतन विवाद किंवा सुरक्षा तक्रार नोंदवा',
      reportCategory: 'तक्रारीचा प्रकार',
      reportTarget: 'काम आयडी / खाते संदर्भ (ऐच्छिक)',
      reportSubject: 'विषय',
      reportDesc: 'सविस्तर वर्णन',
      reportSubmit: 'तक्रार सादर करा',
      reportSuccess: 'तुमची तक्रार पुनरावलोकनासाठी नोंदवली गेली आहे.',
    },
    contact: {
      title: 'संपर्क व मदत कक्ष',
      subtitle: 'कामगार नोंदणी मदत, नियोक्ता पडताळणी किंवा संस्थात्मक चौकशीसाठी संपर्क साधा.',
      helplineLabel: 'नागरिक व कामगार मदत कक्ष',
      emailLabel: 'अधिकृत संपर्क ईमेल',
      officeLabel: 'रोजगार सेतु कार्यालय',
      hoursLabel: 'मदत वेळ',
      supportNote: 'सोमवार ते शनिवार, सकाळी ९:३० ते सायंकाळी ६:०० (मराठी, हिंदी आणि इंग्रजीमध्ये मदत).',
    },
    common: {
      loading: 'लोड होत आहे...',
      save: 'जतन करा',
      cancel: 'रद्द करा',
      close: 'बंद करा',
      filter: 'फिल्टर',
      reset: 'रीसेट',
      required: 'आवश्यक',
      optional: 'ऐच्छिक',
      installApp: 'अ‍ॅप इन्स्टॉल करा',
      offlineBanner: 'ऑफलाइन मोड — जतन केलेली माहिती दाखवली जात आहे.',
      verified: 'सत्यापित',
      pending: 'तपासणी प्रलंबित',
      suspended: 'निलंबित',
      signInRequired: 'ही कृती करण्यासाठी कृपया Google द्वारे साइन इन करा.',
      noRecords: 'अद्याप कोणतीही नोंद उपलब्ध नाही.',
    },
  },
};
