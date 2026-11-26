import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getShopCategoryLabel } from '../data/shopCategories';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import {
  adminUpdateShopVerification,
  subscribeShopkeeperListings,
} from '../lib/shopkeeperService';
import type { ShopkeeperListing } from '../types/domain';

export const AdminShopkeepersPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();

  const [shops, setShops] = useState<ShopkeeperListing[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'suspended'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeShopkeeperListings(setShops);
    return () => unsub();
  }, [isAdmin]);

  const counts = useMemo(
    () => ({
      all: shops.length,
      pending: shops.filter((s) => s.verificationStatus === 'pending').length,
      verified: shops.filter((s) => s.verificationStatus === 'verified').length,
      suspended: shops.filter((s) => s.verificationStatus === 'suspended').length,
    }),
    [shops]
  );

  const visibleShops = useMemo(() => {
    if (filterStatus === 'all') return shops;
    return shops.filter((s) => s.verificationStatus === filterStatus);
  }, [shops, filterStatus]);

  if (!isAdmin || !user) return null;

  const adminEmail = user.email || 'admin@rojgarsetu';

  const handleSetStatus = async (shop: ShopkeeperListing, status: 'verified' | 'pending' | 'suspended') => {
    setBusyId(shop.id);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await adminUpdateShopVerification({
        shopId: shop.id,
        status,
        adminUid: user.uid,
        adminEmail,
      });
      setStatusMessage(
        status === 'verified'
          ? lang === 'mr'
            ? `${shop.shopName} मंजूर केले — आता स्थानिक दुकाने यादीत लाईव्ह दिसेल.`
            : lang === 'hi'
            ? `${shop.shopName} स्वीकृत — अब स्थानीय दुकानें सूची में लाइव दिखेगा।`
            : `Approved ${shop.shopName} — now verified and live in Local Shops.`
          : status === 'suspended'
          ? `Suspended ${shop.shopName}.`
          : `Moved ${shop.shopName} back to pending review.`
      );
    } catch (err) {
      setErrorMessage(formatUiError(err, 'Failed to update shop approval status.', lang));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C25E00]">
              Vocal for Local · स्थानिक दुकाने मंजुरी
            </p>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75] flex items-center gap-2 mt-0.5">
              <Store className="w-5 h-5 text-[#E06D1B]" />
              <span>
                {lang === 'mr'
                  ? 'दुकानदार नोंदणी व अ‍ॅडमिन मंजुरी'
                  : lang === 'hi'
                  ? 'दुकानदार पंजीकरण एवं एडमिन अनुमोदन'
                  : 'Shopkeeper Registrations & Admin Approval'}
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: lang === 'mr' ? 'सर्व' : lang === 'hi' ? 'सभी' : 'All', count: counts.all },
                { id: 'pending', label: lang === 'mr' ? 'प्रलंबित' : lang === 'hi' ? 'लंबित' : 'Pending', count: counts.pending },
                { id: 'verified', label: lang === 'mr' ? 'मंजूर' : lang === 'hi' ? 'स्वीकृत' : 'Approved', count: counts.verified },
                { id: 'suspended', label: lang === 'mr' ? 'निलंबित' : lang === 'hi' ? 'निलंबित' : 'Suspended', count: counts.suspended },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                  filterStatus === tab.id
                    ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-slate-500 font-semibold">Total Shops</div>
            <div className="font-mono-tabular text-xl font-extrabold text-[#0B3B75] mt-0.5">{counts.all}</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="text-amber-800 font-semibold">Pending Approval</div>
            <div className="font-mono-tabular text-xl font-extrabold text-[#C25E00] mt-0.5">{counts.pending}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-emerald-800 font-semibold">Approved &amp; Live</div>
            <div className="font-mono-tabular text-xl font-extrabold text-[#15803D] mt-0.5">{counts.verified}</div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="text-red-800 font-semibold">Suspended</div>
            <div className="font-mono-tabular text-xl font-extrabold text-red-700 mt-0.5">{counts.suspended}</div>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-[#15803D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-700 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {visibleShops.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          {lang === 'mr'
            ? 'या श्रेणीत कोणतेही दुकानदार नोंदणी नाहीत.'
            : lang === 'hi'
            ? 'इस श्रेणी में कोई दुकानदार पंजीकरण नहीं है।'
            : 'No shopkeeper registrations in this category yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleShops.map((shop) => {
            const isBusy = busyId === shop.id;
            const isVerified = shop.verificationStatus === 'verified';
            const isSuspended = shop.verificationStatus === 'suspended';
            return (
              <div
                key={shop.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-extrabold text-[#0B3B75]">
                      {shop.shopName}
                    </span>
                    <span className="text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {shop.registrationId}
                    </span>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#15803D]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {lang === 'mr' ? 'मंजूर / लाईव्ह' : lang === 'hi' ? 'स्वीकृत / लाइव' : 'Approved & Live'}
                      </span>
                    ) : isSuspended ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                        <XCircle className="w-3.5 h-3.5" />
                        {lang === 'mr' ? 'निलंबित' : lang === 'hi' ? 'निलंबित' : 'Suspended'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-[#9A3412]">
                        <Clock className="w-3.5 h-3.5" />
                        {lang === 'mr' ? 'मंजुरी प्रलंबित' : lang === 'hi' ? 'अनुमोदन लंबित' : 'Pending Approval'}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-slate-800">
                      {shop.ownerName}
                    </span>
                    <span>· {shop.customCategoryName || getShopCategoryLabel(shop.shopCategory, lang)}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E06D1B]" />
                      {shop.cityOrVillage}, {shop.district} ({shop.pincode})
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular">
                      <Phone className="w-3.5 h-3.5 text-[#15803D]" />
                      +91 {shop.contactPhone}
                    </span>
                  </div>

                  {shop.fullAddress && (
                    <p className="text-xs text-slate-500">{shop.fullAddress}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isVerified && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetStatus(shop, 'verified')}
                      className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116830] disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {lang === 'mr' ? 'मंजूर करा (Go Live)' : lang === 'hi' ? 'स्वीकृत करें (Go Live)' : 'Approve & Go Live'}
                      </span>
                    </button>
                  )}
                  {isVerified && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetStatus(shop, 'pending')}
                      className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-60 text-amber-900 text-xs font-bold cursor-pointer"
                    >
                      {lang === 'mr' ? 'प्रलंबित करा' : lang === 'hi' ? 'लंबित करें' : 'Set Pending'}
                    </button>
                  )}
                  {!isSuspended ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetStatus(shop, 'suspended')}
                      className="px-3 py-2 rounded-lg border border-red-300 bg-white hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      {lang === 'mr' ? 'निलंबित करा' : lang === 'hi' ? 'निलंबित करें' : 'Suspend'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetStatus(shop, 'verified')}
                      className="px-3 py-2 rounded-lg bg-[#0B3B75] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                    >
                      {lang === 'mr' ? 'पुन्हा सुरू करा' : lang === 'hi' ? 'पुनः सक्रिय करें' : 'Restore'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
