import {
  Medicine,
  PatientProfile,
  DoseLog,
  HealthRecord,
  DoctorAppointment,
  ReminderSettings,
} from '../types';

export const DEMO_CLEANUP_FLAG = 'shasthobondhu_demo_cleaned_v1';

export const DEMO_PATIENT_IDS = new Set(['patient-1', 'patient-2', 'patient-3']);
export const DEMO_MEDICINE_IDS = new Set(['med-1', 'med-2', 'med-3', 'med-4', 'med-5', 'med-6']);
export const DEMO_LOG_IDS = new Set([
  'log-1',
  'log-2',
  'log-3',
  'log-4',
  'log-5',
  'log-6',
  'log-7',
  'log-8',
  'log-9',
  'log-10',
  'log-11',
]);
export const DEMO_HEALTH_IDS = new Set(['hr-1', 'hr-2', 'hr-3', 'hr-4', 'hr-5']);
export const DEMO_APPOINTMENT_IDS = new Set(['apt-1', 'apt-2']);

export const DEMO_ID_PREFIXES = ['patient-fictional-', 'med-fic-', 'log-fic-', 'sch-fic-'];

export type UserDataCollection =
  | 'patients'
  | 'medicines'
  | 'doseLogs'
  | 'healthRecords'
  | 'appointments';

export function hasDemoPrefix(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return DEMO_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export function isDemoRecordId(id: string, collection?: UserDataCollection): boolean {
  if (!id || typeof id !== 'string') return false;
  if (hasDemoPrefix(id)) return true;

  if (!collection || collection === 'patients') {
    if (DEMO_PATIENT_IDS.has(id)) return true;
  }
  if (!collection || collection === 'medicines') {
    if (DEMO_MEDICINE_IDS.has(id)) return true;
  }
  if (!collection || collection === 'doseLogs') {
    if (DEMO_LOG_IDS.has(id)) return true;
  }
  if (!collection || collection === 'healthRecords') {
    if (DEMO_HEALTH_IDS.has(id)) return true;
  }
  if (!collection || collection === 'appointments') {
    if (DEMO_APPOINTMENT_IDS.has(id)) return true;
  }

  return false;
}

export function filterOutDemoRecords<T extends { id: string }>(
  records: T[],
  collection: UserDataCollection
): T[] {
  if (!Array.isArray(records)) return [];
  const filtered = records.filter((item) => item && !isDemoRecordId(item.id, collection));
  if (collection === 'medicines') {
    return filtered.map((med: any) => {
      if (Array.isArray(med.schedules) && med.schedules.some((s: any) => hasDemoPrefix(s?.id))) {
        return {
          ...med,
          schedules: med.schedules.filter((s: any) => !hasDemoPrefix(s?.id)),
        };
      }
      return med;
    });
  }
  return filtered;
}

export function stripDemoEmergencyContact(settings: ReminderSettings): ReminderSettings {
  if (
    settings.emergencyContactName === 'তানভীর করিম (ছেলে)' &&
    settings.emergencyContactPhone === '+8801711223344'
  ) {
    return {
      ...settings,
      emergencyContactName: '',
      emergencyContactPhone: '',
    };
  }
  return settings;
}

export interface CleanedLocalPayload {
  patients: PatientProfile[];
  medicines: Medicine[];
  doseLogs: DoseLog[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  settings: ReminderSettings;
  removedCount: number;
}

export function cleanDemoDataSnapshot(input: {
  patients: PatientProfile[];
  medicines: Medicine[];
  doseLogs: DoseLog[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  settings: ReminderSettings;
}): CleanedLocalPayload {
  const patients = filterOutDemoRecords(input.patients, 'patients');
  const medicines = filterOutDemoRecords(input.medicines, 'medicines');
  const doseLogs = filterOutDemoRecords(input.doseLogs, 'doseLogs');
  const healthRecords = filterOutDemoRecords(input.healthRecords, 'healthRecords');
  const appointments = filterOutDemoRecords(input.appointments, 'appointments');
  const settings = stripDemoEmergencyContact(input.settings);

  const removedCount =
    (input.patients.length - patients.length) +
    (input.medicines.length - medicines.length) +
    (input.doseLogs.length - doseLogs.length) +
    (input.healthRecords.length - healthRecords.length) +
    (input.appointments.length - appointments.length);

  return {
    patients,
    medicines,
    doseLogs,
    healthRecords,
    appointments,
    settings,
    removedCount,
  };
}
