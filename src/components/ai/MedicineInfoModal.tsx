import React, { useState } from 'react';
import { fetchMedicineInfo, MedicineInfoResponse } from '../../services/aiService';
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
  const [query, setQuery] = useState(initialMedicineName);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MedicineInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (nameToSearch?: string) => {
    const med = (nameToSearch || query).trim();
    if (!med) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchMedicineInfo(med);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-2xs">
            <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              AI সহায়ক — ওষুধের তথ্য
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ওষুধের নাম লিখুন (যেমন: নাপা, সেক্লো, কনকর)..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
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
          <span className="text-2xs text-slate-400">জনপ্রিয় ওষুধ:</span>
          {COMMON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const clean = preset.split('(')[0].trim();
                setQuery(clean);
                handleSearch(clean);
              }}
              className="text-2xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-700 dark:hover:text-teal-300 text-slate-600 dark:text-slate-300 rounded-full transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/3 mb-2" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-full" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-5/6" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-4/6" />
            <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg mt-3" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">তথ্য আনতে সমস্যা হয়েছে</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/60 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-teal-100 dark:border-teal-900/60">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
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
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-100 dark:bg-teal-900 hover:bg-teal-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>তালিকায় যোগ করুন</span>
                  </button>
                )}
              </div>

              {/* Formatted Text */}
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line space-y-2">
                {result.info}
              </div>
            </div>

            {/* Statutory Safety Disclaimer */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">{result.disclaimer}</p>
                <p className="mt-0.5 text-2xs text-amber-700/90 dark:text-amber-300">
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
