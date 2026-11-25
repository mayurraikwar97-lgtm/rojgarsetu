import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Crosshair,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getDistrictCoordinates, INDIA_STATES_DISTRICTS } from '../data/indiaLocations';
import {
  SHOP_CATEGORY_CATALOG,
  getShopCategoryLabel,
  normalizeCustomShopCategory,
} from '../data/shopCategories';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import { detectBestGpsLocation } from '../lib/locationService';
import { getOtpFraudWarningLocalized } from '../lib/otpFeatureFlags';
import {
  SHOPKEEPER_REGISTRATION_FEE_INR,
  createServerShopkeeperOrder,
  processShopLogoFile,
  recordShopkeeperGatewayAttempt,
  saveShopkeeperProfile,
  submitShopkeeperUpiPaymentProof,
  subscribeOwnShopkeeperListing,
  subscribeOwnShopkeeperPayment,
  verifyShopkeeperGatewayPayment,
} from '../lib/shopkeeperService';
import {
  fetchPaymentGatewayConfig,
  loadRazorpayCheckoutScript,
  maskMobileNumber,
  type CreatedPaymentOrder,
  type PaymentGatewayPublicConfig,
} from '../lib/workerPaymentService';
import type {
  Language,
  PageRoute,
  ShopkeeperListing,
  ShopkeeperPurpose,
  ShopkeeperRegistrationPayment,
} from '../types/domain';
import { LocationPinModal } from './LocationPinModal';

interface ShopkeeperRegistrationFormProps {
  onNavigate: (route: PageRoute) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'mr' ? mr : lang === 'hi' ? hi : en;
}

export const ShopkeeperRegistrationForm: React.FC<ShopkeeperRegistrationFormProps> = ({
  onNavigate,
}) => {
  const { lang, t } = useLanguage();
  const { user, authError, clearAuthError, signInWithGoogle } = useAuth();
  const fraudWarning = getOtpFraudWarningLocalized(lang);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [existingShop, setExistingShop] = useState<ShopkeeperListing | null>(null);
  const [existingPayment, setExistingPayment] = useState<ShopkeeperRegistrationPayment | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayPublicConfig | null>(null);

  // Profile fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('kirana_grocery');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [purpose, setPurpose] = useState<ShopkeeperPurpose>('both');
  const [description, setDescription] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [districtName, setDistrictName] = useState('Chandrapur');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  const [contactPhone, setContactPhone] = useState('');
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('21:00');
  const [weeklyOff, setWeeklyOff] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [vocalForLocalPledge, setVocalForLocalPledge] = useState(true);
  const [shopTermsAccepted, setShopTermsAccepted] = useState(false);

  // Payment step state
  const [activeOrder, setActiveOrder] = useState<CreatedPaymentOrder | null>(null);
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [payerNameInput, setPayerNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [paying, setPaying] = useState(false);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hydratedUid, setHydratedUid] = useState('');

  useEffect(() => {
    fetchPaymentGatewayConfig()
      .then(setPaymentConfig)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) {
      setExistingShop(null);
      setExistingPayment(null);
      return;
    }
    const u1 = subscribeOwnShopkeeperListing(user.uid, (shop) => {
      setExistingShop(shop);
      if (shop && hydratedUid !== user.uid) {
        setHydratedUid(user.uid);
        setShopName(shop.shopName || '');
        setOwnerName(shop.ownerName || user.displayName || '');
        const builtIn = SHOP_CATEGORY_CATALOG.find(
          (c) => c.id === shop.shopCategory || c.en.toLowerCase() === shop.shopCategory.toLowerCase()
        );
        if (builtIn) {
          setSelectedCategoryId(builtIn.id);
          setUseCustomCategory(false);
          setCustomCategoryInput('');
        } else {
          setUseCustomCategory(true);
          setCustomCategoryInput(shop.customCategoryName || shop.shopCategory);
        }
        setPurpose(shop.purpose || 'both');
        setDescription(shop.description || '');
        if (shop.state) setStateName(shop.state);
        if (shop.district) setDistrictName(shop.district);
        setCityOrVillage(shop.cityOrVillage || '');
        setFullAddress(shop.fullAddress || '');
        setPincode(shop.pincode || '');
        if (typeof shop.approxLat === 'number' && typeof shop.approxLng === 'number') {
          setGpsCoords({ lat: shop.approxLat, lng: shop.approxLng });
        }
        setContactPhone(shop.contactPhone || '');
        if (shop.whatsappNumber && shop.whatsappNumber !== shop.contactPhone) {
          setWhatsappSameAsPhone(false);
          setWhatsappNumber(shop.whatsappNumber);
        } else {
          setWhatsappSameAsPhone(true);
          setWhatsappNumber('');
        }
        setOpeningTime(shop.openingTime || '09:00');
        setClosingTime(shop.closingTime || '21:00');
        setWeeklyOff(shop.weeklyOff || '');
        setLogoDataUrl(shop.logoDataUrl || '');
        setVocalForLocalPledge(shop.vocalForLocalPledge !== false);
        setShopTermsAccepted(true);
      }
    });
    const u2 = subscribeOwnShopkeeperPayment(user.uid, setExistingPayment);
    return () => {
      u1();
      u2();
    };
  }, [user, hydratedUid]);

  const activeStateObj = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === stateName),
    [stateName]
  );

  const isPaymentVerified =
    existingPayment?.status === 'verified' || existingShop?.registrationPaymentStatus === 'verified';
  const isPaymentPendingReview =
    !isPaymentVerified &&
    (existingPayment?.status === 'pending' || existingShop?.registrationPaymentStatus === 'pending');

  const resolvedCategoryValue = useMemo(() => {
    if (useCustomCategory) {
      return normalizeCustomShopCategory(customCategoryInput);
    }
    const found = SHOP_CATEGORY_CATALOG.find((c) => c.id === selectedCategoryId);
    return found ? found.en : selectedCategoryId;
  }, [useCustomCategory, customCategoryInput, selectedCategoryId]);

  const handleDetectGps = async () => {
    setGpsLoading(true);
    setGpsMsg('');
    try {
      const geo = await detectBestGpsLocation(lang);
      setGpsCoords({ lat: geo.lat, lng: geo.lng });
      if (geo.state && INDIA_STATES_DISTRICTS.some((s) => s.name === geo.state)) {
        setStateName(geo.state);
      }
      if (geo.district) setDistrictName(geo.district);
      if (geo.cityOrVillage) setCityOrVillage(geo.cityOrVillage);
      const pinMatch = (geo.formattedAddress || '').match(/\b\d{6}\b/);
      if (pinMatch && !pincode) setPincode(pinMatch[0]);
      setGpsMsg(
        tr(
          lang,
          `Location detected: ${geo.formattedAddress}`,
          `स्थान प्राप्त: ${geo.formattedAddress}`,
          `ठिकाण मिळाले: ${geo.formattedAddress}`
        )
      );
    } catch {
      setGpsMsg(
        tr(
          lang,
          'GPS unavailable. Please select State/District or tap "Pin on Map".',
          'GPS उपलब्ध नहीं है। राज्य/जिला चुनें या "नक्शे पर पिन करें" दबाएँ।',
          'GPS उपलब्ध नाही. कृपया राज्य/जिल्हा निवडा किंवा "नकाशावर पिन करा" वापरा.'
        )
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setLogoBusy(true);
    try {
      const dataUrl = await processShopLogoFile(file);
      setLogoDataUrl(dataUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'INVALID_TYPE') {
        setErrorMsg(
          tr(
            lang,
            'Please upload a JPG, PNG, or WEBP shop logo/photo.',
            'कृपया केवल JPG, PNG या WEBP फ़ॉर्मेट की दुकान फ़ोटो चुनें।',
            'कृपया फक्त JPG, PNG किंवा WEBP स्वरूपातील दुकान फोटो/लोगो निवडा.'
          )
        );
      } else {
        setErrorMsg(
          tr(
            lang,
            'Logo image could not be processed or is too large (max 5 MB).',
            'लोगो इमेज प्रोसेस नहीं हो सकी या बहुत बड़ी है (अधिकतम 5 MB)।',
            'लोगो फोटो प्रोसेस करता आला नाही किंवा खूप मोठा आहे (कमाल 5 MB).'
          )
        );
      }
    } finally {
      setLogoBusy(false);
    }
  };

  const validateAndSaveProfile = async (): Promise<{ shopId: string; registrationId: string } | null> => {
    setErrorMsg('');
    setStatusMessage('');
    clearAuthError();

    if (!user?.emailVerified) {
      setErrorMsg(
        tr(
          lang,
          'Please sign in with Google first to register your shop.',
          'अपनी दुकान पंजीकृत करने के लिए पहले Google से लॉगिन करें।',
          'तुमचे दुकान नोंदवण्यासाठी कृपया आधी Google ने लॉगिन करा.'
        )
      );
      return null;
    }
    if (shopName.trim().length < 2) {
      setErrorMsg(
        tr(
          lang,
          'Please enter your Shop Name (at least 2 characters).',
          'कृपया दुकान का नाम दर्ज करें (कम से कम 2 अक्षर)।',
          'कृपया दुकानाचे नाव टाका (किमान २ अक्षरे).'
        )
      );
      return null;
    }
    if (ownerName.trim().length < 2) {
      setErrorMsg(
        tr(
          lang,
          'Please enter Shopkeeper / Owner Name.',
          'कृपया दुकानदार / मालिक का नाम दर्ज करें।',
          'कृपया दुकानदार / मालकाचे नाव टाका.'
        )
      );
      return null;
    }
    if (resolvedCategoryValue.length < 2) {
      setErrorMsg(
        tr(
          lang,
          'Please select a shop category or enter your custom shop business type.',
          'कृपया दुकान की श्रेणी चुनें या अपना व्यवसाय प्रकार लिखें।',
          'कृपया दुकानाचा प्रकार निवडा किंवा तुमचा नवीन दुकान प्रकार लिहा.'
        )
      );
      return null;
    }
    if (fullAddress.trim().length < 5) {
      setErrorMsg(
        tr(
          lang,
          'Please enter full shop address / market area (minimum 5 characters).',
          'कृपया दुकान का पूरा पता / क्षेत्र दर्ज करें (कम से कम 5 अक्षर)।',
          'कृपया दुकानाचा पूर्ण पत्ता / बाजार परिसर टाका (किमान ५ अक्षरे).'
        )
      );
      return null;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg(
        tr(
          lang,
          'Please enter a valid 6-digit Indian Pincode.',
          'कृपया मान्य 6 अंकों का पिनकोड दर्ज करें।',
          'कृपया वैध ६ अंकी पिनकोड टाका.'
        )
      );
      return null;
    }
    if (!/^[6-9]\d{9}$/.test(contactPhone.trim())) {
      setErrorMsg(
        tr(
          lang,
          'Please enter a valid 10-digit Indian contact mobile number.',
          'कृपया मान्य 10 अंकों का संपर्क मोबाइल नंबर दर्ज करें।',
          'कृपया वैध १० अंकी संपर्क मोबाईल क्रमांक टाका.'
        )
      );
      return null;
    }
    const finalWhatsapp = whatsappSameAsPhone ? contactPhone.trim() : whatsappNumber.trim();
    if (finalWhatsapp && !/^[6-9]\d{9}$/.test(finalWhatsapp)) {
      setErrorMsg(
        tr(
          lang,
          'Please enter a valid 10-digit WhatsApp number or check "Same as Contact Number".',
          'कृपया मान्य 10 अंकों का WhatsApp नंबर दर्ज करें या "संपर्क नंबर जैसा ही" चुनें।',
          'कृपया वैध १० अंकी WhatsApp नंबर टाका किंवा "संपर्क नंबरप्रमाणेच" निवडा.'
        )
      );
      return null;
    }
    if (!shopTermsAccepted) {
      setErrorMsg(
        tr(
          lang,
          'Please confirm the ₹500 Shopkeeper Registration Fee disclosure before continuing.',
          'आगे बढ़ने से पहले कृपया ₹500 दुकानदार पंजीकरण शुल्क की सहमति पर टिक करें।',
          'पुढे जाण्यापूर्वी कृपया ₹500 दुकानदार नोंदणी शुल्काच्या अटी मान्य करा.'
        )
      );
      return null;
    }

    const coords = gpsCoords || getDistrictCoordinates(stateName, districtName);
    setSavingProfile(true);
    try {
      const saved = await saveShopkeeperProfile({
        ownerUid: user.uid,
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        shopCategory: resolvedCategoryValue,
        customCategoryName: useCustomCategory ? resolvedCategoryValue : undefined,
        purpose,
        description: description.trim() || undefined,
        state: stateName,
        district: districtName,
        cityOrVillage: cityOrVillage.trim() || districtName,
        fullAddress: fullAddress.trim(),
        pincode: pincode.trim(),
        approxLat: coords.lat,
        approxLng: coords.lng,
        contactPhone: contactPhone.trim(),
        whatsappNumber: finalWhatsapp || undefined,
        openingTime,
        closingTime,
        weeklyOff: weeklyOff.trim() || undefined,
        logoDataUrl: logoDataUrl || undefined,
        vocalForLocalPledge,
      });
      return saved;
    } catch (err) {
      setErrorMsg(formatUiError(err, 'Could not save shopkeeper profile.'));
      return null;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAndInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await validateAndSaveProfile();
    if (!saved || !user) return;

    if (isPaymentVerified) {
      setStatusMessage(
        tr(
          lang,
          'Your shop profile has been updated and is live in Local Shops!',
          'आपकी दुकान प्रोफ़ाइल अपडेट हो गई है और लोकल दुकाने सूची में लाइव है!',
          'तुमची दुकान प्रोफाइल अपडेट झाली असून स्थानिक दुकाने यादीत लाईव्ह आहे!'
        )
      );
      return;
    }

    setPaying(true);
    setErrorMsg('');
    try {
      const order = await createServerShopkeeperOrder({
        registrationId: saved.registrationId,
        shopName: shopName.trim(),
      });
      setActiveOrder(order);

      if (order.mode === 'gateway' && order.razorpayKeyId && order.gatewayOrderId) {
        const scriptReady = await loadRazorpayCheckoutScript();
        if (!scriptReady) {
          throw new Error(
            tr(
              lang,
              'Could not load Razorpay Checkout script. Please check your internet connection or use UPI QR below.',
              'Razorpay Checkout लोड नहीं हो सका। कृपया नीचे UPI विकल्प का उपयोग करें।',
              'Razorpay Checkout लोड होऊ शकले नाही. कृपया खालील UPI पर्याय वापरा.'
            )
          );
        }

        const RazorpayCtor = (
          window as unknown as {
            Razorpay: new (opts: Record<string, unknown>) => {
              open: () => void;
              on: (ev: string, fn: (resp: { error?: { description?: string } }) => void) => void;
            };
          }
        ).Razorpay;

        const shopLocText = [cityOrVillage.trim() || districtName, districtName, pincode.trim()]
          .filter(Boolean)
          .join(', ');

        const rzp = new RazorpayCtor({
          key: order.razorpayKeyId,
          amount: SHOPKEEPER_REGISTRATION_FEE_INR * 100,
          currency: 'INR',
          name: 'ROJGAR SETU · Vocal for Local',
          description: `दुकानदार नोंदणी शुल्क ₹${SHOPKEEPER_REGISTRATION_FEE_INR} (${shopName.trim()})`,
          order_id: order.gatewayOrderId,
          prefill: {
            name: ownerName.trim(),
            email: user.email || '',
            contact: contactPhone.trim(),
          },
          notes: {
            paymentType: 'shopkeeper_registration',
            registrationId: saved.registrationId,
            shopName: shopName.trim(),
          },
          theme: { color: '#0B3B75' },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            setPaying(true);
            setErrorMsg('');
            try {
              const verifyRes = await verifyShopkeeperGatewayPayment({
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
                orderRef: order.orderRef,
                registrationId: saved.registrationId,
                shopName: shopName.trim(),
                ownerName: ownerName.trim(),
                shopCategory: resolvedCategoryValue,
                shopLocation: shopLocText,
                contactPhoneMasked: maskMobileNumber(contactPhone.trim()),
              });
              setStatusMessage(
                tr(
                  lang,
                  `₹500 Shopkeeper Registration Fee PAID! Receipt ${verifyRes.receiptNo || ''}. Your Vocal for Local shop profile is now live.`,
                  `₹500 दुकानदार पंजीकरण शुल्क भुगतान सफल! रसीद ${verifyRes.receiptNo || ''}। आपकी दुकान अब लोकल दुकाने सूची में लाइव है।`,
                  `₹500 दुकानदार नोंदणी शुल्क यशस्वीरित्या भरले गेले! पावती ${verifyRes.receiptNo || ''}. तुमचे दुकान आता स्थानिक दुकाने यादीत लाईव्ह झाले आहे.`
                )
              );
            } catch (verErr) {
              setErrorMsg(formatUiError(verErr, 'Payment signature verification failed.'));
            } finally {
              setPaying(false);
            }
          },
          modal: {
            ondismiss: () => {
              void recordShopkeeperGatewayAttempt({
                outcome: 'cancelled',
                gatewayOrderId: order.gatewayOrderId,
                orderRef: order.orderRef,
                reason: 'Shopkeeper closed Razorpay checkout before completion.',
              });
              setPaying(false);
            },
          },
        });

        rzp.on('payment.failed', (failResp) => {
          const failMsg = failResp?.error?.description || 'Razorpay payment failed.';
          void recordShopkeeperGatewayAttempt({
            outcome: 'failed',
            gatewayOrderId: order.gatewayOrderId,
            orderRef: order.orderRef,
            reason: failMsg,
          });
          setErrorMsg(failMsg);
          setPaying(false);
        });

        rzp.open();
        return;
      }

      // UPI fallback mode when Razorpay keys are not configured
      setStatusMessage(
        tr(
          lang,
          'Shop profile saved! Complete the ₹500 Shopkeeper Registration Fee via UPI below and enter your 12-digit UTR to activate.',
          'दुकान प्रोफ़ाइल सेव हो गई! नीचे ₹500 दुकानदार पंजीकरण शुल्क UPI द्वारा भुगतान करें और UTR नंबर दर्ज करें।',
          'तुमची दुकान प्रोफाइल सेव्ह झाली! खालील UPI द्वारे ₹500 दुकानदार नोंदणी शुल्क भरा आणि UTR क्रमांक सबमिट करा.'
        )
      );
    } catch (err) {
      setErrorMsg(formatUiError(err, 'Unable to initiate ₹500 shopkeeper payment.'));
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitUpiProof = async () => {
    if (!user || !activeOrder) return;
    if (upiUtrInput.trim().length < 8) {
      setErrorMsg(
        tr(
          lang,
          'Please enter a valid 8–36 character UPI UTR / Transaction Reference Number.',
          'कृपया मान्य 8–36 अक्षरों का UPI UTR / ट्रांज़ैक्शन रेफरेंस नंबर दर्ज करें।',
          'कृपया वैध ८ ते ३६ अंकी UPI UTR / व्यवहार संदर्भ क्रमांक टाका.'
        )
      );
      return;
    }

    setSubmittingUtr(true);
    setErrorMsg('');
    try {
      const shopLocText = [cityOrVillage.trim() || districtName, districtName, pincode.trim()]
        .filter(Boolean)
        .join(', ');
      await submitShopkeeperUpiPaymentProof({
        ownerUid: user.uid,
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        shopCategory: resolvedCategoryValue,
        shopLocation: shopLocText,
        contactPhone: contactPhone.trim(),
        registrationId: existingShop?.registrationId || `RS-SHOP-${user.uid.slice(0, 6).toUpperCase()}`,
        paymentMethod: 'upi_qr',
        orderRef: activeOrder.orderRef,
        utrOrGatewayRef: upiUtrInput.trim(),
        payerUpiOrName: payerNameInput.trim() || ownerName.trim(),
        termsAccepted: shopTermsAccepted,
      });
      setUpiUtrInput('');
      setStatusMessage(
        tr(
          lang,
          '₹500 UPI payment reference submitted! Your shop is listed and queued for quick Admin verification.',
          '₹500 UPI भुगतान संदर्भ सबमिट हो गया! आपकी दुकान सूचीबद्ध है और शीघ्र सत्यापन के लिए भेजी गई है।',
          '₹500 UPI पेमेंट संदर्भ सबमिट झाला! तुमचे दुकान नोंदवले गेले असून त्वरित पडताळणीसाठी पाठवले आहे.'
        )
      );
    } catch (err) {
      setErrorMsg(formatUiError(err, 'Unable to submit UPI payment reference.'));
    } finally {
      setSubmittingUtr(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-50 border border-amber-300 text-xs font-extrabold text-[#C25E00]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>व्होकल फॉर लोकल · स्थानिककडून सामान</span>
          </div>
          <Store className="w-10 h-10 text-[#0B3B75] mx-auto" />
          <h1 className="font-display text-2xl font-extrabold text-[#0B3B75]">
            {tr(
              lang,
              'Shopkeeper Registration',
              'दुकानदार पंजीकरण',
              'दुकानदार नोंदणी'
            )}
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            {tr(
              lang,
              'Sign in with Google to create your Vocal for Local shop profile, reach nearby customers by pincode, and hire local staff directly.',
              'अपनी "वोकल फॉर लोकल" दुकान प्रोफ़ाइल बनाने, पिनकोड से नज़दीकी ग्राहकों तक पहुँचने व स्थानीय कर्मचारी रखने के लिए Google से लॉगिन करें।',
              'तुमची "व्होकल फॉर लोकल" दुकान प्रोफाइल तयार करण्यासाठी, पिनकोडनुसार जवळच्या ग्राहकांपर्यंत पोहोचण्यासाठी आणि स्थानिक कर्मचारी ठेवण्यासाठी Google ने लॉगिन करा.'
            )}
          </p>
          {authError && (
            <p className="inline-flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{t.nav.signIn}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('local-shops')}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-sm font-bold cursor-pointer"
            >
              {tr(lang, 'Browse Local Shops', 'स्थानीय दुकानें देखें', 'स्थानिक दुकाने पहा')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Top Vocal for Local Shopkeeper Header */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[#0B3B75] px-6 py-5 text-white border-b-4 border-[#E06D1B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#E06D1B] text-white text-[11px] font-extrabold tracking-wide">
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
              <h1 className="font-display text-xl sm:text-2xl font-extrabold flex items-center gap-2.5">
                <Store className="w-6 h-6 text-amber-300 shrink-0" />
                <span>
                  {tr(
                    lang,
                    'Shopkeeper Profile & Registration',
                    'दुकानदार प्रोफ़ाइल एवं पंजीकरण',
                    'दुकानदार प्रोफाइल व नोंदणी'
                  )}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-2xl">
                {tr(
                  lang,
                  'List your neighborhood shop under Rojgar Setu Vocal for Local so local families buy goods from nearby shops and you can hire trusted local staff directly.',
                  'रोजगार सेतु "वोकल फॉर लोकल" से अपनी दुकान जोड़ें — ताकि नज़दीकी परिवार स्थानीय दुकानों से सामान खरीदें और आप सीधे भरोसेमंद कर्मचारी रख सकें।',
                  'रोजगार सेतु "व्होकल फॉर लोकल" अंतर्गत तुमचे दुकान जोडा — जेणेकरून परिसरातील नागरिक स्थानिक दुकानांतून सामान खरेदी करतील आणि तुम्हाला थेट स्थानिक कामगार मिळतील.'
                )}
              </p>
            </div>
            {(isPaymentVerified || isPaymentPendingReview) && (
              <div className="shrink-0">
                {isPaymentVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-extrabold">
                    <CheckCircle2 className="w-4 h-4" />
                    {tr(lang, 'VERIFIED SHOP · LIVE', 'सत्यापित दुकान · लाइव', 'सत्यापित दुकान · लाईव्ह')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-extrabold">
                    <Clock className="w-4 h-4" />
                    {tr(lang, 'UPI Proof Submitted · Pending Review', 'UPI सत्यापन प्रतीक्षेत', 'UPI पडताळणी सुरू')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Paid Active Summary Banner */}
        {isPaymentVerified && existingShop && (
          <div className="mx-6 mt-5 rounded-lg bg-emerald-50 border-2 border-emerald-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-[#15803D] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {tr(
                    lang,
                    `Shop Active on Vocal for Local · ID: ${existingShop.registrationId}`,
                    `दुकान वोकल फॉर लोकल पर सक्रिय · ID: ${existingShop.registrationId}`,
                    `तुमचे दुकान व्होकल फॉर लोकलवर सक्रिय आहे · ID: ${existingShop.registrationId}`
                  )}
                </span>
              </p>
              <p className="text-xs text-slate-700">
                {existingShop.paymentReceiptNo
                  ? `${tr(lang, 'Receipt No', 'रसीद क्र.', 'पावती क्र.')}: ${existingShop.paymentReceiptNo} · `
                  : ''}
                {tr(
                  lang,
                  'You can edit your shop timings, address, or description below anytime.',
                  'आप नीचे से कभी भी दुकान का समय, पता या विवरण अपडेट कर सकते हैं।',
                  'तुम्ही खालील फॉर्ममधून कधीही दुकानाची वेळ, पत्ता किंवा माहिती अपडेट करू शकता.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('local-shops')}
                className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116931] text-white text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'View in Local Shops', 'लोकल दुकाने में देखें', 'स्थानिक दुकाने मध्ये पहा')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('post-job')}
                className="px-3.5 py-2 rounded-lg border border-[#0B3B75] bg-white hover:bg-blue-50 text-[#0B3B75] text-xs font-bold cursor-pointer"
              >
                {tr(lang, 'Hire Shop Staff', 'स्टाफ हायर करें', 'दुकानासाठी कामगार शोधा')}
              </button>
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSaveAndInitiatePayment} className="p-6 space-y-6">
          {/* 1. Shop Basic Details & Logo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Shop / Business Name *', 'दुकान / व्यवसाय का नाम *', 'दुकानाचे / व्यवसायाचे नाव *')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={tr(
                  lang,
                  'e.g., Mahalaxmi Kirana & General Stores',
                  'उदा., महालक्ष्मी किराना एवं जनरल स्टोर्स',
                  'उदा., महालक्ष्मी किराणा व जनरल स्टोअर्स'
                )}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Shopkeeper / Owner Name *', 'दुकानदार / मालिक का नाम *', 'दुकानदार / मालकाचे नाव *')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={tr(lang, 'e.g., Rajesh Sharma', 'उदा., राजेश शर्मा', 'उदा., राजेश शर्मा')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>
          </div>

          {/* 2. Shop Category with "+" Custom Category Option */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700">
                {tr(lang, 'Shop Category / Business Type *', 'दुकान की श्रेणी / व्यवसाय प्रकार *', 'दुकानाचा प्रकार / व्यवसाय श्रेणी *')}
              </label>
              <button
                type="button"
                onClick={() => setUseCustomCategory((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                  useCustomCategory
                    ? 'bg-[#E06D1B] text-white border-[#E06D1B]'
                    : 'bg-amber-50 text-[#C25E00] border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {useCustomCategory
                    ? tr(lang, 'Choose From Standard List', 'मानक सूची से चुनें', 'यादीतून निवडा')
                    : tr(lang, '+ Add Custom Shop Category', '+ नया दुकान प्रकार जोड़ें', '+ नवीन दुकान प्रकार जोडा')}
                </span>
              </button>
            </div>

            {!useCustomCategory ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SHOP_CATEGORY_CATALOG.map((cat) => {
                  const selected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-3 py-2 rounded-lg border text-left text-xs font-bold transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0B3B75]'
                      }`}
                    >
                      {getShopCategoryLabel(cat.id, lang)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setUseCustomCategory(true)}
                  className="px-3 py-2 rounded-lg border-2 border-dashed border-[#E06D1B] bg-amber-50/70 text-[#C25E00] hover:bg-amber-100 text-left text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>{tr(lang, '+ Other / Add Own', '+ अन्य / जोड़ें', '+ इतर / जोडा')}</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-300 space-y-1.5">
                <label className="block text-xs font-bold text-[#9A3412]">
                  {tr(
                    lang,
                    'Enter Your Custom Shop / Business Category *',
                    'अपना कस्टम दुकान / व्यवसाय प्रकार लिखें *',
                    'तुमचा नवीन दुकान / व्यवसाय प्रकार लिहा *'
                  )}
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder={tr(
                    lang,
                    'e.g., Footwear Shop, Photo Studio, Flower & Pooja Samagri',
                    'उदा., चप्पल दुकान, फोटो स्टूडियो, पूजा सामग्री भंडार',
                    'उदा., चप्पल दुकान, फोटो स्टुडिओ, पूजा साहित्य भांडार'
                  )}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D1B]"
                />
              </div>
            )}
          </div>

          {/* 3. Purpose Options (Hiring Staff / Promoting Local Goods / Both) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {tr(
                lang,
                'Purpose of Joining ROJGAR SETU *',
                'रोजगार सेतु से जुड़ने का उद्देश्य *',
                'रोजगार सेतुवर नोंदणीचा उद्देश *'
              )}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    value: 'promote_local_goods' as ShopkeeperPurpose,
                    title: tr(lang, 'Promote Local Goods / Shop', 'स्थानीय सामान / दुकान प्रचार', 'स्थानिक सामान / दुकान प्रसिद्धी'),
                    sub: tr(
                      lang,
                      'Show shop & items to nearby pincode buyers',
                      'नज़दीकी ग्राहकों को दुकान व सामान दिखाएँ',
                      'जवळच्या ग्राहकांना दुकान व सामान दाखवा'
                    ),
                    icon: Store,
                  },
                  {
                    value: 'hire_staff' as ShopkeeperPurpose,
                    title: tr(lang, 'Hire Workers / Shop Staff', 'कामगार / स्टाफ हायर करें', 'कामगार / कर्मचारी हायर करा'),
                    sub: tr(
                      lang,
                      'Find local helpers, sales staff & delivery riders',
                      'स्थानीय हेल्पर, सेल्स स्टाफ व डिलीवरी राइडर पाएँ',
                      'स्थानिक हेल्पर, सेल्स स्टाफ व डिलिव्हरी रायडर मिळवा'
                    ),
                    icon: Users,
                  },
                  {
                    value: 'both' as ShopkeeperPurpose,
                    title: tr(lang, 'Both (Shop + Hiring Staff)', 'दोनों (दुकान प्रचार + स्टाफ)', 'दोन्ही (स्थानिक सामान + कामगार)'),
                    sub: tr(
                      lang,
                      'Recommended for maximum local reach',
                      'सर्वोत्तम स्थानीय पहुँच के लिए अनुशंसित',
                      'जास्तीत जास्त स्थानिक फायद्यासाठी शिफारस केलेले'
                    ),
                    icon: Sparkles,
                  },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const active = purpose === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPurpose(opt.value)}
                    className={`p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                      active
                        ? 'border-[#15803D] bg-emerald-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#15803D]' : 'text-slate-500'}`} />
                      <span className="text-xs font-extrabold text-[#0B3B75]">{opt.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Optional Small Shop Thumbnail / Logo + Description */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            <div className="sm:col-span-5 p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                {tr(lang, 'Shop Logo / Small Photo (Optional)', 'दुकान लोगो / छोटी फ़ोटो (वैकल्पिक)', 'दुकानाचा लोगो / छोटा फोटो (ऐच्छिक)')}
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                  {logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt={shopName || 'Shop logo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={logoBusy}
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-md bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {logoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                      <span>
                        {logoDataUrl
                          ? tr(lang, 'Change', 'बदलें', 'बदला')
                          : tr(lang, 'Upload Logo', 'लोगो अपलोड', 'लोगो निवडा')}
                      </span>
                    </button>
                    {logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl('')}
                        className="px-2.5 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{tr(lang, 'Remove', 'हटाएँ', 'काढा')}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {tr(lang, 'JPG/PNG/WEBP · Auto-resized for fast loading', 'JPG/PNG/WEBP · तेज़ लोडिंग हेतु स्वतः छोटा', 'JPG/PNG/WEBP · जलद लोडिंगसाठी आपोआप छोटे केले जाते')}
                  </p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(
                  lang,
                  'Products / Services & Local Offers (Optional)',
                  'उपलब्ध सामान / सेवाएँ व ऑफ़र (वैकल्पिक)',
                  'दुकानातील सामान / सेवा व खास वैशिष्ट्ये (ऐच्छिक)'
                )}
              </label>
              <textarea
                rows={3}
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr(
                  lang,
                  'e.g., Fresh grains, daily groceries, free local home delivery within 3 km. Also hiring 1 delivery helper.',
                  'उदा., ताज़ा अनाज, रोज़मर्रा किराना सामान, 3 किमी में मुफ़्त होम डिलीवरी। 1 हेल्पर की भी आवश्यकता है।',
                  'उदा., ताजे धान्य, रोजचे किराणा सामान, ३ किमी मध्ये मोफत होम डिलिव्हरी. १ हेल्परचीही गरज आहे.'
                )}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
              />
            </div>
          </div>

          {/* 5. Location, Full Address & 6-Digit Pincode */}
          <div className="p-4 rounded-lg bg-[#F4F6F9] border border-slate-200 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0B3B75]">
                {tr(lang, 'Shop Address, Area & Pincode *', 'दुकान का पता, क्षेत्र व पिनकोड *', 'दुकानाचा पत्ता, परिसर व पिनकोड *')}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {gpsLoading
                      ? tr(lang, 'Detecting...', 'खोज रहे हैं...', 'शोधत आहे...')
                      : tr(lang, 'Auto-Detect GPS', 'GPS से चुनें', 'GPS ने ठिकाण शोधा')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{tr(lang, 'Pin on Map', 'नक्शे पर पिन करें', 'नकाशावर पिन करा')}</span>
                </button>
              </div>
            </div>

            {gpsMsg && <p className="text-xs font-semibold text-[#15803D]">{gpsMsg}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tr(lang, 'State *', 'राज्य *', 'राज्य *')}
                </label>
                <select
                  value={stateName}
                  onChange={(e) => {
                    const nextSt = e.target.value;
                    setStateName(nextSt);
                    const firstDist =
                      INDIA_STATES_DISTRICTS.find((s) => s.name === nextSt)?.districts[0]?.name || '';
                    setDistrictName(firstDist);
                    setGpsCoords(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  {INDIA_STATES_DISTRICTS.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tr(lang, 'District *', 'जिला *', 'जिल्हा *')}
                </label>
                <select
                  value={districtName}
                  onChange={(e) => {
                    setDistrictName(e.target.value);
                    setGpsCoords(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  {activeStateObj?.districts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tr(lang, 'City / Town / Area *', 'शहर / कस्बा / क्षेत्र *', 'शहर / गाव / परिसर *')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={cityOrVillage}
                  onChange={(e) => setCityOrVillage(e.target.value)}
                  placeholder="e.g., Jatpura Gate"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tr(lang, '6-Digit Pincode *', '6 अंकों का पिनकोड *', '६ अंकी पिनकोड *')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="442401"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono-tabular bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tr(lang, 'Full Shop Address & Landmark *', 'दुकान का पूरा पता व लैंडमार्क *', 'दुकानाचा पूर्ण पत्ता व जवळची खूण *')}
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={300}
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder={tr(
                  lang,
                  'Shop No., Main Road / Market Chowk, Near Landmark',
                  'दुकान क्र., मुख्य मार्ग / बाज़ार चौक, नज़दीकी पहचान',
                  'दुकान क्र., मुख्य रस्ता / बाजार चौक, जवळची खूण'
                )}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              />
            </div>

            <LocationPinModal
              open={showPinModal}
              onClose={() => setShowPinModal(false)}
              initialLat={gpsCoords?.lat ?? getDistrictCoordinates(stateName, districtName).lat}
              initialLng={gpsCoords?.lng ?? getDistrictCoordinates(stateName, districtName).lng}
              initialLabel={cityOrVillage || districtName}
              onConfirmLocation={(loc) => {
                setGpsCoords({ lat: loc.lat, lng: loc.lng });
                if (loc.state && INDIA_STATES_DISTRICTS.some((s) => s.name === loc.state)) {
                  setStateName(loc.state);
                }
                if (loc.district) setDistrictName(loc.district);
                if (loc.cityOrVillage) setCityOrVillage(loc.cityOrVillage);
                const pinMatch = (loc.formattedAddress || '').match(/\b\d{6}\b/);
                if (pinMatch && !pincode) setPincode(pinMatch[0]);
                setGpsMsg(
                  tr(
                    lang,
                    `Pinned shop location: ${loc.formattedAddress}`,
                    `पिन किया गया दुकान स्थान: ${loc.formattedAddress}`,
                    `पिन केलेले दुकान ठिकाण: ${loc.formattedAddress}`
                  )
                );
              }}
            />
          </div>

          {/* 6. Contact / WhatsApp & Opening-Closing Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tr(lang, 'Shop Contact Mobile Number *', 'दुकान संपर्क मोबाइल नंबर *', 'दुकानाचा संपर्क मोबाईल नंबर *')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-tabular font-semibold text-slate-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    className="w-full pl-11 pr-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappSameAsPhone}
                  onChange={(e) => setWhatsappSameAsPhone(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>
                  {tr(
                    lang,
                    'WhatsApp number is same as Contact Number',
                    'WhatsApp नंबर संपर्क नंबर जैसा ही है',
                    'WhatsApp नंबर वरील संपर्क नंबरप्रमाणेच आहे'
                  )}
                </span>
              </label>

              {!whatsappSameAsPhone && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'WhatsApp Number', 'WhatsApp नंबर', 'WhatsApp नंबर')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-tabular font-semibold text-slate-500">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={whatsappNumber}
                      onChange={(e) =>
                        setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="98XXXXXXXX"
                      className="w-full pl-11 pr-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0B3B75]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'Opening Time *', 'खुलने का समय *', 'उघडण्याची वेळ *')}
                  </label>
                  <input
                    type="time"
                    required
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr(lang, 'Closing Time *', 'बंद होने का समय *', 'बंद होण्याची वेळ *')}
                  </label>
                  <input
                    type="time"
                    required
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tr(lang, 'Weekly Off (Optional)', 'साप्ताहिक अवकाश (वैकल्पिक)', 'साप्ताहिक सुट्टी (ऐच्छिक)')}
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={weeklyOff}
                  onChange={(e) => setWeeklyOff(e.target.value)}
                  placeholder={tr(lang, 'e.g., Open all 7 days / Sunday closed', 'उदा., सभी 7 दिन खुला / रविवार बंद', 'उदा., दररोज सुरू / रविवार बंद')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {/* Final Step: Clear ₹500 Shopkeeper Registration Fee Summary (at the end of form before payment) */}
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/75 p-4 sm:p-5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#15803D] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      'Final Step · Shopkeeper Registration Fee',
                      'अंतिम चरण · दुकानदार पंजीकरण शुल्क',
                      'अंतिम टप्पा · दुकानदार नोंदणी शुल्क'
                    )}
                  </span>
                </p>
                <h2 className="font-display text-base sm:text-lg font-extrabold text-[#0B3B75]">
                  {tr(
                    lang,
                    `Shopkeeper Registration Fee: ₹${SHOPKEEPER_REGISTRATION_FEE_INR}`,
                    `दुकानदार पंजीकरण शुल्क: ₹${SHOPKEEPER_REGISTRATION_FEE_INR}`,
                    `दुकानदार नोंदणी शुल्क ₹${SHOPKEEPER_REGISTRATION_FEE_INR}`
                  )}
                </h2>
              </div>
              <div className="inline-flex items-baseline gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 shrink-0 self-start sm:self-auto">
                <span className="font-mono-tabular text-xl font-extrabold text-[#15803D]">
                  ₹{SHOPKEEPER_REGISTRATION_FEE_INR}
                </span>
                <span className="text-[11px] font-semibold text-slate-600">
                  {tr(lang, 'One-time', 'एकमुश्त', 'एकवेळ')}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {tr(
                lang,
                'This ₹500 fee is specifically a Shopkeeper Registration Fee for publishing your local shop profile, Vocal for Local badge, pincode/area visibility to nearby buyers, and direct staff hiring access — kept distinct from individual worker registration terms (₹250).',
                'यह ₹500 शुल्क विशेष रूप से दुकानदार पंजीकरण शुल्क है — आपकी दुकान प्रोफ़ाइल, "वोकल फॉर लोकल" बैज, पिनकोड-आधारित स्थानीय दृश्यता और सीधे कर्मचारी हायरिंग के लिए (कामगार पंजीकरण ₹250 की शर्तों से अलग)।',
                'हे ₹500 शुल्क फक्त दुकानदार नोंदणी शुल्क आहे — तुमच्या दुकानाची प्रोफाइल, "व्होकल फॉर लोकल" ओळख, पिनकोडनुसार जवळच्या ग्राहकांना दुकानाची दृश्यता आणि थेट कामगार भरतीसाठी (कामगार नोंदणी ₹250 अटींपेक्षा पूर्णपणे वेगळे).'
              )}
            </p>
          </div>

          {/* Short Fraud Warning Notice (consistent with platform safety notice) */}
          <div
            role="note"
            className="rounded-lg bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-bold text-amber-950">{fraudWarning.primaryMr}</p>
              {fraudWarning.secondaryLocalized && (
                <p className="text-[11px] font-medium text-amber-900">
                  {fraudWarning.secondaryLocalized}
                </p>
              )}
            </div>
          </div>

          {/* Vocal for Local Pledge & ₹500 Shopkeeper Terms Checkboxes */}
          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={vocalForLocalPledge}
                onChange={(e) => setVocalForLocalPledge(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                <strong className="text-[#15803D]">
                  {tr(
                    lang,
                    'Vocal for Local · Buy from Local Shops:',
                    'वोकल फॉर लोकल · स्थानीय दुकान से सामान:',
                    'व्होकल फॉर लोकल · स्थानिककडून सामान:'
                  )}
                </strong>{' '}
                {tr(
                  lang,
                  'Display my shop in the nearby Local Shops directory so neighborhood customers can call, WhatsApp, or visit my shop directly.',
                  'मेरी दुकान को नज़दीकी "स्थानीय दुकानें" सूची में दिखाएँ ताकि स्थानीय ग्राहक सीधे कॉल/WhatsApp कर सामान खरीद सकें।',
                  'माझे दुकान जवळच्या "स्थानिक दुकाने" यादीत दाखवा जेणेकरून परिसरातील ग्राहक थेट कॉल किंवा WhatsApp करून सामान खरेदी करू शकतील.'
                )}
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shopTermsAccepted}
                onChange={(e) => setShopTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                {tr(
                  lang,
                  'I understand the ₹500 fee is a one-time Shopkeeper Registration Fee for my shop profile and local visibility on Rojgar Setu (separate from worker registration fees), and I consent to display my shop business contact publicly for customers.',
                  'मैं समझता/समझती हूँ कि ₹500 एकमुश्त दुकानदार पंजीकरण शुल्क मेरी दुकान प्रोफ़ाइल व स्थानीय दृश्यता के लिए है (कामगार पंजीकरण से अलग), और मैं ग्राहकों के लिए अपनी दुकान का संपर्क नंबर प्रदर्शित करने की सहमति देता/देती हूँ।',
                  'मला मान्य आहे की ₹500 हे एकवेळचे दुकानदार नोंदणी शुल्क माझ्या दुकानाची प्रोफाइल व स्थानिक दृश्यतेसाठी आहे (कामगार नोंदणी शुल्कापेक्षा वेगळे), आणि ग्राहकांसाठी दुकानाचा संपर्क क्रमांक प्रदर्शित करण्यास माझी संमती आहे.'
                )}
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-3.5 py-2.5 text-xs font-semibold text-[#15803D] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Primary Submit / ₹500 Payment CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={savingProfile || paying}
              className="flex-1 py-3.5 px-5 rounded-lg bg-[#E06D1B] hover:bg-[#c55b10] disabled:opacity-60 text-white font-display text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {savingProfile || paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {savingProfile
                      ? tr(lang, 'Saving Shop Profile...', 'दुकान प्रोफ़ाइल सेव हो रही है...', 'दुकान प्रोफाइल सेव्ह होत आहे...')
                      : tr(lang, 'Opening ₹500 Payment...', '₹500 भुगतान खुल रहा है...', '₹500 पेमेंट सुरू होत आहे...')}
                  </span>
                </>
              ) : isPaymentVerified ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {tr(lang, 'Update Shop Profile', 'दुकान प्रोफ़ाइल अपडेट करें', 'दुकान प्रोफाइल अपडेट करा')}
                  </span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {tr(
                      lang,
                      `Save Shop & Pay ₹${SHOPKEEPER_REGISTRATION_FEE_INR} Registration Fee`,
                      `दुकान सेव करें व ₹${SHOPKEEPER_REGISTRATION_FEE_INR} दुकानदार शुल्क भरें`,
                      `दुकान सेव्ह करा व ₹${SHOPKEEPER_REGISTRATION_FEE_INR} दुकानदार नोंदणी शुल्क भरा`
                    )}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('local-shops')}
              className="py-3.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B75] text-sm font-bold cursor-pointer"
            >
              {tr(lang, 'Browse Local Shops', 'स्थानीय दुकानें देखें', 'स्थानिक दुकाने पहा')}
            </button>
          </div>
        </form>

        {/* UPI Fallback Payment Box (shown only when Razorpay checkout is unconfigured in preview/test and user initiated ₹500 order) */}
        {!isPaymentVerified && activeOrder && activeOrder.mode === 'upi_qr' && (
          <div className="mx-6 mb-6 rounded-xl bg-blue-50/70 border-2 border-[#0B3B75]/30 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#0B3B75]" />
                <h3 className="font-display text-sm sm:text-base font-extrabold text-[#0B3B75]">
                  {tr(
                    lang,
                    `Complete ₹${SHOPKEEPER_REGISTRATION_FEE_INR} Shopkeeper Registration Fee via Official UPI`,
                    `आधिकारिक UPI से ₹${SHOPKEEPER_REGISTRATION_FEE_INR} दुकानदार पंजीकरण शुल्क भरें`,
                    `अधिकृत UPI द्वारे ₹${SHOPKEEPER_REGISTRATION_FEE_INR} दुकानदार नोंदणी शुल्क भरा`
                  )}
                </h3>
              </div>
              <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded bg-white border border-blue-200 text-[#0B3B75]">
                Ref: {activeOrder.orderRef}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white rounded-lg border border-blue-100 p-3.5">
              <div>
                <p className="text-slate-500 font-semibold">Official UPI ID</p>
                <p className="font-mono-tabular text-sm font-extrabold text-[#0B3B75] mt-0.5">
                  {activeOrder.officialUpiId || paymentConfig?.officialUpiId || 'rojgarsetu@upi'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {activeOrder.officialUpiPayeeName || 'Rojgar Setu'} · ₹{SHOPKEEPER_REGISTRATION_FEE_INR}
                </p>
              </div>
              <div className="flex items-center sm:justify-end">
                <a
                  href={activeOrder.upiUri}
                  className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116931] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>
                    {tr(lang, 'Pay ₹500 in UPI App', 'UPI ऐप में ₹500 भरें', 'UPI अ‍ॅपमधून ₹500 भरा')}
                  </span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tr(lang, '12-Digit UPI UTR / Reference No. *', '12 अंकों का UPI UTR / रेफरेंस नंबर *', '१२ अंकी UPI UTR / संदर्भ क्रमांक *')}
                </label>
                <input
                  type="text"
                  maxLength={36}
                  value={upiUtrInput}
                  onChange={(e) => setUpiUtrInput(e.target.value)}
                  placeholder="e.g., 421987654321"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tr(lang, 'Payer Name / UPI Handle (Optional)', 'भुगतानकर्ता का नाम / UPI (वैकल्पिक)', 'पैसे भरणार्‍याचे नाव / UPI (ऐच्छिक)')}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={payerNameInput}
                  onChange={(e) => setPayerNameInput(e.target.value)}
                  placeholder={ownerName || 'Shopkeeper Name'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={submittingUtr}
              onClick={handleSubmitUpiProof}
              className="px-5 py-2.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              {submittingUtr ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>
                {tr(
                  lang,
                  'Submit ₹500 UTR Reference for Verification',
                  '₹500 UTR सत्यापन के लिए सबमिट करें',
                  '₹500 UTR पडताळणीसाठी सबमिट करा'
                )}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
