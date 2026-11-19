import {
  DoctorAppointment,
  DoctorProfile,
  DoseLog,
  HealthRecord,
  Medicine,
  PatientProfile,
  PhonebookEntry,
  ReminderSettings,
} from '../types';

export interface LocalBackupPayload {
  patients?: PatientProfile[];
  medicines?: Medicine[];
  doseLogs?: DoseLog[];
  healthRecords?: HealthRecord[];
  appointments?: DoctorAppointment[];
  doctors?: DoctorProfile[];
  phonebook?: PhonebookEntry[];
  settings?: Partial<ReminderSettings>;
  exportDate?: string;
  appName?: string;
}

export interface BackupCurrentSnapshot {
  patients: PatientProfile[];
  medicines: Medicine[];
  doseLogs: DoseLog[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  doctors: DoctorProfile[];
  phonebook?: PhonebookEntry[];
  settings: ReminderSettings;
}

export interface MergedBackupResult {
  patients: PatientProfile[];
  medicines: Medicine[];
  doseLogs: DoseLog[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  doctors: DoctorProfile[];
  phonebook: PhonebookEntry[];
  settings: ReminderSettings;
  addedCount: number;
  updatedCount: number;
  importedPatientsCount: number;
  importedMedicinesCount: number;
  importedLogsCount: number;
  importedHealthRecordsCount: number;
  importedAppointmentsCount: number;
  importedDoctorsCount: number;
  importedPhonebookCount: number;
  hasSettingsImport: boolean;
}

function isValidRecordWithId(item: unknown): item is { id: string } {
  return (
    Boolean(item) &&
    typeof item === 'object' &&
    typeof (item as { id?: unknown }).id === 'string' &&
    ((item as { id: string }).id).trim().length > 0
  );
}

/**
 * Merges incoming records into existing records strictly by `id` (deduplicated).
 * Importing the same JSON twice never creates duplicate rows.
 */
export function mergeRecordsById<T extends { id: string }>(
  existing: T[],
  incoming: unknown[]
): { merged: T[]; addedCount: number; updatedCount: number; validIncoming: T[] } {
  const byId = new Map<string, T>();
  for (const item of existing) {
    if (isValidRecordWithId(item)) {
      byId.set(item.id, item);
    }
  }

  let addedCount = 0;
  let updatedCount = 0;
  const seenIncoming = new Map<string, T>();

  for (const rawItem of incoming) {
    if (!isValidRecordWithId(rawItem)) continue;
    const item = rawItem as T;
    seenIncoming.set(item.id, item);
  }

  for (const [id, item] of seenIncoming.entries()) {
    if (byId.has(id)) {
      updatedCount += 1;
    } else {
      addedCount += 1;
    }
    byId.set(id, item);
  }

  return {
    merged: Array.from(byId.values()),
    addedCount,
    updatedCount,
    validIncoming: Array.from(seenIncoming.values()),
  };
}

export function parseAndMergeLocalBackup(
  rawJson: string,
  current: BackupCurrentSnapshot
): MergedBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('ফাইলটি সঠিক JSON ব্যাকআপ ফরম্যাটে নেই।');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ব্যাকআপ ফাইলের তথ্য সঠিকভাবে পড়া যায়নি।');
  }

  const obj = parsed as Record<string, unknown>;
  const hasAnyRecognizedField =
    Array.isArray(obj.patients) ||
    Array.isArray(obj.medicines) ||
    Array.isArray(obj.doseLogs) ||
    Array.isArray(obj.healthRecords) ||
    Array.isArray(obj.appointments) ||
    Array.isArray(obj.doctors) ||
    Array.isArray(obj.phonebook) ||
    (obj.settings && typeof obj.settings === 'object');

  if (!hasAnyRecognizedField) {
    throw new Error('এই ফাইলে স্বাস্থ্যবন্ধু ব্যাকআপের কোনো ডেটা পাওয়া যায়নি।');
  }

  const patRes = mergeRecordsById<PatientProfile>(
    current.patients,
    Array.isArray(obj.patients) ? obj.patients : []
  );
  const medRes = mergeRecordsById<Medicine>(
    current.medicines,
    Array.isArray(obj.medicines) ? obj.medicines : []
  );
  const logRes = mergeRecordsById<DoseLog>(
    current.doseLogs,
    Array.isArray(obj.doseLogs) ? obj.doseLogs : []
  );
  const hrRes = mergeRecordsById<HealthRecord>(
    current.healthRecords,
    Array.isArray(obj.healthRecords) ? obj.healthRecords : []
  );
  const aptRes = mergeRecordsById<DoctorAppointment>(
    current.appointments,
    Array.isArray(obj.appointments) ? obj.appointments : []
  );
  const docRes = mergeRecordsById<DoctorProfile>(
    current.doctors,
    Array.isArray(obj.doctors) ? obj.doctors : []
  );
  const phoneRes = mergeRecordsById<PhonebookEntry>(
    current.phonebook || [],
    Array.isArray(obj.phonebook) ? obj.phonebook : []
  );

  const hasSettingsImport = Boolean(
    obj.settings && typeof obj.settings === 'object' && !Array.isArray(obj.settings)
  );
  const mergedSettings: ReminderSettings = hasSettingsImport
    ? { ...current.settings, ...(obj.settings as Partial<ReminderSettings>) }
    : current.settings;

  const addedCount =
    patRes.addedCount +
    medRes.addedCount +
    logRes.addedCount +
    hrRes.addedCount +
    aptRes.addedCount +
    docRes.addedCount +
    phoneRes.addedCount;

  const updatedCount =
    patRes.updatedCount +
    medRes.updatedCount +
    logRes.updatedCount +
    hrRes.updatedCount +
    aptRes.updatedCount +
    docRes.updatedCount +
    phoneRes.updatedCount;

  return {
    patients: patRes.merged,
    medicines: medRes.merged,
    doseLogs: logRes.merged,
    healthRecords: hrRes.merged,
    appointments: aptRes.merged,
    doctors: docRes.merged,
    phonebook: phoneRes.merged,
    settings: mergedSettings,
    addedCount,
    updatedCount,
    importedPatientsCount: patRes.validIncoming.length,
    importedMedicinesCount: medRes.validIncoming.length,
    importedLogsCount: logRes.validIncoming.length,
    importedHealthRecordsCount: hrRes.validIncoming.length,
    importedAppointmentsCount: aptRes.validIncoming.length,
    importedDoctorsCount: docRes.validIncoming.length,
    importedPhonebookCount: phoneRes.validIncoming.length,
    hasSettingsImport,
  };
}
