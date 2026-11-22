import type { Language } from '../types/domain';

export type SchemeAudience = 'unemployed' | 'workers' | 'entrepreneurs' | 'women_youth';
export type SchemeGovLevel = 'central' | 'maharashtra' | 'joint';

export interface LocalizedText {
  en: string;
  hi: string;
  mr: string;
}

export interface GovtSchemeItem {
  id: string;
  audience: SchemeAudience;
  govLevel: SchemeGovLevel;
  name: LocalizedText;
  department: LocalizedText;
  whoCanApply: LocalizedText;
  mainBenefits: LocalizedText;
  eligibility: LocalizedText;
  documents: LocalizedText;
  applicationProcess: LocalizedText;
  officialUrl: string;
  officialPortalLabel: string;
  lastVerifiedDate?: string;
}

export function pickText(text: LocalizedText, lang: Language): string {
  return lang === 'mr' ? text.mr : lang === 'hi' ? text.hi : text.en;
}

export const OFFICIAL_VERIFY_NOTE: LocalizedText = {
  en: 'Visit the official website of the concerned department for the latest eligibility rules, benefit figures, and current application guidelines.',
  hi: 'नवीनतम पात्रता, लाभ और आवेदन नियमों की आधिकारिक जानकारी के लिए संबंधित विभाग की वेबसाइट पर जाएं।',
  mr: 'अधिकृत माहितीसाठी संबंधित विभागाच्या वेबसाइटला भेट द्या.',
};

export const GOVT_SCHEMES_CATALOG: GovtSchemeItem[] = [
  // =========================================================================
  // A. UNEMPLOYED YOUTH & JOB SEEKERS (बेरोजगारों के लिए)
  // =========================================================================
  {
    id: 'ncs-portal',
    audience: 'unemployed',
    govLevel: 'central',
    name: {
      en: 'National Career Service (NCS) Portal',
      hi: 'राष्ट्रीय करियर सेवा (NCS) पोर्टल',
      mr: 'राष्ट्रीय करिअर सेवा (NCS) पोर्टल',
    },
    department: {
      en: 'Ministry of Labour & Employment, Government of India',
      hi: 'श्रम एवं रोजगार मंत्रालय, भारत सरकार',
      mr: 'कामगार व रोजगार मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Job seekers, unemployed youth, students, skilled/unskilled workers, and employers across India.',
      hi: 'भारत के सभी बेरोजगार युवा, नौकरी खोजने वाले, छात्र, कुशल/अकुशल कामगार और नियोक्ता।',
      mr: 'भारतातील बेरोजगार युवक, नोकरी शोधणारे, विद्यार्थी, कुशल/अकुशल कामगार आणि नियोक्ते.',
    },
    mainBenefits: {
      en: 'Free employment registration, verified job matching, career counselling, local job fair (Rozgar Mela) notifications, and skill provider discovery.',
      hi: 'निःशुल्क रोजगार पंजीकरण, नौकरी खोज, करियर परामर्श, रोजगार मेला सूचनाएं और कौशल प्रशिक्षण केंद्रों की जानकारी।',
      mr: 'मोफत रोजगार नोंदणी, नोकरी शोध, करिअर मार्गदर्शन, रोजगार मेळावे माहिती आणि कौशल्य प्रशिक्षण केंद्रांचा शोध.',
    },
    eligibility: {
      en: 'Open to Indian citizens seeking employment or career guidance; specific vacancy qualifications vary by employer. Refer to the official portal for details.',
      hi: 'रोजगार या करियर मार्गदर्शन चाहने वाले भारतीय नागरिक पंजीकरण कर सकते हैं; रिक्ति पात्रता नियोक्ता के अनुसार होती है।',
      mr: 'रोजगार किंवा करिअर मार्गदर्शनासाठी इच्छुक भारतीय नागरिक नोंदणी करू शकतात; पदाप्रमाणे शैक्षणिक पात्रता वेगळी असते.',
    },
    documents: {
      en: 'Aadhaar / UAN / PAN (any accepted ID), mobile number, email ID, educational certificates, and basic skill details.',
      hi: 'आधार / पैन / UAN (मान्य पहचान पत्र), मोबाइल नंबर, ईमेल, शैक्षणिक प्रमाणपत्र और कौशल विवरण।',
      mr: 'आधार / पॅन / UAN (मान्य ओळखपत्र), मोबाईल क्रमांक, ईमेल, शैक्षणिक प्रमाणपत्रे व कौशल्याची माहिती.',
    },
    applicationProcess: {
      en: 'Visit ncs.gov.in → Click "New User / Sign Up" → Select "Jobseeker" → Verify mobile/email via OTP → Complete profile and apply to jobs or Rozgar Melas.',
      hi: 'ncs.gov.in पर जाएं → "New User / Sign Up" चुनें → "Jobseeker" श्रेणी चुनें → OTP से सत्यापन करें → प्रोफ़ाइल पूरा कर नौकरी या रोजगार मेले के लिए आवेदन करें।',
      mr: 'ncs.gov.in वर जा → "New User / Sign Up" निवडा → "Jobseeker" निवडून OTP द्वारे पडताळणी करा → प्रोफाईल पूर्ण करून नोकरी किंवा रोजगार मेळाव्यासाठी अर्ज करा.',
    },
    officialUrl: 'https://www.ncs.gov.in',
    officialPortalLabel: 'ncs.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'mahaswayam-employment',
    audience: 'unemployed',
    govLevel: 'maharashtra',
    name: {
      en: 'Mahaswayam Employment & Skill Portal (Maharashtra)',
      hi: 'महास्वयं रोजगार एवं कौशल पोर्टल (महाराष्ट्र)',
      mr: 'महास्वयंम रोजगार व कौशल्य विकास पोर्टल (महाराष्ट्र)',
    },
    department: {
      en: 'Skill, Employment, Entrepreneurship & Innovation Department, Government of Maharashtra',
      hi: 'कौशल, रोजगार, उद्यमिता एवं नवाचार विभाग, महाराष्ट्र शासन',
      mr: 'कौशल्य, रोजगार, उद्योजकता व नाविन्यता विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Unemployed youth, ITI/diploma/degree holders, skilled workers, and job seekers domiciled in Maharashtra.',
      hi: 'महाराष्ट्र के निवासी बेरोजगार युवा, आईटीआई/डिप्लोमा/स्नातक और कुशल कामगार।',
      mr: 'महाराष्ट्राचे रहिवासी असलेले बेरोजगार युवक-युवती, आयटीआय/पदविका/पदवीधर आणि कुशल कामगार.',
    },
    mainBenefits: {
      en: 'State employment exchange registration, district-level Pandit Deendayal Upadhyay Job Fairs, skill training enrolment, and entrepreneurship portal access.',
      hi: 'राज्य रोजगार पंजीकरण, जिला स्तरीय रोजगार मेले, कौशल प्रशिक्षण नामांकन और स्वरोजगार योजनाओं की जानकारी।',
      mr: 'राज्य रोजगार नोंदणी, जिल्हास्तरीय पंडित दीनदयाळ उपाध्याय रोजगार मेळावे, कौशल्य प्रशिक्षण व स्वयंरोजगार योजनांची माहिती.',
    },
    eligibility: {
      en: 'Domicile/residence in Maharashtra as per department norms. Visit the official Mahaswayam portal for updated registration rules.',
      hi: 'महाराष्ट्र निवासी होना आवश्यक (विभागीय नियमों के अनुसार)। अद्यतन पात्रता के लिए आधिकारिक पोर्टल देखें।',
      mr: 'विभागीय नियमांनुसार महाराष्ट्र राज्याचे रहिवासी. अद्ययावत अटींसाठी अधिकृत पोर्टल पहा.',
    },
    documents: {
      en: 'Aadhaar card, Maharashtra domicile/residence proof, educational mark sheets, mobile number, and caste/category certificate (if applicable).',
      hi: 'आधार कार्ड, महाराष्ट्र निवास प्रमाणपत्र, शैक्षणिक अंकतालिका, मोबाइल नंबर और जाति प्रमाणपत्र (यदि लागू हो)।',
      mr: 'आधार कार्ड, महाराष्ट्र रहिवासी दाखला, शैक्षणिक गुणपत्रके, मोबाईल क्रमांक व जात प्रमाणपत्र (लागू असल्यास).',
    },
    applicationProcess: {
      en: 'Visit rojgar.mahaswayam.gov.in → Register as Jobseeker → Verify Aadhaar/mobile → Upload qualifications → Apply for open jobs and district job fairs.',
      hi: 'rojgar.mahaswayam.gov.in पर जाएं → Jobseeker पंजीकरण करें → आधार/मोबाइल सत्यापित करें → योग्यता भरें → नौकरी व जिला रोजगार मेले में आवेदन करें।',
      mr: 'rojgar.mahaswayam.gov.in वर जा → Jobseeker नोंदणी करा → आधार/मोबाईल पडताळणी करा → शैक्षणिक माहिती भरून नोकऱ्या व रोजगार मेळाव्यांसाठी अर्ज करा.',
    },
    officialUrl: 'https://rojgar.mahaswayam.gov.in',
    officialPortalLabel: 'rojgar.mahaswayam.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'pmkvy-skill-india',
    audience: 'unemployed',
    govLevel: 'central',
    name: {
      en: 'Pradhan Mantri Kaushal Vikas Yojana (PMKVY) / Skill India Digital Hub',
      hi: 'प्रधानमंत्री कौशल विकास योजना (PMKVY) / स्किल इंडिया डिजिटल हब',
      mr: 'प्रधानमंत्री कौशल्य विकास योजना (PMKVY) / स्किल इंडिया डिजिटल हब',
    },
    department: {
      en: 'Ministry of Skill Development & Entrepreneurship (MSDE) / NSDC, Government of India',
      hi: 'कौशल विकास एवं उद्यमिता मंत्रालय (MSDE) / NSDC, भारत सरकार',
      mr: 'कौशल्य विकास व उद्योजकता मंत्रालय (MSDE) / NSDC, भारत सरकार',
    },
    whoCanApply: {
      en: 'Unemployed youth, school/college dropouts, and existing workers seeking certified short-term training or Recognition of Prior Learning (RPL).',
      hi: 'बेरोजगार युवा, स्कूल/कॉलेज छोड़ चुके विद्यार्थी और पहले से कार्यरत कामगार जो प्रमाणित कौशल प्रशिक्षण (RPL/शॉर्ट-टर्म) लेना चाहते हैं।',
      mr: 'बेरोजगार युवक, शिक्षण सोडलेले विद्यार्थी आणि अनुभवी कामगार ज्यांना प्रमाणित कौशल्य प्रशिक्षण किंवा RPL प्रमाणपत्र हवे आहे.',
    },
    mainBenefits: {
      en: 'Industry-aligned short-term skill training, assessment, and government-recognized skill certification across technical, service, and rural trades.',
      hi: 'उद्योग-आधारित अल्पकालिक प्रशिक्षण, मूल्यांकन और तकनीकी, सेवा व ग्रामीण व्यवसायों में मान्यता प्राप्त कौशल प्रमाणपत्र।',
      mr: 'उद्योगानुरूप अल्पकालीन कौशल्य प्रशिक्षण, मूल्यमापन आणि तांत्रिक, सेवा व ग्रामीण क्षेत्रातील मान्यताप्राप्त प्रमाणपत्र.',
    },
    eligibility: {
      en: 'Indian nationality and age/education norms as specified per course under the active PMKVY phase on Skill India Digital Hub.',
      hi: 'भारतीय नागरिकता तथा पाठ्यक्रम के अनुसार आयु व शैक्षणिक पात्रता (आधिकारिक पोर्टल पर अद्यतन मानदंड देखें)।',
      mr: 'भारतीय नागरिकत्व आणि अभ्यासक्रमानुसार वय व शैक्षणिक पात्रता (अधिकृत पोर्टलवरील अद्ययावत अटी पहा).',
    },
    documents: {
      en: 'Aadhaar card, bank account details, mobile number, passport-size photo, and relevant education proof.',
      hi: 'आधार कार्ड, बैंक खाता विवरण, मोबाइल नंबर, पासपोर्ट फ़ोटो और शैक्षणिक प्रमाण।',
      mr: 'आधार कार्ड, बँक खाते तपशील, मोबाईल क्रमांक, पासपोर्ट फोटो व शैक्षणिक कागदपत्रे.',
    },
    applicationProcess: {
      en: 'Open skillindiadigital.gov.in → Register with mobile/Aadhaar eKYC → Search nearby Skill Centres & courses → Enrol in an eligible batch.',
      hi: 'skillindiadigital.gov.in खोलें → मोबाइल/आधार eKYC से पंजीकरण करें → नजदीकी प्रशिक्षण केंद्र व कोर्स चुनें → पात्र बैच में नामांकन करें।',
      mr: 'skillindiadigital.gov.in उघडा → मोबाईल/आधार eKYC द्वारे नोंदणी करा → जवळचे प्रशिक्षण केंद्र व कोर्स निवडा → पात्र तुकडीत प्रवेश घ्या.',
    },
    officialUrl: 'https://www.skillindiadigital.gov.in',
    officialPortalLabel: 'skillindiadigital.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'naps-apprenticeship',
    audience: 'unemployed',
    govLevel: 'central',
    name: {
      en: 'National Apprenticeship Promotion Scheme (NAPS)',
      hi: 'राष्ट्रीय शिक्षुता संवर्धन योजना (NAPS)',
      mr: 'राष्ट्रीय शिकाऊ उमेदवारी प्रोत्साहन योजना (NAPS)',
    },
    department: {
      en: 'Ministry of Skill Development & Entrepreneurship (MSDE), Government of India',
      hi: 'कौशल विकास एवं उद्यमिता मंत्रालय (MSDE), भारत सरकार',
      mr: 'कौशल्य विकास व उद्योजकता मंत्रालय (MSDE), भारत सरकार',
    },
    whoCanApply: {
      en: 'Youth, ITI graduates, 10th/12th pass candidates, and diploma holders seeking practical on-the-job industrial training.',
      hi: 'युवा, आईटीआई पास, 10वीं/12वीं उत्तीर्ण और डिप्लोमा धारक जो उद्योगों में व्यावहारिक प्रशिक्षण (अप्रेंटिसशिप) लेना चाहते हैं।',
      mr: 'युवक, आयटीआय उत्तीर्ण, १०वी/१२वी उत्तीर्ण आणि पदविकाधारक ज्यांना उद्योगांमध्ये प्रत्यक्ष शिकाऊ प्रशिक्षण घ्यायचे आहे.',
    },
    mainBenefits: {
      en: 'Hands-on industrial apprenticeship with participating establishments, monthly stipend as per Apprentices Act norms, and national apprenticeship certification.',
      hi: 'पंजीकृत उद्योगों में प्रत्यक्ष कार्य अनुभव, शिक्षुता अधिनियम के अनुसार मासिक स्टाइपेंड और राष्ट्रीय शिक्षुता प्रमाणपत्र।',
      mr: 'नोंदणीकृत उद्योगांमध्ये प्रत्यक्ष कामाचा अनुभव, शिकाऊ उमेदवारी कायद्यानुसार विद्यावेतन (स्टायपेंड) व राष्ट्रीय प्रमाणपत्र.',
    },
    eligibility: {
      en: 'Age and trade qualifications as prescribed under the Apprentices Act, 1961 and current NAPS guidelines.',
      hi: 'शिक्षुता अधिनियम 1961 और NAPS दिशानिर्देशों के अनुसार आयु व शैक्षणिक पात्रता।',
      mr: 'शिकाऊ उमेदवारी कायदा १९६१ आणि NAPS मार्गदर्शक तत्त्वांनुसार वय व शैक्षणिक पात्रता.',
    },
    documents: {
      en: 'Aadhaar card, educational/ITI mark sheets, bank account linked with Aadhaar, email ID, and mobile number.',
      hi: 'आधार कार्ड, शैक्षणिक/आईटीआई प्रमाणपत्र, आधार-लिंक्ड बैंक खाता, ईमेल और मोबाइल नंबर।',
      mr: 'आधार कार्ड, शैक्षणिक/आयटीआय प्रमाणपत्रे, आधार-संलग्न बँक खाते, ईमेल व मोबाईल क्रमांक.',
    },
    applicationProcess: {
      en: 'Visit apprenticeshipindia.gov.in → Candidate Registration → Complete eKYC & profile → Browse Apprenticeship Opportunities → Apply directly to establishments.',
      hi: 'apprenticeshipindia.gov.in पर जाएं → Candidate Registration करें → eKYC और प्रोफ़ाइल पूरा करें → अवसर खोजें और सीधे आवेदन करें।',
      mr: 'apprenticeshipindia.gov.in वर जा → Candidate Registration करा → eKYC व प्रोफाईल पूर्ण करा → संधी शोधून थेट अर्ज करा.',
    },
    officialUrl: 'https://www.apprenticeshipindia.gov.in',
    officialPortalLabel: 'apprenticeshipindia.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'cmykpy-maharashtra',
    audience: 'unemployed',
    govLevel: 'maharashtra',
    name: {
      en: 'Mukhyamantri Yuva Karya Prashikshan Yojana (CMYKPY — Maharashtra)',
      hi: 'मुख्यमंत्री युवा कार्य प्रशिक्षण योजना (CMYKPY — महाराष्ट्र)',
      mr: 'मुख्यमंत्री युवा कार्य प्रशिक्षण योजना (CMYKPY — महाराष्ट्र)',
    },
    department: {
      en: 'Skill, Employment, Entrepreneurship & Innovation Department, Government of Maharashtra',
      hi: 'कौशल, रोजगार, उद्यमिता एवं नवाचार विभाग, महाराष्ट्र शासन',
      mr: 'कौशल्य, रोजगार, उद्योजकता व नाविन्यता विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Eligible unemployed youth of Maharashtra (12th pass, ITI, Diploma, Graduate, Postgraduate) seeking internship/work experience.',
      hi: 'महाराष्ट्र के पात्र बेरोजगार युवा (12वीं, आईटीआई, डिप्लोमा, स्नातक, स्नातकोत्तर) जो कार्य प्रशिक्षण लेना चाहते हैं।',
      mr: 'महाराष्ट्रातील पात्र बेरोजगार युवक (१२वी, आयटीआय, पदविका, पदवी, पदव्युत्तर) ज्यांना प्रत्यक्ष कार्य प्रशिक्षण घ्यायचे आहे.',
    },
    mainBenefits: {
      en: 'Structured on-the-job work experience in participating private and public establishments with DBT stipend support as notified by the state government.',
      hi: 'भागीदार निजी व शासकीय प्रतिष्ठानों में प्रत्यक्ष कार्य अनुभव तथा राज्य शासन के नियमानुसार DBT विद्यावेतन सहायता।',
      mr: 'सहभागी खाजगी व शासकीय आस्थापनांमध्ये प्रत्यक्ष कामाचा अनुभव व राज्य शासनाच्या नियमांनुसार DBT विद्यावेतन सहाय्य.',
    },
    eligibility: {
      en: 'Maharashtra domicile, registered on Mahaswayam, and age/education criteria as per latest Government Resolution (GR). Check official portal for current intake status.',
      hi: 'महाराष्ट्र निवासी, महास्वयं पर पंजीकृत एवं नवीनतम शासन निर्णय (GR) के अनुसार आयु/शिक्षा पात्रता। वर्तमान आवेदन स्थिति के लिए पोर्टल देखें।',
      mr: 'महाराष्ट्र रहिवासी, महास्वयंम नोंदणी व अद्ययावत शासन निर्णयानुसार (GR) वय व शिक्षण पात्रता. सद्यस्थितीसाठी अधिकृत पोर्टल पहा.',
    },
    documents: {
      en: 'Aadhaar card, Maharashtra domicile proof, educational certificates, and Aadhaar-seeded bank account.',
      hi: 'आधार कार्ड, निवास प्रमाणपत्र, शैक्षणिक प्रमाणपत्र और आधार-सीडेड बैंक खाता।',
      mr: 'आधार कार्ड, रहिवासी दाखला, शैक्षणिक प्रमाणपत्रे व आधार-संलग्न बँक खाते.',
    },
    applicationProcess: {
      en: 'Log in to rojgar.mahaswayam.gov.in → Open CMYKPY section → Verify eligibility & profile → Apply to available establishment openings.',
      hi: 'rojgar.mahaswayam.gov.in पर लॉगिन करें → CMYKPY अनुभाग खोलें → पात्रता व प्रोफ़ाइल सत्यापित करें → उपलब्ध प्रशिक्षण पदों के लिए आवेदन करें।',
      mr: 'rojgar.mahaswayam.gov.in वर लॉगिन करा → CMYKPY विभाग उघडा → पात्रता तपासून उपलब्ध प्रशिक्षण जागांसाठी अर्ज करा.',
    },
    officialUrl: 'https://rojgar.mahaswayam.gov.in',
    officialPortalLabel: 'rojgar.mahaswayam.gov.in',
  },

  // =========================================================================
  // B. WORKERS & UNORGANISED LABOUR (कामगारों के लिए)
  // =========================================================================
  {
    id: 'eshram-portal',
    audience: 'workers',
    govLevel: 'central',
    name: {
      en: 'e-Shram — National Database of Unorganised Workers (NDUW)',
      hi: 'ई-श्रम — असंगठित कामगार राष्ट्रीय डेटाबेस (e-Shram)',
      mr: 'ई-श्रम — असंघटित कामगार राष्ट्रीय नोंदणी (e-Shram)',
    },
    department: {
      en: 'Ministry of Labour & Employment, Government of India',
      hi: 'श्रम एवं रोजगार मंत्रालय, भारत सरकार',
      mr: 'कामगार व रोजगार मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Unorganised workers including construction workers, migrant workers, gig/platform workers, domestic workers, street vendors, and agricultural labourers.',
      hi: 'असंगठित क्षेत्र के सभी कामगार — निर्माण श्रमिक, प्रवासी कामगार, गिग/प्लेटफॉर्म वर्कर, घरेलू कामगार, फेरीवाले और कृषि श्रमिक।',
      mr: 'असंघटित क्षेत्रातील सर्व कामगार — बांधकाम कामगार, स्थलांतरित मजूर, गिग/प्लॅटफॉर्म कामगार, घरकामगार, फेरीवाले व शेतमजूर.',
    },
    mainBenefits: {
      en: 'Free Universal Account Number (UAN) e-Shram card, unified access to central social security schemes, job linkages via NCS, and welfare delivery support.',
      hi: 'निःशुल्क यूनिवर्सल अकाउंट नंबर (UAN) ई-श्रम कार्ड, सामाजिक सुरक्षा योजनाओं से जुड़ाव और NCS के माध्यम से रोजगार लिंक।',
      mr: 'मोफत युनिव्हर्सल अकाउंट नंबर (UAN) ई-श्रम कार्ड, सामाजिक सुरक्षा योजनांचा लाभ व NCS द्वारे रोजगार संधींशी जोडणी.',
    },
    eligibility: {
      en: 'Unorganised worker aged as per e-Shram portal guidelines who is not an EPFO/ESIC member or income-tax payee. Verify exact rules on eshram.gov.in.',
      hi: 'असंगठित कामगार जो EPFO/ESIC सदस्य या आयकरदाता नहीं हैं (आधिकारिक पोर्टल पर आयु व पात्रता नियम देखें)।',
      mr: 'EPFO/ESIC सदस्य किंवा आयकरदाता नसलेले असंघटित कामगार (अचूक वय व अटींसाठी eshram.gov.in पहा).',
    },
    documents: {
      en: 'Aadhaar number, Aadhaar-linked mobile number, and active savings bank account with IFSC code.',
      hi: 'आधार संख्या, आधार से जुड़ा मोबाइल नंबर और IFSC कोड सहित सक्रिय बैंक खाता।',
      mr: 'आधार क्रमांक, आधारशी जोडलेला मोबाईल क्रमांक आणि IFSC कोडसह सक्रिय बँक खाते.',
    },
    applicationProcess: {
      en: 'Visit eshram.gov.in (or nearest CSC centre) → Click "Register on e-Shram" → Verify Aadhaar OTP → Enter occupation & bank details → Download UAN Card.',
      hi: 'eshram.gov.in पर जाएं (या नजदीकी CSC केंद्र) → "Register on e-Shram" चुनें → आधार OTP सत्यापित करें → व्यवसाय व बैंक विवरण भरकर UAN कार्ड डाउनलोड करें।',
      mr: 'eshram.gov.in वर जा (किंवा जवळच्या CSC केंद्रात) → "Register on e-Shram" निवडा → आधार OTP पडताळून व्यवसाय व बँक माहिती भरा आणि UAN कार्ड डाउनलोड करा.',
    },
    officialUrl: 'https://eshram.gov.in',
    officialPortalLabel: 'eshram.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'mahabocw-construction',
    audience: 'workers',
    govLevel: 'maharashtra',
    name: {
      en: 'Maharashtra Building & Other Construction Workers Welfare Board (MAHABOCW)',
      hi: 'महाराष्ट्र भवन एवं अन्य निर्माण कामगार कल्याण मंडल (MAHABOCW)',
      mr: 'महाराष्ट्र इमारत व इतर बांधकाम कामगार कल्याणकारी मंडळ (MAHABOCW)',
    },
    department: {
      en: 'Industries, Energy & Labour Department, Government of Maharashtra',
      hi: 'उद्योग, ऊर्जा एवं श्रम विभाग, महाराष्ट्र शासन',
      mr: 'उद्योग, ऊर्जा व कामगार विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Building and construction workers (masons, helpers, painters, electricians, plumbers, carpenters, tile-fitters, etc.) working in Maharashtra.',
      hi: 'महाराष्ट्र में कार्यरत भवन व निर्माण श्रमिक (राजमिस्त्री, हेल्पर, पेंटर, इलेक्ट्रीशियन, प्लंबर, बढ़ई आदि)।',
      mr: 'महाराष्ट्रात कार्यरत बांधकाम कामगार (गवंडी, हेल्पर, पेंटर, इलेक्ट्रिशियन, प्लंबर, सुतार, टाईल्स फिटर्स इ.).',
    },
    mainBenefits: {
      en: 'Registered construction workers may access state welfare schemes covering safety kits, health checkups, children’s education assistance, maternity/medical aid, and pension/accident support per board norms.',
      hi: 'पंजीकृत निर्माण श्रमिकों को मंडल के नियमों के अनुसार सुरक्षा किट, स्वास्थ्य, बच्चों की शिक्षा सहायता, मातृत्व/चिकित्सा एवं दुर्घटना कल्याण योजनाओं का लाभ मिलता है।',
      mr: 'नोंदणीकृत बांधकाम कामगारांना मंडळाच्या नियमांनुसार सुरक्षा संच, आरोग्य तपासणी, पाल्यांसाठी शैक्षणिक सहाय्य, वैद्यकीय व अपघात कल्याण योजनांचा लाभ मिळतो.',
    },
    eligibility: {
      en: 'Construction worker working in Maharashtra who meets the board’s age and minimum working-days certification rules. Check mahabocw.in for latest GR norms.',
      hi: 'महाराष्ट्र में कार्यरत निर्माण श्रमिक जो मंडल की आयु व न्यूनतम कार्यदिवस प्रमाणपत्र शर्तों को पूरा करते हों। नवीनतम नियमों के लिए mahabocw.in देखें।',
      mr: 'महाराष्ट्रात कार्यरत बांधकाम कामगार ज्यांनी मंडळाच्या वयोमर्यादा व किमान कामाच्या दिवसांच्या प्रमाणपत्राच्या अटी पूर्ण केल्या आहेत.',
    },
    documents: {
      en: 'Aadhaar card, age & residence proof, 90-day construction work certificate from authorized authority/contractor, bank passbook, and passport photos.',
      hi: 'आधार कार्ड, आयु व निवास प्रमाण, अधिकृत अधिकारी/ठेकेदार द्वारा 90 दिन का कार्य प्रमाणपत्र, बैंक पासबुक और फ़ोटो।',
      mr: 'आधार कार्ड, वय व रहिवासी पुरावा, अधिकृत अधिकारी/कंत्राटदाराचे ९० दिवस कामाचे प्रमाणपत्र, बँक पासबुक व पासपोर्ट फोटो.',
    },
    applicationProcess: {
      en: 'Visit mahabocw.in → Worker Online Registration → Enter Aadhaar & work details → Upload certificates → Complete verification at designated Taluka/District Facilitation Centre.',
      hi: 'mahabocw.in पर जाएं → Worker Online Registration चुनें → आधार व कार्य विवरण भरें → दस्तावेज़ अपलोड कर तालुका/जिला सुविधा केंद्र में सत्यापन कराएं।',
      mr: 'mahabocw.in वर जा → कामगार ऑनलाइन नोंदणी निवडा → आधार व कामाचा तपशील भरून तालुका/जिल्हा सुविधा केंद्रावर पडताळणी पूर्ण करा.',
    },
    officialUrl: 'https://mahabocw.in',
    officialPortalLabel: 'mahabocw.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'pm-sym-pension',
    audience: 'workers',
    govLevel: 'central',
    name: {
      en: 'Pradhan Mantri Shram Yogi Maan-Dhan (PM-SYM) Pension Yojana',
      hi: 'प्रधानमंत्री श्रम योगी मान-धन (PM-SYM) पेंशन योजना',
      mr: 'प्रधानमंत्री श्रम योगी मान-धन (PM-SYM) पेन्शन योजना',
    },
    department: {
      en: 'Ministry of Labour & Employment, Government of India',
      hi: 'श्रम एवं रोजगार मंत्रालय, भारत सरकार',
      mr: 'कामगार व रोजगार मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Unorganised workers (daily wage earners, home-based workers, street vendors, drivers, helpers, cobblers, rickshaw pullers, etc.) seeking old-age pension security.',
      hi: 'असंगठित क्षेत्र के कामगार (दैनिक वेतनभोगी, चालक, हेल्पर, फेरीवाले, घरेलू कामगार आदि) जो वृद्धावस्था पेंशन सुरक्षा चाहते हैं।',
      mr: 'असंघटित क्षेत्रातील कामगार (रोजंदारी मजूर, चालक, हेल्पर, फेरीवाले, घरकामगार इ.) ज्यांना वृद्धापकाळासाठी पेन्शन संरक्षण हवे आहे.',
    },
    mainBenefits: {
      en: 'Voluntary contributory pension scheme with matching central government contribution to provide monthly pension after age 60 as per scheme terms.',
      hi: 'स्वैच्छिक अंशदायी पेंशन योजना जिसमें केंद्र सरकार का समतुल्य योगदान होता है और 60 वर्ष की आयु के बाद योजना शर्तों के अनुसार मासिक पेंशन मिलती है।',
      mr: 'स्वैच्छिक अंशदायी पेन्शन योजना ज्यात केंद्र शासनाचा समसमान वाटा असतो आणि वयाच्या ६० वर्षांनंतर योजनेच्या अटींनुसार मासिक पेन्शन मिळते.',
    },
    eligibility: {
      en: 'Unorganised worker within prescribed entry age and monthly income limit, not covered under NPS/ESIC/EPFO and not an income-tax payer. Verify exact limits on maandhan.in.',
      hi: 'निर्धारित प्रवेश आयु व मासिक आय सीमा के भीतर असंगठित कामगार जो NPS/ESIC/EPFO व आयकर के दायरे में न हों। सटीक शर्तों के लिए maandhan.in देखें।',
      mr: 'निर्धारित वयोमर्यादा व उत्पन्न मर्यादेतील असंघटित कामगार जे NPS/ESIC/EPFO किंवा आयकराखाली येत नाहीत. अचूक अटी maandhan.in वर पहा.',
    },
    documents: {
      en: 'Aadhaar card, savings bank account / Jan Dhan account number with IFSC code, and mobile number.',
      hi: 'आधार कार्ड, IFSC कोड सहित बचत/जन-धन बैंक खाता और मोबाइल नंबर।',
      mr: 'आधार कार्ड, IFSC कोडसह बचत किंवा जन-धन बँक खाते आणि मोबाईल क्रमांक.',
    },
    applicationProcess: {
      en: 'Self-enrol on maandhan.in or visit your nearest Common Service Centre (CSC) with Aadhaar and bank passbook to activate auto-debit pension contribution.',
      hi: 'maandhan.in पर स्वयं पंजीकरण करें या आधार व बैंक पासबुक लेकर नजदीकी CSC केंद्र से नामांकन कराएं।',
      mr: 'maandhan.in वर स्वतः नोंदणी करा किंवा आधार व बँक पासबुकसह जवळच्या CSC केंद्रात जाऊन नोंदणी करा.',
    },
    officialUrl: 'https://maandhan.in',
    officialPortalLabel: 'maandhan.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'jansuraksha-insurance',
    audience: 'workers',
    govLevel: 'central',
    name: {
      en: 'Jan Suraksha Insurance Schemes (PMSBY & PMJJBY)',
      hi: 'जन सुरक्षा बीमा योजनाएं (PMSBY एवं PMJJBY)',
      mr: 'जन सुरक्षा विमा योजना (PMSBY व PMJJBY)',
    },
    department: {
      en: 'Department of Financial Services, Ministry of Finance, Government of India',
      hi: 'वित्तीय सेवा विभाग, वित्त मंत्रालय, भारत सरकार',
      mr: 'वित्तीय सेवा विभाग, अर्थ मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Workers, daily-wage earners, and citizens holding a savings bank or post office account in India.',
      hi: 'बचत बैंक या डाकघर खाता रखने वाले कामगार और भारतीय नागरिक।',
      mr: 'बचत बँक किंवा पोस्ट खाते असलेले सर्व कामगार आणि भारतीय नागरिक.',
    },
    mainBenefits: {
      en: 'Affordable annual renewable accidental death/disability insurance (PMSBY) and life insurance cover (PMJJBY) through participating banks.',
      hi: 'सहभागी बैंकों के माध्यम से किफायती वार्षिक नवीकरणीय दुर्घटना बीमा (PMSBY) और जीवन बीमा सुरक्षा (PMJJBY)।',
      mr: 'सहभागी बँकांमार्फत परवडणारा वार्षिक अपघात विमा (PMSBY) आणि जीवन विमा संरक्षण (PMJJBY).',
    },
    eligibility: {
      en: 'Savings bank/post office account holders meeting the age bands prescribed for PMSBY and PMJJBY on jansuraksha.gov.in.',
      hi: 'jansuraksha.gov.in पर PMSBY और PMJJBY के लिए निर्धारित आयु सीमा पूरी करने वाले बैंक/डाकघर खाताधारक।',
      mr: 'jansuraksha.gov.in वरील PMSBY व PMJJBY साठी निर्धारित वयोमर्यादेतील बँक/पोस्ट खातेधारक.',
    },
    documents: {
      en: 'Active bank/post office account, Aadhaar/KYC details, nominee details, and consent form for auto-debit.',
      hi: 'सक्रिय बैंक/डाकघर खाता, आधार/KYC विवरण, नॉमिनी जानकारी और ऑटो-डेबिट सहमति फॉर्म।',
      mr: 'सक्रिय बँक/पोस्ट खाते, आधार/KYC तपशील, वारसदार माहिती व ऑटो-डेबिट संमती फॉर्म.',
    },
    applicationProcess: {
      en: 'Check scheme rules at jansuraksha.gov.in → Apply via your bank branch, Bank Mitra / BC, or bank netbanking/mobile app.',
      hi: 'jansuraksha.gov.in पर नियम देखें → अपनी बैंक शाखा, बैंक मित्र या मोबाइल/नेटबैंकिंग ऐप के माध्यम से नामांकन करें।',
      mr: 'jansuraksha.gov.in वर माहिती पहा → आपल्या बँक शाखेत, बँक मित्र किंवा बँकेच्या अ‍ॅपद्वारे नोंदणी करा.',
    },
    officialUrl: 'https://jansuraksha.gov.in',
    officialPortalLabel: 'jansuraksha.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'ayushman-pmjay-mjpjay',
    audience: 'workers',
    govLevel: 'joint',
    name: {
      en: 'Ayushman Bharat (PM-JAY) & Mahatma Jyotirao Phule Jan Arogya Yojana',
      hi: 'आयुष्मान भारत (PM-JAY) एवं महात्मा ज्योतिराव फुले जन आरोग्य योजना',
      mr: 'आयुष्मान भारत (PM-JAY) व महात्मा ज्योतिराव फुले जन आरोग्य योजना',
    },
    department: {
      en: 'National Health Authority (GoI) & State Health Assurance Society, Maharashtra',
      hi: 'राष्ट्रीय स्वास्थ्य प्राधिकरण (भारत सरकार) एवं राज्य आरोग्य हमी सोसायटी, महाराष्ट्र',
      mr: 'राष्ट्रीय आरोग्य प्राधिकरण (भारत सरकार) व राज्य आरोग्य हमी सोसायटी, महाराष्ट्र',
    },
    whoCanApply: {
      en: 'Eligible families and workers seeking cashless secondary and tertiary hospitalisation cover at empanelled hospitals.',
      hi: 'पात्र परिवार एवं कामगार जो सूचीबद्ध अस्पतालों में कैशलेस चिकित्सा उपचार के लिए पात्र हैं।',
      mr: 'पात्र कुटुंबे व कामगार ज्यांना संलग्न रुग्णालयांमध्ये कॅशलेस उपचारांचा लाभ घेता येतो.',
    },
    mainBenefits: {
      en: 'Cashless hospitalisation coverage across listed procedures at empanelled public and private hospitals as per central/state health guidelines.',
      hi: 'केंद्र व राज्य स्वास्थ्य दिशानिर्देशों के अनुसार सूचीबद्ध सरकारी व निजी अस्पतालों में कैशलेस उपचार सुविधा।',
      mr: 'केंद्र व राज्य आरोग्य मार्गदर्शक तत्त्वांनुसार संलग्न शासकीय व खाजगी रुग्णालयांमध्ये कॅशलेस उपचार सुविधा.',
    },
    eligibility: {
      en: 'Eligibility is verified via Ayushman Beneficiary Portal / Maharashtra ration card & domicile rules. Check beneficiary status online.',
      hi: 'पात्रता की जांच आयुष्मान लाभार्थी पोर्टल / महाराष्ट्र राशन कार्ड नियमों के आधार पर की जाती है।',
      mr: 'पात्रता आयुष्मान लाभार्थी पोर्टल / महाराष्ट्र रेशन कार्ड व राज्य नियमांनुसार तपासली जाते.',
    },
    documents: {
      en: 'Aadhaar card, Ration card / family ID, mobile number, and domicile proof (for Maharashtra state coverage).',
      hi: 'आधार कार्ड, राशन कार्ड / परिवार आईडी, मोबाइल नंबर और निवास प्रमाण (महाराष्ट्र योजना हेतु)।',
      mr: 'आधार कार्ड, रेशन कार्ड / कुटुंब ओळखपत्र, मोबाईल क्रमांक व रहिवासी दाखला.',
    },
    applicationProcess: {
      en: 'Visit beneficiary.nha.gov.in or pmjay.gov.in → Verify family eligibility → Complete eKYC to download Ayushman Card or visit an empanelled hospital Aarogyamitra desk.',
      hi: 'pmjay.gov.in या beneficiary.nha.gov.in पर पात्रता जांचें → eKYC पूरा कर आयुष्मान कार्ड प्राप्त करें या अस्पताल के आरोग्यमित्र डेस्क से संपर्क करें।',
      mr: 'pmjay.gov.in वर पात्रता तपासा → eKYC पूर्ण करून आयुष्मान कार्ड मिळवा किंवा संलग्न रुग्णालयातील आरोग्यमित्र कक्षात संपर्क साधा.',
    },
    officialUrl: 'https://pmjay.gov.in',
    officialPortalLabel: 'pmjay.gov.in',
    lastVerifiedDate: 'April 2026',
  },

  // =========================================================================
  // C. ENTREPRENEURS & SMALL BUSINESSES (उद्योजकों के लिए)
  // =========================================================================
  {
    id: 'pmegp-central',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: "Prime Minister's Employment Generation Programme (PMEGP)",
      hi: 'प्रधानमंत्री रोजगार सृजन कार्यक्रम (PMEGP)',
      mr: 'पंतप्रधान रोजगार निर्मिती कार्यक्रम (PMEGP)',
    },
    department: {
      en: 'Ministry of Micro, Small & Medium Enterprises (MSME) / KVIC, Government of India',
      hi: 'सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय (MSME) / KVIC, भारत सरकार',
      mr: 'सूक्ष्म, लघु व मध्यम उद्योग मंत्रालय (MSME) / KVIC, भारत सरकार',
    },
    whoCanApply: {
      en: 'Aspiring entrepreneurs, self-help groups, societies, and artisans setting up new micro-enterprises in manufacturing or service sectors.',
      hi: 'नए सूक्ष्म उद्योग या सेवा व्यवसाय शुरू करने के इच्छुक उद्यमी, स्वयं सहायता समूह, संस्थाएं और कारीगर।',
      mr: 'उत्पादन किंवा सेवा क्षेत्रात नवीन सूक्ष्म उद्योग सुरू करू इच्छिणारे उद्योजक, बचत गट, संस्था व कारागीर.',
    },
    mainBenefits: {
      en: 'Credit-linked margin money subsidy through banks for setting up new non-farm micro-enterprises, plus EDP training support as per KVIC norms.',
      hi: 'नए गैर-कृषि सूक्ष्म उद्यम स्थापित करने के लिए बैंकों के माध्यम से क्रेडिट-लिंक्ड मार्जिन मनी सब्सिडी तथा EDP प्रशिक्षण सहायता (KVIC नियमों के अनुसार)।',
      mr: 'नवीन बिगर-शेती सूक्ष्म उद्योग सुरू करण्यासाठी बँकांमार्फत कर्ज-संलग्न मार्जिन मनी अनुदान व EDP प्रशिक्षण सहाय्य (KVIC नियमांनुसार).',
    },
    eligibility: {
      en: 'Applicants meeting age, educational qualification (where project cost requires), and new-unit norms defined by KVIC. Check the official PMEGP portal for current caps and subsidy rates.',
      hi: 'KVIC द्वारा निर्धारित आयु, शैक्षणिक योग्यता और नई इकाई की शर्तें पूरी करने वाले आवेदक। वर्तमान सीमा व सब्सिडी दरों के लिए आधिकारिक पोर्टल देखें।',
      mr: 'KVIC ने निर्धारित केलेल्या वय, शैक्षणिक पात्रता व नवीन प्रकल्प अटी पूर्ण करणारे अर्जदार. अद्ययावत अनुदान दरांसाठी अधिकृत पोर्टल पहा.',
    },
    documents: {
      en: 'Aadhaar card, PAN card, detailed project report (DPR), educational certificate, category/special category certificate (if applicable), and rural/urban area proof.',
      hi: 'आधार कार्ड, पैन कार्ड, प्रोजेक्ट रिपोर्ट (DPR), शैक्षणिक प्रमाणपत्र, वर्ग प्रमाणपत्र (यदि लागू हो) और क्षेत्र प्रमाण।',
      mr: 'आधार कार्ड, पॅन कार्ड, प्रकल्प अहवाल (DPR), शैक्षणिक प्रमाणपत्र, प्रवर्ग दाखला (लागू असल्यास) व ग्रामीण/शहरी दाखला.',
    },
    applicationProcess: {
      en: 'Visit kviconline.gov.in/pmegpeportal → Fill Online Application for New Unit → Upload documents & DPR → Submit for agency screening & financing bank appraisal.',
      hi: 'kviconline.gov.in/pmegpeportal पर जाएं → नए उद्यम का ऑनलाइन आवेदन भरें → दस्तावेज़ व DPR अपलोड करें → एजेंसी व बैंक मूल्यांकन के लिए सबमिट करें।',
      mr: 'kviconline.gov.in/pmegpeportal वर जा → नवीन प्रकल्पाचा ऑनलाइन अर्ज भरा → कागदपत्रे व DPR अपलोड करून बँक छाननीसाठी सबमिट करा.',
    },
    officialUrl: 'https://www.kviconline.gov.in/pmegpeportal/',
    officialPortalLabel: 'kviconline.gov.in/pmegpeportal',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'cmegp-maharashtra',
    audience: 'entrepreneurs',
    govLevel: 'maharashtra',
    name: {
      en: "Chief Minister's Employment Generation Programme (CMEGP — Maharashtra)",
      hi: 'मुख्यमंत्री रोजगार सृजन कार्यक्रम (CMEGP — महाराष्ट्र)',
      mr: 'मुख्यमंत्री रोजगार निर्मिती कार्यक्रम (CMEGP — महाराष्ट्र)',
    },
    department: {
      en: 'Directorate of Industries, Government of Maharashtra',
      hi: 'उद्योग निदेशालय, महाराष्ट्र शासन',
      mr: 'उद्योग संचालनालय, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Educated unemployed youth, women entrepreneurs, SC/ST/OBC/general applicants domiciled in Maharashtra starting new manufacturing, service, or agro-based units.',
      hi: 'महाराष्ट्र के निवासी शिक्षित बेरोजगार युवा, महिला उद्यमी और छोटे व्यवसायी जो नए विनिर्माण, सेवा या कृषि-आधारित उद्योग शुरू करना चाहते हैं।',
      mr: 'महाराष्ट्राचे रहिवासी असलेले सुशिक्षित बेरोजगार युवक, महिला उद्योजक व लघू उद्योजक जे उत्पादन, सेवा किंवा कृषी-आधारित उद्योग सुरू करू इच्छितात.',
    },
    mainBenefits: {
      en: 'State credit-linked capital subsidy and bank loan facilitation for eligible new micro and small enterprises in rural and urban Maharashtra.',
      hi: 'ग्रामीण एवं शहरी महाराष्ट्र में नए सूक्ष्म व लघु उद्यमों के लिए राज्य सरकार की क्रेडिट-लिंक्ड पूंजी सब्सिडी और बैंक ऋण सुविधा।',
      mr: 'ग्रामीण व शहरी महाराष्ट्रात नवीन सूक्ष्म व लघु उद्योगांसाठी राज्य शासनाचे कर्ज-संलग्न भांडवली अनुदान व बँक कर्ज सहाय्य.',
    },
    eligibility: {
      en: 'Maharashtra domicile, prescribed age band, educational criteria by project size, and family income/new-unit rules per latest Maharashtra Industries GR.',
      hi: 'महाराष्ट्र निवास, निर्धारित आयु सीमा, परियोजना आकार के अनुसार शिक्षा एवं नवीनतम महाराष्ट्र उद्योग शासन निर्णय की शर्तें।',
      mr: 'महाराष्ट्र रहिवासी, निर्धारित वयोमर्यादा, प्रकल्पानुसार शिक्षण व अद्ययावत महाराष्ट्र उद्योग शासन निर्णयाच्या अटी.',
    },
    documents: {
      en: 'Aadhaar card, Maharashtra domicile certificate, passport photo, education certificate, project report, and caste/special category certificate (if applicable).',
      hi: 'आधार कार्ड, महाराष्ट्र निवास प्रमाणपत्र, पासपोर्ट फ़ोटो, शिक्षा प्रमाणपत्र, प्रोजेक्ट रिपोर्ट और वर्ग प्रमाणपत्र (यदि लागू हो)।',
      mr: 'आधार कार्ड, महाराष्ट्र रहिवासी दाखला, पासपोर्ट फोटो, शैक्षणिक प्रमाणपत्र, प्रकल्प अहवाल व प्रवर्ग दाखला (लागू असल्यास).',
    },
    applicationProcess: {
      en: 'Visit maha-cmegp.gov.in → Register applicant account → Complete online application & upload DPR → District Industries Centre (DIC) / KVIB review & bank sanction.',
      hi: 'maha-cmegp.gov.in पर जाएं → आवेदक पंजीकरण करें → ऑनलाइन फॉर्म व DPR अपलोड करें → जिला उद्योग केंद्र (DIC) / KVIB व बैंक द्वारा स्वीकृति प्रक्रिया।',
      mr: 'maha-cmegp.gov.in वर जा → अर्जदार नोंदणी करा → ऑनलाइन अर्ज व DPR अपलोड करा → जिल्हा उद्योग केंद्र (DIC) व बँक मंजुरी प्रक्रिया पूर्ण करा.',
    },
    officialUrl: 'https://maha-cmegp.gov.in',
    officialPortalLabel: 'maha-cmegp.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'mudra-pmmy',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: 'Pradhan Mantri MUDRA Yojana (PMMY)',
      hi: 'प्रधानमंत्री मुद्रा योजना (PMMY)',
      mr: 'प्रधानमंत्री मुद्रा योजना (PMMY)',
    },
    department: {
      en: 'Department of Financial Services, Ministry of Finance, Government of India',
      hi: 'वित्तीय सेवा विभाग, वित्त मंत्रालय, भारत सरकार',
      mr: 'वित्तीय सेवा विभाग, अर्थ मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Small shopkeepers, micro-entrepreneurs, artisans, repair workshops, fruit/vegetable vendors, small service providers, and non-farm micro enterprises.',
      hi: 'छोटे दुकानदार, सूक्ष्म उद्यमी, कारीगर, रिपेयर वर्कशॉप, सेवा प्रदाता और गैर-कृषि लघु व्यवसायी।',
      mr: 'लहान दुकानदार, सूक्ष्म उद्योजक, कारागीर, रिपेअर वर्कशॉप, सेवा व्यावसायिक आणि बिगर-शेती लघु उद्योजक.',
    },
    mainBenefits: {
      en: 'Collateral-free institutional business loans (Shishu, Kishore, Tarun categories) through commercial banks, RRBs, Small Finance Banks, and NBFC-MFIs as per RBI/MUDRA norms.',
      hi: 'बैंकों, RRB, स्मॉल फाइनेंस बैंक व NBFC-MFI के माध्यम से बिना गारंटी के सूक्ष्म व्यवसाय ऋण (शिशु, किशोर, तरुण श्रेणियां — आधिकारिक मानदंडों के अनुसार)।',
      mr: 'बँका, RRB, स्मॉल फायनान्स बँक व NBFC-MFI मार्फत विनातारण व्यवसाय कर्ज (शिशू, किशोर, तरुण वर्ग — अधिकृत नियमांनुसार).',
    },
    eligibility: {
      en: 'Any Indian citizen with a viable non-farm income-generating business plan and satisfactory credit history as assessed by the lending institution.',
      hi: 'कोई भी भारतीय नागरिक जिसके पास व्यवहार्य गैर-कृषि व्यवसाय योजना हो (ऋण पात्रता व शर्तें ऋणदाता बैंक द्वारा तय होती हैं)।',
      mr: 'कोणताही भारतीय नागरिक ज्याच्याकडे व्यवहार्य बिगर-शेती व्यवसाय योजना आहे (कर्ज मंजुरी बँकेच्या निकषांनुसार असते).',
    },
    documents: {
      en: 'Identity proof (Aadhaar/PAN), address proof, business proof/quotation, passport photos, and bank statements (as required by the bank).',
      hi: 'पहचान प्रमाण (आधार/पैन), पता प्रमाण, व्यवसाय/मशीनरी कोटेशन, फ़ोटो और बैंक स्टेटमेंट (बैंक के अनुसार)।',
      mr: 'ओळखपत्र (आधार/पॅन), पत्ता पुरावा, व्यवसाय/मशीनरी कोटेशन, फोटो व बँक स्टेटमेंट (बँकेच्या गरजेनुसार).',
    },
    applicationProcess: {
      en: 'Review categories at mudra.org.in → Apply online via JanSamarth Portal (jansamarth.in) or directly at any participating bank branch.',
      hi: 'mudra.org.in पर जानकारी पढ़ें → जनसमर्थ पोर्टल (jansamarth.in) या किसी भी सहभागी बैंक शाखा से सीधे आवेदन करें।',
      mr: 'mudra.org.in वर माहिती पहा → जनसमर्थ पोर्टल (jansamarth.in) किंवा सहभागी बँक शाखेत थेट अर्ज करा.',
    },
    officialUrl: 'https://www.mudra.org.in',
    officialPortalLabel: 'mudra.org.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'standup-india',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: 'Stand-Up India Scheme',
      hi: 'स्टैंड-अप इंडिया योजना (Stand-Up India)',
      mr: 'स्टँड-अप इंडिया योजना (Stand-Up India)',
    },
    department: {
      en: 'Department of Financial Services (DFS) / SIDBI, Government of India',
      hi: 'वित्तीय सेवा विभाग (DFS) / SIDBI, भारत सरकार',
      mr: 'वित्तीय सेवा विभाग (DFS) / SIDBI, भारत सरकार',
    },
    whoCanApply: {
      en: 'Scheduled Caste (SC), Scheduled Tribe (ST), and Women entrepreneurs setting up a greenfield enterprise in manufacturing, services, trading, or agri-allied sectors.',
      hi: 'अनुसूचित जाति (SC), अनुसूचित जनजाति (ST) और महिला उद्यमी जो नया (ग्रीनफील्ड) व्यवसाय शुरू करना चाहते हैं।',
      mr: 'अनुसूचित जाती (SC), अनुसूचित जमाती (ST) आणि महिला उद्योजक जे नवीन (ग्रीनफिल्ड) उद्योग सुरू करू इच्छितात.',
    },
    mainBenefits: {
      en: 'Bank loan facilitation for greenfield enterprises along with handholding support through the Stand-Up Mitra portal and District Lead Bank network.',
      hi: 'नए उद्यमों के लिए अनुसूचित वाणिज्यिक बैंकों से ऋण सुविधा और स्टैंड-अप मित्र पोर्टल के माध्यम से मार्गदर्शन सहायता।',
      mr: 'नवीन उद्योगांसाठी अनुसूचित वाणिज्यिक बँकांद्वारे कर्ज सहाय्य व स्टँड-अप मित्र पोर्टलद्वारे मार्गदर्शन सुविधा.',
    },
    eligibility: {
      en: 'SC/ST and/or Women entrepreneurs aged 18+ starting a first-time greenfield venture (in non-individual units, majority shareholding/control by SC/ST or Woman). Verify full terms on standupmitra.in.',
      hi: '18 वर्ष से अधिक आयु के SC/ST या महिला उद्यमी जो पहला ग्रीनफील्ड उद्यम स्थापित कर रहे हों। विस्तृत शर्तें standupmitra.in पर देखें।',
      mr: '१८ वर्षांवरील SC/ST किंवा महिला उद्योजक जे पहिला ग्रीनफिल्ड उद्योग सुरू करत आहेत. सविस्तर अटी standupmitra.in वर पहा.',
    },
    documents: {
      en: 'Identity & address proof, SC/ST certificate (where applicable), business/project plan, PAN, and bank-requested KYC/financial papers.',
      hi: 'पहचान व पता प्रमाण, SC/ST प्रमाणपत्र (जहां लागू हो), व्यवसाय योजना, पैन और बैंक द्वारा आवश्यक दस्तावेज़।',
      mr: 'ओळख व पत्ता पुरावा, SC/ST प्रमाणपत्र (लागू असल्यास), व्यवसाय योजना, पॅन व बँकेला आवश्यक कागदपत्रे.',
    },
    applicationProcess: {
      en: 'Register on standupmitra.in → Access handholding/training support → Submit loan application directly to a bank branch or via Lead District Manager (LDM).',
      hi: 'standupmitra.in पर पंजीकरण करें → मार्गदर्शन प्राप्त करें → सीधे बैंक शाखा या जिला अग्रणी प्रबंधक (LDM) के माध्यम से आवेदन करें।',
      mr: 'standupmitra.in वर नोंदणी करा → मार्गदर्शन घ्या → थेट बँक शाखा किंवा जिल्हा अग्रणी व्यवस्थापक (LDM) मार्फत अर्ज करा.',
    },
    officialUrl: 'https://www.standupmitra.in',
    officialPortalLabel: 'standupmitra.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'startup-india',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: 'Startup India (DPIIT Recognition & Support)',
      hi: 'स्टार्टअप इंडिया (DPIIT मान्यता एवं सहायता)',
      mr: 'स्टार्टअप इंडिया (DPIIT मान्यता व सहाय्य)',
    },
    department: {
      en: 'Department for Promotion of Industry and Internal Trade (DPIIT), Ministry of Commerce & Industry, GoI',
      hi: 'उद्योग संवर्धन एवं आंतरिक व्यापार विभाग (DPIIT), वाणिज्य एवं उद्योग मंत्रालय, भारत सरकार',
      mr: 'उद्योग प्रोत्साहन व अंतर्गत व्यापार विभाग (DPIIT), वाणिज्य व उद्योग मंत्रालय, भारत सरकार',
    },
    whoCanApply: {
      en: 'Innovative early-stage startups incorporated as Private Limited, LLP, or Registered Partnership firms in India.',
      hi: 'भारत में प्राइवेट लिमिटेड, LLP या पंजीकृत साझेदारी के रूप में निगमित नवाचार-आधारित स्टार्टअप।',
      mr: 'भारतात प्रायव्हेट लिमिटेड, LLP किंवा नोंदणीकृत भागीदारी म्हणून स्थापन झालेले नाविन्यपूर्ण स्टार्टअप्स.',
    },
    mainBenefits: {
      en: 'DPIIT Startup recognition, self-certification compliance facilitation, public procurement norms access, mentorship, and information on seed fund/credit schemes.',
      hi: 'DPIIT स्टार्टअप मान्यता, अनुपालन सरलता, सरकारी खरीद में अवसर, मेंटरशिप और सीड फंड/क्रेडिट योजनाओं की जानकारी।',
      mr: 'DPIIT स्टार्टअप मान्यता, अनुपालन सुलभता, शासकीय खरेदीत संधी, मेंटॉरशिप आणि सीड फंड/कर्ज योजनांची माहिती.',
    },
    eligibility: {
      en: 'Entity type, incorporation age, turnover ceiling, and innovation criteria as notified by DPIIT on startupindia.gov.in.',
      hi: 'DPIIT द्वारा startupindia.gov.in पर अधिसूचित इकाई प्रकार, निगमन अवधि, टर्नओवर सीमा और नवाचार मानदंड।',
      mr: 'DPIIT ने startupindia.gov.in वर अधिसूचित केलेले संस्था प्रकार, कालावधी, उलाढाल मर्यादा व नाविन्य निकष.',
    },
    documents: {
      en: 'Certificate of Incorporation/Registration, PAN, brief write-up on innovation/scalability, and director/partner details.',
      hi: 'निगमन/पंजीकरण प्रमाणपत्र, पैन, नवाचार विवरण और निदेशक/भागीदार जानकारी।',
      mr: 'नोंदणी/निगमन प्रमाणपत्र, पॅन, नाविन्यपूर्ण उत्पादनाची माहिती व संचालक/भागीदार तपशील.',
    },
    applicationProcess: {
      en: 'Visit startupindia.gov.in → Create account via NSWS → Apply for DPIIT Recognition → Access Startup India learning, mentorship, and scheme directory.',
      hi: 'startupindia.gov.in पर जाएं → NSWS के माध्यम से खाता बनाएं → DPIIT मान्यता के लिए आवेदन करें → मेंटरशिप व योजनाओं का लाभ लें।',
      mr: 'startupindia.gov.in वर जा → NSWS द्वारे खाते उघडा → DPIIT मान्यतेसाठी अर्ज करा → मेंटॉरशिप व योजनांची माहिती मिळवा.',
    },
    officialUrl: 'https://www.startupindia.gov.in',
    officialPortalLabel: 'startupindia.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'udyam-msme',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: 'Udyam Registration (Official MSME Registration)',
      hi: 'उद्यम पंजीकरण (आधिकारिक MSME पंजीकरण)',
      mr: 'उद्यम नोंदणी (अधिकृत MSME नोंदणी)',
    },
    department: {
      en: 'Ministry of Micro, Small & Medium Enterprises (MSME), Government of India',
      hi: 'सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय (MSME), भारत सरकार',
      mr: 'सूक्ष्म, लघु व मध्यम उद्योग मंत्रालय (MSME), भारत सरकार',
    },
    whoCanApply: {
      en: 'Micro, small, and medium businesses, workshops, local service providers, traders, and self-employed proprietors across India.',
      hi: 'भारत के सभी सूक्ष्म, लघु व मध्यम व्यवसाय, वर्कशॉप, स्थानीय सेवा प्रदाता, व्यापारी और स्वरोजगारी उद्यमी।',
      mr: 'भारतातील सर्व सूक्ष्म, लघु व मध्यम व्यवसाय, वर्कशॉप, स्थानिक सेवा प्रदाते, व्यापारी आणि स्वयंरोजगारी उद्योजक.',
    },
    mainBenefits: {
      en: 'Free permanent Udyam Registration Number & digital certificate, easier access to priority-sector bank loans, MSME schemes, and GeM public procurement registration.',
      hi: 'निःशुल्क स्थायी उद्यम प्रमाणपत्र, प्राथमिकता क्षेत्र बैंक ऋण, MSME सरकारी योजनाओं और GeM पोर्टल पंजीकरण में सुविधा।',
      mr: 'मोफत कायमस्वरूपी उद्यम नोंदणी प्रमाणपत्र, बँक कर्ज सुलभता, MSME शासकीय योजना व GeM पोर्टल नोंदणीसाठी उपयोग.',
    },
    eligibility: {
      en: 'Enterprises classified as Micro, Small, or Medium based on investment and annual turnover thresholds defined by Ministry of MSME.',
      hi: 'MSME मंत्रालय द्वारा निर्धारित निवेश व वार्षिक टर्नओवर सीमा के अंतर्गत आने वाले उद्यम।',
      mr: 'MSME मंत्रालयाने ठरवलेल्या गुंतवणूक व वार्षिक उलाढाल मर्यादेतील सर्व उद्योग व व्यवसाय.',
    },
    documents: {
      en: 'Aadhaar number of proprietor/authorized signatory, PAN, bank account details, and NIC business activity code (no physical paperwork needed).',
      hi: 'प्रोप्राइटर/अधिकृत व्यक्ति का आधार, पैन, बैंक खाता विवरण और व्यवसाय गतिविधि जानकारी।',
      mr: 'मालक/अधिकृत व्यक्तीचा आधार क्रमांक, पॅन, बँक खाते तपशील व व्यवसायाचा प्रकार.',
    },
    applicationProcess: {
      en: 'Visit udyamregistration.gov.in (free official portal) → Enter Aadhaar & OTP → Verify PAN & enterprise details → Instantly download Udyam Certificate.',
      hi: 'udyamregistration.gov.in (निःशुल्क आधिकारिक पोर्टल) पर जाएं → आधार व OTP सत्यापित करें → पैन व व्यवसाय विवरण भरें → तुरंत प्रमाणपत्र डाउनलोड करें।',
      mr: 'udyamregistration.gov.in (मोफत अधिकृत पोर्टल) वर जा → आधार व OTP पडताळणी करा → पॅन व व्यवसायाची माहिती भरून प्रमाणपत्र डाउनलोड करा.',
    },
    officialUrl: 'https://udyamregistration.gov.in',
    officialPortalLabel: 'udyamregistration.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'pm-vishwakarma',
    audience: 'entrepreneurs',
    govLevel: 'central',
    name: {
      en: 'PM Vishwakarma Yojana (Traditional Artisans & Craftspeople)',
      hi: 'पीएम विश्वकर्मा योजना (पारंपरिक कारीगर एवं शिल्पकार)',
      mr: 'पीएम विश्वकर्मा योजना (पारंपरिक कारागीर व शिल्पकार)',
    },
    department: {
      en: 'Ministry of Micro, Small & Medium Enterprises (MSME), Government of India',
      hi: 'सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय (MSME), भारत सरकार',
      mr: 'सूक्ष्म, लघु व मध्यम उद्योग मंत्रालय (MSME), भारत सरकार',
    },
    whoCanApply: {
      en: 'Traditional self-employed artisans & craftspeople across 18 listed trades (carpenters, blacksmiths, masons, tailors, barbers, washermen, potters, cobblers, etc.).',
      hi: '18 सूचीबद्ध पारंपरिक व्यवसायों के स्वरोजगारी कारीगर (बढ़ई, लोहार, राजमिस्त्री, दर्जी, नाई, धोबी, कुम्हार, मोची आदि)।',
      mr: '१८ सूचीबद्ध पारंपरिक व्यवसायांतील स्वयंरोजगारी कारागीर (सुतार, लोहार, गवंडी, शिंपी, न्हावी, धोबी, कुंभार, चर्मकार इ.).',
    },
    mainBenefits: {
      en: 'Official PM Vishwakarma recognition certificate & ID card, skill upgradation training, toolkit incentive support, and concessional enterprise credit as per scheme guidelines.',
      hi: 'पीएम विश्वकर्मा पहचान पत्र व प्रमाणपत्र, कौशल उन्नयन प्रशिक्षण, टूलकिट प्रोत्साहन और योजना के अनुसार रियायती ऋण सहायता।',
      mr: 'पीएम विश्वकर्मा ओळखपत्र व प्रमाणपत्र, कौशल्य विकास प्रशिक्षण, टूलकिट प्रोत्साहन आणि योजनेच्या अटींनुसार सवलतीचे कर्ज सहाय्य.',
    },
    eligibility: {
      en: 'Self-employed artisan working with hands and tools in one of the 18 notified trades, meeting age and family eligibility rules on pmvishwakarma.gov.in.',
      hi: '18 अधिसूचित पारंपरिक व्यवसायों में हाथ व औजारों से कार्यरत स्वरोजगारी कारीगर (पूर्ण पात्रता pmvishwakarma.gov.in पर देखें)।',
      mr: '१८ अधिसूचित पारंपरिक व्यवसायांत स्वतःच्या हाताने व अवजारांनी काम करणारे कारागीर (संपूर्ण अटी pmvishwakarma.gov.in वर पहा).',
    },
    documents: {
      en: 'Aadhaar card, mobile number linked with Aadhaar, ration card / family details, and active bank account.',
      hi: 'आधार कार्ड, आधार से जुड़ा मोबाइल नंबर, राशन कार्ड / परिवार विवरण और सक्रिय बैंक खाता।',
      mr: 'आधार कार्ड, आधारशी जोडलेला मोबाईल क्रमांक, रेशन कार्ड / कुटुंब तपशील व सक्रिय बँक खाते.',
    },
    applicationProcess: {
      en: 'Visit nearest Common Service Centre (CSC) or check details at pmvishwakarma.gov.in → Biometric Aadhaar eKYC → Three-tier local verification.',
      hi: 'नजदीकी CSC केंद्र पर जाएं या pmvishwakarma.gov.in पर विवरण देखें → बायोमेट्रिक आधार eKYC → त्रि-स्तरीय सत्यापन।',
      mr: 'जवळच्या CSC केंद्रात जा किंवा pmvishwakarma.gov.in वर माहिती पहा → बायोमेट्रिक आधार eKYC → स्थानिक पडताळणी प्रक्रिया पूर्ण करा.',
    },
    officialUrl: 'https://pmvishwakarma.gov.in',
    officialPortalLabel: 'pmvishwakarma.gov.in',
    lastVerifiedDate: 'April 2026',
  },

  // =========================================================================
  // D. WOMEN & YOUTH LIVELIHOODS (महिला एवं युवा)
  // =========================================================================
  {
    id: 'day-nrlm-umed',
    audience: 'women_youth',
    govLevel: 'joint',
    name: {
      en: 'DAY-NRLM & UMED (Maharashtra State Rural Livelihoods Mission)',
      hi: 'दीनदयाल अंत्योदय योजना — NRLM एवं उमेद (महाराष्ट्र ग्रामीण आजीविका मिशन)',
      mr: 'दीनदयाळ अंत्योदय योजना — NRLM व उमेद (महाराष्ट्र राज्य ग्रामीण जीवनोन्नती अभियान)',
    },
    department: {
      en: 'Ministry of Rural Development (GoI) & Rural Development Department, Maharashtra',
      hi: 'ग्रामीण विकास मंत्रालय (भारत सरकार) एवं ग्राम विकास विभाग, महाराष्ट्र शासन',
      mr: 'ग्रामविकास मंत्रालय (भारत सरकार) व ग्रामविकास विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Rural women and women Self-Help Groups (Bachat Gat / SHGs) seeking livelihood training, micro-enterprise support, and financial inclusion.',
      hi: 'ग्रामीण महिलाएं और महिला स्वयं सहायता समूह (बचत गट / SHG) जो आजीविका प्रशिक्षण, सूक्ष्म व्यवसाय और वित्तीय समावेशन चाहती हैं।',
      mr: 'ग्रामीण महिला आणि महिला बचत गट (SHG) ज्यांना उपजीविका प्रशिक्षण, सूक्ष्म उद्योग व वित्तीय सहाय्य हवे आहे.',
    },
    mainBenefits: {
      en: 'SHG formation and capacity building, revolving fund & community investment support, bank linkage facilitation, and rural product exhibition/market access.',
      hi: 'स्वयं सहायता समूह गठन, क्षमता निर्माण, सामुदायिक निधि व बैंक लिंकेज सहायता और ग्रामीण उत्पादों के लिए बाजार मंच।',
      mr: 'बचत गट सक्षमीकरण, प्रशिक्षण, फिरता निधी व बँक कर्ज जोडणी सहाय्य आणि ग्रामीण उत्पादनांसाठी बाजारपेठ संधी.',
    },
    eligibility: {
      en: 'Rural households and women SHG members as per NRLM / UMED block mission guidelines. Contact local Gram Panchayat / Taluka UMED office for joining.',
      hi: 'NRLM / उमेद प्रखंड मिशन दिशानिर्देशों के अनुसार ग्रामीण परिवार व महिला SHG सदस्य।',
      mr: 'NRLM / उमेद तालुका अभियान मार्गदर्शक तत्त्वांनुसार ग्रामीण कुटुंबे व महिला बचत गट सदस्य.',
    },
    documents: {
      en: 'Aadhaar card, residence proof, bank account details, and SHG membership/resolution records (for group support).',
      hi: 'आधार कार्ड, निवास प्रमाण, बैंक खाता विवरण और बचत गट सदस्यता/प्रस्ताव रिकॉर्ड।',
      mr: 'आधार कार्ड, रहिवासी पुरावा, बँक खाते तपशील व बचत गट सदस्यत्व/ठराव कागदपत्रे.',
    },
    applicationProcess: {
      en: 'Explore programme details on aajeevika.gov.in → Connect with your village CRPs / Taluka UMED Mission Management Unit (BMMU) to join or register a women SHG.',
      hi: 'aajeevika.gov.in पर जानकारी देखें → अपने ग्राम या तालुका उमेद (BMMU) कार्यालय से संपर्क कर महिला बचत गट से जुड़ें।',
      mr: 'aajeevika.gov.in वर माहिती पहा → आपल्या गावातील किंवा तालुका उमेद (BMMU) कार्यालयाशी संपर्क साधून बचत गटात सहभागी व्हा.',
    },
    officialUrl: 'https://aajeevika.gov.in',
    officialPortalLabel: 'aajeevika.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'lakhpati-didi',
    audience: 'women_youth',
    govLevel: 'central',
    name: {
      en: 'Lakhpati Didi — Women SHG Entrepreneurship Initiative',
      hi: 'लखपति दीदी — महिला SHG उद्यमिता पहल',
      mr: 'लखपती दीदी — महिला बचत गट उद्योजकता उपक्रम',
    },
    department: {
      en: 'Ministry of Rural Development (DAY-NRLM), Government of India',
      hi: 'ग्रामीण विकास मंत्रालय (DAY-NRLM), भारत सरकार',
      mr: 'ग्रामविकास मंत्रालय (DAY-NRLM), भारत सरकार',
    },
    whoCanApply: {
      en: 'Women members of NRLM-affiliated Self-Help Groups across rural India building sustainable household enterprises.',
      hi: 'ग्रामीण भारत में NRLM से जुड़े स्वयं सहायता समूहों की महिला सदस्य जो स्थायी घरेलू/लघु उद्यम विकसित करना चाहती हैं।',
      mr: 'ग्रामीण भारतातील NRLM संलग्न बचत गटांतील महिला सदस्य ज्या शाश्वत लघु उद्योग उभारू इच्छितात.',
    },
    mainBenefits: {
      en: 'Structured livelihood planning, financial literacy, enterprise skill training, market linkages, and convergence with central/state credit schemes.',
      hi: 'आजीविका योजना मार्गदर्शन, वित्तीय साक्षरता, उद्यम कौशल प्रशिक्षण, बाजार संपर्क और केंद्र/राज्य योजनाओं के साथ समन्वय।',
      mr: 'उपजीविका नियोजन मार्गदर्शन, आर्थिक साक्षरता, व्यवसाय प्रशिक्षण, बाजारपेठ जोडणी व शासकीय योजनांचा समन्वय.',
    },
    eligibility: {
      en: 'Active member of a DAY-NRLM / State Rural Livelihood Mission (e.g., UMED in Maharashtra) Self-Help Group.',
      hi: 'DAY-NRLM / राज्य ग्रामीण आजीविका मिशन (जैसे महाराष्ट्र में उमेद) के सक्रिय स्वयं सहायता समूह की महिला सदस्य।',
      mr: 'DAY-NRLM / राज्य ग्रामीण जीवनोन्नती अभियानाच्या (महाराष्ट्रात उमेद) सक्रिय महिला बचत गटाची सदस्य.',
    },
    documents: {
      en: 'SHG membership record, Aadhaar card, bank account details, and livelihood activity plan prepared with local SHG facilitator.',
      hi: 'बचत गट सदस्यता रिकॉर्ड, आधार कार्ड, बैंक खाता और स्थानीय समन्वयक के साथ तैयार आजीविका योजना।',
      mr: 'बचत गट सदस्यत्व नोंद, आधार कार्ड, बँक खाते व स्थानिक समन्वयकासह तयार केलेली उपजीविका योजना.',
    },
    applicationProcess: {
      en: 'Visit lakhpatididi.gov.in for official guidance → Coordinate through your village Self-Help Group & Block Mission Management Unit (BMMU).',
      hi: 'आधिकारिक जानकारी के लिए lakhpatididi.gov.in देखें → अपने ग्राम बचत गट व प्रखंड मिशन इकाई (BMMU) के माध्यम से जुड़ें।',
      mr: 'अधिकृत माहितीसाठी lakhpatididi.gov.in पहा → आपल्या गावातील बचत गट व तालुका मिशन कार्यालयामार्फत सहभागी व्हा.',
    },
    officialUrl: 'https://lakhpatididi.gov.in',
    officialPortalLabel: 'lakhpatididi.gov.in',
    lastVerifiedDate: 'April 2026',
  },
  {
    id: 'mavim-maharashtra',
    audience: 'women_youth',
    govLevel: 'maharashtra',
    name: {
      en: 'Mahila Arthik Vikas Mahamandal (MAVIM — Maharashtra)',
      hi: 'महिला आर्थिक विकास महामंडल (MAVIM — महाराष्ट्र)',
      mr: 'महिला आर्थिक विकास महामंडळ (MAVIM — महाराष्ट्र)',
    },
    department: {
      en: 'Women & Child Development Department, Government of Maharashtra',
      hi: 'महिला एवं बाल विकास विभाग, महाराष्ट्र शासन',
      mr: 'महिला व बालविकास विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Women, women SHGs (Tejaswini / CMRC networks), and aspiring women micro-entrepreneurs in rural and urban Maharashtra.',
      hi: 'ग्रामीण व शहरी महाराष्ट्र की महिलाएं, महिला बचत गट और महिला सूक्ष्म उद्यमी।',
      mr: 'ग्रामीण व शहरी महाराष्ट्रातील महिला, महिला बचत गट (CMRC) आणि महिला सूक्ष्म उद्योजिका.',
    },
    mainBenefits: {
      en: 'Women entrepreneurship training, Community Managed Resource Centre (CMRC) support, micro-credit facilitation, and marketing support for women-led goods & services.',
      hi: 'महिला उद्यमिता प्रशिक्षण, सामुदायिक संसाधन केंद्र (CMRC) सहायता, सूक्ष्म ऋण सुविधा और महिला उत्पादों के विपणन में सहयोग।',
      mr: 'महिला उद्योजकता प्रशिक्षण, लोकसंचालित साधन केंद्र (CMRC) सहाय्य, सूक्ष्म कर्ज जोडणी व महिला उत्पादनांच्या विक्रीसाठी मदत.',
    },
    eligibility: {
      en: 'Women residents and women SHGs in Maharashtra as per MAVIM district programme guidelines.',
      hi: 'MAVIM जिला कार्यक्रम दिशानिर्देशों के अनुसार महाराष्ट्र की महिला निवासी और महिला बचत गट।',
      mr: 'MAVIM जिल्हा कार्यक्रम मार्गदर्शक तत्त्वांनुसार महाराष्ट्रातील महिला व महिला बचत गट.',
    },
    documents: {
      en: 'Aadhaar card, residence proof, bank account details, and SHG/CMRC registration details (where applicable).',
      hi: 'आधार कार्ड, निवास प्रमाण, बैंक खाता और बचत गट / CMRC पंजीकरण विवरण।',
      mr: 'आधार कार्ड, रहिवासी दाखला, बँक खाते तपशील व बचत गट / CMRC नोंदणी माहिती.',
    },
    applicationProcess: {
      en: 'Visit mavimindia.org for state & district contact details → Approach your District MAVIM Office or nearest CMRC for enrolment and training batches.',
      hi: 'राज्य व जिला संपर्क विवरण के लिए mavimindia.org देखें → नामांकन व प्रशिक्षण के लिए जिला MAVIM कार्यालय या नजदीकी CMRC से संपर्क करें।',
      mr: 'जिल्हा संपर्क माहितीसाठी mavimindia.org पहा → नोंदणी व प्रशिक्षणासाठी जिल्हा MAVIM कार्यालय किंवा जवळच्या CMRC शी संपर्क साधा.',
    },
    officialUrl: 'https://mavimindia.org',
    officialPortalLabel: 'mavimindia.org',
  },
  {
    id: 'annasaheb-patil-maharashtra',
    audience: 'women_youth',
    govLevel: 'maharashtra',
    name: {
      en: 'Annasaheb Patil Arthik Magas Vikas Mahamandal — Self-Employment Support (Maharashtra)',
      hi: 'अण्णासाहेब पाटिल आर्थिक पिछड़ा विकास महामंडल — स्वरोजगार सहायता (महाराष्ट्र)',
      mr: 'अण्णासाहेब पाटील आर्थिक मागास विकास महामंडळ — स्वयंरोजगार सहाय्य (महाराष्ट्र)',
    },
    department: {
      en: 'Skill, Employment, Entrepreneurship & Innovation Department, Government of Maharashtra',
      hi: 'कौशल, रोजगार, उद्यमिता एवं नवाचार विभाग, महाराष्ट्र शासन',
      mr: 'कौशल्य, रोजगार, उद्योजकता व नाविन्यता विभाग, महाराष्ट्र शासन',
    },
    whoCanApply: {
      en: 'Eligible youth and self-employment aspirants from Economically Backward Classes in Maharashtra starting individual or group businesses.',
      hi: 'महाराष्ट्र के आर्थिक रूप से पिछड़े वर्ग के पात्र युवा जो व्यक्तिगत या समूह व्यवसाय शुरू करना चाहते हैं।',
      mr: 'महाराष्ट्रातील आर्थिकदृष्ट्या मागास घटकातील पात्र युवक-युवती जे वैयक्तिक किंवा गट व्यवसाय सुरू करू इच्छितात.',
    },
    mainBenefits: {
      en: 'Interest-reimbursement support on eligible bank business loans (individual and group loan schemes) subject to corporation approval and timely repayment.',
      hi: 'महामंडल की स्वीकृति और नियमित ऋण भुगतान की शर्त पर पात्र बैंक व्यवसाय ऋणों पर ब्याज प्रतिपूर्ति सहायता।',
      mr: 'महामंडळाची मंजुरी व नियमित कर्ज परतफेडीच्या अटींवर पात्र बँक व्यवसाय कर्जासाठी व्याज परतावा सहाय्य.',
    },
    eligibility: {
      en: 'Maharashtra domicile, prescribed annual family income ceiling, age criteria, and valid Letter of Intent (LOI) issued via official portal. Check latest GR on udyog.mahaswayam.gov.in.',
      hi: 'महाराष्ट्र निवास, निर्धारित पारिवारिक आय व आयु सीमा और आधिकारिक पोर्टल से मान्य आशय पत्र (LOI)। नवीनतम शर्तें udyog.mahaswayam.gov.in पर देखें।',
      mr: 'महाराष्ट्र रहिवासी, निर्धारित उत्पन्न व वयोमर्यादा आणि अधिकृत पोर्टलवरून पात्रता प्रमाणपत्र (LOI). अद्ययावत अटी udyog.mahaswayam.gov.in वर पहा.',
    },
    documents: {
      en: 'Aadhaar card, Maharashtra domicile certificate, income certificate, project report, bank passbook, and business proof.',
      hi: 'आधार कार्ड, महाराष्ट्र निवास प्रमाणपत्र, आय प्रमाणपत्र, प्रोजेक्ट रिपोर्ट, बैंक पासबुक और व्यवसाय प्रमाण।',
      mr: 'आधार कार्ड, महाराष्ट्र रहिवासी दाखला, उत्पन्नाचा दाखला, प्रकल्प अहवाल, बँक पासबुक व व्यवसाय पुरावा.',
    },
    applicationProcess: {
      en: 'Visit udyog.mahaswayam.gov.in → Register & apply for Eligibility Letter (LOI) → Submit LOI to participating bank for loan sanction → Claim interest reimbursement on portal.',
      hi: 'udyog.mahaswayam.gov.in पर जाएं → पात्रता प्रमाणपत्र (LOI) हेतु ऑनलाइन आवेदन करें → बैंक ऋण स्वीकृति के बाद पोर्टल पर ब्याज प्रतिपूर्ति प्रक्रिया पूरी करें।',
      mr: 'udyog.mahaswayam.gov.in वर जा → पात्रता प्रमाणपत्रासाठी (LOI) ऑनलाइन अर्ज करा → बँक कर्ज मंजुरीनंतर पोर्टलवर व्याज परताव्याची नोंद करा.',
    },
    officialUrl: 'https://udyog.mahaswayam.gov.in',
    officialPortalLabel: 'udyog.mahaswayam.gov.in',
  },
];
