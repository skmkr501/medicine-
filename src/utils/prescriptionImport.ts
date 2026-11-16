import {
  DoseSchedule,
  GlobalMedicine,
  MealTiming,
  Medicine,
  MedicineType,
  PatientProfile,
  TimeSlot,
} from '../types';
import type {
  PrescriptionAiItem,
  PrescriptionAiResponse,
  PrescriptionAiSchedule,
} from '../services/aiService';
import { toBengaliNumber } from './bengaliUtils';
import { findMatchingCatalogMedicine, toLocalIsoDate } from './shoppingListCalculator';

export const PRESCRIPTION_VERIFICATION_BANNER =
  'এটি ছবি থেকে স্বয়ংক্রিয়ভাবে পড়া। যোগ করার আগে ডাক্তারের লেখার সাথে প্রতিটি ওষুধ মিলিয়ে নিন।';

export const PRESCRIPTION_UNREADABLE_MESSAGE =
  'ছবি পরিষ্কার নয়, আলো ঠিক করে আবার তুলুন';

export const PRESCRIPTION_PHOTO_TIPS: string[] = [
  'প্রেসক্রিপশন সমতল টেবিলে সোজা করে রাখুন',
  'পর্যাপ্ত আলোতে ছবি তুলুন (ছায়া বা ঝাপসা এড়ান)',
  'ওষুধের নামের অংশসহ পুরো পাতা ফ্রেমে রাখুন',
];

export const PRESCRIPTION_DEFAULT_SLOT_TIMES: Record<TimeSlot, string> = {
  'সকাল': '08:00 AM',
  'দুপুর': '02:00 PM',
  'সন্ধ্যা': '06:00 PM',
  'রাত': '09:00 PM',
};

export const PRESCRIPTION_SLOT_ORDER: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];

export interface PrescriptionReviewItem {
  tempId: string;
  selected: boolean;
  confidence: 'high' | 'medium' | 'low';
  needsVerification: boolean;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: MedicineType;
  amountPerDose: number;
  timesPerDay: number;
  schedule: PrescriptionAiSchedule;
  slotTimes: Record<TimeSlot, string>;
  mealTiming: MealTiming;
  durationDays: number;
  stock: number;
  stockManuallyEdited: boolean;
  unit: string;
  notes: string;
  doctorName: string;
  catalogMatch?: GlobalMedicine;
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeDigitsToEnglish(text?: string | null): string {
  if (!text) return '';
  return String(text).replace(/[০-৯]/g, (ch) => BN_TO_EN_DIGITS[ch] || ch);
}

/**
 * Converts "08:00 AM" / "02:00 PM" / "09:00 PM" into "08:00" / "14:00" / "21:00" for HTML <input type="time">.
 */
export function formatTime12hTo24h(time12h: string): string {
  const cleaned = normalizeDigitsToEnglish(time12h).trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '08:00';
  let hours = parseInt(match[1], 10);
  const mins = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  const mer = (match[3] || '').toUpperCase();
  if (mer === 'PM' && hours < 12) hours += 12;
  if (mer === 'AM' && hours === 12) hours = 0;
  hours = Math.min(23, Math.max(0, hours));
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Converts HTML <input type="time"> "HH:mm" into "hh:mm AM/PM".
 */
export function formatTime24hTo12h(time24h: string): string {
  const cleaned = normalizeDigitsToEnglish(time24h).trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '08:00 AM';
  const rawHour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const mins = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  const meridiem = rawHour >= 12 ? 'PM' : 'AM';
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
}

export function mapDosageFormToMedicineType(dosageForm?: string | null): MedicineType {
  const raw = (dosageForm || '').trim().toLowerCase();
  if (!raw) return 'ট্যাবলেট';

  if (raw.includes('cap') || raw.includes('ক্যাপসুল')) return 'ক্যাপসুল';
  if (
    raw.includes('syr') ||
    raw.includes('syp') ||
    raw.includes('susp') ||
    raw.includes('সিরাপ') ||
    raw.includes('সাসপেনশন')
  ) {
    return 'সিরাপ';
  }
  if (raw.includes('ins') || raw.includes('inj') || raw.includes('ইনসুলিন') || raw.includes('ইনজেকশন')) {
    return 'ইনসুলিন/ইনজেকশন';
  }
  if (raw.includes('drop') || raw.includes('ড্রপ')) return 'চোখের ড্রপ';
  if (raw.includes('inh') || raw.includes('puff') || raw.includes('ইনহেলার')) return 'ইনহেলার';
  if (raw.includes('oint') || raw.includes('gel') || raw.includes('cream') || raw.includes('মলম') || raw.includes('জেল') || raw.includes('ক্রিম')) {
    return 'মলম/জেল';
  }
  return 'ট্যাবলেট';
}

export function getDefaultUnitForType(type: MedicineType): string {
  switch (type) {
    case 'সিরাপ':
      return 'চামচ';
    case 'চোখের ড্রপ':
      return 'ড্রপ';
    case 'ইনহেলার':
      return 'পাফ';
    case 'ইনসুলিন/ইনজেকশন':
      return 'পেন';
    default:
      return 'টি';
  }
}

export function mapPrescriptionMealTiming(raw?: string | null): MealTiming {
  const trimmed = (raw || '').trim();
  if (trimmed === 'খাবারের আগে' || trimmed === 'খাওয়ার আগে') return 'খাওয়ার আগে';
  if (trimmed === 'খাবারের পরে' || trimmed === 'খাওয়ার পরে') return 'খাওয়ার পরে';
  if (trimmed === 'যেকোনো সময়') return 'যেকোনো সময়';
  return 'খাওয়ার পরে';
}

export function countActiveSlots(schedule: PrescriptionAiSchedule): number {
  let count = 0;
  if (schedule.morning) count += 1;
  if (schedule.noon) count += 1;
  if (schedule.evening) count += 1;
  if (schedule.night) count += 1;
  return count;
}

export function deriveScheduleFromTimesPerDay(
  rawSchedule?: Partial<PrescriptionAiSchedule> | null,
  timesPerDay?: number | null
): PrescriptionAiSchedule {
  const schedule: PrescriptionAiSchedule = {
    morning: Boolean(rawSchedule?.morning),
    noon: Boolean(rawSchedule?.noon),
    evening: Boolean(rawSchedule?.evening),
    night: Boolean(rawSchedule?.night),
  };

  if (countActiveSlots(schedule) > 0) {
    return schedule;
  }

  const times = typeof timesPerDay === 'number' && timesPerDay > 0 ? Math.round(timesPerDay) : 1;
  if (times >= 4) {
    return { morning: true, noon: true, evening: true, night: true };
  }
  if (times === 3) {
    return { morning: true, noon: true, evening: false, night: true };
  }
  if (times === 2) {
    return { morning: true, noon: false, evening: false, night: true };
  }
  return { morning: true, noon: false, evening: false, night: false };
}

export function calculateDefaultStock(
  durationDays: number,
  amountPerDose: number,
  schedule: PrescriptionAiSchedule
): number {
  const slotsCount = Math.max(1, countActiveSlots(schedule));
  const safeDays = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 7;
  const safeAmount = Number.isFinite(amountPerDose) && amountPerDose > 0 ? amountPerDose : 1;
  return Math.max(1, Math.ceil(safeDays * safeAmount * slotsCount));
}

export function formatDosageStringBn(amountPerDose: number, unit: string): string {
  const safeAmount = Number.isFinite(amountPerDose) && amountPerDose > 0 ? amountPerDose : 1;
  const cleanUnit = unit.trim() || 'টি';
  return `${toBengaliNumber(safeAmount)}${cleanUnit}`;
}

/**
 * Matches an extracted brandName (+ optional strength) strictly against the local globalMedicines cache.
 * Zero Firestore reads.
 */
export function matchLocalLibraryMedicine(
  brandName: string,
  strength: string,
  globalMedicines?: GlobalMedicine[]
): GlobalMedicine | undefined {
  if (!globalMedicines || globalMedicines.length === 0) return undefined;
  const cleanBrand = brandName.trim();
  if (!cleanBrand) return undefined;
  const cleanStrength = strength.trim();

  // 1. Exact brand + strength match using shared catalog matcher
  const probeMed: Medicine = {
    id: 'probe',
    brandName: cleanBrand,
    genericName: '',
    type: 'ট্যাবলেট',
    strength: cleanStrength,
    mealTiming: 'খাওয়ার পরে',
    schedules: [],
    stock: 0,
    minStockAlert: 1,
    unit: 'টি',
    startDate: '2026-01-01',
    isChronic: false,
    status: 'active',
    colorTag: 'teal',
  };

  const exact = findMatchingCatalogMedicine(probeMed, globalMedicines);
  if (exact.medicine) return exact.medicine;

  // 2. If strength wasn't provided or catalog has a unique brand match, match normalized brand name
  const normBrand = cleanBrand.toLowerCase().replace(/\s+/g, ' ');
  const brandCandidates = globalMedicines.filter((gm) => {
    const gmEn = (gm.brandName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const gmBn = (gm.brandNameBn || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return gmEn === normBrand || (gmBn !== '' && gmBn === normBrand);
  });

  if (brandCandidates.length === 0) return undefined;
  if (!cleanStrength) {
    return brandCandidates[0];
  }

  // Soft strength match (e.g. "500" vs "500 mg")
  const normStrengthDigits = cleanStrength.toLowerCase().replace(/[^a-z0-9.]/g, '');
  const softMatched = brandCandidates.find((gm) => {
    const gmNorm = (gm.strength || '').trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
    return gmNorm === normStrengthDigits;
  });

  return softMatched;
}

export function buildReviewItemsFromAiResponse(
  response: PrescriptionAiResponse,
  globalMedicines?: GlobalMedicine[]
): PrescriptionReviewItem[] {
  const rawItems = Array.isArray(response.items) ? response.items : [];
  const docName = (response.doctorName || '').trim();

  return rawItems.map((item: PrescriptionAiItem, idx: number) => {
    const brandName = (item.brandName || '').trim();
    const strength = (item.strength || '').trim();
    const matchedCatalog = brandName
      ? matchLocalLibraryMedicine(brandName, strength, globalMedicines)
      : undefined;

    const dosageForm = mapDosageFormToMedicineType(
      item.dosageForm || matchedCatalog?.dosageForm
    );
    const unit = getDefaultUnitForType(dosageForm);
    const amountPerDose =
      typeof item.amountPerDose === 'number' && Number.isFinite(item.amountPerDose) && item.amountPerDose > 0
        ? item.amountPerDose
        : 1;
    const schedule = deriveScheduleFromTimesPerDay(item.schedule, item.timesPerDay);
    const timesPerDay = countActiveSlots(schedule) || 1;
    const durationDays =
      typeof item.durationDays === 'number' && Number.isFinite(item.durationDays) && item.durationDays > 0
        ? Math.round(item.durationDays)
        : 7;

    const confidence: 'high' | 'medium' | 'low' =
      item.confidence === 'high' || item.confidence === 'medium' ? item.confidence : 'low';
    const needsVerification = confidence === 'low' || !brandName;

    return {
      tempId: `rx-item-${Date.now()}-${idx}`,
      selected: confidence !== 'low' && Boolean(brandName),
      confidence,
      needsVerification,
      brandName,
      genericName: (item.genericName || matchedCatalog?.genericName || '').trim(),
      strength: strength || (matchedCatalog?.strength || '').trim(),
      dosageForm,
      amountPerDose,
      timesPerDay,
      schedule,
      slotTimes: { ...PRESCRIPTION_DEFAULT_SLOT_TIMES },
      mealTiming: mapPrescriptionMealTiming(item.mealTiming),
      durationDays,
      stock: calculateDefaultStock(durationDays, amountPerDose, schedule),
      stockManuallyEdited: false,
      unit,
      notes: (item.notes || '').trim(),
      doctorName: docName,
      catalogMatch: matchedCatalog,
    };
  });
}

export function buildDoseSchedulesFromReviewItem(item: PrescriptionReviewItem): DoseSchedule[] {
  const slotMap: Array<{ key: keyof PrescriptionAiSchedule; slot: TimeSlot }> = [
    { key: 'morning', slot: 'সকাল' },
    { key: 'noon', slot: 'দুপুর' },
    { key: 'evening', slot: 'সন্ধ্যা' },
    { key: 'night', slot: 'রাত' },
  ];

  const dosageStr = formatDosageStringBn(item.amountPerDose, item.unit);
  const schedules: DoseSchedule[] = [];

  for (const entry of slotMap) {
    if (item.schedule[entry.key]) {
      schedules.push({
        id: `slot-${entry.key}-${Math.random().toString(36).slice(2, 6)}`,
        timeSlot: entry.slot,
        time: item.slotTimes[entry.slot] || PRESCRIPTION_DEFAULT_SLOT_TIMES[entry.slot],
        dosage: dosageStr,
      });
    }
  }

  return schedules;
}

export function convertReviewItemToMedicinePayload(
  item: PrescriptionReviewItem,
  patientId?: string
): Omit<Medicine, 'id'> {
  const schedules = buildDoseSchedulesFromReviewItem(item);
  const effectiveSchedules: DoseSchedule[] =
    schedules.length > 0
      ? schedules
      : [
          {
            id: `slot-morning-${Math.random().toString(36).slice(2, 6)}`,
            timeSlot: 'সকাল',
            time: PRESCRIPTION_DEFAULT_SLOT_TIMES['সকাল'],
            dosage: formatDosageStringBn(item.amountPerDose, item.unit),
          },
        ];

  const cleanBrand = item.brandName.trim();
  const cleanGeneric = item.genericName.trim() || item.catalogMatch?.genericName || 'সাধারণ ওষুধ';
  const cleanStrength = item.strength.trim() || item.catalogMatch?.strength || 'নির্দিষ্ট মাত্রা';
  const safeDuration = Number.isFinite(item.durationDays) && item.durationDays > 0 ? Math.round(item.durationDays) : 7;
  const dailyUnits = Math.max(1, item.amountPerDose * effectiveSchedules.length);

  const payload: Omit<Medicine, 'id'> = {
    brandName: cleanBrand,
    genericName: cleanGeneric,
    type: item.dosageForm,
    strength: cleanStrength,
    mealTiming: item.mealTiming,
    schedules: effectiveSchedules,
    stock: Math.max(0, Math.round(item.stock)),
    minStockAlert: Math.max(2, Math.min(7, Math.ceil(dailyUnits * 2))),
    unit: item.unit || 'টি',
    startDate: toLocalIsoDate(new Date()),
    durationDays: safeDuration,
    isChronic: false,
    status: 'active',
    colorTag: 'teal',
  };

  if (patientId && patientId.trim()) {
    payload.assignedPatientId = patientId.trim();
  }
  if (item.doctorName.trim()) {
    payload.doctorName = item.doctorName.trim();
  }
  if (item.notes.trim()) {
    payload.instructions = item.notes.trim();
  }
  if (item.catalogMatch?.id) {
    payload.catalogMedicineId = item.catalogMatch.id;
  }
  if (item.catalogMatch?.packageDescription?.trim()) {
    payload.packageDescription = item.catalogMatch.packageDescription.trim();
  }

  return payload;
}

/**
 * Matches a detected patient name against existing non-archived profiles.
 * Never creates a new profile automatically.
 */
export function findSuggestedPatientMatch(
  detectedPatientName: string | null | undefined,
  patients: PatientProfile[]
): PatientProfile | undefined {
  const cleanDetected = (detectedPatientName || '').trim().toLowerCase();
  if (!cleanDetected || !patients || patients.length === 0) return undefined;

  const activePatients = patients.filter((p) => !p.isArchived);

  // Exact full-name match
  const exact = activePatients.find((p) => p.name.trim().toLowerCase() === cleanDetected);
  if (exact) return exact;

  // Substring / first-name token match (>= 3 chars)
  const detectedTokens = cleanDetected.split(/\s+/).filter((t) => t.length >= 3);
  return activePatients.find((p) => {
    const pName = p.name.trim().toLowerCase();
    if (pName.includes(cleanDetected) || cleanDetected.includes(pName)) return true;
    return detectedTokens.some((tok) => pName.includes(tok));
  });
}

/**
 * Finds selected prescription items that match an already-present medicine for the selected patient.
 */
export function findDuplicateMedicinesForPatient(
  selectedItems: PrescriptionReviewItem[],
  patientId: string | undefined,
  existingMedicines: Medicine[]
): Array<{ reviewItem: PrescriptionReviewItem; existingMedicine: Medicine }> {
  const patientMeds = existingMedicines.filter((m) =>
    patientId ? m.assignedPatientId === patientId : true
  );

  const duplicates: Array<{ reviewItem: PrescriptionReviewItem; existingMedicine: Medicine }> = [];

  for (const item of selectedItems) {
    const normNew = item.brandName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normNew) continue;

    const match = patientMeds.find((existing) => {
      const normExisting = existing.brandName.trim().toLowerCase().replace(/\s+/g, ' ');
      return normExisting === normNew;
    });

    if (match) {
      duplicates.push({ reviewItem: item, existingMedicine: match });
    }
  }

  return duplicates;
}
