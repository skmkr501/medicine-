import {
  Medicine,
  PatientProfile,
  HealthRecord,
  DoctorAppointment,
  SharedReportExpiryHours,
  SharedReportSectionSelection,
  SharedReportSections,
  SharedReportMedicineItem,
  SharedReportReadingItem,
  SharedReportAppointmentItem,
  SharedReportDoc,
} from '../types';
import { formatBengaliDate, toBengaliNumber } from './bengaliUtils';

export const SHARED_REPORT_EXPIRY_OPTIONS: Array<{
  hours: SharedReportExpiryHours;
  label: string;
}> = [
  { hours: 24, label: '২৪ ঘণ্টা' },
  { hours: 168, label: '৭ দিন' },
  { hours: 720, label: '৩০ দিন' },
];

export const DEFAULT_SHARED_REPORT_SECTIONS: SharedReportSectionSelection = {
  medicines: true,
  allergiesEmergency: true,
  recentReadings: false,
  appointments: false,
};

export const SHARED_REPORT_MAX_AGE_DAYS = 90;
export const SHARED_REPORT_DELETE_AFTER_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export const SHARED_REPORT_VIEWER_DISCLAIMER =
  'স্বাস্থ্যবন্ধু থেকে শেয়ার করা, তথ্য রোগীর দেওয়া, চিকিৎসার সিদ্ধান্তের আগে ডাক্তারের পরামর্শ নিন';

export const SHARED_REPORT_UNAVAILABLE_MSG =
  'এই লিংকের মেয়াদ শেষ হয়েছে বা বাতিল হয়েছে';

/**
 * Generates a cryptographically strong unguessable base64url token (>= 128-bit entropy).
 * Never uses Math.random() or predictable user/patient identifiers.
 */
export function generateShareToken(byteLength = 18): string {
  const safeBytes = Math.max(16, byteLength);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('নিরাপদ লিংক তৈরির জন্য ব্রাউজার নিরাপত্তা সুবিধা পাওয়া যায়নি');
  }
  const bytes = new Uint8Array(safeBytes);
  cryptoObj.getRandomValues(bytes);

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  let base64 = '';
  if (typeof btoa === 'function') {
    base64 = btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(bytes).toString('base64');
  } else {
    throw new Error('নিরাপদ লিংক এনকোডিং সমর্থিত নয়');
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isValidShareTokenFormat(token: string): boolean {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(token.trim());
}

export function extractSharedReportTokenFromPath(pathname: string): string | null {
  if (!pathname || typeof pathname !== 'string') return null;
  const cleaned = pathname.split('?')[0].split('#')[0];
  const match = cleaned.match(/^\/r\/([A-Za-z0-9_-]{1,128})\/?$/);
  if (!match) return null;
  return match[1];
}

export function buildSharedReportUrl(token: string, origin?: string): string {
  const cleanOrigin = (
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  ).replace(/\/+$/g, '');
  return `${cleanOrigin}/r/${token}`;
}

export function toMillisSafe(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    const obj = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof obj.toMillis === 'function') {
      try {
        return obj.toMillis();
      } catch {
        return 0;
      }
    }
    if (typeof obj.seconds === 'number') {
      const ns = typeof obj.nanoseconds === 'number' ? obj.nanoseconds : 0;
      return obj.seconds * 1000 + Math.floor(ns / 1_000_000);
    }
  }
  return 0;
}

export function getSharedReportStatus(
  report: Pick<SharedReportDoc, 'revoked' | 'expiresAt' | 'expiresAtMs'>,
  nowMs = Date.now()
): 'active' | 'revoked' | 'expired' {
  if (report.revoked) return 'revoked';
  const expMs = report.expiresAtMs ?? toMillisSafe(report.expiresAt);
  if (!expMs || expMs <= nowMs) return 'expired';
  return 'active';
}

export function canDeleteExpiredSharedReport(
  report: Pick<SharedReportDoc, 'revoked' | 'expiresAt' | 'expiresAtMs'>,
  nowMs = Date.now()
): boolean {
  const expMs = report.expiresAtMs ?? toMillisSafe(report.expiresAt);
  if (!expMs) return false;
  return nowMs - expMs >= SHARED_REPORT_DELETE_AFTER_EXPIRY_MS;
}

export function buildSharedReportWhatsAppUrl(
  reportUrl: string,
  patientName: string,
  expiresAtMs: number
): string {
  const expiryLabel = formatBengaliDate(new Date(expiresAtMs));
  const msg =
    `📋 স্বাস্থ্যবন্ধু — ${patientName}-এর স্বাস্থ্য ও ওষুধের রিপোর্ট\n\n` +
    `নিরাপদ রিপোর্ট লিংক (লগইন লাগবে না):\n${reportUrl}\n\n` +
    `মেয়াদ শেষ: ${expiryLabel}\n` +
    `⚠️ সতর্কতা: লিংকটি পেলে যে কেউ এই রিপোর্ট দেখতে পারবেন। শুধু বিশ্বস্ত ডাক্তার বা পরিবারের সাথে শেয়ার করুন।`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

export function getIncludedSectionLabels(sections: SharedReportSections): string[] {
  const labels: string[] = [];
  if (sections.medicines !== undefined) labels.push('চলমান ওষুধ');
  if (sections.allergiesEmergency !== undefined) labels.push('অ্যালার্জি ও জরুরি তথ্য');
  if (sections.recentReadings !== undefined) labels.push('সাম্প্রতিক রিডিং');
  if (sections.appointments !== undefined) labels.push('অ্যাপয়েন্টমেন্ট');
  return labels;
}

export function formatSharedReportDateTime(ms: number): string {
  if (!ms || ms <= 0) return 'অজানা';
  const d = new Date(ms);
  const datePart = formatBengaliDate(d);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = toBengaliNumber(String(hours).padStart(2, '0'));
  const mm = toBengaliNumber(String(minutes).padStart(2, '0'));
  return `${datePart}, ${hh}:${mm} ${period}`;
}

export interface BuildSnapshotParams {
  ownerUid: string;
  token: string;
  patient: PatientProfile;
  medicines: Medicine[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  selection: SharedReportSectionSelection;
  expiryHours: SharedReportExpiryHours;
  nowMs?: number;
}

export interface BuiltSharedReportSnapshot {
  ownerUid: string;
  token: string;
  createdAtMs: number;
  expiresAtMs: number;
  patientName: string;
  age: number;
  gender: string;
  relation: string;
  sections: SharedReportSections;
  revoked: false;
}

export function buildSharedReportSnapshot(
  params: BuildSnapshotParams
): BuiltSharedReportSnapshot {
  const {
    ownerUid,
    token,
    patient,
    medicines,
    healthRecords,
    appointments,
    selection,
    expiryHours,
    nowMs = Date.now(),
  } = params;

  const hasAnySection =
    selection.medicines ||
    selection.allergiesEmergency ||
    selection.recentReadings ||
    selection.appointments;

  if (!hasAnySection) {
    throw new Error('অন্তত একটি তথ্য বিভাগ নির্বাচন করুন');
  }

  const sections: SharedReportSections = {};

  if (selection.medicines) {
    const activeMeds = medicines
      .filter((m) => m.status === 'active' && m.assignedPatientId === patient.id)
      .slice(0, 40);

    const items: SharedReportMedicineItem[] = activeMeds.map((m) => {
      const schedulesText = (m.schedules || [])
        .map((s) => `${s.timeSlot} (${s.time}) — ${s.dosage}`)
        .join(', ');
      const item: SharedReportMedicineItem = {
        brandName: (m.brandName || '').slice(0, 128),
        genericName: (m.genericName || '').slice(0, 200),
        strength: (m.strength || '').slice(0, 64),
        type: (m.type || '').slice(0, 64),
        mealTiming: (m.mealTiming || '').slice(0, 64),
        schedulesText: schedulesText.slice(0, 256),
      };
      if (m.instructions && m.instructions.trim()) {
        item.instructions = m.instructions.trim().slice(0, 256);
      }
      return item;
    });
    sections.medicines = items;
  }

  if (selection.allergiesEmergency) {
    sections.allergiesEmergency = {
      bloodGroup: (patient.bloodGroup || 'অজানা').slice(0, 16),
      allergies: (patient.allergies || []).slice(0, 20).map((a) => String(a).slice(0, 100)),
      chronicConditions: (patient.chronicConditions || [])
        .slice(0, 20)
        .map((c) => String(c).slice(0, 100)),
      ...(patient.emergencyContact && patient.emergencyContact.trim()
        ? { emergencyContact: patient.emergencyContact.trim().slice(0, 64) }
        : {}),
    };
  }

  if (selection.recentReadings) {
    const sortedRecords = [...healthRecords]
      .filter((r) => r.patientId === patient.id)
      .sort((a, b) =>
        `${b.recordDate} ${b.recordTime || ''}`.localeCompare(
          `${a.recordDate} ${a.recordTime || ''}`
        )
      )
      .slice(0, 15);

    const items: SharedReportReadingItem[] = sortedRecords.map((r) => ({
      recordDate: r.recordDate.slice(0, 32),
      ...(r.recordTime ? { recordTime: r.recordTime.slice(0, 32) } : {}),
      ...(typeof r.systolic === 'number' ? { systolic: r.systolic } : {}),
      ...(typeof r.diastolic === 'number' ? { diastolic: r.diastolic } : {}),
      ...(typeof r.bloodSugar === 'number' ? { bloodSugar: r.bloodSugar } : {}),
      ...(r.sugarType ? { sugarType: r.sugarType.slice(0, 32) } : {}),
      ...(typeof r.weight === 'number' ? { weight: r.weight } : {}),
      ...(r.notes ? { notes: r.notes.slice(0, 200) } : {}),
    }));
    sections.recentReadings = items;
  }

  if (selection.appointments) {
    const patientAppointments = [...appointments]
      .filter(
        (a) =>
          a.status !== 'cancelled' &&
          (!a.patientId || a.patientId === patient.id)
      )
      .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
      .slice(0, 15);

    const items: SharedReportAppointmentItem[] = patientAppointments.map((a) => ({
      doctorName: (a.doctorName || '').slice(0, 128),
      ...(a.specialty ? { specialty: a.specialty.slice(0, 128) } : {}),
      appointmentDate: (a.appointmentDate || '').slice(0, 32),
      appointmentTime: (a.appointmentTime || '').slice(0, 32),
      location: (a.location || '').slice(0, 200),
      ...(a.notes ? { notes: a.notes.slice(0, 256) } : {}),
    }));
    sections.appointments = items;
  }

  const expiresAtMs = nowMs + expiryHours * 60 * 60 * 1000;

  return {
    ownerUid,
    token,
    createdAtMs: nowMs,
    expiresAtMs,
    patientName: (patient.name || 'রোগী').trim().slice(0, 128),
    age: typeof patient.age === 'number' && Number.isFinite(patient.age) ? patient.age : 0,
    gender: (patient.gender || 'অন্যান্য').slice(0, 32),
    relation: (patient.relation || 'নিজ').slice(0, 64),
    sections,
    revoked: false,
  };
}
