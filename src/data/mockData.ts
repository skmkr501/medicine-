import {
  Medicine,
  PatientProfile,
  DoseLog,
  ReminderSettings,
  HealthRecord,
  DoctorAppointment,
} from '../types';

export const initialPatients: PatientProfile[] = [];

export const initialMedicines: Medicine[] = [];

export const initialDoseLogs: DoseLog[] = [];

export const initialSettings: ReminderSettings = {
  soundEnabled: true,
  selectedTone: 'soft-bell',
  advanceMinutes: 15,
  snoozeDurationMinutes: 10,
  language: 'bn',
  themeMode: 'system',
  largeFontMode: false,
  easyMode: false,
  voiceReadoutEnabled: true,
  emergencyContactName: '',
  emergencyContactPhone: '',
};

export const initialHealthRecords: HealthRecord[] = [];

export const initialAppointments: DoctorAppointment[] = [];

export const commonMedicinePresets = [
  {
    brandName: 'Napa Extra (নাপা এক্সট্রা)',
    genericName: 'Paracetamol 500mg + Caffeine 65mg',
    type: 'ট্যাবলেট' as const,
    strength: '500 mg + 65 mg',
    mealTiming: 'খাওয়ার পরে' as const,
    purpose: 'জ্বর ও ব্যথানাশক',
    stock: 20,
    minStockAlert: 8,
    unit: 'টি',
    isChronic: false,
    durationDays: 5,
    defaultSchedules: [
      { timeSlot: 'দুপুর' as const, time: '01:30 PM', dosage: '১টি' },
      { timeSlot: 'রাত' as const, time: '09:30 PM', dosage: '১টি' },
    ],
  },
  {
    brandName: 'Seclo 20 (সেক্লো ২০)',
    genericName: 'Omeprazole 20mg',
    type: 'ক্যাপসুল' as const,
    strength: '20 mg',
    mealTiming: 'খাওয়ার আগে' as const,
    purpose: 'গ্যাস্ট্রিক ও অ্যাসিডিটি',
    stock: 30,
    minStockAlert: 10,
    unit: 'টি',
    isChronic: true,
    defaultSchedules: [
      { timeSlot: 'সকাল' as const, time: '07:30 AM', dosage: '১টি' },
      { timeSlot: 'রাত' as const, time: '08:30 PM', dosage: '১টি' },
    ],
  },
  {
    brandName: 'Concor 2.5 (কনকর ২.৫)',
    genericName: 'Bisoprolol Fumarate 2.5mg',
    type: 'ট্যাবলেট' as const,
    strength: '2.5 mg',
    mealTiming: 'খাওয়ার পরে' as const,
    purpose: 'উচ্চ রক্তচাপ নিয়ন্ত্রণ',
    stock: 30,
    minStockAlert: 7,
    unit: 'টি',
    isChronic: true,
    defaultSchedules: [
      { timeSlot: 'সকাল' as const, time: '08:30 AM', dosage: '১টি' },
    ],
  },
  {
    brandName: 'Montene 10 (মন্টিন ১০)',
    genericName: 'Montelukast 10mg',
    type: 'ট্যাবলেট' as const,
    strength: '10 mg',
    mealTiming: 'ঘুমানোর আগে' as const,
    purpose: 'অ্যালার্জি ও হাঁপানি',
    stock: 20,
    minStockAlert: 6,
    unit: 'টি',
    isChronic: true,
    defaultSchedules: [
      { timeSlot: 'রাত' as const, time: '09:30 PM', dosage: '১টি' },
    ],
  },
  {
    brandName: 'Ceevit 250 (সিভিট ২৫০)',
    genericName: 'Ascorbic Acid (Vitamin C) 250mg',
    type: 'ট্যাবলেট' as const,
    strength: '250 mg',
    mealTiming: 'খাওয়ার পরে' as const,
    purpose: 'রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি',
    stock: 30,
    minStockAlert: 10,
    unit: 'টি',
    isChronic: false,
    durationDays: 30,
    defaultSchedules: [
      { timeSlot: 'দুপুর' as const, time: '02:00 PM', dosage: '১টি চুষে খাওয়া' },
    ],
  },
];
