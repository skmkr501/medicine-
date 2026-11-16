import {
  DoseLog,
  MealTiming,
  Medicine,
  TimeSlot,
  WeekStartDay,
} from '../types';
import { toBengaliNumber } from './bengaliUtils';
import {
  TIME_BUCKET_DEFINITIONS,
  TIME_BUCKET_ORDER,
  TimeBucketKey,
  classifyTimeBucket,
  formatShortClockBn,
  formatShortMealTimingBn,
  getBucketSortMinutes,
} from './dailyScheduleSummary';
import {
  addLocalDays,
  normalizeLocalDate,
  parseLocalIsoDate,
  toLocalIsoDate,
} from './shoppingListCalculator';
import { parseDosageUnits } from './stockPredictor';

const WEEKDAY_SHORT_BN: Record<number, string> = {
  0: 'রবি',
  1: 'সোম',
  2: 'মঙ্গল',
  3: 'বুধ',
  4: 'বৃহঃ',
  5: 'শুক্র',
  6: 'শনি',
};

const WEEKDAY_FULL_BN: Record<number, string> = {
  0: 'রবিবার',
  1: 'সোমবার',
  2: 'মঙ্গলবার',
  3: 'বুধবার',
  4: 'বৃহস্পতিবার',
  5: 'শুক্রবার',
  6: 'শনিবার',
};

const MONTH_BN: string[] = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const WEEK_START_DAY_INDEX: Record<WeekStartDay, number> = {
  saturday: 6,
  sunday: 0,
  monday: 1,
};

export interface PillboxWeekDay {
  date: Date;
  iso: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  weekdayShortBn: string;
  weekdayFullBn: string;
  dayNumberBn: string;
  monthBn: string;
  shortDateBn: string; // e.g. "১৫ নভে" or "১৫ নভেম্বর"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface PillboxDoseItem {
  key: string;
  medicineId: string;
  brandName: string;
  genericName: string;
  strength: string;
  type: Medicine['type'];
  dosage: string;
  unit: string;
  chipLabel: string; // compact e.g. "Napa ১"
  timeSlot: TimeSlot;
  rawTime: string;
  clockTimeBn: string;
  sortMinutes: number;
  mealTiming: MealTiming;
  shortMealTimingBn: string;
  instructions?: string;
  logStatus?: 'taken' | 'missed'; // strictly from DoseLog; undefined if no log exists
}

export interface PillboxRow {
  key: TimeBucketKey;
  emoji: string;
  titleBn: string;
  rangeLabelBn: string;
  headerBgPrint: string;
  cellsByDayIso: Record<string, PillboxDoseItem[]>;
}

export interface PillboxAsNeededItem {
  medicineId: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageHint: string;
  instructions?: string;
}

export interface PillboxWeeklyMedicineTotal {
  medicineId: string;
  brandName: string;
  strength: string;
  unit: string;
  totalUnits: number;
  doseCount: number;
  summaryLabelBn: string; // e.g. "Napa Extend — ২১টি"
}

export interface WeeklyPillboxData {
  weekStartDay: WeekStartDay;
  weekStartIso: string;
  weekEndIso: string;
  weekRangeBn: string;
  days: PillboxWeekDay[];
  visibleRows: PillboxRow[];
  asNeededItems: PillboxAsNeededItem[];
  weeklyTotals: PillboxWeeklyMedicineTotal[];
  totalScheduledDosesInWeek: number;
}

/**
 * Returns local midnight Date for the start of the week containing `referenceDate`.
 */
export function getWeekStartDate(
  referenceDate: Date | string = new Date(),
  weekStartDay: WeekStartDay = 'saturday'
): Date {
  const ref =
    typeof referenceDate === 'string'
      ? parseLocalIsoDate(referenceDate) ?? normalizeLocalDate(new Date())
      : normalizeLocalDate(referenceDate);

  const targetDay = WEEK_START_DAY_INDEX[weekStartDay] ?? 6;
  const currentDay = ref.getDay();
  const diff = (currentDay - targetDay + 7) % 7;
  return addLocalDays(ref, -diff);
}

export function addWeeksToLocalDate(date: Date, offsetWeeks: number): Date {
  return addLocalDays(normalizeLocalDate(date), offsetWeeks * 7);
}

/**
 * Generates the 7 ordered day objects for a week starting at `weekStartDate`.
 */
export function getWeekDays(
  weekStartDate: Date,
  todayStr?: string
): PillboxWeekDay[] {
  const todayMidnight = todayStr
    ? parseLocalIsoDate(todayStr) ?? normalizeLocalDate(new Date())
    : normalizeLocalDate(new Date());
  const todayIso = toLocalIsoDate(todayMidnight);
  const start = normalizeLocalDate(weekStartDate);

  const days: PillboxWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addLocalDays(start, i);
    const iso = toLocalIsoDate(d);
    const dayOfWeek = d.getDay();
    const dayNum = toBengaliNumber(d.getDate());
    const monthBn = MONTH_BN[d.getMonth()] || '';

    days.push({
      date: d,
      iso,
      dayOfWeek,
      weekdayShortBn: WEEKDAY_SHORT_BN[dayOfWeek] || '',
      weekdayFullBn: WEEKDAY_FULL_BN[dayOfWeek] || '',
      dayNumberBn: dayNum,
      monthBn,
      shortDateBn: `${dayNum} ${monthBn}`,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      isFuture: iso > todayIso,
    });
  }
  return days;
}

/**
 * Formats a 7-day range into clean Bengali, e.g.
 * "১৫ – ২১ নভেম্বর ২০২৬" or "২৮ নভেম্বর – ৪ ডিসেম্বর ২০২৬".
 */
export function formatWeekRangeBn(days: PillboxWeekDay[]): string {
  if (days.length === 0) return '';
  const first = days[0].date;
  const last = days[days.length - 1].date;

  const firstDay = toBengaliNumber(first.getDate());
  const lastDay = toBengaliNumber(last.getDate());
  const firstMonth = MONTH_BN[first.getMonth()] || '';
  const lastMonth = MONTH_BN[last.getMonth()] || '';
  const firstYear = toBengaliNumber(first.getFullYear());
  const lastYear = toBengaliNumber(last.getFullYear());

  if (first.getFullYear() !== last.getFullYear()) {
    return `${firstDay} ${firstMonth} ${firstYear} – ${lastDay} ${lastMonth} ${lastYear}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth} ${lastYear}`;
  }
  return `${firstDay} – ${lastDay} ${lastMonth} ${lastYear}`;
}

/**
 * Checks whether a medicine is scheduled to be active on a specific local midnight date,
 * enforcing status === 'active', startDate, expiryDate, and finite durationDays.
 */
export function isMedicineScheduledOnLocalDate(
  med: Medicine,
  targetMidnight: Date
): boolean {
  if (med.status !== 'active') return false;

  const targetTime = normalizeLocalDate(targetMidnight).getTime();

  if (med.expiryDate) {
    const exp = parseLocalIsoDate(med.expiryDate);
    if (exp && targetTime > exp.getTime()) return false;
  }

  const start = parseLocalIsoDate(med.startDate);
  if (start) {
    if (targetTime < start.getTime()) return false;
    if (!med.isChronic && med.durationDays && med.durationDays > 0) {
      const courseEndExclusive = addLocalDays(start, Math.ceil(med.durationDays));
      if (targetTime >= courseEndExclusive.getTime()) return false;
    }
  }

  return true;
}

/**
 * Extracts compact Bengali quantity text from a dosage string (e.g. "১টি" -> "১", "১/২টি" -> "১/২", "৫ মিলি" -> "৫ মিলি").
 */
export function formatCompactDosageBn(dosage?: string): string {
  const raw = (dosage || '').trim();
  if (!raw) return '১';

  // Strip common countable suffixes like "টি", "টা", "pc", "pcs", "tab", "tablet", "cap", "capsule"
  const strippedUnit = raw
    .replace(/\s*(টি|টা|পিস|pieces?|pcs?|tablets?|tabs?|capsules?|caps?)\b/gi, '')
    .replace(/(টি|টা)$/g, '')
    .trim();

  const source = strippedUnit || raw;
  // Convert any ASCII digits inside to Bengali digits
  return source.replace(/\d/g, (d) => toBengaliNumber(Number(d)));
}

/**
 * Produces a short chip label for tight pillbox cells, e.g. "Napa ১" or "Napa Extend ১".
 */
export function formatShortMedicineChipLabel(
  brandName: string,
  dosage?: string,
  maxBrandChars = 13
): string {
  const cleanBrand = (brandName || '').trim();
  const shortBrand =
    cleanBrand.length > maxBrandChars
      ? `${cleanBrand.slice(0, maxBrandChars - 1).trim()}…`
      : cleanBrand;

  const compactQty = formatCompactDosageBn(dosage);
  return compactQty ? `${shortBrand} ${compactQty}` : shortBrand;
}

function formatTotalQuantityBn(totalUnits: number, unit: string): string {
  const rounded = Math.round(totalUnits * 100) / 100;
  const numStr = Number.isInteger(rounded)
    ? toBengaliNumber(rounded)
    : toBengaliNumber(Number(rounded.toFixed(1)));
  const cleanUnit = (unit || 'টি').trim();
  return `${numStr}${cleanUnit}`;
}

/**
 * Builds the entire Weekly Pillbox view model strictly in-memory from already-loaded context data.
 * Zero Firestore reads or listeners.
 * Past ✓/✗ indicators strictly come from matching DoseLog entries; unlogged dates have logStatus = undefined.
 */
export function buildWeeklyPillbox(params: {
  medicines: Medicine[];
  doseLogs: DoseLog[];
  patientId?: string | null;
  weekStartDate: Date;
  weekStartDay?: WeekStartDay;
  todayStr?: string;
}): WeeklyPillboxData {
  const {
    medicines,
    doseLogs,
    patientId = null,
    weekStartDate,
    weekStartDay = 'saturday',
    todayStr,
  } = params;

  const days = getWeekDays(weekStartDate, todayStr);
  const weekRangeBn = formatWeekRangeBn(days);

  // Scope medicines strictly to active profile if selected
  const scopedMedicines = medicines.filter((m) =>
    patientId ? m.assignedPatientId === patientId : true
  );

  // Pre-index DoseLogs for O(1) exact lookup: `${medicineId}|${scheduledDate}|${timeSlot}`
  // Strictly respects patient scope if patientId is selected and log carries patientId
  const logStatusMap = new Map<string, 'taken' | 'missed'>();
  for (const log of doseLogs) {
    if (patientId && log.patientId && log.patientId !== patientId) continue;
    const key = `${log.medicineId}|${log.scheduledDate}|${log.timeSlot}`;
    const mapped: 'taken' | 'missed' = log.status === 'taken' ? 'taken' : 'missed';
    // Prefer 'taken' if multiple logs happen to exist for same slot/date
    const existing = logStatusMap.get(key);
    if (!existing || mapped === 'taken') {
      logStatusMap.set(key, mapped);
    }
  }

  // Initialize cell grid per time bucket
  const gridCells: Record<TimeBucketKey, Record<string, PillboxDoseItem[]>> = {
    morning: {},
    noon: {},
    evening: {},
    night: {},
  };
  for (const bucketKey of TIME_BUCKET_ORDER) {
    for (const day of days) {
      gridCells[bucketKey][day.iso] = [];
    }
  }

  const asNeededMap = new Map<string, PillboxAsNeededItem>();
  const totalsMap = new Map<
    string,
    {
      medicineId: string;
      brandName: string;
      strength: string;
      unit: string;
      totalUnits: number;
      doseCount: number;
    }
  >();

  for (const med of scopedMedicines) {
    if (med.status !== 'active') continue;

    const isAsNeeded =
      med.mealTiming === 'প্রয়োজনমতো' ||
      !med.schedules ||
      med.schedules.length === 0;

    if (isAsNeeded) {
      // Show in "প্রয়োজনে" if active on at least one day of this viewed week
      const activeAnyDayInWeek = days.some((d) =>
        isMedicineScheduledOnLocalDate(med, d.date)
      );
      if (activeAnyDayInWeek && !asNeededMap.has(med.id)) {
        const firstDosage = med.schedules?.[0]?.dosage;
        asNeededMap.set(med.id, {
          medicineId: med.id,
          brandName: med.brandName,
          genericName: med.genericName || '',
          strength: med.strength || '',
          dosageHint: firstDosage ? `প্রয়োজনে ${firstDosage}` : 'প্রয়োজনে',
          instructions: med.instructions,
        });
      }
      continue;
    }

    for (const day of days) {
      if (!isMedicineScheduledOnLocalDate(med, day.date)) continue;

      for (const sch of med.schedules) {
        const bucketKey = classifyTimeBucket(sch.time, sch.timeSlot);
        const sortMinutes = getBucketSortMinutes(bucketKey, sch.time);
        const clockTimeBn = formatShortClockBn(sch.time);

        // Strictly only mark ✓/✗ if NOT future AND a real DoseLog record exists
        let logStatus: 'taken' | 'missed' | undefined;
        if (!day.isFuture) {
          logStatus = logStatusMap.get(`${med.id}|${day.iso}|${sch.timeSlot}`);
        }

        const item: PillboxDoseItem = {
          key: `${med.id}_${sch.id || sch.timeSlot}_${day.iso}`,
          medicineId: med.id,
          brandName: med.brandName,
          genericName: med.genericName || '',
          strength: med.strength || '',
          type: med.type,
          dosage: sch.dosage || '১টি',
          unit: med.unit || 'টি',
          chipLabel: formatShortMedicineChipLabel(med.brandName, sch.dosage),
          timeSlot: sch.timeSlot,
          rawTime: sch.time,
          clockTimeBn,
          sortMinutes,
          mealTiming: med.mealTiming,
          shortMealTimingBn: formatShortMealTimingBn(med.mealTiming),
          instructions: med.instructions,
          logStatus,
        };

        gridCells[bucketKey][day.iso].push(item);

        // Accumulate weekly total needed for this medicine
        const doseUnits = parseDosageUnits(sch.dosage);
        const existingTotal = totalsMap.get(med.id);
        if (existingTotal) {
          existingTotal.totalUnits += doseUnits;
          existingTotal.doseCount += 1;
        } else {
          totalsMap.set(med.id, {
            medicineId: med.id,
            brandName: med.brandName,
            strength: med.strength || '',
            unit: med.unit || 'টি',
            totalUnits: doseUnits,
            doseCount: 1,
          });
        }
      }
    }
  }

  // Sort items inside each cell by clock minutes then brand name, and keep only non-empty rows
  const visibleRows: PillboxRow[] = [];
  let totalScheduledDosesInWeek = 0;

  for (const bucketKey of TIME_BUCKET_ORDER) {
    let rowCount = 0;
    for (const day of days) {
      const cellItems = gridCells[bucketKey][day.iso];
      cellItems.sort(
        (a, b) =>
          a.sortMinutes - b.sortMinutes ||
          a.brandName.localeCompare(b.brandName, 'bn')
      );
      rowCount += cellItems.length;
    }

    if (rowCount === 0) continue;
    totalScheduledDosesInWeek += rowCount;

    const def = TIME_BUCKET_DEFINITIONS[bucketKey];
    visibleRows.push({
      key: bucketKey,
      emoji: def.emoji,
      titleBn: def.titleBn,
      rangeLabelBn: def.rangeLabelBn,
      headerBgPrint: def.headerBgPrint,
      cellsByDayIso: gridCells[bucketKey],
    });
  }

  const weeklyTotals: PillboxWeeklyMedicineTotal[] = Array.from(totalsMap.values())
    .sort((a, b) => a.brandName.localeCompare(b.brandName, 'bn'))
    .map((entry) => {
      const nameWithStrength = entry.strength
        ? `${entry.brandName} (${entry.strength})`
        : entry.brandName;
      return {
        ...entry,
        summaryLabelBn: `${nameWithStrength} — ${formatTotalQuantityBn(entry.totalUnits, entry.unit)}`,
      };
    });

  return {
    weekStartDay,
    weekStartIso: days[0]?.iso || '',
    weekEndIso: days[days.length - 1]?.iso || '',
    weekRangeBn,
    days,
    visibleRows,
    asNeededItems: Array.from(asNeededMap.values()),
    weeklyTotals,
    totalScheduledDosesInWeek,
  };
}
