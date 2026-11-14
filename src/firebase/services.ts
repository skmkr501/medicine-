import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  User,
} from 'firebase/auth';
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
} from 'firebase/firestore';
import { auth, db, stripUndefined } from './config';
import { handleFirestoreError, isQuotaExceededError, OperationType } from './errors';
import { isDemoRecordId, hasDemoPrefix, UserDataCollection } from '../utils/demoCleanup';
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
  FamilyAlertDoc,
  SharedReportDoc,
} from '../types';
import {
  BuiltSharedReportSnapshot,
  isValidShareTokenFormat,
  toMillisSafe,
} from '../utils/sharedReports';

export const ADMIN_EMAIL = 'sarashatikmkr501@gmail.com';

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Asserts that the currently authenticated user is the designated admin.
 * Throws a clear Bengali error if unauthenticated or unauthorized.
 * Does not expose the admin's personal email to unauthorized callers.
 */
export function assertAdminAuth(): void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('অননুমোদিত অ্যাক্সেস! ক্রিয়াকলাপের জন্য অনুগ্রহ করে প্রথমে অ্যাডমিন হিসেবে সাইন-ইন করুন।');
  }
  if (!isUserAdmin(currentUser.email)) {
    throw new Error(
      'নিরাপত্তা বিধিনিষেধ: আপনার বর্তমান অ্যাকাউন্টে অ্যাডমিন কার্যক্রম পরিচালনার অনুমতি নেই।'
    );
  }
}

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    // Ensure user record exists in firestore
    await recordUserProfile(cred.user);
    return cred.user;
  } catch (error) {
    console.error('Google Sign-in Error:', error);
    throw error;
  }
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string
): Promise<User> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await recordUserProfile(cred.user);
    return cred.user;
  } catch (error) {
    console.error('Email Registration Error:', error);
    throw error;
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await recordUserProfile(cred.user);
    return cred.user;
  } catch (error) {
    console.error('Email Login Error:', error);
    throw error;
  }
}

export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout Error:', error);
    throw error;
  }
}

/**
 * Sends a password reset email in Bengali via Firebase Auth.
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    auth.languageCode = 'bn';
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    console.error('Password Reset Error:', error);
    throw error;
  }
}

async function recordUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'ব্যবহারকারী',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Medicines
export async function saveMedicineToCloud(userId: string, medicine: Medicine): Promise<void> {
  const path = `users/${userId}/medicines/${medicine.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'medicines', medicine.id), stripUndefined(medicine));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMedicineFromCloud(userId: string, medicineId: string): Promise<void> {
  const path = `users/${userId}/medicines/${medicineId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'medicines', medicineId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Patients
export async function savePatientToCloud(userId: string, patient: PatientProfile): Promise<void> {
  const path = `users/${userId}/patients/${patient.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'patients', patient.id), stripUndefined(patient));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePatientFromCloud(userId: string, patientId: string): Promise<void> {
  const path = `users/${userId}/patients/${patientId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'patients', patientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Dose Logs
export async function saveDoseLogToCloud(userId: string, doseLog: DoseLog): Promise<void> {
  const path = `users/${userId}/doseLogs/${doseLog.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'doseLogs', doseLog.id), stripUndefined(doseLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Settings
export async function saveSettingsToCloud(userId: string, settings: ReminderSettings): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), stripUndefined(settings), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Health Records (ধাপ ১)
export async function saveHealthRecordToCloud(userId: string, record: HealthRecord): Promise<void> {
  const path = `users/${userId}/healthRecords/${record.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'healthRecords', record.id), stripUndefined(record));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHealthRecordFromCloud(userId: string, recordId: string): Promise<void> {
  const path = `users/${userId}/healthRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'healthRecords', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Doctor Appointments (ধাপ ২)
export async function saveAppointmentToCloud(userId: string, appointment: DoctorAppointment): Promise<void> {
  const path = `users/${userId}/appointments/${appointment.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'appointments', appointment.id), stripUndefined(appointment));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAppointmentFromCloud(userId: string, appointmentId: string): Promise<void> {
  const path = `users/${userId}/appointments/${appointmentId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'appointments', appointmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Safe Migration of Local Data into Cloud (without overwriting or losing anything)
export async function migrateLocalDataToCloud(
  userId: string,
  medicines: Medicine[],
  patients: PatientProfile[],
  doseLogs: DoseLog[],
  settings: ReminderSettings,
  healthRecords?: HealthRecord[],
  appointments?: DoctorAppointment[]
): Promise<{ medicinesCount: number; logsCount: number; patientsCount: number }> {
  try {
    const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    writes.push({
      ref: doc(db, 'users', userId),
      data: stripUndefined({
        uid: userId,
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || 'ব্যবহারকারী',
        updatedAt: new Date().toISOString(),
      }),
    });

    patients.forEach((patient) => {
      writes.push({
        ref: doc(db, 'users', userId, 'patients', patient.id),
        data: stripUndefined(patient),
      });
    });

    medicines.forEach((med) => {
      writes.push({
        ref: doc(db, 'users', userId, 'medicines', med.id),
        data: stripUndefined(med),
      });
    });

    doseLogs.forEach((log) => {
      writes.push({
        ref: doc(db, 'users', userId, 'doseLogs', log.id),
        data: stripUndefined(log),
      });
    });

    writes.push({
      ref: doc(db, 'users', userId, 'settings', 'preferences'),
      data: stripUndefined(settings),
    });

    if (healthRecords && healthRecords.length > 0) {
      healthRecords.forEach((hr) => {
        writes.push({
          ref: doc(db, 'users', userId, 'healthRecords', hr.id),
          data: stripUndefined(hr),
        });
      });
    }

    if (appointments && appointments.length > 0) {
      appointments.forEach((apt) => {
        writes.push({
          ref: doc(db, 'users', userId, 'appointments', apt.id),
          data: stripUndefined(apt),
        });
      });
    }

    // Commit in chunks of 400 to stay safely below Firestore's 500-op writeBatch limit
    const CHUNK_SIZE = 400;
    for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = writes.slice(i, i + CHUNK_SIZE);
      chunk.forEach(({ ref, data }) => {
        batch.set(ref, data, { merge: true });
      });
      await batch.commit();
    }

    return {
      medicinesCount: medicines.length,
      logsCount: doseLogs.length,
      patientsCount: patients.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/[batch_migration]`);
    return { medicinesCount: 0, logsCount: 0, patientsCount: 0 };
  }
}

/**
 * Checks if a user already has data stored in Cloud Firestore
 */
export async function checkUserHasCloudData(
  userId: string
): Promise<{ hasData: boolean; medicinesCount: number; patientsCount: number }> {
  const fetchCollection = async (sub: string) => {
    const colRef = collection(db, 'users', userId, sub);
    try {
      return await getDocsFromServer(colRef);
    } catch {
      return await getDocs(colRef);
    }
  };

  try {
    const [medsSnap, patientsSnap, logsSnap, healthSnap, aptsSnap] = await Promise.all([
      fetchCollection('medicines'),
      fetchCollection('patients'),
      fetchCollection('doseLogs'),
      fetchCollection('healthRecords'),
      fetchCollection('appointments'),
    ]);
    const medicinesCount = medsSnap.size;
    const patientsCount = patientsSnap.size;
    const hasOtherData = logsSnap.size > 0 || healthSnap.size > 0 || aptsSnap.size > 0;
    return {
      hasData: medicinesCount > 0 || patientsCount > 0 || hasOtherData,
      medicinesCount,
      patientsCount,
    };
  } catch (error) {
    console.warn('checkUserHasCloudData error:', error);
    return { hasData: false, medicinesCount: 0, patientsCount: 0 };
  }
}

/**
 * Safely clears only the user's own UID subcollections in Cloud Firestore
 */
export async function clearUserCloudData(userId: string): Promise<void> {
  try {
    const subcollections = ['patients', 'medicines', 'doseLogs', 'healthRecords', 'appointments', 'settings'];
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'users', userId, sub));
      if (!snap.empty) {
        const docs = snap.docs;
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          docs.slice(i, i + CHUNK_SIZE).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

/**
 * One-time cleanup of legacy demo/fictional records from a user's own Firestore subcollections ONLY.
 * Strictly ignores global_medicines and preserves all user-created records.
 */
export async function cleanupDemoRecordsFromCloud(
  userId: string
): Promise<{ removedCount: number; completed: boolean }> {
  if (!userId) return { removedCount: 0, completed: false };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { removedCount: 0, completed: false };
  }

  const subcollections: UserDataCollection[] = [
    'patients',
    'medicines',
    'doseLogs',
    'healthRecords',
    'appointments',
  ];

  try {
    const deleteRefs: Array<ReturnType<typeof doc>> = [];
    const updateOps: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    for (const sub of subcollections) {
      const colRef = collection(db, 'users', userId, sub);
      const snap = await getDocsFromServer(colRef);
      snap.forEach((docSnap) => {
        if (isDemoRecordId(docSnap.id, sub)) {
          deleteRefs.push(docSnap.ref);
        } else if (sub === 'medicines') {
          const data = docSnap.data() as Medicine;
          if (Array.isArray(data.schedules) && data.schedules.some((s) => hasDemoPrefix(s?.id))) {
            updateOps.push({
              ref: docSnap.ref,
              data: {
                schedules: data.schedules.filter((s) => !hasDemoPrefix(s?.id)),
              },
            });
          }
        }
      });
    }

    // Clear default mock emergency contact if untouched from legacy mockData
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
      const settingsSnap = await getDocFromServer(settingsRef);
      if (settingsSnap.exists()) {
        const sData = settingsSnap.data() as Partial<ReminderSettings>;
        if (
          sData.emergencyContactName === 'তানভীর করিম (ছেলে)' &&
          sData.emergencyContactPhone === '+8801711223344'
        ) {
          updateOps.push({
            ref: settingsRef,
            data: {
              emergencyContactName: '',
              emergencyContactPhone: '',
            },
          });
        }
      }
    } catch (settingsErr) {
      // Non-fatal if settings doc does not exist yet
      console.warn('cleanupDemoRecordsFromCloud settings check notice:', settingsErr);
    }

    const totalOps = deleteRefs.length + updateOps.length;
    if (totalOps > 0) {
      const CHUNK_SIZE = 400;
      const allOps: Array<
        | { kind: 'delete'; ref: ReturnType<typeof doc> }
        | { kind: 'update'; ref: ReturnType<typeof doc>; data: Record<string, any> }
      > = [
        ...deleteRefs.map((ref) => ({ kind: 'delete' as const, ref })),
        ...updateOps.map((op) => ({ kind: 'update' as const, ref: op.ref, data: op.data })),
      ];

      for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        allOps.slice(i, i + CHUNK_SIZE).forEach((op) => {
          if (op.kind === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.set(op.ref, op.data, { merge: true });
          }
        });
        await batch.commit();
      }
    }

    return { removedCount: deleteRefs.length, completed: true };
  } catch (error) {
    console.warn('cleanupDemoRecordsFromCloud deferred due to network/server error:', error);
    return { removedCount: 0, completed: false };
  }
}

// Versioned Chunked Global Medicine Catalog Services (library_meta + library_chunks)

/**
 * Fetches the single metadata document library_meta/current (1 Firestore read).
 */
export async function fetchLibraryMetaFromCloud(): Promise<LibraryMetaDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'library_meta', 'current'));
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
      await batch.commit();
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
      await setDoc(doc(db, 'import_batches', importBatchInfo.id), stripUndefined(importBatchInfo));
      totalWrites += 1;
    }

    // 3. Update library_meta/current LAST so clients only switch after all chunks exist
    const metaPayload: LibraryMetaDoc = {
      version: newVersion,
      chunkCount: chunks.length,
      totalCount: cleanMedicines.length,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'library_meta', 'current'), metaPayload);
    totalWrites += 1;

    // 4. Best-effort cleanup of old version chunks (non-fatal if skipped/empty)
    try {
      const oldChunksSnap = await getDocs(
        query(collection(db, 'library_chunks'), where('version', '<', newVersion))
      );
      if (!oldChunksSnap.empty) {
        const docsToDelete = oldChunksSnap.docs;
        const DELETE_BATCH_SIZE = 300;
        for (let i = 0; i < docsToDelete.length; i += DELETE_BATCH_SIZE) {
          const delBatch = writeBatch(db);
          docsToDelete.slice(i, i + DELETE_BATCH_SIZE).forEach((d) => delBatch.delete(d.ref));
          await delBatch.commit();
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
    adminEmail: auth.currentUser?.email || ADMIN_EMAIL,
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
  try {
    assertAdminAuth();
    const activityId = activity.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const act: AdminActivity = {
      ...activity,
      id: activityId,
      timestamp: activity.timestamp || new Date().toISOString(),
      adminEmail: activity.adminEmail || auth.currentUser?.email || ADMIN_EMAIL,
    };
    await setDoc(doc(db, 'admin_activities', activityId), act);
  } catch (error) {
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
    const latencyMs = Math.round(performance.now() - start);
    return {
      isConnected: true,
      latencyMs,
      databaseId,
      projectId,
      userEmail: auth.currentUser?.email || 'N/A',
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
      userEmail: auth.currentUser?.email || 'N/A',
      online,
    };
  }
}

// ============================================================================
// পরিবারের যত্নকারী (Caregiver Mode) — সাশ্রয়ী Firestore অপারেশন
// ============================================================================

export async function createCaregiverInviteInCloud(linkDoc: CaregiverLinkDoc): Promise<void> {
  try {
    await setDoc(doc(db, 'caregiver_links', linkDoc.id), stripUndefined(linkDoc));
  } catch (error) {
    if (isQuotaExceededError(error)) {
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
  const docRef = doc(db, 'caregiver_links', inviteCode);
  let snap;
  try {
    snap = await getDocFromServer(docRef);
  } catch (err: any) {
    if (isQuotaExceededError(err)) throw err;
    const msg = String(err?.code || err?.message || '').toLowerCase();
    if (msg.includes('permission-denied')) {
      throw new Error('কোডটি সঠিক নয় বা ইতিমধ্যেই ব্যবহৃত হয়েছে');
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
    throw new Error('এই আমন্ত্রণ কোডটি আগেই ব্যবহার করা হয়েছে');
  }
  if (!data.expiresAtMs || Date.now() >= data.expiresAtMs) {
    throw new Error('এই কোডের ৪৮ ঘণ্টার মেয়াদ শেষ হয়ে গেছে। নতুন কোড চান।');
  }

  const nowIso = new Date().toISOString();
  const safeCaregiverName = (caregiverName || 'পরিবারের যত্নকারী').trim().slice(0, 128);

  try {
    await updateDoc(
      docRef,
      stripUndefined({
        caregiverUid,
        caregiverName: safeCaregiverName,
        status: 'active',
        linkedAt: nowIso,
        updatedAt: nowIso,
      })
    );
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    const msg = String((error as any)?.code || (error as any)?.message || '').toLowerCase();
    if (msg.includes('permission-denied')) {
      throw new Error('কোডটি আর বৈধ নয় বা মেয়াদ শেষ হয়ে গেছে');
    }
    handleFirestoreError(error, OperationType.UPDATE, `caregiver_links/${inviteCode}`);
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
      limit(10)
    );
    const snap = await getDocs(q);
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
      limit(10)
    );
    const snap = await getDocs(q);
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
    await updateDoc(doc(db, 'caregiver_links', linkId), stripUndefined(updates));
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    console.warn('updateCaregiverLinkInCloud warning:', error);
    throw error;
  }
}

export async function deleteCaregiverLinkInCloud(linkId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'caregiver_links', linkId));
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    handleFirestoreError(error, OperationType.DELETE, `caregiver_links/${linkId}`);
  }
}

export async function createFamilyAlertInCloud(alertDoc: FamilyAlertDoc): Promise<void> {
  const alertRef = doc(db, 'family_alerts', alertDoc.id);
  try {
    await setDoc(alertRef, stripUndefined(alertDoc));
  } catch (error: any) {
    if (isQuotaExceededError(error)) throw error;
    const msg = String(error?.code || error?.message || '').toLowerCase();
    // If retry hit an already-created immutable alert doc, verify existence before treating as error
    if (msg.includes('permission-denied')) {
      try {
        const existingSnap = await getDoc(alertRef);
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
    await updateDoc(doc(db, 'family_alerts', alertId), {
      seenBy: arrayUnion(caregiverUid),
    });
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    handleFirestoreError(error, OperationType.UPDATE, `family_alerts/${alertId}`);
  }
}

export async function cleanupOldFamilyAlertsInCloud(
  patientUid: string,
  retentionMs: number
): Promise<number> {
  try {
    const q = query(
      collection(db, 'family_alerts'),
      where('patientUid', '==', patientUid),
      limit(25)
    );
    const snap = await getDocs(q);
    const cutoff = Date.now() - retentionMs;
    const toDelete = snap.docs.filter((d) => {
      const data = d.data() as Partial<FamilyAlertDoc>;
      return typeof data.createdAtMs === 'number' && data.createdAtMs <= cutoff;
    });

    if (toDelete.length === 0) return 0;

    const batch = writeBatch(db);
    toDelete.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return toDelete.length;
  } catch (error) {
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

  const sortAlertsDesc = (items: FamilyAlertDoc[]) =>
    [...items].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  const attachFallbackListener = () => {
    if (cancelled || usedFallback) return;
    usedFallback = true;
    const fallbackQuery = query(
      collection(db, 'family_alerts'),
      where('caregiverUids', 'array-contains', caregiverUid),
      limit(20)
    );
    activeUnsub = onSnapshot(
      fallbackQuery,
      (snapshot) => {
        if (cancelled) return;
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

export type SharedReportFetchResult =
  | { status: 'ok'; report: SharedReportDoc }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function createSharedReportInCloud(
  snapshot: BuiltSharedReportSnapshot
): Promise<SharedReportDoc> {
  if (!auth.currentUser || auth.currentUser.uid !== snapshot.ownerUid) {
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
    await setDoc(doc(db, 'shared_reports', snapshot.token), firestorePayload);
    return {
      ...firestorePayload,
      createdAtMs: snapshot.createdAtMs,
      expiresAtMs: snapshot.expiresAtMs,
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
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
    return { status: 'unavailable' };
  }

  try {
    const snap = await getDocFromServer(doc(db, 'shared_reports', token));
    if (!snap.exists()) {
      return { status: 'unavailable' };
    }

    const raw = snap.data() as SharedReportDoc;
    const createdAtMs = toMillisSafe(raw.createdAt);
    const expiresAtMs = toMillisSafe(raw.expiresAt);
    if (raw.revoked || !expiresAtMs || expiresAtMs <= Date.now()) {
      return { status: 'unavailable' };
    }

    return {
      status: 'ok',
      report: {
        ...raw,
        createdAtMs,
        expiresAtMs,
      },
    };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      return {
        status: 'error',
        message: 'এই মুহূর্তে ক্লাউড সীমা পূর্ণ হওয়ায় রিপোর্ট খোলা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      };
    }

    const code = String(error?.code || error?.message || '').toLowerCase();
    if (
      code.includes('permission-denied') ||
      code.includes('missing or insufficient permissions') ||
      code.includes('not-found')
    ) {
      return { status: 'unavailable' };
    }

    return {
      status: 'error',
      message: 'ইন্টারনেট সংযোগের সমস্যার কারণে রিপোর্ট লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
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
    await updateDoc(doc(db, 'shared_reports', token), {
      revoked: true,
    });
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
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
    await deleteDoc(doc(db, 'shared_reports', token));
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      throw new Error('আজকের ক্লাউড সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন।');
    }
    const msg = String(error?.code || error?.message || '').toLowerCase();
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `shared_reports/${token}`);
    }
    throw new Error('লিংকটি মুছে ফেলা যায়নি। আবার চেষ্টা করুন।');
  }
}



