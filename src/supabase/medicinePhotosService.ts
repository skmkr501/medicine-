import { supabase } from './client';
import { retryWithBackoff } from './userDataService';

export const MEDICINE_PHOTOS_BUCKET = 'medical-docs';
export const MEDICINE_PHOTO_SIGNED_URL_TTL_SECONDS = 300; // 5 minutes
const SIGNED_URL_REFRESH_BUFFER_MS = 15_000;

interface CachedSignedUrl {
  url: string;
  expiresAtMs: number;
}

const medicinePhotoSignedUrlCache = new Map<string, CachedSignedUrl>();

export function buildMedicinePhotoStoragePath(userId: string, medicineId: string): string {
  const cleanUid = String(userId || '').trim();
  const cleanMedId = String(medicineId || '').trim();
  return `${cleanUid}/medicine-photos/${cleanMedId}.jpg`;
}

export function clearMedicinePhotoSignedUrlCache(photoPath?: string): void {
  if (photoPath) {
    medicinePhotoSignedUrlCache.delete(photoPath);
    return;
  }
  medicinePhotoSignedUrlCache.clear();
}

export async function uploadMedicinePhotoToStorage(
  userId: string,
  medicineId: string,
  blob: Blob
): Promise<string> {
  if (!userId || !medicineId) {
    throw new Error('ব্যবহারকারী বা ওষুধের আইডি পাওয়া যায়নি।');
  }

  const path = buildMedicinePhotoStoragePath(userId, medicineId);

  await retryWithBackoff(
    async () => {
      const { error } = await supabase.storage
        .from(MEDICINE_PHOTOS_BUCKET)
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (error) throw error;
    },
    { maxRetries: 2, baseDelayMs: 400 }
  );

  clearMedicinePhotoSignedUrlCache(path);
  return path;
}

export async function getMedicinePhotoSignedUrl(
  photoPath: string | undefined | null
): Promise<string | null> {
  const cleanPath = (photoPath || '').trim();
  if (!cleanPath) return null;

  const cached = medicinePhotoSignedUrlCache.get(cleanPath);
  if (cached && cached.expiresAtMs - SIGNED_URL_REFRESH_BUFFER_MS > Date.now()) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(MEDICINE_PHOTOS_BUCKET)
      .createSignedUrl(cleanPath, MEDICINE_PHOTO_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return null;
    }

    medicinePhotoSignedUrlCache.set(cleanPath, {
      url: data.signedUrl,
      expiresAtMs: Date.now() + MEDICINE_PHOTO_SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function deleteMedicinePhotoFromStorage(
  photoPath?: string | null,
  fallbackUserAndMed?: { userId: string; medicineId: string }
): Promise<void> {
  const cleanPath =
    (photoPath || '').trim() ||
    (fallbackUserAndMed?.userId && fallbackUserAndMed?.medicineId
      ? buildMedicinePhotoStoragePath(fallbackUserAndMed.userId, fallbackUserAndMed.medicineId)
      : '');

  if (!cleanPath) return;
  clearMedicinePhotoSignedUrlCache(cleanPath);

  try {
    await supabase.storage.from(MEDICINE_PHOTOS_BUCKET).remove([cleanPath]);
  } catch {
    // Do not block medicine deletion or photo removal if storage cleanup fails silently
  }
}
