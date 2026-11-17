import { MedicalDocument, MedicalDocumentFile } from '../types';

const DOC_DB_NAME = 'shasthobondhu_documents_db';
const DOC_DB_VERSION = 1;
const FILES_STORE = 'documentFiles';
const META_STORE = 'documentsMeta';
const SYNC_QUEUE_PREFIX = 'shasthobondhu_doc_sync_queue_v1_';

interface StoredFileRecord {
  key: string; // `${uid}:${fileId}`
  uid: string;
  fileId: string;
  docId: string;
  data: string;
  bytes: number;
  createdAtIso: string;
}

interface StoredMetaRecord {
  uid: string;
  documents: MedicalDocument[];
  syncedAtMs: number;
}

export interface PendingDocFileUpload {
  fileId: string;
  docId: string;
}

export interface DocSyncQueue {
  upsertDocIds: string[];
  deleteDocIds: string[];
  uploadFiles: PendingDocFileUpload[];
  deleteFileIds: string[];
}

export interface DocSyncStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function createEmptyDocSyncQueue(): DocSyncQueue {
  return {
    upsertDocIds: [],
    deleteDocIds: [],
    uploadFiles: [],
    deleteFileIds: [],
  };
}

function getSafeStorage(override?: DocSyncStorageLike | null): DocSyncStorageLike | null {
  if (override !== undefined) return override;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

function getSyncQueueKey(uid: string): string {
  return `${SYNC_QUEUE_PREFIX}${uid}`;
}

function normalizeIdArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      seen.add(item.trim());
    }
  }
  return Array.from(seen);
}

export function countPendingDocSyncOps(queue: DocSyncQueue): number {
  return (
    queue.upsertDocIds.length +
    queue.deleteDocIds.length +
    queue.uploadFiles.length +
    queue.deleteFileIds.length
  );
}

export function getPendingDocIdSet(queue: DocSyncQueue): Set<string> {
  const ids = new Set<string>(queue.upsertDocIds);
  for (const item of queue.uploadFiles) {
    if (item.docId) ids.add(item.docId);
  }
  return ids;
}

export function loadDocSyncQueue(
  uid: string | null | undefined,
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid) return createEmptyDocSyncQueue();
  const store = getSafeStorage(storage);
  if (!store) return createEmptyDocSyncQueue();

  try {
    const raw = store.getItem(getSyncQueueKey(uid));
    if (!raw) return createEmptyDocSyncQueue();
    const parsed = JSON.parse(raw) as Partial<DocSyncQueue>;
    const seenFiles = new Set<string>();
    const uploadFiles: PendingDocFileUpload[] = [];
    if (Array.isArray(parsed?.uploadFiles)) {
      for (const entry of parsed.uploadFiles) {
        if (
          entry &&
          typeof entry.fileId === 'string' &&
          entry.fileId.trim() &&
          typeof entry.docId === 'string' &&
          entry.docId.trim() &&
          !seenFiles.has(entry.fileId.trim())
        ) {
          seenFiles.add(entry.fileId.trim());
          uploadFiles.push({
            fileId: entry.fileId.trim(),
            docId: entry.docId.trim(),
          });
        }
      }
    }

    return {
      upsertDocIds: normalizeIdArray(parsed?.upsertDocIds),
      deleteDocIds: normalizeIdArray(parsed?.deleteDocIds),
      uploadFiles,
      deleteFileIds: normalizeIdArray(parsed?.deleteFileIds),
    };
  } catch {
    return createEmptyDocSyncQueue();
  }
}

export function saveDocSyncQueue(
  uid: string | null | undefined,
  queue: DocSyncQueue,
  storage?: DocSyncStorageLike | null
): void {
  if (!uid) return;
  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    if (countPendingDocSyncOps(queue) === 0) {
      store.removeItem(getSyncQueueKey(uid));
    } else {
      store.setItem(getSyncQueueKey(uid), JSON.stringify(queue));
    }
  } catch {
    // ignore storage write failures
  }
}

export function clearDocSyncQueue(
  uid: string | null | undefined,
  storage?: DocSyncStorageLike | null
): void {
  if (!uid) return;
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.removeItem(getSyncQueueKey(uid));
  } catch {
    // ignore storage errors
  }
}

export function enqueueDocUpsert(
  uid: string | null | undefined,
  docId: string,
  newFiles: PendingDocFileUpload[] = [],
  removedFileIds: string[] = [],
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !docId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);

  const upsertSet = new Set(queue.upsertDocIds);
  upsertSet.add(docId);
  queue.upsertDocIds = Array.from(upsertSet);
  queue.deleteDocIds = queue.deleteDocIds.filter((id) => id !== docId);

  const delFileSet = new Set(queue.deleteFileIds);
  const uploadMap = new Map(queue.uploadFiles.map((f) => [f.fileId, f]));

  for (const nf of newFiles) {
    if (nf.fileId && nf.docId) {
      uploadMap.set(nf.fileId, nf);
      delFileSet.delete(nf.fileId);
    }
  }

  for (const rf of removedFileIds) {
    if (rf) {
      uploadMap.delete(rf);
      delFileSet.add(rf);
    }
  }

  queue.uploadFiles = Array.from(uploadMap.values());
  queue.deleteFileIds = Array.from(delFileSet);
  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

export function enqueueDocDelete(
  uid: string | null | undefined,
  docId: string,
  fileIds: string[],
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !docId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);

  queue.upsertDocIds = queue.upsertDocIds.filter((id) => id !== docId);
  const delDocSet = new Set(queue.deleteDocIds);
  delDocSet.add(docId);
  queue.deleteDocIds = Array.from(delDocSet);

  const pendingUploadFileIds = new Set(queue.uploadFiles.map((f) => f.fileId));
  queue.uploadFiles = queue.uploadFiles.filter(
    (f) => f.docId !== docId && !fileIds.includes(f.fileId)
  );

  // Only queue cloud delete for files that weren't strictly local-only unsynced uploads
  const delFileSet = new Set(queue.deleteFileIds);
  for (const fid of fileIds) {
    if (fid && !pendingUploadFileIds.has(fid)) {
      delFileSet.add(fid);
    }
  }
  queue.deleteFileIds = Array.from(delFileSet);

  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

export function markFileUploadedInQueue(
  uid: string | null | undefined,
  fileId: string,
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !fileId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);
  queue.uploadFiles = queue.uploadFiles.filter((f) => f.fileId !== fileId);
  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

export function markFileDeletedInQueue(
  uid: string | null | undefined,
  fileId: string,
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !fileId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);
  queue.deleteFileIds = queue.deleteFileIds.filter((id) => id !== fileId);
  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

export function markDocUpsertSyncedInQueue(
  uid: string | null | undefined,
  docId: string,
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !docId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);
  queue.upsertDocIds = queue.upsertDocIds.filter((id) => id !== docId);
  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

export function markDocDeleteSyncedInQueue(
  uid: string | null | undefined,
  docId: string,
  storage?: DocSyncStorageLike | null
): DocSyncQueue {
  if (!uid || !docId) return createEmptyDocSyncQueue();
  const queue = loadDocSyncQueue(uid, storage);
  queue.deleteDocIds = queue.deleteDocIds.filter((id) => id !== docId);
  saveDocSyncQueue(uid, queue, storage);
  return queue;
}

// ============================================================================
// IndexedDB Persistence for Document Metadata + Full-Size Compressed Images
// ============================================================================

function openDocumentsDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DOC_DB_NAME, DOC_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'uid' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Documents IndexedDB open failed:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('Documents IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

function makeFileKey(uid: string, fileId: string): string {
  return `${uid}:${fileId}`;
}

export async function loadDocumentsMetaFromIdb(uid: string): Promise<MedicalDocument[]> {
  if (!uid) return [];
  const db = await openDocumentsDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.get(uid);

      req.onsuccess = () => {
        const res = req.result as StoredMetaRecord | undefined;
        resolve(res && Array.isArray(res.documents) ? res.documents : []);
      };
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function saveDocumentsMetaToIdb(
  uid: string,
  documents: MedicalDocument[]
): Promise<boolean> {
  if (!uid) return false;
  const db = await openDocumentsDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const record: StoredMetaRecord = {
        uid,
        documents,
        syncedAtMs: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function getDocumentFileFromIdb(
  uid: string,
  fileId: string
): Promise<MedicalDocumentFile | null> {
  if (!uid || !fileId) return null;
  const db = await openDocumentsDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FILES_STORE, 'readonly');
      const store = tx.objectStore(FILES_STORE);
      const req = store.get(makeFileKey(uid, fileId));

      req.onsuccess = () => {
        const res = req.result as StoredFileRecord | undefined;
        if (res && typeof res.data === 'string' && res.data) {
          resolve({
            id: res.fileId,
            docId: res.docId,
            data: res.data,
            bytes: res.bytes,
            createdAt: res.createdAtIso,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function saveDocumentFileToIdb(
  uid: string,
  file: { id: string; docId: string; data: string; bytes: number; createdAtIso?: string }
): Promise<boolean> {
  if (!uid || !file.id || !file.data) return false;
  const db = await openDocumentsDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FILES_STORE, 'readwrite');
      const store = tx.objectStore(FILES_STORE);
      const record: StoredFileRecord = {
        key: makeFileKey(uid, file.id),
        uid,
        fileId: file.id,
        docId: file.docId,
        data: file.data,
        bytes: file.bytes,
        createdAtIso: file.createdAtIso || new Date().toISOString(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function deleteDocumentFilesFromIdb(
  uid: string,
  fileIds: string[]
): Promise<void> {
  if (!uid || !fileIds || fileIds.length === 0) return;
  const db = await openDocumentsDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FILES_STORE, 'readwrite');
      const store = tx.objectStore(FILES_STORE);
      for (const fid of fileIds) {
        if (fid) {
          store.delete(makeFileKey(uid, fid));
        }
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function clearUserDocumentsIdb(uid: string): Promise<void> {
  if (!uid) return;
  const db = await openDocumentsDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([META_STORE, FILES_STORE], 'readwrite');
      const metaStore = tx.objectStore(META_STORE);
      metaStore.delete(uid);

      const filesStore = tx.objectStore(FILES_STORE);
      const cursorReq = filesStore.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const val = cursor.value as StoredFileRecord | undefined;
        if (val?.uid === uid) {
          cursor.delete();
        }
        cursor.continue();
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
