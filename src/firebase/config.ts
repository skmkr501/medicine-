import { initializeApp, onLog } from 'firebase/app';
import {
  initializeFirestore,
  doc,
  getDocFromServer,
  memoryLocalCache,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  QuotaExceededWriteError,
  clearWriteQuotaPause,
  isQuotaExceededError,
  isWriteQuotaPaused,
  markWriteQuotaExceeded,
} from './quotaState';
import { recordFirestoreWrite } from '../utils/firestoreUsageTracker';

const app = initializeApp(firebaseConfig);

// Use memoryLocalCache() instead of persistentLocalCache():
// App user data is persisted synchronously in localStorage.
// Using memoryLocalCache prevents Firestore from persisting unacknowledged writes in IndexedDB and replaying
// a poisoned write queue with infinite backoff retries across page reloads when daily quota is exhausted.
export const db = initializeFirestore(
  app,
  {
    ignoreUndefinedProperties: true,
    localCache: memoryLocalCache(),
  },
  firebaseConfig.firestoreDatabaseId
);

// Best-effort cleanup of any legacy Firestore IndexedDB databases left by prior persistentLocalCache
// so stale mutation queues are removed cleanly (never touches ShasthoBondhuLibraryDB).
if (
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined' &&
  typeof indexedDB.databases === 'function'
) {
  indexedDB
    .databases()
    .then((dbs) => {
      for (const info of dbs) {
        if (info.name && info.name.startsWith('firestore/')) {
          try {
            indexedDB.deleteDatabase(info.name);
          } catch {
            // ignore delete errors
          }
        }
      }
    })
    .catch(() => {});
}

type PendingWriteRejector = (err: QuotaExceededWriteError) => void;
const pendingWriteRejectors = new Set<PendingWriteRejector>();
let isFirestoreNetworkDisabledForQuota = false;
let hasWarnedQuotaConsoleThisSession = false;

export function isFirestoreNetworkDisabled(): boolean {
  return isFirestoreNetworkDisabledForQuota;
}

export function isFirestoreSdkQuotaErrorLog(
  text: string,
  hasPendingWrites: boolean = false
): boolean {
  const lower = (text || '').toLowerCase();
  if (
    lower.includes('resource-exhausted') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota limit exceeded') ||
    lower.includes('quota exceeded')
  ) {
    return true;
  }
  return hasPendingWrites && lower.includes('using maximum backoff delay');
}

/**
 * Trips the write-quota circuit breaker immediately:
 * 1. Marks today's Pacific Time date as paused in localStorage
 * 2. Rejects any in-flight guarded write promises (since Firestore SDK leaves write promises pending forever on resource-exhausted)
 * 3. Disables Firestore network in the current session to cancel PersistentWriteStream backoff retries
 */
export function tripWriteQuotaCircuitBreaker(reasonMessage?: string): void {
  markWriteQuotaExceeded();

  const quotaErr = new QuotaExceededWriteError(reasonMessage);
  for (const rejector of Array.from(pendingWriteRejectors)) {
    pendingWriteRejectors.delete(rejector);
    rejector(quotaErr);
  }

  if (!isFirestoreNetworkDisabledForQuota) {
    isFirestoreNetworkDisabledForQuota = true;
    disableNetwork(db).catch(() => {});
  }

  if (!hasWarnedQuotaConsoleThisSession) {
    hasWarnedQuotaConsoleThisSession = true;
    console.warn(
      'Firestore daily write quota exceeded; paused cloud writes and using local storage for today (America/Los_Angeles).'
    );
  }
}

// Intercept @firebase/firestore SDK error logs (PersistentWriteStream emits resource-exhausted + maximum backoff
// via @firebase/logger without ever rejecting the pending setDoc/updateDoc/batch.commit promise).
let hasRegisteredQuotaGuards = false;
if (!hasRegisteredQuotaGuards) {
  hasRegisteredQuotaGuards = true;

  onLog(
    (log) => {
      if (
        log.type === '@firebase/firestore' &&
        isFirestoreSdkQuotaErrorLog(log.message, pendingWriteRejectors.size > 0)
      ) {
        tripWriteQuotaCircuitBreaker(log.message);
      }
    },
    { level: 'error' }
  );

  // Prevent @firebase/logger's default console.error from flooding the browser console with repeated
  // resource-exhausted / maximum-backoff errors once our circuit breaker handles it cleanly.
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const combined = args
        .map((a) => (a instanceof Error ? `${a.message}` : String(a ?? '')))
        .join(' ');
      if (
        combined.includes('@firebase/firestore') &&
        isFirestoreSdkQuotaErrorLog(combined, pendingWriteRejectors.size > 0)
      ) {
        tripWriteQuotaCircuitBreaker(combined);
        return;
      }
      origError(...args);
    };
  }
}

/**
 * Guards every Firestore write (setDoc, updateDoc, deleteDoc, batch.commit):
 * - Immediately rejects with QuotaExceededWriteError if today's write quota is already paused (0 network calls).
 * - Races the Firestore write promise against the SDK quota circuit breaker so callers never hang forever
 *   when Firestore treats resource-exhausted as a transient backoff error.
 */
export async function executeGuardedWrite<T>(
  writeFn: () => Promise<T>,
  usageMeta?: { collection: string; count?: number }
): Promise<T> {
  if (isWriteQuotaPaused() || isFirestoreNetworkDisabledForQuota) {
    throw new QuotaExceededWriteError();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const onQuotaTrip: PendingWriteRejector = (err) => {
      if (settled) return;
      settled = true;
      pendingWriteRejectors.delete(onQuotaTrip);
      reject(err);
    };

    pendingWriteRejectors.add(onQuotaTrip);

    Promise.resolve()
      .then(() => writeFn())
      .then(
        (val) => {
          if (settled) return;
          settled = true;
          pendingWriteRejectors.delete(onQuotaTrip);
          if (usageMeta?.collection) {
            recordFirestoreWrite(usageMeta.collection, usageMeta.count ?? 1);
          }
          resolve(val);
        },
        (err) => {
          if (settled) return;
          settled = true;
          pendingWriteRejectors.delete(onQuotaTrip);
          if (isQuotaExceededError(err)) {
            const msg = err instanceof Error ? err.message : String(err);
            tripWriteQuotaCircuitBreaker(msg);
            reject(err instanceof QuotaExceededWriteError ? err : new QuotaExceededWriteError(msg));
            return;
          }
          reject(err);
        }
      );
  });
}

/**
 * Re-enables Firestore network after a manual retry request.
 */
export async function resumeFirestoreNetwork(): Promise<void> {
  clearWriteQuotaPause();
  hasWarnedQuotaConsoleThisSession = false;
  if (isFirestoreNetworkDisabledForQuota) {
    isFirestoreNetworkDisabledForQuota = false;
    await enableNetwork(db);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips undefined fields from plain objects and arrays before sending to Firestore,
 * while preserving special class instances (Timestamp, FieldValue/serverTimestamp, Date, GeoPoint, DocumentReference).
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (!isPlainObject(obj)) {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result as T;
}

// Test Firestore connectivity on boot as per skill guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  if (isFirestoreNetworkDisabledForQuota) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (
      msg.includes('the client is offline') ||
      msg.includes('resource-exhausted') ||
      msg.includes('quota')
    ) {
      console.warn('Firebase client offline or quota limited:', msg);
      return false;
    }
    // Any permission-denied response also confirms connection to the server!
    return true;
  }
}
