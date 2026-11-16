import { performance } from 'perf_hooks';
import { GlobalMedicine } from '../src/types';
import { matchMedicineBilingualFuzzy } from '../src/utils/libraryManagement';
import {
  buildLibrarySearchIndexSync,
  clearLibrarySearchIndexCache,
  LibrarySearchFilters,
  searchIndexedMedicines,
} from '../src/utils/librarySearchIndex';

const BRAND_SEEDS = [
  {
    brand: 'Napa',
    brandBn: 'নাপা',
    generic: 'Paracetamol',
    genericBn: 'প্যারাসিটামল',
    indication: 'জ্বর ও ব্যথানাশক',
    therapeutic: 'Analgesic & Antipyretic',
  },
  {
    brand: 'Napa Extra',
    brandBn: 'নাপা এক্সট্রা',
    generic: 'Paracetamol + Caffeine',
    genericBn: 'প্যারাসিটামল + ক্যাফেইন',
    indication: 'মাথাব্যথা ও মাইগ্রেন',
    therapeutic: 'Analgesic',
  },
  {
    brand: 'Ace',
    brandBn: 'এইস',
    generic: 'Paracetamol',
    genericBn: 'প্যারাসিটামল',
    indication: 'জ্বর ও শরীর ব্যথা',
    therapeutic: 'Analgesic',
  },
  {
    brand: 'Seclo',
    brandBn: 'সেক্লো',
    generic: 'Omeprazole',
    genericBn: 'অমিপ্রাজল',
    indication: 'গ্যাস্ট্রিক ও অ্যাসিডিটি',
    therapeutic: 'Proton Pump Inhibitor',
  },
  {
    brand: 'Sergel',
    brandBn: 'সার্জেল',
    generic: 'Esomeprazole',
    genericBn: 'ইসোমিপ্রাজল',
    indication: 'পাকস্থলীর আলসার ও অ্যাসিড',
    therapeutic: 'Proton Pump Inhibitor',
  },
  {
    brand: 'Maxpro',
    brandBn: 'ম্যাক্সপ্রো',
    generic: 'Esomeprazole',
    genericBn: 'ইসোমিপ্রাজল',
    indication: 'গ্যাস্ট্রিক ও রিফ্লাক্স',
    therapeutic: 'Proton Pump Inhibitor',
  },
  {
    brand: 'Monas',
    brandBn: 'মোনাস',
    generic: 'Montelukast',
    genericBn: 'মন্টেলুকাস্ট',
    indication: 'হাঁপানি ও অ্যালার্জি',
    therapeutic: 'Leukotriene Antagonist',
  },
  {
    brand: 'Alatrol',
    brandBn: 'অ্যালাট্রল',
    generic: 'Cetirizine',
    genericBn: 'সেটিরিজিন',
    indication: 'সর্দি ও ত্বকের অ্যালার্জি',
    therapeutic: 'Antihistamine',
  },
  {
    brand: 'Fexo',
    brandBn: 'ফেক্সো',
    generic: 'Fexofenadine',
    genericBn: 'ফেক্সোফেনাডিন',
    indication: 'অ্যালার্জি ও হাঁচি',
    therapeutic: 'Antihistamine',
  },
  {
    brand: 'Comet',
    brandBn: 'কমেট',
    generic: 'Metformin',
    genericBn: 'মেটফরমিন',
    indication: 'ডায়াবেটিস নিয়ন্ত্রণ',
    therapeutic: 'Antidiabetic',
  },
  {
    brand: 'Amlocard',
    brandBn: 'এমলোকার্ড',
    generic: 'Amlodipine',
    genericBn: 'অ্যাম্লোডিপিন',
    indication: 'উচ্চ রক্তচাপ',
    therapeutic: 'Calcium Channel Blocker',
  },
  {
    brand: 'Losart',
    brandBn: 'লোসার্ট',
    generic: 'Losartan Potassium',
    genericBn: 'লোসার্টান পটাশিয়াম',
    indication: 'উচ্চ রক্তচাপ',
    therapeutic: 'ARB',
  },
  {
    brand: 'Azith',
    brandBn: 'অ্যাজিথ',
    generic: 'Azithromycin',
    genericBn: 'অ্যাজিথ্রোমাইসিন',
    indication: 'ব্যাকটেরিয়াল সংক্রমণ',
    therapeutic: 'Macrolide Antibiotic',
  },
  {
    brand: 'Moxacil',
    brandBn: 'মক্সাসিল',
    generic: 'Amoxicillin',
    genericBn: 'অ্যামোক্সিসিলিন',
    indication: 'সংক্রমণ চিকিৎসা',
    therapeutic: 'Penicillin Antibiotic',
  },
  {
    brand: 'Ciprocin',
    brandBn: 'সিপ্রোসিন',
    generic: 'Ciprofloxacin',
    genericBn: 'সিপ্রোফ্লক্সাসিন',
    indication: 'মূত্রনালী ও অন্যান্য সংক্রমণ',
    therapeutic: 'Fluoroquinolone',
  },
];

const MANUFACTURERS = [
  'Beximco Pharmaceuticals Ltd.',
  'Square Pharmaceuticals PLC',
  'Incepta Pharmaceuticals Ltd.',
  'Renata Limited',
  'Opsonin Pharma Ltd.',
  'Eskayef Pharmaceuticals Ltd.',
  'ACI Limited',
  'Healthcare Pharmaceuticals Ltd.',
  'Aristopharma Ltd.',
  'Popular Pharmaceuticals Ltd.',
];

const DOSAGE_FORMS = ['ট্যাবলেট', 'ক্যাপসুল', 'সিরাপ', 'ইনজেকশন', 'চোখের ড্রপ'];
const STRENGTHS = ['10 mg', '20 mg', '40 mg', '100 mg', '250 mg', '500 mg', '850 mg'];

function generateSyntheticCatalog(count: number): GlobalMedicine[] {
  const list: GlobalMedicine[] = [];
  for (let i = 0; i < count; i++) {
    const seed = BRAND_SEEDS[i % BRAND_SEEDS.length];
    const variantNum = Math.floor(i / BRAND_SEEDS.length);
    const brandName = variantNum === 0 ? seed.brand : `${seed.brand} ${variantNum}`;
    const brandNameBn = variantNum === 0 ? seed.brandBn : `${seed.brandBn} ${variantNum}`;
    const mfg = MANUFACTURERS[i % MANUFACTURERS.length];
    const form = DOSAGE_FORMS[i % DOSAGE_FORMS.length];
    const strength = STRENGTHS[i % STRENGTHS.length];

    list.push({
      id: `bench_med_${i}`,
      brandName,
      brandNameBn,
      genericName: seed.generic,
      genericNameBn: seed.genericBn,
      strength,
      dosageForm: form,
      manufacturer: mfg,
      indication: seed.indication,
      therapeuticClass: seed.therapeutic,
      pricePerUnit: Number(((i % 50) * 0.5 + 1.25).toFixed(2)),
      priceUnit: form === 'সিরাপ' ? 'বোতল' : 'পিস',
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA Open Data',
      importedAt: '2026-11-01T00:00:00.000Z',
      verifiedByAdmin: true,
      status: 'published',
      duplicateKey: `${brandName.toLowerCase()}_${strength}_${mfg.toLowerCase()}_${i}`,
    });
  }
  return list;
}

function runOldSearch(medicines: GlobalMedicine[], rawQuery: string): GlobalMedicine[] {
  const q = rawQuery.trim();
  const roleScoped = medicines.filter((m) => m.status === 'published');
  const scored: Array<{ med: GlobalMedicine; score: number }> = [];
  for (const med of roleScoped) {
    if (q) {
      const res = matchMedicineBilingualFuzzy(med, q);
      if (!res.matched) continue;
      scored.push({ med, score: res.score });
    } else {
      scored.push({ med, score: 1 });
    }
  }
  if (q) {
    scored.sort((a, b) => b.score - a.score || a.med.brandName.localeCompare(b.med.brandName));
  } else {
    scored.sort((a, b) => a.med.brandName.localeCompare(b.med.brandName));
  }
  return scored.map((s) => s.med);
}

const DEFAULT_FILTERS: LibrarySearchFilters = {
  isAdmin: false,
  adminStatusFilter: 'published',
  favoritesOnly: false,
  favoriteIdSet: new Set<string>(),
  selectedLetter: 'ALL',
  selectedForm: 'all',
  selectedManufacturer: 'all',
  priceFilter: 'all',
  selectedSource: 'all',
};

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function main() {
  const TOTAL = 5000;
  const catalog = generateSyntheticCatalog(TOTAL);
  clearLibrarySearchIndexCache();

  const buildStart = performance.now();
  const index = buildLibrarySearchIndexSync(catalog, true);
  const buildMs = performance.now() - buildStart;

  // Incremental update simulation: 20 added, 5 deleted
  const updatedCatalog = [
    ...catalog.slice(5),
    ...generateSyntheticCatalog(20).map((m, idx) => ({ ...m, id: `bench_new_${idx}` })),
  ];
  const incStart = performance.now();
  const incIndex = buildLibrarySearchIndexSync(updatedCatalog, true);
  const incMs = performance.now() - incStart;

  // Restore original 5000 index cleanly for search benchmark
  clearLibrarySearchIndexCache();
  const benchIndex = buildLibrarySearchIndexSync(catalog, true);

  console.log(`\n=== Library Search Benchmark (${TOTAL} medicines) ===`);
  console.log(`Cold index build (5000 meds): ${buildMs.toFixed(2)} ms`);
  console.log(`Incremental update (+20 / -5 meds, ${incIndex.totalCount} total): ${incMs.toFixed(2)} ms\n`);

  const testCases: Array<{ category: string; query: string }> = [
    { category: 'ইংরেজি (Exact/Prefix)', query: 'Napa' },
    { category: 'ইংরেজি (Generic)', query: 'Paracetamol' },
    { category: 'ইংরেজি (Generic 2)', query: 'Omeprazole' },
    { category: 'বাংলা (Brand)', query: 'নাপা' },
    { category: 'বাংলা (Generic)', query: 'প্যারাসিটামল' },
    { category: 'বাংলা (Brand 2)', query: 'সেক্লো' },
    { category: 'টাইপো (Fuzzy)', query: 'paracetmol' },
    { category: 'টাইপো (Fuzzy 2)', query: 'omeprazol' },
    { category: 'টাইপো (Fuzzy 3)', query: 'montlukast' },
    { category: 'দুই শব্দ (Brand+Ext)', query: 'Napa Extra' },
    { category: 'দুই শব্দ (Generic+Str)', query: 'Paracetamol 500' },
    { category: 'দুই শব্দ (Mfg+Form)', query: 'Beximco ট্যাবলেট' },
  ];

  // Warmup
  runOldSearch(catalog, 'Napa');
  searchIndexedMedicines(benchIndex, DEFAULT_FILTERS, 'Napa');

  let exactTop20Matches = 0;

  for (const tc of testCases) {
    const oldTimes: number[] = [];
    const newTimes: number[] = [];
    let oldRes: GlobalMedicine[] = [];
    let newRes: GlobalMedicine[] = [];

    for (let r = 0; r < 5; r++) {
      const t0 = performance.now();
      oldRes = runOldSearch(catalog, tc.query);
      oldTimes.push(performance.now() - t0);

      const t1 = performance.now();
      newRes = searchIndexedMedicines(benchIndex, DEFAULT_FILTERS, tc.query).medicines;
      newTimes.push(performance.now() - t1);
    }

    const oldMedMs = median(oldTimes);
    const newMedMs = median(newTimes);

    const oldTop20 = oldRes.slice(0, 20).map((m) => m.id);
    const newTop20 = newRes.slice(0, 20).map((m) => m.id);
    const isExactTop20 =
      oldTop20.length === newTop20.length && oldTop20.every((id, idx) => id === newTop20[idx]);
    if (isExactTop20) exactTop20Matches++;

    const speedup = newMedMs > 0 ? oldMedMs / newMedMs : 0;
    console.log(
      `[${tc.category}] "${tc.query}" -> Old: ${oldMedMs.toFixed(2)} ms (${oldRes.length} hits) | New: ${newMedMs.toFixed(2)} ms (${newRes.length} hits) | Speedup: ${speedup.toFixed(1)}x | Top-20 match: ${isExactTop20 ? 'YES (20/20)' : `DIFF (${oldTop20.filter((id, i) => newTop20[i] === id).length}/${oldTop20.length})`}`
    );

    if (!isExactTop20) {
      console.log(`   Old top 5: ${oldTop20.slice(0, 5).join(', ')}`);
      console.log(`   New top 5: ${newTop20.slice(0, 5).join(', ')}`);
    }
  }

  console.log(`\nTop-20 Parity: ${exactTop20Matches}/${testCases.length} queries identical.`);
  console.log(`Indexed entries verified: ${index.totalCount}`);
}

main();
