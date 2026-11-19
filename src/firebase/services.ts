
import {
  collection,
  collectionGroup,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  arrayUnion,
  getDocsFromServer,
  getDocFromServer,
  Timestamp,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db, executeGuardedWrite, stripUndefined } from './config';
import {
  getCachedSupabaseUser,
  getCachedSupabaseAdmin,
} from '../supabase/client';
import {
  saveMedicineToSupabase,
  saveMedicinesBatchToSupabase,
  deleteMedicineFromSupabase,
  savePatientToSupabase,
  savePatientsBatchToSupabase,
  deletePatientFromSupabase,
  saveDoseLogToSupabase,
  saveDoseLogsBatchToSupabase,
  saveSettingsToSupabase,
  saveHealthRecordToSupabase,
  saveHealthRecordsBatchToSupabase,
  deleteHealthRecordFromSupabase,
  saveAppointmentToSupabase,
  saveAppointmentsBatchToSupabase,
  deleteAppointmentFromSupabase,
  fetchUserDoctorsFromSupabase,
  createDoctorInSupabase,
  updateDoctorInSupabase,
  saveDoctorsBatchToSupabase,
  deleteDoctorFromSupabase,
  fetchPhonebookFromSupabase,
  savePhonebookEntryToSupabase,
  savePhonebookBatchToSupabase,
  deletePhonebookEntryFromSupabase,
  migrateLocalDataToSupabase,
  flushOutboxToSupabase,
  checkUserHasCloudDataSupabase,
  fetchUserCollectionFromSupabase,
  fetchUserSettingsFromSupabase,
  fetchRecentDoseLogsFromSupabase,
  fetchOlderDoseLogsFromSupabase,
  fetchUpcomingAppointmentsFromSupabase,
  fetchPastAppointmentsFromSupabase,
  fetchRecentHealthRecordsFromSupabase,
  clearCoreUserTablesFromSupabase,
  cleanupDemoRecordsFromSupabase,
} from '../supabase/userDataService';
import {
  handleFirestoreError,
  isQuotaExceededError,
  isWriteQuotaPaused,
  markWriteQuotaExceeded,
  OperationType,
  QuotaExceededWriteError,
} from './errors';
import {
  LibraryMetaDoc,
  LibraryChunkDoc,
  buildLibraryChunks,
  estimateUtf8Bytes,
  hasCatalogChanges,
} from '../utils/libraryChunks';
import {
  Medicine,
  PatientProfile,
  DoseLog,
  ReminderSettings,
  HealthRecord,
  DoctorAppointment,
  GlobalMedicine,
  ImportBatch,
  AdminActivity,
  CaregiverLinkDoc,
  CaregiverSuggestionDoc,
  CaregiverSuggestionStatus,
  FamilyAlertDoc,
  SharedReportDoc,
  EmergencyCardDoc,
  DoctorProfile,
  PhonebookEntry,
  MedicalDocument,
  MedicalDocumentFile,
} from '../types';
import {
  BuiltSharedReportSnapshot,
  isValidShareTokenFormat,
  toMillisSafe,
} from '../utils/sharedReports';
import {
  BuiltEmergencyCardPayload,
  isValidEmergencyTokenFormat,
} from '../utils/emergencyQr';
import { DoctorProfileInput } from '../utils/doctorsManager';
import { buildCleanMedicalDocumentInput, DocumentFormInput } from '../utils/medicalDocuments';
import { isValidInviteCode, normalizeInviteCodeInput } from '../utils/caregiverAlerts';
import { CloudSyncOutbox } from '../utils/cloudSyncOutbox';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreUsageTracker';

/**
 * Asserts that the currently authenticated user is a verified admin (via Supabase is_admin RPC).
 * Throws a clear Bengali error if unauthenticated or unauthorized.
 */
export function assertAdminAuth(): void {
  const currentUser = getCachedSupabaseUser();
  if (!currentUser) {
    throw new Error('অননুমোদিত অ্যাক্সেস! ক্রিয়াকলাপের জন্য অনুগ্রহ করে প্রথমে অ্যাডমিন হিসেবে সাইন-ইন করুন।');
  }
  if (!getCachedSupabaseAdmin()) {
    throw new Error(
      'নিরাপত্তা বিধিনিষেধ: আপনার বর্তমান অ্যাকাউন্টে অ্যাডমিন কার্যক্রম পরিচালনার অনুমতি নেই।'
    );
  }
}

// Supabase Postgres CRUD for Medicines
export async function saveMedicineToCloud(userId: string, medicine: Medicine): Promise<void> {
  return saveMedicineToSupabase(userId, medicine);
}

export async function saveMedicinesBatchToCloud(userId: string, medicines: Medicine[]): Promise<number> {
  return saveMedicinesBatchToSupabase(userId, medicines);
}

export async function deleteMedicineFromCloud(userId: string, medicineId: string): Promise<void> {
  return deleteMedicineFromSupabase(userId, medicineId);
}

// Supabase Postgres CRUD for Patients
export async function savePatientToCloud(userId: string, patient: PatientProfile): Promise<void> {
  return savePatientToSupabase(userId, patient);
}

export async function savePatientsBatchToCloud(userId: string, patients: PatientProfile[]): Promise<number> {
  return savePatientsBatchToSupabase(userId, patients);
}

export async function deletePatientFromCloud(userId: string, patientId: string): Promise<void> {
  return deletePatientFromSupabase(userId, patientId);
}

// Supabase Postgres CRUD for Dose Logs
export async function saveDoseLogToCloud(userId: string, doseLog: DoseLog): Promise<void> {
  return saveDoseLogToSupabase(userId, doseLog);
}

export async function saveDoseLogsBatchToCloud(userId: string, doseLogs: DoseLog[]): Promise<number> {
  return saveDoseLogsBatchToSupabase(userId, doseLogs);
}

// Supabase Postgres CRUD for Settings
export async function saveSettingsToCloud(userId: string, settings: ReminderSettings): Promise<void> {
  return saveSettingsToSupabase(userId, settings);
}

// Supabase Postgres CRUD for Health Records (ধাপ ১)
export async function saveHealthRecordToCloud(userId: string, record: HealthRecord): Promise<void> {
  return saveHealthRecordToSupabase(userId, record);
}

export async function saveHealthRecordsBatchToCloud(userId: string, records: HealthRecord[]): Promise<number> {
  return saveHealthRecordsBatchToSupabase(userId, records);
}

export async function deleteHealthRecordFromCloud(userId: string, recordId: string): Promise<void> {
  return deleteHealthRecordFromSupabase(userId, recordId);
}

// Supabase Postgres CRUD for Doctor Appointments (ধাপ ২)
export async function saveAppointmentToCloud(userId: string, appointment: DoctorAppointment): Promise<void> {
  return saveAppointmentToSupabase(userId, appointment);
}

export async function saveAppointmentsBatchToCloud(userId: string, appointments: DoctorAppointment[]): Promise<number> {
  return saveAppointmentsBatchToSupabase(userId, appointments);
}

export async function deleteAppointmentFromCloud(userId: string, appointmentId: string): Promise<void> {
  return deleteAppointmentFromSupabase(userId, appointmentId);
}

// Supabase Postgres CRUD for My Doctors ("আমার ডাক্তার")
export async function fetchUserDoctorsFromCloud(userId: string): Promise<DoctorProfile[]> {
  return fetchUserDoctorsFromSupabase(userId);
}

export async function createDoctorInCloud(
  userId: string,
  doctor: DoctorProfileInput & { id: string }
): Promise<void> {
  return createDoctorInSupabase(userId, doctor);
}

export async function updateDoctorInCloud(
  userId: string,
  doctorId: string,
  fullOrPartial: DoctorProfileInput & { id?: string }
): Promise<void> {
  return updateDoctorInSupabase(userId, doctorId, fullOrPartial);
}

export async function saveDoctorsBatchToCloud(userId: string, doctors: DoctorProfile[]): Promise<number> {
  return saveDoctorsBatchToSupabase(userId, doctors);
}

export async function deleteDoctorFromCloud(userId: string, doctorId: string): Promise<void> {
  return deleteDoctorFromSupabase(userId, doctorId);
}

// Supabase Postgres CRUD for Phonebook
export async function fetchPhonebookFromCloud(userId: string): Promise<PhonebookEntry[]> {
  return fetchPhonebookFromSupabase(userId);
}

export async function savePhonebookEntryToCloud(userId: string, entry: PhonebookEntry): Promise<void> {
  return savePhonebookEntryToSupabase(userId, entry);
}

export async function savePhonebookBatchToCloud(userId: string, entries: PhonebookEntry[]): Promise<number> {
  return savePhonebookBatchToSupabase(userId, entries);
}

export async function deletePhonebookEntryFromCloud(userId: string, entryId: string): Promise<void> {
  return deletePhonebookEntryFromSupabase(userId, entryId);
}

// ============================================================================
// Prescriptions & Medical Reports Vault (users/{uid}/documents + documentFiles)
// Strictly private to owner; ZERO onSnapshot listeners.
// ============================================================================

export async function fetchUserDocumentsMetaFromCloud(
  userId: string
): Promise<MedicalDocument[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'documents');
  let snap;
  try {
    snap = await getDocsFromServer(colRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(colRef);
  }
  recordFirestoreRead('documents', Math.max(1, snap.size));
  const items: MedicalDocument[] = [];
  snap.forEach((docSnap) => {
    const raw = docSnap.data() as MedicalDocument;
    items.push({
      ...raw,
      id: raw.id || docSnap.id,
      pages: Array.isArray(raw.pages) ? raw.pages : [],
    });
  });
  return items;
}

export async function fetchDocumentFileFromCloud(
  userId: string,
  fileId: string
): Promise<MedicalDocumentFile | null> {
  if (!userId || !fileId) return null;
  const docRef = doc(db, 'users', userId, 'documentFiles', fileId);
  let snap;
  try {
    snap = await getDocFromServer(docRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDoc(docRef);
  }
  recordFirestoreRead('documentFiles', 1);
  if (!snap.exists()) return null;
  const raw = snap.data() as MedicalDocumentFile;
  return {
    ...raw,
    id: raw.id || snap.id,
  };
}

export async function createDocumentFileInCloud(
  userId: string,
  file: { id: string; docId: string; data: string; bytes: number }
): Promise<void> {
  const path = `users/${userId}/documentFiles/${file.id}`;
  const payload = stripUndefined({
    id: file.id,
    docId: file.docId,
    data: file.data,
    bytes: file.bytes,
    createdAt: serverTimestamp(),
  });
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'documentFiles', file.id), payload),
      { collection: 'documentFiles', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDocumentFileFromCloud(
  userId: string,
  fileId: string
): Promise<void> {
  const path = `users/${userId}/documentFiles/${fileId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'documentFiles', fileId)),
      { collection: 'documentFiles', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createDocumentMetaInCloud(
  userId: string,
  docId: string,
  docInput: DocumentFormInput
): Promise<void> {
  const path = `users/${userId}/documents/${docId}`;
  const clean = buildCleanMedicalDocumentInput(docInput);
  const payload = stripUndefined({
    id: docId,
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'documents', docId), payload),
      { collection: 'documents', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocumentMetaInCloud(
  userId: string,
  docId: string,
  docInput: DocumentFormInput
): Promise<void> {
  const path = `users/${userId}/documents/${docId}`;
  const docRef = doc(db, 'users', userId, 'documents', docId);
  const clean = buildCleanMedicalDocumentInput(docInput);

  const patch: Record<string, any> = {
    kind: clean.kind,
    patientId: clean.patientId,
    title: clean.title,
    date: clean.date,
    pages: clean.pages,
    doctorId: clean.doctorId !== undefined ? clean.doctorId : deleteField(),
    note: clean.note !== undefined ? clean.note : deleteField(),
    reportType: clean.reportType !== undefined ? clean.reportType : deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await executeGuardedWrite(
      () => updateDoc(docRef, stripUndefined(patch)),
      { collection: 'documents', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    const code = String(error?.code || error?.message || '').toLowerCase();
    if (code.includes('not-found')) {
      await createDocumentMetaInCloud(userId, docId, docInput);
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocumentMetaFromCloud(
  userId: string,
  docId: string
): Promise<void> {
  const path = `users/${userId}/documents/${docId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'documents', docId)),
      { collection: 'documents', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Safe Migration of Local Data into Supabase Postgres (batched <= 200 rows)
export async function migrateLocalDataToCloud(
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
  return migrateLocalDataToSupabase(
    userId,
    medicines,
    patients,
    doseLogs,
    settings,
    healthRecords,
    appointments,
    doctors,
    phonebook
  );
}

/**
 * Flushes locally queued changes to Supabase Postgres (batched <= 200 rows per table).
 */
export async function flushOutboxToCloud(
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
  return flushOutboxToSupabase(userId, outbox, snapshot);
}

/**
 * Checks if a user already has core data stored in Supabase Postgres
 */
export async function checkUserHasCloudData(
  userId: string
): Promise<{ hasData: boolean; medicinesCount: number; patientsCount: number }> {
  return checkUserHasCloudDataSupabase(userId);
}

/**
 * One-time read helper for user tables in Supabase Postgres
 */
export async function fetchUserCollectionFromCloud<T>(
  userId: string,
  subcollection: 'medicines' | 'patients' | 'healthRecords' | 'appointments' | 'phonebook'
): Promise<T[]> {
  return fetchUserCollectionFromSupabase<T>(userId, subcollection);
}

/**
 * Single-row read for user reminder settings from Supabase Postgres
 */
export async function fetchUserSettingsFromCloud(
  userId: string
): Promise<ReminderSettings | null> {
  return fetchUserSettingsFromSupabase(userId);
}

/**
 * Loads recent doseLogs within the active 90-day window from Supabase Postgres
 */
export async function fetchRecentDoseLogsFromCloud(
  userId: string,
  cutoffDateIso: string
): Promise<DoseLog[]> {
  return fetchRecentDoseLogsFromSupabase(userId, cutoffDateIso);
}

/**
 * On-demand read of doseLogs older than the 90-day window ("আরও দেখুন")
 */
export async function fetchOlderDoseLogsFromCloud(
  userId: string,
  cutoffDateIso: string
): Promise<DoseLog[]> {
  return fetchOlderDoseLogsFromSupabase(userId, cutoffDateIso);
}

/**
 * Boot-time read of upcoming/recent appointments from Supabase Postgres
 */
export async function fetchUpcomingAppointmentsFromCloud(
  userId: string,
  minDateIso: string
): Promise<DoctorAppointment[]> {
  return fetchUpcomingAppointmentsFromSupabase(userId, minDateIso);
}

/**
 * On-demand read of past appointments from Supabase Postgres
 */
export async function fetchPastAppointmentsFromCloud(
  userId: string,
  beforeDateIso: string
): Promise<DoctorAppointment[]> {
  return fetchPastAppointmentsFromSupabase(userId, beforeDateIso);
}

/**
 * Lazy-loaded recent health records (ordered by record_date desc, capped at maxCount)
 */
export async function fetchRecentHealthRecordsFromCloud(
  userId: string,
  maxCount: number = 60
): Promise<{ records: HealthRecord[]; hasMore: boolean }> {
  return fetchRecentHealthRecordsFromSupabase(userId, maxCount);
}

/**
 * Safely clears user's 8 core tables in Supabase Postgres + remaining Firestore documents vault (until Part 2b)
 */
export async function clearUserCloudData(userId: string): Promise<void> {
  await clearCoreUserTablesFromSupabase(userId);

  // Documents vault stays in Firestore until Part 2b
  try {
    const docsSnap = await getDocs(collection(db, 'users', userId, 'documents'));
    recordFirestoreRead('documents', Math.max(1, docsSnap.size));
    if (!docsSnap.empty) {
      const fileRefs: Array<ReturnType<typeof doc>> = [];
      docsSnap.docs.forEach((d) => {
        const raw = d.data() as Partial<MedicalDocument>;
        if (Array.isArray(raw.pages)) {
          raw.pages.forEach((p) => {
            if (p && typeof p.fileId === 'string' && p.fileId.trim()) {
              fileRefs.push(doc(db, 'users', userId, 'documentFiles', p.fileId.trim()));
            }
          });
        }
      });
      const CHUNK_SIZE = 400;
      for (let i = 0; i < fileRefs.length; i += CHUNK_SIZE) {
        const chunk = fileRefs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((ref) => batch.delete(ref));
        await executeGuardedWrite(() => batch.commit(), { collection: 'documentFiles', count: chunk.length });
      }
      for (let i = 0; i < docsSnap.docs.length; i += CHUNK_SIZE) {
        const chunk = docsSnap.docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await executeGuardedWrite(() => batch.commit(), { collection: 'documents', count: chunk.length });
      }
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/documents`);
  }
}

/**
 * One-time cleanup of legacy demo/fictional records from Supabase Postgres user tables.
 */
export async function cleanupDemoRecordsFromCloud(
  userId: string
): Promise<{ removedCount: number; completed: boolean }> {
  return cleanupDemoRecordsFromSupabase(userId);
}

// Versioned Chunked Global Medicine Catalog Services (library_meta + library_chunks)

/**
 * Fetches the single metadata document library_meta/current (1 Firestore read).
 */
export async function fetchLibraryMetaFromCloud(): Promise<LibraryMetaDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'library_meta', 'current'));
    recordFirestoreRead('library_meta', 1);
    if (!snap.exists()) return null;
    return snap.data() as LibraryMetaDoc;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw error;
    }
    console.warn('fetchLibraryMetaFromCloud error:', error);
    return null;
  }
}

/**
 * Fetches all chunks for a given library catalog version (e.g. 25 reads for ~5,000 items at 200/chunk).
 */
export async function fetchLibraryChunksByVersion(version: number): Promise<GlobalMedicine[]> {
  if (!version || version <= 0) return [];
  const q = query(collection(db, 'library_chunks'), where('version', '==', version));
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    // Offline/cache fallback
    snap = await getDocs(q);
  }
  recordFirestoreRead('library_chunks', Math.max(1, snap.size));

  const chunkDocs: LibraryChunkDoc[] = [];
  snap.forEach((docSnap) => {
    chunkDocs.push(docSnap.data() as LibraryChunkDoc);
  });

  chunkDocs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const items: GlobalMedicine[] = [];
  for (const chunk of chunkDocs) {
    if (Array.isArray(chunk.items)) {
      for (const item of chunk.items) {
        items.push(item);
      }
    }
  }
  return items;
}

/**
 * Publishes an entire updated catalog as versioned library_chunks (<= 200 items & < 1MB each),
 * commits chunk batches safely under Firestore's 10 MiB batch limit,
 * updates library_meta/current LAST, and cleans up older version chunks best-effort.
 */
export async function publishChunkedLibraryCatalog(
  medicines: GlobalMedicine[],
  currentKnownVersion: number = 0,
  importBatchInfo?: ImportBatch
): Promise<{
  newVersion: number;
  chunkCount: number;
  totalCount: number;
  totalWrites: number;
}> {
  assertAdminAuth();
  if (isWriteQuotaPaused()) {
    throw new QuotaExceededWriteError();
  }

  let serverVersion = 0;
  try {
    let metaSnap;
    try {
      metaSnap = await getDocFromServer(doc(db, 'library_meta', 'current'));
    } catch (err) {
      if (isQuotaExceededError(err)) throw err;
      metaSnap = await getDoc(doc(db, 'library_meta', 'current'));
    }
    if (metaSnap.exists()) {
      const data = metaSnap.data() as Partial<LibraryMetaDoc>;
      if (typeof data.version === 'number') {
        serverVersion = data.version;
      }
    }
    recordFirestoreRead('library_meta', 1);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    console.warn('Could not fetch current library_meta before publish, using local version baseline:', err);
  }

  const newVersion = Math.max(currentKnownVersion, serverVersion, 0) + 1;
  const cleanMedicines = medicines.map((m) => stripUndefined(m));
  const chunks = buildLibraryChunks(cleanMedicines, newVersion);

  let totalWrites = 0;

  try {
    // 1. Write chunk docs in byte-safe batches (max 5 chunks or ~3.5 MB per batch to stay well under 10 MiB Firestore batch limit)
    const MAX_CHUNKS_PER_BATCH = 5;
    const MAX_BATCH_BYTES = 3_500_000;

    let currentBatchDocs: LibraryChunkDoc[] = [];
    let currentBatchBytes = 0;

    const commitChunkBatch = async (docsToWrite: LibraryChunkDoc[]) => {
      if (docsToWrite.length === 0) return;
      const batch = writeBatch(db);
      docsToWrite.forEach((chunkDoc) => {
        const ref = doc(db, 'library_chunks', `${newVersion}_${chunkDoc.index}`);
        batch.set(ref, stripUndefined(chunkDoc));
      });
      await executeGuardedWrite(() => batch.commit(), {
        collection: 'library_chunks',
        count: docsToWrite.length,
      });
      totalWrites += docsToWrite.length;
    };

    for (const chunk of chunks) {
      const chunkBytes = estimateUtf8Bytes(chunk);
      if (
        currentBatchDocs.length >= MAX_CHUNKS_PER_BATCH ||
        (currentBatchDocs.length > 0 && currentBatchBytes + chunkBytes > MAX_BATCH_BYTES)
      ) {
        await commitChunkBatch(currentBatchDocs);
        currentBatchDocs = [chunk];
        currentBatchBytes = chunkBytes;
      } else {
        currentBatchDocs.push(chunk);
        currentBatchBytes += chunkBytes;
      }
    }

    if (currentBatchDocs.length > 0) {
      await commitChunkBatch(currentBatchDocs);
    }

    // 2. Write optional import batch audit doc
    if (importBatchInfo) {
      await executeGuardedWrite(
        () => setDoc(doc(db, 'import_batches', importBatchInfo.id), stripUndefined(importBatchInfo)),
        { collection: 'import_batches', count: 1 }
      );
      totalWrites += 1;
    }

    // 3. Update library_meta/current LAST so clients only switch after all chunks exist
    const metaPayload: LibraryMetaDoc = {
      version: newVersion,
      chunkCount: chunks.length,
      totalCount: cleanMedicines.length,
      updatedAt: new Date().toISOString(),
    };
    await executeGuardedWrite(
      () => setDoc(doc(db, 'library_meta', 'current'), metaPayload),
      { collection: 'library_meta', count: 1 }
    );
    totalWrites += 1;

    // 4. Best-effort cleanup of old version chunks (non-fatal if skipped/empty)
    try {
      const oldChunksSnap = await getDocs(
        query(collection(db, 'library_chunks'), where('version', '<', newVersion))
      );
      recordFirestoreRead('library_chunks', Math.max(1, oldChunksSnap.size));
      if (!oldChunksSnap.empty) {
        const docsToDelete = oldChunksSnap.docs;
        const DELETE_BATCH_SIZE = 300;
        for (let i = 0; i < docsToDelete.length; i += DELETE_BATCH_SIZE) {
          const chunk = docsToDelete.slice(i, i + DELETE_BATCH_SIZE);
          const delBatch = writeBatch(db);
          chunk.forEach((d) => delBatch.delete(d.ref));
          await executeGuardedWrite(() => delBatch.commit(), {
            collection: 'library_chunks',
            count: chunk.length,
          });
        }
      }
    } catch (cleanupErr) {
      console.warn('Old library_chunks cleanup notice (non-fatal):', cleanupErr);
    }

    return {
      newVersion,
      chunkCount: chunks.length,
      totalCount: cleanMedicines.length,
      totalWrites,
    };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, 'library_chunks/[publish]');
    return { newVersion, chunkCount: 0, totalCount: 0, totalWrites: 0 };
  }
}

/**
 * One-time admin-only legacy migration:
 * Reads legacy global_medicines documents ONCE, merges cleanly with any existing catalog items,
 * writes them as chunked library_chunks + library_meta/current, and logs an activity.
 */
export async function migrateLegacyGlobalMedicinesToChunks(
  existingCatalog: GlobalMedicine[] = [],
  currentKnownVersion: number = 0
): Promise<{
  legacyFoundCount: number;
  mergedTotalCount: number;
  newVersion: number;
  chunkCount: number;
  totalWrites: number;
  mergedMedicines: GlobalMedicine[];
}> {
  assertAdminAuth();

  let snap;
  try {
    snap = await getDocsFromServer(collection(db, 'global_medicines'));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(collection(db, 'global_medicines'));
  }
  recordFirestoreRead('global_medicines', Math.max(1, snap.size));

  const legacyMeds: GlobalMedicine[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as GlobalMedicine;
    legacyMeds.push({
      ...data,
      id: data.id || docSnap.id,
    });
  });

  if (legacyMeds.length === 0 && existingCatalog.length === 0) {
    return {
      legacyFoundCount: 0,
      mergedTotalCount: 0,
      newVersion: currentKnownVersion,
      chunkCount: 0,
      totalWrites: 0,
      mergedMedicines: [],
    };
  }

  const diff = hasCatalogChanges(existingCatalog, legacyMeds);
  const targetList = diff.changed ? diff.mergedList : existingCatalog;

  const publishRes = await publishChunkedLibraryCatalog(targetList, currentKnownVersion);

  recordAdminActivity({
    type: 'import',
    title: 'পুরনো লাইব্রেরি নতুন চাঙ্কড ফরম্যাটে মাইগ্রেশন',
    description: `পুরনো global_medicines থেকে ${legacyMeds.length}টি ওষুধ পড়া হয়েছে এবং ${publishRes.chunkCount}টি চাঙ্কে মোট ${publishRes.totalCount}টি ওষুধ সংরক্ষিত হয়েছে (সংস্করণ ${publishRes.newVersion})।`,
    adminEmail: getCachedSupabaseUser()?.email || '',
  }).catch((e) => console.warn('Activity log error:', e));

  return {
    legacyFoundCount: legacyMeds.length,
    mergedTotalCount: publishRes.totalCount,
    newVersion: publishRes.newVersion,
    chunkCount: publishRes.chunkCount,
    totalWrites: publishRes.totalWrites,
    mergedMedicines: targetList,
  };
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  try {
    assertAdminAuth();
    const snap = await getDocs(collection(db, 'import_batches'));
    recordFirestoreRead('import_batches', Math.max(1, snap.size));
    return snap.docs.map((docSnap) => docSnap.data() as ImportBatch);
  } catch (error) {
    console.warn('Could not fetch import batches from firestore:', error);
    return [];
  }
}

/**
 * Fetches all registered users from Firestore (Admin only)
 */
export async function fetchRegisteredUsers(): Promise<{
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  lastLoginAt?: string;
}[]> {
  try {
    assertAdminAuth();
    const snap = await getDocs(collection(db, 'users'));
    recordFirestoreRead('users', Math.max(1, snap.size));
    return snap.docs.map((d) => d.data() as any);
  } catch (error) {
    console.warn('Could not fetch registered users:', error);
    return [];
  }
}

/**
 * Fetches total count of patient profiles across all users (Admin only)
 */
export async function fetchTotalPatientsCount(): Promise<number> {
  try {
    assertAdminAuth();
    const snap = await getDocs(collectionGroup(db, 'patients'));
    recordFirestoreRead('patients', Math.max(1, snap.size));
    return snap.size;
  } catch (error) {
    console.warn('Could not fetch patient profiles count via collectionGroup:', error);
    return 0;
  }
}

/**
 * Records an admin activity into Firestore
 */
export async function recordAdminActivity(
  activity: Omit<AdminActivity, 'id' | 'timestamp' | 'adminEmail'> & {
    id?: string;
    timestamp?: string;
    adminEmail?: string;
  }
): Promise<void> {
  if (isWriteQuotaPaused()) return;
  try {
    assertAdminAuth();
    const activityId = activity.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const act: AdminActivity = {
      ...activity,
      id: activityId,
      timestamp: activity.timestamp || new Date().toISOString(),
      adminEmail: activity.adminEmail || getCachedSupabaseUser()?.email || '',
    };
    await executeGuardedWrite(
      () => setDoc(doc(db, 'admin_activities', activityId), act),
      { collection: 'admin_activities', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      return;
    }
    console.warn('Could not record admin activity:', error);
  }
}

/**
 * Fetches recent admin activities from Firestore
 */
export async function fetchAdminActivities(): Promise<AdminActivity[]> {
  try {
    assertAdminAuth();
    const q = query(collection(db, 'admin_activities'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    recordFirestoreRead('admin_activities', Math.max(1, snap.size));
    return snap.docs.map((d) => d.data() as AdminActivity);
  } catch (error) {
    console.warn('Could not fetch admin activities:', error);
    return [];
  }
}

/**
 * Tests Firebase real-time connection health & latency
 */
export async function testFirebaseDetailedStatus(): Promise<{
  isConnected: boolean;
  latencyMs: number;
  databaseId: string;
  projectId: string;
  userEmail: string;
  online: boolean;
}> {
  const start = performance.now();
  const databaseId = 'ai-studio-shasthobondhu-0ef74fa2-17df-4dc9-87f0-96c012be89de';
  const projectId = 'ai-studio-shasthobondhu-0ef74fa2-17df-4dc9-87f0-96c012be89de';
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  try {
    await getDoc(doc(db, 'library_meta', 'current'));
    recordFirestoreRead('library_meta', 1);
    const latencyMs = Math.round(performance.now() - start);
    return {
      isConnected: true,
      latencyMs,
      databaseId,
      projectId,
      userEmail: getCachedSupabaseUser()?.email || 'N/A',
      online,
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - start);
    const isActuallyConnected =
      !error?.message?.includes('failed-precondition') &&
      !error?.message?.includes('offline') &&
      !isQuotaExceededError(error);
    return {
      isConnected: isActuallyConnected,
      latencyMs,
      databaseId,
      projectId,
      userEmail: getCachedSupabaseUser()?.email || 'N/A',
      online,
    };
  }
}

// ============================================================================
// পরিবারের যত্নকারী (Caregiver Mode) — সাশ্রয়ী Firestore অপারেশন
// ============================================================================

export async function createCaregiverInviteInCloud(linkDoc: CaregiverLinkDoc): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        setDoc(
          doc(db, 'caregiver_links', linkDoc.id),
          stripUndefined({
            ...linkDoc,
            serverCreatedAt: serverTimestamp(),
          })
        ),
      { collection: 'caregiver_links', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `caregiver_links/${linkDoc.id}`);
  }
}

export async function redeemCaregiverInviteInCloud(
  inviteCode: string,
  caregiverUid: string,
  caregiverName: string
): Promise<CaregiverLinkDoc> {
  const cleanCode = normalizeInviteCodeInput(inviteCode);
  if (!isValidInviteCode(cleanCode)) {
    throw new Error('অনুগ্রহ করে সঠিক ৬ অক্ষরের কোড লিখুন');
  }

  const docRef = doc(db, 'caregiver_links', cleanCode);
  let snap;
  try {
    snap = await getDocFromServer(docRef);
    recordFirestoreRead('caregiver_links', 1);
  } catch (err: any) {
    if (isQuotaExceededError(err)) throw err;
    const msg = String(err?.code || err?.message || '').toLowerCase();
    if (msg.includes('permission-denied')) {
      throw new Error('কোডটি আগেই ব্যবহার করা হয়েছে অথবা ৪৮ ঘণ্টার মেয়াদ শেষ হয়েছে');
    }
    if (msg.includes('unauthenticated')) {
      throw new Error('কোড ব্যবহার করতে অনুগ্রহ করে আগে লগইন করুন');
    }
    throw new Error('ইন্টারনেট সংযোগ চালু রেখে কোডটি যাচাই করুন');
  }

  if (!snap.exists()) {
    throw new Error('কোডটি সঠিক নয় বা মুছে ফেলা হয়েছে');
  }

  const data = snap.data() as CaregiverLinkDoc;
  if (data.patientUid === caregiverUid) {
    throw new Error('আপনি নিজের আমন্ত্রণ কোডে নিজে যত্নকারী হতে পারবেন না');
  }
  if (data.status !== 'pending') {
    if (data.caregiverUid === caregiverUid) {
      return data;
    }
    throw new Error('এই আমন্ত্রণ কোডটি আগেই ব্যবহার করা হয়েছে');
  }
  // Only run client-clock expiry check for legacy invites lacking serverCreatedAt;
  // invites with serverCreatedAt are authoritatively validated against Firestore server request.time.
  if (!data.serverCreatedAt && (!data.expiresAtMs || Date.now() >= data.expiresAtMs)) {
    throw new Error('এই কোডের ৪৮ ঘণ্টার মেয়াদ শেষ হয়ে গেছে। নতুন কোড চান।');
  }
  if (isWriteQuotaPaused()) {
    throw new QuotaExceededWriteError();
  }

  const nowIso = new Date().toISOString();
  const safeCaregiverName = ((caregiverName || '').trim() || 'পরিবারের যত্নকারী').slice(0, 128);

  try {
    await executeGuardedWrite(
      () =>
        updateDoc(
          docRef,
          stripUndefined({
            caregiverUid,
            caregiverName: safeCaregiverName,
            status: 'active',
            linkedAt: nowIso,
            updatedAt: nowIso,
          })
        ),
      { collection: 'caregiver_links', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    const msg = String((error as any)?.code || (error as any)?.message || '').toLowerCase();
    if (msg.includes('permission-denied')) {
      throw new Error('কোডটির মেয়াদ শেষ হয়ে গেছে বা ইতিমধ্যেই ব্যবহৃত হয়েছে');
    }
    handleFirestoreError(error, OperationType.UPDATE, `caregiver_links/${cleanCode}`);
  }

  return {
    ...data,
    caregiverUid,
    caregiverName: safeCaregiverName,
    status: 'active',
    linkedAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function fetchPatientCaregiverLinks(patientUid: string): Promise<CaregiverLinkDoc[]> {
  try {
    const q = query(
      collection(db, 'caregiver_links'),
      where('patientUid', '==', patientUid),
      limit(25)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('caregiver_links', Math.max(1, snap.size));
    return snap.docs.map((d) => d.data() as CaregiverLinkDoc);
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    console.warn('fetchPatientCaregiverLinks warning:', error);
    return [];
  }
}

export async function fetchCaregiverPatientsLinks(caregiverUid: string): Promise<CaregiverLinkDoc[]> {
  try {
    const q = query(
      collection(db, 'caregiver_links'),
      where('caregiverUid', '==', caregiverUid),
      limit(25)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('caregiver_links', Math.max(1, snap.size));
    return snap.docs
      .map((d) => d.data() as CaregiverLinkDoc)
      .filter((item) => item.status === 'active');
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    console.warn('fetchCaregiverPatientsLinks warning:', error);
    return [];
  }
}

export async function updateCaregiverLinkInCloud(
  linkId: string,
  updates: Partial<CaregiverLinkDoc>
): Promise<void> {
  try {
    await executeGuardedWrite(
      () => updateDoc(doc(db, 'caregiver_links', linkId), stripUndefined(updates)),
      { collection: 'caregiver_links', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    console.warn('updateCaregiverLinkInCloud warning:', error);
    throw error;
  }
}

export async function deleteCaregiverLinkInCloud(linkId: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'caregiver_links', linkId)),
      { collection: 'caregiver_links', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, `caregiver_links/${linkId}`);
  }
}

export async function createFamilyAlertInCloud(alertDoc: FamilyAlertDoc): Promise<void> {
  const alertRef = doc(db, 'family_alerts', alertDoc.id);
  try {
    await executeGuardedWrite(
      () => setDoc(alertRef, stripUndefined(alertDoc)),
      { collection: 'family_alerts', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    // If retry hit an already-created immutable alert doc, verify existence before treating as error
    if (msg.includes('permission-denied')) {
      try {
        const existingSnap = await getDoc(alertRef);
        recordFirestoreRead('family_alerts', 1);
        if (existingSnap.exists()) {
          return;
        }
      } catch {
        // Fall through and throw original error
      }
    }
    throw error;
  }
}

export async function markFamilyAlertSeenInCloud(
  alertId: string,
  caregiverUid: string
): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        updateDoc(doc(db, 'family_alerts', alertId), {
          seenBy: arrayUnion(caregiverUid),
        }),
      { collection: 'family_alerts', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `family_alerts/${alertId}`);
  }
}

export async function cleanupOldFamilyAlertsInCloud(
  patientUid: string,
  retentionMs: number
): Promise<number> {
  if (isWriteQuotaPaused()) return 0;
  try {
    const q = query(
      collection(db, 'family_alerts'),
      where('patientUid', '==', patientUid),
      limit(25)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('family_alerts', Math.max(1, snap.size));
    const cutoff = Date.now() - retentionMs;
    const toDelete = snap.docs.filter((d) => {
      const data = d.data() as Partial<FamilyAlertDoc>;
      return typeof data.createdAtMs === 'number' && data.createdAtMs <= cutoff;
    });

    if (toDelete.length === 0) return 0;

    const batch = writeBatch(db);
    toDelete.forEach((d) => batch.delete(d.ref));
    await executeGuardedWrite(() => batch.commit(), {
      collection: 'family_alerts',
      count: toDelete.length,
    });
    return toDelete.length;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
    }
    console.warn('cleanupOldFamilyAlertsInCloud notice:', error);
    return 0;
  }
}

/**
 * Single real-time listener for caregiver alerts (limit 20, filtered by caregiverUids).
 * Automatically falls back to client-sorted query if Firestore composite index is missing.
 */
export function subscribeToCaregiverAlerts(
  caregiverUid: string,
  onData: (alerts: FamilyAlertDoc[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let activeUnsub: (() => void) | null = null;
  let cancelled = false;
  let usedFallback = false;
  let hasRecordedInitial = false;

  const sortAlertsDesc = (items: FamilyAlertDoc[]) =>
    [...items].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  const recordServerSnapshot = (snapshot: any) => {
    if (!snapshot.metadata?.fromCache) {
      if (!hasRecordedInitial) {
        hasRecordedInitial = true;
        recordFirestoreRead('family_alerts', Math.max(1, snapshot.size));
      } else {
        const changed = snapshot.docChanges().length;
        if (changed > 0) recordFirestoreRead('family_alerts', changed);
      }
    }
  };

  const attachFallbackListener = () => {
    if (cancelled || usedFallback) return;
    usedFallback = true;
    hasRecordedInitial = false;
    const fallbackQuery = query(
      collection(db, 'family_alerts'),
      where('caregiverUids', 'array-contains', caregiverUid),
      limit(20)
    );
    activeUnsub = onSnapshot(
      fallbackQuery,
      (snapshot) => {
        if (cancelled) return;
        recordServerSnapshot(snapshot);
        const list: FamilyAlertDoc[] = [];
        snapshot.forEach((d) => list.push(d.data() as FamilyAlertDoc));
        onData(sortAlertsDesc(list));
      },
      (err) => {
        if (!cancelled) onError?.(err);
      }
    );
  };

  const primaryQuery = query(
    collection(db, 'family_alerts'),
    where('caregiverUids', 'array-contains', caregiverUid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  activeUnsub = onSnapshot(
    primaryQuery,
    (snapshot) => {
      if (cancelled) return;
      recordServerSnapshot(snapshot);
      const list: FamilyAlertDoc[] = [];
      snapshot.forEach((d) => list.push(d.data() as FamilyAlertDoc));
      onData(sortAlertsDesc(list));
    },
    (err: any) => {
      if (cancelled) return;
      const msg = String(err?.code || err?.message || '').toLowerCase();
      if (!usedFallback && (msg.includes('failed-precondition') || msg.includes('index'))) {
        if (activeUnsub) activeUnsub();
        attachFallbackListener();
        return;
      }
      onError?.(err);
    }
  );

  return () => {
    cancelled = true;
    if (activeUnsub) activeUnsub();
  };
}

// ============================================================================
// রিপোর্ট শেয়ার লিংক (shared_reports) — টোকেন-ভিত্তিক নিরাপদ স্ন্যাপশট
// ============================================================================

export interface SharedReportDebugInfo {
  code: string;
  docExists: boolean | null;
}

export type SharedReportFetchResult =
  | { status: 'ok'; report: SharedReportDoc; debug: SharedReportDebugInfo }
  | { status: 'not_found'; debug: SharedReportDebugInfo }
  | { status: 'revoked'; debug: SharedReportDebugInfo }
  | { status: 'expired'; debug: SharedReportDebugInfo }
  | { status: 'denied'; debug: SharedReportDebugInfo }
  | { status: 'error'; message: string; debug: SharedReportDebugInfo };

export async function createSharedReportInCloud(
  snapshot: BuiltSharedReportSnapshot
): Promise<SharedReportDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser || sbUser.id !== snapshot.ownerUid) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }

  if (!isValidShareTokenFormat(snapshot.token)) {
    throw new Error('নিরাপদ লিংক টোকেন সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  const firestorePayload = stripUndefined({
    ownerUid: snapshot.ownerUid,
    token: snapshot.token,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(snapshot.expiresAtMs),
    patientName: snapshot.patientName,
    age: snapshot.age,
    gender: snapshot.gender,
    relation: snapshot.relation,
    sections: snapshot.sections,
    revoked: false,
  });

  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'shared_reports', snapshot.token), firestorePayload),
      { collection: 'shared_reports', count: 1 }
    );
    return {
      ...firestorePayload,
      createdAtMs: snapshot.createdAtMs,
      expiresAtMs: snapshot.expiresAtMs,
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('আজকের ক্লাউড সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.CREATE, `shared_reports/${snapshot.token}`);
    }
    throw new Error(
      'রিপোর্ট লিংক তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
    );
  }
}

export async function fetchSharedReportByTokenFromCloud(
  token: string
): Promise<SharedReportFetchResult> {
  if (!isValidShareTokenFormat(token)) {
    return {
      status: 'not_found',
      debug: { code: 'invalid-token-format', docExists: false },
    };
  }

  try {
    const snap = await getDocFromServer(doc(db, 'shared_reports', token));
    recordFirestoreRead('shared_reports', 1);
    if (!snap.exists()) {
      return {
        status: 'not_found',
        debug: { code: 'not-found', docExists: false },
      };
    }

    const raw = snap.data() as SharedReportDoc;
    const createdAtMs = toMillisSafe(raw.createdAt);
    const expiresAtMs = toMillisSafe(raw.expiresAt);
    if (raw.revoked) {
      return {
        status: 'revoked',
        debug: { code: 'revoked', docExists: true },
      };
    }
    if (!expiresAtMs || expiresAtMs <= Date.now()) {
      return {
        status: 'expired',
        debug: { code: 'expired', docExists: true },
      };
    }

    return {
      status: 'ok',
      report: {
        ...raw,
        createdAtMs,
        expiresAtMs,
      },
      debug: { code: 'ok', docExists: true },
    };
  } catch (error: any) {
    const rawCode = String(error?.code || error?.message || 'unknown-error');
    const code = rawCode.toLowerCase();

    if (isQuotaExceededError(error)) {
      return {
        status: 'error',
        message: 'এই মুহূর্তে ক্লাউড সীমা পূর্ণ হওয়ায় রিপোর্ট খোলা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
        debug: { code: rawCode, docExists: null },
      };
    }

    if (code.includes('not-found')) {
      return {
        status: 'not_found',
        debug: { code: rawCode, docExists: false },
      };
    }

    if (
      code.includes('permission-denied') ||
      code.includes('missing or insufficient permissions')
    ) {
      return {
        status: 'denied',
        debug: { code: rawCode, docExists: null },
      };
    }

    return {
      status: 'error',
      message: 'ইন্টারনেট সংযোগের সমস্যার কারণে রিপোর্ট লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
      debug: { code: rawCode, docExists: null },
    };
  }
}

export async function fetchOwnerSharedReportsFromCloud(
  ownerUid: string
): Promise<SharedReportDoc[]> {
  try {
    const q = query(
      collection(db, 'shared_reports'),
      where('ownerUid', '==', ownerUid),
      limit(30)
    );
    const snap = await getDocsFromServer(q);
    recordFirestoreRead('shared_reports', Math.max(1, snap.size));
    const items = snap.docs.map((d) => {
      const raw = d.data() as SharedReportDoc;
      return {
        ...raw,
        createdAtMs: toMillisSafe(raw.createdAt),
        expiresAtMs: toMillisSafe(raw.expiresAt),
      };
    });
    return items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      throw new Error('আজকের ক্লাউড সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.LIST, 'shared_reports');
    }
    throw new Error('শেয়ার করা লিংকগুলো লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।');
  }
}

export async function revokeSharedReportInCloud(token: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        updateDoc(doc(db, 'shared_reports', token), {
          revoked: true,
        }),
      { collection: 'shared_reports', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('আজকের ক্লাউড সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.UPDATE, `shared_reports/${token}`);
    }
    throw new Error('লিংকটি বাতিল করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

export async function deleteSharedReportInCloud(token: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'shared_reports', token)),
      { collection: 'shared_reports', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('আজকের ক্লাউড সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `shared_reports/${token}`);
    }
    throw new Error('লিংকটি মুছে ফেলা যায়নি। আবার চেষ্টা করুন।');
  }
}

// ============================================================================
// জরুরি কার্ড QR (emergency_cards) — গোপনীয়তা-নিয়ন্ত্রিত জরুরি তথ্য
// ============================================================================

export interface EmergencyCardDebugInfo {
  code: string;
  docExists: boolean | null;
}

export type EmergencyCardFetchResult =
  | { status: 'ok'; card: EmergencyCardDoc; debug: EmergencyCardDebugInfo }
  | { status: 'not_found'; debug: EmergencyCardDebugInfo }
  | { status: 'revoked'; debug: EmergencyCardDebugInfo }
  | { status: 'quota'; debug: EmergencyCardDebugInfo }
  | { status: 'offline'; debug: EmergencyCardDebugInfo }
  | { status: 'error'; message: string; debug: EmergencyCardDebugInfo };

export async function createEmergencyCardInCloud(
  payload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser || sbUser.id !== payload.ownerUid) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(payload.token)) {
    throw new Error('নিরাপদ QR টোকেন সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  const firestorePayload = stripUndefined({
    ...payload,
    createdAt: serverTimestamp(),
    active: true,
  });

  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'emergency_cards', payload.token), firestorePayload),
      { collection: 'emergency_cards', count: 1 }
    );
    return {
      ...payload,
      createdAt: Timestamp.now(),
      createdAtMs: Date.now(),
      active: true,
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.CREATE, `emergency_cards/${payload.token}`);
    }
    throw new Error('জরুরি QR কার্ড সংরক্ষণ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

export async function updateEmergencyCardInCloud(
  token: string,
  payload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser || sbUser.id !== payload.ownerUid) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(token)) {
    throw new Error('QR টোকেন সঠিক নয়।');
  }

  const updateFields: Record<string, unknown> = {
    patientName: payload.patientName,
    age: payload.age !== undefined ? payload.age : deleteField(),
    bloodGroup: payload.bloodGroup !== undefined ? payload.bloodGroup : deleteField(),
    allergies: payload.allergies !== undefined ? payload.allergies : deleteField(),
    conditions: payload.conditions !== undefined ? payload.conditions : deleteField(),
    contactName: payload.contactName !== undefined ? payload.contactName : deleteField(),
    contactPhone: payload.contactPhone !== undefined ? payload.contactPhone : deleteField(),
    medicines: payload.medicines !== undefined ? payload.medicines : deleteField(),
    doctorName: payload.doctorName !== undefined ? payload.doctorName : deleteField(),
    active: true,
  };

  try {
    await executeGuardedWrite(
      () => updateDoc(doc(db, 'emergency_cards', token), updateFields),
      { collection: 'emergency_cards', count: 1 }
    );
    return {
      ...payload,
      token,
      createdAt: Timestamp.now(),
      createdAtMs: Date.now(),
      active: true,
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.UPDATE, `emergency_cards/${token}`);
    }
    throw new Error('জরুরি কার্ড হালনাগাদ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

export async function rotateEmergencyCardInCloud(
  oldToken: string | null,
  newPayload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser || sbUser.id !== newPayload.ownerUid) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(newPayload.token)) {
    throw new Error('নিরাপদ QR টোকেন সঠিক নয়।');
  }

  if (!oldToken || !isValidEmergencyTokenFormat(oldToken)) {
    return createEmergencyCardInCloud(newPayload);
  }

  const newFirestorePayload = stripUndefined({
    ...newPayload,
    createdAt: serverTimestamp(),
    active: true,
  });

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'emergency_cards', oldToken), { active: false });
    batch.set(doc(db, 'emergency_cards', newPayload.token), newFirestorePayload);
    await executeGuardedWrite(() => batch.commit(), { collection: 'emergency_cards', count: 2 });
    return {
      ...newPayload,
      createdAt: Timestamp.now(),
      createdAtMs: Date.now(),
      active: true,
    };
  } catch (error: any) {
    const rawCode = String(error?.code || error?.message || '').toLowerCase();
    if (rawCode.includes('not-found')) {
      return createEmergencyCardInCloud(newPayload);
    }
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    if (rawCode.includes('permission-denied') || rawCode.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `emergency_cards/${newPayload.token}`);
    }
    throw new Error('নতুন জরুরি QR তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

export async function revokeEmergencyCardInCloud(token: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        updateDoc(doc(db, 'emergency_cards', token), {
          active: false,
        }),
      { collection: 'emergency_cards', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.UPDATE, `emergency_cards/${token}`);
    }
    throw new Error('জরুরি QR বাতিল করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

export async function deleteEmergencyCardInCloud(token: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'emergency_cards', token)),
      { collection: 'emergency_cards', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `emergency_cards/${token}`);
    }
    throw new Error('জরুরি QR মুছে ফেলা যায়নি। আবার চেষ্টা করুন।');
  }
}

export async function fetchOwnerEmergencyCardsFromCloud(
  ownerUid: string
): Promise<EmergencyCardDoc[]> {
  try {
    const q = query(
      collection(db, 'emergency_cards'),
      where('ownerUid', '==', ownerUid),
      limit(30)
    );
    const snap = await getDocsFromServer(q);
    recordFirestoreRead('emergency_cards', Math.max(1, snap.size));
    const items = snap.docs.map((d) => {
      const raw = d.data() as EmergencyCardDoc;
      return {
        ...raw,
        createdAtMs: toMillisSafe(raw.createdAt),
      };
    });
    return items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      throw new Error('সীমা শেষ — পরে চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.LIST, 'emergency_cards');
    }
    throw new Error('আপনার জরুরি QR তালিকা লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।');
  }
}

/**
 * Strictly 1 Firestore read for public /e/{token} viewer (no login required).
 */
export async function fetchEmergencyCardByTokenFromCloud(
  token: string
): Promise<EmergencyCardFetchResult> {
  if (!isValidEmergencyTokenFormat(token)) {
    return {
      status: 'not_found',
      debug: { code: 'invalid-token-format', docExists: false },
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: 'offline',
      debug: { code: 'navigator-offline', docExists: null },
    };
  }

  try {
    const snap = await getDocFromServer(doc(db, 'emergency_cards', token));
    recordFirestoreRead('emergency_cards', 1);
    if (!snap.exists()) {
      return {
        status: 'not_found',
        debug: { code: 'not-found', docExists: false },
      };
    }

    const raw = snap.data() as EmergencyCardDoc;
    if (!raw.active) {
      return {
        status: 'revoked',
        debug: { code: 'revoked', docExists: true },
      };
    }

    return {
      status: 'ok',
      card: {
        ...raw,
        createdAtMs: toMillisSafe(raw.createdAt),
      },
      debug: { code: 'ok', docExists: true },
    };
  } catch (error: any) {
    const rawCode = String(error?.code || error?.message || 'unknown-error');
    const code = rawCode.toLowerCase();

    if (isQuotaExceededError(error)) {
      return {
        status: 'quota',
        debug: { code: rawCode, docExists: null },
      };
    }

    if (
      code.includes('unavailable') ||
      code.includes('offline') ||
      code.includes('network') ||
      code.includes('failed-precondition')
    ) {
      return {
        status: 'offline',
        debug: { code: rawCode, docExists: null },
      };
    }

    if (code.includes('not-found')) {
      return {
        status: 'not_found',
        debug: { code: rawCode, docExists: false },
      };
    }

    if (
      code.includes('permission-denied') ||
      code.includes('missing or insufficient permissions')
    ) {
      return {
        status: 'revoked',
        debug: { code: rawCode, docExists: null },
      };
    }

    return {
      status: 'error',
      message: 'তথ্য লোড করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      debug: { code: rawCode, docExists: null },
    };
  }
}

// ============================================================================
// যত্নকারীর ওষুধের প্রস্তাব (caregiver_suggestions) — সাশ্রয়ী Firestore অপারেশন
// ============================================================================

export async function createCaregiverSuggestionInCloud(
  suggestion: CaregiverSuggestionDoc
): Promise<CaregiverSuggestionDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser || sbUser.id !== suggestion.caregiverUid) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }

  const firestorePayload = stripUndefined({
    ...suggestion,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'caregiver_suggestions', suggestion.id), firestorePayload),
      { collection: 'caregiver_suggestions', count: 1 }
    );
    return {
      ...suggestion,
      status: 'pending',
      createdAt: Timestamp.now(),
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — আজ ক্লাউডে আর লেখা যাবে না, আগামীকাল চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      throw new Error('রোগীর অনুমোদনের অপশন ("ওষুধের প্রস্তাব পাঠাতে পারবেন") বন্ধ আছে বা লিংক সক্রিয় নয়।');
    }
    handleFirestoreError(error, OperationType.CREATE, `caregiver_suggestions/${suggestion.id}`);
    throw error;
  }
}

/**
 * Single real-time listener for patient's pending suggestions ONLY (limit 10, zero composite index needed).
 */
export function subscribeToPatientPendingSuggestions(
  patientUid: string,
  onData: (suggestions: CaregiverSuggestionDoc[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(
    collection(db, 'caregiver_suggestions'),
    where('patientUid', '==', patientUid),
    where('status', '==', 'pending'),
    limit(10)
  );
  let hasRecordedInitial = false;

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.metadata?.fromCache) {
        if (!hasRecordedInitial) {
          hasRecordedInitial = true;
          recordFirestoreRead('caregiver_suggestions', Math.max(1, snapshot.size));
        } else {
          const changed = snapshot.docChanges().length;
          if (changed > 0) recordFirestoreRead('caregiver_suggestions', changed);
        }
      }
      const items: CaregiverSuggestionDoc[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as CaregiverSuggestionDoc;
        items.push({
          ...raw,
          id: raw.id || docSnap.id,
          createdAtMs: raw.createdAtMs || toMillisSafe(raw.createdAt) || Date.now(),
        });
      });
      items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onData(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

/**
 * Caregiver sent suggestions history — one-time getDocs ONLY (limit 20, NO real-time listener).
 */
export async function fetchCaregiverSentSuggestions(
  caregiverUid: string
): Promise<CaregiverSuggestionDoc[]> {
  try {
    const q = query(
      collection(db, 'caregiver_suggestions'),
      where('caregiverUid', '==', caregiverUid),
      limit(20)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('caregiver_suggestions', Math.max(1, snap.size));
    const items: CaregiverSuggestionDoc[] = snap.docs.map((docSnap) => {
      const raw = docSnap.data() as CaregiverSuggestionDoc;
      return {
        ...raw,
        id: raw.id || docSnap.id,
        createdAtMs: raw.createdAtMs || toMillisSafe(raw.createdAt) || 0,
      };
    });
    return items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    console.warn('fetchCaregiverSentSuggestions warning:', error);
    return [];
  }
}

export async function updateCaregiverSuggestionStatusInCloud(
  suggestionId: string,
  nextStatus: Exclude<CaregiverSuggestionStatus, 'pending'>
): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        updateDoc(doc(db, 'caregiver_suggestions', suggestionId), {
          status: nextStatus,
        }),
      { collection: 'caregiver_suggestions', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw new Error('সীমা শেষ — পরে আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      throw new Error('এই প্রস্তাবটির অবস্থা পরিবর্তন করার অনুমতি নেই বা এটি ইতিমধ্যেই প্রক্রিয়াকৃত হয়েছে।');
    }
    handleFirestoreError(error, OperationType.UPDATE, `caregiver_suggestions/${suggestionId}`);
  }
}





