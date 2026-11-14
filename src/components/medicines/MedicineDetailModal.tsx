import React, { useEffect } from 'react';
import { Medicine } from '../../types';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { useMedicine } from '../../context/MedicineContext';
import { predictMedicineStock } from '../../utils/stockPredictor';
import { findMatchingCatalogMedicine } from '../../utils/shoppingListCalculator';
import { buildMedicineDetailSpeechText, useBengaliSpeech } from '../../utils/speechUtils';
import {
  X,
  Pill,
  Clock,
  Calendar,
  AlertCircle,
  UserCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Users,
  Sparkles,
  Package,
  Volume2,
  Square,
} from 'lucide-react';

interface MedicineDetailModalProps {
  medicine: Medicine | null;
  onClose: () => void;
  onEdit: (med: Medicine) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (id: string, delta: number) => void;
}

export const MedicineDetailModal: React.FC<MedicineDetailModalProps> = ({
  medicine,
  onClose,
  onEdit,
  onDelete,
  onAdjustStock,
}) => {
  const { patients, globalMedicines, assignMedicineToPatient, openStockAdjustmentModal } = useMedicine();
  const { hasBengaliVoice, isSpeaking, voiceSettings, speak, stop } = useBengaliSpeech();

  useEffect(() => {
    stop();
  }, [medicine?.id, stop]);

  if (!medicine) return null;

  const prediction = predictMedicineStock(medicine);
  const catalogMatch = findMatchingCatalogMedicine(medicine, globalMedicines);
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
    const text = buildMedicineDetailSpeechText({
      brandName: medicine.brandName,
      purpose: medicine.purpose,
      indication: catalogMatch.medicine?.indication,
      therapeuticClass: catalogMatch.medicine?.therapeuticClass,
      type: medicine.type,
      mealTiming: medicine.mealTiming,
      schedules: medicine.schedules,
      instructions: medicine.instructions,
    });
    speak(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleCloseModal}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4 pr-8">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Pill className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {medicine.brandName}
              </h2>
              {canSpeak && (
                <button
                  type="button"
                  onClick={handleToggleSpeak}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-teal-800 dark:text-teal-200 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
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
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {medicine.genericName}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-1">
              <span>{medicine.type}</span>
              <span>·</span>
              <span className="font-semibold">{medicine.strength}</span>
              <span>·</span>
              <span className="text-teal-700 dark:text-teal-400">{medicine.mealTiming}</span>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="space-y-4 text-xs">
          
          {/* Schedules */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-teal-600" />
              দৈনিক সেবনের সময়সূচি ও ডোজ
            </span>
            <div className="grid grid-cols-2 gap-2">
              {medicine.schedules.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {s.timeSlot} ({toBengaliNumber(s.time)})
                  </span>
                  <span className="font-bold text-teal-800 dark:text-teal-300">
                    {s.dosage}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Assignment Section (Requirements 6 & 7) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-600" />
                  রোগী প্রোফাইল নির্ধারণ
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {medicine.assignedPatientId
                    ? `বর্তমানে "${patients.find((p) => p.id === medicine.assignedPatientId)?.name || 'প্রোফাইলে'}" যুক্ত`
                    : 'বর্তমানে কোনো নির্দিষ্ট প্রোফাইলে যুক্ত নেই (সাধারণ)'}
                </span>
              </div>
              <select
                value={medicine.assignedPatientId || ''}
                onChange={(e) => assignMedicineToPatient(medicine.id, e.target.value || undefined)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="">কোনো প্রোফাইলে নেই (সাধারণ)</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Details & Smart Predictor */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">বর্তমান মজুত (Stock)</span>
                <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {toBengaliNumber(medicine.stock)} {medicine.unit}
                </span>
                <span className="text-[11px] text-slate-400 ml-2">
                  (সতর্কবার্তা সীমা: {toBengaliNumber(medicine.minStockAlert)} {medicine.unit})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openStockAdjustmentModal(medicine.id)}
                  className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 rounded-lg font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 flex items-center gap-1 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>সংশোধন / রিফিল</span>
                </button>
              </div>
            </div>

            {/* Smart Stock Predictor Info Box */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Smart Stock Predictor
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${
                  prediction.status === 'out_of_stock'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold'
                    : prediction.status === 'urgent'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                    : prediction.status === 'low_stock'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {prediction.status === 'out_of_stock'
                    ? 'স্টক শূন্য'
                    : prediction.status === 'urgent'
                    ? `জরুরি · আর ${toBengaliNumber(prediction.daysRemaining ?? 0)} দিন`
                    : prediction.status === 'low_stock'
                    ? `স্বল্প স্টক · আর ${toBengaliNumber(prediction.daysRemaining ?? 0)} দিন`
                    : `পর্যাপ্ত · ${toBengaliNumber(prediction.daysRemaining ?? 0)} দিন`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>দৈনিক প্রয়োজন:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {prediction.dailyConsumptionRate > 0
                    ? `${toBengaliNumber(prediction.dailyConsumptionRate)} ${medicine.unit} / দিন`
                    : 'অনির্ধারিত'}
                </span>
              </div>

              {prediction.runoutDate && (
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-teal-600" />
                    সম্ভাব্য শেষ তারিখ:
                  </span>
                  <span className="font-bold text-teal-700 dark:text-teal-400">
                    {formatBengaliDate(prediction.runoutDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Purpose & Prescribing Doctor */}
          <div className="space-y-2">
            {medicine.purpose && (
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <span className="text-slate-400 block mb-0.5">ওষুধের কারণ / রোগ:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{medicine.purpose}</span>
              </div>
            )}

            {medicine.doctorName && (
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">প্রেসক্রিপশন প্রদানকারী ডাক্তার:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{medicine.doctorName}</span>
                </div>
              </div>
            )}

            {medicine.instructions && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-900 dark:text-amber-200 block">বিশেষ সতর্কতা ও নির্দেশিকা:</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">{medicine.instructions}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>শুরুর তারিখ: {toBengaliNumber(medicine.startDate)}</span>
              </div>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {medicine.isChronic ? 'দীর্ঘমেয়াদী / নিয়মিত ওষুধ' : `কোর্স: ${toBengaliNumber(medicine.durationDays)} দিন`}
              </span>
            </div>

            {medicine.expiryDate && (
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-500">প্যাকেটের মেয়াদ শেষের তারিখ:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {toBengaliNumber(medicine.expiryDate)}
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`আপনি কি নিশ্চিত যে "${medicine.brandName}" তালিকা থেকে মুছে ফেলতে চান?`)) {
                onDelete(medicine.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>মুছে ফেলুন</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stop();
                onClose();
                onEdit(medicine);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>সম্পাদনা</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              ঠিক আছে
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
