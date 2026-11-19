import React, { useMemo, useState } from 'react';
import { AlertCircle, Car, CheckCircle2, Crosshair, Lock, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getDistrictCoordinates,
  INDIA_STATES_DISTRICTS,
} from '../data/indiaLocations';
import { VEHICLE_TYPE_CATALOG } from '../data/vehicleTypes';
import { useLanguage } from '../i18n/LanguageContext';
import { formatUiError } from '../lib/firebase';
import { saveVehicleListing } from '../lib/firestoreService';
import { detectBestGpsLocation } from '../lib/locationService';
import type { Language, PageRoute, VehicleType, VerificationMethod } from '../types/domain';
import { LocationPinModal } from './LocationPinModal';
import { OtpVerificationBox } from './OtpVerificationBox';

interface VehicleRegistrationFormProps {
  onNavigate: (route: PageRoute) => void;
}

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPE_CATALOG;

export const VehicleRegistrationForm: React.FC<VehicleRegistrationFormProps> = ({ onNavigate }) => {
  const { lang, t } = useLanguage();
  const { user, authError, clearAuthError, signInWithGoogle } = useAuth();

  const [ownerDisplayName, setOwnerDisplayName] = useState(user?.displayName || '');
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto_rickshaw');
  const [vehicleTitle, setVehicleTitle] = useState('Bajaj RE Auto Rickshaw');
  const [vehicleNumberMasked, setVehicleNumberMasked] = useState('');
  const [seatingOrCapacity, setSeatingOrCapacity] = useState('3 Passengers');
  const [acAvailable, setAcAvailable] = useState(false);
  const [withDriver, setWithDriver] = useState(true);
  const [ratePerKm, setRatePerKm] = useState<number>(15);
  const [ratePerDay, setRatePerDay] = useState<number>(1200);
  const [minFare, setMinFare] = useState<number>(50);
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'busy' | 'offline'>('available');

  const [stateName, setStateName] = useState('Maharashtra');
  const [districtName, setDistrictName] = useState('Chandrapur');
  const [cityOrVillage, setCityOrVillage] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const [languagesKnown, setLanguagesKnown] = useState<string[]>(['Marathi', 'Hindi']);
  const [serviceNotes, setServiceNotes] = useState('');
  const [rcOrLicenseNotes, setRcOrLicenseNotes] = useState('');

  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | undefined>(undefined);
  const [testPinHash, setTestPinHash] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successRegId, setSuccessRegId] = useState('');

  const activeStateObj = useMemo(
    () => INDIA_STATES_DISTRICTS.find((s) => s.name === stateName),
    [stateName]
  );

  const handleVehicleTypeChange = (nextType: VehicleType) => {
    setVehicleType(nextType);
    const meta = VEHICLE_TYPE_OPTIONS.find((o) => o.value === nextType);
    if (meta) {
      setSeatingOrCapacity(meta.defaultCap);
      setVehicleTitle(meta.defaultTitle);
      setRatePerKm(meta.defaultRatePerKm);
      setRatePerDay(meta.defaultRatePerDay);
      setMinFare(meta.defaultMinFare);
      setAcAvailable(meta.acDefault);
    }
  };

  const handleDetectGps = async () => {
    setGpsLoading(true);
    setGpsMsg('');
    try {
      const data = await detectBestGpsLocation(lang);
      setGpsCoords({ lat: data.lat, lng: data.lng });
      if (data.state && INDIA_STATES_DISTRICTS.some((s) => s.name === data.state)) {
        setStateName(data.state);
      }
      if (data.district) {
        setDistrictName(data.district);
      }
      if (data.cityOrVillage) {
        setCityOrVillage(data.cityOrVillage);
      }
      if (data.isApproximate) {
        setGpsMsg(
          tr(
            lang,
            `Network/IP estimate (${data.accuracyMeters ? `~${Math.round(data.accuracyMeters / 1000)} km` : 'coarse'}): ${data.formattedAddress}. Tap "Pin on Map" if inaccurate.`,
            `नेटवर्क लोकेशन (~${data.accuracyMeters ? Math.round(data.accuracyMeters / 1000) : '?'} किमी): ${data.formattedAddress}। गलत होने पर "Pin on Map" दबाएँ।`,
            `ब्राउझर नेटवर्क लोकेशन (~${data.accuracyMeters ? Math.round(data.accuracyMeters / 1000) : '?'} किमी): ${data.formattedAddress}. चुकीचे वाटल्यास "नकाशावर पिन करा" दाबा.`
          )
        );
      } else {
        setGpsMsg(
          tr(
            lang,
            `Exact GPS detected: ${data.formattedAddress}`,
            `सटीक स्थान प्राप्त: ${data.formattedAddress}`,
            `अचूक GPS स्थान मिळाले: ${data.formattedAddress}`
          )
        );
      }
    } catch {
      setGpsMsg(
        tr(
          lang,
          'GPS permission denied or unavailable. Select State/District or tap "Pin on Map".',
          'GPS उपलब्ध नहीं है। राज्य/जिला चुनें या "Pin on Map" का उपयोग करें।',
          'GPS उपलब्ध नाही. कृपया राज्य/जिल्हा निवडा किंवा "नकाशावर पिन करा" वापरा.'
        )
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const toggleLanguage = (l: string) => {
    setLanguagesKnown((prev) =>
      prev.includes(l) ? (prev.length > 1 ? prev.filter((x) => x !== l) : prev) : [...prev, l]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    clearAuthError();
    if (!user) {
      setErrorMsg(t.common.signInRequired || 'Please sign in with Google before submitting.');
      return;
    }
    if (!user.emailVerified) {
      setErrorMsg('Please sign in with a verified Google account to register a vehicle.');
      return;
    }
    if (ownerDisplayName.trim().length < 2) {
      setErrorMsg('Please enter Owner / Driver Name (minimum 2 characters).');
      return;
    }
    if (vehicleTitle.trim().length < 2 || vehicleNumberMasked.trim().length < 4) {
      setErrorMsg('Please enter Vehicle Model Name and Vehicle Plate Number.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!mobileVerified) {
      setErrorMsg(
        tr(
          lang,
          'Please verify your mobile number via OTP first.',
          'कृपया पहले OTP द्वारा मोबाइल नंबर सत्यापित करें।',
          'कृपया आधी OTP द्वारे मोबाईल नंबर तपासून घ्या.'
        )
      );
      return;
    }
    if (!privacyConsent) {
      setErrorMsg(t.workerForm.privacyConsent);
      return;
    }

    const coords = gpsCoords || getDistrictCoordinates(stateName, districtName);
    const regId = `RS-V-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    setSubmitting(true);
    try {
      await saveVehicleListing(
        {
          ownerUid: user.uid,
          registrationId: regId,
          ownerDisplayName: ownerDisplayName.trim(),
          vehicleType,
          vehicleTitle: vehicleTitle.trim(),
          vehicleNumberMasked: vehicleNumberMasked.trim().toUpperCase(),
          seatingOrCapacity: seatingOrCapacity.trim(),
          acAvailable,
          withDriver,
          ratePerKm: Number(ratePerKm) || 0,
          ratePerDay: Number(ratePerDay) || 0,
          minFare: Number(minFare) || 0,
          availabilityStatus,
          state: stateName,
          district: districtName,
          cityOrVillage: cityOrVillage.trim() || districtName,
          approxLat: coords.lat,
          approxLng: coords.lng,
          languagesKnown: languagesKnown.length > 0 ? languagesKnown : ['Hindi'],
          ...(serviceNotes.trim() ? { serviceNotes: serviceNotes.trim() } : {}),
        },
        {
          ownerUid: user.uid,
          ownerName: ownerDisplayName.trim(),
          mobile: mobile.trim(),
          mobileVerified,
          ...(verificationMethod ? { verificationMethod } : {}),
          ...(testPinHash ? { testPinHash } : {}),
          ...(user.email ? { email: user.email } : {}),
          ...(rcOrLicenseNotes.trim() ? { rcOrLicenseNotes: rcOrLicenseNotes.trim() } : {}),
        }
      );
      setSuccessRegId(regId);
    } catch (err) {
      setErrorMsg(formatUiError(err, 'Unable to register vehicle.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#0B3B75] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">
            {tr(lang, 'Register Bike Taxi, Auto, Car or Local Goods Vehicle', 'बाइक टैक्सी, ऑटो, कार या स्थानीय मालगाड़ी जोड़ें', 'बाईक टॅक्सी, ऑटो, कार किंवा लोकल मालवाहू गाडी नोंदवा')}
          </h1>
          <p className="text-sm text-slate-600">{t.common.signInRequired}</p>
          {authError && (
            <p className="inline-flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </p>
          )}
          <div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              {t.nav.signIn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (successRegId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="bg-white border border-emerald-200 rounded-lg p-8 text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-[#15803D] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B3B75]">
            {tr(lang, 'Vehicle Listed on ROJGAR SETU!', 'आपका वाहन रोजगार सेतु पर जुड़ गया है!', 'तुमचे वाहन रोजगार सेतुवर यशस्वीरित्या नोंदवले गेले!')}
          </h1>
          <div className="inline-block px-4 py-2 rounded bg-slate-50 border border-slate-200 font-mono-tabular text-sm font-bold text-[#C25E00]">
            ID: {successRegId}
          </div>
          <p className="text-sm text-slate-600">
            {tr(
              lang,
              'Customers looking for Bike Taxi, Auto, Car, Trolley, or Local Goods shifting in your district can now book your vehicle directly.',
              'अब आपके क्षेत्र में बाइक टैक्सी, ऑटो, कार, ट्रॉली या छोटा टेम्पो खोजने वाले ग्राहक आपको सीधे बुक कर सकते हैं।',
              'आता तुमच्या जिल्ह्यात बाईक टॅक्सी, ऑटो, कार, ट्रॉली किंवा लोकल मालवाहू गाडी शोधणारे ग्राहक तुम्हाला थेट बुक करू शकतात.'
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('transport')}
              className="px-5 py-2.5 rounded-md bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] cursor-pointer"
            >
              {tr(lang, 'View in Local Transport', 'लोकल ट्रांसपोर्ट में देखें', 'लोकल ट्रान्सपोर्ट मध्ये पहा')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('worker-dashboard')}
              className="px-5 py-2.5 rounded-md bg-[#0B3B75] text-white text-sm font-bold hover:bg-[#072A54] cursor-pointer"
            >
              {t.nav.workerDashboard}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-[#0B3B75] px-6 py-5 text-white border-b-2 border-[#E06D1B] flex items-center gap-3">
          <Car className="w-7 h-7 text-amber-300 shrink-0" />
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">
              {tr(
                lang,
                'Register Bike Taxi, Auto, Car or Local Goods Vehicle',
                'बाइक टैक्सी, ऑटो, कार या स्थानीय मालगाड़ी पंजीकृत करें',
                'बाईक टॅक्सी, ऑटो, कार किंवा लोकल मालवाहू गाडी नोंदणी'
              )}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              {tr(
                lang,
                'Zero commission for local Bike Taxi riders, Autos, Cars, Trolleys, Mini Tempos & Pickups (No Heavy Trucks)',
                'बाइक टैक्सी, ऑटो, कार, ट्रॉली, छोटा हाथी व पिकअप के लिए शून्य कमीशन (भारी ट्रक छोड़कर)',
                'बाईक टॅक्सी, ऑटो, कार, ट्रॉली, छोटा हत्ती व पिकअप चालकांसाठी मोफत नोंदणी (जड ट्रक सोडून लोकल ट्रान्सपोर्ट)'
              )}
            </p>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Owner / Driver Name *', 'मालिक / ड्राइवर का नाम *', 'मालक / चालकाचे नाव *')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={ownerDisplayName}
                onChange={(e) => setOwnerDisplayName(e.target.value)}
                placeholder="e.g., Ramesh Kumar / Raju Auto"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Vehicle Category *', 'वाहन श्रेणी *', 'वाहनाचा प्रकार *')}
              </label>
              <select
                value={vehicleType}
                onChange={(e) => handleVehicleTypeChange(e.target.value as VehicleType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                {VEHICLE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === 'hi' ? opt.hi : lang === 'mr' ? opt.mr : opt.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Vehicle Model / Service Name *', 'वाहन मॉडल / सेवा नाम *', 'वाहनाचे मॉडेल / नाव *')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={vehicleTitle}
                onChange={(e) => setVehicleTitle(e.target.value)}
                placeholder="e.g., Bajaj RE CNG Auto / Swift Dzire AC"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Vehicle Plate (Masked) *', 'वाहन नंबर (अंतिम 4 अंक) *', 'गाडीचा नंबर *')}
              </label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={20}
                value={vehicleNumberMasked}
                onChange={(e) => setVehicleNumberMasked(e.target.value)}
                placeholder="MH-34-XX-4812"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Capacity', 'क्षमता', 'क्षमता')}
              </label>
              <input
                type="text"
                required
                value={seatingOrCapacity}
                onChange={(e) => setSeatingOrCapacity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Rate / km (₹)', 'दर प्रति किमी (₹)', 'दर प्रति किमी (₹)')}
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={ratePerKm}
                onChange={(e) => setRatePerKm(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Full Day Rate (₹)', 'पूरे दिन का किराया (₹)', 'पूर्ण दिवस भाडे (₹)')}
              </label>
              <input
                type="number"
                min={0}
                max={50000}
                value={ratePerDay}
                onChange={(e) => setRatePerDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Min Fare (₹)', 'न्यूनतम किराया (₹)', 'किमान भाडे (₹)')}
              </label>
              <input
                type="number"
                min={0}
                max={50000}
                value={minFare}
                onChange={(e) => setMinFare(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono-tabular"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 py-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={withDriver}
                onChange={(e) => setWithDriver(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>{tr(lang, 'Provided With Driver', 'ड्राइवर सहित उपलब्ध', 'ड्रायव्हरसह उपलब्ध')}</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={acAvailable}
                onChange={(e) => setAcAvailable(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>{tr(lang, 'AC Available', 'AC उपलब्ध', 'AC उपलब्ध')}</span>
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value as 'available' | 'busy' | 'offline')}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white"
            >
              <option value="available">{tr(lang, 'Available Now', 'तुरंत उपलब्ध', 'तात्काळ उपलब्ध')}</option>
              <option value="busy">{tr(lang, 'Currently Busy', 'व्यस्त', 'व्यस्त')}</option>
              <option value="offline">{tr(lang, 'Offline', 'ऑफलाइन', 'ऑफलाइन')}</option>
            </select>
          </div>

          {/* Location */}
          <div className="p-4 rounded-md bg-[#F4F6F9] border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0B3B75]">
                {tr(lang, 'Stand / Base Location', 'वाहन स्टैंड / मुख्य स्थान', 'वाहन स्टँड / मुख्य ठिकाण')}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-bold hover:bg-[#072A54] cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                  {gpsLoading ? 'Detecting...' : tr(lang, 'Auto-Detect GPS', 'GPS से चुनें', 'GPS ने स्थान शोधा')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {tr(lang, 'Pin on Map', 'नक्शे पर पिन करें', 'नकाशावर पिन करा')}
                </button>
              </div>
            </div>
            {gpsMsg && <p className="text-xs font-medium text-[#15803D]">{gpsMsg}</p>}
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
                setGpsMsg(
                  tr(
                    lang,
                    `Pinned exact location: ${loc.formattedAddress}`,
                    `पिन किया गया स्थान: ${loc.formattedAddress}`,
                    `पिन केलेले अचूक ठिकाण: ${loc.formattedAddress}`
                  )
                );
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                <select
                  value={stateName}
                  onChange={(e) => {
                    const nextSt = e.target.value;
                    setStateName(nextSt);
                    const firstDist = INDIA_STATES_DISTRICTS.find((s) => s.name === nextSt)?.districts[0]?.name || '';
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">District *</label>
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
                  {tr(lang, 'Stand / Area / Village *', 'स्टैंड / क्षेत्र / गांव *', 'स्टँड / चौक / गाव *')}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={cityOrVillage}
                  onChange={(e) => setCityOrVillage(e.target.value)}
                  placeholder="e.g., Jatpura Gate Stand"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                />
              </div>
            </div>
          </div>

          {/* Languages & Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {tr(lang, 'Driver Spoken Languages', 'बोली जाने वाली भाषाएँ', 'येणाऱ्या भाषा')}
            </label>
            <div className="flex flex-wrap gap-2">
              {['Marathi', 'Hindi', 'English', 'Gondi', 'Chhattisgarhi', 'Telugu'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLanguage(l)}
                  className={`px-3 py-1 rounded border text-xs font-semibold cursor-pointer ${
                    languagesKnown.includes(l)
                      ? 'bg-[#0B3B75] text-white border-[#0B3B75]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'Routes / Service Notes', 'रूट एवं सेवा विवरण', 'रूट व सेवेची माहिती')}
              </label>
              <input
                type="text"
                maxLength={500}
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                placeholder="e.g., Local rides, Chandrapur-Nagpur highway, airport drop"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tr(lang, 'DL / Permit Note (Private)', 'ड्राइविंग लाइसेंस / परमिट नोट (निजी)', 'लायसन्स / परमिट माहिती (खाजगी)')}
              </label>
              <input
                type="text"
                maxLength={500}
                value={rcOrLicenseNotes}
                onChange={(e) => setRcOrLicenseNotes(e.target.value)}
                placeholder="Commercial badge / valid insurance"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              {tr(lang, 'Mobile Number & OTP Verification *', 'मोबाइल नंबर एवं OTP सत्यापन *', 'मोबाईल नंबर व OTP पडताळणी *')}
            </label>
            <OtpVerificationBox
              mobile={mobile}
              allowTestPinFallback={false}
              onOpenDemoMode={() => onNavigate('demo-testing')}
              onMobileChange={(val) => {
                setMobile(val);
                setMobileVerified(false);
                setVerificationMethod(undefined);
                setTestPinHash('');
              }}
              verified={mobileVerified}
              verifiedMethod={verificationMethod}
              onVerified={(m, meta) => {
                setMobile(m);
                setMobileVerified(true);
                setVerificationMethod(meta?.method);
                setTestPinHash(meta?.testPinHash || '');
              }}
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span className="inline-flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
              <span>{t.workerForm.privacyConsent}</span>
            </span>
          </label>

          {errorMsg && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-md bg-[#E06D1B] text-white text-sm font-bold hover:bg-[#c55b10] disabled:opacity-60 cursor-pointer"
          >
            {submitting
              ? tr(lang, 'Saving Vehicle...', 'सहेजा जा रहा है...', 'नोंदणी सुरू आहे...')
              : tr(lang, 'Publish Auto / Car for Rent', 'ऑटो / कार किराए के लिए प्रकाशित करें', 'ऑटो / कार भाड्यासाठी प्रकाशित करा')}
          </button>
        </form>
      </div>
    </div>
  );
};
