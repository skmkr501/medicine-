import { GlobalMedicine } from '../types';

export interface CachedLibraryCatalog {
  key: 'current';
  version: number;
  totalCount: number;
  updatedAt: string;
  medicines: GlobalMedicine[];
}

const DB_NAME = 'shasthobondhu_library_db';
const DB_VERSION = 1;
const STORE_NAME = 'catalog';
const RECORD_KEY = 'current';

function openLibraryDatabase(): Promise<IDBDatabase | null> {
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

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('IndexedDB open failed:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

export async function loadLibraryFromIndexedDb(): Promise<CachedLibraryCatalog | null> {
  const db = await openLibraryDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);

      req.onsuccess = () => {
        const res = req.result as CachedLibraryCatalog | undefined;
        if (res && Array.isArray(res.medicines)) {
          resolve({
            key: 'current',
            version: typeof res.version === 'number' ? res.version : 0,
            totalCount: typeof res.totalCount === 'number' ? res.totalCount : res.medicines.length,
            updatedAt: typeof res.updatedAt === 'string' ? res.updatedAt : '',
            medicines: res.medicines,
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        console.warn('IndexedDB read error:', req.error);
        resolve(null);
      };

      tx.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      console.warn('IndexedDB load failed:', err);
      db.close();
      resolve(null);
    }
  });
}

export async function saveLibraryToIndexedDb(
  catalog: Omit<CachedLibraryCatalog, 'key'>
): Promise<boolean> {
  const db = await openLibraryDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const payload: CachedLibraryCatalog = {
        key: 'current',
        version: catalog.version,
        totalCount: catalog.totalCount,
        updatedAt: catalog.updatedAt,
        medicines: catalog.medicines,
      };
      const req = store.put(payload);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('IndexedDB write error:', req.error);
        resolve(false);
      };
      tx.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      console.warn('IndexedDB save failed:', err);
      db.close();
      resolve(false);
    }
  });
}

export async function clearLibraryIndexedDb(): Promise<void> {
  const db = await openLibraryDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve();
    }
  });
}
