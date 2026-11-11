import {
  GlobalMedicine,
  ImportPreviewRecord,
  ImportDataSource,
  ImportSourceType,
} from '../types';

/**
 * Normalizes a text string for fuzzy duplicate matching
 */
export function normalizeKeyPart(val?: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '') // Keep letters and digits in both Bengali & English
    .trim();
}

/**
 * Creates a unique signature for duplicate detection:
 * brand name + generic name + strength + dosage form + manufacturer
 */
export function generateDuplicateKey(
  brandName?: string,
  genericName?: string,
  strength?: string,
  dosageForm?: string,
  manufacturer?: string
): string {
  const key = [
    normalizeKeyPart(brandName),
    normalizeKeyPart(genericName),
    normalizeKeyPart(strength),
    normalizeKeyPart(dosageForm),
    normalizeKeyPart(manufacturer),
  ].join('_');
  return key.length > 250 ? key.substring(0, 250) : key;
}

/**
 * Sanitizes an ID so it strictly matches Firestore security rules:
 * - non-empty string, length <= 128
 * - regex: ^[a-zA-Z0-9_\-]+$
 */
export function sanitizeMedicineId(rawId?: string): string {
  if (!rawId || typeof rawId !== 'string') {
    return `gmed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  let sanitized = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  if (!sanitized) {
    return `gmed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  if (sanitized.length > 120) {
    sanitized = sanitized.substring(0, 120);
  }
  return sanitized;
}

/**
 * Parses CSV raw text into rows of key-value objects
 * Handles quoted fields with commas and line breaks safely
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++; // skip next \n
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  // Parse header
  const headers = splitCSVRow(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVRow(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index].trim() : '';
    });
    // Ignore completely empty rows
    if (Object.values(rowObj).some((val) => val.length > 0)) {
      rows.push(rowObj);
    }
  }

  return rows;
}

function splitCSVRow(rowStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowStr.length; i++) {
    const c = rowStr[i];
    if (c === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

/**
 * Universal key finder from raw record object
 */
function findVal(raw: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    for (const rawKey of Object.keys(raw)) {
      if (
        rawKey.toLowerCase().replace(/[^a-z0-9]/g, '') ===
        key.toLowerCase().replace(/[^a-z0-9]/g, '')
      ) {
        const val = raw[rawKey];
        return val !== undefined && val !== null ? String(val).trim() : '';
      }
    }
  }
  return '';
}

/**
 * 1. DGDA Bangladesh Government Open Data / Gazette Mapper
 * Public open data from Directorate General of Drug Administration
 */
export function mapDGDARow(raw: Record<string, any>): Partial<GlobalMedicine> {
  const brand = findVal(raw, ['brand_name', 'brandname', 'brand', 'product_name', 'medicine_name']);
  const generic = findVal(raw, ['generic_name', 'genericname', 'generic', 'composition', 'inn']);
  const strength = findVal(raw, ['strength', 'potency', 'dose_strength']);
  const dosageForm = findVal(raw, ['dosage_form', 'dosageform', 'form', 'type']);
  const manufacturer = findVal(raw, ['manufacturer', 'company_name', 'company', 'mfg', 'industry']);
  const therapeuticClass = findVal(raw, ['therapeutic_class', 'pharmacological_class', 'class']);
  const indication = findVal(raw, ['indication', 'indications', 'clinical_indication']);
  const price = findVal(raw, ['max_retail_price', 'mrp', 'price', 'retail_price']);
  const dar = findVal(raw, ['dar_number', 'dar_no', 'dar', 'reg_no', 'registration_number']);
  const pack = findVal(raw, ['pack_size', 'package', 'packaging']);

  return {
    brandName: brand,
    genericName: generic,
    strength: strength,
    dosageForm: dosageForm,
    manufacturer: manufacturer,
    therapeuticClass: therapeuticClass || undefined,
    indication: indication || undefined,
    pricePerUnit: price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    packageDescription: pack || undefined,
    darNumber: dar || undefined,
    source: 'DGDA_GOV',
    sourceType: 'government',
    sourceName: 'DGDA সরকারি ড্রাগ গেজেট (Public Open Data)',
  };
}

/**
 * 2. Pharmaceutical Manufacturer Official Monograph / Price List Mapper
 * Legally reusable data published by licensed pharmaceutical manufacturers
 */
export function mapManufacturerRow(raw: Record<string, any>): Partial<GlobalMedicine> {
  const brand = findVal(raw, ['brand_name', 'trade_name', 'brand', 'product']);
  const generic = findVal(raw, ['generic_name', 'molecule', 'generic', 'active_substance']);
  const strength = findVal(raw, ['strength', 'dose', 'potency']);
  const dosageForm = findVal(raw, ['dosage_form', 'form', 'presentation']);
  const manufacturer = findVal(raw, ['manufacturer', 'company', 'company_name', 'mfg']);
  const therapeuticClass = findVal(raw, ['therapeutic_class', 'category', 'group']);
  const indication = findVal(raw, ['indication', 'purpose', 'usage']);
  const price = findVal(raw, ['mrp', 'price', 'unit_price', 'trade_price']);
  const dar = findVal(raw, ['dar_no', 'dar_number', 'license_no']);
  const pack = findVal(raw, ['pack_size', 'presentation_size']);

  return {
    brandName: brand,
    genericName: generic,
    strength: strength,
    dosageForm: dosageForm,
    manufacturer: manufacturer,
    therapeuticClass: therapeuticClass || undefined,
    indication: indication || undefined,
    pricePerUnit: price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    packageDescription: pack || undefined,
    darNumber: dar || undefined,
    source: 'MANUFACTURER',
    sourceType: 'manufacturer',
    sourceName: 'ওষুধ প্রস্তুতকারক অফিশিয়াল মনোগ্রাফ (Manufacturer Compendium)',
  };
}

/**
 * 3. Independently Created & Verified Clinical Records Mapper
 * Curated and reviewed directly by clinical staff/pharmacists
 */
export function mapIndependentRow(raw: Record<string, any>): Partial<GlobalMedicine> {
  const brand = findVal(raw, ['brand_name', 'brand', 'name', 'medicine']);
  const generic = findVal(raw, ['generic_name', 'generic', 'inn']);
  const strength = findVal(raw, ['strength', 'dose']);
  const dosageForm = findVal(raw, ['dosage_form', 'form', 'type']);
  const manufacturer = findVal(raw, ['manufacturer', 'company']);
  const therapeuticClass = findVal(raw, ['therapeutic_class', 'class', 'group']);
  const indication = findVal(raw, ['indication', 'clinical_use', 'notes']);
  const price = findVal(raw, ['price', 'mrp', 'unit_price']);
  const dar = findVal(raw, ['dar_number', 'dar_no', 'dgda_id']);

  return {
    brandName: brand,
    genericName: generic,
    strength: strength,
    dosageForm: dosageForm,
    manufacturer: manufacturer,
    therapeuticClass: therapeuticClass || undefined,
    indication: indication || undefined,
    pricePerUnit: price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    darNumber: dar || undefined,
    source: 'INDEPENDENT_VERIFIED',
    sourceType: 'independent',
    sourceName: 'স্বাধীনভাবে সংকলিত ও ক্লিনিক্যাল যাচাইকৃত রেকর্ড (Independently Verified)',
  };
}

/**
 * 4. Licensed Partner MedEx Row Mapper
 * STRICT REQUIREMENT: Only allowed when documented written permission is established
 */
export function mapMedExRow(raw: Record<string, any>): Partial<GlobalMedicine> {
  const brand = findVal(raw, ['brand_name', 'brandname', 'brand', 'medicine_name', 'trade_name']);
  const generic = findVal(raw, ['generic_name', 'genericname', 'generic', 'composition']);
  const strength = findVal(raw, ['strength', 'dose', 'potency']);
  const dosageForm = findVal(raw, ['dosage_form', 'dosageform', 'form', 'type']);
  const manufacturer = findVal(raw, ['manufacturer', 'company_name', 'company', 'mfg']);
  const therapeuticClass = findVal(raw, ['therapeutic_class', 'class', 'group']);
  const indication = findVal(raw, ['indication', 'indications', 'use', 'purpose']);
  const price = findVal(raw, ['price', 'unit_price', 'mrp', 'price_bdt']);
  const dar = findVal(raw, ['dar_number', 'dar_no', 'dar', 'registration_number', 'reg_no']);
  const pack = findVal(raw, ['pack_size', 'package_size', 'package']);

  return {
    brandName: brand,
    genericName: generic,
    strength: strength,
    dosageForm: dosageForm,
    manufacturer: manufacturer,
    therapeuticClass: therapeuticClass || undefined,
    indication: indication || undefined,
    pricePerUnit: price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    packageDescription: pack || undefined,
    darNumber: dar || undefined,
    source: 'MEDEX_LICENSED',
    sourceType: 'licensed_partner',
    sourceName: 'MedEx Bangladesh (লিখিত লাইসেন্স চুক্তি সাপেক্ষে)',
  };
}

/**
 * 5. Licensed Partner DIMS Row Mapper
 * STRICT REQUIREMENT: Only allowed when documented written permission is established
 */
export function mapDIMSRow(raw: Record<string, any>): Partial<GlobalMedicine> {
  const brand = findVal(raw, ['brand', 'trade_name', 'product_name', 'brand_name']);
  const generic = findVal(raw, ['generic', 'generic_name', 'inn', 'molecule']);
  const strength = findVal(raw, ['strength', 'potency']);
  const dosageForm = findVal(raw, ['form', 'dosage_form', 'presentation']);
  const manufacturer = findVal(raw, ['company', 'manufacturer', 'pharmaceutical']);
  const therapeuticClass = findVal(raw, ['class', 'therapeutic_class', 'pharmacological_class']);
  const indication = findVal(raw, ['indication', 'clinical_indication']);
  const price = findVal(raw, ['unit_price', 'price', 'trade_price']);
  const dar = findVal(raw, ['dar', 'dar_no', 'dgda_reg']);

  return {
    brandName: brand,
    genericName: generic,
    strength: strength,
    dosageForm: dosageForm,
    manufacturer: manufacturer,
    therapeuticClass: therapeuticClass || undefined,
    indication: indication || undefined,
    pricePerUnit: price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    darNumber: dar || undefined,
    source: 'DIMS_LICENSED',
    sourceType: 'licensed_partner',
    sourceName: 'DIMS Bangladesh (ITmedicus) (লিখিত লাইসেন্স চুক্তি সাপেক্ষে)',
  };
}

/**
 * Validates a mapped record and flags missing required fields
 */
export function validateMedicineRecord(
  record: Partial<GlobalMedicine>,
  profile: string,
  writtenPermissionRef?: string
): string[] {
  const errors: string[] = [];

  // Core essential attributes & Firestore rules validation
  if (!record.brandName || record.brandName.trim().length === 0) {
    errors.push('ব্র্যান্ড নাম (Brand Name) অনুপস্থিত');
  } else if (record.brandName.length > 128) {
    errors.push('ব্র্যান্ড নাম সর্বোচ্চ ১২৮ অক্ষর হতে পারে (Firestore Rules)');
  }

  if (!record.genericName || record.genericName.trim().length === 0) {
    errors.push('জেনেরিক নাম (Generic Name) অনুপস্থিত');
  } else if (record.genericName.length > 256) {
    errors.push('জেনেরিক নাম সর্বোচ্চ ২৫৬ অক্ষর হতে পারে (Firestore Rules)');
  }

  if (!record.strength || record.strength.trim().length === 0) {
    errors.push('শক্তি/মাত্রা (Strength) অনুপস্থিত');
  } else if (record.strength.length > 64) {
    errors.push('শক্তি/মাত্রা সর্বোচ্চ ৬৪ অক্ষর হতে পারে (Firestore Rules)');
  }

  if (!record.dosageForm || record.dosageForm.trim().length === 0) {
    errors.push('ডোজের ধরন (Dosage Form) অনুপস্থিত');
  } else if (record.dosageForm.length > 64) {
    errors.push('ডোজের ধরন সর্বোচ্চ ৬৪ অক্ষর হতে পারে (Firestore Rules)');
  }

  if (!record.manufacturer || record.manufacturer.trim().length === 0) {
    errors.push('প্রস্তুতকারক প্রতিষ্ঠান (Manufacturer) অনুপস্থিত');
  } else if (record.manufacturer.length > 128) {
    errors.push('প্রস্তুতকারক প্রতিষ্ঠান সর্বোচ্চ ১২৮ অক্ষর হতে পারে (Firestore Rules)');
  }

  // Legal & Compliance validations (Requirements 1, 2, 5)
  if (!record.source) {
    errors.push('উৎস (Source) অনুপস্থিত');
  } else if (record.source.length > 64) {
    errors.push('উৎস সর্বোচ্চ ৬৪ অক্ষর হতে পারে (Firestore Rules)');
  }

  if (!record.licenseReference || record.licenseReference.trim().length === 0) {
    errors.push('আইনি লাইসেন্স রেফারেন্স (License Reference) অনুপস্থিত');
  }

  // Validate ID format if present
  if (record.id) {
    if (!/^[a-zA-Z0-9_\-]+$/.test(record.id) || record.id.length > 128) {
      errors.push('আইডি শুধুমাত্র a-z, A-Z, 0-9, _ এবং - সমর্থন করে (সর্বোচ্চ ১২৮ অক্ষর)');
    }
  }

  // Strict check for MedEx / DIMS: written permission reference is strictly mandatory
  if (profile === 'medex_licensed' || profile === 'medex' || profile === 'dims_licensed' || profile === 'dims') {
    if (!writtenPermissionRef || writtenPermissionRef.trim().length < 4) {
      errors.push('MedEx/DIMS ডাটা ইমপোর্টের জন্য বৈধ লিখিত অনুমতি রেফারেন্স (Written Permission Ref) বাধ্যতামূলক');
    }
  }

  return errors;
}

/**
 * Processes uploaded raw items (from CSV or JSON) through profile mapping,
 * validation, duplicate detection against existing catalog, and sets verification flags.
 */
export function processImportPayload(
  rawItems: any[],
  profile:
    | 'dgda_gov'
    | 'manufacturer'
    | 'independent'
    | 'medex_licensed'
    | 'dims_licensed'
    | 'medex'
    | 'dims'
    | 'custom',
  existingCatalog: GlobalMedicine[],
  licenseReference: string,
  writtenPermissionRef?: string,
  targetStatus: 'published' | 'pending_verification' = 'published'
): {
  previewRecords: ImportPreviewRecord[];
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
} {
  const existingMap = new Map<string, GlobalMedicine>();
  existingCatalog.forEach((item) => {
    existingMap.set(item.duplicateKey, item);
  });

  const seenInBatch = new Set<string>();
  const previewRecords: ImportPreviewRecord[] = [];

  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  rawItems.forEach((raw, index) => {
    const tempId = `temp_${Date.now()}_${index}`;
    let mapped: Partial<GlobalMedicine>;

    // Route to appropriate profile mapper
    if (profile === 'dgda_gov') {
      mapped = mapDGDARow(raw);
    } else if (profile === 'manufacturer') {
      mapped = mapManufacturerRow(raw);
    } else if (profile === 'independent') {
      mapped = mapIndependentRow(raw);
    } else if (profile === 'medex_licensed' || profile === 'medex') {
      mapped = mapMedExRow(raw);
    } else if (profile === 'dims_licensed' || profile === 'dims') {
      mapped = mapDIMSRow(raw);
    } else {
      // Fallback: try DGDA, then manufacturer
      mapped = { ...mapManufacturerRow(raw), ...mapDGDARow(raw) };
    }

    mapped.licenseReference = licenseReference.trim();
    if (writtenPermissionRef?.trim()) {
      mapped.writtenPermissionRef = writtenPermissionRef.trim();
    }

    // Set verification and initial publication status (Requirement 6)
    // If targetStatus is 'pending_verification', keep unverified records unpublished
    mapped.status = targetStatus;
    mapped.verifiedByAdmin = targetStatus === 'published';

    const errors = validateMedicineRecord(mapped, profile, writtenPermissionRef);

    if (errors.length > 0) {
      errorCount++;
      previewRecords.push({
        tempId,
        record: mapped,
        validationStatus: 'error',
        validationErrors: errors,
        isExistingDuplicate: false,
      });
      return;
    }

    const dupKey = generateDuplicateKey(
      mapped.brandName,
      mapped.genericName,
      mapped.strength,
      mapped.dosageForm,
      mapped.manufacturer
    );
    mapped.duplicateKey = dupKey;

    const existingMatch = existingMap.get(dupKey);
    const isDupInBatch = seenInBatch.has(dupKey);

    if (existingMatch || isDupInBatch) {
      duplicateCount++;
      previewRecords.push({
        tempId,
        record: mapped,
        validationStatus: 'duplicate',
        validationErrors: isDupInBatch
          ? ['এই ফাইলের মধ্যেই একাধিকবার উপস্থিত (Duplicate in File)']
          : [`ডাটাবেজে ইতিমধ্যে বিদ্যমান (ID: ${existingMatch?.id})`],
        isExistingDuplicate: !!existingMatch,
        existingId: existingMatch?.id,
        duplicateResolution: 'skip',
      });
    } else {
      validCount++;
      seenInBatch.add(dupKey);
      previewRecords.push({
        tempId,
        record: mapped,
        validationStatus: 'valid',
        validationErrors: [],
        isExistingDuplicate: false,
      });
    }
  });

  return {
    previewRecords,
    totalCount: rawItems.length,
    validCount,
    duplicateCount,
    errorCount,
  };
}

/**
 * 1. Legally reusable Government Open Data Template (DGDA National Formulary Gazette)
 */
export function getSampleDGDACSV(): string {
  return `DAR Number,Brand Name,Generic Name,Strength,Dosage Form,Manufacturer,Therapeutic Class,Max Retail Price,Pack Size
034-0012-020,Ace,Paracetamol,500 mg,Tablet,Square Pharmaceuticals PLC,Analgesics & Antipyretics,1.20,500's Pack
022-0051-020,Napa,Paracetamol,500 mg,Tablet,Beximco Pharmaceuticals Ltd.,Analgesics & Antipyretics,1.20,510's Pack
034-0120-035,Seclo,Omeprazole,20 mg,Capsule,Square Pharmaceuticals PLC,Proton Pump Inhibitors,6.00,100's Pack
045-0210-020,Sergel,Esomeprazole Magnesium,20 mg,Capsule,Healthcare Pharmaceuticals Ltd.,Proton Pump Inhibitors,8.00,100's Pack
002-0312-010,Monas 10,Montelukast,10 mg,Tablet,Acme Laboratories Ltd.,Leukotriene Receptor Antagonist,16.00,30's Pack`;
}

/**
 * 2. Legally reusable Pharmaceutical Manufacturer Official Monograph Template
 */
export function getSampleManufacturerCSV(): string {
  return `Brand,Generic,Strength,Form,Manufacturer,Indication,MRP,DAR No
Alatrol,Cetirizine Hydrochloride,10 mg,Tablet,Square Pharmaceuticals PLC,Allergic Rhinitis & Urticaria,3.50,034-0078-010
Tofen,Ketotifen,1 mg,Tablet,Beximco Pharmaceuticals Ltd.,Prophylactic Treatment of Bronchial Asthma,4.00,022-0112-015
Ciprocin,Ciprofloxacin,500 mg,Tablet,Square Pharmaceuticals PLC,Broad spectrum bacterial infections,15.00,034-0340-025
Fexo 120,Fexofenadine,120 mg,Tablet,Square Pharmaceuticals PLC,Seasonal Allergic Rhinitis,9.00,034-0410-030
Bizoran 5/20,Amlodipine + Olmesartan,5 mg + 20 mg,Tablet,Beximco Pharmaceuticals Ltd.,Essential Hypertension,12.00,022-0560-040`;
}

/**
 * 3. Independently Created & Verified Clinical Records Template (JSON)
 */
export function getSampleIndependentJSON(): string {
  return JSON.stringify(
    [
      {
        "Brand Name": "Azithrocin",
        "Generic Name": "Azithromycin",
        "Strength": "500 mg",
        "Dosage Form": "Tablet",
        "Manufacturer": "Square Pharmaceuticals PLC",
        "Therapeutic Class": "Macrolide Antibiotic",
        "Indication": "Respiratory tract and skin infections",
        "Price": "35.00",
        "DAR No": "034-0199-030"
      },
      {
        "Brand Name": "Thyrox 50",
        "Generic Name": "Levothyroxine Sodium",
        "Strength": "50 mcg",
        "Dosage Form": "Tablet",
        "Manufacturer": "Renata Limited",
        "Therapeutic Class": "Thyroid Hormone",
        "Indication": "Hypothyroidism replacement therapy",
        "Price": "2.25",
        "DAR No": "026-0045-010"
      }
    ],
    null,
    2
  );
}

/**
 * 4. Sample MedEx Template (Requires documented written permission reference)
 */
export function getSampleMedExCSV(): string {
  return `Brand Name,Generic Name,Strength,Dosage Form,Company,Indication,Price,Pack Size,DAR No
Napa Extra,Paracetamol + Caffeine,500 mg + 65 mg,Tablet,Beximco Pharmaceuticals Ltd.,Severe Headache & Fever,2.50,200's Pack,022-0145-020
Maxpro,Esomeprazole,20 mg,Capsule,Square Pharmaceuticals PLC,GERD & Peptic Ulcer,8.00,100's Pack,034-0230-045`;
}

/**
 * 5. Sample DIMS Template (Requires documented written permission reference)
 */
export function getSampleDIMSCSV(): string {
  return `Brand,Generic,Strength,Form,Manufacturer,Class,Indication,Price,DAR No
Pantonix,Pantoprazole,20 mg,Tablet,Incepta Pharmaceuticals Ltd.,Proton Pump Inhibitor,Hyperacidity,7.00,078-0044-030
Beklo 10,Baclofen,10 mg,Tablet,Square Pharmaceuticals PLC,Muscle Relaxant,Muscle Spasm,10.00,034-0155-025`;
}

/**
 * 6. Fictional Medicine Records Template for Testing (Clearly marked TEST DATA)
 * Contains 5 completely fictional medicines using exact CSV template columns
 */
export function getSampleFictionalTestCSV(): string {
  return `DAR Number,Brand Name,Generic Name,Strength,Dosage Form,Manufacturer,Therapeutic Class,Max Retail Price,Pack Size
TEST-DAR-000-001,TestMed-Alpha (TEST DATA),Fictional-Comp-A (TEST DATA),10 mg (TEST),ট্যাবলেট,Sample Demo Pharma PLC (TEST DATA),Non-clinical Test Category (TEST DATA),2.50,10's Test Strip
TEST-DAR-000-002,FictioCure-Beta (TEST DATA),DummyMolecule-B (TEST DATA),250 mg (TEST),ক্যাপসুল,Simulated Health Labs Ltd. (TEST DATA),Mock Agent Category (TEST DATA),12.00,20's Test Box
TEST-DAR-000-003,MockRelief-Gamma (TEST DATA),SyntheticPoly-C (TEST DATA),5 mg/5ml (TEST),সিরাপ,Fictional Therapeutics BD (TEST DATA),Simulated Solution (TEST DATA),65.00,100 ml Test Bottle
TEST-DAR-000-004,DemoSoothe-Delta (TEST DATA),InertCompound-D (TEST DATA),50 mcg (TEST),চোখের ড্রপ,Sample Demo Pharma PLC (TEST DATA),Trial Test Formulation (TEST DATA),80.00,5 ml Test Dropper
TEST-DAR-000-005,TestGrip-Epsilon (TEST DATA),NonMedicalBase-E (TEST DATA),1% (TEST),মলম/জেল,Simulated Health Labs Ltd. (TEST DATA),Non-therapeutic Carrier (TEST DATA),45.00,15 gm Test Tube`;
}

/**
 * Checks whether a given global medicine record is genuinely dummy / TEST DATA.
 * Only explicit mock simulation records (e.g. brand or generic with "(TEST DATA)",
 * or DAR starting with "TEST-") are marked as TEST DATA.
 * Real registered medicines (e.g. Nimocon 500, Napa, Ace, Seclo) are NEVER flagged as TEST DATA.
 */
export function isTestMedicine(med: Partial<GlobalMedicine>): boolean {
  const brand = (med.brandName || '').toLowerCase().trim();
  const generic = (med.genericName || '').toLowerCase().trim();
  const dar = (med.darNumber || '').toLowerCase().trim();
  const mfg = (med.manufacturer || '').toLowerCase().trim();

  return (
    brand.includes('(test data)') ||
    brand.includes('test data') ||
    brand.includes('টেস্ট ডাটা') ||
    generic.includes('(test data)') ||
    generic.includes('test data') ||
    mfg.includes('(test data)') ||
    dar.startsWith('test-')
  );
}

