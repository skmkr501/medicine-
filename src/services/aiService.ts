/**
 * Client-Side AI Service
 * Strictly proxies requests to server-side Express endpoints (/api/ai/*).
 * Never exposes any API keys to the browser.
 */

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
  ok: boolean;
  errorStatus: number | null;
  errorMessage: string;
}

const FALLBACK_NETWORK_OR_HTML_ERROR = 'ছবিটি বড় বা সংযোগ দুর্বল, আবার চেষ্টা করুন।';

/**
 * Validates and safely parses AI responses.
 * If server returns non-JSON (like HTML error pages from proxies/gateways) or 413 Payload Too Large,
 * returns the user-friendly Bengali message: "ছবিটি বড় বা সংযোগ দুর্বল, আবার চেষ্টা করুন।"
 */
async function parseAiResponse<T>(res: Response, defaultError: string): Promise<T> {
  if (res.status === 413) {
    throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
  }

  if (!res.ok) {
    throw new Error(data?.error || defaultError);
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
    const res = await fetch('/api/ai/medicine-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicineName }),
    });

    return await parseAiResponse<MedicineInfoResponse>(
      res,
      'ওষুধের তথ্য পেতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
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
    const res = await fetch('/api/ai/scan-prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: uploadBase64, mimeType: uploadMimeType }),
      signal: controller.signal,
    });

    return await parseAiResponse<PrescriptionScanResponse>(
      res,
      'প্রেসক্রিপশন স্ক্যান করতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('সার্ভার সাড়া দিতে ৯০ সেকেন্ডের বেশি সময় নিয়েছে। আবার চেষ্টা করুন।');
    }
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
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
    const res = await fetch('/api/ai/drug-interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newMedicine, currentMedicines, patientContext }),
    });

    return await parseAiResponse<DrugInteractionResponse>(
      res,
      'পারস্পরিক ক্রিয়া যাচাই করতে সমস্যা হয়েছে।'
    );
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new Error(FALLBACK_NETWORK_OR_HTML_ERROR);
    }
    throw err;
  }
};

export const checkAiHealth = async (): Promise<AiHealthResponse> => {
  const res = await fetch('/api/ai/health');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return {
      keyPresent: false,
      model: 'gemini-3.8-flash',
      ok: false,
      errorStatus: res.status,
      errorMessage: data?.errorMessage || 'Health check request failed',
    };
  }
  return res.json();
};
