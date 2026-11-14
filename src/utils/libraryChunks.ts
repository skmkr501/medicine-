import { GlobalMedicine } from '../types';
import { generateDuplicateKey } from './medicineImportParser';

export const DEFAULT_LIBRARY_CHUNK_SIZE = 200;
export const MAX_LIBRARY_CHUNK_BYTES = 750_000;

export interface LibraryMetaDoc {
  version: number;
  chunkCount: number;
  totalCount: number;
  updatedAt: string;
}

export interface LibraryChunkDoc {
  version: number;
  index: number;
  items: GlobalMedicine[];
}

export function estimateUtf8Bytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return Buffer.byteLength(json, 'utf8');
}

export function stripUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = stripUndefinedDeep(value);
    }
  }
  return result as T;
}

/**
 * Splits a medicine catalog into deterministic Firestore chunk documents:
 * - Never more than maxItemsPerChunk (default 200) items per chunk
 * - Dynamically splits smaller chunks if UTF-8 serialized size approaches maxBytesPerChunk (< 1MB)
 */
export function buildLibraryChunks(
  medicines: GlobalMedicine[],
  version: number,
  maxItemsPerChunk: number = DEFAULT_LIBRARY_CHUNK_SIZE,
  maxBytesPerChunk: number = MAX_LIBRARY_CHUNK_BYTES
): LibraryChunkDoc[] {
  if (!medicines || medicines.length === 0) {
    return [];
  }

  const chunks: LibraryChunkDoc[] = [];
  let currentItems: GlobalMedicine[] = [];

  for (const rawItem of medicines) {
    const cleanItem = stripUndefinedDeep(rawItem);
    const candidateItems = [...currentItems, cleanItem];
    const candidateDoc: LibraryChunkDoc = {
      version,
      index: chunks.length,
      items: candidateItems,
    };

    const exceedsCount = candidateItems.length > maxItemsPerChunk;
    const exceedsBytes =
      currentItems.length > 0 && estimateUtf8Bytes(candidateDoc) > maxBytesPerChunk;

    if (exceedsCount || exceedsBytes) {
      chunks.push({
        version,
        index: chunks.length,
        items: currentItems,
      });
      currentItems = [cleanItem];
    } else {
      currentItems = candidateItems;
    }
  }

  if (currentItems.length > 0) {
    chunks.push({
      version,
      index: chunks.length,
      items: currentItems,
    });
  }

  return chunks;
}

function normalizeComparableMedicine(med: GlobalMedicine): Record<string, unknown> {
  const dupKey =
    med.duplicateKey ||
    generateDuplicateKey(
      med.brandName || '',
      med.genericName || '',
      med.strength || '',
      med.dosageForm || '',
      med.manufacturer || ''
    );
  return {
    brandName: (med.brandName || '').trim(),
    genericName: (med.genericName || '').trim(),
    strength: (med.strength || '').trim(),
    dosageForm: (med.dosageForm || '').trim(),
    manufacturer: (med.manufacturer || '').trim(),
    brandNameBn: (med.brandNameBn || '').trim(),
    genericNameBn: (med.genericNameBn || '').trim(),
    therapeuticClass: (med.therapeuticClass || '').trim(),
    indication: (med.indication || '').trim(),
    pricePerUnit: typeof med.pricePerUnit === 'number' ? med.pricePerUnit : null,
    packageDescription: (med.packageDescription || '').trim(),
    darNumber: (med.darNumber || '').trim(),
    status: med.status || 'published',
    verifiedByAdmin: Boolean(med.verifiedByAdmin),
    source: med.source || 'DGDA_GOV',
    licenseReference: (med.licenseReference || '').trim(),
    duplicateKey: dupKey.trim().toLowerCase(),
  };
}

function areMedicinesEqual(a: GlobalMedicine, b: GlobalMedicine): boolean {
  return (
    JSON.stringify(normalizeComparableMedicine(a)) ===
    JSON.stringify(normalizeComparableMedicine(b))
  );
}

/**
 * Checks incoming medicines against an in-memory catalog (no Firestore reads).
 * - Preserves untouched existing items
 * - Updates existing items only if fields actually changed
 * - Adds truly new items
 * - Returns changed=false when nothing new or modified was found
 */
export function hasCatalogChanges(
  existingList: GlobalMedicine[],
  incomingList: GlobalMedicine[]
): {
  changed: boolean;
  mergedList: GlobalMedicine[];
  addedOrUpdatedCount: number;
} {
  if (!incomingList || incomingList.length === 0) {
    return { changed: false, mergedList: existingList, addedOrUpdatedCount: 0 };
  }

  const nextList = [...existingList];
  const indexById = new Map<string, number>();
  const indexByDupKey = new Map<string, number>();

  nextList.forEach((item, idx) => {
    if (item.id) indexById.set(item.id, idx);
    const dk = (
      item.duplicateKey ||
      generateDuplicateKey(
        item.brandName || '',
        item.genericName || '',
        item.strength || '',
        item.dosageForm || '',
        item.manufacturer || ''
      )
    )
      .trim()
      .toLowerCase();
    if (dk) indexByDupKey.set(dk, idx);
  });

  let addedOrUpdatedCount = 0;

  for (const incoming of incomingList) {
    const cleanIncoming = stripUndefinedDeep(incoming);
    const dk = (
      cleanIncoming.duplicateKey ||
      generateDuplicateKey(
        cleanIncoming.brandName || '',
        cleanIncoming.genericName || '',
        cleanIncoming.strength || '',
        cleanIncoming.dosageForm || '',
        cleanIncoming.manufacturer || ''
      )
    )
      .trim()
      .toLowerCase();

    let existingIdx = indexById.get(cleanIncoming.id);
    if (existingIdx === undefined && dk) {
      existingIdx = indexByDupKey.get(dk);
    }

    if (existingIdx !== undefined) {
      const existingItem = nextList[existingIdx];
      const mergedItem: GlobalMedicine = {
        ...existingItem,
        ...cleanIncoming,
        id: existingItem.id || cleanIncoming.id,
        duplicateKey: cleanIncoming.duplicateKey || existingItem.duplicateKey,
      };
      if (!areMedicinesEqual(existingItem, mergedItem)) {
        nextList[existingIdx] = mergedItem;
        addedOrUpdatedCount++;
      }
    } else {
      const newIdx = nextList.length;
      nextList.push(cleanIncoming);
      if (cleanIncoming.id) indexById.set(cleanIncoming.id, newIdx);
      if (dk) indexByDupKey.set(dk, newIdx);
      addedOrUpdatedCount++;
    }
  }

  return {
    changed: addedOrUpdatedCount > 0,
    mergedList: addedOrUpdatedCount > 0 ? nextList : existingList,
    addedOrUpdatedCount,
  };
}

/**
 * Decides whether a user client needs to fetch library_chunks after receiving library_meta/current.
 */
export function shouldFetchChunksForMeta(params: {
  meta: LibraryMetaDoc | null;
  localVersion: number;
  hasLocalCatalog: boolean;
}): boolean {
  const { meta, localVersion, hasLocalCatalog } = params;
  if (!meta || meta.version <= 0 || meta.chunkCount <= 0) {
    return false;
  }
  if (!hasLocalCatalog) {
    return true;
  }
  return meta.version > localVersion;
}
