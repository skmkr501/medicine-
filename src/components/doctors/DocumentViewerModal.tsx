import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Pill,
  RotateCw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DoctorProfile, MedicalDocument, PatientProfile } from '../../types';
import { formatBengaliDate, toBengaliNumber } from '../../utils/bengaliUtils';
import { normalizeRotation } from '../../utils/medicalDocuments';
import { useMedicine } from '../../context/MedicineContext';

interface DocumentViewerModalProps {
  documentItem: MedicalDocument;
  patients: PatientProfile[];
  doctors: DoctorProfile[];
  onClose: () => void;
  onEdit: (doc: MedicalDocument) => void;
  onScanPrescription?: (imageDataUrl: string, doc: MedicalDocument) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentItem,
  patients,
  doctors,
  onClose,
  onEdit,
  onScanPrescription,
}) => {
  const {
    medicalDocuments,
    loadDocumentPageImage,
    rotateMedicalDocumentPage,
    deleteMedicalDocument,
    showToast,
  } = useMedicine();

  // Keep reactive reference to latest doc (e.g. live rotation updates)
  const docRecord =
    medicalDocuments.find((d) => d.id === documentItem.id) || documentItem;
  const pages = Array.isArray(docRecord.pages) ? docRecord.pages : [];

  const [pageIndex, setPageIndex] = useState(0);
  const [fullImages, setFullImages] = useState<Record<string, string>>({});
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Touch gesture tracking
  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch' | 'swipe';
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startPinchDist: number;
    startScale: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startPinchDist: 0,
    startScale: 1,
  });

  const safeIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const currentPage = pages[safeIndex];

  useEffect(() => {
    if (!currentPage?.fileId) return;
    if (fullImages[currentPage.fileId]) return;

    let cancelled = false;
    setIsLoadingImage(true);
    void loadDocumentPageImage(currentPage.fileId)
      .then((dataUrl) => {
        if (!cancelled && dataUrl) {
          setFullImages((prev) => ({ ...prev, [currentPage.fileId]: dataUrl }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage?.fileId]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goToPage = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= pages.length) return;
    setPageIndex(nextIdx);
    resetZoom();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStateRef.current = {
        ...touchStateRef.current,
        mode: 'pinch',
        startPinchDist: Math.hypot(dx, dy),
        startScale: scale,
      };
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStateRef.current = {
        ...touchStateRef.current,
        mode: scale > 1.02 ? 'pan' : 'swipe',
        startX: t.clientX,
        startY: t.clientY,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current.mode === 'pinch') {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (touchStateRef.current.startPinchDist > 0) {
        const nextScale = Math.min(
          4,
          Math.max(1, touchStateRef.current.startScale * (dist / touchStateRef.current.startPinchDist))
        );
        setScale(nextScale);
        if (nextScale <= 1.02) {
          setOffset({ x: 0, y: 0 });
        }
      }
      return;
    }

    if (e.touches.length === 1 && touchStateRef.current.mode === 'pan' && scale > 1.02) {
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.startX;
      const dy = t.clientY - touchStateRef.current.startY;
      setOffset({
        x: touchStateRef.current.startOffsetX + dx,
        y: touchStateRef.current.startOffsetY + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStateRef.current.mode === 'swipe' && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStateRef.current.startX;
      const dy = e.changedTouches[0].clientY - touchStateRef.current.startY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0 && safeIndex < pages.length - 1) {
          goToPage(safeIndex + 1);
        } else if (dx > 0 && safeIndex > 0) {
          goToPage(safeIndex - 1);
        }
      }
    }
    touchStateRef.current.mode = 'none';
  };

  const patientName =
    patients.find((p) => p.id === docRecord.patientId)?.name || 'সদস্য';
  const doctorName = docRecord.doctorId
    ? doctors.find((d) => d.id === docRecord.doctorId)?.name
    : undefined;

  const activeImageSrc =
    (currentPage?.fileId && fullImages[currentPage.fileId]) ||
    currentPage?.thumb ||
    '';
  const rotation = normalizeRotation(currentPage?.rotation);

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      await deleteMedicalDocument(docRecord.id);
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleScanClick = async () => {
    if (!currentPage || !onScanPrescription) return;
    let img = fullImages[currentPage.fileId];
    if (!img) {
      img = (await loadDocumentPageImage(currentPage.fileId)) || '';
    }
    if (!img) {
      showToast('মূল ছবিটি এখনো লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।', 'alert');
      return;
    }
    onScanPrescription(img, docRecord);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-black/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">বন্ধ</span>
          </button>

          {pages.length > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-white/10 text-sm font-bold">
              পাতা {toBengaliNumber(safeIndex + 1)}/{toBengaliNumber(pages.length)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(1, Number((scale - 0.5).toFixed(2)));
              setScale(next);
              if (next <= 1) setOffset({ x: 0, y: 0 });
            }}
            disabled={scale <= 1}
            aria-label="জুম কমান"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 cursor-pointer"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="min-h-[44px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
          >
            {toBengaliNumber(Math.round(scale * 100))}%
          </button>

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(4, Number((s + 0.5).toFixed(2))))}
            disabled={scale >= 4}
            aria-label="জুম বাড়ান"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 cursor-pointer"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => void rotateMedicalDocumentPage(docRecord.id, safeIndex)}
            title="ছবি ঘোরান"
            aria-label="ছবি ঘোরান"
            className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">ঘোরান</span>
          </button>
        </div>
      </div>

      {/* Center Image Canvas with Pinch-Zoom & Pan */}
      <div
        className="relative flex-1 overflow-hidden flex items-center justify-center touch-none p-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => (scale > 1 ? resetZoom() : setScale(2))}
      >
        {activeImageSrc ? (
          <img
            src={activeImageSrc}
            alt={docRecord.title}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transition: touchStateRef.current.mode === 'none' ? 'transform 160ms ease-out' : 'none',
            }}
            className="max-h-full max-w-full object-contain select-none"
          />
        ) : (
          <div className="text-slate-300 text-sm">ছবি পাওয়া যায়নি</div>
        )}

        {isLoadingImage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/80 border border-white/20 text-xs font-semibold flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>পূর্ণ আকারের ছবি লোড হচ্ছে...</span>
          </div>
        )}

        {/* Prev / Next Navigation Buttons */}
        {pages.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goToPage(safeIndex - 1)}
              disabled={safeIndex === 0}
              aria-label="আগের পাতা"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] rounded-full bg-black/65 hover:bg-black/90 border border-white/20 flex items-center justify-center disabled:opacity-25 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(safeIndex + 1)}
              disabled={safeIndex >= pages.length - 1}
              aria-label="পরের পাতা"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] rounded-full bg-black/65 hover:bg-black/90 border border-white/20 flex items-center justify-center disabled:opacity-25 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Info & Action Bar */}
      <div className="bg-slate-950/95 border-t border-white/15 px-4 py-3.5 space-y-3 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {docRecord.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              তারিখ: <strong>{formatBengaliDate(docRecord.date)}</strong> · রোগী:{' '}
              <strong>{patientName}</strong>
              {doctorName && (
                <>
                  {' '}· ডাক্তার: <strong>{doctorName}</strong>
                </>
              )}
              {docRecord.reportType && (
                <>
                  {' '}· ধরন: <strong>{docRecord.reportType}</strong>
                </>
              )}
            </p>
            {docRecord.note && (
              <p className="text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg">
                নোট: {docRecord.note}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {docRecord.kind === 'prescription' && onScanPrescription && (
              <button
                type="button"
                onClick={() => void handleScanClick()}
                className="min-h-[48px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <Pill className="w-4 h-4" />
                <span>এই প্রেসক্রিপশন থেকে ওষুধ যোগ করুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(docRecord)}
              className="min-h-[48px] px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              <span>সম্পাদনা</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[48px] px-3.5 py-2 bg-red-600/85 hover:bg-red-600 text-white font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>মুছুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div
            className="bg-surface text-text border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-text">
              ডকুমেন্টটি মুছে ফেলবেন?
            </h3>
            <p className="text-sm text-text-muted">
              <strong className="text-text">{docRecord.title}</strong> এবং এর{' '}
              {toBengaliNumber(pages.length)}টি ছবি ফোন ও ক্লাউড থেকে স্থায়ীভাবে মুছে যাবে।
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[48px] flex-1 px-4 py-2 bg-surface-2 border border-border text-text font-bold rounded-xl cursor-pointer"
              >
                থাক
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirmed()}
                className="min-h-[48px] flex-1 px-4 py-2 bg-danger text-white font-bold rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>হ্যাঁ, মুছে ফেলুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
