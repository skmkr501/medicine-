import {
  CaregiverFullMedicineItem,
  CaregiverLinkDoc,
  CaregiverTodayDoseSummary,
  CaregiverTodaySummary,
  DoseLog,
  FamilyAlertDoc,
  FamilyAlertType,
  Medicine,
  TimeSlot,
} from '../types';
import { formatBengaliTime, toBengaliNumber } from './bengaliUtils';
import { calculateDailyConsumption } from './stockPredictor';
import { toLocalIsoDate } from './shoppingListCalculator';

export const MAX_CAREGIVERS = 3;
export const CAREGIVER_INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
export const ALERT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const CAREGIVER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const LEGACY_APP_TODAY_DATE = '2026-11-02';

const SLOT_ASCII_MAP: Record<TimeSlot, string> = {
  'সকাল': 'morning',
  'দুপুর': 'noon',
  'সন্ধ্যা': 'evening',
  'রাত': 'night',
};

const SLOT_GENITIVE_BN: Record<TimeSlot, string> = {
  'সকাল': 'সকালের',
  'দুপুর': 'দুপুরের',
  'সন্ধ্যা': 'সন্ধ্যার',
  'রাত': 'রাতের',
};

const SLOT_ORDER: Record<TimeSlot, number> = {
  'সকাল': 1,
  'দুপুর': 2,
  'সন্ধ্যা': 3,
  'রাত': 4,
};

const BENGALI_DIGITS_MAP: Record<string, string> = {
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

export interface SimpleStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getSafeStorage(storage?: SimpleStorageLike): SimpleStorageLike | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function sanitizeFirestoreIdPart(raw: string): string {
  const cleaned = (raw || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'item';
}

/**
 * Generates a 6-character uppercase alphanumeric invite code (excluding 0/O/1/I).
 */
export function generateInviteCode(length: number = 6): string {
  const chars: string[] = [];
  const alphabetLen = CAREGIVER_CODE_ALPHABET.length;
  for (let i = 0; i < length; i++) {
    let idx: number;
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      idx = buf[0] % alphabetLen;
    } else {
      idx = Math.floor(Math.random() * alphabetLen);
    }
    chars.push(CAREGIVER_CODE_ALPHABET[idx]);
  }
  return chars.join('');
}

export function normalizeInviteCodeInput(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function isInviteExpired(expiresAtMs: number, nowMs: number = Date.now()): boolean {
  return !expiresAtMs || nowMs >= expiresAtMs;
}

/**
 * Sanitizes phone number for tel: and WhatsApp links.
 */
export function cleanPhoneForLinks(phone?: string): string {
  if (!phone) return '';
  return phone.trim().replace(/[^0-9+]/g, '');
}

export function buildCaregiverInviteWhatsAppUrl(code: string, patientName: string): string {
  const safeName = (patientName || 'পরিবারের সদস্য').trim();
  const text = [
    `স্বাস্থ্যবন্ধু — পরিবারের যত্নকারী আমন্ত্রণ`,
    ``,
    `${safeName} আপনাকে তার ওষুধের সময় ও সতর্কতা দেখার জন্য যত্নকারী হিসেবে যুক্ত করতে চান।`,
    `আমন্ত্রণ কোড: ${code}`,
    `(কোডটির মেয়াদ ৪৮ ঘণ্টা এবং এটি একবার ব্যবহার করা যাবে)`,
    ``,
    `যুক্ত হতে: স্বাস্থ্যবন্ধু অ্যাপে লগইন করে "সেটিংস → পরিবারের যত্নকারী → কোড দিয়ে যুক্ত হোন"-এ এই কোডটি দিন।`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildCaregiverAlertCheckInWhatsAppUrl(
  patientPhone: string | undefined,
  patientName: string,
  alertMessage: string
): string {
  const safeName = (patientName || 'আপনি').trim();
  const text = `আসসালামু আলাইকুম, স্বাস্থ্যবন্ধু থেকে বার্তা পেলাম: "${alertMessage}"। ${safeName} কেমন আছেন ও ওষুধ খেয়েছেন কি না একটু জানাবেন।`;
  const clean = cleanPhoneForLinks(patientPhone).replace(/^\+/, '');
  if (clean) {
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildPatientManualAlertWhatsAppUrl(alertMessage: string): string {
  const text = `স্বাস্থ্যবন্ধু সতর্কতা: ${alertMessage}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Deterministic alert document ID complying strictly with Firestore ID regex ^[a-zA-Z0-9_-]+$.
 * Ensures at most 1 alert per dose/medicine per day.
 */
export function buildDeterministicAlertId(
  patientUid: string,
  medicineId: string,
  dateIso: string,
  type: FamilyAlertType,
  slot?: TimeSlot
): string {
  const p = sanitizeFirestoreIdPart(patientUid).slice(0, 32);
  const m = sanitizeFirestoreIdPart(medicineId).slice(0, 40);
  const d = sanitizeFirestoreIdPart(dateIso);
  const tail =
    type === 'missed_dose'
      ? SLOT_ASCII_MAP[slot || 'সকাল'] || 'dose'
      : 'low_stock';
  return `${p}_${m}_${d}_${tail}`.slice(0, 128);
}

/**
 * Parses a medicine schedule time string into a Date on referenceDate's local calendar day.
 */
export function parseScheduleTimeForDate(
  timeStr: string,
  referenceDate: Date = new Date()
): Date | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const normalized = timeStr
    .trim()
    .replace(/[০-৯]/g, (ch) => BENGALI_DIGITS_MAP[ch] || ch);

  const match = normalized.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    hour,
    minute,
    0,
    0
  );
}

function isDoseResolvedToday(
  doseLogs: DoseLog[],
  medicineId: string,
  timeSlot: TimeSlot,
  realDateIso: string
): 'taken' | 'skipped' | 'pending' {
  for (const log of doseLogs) {
    if (log.medicineId !== medicineId || log.timeSlot !== timeSlot) continue;
    if (log.status !== 'taken' && log.status !== 'skipped') continue;

    if (log.scheduledDate === realDateIso) {
      return log.status;
    }

    // Compatibility with app's today dose logs marked in current calendar day
    if (log.scheduledDate === LEGACY_APP_TODAY_DATE && log.loggedAt) {
      const parsedLogDate = new Date(log.loggedAt);
      if (!Number.isNaN(parsedLogDate.getTime()) && toLocalIsoDate(parsedLogDate) === realDateIso) {
        return log.status;
      }
    }
  }
  return 'pending';
}

export interface EvaluateCaregiverTriggersInput {
  patientUid: string;
  patientName: string;
  patientPhone?: string;
  medicines: Medicine[];
  doseLogs: DoseLog[];
  activeLinks: CaregiverLinkDoc[];
  thresholdMinutes?: 15 | 30 | 60;
  sentAlertIds?: Set<string>;
  now?: Date;
}

export interface EvaluateCaregiverTriggersOutput {
  alertsToSend: FamilyAlertDoc[];
  nextCheckDelayMs: number | null;
  todaySummary: CaregiverTodaySummary;
  sharedMedicines: CaregiverFullMedicineItem[];
}

/**
 * Pure evaluator for missed-dose alerts, low-stock (< 3 days) alerts,
 * next device-timer wake-up delay, and privacy-scoped caregiver summary.
 */
export function evaluateCaregiverTriggers(
  input: EvaluateCaregiverTriggersInput
): EvaluateCaregiverTriggersOutput {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const dateIso = toLocalIsoDate(now);
  const thresholdMin = input.thresholdMinutes ?? 30;
  const thresholdMs = thresholdMin * 60 * 1000;
  const sentIds = input.sentAlertIds ?? new Set<string>();
  const patientName = (input.patientName || 'রোগী').trim();

  const verifiedActiveLinks = input.activeLinks
    .filter((l) => l.status === 'active' && Boolean(l.caregiverUid))
    .slice(0, MAX_CAREGIVERS);

  const caregiverUids = verifiedActiveLinks.map((l) => l.caregiverUid);
  const caregiverLinkIds = verifiedActiveLinks.map((l) => l.id);

  const activeMedicines = input.medicines.filter((m) => m.status === 'active');

  const dosesSummaryList: CaregiverTodayDoseSummary[] = [];
  const sharedMedicines: CaregiverFullMedicineItem[] = [];
  const alertsToSend: FamilyAlertDoc[] = [];

  let nextTriggerAtMs: number | null = null;
  let takenCount = 0;
  let remainingCount = 0;

  for (const med of activeMedicines) {
    const schedules = Array.isArray(med.schedules) ? med.schedules : [];
    const medDisplayName = med.strength ? `${med.brandName}` : med.brandName;

    // 1. Optional full-view medicine summary (used ONLY when patient explicitly enabled allowFullView)
    sharedMedicines.push({
      brandName: med.brandName,
      strength: med.strength || undefined,
      mealTiming: med.mealTiming,
      stock: typeof med.stock === 'number' ? med.stock : 0,
      unit: med.unit || 'টি',
      schedulesText: schedules
        .map((s) => `${s.timeSlot} ${formatBengaliTime(s.time)} (${s.dosage})`)
        .join(', '),
    });

    // 2. Evaluate today's schedules & missed-dose alerts
    for (const sch of schedules) {
      const resolved = isDoseResolvedToday(input.doseLogs, med.id, sch.timeSlot, dateIso);
      if (resolved === 'taken') {
        takenCount += 1;
      } else if (resolved === 'pending') {
        remainingCount += 1;
      }

      dosesSummaryList.push({
        medicineName: medDisplayName,
        timeSlot: sch.timeSlot,
        time: sch.time,
        dosage: sch.dosage,
        status: resolved,
      });

      if (resolved !== 'pending' || med.mealTiming === 'প্রয়োজনমতো') {
        continue;
      }

      const scheduledDate = parseScheduleTimeForDate(sch.time, now);
      if (!scheduledDate) continue;

      const triggerAtMs = scheduledDate.getTime() + thresholdMs;

      if (nowMs >= triggerAtMs) {
        if (caregiverUids.length > 0) {
          const alertId = buildDeterministicAlertId(
            input.patientUid,
            med.id,
            dateIso,
            'missed_dose',
            sch.timeSlot
          );
          if (!sentIds.has(alertId)) {
            const slotWord = SLOT_GENITIVE_BN[sch.timeSlot] || sch.timeSlot;
            alertsToSend.push({
              id: alertId,
              patientUid: input.patientUid,
              caregiverUids,
              caregiverLinkIds,
              type: 'missed_dose',
              medicineId: med.id,
              medicineName: medDisplayName,
              slot: sch.timeSlot,
              date: dateIso,
              message: `${patientName} আজ ${slotWord} ${medDisplayName} খাননি`,
              patientName,
              patientPhone: cleanPhoneForLinks(input.patientPhone) || undefined,
              createdAt: now.toISOString(),
              createdAtMs: nowMs,
              seenBy: [],
            });
          }
        }
      } else {
        // Schedule device timer for the earliest upcoming missed-dose check
        if (nextTriggerAtMs === null || triggerAtMs < nextTriggerAtMs) {
          nextTriggerAtMs = triggerAtMs;
        }
      }
    }

    // 3. Evaluate Low Stock (< 3 days remaining)
    if (med.mealTiming !== 'প্রয়োজনমতো' && schedules.length > 0) {
      const dailyUsage = calculateDailyConsumption(schedules);
      const stock = typeof med.stock === 'number' && !Number.isNaN(med.stock) ? med.stock : 0;
      if (dailyUsage > 0) {
        const daysRemaining = stock <= 0 ? 0 : Math.floor(stock / dailyUsage);
        if (daysRemaining < 3 && caregiverUids.length > 0) {
          const alertId = buildDeterministicAlertId(
            input.patientUid,
            med.id,
            dateIso,
            'low_stock'
          );
          if (!sentIds.has(alertId)) {
            const message =
              stock <= 0
                ? `${patientName}-এর ${medDisplayName} শেষ হয়ে গেছে`
                : `${patientName}-এর ${medDisplayName} আর ${toBengaliNumber(daysRemaining)} দিন চলবে, দ্রুত কিনতে হবে`;
            alertsToSend.push({
              id: alertId,
              patientUid: input.patientUid,
              caregiverUids,
              caregiverLinkIds,
              type: 'low_stock',
              medicineId: med.id,
              medicineName: medDisplayName,
              date: dateIso,
              message,
              patientName,
              patientPhone: cleanPhoneForLinks(input.patientPhone) || undefined,
              createdAt: now.toISOString(),
              createdAtMs: nowMs,
              seenBy: [],
            });
          }
        }
      }
    }
  }

  dosesSummaryList.sort((a, b) => {
    const slotDiff = (SLOT_ORDER[a.timeSlot] || 9) - (SLOT_ORDER[b.timeSlot] || 9);
    if (slotDiff !== 0) return slotDiff;
    const da = parseScheduleTimeForDate(a.time, now)?.getTime() ?? 0;
    const db = parseScheduleTimeForDate(b.time, now)?.getTime() ?? 0;
    return da - db;
  });

  const nextCheckDelayMs =
    nextTriggerAtMs !== null ? Math.max(1000, nextTriggerAtMs - nowMs + 1500) : null;

  return {
    alertsToSend,
    nextCheckDelayMs,
    todaySummary: {
      date: dateIso,
      totalDoses: dosesSummaryList.length,
      takenDoses: takenCount,
      remainingDoses: remainingCount,
      doses: dosesSummaryList.slice(0, 30),
      updatedAt: now.toISOString(),
    },
    sharedMedicines: sharedMedicines.slice(0, 40),
  };
}

// =========================================================================
// Local Dedupe & Offline/Quota Alert Retry Queue
// =========================================================================

export function getSentAlertsStorageKey(uid: string): string {
  return `shasthobondhu_sent_family_alerts_${uid}`;
}

export function getPendingAlertsStorageKey(uid: string): string {
  return `shasthobondhu_pending_family_alerts_${uid}`;
}

export function loadSentFamilyAlertIds(
  uid: string,
  storage?: SimpleStorageLike
): Set<string> {
  const store = getSafeStorage(storage);
  if (!store || !uid) return new Set();
  try {
    const raw = store.getItem(getSentAlertsStorageKey(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
  } catch {
    // Ignore corrupt local cache
  }
  return new Set();
}

export function markFamilyAlertSentLocally(
  uid: string,
  alertId: string,
  storage?: SimpleStorageLike
): Set<string> {
  const next = loadSentFamilyAlertIds(uid, storage);
  next.add(alertId);
  const store = getSafeStorage(storage);
  if (store && uid) {
    try {
      // Keep last 200 alert IDs bounded so storage never bloats
      const trimmed = Array.from(next).slice(-200);
      store.setItem(getSentAlertsStorageKey(uid), JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function loadPendingFamilyAlerts(
  uid: string,
  storage?: SimpleStorageLike
): FamilyAlertDoc[] {
  const store = getSafeStorage(storage);
  if (!store || !uid) return [];
  try {
    const raw = store.getItem(getPendingAlertsStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is FamilyAlertDoc => Boolean(item && typeof item.id === 'string')
      );
    }
  } catch {
    // Ignore corrupt cache
  }
  return [];
}

export function enqueuePendingFamilyAlerts(
  uid: string,
  alerts: FamilyAlertDoc[],
  storage?: SimpleStorageLike
): FamilyAlertDoc[] {
  const existing = loadPendingFamilyAlerts(uid, storage);
  const map = new Map<string, FamilyAlertDoc>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of alerts) {
    map.set(item.id, item);
  }
  const merged = Array.from(map.values()).slice(-30);
  const store = getSafeStorage(storage);
  if (store && uid) {
    try {
      store.setItem(getPendingAlertsStorageKey(uid), JSON.stringify(merged));
    } catch {
      // Ignore storage error
    }
  }
  return merged;
}

export function removePendingFamilyAlert(
  uid: string,
  alertId: string,
  storage?: SimpleStorageLike
): FamilyAlertDoc[] {
  const existing = loadPendingFamilyAlerts(uid, storage);
  const filtered = existing.filter((a) => a.id !== alertId);
  const store = getSafeStorage(storage);
  if (store && uid) {
    try {
      store.setItem(getPendingAlertsStorageKey(uid), JSON.stringify(filtered));
    } catch {
      // Ignore storage error
    }
  }
  return filtered;
}

export function formatAlertRelativeTimeBn(createdAtIso: string, now: Date = new Date()): string {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return '';
  const diffMin = Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60)));
  if (diffMin < 1) return 'এইমাত্র';
  if (diffMin < 60) return `${toBengaliNumber(diffMin)} মিনিট আগে`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${toBengaliNumber(diffHr)} ঘণ্টা আগে`;
  const diffDays = Math.floor(diffHr / 24);
  return `${toBengaliNumber(diffDays)} দিন আগে`;
}
