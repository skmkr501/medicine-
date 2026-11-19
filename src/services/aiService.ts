/**
 * Client-Side AI Service
 * Strictly proxies requests to server-side Express endpoints (/api/ai/*).
 * Never exposes any API keys to the browser.
 */
import { supabase } from '../supabase/client';

const LOGIN_REQUIRED_ERROR = 'লগইন করে আবার চেষ্টা করুন';

export type AiErrorCode =
  | 'model_not_found'
  | 'invalid_key'
  | 'quota'
  | 'overloaded'
  | 'timeout'
  | 'bad_response'
  | 'unauthenticated'
  | 'rate_limited';

export class AiServiceError extends Error {
  readonly code?: AiErrorCode | string;
  readonly status?: number;

  constructor(message: string, code?: AiErrorCode | string, status?: number) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = status;
  }
}

export function getAiErrorDisplay(
  err: unknown,
  fallbackMessage: string
): { message: string; code?: string } {
  if (err instanceof AiServiceError) {
    return {
      message: err.message || fallbackMessage,
      code: err.code,
    };
  }
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown; code?: unknown };
    return {
      message:
        typeof anyErr.message === 'string' && anyErr.message.trim()
          ? anyErr.message
          : fallbackMessage,
      code: typeof anyErr.code === 'string' && anyErr.code.trim() ? anyErr.code : undefined,
    };
  }
  return { message: fallbackMessage };
}

async function getAuthorizedHeaders(forceRefresh = false): Promise<Record<string, string>> {
  try {
    const { data, error } = forceRefresh
      ? await supabase.auth.refreshSession()
      : await supabase.auth.getSession();

    const accessToken = !error ? data.session?.access_token : null;
    if (!accessToken) {
      throw new AiServiceError(LOGIN_REQUIRED_ERROR, 'unauthenticated', 401);
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    throw new AiServiceError(LOGIN_REQUIRED_ERROR, 'unauthenticated', 401);
  }
}

async function fetchWithAuth(
  url: string,
  initFactory: (headers: Record<string, string>) => RequestInit
): Promise<Response> {
  const headers = await getAuthorizedHeaders(false);
  let res = await fetch(url, initFactory(headers));

  if (res.status === 401) {
    try {
      const freshHeaders = await getAuthorizedHeaders(true);
      res = await fetch(url, initFactory(freshHeaders));
    } catch {
      // Return original 401 response if refresh fails so caller handles unauthenticated state cleanly
    }
  }

  return res;
}

export interface MedicineInfoResponse {
  success: boolean;
  medicineName: string;
  info: string;
  disclaimer: string;
}

export interface PrescriptionScanResult {
  brandName: string;
  genericName?: string;
  strength?: string;
  type?: string;
  mealTiming?: string;
  dosage?: string;
  schedules?: Array<{
    timeSlot: 'সকাল' | 'দুপুর' | 'সন্ধ্যা' | 'রাত';
    time: string;
    dosage: string;
  }>;
  purpose?: string;
  instructions?: string;
  durationDays?: number;
  confidenceNote?: string;
}

export interface PrescriptionScanResponse {
  success: boolean;
  data: PrescriptionScanResult;
  disclaimer: string;
}

export interface DrugInteractionResponse {
  success: boolean;
  hasInteraction: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  summary: string;
  details: string[];
  recommendation: string;
  disclaimer: string;
}

export interface AiHealthResponse {
  keyPresent: boolean;
  model: string;
  fallbackModel?: string | null;
  activeModelUsed?: string | null;
  modelInAvailableList?: boolean;
  fallbackInAvailableList?: boolean;
  availableModels?: string[];
  endpointModels?: Record<string, string>;
  ok: boolean;
  errorStatus: number | null;
  errorCode?: AiErrorCode | string | null;
  errorMessage: string;
  reasonBn?: string;
  hintBn?: string;
  checkedAt?: string;
  cached?: boolean;
}

const FALLBACK_NETWORK_OR_HTML_ERROR = 'ছবিটি বড় বা সংযোগ দুর্বল, আবার চেষ্টা করুন।';

function inferErrorCodeFromStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'unauthenticated';
  if (status === 404) return 'model_not_found';
  if (status === 429) return 'rate_limited';
  if (status === 504) return 'timeout';
  if (status === 503) return 'overloaded';
  return 'bad_response';
}

/**
 * Validates and safely parses AI responses.
 * If server returns non-JSON (like HTML error pages from proxies/gateways) or 413 Payload Too Large,
 * returns the user-friendly Bengali message: "ছবিটি বড় বা সংযোগ দুর্বল, আবার চেষ্টা করুন।"
 */
async function parseAiResponse<T>(res: Response, defaultError: string): Promise<T> {
  if (res.status === 413) {
    throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'bad_response', 413);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    throw new AiServiceError(
      FALLBACK_NETWORK_OR_HTML_ERROR,
      inferErrorCodeFromStatus(res.status),
      res.status
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch (_e) {
    throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'bad_response', res.status);
  }

  if (!res.ok) {
    const resolvedCode =
      typeof data?.code === 'string' && data.code.trim()
        ? data.code.trim()
        : inferErrorCodeFromStatus(res.status);
    throw new AiServiceError(data?.error || defaultError, resolvedCode, res.status);
  }

  return data as T;
}

/**
 * Compresses an image in the browser using HTMLCanvasElement.
 * Limits the longest side to 1600px, JPEG quality 0.8, ensuring size is well under 1MB.
 * Keeps existing preview intact on screen (as it's read by the calling component).
 */
export async function compressImageForUpload(
  base64OrDataUrl: string,
  maxDimension: number = 1600,
  initialQuality: number = 0.8
): Promise<{ base64: string; mimeType: string }> {
  // Graceful fallback for non-browser/node environments
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { base64: base64OrDataUrl, mimeType: 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width <= 0 || height <= 0) {
          resolve({ base64: base64OrDataUrl, mimeType: 'image/jpeg' });
          return;
        }

        // Downscale so max(width, height) <= maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: base64OrDataUrl, mimeType: 'image/jpeg' });
          return;
        }

        // Fill background white to handle any transparency cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Target size < 1MB binary (~1.33 million characters in Base64 Data URL)
        while (dataUrl.length > 1_250_000 && quality > 0.4) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
      } catch (err) {
        console.warn('Canvas image compression failed, falling back to original:', err);
        resolve({ base64: base64OrDataUrl, mimeType: 'image/jpeg' });
      }
    };

    img.onerror = () => {
      resolve({ base64: base64OrDataUrl, mimeType: 'image/jpeg' });
    };

    img.src = base64OrDataUrl;
  });
}

export const fetchMedicineInfo = async (medicineName: string): Promise<MedicineInfoResponse> => {
  try {
    const res = await fetchWithAuth('/api/ai/medicine-info', (headers) => ({
      method: 'POST',
      headers,
      body: JSON.stringify({ medicineName }),
    }));

    return await parseAiResponse<MedicineInfoResponse>(
      res,
      'ওষুধের তথ্য পেতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err instanceof AiServiceError) throw err;
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'overloaded');
    }
    throw err;
  }
};

export const scanPrescriptionImage = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<PrescriptionScanResponse> => {
  // 1. Client-side compression via canvas (max dimension 1600px, 0.8 quality, < 1MB)
  let uploadBase64 = imageBase64;
  let uploadMimeType = mimeType;

  try {
    const compressed = await compressImageForUpload(imageBase64, 1600, 0.8);
    uploadBase64 = compressed.base64;
    uploadMimeType = compressed.mimeType;
  } catch (err) {
    console.warn('Compression error, continuing with original:', err);
  }

  // 2. 90-second timeout using AbortController
  const controller = new AbortController();
  const timeoutMs = 90_000;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetchWithAuth('/api/ai/scan-prescription', (headers) => ({
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64: uploadBase64, mimeType: uploadMimeType }),
      signal: controller.signal,
    }));

    return await parseAiResponse<PrescriptionScanResponse>(
      res,
      'প্রেসক্রিপশন স্ক্যান করতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err instanceof AiServiceError) throw err;
    if (err?.name === 'AbortError') {
      throw new AiServiceError(
        'সার্ভার সাড়া দিতে ৯০ সেকেন্ডের বেশি সময় নিয়েছে। আবার চেষ্টা করুন।',
        'timeout',
        504
      );
    }
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'overloaded');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export interface PrescriptionAiSchedule {
  morning: boolean;
  noon: boolean;
  evening: boolean;
  night: boolean;
}

export type PrescriptionMealTiming = 'খাবারের আগে' | 'খাবারের পরে' | 'যেকোনো সময়';

export interface PrescriptionAiItem {
  brandName: string | null;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  amountPerDose: number | null;
  timesPerDay: number | null;
  schedule: PrescriptionAiSchedule;
  mealTiming: PrescriptionMealTiming | null;
  durationDays?: number | null;
  notes?: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface PrescriptionAiResponse {
  patientName?: string | null;
  doctorName?: string | null;
  date?: string | null;
  items: PrescriptionAiItem[];
  unreadable: boolean;
}

export interface PrescriptionAnalyzeApiResult {
  success: boolean;
  data: PrescriptionAiResponse;
}

export const analyzePrescriptionPhoto = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<PrescriptionAnalyzeApiResult> => {
  let uploadBase64 = imageBase64;
  let uploadMimeType = mimeType;

  try {
    const compressed = await compressImageForUpload(imageBase64, 1600, 0.8);
    uploadBase64 = compressed.base64;
    uploadMimeType = compressed.mimeType;
  } catch {
    // fallback to original if canvas compression is unavailable
  }

  const controller = new AbortController();
  const timeoutMs = 90_000;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetchWithAuth('/api/ai/prescription', (headers) => ({
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64: uploadBase64, mimeType: uploadMimeType }),
      signal: controller.signal,
    }));

    return await parseAiResponse<PrescriptionAnalyzeApiResult>(
      res,
      'প্রেসক্রিপশন পড়তে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
    );
  } catch (err: any) {
    if (err instanceof AiServiceError) throw err;
    if (err?.name === 'AbortError') {
      throw new AiServiceError(
        'ছবি পড়তে বেশি সময় লাগছে। সংযোগ দেখে আবার চেষ্টা করুন।',
        'timeout',
        504
      );
    }
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'overloaded');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export const checkDrugInteractions = async (
  newMedicine: string,
  currentMedicines: string[],
  patientContext?: string
): Promise<DrugInteractionResponse> => {
  try {
    const res = await fetchWithAuth('/api/ai/drug-interaction', (headers) => ({
      method: 'POST',
      headers,
      body: JSON.stringify({ newMedicine, currentMedicines, patientContext }),
    }));

    return await parseAiResponse<DrugInteractionResponse>(
      res,
      'পারস্পরিক ক্রিয়া যাচাই করতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err instanceof AiServiceError) throw err;
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new AiServiceError(FALLBACK_NETWORK_OR_HTML_ERROR, 'overloaded');
    }
    throw err;
  }
};

export const checkAiHealth = async (forceRefresh: boolean = false): Promise<AiHealthResponse> => {
  const endpoint = forceRefresh ? '/api/ai/health?refresh=1' : '/api/ai/health';
  try {
    const res = await fetchWithAuth(endpoint, (headers) => ({
      method: 'GET',
      headers,
    }));
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const code =
        typeof data?.code === 'string' && data.code.trim()
          ? (data.code.trim() as AiErrorCode)
          : inferErrorCodeFromStatus(res.status);
      return {
        keyPresent: false,
        model: data?.model || 'gemini-3.8-flash',
        fallbackModel: data?.fallbackModel ?? null,
        activeModelUsed: null,
        availableModels: Array.isArray(data?.availableModels) ? data.availableModels : [],
        endpointModels: data?.endpointModels,
        ok: false,
        errorStatus: res.status,
        errorCode: code,
        errorMessage: data?.error || data?.errorMessage || 'Health check request failed',
        reasonBn:
          res.status === 429
            ? 'অনুরোধের সীমা অতিক্রম করেছে'
            : res.status === 401 || res.status === 403
            ? 'অ্যাডমিন অনুমোদন ব্যর্থ'
            : 'স্বাস্থ্য পরীক্ষা ব্যর্থ হয়েছে',
        hintBn:
          res.status === 429
            ? 'কিছুক্ষণ অপেক্ষা করে আবার পরীক্ষা করুন।'
            : 'অ্যাডমিন অ্যাকাউন্ট দিয়ে পুনরায় লগইন করে চেষ্টা করুন।',
      };
    }
    return res.json();
  } catch (err: any) {
    const isAuthErr = err instanceof AiServiceError && err.code === 'unauthenticated';
    return {
      keyPresent: false,
      model: 'gemini-3.8-flash',
      fallbackModel: null,
      activeModelUsed: null,
      availableModels: [],
      ok: false,
      errorStatus: isAuthErr ? 401 : 503,
      errorCode: isAuthErr ? 'unauthenticated' : 'overloaded',
      errorMessage: err?.message || LOGIN_REQUIRED_ERROR,
      reasonBn: isAuthErr ? 'লগইন অনুমোদন নেই' : 'নেটওয়ার্ক সমস্যা',
      hintBn: isAuthErr
        ? 'অ্যাডমিন অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।'
        : 'সার্ভারের সাথে সংযোগ পাওয়া যাচ্ছে না; ইন্টারনেট ও সার্ভার চালু আছে কিনা দেখুন।',
    };
  }
};
