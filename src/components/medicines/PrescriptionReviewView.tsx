import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  Package,
  Pill,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { analyzePrescriptionPhoto, PrescriptionAiResponse } from '../../services/aiService';
import { MealTiming, MedicineType, TimeSlot } from '../../types';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  PRESCRIPTION_DEFAULT_SLOT_TIMES,
  PRESCRIPTION_PHOTO_TIPS,
  PRESCRIPTION_SLOT_ORDER,
  PRESCRIPTION_UNREADABLE_MESSAGE,
  PRESCRIPTION_VERIFICATION_BANNER,
  PrescriptionReviewItem,
  buildReviewItemsFromAiResponse,
  calculateDefaultStock,
  convertReviewItemToMedicinePayload,
  countActiveSlots,
  findDuplicateMedicinesForPatient,
  findSuggestedPatientMatch,
  formatTime12hTo24h,
  formatTime24hTo12h,
  getDefaultUnitForType,
  matchLocalLibraryMedicine,
} from '../../utils/prescriptionImport';
import { doctorExistsByName } from '../../utils/doctorsManager';

interface PrescriptionReviewViewProps {
  onBackToManual: () => void;
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

const SLOT_KEY_MAP: Record<TimeSlot, 'morning' | 'noon' | 'evening' | 'night'> = {
  'সকাল': 'morning',
  'দুপুর': 'noon',
  'সন্ধ্যা': 'evening',
  'রাত': 'night',
};

const MEAL_OPTIONS: Array<{ value: MealTiming; label: string }> = [
  { value: 'খাওয়ার আগে', label: 'খাবারের আগে' },
  { value: 'খাওয়ার পরে', label: 'খাবারের পরে' },
  { value: 'যেকোনো সময়', label: 'যেকোনো সময়' },
];

export const PrescriptionReviewView: React.FC<PrescriptionReviewViewProps> = ({
  onBackToManual,
}) => {
  const {
    patients,
    activePatientId,
    medicines,
    globalMedicines,
    currentUser,
    openAuthModal,
    openCreateProfileModal,
    addMultipleMedicines,
    setCurrentPage,
    showToast,
    doctors,
    loadDoctors,
    addDoctor,
  } = useMedicine();

  useEffect(() => {
    void loadDoctors();
  }, []);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [unreadableState, setUnreadableState] = useState(false);

  const [aiResponse, setAiResponse] = useState<PrescriptionAiResponse | null>(null);
  const [reviewItems, setReviewItems] = useState<PrescriptionReviewItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(activePatientId || '');
  const [matchedPatientHint, setMatchedPatientHint] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [doctorPromptDismissed, setDoctorPromptDismissed] = useState(false);
  const [doctorPromptSaved, setDoctorPromptSaved] = useState(false);
  const [scanDoctorHospital, setScanDoctorHospital] = useState('');
  const [scanDoctorPhone, setScanDoctorPhone] = useState('');

  const [duplicateWarning, setDuplicateWarning] = useState<{
    duplicates: Array<{ reviewItem: PrescriptionReviewItem; existingBrandName: string }>;
    allSelected: PrescriptionReviewItem[];
  } | null>(null);

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const scannedDoctorName = (aiResponse?.doctorName || '').trim();
  const shouldOfferSaveScannedDoctor =
    Boolean(scannedDoctorName) &&
    !doctorPromptDismissed &&
    !doctorPromptSaved &&
    !doctorExistsByName(doctors, scannedDoctorName);

  // When a patient profile list updates (e.g. user creates a new profile), re-check suggested match if needed
  useEffect(() => {
    if (!aiResponse?.patientName || selectedPatientId) return;
    const match = findSuggestedPatientMatch(aiResponse.patientName, activePatients);
    if (match) {
      setSelectedPatientId(match.id);
      setMatchedPatientHint(match.name);
    }
  }, [activePatients, aiResponse, selectedPatientId]);

  const handleResetPhoto = () => {
    setImagePreview(null);
    setAiResponse(null);
    setReviewItems([]);
    setAnalyzeError(null);
    setUnreadableState(false);
    setMatchedPatientHint(null);
    setValidationError(null);
    setDuplicateWarning(null);
    setDoctorPromptDismissed(false);
    setDoctorPromptSaved(false);
    setScanDoctorHospital('');
    setScanDoctorPhone('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const startAnalysis = async (dataUrl: string, mimeType: string) => {
    if (!currentUser) {
      setAnalyzeError('প্রেসক্রিপশনের ছবি পড়তে অনুগ্রহ করে আগে আপনার অ্যাকাউন্টে লগইন করুন।');
      openAuthModal();
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setUnreadableState(false);
    setAiResponse(null);
    setReviewItems([]);
    setValidationError(null);

    try {
      const res = await analyzePrescriptionPhoto(dataUrl, mimeType);
      const data = res?.data;

      if (!data || data.unreadable || !Array.isArray(data.items) || data.items.length === 0) {
        setUnreadableState(true);
        return;
      }

      setAiResponse(data);
      const builtItems = buildReviewItemsFromAiResponse(data, globalMedicines);
      setReviewItems(builtItems);

      const suggestedPatient = findSuggestedPatientMatch(data.patientName, activePatients);
      if (suggestedPatient) {
        setSelectedPatientId(suggestedPatient.id);
        setMatchedPatientHint(suggestedPatient.name);
      } else if (activePatientId) {
        setSelectedPatientId(activePatientId);
        setMatchedPatientHint(null);
      } else if (activePatients.length > 0) {
        setSelectedPatientId(activePatients[0].id);
        setMatchedPatientHint(null);
      }
    } catch (err: any) {
      setAnalyzeError(
        err?.message || 'ছবিটি পড়া যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAnalyzeError('অনুগ্রহ করে শুধুমাত্র ছবি (JPG বা PNG) নির্বাচন করুন।');
      return;
    }

    const mimeType = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setAnalyzeError('ছবিটি খোলা যায়নি। আবার বাছাই করুন।');
        return;
      }
      setImagePreview(result);
      void startAnalysis(result, mimeType);
    };
    reader.onerror = () => {
      setAnalyzeError('ছবিটি পড়তে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    };
    reader.readAsDataURL(file);
  };

  const updateItem = (tempId: string, updater: (prev: PrescriptionReviewItem) => PrescriptionReviewItem) => {
    setValidationError(null);
    setReviewItems((prev) => prev.map((item) => (item.tempId === tempId ? updater(item) : item)));
  };

  const handleBrandOrStrengthChange = (
    tempId: string,
    field: 'brandName' | 'strength',
    value: string
  ) => {
    updateItem(tempId, (item) => {
      const nextBrand = field === 'brandName' ? value : item.brandName;
      const nextStrength = field === 'strength' ? value : item.strength;
      const matched = matchLocalLibraryMedicine(nextBrand, nextStrength, globalMedicines);
      const prevMatchedGeneric = item.catalogMatch?.genericName || '';
      const shouldFillGeneric =
        matched && (!item.genericName.trim() || item.genericName.trim() === prevMatchedGeneric);

      return {
        ...item,
        brandName: nextBrand,
        strength: nextStrength,
        catalogMatch: matched,
        genericName: shouldFillGeneric ? matched.genericName : item.genericName,
        needsVerification: item.confidence === 'low' || !nextBrand.trim(),
      };
    });
  };

  const handleToggleSlot = (tempId: string, slot: TimeSlot) => {
    const slotKey = SLOT_KEY_MAP[slot];
    updateItem(tempId, (item) => {
      const nextSchedule = {
        ...item.schedule,
        [slotKey]: !item.schedule[slotKey],
      };
      // Prevent leaving 0 slots active on a selected item
      if (countActiveSlots(nextSchedule) === 0) {
        return item;
      }
      const nextTimesPerDay = countActiveSlots(nextSchedule);
      const nextStock = item.stockManuallyEdited
        ? item.stock
        : calculateDefaultStock(item.durationDays, item.amountPerDose, nextSchedule);

      return {
        ...item,
        schedule: nextSchedule,
        timesPerDay: nextTimesPerDay,
        stock: nextStock,
      };
    });
  };

  const handleSlotTimeChange = (tempId: string, slot: TimeSlot, time24h: string) => {
    if (!time24h) return;
    const formatted12h = formatTime24hTo12h(time24h);
    updateItem(tempId, (item) => ({
      ...item,
      slotTimes: {
        ...item.slotTimes,
        [slot]: formatted12h,
      },
    }));
  };

  const handleDurationOrAmountChange = (
    tempId: string,
    field: 'durationDays' | 'amountPerDose',
    rawVal: string
  ) => {
    const parsed = field === 'durationDays' ? parseInt(rawVal, 10) : parseFloat(rawVal);
    updateItem(tempId, (item) => {
      const nextDuration =
        field === 'durationDays'
          ? Number.isFinite(parsed) && parsed > 0
            ? Math.min(365, parsed)
            : 1
          : item.durationDays;
      const nextAmount =
        field === 'amountPerDose'
          ? Number.isFinite(parsed) && parsed > 0
            ? Math.min(20, parsed)
            : 0.5
          : item.amountPerDose;

      const nextStock = item.stockManuallyEdited
        ? item.stock
        : calculateDefaultStock(nextDuration, nextAmount, item.schedule);

      return {
        ...item,
        durationDays: nextDuration,
        amountPerDose: nextAmount,
        stock: nextStock,
      };
    });
  };

  const selectedItems = useMemo(
    () => reviewItems.filter((item) => item.selected),
    [reviewItems]
  );

  const commitMedicines = async (itemsToSave: PrescriptionReviewItem[]) => {
    if (itemsToSave.length === 0) return;
    setIsSaving(true);
    setDuplicateWarning(null);
    try {
      const payloads = itemsToSave.map((item) =>
        convertReviewItemToMedicinePayload(item, selectedPatientId || undefined)
      );
      await addMultipleMedicines(payloads);
      setCurrentPage('dashboard');
    } catch {
      // addMultipleMedicines already surfaces user-friendly Bengali toast on failure
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmClick = () => {
    setValidationError(null);
    if (selectedItems.length === 0) {
      setValidationError('যোগ করার জন্য কমপক্ষে একটি ওষুধের পাশে টিক দিন।');
      return;
    }

    const unnamed = selectedItems.find((item) => !item.brandName.trim());
    if (unnamed) {
      setValidationError('টিক দেওয়া প্রতিটি ওষুধের নাম লিখুন অথবা টিক তুলে দিন।');
      return;
    }

    const dupMatches = findDuplicateMedicinesForPatient(
      selectedItems,
      selectedPatientId || undefined,
      medicines
    );

    if (dupMatches.length > 0) {
      setDuplicateWarning({
        duplicates: dupMatches.map((d) => ({
          reviewItem: d.reviewItem,
          existingBrandName: d.existingMedicine.brandName,
        })),
        allSelected: selectedItems,
      });
      return;
    }

    void commitMedicines(selectedItems);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Hidden File Inputs: Camera + Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToManual}
          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2 text-base font-bold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>ফিরে যান</span>
        </button>

        {imagePreview && !isAnalyzing && (
          <button
            type="button"
            onClick={handleResetPhoto}
            className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2 text-base font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:opacity-90 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>অন্য ছবি তুলুন</span>
          </button>
        )}
      </div>

      {/* Stage 1: Photo Capture / Selection (when no review items yet) */}
      {!aiResponse && !isAnalyzing && (
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              প্রেসক্রিপশনের ছবি থেকে ওষুধ যোগ করুন
            </h1>
            <p className="text-base text-text-muted mt-1.5">
              ডাক্তারের প্রেসক্রিপশনের ছবি তুললে ওষুধের তালিকা তৈরি হবে — আপনি যাচাই করে মিলিয়ে নিলে তবেই যোগ হবে।
            </p>
          </div>

          {!currentUser && (
            <div className="p-4 rounded-2xl bg-warning-soft border border-warning/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-text">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
                <p className="text-sm font-semibold">
                  ছবি থেকে ওষুধ পড়ার সুবিধা ব্যবহার করতে প্রথমে লগইন করা প্রয়োজন।
                </p>
              </div>
              <button
                type="button"
                onClick={openAuthModal}
                className="min-h-[44px] px-4 py-2 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl text-sm font-bold shrink-0 cursor-pointer"
              >
                লগইন করুন
              </button>
            </div>
          )}

          {/* Unreadable State Card */}
          {unreadableState && (
            <div className="p-5 rounded-2xl bg-danger-soft border-2 border-danger/35 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-danger-text shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-bold text-danger-text">
                    {PRESCRIPTION_UNREADABLE_MESSAGE}
                  </h2>
                  <p className="text-sm text-text mt-1">
                    ছবিতে লেখা অস্পষ্ট বা আলো কম থাকার কারণে ওষুধের নাম নিশ্চিত হওয়া যায়নি। নিচের পরামর্শ অনুযায়ী আবার ছবি তুলুন অথবা হাতে লিখে যোগ করুন।
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  <span>আবার ছবি তুলুন</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToManual}
                  className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-border text-text rounded-xl text-base font-bold cursor-pointer hover:bg-surface-2"
                >
                  <span>হাতে লিখে যোগ করুন</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {analyzeError && (
            <div className="p-4 rounded-2xl bg-danger-soft border border-danger/35 text-text flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger-text shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold text-danger-text">ছবি পড়া সম্ভব হয়নি</p>
                <p>{analyzeError}</p>
              </div>
            </div>
          )}

          {/* Photo Preview thumbnail if unreadable/errored */}
          {imagePreview && (
            <div className="rounded-2xl overflow-hidden border border-border bg-black flex items-center justify-center max-h-64">
              <img
                src={imagePreview}
                alt="প্রেসক্রিপশনের ছবি"
                className="max-h-64 w-auto object-contain"
              />
            </div>
          )}

          {/* Primary Camera / Gallery Picker Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[72px] flex items-center justify-center gap-3 px-5 py-4 bg-primary hover:bg-primary-hover text-on-primary rounded-2xl text-lg font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Camera className="w-6 h-6 shrink-0" />
              <span>ক্যামেরা দিয়ে ছবি তুলুন</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[72px] flex items-center justify-center gap-3 px-5 py-4 bg-primary-soft hover:opacity-90 border-2 border-primary/40 text-primary rounded-2xl text-lg font-bold transition-colors cursor-pointer"
            >
              <ImageIcon className="w-6 h-6 shrink-0 text-primary" />
              <span>গ্যালারি থেকে ছবি বাছুন</span>
            </button>
          </div>

          {/* Photo Tips Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border space-y-2.5">
            <p className="text-base font-bold text-text">
              ভালো ফলাফলের জন্য ছবি তোলার নিয়ম:
            </p>
            <ul className="space-y-1.5 text-sm sm:text-base text-text-muted">
              {PRESCRIPTION_PHOTO_TIPS.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-1" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={onBackToManual}
              className="min-h-[44px] px-4 py-2 text-sm font-bold text-text-muted hover:text-text cursor-pointer"
            >
              অথবা নিজে হাতে লিখে যোগ করুন
            </button>
          </div>
        </section>
      )}

      {/* Stage 2: Analyzing Spinner */}
      {isAnalyzing && (
        <section className="bg-surface border border-border rounded-2xl p-8 text-center space-y-5 shadow-xs">
          {imagePreview && (
            <div className="rounded-xl overflow-hidden border border-border bg-black flex items-center justify-center max-h-48 mx-auto max-w-sm">
              <img
                src={imagePreview}
                alt="বাছাই করা প্রেসক্রিপশন"
                className="max-h-48 w-auto object-contain opacity-85"
              />
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-text">
              প্রেসক্রিপশন পড়া হচ্ছে...
            </h2>
            <p className="text-base text-text-muted max-w-md">
              ওষুধের নাম, পরিমাণ এবং খাওয়ার সময় আলাদা করা হচ্ছে। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।
            </p>
          </div>
        </section>
      )}

      {/* Stage 3: Mandatory Human Verification Screen */}
      {aiResponse && !isAnalyzing && !unreadableState && (
        <div className="space-y-5">
          {/* Mandatory Top Warning Banner */}
          <div
            role="alert"
            className="p-4 sm:p-5 rounded-2xl bg-warning-soft border-2 border-warning/40 text-text flex items-start gap-3 shadow-xs"
          >
            <AlertTriangle className="w-6 h-6 text-warning-text shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-base sm:text-lg font-bold text-warning-text">
                {PRESCRIPTION_VERIFICATION_BANNER}
              </p>
              {(aiResponse.doctorName || aiResponse.date) && (
                <p className="text-sm text-text-muted">
                  {aiResponse.doctorName ? `ডাক্তার: ${aiResponse.doctorName}` : ''}
                  {aiResponse.doctorName && aiResponse.date ? ' · ' : ''}
                  {aiResponse.date ? `তারিখ: ${aiResponse.date}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Prompt to save scanned Doctor into "আমার ডাক্তার" */}
          {shouldOfferSaveScannedDoctor && (
            <section className="bg-primary-soft/60 border border-primary/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-bold text-text">
                      এই ডাক্তারকে তালিকায় যোগ করবেন?
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      প্রেসক্রিপশনে পাওয়া নাম: <strong className="text-text">{scannedDoctorName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDoctorPromptDismissed(true)}
                  aria-label="বাদ দিন"
                  className="p-1.5 rounded-lg text-text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="tel"
                  value={scanDoctorPhone}
                  onChange={(e) => setScanDoctorPhone(e.target.value)}
                  placeholder="ফোন নম্বর (ঐচ্ছিক)"
                  className="min-h-[44px] px-3 py-2 text-sm rounded-xl border border-border bg-surface text-text"
                />
                <input
                  type="text"
                  value={scanDoctorHospital}
                  onChange={(e) => setScanDoctorHospital(e.target.value)}
                  placeholder="চেম্বার / হাসপাতাল (ঐচ্ছিক)"
                  className="min-h-[44px] px-3 py-2 text-sm rounded-xl border border-border bg-surface text-text"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    addDoctor({
                      name: scannedDoctorName,
                      phone: scanDoctorPhone,
                      hospital: scanDoctorHospital,
                      patientIds: selectedPatientId ? [selectedPatientId] : undefined,
                      lastVisitDate:
                        aiResponse?.date && /^\d{4}-\d{2}-\d{2}$/.test(aiResponse.date.trim())
                          ? aiResponse.date.trim()
                          : undefined,
                    });
                    setDoctorPromptSaved(true);
                  }}
                  className="min-h-[44px] px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>আমার ডাক্তার তালিকায় যোগ করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDoctorPromptDismissed(true)}
                  className="min-h-[44px] px-4 py-2 bg-surface border border-border text-text-muted text-sm font-semibold rounded-xl cursor-pointer"
                >
                  এখন নয়
                </button>
              </div>
            </section>
          )}

          {doctorPromptSaved && (
            <div className="p-3.5 rounded-2xl bg-success-soft border border-success/30 text-success-text text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>&quot;{scannedDoctorName}&quot; আমার ডাক্তার তালিকায় সংরক্ষিত হয়েছে ✓</span>
            </div>
          )}

          {/* Compact Original Photo Preview */}
          {imagePreview && (
            <details className="bg-surface border border-border rounded-2xl p-4">
              <summary className="text-base font-bold text-text cursor-pointer select-none">
                মূল প্রেসক্রিপশনের ছবি দেখে মিলিয়ে নিন
              </summary>
              <div className="mt-3 rounded-xl overflow-hidden border border-border bg-black flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="মূল প্রেসক্রিপশন"
                  className="max-h-96 w-auto object-contain"
                />
              </div>
            </details>
          )}

          {/* Patient Selection Card (Suggests match, never auto-creates) */}
          <section className="bg-surface border border-border rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="rx-patient-select"
                className="text-base font-bold text-text flex items-center gap-2"
              >
                <UserCheck className="w-5 h-5 text-primary" />
                <span>এই ওষুধগুলো কার জন্য?</span>
              </label>
              <button
                type="button"
                onClick={openCreateProfileModal}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:opacity-90 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>নতুন সদস্য তৈরি করুন</span>
              </button>
            </div>

            <select
              id="rx-patient-select"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="min-h-[48px] w-full px-3.5 py-2.5 text-base font-semibold bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:border-primary"
            >
              {activePatients.length === 0 ? (
                <option value="">সাধারণ (নিজস্ব)</option>
              ) : (
                <>
                  {activePatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} ({patient.relation})
                    </option>
                  ))}
                  <option value="">নির্দিষ্ট নয় (সকল তালিকা)</option>
                </>
              )}
            </select>

            {aiResponse.patientName && (
              <p className="text-sm text-text-muted">
                {matchedPatientHint
                  ? `ছবিতে লেখা নাম "${aiResponse.patientName}" — "${matchedPatientHint}" প্রোফাইলের সাথে মিলেছে।`
                  : `ছবিতে রোগীর নাম পাওয়া গেছে: "${aiResponse.patientName}" (প্রয়োজনে ওপরে সঠিক সদস্য বাছুন বা নতুন প্রোফাইল তৈরি করুন)।`}
              </p>
            )}
          </section>

          {/* Editable Medicine Verification Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold text-text">
                পাওয়া ওষুধসমূহ ({toBengaliNumber(reviewItems.length)}টি)
              </h2>
              <span className="text-sm font-semibold text-primary">
                বাছাই করা: {toBengaliNumber(selectedItems.length)}টি
              </span>
            </div>

            {reviewItems.map((item, idx) => (
              <div
                key={item.tempId}
                className={`bg-surface rounded-2xl border-2 p-5 space-y-4 transition-colors shadow-xs ${
                  item.selected
                    ? item.needsVerification
                      ? 'border-warning/60'
                      : 'border-primary'
                    : 'border-border opacity-85'
                }`}
              >
                {/* Card Top Header: Checkbox + Number + Status Flags */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                  <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        updateItem(item.tempId, (prev) => ({
                          ...prev,
                          selected: e.target.checked,
                        }))
                      }
                      className="w-6 h-6 accent-primary rounded cursor-pointer"
                    />
                    <span className="text-lg font-bold text-text flex items-center gap-2">
                      <Pill className="w-5 h-5 text-primary" />
                      <span>ওষুধ {toBengaliNumber(idx + 1)}</span>
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.needsVerification && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning-soft border border-warning/35 text-warning-text text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        যাচাই করুন
                      </span>
                    )}

                    {item.catalogMatch ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success-soft border border-success/30 text-success-text text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        লাইব্রেরিতে আছে ✓
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-text-muted">
                        লাইব্রেরিতে নেই
                      </span>
                    )}
                  </div>
                </div>

                {/* Matched Catalog Manufacturer / Package Summary */}
                {item.catalogMatch && (
                  <p className="text-sm text-success-text bg-success-soft px-3.5 py-2 rounded-xl">
                    লাইব্রেরি মিল: <span className="font-bold">{item.catalogMatch.genericName}</span>
                    {item.catalogMatch.manufacturer ? ` · ${item.catalogMatch.manufacturer}` : ''}
                    {item.catalogMatch.packageDescription ? ` · ${item.catalogMatch.packageDescription}` : ''}
                  </p>
                )}

                {/* Brand Name, Strength, Dosage Form, Generic Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      ওষুধের নাম *
                    </label>
                    <input
                      type="text"
                      value={item.brandName}
                      onChange={(e) =>
                        handleBrandOrStrengthChange(item.tempId, 'brandName', e.target.value)
                      }
                      placeholder="ডাক্তারের প্রেসক্রিপশন দেখে নাম লিখুন"
                      className={`min-h-[48px] w-full px-3.5 py-2 text-base font-semibold rounded-xl border bg-surface-2 text-text focus:outline-hidden focus:border-primary ${
                        item.selected && !item.brandName.trim()
                          ? 'border-danger'
                          : 'border-border'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      শক্তি / মাত্রা
                    </label>
                    <input
                      type="text"
                      value={item.strength}
                      onChange={(e) =>
                        handleBrandOrStrengthChange(item.tempId, 'strength', e.target.value)
                      }
                      placeholder="যেমন: 500 mg"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base rounded-xl border border-border bg-surface-2 text-text focus:outline-hidden focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      ধরন
                    </label>
                    <select
                      value={item.dosageForm}
                      onChange={(e) => {
                        const nextType = e.target.value as MedicineType;
                        updateItem(item.tempId, (prev) => ({
                          ...prev,
                          dosageForm: nextType,
                          unit: getDefaultUnitForType(nextType),
                        }));
                      }}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base rounded-xl border border-border bg-surface-2 text-text focus:outline-hidden focus:border-primary"
                    >
                      {MEDICINE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      জেনেরিক নাম (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={item.genericName}
                      onChange={(e) =>
                        updateItem(item.tempId, (prev) => ({
                          ...prev,
                          genericName: e.target.value,
                        }))
                      }
                      placeholder="যেমন: Paracetamol"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base rounded-xl border border-border bg-surface-2 text-text focus:outline-hidden focus:border-primary"
                    />
                  </div>
                </div>

                {/* Amount Per Dose, Meal Timing, Duration Days, Stock */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      প্রতি বারের পরিমাণ
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.5"
                        min="0.25"
                        max="20"
                        value={item.amountPerDose}
                        onChange={(e) =>
                          handleDurationOrAmountChange(item.tempId, 'amountPerDose', e.target.value)
                        }
                        className="min-h-[48px] w-full px-3 py-2 text-base font-bold rounded-xl border border-border bg-surface-2 text-text"
                      />
                      <span className="text-sm font-semibold text-text-muted shrink-0">
                        {item.unit}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      খাবারের সময়
                    </label>
                    <select
                      value={item.mealTiming}
                      onChange={(e) =>
                        updateItem(item.tempId, (prev) => ({
                          ...prev,
                          mealTiming: e.target.value as MealTiming,
                        }))
                      }
                      className="min-h-[48px] w-full px-3 py-2 text-sm sm:text-base rounded-xl border border-border bg-surface-2 text-text"
                    >
                      {MEAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1">
                      কত দিন (মেয়াদ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={item.durationDays}
                      onChange={(e) =>
                        handleDurationOrAmountChange(item.tempId, 'durationDays', e.target.value)
                      }
                      className="min-h-[48px] w-full px-3 py-2 text-base font-bold rounded-xl border border-border bg-surface-2 text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text mb-1 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-primary" />
                      <span>কয়টি আছে?</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      value={item.stock}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        updateItem(item.tempId, (prev) => ({
                          ...prev,
                          stock: val,
                          stockManuallyEdited: true,
                        }));
                      }}
                      className="min-h-[48px] w-full px-3 py-2 text-base font-bold rounded-xl border border-border bg-surface-2 text-text"
                    />
                  </div>
                </div>

                {/* Time Slots (সকাল / দুপুর / সন্ধ্যা / রাত) + Editable Reminder Times */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-text flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>কখন খাবেন (দিনে {toBengaliNumber(countActiveSlots(item.schedule))} বার)</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      রিমাইন্ডারের সময় চাইলে বদলানো যাবে
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESCRIPTION_SLOT_ORDER.map((slot) => {
                      const key = SLOT_KEY_MAP[slot];
                      const active = item.schedule[key];
                      const currentTime12h =
                        item.slotTimes[slot] || PRESCRIPTION_DEFAULT_SLOT_TIMES[slot];
                      return (
                        <div
                          key={slot}
                          className={`rounded-xl border p-2.5 space-y-2 transition-colors ${
                            active
                              ? 'bg-primary-soft border-primary'
                              : 'bg-surface-2 border-border'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleSlot(item.tempId, slot)}
                            className={`w-full min-h-[40px] flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-bold cursor-pointer ${
                              active
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface text-text border border-border'
                            }`}
                          >
                            <span>{slot}</span>
                            {active && <Check className="w-4 h-4" />}
                          </button>

                          {active && (
                            <input
                              type="time"
                              aria-label={`${slot} রিমাইন্ডারের সময়`}
                              value={formatTime12hTo24h(currentTime12h)}
                              onChange={(e) =>
                                handleSlotTimeChange(item.tempId, slot, e.target.value)
                              }
                              className="w-full min-h-[40px] px-2 py-1 text-sm font-semibold rounded-lg border border-primary/30 bg-surface text-text"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-sm font-bold text-text mb-1">
                    নির্দেশনা / মন্তব্য (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) =>
                      updateItem(item.tempId, (prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="যেমন: জ্বর থাকলে খাবেন / বেশি পানি পান করবেন"
                    className="min-h-[44px] w-full px-3.5 py-2 text-sm sm:text-base rounded-xl border border-border bg-surface-2 text-text"
                  />
                </div>
              </div>
            ))}
          </div>

          {validationError && (
            <div className="p-4 rounded-2xl bg-danger-soft border border-danger/35 text-danger-text flex items-center gap-2.5 text-base font-bold">
              <ShieldAlert className="w-5 h-5 text-danger-text shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Primary Confirm & Save Bar */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
            <button
              type="button"
              onClick={handleResetPhoto}
              disabled={isSaving}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-border bg-surface-2 text-text text-base font-bold cursor-pointer disabled:opacity-50"
            >
              নতুন ছবি তুলুন
            </button>

            <button
              type="button"
              disabled={isSaving || selectedItems.length === 0}
              onClick={handleConfirmClick}
              className="min-h-[54px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-lg font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>যোগ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>বাছাই করা {toBengaliNumber(selectedItems.length)}টি ওষুধ যোগ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Medicine Confirmation Dialog */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning-text shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-text">
                    একই ওষুধ আগেই তালিকায় আছে
                  </h3>
                  <p className="text-sm text-text-muted mt-1">
                    নিচের ওষুধগুলো আগে থেকেই তালিকায় রয়েছে। তারপরও কি নতুন করে যোগ করতে চান?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                aria-label="বন্ধ করুন"
                className="p-1.5 rounded-lg text-text-muted hover:text-text cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ul className="bg-warning-soft border border-warning/35 rounded-xl p-3 space-y-1 text-sm font-bold text-warning-text">
              {duplicateWarning.duplicates.map((d) => (
                <li key={d.reviewItem.tempId}>• {d.existingBrandName}</li>
              ))}
            </ul>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void commitMedicines(duplicateWarning.allSelected)}
                className="min-h-[48px] w-full px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold cursor-pointer"
              >
                হ্যাঁ, সবগুলো যোগ করুন
              </button>

              {duplicateWarning.allSelected.length > duplicateWarning.duplicates.length && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    const dupIds = new Set(
                      duplicateWarning.duplicates.map((d) => d.reviewItem.tempId)
                    );
                    const nonDups = duplicateWarning.allSelected.filter(
                      (i) => !dupIds.has(i.tempId)
                    );
                    if (nonDups.length === 0) {
                      showToast('নতুন কোনো ওষুধ বাকি নেই', 'info');
                      setDuplicateWarning(null);
                      return;
                    }
                    void commitMedicines(nonDups);
                  }}
                  className="min-h-[48px] w-full px-4 py-2.5 bg-success-soft border border-success/30 text-success-text rounded-xl text-base font-bold cursor-pointer"
                >
                  আগে থেকে থাকাগুলো বাদ দিয়ে শুধু নতুনগুলো যোগ করুন
                </button>
              )}

              <button
                type="button"
                disabled={isSaving}
                onClick={() => setDuplicateWarning(null)}
                className="min-h-[44px] w-full px-4 py-2 bg-surface-2 text-text rounded-xl text-sm font-bold cursor-pointer"
              >
                ফিরে গিয়ে মিলিয়ে দেখি
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
