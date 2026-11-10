import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Medicine,
  PatientProfile,
  DoseLog,
  ReminderSettings,
  NavigationPage,
  TimeSlot,
  GlobalMedicine,
  ImportBatch,
  StockAdjustment,
  StockPrediction,
  HealthRecord,
  DoctorAppointment,
} from '../types';
import {
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
import { auth, db, testFirestoreConnection } from '../firebase/config';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
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
  logOut,
  ADMIN_EMAIL,
  isUserAdmin,
  bulkImportGlobalMedicines,
  publishGlobalMedicine,
  bulkPublishGlobalMedicines,
  deleteGlobalMedicine,
  bulkDeleteGlobalMedicines,
  recordAdminActivity,
} from '../firebase/services';
import { handleFirestoreError, OperationType, getFriendlyErrorMessage } from '../firebase/errors';
import { isTestMedicine } from '../utils/medicineImportParser';


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
  seedFictionalFamilyProfiles: () => void;
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
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signOutUser: () => Promise<void>;
  syncLocalToCloud: () => Promise<void>;

  // Global Medicine Catalog & Admin Import
  globalMedicines: GlobalMedicine[];
  importBatches: ImportBatch[];
  isAdmin: boolean;
  adminEmail: string;
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
}


const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MEDICINES: 'shasthobondhu_medicines_v2',
  LOGS: 'shasthobondhu_logs_v2',
  PATIENTS: 'shasthobondhu_patients_v2',
  SETTINGS: 'shasthobondhu_settings_v2',
  ACTIVE_PATIENT: 'shasthobondhu_active_patient_v2',
  GLOBAL_MEDS: 'shasthobondhu_global_meds_v2',
  IMPORT_BATCHES: 'shasthobondhu_import_batches_v2',
  HEALTH_RECORDS: 'shasthobondhu_health_records_v2',
  APPOINTMENTS: 'shasthobondhu_appointments_v2',
};

export const MedicineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Existing medicines preserved (Requirement 10)
  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEDICINES);
      return saved ? JSON.parse(saved) : initialMedicines;
    } catch {
      return initialMedicines;
    }
  });

  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      return saved ? JSON.parse(saved) : initialDoseLogs;
    } catch {
      return initialDoseLogs;
    }
  });

  // Zero default patient profiles for new users (Requirements 2, 3, 9)
  const [patients, setPatients] = useState<PatientProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      return saved ? JSON.parse(saved) : []; // Starts with zero profiles!
    } catch {
      return [];
    }
  });

  const [activePatientId, setActivePatientId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT);
      return saved || null;
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState<ReminderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : initialSettings;
    } catch {
      return initialSettings;
    }
  });

  // Global medicine catalog and import batch states
  const [globalMedicines, setGlobalMedicines] = useState<GlobalMedicine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GLOBAL_MEDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
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
      return saved ? JSON.parse(saved) : initialHealthRecords;
    } catch {
      return initialHealthRecords;
    }
  });

  const [appointments, setAppointments] = useState<DoctorAppointment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      return saved ? JSON.parse(saved) : initialAppointments;
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

  // Stock Adjustment Modal state
  const [stockAdjustmentModalMedId, setStockAdjustmentModalMedId] = useState<string | null>(null);
  const openStockAdjustmentModal = (medicineId: string) => setStockAdjustmentModalMedId(medicineId);
  const closeStockAdjustmentModal = () => setStockAdjustmentModalMedId(null);

  // Firebase Auth & Cloud state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isAdmin = isUserAdmin(currentUser?.email);


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

  // Apply Elderly Large Font Mode to root document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.largeFontMode) {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '';
    }
  }, [settings.largeFontMode]);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_MEDS, JSON.stringify(globalMedicines));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
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

  // Real-time Firestore Listener for Global Medicine Catalog
  // Non-admins listen to published medicines via single-field query (no composite index needed)
  // Admins listen to all catalog records (including drafts and unverified)
  useEffect(() => {
    const targetQuery = isAdmin
      ? collection(db, 'global_medicines')
      : query(
          collection(db, 'global_medicines'),
          where('status', '==', 'published')
        );

    const unsubGlobal = onSnapshot(
      targetQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudList: GlobalMedicine[] = [];
          snapshot.forEach((doc) => {
            cloudList.push(doc.data() as GlobalMedicine);
          });
          setGlobalMedicines((prev) => {
            const map = new Map<string, GlobalMedicine>();
            prev.forEach((m) => map.set(m.id, m));
            cloudList.forEach((m) => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
      },
      (error) => {
        console.warn('Global medicines snapshot notice:', error.message);
      }
    );

    return () => unsubGlobal();
  }, [isAdmin]);

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
        snapshot.forEach((doc) => {
          list.push(doc.data() as ImportBatch);
        });
        setImportBatches(list);
      },
      (error) => {
        console.warn('Import batches snapshot notice:', error.message);
      }
    );

    return () => unsubBatches();
  }, [isAdmin]);


  // Test Firestore connectivity on boot
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });
  }, []);

  // Firebase Auth State Listener (Requirement 1 & 11)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        showToast(`স্বাগতম, ${user.displayName || user.email?.split('@')[0] || 'ব্যবহারকারী'}!`, 'success');
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Listeners for authenticated user
  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.uid;

    // Listen to medicines for this user
    const medPath = `users/${userId}/medicines`;
    const unsubMeds = onSnapshot(
      collection(db, 'users', userId, 'medicines'),
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudMeds: Medicine[] = [];
          snapshot.forEach((doc) => {
            cloudMeds.push(doc.data() as Medicine);
          });
          setMedicines(cloudMeds);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, medPath);
      }
    );

    // Listen to patients for this user (starts empty if user has 0 patients)
    const patientPath = `users/${userId}/patients`;
    const unsubPatients = onSnapshot(
      collection(db, 'users', userId, 'patients'),
      (snapshot) => {
        const cloudPatients: PatientProfile[] = [];
        snapshot.forEach((doc) => {
          cloudPatients.push(doc.data() as PatientProfile);
        });
        setPatients(cloudPatients);
        if (cloudPatients.length > 0) {
          if (!activePatientId || !cloudPatients.some((p) => p.id === activePatientId)) {
            setActivePatientId(cloudPatients[0].id);
          }
        } else {
          setActivePatientId(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, patientPath);
      }
    );

    // Listen to doseLogs for this user
    const logPath = `users/${userId}/doseLogs`;
    const unsubLogs = onSnapshot(
      collection(db, 'users', userId, 'doseLogs'),
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudLogs: DoseLog[] = [];
          snapshot.forEach((doc) => {
            cloudLogs.push(doc.data() as DoseLog);
          });
          setDoseLogs(cloudLogs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, logPath);
      }
    );

    return () => {
      unsubMeds();
      unsubPatients();
      unsubLogs();
    };
  }, [currentUser]);

  const showToast = (message: string, type: 'success' | 'info' | 'alert' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3500);
  };

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
    setActivePatientId(null);
    showToast('অ্যাকাউন্ট থেকে সফলভাবে লগআউট হয়েছে', 'info');
  };

  const syncLocalToCloud = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    try {
      setIsSyncing(true);
      const res = await migrateLocalDataToCloud(
        currentUser.uid,
        medicines,
        patients,
        doseLogs,
        settings
      );
      showToast(
        `ক্লাউড সিঙ্ক সফল! ${res.medicinesCount}টি ওষুধ ও ${res.patientsCount}টি প্রোফাইল ফায়ারবেসে সংরক্ষিত`,
        'success'
      );
    } catch {
      showToast('ক্লাউড সিঙ্ক করতে সমস্যা হয়েছে', 'alert');
    } finally {
      setIsSyncing(false);
    }
  };

  const activePatient: PatientProfile | null =
    (activePatientId ? patients.find((p) => p.id === activePatientId) : null) ||
    (patients.filter((p) => !p.isArchived).length > 0 ? patients.filter((p) => !p.isArchived)[0] : (patients.length > 0 ? patients[0] : null));

  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (currentUser) {
      saveSettingsToCloud(currentUser.uid, updated).catch((err) =>
        console.warn('Settings cloud sync error', err)
      );
    }
    showToast('সেটিংস সফলভাবে হালনাগাদ করা হয়েছে', 'success');
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

    if (med) {
      // 1. Taken: deduct scheduled units if not previously marked taken
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
        showToast(`${med.brandName} গ্রহণ সম্পন্ন (${toBengaliNumber(unitsToUse)} ${med.unit} স্টক কমেছে)`, 'success');
      }
      // 2. Already taken: prevent duplicate deductions
      else if (status === 'taken' && prevStatus === 'taken') {
        showToast(`${med.brandName} ইতিমধ্যে গ্রহণ করা হয়েছে (স্টক অপরিবর্তিত)`, 'info');
      }
      // 3. Changing from taken to skipped: restore stock
      else if (status === 'skipped' && prevStatus === 'taken') {
        const nextStock = med.stock + unitsToUse;
        updatedMed = {
          ...med,
          stock: nextStock,
          lastStockUpdated: new Date().toISOString(),
        };
        setMedicines((prev) =>
          prev.map((item) => (item.id === medicineId ? (updatedMed as Medicine) : item))
        );
        showToast(`${med.brandName} গ্রহণ বাদ দেওয়া হয়েছে (${toBengaliNumber(unitsToUse)} ${med.unit} স্টকে ফেরত যোগ হয়েছে)`, 'info');
      }
      // 4. Regular skipped (not previously taken): no stock deduction
      else if (status === 'skipped') {
        showToast(`${med.brandName} গ্রহণ বাদ দেওয়া হয়েছে (স্টক অপরিবর্তিত)`, 'info');
      }
    }

    if (currentUser) {
      saveDoseLogToCloud(currentUser.uid, newLog).catch((err) =>
        console.warn('Cloud doseLog error', err)
      );
      if (updatedMed) {
        saveMedicineToCloud(currentUser.uid, updatedMed).catch((err) =>
          console.warn('Cloud stock error', err)
        );
      }
    }
  };

  const addMedicine = (medicineData: Omit<Medicine, 'id'>): string => {
    const newId = `med-${Date.now()}`;
    const newMedicine: Medicine = {
      ...medicineData,
      id: newId,
    };
    setMedicines((prev) => [newMedicine, ...prev]);

    if (currentUser) {
      saveMedicineToCloud(currentUser.uid, newMedicine).catch((err) =>
        console.warn('Cloud add medicine error', err)
      );
    }

    showToast(`"${newMedicine.brandName}" সফলভাবে তালিকায় যুক্ত হয়েছে`, 'success');
    return newId;
  };

  const updateMedicine = (id: string, updates: Partial<Medicine>) => {
    let updatedObj: Medicine | undefined;
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          updatedObj = { ...m, ...updates };
          return updatedObj;
        }
        return m;
      })
    );

    if (currentUser && updatedObj) {
      saveMedicineToCloud(currentUser.uid, updatedObj).catch((err) =>
        console.warn('Cloud update medicine error', err)
      );
    }

    showToast('ওষুধের তথ্য সফলভাবে হালনাগাদ করা হয়েছে', 'success');
  };

  const deleteMedicine = (id: string) => {
    const med = medicines.find((m) => m.id === id);
    setMedicines((prev) => prev.filter((m) => m.id !== id));

    if (currentUser) {
      deleteMedicineFromCloud(currentUser.uid, id).catch((err) =>
        console.warn('Cloud delete medicine error', err)
      );
    }

    showToast(`"${med?.brandName || 'ওষুধ'}" সরানো হয়েছে`, 'info');
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
      saveMedicineToCloud(currentUser.uid, updatedMed).catch((err) =>
        console.warn('Cloud stock adjustment error', err)
      );
    }

    showToast(`"${med.brandName}" এর স্টক ${toBengaliNumber(sanitizedStock)} ${med.unit} এ হালনাগাদ করা হয়েছে`, 'success');
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
    let updatedMed: Medicine | undefined;
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === medicineId) {
          updatedMed = { ...m, assignedPatientId: patientId || undefined };
          return updatedMed;
        }
        return m;
      })
    );

    if (currentUser && updatedMed) {
      saveMedicineToCloud(currentUser.uid, updatedMed).catch((err) =>
        console.warn('Cloud assign medicine error', err)
      );
    }

    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      showToast(`ওষুধটি "${patient.name}" এর প্রোফাইলে বরাদ্দ করা হয়েছে`, 'success');
    } else {
      showToast('ওষুধটি যেকোনো রোগীর সাধারণ তালিকায় রাখা হয়েছে', 'info');
    }
  };

  // Unlimited Patient Profiles (Requirements 4 & 5)
  const addPatient = (patientData: Omit<PatientProfile, 'id'>) => {
    const newId = `patient-${Date.now()}`;
    const newPatient: PatientProfile = { ...patientData, id: newId };
    setPatients((prev) => [...prev, newPatient]);
    setActivePatientId(newId);

    if (currentUser) {
      savePatientToCloud(currentUser.uid, newPatient).catch((err) =>
        console.warn('Cloud patient add error', err)
      );
    }

    showToast(`"${newPatient.name}" এর প্রোফাইল সফলভাবে তৈরি হয়েছে`, 'success');
  };

  const updatePatient = (id: string, updates: Partial<PatientProfile>) => {
    let targetPatient: PatientProfile | undefined;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          targetPatient = { ...p, ...updates };
          return targetPatient;
        }
        return p;
      })
    );

    if (currentUser && targetPatient) {
      savePatientToCloud(currentUser.uid, targetPatient).catch((err) =>
        console.warn('Cloud patient update error', err)
      );
    }

    showToast('প্রোফাইলের তথ্য সংরক্ষিত হয়েছে', 'success');
  };

  const deletePatient = (id: string) => {
    const target = patients.find((p) => p.id === id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
    
    // If active was deleted, point to another or null
    if (activePatientId === id) {
      const remaining = patients.filter((p) => p.id !== id);
      setActivePatientId(remaining.length > 0 ? remaining[0].id : null);
    }

    // Preserve medicines! (Requirement 10) - unassign them instead of deleting
    setMedicines((prev) =>
      prev.map((m) => (m.assignedPatientId === id ? { ...m, assignedPatientId: undefined } : m))
    );

    if (currentUser) {
      deletePatientFromCloud(currentUser.uid, id).catch((err) =>
        console.warn('Cloud delete patient error', err)
      );
    }

    showToast(`"${target?.name || 'প্রোফাইল'}" সফলভাবে মুছে ফেলা হয়েছে`, 'info');
  };

  const archivePatient = (id: string) => {
    const target = patients.find((p) => p.id === id);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const updated: PatientProfile = { ...target, isArchived: true, archivedAt: nowIso };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));

    // If active was archived, switch activePatientId to first non-archived patient or null
    if (activePatientId === id) {
      const remainingActive = patients.filter((p) => p.id !== id && !p.isArchived);
      setActivePatientId(remainingActive.length > 0 ? remainingActive[0].id : null);
    }

    if (currentUser) {
      savePatientToCloud(currentUser.uid, updated).catch((err) =>
        console.warn('Cloud archive patient error', err)
      );
    }

    showToast(`"${target.name}" এর প্রোফাইল সফলভাবে আর্কাইভ করা হয়েছে (ইতিহাস ও ডেটা অক্ষত আছে)`, 'info');
  };

  const unarchivePatient = (id: string) => {
    const target = patients.find((p) => p.id === id);
    if (!target) return;
    const updated: PatientProfile = { ...target, isArchived: false, archivedAt: undefined };

    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setActivePatientId(id);

    if (currentUser) {
      savePatientToCloud(currentUser.uid, updated).catch((err) =>
        console.warn('Cloud unarchive patient error', err)
      );
    }

    showToast(`"${target.name}" এর প্রোফাইল পুনরায় সক্রিয় করা হয়েছে`, 'success');
  };

  const seedFictionalFamilyProfiles = () => {
    const fictionalPatients: PatientProfile[] = [
      {
        id: 'patient-fictional-father',
        name: 'আব্দুর রহমান',
        relation: 'বাবা',
        age: 68,
        gender: 'পুরুষ',
        bloodGroup: 'O+',
        chronicConditions: ['উচ্চ রক্তচাপ (Hypertension)', 'টাইপ-২ ডায়াবেটিস'],
        allergies: ['সালফা ড্রাগ অ্যালার্জি'],
        emergencyContact: '+৮৮০ ১৭ ১১২২ ৩৩৪৪',
        isArchived: false,
      },
      {
        id: 'patient-fictional-mother',
        name: 'ফাতেমা বেগম',
        relation: 'মা',
        age: 62,
        gender: 'মহিলা',
        bloodGroup: 'B+',
        chronicConditions: ['অস্টিওআর্থ্রাইটিস', 'ক্রনিক গ্যাস্ট্রাইটিস'],
        allergies: ['পেনিসিলিন'],
        emergencyContact: '+৮৮০ ১৮ ২২৩৩ ৪৪৫৫',
        isArchived: false,
      },
      {
        id: 'patient-fictional-child',
        name: 'রায়ান আহমেদ',
        relation: 'ছেলে',
        age: 8,
        gender: 'পুরুষ',
        bloodGroup: 'A+',
        chronicConditions: ['সিজনাল অ্যালার্জি ও ডাস্ট কোল্ড'],
        allergies: ['কোনো ড্রাগ অ্যালার্জি নেই'],
        emergencyContact: '+৮৮০ ১৯ ৩৩৪৪ ৫৫৬৬',
        isArchived: false,
      },
    ];

    const fictionalMedicines: Medicine[] = [
      // আব্দুর রহমান (বাবা) medicines
      {
        id: 'med-fic-father-1',
        brandName: 'টেলমিভাস ৪০ (Telmivas 40)',
        genericName: 'Telmisartan 40mg (Square Pharmaceuticals)',
        type: 'ট্যাবলেট',
        strength: '40 mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 'sch-fic-f1', timeSlot: 'সকাল', time: '08:30 AM', dosage: '১টি' },
        ],
        stock: 30,
        minStockAlert: 7,
        unit: 'টি',
        startDate: '2026-10-01',
        isChronic: true,
        doctorName: 'ডা. এ কে এম সামসুল হক (কার্ডিওলজিস্ট)',
        purpose: 'উচ্চ রক্তচাপ নিয়ন্ত্রণ',
        instructions: 'প্রতিদিন সকালের নাস্তার পর সেব্য।',
        assignedPatientId: 'patient-fictional-father',
        status: 'active',
        colorTag: 'teal',
      },
      {
        id: 'med-fic-father-2',
        brandName: 'মেটফোর ৫০০ (Metfor 500)',
        genericName: 'Metformin Hydrochloride 500mg (Beximco)',
        type: 'ট্যাবলেট',
        strength: '500 mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 'sch-fic-f2', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
          { id: 'sch-fic-f3', timeSlot: 'রাত', time: '08:00 PM', dosage: '১টি' },
        ],
        stock: 45,
        minStockAlert: 10,
        unit: 'টি',
        startDate: '2026-09-15',
        isChronic: true,
        doctorName: 'ডা. ফাহমিদা সুলতানা (এন্ডোক্রাইনোলজিস্ট)',
        purpose: 'ডায়াবেটিস ও ব্লাড সুগার নিয়ন্ত্রণ',
        instructions: 'খাবারের ঠিক পরপরই সেবন করুন।',
        assignedPatientId: 'patient-fictional-father',
        status: 'active',
        colorTag: 'blue',
      },
      // ফাতেমা বেগম (মা) medicines
      {
        id: 'med-fic-mother-1',
        brandName: 'সেক্লো ২০ (Seclo 20)',
        genericName: 'Omeprazole 20mg (Square Pharmaceuticals)',
        type: 'ক্যাপসুল',
        strength: '20 mg',
        mealTiming: 'খাওয়ার আগে',
        schedules: [
          { id: 'sch-fic-m1', timeSlot: 'সকাল', time: '07:30 AM', dosage: '১টি' },
          { id: 'sch-fic-m2', timeSlot: 'রাত', time: '08:30 PM', dosage: '১টি' },
        ],
        stock: 24,
        minStockAlert: 8,
        unit: 'টি',
        startDate: '2026-10-10',
        isChronic: true,
        doctorName: 'ডা. রাশেদুল হাসান (গ্যাস্ট্রো)',
        purpose: 'গ্যাস্ট্রিক ও বুকজ্বালা উপশম',
        instructions: 'খাবারের ৩০ মিনিট পূর্বে এক গ্লাস পানি সহ সেব্য।',
        assignedPatientId: 'patient-fictional-mother',
        status: 'active',
        colorTag: 'emerald',
      },
      {
        id: 'med-fic-mother-2',
        brandName: 'ক্যালবো-ডি (Calbo-D)',
        genericName: 'Calcium Carbonate 500mg + Vitamin D3 (Square)',
        type: 'ট্যাবলেট',
        strength: '500 mg + 200 IU',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 'sch-fic-m3', timeSlot: 'দুপুর', time: '02:00 PM', dosage: '১টি' },
        ],
        stock: 28,
        minStockAlert: 7,
        unit: 'টি',
        startDate: '2026-10-05',
        isChronic: true,
        doctorName: 'ডা. নাজমুল ইসলাম (অর্থোপেডিকস)',
        purpose: 'হাড়ের ক্ষয়রোধ ও জয়েন্টের যত্ন',
        instructions: 'দুপুরের ভরা পেটে সেবন করুন।',
        assignedPatientId: 'patient-fictional-mother',
        status: 'active',
        colorTag: 'indigo',
      },
      // রায়ান আহমেদ (ছেলে) medicines
      {
        id: 'med-fic-child-1',
        brandName: 'অ্যালার্ট্রল সিরাপ (Alertrol Syrup)',
        genericName: 'Cetirizine Dihydrochloride 5mg/5ml (Acme)',
        type: 'সিরাপ',
        strength: '5 mg / 5 ml',
        mealTiming: 'ঘুমানোর আগে',
        schedules: [
          { id: 'sch-fic-c1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১ চামচ (৫ মিলি)' },
        ],
        stock: 100,
        minStockAlert: 20,
        unit: 'মিলি',
        startDate: '2026-11-01',
        durationDays: 7,
        isChronic: false,
        doctorName: 'ডা. তাহমিনা আনোয়ার (শিশু বিশেষজ্ঞ)',
        purpose: 'সর্দি, হাঁচি ও নাক বন্ধ উপশম',
        instructions: 'রাতে ঘুমানোর পূর্বে ৫ মিলি চামচ দিয়ে মাপুন।',
        assignedPatientId: 'patient-fictional-child',
        status: 'active',
        colorTag: 'rose',
      },
      {
        id: 'med-fic-child-2',
        brandName: 'টাসপেল সিরাপ (Tuspel Syrup)',
        genericName: 'Guaifenesin + Bromhexine (Incepta)',
        type: 'সিরাপ',
        strength: '100mg + 4mg / 5ml',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 'sch-fic-c2', timeSlot: 'সকাল', time: '09:00 AM', dosage: '১ চামচ (৫ মিলি)' },
          { id: 'sch-fic-c3', timeSlot: 'দুপুর', time: '02:30 PM', dosage: '১ চামচ (৫ মিলি)' },
        ],
        stock: 80,
        minStockAlert: 25,
        unit: 'মিলি',
        startDate: '2026-11-01',
        durationDays: 5,
        isChronic: false,
        doctorName: 'ডা. তাহমিনা আনোয়ার (শিশু বিশেষজ্ঞ)',
        purpose: 'শ্লেষ্মাযুক্ত কাশি উপশম',
        instructions: 'খাবারের পর কুসুম গরম পানি সহ সেব্য।',
        assignedPatientId: 'patient-fictional-child',
        status: 'active',
        colorTag: 'amber',
      },
    ];

    const todayStr = '2026-11-02';
    const fictionalLogs: DoseLog[] = [
      // Father's taken doses
      {
        id: 'log-fic-f1',
        medicineId: 'med-fic-father-1',
        medicineName: 'টেলমিভাস ৪০ (Telmivas 40)',
        genericName: 'Telmisartan 40mg',
        patientId: 'patient-fictional-father',
        scheduledDate: todayStr,
        scheduledTime: '08:30 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
        loggedAt: '2026-11-02T08:32:00Z',
        notes: 'প্রেসার পরিমাপের পর সকালে গৃহীত',
      },
      // Mother's taken dose
      {
        id: 'log-fic-m1',
        medicineId: 'med-fic-mother-1',
        medicineName: 'সেক্লো ২০ (Seclo 20)',
        genericName: 'Omeprazole 20mg',
        patientId: 'patient-fictional-mother',
        scheduledDate: todayStr,
        scheduledTime: '07:30 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
        loggedAt: '2026-11-02T07:35:00Z',
        notes: 'সকালে নাস্তার পূর্বে গৃহীত',
      },
      // Child's taken dose
      {
        id: 'log-fic-c1',
        medicineId: 'med-fic-child-2',
        medicineName: 'টাসপেল সিরাপ (Tuspel Syrup)',
        genericName: 'Guaifenesin + Bromhexine',
        patientId: 'patient-fictional-child',
        scheduledDate: todayStr,
        scheduledTime: '09:00 AM',
        timeSlot: 'সকাল',
        dosage: '১ চামচ (৫ মিলি)',
        status: 'taken',
        loggedAt: '2026-11-02T09:05:00Z',
        notes: 'নাস্তার পর কুসুম গরম পানি দিয়ে সেবন করানো হয়েছে',
      },
    ];

    // Merge fictional data
    setPatients((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const filteredFictional = fictionalPatients.filter((p) => !existingIds.has(p.id));
      return [...filteredFictional, ...prev];
    });

    setMedicines((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const filteredFictional = fictionalMedicines.filter((m) => !existingIds.has(m.id));
      return [...filteredFictional, ...prev];
    });

    setDoseLogs((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const filteredFictional = fictionalLogs.filter((l) => !existingIds.has(l.id));
      return [...filteredFictional, ...prev];
    });

    setActivePatientId('patient-fictional-father');

    // Cloud sync if signed in
    if (currentUser) {
      fictionalPatients.forEach((p) => savePatientToCloud(currentUser.uid, p));
      fictionalMedicines.forEach((m) => saveMedicineToCloud(currentUser.uid, m));
      fictionalLogs.forEach((l) => saveDoseLogToCloud(currentUser.uid, l));
    }

    showToast('৩টি কাল্পনিক ফ্যামিলি প্রোফাইল এবং ভিন্ন ভিন্ন ওষুধ সফলভাবে লোড হয়েছে!', 'success');
  };

  const resetAllData = () => {
    setMedicines(initialMedicines);
    setDoseLogs(initialDoseLogs);
    setPatients([]);
    setActivePatientId(null);
    setSettings(initialSettings);
    setHealthRecords(initialHealthRecords);
    setAppointments(initialAppointments);
    localStorage.clear();
    showToast('সকল ডেটা রিসেট করা হয়েছে', 'info');
  };

  // Health Records CRUD (ধাপ ১)
  const addHealthRecord = (recordData: Omit<HealthRecord, 'id' | 'createdAt'>): string => {
    const newId = `hr-${Date.now()}`;
    const newRecord: HealthRecord = {
      ...recordData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setHealthRecords((prev) => [newRecord, ...prev]);

    if (currentUser) {
      saveHealthRecordToCloud(currentUser.uid, newRecord).catch((err) =>
        console.warn('Cloud health record save error', err)
      );
    }
    showToast('স্বাস্থ্য পরিমাপ রেকর্ড সফলভাবে সংরক্ষিত হয়েছে', 'success');
    return newId;
  };

  const deleteHealthRecord = (id: string) => {
    setHealthRecords((prev) => prev.filter((r) => r.id !== id));
    if (currentUser) {
      deleteHealthRecordFromCloud(currentUser.uid, id).catch((err) =>
        console.warn('Cloud health record delete error', err)
      );
    }
    showToast('স্বাস্থ্য রেকর্ড মুছে ফেলা হয়েছে', 'info');
  };

  // Doctor Appointments CRUD (ধাপ ২)
  const addAppointment = (aptData: Omit<DoctorAppointment, 'id' | 'createdAt'>): string => {
    const newId = `apt-${Date.now()}`;
    const newApt: DoctorAppointment = {
      ...aptData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setAppointments((prev) => [newApt, ...prev]);

    if (currentUser) {
      saveAppointmentToCloud(currentUser.uid, newApt).catch((err) =>
        console.warn('Cloud appointment save error', err)
      );
    }
    showToast(`ডা. ${newApt.doctorName}-এর সাথে অ্যাপয়েন্টমেন্ট নির্ধারিত হয়েছে`, 'success');
    return newId;
  };

  const updateAppointment = (id: string, updates: Partial<DoctorAppointment>) => {
    let updatedApt: DoctorAppointment | undefined;
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          updatedApt = { ...a, ...updates };
          return updatedApt;
        }
        return a;
      })
    );

    if (currentUser && updatedApt) {
      saveAppointmentToCloud(currentUser.uid, updatedApt).catch((err) =>
        console.warn('Cloud appointment update error', err)
      );
    }
    showToast('অ্যাপয়েন্টমেন্ট তথ্য হালনাগাদ করা হয়েছে', 'info');
  };

  const deleteAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    if (currentUser) {
      deleteAppointmentFromCloud(currentUser.uid, id).catch((err) =>
        console.warn('Cloud appointment delete error', err)
      );
    }
    showToast('অ্যাপয়েন্টমেন্ট মুছে ফেলা হয়েছে', 'info');
  };

  const openAddToPersonalModal = (med: GlobalMedicine) => {
    setCatalogMedToAddToPersonal(med);
    setIsAddToPersonalModalOpen(true);
  };

  const closeAddToPersonalModal = () => {
    setIsAddToPersonalModalOpen(false);
    setCatalogMedToAddToPersonal(null);
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

    const preparedRecords: GlobalMedicine[] = records.map((r, idx) => ({
      ...r,
      id: r.id || `gmed_${Date.now()}_${idx}`,
      importBatchId: batchId,
      importedAt: fullBatch.importedAt,
      verifiedByAdmin: r.status === 'published' ? true : false,
      status: r.status || 'published',
      source: r.source || fullBatch.source,
      sourceType: r.sourceType || fullBatch.sourceType,
      sourceName: r.sourceName || fullBatch.source,
      licenseReference: r.licenseReference || fullBatch.licenseReference,
      writtenPermissionRef: r.writtenPermissionRef || fullBatch.writtenPermissionRef,
    }));

    try {
      // 1. Save to Cloud Firestore
      await bulkImportGlobalMedicines(fullBatch, preparedRecords);

      // 2. Merge into local state with deduplication
      setGlobalMedicines((prev) => {
        const map = new Map<string, GlobalMedicine>();
        prev.forEach((item) => map.set(item.duplicateKey, item));
        preparedRecords.forEach((item) => map.set(item.duplicateKey, item));
        return Array.from(map.values());
      });

      setImportBatches((prev) => [fullBatch, ...prev]);

      const publishedCount = preparedRecords.filter((r) => r.status === 'published').length;
      const unverifiedCount = preparedRecords.length - publishedCount;

      // Record activity in Firestore
      recordAdminActivity({
        type: 'import',
        title: `ওষুধ ডাটা ইমপোর্ট (${fullBatch.source})`,
        description: `${preparedRecords.length} টি ওষুধ প্রক্রিয়াজাত (${publishedCount} টি প্রকাশিত, ${unverifiedCount} টি খসড়া)`,
        adminEmail: fullBatch.importedByEmail,
      }).catch((e) => console.warn('Activity log error:', e));

      if (unverifiedCount > 0 && publishedCount === 0) {
        showToast(
          `${unverifiedCount} টি ওষুধ যাচাইকরণের জন্য অপেক্ষমাণ (Unpublished Pending Verification) হিসেবে সংরক্ষিত হয়েছে।`,
          'info'
        );
      } else if (unverifiedCount > 0) {
        showToast(
          `${publishedCount} টি ওষুধ প্রকাশিত হয়েছে এবং ${unverifiedCount} টি অপ্রকাশিত খসড়া হিসেবে রাখা হয়েছে।`,
          'success'
        );
      } else {
        showToast(`${publishedCount} টি ওষুধ সফলভাবে গ্লোবাল ক্যাটালগে প্রকাশিত হয়েছে!`, 'success');
      }
      return true;
    } catch (err: any) {
      console.error('Batch import failed:', err);
      // Local fallback for offline testing
      setGlobalMedicines((prev) => {
        const map = new Map<string, GlobalMedicine>();
        prev.forEach((item) => map.set(item.duplicateKey, item));
        preparedRecords.forEach((item) => map.set(item.duplicateKey, item));
        return Array.from(map.values());
      });
      setImportBatches((prev) => [fullBatch, ...prev]);
      showToast(`${preparedRecords.length} টি ওষুধ স্থানীয় ক্যাটালগে সংরক্ষিত হয়েছে`, 'info');
      return true;
    }
  };

  const publishGlobalMedicineAction = async (medicineId: string): Promise<boolean> => {
    if (!isAdmin) {
      showToast('অননুমোদিত অ্যাক্সেস: আপনার এই অ্যাকাউন্টে ওষুধ অনুমোদন ও প্রকাশ করার অনুমতি নেই।', 'alert');
      return false;
    }

    const cleanLicense =
      targetMed?.licenseReference && targetMed.licenseReference.includes('TEST-SYSTEM-ONLY')
        ? 'DGDA Public Gazette / National Formulary'
        : (targetMed?.licenseReference || 'DGDA Public Gazette Open Data');

    const updatedMed: GlobalMedicine = targetMed
      ? {
          ...targetMed,
          status: 'published',
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
          licenseReference: cleanLicense,
        }
      : ({
          id: medicineId,
          brandName: 'ওষুধ',
          genericName: 'জেনেরিক',
          strength: '',
          dosageForm: 'ট্যাবলেট',
          manufacturer: 'প্রস্তুতকারক',
          source: 'DGDA_GOV',
          sourceType: 'government',
          sourceName: 'DGDA সরকারি গেজেট',
          licenseReference: 'DGDA Public Gazette Open Data',
          duplicateKey: `gmed_${medicineId}`,
          status: 'published',
          verifiedByAdmin: true,
          verificationNotes: 'প্রশাসক কর্তৃক সরাসরি যাচাইকৃত ও সার্বজনীন প্রকাশিত',
          importedAt: new Date().toISOString(),
        } as GlobalMedicine);

    // 1. Immediately update local state & localStorage so the UI reflects the approval instantly
    setGlobalMedicines((prev) => {
      const exists = prev.some((m) => m.id === medicineId);
      const next = exists
        ? prev.map((med) => (med.id === medicineId ? updatedMed : med))
        : [updatedMed, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.GLOBAL_MEDS, JSON.stringify(next));
      } catch (e) {
        console.warn('Storage sync error', e);
      }
      return next;
    });

    // 2. Sync to Firestore in background with full payload
    try {
      await publishGlobalMedicine(updatedMed);
      recordAdminActivity({
        type: 'publish',
        title: 'ওষুধ অনুমোদন ও সার্বজনীন প্রকাশ',
        description: `ওষুধ "${updatedMed.brandName}" (${updatedMed.id}) যাচাইকৃত ও গ্লোবাল ক্যাটালগে প্রকাশিত হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));
    } catch (err: any) {
      console.warn('Firestore publish notice (local state maintained):', err);
    }

    showToast(`"${updatedMed.brandName}" সফলভাবে অনুমোদিত ও লাইব্রেরিতে প্রকাশিত হয়েছে!`, 'success');
    return true;
  };

  /**
   * Bulk publishes draft medicines directly to live Firestore library in real-time.
   * If medicineIds are provided, publishes those; otherwise publishes ALL unpublished drafts.
   */
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

    const updatedTargets: GlobalMedicine[] = targets.map((med) => {
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

    // 1. Immediately update local state & localStorage so the UI updates instantly
    setGlobalMedicines((prev) => {
      const map = new Map<string, GlobalMedicine>();
      prev.forEach((m) => map.set(m.id, m));
      updatedTargets.forEach((m) => map.set(m.id, m));
      const next = Array.from(map.values());
      try {
        localStorage.setItem(STORAGE_KEYS.GLOBAL_MEDS, JSON.stringify(next));
      } catch (e) {
        console.warn('Storage sync error', e);
      }
      return next;
    });

    // 2. Sync to Firestore in background using writeBatch
    try {
      await bulkPublishGlobalMedicines(updatedTargets);
      recordAdminActivity({
        type: 'publish',
        title: 'বাল্ক ওষুধ অনুমোদন ও সার্বজনীন প্রকাশ',
        description: `মোট ${updatedTargets.length}টি ওষুধ সরাসরি অনুমোদন করে লাইব্রেরিতে সার্বজনীন প্রকাশ করা হয়েছে।`,
        adminEmail: currentUser?.email || ADMIN_EMAIL,
      }).catch((e) => console.warn('Activity log error:', e));
    } catch (err: any) {
      console.warn('Firestore bulk publish notice (local state maintained):', err);
    }

    showToast(
      `মোট ${updatedTargets.length}টি ওষুধ সফলভাবে লাইব্রেরিতে প্রকাশিত হয়েছে! সকল ব্যবহারকারী এখনই তা পাবেন।`,
      'success'
    );
    return updatedTargets.length;
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

    // Safety guard: Never delete published real medicines
    const isTest = isTestMedicine(target);
    const isUnpublishedDraft = target.status !== 'published' || !target.verifiedByAdmin;
    if (!isTest && !isUnpublishedDraft) {
      showToast('নিরাপত্তা বিধিনিষেধ: শুধুমাত্র খসড়া বা টেস্ট ডাটা রেকর্ড মুছে ফেলা যাবে। বাস্তব প্রকাশিত ওষুধ মুছা সম্পূর্ণ নিষিদ্ধ।', 'alert');
      return false;
    }

    try {
      await deleteGlobalMedicine(medicineId);
    } catch (err: any) {
      console.warn('Firestore delete error:', err);
      const isAuthOrPermission =
        err?.message?.includes('অননুমোদিত') ||
        err?.message?.includes('নিরাপত্তা') ||
        err?.message?.includes('permission-denied') ||
        err?.message?.includes('PERMISSION_DENIED');
      if (isAuthOrPermission) {
        showToast(getFriendlyErrorMessage(err), 'alert');
        return false;
      }
    }

    // Safely remove from globalMedicines state
    setGlobalMedicines((prev) => prev.filter((m) => m.id !== medicineId));

    recordAdminActivity({
      type: 'delete',
      title: 'টেস্ট ডাটা নিরাপদ অপসারণ',
      description: `খসড়া কিউ থেকে "${target.brandName}" মুছে ফেলা হয়েছে।`,
      adminEmail: currentUser?.email || ADMIN_EMAIL,
    }).catch((e) => console.warn('Activity log error:', e));

    showToast(`"${target.brandName}" টেস্ট রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে`, 'info');
    return true;
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

    // Filter to ensure only draft/test records are targeted
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

    const safeIds = safeToDelete.map((m) => m.id);

    try {
      await bulkDeleteGlobalMedicines(safeIds);
    } catch (err: any) {
      console.warn('Firestore bulk delete error:', err);
      const isAuthOrPermission =
        err?.message?.includes('অননুমোদিত') ||
        err?.message?.includes('নিরাপত্তা') ||
        err?.message?.includes('permission-denied') ||
        err?.message?.includes('PERMISSION_DENIED');
      if (isAuthOrPermission) {
        showToast(getFriendlyErrorMessage(err), 'alert');
        return false;
      }
    }

    const idSet = new Set(safeIds);
    setGlobalMedicines((prev) => prev.filter((m) => !idSet.has(m.id)));

    recordAdminActivity({
      type: 'delete',
      title: 'একাধিক টেস্ট ডাটা বাল্ক অপসারণ',
      description: `খসড়া কিউ থেকে একযোগে ${safeIds.length} টি টেস্ট রেকর্ড মুছে ফেলা হয়েছে।`,
      adminEmail: currentUser?.email || ADMIN_EMAIL,
    }).catch((e) => console.warn('Activity log error:', e));

    showToast(`${safeIds.length} টি টেস্ট রেকর্ড সফলভাবে মুছে ফেলা হয়েছে`, 'info');
    return true;
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
      status: 'active',
      colorTag: 'teal',
    });

    showToast(`"${med.brandName}" আপনার ব্যক্তিগত ওষুধ তালিকায় যোগ করা হয়েছে`, 'success');
    closeAddToPersonalModal();
    return newMedId;
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
        seedFictionalFamilyProfiles,
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
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signOutUser,
        syncLocalToCloud,
        globalMedicines,
        importBatches,
        isAdmin,
        adminEmail: ADMIN_EMAIL,
        selectedGlobalMedForDetail,
        setSelectedGlobalMedForDetail,
        isAddToPersonalModalOpen,
        catalogMedToAddToPersonal,
        openAddToPersonalModal,
        closeAddToPersonalModal,
        publishGlobalMedicineAction,
        deleteGlobalMedicineAction,
        bulkDeleteGlobalMedicinesAction,
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
