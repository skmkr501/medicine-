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
  deleteField,
} from 'firebase/firestore';
import { auth, db, executeGuardedWrite, stripUndefined } from './config';
import {
  handleFirestoreError,
  isQuotaExceededError,
  isWriteQuotaPaused,
  markWriteQuotaExceeded,
  OperationType,
  QuotaExceededWriteError,
} from './errors';
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
  CaregiverSuggestionDoc,
  CaregiverSuggestionStatus,
  FamilyAlertDoc,
  SharedReportDoc,
  EmergencyCardDoc,
  DoctorProfile,
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
import { buildCleanDoctorInput, DoctorProfileInput } from '../utils/doctorsManager';
import { buildCleanMedicalDocumentInput, DocumentFormInput } from '../utils/medicalDocuments';
import { isValidInviteCode, normalizeInviteCodeInput } from '../utils/caregiverAlerts';
import { CloudSyncOutbox } from '../utils/cloudSyncOutbox';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreUsageTracker';

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
  if (isWriteQuotaPaused()) return;
  const path = `users/${user.uid}`;
  try {
    await executeGuardedWrite(
      () =>
        setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'ব্যবহারকারী',
            photoURL: user.photoURL || '',
            lastLoginAt: new Date().toISOString(),
          },
          { merge: true }
        ),
      { collection: 'users', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Medicines
export async function saveMedicineToCloud(userId: string, medicine: Medicine): Promise<void> {
  const path = `users/${userId}/medicines/${medicine.id}`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'medicines', medicine.id), stripUndefined(medicine)),
      { collection: 'medicines', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMedicineFromCloud(userId: string, medicineId: string): Promise<void> {
  const path = `users/${userId}/medicines/${medicineId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'medicines', medicineId)),
      { collection: 'medicines', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Patients
export async function savePatientToCloud(userId: string, patient: PatientProfile): Promise<void> {
  const path = `users/${userId}/patients/${patient.id}`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'patients', patient.id), stripUndefined(patient)),
      { collection: 'patients', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePatientFromCloud(userId: string, patientId: string): Promise<void> {
  const path = `users/${userId}/patients/${patientId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'patients', patientId)),
      { collection: 'patients', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Dose Logs
export async function saveDoseLogToCloud(userId: string, doseLog: DoseLog): Promise<void> {
  const path = `users/${userId}/doseLogs/${doseLog.id}`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'doseLogs', doseLog.id), stripUndefined(doseLog)),
      { collection: 'doseLogs', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Settings
export async function saveSettingsToCloud(userId: string, settings: ReminderSettings): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'settings', 'preferences'), stripUndefined(settings), { merge: true }),
      { collection: 'settings', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Firestore CRUD for Health Records (ধাপ ১)
export async function saveHealthRecordToCloud(userId: string, record: HealthRecord): Promise<void> {
  const path = `users/${userId}/healthRecords/${record.id}`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'healthRecords', record.id), stripUndefined(record)),
      { collection: 'healthRecords', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHealthRecordFromCloud(userId: string, recordId: string): Promise<void> {
  const path = `users/${userId}/healthRecords/${recordId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'healthRecords', recordId)),
      { collection: 'healthRecords', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for Doctor Appointments (ধাপ ২)
export async function saveAppointmentToCloud(userId: string, appointment: DoctorAppointment): Promise<void> {
  const path = `users/${userId}/appointments/${appointment.id}`;
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'appointments', appointment.id), stripUndefined(appointment)),
      { collection: 'appointments', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAppointmentFromCloud(userId: string, appointmentId: string): Promise<void> {
  const path = `users/${userId}/appointments/${appointmentId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'appointments', appointmentId)),
      { collection: 'appointments', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Firestore CRUD for My Doctors ("আমার ডাক্তার" — ZERO onSnapshot listener)
export async function fetchUserDoctorsFromCloud(userId: string): Promise<DoctorProfile[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'doctors');
  let snap;
  try {
    snap = await getDocsFromServer(colRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(colRef);
  }
  recordFirestoreRead('doctors', Math.max(1, snap.size));
  const items: DoctorProfile[] = [];
  snap.forEach((docSnap) => {
    const raw = docSnap.data() as DoctorProfile;
    items.push({
      ...raw,
      id: raw.id || docSnap.id,
    });
  });
  return items;
}

export async function createDoctorInCloud(
  userId: string,
  doctor: DoctorProfileInput & { id: string }
): Promise<void> {
  const path = `users/${userId}/doctors/${doctor.id}`;
  const clean = buildCleanDoctorInput(doctor);
  const payload = stripUndefined({
    id: doctor.id,
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await executeGuardedWrite(
      () => setDoc(doc(db, 'users', userId, 'doctors', doctor.id), payload),
      { collection: 'doctors', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDoctorInCloud(
  userId: string,
  doctorId: string,
  fullOrPartial: DoctorProfileInput & { id?: string }
): Promise<void> {
  const path = `users/${userId}/doctors/${doctorId}`;
  const docRef = doc(db, 'users', userId, 'doctors', doctorId);
  const clean = buildCleanDoctorInput(fullOrPartial);

  // Never touch createdAt; remove cleared optional fields using deleteField()
  const patch: Record<string, any> = {
    id: doctorId,
    name: clean.name,
    isEmergency: Boolean(clean.isEmergency),
    updatedAt: serverTimestamp(),
  };

  const optionalKeys = [
    'specialty',
    'phone',
    'whatsapp',
    'hospital',
    'address',
    'visitingHours',
    'forConditions',
    'patientIds',
    'lastVisitDate',
    'nextVisitDate',
    'notes',
  ] as const;

  for (const key of optionalKeys) {
    const val = clean[key];
    if (val === undefined) {
      patch[key] = deleteField();
    } else {
      patch[key] = val;
    }
  }

  try {
    await executeGuardedWrite(
      () => updateDoc(docRef, stripUndefined(patch)),
      { collection: 'doctors', count: 1 }
    );
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    const code = String(error?.code || error?.message || '').toLowerCase();
    if (code.includes('not-found')) {
      // Fallback create if doc wasn't created in cloud yet (e.g., created while offline)
      await createDoctorInCloud(userId, { ...fullOrPartial, id: doctorId });
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDoctorFromCloud(userId: string, doctorId: string): Promise<void> {
  const path = `users/${userId}/doctors/${doctorId}`;
  try {
    await executeGuardedWrite(
      () => deleteDoc(doc(db, 'users', userId, 'doctors', doctorId)),
      { collection: 'doctors', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
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
    const writes: Array<{ col: string; ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    writes.push({
      col: 'users',
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
        col: 'patients',
        ref: doc(db, 'users', userId, 'patients', patient.id),
        data: stripUndefined(patient),
      });
    });

    medicines.forEach((med) => {
      writes.push({
        col: 'medicines',
        ref: doc(db, 'users', userId, 'medicines', med.id),
        data: stripUndefined(med),
      });
    });

    doseLogs.forEach((log) => {
      writes.push({
        col: 'doseLogs',
        ref: doc(db, 'users', userId, 'doseLogs', log.id),
        data: stripUndefined(log),
      });
    });

    writes.push({
      col: 'settings',
      ref: doc(db, 'users', userId, 'settings', 'preferences'),
      data: stripUndefined(settings),
    });

    if (healthRecords && healthRecords.length > 0) {
      healthRecords.forEach((hr) => {
        writes.push({
          col: 'healthRecords',
          ref: doc(db, 'users', userId, 'healthRecords', hr.id),
          data: stripUndefined(hr),
        });
      });
    }

    if (appointments && appointments.length > 0) {
      appointments.forEach((apt) => {
        writes.push({
          col: 'appointments',
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
      await executeGuardedWrite(() => batch.commit());
      const countsByCol: Record<string, number> = {};
      for (const item of chunk) {
        countsByCol[item.col] = (countsByCol[item.col] || 0) + 1;
      }
      for (const [col, count] of Object.entries(countsByCol)) {
        recordFirestoreWrite(col, count);
      }
    }

    return {
      medicinesCount: medicines.length,
      logsCount: doseLogs.length,
      patientsCount: patients.length,
    };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/[batch_migration]`);
    return { medicinesCount: 0, logsCount: 0, patientsCount: 0 };
  }
}

/**
 * Flushes ONLY locally queued offline/quota-paused/modified changes to Firestore (0 writes if empty).
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
  }
): Promise<{ syncedOpsCount: number }> {
  try {
    const ops: Array<
      | { col: string; kind: 'set'; ref: ReturnType<typeof doc>; data: any; merge?: boolean }
      | { col: string; kind: 'delete'; ref: ReturnType<typeof doc> }
    > = [];

    const medMap = new Map(snapshot.medicines.map((m) => [m.id, m]));
    for (const id of outbox.upserts.medicines) {
      const item = medMap.get(id);
      if (item) {
        ops.push({ col: 'medicines', kind: 'set', ref: doc(db, 'users', userId, 'medicines', id), data: stripUndefined(item) });
      }
    }
    for (const id of outbox.deletes.medicines) {
      ops.push({ col: 'medicines', kind: 'delete', ref: doc(db, 'users', userId, 'medicines', id) });
    }

    const patientMap = new Map(snapshot.patients.map((p) => [p.id, p]));
    for (const id of outbox.upserts.patients) {
      const item = patientMap.get(id);
      if (item) {
        ops.push({ col: 'patients', kind: 'set', ref: doc(db, 'users', userId, 'patients', id), data: stripUndefined(item) });
      }
    }
    for (const id of outbox.deletes.patients) {
      ops.push({ col: 'patients', kind: 'delete', ref: doc(db, 'users', userId, 'patients', id) });
    }

    const logMap = new Map(snapshot.doseLogs.map((l) => [l.id, l]));
    for (const id of outbox.upserts.doseLogs) {
      const item = logMap.get(id);
      if (item) {
        ops.push({ col: 'doseLogs', kind: 'set', ref: doc(db, 'users', userId, 'doseLogs', id), data: stripUndefined(item) });
      }
    }
    for (const id of outbox.deletes.doseLogs) {
      ops.push({ col: 'doseLogs', kind: 'delete', ref: doc(db, 'users', userId, 'doseLogs', id) });
    }

    const hrMap = new Map(snapshot.healthRecords.map((h) => [h.id, h]));
    for (const id of outbox.upserts.healthRecords) {
      const item = hrMap.get(id);
      if (item) {
        ops.push({ col: 'healthRecords', kind: 'set', ref: doc(db, 'users', userId, 'healthRecords', id), data: stripUndefined(item) });
      }
    }
    for (const id of outbox.deletes.healthRecords) {
      ops.push({ col: 'healthRecords', kind: 'delete', ref: doc(db, 'users', userId, 'healthRecords', id) });
    }

    const aptMap = new Map(snapshot.appointments.map((a) => [a.id, a]));
    for (const id of outbox.upserts.appointments) {
      const item = aptMap.get(id);
      if (item) {
        ops.push({ col: 'appointments', kind: 'set', ref: doc(db, 'users', userId, 'appointments', id), data: stripUndefined(item) });
      }
    }
    for (const id of outbox.deletes.appointments) {
      ops.push({ col: 'appointments', kind: 'delete', ref: doc(db, 'users', userId, 'appointments', id) });
    }

    if (outbox.settingsDirty) {
      ops.push({
        col: 'settings',
        kind: 'set',
        ref: doc(db, 'users', userId, 'settings', 'preferences'),
        data: stripUndefined(snapshot.settings),
        merge: true,
      });
    }

    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      chunk.forEach((op) => {
        if (op.kind === 'delete') {
          batch.delete(op.ref);
        } else if (op.merge) {
          batch.set(op.ref, op.data, { merge: true });
        } else {
          batch.set(op.ref, op.data);
        }
      });
      await executeGuardedWrite(() => batch.commit());
      const countsByCol: Record<string, number> = {};
      for (const op of chunk) {
        countsByCol[op.col] = (countsByCol[op.col] || 0) + 1;
      }
      for (const [col, count] of Object.entries(countsByCol)) {
        recordFirestoreWrite(col, count);
      }
    }

    let doctorOps = 0;
    const doctorMap = new Map((snapshot.doctors || []).map((d) => [d.id, d]));
    for (const id of outbox.upserts.doctors) {
      const docItem = doctorMap.get(id);
      if (docItem) {
        await updateDoctorInCloud(userId, id, docItem);
        doctorOps += 1;
      }
    }
    for (const id of outbox.deletes.doctors) {
      await deleteDoctorFromCloud(userId, id);
      doctorOps += 1;
    }

    return { syncedOpsCount: ops.length + doctorOps };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/[outbox_sync]`);
    return { syncedOpsCount: 0 };
  }
}

/**
 * Lightweight 1-doc write probe used ONLY on manual retry after a prior quota pause when outbox is empty.
 */
export async function probeCloudWriteAvailability(userId: string): Promise<void> {
  try {
    await executeGuardedWrite(
      () =>
        setDoc(
          doc(db, 'users', userId),
          { lastSyncCheckAt: new Date().toISOString() },
          { merge: true }
        ),
      { collection: 'users', count: 1 }
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Checks if a user already has data stored in Cloud Firestore (minimizing reads with limit(1) on history collections)
 */
export async function checkUserHasCloudData(
  userId: string
): Promise<{ hasData: boolean; medicinesCount: number; patientsCount: number }> {
  const fetchCollection = async (sub: string, maxDocs?: number) => {
    const colRef = collection(db, 'users', userId, sub);
    const targetQuery = maxDocs ? query(colRef, limit(maxDocs)) : colRef;
    let snap;
    try {
      snap = await getDocsFromServer(targetQuery);
    } catch {
      snap = await getDocs(targetQuery);
    }
    recordFirestoreRead(sub, Math.max(1, snap.size));
    return snap;
  };

  try {
    const [medsSnap, patientsSnap, logsSnap, healthSnap, aptsSnap] = await Promise.all([
      fetchCollection('medicines'),
      fetchCollection('patients'),
      fetchCollection('doseLogs', 1),
      fetchCollection('healthRecords', 1),
      fetchCollection('appointments', 1),
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
 * One-time getDocs helper for small user subcollections (medicines, patients, full healthRecords)
 */
export async function fetchUserCollectionFromCloud<T>(
  userId: string,
  subcollection: 'medicines' | 'patients' | 'healthRecords' | 'appointments'
): Promise<T[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, subcollection);
  let snap;
  try {
    snap = await getDocsFromServer(colRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(colRef);
  }
  recordFirestoreRead(subcollection, Math.max(1, snap.size));
  const items: T[] = [];
  snap.forEach((docSnap) => {
    items.push(docSnap.data() as T);
  });
  return items;
}

/**
 * Single-doc read for user reminder settings (1 read instead of subcollection listener)
 */
export async function fetchUserSettingsFromCloud(
  userId: string
): Promise<ReminderSettings | null> {
  if (!userId) return null;
  const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
  let snap;
  try {
    snap = await getDocFromServer(settingsRef);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDoc(settingsRef);
  }
  recordFirestoreRead('settings', 1);
  return snap.exists() ? (snap.data() as ReminderSettings) : null;
}

/**
 * On-demand read of doseLogs older than the 45-day real-time window
 */
export async function fetchOlderDoseLogsFromCloud(
  userId: string,
  cutoffDateIso: string
): Promise<DoseLog[]> {
  if (!userId) return [];
  const q = query(
    collection(db, 'users', userId, 'doseLogs'),
    where('scheduledDate', '<', cutoffDateIso)
  );
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(q);
  }
  recordFirestoreRead('doseLogs', Math.max(1, snap.size));
  const logs: DoseLog[] = [];
  snap.forEach((docSnap) => {
    logs.push(docSnap.data() as DoseLog);
  });
  return logs;
}

/**
 * Boot-time read of upcoming/recent appointments only (single-field range query)
 */
export async function fetchUpcomingAppointmentsFromCloud(
  userId: string,
  minDateIso: string
): Promise<DoctorAppointment[]> {
  if (!userId) return [];
  const q = query(
    collection(db, 'users', userId, 'appointments'),
    where('appointmentDate', '>=', minDateIso)
  );
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(q);
  }
  recordFirestoreRead('appointments', Math.max(1, snap.size));
  const items: DoctorAppointment[] = [];
  snap.forEach((docSnap) => {
    items.push(docSnap.data() as DoctorAppointment);
  });
  return items;
}

/**
 * On-demand read of past appointments when user visits Appointments or Share Report
 */
export async function fetchPastAppointmentsFromCloud(
  userId: string,
  beforeDateIso: string
): Promise<DoctorAppointment[]> {
  if (!userId) return [];
  const q = query(
    collection(db, 'users', userId, 'appointments'),
    where('appointmentDate', '<', beforeDateIso)
  );
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(q);
  }
  recordFirestoreRead('appointments', Math.max(1, snap.size));
  const items: DoctorAppointment[] = [];
  snap.forEach((docSnap) => {
    items.push(docSnap.data() as DoctorAppointment);
  });
  return items;
}

/**
 * Lazy-loaded recent health records (ordered by recordDate desc, capped at maxCount)
 */
export async function fetchRecentHealthRecordsFromCloud(
  userId: string,
  maxCount: number = 60
): Promise<{ records: HealthRecord[]; hasMore: boolean }> {
  if (!userId) return { records: [], hasMore: false };
  const q = query(
    collection(db, 'users', userId, 'healthRecords'),
    orderBy('recordDate', 'desc'),
    limit(maxCount + 1)
  );
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    snap = await getDocs(q);
  }
  recordFirestoreRead('healthRecords', Math.max(1, snap.size));
  const docs: HealthRecord[] = [];
  snap.forEach((docSnap) => {
    docs.push(docSnap.data() as HealthRecord);
  });
  const hasMore = docs.length > maxCount;
  return {
    records: hasMore ? docs.slice(0, maxCount) : docs,
    hasMore,
  };
}

/**
 * Safely clears only the user's own UID subcollections in Cloud Firestore
 */
export async function clearUserCloudData(userId: string): Promise<void> {
  try {
    // Delete documentFiles by ID first (documentFiles disallows list in security rules)
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

    const subcollections = [
      'patients',
      'medicines',
      'doseLogs',
      'healthRecords',
      'appointments',
      'doctors',
      'settings',
    ];
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'users', userId, sub));
      recordFirestoreRead(sub, Math.max(1, snap.size));
      if (!snap.empty) {
        const docs = snap.docs;
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await executeGuardedWrite(() => batch.commit(), { collection: sub, count: chunk.length });
        }
      }
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
      throw error;
    }
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
  if (!userId || isWriteQuotaPaused()) return { removedCount: 0, completed: false };
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
    const ops: Array<
      | { col: string; kind: 'delete'; ref: ReturnType<typeof doc> }
      | { col: string; kind: 'update'; ref: ReturnType<typeof doc>; data: Record<string, any> }
    > = [];

    for (const sub of subcollections) {
      const colRef = collection(db, 'users', userId, sub);
      const snap = await getDocsFromServer(colRef);
      recordFirestoreRead(sub, Math.max(1, snap.size));
      snap.forEach((docSnap) => {
        if (isDemoRecordId(docSnap.id, sub)) {
          ops.push({ col: sub, kind: 'delete', ref: docSnap.ref });
        } else if (sub === 'medicines') {
          const data = docSnap.data() as Medicine;
          if (Array.isArray(data.schedules) && data.schedules.some((s) => hasDemoPrefix(s?.id))) {
            ops.push({
              col: sub,
              kind: 'update',
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
      recordFirestoreRead('settings', 1);
      if (settingsSnap.exists()) {
        const sData = settingsSnap.data() as Partial<ReminderSettings>;
        if (
          sData.emergencyContactName === 'তানভীর করিম (ছেলে)' &&
          sData.emergencyContactPhone === '+8801711223344'
        ) {
          ops.push({
            col: 'settings',
            kind: 'update',
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

    const removedCount = ops.filter((o) => o.kind === 'delete').length;
    if (ops.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          if (op.kind === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.set(op.ref, op.data, { merge: true });
          }
        });
        await executeGuardedWrite(() => batch.commit());
        const countsByCol: Record<string, number> = {};
        for (const op of chunk) {
          countsByCol[op.col] = (countsByCol[op.col] || 0) + 1;
        }
        for (const [col, count] of Object.entries(countsByCol)) {
          recordFirestoreWrite(col, count);
        }
      }
    }

    return { removedCount, completed: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markWriteQuotaExceeded();
    }
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
      adminEmail: activity.adminEmail || auth.currentUser?.email || ADMIN_EMAIL,
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
  if (!auth.currentUser || auth.currentUser.uid !== payload.ownerUid) {
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
  if (!auth.currentUser || auth.currentUser.uid !== payload.ownerUid) {
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
  if (!auth.currentUser || auth.currentUser.uid !== newPayload.ownerUid) {
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
  if (!auth.currentUser || auth.currentUser.uid !== suggestion.caregiverUid) {
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





