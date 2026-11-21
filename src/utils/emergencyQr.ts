import qrcode from 'qrcode-generator';
import {
  EmergencyCardDoc,
  EmergencyCardSelection,
  Medicine,
  PatientProfile,
} from '../types';
import { generateShareToken, isValidShareTokenFormat, toMillisSafe } from './sharedReports';
import { toBengaliNumber } from './bengaliUtils';
import { isNativeRemindersAvailable } from '../services/nativeReminders';

export const DEFAULT_EMERGENCY_CARD_SELECTION: EmergencyCardSelection = {
  bloodGroup: true,
  allergies: true,
  conditions: true,
  contact: true,
  medicines: false, // ডিফল্ট বন্ধ — রোগী চাইলে চালু করবেন
  doctorName: false,
};

export const EMERGENCY_CARD_FIELD_LIMIT = 500;

export function generateEmergencyToken(): string {
  return generateShareToken(18); // 144-bit random => 24 base64url chars
}

export function isValidEmergencyTokenFormat(token: string): boolean {
  return isValidShareTokenFormat(token);
}

export function extractEmergencyCardTokenFromPath(pathname: string): string | null {
  if (!pathname || typeof pathname !== 'string') return null;
  const cleaned = pathname.split('?')[0].split('#')[0];
  const match = cleaned.match(/^\/e\/([A-Za-z0-9_-]{1,128})\/?$/);
  if (!match) return null;
  return match[1];
}

export function buildEmergencyCardUrl(token: string, origin?: string): string {
  const cleanOrigin = (
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  ).replace(/\/+$/g, '');
  return `${cleanOrigin}/e/${token}`;
}

export function buildEmergencyCardWhatsAppUrl(
  cardUrl: string,
  patientName: string
): string {
  const safeName = (patientName || 'রোগী').trim();
  const msg =
    `🚨 স্বাস্থ্যবন্ধু — ${safeName}-এর জরুরি কার্ড\n\n` +
    `জরুরি প্রয়োজনে নিচের লিংক বা QR স্ক্যান করে রক্তের গ্রুপ, অ্যালার্জি ও যোগাযোগ নম্বর দেখা যাবে:\n${cardUrl}\n\n` +
    `⚠️ সতর্কতা: এই লিংক যার কাছে যাবে সে নির্বাচিত জরুরি তথ্য দেখতে পাবে।`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

function clampField(value: string, maxLen = EMERGENCY_CARD_FIELD_LIMIT): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export interface BuildEmergencyCardPayloadParams {
  ownerUid: string;
  token: string;
  patient: PatientProfile;
  medicines: Medicine[];
  selection: EmergencyCardSelection;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  doctorNameOverride?: string;
}

export interface BuiltEmergencyCardPayload {
  ownerUid: string;
  token: string;
  patientName: string;
  age?: number;
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  contactName?: string;
  contactPhone?: string;
  medicines?: string;
  doctorName?: string;
  active: true;
}

/**
 * Builds the privacy-scoped emergency card document.
 * Strict privacy guarantees:
 * - Never includes home address, NID, or non-emergency personal numbers.
 * - Unchecked fields remain undefined (omitted from JSON payload).
 * - Every string field is clamped to <= 500 characters.
 */
export function buildEmergencyCardPayload(
  params: BuildEmergencyCardPayloadParams
): BuiltEmergencyCardPayload {
  const {
    ownerUid,
    token,
    patient,
    medicines,
    selection,
    emergencyContactName,
    emergencyContactPhone,
    doctorNameOverride,
  } = params;

  const payload: BuiltEmergencyCardPayload = {
    ownerUid,
    token,
    patientName: clampField(patient.name || 'রোগী'),
    active: true,
  };

  if (typeof patient.age === 'number' && Number.isFinite(patient.age) && patient.age >= 0 && patient.age <= 150) {
    payload.age = Math.round(patient.age);
  }

  if (selection.bloodGroup) {
    const bg = (patient.bloodGroup || '').trim();
    if (bg) {
      payload.bloodGroup = clampField(bg);
    }
  }

  if (selection.allergies) {
    const cleanAllergies = (patient.allergies || [])
      .map((a) => String(a || '').trim())
      .filter(Boolean);
    payload.allergies = clampField(
      cleanAllergies.length > 0 ? cleanAllergies.join(', ') : 'কোনো পরিচিত অ্যালার্জি নেই'
    );
  }

  if (selection.conditions) {
    const cleanConditions = (patient.chronicConditions || [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    payload.conditions = clampField(
      cleanConditions.length > 0 ? cleanConditions.join(', ') : 'উল্লেখ নেই'
    );
  }

  if (selection.contact) {
    const rawPhone = (patient.emergencyContact || emergencyContactPhone || '').trim();
    const rawName = (emergencyContactName || '').trim();
    if (rawPhone) {
      payload.contactPhone = clampField(rawPhone);
    }
    if (rawName) {
      payload.contactName = clampField(rawName);
    }
  }

  if (selection.medicines) {
    const activeMeds = medicines
      .filter((m) => m.status === 'active' && m.assignedPatientId === patient.id)
      .map((m) => {
        const namePart = [m.brandName, m.strength].filter(Boolean).join(' ').trim();
        const firstDosage = m.schedules?.[0]?.dosage;
        const timesCount = m.schedules?.length || 0;
        const doseInfo =
          firstDosage && timesCount > 0
            ? `${firstDosage} × ${toBengaliNumber(timesCount)} বেলা`
            : m.mealTiming || '';
        return doseInfo ? `${namePart} (${doseInfo})` : namePart;
      })
      .filter(Boolean);

    payload.medicines = clampField(
      activeMeds.length > 0 ? activeMeds.join(' · ') : 'কোনো চলমান ওষুধ নেই'
    );
  }

  if (selection.doctorName) {
    const derivedDoctor =
      (doctorNameOverride || '').trim() ||
      medicines
        .find((m) => m.assignedPatientId === patient.id && m.doctorName && m.doctorName.trim())
        ?.doctorName?.trim() ||
      '';
    if (derivedDoctor) {
      payload.doctorName = clampField(derivedDoctor);
    }
  }

  return payload;
}

export function deriveSelectionFromEmergencyCard(
  card: Partial<EmergencyCardDoc> | null | undefined
): EmergencyCardSelection {
  if (!card) return { ...DEFAULT_EMERGENCY_CARD_SELECTION };
  return {
    bloodGroup: card.bloodGroup !== undefined,
    allergies: card.allergies !== undefined,
    conditions: card.conditions !== undefined,
    contact: card.contactPhone !== undefined || card.contactName !== undefined,
    medicines: card.medicines !== undefined,
    doctorName: card.doctorName !== undefined,
  };
}

export function getEmergencyIncludedSummaryLabels(
  selection: EmergencyCardSelection,
  payload?: Partial<BuiltEmergencyCardPayload | EmergencyCardDoc>
): string[] {
  const labels: string[] = ['নাম ও বয়স'];
  if (selection.bloodGroup && (!payload || payload.bloodGroup)) {
    labels.push('রক্তের গ্রুপ');
  }
  if (selection.allergies) labels.push('অ্যালার্জি');
  if (selection.conditions) labels.push('দীর্ঘমেয়াদি রোগ');
  if (selection.contact && (!payload || payload.contactPhone || payload.contactName)) {
    labels.push('জরুরি যোগাযোগ');
  }
  if (selection.medicines) labels.push('চলমান ওষুধের তালিকা');
  if (selection.doctorName && (!payload || payload.doctorName)) {
    labels.push('ডাক্তারের নাম');
  }
  return labels;
}

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

interface QrCodeExtended {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}

/**
 * Generates an offline QR matrix encoding ONLY the short /e/{token} URL.
 * Error correction level 'M' ensures quick phone scanning even on small wallet cards.
 */
export function generateQrMatrix(url: string): QrMatrix {
  const qr = qrcode(0, 'M') as unknown as QrCodeExtended;
  qr.addData(url);
  qr.make();
  const size = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) {
      row.push(Boolean(qr.isDark(r, c)));
    }
    modules.push(row);
  }
  return { size, modules };
}

export function drawQrMatrixToCanvas(
  ctx: CanvasRenderingContext2D,
  matrix: QrMatrix,
  x: number,
  y: number,
  drawSize: number,
  darkColor = '#0F172A',
  lightColor = '#FFFFFF'
): void {
  const quietModules = 2;
  const totalModules = matrix.size + quietModules * 2;
  const cell = drawSize / totalModules;

  ctx.fillStyle = lightColor;
  ctx.fillRect(x, y, drawSize, drawSize);

  ctx.fillStyle = darkColor;
  for (let r = 0; r < matrix.size; r += 1) {
    for (let c = 0; c < matrix.size; c += 1) {
      if (matrix.modules[r][c]) {
        const px = Math.floor(x + (c + quietModules) * cell);
        const py = Math.floor(y + (r + quietModules) * cell);
        const nextPx = Math.ceil(x + (c + quietModules + 1) * cell);
        const nextPy = Math.ceil(y + (r + quietModules + 1) * cell);
        ctx.fillRect(px, py, nextPx - px, nextPy - py);
      }
    }
  }
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) break;
      }
      current = word;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.length > 0) {
    const lastIdx = maxLines - 1;
    let last = lines[lastIdx];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 3) {
      last = last.slice(0, -1);
    }
    if (lines.join(' ').length < text.trim().length) {
      lines[lastIdx] = `${last}…`;
    }
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface LockScreenRenderInput {
  patientName: string;
  age?: number;
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  contactName?: string;
  contactPhone?: string;
  qrUrl: string;
}

/**
 * Renders a 1080×1920 lock-screen emergency wallpaper PNG via HTML5 Canvas.
 * Leaves top area clean for phone lock-screen clock/date and places legible
 * emergency info + scannable QR code in the lower two-thirds.
 */
export function renderLockScreenPngDataUrl(input: LockScreenRenderInput): string {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ছবি তৈরির ক্যানভাস চালু করা যায়নি।');
  }

  // Background gradient (calm deep navy so white card and red emergency badges stand out)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(0.4, '#1E1B4B');
  bgGrad.addColorStop(1, '#0B1020');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative top header text (below typical lock-screen clock zone)
  const fontFamily = '"Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FCA5A5';
  ctx.font = `700 32px ${fontFamily}`;
  ctx.fillText('জরুরি চিকিৎসা তথ্য · স্বাস্থ্যবন্ধু', width / 2, 410);

  // Main white high-contrast card
  const cardX = 64;
  const cardY = 450;
  const cardW = width - 128;
  const cardH = 1360;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Top emergency red strip inside card
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.clip();
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(cardX, cardY, cardW, 130);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 40px ${fontFamily}`;
  ctx.fillText('জরুরি পরিচয়পত্র (EMERGENCY)', cardX + 48, cardY + 80);

  // Patient name & age
  let cursorY = cardY + 210;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 54px ${fontFamily}`;
  const nameLines = wrapCanvasLines(ctx, input.patientName || 'রোগী', cardW - 310, 2);
  for (const line of nameLines) {
    ctx.fillText(line, cardX + 48, cursorY);
    cursorY += 64;
  }

  if (typeof input.age === 'number') {
    ctx.fillStyle = '#475569';
    ctx.font = `600 34px ${fontFamily}`;
    ctx.fillText(`বয়স: ${toBengaliNumber(input.age)} বছর`, cardX + 48, cursorY);
    cursorY += 48;
  }

  // Big Red Blood Group Badge on top-right of card
  if (input.bloodGroup) {
    const badgeW = 210;
    const badgeH = 156;
    const badgeX = cardX + cardW - badgeW - 44;
    const badgeY = cardY + 162;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 28);
    ctx.fillStyle = '#DC2626';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FEE2E2';
    ctx.font = `600 26px ${fontFamily}`;
    ctx.fillText('রক্তের গ্রুপ', badgeX + badgeW / 2, badgeY + 46);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 66px ${fontFamily}`;
    ctx.fillText(input.bloodGroup, badgeX + badgeW / 2, badgeY + 122);
    ctx.textAlign = 'left';
  }

  cursorY = Math.max(cursorY + 16, cardY + 355);

  // Allergies block
  if (input.allergies) {
    const boxH = 156;
    drawRoundedRect(ctx, cardX + 44, cursorY, cardW - 88, boxH, 24);
    ctx.fillStyle = '#FFF1F2';
    ctx.fill();
    ctx.strokeStyle = '#FECDD3';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#BE123C';
    ctx.font = `700 28px ${fontFamily}`;
    ctx.fillText('অ্যালার্জি', cardX + 74, cursorY + 46);

    ctx.fillStyle = '#0F172A';
    ctx.font = `600 34px ${fontFamily}`;
    const allergyLines = wrapCanvasLines(ctx, input.allergies, cardW - 148, 2);
    let ly = cursorY + 94;
    for (const l of allergyLines) {
      ctx.fillText(l, cardX + 74, ly);
      ly += 42;
    }
    cursorY += boxH + 24;
  }

  // Chronic conditions block (if space allows)
  if (input.conditions) {
    const boxH = 132;
    drawRoundedRect(ctx, cardX + 44, cursorY, cardW - 88, boxH, 24);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = `700 26px ${fontFamily}`;
    ctx.fillText('দীর্ঘমেয়াদি রোগ', cardX + 74, cursorY + 44);

    ctx.fillStyle = '#0F172A';
    ctx.font = `600 32px ${fontFamily}`;
    const condLines = wrapCanvasLines(ctx, input.conditions, cardW - 148, 2);
    let cy = cursorY + 88;
    for (const l of condLines) {
      ctx.fillText(l, cardX + 74, cy);
      cy += 38;
    }
    cursorY += boxH + 24;
  }

  // Emergency Phone Banner
  if (input.contactPhone || input.contactName) {
    const boxH = 140;
    drawRoundedRect(ctx, cardX + 44, cursorY, cardW - 88, boxH, 24);
    ctx.fillStyle = '#EEF2FF';
    ctx.fill();
    ctx.strokeStyle = '#C7D2FE';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#3730A3';
    ctx.font = `700 28px ${fontFamily}`;
    const label = input.contactName
      ? `জরুরি যোগাযোগ (${input.contactName})`
      : 'জরুরি যোগাযোগ নম্বর';
    ctx.fillText(label, cardX + 74, cursorY + 46);

    ctx.fillStyle = '#0F172A';
    ctx.font = `800 48px ${fontFamily}`;
    ctx.fillText(input.contactPhone || 'দেওয়া নেই', cardX + 74, cursorY + 108);
    cursorY += boxH + 28;
  }

  // QR Box pinned cleanly at bottom of white card
  const qrBoxSize = 420;
  const qrX = width / 2 - qrBoxSize / 2;
  const qrY = Math.max(cursorY + 12, cardY + cardH - qrBoxSize - 130);
  drawRoundedRect(ctx, qrX - 24, qrY - 24, qrBoxSize + 48, qrBoxSize + 48, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 3;
  ctx.stroke();

  const matrix = generateQrMatrix(input.qrUrl);
  drawQrMatrixToCanvas(ctx, matrix, qrX, qrY, qrBoxSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = `700 30px ${fontFamily}`;
  ctx.fillText('স্ক্যান করে বিস্তারিত জরুরি তথ্য দেখুন', width / 2, qrY + qrBoxSize + 68);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 24px ${fontFamily}`;
  ctx.fillText('জরুরি তথ্য, রোগীর দেওয়া · স্বাস্থ্যবন্ধু', width / 2, height - 56);

  return canvas.toDataURL('image/png');
}

export function isAndroidApkWebView(): boolean {
  if (isNativeRemindersAvailable()) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /\bwv\b/i.test(ua) || (/Android/i.test(ua) && /Version\/\d/i.test(ua));
}

/**
 * Attempts direct PNG download on standard browsers.
 * Inside Android APK WebView (where <a download="...data:"> can fail), returns isWebView=true
 * so the UI displays the PNG preview with long-press save instructions.
 */
export function triggerLockScreenPngDownload(
  dataUrl: string,
  filename: string
): { triggeredDownload: boolean; isWebView: boolean } {
  const isWebView = isAndroidApkWebView();
  if (isWebView) {
    return { triggeredDownload: false, isWebView: true };
  }

  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { triggeredDownload: true, isWebView: false };
  } catch {
    return { triggeredDownload: false, isWebView: false };
  }
}

export function formatEmergencyCardCreatedDate(card: Pick<EmergencyCardDoc, 'createdAt' | 'createdAtMs'>): string {
  const ms = card.createdAtMs || toMillisSafe(card.createdAt);
  if (!ms) return 'সদ্য তৈরি';
  const d = new Date(ms);
  const dd = toBengaliNumber(String(d.getDate()).padStart(2, '0'));
  const mm = toBengaliNumber(String(d.getMonth() + 1).padStart(2, '0'));
  const yyyy = toBengaliNumber(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
