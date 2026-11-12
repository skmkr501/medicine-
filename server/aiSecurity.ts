import crypto from 'node:crypto';

export const UNAUTH_ERROR_MSG = 'লগইন করে আবার চেষ্টা করুন';
export const FORBIDDEN_ADMIN_MSG = 'অননুমোদিত: শুধুমাত্র অ্যাডমিন এই তথ্য দেখতে পারবেন।';
export const RATE_LIMIT_TOTAL_MSG =
  'প্রতি ঘণ্টায় সর্বোচ্চ ৩০টি AI অনুরোধ করা যাবে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
export const RATE_LIMIT_SCAN_MSG =
  'প্রতি ঘণ্টায় সর্বোচ্চ ১০টি ছবি স্ক্যান করা যাবে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';

export const MAX_AI_REQUESTS_PER_HOUR = 30;
export const MAX_SCAN_REQUESTS_PER_HOUR = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const ADMIN_EMAIL = 'sarashatikmkr501@gmail.com';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
  lastFetchMs: number;
}

let certCache: CertCache | null = null;

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && now < certCache.expiresAtMs) {
    return certCache.certs;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) {
    if (certCache) {
      return certCache.certs;
    }
    throw new Error(`Failed to load Google public certs (HTTP ${response.status})`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const maxAgeSec = parseMaxAgeSeconds(response.headers.get('cache-control'));
  certCache = {
    certs,
    expiresAtMs: now + maxAgeSec * 1000,
    lastFetchMs: now,
  };
  return certs;
}

export function extractBearerToken(authHeader?: string | string[]): string | null {
  if (!authHeader || Array.isArray(authHeader)) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  if (!token || token.length > 16384) return null;
  return token;
}

function decodeBase64UrlJson(segment: string): Record<string, any> {
  const jsonStr = Buffer.from(segment, 'base64url').toString('utf8');
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JWT segment object');
  }
  return parsed;
}

/**
 * Verifies a Firebase Auth ID Token following Google's official JWT verification spec:
 * - Algorithm === RS256 and valid key ID (kid)
 * - Cryptographic RS256 signature verification against Google's official x509 public certs
 * - Claims validation: exp, iat, auth_time, aud === projectId, iss === https://securetoken.google.com/<projectId>, sub
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  options?: {
    certsOverride?: Record<string, string>;
    nowSeconds?: number;
  }
): Promise<VerifiedFirebaseUser> {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing ID token');
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new Error('Malformed JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Invalid JWT header');
  }

  const now = options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('Token expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) {
    throw new Error('Token issued in the future');
  }
  if (typeof payload.auth_time !== 'number' || payload.auth_time > now + 300) {
    throw new Error('Invalid auth_time');
  }
  if (payload.aud !== projectId) {
    throw new Error('Invalid audience');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid issuer');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new Error('Invalid subject');
  }

  let certPem: string | undefined;
  if (options?.certsOverride) {
    certPem = options.certsOverride[header.kid];
  } else {
    let certs = await fetchGooglePublicCerts(false);
    certPem = certs[header.kid];
    if (!certPem && (!certCache || Date.now() - certCache.lastFetchMs > 30_000)) {
      certs = await fetchGooglePublicCerts(true);
      certPem = certs[header.kid];
    }
  }

  if (!certPem) {
    throw new Error('Unknown signing key');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBuffer = Buffer.from(signatureB64, 'base64url');
  if (!verifier.verify(certPem, signatureBuffer)) {
    throw new Error('Invalid signature');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: Boolean(payload.email_verified),
  };
}

export function isVerifiedAdmin(user: VerifiedFirebaseUser): boolean {
  return Boolean(
    user.email &&
      user.emailVerified &&
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Per-user sliding window rate limiter:
 * - Max 30 total AI requests per hour per uid
 * - Max 10 prescription scan requests per hour per uid
 */
export class UserAiRateLimiter {
  private totalHits = new Map<string, number[]>();
  private scanHits = new Map<string, number[]>();

  private pruneWindow(timestamps: number[], cutoffMs: number): number[] {
    let idx = 0;
    while (idx < timestamps.length && timestamps[idx] <= cutoffMs) {
      idx++;
    }
    return idx > 0 ? timestamps.slice(idx) : timestamps;
  }

  private pruneStaleUsers(cutoffMs: number): void {
    if (this.totalHits.size < 500 && this.scanHits.size < 500) return;
    for (const [uid, list] of this.totalHits.entries()) {
      const pruned = this.pruneWindow(list, cutoffMs);
      if (pruned.length === 0) this.totalHits.delete(uid);
      else this.totalHits.set(uid, pruned);
    }
    for (const [uid, list] of this.scanHits.entries()) {
      const pruned = this.pruneWindow(list, cutoffMs);
      if (pruned.length === 0) this.scanHits.delete(uid);
      else this.scanHits.set(uid, pruned);
    }
  }

  checkAndConsume(
    uid: string,
    isScan: boolean,
    nowMs: number = Date.now()
  ):
    | { allowed: true; remainingTotal: number; remainingScan: number }
    | { allowed: false; status: 429; message: string; retryAfterSeconds: number } {
    const cutoff = nowMs - RATE_LIMIT_WINDOW_MS;
    this.pruneStaleUsers(cutoff);

    const userTotal = this.pruneWindow(this.totalHits.get(uid) || [], cutoff);
    const userScans = this.pruneWindow(this.scanHits.get(uid) || [], cutoff);

    if (isScan && userScans.length >= MAX_SCAN_REQUESTS_PER_HOUR) {
      const oldestMs = userScans[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + RATE_LIMIT_WINDOW_MS - nowMs) / 1000));
      this.totalHits.set(uid, userTotal);
      this.scanHits.set(uid, userScans);
      return {
        allowed: false,
        status: 429,
        message: RATE_LIMIT_SCAN_MSG,
        retryAfterSeconds,
      };
    }

    if (userTotal.length >= MAX_AI_REQUESTS_PER_HOUR) {
      const oldestMs = userTotal[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + RATE_LIMIT_WINDOW_MS - nowMs) / 1000));
      this.totalHits.set(uid, userTotal);
      this.scanHits.set(uid, userScans);
      return {
        allowed: false,
        status: 429,
        message: RATE_LIMIT_TOTAL_MSG,
        retryAfterSeconds,
      };
    }

    userTotal.push(nowMs);
    this.totalHits.set(uid, userTotal);

    if (isScan) {
      userScans.push(nowMs);
      this.scanHits.set(uid, userScans);
    } else if (userScans.length > 0) {
      this.scanHits.set(uid, userScans);
    }

    return {
      allowed: true,
      remainingTotal: MAX_AI_REQUESTS_PER_HOUR - userTotal.length,
      remainingScan: MAX_SCAN_REQUESTS_PER_HOUR - userScans.length,
    };
  }
}

/**
 * Sanitizes server error messages so secrets, base64 images, and user prescription text
 * are never written to server logs.
 */
export function sanitizeServerLogMessage(
  rawMsg: string,
  sensitiveSnippets: string[] = []
): string {
  if (!rawMsg) return '';
  let sanitized = String(rawMsg)
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=_-]+/gi, '[REDACTED_IMAGE]')
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, '[REDACTED_BLOB]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');

  for (const snippet of sensitiveSnippets) {
    const clean = typeof snippet === 'string' ? snippet.trim() : '';
    if (clean.length >= 3) {
      sanitized = sanitized.split(clean).join('[REDACTED_INPUT]');
    }
  }

  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  if (sanitized.length > 160) {
    sanitized = sanitized.slice(0, 157) + '...';
  }
  return sanitized;
}

export function formatSafeAiErrorLog(
  route: string,
  status: number | null,
  error: any,
  sensitiveSnippets: string[] = []
): string {
  const errName = typeof error?.name === 'string' ? error.name : 'Error';
  const safeReason = sanitizeServerLogMessage(
    typeof error?.message === 'string' ? error.message : String(error || ''),
    sensitiveSnippets
  );
  return `[AI Error] route=${route} status=${status ?? 'unknown'} type=${errName}${safeReason ? ` reason="${safeReason}"` : ''}`;
}
