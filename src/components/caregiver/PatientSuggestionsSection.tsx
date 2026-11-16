import React, { useState } from 'react';
import {
  CaregiverSuggestionDoc,
  MealTiming,
  MedicineType,
  TimeSlot,
} from '../../types';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { formatAlertRelativeTimeBn } from '../../utils/caregiverAlerts';
import {
  SUGGESTION_SLOT_ORDER,
  buildSuggestionSummaryHeadlineBn,
  findTargetMedicineForSuggestion,
  resolveUnitFromMedicineType,
} from '../../utils/caregiverSuggestions';
import {
  BellDot,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

const MEDICINE_TYPES: MedicineType[] = [
  'ট্যাবলেট',
  'ক্যাপসুল',
  'সিরাপ',
  'ইনসুলিন/ইনজেকশন',
  'চোখের ড্রপ',
  'ইনহেলার',
  'মলম/জেল',
];

const MEAL_TIMINGS: MealTiming[] = [
  'খাওয়ার পরে',
  'খাওয়ার আগে',
  'খালি পেটে',
  'প্রয়োজনমতো',
];

export const PatientSuggestionsSection: React.FC = () => {
  const {
    currentUser,
    medicines,
    patients,
    activePatientId,
    pendingPatientSuggestions,
    acceptCaregiverSuggestion,
    rejectCaregiverSuggestion,
  } = useMedicine();

  const [reviewingSuggestion, setReviewingSuggestion] =
    useState<CaregiverSuggestionDoc | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Editable review state
  const [brandName, setBrandName] = useState('');
  const [strength, setStrength] = useState('');
  const [type, setType] = useState<MedicineType>('ট্যাবলেট');
  const [dosage, setDosage] = useState('১টি');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(['সকাল']);
  const [mealTiming, setMealTiming] = useState<MealTiming>('খাওয়ার পরে');
  const [isChronic, setIsChronic] = useState(false);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [stock, setStock] = useState<number>(10);
  const [unit, setUnit] = useState('টি');
  const [assignedPatientId, setAssignedPatientId] = useState<string>('');

  if (!currentUser || pendingPatientSuggestions.length === 0) {
    return null;
  }

  const openReviewModal = (suggestion: CaregiverSuggestionDoc) => {
    const m = suggestion.medicine;
    const target = findTargetMedicineForSuggestion(medicines, suggestion);
    setReviewingSuggestion(suggestion);
    setBrandName(m.brandName);
    setStrength(m.strength || '');
    setType(m.type || 'ট্যাবলেট');
    setDosage(m.dosage || '১টি');
    setTimeSlots(m.timeSlots && m.timeSlots.length > 0 ? m.timeSlots : ['সকাল']);
    setMealTiming(m.mealTiming || 'খাওয়ার পরে');
    setIsChronic(Boolean(m.isChronic));
    setDurationDays(m.durationDays || 7);
    setStock(typeof m.stock === 'number' ? m.stock : 0);
    setUnit(m.unit || resolveUnitFromMedicineType(m.type || 'ট্যাবলেট'));
    setAssignedPatientId(
      target?.assignedPatientId || activePatientId || patients[0]?.id || ''
    );
  };

  const handleReject = async (suggestionId: string) => {
    setBusyId(suggestionId);
    try {
      await rejectCaregiverSuggestion(suggestionId);
      if (reviewingSuggestion?.id === suggestionId) {
        setReviewingSuggestion(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleSlot = (slot: TimeSlot) => {
    if (timeSlots.includes(slot)) {
      if (timeSlots.length <= 1) return;
      setTimeSlots(timeSlots.filter((s) => s !== slot));
    } else {
      const next = [...timeSlots, slot].sort(
        (a, b) => SUGGESTION_SLOT_ORDER.indexOf(a) - SUGGESTION_SLOT_ORDER.indexOf(b)
      );
      setTimeSlots(next);
    }
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingSuggestion) return;
    setBusyId(reviewingSuggestion.id);
    try {
      const ok = await acceptCaregiverSuggestion(reviewingSuggestion, {
        brandName: brandName.trim() || reviewingSuggestion.medicine.brandName,
        strength: strength.trim() || undefined,
        type,
        dosage: dosage.trim() || '১টি',
        timeSlots,
        mealTiming,
        isChronic,
        durationDays: isChronic ? undefined : Number(durationDays) || 7,
        stock: Number(stock) || 0,
        unit: unit.trim() || resolveUnitFromMedicineType(type),
        assignedPatientId: assignedPatientId || undefined,
      });
      if (ok) {
        setReviewingSuggestion(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section
        aria-label="পরিবারের ওষুধের প্রস্তাব"
        className="rounded-2xl bg-primary-soft/75 border-2 border-primary/35 p-4 sm:p-5 space-y-3.5 shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
              <BellDot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text">
                পরিবারের প্রস্তাব ({toBengaliNumber(pendingPatientSuggestions.length)}টি)
              </h2>
              <p className="text-xs sm:text-sm text-text-muted flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>আপনি অনুমোদন না দিলে তালিকায় কিছুই বদলাবে না</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {pendingPatientSuggestions.map((sug) => {
            const isBusy = busyId === sug.id;
            return (
              <div
                key={sug.id}
                className="p-4 rounded-xl bg-surface border border-border space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      sug.kind === 'stop'
                        ? 'bg-danger-soft text-danger-text'
                        : sug.kind === 'edit'
                        ? 'bg-warning-soft text-warning-text'
                        : 'bg-primary-soft text-primary'
                    }`}
                  >
                    {sug.kind === 'stop'
                      ? 'বন্ধের প্রস্তাব'
                      : sug.kind === 'edit'
                      ? 'বদলের প্রস্তাব'
                      : 'নতুন ওষুধের প্রস্তাব'}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatAlertRelativeTimeBn(new Date(sug.createdAtMs).toISOString())}
                  </span>
                </div>

                <p className="text-base sm:text-lg font-bold text-text leading-snug">
                  {buildSuggestionSummaryHeadlineBn(sug)}
                </p>

                {sug.note && (
                  <p className="text-sm text-text-muted bg-surface-2 px-3 py-2 rounded-lg">
                    নোট: “{sug.note}”
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openReviewModal(sug)}
                    className="min-h-[48px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span>দেখে অনুমোদন করুন</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleReject(sug.id)}
                    className="min-h-[48px] px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-danger-soft hover:text-danger-text border border-border text-text font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <X className="w-4 h-4 shrink-0" />
                    <span>বাতিল</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Editable Approval Review Modal */}
      {reviewingSuggestion && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-suggestion-title"
        >
          <div className="bg-surface border border-border rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h3 id="review-suggestion-title" className="text-lg sm:text-xl font-bold text-text">
                  {reviewingSuggestion.kind === 'stop'
                    ? 'ওষুধ বন্ধের প্রস্তাব যাচাই'
                    : reviewingSuggestion.kind === 'edit'
                    ? 'ওষুধ বদলের প্রস্তাব যাচাই'
                    : 'নতুন ওষুধ যোগের প্রস্তাব যাচাই'}
                </h3>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  প্রস্তাব পাঠিয়েছেন: <strong>{reviewingSuggestion.caregiverName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingSuggestion(null)}
                aria-label="বন্ধ করুন"
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-2 text-text cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleConfirmApprove} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {reviewingSuggestion.kind === 'stop' ? (
                <div className="p-4 rounded-2xl bg-danger-soft border border-danger/30 space-y-2">
                  <div className="flex items-center gap-2 text-danger-text font-bold text-base">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>নিশ্চিত হয়ে নিন</span>
                  </div>
                  <p className="text-base font-bold text-text">
                    আপনি কি “{reviewingSuggestion.targetMedicineName || reviewingSuggestion.medicine.brandName}” ওষুধটি বন্ধ (বিরতি) করতে চান?
                  </p>
                  {reviewingSuggestion.note && (
                    <p className="text-sm text-text-muted">
                      কারণ: “{reviewingSuggestion.note}”
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs sm:text-sm text-text-muted bg-primary-soft px-3.5 py-2.5 rounded-xl border border-primary/20">
                    প্রয়োজনে নিচের যেকোনো তথ্য সংশোধন করে তারপর অনুমোদন করুন। অনুমোদনের সাথে সাথে রিমাইন্ডার চালু হবে।
                  </p>

                  {patients.length > 1 && (
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">
                        কার জন্য ওষুধটি?
                      </label>
                      <select
                        value={assignedPatientId}
                        onChange={(e) => setAssignedPatientId(e.target.value)}
                        className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.relation})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">ওষুধের নাম</label>
                      <input
                        type="text"
                        required
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">শক্তি</label>
                      <input
                        type="text"
                        value={strength}
                        onChange={(e) => setStrength(e.target.value)}
                        className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">ধরন</label>
                      <select
                        value={type}
                        onChange={(e) => {
                          const next = e.target.value as MedicineType;
                          setType(next);
                          setUnit(resolveUnitFromMedicineType(next));
                        }}
                        className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                      >
                        {MEDICINE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">প্রতি বারের পরিমাণ</label>
                      <input
                        type="text"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-text">খাওয়ার সময়</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SUGGESTION_SLOT_ORDER.map((slot) => {
                        const active = timeSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleSlot(slot)}
                            className={`min-h-[48px] px-3 py-2 rounded-xl font-bold text-sm border cursor-pointer ${
                              active
                                ? 'bg-primary border-primary text-on-primary'
                                : 'bg-surface-2 border-border text-text'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">খাবারের নিয়ম</label>
                      <select
                        value={mealTiming}
                        onChange={(e) => setMealTiming(e.target.value as MealTiming)}
                        className="min-h-[48px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text focus:outline-hidden focus:border-primary"
                      >
                        {MEAL_TIMINGS.map((mt) => (
                          <option key={mt} value={mt}>
                            {mt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">কয়দিন</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          disabled={isChronic}
                          value={durationDays}
                          onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))}
                          className="min-h-[48px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text disabled:opacity-45"
                        />
                        <button
                          type="button"
                          onClick={() => setIsChronic((prev) => !prev)}
                          className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs font-bold border shrink-0 cursor-pointer ${
                            isChronic
                              ? 'bg-primary border-primary text-on-primary'
                              : 'bg-surface-2 border-border text-text'
                          }`}
                        >
                          চলমান
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-bold text-text">মজুদ ({unit})</label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={stock}
                        onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                        className="min-h-[48px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={busyId === reviewingSuggestion.id}
                  onClick={() => handleReject(reviewingSuggestion.id)}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-danger-soft text-danger-text font-bold text-base cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={busyId === reviewingSuggestion.id}
                  className={`min-h-[52px] px-6 py-2.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-pointer ${
                    reviewingSuggestion.kind === 'stop'
                      ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                      : 'bg-[#15803D] hover:bg-[#166534] text-white'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  <span>
                    {busyId === reviewingSuggestion.id
                      ? 'সংরক্ষণ হচ্ছে...'
                      : reviewingSuggestion.kind === 'stop'
                      ? 'হ্যাঁ, ওষুধ বন্ধ করুন'
                      : reviewingSuggestion.kind === 'edit'
                      ? 'আপডেট করুন'
                      : 'যোগ করুন'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
