import { GlobalMedicine } from '../types';
import { generateDuplicateKey, isTestMedicine } from './medicineImportParser';

// ---------------------------------------------------------------------------
// 1. Bilingual Bangla <-> English Phonetic & Fuzzy Search
// ---------------------------------------------------------------------------

const BENGALI_CHAR_TO_LATIN: Record<string, string> = {
  // Independent vowels
  'অ': 'o',
  'আ': 'a',
  'ই': 'i',
  'ঈ': 'i',
  'উ': 'u',
  'ঊ': 'u',
  'ঋ': 'ri',
  'এ': 'e',
  'ঐ': 'oi',
  'ও': 'o',
  'ঔ': 'ou',
  // Vowel signs (kars)
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
  // Consonants
  'ক': 'k',
  'খ': 'kh',
  'গ': 'g',
  'ঘ': 'gh',
  'ঙ': 'ng',
  'চ': 'ch',
  'ছ': 'ch',
  'জ': 'j',
  'ঝ': 'jh',
  'ঞ': 'n',
  'ট': 't',
  'ঠ': 'th',
  'ড': 'd',
  'ঢ': 'dh',
  'ণ': 'n',
  'ত': 't',
  'থ': 'th',
  'দ': 'd',
  'ধ': 'dh',
  'ন': 'n',
  'প': 'p',
  'ফ': 'f',
  'ব': 'b',
  'ভ': 'v',
  'ম': 'm',
  'য': 'j',
  'র': 'r',
  'ল': 'l',
  'শ': 's',
  'ষ': 's',
  'স': 's',
  'হ': 'h',
  'ড়': 'r',
  'ঢ়': 'r',
  'য়': 'y',
  'ৎ': 't',
  'ং': 'ng',
  'ঃ': 'h',
  'ঁ': '',
  '্': '',
  // Bengali digits
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BENGALI_MEDICINE_SYNONYMS: Array<[RegExp, string]> = [
  [/প্যারাসিটামল|পেরাসিটামল/g, 'paracetamol'],
  [/নাপা/g, 'napa'],
  [/এইস|এস/g, 'ace'],
  [/সেক্লো/g, 'seclo'],
  [/সার্জেল/g, 'sergel'],
  [/ম্যাক্সপ্রো/g, 'maxpro'],
  [/অমিপ্রাজল|ওমিপ্রাজল/g, 'omeprazole'],
  [/ইসোমিপ্রাজল/g, 'esomeprazole'],
  [/প্যান্টোপ্রাজল|প্যান্টোনিক্স/g, 'pantoprazole'],
  [/মেট্রোনিডাজল|ফ্ল্যাজিল/g, 'metronidazole'],
  [/অ্যাজিথ্রোমাইসিন|এজিথ্রোমাইসিন/g, 'azithromycin'],
  [/অ্যামোক্সিসিলিন|এমোক্সিসিলিন/g, 'amoxicillin'],
  [/সিপ্রোফ্লক্সাসিন/g, 'ciprofloxacin'],
  [/মন্টেলুকাস্ট|মোনাস/g, 'montelukast'],
  [/ফেস্কো|ফেক্সোফেনাডিন|ফেক্সো/g, 'fexofenadine'],
  [/সেটিরিজিন|অ্যালাট্রল|এলাট্রল/g, 'cetirizine'],
  [/মেটফরমিন|কমেট/g, 'metformin'],
  [/লোসার্টান/g, 'losartan'],
  [/অ্যাম্লোডিপিন|এমলোডিপিন/g, 'amlodipine'],
  [/স্কয়ার/g, 'square'],
  [/বেক্সিমকো/g, 'beximco'],
  [/ইনসেপ্টা/g, 'incepta'],
  [/অপসোনিন/g, 'opsonin'],
  [/রেনাটা/g, 'renata'],
  [/এসকেএফ/g, 'eskayef'],
  [/ট্যাবলেট/g, 'tablet'],
  [/ক্যাপসুল/g, 'capsule'],
  [/সিরাপ/g, 'syrup'],
  [/ইনজেকশন/g, 'injection'],
  [/ড্রপ/g, 'drop'],
  [/ইনহেলার/g, 'inhaler'],
  [/মলম|ক্রিম/g, 'ointment cream'],
];

/**
 * Transliterates Bengali text and normalizes English/Bengali medicine names
 * into a simplified phonetic Latin form for cross-script & typo-tolerant matching.
 */
export function toPhoneticLatin(raw: string): string {
  if (!raw) return '';
  let text = raw.toLowerCase().trim();

  for (const [pattern, replacement] of BENGALI_MEDICINE_SYNONYMS) {
    text = text.replace(pattern, ` ${replacement} `);
  }

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in BENGALI_CHAR_TO_LATIN) {
      out += BENGALI_CHAR_TO_LATIN[ch];
    } else {
      out += ch;
    }
  }

  // Normalize phonetic equivalents
  return out
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'v')
    .replace(/w/g, 'v')
    .replace(/c([eiy])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/z/g, 'j')
    .replace(/ee|ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function fuzzyTokenMatchesText(queryToken: string, candidateWords: string[]): boolean {
  if (!queryToken) return true;
  if (candidateWords.some((w) => w.includes(queryToken))) return true;
  if (queryToken.length < 4) return false;

  const maxEdits = queryToken.length >= 7 ? 2 : 1;
  for (const word of candidateWords) {
    if (Math.abs(word.length - queryToken.length) <= maxEdits) {
      if (levenshteinDistance(queryToken, word) <= maxEdits) {
        return true;
      }
    } else if (word.length > queryToken.length + 1) {
      const prefix = word.slice(0, queryToken.length);
      if (levenshteinDistance(queryToken, prefix) <= 1) {
        return true;
      }
    }
  }
  return false;
}

export interface MedicineSearchMatchResult {
  matched: boolean;
  matchType: 'exact' | 'generic' | 'fuzzy' | 'none';
  score: number;
}

export function matchMedicineBilingualFuzzy(
  med: GlobalMedicine,
  rawQuery: string
): MedicineSearchMatchResult {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { matched: true, matchType: 'exact', score: 1 };

  const brand = (med.brandName || '').toLowerCase();
  const brandBn = (med.brandNameBn || '').toLowerCase();
  const generic = (med.genericName || '').toLowerCase();
  const genericBn = (med.genericNameBn || '').toLowerCase();
  const strength = (med.strength || '').toLowerCase();
  const mfg = (med.manufacturer || '').toLowerCase();
  const indication = (med.indication || '').toLowerCase();
  const therapeutic = (med.therapeuticClass || '').toLowerCase();

  if (brand === q || brandBn === q) {
    return { matched: true, matchType: 'exact', score: 100 };
  }
  if (generic === q || genericBn === q || generic.includes(q) || genericBn.includes(q)) {
    return { matched: true, matchType: 'generic', score: 90 };
  }
  if (
    brand.includes(q) ||
    brandBn.includes(q) ||
    strength.includes(q) ||
    mfg.includes(q) ||
    indication.includes(q) ||
    therapeutic.includes(q)
  ) {
    return { matched: true, matchType: 'exact', score: 85 };
  }

  // Phonetic bilingual + typo-tolerant token match
  const qPhonetic = toPhoneticLatin(q);
  if (!qPhonetic) return { matched: false, matchType: 'none', score: 0 };

  const genericPhonetic = toPhoneticLatin(`${med.genericName || ''} ${med.genericNameBn || ''}`);
  if (genericPhonetic && genericPhonetic.includes(qPhonetic)) {
    return { matched: true, matchType: 'generic', score: 80 };
  }

  const brandPhonetic = toPhoneticLatin(`${med.brandName || ''} ${med.brandNameBn || ''}`);
  if (brandPhonetic && brandPhonetic.includes(qPhonetic)) {
    return { matched: true, matchType: 'fuzzy', score: 75 };
  }

  const combinedPhonetic = toPhoneticLatin(
    `${med.brandName} ${med.brandNameBn || ''} ${med.genericName} ${med.genericNameBn || ''} ${med.strength} ${med.manufacturer} ${med.dosageForm} ${med.indication || ''}`
  );
  const candidateWords = combinedPhonetic.split(' ').filter(Boolean);
  const queryTokens = qPhonetic.split(' ').filter(Boolean);

  if (queryTokens.length > 0 && queryTokens.every((tok) => fuzzyTokenMatchesText(tok, candidateWords))) {
    const genericWords = genericPhonetic.split(' ').filter(Boolean);
    const isGenericFuzzy =
      genericWords.length > 0 &&
      queryTokens.some((tok) => fuzzyTokenMatchesText(tok, genericWords));
    return {
      matched: true,
      matchType: isGenericFuzzy ? 'generic' : 'fuzzy',
      score: isGenericFuzzy ? 65 : 60,
    };
  }

  return { matched: false, matchType: 'none', score: 0 };
}

/**
 * Finds other published brands sharing the same generic active ingredient.
 */
export function findSameGenericAlternatives(
  medicines: GlobalMedicine[],
  targetGenericName: string,
  excludeMedId?: string,
  limit: number = 12
): GlobalMedicine[] {
  const normTarget = normalizeGenericForCompare(targetGenericName);
  if (!normTarget) return [];

  return medicines
    .filter((m) => {
      if (m.status !== 'published') return false;
      if (excludeMedId && m.id === excludeMedId) return false;
      const normM = normalizeGenericForCompare(m.genericName);
      return normM === normTarget || (normTarget.length >= 5 && (normM.includes(normTarget) || normTarget.includes(normM)));
    })
    .sort((a, b) => {
      const pa = a.pricePerUnit ?? Number.POSITIVE_INFINITY;
      const pb = b.pricePerUnit ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.brandName.localeCompare(b.brandName);
    })
    .slice(0, limit);
}

export function normalizeGenericForCompare(genericName?: string): string {
  if (!genericName) return '';
  return genericName
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\p{L}+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 2. Duplicate Finder & Data Quality Report (Admin)
// ---------------------------------------------------------------------------

export function normalizeAdminPart(val?: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Normalized grouping key for duplicate detection: brandName + strength + manufacturer
 */
export function normalizeDuplicateSignature(med: Partial<GlobalMedicine>): string {
  return [
    normalizeAdminPart(med.brandName),
    normalizeAdminPart(med.strength),
    normalizeAdminPart(med.manufacturer),
  ].join('|');
}

export interface DuplicateGroup {
  signature: string;
  brandName: string;
  strength: string;
  manufacturer: string;
  primaryId: string;
  items: GlobalMedicine[];
}

function pickPrimaryMedicine(items: GlobalMedicine[]): GlobalMedicine {
  const sorted = [...items].sort((a, b) => {
    const scoreA =
      (a.status === 'published' ? 100 : 0) +
      (a.verifiedByAdmin ? 50 : 0) +
      (typeof a.pricePerUnit === 'number' && a.pricePerUnit > 0 ? 20 : 0) +
      (a.genericName && a.genericName.trim() !== '-' ? 10 : 0) +
      (a.darNumber ? 5 : 0);
    const scoreB =
      (b.status === 'published' ? 100 : 0) +
      (b.verifiedByAdmin ? 50 : 0) +
      (typeof b.pricePerUnit === 'number' && b.pricePerUnit > 0 ? 20 : 0) +
      (b.genericName && b.genericName.trim() !== '-' ? 10 : 0) +
      (b.darNumber ? 5 : 0);

    if (scoreB !== scoreA) return scoreB - scoreA;
    return (a.importedAt || '').localeCompare(b.importedAt || '');
  });
  return sorted[0];
}

export function findSuspectedDuplicateGroups(medicines: GlobalMedicine[]): DuplicateGroup[] {
  const map = new Map<string, GlobalMedicine[]>();
  for (const med of medicines) {
    const sig = normalizeDuplicateSignature(med);
    if (!sig || sig === '||') continue;
    const list = map.get(sig);
    if (list) {
      list.push(med);
    } else {
      map.set(sig, [med]);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [signature, items] of map.entries()) {
    if (items.length >= 2) {
      const primary = pickPrimaryMedicine(items);
      groups.push({
        signature,
        brandName: primary.brandName,
        strength: primary.strength,
        manufacturer: primary.manufacturer,
        primaryId: primary.id,
        items,
      });
    }
  }

  return groups.sort((a, b) => b.items.length - a.items.length || a.brandName.localeCompare(b.brandName));
}

export function pickDuplicateIdsKeepingOne(groups: DuplicateGroup[]): string[] {
  const ids: string[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.id !== group.primaryId) {
        ids.push(item.id);
      }
    }
  }
  return ids;
}

export function isMissingGeneric(med: Partial<GlobalMedicine>): boolean {
  const g = (med.genericName || '').trim().toLowerCase();
  return !g || g === '-' || g === 'unknown' || g === 'n/a' || g === 'নেই' || g === 'অজানা';
}

export function isMissingPrice(med: Partial<GlobalMedicine>): boolean {
  return typeof med.pricePerUnit !== 'number' || Number.isNaN(med.pricePerUnit) || med.pricePerUnit <= 0;
}

export interface LibraryQualityReport {
  totalCount: number;
  missingPriceCount: number;
  missingGenericCount: number;
  suspectedDuplicateGroupsCount: number;
  suspectedDuplicateItemsCount: number;
  suspectedDuplicateExtraCount: number;
  suspectedDuplicateIdSet: Set<string>;
  testDataCount: number;
}

export function computeLibraryQualityReport(medicines: GlobalMedicine[]): LibraryQualityReport {
  let missingPriceCount = 0;
  let missingGenericCount = 0;
  let testDataCount = 0;

  for (const med of medicines) {
    if (isMissingPrice(med)) missingPriceCount++;
    if (isMissingGeneric(med)) missingGenericCount++;
    if (isTestMedicine(med)) testDataCount++;
  }

  const groups = findSuspectedDuplicateGroups(medicines);
  const suspectedDuplicateIdSet = new Set<string>();
  let suspectedDuplicateExtraCount = 0;

  for (const g of groups) {
    g.items.forEach((it) => suspectedDuplicateIdSet.add(it.id));
    suspectedDuplicateExtraCount += g.items.length - 1;
  }

  return {
    totalCount: medicines.length,
    missingPriceCount,
    missingGenericCount,
    suspectedDuplicateGroupsCount: groups.length,
    suspectedDuplicateItemsCount: suspectedDuplicateIdSet.size,
    suspectedDuplicateExtraCount,
    suspectedDuplicateIdSet,
    testDataCount,
  };
}

// ---------------------------------------------------------------------------
// 3. Admin Multi-Filter, Sorting & Active Chips
// ---------------------------------------------------------------------------

export type AdminPriceFilter = 'all' | 'has_price' | 'no_price';
export type AdminQualityFilter = 'all' | 'missing_generic' | 'test_data' | 'duplicates' | 'recent';
export type AdminSortBy = 'name' | 'company' | 'recent';

export interface AdminLibraryFilters {
  search: string;
  manufacturer: string; // 'all' or manufacturer name
  dosageForm: string; // 'all' or dosageForm
  genericName: string; // 'all' or genericName
  priceStatus: AdminPriceFilter;
  qualityFilter: AdminQualityFilter;
  sortBy: AdminSortBy;
}

export const DEFAULT_ADMIN_FILTERS: AdminLibraryFilters = {
  search: '',
  manufacturer: 'all',
  dosageForm: 'all',
  genericName: 'all',
  priceStatus: 'all',
  qualityFilter: 'all',
  sortBy: 'name',
};

export function isRecentlyAddedMedicine(
  med: Partial<GlobalMedicine>,
  nowMs: number = Date.now(),
  daysWindow: number = 7
): boolean {
  if (!med.importedAt) return false;
  const ts = Date.parse(med.importedAt);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= daysWindow * 24 * 60 * 60 * 1000;
}

export function filterAndSortAdminMedicines(
  medicines: GlobalMedicine[],
  filters: AdminLibraryFilters,
  duplicateIdSet?: Set<string>,
  nowMs: number = Date.now()
): GlobalMedicine[] {
  const dupSet = duplicateIdSet ?? computeLibraryQualityReport(medicines).suspectedDuplicateIdSet;
  const q = filters.search.trim().toLowerCase();

  const filtered = medicines.filter((med) => {
    if (q) {
      const hit =
        med.brandName.toLowerCase().includes(q) ||
        (med.brandNameBn && med.brandNameBn.toLowerCase().includes(q)) ||
        med.genericName.toLowerCase().includes(q) ||
        (med.genericNameBn && med.genericNameBn.toLowerCase().includes(q)) ||
        med.manufacturer.toLowerCase().includes(q) ||
        med.strength.toLowerCase().includes(q) ||
        (med.darNumber && med.darNumber.toLowerCase().includes(q));
      if (!hit) return false;
    }

    if (filters.manufacturer !== 'all' && med.manufacturer !== filters.manufacturer) {
      return false;
    }
    if (filters.dosageForm !== 'all' && med.dosageForm !== filters.dosageForm) {
      return false;
    }
    if (filters.genericName !== 'all' && med.genericName !== filters.genericName) {
      return false;
    }

    if (filters.priceStatus === 'has_price' && isMissingPrice(med)) {
      return false;
    }
    if (filters.priceStatus === 'no_price' && !isMissingPrice(med)) {
      return false;
    }

    if (filters.qualityFilter === 'missing_generic' && !isMissingGeneric(med)) {
      return false;
    }
    if (filters.qualityFilter === 'test_data' && !isTestMedicine(med)) {
      return false;
    }
    if (filters.qualityFilter === 'duplicates' && !dupSet.has(med.id)) {
      return false;
    }
    if (filters.qualityFilter === 'recent' && !isRecentlyAddedMedicine(med, nowMs)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];
  if (filters.sortBy === 'company') {
    sorted.sort(
      (a, b) =>
        (a.manufacturer || '').localeCompare(b.manufacturer || '') ||
        (a.brandName || '').localeCompare(b.brandName || '')
    );
  } else if (filters.sortBy === 'recent') {
    sorted.sort((a, b) => {
      const ta = Date.parse(a.importedAt || '') || 0;
      const tb = Date.parse(b.importedAt || '') || 0;
      if (tb !== ta) return tb - ta;
      return (a.brandName || '').localeCompare(b.brandName || '');
    });
  } else {
    sorted.sort((a, b) => (a.brandName || '').localeCompare(b.brandName || ''));
  }

  return sorted;
}

export interface ActiveFilterChip {
  key: keyof AdminLibraryFilters;
  label: string;
}

export function getActiveAdminFilterChips(filters: AdminLibraryFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.search.trim()) {
    chips.push({ key: 'search', label: `অনুসন্ধান: "${filters.search.trim()}"` });
  }
  if (filters.manufacturer !== 'all') {
    chips.push({ key: 'manufacturer', label: `কোম্পানি: ${filters.manufacturer}` });
  }
  if (filters.dosageForm !== 'all') {
    chips.push({ key: 'dosageForm', label: `ধরন: ${filters.dosageForm}` });
  }
  if (filters.genericName !== 'all') {
    chips.push({ key: 'genericName', label: `জেনেরিক: ${filters.genericName}` });
  }
  if (filters.priceStatus === 'has_price') {
    chips.push({ key: 'priceStatus', label: 'দাম আছে' });
  } else if (filters.priceStatus === 'no_price') {
    chips.push({ key: 'priceStatus', label: 'দাম নেই' });
  }
  if (filters.qualityFilter === 'missing_generic') {
    chips.push({ key: 'qualityFilter', label: 'জেনেরিক নেই' });
  } else if (filters.qualityFilter === 'test_data') {
    chips.push({ key: 'qualityFilter', label: 'টেস্ট ডেটা' });
  } else if (filters.qualityFilter === 'duplicates') {
    chips.push({ key: 'qualityFilter', label: 'সম্ভাব্য ডুপ্লিকেট' });
  } else if (filters.qualityFilter === 'recent') {
    chips.push({ key: 'qualityFilter', label: 'সাম্প্রতিক যোগ করা (৭ দিন)' });
  }
  return chips;
}

// ---------------------------------------------------------------------------
// 4. Bulk Edit & Undo Restore Helpers
// ---------------------------------------------------------------------------

export interface BulkMedicinePatch {
  manufacturer?: string;
  dosageForm?: string;
  pricePerUnit?: number;
  priceUnit?: string;
}

export function applyBulkMedicinePatch(
  medicines: GlobalMedicine[],
  targetIds: Set<string>,
  patch: BulkMedicinePatch
): GlobalMedicine[] {
  const cleanMfg = patch.manufacturer?.trim();
  const cleanForm = patch.dosageForm?.trim();
  const cleanUnit = patch.priceUnit?.trim();
  const hasPrice =
    typeof patch.pricePerUnit === 'number' && !Number.isNaN(patch.pricePerUnit) && patch.pricePerUnit >= 0;

  return medicines.map((med) => {
    if (!targetIds.has(med.id)) return med;

    const nextMfg = cleanMfg ? cleanMfg.substring(0, 128) : med.manufacturer;
    const nextForm = cleanForm ? cleanForm.substring(0, 64) : med.dosageForm;
    const nextPrice = hasPrice ? patch.pricePerUnit : med.pricePerUnit;
    const nextUnit = cleanUnit !== undefined && cleanUnit !== '' ? cleanUnit.substring(0, 32) : med.priceUnit;

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
}

export function mergeRestoredMedicines(
  currentList: GlobalMedicine[],
  itemsToRestore: GlobalMedicine[]
): GlobalMedicine[] {
  const existingIds = new Set(currentList.map((m) => m.id));
  const additions = itemsToRestore.filter((item) => !existingIds.has(item.id));
  return [...currentList, ...additions];
}

// ---------------------------------------------------------------------------
// 5. UTF-8 BOM CSV Export & Pre-Delete JSON Backup
// ---------------------------------------------------------------------------

function escapeCsvCell(val: unknown): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildMedicinesCsvWithBom(medicines: GlobalMedicine[]): string {
  const headers = [
    'ID',
    'Brand Name',
    'Brand Name (Bangla)',
    'Generic Name',
    'Generic Name (Bangla)',
    'Strength',
    'Dosage Form',
    'Manufacturer',
    'Price',
    'Price Unit',
    'Package Description',
    'DAR Number',
    'Status',
    'Source',
    'Imported At',
  ];

  const rows = medicines.map((m) =>
    [
      m.id,
      m.brandName,
      m.brandNameBn || '',
      m.genericName,
      m.genericNameBn || '',
      m.strength,
      m.dosageForm,
      m.manufacturer,
      m.pricePerUnit !== undefined ? m.pricePerUnit.toFixed(2) : '',
      m.priceUnit || '',
      m.packageDescription || '',
      m.darNumber || '',
      m.status,
      m.source,
      m.importedAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function buildPreDeleteBackupJson(medicines: GlobalMedicine[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      reason: 'pre_delete_admin_backup',
      count: medicines.length,
      medicines,
    },
    null,
    2
  );
}

function triggerBrowserFileDownload(content: string, mimeType: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMedicinesCsv(
  medicines: GlobalMedicine[],
  filename = `shasthobondhu_medicines_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const csv = buildMedicinesCsvWithBom(medicines);
  triggerBrowserFileDownload(csv, 'text/csv;charset=utf-8;', filename);
}

export function downloadPreDeleteBackupJson(
  medicines: GlobalMedicine[],
  filename = `shasthobondhu_backup_before_delete_${Date.now()}.json`
): void {
  const json = buildPreDeleteBackupJson(medicines);
  triggerBrowserFileDownload(json, 'application/json;charset=utf-8;', filename);
}

// ---------------------------------------------------------------------------
// 6. User Library Favorites, Recently Viewed & A-Z Quick Jump
// ---------------------------------------------------------------------------

export const LIBRARY_FAVORITES_STORAGE_KEY = 'shasthobondhu_lib_favorites_v1';
export const LIBRARY_RECENT_STORAGE_KEY = 'shasthobondhu_lib_recent_v1';
export const MAX_RECENTLY_VIEWED = 12;

export function loadLibraryFavoriteIds(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIBRARY_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLibraryFavoriteIds(ids: string[], storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  if (!storage) return;
  try {
    storage.setItem(LIBRARY_FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage failure
  }
}

export function loadRecentlyViewedIds(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIBRARY_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewedId(
  id: string,
  prevIds: string[],
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): string[] {
  const next = [id, ...prevIds.filter((x) => x !== id)].slice(0, MAX_RECENTLY_VIEWED);
  if (storage) {
    try {
      storage.setItem(LIBRARY_RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failure
    }
  }
  return next;
}

export const ALPHABET_INDEX_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#',
] as const;

export function getMedicineAlphabetLetter(brandName?: string): string {
  const first = (brandName || '').trim().charAt(0).toUpperCase();
  if (first >= 'A' && first <= 'Z') return first;
  return '#';
}
