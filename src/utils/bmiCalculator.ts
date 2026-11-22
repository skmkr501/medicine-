import { HealthRecord } from '../types';
import { normalizeExpenseDigits } from './expenseUtils';

export const MIN_HEIGHT_CM = 30;
export const MAX_HEIGHT_CM = 260;

export const BMI_PEDIATRIC_MESSAGE =
  'শিশুদের জন্য বয়স ও লিঙ্গভিত্তিক চার্ট দরকার, ডাক্তারের সাথে কথা বলুন';

export const BMI_LIMITATION_NOTE =
  'দ্রষ্টব্য: গর্ভবতী নারী, শরীরচর্চাবিদ ও অতিরিক্ত পেশিবহুল ব্যক্তির ক্ষেত্রে BMI সঠিক পরিমাপ না-ও হতে পারে।';

export const BMI_MANDATORY_DISCLAIMER =
  'এটি সাধারণ তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়।';

export type AsianBmiCategoryCode =
  | 'underweight'
  | 'normal'
  | 'overweight_risk'
  | 'obese';

export interface AsianBmiClassification {
  code: AsianBmiCategoryCode;
  labelBn: string;
  labelEn: string;
  markerPercent: number; // 0..100 for scale indicator
  badgeClass: string;
  barTextClass: string;
}

export function validateHeightCmInput(
  raw: string
): { valid: boolean; heightCm: number | undefined; error?: string } {
  const normalized = normalizeExpenseDigits(raw).trim();
  if (!normalized) {
    return { valid: true, heightCm: undefined };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return {
      valid: false,
      heightCm: undefined,
      error: 'উচ্চতা শুধুমাত্র সংখ্যায় লিখুন (সেমি)',
    };
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < MIN_HEIGHT_CM || num > MAX_HEIGHT_CM) {
    return {
      valid: false,
      heightCm: undefined,
      error: 'উচ্চতা ৩০ থেকে ২৬০ সেমির মধ্যে হতে হবে',
    };
  }
  return { valid: true, heightCm: Math.round(num * 10) / 10 };
}

export function parseNumericField(raw: string): number | null {
  const normalized = normalizeExpenseDigits(raw).trim();
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function feetInchesToCm(feet: number, inches: number): number {
  const safeFeet = Number.isFinite(feet) ? Math.max(0, feet) : 0;
  const safeInches = Number.isFinite(inches) ? Math.max(0, inches) : 0;
  const totalInches = safeFeet * 12 + safeInches;
  if (totalInches <= 0) return 0;
  return Math.round(totalInches * 2.54 * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  if (!Number.isFinite(cm) || cm <= 0) return { feet: 0, inches: 0 };
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

/**
 * Computes BMI = weight(kg) / height(m)^2 rounded to 1 decimal place.
 */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    weightKg > 500 ||
    heightCm < MIN_HEIGHT_CM ||
    heightCm > MAX_HEIGHT_CM
  ) {
    return null;
  }
  const heightM = heightCm / 100;
  const raw = weightKg / (heightM * heightM);
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw * 10) / 10;
}

export function isPediatricAge(age?: number | null): boolean {
  return typeof age === 'number' && Number.isFinite(age) && age >= 0 && age < 18;
}

/**
 * WHO Asian Adult BMI cutoffs (>= 18 years):
 * < 18.5: কম ওজন
 * 18.5 - 22.9: স্বাভাবিক
 * 23.0 - 24.9: বেশি ওজনের ঝুঁকি
 * >= 25.0: স্থূলতা
 */
export function classifyAsianAdultBmi(bmi: number): AsianBmiClassification {
  // Position on a 4-segment visual scale spanning 14 to 31
  // Segments: [14..18.5] = 0..25%, [18.5..23.0] = 25..50%, [23.0..25.0] = 50..75%, [25.0..31.0] = 75..100%
  let markerPercent = 0;
  if (bmi < 18.5) {
    const ratio = Math.max(0, Math.min(1, (bmi - 14) / (18.5 - 14)));
    markerPercent = ratio * 25;
    return {
      code: 'underweight',
      labelBn: 'কম ওজন',
      labelEn: 'Underweight',
      markerPercent: Math.round(markerPercent * 10) / 10,
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
      barTextClass: 'text-sky-700 dark:text-sky-300',
    };
  }
  if (bmi <= 22.9) {
    const ratio = Math.max(0, Math.min(1, (bmi - 18.5) / (23.0 - 18.5)));
    markerPercent = 25 + ratio * 25;
    return {
      code: 'normal',
      labelBn: 'স্বাভাবিক',
      labelEn: 'Normal',
      markerPercent: Math.round(markerPercent * 10) / 10,
      badgeClass: 'bg-success-soft text-success-text border-success/40',
      barTextClass: 'text-success-text',
    };
  }
  if (bmi <= 24.9) {
    const ratio = Math.max(0, Math.min(1, (bmi - 23.0) / (25.0 - 23.0)));
    markerPercent = 50 + ratio * 25;
    return {
      code: 'overweight_risk',
      labelBn: 'বেশি ওজনের ঝুঁকি',
      labelEn: 'Overweight Risk',
      markerPercent: Math.round(markerPercent * 10) / 10,
      badgeClass: 'bg-warning-soft text-warning-text border-warning/40',
      barTextClass: 'text-warning-text',
    };
  }
  const ratio = Math.max(0, Math.min(1, (bmi - 25.0) / (31.0 - 25.0)));
  markerPercent = 75 + ratio * 25;
  return {
    code: 'obese',
    labelBn: 'স্থূলতা',
    labelEn: 'Obese',
    markerPercent: Math.round(markerPercent * 10) / 10,
    badgeClass: 'bg-danger-soft text-danger-text border-danger/40',
    barTextClass: 'text-danger-text',
  };
}

/**
 * Healthy weight range (kg) corresponding to Asian Normal BMI (18.5 - 22.9).
 */
export function calculateHealthyWeightRangeKg(
  heightCm: number
): { minKg: number; maxKg: number } | null {
  if (!Number.isFinite(heightCm) || heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return null;
  }
  const m = heightCm / 100;
  const minKg = Math.round(18.5 * m * m * 10) / 10;
  const maxKg = Math.round(22.9 * m * m * 10) / 10;
  return { minKg, maxKg };
}

export interface BmiHistoryPoint {
  id: string;
  recordDate: string;
  weightKg: number;
  bmi: number;
}

export function buildBmiHistorySeries(
  healthRecords: HealthRecord[],
  patientId: string | undefined,
  heightCm: number | undefined
): BmiHistoryPoint[] {
  if (!heightCm || !Number.isFinite(heightCm) || heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return [];
  }
  const filtered = healthRecords
    .filter((r) => (!patientId || r.patientId === patientId) && typeof r.weight === 'number' && r.weight > 0)
    .slice()
    .sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());

  const points: BmiHistoryPoint[] = [];
  for (const r of filtered) {
    const bmi = calculateBmi(r.weight!, heightCm);
    if (bmi !== null) {
      points.push({
        id: r.id,
        recordDate: r.recordDate,
        weightKg: r.weight!,
        bmi,
      });
    }
  }
  return points;
}
