export interface FirestoreDailyUsage {
  dateKey: string;
  totalWrites: number;
  totalReads: number;
  writesByCollection: Record<string, number>;
  readsByCollection: Record<string, number>;
  updatedAtMs: number;
}

export interface UsageStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const FIRESTORE_USAGE_STORAGE_KEY = 'shasthobondhu_firestore_usage_v1';

const usageListeners = new Set<() => void>();

/**
 * Returns today's calendar key in Bangladesh Time (Asia/Dhaka, YYYY-MM-DD)
 * so "আজকের আনুমানিক write/read" matches the user's local Bangladesh day.
 */
export function getDhakaDateKey(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback below if Intl timeZone is unavailable
  }
  const dhakaApprox = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  const year = dhakaApprox.getUTCFullYear();
  const month = String(dhakaApprox.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dhakaApprox.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyDailyUsage(dateKey: string = getDhakaDateKey()): FirestoreDailyUsage {
  return {
    dateKey,
    totalWrites: 0,
    totalReads: 0,
    writesByCollection: {},
    readsByCollection: {},
    updatedAtMs: Date.now(),
  };
}

function getSafeStorage(override?: UsageStorageLike | null): UsageStorageLike | null {
  if (override !== undefined) return override;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function notifyUsageListeners(): void {
  for (const listener of Array.from(usageListeners)) {
    try {
      listener();
    } catch {
      // ignore subscriber failure
    }
  }
}

export function subscribeFirestoreUsage(listener: () => void): () => void {
  usageListeners.add(listener);
  return () => {
    usageListeners.delete(listener);
  };
}

function sanitizeCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && k.trim() && typeof v === 'number' && Number.isFinite(v) && v > 0) {
      result[k] = Math.floor(v);
    }
  }
  return result;
}

export function getTodayFirestoreUsage(
  storage?: UsageStorageLike | null,
  date: Date = new Date()
): FirestoreDailyUsage {
  const todayKey = getDhakaDateKey(date);
  const store = getSafeStorage(storage);
  if (!store) return createEmptyDailyUsage(todayKey);

  try {
    const raw = store.getItem(FIRESTORE_USAGE_STORAGE_KEY);
    if (!raw) return createEmptyDailyUsage(todayKey);
    const parsed = JSON.parse(raw) as Partial<FirestoreDailyUsage>;
    if (!parsed || parsed.dateKey !== todayKey) {
      return createEmptyDailyUsage(todayKey);
    }
    const writesByCollection = sanitizeCountMap(parsed.writesByCollection);
    const readsByCollection = sanitizeCountMap(parsed.readsByCollection);
    const totalWrites = Object.values(writesByCollection).reduce((sum, n) => sum + n, 0);
    const totalReads = Object.values(readsByCollection).reduce((sum, n) => sum + n, 0);
    return {
      dateKey: todayKey,
      totalWrites,
      totalReads,
      writesByCollection,
      readsByCollection,
      updatedAtMs: typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    };
  } catch {
    return createEmptyDailyUsage(todayKey);
  }
}

function saveDailyUsage(usage: FirestoreDailyUsage, storage?: UsageStorageLike | null): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(FIRESTORE_USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore storage write failures
  }
  notifyUsageListeners();
}

export function recordFirestoreWrite(
  collectionName: string,
  count: number = 1,
  storage?: UsageStorageLike | null,
  date: Date = new Date()
): FirestoreDailyUsage {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const current = getTodayFirestoreUsage(storage, date);
  if (safeCount <= 0) return current;

  const col = (collectionName || 'unknown').trim() || 'unknown';
  const writesByCollection = {
    ...current.writesByCollection,
    [col]: (current.writesByCollection[col] || 0) + safeCount,
  };
  const next: FirestoreDailyUsage = {
    ...current,
    totalWrites: current.totalWrites + safeCount,
    writesByCollection,
    updatedAtMs: date.getTime(),
  };
  saveDailyUsage(next, storage);
  return next;
}

export function recordFirestoreRead(
  collectionName: string,
  count: number = 1,
  storage?: UsageStorageLike | null,
  date: Date = new Date()
): FirestoreDailyUsage {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const current = getTodayFirestoreUsage(storage, date);
  if (safeCount <= 0) return current;

  const col = (collectionName || 'unknown').trim() || 'unknown';
  const readsByCollection = {
    ...current.readsByCollection,
    [col]: (current.readsByCollection[col] || 0) + safeCount,
  };
  const next: FirestoreDailyUsage = {
    ...current,
    totalReads: current.totalReads + safeCount,
    readsByCollection,
    updatedAtMs: date.getTime(),
  };
  saveDailyUsage(next, storage);
  return next;
}

export function resetFirestoreUsageForTests(storage?: UsageStorageLike | null): void {
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.removeItem(FIRESTORE_USAGE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  notifyUsageListeners();
}
