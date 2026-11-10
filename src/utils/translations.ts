/**
 * Bilingual Translations Dictionary (Bangla / English)
 * Allows seamless switching between বাংলা and English across all core screens.
 */

export type Language = 'bn' | 'en';

export const translations = {
  // Navigation & Branding
  appName: {
    bn: 'স্বাস্থ্যবন্ধু',
    en: 'Shasthobondhu',
  },
  appTagline: {
    bn: 'আধুনিক বাংলা ওষুধ ব্যবস্থাপনা',
    en: 'Smart Family Medicine Management',
  },
  navDashboard: {
    bn: 'ড্যাশবোর্ড',
    en: 'Dashboard',
  },
  navChecklist: {
    bn: 'দৈনিক চেকলিস্ট',
    en: 'Daily Checklist',
  },
  navMedicines: {
    bn: 'ওষুধের তালিকা',
    en: 'Medicine List',
  },
  navAddMedicine: {
    bn: 'ওষুধ যোগ করুন',
    en: 'Add Medicine',
  },
  navHealthRecords: {
    bn: 'স্বাস্থ্য রেকর্ড',
    en: 'Health Records',
  },
  navAppointments: {
    bn: 'ডাক্তারের অ্যাপয়েন্টমেন্ট',
    en: 'Appointments',
  },
  navReminders: {
    bn: 'রিমাইন্ডার',
    en: 'Reminders',
  },
  navHistory: {
    bn: 'সেবন ইতিহাস',
    en: 'History',
  },
  navAiAssistant: {
    bn: 'AI সহকারী',
    en: 'AI Assistant',
  },
  navSettings: {
    bn: 'সেটিংস',
    en: 'Settings',
  },
  navLibrary: {
    bn: 'ওষুধ লাইব্রেরি',
    en: 'Medicine Library',
  },

  // Actions
  save: {
    bn: 'সংরক্ষণ করুন',
    en: 'Save',
  },
  cancel: {
    bn: 'বাতিল',
    en: 'Cancel',
  },
  delete: {
    bn: 'মুছে ফেলুন',
    en: 'Delete',
  },
  edit: {
    bn: 'সম্পাদনা',
    en: 'Edit',
  },
  taken: {
    bn: 'খেয়েছি',
    en: 'Taken',
  },
  skip: {
    bn: 'বাদ দিন',
    en: 'Skip',
  },
  skipped: {
    bn: 'বাদ দেওয়া',
    en: 'Skipped',
  },
  pending: {
    bn: 'অপেক্ষমাণ',
    en: 'Pending',
  },

  // Dashboard & Summary
  todaySchedule: {
    bn: 'আজকের ওষুধের সময়সূচি',
    en: "Today's Medication Schedule",
  },
  adherenceRate: {
    bn: 'নিয়মিততার হার',
    en: 'Adherence Rate',
  },
  streakDays: {
    bn: 'টানা সফল দিন',
    en: 'Day Streak',
  },
  lowStockAlert: {
    bn: 'মজুত সতর্কতা',
    en: 'Low Stock Alert',
  },
  buyList: {
    bn: 'কিনতে হবে তালিকা',
    en: 'Buy List',
  },

  // Health Records
  bloodPressure: {
    bn: 'রক্তচাপ (BP)',
    en: 'Blood Pressure',
  },
  bloodSugar: {
    bn: 'রক্তে সুগার (Glucose)',
    en: 'Blood Glucose',
  },
  weight: {
    bn: 'ওজন (Weight)',
    en: 'Body Weight',
  },
  systolic: {
    bn: 'সিস্টোলিক (উপরের)',
    en: 'Systolic (Upper)',
  },
  diastolic: {
    bn: 'ডায়াস্টোলিক (নিচের)',
    en: 'Diastolic (Lower)',
  },
  fasting: {
    bn: 'খালি পেটে',
    en: 'Fasting',
  },
  postprandial: {
    bn: 'খাওয়ার পরে',
    en: 'After Meal',
  },
  normalRange: {
    bn: 'স্বাভাবিক সীমা',
    en: 'Normal Range',
  },

  // Time Slots
  slotMorning: {
    bn: 'সকাল',
    en: 'Morning',
  },
  slotAfternoon: {
    bn: 'দুপুর',
    en: 'Afternoon',
  },
  slotEvening: {
    bn: 'সন্ধ্যা',
    en: 'Evening',
  },
  slotNight: {
    bn: 'রাত',
    en: 'Night',
  },

  // Emergency & Family
  emergencyContacts: {
    bn: 'জরুরি যোগাযোগ',
    en: 'Emergency Contacts',
  },
  notifyFamily: {
    bn: 'পরিবারকে জানান',
    en: 'Notify Family',
  },
  missedDoseAlert: {
    bn: 'ডোজ মিস সতর্কতা',
    en: 'Missed Dose Alert',
  },
  appointmentUpcoming: {
    bn: 'আসন্ন অ্যাপয়েন্টমেন্ট',
    en: 'Upcoming Appointment',
  },
};

export type TranslationKey = keyof typeof translations;

export const t = (key: TranslationKey, lang: Language = 'bn'): string => {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.bn || key;
};
