export interface DistrictCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface IndianStateData {
  name: string;
  districts: DistrictCoord[];
}

export const INDIA_STATES_DISTRICTS: IndianStateData[] = [
  {
    name: 'Chhattisgarh',
    districts: [
      { name: 'Narayanpur (Abujhmad)', lat: 19.7176, lng: 81.2468 },
      { name: 'Raipur', lat: 21.2514, lng: 81.6296 },
      { name: 'Bastar (Jagdalpur)', lat: 19.0785, lng: 82.0209 },
      { name: 'Durg', lat: 21.1904, lng: 81.2849 },
      { name: 'Bilaspur', lat: 22.0797, lng: 82.1409 },
      { name: 'Korba', lat: 22.3595, lng: 82.7501 },
      { name: 'Kanker', lat: 20.2719, lng: 81.4932 },
      { name: 'Kondagaon', lat: 19.591, lng: 81.663 },
      { name: 'Dantewada', lat: 18.898, lng: 81.35 },
      { name: 'Bijapur', lat: 18.795, lng: 80.818 },
      { name: 'Sukma', lat: 18.388, lng: 81.662 },
      { name: 'Rajnandgaon', lat: 21.097, lng: 81.031 },
      { name: 'Raigarh', lat: 21.897, lng: 83.395 },
    ],
  },
  {
    name: 'Maharashtra',
    districts: [
      { name: 'Mumbai Suburban', lat: 19.076, lng: 72.8777 },
      { name: 'Pune', lat: 18.5204, lng: 73.8567 },
      { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
      { name: 'Chandrapur', lat: 19.9615, lng: 79.2961 },
      { name: 'Gadchiroli', lat: 20.1849, lng: 79.9948 },
      { name: 'Wardha', lat: 20.7453, lng: 78.6022 },
      { name: 'Yavatmal', lat: 20.3888, lng: 78.1204 },
      { name: 'Amravati', lat: 20.932, lng: 77.7523 },
      { name: 'Akola', lat: 20.7002, lng: 77.0082 },
      { name: 'Bhandara', lat: 21.1777, lng: 79.657 },
      { name: 'Gondia', lat: 21.4624, lng: 80.192 },
      { name: 'Washim', lat: 20.1119, lng: 77.1317 },
      { name: 'Buldhana', lat: 20.5293, lng: 76.1842 },
      { name: 'Nashik', lat: 19.9975, lng: 73.7898 },
      { name: 'Chhatrapati Sambhajinagar', lat: 19.8762, lng: 75.3433 },
      { name: 'Nanded', lat: 19.1383, lng: 77.321 },
      { name: 'Latur', lat: 18.4088, lng: 76.5604 },
      { name: 'Solapur', lat: 17.6599, lng: 75.9064 },
      { name: 'Kolhapur', lat: 16.705, lng: 74.2433 },
      { name: 'Satara', lat: 17.6805, lng: 74.0183 },
      { name: 'Sangli', lat: 16.8524, lng: 74.5815 },
      { name: 'Jalgaon', lat: 21.0077, lng: 75.5626 },
      { name: 'Ahmednagar (Ahilyanagar)', lat: 19.0948, lng: 74.748 },
      { name: 'Thane', lat: 19.2183, lng: 72.9781 },
      { name: 'Raigad (Alibag)', lat: 18.6411, lng: 72.8722 },
      { name: 'Ratnagiri', lat: 16.9902, lng: 73.312 },
    ],
  },
  {
    name: 'Madhya Pradesh',
    districts: [
      { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
      { name: 'Indore', lat: 22.7196, lng: 75.8577 },
      { name: 'Jabalpur', lat: 23.1815, lng: 79.9864 },
      { name: 'Gwalior', lat: 26.2183, lng: 78.1828 },
      { name: 'Ujjain', lat: 23.1765, lng: 75.7885 },
      { name: 'Chhindwara', lat: 22.0574, lng: 78.9382 },
      { name: 'Seoni', lat: 22.0869, lng: 79.5435 },
      { name: 'Balaghat', lat: 21.8129, lng: 80.1838 },
    ],
  },
  {
    name: 'Delhi (NCT)',
    districts: [
      { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
      { name: 'South Delhi', lat: 28.5245, lng: 77.2066 },
      { name: 'East Delhi', lat: 28.628, lng: 77.295 },
      { name: 'North West Delhi', lat: 28.7041, lng: 77.1025 },
    ],
  },
  {
    name: 'Uttar Pradesh',
    districts: [
      { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
      { name: 'Kanpur Nagar', lat: 26.4499, lng: 80.3319 },
      { name: 'Varanasi', lat: 25.3176, lng: 82.9739 },
      { name: 'Prayagraj', lat: 25.4358, lng: 81.8463 },
      { name: 'Gautam Buddha Nagar (Noida)', lat: 28.5355, lng: 77.391 },
    ],
  },
  {
    name: 'Gujarat',
    districts: [
      { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
      { name: 'Surat', lat: 21.1702, lng: 72.8311 },
      { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { name: 'Rajkot', lat: 22.3039, lng: 70.8022 },
    ],
  },
  {
    name: 'Rajasthan',
    districts: [
      { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
      { name: 'Jodhpur', lat: 26.2389, lng: 73.0243 },
      { name: 'Udaipur', lat: 24.5854, lng: 73.7125 },
      { name: 'Kota', lat: 25.2138, lng: 75.8648 },
    ],
  },
  {
    name: 'Karnataka',
    districts: [
      { name: 'Bengaluru Urban', lat: 12.9716, lng: 77.5946 },
      { name: 'Mysuru', lat: 12.2958, lng: 76.6394 },
      { name: 'Hubballi-Dharwad', lat: 15.3647, lng: 75.124 },
      { name: 'Mangaluru', lat: 12.9141, lng: 74.856 },
    ],
  },
  {
    name: 'Tamil Nadu',
    districts: [
      { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
      { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
      { name: 'Madurai', lat: 9.9252, lng: 78.1198 },
      { name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047 },
    ],
  },
  {
    name: 'Telangana',
    districts: [
      { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
      { name: 'Warangal', lat: 17.9689, lng: 79.5941 },
      { name: 'Nizamabad', lat: 18.6725, lng: 78.0941 },
      { name: 'Adilabad', lat: 19.6641, lng: 78.532 },
      { name: 'Karimnagar', lat: 18.4386, lng: 79.1288 },
    ],
  },
  {
    name: 'Andhra Pradesh',
    districts: [
      { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
      { name: 'Vijayawada', lat: 16.5062, lng: 80.648 },
      { name: 'Tirupati', lat: 13.6288, lng: 79.4192 },
    ],
  },
  {
    name: 'West Bengal',
    districts: [
      { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
      { name: 'Howrah', lat: 22.5958, lng: 88.2636 },
      { name: 'Siliguri', lat: 26.7271, lng: 88.3953 },
    ],
  },
  {
    name: 'Bihar',
    districts: [
      { name: 'Patna', lat: 25.5941, lng: 85.1376 },
      { name: 'Gaya', lat: 24.7914, lng: 85.0002 },
      { name: 'Muzaffarpur', lat: 26.1197, lng: 85.391 },
    ],
  },
  {
    name: 'Odisha',
    districts: [
      { name: 'Bhubaneswar (Khordha)', lat: 20.2961, lng: 85.8245 },
      { name: 'Cuttack', lat: 20.4625, lng: 85.883 },
      { name: 'Rourkela (Sundargarh)', lat: 22.2604, lng: 84.8536 },
    ],
  },
  {
    name: 'Jharkhand',
    districts: [
      { name: 'Ranchi', lat: 23.3441, lng: 85.3096 },
      { name: 'Jamshedpur', lat: 22.8046, lng: 86.2029 },
      { name: 'Dhanbad', lat: 23.7957, lng: 86.4304 },
    ],
  },
  {
    name: 'Punjab',
    districts: [
      { name: 'Ludhiana', lat: 30.901, lng: 75.8573 },
      { name: 'Amritsar', lat: 31.634, lng: 74.8723 },
      { name: 'Jalandhar', lat: 31.326, lng: 75.5762 },
    ],
  },
  {
    name: 'Haryana',
    districts: [
      { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
      { name: 'Faridabad', lat: 28.4089, lng: 77.3178 },
      { name: 'Panipat', lat: 29.3909, lng: 76.9635 },
    ],
  },
  {
    name: 'Kerala',
    districts: [
      { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
      { name: 'Ernakulam (Kochi)', lat: 9.9312, lng: 76.2673 },
      { name: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
    ],
  },
  {
    name: 'Assam',
    districts: [
      { name: 'Guwahati (Kamrup Metro)', lat: 26.1445, lng: 91.7362 },
      { name: 'Dibrugarh', lat: 27.4728, lng: 94.912 },
      { name: 'Silchar', lat: 24.8333, lng: 92.7789 },
    ],
  },
];

export function getDistrictCoordinates(stateName: string, districtName: string): { lat: number; lng: number } {
  const st = INDIA_STATES_DISTRICTS.find((s) => s.name === stateName);
  const dist = st?.districts.find((d) => d.name === districtName);
  if (dist) return { lat: dist.lat, lng: dist.lng };
  if (st && st.districts[0]) return { lat: st.districts[0].lat, lng: st.districts[0].lng };
  return { lat: 21.1458, lng: 79.0882 }; // Center of India (Nagpur)
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findNearestDistrict(
  lat: number,
  lng: number
): { state: string; district: string; distanceKm: number; isWithinIndiaBounds: boolean } {
  const isWithinIndiaBounds = lat >= 6.0 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
  let bestState = 'Maharashtra';
  let bestDistrict = 'Nagpur';
  let bestKm = Number.POSITIVE_INFINITY;

  for (const st of INDIA_STATES_DISTRICTS) {
    for (const dist of st.districts) {
      const km = calculateDistanceKm(lat, lng, dist.lat, dist.lng);
      if (km < bestKm) {
        bestKm = km;
        bestState = st.name;
        bestDistrict = dist.name;
      }
    }
  }

  return {
    state: bestState,
    district: bestDistrict,
    distanceKm: bestKm,
    isWithinIndiaBounds,
  };
}
