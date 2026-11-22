import type { Language } from '../types/domain';
import { BIKE_TRANSPORT_CATEGORY_NAME } from '../lib/smartVoiceJobAlert';

export interface SubServiceItem {
  id: string;
  en: string;
  hi: string;
  mr: string;
  startingPrice: number;
  estimatedDuration: string;
}

export interface ServiceCategoryV2 {
  id: string;
  /** Exact canonical category stored on jobs & matched against existing publicWorkers.primarySkill */
  canonicalCategory: string;
  isTransport?: boolean;
  en: string;
  hi: string;
  mr: string;
  taglineEn: string;
  taglineHi: string;
  taglineMr: string;
  startingPrice: number;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  subServices: SubServiceItem[];
}

export const SERVICE_CATALOG_V2: ServiceCategoryV2[] = [
  {
    id: 'electrician',
    canonicalCategory: 'Electricians',
    en: 'Electrician',
    hi: 'इलेक्ट्रीशियन',
    mr: 'इलेक्ट्रिशियन',
    taglineEn: 'Fan, switch, wiring & fault repair',
    taglineHi: 'पंखा, स्विच, वायरिंग और फॉल्ट रिपेयर',
    taglineMr: 'पंखा, स्विच, वायरिंग आणि फॉल्ट दुरुस्ती',
    startingPrice: 149,
    accentBg: 'bg-amber-50',
    accentText: 'text-[#C25E00]',
    accentBorder: 'border-amber-200/80',
    subServices: [
      { id: 'fan_repair', en: 'Fan repair & installation', hi: 'पंखा रिपेयर व फिटिंग', mr: 'पंखा दुरुस्ती व बसवणे', startingPrice: 149, estimatedDuration: '30-45 mins' },
      { id: 'switch_repair', en: 'Switch & socket repair', hi: 'स्विच और सॉकेट रिपेयर', mr: 'स्विच आणि सॉकेट दुरुस्ती', startingPrice: 129, estimatedDuration: '30 mins' },
      { id: 'wiring', en: 'House wiring & MCB', hi: 'घर की वायरिंग व MCB', mr: 'घरगुती वायरिंग व MCB', startingPrice: 299, estimatedDuration: '1-2 hrs' },
      { id: 'light_installation', en: 'Light & LED installation', hi: 'लाइट और LED फिटिंग', mr: 'लाईट व LED बसवणे', startingPrice: 149, estimatedDuration: '30 mins' },
      { id: 'electrical_fault', en: 'Electrical fault & short circuit', hi: 'शॉर्ट सर्किट / बिजली खराबी', mr: 'शॉर्ट सर्किट / वीज बिघाड', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'other_electrical', en: 'Other electrical work', hi: 'अन्य बिजली का काम', mr: 'इतर इलेक्ट्रिकल काम', startingPrice: 149, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'plumber',
    canonicalCategory: 'Plumbers',
    en: 'Plumber',
    hi: 'प्लंबर',
    mr: 'प्लंबर',
    taglineEn: 'Tap, pipe leak, tank & bathroom',
    taglineHi: 'नल, पाइप लीक, टंकी और बाथरूम',
    taglineMr: 'नळ, पाईप गळती, टाकी आणि बाथरूम',
    startingPrice: 149,
    accentBg: 'bg-sky-50',
    accentText: 'text-[#0B3B75]',
    accentBorder: 'border-sky-200/80',
    subServices: [
      { id: 'tap_repair', en: 'Tap repair & replacement', hi: 'नल रिपेयर / बदलना', mr: 'नळ दुरुस्ती व बदलणे', startingPrice: 149, estimatedDuration: '30 mins' },
      { id: 'pipe_leakage', en: 'Pipe leakage & blockage', hi: 'पाइप लीकेज और ब्लॉकेज', mr: 'पाईप गळती व चोकअप', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'bathroom_fitting', en: 'Bathroom & sanitary fitting', hi: 'बाथरूम फिटिंग', mr: 'बाथरूम फिटिंग', startingPrice: 299, estimatedDuration: '1-2 hrs' },
      { id: 'water_tank', en: 'Water tank & motor repair', hi: 'पानी की टंकी व मोटर रिपेयर', mr: 'पाण्याची टाकी व मोटर दुरुस्ती', startingPrice: 249, estimatedDuration: '1 hr' },
      { id: 'new_plumbing', en: 'New plumbing installation', hi: 'नई प्लंबिंग फिटिंग', mr: 'नवीन प्लंबिंग काम', startingPrice: 499, estimatedDuration: '2-4 hrs' },
      { id: 'other_plumbing', en: 'Other plumbing work', hi: 'अन्य प्लंबिंग का काम', mr: 'इतर प्लंबिंग काम', startingPrice: 149, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'carpenter',
    canonicalCategory: 'Carpenters',
    en: 'Carpenter',
    hi: 'बढ़ई (कारपेंटर)',
    mr: 'सुतार (कारपेंटर)',
    taglineEn: 'Door, bed, cupboard & wood repair',
    taglineHi: 'दरवाज़ा, बेड, अलमारी व फर्नीचर',
    taglineMr: 'दरवाजा, बेड, कपाट आणि फर्निचर',
    startingPrice: 199,
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-800',
    accentBorder: 'border-orange-200/80',
    subServices: [
      { id: 'door_repair', en: 'Door lock, hinge & latch repair', hi: 'दरवाज़ा लॉक व कब्ज़ा रिपेयर', mr: 'दरवाजा लॉक व बिजागरी दुरुस्ती', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'furniture_repair', en: 'Furniture & cupboard repair', hi: 'फर्नीचर और अलमारी रिपेयर', mr: 'फर्निचर व कपाट दुरुस्ती', startingPrice: 249, estimatedDuration: '1-2 hrs' },
      { id: 'bed_repair', en: 'Bed & cot assembly / repair', hi: 'बेड रिपेयर व फिटिंग', mr: 'बेड व पलंग दुरुस्ती', startingPrice: 249, estimatedDuration: '1 hr' },
      { id: 'door_installation', en: 'New door & window installation', hi: 'नया दरवाज़ा व खिड़की फिटिंग', mr: 'नवीन दरवाजा व खिडकी बसवणे', startingPrice: 499, estimatedDuration: '2-3 hrs' },
      { id: 'other_carpentry', en: 'Other carpentry work', hi: 'अन्य बढ़ई का काम', mr: 'इतर सुतारकाम', startingPrice: 199, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'cleaner',
    canonicalCategory: 'Housekeeping and Cleaning Staff',
    en: 'Cleaner',
    hi: 'सफ़ाई कर्मी',
    mr: 'स्वच्छता कामगार',
    taglineEn: 'Home, bathroom, kitchen & tank',
    taglineHi: 'घर, बाथरूम, किचन और टंकी सफ़ाई',
    taglineMr: 'घर, बाथरूम, स्वयंपाकघर व टाकी स्वच्छता',
    startingPrice: 249,
    accentBg: 'bg-emerald-50',
    accentText: 'text-[#15803D]',
    accentBorder: 'border-emerald-200/80',
    subServices: [
      { id: 'home_deep_clean', en: 'Full home cleaning', hi: 'पूरे घर की सफ़ाई', mr: 'संपूर्ण घर स्वच्छता', startingPrice: 499, estimatedDuration: '2-3 hrs' },
      { id: 'bathroom_clean', en: 'Bathroom deep cleaning', hi: 'बाथरूम डीप क्लीनिंग', mr: 'बाथरूम डीप क्लीनिंग', startingPrice: 249, estimatedDuration: '1 hr' },
      { id: 'kitchen_clean', en: 'Kitchen & chimney cleaning', hi: 'किचन की गहरी सफ़ाई', mr: 'स्वयंपाकघर स्वच्छता', startingPrice: 299, estimatedDuration: '1-2 hrs' },
      { id: 'water_tank_clean', en: 'Overhead water tank cleaning', hi: 'पानी की टंकी सफ़ाई', mr: 'पाण्याची टाकी स्वच्छता', startingPrice: 349, estimatedDuration: '1 hr' },
      { id: 'shop_office_clean', en: 'Shop / office cleaning', hi: 'दुकान / ऑफिस सफ़ाई', mr: 'दुकान / ऑफिस स्वच्छता', startingPrice: 299, estimatedDuration: '1-2 hrs' },
      { id: 'other_cleaning', en: 'Other cleaning work', hi: 'अन्य सफ़ाई का काम', mr: 'इतर स्वच्छता काम', startingPrice: 249, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'painter',
    canonicalCategory: 'Painters',
    en: 'Painter',
    hi: 'पेंटर',
    mr: 'पेंटर (रंगारी)',
    taglineEn: 'Room painting, putty & waterproofing',
    taglineHi: 'कमरा पेंट, पुट्टी और वॉटरप्रूफिंग',
    taglineMr: 'खोली रंगकाम, पुट्टी व वॉटरप्रूफिंग',
    startingPrice: 399,
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-200/80',
    subServices: [
      { id: 'room_paint', en: 'Single room / wall painting', hi: 'एक कमरा / दीवार पेंटिंग', mr: 'खोली / भिंत रंगकाम', startingPrice: 499, estimatedDuration: 'Half / Full day' },
      { id: 'full_home_paint', en: 'Full home interior / exterior', hi: 'पूरे घर का पेंट', mr: 'संपूर्ण घर रंगकाम', startingPrice: 999, estimatedDuration: 'Multi-day' },
      { id: 'putty_touchup', en: 'Wall putty & touch-up', hi: 'दीवार पुट्टी व टच-अप', mr: 'भिंत पुट्टी व टच-अप', startingPrice: 399, estimatedDuration: '2-4 hrs' },
      { id: 'gate_grill_paint', en: 'Gate, grill & door polish', hi: 'गेट, ग्रिल और दरवाज़ा पॉलिश', mr: 'गेट, ग्रिल व दरवाजा पॉलिश', startingPrice: 399, estimatedDuration: '2-3 hrs' },
      { id: 'other_painting', en: 'Other painting work', hi: 'अन्य पेंटिंग काम', mr: 'इतर रंगकाम', startingPrice: 399, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'mechanic',
    canonicalCategory: 'Technicians and Mechanics',
    en: 'Mechanic',
    hi: 'मैकेनिक',
    mr: 'मेकॅनिक',
    taglineEn: 'Bike, car, puncture & engine repair',
    taglineHi: 'बाइक, कार, पंक्चर और इंजन रिपेयर',
    taglineMr: 'बाईक, कार, पंक्चर आणि इंजिन दुरुस्ती',
    startingPrice: 199,
    accentBg: 'bg-slate-100',
    accentText: 'text-slate-800',
    accentBorder: 'border-slate-200',
    subServices: [
      { id: 'bike_repair', en: 'Two-wheeler repair & servicing', hi: 'बाइक / स्कूटी सर्विस व रिपेयर', mr: 'दुचाकी सर्व्हिस व दुरुस्ती', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'puncture_battery', en: 'Puncture & battery jump-start', hi: 'पंक्चर और बैटरी स्टार्ट', mr: 'पंक्चर व बॅटरी स्टार्ट', startingPrice: 149, estimatedDuration: '30 mins' },
      { id: 'car_mechanic', en: 'Car / auto breakdown help', hi: 'कार / ऑटो मैकेनिक सहायता', mr: 'कार / ऑटो ब्रेकडाऊन मदत', startingPrice: 299, estimatedDuration: '1 hr' },
      { id: 'water_pump_engine', en: 'Agri pump / motor mechanic', hi: 'कृषि पंप / मोटर मैकेनिक', mr: 'शेती पंप / मोटर मेकॅनिक', startingPrice: 249, estimatedDuration: '1-2 hrs' },
      { id: 'other_mechanic', en: 'Other mechanic work', hi: 'अन्य मैकेनिक काम', mr: 'इतर मेकॅनिक काम', startingPrice: 199, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'ac_repair',
    canonicalCategory: 'AC Repair',
    en: 'AC Repair',
    hi: 'AC रिपेयर',
    mr: 'AC दुरुस्ती',
    taglineEn: 'Service, gas refill, install & cooling',
    taglineHi: 'AC सर्विस, गैस रिफिल व फिटिंग',
    taglineMr: 'AC सर्व्हिस, गॅस रिफिल व बसवणे',
    startingPrice: 299,
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-800',
    accentBorder: 'border-cyan-200/80',
    subServices: [
      { id: 'ac_service', en: 'AC jet cleaning & servicing', hi: 'AC सर्विसिंग और सफाई', mr: 'AC सर्व्हिसिंग व स्वच्छता', startingPrice: 399, estimatedDuration: '1 hr' },
      { id: 'ac_not_cooling', en: 'AC not cooling / water leak', hi: 'AC कूलिंग नहीं / पानी टपकना', mr: 'AC कुलिंग नाही / पाणी गळती', startingPrice: 299, estimatedDuration: '45 mins' },
      { id: 'ac_gas_refill', en: 'AC gas charging & check', hi: 'AC गैस रिफिल और जांच', mr: 'AC गॅस रिफिल व तपासणी', startingPrice: 999, estimatedDuration: '1 hr' },
      { id: 'ac_install', en: 'Split / window AC installation', hi: 'AC इंस्टॉलेशन / अनइंस्टॉल', mr: 'AC बसवणे / काढणे', startingPrice: 599, estimatedDuration: '1-2 hrs' },
      { id: 'cooler_repair', en: 'Air cooler repair & pump', hi: 'एयर कूलर रिपेयर व पंप', mr: 'एअर कुलर दुरुस्ती व पंप', startingPrice: 199, estimatedDuration: '45 mins' },
    ],
  },
  {
    id: 'appliance_repair',
    canonicalCategory: 'Appliance Repair',
    en: 'Appliance Repair',
    hi: 'उपकरण रिपेयर',
    mr: 'उपकरणे दुरुस्ती',
    taglineEn: 'Fridge, washing machine, RO & TV',
    taglineHi: 'फ्रिज, वॉशिंग मशीन, RO और TV',
    taglineMr: 'फ्रिज, वॉशिंग मशीन, RO आणि TV',
    startingPrice: 199,
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-800',
    accentBorder: 'border-indigo-200/80',
    subServices: [
      { id: 'fridge_repair', en: 'Refrigerator repair', hi: 'फ्रिज रिपेयर', mr: 'फ्रिज दुरुस्ती', startingPrice: 249, estimatedDuration: '45 mins' },
      { id: 'washing_machine', en: 'Washing machine repair', hi: 'वॉशिंग मशीन रिपेयर', mr: 'वॉशिंग मशीन दुरुस्ती', startingPrice: 249, estimatedDuration: '1 hr' },
      { id: 'ro_purifier', en: 'RO water purifier service', hi: 'RO वाटर प्यूरीफायर सर्विस', mr: 'RO वॉटर प्युरिफायर सर्व्हिस', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'geyser_microwave', en: 'Geyser, mixer & microwave', hi: 'गीज़र, मिक्सर और माइक्रोवेव', mr: 'गीझर, मिक्सर व मायक्रोवेव्ह', startingPrice: 199, estimatedDuration: '45 mins' },
      { id: 'tv_inverter', en: 'TV, DTH & inverter repair', hi: 'TV, DTH और इन्वर्टर रिपेयर', mr: 'TV, DTH व इन्व्हर्टर दुरुस्ती', startingPrice: 249, estimatedDuration: '1 hr' },
    ],
  },
  {
    id: 'driver',
    canonicalCategory: 'Drivers',
    en: 'Driver',
    hi: 'ड्राइवर',
    mr: 'ड्रायव्हर',
    taglineEn: 'Local trips, outstation & daily driver',
    taglineHi: 'लोकल, आउटस्टेशन व निजी ड्राइवर',
    taglineMr: 'लोकल, बाहेरगाव व खाजगी ड्रायव्हर',
    startingPrice: 399,
    accentBg: 'bg-blue-50',
    accentText: 'text-[#0B3B75]',
    accentBorder: 'border-blue-200/80',
    subServices: [
      { id: 'hourly_driver', en: 'Driver for local city trip', hi: 'शहर के लिए घंटे अनुसार ड्राइवर', mr: 'शहरातील कामासाठी ड्रायव्हर', startingPrice: 399, estimatedDuration: '2-4 hrs' },
      { id: 'full_day_driver', en: 'Full-day private car driver', hi: 'पूरे दिन के लिए कार ड्राइवर', mr: 'पूर्ण दिवसासाठी कार ड्रायव्हर', startingPrice: 700, estimatedDuration: '8-10 hrs' },
      { id: 'outstation_driver', en: 'Outstation trip driver', hi: 'बाहरगाँव यात्रा ड्राइवर', mr: 'बाहेरगाव प्रवासासाठी ड्रायव्हर', startingPrice: 900, estimatedDuration: '1+ day' },
      { id: 'commercial_driver', en: 'Commercial / pickup driver', hi: 'कॉमर्शियल / पिकअप ड्राइवर', mr: 'कॉमर्शियल / पिकअप ड्रायव्हर', startingPrice: 750, estimatedDuration: 'Full day' },
    ],
  },
  {
    id: 'daily_labour',
    canonicalCategory: 'Helpers and General Labour',
    en: 'Daily Labour',
    hi: 'दैनिक मज़दूर / हेल्पर',
    mr: 'दैनिक कामगार / हेल्पर',
    taglineEn: 'Loading, shifting, mason & farm help',
    taglineHi: 'लोडिंग, शिफ्टिंग, निर्माण व खेती मदद',
    taglineMr: 'लोडिंग, शिफ्टिंग, बांधकाम व शेती मदत',
    startingPrice: 400,
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-900',
    accentBorder: 'border-amber-200/80',
    subServices: [
      { id: 'shifting_helper', en: 'House shifting & loading helper', hi: 'सामान शिफ्टिंग व लोडिंग हेल्पर', mr: 'सामान शिफ्टिंग व लोडिंग हेल्पर', startingPrice: 400, estimatedDuration: 'Half / Full day' },
      { id: 'construction_helper', en: 'Construction / mason helper', hi: 'बांधकाम / मिस्त्री हेल्पर', mr: 'बांधकाम / गवंडी हेल्पर', startingPrice: 500, estimatedDuration: 'Full day' },
      { id: 'shop_godown_helper', en: 'Shop / warehouse helper', hi: 'दुकान / गोदाम हेल्पर', mr: 'दुकान / गोदाम हेल्पर', startingPrice: 450, estimatedDuration: 'Full day' },
      { id: 'garden_farm_labour', en: 'Garden / agricultural helper', hi: 'बागवानी / खेती मज़दूर', mr: 'बागकाम / शेतमजूर', startingPrice: 400, estimatedDuration: 'Full day' },
      { id: 'other_labour', en: 'Other daily helper work', hi: 'अन्य दैनिक काम', mr: 'इतर दैनिक कामगार काम', startingPrice: 400, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'other_services',
    canonicalCategory: 'Other Skilled and Unskilled Workers',
    en: 'Other Services',
    hi: 'अन्य सेवाएँ',
    mr: 'इतर सेवा',
    taglineEn: 'Cook, welder, tailor, guard & more',
    taglineHi: 'रसोइया, वेल्डर, दर्ज़ी, गार्ड व अन्य',
    taglineMr: 'स्वयंपाकी, वेल्डर, शिंपी, गार्ड व इतर',
    startingPrice: 249,
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-800',
    accentBorder: 'border-violet-200/80',
    subServices: [
      { id: 'welder_fabrication', en: 'Welder & grill fabrication', hi: 'वेल्डर और ग्रिल काम', mr: 'वेल्डर व ग्रिल काम', startingPrice: 349, estimatedDuration: '1-2 hrs' },
      { id: 'cook_catering', en: 'Home cook / event helper', hi: 'घर का रसोइया / कार्यक्रम मदद', mr: 'स्वयंपाकी / कार्यक्रम मदत', startingPrice: 399, estimatedDuration: '2-4 hrs' },
      { id: 'security_caretaker', en: 'Watchman / caretaker', hi: 'सुरक्षा गार्ड / केयरटेकर', mr: 'वॉचमन / केअरटेकर', startingPrice: 500, estimatedDuration: 'Shift' },
      { id: 'mason_tiles', en: 'Mason / tile & cement repair', hi: 'राजमिस्त्री / टाइल व सीमेंट काम', mr: 'गवंडी / टाईल व सिमेंट काम', startingPrice: 499, estimatedDuration: 'Half / Full day' },
      { id: 'custom_service', en: 'Custom local work request', hi: 'अन्य स्थानीय कार्य अनुरोध', mr: 'इतर स्थानिक कामाची विनंती', startingPrice: 249, estimatedDuration: 'Flexible' },
    ],
  },
  {
    id: 'bike_transport',
    canonicalCategory: BIKE_TRANSPORT_CATEGORY_NAME,
    isTransport: true,
    en: 'Bike Rider / Transport',
    hi: 'बाइक राइडर / ट्रांसपोर्ट',
    mr: 'बाईक रायडर / ट्रान्सपोर्ट',
    taglineEn: 'Pickup-drop ride & parcel delivery',
    taglineHi: 'पिकअप-ड्रॉप राइड व सामान डिलीवरी',
    taglineMr: 'पिकअप-ड्रॉप राईड व सामान वाहतूक',
    startingPrice: 49,
    accentBg: 'bg-emerald-50',
    accentText: 'text-[#15803D]',
    accentBorder: 'border-emerald-300/80',
    subServices: [
      { id: 'bike_ride', en: 'Bike taxi passenger ride', hi: 'बाइक टैक्सी यात्री सवारी', mr: 'बाईक टॅक्सी प्रवासी सवारी', startingPrice: 49, estimatedDuration: 'Trip' },
      { id: 'goods_parcel', en: 'Parcel / goods transport', hi: 'पार्सल / सामान परिवहन', mr: 'पार्सल / सामान वाहतूक', startingPrice: 79, estimatedDuration: 'Trip' },
    ],
  },
];

export function getServiceCategoryLabel(cat: ServiceCategoryV2, lang: Language): string {
  return lang === 'mr' ? cat.mr : lang === 'hi' ? cat.hi : cat.en;
}

export function getServiceTagline(cat: ServiceCategoryV2, lang: Language): string {
  return lang === 'mr' ? cat.taglineMr : lang === 'hi' ? cat.taglineHi : cat.taglineEn;
}

export function getSubServiceLabel(sub: SubServiceItem, lang: Language): string {
  return lang === 'mr' ? sub.mr : lang === 'hi' ? sub.hi : sub.en;
}

export function findServiceCategoryByCanonical(raw: string): ServiceCategoryV2 | undefined {
  const clean = (raw || '').toLowerCase().trim();
  return SERVICE_CATALOG_V2.find(
    (c) =>
      c.id === clean ||
      c.canonicalCategory.toLowerCase() === clean ||
      c.en.toLowerCase() === clean
  );
}
