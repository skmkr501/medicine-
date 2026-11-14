/**
 * Android APK WebView Native Reminders Bridge
 * Synchronously communicates with window.AndroidReminders when running inside the Android APK.
 * Safely falls back to no-op in standard web browsers.
 */

import { Medicine, PatientProfile } from '../types';

export interface AndroidRemindersBridge {
  syncReminders: (jsonString: string) => string;
  clearAll: () => void;
  getPermissionStatus: () => string;
  openExactAlarmSettings: () => void;
  openBatterySettings: () => void;
  requestNotificationPermission: () => void;
  scheduleTestAlarm: () => boolean;
  getAlarmTone?: () => string;
  pickAlarmTone?: () => void;
  pickAlarmToneFromFiles?: () => void;
  previewAlarmTone?: () => void;
  stopPreview?: () => void;
  resetAlarmTone?: () => void;
  setVoiceEnabled?: (enabled: boolean) => void;
}

declare global {
  interface Window {
    AndroidReminders?: AndroidRemindersBridge;
  }
}

export interface NativeReminderItem {
  reminderId: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  patientName: string;
  dosage: string;
  mealTiming: string;
  timeSlot: string;
  hour: number; // 0-23
  minute: number; // 0-59
  active: boolean;
}

export interface NativePermissionStatus {
  exactAlarm: boolean;
  notifications: boolean;
  batteryUnrestricted: boolean;
}

export interface NativeAlarmToneInfo {
  name: string;
  isDefault: boolean;
}

/**
 * Checks if the app is currently running inside an Android APK with window.AndroidReminders bridge.
 */
export const isNativeRemindersAvailable = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof window.AndroidReminders !== 'undefined' &&
    window.AndroidReminders !== null
  );
};

/**
 * Converts Bengali digits (০-৯) to standard English ASCII digits (0-9).
 */
export const convertBengaliDigitsToEnglish = (str: string): string => {
  const bengaliToEnglish: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return str.replace(/[০-৯]/g, (digit) => bengaliToEnglish[digit] || digit);
};

/**
 * Parses schedule time strings in Bengali or English formats:
 * e.g. "০৮:০০ AM", "08:30 PM", "১২:০০ AM", "12:00 PM", "01:15 pm", "14:30"
 * Returns { hour (0-23), minute (0-59) } or null if invalid.
 */
export const parseReminderTime = (
  timeStr: string
): { hour: number; minute: number } | null => {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  // Convert Bengali numerals to English numerals
  const normalized = convertBengaliDigitsToEnglish(timeStr.trim());

  // Match: "08:30 AM", "8:30PM", "12:00 AM", "14:30", "01:45"
  const match = normalized.match(
    /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(AM|PM|am|pm)?$/i
  );
  if (!match) {
    return null;
  }

  const rawHour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (isNaN(rawHour) || isNaN(minute) || minute < 0 || minute > 59) {
    return null;
  }

  let hour = rawHour;

  if (meridiem) {
    // 12-hour AM/PM format (12:00 AM = 0, 12:00 PM = 12)
    if (rawHour < 1 || rawHour > 12) {
      return null;
    }
    if (meridiem === 'AM') {
      hour = rawHour === 12 ? 0 : rawHour;
    } else if (meridiem === 'PM') {
      hour = rawHour === 12 ? 12 : rawHour + 12;
    }
  } else {
    // 24-hour format without AM/PM
    if (rawHour < 0 || rawHour > 23) {
      return null;
    }
  }

  return { hour, minute };
};

/**
 * Compiles a list of native reminder items from all active medicines across all family members.
 * Excludes medicines belonging to archived patient profiles.
 */
export const buildNativeReminderItems = (
  medicines: Medicine[],
  patients: PatientProfile[]
): NativeReminderItem[] => {
  const patientMap = new Map<string, PatientProfile>();
  const archivedPatientIds = new Set<string>();

  patients.forEach((p) => {
    patientMap.set(p.id, p);
    if (p.isArchived) {
      archivedPatientIds.add(p.id);
    }
  });

  const reminderItems: NativeReminderItem[] = [];

  for (const medicine of medicines) {
    // 1. Only active medicines
    if (medicine.status !== 'active') {
      continue;
    }

    // 2. Exclude medicines assigned to an archived profile
    if (
      medicine.assignedPatientId &&
      archivedPatientIds.has(medicine.assignedPatientId)
    ) {
      continue;
    }

    const assignedPatient = medicine.assignedPatientId
      ? patientMap.get(medicine.assignedPatientId)
      : undefined;

    const patientName = assignedPatient ? assignedPatient.name : 'আমার ওষুধ';

    if (!Array.isArray(medicine.schedules)) {
      continue;
    }

    for (const schedule of medicine.schedules) {
      const parsedTime = parseReminderTime(schedule.time);
      if (!parsedTime) {
        console.warn(
          `[NativeReminders] Failed to parse reminder time: "${schedule.time}" for medicine "${medicine.brandName}" (ID: ${medicine.id}, Schedule ID: ${schedule.id})`
        );
        continue;
      }

      const item: NativeReminderItem = {
        reminderId: `${medicine.id}_${schedule.id}`,
        medicineId: medicine.id,
        medicineName: medicine.brandName,
        genericName: medicine.genericName,
        patientName,
        dosage: `${schedule.dosage} ${medicine.unit}`.trim(),
        mealTiming: medicine.mealTiming,
        timeSlot: schedule.timeSlot,
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        active: true,
      };

      reminderItems.push(item);
    }
  }

  return reminderItems;
};

/**
 * Synchronizes native reminders in Android via window.AndroidReminders.syncReminders().
 */
export const syncNativeReminders = (
  medicines: Medicine[],
  patients: PatientProfile[]
): { ok: boolean; count: number } | null => {
  if (!isNativeRemindersAvailable()) {
    return null;
  }

  try {
    const items = buildNativeReminderItems(medicines, patients);
    const jsonString = JSON.stringify(items);
    const rawResult = window.AndroidReminders!.syncReminders(jsonString);

    if (typeof rawResult === 'string') {
      try {
        const parsed = JSON.parse(rawResult);
        return {
          ok: Boolean(parsed.ok),
          count: typeof parsed.count === 'number' ? parsed.count : items.length,
        };
      } catch {
        return { ok: true, count: items.length };
      }
    }
    return { ok: true, count: items.length };
  } catch (err) {
    console.error('[NativeReminders] Error syncing reminders to Android:', err);
    return { ok: false, count: 0 };
  }
};

/**
 * Clears all alarms in Android via window.AndroidReminders.clearAll().
 */
export const clearAllNativeReminders = (): void => {
  if (!isNativeRemindersAvailable()) return;
  try {
    window.AndroidReminders!.clearAll();
  } catch (err) {
    console.error('[NativeReminders] Error clearing reminders in Android:', err);
  }
};

/**
 * Queries permission status from Android via window.AndroidReminders.getPermissionStatus().
 */
export const getNativePermissionStatus = (): NativePermissionStatus | null => {
  if (!isNativeRemindersAvailable()) return null;
  try {
    const raw = window.AndroidReminders!.getPermissionStatus();
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      return {
        exactAlarm: Boolean(parsed.exactAlarm),
        notifications: Boolean(parsed.notifications),
        batteryUnrestricted: Boolean(parsed.batteryUnrestricted),
      };
    } else if (typeof raw === 'object' && raw !== null) {
      const parsed = raw as Record<string, unknown>;
      return {
        exactAlarm: Boolean(parsed.exactAlarm),
        notifications: Boolean(parsed.notifications),
        batteryUnrestricted: Boolean(parsed.batteryUnrestricted),
      };
    }
  } catch (err) {
    console.warn('[NativeReminders] Error parsing getPermissionStatus result:', err);
  }
  return null;
};

/**
 * Opens system Exact Alarm permission settings screen.
 */
export const openExactAlarmSettings = (): void => {
  if (!isNativeRemindersAvailable()) return;
  try {
    window.AndroidReminders!.openExactAlarmSettings();
  } catch (err) {
    console.warn('[NativeReminders] openExactAlarmSettings error:', err);
  }
};

/**
 * Opens system Battery Optimization settings screen.
 */
export const openBatterySettings = (): void => {
  if (!isNativeRemindersAvailable()) return;
  try {
    window.AndroidReminders!.openBatterySettings();
  } catch (err) {
    console.warn('[NativeReminders] openBatterySettings error:', err);
  }
};

/**
 * Requests Android notification permission.
 */
export const requestNotificationPermission = (): void => {
  if (!isNativeRemindersAvailable()) return;
  try {
    window.AndroidReminders!.requestNotificationPermission();
  } catch (err) {
    console.warn('[NativeReminders] requestNotificationPermission error:', err);
  }
};

/**
 * Schedules a reminder alarm to fire in 1 minute.
 */
export const scheduleTestAlarm = (): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    return Boolean(window.AndroidReminders!.scheduleTestAlarm());
  } catch (err) {
    console.warn('[NativeReminders] scheduleTestAlarm error:', err);
    return false;
  }
};

/**
 * Reads current alarm tone info from window.AndroidReminders.getAlarmTone().
 */
export const getNativeAlarmTone = (): NativeAlarmToneInfo | null => {
  if (!isNativeRemindersAvailable()) return null;
  try {
    const fn = window.AndroidReminders?.getAlarmTone;
    if (typeof fn !== 'function') return null;
    const raw = fn.call(window.AndroidReminders);
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'ডিফল্ট অ্যালার্ম টোন',
        isDefault: Boolean(parsed?.isDefault),
      };
    }
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      return {
        name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'ডিফল্ট অ্যালার্ম টোন',
        isDefault: Boolean(obj.isDefault),
      };
    }
  } catch (err) {
    console.warn('[NativeReminders] getAlarmTone error:', err);
  }
  return null;
};

export const pickNativeAlarmTone = (): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    if (typeof window.AndroidReminders?.pickAlarmTone !== 'function') return false;
    window.AndroidReminders.pickAlarmTone();
    return true;
  } catch (err) {
    console.warn('[NativeReminders] pickAlarmTone error:', err);
    return false;
  }
};

export const pickNativeAlarmToneFromFiles = (): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    if (typeof window.AndroidReminders?.pickAlarmToneFromFiles !== 'function') return false;
    window.AndroidReminders.pickAlarmToneFromFiles();
    return true;
  } catch (err) {
    console.warn('[NativeReminders] pickAlarmToneFromFiles error:', err);
    return false;
  }
};

export const previewNativeAlarmTone = (): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    if (typeof window.AndroidReminders?.previewAlarmTone !== 'function') return false;
    window.AndroidReminders.previewAlarmTone();
    return true;
  } catch (err) {
    console.warn('[NativeReminders] previewAlarmTone error:', err);
    return false;
  }
};

export const stopNativeAlarmTonePreview = (): void => {
  if (!isNativeRemindersAvailable()) return;
  try {
    if (typeof window.AndroidReminders?.stopPreview === 'function') {
      window.AndroidReminders.stopPreview();
    }
  } catch (err) {
    console.warn('[NativeReminders] stopPreview error:', err);
  }
};

export const resetNativeAlarmTone = (): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    if (typeof window.AndroidReminders?.resetAlarmTone !== 'function') return false;
    window.AndroidReminders.resetAlarmTone();
    return true;
  } catch (err) {
    console.warn('[NativeReminders] resetAlarmTone error:', err);
    return false;
  }
};

export const setNativeAlarmVoiceEnabled = (enabled: boolean): boolean => {
  if (!isNativeRemindersAvailable()) return false;
  try {
    if (typeof window.AndroidReminders?.setVoiceEnabled !== 'function') return false;
    window.AndroidReminders.setVoiceEnabled(Boolean(enabled));
    return true;
  } catch (err) {
    console.warn('[NativeReminders] setVoiceEnabled error:', err);
    return false;
  }
};

