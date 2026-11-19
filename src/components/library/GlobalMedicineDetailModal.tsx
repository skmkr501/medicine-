import React, { useMemo, useEffect, useState } from 'react';
import { GlobalMedicine } from '../../types';
import { findSameGenericAlternatives } from '../../utils/libraryManagement';
import { fetchSameGenericAlternativesFromSupabase } from '../../supabase/libraryService';
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
  const [remoteAlternatives, setRemoteAlternatives] = useState<GlobalMedicine[]>([]);

  useEffect(() => {
    stop();
  }, [medicine?.id, stop]);

  useEffect(() => {
    if (!medicine || !medicine.genericName || allMedicines.length > 0) {
      setRemoteAlternatives([]);
      return;
    }
    let cancelled = false;
    void fetchSameGenericAlternativesFromSupabase(medicine.genericName, medicine.id, 10)
      .then((alts) => {
        if (!cancelled) setRemoteAlternatives(alts);
      })
      .catch(() => {
        if (!cancelled) setRemoteAlternatives([]);
      });
    return () => {
      cancelled = true;
    };
  }, [medicine?.id, medicine?.genericName, allMedicines.length]);

  const alternatives = useMemo(() => {
    if (!medicine || !medicine.genericName) return [];
    if (allMedicines.length > 0) {
      return findSameGenericAlternatives(allMedicines, medicine.genericName, medicine.id, 10);
    }
    return remoteAlternatives;
  }, [allMedicines, remoteAlternatives, medicine]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleCloseModal}
    >
      <div
        className="bg-surface rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-2 bg-primary-soft/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-text">
                  {medicine.brandName}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-soft text-primary">
                  {medicine.strength}
                </span>
                {isUnpublished && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-warning-soft text-warning-text flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    অপ্রকাশিত খসড়া
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted font-medium mt-0.5">
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
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-surface border border-primary/30 text-primary font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer hover:bg-primary-soft"
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
                    ? 'text-amber-500 bg-warning-soft'
                    : 'text-text-muted hover:text-amber-500 hover:bg-surface-2'
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
              className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-text">
          {/* Key Specifications Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[11px] text-text-muted block font-medium">ডোজের ধরন</span>
              <span className="font-semibold text-text mt-0.5 block">
                {medicine.dosageForm}
              </span>
            </div>
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[11px] text-text-muted block font-medium">প্রস্তুতকারক প্রতিষ্ঠান</span>
              <span className="font-semibold text-text mt-0.5 block truncate" title={medicine.manufacturer}>
                {medicine.manufacturer}
              </span>
            </div>
            {medicine.pricePerUnit !== undefined && (
              <div className="p-3 bg-surface-2 rounded-xl border border-border">
                <span className="text-[11px] text-text-muted block font-medium">খুচরা মূল্য</span>
                <span className="font-bold text-sm text-primary mt-0.5 block tabular-nums">
                  ৳ {medicine.pricePerUnit.toFixed(2)}
                  {medicine.priceUnit ? ` / ${medicine.priceUnit}` : ''}
                </span>
              </div>
            )}
            {medicine.darNumber && (
              <div className="p-3 bg-surface-2 rounded-xl border border-border">
                <span className="text-[11px] text-text-muted block font-medium">নিবন্ধন নম্বর</span>
                <span className="font-semibold text-text mt-0.5 block truncate">
                  {medicine.darNumber}
                </span>
              </div>
            )}
          </div>

          {medicine.packageDescription && (
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[11px] text-text-muted block font-medium">প্যাকেটের বিবরণ</span>
              <span className="font-semibold text-text mt-0.5 block">
                {medicine.packageDescription}
              </span>
            </div>
          )}

          {/* Indication / Therapeutic Info */}
          {(medicine.indication || medicine.therapeuticClass) && (
            <div className="p-3.5 bg-surface-2 rounded-xl border border-border space-y-2">
              {medicine.therapeuticClass && (
                <div>
                  <span className="text-[11px] text-text-muted block font-medium">থেরাপিউটিক ক্লাস</span>
                  <p className="font-medium text-text mt-0.5">
                    {medicine.therapeuticClass}
                  </p>
                </div>
              )}
              {medicine.indication && (
                <div>
                  <span className="text-[11px] text-text-muted block font-medium">নির্দেশনা ও ব্যবহার</span>
                  <p className="font-medium text-text mt-0.5 leading-relaxed">
                    {medicine.indication}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Same Generic Alternatives */}
          {alternatives.length > 0 && (
            <div className="p-3.5 rounded-xl border border-border bg-surface-2/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text text-xs">
                  একই উপাদানের অন্যান্য ব্র্যান্ড ({alternatives.length}টি)
                </span>
                <span className="text-[11px] text-text-muted truncate max-w-[160px]">
                  {medicine.genericName}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => onSelectMedicine?.(alt)}
                    className="w-full text-left p-2.5 rounded-xl bg-surface border border-border hover:border-primary flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-text block truncate">
                        {alt.brandName} ({alt.strength})
                      </span>
                      <span className="text-[11px] text-text-muted block truncate">
                        {alt.manufacturer} · {alt.dosageForm}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {alt.pricePerUnit !== undefined && (
                        <span className="font-bold text-primary tabular-nums">
                          ৳{alt.pricePerUnit.toFixed(2)}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provenance Metadata */}
          <div className="p-3.5 rounded-xl border border-primary/25 bg-primary-soft/50 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span>তথ্যের উৎস ও অনুমোদন</span>
            </div>

            <div className="text-sm text-text-muted space-y-1.5 divide-y divide-primary/15">
              <div className="flex items-center justify-between pt-1">
                <span>তথ্যের উৎস:</span>
                <span className="font-semibold text-text flex items-center gap-1">
                  {medicine.source === 'DGDA_GOV' || medicine.source === 'DGDA_Official' ? (
                    <>
                      <Landmark className="w-3.5 h-3.5 text-success-text" />
                      সরকারি অনুমোদিত তালিকা
                    </>
                  ) : medicine.source === 'MANUFACTURER' ? (
                    <>
                      <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      প্রস্তুতকারকের তথ্য
                    </>
                  ) : medicine.source === 'INDEPENDENT_VERIFIED' ? (
                    <>
                      <FileBadge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      চিকিৎসা যাচাইকৃত তথ্য
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-warning-text" />
                      যাচাইকৃত তালিকা
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span>লাইসেন্স / কর্তৃপক্ষ রেফারেন্স:</span>
                <span className="font-semibold text-text truncate max-w-[220px]" title={medicine.licenseReference && !medicine.licenseReference.includes('DGDA') ? medicine.licenseReference : 'অনুমোদিত সরকারি তথ্যসূত্র'}>
                  {medicine.licenseReference && !medicine.licenseReference.includes('DGDA')
                    ? medicine.licenseReference
                    : 'অনুমোদিত সরকারি তথ্যসূত্র'}
                </span>
              </div>

              {medicine.writtenPermissionRef && (
                <div className="flex items-center justify-between pt-1.5">
                  <span>লিখিত চুক্তি / অনুমতি সনদ:</span>
                  <span className="font-semibold text-warning-text truncate max-w-[220px]" title={medicine.writtenPermissionRef}>
                    {medicine.writtenPermissionRef}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5">
                <span>প্রকাশনা ও যাচাইকরণ স্থিতি:</span>
                {!isUnpublished ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-success-text">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    যাচাইকৃত ও সার্বজনীন প্রকাশিত
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-warning-text">
                    <Clock className="w-3.5 h-3.5" />
                    অপেক্ষমাণ খসড়া
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-2/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCloseModal}
            className="min-h-[48px] px-5 py-2.5 text-base font-semibold text-text-muted hover:text-text cursor-pointer rounded-xl"
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
            className="min-h-[48px] flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>আমার ওষুধ তালিকায় যোগ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
