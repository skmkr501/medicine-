import React from 'react';
import { RefreshCw, X, CheckCircle2, CloudUpload } from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';

export const SyncConfirmModal: React.FC = () => {
  const {
    pendingSyncPreview,
    confirmManualSync,
    cancelManualSync,
    isSyncing,
  } = useMedicine();

  if (!pendingSyncPreview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-confirm-modal-title"
    >
      <div className="bg-surface rounded-3xl max-w-md w-full border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-primary-soft text-primary shrink-0">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div>
              <h3 id="sync-confirm-modal-title" className="text-base sm:text-lg font-bold text-text">
                {toBengaliNumber(pendingSyncPreview.totalWrites)}টি পরিবর্তন সিঙ্ক হবে
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                শুধুমাত্র পরিবর্তিত বা ক্লাউডে না-যাওয়া তথ্য পাঠানো হবে
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={cancelManualSync}
            disabled={isSyncing}
            className="p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer disabled:opacity-50"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pendingSyncPreview.breakdownLabels.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2">
            <p className="text-xs font-semibold text-text-muted">
              সিঙ্ক তালিকার বিবরণ:
            </p>
            <ul className="space-y-1.5 text-sm text-text font-medium">
              {pendingSyncPreview.breakdownLabels.map((label, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={cancelManualSync}
            disabled={isSyncing}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold text-text bg-surface-2 hover:bg-border/60 rounded-xl border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={() => void confirmManualSync()}
            disabled={isSyncing}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই সিঙ্ক করুন'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
