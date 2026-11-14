import type { Language, VehicleType } from '../types/domain';

export type TransportGroup = 'passenger' | 'goods';

export interface VehicleTypeMeta {
  value: VehicleType;
  group: TransportGroup;
  en: string;
  hi: string;
  mr: string;
  defaultCap: string;
  defaultTitle: string;
  defaultRatePerKm: number;
  defaultRatePerDay: number;
  defaultMinFare: number;
  acDefault: boolean;
}

export const VEHICLE_TYPE_CATALOG: VehicleTypeMeta[] = [
  {
    value: 'bike_taxi',
    group: 'passenger',
    en: 'Bike Taxi / Two-Wheeler',
    hi: 'बाइक टैक्सी / टू-व्हीलर',
    mr: 'बाईक टॅक्सी / दुचाकी',
    defaultCap: '1 Passenger / Quick Parcel',
    defaultTitle: 'Splendor / Activa Bike Taxi',
    defaultRatePerKm: 8,
    defaultRatePerDay: 550,
    defaultMinFare: 25,
    acDefault: false,
  },
  {
    value: 'auto_rickshaw',
    group: 'passenger',
    en: 'Auto Rickshaw (3-Wheeler)',
    hi: 'ऑटो रिक्शा (3-व्हीलर)',
    mr: 'ऑटो रिक्षा (३-चाकी)',
    defaultCap: '3 Passengers',
    defaultTitle: 'Bajaj RE Auto Rickshaw',
    defaultRatePerKm: 15,
    defaultRatePerDay: 1200,
    defaultMinFare: 50,
    acDefault: false,
  },
  {
    value: 'car_sedan',
    group: 'passenger',
    en: 'Car / Hatchback / Sedan',
    hi: 'कार / सेडान / हैचबैक',
    mr: 'कार / सेडान / टॅक्सी',
    defaultCap: '4 Passengers',
    defaultTitle: 'Maruti Dzire / Sedan AC',
    defaultRatePerKm: 14,
    defaultRatePerDay: 2200,
    defaultMinFare: 250,
    acDefault: true,
  },
  {
    value: 'suv_innova',
    group: 'passenger',
    en: 'SUV / Innova / Bolero (6–7 Seater)',
    hi: 'एसयूवी / इनोवा / बोलेरो (6-7 सीटर)',
    mr: 'एसयूव्ही / इनोव्हा / बोलेरो',
    defaultCap: '7 Passengers',
    defaultTitle: 'Innova / Ertiga 7-Seater',
    defaultRatePerKm: 18,
    defaultRatePerDay: 3200,
    defaultMinFare: 400,
    acDefault: true,
  },
  {
    value: 'trolley_cart',
    group: 'goods',
    en: 'Local Trolley / E-Rickshaw Loader',
    hi: 'स्थानीय ट्रॉली / ई-रिक्शा लोडर',
    mr: 'लोकल ट्रॉली / ई-रिक्षा मालवाहू',
    defaultCap: '300–500 Kg Local Goods',
    defaultTitle: 'E-Loader / Hand Trolley Cart',
    defaultRatePerKm: 12,
    defaultRatePerDay: 900,
    defaultMinFare: 80,
    acDefault: false,
  },
  {
    value: 'mini_tempo',
    group: 'goods',
    en: 'Small Goods Vehicle (Chhota Hathi / Tata Ace)',
    hi: 'छोटी मालगाड़ी (छोटा हाथी / टाटा एस)',
    mr: 'छोटी मालवाहू गाडी (छोटा हत्ती / टाटा एस)',
    defaultCap: '750 Kg – 1 Ton Goods',
    defaultTitle: 'Tata Ace / Chhota Hathi Mini Tempo',
    defaultRatePerKm: 18,
    defaultRatePerDay: 1800,
    defaultMinFare: 250,
    acDefault: false,
  },
  {
    value: 'pickup_tempo',
    group: 'goods',
    en: 'Medium Local Goods (Bolero Pickup / 407 Tempo)',
    hi: 'मध्यम स्थानीय मालगाड़ी (पिकअप / 407 टेम्पो)',
    mr: 'मोठी लोकल गाडी (पिकअप / ४०७ टेम्पो)',
    defaultCap: '1.5 – 2.5 Ton (No Heavy Trucks)',
    defaultTitle: 'Bolero Pickup / 407 Local Tempo',
    defaultRatePerKm: 24,
    defaultRatePerDay: 2600,
    defaultMinFare: 350,
    acDefault: false,
  },
  {
    value: 'tractor',
    group: 'goods',
    en: 'Tractor & Trolley (Local Shifting)',
    hi: 'ट्रैक्टर व ट्रॉली (स्थानीय ढुलाई)',
    mr: 'ट्रॅक्टर व ट्रॉली (रेती/विटा/शेती)',
    defaultCap: '3 Ton Local Trolley',
    defaultTitle: 'Tractor + Hydraulic Trolley',
    defaultRatePerKm: 30,
    defaultRatePerDay: 2800,
    defaultMinFare: 500,
    acDefault: false,
  },
];

export function getVehicleTypeLabel(type: VehicleType | string, lang: Language): string {
  const item = VEHICLE_TYPE_CATALOG.find((v) => v.value === type);
  if (!item) return String(type);
  return lang === 'hi' ? item.hi : lang === 'mr' ? item.mr : item.en;
}
