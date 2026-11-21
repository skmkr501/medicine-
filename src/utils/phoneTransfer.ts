import {
  DoctorAppointment,
  DoctorProfile,
  DoseLog,
  HealthRecord,
  Medicine,
  PatientProfile,
  PhonebookEntry,
  ReminderSettings,
} from '../types';

export const MAX_TRANSFER_PLAINTEXT_BYTES = 1_200_000;
export const MAX_TRANSFER_CIPHERTEXT_CHARS = 1_400_000;
export const TRANSFER_TTL_MS = 10 * 60 * 1000; // 10 minutes (DB cap: 11m)

export interface PhoneTransferBundle {
  version: 1;
  exportedAt: string;
  medicines: Medicine[];
  patients: PatientProfile[];
  doseLogs: DoseLog[];
  doctors: DoctorProfile[];
  phonebook: PhonebookEntry[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  settings: ReminderSettings;
}

export interface EncryptedTransferOutput {
  ciphertext: string;
  keyB64: string;
  rawBytes: number;
  gzipBytes: number;
}

export function isTransferCryptoSupported(): boolean {
  return Boolean(
    typeof globalThis.crypto !== 'undefined' &&
      globalThis.crypto.subtle &&
      typeof CompressionStream === 'function' &&
      typeof DecompressionStream === 'function'
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  return uint8ToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8(b64u: string): Uint8Array {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return base64ToUint8(padded + '='.repeat(padLen));
}

function toStrictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toStrictArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toStrictArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export function buildPhoneTransferBundle(input: {
  medicines: Medicine[];
  patients: PatientProfile[];
  doseLogs: DoseLog[];
  doctors: DoctorProfile[];
  phonebook: PhonebookEntry[];
  healthRecords: HealthRecord[];
  appointments: DoctorAppointment[];
  settings: ReminderSettings;
}): PhoneTransferBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    medicines: input.medicines,
    patients: input.patients,
    doseLogs: input.doseLogs,
    doctors: input.doctors,
    phonebook: input.phonebook,
    healthRecords: input.healthRecords,
    appointments: input.appointments,
    settings: input.settings,
  };
}

export async function encryptAndCompressTransferPayload(
  bundle: PhoneTransferBundle
): Promise<EncryptedTransferOutput> {
  if (!isTransferCryptoSupported()) {
    throw new Error('এই ব্রাউজারে এনক্রিপ্টেড ট্রান্সফার সমর্থিত নয় — অনুগ্রহ করে JSON ব্যাকআপ ডাউনলোড করুন।');
  }

  const jsonStr = JSON.stringify(bundle);
  const rawBytesArr = new TextEncoder().encode(jsonStr);
  if (rawBytesArr.byteLength > MAX_TRANSFER_PLAINTEXT_BYTES) {
    throw new Error('আপনার ডেটার আকার QR ট্রান্সফারের সীমার (১.২ এমবি) চেয়ে বড়। অনুগ্রহ করে JSON ব্যাকআপ ডাউনলোড ব্যবহার করুন।');
  }

  const gzipped = await gzipCompress(rawBytesArr);
  const cryptoKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawKey = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', cryptoKey));
  const keyB64 = uint8ToBase64Url(rawKey);

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toStrictArrayBuffer(iv) },
    cryptoKey,
    toStrictArrayBuffer(gzipped)
  );
  const encryptedBytes = new Uint8Array(encryptedBuf);

  const packed = new Uint8Array(iv.length + encryptedBytes.length);
  packed.set(iv, 0);
  packed.set(encryptedBytes, iv.length);

  const ciphertext = uint8ToBase64(packed);
  if (ciphertext.length > MAX_TRANSFER_CIPHERTEXT_CHARS) {
    throw new Error('এনক্রিপ্টেড ডেটা সীমা ছাড়িয়ে গেছে। অনুগ্রহ করে JSON ব্যাকআপ ডাউনলোড ব্যবহার করুন।');
  }

  return {
    ciphertext,
    keyB64,
    rawBytes: rawBytesArr.byteLength,
    gzipBytes: gzipped.byteLength,
  };
}

export async function decryptAndDecompressTransferPayload(
  ciphertext: string,
  keyB64: string
): Promise<PhoneTransferBundle> {
  if (!isTransferCryptoSupported()) {
    throw new Error('এই ব্রাউজারে ডিক্রিপশন সমর্থিত নয় — JSON ব্যাকআপ ফাইল ব্যবহার করুন।');
  }
  const packed = base64ToUint8(ciphertext.trim());
  if (packed.length <= 12) {
    throw new Error('ট্রান্সফার ডেটা অসম্পূর্ণ বা নষ্ট হয়ে গেছে।');
  }

  const iv = packed.subarray(0, 12);
  const encryptedBytes = packed.subarray(12);
  const rawKey = base64UrlToUint8(keyB64.trim());
  if (rawKey.length !== 32) {
    throw new Error('ট্রান্সফার এনক্রিপশন চাবিটি সঠিক নয়।');
  }

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    toStrictArrayBuffer(rawKey),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  let decryptedBuf: ArrayBuffer;
  try {
    decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toStrictArrayBuffer(iv) },
      cryptoKey,
      toStrictArrayBuffer(encryptedBytes)
    );
  } catch {
    throw new Error('এনক্রিপশন চাবি মেলেনি বা ডেটা পরিবর্তন করা হয়েছে।');
  }

  const decompressed = await gzipDecompress(new Uint8Array(decryptedBuf));
  const jsonText = new TextDecoder().decode(decompressed);
  const parsed = JSON.parse(jsonText) as PhoneTransferBundle;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.medicines)) {
    throw new Error('প্রাপ্ত ট্রান্সফার ডেটার গঠন সঠিক নয়।');
  }
  return parsed;
}

export function buildTransferUrl(id: string, keyB64: string, origin?: string): string {
  const cleanOrigin = (
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  ).replace(/\/+$/g, '');
  return `${cleanOrigin}/#/transfer?id=${encodeURIComponent(id)}&k=${encodeURIComponent(keyB64)}`;
}

export function buildTransferManualCode(id: string, keyB64: string): string {
  return `${id}.${keyB64}`;
}

export function parseTransferInput(rawInput: string): { id: string; keyB64: string } | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  // 1. URL or hash fragment (#/transfer?id=...&k=...)
  const hashIdx = trimmed.indexOf('#');
  const candidateQuerySource = hashIdx >= 0 ? trimmed.slice(hashIdx + 1) : trimmed;
  if (candidateQuerySource.includes('id=') && candidateQuerySource.includes('k=')) {
    const queryIdx = candidateQuerySource.indexOf('?');
    const queryStr = queryIdx >= 0 ? candidateQuerySource.slice(queryIdx + 1) : candidateQuerySource;
    const params = new URLSearchParams(queryStr);
    const id = (params.get('id') || '').trim();
    const keyB64 = (params.get('k') || '').trim();
    if (isValidUuidLike(id) && keyB64.length >= 20) {
      return { id, keyB64 };
    }
  }

  // 2. Manual compact code `<uuid>.<keyB64>`
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx > 0) {
    const id = trimmed.slice(0, dotIdx).trim();
    const keyB64 = trimmed.slice(dotIdx + 1).trim();
    if (isValidUuidLike(id) && keyB64.length >= 20) {
      return { id, keyB64 };
    }
  }

  return null;
}

function isValidUuidLike(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}
