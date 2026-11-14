import React, { useMemo, useEffect } from 'react';
import { GlobalMedicine } from '../../types';
import { findSameGenericAlternatives } from '../../utils/libraryManagement';
import { buildGlobalMedicineDetailSpeechText, useBengaliSpeech } from '../../utils/speechUtils';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Pill,
  Building,
  Plus,
  CheckCircle2,
  Clock,
  Landmark,
  FileBadge,
  Star,
  ArrowRight,
  Volume2,
  Square,
} from 'lucide-react';

interface GlobalMedicineDetailModalProps {
  medicine: GlobalMedicine | null;
  allMedicines?: GlobalMedicine[];
  isFavorite?: boolean;
  onToggleFavorite?: (medicineId: string) => void;
  onSelectMedicine?: (medicine: GlobalMedicine) => void;
  onClose: () => void;
  onAddToMyMedicines: (medicine: GlobalMedicine) => void;
}

export const GlobalMedicineDetailModal: React.FC<GlobalMedicineDetailModalProps> = ({
  medicine,
  allMedicines = [],
  isFavorite = false,
  onToggleFavorite,
  onSelectMedicine,
  onClose,
  onAddToMyMedicines,
}) => {
  const { hasBengaliVoice, isSpeaking, voiceSettings, speak, stop } = useBengaliSpeech();

  useEffect(() => {
    stop();
  }, [medicine?.id, stop]);

  const alternatives = useMemo(() => {
    if (!medicine || !medicine.genericName) return [];
    return findSameGenericAlternatives(allMedicines, medicine.genericName, medicine.id, 10);
  }, [allMedicines, medicine]);

  if (!medicine) return null;

  const isUnpublished = medicine.status !== 'published' || !medicine.verifiedByAdmin;
  const canSpeak = hasBengaliVoice && voiceSettings.enabled;

  const handleCloseModal = () => {
    stop();
    onClose();
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const text = buildGlobalMedicineDetailSpeechText({
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      strength: medicine.strength,
      dosageForm: medicine.dosageForm,
      therapeuticClass: medicine.therapeuticClass,
      indication: medicine.indication,
      packageDescription: medicine.packageDescription,
    });
    speak(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleCloseModal}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 bg-teal-50/50 dark:bg-teal-950/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div className="min-w-0">
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
                {medicine.genericNameBn ? ` (${medicine.genericNameBn})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canSpeak && (
              <button
                type="button"
                onClick={handleToggleSpeak}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                aria-label={isSpeaking ? 'থামুন' : 'শুনুন'}
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>থামুন</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>🔊 শুনুন</span>
                  </>
                )}
              </button>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(medicine.id)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isFavorite
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                aria-label={isFavorite ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
                title={isFavorite ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-500' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                <span className="text-[11px] text-slate-400 block font-medium">খুচরা মূল্য</span>
                <span className="font-bold text-sm text-teal-700 dark:text-teal-400 mt-0.5 block tabular-nums">
                  ৳ {medicine.pricePerUnit.toFixed(2)}
                  {medicine.priceUnit ? ` / ${medicine.priceUnit}` : ''}
                </span>
              </div>
            )}
            {medicine.darNumber && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">নিবন্ধন নম্বর</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {medicine.darNumber}
                </span>
              </div>
            )}
          </div>

          {medicine.packageDescription && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">প্যাকেটের বিবরণ</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {medicine.packageDescription}
              </span>
            </div>
          )}

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

          {/* Same Generic Alternatives */}
          {alternatives.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  একই উপাদানের অন্যান্য ব্র্যান্ড ({alternatives.length}টি)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                  {medicine.genericName}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => onSelectMedicine?.(alt)}
                    className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">
                        {alt.brandName} ({alt.strength})
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        {alt.manufacturer} · {alt.dosageForm}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {alt.pricePerUnit !== undefined && (
                        <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                          ৳{alt.pricePerUnit.toFixed(2)}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provenance Metadata */}
          <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>তথ্যের উৎস ও অনুমোদন</span>
            </div>

            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1.5 divide-y divide-teal-100 dark:divide-teal-950/60">
              <div className="flex items-center justify-between pt-1">
                <span>তথ্যের উৎস:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  {medicine.source === 'DGDA_GOV' || medicine.source === 'DGDA_Official' ? (
                    <>
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                      সরকারি অনুমোদিত তালিকা
                    </>
                  ) : medicine.source === 'MANUFACTURER' ? (
                    <>
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      প্রস্তুতকারকের তথ্য
                    </>
                  ) : medicine.source === 'INDEPENDENT_VERIFIED' ? (
                    <>
                      <FileBadge className="w-3.5 h-3.5 text-purple-600" />
                      চিকিৎসা যাচাইকৃত তথ্য
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      যাচাইকৃত তালিকা
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span>লাইসেন্স / কর্তৃপক্ষ রেফারেন্স:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]" title={medicine.licenseReference && !medicine.licenseReference.includes('DGDA') ? medicine.licenseReference : 'অনুমোদিত সরকারি তথ্যসূত্র'}>
                  {medicine.licenseReference && !medicine.licenseReference.includes('DGDA')
                    ? medicine.licenseReference
                    : 'অনুমোদিত সরকারি তথ্যসূত্র'}
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
                    অপেক্ষমাণ খসড়া
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
            onClick={handleCloseModal}
            className="min-h-[48px] px-5 py-2.5 text-base font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer rounded-xl"
          >
            বন্ধ করুন
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose();
              onAddToMyMedicines(medicine);
            }}
            className="min-h-[48px] flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-base rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>আমার ওষুধ তালিকায় যোগ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
