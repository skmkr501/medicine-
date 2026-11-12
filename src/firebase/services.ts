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
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDocsFromServer,
  getDocFromServer,
  getCountFromServer,
} from 'firebase/firestore';
import { auth, db, stripUndefined } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { isDemoRecordId, hasDemoPrefix, UserDataCollection } from '../utils/demoCleanup';
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
} from '../types';

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

// Global Medicine Catalog Services
export async function saveGlobalMedicine(medicine: GlobalMedicine): Promise<void> {
  assertAdminAuth();
  const path = `global_medicines/${medicine.id}`;
  try {
    await setDoc(doc(db, 'global_medicines', medicine.id), stripUndefined(medicine), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishGlobalMedicine(medicineOrId: string | GlobalMedicine): Promise<void> {
  assertAdminAuth();
  const id = typeof medicineOrId === 'string' ? medicineOrId : medicineOrId.id;
  const path = `global_medicines/${id}`;
  const payload =
    typeof medicineOrId === 'string'
      ? {
          status: 'published',
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
        }
      : {
          ...medicineOrId,
          status: 'published',
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
        };
  try {
    await setDoc(doc(db, 'global_medicines', id), stripUndefined(payload), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Publishes multiple draft medicines to the global catalog in real-time.
 * Uses atomic chunked write batches and cleans up any legacy test-license markers.
 */
export async function bulkPublishGlobalMedicines(medicines: GlobalMedicine[]): Promise<number> {
  assertAdminAuth();
  if (!medicines || medicines.length === 0) return 0;

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < medicines.length; i += CHUNK_SIZE) {
      const chunk = medicines.slice(i, i + CHUNK_SIZE);
      const writeBatchInst = writeBatch(db);
      chunk.forEach((med) => {
        const medRef = doc(db, 'global_medicines', med.id);
        const cleanLicense =
          med.licenseReference && med.licenseReference.includes('TEST-SYSTEM-ONLY')
            ? 'DGDA Public Gazette / National Formulary'
            : (med.licenseReference || 'DGDA Public Gazette Open Data');

        const cleanMed = stripUndefined({
          ...med,
          status: 'published' as const,
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
          licenseReference: cleanLicense,
        });

        writeBatchInst.set(medRef, cleanMed, { merge: true });
      });
      await writeBatchInst.commit();
    }
    return medicines.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'global_medicines/[bulk_publish]');
    return 0;
  }
}

export async function bulkImportGlobalMedicines(
  batchInfo: ImportBatch,
  medicines: GlobalMedicine[]
): Promise<void> {
  assertAdminAuth();
  try {
    // 1. Record Import Batch doc
    const batchDocRef = doc(db, 'import_batches', batchInfo.id);
    await setDoc(batchDocRef, stripUndefined(batchInfo));

    // 2. Commit medicines in batches of 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < medicines.length; i += CHUNK_SIZE) {
      const chunk = medicines.slice(i, i + CHUNK_SIZE);
      const writeBatchInst = writeBatch(db);
      chunk.forEach((med) => {
        const medRef = doc(db, 'global_medicines', med.id);
        writeBatchInst.set(medRef, stripUndefined(med), { merge: true });
      });
      await writeBatchInst.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'global_medicines/[bulk_import]');
  }
}

/**
 * Reads directly from the server to verify exactly how many global medicines exist in Cloud Firestore
 */
export async function verifyCloudGlobalMedicinesCount(): Promise<number> {
  try {
    const coll = collection(db, 'global_medicines');
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  } catch (error) {
    console.warn('verifyCloudGlobalMedicinesCount getCountFromServer failed, falling back to getDocsFromServer:', error);
    const snap = await getDocsFromServer(collection(db, 'global_medicines'));
    return snap.size;
  }
}

/**
 * Returns exact server counts for total, published, and draft medicines from Cloud Firestore
 */
export async function getCloudMedicineCounts(): Promise<{ total: number; published: number; draft: number }> {
  try {
    const snap = await getDocsFromServer(collection(db, 'global_medicines'));
    let published = 0;
    let draft = 0;
    snap.docs.forEach((d) => {
      const data = d.data() as GlobalMedicine;
      if (data.status === 'published' && data.verifiedByAdmin) {
        published++;
      } else {
        draft++;
      }
    });
    return {
      total: snap.size,
      published,
      draft,
    };
  } catch (err) {
    console.warn('getCloudMedicineCounts error:', err);
    return { total: 0, published: 0, draft: 0 };
  }
}

export async function fetchGlobalMedicines(): Promise<GlobalMedicine[]> {
  try {
    const isAdmin = isUserAdmin(auth.currentUser?.email);
    // Non-admins query published medicines via single-field query (no composite index required)
    const q = isAdmin
      ? collection(db, 'global_medicines')
      : query(
          collection(db, 'global_medicines'),
          where('status', '==', 'published')
        );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => docSnap.data() as GlobalMedicine);
  } catch (error) {
    console.warn('Could not fetch global medicines from firestore:', error);
    return [];
  }
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
 * Safely deletes a global medicine draft/test record
 * Validates admin status both locally and on Firestore rules
 */
export async function deleteGlobalMedicine(medicineId: string): Promise<void> {
  assertAdminAuth();
  const path = `global_medicines/${medicineId}`;
  try {
    await deleteDoc(doc(db, 'global_medicines', medicineId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Bulk deletes multiple global medicine draft/test records
 * Executes via Firestore writeBatch in chunks
 */
export async function bulkDeleteGlobalMedicines(medicineIds: string[]): Promise<void> {
  assertAdminAuth();
  if (!medicineIds.length) return;

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < medicineIds.length; i += CHUNK_SIZE) {
      const chunk = medicineIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, 'global_medicines', id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'global_medicines/[bulk_delete]');
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
    await getDoc(doc(db, 'import_batches', '_health_check_ping_'));
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
    // If the error is not-found or permission-denied (still connected to server)
    const isActuallyConnected = !error?.message?.includes('failed-precondition') && !error?.message?.includes('offline');
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

