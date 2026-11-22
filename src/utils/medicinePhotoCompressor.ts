export interface CompressedPhotoResult {
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
}

export const MEDICINE_PHOTO_MAX_SIDE = 1024;
export const MEDICINE_PHOTO_JPEG_QUALITY = 0.7;
export const MEDICINE_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function computeScaledDimensions(
  width: number,
  height: number,
  maxSide: number = MEDICINE_PHOTO_MAX_SIDE
): { width: number; height: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressMedicinePhotoFile(
  file: File
): Promise<CompressedPhotoResult> {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('অনুগ্রহ করে একটি বৈধ ছবির ফাইল নির্বাচন করুন।');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ছবিটি পড়া যায়নি। অন্য ছবি চেষ্টা করুন।'));
      el.src = objectUrl;
    });

    const target = computeScaledDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      MEDICINE_PHOTO_MAX_SIDE
    );

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ব্রাউজারে ছবি ছোট করা সমর্থিত নয়।');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(img, 0, 0, target.width, target.height);

    let quality = MEDICINE_PHOTO_JPEG_QUALITY;
    let blob = await canvasToJpegBlob(canvas, quality);

    while (blob.size > MEDICINE_PHOTO_MAX_BYTES && quality > 0.35) {
      quality = Math.max(0.35, quality - 0.15);
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size > MEDICINE_PHOTO_MAX_BYTES) {
      throw new Error('ছবির আকার ৫ মেগাবাইটের বেশি হয়ে গেছে। ছোট ছবি বাছুন।');
    }

    return {
      blob,
      width: target.width,
      height: target.height,
      sizeBytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error('ছবি প্রসেস করতে সমস্যা হয়েছে।'));
          return;
        }
        resolve(b);
      },
      'image/jpeg',
      quality
    );
  });
}
