export const APP_LOCK_STORAGE_KEY = 'shasthobondhu_app_lock_v1';
export const APP_LOCK_INACTIVITY_MS = 30_000;
export const APP_LOCK_MAX_FREE_ATTEMPTS = 5;

const BN_DIGIT_MAP: Record<string, string> = {
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

export interface AppLockConfig {
  enabled: boolean;
  pinHashHex: string;
  saltHex: string;
  pinLength: number;
  failedAttempts: number;
  lockedUntilMs: number;
  webAuthnEnabled?: boolean;
  webAuthnCredentialIdB64?: string;
  updatedAtMs: number;
}

export interface SimpleStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function resolveStorage(storage?: SimpleStorage | null): SimpleStorage | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Normalizes Bengali digits (০-৯) to ASCII 0-9 and strips non-digits.
 */
export function normalizePinDigits(raw: string): string {
  return String(raw || '')
    .replace(/[০-৯]/g, (ch) => BN_DIGIT_MAP[ch] || ch)
    .replace(/[^0-9]/g, '');
}

export function validatePinFormat(raw: string): {
  valid: boolean;
  normalized: string;
  errorBn?: string;
} {
  const normalized = normalizePinDigits(raw);
  if (normalized.length < 4 || normalized.length > 6) {
    return {
      valid: false,
      normalized,
      errorBn: 'পিন অবশ্যই ৪ থেকে ৬ সংখ্যার হতে হবে',
    };
  }
  return { valid: true, normalized };
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return arr;
}

export function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * Derives salted PBKDF2-HMAC-SHA256 hash in hex (never stores plaintext PIN).
 */
export async function hashPinWithSalt(pin: string, saltHex: string): Promise<string> {
  const normalized = normalizePinDigits(pin);
  const subtle = globalThis.crypto?.subtle;
  const encoder = new TextEncoder();

  if (subtle) {
    const keyMaterial = await subtle.importKey(
      'raw',
      encoder.encode(normalized),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: hexToBytes(saltHex) as BufferSource,
        iterations: 50_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return bytesToHex(new Uint8Array(derivedBits));
  }

  // Deterministic JS fallback only if subtle is unavailable in a restricted test runner
  const data = encoder.encode(`${saltHex}:${normalized}:sb_lock`);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let round = 0; round < 1024; round += 1) {
    for (let i = 0; i < data.length; i += 1) {
      h1 ^= data[i] ^ (round & 0xff);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = (Math.imul(h2 ^ data[i], 0x85ebca6b) + round) >>> 0;
    }
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function loadAppLockConfig(storage?: SimpleStorage | null): AppLockConfig | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(APP_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.enabled ||
      typeof parsed.pinHashHex !== 'string' ||
      typeof parsed.saltHex !== 'string'
    ) {
      return null;
    }
    return {
      enabled: Boolean(parsed.enabled),
      pinHashHex: parsed.pinHashHex,
      saltHex: parsed.saltHex,
      pinLength: typeof parsed.pinLength === 'number' ? parsed.pinLength : 4,
      failedAttempts: typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0,
      lockedUntilMs: typeof parsed.lockedUntilMs === 'number' ? parsed.lockedUntilMs : 0,
      webAuthnEnabled: Boolean(parsed.webAuthnEnabled),
      webAuthnCredentialIdB64:
        typeof parsed.webAuthnCredentialIdB64 === 'string'
          ? parsed.webAuthnCredentialIdB64
          : undefined,
      updatedAtMs: typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveAppLockConfig(
  config: AppLockConfig,
  storage?: SimpleStorage | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota errors
  }
}

export function clearAppLockConfig(storage?: SimpleStorage | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(APP_LOCK_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function enableAppLockWithPin(
  pin: string,
  options?: {
    webAuthnEnabled?: boolean;
    webAuthnCredentialIdB64?: string;
    storage?: SimpleStorage | null;
  }
): Promise<AppLockConfig> {
  const check = validatePinFormat(pin);
  if (!check.valid) {
    throw new Error(check.errorBn || 'অবৈধ পিন');
  }
  const saltHex = generateSaltHex(16);
  const pinHashHex = await hashPinWithSalt(check.normalized, saltHex);
  const config: AppLockConfig = {
    enabled: true,
    pinHashHex,
    saltHex,
    pinLength: check.normalized.length,
    failedAttempts: 0,
    lockedUntilMs: 0,
    webAuthnEnabled: Boolean(options?.webAuthnEnabled),
    webAuthnCredentialIdB64: options?.webAuthnCredentialIdB64,
    updatedAtMs: Date.now(),
  };
  saveAppLockConfig(config, options?.storage);
  return config;
}

/**
 * Escalating cooldown after 5 wrong attempts:
 * 5th = 30s, 6th = 60s, 7th = 120s, 8th = 240s, capped at 900s (15m).
 */
export function computeLockoutSeconds(failedAttempts: number): number {
  if (failedAttempts < APP_LOCK_MAX_FREE_ATTEMPTS) return 0;
  const exponent = Math.min(5, failedAttempts - APP_LOCK_MAX_FREE_ATTEMPTS);
  return Math.min(900, 30 * Math.pow(2, exponent));
}

export function getRemainingLockoutSeconds(
  config: AppLockConfig | null,
  nowMs: number = Date.now()
): number {
  if (!config || !config.lockedUntilMs) return 0;
  const diff = config.lockedUntilMs - nowMs;
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export async function verifyAppLockPin(
  rawPin: string,
  options?: { nowMs?: number; storage?: SimpleStorage | null }
): Promise<{
  ok: boolean;
  lockedSeconds: number;
  failedAttempts: number;
  updatedConfig: AppLockConfig | null;
}> {
  const nowMs = options?.nowMs ?? Date.now();
  const config = loadAppLockConfig(options?.storage);
  if (!config || !config.enabled) {
    return { ok: true, lockedSeconds: 0, failedAttempts: 0, updatedConfig: null };
  }

  const remainingLock = getRemainingLockoutSeconds(config, nowMs);
  if (remainingLock > 0) {
    return {
      ok: false,
      lockedSeconds: remainingLock,
      failedAttempts: config.failedAttempts,
      updatedConfig: config,
    };
  }

  const normalized = normalizePinDigits(rawPin);
  const candidateHash = await hashPinWithSalt(normalized, config.saltHex);

  if (constantTimeHexEqual(candidateHash, config.pinHashHex)) {
    const resetConfig: AppLockConfig = {
      ...config,
      failedAttempts: 0,
      lockedUntilMs: 0,
      updatedAtMs: nowMs,
    };
    saveAppLockConfig(resetConfig, options?.storage);
    return {
      ok: true,
      lockedSeconds: 0,
      failedAttempts: 0,
      updatedConfig: resetConfig,
    };
  }

  const nextFailures = (config.failedAttempts || 0) + 1;
  const cooldownSec = computeLockoutSeconds(nextFailures);
  const nextLockedUntil = cooldownSec > 0 ? nowMs + cooldownSec * 1000 : 0;
  const failedConfig: AppLockConfig = {
    ...config,
    failedAttempts: nextFailures,
    lockedUntilMs: nextLockedUntil,
    updatedAtMs: nowMs,
  };
  saveAppLockConfig(failedConfig, options?.storage);
  return {
    ok: false,
    lockedSeconds: cooldownSec,
    failedAttempts: nextFailures,
    updatedConfig: failedConfig,
  };
}

export function shouldLockAfterBackground(
  backgroundedAtMs: number | null,
  resumedAtMs: number = Date.now(),
  thresholdMs: number = APP_LOCK_INACTIVITY_MS
): boolean {
  if (!backgroundedAtMs || !Number.isFinite(backgroundedAtMs)) return false;
  return resumedAtMs - backgroundedAtMs > thresholdMs;
}

// =========================================================================
// Optional WebAuthn Biometric Unlock (only if browser & device support it)
// =========================================================================

function bufferToB64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64UrlToUint8Array(b64url: string): Uint8Array {
  const padLen = (4 - (b64url.length % 4)) % 4;
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window === 'undefined' ||
      !window.isSecureContext ||
      typeof window.PublicKeyCredential === 'undefined' ||
      typeof navigator?.credentials?.create !== 'function' ||
      typeof navigator?.credentials?.get !== 'function'
    ) {
      return false;
    }
    if (
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

export async function registerPlatformBiometricCredential(): Promise<string | null> {
  try {
    const supported = await isPlatformBiometricAvailable();
    if (!supported) return null;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'স্বাস্থ্যবন্ধু' },
        user: {
          id: userId,
          name: 'local-app-lock',
          displayName: 'স্বাস্থ্যবন্ধু ব্যবহারকারী',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!cred || !cred.rawId) return null;
    return bufferToB64Url(cred.rawId);
  } catch {
    return null;
  }
}

export async function verifyPlatformBiometric(credentialIdB64: string): Promise<boolean> {
  try {
    if (!credentialIdB64) return false;
    const supported = await isPlatformBiometricAvailable();
    if (!supported) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            type: 'public-key',
            id: b64UrlToUint8Array(credentialIdB64) as BufferSource,
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    });

    return Boolean(assertion);
  } catch {
    return false;
  }
}
