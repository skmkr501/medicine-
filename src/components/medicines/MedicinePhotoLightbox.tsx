import React, { useEffect } from 'react';
import { X, Pill } from 'lucide-react';

interface MedicinePhotoLightboxProps {
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const MedicinePhotoLightbox: React.FC<MedicinePhotoLightboxProps> = ({
  imageUrl,
  title,
  subtitle,
  onClose,
}) => {
  useEffect(() => {
    if (!imageUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} ছবি`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl flex items-center justify-between text-white mb-3 px-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-teal-400 shrink-0" />
            <h3 className="text-base font-bold truncate">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-300 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
          aria-label="ছবি বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="max-w-2xl w-full max-h-[80vh] flex items-center justify-center rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={title}
          className="max-w-full max-h-[78vh] object-contain"
        />
      </div>
    </div>
  );
};
