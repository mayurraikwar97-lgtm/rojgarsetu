import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  FolderPlus,
  Loader2,
  Megaphone,
  MousePointerClick,
  Pause,
  Play,
  PlusCircle,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import { uploadAdBannerImage } from '../lib/workPhotoService';
import {
  DEFAULT_AD_TARGET_CATEGORIES,
  addDaysIsoDate,
  adminCreateAdvertisementCategory,
  adminDeleteAdvertisement,
  adminUpdateAdvertisement,
  adminUpdateAdvertiserStatus,
  getTodayIsoDate,
  isAdvertisementCurrentlyLive,
  submitAdvertisementForApproval,
  subscribeAdAnalyticsAdmin,
  subscribeAdvertisementCategories,
  subscribeAllAdvertisementsAdmin,
  subscribeAllAdvertisersAdmin,
} from '../lib/adsReferralService';
import { subscribeApprovedProfessions } from '../lib/customProfessionService';
import type {
  AdvertisementActionType,
  AdvertisementCategory,
  AdvertisementClick,
  AdvertisementImpression,
  AdvertisementRecord,
  AdvertisementStatus,
  AdvertiserProfile,
  CustomProfessionRecord,
} from '../types/domain';

type AdAdminSubTab = 'ads' | 'create' | 'advertisers' | 'categories' | 'analytics';

export const AdminAdsManagementPanel: React.FC = () => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<AdAdminSubTab>('ads');

  const [ads, setAds] = useState<AdvertisementRecord[]>([]);
  const [advertisers, setAdvertisers] = useState<AdvertiserProfile[]>([]);
  const [customCategories, setCustomCategories] = useState<AdvertisementCategory[]>([]);
  const [approvedProfessions, setApprovedProfessions] = useState<CustomProfessionRecord[]>([]);
  const [impressions, setImpressions] = useState<AdvertisementImpression[]>([]);
  const [clicks, setClicks] = useState<AdvertisementClick[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  // CREATE NEW ADVERTISEMENT form state
  const [advertiserName, setAdvertiserName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['carpenter']);
  const [allLocations, setAllLocations] = useState(true);
  const [targetState, setTargetState] = useState('Maharashtra');
  const [targetDistrictsInput, setTargetDistrictsInput] = useState('');
  const [targetCitiesInput, setTargetCitiesInput] = useState('');
  const [startDate, setStartDate] = useState(getTodayIsoDate());
  const [endDate, setEndDate] = useState(addDaysIsoDate(30));
  const [priority, setPriority] = useState(7);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [totalLimit, setTotalLimit] = useState(0);
  const [budgetInr, setBudgetInr] = useState(0);
  const [contactAction, setContactAction] = useState<AdvertisementActionType>('call');
  const [callNumber, setCallNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [initialStatus, setInitialStatus] = useState<AdvertisementStatus>('active');
  const [creatingAd, setCreatingAd] = useState(false);

  // Custom Category Creator
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatHi, setNewCatHi] = useState('');
  const [newCatMr, setNewCatMr] = useState('');
  const [newCatLinked, setNewCatLinked] = useState<string[]>(['construction']);
  const [creatingCat, setCreatingCat] = useState(false);

  useEffect(() => {
    const u1 = subscribeAllAdvertisementsAdmin(setAds);
    const u2 = subscribeAllAdvertisersAdmin(setAdvertisers);
    const u3 = subscribeAdvertisementCategories(setCustomCategories);
    const u4 = subscribeAdAnalyticsAdmin(setImpressions, setClicks);
    const u5 = subscribeApprovedProfessions(setApprovedProfessions);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  const allCategoryChoices = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string; hint: string }> = [];
    for (const c of DEFAULT_AD_TARGET_CATEGORIES) {
      seen.add(c.id);
      list.push({ id: c.id, label: c.labelEn, hint: c.exampleBusinessesEn });
    }
    for (const c of customCategories) {
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      list.push({
        id: c.slug,
        label: `${c.nameEn} (Custom)`,
        hint: `Linked: ${c.linkedServiceCategories.join(', ')}`,
      });
    }
    for (const p of approvedProfessions) {
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      list.push({
        id: p.slug,
        label: `${p.nameEn} (Approved Profession)`,
        hint: p.description || `Matches customers booking ${p.nameEn}`,
      });
    }
    return list;
  }, [customCategories, approvedProfessions]);

  const filteredAds = useMemo(() => {
    if (statusFilter === 'all') return ads;
    if (statusFilter === 'live_now') return ads.filter((a) => isAdvertisementCurrentlyLive(a));
    return ads.filter((a) => a.status === statusFilter);
  }, [ads, statusFilter]);

  const analyticsSummary = useMemo(() => {
    let totalImpressions = 0;
    let totalUniqueViews = 0;
    let totalClicks = 0;
    let totalCalls = 0;
    let totalWhatsApp = 0;
    let totalWebsite = 0;

    for (const a of ads) {
      totalImpressions += a.impressionsCount || 0;
      totalUniqueViews += a.uniqueViewsCount || 0;
      totalClicks += a.clicksCount || 0;
      totalCalls += a.callClicksCount || 0;
      totalWhatsApp += a.whatsappClicksCount || 0;
      totalWebsite += a.websiteClicksCount || 0;
    }

    const byCategory = new Map<string, { impressions: number; clicks: number }>();
    const byDistrict = new Map<string, { impressions: number; clicks: number }>();

    impressions.forEach((imp) => {
      const cKey = imp.category || 'homepage';
      const curC = byCategory.get(cKey) || { impressions: 0, clicks: 0 };
      curC.impressions += 1;
      byCategory.set(cKey, curC);

      const dKey = imp.district || 'All';
      const curD = byDistrict.get(dKey) || { impressions: 0, clicks: 0 };
      curD.impressions += 1;
      byDistrict.set(dKey, curD);
    });

    clicks.forEach((clk) => {
      const cKey = clk.category || 'homepage';
      const curC = byCategory.get(cKey) || { impressions: 0, clicks: 0 };
      curC.clicks += 1;
      byCategory.set(cKey, curC);

      const dKey = clk.district || 'All';
      const curD = byDistrict.get(dKey) || { impressions: 0, clicks: 0 };
      curD.clicks += 1;
      byDistrict.set(dKey, curD);
    });

    return {
      totalImpressions,
      totalUniqueViews,
      totalClicks,
      totalCalls,
      totalWhatsApp,
      totalWebsite,
      byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1].impressions - a[1].impressions),
      byDistrict: Array.from(byDistrict.entries()).sort((a, b) => b[1].impressions - a[1].impressions),
    };
  }, [ads, impressions, clicks]);

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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload banner image.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleCreateAdminAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setErrorMsg('');
    setFeedback('');

    if (!bannerUrl.trim()) {
      setErrorMsg('Please upload a banner image (or paste a valid image URL).');
      return;
    }
    if (selectedCategories.length === 0) {
      setErrorMsg('Select at least one target category.');
      return;
    }

    setCreatingAd(true);
    try {
      await submitAdvertisementForApproval({
        ownerUid: user.uid,
        advertiserName,
        title,
        description,
        bannerImageUrl: bannerUrl,
        targetCategories: selectedCategories,
        targetStates: allLocations ? [] : [targetState],
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
        allLocations,
        contactAction,
        callNumber,
        whatsappNumber,
        websiteUrl,
        startDate,
        endDate,
        status: initialStatus,
        priority,
        dailyImpressionLimit: dailyLimit,
        totalImpressionLimit: totalLimit,
        budgetInr,
        createdByAdmin: true,
        approvedByUid: user.uid,
      });
      setAdvertiserName('');
      setTitle('');
      setDescription('');
      setBannerUrl('');
      setFeedback(`Advertisement created with status "${initialStatus.toUpperCase()}".`);
      setSubTab('ads');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create advertisement.');
    } finally {
      setCreatingAd(false);
    }
  };

  const handleStatusChange = async (ad: AdvertisementRecord, nextStatus: AdvertisementStatus) => {
    if (!user?.email) return;
    setBusyId(ad.id);
    setErrorMsg('');
    try {
      await adminUpdateAdvertisement({
        adId: ad.id,
        patch: { status: nextStatus },
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(`Ad "${ad.title}" updated to ${nextStatus.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update ad status.');
    } finally {
      setBusyId('');
    }
  };

  const handlePriorityBump = async (ad: AdvertisementRecord, nextPriority: number) => {
    if (!user?.email) return;
    setBusyId(ad.id);
    try {
      await adminUpdateAdvertisement({
        adId: ad.id,
        patch: { priority: Math.min(10, Math.max(1, nextPriority)) },
        adminUid: user.uid,
        adminEmail: user.email,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update priority.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteAd = async (ad: AdvertisementRecord) => {
    if (!user?.email) return;
    setBusyId(ad.id);
    try {
      await adminDeleteAdvertisement(ad.id, user.uid, user.email);
      setFeedback(`Deleted advertisement "${ad.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete advertisement.');
    } finally {
      setBusyId('');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setCreatingCat(true);
    setErrorMsg('');
    try {
      await adminCreateAdvertisementCategory({
        nameEn: newCatEn,
        nameHi: newCatHi,
        nameMr: newCatMr,
        linkedServiceCategories: newCatLinked,
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setNewCatEn('');
      setNewCatHi('');
      setNewCatMr('');
      setFeedback(`Custom advertisement category "${newCatEn}" created.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create category.');
    } finally {
      setCreatingCat(false);
    }
  };

  const pendingAdsCount = ads.filter((a) => a.status === 'pending').length;
  const activeAdsCount = ads.filter((a) => isAdvertisementCurrentlyLive(a)).length;
  const pendingAdvertisersCount = advertisers.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Section Header & Sub-Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#0B3B75] flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#E06D1B]" />
              <span>ADVERTISEMENT MANAGEMENT</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Approve advertiser submissions, post direct sponsored banners, manage custom ad categories, and review aggregate performance (zero customer PII).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubTab('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] text-white text-xs font-extrabold cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>CREATE NEW ADVERTISEMENT</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {(
            [
              { id: 'ads', label: `All Ads (${ads.length}) · Live: ${activeAdsCount} · Pending: ${pendingAdsCount}` },
              { id: 'create', label: 'Create New Ad' },
              { id: 'advertisers', label: `Advertisers (${advertisers.length}) · Pending: ${pendingAdvertisersCount}` },
              { id: 'categories', label: `Ad Categories (${customCategories.length})` },
              { id: 'analytics', label: 'Analytics Report' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#0B3B75] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUB-TAB 1: MANAGE ALL ADVERTISEMENTS */}
      {subTab === 'ads' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#0B3B75]">
              Sponsored Advertisement Inventory ({filteredAds.length})
            </h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            >
              <option value="all">All Statuses</option>
              <option value="live_now">Live Right Now</option>
              <option value="pending">Pending Approval</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {filteredAds.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No advertisements found for this filter. Click "CREATE NEW ADVERTISEMENT" to publish a category-targeted banner.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAds.map((ad) => {
                const liveNow = isAdvertisementCurrentlyLive(ad);
                return (
                  <div
                    key={ad.id}
                    className="border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row gap-4 justify-between"
                  >
                    <div className="flex gap-3.5 min-w-0">
                      <img
                        src={ad.bannerImageUrl}
                        alt={ad.title}
                        className="w-28 h-20 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              liveNow
                                ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                : ad.status === 'pending'
                                ? 'bg-amber-50 text-[#C25E00] border border-amber-200'
                                : ad.status === 'rejected' || ad.status === 'expired'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {liveNow ? 'LIVE ON SLIDER' : ad.status}
                          </span>
                          <span className="text-[11px] font-mono-tabular text-slate-500">
                            {ad.startDate} → {ad.endDate}
                          </span>
                          <span className="text-[11px] font-bold text-[#0B3B75]">
                            Priority: {ad.priority}/10
                          </span>
                        </div>
                        <div className="text-sm font-extrabold text-[#0B3B75]">{ad.title}</div>
                        <div className="text-xs font-semibold text-[#15803D]">{ad.advertiserName}</div>
                        <div className="text-xs text-slate-600 line-clamp-2">{ad.description}</div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-3 pt-0.5">
                          <span>
                            Categories: <strong>{ad.targetCategories.join(', ')}</strong>
                          </span>
                          <span>
                            Locations:{' '}
                            <strong>
                              {ad.allLocations
                                ? 'All India'
                                : [...ad.targetDistricts, ...ad.targetCities].join(', ') || ad.targetStates.join(', ')}
                            </strong>
                          </span>
                          <span>
                            Views: <strong>{ad.impressionsCount}</strong> · Clicks: <strong>{ad.clicksCount}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-2 shrink-0">
                      <div className="flex flex-wrap gap-1.5">
                        {ad.status !== 'active' && (
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleStatusChange(ad, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#15803D] hover:bg-[#116830] text-white text-xs font-bold cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Approve & Activate
                          </button>
                        )}
                        {ad.status === 'active' && (
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleStatusChange(ad, 'paused')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                          >
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </button>
                        )}
                        {ad.status !== 'rejected' && (
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleStatusChange(ad, 'rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        )}
                        {ad.status !== 'expired' && (
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => void handleStatusChange(ad, 'expired')}
                            className="px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                          >
                            Mark Expired
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <label className="text-[11px] text-slate-500 font-semibold">Priority:</label>
                        <select
                          value={ad.priority}
                          disabled={busyId === ad.id}
                          onChange={(e) => void handlePriorityBump(ad, Number(e.target.value))}
                          className="px-2 py-1 border border-slate-300 rounded bg-white text-xs font-bold"
                        >
                          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyId === ad.id}
                          onClick={() => void handleDeleteAd(ad)}
                          aria-label="Delete ad"
                          className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DIRECT ADMIN CREATE NEW ADVERTISEMENT FORM */}
      {subTab === 'create' && (
        <form
          onSubmit={handleCreateAdminAd}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
            CREATE NEW ADVERTISEMENT (Direct Admin Publishing)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Advertiser / Business Name *</label>
              <input
                type="text"
                required
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="e.g., Maharashtra Doors & Plywood Mart"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Advertisement Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Teak Wood Doors & Marine Plywood — Direct Factory Rate"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Advertisement Description *</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short, clear offer text shown on the customer dashboard slider..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {/* Banner Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Banner Image *</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-[#0B3B75] cursor-pointer">
                <Upload className="w-4 h-4 text-[#E06D1B]" />
                <span>{uploadingBanner ? `Uploading ${uploadPct}%...` : 'Upload Banner Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingBanner}
                  onChange={handleBannerUpload}
                  className="sr-only"
                />
              </label>
              <input
                type="url"
                value={bannerUrl.startsWith('data:') ? '' : bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="Or paste https:// banner image URL"
                className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            {bannerUrl && (
              <div className="w-full max-w-md h-36 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                <img src={bannerUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Target Categories */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Select Target Categories * (Strict Category Matching)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {allCategoryChoices.map((cat) => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(cat.id) ? prev.filter((c) => c !== cat.id) : [...prev, cat.id]
                      )
                    }
                    className={`p-2 rounded-lg border text-left text-xs font-bold cursor-pointer ${
                      active
                        ? 'border-[#0B3B75] bg-blue-50 text-[#0B3B75]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat.label}
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
              />
              <span>All Locations (Show nationwide / across all districts)</span>
            </label>
            {!allLocations && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value)}
                  className="px-2.5 py-2 border border-slate-300 rounded bg-white text-xs"
                >
                  {INDIA_STATES_DISTRICTS.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={targetDistrictsInput}
                  onChange={(e) => setTargetDistrictsInput(e.target.value)}
                  placeholder="Districts (comma separated)"
                  className="px-2.5 py-2 border border-slate-300 rounded bg-white text-xs"
                />
                <input
                  type="text"
                  value={targetCitiesInput}
                  onChange={(e) => setTargetCitiesInput(e.target.value)}
                  placeholder="Cities / Areas (comma separated)"
                  className="px-2.5 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Dates, Priority, Limits, Budget, Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority (1–10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Status *</label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as AdvertisementStatus)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="active">Active (Live Immediately)</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Daily Impression Limit (0 = Unlimited)</label>
              <input
                type="number"
                min={0}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Total Impression Limit (0 = Unlimited)</label>
              <input
                type="number"
                min={0}
                value={totalLimit}
                onChange={(e) => setTotalLimit(Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Campaign Budget / Fee (₹)</label>
              <input
                type="number"
                min={0}
                value={budgetInr}
                onChange={(e) => setBudgetInr(Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Contact Action *</label>
              <select
                value={contactAction}
                onChange={(e) => setContactAction(e.target.value as AdvertisementActionType)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="call">CALL NOW</option>
                <option value="whatsapp">WHATSAPP</option>
                <option value="website">VISIT WEBSITE</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Call Phone Number</label>
              <input
                type="tel"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">WhatsApp Number</label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="10-digit WhatsApp"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingAd || uploadingBanner}
            className="px-6 py-3 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {creatingAd && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Publish / Save Advertisement</span>
          </button>
        </form>
      )}

      {/* SUB-TAB 3: ADVERTISER APPROVALS */}
      {subTab === 'advertisers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-[#0B3B75] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#E06D1B]" />
            <span>Registered Advertisers ({advertisers.length})</span>
          </h3>
          {advertisers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No advertiser accounts registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {advertisers.map((adv) => (
                <div
                  key={adv.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[#0B3B75]">{adv.businessName}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-700">
                        {adv.status}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      {adv.contactPerson} · {adv.mobile} · {adv.businessCategory}
                    </div>
                    <div className="text-slate-500">
                      {adv.businessAddress}, {adv.city}, {adv.district}, {adv.state}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {adv.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          user?.email &&
                          void adminUpdateAdvertiserStatus({
                            advertiserId: adv.id,
                            status: 'approved',
                            adminUid: user.uid,
                            adminEmail: user.email,
                          })
                        }
                        className="px-3 py-1.5 rounded bg-[#15803D] text-white text-xs font-bold cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    {adv.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          user?.email &&
                          void adminUpdateAdvertiserStatus({
                            advertiserId: adv.id,
                            status: 'rejected',
                            adminUid: user.uid,
                            adminEmail: user.email,
                          })
                        }
                        className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-xs font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: CUSTOM ADVERTISEMENT CATEGORIES */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            onSubmit={handleCreateCategory}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="font-display text-base font-bold text-[#0B3B75] flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#E06D1B]" />
              <span>Create Custom Advertisement Category</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name (English) *</label>
                <input
                  type="text"
                  required
                  value={newCatEn}
                  onChange={(e) => setNewCatEn(e.target.value)}
                  placeholder="e.g., Solar & Borewell Suppliers"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hindi Label (Optional)</label>
                  <input
                    type="text"
                    value={newCatHi}
                    onChange={(e) => setNewCatHi(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marathi Label (Optional)</label>
                  <input
                    type="text"
                    value={newCatMr}
                    onChange={(e) => setNewCatMr(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Link to Service Categories (shows ads when customer selects these trades)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_AD_TARGET_CATEGORIES.map((c) => {
                    const sel = newCatLinked.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setNewCatLinked((prev) =>
                            prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                          sel ? 'bg-[#0B3B75] text-white border-[#0B3B75]' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {c.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingCat}
              className="px-4 py-2 rounded-lg bg-[#0B3B75] text-white text-xs font-bold cursor-pointer"
            >
              {creatingCat ? 'Creating...' : 'Save Custom Category'}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-[#0B3B75]">
              Active Custom Ad Categories ({customCategories.length})
            </h3>
            {customCategories.length === 0 ? (
              <p className="text-xs text-slate-500">
                All 11 built-in trade categories are active by default. Add custom categories on the left as needed.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {customCategories.map((c) => (
                  <div key={c.id} className="py-2.5">
                    <div className="font-bold text-[#0B3B75]">{c.nameEn}</div>
                    <div className="text-slate-500">
                      Slug: <code>{c.slug}</code> · Linked: {c.linkedServiceCategories.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AGGREGATE ANALYTICS REPORT */}
      {subTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Impressions', value: analyticsSummary.totalImpressions, icon: Eye },
              { label: 'Unique Views', value: analyticsSummary.totalUniqueViews, icon: Eye },
              { label: 'Total Clicks', value: analyticsSummary.totalClicks, icon: MousePointerClick },
              { label: 'Call Clicks', value: analyticsSummary.totalCalls, icon: BarChart3 },
              { label: 'WhatsApp Clicks', value: analyticsSummary.totalWhatsApp, icon: BarChart3 },
              { label: 'Website Clicks', value: analyticsSummary.totalWebsite, icon: BarChart3 },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-500">{m.label}</div>
                <div className="font-mono-tabular text-xl font-extrabold text-[#0B3B75] mt-1">
                  {m.value.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-display text-sm font-bold text-[#0B3B75]">Category-Wise Performance</h4>
              {analyticsSummary.byCategory.length === 0 ? (
                <p className="text-xs text-slate-500">No ad impressions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {analyticsSummary.byCategory.map(([cat, data]) => (
                    <div key={cat} className="py-2 flex items-center justify-between">
                      <span className="font-bold text-slate-700 capitalize">{cat}</span>
                      <span className="font-mono-tabular text-slate-600">
                        {data.impressions} views · {data.clicks} clicks
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-display text-sm font-bold text-[#0B3B75]">District-Wise Performance</h4>
              {analyticsSummary.byDistrict.length === 0 ? (
                <p className="text-xs text-slate-500">No district metrics recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {analyticsSummary.byDistrict.map(([dist, data]) => (
                    <div key={dist} className="py-2 flex items-center justify-between">
                      <span className="font-bold text-slate-700">{dist}</span>
                      <span className="font-mono-tabular text-slate-600">
                        {data.impressions} views · {data.clicks} clicks
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
