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
  FamilyAlertDoc,
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
import { auth, db, testFirestoreConnection, stripUndefined } from '../firebase/config';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
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
} from '../firebase/services';
import {
  getFriendlyErrorMessage,
  isQuotaExceededError,
  consumeQuotaExceededNoticeOnce,
  QUOTA_EXCEEDED_BN_MSG,
} from '../firebase/errors';
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
import { toLocalIsoDate } from '../utils/shoppingListCalculator';


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

  // Health Records (ধাপ ১)
  healthRecords: HealthRecord[];
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt'>) => string;
  deleteHealthRecord: (id: string) => void;

  // Doctor Appointments (ধাপ ২)
  appointments: DoctorAppointment[];
  addAppointment: (appointment: Omit<DoctorAppointment, 'id' | 'createdAt'>) => string;
  updateAppointment: (id: string, updates: Partial<DoctorAppointment>) => void;
  deleteAppointment: (id: string) => void;
  
  // Firebase Auth & Cloud Sync States
  currentUser: User | null;
  isAuthLoading: boolean;
  isCloudConnected: boolean;
  isSyncing: boolean;
  syncStatus: 'synced' | 'syncing' | 'failed' | 'offline';
  lastSyncedAt: string | null;
  triggerManualSync: () => Promise<void>;
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
  refreshCaregiverLinks: () => Promise<void>;
  createCaregiverInvite: () => Promise<CaregiverLinkDoc | null>;
  redeemCaregiverInvite: (codeInput: string) => Promise<boolean>;
  removeCaregiverLink: (linkId: string) => Promise<void>;
  toggleCaregiverFullView: (linkId: string, allowFullView: boolean) => Promise<void>;
  markFamilyAlertSeen: (alertId: string) => Promise<void>;
  retryFailedCaregiverAlerts: () => Promise<void>;
  dismissFailedCaregiverAlert: (alertId: string) => void;
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
  const [globalMedicines, setGlobalMedicines] = useState<GlobalMedicine[]>(() => {
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
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
  const lastSyncedLinkSigRef = useRef<Record<string, string>>({});
  const caregiverFailureNotifiedRef = useRef<boolean>(false);
  const playedAlertSoundIdsRef = useRef<Set<string>>(new Set());
  const caregiverEvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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

      if (mode === 'dark' || (mode === 'system' && isSystemDark)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
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
  const globalMedicinesRef = useRef<GlobalMedicine[]>(globalMedicines);
  globalMedicinesRef.current = globalMedicines;
  const hasGlobalCatalogRef = useRef<boolean>(globalMedicines.length > 0);
  hasGlobalCatalogRef.current = globalMedicines.length > 0;
  const showToastRef = useRef<((message: string, type?: 'success' | 'info' | 'alert') => void) | null>(null);

  const notifyQuotaExceededOnce = () => {
    setSyncStatus('offline');
    setIsGlobalFromCache(true);
    if (consumeQuotaExceededNoticeOnce()) {
      showToastRef.current?.(QUOTA_EXCEEDED_BN_MSG, 'info');
    }
  };

  // Load IndexedDB cache FIRST, then attach a single-document listener to library_meta/current (1 read per check/update)
  useEffect(() => {
    let cancelled = false;
    let unsubMeta: (() => void) | null = null;

    const initChunkedLibraryListener = async () => {
      const cachedCatalog = await loadLibraryFromIndexedDb();
      if (cancelled) return;

      if (cachedCatalog && cachedCatalog.medicines.length > 0) {
        localLibraryVersionRef.current = cachedCatalog.version;
        setLibraryVersion(cachedCatalog.version);
        setGlobalMedicines(cachedCatalog.medicines);
        globalMedicinesRef.current = cachedCatalog.medicines;
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

          if (!snapshot.exists()) {
            // Never clear cached IndexedDB library if server hasn't populated library_meta/current yet
            return;
          }

          const meta = snapshot.data() as LibraryMetaDoc;
          const needsFetch = shouldFetchChunksForMeta({
            meta,
            localVersion: localLibraryVersionRef.current,
            hasLocalCatalog: globalMedicinesRef.current.length > 0,
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
                  prevPublishedCount: globalMedicinesRef.current.filter((m) => m.status === 'published').length,
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
            setGlobalMedicines(fetchedItems);
            globalMedicinesRef.current = fetchedItems;

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
        setGlobalMedicines(fetchedItems);
        globalMedicinesRef.current = fetchedItems;
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
    const unsubBatches = onSnapshot(
      collection(db, 'import_batches'),
      (snapshot) => {
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
    if (isDeviceOffline()) {
      setSyncStatus('offline');
    } else {
      setSyncStatus(hasPendingWrites ? 'syncing' : 'synced');
    }
    if (!hasPendingWrites && !isDeviceOffline()) {
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

      try {
        setIsSyncing(true);
        setSyncStatus(isDeviceOffline() ? 'offline' : 'syncing');
        const cloudData = await checkUserHasCloudData(uid);
        if (cancelled) return;

        if (cloudData.hasData) {
          // Cloud already has data and phone has user-created local data: prompt user before starting listeners
          setPendingConflictSnapshot(localSnapshot);
          setConflictInfo({
            localMedicinesCount: localSnapshot.medicines.length,
            localPatientsCount: localSnapshot.patients.length,
            cloudMedicinesCount: cloudData.medicinesCount,
            cloudPatientsCount: cloudData.patientsCount,
          });
          setIsDataConflictModalOpen(true);
        } else {
          // Cloud is completely empty: upload local phone data once, THEN allow listeners
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
          } catch (e) {
            console.warn('Migration flag write error:', e);
          }
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

  // Real-time Firestore Listeners for authenticated user (Requirement খ & গ)
  // Attaches ONLY after migrationReadyUid === currentUser.uid.
  // All 6 subcollections follow strict rules:
  // 1) if (snapshot.metadata.fromCache && snapshot.empty) return; (Never wipe local state before server confirms)
  // 2) Server-confirmed (even empty) replaces state with cloud results.
  useEffect(() => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) return;

    const userId = currentUser.uid;

    // 1. Listen to medicines
    const medPath = `users/${userId}/medicines`;
    const unsubMeds = onSnapshot(
      collection(db, 'users', userId, 'medicines'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        const cloudMeds: Medicine[] = [];
        snapshot.forEach((docSnap) => {
          cloudMeds.push(docSnap.data() as Medicine);
        });
        setMedicines(cloudMeds);
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${medPath}):`, error.message);
      }
    );

    // 2. Listen to patients
    const patientPath = `users/${userId}/patients`;
    const unsubPatients = onSnapshot(
      collection(db, 'users', userId, 'patients'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        const cloudPatients: PatientProfile[] = [];
        snapshot.forEach((docSnap) => {
          cloudPatients.push(docSnap.data() as PatientProfile);
        });
        setPatients(cloudPatients);
        if (cloudPatients.length > 0) {
          setActivePatientId((prevActive) =>
            prevActive && cloudPatients.some((p) => p.id === prevActive) ? prevActive : cloudPatients[0].id
          );
        } else {
          setActivePatientId(null);
        }
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${patientPath}):`, error.message);
      }
    );

    // 3. Listen to doseLogs
    const logPath = `users/${userId}/doseLogs`;
    const unsubLogs = onSnapshot(
      collection(db, 'users', userId, 'doseLogs'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        const cloudLogs: DoseLog[] = [];
        snapshot.forEach((docSnap) => {
          cloudLogs.push(docSnap.data() as DoseLog);
        });
        setDoseLogs(cloudLogs);
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

    // 4. Listen to healthRecords
    const healthPath = `users/${userId}/healthRecords`;
    const unsubHealth = onSnapshot(
      collection(db, 'users', userId, 'healthRecords'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        const cloudHR: HealthRecord[] = [];
        snapshot.forEach((docSnap) => {
          cloudHR.push(docSnap.data() as HealthRecord);
        });
        setHealthRecords(cloudHR);
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${healthPath}):`, error.message);
      }
    );

    // 5. Listen to appointments
    const aptPath = `users/${userId}/appointments`;
    const unsubApts = onSnapshot(
      collection(db, 'users', userId, 'appointments'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        const cloudApts: DoctorAppointment[] = [];
        snapshot.forEach((docSnap) => {
          cloudApts.push(docSnap.data() as DoctorAppointment);
        });
        setAppointments(cloudApts);
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${aptPath}):`, error.message);
      }
    );

    // 6. Listen to settings
    const settingsPath = `users/${userId}/settings`;
    const unsubSettings = onSnapshot(
      collection(db, 'users', userId, 'settings'),
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) return;
        snapshot.forEach((docSnap) => {
          if (docSnap.id === 'preferences') {
            const cloudSettings = docSnap.data() as ReminderSettings;
            setSettings((prev) => ({ ...prev, ...cloudSettings }));
          }
        });
        updateLiveSyncTime(snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceededOnce();
          return;
        }
        setSyncStatus('failed');
        console.warn(`Firestore listener notice (${settingsPath}):`, error.message);
      }
    );

    return () => {
      unsubMeds();
      unsubPatients();
      unsubLogs();
      unsubHealth();
      unsubApts();
      unsubSettings();
    };
  }, [currentUser, migrationReadyUid]);

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
    clearAllNativeReminders();
    await logOut();
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
        updateLiveSyncTime(false);
        showToast(`ফোনের আগের ডেটা ক্লাউডে সফলভাবে যোগ (Merge) হয়েছে (${res.medicinesCount}টি ওষুধ)`, 'success');
      } else {
        localStorage.setItem(migrationKey, 'true');
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
    try {
      setIsSyncing(true);
      setSyncStatus(isDeviceOffline() ? 'offline' : 'syncing');
      const res = await migrateLocalDataToCloud(
        uid,
        medicines,
        patients,
        doseLogs,
        settings,
        healthRecords,
        appointments
      );
      try {
        localStorage.setItem(`shasthobondhu_migrated_${uid}`, 'true');
      } catch (e) {
        console.warn('Migration flag write error:', e);
      }
      setMigrationReadyUid(uid);
      updateLiveSyncTime(false);
      showToast(
        `ক্লাউড সিঙ্ক সফল! ${res.medicinesCount}টি ওষুধ ও ${res.patientsCount}টি প্রোফাইল ক্লাউডে সংরক্ষিত`,
        'success'
      );
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

  const syncLocalToCloud = triggerManualSync;

  const activePatient: PatientProfile | null =
    (activePatientId ? patients.find((p) => p.id === activePatientId) : null) ||
    (patients.filter((p) => !p.isArchived).length > 0 ? patients.filter((p) => !p.isArchived)[0] : (patients.length > 0 ? patients[0] : null));

  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    const prevSettings = settings;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('সেটিংস অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveSettingsToCloud(currentUser.uid, updated)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('সেটিংস ক্লাউডে হালনাগাদ করা হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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

    const newLog: DoseLog = {
      id: `log-${Date.now()}`,
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
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline && feedbackMsg) {
        showToast(`${feedbackMsg} (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }

      const writePromises: Promise<void>[] = [saveDoseLogToCloud(currentUser.uid, newLog)];
      if (updatedMed) {
        writePromises.push(saveMedicineToCloud(currentUser.uid, updatedMed));
      }

      Promise.all(writePromises)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline && feedbackMsg) {
            showToast(feedbackMsg, feedbackType);
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const newId = `med-${Date.now()}`;
    const newMedicine: Medicine = stripUndefined({
      ...medicineData,
      id: newId,
    });
    const prevMeds = medicines;
    setMedicines((prev) => [newMedicine, ...prev]);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${newMedicine.brandName}" অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveMedicineToCloud(currentUser.uid, newMedicine)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${newMedicine.brandName}" ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
            notifyQuotaExceededOnce();
            return;
          }
          setMedicines(prevMeds);
          setSyncStatus('failed');
          showToast(`ক্লাউডে সংরক্ষণ হয়নি, আবার চেষ্টা করুন: ${getFriendlyErrorMessage(err)}`, 'alert');
        });
    } else {
      showToast(`"${newMedicine.brandName}" সফলভাবে তালিকায় যুক্ত হয়েছে`, 'success');
    }

    return newId;
  };

  const updateMedicine = (id: string, updates: Partial<Medicine>) => {
    const prevMeds = medicines;
    const target = medicines.find((m) => m.id === id);
    if (!target) return;
    const updatedObj: Medicine = stripUndefined({ ...target, ...updates });
    setMedicines((prev) => prev.map((m) => (m.id === id ? updatedObj : m)));

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('ওষুধের তথ্য অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveMedicineToCloud(currentUser.uid, updatedObj)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('ওষুধের তথ্য ক্লাউডে হালনাগাদ হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${med?.brandName || 'ওষুধ'}" অফলাইনে সরানো হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      deleteMedicineFromCloud(currentUser.uid, id)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${med?.brandName || 'ওষুধ'}" ক্লাউড থেকে সরানো হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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

    const updatedMed: Medicine = {
      ...med,
      stock: sanitizedStock,
      lastStockUpdated: new Date().toISOString(),
      stockAdjustments: [adjustmentRecord, ...(med.stockAdjustments || [])],
    };

    setMedicines((prev) =>
      prev.map((m) => (m.id === medicineId ? updatedMed : m))
    );

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${med.brandName}" স্টক অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveMedicineToCloud(currentUser.uid, updatedMed)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${med.brandName}" এর স্টক ${toBengaliNumber(sanitizedStock)} ${med.unit} এ ক্লাউডে হালনাগাদ করা হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const updatedMed: Medicine = { ...target, assignedPatientId: patientId || undefined };
    setMedicines((prev) => prev.map((m) => (m.id === medicineId ? updatedMed : m)));

    const patient = patients.find((p) => p.id === patientId);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('বরাদ্দ অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveMedicineToCloud(currentUser.uid, updatedMed)
        .then(() => {
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
    const newId = `patient-${Date.now()}`;
    const newPatient: PatientProfile = { ...patientData, id: newId };
    const prevPatients = patients;
    const prevActive = activePatientId;
    setPatients((prev) => [...prev, newPatient]);
    setActivePatientId(newId);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${newPatient.name}" প্রোফাইল অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(currentUser.uid, newPatient)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${newPatient.name}" এর প্রোফাইল ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const targetPatient: PatientProfile = { ...target, ...updates };
    setPatients((prev) => prev.map((p) => (p.id === id ? targetPatient : p)));

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('প্রোফাইল অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      savePatientToCloud(currentUser.uid, targetPatient)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('প্রোফাইলের তথ্য ক্লাউডে সংরক্ষিত হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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

    const unassignedMeds: Medicine[] = [];
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.assignedPatientId === id) {
          const updated = { ...m, assignedPatientId: undefined };
          unassignedMeds.push(updated);
          return updated;
        }
        return m;
      })
    );

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target?.name || 'প্রোফাইল'}" অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      Promise.all([
        deletePatientFromCloud(currentUser.uid, id),
        ...unassignedMeds.map((m) => saveMedicineToCloud(currentUser.uid, m)),
      ])
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target?.name || 'প্রোফাইল'}" ক্লাউড থেকে মুছে ফেলা হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const nowIso = new Date().toISOString();
    const updated: PatientProfile = { ...target, isArchived: true, archivedAt: nowIso };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));

    if (activePatientId === id) {
      const remainingActive = patients.filter((p) => p.id !== id && !p.isArchived);
      setActivePatientId(remainingActive.length > 0 ? remainingActive[0].id : null);
    }

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target.name}" অফলাইনে আর্কাইভ হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(currentUser.uid, updated)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target.name}" এর প্রোফাইল ক্লাউডে আর্কাইভ করা হয়েছে`, 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const updated: PatientProfile = { ...target, isArchived: false, archivedAt: undefined };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setActivePatientId(id);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`"${target.name}" অফলাইনে পুনরায় সক্রিয় হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      savePatientToCloud(currentUser.uid, updated)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`"${target.name}" এর প্রোফাইল ক্লাউডে পুনরায় সক্রিয় করা হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    }
    setMedicines(initialMedicines);
    setDoseLogs(initialDoseLogs);
    setPatients(initialPatients);
    setActivePatientId(null);
    setSettings(initialSettings);
    setHealthRecords(initialHealthRecords);
    setAppointments(initialAppointments);

    try {
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
    const newId = `hr-${Date.now()}`;
    const newRecord: HealthRecord = {
      ...recordData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    const prevHR = healthRecords;
    setHealthRecords((prev) => [newRecord, ...prev]);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('স্বাস্থ্য পরিমাপ রেকর্ড অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveHealthRecordToCloud(currentUser.uid, newRecord)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('স্বাস্থ্য পরিমাপ রেকর্ড ক্লাউডে সংরক্ষিত হয়েছে', 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('স্বাস্থ্য রেকর্ড অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      deleteHealthRecordFromCloud(currentUser.uid, id)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('স্বাস্থ্য রেকর্ড ক্লাউড থেকে মুছে ফেলা হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const newId = `apt-${Date.now()}`;
    const newApt: DoctorAppointment = {
      ...aptData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    const prevApts = appointments;
    setAppointments((prev) => [newApt, ...prev]);

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast(`ডা. ${newApt.doctorName}-এর অ্যাপয়েন্টমেন্ট অফলাইনে সংরক্ষিত (ইন্টারনেট এলে সিঙ্ক হবে)`, 'info');
      }
      saveAppointmentToCloud(currentUser.uid, newApt)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast(`ডা. ${newApt.doctorName}-এর অ্যাপয়েন্টমেন্ট ক্লাউডে সংরক্ষিত হয়েছে`, 'success');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
    const updatedApt: DoctorAppointment = { ...target, ...updates };
    setAppointments((prev) => prev.map((a) => (a.id === id ? updatedApt : a)));

    if (currentUser) {
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('অ্যাপয়েন্টমেন্ট তথ্য অফলাইনে হালনাগাদ (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      saveAppointmentToCloud(currentUser.uid, updatedApt)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('অ্যাপয়েন্টমেন্ট তথ্য ক্লাউডে হালনাগাদ হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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
      const wasOffline = isDeviceOffline();
      setSyncStatus(wasOffline ? 'offline' : 'syncing');
      if (wasOffline) {
        showToast('অ্যাপয়েন্টমেন্ট অফলাইনে মুছে ফেলা হয়েছে (ইন্টারনেট এলে সিঙ্ক হবে)', 'info');
      }
      deleteAppointmentFromCloud(currentUser.uid, id)
        .then(() => {
          updateLiveSyncTime(false);
          if (!wasOffline) {
            showToast('অ্যাপয়েন্টমেন্ট ক্লাউড থেকে মুছে ফেলা হয়েছে', 'info');
          }
        })
        .catch((err) => {
          if (isQuotaExceededError(err)) {
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

  const openAddToPersonalModal = (med: GlobalMedicine) => {
    setCatalogMedToAddToPersonal(med);
    setIsAddToPersonalModalOpen(true);
  };

  const closeAddToPersonalModal = () => {
    setIsAddToPersonalModalOpen(false);
    setCatalogMedToAddToPersonal(null);
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
    setGlobalMedicines(nextList);
    globalMedicinesRef.current = nextList;
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
        globalMedicines,
        localLibraryVersionRef.current
      );

      if (res.mergedMedicines.length > 0) {
        localLibraryVersionRef.current = res.newVersion;
        setLibraryVersion(res.newVersion);
        setGlobalMedicines(res.mergedMedicines);
        globalMedicinesRef.current = res.mergedMedicines;
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

    // Compare against in-memory catalog ONLY (no Firestore global_medicines reads)
    const catalogDiff = hasCatalogChanges(globalMedicines, validRecordsToCommit);
    if (!catalogDiff.changed) {
      showToast('সব ওষুধ আগেই আছে, নতুন কিছু নেই', 'info');
      return false;
    }

    try {
      const res = await commitUpdatedCatalogChunks(catalogDiff.mergedList, fullBatch);

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
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

    const nextList = globalMedicines.map((m) => (m.id === medicineId ? updatedMed : m));

    try {
      await commitUpdatedCatalogChunks(nextList);

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
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

    const targetIdSet = new Set(targets.map((t) => t.id));
    const nextList: GlobalMedicine[] = globalMedicines.map((med) => {
      if (!targetIdSet.has(med.id)) return med;
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

    try {
      const res = await commitUpdatedCatalogChunks(nextList);

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
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

    const nextList = globalMedicines.filter((m) => m.id !== medicineId);

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
    const nextList = globalMedicines.filter((m) => !safeIdSet.has(m.id));

    try {
      await commitUpdatedCatalogChunks(nextList);

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

    try {
      await commitUpdatedCatalogChunks(diff.mergedList);

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`ক্লাউডে সংরক্ষণ হয়নি: ${getFriendlyErrorMessage(err)}`, 'alert');
      }
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

    const nextList = globalMedicines.map((m) => (m.id === cleanMed.id ? cleanMed : m));

    try {
      await commitUpdatedCatalogChunks(nextList);

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(`সম্পাদনা সংরক্ষণ হয়নি (আগের তালিকা অক্ষত আছে): ${getFriendlyErrorMessage(err)}`, 'alert');
      }
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
    const targetCount = globalMedicines.filter((m) => idSet.has(m.id)).length;
    if (targetCount === 0) return 0;

    const nextList = applyBulkMedicinePatch(globalMedicines, idSet, patch);

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
    const deletedItems = globalMedicines.filter((m) => idSet.has(m.id));
    if (deletedItems.length === 0) {
      const msg = 'নির্বাচিত ওষুধগুলো খুঁজে পাওয়া যায়নি।';
      showToast(msg, 'alert');
      return { success: false, deletedItems: [], errorMessage: msg };
    }

    const nextList = globalMedicines.filter((m) => !idSet.has(m.id));

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

    const nextList = mergeRestoredMedicines(globalMedicines, itemsToRestore);

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

  const refreshCaregiverLinks = async () => {
    if (!currentUser) {
      setPatientCaregiverLinks([]);
      setCaringForLinks([]);
      return;
    }
    setIsCaregiverLoading(true);
    try {
      const [myCaregivers, caringFor] = await Promise.all([
        fetchPatientCaregiverLinks(currentUser.uid),
        fetchCaregiverPatientsLinks(currentUser.uid),
      ]);
      const nowMs = Date.now();
      const validPatientLinks = myCaregivers.filter(
        (l) => l.status === 'active' || (l.status === 'pending' && !isInviteExpired(l.expiresAtMs, nowMs))
      );
      setPatientCaregiverLinks(validPatientLinks);
      setCaringForLinks(caringFor);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        console.warn('refreshCaregiverLinks warning:', err);
      }
    } finally {
      setIsCaregiverLoading(false);
    }
  };

  // Initial lightweight fetch (2 reads total, NO polling) + single bounded alerts listener
  useEffect(() => {
    if (!currentUser || migrationReadyUid !== currentUser.uid) {
      setPatientCaregiverLinks([]);
      setCaringForLinks([]);
      setCaregiverAlerts([]);
      setFailedCaregiverAlerts([]);
      lastSyncedLinkSigRef.current = {};
      return;
    }

    const uid = currentUser.uid;
    setFailedCaregiverAlerts(loadPendingFamilyAlerts(uid));

    let cancelled = false;

    const initCaregiverData = async () => {
      setIsCaregiverLoading(true);
      try {
        const [myCaregivers, caringFor] = await Promise.all([
          fetchPatientCaregiverLinks(uid),
          fetchCaregiverPatientsLinks(uid),
        ]);
        if (cancelled) return;
        const nowMs = Date.now();
        const validPatientLinks = myCaregivers.filter(
          (l) => l.status === 'active' || (l.status === 'pending' && !isInviteExpired(l.expiresAtMs, nowMs))
        );
        setPatientCaregiverLinks(validPatientLinks);
        setCaringForLinks(caringFor);

        // Best-effort cleanup of alerts older than 30 days (at most once per day)
        const cleanupKey = `shasthobondhu_alert_cleanup_date_${uid}`;
        const todayIso = toLocalIsoDate(new Date());
        const lastCleanedDate =
          typeof window !== 'undefined' ? localStorage.getItem(cleanupKey) : null;
        if (lastCleanedDate !== todayIso && !isDeviceOffline()) {
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

    return () => {
      cancelled = true;
      unsubAlerts();
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

    if (isDeviceOffline()) {
      const updatedQueue = enqueuePendingFamilyAlerts(uid, allToSend);
      setFailedCaregiverAlerts(updatedQueue);
      if (!caregiverFailureNotifiedRef.current) {
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
        resolvedPatient?.name ||
        currentUser.displayName ||
        'পরিবারের সদস্য'
      ).trim();
      const patientPhone = cleanPhoneForLinks(settings.patientSelfPhone) || undefined;
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
      if (!isDeviceOffline()) {
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
    if (!currentUser) {
      showToast('আমন্ত্রণ কোড তৈরি করতে আগে লগইন করুন', 'alert');
      openAuthModal();
      return null;
    }
    const activeLinks = patientCaregiverLinks.filter((l) => l.status === 'active');
    if (activeLinks.length >= MAX_CAREGIVERS) {
      showToast('সর্বোচ্চ ৩ জন যত্নকারী যুক্ত করা যায়', 'alert');
      return null;
    }

    const code = generateInviteCode(6);
    const now = new Date();
    const nowIso = now.toISOString();
    const resolvedPatient = patients.find((p) => p.id === activePatientId) || patients[0] || null;
    const patientName = (
      resolvedPatient?.name ||
      currentUser.displayName ||
      'পরিবারের সদস্য'
    ).trim();

    const evalSnapshot = evaluateCaregiverTriggers({
      patientUid: currentUser.uid,
      patientName,
      patientPhone: cleanPhoneForLinks(settings.patientSelfPhone) || undefined,
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
      patientPhone: cleanPhoneForLinks(settings.patientSelfPhone) || undefined,
      caregiverUid: '',
      caregiverName: '',
      status: 'pending',
      allowFullView: false,
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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(getFriendlyErrorMessage(err), 'alert');
      }
      return null;
    }
  };

  const redeemCaregiverInvite = async (codeInput: string): Promise<boolean> => {
    if (!currentUser) {
      showToast('কোড ব্যবহার করতে আগে লগইন করুন', 'alert');
      openAuthModal();
      return false;
    }
    const cleanCode = normalizeInviteCodeInput(codeInput);
    if (!isValidInviteCode(cleanCode)) {
      showToast('অনুগ্রহ করে সঠিক ৬ অক্ষরের কোড লিখুন', 'alert');
      return false;
    }

    const caregiverName = (
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'পরিবারের যত্নকারী'
    ).trim();

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
      if (isQuotaExceededError(err)) {
        notifyQuotaExceededOnce();
      } else {
        showToast(err?.message || getFriendlyErrorMessage(err), 'alert');
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
      resolvedPatient?.name ||
      currentUser.displayName ||
      'পরিবারের সদস্য'
    ).trim();
    const evalSnapshot = evaluateCaregiverTriggers({
      patientUid: currentUser.uid,
      patientName,
      patientPhone: cleanPhoneForLinks(settings.patientSelfPhone) || undefined,
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
        lastSyncedAt,
        triggerManualSync,
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
        addCatalogMedToPersonal,
        stockPredictions,
        adjustMedicineStock,
        stockAdjustmentModalMedId,
        openStockAdjustmentModal,
        closeStockAdjustmentModal,
        healthRecords,
        addHealthRecord,
        deleteHealthRecord,
        appointments,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        patientCaregiverLinks,
        caringForLinks,
        caregiverAlerts,
        failedCaregiverAlerts,
        isCaregiverLoading,
        refreshCaregiverLinks,
        createCaregiverInvite,
        redeemCaregiverInvite,
        removeCaregiverLink,
        toggleCaregiverFullView,
        markFamilyAlertSeen,
        retryFailedCaregiverAlerts,
        dismissFailedCaregiverAlert,
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
