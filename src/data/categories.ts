export interface EmploymentCategory {
  id: string;
  index: number;
  en: string;
  hi: string;
  mr: string;
  skillsEn: string[];
  group: 'trades' | 'industrial' | 'transport' | 'agriculture' | 'hospitality' | 'office' | 'services' | 'enterprise';
}

export const EMPLOYMENT_CATEGORIES: EmploymentCategory[] = [
  { id: 'construction-workers', index: 1, en: 'Construction Workers', hi: 'निर्माण श्रमिक', mr: 'बांधकाम कामगार', skillsEn: ['Masonry', 'Bar Bending', 'Shuttering', 'Site Support'], group: 'trades' },
  { id: 'carpenters', index: 2, en: 'Carpenters', hi: 'बढ़ई / सुतार', mr: 'सुतार', skillsEn: ['Furniture Making', 'Door & Window Fitting', 'Woodwork'], group: 'trades' },
  { id: 'electricians', index: 3, en: 'Electricians', hi: 'इलेक्ट्रीशियन / बिजली मिस्त्री', mr: 'इलेक्ट्रिशियन / वीजतंत्री', skillsEn: ['House Wiring', 'Panel Maintenance', 'Solar Installation'], group: 'trades' },
  { id: 'plumbers', index: 4, en: 'Plumbers', hi: 'प्लंबर / नलसाज', mr: 'प्लंबर / नळ कारागीर', skillsEn: ['Pipe Fitting', 'Sanitary Repair', 'Water Pump Setup'], group: 'trades' },
  { id: 'welders', index: 5, en: 'Welders', hi: 'वेल्डर', mr: 'वेल्डर', skillsEn: ['Arc Welding', 'MIG/TIG Welding', 'Gate & Grill Fabrication'], group: 'industrial' },
  { id: 'fitters-machine-operators', index: 6, en: 'Fitters and Machine Operators', hi: 'फिटर एवं मशीन ऑपरेटर', mr: 'फिटर आणि मशीन ऑपरेटर', skillsEn: ['CNC Operation', 'Lathe Machine', 'Industrial Fitting'], group: 'industrial' },
  { id: 'painters', index: 7, en: 'Painters', hi: 'पेंटर / रंगाई कार्य', mr: 'पेंटर / रंगारी', skillsEn: ['Interior Painting', 'Exterior Coating', 'Waterproofing'], group: 'trades' },
  { id: 'helpers-general-labour', index: 8, en: 'Helpers and General Labour', hi: 'हेल्पर एवं सामान्य श्रमिक', mr: 'हेल्पर आणि सामान्य कामगार', skillsEn: ['Loading & Unloading', 'Site Assistance', 'Material Handling'], group: 'trades' },
  { id: 'factory-industrial-workers', index: 9, en: 'Factory and Industrial Workers', hi: 'फैक्ट्री एवं औद्योगिक श्रमिक', mr: 'कारखाना आणि औद्योगिक कामगार', skillsEn: ['Assembly Line', 'Packaging', 'Quality Inspection'], group: 'industrial' },
  { id: 'drivers', index: 10, en: 'Drivers', hi: 'वाहन चालक (ड्राइवर)', mr: 'वाहन चालक (ड्रायव्हर)', skillsEn: ['LMV Driving', 'Heavy Vehicle Driving', 'Fleet Operations'], group: 'transport' },
  { id: 'auto-taxi-commercial-operators', index: 11, en: 'Auto, Taxi and Commercial Vehicle Operators', hi: 'ऑटो, टैक्सी एवं व्यावसायिक वाहन चालक', mr: 'ऑटो, टॅक्सी आणि व्यावसायिक वाहन चालक', skillsEn: ['Auto Rickshaw', 'Commercial Cab', 'Passenger Transport'], group: 'transport' },
  { id: 'transport-logistics-workers', index: 12, en: 'Transport and Logistics Workers', hi: 'परिवहन एवं लॉजिस्टिक्स कर्मी', mr: 'वाहतूक आणि लॉजिस्टिक्स कामगार', skillsEn: ['Warehouse Sorting', 'Dispatch Helper', 'Freight Handling'], group: 'transport' },
  { id: 'agricultural-workers', index: 13, en: 'Agricultural Workers', hi: 'कृषि श्रमिक', mr: 'शेतमजूर / कृषी कामगार', skillsEn: ['Sowing & Harvesting', 'Irrigation Support', 'Crop Grading'], group: 'agriculture' },
  { id: 'farmers-tractor-operators', index: 14, en: 'Farmers and Tractor Operators', hi: 'किसान एवं ट्रैक्टर ऑपरेटर', mr: 'शेतकरी आणि ट्रॅक्टर चालक', skillsEn: ['Tractor Ploughing', 'Harvester Operation', 'Agri-Equipment'], group: 'agriculture' },
  { id: 'domestic-workers', index: 15, en: 'Domestic Workers', hi: 'घरेलू कामगार', mr: 'घरगुती कामगार', skillsEn: ['Household Upkeep', 'Laundry & Ironing', 'Home Assistance'], group: 'hospitality' },
  { id: 'cooks-kitchen-staff', index: 16, en: 'Cooks and Kitchen Staff', hi: 'रसोइया एवं रसोई सहायक', mr: 'स्वयंपाकी आणि स्वयंपाकघर सहाय्यक', skillsEn: ['Home Cooking', 'Catering Prep', 'Canteen Kitchen'], group: 'hospitality' },
  { id: 'housekeeping-cleaning-staff', index: 17, en: 'Housekeeping and Cleaning Staff', hi: 'हाउसकीपिंग एवं स्वच्छता कर्मी', mr: 'हाउसकीपिंग आणि स्वच्छता कर्मचारी', skillsEn: ['Facility Sanitization', 'Office Housekeeping', 'Deep Cleaning'], group: 'hospitality' },
  { id: 'security-guards', index: 18, en: 'Security Guards', hi: 'सुरक्षा गार्ड', mr: 'सुरक्षा रक्षक', skillsEn: ['Gate Security', 'Night Patrol', 'Visitor Screening'], group: 'services' },
  { id: 'office-assistants', index: 19, en: 'Office Assistants', hi: 'कार्यालय सहायक', mr: 'कार्यालय सहाय्यक', skillsEn: ['Filing & Dispatch', 'Front Desk Support', 'Clerical Tasks'], group: 'office' },
  { id: 'accountants', index: 20, en: 'Accountants', hi: 'लेखाकार (अकाउंटेंट)', mr: 'लेखापाल (अकाउंटंट)', skillsEn: ['Bookkeeping', 'GST Billing', 'Tally / Ledger'], group: 'office' },
  { id: 'data-entry-operators', index: 21, en: 'Data Entry Operators', hi: 'डेटा एंट्री ऑपरेटर', mr: 'डेटा एंट्री ऑपरेटर', skillsEn: ['Typing & Digitization', 'Spreadsheet Entry', 'Record Management'], group: 'office' },
  { id: 'computer-operators', index: 22, en: 'Computer Operators', hi: 'कंप्यूटर ऑपरेटर', mr: 'संगणक चालक', skillsEn: ['MS Office', 'Documentation', 'Digital Forms'], group: 'office' },
  { id: 'teachers-tutors', index: 23, en: 'Teachers and Tutors', hi: 'शिक्षक एवं ट्यूटर', mr: 'शिक्षक आणि मार्गदर्शक', skillsEn: ['School Tutoring', 'Vocational Instruction', 'Adult Literacy'], group: 'services' },
  { id: 'healthcare-assistants-caregivers', index: 24, en: 'Healthcare Assistants and Caregivers', hi: 'स्वास्थ्य सहायक एवं देखभालकर्ता', mr: 'आरोग्य सहाय्यक आणि काळजीवाहू', skillsEn: ['Elder Care', 'Patient Assistance', 'Clinic Support'], group: 'services' },
  { id: 'delivery-personnel', index: 25, en: 'Delivery Personnel', hi: 'डिलीवरी कर्मी', mr: 'वितरण कर्मचारी (डिलिव्हरी)', skillsEn: ['Two-Wheeler Delivery', 'Parcel Courier', 'Local Logistics'], group: 'transport' },
  { id: 'sales-marketing-staff', index: 26, en: 'Sales and Marketing Staff', hi: 'बिक्री एवं विपणन कर्मी', mr: 'विक्री आणि विपणन कर्मचारी', skillsEn: ['Field Sales', 'Customer Outreach', 'Retail Promotion'], group: 'office' },
  { id: 'shop-retail-employees', index: 27, en: 'Shop and Retail Employees', hi: 'दुकान एवं खुदरा कर्मचारी', mr: 'दुकान आणि किरकोळ विक्री कर्मचारी', skillsEn: ['Counter Billing', 'Inventory Shelving', 'Customer Service'], group: 'services' },
  { id: 'event-hospitality-workers', index: 28, en: 'Event and Hospitality Workers', hi: 'इवेंट एवं आतिथ्य कर्मी', mr: 'कार्यक्रम आणि आतिथ्य कामगार', skillsEn: ['Event Setup', 'Banquet Service', 'Guest Reception'], group: 'hospitality' },
  { id: 'technicians-mechanics', index: 29, en: 'Technicians and Mechanics', hi: 'तकनीशियन एवं मैकेनिक', mr: 'तंत्रज्ञ आणि मेकॅनिक', skillsEn: ['AC & Appliance Repair', 'Two/Four-Wheeler Mechanic', 'Diesel Engine'], group: 'industrial' },
  { id: 'freelancers-self-employed', index: 30, en: 'Freelancers and Self-Employed Professionals', hi: 'फ्रीलांसर एवं स्व-रोजगार पेशेवर', mr: 'फ्रीलान्सर आणि स्वयंरोजगार व्यावसायिक', skillsEn: ['Tailoring', 'Photography', 'Independent Services'], group: 'enterprise' },
  { id: 'women-entrepreneurs', index: 31, en: 'Women Entrepreneurs', hi: 'महिला उद्यमी', mr: 'महिला उद्योजक', skillsEn: ['SHG Micro-Enterprise', 'Food Processing', 'Handicrafts & Textiles'], group: 'enterprise' },
  { id: 'other-skilled-unskilled', index: 32, en: 'Other Skilled and Unskilled Workers', hi: 'अन्य कुशल एवं अकुशल श्रमिक', mr: 'इतर कुशल आणि अकुशल कामगार', skillsEn: ['Gardening', 'Craftsmanship', 'Seasonal Support'], group: 'services' },
];
