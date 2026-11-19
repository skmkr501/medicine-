import { supabase } from './client';
import {
  medicalDocumentFromRow,
  MedicalDocumentRow,
  medicalDocumentToRow,
} from './mappers';
import { retryWithBackoff } from './userDataService';
import { MedicalDocument, MedicalDocumentFile } from '../types';
import {
  blobToDataUrl,
  buildCleanMedicalDocumentInput,
  dataUrlToJpegBlob,
  DocumentFormInput,
} from '../utils/medicalDocuments';

export const MEDICAL_DOCS_BUCKET = 'medical-docs';
export const DOC_SIGNED_URL_TTL_SECONDS = 3600; // 1 hour
export const DOC_SIGNED_URL_REFRESH_BUFFER_MS = 60 * 1000;
export const DOC_MAX_RETRIES = 3;
export const DOC_BASE_RETRY_DELAY_MS = 500;

export function buildDocumentStoragePath(
  userId: string,
  docId: string,
  fileId: string
): string {
  const cleanUser = userId.trim();
  const cleanDoc = docId.trim();
  const cleanFile = fileId.trim();
  if (!cleanUser || !cleanDoc || !cleanFile) {
    throw new Error('অবৈধ ডকুমেন্ট স্টোরেজ পাথ প্যারামিটার');
  }
  return `${cleanUser}/${cleanDoc}/${cleanFile}.jpg`;
}

// In-session signed URL cache keyed by storage path with expiry tracking
const signedUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

export function clearDocumentSignedUrlCache(): void {
  signedUrlCache.clear();
}

export interface StorageBucketClientLike {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob,
        options?: { contentType?: string; upsert?: boolean }
      ) => PromiseLike<{ error: unknown | null }>;
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => PromiseLike<{ data: { signedUrl?: string } | null; error: unknown | null }>;
      download: (
        path: string
      ) => PromiseLike<{ data: Blob | null; error: unknown | null }>;
      remove: (paths: string[]) => PromiseLike<{ error: unknown | null }>;
      list?: (
        path?: string,
        options?: { limit?: number; offset?: number }
      ) => PromiseLike<{ data: Array<{ name: string; id?: string | null }> | null; error: unknown | null }>;
    };
  };
}

export async function getDocumentSignedUrl(
  userId: string,
  docId: string,
  fileId: string,
  options: { client?: StorageBucketClientLike; nowMs?: number } = {}
): Promise<string | null> {
  const path = buildDocumentStoragePath(userId, docId, fileId);
  const now = options.nowMs ?? Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAtMs - now > DOC_SIGNED_URL_REFRESH_BUFFER_MS) {
    return cached.url;
  }

  const client = options.client ?? (supabase as unknown as StorageBucketClientLike);
  const { data, error } = await retryWithBackoff(
    async () =>
      client.storage
        .from(MEDICAL_DOCS_BUCKET)
        .createSignedUrl(path, DOC_SIGNED_URL_TTL_SECONDS),
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );

  if (error || !data?.signedUrl) {
    return null;
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAtMs: now + DOC_SIGNED_URL_TTL_SECONDS * 1000,
  });

  return data.signedUrl;
}

// ============================================================================
// Metadata Table Operations (public.medical_documents)
// ============================================================================

export async function fetchUserDocumentsMetaFromSupabase(
  userId: string
): Promise<MedicalDocument[]> {
  if (!userId) return [];

  const { data, error } = await retryWithBackoff(
    async () =>
      supabase
        .from('medical_documents')
        .select('*')
        .eq('user_id', userId)
        .order('doc_date', { ascending: false }),
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );

  if (error) throw error;
  return Array.isArray(data)
    ? (data as MedicalDocumentRow[]).map((row) => medicalDocumentFromRow(row))
    : [];
}

export async function createDocumentMetaInSupabase(
  _userId: string,
  docId: string,
  docInput: DocumentFormInput
): Promise<void> {
  const clean = buildCleanMedicalDocumentInput(docInput);
  const nowIso = new Date().toISOString();
  const row: MedicalDocumentRow = medicalDocumentToRow({
    id: docId,
    kind: clean.kind,
    patientId: clean.patientId,
    doctorId: clean.doctorId,
    title: clean.title,
    date: clean.date,
    note: clean.note,
    reportType: clean.reportType,
    pages: clean.pages,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await retryWithBackoff(
    async () => {
      const { error } = await supabase
        .from('medical_documents')
        .upsert([row], { onConflict: 'user_id,id' });
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

export async function updateDocumentMetaInSupabase(
  _userId: string,
  docId: string,
  docInput: DocumentFormInput,
  existingCreatedAt?: unknown
): Promise<void> {
  const clean = buildCleanMedicalDocumentInput(docInput);
  const nowIso = new Date().toISOString();
  const row: MedicalDocumentRow = medicalDocumentToRow({
    id: docId,
    kind: clean.kind,
    patientId: clean.patientId,
    doctorId: clean.doctorId,
    title: clean.title,
    date: clean.date,
    note: clean.note,
    reportType: clean.reportType,
    pages: clean.pages,
    createdAt: existingCreatedAt || nowIso,
    updatedAt: nowIso,
  });

  await retryWithBackoff(
    async () => {
      const { error } = await supabase
        .from('medical_documents')
        .upsert([row], { onConflict: 'user_id,id' });
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

export async function deleteDocumentMetaFromSupabase(
  userId: string,
  docId: string
): Promise<void> {
  if (!userId || !docId) return;

  await retryWithBackoff(
    async () => {
      const { error } = await supabase
        .from('medical_documents')
        .delete()
        .eq('user_id', userId)
        .eq('id', docId);
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

// ============================================================================
// Private Storage Bucket Operations (bucket: 'medical-docs')
// ============================================================================

export async function uploadDocumentFileToStorage(
  userId: string,
  file: { id: string; docId: string; data: string; bytes: number },
  options: { client?: StorageBucketClientLike } = {}
): Promise<void> {
  const path = buildDocumentStoragePath(userId, file.docId, file.id);
  const blob = dataUrlToJpegBlob(file.data);
  const client = options.client ?? (supabase as unknown as StorageBucketClientLike);

  await retryWithBackoff(
    async () => {
      const { error } = await client.storage
        .from(MEDICAL_DOCS_BUCKET)
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

async function resolveDocIdForFile(
  userId: string,
  fileId: string,
  providedDocId?: string
): Promise<string | null> {
  if (providedDocId && providedDocId.trim()) {
    return providedDocId.trim();
  }
  try {
    const { data } = await supabase
      .from('medical_documents')
      .select('id, pages')
      .eq('user_id', userId);
    if (Array.isArray(data)) {
      for (const row of data as Array<{ id: string; pages?: Array<{ fileId?: string }> }>) {
        if (
          Array.isArray(row.pages) &&
          row.pages.some((p) => p && p.fileId === fileId)
        ) {
          return row.id;
        }
      }
    }
  } catch {
    // ignore lookup error
  }
  return null;
}

export async function fetchDocumentFileFromStorage(
  userId: string,
  fileId: string,
  docId?: string
): Promise<MedicalDocumentFile | null> {
  if (!userId || !fileId) return null;
  const resolvedDocId = await resolveDocIdForFile(userId, fileId, docId);
  if (!resolvedDocId) return null;

  const path = buildDocumentStoragePath(userId, resolvedDocId, fileId);
  const { data, error } = await retryWithBackoff(
    async () => supabase.storage.from(MEDICAL_DOCS_BUCKET).download(path),
    { maxRetries: 2, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );

  if (error || !data) return null;

  const dataUrl = await blobToDataUrl(data);
  return {
    id: fileId,
    docId: resolvedDocId,
    data: dataUrl,
    bytes: data.size || dataUrl.length,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteDocumentFileFromStorage(
  userId: string,
  docId: string | undefined,
  fileId: string
): Promise<void> {
  if (!userId || !fileId) return;
  const resolvedDocId = await resolveDocIdForFile(userId, fileId, docId);
  if (!resolvedDocId) return;

  const path = buildDocumentStoragePath(userId, resolvedDocId, fileId);
  signedUrlCache.delete(path);

  await retryWithBackoff(
    async () => {
      const { error } = await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove([path]);
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

export async function deleteDocumentFilesForDocFromStorage(
  userId: string,
  docId: string,
  fileIds: string[]
): Promise<void> {
  if (!userId || !docId || fileIds.length === 0) return;
  const paths = fileIds
    .map((fid) => fid.trim())
    .filter(Boolean)
    .map((fid) => {
      const p = buildDocumentStoragePath(userId, docId, fid);
      signedUrlCache.delete(p);
      return p;
    });

  if (paths.length === 0) return;

  await retryWithBackoff(
    async () => {
      const { error } = await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove(paths);
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}

/**
 * Removes all user files under `${userId}/` inside 'medical-docs' bucket
 * AND deletes all rows from public.medical_documents for this user.
 */
export async function clearUserDocumentsAndStorage(userId: string): Promise<void> {
  if (!userId) return;
  clearDocumentSignedUrlCache();

  // 1. Gather all paths from metadata rows + storage directory listing
  const pathSet = new Set<string>();
  try {
    const docs = await fetchUserDocumentsMetaFromSupabase(userId);
    for (const d of docs) {
      if (Array.isArray(d.pages)) {
        for (const p of d.pages) {
          if (p && typeof p.fileId === 'string' && p.fileId.trim()) {
            pathSet.add(buildDocumentStoragePath(userId, d.id, p.fileId.trim()));
          }
        }
      }
    }
  } catch (err) {
    console.warn('clearUserDocumentsAndStorage metadata scan notice:', err);
  }

  try {
    const { data: topEntries } = await supabase.storage
      .from(MEDICAL_DOCS_BUCKET)
      .list(userId, { limit: 1000 });
    if (Array.isArray(topEntries)) {
      for (const entry of topEntries) {
        if (!entry.name) continue;
        if (entry.id) {
          pathSet.add(`${userId}/${entry.name}`);
        } else {
          // Folder representing docId
          const subFolder = `${userId}/${entry.name}`;
          const { data: subFiles } = await supabase.storage
            .from(MEDICAL_DOCS_BUCKET)
            .list(subFolder, { limit: 100 });
          if (Array.isArray(subFiles)) {
            for (const f of subFiles) {
              if (f.name) {
                pathSet.add(`${subFolder}/${f.name}`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('clearUserDocumentsAndStorage storage list notice:', err);
  }

  const allPaths = Array.from(pathSet);
  const REMOVE_BATCH = 100;
  for (let i = 0; i < allPaths.length; i += REMOVE_BATCH) {
    const chunk = allPaths.slice(i, i + REMOVE_BATCH);
    try {
      await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove(chunk);
    } catch (err) {
      console.warn('clearUserDocumentsAndStorage remove chunk notice:', err);
    }
  }

  // 2. Delete all medical_documents rows for userId
  await retryWithBackoff(
    async () => {
      const { error } = await supabase
        .from('medical_documents')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    { maxRetries: DOC_MAX_RETRIES, baseDelayMs: DOC_BASE_RETRY_DELAY_MS }
  );
}
