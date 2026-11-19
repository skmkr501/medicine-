import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { fetchMedicineInfo, getAiErrorDisplay, MedicineInfoResponse } from '../../services/aiService';
import {
  Sparkles,
  Search,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
  BookOpen,
  Plus,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface MedicineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicineName?: string;
  onAddToMedicines?: (name: string) => void;
}

const COMMON_PRESETS = [
  'Napa Extra (নাপা এক্সট্রা)',
  'Seclo 20 (সেক্লো ২০)',
  'Concor 2.5 (কনকর ২.৫)',
  'Metfor 500 (মেটফোর ৫০০)',
  'Montene 10 (মন্টিন ১০)',
  'Ceevit 250 (সিভিট ২৫০)',
];

export const MedicineInfoModal: React.FC<MedicineInfoModalProps> = ({
  isOpen,
  onClose,
  initialMedicineName = '',
  onAddToMedicines,
}) => {
  const { isAdmin } = useMedicine();
  const [query, setQuery] = useState(initialMedicineName);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MedicineInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (nameToSearch?: string) => {
    const med = (nameToSearch || query).trim();
    if (!med) return;

    setLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const data = await fetchMedicineInfo(med);
      setResult(data);
    } catch (err: unknown) {
      const display = getAiErrorDisplay(
        err,
        'তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
      );
      setError(display.message);
      setErrorCode(display.code ?? null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text">
              AI সহায়ক — ওষুধের তথ্য
            </h2>
            <p className="text-xs text-text-muted">
              ওষুধের নাম লিখলে সহজ বাংলায় কাজ, পার্শ্বপ্রতিক্রিয়া ও সাধারণ নিয়ম জানুন
            </p>
          </div>
        </div>

        {/* Search Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2 mb-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ওষুধের নাম লিখুন (যেমন: নাপা, সেক্লো, কনকর)..."
              className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>তথ্য জানুন</span>
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <span className="text-2xs text-text-muted">জনপ্রিয় ওষুধ:</span>
          {COMMON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const clean = preset.split('(')[0].trim();
                setQuery(clean);
                handleSearch(clean);
              }}
              className="text-2xs px-2.5 py-1 bg-surface-2 hover:bg-primary-soft hover:text-primary text-text-muted rounded-full transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="space-y-3 p-4 bg-surface-2 rounded-xl border border-border animate-pulse">
            <div className="h-4 bg-border rounded-md w-1/3 mb-2" />
            <div className="h-3 bg-border rounded-md w-full" />
            <div className="h-3 bg-border rounded-md w-5/6" />
            <div className="h-3 bg-border rounded-md w-4/6" />
            <div className="h-16 bg-border rounded-lg mt-3" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger-text flex items-start gap-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">তথ্য আনতে সমস্যা হয়েছে</p>
              <p className="mt-0.5 text-text">{error}</p>
              {isAdmin && errorCode && (
                <p className="mt-1 text-[11px] font-mono text-text-muted">কোড: {errorCode}</p>
              )}
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 bg-primary-soft border border-primary/25 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-primary/20">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-base text-text">
                    {result.medicineName} সম্পর্কে সাধারণ তথ্য
                  </h3>
                </div>
                {onAddToMedicines && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToMedicines(result.medicineName);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-primary bg-surface border border-primary/25 hover:opacity-90 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>তালিকায় যোগ করুন</span>
                  </button>
                )}
              </div>

              {/* Formatted Text */}
              <div className="text-xs sm:text-sm text-text leading-relaxed whitespace-pre-line space-y-2">
                {result.info}
              </div>
            </div>

            {/* Statutory Safety Disclaimer */}
            <div className="p-3 bg-warning-soft border border-warning/30 rounded-xl text-xs text-warning-text flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning-text" />
              <div>
                <p className="font-semibold">{result.disclaimer}</p>
                <p className="mt-0.5 text-2xs text-text-muted">
                  AI কখনো ডোজ বদলানোর পরামর্শ দেয় না। যেকোনো ওষুধ সেবনের পূর্বে সর্বদা নিবন্ধিত চিকিৎসকের পরামর্শ নিন।
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
