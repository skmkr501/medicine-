import { supabase } from './client';
import {
  adminActivityFromRow,
  adminActivityToRow,
  AdminActivityRow,
  feedbackFromRow,
  FeedbackRow,
  importBatchFromRow,
  ImportBatchRow,
  importBatchToRow,
  libraryMedicineFromRow,
  LibraryMedicineRow,
  libraryMedicineToRow,
} from './mappers';
import { retryWithBackoff } from './userDataService';
import {
  AdminActivity,
  AdminOverviewStats,
  FeedbackEntry,
  GlobalMedicine,
  ImportBatch,
} from '../types';
import {
  AdminLibraryFilters,
  BulkMedicinePatch,
  matchMedicineBilingualFuzzy,
  normalizeGenericForCompare,
} from '../utils/libraryManagement';
import { generateDuplicateKey, isTestMedicine } from '../utils/medicineImportParser';

export const APP_VERSION = '2026.3.0';

export const LIBRARY_SEARCH_LIMIT = 30;
export const LIBRARY_BROWSE_PAGE_SIZE = 30;
export const ADMIN_LIBRARY_PAGE_SIZE = 50;
export const LIBRARY_ID_BATCH_SIZE = 100;
export const LIBRARY_DUPLICATE_BATCH_SIZE = 200;
export const LIBRARY_DELETE_BATCH_SIZE = 200;
export const LIBRARY_UPSERT_BATCH_SIZE = 500;
export const LIBRARY_MAX_RETRIES = 3;
export const LIBRARY_BASE_RETRY_DELAY_MS = 400;

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeSize = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    out.push(items.slice(i, i + safeSize));
  }
  return out;
}

// ============================================================================
// In-Session Search Cache & Re-Ranking (<= 30 rows from search_library RPC)
// ============================================================================

const searchSessionCache = new Map<string, GlobalMedicine[]>();

export function clearLibrarySearchSessionCache(): void {
  searchSessionCache.clear();
}

function getSearchCacheKey(query: string, includeUnpublished: boolean): string {
  return `${includeUnpublished ? 'all' : 'pub'}:${query.trim().toLowerCase()}`;
}

export function rerankSearchResults(
  items: GlobalMedicine[],
  rawQuery: string
): GlobalMedicine[] {
  const q = rawQuery.trim();
  if (!q || items.length <= 1) return items;

  const scored = items.map((item, idx) => {
    const match = matchMedicineBilingualFuzzy(item, q);
    return {
      item,
      idx,
      score: match.matched ? match.score : 0,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  return scored.map((entry) => entry.item);
}

export interface SearchLibraryRpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown | null }>;
}

export async function searchLibraryMedicines(
  rawQuery: string,
  options: {
    includeUnpublished?: boolean;
    limit?: number;
    client?: SearchLibraryRpcClient;
    bypassCache?: boolean;
  } = {}
): Promise<GlobalMedicine[]> {
  const q = rawQuery.trim();
  if (q.length <= 1) return [];

  const includeUnpublished = Boolean(options.includeUnpublished);
  const lim = Math.min(LIBRARY_SEARCH_LIMIT, Math.max(1, options.limit ?? LIBRARY_SEARCH_LIMIT));
  const cacheKey = getSearchCacheKey(q, includeUnpublished);

  if (!options.bypassCache) {
    const cached = searchSessionCache.get(cacheKey);
    if (cached) return cached;
  }

  const client = options.client ?? (supabase as unknown as SearchLibraryRpcClient);
  const { data, error } = await retryWithBackoff(
    async () => client.rpc('search_library', { q, lim }),
    { maxRetries: 2, baseDelayMs: 300 }
  );

  if (error) {
    throw error;
  }

  const rawRows = Array.isArray(data) ? (data as Array<Partial<LibraryMedicineRow> & { id: string }>) : [];
  let mapped = rawRows
    .filter((r) => r && typeof r.id === 'string')
    .map((r) => libraryMedicineFromRow(r));

  if (!includeUnpublished) {
    mapped = mapped.filter((m) => m.status === 'published' && m.verifiedByAdmin);
  }

  const reranked = rerankSearchResults(mapped, q).slice(0, lim);
  searchSessionCache.set(cacheKey, reranked);
  return reranked;
}

// ============================================================================
// Single & Batched ID Lookups (100/batch)
// ============================================================================

export async function fetchLibraryMedicineById(id: string): Promise<GlobalMedicine | null> {
  const cleanId = id.trim();
  if (!cleanId) return null;

  const { data, error } = await supabase
    .from('library_medicines')
    .select('*')
    .eq('id', cleanId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return libraryMedicineFromRow(data as LibraryMedicineRow);
}

export interface LibraryByIdsClientLike {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[]
      ) => PromiseLike<{ data: unknown[] | null; error: unknown | null }>;
    };
  };
}

export async function fetchLibraryMedicinesByIds(
  ids: string[],
  options: { client?: LibraryByIdsClientLike; includeUnpublished?: boolean } = {}
): Promise<GlobalMedicine[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const client = options.client ?? (supabase as unknown as LibraryByIdsClientLike);
  const batches = chunkItems(uniqueIds, LIBRARY_ID_BATCH_SIZE);
  const collected: GlobalMedicine[] = [];

  for (const batch of batches) {
    const { data, error } = await retryWithBackoff(
      async () => client.from('library_medicines').select('*').in('id', batch),
      { maxRetries: 2, baseDelayMs: 300 }
    );
    if (error) throw error;
    if (Array.isArray(data)) {
      for (const row of data as Array<Partial<LibraryMedicineRow> & { id: string }>) {
        if (row && row.id) {
          const med = libraryMedicineFromRow(row);
          if (options.includeUnpublished || (med.status === 'published' && med.verifiedByAdmin)) {
            collected.push(med);
          }
        }
      }
    }
  }

  const byId = new Map(collected.map((m) => [m.id, m]));
  return uniqueIds.map((id) => byId.get(id)).filter((m): m is GlobalMedicine => Boolean(m));
}

// ============================================================================
// Browse & Filter Queries (MedicineLibrary — Server Paginated 30/page)
// ============================================================================

export type LibraryBrowseStatusFilter = 'all' | 'published' | 'unpublished';

export interface LibraryBrowseParams {
  page: number; // 1-indexed
  pageSize?: number;
  adminStatusFilter?: LibraryBrowseStatusFilter;
  selectedLetter?: string;
  selectedForm?: string;
  selectedManufacturer?: string;
  selectedSource?: string;
  priceFilter?: 'all' | 'has_price' | 'no_price';
  favoriteIdsOnly?: string[]; // when showFavoritesOnly is enabled
}

export async function fetchLibraryBrowsePage(params: LibraryBrowseParams): Promise<{
  items: GlobalMedicine[];
  totalCount: number;
}> {
  const pageSize = Math.max(1, params.pageSize ?? LIBRARY_BROWSE_PAGE_SIZE);
  const safePage = Math.max(1, params.page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  if (Array.isArray(params.favoriteIdsOnly)) {
    if (params.favoriteIdsOnly.length === 0) {
      return { items: [], totalCount: 0 };
    }
  }

  let query = supabase
    .from('library_medicines')
    .select('*', { count: 'exact' });

  const statusFilter = params.adminStatusFilter ?? 'published';
  if (statusFilter === 'published') {
    query = query.eq('status', 'published').eq('verified_by_admin', true);
  } else if (statusFilter === 'unpublished') {
    query = query.or('status.neq.published,verified_by_admin.eq.false');
  }

  if (params.selectedForm && params.selectedForm !== 'all') {
    query = query.eq('dosage_form', params.selectedForm);
  }
  if (params.selectedManufacturer && params.selectedManufacturer !== 'all') {
    query = query.eq('manufacturer', params.selectedManufacturer);
  }
  if (params.selectedSource && params.selectedSource !== 'all') {
    query = query.eq('source', params.selectedSource);
  }
  if (params.priceFilter === 'has_price') {
    query = query.gt('price_per_unit', 0);
  } else if (params.priceFilter === 'no_price') {
    query = query.or('price_per_unit.is.null,price_per_unit.lte.0');
  }

  if (params.selectedLetter && params.selectedLetter !== 'all') {
    if (params.selectedLetter === '#') {
      // Non A-Z leading character (e.g. digits or Bangla)
      query = query.not('brand_name', 'imatch', '^[A-Za-z]');
    } else if (/^[A-Z]$/i.test(params.selectedLetter)) {
      query = query.ilike('brand_name', `${params.selectedLetter}%`);
    }
  }

  if (Array.isArray(params.favoriteIdsOnly)) {
    query = query.in('id', params.favoriteIdsOnly.slice(0, 100));
  }

  query = query.order('brand_name', { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = Array.isArray(data)
    ? (data as LibraryMedicineRow[]).map((r) => libraryMedicineFromRow(r))
    : [];

  return {
    items,
    totalCount: typeof count === 'number' ? count : items.length,
  };
}

export interface LibraryFilterOptionsResult {
  forms: string[];
  manufacturers: string[];
  generics: string[];
  sources: GlobalMedicine['source'][];
}

export async function fetchLibraryFilterOptions(options: {
  includeUnpublished?: boolean;
  includeGenerics?: boolean;
} = {}): Promise<LibraryFilterOptionsResult> {
  const selectCols = options.includeGenerics
    ? 'dosage_form, manufacturer, source, generic_name'
    : 'dosage_form, manufacturer, source';

  let query = supabase.from('library_medicines').select(selectCols).limit(5000);
  if (!options.includeUnpublished) {
    query = query.eq('status', 'published').eq('verified_by_admin', true);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('fetchLibraryFilterOptions error:', error);
    return { forms: [], manufacturers: [], generics: [], sources: [] };
  }

  const forms = new Set<string>();
  const manufacturers = new Set<string>();
  const generics = new Set<string>();
  const sources = new Set<GlobalMedicine['source']>();

  if (Array.isArray(data)) {
    for (const row of data as unknown as Array<Record<string, unknown>>) {
      if (typeof row.dosage_form === 'string' && row.dosage_form.trim()) {
        forms.add(row.dosage_form.trim());
      }
      if (typeof row.manufacturer === 'string' && row.manufacturer.trim()) {
        manufacturers.add(row.manufacturer.trim());
      }
      if (options.includeGenerics && typeof row.generic_name === 'string' && row.generic_name.trim()) {
        generics.add(row.generic_name.trim());
      }
      if (typeof row.source === 'string' && row.source.trim()) {
        sources.add(row.source.trim() as GlobalMedicine['source']);
      }
    }
  }

  return {
    forms: Array.from(forms).sort((a, b) => a.localeCompare(b)),
    manufacturers: Array.from(manufacturers).sort((a, b) => a.localeCompare(b)),
    generics: Array.from(generics).sort((a, b) => a.localeCompare(b)),
    sources: Array.from(sources).sort(),
  };
}

export async function fetchPublishedLibraryCounts(): Promise<{
  total: number;
  published: number;
  draft: number;
}> {
  const [totalRes, pubRes] = await Promise.all([
    supabase.from('library_medicines').select('id', { count: 'exact', head: true }),
    supabase
      .from('library_medicines')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('verified_by_admin', true),
  ]);

  const total = typeof totalRes.count === 'number' ? totalRes.count : 0;
  const published = typeof pubRes.count === 'number' ? pubRes.count : 0;
  return {
    total,
    published,
    draft: Math.max(0, total - published),
  };
}

export async function fetchSameGenericAlternativesFromSupabase(
  targetGenericName: string,
  excludeMedId?: string,
  limit: number = 10
): Promise<GlobalMedicine[]> {
  const normTarget = normalizeGenericForCompare(targetGenericName);
  if (!normTarget) return [];

  const firstToken = normTarget.split(' ')[0] || normTarget;
  const searchToken = firstToken.length >= 3 ? firstToken : normTarget;

  const { data, error } = await supabase
    .from('library_medicines')
    .select('*')
    .eq('status', 'published')
    .eq('verified_by_admin', true)
    .ilike('generic_name', `%${searchToken}%`)
    .order('price_per_unit', { ascending: true, nullsFirst: false })
    .limit(40);

  if (error || !Array.isArray(data)) return [];

  return (data as LibraryMedicineRow[])
    .map((r) => libraryMedicineFromRow(r))
    .filter((m) => {
      if (excludeMedId && m.id === excludeMedId) return false;
      const normM = normalizeGenericForCompare(m.genericName);
      return (
        normM === normTarget ||
        (normTarget.length >= 5 && (normM.includes(normTarget) || normTarget.includes(normM)))
      );
    })
    .slice(0, limit);
}

// ============================================================================
// Admin Library Manager Queries & Mutations
// ============================================================================

export interface AdminLibraryPageQueryOptions {
  filters: AdminLibraryFilters;
  page: number; // 1-indexed
  pageSize?: number;
  duplicateIdsFilter?: string[]; // when qualityFilter === 'duplicates'
  testDataIdsFilter?: string[]; // when qualityFilter === 'test_data'
}

function escapePostgrestIlike(value: string): string {
  return value.replace(/[%_,()]/g, ' ').trim();
}

function buildAdminFilteredLibraryQuery(
  selectCols: string,
  options: {
    countExact?: boolean;
    filters: AdminLibraryFilters;
    duplicateIdsFilter?: string[];
    testDataIdsFilter?: string[];
  }
) {
  let query = supabase
    .from('library_medicines')
    .select(selectCols, options.countExact ? { count: 'exact' } : undefined);

  const { filters } = options;

  const q = escapePostgrestIlike(filters.search || '');
  if (q) {
    query = query.or(
      [
        `brand_name.ilike.%${q}%`,
        `brand_name_bn.ilike.%${q}%`,
        `generic_name.ilike.%${q}%`,
        `generic_name_bn.ilike.%${q}%`,
        `manufacturer.ilike.%${q}%`,
        `strength.ilike.%${q}%`,
        `dar_number.ilike.%${q}%`,
      ].join(',')
    );
  }

  if (filters.manufacturer !== 'all') {
    query = query.eq('manufacturer', filters.manufacturer);
  }
  if (filters.dosageForm !== 'all') {
    query = query.eq('dosage_form', filters.dosageForm);
  }
  if (filters.genericName !== 'all') {
    query = query.eq('generic_name', filters.genericName);
  }

  if (filters.priceStatus === 'has_price') {
    query = query.gt('price_per_unit', 0);
  } else if (filters.priceStatus === 'no_price') {
    query = query.or('price_per_unit.is.null,price_per_unit.lte.0');
  }

  if (filters.qualityFilter === 'missing_generic') {
    query = query.or(
      'generic_name.is.null,generic_name.eq.,generic_name.eq.-,generic_name.ilike.unknown,generic_name.ilike.n/a,generic_name.eq.নেই,generic_name.eq.অজানা'
    );
  } else if (filters.qualityFilter === 'recent') {
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('imported_at', sevenDaysAgoIso);
  } else if (filters.qualityFilter === 'duplicates' && options.duplicateIdsFilter) {
    if (options.duplicateIdsFilter.length === 0) {
      query = query.eq('id', '__never_matches__');
    } else {
      query = query.in('id', options.duplicateIdsFilter.slice(0, 200));
    }
  } else if (filters.qualityFilter === 'test_data' && options.testDataIdsFilter) {
    if (options.testDataIdsFilter.length === 0) {
      query = query.eq('id', '__never_matches__');
    } else {
      query = query.in('id', options.testDataIdsFilter.slice(0, 200));
    }
  }

  if (filters.sortBy === 'company') {
    query = query.order('manufacturer', { ascending: true }).order('brand_name', { ascending: true });
  } else if (filters.sortBy === 'recent') {
    query = query.order('imported_at', { ascending: false }).order('brand_name', { ascending: true });
  } else {
    query = query.order('brand_name', { ascending: true });
  }

  return query;
}

export async function fetchAdminLibraryPage(params: AdminLibraryPageQueryOptions): Promise<{
  items: GlobalMedicine[];
  totalCount: number;
}> {
  if (
    params.filters.qualityFilter === 'duplicates' &&
    params.duplicateIdsFilter &&
    params.duplicateIdsFilter.length === 0
  ) {
    return { items: [], totalCount: 0 };
  }
  if (
    params.filters.qualityFilter === 'test_data' &&
    params.testDataIdsFilter &&
    params.testDataIdsFilter.length === 0
  ) {
    return { items: [], totalCount: 0 };
  }

  const pageSize = Math.max(1, params.pageSize ?? ADMIN_LIBRARY_PAGE_SIZE);
  const safePage = Math.max(1, params.page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = buildAdminFilteredLibraryQuery('*', {
    countExact: true,
    filters: params.filters,
    duplicateIdsFilter: params.duplicateIdsFilter,
    testDataIdsFilter: params.testDataIdsFilter,
  }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = Array.isArray(data)
    ? (data as unknown as LibraryMedicineRow[]).map((r) => libraryMedicineFromRow(r))
    : [];

  return {
    items,
    totalCount: typeof count === 'number' ? count : items.length,
  };
}

export async function fetchAdminFilteredLibraryIds(params: {
  filters: AdminLibraryFilters;
  duplicateIdsFilter?: string[];
  testDataIdsFilter?: string[];
}): Promise<string[]> {
  const PAGE = 1000;
  const ids: string[] = [];
  let offset = 0;

  while (true) {
    const query = buildAdminFilteredLibraryQuery('id', {
      countExact: false,
      filters: params.filters,
      duplicateIdsFilter: params.duplicateIdsFilter,
      testDataIdsFilter: params.testDataIdsFilter,
    }).range(offset, offset + PAGE - 1);

    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as unknown as Array<{ id: string }>) : [];
    for (const row of rows) {
      if (row.id) ids.push(row.id);
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return ids;
}

export async function fetchAdminFilteredMedicines(params: {
  filters: AdminLibraryFilters;
  duplicateIdsFilter?: string[];
  testDataIdsFilter?: string[];
  maxRows?: number;
}): Promise<GlobalMedicine[]> {
  const PAGE = 500;
  const cap = params.maxRows ?? 5000;
  const items: GlobalMedicine[] = [];
  let offset = 0;

  while (items.length < cap) {
    const query = buildAdminFilteredLibraryQuery('*', {
      countExact: false,
      filters: params.filters,
      duplicateIdsFilter: params.duplicateIdsFilter,
      testDataIdsFilter: params.testDataIdsFilter,
    }).range(offset, offset + PAGE - 1);

    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as unknown as LibraryMedicineRow[]) : [];
    for (const row of rows) {
      items.push(libraryMedicineFromRow(row));
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return items.slice(0, cap);
}

export async function fetchLibraryQualityCounts(): Promise<{
  totalCount: number;
  missingPriceCount: number;
  missingGenericCount: number;
}> {
  const [totalRes, noPriceRes, noGenRes] = await Promise.all([
    supabase.from('library_medicines').select('id', { count: 'exact', head: true }),
    supabase
      .from('library_medicines')
      .select('id', { count: 'exact', head: true })
      .or('price_per_unit.is.null,price_per_unit.lte.0'),
    supabase
      .from('library_medicines')
      .select('id', { count: 'exact', head: true })
      .or(
        'generic_name.is.null,generic_name.eq.,generic_name.eq.-,generic_name.ilike.unknown,generic_name.ilike.n/a,generic_name.eq.নেই,generic_name.eq.অজানা'
      ),
  ]);

  return {
    totalCount: typeof totalRes.count === 'number' ? totalRes.count : 0,
    missingPriceCount: typeof noPriceRes.count === 'number' ? noPriceRes.count : 0,
    missingGenericCount: typeof noGenRes.count === 'number' ? noGenRes.count : 0,
  };
}

export async function fetchAllMedicinesForAdminAudit(limitRows = 5000): Promise<GlobalMedicine[]> {
  const PAGE = 1000;
  const collected: GlobalMedicine[] = [];
  let offset = 0;

  while (collected.length < limitRows) {
    const { data, error } = await supabase
      .from('library_medicines')
      .select('*')
      .order('brand_name', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    const rows = Array.isArray(data) ? (data as LibraryMedicineRow[]) : [];
    for (const r of rows) {
      collected.push(libraryMedicineFromRow(r));
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return collected;
}

export async function fetchUnpublishedDraftsFromSupabase(
  limitRows = 200
): Promise<GlobalMedicine[]> {
  const { data, error } = await supabase
    .from('library_medicines')
    .select('*')
    .or('status.neq.published,verified_by_admin.eq.false')
    .order('imported_at', { ascending: false })
    .limit(limitRows);

  if (error) throw error;
  return Array.isArray(data)
    ? (data as LibraryMedicineRow[]).map((r) => libraryMedicineFromRow(r))
    : [];
}

export async function fetchTestMedicinesFromSupabase(
  limitRows = 200
): Promise<GlobalMedicine[]> {
  const { data, error } = await supabase
    .from('library_medicines')
    .select('*')
    .or(
      'brand_name.ilike.%test%,brand_name.ilike.%demo%,brand_name.ilike.%sample%,brand_name.ilike.%dummy%,source.eq.MANUAL_ADMIN'
    )
    .limit(limitRows);

  if (error) throw error;
  return Array.isArray(data)
    ? (data as LibraryMedicineRow[])
        .map((r) => libraryMedicineFromRow(r))
        .filter((m) => isTestMedicine(m))
    : [];
}

// ============================================================================
// Import Duplicate Check (200-key batches), Batched Upsert (500), Delete (200)
// ============================================================================

export interface DuplicateKeyCheckClientLike {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[]
      ) => PromiseLike<{ data: unknown[] | null; error: unknown | null }>;
    };
  };
}

export async function checkDuplicateKeysInSupabase(
  duplicateKeys: string[],
  options: { client?: DuplicateKeyCheckClientLike } = {}
): Promise<GlobalMedicine[]> {
  const uniqueKeys = Array.from(
    new Set(duplicateKeys.map((k) => k.trim()).filter(Boolean))
  );
  if (uniqueKeys.length === 0) return [];

  const client = options.client ?? (supabase as unknown as DuplicateKeyCheckClientLike);
  const batches = chunkItems(uniqueKeys, LIBRARY_DUPLICATE_BATCH_SIZE);
  const existing: GlobalMedicine[] = [];

  for (const batch of batches) {
    const { data, error } = await retryWithBackoff(
      async () => client.from('library_medicines').select('*').in('duplicate_key', batch),
      { maxRetries: 2, baseDelayMs: 350 }
    );
    if (error) throw error;
    if (Array.isArray(data)) {
      for (const row of data as Array<Partial<LibraryMedicineRow> & { id: string }>) {
        if (row && row.id) {
          existing.push(libraryMedicineFromRow(row));
        }
      }
    }
  }

  return existing;
}

export interface LibraryUpsertClientLike {
  from: (table: string) => {
    upsert: (
      rows: LibraryMedicineRow[],
      options?: { onConflict?: string }
    ) => PromiseLike<{ error: unknown | null }>;
  };
}

export async function upsertLibraryMedicinesInBatches(
  medicines: GlobalMedicine[],
  options: {
    client?: LibraryUpsertClientLike;
    maxRetries?: number;
    baseDelayMs?: number;
  } = {}
): Promise<number> {
  if (!Array.isArray(medicines) || medicines.length === 0) return 0;

  const client = options.client ?? (supabase as unknown as LibraryUpsertClientLike);
  const rows = medicines.map((m) => libraryMedicineToRow(m));
  const batches = chunkItems(rows, LIBRARY_UPSERT_BATCH_SIZE);

  for (const batch of batches) {
    await retryWithBackoff(
      async () => {
        const { error } = await client
          .from('library_medicines')
          .upsert(batch, { onConflict: 'id' });
        if (error) throw error;
      },
      {
        maxRetries: options.maxRetries ?? LIBRARY_MAX_RETRIES,
        baseDelayMs: options.baseDelayMs ?? LIBRARY_BASE_RETRY_DELAY_MS,
      }
    );
  }

  clearLibrarySearchSessionCache();
  return rows.length;
}

export async function bulkPatchLibraryMedicinesInSupabase(
  ids: string[],
  patch: BulkMedicinePatch
): Promise<number> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const currentItems = await fetchLibraryMedicinesByIds(uniqueIds, { includeUnpublished: true });
  if (currentItems.length === 0) return 0;

  const cleanMfg = patch.manufacturer?.trim();
  const cleanForm = patch.dosageForm?.trim();
  const cleanUnit = patch.priceUnit?.trim();
  const hasPrice =
    typeof patch.pricePerUnit === 'number' &&
    !Number.isNaN(patch.pricePerUnit) &&
    patch.pricePerUnit >= 0;

  const updatedItems: GlobalMedicine[] = currentItems.map((med) => {
    const nextMfg = cleanMfg ? cleanMfg.substring(0, 128) : med.manufacturer;
    const nextForm = cleanForm ? cleanForm.substring(0, 64) : med.dosageForm;
    const nextPrice = hasPrice ? patch.pricePerUnit : med.pricePerUnit;
    const nextUnit =
      cleanUnit !== undefined && cleanUnit !== '' ? cleanUnit.substring(0, 32) : med.priceUnit;

    return {
      ...med,
      manufacturer: nextMfg,
      dosageForm: nextForm,
      pricePerUnit: nextPrice,
      priceUnit: nextUnit,
      duplicateKey: generateDuplicateKey(
        med.brandName,
        med.genericName,
        med.strength,
        nextForm,
        nextMfg
      ),
    };
  });

  return upsertLibraryMedicinesInBatches(updatedItems);
}

export interface LibraryDeleteClientLike {
  from: (table: string) => {
    delete: () => {
      in: (
        col: string,
        ids: string[]
      ) => PromiseLike<{ error: unknown | null }>;
    };
  };
}

export async function deleteLibraryMedicinesInBatches(
  ids: string[],
  options: {
    client?: LibraryDeleteClientLike;
    maxRetries?: number;
    baseDelayMs?: number;
  } = {}
): Promise<number> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const client = options.client ?? (supabase as unknown as LibraryDeleteClientLike);
  const batches = chunkItems(uniqueIds, LIBRARY_DELETE_BATCH_SIZE);

  for (const batch of batches) {
    await retryWithBackoff(
      async () => {
        const { error } = await client.from('library_medicines').delete().in('id', batch);
        if (error) throw error;
      },
      {
        maxRetries: options.maxRetries ?? LIBRARY_MAX_RETRIES,
        baseDelayMs: options.baseDelayMs ?? LIBRARY_BASE_RETRY_DELAY_MS,
      }
    );
  }

  clearLibrarySearchSessionCache();
  return uniqueIds.length;
}

// ============================================================================
// Import Batches, Admin Activity (singular), Admin Overview Stats, Feedback
// ============================================================================

export async function fetchImportBatchesFromSupabase(): Promise<ImportBatch[]> {
  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as ImportBatchRow[]).map((r) => importBatchFromRow(r))
      : [];
  } catch (err) {
    console.warn('Could not fetch import_batches from Supabase:', err);
    return [];
  }
}

export async function createImportBatchInSupabase(batch: ImportBatch): Promise<void> {
  const row: ImportBatchRow = importBatchToRow(batch);
  await retryWithBackoff(
    async () => {
      const { error } = await supabase
        .from('import_batches')
        .upsert([row], { onConflict: 'id' });
      if (error) throw error;
    },
    { maxRetries: LIBRARY_MAX_RETRIES, baseDelayMs: LIBRARY_BASE_RETRY_DELAY_MS }
  );
}

export async function recordAdminActivityInSupabase(
  activity: Omit<AdminActivity, 'id' | 'timestamp' | 'adminEmail'> & {
    id?: string;
    timestamp?: string;
    adminEmail?: string;
  }
): Promise<void> {
  try {
    const act: AdminActivity = {
      ...activity,
      id:
        activity.id ||
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: activity.timestamp || new Date().toISOString(),
      adminEmail: activity.adminEmail || '',
    };
    const row: AdminActivityRow = adminActivityToRow(act);
    const { error } = await supabase
      .from('admin_activity')
      .upsert([row], { onConflict: 'id' });
    if (error) {
      console.warn('recordAdminActivityInSupabase error:', error);
    }
  } catch (err) {
    console.warn('Could not record admin_activity in Supabase:', err);
  }
}

export async function fetchAdminActivitiesFromSupabase(
  limitRows: number = 50
): Promise<AdminActivity[]> {
  try {
    const { data, error } = await supabase
      .from('admin_activity')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limitRows);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as AdminActivityRow[]).map((r) => adminActivityFromRow(r))
      : [];
  } catch (err) {
    console.warn('Could not fetch admin_activity from Supabase:', err);
    return [];
  }
}

export async function fetchAdminOverviewStatsFromSupabase(): Promise<AdminOverviewStats> {
  const { data, error } = await supabase.rpc('admin_overview_stats');
  if (error) {
    throw error;
  }

  const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    totalUsers: Number(raw?.totalUsers ?? raw?.total_users ?? 0) || 0,
    totalPatientProfiles:
      Number(raw?.totalPatientProfiles ?? raw?.total_patient_profiles ?? 0) || 0,
    totalPublishedMedicines:
      Number(raw?.totalPublishedMedicines ?? raw?.total_published_medicines ?? 0) || 0,
    totalUnpublishedMedicines:
      Number(raw?.totalUnpublishedMedicines ?? raw?.total_unpublished_medicines ?? 0) || 0,
    totalImportBatches:
      Number(raw?.totalImportBatches ?? raw?.total_import_batches ?? 0) || 0,
    pendingVerificationCount:
      Number(raw?.pendingVerificationCount ?? raw?.pending_verification_count ?? 0) || 0,
    feedbackCount: Number(raw?.feedbackCount ?? raw?.feedback_count ?? 0) || 0,
  };
}

export async function submitFeedbackToSupabase(
  message: string,
  appVersion: string = APP_VERSION
): Promise<void> {
  const cleanMessage = message.trim();
  if (!cleanMessage) {
    throw new Error('মতামত খালি রাখা যাবে না।');
  }

  await retryWithBackoff(
    async () => {
      const { error } = await supabase.from('feedback').insert([
        {
          message: cleanMessage,
          app_version: appVersion || APP_VERSION,
        },
      ]);
      if (error) throw error;
    },
    { maxRetries: 2, baseDelayMs: 350 }
  );
}

export async function fetchFeedbackFromSupabase(
  limitRows: number = 100
): Promise<FeedbackEntry[]> {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitRows);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as FeedbackRow[]).map((r) => feedbackFromRow(r))
      : [];
  } catch (err) {
    console.warn('Could not fetch feedback from Supabase:', err);
    return [];
  }
}

export async function deleteFeedbackFromSupabase(id: string): Promise<void> {
  const cleanId = id.trim();
  if (!cleanId) return;

  await retryWithBackoff(
    async () => {
      const { error } = await supabase.from('feedback').delete().eq('id', cleanId);
      if (error) throw error;
    },
    { maxRetries: 2, baseDelayMs: 300 }
  );
}
