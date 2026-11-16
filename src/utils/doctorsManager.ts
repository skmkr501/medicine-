import { DoctorAppointment, DoctorProfile } from '../types';
import { toBengaliNumber } from './bengaliUtils';
import { toMillisSafe } from './sharedReports';
import { toLocalIsoDate } from './shoppingListCalculator';

const BENGALI_DIGIT_MAP: Record<string, string> = {
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

export function normalizeBengaliDigits(input: string): string {
  if (!input) return '';
  return String(input).replace(/[০-৯]/g, (ch) => BENGALI_DIGIT_MAP[ch] ?? ch);
}

export interface BdPhoneValidationResult {
  valid: boolean;
  isEmpty: boolean;
  cleaned: string;
  normalized: string;
  telHref: string | null;
  waUrl: string | null;
  warningBn?: string;
}

/**
 * Validates and normalizes Bangladeshi phone numbers while supporting Bengali digits (০-৯).
 * Non-blocking: returns a gentle Bengali warning when format looks unusual, while still
 * allowing save and clickable tel:/wa.me links if enough digits exist.
 */
export function validateBangladeshiPhone(rawInput?: string | null): BdPhoneValidationResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: true,
      isEmpty: true,
      cleaned: '',
      normalized: '',
      telHref: null,
      waUrl: null,
    };
  }

  const ascii = normalizeBengaliDigits(trimmed);
  const stripped = ascii.replace(/[\s\-().]/g, '');
  const digitsOnly = stripped.replace(/[^\d]/g, '');

  // Standard BD mobile patterns: 01[3-9]XXXXXXXX (11 digits) or 8801[3-9]XXXXXXXX (13 digits)
  let waDigits = '';
  let normalized = '';
  let valid = false;

  if (/^01[3-9]\d{8}$/.test(stripped)) {
    valid = true;
    normalized = stripped;
    waDigits = `88${stripped}`;
  } else if (/^\+?8801[3-9]\d{8}$/.test(stripped)) {
    valid = true;
    const local11 = digitsOnly.slice(2);
    normalized = `+88${local11}`;
    waDigits = `88${local11}`;
  } else {
    normalized = ascii;
    if (digitsOnly.length === 11 && digitsOnly.startsWith('01')) {
      waDigits = `88${digitsOnly}`;
    } else if (digitsOnly.length >= 6) {
      waDigits = digitsOnly;
    }
  }

  const telTarget = stripped.startsWith('+')
    ? `+${digitsOnly}`
    : digitsOnly || stripped;
  const telHref = digitsOnly.length >= 3 ? `tel:${telTarget}` : null;
  const waUrl = waDigits.length >= 8 ? `https://wa.me/${waDigits}` : null;

  return {
    valid,
    isEmpty: false,
    cleaned: stripped,
    normalized,
    telHref,
    waUrl,
    ...(valid
      ? {}
      : {
          warningBn:
            'নম্বরটি বাংলাদেশের সাধারণ মোবাইল ফরম্যাট (যেমন 017XXXXXXXX বা +88017XXXXXXXX) মনে হচ্ছে না — চাইলে তারপরও সংরক্ষণ করতে পারেন',
        }),
  };
}

export interface VisitCountdownInfo {
  label: string;
  status: 'today' | 'tomorrow' | 'upcoming' | 'past' | 'none';
  daysDiff: number | null;
}

/**
 * Computes human-readable Bengali countdown for a doctor's nextVisitDate (YYYY-MM-DD).
 */
export function formatVisitCountdownBn(
  nextVisitDate?: string | null,
  referenceDate: Date = new Date()
): VisitCountdownInfo {
  const clean = normalizeBengaliDigits((nextVisitDate || '').trim());
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { label: '', status: 'none', daysDiff: null };
  }

  const todayIso = toLocalIsoDate(referenceDate);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [vy, vm, vd] = clean.split('-').map(Number);

  const todayMidnight = Date.UTC(ty, tm - 1, td);
  const visitMidnight = Date.UTC(vy, vm - 1, vd);

  if (!Number.isFinite(todayMidnight) || !Number.isFinite(visitMidnight)) {
    return { label: '', status: 'none', daysDiff: null };
  }

  const daysDiff = Math.round((visitMidnight - todayMidnight) / (24 * 60 * 60 * 1000));
  if (daysDiff === 0) {
    return { label: 'আজ ভিজিট', status: 'today', daysDiff: 0 };
  }
  if (daysDiff === 1) {
    return { label: 'আগামীকাল ভিজিট', status: 'tomorrow', daysDiff: 1 };
  }
  if (daysDiff > 1) {
    return {
      label: `আর ${toBengaliNumber(daysDiff)} দিন`,
      status: 'upcoming',
      daysDiff,
    };
  }
  return {
    label: `${toBengaliNumber(Math.abs(daysDiff))} দিন আগে`,
    status: 'past',
    daysDiff,
  };
}

export function clampOptionalText(
  value: unknown,
  maxLength = 500
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export interface DoctorProfileInput {
  name: string;
  specialty?: string;
  phone?: string;
  whatsapp?: string;
  hospital?: string;
  address?: string;
  visitingHours?: string;
  forConditions?: string;
  patientIds?: string[];
  lastVisitDate?: string;
  nextVisitDate?: string;
  notes?: string;
  isEmergency?: boolean;
}

/**
 * Normalizes and validates a doctor profile payload so it strictly obeys Firestore rules:
 * - name trimmed 1..128 chars
 * - optional strings omitted (undefined) when empty, max 500 chars
 * - patientIds deduplicated & capped at 20 items (omitted if empty)
 * - isEmergency strictly boolean
 */
export function buildCleanDoctorInput(input: DoctorProfileInput): DoctorProfileInput {
  const cleanName = (input.name || '').trim().slice(0, 128);
  const cleanPatientIds = Array.isArray(input.patientIds)
    ? Array.from(
        new Set(
          input.patientIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [];

  const phoneNorm = input.phone?.trim()
    ? normalizeBengaliDigits(input.phone).trim().slice(0, 500)
    : undefined;
  const whatsappNorm = input.whatsapp?.trim()
    ? normalizeBengaliDigits(input.whatsapp).trim().slice(0, 500)
    : undefined;
  const lastVisit = input.lastVisitDate?.trim()
    ? normalizeBengaliDigits(input.lastVisitDate).trim().slice(0, 500)
    : undefined;
  const nextVisit = input.nextVisitDate?.trim()
    ? normalizeBengaliDigits(input.nextVisitDate).trim().slice(0, 500)
    : undefined;

  return {
    name: cleanName,
    specialty: clampOptionalText(input.specialty, 500),
    phone: phoneNorm || undefined,
    whatsapp: whatsappNorm || undefined,
    hospital: clampOptionalText(input.hospital, 500),
    address: clampOptionalText(input.address, 500),
    visitingHours: clampOptionalText(input.visitingHours, 500),
    forConditions: clampOptionalText(input.forConditions, 500),
    patientIds: cleanPatientIds.length > 0 ? cleanPatientIds : undefined,
    lastVisitDate: lastVisit || undefined,
    nextVisitDate: nextVisit || undefined,
    notes: clampOptionalText(input.notes, 500),
    isEmergency: Boolean(input.isEmergency),
  };
}

/**
 * Sorts doctors with ⭐ Emergency doctors ALWAYS pinned first,
 * followed by soonest upcoming nextVisitDate, then alphabetical Bengali name.
 */
export function sortDoctors(
  doctors: DoctorProfile[],
  referenceDate: Date = new Date()
): DoctorProfile[] {
  const todayIso = toLocalIsoDate(referenceDate);

  return [...doctors].sort((a, b) => {
    const aEmerg = a.isEmergency ? 1 : 0;
    const bEmerg = b.isEmergency ? 1 : 0;
    if (aEmerg !== bEmerg) return bEmerg - aEmerg;

    const aNext = (a.nextVisitDate || '').trim();
    const bNext = (b.nextVisitDate || '').trim();
    const aUpcoming = aNext && aNext >= todayIso;
    const bUpcoming = bNext && bNext >= todayIso;

    if (aUpcoming && bUpcoming && aNext !== bNext) {
      return aNext.localeCompare(bNext);
    }
    if (aUpcoming !== bUpcoming) {
      return aUpcoming ? -1 : 1;
    }

    return (a.name || '').localeCompare(b.name || '', 'bn');
  });
}

export function filterDoctors(
  doctors: DoctorProfile[],
  searchQuery: string,
  patientIdFilter: string = 'all'
): DoctorProfile[] {
  const normalizedQuery = normalizeBengaliDigits((searchQuery || '').trim().toLowerCase());

  return doctors.filter((docItem) => {
    if (patientIdFilter && patientIdFilter !== 'all') {
      const assignedIds = Array.isArray(docItem.patientIds) ? docItem.patientIds : [];
      if (patientIdFilter === 'unassigned') {
        if (assignedIds.length > 0) return false;
      } else if (!assignedIds.includes(patientIdFilter)) {
        return false;
      }
    }

    if (!normalizedQuery) return true;

    const haystack = [
      docItem.name,
      docItem.specialty,
      docItem.hospital,
      docItem.address,
      docItem.forConditions,
      docItem.phone,
      docItem.whatsapp,
      docItem.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      haystack.includes(normalizedQuery) ||
      normalizeBengaliDigits(haystack).includes(normalizedQuery)
    );
  });
}

/**
 * Picks the best emergency doctor for a patient profile:
 * 1. ⭐ Emergency doctor assigned to this patient
 * 2. ⭐ Emergency doctor not restricted to another patient
 * 3. Any ⭐ Emergency doctor
 */
export function findEmergencyDoctorForPatient(
  doctors: DoctorProfile[],
  patientId?: string | null
): DoctorProfile | null {
  const emergencyDocs = doctors.filter((d) => d.isEmergency);
  if (emergencyDocs.length === 0) return null;

  if (patientId) {
    const exactMatch = emergencyDocs.find((d) => d.patientIds?.includes(patientId));
    if (exactMatch) return exactMatch;

    const generalMatch = emergencyDocs.find((d) => !d.patientIds || d.patientIds.length === 0);
    if (generalMatch) return generalMatch;
  }

  return emergencyDocs[0];
}

/**
 * Picks the best doctor name/summary for a patient's Emergency QR card:
 * Prioritizes ⭐ emergency doctor -> patient's assigned doctor -> any saved doctor.
 */
export function findDoctorForEmergencyQr(
  doctors: DoctorProfile[],
  patientId?: string | null
): DoctorProfile | null {
  const emerg = findEmergencyDoctorForPatient(doctors, patientId);
  if (emerg) return emerg;

  if (patientId) {
    const assigned = doctors.find((d) => d.patientIds?.includes(patientId));
    if (assigned) return assigned;
  }

  return doctors[0] || null;
}

export function formatEmergencyDoctorLabelForQr(doctor: DoctorProfile): string {
  const parts = [doctor.name];
  if (doctor.specialty) parts.push(doctor.specialty);
  if (doctor.phone) parts.push(doctor.phone);
  return parts.join(' · ').slice(0, 500);
}

/**
 * Checks whether a doctor with roughly the same name is already in the directory
 * (ignores leading "ডা." / "Dr." prefixes and extra spaces so scan suggestions don't nag).
 */
export function normalizeDoctorNameKey(rawName: string): string {
  return (rawName || '')
    .trim()
    .toLowerCase()
    .replace(/^(ডা\.?|ডা:|dr\.?\s*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function doctorExistsByName(
  doctors: DoctorProfile[],
  candidateName?: string | null
): boolean {
  const key = normalizeDoctorNameKey(candidateName || '');
  if (!key) return false;
  return doctors.some((d) => {
    const existingKey = normalizeDoctorNameKey(d.name);
    return existingKey === key || existingKey.includes(key) || key.includes(existingKey);
  });
}

/**
 * Builds an appointment creation payload when a doctor's nextVisitDate is set.
 */
export function buildDoctorNextVisitAppointmentPayload(
  doctor: Pick<
    DoctorProfile,
    'name' | 'specialty' | 'hospital' | 'address' | 'visitingHours' | 'forConditions' | 'notes' | 'patientIds' | 'nextVisitDate'
  >,
  preferredPatientId?: string
): Omit<DoctorAppointment, 'id' | 'createdAt'> | null {
  const dateStr = normalizeBengaliDigits((doctor.nextVisitDate || '').trim());
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const location =
    [doctor.hospital, doctor.address].filter(Boolean).join(', ') || 'চেম্বার / হাসপাতাল';
  const patientId = preferredPatientId || doctor.patientIds?.[0] || '';

  return {
    patientId,
    doctorName: doctor.name.trim(),
    ...(doctor.specialty ? { specialty: doctor.specialty } : {}),
    appointmentDate: dateStr,
    appointmentTime: doctor.visitingHours?.trim() || '১০:০০ AM',
    location,
    ...(doctor.forConditions || doctor.notes
      ? { notes: doctor.forConditions || doctor.notes }
      : {}),
    status: 'upcoming',
  };
}

// ============================================================================
// Offline-First Per-UID Local Cache & Cloud Merge Helpers (Zero-Listener Architecture)
// ============================================================================

export function getDoctorsCacheKey(uid: string | null | undefined): string {
  return uid
    ? `shasthobondhu_doctors_cloud_v1_${uid}`
    : 'shasthobondhu_doctors_guest_v1';
}

function resolveDoctorStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
    return (globalThis as { localStorage?: Storage }).localStorage || null;
  }
  return null;
}

export function loadCachedDoctors(
  uid: string | null | undefined,
  storage?: Pick<Storage, 'getItem'> | null
): DoctorProfile[] {
  const target = storage ?? resolveDoctorStorage();
  if (!target) return [];
  try {
    const raw = target.getItem(getDoctorsCacheKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DoctorProfile[]) : [];
  } catch {
    return [];
  }
}

export function saveCachedDoctors(
  uid: string | null | undefined,
  doctors: DoctorProfile[],
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const target = storage ?? resolveDoctorStorage();
  if (!target) return;
  try {
    target.setItem(getDoctorsCacheKey(uid), JSON.stringify(doctors));
  } catch {
    // ignore storage quota errors
  }
}

export function clearCachedDoctors(
  uid: string | null | undefined,
  storage?: Pick<Storage, 'removeItem'> | null
): void {
  const target = storage ?? resolveDoctorStorage();
  if (!target) return;
  try {
    target.removeItem(getDoctorsCacheKey(uid));
  } catch {
    // ignore storage errors
  }
}

export interface DoctorsSyncMergeResult {
  merged: DoctorProfile[];
  toCreateInCloud: DoctorProfile[];
  toUpdateInCloud: DoctorProfile[];
}

/**
 * Bidirectional timestamp-aware merge used by "এখনই সিঙ্ক করুন":
 * - Preserves newer edits whether they originated locally offline/quota-paused or on another device.
 * - Separates cloud-missing docs (toCreate) from locally newer existing docs (toUpdate without touching createdAt).
 */
export function mergeLocalAndCloudDoctors(
  localDocs: DoctorProfile[],
  cloudDocs: DoctorProfile[]
): DoctorsSyncMergeResult {
  const cloudById = new Map<string, DoctorProfile>();
  for (const c of cloudDocs) {
    cloudById.set(c.id, c);
  }

  const localById = new Map<string, DoctorProfile>();
  for (const l of localDocs) {
    localById.set(l.id, l);
  }

  const merged: DoctorProfile[] = [];
  const toCreateInCloud: DoctorProfile[] = [];
  const toUpdateInCloud: DoctorProfile[] = [];

  for (const localDoc of localDocs) {
    const cloudDoc = cloudById.get(localDoc.id);
    if (!cloudDoc) {
      merged.push(localDoc);
      toCreateInCloud.push(localDoc);
      continue;
    }

    const localMs = toMillisSafe(localDoc.updatedAt) || toMillisSafe(localDoc.createdAt);
    const cloudMs = toMillisSafe(cloudDoc.updatedAt) || toMillisSafe(cloudDoc.createdAt);

    if (localMs > cloudMs) {
      merged.push({
        ...localDoc,
        createdAt: cloudDoc.createdAt || localDoc.createdAt,
      });
      toUpdateInCloud.push(localDoc);
    } else {
      merged.push(cloudDoc);
    }
  }

  for (const cloudDoc of cloudDocs) {
    if (!localById.has(cloudDoc.id)) {
      merged.push(cloudDoc);
    }
  }

  return {
    merged: sortDoctors(merged),
    toCreateInCloud,
    toUpdateInCloud,
  };
}
