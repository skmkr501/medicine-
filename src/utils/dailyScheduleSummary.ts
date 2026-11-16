import {
  DoseLog,
  MealTiming,
  Medicine,
  PatientProfile,
  ReminderSettings,
} from '../types';
import { formatBengaliDate, toBengaliNumber } from './bengaliUtils';
import {
  addLocalDays,
  normalizeLocalDate,
  parseLocalIsoDate,
  toLocalIsoDate,
} from './shoppingListCalculator';

export type TimeBucketKey = 'morning' | 'noon' | 'evening' | 'night';

export interface TimeBucketDefinition {
  key: TimeBucketKey;
  emoji: string;
  titleBn: string;
  rangeLabelBn: string;
  order: number;
  headerBgPrint: string;
}

export const TIME_BUCKET_DEFINITIONS: Record<TimeBucketKey, TimeBucketDefinition> = {
  morning: {
    key: 'morning',
    emoji: '🌅',
    titleBn: 'সকাল',
    rangeLabelBn: '৪:০০–১১:৫৯',
    order: 1,
    headerBgPrint: '#fef3c7', // soft amber-100
  },
  noon: {
    key: 'noon',
    emoji: '☀️',
    titleBn: 'দুপুর',
    rangeLabelBn: '১২:০০–১৫:৫৯',
    order: 2,
    headerBgPrint: '#e0f2fe', // soft sky-100
  },
  evening: {
    key: 'evening',
    emoji: '🌇',
    titleBn: 'সন্ধ্যা/বিকাল',
    rangeLabelBn: '১৬:০০–১৯:৫৯',
    order: 3,
    headerBgPrint: '#ffedd5', // soft orange-100
  },
  night: {
    key: 'night',
    emoji: '🌙',
    titleBn: 'রাত',
    rangeLabelBn: '২০:০০–৩:৫৯',
    order: 4,
    headerBgPrint: '#e0e7ff', // soft indigo-100
  },
};

export const TIME_BUCKET_ORDER: TimeBucketKey[] = ['morning', 'noon', 'evening', 'night'];

export interface TimeBucketDoseEntry {
  key: string;
  medicineId: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosage: string;
  timeSlot: Medicine['schedules'][number]['timeSlot'];
  rawTime: string;
  clockTimeBn: string;
  sortMinutes: number;
  mealTiming: MealTiming;
  shortMealTimingBn: string;
  instructions?: string;
  courseEndDateBn?: string;
  isTaken: boolean;
}

export interface TimeBucketGroup {
  key: TimeBucketKey;
  emoji: string;
  titleBn: string;
  representativeClockBn: string;
  headerBgPrint: string;
  items: TimeBucketDoseEntry[];
  takenCount: number;
  totalCount: number;
  isAllTaken: boolean;
}

export interface AsNeededMedicineEntry {
  medicineId: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageHint: string;
  instructions?: string;
  courseEndDateBn?: string;
}

export interface ProfileTimeSummary {
  buckets: TimeBucketGroup[];
  asNeededItems: AsNeededMedicineEntry[];
  activeMedicineCount: number;
  totalScheduledCount: number;
}

export interface PatientMedicineSlip {
  patientId: string;
  patientName: string;
  relation?: string;
  age?: number;
  generatedDateBn: string;
  buckets: TimeBucketGroup[];
  asNeededItems: AsNeededMedicineEntry[];
  allergies: string[];
  emergencyContact?: string;
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

function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BN_TO_EN_DIGITS[ch] || ch);
}

/**
 * Parses schedule time strings ("08:00 AM", "০৯:৩০ PM", "14:15", "9:00 PM") into minutes from midnight [0, 1439].
 * Returns null when unparseable.
 */
export function parseClockMinutes(timeStr?: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const normalized = toEnglishDigits(timeStr).trim();
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23) return null;
  return hours * 60 + minutes;
}

/**
 * Classifies a reminder time into one of 4 time buckets:
 * - morning: 04:00 - 11:59
 * - noon:    12:00 - 15:59
 * - evening: 16:00 - 19:59
 * - night:   20:00 - 03:59
 * Falls back to the Medicine's `timeSlot` label only if `rawTime` cannot be parsed.
 */
export function classifyTimeBucket(
  rawTime?: string,
  fallbackSlot?: Medicine['schedules'][number]['timeSlot']
): TimeBucketKey {
  const mins = parseClockMinutes(rawTime);
  if (mins !== null) {
    const hour = Math.floor(mins / 60);
    if (hour >= 4 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 15) return 'noon';
    if (hour >= 16 && hour <= 19) return 'evening';
    return 'night';
  }

  switch (fallbackSlot) {
    case 'সকাল':
      return 'morning';
    case 'দুপুর':
      return 'noon';
    case 'সন্ধ্যা':
      return 'evening';
    case 'রাত':
      return 'night';
    default:
      return 'morning';
  }
}

/**
 * Formats a clock time cleanly in Bengali 12h numerals without AM/PM clutter, e.g. "09:00 PM" -> "৯:০০".
 */
export function formatShortClockBn(rawTime?: string): string {
  const mins = parseClockMinutes(rawTime);
  if (mins === null) {
    return toBengaliNumber((rawTime || '').trim());
  }
  const hour24 = Math.floor(mins / 60);
  const minute = mins % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${toBengaliNumber(hour12)}:${toBengaliNumber(String(minute).padStart(2, '0'))}`;
}

export function formatShortMealTimingBn(mealTiming?: MealTiming | string): string {
  switch (mealTiming) {
    case 'খাওয়ার আগে':
      return 'আগে';
    case 'খাওয়ার পরে':
      return 'পরে';
    case 'ভরা পেটে':
      return 'ভরা পেটে';
    case 'খালি পেটে':
      return 'খালি পেটে';
    case 'ঘুমানোর আগে':
      return 'ঘুমানোর আগে';
    case 'যেকোনো সময়':
      return 'যেকোনো সময়';
    case 'প্রয়োজনমতো':
      return 'প্রয়োজনে';
    default:
      return mealTiming ? String(mealTiming) : '';
  }
}

export function getMedicineCourseEndDate(
  med: Medicine
): { isExpiredCourse: boolean; courseEndDateBn?: string } {
  if (med.isChronic || typeof med.durationDays !== 'number' || med.durationDays <= 0) {
    return { isExpiredCourse: false };
  }
  const start = parseLocalIsoDate(med.startDate);
  if (!start) {
    return { isExpiredCourse: false };
  }
  const days = Math.max(1, Math.ceil(med.durationDays));
  const lastDay = addLocalDays(start, days - 1);
  return {
    isExpiredCourse: false,
    courseEndDateBn: formatBengaliDate(lastDay),
  };
}

/**
 * Checks whether a medicine is active today:
 * - status === 'active'
 * - packet expiryDate (if set) is not before today
 * - fixed durationDays course (when !isChronic and startDate+durationDays valid) has not ended before today
 */
export function isMedicineActiveWithinLimits(
  med: Medicine,
  referenceDate: Date = new Date()
): boolean {
  if (med.status !== 'active') return false;

  const todayMidnight = normalizeLocalDate(referenceDate);

  if (med.expiryDate) {
    const expiry = parseLocalIsoDate(med.expiryDate);
    if (expiry && expiry.getTime() < todayMidnight.getTime()) {
      return false;
    }
  }

  if (!med.isChronic && typeof med.durationDays === 'number' && med.durationDays > 0) {
    const start = parseLocalIsoDate(med.startDate);
    if (start) {
      const days = Math.max(1, Math.ceil(med.durationDays));
      const endExclusive = addLocalDays(start, days);
      if (todayMidnight.getTime() >= endExclusive.getTime()) {
        return false;
      }
    }
  }

  return true;
}

export function getBucketSortMinutes(bucketKey: TimeBucketKey, rawTime?: string): number {
  const parsed = parseClockMinutes(rawTime);
  if (parsed === null) return 9999;
  if (bucketKey === 'night' && parsed < 240) {
    // 00:00-03:59 comes after 20:00-23:59 within the night bucket
    return parsed + 1440;
  }
  return parsed;
}

/**
 * Computes time-grouped medicine boxes + as-needed medicines + dose progress strictly from in-memory data.
 * Performs zero network/Firestore reads.
 */
export function buildProfileTimeSummary(params: {
  medicines: Medicine[];
  doseLogs: DoseLog[];
  patientId?: string | null;
  todayStr?: string;
  referenceDate?: Date;
}): ProfileTimeSummary {
  const referenceDate = params.referenceDate ?? new Date();
  const realTodayIso = toLocalIsoDate(referenceDate);
  const validTodayDates = new Set<string>([realTodayIso]);
  if (params.todayStr && params.todayStr.trim()) {
    validTodayDates.add(params.todayStr.trim());
  }

  const scopedMedicines = params.medicines.filter((med) => {
    if (params.patientId) {
      if (med.assignedPatientId !== params.patientId) return false;
    }
    return isMedicineActiveWithinLimits(med, referenceDate);
  });

  const bucketItemsMap: Record<TimeBucketKey, TimeBucketDoseEntry[]> = {
    morning: [],
    noon: [],
    evening: [],
    night: [],
  };
  const asNeededItems: AsNeededMedicineEntry[] = [];

  for (const med of scopedMedicines) {
    const courseMeta = getMedicineCourseEndDate(med);
    const hasSchedules = Array.isArray(med.schedules) && med.schedules.length > 0;
    const isAsNeeded = med.mealTiming === 'প্রয়োজনমতো' || !hasSchedules;

    if (isAsNeeded) {
      const firstDosage = hasSchedules && med.schedules[0]?.dosage ? med.schedules[0].dosage : `১${med.unit || 'টি'}`;
      asNeededItems.push({
        medicineId: med.id,
        brandName: med.brandName,
        genericName: med.genericName || '',
        strength: med.strength || '',
        dosageHint: firstDosage,
        instructions: med.instructions?.trim() || undefined,
        courseEndDateBn: courseMeta.courseEndDateBn,
      });
      continue;
    }

    for (const sch of med.schedules) {
      const bucketKey = classifyTimeBucket(sch.time, sch.timeSlot);
      const clockTimeBn = formatShortClockBn(sch.time);
      const sortMinutes = getBucketSortMinutes(bucketKey, sch.time);

      const logMatch = params.doseLogs.find(
        (log) =>
          log.medicineId === med.id &&
          validTodayDates.has(log.scheduledDate) &&
          log.timeSlot === sch.timeSlot &&
          (!params.patientId || !log.patientId || log.patientId === params.patientId)
      );

      bucketItemsMap[bucketKey].push({
        key: `${med.id}-${sch.id || sch.timeSlot}-${bucketKey}`,
        medicineId: med.id,
        brandName: med.brandName,
        genericName: med.genericName || '',
        strength: med.strength || '',
        dosage: sch.dosage || `১${med.unit || 'টি'}`,
        timeSlot: sch.timeSlot,
        rawTime: sch.time,
        clockTimeBn,
        sortMinutes,
        mealTiming: med.mealTiming,
        shortMealTimingBn: formatShortMealTimingBn(med.mealTiming),
        instructions: med.instructions?.trim() || undefined,
        courseEndDateBn: courseMeta.courseEndDateBn,
        isTaken: logMatch?.status === 'taken',
      });
    }
  }

  const buckets: TimeBucketGroup[] = [];
  let totalScheduledCount = 0;

  for (const key of TIME_BUCKET_ORDER) {
    const items = bucketItemsMap[key];
    if (items.length === 0) continue;

    items.sort((a, b) => {
      if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes;
      return a.brandName.localeCompare(b.brandName);
    });

    const def = TIME_BUCKET_DEFINITIONS[key];
    const takenCount = items.filter((i) => i.isTaken).length;
    const totalCount = items.length;
    totalScheduledCount += totalCount;

    buckets.push({
      key,
      emoji: def.emoji,
      titleBn: def.titleBn,
      representativeClockBn: items[0]?.clockTimeBn || '',
      headerBgPrint: def.headerBgPrint,
      items,
      takenCount,
      totalCount,
      isAllTaken: totalCount > 0 && takenCount === totalCount,
    });
  }

  return {
    buckets,
    asNeededItems,
    activeMedicineCount: scopedMedicines.length,
    totalScheduledCount,
  };
}

/**
 * Builds printable daily medicine slips for either the selected patient or all non-archived profiles.
 */
export function buildMedicineSlips(params: {
  scope: 'current' | 'all';
  patients: PatientProfile[];
  activePatient: PatientProfile | null;
  medicines: Medicine[];
  doseLogs: DoseLog[];
  settings?: ReminderSettings;
  todayStr?: string;
  referenceDate?: Date;
}): PatientMedicineSlip[] {
  const referenceDate = params.referenceDate ?? new Date();
  const generatedDateBn = formatBengaliDate(referenceDate);
  const nonArchivedPatients = params.patients.filter((p) => !p.isArchived);

  const globalEmergency =
    params.settings?.emergencyContactPhone?.trim()
      ? params.settings.emergencyContactName?.trim()
        ? `${params.settings.emergencyContactName.trim()} (${params.settings.emergencyContactPhone.trim()})`
        : params.settings.emergencyContactPhone.trim()
      : '';

  const buildForTarget = (
    patient: PatientProfile | null,
    patientIdFilter: string | null
  ): PatientMedicineSlip => {
    const summary = buildProfileTimeSummary({
      medicines: params.medicines,
      doseLogs: params.doseLogs,
      patientId: patientIdFilter,
      todayStr: params.todayStr,
      referenceDate,
    });

    const allergies = patient?.allergies?.map((a) => a.trim()).filter(Boolean) ?? [];
    const profileEmergency = patient?.emergencyContact?.trim() || globalEmergency || undefined;

    return {
      patientId: patient?.id || 'general',
      patientName: patient?.name || 'সাধারণ তালিকা',
      relation: patient?.relation,
      age:
        patient && typeof patient.age === 'number' && !Number.isNaN(patient.age) && patient.age > 0
          ? patient.age
          : undefined,
      generatedDateBn,
      buckets: summary.buckets,
      asNeededItems: summary.asNeededItems,
      allergies,
      emergencyContact: profileEmergency,
    };
  };

  if (params.scope === 'all' && nonArchivedPatients.length > 0) {
    return nonArchivedPatients.map((p) => buildForTarget(p, p.id));
  }

  const targetPatient = params.activePatient || nonArchivedPatients[0] || null;
  return [buildForTarget(targetPatient, targetPatient?.id || null)];
}

/**
 * Formats one or more PatientMedicineSlips into clean Bengali plain text for WhatsApp sharing.
 */
export function buildMedicineSlipShareText(slips: PatientMedicineSlip[]): string {
  const lines: string[] = [];

  lines.push('স্বাস্থ্যবন্ধু — দৈনিক ওষুধের স্লিপ');

  slips.forEach((slip, idx) => {
    if (idx > 0) {
      lines.push('');
      lines.push('------------------------------');
    }
    lines.push('');
    lines.push(
      `রোগী: ${slip.patientName}${slip.relation ? ` (${slip.relation})` : ''}${
        slip.age !== undefined ? ` · বয়স: ${toBengaliNumber(slip.age)} বছর` : ''
      }`
    );
    lines.push(`তারিখ: ${slip.generatedDateBn}`);

    if (slip.buckets.length === 0 && slip.asNeededItems.length === 0) {
      lines.push('আজকের জন্য কোনো চলমান ওষুধ নেই।');
    }

    for (const bucket of slip.buckets) {
      lines.push('');
      lines.push(
        `${bucket.emoji} ${bucket.titleBn}${
          bucket.representativeClockBn ? ` (${bucket.representativeClockBn})` : ''
        }:`
      );
      bucket.items.forEach((item, rowIdx) => {
        const parts: string[] = [];
        parts.push(
          `${toBengaliNumber(rowIdx + 1)}. ${item.brandName}${
            item.strength ? ` ${item.strength}` : ''
          }${item.genericName ? ` (${item.genericName})` : ''}`
        );
        parts.push(`${item.dosage}`);
        parts.push(`${item.mealTiming}`);
        if (item.instructions) {
          parts.push(`নোট: ${item.instructions}`);
        }
        if (item.courseEndDateBn) {
          parts.push(`কোর্স শেষ: ${item.courseEndDateBn}`);
        }
        lines.push(`   ☐ ${parts.join(' — ')}`);
      });
    }

    if (slip.asNeededItems.length > 0) {
      lines.push('');
      lines.push('প্রয়োজনে:');
      slip.asNeededItems.forEach((item, rowIdx) => {
        const parts: string[] = [
          `${toBengaliNumber(rowIdx + 1)}. ${item.brandName}${
            item.strength ? ` ${item.strength}` : ''
          }${item.genericName ? ` (${item.genericName})` : ''}`,
          item.dosageHint,
        ];
        if (item.instructions) parts.push(`নোট: ${item.instructions}`);
        lines.push(`   ☐ ${parts.join(' — ')}`);
      });
    }

    if (slip.allergies.length > 0 || slip.emergencyContact) {
      lines.push('');
      if (slip.allergies.length > 0) {
        lines.push(`অ্যালার্জি: ${slip.allergies.join(', ')}`);
      }
      if (slip.emergencyContact) {
        lines.push(`জরুরি যোগাযোগ: ${slip.emergencyContact}`);
      }
    }
  });

  lines.push('');
  lines.push('এটি অ্যাপের তালিকা; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।');

  return lines.join('\n');
}

export function buildMedicineSlipWhatsAppUrl(slips: PatientMedicineSlip[]): string {
  const text = buildMedicineSlipShareText(slips);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
