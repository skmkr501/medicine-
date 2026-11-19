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
  | 'যেকোনো সময়'
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
  expiryDate?: string; // Optional ISO YYYY-MM-DD packet expiry date
  packageDescription?: string; // Optional pack/strip description from catalog
  catalogMedicineId?: string; // Optional linked library medicine id
  pricePerUnit?: number; // Optional user-specified price per single unit
  updatedAtMs?: number;
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
  updatedAtMs?: number;
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
  updatedAtMs?: number;
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
  updatedAtMs?: number;
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
  updatedAtMs?: number;
}

export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

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
  caregiverMissedDoseMinutes?: 15 | 30 | 60;
  patientSelfPhone?: string;
  weekStartDay?: WeekStartDay;
  showEmergencyDoctorOnCard?: boolean;
}

export interface CaregiverTodayDoseSummary {
  medicineName: string;
  timeSlot: TimeSlot;
  time: string;
  dosage: string;
  status: 'taken' | 'pending' | 'skipped';
}

export interface CaregiverFullMedicineItem {
  id?: string;
  brandName: string;
  genericName?: string;
  strength?: string;
  type?: MedicineType;
  mealTiming: string;
  stock: number;
  unit: string;
  durationDays?: number;
  isChronic?: boolean;
  schedules?: DoseSchedule[];
  schedulesText: string;
}

export interface CaregiverTodaySummary {
  date: string; // YYYY-MM-DD
  totalDoses: number;
  takenDoses: number;
  remainingDoses: number;
  doses: CaregiverTodayDoseSummary[];
  updatedAt: string;
}

export interface CaregiverLinkDoc {
  id: string;
  inviteCode: string;
  patientUid: string;
  caregiverUid: string; // empty string while pending
  patientName: string;
  caregiverName: string;
  patientPhone?: string;
  status: 'pending' | 'active';
  allowFullView: boolean;
  allowSuggestions?: boolean;
  createdAt: string;
  serverCreatedAt?: unknown;
  expiresAt?: string;
  expiresAtMs: number;
  linkedAt?: string;
  updatedAt?: string;
  todaySummary?: CaregiverTodaySummary;
  sharedMedicines?: CaregiverFullMedicineItem[];
}

export type CaregiverSuggestionKind = 'add' | 'edit' | 'stop';
export type CaregiverSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface CaregiverSuggestedMedicinePayload {
  brandName: string;
  genericName?: string;
  strength?: string;
  type: MedicineType;
  dosage: string;
  timeSlots: TimeSlot[];
  schedules?: DoseSchedule[];
  mealTiming: MealTiming;
  durationDays?: number;
  isChronic?: boolean;
  stock: number;
  unit: string;
}

export interface CaregiverSuggestionDoc {
  id: string;
  patientUid: string;
  caregiverUid: string;
  linkId: string;
  caregiverName: string;
  patientName?: string;
  kind: CaregiverSuggestionKind;
  medicine: CaregiverSuggestedMedicinePayload;
  targetMedicineId?: string;
  targetMedicineName?: string;
  note?: string;
  status: CaregiverSuggestionStatus;
  createdAt: unknown;
  createdAtMs: number;
}

export type FamilyAlertType = 'missed_dose' | 'low_stock';

export interface FamilyAlertDoc {
  id: string;
  patientUid: string;
  caregiverUids: string[];
  caregiverLinkIds: string[];
  type: FamilyAlertType;
  medicineId: string;
  medicineName: string;
  slot?: TimeSlot;
  date: string; // YYYY-MM-DD
  message: string;
  patientName?: string;
  patientPhone?: string;
  createdAt: string;
  createdAtMs: number;
  seenBy: string[];
}

export type NavigationPage =
  | 'dashboard'
  | 'me'
  | 'checklist'
  | 'health-records'
  | 'appointments'
  | 'doctors'
  | 'medicines'
  | 'weekly-pillbox'
  | 'add-medicine'
  | 'shopping-list'
  | 'reminders'
  | 'history'
  | 'share-report'
  | 'emergency-qr'
  | 'ai-assistant'
  | 'settings'
  | 'library'
  | 'admin-import'
  | 'admin-dashboard'
  | 'admin-library';

export interface DoctorProfile {
  id: string;
  name: string;
  specialty?: string;
  phone?: string;
  whatsapp?: string;
  hospital?: string; // চেম্বার / হাসপাতাল
  address?: string;
  visitingHours?: string;
  forConditions?: string; // কোন রোগের জন্য
  patientIds?: string[]; // কোন প্রোফাইলের ডাক্তার
  lastVisitDate?: string; // YYYY-MM-DD
  nextVisitDate?: string; // YYYY-MM-DD
  notes?: string;
  isEmergency: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PhonebookEntry {
  id: string;
  name: string;
  phone: string;
  relation?: string;
  category?: string;
  notes?: string;
  isEmergency?: boolean;
  patientId?: string;
  createdAt?: string;
  updatedAtMs?: number;
}

export type MedicalDocumentKind = 'prescription' | 'report';

export type MedicalReportType =
  | 'রক্ত পরীক্ষা'
  | 'এক্স-রে'
  | 'ECG'
  | 'আলট্রাসাউন্ড'
  | 'প্রস্রাব পরীক্ষা'
  | 'সিটি/MRI'
  | 'অন্যান্য';

export interface MedicalDocumentPageMeta {
  fileId: string;
  thumb: string; // ≤ 10 KB JPEG data URL (max 240px)
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface MedicalDocument {
  id: string;
  kind: MedicalDocumentKind;
  patientId: string;
  doctorId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  note?: string;
  reportType?: string;
  pages: MedicalDocumentPageMeta[]; // max 10 pages
  createdAt: unknown;
  updatedAt: unknown;
  pendingCloudUpload?: boolean; // client-only indicator, stripped before Firestore write
}

export interface MedicalDocumentFile {
  id: string;
  docId: string;
  data: string; // base64 JPEG data URL (<= 900,000 chars)
  bytes: number;
  createdAt: unknown;
}

export type SharedReportExpiryHours = 24 | 168 | 720;

export interface SharedReportSectionSelection {
  medicines: boolean;
  allergiesEmergency: boolean;
  recentReadings: boolean;
  appointments: boolean;
}

export interface SharedReportMedicineItem {
  brandName: string;
  genericName: string;
  strength: string;
  type: string;
  mealTiming: string;
  schedulesText: string;
  instructions?: string;
}

export interface SharedReportAllergiesEmergency {
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact?: string;
}

export interface SharedReportReadingItem {
  recordDate: string;
  recordTime?: string;
  systolic?: number;
  diastolic?: number;
  bloodSugar?: number;
  sugarType?: string;
  weight?: number;
  notes?: string;
}

export interface SharedReportAppointmentItem {
  doctorName: string;
  specialty?: string;
  appointmentDate: string;
  appointmentTime: string;
  location: string;
  notes?: string;
}

export interface SharedReportDoctorInfo {
  name: string;
  specialty?: string;
  hospital?: string;
}

export interface SharedReportSections {
  doctor?: SharedReportDoctorInfo;
  medicines?: SharedReportMedicineItem[];
  allergiesEmergency?: SharedReportAllergiesEmergency;
  recentReadings?: SharedReportReadingItem[];
  appointments?: SharedReportAppointmentItem[];
}

export interface SharedReportDoc {
  ownerUid: string;
  token: string;
  createdAt: unknown;
  expiresAt: unknown;
  createdAtMs?: number;
  expiresAtMs?: number;
  patientName: string;
  age?: number;
  gender?: string;
  relation?: string;
  sections: SharedReportSections;
  revoked: boolean;
}

export interface EmergencyCardSelection {
  bloodGroup: boolean;
  allergies: boolean;
  conditions: boolean;
  contact: boolean;
  medicines: boolean; // ডিফল্ট বন্ধ
  doctorName: boolean;
}

export interface EmergencyCardDoc {
  ownerUid: string;
  token: string;
  createdAt: unknown;
  createdAtMs?: number;
  patientName: string;
  age?: number;
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  contactName?: string;
  contactPhone?: string;
  medicines?: string;
  doctorName?: string;
  active: boolean;
}

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
  priceUnit?: string; // e.g. 'পিস', 'পাতা', 'বোতল', 'টিউব'
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
  importedByUid?: string;
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
  feedbackCount: number;
}

export interface FeedbackEntry {
  id: string;
  userId?: string;
  message: string;
  appVersion?: string;
  createdAt: string;
}


