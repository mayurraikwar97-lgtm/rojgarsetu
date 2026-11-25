import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  maskMobileNumber,
  validateUpiUtrOnServer,
  type CreatedPaymentOrder,
} from './workerPaymentService';
import type {
  PaymentMethodType,
  ShopkeeperListing,
  ShopkeeperPurpose,
  ShopkeeperRegistrationPayment,
} from '../types/domain';

export const SHOPKEEPER_REGISTRATION_FEE_INR = 500;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_LOGO_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_DATA_URL_CHARS = 150_000;

export function buildShopRegistrationId(uid: string): string {
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'SHOP';
  return `RS-SHOP-${tag}`;
}

export function buildShopReceiptNo(uid: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tag = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHP';
  const rnd = Math.floor(100 + Math.random() * 900);
  return `RS-SHP-${datePart}-${tag}${rnd}`;
}

/**
 * Safely resizes an optional shop logo/thumbnail to a small square JPEG/WEBP data URL
 * strictly bounded below Firestore limits and restricted to safe raster image MIME types.
 */
export async function processShopLogoFile(file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.has((file.type || '').toLowerCase())) {
    throw new Error('INVALID_TYPE');
  }
  if (file.size > MAX_LOGO_INPUT_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('READ_ERROR'));
    reader.readAsDataURL(file);
  });

  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(rawDataUrl)) {
    throw new Error('INVALID_TYPE');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('READ_ERROR'));
    el.src = rawDataUrl;
  });

  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('READ_ERROR');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let quality = 0.8;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (output.length > MAX_LOGO_DATA_URL_CHARS && quality > 0.35) {
    quality -= 0.12;
    output = canvas.toDataURL('image/jpeg', quality);
  }
  if (output.length > MAX_LOGO_DATA_URL_CHARS) {
    throw new Error('FILE_TOO_LARGE');
  }
  return output;
}

export async function saveShopkeeperProfile(params: {
  ownerUid: string;
  shopName: string;
  ownerName: string;
  shopCategory: string;
  customCategoryName?: string;
  purpose: ShopkeeperPurpose;
  description?: string;
  state: string;
  district: string;
  cityOrVillage: string;
  fullAddress: string;
  pincode: string;
  approxLat?: number;
  approxLng?: number;
  contactPhone: string;
  whatsappNumber?: string;
  openingTime: string;
  closingTime: string;
  weeklyOff?: string;
  logoDataUrl?: string;
  vocalForLocalPledge: boolean;
}): Promise<{ shopId: string; registrationId: string }> {
  const shopId = params.ownerUid;
  const ref = doc(db, 'shopkeeperListings', shopId);

  const cleanPhone = params.contactPhone.replace(/\D/g, '').slice(0, 10);
  const cleanWhatsapp = (params.whatsappNumber || '').replace(/\D/g, '').slice(0, 10);
  const cleanPincode = params.pincode.replace(/\D/g, '').slice(0, 6);
  const cleanLogo =
    params.logoDataUrl &&
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(params.logoDataUrl) &&
    params.logoDataUrl.length <= MAX_LOGO_DATA_URL_CHARS
      ? params.logoDataUrl
      : '';

  const editableFields = {
    shopName: params.shopName.trim().slice(0, 120),
    ownerName: params.ownerName.trim().slice(0, 120),
    shopCategory: params.shopCategory.trim().slice(0, 80),
    ...(params.customCategoryName?.trim()
      ? { customCategoryName: params.customCategoryName.trim().slice(0, 80) }
      : {}),
    purpose: params.purpose,
    ...(params.description?.trim() ? { description: params.description.trim().slice(0, 600) } : {}),
    state: params.state.trim().slice(0, 80),
    district: params.district.trim().slice(0, 80),
    cityOrVillage: params.cityOrVillage.trim().slice(0, 100),
    fullAddress: params.fullAddress.trim().slice(0, 300),
    pincode: cleanPincode,
    ...(typeof params.approxLat === 'number' && Number.isFinite(params.approxLat)
      ? { approxLat: params.approxLat }
      : {}),
    ...(typeof params.approxLng === 'number' && Number.isFinite(params.approxLng)
      ? { approxLng: params.approxLng }
      : {}),
    contactPhone: cleanPhone,
    ...(cleanWhatsapp.length === 10 ? { whatsappNumber: cleanWhatsapp } : {}),
    openingTime: params.openingTime.trim().slice(0, 10) || '09:00',
    closingTime: params.closingTime.trim().slice(0, 10) || '21:00',
    ...(params.weeklyOff?.trim() ? { weeklyOff: params.weeklyOff.trim().slice(0, 40) } : {}),
    ...(cleanLogo ? { logoDataUrl: cleanLogo } : {}),
    vocalForLocalPledge: Boolean(params.vocalForLocalPledge),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as ShopkeeperListing;
      await updateDoc(ref, {
        ...editableFields,
        updatedAt: serverTimestamp(),
      });
      return {
        shopId,
        registrationId: existingData.registrationId || buildShopRegistrationId(shopId),
      };
    }

    const registrationId = buildShopRegistrationId(shopId);
    await setDoc(ref, {
      ownerUid: shopId,
      registrationId,
      ...editableFields,
      registrationFeeInr: SHOPKEEPER_REGISTRATION_FEE_INR,
      registrationPaymentStatus: 'unpaid',
      paidListingActive: false,
      verificationStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { shopId, registrationId };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shopkeeperListings/${shopId}`);
  }
}

export async function createServerShopkeeperOrder(params: {
  registrationId?: string;
  shopName?: string;
}): Promise<CreatedPaymentOrder> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in first to initiate the ₹500 shopkeeper registration payment.');
  const resp = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      paymentType: 'shopkeeper_registration',
      amountInr: SHOPKEEPER_REGISTRATION_FEE_INR,
      ...(params.registrationId ? { registrationId: params.registrationId } : {}),
      ...(params.shopName ? { shopName: params.shopName } : {}),
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error((data as { error?: string }).error || 'Unable to create ₹500 shopkeeper payment order.');
  }
  return data as CreatedPaymentOrder;
}

export async function verifyShopkeeperGatewayPayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderRef?: string;
  registrationId?: string;
  shopName?: string;
  ownerName?: string;
  shopCategory?: string;
  shopLocation?: string;
  contactPhoneMasked?: string;
}): Promise<{
  verified: boolean;
  captured?: boolean;
  paymentStatus?: string;
  registrationId?: string;
  receiptNo?: string;
  alreadyVerified?: boolean;
  activatedOnServer?: boolean;
  reason?: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required.');
  const resp = await fetch('/api/payments/verify-gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      paymentType: 'shopkeeper_registration',
      ...params,
    }),
  });
  const data = (await resp.json()) as {
    verified?: boolean;
    captured?: boolean;
    paymentStatus?: string;
    registrationId?: string;
    receiptNo?: string;
    alreadyVerified?: boolean;
    activatedOnServer?: boolean;
    reason?: string;
    error?: string;
  };
  if (!resp.ok || !data.verified) {
    throw new Error(data.error || data.reason || 'Shopkeeper payment verification failed.');
  }
  return {
    verified: true,
    captured: data.captured,
    paymentStatus: data.paymentStatus,
    registrationId: data.registrationId,
    receiptNo: data.receiptNo,
    alreadyVerified: data.alreadyVerified,
    activatedOnServer: data.activatedOnServer,
    reason: data.reason,
  };
}

export async function recordShopkeeperGatewayAttempt(params: {
  outcome: 'failed' | 'cancelled';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  orderRef?: string;
  reason?: string;
}): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/payments/record-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        paymentType: 'shopkeeper_registration',
        ...params,
      }),
    });
  } catch {
    // Non-blocking audit
  }
}

export async function submitShopkeeperUpiPaymentProof(params: {
  ownerUid: string;
  shopName: string;
  ownerName: string;
  shopCategory: string;
  shopLocation: string;
  contactPhone: string;
  registrationId: string;
  paymentMethod: PaymentMethodType;
  orderRef: string;
  utrOrGatewayRef: string;
  payerUpiOrName?: string;
  termsAccepted: boolean;
}): Promise<string> {
  if (!params.termsAccepted) {
    throw new Error('Please accept the ₹500 Shopkeeper Registration terms before submitting payment.');
  }

  const utrValidation = await validateUpiUtrOnServer(params.utrOrGatewayRef);
  const paymentDocId = params.ownerUid;
  const paymentRef = doc(db, 'shopkeeperPayments', paymentDocId);
  const shopRef = doc(db, 'shopkeeperListings', paymentDocId);

  try {
    const existingSnap = await getDoc(paymentRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as ShopkeeperRegistrationPayment;
      if (existing.status === 'verified') {
        throw new Error('Your ₹500 shopkeeper registration fee is already verified.');
      }
      await updateDoc(paymentRef, {
        paymentMethod: params.paymentMethod,
        orderRef: params.orderRef.trim().slice(0, 80),
        utrOrGatewayRef: utrValidation.normalizedUtr.slice(0, 120),
        ...(params.payerUpiOrName?.trim()
          ? { payerUpiOrName: params.payerUpiOrName.trim().slice(0, 120) }
          : {}),
        status: 'pending',
        gatewaySignatureVerified: false,
        termsAccepted: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(paymentRef, {
        ownerUid: params.ownerUid,
        shopId: params.ownerUid,
        shopName: params.shopName.trim().slice(0, 120),
        ownerName: params.ownerName.trim().slice(0, 120),
        shopCategory: params.shopCategory.trim().slice(0, 80),
        shopLocation: params.shopLocation.trim().slice(0, 160),
        contactPhoneMasked: maskMobileNumber(params.contactPhone),
        registrationId: params.registrationId.trim().slice(0, 40),
        amountInr: SHOPKEEPER_REGISTRATION_FEE_INR,
        paymentMethod: params.paymentMethod,
        status: 'pending',
        orderRef: params.orderRef.trim().slice(0, 80),
        utrOrGatewayRef: utrValidation.normalizedUtr.slice(0, 120),
        ...(params.payerUpiOrName?.trim()
          ? { payerUpiOrName: params.payerUpiOrName.trim().slice(0, 120) }
          : {}),
        gatewaySignatureVerified: false,
        termsAccepted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const shopSnap = await getDoc(shopRef);
    if (shopSnap.exists() && shopSnap.data()?.registrationPaymentStatus !== 'verified') {
      await updateDoc(shopRef, {
        registrationPaymentStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
    }

    return paymentDocId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shopkeeperPayments/${paymentDocId}`);
  }
}

export function subscribeShopkeeperListings(cb: (list: ShopkeeperListing[]) => void): () => void {
  const q = query(collection(db, 'shopkeeperListings'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopkeeperListing)));
    },
    () => cb([])
  );
}

export function subscribeOwnShopkeeperListing(
  ownerUid: string,
  cb: (shop: ShopkeeperListing | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'shopkeeperListings', ownerUid),
    (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as ShopkeeperListing) : null);
    },
    () => cb(null)
  );
}

export function subscribeOwnShopkeeperPayment(
  ownerUid: string,
  cb: (payment: ShopkeeperRegistrationPayment | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'shopkeeperPayments', ownerUid),
    (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as ShopkeeperRegistrationPayment) : null);
    },
    () => cb(null)
  );
}

export function subscribeAllShopkeeperPaymentsAdmin(
  cb: (payments: ShopkeeperRegistrationPayment[]) => void
): () => void {
  const q = query(collection(db, 'shopkeeperPayments'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopkeeperRegistrationPayment)));
    },
    () => cb([])
  );
}

export async function adminApproveShopkeeperPayment(params: {
  payment: ShopkeeperRegistrationPayment;
  adminUid: string;
  adminEmail: string;
  adminNotes?: string;
}): Promise<{ receiptNo: string }> {
  const ownerUid = params.payment.ownerUid;
  const receiptNo = params.payment.receiptNo || buildShopReceiptNo(ownerUid);
  const verifiedAtIso = new Date().toISOString();

  const payRef = doc(db, 'shopkeeperPayments', params.payment.id);
  const shopRef = doc(db, 'shopkeeperListings', ownerUid);
  const ledgerRef = doc(db, 'financialLedger', `led_shop_${params.payment.id}`);

  const [shopSnap, ledgerSnap] = await Promise.all([getDoc(shopRef), getDoc(ledgerRef)]);

  const batch = writeBatch(db);
  batch.update(payRef, {
    status: 'verified',
    receiptNo,
    verifiedByUid: params.adminUid,
    verifiedAtIso,
    ...(params.adminNotes?.trim() ? { adminNotes: params.adminNotes.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  });

  if (shopSnap.exists()) {
    batch.update(shopRef, {
      registrationPaymentStatus: 'verified',
      paidListingActive: true,
      verificationStatus: 'verified',
      paymentReceiptNo: receiptNo,
      verifiedAtIso,
      updatedAt: serverTimestamp(),
    });
  }

  if (!ledgerSnap.exists()) {
    batch.set(ledgerRef, {
      entryType: 'shopkeeper_registration_payment',
      direction: 'credit',
      amountInr: SHOPKEEPER_REGISTRATION_FEE_INR,
      workerUid: ownerUid,
      workerName: `${params.payment.shopName} (${params.payment.ownerName})`.slice(0, 120),
      referenceId: params.payment.id,
      paymentOrUtrRef: params.payment.utrOrGatewayRef.slice(0, 120),
      description: `Verified ₹${SHOPKEEPER_REGISTRATION_FEE_INR} shopkeeper registration (${params.payment.registrationId} · Receipt ${receiptNo})`,
      recordedByUid: params.adminUid,
      recordedByEmail: params.adminEmail,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return { receiptNo };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shopkeeperPayments/${params.payment.id}`);
  }
}

export async function adminRejectShopkeeperPayment(params: {
  payment: ShopkeeperRegistrationPayment;
  adminUid: string;
  reason: string;
}): Promise<void> {
  const ownerUid = params.payment.ownerUid;
  const payRef = doc(db, 'shopkeeperPayments', params.payment.id);
  const shopRef = doc(db, 'shopkeeperListings', ownerUid);
  const shopSnap = await getDoc(shopRef);

  const batch = writeBatch(db);
  batch.update(payRef, {
    status: 'failed',
    verifiedByUid: params.adminUid,
    adminNotes: (params.reason.trim() || 'Payment verification failed.').slice(0, 500),
    updatedAt: serverTimestamp(),
  });

  if (shopSnap.exists()) {
    batch.update(shopRef, {
      registrationPaymentStatus: 'failed',
      paidListingActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shopkeeperPayments/${params.payment.id}`);
  }
}
