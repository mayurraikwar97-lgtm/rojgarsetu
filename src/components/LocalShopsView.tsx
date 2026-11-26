import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { SHOP_CATEGORY_CATALOG, getShopCategoryLabel } from '../data/shopCategories';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language, PageRoute, ShopkeeperListing, ShopkeeperPurpose } from '../types/domain';

interface LocalShopsViewProps {
  shops: ShopkeeperListing[];
  initialPincodeOrArea?: string;
  onNavigate: (route: PageRoute, categoryFilter?: string) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

function formatTime12h(hhmm: string): string {
  const parts = (hhmm || '').split(':');
  if (parts.length !== 2) return hhmm || '';
  const h = Number(parts[0]);
  const m = parts[1];
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

export const LocalShopsView: React.FC<LocalShopsViewProps> = ({
  shops,
  initialPincodeOrArea = '',
  onNavigate,
}) => {
  const { lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [pincodeOrArea, setPincodeOrArea] = useState(initialPincodeOrArea);
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'all' | ShopkeeperPurpose>('all');

  const visibleShops = useMemo(
    () =>
      shops.filter(
        (s) =>
          s.verificationStatus === 'verified' ||
          (s.verificationStatus === 'pending' && (isAdmin || (user && s.ownerUid === user.uid)))
      ),
    [shops, isAdmin, user]
  );

  // Merge standard categories + any custom shop categories created by shopkeepers
  const allCategoryChips = useMemo(() => {
    const builtInNames = new Set(SHOP_CATEGORY_CATALOG.map((c) => c.en.toLowerCase()));
    const customSet = new Map<string, string>();
    visibleShops.forEach((s) => {
      const cat = (s.customCategoryName || s.shopCategory || '').trim();
      if (cat && !builtInNames.has(cat.toLowerCase())) {
        customSet.set(cat.toLowerCase(), cat);
      }
    });
    return {
      builtIn: SHOP_CATEGORY_CATALOG,
      custom: Array.from(customSet.values()),
    };
  }, [visibleShops]);

  const districts = useMemo(() => {
    const st = INDIA_STATES_DISTRICTS.find((s) => s.name === stateFilter);
    return st ? st.districts.map((d) => d.name) : [];
  }, [stateFilter]);

  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const locQ = pincodeOrArea.trim().toLowerCase();
    return visibleShops
      .filter((s) => !stateFilter || s.state === stateFilter)
      .filter((s) => !districtFilter || s.district === districtFilter)
      .filter((s) => {
        if (!categoryFilter) return true;
        return (
          s.shopCategory.toLowerCase() === categoryFilter.toLowerCase() ||
          (s.customCategoryName || '').toLowerCase() === categoryFilter.toLowerCase()
        );
      })
      .filter((s) => {
        if (purposeFilter === 'all') return true;
        if (purposeFilter === 'both') return s.purpose === 'both';
        return s.purpose === purposeFilter || s.purpose === 'both';
      })
      .filter((s) => {
        if (!locQ) return true;
        const blob = `${s.pincode} ${s.cityOrVillage} ${s.district} ${s.state} ${s.fullAddress}`.toLowerCase();
        return blob.includes(locQ);
      })
      .filter((s) => {
        if (!q) return true;
        const blob = `${s.shopName} ${s.ownerName} ${s.shopCategory} ${s.customCategoryName || ''} ${s.description || ''} ${s.cityOrVillage} ${s.district} ${s.pincode}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        // Prioritize paid/verified Vocal for Local shops first
        const paidScoreA = a.paidListingActive || a.registrationPaymentStatus === 'verified' ? 1 : 0;
        const paidScoreB = b.paidListingActive || b.registrationPaymentStatus === 'verified' ? 1 : 0;
        return paidScoreB - paidScoreA;
      });
  }, [visibleShops, searchQuery, pincodeOrArea, stateFilter, districtFilter, categoryFilter, purposeFilter]);

  const hasActiveFilters = Boolean(
    searchQuery || pincodeOrArea || stateFilter || districtFilter || categoryFilter || purposeFilter !== 'all'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Vocal for Local Hero Banner */}
      <div className="rounded-xl bg-gradient-to-r from-[#0B3B75] via-[#0B3B75] to-[#134B8F] text-white p-6 sm:p-7 border-b-4 border-[#E06D1B] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#E06D1B] text-white text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {tr(
                  lang,
                  'VOCAL FOR LOCAL · BUY FROM LOCAL SHOPS',
                  'वोकल फॉर लोकल · स्थानीय दुकान से सामान खरीदें',
                  'व्होकल फॉर लोकल · स्थानिककडून सामान'
                )}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              {tr(
                lang,
                'Nearby Local Shops & Trusted Neighborhood Stores',
                'आपके नज़दीक स्थानीय दुकानें एवं विश्वसनीय बाज़ार',
                'तुमच्या जवळची स्थानिक दुकाने व विश्वासार्ह दुकानदार'
              )}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              {tr(
                lang,
                'Support neighborhood shopkeepers — buy daily essentials, hardware, medicines, groceries, and local goods directly from shops in your pincode with zero middlemen.',
                'आस-पास के स्थानीय दुकानदारों को बढ़ावा दें — अपने पिनकोड की दुकानों से किराना, हार्डवेयर, मेडिकल, कपड़े व रोज़मर्रा का सामान सीधे खरीदें।',
                'आपल्या परिसरातील स्थानिक दुकानदारांना साथ द्या — तुमच्या पिनकोडमधील दुकानांतून किराणा, हार्डवेअर, मेडिकल, कपडे व दैनंदिन सामान थेट खरेदी करा.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('register-shopkeeper')}
              className="px-5 py-3 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>
                {tr(
                  lang,
                  'Register Your Shop',
                  'अपनी दुकान जोड़ें',
                  'दुकान नोंदवा'
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('find-workers')}
              className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span>{tr(lang, 'Browse Workers', 'कामगार देखें', 'कामगार पहा')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('find-work')}
              className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-emerald-300" />
              <span>{tr(lang, 'Browse Jobs', 'काम देखें', 'कामे पहा')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Location / Pincode & Category Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr(
                lang,
                'Search shop name, goods, category...',
                'दुकान का नाम, सामान या श्रेणी खोजें...',
                'दुकानाचे नाव, सामान किंवा प्रकार शोधा...'
              )}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>

          <div className="relative">
            <MapPin className="w-4 h-4 text-[#E06D1B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pincodeOrArea}
              onChange={(e) => setPincodeOrArea(e.target.value)}
              placeholder={tr(
                lang,
                'Filter by 6-digit Pincode or Area...',
                '6 अंकों का पिनकोड या क्षेत्र डालें...',
                '६ अंकी पिनकोड किंवा परिसर टाका...'
              )}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
            />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setDistrictFilter('');
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">{tr(lang, 'All States', 'सभी राज्य', 'सर्व राज्ये')}</option>
            {INDIA_STATES_DISTRICTS.map((st) => (
              <option key={st.name} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            disabled={!stateFilter}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-50"
          >
            <option value="">{tr(lang, 'All Districts', 'सभी जिले', 'सर्व जिल्हे')}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Purpose Filter + Category Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all' as const, label: tr(lang, 'All Shops', 'सभी दुकानें', 'सर्व दुकाने') },
                {
                  id: 'promote_local_goods' as const,
                  label: tr(lang, 'Local Goods / Buy Local', 'स्थानिक सामान', 'स्थानिककडून सामान'),
                },
                {
                  id: 'hire_staff' as const,
                  label: tr(lang, 'Hiring Local Staff', 'स्टाफ भर्ती', 'कामगार हायर करत आहेत'),
                },
              ]
            ).map((pf) => (
              <button
                key={pf.id}
                type="button"
                onClick={() => setPurposeFilter(pf.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                  purposeFilter === pf.id
                    ? 'bg-[#15803D] text-white border-[#15803D]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#15803D]'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPincodeOrArea('');
                setStateFilter('');
                setDistrictFilter('');
                setCategoryFilter('');
                setPurposeFilter('all');
              }}
              className="text-xs font-bold text-[#C25E00] hover:underline cursor-pointer"
            >
              {tr(lang, 'Clear Filters', 'फ़िल्टर हटाएँ', 'फिल्टर काढा')}
            </button>
          )}
        </div>

        {/* Compact Category Chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
              categoryFilter === ''
                ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                : 'bg-white text-slate-700 border-slate-200 hover:border-[#0B3B75]'
            }`}
          >
            {tr(lang, 'All Categories', 'सभी श्रेणियाँ', 'सर्व प्रकार')}
          </button>
          {allCategoryChips.builtIn.map((cat) => {
            const active = categoryFilter.toLowerCase() === cat.en.toLowerCase();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(active ? '' : cat.en)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                  active
                    ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#0B3B75]'
                }`}
              >
                {getShopCategoryLabel(cat.id, lang)}
              </button>
            );
          })}
          {allCategoryChips.custom.map((customCat) => {
            const active = categoryFilter.toLowerCase() === customCat.toLowerCase();
            return (
              <button
                key={customCat}
                type="button"
                onClick={() => setCategoryFilter(active ? '' : customCat)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                  active
                    ? 'bg-[#E06D1B] text-white border-[#E06D1B]'
                    : 'bg-amber-50 text-[#9A3412] border-amber-200 hover:border-[#E06D1B]'
                }`}
              >
                {customCat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Grid */}
      {filteredShops.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Store className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
            {tr(
              lang,
              'No Local Shops Found for This Filter Yet',
              'इस क्षेत्र / फ़िल्टर में अभी कोई दुकान सूचीबद्ध नहीं है',
              'या परिसर / फिल्टरमध्ये सध्या कोणतेही दुकान नोंदलेले नाही'
            )}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {tr(
              lang,
              'Are you a local shopkeeper? Be among the first shops in your pincode on Rojgar Setu Vocal for Local so nearby customers can find and contact your shop directly.',
              'क्या आप स्थानीय दुकानदार हैं? अपने पिनकोड में "वोकल फॉर लोकल" पर सबसे पहले अपनी दुकान जोड़ें ताकि नज़दीकी ग्राहक सीधे आपसे जुड़ सकें।',
              'तुम्ही स्थानिक दुकानदार आहात का? तुमच्या पिनकोडमध्ये "व्होकल फॉर लोकल" वर सर्वात आधी तुमचे दुकान नोंदवा जेणेकरून जवळचे ग्राहक थेट संपर्क साधू शकतील.'
            )}
          </p>
          <div className="pt-1 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('register-shopkeeper')}
              className="px-5 py-2.5 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>
                {tr(lang, 'Register Your Shop', 'अपनी दुकान पंजीकृत करें', 'दुकान नोंदणी करा')}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShops.map((shop) => {
            const isVerifiedPaid =
              shop.paidListingActive || shop.registrationPaymentStatus === 'verified';
            const cleanWa = (shop.whatsappNumber || shop.contactPhone || '').replace(/\D/g, '');
            const waHref = cleanWa
              ? `https://wa.me/91${cleanWa}?text=${encodeURIComponent(
                  `नमस्कार ${shop.shopName}, मला ROJGAR SETU (व्होकल फॉर लोकल) वरून तुमचे दुकान दिसले.`
                )}`
              : '';
            const purposeLabel =
              shop.purpose === 'hire_staff'
                ? tr(lang, 'Hiring Local Staff', 'स्टाफ भर्ती', 'कामगार हायर करत आहेत')
                : shop.purpose === 'promote_local_goods'
                ? tr(lang, 'Local Goods · Buy Local', 'स्थानीय सामान', 'स्थानिककडून सामान')
                : tr(lang, 'Local Goods + Staff Hiring', 'स्थानीय सामान + स्टाफ', 'स्थानिक सामान + कामगार');

            return (
              <article
                key={shop.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3.5 shadow-sm hover:border-[#0B3B75]/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg border border-slate-200 bg-amber-50/60 overflow-hidden flex items-center justify-center shrink-0">
                      {shop.logoDataUrl ? (
                        <img
                          src={shop.logoDataUrl}
                          alt={shop.shopName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-6 h-6 text-[#E06D1B]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="font-display text-base font-extrabold text-[#0B3B75] truncate">
                          {shop.shopName}
                        </h2>
                        {isVerifiedPaid && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-[#15803D] text-[10px] font-extrabold shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{tr(lang, 'Verified', 'सत्यापित', 'सत्यापित')}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#C25E00] mt-0.5 truncate">
                        {getShopCategoryLabel(shop.customCategoryName || shop.shopCategory, lang)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {tr(lang, 'Owner', 'मालिक', 'दुकानदार')}: {shop.ownerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-[#9A3412]">
                      <Sparkles className="w-3 h-3 text-[#E06D1B]" />
                      {purposeLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-mono-tabular font-bold text-[#0B3B75]">
                      PIN: {shop.pincode}
                    </span>
                  </div>

                  {shop.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {shop.description}
                    </p>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E06D1B] shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {shop.fullAddress}, {shop.cityOrVillage}, {shop.district} ({shop.pincode})
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0B3B75] shrink-0" />
                      <span className="font-semibold text-slate-700">
                        {formatTime12h(shop.openingTime)} – {formatTime12h(shop.closingTime)}
                        {shop.weeklyOff ? ` · ${shop.weeklyOff}` : ''}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <a
                    href={`tel:+91${shop.contactPhone.replace(/\D/g, '')}`}
                    className="py-2 px-3 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{tr(lang, 'Call Shop', 'कॉल करें', 'कॉल करा')}</span>
                  </a>
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-lg bg-[#15803D] hover:bg-[#116931] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <span className="py-2 px-3 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold text-center">
                      {shop.registrationId}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
