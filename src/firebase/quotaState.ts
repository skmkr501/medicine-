export const QUOTA_EXCEEDED_BN_MSG =
  'আজকের ক্লাউড সীমা শেষ, ফোনে থাকা ডেটা দেখানো হচ্ছে। আগামীকাল আবার সিঙ্ক হবে';

export const WRITE_QUOTA_PAUSE_KEY = 'shasthobondhu_write_quota_pause_date_v1';

export interface QuotaStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export class QuotaExceededWriteError extends Error {
  readonly code = 'resource-exhausted';

  constructor(
    message: string = 'FirebaseError: [code=resource-exhausted]: Quota limit exceeded.'
  ) {
    super(message);
    this.name = 'QuotaExceededWriteError';
  }
}

let hasNotifiedQuotaExceededThisSession = false;
let inMemoryQuotaPauseDate: string | null = null;
const quotaExceededListeners = new Set<() => void>();

/**
 * Firestore free-tier daily quota resets at midnight Pacific Time (America/Los_Angeles).
 * Using local timezone (e.g., Asia/Dhaka UTC+6) caused premature unpausing while server quota was still exhausted.
 */
export function getQuotaDayKey(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
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
  const pstApprox = new Date(date.getTime() - 8 * 60 * 60 * 1000);
  const year = pstApprox.getUTCFullYear();
  const month = String(pstApprox.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pstApprox.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSafeStorage(override?: QuotaStorageLike | null): QuotaStorageLike | null {
  if (override !== undefined) return override;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore sandboxed storage error
  }
  return null;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof QuotaExceededWriteError) return true;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error);
  const combined = `${code} ${msg}`.toLowerCase();
  return (
    combined.includes('resource-exhausted') ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota exceeded') ||
    combined.includes('quota_exceeded') ||
    combined.includes('quota limit exceeded') ||
    combined.includes('using maximum backoff delay')
  );
}

/**
 * Subscribe to immediate notifications when any path trips the write-quota circuit breaker.
 */
export function subscribeWriteQuotaExceeded(listener: () => void): () => void {
  quotaExceededListeners.add(listener);
  return () => {
    quotaExceededListeners.delete(listener);
  };
}

/**
 * Records that Firestore daily write quota was exceeded for today (auto-resets next Pacific calendar day).
 */
export function markWriteQuotaExceeded(
  dateKey: string = getQuotaDayKey(),
  storage?: QuotaStorageLike | null
): void {
  inMemoryQuotaPauseDate = dateKey;
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(WRITE_QUOTA_PAUSE_KEY, dateKey);
    } catch {
      // ignore storage failure
    }
  }
  for (const listener of Array.from(quotaExceededListeners)) {
    try {
      listener();
    } catch {
      // never fail callers from subscriber errors
    }
  }
}

/**
 * Returns true if Firestore write quota was already hit today (Pacific Time),
 * so background/queued writes pause cleanly before entering Firestore's write pipeline.
 */
export function isWriteQuotaPaused(
  dateKey: string = getQuotaDayKey(),
  storage?: QuotaStorageLike | null
): boolean {
  if (inMemoryQuotaPauseDate === dateKey) {
    return true;
  }
  const store = getSafeStorage(storage);
  if (store) {
    try {
      const saved = store.getItem(WRITE_QUOTA_PAUSE_KEY);
      if (saved === dateKey) {
        inMemoryQuotaPauseDate = saved;
        return true;
      }
      if (saved && saved !== dateKey) {
        store.removeItem(WRITE_QUOTA_PAUSE_KEY);
      }
    } catch {
      // ignore storage failure
    }
  }
  return false;
}

export function clearWriteQuotaPause(storage?: QuotaStorageLike | null): void {
  inMemoryQuotaPauseDate = null;
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.removeItem(WRITE_QUOTA_PAUSE_KEY);
    } catch {
      // ignore storage failure
    }
  }
}

/**
 * Returns true only once per browser session so the quota notice toast is never spammed.
 */
export function consumeQuotaExceededNoticeOnce(): boolean {
  if (hasNotifiedQuotaExceededThisSession) {
    return false;
  }
  hasNotifiedQuotaExceededThisSession = true;
  return true;
}

export function resetQuotaNoticeForTests(): void {
  hasNotifiedQuotaExceededThisSession = false;
  inMemoryQuotaPauseDate = null;
}
