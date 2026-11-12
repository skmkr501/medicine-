export type MedicineType =
  | 'ট্যাবলেট'
  | 'ক্যাপসুল'
  | 'সিরাপ'
  | 'ইনসুলিন/ইনজেকশন'
  | 'চোখের ড্রপ'
  | 'ইনহেলার'
  | 'মলম/জেল';

export type MealTiming =
  | 'খাওয়ার আগে'
  | 'খাওয়ার পরে'
  | 'খালি পেটে'
  | 'ভরা পেটে'
  | 'ঘুমানোর আগে'
  | 'প্রয়োজনমতো';

export type TimeSlot = 'সকাল' | 'দুপুর' | 'সন্ধ্যা' | 'রাত';

export interface DoseSchedule {
  id: string;
  timeSlot: TimeSlot;
  time: string; // e.g. "০৮:০০ AM" or "08:00 AM"
  dosage: string; // e.g. "১টি", "২ চামচ"
}

export interface StockAdjustment {
  id: string;
  previousStock: number;
  newStock: number;
  reason: string; // e.g. "নতুন ক্রয়/রিফিল", "প্যাকেট নষ্ট বা অপচয়", "হিসাব সংশোধন", "ডোজ সমন্বয়"
  timestamp: string; // ISO string
  notes?: string;
}

export type StockPredictionStatus =
  | 'safe'          // > 7 days
  | 'low_stock'     // <= 7 days and > 3 days
  | 'urgent'        // <= 3 days and > 0 days
  | 'out_of_stock'  // <= 0 units
  | 'incalculable'; // missing schedules, 0 dosage, or invalid stock

export interface StockPrediction {
  medicineId: string;
  brandName: string;
  genericName?: string;
  type: MedicineType;
  strength?: string;
  currentStock: number;
  unit: string;
  dailyDosageUnits: number; // total units consumed per day across all schedules
  daysRemaining: number | null; // null if incalculable
  estimatedRunOutDate: Date | null;
  estimatedRunOutDateStr: string; // Bengali formatted string e.g. "১৫ নভেম্বর ২০২৬"
  status: StockPredictionStatus;
  statusLabelBn: string; // "স্টক শেষ", "জরুরি সতর্কতা", "স্বল্প স্টক", "পর্যাপ্ত স্টক", "হিসাব করা যাচ্ছে না"
  adviceBn: string; // Neutral, logistical inventory advice
  isLowOrUrgent: boolean;
  assignedPatientId?: string;
  schedulesCount: number;
  calculationReasonBn?: string;
  medicine: Medicine;
  dailyConsumptionRate: number;
  runoutDate: Date | null;
}

export interface Medicine {
  id: string;
  brandName: string;
  genericName: string;
  type: MedicineType;
  strength: string;
  mealTiming: MealTiming;
  schedules: DoseSchedule[];
  stock: number;
  minStockAlert: number;
  unit: string; // 'টি', 'মিলি', 'ড্রপ', 'পাফ'
  startDate: string;
  durationDays?: number; // e.g. 7, 14, 30 or undefined for chronic
  isChronic: boolean; // দীর্ঘমেয়াদী ওষুধ
  doctorName?: string;
  purpose?: string;
  instructions?: string;
  assignedPatientId?: string; // Optional: medicines may exist independently and be assigned later
  status: 'active' | 'paused' | 'completed';
  colorTag: 'teal' | 'emerald' | 'cyan' | 'blue' | 'indigo' | 'rose' | 'amber';
  stockAdjustments?: StockAdjustment[];
  lastStockUpdated?: string;
}

export interface DoseLog {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  patientId?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string;
  timeSlot: TimeSlot;
  dosage: string;
  status: 'taken' | 'skipped' | 'missed';
  loggedAt?: string; // ISO string
  notes?: string;
}

export interface PatientProfile {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: 'পুরুষ' | 'মহিলা' | 'অন্যান্য';
  bloodGroup: string;
  chronicConditions: string[];
  allergies: string[];
  emergencyContact: string;
  avatarUrl?: string;
  isArchived?: boolean;
  archivedAt?: string;
}

export interface HealthRecord {
  id: string;
  patientId: string;
  recordDate: string; // YYYY-MM-DD
  recordTime?: string; // e.g. "08:30 AM"
  systolic?: number; // mmHg
  diastolic?: number; // mmHg
  bloodSugar?: number; // mmol/L
  sugarType?: 'খালি পেটে' | 'খাওয়ার পরে';
  weight?: number; // kg
  notes?: string;
  createdAt: string;
}

export interface DoctorAppointment {
  id: string;
  patientId?: string;
  doctorName: string;
  specialty?: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. "10:30 AM"
  location: string;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface ReminderSettings {
  soundEnabled: boolean;
  selectedTone: 'soft-bell' | 'chime' | 'gentle-pulse' | 'digital-beep';
  advanceMinutes: number; // 0, 10, 15, 30
  snoozeDurationMinutes: number;
  language: 'bn' | 'en';
  themeMode?: 'light' | 'dark' | 'system';
  largeFontMode?: boolean;
  easyMode?: boolean;
  voiceReadoutEnabled?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export type NavigationPage =
  | 'dashboard'
  | 'me'
  | 'checklist'
  | 'health-records'
  | 'appointments'
  | 'medicines'
  | 'add-medicine'
  | 'reminders'
  | 'history'
  | 'ai-assistant'
  | 'settings'
  | 'library'
  | 'admin-import'
  | 'admin-dashboard';

export type ImportDataSource =
  | 'DGDA_GOV'              // Government Open Data: Directorate General of Drug Administration (DGDA) Gazette / Formulary
  | 'MANUFACTURER'          // Pharmaceutical Manufacturer Official Product Monograph / Price List
  | 'INDEPENDENT_VERIFIED'  // Independently Created & Verified Clinical Records
  | 'MEDEX_LICENSED'        // MedEx Bangladesh (Strictly requiring documented written permission)
  | 'DIMS_LICENSED'         // DIMS Bangladesh / ITmedicus (Strictly requiring documented written permission)
  | 'MedEx'                 // Backward-compatible alias
  | 'DIMS'                  // Backward-compatible alias
  | 'DGDA_Official';        // Backward-compatible alias

export type ImportSourceType =
  | 'government'
  | 'manufacturer'
  | 'independent'
  | 'licensed_partner';

export interface GlobalMedicine {
  id: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string; // e.g. 'ট্যাবলেট', 'ক্যাপসুল', 'সিরাপ', 'ইনজেকশন'
  manufacturer: string; // e.g. 'স্কয়ার ফার্মাসিউটিক্যালস', 'বেক্সিমকো'
  brandNameBn?: string;
  genericNameBn?: string;
  therapeuticClass?: string;
  indication?: string;
  pricePerUnit?: number;
  packageDescription?: string;
  darNumber?: string; // DGDA Drug Administration Registration Number
  source: ImportDataSource;
  sourceType: ImportSourceType;
  sourceName: string; // e.g. 'DGDA সরকারি ড্রাগ গেজেট', 'প্রস্তুতকারক মনোগ্রাফ', 'মেডেক্স পার্টনারশিপ'
  licenseReference: string; // Mandatory license or authority reference
  writtenPermissionRef?: string; // Mandatory for MedEx/DIMS licensed partner imports
  importBatchId?: string;
  importedAt: string;
  verifiedByAdmin: boolean;
  verificationNotes?: string;
  status: 'published' | 'pending_verification' | 'draft';
  duplicateKey: string; // normalized (brand+generic+strength+form+mfg)
}

export interface ImportPreviewRecord {
  tempId: string;
  record: Partial<GlobalMedicine>;
  validationStatus: 'valid' | 'duplicate' | 'error';
  validationErrors: string[];
  isExistingDuplicate: boolean;
  existingId?: string;
  duplicateResolution?: 'skip' | 'update';
}

export interface ImportBatch {
  id: string;
  source: ImportDataSource;
  sourceProfile:
    | 'dgda_gov'
    | 'manufacturer'
    | 'independent'
    | 'medex_licensed'
    | 'dims_licensed'
    | 'medex'
    | 'dims'
    | 'custom';
  sourceType: ImportSourceType;
  importedAt: string;
  importedByUid: string;
  importedByEmail: string;
  licenseReference: string;
  writtenPermissionRef?: string;
  legalBasisNotes?: string;
  attestationAccepted: boolean;
  totalRecordsInFile: number;
  validRecordsCount: number;
  duplicateRecordsCount: number;
  errorRecordsCount: number;
  publishedCount: number;
  pendingVerificationCount?: number;
  status: 'preview' | 'completed' | 'cancelled';
  fileName?: string;
}

export interface AdminActivity {
  id: string;
  type: 'import' | 'publish' | 'delete' | 'verification' | 'system';
  title: string;
  description: string;
  adminEmail: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalPatientProfiles: number;
  totalPublishedMedicines: number;
  totalUnpublishedMedicines: number;
  totalImportBatches: number;
  pendingVerificationCount: number;
  firebaseConnected: boolean;
  firebaseLatencyMs: number;
  firebaseDatabaseId: string;
}


