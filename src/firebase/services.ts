import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
} from 'firebase/firestore';
import { auth, db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import {
  Medicine,
  PatientProfile,
  DoseLog,
  ReminderSettings,
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
 */
export function assertAdminAuth(): void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('অননুমোদিত অ্যাক্সেস! ক্রিয়াকলাপের জন্য অনুগ্রহ করে প্রথমে অ্যাডমিন হিসেবে সাইন-ইন করুন।');
  }
  if (!isUserAdmin(currentUser.email)) {
    throw new Error(
      `নিরাপত্তা বিধিনিষেধ: শুধুমাত্র অনুমোদিত প্রধান প্রশাসক (${ADMIN_EMAIL}) এই কাজটি করতে পারবেন। বর্তমান অ্যাকাউন্ট (${currentUser.email || 'বেনামী'}) অননুমোদিত।`
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
    await setDoc(doc(db, 'users', userId, 'medicines', medicine.id), medicine, { merge: true });
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
    await setDoc(doc(db, 'users', userId, 'patients', patient.id), patient, { merge: true });
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
    await setDoc(doc(db, 'users', userId, 'doseLogs', doseLog.id), doseLog, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Settings
export async function saveSettingsToCloud(userId: string, settings: ReminderSettings): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Safe Migration of Local Data into Cloud (without overwriting or losing anything)
export async function migrateLocalDataToCloud(
  userId: string,
  medicines: Medicine[],
  patients: PatientProfile[],
  doseLogs: DoseLog[],
  settings: ReminderSettings
): Promise<{ medicinesCount: number; logsCount: number; patientsCount: number }> {
  try {
    const batch = writeBatch(db);

    // Save user document
    const userRef = doc(db, 'users', userId);
    batch.set(
      userRef,
      {
        uid: userId,
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || 'ব্যবহারকারী',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Patients
    patients.forEach((patient) => {
      const ref = doc(db, 'users', userId, 'patients', patient.id);
      batch.set(ref, patient, { merge: true });
    });

    // Medicines
    medicines.forEach((med) => {
      const ref = doc(db, 'users', userId, 'medicines', med.id);
      batch.set(ref, med, { merge: true });
    });

    // Dose Logs (migrate recent logs)
    doseLogs.forEach((log) => {
      const ref = doc(db, 'users', userId, 'doseLogs', log.id);
      batch.set(ref, log, { merge: true });
    });

    // Settings
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    batch.set(settingsRef, settings, { merge: true });

    await batch.commit();

    return {
      medicinesCount: medicines.length,
      logsCount: doseLogs.length,
      patientsCount: patients.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/[batch_migration]`);
  }
}

// Global Medicine Catalog Services
export async function saveGlobalMedicine(medicine: GlobalMedicine): Promise<void> {
  assertAdminAuth();
  const path = `global_medicines/${medicine.id}`;
  try {
    await setDoc(doc(db, 'global_medicines', medicine.id), medicine, { merge: true });
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
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও অনুমোদিত',
        }
      : {
          ...medicineOrId,
          status: 'published',
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও অনুমোদিত',
        };
  try {
    await setDoc(doc(db, 'global_medicines', id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
    await setDoc(batchDocRef, batchInfo);

    // 2. Commit medicines in batches of 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < medicines.length; i += CHUNK_SIZE) {
      const chunk = medicines.slice(i, i + CHUNK_SIZE);
      const writeBatchInst = writeBatch(db);
      chunk.forEach((med) => {
        const medRef = doc(db, 'global_medicines', med.id);
        writeBatchInst.set(medRef, med, { merge: true });
      });
      await writeBatchInst.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'global_medicines/[bulk_import]');
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

