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

export const fetchMedicineInfo = async (medicineName: string): Promise<MedicineInfoResponse> => {
  const res = await fetch('/api/ai/medicine-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicineName }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'ওষুধের তথ্য পেতে সমস্যা হয়েছে।');
  }

  return res.json();
};

export const scanPrescriptionImage = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<PrescriptionScanResponse> => {
  const res = await fetch('/api/ai/scan-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'প্রেসক্রিপশন স্ক্যান করতে সমস্যা হয়েছে।');
  }

  return res.json();
};

export interface DrugInteractionResponse {
  success: boolean;
  hasInteraction: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  summary: string;
  details: string[];
  recommendation: string;
  disclaimer: string;
}

export const checkDrugInteractions = async (
  newMedicine: string,
  currentMedicines: string[],
  patientContext?: string
): Promise<DrugInteractionResponse> => {
  const res = await fetch('/api/ai/drug-interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newMedicine, currentMedicines, patientContext }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'পারস্পরিক ক্রিয়া যাচাই করতে সমস্যা হয়েছে।');
  }

  return res.json();
};
