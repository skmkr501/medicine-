import React from 'react';
import { GlobalMedicine } from '../../types';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Pill,
  Building,
  FileText,
  Tag,
  Plus,
  CheckCircle2,
  Clock,
  Landmark,
  FileBadge,
} from 'lucide-react';

interface GlobalMedicineDetailModalProps {
  medicine: GlobalMedicine | null;
  onClose: () => void;
  onAddToMyMedicines: (medicine: GlobalMedicine) => void;
}

export const GlobalMedicineDetailModal: React.FC<GlobalMedicineDetailModalProps> = ({
  medicine,
  onClose,
  onAddToMyMedicines,
}) => {
  if (!medicine) return null;

  const isUnpublished = medicine.status !== 'published' || !medicine.verifiedByAdmin;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-teal-50/50 dark:bg-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {medicine.brandName}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                  {medicine.strength}
                </span>
                {isUnpublished && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    অপ্রকাশিত খসড়া
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {medicine.genericName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300">
          
          {/* Key Specifications Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">ডোজের ধরন</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {medicine.dosageForm}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">প্রস্তুতকারক প্রতিষ্ঠান</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block truncate" title={medicine.manufacturer}>
                {medicine.manufacturer}
              </span>
            </div>
            {medicine.pricePerUnit !== undefined && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">খুচরা মূল্য (প্রতি ইউনিট)</span>
                <span className="font-semibold text-teal-700 dark:text-teal-400 mt-0.5 block">
                  ৳ {medicine.pricePerUnit.toFixed(2)}
                </span>
              </div>
            )}
            {medicine.darNumber && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">DGDA নিবন্ধন (DAR No)</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {medicine.darNumber}
                </span>
              </div>
            )}
          </div>

          {/* Indication / Therapeutic Info */}
          {(medicine.indication || medicine.therapeuticClass) && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
              {medicine.therapeuticClass && (
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">থেরাপিউটিক ক্লাস</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {medicine.therapeuticClass}
                  </p>
                </div>
              )}
              {medicine.indication && (
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">নির্দেশনা ও ব্যবহার</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                    {medicine.indication}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Strict Legal Compliance & Provenance Metadata (Requirements 1, 2, 5, 6) */}
          <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>আইনি উৎস, সনদ ও মেটাডাটা (Legal Provenance & License)</span>
            </div>
            
            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 divide-y divide-teal-100 dark:divide-teal-950/60">
              
              <div className="flex items-center justify-between pt-1">
                <span>ডাটা উৎস কাঠামো:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  {medicine.source === 'DGDA_GOV' || medicine.source === 'DGDA_Official' ? (
                    <>
                      <Landmark className="w-3 h-3 text-emerald-600" />
                      DGDA সরকারি উন্মুক্ত গেজেট
                    </>
                  ) : medicine.source === 'MANUFACTURER' ? (
                    <>
                      <Building className="w-3 h-3 text-blue-600" />
                      প্রস্তুতকারকের অফিসিয়াল মনোগ্রাফ
                    </>
                  ) : medicine.source === 'INDEPENDENT_VERIFIED' ? (
                    <>
                      <FileBadge className="w-3 h-3 text-purple-600" />
                      স্বাধীন ক্লিনিক্যাল ডাটা
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      {medicine.source} (লাইসেন্সপ্রাপ্ত পার্টনার)
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span>লাইসেন্স / কর্তৃপক্ষ রেফারেন্স:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]" title={medicine.licenseReference}>
                  {medicine.licenseReference || 'DGDA Authorized Public Record'}
                </span>
              </div>

              {medicine.writtenPermissionRef && (
                <div className="flex items-center justify-between pt-1.5">
                  <span>লিখিত চুক্তি / অনুমতি সনদ:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 truncate max-w-[220px]" title={medicine.writtenPermissionRef}>
                    {medicine.writtenPermissionRef}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5">
                <span>প্রকাশনা ও যাচাইকরণ স্থিতি:</span>
                {!isUnpublished ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    যাচাইকৃত ও সার্বজনীন প্রকাশিত
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    অপেক্ষমাণ খসড়া (Unpublished)
                  </span>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            বন্ধ করুন
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddToMyMedicines(medicine);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>আমার ওষুধে যোগ করুন</span>
          </button>
        </div>

      </div>
    </div>
  );
};
