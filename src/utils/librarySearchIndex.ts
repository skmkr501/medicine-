import { GlobalMedicine } from '../types';
import { getMedicineAlphabetLetter, toPhoneticLatin } from './libraryManagement';

export type SourceFilterGroup = 'DGDA' | 'MANUFACTURER' | 'INDEPENDENT' | 'MEDEX' | 'DIMS' | 'OTHER';

export interface IndexedMedicine {
  med: GlobalMedicine;
  id: string;
  sig: string;
  brand: string;
  brandBn: string;
  generic: string;
  genericBn: string;
  strength: string;
  manufacturer: string;
  indication: string;
  therapeuticClass: string;
  dosageForm: string;
  rawManufacturer: string;
  letter: string;
  isPublished: boolean;
  hasPrice: boolean;
  sourceGroup: SourceFilterGroup;
  brandPhonetic: string;
  genericPhonetic: string;
  genericWords: string[];
  candidateWords: string[];
}

export interface LibrarySearchFilters {
  isAdmin: boolean;
  adminStatusFilter: 'published' | 'pending' | 'all';
  favoritesOnly: boolean;
  favoriteIdSet: Set<string>;
  selectedLetter: string;
  selectedForm: string;
  selectedManufacturer: string;
  priceFilter: 'all' | 'has_price' | 'no_price';
  selectedSource: string;
}

export interface LibraryMetadata {
  uniqueManufacturers: string[];
  uniqueForms: string[];
  availableLettersPublished: Set<string>;
  availableLettersPending: Set<string>;
  availableLettersAll: Set<string>;
  publishedCount: number;
  pendingCount: number;
}

export interface LibrarySearchIndex extends LibraryMetadata {
  entries: IndexedMedicine[];
  totalCount: number;
}

export interface LibrarySearchResult {
  medicines: GlobalMedicine[];
  firstGenericMatch: GlobalMedicine | null;
  totalMatchedBeforeCap: number;
}

export const LIBRARY_INDEX_BATCH_SIZE = 500;
export const MAX_LIBRARY_SEARCH_RESULTS = 200;
const STEP1_PHONETIC_CUTOFF = 30;
const STEP12_FUZZY_CUTOFF = 10;

// Pre-allocated buffers for zero-allocation bounded Levenshtein checks
const LEV_BUF_SIZE = 128;
const levPrev = new Int32Array(LEV_BUF_SIZE);
const levCurr = new Int32Array(LEV_BUF_SIZE);

function splitUniqueWords(text: string): string[] {
  if (!text) return [];
  const parts = text.split(' ');
  if (parts.length <= 1) {
    return parts[0] ? [parts[0]] : [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (w && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function resolveSourceGroup(source?: string): SourceFilterGroup {
  if (source === 'DGDA_GOV' || source === 'DGDA_Official') return 'DGDA';
  if (source === 'MANUFACTURER') return 'MANUFACTURER';
  if (source === 'INDEPENDENT_VERIFIED') return 'INDEPENDENT';
  if (source === 'MEDEX_LICENSED' || source === 'MedEx') return 'MEDEX';
  if (source === 'DIMS_LICENSED' || source === 'DIMS') return 'DIMS';
  return 'OTHER';
}

export function computeMedicineSearchSignature(med: GlobalMedicine): string {
  return [
    med.brandName || '',
    med.brandNameBn || '',
    med.genericName || '',
    med.genericNameBn || '',
    med.strength || '',
    med.dosageForm || '',
    med.manufacturer || '',
    med.indication || '',
    med.therapeuticClass || '',
    med.status || '',
    med.pricePerUnit ?? '',
    med.source || '',
  ].join('\u0001');
}

export function buildIndexedMedicineEntry(med: GlobalMedicine, sig?: string): IndexedMedicine {
  const computedSig = sig ?? computeMedicineSearchSignature(med);
  const brand = (med.brandName || '').toLowerCase();
  const brandBn = (med.brandNameBn || '').toLowerCase();
  const generic = (med.genericName || '').toLowerCase();
  const genericBn = (med.genericNameBn || '').toLowerCase();
  const strength = (med.strength || '').toLowerCase();
  const manufacturer = (med.manufacturer || '').toLowerCase();
  const indication = (med.indication || '').toLowerCase();
  const therapeuticClass = (med.therapeuticClass || '').toLowerCase();

  const brandPhonetic = toPhoneticLatin(`${med.brandName || ''} ${med.brandNameBn || ''}`);
  const genericPhonetic = toPhoneticLatin(`${med.genericName || ''} ${med.genericNameBn || ''}`);
  const extraPhonetic = toPhoneticLatin(
    `${med.strength || ''} ${med.manufacturer || ''} ${med.dosageForm || ''} ${med.indication || ''}`
  );

  const genericWords = splitUniqueWords(genericPhonetic);
  const combinedText = [brandPhonetic, genericPhonetic, extraPhonetic].filter(Boolean).join(' ');
  const candidateWords = splitUniqueWords(combinedText);

  return {
    med,
    id: med.id,
    sig: computedSig,
    brand,
    brandBn,
    generic,
    genericBn,
    strength,
    manufacturer,
    indication,
    therapeuticClass,
    dosageForm: med.dosageForm || '',
    rawManufacturer: med.manufacturer || '',
    letter: getMedicineAlphabetLetter(med.brandName),
    isPublished: med.status === 'published',
    hasPrice: med.pricePerUnit !== undefined && med.pricePerUnit > 0,
    sourceGroup: resolveSourceGroup(med.source),
    brandPhonetic,
    genericPhonetic,
    genericWords,
    candidateWords,
  };
}

const metadataWeakCache = new WeakMap<GlobalMedicine[], LibraryMetadata>();

export function computeLibraryMetadata(medicines: GlobalMedicine[]): LibraryMetadata {
  const cached = metadataWeakCache.get(medicines);
  if (cached) return cached;

  const mfgSet = new Set<string>();
  const formSet = new Set<string>();
  const availableLettersPublished = new Set<string>();
  const availableLettersPending = new Set<string>();
  const availableLettersAll = new Set<string>();
  let publishedCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < medicines.length; i++) {
    const m = medicines[i];
    if (m.manufacturer) mfgSet.add(m.manufacturer);
    if (m.dosageForm) formSet.add(m.dosageForm);
    const letter = getMedicineAlphabetLetter(m.brandName);
    availableLettersAll.add(letter);
    if (m.status === 'published') {
      publishedCount++;
      availableLettersPublished.add(letter);
    } else {
      pendingCount++;
      availableLettersPending.add(letter);
    }
  }

  const result: LibraryMetadata = {
    uniqueManufacturers: Array.from(mfgSet).sort(),
    uniqueForms: Array.from(formSet).sort(),
    availableLettersPublished,
    availableLettersPending,
    availableLettersAll,
    publishedCount,
    pendingCount,
  };

  metadataWeakCache.set(medicines, result);
  return result;
}

// Persistent module-level cache for incremental updates across renders and page switches
const cachedEntryById = new Map<string, { ref: GlobalMedicine; sig: string; entry: IndexedMedicine }>();
let cachedMedicinesRef: GlobalMedicine[] | null = null;
let cachedIndex: LibrarySearchIndex | null = null;
let activeIdleHandle: number | null = null;
let activeBuildToken = 0;

function cancelActiveBuild(): void {
  activeBuildToken++;
  if (activeIdleHandle !== null) {
    if (typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function') {
      (window as any).cancelIdleCallback(activeIdleHandle);
    } else {
      clearTimeout(activeIdleHandle);
    }
    activeIdleHandle = null;
  }
}

export function clearLibrarySearchIndexCache(): void {
  cancelActiveBuild();
  cachedEntryById.clear();
  cachedMedicinesRef = null;
  cachedIndex = null;
}

function finalizeIndexFromEntries(
  medicines: GlobalMedicine[],
  entries: IndexedMedicine[]
): LibrarySearchIndex {
  const nextIds = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    nextIds.add(e.id);
    cachedEntryById.set(e.id, { ref: e.med, sig: e.sig, entry: e });
  }
  for (const id of cachedEntryById.keys()) {
    if (!nextIds.has(id)) {
      cachedEntryById.delete(id);
    }
  }

  const meta = computeLibraryMetadata(medicines);
  const built: LibrarySearchIndex = {
    entries,
    totalCount: entries.length,
    ...meta,
  };

  cachedMedicinesRef = medicines;
  cachedIndex = built;
  return built;
}

/**
 * Synchronously builds (or incrementally updates) the full search index.
 * Used directly in benchmarks/tests and when <= 500 items need indexing.
 */
export function buildLibrarySearchIndexSync(
  medicines: GlobalMedicine[],
  useGlobalCache = true
): LibrarySearchIndex {
  if (useGlobalCache && cachedMedicinesRef === medicines && cachedIndex) {
    return cachedIndex;
  }

  const entries = new Array<IndexedMedicine>(medicines.length);
  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    if (useGlobalCache) {
      const existing = cachedEntryById.get(med.id);
      if (existing) {
        if (existing.ref === med) {
          entries[i] = existing.entry;
          continue;
        }
        const sig = computeMedicineSearchSignature(med);
        if (existing.sig === sig) {
          // Reuse computed phonetic/word arrays while updating med ref
          entries[i] = { ...existing.entry, med };
          continue;
        }
        entries[i] = buildIndexedMedicineEntry(med, sig);
        continue;
      }
    }
    entries[i] = buildIndexedMedicineEntry(med);
  }

  if (!useGlobalCache) {
    const meta = computeLibraryMetadata(medicines);
    return {
      entries,
      totalCount: entries.length,
      ...meta,
    };
  }

  return finalizeIndexFromEntries(medicines, entries);
}

/**
 * Returns cached index immediately if ready; otherwise builds incrementally if uncached <= 500,
 * or schedules 500-item idle batches without blocking the main thread.
 */
export function getOrBuildLibrarySearchIndex(
  medicines: GlobalMedicine[],
  onIndexReady: (index: LibrarySearchIndex) => void
): LibrarySearchIndex | null {
  if (cachedMedicinesRef === medicines && cachedIndex) {
    return cachedIndex;
  }

  // Count uncached/changed items to decide sync vs idle-batched build
  let dirtyCount = 0;
  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    const existing = cachedEntryById.get(med.id);
    if (!existing) {
      dirtyCount++;
    } else if (existing.ref !== med) {
      const sig = computeMedicineSearchSignature(med);
      if (existing.sig !== sig) dirtyCount++;
    }
    if (dirtyCount > LIBRARY_INDEX_BATCH_SIZE) break;
  }

  if (dirtyCount <= LIBRARY_INDEX_BATCH_SIZE) {
    cancelActiveBuild();
    return buildLibrarySearchIndexSync(medicines, true);
  }

  // Large cold build: process in 500-item chunks using requestIdleCallback
  cancelActiveBuild();
  const token = ++activeBuildToken;
  const entries = new Array<IndexedMedicine>(medicines.length);
  let cursor = 0;

  const scheduleNextChunk = () => {
    if (token !== activeBuildToken) return;

    const runChunk = () => {
      if (token !== activeBuildToken) return;
      activeIdleHandle = null;

      let processedDirty = 0;
      while (cursor < medicines.length && processedDirty < LIBRARY_INDEX_BATCH_SIZE) {
        const med = medicines[cursor];
        const existing = cachedEntryById.get(med.id);
        if (existing && existing.ref === med) {
          entries[cursor] = existing.entry;
        } else if (existing) {
          const sig = computeMedicineSearchSignature(med);
          if (existing.sig === sig) {
            entries[cursor] = { ...existing.entry, med };
          } else {
            entries[cursor] = buildIndexedMedicineEntry(med, sig);
            processedDirty++;
          }
        } else {
          entries[cursor] = buildIndexedMedicineEntry(med);
          processedDirty++;
        }
        cursor++;
      }

      if (cursor >= medicines.length) {
        const finalized = finalizeIndexFromEntries(medicines, entries);
        onIndexReady(finalized);
      } else {
        scheduleNextChunk();
      }
    };

    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      activeIdleHandle = (window as any).requestIdleCallback(runChunk, { timeout: 120 });
    } else {
      activeIdleHandle = setTimeout(runChunk, 0) as unknown as number;
    }
  };

  scheduleNextChunk();
  return null;
}

function matchesFiltersOnMed(med: GlobalMedicine, filters: LibrarySearchFilters): boolean {
  if (!filters.isAdmin) {
    if (med.status !== 'published') return false;
  } else {
    if (filters.adminStatusFilter === 'published' && med.status !== 'published') return false;
    if (filters.adminStatusFilter === 'pending' && med.status === 'published') return false;
  }

  if (filters.favoritesOnly && !filters.favoriteIdSet.has(med.id)) return false;

  if (filters.selectedLetter !== 'ALL' && getMedicineAlphabetLetter(med.brandName) !== filters.selectedLetter) {
    return false;
  }

  if (filters.selectedForm !== 'all' && med.dosageForm !== filters.selectedForm) return false;
  if (filters.selectedManufacturer !== 'all' && med.manufacturer !== filters.selectedManufacturer) return false;

  if (filters.priceFilter === 'has_price' && (med.pricePerUnit === undefined || med.pricePerUnit <= 0)) {
    return false;
  }
  if (filters.priceFilter === 'no_price' && med.pricePerUnit !== undefined && med.pricePerUnit > 0) {
    return false;
  }

  if (filters.selectedSource !== 'all') {
    const group = resolveSourceGroup(med.source);
    if (group !== filters.selectedSource) return false;
  }

  return true;
}

function matchesFiltersOnEntry(entry: IndexedMedicine, filters: LibrarySearchFilters): boolean {
  if (!filters.isAdmin) {
    if (!entry.isPublished) return false;
  } else {
    if (filters.adminStatusFilter === 'published' && !entry.isPublished) return false;
    if (filters.adminStatusFilter === 'pending' && entry.isPublished) return false;
  }

  if (filters.favoritesOnly && !filters.favoriteIdSet.has(entry.id)) return false;
  if (filters.selectedLetter !== 'ALL' && entry.letter !== filters.selectedLetter) return false;
  if (filters.selectedForm !== 'all' && entry.dosageForm !== filters.selectedForm) return false;
  if (filters.selectedManufacturer !== 'all' && entry.rawManufacturer !== filters.selectedManufacturer) {
    return false;
  }

  if (filters.priceFilter === 'has_price' && !entry.hasPrice) return false;
  if (filters.priceFilter === 'no_price' && entry.hasPrice) return false;

  if (filters.selectedSource !== 'all' && entry.sourceGroup !== filters.selectedSource) {
    return false;
  }

  return true;
}

/**
 * Bounded, zero-allocation Levenshtein check up to `maxEdits`.
 * Compares `a` against `b[0..bCompareLen)`.
 */
function isLevenshteinWithin(a: string, b: string, bCompareLen: number, maxEdits: number): boolean {
  const aLen = a.length;
  if (Math.abs(aLen - bCompareLen) > maxEdits) return false;
  if (aLen === 0) return bCompareLen <= maxEdits;
  if (bCompareLen === 0) return aLen <= maxEdits;

  if (aLen >= LEV_BUF_SIZE || bCompareLen >= LEV_BUF_SIZE) {
    // Fallback for unusually long tokens
    const prev = Array.from({ length: bCompareLen + 1 }, (_, i) => i);
    const curr = new Array<number>(bCompareLen + 1);
    for (let i = 0; i < aLen; i++) {
      curr[0] = i + 1;
      let rowMin = curr[0];
      const ai = a.charCodeAt(i);
      for (let j = 0; j < bCompareLen; j++) {
        const cost = ai === b.charCodeAt(j) ? 0 : 1;
        const val = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
        curr[j + 1] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxEdits) return false;
      for (let j = 0; j <= bCompareLen; j++) prev[j] = curr[j];
    }
    return prev[bCompareLen] <= maxEdits;
  }

  for (let j = 0; j <= bCompareLen; j++) {
    levPrev[j] = j;
  }

  for (let i = 0; i < aLen; i++) {
    levCurr[0] = i + 1;
    let rowMin = levCurr[0];
    const ai = a.charCodeAt(i);
    for (let j = 0; j < bCompareLen; j++) {
      const cost = ai === b.charCodeAt(j) ? 0 : 1;
      const del = levPrev[j + 1] + 1;
      const ins = levCurr[j] + 1;
      const sub = levPrev[j] + cost;
      const val = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      levCurr[j + 1] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxEdits) return false;
    for (let j = 0; j <= bCompareLen; j++) {
      levPrev[j] = levCurr[j];
    }
  }

  return levPrev[bCompareLen] <= maxEdits;
}

function fuzzyTokenMatchesWords(queryToken: string, candidateWords: string[]): boolean {
  if (!queryToken) return true;
  const qLen = queryToken.length;

  for (let i = 0; i < candidateWords.length; i++) {
    if (candidateWords[i].includes(queryToken)) return true;
  }
  if (qLen < 4) return false;

  const maxEdits = qLen >= 7 ? 2 : 1;
  for (let i = 0; i < candidateWords.length; i++) {
    const word = candidateWords[i];
    const wLen = word.length;
    if (Math.abs(wLen - qLen) <= maxEdits) {
      if (isLevenshteinWithin(queryToken, word, wLen, maxEdits)) {
        return true;
      }
    } else if (wLen > qLen + 1) {
      if (isLevenshteinWithin(queryToken, word, qLen, 1)) {
        return true;
      }
    }
  }
  return false;
}

interface ScoredIndexedMatch {
  med: GlobalMedicine;
  score: number;
  isGeneric: boolean;
}

/**
 * Multi-stage search over the precomputed index:
 * Step 1: Precomputed lowercase prefix/exact/includes (stops before Step 2/3 if >= 200 matches; early-stops at 200 exact matches)
 * Step 2: Precomputed phonetic Latin match (only if Step 1 < 30 matches)
 * Step 3: Bounded Levenshtein typo-tolerant match on precomputed candidateWords (only if Step 1+2 < 10 matches & query >= 3 chars)
 */
export function searchIndexedMedicines(
  index: LibrarySearchIndex,
  filters: LibrarySearchFilters,
  rawQuery: string
): LibrarySearchResult {
  const q = rawQuery.trim().toLowerCase();
  const entries = index.entries;

  // No query: filter and sort alphabetically without capping
  if (!q) {
    const filtered: GlobalMedicine[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (matchesFiltersOnEntry(entry, filters)) {
        filtered.push(entry.med);
      }
    }
    filtered.sort((a, b) => a.brandName.localeCompare(b.brandName));
    return {
      medicines: filtered,
      firstGenericMatch: null,
      totalMatchedBeforeCap: filtered.length,
    };
  }

  // Filter first so all subsequent search steps scan a smaller scoped list
  const scoped: IndexedMedicine[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (matchesFiltersOnEntry(entry, filters)) {
      scoped.push(entry);
    }
  }

  if (scoped.length === 0) {
    return { medicines: [], firstGenericMatch: null, totalMatchedBeforeCap: 0 };
  }

  // Step 1: Fast string exact / startsWith / includes using precomputed lowercase strings
  const step1Tier100: ScoredIndexedMatch[] = [];
  const step1Tier90: ScoredIndexedMatch[] = [];
  const step1Tier85: ScoredIndexedMatch[] = [];
  const step1Remaining: IndexedMedicine[] = [];
  let firstGenericMatch: GlobalMedicine | null = null;

  for (let i = 0; i < scoped.length; i++) {
    const entry = scoped[i];
    if (entry.brand === q || entry.brandBn === q) {
      step1Tier100.push({ med: entry.med, score: 100, isGeneric: false });
      if (step1Tier100.length >= MAX_LIBRARY_SEARCH_RESULTS) break;
      continue;
    }

    if (
      entry.generic === q ||
      entry.genericBn === q ||
      entry.generic.includes(q) ||
      entry.genericBn.includes(q)
    ) {
      step1Tier90.push({ med: entry.med, score: 90, isGeneric: true });
      if (!firstGenericMatch) firstGenericMatch = entry.med;
      continue;
    }

    if (
      entry.brand.startsWith(q) ||
      entry.brandBn.startsWith(q) ||
      entry.brand.includes(q) ||
      entry.brandBn.includes(q) ||
      entry.strength.includes(q) ||
      entry.manufacturer.includes(q) ||
      entry.indication.includes(q) ||
      entry.therapeuticClass.includes(q)
    ) {
      step1Tier85.push({ med: entry.med, score: 85, isGeneric: false });
      continue;
    }

    step1Remaining.push(entry);
  }

  const step1Count = step1Tier100.length + step1Tier90.length + step1Tier85.length;

  // If >= 200 matches already found in Step 1, do not run Step 2 or Step 3
  if (step1Count >= MAX_LIBRARY_SEARCH_RESULTS) {
    const combinedStep1 =
      step1Tier100.length >= MAX_LIBRARY_SEARCH_RESULTS
        ? step1Tier100
        : [...step1Tier100, ...step1Tier90, ...step1Tier85];
    combinedStep1.sort(
      (a, b) => b.score - a.score || a.med.brandName.localeCompare(b.med.brandName)
    );
    return {
      medicines: combinedStep1.slice(0, MAX_LIBRARY_SEARCH_RESULTS).map((s) => s.med),
      firstGenericMatch,
      totalMatchedBeforeCap: combinedStep1.length,
    };
  }

  const matched: ScoredIndexedMatch[] = [...step1Tier100, ...step1Tier90, ...step1Tier85];
  let step2Remaining: IndexedMedicine[] = step1Remaining;

  // Step 2: Phonetic Latin match — only if Step 1 yielded < 30 matches
  const qPhonetic = step1Count < STEP1_PHONETIC_CUTOFF ? toPhoneticLatin(q) : '';
  if (step1Count < STEP1_PHONETIC_CUTOFF && qPhonetic) {
    const nextRemaining: IndexedMedicine[] = [];
    for (let i = 0; i < step1Remaining.length; i++) {
      const entry = step1Remaining[i];
      if (entry.genericPhonetic && entry.genericPhonetic.includes(qPhonetic)) {
        matched.push({ med: entry.med, score: 80, isGeneric: true });
        if (!firstGenericMatch) firstGenericMatch = entry.med;
      } else if (entry.brandPhonetic && entry.brandPhonetic.includes(qPhonetic)) {
        matched.push({ med: entry.med, score: 75, isGeneric: false });
      } else {
        nextRemaining.push(entry);
      }
    }
    step2Remaining = nextRemaining;
  }

  // Step 3: Typo-tolerant Levenshtein match — only if still < 10 matches & query >= 3 chars
  if (matched.length < STEP12_FUZZY_CUTOFF && q.length >= 3 && qPhonetic) {
    const queryTokens = qPhonetic.split(' ').filter(Boolean);
    if (queryTokens.length > 0) {
      for (let i = 0; i < step2Remaining.length; i++) {
        const entry = step2Remaining[i];
        let allMatch = true;
        for (let t = 0; t < queryTokens.length; t++) {
          if (!fuzzyTokenMatchesWords(queryTokens[t], entry.candidateWords)) {
            allMatch = false;
            break;
          }
        }
        if (!allMatch) continue;

        let isGenericFuzzy = false;
        if (entry.genericWords.length > 0) {
          for (let t = 0; t < queryTokens.length; t++) {
            if (fuzzyTokenMatchesWords(queryTokens[t], entry.genericWords)) {
              isGenericFuzzy = true;
              break;
            }
          }
        }

        if (isGenericFuzzy && !firstGenericMatch) {
          firstGenericMatch = entry.med;
        }
        matched.push({
          med: entry.med,
          score: isGenericFuzzy ? 65 : 60,
          isGeneric: isGenericFuzzy,
        });
      }
    }
  }

  matched.sort((a, b) => b.score - a.score || a.med.brandName.localeCompare(b.med.brandName));

  return {
    medicines: matched.slice(0, MAX_LIBRARY_SEARCH_RESULTS).map((s) => s.med),
    firstGenericMatch,
    totalMatchedBeforeCap: matched.length,
  };
}

/**
 * Lightweight fallback search used ONLY while the initial 500-item idle batches
 * are building on a cold load. Zero phonetic/Levenshtein work so main thread never blocks.
 */
export function quickBasicSearchMedicines(
  medicines: GlobalMedicine[],
  filters: LibrarySearchFilters,
  rawQuery: string
): LibrarySearchResult {
  const q = rawQuery.trim().toLowerCase();

  if (!q) {
    const filtered: GlobalMedicine[] = [];
    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i];
      if (matchesFiltersOnMed(med, filters)) {
        filtered.push(med);
      }
    }
    filtered.sort((a, b) => a.brandName.localeCompare(b.brandName));
    return {
      medicines: filtered,
      firstGenericMatch: null,
      totalMatchedBeforeCap: filtered.length,
    };
  }

  const scored: ScoredIndexedMatch[] = [];
  let firstGenericMatch: GlobalMedicine | null = null;

  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    if (!matchesFiltersOnMed(med, filters)) continue;

    const brand = (med.brandName || '').toLowerCase();
    const brandBn = (med.brandNameBn || '').toLowerCase();
    const generic = (med.genericName || '').toLowerCase();
    const genericBn = (med.genericNameBn || '').toLowerCase();

    if (brand === q || brandBn === q) {
      scored.push({ med, score: 100, isGeneric: false });
      if (scored.length >= MAX_LIBRARY_SEARCH_RESULTS) break;
      continue;
    }

    if (generic === q || genericBn === q || generic.includes(q) || genericBn.includes(q)) {
      scored.push({ med, score: 90, isGeneric: true });
      if (!firstGenericMatch) firstGenericMatch = med;
      continue;
    }

    if (
      brand.includes(q) ||
      brandBn.includes(q) ||
      (med.strength || '').toLowerCase().includes(q) ||
      (med.manufacturer || '').toLowerCase().includes(q) ||
      (med.indication || '').toLowerCase().includes(q) ||
      (med.therapeuticClass || '').toLowerCase().includes(q)
    ) {
      scored.push({ med, score: 85, isGeneric: false });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.med.brandName.localeCompare(b.med.brandName));
  return {
    medicines: scored.slice(0, MAX_LIBRARY_SEARCH_RESULTS).map((s) => s.med),
    firstGenericMatch,
    totalMatchedBeforeCap: scored.length,
  };
}
