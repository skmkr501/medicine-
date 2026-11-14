import { GlobalMedicine, Medicine, PatientProfile } from '../types';
import { formatBengaliDate, toBengaliNumber } from './bengaliUtils';
import { calculateDailyConsumption } from './stockPredictor';

export type DurationPresetKey = '7d' | '15d' | '30d' | '3m' | 'custom';

export interface ParsedPackageInfo {
  unitsPerPack: number;
  packUnitBn: string;
}

export type PriceSourceType = 'user' | 'library' | 'none';
export type CatalogMatchType = 'catalog_id' | 'brand_strength' | 'none';

export interface CatalogMatchResult {
  medicine: GlobalMedicine | undefined;
  matchType: CatalogMatchType;
}

export interface ShoppingCostSummary {
  activeToBuyCount: number;
  excludedCount: number;
  pricedCount: number;
  missingPriceCount: number;
  totalEstimatedCost: number;
}

export interface ShoppingListNeedItem {
  medicine: Medicine;
  patientName: string;
  dailyUsage: number;
  currentStock: number;
  unit: string;
  requiredUnits: number;
  toBuyUnits: number;
  daysRemaining: number;
  estimatedRunOutDate: Date;
  estimatedRunOutDateStr: string;
  packInfo: ParsedPackageInfo | null;
  estimatedPacks: number | null;
  packSummaryBn: string | null;
  unitPrice: number | null;
  priceSource: PriceSourceType;
  estimatedCost: number | null;
  matchedCatalogId?: string;
  catalogMatchType: CatalogMatchType;
  expiryDate?: string;
  expiryDateFormattedBn?: string;
  expiresBeforeTarget: boolean;
  expiryWarningBn?: string;
  needsExpiryReplacementOnly: boolean;
}

export interface ShoppingListSufficientItem {
  medicine: Medicine;
  patientName: string;
  dailyUsage: number;
  currentStock: number;
  unit: string;
  requiredUnits: number;
  daysRemaining: number;
  estimatedRunOutDate: Date;
  estimatedRunOutDateStr: string;
  statusLabelBn: 'পর্যাপ্ত আছে ✓';
}

export interface ShoppingListAsNeededItem {
  medicine: Medicine;
  patientName: string;
  currentStock: number;
  unit: string;
  expiryDate?: string;
  expiryDateFormattedBn?: string;
  expiresBeforeTarget: boolean;
  expiryWarningBn?: string;
  noteBn: string;
}

export interface ShoppingListInput {
  medicines: Medicine[];
  patients: PatientProfile[];
  globalMedicines?: GlobalMedicine[];
  selectedPatientId: string | 'all';
  targetDate: Date | string;
  includeBuffer: boolean;
  referenceDate?: Date;
}

export interface ShoppingListResult {
  startDate: Date;
  startDateIso: string;
  startDateBn: string;
  targetDate: Date;
  targetDateIso: string;
  targetDateBn: string;
  daysCount: number;
  bufferDays: number;
  effectiveDays: number;
  patientLabelBn: string;
  patientAge?: number;
  isValidDateRange: boolean;
  toBuyItems: ShoppingListNeedItem[];
  sufficientItems: ShoppingListSufficientItem[];
  asNeededItems: ShoppingListAsNeededItem[];
  totalActiveMedicinesConsidered: number;
}

const BENGALI_TO_ENGLISH_DIGITS: Record<string, string> = {
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

function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (ch) => BENGALI_TO_ENGLISH_DIGITS[ch] || ch);
}

/**
 * Normalizes a Date to local midnight (00:00:00.000) to avoid timezone drift.
 */
export function normalizeLocalDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Formats a Date as YYYY-MM-DD in local time.
 */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string safely into a local midnight Date.
 */
export function parseLocalIsoDate(iso?: string): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Adds a number of days to a local Date without mutating the input.
 */
export function addLocalDays(date: Date, days: number): Date {
  const d = normalizeLocalDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns exact calendar day difference (endDate - startDate) in days.
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const start = normalizeLocalDate(startDate);
  const end = normalizeLocalDate(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Maps quick preset keys to target Dates relative to referenceDate.
 */
export function getTargetDateForPreset(
  preset: Exclude<DurationPresetKey, 'custom'>,
  referenceDate: Date = new Date()
): Date {
  const today = normalizeLocalDate(referenceDate);
  switch (preset) {
    case '7d':
      return addLocalDays(today, 7);
    case '15d':
      return addLocalDays(today, 15);
    case '30d':
      return addLocalDays(today, 30);
    case '3m':
      return addLocalDays(today, 90);
  }
}

/**
 * Formats fractional or integer unit quantities cleanly in Bengali (e.g. 1.5 -> "১.৫", 2 -> "২").
 */
export function formatQuantityBn(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return toBengaliNumber(rounded);
}

/**
 * Formats an amount in Bangladeshi Taka with Bengali numerals (e.g. 120 -> "৳১২০", 12.5 -> "৳১২.৫০").
 */
export function formatTakaBn(amount: number): string {
  const safe = typeof amount === 'number' && !Number.isNaN(amount) ? Math.max(0, amount) : 0;
  const rounded = Math.round(safe * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `৳${toBengaliNumber(rounded)}`;
  }
  return `৳${toBengaliNumber(rounded.toFixed(2))}`;
}

export function normalizeDigitsInput(text: string): string {
  return normalizeDigits(text).trim();
}

/**
 * Strictly parses pack/strip size ONLY from explicit package descriptions.
 * Never fabricates or guesses strip sizes when no pack metadata exists.
 */
export function parsePackageSize(
  packageDescription?: string,
  medicineUnit: string = 'টি'
): ParsedPackageInfo | null {
  if (!packageDescription || !packageDescription.trim()) return null;

  const normalized = normalizeDigits(packageDescription).trim().toLowerCase();
  const unitTrimmed = (medicineUnit || 'টি').trim().toLowerCase();
  const isLiquidMlUnit = unitTrimmed === 'মিলি' || unitTrimmed === 'ml';
  const isCountUnit =
    unitTrimmed === 'টি' ||
    unitTrimmed === 'pcs' ||
    unitTrimmed === 'tablet' ||
    unitTrimmed === 'tablets' ||
    unitTrimmed === 'capsule' ||
    unitTrimmed === 'capsules' ||
    unitTrimmed === '';

  // 1. Bottle volume pattern: e.g. "100 ml bottle" or "60ml বোতল" (only when tracked unit is ml/মিলি)
  if (isLiquidMlUnit) {
    const mlBottleMatch = normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:ml|মিলি)[^\d]*(?:bottle|বোতল|vial|drop|ড্রপ|syrup|সিরাপ)?/i
    );
    if (mlBottleMatch) {
      const vol = parseFloat(mlBottleMatch[1]);
      if (!isNaN(vol) && vol > 0) {
        const isDrop = normalized.includes('drop') || normalized.includes('ড্রপ');
        return {
          unitsPerPack: vol,
          packUnitBn: isDrop ? 'বোতল/ড্রপার' : 'বোতল',
        };
      }
    }
    return null;
  }

  // Only estimate tablet/capsule strip/pack counts when medicine unit is discrete count ('টি' etc.)
  if (!isCountUnit) {
    return null;
  }

  // 2. Box x Strip pattern like "3x10's" or "2 x 15" -> per-strip size is the second number (> 1)
  const multiStripMatch = normalized.match(
    /(\d+)\s*[x×]\s*(\d+)\s*(?:'s|s|টি|পিস|pcs|tabs?|caps?|tablets?|capsules?|ট্যাবলেট|ক্যাপসুল|strip|পাতা)?/i
  );
  if (multiStripMatch) {
    const perStrip = parseInt(multiStripMatch[2], 10);
    if (!isNaN(perStrip) && perStrip > 1) {
      return { unitsPerPack: perStrip, packUnitBn: 'পাতা' };
    }
  }

  // 3. Explicit strip/blister pattern: "10 tablets/strip", "10's strip", "১০টি/পাতা", "১০টি ট্যাবলেট/পাতা", "14 tabs per strip"
  const stripMatch = normalized.match(
    /(\d+)\s*(?:(?:'s|টি|পিস|pcs|tablets?|tabs?|capsules?|caps?|ট্যাবলেট|ক্যাপসুল)\s*)*(?:\/|per|প্রতি|ইন|in|এর)?\s*(?:strip|blister|পাতা)/i
  );
  if (stripMatch) {
    const count = parseInt(stripMatch[1], 10);
    if (!isNaN(count) && count > 1) {
      return { unitsPerPack: count, packUnitBn: 'পাতা' };
    }
  }

  // 4. Reverse strip pattern: "strip of 10", "পাতা ১০টি"
  const reverseStripMatch = normalized.match(/(?:strip\s*of|পাতা)\s*(\d+)/i);
  if (reverseStripMatch) {
    const count = parseInt(reverseStripMatch[1], 10);
    if (!isNaN(count) && count > 1) {
      return { unitsPerPack: count, packUnitBn: 'পাতা' };
    }
  }

  // 5. Explicit pack/box count: "30 tablets/box", "10's pack", "৩০টি/বক্স", "৩০টি ট্যাবলেট/বক্স"
  const packMatch = normalized.match(
    /(\d+)\s*(?:(?:'s|টি|পিস|pcs|tablets?|tabs?|capsules?|caps?|ট্যাবলেট|ক্যাপসুল)\s*)*(?:\/|per|প্রতি|এর)?\s*(?:pack|box|প্যাক|প্যাকেট|বক্স)/i
  );
  if (packMatch) {
    const count = parseInt(packMatch[1], 10);
    if (!isNaN(count) && count > 1) {
      return { unitsPerPack: count, packUnitBn: 'প্যাকেট' };
    }
  }

  return null;
}

function normalizeBrandForMatch(brand?: string): string {
  return (brand || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStrengthForMatch(strength?: string): string {
  return (strength || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Matches a personal medicine against the already-loaded local medicine library
 * without making any Firestore reads:
 * 1. Exact catalogMedicineId match (if stored on the personal medicine)
 * 2. Fallback: normalized brandName + strength match
 */
export function findMatchingCatalogMedicine(
  med: Medicine,
  globalMedicines?: GlobalMedicine[]
): CatalogMatchResult {
  if (!globalMedicines || globalMedicines.length === 0) {
    return { medicine: undefined, matchType: 'none' };
  }

  if (med.catalogMedicineId && med.catalogMedicineId.trim()) {
    const byId = globalMedicines.find((gm) => gm.id === med.catalogMedicineId);
    if (byId) {
      return { medicine: byId, matchType: 'catalog_id' };
    }
  }

  const normBrand = normalizeBrandForMatch(med.brandName);
  if (!normBrand) {
    return { medicine: undefined, matchType: 'none' };
  }
  const normStrength = normalizeStrengthForMatch(med.strength);

  const candidates = globalMedicines.filter((gm) => {
    const gmBrand = normalizeBrandForMatch(gm.brandName);
    const gmBrandBn = normalizeBrandForMatch(gm.brandNameBn);
    const brandMatches = gmBrand === normBrand || (gmBrandBn !== '' && gmBrandBn === normBrand);
    if (!brandMatches) return false;

    const gmStrength = normalizeStrengthForMatch(gm.strength);
    if (normStrength) {
      return gmStrength === normStrength;
    }
    return gmStrength === '';
  });

  if (candidates.length === 0) {
    return { medicine: undefined, matchType: 'none' };
  }

  candidates.sort((a, b) => {
    const score = (item: GlobalMedicine) =>
      (item.status === 'published' ? 4 : 0) +
      (typeof item.pricePerUnit === 'number' && !Number.isNaN(item.pricePerUnit) && item.pricePerUnit > 0 ? 2 : 0) +
      (item.packageDescription && item.packageDescription.trim() ? 1 : 0);
    return score(b) - score(a);
  });

  return { medicine: candidates[0], matchType: 'brand_strength' };
}

export function countCatalogMedicinesWithPrice(globalMedicines?: GlobalMedicine[]): number {
  if (!globalMedicines || globalMedicines.length === 0) return 0;
  return globalMedicines.filter(
    (gm) => typeof gm.pricePerUnit === 'number' && !Number.isNaN(gm.pricePerUnit) && gm.pricePerUnit > 0
  ).length;
}

export function calculateShoppingCostSummary(
  toBuyItems: ShoppingListNeedItem[],
  excludedIds?: Set<string> | string[]
): ShoppingCostSummary {
  const excludedSet =
    excludedIds instanceof Set
      ? excludedIds
      : Array.isArray(excludedIds)
      ? new Set(excludedIds)
      : new Set<string>();

  let activeToBuyCount = 0;
  let excludedCount = 0;
  let pricedCount = 0;
  let missingPriceCount = 0;
  let totalEstimatedCost = 0;

  for (const item of toBuyItems) {
    if (excludedSet.has(item.medicine.id)) {
      excludedCount += 1;
      continue;
    }
    activeToBuyCount += 1;
    if (item.estimatedCost !== null && typeof item.estimatedCost === 'number' && !Number.isNaN(item.estimatedCost)) {
      pricedCount += 1;
      totalEstimatedCost += item.estimatedCost;
    } else if (item.unitPrice !== null && item.toBuyUnits === 0) {
      // Expiry replacement only with unit price known, 0 units to compute
      pricedCount += 1;
    } else {
      missingPriceCount += 1;
    }
  }

  return {
    activeToBuyCount,
    excludedCount,
    pricedCount,
    missingPriceCount,
    totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
  };
}

/**
 * Computes the complete medicine shopping list from active medicines, current stock,
 * daily schedules, target date, optional 2-day buffer, and expiry checks.
 */
export function calculateMedicineShoppingList(
  input: ShoppingListInput
): ShoppingListResult {
  const today = normalizeLocalDate(input.referenceDate ?? new Date());
  const startDateIso = toLocalIsoDate(today);
  const startDateBn = formatBengaliDate(today);

  const parsedTarget =
    typeof input.targetDate === 'string'
      ? parseLocalIsoDate(input.targetDate) ?? today
      : normalizeLocalDate(input.targetDate);

  const rawDaysDiff = calculateDaysBetween(today, parsedTarget);
  const isValidDateRange = rawDaysDiff >= 1;
  const daysCount = Math.max(1, rawDaysDiff);
  const bufferDays = input.includeBuffer ? 2 : 0;
  const effectiveDays = daysCount + bufferDays;

  const patientMap = new Map<string, PatientProfile>();
  for (const p of input.patients) {
    patientMap.set(p.id, p);
  }

  const selectedPatient =
    input.selectedPatientId !== 'all'
      ? patientMap.get(input.selectedPatientId)
      : undefined;

  const patientLabelBn =
    input.selectedPatientId === 'all'
      ? 'সবার জন্য'
      : selectedPatient
      ? `${selectedPatient.name} (${selectedPatient.relation})`
      : 'নির্দিষ্ট রোগী';

  const patientAge =
    selectedPatient && typeof selectedPatient.age === 'number' && !isNaN(selectedPatient.age)
      ? selectedPatient.age
      : undefined;

  // Filter active medicines matching the selected patient (skipping archived patients when 'all')
  const candidateMedicines = input.medicines.filter((med) => {
    if (med.status !== 'active') return false;
    if (input.selectedPatientId === 'all') {
      if (med.assignedPatientId) {
        const assigned = patientMap.get(med.assignedPatientId);
        if (assigned?.isArchived) return false;
      }
      return true;
    }
    return med.assignedPatientId === input.selectedPatientId;
  });

  const toBuyItems: ShoppingListNeedItem[] = [];
  const sufficientItems: ShoppingListSufficientItem[] = [];
  const asNeededItems: ShoppingListAsNeededItem[] = [];

  for (const med of candidateMedicines) {
    const unit = (med.unit || 'টি').trim() || 'টি';
    const currentStock =
      typeof med.stock === 'number' && !isNaN(med.stock) ? Math.max(0, med.stock) : 0;
    const assignedPatient = med.assignedPatientId
      ? patientMap.get(med.assignedPatientId)
      : undefined;
    const patientName = assignedPatient
      ? assignedPatient.name
      : 'সাধারণ';

    const expiryObj = parseLocalIsoDate(med.expiryDate);
    const expiresBeforeTarget = Boolean(
      expiryObj && expiryObj.getTime() < parsedTarget.getTime()
    );
    const expiryDateFormattedBn = expiryObj ? formatBengaliDate(expiryObj) : undefined;
    const expiryWarningBn = expiresBeforeTarget
      ? 'এই তারিখের আগেই মেয়াদ শেষ হবে, নতুন প্যাকেট কিনুন'
      : undefined;

    const isExplicitPrn = med.mealTiming === 'প্রয়োজনমতো';
    const hasSchedules = Array.isArray(med.schedules) && med.schedules.length > 0;
    const dailyUsage = hasSchedules && !isExplicitPrn
      ? calculateDailyConsumption(med.schedules)
      : 0;

    if (isExplicitPrn || !hasSchedules || dailyUsage <= 0) {
      asNeededItems.push({
        medicine: med,
        patientName,
        currentStock,
        unit,
        expiryDate: med.expiryDate,
        expiryDateFormattedBn,
        expiresBeforeTarget,
        expiryWarningBn,
        noteBn: 'নিজে হিসাব করুন',
      });
      continue;
    }

    const requiredUnits = Math.round(dailyUsage * effectiveDays * 100) / 100;
    const shortfall = Math.max(0, requiredUnits - currentStock);
    const toBuyUnits = shortfall > 0 ? Math.ceil(shortfall) : 0;

    const daysRemaining = currentStock > 0 ? Math.floor(currentStock / dailyUsage) : 0;
    const estimatedRunOutDate =
      currentStock > 0 ? addLocalDays(today, daysRemaining) : today;
    const estimatedRunOutDateStr =
      currentStock <= 0
        ? 'স্টক শেষ (আজ)'
        : formatBengaliDate(estimatedRunOutDate);

    if (toBuyUnits > 0 || expiresBeforeTarget) {
      const catalogMatch = findMatchingCatalogMedicine(med, input.globalMedicines);
      const packDesc =
        med.packageDescription?.trim() || catalogMatch.medicine?.packageDescription?.trim();
      const packInfo = parsePackageSize(packDesc, unit);

      let estimatedPacks: number | null = null;
      let packSummaryBn: string | null = null;

      if (toBuyUnits > 0 && packInfo) {
        if (toBuyUnits < packInfo.unitsPerPack) {
          estimatedPacks = 1;
          packSummaryBn =
            packInfo.packUnitBn === 'পাতা'
              ? '১ পাতার কম'
              : `১ ${packInfo.packUnitBn}-এর কম`;
        } else {
          const packsNeeded = Math.ceil(toBuyUnits / packInfo.unitsPerPack);
          const isLiquidBottle =
            packInfo.packUnitBn === 'বোতল' || packInfo.packUnitBn === 'বোতল/ড্রপার';
          if (isLiquidBottle || packsNeeded < toBuyUnits) {
            estimatedPacks = packsNeeded;
            packSummaryBn = `প্রায় ${toBengaliNumber(packsNeeded)} ${packInfo.packUnitBn}`;
          }
        }
      }

      const userPrice =
        typeof med.pricePerUnit === 'number' &&
        !Number.isNaN(med.pricePerUnit) &&
        med.pricePerUnit > 0
          ? med.pricePerUnit
          : null;
      const libraryPrice =
        catalogMatch.medicine &&
        typeof catalogMatch.medicine.pricePerUnit === 'number' &&
        !Number.isNaN(catalogMatch.medicine.pricePerUnit) &&
        catalogMatch.medicine.pricePerUnit > 0
          ? catalogMatch.medicine.pricePerUnit
          : null;

      const unitPrice = userPrice ?? libraryPrice ?? null;
      const priceSource: PriceSourceType =
        userPrice !== null ? 'user' : libraryPrice !== null ? 'library' : 'none';
      const estimatedCost =
        toBuyUnits > 0 && unitPrice !== null
          ? Math.round(toBuyUnits * unitPrice * 100) / 100
          : null;

      toBuyItems.push({
        medicine: med,
        patientName,
        dailyUsage,
        currentStock,
        unit,
        requiredUnits,
        toBuyUnits,
        daysRemaining,
        estimatedRunOutDate,
        estimatedRunOutDateStr,
        packInfo,
        estimatedPacks,
        packSummaryBn,
        unitPrice,
        priceSource,
        estimatedCost,
        matchedCatalogId: catalogMatch.medicine?.id,
        catalogMatchType: catalogMatch.matchType,
        expiryDate: med.expiryDate,
        expiryDateFormattedBn,
        expiresBeforeTarget,
        expiryWarningBn,
        needsExpiryReplacementOnly: toBuyUnits === 0 && expiresBeforeTarget,
      });
    } else {
      sufficientItems.push({
        medicine: med,
        patientName,
        dailyUsage,
        currentStock,
        unit,
        requiredUnits,
        daysRemaining,
        estimatedRunOutDate,
        estimatedRunOutDateStr,
        statusLabelBn: 'পর্যাপ্ত আছে ✓',
      });
    }
  }

  // Sort urgent items by soonest run-out first ("অগ্রাধিকারে আগে যেগুলো সবচেয়ে আগে শেষ হবে")
  toBuyItems.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) {
      return a.daysRemaining - b.daysRemaining;
    }
    if (a.expiresBeforeTarget !== b.expiresBeforeTarget) {
      return a.expiresBeforeTarget ? -1 : 1;
    }
    return b.toBuyUnits - a.toBuyUnits;
  });

  sufficientItems.sort((a, b) => a.daysRemaining - b.daysRemaining);
  asNeededItems.sort((a, b) => {
    if (a.expiresBeforeTarget !== b.expiresBeforeTarget) {
      return a.expiresBeforeTarget ? -1 : 1;
    }
    return a.medicine.brandName.localeCompare(b.medicine.brandName);
  });

  return {
    startDate: today,
    startDateIso,
    startDateBn,
    targetDate: parsedTarget,
    targetDateIso: toLocalIsoDate(parsedTarget),
    targetDateBn: formatBengaliDate(parsedTarget),
    daysCount,
    bufferDays,
    effectiveDays,
    patientLabelBn,
    patientAge,
    isValidDateRange,
    toBuyItems,
    sufficientItems,
    asNeededItems,
    totalActiveMedicinesConsidered: candidateMedicines.length,
  };
}
