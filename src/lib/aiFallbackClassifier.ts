import { EMPLOYMENT_CATEGORIES } from '../data/categories.ts';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations.ts';
import type { Language, VehicleTripType, VehicleType } from '../types/domain.ts';

export interface StructuredWorkClassification {
  transcript: string;
  intent: 'hire_worker' | 'rent_vehicle' | 'find_work' | 'general_help';
  matchedCategory: string;
  subcategory: string;
  requiredService: string;
  workersRequired: number | null;
  vehicleType: VehicleType | '';
  fromLocation: string;
  toLocation: string;
  tripType: VehicleTripType | '';
  urgency: 'today' | 'tomorrow' | 'scheduled';
  estimatedWage: number;
  suggestedTitle: string;
  missingDetails: string[];
  followUpQuestion: string;
  readyToPublish: boolean;
  replyText: string;
  photoAnalyzed: boolean;
  classificationSource: 'ai_primary' | 'ai_backup' | 'rule_based_fallback';
  modelUsed?: string;
}

interface TradeRule {
  categoryEn: string;
  defaultSubcategory: string;
  defaultService: string;
  defaultWage: number;
  keywords: RegExp;
  subcategories: Array<{
    pattern: RegExp;
    subcategory: string;
    service: string;
  }>;
}

const TRADE_RULES: TradeRule[] = [
  {
    categoryEn: 'Carpenters',
    defaultSubcategory: 'Woodwork & Carpentry',
    defaultService: 'Carpentry work',
    defaultWage: 750,
    keywords: /\b(carpenter|carpenters|carpentry|woodwork|wood\s*work|furniture|door|window|cupboard|cabinet|bed|plywood|lock\s*fix|hinge)\b|बढ़ई|सुतार|लाकूड|दरवाजा|खिड़की|खिडकी|फर्निचर|फर्नीचर|कापेंटर/i,
    subcategories: [
      {
        pattern: /door|दरवाजा|दारे|चौखट/i,
        subcategory: 'Door Fitting',
        service: 'Door installation',
      },
      {
        pattern: /window|खिड़की|खिडकी/i,
        subcategory: 'Window Fitting',
        service: 'Window installation and repair',
      },
      {
        pattern: /cupboard|wardrobe|cabinet|furniture|bed|table|अलमारी|फर्निचर|फर्नीचर/i,
        subcategory: 'Furniture & Cabinet Work',
        service: 'Furniture making and repair',
      },
    ],
  },
  {
    categoryEn: 'Electricians',
    defaultSubcategory: 'Electrical Work',
    defaultService: 'Electrical installation & repair',
    defaultWage: 700,
    keywords: /\b(electrician|electricians|electrical|wiring|rewiring|mcb|switch|socket|short\s*circuit|inverter|solar\s*panel|breaker|meter|fan|light|tube\s*light)\b|इलेक्ट्रीशियन|इलेक्ट्रिशियन|बिजली\s*मिस्त्री|वीजतंत्री|वायरिंग|विद्युत|शॉर्ट\s*सर्किट|पंखा/i,
    subcategories: [
      {
        pattern: /wiring|rewiring|वायरिंग/i,
        subcategory: 'House Wiring',
        service: 'Electrical house wiring',
      },
      {
        pattern: /mcb|panel|inverter|short\s*circuit|meter|शॉर्ट\s*सर्किट|पॅनेल|पैनल/i,
        subcategory: 'Panel & Fault Repair',
        service: 'Electrical panel and fault repair',
      },
      {
        pattern: /fan|light|switch|socket|पंखा|स्विच/i,
        subcategory: 'Fixture & Switch Fitting',
        service: 'Switchboard, light and fan fitting',
      },
    ],
  },
  {
    categoryEn: 'Plumbers',
    defaultSubcategory: 'Plumbing & Pipe Work',
    defaultService: 'Plumbing repair & fitting',
    defaultWage: 650,
    keywords: /\b(plumber|plumbers|plumbing|pipe|tap|faucet|leak|leakage|sink|drain|toilet|bathroom|motor\s*pump|water\s*tank|sanitary|geyser)\b|प्लंबर|नलसाज|नळ\s*कारागीर|नळ|नल|पाईप|पाइप|गळती|टंकी|टाकी/i,
    subcategories: [
      {
        pattern: /leak|drip|गळती|टपक|लीक/i,
        subcategory: 'Leakage Repair',
        service: 'Pipe and tap leakage repair',
      },
      {
        pattern: /motor|pump|tank|मोटर|पंप|टंकी|टाकी/i,
        subcategory: 'Water Pump & Tank Setup',
        service: 'Water pump and overhead tank fitting',
      },
      {
        pattern: /bathroom|toilet|sanitary|sink|बाथरूम|संडास/i,
        subcategory: 'Sanitary & Bathroom Fitting',
        service: 'Bathroom and sanitary fixture installation',
      },
    ],
  },
  {
    categoryEn: 'Painters',
    defaultSubcategory: 'Wall Painting',
    defaultService: 'Interior / exterior painting',
    defaultWage: 650,
    keywords: /\b(painter|painters|paint|painting|whitewash|putty|distemper|primer|waterproofing|wall\s*coat)\b|पेंटर|रंगारी|रंगाई|रंगकाम|पुट्टी/i,
    subcategories: [
      {
        pattern: /waterproof|damp|सीपेज|वॉटरप्रूफ/i,
        subcategory: 'Waterproofing',
        service: 'Roof & wall waterproofing coating',
      },
      {
        pattern: /putty|interior|room|घर|पुट्टी/i,
        subcategory: 'Interior Painting & Putty',
        service: 'Wall putty and interior painting',
      },
    ],
  },
  {
    categoryEn: 'Construction Workers',
    defaultSubcategory: 'Masonry & Civil Work',
    defaultService: 'Construction & masonry work',
    defaultWage: 700,
    keywords: /\b(mason|masons|masonry|construction|civil\s*work|brick|cement|plaster|tile|tiles|flooring|shuttering|bar\s*bending|slab|concrete)\b|बांधकाम|गवंडी|राजमिस्त्री|मिस्त्री|निर्माण|मेसन|सीमेंट|टाइल|प्लास्टर/i,
    subcategories: [
      {
        pattern: /tile|tiles|marble|granite|flooring|टाइल|फरशी/i,
        subcategory: 'Tiles & Flooring',
        service: 'Tile and marble laying',
      },
      {
        pattern: /plaster|brick|wall|cement|प्लास्टर|वीट|ईंट|भिंत/i,
        subcategory: 'Brickwork & Plastering',
        service: 'Brick masonry and wall plastering',
      },
    ],
  },
  {
    categoryEn: 'Welders',
    defaultSubcategory: 'Metal Fabrication & Welding',
    defaultService: 'Welding and grill work',
    defaultWage: 750,
    keywords: /\b(welder|welders|welding|grill|iron\s*gate|shutter|fabrication|shed|steel\s*railing)\b|वेल्डर|वेल्डिंग|ग्रिल|लोखंडी\s*गेट|शटर/i,
    subcategories: [
      {
        pattern: /gate|grill|shutter|railing|गेट|ग्रिल|शटर/i,
        subcategory: 'Gate & Grill Fabrication',
        service: 'Metal gate and grill welding repair',
      },
    ],
  },
  {
    categoryEn: 'Technicians and Mechanics',
    defaultSubcategory: 'Appliance & Vehicle Repair',
    defaultService: 'Technical repair & servicing',
    defaultWage: 700,
    keywords: /\b(mechanic|technician|ac\s*repair|air\s*conditioner|fridge|refrigerator|washing\s*machine|ro\s*filter|cooler|puncture|garage|engine)\b|मेकॅनिक|मैकेनिक|तकनीशियन|तंत्रज्ञ|एसी\s*रिपेअर|फ्रिज|वॉशिंग\s*मशीन|दुरुस्ती/i,
    subcategories: [
      {
        pattern: /ac|air\s*conditioner|एसी/i,
        subcategory: 'AC Servicing & Repair',
        service: 'AC installation, gas & repair',
      },
      {
        pattern: /fridge|refrigerator|washing\s*machine|cooler|ro|फ्रिज|वॉशिंग/i,
        subcategory: 'Home Appliance Repair',
        service: 'Home appliance servicing',
      },
    ],
  },
  {
    categoryEn: 'Helpers and General Labour',
    defaultSubcategory: 'General Labour & Loading',
    defaultService: 'Loading, unloading & site helper support',
    defaultWage: 500,
    keywords: /\b(helper|helpers|labour|labor|mazdoor|majdoor|unskilled|loading|unloading|shifting\s*help|digging)\b|हेल्पर|मजदूर|श्रमिक|मदतनीस|हमाल|उचल|सामान\s*उठाने/i,
    subcategories: [
      {
        pattern: /loading|unloading|shift|हमाल|उचल|सामान/i,
        subcategory: 'Loading & Shifting Helper',
        service: 'Material loading and unloading assistance',
      },
    ],
  },
  {
    categoryEn: 'Housekeeping and Cleaning Staff',
    defaultSubcategory: 'Cleaning & Sanitization',
    defaultService: 'Home or facility deep cleaning',
    defaultWage: 500,
    keywords: /\b(clean|cleaner|cleaning|housekeeping|sweep|mop|sanitiz|janitor|tank\s*cleaning)\b|सफाई|स्वच्छता|हाउसकीपिंग|झाड़ू|झाडू/i,
    subcategories: [
      {
        pattern: /tank|bathroom|deep|टंकी|डीप/i,
        subcategory: 'Deep Cleaning',
        service: 'Deep cleaning and sanitization',
      },
    ],
  },
  {
    categoryEn: 'Domestic Workers',
    defaultSubcategory: 'Household Support',
    defaultService: 'Domestic household help',
    defaultWage: 450,
    keywords: /\b(maid|domestic\s*worker|domestic\s*help|babysitter|nanny|utensils|laundry)\b|घरेलू|घरकाम|कामवाली|बाळ\s*सांभाळ/i,
    subcategories: [],
  },
  {
    categoryEn: 'Cooks and Kitchen Staff',
    defaultSubcategory: 'Cooking & Kitchen Support',
    defaultService: 'Meal cooking / catering preparation',
    defaultWage: 650,
    keywords: /\b(cook|cooks|chef|kitchen|catering|tiffin|rasoiya)\b|रसोइया|स्वयंपाकी|आचारी|जेवण|खाना\s*बनाने/i,
    subcategories: [],
  },
  {
    categoryEn: 'Agricultural Workers',
    defaultSubcategory: 'Farm & Crop Labour',
    defaultService: 'Sowing, weeding & harvesting labour',
    defaultWage: 450,
    keywords: /\b(farm|farming|agriculture|agricultural|harvest|sowing|weeding|cotton\s*pick|crop)\b|शेतमजूर|कृषी|खेती|शेती|कापणी|निंदणी/i,
    subcategories: [],
  },
  {
    categoryEn: 'Farmers and Tractor Operators',
    defaultSubcategory: 'Tractor & Agri Equipment',
    defaultService: 'Tractor ploughing / agri machine operation',
    defaultWage: 800,
    keywords: /\b(tractor\s*operator|harvester|rotavator|ploughing|tillage)\b|ट्रॅक्टर\s*चालक|नांगरणी/i,
    subcategories: [],
  },
  {
    categoryEn: 'Security Guards',
    defaultSubcategory: 'Watchman & Gate Security',
    defaultService: 'Day/night premise guarding',
    defaultWage: 600,
    keywords: /\b(security\s*guard|guard|watchman|chowkidar|night\s*patrol)\b|सुरक्षा\s*गार्ड|सुरक्षा\s*रक्षक|चौकीदार|वॉचमन/i,
    subcategories: [],
  },
  {
    categoryEn: 'Delivery Personnel',
    defaultSubcategory: 'Local Parcel & Delivery',
    defaultService: 'Local courier & parcel delivery',
    defaultWage: 550,
    keywords: /\b(delivery\s*boy|delivery\s*person|courier|parcel\s*delivery)\b|डिलीवरी|डिलिव्हरी/i,
    subcategories: [],
  },
  {
    categoryEn: 'Healthcare Assistants and Caregivers',
    defaultSubcategory: 'Patient & Elder Care',
    defaultService: 'Home patient / elder care support',
    defaultWage: 700,
    keywords: /\b(caregiver|elder\s*care|patient\s*care|nurse\s*assistant|attendant|ward\s*boy)\b|आरोग्य\s*सहाय्यक|काळजीवाहू|रुग्ण\s*सेवा|बुजुर्ग/i,
    subcategories: [],
  },
  {
    categoryEn: 'Drivers',
    defaultSubcategory: 'Personal / Commercial Driver',
    defaultService: 'Licensed driver only (vehicle owner-provided)',
    defaultWage: 700,
    keywords: /\b(driver\s*only|personal\s*driver|car\s*driver|chauffeur|need\s*a\s*driver)\b|फक्त\s*ड्रायव्हर|ड्राइवर\s*चाहिए/i,
    subcategories: [],
  },
  {
    categoryEn: 'Fitters and Machine Operators',
    defaultSubcategory: 'Industrial Machine & Fitter',
    defaultService: 'CNC / lathe / industrial fitting',
    defaultWage: 800,
    keywords: /\b(fitter|cnc|lathe|machine\s*operator|turner)\b|फिटर|मशीन\s*ऑपरेटर/i,
    subcategories: [],
  },
  {
    categoryEn: 'Factory and Industrial Workers',
    defaultSubcategory: 'Factory & Packaging',
    defaultService: 'Factory assembly & packaging work',
    defaultWage: 550,
    keywords: /\b(factory|packing|packaging|assembly\s*line|warehouse\s*worker)\b|कारखाना|फैक्ट्री|पॅकिंग|पैकिंग/i,
    subcategories: [],
  },
  {
    categoryEn: 'Office Assistants',
    defaultSubcategory: 'Office Support & Peon',
    defaultService: 'Office filing, dispatch & support',
    defaultWage: 550,
    keywords: /\b(office\s*assistant|peon|office\s*boy|clerk|front\s*desk)\b|कार्यालय\s*सहाय्यक|ऑफिस\s*बॉय|शिपाई/i,
    subcategories: [],
  },
  {
    categoryEn: 'Data Entry Operators',
    defaultSubcategory: 'Typing & Data Entry',
    defaultService: 'Computer typing & record entry',
    defaultWage: 600,
    keywords: /\b(data\s*entry|typing|excel|computer\s*operator)\b|डेटा\s*एंट्री|टायपिंग|संगणक/i,
    subcategories: [],
  },
  {
    categoryEn: 'Accountants',
    defaultSubcategory: 'Bookkeeping & Tally/GST',
    defaultService: 'Accounting, billing & GST filing',
    defaultWage: 900,
    keywords: /\b(accountant|tally|gst|bookkeeping|billing)\b|अकाउंटंट|अकाउंटेंट|लेखापाल/i,
    subcategories: [],
  },
  {
    categoryEn: 'Teachers and Tutors',
    defaultSubcategory: 'Home Tuition & Coaching',
    defaultService: 'Subject tutoring & coaching',
    defaultWage: 700,
    keywords: /\b(teacher|tutor|tuition|coaching)\b|शिक्षक|ट्यूटर|शिकवणी/i,
    subcategories: [],
  },
  {
    categoryEn: 'Shop and Retail Employees',
    defaultSubcategory: 'Shop Counter & Sales',
    defaultService: 'Shop helper & counter billing',
    defaultWage: 500,
    keywords: /\b(shop\s*helper|retail|sales\s*boy|sales\s*girl|store\s*staff|counter)\b|दुकान\s*कामगार|सेल्स/i,
    subcategories: [],
  },
  {
    categoryEn: 'Event and Hospitality Workers',
    defaultSubcategory: 'Event & Tent Setup',
    defaultService: 'Event decoration, tent & banquet support',
    defaultWage: 600,
    keywords: /\b(event|mandap|tent|waiter|banquet|caterer|decoration)\b|मंडप|इवेंट|कार्यक्रम|डेकोरेशन/i,
    subcategories: [],
  },
  {
    categoryEn: 'Women Entrepreneurs',
    defaultSubcategory: 'Women SHG / Home Enterprise',
    defaultService: 'Women-led tailoring, papad/pickle or SHG product',
    defaultWage: 550,
    keywords: /\b(shg|bachat\s*gat|women\s*enterprise|tailor|stitching|blouse|papad|pickle|mehndi)\b|बचत\s*गट|महिला\s*उद्योग|शिलाई|टेलर/i,
    subcategories: [],
  },
];

interface VehicleRule {
  vehicleType: VehicleType;
  labelEn: string;
  defaultFare: number;
  pattern: RegExp;
}

const VEHICLE_RULES: VehicleRule[] = [
  {
    vehicleType: 'bike_taxi',
    labelEn: 'Bike Taxi / Two-Wheeler',
    defaultFare: 60,
    pattern: /\b(bike\s*taxi|bike|two.?wheeler|scooter|activa|splendor|motorcycle)\b|बाईक\s*टॅक्सी|बाइक\s*टैक्सी|बाईक|बाइक|दुचाकी/i,
  },
  {
    vehicleType: 'trolley_cart',
    labelEn: 'Local Trolley / E-Rickshaw Loader',
    defaultFare: 180,
    pattern: /\b(trolley|e.?loader|e.?rickshaw\s*loader|hand\s*cart|thela)\b|ट्रॉली|ट्रोली|लोडर|ई-रिक्षा\s*मालवाहू/i,
  },
  {
    vehicleType: 'mini_tempo',
    labelEn: 'Chhota Hathi / Tata Ace / Mini Tempo',
    defaultFare: 350,
    pattern: /\b(chhota\s*hathi|chota\s*hathi|tata\s*ace|mini\s*tempo|small\s*goods)\b|छोटा\s*हत्ती|छोटा\s*हाथी|छोटी\s*गाडी|छोटी\s*गाड़ी|टाटा\s*एस|मिनी\s*टेम्पो/i,
  },
  {
    vehicleType: 'pickup_tempo',
    labelEn: 'Bolero Pickup / 407 Tempo (Local)',
    defaultFare: 650,
    pattern: /\b(tempo|pickup|bolero\s*pickup|407|goods\s*tempo)\b|टेम्पो|पिकअप|मोठी\s*गाडी|बड़ी\s*गाड़ी/i,
  },
  {
    vehicleType: 'tractor',
    labelEn: 'Tractor & Trolley (Local Shifting)',
    defaultFare: 900,
    pattern: /\b(tractor)\b|ट्रॅक्टर|ट्रैक्टर/i,
  },
  {
    vehicleType: 'suv_innova',
    labelEn: 'SUV / Innova / Bolero (6-7 Seater)',
    defaultFare: 1200,
    pattern: /\b(innova|suv|ertiga|bolero|scorpio|7.?seater)\b|इनोवा|इनोव्हा|बोलेरो|एसयूवी/i,
  },
  {
    vehicleType: 'auto_rickshaw',
    labelEn: 'Auto Rickshaw (3-Wheeler)',
    defaultFare: 80,
    pattern: /\b(auto\s*rickshaw|auto|rickshaw|three.?wheeler|3.?wheeler)\b|ऑटो\s*रिक्षा|ऑटो\s*रिक्शा|ऑटो|रिक्षा|रिक्शा/i,
  },
  {
    vehicleType: 'car_sedan',
    labelEn: 'Car / Cab / Sedan',
    defaultFare: 500,
    pattern: /\b(car|cab|taxi|sedan|hatchback|dzire|swift)\b|कार|टॅक्सी|टैक्सी|गाडी\s*भाड्याने|गाड़ी\s*किराये/i,
  },
];

// Multilingual city/district lookup for accurate location extraction from Hindi/Marathi/English queries
const LOCALIZED_LOCATION_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /चंद्रपूर|चंद्रपुर|chandrapur/i, canonical: 'Chandrapur' },
  { pattern: /नागपूर|नागपुर|nagpur/i, canonical: 'Nagpur' },
  { pattern: /पुणे|pune/i, canonical: 'Pune' },
  { pattern: /मुंबई|mumbai|bombay/i, canonical: 'Mumbai' },
  { pattern: /ठाणे|ठाणे|thane/i, canonical: 'Thane' },
  { pattern: /नाशिक|nashik/i, canonical: 'Nashik' },
  { pattern: /अमरावती|amravati/i, canonical: 'Amravati' },
  { pattern: /वर्धा|wardha/i, canonical: 'Wardha' },
  { pattern: /गडचिरोली|गड़चिरोली|gadchiroli/i, canonical: 'Gadchiroli' },
  { pattern: /यवतमाळ|यवतमाल|yavatmal/i, canonical: 'Yavatmal' },
  { pattern: /अकोला|akola/i, canonical: 'Akola' },
  { pattern: /कोल्हापूर|कोल्हापुर|kolhapur/i, canonical: 'Kolhapur' },
  { pattern: /सातारा|satara/i, canonical: 'Satara' },
  { pattern: /सांगली|sangli/i, canonical: 'Sangli' },
  { pattern: /सोलापूर|सोलापुर|solapur/i, canonical: 'Solapur' },
  { pattern: /लातूर|latur/i, canonical: 'Latur' },
  { pattern: /छत्रपती संभाजीनगर|संभाजीनगर|aurangabad|sambhajinagar/i, canonical: 'Chhatrapati Sambhajinagar' },
  { pattern: /वरोरा|warora/i, canonical: 'Warora' },
  { pattern: /बल्लारपूर|बल्लारपुर|ballarpur/i, canonical: 'Ballarpur' },
  { pattern: /भद्रावती|bhadravati/i, canonical: 'Bhadravati' },
  { pattern: /राजुरा|rajura/i, canonical: 'Rajura' },
  { pattern: /दिल्ली|delhi|new\s*delhi/i, canonical: 'New Delhi' },
  { pattern: /रायपूर|रायपुर|raipur/i, canonical: 'Raipur' },
  { pattern: /भोपाल|bhopal/i, canonical: 'Bhopal' },
  { pattern: /इंदौर|indore/i, canonical: 'Indore' },
  { pattern: /जयपूर|जयपुर|jaipur/i, canonical: 'Jaipur' },
  { pattern: /बेंगळुरू|बेंगलुरु|bengaluru|bangalore/i, canonical: 'Bengaluru' },
  { pattern: /हैदराबाद|hyderabad/i, canonical: 'Hyderabad' },
  { pattern: /चेन्नई|chennai/i, canonical: 'Chennai' },
  { pattern: /अहमदाबाद|ahmedabad/i, canonical: 'Ahmedabad' },
  { pattern: /सूरत|surat/i, canonical: 'Surat' },
  { pattern: /लखनऊ|lucknow/i, canonical: 'Lucknow' },
  { pattern: /पाटणा|पटना|patna/i, canonical: 'Patna' },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  single: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
  एक: 1,
  दो: 2,
  दोन: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाच: 5,
  सहा: 6,
  दहा: 10,
  दस: 10,
};

function cleanLocationFragment(raw: string): string {
  return raw
    .replace(/\b(today|tomorrow|urgently|urgent|now|please|for|bike|taxi|auto|car|tempo|trolley|door|fitting|need|needed|hava|ahe|chahiye|pahije)\b/gi, '')
    .replace(/[।.,!?]+$/g, '')
    .trim()
    .slice(0, 60);
}

function extractLocations(text: string, userLocationHint: string): {
  fromLocation: string;
  toLocation: string;
  detectedExplicitly: boolean;
} {
  // 1. Check explicit "from X to Y" / "X से Y" / "X ते Y"
  const enRoute = text.match(/\bfrom\s+([a-zA-Z\u0900-\u097F0-9\s-]{2,40}?)\s+to\s+([a-zA-Z\u0900-\u097F0-9\s-]{2,40}?)(?=\s+(?:today|tomorrow|urgent|by|in|for|on)\b|[,.!?]|$)/i);
  if (enRoute) {
    const f = cleanLocationFragment(enRoute[1]);
    const t = cleanLocationFragment(enRoute[2]);
    if (f && t) {
      return { fromLocation: f, toLocation: t, detectedExplicitly: true };
    }
  }

  const devRoute = text.match(/([^\s,]+(?:\s+[^\s,]+)?)\s*(?:से|ते)\s*([^\s,]+(?:\s+[^\s,]+)?)/);
  if (devRoute) {
    const fRaw = cleanLocationFragment(devRoute[1]);
    const tRaw = cleanLocationFragment(devRoute[2]);
    const mapAlias = (val: string) => {
      const hit = LOCALIZED_LOCATION_ALIASES.find((a) => a.pattern.test(val));
      return hit ? hit.canonical : val;
    };
    const f = mapAlias(fRaw);
    const t = mapAlias(tRaw);
    if (f && t && f.toLowerCase() !== t.toLowerCase()) {
      return { fromLocation: f, toLocation: t, detectedExplicitly: true };
    }
  }

  // 2. Match known city/district aliases
  const foundAliases: string[] = [];
  for (const item of LOCALIZED_LOCATION_ALIASES) {
    if (item.pattern.test(text) && !foundAliases.includes(item.canonical)) {
      foundAliases.push(item.canonical);
    }
  }

  if (foundAliases.length === 0) {
    const lower = text.toLowerCase();
    for (const st of INDIA_STATES_DISTRICTS) {
      for (const dist of st.districts) {
        const shortDist = dist.name.split('(')[0].trim().toLowerCase();
        if (shortDist.length >= 3 && new RegExp(`\\b${shortDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
          if (!foundAliases.includes(dist.name)) {
            foundAliases.push(dist.name);
          }
        }
      }
    }
  }

  if (foundAliases.length >= 2) {
    return { fromLocation: foundAliases[0], toLocation: foundAliases[1], detectedExplicitly: true };
  }
  if (foundAliases.length === 1) {
    return { fromLocation: foundAliases[0], toLocation: '', detectedExplicitly: true };
  }

  // 3. Check English "in <Location>" / "at <Location>" / "near <Location>"
  const inMatch = text.match(/\b(?:in|at|near)\s+([A-Z][a-zA-Z0-9\s-]{2,35})/);
  if (inMatch) {
    const cleaned = cleanLocationFragment(inMatch[1]);
    if (cleaned.length >= 2) {
      return { fromLocation: cleaned, toLocation: '', detectedExplicitly: true };
    }
  }

  // 4. Fallback to saved/GPS location hint if available
  const hint = userLocationHint.trim();
  if (hint) {
    return { fromLocation: hint, toLocation: '', detectedExplicitly: false };
  }

  return { fromLocation: '', toLocation: '', detectedExplicitly: false };
}

function extractWorkersCount(text: string): number | null {
  const digitMatch = text.match(
    /(?:^|\s)(\d{1,3})\s*(?:workers?|labourers?|painters?|carpenters?|electricians?|plumbers?|helpers?|masons?|people|persons|कामगार|मजदूर|मिस्त्री|सुतार|इलेक्ट्रिशियन|इलेक्ट्रीशियन|प्लंबर|पेंटर|लोका|जण|लोग)(?=$|\s|[.,!?।])/i
  );
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= 500) return n;
  }

  const wordMatch = text.match(
    /(?:^|\s)(two|three|four|five|six|seven|eight|ten|दो|दोन|तीन|चार|पांच|पाच|सहा|दहा|दस)\s+(?:workers?|labourers?|painters?|carpenters?|electricians?|plumbers?|helpers?|masons?|people|persons|कामगार|मजदूर|मिस्त्री|सुतार|इलेक्ट्रिशियन|इलेक्ट्रीशियन|प्लंबर|लोग|जण)(?=$|\s|[.,!?।])/i
  );
  if (wordMatch) {
    return NUMBER_WORDS[wordMatch[1].toLowerCase()] ?? null;
  }

  if (
    /(?:^|\s)(?:a|an|one|single|एक)\s+(?:carpenter|electrician|plumber|painter|mason|helper|driver|worker|mistri|cook|guard|mechanic|सुतार|इलेक्ट्रिशियन|इलेक्ट्रीशियन|प्लंबर|पेंटर|कामगार|मिस्त्री)(?=$|\s|[.,!?।])/i.test(
      text
    )
  ) {
    return 1;
  }

  return null;
}

export function classifyRequestRuleBased(input: {
  text: string;
  language: Language;
  userLocationHint?: string;
  hasPhoto?: boolean;
}): StructuredWorkClassification {
  const rawText = (input.text || '').trim();
  const lang = input.language;
  const { fromLocation, toLocation, detectedExplicitly } = extractLocations(
    rawText,
    input.userLocationHint || ''
  );

  // Urgency detection
  let urgency: 'today' | 'tomorrow' | 'scheduled' = 'today';
  if (/\b(tomorrow)\b|कल|उद्या/i.test(rawText)) {
    urgency = 'tomorrow';
  } else if (/\b(next\s*week|schedule|later|\d{1,2}[/-]\d{1,2})\b|पुढच्या\s*आठवड्यात|अगले\s*हफ्ते/i.test(rawText)) {
    urgency = 'scheduled';
  }

  // Detect Heavy Truck notice while mapping to Local Transport only
  const mentionsHeavyTruck = /\b(heavy\s*truck|highway\s*truck|18\s*wheeler|container\s*truck|lorry|truck)\b|मोठा\s*ट्रक|बड़ा\s*ट्रक|ट्रक/i.test(rawText);

  // 1. Check Local Transport rules first (unless explicitly "driver only")
  const driverOnlyExplicit = /\bdriver\s*only\b|फक्त\s*ड्रायव्हर|केवल\s*ड्राइवर/i.test(rawText);
  if (!driverOnlyExplicit) {
    const effectiveVehicleRules =
      mentionsHeavyTruck && !VEHICLE_RULES.some((vr) => vr.pattern.test(rawText))
        ? VEHICLE_RULES.filter((vr) => vr.vehicleType === 'pickup_tempo').map((vr) => ({
            ...vr,
            pattern: /.*/,
          }))
        : VEHICLE_RULES;
    for (const vr of effectiveVehicleRules) {
      if (vr.pattern.test(rawText)) {
        const tripType: VehicleTripType = /\bround\s*trip|return|येण्या.?जाण्या|आने.?जाने/i.test(rawText)
          ? 'round_trip'
          : /\bfull\s*day|पूरा\s*दिन|पूर्ण\s*दिवस/i.test(rawText)
          ? 'full_day'
          : /\bhourly|per\s*hour|तास|घंटे/i.test(rawText)
          ? 'hourly'
          : 'one_way';

        const missingDetails: string[] = [];
        if (!fromLocation) missingDetails.push('location');
        if (!toLocation && tripType === 'one_way') missingDetails.push('destination');

        const followUpQuestion =
          !fromLocation
            ? lang === 'mr'
              ? 'पिकअपचे ठिकाण (शहर/गाव) कोणते आहे?'
              : lang === 'hi'
              ? 'पिकअप स्थान (शहर/गाँव) कहाँ है?'
              : 'Which pickup city or locality do you need the vehicle from?'
            : !toLocation
            ? lang === 'mr'
              ? 'तुम्हाला कुठे जायचे आहे (गंतव्य स्थान)?'
              : lang === 'hi'
              ? 'आपको कहाँ जाना है (गंतव्य स्थान)?'
              : 'Where is your destination / drop location?'
            : '';

        const suggestedTitle = toLocation
          ? `${vr.labelEn.split('/')[0].trim()}: ${fromLocation || 'Local'} → ${toLocation}`
          : `${vr.labelEn.split('/')[0].trim()}${fromLocation ? ` in ${fromLocation}` : ''}`;

        const replyText =
          lang === 'mr'
            ? `${vr.labelEn} श्रेणी ओळखली आहे${fromLocation ? ` (${fromLocation}${toLocation ? ` → ${toLocation}` : ''})` : ''}. खालील नोंदणीकृत लोकल वाहने पहा${mentionsHeavyTruck ? ' (ROJGAR SETU वर फक्त लोकल टेम्पो व ट्रॉली सेवा उपलब्ध आहे; जड ट्रक नाहीत)' : ''}.`
            : lang === 'hi'
            ? `${vr.labelEn} श्रेणी पहचानी गई है${fromLocation ? ` (${fromLocation}${toLocation ? ` → ${toLocation}` : ''})` : ''}। नीचे उपलब्ध स्थानीय वाहन देखें${mentionsHeavyTruck ? ' (यहाँ भारी हाईवे ट्रक नहीं, केवल लोकल टेम्पो व ट्रॉली उपलब्ध हैं)' : ''}।`
            : `Detected ${vr.labelEn}${fromLocation ? ` (${fromLocation}${toLocation ? ` → ${toLocation}` : ''})` : ''}. Showing registered local vehicles from our database.${mentionsHeavyTruck ? ' Note: ROJGAR SETU provides local tempo/trolley transport only (no heavy highway trucks).' : ''}`;

        return {
          transcript: rawText || vr.labelEn,
          intent: 'rent_vehicle',
          matchedCategory: vr.labelEn,
          subcategory: vr.labelEn,
          requiredService: `${vr.labelEn} local trip`,
          workersRequired: null,
          vehicleType: vr.vehicleType,
          fromLocation,
          toLocation,
          tripType,
          urgency,
          estimatedWage: vr.defaultFare,
          suggestedTitle,
          missingDetails,
          followUpQuestion,
          readyToPublish: Boolean(fromLocation),
          replyText,
          photoAnalyzed: false,
          classificationSource: 'rule_based_fallback',
        };
      }
    }
  }

  // 2. Check Worker Trade rules
  let matchedRule: TradeRule | null = null;
  for (const rule of TRADE_RULES) {
    if (rule.keywords.test(rawText)) {
      matchedRule = rule;
      break;
    }
  }

  // Check generic category names directly if none matched above
  if (!matchedRule) {
    const lower = rawText.toLowerCase();
    const cat = EMPLOYMENT_CATEGORIES.find(
      (c) =>
        lower.includes(c.en.toLowerCase()) ||
        lower.includes(c.hi.toLowerCase()) ||
        lower.includes(c.mr.toLowerCase()) ||
        c.skillsEn.some((s) => lower.includes(s.toLowerCase()))
    );
    if (cat) {
      matchedRule = {
        categoryEn: cat.en,
        defaultSubcategory: cat.skillsEn[0] || cat.en,
        defaultService: cat.skillsEn[0] || cat.en,
        defaultWage: 600,
        keywords: /.*/,
        subcategories: [],
      };
    }
  }

  const matchedCategory = matchedRule?.categoryEn || 'Helpers and General Labour';
  let subcategory = matchedRule?.defaultSubcategory || 'General Work Support';
  let requiredService = matchedRule?.defaultService || 'Skilled or general work assistance';
  if (matchedRule) {
    for (const sub of matchedRule.subcategories) {
      if (sub.pattern.test(rawText)) {
        subcategory = sub.subcategory;
        requiredService = sub.service;
        break;
      }
    }
  }

  const workersRequired = extractWorkersCount(rawText);
  const missingDetails: string[] = [];
  if (!detectedExplicitly && !fromLocation) missingDetails.push('location');
  if (workersRequired === null) missingDetails.push('workersCount');

  const followUpParts: string[] = [];
  if (!fromLocation) {
    followUpParts.push(
      lang === 'mr'
        ? 'कामाचे ठिकाण (शहर/गाव) कोणते आहे?'
        : lang === 'hi'
        ? 'कार्य स्थान (शहर/गाँव) कौन-सा है?'
        : 'Which city, town or locality is the work in?'
    );
  }
  if (workersRequired === null) {
    followUpParts.push(
      lang === 'mr'
        ? 'किती कामगार हवे आहेत?'
        : lang === 'hi'
        ? 'कितने कामगार चाहिए?'
        : 'How many workers do you need?'
    );
  }

  const urgencyLabel =
    urgency === 'tomorrow'
      ? lang === 'mr' ? 'उद्या' : lang === 'hi' ? 'कल' : 'Tomorrow'
      : urgency === 'scheduled'
      ? lang === 'mr' ? 'नियोजित तारीख' : lang === 'hi' ? 'निर्धारित तिथि' : 'Scheduled'
      : lang === 'mr' ? 'आज / तात्काळ' : lang === 'hi' ? 'आज / तुरंत' : 'Today';

  const suggestedTitle = `${matchedCategory} (${subcategory})${fromLocation ? ` · ${fromLocation}` : ''}`;

  const replyText =
    lang === 'mr'
      ? `सामान्य सर्च प्रणालीद्वारे श्रेणी ओळखली: ${matchedCategory} (${subcategory} · ${requiredService}), वेळ: ${urgencyLabel}${fromLocation ? `, ठिकाण: ${fromLocation}` : ''}.${input.hasPhoto ? ' तुमचा फोटो संदर्भासाठी जोडलेला ठेवला आहे.' : ''}`
      : lang === 'hi'
      ? `सामान्य सर्च प्रणाली से काम पहचाना गया: ${matchedCategory} (${subcategory} · ${requiredService}), समय: ${urgencyLabel}${fromLocation ? `, स्थान: ${fromLocation}` : ''}।${input.hasPhoto ? ' आपका फोटो संदर्भ के लिए सुरक्षित रखा गया है।' : ''}`
      : `Normal search classification: ${matchedCategory} (${subcategory} · ${requiredService}), Urgency: ${urgencyLabel}${fromLocation ? `, Location: ${fromLocation}` : ''}.${input.hasPhoto ? ' Your uploaded photo remains attached as reference.' : ''}`;

  return {
    transcript: rawText || `${matchedCategory} request`,
    intent: 'hire_worker',
    matchedCategory,
    subcategory,
    requiredService,
    workersRequired,
    vehicleType: '',
    fromLocation,
    toLocation: '',
    tripType: '',
    urgency,
    estimatedWage: matchedRule?.defaultWage ?? 600,
    suggestedTitle,
    missingDetails,
    followUpQuestion: followUpParts.join(' '),
    readyToPublish: Boolean(fromLocation && matchedCategory),
    replyText,
    photoAnalyzed: false,
    classificationSource: 'rule_based_fallback',
  };
}
