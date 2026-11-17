import {
  DoctorProfile,
  MedicalDocument,
  MedicalDocumentKind,
  MedicalDocumentPageMeta,
  MedicalReportType,
  PatientProfile,
} from '../types';
import { formatBengaliDate, toBengaliNumber } from './bengaliUtils';
import { normalizeBengaliDigits } from './doctorsManager';
import { toMillisSafe } from './sharedReports';
import { toLocalIsoDate } from './shoppingListCalculator';

export const MAX_DOCUMENT_PAGES = 10;
export const MAX_USER_DOCUMENT_PAGES = 120;
export const MAX_PRINT_PAGES = 30;
export const MAX_DOC_TITLE_LENGTH = 130;
export const MAX_DOC_NOTE_LENGTH = 1000;
export const MAX_IMAGE_DIMENSION = 1800;
export const INITIAL_IMAGE_QUALITY = 0.7;
export const MAX_FILE_BYTES = 700 * 1024; // < 700 KB
export const MAX_FILE_DATA_CHARS = 900_000; // safely below 950,000 rules limit & 1 MB doc limit
export const THUMB_MAX_DIMENSION = 240;
export const MAX_THUMB_BYTES = 10 * 1024; // <= 10 KB

export const DOCUMENT_PRIVACY_NOTICE =
  'আপনার ছবি শুধু আপনার অ্যাকাউন্টে থাকে, আর কেউ দেখতে পায় না।';

export const REPORT_TYPES: MedicalReportType[] = [
  'রক্ত পরীক্ষা',
  'এক্স-রে',
  'ECG',
  'আলট্রাসাউন্ড',
  'প্রস্রাব পরীক্ষা',
  'সিটি/MRI',
  'অন্যান্য',
];

export interface CompressedDocumentImages {
  fullDataUrl: string;
  fullBytes: number;
  thumbDataUrl: string;
  thumbBytes: number;
  width: number;
  height: number;
}

export interface DocumentFormInput {
  id?: string;
  kind: MedicalDocumentKind;
  patientId: string;
  doctorId?: string;
  title: string;
  date: string;
  note?: string;
  reportType?: string;
  pages: MedicalDocumentPageMeta[];
}

export interface DocumentFilterOptions {
  kind?: MedicalDocumentKind;
  doctorId?: string;
  unlinkedOnly?: boolean;
  patientId?: string; // 'all' or specific id
  reportType?: string; // 'all' or specific reportType
  searchQuery?: string;
}

export interface DocumentPrintPageEntry {
  key: string;
  docId: string;
  fileId: string;
  docTitle: string;
  docDateBn: string;
  patientName: string;
  doctorName?: string;
  reportType?: string;
  pageNumberInDoc: number;
  totalPagesInDoc: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface DocumentPrintCoverRow {
  serialBn: string;
  docId: string;
  dateBn: string;
  title: string;
  reportType?: string;
  pageCountBn: string;
}

export interface DocumentPrintBundle {
  kind: MedicalDocumentKind;
  headingTitle: string;
  patientLabel: string;
  doctorLabel?: string;
  printedAtBn: string;
  totalPages: number;
  rows: DocumentPrintCoverRow[];
  pages: DocumentPrintPageEntry[];
}

/**
 * Estimates binary byte size of a base64 data URL (or raw base64 string).
 */
export function estimateBase64DataUrlBytes(dataUrl: string): number {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Part = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const clean = base64Part.replace(/\s+/g, '');
  if (!clean) return 0;
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function rotateDegreeClockwise(current?: number): 0 | 90 | 180 | 270 {
  const norm = (((current || 0) % 360) + 360) % 360;
  if (norm === 0) return 90;
  if (norm === 90) return 180;
  if (norm === 180) return 270;
  return 0;
}

export function normalizeRotation(rot?: number): 0 | 90 | 180 | 270 {
  const norm = (((Math.round(rot || 0) % 360) + 360) % 360);
  if (norm === 90) return 90;
  if (norm === 180) return 180;
  if (norm === 270) return 270;
  return 0;
}

export function movePageInList<T>(
  pages: T[],
  fromIndex: number,
  direction: 'up' | 'down'
): T[] {
  if (fromIndex < 0 || fromIndex >= pages.length) return [...pages];
  const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (targetIndex < 0 || targetIndex >= pages.length) return [...pages];
  const copy = [...pages];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(targetIndex, 0, moved);
  return copy;
}

export function removePageFromList<T>(pages: T[], index: number): T[] {
  if (index < 0 || index >= pages.length) return [...pages];
  return pages.filter((_, i) => i !== index);
}

export function countTotalUserPages(
  docs: Array<Pick<MedicalDocument, 'pages'>>
): number {
  let total = 0;
  for (const d of docs) {
    if (Array.isArray(d.pages)) {
      total += d.pages.length;
    }
  }
  return total;
}

export function canAddUserPages(
  existingDocs: Array<Pick<MedicalDocument, 'pages'>>,
  newDocPageCount: number,
  replacingOldDocPageCount: number = 0
): {
  allowed: boolean;
  currentTotal: number;
  projectedTotal: number;
  remaining: number;
  reasonBn?: string;
} {
  const currentTotal = countTotalUserPages(existingDocs);
  const netNew = Math.max(0, newDocPageCount - Math.max(0, replacingOldDocPageCount));
  const projectedTotal = Math.max(0, currentTotal - Math.max(0, replacingOldDocPageCount) + newDocPageCount);
  const remaining = Math.max(0, MAX_USER_DOCUMENT_PAGES - currentTotal);

  if (newDocPageCount > MAX_DOCUMENT_PAGES) {
    return {
      allowed: false,
      currentTotal,
      projectedTotal,
      remaining,
      reasonBn: `একটি ডকুমেন্টে সর্বোচ্চ ${toBengaliNumber(MAX_DOCUMENT_PAGES)}টি পাতা রাখা যায়।`,
    };
  }

  if (projectedTotal > MAX_USER_DOCUMENT_PAGES) {
    return {
      allowed: false,
      currentTotal,
      projectedTotal,
      remaining,
      reasonBn: `সর্বোচ্চ ${toBengaliNumber(MAX_USER_DOCUMENT_PAGES)}টি ছবির পাতা রাখার সীমা পূর্ণ হয়েছে (বর্তমানে ${toBengaliNumber(currentTotal)}টি ব্যবহার হয়েছে${netNew > 0 ? `, নতুন ${toBengaliNumber(netNew)}টি পাতা` : ''})। নতুন ছবি রাখতে পুরনো অপ্রয়োজনীয় ছবি মুছুন।`,
    };
  }

  return {
    allowed: true,
    currentTotal,
    projectedTotal,
    remaining,
  };
}

export function buildDefaultDocumentTitle(
  kind: MedicalDocumentKind,
  options: {
    doctorName?: string;
    reportType?: string;
    date?: string;
  }
): string {
  const dateStr = options.date?.trim() || toLocalIsoDate(new Date());
  const dateLabel = formatBengaliDate(dateStr);

  if (kind === 'prescription') {
    const docName = (options.doctorName || '').trim();
    const raw = docName
      ? `প্রেসক্রিপশন — ${docName} — ${dateLabel}`
      : `প্রেসক্রিপশন — ${dateLabel}`;
    return raw.slice(0, MAX_DOC_TITLE_LENGTH);
  }

  const rType = (options.reportType || '').trim();
  const raw = rType
    ? `রিপোর্ট — ${rType} — ${dateLabel}`
    : `রিপোর্ট — ${dateLabel}`;
  return raw.slice(0, MAX_DOC_TITLE_LENGTH);
}

export function buildCleanMedicalDocumentInput(input: DocumentFormInput): {
  kind: MedicalDocumentKind;
  patientId: string;
  doctorId?: string;
  title: string;
  date: string;
  note?: string;
  reportType?: string;
  pages: MedicalDocumentPageMeta[];
} {
  const kind: MedicalDocumentKind =
    input.kind === 'report' ? 'report' : 'prescription';
  const patientId = (input.patientId || '').trim().slice(0, 128);
  const doctorId = (input.doctorId || '').trim().slice(0, 128) || undefined;
  const dateNorm = normalizeBengaliDigits((input.date || '').trim());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateNorm)
    ? dateNorm
    : toLocalIsoDate(new Date());

  const reportType =
    kind === 'report'
      ? (input.reportType || '').trim().slice(0, 64) || undefined
      : undefined;

  const trimmedTitle = (input.title || '').trim();
  const fallbackTitle = buildDefaultDocumentTitle(kind, {
    reportType,
    date,
  });
  const title = (trimmedTitle || fallbackTitle).slice(0, MAX_DOC_TITLE_LENGTH);

  const note = (input.note || '').trim().slice(0, MAX_DOC_NOTE_LENGTH) || undefined;

  const pages: MedicalDocumentPageMeta[] = (Array.isArray(input.pages) ? input.pages : [])
    .filter((p) => p && typeof p.fileId === 'string' && p.fileId.trim())
    .slice(0, MAX_DOCUMENT_PAGES)
    .map((p) => ({
      fileId: p.fileId.trim(),
      thumb: typeof p.thumb === 'string' ? p.thumb : '',
      width: Number.isFinite(p.width) && p.width > 0 ? Math.round(p.width) : 240,
      height: Number.isFinite(p.height) && p.height > 0 ? Math.round(p.height) : 320,
      rotation: normalizeRotation(p.rotation),
    }));

  return {
    kind,
    patientId,
    ...(doctorId ? { doctorId } : {}),
    title,
    date,
    ...(note ? { note } : {}),
    ...(reportType ? { reportType } : {}),
    pages,
  };
}

export function sortMedicalDocumentsNewestFirst(
  docs: MedicalDocument[]
): MedicalDocument[] {
  return [...docs].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    const bMs = toMillisSafe(b.updatedAt) || toMillisSafe(b.createdAt);
    const aMs = toMillisSafe(a.updatedAt) || toMillisSafe(a.createdAt);
    if (bMs !== aMs) return bMs - aMs;
    return (b.id || '').localeCompare(a.id || '');
  });
}

export function filterAndSortMedicalDocuments(
  docs: MedicalDocument[],
  options: DocumentFilterOptions,
  doctorsById?: Map<string, DoctorProfile>
): MedicalDocument[] {
  const query = normalizeBengaliDigits((options.searchQuery || '').trim().toLowerCase());

  const filtered = docs.filter((docItem) => {
    if (options.kind && docItem.kind !== options.kind) return false;
    if (options.unlinkedOnly) {
      if (docItem.doctorId && docItem.doctorId.trim() !== '') return false;
    } else if (options.doctorId && docItem.doctorId !== options.doctorId) {
      return false;
    }
    if (options.patientId && options.patientId !== 'all' && docItem.patientId !== options.patientId) {
      return false;
    }
    if (
      options.reportType &&
      options.reportType !== 'all' &&
      (docItem.reportType || '') !== options.reportType
    ) {
      return false;
    }

    if (!query) return true;

    const doctorName = docItem.doctorId && doctorsById
      ? doctorsById.get(docItem.doctorId)?.name || ''
      : '';

    const haystack = [
      docItem.title,
      docItem.note,
      docItem.reportType,
      docItem.date,
      doctorName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      haystack.includes(query) ||
      normalizeBengaliDigits(haystack).includes(query)
    );
  });

  return sortMedicalDocumentsNewestFirst(filtered);
}

export function validatePrintSelectionPageCount(
  docs: MedicalDocument[]
): { allowed: boolean; totalPages: number; messageBn?: string } {
  const totalPages = countTotalUserPages(docs);
  if (totalPages === 0) {
    return {
      allowed: false,
      totalPages: 0,
      messageBn: 'প্রিন্ট করার জন্য কমপক্ষে একটি ডকুমেন্ট নির্বাচন করুন।',
    };
  }
  if (totalPages > MAX_PRINT_PAGES) {
    return {
      allowed: false,
      totalPages,
      messageBn: `একবারে সর্বোচ্চ ${toBengaliNumber(MAX_PRINT_PAGES)} পাতা PDF করা যায় (বর্তমানে ${toBengaliNumber(totalPages)} পাতা নির্বাচিত)। অনুগ্রহ করে কয়েকটি কমিয়ে ভাগ করে নামান।`,
    };
  }
  return { allowed: true, totalPages };
}

export function buildDocumentPrintBundle(params: {
  kind: MedicalDocumentKind;
  docs: MedicalDocument[];
  patients: PatientProfile[];
  doctors: DoctorProfile[];
  fixedDoctor?: DoctorProfile | null;
  patientFilterId?: string;
}): DocumentPrintBundle {
  const patientMap = new Map(params.patients.map((p) => [p.id, p]));
  const doctorMap = new Map(params.doctors.map((d) => [d.id, d]));

  const orderedDocs = sortMedicalDocumentsNewestFirst(params.docs);

  let patientLabel = 'সকল প্রোফাইল';
  if (params.patientFilterId && params.patientFilterId !== 'all') {
    const p = patientMap.get(params.patientFilterId);
    if (p) patientLabel = `${p.name} (${p.relation})`;
  } else {
    const uniquePatientIds = Array.from(
      new Set(orderedDocs.map((d) => d.patientId).filter(Boolean))
    );
    if (uniquePatientIds.length === 1) {
      const p = patientMap.get(uniquePatientIds[0]);
      if (p) patientLabel = `${p.name} (${p.relation})`;
    } else if (uniquePatientIds.length > 1) {
      patientLabel = uniquePatientIds
        .map((id) => patientMap.get(id)?.name || 'সদস্য')
        .join(', ');
    }
  }

  let doctorLabel: string | undefined;
  if (params.fixedDoctor) {
    doctorLabel = params.fixedDoctor.specialty
      ? `${params.fixedDoctor.name} (${params.fixedDoctor.specialty})`
      : params.fixedDoctor.name;
  } else {
    const docDoctorIds = Array.from(
      new Set(orderedDocs.map((d) => d.doctorId).filter((id): id is string => Boolean(id)))
    );
    if (docDoctorIds.length === 1) {
      const d = doctorMap.get(docDoctorIds[0]);
      if (d) {
        doctorLabel = d.specialty ? `${d.name} (${d.specialty})` : d.name;
      }
    }
  }

  const rows: DocumentPrintCoverRow[] = [];
  const pages: DocumentPrintPageEntry[] = [];

  orderedDocs.forEach((docItem, idx) => {
    const docPatient = patientMap.get(docItem.patientId);
    const pName = docPatient ? docPatient.name : 'রোগী';
    const dObj = docItem.doctorId ? doctorMap.get(docItem.doctorId) : undefined;
    const dName = dObj?.name || params.fixedDoctor?.name;
    const dateBn = formatBengaliDate(docItem.date);
    const docPages = Array.isArray(docItem.pages) ? docItem.pages : [];

    rows.push({
      serialBn: toBengaliNumber(idx + 1),
      docId: docItem.id,
      dateBn,
      title: docItem.title,
      reportType: docItem.reportType,
      pageCountBn: `${toBengaliNumber(docPages.length)} পাতা`,
    });

    docPages.forEach((page, pIdx) => {
      pages.push({
        key: `${docItem.id}-${page.fileId}-${pIdx}`,
        docId: docItem.id,
        fileId: page.fileId,
        docTitle: docItem.title,
        docDateBn: dateBn,
        patientName: pName,
        doctorName: dName,
        reportType: docItem.reportType,
        pageNumberInDoc: pIdx + 1,
        totalPagesInDoc: docPages.length,
        rotation: normalizeRotation(page.rotation),
      });
    });
  });

  return {
    kind: params.kind,
    headingTitle:
      params.kind === 'prescription'
        ? 'স্বাস্থ্যবন্ধু — প্রেসক্রিপশন সংগ্রহ'
        : 'স্বাস্থ্যবন্ধু — রিপোর্ট সংগ্রহ',
    patientLabel,
    doctorLabel,
    printedAtBn: formatBengaliDate(toLocalIsoDate(new Date())),
    totalPages: pages.length,
    rows,
    pages,
  };
}

// ============================================================================
// Client-Side Image & Thumbnail Compression (HTMLCanvasElement)
// ============================================================================

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ফাইল পড়া যায়নি।'));
      }
    };
    reader.onerror = () => reject(new Error('ছবিটি পড়তে সমস্যা হয়েছে।'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ছবিটি লোড করা যায়নি।'));
    img.src = src;
  });
}

function drawScaledJpeg(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): { dataUrl: string; bytes: number; width: number; height: number } {
  let width = img.naturalWidth || img.width || 1;
  let height = img.naturalHeight || img.height || 1;

  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDim) / width));
      width = maxDim;
    } else {
      width = Math.max(1, Math.round((width * maxDim) / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ক্যানভাস প্রস্তুত করা যায়নি।');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    dataUrl,
    bytes: estimateBase64DataUrlBytes(dataUrl),
    width,
    height,
  };
}

/**
 * Compresses an image file or dataUrl client-side:
 * - Full image: max 1800px, JPEG quality starting 0.7, stepped down so bytes < 700 KB & chars <= 900,000
 * - Thumbnail: max 240px JPEG data URL <= 10 KB
 */
export async function compressDocumentImageAndThumbnail(
  fileOrDataUrl: File | string
): Promise<CompressedDocumentImages> {
  const sourceDataUrl =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await readFileAsDataUrl(fileOrDataUrl);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const bytes = estimateBase64DataUrlBytes(sourceDataUrl);
    return {
      fullDataUrl: sourceDataUrl,
      fullBytes: bytes,
      thumbDataUrl: sourceDataUrl,
      thumbBytes: bytes,
      width: 1200,
      height: 1600,
    };
  }

  const img = await loadHtmlImage(sourceDataUrl);

  // 1. Compress full image (<= 1800px, JPEG 0.7 -> < 700 KB & <= 900,000 chars)
  const dimensionSteps = [MAX_IMAGE_DIMENSION, 1400, 1100, 850];
  const qualitySteps = [INITIAL_IMAGE_QUALITY, 0.58, 0.46, 0.36, 0.28];

  let fullResult: { dataUrl: string; bytes: number; width: number; height: number } | null = null;
  outerFull: for (const dim of dimensionSteps) {
    for (const q of qualitySteps) {
      const attempt = drawScaledJpeg(img, dim, q);
      fullResult = attempt;
      if (attempt.bytes <= MAX_FILE_BYTES && attempt.dataUrl.length <= MAX_FILE_DATA_CHARS) {
        break outerFull;
      }
    }
  }

  if (!fullResult) {
    throw new Error('ছবিটি সংকুচিত করা যায়নি।');
  }

  // 2. Compress thumbnail separately (<= 240px, <= 10 KB)
  const thumbDimSteps = [THUMB_MAX_DIMENSION, 180, 140];
  const thumbQualitySteps = [0.62, 0.5, 0.38, 0.28];

  let thumbResult: { dataUrl: string; bytes: number } | null = null;
  outerThumb: for (const dim of thumbDimSteps) {
    for (const q of thumbQualitySteps) {
      const attempt = drawScaledJpeg(img, dim, q);
      thumbResult = attempt;
      if (attempt.bytes <= MAX_THUMB_BYTES) {
        break outerThumb;
      }
    }
  }

  if (!thumbResult) {
    throw new Error('থাম্বনেইল তৈরি করা যায়নি।');
  }

  return {
    fullDataUrl: fullResult.dataUrl,
    fullBytes: fullResult.bytes,
    thumbDataUrl: thumbResult.dataUrl,
    thumbBytes: thumbResult.bytes,
    width: fullResult.width,
    height: fullResult.height,
  };
}

/**
 * Renders an upright rotated JPEG data URL via canvas for reliable A4 printing across browsers and Android WebView.
 */
export async function renderRotatedImageForPrint(
  dataUrl: string,
  rotation: 0 | 90 | 180 | 270
): Promise<string> {
  if (!rotation || typeof document === 'undefined') {
    return dataUrl;
  }
  try {
    const img = await loadHtmlImage(dataUrl);
    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    const swap = rotation === 90 || rotation === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swap ? srcH : srcW;
    canvas.height = swap ? srcW : srcH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);

    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return dataUrl;
  }
}
