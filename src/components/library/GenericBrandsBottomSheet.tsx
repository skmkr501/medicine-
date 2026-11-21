import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Building,
  Check,
  Loader2,
  Lock,
  Pill,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { GlobalMedicine } from '../../types';
import {
  fetchLibraryBrandsByGeneric,
  filterAndSortGenericBrands,
  formatBrandPriceBn,
} from '../../supabase/libraryService';
import { toBengaliNumber } from '../../utils/bengaliUtils';

interface GenericBrandsBottomSheetProps {
  genericName: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onSelectBrand: (brand: GlobalMedicine) => void;
}

export const GenericBrandsBottomSheet: React.FC<GenericBrandsBottomSheetProps> = ({
  genericName,
  isLoggedIn,
  onClose,
  onOpenAuth,
  onSelectBrand,
}) => {
  const [brands, setBrands] = useState<GlobalMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrength, setSelectedStrength] = useState<string>('all');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [cheapestFirst, setCheapestFirst] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!genericName) return;
    setSelectedStrength('all');
    setSelectedForm('all');
    setCheapestFirst(false);
    setError(null);
  }, [genericName]);

  useEffect(() => {
    if (!genericName) return;
    if (!isLoggedIn) {
      setBrands([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchLibraryBrandsByGeneric(genericName, { limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setBrands(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'একই জেনেরিকের ব্র্যান্ড তালিকা লোড করা যায়নি।';
        setError(msg);
        setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [genericName, isLoggedIn, reloadNonce]);

  useEffect(() => {
    if (!genericName) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [genericName, onClose]);

  const strengthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      const s = (b.strength || '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [brands]);

  const formOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      const f = (b.dosageForm || '').trim();
      if (f) set.add(f);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [brands]);

  const displayedBrands = useMemo(
    () =>
      filterAndSortGenericBrands(brands, {
        strength: selectedStrength,
        form: selectedForm,
        cheapestFirst,
      }),
    [brands, selectedStrength, selectedForm, cheapestFirst]
  );

  if (!genericName) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generic-brands-sheet-title"
    >
      <div
        className="w-full sm:max-w-2xl bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle indicator for mobile */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 bg-primary-soft/40 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="generic-brands-sheet-title"
                className="text-lg sm:text-xl font-bold text-text leading-snug"
              >
                একই জেনেরিকের সব ব্র্যান্ড
              </h2>
              <p className="text-sm font-semibold text-primary truncate mt-0.5">
                {genericName}
                {!isLoading && brands.length > 0 && ` · ${toBengaliNumber(displayedBrands.length)}টি ব্র্যান্ড`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips & Price Sort Bar */}
        {isLoggedIn && !isLoading && brands.length > 0 && (
          <div className="px-5 py-3 border-b border-border bg-surface-2/60 space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCheapestFirst((prev) => !prev)}
                aria-pressed={cheapestFirst}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  cheapestFirst
                    ? 'bg-primary text-on-primary border-primary shadow-xs'
                    : 'bg-surface border-border text-text hover:border-primary/60'
                }`}
              >
                <ArrowUpDown className="w-4 h-4 shrink-0" />
                <span>সবচেয়ে কম দাম আগে</span>
                {cheapestFirst && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>

              {(selectedStrength !== 'all' || selectedForm !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStrength('all');
                    setSelectedForm('all');
                  }}
                  className="min-h-[44px] px-3 py-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  ফিল্টার মুছুন
                </button>
              )}
            </div>

            {/* Strength chips */}
            {strengthOptions.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-xs font-bold text-text-muted shrink-0 mr-1">শক্তি:</span>
                <button
                  type="button"
                  onClick={() => setSelectedStrength('all')}
                  className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                    selectedStrength === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface border border-border text-text hover:border-primary/50'
                  }`}
                >
                  সব
                </button>
                {strengthOptions.map((str) => (
                  <button
                    key={str}
                    type="button"
                    onClick={() => setSelectedStrength((prev) => (prev === str ? 'all' : str))}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                      selectedStrength === str
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface border border-border text-text hover:border-primary/50'
                    }`}
                  >
                    {str}
                  </button>
                ))}
              </div>
            )}

            {/* Form chips */}
            {formOptions.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-xs font-bold text-text-muted shrink-0 mr-1">ফর্ম:</span>
                <button
                  type="button"
                  onClick={() => setSelectedForm('all')}
                  className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                    selectedForm === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface border border-border text-text hover:border-primary/50'
                  }`}
                >
                  সব
                </button>
                {formOptions.map((frm) => (
                  <button
                    key={frm}
                    type="button"
                    onClick={() => setSelectedForm((prev) => (prev === frm ? 'all' : frm))}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                      selectedForm === frm
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface border border-border text-text hover:border-primary/50'
                    }`}
                  >
                    {frm}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {!isLoggedIn ? (
            <div className="p-6 rounded-2xl bg-surface-2 border border-border text-center space-y-3">
              <Lock className="w-8 h-8 text-primary mx-auto" />
              <p className="text-base font-bold text-text">
                একই জেনেরিকের সব ব্র্যান্ড দেখতে লগইন প্রয়োজন
              </p>
              <p className="text-sm text-text-muted">
                অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে ব্র্যান্ড তালিকা ও দাম তুলনা করুন।
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="min-h-[48px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl cursor-pointer inline-flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>লগইন করুন</span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm font-semibold text-text-muted">
                একই জেনেরিকের ব্র্যান্ড খোঁজা হচ্ছে...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-danger-soft border border-danger/30 text-center space-y-3">
              <p className="text-sm font-semibold text-danger-text">{error}</p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="min-h-[44px] px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold text-text inline-flex items-center gap-1.5 cursor-pointer hover:bg-surface-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>আবার চেষ্টা করুন</span>
              </button>
            </div>
          ) : displayedBrands.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Pill className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-base font-bold text-text">কোনো ব্র্যান্ড পাওয়া যায়নি</p>
              <p className="text-xs text-text-muted">
                {brands.length > 0
                  ? 'বাছাই করা শক্তি বা ফর্ম ফিল্টার পরিবর্তন করে দেখুন।'
                  : 'এই জেনেরিকের জন্য কোনো প্রকাশিত ব্র্যান্ড তালিকায় পাওয়া যায়নি।'}
              </p>
            </div>
          ) : (
            displayedBrands.map((brand) => {
              const priceText = formatBrandPriceBn(brand);
              const hasPrice = priceText !== 'দাম নেই';
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => {
                    onSelectBrand(brand);
                    onClose();
                  }}
                  className="w-full min-h-[72px] p-3.5 sm:p-4 rounded-2xl bg-surface-2/70 hover:bg-primary-soft/50 border border-border hover:border-primary text-left flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-text group-hover:text-primary transition-colors">
                        {brand.brandName}
                      </span>
                      {brand.strength && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary-soft text-primary">
                          {brand.strength}
                        </span>
                      )}
                      {brand.dosageForm && (
                        <span className="text-xs font-medium text-text-muted">
                          {brand.dosageForm}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Building className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{brand.manufacturer || 'কোম্পানি অজানা'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        hasPrice ? 'text-primary' : 'text-text-muted font-medium'
                      }`}
                    >
                      {priceText}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                      <Plus className="w-3.5 h-3.5" />
                      <span>ওষুধে যোগ করুন</span>
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
