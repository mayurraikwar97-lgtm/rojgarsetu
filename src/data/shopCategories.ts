import type { Language } from '../types/domain';

export interface ShopCategoryItem {
  id: string;
  en: string;
  hi: string;
  mr: string;
}

export const SHOP_CATEGORY_CATALOG: ShopCategoryItem[] = [
  { id: 'kirana_grocery', en: 'Kirana & Grocery Store', hi: 'किराना एवं जनरल स्टोर', mr: 'किराणा व जनरल स्टोअर' },
  { id: 'hardware_electrical', en: 'Hardware & Electricals', hi: 'हार्डवेयर एवं इलेक्ट्रिकल', mr: 'हार्डवेअर व इलेक्ट्रिकल' },
  { id: 'medical_pharmacy', en: 'Medical & Pharmacy', hi: 'मेडिकल एवं दवाखाना', mr: 'मेडिकल व औषधालय' },
  { id: 'garments_tailoring', en: 'Garments, Saree & Tailoring', hi: 'कपड़े, साड़ी एवं टेलरिंग', mr: 'कपडे, साडी व टेलरिंग' },
  { id: 'mobile_electronics', en: 'Mobile & Electronics', hi: 'मोबाइल एवं इलेक्ट्रॉनिक्स', mr: 'मोबाईल व इलेक्ट्रॉनिक्स' },
  { id: 'bakery_dairy_sweets', en: 'Bakery, Dairy & Sweets', hi: 'बेकरी, डेयरी एवं मिठाई', mr: 'बेकरी, डेअरी व मिठाई' },
  { id: 'fruits_vegetables', en: 'Fresh Fruits & Vegetables', hi: 'ताज़े फल एवं सब्ज़ियाँ', mr: 'ताजी फळे व भाजीपाला' },
  { id: 'agri_seeds_fertilizer', en: 'Agriculture, Seeds & Agro', hi: 'कृषि सेवा एवं खाद-बीज', mr: 'कृषी सेवा केंद्र व बियाणे' },
  { id: 'stationery_books', en: 'Stationery, Books & Xerox', hi: 'स्टेशनरी, पुस्तकें एवं ज़ेरॉक्स', mr: 'स्टेशनरी, पुस्तके व झेरॉक्स' },
  { id: 'salon_beauty', en: 'Salon, Parlour & Cosmetics', hi: 'सलून, ब्यूटी पार्लर एवं कॉस्मेटिक्स', mr: 'सलून, ब्युटी पार्लर व कॉस्मेटिक्स' },
  { id: 'auto_parts_tyre', en: 'Auto Spare Parts & Tyre', hi: 'ऑटो पार्ट्स एवं टायर दुकान', mr: 'ऑटो पार्ट्स व टायर दुकान' },
  { id: 'furniture_home', en: 'Furniture & Home Appliances', hi: 'फर्नीचर एवं घरेलू सामान', mr: 'फर्निचर व गृहपयोगी वस्तू' },
  { id: 'building_materials', en: 'Building & Construction Materials', hi: 'निर्माण सामग्री एवं सीमेंट-रेत', mr: 'बांधकाम साहित्य व सिमेंट-वाळू' },
  { id: 'hotel_catering', en: 'Hotel, Snacks & Catering', hi: 'होटल, नाश्ता एवं केटरिंग', mr: 'हॉटेल, नाश्ता व केटरिंग' },
];

export function getShopCategoryLabel(categoryValue: string, lang: Language): string {
  const found = SHOP_CATEGORY_CATALOG.find(
    (item) => item.id === categoryValue || item.en.toLowerCase() === categoryValue.toLowerCase()
  );
  if (found) {
    return lang === 'mr' ? found.mr : lang === 'hi' ? found.hi : found.en;
  }
  return categoryValue;
}

export function normalizeCustomShopCategory(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
