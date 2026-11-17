import { GlobalMedicine, ImportBatch } from '../types';
import { hasCatalogChanges } from './libraryChunks';

export const ADMIN_QUOTA_SAVED_TOAST =
  'ক্লাউড সীমা শেষ, ফোনে সংরক্ষিত, সীমা ফিরলে প্রকাশ হবে';

export const ADMIN_RETRY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface AdminPublishQueueState {
  key: 'current';
  medicines: GlobalMedicine[];
  batches: ImportBatch[];
  updatedAtMs: number;
}

const DB_NAME = 'shasthobondhu_admin_publish_db';
const DB_VERSION = 1;
const STORE_NAME = 'publish_queue';
const RECORD_KEY = 'current';

/**
 * Pure helper: dedupes queued medicines strictly by `id` (newer item replaces older entry).
 */
export function dedupeAndMergeQueueMedicines(
  existing: GlobalMedicine[],
  incoming: GlobalMedicine[]
): GlobalMedicine[] {
  const map = new Map<string, GlobalMedicine>();
  for (const item of existing) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Pure helper: dedupes queued import batches by `id`.
 */
export function dedupeAndMergeQueueBatches(
  existing: ImportBatch[],
  incoming?: ImportBatch | ImportBatch[]
): ImportBatch[] {
  const map = new Map<string, ImportBatch>();
  for (const b of existing) {
    if (b && b.id) map.set(b.id, b);
  }
  const incList = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
  for (const b of incList) {
    if (b && b.id) map.set(b.id, b);
  }
  return Array.from(map.values());
}

/**
 * Pure helper: removes specific medicine IDs from the pending publish queue.
 */
export function removeIdsFromPublishQueue(
  existing: GlobalMedicine[],
  idsToRemove: string[]
): GlobalMedicine[] {
  const removeSet = new Set(idsToRemove.filter(Boolean));
  if (removeSet.size === 0) return existing;
  return existing.filter((m) => !removeSet.has(m.id));
}

/**
 * Pure helper: merges pending queue medicines into displayed catalog ONLY for admin.
 * Regular users (`isAdmin === false`) strictly receive the committed cloud catalog untouched.
 */
export function mergePendingQueueForAdminDisplay(
  cloudCatalog: GlobalMedicine[],
  queuedMedicines: GlobalMedicine[],
  isAdmin: boolean
): GlobalMedicine[] {
  if (!isAdmin || !queuedMedicines || queuedMedicines.length === 0) {
    return cloudCatalog;
  }
  const queuedById = new Map(queuedMedicines.map((m) => [m.id, m]));
  const updatedExisting = cloudCatalog.map((m) => queuedById.get(m.id) || m);
  const existingIds = new Set(cloudCatalog.map((m) => m.id));
  const brandNew = queuedMedicines.filter((m) => !existingIds.has(m.id));
  return [...brandNew, ...updatedExisting];
}

/**
 * Pure helper: combines ALL queued medicines together with the current cloud catalog
 * so they are committed in ONE single new catalog version via chunked publishing.
 */
export function combineCatalogWithPendingQueueForSingleVersionPublish(
  cloudCatalog: GlobalMedicine[],
  queuedMedicines: GlobalMedicine[]
): GlobalMedicine[] {
  if (!queuedMedicines || queuedMedicines.length === 0) {
    return cloudCatalog;
  }
  const diff = hasCatalogChanges(cloudCatalog, queuedMedicines);
  return diff.mergedList;
}

/**
 * Returns Asia/Dhaka wall-clock components so 2:10 PM BDT checks are accurate regardless of device timezone.
 */
export function getBangladeshTimeParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayKey: string;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const getNum = (type: string, fallback: number) => {
      const val = parts.find((p) => p.type === type)?.value;
      const n = val ? Number(val) : NaN;
      return Number.isFinite(n) ? n : fallback;
    };
    const year = getNum('year', date.getUTCFullYear());
    const month = getNum('month', date.getUTCMonth() + 1);
    const day = getNum('day', date.getUTCDate());
    let hour = getNum('hour', 0);
    if (hour === 24) hour = 0;
    const minute = getNum('minute', 0);
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, hour, minute, dayKey };
  } catch {
    const dhakaApprox = new Date(date.getTime() + 6 * 60 * 60 * 1000);
    const year = dhakaApprox.getUTCFullYear();
    const month = dhakaApprox.getUTCMonth() + 1;
    const day = dhakaApprox.getUTCDate();
    const hour = dhakaApprox.getUTCHours();
    const minute = dhakaApprox.getUTCMinutes();
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, hour, minute, dayKey };
  }
}

export function isAfterBangladeshQuotaResetAttemptTime(date: Date = new Date()): boolean {
  const { hour, minute } = getBangladeshTimeParts(date);
  return hour > 14 || (hour === 14 && minute >= 10);
}

/**
 * Decides whether the open app should automatically attempt publishing the admin pending queue once:
 * - First attempt after 2:10 PM Bangladesh Time (`14:10 Asia/Dhaka`) on a new reset window
 * - Or every 30 minutes while online and write quota is not paused
 */
export function shouldAttemptAdminQueueAutoPublish(params: {
  hasPending: boolean;
  isAdmin: boolean;
  isOnline: boolean;
  isFlushing: boolean;
  isQuotaPausedNow: boolean;
  now?: Date;
  lastAttemptMs: number;
  postResetRetriedDhakaDayKey: string | null;
}): {
  shouldAttempt: boolean;
  reason: 'post_reset_210pm' | 'interval_30m' | 'none';
  dhakaDayKey: string;
} {
  const now = params.now ?? new Date();
  const { dayKey, hour, minute } = getBangladeshTimeParts(now);

  if (!params.hasPending || !params.isAdmin || !params.isOnline || params.isFlushing) {
    return { shouldAttempt: false, reason: 'none', dhakaDayKey: dayKey };
  }

  const nowMs = now.getTime();
  const isPost210 = hour > 14 || (hour === 14 && minute >= 10);

  // Check if lastAttemptMs happened BEFORE today's 14:10 BDT
  let lastAttemptBeforeToday210 = params.lastAttemptMs === 0;
  if (params.lastAttemptMs > 0) {
    const lastParts = getBangladeshTimeParts(new Date(params.lastAttemptMs));
    if (lastParts.dayKey < dayKey) {
      lastAttemptBeforeToday210 = true;
    } else if (
      lastParts.dayKey === dayKey &&
      (lastParts.hour < 14 || (lastParts.hour === 14 && lastParts.minute < 10))
    ) {
      lastAttemptBeforeToday210 = true;
    }
  }

  // 1. First automatic attempt right after 2:10 PM BDT reset window
  if (isPost210 && params.postResetRetriedDhakaDayKey !== dayKey && lastAttemptBeforeToday210) {
    return { shouldAttempt: true, reason: 'post_reset_210pm', dhakaDayKey: dayKey };
  }

  // 2. If write quota is still paused in the current Pacific day, wait until next reset / 30m check after reset
  if (params.isQuotaPausedNow) {
    return { shouldAttempt: false, reason: 'none', dhakaDayKey: dayKey };
  }

  // 3. Quota is available (e.g. Pacific midnight passed or came online) -> first check or 30m interval
  if (params.lastAttemptMs === 0 || nowMs - params.lastAttemptMs >= ADMIN_RETRY_INTERVAL_MS) {
    return { shouldAttempt: true, reason: 'interval_30m', dhakaDayKey: dayKey };
  }

  return { shouldAttempt: false, reason: 'none', dhakaDayKey: dayKey };
}

// ============================================================================
// IndexedDB Persistence ("অপেক্ষমাণ প্রকাশ")
// ============================================================================

function openAdminPublishDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Admin publish queue IndexedDB open failed:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('Admin publish queue IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

export async function loadAdminPublishQueue(): Promise<AdminPublishQueueState> {
  const empty: AdminPublishQueueState = {
    key: 'current',
    medicines: [],
    batches: [],
    updatedAtMs: 0,
  };
  const db = await openAdminPublishDatabase();
  if (!db) return empty;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);

      req.onsuccess = () => {
        const res = req.result as Partial<AdminPublishQueueState> | undefined;
        resolve({
          key: 'current',
          medicines: Array.isArray(res?.medicines) ? res.medicines : [],
          batches: Array.isArray(res?.batches) ? res.batches : [],
          updatedAtMs: typeof res?.updatedAtMs === 'number' ? res.updatedAtMs : 0,
        });
      };
      req.onerror = () => resolve(empty);
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(empty);
    }
  });
}

export async function saveAdminPublishQueue(
  medicines: GlobalMedicine[],
  batches: ImportBatch[] = []
): Promise<boolean> {
  const db = await openAdminPublishDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (medicines.length === 0) {
        const req = store.delete(RECORD_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } else {
        const payload: AdminPublishQueueState = {
          key: 'current',
          medicines,
          batches,
          updatedAtMs: Date.now(),
        };
        const req = store.put(payload);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      }
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function clearAdminPublishQueue(): Promise<void> {
  await saveAdminPublishQueue([], []);
}
