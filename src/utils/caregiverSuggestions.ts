import {
  CaregiverFullMedicineItem,
  CaregiverLinkDoc,
  CaregiverSuggestedMedicinePayload,
  CaregiverSuggestionDoc,
  CaregiverSuggestionKind,
  DoseSchedule,
  MealTiming,
  Medicine,
  MedicineType,
  TimeSlot,
} from '../types';
import { toBengaliNumber } from './bengaliUtils';
import { toLocalIsoDate } from './shoppingListCalculator';

export const MAX_DAILY_CAREGIVER_SUGGESTIONS = 10;
export const SUGGESTION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SUGGESTION_TEXT_LIMIT = 500;

export const SUGGESTION_SLOT_ORDER: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];

export const SUGGESTION_DEFAULT_SLOT_TIMES: Record<TimeSlot, string> = {
  সকাল: '08:00 AM',
  দুপুর: '01:30 PM',
  সন্ধ্যা: '06:00 PM',
  রাত: '09:30 PM',
};

export interface CaregiverSuggestionFormInput {
  kind: CaregiverSuggestionKind;
  brandName: string;
  genericName?: string;
  strength?: string;
  type: MedicineType;
  dosage: string;
  timeSlots: TimeSlot[];
  schedules?: DoseSchedule[];
  mealTiming: MealTiming;
  durationDays?: number;
  isChronic?: boolean;
  stock: number;
  unit?: string;
  targetMedicineId?: string;
  targetMedicineName?: string;
  note?: string;
}

function clampText(val: unknown, maxLen: number): string {
  return String(val ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function stripUndefinedShallow<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export function resolveUnitFromMedicineType(type: MedicineType): string {
  switch (type) {
    case 'সিরাপ':
    case 'চোখের ড্রপ':
      return 'মি.লি.';
    case 'ইনহেলার':
      return 'পাফ';
    case 'ইনসুলিন/ইনজেকশন':
      return 'ভায়াল';
    case 'ক্যাপসুল':
      return 'টি';
    case 'মলম/জেল':
      return 'টিউব';
    default:
      return 'টি';
  }
}

export function mapDosageFormToMedicineType(dosageForm?: string): MedicineType {
  const f = (dosageForm || '').toLowerCase();
  if (f.includes('ক্যাপসুল') || f.includes('capsule')) return 'ক্যাপসুল';
  if (f.includes('সিরাপ') || f.includes('syrup') || f.includes('suspension')) return 'সিরাপ';
  if (f.includes('ইনজেকশন') || f.includes('ইনসুলিন') || f.includes('injection') || f.includes('insulin')) return 'ইনসুলিন/ইনজেকশন';
  if (f.includes('ড্রপ') || f.includes('drop')) return 'চোখের ড্রপ';
  if (f.includes('ইনহেলার') || f.includes('inhaler')) return 'ইনহেলার';
  if (f.includes('ক্রিম') || f.includes('মলম') || f.includes('জেল') || f.includes('cream') || f.includes('ointment') || f.includes('gel')) {
    return 'মলম/জেল';
  }
  if (f.includes('ট্যাবলেট') || f.includes('tablet')) return 'ট্যাবলেট';
  return 'ট্যাবলেট';
}

export function isSuggestionExpired(createdAtMs: number, nowMs: number = Date.now()): boolean {
  if (!createdAtMs || !Number.isFinite(createdAtMs)) return false;
  return nowMs - createdAtMs >= SUGGESTION_EXPIRY_MS;
}

export function filterVisiblePendingSuggestions(
  suggestions: CaregiverSuggestionDoc[],
  nowMs: number = Date.now()
): CaregiverSuggestionDoc[] {
  return suggestions
    .filter((s) => s.status === 'pending' && !isSuggestionExpired(s.createdAtMs, nowMs))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

export function buildSuggestionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `sug_${Date.now()}_${rand}`;
}

export function buildSchedulesFromSlots(
  timeSlots: TimeSlot[],
  dosage: string,
  existingSchedules?: DoseSchedule[]
): DoseSchedule[] {
  const uniqueSlots = Array.from(
    new Set(
      (timeSlots && timeSlots.length > 0 ? timeSlots : ['সকাল' as TimeSlot]).filter((s) =>
        SUGGESTION_SLOT_ORDER.includes(s)
      )
    )
  ).sort((a, b) => SUGGESTION_SLOT_ORDER.indexOf(a) - SUGGESTION_SLOT_ORDER.indexOf(b));

  const cleanDosage = clampText(dosage, 64) || '১টি';

  return uniqueSlots.map((slot, idx) => {
    const matched = existingSchedules?.find((es) => es.timeSlot === slot);
    return {
      id: matched?.id || `slot_${idx + 1}_${slot}`,
      timeSlot: slot,
      time: matched?.time || SUGGESTION_DEFAULT_SLOT_TIMES[slot],
      dosage: cleanDosage,
    };
  });
}

export function buildCaregiverSuggestionPayload(params: {
  id?: string;
  link: CaregiverLinkDoc;
  caregiverUid: string;
  caregiverName: string;
  input: CaregiverSuggestionFormInput;
  nowMs?: number;
}): CaregiverSuggestionDoc {
  const nowMs = params.nowMs ?? Date.now();
  const id = params.id || buildSuggestionId();
  const brandName = clampText(params.input.brandName, 128);
  if (!brandName) {
    throw new Error('অনুগ্রহ করে ওষুধের নাম লিখুন।');
  }

  const kind: CaregiverSuggestionKind = params.input.kind;
  if ((kind === 'edit' || kind === 'stop') && !params.link.allowFullView) {
    throw new Error('রোগীর "সব দেখার অনুমতি" চালু না থাকলে বদল বা বন্ধের প্রস্তাব পাঠানো যাবে না।');
  }

  const validSlots: TimeSlot[] =
    params.input.timeSlots && params.input.timeSlots.length > 0
      ? params.input.timeSlots
      : ['সকাল'];

  const cleanDosage = clampText(params.input.dosage, 64) || '১টি';
  const medType: MedicineType = params.input.type || 'ট্যাবলেট';
  const cleanUnit = clampText(params.input.unit, 32) || resolveUnitFromMedicineType(medType);
  const isChronic = Boolean(params.input.isChronic);
  const rawDays = Number(params.input.durationDays);
  const durationDays =
    isChronic || !Number.isFinite(rawDays) || rawDays <= 0
      ? undefined
      : Math.min(365, Math.max(1, Math.round(rawDays)));

  const rawStock = Number(params.input.stock);
  const stock = Number.isFinite(rawStock) && rawStock >= 0 ? Math.min(9999, Math.round(rawStock)) : 0;

  const schedules = buildSchedulesFromSlots(validSlots, cleanDosage, params.input.schedules);

  const medicinePayload: CaregiverSuggestedMedicinePayload = stripUndefinedShallow({
    brandName,
    genericName: clampText(params.input.genericName, 256) || undefined,
    strength: clampText(params.input.strength, 64) || undefined,
    type: medType,
    dosage: cleanDosage,
    timeSlots: schedules.map((s) => s.timeSlot),
    schedules,
    mealTiming: params.input.mealTiming || 'খাওয়ার পরে',
    durationDays,
    isChronic,
    stock,
    unit: cleanUnit,
  });

  const cleanNote = clampText(params.input.note, SUGGESTION_TEXT_LIMIT);
  const cleanTargetId = clampText(params.input.targetMedicineId, 128);
  const cleanTargetName = clampText(params.input.targetMedicineName, 128);

  return stripUndefinedShallow({
    id,
    patientUid: params.link.patientUid,
    caregiverUid: params.caregiverUid,
    linkId: params.link.id,
    caregiverName: clampText(params.caregiverName, 128) || 'পরিবারের যত্নকারী',
    patientName: clampText(params.link.patientName, 128) || undefined,
    kind,
    medicine: medicinePayload,
    targetMedicineId: cleanTargetId || undefined,
    targetMedicineName: cleanTargetName || undefined,
    note: cleanNote || undefined,
    status: 'pending' as const,
    createdAt: new Date(nowMs).toISOString(),
    createdAtMs: nowMs,
  });
}

export function buildSuggestionSummaryHeadlineBn(suggestion: CaregiverSuggestionDoc): string {
  const caregiver = suggestion.caregiverName || 'পরিবারের যত্নকারী';
  const m = suggestion.medicine;
  const medTitle = m.strength ? `${m.brandName} ${m.strength}` : m.brandName;

  if (suggestion.kind === 'stop') {
    const targetTitle = suggestion.targetMedicineName || medTitle;
    return `${caregiver} একটি ওষুধ বন্ধ করার প্রস্তাব পাঠিয়েছেন: ${targetTitle}`;
  }

  const slotCount = m.timeSlots?.length || m.schedules?.length || 1;
  const freqLabel = `দিনে ${toBengaliNumber(slotCount)} বার`;
  const durationLabel = m.isChronic
    ? 'নিয়মিত (চলমান)'
    : m.durationDays
    ? `${toBengaliNumber(m.durationDays)} দিন`
    : '';

  const detailsParts = [freqLabel, m.mealTiming, durationLabel].filter(Boolean);
  const actionWord =
    suggestion.kind === 'edit' ? 'একটি ওষুধ বদল করতে চান' : 'একটি ওষুধ যোগ করতে চান';

  return `${caregiver} ${actionWord}: ${medTitle}, ${detailsParts.join(', ')}`;
}

export function findTargetMedicineForSuggestion(
  medicines: Medicine[],
  suggestion: CaregiverSuggestionDoc
): Medicine | null {
  if (suggestion.targetMedicineId) {
    const byId = medicines.find((m) => m.id === suggestion.targetMedicineId);
    if (byId) return byId;
  }
  const targetName = (suggestion.targetMedicineName || suggestion.medicine.brandName || '')
    .trim()
    .toLowerCase();
  if (!targetName) return null;
  return (
    medicines.find(
      (m) => m.status === 'active' && m.brandName.trim().toLowerCase() === targetName
    ) ||
    medicines.find((m) => m.brandName.trim().toLowerCase() === targetName) ||
    null
  );
}

export function buildMedicineInputFromSuggestion(params: {
  suggestion: CaregiverSuggestionDoc;
  edited?: Partial<CaregiverSuggestedMedicinePayload> & {
    assignedPatientId?: string;
    instructions?: string;
  };
  assignedPatientId?: string;
}): Omit<Medicine, 'id'> {
  const base = params.suggestion.medicine;
  const ed = params.edited || {};
  const brandName = clampText(ed.brandName ?? base.brandName, 128) || base.brandName;
  const type: MedicineType = ed.type ?? base.type ?? 'ট্যাবলেট';
  const dosage = clampText(ed.dosage ?? base.dosage, 64) || '১টি';
  const timeSlots = ed.timeSlots && ed.timeSlots.length > 0 ? ed.timeSlots : base.timeSlots;
  const schedules =
    ed.schedules && ed.schedules.length > 0
      ? ed.schedules
      : buildSchedulesFromSlots(timeSlots, dosage, base.schedules);
  const isChronic = ed.isChronic !== undefined ? Boolean(ed.isChronic) : Boolean(base.isChronic);
  const rawDays = ed.durationDays ?? base.durationDays;
  const durationDays =
    isChronic || !rawDays || !Number.isFinite(Number(rawDays))
      ? undefined
      : Math.max(1, Math.round(Number(rawDays)));
  const rawStock = ed.stock ?? base.stock ?? 0;
  const stock = Number.isFinite(Number(rawStock)) && Number(rawStock) >= 0 ? Math.round(Number(rawStock)) : 0;

  return stripUndefinedShallow({
    brandName,
    genericName: clampText(ed.genericName ?? base.genericName, 256) || 'সাধারণ ওষুধ',
    type,
    strength: clampText(ed.strength ?? base.strength, 64) || 'নির্দিষ্ট মাত্রা',
    mealTiming: ed.mealTiming ?? base.mealTiming ?? 'খাওয়ার পরে',
    assignedPatientId: params.edited?.assignedPatientId ?? params.assignedPatientId,
    schedules,
    stock,
    minStockAlert: 5,
    unit: clampText(ed.unit ?? base.unit, 32) || resolveUnitFromMedicineType(type),
    startDate: toLocalIsoDate(new Date()),
    durationDays,
    isChronic,
    instructions: clampText(
      params.edited?.instructions ?? params.suggestion.note,
      SUGGESTION_TEXT_LIMIT
    ) || undefined,
    status: 'active' as const,
    colorTag: 'teal',
  });
}

export function buildFormDefaultsFromSharedMedicine(
  med: CaregiverFullMedicineItem
): CaregiverSuggestionFormInput {
  const schedules = Array.isArray(med.schedules) ? med.schedules : [];
  const timeSlots: TimeSlot[] =
    schedules.length > 0
      ? Array.from(new Set(schedules.map((s) => s.timeSlot)))
      : ['সকাল'];
  const firstDosage = schedules[0]?.dosage || '১টি';
  const medType: MedicineType = med.type || 'ট্যাবলেট';

  return {
    kind: 'edit',
    brandName: med.brandName,
    genericName: med.genericName || '',
    strength: med.strength || '',
    type: medType,
    dosage: firstDosage,
    timeSlots,
    schedules,
    mealTiming: (med.mealTiming as MealTiming) || 'খাওয়ার পরে',
    durationDays: med.isChronic ? undefined : med.durationDays || 7,
    isChronic: Boolean(med.isChronic),
    stock: typeof med.stock === 'number' ? med.stock : 0,
    unit: med.unit || resolveUnitFromMedicineType(medType),
    targetMedicineId: med.id,
    targetMedicineName: med.brandName,
    note: '',
  };
}

// ============================================================================
// Daily 10-suggestion limit tracking (localStorage + sent history merge)
// ============================================================================

const DAILY_COUNT_STORAGE_PREFIX = 'shasthobondhu_cg_sug_count_';
const ANNOUNCED_SUGGESTIONS_PREFIX = 'shasthobondhu_cg_sug_announced_';

interface StoredDailyCounter {
  date: string;
  count: number;
}

export function getCaregiverDailySuggestionCount(
  caregiverUid: string,
  sentSuggestions: CaregiverSuggestionDoc[] = [],
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null,
  dateIso: string = toLocalIsoDate(new Date())
): number {
  let localCount = 0;
  if (storage && caregiverUid) {
    try {
      const raw = storage.getItem(`${DAILY_COUNT_STORAGE_PREFIX}${caregiverUid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDailyCounter;
        if (parsed && parsed.date === dateIso && typeof parsed.count === 'number') {
          localCount = parsed.count;
        }
      }
    } catch {
      // ignore storage read error
    }
  }

  const cloudTodayCount = sentSuggestions.filter((s) => {
    if (!s.createdAtMs) return false;
    return toLocalIsoDate(new Date(s.createdAtMs)) === dateIso;
  }).length;

  return Math.max(localCount, cloudTodayCount);
}

export function incrementCaregiverDailySuggestionCount(
  caregiverUid: string,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null,
  dateIso: string = toLocalIsoDate(new Date())
): number {
  const current = getCaregiverDailySuggestionCount(caregiverUid, [], storage, dateIso);
  const next = current + 1;
  if (storage && caregiverUid) {
    try {
      const payload: StoredDailyCounter = { date: dateIso, count: next };
      storage.setItem(`${DAILY_COUNT_STORAGE_PREFIX}${caregiverUid}`, JSON.stringify(payload));
    } catch {
      // ignore storage write error
    }
  }
  return next;
}

export function loadAnnouncedSuggestionIds(
  patientUid: string,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): Set<string> {
  if (!storage || !patientUid) return new Set();
  try {
    const raw = storage.getItem(`${ANNOUNCED_SUGGESTIONS_PREFIX}${patientUid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function markSuggestionsAnnounced(
  patientUid: string,
  ids: string[],
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage || !patientUid || ids.length === 0) return;
  try {
    const existing = loadAnnouncedSuggestionIds(patientUid, storage);
    ids.forEach((id) => existing.add(id));
    const trimmed = Array.from(existing).slice(-50);
    storage.setItem(`${ANNOUNCED_SUGGESTIONS_PREFIX}${patientUid}`, JSON.stringify(trimmed));
  } catch {
    // ignore storage write error
  }
}
