import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Medicine,
  PatientProfile,
  DoseLog,
  ReminderSettings,
  NavigationPage,
  TimeSlot,
  GlobalMedicine,
  ImportBatch,
  ImportDataSource,
  ImportSourceType,
  StockAdjustment,
  StockPrediction,
  HealthRecord,
  DoctorAppointment,
  CaregiverLinkDoc,
  CaregiverSuggestionDoc,
  CaregiverSuggestedMedicinePayload,
  FamilyAlertDoc,
  DoctorProfile,
  MedicalDocument,
} from '../types';
import {
  initialPatients,
  initialMedicines,
  initialDoseLogs,
  initialSettings,
  initialHealthRecords,
  initialAppointments,
} from '../data/mockData';
import { playAlertTone, toBengaliNumber } from '../utils/bengaliUtils';
import {
  parseDosageUnits,
  predictAllMedicinesStock,
  getNewEligibleAlerts,
  markStockAlertSent,
} from '../utils/stockPredictor';
import {
  syncNativeReminders,
  clearAllNativeReminders,
  isNativeRemindersAvailable,
} from '../services/nativeReminders';
import { auth, db, resumeFirestoreNetwork, testFirestoreConnection, stripUndefined, isFirestoreNetworkDisabled } from '../firebase/config';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  saveMedicineToCloud,
  deleteMedicineFromCloud,
  savePatientToCloud,
  deletePatientFromCloud,
  saveDoseLogToCloud,
  saveSettingsToCloud,
  saveHealthRecordToCloud,
  deleteHealthRecordFromCloud,
  saveAppointmentToCloud,
  deleteAppointmentFromCloud,
  migrateLocalDataToCloud,
  flushOutboxToCloud,
  logOut,
  ADMIN_EMAIL,
  isUserAdmin,
  fetchLibraryMetaFromCloud,
  fetchLibraryChunksByVersion,
  publishChunkedLibraryCatalog,
  migrateLegacyGlobalMedicinesToChunks,
  recordAdminActivity,
  checkUserHasCloudData,
  clearUserCloudData,
  cleanupDemoRecordsFromCloud,
  createCaregiverInviteInCloud,
  redeemCaregiverInviteInCloud,
  fetchPatientCaregiverLinks,
  fetchCaregiverPatientsLinks,
  updateCaregiverLinkInCloud,
  deleteCaregiverLinkInCloud,
  createFamilyAlertInCloud,
  markFamilyAlertSeenInCloud,
  cleanupOldFamilyAlertsInCloud,
  subscribeToCaregiverAlerts,
  createCaregiverSuggestionInCloud,
  subscribeToPatientPendingSuggestions,
  fetchCaregiverSentSuggestions,
  updateCaregiverSuggestionStatusInCloud,
  fetchUserCollectionFromCloud,
  fetchUserSettingsFromCloud,
  fetchOlderDoseLogsFromCloud,
  fetchUpcomingAppointmentsFromCloud,
  fetchPastAppointmentsFromCloud,
  fetchRecentHealthRecordsFromCloud,
  fetchUserDoctorsFromCloud,
  createDoctorInCloud,
  updateDoctorInCloud,
  deleteDoctorFromCloud,
  fetchUserDocumentsMetaFromCloud,
  fetchDocumentFileFromCloud,
  createDocumentFileInCloud,
  deleteDocumentFileFromCloud,
  createDocumentMetaInCloud,
  updateDocumentMetaInCloud,
  deleteDocumentMetaFromCloud,
} from '../firebase/services';
import {
  getFriendlyErrorMessage,
  isQuotaExceededError,
  isWriteQuotaPaused,
  markWriteQuotaExceeded,
  clearWriteQuotaPause,
  consumeQuotaExceededNoticeOnce,
  subscribeWriteQuotaExceeded,
  QUOTA_EXCEEDED_BN_MSG,
} from '../firebase/errors';
import {
  loadCloudSyncOutbox,
  clearCloudSyncOutbox,
  countPendingOutboxChanges,
  markOutboxUpsert,
  markOutboxDelete,
  markOutboxSettingsDirty,
  clearOutboxEntry,
  OutboxCollectionKey,
  getLastSuccessfulSyncMs,
  setLastSuccessfulSyncMs,
  collectDirtySyncPlan,
  DirtySyncPlan,
} from '../utils/cloudSyncOutbox';
import { isTestMedicine, sanitizeMedicineId, generateDuplicateKey } from '../utils/medicineImportParser';
import {
  DEMO_CLEANUP_FLAG,
  isDemoRecordId,
  filterOutDemoRecords,
  stripDemoEmergencyContact,
  cleanDemoDataSnapshot,
} from '../utils/demoCleanup';
import {
  evaluateGlobalCatalogSnapshot,
  formatLibrarySyncTime,
  PublishedBaselineState,
} from '../utils/libraryRealtime';
import {
  loadLibraryFromIndexedDb,
  saveLibraryToIndexedDb,
} from '../utils/libraryIndexedDb';
import {
  LibraryMetaDoc,
  hasCatalogChanges,
  shouldFetchChunksForMeta,
} from '../utils/libraryChunks';
import {
  BulkMedicinePatch,
  applyBulkMedicinePatch,
  mergeRestoredMedicines,
} from '../utils/libraryManagement';
import {
  MAX_CAREGIVERS,
  CAREGIVER_INVITE_TTL_MS,
  ALERT_RETENTION_MS,
  generateInviteCode,
  normalizeInviteCodeInput,
  isValidInviteCode,
  isInviteExpired,
  cleanPhoneForLinks,
  evaluateCaregiverTriggers,
  loadSentFamilyAlertIds,
  markFamilyAlertSentLocally,
  loadPendingFamilyAlerts,
  enqueuePendingFamilyAlerts,
  removePendingFamilyAlert,
} from '../utils/caregiverAlerts';
import {
  MAX_DAILY_CAREGIVER_SUGGESTIONS,
  CaregiverSuggestionFormInput,
  filterVisiblePendingSuggestions,
  buildCaregiverSuggestionPayload,
  getCaregiverDailySuggestionCount,
  incrementCaregiverDailySuggestionCount,
  loadAnnouncedSuggestionIds,
  markSuggestionsAnnounced,
  findTargetMedicineForSuggestion,
  buildMedicineInputFromSuggestion,
} from '../utils/caregiverSuggestions';
import { toLocalIsoDate } from '../utils/shoppingListCalculator';
import {
  DOSE_LOG_REALTIME_DAYS,
  COLLECTION_SYNC_TTL_MS,
  RECORDS_SYNC_TTL_MS,
  HEALTH_RECORDS_INITIAL_LIMIT,
  getDoseLogsCutoffDate,
  getAppointmentsRecentCutoffDate,
  mergeDoseLogsWithWindow,
  replaceOlderDoseLogsKeepingRecent,
  mergeUpcomingAppointments,
  replacePastAppointmentsKeepingUpcoming,
  shouldFetchCollectionFromCloud,
  markCollectionSynced,
  invalidateCollectionSyncMeta,
  loadCachedOlderDoseLogs,
  saveCachedOlderDoseLogs,
  loadCachedPastAppointments,
  saveCachedPastAppointments,
  clearUserReadOptimizerCaches,
} from '../utils/firestoreReadOptimizer';
import {
  DoctorProfileInput,
  buildCleanDoctorInput,
  sortDoctors,
  loadCachedDoctors,
  saveCachedDoctors,
  clearCachedDoctors,
  mergeLocalAndCloudDoctors,
} from '../utils/doctorsManager';
import {
  MAX_USER_DOCUMENT_PAGES,
  DocumentFormInput,
  buildCleanMedicalDocumentInput,
  canAddUserPages,
  countTotalUserPages,
  rotateDegreeClockwise,
  sortMedicalDocumentsNewestFirst,
} from '../utils/medicalDocuments';
import {
  loadDocumentsMetaFromIdb,
  saveDocumentsMetaToIdb,
  getDocumentFileFromIdb,
  saveDocumentFileToIdb,
  deleteDocumentFilesFromIdb,
  clearUserDocumentsIdb,
  loadDocSyncQueue,
  enqueueDocUpsert,
  enqueueDocDelete,
  markFileUploadedInQueue,
  markFileDeletedInQueue,
  markDocUpsertSyncedInQueue,
  markDocDeleteSyncedInQueue,
  countPendingDocSyncOps,
  getPendingDocIdSet,
  clearDocSyncQueue,
} from '../utils/documentsIndexedDb';
import { recordFirestoreRead } from '../utils/firestoreUsageTracker';
import {
  ADMIN_QUOTA_SAVED_TOAST,
  loadAdminPublishQueue,
  saveAdminPublishQueue,
  clearAdminPublishQueue,
  dedupeAndMergeQueueMedicines,
  dedupeAndMergeQueueBatches,
  removeIdsFromPublishQueue,
  mergePendingQueueForAdminDisplay,
  combineCatalogWithPendingQueueForSingleVersionPublish,
  shouldAttemptAdminQueueAutoPublish,
} from '../utils/adminPublishQueue';


interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'info' | 'alert';
}

interface MedicineContextType {
  medicines: Medicine[];
  doseLogs: DoseLog[];
  patients: PatientProfile[];
  activePatientId: string | null;
  activePatient: PatientProfile | null;
  setActivePatientId: (id: string | null) => void;
  settings: ReminderSettings;
  updateSettings: (newSettings: Partial<ReminderSettings>) => void;
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;
  selectedMedicineIdForDetail: string | null;
  setSelectedMedicineIdForDetail: (id: string | null) => void;
  markDose: (
    medicineId: string,
    timeSlot: TimeSlot,
    scheduledTime: string,
    status: 'taken' | 'skipped',
    notes?: string
  ) => void;
  addMedicine: (medicine: Omit<Medicine, 'id'>) => string;
  addMultipleMedicines: (medicinesList: Array<Omit<Medicine, 'id'>>) => Promise<string[]>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  adjustStock: (id: string, delta: number) => void;
  assignMedicineToPatient: (medicineId: string, patientId?: string) => void;

  // Patient Profile Management
  addPatient: (patient: Omit<PatientProfile, 'id'>) => void;
  updatePatient: (id: string, updates: Partial<PatientProfile>) => void;
  deletePatient: (id: string) => void;
  archivePatient: (id: string) => void;
  unarchivePatient: (id: string) => void;
  isProfileModalOpen: boolean;
  editingPatient: PatientProfile | null;
  openCreateProfileModal: () => void;
  openEditProfileModal: (patient: PatientProfile) => void;
  closeProfileModal: () => void;

  resetAllData: () => void;
  toast: ToastState | null;
  showToast: (message: string, type?: 'success' | 'info' | 'alert') => void;

  // Health Records (ধাপ ১ — অন-ডিমান্ড লোড)
  healthRecords: HealthRecord[];
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt'>) => string;
  deleteHealthRecord: (id: string) => void;
  isLoadingHealthRecords: boolean;
  hasMoreOlderHealthRecords: boolean;
  loadHealthRecords: (options?: { loadAll?: boolean; forceRefresh?: boolean }) => Promise<void>;

  // Doctor Appointments (ধাপ ২ — আসন্ন বুটে, পুরনো অন-ডিমান্ড)
  appointments: DoctorAppointment[];
  addAppointment: (appointment: Omit<DoctorAppointment, 'id' | 'createdAt'>) => string;
  updateAppointment: (id: string, updates: Partial<DoctorAppointment>) => void;
  deleteAppointment: (id: string) => void;
  pastAppointmentsLoaded: boolean;
  isLoadingPastAppointments: boolean;
  loadPastAppointments: (forceRefresh?: boolean) => Promise<void>;

  // My Doctors Directory ("আমার ডাক্তার" — শূন্য real-time listener, ৬ ঘণ্টার ক্যাশ)
  doctors: DoctorProfile[];
  isLoadingDoctors: boolean;
  loadDoctors: (forceRefresh?: boolean) => Promise<void>;
  addDoctor: (doctor: DoctorProfileInput) => DoctorProfile;
  updateDoctor: (id: string, updates: DoctorProfileInput) => void;
  deleteDoctor: (id: string) => void;

  // Prescriptions & Medical Reports Vault ("প্রেসক্রিপশন ও রিপোর্ট" — শূন্য real-time listener, IndexedDB আগে)
  medicalDocuments: MedicalDocument[];
  isLoadingMedicalDocuments: boolean;
  pendingDocIds: string[];
  totalUsedDocumentPages: number;
  loadMedicalDocuments: (forceRefresh?: boolean) => Promise<void>;
  saveMedicalDocument: (
    input: DocumentFormInput & { id?: string },
    newFileDataList: Array<{ id: string; data: string; bytes: number }>
  ) => Promise<{ ok: boolean; docId?: string; savedOffline?: boolean; error?: string }>;
  rotateMedicalDocumentPage: (docId: string, pageIndex: number) => Promise<void>;
  deleteMedicalDocument: (docId: string) => Promise<void>;
  loadDocumentPageImage: (fileId: string) => Promise<string | null>;
  unlinkOrDeleteDoctorPrescriptions: (
    doctorId: string,
    mode: 'keep_unlinked' | 'delete_all'
  ) => Promise<void>;

  // Older Dose Logs (> 45 days on-demand)
  olderDoseLogsLoaded: boolean;
  isLoadingOlderDoseLogs: boolean;
  loadOlderDoseLogs: (forceRefresh?: boolean) => Promise<void>;
  
  // Firebase Auth & Cloud Sync States
  currentUser: User | null;
  isAuthLoading: boolean;
  isCloudConnected: boolean;
  isSyncing: boolean;
  syncStatus: 'synced' | 'syncing' | 'failed' | 'offline';
  isQuotaExceeded: boolean;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  triggerManualSync: () => Promise<void>;
  pendingSyncPreview: {
    totalWrites: number;
    breakdownLabels: string[];
  } | null;
  confirmManualSync: () => Promise<void>;
  cancelManualSync: () => void;
  downloadLocalBackup: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signOutUser: () => Promise<void>;
  syncLocalToCloud: () => Promise<void>;

  // Data Conflict Resolution (লগইনে ফোনের আগের ডেটা vs ক্লাউড ডেটা)
  isDataConflictModalOpen: boolean;
  conflictInfo: {
    localMedicinesCount: number;
    localPatientsCount: number;
    cloudMedicinesCount: number;
    cloudPatientsCount: number;
  } | null;
  resolveDataConflict: (action: 'merge' | 'discard') => Promise<void>;

  // 2-Step Reset Confirmation Modal
  isResetConfirmationModalOpen: boolean;
  openResetConfirmationModal: () => void;
  closeResetConfirmationModal: () => void;
  confirmResetAllData: (deleteFromCloud: boolean) => Promise<void>;

  // Global Medicine Catalog & Admin Import
  globalMedicines: GlobalMedicine[];
  libraryVersion: number;
  importBatches: ImportBatch[];
  isAdmin: boolean;
  adminEmail: string;
  lastSyncTime: string;
  isOnline: boolean;
  isGlobalFromCache: boolean;
  latestLibraryNotice: { count: number; message: string; timestamp: number } | null;
  dismissLibraryNotice: () => void;
  cloudStats: { total: number; published: number; draft: number };
  refreshCloudCounts: () => Promise<void>;
  migrateLegacyLibraryAction: () => Promise<{
    legacyFoundCount: number;
    mergedTotalCount: number;
    newVersion: number;
    chunkCount: number;
  } | null>;
  selectedGlobalMedForDetail: GlobalMedicine | null;
  setSelectedGlobalMedForDetail: (med: GlobalMedicine | null) => void;
  isAddToPersonalModalOpen: boolean;
  catalogMedToAddToPersonal: GlobalMedicine | null;
  openAddToPersonalModal: (med: GlobalMedicine) => void;
  closeAddToPersonalModal: () => void;
  publishGlobalMedicineAction: (medicineId: string) => Promise<boolean>;
  bulkPublishGlobalMedicinesAction: (medicineIds?: string[]) => Promise<number>;
  deleteGlobalMedicineAction: (medicineId: string) => Promise<boolean>;
  bulkDeleteGlobalMedicinesAction: (medicineIds: string[]) => Promise<boolean>;
  isManualAddModalOpen: boolean;
  editingGlobalMedicine: GlobalMedicine | null;
  openManualAddModal: () => void;
  openEditGlobalMedicineModal: (med: GlobalMedicine) => void;
  closeManualAddModal: () => void;
  addSingleGlobalMedicineAction: (
    medicine: Omit<GlobalMedicine, 'id' | 'duplicateKey' | 'importedAt'> & { id?: string }
  ) => Promise<boolean>;
  updateSingleGlobalMedicineAction: (updatedMed: GlobalMedicine) => Promise<boolean>;
  bulkUpdateGlobalMedicinesAction: (ids: string[], patch: BulkMedicinePatch) => Promise<number>;
  adminDeleteGlobalMedicinesAction: (
    ids: string[]
  ) => Promise<{ success: boolean; deletedItems: GlobalMedicine[]; errorMessage?: string }>;
  restoreDeletedGlobalMedicinesAction: (itemsToRestore: GlobalMedicine[]) => Promise<boolean>;
  executeAdminBatchImport: (
    batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'importedByUid' | 'importedByEmail'>,
    records: GlobalMedicine[]
  ) => Promise<boolean>;
  pendingPublishMedicines: GlobalMedicine[];
  pendingPublishBatches: ImportBatch[];
  pendingPublishLastRetryAttemptMs: number | null;
  isRetryingPendingPublish: boolean;
  retryPendingPublishNow: () => Promise<boolean>;
  cancelPendingPublishItem: (medicineId: string) => Promise<void>;
  clearPendingPublishQueue: () => Promise<void>;
  addCatalogMedToPersonal: (
    med: GlobalMedicine,
    config: {
      patientId?: string;
      mealTiming: any;
      schedules: any[];
      stock: number;
      unit: string;
      instructions?: string;
    }
  ) => string;

  // Smart Medicine Stock Predictor
  stockPredictions: StockPrediction[];
  adjustMedicineStock: (
    medicineId: string,
    newStock: number,
    reason: string,
    notes?: string
  ) => boolean;
  stockAdjustmentModalMedId: string | null;
  openStockAdjustmentModal: (medicineId: string) => void;
  closeStockAdjustmentModal: () => void;

  // পরিবারের যত্নকারী (Caregiver Mode)
  patientCaregiverLinks: CaregiverLinkDoc[];
  caringForLinks: CaregiverLinkDoc[];
  caregiverAlerts: FamilyAlertDoc[];
  failedCaregiverAlerts: FamilyAlertDoc[];
  isCaregiverLoading: boolean;
  caregiverError: string | null;
  clearCaregiverError: () => void;
  refreshCaregiverLinks: () => Promise<void>;
  createCaregiverInvite: () => Promise<CaregiverLinkDoc | null>;
  redeemCaregiverInvite: (codeInput: string) => Promise<boolean>;
  removeCaregiverLink: (linkId: string) => Promise<void>;
  toggleCaregiverFullView: (linkId: string, allowFullView: boolean) => Promise<void>;
  toggleCaregiverSuggestions: (linkId: string, allowSuggestions: boolean) => Promise<void>;
  markFamilyAlertSeen: (alertId: string) => Promise<void>;
  retryFailedCaregiverAlerts: () => Promise<void>;
  dismissFailedCaregiverAlert: (alertId: string) => void;

  // যত্নকারীর ওষুধের প্রস্তাব (Caregiver Medicine Suggestions)
  pendingPatientSuggestions: CaregiverSuggestionDoc[];
  sentCaregiverSuggestions: CaregiverSuggestionDoc[];
  isLoadingSentSuggestions: boolean;
  sendCaregiverSuggestion: (
    link: CaregiverLinkDoc,
    input: CaregiverSuggestionFormInput
  ) => Promise<CaregiverSuggestionDoc | null>;
  loadCaregiverSentSuggestions: () => Promise<void>;
  acceptCaregiverSuggestion: (
    suggestion: CaregiverSuggestionDoc,
    edited?: Partial<CaregiverSuggestedMedicinePayload> & { assignedPatientId?: string }
  ) => Promise<boolean>;
  rejectCaregiverSuggestion: (suggestionId: string) => Promise<boolean>;
  cancelCaregiverSuggestion: (suggestionId: string) => Promise<boolean>;
}


const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MEDICINES: 'shasthobondhu_medicines_v2',
  LOGS: 'shasthobondhu_logs_v2',
  PATIENTS: 'shasthobondhu_patients_v2',
  SETTINGS: 'shasthobondhu_settings_v2',
  ACTIVE_PATIENT: 'shasthobondhu_active_patient_v2',
  GLOBAL_MEDS: 'shasthobondhu_global_meds_v2',
  GLOBAL_LAST_SYNC: 'shasthobondhu_global_last_sync_v1',
  IMPORT_BATCHES: 'shasthobondhu_import_batches_v2',
  HEALTH_RECORDS: 'shasthobondhu_health_records_v2',
  APPOINTMENTS: 'shasthobondhu_appointments_v2',
};

export const MedicineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const needsDemoCleanupOnBoot =
    typeof window !== 'undefined' && localStorage.getItem(DEMO_CLEANUP_FLAG) !== 'true';

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEDICINES);
      const parsed: Medicine[] = saved ? JSON.parse(saved) : initialMedicines;
      return needsDemoCleanupOnBoot ? filterOutDemoRecords(parsed, 'medicines') : parsed;
    } catch {
      return initialMedicines;
    }
  });

  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      const parsed: DoseLog[] = saved ? JSON.parse(saved) : initialDoseLogs;
      return needsDemoCleanupOnBoot ? filterOutDemoRecords(parsed, 'doseLogs') : parsed;
    } catch {
      return initialDoseLogs;
    }
  });

  // Zero default patient profiles for new users
  const [patients, setPatients] = useState<PatientProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      const parsed: PatientProfile[] = saved ? JSON.parse(saved) : initialPatients;
      return needsDemoCleanupOnBoot ? filterOutDemoRecords(parsed, 'patients') : parsed;
    } catch {
      return initialPatients;
    }
  });

  const [activePatientId, setActivePatientId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT);
      if (!saved) return null;
      if (needsDemoCleanupOnBoot && isDemoRecordId(saved, 'patients')) return null;
      return saved;
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState<ReminderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const parsed: ReminderSettings = saved ? JSON.parse(saved) : initialSettings;
      return needsDemoCleanupOnBoot ? stripDemoEmergencyContact(parsed) : parsed;
    } catch {
      return initialSettings;
    }
  });

  // Global medicine catalog stored in IndexedDB (avoids localStorage 5MB limit)
  const [cloudGlobalMedicines, setCloudGlobalMedicines] = useState<GlobalMedicine[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.GLOBAL_MEDS);
      }
    } catch {
      // ignore storage cleanup errors
    }
    return [];
  });
  const [libraryVersion, setLibraryVersion] = useState<number>(0);
  const [pendingPublishMedicines, setPendingPublishMedicines] = useState<GlobalMedicine[]>([]);
  const [pendingPublishBatches, setPendingPublishBatches] = useState<ImportBatch[]>([]);
  const [pendingPublishLastRetryAttemptMs, setPendingPublishLastRetryAttemptMs] = useState<number | null>(null);
  const [isRetryingPendingPublish, setIsRetryingPendingPublish] = useState<boolean>(false);

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    try {
      return (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.GLOBAL_LAST_SYNC)) || '';
    } catch {
      return '';
    }
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isGlobalFromCache, setIsGlobalFromCache] = useState<boolean>(false);
  const [latestLibraryNotice, setLatestLibraryNotice] = useState<{
    count: number;
    message: string;
    timestamp: number;
  } | null>(null);
  const dismissLibraryNotice = () => setLatestLibraryNotice(null);

  const [cloudStats, setCloudStats] = useState<{ total: number; published: number; draft: number }>({
    total: 0,
    published: 0,
    draft: 0,
  });

  const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.IMPORT_BATCHES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Health records & Doctor appointments (ধাপ ১ ও ২)
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HEALTH_RECORDS);
      const parsed: HealthRecord[] = saved ? JSON.parse(saved) : initialHealthRecords;
      return needsDemoCleanupOnBoot ? filterOutDemoRecords(parsed, 'healthRecords') : parsed;
    } catch {
      return initialHealthRecords;
    }
  });

  const [appointments, setAppointments] = useState<DoctorAppointment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      const parsed: DoctorAppointment[] = saved ? JSON.parse(saved) : initialAppointments;
      return needsDemoCleanupOnBoot ? filterOutDemoRecords(parsed, 'appointments') : parsed;
    } catch {
      return initialAppointments;
    }
  });

  const [selectedGlobalMedForDetail, setSelectedGlobalMedForDetail] = useState<GlobalMedicine | null>(null);
  const [isAddToPersonalModalOpen, setIsAddToPersonalModalOpen] = useState(false);
  const [catalogMedToAddToPersonal, setCatalogMedToAddToPersonal] = useState<GlobalMedicine | null>(null);

  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [selectedMedicineIdForDetail, setSelectedMedicineIdForDetail] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientProfile | null>(null);

  // Admin Manual Medicine Add/Edit Modal state
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [editingGlobalMedicine, setEditingGlobalMedicine] = useState<GlobalMedicine | null>(null);
  const openManualAddModal = () => {
    setEditingGlobalMedicine(null);
    setIsManualAddModalOpen(true);
  };
  const openEditGlobalMedicineModal = (med: GlobalMedicine) => {
    setEditingGlobalMedicine(med);
    setIsManualAddModalOpen(true);
  };
  const closeManualAddModal = () => {
    setIsManualAddModalOpen(false);
    setEditingGlobalMedicine(null);
  };

  // Stock Adjustment Modal state
  const [stockAdjustmentModalMedId, setStockAdjustmentModalMedId] = useState<string | null>(null);
  const openStockAdjustmentModal = (medicineId: string) => setStockAdjustmentModalMedId(medicineId);
  const closeStockAdjustmentModal = () => setStockAdjustmentModalMedId(null);

  // Firebase Auth & Cloud state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'failed' | 'offline'>(
    (typeof navigator !== 'undefined' && !navigator.onLine) || isWriteQuotaPaused()
      ? 'offline'
      : 'synced'
  );
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(() => isWriteQuotaPaused());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingSyncPreview, setPendingSyncPreview] = useState<{
    totalWrites: number;
    breakdownLabels: string[];
  } | null>(null);
  const pendingSyncPlanRef = useRef<DirtySyncPlan | null>(null);

  // Migration Gate & Conflict Resolution State
  // Ensures listeners attach ONLY AFTER one-time demo cleanup & migration/conflict resolution completes (Req গ)
  const [demoCleanupReadyKey, setDemoCleanupReadyKey] = useState<string | null>(null);
  const [migrationReadyUid, setMigrationReadyUid] = useState<string | null>(null);
  const [pendingConflictSnapshot, setPendingConflictSnapshot] = useState<{
    medicines: Medicine[];
    patients: PatientProfile[];
    doseLogs: DoseLog[];
    settings: ReminderSettings;
    healthRecords: HealthRecord[];
    appointments: DoctorAppointment[];
  } | null>(null);
  const [isDataConflictModalOpen, setIsDataConflictModalOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    localMedicinesCount: number;
    localPatientsCount: number;
    cloudMedicinesCount: number;
    cloudPatientsCount: number;
  } | null>(null);

  // 2-Step Reset Confirmation Modal state
  const [isResetConfirmationModalOpen, setIsResetConfirmationModalOpen] = useState(false);
  const openResetConfirmationModal = () => setIsResetConfirmationModalOpen(true);
  const closeResetConfirmationModal = () => setIsResetConfirmationModalOpen(false);

  const isAdmin = isUserAdmin(currentUser?.email);

  // Caregiver Mode State (কোনো অপ্রয়োজনীয় লিসেনার বা পোলিং ছাড়া)
  const [patientCaregiverLinks, setPatientCaregiverLinks] = useState<CaregiverLinkDoc[]>([]);
  const [caringForLinks, setCaringForLinks] = useState<CaregiverLinkDoc[]>([]);
  const [caregiverAlerts, setCaregiverAlerts] = useState<FamilyAlertDoc[]>([]);
  const [failedCaregiverAlerts, setFailedCaregiverAlerts] = useState<FamilyAlertDoc[]>([]);
  const [isCaregiverLoading, setIsCaregiverLoading] = useState<boolean>(false);
  const [caregiverError, setCaregiverError] = useState<string | null>(null);
  const clearCaregiverError = () => setCaregiverError(null);
  const [pendingPatientSuggestions, setPendingPatientSuggestions] = useState<CaregiverSuggestionDoc[]>([]);
  const [sentCaregiverSuggestions, setSentCaregiverSuggestions] = useState<CaregiverSuggestionDoc[]>([]);
  const [isLoadingSentSuggestions, setIsLoadingSentSuggestions] = useState<boolean>(false);
  const lastSyncedLinkSigRef = useRef<Record<string, string>>({});
  const lastCaregiverRefreshAtRef = useRef<number>(0);
  const caregiverFailureNotifiedRef = useRef<boolean>(false);
  const playedAlertSoundIdsRef = useRef<Set<string>>(new Set());
  const playedSuggestionIdsRef = useRef<Set<string>>(new Set());
  const caregiverEvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy-load state & de-duplication refs for Firestore Read Optimization
  const [olderDoseLogsLoaded, setOlderDoseLogsLoaded] = useState(false);
  const [isLoadingOlderDoseLogs, setIsLoadingOlderDoseLogs] = useState(false);
  const [isLoadingHealthRecords, setIsLoadingHealthRecords] = useState(false);
  const [hasMoreOlderHealthRecords, setHasMoreOlderHealthRecords] = useState(false);
  const [pastAppointmentsLoaded, setPastAppointmentsLoaded] = useState(false);
  const [isLoadingPastAppointments, setIsLoadingPastAppointments] = useState(false);
  const olderDoseLogsInFlightRef = useRef(false);
  const healthRecordsInFlightRef = useRef(false);
  const pastAppointmentsInFlightRef = useRef(false);
  const allHealthRecordsLoadedUidRef = useRef<string | null>(null);

  // My Doctors Directory ("আমার ডাক্তার" — local cache first, zero real-time listener)
  const [doctors, setDoctors] = useState<DoctorProfile[]>(() =>
    sortDoctors(loadCachedDoctors(null))
  );
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const doctorsInFlightRef = useRef(false);
  const doctorsRef = useRef<DoctorProfile[]>(doctors);
  doctorsRef.current = doctors;

  // Prescriptions & Reports Vault (IndexedDB first, zero real-time listener)
  const [medicalDocuments, setMedicalDocuments] = useState<MedicalDocument[]>([]);
  const [isLoadingMedicalDocuments, setIsLoadingMedicalDocuments] = useState(false);
  const [pendingDocIds, setPendingDocIds] = useState<string[]>([]);
  const medicalDocumentsInFlightRef = useRef(false);
  const medicalDocumentsRef = useRef<MedicalDocument[]>(medicalDocuments);
  medicalDocumentsRef.current = medicalDocuments;
  const totalUsedDocumentPages = React.useMemo(
    () => countTotalUserPages(medicalDocuments),
    [medicalDocuments]
  );

  // Fresh refs for manual sync, async callbacks, and admin pending queue
  const medicinesRef = useRef<Medicine[]>(medicines);
  medicinesRef.current = medicines;
  const doseLogsRef = useRef<DoseLog[]>(doseLogs);
  doseLogsRef.current = doseLogs;
  const patientsRef = useRef<PatientProfile[]>(patients);
  patientsRef.current = patients;
  const settingsRef = useRef<ReminderSettings>(settings);
  settingsRef.current = settings;
  const healthRecordsRef = useRef<HealthRecord[]>(healthRecords);
  healthRecordsRef.current = healthRecords;
  const appointmentsRef = useRef<DoctorAppointment[]>(appointments);
  appointmentsRef.current = appointments;
  const pendingPublishMedicinesRef = useRef<GlobalMedicine[]>(pendingPublishMedicines);
  pendingPublishMedicinesRef.current = pendingPublishMedicines;
  const pendingPublishBatchesRef = useRef<ImportBatch[]>(pendingPublishBatches);
  pendingPublishBatchesRef.current = pendingPublishBatches;
  const pendingPublishLastRetryRef = useRef<number | null>(pendingPublishLastRetryAttemptMs);
  pendingPublishLastRetryRef.current = pendingPublishLastRetryAttemptMs;
  const retryPublishInFlightRef = useRef<boolean>(false);

  const globalMedicines = React.useMemo(
    () => mergePendingQueueForAdminDisplay(cloudGlobalMedicines, pendingPublishMedicines, isAdmin),
    [cloudGlobalMedicines, pendingPublishMedicines, isAdmin]
  );


  // Sync to local storage for resilience
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEDICINES, JSON.stringify(medicines));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [medicines]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(doseLogs));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [doseLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [settings]);

  // Apply Dark Mode and Listen to System Preferences
  useEffect(() => {
    const applyTheme = () => {
      const mode = settings.themeMode || 'system';
      const root = document.documentElement;
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      const isDark = mode === 'dark' || (mode === 'system' && isSystemDark);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', isDark ? '#0B1020' : '#4F46E5');
      }
    };

    applyTheme();

    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        if ((settings.themeMode || 'system') === 'system') {
          applyTheme();
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.themeMode]);

  // Apply Elderly Large Font Mode & Easy Mode to root document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.easyMode) {
      root.style.fontSize = '20px';
    } else if (settings.largeFontMode) {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '';
    }
  }, [settings.easyMode, settings.largeFontMode]);

  // Debounced auto-sync to native Android APK bridge (Requirement 3: 500ms debounce)
  useEffect(() => {
    if (!isNativeRemindersAvailable()) return;

    const timer = setTimeout(() => {
      syncNativeReminders(medicines, patients);
    }, 500);

    return () => clearTimeout(timer);
  }, [medicines, patients, currentUser]);

  useEffect(() => {
    try {
      if (activePatientId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT, activePatientId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PATIENT);
      }
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [activePatientId]);

  // Keep cloudStats derived directly in memory without reading Firestore
  useEffect(() => {
    let published = 0;
    let draft = 0;
    globalMedicines.forEach((m) => {
      if (m.status === 'published' && m.verifiedByAdmin) {
        published++;
      } else {
        draft++;
      }
    });
    setCloudStats({
      total: globalMedicines.length,
      published,
      draft,
    });
  }, [globalMedicines]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.IMPORT_BATCHES, JSON.stringify(importBatches));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [importBatches]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HEALTH_RECORDS, JSON.stringify(healthRecords));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [healthRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [appointments]);

  const globalCatalogBaselineRef = useRef<PublishedBaselineState>({
    hasInitialServerLoad: false,
    prevPublishedCount: null,
    skipNextListenerBaseline: false,
  });
  const localLibraryVersionRef = useRef<number>(0);
  const fetchingVersionRef = useRef<number | null>(null);
  const cloudGlobalMedicinesRef = useRef<GlobalMedicine[]>(cloudGlobalMedicines);
  cloudGlobalMedicinesRef.current = cloudGlobalMedicines;
  const globalMedicinesRef = useRef<GlobalMedicine[]>(globalMedicines);
  globalMedicinesRef.current = globalMedicines;
  const hasGlobalCatalogRef = useRef<boolean>(cloudGlobalMedicines.length > 0);
  hasGlobalCatalogRef.current = cloudGlobalMedicines.length > 0;
  const showToastRef = useRef<((message: string, type?: 'success' | 'info' | 'alert') => void) | null>(null);

  const applyQuotaUiStateOnce = () => {
    setIsQuotaExceeded(true);
    setSyncStatus('offline');
    setIsGlobalFromCache(true);
    if (consumeQuotaExceededNoticeOnce()) {
      showToastRef.current?.(QUOTA_EXCEEDED_BN_MSG, 'info');
    }
  };

  const notifyQuotaExceededOnce = () => {
    if (!isWriteQuotaPaused()) {
      markWriteQuotaExceeded();
    }
    applyQuotaUiStateOnce();
  };

  const getCurrentDirtySyncPlan = (
    uid: string,
    overrides?: {
      medicines?: Medicine[];
      patients?: PatientProfile[];
      doseLogs?: DoseLog[];
      healthRecords?: HealthRecord[];
      appointments?: DoctorAppointment[];
      doctors?: DoctorProfile[];
    }
  ): DirtySyncPlan => {
    const outbox = loadCloudSyncOutbox(uid);
    const docQueue = loadDocSyncQueue(uid);
    const lastSyncMs = getLastSuccessfulSyncMs(uid);
    return collectDirtySyncPlan(
      outbox,
      {
        medicines: overrides?.medicines ?? medicinesRef.current,
        patients: overrides?.patients ?? patientsRef.current,
        doseLogs: overrides?.doseLogs ?? doseLogsRef.current,
        healthRecords: overrides?.healthRecords ?? healthRecordsRef.current,
        appointments: overrides?.appointments ?? appointmentsRef.current,
        doctors: overrides?.doctors ?? doctorsRef.current,
      },
      docQueue,
      lastSyncMs
    );
  };

  const refreshPendingSyncCount = (uid: string | null | undefined) => {
    if (!uid) {
      setPendingSyncCount(0);
      setPendingDocIds([]);
      return;
    }
    const docQueue = loadDocSyncQueue(uid);
    const plan = getCurrentDirtySyncPlan(uid);
    setPendingDocIds(Array.from(getPendingDocIdSet(docQueue)));
    setPendingSyncCount(plan.totalWrites);
  };

  const queueUpsert = (uid: string, col: OutboxCollectionKey, idOrIds: string | string[]) => {
    markOutboxUpsert(uid, col, idOrIds);
    refreshPendingSyncCount(uid);
  };

  const queueDelete = (uid: string, col: OutboxCollectionKey, id: string) => {
    markOutboxDelete(uid, col, id);
    refreshPendingSyncCount(uid);
  };

  const queueSettings = (uid: string) => {
    markOutboxSettingsDirty(uid, true);
    refreshPendingSyncCount(uid);
  };

  const unqueueUpsert = (uid: string, col: OutboxCollectionKey, idOrIds: string | string[]) => {
    clearOutboxEntry(uid, 'upsert', col, idOrIds);
    refreshPendingSyncCount(uid);
  };

  const unqueueDelete = (uid: string, col: OutboxCollectionKey, id: string) => {
    clearOutboxEntry(uid, 'delete', col, id);
    refreshPendingSyncCount(uid);
  };

  const unqueueSettings = (uid: string) => {
    markOutboxSettingsDirty(uid, false);
    refreshPendingSyncCount(uid);
  };

  useEffect(() => {
    refreshPendingSyncCount(currentUser?.uid);
  }, [
    currentUser?.uid,
    medicines,
    doseLogs,
    patients,
    healthRecords,
    appointments,
    doctors,
    medicalDocuments,
  ]);

  useEffect(() => {
    return subscribeWriteQuotaExceeded(() => {
      applyQuotaUiStateOnce();
    });
  }, []);

  // Auto-clear quota UI state once Pacific midnight (BDT 2:00 PM) passes
  useEffect(() => {
    const checkQuotaReset = () => {
      if (isQuotaExceeded && !isWriteQuotaPaused()) {
        setIsQuotaExceeded(false);
        setIsGlobalFromCache(isDeviceOffline());
        resumeFirestoreNetwork().catch(() => {});
        setSyncStatus(isDeviceOffline() ? 'offline' : 'synced');
      }
    };
    const intervalId = setInterval(checkQuotaReset, 60_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', checkQuotaReset);
    }
    return () => {
      clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', checkQuotaReset);
      }
    };
  }, [isQuotaExceeded]);

  // Load IndexedDB cache FIRST, then attach a single-document listener to library_meta/current (1 read per check/update)
  useEffect(() => {
    let cancelled = false;
    let unsubMeta: (() => void) | null = null;
    let hasRecordedMetaRead = false;
    let lastRecordedMetaVersion: number | null = null;

    const initChunkedLibraryListener = async () => {
      const cachedCatalog = await loadLibraryFromIndexedDb();
      if (cancelled) return;

      if (cachedCatalog && cachedCatalog.medicines.length > 0) {
        localLibraryVersionRef.current = cachedCatalog.version;
        setLibraryVersion(cachedCatalog.version);
        setCloudGlobalMedicines(cachedCatalog.medicines);
        cloudGlobalMedicinesRef.current = cachedCatalog.medicines;
        hasGlobalCatalogRef.current = true;
        globalCatalogBaselineRef.current = {
          hasInitialServerLoad: false,
          prevPublishedCount: cachedCatalog.medicines.filter((m) => m.status === 'published').length,
          skipNextListenerBaseline: false,
        };
      }

      unsubMeta = onSnapshot(
        doc(db, 'library_meta', 'current'),
        { includeMetadataChanges: true },
        async (snapshot) => {
          if (cancelled) return;
          const fromCache = snapshot.metadata.fromCache;
          setIsGlobalFromCache(fromCache);
          const metaData = snapshot.exists() ? (snapshot.data() as LibraryMetaDoc) : null;
          if (!fromCache && (!hasRecordedMetaRead || (metaData && metaData.version !== lastRecordedMetaVersion))) {
            hasRecordedMetaRead = true;
            if (metaData && typeof metaData.version === 'number') {
              lastRecordedMetaVersion = metaData.version;
            }
            recordFirestoreRead('library_meta', 1);
          }

          if (!snapshot.exists()) {
            // Never clear cached IndexedDB library if server hasn't populated library_meta/current yet
            return;
          }

          const meta = metaData as LibraryMetaDoc;
          const needsFetch = shouldFetchChunksForMeta({
            meta,
            localVersion: localLibraryVersionRef.current,
            hasLocalCatalog: cloudGlobalMedicinesRef.current.length > 0,
          });

          if (!needsFetch) {
            if (!fromCache && !isDeviceOffline()) {
              const timeStr = formatLibrarySyncTime();
              setLastSyncTime(timeStr);
              try {
                localStorage.setItem(STORAGE_KEYS.GLOBAL_LAST_SYNC, timeStr);
              } catch {
                // ignore storage write failure
              }
              setIsCloudConnected(true);
              if (!globalCatalogBaselineRef.current.hasInitialServerLoad) {
                globalCatalogBaselineRef.current = {
                  hasInitialServerLoad: true,
                  prevPublishedCount: cloudGlobalMedicinesRef.current.filter((m) => m.status === 'published').length,
                  skipNextListenerBaseline: false,
                };
              }
            }
            return;
          }

          if (fetchingVersionRef.current === meta.version) {
            return;
          }
          fetchingVersionRef.current = meta.version;

          try {
            const fetchedItems = await fetchLibraryChunksByVersion(meta.version);
            if (cancelled) return;

            const evaluation = evaluateGlobalCatalogSnapshot({
              medicines: fetchedItems,
              fromCache,
              empty: fetchedItems.length === 0,
              hasExistingCatalog: hasGlobalCatalogRef.current,
              state: globalCatalogBaselineRef.current,
            });
            globalCatalogBaselineRef.current = evaluation.nextState;

            if (!evaluation.shouldApplyList) {
              return;
            }

            localLibraryVersionRef.current = meta.version;
            setLibraryVersion(meta.version);
            setCloudGlobalMedicines(fetchedItems);
            cloudGlobalMedicinesRef.current = fetchedItems;

            await saveLibraryToIndexedDb({
              version: meta.version,
              totalCount: meta.totalCount || fetchedItems.length,
              updatedAt: meta.updatedAt || new Date().toISOString(),
              medicines: fetchedItems,
            });

            if (!isDeviceOffline()) {
              const timeStr = formatLibrarySyncTime();
              setLastSyncTime(timeStr);
              try {
                localStorage.setItem(STORAGE_KEYS.GLOBAL_LAST_SYNC, timeStr);
              } catch {
                // ignore storage write failure
              }
              setIsCloudConnected(true);
            }

            if (evaluation.newlyAddedPublishedCount > 0) {
              const noticeMessage = `লাইব্রেরিতে ${evaluation.newlyAddedPublishedCount} টি নতুন ওষুধ যোগ হয়েছে`;
              showToastRef.current?.(noticeMessage, 'success');
              setLatestLibraryNotice({
                count: evaluation.newlyAddedPublishedCount,
                message: noticeMessage,
                timestamp: Date.now(),
              });
            }
          } catch (fetchErr: any) {
            if (isQuotaExceededError(fetchErr)) {
              notifyQuotaExceededOnce();
            } else {
              console.warn('fetchLibraryChunksByVersion failed:', fetchErr?.message || fetchErr);
              if (isDeviceOffline()) {
                setIsGlobalFromCache(true);
              }
            }
          } finally {
            if (fetchingVersionRef.current === meta.version) {
              fetchingVersionRef.current = null;
            }
          }
        },
        (error) => {
          if (isQuotaExceededError(error)) {
            notifyQuotaExceededOnce();
          } else {
            if (isDeviceOffline()) {
              setIsGlobalFromCache(true);
            }
            console.warn('library_meta snapshot notice:', error.message);
          }
        }
      );
    };

    initChunkedLibraryListener();

    return () => {
      cancelled = true;
      if (unsubMeta) unsubMeta();
    };
  }, []);

  const refreshCloudCounts = async () => {
    try {
      const meta = await fetchLibraryMetaFromCloud();
      if (meta && meta.version > localLibraryVersionRef.current && meta.chunkCount > 0) {
        const fetchedItems = await fetchLibraryChunksByVersion(meta.version);
        localLibraryVersionRef.current = meta.version;
        setLibraryVersion(meta.version);
        setCloudGlobalMedicines(fetchedItems);
        cloudGlobalMedicinesRef.current = fetchedItems;
        await saveLibraryToIndexedDb({
          version: meta.version,
          totalCount: meta.totalCount || fetchedItems.length,
          updatedAt: meta.updatedAt || new Date().toISOString(),
          medicines: fetchedItems,
        });
      }
      if (!isDeviceOffline()) {
        const timeStr = formatLibrarySyncTime();
        setLastSyncTime(timeStr);
        try {
          localStorage.setItem(STORAGE_KEYS.GLOBAL_LAST_SYNC, timeStr);
        } catch (e) {
          console.warn('Sync time storage error', e);
        }
      }
    } catch (e) {
      if (isQuotaExceededError(e)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('refreshCloudCounts error:', e);
      }
    }
  };

  // Real-time Firestore Listener for Import Batches (Strictly Admin only)
  useEffect(() => {
    if (!isAdmin) {
      setImportBatches([]);
      return;
    }
    let hasRecordedInitialBatches = false;
    const unsubBatches = onSnapshot(
      collection(db, 'import_batches'),
      (snapshot) => {
        if (!snapshot.metadata.fromCache) {
          if (!hasRecordedInitialBatches) {
            hasRecordedInitialBatches = true;
            recordFirestoreRead('import_batches', Math.max(1, snapshot.size));
          } else {
            const changed = snapshot.docChanges().length;
            if (changed > 0) recordFirestoreRead('import_batches', changed);
          }
        }
        const list: ImportBatch[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as ImportBatch);
        });
        setImportBatches(list);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        console.warn('Import batches snapshot notice:', error.message);
      }
    );

    return () => unsubBatches();
  }, [isAdmin]);


  const isDeviceOffline = (): boolean => typeof navigator !== 'undefined' && !navigator.onLine;

  // Test Firestore connectivity on boot & track browser online/offline transitions
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsOnline(true);
      setIsCloudConnected(true);
      setSyncStatus(currentUser ? 'syncing' : 'synced');
      if (currentUser && !isWriteQuotaPaused()) {
        void flushPendingDocumentSyncOps(currentUser.uid).catch(() => {});
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsCloudConnected(false);
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  // Firebase Auth State Listener (Requirement 1 & 11)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        showToast(`স্বাগতম, ${user.displayName || user.email?.split('@')[0] || 'ব্যবহারকারী'}!`, 'success');
      } else {
        setDemoCleanupReadyKey(null);
        setMigrationReadyUid(null);
        setPendingConflictSnapshot(null);
        setIsDataConflictModalOpen(false);
        setConflictInfo(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateLiveSyncTime = (hasPendingWrites: boolean) => {
    if (isDeviceOffline() || isWriteQuotaPaused()) {
      setSyncStatus('offline');
    } else {
      setSyncStatus(hasPendingWrites ? 'syncing' : 'synced');
    }
    if (!hasPendingWrites && !isDeviceOffline() && !isWriteQuotaPaused()) {
      if (currentUser?.uid) {
        setLastSuccessfulSyncMs(currentUser.uid, Date.now());
      }
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLastSyncedAt(timeStr);
    }
  };

  // One-time demo/fictional data cleanup for both local storage and logged-in user's own Firestore subcollections
  useEffect(() => {
    if (isAuthLoading) return;

    const uid = currentUser?.uid || null;
    const sessionKey = uid || 'guest';
    let cancelled = false;

    const runOneTimeDemoCleanup = async () => {
      const localCleaned =
        typeof window !== 'undefined' && localStorage.getItem(DEMO_CLEANUP_FLAG) === 'true';
      const cloudCleanupKey = uid ? `shasthobondhu_demo_cloud_cleaned_${uid}` : null;
      const cloudCleaned = cloudCleanupKey
        ? typeof window !== 'undefined' && localStorage.getItem(cloudCleanupKey) === 'true'
        : true;

      if (!localCleaned) {
        const cleaned = cleanDemoDataSnapshot({
          patients,
          medicines,
          doseLogs,
          healthRecords,
          appointments,
          settings,
        });

        if (cleaned.removedCount > 0) {
          setPatients(cleaned.patients);
          setMedicines(cleaned.medicines);
          setDoseLogs(cleaned.doseLogs);
          setHealthRecords(cleaned.healthRecords);
          setAppointments(cleaned.appointments);
        }
        if (cleaned.settings !== settings) {
          setSettings(cleaned.settings);
        }
        if (activePatientId && isDemoRecordId(activePatientId, 'patients')) {
          setActivePatientId(null);
        }

        try {
          localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(cleaned.patients));
          localStorage.setItem(STORAGE_KEYS.MEDICINES, JSON.stringify(cleaned.medicines));
          localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(cleaned.doseLogs));
          localStorage.setItem(STORAGE_KEYS.HEALTH_RECORDS, JSON.stringify(cleaned.healthRecords));
          localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(cleaned.appointments));
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cleaned.settings));
          if (activePatientId && isDemoRecordId(activePatientId, 'patients')) {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_PATIENT);
          }
        } catch (e) {
          console.warn('Local demo cleanup storage write error:', e);
        }
      }

      let cloudSuccess = true;
      if (uid && (!localCleaned || !cloudCleaned)) {
        const res = await cleanupDemoRecordsFromCloud(uid);
        cloudSuccess = res.completed;
        if (cloudSuccess && cloudCleanupKey) {
          try {
            localStorage.setItem(cloudCleanupKey, 'true');
          } catch (e) {
            console.warn('Cloud demo cleanup flag write error:', e);
          }
        }
      }

      if (!localCleaned && (!uid || cloudSuccess)) {
        try {
          localStorage.setItem(DEMO_CLEANUP_FLAG, 'true');
        } catch (e) {
          console.warn('Demo cleanup flag write error:', e);
        }
      }

      if (!cancelled) {
        setDemoCleanupReadyKey(sessionKey);
      }
    };

    runOneTimeDemoCleanup();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, currentUser]);

  // One-time local data migration check on login (Requirements গ & ছ)
  // Runs ONLY AFTER demo cleanup AND BEFORE starting onSnapshot listeners so pre-login phone data is never silently wiped
  useEffect(() => {
    if (!currentUser || demoCleanupReadyKey !== currentUser.uid) return;

    const uid = currentUser.uid;
    const migrationKey = `shasthobondhu_migrated_${uid}`;
    if (typeof window !== 'undefined' && localStorage.getItem(migrationKey) === 'true') {
      setMigrationReadyUid(uid);
      return;
    }

    let cancelled = false;

    const checkMigrationOnLogin = async () => {
      const cleanSnapshot = cleanDemoDataSnapshot({
        medicines,
        patients,
        doseLogs,
        settings,
        healthRecords,
        appointments,
      });

      const localSnapshot = {
        medicines: cleanSnapshot.medicines,
        patients: cleanSnapshot.patients,
        doseLogs: cleanSnapshot.doseLogs,
        settings: cleanSnapshot.settings,
        healthRecords: cleanSnapshot.healthRecords,
        appointments: cleanSnapshot.appointments,
      };

      const hasUserCreatedLocalData =
        localSnapshot.patients.length > 0 ||
        localSnapshot.medicines.length > 0 ||
        localSnapshot.doseLogs.length > 0 ||
        localSnapshot.healthRecords.length > 0 ||
        localSnapshot.appointments.length > 0;

      if (!hasUserCreatedLocalData) {
        try {
          localStorage.setItem(migrationKey, 'true');
        } catch (e) {
          console.warn('Migration flag write error:', e);
        }
        if (!cancelled) setMigrationReadyUid(uid);
        return;
      }

      if (isWriteQuotaPaused()) {
        if (!cancelled) {
          setIsQuotaExceeded(true);
          setSyncStatus('offline');
          setMigrationReadyUid(uid);
        }
        return;
      }

      try {
        setIsSyncing(true);
        setSyncStatus(isDeviceOffline() ? 'offline' : 'syncing');
        const cloudData = await checkUserHasCloudData(uid);
        if (cancelled) return;

        if (cloudData.hasData) {
          // Cloud already has data; mark migration done once and prompt only if phone has unmigrated local data
          setPendingConflictSnapshot(localSnapshot);
          setConflictInfo({
            localMedicinesCount: localSnapshot.medicines.length,
            localPatientsCount: localSnapshot.patients.length,
            cloudMedicinesCount: cloudData.medicinesCount,
            cloudPatientsCount: cloudData.patientsCount,
          });
          setIsDataConflictModalOpen(true);
        } else {
          // Cloud is completely empty: upload local phone data ONCE, THEN allow listeners
          const res = await migrateLocalDataToCloud(
            uid,
            localSnapshot.medicines,
            localSnapshot.patients,
            localSnapshot.doseLogs,
            localSnapshot.settings,
            localSnapshot.healthRecords,
            localSnapshot.appointments
          );
          if (cancelled) return;
          try {
            localStorage.setItem(migrationKey, 'true');
            setLastSuccessfulSyncMs(uid, Date.now());
            clearCloudSyncOutbox(uid);
            markCollectionSynced(uid, 'medicines');
            markCollectionSynced(uid, 'patients');
            markCollectionSynced(uid, 'settings');
            markCollectionSynced(uid, 'upcomingAppointments');
            markCollectionSynced(uid, 'healthRecords');
          } catch (e) {
            console.warn('Migration flag write error:', e);
          }
          refreshPendingSyncCount(uid);
          updateLiveSyncTime(false);
          setMigrationReadyUid(uid);
          showToast(
            `ফোনের ডেটা ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে (${res.medicinesCount}টি ওষুধ ও ${res.patientsCount}টি প্রোফাইল)`,
            'success'
          );
        }
      } catch (err) {
        if (!cancelled) {
          if (isQuotaExceededError(err)) {
            notifyQuotaExceededOnce();
            setMigrationReadyUid(uid);
          } else {
            setSyncStatus('failed');
            showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
          }
        }
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    checkMigrationOnLogin();

    return () => {
      cancelled = true;
    };
  }, [currentUser, demoCleanupReadyKey]);

  // Shared TTL-gated cloud fetch for core collections (medicines, patients, settings, upcoming appointments).
  // Replaces 5 full-collection onSnapshot listeners so reopening the app does not re-read unchanged docs.
  const syncCoreCollectionsFromCloud = async (userId: string, forceRefresh = false) => {
    if (!userId || isDeviceOffline() || isFirestoreNetworkDisabled()) return;
    const nowMs = Date.now();
    const yesterdayIso = getAppointmentsRecentCutoffDate(1);
    const tasks: Promise<void>[] = [];
    let didFetchAny = false;

    if (shouldFetchCollectionFromCloud(userId, 'medicines', COLLECTION_SYNC_TTL_MS, nowMs, forceRefresh)) {
      didFetchAny = true;
      tasks.push(
        fetchUserCollectionFromCloud<Medicine>(userId, 'medicines').then((cloudMeds) => {
          setMedicines(cloudMeds);
          markCollectionSynced(userId, 'medicines', nowMs);
        })
      );
    }

    if (shouldFetchCollectionFromCloud(userId, 'patients', COLLECTION_SYNC_TTL_MS, nowMs, forceRefresh)) {
      didFetchAny = true;
      tasks.push(
        fetchUserCollectionFromCloud<PatientProfile>(userId, 'patients').then((cloudPatients) => {
          setPatients(cloudPatients);
          if (cloudPatients.length > 0) {
            setActivePatientId((prevActive) =>
              prevActive && cloudPatients.some((p) => p.id === prevActive)
                ? prevActive
                : cloudPatients[0].id
            );
          } else {
            setActivePatientId(null);
          }
          markCollectionSynced(userId, 'patients', nowMs);
        })
      );
    }

    if (shouldFetchCollectionFromCloud(userId, 'settings', COLLECTION_SYNC_TTL_MS, nowMs, forceRefresh)) {
      didFetchAny = true;
      tasks.push(
        fetchUserSettingsFromCloud(userId).then((cloudSettings) => {
          if (cloudSettings) {
            setSettings((prev) => ({ ...prev, ...cloudSettings }));
          }
          markCollectionSynced(userId, 'settings', nowMs);
        })
      );
    }

    if (
      shouldFetchCollectionFromCloud(
        userId,
        'upcomingAppointments',
        RECORDS_SYNC_TTL_MS,
        nowMs,
        forceRefresh
      )
    ) {
      didFetchAny = true;
      tasks.push(
        fetchUpcomingAppointmentsFromCloud(userId, yesterdayIso).then((upcomingApts) => {
          setAppointments((prev) => mergeUpcomingAppointments(prev, upcomingApts, yesterdayIso));
          markCollectionSynced(userId, 'upcomingAppointments', nowMs);
        })
      );
    }

    if (!didFetchAny) return;

    try {
      await Promise.all(tasks);
      updateLiveSyncTime(false);
    } catch (error: any) {
      if (isQuotaExceededError(error)) {
        notifyQuotaExceededOnce();
        return;
      }
      setSyncStatus('failed');
      console.warn(`Cloud sync notice (users/${userId}):`, error?.message || error);
    }
  };

  // Bounded 45-day real-time doseLogs listener + TTL-gated core boot sync.
  // healthRecords (0 boot reads), past appointments (0 boot reads), and >45-day doseLogs (0 boot reads)
  // are loaded lazily on demand and cached in localStorage.
  useEffect(() => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) {
      setOlderDoseLogsLoaded(false);
      setPastAppointmentsLoaded(false);
      setHasMoreOlderHealthRecords(false);
      allHealthRecordsLoadedUidRef.current = null;
      if (!currentUser) {
        setDoctors(sortDoctors(loadCachedDoctors(null)));
      }
      return;
    }

    const userId = currentUser.uid;
    let cancelled = false;

    // Prevent stale local cache from another Firebase UID if the user switched accounts
    try {
      const prevCloudUid = localStorage.getItem('shasthobondhu_last_cloud_uid');
      if (prevCloudUid && prevCloudUid !== userId) {
        invalidateCollectionSyncMeta(userId);
        setDoseLogs([]);
        setHealthRecords([]);
        setAppointments([]);
        setDoctors([]);
        setMedicalDocuments([]);
        setPendingDocIds([]);
      }
      localStorage.setItem('shasthobondhu_last_cloud_uid', userId);
    } catch {
      // ignore storage errors
    }

    // Hydrate doctors immediately from phone cache (0 Firestore reads)
    const cachedDoctors = loadCachedDoctors(userId);
    if (cachedDoctors.length > 0) {
      setDoctors(sortDoctors(cachedDoctors));
    }

    // Hydrate documents metadata immediately from IndexedDB (0 Firestore reads)
    loadDocumentsMetaFromIdb(userId).then((cachedDocs) => {
      if (cancelled) return;
      if (cachedDocs.length > 0) {
        setMedicalDocuments(sortMedicalDocumentsNewestFirst(cachedDocs));
      }
      refreshPendingSyncCount(userId);
    });

    const cutoff45Days = getDoseLogsCutoffDate(DOSE_LOG_REALTIME_DAYS);
    const yesterdayIso = getAppointmentsRecentCutoffDate(1);

    // Hydrate locally cached >45-day doseLogs & past appointments with 0 Firestore reads if valid
    const cachedOlderLogs = loadCachedOlderDoseLogs(userId, cutoff45Days);
    if (cachedOlderLogs.hit) {
      setDoseLogs((prev) =>
        replaceOlderDoseLogsKeepingRecent(prev, cachedOlderLogs.logs, cutoff45Days)
      );
      setOlderDoseLogsLoaded(true);
    } else {
      setOlderDoseLogsLoaded(false);
    }

    const cachedPastApts = loadCachedPastAppointments(userId, yesterdayIso);
    if (cachedPastApts.hit) {
      setAppointments((prev) =>
        replacePastAppointmentsKeepingUpcoming(prev, cachedPastApts.appointments, yesterdayIso)
      );
      setPastAppointmentsLoaded(true);
    } else {
      setPastAppointmentsLoaded(false);
    }

    // TTL-gated initial sync for medicines, patients, settings (single-doc), & upcoming appointments
    syncCoreCollectionsFromCloud(userId, false);

    // Single real-time listener: doseLogs strictly limited to last 45 days (single-field index)
    const logPath = `users/${userId}/doseLogs`;
    const logsQuery = query(
      collection(db, 'users', userId, 'doseLogs'),
      where('scheduledDate', '>=', cutoff45Days)
    );
    let hasRecordedInitialLogs = false;
    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        if (cancelled) return;
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        if (!snapshot.metadata.fromCache) {
          if (!hasRecordedInitialLogs) {
            hasRecordedInitialLogs = true;
            recordFirestoreRead('doseLogs', Math.max(1, snapshot.size));
          } else {
            const changed = snapshot.docChanges().length;
            if (changed > 0) recordFirestoreRead('doseLogs', changed);
          }
        }
        const recentCloudLogs: DoseLog[] = [];
        snapshot.forEach((docSnap) => {
          recentCloudLogs.push(docSnap.data() as DoseLog);
        });
        setDoseLogs((prev) => mergeDoseLogsWithWindow(prev, recentCloudLogs, cutoff45Days));
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${logPath}):`, error.message);
      }
    );

    return () => {
      cancelled = true;
      unsubLogs();
    };
  }, [currentUser, migrationReadyUid]);

  // Lazy-load doseLogs older than 45 days when user inspects full history, doctor report, or older pillbox weeks
  const loadOlderDoseLogs = async (forceRefresh = false): Promise<void> => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) return;
    if (!forceRefresh && olderDoseLogsLoaded) return;
    if (olderDoseLogsInFlightRef.current) return;

    const uid = currentUser.uid;
    const cutoff45Days = getDoseLogsCutoffDate(DOSE_LOG_REALTIME_DAYS);

    if (!forceRefresh) {
      const cached = loadCachedOlderDoseLogs(uid, cutoff45Days);
      if (cached.hit) {
        setDoseLogs((prev) => replaceOlderDoseLogsKeepingRecent(prev, cached.logs, cutoff45Days));
        setOlderDoseLogsLoaded(true);
        return;
      }
    }

    if (isDeviceOffline() || isFirestoreNetworkDisabled()) return;

    olderDoseLogsInFlightRef.current = true;
    setIsLoadingOlderDoseLogs(true);
    try {
      const olderLogs = await fetchOlderDoseLogsFromCloud(uid, cutoff45Days);
      saveCachedOlderDoseLogs(uid, cutoff45Days, olderLogs);
      setDoseLogs((prev) => replaceOlderDoseLogsKeepingRecent(prev, olderLogs, cutoff45Days));
      setOlderDoseLogsLoaded(true);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadOlderDoseLogs notice:', err);
      }
    } finally {
      olderDoseLogsInFlightRef.current = false;
      setIsLoadingOlderDoseLogs(false);
    }
  };

  // Lazy-load healthRecords only when user opens Health Records, Share Report, or Doctor Report
  const loadHealthRecords = async (
    options: { loadAll?: boolean; forceRefresh?: boolean } = {}
  ): Promise<void> => {
    const { loadAll = false, forceRefresh = false } = options;
    if (!currentUser || migrationReadyUid !== currentUser.uid) return;
    if (healthRecordsInFlightRef.current) return;

    const uid = currentUser.uid;
    if (!loadAll && !forceRefresh && !shouldFetchCollectionFromCloud(uid, 'healthRecords', RECORDS_SYNC_TTL_MS)) {
      return;
    }
    if (loadAll && !forceRefresh && allHealthRecordsLoadedUidRef.current === uid) {
      return;
    }
    if (isDeviceOffline() || isFirestoreNetworkDisabled()) return;

    healthRecordsInFlightRef.current = true;
    setIsLoadingHealthRecords(true);
    try {
      if (loadAll) {
        const allRecords = await fetchUserCollectionFromCloud<HealthRecord>(uid, 'healthRecords');
        setHealthRecords(allRecords);
        setHasMoreOlderHealthRecords(false);
        allHealthRecordsLoadedUidRef.current = uid;
        markCollectionSynced(uid, 'healthRecords');
      } else {
        const res = await fetchRecentHealthRecordsFromCloud(uid, HEALTH_RECORDS_INITIAL_LIMIT);
        setHealthRecords(res.records);
        setHasMoreOlderHealthRecords(res.hasMore);
        if (!res.hasMore) {
          allHealthRecordsLoadedUidRef.current = uid;
        }
        markCollectionSynced(uid, 'healthRecords');
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadHealthRecords notice:', err);
      }
    } finally {
      healthRecordsInFlightRef.current = false;
      setIsLoadingHealthRecords(false);
    }
  };

  // Lazy-load past appointments (< yesterday) only when visiting Appointments or Share Report
  const loadPastAppointments = async (forceRefresh = false): Promise<void> => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) return;
    if (!forceRefresh && pastAppointmentsLoaded) return;
    if (pastAppointmentsInFlightRef.current) return;

    const uid = currentUser.uid;
    const yesterdayIso = getAppointmentsRecentCutoffDate(1);

    if (!forceRefresh) {
      const cached = loadCachedPastAppointments(uid, yesterdayIso);
      if (cached.hit) {
        setAppointments((prev) =>
          replacePastAppointmentsKeepingUpcoming(prev, cached.appointments, yesterdayIso)
        );
        setPastAppointmentsLoaded(true);
        return;
      }
    }

    if (isDeviceOffline() || isFirestoreNetworkDisabled()) return;

    pastAppointmentsInFlightRef.current = true;
    setIsLoadingPastAppointments(true);
    try {
      const pastApts = await fetchPastAppointmentsFromCloud(uid, yesterdayIso);
      saveCachedPastAppointments(uid, yesterdayIso, pastApts);
      setAppointments((prev) =>
        replacePastAppointmentsKeepingUpcoming(prev, pastApts, yesterdayIso)
      );
      setPastAppointmentsLoaded(true);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadPastAppointments notice:', err);
      }
    } finally {
      pastAppointmentsInFlightRef.current = false;
      setIsLoadingPastAppointments(false);
    }
  };

  // Lazy-load doctors once from cache / cloud (max once every 6 hours, ZERO real-time listener)
  const loadDoctors = async (forceRefresh = false): Promise<void> => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) {
      setDoctors(sortDoctors(loadCachedDoctors(null)));
      return;
    }

    const uid = currentUser.uid;
    const cached = loadCachedDoctors(uid);
    if (cached.length > 0 && doctorsRef.current.length === 0) {
      setDoctors(sortDoctors(cached));
    }

    if (doctorsInFlightRef.current) return;
    if (!shouldFetchCollectionFromCloud(uid, 'doctors', RECORDS_SYNC_TTL_MS, Date.now(), forceRefresh)) {
      return;
    }
    if (isDeviceOffline() || isFirestoreNetworkDisabled()) return;

    doctorsInFlightRef.current = true;
    setIsLoadingDoctors(true);
    try {
      const cloudDoctors = await fetchUserDoctorsFromCloud(uid);
      const localBaseline = cached.length > 0 ? cached : doctorsRef.current;
      const { merged } = mergeLocalAndCloudDoctors(localBaseline, cloudDoctors);
      setDoctors(merged);
      saveCachedDoctors(uid, merged);
      markCollectionSynced(uid, 'doctors');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadDoctors notice:', err);
      }
    } finally {
      doctorsInFlightRef.current = false;
      setIsLoadingDoctors(false);
    }
  };

  // Lazy-load medical documents (IndexedDB first, cloud max once every 6 hours, ZERO real-time listener)
  const loadMedicalDocuments = async (forceRefresh = false): Promise<void> => {
    const storeUid = currentUser?.uid || 'guest_local';
    if (medicalDocumentsRef.current.length === 0) {
      const localDocs = await loadDocumentsMetaFromIdb(storeUid);
      if (localDocs.length > 0) {
        setMedicalDocuments(sortMedicalDocumentsNewestFirst(localDocs));
      }
    }

    if (!currentUser || migrationReadyUid !== currentUser.uid) {
      return;
    }

    const uid = currentUser.uid;
    refreshPendingSyncCount(uid);

    if (medicalDocumentsInFlightRef.current) return;
    if (!shouldFetchCollectionFromCloud(uid, 'documents', RECORDS_SYNC_TTL_MS, Date.now(), forceRefresh)) {
      return;
    }
    if (isDeviceOffline() || isFirestoreNetworkDisabled()) return;

    medicalDocumentsInFlightRef.current = true;
    setIsLoadingMedicalDocuments(true);
    try {
      const cloudDocs = await fetchUserDocumentsMetaFromCloud(uid);
      const queue = loadDocSyncQueue(uid);
      const pendingUpsertSet = new Set(queue.upsertDocIds);
      const pendingDeleteSet = new Set(queue.deleteDocIds);

      const localById = new Map(medicalDocumentsRef.current.map((d) => [d.id, d]));
      const mergedMap = new Map<string, MedicalDocument>();

      for (const cd of cloudDocs) {
        if (pendingDeleteSet.has(cd.id)) continue;
        if (pendingUpsertSet.has(cd.id) && localById.has(cd.id)) {
          mergedMap.set(cd.id, localById.get(cd.id)!);
        } else {
          mergedMap.set(cd.id, cd);
        }
      }

      for (const localDoc of medicalDocumentsRef.current) {
        if (pendingUpsertSet.has(localDoc.id) && !mergedMap.has(localDoc.id)) {
          mergedMap.set(localDoc.id, localDoc);
        }
      }

      const sorted = sortMedicalDocumentsNewestFirst(Array.from(mergedMap.values()));
      setMedicalDocuments(sorted);
      await saveDocumentsMetaToIdb(uid, sorted);
      markCollectionSynced(uid, 'documents');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadMedicalDocuments notice:', err);
      }
    } finally {
      medicalDocumentsInFlightRef.current = false;
      setIsLoadingMedicalDocuments(false);
    }
  };

  // Flush offline / quota-paused prescription & report files & metadata to Firestore
  const flushPendingDocumentSyncOps = async (uid: string): Promise<number> => {
    if (!uid || isDeviceOffline() || isWriteQuotaPaused() || isFirestoreNetworkDisabled()) {
      return 0;
    }
    let syncedCount = 0;
    let queue = loadDocSyncQueue(uid);
    if (countPendingDocSyncOps(queue) === 0) return 0;

    // 1. Upload queued full-size files first
    for (const fileEntry of [...queue.uploadFiles]) {
      const cachedFile = await getDocumentFileFromIdb(uid, fileEntry.fileId);
      if (!cachedFile) {
        queue = markFileUploadedInQueue(uid, fileEntry.fileId);
        continue;
      }
      await createDocumentFileInCloud(uid, {
        id: cachedFile.id,
        docId: cachedFile.docId,
        data: cachedFile.data,
        bytes: cachedFile.bytes,
      });
      queue = markFileUploadedInQueue(uid, fileEntry.fileId);
      syncedCount += 1;
    }

    // 2. Delete removed file docs
    for (const delFileId of [...queue.deleteFileIds]) {
      await deleteDocumentFileFromCloud(uid, delFileId);
      queue = markFileDeletedInQueue(uid, delFileId);
      syncedCount += 1;
    }

    // 3. Upsert metadata docs whose files are now all uploaded
    const remainingPendingUploadDocIds = new Set(queue.uploadFiles.map((f) => f.docId));
    const currentDocsMap = new Map(medicalDocumentsRef.current.map((d) => [d.id, d]));
    for (const docId of [...queue.upsertDocIds]) {
      if (remainingPendingUploadDocIds.has(docId)) continue;
      const targetDoc = currentDocsMap.get(docId);
      if (!targetDoc) {
        queue = markDocUpsertSyncedInQueue(uid, docId);
        continue;
      }
      await updateDocumentMetaInCloud(uid, docId, {
        id: targetDoc.id,
        kind: targetDoc.kind,
        patientId: targetDoc.patientId,
        doctorId: targetDoc.doctorId,
        title: targetDoc.title,
        date: targetDoc.date,
        note: targetDoc.note,
        reportType: targetDoc.reportType,
        pages: targetDoc.pages,
      });
      queue = markDocUpsertSyncedInQueue(uid, docId);
      syncedCount += 1;
    }

    // 4. Delete queued metadata docs
    for (const delDocId of [...queue.deleteDocIds]) {
      await deleteDocumentMetaFromCloud(uid, delDocId);
      queue = markDocDeleteSyncedInQueue(uid, delDocId);
      syncedCount += 1;
    }

    refreshPendingSyncCount(uid);
    return syncedCount;
  };

  const showToast = (message: string, type: 'success' | 'info' | 'alert' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3500);
  };
  showToastRef.current = showToast;

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const openCreateProfileModal = () => {
    setEditingPatient(null);
    setIsProfileModalOpen(true);
  };

  const openEditProfileModal = (patient: PatientProfile) => {
    setEditingPatient(patient);
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
    setEditingPatient(null);
  };

  const signOutUser = async () => {
    const prevUid = currentUser?.uid;
    clearAllNativeReminders();
    await logOut();
    if (prevUid) {
      clearUserReadOptimizerCaches(prevUid);
      clearCachedDoctors(prevUid);
      void clearUserDocumentsIdb(prevUid);
      clearDocSyncQueue(prevUid);
    }
    try {
      localStorage.removeItem('shasthobondhu_last_cloud_uid');
    } catch {
      // ignore storage errors
    }
    setDoctors(sortDoctors(loadCachedDoctors(null)));
    setMedicalDocuments([]);
    setPendingDocIds([]);
    setOlderDoseLogsLoaded(false);
    setPastAppointmentsLoaded(false);
    setHasMoreOlderHealthRecords(false);
    allHealthRecordsLoadedUidRef.current = null;
    setDemoCleanupReadyKey(null);
    setMigrationReadyUid(null);
    setPendingConflictSnapshot(null);
    setIsDataConflictModalOpen(false);
    setConflictInfo(null);
    setActivePatientId(null);
    setSyncStatus(isDeviceOffline() ? 'offline' : 'synced');
    showToast('অ্যাকাউন্ট থেকে সফলভাবে লগআউট হয়েছে', 'info');
  };

  const downloadLocalBackup = () => {
    const source = pendingConflictSnapshot || {
      patients,
      medicines,
      doseLogs,
      settings,
      healthRecords,
      appointments,
    };
    const data = {
      ...source,
      exportDate: new Date().toISOString(),
      appName: 'স্বাস্থ্যবন্ধু (Shasthobondhu)',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shasthobondhu-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('সকল ওষুধ ও প্রোফাইল ব্যাকআপ ডাউনলোড সম্পন্ন হয়েছে', 'success');
  };

  const resolveDataConflict = async (action: 'merge' | 'discard') => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const migrationKey = `shasthobondhu_migrated_${uid}`;
    const source = pendingConflictSnapshot || {
      medicines,
      patients,
      doseLogs,
      settings,
      healthRecords,
      appointments,
    };
    setIsSyncing(true);
    setSyncStatus(isDeviceOffline() ? 'offline' : 'syncing');
    try {
      if (action === 'merge') {
        const res = await migrateLocalDataToCloud(
          uid,
          source.medicines,
          source.patients,
          source.doseLogs,
          source.settings,
          source.healthRecords,
          source.appointments
        );
        localStorage.setItem(migrationKey, 'true');
        setLastSuccessfulSyncMs(uid, Date.now());
        clearCloudSyncOutbox(uid);
        invalidateCollectionSyncMeta(uid);
        refreshPendingSyncCount(uid);
        updateLiveSyncTime(false);
        showToast(`ফোনের আগের ডেটা ক্লাউডে সফলভাবে যোগ (Merge) হয়েছে (${res.medicinesCount}টি ওষুধ)`, 'success');
      } else {
        localStorage.setItem(migrationKey, 'true');
        setLastSuccessfulSyncMs(uid, Date.now());
        clearCloudSyncOutbox(uid);
        clearUserReadOptimizerCaches(uid);
        setDoseLogs([]);
        setHealthRecords([]);
        setAppointments([]);
        refreshPendingSyncCount(uid);
        showToast('ফোনের স্থানীয় ডেটা বাদ দেওয়া হয়েছে, ক্লাউড থেকে লোড হচ্ছে...', 'info');
      }
      setPendingConflictSnapshot(null);
      setIsDataConflictModalOpen(false);
      setConflictInfo(null);
      setMigrationReadyUid(uid);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        setSyncStatus('failed');
        showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerManualSync = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    const uid = currentUser.uid;

    // Quota exhausted state: keep disabled / never attempt writes before reset
    if (isWriteQuotaPaused()) {
      notifyQuotaExceededOnce();
      showToast('আজকের সীমা শেষ, দুপুর ২টার পর চেষ্টা করুন', 'alert');
      return;
    }
    if (isQuotaExceeded) {
      setIsQuotaExceeded(false);
      resumeFirestoreNetwork().catch(() => {});
    }

    if (isDeviceOffline()) {
      showToast('অফলাইন আছেন — ইন্টারনেট চালু হলে আবার চেষ্টা করুন', 'info');
      return;
    }

    const plan = getCurrentDirtySyncPlan(uid);
    if (plan.totalWrites === 0) {
      // Zero changed/unsynced records -> perform ZERO Firestore reads or writes
      setLastSuccessfulSyncMs(uid, Date.now());
      updateLiveSyncTime(false);
      showToast('সব সিঙ্ক আছে', 'success');
      return;
    }

    pendingSyncPlanRef.current = plan;
    setPendingSyncPreview({
      totalWrites: plan.totalWrites,
      breakdownLabels: plan.breakdownLabels,
    });
  };

  const cancelManualSync = () => {
    pendingSyncPlanRef.current = null;
    setPendingSyncPreview(null);
  };

  const confirmManualSync = async () => {
    if (!currentUser) {
      cancelManualSync();
      return;
    }
    if (isWriteQuotaPaused()) {
      cancelManualSync();
      notifyQuotaExceededOnce();
      showToast('আজকের সীমা শেষ, দুপুর ২টার পর চেষ্টা করুন', 'alert');
      return;
    }
    if (isDeviceOffline()) {
      cancelManualSync();
      showToast('অফলাইন আছেন — ইন্টারনেট চালু হলে আবার চেষ্টা করুন', 'info');
      return;
    }

    const uid = currentUser.uid;
    const plan = getCurrentDirtySyncPlan(uid);
    pendingSyncPlanRef.current = null;
    setPendingSyncPreview(null);

    if (plan.totalWrites === 0) {
      showToast('সব সিঙ্ক আছে', 'success');
      return;
    }

    try {
      await resumeFirestoreNetwork();
      setIsSyncing(true);
      setSyncStatus('syncing');

      let syncedOpsCount = 0;

      // Flush ONLY modified/unsynced records — NEVER call migrateLocalDataToCloud here
      const flushRes = await flushOutboxToCloud(uid, plan.outboxToFlush, {
        medicines: medicinesRef.current,
        patients: patientsRef.current,
        doseLogs: doseLogsRef.current,
        settings: settingsRef.current,
        healthRecords: healthRecordsRef.current,
        appointments: appointmentsRef.current,
        doctors: doctorsRef.current,
      });
      syncedOpsCount += flushRes.syncedOpsCount;

      if (plan.docOpsCount > 0) {
        const docVaultOps = await flushPendingDocumentSyncOps(uid);
        syncedOpsCount += docVaultOps;
      }

      clearCloudSyncOutbox(uid);
      setLastSuccessfulSyncMs(uid, Date.now());
      refreshPendingSyncCount(uid);
      setIsQuotaExceeded(false);
      setMigrationReadyUid(uid);
      updateLiveSyncTime(false);

      showToast(
        syncedOpsCount > 0
          ? `ক্লাউড সিঙ্ক সফল! ${toBengaliNumber(syncedOpsCount)}টি পরিবর্তন সিঙ্ক হয়েছে`
          : 'সব সিঙ্ক আছে',
        'success'
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
        showToast('আজকের সীমা শেষ, দুপুর ২টার পর চেষ্টা করুন', 'alert');
      } else {
        setSyncStatus('failed');
        showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const syncLocalToCloud = triggerManualSync;

  const activePatient: PatientProfile | null =
    (activePatientId ? patients.find((p) => p.id === activePatientId) : null) ||
    (patients.filter((p) => !p.isArchived).length > 0 ? patients.filter((p) => !p.isArchived)[0] : (patients.length > 0 ? patients[0] : null));

  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    const prevSettings = settings;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueSettings(uid);
        notifyQuotaExceededOnce();
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueSettings(uid);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('সেটিংস অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveSettingsToCloud(uid, updated)
        .then(() => {
          unqueueSettings(uid);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('সেটিংস ক্লাউডে হালনাগাদ করা হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueSettings(uid);
            notifyQuotaExceededOnce();
            return;
          }
          setSettings(prevSettings);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('সেটিংস সফলভাবে হালনাগাদ করা হয়েছে', 'success');
    }
  };

  // Smart Medicine Stock Predictor - Computed Predictions for active patient medicines
  const stockPredictions = React.useMemo(() => {
    return predictAllMedicinesStock(medicines, activePatientId);
  }, [medicines, activePatientId]);

  // Automated non-spamming stock alert checking (Requirement 4)
  useEffect(() => {
    if (!medicines.length) return;
    const newAlerts = getNewEligibleAlerts(stockPredictions);
    if (newAlerts.length > 0) {
      const highest = newAlerts[0];
      const message =
        highest.status === 'out_of_stock'
          ? `স্টক সতর্কতা: "${highest.brandName}" এর স্টক সম্পূর্ণ শেষ!`
          : highest.status === 'urgent'
          ? `জরুরি স্টক সতর্কতা: "${highest.brandName}" আর মাত্র ${toBengaliNumber(highest.daysRemaining)} দিন চলবে!`
          : `স্বল্প স্টক সতর্কতা: "${highest.brandName}" আর ${toBengaliNumber(highest.daysRemaining)} দিন চলবে`;

      showToast(message, highest.status === 'out_of_stock' ? 'alert' : 'info');
      markStockAlertSent(highest.medicineId, highest.status);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('স্বাস্থ্যবন্ধু স্টক অ্যালার্ট', {
            body: `${highest.brandName}: ${highest.adviceBn}`,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.warn('Native notification not allowed or restricted by sandbox:', e);
        }
      }
    }
  }, [stockPredictions]);

  const markDose = (
    medicineId: string,
    timeSlot: TimeSlot,
    scheduledTime: string,
    status: 'taken' | 'skipped',
    notes?: string
  ) => {
    const todayStr = '2026-11-02';
    const med = medicines.find((m) => m.id === medicineId);
    const schedule = med?.schedules.find((s) => s.timeSlot === timeSlot);
    const dosage = schedule?.dosage || '১টি';

    const existingIndex = doseLogs.findIndex(
      (l) =>
        l.medicineId === medicineId &&
        l.scheduledDate === todayStr &&
        l.timeSlot === timeSlot
    );

    const prevLog = existingIndex >= 0 ? doseLogs[existingIndex] : null;
    const prevStatus = prevLog ? prevLog.status : null;
    const unitsToUse = parseDosageUnits(schedule?.dosage);

    const prevLogs = doseLogs;
    const prevMeds = medicines;

    const nowMs = Date.now();
    const newLog: DoseLog = {
      id: `log-${nowMs}`,
      medicineId,
      medicineName: med?.brandName || 'ওষুধ',
      genericName: med?.genericName,
      patientId: med?.assignedPatientId || activePatient?.id || undefined,
      scheduledDate: todayStr,
      scheduledTime,
      timeSlot,
      dosage,
      status,
      loggedAt: new Date().toISOString(),
      updatedAtMs: nowMs,
      notes,
    };

    if (existingIndex >= 0) {
      const updated = [...doseLogs];
      updated[existingIndex] = newLog;
      setDoseLogs(updated);
    } else {
      setDoseLogs([newLog, ...doseLogs]);
    }

    let updatedMed: Medicine | undefined;
    let feedbackMsg = '';
    let feedbackType: 'success' | 'info' = 'success';

    if (med) {
      if (status === 'taken' && prevStatus !== 'taken') {
        const nextStock = Math.max(0, med.stock - unitsToUse);
        updatedMed = {
          ...med,
          stock: nextStock,
          lastStockUpdated: new Date().toISOString(),
          updatedAtMs: nowMs,
        };
        setMedicines((prev) =>
          prev.map((item) => (item.id === medicineId ? (updatedMed as Medicine) : item))
        );
        if (settings.soundEnabled) {
          playAlertTone(settings.selectedTone);
        }
        feedbackMsg = `${med.brandName} গ্রহণ সম্পন্ন (${toBengaliNumber(unitsToUse)} ${med.unit} স্টক কমেছে)`;
        feedbackType = 'success';
      } else if (status === 'taken' && prevStatus === 'taken') {
        feedbackMsg = `${med.brandName} ইতিমধ্যে গ্রহণ করা হয়েছে (স্টক অপরিবর্তিত)`;
        feedbackType = 'info';
      } else if (status === 'skipped' && prevStatus === 'taken') {
        const nextStock = med.stock + unitsToUse;
        updatedMed = {
          ...med,
          stock: nextStock,
          lastStockUpdated: new Date().toISOString(),
          updatedAtMs: nowMs,
        };
        setMedicines((prev) =>
          prev.map((item) => (item.id === medicineId ? (updatedMed as Medicine) : item))
        );
        feedbackMsg = `${med.brandName} গ্রহণ বাদ দেওয়া হয়েছে (${toBengaliNumber(unitsToUse)} ${med.unit} স্টকে ফেরত যোগ হয়েছে)`;
        feedbackType = 'info';
      } else if (status === 'skipped') {
        feedbackMsg = `${med.brandName} গ্রহণ বাদ দেওয়া হয়েছে (স্টক অপরিবর্তিত)`;
        feedbackType = 'info';
      }
    }

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'doseLogs', newLog.id);
        if (updatedMed) queueUpsert(uid, 'medicines', updatedMed.id);
        notifyQuotaExceededOnce();
        if (feedbackMsg) showToast(`${feedbackMsg} (ফোনে সংরক্ষিত)`, feedbackType);
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) {
        queueUpsert(uid, 'doseLogs', newLog.id);
        if (updatedMed) queueUpsert(uid, 'medicines', updatedMed.id);
      }
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline && feedbackMsg) {
        showToast(`${feedbackMsg} (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }

      const writePromises: Promise<void>[] = [saveDoseLogToCloud(uid, newLog)];
      if (updatedMed) {
        writePromises.push(saveMedicineToCloud(uid, updatedMed));
      }

      Promise.all(writePromises)
        .then(() => {
          unqueueUpsert(uid, 'doseLogs', newLog.id);
          if (updatedMed) unqueueUpsert(uid, 'medicines', updatedMed.id);
          updateLiveSyncTime(false);
          if (!wasOffline && feedbackMsg) {
            showToast(feedbackMsg, feedbackType);
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'doseLogs', newLog.id);
            if (updatedMed) queueUpsert(uid, 'medicines', updatedMed.id);
            notifyQuotaExceededOnce();
            return;
          }
          setDoseLogs(prevLogs);
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else if (feedbackMsg) {
      showToast(feedbackMsg, feedbackType);
    }
  };

  const addMedicine = (medicineData: Omit<Medicine, 'id'>): string => {
    const nowMs = Date.now();
    const newId = `med-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
    const newMedicine: Medicine = stripUndefined({
      ...medicineData,
      id: newId,
      updatedAtMs: nowMs,
    });
    setMedicines((prev) => [newMedicine, ...prev]);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'medicines', newId);
        notifyQuotaExceededOnce();
        showToast(`"${newMedicine.brandName}" ফোনে সংরক্ষিত হয়েছে`, 'info');
        return newId;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'medicines', newId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${newMedicine.brandName}" অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveMedicineToCloud(uid, newMedicine)
        .then(() => {
          unqueueUpsert(uid, 'medicines', newId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${newMedicine.brandName}" ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'medicines', newId);
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines((prev) => prev.filter((m) => m.id !== newId));
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${newMedicine.brandName}" সফলভাবে তালিকায় যুক্ত হয়েছে`, 'success');
    }

    return newId;
  };

  const addMultipleMedicines = async (
    medicinesList: Array<Omit<Medicine, 'id'>>
  ): Promise<string[]> => {
    if (!medicinesList || medicinesList.length === 0) return [];
    const baseTs = Date.now();
    const newMeds: Medicine[] = medicinesList.map((medData, idx) =>
      stripUndefined({
        ...medData,
        id: `med-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        updatedAtMs: baseTs,
      })
    );
    const addedIds = newMeds.map((m) => m.id);
    const addedIdSet = new Set(addedIds);

    setMedicines((prev) => [...newMeds, ...prev]);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'medicines', addedIds);
        notifyQuotaExceededOnce();
        showToast(`${toBengaliNumber(newMeds.length)}টি ওষুধ ফোনে সংরক্ষিত হয়েছে`, 'info');
        return addedIds;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'medicines', addedIds);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      try {
        await Promise.all(newMeds.map((med) => saveMedicineToCloud(uid, med)));
        unqueueUpsert(uid, 'medicines', addedIds);
        updateLiveSyncTime(false);
        showToast(
          wasOffline
            ? `${toBengaliNumber(newMeds.length)}টি ওষুধ অফলাইনে সংরক্ষিত হয়েছে`
            : `${toBengaliNumber(newMeds.length)}টি ওষুধ যোগ হয়েছে`,
          wasOffline ? 'info' : 'success'
        );
      } catch (err) {
        if (isQuotaExceededError(err)) {
          queueUpsert(uid, 'medicines', addedIds);
          notifyQuotaExceededOnce();
          return addedIds;
        }
        setMedicines((prev) => prev.filter((m) => !addedIdSet.has(m.id)));
        setSyncStatus('failed');
        showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        throw err;
      }
    } else {
      showToast(`${toBengaliNumber(newMeds.length)}টি ওষুধ যোগ হয়েছে`, 'success');
    }

    return addedIds;
  };

  const updateMedicine = (id: string, updates: Partial<Medicine>) => {
    const prevMeds = medicines;
    const target = medicines.find((m) => m.id === id);
    if (!target) return;
    const updatedObj: Medicine = stripUndefined({
      ...target,
      ...updates,
      updatedAtMs: Date.now(),
    });
    setMedicines((prev) => prev.map((m) => (m.id === id ? updatedObj : m)));

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'medicines', id);
        notifyQuotaExceededOnce();
        showToast('ওষুধের তথ্য ফোনে হালনাগাদ হয়েছে', 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'medicines', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('ওষুধের তথ্য অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveMedicineToCloud(uid, updatedObj)
        .then(() => {
          unqueueUpsert(uid, 'medicines', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('ওষুধের তথ্য ক্লাউডে হালনাগাদ হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'medicines', id);
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('ওষুধের তথ্য সফলভাবে হালনাগাদ করা হয়েছে', 'success');
    }
  };

  const deleteMedicine = (id: string) => {
    const prevMeds = medicines;
    const med = medicines.find((m) => m.id === id);
    setMedicines((prev) => prev.filter((m) => m.id !== id));

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueDelete(uid, 'medicines', id);
        notifyQuotaExceededOnce();
        showToast(`"${med?.brandName || 'ওষুধ'}" ফোন থেকে সরানো হয়েছে`, 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueDelete(uid, 'medicines', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${med?.brandName || 'ওষুধ'}" অফলাইনে সরানো হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      deleteMedicineFromCloud(uid, id)
        .then(() => {
          unqueueDelete(uid, 'medicines', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${med?.brandName || 'ওষুধ'}" ক্লাউড থেকে সরানো হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueDelete(uid, 'medicines', id);
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${med?.brandName || 'ওষুধ'}" সরানো হয়েছে`, 'info');
    }
  };

  /**
   * Manually corrects medicine stock with recorded audit reason and timestamp (Requirement 1)
   */
  const adjustMedicineStock = (
    medicineId: string,
    newStock: number,
    reason: string,
    notes?: string
  ): boolean => {
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return false;

    const prevMeds = medicines;
    const previousStock = med.stock;
    const sanitizedStock = Math.max(0, Number(newStock) || 0);

    const adjustmentRecord: StockAdjustment = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      previousStock,
      newStock: sanitizedStock,
      reason: reason || 'ম্যানুয়াল স্টক সংশোধন',
      timestamp: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    };

    const nowMs = Date.now();
    const updatedMed: Medicine = {
      ...med,
      stock: sanitizedStock,
      lastStockUpdated: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
      stockAdjustments: [adjustmentRecord, ...(med.stockAdjustments || [])],
    };

    setMedicines((prev) =>
      prev.map((m) => (m.id === medicineId ? updatedMed : m))
    );

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'medicines', medicineId);
        notifyQuotaExceededOnce();
        showToast(`"${med.brandName}" এর স্টক ${toBengaliNumber(sanitizedStock)} ${med.unit} এ ফোনে হালনাগাদ হয়েছে`, 'info');
        return true;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'medicines', medicineId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${med.brandName}" স্টক অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveMedicineToCloud(uid, updatedMed)
        .then(() => {
          unqueueUpsert(uid, 'medicines', medicineId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${med.brandName}" এর স্টক ${toBengaliNumber(sanitizedStock)} ${med.unit} এ ক্লাউডে হালনাগাদ করা হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'medicines', medicineId);
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${med.brandName}" এর স্টক ${toBengaliNumber(sanitizedStock)} ${med.unit} এ হালনাগাদ করা হয়েছে`, 'success');
    }

    return true;
  };

  /**
   * Delta adjustment helper for quick buttons, preserving reason logging
   */
  const adjustStock = (id: string, delta: number) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return;
    const next = Math.max(0, med.stock + delta);
    const reason = delta > 0 ? `রিফিল (+${delta} ${med.unit})` : `স্টক হ্রাস (${delta} ${med.unit})`;
    adjustMedicineStock(id, next, reason);
  };

  const assignMedicineToPatient = (medicineId: string, patientId?: string) => {
    const prevMeds = medicines;
    const target = medicines.find((m) => m.id === medicineId);
    if (!target) return;
    const updatedMed: Medicine = {
      ...target,
      assignedPatientId: patientId || undefined,
      updatedAtMs: Date.now(),
    };
    setMedicines((prev) => prev.map((m) => (m.id === medicineId ? updatedMed : m)));

    const patient = patients.find((p) => p.id === patientId);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'medicines', medicineId);
        notifyQuotaExceededOnce();
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'medicines', medicineId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('বরাদ্দ অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveMedicineToCloud(uid, updatedMed)
        .then(() => {
          unqueueUpsert(uid, 'medicines', medicineId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            if (patient) {
              showToast(`ওষুধটি "${patient.name}" এর প্রোফাইলে ক্লাউডে বরাদ্দ করা হয়েছে`, 'success');
            } else {
              showToast('ওষুধটি সাধারণ তালিকায় ক্লাউডে রাখা হয়েছে', 'info');
            }
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'medicines', medicineId);
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      if (patient) {
        showToast(`ওষুধটি "${patient.name}" এর প্রোফাইলে বরাদ্দ করা হয়েছে`, 'success');
      } else {
        showToast('ওষুধটি যেকোনো রোগীর সাধারণ তালিকায় রাখা হয়েছে', 'info');
      }
    }
  };

  // Unlimited Patient Profiles (Requirements 4 & 5)
  const addPatient = (patientData: Omit<PatientProfile, 'id'>) => {
    const nowMs = Date.now();
    const newId = `patient-${nowMs}`;
    const newPatient: PatientProfile = { ...patientData, id: newId, updatedAtMs: nowMs };
    const prevPatients = patients;
    const prevActive = activePatientId;
    setPatients((prev) => [...prev, newPatient]);
    setActivePatientId(newId);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'patients', newId);
        notifyQuotaExceededOnce();
        showToast(`"${newPatient.name}" প্রোফাইল ফোনে তৈরি হয়েছে`, 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'patients', newId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${newPatient.name}" প্রোফাইল অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(uid, newPatient)
        .then(() => {
          unqueueUpsert(uid, 'patients', newId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${newPatient.name}" এর প্রোফাইল ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'patients', newId);
            notifyQuotaExceededOnce();
            return;
          }
          setPatients(prevPatients);
          setActivePatientId(prevActive);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${newPatient.name}" এর প্রোফাইল সফলভাবে তৈরি হয়েছে`, 'success');
    }
  };

  const updatePatient = (id: string, updates: Partial<PatientProfile>) => {
    const prevPatients = patients;
    const target = patients.find((p) => p.id === id);
    if (!target) return;
    const targetPatient: PatientProfile = { ...target, ...updates, updatedAtMs: Date.now() };
    setPatients((prev) => prev.map((p) => (p.id === id ? targetPatient : p)));

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'patients', id);
        notifyQuotaExceededOnce();
        showToast('প্রোফাইলের তথ্য ফোনে সংরক্ষিত হয়েছে', 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'patients', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('প্রোফাইল অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      savePatientToCloud(uid, targetPatient)
        .then(() => {
          unqueueUpsert(uid, 'patients', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('প্রোফাইলের তথ্য ক্লাউডে সংরক্ষিত হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'patients', id);
            notifyQuotaExceededOnce();
            return;
          }
          setPatients(prevPatients);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('প্রোফাইলের তথ্য সংরক্ষিত হয়েছে', 'success');
    }
  };

  const deletePatient = (id: string) => {
    const prevPatients = patients;
    const prevMeds = medicines;
    const prevActive = activePatientId;
    const target = patients.find((p) => p.id === id);
    setPatients((prev) => prev.filter((p) => p.id !== id));

    if (activePatientId === id) {
      const remaining = patients.filter((p) => p.id !== id);
      setActivePatientId(remaining.length > 0 ? remaining[0].id : null);
    }

    const nowMs = Date.now();
    const unassignedMeds: Medicine[] = [];
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.assignedPatientId === id) {
          const updated = { ...m, assignedPatientId: undefined, updatedAtMs: nowMs };
          unassignedMeds.push(updated);
          return updated;
        }
        return m;
      })
    );

    if (currentUser) {
      const uid = currentUser.uid;
      const unassignedIds = unassignedMeds.map((m) => m.id);
      if (isWriteQuotaPaused()) {
        queueDelete(uid, 'patients', id);
        if (unassignedIds.length) queueUpsert(uid, 'medicines', unassignedIds);
        notifyQuotaExceededOnce();
        showToast(`"${target?.name || 'প্রোফাইল'}" ফোন থেকে সরানো হয়েছে`, 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) {
        queueDelete(uid, 'patients', id);
        if (unassignedIds.length) queueUpsert(uid, 'medicines', unassignedIds);
      }
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target?.name || 'প্রোফাইল'}" অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      Promise.all([
        deletePatientFromCloud(uid, id),
        ...unassignedMeds.map((m) => saveMedicineToCloud(uid, m)),
      ])
        .then(() => {
          unqueueDelete(uid, 'patients', id);
          if (unassignedIds.length) unqueueUpsert(uid, 'medicines', unassignedIds);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target?.name || 'প্রোফাইল'}" ক্লাউড থেকে মুছে ফেলা হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueDelete(uid, 'patients', id);
            if (unassignedIds.length) queueUpsert(uid, 'medicines', unassignedIds);
            notifyQuotaExceededOnce();
            return;
          }
          setPatients(prevPatients);
          setMedicines(prevMeds);
          setActivePatientId(prevActive);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${target?.name || 'প্রোফাইল'}" সফলভাবে মুছে ফেলা হয়েছে`, 'info');
    }
  };

  const archivePatient = (id: string) => {
    const target = patients.find((p) => p.id === id);
    if (!target) return;
    const prevPatients = patients;
    const prevActive = activePatientId;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const updated: PatientProfile = {
      ...target,
      isArchived: true,
      archivedAt: nowIso,
      updatedAtMs: nowMs,
    };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));

    if (activePatientId === id) {
      const remainingActive = patients.filter((p) => p.id !== id && !p.isArchived);
      setActivePatientId(remainingActive.length > 0 ? remainingActive[0].id : null);
    }

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'patients', id);
        notifyQuotaExceededOnce();
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'patients', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target.name}" অফলাইনে আর্কাইভ হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(uid, updated)
        .then(() => {
          unqueueUpsert(uid, 'patients', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target.name}" এর প্রোফাইল ক্লাউডে আর্কাইভ করা হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'patients', id);
            notifyQuotaExceededOnce();
            return;
          }
          setPatients(prevPatients);
          setActivePatientId(prevActive);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${target.name}" এর প্রোফাইল সফলভাবে আর্কাইভ করা হয়েছে (ইতিহাস ও ডেটা অক্ষত আছে)`, 'info');
    }
  };

  const unarchivePatient = (id: string) => {
    const target = patients.find((p) => p.id === id);
    if (!target) return;
    const prevPatients = patients;
    const prevActive = activePatientId;
    const updated: PatientProfile = {
      ...target,
      isArchived: false,
      archivedAt: undefined,
      updatedAtMs: Date.now(),
    };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setActivePatientId(id);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'patients', id);
        notifyQuotaExceededOnce();
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'patients', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target.name}" অফলাইনে পুনরায় সক্রিয় হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(uid, updated)
        .then(() => {
          unqueueUpsert(uid, 'patients', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target.name}" এর প্রোফাইল ক্লাউডে পুনরায় সক্রিয় করা হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'patients', id);
            notifyQuotaExceededOnce();
            return;
          }
          setPatients(prevPatients);
          setActivePatientId(prevActive);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${target.name}" এর প্রোফাইল পুনরায় সক্রিয় করা হয়েছে`, 'success');
    }
  };

  const confirmResetAllData = async (deleteFromCloud: boolean) => {
    if (deleteFromCloud && currentUser) {
      try {
        setSyncStatus(isDeviceOffline() ? 'offline' : 'syncing');
        await clearUserCloudData(currentUser.uid);
        clearCloudSyncOutbox(currentUser.uid);
        setPendingSyncCount(0);
        updateLiveSyncTime(false);
      } catch (err) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        } else {
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        }
        return;
      }
    } else if (currentUser) {
      clearCloudSyncOutbox(currentUser.uid);
      setPendingSyncCount(0);
    }
    setMedicines(initialMedicines);
    setDoseLogs(initialDoseLogs);
    setPatients(initialPatients);
    setActivePatientId(null);
    setSettings(initialSettings);
    setHealthRecords(initialHealthRecords);
    setAppointments(initialAppointments);
    setDoctors([]);
    setMedicalDocuments([]);
    setPendingDocIds([]);

    try {
      if (currentUser?.uid) {
        clearUserReadOptimizerCaches(currentUser.uid);
        clearCachedDoctors(currentUser.uid);
        void clearUserDocumentsIdb(currentUser.uid);
        clearDocSyncQueue(currentUser.uid);
      }
      clearCachedDoctors(null);
      void clearUserDocumentsIdb('guest_local');
      setOlderDoseLogsLoaded(false);
      setPastAppointmentsLoaded(false);
      setHasMoreOlderHealthRecords(false);
      allHealthRecordsLoadedUidRef.current = null;
      localStorage.removeItem(STORAGE_KEYS.MEDICINES);
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localStorage.removeItem(STORAGE_KEYS.PATIENTS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PATIENT);
      localStorage.removeItem(STORAGE_KEYS.HEALTH_RECORDS);
      localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    } catch (e) {
      console.warn('Storage clear notice', e);
    }

    showToast(
      deleteFromCloud && currentUser
        ? 'আপনার ক্লাউড ও স্থানীয় সমস্ত ব্যক্তিগত ডেটা সফলভাবে মুছে নতুন করে শুরু করা হয়েছে'
        : 'স্থানীয় সমস্ত ডেটা সফলভাবে রিসেট করা হয়েছে',
      'info'
    );
  };

  const resetAllData = () => {
    openResetConfirmationModal();
  };

  // Health Records CRUD (ধাপ ১)
  const addHealthRecord = (recordData: Omit<HealthRecord, 'id' | 'createdAt'>): string => {
    const nowMs = Date.now();
    const newId = `hr-${nowMs}`;
    const newRecord: HealthRecord = {
      ...recordData,
      id: newId,
      createdAt: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
    };
    const prevHR = healthRecords;
    setHealthRecords((prev) => [newRecord, ...prev]);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'healthRecords', newId);
        notifyQuotaExceededOnce();
        showToast('স্বাস্থ্য পরিমাপ রেকর্ড ফোনে সংরক্ষিত হয়েছে', 'info');
        return newId;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'healthRecords', newId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('স্বাস্থ্য পরিমাপ রেকর্ড অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveHealthRecordToCloud(uid, newRecord)
        .then(() => {
          unqueueUpsert(uid, 'healthRecords', newId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('স্বাস্থ্য পরিমাপ রেকর্ড ক্লাউডে সংরক্ষিত হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'healthRecords', newId);
            notifyQuotaExceededOnce();
            return;
          }
          setHealthRecords(prevHR);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('স্বাস্থ্য পরিমাপ রেকর্ড সফলভাবে সংরক্ষিত হয়েছে', 'success');
    }
    return newId;
  };

  const deleteHealthRecord = (id: string) => {
    const prevHR = healthRecords;
    setHealthRecords((prev) => prev.filter((r) => r.id !== id));
    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueDelete(uid, 'healthRecords', id);
        notifyQuotaExceededOnce();
        showToast('স্বাস্থ্য রেকর্ড ফোন থেকে মুছে ফেলা হয়েছে', 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueDelete(uid, 'healthRecords', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('স্বাস্থ্য রেকর্ড অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      deleteHealthRecordFromCloud(uid, id)
        .then(() => {
          unqueueDelete(uid, 'healthRecords', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('স্বাস্থ্য রেকর্ড ক্লাউড থেকে মুছে ফেলা হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueDelete(uid, 'healthRecords', id);
            notifyQuotaExceededOnce();
            return;
          }
          setHealthRecords(prevHR);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('স্বাস্থ্য রেকর্ড মুছে ফেলা হয়েছে', 'info');
    }
  };

  // Doctor Appointments CRUD (ধাপ ২)
  const addAppointment = (aptData: Omit<DoctorAppointment, 'id' | 'createdAt'>): string => {
    const nowMs = Date.now();
    const newId = `apt-${nowMs}`;
    const newApt: DoctorAppointment = {
      ...aptData,
      id: newId,
      createdAt: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
    };
    const prevApts = appointments;
    setAppointments((prev) => [newApt, ...prev]);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'appointments', newId);
        notifyQuotaExceededOnce();
        showToast(`ডা. ${newApt.doctorName}-এর অ্যাপয়েন্টমেন্ট ফোনে সংরক্ষিত হয়েছে`, 'info');
        return newId;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'appointments', newId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`ডা. ${newApt.doctorName}-এর অ্যাপয়েন্টমেন্ট অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveAppointmentToCloud(uid, newApt)
        .then(() => {
          unqueueUpsert(uid, 'appointments', newId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`ডা. ${newApt.doctorName}-এর অ্যাপয়েন্টমেন্ট ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'appointments', newId);
            notifyQuotaExceededOnce();
            return;
          }
          setAppointments(prevApts);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`ডা. ${newApt.doctorName}-এর সাথে অ্যাপয়েন্টমেন্ট নির্ধারিত হয়েছে`, 'success');
    }
    return newId;
  };

  const updateAppointment = (id: string, updates: Partial<DoctorAppointment>) => {
    const prevApts = appointments;
    const target = appointments.find((a) => a.id === id);
    if (!target) return;
    const updatedApt: DoctorAppointment = { ...target, ...updates, updatedAtMs: Date.now() };
    setAppointments((prev) => prev.map((a) => (a.id === id ? updatedApt : a)));

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'appointments', id);
        notifyQuotaExceededOnce();
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'appointments', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('অ্যাপয়েন্টমেন্ট তথ্য অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveAppointmentToCloud(uid, updatedApt)
        .then(() => {
          unqueueUpsert(uid, 'appointments', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('অ্যাপয়েন্টমেন্ট তথ্য ক্লাউডে হালনাগাদ হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'appointments', id);
            notifyQuotaExceededOnce();
            return;
          }
          setAppointments(prevApts);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('অ্যাপয়েন্টমেন্ট তথ্য হালনাগাদ করা হয়েছে', 'info');
    }
  };

  const deleteAppointment = (id: string) => {
    const prevApts = appointments;
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueDelete(uid, 'appointments', id);
        notifyQuotaExceededOnce();
        showToast('অ্যাপয়েন্টমেন্ট ফোন থেকে মুছে ফেলা হয়েছে', 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueDelete(uid, 'appointments', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('অ্যাপয়েন্টমেন্ট অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      deleteAppointmentFromCloud(uid, id)
        .then(() => {
          unqueueDelete(uid, 'appointments', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('অ্যাপয়েন্টমেন্ট ক্লাউড থেকে মুছে ফেলা হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueDelete(uid, 'appointments', id);
            notifyQuotaExceededOnce();
            return;
          }
          setAppointments(prevApts);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('অ্যাপয়েন্টমেন্ট মুছে ফেলা হয়েছে', 'info');
    }
  };

  // My Doctors CRUD ("আমার ডাক্তার" — optimistic local state + phone cache FIRST)
  const addDoctor = (doctorInput: DoctorProfileInput): DoctorProfile => {
    const clean = buildCleanDoctorInput(doctorInput);
    const nowIso = new Date().toISOString();
    const newId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDoctor: DoctorProfile = {
      id: newId,
      ...clean,
      isEmergency: Boolean(clean.isEmergency),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const prevDoctors = doctorsRef.current;
    const nextDoctors = sortDoctors([newDoctor, ...prevDoctors]);
    const cacheUid = currentUser?.uid || null;
    setDoctors(nextDoctors);
    saveCachedDoctors(cacheUid, nextDoctors);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'doctors', newId);
        notifyQuotaExceededOnce();
        showToast(`${newDoctor.name} ফোনে সংরক্ষিত হয়েছে`, 'info');
        return newDoctor;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'doctors', newId);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`${newDoctor.name} অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      createDoctorInCloud(uid, { ...clean, id: newId })
        .then(() => {
          unqueueUpsert(uid, 'doctors', newId);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`${newDoctor.name} তালিকায় যুক্ত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'doctors', newId);
            notifyQuotaExceededOnce();
            return;
          }
          setDoctors(prevDoctors);
          saveCachedDoctors(cacheUid, prevDoctors);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`${newDoctor.name} তালিকায় যুক্ত হয়েছে`, 'success');
    }

    return newDoctor;
  };

  const updateDoctor = (id: string, updates: DoctorProfileInput) => {
    const prevDoctors = doctorsRef.current;
    const existing = prevDoctors.find((d) => d.id === id);
    if (!existing) return;

    const clean = buildCleanDoctorInput(updates);
    const nowIso = new Date().toISOString();
    const updatedDoc: DoctorProfile = {
      id,
      ...clean,
      isEmergency: Boolean(clean.isEmergency),
      createdAt: existing.createdAt,
      updatedAt: nowIso,
    };

    const nextDoctors = sortDoctors(prevDoctors.map((d) => (d.id === id ? updatedDoc : d)));
    const cacheUid = currentUser?.uid || null;
    setDoctors(nextDoctors);
    saveCachedDoctors(cacheUid, nextDoctors);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueUpsert(uid, 'doctors', id);
        notifyQuotaExceededOnce();
        showToast(`${updatedDoc.name}-এর তথ্য ফোনে হালনাগাদ হয়েছে`, 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueUpsert(uid, 'doctors', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('ডাক্তারের তথ্য অফলাইনে হালনাগাদ হয়েছে', 'info');
      }
      updateDoctorInCloud(uid, id, clean)
        .then(() => {
          unqueueUpsert(uid, 'doctors', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`${updatedDoc.name}-এর তথ্য হালনাগাদ হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueUpsert(uid, 'doctors', id);
            notifyQuotaExceededOnce();
            return;
          }
          setDoctors(prevDoctors);
          saveCachedDoctors(cacheUid, prevDoctors);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`${updatedDoc.name}-এর তথ্য হালনাগাদ হয়েছে`, 'success');
    }
  };

  const deleteDoctor = (id: string) => {
    const prevDoctors = doctorsRef.current;
    const nextDoctors = prevDoctors.filter((d) => d.id !== id);
    const cacheUid = currentUser?.uid || null;
    setDoctors(nextDoctors);
    saveCachedDoctors(cacheUid, nextDoctors);

    if (currentUser) {
      const uid = currentUser.uid;
      if (isWriteQuotaPaused()) {
        queueDelete(uid, 'doctors', id);
        notifyQuotaExceededOnce();
        showToast('ডাক্তারের তথ্য ফোন থেকে মুছে ফেলা হয়েছে', 'info');
        return;
      }
      const wasOffline = isDeviceOffline();
      if (wasOffline) queueDelete(uid, 'doctors', id);
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('ডাক্তারের তথ্য অফলাইনে মুছে ফেলা হয়েছে', 'info');
      }
      deleteDoctorFromCloud(uid, id)
        .then(() => {
          unqueueDelete(uid, 'doctors', id);
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('ডাক্তারের তথ্য মুছে ফেলা হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            queueDelete(uid, 'doctors', id);
            notifyQuotaExceededOnce();
            return;
          }
          setDoctors(prevDoctors);
          saveCachedDoctors(cacheUid, prevDoctors);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast('ডাক্তারের তথ্য মুছে ফেলা হয়েছে', 'info');
    }
  };

  // ============================================================================
  // Prescriptions & Medical Reports Vault Actions
  // ============================================================================

  const loadDocumentPageImage = async (fileId: string): Promise<string | null> => {
    if (!fileId) return null;
    const storeUid = currentUser?.uid || 'guest_local';
    const localFile = await getDocumentFileFromIdb(storeUid, fileId);
    if (localFile?.data) {
      return localFile.data;
    }
    if (!currentUser || isDeviceOffline() || isFirestoreNetworkDisabled()) {
      return null;
    }
    try {
      const cloudFile = await fetchDocumentFileFromCloud(currentUser.uid, fileId);
      if (cloudFile?.data) {
        await saveDocumentFileToIdb(storeUid, {
          id: cloudFile.id,
          docId: cloudFile.docId,
          data: cloudFile.data,
          bytes: cloudFile.bytes,
        });
        return cloudFile.data;
      }
      return null;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadDocumentPageImage error:', err);
      }
      return null;
    }
  };

  const saveMedicalDocument = async (
    input: DocumentFormInput & { id?: string },
    newFileDataList: Array<{ id: string; data: string; bytes: number }>
  ): Promise<{ ok: boolean; docId?: string; savedOffline?: boolean; error?: string }> => {
    const clean = buildCleanMedicalDocumentInput(input);
    const existingDoc = input.id
      ? medicalDocumentsRef.current.find((d) => d.id === input.id)
      : undefined;

    const quotaCheck = canAddUserPages(
      medicalDocumentsRef.current,
      clean.pages.length,
      existingDoc?.pages.length || 0
    );
    if (!quotaCheck.allowed) {
      showToast(quotaCheck.reasonBn || `সর্বোচ্চ ${toBengaliNumber(MAX_USER_DOCUMENT_PAGES)} পাতা রাখা যায়`, 'alert');
      return { ok: false, error: quotaCheck.reasonBn };
    }

    const storeUid = currentUser?.uid || 'guest_local';
    const docId =
      existingDoc?.id ||
      input.id ||
      `mdoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newFileMap = new Map(newFileDataList.map((f) => [f.id, f]));
    const oldFileIds = existingDoc ? existingDoc.pages.map((p) => p.fileId) : [];
    const keptFileIdSet = new Set(clean.pages.map((p) => p.fileId));
    const removedFileIds = oldFileIds.filter((fid) => !keptFileIdSet.has(fid));

    // Save new compressed full images to IndexedDB first
    for (const nf of newFileDataList) {
      await saveDocumentFileToIdb(storeUid, {
        id: nf.id,
        docId,
        data: nf.data,
        bytes: nf.bytes,
        createdAtIso: nowIso,
      });
    }
    if (removedFileIds.length > 0) {
      await deleteDocumentFilesFromIdb(storeUid, removedFileIds);
    }

    const localDocRecord: MedicalDocument = {
      id: docId,
      kind: clean.kind,
      patientId: clean.patientId,
      ...(clean.doctorId ? { doctorId: clean.doctorId } : {}),
      title: clean.title,
      date: clean.date,
      ...(clean.note ? { note: clean.note } : {}),
      ...(clean.reportType ? { reportType: clean.reportType } : {}),
      pages: clean.pages,
      createdAt: existingDoc?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextDocs = sortMedicalDocumentsNewestFirst(
      existingDoc
        ? medicalDocumentsRef.current.map((d) => (d.id === docId ? localDocRecord : d))
        : [localDocRecord, ...medicalDocumentsRef.current]
    );
    setMedicalDocuments(nextDocs);
    await saveDocumentsMetaToIdb(storeUid, nextDocs);

    if (!currentUser) {
      showToast(
        clean.kind === 'prescription' ? 'প্রেসক্রিপশন ফোনে সংরক্ষিত হয়েছে ✓' : 'রিপোর্ট ফোনে সংরক্ষিত হয়েছে ✓',
        'success'
      );
      return { ok: true, docId };
    }

    const uid = currentUser.uid;
    const pendingFilesPayload = newFileDataList.map((f) => ({ fileId: f.id, docId }));
    enqueueDocUpsert(uid, docId, pendingFilesPayload, removedFileIds);
    refreshPendingSyncCount(uid);

    if (isWriteQuotaPaused() || isDeviceOffline() || isFirestoreNetworkDisabled()) {
      if (isWriteQuotaPaused()) notifyQuotaExceededOnce();
      showToast('ফোনে সংরক্ষিত, পরে ক্লাউডে যাবে', 'info');
      return { ok: true, docId, savedOffline: true };
    }

    setSyncStatus('syncing');
    try {
      for (const page of clean.pages) {
        const nf = newFileMap.get(page.fileId);
        if (nf) {
          await createDocumentFileInCloud(uid, {
            id: nf.id,
            docId,
            data: nf.data,
            bytes: nf.bytes,
          });
          markFileUploadedInQueue(uid, nf.id);
        }
      }

      for (const rf of removedFileIds) {
        await deleteDocumentFileFromCloud(uid, rf);
        markFileDeletedInQueue(uid, rf);
      }

      if (existingDoc) {
        await updateDocumentMetaInCloud(uid, docId, clean);
      } else {
        await createDocumentMetaInCloud(uid, docId, clean);
      }

      markDocUpsertSyncedInQueue(uid, docId);
      refreshPendingSyncCount(uid);
      updateLiveSyncTime(false);
      showToast(
        clean.kind === 'prescription' ? 'প্রেসক্রিপশন সংরক্ষিত হয়েছে ✓' : 'রিপোর্ট সংরক্ষিত হয়েছে ✓',
        'success'
      );
      return { ok: true, docId };
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        setSyncStatus('failed');
      }
      refreshPendingSyncCount(uid);
      showToast('ফোনে সংরক্ষিত, পরে ক্লাউডে যাবে', 'info');
      return { ok: true, docId, savedOffline: true };
    }
  };

  const rotateMedicalDocumentPage = async (docId: string, pageIndex: number): Promise<void> => {
    const target = medicalDocumentsRef.current.find((d) => d.id === docId);
    if (!target || !target.pages[pageIndex]) return;

    const storeUid = currentUser?.uid || 'guest_local';
    const updatedPages = target.pages.map((p, idx) =>
      idx === pageIndex ? { ...p, rotation: rotateDegreeClockwise(p.rotation) } : p
    );
    const updatedDoc: MedicalDocument = {
      ...target,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    };

    const nextDocs = sortMedicalDocumentsNewestFirst(
      medicalDocumentsRef.current.map((d) => (d.id === docId ? updatedDoc : d))
    );
    setMedicalDocuments(nextDocs);
    await saveDocumentsMetaToIdb(storeUid, nextDocs);

    if (!currentUser) return;
    const uid = currentUser.uid;
    enqueueDocUpsert(uid, docId, [], []);
    refreshPendingSyncCount(uid);

    if (isWriteQuotaPaused() || isDeviceOffline() || isFirestoreNetworkDisabled()) {
      if (isWriteQuotaPaused()) notifyQuotaExceededOnce();
      showToast('ফোনে ঘোরানো হয়েছে, পরে ক্লাউডে সিঙ্ক হবে', 'info');
      return;
    }

    try {
      await updateDocumentMetaInCloud(uid, docId, {
        id: updatedDoc.id,
        kind: updatedDoc.kind,
        patientId: updatedDoc.patientId,
        doctorId: updatedDoc.doctorId,
        title: updatedDoc.title,
        date: updatedDoc.date,
        note: updatedDoc.note,
        reportType: updatedDoc.reportType,
        pages: updatedPages,
      });
      markDocUpsertSyncedInQueue(uid, docId);
      refreshPendingSyncCount(uid);
      updateLiveSyncTime(false);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        setSyncStatus('failed');
      }
      refreshPendingSyncCount(uid);
      showToast('ফোনে সংরক্ষিত, পরে ক্লাউডে যাবে', 'info');
    }
  };

  const deleteMedicalDocument = async (docId: string): Promise<void> => {
    const target = medicalDocumentsRef.current.find((d) => d.id === docId);
    if (!target) return;

    const storeUid = currentUser?.uid || 'guest_local';
    const fileIds = (target.pages || []).map((p) => p.fileId).filter(Boolean);

    const nextDocs = medicalDocumentsRef.current.filter((d) => d.id !== docId);
    setMedicalDocuments(nextDocs);
    await saveDocumentsMetaToIdb(storeUid, nextDocs);
    if (fileIds.length > 0) {
      await deleteDocumentFilesFromIdb(storeUid, fileIds);
    }

    if (!currentUser) {
      showToast('ডকুমেন্ট মুছে ফেলা হয়েছে', 'info');
      return;
    }

    const uid = currentUser.uid;
    enqueueDocDelete(uid, docId, fileIds);
    refreshPendingSyncCount(uid);

    if (isWriteQuotaPaused() || isDeviceOffline() || isFirestoreNetworkDisabled()) {
      if (isWriteQuotaPaused()) notifyQuotaExceededOnce();
      showToast('ফোন থেকে মুছে ফেলা হয়েছে, পরে ক্লাউডে সিঙ্ক হবে', 'info');
      return;
    }

    try {
      const queueNow = loadDocSyncQueue(uid);
      for (const fid of [...queueNow.deleteFileIds]) {
        if (fileIds.includes(fid)) {
          await deleteDocumentFileFromCloud(uid, fid);
          markFileDeletedInQueue(uid, fid);
        }
      }
      await deleteDocumentMetaFromCloud(uid, docId);
      markDocDeleteSyncedInQueue(uid, docId);
      refreshPendingSyncCount(uid);
      updateLiveSyncTime(false);
      showToast('ডকুমেন্ট স্থায়ীভাবে মুছে ফেলা হয়েছে', 'info');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      }
      refreshPendingSyncCount(uid);
      showToast('ফোন থেকে মুছে ফেলা হয়েছে, পরে ক্লাউডে সিঙ্ক হবে', 'info');
    }
  };

  const unlinkOrDeleteDoctorPrescriptions = async (
    doctorId: string,
    mode: 'keep_unlinked' | 'delete_all'
  ): Promise<void> => {
    const affected = medicalDocumentsRef.current.filter(
      (d) => d.kind === 'prescription' && d.doctorId === doctorId
    );
    if (affected.length === 0) return;

    if (mode === 'delete_all') {
      for (const docItem of affected) {
        await deleteMedicalDocument(docItem.id);
      }
      return;
    }

    const storeUid = currentUser?.uid || 'guest_local';
    const nowIso = new Date().toISOString();
    const nextDocs = sortMedicalDocumentsNewestFirst(
      medicalDocumentsRef.current.map((d) => {
        if (d.kind === 'prescription' && d.doctorId === doctorId) {
          const copy: MedicalDocument = { ...d, updatedAt: nowIso };
          delete copy.doctorId;
          return copy;
        }
        return d;
      })
    );
    setMedicalDocuments(nextDocs);
    await saveDocumentsMetaToIdb(storeUid, nextDocs);

    if (!currentUser) return;
    const uid = currentUser.uid;
    for (const docItem of affected) {
      enqueueDocUpsert(uid, docItem.id, [], []);
    }
    refreshPendingSyncCount(uid);

    if (isWriteQuotaPaused() || isDeviceOffline() || isFirestoreNetworkDisabled()) {
      if (isWriteQuotaPaused()) notifyQuotaExceededOnce();
      return;
    }

    for (const docItem of affected) {
      try {
        await updateDocumentMetaInCloud(uid, docItem.id, {
          id: docItem.id,
          kind: docItem.kind,
          patientId: docItem.patientId,
          doctorId: undefined,
          title: docItem.title,
          date: docItem.date,
          note: docItem.note,
          reportType: docItem.reportType,
          pages: docItem.pages,
        });
        markDocUpsertSyncedInQueue(uid, docItem.id);
      } catch (err) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
          break;
        }
      }
    }
    refreshPendingSyncCount(uid);
  };

  const openAddToPersonalModal = (med: GlobalMedicine) => {
    setCatalogMedToAddToPersonal(med);
    setIsAddToPersonalModalOpen(true);
  };

  const closeAddToPersonalModal = () => {
    setIsAddToPersonalModalOpen(false);
    setCatalogMedToAddToPersonal(null);
  };

  const postResetRetriedDhakaDayKeyRef = useRef<string | null>(null);

  // Hydrate Admin Offline/Quota Publish Queue from IndexedDB
  useEffect(() => {
    if (!isAdmin) {
      setPendingPublishMedicines([]);
      setPendingPublishBatches([]);
      setPendingPublishLastRetryAttemptMs(null);
      return;
    }
    let cancelled = false;
    loadAdminPublishQueue().then((state) => {
      if (cancelled) return;
      setPendingPublishMedicines(state.medicines);
      setPendingPublishBatches(state.batches);
      if (state.updatedAtMs > 0) {
        setPendingPublishLastRetryAttemptMs(state.updatedAtMs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const isQueueableAdminWriteFailure = (err?: unknown): boolean => {
    if (err && isQuotaExceededError(err)) return true;
    return isWriteQuotaPaused() || isDeviceOffline() || isFirestoreNetworkDisabled();
  };

  const enqueueMedicinesForOfflineAdminPublish = async (
    newOrUpdatedMeds: GlobalMedicine[],
    batchInfo?: ImportBatch
  ): Promise<void> => {
    const mergedMeds = dedupeAndMergeQueueMedicines(
      pendingPublishMedicinesRef.current,
      newOrUpdatedMeds
    );
    const mergedBatches = dedupeAndMergeQueueBatches(
      pendingPublishBatchesRef.current,
      batchInfo
    );
    pendingPublishMedicinesRef.current = mergedMeds;
    pendingPublishBatchesRef.current = mergedBatches;
    setPendingPublishMedicines(mergedMeds);
    setPendingPublishBatches(mergedBatches);
    await saveAdminPublishQueue(mergedMeds, mergedBatches);
  };

  const commitUpdatedCatalogChunks = async (
    nextList: GlobalMedicine[],
    batchInfo?: ImportBatch
  ) => {
    const res = await publishChunkedLibraryCatalog(
      nextList,
      localLibraryVersionRef.current,
      batchInfo
    );
    localLibraryVersionRef.current = res.newVersion;
    setLibraryVersion(res.newVersion);
    setCloudGlobalMedicines(nextList);
    cloudGlobalMedicinesRef.current = nextList;
    globalCatalogBaselineRef.current = {
      hasInitialServerLoad: true,
      prevPublishedCount: nextList.filter((m) => m.status === 'published').length,
      skipNextListenerBaseline: false,
    };

    await saveLibraryToIndexedDb({
      version: res.newVersion,
      totalCount: res.totalCount,
      updatedAt: new Date().toISOString(),
      medicines: nextList,
    });

    const timeStr = formatLibrarySyncTime();
    setLastSyncTime(timeStr);
    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_LAST_SYNC, timeStr);
    } catch {
      // ignore storage write error
    }

    return res;
  };

  const retryPendingPublishNow = async (isAutoRetry = false): Promise<boolean> => {
    if (!isAdmin || retryPublishInFlightRef.current) return false;

    const queuedMeds = pendingPublishMedicinesRef.current;
    const queuedBatches = pendingPublishBatchesRef.current;
    if (queuedMeds.length === 0) return false;

    if (isDeviceOffline()) {
      if (!isAutoRetry) {
        showToast('অফলাইন আছেন — ইন্টারনেট চালু হলে আবার চেষ্টা করুন', 'info');
      }
      return false;
    }

    retryPublishInFlightRef.current = true;
    setIsRetryingPendingPublish(true);
    const attemptNow = Date.now();
    setPendingPublishLastRetryAttemptMs(attemptNow);
    pendingPublishLastRetryRef.current = attemptNow;

    try {
      if (!isWriteQuotaPaused()) {
        clearWriteQuotaPause();
        setIsQuotaExceeded(false);
      }
      await resumeFirestoreNetwork();

      const combinedCatalog = combineCatalogWithPendingQueueForSingleVersionPublish(
        cloudGlobalMedicinesRef.current,
        queuedMeds
      );
      const latestBatch = queuedBatches.length > 0 ? queuedBatches[queuedBatches.length - 1] : undefined;

      // Single new catalog version for ALL queued medicines combined
      const res = await commitUpdatedCatalogChunks(combinedCatalog, latestBatch);

      recordAdminActivity({
        type: 'publish',
        title: 'অপেক্ষমাণ ওষুধ একসাথে প্রকাশ (Single Version)',
        description: `সারিতে থাকা ${queuedMeds.length}টি ওষুধ একসাথে সংস্করণ v${res.newVersion}-এ প্রকাশিত হয়েছে (মোট: ${res.totalCount}টি)।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      pendingPublishMedicinesRef.current = [];
      pendingPublishBatchesRef.current = [];
      setPendingPublishMedicines([]);
      setPendingPublishBatches([]);
      await clearAdminPublishQueue();

      clearWriteQuotaPause();
      setIsQuotaExceeded(false);
      setSyncStatus('synced');

      showToast(
        `অপেক্ষমাণ ${toBengaliNumber(queuedMeds.length)}টি ওষুধ একসাথে লাইব্রেরিতে প্রকাশিত হয়েছে!`,
        'success'
      );
      return true;
    } catch (err: any) {
      console.error('Retry pending admin publish failed:', err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
        if (!isAutoRetry) {
          showToast('আজকের সীমা শেষ, দুপুর ২টার পর চেষ্টা করুন', 'alert');
        }
      } else if (!isAutoRetry) {
        showToast(`প্রকাশ ব্যর্থ হয়েছে (ফোনের সারি অক্ষত আছে): ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return false;
    } finally {
      retryPublishInFlightRef.current = false;
      setIsRetryingPendingPublish(false);
    }
  };

  const cancelPendingPublishItem = async (medicineId: string): Promise<void> => {
    if (!isAdmin) return;
    const nextMeds = removeIdsFromPublishQueue(pendingPublishMedicinesRef.current, [medicineId]);
    const nextBatches = nextMeds.length === 0 ? [] : pendingPublishBatchesRef.current;
    pendingPublishMedicinesRef.current = nextMeds;
    pendingPublishBatchesRef.current = nextBatches;
    setPendingPublishMedicines(nextMeds);
    setPendingPublishBatches(nextBatches);
    await saveAdminPublishQueue(nextMeds, nextBatches);
    showToast('অপেক্ষমাণ প্রকাশের তালিকা থেকে সরানো হয়েছে', 'info');
  };

  const clearPendingPublishQueue = async (): Promise<void> => {
    if (!isAdmin) return;
    pendingPublishMedicinesRef.current = [];
    pendingPublishBatchesRef.current = [];
    setPendingPublishMedicines([]);
    setPendingPublishBatches([]);
    await clearAdminPublishQueue();
    showToast('অপেক্ষমাণ প্রকাশের সারি বাতিল করা হয়েছে', 'info');
  };

  // Auto-retry once after daily quota reset (after 14:10 Asia/Dhaka) or every 30 min when online & quota not paused
  useEffect(() => {
    if (!isAdmin || pendingPublishMedicines.length === 0) return;

    const evaluateAutoRetry = () => {
      const decision = shouldAttemptAdminQueueAutoPublish({
        hasPending: pendingPublishMedicinesRef.current.length > 0,
        isAdmin,
        isOnline: !isDeviceOffline(),
        isFlushing: retryPublishInFlightRef.current,
        isQuotaPausedNow: isWriteQuotaPaused(),
        lastAttemptMs: pendingPublishLastRetryRef.current || 0,
        postResetRetriedDhakaDayKey: postResetRetriedDhakaDayKeyRef.current,
      });

      if (!decision.shouldAttempt) return;

      if (decision.reason === 'post_reset_210pm') {
        postResetRetriedDhakaDayKeyRef.current = decision.dhakaDayKey;
        clearWriteQuotaPause();
        setIsQuotaExceeded(false);
        resumeFirestoreNetwork().catch(() => {});
      }

      void retryPendingPublishNow(true);
    };

    evaluateAutoRetry();
    const timer = setInterval(evaluateAutoRetry, 60_000);
    const onOnline = () => evaluateAutoRetry();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
    };
  }, [isAdmin, pendingPublishMedicines.length]);

  const migrateLegacyLibraryAction = async (): Promise<{
    legacyFoundCount: number;
    mergedTotalCount: number;
    newVersion: number;
    chunkCount: number;
  } | null> => {
    if (!isAdmin) {
      showToast('অননুমোদিত অ্যাক্সেস: শুধুমাত্র অ্যাডমিন এই মাইগ্রেশন চালাতে পারবেন।', 'alert');
      return null;
    }

    try {
      const res = await migrateLegacyGlobalMedicinesToChunks(
        cloudGlobalMedicinesRef.current,
        localLibraryVersionRef.current
      );

      if (res.mergedMedicines.length > 0) {
        localLibraryVersionRef.current = res.newVersion;
        setLibraryVersion(res.newVersion);
        setCloudGlobalMedicines(res.mergedMedicines);
        cloudGlobalMedicinesRef.current = res.mergedMedicines;
        globalCatalogBaselineRef.current = {
          hasInitialServerLoad: true,
          prevPublishedCount: res.mergedMedicines.filter((m) => m.status === 'published').length,
          skipNextListenerBaseline: false,
        };
        await saveLibraryToIndexedDb({
          version: res.newVersion,
          totalCount: res.mergedTotalCount,
          updatedAt: new Date().toISOString(),
          medicines: res.mergedMedicines,
        });
      }

      if (res.legacyFoundCount === 0 && res.mergedTotalCount === 0) {
        showToast('পুরনো ডাটাবেজে মাইগ্রেট করার মতো কোনো ওষুধ পাওয়া যায়নি।', 'info');
      } else {
        showToast(
          `মাইগ্রেশন সফল! ${res.legacyFoundCount}টি পুরনো রেকর্ড ${res.chunkCount}টি চাঙ্কে (মোট ${res.mergedTotalCount}টি) সংরক্ষিত হয়েছে।`,
          'success'
        );
      }

      return {
        legacyFoundCount: res.legacyFoundCount,
        mergedTotalCount: res.mergedTotalCount,
        newVersion: res.newVersion,
        chunkCount: res.chunkCount,
      };
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`মাইগ্রেশন ব্যর্থ: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return null;
    }
  };

  const executeAdminBatchImport = async (
    batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'importedByUid' | 'importedByEmail'>,
    records: GlobalMedicine[]
  ): Promise<boolean> => {
    if (!isAdmin) {
      showToast('অননুমোদিত অ্যাক্সেস: আপনার এই অ্যাকাউন্টে ডাটা ইমপোর্ট করার অনুমতি নেই।', 'alert');
      return false;
    }

    const batchId = `batch_${Date.now()}`;
    const fullBatch: ImportBatch = {
      ...batchInfo,
      id: batchId,
      importedAt: new Date().toISOString(),
      importedByUid: currentUser?.uid || 'admin',
      importedByEmail: currentUser?.email || ADMIN_EMAIL,
    };

    // Sanitize ID and validate against catalog constraints
    const validRecordsToCommit: GlobalMedicine[] = [];
    const invalidRecords: { brandName: string; reason: string }[] = [];

    records.forEach((r, idx) => {
      const sanitizedId = sanitizeMedicineId(r.id || `gmed_${Date.now()}_${idx}`);
      const prepared: GlobalMedicine = {
        ...r,
        id: sanitizedId,
        importBatchId: batchId,
        importedAt: fullBatch.importedAt,
        verifiedByAdmin: r.status === 'published' ? true : false,
        status: r.status || 'published',
        source: r.source || fullBatch.source,
        sourceType: r.sourceType || fullBatch.sourceType,
        sourceName: r.sourceName || fullBatch.source,
        licenseReference: r.licenseReference || fullBatch.licenseReference,
        writtenPermissionRef: r.writtenPermissionRef || fullBatch.writtenPermissionRef,
        duplicateKey:
          r.duplicateKey ||
          generateDuplicateKey(r.brandName, r.genericName, r.strength, r.dosageForm, r.manufacturer),
      };

      if (
        !prepared.id ||
        !/^[a-zA-Z0-9_\-]+$/.test(prepared.id) ||
        prepared.id.length > 128 ||
        !prepared.brandName ||
        prepared.brandName.trim().length === 0 ||
        prepared.brandName.length > 128 ||
        !prepared.genericName ||
        prepared.genericName.trim().length === 0 ||
        prepared.genericName.length > 256 ||
        !prepared.strength ||
        prepared.strength.length > 64 ||
        !prepared.dosageForm ||
        prepared.dosageForm.length > 64 ||
        !prepared.manufacturer ||
        prepared.manufacturer.length > 128 ||
        !prepared.source ||
        prepared.source.length > 64 ||
        !prepared.duplicateKey ||
        prepared.duplicateKey.length > 256
      ) {
        invalidRecords.push({
          brandName: prepared.brandName || `ইনডেক্স ${idx}`,
          reason: 'নিয়ম লঙ্ঘন (দৈর্ঘ্য বা অবৈধ অক্ষর)',
        });
        return;
      }

      validRecordsToCommit.push(prepared);
    });

    if (validRecordsToCommit.length === 0) {
      showToast('ইমপোর্ট ব্যর্থ: কোনো রেকর্ডই প্রয়োজনীয় শর্ত পূরণ করেনি।', 'alert');
      return false;
    }

    // Compare against combined displayed catalog so already-queued items aren't duplicated
    const catalogDiff = hasCatalogChanges(globalMedicines, validRecordsToCommit);
    if (!catalogDiff.changed) {
      showToast('সব ওষুধ আগেই আছে, নতুন কিছু নেই', 'info');
      return false;
    }

    if (isQueueableAdminWriteFailure()) {
      await enqueueMedicinesForOfflineAdminPublish(validRecordsToCommit, fullBatch);
      showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
      return true;
    }

    try {
      const mergedCloudAndPending = combineCatalogWithPendingQueueForSingleVersionPublish(
        cloudGlobalMedicinesRef.current,
        [...pendingPublishMedicinesRef.current, ...validRecordsToCommit]
      );
      const res = await commitUpdatedCatalogChunks(mergedCloudAndPending, fullBatch);

      if (pendingPublishMedicinesRef.current.length > 0) {
        pendingPublishMedicinesRef.current = [];
        pendingPublishBatchesRef.current = [];
        setPendingPublishMedicines([]);
        setPendingPublishBatches([]);
        await clearAdminPublishQueue();
      }

      const publishedCount = validRecordsToCommit.filter((r) => r.status === 'published').length;
      const unverifiedCount = validRecordsToCommit.length - publishedCount;

      recordAdminActivity({
        type: 'import',
        title: `ওষুধ ডাটা ইমপোর্ট (${fullBatch.source})`,
        description: `${catalogDiff.addedOrUpdatedCount}টি নতুন/হালনাগাদ ওষুধসহ মোট ${res.totalCount}টি ওষুধ ${res.chunkCount}টি চাঙ্কে সংরক্ষিত (${publishedCount}টি প্রকাশিত, ${unverifiedCount}টি খসড়া)।`,
        adminEmail: fullBatch.importedByEmail,
      }).catch((e) => console.warn('Activity log error:', e));

      let msg = `ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে! মোট ${res.totalCount} টি (${res.chunkCount} চাঙ্ক)`;
      if (invalidRecords.length > 0) {
        msg += ` (${invalidRecords.length} টি ত্রুটিপূর্ণ রেকর্ড বাদ দেওয়া হয়েছে)`;
      }
      showToast(msg, 'success');
      return true;
    } catch (err: any) {
      console.error('Batch import to cloud failed:', err);
      if (isQueueableAdminWriteFailure(err)) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        }
        await enqueueMedicinesForOfflineAdminPublish(validRecordsToCommit, fullBatch);
        showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
        return true;
      }
      showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      return false;
    }
  };

  const publishGlobalMedicineAction = async (medicineId: string): Promise<boolean> => {
    if (!isAdmin) {
      showToast('অননুমোদিত অ্যাক্সেস: আপনার এই অ্যাকাউন্টে ওষুধ অনুমোদন ও প্রকাশ করার অনুমতি নেই।', 'alert');
      return false;
    }

    const targetMed = globalMedicines.find((m) => m.id === medicineId);
    if (!targetMed) {
      showToast('ওষুধটি খুঁজে পাওয়া যায়নি।', 'alert');
      return false;
    }

    if (targetMed.status === 'published' && targetMed.verifiedByAdmin) {
      showToast('সব ওষুধ আগেই আছে, নতুন কিছু নেই', 'info');
      return false;
    }

    const cleanLicense =
      targetMed.licenseReference && targetMed.licenseReference.includes('TEST-SYSTEM-ONLY')
        ? 'DGDA Public Gazette / National Formulary'
        : (targetMed.licenseReference || 'DGDA Public Gazette Open Data');

    const updatedMed: GlobalMedicine = {
      ...targetMed,
      status: 'published',
      verifiedByAdmin: true,
      verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
      licenseReference: cleanLicense,
    };

    if (isQueueableAdminWriteFailure()) {
      await enqueueMedicinesForOfflineAdminPublish([updatedMed]);
      showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
      return true;
    }

    const nextList = cloudGlobalMedicinesRef.current.some((m) => m.id === medicineId)
      ? cloudGlobalMedicinesRef.current.map((m) => (m.id === medicineId ? updatedMed : m))
      : [updatedMed, ...cloudGlobalMedicinesRef.current];

    try {
      await commitUpdatedCatalogChunks(nextList);

      if (pendingPublishMedicinesRef.current.some((m) => m.id === medicineId)) {
        const remaining = removeIdsFromPublishQueue(pendingPublishMedicinesRef.current, [medicineId]);
        pendingPublishMedicinesRef.current = remaining;
        setPendingPublishMedicines(remaining);
        await saveAdminPublishQueue(remaining, pendingPublishBatchesRef.current);
      }

      recordAdminActivity({
        type: 'publish',
        title: 'ওষুধ অনুমোদন ও সার্বজনীন প্রকাশ',
        description: `ওষুধ "${updatedMed.brandName}" (${updatedMed.id}) যাচাইকৃত ও গ্লোবাল ক্যাটালগে প্রকাশিত হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`"${updatedMed.brandName}" সফলভাবে অনুমোদিত ও লাইব্রেরিতে প্রকাশিত হয়েছে!`, 'success');
      return true;
    } catch (err: any) {
      console.error('Firestore publish error:', err);
      if (isQueueableAdminWriteFailure(err)) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        }
        await enqueueMedicinesForOfflineAdminPublish([updatedMed]);
        showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
        return true;
      }
      showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      return false;
    }
  };

  const bulkPublishGlobalMedicinesAction = async (medicineIds?: string[]): Promise<number> => {
    if (!isAdmin) {
      showToast('অননুমোদিত অ্যাক্সেস: আপনার এই অ্যাকাউন্টে ওষুধ প্রকাশ করার অনুমতি নেই।', 'alert');
      return 0;
    }

    const unpublished = globalMedicines.filter(
      (m) => m.status !== 'published' || !m.verifiedByAdmin
    );
    const targets =
      medicineIds && medicineIds.length > 0
        ? unpublished.filter((m) => medicineIds.includes(m.id))
        : unpublished;

    if (targets.length === 0) {
      showToast('প্রকাশ করার মতো কোনো খসড়া ওষুধ পাওয়া যায়নি।', 'info');
      return 0;
    }

    const publishedUpdates: GlobalMedicine[] = targets.map((med) => {
      const cleanLicense =
        med.licenseReference && med.licenseReference.includes('TEST-SYSTEM-ONLY')
          ? 'DGDA Public Gazette / National Formulary'
          : (med.licenseReference || 'DGDA Public Gazette Open Data');

      return {
        ...med,
        status: 'published',
        verifiedByAdmin: true,
        verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
        licenseReference: cleanLicense,
      };
    });

    if (isQueueableAdminWriteFailure()) {
      await enqueueMedicinesForOfflineAdminPublish(publishedUpdates);
      showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
      return targets.length;
    }

    const nextList = combineCatalogWithPendingQueueForSingleVersionPublish(
      cloudGlobalMedicinesRef.current,
      publishedUpdates
    );

    try {
      const res = await commitUpdatedCatalogChunks(nextList);

      const remainingPending = removeIdsFromPublishQueue(
        pendingPublishMedicinesRef.current,
        publishedUpdates.map((m) => m.id)
      );
      if (remainingPending.length !== pendingPublishMedicinesRef.current.length) {
        pendingPublishMedicinesRef.current = remainingPending;
        setPendingPublishMedicines(remainingPending);
        await saveAdminPublishQueue(remainingPending, pendingPublishBatchesRef.current);
      }

      recordAdminActivity({
        type: 'publish',
        title: 'বাল্ক ওষুধ অনুমোদন ও সার্বজনীন প্রকাশ',
        description: `মোট ${targets.length}টি ওষুধ সরাসরি অনুমোদন করে লাইব্রেরিতে সার্বজনীন প্রকাশ করা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(
        `মোট ${targets.length}টি ওষুধ সফলভাবে লাইব্রেরিতে প্রকাশিত হয়েছে! (মোট: ${res.totalCount} টি)`,
        'success'
      );
      return targets.length;
    } catch (err: any) {
      console.error('Firestore bulk publish error:', err);
      if (isQueueableAdminWriteFailure(err)) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        }
        await enqueueMedicinesForOfflineAdminPublish(publishedUpdates);
        showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
        return targets.length;
      }
      showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      return 0;
    }
  };

  const deleteGlobalMedicineAction = async (medicineId: string): Promise<boolean> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: আপনার এই অ্যাকাউন্টে ডাটা মোছার প্রশাসনিক অনুমতি নেই।', 'alert');
      return false;
    }

    const target = globalMedicines.find((m) => m.id === medicineId);
    if (!target) {
      showToast('রেকর্ডটি খুঁজে পাওয়া যায়নি', 'alert');
      return false;
    }

    const isTest = isTestMedicine(target);
    const isUnpublishedDraft = target.status !== 'published' || !target.verifiedByAdmin;
    if (!isTest && !isUnpublishedDraft) {
      showToast('নিরাপত্তা বিধিনিষেধ: শুধুমাত্র খসড়া বা টেস্ট ডাটা রেকর্ড মুছে ফেলা যাবে। বাস্তব প্রকাশিত ওষুধ মুছা সম্পূর্ণ নিষিদ্ধ।', 'alert');
      return false;
    }

    const inCloud = cloudGlobalMedicinesRef.current.some((m) => m.id === medicineId);
    if (!inCloud) {
      await cancelPendingPublishItem(medicineId);
      return true;
    }

    const nextList = cloudGlobalMedicinesRef.current.filter((m) => m.id !== medicineId);

    try {
      await commitUpdatedCatalogChunks(nextList);

      recordAdminActivity({
        type: 'delete',
        title: 'টেস্ট ডাটা নিরাপদ অপসারণ',
        description: `খসড়া কিউ থেকে "${target.brandName}" মুছে ফেলা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`"${target.brandName}" রেকর্ডটি সফলভাবে ক্লাউড থেকে মুছে ফেলা হয়েছে`, 'info');
      return true;
    } catch (err: any) {
      console.error('Firestore delete error:', err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return false;
    }
  };

  const bulkDeleteGlobalMedicinesAction = async (medicineIds: string[]): Promise<boolean> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: আপনার এই অ্যাকাউন্টে ডাটা মোছার প্রশাসনিক অনুমতি নেই।', 'alert');
      return false;
    }

    if (!medicineIds || medicineIds.length === 0) {
      showToast('মুছে ফেলার জন্য কোনো রেকর্ড নির্বাচন করা হয়নি', 'info');
      return false;
    }

    const targets = globalMedicines.filter((m) => medicineIds.includes(m.id));
    const safeToDelete = targets.filter((m) => {
      const isTest = isTestMedicine(m);
      const isUnpublishedDraft = m.status !== 'published' || !m.verifiedByAdmin;
      return isTest || isUnpublishedDraft;
    });

    if (safeToDelete.length === 0) {
      showToast('নিরাপত্তা বিধিনিষেধ: নির্বাচিত কোনো রেকর্ড টেস্ট ডাটা বা খসড়া নয়। বাস্তব প্রকাশিত ওষুধ মুছা নিষিদ্ধ।', 'alert');
      return false;
    }

    const safeIdSet = new Set(safeToDelete.map((m) => m.id));
    const nextList = cloudGlobalMedicinesRef.current.filter((m) => !safeIdSet.has(m.id));

    try {
      if (nextList.length !== cloudGlobalMedicinesRef.current.length) {
        await commitUpdatedCatalogChunks(nextList);
      }

      const remainingPending = removeIdsFromPublishQueue(
        pendingPublishMedicinesRef.current,
        Array.from(safeIdSet)
      );
      if (remainingPending.length !== pendingPublishMedicinesRef.current.length) {
        pendingPublishMedicinesRef.current = remainingPending;
        setPendingPublishMedicines(remainingPending);
        await saveAdminPublishQueue(remainingPending, pendingPublishBatchesRef.current);
      }

      recordAdminActivity({
        type: 'delete',
        title: 'বাল্ক টেস্ট ডাটা নিরাপদ অপসারণ',
        description: `খসড়া কিউ থেকে ${safeIdSet.size}টি রেকর্ড মুছে ফেলা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`${safeIdSet.size} টি রেকর্ড সফলভাবে ক্লাউড থেকে মুছে ফেলা হয়েছে`, 'info');
      return true;
    } catch (err: any) {
      console.error('Firestore bulk delete error:', err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return false;
    }
  };

  const addSingleGlobalMedicineAction = async (
    rawMedicine: Omit<GlobalMedicine, 'id' | 'duplicateKey' | 'importedAt'> & { id?: string }
  ): Promise<boolean> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: আপনার এই অ্যাকাউন্টে নতুন ওষুধ যোগ করার প্রশাসনিক অনুমতি নেই।', 'alert');
      return false;
    }

    const brandName = (rawMedicine.brandName || '').trim();
    const genericName = (rawMedicine.genericName || '').trim();
    const strength = (rawMedicine.strength || '').trim();
    const dosageForm = (rawMedicine.dosageForm || 'ট্যাবলেট').trim();
    const manufacturer = (rawMedicine.manufacturer || '').trim();

    if (!brandName || !genericName || !strength || !dosageForm || !manufacturer) {
      showToast('ত্রুটি: ব্র্যান্ড নাম, জেনেরিক নাম, শক্তি, ডোজের ধরন এবং প্রস্তুতকারক পূরণ করা আবশ্যক।', 'alert');
      return false;
    }

    const baseId = rawMedicine.id || `gmed_${brandName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const cleanId = sanitizeMedicineId(baseId);
    const duplicateKey = generateDuplicateKey(brandName, genericName, strength, dosageForm, manufacturer);

    const source = rawMedicine.source || 'DGDA_GOV';
    const sourceType = rawMedicine.sourceType || 'government';
    const sourceName = rawMedicine.sourceName || (source === 'DGDA_GOV' ? 'DGDA সরকারি গেজেট' : 'প্রস্তুতকারক মনোগ্রাফ');
    const licenseReference = (rawMedicine.licenseReference || 'DGDA Public Gazette / National Formulary').trim();
    const isPublished = rawMedicine.status === 'published';

    const cleanMedicine: GlobalMedicine = stripUndefined({
      ...rawMedicine,
      id: cleanId,
      brandName: brandName.substring(0, 128),
      genericName: genericName.substring(0, 256),
      strength: strength.substring(0, 64),
      dosageForm: dosageForm.substring(0, 64),
      manufacturer: manufacturer.substring(0, 128),
      brandNameBn: rawMedicine.brandNameBn ? rawMedicine.brandNameBn.trim().substring(0, 128) : undefined,
      genericNameBn: rawMedicine.genericNameBn ? rawMedicine.genericNameBn.trim().substring(0, 256) : undefined,
      therapeuticClass: rawMedicine.therapeuticClass ? rawMedicine.therapeuticClass.trim().substring(0, 128) : undefined,
      indication: rawMedicine.indication ? rawMedicine.indication.trim().substring(0, 512) : undefined,
      pricePerUnit: typeof rawMedicine.pricePerUnit === 'number' && !isNaN(rawMedicine.pricePerUnit) ? rawMedicine.pricePerUnit : undefined,
      packageDescription: rawMedicine.packageDescription ? rawMedicine.packageDescription.trim().substring(0, 128) : undefined,
      darNumber: rawMedicine.darNumber ? rawMedicine.darNumber.trim().substring(0, 64) : undefined,
      source: source as ImportDataSource,
      sourceType,
      sourceName: sourceName.substring(0, 128),
      licenseReference: licenseReference.substring(0, 256),
      status: isPublished ? 'published' : 'draft',
      verifiedByAdmin: isPublished ? true : Boolean(rawMedicine.verifiedByAdmin),
      verificationNotes: isPublished
        ? 'প্রশাসক কর্তৃক ম্যানুয়ালি সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত'
        : 'ম্যানুয়াল এন্ট্রি - পর্যালোচনার জন্য অপেক্ষমাণ খসড়া',
      duplicateKey: duplicateKey.substring(0, 256),
      importedAt: new Date().toISOString(),
    });

    const diff = hasCatalogChanges(globalMedicines, [cleanMedicine]);
    if (!diff.changed) {
      showToast('সব ওষুধ আগেই আছে, নতুন কিছু নেই', 'info');
      return false;
    }

    if (isQueueableAdminWriteFailure()) {
      await enqueueMedicinesForOfflineAdminPublish([cleanMedicine]);
      showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
      return true;
    }

    const mergedCloudList = combineCatalogWithPendingQueueForSingleVersionPublish(
      cloudGlobalMedicinesRef.current,
      [cleanMedicine]
    );

    try {
      await commitUpdatedCatalogChunks(mergedCloudList);

      recordAdminActivity({
        type: isPublished ? 'publish' : 'import',
        title: isPublished ? 'ম্যানুয়াল ওষুধ অন্তর্ভুক্তি ও সার্বজনীন প্রকাশ' : 'ম্যানুয়াল ওষুধ খসড়া তৈরি',
        description: `ওষুধ "${cleanMedicine.brandName}" (${cleanMedicine.strength}, ${cleanMedicine.manufacturer}) সরাসরি ম্যানুয়ালি ক্লাউড লাইব্রেরিতে ${isPublished ? 'প্রকাশ' : 'খসড়া'} করা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(
        isPublished
          ? `"${cleanMedicine.brandName}" সফলভাবে ক্লাউড লাইব্রেরিতে যুক্ত ও সরাসরি প্রকাশিত হয়েছে!`
          : `"${cleanMedicine.brandName}" খসড়া হিসেবে ক্লাউডে সংরক্ষিত হয়েছে!`,
        'success'
      );
      return true;
    } catch (err: any) {
      console.error('Firestore manual add chunk error:', err);
      if (isQueueableAdminWriteFailure(err)) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        }
        await enqueueMedicinesForOfflineAdminPublish([cleanMedicine]);
        showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
        return true;
      }
      showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      return false;
    }
  };

  const updateSingleGlobalMedicineAction = async (updatedMed: GlobalMedicine): Promise<boolean> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: শুধুমাত্র অ্যাডমিন ওষুধের তথ্য সম্পাদনা করতে পারবেন।', 'alert');
      return false;
    }

    const brandName = (updatedMed.brandName || '').trim();
    const genericName = (updatedMed.genericName || '').trim();
    const strength = (updatedMed.strength || '').trim();
    const dosageForm = (updatedMed.dosageForm || 'ট্যাবলেট').trim();
    const manufacturer = (updatedMed.manufacturer || '').trim();

    if (!brandName || !genericName || !strength || !dosageForm || !manufacturer) {
      showToast('ত্রুটি: ব্র্যান্ড নাম, জেনেরিক নাম, শক্তি, ধরন এবং কোম্পানি পূরণ করা আবশ্যক।', 'alert');
      return false;
    }

    const exists = globalMedicines.some((m) => m.id === updatedMed.id);
    if (!exists) {
      showToast('সংশ্লিষ্ট ওষুধটি লাইব্রেরিতে খুঁজে পাওয়া যায়নি।', 'alert');
      return false;
    }

    const cleanMed: GlobalMedicine = stripUndefined({
      ...updatedMed,
      brandName: brandName.substring(0, 128),
      genericName: genericName.substring(0, 256),
      strength: strength.substring(0, 64),
      dosageForm: dosageForm.substring(0, 64),
      manufacturer: manufacturer.substring(0, 128),
      brandNameBn: updatedMed.brandNameBn ? updatedMed.brandNameBn.trim().substring(0, 128) : undefined,
      genericNameBn: updatedMed.genericNameBn ? updatedMed.genericNameBn.trim().substring(0, 256) : undefined,
      therapeuticClass: updatedMed.therapeuticClass ? updatedMed.therapeuticClass.trim().substring(0, 128) : undefined,
      indication: updatedMed.indication ? updatedMed.indication.trim().substring(0, 512) : undefined,
      pricePerUnit:
        typeof updatedMed.pricePerUnit === 'number' && !isNaN(updatedMed.pricePerUnit)
          ? updatedMed.pricePerUnit
          : undefined,
      priceUnit: updatedMed.priceUnit ? updatedMed.priceUnit.trim().substring(0, 32) : undefined,
      packageDescription: updatedMed.packageDescription
        ? updatedMed.packageDescription.trim().substring(0, 128)
        : undefined,
      darNumber: updatedMed.darNumber ? updatedMed.darNumber.trim().substring(0, 64) : undefined,
      duplicateKey: generateDuplicateKey(brandName, genericName, strength, dosageForm, manufacturer).substring(0, 256),
    });

    if (isQueueableAdminWriteFailure()) {
      await enqueueMedicinesForOfflineAdminPublish([cleanMed]);
      showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
      return true;
    }

    const nextList = cloudGlobalMedicinesRef.current.some((m) => m.id === cleanMed.id)
      ? cloudGlobalMedicinesRef.current.map((m) => (m.id === cleanMed.id ? cleanMed : m))
      : [cleanMed, ...cloudGlobalMedicinesRef.current];

    try {
      await commitUpdatedCatalogChunks(nextList);

      if (pendingPublishMedicinesRef.current.some((m) => m.id === cleanMed.id)) {
        const remaining = removeIdsFromPublishQueue(pendingPublishMedicinesRef.current, [cleanMed.id]);
        pendingPublishMedicinesRef.current = remaining;
        setPendingPublishMedicines(remaining);
        await saveAdminPublishQueue(remaining, pendingPublishBatchesRef.current);
      }

      recordAdminActivity({
        type: 'publish',
        title: 'ওষুধের তথ্য সম্পাদনা',
        description: `ওষুধ "${cleanMed.brandName}" (${cleanMed.strength}, ${cleanMed.manufacturer}) হালনাগাদ করা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`"${cleanMed.brandName}" সফলভাবে হালনাগাদ হয়েছে`, 'success');
      return true;
    } catch (err: any) {
      console.error('Firestore single edit chunk error:', err);
      if (isQueueableAdminWriteFailure(err)) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        }
        await enqueueMedicinesForOfflineAdminPublish([cleanMed]);
        showToast(ADMIN_QUOTA_SAVED_TOAST, 'info');
        return true;
      }
      showToast(`সম্পাদনা সংরক্ষণ হয়নি (আগের তালিকা অক্ষত আছে): ${getFriendlyErrorMessage(err)}`, 'alert');
      return false;
    }
  };

  const bulkUpdateGlobalMedicinesAction = async (
    ids: string[],
    patch: BulkMedicinePatch
  ): Promise<number> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: শুধুমাত্র অ্যাডমিন বাল্ক সম্পাদনা করতে পারবেন।', 'alert');
      return -1;
    }
    if (!ids || ids.length === 0) {
      showToast('সম্পাদনার জন্য কোনো ওষুধ মার্ক করা হয়নি', 'info');
      return 0;
    }

    const idSet = new Set(ids);
    const targetCount = cloudGlobalMedicinesRef.current.filter((m) => idSet.has(m.id)).length;
    if (targetCount === 0) return 0;

    const nextList = applyBulkMedicinePatch(cloudGlobalMedicinesRef.current, idSet, patch);

    try {
      await commitUpdatedCatalogChunks(nextList);

      const changedFields: string[] = [];
      if (patch.manufacturer?.trim()) changedFields.push(`কোম্পানি: ${patch.manufacturer.trim()}`);
      if (patch.dosageForm?.trim()) changedFields.push(`ধরন: ${patch.dosageForm.trim()}`);
      if (typeof patch.pricePerUnit === 'number' && !isNaN(patch.pricePerUnit)) {
        changedFields.push(`দাম: ৳${patch.pricePerUnit.toFixed(2)}`);
      }
      if (patch.priceUnit?.trim()) changedFields.push(`একক: ${patch.priceUnit.trim()}`);

      recordAdminActivity({
        type: 'publish',
        title: 'বাল্ক ওষুধ তথ্য হালনাগাদ',
        description: `${targetCount}টি ওষুধের তথ্য (${changedFields.join(', ')}) হালনাগাদ করা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`${targetCount}টি ওষুধের তথ্য সফলভাবে হালনাগাদ হয়েছে`, 'success');
      return targetCount;
    } catch (err: any) {
      console.error('Firestore bulk edit chunk error:', err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`বাল্ক হালনাগাদ ব্যর্থ (আগের তালিকা অক্ষত আছে): ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return -1;
    }
  };

  const adminDeleteGlobalMedicinesAction = async (
    ids: string[]
  ): Promise<{ success: boolean; deletedItems: GlobalMedicine[]; errorMessage?: string }> => {
    if (!isAdmin) {
      const msg = 'নিরাপত্তা প্রত্যাখ্যান: শুধুমাত্র অ্যাডমিন লাইব্রেরি থেকে ওষুধ মুছতে পারবেন।';
      showToast(msg, 'alert');
      return { success: false, deletedItems: [], errorMessage: msg };
    }

    if (!ids || ids.length === 0) {
      const msg = 'মুছে ফেলার জন্য কোনো ওষুধ নির্বাচন করা হয়নি।';
      showToast(msg, 'info');
      return { success: false, deletedItems: [], errorMessage: msg };
    }

    const idSet = new Set(ids);
    const deletedItems = cloudGlobalMedicinesRef.current.filter((m) => idSet.has(m.id));
    if (deletedItems.length === 0) {
      const msg = 'নির্বাচিত ওষুধগুলো খুঁজে পাওয়া যায়নি।';
      showToast(msg, 'alert');
      return { success: false, deletedItems: [], errorMessage: msg };
    }

    const nextList = cloudGlobalMedicinesRef.current.filter((m) => !idSet.has(m.id));

    try {
      await commitUpdatedCatalogChunks(nextList);

      recordAdminActivity({
        type: 'delete',
        title: deletedItems.length === 1 ? 'লাইব্রেরি থেকে ওষুধ মোছা হয়েছে' : 'বাল্ক ওষুধ অপসারণ',
        description:
          deletedItems.length === 1
            ? `"${deletedItems[0].brandName}" লাইব্রেরি থেকে মুছে ফেলা হয়েছে।`
            : `${deletedItems.length}টি ওষুধ লাইব্রেরি থেকে মুছে ফেলা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
        metadata: {
          count: deletedItems.length,
          action: 'admin_library_delete',
        },
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`${deletedItems.length}টি ওষুধ লাইব্রেরি থেকে মুছে ফেলা হয়েছে`, 'info');
      return { success: true, deletedItems };
    } catch (err: any) {
      console.error('Firestore admin delete chunk error:', err);
      const friendly = isQuotaExceededError(err) ? QUOTA_EXCEEDED_BN_MSG : getFriendlyErrorMessage(err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`মুছে ফেলা ব্যর্থ হয়েছে (পুরনো তালিকা সম্পূর্ণ অক্ষত আছে): ${friendly}`, 'alert');
      }
      return {
        success: false,
        deletedItems: [],
        errorMessage: `মুছে ফেলা ব্যর্থ হয়েছে, তবে বিদ্যমান তালিকা সম্পূর্ণ নিরাপদ আছে (${friendly})`,
      };
    }
  };

  const restoreDeletedGlobalMedicinesAction = async (
    itemsToRestore: GlobalMedicine[]
  ): Promise<boolean> => {
    if (!isAdmin) {
      showToast('নিরাপত্তা প্রত্যাখ্যান: শুধুমাত্র অ্যাডমিন ওষুধ পুনরুদ্ধার করতে পারবেন।', 'alert');
      return false;
    }
    if (!itemsToRestore || itemsToRestore.length === 0) return false;

    const nextList = mergeRestoredMedicines(cloudGlobalMedicinesRef.current, itemsToRestore);

    try {
      await commitUpdatedCatalogChunks(nextList);

      recordAdminActivity({
        type: 'publish',
        title: 'মুছে ফেলা ওষুধ পূর্বাবস্থায় ফেরানো (Undo)',
        description: `${itemsToRestore.length}টি মুছে ফেলা ওষুধ লাইব্রেরিতে ফিরিয়ে আনা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));

      showToast(`${itemsToRestore.length}টি ওষুধ সফলভাবে ফিরিয়ে আনা হয়েছে!`, 'success');
      return true;
    } catch (err: any) {
      console.error('Firestore undo restore chunk error:', err);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ফিরিয়ে আনা ব্যর্থ হয়েছে: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
      return false;
    }
  };

  const addCatalogMedToPersonal = (
    med: GlobalMedicine,
    config: {
      patientId?: string;
      mealTiming: any;
      schedules: any[];
      stock: number;
      unit: string;
      instructions?: string;
    }
  ): string => {
    let medType: any = 'ট্যাবলেট';
    const formLower = (med.dosageForm || '').toLowerCase();
    if (formLower.includes('ক্যাপসুল') || formLower.includes('capsule')) {
      medType = 'ক্যাপসুল';
    } else if (formLower.includes('সিরাপ') || formLower.includes('syrup') || formLower.includes('suspension')) {
      medType = 'সিরাপ';
    } else if (formLower.includes('ইনজেকশন') || formLower.includes('injection') || formLower.includes('insulin')) {
      medType = 'ইনসুলিন/ইনজেকশন';
    } else if (formLower.includes('ড্রপ') || formLower.includes('drop')) {
      medType = 'চোখের ড্রপ';
    } else if (formLower.includes('ইনহেলার') || formLower.includes('inhaler')) {
      medType = 'ইনহেলার';
    } else if (formLower.includes('মলম') || formLower.includes('জেল') || formLower.includes('cream') || formLower.includes('ointment')) {
      medType = 'মলম/জেল';
    }

    const newMedId = addMedicine({
      brandName: med.brandName,
      genericName: med.genericName,
      type: medType,
      strength: med.strength,
      mealTiming: config.mealTiming || 'খাওয়ার পরে',
      schedules: config.schedules && config.schedules.length > 0 ? config.schedules : [
        { id: `s_${Date.now()}_1`, timeSlot: 'সকাল', time: '০৮:০০ AM', dosage: '১টি' },
        { id: `s_${Date.now()}_2`, timeSlot: 'রাত', time: '০৮:০০ PM', dosage: '১টি' },
      ],
      stock: config.stock || 10,
      minStockAlert: 5,
      unit: config.unit || 'টি',
      startDate: new Date().toISOString().split('T')[0],
      isChronic: false,
      doctorName: '',
      purpose: med.indication || med.therapeuticClass || '',
      instructions: config.instructions || '',
      assignedPatientId: config.patientId || undefined,
      packageDescription: med.packageDescription || undefined,
      catalogMedicineId: med.id,
      status: 'active',
      colorTag: 'teal',
    });

    closeAddToPersonalModal();
    return newMedId;
  };

  // =========================================================================
  // পরিবারের যত্নকারী (Caregiver Mode) — লজিক, ডিভাইস টাইমার ও সিঙ্ক
  // =========================================================================

  const filterAndCleanPatientCaregiverLinks = (links: CaregiverLinkDoc[]): CaregiverLinkDoc[] => {
    const nowMs = Date.now();
    const expiredIds: string[] = [];
    const valid = links.filter((l) => {
      if (l.status === 'active') return true;
      if (l.status === 'pending') {
        const expired = isInviteExpired(l.expiresAtMs, nowMs);
        if (expired && nowMs - (l.expiresAtMs || 0) >= 6 * 60 * 60 * 1000) {
          expiredIds.push(l.id);
        }
        return !expired;
      }
      return false;
    });
    if (expiredIds.length > 0 && !isDeviceOffline() && !isWriteQuotaPaused()) {
      expiredIds.forEach((id) => {
        deleteCaregiverLinkInCloud(id).catch(() => {});
      });
    }
    return valid;
  };

  const refreshCaregiverLinks = async () => {
    if (!currentUser) {
      setPatientCaregiverLinks([]);
      setCaringForLinks([]);
      setCaregiverError(null);
      return;
    }
    lastCaregiverRefreshAtRef.current = Date.now();
    setIsCaregiverLoading(true);
    setCaregiverError(null);
    try {
      const [myCaregivers, caringFor] = await Promise.all([
        fetchPatientCaregiverLinks(currentUser.uid),
        fetchCaregiverPatientsLinks(currentUser.uid),
      ]);
      setPatientCaregiverLinks(filterAndCleanPatientCaregiverLinks(myCaregivers));
      setCaringForLinks(caringFor);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
        setCaregiverError(getFriendlyErrorMessage(err));
      } else {
        console.warn('refreshCaregiverLinks warning:', err);
      }
    } finally {
      setIsCaregiverLoading(false);
    }
  };

  // Initial lightweight fetch (2 reads total, NO polling) + single bounded alerts listener + single pending suggestions listener
  useEffect(() => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) {
      setPatientCaregiverLinks([]);
      setCaringForLinks([]);
      setCaregiverAlerts([]);
      setFailedCaregiverAlerts([]);
      setPendingPatientSuggestions([]);
      setSentCaregiverSuggestions([]);
      setCaregiverError(null);
      lastSyncedLinkSigRef.current = {};
      return;
    }

    const uid = currentUser.uid;
    setFailedCaregiverAlerts(loadPendingFamilyAlerts(uid));
    playedSuggestionIdsRef.current = loadAnnouncedSuggestionIds(uid);
    try {
      const savedSigsRaw = localStorage.getItem(`shasthobondhu_caregiver_link_sig_${uid}`);
      if (savedSigsRaw) {
        lastSyncedLinkSigRef.current = JSON.parse(savedSigsRaw);
      }
    } catch {
      // ignore storage read failure
    }

    let cancelled = false;

    const initCaregiverData = async () => {
      lastCaregiverRefreshAtRef.current = Date.now();
      setIsCaregiverLoading(true);
      try {
        const [myCaregivers, caringFor] = await Promise.all([
          fetchPatientCaregiverLinks(uid),
          fetchCaregiverPatientsLinks(uid),
        ]);
        if (cancelled) return;
        const validPatientLinks = filterAndCleanPatientCaregiverLinks(myCaregivers);
        setPatientCaregiverLinks(validPatientLinks);
        setCaringForLinks(caringFor);

        // Best-effort cleanup of alerts older than 30 days (at most once per day, skipped for solo users with no caregivers)
        const cleanupKey = `shasthobondhu_alert_cleanup_date_${uid}`;
        const todayIso = toLocalIsoDate(new Date());
        const lastCleanedDate =
          typeof window !== 'undefined' ? localStorage.getItem(cleanupKey) : null;
        if (
          validPatientLinks.length > 0 &&
          lastCleanedDate !== todayIso &&
          !isDeviceOffline() &&
          !isWriteQuotaPaused()
        ) {
          cleanupOldFamilyAlertsInCloud(uid, ALERT_RETENTION_MS).then(() => {
            try {
              localStorage.setItem(cleanupKey, todayIso);
            } catch {
              // ignore storage error
            }
          });
        }
      } catch (err) {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        } else {
          console.warn('initCaregiverData warning:', err);
        }
      } finally {
        if (!cancelled) setIsCaregiverLoading(false);
      }
    };

    initCaregiverData();

    const unsubAlerts = subscribeToCaregiverAlerts(
      uid,
      (alerts) => {
        if (cancelled) return;
        setCaregiverAlerts(alerts);

        // Play subtle alert tone once per unseen incoming alert
        const unseen = alerts.filter((a) => !Array.isArray(a.seenBy) || !a.seenBy.includes(uid));
        const hasNewUnseen = unseen.some((a) => !playedAlertSoundIdsRef.current.has(a.id));
        if (hasNewUnseen) {
          unseen.forEach((a) => playedAlertSoundIdsRef.current.add(a.id));
          if (settings.soundEnabled !== false) {
            playAlertTone('gentle-pulse');
          }
        }
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        } else {
          console.warn('subscribeToCaregiverAlerts notice:', err);
        }
      }
    );

    const unsubSuggestions = subscribeToPatientPendingSuggestions(
      uid,
      (suggestions) => {
        if (cancelled) return;
        const visible = filterVisiblePendingSuggestions(suggestions, Date.now());
        setPendingPatientSuggestions(visible);

        const newlyArrived = visible.filter((s) => !playedSuggestionIdsRef.current.has(s.id));
        if (newlyArrived.length > 0) {
          const newIds = newlyArrived.map((s) => s.id);
          newIds.forEach((id) => playedSuggestionIdsRef.current.add(id));
          markSuggestionsAnnounced(uid, newIds);
          if (settings.soundEnabled !== false) {
            playAlertTone('gentle-pulse');
          }
          showToast(
            `${newlyArrived[0].caregiverName || 'পরিবার'} থেকে নতুন ওষুধের প্রস্তাব এসেছে`,
            'info'
          );
        }
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
        } else {
          console.warn('subscribeToPatientPendingSuggestions notice:', err);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubAlerts();
      unsubSuggestions();
    };
  }, [currentUser, migrationReadyUid]);

  // Helper to send or queue family alerts safely (never drops on offline/quota)
  const flushFamilyAlertsToCloud = async (uid: string, candidates: FamilyAlertDoc[]) => {
    const queued = loadPendingFamilyAlerts(uid);
    const mergedMap = new Map<string, FamilyAlertDoc>();
    for (const q of queued) mergedMap.set(q.id, q);
    for (const c of candidates) mergedMap.set(c.id, c);
    const allToSend = Array.from(mergedMap.values());
    if (allToSend.length === 0) return;

    if (isDeviceOffline() || isWriteQuotaPaused()) {
      const updatedQueue = enqueuePendingFamilyAlerts(uid, allToSend);
      setFailedCaregiverAlerts(updatedQueue);
      if (isWriteQuotaPaused()) {
        notifyQuotaExceededOnce();
      } else if (!caregiverFailureNotifiedRef.current) {
        caregiverFailureNotifiedRef.current = true;
        showToast('যত্নকারীকে এখনই জানানো যায়নি (ইন্টারনেট নেই)', 'alert');
      }
      return;
    }

    let hadFailure = false;
    for (const alertDoc of allToSend) {
      try {
        await createFamilyAlertInCloud(alertDoc);
        markFamilyAlertSentLocally(uid, alertDoc.id);
        const remaining = removePendingFamilyAlert(uid, alertDoc.id);
        setFailedCaregiverAlerts(remaining);
      } catch (err) {
        hadFailure = true;
        const updatedQueue = enqueuePendingFamilyAlerts(uid, [alertDoc]);
        setFailedCaregiverAlerts(updatedQueue);
        if (isQuotaExceededError(err)) {
          notifyQuotaExceededOnce();
          break;
        }
      }
    }

    if (hadFailure && !caregiverFailureNotifiedRef.current) {
      caregiverFailureNotifiedRef.current = true;
      showToast('যত্নকারীকে এখনই জানানো যায়নি', 'alert');
    } else if (!hadFailure) {
      caregiverFailureNotifiedRef.current = false;
    }
  };

  // Device timer for missed dose & low-stock alerts + privacy-scoped summary sync
  useEffect(() => {
    if (caregiverEvalTimerRef.current) {
      clearTimeout(caregiverEvalTimerRef.current);
      caregiverEvalTimerRef.current = null;
    }

    if (!currentUser || migrationReadyUid !== currentUser.uid) return;
    const uid = currentUser.uid;
    const activeLinks = patientCaregiverLinks.filter((l) => l.status === 'active');
    if (activeLinks.length === 0) return;

    let cancelled = false;

    const runCaregiverEvaluation = async () => {
      if (cancelled) return;
      if (caregiverEvalTimerRef.current) {
        clearTimeout(caregiverEvalTimerRef.current);
        caregiverEvalTimerRef.current = null;
      }

      const resolvedPatient = patients.find((p) => p.id === activePatientId) || patients[0] || null;
      const patientName = (
        resolvedPatient?.name?.trim() ||
        currentUser.displayName?.trim() ||
        'পরিবারের সদস্য'
      ).slice(0, 128);
      const patientPhone =
        cleanPhoneForLinks(settings.patientSelfPhone).slice(0, 32) || undefined;
      const sentIds = loadSentFamilyAlertIds(uid);

      const evaluation = evaluateCaregiverTriggers({
        patientUid: uid,
        patientName,
        patientPhone,
        medicines,
        doseLogs,
        activeLinks,
        thresholdMinutes: settings.caregiverMissedDoseMinutes || 30,
        sentAlertIds: sentIds,
        now: new Date(),
      });

      // 1. Send new alerts + retry any queued offline/quota alerts
      await flushFamilyAlertsToCloud(uid, evaluation.alertsToSend);

      // 2. Sync compact todaySummary (+ sharedMedicines ONLY if allowFullView === true) ONLY when changed
      if (!isDeviceOffline() && !isWriteQuotaPaused()) {
        for (const link of activeLinks) {
          const scopedShared = link.allowFullView ? evaluation.sharedMedicines : [];
          const summaryComparable = {
            date: evaluation.todaySummary.date,
            totalDoses: evaluation.todaySummary.totalDoses,
            takenDoses: evaluation.todaySummary.takenDoses,
            remainingDoses: evaluation.todaySummary.remainingDoses,
            doses: evaluation.todaySummary.doses,
          };
          const sig = JSON.stringify({
            patientName,
            patientPhone: patientPhone || '',
            allowFullView: Boolean(link.allowFullView),
            summaryComparable,
            scopedShared,
          });
          if (lastSyncedLinkSigRef.current[link.id] !== sig) {
            try {
              await updateCaregiverLinkInCloud(link.id, {
                patientName,
                patientPhone,
                todaySummary: evaluation.todaySummary,
                sharedMedicines: scopedShared,
                updatedAt: new Date().toISOString(),
              });
              lastSyncedLinkSigRef.current[link.id] = sig;
              try {
                localStorage.setItem(
                  `shasthobondhu_caregiver_link_sig_${uid}`,
                  JSON.stringify(lastSyncedLinkSigRef.current)
                );
              } catch {
                // ignore storage write failure
              }
            } catch (err) {
              if (isQuotaExceededError(err)) {
                notifyQuotaExceededOnce();
                break;
              }
            }
          }
        }
      }

      // 3. Schedule exact next wake-up timer (device timer only — zero polling)
      if (!cancelled && evaluation.nextCheckDelayMs !== null) {
        const cappedDelay = Math.min(evaluation.nextCheckDelayMs, 60 * 60 * 1000);
        caregiverEvalTimerRef.current = setTimeout(() => {
          runCaregiverEvaluation();
        }, cappedDelay);
      }
    };

    runCaregiverEvaluation();

    const handleVisibilityOrOnline = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runCaregiverEvaluation();
        const hasPendingInvite = patientCaregiverLinks.some((l) => l.status === 'pending');
        if (
          hasPendingInvite &&
          !isDeviceOffline() &&
          Date.now() - lastCaregiverRefreshAtRef.current >= 60_000
        ) {
          refreshCaregiverLinks();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrOnline);
      window.addEventListener('online', handleVisibilityOrOnline);
      document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    }

    return () => {
      cancelled = true;
      if (caregiverEvalTimerRef.current) {
        clearTimeout(caregiverEvalTimerRef.current);
        caregiverEvalTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrOnline);
        window.removeEventListener('online', handleVisibilityOrOnline);
        document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      }
    };
  }, [
    currentUser,
    migrationReadyUid,
    medicines,
    doseLogs,
    patients,
    activePatientId,
    settings.caregiverMissedDoseMinutes,
    settings.patientSelfPhone,
    patientCaregiverLinks,
    isOnline,
  ]);

  const createCaregiverInvite = async (): Promise<CaregiverLinkDoc | null> => {
    setCaregiverError(null);
    if (!currentUser) {
      const msg = 'আমন্ত্রণ কোড তৈরি করতে আগে লগইন করুন';
      setCaregiverError(msg);
      showToast(msg, 'alert');
      openAuthModal();
      return null;
    }
    const activeLinks = patientCaregiverLinks.filter((l) => l.status === 'active');
    if (activeLinks.length >= MAX_CAREGIVERS) {
      const msg = 'সর্বোচ্চ ৩ জন যত্নকারী যুক্ত করা যায়';
      setCaregiverError(msg);
      showToast(msg, 'alert');
      return null;
    }

    const code = generateInviteCode(6);
    const now = new Date();
    const nowIso = now.toISOString();
    const resolvedPatient = patients.find((p) => p.id === activePatientId) || patients[0] || null;
    const patientName = (
      resolvedPatient?.name?.trim() ||
      currentUser.displayName?.trim() ||
      'পরিবারের সদস্য'
    ).slice(0, 128);
    const patientPhone =
      cleanPhoneForLinks(settings.patientSelfPhone).slice(0, 32) || undefined;

    const evalSnapshot = evaluateCaregiverTriggers({
      patientUid: currentUser.uid,
      patientName,
      patientPhone,
      medicines,
      doseLogs,
      activeLinks: [],
      thresholdMinutes: settings.caregiverMissedDoseMinutes || 30,
      now,
    });

    const newInvite: CaregiverLinkDoc = stripUndefined({
      id: code,
      inviteCode: code,
      patientUid: currentUser.uid,
      patientName,
      patientPhone,
      caregiverUid: '',
      caregiverName: '',
      status: 'pending',
      allowFullView: false,
      allowSuggestions: false,
      expiresAtMs: now.getTime() + CAREGIVER_INVITE_TTL_MS,
      createdAt: nowIso,
      updatedAt: nowIso,
      todaySummary: evalSnapshot.todaySummary,
      sharedMedicines: [],
    });

    try {
      await createCaregiverInviteInCloud(newInvite);
      setPatientCaregiverLinks((prev) => [newInvite, ...prev.filter((i) => i.id !== code)]);
      showToast('নতুন আমন্ত্রণ কোড তৈরি হয়েছে (মেয়াদ ৪৮ ঘণ্টা)', 'success');
      return newInvite;
    } catch (err) {
      const friendly = getFriendlyErrorMessage(err);
      setCaregiverError(friendly);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(friendly, 'alert');
      }
      return null;
    }
  };

  const redeemCaregiverInvite = async (codeInput: string): Promise<boolean> => {
    setCaregiverError(null);
    if (!currentUser) {
      const msg = 'কোড ব্যবহার করতে আগে লগইন করুন';
      setCaregiverError(msg);
      showToast(msg, 'alert');
      openAuthModal();
      return false;
    }
    const cleanCode = normalizeInviteCodeInput(codeInput);
    if (!isValidInviteCode(cleanCode)) {
      const msg = 'অনুগ্রহ করে সঠিক ৬ অক্ষরের কোড লিখুন';
      setCaregiverError(msg);
      showToast(msg, 'alert');
      return false;
    }

    const caregiverName = (
      currentUser.displayName?.trim() ||
      currentUser.email?.split('@')[0]?.trim() ||
      'পরিবারের যত্নকারী'
    ).slice(0, 128);

    try {
      const linkedDoc = await redeemCaregiverInviteInCloud(
        cleanCode,
        currentUser.uid,
        caregiverName
      );
      setCaringForLinks((prev) => [linkedDoc, ...prev.filter((l) => l.id !== linkedDoc.id)]);
      showToast(`"${linkedDoc.patientName}"-এর যত্নকারী হিসেবে যুক্ত হয়েছেন ✓`, 'success');
      return true;
    } catch (err: any) {
      const friendly = isQuotaExceededError(err)
        ? getFriendlyErrorMessage(err)
        : err?.message || getFriendlyErrorMessage(err);
      setCaregiverError(friendly);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(friendly, 'alert');
      }
      return false;
    }
  };

  const removeCaregiverLink = async (linkId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      await deleteCaregiverLinkInCloud(linkId);
      setPatientCaregiverLinks((prev) => prev.filter((l) => l.id !== linkId));
      setCaringForLinks((prev) => prev.filter((l) => l.id !== linkId));
      delete lastSyncedLinkSigRef.current[linkId];
      showToast('যত্নকারী সংযোগ সরানো হয়েছে', 'info');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(getFriendlyErrorMessage(err), 'alert');
      }
    }
  };

  const toggleCaregiverFullView = async (
    linkId: string,
    allowFullView: boolean
  ): Promise<void> => {
    if (!currentUser) return;
    const resolvedPatient = patients.find((p) => p.id === activePatientId) || patients[0] || null;
    const patientName = (
      resolvedPatient?.name?.trim() ||
      currentUser.displayName?.trim() ||
      'পরিবারের সদস্য'
    ).slice(0, 128);
    const patientPhone =
      cleanPhoneForLinks(settings.patientSelfPhone).slice(0, 32) || undefined;
    const evalSnapshot = evaluateCaregiverTriggers({
      patientUid: currentUser.uid,
      patientName,
      patientPhone,
      medicines,
      doseLogs,
      activeLinks: [],
      thresholdMinutes: settings.caregiverMissedDoseMinutes || 30,
      now: new Date(),
    });
    const nextShared = allowFullView ? evalSnapshot.sharedMedicines : [];
    const nowIso = new Date().toISOString();

    try {
      await updateCaregiverLinkInCloud(linkId, {
        allowFullView,
        sharedMedicines: nextShared,
        updatedAt: nowIso,
      });
      setPatientCaregiverLinks((prev) =>
        prev.map((l) =>
          l.id === linkId
            ? { ...l, allowFullView, sharedMedicines: nextShared, updatedAt: nowIso }
            : l
        )
      );
      showToast(
        allowFullView
          ? 'সব ওষুধ ও স্টক দেখার অনুমতি চালু হয়েছে'
          : 'শুধু আজকের ডোজ ও সতর্কতা দেখানোর মোড চালু হয়েছে',
        'success'
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(getFriendlyErrorMessage(err), 'alert');
      }
    }
  };

  const toggleCaregiverSuggestions = async (
    linkId: string,
    allowSuggestions: boolean
  ): Promise<void> => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    try {
      await updateCaregiverLinkInCloud(linkId, {
        allowSuggestions,
        updatedAt: nowIso,
      });
      setPatientCaregiverLinks((prev) =>
        prev.map((l) =>
          l.id === linkId ? { ...l, allowSuggestions, updatedAt: nowIso } : l
        )
      );
      showToast(
        allowSuggestions
          ? 'ওষুধের প্রস্তাব পাঠানোর অনুমতি চালু হয়েছে (আপনার অনুমোদন ছাড়া কিছু বদলাবে না)'
          : 'ওষুধের প্রস্তাব পাঠানোর অনুমতি বন্ধ করা হয়েছে',
        'success'
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(getFriendlyErrorMessage(err), 'alert');
      }
    }
  };

  const loadCaregiverSentSuggestions = async (): Promise<void> => {
    if (!currentUser) {
      setSentCaregiverSuggestions([]);
      return;
    }
    setIsLoadingSentSuggestions(true);
    try {
      const items = await fetchCaregiverSentSuggestions(currentUser.uid);
      setSentCaregiverSuggestions(items);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('loadCaregiverSentSuggestions warning:', err);
      }
    } finally {
      setIsLoadingSentSuggestions(false);
    }
  };

  const sendCaregiverSuggestion = async (
    link: CaregiverLinkDoc,
    input: CaregiverSuggestionFormInput
  ): Promise<CaregiverSuggestionDoc | null> => {
    if (!currentUser) {
      showToast('প্রস্তাব পাঠাতে আগে লগইন করুন', 'alert');
      openAuthModal();
      return null;
    }
    if (link.status !== 'active' || !link.allowSuggestions) {
      showToast('রোগী এখনো ওষুধের প্রস্তাব পাঠানোর অনুমতি চালু করেননি', 'alert');
      return null;
    }

    const todayCount = getCaregiverDailySuggestionCount(currentUser.uid, sentCaregiverSuggestions);
    if (todayCount >= MAX_DAILY_CAREGIVER_SUGGESTIONS) {
      showToast(`আজ সর্বোচ্চ ${toBengaliNumber(MAX_DAILY_CAREGIVER_SUGGESTIONS)}টি প্রস্তাব পাঠানো হয়ে গেছে`, 'alert');
      return null;
    }

    const caregiverName = (
      currentUser.displayName ||
      link.caregiverName ||
      currentUser.email?.split('@')[0] ||
      'পরিবারের যত্নকারী'
    ).trim();

    try {
      const built = buildCaregiverSuggestionPayload({
        link,
        caregiverUid: currentUser.uid,
        caregiverName,
        input,
      });
      const created = await createCaregiverSuggestionInCloud(built);
      incrementCaregiverDailySuggestionCount(currentUser.uid);
      setSentCaregiverSuggestions((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      showToast('রোগীর কাছে প্রস্তাব পাঠানো হয়েছে ✓', 'success');
      return created;
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(err?.message || getFriendlyErrorMessage(err), 'alert');
      }
      return null;
    }
  };

  const acceptCaregiverSuggestion = async (
    suggestion: CaregiverSuggestionDoc,
    edited?: Partial<CaregiverSuggestedMedicinePayload> & { assignedPatientId?: string }
  ): Promise<boolean> => {
    if (!currentUser || currentUser.uid !== suggestion.patientUid) {
      showToast('প্রস্তাব অনুমোদন করতে রোগীর অ্যাকাউন্টে লগইন থাকতে হবে', 'alert');
      return false;
    }
    if (isDeviceOffline()) {
      showToast('প্রস্তাব অনুমোদন করতে ইন্টারনেট সংযোগ চালু করুন', 'alert');
      return false;
    }

    try {
      await updateCaregiverSuggestionStatusInCloud(suggestion.id, 'accepted');
      setPendingPatientSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      const target = findTargetMedicineForSuggestion(medicines, suggestion);
      const assignedPid =
        edited?.assignedPatientId ??
        target?.assignedPatientId ??
        activePatientId ??
        patients[0]?.id ??
        undefined;

      if (suggestion.kind === 'stop') {
        if (target) {
          updateMedicine(target.id, { status: 'paused' });
          showToast(`"${target.brandName}" ওষুধটি বন্ধ (বিরতি) করা হয়েছে ✓`, 'success');
        } else {
          showToast('প্রস্তাবটি অনুমোদিত হয়েছে (সংশ্লিষ্ট ওষুধটি ইতিমধ্যে তালিকায় নেই)', 'info');
        }
        return true;
      }

      const medInput = buildMedicineInputFromSuggestion({
        suggestion,
        edited,
        assignedPatientId: assignedPid,
      });

      if (suggestion.kind === 'edit' && target) {
        updateMedicine(target.id, medInput);
        showToast(`"${medInput.brandName}" হালনাগাদ ও রিমাইন্ডার সেট হয়েছে ✓`, 'success');
      } else {
        addMedicine(medInput);
        showToast(`"${medInput.brandName}" আপনার তালিকায় যুক্ত হয়েছে ✓`, 'success');
      }
      return true;
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(err?.message || getFriendlyErrorMessage(err), 'alert');
      }
      return false;
    }
  };

  const rejectCaregiverSuggestion = async (suggestionId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await updateCaregiverSuggestionStatusInCloud(suggestionId, 'rejected');
      setPendingPatientSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      showToast('প্রস্তাবটি বাতিল করা হয়েছে', 'info');
      return true;
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(err?.message || getFriendlyErrorMessage(err), 'alert');
      }
      return false;
    }
  };

  const cancelCaregiverSuggestion = async (suggestionId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await updateCaregiverSuggestionStatusInCloud(suggestionId, 'cancelled');
      setSentCaregiverSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? { ...s, status: 'cancelled' } : s))
      );
      showToast('আপনার প্রস্তাব প্রত্যাহার করা হয়েছে', 'info');
      return true;
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(err?.message || getFriendlyErrorMessage(err), 'alert');
      }
      return false;
    }
  };

  const markFamilyAlertSeen = async (alertId: string): Promise<void> => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    setCaregiverAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, seenBy: a.seenBy.includes(uid) ? a.seenBy : [...a.seenBy, uid] }
          : a
      )
    );
    try {
      await markFamilyAlertSeenInCloud(alertId, uid);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(getFriendlyErrorMessage(err), 'alert');
      }
    }
  };

  const retryFailedCaregiverAlerts = async (): Promise<void> => {
    if (!currentUser) return;
    caregiverFailureNotifiedRef.current = false;
    await flushFamilyAlertsToCloud(currentUser.uid, []);
  };

  const dismissFailedCaregiverAlert = (alertId: string) => {
    if (!currentUser) return;
    const remaining = removePendingFamilyAlert(currentUser.uid, alertId);
    setFailedCaregiverAlerts(remaining);
  };

  return (
    <MedicineContext.Provider
      value={{
        medicines,
        doseLogs,
        patients,
        activePatientId,
        activePatient,
        setActivePatientId,
        settings,
        updateSettings,
        currentPage,
        setCurrentPage,
        selectedMedicineIdForDetail,
        setSelectedMedicineIdForDetail,
        markDose,
        addMedicine,
        addMultipleMedicines,
        updateMedicine,
        deleteMedicine,
        adjustStock,
        assignMedicineToPatient,
        addPatient,
        updatePatient,
        deletePatient,
        archivePatient,
        unarchivePatient,
        isProfileModalOpen,
        editingPatient,
        openCreateProfileModal,
        openEditProfileModal,
        closeProfileModal,
        resetAllData,
        toast,
        showToast,
        currentUser,
        isAuthLoading,
        isCloudConnected,
        isSyncing,
        syncStatus,
        isQuotaExceeded,
        pendingSyncCount,
        lastSyncedAt,
        triggerManualSync,
        pendingSyncPreview,
        confirmManualSync,
        cancelManualSync,
        downloadLocalBackup,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signOutUser,
        syncLocalToCloud,
        isDataConflictModalOpen,
        conflictInfo,
        resolveDataConflict,
        isResetConfirmationModalOpen,
        openResetConfirmationModal,
        closeResetConfirmationModal,
        confirmResetAllData,
        globalMedicines,
        libraryVersion,
        importBatches,
        isAdmin,
        adminEmail: ADMIN_EMAIL,
        lastSyncTime,
        isOnline,
        isGlobalFromCache,
        latestLibraryNotice,
        dismissLibraryNotice,
        cloudStats,
        refreshCloudCounts,
        migrateLegacyLibraryAction,
        selectedGlobalMedForDetail,
        setSelectedGlobalMedForDetail,
        isAddToPersonalModalOpen,
        catalogMedToAddToPersonal,
        openAddToPersonalModal,
        closeAddToPersonalModal,
        publishGlobalMedicineAction,
        bulkPublishGlobalMedicinesAction,
        deleteGlobalMedicineAction,
        bulkDeleteGlobalMedicinesAction,
        isManualAddModalOpen,
        editingGlobalMedicine,
        openManualAddModal,
        openEditGlobalMedicineModal,
        closeManualAddModal,
        addSingleGlobalMedicineAction,
        updateSingleGlobalMedicineAction,
        bulkUpdateGlobalMedicinesAction,
        adminDeleteGlobalMedicinesAction,
        restoreDeletedGlobalMedicinesAction,
        executeAdminBatchImport,
        pendingPublishMedicines,
        pendingPublishBatches,
        pendingPublishLastRetryAttemptMs,
        isRetryingPendingPublish,
        retryPendingPublishNow,
        cancelPendingPublishItem,
        clearPendingPublishQueue,
        addCatalogMedToPersonal,
        stockPredictions,
        adjustMedicineStock,
        stockAdjustmentModalMedId,
        openStockAdjustmentModal,
        closeStockAdjustmentModal,
        healthRecords,
        addHealthRecord,
        deleteHealthRecord,
        isLoadingHealthRecords,
        hasMoreOlderHealthRecords,
        loadHealthRecords,
        appointments,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        pastAppointmentsLoaded,
        isLoadingPastAppointments,
        loadPastAppointments,
        doctors,
        isLoadingDoctors,
        loadDoctors,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        medicalDocuments,
        isLoadingMedicalDocuments,
        pendingDocIds,
        totalUsedDocumentPages,
        loadMedicalDocuments,
        saveMedicalDocument,
        rotateMedicalDocumentPage,
        deleteMedicalDocument,
        loadDocumentPageImage,
        unlinkOrDeleteDoctorPrescriptions,
        olderDoseLogsLoaded,
        isLoadingOlderDoseLogs,
        loadOlderDoseLogs,
        patientCaregiverLinks,
        caringForLinks,
        caregiverAlerts,
        failedCaregiverAlerts,
        isCaregiverLoading,
        caregiverError,
        clearCaregiverError,
        refreshCaregiverLinks,
        createCaregiverInvite,
        redeemCaregiverInvite,
        removeCaregiverLink,
        toggleCaregiverFullView,
        toggleCaregiverSuggestions,
        markFamilyAlertSeen,
        retryFailedCaregiverAlerts,
        dismissFailedCaregiverAlert,
        pendingPatientSuggestions,
        sentCaregiverSuggestions,
        isLoadingSentSuggestions,
        sendCaregiverSuggestion,
        loadCaregiverSentSuggestions,
        acceptCaregiverSuggestion,
        rejectCaregiverSuggestion,
        cancelCaregiverSuggestion,
      }}
    >
      {children}
    </MedicineContext.Provider>
  );
};

export const useMedicine = () => {
  const context = useContext(MedicineContext);
  if (!context) {
    throw new Error('useMedicine must be used within a MedicineProvider');
  }
  return context;
};
