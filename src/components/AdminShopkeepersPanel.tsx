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
  SHOPKEEPER_REGISTRATION_FEE_INR,
  adminApproveShopkeeperPayment,
  adminRejectShopkeeperPayment,
  subscribeAllShopkeeperPaymentsAdmin,
  subscribeShopkeeperListings,
} from '../lib/shopkeeperService';
import type { ShopkeeperListing, ShopkeeperRegistrationPayment } from '../types/domain';

export const AdminShopkeepersPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();

  const [shops, setShops] = useState<ShopkeeperListing[]>([]);
  const [payments, setPayments] = useState<ShopkeeperRegistrationPayment[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeShopkeeperListings(setShops);
    const u2 = subscribeAllShopkeeperPaymentsAdmin(setPayments);
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  const shopByUid = useMemo(() => {
    const map: Record<string, ShopkeeperListing> = {};
    for (const s of shops) {
      map[s.ownerUid] = s;
    }
    return map;
  }, [shops]);

  const verifiedPayments = useMemo(
    () => payments.filter((p) => p.status === 'verified'),
    [payments]
  );
  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments]
  );
  const totalVerifiedInr = verifiedPayments.length * SHOPKEEPER_REGISTRATION_FEE_INR;

  if (!isAdmin || !user) return null;

  const adminEmail = user.email || 'admin@rojgarsetu';

  const handleApprove = async (payment: ShopkeeperRegistrationPayment) => {
    setBusyUid(payment.ownerUid);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await adminApproveShopkeeperPayment({
        payment,
        adminUid: user.uid,
        adminEmail,
        adminNotes: notes[payment.ownerUid] || 'Verified ₹500 shopkeeper registration fee.',
      });
      setStatusMessage(
        `Approved ₹500 registration for ${payment.shopName} (Receipt ${res.receiptNo}). Shop is now verified & live.`
      );
    } catch (err) {
      setErrorMessage(
        formatUiError(err, 'Failed to approve shopkeeper payment.', lang)
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (payment: ShopkeeperRegistrationPayment) => {
    setBusyUid(payment.ownerUid);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await adminRejectShopkeeperPayment({
        payment,
        adminUid: user.uid,
        reason: notes[payment.ownerUid] || 'UTR/payment could not be verified.',
      });
      setStatusMessage(`Marked ₹500 payment as failed for ${payment.shopName}.`);
    } catch (err) {
      setErrorMessage(
        formatUiError(err, 'Failed to reject shopkeeper payment.', lang)
      );
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C25E00]">
              Vocal for Local · स्थानिककडून सामान
            </p>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0B3B75] flex items-center gap-2 mt-0.5">
              <Store className="w-5 h-5 text-[#E06D1B]" />
              <span>Shopkeeper Profiles &amp; ₹{SHOPKEEPER_REGISTRATION_FEE_INR} Registration Payments</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Separate from ₹250 worker registration. Approve manual UPI UTR submissions or audit Razorpay verified shopkeeper listings.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-tabular">
            <div className="px-3 py-2 rounded border border-slate-200 bg-slate-50">
              <div className="text-[10px] text-slate-500">Shop Profiles</div>
              <div className="text-sm font-extrabold text-[#0B3B75]">{shops.length}</div>
            </div>
            <div className="px-3 py-2 rounded border border-amber-200 bg-amber-50">
              <div className="text-[10px] text-amber-800">Pending Review</div>
              <div className="text-sm font-extrabold text-[#C25E00]">{pendingPayments.length}</div>
            </div>
            <div className="px-3 py-2 rounded border border-emerald-200 bg-emerald-50">
              <div className="text-[10px] text-emerald-800">Verified Shops</div>
              <div className="text-sm font-extrabold text-[#15803D]">{verifiedPayments.length}</div>
            </div>
            <div className="px-3 py-2 rounded border border-blue-200 bg-blue-50">
              <div className="text-[10px] text-blue-800">Fee Collected</div>
              <div className="text-sm font-extrabold text-[#0B3B75]">
                ₹{totalVerifiedInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-800">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Payment Verification Queue & History */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display text-sm font-bold text-[#0B3B75]">
            ₹{SHOPKEEPER_REGISTRATION_FEE_INR} Shopkeeper Fee Submissions ({payments.length})
          </h3>
          <span className="text-[11px] font-semibold text-slate-500">
            Razorpay payments activate automatically · Manual UPI UTRs require approval
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No shopkeeper ₹{SHOPKEEPER_REGISTRATION_FEE_INR} registration payments submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {payments.map((payment) => {
              const listing = shopByUid[payment.ownerUid];
              const isBusy = busyUid === payment.ownerUid;
              const isVerified = payment.status === 'verified';
              const isFailed = payment.status === 'failed';
              return (
                <div
                  key={payment.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-[#0B3B75]">
                        {payment.shopName}
                      </span>
                      <span className="text-xs text-slate-500">({payment.ownerName})</span>
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#15803D]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          VERIFIED ₹{payment.amountInr}
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-[#C25E00]">
                          <Clock className="w-3.5 h-3.5" />
                          PENDING VERIFICATION (₹{payment.amountInr})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="font-mono-tabular">ID: {payment.registrationId}</span>
                      <span className="font-mono-tabular">Method: {payment.paymentMethod}</span>
                      {payment.utrOrGatewayRef && (
                        <span className="font-mono-tabular font-semibold text-[#0B3B75]">
                          Ref / UTR: {payment.utrOrGatewayRef}
                        </span>
                      )}
                      {payment.gatewayPaymentId && (
                        <span className="font-mono-tabular text-slate-500">
                          Gateway ID: {payment.gatewayPaymentId}
                        </span>
                      )}
                      {payment.receiptNo && (
                        <span className="font-mono-tabular text-[#15803D]">
                          Receipt: {payment.receiptNo}
                        </span>
                      )}
                    </div>

                    {listing && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-semibold text-[#C25E00]">
                          {listing.customCategoryName || getShopCategoryLabel(listing.shopCategory, lang)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {listing.cityOrVillage}, {listing.district} · PIN {listing.pincode}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono-tabular">
                          <Phone className="w-3 h-3" />
                          {listing.contactPhone}
                        </span>
                      </div>
                    )}

                    {payment.adminNotes && (
                      <p className="text-[11px] text-slate-500 italic">
                        Note: {payment.adminNotes}
                      </p>
                    )}
                  </div>

                  {!isVerified && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={notes[payment.ownerUid] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [payment.ownerUid]: e.target.value }))
                        }
                        placeholder="Optional verification note"
                        className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-full sm:w-44"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleApprove(payment)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-[#15803D] hover:bg-[#116830] text-white text-xs font-bold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve &amp; Activate</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReject(payment)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-bold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Mark Failed</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Directory Preview */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="font-display text-sm font-bold text-[#0B3B75]">
            All Registered Local Shops ({shops.length})
          </h3>
        </div>
        {shops.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No shopkeeper profiles saved yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {shop.logoDataUrl ? (
                    <img
                      src={shop.logoDataUrl}
                      alt={shop.shopName}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4 text-[#E06D1B]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-[#0B3B75] truncate">{shop.shopName}</div>
                    <div className="text-slate-500 truncate">
                      {shop.ownerName} ·{' '}
                      {shop.customCategoryName || getShopCategoryLabel(shop.shopCategory, lang)} ·{' '}
                      {shop.cityOrVillage}, {shop.district} ({shop.pincode})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-tabular text-slate-600">{shop.contactPhone}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      shop.registrationPaymentStatus === 'verified'
                        ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                        : 'bg-amber-50 text-[#C25E00] border border-amber-200'
                    }`}
                  >
                    {shop.registrationPaymentStatus === 'verified'
                      ? 'Verified ₹500'
                      : shop.registrationPaymentStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
