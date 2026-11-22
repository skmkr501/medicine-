import React, { useEffect, useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { getMedicinePhotoSignedUrl } from '../../supabase/medicinePhotosService';

interface MedicinePhotoThumbnailProps {
  photoPath?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  onOpenLightbox?: (signedUrl: string) => void;
  className?: string;
}

export const MedicinePhotoThumbnail: React.FC<MedicinePhotoThumbnailProps> = ({
  photoPath,
  alt,
  size = 'sm',
  onOpenLightbox,
  className = '',
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);

    const cleanPath = (photoPath || '').trim();
    if (!cleanPath) {
      setSignedUrl(null);
      return;
    }

    getMedicinePhotoSignedUrl(cleanPath).then((url) => {
      if (active) {
        setSignedUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [photoPath]);

  if (!photoPath || !signedUrl || loadError) {
    return null;
  }

  const sizeClass =
    size === 'lg'
      ? 'w-20 h-20 rounded-2xl'
      : size === 'md'
      ? 'w-14 h-14 rounded-xl'
      : 'w-10 h-10 rounded-xl';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onOpenLightbox && signedUrl) {
          onOpenLightbox(signedUrl);
        }
      }}
      className={`relative group overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-teal-500 ${sizeClass} ${className}`}
      title={`${alt} — বড় করে দেখতে ট্যাপ করুন`}
      aria-label={`${alt} ছবি বড় করে দেখুন`}
    >
      <img
        src={signedUrl}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setLoadError(true)}
      />
      {onOpenLightbox && (
        <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ZoomIn className="w-4 h-4 text-white drop-shadow" />
        </span>
      )}
    </button>
  );
};
