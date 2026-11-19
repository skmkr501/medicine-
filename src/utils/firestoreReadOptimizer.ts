import { DoctorAppointment, DoseLog } from '../types';
import { addLocalDays, toLocalIsoDate } from './shoppingListCalculator';

export const DOSE_LOG_REALTIME_DAYS = 90;
export const DOSE_LOG_INITIAL_DAYS = 90;
export const OLDER_LOGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COLLECTION_SYNC_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (medicines, patients, settings)
export const RECORDS_SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (upcoming appointments, health records)
export const HEALTH_RECORDS_INITIAL_LIMIT = 60;

export type CloudSyncCollectionKey =
  | 'medicines'
  | 'patients'
  | 'settings'
  | 'upcomingAppointments'
  | 'healthRecords'
  | 'doctors'
  | 'documents';

export type CloudSyncMetaMap = Partial<Record<CloudSyncCollectionKey, number>>;

interface CachedOlderDoseLogsPayload {
  cachedAtMs: number;
  cutoffDate: string;
  logs: DoseLog[];
}

interface CachedPastAppointmentsPayload {
  cachedAtMs: number;
  beforeDateIso: string;
  appointments: DoctorAppointment[];
}

export function getDoseLogsCutoffDate(
  daysAgo: number = DOSE_LOG_REALTIME_DAYS,
  refDate: Date = new Date()
): string {
  const safeDays = Math.max(0, Math.floor(daysAgo));
  return toLocalIsoDate(addLocalDays(refDate, -safeDays));
}

export function getAppointmentsRecentCutoffDate(
  daysBack: number = 1,
  refDate: Date = new Date()
): string {
  const safeDays = Math.max(0, Math.floor(daysBack));
  return toLocalIsoDate(addLocalDays(refDate, -safeDays));
}

/**
 * Keeps older logs (< cutoffDate) intact from local state/cache while authoritatively
 * updating the active real-time window (>= cutoffDate) from the bounded onSnapshot listener.
 */
export function mergeDoseLogsWithWindow(
  existingLogs: DoseLog[],
  recentWindowLogs: DoseLog[],
  cutoffDate: string
): DoseLog[] {
  const recentIds = new Set(recentWindowLogs.map((l) => l.id));
  const preservedOlder = existingLogs.filter(
    (l) => !recentIds.has(l.id) && (l.scheduledDate || '') < cutoffDate
  );

  const byId = new Map<string, DoseLog>();
  for (const log of preservedOlder) {
    byId.set(log.id, log);
  }
  for (const log of recentWindowLogs) {
    byId.set(log.id, log);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const dateCmp = (b.scheduledDate || '').localeCompare(a.scheduledDate || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.loggedAt || '').localeCompare(a.loggedAt || '');
  });
}

/**
 * Replaces the older portion (< cutoffDate) with freshly fetched/cached older logs
 * while preserving the authoritative real-time 45-day window (>= cutoffDate).
 */
export function replaceOlderDoseLogsKeepingRecent(
  existingLogs: DoseLog[],
  olderLogs: DoseLog[],
  cutoffDate: string
): DoseLog[] {
  const olderFiltered = olderLogs.filter((l) => (l.scheduledDate || '') < cutoffDate);
  const recentLogs = existingLogs.filter((l) => (l.scheduledDate || '') >= cutoffDate);

  const byId = new Map<string, DoseLog>();
  for (const log of olderFiltered) {
    byId.set(log.id, log);
  }
  for (const log of recentLogs) {
    byId.set(log.id, log);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const dateCmp = (b.scheduledDate || '').localeCompare(a.scheduledDate || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.loggedAt || '').localeCompare(a.loggedAt || '');
  });
}

/**
 * Keeps cached past appointments (< minDateIso) intact while replacing upcoming/recent
 * appointments (>= minDateIso) from Firestore.
 */
export function mergeUpcomingAppointments(
  existing: DoctorAppointment[],
  upcomingFromCloud: DoctorAppointment[],
  minDateIso: string
): DoctorAppointment[] {
  const upcomingIds = new Set(upcomingFromCloud.map((a) => a.id));
  const preservedPast = existing.filter(
    (a) => !upcomingIds.has(a.id) && (a.appointmentDate || '') < minDateIso
  );

  const byId = new Map<string, DoctorAppointment>();
  for (const apt of preservedPast) {
    byId.set(apt.id, apt);
  }
  for (const apt of upcomingFromCloud) {
    byId.set(apt.id, apt);
  }

  return Array.from(byId.values());
}

/**
 * Replaces past appointments (< beforeDateIso) from cloud/cache while keeping
 * already-synced upcoming appointments (>= beforeDateIso).
 */
export function replacePastAppointmentsKeepingUpcoming(
  existing: DoctorAppointment[],
  pastFromCloud: DoctorAppointment[],
  beforeDateIso: string
): DoctorAppointment[] {
  const pastFiltered = pastFromCloud.filter((a) => (a.appointmentDate || '') < beforeDateIso);
  const upcoming = existing.filter((a) => (a.appointmentDate || '') >= beforeDateIso);

  const byId = new Map<string, DoctorAppointment>();
  for (const apt of pastFiltered) {
    byId.set(apt.id, apt);
  }
  for (const apt of upcoming) {
    byId.set(apt.id, apt);
  }

  return Array.from(byId.values());
}

export function mergePreservingUniqueById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function getCloudSyncMetaStorageKey(uid: string): string {
  return `shasthobondhu_cloud_sync_meta_${uid}`;
}

export function getOlderDoseLogsStorageKey(uid: string): string {
  return `shasthobondhu_older_doselogs_cache_${uid}`;
}

export function getPastAppointmentsStorageKey(uid: string): string {
  return `shasthobondhu_past_apts_cache_${uid}`;
}

export function getCloudSyncMeta(uid: string): CloudSyncMetaMap {
  if (!uid || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getCloudSyncMetaStorageKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CloudSyncMetaMap) : {};
  } catch {
    return {};
  }
}

export function shouldFetchCollectionFromCloud(
  uid: string,
  key: CloudSyncCollectionKey,
  ttlMs: number,
  nowMs: number = Date.now(),
  forceRefresh: boolean = false
): boolean {
  if (!uid) return false;
  if (forceRefresh) return true;
  const meta = getCloudSyncMeta(uid);
  const lastSyncedMs = meta[key];
  if (typeof lastSyncedMs !== 'number' || !Number.isFinite(lastSyncedMs)) {
    return true;
  }
  return nowMs - lastSyncedMs >= ttlMs;
}

export function markCollectionSynced(
  uid: string,
  key: CloudSyncCollectionKey,
  nowMs: number = Date.now()
): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    const meta = getCloudSyncMeta(uid);
    meta[key] = nowMs;
    localStorage.setItem(getCloudSyncMetaStorageKey(uid), JSON.stringify(meta));
  } catch {
    // ignore storage write errors
  }
}

export function invalidateCollectionSyncMeta(
  uid: string,
  keys?: CloudSyncCollectionKey[]
): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    if (!keys || keys.length === 0) {
      localStorage.removeItem(getCloudSyncMetaStorageKey(uid));
      return;
    }
    const meta = getCloudSyncMeta(uid);
    keys.forEach((k) => {
      delete meta[k];
    });
    localStorage.setItem(getCloudSyncMetaStorageKey(uid), JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
}

export function loadCachedOlderDoseLogs(
  uid: string,
  cutoffDate: string,
  nowMs: number = Date.now()
): { hit: boolean; logs: DoseLog[] } {
  if (!uid || typeof window === 'undefined') return { hit: false, logs: [] };
  try {
    const raw = localStorage.getItem(getOlderDoseLogsStorageKey(uid));
    if (!raw) return { hit: false, logs: [] };
    const parsed = JSON.parse(raw) as CachedOlderDoseLogsPayload;
    if (
      !parsed ||
      typeof parsed.cachedAtMs !== 'number' ||
      typeof parsed.cutoffDate !== 'string' ||
      !Array.isArray(parsed.logs)
    ) {
      return { hit: false, logs: [] };
    }
    if (nowMs - parsed.cachedAtMs >= OLDER_LOGS_CACHE_TTL_MS) {
      return { hit: false, logs: [] };
    }
    // Cached cutoffDate must be >= current cutoffDate so there is no gap between older cache and 45-day listener
    if (parsed.cutoffDate < cutoffDate) {
      return { hit: false, logs: [] };
    }
    return {
      hit: true,
      logs: parsed.logs.filter((l) => (l.scheduledDate || '') < cutoffDate),
    };
  } catch {
    return { hit: false, logs: [] };
  }
}

export function saveCachedOlderDoseLogs(
  uid: string,
  cutoffDate: string,
  logs: DoseLog[],
  nowMs: number = Date.now()
): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    const payload: CachedOlderDoseLogsPayload = {
      cachedAtMs: nowMs,
      cutoffDate,
      logs: logs.filter((l) => (l.scheduledDate || '') < cutoffDate),
    };
    localStorage.setItem(getOlderDoseLogsStorageKey(uid), JSON.stringify(payload));
  } catch {
    // ignore quota / storage errors gracefully
  }
}

export function loadCachedPastAppointments(
  uid: string,
  beforeDateIso: string,
  nowMs: number = Date.now()
): { hit: boolean; appointments: DoctorAppointment[] } {
  if (!uid || typeof window === 'undefined') return { hit: false, appointments: [] };
  try {
    const raw = localStorage.getItem(getPastAppointmentsStorageKey(uid));
    if (!raw) return { hit: false, appointments: [] };
    const parsed = JSON.parse(raw) as CachedPastAppointmentsPayload;
    if (
      !parsed ||
      typeof parsed.cachedAtMs !== 'number' ||
      typeof parsed.beforeDateIso !== 'string' ||
      !Array.isArray(parsed.appointments)
    ) {
      return { hit: false, appointments: [] };
    }
    if (nowMs - parsed.cachedAtMs >= OLDER_LOGS_CACHE_TTL_MS) {
      return { hit: false, appointments: [] };
    }
    if (parsed.beforeDateIso < beforeDateIso) {
      return { hit: false, appointments: [] };
    }
    return {
      hit: true,
      appointments: parsed.appointments.filter(
        (a) => (a.appointmentDate || '') < beforeDateIso
      ),
    };
  } catch {
    return { hit: false, appointments: [] };
  }
}

export function saveCachedPastAppointments(
  uid: string,
  beforeDateIso: string,
  appointments: DoctorAppointment[],
  nowMs: number = Date.now()
): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    const payload: CachedPastAppointmentsPayload = {
      cachedAtMs: nowMs,
      beforeDateIso,
      appointments: appointments.filter((a) => (a.appointmentDate || '') < beforeDateIso),
    };
    localStorage.setItem(getPastAppointmentsStorageKey(uid), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearUserReadOptimizerCaches(uid: string): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getCloudSyncMetaStorageKey(uid));
    localStorage.removeItem(getOlderDoseLogsStorageKey(uid));
    localStorage.removeItem(getPastAppointmentsStorageKey(uid));
  } catch {
    // ignore storage errors
  }
}
