import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { isAuthenticatedUser } from '../lib/firebase';
import { uploadAdBannerImage } from '../lib/workPhotoService';
import {
  DEFAULT_AD_TARGET_CATEGORIES,
  addDaysIsoDate,
  getTodayIsoDate,
  saveAdvertiserProfile,
  submitAdvertisementForApproval,
  subscribeActiveAdvertisements,
  subscribeAdvertisementCategories,
  subscribeAdvertiserProfile,
  subscribeOwnerAdvertisements,
  recordAdvertisementClick,
} from '../lib/adsReferralService';
import { getCustomProfessionLabel, subscribeApprovedProfessions } from '../lib/customProfessionService';
import type {
  AdvertisementActionType,
  AdvertisementCategory,
  AdvertisementRecord,
  AdvertiserProfile,
  CustomProfessionRecord,
  Language,
  PageRoute,
} from '../types/domain';
import { BrandSloganBanner } from './BrandSloganBanner';

interface AdvertiserDashboardViewProps {
  onNavigate: (route: PageRoute) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const AdvertiserDashboardView: React.FC<AdvertiserDashboardViewProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const { user, signInWithGoogle } = useAuth();

  const [panelTab, setPanelTab] = useState<'browse' | 'post'>('browse');
  const [publicAds, setPublicAds] = useState<AdvertisementRecord[]>([]);
  const [adAreaFilter, setAdAreaFilter] = useState('');
  const [adCategoryFilter, setAdCategoryFilter] = useState('all');

  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [myAds, setMyAds] = useState<AdvertisementRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<AdvertisementCategory[]>([]);
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);

  // Business Profile Registration Form
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [districtName, setDistrictName] = useState('Pune');
  const [city, setCity] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Building Material & Hardware');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New Advertisement Submission Form (Always submitted as 'pending' for Admin approval)
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['carpenter']);
  const [allLocations, setAllLocations] = useState(false);
  const [targetDistrictsInput, setTargetDistrictsInput] = useState('');
  const [targetCitiesInput, setTargetCitiesInput] = useState('');
  const [targetAreasInput, setTargetAreasInput] = useState('');
  const [contactAction, setContactAction] = useState<AdvertisementActionType>('call');
  const [adCallNumber, setAdCallNumber] = useState('');
  const [adWhatsappNumber, setAdWhatsappNumber] = useState('');
  const [adWebsiteUrl, setAdWebsiteUrl] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [submittingAd, setSubmittingAd] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const uCat = subscribeAdvertisementCategories(setCustomCategories);
    const uProf = subscribeApprovedProfessions(setApprovedProfessions);
    const uPublic = subscribeActiveAdvertisements(setPublicAds);
    return () => {
      uCat();
      uProf();
      uPublic();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticatedUser(user)) {
      setProfile(null);
      setMyAds([]);
      return;
    }
    const u1 = subscribeAdvertiserProfile(user.uid, (prof) => {
      setProfile(prof);
      if (prof) {
        setBusinessName(prof.businessName);
        setContactPerson(prof.contactPerson);
        setMobile(prof.mobile);
        setWhatsappNumber(prof.whatsappNumber || '');
        setEmail(prof.email || user.email || '');
        setBusinessAddress(prof.businessAddress);
        setStateName(prof.state || 'Maharashtra');
        setDistrictName(prof.district || 'Pune');
        setCity(prof.city || '');
        setBusinessCategory(prof.businessCategory);
        setWebsiteUrl(prof.websiteUrl || '');
        setAdCallNumber((prev) => prev || prof.mobile);
        setAdWhatsappNumber((prev) => prev || prof.whatsappNumber || prof.mobile);
        setAdWebsiteUrl((prev) => prev || prof.websiteUrl || '');
        setTargetDistrictsInput((prev) => prev || prof.district);
        setTargetCitiesInput((prev) => prev || prof.city);
      } else {
        setContactPerson((prev) => prev || user.displayName || '');
        setEmail((prev) => prev || user.email || '');
      }
    });
    const u2 = subscribeOwnerAdvertisements(user.uid, setMyAds);
    return () => {
      u1();
      u2();
    };
  }, [user]);

  const districtsForState = useMemo(() => {
    const found = INDIA_STATES_DISTRICTS.find((st) => st.name === stateName);
    return found ? found.districts.map((d) => d.name) : ['Pune', 'Mumbai', 'Nagpur', 'Nashik'];
  }, [stateName]);

  const allCategoryChoices = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string; hint: string }> = [];
    for (const c of DEFAULT_AD_TARGET_CATEGORIES) {
      seen.add(c.id);
      list.push({
        id: c.id,
        label: lang === 'mr' ? c.labelMr : lang === 'hi' ? c.labelHi : c.labelEn,
        hint: lang === 'mr' ? c.exampleBusinessesMr : c.exampleBusinessesEn,
      });
    }
    for (const c of customCategories) {
      if (!c.active || seen.has(c.slug)) continue;
      seen.add(c.slug);
      list.push({
        id: c.slug,
        label: (lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn) || c.nameEn,
        hint: `Linked: ${c.linkedServiceCategories.join(', ')}`,
      });
    }
    for (const p of approvedProfessions) {
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      list.push({
        id: p.slug,
        label: getCustomProfessionLabel(p, lang),
        hint: p.description || p.nameEn,
      });
    }
    return list;
  }, [customCategories, approvedProfessions, lang]);

  const aggregateStats = useMemo(() => {
    return myAds.reduce(
      (acc, ad) => {
        acc.impressions += ad.impressionsCount || 0;
        acc.clicks += ad.clicksCount || 0;
        acc.calls += ad.callClicksCount || 0;
        acc.whatsapp += ad.whatsappClicksCount || 0;
        acc.website += ad.websiteClicksCount || 0;
        return acc;
      },
      { impressions: 0, clicks: 0, calls: 0, whatsapp: 0, website: 0 }
    );
  }, [myAds]);

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId].slice(0, 10)
    );
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setErrorMsg('');
    setUploadingBanner(true);
    setUploadPct(10);
    try {
      const res = await uploadAdBannerImage({
        file,
        ownerUid: user.uid,
        onProgress: setUploadPct,
      });
      setBannerUrl(res.url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to upload banner image.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticatedUser(user)) return;
    setErrorMsg('');
    setFeedback('');

    if (businessName.trim().length < 2 || contactPerson.trim().length < 2) {
      setErrorMsg('Please enter your Business/Shop Name and Contact Person Name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, '').slice(-10))) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSavingProfile(true);
    try {
      await saveAdvertiserProfile(user.uid, Boolean(profile), {
        businessName,
        contactPerson,
        mobile: mobile.replace(/\D/g, '').slice(-10),
        whatsappNumber: whatsappNumber.replace(/\D/g, '').slice(-10) || undefined,
        email,
        businessAddress,
        state: stateName,
        district: districtName,
        city,
        businessCategory,
        websiteUrl: websiteUrl.trim() || undefined,
      });
      setFeedback(
        tr(
          lang,
          'Advertiser business profile saved! Admin review is required before advertisements go live.',
          'विज्ञापनदाता प्रोफाइल सेव हो गई है! विज्ञापन लाइव होने से पहले एडमिन स्वीकृति आवश्यक है।',
          'जाहिरातदार प्रोफाइल जतन झाले आहे! जाहिरात लाईव्ह होण्यापूर्वी अ‍ॅडमिन मान्यता आवश्यक आहे.'
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save advertiser profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticatedUser(user)) return;
    setErrorMsg('');
    setFeedback('');

    if (!profile) {
      setErrorMsg('Please complete Step 1 (Register Your Business Profile) first.');
      return;
    }
    if (adTitle.trim().length < 3 || adDescription.trim().length < 5) {
      setErrorMsg('Please enter an Advertisement Title (min 3 chars) and Description (min 5 chars).');
      return;
    }
    if (!bannerUrl.trim()) {
      setErrorMsg('Please upload a banner image for your advertisement.');
      return;
    }
    if (selectedCategories.length === 0) {
      setErrorMsg('Please select at least one target service category.');
      return;
    }

    setSubmittingAd(true);
    try {
      await submitAdvertisementForApproval({
        ownerUid: user.uid,
        advertiserId: user.uid,
        advertiserName: profile.businessName,
        title: adTitle,
        description: adDescription,
        bannerImageUrl: bannerUrl,
        targetCategories: selectedCategories,
        targetStates: allLocations ? [] : [stateName],
        targetDistricts: allLocations
          ? []
          : targetDistrictsInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        targetCities: allLocations
          ? []
          : targetCitiesInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        targetAreas: allLocations
          ? []
          : targetAreasInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        allLocations,
        contactAction,
        callNumber: adCallNumber || profile.mobile,
        whatsappNumber: adWhatsappNumber || profile.whatsappNumber || profile.mobile,
        websiteUrl: adWebsiteUrl || profile.websiteUrl,
        startDate: getTodayIsoDate(),
        endDate: addDaysIsoDate(durationDays),
        preferredDurationDays: durationDays,
        createdByAdmin: false, // STRICTLY pending admin approval — never auto-published!
      });

      setAdTitle('');
      setAdDescription('');
      setBannerUrl('');
      setFeedback(
        tr(
          lang,
          'Advertisement submitted for Admin Approval! It will appear on the category slider once approved and activated by ROJGAR SETU Admin.',
          'विज्ञापन एडमिन स्वीकृति के लिए भेज दिया गया है! स्वीकृति के बाद ही यह ग्राहक डैशबोर्ड पर दिखाई देगा।',
          'तुमची जाहिरात अ‍ॅडमिन मान्यतेसाठी पाठवली आहे! अ‍ॅडमिनने मंजूर व सक्रिय केल्यानंतरच ती स्लायडरवर दिसेल.'
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit advertisement.');
    } finally {
      setSubmittingAd(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 pb-24">
      <BrandSloganBanner variant="promo" />

      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="h-1.5 w-full grid grid-cols-3">
          <div className="bg-[#E06D1B]" />
          <div className="bg-white" />
          <div className="bg-[#15803D]" />
        </div>
        <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#C25E00]">
              <Megaphone className="w-4 h-4" />
              <span>{tr(lang, 'Advertise With ROJGAR SETU', 'रोजगार सेतु पर विज्ञापन दें', 'रोजगार सेतूवर जाहिरात करा')}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B3B75]">
              {tr(
                lang,
                'Reach Local Customers Exactly When They Book Services',
                'जब ग्राहक सेवा चुनें, तभी उन्हें अपनी दुकान या व्यवसाय दिखाएँ',
                'ग्राहक सेवा निवडतानाच त्यांना तुमच्या दुकान व व्यवसायाची जाहिरात दाखवा'
              )}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Category-matched sponsored banners: Door & Plywood shops appear to Carpenter customers; Pipes & Sanitaryware to Plumber customers; Architects, Civil Engineers & Cement dealers to Construction customers. All ads require Admin verification before publishing.',
                'श्रेणी-आधारित विज्ञापन: बढ़ई चुनने पर दरवाजे/प्लाईवुड की दुकान; प्लंबर पर पाइप/सैनिटरीवेअर; निर्माण पर आर्किटेक्ट, सिविल इंजीनियर व सीमेंट डीलर। सभी विज्ञापन एडमिन सत्यापन के बाद ही लाइव होते हैं।',
                'कॅटेगिरी-आधारित जाहिराती: सुतार निवडल्यास दरवाजे/प्लायवूड दुकान; प्लंबर निवडल्यास पाईप्स/सॅनिटरीवेअर; बांधकाम निवडल्यास आर्किटेक्ट, सिव्हिल इंजिनिअर व सिमेंट/स्टील डीलर. सर्व जाहिराती अ‍ॅडमिन मंजुरीनंतरच प्रसिद्ध होतात.'
              )}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-[#0B3B75] space-y-1.5 shrink-0 max-w-xs">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" />
              <span>{tr(lang, 'Privacy & Quality Standard', 'गोपनीयता एवं गुणवत्ता मानक', 'गोपनीयता व दर्जा')}</span>
            </div>
            <p className="text-slate-600">
              {tr(
                lang,
                'Zero customer PII is ever shared. Advertisers receive strictly aggregate impressions, call, WhatsApp, and website click analytics.',
                'ग्राहकों का निजी डेटा कभी साझा नहीं होता। विज्ञापनदाताओं को केवल कुल व्यू और क्लिक आंकड़े मिलते हैं।',
                'ग्राहकांची वैयक्तिक माहिती कधीही शेअर केली जात नाही. फक्त एकूण व्ह्यूज व क्लिक्सचे आकडे मिळतात.'
              )}
            </p>
          </div>
        </div>

        {/* Local Business Promotion Highlights (Shops, Material Dealers, Studios & Contractors) */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3 space-y-1">
            <div className="font-extrabold text-[#0B3B75]">
              {tr(lang, '1. Category + Pincode Targeting', '1. श्रेणी व पिनकोड टारगेटिंग', '१. कॅटेगिरी व पिनकोडनुसार जाहिरात')}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Show your hardware, plywood, electrical, photo studio, or shop banner to customers booking matching services in your exact city or 6-digit pincode.',
                'अपनी हार्डवेयर, प्लाईवुड, इलेक्ट्रिकल, फोटो स्टूडियो या दुकान का बैनर केवल अपने शहर व 6-अंकीय पिनकोड के ग्राहकों को दिखाएँ।',
                'तुमचे हार्डवेअर, प्लायवूड, इलेक्ट्रिकल, फोटो स्टुडिओ किंवा दुकानाची जाहिरात थेट तुमच्या शहर व ६-अंकी पिनकोडमधील ग्राहकांना दाखवा.'
              )}
            </p>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3 space-y-1">
            <div className="font-extrabold text-[#15803D]">
              {tr(lang, '2. Direct Call & WhatsApp Leads', '2. सीधे कॉल व व्हाट्सएप पूछताछ', '२. थेट कॉल व व्हॉट्सॲप चौकशी')}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Every sponsored banner includes 1-tap Call, WhatsApp, or Website buttons with live aggregate impression & click tracking.',
                'हर विज्ञापन पर 1-टैप कॉल, व्हाट्सएप या वेबसाइट बटन और कुल व्यू व क्लिक की स्पष्ट रिपोर्ट मिलती है।',
                'प्रत्येक जाहिरातीवर थेट कॉल, व्हॉट्सॲप किंवा वेबसाईट बटण आणि एकूण व्ह्यूज व क्लिक्सचा हिशोब मिळतो.'
              )}
            </p>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3 space-y-1">
            <div className="font-extrabold text-[#C25E00]">
              {tr(lang, '3. Quick Local Approval', '3. त्वरित एडमिन समीक्षा', '३. जलद स्थानिक पडताळणी')}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {tr(
                lang,
                'Register your shop once below, choose categories & pincodes, and submit for fast ROJGAR SETU Admin activation.',
                'नीचे एक बार अपनी दुकान पंजीकृत करें, श्रेणी व पिनकोड चुनें और त्वरित सक्रियण हेतु सबमिट करें।',
                'खाली एकदा दुकानाची नोंदणी करा, कॅटेगिरी व पिनकोड निवडा आणि मंजुरीसाठी पाठवा.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Dedicated Advertisement Panel Switcher: Browse Local Shop Ads vs Post Shop Ad */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs">
        <button
          type="button"
          onClick={() => setPanelTab('browse')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            panelTab === 'browse'
              ? 'bg-[#0B3B75] text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>
            {tr(
              lang,
              `Local Area Ads (${publicAds.length})`,
              `स्थानीय क्षेत्र के विज्ञापन (${publicAds.length})`,
              `स्थानिक परिसरातील जाहिराती (${publicAds.length})`
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPanelTab('post')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            panelTab === 'post'
              ? 'bg-[#E06D1B] text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>
            {tr(lang, 'Post Your Shop Ad', 'अपनी दुकान का विज्ञापन दें', 'तुमच्या दुकानाची जाहिरात टाका')}
          </span>
        </button>
      </div>

      {panelTab === 'browse' && (() => {
        const areaQ = adAreaFilter.trim().toLowerCase();
        const filteredPublicAds = publicAds.filter((ad) => {
          if (adCategoryFilter !== 'all') {
            const cats = (ad.targetCategories || []).map((c) => c.toLowerCase());
            if (!cats.includes(adCategoryFilter.toLowerCase())) return false;
          }
          if (!areaQ) return true;
          const locBlob = [
            ad.title,
            ad.description,
            ad.advertiserName,
            ...(ad.targetDistricts || []),
            ...(ad.targetCities || []),
            ...(ad.targetAreas || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return ad.allLocations || locBlob.includes(areaQ);
        });
        return (
          <section className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={adAreaFilter}
                  onChange={(e) => setAdAreaFilter(e.target.value)}
                  placeholder={tr(
                    lang,
                    'Filter local ads by area, city, 6-digit PIN or shop name...',
                    'क्षेत्र, शहर, पिनकोड या दुकान के नाम से विज्ञापन खोजें...',
                    'परिसर, शहर, ६-अंकी पिनकोड किंवा दुकानाच्या नावाने शोधा...'
                  )}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:border-[#0B3B75]"
                />
              </div>
              <select
                value={adCategoryFilter}
                onChange={(e) => setAdCategoryFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700"
              >
                <option value="all">{tr(lang, 'All Categories', 'सभी श्रेणियाँ', 'सर्व श्रेण्या')}</option>
                {allCategoryChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {filteredPublicAds.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <Megaphone className="w-9 h-9 text-slate-300 mx-auto" />
                <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                  {tr(
                    lang,
                    'No active local shop advertisements in this area yet',
                    'इस क्षेत्र में अभी कोई सक्रिय स्थानीय विज्ञापन नहीं है',
                    'या परिसरात सध्या कोणतीही सक्रिय स्थानिक जाहिरात नाही'
                  )}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  {tr(
                    lang,
                    'Local shopkeepers and businesses can post area promotions directly here for Admin approval.',
                    'स्थानीय दुकानदार और व्यवसायी यहाँ अपना विज्ञापन पोस्ट कर सकते हैं।',
                    'स्थानिक दुकानदार व व्यावसायिक येथे त्यांच्या दुकानाची जाहिरात टाकू शकतात.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setPanelTab('post')}
                  className="px-5 py-2.5 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  {tr(lang, 'Post Your Shop Ad', 'दुकान का विज्ञापन पोस्ट करें', 'तुमच्या दुकानाची जाहिरात टाका')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPublicAds.map((ad) => (
                  <article
                    key={ad.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between"
                  >
                    {ad.bannerImageUrl && (
                      <div className="aspect-[16/7] w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img
                          src={ad.bannerImageUrl}
                          alt={ad.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-extrabold uppercase tracking-wider text-[#C25E00]">
                            {ad.advertiserName}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                            <MapPin className="w-3 h-3 text-[#E06D1B]" />
                            {ad.allLocations
                              ? tr(lang, 'All Areas', 'सभी क्षेत्र', 'सर्व परिसर')
                              : [...(ad.targetCities || []), ...(ad.targetDistricts || [])]
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .join(', ') || tr(lang, 'Local Area', 'स्थानीय क्षेत्र', 'स्थानिक परिसर')}
                          </span>
                        </div>
                        <h3 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75]">
                          {ad.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {ad.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        {ad.callNumber && (
                          <a
                            href={`tel:${ad.callNumber}`}
                            onClick={() =>
                              void recordAdvertisementClick({
                                ad,
                                category: ad.targetCategories?.[0] || 'other_services',
                                state: ad.targetStates?.[0] || 'All',
                                district: ad.targetDistricts?.[0] || 'All',
                                placement: 'homepage',
                                actionType: 'call',
                              })
                            }
                            className="px-3.5 py-2 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{tr(lang, 'Call Shop', 'कॉल करें', 'कॉल करा')}</span>
                          </a>
                        )}
                        {ad.whatsappNumber && (
                          <a
                            href={`https://wa.me/91${ad.whatsappNumber.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              void recordAdvertisementClick({
                                ad,
                                category: ad.targetCategories?.[0] || 'other_services',
                                state: ad.targetStates?.[0] || 'All',
                                district: ad.targetDistricts?.[0] || 'All',
                                placement: 'homepage',
                                actionType: 'whatsapp',
                              })
                            }
                            className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-[#15803D] text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        {ad.websiteUrl && (
                          <a
                            href={ad.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              void recordAdvertisementClick({
                                ad,
                                category: ad.targetCategories?.[0] || 'other_services',
                                state: ad.targetStates?.[0] || 'All',
                                district: ad.targetDistricts?.[0] || 'All',
                                placement: 'homepage',
                                actionType: 'website',
                              })
                            }
                            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{tr(lang, 'Visit', 'वेबसाइट', 'वेबसाईट')}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {panelTab === 'post' && (!user ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <Building2 className="w-10 h-10 text-[#0B3B75] mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#0B3B75]">
            {tr(lang, 'Sign in to Post a Local Shop Advertisement', 'विज्ञापन पोस्ट करने के लिए साइन इन करें', 'जाहिरात टाकण्यासाठी साइन इन करा')}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {tr(
              lang,
              'Sign in with Google to register your local shop or business and submit area advertisements for Admin approval.',
              'अपनी दुकान या व्यवसाय का विज्ञापन सबमिट करने के लिए Google खाते से साइन इन करें।',
              'तुमच्या दुकानाची किंवा व्यवसायाची जाहिरात सबमिट करण्यासाठी Google खात्याने साइन इन करा.'
            )}
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-6 py-3 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold cursor-pointer"
          >
            {tr(lang, 'Sign In with Google', 'Google से साइन इन करें', 'Google ने साइन इन करा')}
          </button>
        </div>
      ) : (
        <>
          {feedback && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
              <span>{feedback}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Advertiser Portal Aggregate Metrics (Own Ads Only, Zero PII) */}
          {myAds.length > 0 && (
            <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Megaphone className="w-3.5 h-3.5 text-[#0B3B75]" /> My Ads
                </div>
                <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
                  {myAds.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-[#E06D1B]" /> Impressions
                </div>
                <div className="font-mono-tabular text-2xl font-extrabold text-[#0B3B75] mt-1">
                  {aggregateStats.impressions.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5 text-[#15803D]" /> Total Clicks
                </div>
                <div className="font-mono-tabular text-2xl font-extrabold text-[#15803D] mt-1">
                  {aggregateStats.clicks.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Call / WhatsApp</div>
                <div className="font-mono-tabular text-xl font-extrabold text-[#0B3B75] mt-1">
                  {aggregateStats.calls} / {aggregateStats.whatsapp}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5 text-[#0B3B75]" /> CTR
                </div>
                <div className="font-mono-tabular text-2xl font-extrabold text-[#C25E00] mt-1">
                  {aggregateStats.impressions > 0
                    ? `${((aggregateStats.clicks / aggregateStats.impressions) * 100).toFixed(1)}%`
                    : '0.0%'}
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* STEP 1: Business / Advertiser Profile */}
            <form
              onSubmit={handleSaveBusinessProfile}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#E06D1B]">
                    {tr(lang, 'Step 1 · Advertiser Registration', 'चरण 1 · व्यवसाय पंजीकरण', 'पायरी १ · व्यवसाय नोंदणी')}
                  </div>
                  <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                    {tr(lang, 'Business / Shop Details', 'व्यवसाय / दुकान विवरण', 'व्यवसाय / दुकानाची माहिती')}
                  </h2>
                </div>
                {profile && (
                  <span
                    className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
                      profile.status === 'approved'
                        ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                        : profile.status === 'rejected' || profile.status === 'suspended'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-[#C25E00] border border-amber-200'
                    }`}
                  >
                    {profile.status}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Business / Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g., Shri Ganesh Plywood & Doors"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Owner / Contact Person *</label>
                    <input
                      type="text"
                      required
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Business Category *</label>
                    <input
                      type="text"
                      required
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      placeholder="Hardware / Plywood / Architect"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Business Address *</label>
                  <input
                    type="text"
                    required
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Shop No., Road, Market Area"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
                    <select
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        const found = INDIA_STATES_DISTRICTS.find((st) => st.name === e.target.value);
                        const dList = found ? found.districts.map((d) => d.name) : [];
                        if (dList[0]) setDistrictName(dList[0]);
                      }}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                    >
                      {INDIA_STATES_DISTRICTS.map((st) => (
                        <option key={st.name} value={st.name}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                    <select
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                    >
                      {districtsForState.map((d: string) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City / Town *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website URL (Optional)</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourbusiness.in"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {profile
                    ? tr(lang, 'Update Business Profile', 'व्यवसाय प्रोफाइल अपडेट करें', 'व्यवसाय प्रोफाइल अपडेट करा')
                    : tr(lang, 'Register Business Account', 'व्यवसाय खाता पंजीकृत करें', 'व्यवसाय खाते नोंदणी करा')}
                </span>
              </button>
            </form>

            {/* STEP 2: Submit Sponsored Advertisement for Admin Approval */}
            <form
              onSubmit={handleSubmitAd}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              <div className="border-b border-slate-100 pb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                  {tr(lang, 'Step 2 · Submit Ad For Admin Approval', 'चरण 2 · विज्ञापन सबमिट करें', 'पायरी २ · जाहिरात पाठवा')}
                </div>
                <h2 className="font-display text-lg font-extrabold text-[#0B3B75] flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#E06D1B]" />
                  <span>{tr(lang, 'Create Sponsored Advertisement', 'प्रायोजित विज्ञापन बनाएँ', 'प्रायोजित जाहिरात तयार करा')}</span>
                </h2>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Advertisement Title *</label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="e.g., Waterproof Flush Doors & Marine Plywood — Wholesale Rates"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Short Ad Description *</label>
                  <textarea
                    rows={2}
                    required
                    maxLength={400}
                    value={adDescription}
                    onChange={(e) => setAdDescription(e.target.value)}
                    placeholder="Mention products, offers, delivery area, or special service..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Banner Image Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Advertisement Banner Image * (16:9 or 3:2 landscape recommended)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-[#0B3B75] cursor-pointer">
                      <Upload className="w-4 h-4 text-[#E06D1B]" />
                      <span>
                        {uploadingBanner ? `Uploading ${uploadPct}%...` : 'Upload Banner Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingBanner}
                        onChange={handleBannerUpload}
                        className="sr-only"
                      />
                    </label>
                    {bannerUrl && (
                      <span className="text-xs font-semibold text-[#15803D] inline-flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Banner ready
                      </span>
                    )}
                  </div>
                  {bannerUrl && (
                    <div className="w-full max-w-md h-36 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Multi-Category Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Target Service Categories * (Customers selecting these services will see your ad)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {allCategoryChoices.map((cat) => {
                      const active = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'border-[#0B3B75] bg-blue-50/70'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-xs font-extrabold text-[#0B3B75]">{cat.label}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{cat.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location Targeting */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#0B3B75] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allLocations}
                      onChange={(e) => setAllLocations(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Show across All Locations (Pan-India / All Districts)</span>
                  </label>
                  {!allLocations && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {tr(lang, 'Target Districts (comma separated)', 'लक्षित ज़िले (कॉमा से अलग)', 'लक्ष्य जिल्हे (स्वल्पविरामाने)')}
                          </label>
                          <input
                            type="text"
                            value={targetDistrictsInput}
                            onChange={(e) => setTargetDistrictsInput(e.target.value)}
                            placeholder="e.g., Chandrapur, Pune, Nagpur"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {tr(lang, 'Target Cities / Towns (comma separated)', 'लक्षित शहर / कस्बे', 'लक्ष्य शहरे / तालुके')}
                          </label>
                          <input
                            type="text"
                            value={targetCitiesInput}
                            onChange={(e) => setTargetCitiesInput(e.target.value)}
                            placeholder="e.g., Ballarpur, Wakad, Kothrud"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#0B3B75] mb-1">
                          {tr(
                            lang,
                            'Target 6-Digit Pincodes & Local Areas (comma separated)',
                            'लक्षित 6-अंकीय पिनकोड व स्थानीय क्षेत्र (कॉमा से अलग)',
                            'लक्ष्य ६-अंकी पिनकोड व स्थानिक परिसर (स्वल्पविरामाने)'
                          )}
                        </label>
                        <input
                          type="text"
                          value={targetAreasInput}
                          onChange={(e) => setTargetAreasInput(e.target.value)}
                          placeholder="e.g., 442401, 442402, Civil Lines, Main Market"
                          className="w-full px-2.5 py-1.5 border border-blue-200 rounded bg-white text-xs focus:border-[#0B3B75] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA Action & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Primary CTA Action *</label>
                    <select
                      value={contactAction}
                      onChange={(e) => setContactAction(e.target.value as AdvertisementActionType)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                    >
                      <option value="call">CALL NOW</option>
                      <option value="whatsapp">WHATSAPP</option>
                      <option value="website">VISIT WEBSITE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Call / Contact Phone</label>
                    <input
                      type="tel"
                      value={adCallNumber}
                      onChange={(e) => setAdCallNumber(e.target.value)}
                      placeholder="10-digit phone"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Duration (Days)</label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                    >
                      <option value={7}>7 Days</option>
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={90}>90 Days</option>
                      <option value={180}>180 Days</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number (Optional)</label>
                    <input
                      type="tel"
                      value={adWhatsappNumber}
                      onChange={(e) => setAdWhatsappNumber(e.target.value)}
                      placeholder="10-digit WhatsApp"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Website Link (Optional)</label>
                    <input
                      type="url"
                      value={adWebsiteUrl}
                      onChange={(e) => setAdWebsiteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAd || uploadingBanner || !profile}
                className="w-full py-3 px-4 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submittingAd && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {tr(
                    lang,
                    'Submit Advertisement for Admin Approval',
                    'एडमिन स्वीकृति हेतु विज्ञापन सबमिट करें',
                    'अ‍ॅडमिन मान्यतेसाठी जाहिरात पाठवा'
                  )}
                </span>
              </button>
              <p className="text-[11px] text-slate-500 text-center">
                {tr(
                  lang,
                  'No advertisement goes live automatically. Our Admin reviews every banner for relevance and authenticity.',
                  'कोई भी विज्ञापन स्वतः लाइव नहीं होता। एडमिन समीक्षा के बाद ही इसे सक्रिय किया जाता है।',
                  'कोणतीही जाहिरात आपोआप लाईव्ह होत नाही. अ‍ॅडमिनच्या तपासणीनंतरच ती प्रसिद्ध होते.'
                )}
              </p>
            </form>
          </div>

          {/* My Submitted Advertisements & Performance Table */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
                {tr(lang, 'My Submitted Advertisements', 'मेरे सबमिट किए गए विज्ञापन', 'माझ्या पाठवलेल्या जाहिराती')} ({myAds.length})
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="text-xs font-bold text-[#0B3B75] hover:underline cursor-pointer"
              >
                {tr(lang, 'Back to Home →', 'मुख्य पृष्ठ पर जाएँ →', 'मुख्य पृष्ठावर जा →')}
              </button>
            </div>

            {myAds.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                {tr(
                  lang,
                  'You have not submitted any advertisements yet. Use the form above to submit your first category ad.',
                  'आपने अभी तक कोई विज्ञापन सबमिट नहीं किया है।',
                  'तुम्ही अद्याप कोणतीही जाहिरात पाठवलेली नाही.'
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {myAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start justify-between"
                  >
                    <div className="flex gap-3.5 min-w-0">
                      <img
                        src={ad.bannerImageUrl}
                        alt={ad.title}
                        className="w-24 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ad.status === 'active'
                                ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                : ad.status === 'pending' || ad.status === 'draft'
                                ? 'bg-amber-50 text-[#C25E00] border border-amber-200'
                                : ad.status === 'rejected' || ad.status === 'expired'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {ad.status}
                          </span>
                          <span className="text-[11px] font-mono-tabular text-slate-500 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {ad.startDate} → {ad.endDate}
                          </span>
                        </div>
                        <h3 className="font-display text-sm sm:text-base font-bold text-[#0B3B75]">
                          {ad.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2">{ad.description}</p>
                        <div className="text-[11px] text-slate-500">
                          Categories: <strong>{ad.targetCategories.join(', ')}</strong>
                        </div>
                        {ad.adminNotes && (
                          <div className="text-[11px] text-[#C25E00] font-semibold">
                            Admin Note: {ad.adminNotes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center shrink-0 w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500">Views</div>
                        <div className="font-mono-tabular text-sm font-extrabold text-[#0B3B75]">
                          {ad.impressionsCount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500">Clicks</div>
                        <div className="font-mono-tabular text-sm font-extrabold text-[#15803D]">
                          {ad.clicksCount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500">WA/Call</div>
                        <div className="font-mono-tabular text-sm font-extrabold text-[#C25E00]">
                          {(ad.whatsappClicksCount || 0) + (ad.callClicksCount || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ))}
    </div>
  );
};
