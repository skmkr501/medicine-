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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleCloseModal}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4 pr-8">
          <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Pill className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-text">
                {medicine.brandName}
              </h2>
              {canSpeak && (
                <button
                  type="button"
                  onClick={handleToggleSpeak}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-primary-soft border border-primary/25 hover:opacity-90 text-primary font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
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
            <p className="text-xs text-text-muted mt-0.5">
              {medicine.genericName}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
              <span>{medicine.type}</span>
              <span>·</span>
              <span className="font-semibold text-text">{medicine.strength}</span>
              <span>·</span>
              <span className="text-primary font-medium">{medicine.mealTiming}</span>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="space-y-4 text-xs">
          
          {/* Schedules */}
          <div className="bg-surface-2 rounded-xl p-3.5 border border-border">
            <span className="font-semibold text-text flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              দৈনিক সেবনের সময়সূচি ও ডোজ
            </span>
            <div className="grid grid-cols-2 gap-2">
              {medicine.schedules.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-surface p-2.5 rounded-lg border border-border flex justify-between items-center"
                >
                  <span className="font-medium text-text">
                    {s.timeSlot} ({toBengaliNumber(s.time)})
                  </span>
                  <span className="font-bold text-primary">
                    {s.dosage}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Assignment Section (Requirements 6 & 7) */}
          <div className="bg-surface-2 rounded-xl p-3.5 border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  রোগী প্রোফাইল নির্ধারণ
                </span>
                <span className="text-[11px] text-text-muted">
                  {medicine.assignedPatientId
                    ? `বর্তমানে "${patients.find((p) => p.id === medicine.assignedPatientId)?.name || 'প্রোফাইলে'}" যুক্ত`
                    : 'বর্তমানে কোনো নির্দিষ্ট প্রোফাইলে যুক্ত নেই (সাধারণ)'}
                </span>
              </div>
              <select
                value={medicine.assignedPatientId || ''}
                onChange={(e) => assignMedicineToPatient(medicine.id, e.target.value || undefined)}
                className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-hidden focus:border-primary cursor-pointer"
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
          <div className="bg-surface-2 rounded-xl p-3.5 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-text-muted block">বর্তমান মজুত (Stock)</span>
                <span className="text-base font-bold text-text tabular-nums">
                  {toBengaliNumber(medicine.stock)} {medicine.unit}
                </span>
                <span className="text-[11px] text-text-muted ml-2">
                  (সতর্কবার্তা সীমা: {toBengaliNumber(medicine.minStockAlert)} {medicine.unit})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openStockAdjustmentModal(medicine.id)}
                  className="px-3 py-1.5 bg-primary-soft border border-primary/25 rounded-lg font-semibold text-primary hover:opacity-90 flex items-center gap-1 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>সংশোধন / রিফিল</span>
                </button>
              </div>
            </div>

            {/* Smart Stock Predictor Info Box */}
            <div className="p-3 bg-surface rounded-xl border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-primary text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Smart Stock Predictor
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${
                  prediction.status === 'out_of_stock'
                    ? 'bg-danger-soft text-danger-text font-bold'
                    : prediction.status === 'urgent'
                    ? 'bg-danger-soft text-danger-text font-bold'
                    : prediction.status === 'low_stock'
                    ? 'bg-warning-soft text-warning-text font-bold'
                    : 'bg-success-soft text-success-text'
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

              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>দৈনিক প্রয়োজন:</span>
                <span className="font-semibold text-text">
                  {prediction.dailyConsumptionRate > 0
                    ? `${toBengaliNumber(prediction.dailyConsumptionRate)} ${medicine.unit} / দিন`
                    : 'অনির্ধারিত'}
                </span>
              </div>

              {prediction.runoutDate && (
                <div className="flex items-center justify-between text-text-muted text-[11px] pt-1 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary" />
                    সম্ভাব্য শেষ তারিখ:
                  </span>
                  <span className="font-bold text-primary">
                    {formatBengaliDate(prediction.runoutDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Purpose & Prescribing Doctor */}
          <div className="space-y-2">
            {medicine.purpose && (
              <div className="p-3 bg-surface border border-border rounded-lg">
                <span className="text-text-muted block mb-0.5">ওষুধের কারণ / রোগ:</span>
                <span className="font-medium text-text">{medicine.purpose}</span>
              </div>
            )}

            {medicine.doctorName && (
              <div className="p-3 bg-surface border border-border rounded-lg flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <span className="text-text-muted block text-[11px]">প্রেসক্রিপশন প্রদানকারী ডাক্তার:</span>
                  <span className="font-semibold text-text">{medicine.doctorName}</span>
                </div>
              </div>
            )}

            {medicine.instructions && (
              <div className="p-3 bg-warning-soft border border-warning/30 rounded-lg flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-warning-text shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-warning-text block">বিশেষ সতর্কতা ও নির্দেশিকা:</span>
                  <p className="text-text mt-0.5">{medicine.instructions}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-surface border border-border rounded-lg flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Calendar className="w-4 h-4" />
                <span>শুরুর তারিখ: {toBengaliNumber(medicine.startDate)}</span>
              </div>
              <span className="font-medium text-text">
                {medicine.isChronic ? 'দীর্ঘমেয়াদী / নিয়মিত ওষুধ' : `কোর্স: ${toBengaliNumber(medicine.durationDays)} দিন`}
              </span>
            </div>

            {medicine.expiryDate && (
              <div className="p-3 bg-surface border border-border rounded-lg flex items-center justify-between">
                <span className="text-text-muted">প্যাকেটের মেয়াদ শেষের তারিখ:</span>
                <span className="font-semibold text-text">
                  {toBengaliNumber(medicine.expiryDate)}
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`আপনি কি নিশ্চিত যে "${medicine.brandName}" তালিকা থেকে মুছে ফেলতে চান?`)) {
                onDelete(medicine.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-danger-text hover:bg-danger-soft px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-surface-2 hover:bg-border/60 rounded-lg cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>সম্পাদনা</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-1.5 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover rounded-lg cursor-pointer"
            >
              ঠিক আছে
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
