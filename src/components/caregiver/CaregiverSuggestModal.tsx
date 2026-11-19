import React, { useEffect, useMemo, useState } from 'react';
import {
  CaregiverFullMedicineItem,
  CaregiverLinkDoc,
  CaregiverSuggestionKind,
  GlobalMedicine,
  MealTiming,
  MedicineType,
  TimeSlot,
} from '../../types';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { searchLibraryMedicines } from '../../supabase/libraryService';
import {
  MAX_DAILY_CAREGIVER_SUGGESTIONS,
  SUGGESTION_SLOT_ORDER,
  SUGGESTION_TEXT_LIMIT,
  buildFormDefaultsFromSharedMedicine,
  getCaregiverDailySuggestionCount,
  mapDosageFormToMedicineType,
  resolveUnitFromMedicineType,
} from '../../utils/caregiverSuggestions';
import {
  Pill,
  Send,
  X,
  Search,
  AlertCircle,
  Check,
} from 'lucide-react';

interface CaregiverSuggestModalProps {
  link: CaregiverLinkDoc;
  onClose: () => void;
}

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

const DOSAGE_PRESETS = ['১টি', '২টি', '১/২টি', '১ চামচ'];

export const CaregiverSuggestModal: React.FC<CaregiverSuggestModalProps> = ({
  link,
  onClose,
}) => {
  const {
    currentUser,
    sentCaregiverSuggestions,
    sendCaregiverSuggestion,
  } = useMedicine();

  const sharedMeds = useMemo(
    () => (link.allowFullView && Array.isArray(link.sharedMedicines) ? link.sharedMedicines : []),
    [link.allowFullView, link.sharedMedicines]
  );
  const canEditOrStop = link.allowFullView && sharedMeds.length > 0;

  const [kind, setKind] = useState<CaregiverSuggestionKind>('add');
  const [selectedSharedKey, setSelectedSharedKey] = useState<string>('');
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [type, setType] = useState<MedicineType>('ট্যাবলেট');
  const [dosage, setDosage] = useState('১টি');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(['সকাল']);
  const [mealTiming, setMealTiming] = useState<MealTiming>('খাওয়ার পরে');
  const [isChronic, setIsChronic] = useState(false);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [stock, setStock] = useState<number>(10);
  const [unit, setUnit] = useState<string>('টি');
  const [note, setNote] = useState('');
  const [targetMedicineId, setTargetMedicineId] = useState<string | undefined>(undefined);
  const [targetMedicineName, setTargetMedicineName] = useState<string | undefined>(undefined);

  const [showCatalogSuggestions, setShowCatalogSuggestions] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayCount = currentUser
    ? getCaregiverDailySuggestionCount(currentUser.uid, sentCaregiverSuggestions)
    : 0;
  const remainingToday = Math.max(0, MAX_DAILY_CAREGIVER_SUGGESTIONS - todayCount);

  const [catalogMatches, setCatalogMatches] = useState<GlobalMedicine[]>([]);

  useEffect(() => {
    const q = brandName.trim();
    if (kind !== 'add' || q.length <= 1) {
      setCatalogMatches([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchLibraryMedicines(q, { limit: 6 })
        .then((res) => {
          if (!cancelled) {
            setCatalogMatches(res.slice(0, 6));
          }
        })
        .catch(() => {
          if (!cancelled) setCatalogMatches([]);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [brandName, kind]);

  const applySharedMedicine = (med: CaregiverFullMedicineItem, idx: number) => {
    const key = med.id || `${med.brandName}_${idx}`;
    setSelectedSharedKey(key);
    const defaults = buildFormDefaultsFromSharedMedicine(med);
    setBrandName(defaults.brandName);
    setGenericName(defaults.genericName || '');
    setStrength(defaults.strength || '');
    setType(defaults.type);
    setDosage(defaults.dosage);
    setTimeSlots(defaults.timeSlots);
    setMealTiming(defaults.mealTiming);
    setIsChronic(Boolean(defaults.isChronic));
    setDurationDays(defaults.durationDays || 7);
    setStock(defaults.stock);
    setUnit(defaults.unit || resolveUnitFromMedicineType(defaults.type));
    setTargetMedicineId(defaults.targetMedicineId);
    setTargetMedicineName(defaults.targetMedicineName);
    setErrorMsg('');
  };

  const handleKindChange = (nextKind: CaregiverSuggestionKind) => {
    setKind(nextKind);
    setErrorMsg('');
    if (nextKind === 'add') {
      setSelectedSharedKey('');
      setTargetMedicineId(undefined);
      setTargetMedicineName(undefined);
    } else if (sharedMeds.length > 0 && !selectedSharedKey) {
      applySharedMedicine(sharedMeds[0], 0);
    }
  };

  const handleSelectCatalogMed = (med: GlobalMedicine) => {
    const mappedType = mapDosageFormToMedicineType(med.dosageForm);
    setBrandName(med.brandName);
    setGenericName(med.genericName || '');
    setStrength(med.strength || '');
    setType(mappedType);
    setUnit(resolveUnitFromMedicineType(mappedType));
    setShowCatalogSuggestions(false);
    setErrorMsg('');
  };

  const handleTypeChange = (nextType: MedicineType) => {
    setType(nextType);
    setUnit(resolveUnitFromMedicineType(nextType));
  };

  const toggleSlot = (slot: TimeSlot) => {
    setErrorMsg('');
    if (timeSlots.includes(slot)) {
      if (timeSlots.length <= 1) {
        setErrorMsg('কমপক্ষে একটি সময় বেছে নিন');
        return;
      }
      setTimeSlots(timeSlots.filter((s) => s !== slot));
    } else {
      const next = [...timeSlots, slot].sort(
        (a, b) => SUGGESTION_SLOT_ORDER.indexOf(a) - SUGGESTION_SLOT_ORDER.indexOf(b)
      );
      setTimeSlots(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (remainingToday <= 0) {
      setErrorMsg(`আজ সর্বোচ্চ ${toBengaliNumber(MAX_DAILY_CAREGIVER_SUGGESTIONS)}টি প্রস্তাব পাঠানো হয়ে গেছে। আগামীকাল আবার পাঠাতে পারবেন।`);
      return;
    }

    if ((kind === 'edit' || kind === 'stop') && !targetMedicineName && !brandName.trim()) {
      setErrorMsg('অনুগ্রহ করে রোগীর তালিকা থেকে একটি ওষুধ বেছে নিন');
      return;
    }

    if (!brandName.trim()) {
      setErrorMsg('অনুগ্রহ করে ওষুধের নাম লিখুন');
      return;
    }

    if (kind !== 'stop' && timeSlots.length === 0) {
      setErrorMsg('কমপক্ষে একটি খাওয়ার সময় নির্বাচন করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const matchedShared = sharedMeds.find(
        (m, idx) => (m.id || `${m.brandName}_${idx}`) === selectedSharedKey
      );
      const sent = await sendCaregiverSuggestion(link, {
        kind,
        brandName: brandName.trim(),
        genericName: genericName.trim() || undefined,
        strength: strength.trim() || undefined,
        type,
        dosage: dosage.trim() || '১টি',
        timeSlots,
        schedules: matchedShared?.schedules,
        mealTiming,
        durationDays: isChronic ? undefined : Number(durationDays) || 7,
        isChronic,
        stock: Number(stock) || 0,
        unit: unit.trim() || resolveUnitFromMedicineType(type),
        targetMedicineId,
        targetMedicineName: targetMedicineName || (kind !== 'add' ? brandName.trim() : undefined),
        note: note.trim() || undefined,
      });
      if (sent) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cg-suggest-title"
    >
      <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 id="cg-suggest-title" className="text-lg sm:text-xl font-bold text-text truncate">
                {link.patientName}-এর জন্য ওষুধের প্রস্তাব
              </h2>
              <p className="text-xs sm:text-sm text-text-muted">
                রোগী অনুমোদন করলে তবেই তালিকায় যুক্ত হবে · আজ বাকি:{' '}
                <strong className="text-primary">{toBengaliNumber(remainingToday)}/{toBengaliNumber(MAX_DAILY_CAREGIVER_SUGGESTIONS)}</strong>টি
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-2 hover:bg-border text-text cursor-pointer shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Kind Tabs */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-text">
              প্রস্তাবের ধরন
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'add', label: 'নতুন ওষুধ', enabled: true },
                  { id: 'edit', label: 'বদল', enabled: canEditOrStop },
                  { id: 'stop', label: 'বন্ধ করুন', enabled: canEditOrStop },
                ] as const
              ).map((tab) => {
                const active = kind === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!tab.enabled}
                    onClick={() => handleKindChange(tab.id)}
                    className={`min-h-[48px] px-3 py-2 rounded-xl font-bold text-sm border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      active
                        ? tab.id === 'stop'
                          ? 'bg-danger border-danger text-white'
                          : 'bg-primary border-primary text-on-primary'
                        : 'bg-surface-2 border-border text-text hover:border-primary/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {!canEditOrStop && (
              <p className="text-xs text-text-muted">
                বদল বা বন্ধের প্রস্তাব পাঠাতে রোগীর সেটিংসে "সব দেখার অনুমতি" চালু থাকতে হবে।
              </p>
            )}
          </div>

          {/* Existing Patient Medicine Picker for Edit / Stop */}
          {(kind === 'edit' || kind === 'stop') && sharedMeds.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-text">
                কোন ওষুধটি {kind === 'edit' ? 'বদল' : 'বন্ধ'} করতে চান?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sharedMeds.map((med, idx) => {
                  const key = med.id || `${med.brandName}_${idx}`;
                  const selected = selectedSharedKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applySharedMedicine(med, idx)}
                      className={`min-h-[48px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-primary-soft border-primary text-text'
                          : 'bg-surface-2 border-border text-text hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">
                          {med.brandName} {med.strength || ''}
                        </span>
                        {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      {med.schedulesText && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          {med.schedulesText}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add / Edit Medicine Fields */}
          {kind !== 'stop' && (
            <>
              {/* Brand Name with Catalog Lookup */}
              <div className="space-y-2 relative">
                <label className="block text-sm font-bold text-text">
                  ওষুধের নাম *
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => {
                      setBrandName(e.target.value);
                      setShowCatalogSuggestions(true);
                      setErrorMsg('');
                    }}
                    onFocus={() => setShowCatalogSuggestions(true)}
                    placeholder="যেমন: Napa Extend, Seclo, Losectil..."
                    className="min-h-[48px] w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                  />
                </div>

                {showCatalogSuggestions && catalogMatches.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface shadow-lg divide-y divide-border overflow-hidden">
                    {catalogMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectCatalogMed(item)}
                        className="w-full min-h-[48px] px-4 py-2.5 text-left hover:bg-primary-soft flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text truncate">
                            {item.brandName} {item.strength}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {item.genericName} · {item.dosageForm}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-primary shrink-0">বেছে নিন</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Strength & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    শক্তি (Strength)
                  </label>
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="যেমন: ৫০০ মিগ্রা"
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    ওষুধের ধরন
                  </label>
                  <select
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as MedicineType)}
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base font-medium text-text focus:outline-hidden focus:border-primary"
                  >
                    {MEDICINE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-text">
                  কোন কোন সময়ে খাবেন? *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SUGGESTION_SLOT_ORDER.map((slot) => {
                    const active = timeSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl font-bold text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary border-primary text-on-primary'
                            : 'bg-surface-2 border-border text-text hover:border-primary/40'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dosage & Meal Timing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    প্রতি বারের পরিমাণ
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="যেমন: ১টি বা ১ চামচ"
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {DOSAGE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDosage(preset)}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          dosage === preset
                            ? 'bg-primary-soft border-primary text-primary'
                            : 'bg-surface border-border text-text-muted'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    খাবারের আগে বা পরে
                  </label>
                  <select
                    value={mealTiming}
                    onChange={(e) => setMealTiming(e.target.value as MealTiming)}
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base font-medium text-text focus:outline-hidden focus:border-primary"
                  >
                    {MEAL_TIMINGS.map((mt) => (
                      <option key={mt} value={mt}>
                        {mt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    কয়দিনের জন্য?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[7, 15, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setIsChronic(false);
                          setDurationDays(days);
                        }}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          !isChronic && durationDays === days
                            ? 'bg-primary border-primary text-on-primary'
                            : 'bg-surface-2 border-border text-text'
                        }`}
                      >
                        {toBengaliNumber(days)} দিন
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsChronic(true)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        isChronic
                          ? 'bg-primary border-primary text-on-primary'
                          : 'bg-surface-2 border-border text-text'
                      }`}
                    >
                      নিয়মিত (চলমান)
                    </button>
                  </div>
                  {!isChronic && (
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={durationDays}
                      onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))}
                      aria-label="দিনের সংখ্যা"
                      className="min-h-[44px] w-full px-3.5 py-1.5 rounded-xl bg-surface-2 border border-border text-sm text-text focus:outline-hidden focus:border-primary mt-1"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-text">
                    মজুদ কতটি? ({unit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text">
              রোগীর জন্য নোট (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              maxLength={SUGGESTION_TEXT_LIMIT}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === 'stop'
                  ? 'কেন ওষুধটি বন্ধ করার প্রস্তাব দিচ্ছেন লিখুন...'
                  : 'যেমন: ডাক্তার সাহেব সকালে খাওয়ার পর নিতে বলেছেন'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary resize-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-border text-text font-bold text-base cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting || remainingToday <= 0}
              className="min-h-[52px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'পাঠানো হচ্ছে...' : 'প্রস্তাব পাঠান'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
