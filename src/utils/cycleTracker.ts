import { CycleFlow, CycleLog } from '../types';
import { toLocalIsoDate } from './shoppingListCalculator';

export const CYCLE_DISCLAIMER_BN =
  'এটি চিকিৎসার বিকল্প নয়। চক্র ৩৫ দিনের বেশি বা ২১ দিনের কম হলে, অথবা অতিরিক্ত রক্তক্ষরণ হলে ডাক্তার দেখান।';

export const CYCLE_INSUFFICIENT_DATA_BN = 'পর্যাপ্ত তথ্য নেই';

export const CYCLE_FLOW_OPTIONS: CycleFlow[] = ['হালকা', 'মাঝারি', 'ভারী'];

export const CYCLE_SYMPTOM_OPTIONS: string[] = [
  'মাথাব্যথা',
  'পেটব্যথা',
  'ক্লান্তি',
  'মেজাজ পরিবর্তন',
  'বমি ভাব',
  'পিঠব্যথা',
];

export const CYCLE_MAX_AVERAGE_WINDOW = 6;
export const CYCLE_DEFAULT_PERIOD_DAYS = 5;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!ISO_DATE_RE.test(trimmed)) return false;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function diffIsoDays(startIso: string, endIso: string): number {
  if (!isValidIsoDate(startIso) || !isValidIsoDate(endIso)) return 0;
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const sMs = Date.UTC(sy, sm - 1, sd);
  const eMs = Date.UTC(ey, em - 1, ed);
  return Math.round((eMs - sMs) / (24 * 60 * 60 * 1000));
}

export function addIsoDays(baseIso: string, days: number): string {
  if (!isValidIsoDate(baseIso)) return '';
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Math.round(days)));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export interface CycleAnalysis {
  patientId: string;
  totalCycles: number;
  hasEnoughData: boolean;
  insufficientDataMessage: string;
  averageCycleLength: number | null;
  averagePeriodDurationDays: number | null;
  lastCycle: CycleLog | null;
  recentCycles: Array<CycleLog & { cycleLengthDays?: number }>;
  predictedNextStartDate: string | null;
  predictedWindowEndDate: string | null;
  daysUntilNextCycle: number | null;
  hasIrregularityAlert: boolean;
  irregularityReasons: string[];
}

/**
 * Analyzes menstrual cycles for a single profile (patientId).
 * Computes average cycle length from up to the last 6 cycles.
 * Requires >= 2 recorded cycles to establish an interval average and prediction.
 */
export function analyzeCycles(
  logs: CycleLog[],
  patientId: string,
  todayIso: string = toLocalIsoDate(new Date())
): CycleAnalysis {
  const cleanLogs = (logs || [])
    .filter((l) => l && l.patientId === patientId && isValidIsoDate(l.startDate))
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const recentSlice = cleanLogs.slice(-CYCLE_MAX_AVERAGE_WINDOW);

  const intervals: number[] = [];
  const enrichedRecent: Array<CycleLog & { cycleLengthDays?: number }> = recentSlice.map(
    (log, idx) => {
      if (idx === 0) return { ...log };
      const prev = recentSlice[idx - 1];
      const delta = diffIsoDays(prev.startDate, log.startDate);
      if (delta >= 10 && delta <= 90) {
        intervals.push(delta);
        return { ...log, cycleLengthDays: delta };
      }
      return { ...log };
    }
  );

  // Average period duration (if endDate recorded)
  const periodDurations: number[] = [];
  for (const log of recentSlice) {
    if (log.endDate && isValidIsoDate(log.endDate)) {
      const len = diffIsoDays(log.startDate, log.endDate) + 1;
      if (len >= 1 && len <= 15) {
        periodDurations.push(len);
      }
    }
  }
  const averagePeriodDurationDays =
    periodDurations.length > 0
      ? Math.round(periodDurations.reduce((a, b) => a + b, 0) / periodDurations.length)
      : null;

  const lastCycle = cleanLogs.length > 0 ? cleanLogs[cleanLogs.length - 1] : null;
  const hasEnoughData = cleanLogs.length >= 2 && intervals.length >= 1;

  const averageCycleLength = hasEnoughData
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : null;

  const predictedNextStartDate =
    hasEnoughData && lastCycle && averageCycleLength !== null
      ? addIsoDays(lastCycle.startDate, averageCycleLength)
      : null;

  const predictedSpan = averagePeriodDurationDays ?? CYCLE_DEFAULT_PERIOD_DAYS;
  const predictedWindowEndDate = predictedNextStartDate
    ? addIsoDays(predictedNextStartDate, Math.max(0, predictedSpan - 1))
    : null;

  const daysUntilNextCycle =
    predictedNextStartDate && isValidIsoDate(todayIso)
      ? diffIsoDays(todayIso, predictedNextStartDate)
      : null;

  const irregularityReasons: string[] = [];
  if (averageCycleLength !== null && (averageCycleLength < 21 || averageCycleLength > 35)) {
    irregularityReasons.push(
      averageCycleLength < 21
        ? 'গড় চক্র ২১ দিনের কম'
        : 'গড় চক্র ৩৫ দিনের বেশি'
    );
  } else {
    const latestWithLen = [...enrichedRecent].reverse().find((c) => typeof c.cycleLengthDays === 'number');
    if (latestWithLen?.cycleLengthDays && (latestWithLen.cycleLengthDays < 21 || latestWithLen.cycleLengthDays > 35)) {
      irregularityReasons.push(
        latestWithLen.cycleLengthDays < 21
          ? 'সর্বশেষ চক্র ২১ দিনের কম ছিল'
          : 'সর্বশেষ চক্র ৩৫ দিনের বেশি ছিল'
      );
    }
  }
  if (lastCycle?.flow === 'ভারী') {
    irregularityReasons.push('সর্বশেষ চক্রে অতিরিক্ত/ভারী রক্তক্ষরণ উল্লেখ আছে');
  }

  return {
    patientId,
    totalCycles: cleanLogs.length,
    hasEnoughData,
    insufficientDataMessage: CYCLE_INSUFFICIENT_DATA_BN,
    averageCycleLength,
    averagePeriodDurationDays,
    lastCycle,
    recentCycles: enrichedRecent.slice().reverse(), // newest first for display
    predictedNextStartDate,
    predictedWindowEndDate,
    daysUntilNextCycle,
    hasIrregularityAlert: irregularityReasons.length > 0,
    irregularityReasons,
  };
}

export interface CycleCalendarCell {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPeriodDay: boolean;
  isPredictedDay: boolean;
}

/**
 * Builds a 6x7 (42-cell) calendar grid for a given year & 0-indexed month.
 */
export function buildCycleCalendarMonth(
  year: number,
  month0: number,
  logs: CycleLog[],
  patientId: string,
  analysis?: CycleAnalysis,
  todayIso: string = toLocalIsoDate(new Date())
): CycleCalendarCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month0, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sun
  const patientLogs = (logs || []).filter(
    (l) => l && l.patientId === patientId && isValidIsoDate(l.startDate)
  );
  const effectiveAnalysis = analysis ?? analyzeCycles(logs, patientId, todayIso);

  // Determine active period date ranges
  const periodRanges: Array<{ start: string; end: string }> = patientLogs.map((log) => {
    const start = log.startDate;
    let end =
      log.endDate && isValidIsoDate(log.endDate) && diffIsoDays(start, log.endDate) >= 0
        ? log.endDate
        : null;
    if (!end) {
      // If active ongoing cycle within last 10 days from today, highlight through today; else default 5-day highlight
      const daysSinceStart = diffIsoDays(start, todayIso);
      if (daysSinceStart >= 0 && daysSinceStart < CYCLE_DEFAULT_PERIOD_DAYS) {
        end = todayIso;
      } else {
        end = addIsoDays(start, CYCLE_DEFAULT_PERIOD_DAYS - 1);
      }
    }
    return { start, end };
  });

  const cells: CycleCalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(Date.UTC(year, month0, 1 - startWeekday + i));
    const yy = cellDate.getUTCFullYear();
    const mm = cellDate.getUTCMonth();
    const dd = cellDate.getUTCDate();
    const isoDate = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

    const isPeriodDay = periodRanges.some(
      (r) => isoDate >= r.start && isoDate <= r.end
    );

    const isPredictedDay = Boolean(
      !isPeriodDay &&
        effectiveAnalysis.hasEnoughData &&
        effectiveAnalysis.predictedNextStartDate &&
        effectiveAnalysis.predictedWindowEndDate &&
        isoDate >= effectiveAnalysis.predictedNextStartDate &&
        isoDate <= effectiveAnalysis.predictedWindowEndDate
    );

    cells.push({
      isoDate,
      dayOfMonth: dd,
      inCurrentMonth: yy === year && mm === month0,
      isToday: isoDate === todayIso,
      isPeriodDay,
      isPredictedDay,
    });
  }

  return cells;
}

/**
 * Returns the ISO date 1 day before predictedNextStartDate.
 */
export function getCycleReminderTargetDate(
  predictedNextStartDate: string | null | undefined
): string | null {
  if (!predictedNextStartDate || !isValidIsoDate(predictedNextStartDate)) return null;
  return addIsoDays(predictedNextStartDate, -1);
}

/**
 * Checks whether the 1-day-before reminder should trigger today.
 */
export function isCycleReminderDueToday(
  predictedNextStartDate: string | null | undefined,
  todayIso: string = toLocalIsoDate(new Date())
): boolean {
  const target = getCycleReminderTargetDate(predictedNextStartDate);
  if (!target || !isValidIsoDate(todayIso)) return false;
  return target === todayIso;
}

function getCycleToggleStorageKey(uid: string | null | undefined, patientId: string): string {
  const safeUid = uid && uid.trim() ? uid.trim() : 'guest_local';
  return `shasthobondhu_cycle_enabled_${safeUid}_${patientId}`;
}

export function isCycleTrackerEnabledForProfile(
  uid: string | null | undefined,
  patientId: string | null | undefined
): boolean {
  if (!patientId) return false;
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(getCycleToggleStorageKey(uid, patientId)) === 'true';
  } catch {
    return false;
  }
}

export function setCycleTrackerEnabledForProfile(
  uid: string | null | undefined,
  patientId: string,
  enabled: boolean
): void {
  if (!patientId) return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = getCycleToggleStorageKey(uid, patientId);
    if (enabled) {
      window.localStorage.setItem(key, 'true');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

const CYCLE_REMINDER_NOTIFIED_PREFIX = 'shasthobondhu_cycle_reminded_';

export function hasCycleReminderFiredForDate(
  uid: string | null | undefined,
  patientId: string,
  predictedNextStartDate: string
): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const key = `${CYCLE_REMINDER_NOTIFIED_PREFIX}${uid || 'guest_local'}_${patientId}`;
    return window.localStorage.getItem(key) === predictedNextStartDate;
  } catch {
    return false;
  }
}

export function markCycleReminderFiredForDate(
  uid: string | null | undefined,
  patientId: string,
  predictedNextStartDate: string
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = `${CYCLE_REMINDER_NOTIFIED_PREFIX}${uid || 'guest_local'}_${patientId}`;
    window.localStorage.setItem(key, predictedNextStartDate);
  } catch {
    // ignore storage errors
  }
}
