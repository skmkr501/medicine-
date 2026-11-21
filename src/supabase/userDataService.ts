import { supabase } from './client';
import {
  appointmentFromRow,
  appointmentToRow,
  doctorFromRow,
  doctorToRow,
  doseLogFromRow,
  doseLogToRow,
  healthRecordFromRow,
  healthRecordToRow,
  medicineFromRow,
  medicineToRow,
  patientFromRow,
  patientToRow,
  phonebookFromRow,
  phonebookToRow,
  settingsFromRow,
  settingsToRow,
  USER_SETTINGS_ROW_ID,
} from './mappers';
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
import { buildCleanDoctorInput, DoctorProfileInput } from '../utils/doctorsManager';
import { CloudSyncOutbox } from '../utils/cloudSyncOutbox';
import { hasDemoPrefix, isDemoRecordId } from '../utils/demoCleanup';

export const SUPABASE_UPSERT_BATCH_SIZE = 200;
export const SUPABASE_MAX_WRITE_RETRIES = 3;
export const SUPABASE_BASE_RETRY_DELAY_MS = 350;

export type CoreSupabaseTable =
  | 'patients'
  | 'medicines'
  | 'dose_logs'
  | 'health_records'
  | 'appointments'
  | 'doctors'
  | 'phonebook'
  | 'user_settings';

export interface SupabaseTableQueryLike {
  upsert: (
    rows: Array<object>,
    options?: { onConflict?: string }
  ) => PromiseLike<{ error: unknown | null; data?: unknown }>;
  delete?: () => {
    eq: (col: string, val: string) => {
      in: (col: string, ids: string[]) => PromiseLike<{ error: unknown | null }>;
    };
  };
}

export interface SupabaseClientLike {
  from: (table: string) => SupabaseTableQueryLike;
}

export function chunkArray<T>(items: T[], chunkSize: number = SUPABASE_UPSERT_BATCH_SIZE): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeSize = Math.max(1, Math.min(SUPABASE_UPSERT_BATCH_SIZE, Math.floor(chunkSize)));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

export function isNonRetryableSupabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(anyErr.code || '').toUpperCase();
  const status = typeof anyErr.status === 'number' ? anyErr.status : 0;
  const msg = String(anyErr.message || '').toLowerCase();

  if (status === 401 || status === 403 || status === 400 || status === 404 || status === 422) {
    return true;
  }
  if (
    code === '42501' || // insufficient_privilege / RLS violation
    code === '42703' || // undefined_column
    code === '42P01' || // undefined_table
    code === '22P02' || // invalid_text_representation
    code === '23502' || // not_null_violation
    code === '23503' || // foreign_key_violation
    code.startsWith('PGRST1') || // PostgREST client errors (PGRST102, PGRST116, etc.)
    code.startsWith('PGRST2')
  ) {
    return true;
  }
  if (
    msg.includes('row-level security') ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('permission denied')
  ) {
    return true;
  }
  return false;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
  } = {}
): Promise<T> {
  const maxRetries = Math.max(0, options.maxRetries ?? SUPABASE_MAX_WRITE_RETRIES);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? SUPABASE_BASE_RETRY_DELAY_MS);
  const sleepFn = options.sleepFn ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || isNonRetryableSupabaseError(err)) {
        throw err;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await sleepFn(delayMs);
    }
  }
  throw lastError;
}

function formatSupabaseError(error: unknown, fallbackContext: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const msg = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : fallbackContext;
    const err = new Error(msg) as Error & { code?: unknown; details?: unknown; hint?: unknown };
    if (e.code !== undefined) err.code = e.code;
    if (e.details !== undefined) err.details = e.details;
    if (e.hint !== undefined) err.hint = e.hint;
    return err;
  }
  return new Error(String(error || fallbackContext));
}

export async function upsertRowsInBatches<TRow extends object>(
  table: CoreSupabaseTable,
  rows: TRow[],
  options: {
    client?: SupabaseClientLike;
    maxRetries?: number;
    baseDelayMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
    chunkSize?: number;
  } = {}
): Promise<number> {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const client = options.client ?? (supabase as unknown as SupabaseClientLike);
  const chunks = chunkArray(rows, options.chunkSize ?? SUPABASE_UPSERT_BATCH_SIZE);

  for (const chunk of chunks) {
    await retryWithBackoff(
      async () => {
        const { error } = await client
          .from(table)
          .upsert(chunk as Array<object>, { onConflict: 'user_id,id' });
        if (error) {
          throw formatSupabaseError(error, `Supabase upsert failed on ${table}`);
        }
      },
      {
        maxRetries: options.maxRetries,
        baseDelayMs: options.baseDelayMs,
        sleepFn: options.sleepFn,
      }
    );
  }
  return rows.length;
}

export async function deleteRowsInBatches(
  table: CoreSupabaseTable,
  userId: string,
  ids: string[],
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
    chunkSize?: number;
  } = {}
): Promise<number> {
  if (!userId || !Array.isArray(ids) || ids.length === 0) return 0;
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
  if (uniqueIds.length === 0) return 0;

  const chunks = chunkArray(uniqueIds, options.chunkSize ?? SUPABASE_UPSERT_BATCH_SIZE);
  for (const chunk of chunks) {
    await retryWithBackoff(
      async () => {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId)
          .in('id', chunk);
        if (error) {
          throw formatSupabaseError(error, `Supabase delete failed on ${table}`);
        }
      },
      {
        maxRetries: options.maxRetries,
        baseDelayMs: options.baseDelayMs,
        sleepFn: options.sleepFn,
      }
    );
  }
  return uniqueIds.length;
}

// ============================================================================
// Single & Batch CRUD Helpers per Table
// ============================================================================

export async function saveMedicineToSupabase(_userId: string, medicine: Medicine): Promise<void> {
  await upsertRowsInBatches('medicines', [medicineToRow(medicine)]);
}

export async function saveMedicinesBatchToSupabase(
  _userId: string,
  medicines: Medicine[]
): Promise<number> {
  return upsertRowsInBatches('medicines', medicines.map(medicineToRow));
}

export async function deleteMedicineFromSupabase(
  userId: string,
  medicineId: string
): Promise<void> {
  await deleteRowsInBatches('medicines', userId, [medicineId]);
}

export async function savePatientToSupabase(
  _userId: string,
  patient: PatientProfile
): Promise<void> {
  await upsertRowsInBatches('patients', [patientToRow(patient)]);
}

export async function savePatientsBatchToSupabase(
  _userId: string,
  patients: PatientProfile[]
): Promise<number> {
  return upsertRowsInBatches('patients', patients.map(patientToRow));
}

export async function deletePatientFromSupabase(userId: string, patientId: string): Promise<void> {
  await deleteRowsInBatches('patients', userId, [patientId]);
}

export async function saveDoseLogToSupabase(_userId: string, doseLog: DoseLog): Promise<void> {
  await upsertRowsInBatches('dose_logs', [doseLogToRow(doseLog)]);
}

export async function saveDoseLogsBatchToSupabase(
  _userId: string,
  doseLogs: DoseLog[]
): Promise<number> {
  return upsertRowsInBatches('dose_logs', doseLogs.map(doseLogToRow));
}

export async function saveSettingsToSupabase(
  _userId: string,
  settings: ReminderSettings
): Promise<void> {
  await upsertRowsInBatches('user_settings', [settingsToRow(settings, USER_SETTINGS_ROW_ID)]);
}

export async function saveHealthRecordToSupabase(
  _userId: string,
  record: HealthRecord
): Promise<void> {
  await upsertRowsInBatches('health_records', [healthRecordToRow(record)]);
}

export async function saveHealthRecordsBatchToSupabase(
  _userId: string,
  records: HealthRecord[]
): Promise<number> {
  return upsertRowsInBatches('health_records', records.map(healthRecordToRow));
}

export async function deleteHealthRecordFromSupabase(
  userId: string,
  recordId: string
): Promise<void> {
  await deleteRowsInBatches('health_records', userId, [recordId]);
}

export async function saveAppointmentToSupabase(
  _userId: string,
  appointment: DoctorAppointment
): Promise<void> {
  await upsertRowsInBatches('appointments', [appointmentToRow(appointment)]);
}

export async function saveAppointmentsBatchToSupabase(
  _userId: string,
  appointments: DoctorAppointment[]
): Promise<number> {
  return upsertRowsInBatches('appointments', appointments.map(appointmentToRow));
}

export async function deleteAppointmentFromSupabase(
  userId: string,
  appointmentId: string
): Promise<void> {
  await deleteRowsInBatches('appointments', userId, [appointmentId]);
}

export async function fetchUserDoctorsFromSupabase(userId: string): Promise<DoctorProfile[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch doctors');
  }
  return Array.isArray(data) ? data.map((row) => doctorFromRow(row)) : [];
}

export async function createDoctorInSupabase(
  _userId: string,
  doctor: DoctorProfileInput & { id: string; createdAt?: unknown; updatedAt?: unknown }
): Promise<void> {
  const clean = buildCleanDoctorInput(doctor);
  const nowIso = new Date().toISOString();
  const profile: DoctorProfile = {
    id: doctor.id,
    ...clean,
    isEmergency: Boolean(clean.isEmergency),
    createdAt: doctor.createdAt || nowIso,
    updatedAt: doctor.updatedAt || nowIso,
  };
  await upsertRowsInBatches('doctors', [doctorToRow(profile)]);
}

export async function updateDoctorInSupabase(
  _userId: string,
  doctorId: string,
  fullOrPartial: DoctorProfileInput & { id?: string; createdAt?: unknown; updatedAt?: unknown }
): Promise<void> {
  const clean = buildCleanDoctorInput(fullOrPartial);
  const nowIso = new Date().toISOString();
  const profile: DoctorProfile = {
    id: doctorId,
    ...clean,
    isEmergency: Boolean(clean.isEmergency),
    createdAt: fullOrPartial.createdAt || nowIso,
    updatedAt: nowIso,
  };
  await upsertRowsInBatches('doctors', [doctorToRow(profile)]);
}

export async function saveDoctorsBatchToSupabase(
  _userId: string,
  doctors: DoctorProfile[]
): Promise<number> {
  return upsertRowsInBatches('doctors', doctors.map(doctorToRow));
}

export async function deleteDoctorFromSupabase(userId: string, doctorId: string): Promise<void> {
  await deleteRowsInBatches('doctors', userId, [doctorId]);
}

export async function fetchPhonebookFromSupabase(userId: string): Promise<PhonebookEntry[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('phonebook')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch phonebook');
  }
  return Array.isArray(data) ? data.map((row) => phonebookFromRow(row)) : [];
}

export async function savePhonebookEntryToSupabase(
  _userId: string,
  entry: PhonebookEntry
): Promise<void> {
  await upsertRowsInBatches('phonebook', [phonebookToRow(entry)]);
}

export async function savePhonebookBatchToSupabase(
  _userId: string,
  entries: PhonebookEntry[]
): Promise<number> {
  return upsertRowsInBatches('phonebook', entries.map(phonebookToRow));
}

export async function deletePhonebookEntryFromSupabase(
  userId: string,
  entryId: string
): Promise<void> {
  await deleteRowsInBatches('phonebook', userId, [entryId]);
}

// ============================================================================
// Collection Loaders & Windowed Queries
// ============================================================================

export async function fetchUserCollectionFromSupabase<T>(
  userId: string,
  subcollection: 'medicines' | 'patients' | 'healthRecords' | 'appointments' | 'phonebook'
): Promise<T[]> {
  if (!userId) return [];

  const tableMap: Record<typeof subcollection, CoreSupabaseTable> = {
    medicines: 'medicines',
    patients: 'patients',
    healthRecords: 'health_records',
    appointments: 'appointments',
    phonebook: 'phonebook',
  };

  const table = tableMap[subcollection];
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) {
    throw formatSupabaseError(error, `Failed to fetch ${table}`);
  }
  const rows = Array.isArray(data) ? data : [];

  switch (subcollection) {
    case 'medicines':
      return rows.map((r) => medicineFromRow(r)) as unknown as T[];
    case 'patients':
      return rows.map((r) => patientFromRow(r)) as unknown as T[];
    case 'healthRecords':
      return rows.map((r) => healthRecordFromRow(r)) as unknown as T[];
    case 'appointments':
      return rows.map((r) => appointmentFromRow(r)) as unknown as T[];
    case 'phonebook':
      return rows.map((r) => phonebookFromRow(r)) as unknown as T[];
  }
}

export async function fetchUserSettingsFromSupabase(
  userId: string
): Promise<ReminderSettings | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('id', USER_SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch user settings');
  }
  if (!data) return null;
  return settingsFromRow(data);
}

/**
 * Loads recent dose_logs within the active window (scheduled_date >= cutoffDateIso, default 90 days)
 */
export async function fetchRecentDoseLogsFromSupabase(
  userId: string,
  cutoffDateIso: string
): Promise<DoseLog[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', cutoffDateIso)
    .order('scheduled_date', { ascending: false });

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch recent dose logs');
  }
  return Array.isArray(data) ? data.map((r) => doseLogFromRow(r)) : [];
}

/**
 * On-demand load of dose_logs older than the 90-day window ("আরও দেখুন")
 */
export async function fetchOlderDoseLogsFromSupabase(
  userId: string,
  cutoffDateIso: string
): Promise<DoseLog[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('user_id', userId)
    .lt('scheduled_date', cutoffDateIso)
    .order('scheduled_date', { ascending: false });

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch older dose logs');
  }
  return Array.isArray(data) ? data.map((r) => doseLogFromRow(r)) : [];
}

export async function fetchUpcomingAppointmentsFromSupabase(
  userId: string,
  minDateIso: string
): Promise<DoctorAppointment[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .gte('appointment_date', minDateIso)
    .order('appointment_date', { ascending: true });

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch upcoming appointments');
  }
  return Array.isArray(data) ? data.map((r) => appointmentFromRow(r)) : [];
}

export async function fetchPastAppointmentsFromSupabase(
  userId: string,
  beforeDateIso: string
): Promise<DoctorAppointment[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .lt('appointment_date', beforeDateIso)
    .order('appointment_date', { ascending: false });

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch past appointments');
  }
  return Array.isArray(data) ? data.map((r) => appointmentFromRow(r)) : [];
}

export async function fetchRecentHealthRecordsFromSupabase(
  userId: string,
  maxCount: number = 60
): Promise<{ records: HealthRecord[]; hasMore: boolean }> {
  if (!userId) return { records: [], hasMore: false };
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .order('record_date', { ascending: false })
    .limit(maxCount + 1);

  if (error) {
    throw formatSupabaseError(error, 'Failed to fetch recent health records');
  }
  const rows = Array.isArray(data) ? data : [];
  const hasMore = rows.length > maxCount;
  const sliced = hasMore ? rows.slice(0, maxCount) : rows;
  return {
    records: sliced.map((r) => healthRecordFromRow(r)),
    hasMore,
  };
}

// ============================================================================
// Migration, Outbox Flush, Cloud Data Check, Cleanup & Clear
// ============================================================================

export async function migrateLocalDataToSupabase(
  userId: string,
  medicines: Medicine[],
  patients: PatientProfile[],
  doseLogs: DoseLog[],
  settings: ReminderSettings,
  healthRecords?: HealthRecord[],
  appointments?: DoctorAppointment[],
  doctors?: DoctorProfile[],
  phonebook?: PhonebookEntry[]
): Promise<{ medicinesCount: number; logsCount: number; patientsCount: number }> {
  if (!userId) {
    return { medicinesCount: 0, logsCount: 0, patientsCount: 0 };
  }

  if (patients.length > 0) {
    await upsertRowsInBatches('patients', patients.map(patientToRow));
  }
  if (medicines.length > 0) {
    await upsertRowsInBatches('medicines', medicines.map(medicineToRow));
  }
  if (doseLogs.length > 0) {
    await upsertRowsInBatches('dose_logs', doseLogs.map(doseLogToRow));
  }
  await upsertRowsInBatches('user_settings', [settingsToRow(settings, USER_SETTINGS_ROW_ID)]);
  if (healthRecords && healthRecords.length > 0) {
    await upsertRowsInBatches('health_records', healthRecords.map(healthRecordToRow));
  }
  if (appointments && appointments.length > 0) {
    await upsertRowsInBatches('appointments', appointments.map(appointmentToRow));
  }
  if (doctors && doctors.length > 0) {
    await upsertRowsInBatches('doctors', doctors.map(doctorToRow));
  }
  if (phonebook && phonebook.length > 0) {
    await upsertRowsInBatches('phonebook', phonebook.map(phonebookToRow));
  }

  return {
    medicinesCount: medicines.length,
    logsCount: doseLogs.length,
    patientsCount: patients.length,
  };
}

export async function flushOutboxToSupabase(
  userId: string,
  outbox: CloudSyncOutbox,
  snapshot: {
    medicines: Medicine[];
    patients: PatientProfile[];
    doseLogs: DoseLog[];
    settings: ReminderSettings;
    healthRecords: HealthRecord[];
    appointments: DoctorAppointment[];
    doctors?: DoctorProfile[];
    phonebook?: PhonebookEntry[];
  }
): Promise<{ syncedOpsCount: number }> {
  if (!userId) return { syncedOpsCount: 0 };
  let syncedOpsCount = 0;

  // Medicines
  const medMap = new Map(snapshot.medicines.map((m) => [m.id, m]));
  const medUpserts = outbox.upserts.medicines
    .map((id) => medMap.get(id))
    .filter((item): item is Medicine => Boolean(item))
    .map(medicineToRow);
  syncedOpsCount += await upsertRowsInBatches('medicines', medUpserts);
  syncedOpsCount += await deleteRowsInBatches('medicines', userId, outbox.deletes.medicines);

  // Patients
  const patientMap = new Map(snapshot.patients.map((p) => [p.id, p]));
  const patientUpserts = outbox.upserts.patients
    .map((id) => patientMap.get(id))
    .filter((item): item is PatientProfile => Boolean(item))
    .map(patientToRow);
  syncedOpsCount += await upsertRowsInBatches('patients', patientUpserts);
  syncedOpsCount += await deleteRowsInBatches('patients', userId, outbox.deletes.patients);

  // Dose logs
  const logMap = new Map(snapshot.doseLogs.map((l) => [l.id, l]));
  const logUpserts = outbox.upserts.doseLogs
    .map((id) => logMap.get(id))
    .filter((item): item is DoseLog => Boolean(item))
    .map(doseLogToRow);
  syncedOpsCount += await upsertRowsInBatches('dose_logs', logUpserts);
  syncedOpsCount += await deleteRowsInBatches('dose_logs', userId, outbox.deletes.doseLogs);

  // Health records
  const hrMap = new Map(snapshot.healthRecords.map((h) => [h.id, h]));
  const hrUpserts = outbox.upserts.healthRecords
    .map((id) => hrMap.get(id))
    .filter((item): item is HealthRecord => Boolean(item))
    .map(healthRecordToRow);
  syncedOpsCount += await upsertRowsInBatches('health_records', hrUpserts);
  syncedOpsCount += await deleteRowsInBatches('health_records', userId, outbox.deletes.healthRecords);

  // Appointments
  const aptMap = new Map(snapshot.appointments.map((a) => [a.id, a]));
  const aptUpserts = outbox.upserts.appointments
    .map((id) => aptMap.get(id))
    .filter((item): item is DoctorAppointment => Boolean(item))
    .map(appointmentToRow);
  syncedOpsCount += await upsertRowsInBatches('appointments', aptUpserts);
  syncedOpsCount += await deleteRowsInBatches('appointments', userId, outbox.deletes.appointments);

  // Doctors
  const doctorMap = new Map((snapshot.doctors || []).map((d) => [d.id, d]));
  const doctorUpserts = outbox.upserts.doctors
    .map((id) => doctorMap.get(id))
    .filter((item): item is DoctorProfile => Boolean(item))
    .map(doctorToRow);
  syncedOpsCount += await upsertRowsInBatches('doctors', doctorUpserts);
  syncedOpsCount += await deleteRowsInBatches('doctors', userId, outbox.deletes.doctors);

  // Phonebook
  if (outbox.upserts.phonebook && outbox.upserts.phonebook.length > 0) {
    const phoneMap = new Map((snapshot.phonebook || []).map((p) => [p.id, p]));
    const phoneUpserts = outbox.upserts.phonebook
      .map((id) => phoneMap.get(id))
      .filter((item): item is PhonebookEntry => Boolean(item))
      .map(phonebookToRow);
    syncedOpsCount += await upsertRowsInBatches('phonebook', phoneUpserts);
  }
  if (outbox.deletes.phonebook && outbox.deletes.phonebook.length > 0) {
    syncedOpsCount += await deleteRowsInBatches('phonebook', userId, outbox.deletes.phonebook);
  }

  // Settings
  if (outbox.settingsDirty) {
    await upsertRowsInBatches('user_settings', [
      settingsToRow(snapshot.settings, USER_SETTINGS_ROW_ID),
    ]);
    syncedOpsCount += 1;
  }

  return { syncedOpsCount };
}

export async function checkUserHasCloudDataSupabase(
  userId: string
): Promise<{ hasData: boolean; medicinesCount: number; patientsCount: number }> {
  if (!userId) return { hasData: false, medicinesCount: 0, patientsCount: 0 };

  try {
    const [medRes, patRes, logRes, hrRes, aptRes] = await Promise.all([
      supabase.from('medicines').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase
        .from('dose_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('health_records')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .limit(1),
    ]);

    const medicinesCount = medRes.count ?? 0;
    const patientsCount = patRes.count ?? 0;
    const hasOtherData =
      (logRes.count ?? 0) > 0 || (hrRes.count ?? 0) > 0 || (aptRes.count ?? 0) > 0;

    return {
      hasData: medicinesCount > 0 || patientsCount > 0 || hasOtherData,
      medicinesCount,
      patientsCount,
    };
  } catch (error) {
    console.warn('checkUserHasCloudDataSupabase error:', error);
    return { hasData: false, medicinesCount: 0, patientsCount: 0 };
  }
}

export async function clearCoreUserTablesFromSupabase(userId: string): Promise<void> {
  if (!userId) return;
  const tables: CoreSupabaseTable[] = [
    'dose_logs',
    'health_records',
    'appointments',
    'medicines',
    'patients',
    'doctors',
    'phonebook',
    'user_settings',
  ];

  for (const table of tables) {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) {
        throw formatSupabaseError(error, `Failed to clear ${table}`);
      }
    });
  }
}

export async function cleanupDemoRecordsFromSupabase(
  userId: string
): Promise<{ removedCount: number; completed: boolean }> {
  if (!userId) return { removedCount: 0, completed: false };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { removedCount: 0, completed: false };
  }

  try {
    let removedCount = 0;

    const cleanConfigs: Array<{
      table: 'patients' | 'medicines' | 'dose_logs' | 'health_records' | 'appointments';
      colKey: 'patients' | 'medicines' | 'doseLogs' | 'healthRecords' | 'appointments';
    }> = [
      { table: 'patients', colKey: 'patients' },
      { table: 'medicines', colKey: 'medicines' },
      { table: 'dose_logs', colKey: 'doseLogs' },
      { table: 'health_records', colKey: 'healthRecords' },
      { table: 'appointments', colKey: 'appointments' },
    ];

    for (const cfg of cleanConfigs) {
      const { data, error } = await supabase
        .from(cfg.table)
        .select(cfg.table === 'medicines' ? 'id,schedules' : 'id')
        .eq('user_id', userId);

      if (error) throw formatSupabaseError(error, `Cleanup query failed on ${cfg.table}`);
      const rows = Array.isArray(data) ? data : [];
      const deleteIds: string[] = [];

      for (const row of rows as Array<{ id?: unknown; schedules?: unknown }>) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        if (isDemoRecordId(id, cfg.colKey)) {
          deleteIds.push(id);
        } else if (
          cfg.table === 'medicines' &&
          Array.isArray(row.schedules) &&
          row.schedules.some((s: unknown) =>
            hasDemoPrefix((s as { id?: string } | null)?.id || '')
          )
        ) {
          const cleanedSchedules = row.schedules.filter(
            (s: unknown) => !hasDemoPrefix((s as { id?: string } | null)?.id || '')
          );
          await supabase
            .from('medicines')
            .update({ schedules: cleanedSchedules })
            .eq('user_id', userId)
            .eq('id', id);
        }
      }

      if (deleteIds.length > 0) {
        await deleteRowsInBatches(cfg.table, userId, deleteIds);
        removedCount += deleteIds.length;
      }
    }

    // Clear default mock emergency contact if untouched from legacy mockData
    try {
      const { data: sData } = await supabase
        .from('user_settings')
        .select('emergency_contact_name,emergency_contact_phone')
        .eq('user_id', userId)
        .eq('id', USER_SETTINGS_ROW_ID)
        .maybeSingle();

      if (
        sData &&
        sData.emergency_contact_name === 'তানভীর করিম (ছেলে)' &&
        sData.emergency_contact_phone === '+8801711223344'
      ) {
        await supabase
          .from('user_settings')
          .update({
            emergency_contact_name: '',
            emergency_contact_phone: '',
          })
          .eq('user_id', userId)
          .eq('id', USER_SETTINGS_ROW_ID);
      }
    } catch (settingsErr) {
      console.warn('cleanupDemoRecordsFromSupabase settings notice:', settingsErr);
    }

    return { removedCount, completed: true };
  } catch (error) {
    console.warn('cleanupDemoRecordsFromSupabase deferred:', error);
    return { removedCount: 0, completed: false };
  }
}

export function getSupabaseDataErrorMessageBn(
  error: unknown,
  fallbackMessage?: string
): string {
  if (!error) return fallbackMessage || 'একটি অজানা ত্রুটি ঘটেছে।';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('401')) {
    return 'লগইন সেশন শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।';
  }
  if (msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('403')) {
    return fallbackMessage || 'অনুমতি নেই: আপনার এই তথ্য পরিবর্তন করার অনুমতি নেই।';
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fetch')
  ) {
    return 'ইন্টারনেট সংযোগ সমস্যা। অনুগ্রহ করে সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallbackMessage || String(error);
}
