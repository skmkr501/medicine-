import {
  DoctorAppointment,
  DoctorProfile,
  DoseLog,
  DoseSchedule,
  HealthRecord,
  Medicine,
  PatientProfile,
  PhonebookEntry,
  ReminderSettings,
  StockAdjustment,
  WeekStartDay,
} from '../types';

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
  is_archived: boolean | null;
  archived_at: string | null;
  updated_at_ms: number | null;
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

  return result;
}
