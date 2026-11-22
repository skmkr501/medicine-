import {
  AdminActivity,
  Announcement,
  AnnouncementLevel,
  CaregiverFullMedicineItem,
  CaregiverLinkDoc,
  CaregiverSuggestedMedicinePayload,
  CaregiverSuggestionDoc,
  CaregiverTodaySummary,
  CycleFlow,
  CycleLog,
  DoctorAppointment,
  DoctorProfile,
  DoseLog,
  DoseSchedule,
  EmergencyCardDoc,
  Expense,
  ExpenseCategory,
  FamilyAlertDoc,
  FeedbackEntry,
  GlobalMedicine,
  GuestViewDoc,
  GuestViewSnapshot,
  HealthRecord,
  HomeLayoutItem,
  ImportBatch,
  LibraryMiss,
  MedicalDocument,
  MedicalDocumentPageMeta,
  Medicine,
  MedicineIconTag,
  PatientProfile,
  PhonebookEntry,
  ReminderSettings,
  SharedReportDoc,
  SharedReportSections,
  StockAdjustment,
  TimeSlot,
  WeekStartDay,
} from '../types';
import { normalizeHomeLayout } from '../utils/homeLayout';
import { isValidMedicineIconTag } from '../utils/medicineAppearance';

export const USER_SETTINGS_ROW_ID = 'preferences';

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : String(value);
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

function asNullableNumber(value: unknown): number | null {
  const num = asOptionalNumber(value);
  return num !== undefined ? num : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeTimestampToIso(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'object') {
    const maybeTs = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const d = maybeTs.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    }
    if (typeof maybeTs.seconds === 'number' && Number.isFinite(maybeTs.seconds)) {
      const ms = maybeTs.seconds * 1000 + Math.floor((maybeTs.nanoseconds || 0) / 1_000_000);
      return new Date(ms).toISOString();
    }
  }
  return null;
}

// ============================================================================
// 1. patients
// ============================================================================
export interface PatientRow {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: 'পুরুষ' | 'মহিলা' | 'অন্যান্য';
  blood_group: string;
  chronic_conditions: string[];
  allergies: string[];
  emergency_contact: string;
  avatar_url: string | null;
  height_cm: number | null;
  is_archived: boolean | null;
  archived_at: string | null;
  updated_at_ms: number | null;
}

function sanitizeHeightCm(val: unknown): number | null {
  const num = asOptionalNumber(val);
  if (num === undefined || num < 30 || num > 260) return null;
  return Math.round(num * 10) / 10;
}

export function patientToRow(patient: PatientProfile): PatientRow {
  return {
    id: patient.id,
    name: patient.name ?? '',
    relation: patient.relation ?? '',
    age: Number.isFinite(Number(patient.age)) ? Number(patient.age) : 0,
    gender: patient.gender || 'অন্যান্য',
    blood_group: patient.bloodGroup ?? '',
    chronic_conditions: Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [],
    allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
    emergency_contact: patient.emergencyContact ?? '',
    avatar_url: asNullableString(patient.avatarUrl),
    height_cm: sanitizeHeightCm(patient.heightCm),
    is_archived: patient.isArchived !== undefined ? Boolean(patient.isArchived) : null,
    archived_at: asNullableString(patient.archivedAt),
    updated_at_ms: asNullableNumber(patient.updatedAtMs),
  };
}

export function patientFromRow(row: Partial<PatientRow> & { id: string }): PatientProfile {
  const result: PatientProfile = {
    id: String(row.id),
    name: String(row.name ?? ''),
    relation: String(row.relation ?? ''),
    age: asOptionalNumber(row.age) ?? 0,
    gender: (row.gender as PatientProfile['gender']) || 'অন্যান্য',
    bloodGroup: String(row.blood_group ?? ''),
    chronicConditions: asStringArray(row.chronic_conditions),
    allergies: asStringArray(row.allergies),
    emergencyContact: String(row.emergency_contact ?? ''),
  };
  const avatarUrl = asOptionalString(row.avatar_url);
  if (avatarUrl !== undefined) result.avatarUrl = avatarUrl;
  const heightCm = sanitizeHeightCm(row.height_cm);
  if (heightCm !== null) result.heightCm = heightCm;
  if (typeof row.is_archived === 'boolean') result.isArchived = row.is_archived;
  const archivedAt = asOptionalString(row.archived_at);
  if (archivedAt !== undefined) result.archivedAt = archivedAt;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;
  return result;
}

// ============================================================================
// 2. medicines
// ============================================================================
export interface MedicineRow {
  id: string;
  brand_name: string;
  generic_name: string;
  type: Medicine['type'];
  strength: string;
  meal_timing: Medicine['mealTiming'];
  schedules: DoseSchedule[];
  stock: number;
  min_stock_alert: number;
  unit: string;
  start_date: string;
  duration_days: number | null;
  is_chronic: boolean;
  doctor_name: string | null;
  purpose: string | null;
  instructions: string | null;
  assigned_patient_id: string | null;
  status: Medicine['status'];
  color_tag: Medicine['colorTag'];
  icon_tag: MedicineIconTag | null;
  photo_path: string | null;
  stock_adjustments: StockAdjustment[] | null;
  last_stock_updated: string | null;
  expiry_date: string | null;
  package_description: string | null;
  catalog_medicine_id: string | null;
  price_per_unit: number | null;
  updated_at_ms: number | null;
}

export function medicineToRow(med: Medicine): MedicineRow {
  return {
    id: med.id,
    brand_name: med.brandName ?? '',
    generic_name: med.genericName ?? '',
    type: med.type || 'ট্যাবলেট',
    strength: med.strength ?? '',
    meal_timing: med.mealTiming || 'খাওয়ার পরে',
    schedules: Array.isArray(med.schedules) ? med.schedules : [],
    stock: Number.isFinite(Number(med.stock)) ? Number(med.stock) : 0,
    min_stock_alert: Number.isFinite(Number(med.minStockAlert)) ? Number(med.minStockAlert) : 0,
    unit: med.unit ?? 'টি',
    start_date: med.startDate ?? '',
    duration_days: asNullableNumber(med.durationDays),
    is_chronic: Boolean(med.isChronic),
    doctor_name: asNullableString(med.doctorName),
    purpose: asNullableString(med.purpose),
    instructions: asNullableString(med.instructions),
    assigned_patient_id: asNullableString(med.assignedPatientId),
    status: med.status || 'active',
    color_tag: med.colorTag || 'teal',
    icon_tag: med.iconTag && isValidMedicineIconTag(med.iconTag) ? med.iconTag : null,
    photo_path: med.photoPath && med.photoPath.trim() ? med.photoPath.trim() : null,
    stock_adjustments: Array.isArray(med.stockAdjustments) ? med.stockAdjustments : null,
    last_stock_updated: asNullableString(med.lastStockUpdated),
    expiry_date: asNullableString(med.expiryDate),
    package_description: asNullableString(med.packageDescription),
    catalog_medicine_id: asNullableString(med.catalogMedicineId),
    price_per_unit: asNullableNumber(med.pricePerUnit),
    updated_at_ms: asNullableNumber(med.updatedAtMs),
  };
}

export function medicineFromRow(row: Partial<MedicineRow> & { id: string }): Medicine {
  const result: Medicine = {
    id: String(row.id),
    brandName: String(row.brand_name ?? ''),
    genericName: String(row.generic_name ?? ''),
    type: (row.type as Medicine['type']) || 'ট্যাবলেট',
    strength: String(row.strength ?? ''),
    mealTiming: (row.meal_timing as Medicine['mealTiming']) || 'খাওয়ার পরে',
    schedules: Array.isArray(row.schedules) ? (row.schedules as DoseSchedule[]) : [],
    stock: asOptionalNumber(row.stock) ?? 0,
    minStockAlert: asOptionalNumber(row.min_stock_alert) ?? 0,
    unit: String(row.unit ?? 'টি'),
    startDate: String(row.start_date ?? ''),
    isChronic: Boolean(row.is_chronic),
    status: (row.status as Medicine['status']) || 'active',
    colorTag: (row.color_tag as Medicine['colorTag']) || 'teal',
  };

  if (isValidMedicineIconTag(row.icon_tag)) {
    result.iconTag = row.icon_tag;
  }
  const photoPath = asOptionalString(row.photo_path);
  if (photoPath && photoPath.trim()) {
    result.photoPath = photoPath.trim();
  }
  const durationDays = asOptionalNumber(row.duration_days);
  if (durationDays !== undefined) result.durationDays = durationDays;
  const doctorName = asOptionalString(row.doctor_name);
  if (doctorName !== undefined) result.doctorName = doctorName;
  const purpose = asOptionalString(row.purpose);
  if (purpose !== undefined) result.purpose = purpose;
  const instructions = asOptionalString(row.instructions);
  if (instructions !== undefined) result.instructions = instructions;
  const assignedPatientId = asOptionalString(row.assigned_patient_id);
  if (assignedPatientId !== undefined) result.assignedPatientId = assignedPatientId;
  if (Array.isArray(row.stock_adjustments)) {
    result.stockAdjustments = row.stock_adjustments as StockAdjustment[];
  }
  const lastStockUpdated = asOptionalString(row.last_stock_updated);
  if (lastStockUpdated !== undefined) result.lastStockUpdated = lastStockUpdated;
  const expiryDate = asOptionalString(row.expiry_date);
  if (expiryDate !== undefined) result.expiryDate = expiryDate;
  const packageDescription = asOptionalString(row.package_description);
  if (packageDescription !== undefined) result.packageDescription = packageDescription;
  const catalogMedicineId = asOptionalString(row.catalog_medicine_id);
  if (catalogMedicineId !== undefined) result.catalogMedicineId = catalogMedicineId;
  const pricePerUnit = asOptionalNumber(row.price_per_unit);
  if (pricePerUnit !== undefined) result.pricePerUnit = pricePerUnit;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;

  return result;
}

// ============================================================================
// 3. dose_logs
// ============================================================================
export interface DoseLogRow {
  id: string;
  medicine_id: string;
  medicine_name: string;
  generic_name: string | null;
  patient_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  time_slot: DoseLog['timeSlot'];
  dosage: string;
  status: DoseLog['status'];
  logged_at: string | null;
  notes: string | null;
  updated_at_ms: number | null;
}

export function doseLogToRow(log: DoseLog): DoseLogRow {
  return {
    id: log.id,
    medicine_id: log.medicineId ?? '',
    medicine_name: log.medicineName ?? '',
    generic_name: asNullableString(log.genericName),
    patient_id: asNullableString(log.patientId),
    scheduled_date: log.scheduledDate ?? '',
    scheduled_time: log.scheduledTime ?? '',
    time_slot: log.timeSlot || 'সকাল',
    dosage: log.dosage ?? '১টি',
    status: log.status || 'taken',
    logged_at: asNullableString(log.loggedAt),
    notes: asNullableString(log.notes),
    updated_at_ms: asNullableNumber(log.updatedAtMs),
  };
}

export function doseLogFromRow(row: Partial<DoseLogRow> & { id: string }): DoseLog {
  const result: DoseLog = {
    id: String(row.id),
    medicineId: String(row.medicine_id ?? ''),
    medicineName: String(row.medicine_name ?? ''),
    scheduledDate: String(row.scheduled_date ?? ''),
    scheduledTime: String(row.scheduled_time ?? ''),
    timeSlot: (row.time_slot as DoseLog['timeSlot']) || 'সকাল',
    dosage: String(row.dosage ?? '১টি'),
    status: (row.status as DoseLog['status']) || 'taken',
  };
  const genericName = asOptionalString(row.generic_name);
  if (genericName !== undefined) result.genericName = genericName;
  const patientId = asOptionalString(row.patient_id);
  if (patientId !== undefined) result.patientId = patientId;
  const loggedAt = asOptionalString(row.logged_at);
  if (loggedAt !== undefined) result.loggedAt = loggedAt;
  const notes = asOptionalString(row.notes);
  if (notes !== undefined) result.notes = notes;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;
  return result;
}

// ============================================================================
// 4. health_records
// ============================================================================
export interface HealthRecordRow {
  id: string;
  patient_id: string;
  record_date: string;
  record_time: string | null;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
  sugar_type: 'খালি পেটে' | 'খাওয়ার পরে' | null;
  weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at_ms: number | null;
}

export function healthRecordToRow(record: HealthRecord): HealthRecordRow {
  return {
    id: record.id,
    patient_id: record.patientId ?? '',
    record_date: record.recordDate ?? '',
    record_time: asNullableString(record.recordTime),
    systolic: asNullableNumber(record.systolic),
    diastolic: asNullableNumber(record.diastolic),
    blood_sugar: asNullableNumber(record.bloodSugar),
    sugar_type: record.sugarType ?? null,
    weight: asNullableNumber(record.weight),
    notes: asNullableString(record.notes),
    created_at: normalizeTimestampToIso(record.createdAt) || new Date().toISOString(),
    updated_at_ms: asNullableNumber(record.updatedAtMs),
  };
}

export function healthRecordFromRow(row: Partial<HealthRecordRow> & { id: string }): HealthRecord {
  const result: HealthRecord = {
    id: String(row.id),
    patientId: String(row.patient_id ?? ''),
    recordDate: String(row.record_date ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
  const recordTime = asOptionalString(row.record_time);
  if (recordTime !== undefined) result.recordTime = recordTime;
  const systolic = asOptionalNumber(row.systolic);
  if (systolic !== undefined) result.systolic = systolic;
  const diastolic = asOptionalNumber(row.diastolic);
  if (diastolic !== undefined) result.diastolic = diastolic;
  const bloodSugar = asOptionalNumber(row.blood_sugar);
  if (bloodSugar !== undefined) result.bloodSugar = bloodSugar;
  if (row.sugar_type === 'খালি পেটে' || row.sugar_type === 'খাওয়ার পরে') {
    result.sugarType = row.sugar_type;
  }
  const weight = asOptionalNumber(row.weight);
  if (weight !== undefined) result.weight = weight;
  const notes = asOptionalString(row.notes);
  if (notes !== undefined) result.notes = notes;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;
  return result;
}

// ============================================================================
// 5. appointments
// ============================================================================
export interface AppointmentRow {
  id: string;
  patient_id: string | null;
  doctor_name: string;
  specialty: string | null;
  appointment_date: string;
  appointment_time: string;
  location: string;
  notes: string | null;
  status: DoctorAppointment['status'];
  created_at: string;
  updated_at_ms: number | null;
}

export function appointmentToRow(apt: DoctorAppointment): AppointmentRow {
  return {
    id: apt.id,
    patient_id: asNullableString(apt.patientId),
    doctor_name: apt.doctorName ?? '',
    specialty: asNullableString(apt.specialty),
    appointment_date: apt.appointmentDate ?? '',
    appointment_time: apt.appointmentTime ?? '',
    location: apt.location ?? '',
    notes: asNullableString(apt.notes),
    status: apt.status || 'upcoming',
    created_at: normalizeTimestampToIso(apt.createdAt) || new Date().toISOString(),
    updated_at_ms: asNullableNumber(apt.updatedAtMs),
  };
}

export function appointmentFromRow(
  row: Partial<AppointmentRow> & { id: string }
): DoctorAppointment {
  const result: DoctorAppointment = {
    id: String(row.id),
    doctorName: String(row.doctor_name ?? ''),
    appointmentDate: String(row.appointment_date ?? ''),
    appointmentTime: String(row.appointment_time ?? ''),
    location: String(row.location ?? ''),
    status: (row.status as DoctorAppointment['status']) || 'upcoming',
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
  const patientId = asOptionalString(row.patient_id);
  if (patientId !== undefined) result.patientId = patientId;
  const specialty = asOptionalString(row.specialty);
  if (specialty !== undefined) result.specialty = specialty;
  const notes = asOptionalString(row.notes);
  if (notes !== undefined) result.notes = notes;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;
  return result;
}

// ============================================================================
// 6. doctors
// ============================================================================
export interface DoctorRow {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  whatsapp: string | null;
  hospital: string | null;
  address: string | null;
  visiting_hours: string | null;
  for_conditions: string | null;
  patient_ids: string[] | null;
  last_visit_date: string | null;
  next_visit_date: string | null;
  notes: string | null;
  is_emergency: boolean;
  created_at: string;
  updated_at: string;
}

export function doctorToRow(doctor: DoctorProfile): DoctorRow {
  const nowIso = new Date().toISOString();
  const createdAt = normalizeTimestampToIso(doctor.createdAt) || nowIso;
  const updatedAt = normalizeTimestampToIso(doctor.updatedAt) || nowIso;
  return {
    id: doctor.id,
    name: doctor.name ?? '',
    specialty: asNullableString(doctor.specialty),
    phone: asNullableString(doctor.phone),
    whatsapp: asNullableString(doctor.whatsapp),
    hospital: asNullableString(doctor.hospital),
    address: asNullableString(doctor.address),
    visiting_hours: asNullableString(doctor.visitingHours),
    for_conditions: asNullableString(doctor.forConditions),
    patient_ids:
      Array.isArray(doctor.patientIds) && doctor.patientIds.length > 0
        ? doctor.patientIds
        : null,
    last_visit_date: asNullableString(doctor.lastVisitDate),
    next_visit_date: asNullableString(doctor.nextVisitDate),
    notes: asNullableString(doctor.notes),
    is_emergency: Boolean(doctor.isEmergency),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function doctorFromRow(row: Partial<DoctorRow> & { id: string }): DoctorProfile {
  const result: DoctorProfile = {
    id: String(row.id),
    name: String(row.name ?? ''),
    isEmergency: Boolean(row.is_emergency),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
  const specialty = asOptionalString(row.specialty);
  if (specialty !== undefined) result.specialty = specialty;
  const phone = asOptionalString(row.phone);
  if (phone !== undefined) result.phone = phone;
  const whatsapp = asOptionalString(row.whatsapp);
  if (whatsapp !== undefined) result.whatsapp = whatsapp;
  const hospital = asOptionalString(row.hospital);
  if (hospital !== undefined) result.hospital = hospital;
  const address = asOptionalString(row.address);
  if (address !== undefined) result.address = address;
  const visitingHours = asOptionalString(row.visiting_hours);
  if (visitingHours !== undefined) result.visitingHours = visitingHours;
  const forConditions = asOptionalString(row.for_conditions);
  if (forConditions !== undefined) result.forConditions = forConditions;
  if (Array.isArray(row.patient_ids) && row.patient_ids.length > 0) {
    result.patientIds = asStringArray(row.patient_ids);
  }
  const lastVisitDate = asOptionalString(row.last_visit_date);
  if (lastVisitDate !== undefined) result.lastVisitDate = lastVisitDate;
  const nextVisitDate = asOptionalString(row.next_visit_date);
  if (nextVisitDate !== undefined) result.nextVisitDate = nextVisitDate;
  const notes = asOptionalString(row.notes);
  if (notes !== undefined) result.notes = notes;
  return result;
}

// ============================================================================
// 7. phonebook
// ============================================================================
export interface PhonebookRow {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  category: string | null;
  notes: string | null;
  is_emergency: boolean | null;
  patient_id: string | null;
  created_at: string | null;
  updated_at_ms: number | null;
}

export function phonebookToRow(entry: PhonebookEntry): PhonebookRow {
  return {
    id: entry.id,
    name: entry.name ?? '',
    phone: entry.phone ?? '',
    relation: asNullableString(entry.relation),
    category: asNullableString(entry.category),
    notes: asNullableString(entry.notes),
    is_emergency: entry.isEmergency !== undefined ? Boolean(entry.isEmergency) : null,
    patient_id: asNullableString(entry.patientId),
    created_at: normalizeTimestampToIso(entry.createdAt),
    updated_at_ms: asNullableNumber(entry.updatedAtMs),
  };
}

export function phonebookFromRow(row: Partial<PhonebookRow> & { id: string }): PhonebookEntry {
  const result: PhonebookEntry = {
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
  };
  const relation = asOptionalString(row.relation);
  if (relation !== undefined) result.relation = relation;
  const category = asOptionalString(row.category);
  if (category !== undefined) result.category = category;
  const notes = asOptionalString(row.notes);
  if (notes !== undefined) result.notes = notes;
  if (typeof row.is_emergency === 'boolean') result.isEmergency = row.is_emergency;
  const patientId = asOptionalString(row.patient_id);
  if (patientId !== undefined) result.patientId = patientId;
  const createdAt = asOptionalString(row.created_at);
  if (createdAt !== undefined) result.createdAt = createdAt;
  const updatedAtMs = asOptionalNumber(row.updated_at_ms);
  if (updatedAtMs !== undefined) result.updatedAtMs = updatedAtMs;
  return result;
}

// ============================================================================
// 8. user_settings
// ============================================================================
export interface UserSettingsRow {
  id: string;
  sound_enabled: boolean;
  selected_tone: ReminderSettings['selectedTone'];
  advance_minutes: number;
  snooze_duration_minutes: number;
  language: ReminderSettings['language'];
  theme_mode: ReminderSettings['themeMode'] | null;
  large_font_mode: boolean | null;
  easy_mode: boolean | null;
  voice_readout_enabled: boolean | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  caregiver_missed_dose_minutes: 15 | 30 | 60 | null;
  patient_self_phone: string | null;
  week_start_day: WeekStartDay | null;
  show_emergency_doctor_on_card: boolean | null;
  home_layout: HomeLayoutItem[] | null;
}

export function settingsToRow(
  settings: ReminderSettings,
  id: string = USER_SETTINGS_ROW_ID
): UserSettingsRow {
  return {
    id,
    sound_enabled: Boolean(settings.soundEnabled),
    selected_tone: settings.selectedTone || 'soft-bell',
    advance_minutes: Number.isFinite(Number(settings.advanceMinutes))
      ? Number(settings.advanceMinutes)
      : 10,
    snooze_duration_minutes: Number.isFinite(Number(settings.snoozeDurationMinutes))
      ? Number(settings.snoozeDurationMinutes)
      : 10,
    language: settings.language === 'en' ? 'en' : 'bn',
    theme_mode: settings.themeMode ?? null,
    large_font_mode:
      settings.largeFontMode !== undefined ? Boolean(settings.largeFontMode) : null,
    easy_mode: settings.easyMode !== undefined ? Boolean(settings.easyMode) : null,
    voice_readout_enabled:
      settings.voiceReadoutEnabled !== undefined
        ? Boolean(settings.voiceReadoutEnabled)
        : null,
    emergency_contact_name: asNullableString(settings.emergencyContactName),
    emergency_contact_phone: asNullableString(settings.emergencyContactPhone),
    caregiver_missed_dose_minutes: settings.caregiverMissedDoseMinutes ?? null,
    patient_self_phone: asNullableString(settings.patientSelfPhone),
    week_start_day: settings.weekStartDay ?? null,
    show_emergency_doctor_on_card:
      settings.showEmergencyDoctorOnCard !== undefined
        ? Boolean(settings.showEmergencyDoctorOnCard)
        : null,
    home_layout:
      Array.isArray(settings.homeLayout) && settings.homeLayout.length > 0
        ? normalizeHomeLayout(settings.homeLayout)
        : null,
  };
}

export function settingsFromRow(row: Partial<UserSettingsRow>): ReminderSettings {
  const result: ReminderSettings = {
    soundEnabled: row.sound_enabled !== undefined ? Boolean(row.sound_enabled) : true,
    selectedTone: (row.selected_tone as ReminderSettings['selectedTone']) || 'soft-bell',
    advanceMinutes: asOptionalNumber(row.advance_minutes) ?? 10,
    snoozeDurationMinutes: asOptionalNumber(row.snooze_duration_minutes) ?? 10,
    language: row.language === 'en' ? 'en' : 'bn',
  };

  if (row.theme_mode === 'light' || row.theme_mode === 'dark' || row.theme_mode === 'system') {
    result.themeMode = row.theme_mode;
  }
  if (typeof row.large_font_mode === 'boolean') result.largeFontMode = row.large_font_mode;
  if (typeof row.easy_mode === 'boolean') result.easyMode = row.easy_mode;
  if (typeof row.voice_readout_enabled === 'boolean') {
    result.voiceReadoutEnabled = row.voice_readout_enabled;
  }
  const emergencyContactName = asOptionalString(row.emergency_contact_name);
  if (emergencyContactName !== undefined) result.emergencyContactName = emergencyContactName;
  const emergencyContactPhone = asOptionalString(row.emergency_contact_phone);
  if (emergencyContactPhone !== undefined) result.emergencyContactPhone = emergencyContactPhone;
  if (
    row.caregiver_missed_dose_minutes === 15 ||
    row.caregiver_missed_dose_minutes === 30 ||
    row.caregiver_missed_dose_minutes === 60
  ) {
    result.caregiverMissedDoseMinutes = row.caregiver_missed_dose_minutes;
  }
  const patientSelfPhone = asOptionalString(row.patient_self_phone);
  if (patientSelfPhone !== undefined) result.patientSelfPhone = patientSelfPhone;
  if (
    row.week_start_day === 'saturday' ||
    row.week_start_day === 'sunday' ||
    row.week_start_day === 'monday'
  ) {
    result.weekStartDay = row.week_start_day;
  }
  if (typeof row.show_emergency_doctor_on_card === 'boolean') {
    result.showEmergencyDoctorOnCard = row.show_emergency_doctor_on_card;
  }
  if (Array.isArray(row.home_layout) && row.home_layout.length > 0) {
    result.homeLayout = normalizeHomeLayout(row.home_layout);
  }

  return result;
}

// ============================================================================
// 9. library_medicines (GlobalMedicine)
// ============================================================================
export interface LibraryMedicineRow {
  id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string;
  brand_name_bn: string | null;
  generic_name_bn: string | null;
  therapeutic_class: string | null;
  indication: string | null;
  price_per_unit: number | null;
  price_unit: string | null;
  package_description: string | null;
  dar_number: string | null;
  source: GlobalMedicine['source'];
  source_type: GlobalMedicine['sourceType'];
  source_name: string;
  license_reference: string;
  written_permission_ref: string | null;
  import_batch_id: string | null;
  imported_at: string;
  verified_by_admin: boolean;
  verification_notes: string | null;
  status: GlobalMedicine['status'];
  duplicate_key: string;
}

export function libraryMedicineToRow(med: GlobalMedicine): LibraryMedicineRow {
  const priceNum = asOptionalNumber(med.pricePerUnit);
  return {
    id: med.id,
    brand_name: med.brandName ?? '',
    generic_name: med.genericName ?? '',
    strength: med.strength ?? '',
    dosage_form: med.dosageForm ?? '',
    manufacturer: med.manufacturer ?? '',
    brand_name_bn: asNullableString(med.brandNameBn),
    generic_name_bn: asNullableString(med.genericNameBn),
    therapeutic_class: asNullableString(med.therapeuticClass),
    indication: asNullableString(med.indication),
    price_per_unit: priceNum !== undefined ? priceNum : null,
    price_unit: asNullableString(med.priceUnit),
    package_description: asNullableString(med.packageDescription),
    dar_number: asNullableString(med.darNumber),
    source: med.source || 'DGDA_GOV',
    source_type: med.sourceType || 'government',
    source_name: med.sourceName ?? '',
    license_reference: med.licenseReference ?? '',
    written_permission_ref: asNullableString(med.writtenPermissionRef),
    import_batch_id: asNullableString(med.importBatchId),
    imported_at: normalizeTimestampToIso(med.importedAt) ?? new Date().toISOString(),
    verified_by_admin: Boolean(med.verifiedByAdmin),
    verification_notes: asNullableString(med.verificationNotes),
    status: med.status || 'published',
    duplicate_key: med.duplicateKey ?? '',
  };
}

export function libraryMedicineFromRow(
  row: Partial<LibraryMedicineRow> & { id: string }
): GlobalMedicine {
  const result: GlobalMedicine = {
    id: String(row.id),
    brandName: String(row.brand_name ?? ''),
    genericName: String(row.generic_name ?? ''),
    strength: String(row.strength ?? ''),
    dosageForm: String(row.dosage_form ?? ''),
    manufacturer: String(row.manufacturer ?? ''),
    source: (row.source as GlobalMedicine['source']) || 'DGDA_GOV',
    sourceType: (row.source_type as GlobalMedicine['sourceType']) || 'government',
    sourceName: String(row.source_name ?? ''),
    licenseReference: String(row.license_reference ?? ''),
    importedAt: row.imported_at ?? new Date().toISOString(),
    verifiedByAdmin: Boolean(row.verified_by_admin),
    status: (row.status as GlobalMedicine['status']) || 'published',
    duplicateKey: String(row.duplicate_key ?? ''),
  };

  const brandNameBn = asOptionalString(row.brand_name_bn);
  if (brandNameBn !== undefined) result.brandNameBn = brandNameBn;
  const genericNameBn = asOptionalString(row.generic_name_bn);
  if (genericNameBn !== undefined) result.genericNameBn = genericNameBn;
  const therapeuticClass = asOptionalString(row.therapeutic_class);
  if (therapeuticClass !== undefined) result.therapeuticClass = therapeuticClass;
  const indication = asOptionalString(row.indication);
  if (indication !== undefined) result.indication = indication;
  const pricePerUnit = asOptionalNumber(row.price_per_unit);
  if (pricePerUnit !== undefined) result.pricePerUnit = pricePerUnit;
  const priceUnit = asOptionalString(row.price_unit);
  if (priceUnit !== undefined) result.priceUnit = priceUnit;
  const packageDescription = asOptionalString(row.package_description);
  if (packageDescription !== undefined) result.packageDescription = packageDescription;
  const darNumber = asOptionalString(row.dar_number);
  if (darNumber !== undefined) result.darNumber = darNumber;
  const writtenPermissionRef = asOptionalString(row.written_permission_ref);
  if (writtenPermissionRef !== undefined) result.writtenPermissionRef = writtenPermissionRef;
  const importBatchId = asOptionalString(row.import_batch_id);
  if (importBatchId !== undefined) result.importBatchId = importBatchId;
  const verificationNotes = asOptionalString(row.verification_notes);
  if (verificationNotes !== undefined) result.verificationNotes = verificationNotes;

  return result;
}

// ============================================================================
// 10. import_batches (ImportBatch — NO imported_by_uid column in Postgres)
// ============================================================================
export interface ImportBatchRow {
  id: string;
  source: ImportBatch['source'];
  source_profile: ImportBatch['sourceProfile'];
  source_type: ImportBatch['sourceType'];
  imported_at: string;
  imported_by_email: string;
  license_reference: string;
  written_permission_ref: string | null;
  legal_basis_notes: string | null;
  attestation_accepted: boolean;
  total_records_in_file: number;
  valid_records_count: number;
  duplicate_records_count: number;
  error_records_count: number;
  published_count: number;
  pending_verification_count: number | null;
  status: ImportBatch['status'];
  file_name: string | null;
}

export function importBatchToRow(batch: ImportBatch): ImportBatchRow {
  return {
    id: batch.id,
    source: batch.source || 'DGDA_GOV',
    source_profile: batch.sourceProfile || 'dgda_gov',
    source_type: batch.sourceType || 'government',
    imported_at: normalizeTimestampToIso(batch.importedAt) ?? new Date().toISOString(),
    imported_by_email: batch.importedByEmail ?? '',
    license_reference: batch.licenseReference ?? '',
    written_permission_ref: asNullableString(batch.writtenPermissionRef),
    legal_basis_notes: asNullableString(batch.legalBasisNotes),
    attestation_accepted: Boolean(batch.attestationAccepted),
    total_records_in_file: Number.isFinite(Number(batch.totalRecordsInFile))
      ? Number(batch.totalRecordsInFile)
      : 0,
    valid_records_count: Number.isFinite(Number(batch.validRecordsCount))
      ? Number(batch.validRecordsCount)
      : 0,
    duplicate_records_count: Number.isFinite(Number(batch.duplicateRecordsCount))
      ? Number(batch.duplicateRecordsCount)
      : 0,
    error_records_count: Number.isFinite(Number(batch.errorRecordsCount))
      ? Number(batch.errorRecordsCount)
      : 0,
    published_count: Number.isFinite(Number(batch.publishedCount))
      ? Number(batch.publishedCount)
      : 0,
    pending_verification_count: asNullableNumber(batch.pendingVerificationCount),
    status: batch.status || 'completed',
    file_name: asNullableString(batch.fileName),
  };
}

export function importBatchFromRow(row: Partial<ImportBatchRow> & { id: string }): ImportBatch {
  const result: ImportBatch = {
    id: String(row.id),
    source: (row.source as ImportBatch['source']) || 'DGDA_GOV',
    sourceProfile: (row.source_profile as ImportBatch['sourceProfile']) || 'dgda_gov',
    sourceType: (row.source_type as ImportBatch['sourceType']) || 'government',
    importedAt: row.imported_at ?? new Date().toISOString(),
    importedByUid: '',
    importedByEmail: String(row.imported_by_email ?? ''),
    licenseReference: String(row.license_reference ?? ''),
    attestationAccepted: Boolean(row.attestation_accepted),
    totalRecordsInFile: asOptionalNumber(row.total_records_in_file) ?? 0,
    validRecordsCount: asOptionalNumber(row.valid_records_count) ?? 0,
    duplicateRecordsCount: asOptionalNumber(row.duplicate_records_count) ?? 0,
    errorRecordsCount: asOptionalNumber(row.error_records_count) ?? 0,
    publishedCount: asOptionalNumber(row.published_count) ?? 0,
    status: (row.status as ImportBatch['status']) || 'completed',
  };

  const writtenPermissionRef = asOptionalString(row.written_permission_ref);
  if (writtenPermissionRef !== undefined) result.writtenPermissionRef = writtenPermissionRef;
  const legalBasisNotes = asOptionalString(row.legal_basis_notes);
  if (legalBasisNotes !== undefined) result.legalBasisNotes = legalBasisNotes;
  const pendingVerificationCount = asOptionalNumber(row.pending_verification_count);
  if (pendingVerificationCount !== undefined) {
    result.pendingVerificationCount = pendingVerificationCount;
  }
  const fileName = asOptionalString(row.file_name);
  if (fileName !== undefined) result.fileName = fileName;

  return result;
}

// ============================================================================
// 11. admin_activity (singular table name)
// ============================================================================
export interface AdminActivityRow {
  id: string;
  type: AdminActivity['type'];
  title: string;
  description: string;
  admin_email: string;
  timestamp: string;
  metadata: Record<string, any> | null;
}

export function adminActivityToRow(activity: AdminActivity): AdminActivityRow {
  return {
    id: activity.id,
    type: activity.type || 'system',
    title: activity.title ?? '',
    description: activity.description ?? '',
    admin_email: activity.adminEmail ?? '',
    timestamp: normalizeTimestampToIso(activity.timestamp) ?? new Date().toISOString(),
    metadata:
      activity.metadata && typeof activity.metadata === 'object' ? activity.metadata : null,
  };
}

export function adminActivityFromRow(
  row: Partial<AdminActivityRow> & { id: string }
): AdminActivity {
  const result: AdminActivity = {
    id: String(row.id),
    type: (row.type as AdminActivity['type']) || 'system',
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    adminEmail: String(row.admin_email ?? ''),
    timestamp: row.timestamp ?? new Date().toISOString(),
  };
  if (row.metadata && typeof row.metadata === 'object') {
    result.metadata = row.metadata;
  }
  return result;
}

// ============================================================================
// 12. medical_documents (maps date <-> doc_date; strips pendingCloudUpload)
// ============================================================================
export interface MedicalDocumentRow {
  id: string;
  kind: MedicalDocument['kind'];
  patient_id: string;
  doctor_id: string | null;
  title: string;
  doc_date: string;
  note: string | null;
  report_type: string | null;
  pages: MedicalDocumentPageMeta[];
  created_at: string;
  updated_at: string;
}

function sanitizeDocumentPages(pages: unknown): MedicalDocumentPageMeta[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .filter((p): p is MedicalDocumentPageMeta => Boolean(p && typeof p === 'object' && typeof (p as MedicalDocumentPageMeta).fileId === 'string'))
    .map((p) => {
      const rot = Number(p.rotation);
      const safeRot: 0 | 90 | 180 | 270 =
        rot === 90 || rot === 180 || rot === 270 ? rot : 0;
      return {
        fileId: String(p.fileId),
        thumb: typeof p.thumb === 'string' ? p.thumb : '',
        width: Number.isFinite(Number(p.width)) && Number(p.width) > 0 ? Math.round(Number(p.width)) : 240,
        height: Number.isFinite(Number(p.height)) && Number(p.height) > 0 ? Math.round(Number(p.height)) : 320,
        rotation: safeRot,
      };
    });
}

export function medicalDocumentToRow(
  doc: Omit<MedicalDocument, 'createdAt' | 'updatedAt'> & {
    createdAt?: unknown;
    updatedAt?: unknown;
    pendingCloudUpload?: boolean;
  }
): MedicalDocumentRow {
  // Strip any client-only flags such as pendingCloudUpload
  const nowIso = new Date().toISOString();
  const createdAt = normalizeTimestampToIso(doc.createdAt) ?? nowIso;
  const updatedAt = normalizeTimestampToIso(doc.updatedAt) ?? createdAt;

  return {
    id: doc.id,
    kind: doc.kind === 'report' ? 'report' : 'prescription',
    patient_id: doc.patientId ?? '',
    doctor_id: asNullableString(doc.doctorId),
    title: doc.title ?? '',
    doc_date: doc.date ?? '',
    note: asNullableString(doc.note),
    report_type: asNullableString(doc.reportType),
    pages: sanitizeDocumentPages(doc.pages),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function medicalDocumentFromRow(
  row: Partial<MedicalDocumentRow> & { id: string }
): MedicalDocument {
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  const result: MedicalDocument = {
    id: String(row.id),
    kind: row.kind === 'report' ? 'report' : 'prescription',
    patientId: String(row.patient_id ?? ''),
    title: String(row.title ?? ''),
    date: String(row.doc_date ?? ''),
    pages: sanitizeDocumentPages(row.pages),
    createdAt,
    updatedAt,
  };

  const doctorId = asOptionalString(row.doctor_id);
  if (doctorId !== undefined) result.doctorId = doctorId;
  const note = asOptionalString(row.note);
  if (note !== undefined) result.note = note;
  const reportType = asOptionalString(row.report_type);
  if (reportType !== undefined) result.reportType = reportType;

  return result;
}

// ============================================================================
// 13. feedback
// ============================================================================
export interface FeedbackRow {
  id: string;
  user_id?: string | null;
  message: string;
  app_version?: string | null;
  created_at: string;
}

export function feedbackFromRow(row: Partial<FeedbackRow> & { id: string }): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: String(row.id),
    message: String(row.message ?? ''),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
  const userId = asOptionalString(row.user_id);
  if (userId !== undefined) entry.userId = userId;
  const appVersion = asOptionalString(row.app_version);
  if (appVersion !== undefined) entry.appVersion = appVersion;
  return entry;
}

function isoToMillisSafe(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ============================================================================
// 14. shared_reports (omits owner_id on insert; Postgres sets auth.uid())
// ============================================================================
export interface SharedReportRow {
  token: string;
  owner_id?: string | null;
  patient_name: string;
  age: number | null;
  gender: string | null;
  relation: string | null;
  sections: SharedReportSections;
  created_at: string;
  expires_at: string;
  revoked: boolean;
}

export function sharedReportToRow(
  report: Omit<SharedReportDoc, 'ownerUid'>
): Omit<SharedReportRow, 'owner_id'> {
  const nowIso = new Date().toISOString();
  const createdAt =
    normalizeTimestampToIso(report.createdAt) ??
    (typeof report.createdAtMs === 'number' && report.createdAtMs > 0
      ? new Date(report.createdAtMs).toISOString()
      : nowIso);
  const expiresAt =
    normalizeTimestampToIso(report.expiresAt) ??
    (typeof report.expiresAtMs === 'number' && report.expiresAtMs > 0
      ? new Date(report.expiresAtMs).toISOString()
      : nowIso);

  return {
    token: report.token,
    patient_name: report.patientName ?? '',
    age: asNullableNumber(report.age),
    gender: asNullableString(report.gender),
    relation: asNullableString(report.relation),
    sections: report.sections && typeof report.sections === 'object' ? report.sections : {},
    created_at: createdAt,
    expires_at: expiresAt,
    revoked: Boolean(report.revoked),
  };
}

export function sharedReportFromRow(
  row: Partial<SharedReportRow> & {
    token?: string;
    patientName?: string;
    createdAt?: string;
    expiresAt?: string;
  }
): SharedReportDoc {
  const createdAt = row.created_at ?? row.createdAt ?? new Date().toISOString();
  const expiresAt = row.expires_at ?? row.expiresAt ?? new Date().toISOString();
  const doc: SharedReportDoc = {
    ownerUid: String(row.owner_id ?? ''),
    token: String(row.token ?? ''),
    createdAt,
    expiresAt,
    createdAtMs: isoToMillisSafe(createdAt),
    expiresAtMs: isoToMillisSafe(expiresAt),
    patientName: String(row.patient_name ?? row.patientName ?? ''),
    sections: row.sections && typeof row.sections === 'object' ? row.sections : {},
    revoked: Boolean(row.revoked),
  };

  const age = asOptionalNumber(row.age);
  if (age !== undefined) doc.age = age;
  const gender = asOptionalString(row.gender);
  if (gender !== undefined) doc.gender = gender;
  const relation = asOptionalString(row.relation);
  if (relation !== undefined) doc.relation = relation;

  return doc;
}

// ============================================================================
// 15. emergency_cards (packs/unpacks data jsonb; omits owner_id on insert)
// ============================================================================
export interface EmergencyCardDataJson {
  age?: number;
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  contactName?: string;
  contactPhone?: string;
  medicines?: string;
  doctorName?: string;
}

export interface EmergencyCardRow {
  token: string;
  owner_id?: string | null;
  patient_name: string;
  data: EmergencyCardDataJson;
  created_at: string;
  active: boolean;
}

export function emergencyCardToRow(
  card: Omit<EmergencyCardDoc, 'ownerUid'>
): Omit<EmergencyCardRow, 'owner_id'> {
  const nowIso = new Date().toISOString();
  const createdAt =
    normalizeTimestampToIso(card.createdAt) ??
    (typeof card.createdAtMs === 'number' && card.createdAtMs > 0
      ? new Date(card.createdAtMs).toISOString()
      : nowIso);

  const data: EmergencyCardDataJson = {};
  if (typeof card.age === 'number' && Number.isFinite(card.age)) data.age = card.age;
  if (card.bloodGroup !== undefined) data.bloodGroup = card.bloodGroup;
  if (card.allergies !== undefined) data.allergies = card.allergies;
  if (card.conditions !== undefined) data.conditions = card.conditions;
  if (card.contactName !== undefined) data.contactName = card.contactName;
  if (card.contactPhone !== undefined) data.contactPhone = card.contactPhone;
  if (card.medicines !== undefined) data.medicines = card.medicines;
  if (card.doctorName !== undefined) data.doctorName = card.doctorName;

  return {
    token: card.token,
    patient_name: card.patientName ?? '',
    data,
    created_at: createdAt,
    active: card.active !== false,
  };
}

export function emergencyCardFromRow(
  row: Partial<EmergencyCardRow> & {
    token?: string;
    patientName?: string;
    createdAt?: string;
  }
): EmergencyCardDoc {
  const createdAt = row.created_at ?? row.createdAt ?? new Date().toISOString();
  const data = row.data && typeof row.data === 'object' ? row.data : {};

  const doc: EmergencyCardDoc = {
    ownerUid: String(row.owner_id ?? ''),
    token: String(row.token ?? ''),
    createdAt,
    createdAtMs: isoToMillisSafe(createdAt),
    patientName: String(row.patient_name ?? row.patientName ?? ''),
    active: row.active !== false,
  };

  if (typeof data.age === 'number' && Number.isFinite(data.age)) doc.age = data.age;
  if (typeof data.bloodGroup === 'string') doc.bloodGroup = data.bloodGroup;
  if (typeof data.allergies === 'string') doc.allergies = data.allergies;
  if (typeof data.conditions === 'string') doc.conditions = data.conditions;
  if (typeof data.contactName === 'string') doc.contactName = data.contactName;
  if (typeof data.contactPhone === 'string') doc.contactPhone = data.contactPhone;
  if (typeof data.medicines === 'string') doc.medicines = data.medicines;
  if (typeof data.doctorName === 'string') doc.doctorName = data.doctorName;

  return doc;
}

// ============================================================================
// 16. guest_views (omits owner_id on insert)
// ============================================================================
export interface GuestViewRow {
  token: string;
  owner_id?: string | null;
  patient_name: string;
  snapshot: GuestViewSnapshot;
  created_at: string;
  updated_at: string;
  expires_at: string;
  active: boolean;
}

export function guestViewToRow(
  view: Omit<GuestViewDoc, 'ownerUid'>
): Omit<GuestViewRow, 'owner_id'> {
  const nowIso = new Date().toISOString();
  return {
    token: view.token,
    patient_name: view.patientName ?? '',
    snapshot: view.snapshot,
    created_at: normalizeTimestampToIso(view.createdAt) ?? nowIso,
    updated_at: normalizeTimestampToIso(view.updatedAt) ?? nowIso,
    expires_at: normalizeTimestampToIso(view.expiresAt) ?? nowIso,
    active: view.active !== false,
  };
}

export function guestViewFromRow(
  row: Partial<GuestViewRow> & {
    token?: string;
    patientName?: string;
    updatedAt?: string;
    expiresAt?: string;
    createdAt?: string;
  }
): GuestViewDoc {
  const createdAt = row.created_at ?? row.createdAt ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? row.updatedAt ?? createdAt;
  const expiresAt = row.expires_at ?? row.expiresAt ?? createdAt;
  const rawSnapshot = row.snapshot;
  const fallbackSlots: GuestViewSnapshot['slots'] = {
    'সকাল': [],
    'দুপুর': [],
    'সন্ধ্যা': [],
    'রাত': [],
  };
  const snapshot: GuestViewSnapshot =
    rawSnapshot && typeof rawSnapshot === 'object'
      ? {
          patientName: String(rawSnapshot.patientName ?? row.patient_name ?? row.patientName ?? ''),
          slots: {
            'সকাল': Array.isArray(rawSnapshot.slots?.['সকাল']) ? rawSnapshot.slots['সকাল'] : [],
            'দুপুর': Array.isArray(rawSnapshot.slots?.['দুপুর']) ? rawSnapshot.slots['দুপুর'] : [],
            'সন্ধ্যা': Array.isArray(rawSnapshot.slots?.['সন্ধ্যা']) ? rawSnapshot.slots['সন্ধ্যা'] : [],
            'রাত': Array.isArray(rawSnapshot.slots?.['রাত']) ? rawSnapshot.slots['রাত'] : [],
          },
          generatedAt: String(rawSnapshot.generatedAt ?? updatedAt),
        }
      : {
          patientName: String(row.patient_name ?? row.patientName ?? ''),
          slots: fallbackSlots,
          generatedAt: updatedAt,
        };

  return {
    token: String(row.token ?? ''),
    ownerUid: String(row.owner_id ?? ''),
    patientName: String(row.patient_name ?? row.patientName ?? snapshot.patientName ?? ''),
    snapshot,
    createdAt,
    updatedAt,
    expiresAt,
    createdAtMs: isoToMillisSafe(createdAt),
    updatedAtMs: isoToMillisSafe(updatedAt),
    expiresAtMs: isoToMillisSafe(expiresAt),
    active: row.active !== false,
  };
}

// ============================================================================
// 17. caregiver_links (omits patient_uid on insert; caregiver_uid nullable)
// ============================================================================
export interface CaregiverLinkRow {
  id: string;
  invite_code: string;
  patient_uid?: string | null;
  caregiver_uid: string | null;
  patient_name: string;
  caregiver_name: string;
  patient_phone: string | null;
  status: 'pending' | 'active';
  allow_full_view: boolean;
  allow_suggestions: boolean;
  expires_at: string;
  linked_at: string | null;
  today_summary: CaregiverTodaySummary | null;
  shared_medicines: CaregiverFullMedicineItem[] | null;
  created_at: string;
  updated_at: string;
}

export function caregiverLinkToRow(
  link: Omit<CaregiverLinkDoc, 'patientUid'> & { patientUid?: string }
): Omit<CaregiverLinkRow, 'patient_uid'> {
  const nowIso = new Date().toISOString();
  const expiresAt =
    normalizeTimestampToIso(link.expiresAt) ??
    (typeof link.expiresAtMs === 'number' && link.expiresAtMs > 0
      ? new Date(link.expiresAtMs).toISOString()
      : nowIso);

  return {
    id: link.id,
    invite_code: link.inviteCode,
    caregiver_uid: link.caregiverUid && link.caregiverUid.trim() ? link.caregiverUid.trim() : null,
    patient_name: link.patientName ?? '',
    caregiver_name: link.caregiverName ?? '',
    patient_phone: asNullableString(link.patientPhone),
    status: link.status === 'active' ? 'active' : 'pending',
    allow_full_view: Boolean(link.allowFullView),
    allow_suggestions: link.allowSuggestions !== false,
    expires_at: expiresAt,
    linked_at: asNullableString(normalizeTimestampToIso(link.linkedAt)),
    today_summary: link.todaySummary ?? null,
    shared_medicines: Array.isArray(link.sharedMedicines) ? link.sharedMedicines : null,
    created_at: normalizeTimestampToIso(link.createdAt) ?? nowIso,
    updated_at: normalizeTimestampToIso(link.updatedAt) ?? nowIso,
  };
}

export function caregiverLinkFromRow(
  row: Partial<CaregiverLinkRow> & { id: string }
): CaregiverLinkDoc {
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  const expiresAt = row.expires_at ?? createdAt;

  const doc: CaregiverLinkDoc = {
    id: String(row.id),
    inviteCode: String(row.invite_code ?? row.id),
    patientUid: String(row.patient_uid ?? ''),
    caregiverUid: row.caregiver_uid ? String(row.caregiver_uid) : '',
    patientName: String(row.patient_name ?? ''),
    caregiverName: String(row.caregiver_name ?? ''),
    status: row.status === 'active' ? 'active' : 'pending',
    allowFullView: Boolean(row.allow_full_view),
    allowSuggestions: row.allow_suggestions !== false,
    createdAt,
    expiresAt,
    expiresAtMs: isoToMillisSafe(expiresAt),
    updatedAt,
  };

  const phone = asOptionalString(row.patient_phone);
  if (phone !== undefined) doc.patientPhone = phone;
  const linkedAt = asOptionalString(row.linked_at);
  if (linkedAt !== undefined) doc.linkedAt = linkedAt;
  if (row.today_summary && typeof row.today_summary === 'object') {
    doc.todaySummary = row.today_summary;
  }
  if (Array.isArray(row.shared_medicines)) {
    doc.sharedMedicines = row.shared_medicines;
  }

  return doc;
}

// ============================================================================
// 18. caregiver_suggestions (omits caregiver_uid on insert; Postgres defaults auth.uid())
// ============================================================================
export interface CaregiverSuggestionRow {
  id: string;
  patient_uid: string;
  caregiver_uid?: string | null;
  link_id: string;
  caregiver_name: string;
  patient_name: string | null;
  kind: CaregiverSuggestionDoc['kind'];
  medicine: CaregiverSuggestedMedicinePayload;
  target_medicine_id: string | null;
  target_medicine_name: string | null;
  note: string | null;
  status: CaregiverSuggestionDoc['status'];
  created_at: string;
}

export function caregiverSuggestionToRow(
  sug: Omit<CaregiverSuggestionDoc, 'caregiverUid'> & { caregiverUid?: string }
): Omit<CaregiverSuggestionRow, 'caregiver_uid'> {
  const createdAt =
    normalizeTimestampToIso(sug.createdAt) ??
    (typeof sug.createdAtMs === 'number' && sug.createdAtMs > 0
      ? new Date(sug.createdAtMs).toISOString()
      : new Date().toISOString());

  return {
    id: sug.id,
    patient_uid: sug.patientUid,
    link_id: sug.linkId,
    caregiver_name: sug.caregiverName ?? '',
    patient_name: asNullableString(sug.patientName),
    kind: sug.kind,
    medicine: sug.medicine,
    target_medicine_id: asNullableString(sug.targetMedicineId),
    target_medicine_name: asNullableString(sug.targetMedicineName),
    note: asNullableString(sug.note),
    status: sug.status ?? 'pending',
    created_at: createdAt,
  };
}

export function caregiverSuggestionFromRow(
  row: Partial<CaregiverSuggestionRow> & { id: string }
): CaregiverSuggestionDoc {
  const createdAt = row.created_at ?? new Date().toISOString();
  const doc: CaregiverSuggestionDoc = {
    id: String(row.id),
    patientUid: String(row.patient_uid ?? ''),
    caregiverUid: String(row.caregiver_uid ?? ''),
    linkId: String(row.link_id ?? ''),
    caregiverName: String(row.caregiver_name ?? ''),
    kind: (row.kind as CaregiverSuggestionDoc['kind']) || 'add',
    medicine: row.medicine as CaregiverSuggestedMedicinePayload,
    status: (row.status as CaregiverSuggestionDoc['status']) || 'pending',
    createdAt,
    createdAtMs: isoToMillisSafe(createdAt),
  };

  const patientName = asOptionalString(row.patient_name);
  if (patientName !== undefined) doc.patientName = patientName;
  const targetMedicineId = asOptionalString(row.target_medicine_id);
  if (targetMedicineId !== undefined) doc.targetMedicineId = targetMedicineId;
  const targetMedicineName = asOptionalString(row.target_medicine_name);
  if (targetMedicineName !== undefined) doc.targetMedicineName = targetMedicineName;
  const note = asOptionalString(row.note);
  if (note !== undefined) doc.note = note;

  return doc;
}

// ============================================================================
// 19. family_alerts (omits patient_uid on insert; uses alert_date)
// ============================================================================
export interface FamilyAlertRow {
  id: string;
  patient_uid?: string | null;
  caregiver_uids: string[];
  caregiver_link_ids: string[];
  type: FamilyAlertDoc['type'];
  medicine_id: string;
  medicine_name: string;
  slot: string | null;
  alert_date: string;
  message: string;
  patient_name: string | null;
  patient_phone: string | null;
  seen_by: string[];
  created_at: string;
}

export function familyAlertToRow(
  alert: Omit<FamilyAlertDoc, 'patientUid'> & { patientUid?: string }
): Omit<FamilyAlertRow, 'patient_uid'> {
  const createdAt =
    normalizeTimestampToIso(alert.createdAt) ??
    (typeof alert.createdAtMs === 'number' && alert.createdAtMs > 0
      ? new Date(alert.createdAtMs).toISOString()
      : new Date().toISOString());

  return {
    id: alert.id,
    caregiver_uids: Array.isArray(alert.caregiverUids) ? alert.caregiverUids : [],
    caregiver_link_ids: Array.isArray(alert.caregiverLinkIds) ? alert.caregiverLinkIds : [],
    type: alert.type,
    medicine_id: alert.medicineId ?? '',
    medicine_name: alert.medicineName ?? '',
    slot: asNullableString(alert.slot),
    alert_date: alert.date ?? '',
    message: alert.message ?? '',
    patient_name: asNullableString(alert.patientName),
    patient_phone: asNullableString(alert.patientPhone),
    seen_by: Array.isArray(alert.seenBy) ? alert.seenBy : [],
    created_at: createdAt,
  };
}

export function familyAlertFromRow(
  row: Partial<FamilyAlertRow> & { id: string }
): FamilyAlertDoc {
  const createdAt = row.created_at ?? new Date().toISOString();
  const doc: FamilyAlertDoc = {
    id: String(row.id),
    patientUid: String(row.patient_uid ?? ''),
    caregiverUids: asStringArray(row.caregiver_uids),
    caregiverLinkIds: asStringArray(row.caregiver_link_ids),
    type: row.type === 'low_stock' ? 'low_stock' : 'missed_dose',
    medicineId: String(row.medicine_id ?? ''),
    medicineName: String(row.medicine_name ?? ''),
    date: String(row.alert_date ?? ''),
    message: String(row.message ?? ''),
    createdAt,
    createdAtMs: isoToMillisSafe(createdAt),
    seenBy: asStringArray(row.seen_by),
  };

  const slot = asOptionalString(row.slot);
  if (slot !== undefined) doc.slot = slot as TimeSlot;
  const patientName = asOptionalString(row.patient_name);
  if (patientName !== undefined) doc.patientName = patientName;
  const patientPhone = asOptionalString(row.patient_phone);
  if (patientPhone !== undefined) doc.patientPhone = patientPhone;

  return doc;
}

// ============================================================================
// 20. cycle_logs (omits user_id on insert/upsert; Postgres defaults auth.uid())
// ============================================================================
export interface CycleLogRow {
  id: string;
  user_id?: string;
  patient_id: string;
  start_date: string;
  end_date: string | null;
  flow: string | null;
  pain_level: number | null;
  symptoms: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeCycleFlow(val: unknown): CycleFlow | undefined {
  if (val === 'হালকা' || val === 'মাঝারি' || val === 'ভারী') return val;
  return undefined;
}

export function cycleLogToRow(log: CycleLog): Omit<CycleLogRow, 'user_id'> {
  const nowIso = new Date().toISOString();
  const createdAt = normalizeTimestampToIso(log.createdAt) ?? nowIso;
  const updatedAt =
    normalizeTimestampToIso(log.updatedAt) ??
    (typeof log.updatedAtMs === 'number' && log.updatedAtMs > 0
      ? new Date(log.updatedAtMs).toISOString()
      : nowIso);

  const clampedPain =
    typeof log.painLevel === 'number' && Number.isFinite(log.painLevel)
      ? Math.max(0, Math.min(10, Math.round(log.painLevel)))
      : null;

  return {
    id: log.id,
    patient_id: log.patientId,
    start_date: log.startDate,
    end_date: asNullableString(log.endDate && log.endDate.trim() ? log.endDate.trim() : null),
    flow: normalizeCycleFlow(log.flow) ?? null,
    pain_level: clampedPain,
    symptoms: Array.isArray(log.symptoms) ? log.symptoms.filter((s) => typeof s === 'string' && s.trim()) : [],
    notes: asNullableString(log.notes && log.notes.trim() ? log.notes.trim() : null),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function cycleLogFromRow(row: Partial<CycleLogRow> & { id: string }): CycleLog {
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;

  const log: CycleLog = {
    id: String(row.id),
    patientId: String(row.patient_id ?? ''),
    startDate: String(row.start_date ?? ''),
    createdAt,
    updatedAt,
    updatedAtMs: isoToMillisSafe(updatedAt) || isoToMillisSafe(createdAt),
  };

  const endDate = asOptionalString(row.end_date);
  if (endDate && endDate.trim()) log.endDate = endDate.trim();
  const flow = normalizeCycleFlow(row.flow);
  if (flow) log.flow = flow;
  if (typeof row.pain_level === 'number' && Number.isFinite(row.pain_level)) {
    log.painLevel = Math.max(0, Math.min(10, Math.round(row.pain_level)));
  }
  if (Array.isArray(row.symptoms)) {
    log.symptoms = row.symptoms.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  const notes = asOptionalString(row.notes);
  if (notes && notes.trim()) log.notes = notes;

  return log;
}

// ============================================================================
// 21. expenses (omits user_id on insert/upsert; Postgres defaults auth.uid())
// ============================================================================
export interface ExpenseRow {
  id: string;
  user_id?: string;
  patient_id: string | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  title: string;
  medicine_id: string | null;
  notes: string | null;
  updated_at_ms: number | null;
  created_at: string;
  updated_at: string;
}

const VALID_EXPENSE_CATEGORIES: ReadonlySet<string> = new Set([
  'ওষুধ',
  'ডাক্তারের ফি',
  'পরীক্ষা (টেস্ট)',
  'হাসপাতাল',
  'অন্যান্য',
]);

function normalizeExpenseCategory(val: unknown): ExpenseCategory {
  if (typeof val === 'string' && VALID_EXPENSE_CATEGORIES.has(val)) {
    return val as ExpenseCategory;
  }
  return 'অন্যান্য';
}

export function expenseToRow(expense: Expense): Omit<ExpenseRow, 'user_id'> {
  const nowIso = new Date().toISOString();
  const createdAt = normalizeTimestampToIso(expense.createdAt) ?? nowIso;
  const updatedAt =
    normalizeTimestampToIso(expense.updatedAt) ??
    (typeof expense.updatedAtMs === 'number' && expense.updatedAtMs > 0
      ? new Date(expense.updatedAtMs).toISOString()
      : nowIso);
  const rawAmt = asOptionalNumber(expense.amount) ?? 0;
  const clampedAmt = Math.max(0, Math.min(100_000_000, Math.round(rawAmt * 100) / 100));

  return {
    id: expense.id,
    patient_id: asNullableString(expense.patientId && expense.patientId.trim() ? expense.patientId.trim() : null),
    expense_date: expense.expenseDate ?? new Date().toISOString().slice(0, 10),
    category: normalizeExpenseCategory(expense.category),
    amount: clampedAmt,
    title: (expense.title ?? '').trim(),
    medicine_id: asNullableString(expense.medicineId && expense.medicineId.trim() ? expense.medicineId.trim() : null),
    notes: asNullableString(expense.notes && expense.notes.trim() ? expense.notes.trim() : null),
    updated_at_ms: asNullableNumber(expense.updatedAtMs),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function expenseFromRow(row: Partial<ExpenseRow> & { id: string }): Expense {
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  const rawAmt = asOptionalNumber(row.amount) ?? 0;

  const expense: Expense = {
    id: String(row.id),
    expenseDate: String(row.expense_date ?? createdAt.slice(0, 10)),
    category: normalizeExpenseCategory(row.category),
    amount: Math.max(0, Math.min(100_000_000, Math.round(rawAmt * 100) / 100)),
    title: String(row.title ?? ''),
    createdAt,
    updatedAt,
    updatedAtMs:
      asOptionalNumber(row.updated_at_ms) ??
      (isoToMillisSafe(updatedAt) || isoToMillisSafe(createdAt)),
  };

  const patientId = asOptionalString(row.patient_id);
  if (patientId && patientId.trim()) expense.patientId = patientId.trim();
  const medicineId = asOptionalString(row.medicine_id);
  if (medicineId && medicineId.trim()) expense.medicineId = medicineId.trim();
  const notes = asOptionalString(row.notes);
  if (notes && notes.trim()) expense.notes = notes;

  return expense;
}

// ============================================================================
// 22. announcements
// ============================================================================
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by?: string | null;
  created_at: string;
}

function normalizeAnnouncementLevel(val: unknown): AnnouncementLevel {
  if (val === 'warning' || val === 'success') return val;
  return 'info';
}

export function announcementFromRow(
  row: Partial<AnnouncementRow> & { id: string }
): Announcement {
  const res: Announcement = {
    id: String(row.id),
    title: String(row.title ?? '').trim(),
    body: String(row.body ?? '').trim(),
    level: normalizeAnnouncementLevel(row.level),
    active: row.active !== false,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
  const startsAt = asOptionalString(row.starts_at);
  if (startsAt && startsAt.trim()) res.startsAt = startsAt;
  const endsAt = asOptionalString(row.ends_at);
  if (endsAt && endsAt.trim()) res.endsAt = endsAt;
  const createdBy = asOptionalString(row.created_by);
  if (createdBy && createdBy.trim()) res.createdBy = createdBy;
  return res;
}

export function announcementToInsertRow(input: {
  title: string;
  body: string;
  level: AnnouncementLevel;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): Omit<AnnouncementRow, 'id' | 'created_at' | 'created_by'> {
  return {
    title: input.title.trim().slice(0, 120),
    body: input.body.trim().slice(0, 1000),
    level: normalizeAnnouncementLevel(input.level),
    active: input.active !== false,
    starts_at: input.startsAt && input.startsAt.trim() ? normalizeTimestampToIso(input.startsAt) : null,
    ends_at: input.endsAt && input.endsAt.trim() ? normalizeTimestampToIso(input.endsAt) : null,
  };
}

// ============================================================================
// 23. library_misses
// ============================================================================
export interface LibraryMissRow {
  id: string;
  query_norm: string;
  hit_count: number;
  last_seen: string;
  resolved: boolean;
  created_at?: string;
}

export function libraryMissFromRow(
  row: Partial<LibraryMissRow> & { id: string }
): LibraryMiss {
  const miss: LibraryMiss = {
    id: String(row.id),
    queryNorm: String(row.query_norm ?? ''),
    hitCount: asOptionalNumber(row.hit_count) ?? 1,
    lastSeen: String(row.last_seen ?? row.created_at ?? new Date().toISOString()),
    resolved: Boolean(row.resolved),
  };
  const createdAt = asOptionalString(row.created_at);
  if (createdAt) miss.createdAt = createdAt;
  return miss;
}


