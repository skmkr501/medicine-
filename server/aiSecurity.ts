import { createClient } from '@supabase/supabase-js';

export const UNAUTH_ERROR_MSG = 'লগইন করে আবার চেষ্টা করুন';
export const FORBIDDEN_ADMIN_MSG = 'অননুমোদিত: শুধুমাত্র অ্যাডমিন এই তথ্য দেখতে পারবেন।';
export const RATE_LIMIT_TOTAL_MSG =
  'প্রতি ঘণ্টায় সর্বোচ্চ ৩০টি AI অনুরোধ করা যাবে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
export const RATE_LIMIT_SCAN_MSG =
  'প্রতি ঘণ্টায় সর্বোচ্চ ১০টি ছবি স্ক্যান করা যাবে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';

export const MAX_AI_REQUESTS_PER_HOUR = 30;
export const MAX_SCAN_REQUESTS_PER_HOUR = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const DEFAULT_SUPABASE_URL = 'https://fpseqtfzxwlceqjxkmke.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_vVL1acuDgJgJeyweEEQndQ__dSrPqRC';

export interface VerifiedSupabaseUser {
  id: string;
  email?: string;
}

export function extractBearerToken(authHeader?: string | string[]): string | null {
  if (!authHeader || Array.isArray(authHeader)) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  if (!token || token.length > 16384) return null;
  return token;
}

export async function verifySupabaseAccessToken(
  token: string,
  options?: {
    supabaseUrl?: string;
    supabasePublishableKey?: string;
    clientOverride?: {
      auth: {
        getUser: (
          jwt?: string
        ) => Promise<{
          data: { user: { id: string; email?: string | null } | null };
          error: unknown;
        }>;
      };
    };
  }
): Promise<VerifiedSupabaseUser> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Missing access token');
  }

  const supabaseUrl = options?.supabaseUrl || DEFAULT_SUPABASE_URL;
  const supabaseKey = options?.supabasePublishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  const client =
    options?.clientOverride ||
    createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error('Invalid or expired Supabase access token');
  }

  return {
    id: data.user.id,
    email: typeof data.user.email === 'string' ? data.user.email : undefined,
  };
}

export async function checkSupabaseAdminRpc(
  token: string,
  options?: {
    supabaseUrl?: string;
    supabasePublishableKey?: string;
    clientOverride?: {
      rpc: (fnName: string) => Promise<{ data: unknown; error: unknown }>;
    };
  }
): Promise<boolean> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return false;
  }

  const supabaseUrl = options?.supabaseUrl || DEFAULT_SUPABASE_URL;
  const supabaseKey = options?.supabasePublishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  const client =
    options?.clientOverride ||
    createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

  const { data, error } = await client.rpc('is_admin');
  return !error && data === true;
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
  sensitiveSnippets: string[] = [],
  model?: string
): string {
  const errName = typeof error?.name === 'string' ? error.name : 'Error';
  const safeReason = sanitizeServerLogMessage(
    typeof error?.message === 'string' ? error.message : String(error || ''),
    sensitiveSnippets
  );
  const modelPart = model ? ` model=${sanitizeServerLogMessage(model).slice(0, 64)}` : '';
  return `[AI Error] route=${route} status=${status ?? 'unknown'}${modelPart} type=${errName}${safeReason ? ` reason="${safeReason}"` : ''}`;
}

export type AiErrorCode =
  | 'model_not_found'
  | 'invalid_key'
  | 'quota'
  | 'overloaded'
  | 'timeout'
  | 'bad_response'
  | 'unauthenticated'
  | 'rate_limited';

export function normalizeGeminiModelName(name: string): string {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/^models\//i, '');
}

export function filterAvailableFlashProModels(rawNames: string[], limit = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawNames) {
    const clean = normalizeGeminiModelName(raw);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!lower.includes('flash') && !lower.includes('pro')) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

export function pickFallbackFlashModel(
  availableModels: string[],
  primaryModel: string,
  envFallback?: string
): string | null {
  const explicit = normalizeGeminiModelName(envFallback || '');
  if (explicit) {
    return explicit;
  }

  const normalizedPrimary = normalizeGeminiModelName(primaryModel).toLowerCase();
  const flashCandidates = availableModels
    .map((m) => normalizeGeminiModelName(m))
    .filter((m) => {
      const lower = m.toLowerCase();
      return (
        lower.includes('flash') &&
        lower !== normalizedPrimary &&
        !lower.includes('1.5') &&
        !lower.includes('2.0')
      );
    });

  const preferredGeneralFlash = flashCandidates.find((m) => {
    const lower = m.toLowerCase();
    return (
      !lower.includes('-tts') &&
      !lower.includes('-image') &&
      !lower.includes('-audio') &&
      !lower.includes('live') &&
      !lower.includes('embedding')
    );
  });

  if (preferredGeneralFlash) return preferredGeneralFlash;
  if (flashCandidates.length > 0) return flashCandidates[0];

  const anyFlash = availableModels
    .map((m) => normalizeGeminiModelName(m))
    .find((m) => {
      const lower = m.toLowerCase();
      return lower.includes('flash') && lower !== normalizedPrimary;
    });

  return anyFlash || null;
}

export function extractGeminiErrorStatus(error: any): number | null {
  if (!error) return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.statusCode === 'number') return error.statusCode;
  if (typeof error.code === 'number') return error.code;
  if (typeof error.response?.status === 'number') return error.response.status;
  if (typeof error.error?.code === 'number') return error.error.code;
  if (typeof error.error?.status === 'number') return error.error.status;

  const msg = String(error.message || error || '');
  const lower = msg.toLowerCase();

  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return 401;
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('404') || msg.includes('NOT_FOUND')) return 404;
  if (msg.includes('504') || msg.includes('DEADLINE_EXCEEDED') || lower.includes('timed out') || lower.includes('timeout')) {
    return 504;
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || lower.includes('overloaded') || lower.includes('high demand')) {
    return 503;
  }
  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) return 400;

  return null;
}

export function isModelNotFoundError(error: any): boolean {
  const status = extractGeminiErrorStatus(error);
  const msg = String(error?.message || error || '');
  const lower = msg.toLowerCase();

  if (status === 404 || msg.includes('NOT_FOUND')) {
    return true;
  }

  const mentionsInvalidModel =
    lower.includes('invalid model') ||
    lower.includes('model not found') ||
    lower.includes('unknown model') ||
    lower.includes('is not found for api version') ||
    lower.includes('not supported for generatecontent') ||
    (lower.includes('model') && (lower.includes('invalid') || lower.includes('unsupported') || lower.includes('does not exist')));

  if ((status === 400 || msg.includes('INVALID_ARGUMENT')) && mentionsInvalidModel) {
    return true;
  }

  return false;
}

export function isTransientAiError(error: any): boolean {
  if (!error) return false;
  const status = extractGeminiErrorStatus(error);
  if (status === 401 || status === 403 || status === 404) {
    return false;
  }
  if (status === 400 && !isModelNotFoundError(error)) {
    return false;
  }
  if (status === 503 || status === 429 || status === 500 || status === 504) {
    return true;
  }

  const msg = String(error?.message || error || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('resource_exhausted')
  );
}

export const DEFAULT_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;
export const PRIMARY_RETRY_DELAYS_MS = [1200, 3000] as const;
export const FALLBACK_RETRY_DELAY_MS = 1500;

export function buildFallbackModelChain(options: {
  primaryModel: string;
  envFallbackModel?: string | null;
  pickedModel?: string | null;
  extraFallbacks?: readonly string[];
}): string[] {
  const normalizedPrimary = normalizeGeminiModelName(options.primaryModel).toLowerCase();
  const seen = new Set<string>();
  const chain: string[] = [];

  const rawCandidates = [
    options.envFallbackModel || '',
    options.pickedModel || '',
    ...(options.extraFallbacks ?? DEFAULT_FALLBACK_MODELS),
  ];

  for (const raw of rawCandidates) {
    const clean = normalizeGeminiModelName(raw);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (lower === normalizedPrimary || seen.has(lower)) continue;
    seen.add(lower);
    chain.push(clean);
  }

  return chain;
}

function attachAttemptedModel(error: unknown, modelName: string): any {
  if (error && typeof error === 'object') {
    try {
      (error as any).attemptedModel = modelName;
    } catch {
      // Ignore frozen error objects
    }
    return error;
  }
  const wrapped: any = new Error(String(error || 'AI error'));
  wrapped.attemptedModel = modelName;
  return wrapped;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface ExecuteWithModelFallbackOptions<T> {
  endpoint: string;
  primaryModel: string;
  envFallbackModel?: string;
  hasApiKey: boolean;
  listAvailableModels: () => Promise<string[]>;
  invoke: (modelName: string) => Promise<T>;
  sleep?: (ms: number) => Promise<void>;
  onLog?: (level: 'warn' | 'info', message: string) => void;
}

export async function executeWithModelFallback<T>(
  options: ExecuteWithModelFallbackOptions<T>
): Promise<{ result: T; modelUsed: string; usedFallback: boolean }> {
  const {
    endpoint,
    primaryModel,
    envFallbackModel,
    hasApiKey,
    listAvailableModels,
    invoke,
    sleep = defaultSleep,
    onLog,
  } = options;

  if (!hasApiKey) {
    const keyErr: any = new Error('GEMINI_API_KEY is missing from environment variables.');
    keyErr.status = 401;
    keyErr.attemptedModel = primaryModel;
    throw keyErr;
  }

  let lastError: any = null;
  const maxPrimaryAttempts = 1 + PRIMARY_RETRY_DELAYS_MS.length;

  for (let attempt = 0; attempt < maxPrimaryAttempts; attempt++) {
    try {
      const result = await invoke(primaryModel);
      return { result, modelUsed: primaryModel, usedFallback: false };
    } catch (err: any) {
      lastError = attachAttemptedModel(err, primaryModel);

      const transient = isTransientAiError(lastError);
      const modelNotFound = isModelNotFoundError(lastError);

      if (!transient && !modelNotFound) {
        throw lastError;
      }

      onLog?.(
        'warn',
        formatSafeAiErrorLog(
          endpoint,
          extractGeminiErrorStatus(lastError),
          lastError,
          [],
          primaryModel
        )
      );

      if (modelNotFound) {
        break;
      }

      if (attempt < PRIMARY_RETRY_DELAYS_MS.length) {
        const delayMs = PRIMARY_RETRY_DELAYS_MS[attempt];
        onLog?.(
          'info',
          `[AI Retry] route=${endpoint} model=${primaryModel} attempt=${attempt + 2}/${maxPrimaryAttempts} waitMs=${delayMs}`
        );
        await sleep(delayMs);
      }
    }
  }

  let availableModels: string[] = [];
  try {
    availableModels = await listAvailableModels();
  } catch {
    availableModels = [];
  }

  const pickedModel = pickFallbackFlashModel(availableModels, primaryModel);
  const fallbackModels = buildFallbackModelChain({
    primaryModel,
    envFallbackModel,
    pickedModel,
  });

  for (const fallbackModel of fallbackModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        onLog?.(
          'info',
          `[AI Fallback] route=${endpoint} primary=${primaryModel} tryingModel=${fallbackModel} attempt=${attempt + 1}/2`
        );
        const fallbackResult = await invoke(fallbackModel);
        onLog?.(
          'info',
          `[AI Fallback] route=${endpoint} modelUsed=${fallbackModel} outcome=success`
        );
        return { result: fallbackResult, modelUsed: fallbackModel, usedFallback: true };
      } catch (err: any) {
        lastError = attachAttemptedModel(err, fallbackModel);

        const transient = isTransientAiError(lastError);
        const modelNotFound = isModelNotFoundError(lastError);

        if (!transient && !modelNotFound) {
          throw lastError;
        }

        onLog?.(
          'warn',
          formatSafeAiErrorLog(
            endpoint,
            extractGeminiErrorStatus(lastError),
            lastError,
            [],
            fallbackModel
          )
        );

        if (modelNotFound) {
          break;
        }

        if (attempt === 0) {
          await sleep(FALLBACK_RETRY_DELAY_MS);
        }
      }
    }
  }

  throw lastError;
}

export function classifyAiError(
  error: any,
  fallbackMessage: string
): {
  status: number;
  code: AiErrorCode;
  message: string;
  reasonBn: string;
  hintBn: string;
} {
  const status = extractGeminiErrorStatus(error);
  const msg = String(error?.message || error || '');
  const lower = msg.toLowerCase();

  if (error?.name === 'AbortError' || status === 504 || msg.includes('DEADLINE_EXCEEDED') || lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return {
      status: 504,
      code: 'timeout',
      message: 'সার্ভার থেকে উত্তর আসতে বেশি সময় লাগছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      reasonBn: 'সময়সীমা অতিক্রম (Timeout)',
      hintBn: 'নেটওয়ার্ক সংযোগ বা Gemini API প্রতিক্রিয়া সময় পরীক্ষা করুন এবং আবার চেষ্টা করুন।',
    };
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return {
      status: 503,
      code: 'overloaded',
      message: 'AI সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      reasonBn: 'নেটওয়ার্ক সমস্যা',
      hintBn: 'সার্ভারের আউটবাউন্ড ইন্টারনেট সংযোগ ও DNS ঠিক আছে কিনা যাচাই করুন।',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED') ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return {
      status: status === 401 || status === 403 ? status : 403,
      code: 'invalid_key',
      message: 'AI সেবা এখন চালু করা নেই। অ্যাডমিনকে জানান।',
      reasonBn: 'চাবি অবৈধ বা বাতিল',
      hintBn: 'সার্ভার এনভায়রনমেন্টে বৈধ GEMINI_API_KEY যুক্ত ও সক্রিয় করুন।',
    };
  }

  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'quota',
      message: 'AI সেবায় এখন অনেক চাপ, ১ মিনিট পরে চেষ্টা করুন।',
      reasonBn: 'কোটা শেষ',
      hintBn: 'Gemini API চাবির ব্যবহার সীমা (quota) বা বিলিং স্ট্যাটাস পরীক্ষা করুন।',
    };
  }

  if (isModelNotFoundError(error)) {
    return {
      status: 404,
      code: 'model_not_found',
      message: 'AI মডেল পাওয়া যায়নি।',
      reasonBn: 'মডেল পাওয়া যায়নি',
      hintBn: 'উপলব্ধ তালিকা থেকে বৈধ flash মডেলের নাম GEMINI_MODEL বা GEMINI_FALLBACK_MODEL-এ সেট করুন।',
    };
  }

  if (
    status === 503 ||
    status === 502 ||
    msg.includes('UNAVAILABLE') ||
    lower.includes('overloaded') ||
    lower.includes('high demand')
  ) {
    return {
      status: status || 503,
      code: 'overloaded',
      message: 'AI সেবায় এখন অনেক চাপ, কিছুক্ষণ পর আবার চেষ্টা করুন।',
      reasonBn: 'Gemini এখন ব্যস্ত',
      hintBn: 'Gemini সার্ভার সাময়িকভাবে ব্যস্ত; কয়েক সেকেন্ড পরে আবার পরীক্ষা করুন।',
    };
  }

  if (error instanceof SyntaxError || lower.includes('json') || lower.includes('empty response') || lower.includes('bad_response')) {
    return {
      status: 502,
      code: 'bad_response',
      message: fallbackMessage,
      reasonBn: 'অসম্পূর্ণ বা অপ্রত্যাশিত উত্তর',
      hintBn: 'AI থেকে সঠিক ফরম্যাটে উত্তর আসেনি; আবার চেষ্টা করুন অথবা মডেল পরিবর্তন করুন।',
    };
  }

  return {
    status: status || 500,
    code: status && status >= 500 ? 'overloaded' : 'bad_response',
    message: fallbackMessage,
    reasonBn: status && status >= 500 ? 'Gemini এখন ব্যস্ত' : 'AI অনুরোধ ব্যর্থ হয়েছে',
    hintBn: 'সার্ভার লগে বিস্তারিত ত্রুটির ধরন দেখে মডেল ও API চাবি যাচাই করুন।',
  };
}

