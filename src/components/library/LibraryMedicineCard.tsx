import React from 'react';
import {
  Building,
  Check,
  Clock,
  FileBadge,
  Landmark,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { GlobalMedicine } from '../../types';

interface LibraryMedicineCardProps {
  med: GlobalMedicine;
  isAdmin: boolean;
  isFavorite: boolean;
  isUnpublished: boolean;
  isPendingPublish?: boolean;
  isTest: boolean;
  isDraftSelected: boolean;
  isPublishing: boolean;
  onToggleFavorite: (e: React.MouseEvent, medId: string) => void;
  onToggleDraftSelection: (medId: string) => void;
  onOpenDetail: (med: GlobalMedicine) => void;
  onQuickPublish: (e: React.MouseEvent, medId: string) => void;
  onPromptDelete: (e: React.MouseEvent, med: GlobalMedicine) => void;
  onAddToPersonal: (med: GlobalMedicine) => void;
  canViewGenericBrands?: boolean;
  onOpenGenericBrands?: (med: GlobalMedicine) => void;
}

function renderSourceBadge(med: GlobalMedicine) {
  if (med.source === 'DGDA_GOV' || med.source === 'DGDA_Official') {
    return (
      <span className="inline-flex items-center gap-1 bg-success-soft text-success-text border border-success/30 px-2 py-0.5 rounded-md font-medium text-[10px]">
        <Landmark className="w-3 h-3 text-success-text" />
        সরকারি অনুমোদিত তালিকা
      </span>
    );
  }
  if (med.source === 'MANUFACTURER') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
        <Building className="w-3 h-3 text-blue-600 dark:text-blue-400" />
        প্রস্তুতকারক মনোগ্রাফ
      </span>
    );
  }
  if (med.source === 'INDEPENDENT_VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
        <FileBadge className="w-3 h-3 text-purple-600 dark:text-purple-400" />
        ক্লিনিক্যাল যাচাইকৃত
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-primary-soft text-primary border border-primary/25 px-2 py-0.5 rounded-md font-medium text-[10px]">
      <ShieldCheck className="w-3 h-3 text-primary" />
      লাইসেন্সপ্রাপ্ত পার্টনার ({med.source})
    </span>
  );
}

export const LibraryMedicineCard: React.FC<LibraryMedicineCardProps> = React.memo(
  ({
    med,
    isAdmin,
    isFavorite,
    isUnpublished,
    isPendingPublish = false,
    isTest,
    isDraftSelected,
    isPublishing,
    onToggleFavorite,
    onToggleDraftSelection,
    onOpenDetail,
    onQuickPublish,
    onPromptDelete,
    onAddToPersonal,
    canViewGenericBrands = false,
    onOpenGenericBrands,
  }) => {
    return (
      <div
        className={`bg-surface rounded-2xl p-4 border transition-all flex flex-col justify-between group shadow-xs ${
          isUnpublished
            ? isTest
              ? 'border-danger/45 bg-danger-soft/30'
              : 'border-warning/45 bg-warning-soft/30'
            : 'border-border hover:border-primary/60 hover:shadow-md'
        }`}
      >
        <div>
          {/* Top Row: Brand & Strength + Form badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              {isAdmin && isUnpublished && isTest && (
                <input
                  type="checkbox"
                  checked={isDraftSelected}
                  onChange={() => onToggleDraftSelection(med.id)}
                  className="mt-1 w-4 h-4 rounded accent-danger cursor-pointer shrink-0"
                  aria-label={`${med.brandName} নির্বাচন করুন`}
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-base font-bold text-text group-hover:text-primary transition-colors">
                    {med.brandName}
                  </h3>
                  {isAdmin && isPendingPublish && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary-soft text-primary border border-primary/30 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      অপেক্ষমাণ
                    </span>
                  )}
                  {isUnpublished && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning-soft text-warning-text flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      অপ্রকাশিত
                    </span>
                  )}
                  {isTest && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-danger-soft text-danger-text border border-danger/30">
                      TEST DATA
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-text-muted mt-0.5">{med.genericName}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                  {med.strength}
                </span>
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(e, med.id)}
                  aria-label={isFavorite ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    isFavorite
                      ? 'text-amber-500 bg-warning-soft'
                      : 'text-text-muted hover:text-amber-500 hover:bg-surface-2'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
                </button>
              </div>
              <span className="text-[10px] text-text-muted font-medium">{med.dosageForm}</span>
            </div>
          </div>

          {/* Company & Price */}
          <div className="mt-3 pt-3 border-t border-border text-xs space-y-1.5">
            <div
              className="flex items-center gap-1.5 text-text-muted truncate"
              title={med.manufacturer}
            >
              <Building className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <span className="truncate">{med.manufacturer}</span>
            </div>

            {med.pricePerUnit !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">খুচরা মূল্য:</span>
                <span className="font-bold text-primary tabular-nums">
                  ৳ {med.pricePerUnit.toFixed(2)}
                  {med.priceUnit ? ` / ${med.priceUnit}` : ''}
                </span>
              </div>
            )}

            {med.indication && (
              <p className="text-[11px] text-text-muted line-clamp-1 mt-1">{med.indication}</p>
            )}
          </div>

          {/* Source and License Badge */}
          <div className="mt-2.5 flex items-center justify-between gap-1 text-[10px] text-text-muted">
            {renderSourceBadge(med)}
            {med.darNumber && (
              <span className="truncate max-w-[120px]" title={med.darNumber}>
                নিবন্ধন: {med.darNumber}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDetail(med)}
              className="min-h-[48px] flex-1 py-2.5 px-3 text-base font-semibold text-text bg-surface-2 hover:bg-border/60 rounded-xl transition-colors cursor-pointer text-center"
            >
              বিস্তারিত
            </button>

            {/* If unpublished & user is Admin, allow one-click Verify & Publish */}
            {isAdmin && isUnpublished ? (
              <>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={(e) => onQuickPublish(e, med.id)}
                  className="min-h-[48px] flex items-center justify-center gap-1 py-2.5 px-4 text-base font-semibold text-white bg-[#B45309] hover:bg-[#92400E] rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  title="যাচাই ও সার্বজনীন প্রকাশ করুন"
                >
                  <Check className="w-4 h-4" />
                  <span>{isPublishing ? 'প্রকাশ হচ্ছে...' : 'অনুমোদন'}</span>
                </button>

                {/* Safe Delete Option for Draft TEST DATA */}
                <button
                  type="button"
                  onClick={(e) => onPromptDelete(e, med)}
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 text-sm font-semibold text-danger-text bg-danger-soft hover:bg-danger/15 rounded-xl border border-danger/35 transition-colors cursor-pointer shrink-0"
                  title="এই রেকর্ডটি মুছে ফেলুন"
                  aria-label={`${med.brandName} মুছে ফেলুন`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAddToPersonal(med)}
                className="min-h-[48px] flex items-center justify-center gap-1.5 py-2.5 px-4 text-base font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                title="আমার ওষুধ তালিকায় যোগ করুন"
              >
                <Plus className="w-5 h-5" />
                <span>যোগ করুন</span>
              </button>
            )}
          </div>

          {canViewGenericBrands && med.genericName?.trim() && onOpenGenericBrands && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGenericBrands(med);
              }}
              className="min-h-[44px] w-full py-2 px-3 text-xs sm:text-sm font-bold text-primary bg-primary-soft/75 hover:bg-primary-soft border border-primary/25 rounded-xl transition-colors cursor-pointer text-center"
            >
              একই জেনেরিকের সব ব্র্যান্ড
            </button>
          )}
        </div>
      </div>
    );
  }
);

LibraryMedicineCard.displayName = 'LibraryMedicineCard';
