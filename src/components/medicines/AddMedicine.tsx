import React, { useState, useEffect, useRef } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { Medicine, MedicineIconTag, MedicineType, MealTiming, TimeSlot, DoseSchedule } from '../../types';
import { commonMedicinePresets } from '../../data/mockData';
import { toBengaliNumber, formatBengaliTime } from '../../utils/bengaliUtils';
import {
  computePrefilledMedicineCost,
  parseExpenseAmountInput,
} from '../../utils/expenseUtils';
import { PrescriptionScannerModal } from './PrescriptionScannerModal';
import { PrescriptionReviewView, InitialPrescriptionScanImage } from './PrescriptionReviewView';
import { MedicineInfoModal } from '../ai/MedicineInfoModal';
import { GenericBrandsBottomSheet } from '../library/GenericBrandsBottomSheet';
import { MedicineBadgeIcon } from './MedicineBadgeIcon';
import type { AddMedicineLibraryPrefill } from '../../supabase/libraryService';
import { mapGlobalMedicineToAddFormPrefill } from '../../supabase/libraryService';
import {
  getDefaultMedicineIconTag,
  MEDICINE_COLOR_OPTIONS,
  MEDICINE_ICON_OPTIONS,
  resolveMedicineIconTag,
} from '../../utils/medicineAppearance';
import { compressMedicinePhotoFile } from '../../utils/medicinePhotoCompressor';
import {
  deleteMedicinePhotoFromStorage,
  getMedicinePhotoSignedUrl,
  uploadMedicinePhotoToStorage,
} from '../../supabase/medicinePhotosService';
import {
  PrescriptionScanResult,
  checkDrugInteractions,
  DrugInteractionResponse,
  getAiErrorDisplay,
} from '../../services/aiService';
import { doctorExistsByName } from '../../utils/doctorsManager';
import {
  Pill,
  Sparkles,
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  ArrowRight,
  Clock,
  ShieldAlert,
  Camera,
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Stethoscope,
  ImagePlus,
  X,
} from 'lucide-react';

const DEFAULT_SLOT_TIMES: Record<TimeSlot, string> = {
  'সকাল': '08:00 AM',
  'দুপুর': '01:30 PM',
  'সন্ধ্যা': '06:00 PM',
  'রাত': '09:30 PM',
};

const SLOT_ORDER: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];

export const AddMedicine: React.FC = () => {
  const {
    addMedicine,
    updateMedicine,
    editingMedicine,
    clearEditingMedicine,
    showToast,
    medicines,
    patients,
    activePatientId,
    setCurrentPage,
    openCreateProfileModal,
    doctors,
    loadDoctors,
    addDoctor,
    isAdmin,
    currentUser,
    openAuthModal,
    addExpense,
  } = useMedicine();

  // Wizard Step (1 to 4)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Core Form State with Elderly-Friendly Smart Defaults (খাওয়ার পরে, ১টি, ৭ দিন)
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [type, setType] = useState<MedicineType>('ট্যাবলেট');
  const [strength, setStrength] = useState('');
  const [mealTiming, setMealTiming] = useState<MealTiming>('খাওয়ার পরে');
  const [assignedPatientId, setAssignedPatientId] = useState<string | undefined>(
    activePatientId || undefined
  );
  const [purpose, setPurpose] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [stock, setStock] = useState<number>(30);
  const [minStockAlert, setMinStockAlert] = useState<number>(7);
  const [unit, setUnit] = useState('টি');
  const [isChronic, setIsChronic] = useState(false);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [expiryDate, setExpiryDate] = useState<string>('');

  // Schedules state (Default: সকাল ১টি)
  const [schedules, setSchedules] = useState<DoseSchedule[]>([
    { id: 'slot-morning', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
  ]);

  const [formError, setFormError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showPrescriptionFlow, setShowPrescriptionFlow] = useState(false);
  const [initialScanImage, setInitialScanImage] = useState<InitialPrescriptionScanImage | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [aiSuccessBanner, setAiSuccessBanner] = useState<string | null>(null);
  const [isSavingQuickDoctor, setIsSavingQuickDoctor] = useState(false);
  const [addedDoctorKey, setAddedDoctorKey] = useState<string | null>(null);
  const [catalogMedicineId, setCatalogMedicineId] = useState<string | undefined>(undefined);
  const [packageDescription, setPackageDescription] = useState<string | undefined>(undefined);
  const [pricePerUnit, setPricePerUnit] = useState<number | undefined>(undefined);
  const [genericBrandsTarget, setGenericBrandsTarget] = useState<string | null>(null);
  const [addStockAsExpense, setAddStockAsExpense] = useState(false);
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseAmountEdited, setExpenseAmountEdited] = useState(false);

  // Visual Identification (Icon & Color Tag) + Optional Medicine Photo
  const [iconTag, setIconTag] = useState<MedicineIconTag>('ট্যাবলেট');
  const [iconTagManuallyPicked, setIconTagManuallyPicked] = useState(false);
  const [colorTag, setColorTag] = useState<Medicine['colorTag']>('teal');
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | undefined>(undefined);
  const [existingPhotoSignedUrl, setExistingPhotoSignedUrl] = useState<string | null>(null);
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isSavingMedicine, setIsSavingMedicine] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const galleryPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Drug Interaction State
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] = useState<DrugInteractionResponse | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactionErrorCode, setInteractionErrorCode] = useState<string | null>(null);

  const handleCheckDrugInteractions = async () => {
    if (!brandName.trim()) {
      setInteractionError('দয়া করে প্রথমে ওষুধের নাম লিখুন।');
      setInteractionErrorCode(null);
      return;
    }
    setInteractionError(null);
    setInteractionErrorCode(null);
    setIsCheckingInteractions(true);

    try {
      const currentActiveMeds = medicines
        .filter((m) => (assignedPatientId ? m.assignedPatientId === assignedPatientId : true) && m.status === 'active')
        .map((m) => m.brandName + (m.genericName ? ` (${m.genericName})` : ''));

      const targetPatient = patients.find((p) => p.id === assignedPatientId);
      const patientContext = targetPatient ? `${targetPatient.name} (${targetPatient.relation})` : undefined;

      const res = await checkDrugInteractions(
        genericName.trim() ? `${brandName.trim()} (${genericName.trim()})` : brandName.trim(),
        currentActiveMeds,
        patientContext
      );
      setInteractionResult(res);
    } catch (err: unknown) {
      const display = getAiErrorDisplay(
        err,
        'যাচাই করতে ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      );
      setInteractionError(display.message);
      setInteractionErrorCode(display.code ?? null);
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  // Apply scanned prescription or AI medicine data
  const handleApplyScanResult = (data: PrescriptionScanResult) => {
    if (data.brandName) setBrandName(data.brandName);
    if (data.genericName) setGenericName(data.genericName);
    if (data.strength) setStrength(data.strength);
    if (data.type) setType(data.type as MedicineType);
    if (data.mealTiming) setMealTiming(data.mealTiming as MealTiming);
    if (data.purpose) setPurpose(data.purpose);
    if (data.instructions) setInstructions(data.instructions);
    if (data.durationDays) {
      setDurationDays(data.durationDays);
      setIsChronic(false);
    }
    if (data.schedules && data.schedules.length > 0) {
      setSchedules(
        data.schedules.map((s, idx) => ({
          id: String(idx + 1),
          timeSlot: s.timeSlot,
          time: s.time,
          dosage: s.dosage || '১টি',
        }))
      );
    }
    setFormError('');
    setAiSuccessBanner(`"${data.brandName || 'প্রেসক্রিপশন'}" এর তথ্য পূরণ করা হয়েছে — এখন যাচাই করুন।`);
  };

  const applyLibraryPrefill = (prefill: AddMedicineLibraryPrefill) => {
    if (prefill.brandName) setBrandName(prefill.brandName);
    if (prefill.genericName) setGenericName(prefill.genericName);
    if (prefill.strength) setStrength(prefill.strength);
    if (prefill.type) setType(prefill.type);
    if (prefill.mealTiming) setMealTiming(prefill.mealTiming);
    if (prefill.purpose) setPurpose(prefill.purpose);
    setCatalogMedicineId(prefill.catalogMedicineId || undefined);
    setPackageDescription(prefill.packageDescription || undefined);
    setPricePerUnit(typeof prefill.pricePerUnit === 'number' ? prefill.pricePerUnit : undefined);
    setFormError('');
    setAiSuccessBanner(
      `"${prefill.brandName || 'নির্বাচিত ওষুধ'}" লাইব্রেরি থেকে পূরণ করা হয়েছে — এখন যাচাই করুন।`
    );
  };

  useEffect(() => {
    return () => {
      if (pendingPhotoPreviewUrl) {
        URL.revokeObjectURL(pendingPhotoPreviewUrl);
      }
    };
  }, [pendingPhotoPreviewUrl]);

  useEffect(() => {
    if (!editingMedicine) return;
    setBrandName(editingMedicine.brandName || '');
    setGenericName(editingMedicine.genericName || '');
    setType(editingMedicine.type || 'ট্যাবলেট');
    setStrength(editingMedicine.strength || '');
    setMealTiming(editingMedicine.mealTiming || 'খাওয়ার পরে');
    setAssignedPatientId(editingMedicine.assignedPatientId);
    setPurpose(editingMedicine.purpose || '');
    setDoctorName(editingMedicine.doctorName || '');
    setInstructions(editingMedicine.instructions || '');
    setStock(editingMedicine.stock ?? 0);
    setMinStockAlert(editingMedicine.minStockAlert ?? 5);
    setUnit(editingMedicine.unit || 'টি');
    setIsChronic(Boolean(editingMedicine.isChronic));
    setDurationDays(editingMedicine.durationDays || 7);
    setExpiryDate(editingMedicine.expiryDate || '');
    setSchedules(
      editingMedicine.schedules && editingMedicine.schedules.length > 0
        ? editingMedicine.schedules
        : [{ id: 'slot-morning', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }]
    );
    setCatalogMedicineId(editingMedicine.catalogMedicineId);
    setPackageDescription(editingMedicine.packageDescription);
    setPricePerUnit(editingMedicine.pricePerUnit);
    setIconTag(resolveMedicineIconTag(editingMedicine.iconTag, editingMedicine.type));
    setIconTagManuallyPicked(Boolean(editingMedicine.iconTag));
    setColorTag(editingMedicine.colorTag || 'teal');
    setExistingPhotoPath(editingMedicine.photoPath);
    setPhotoRemoved(false);
    setPendingPhotoBlob(null);
    setPendingPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoError(null);
    setFormError('');

    let active = true;
    if (editingMedicine.photoPath) {
      getMedicinePhotoSignedUrl(editingMedicine.photoPath).then((url) => {
        if (active) setExistingPhotoSignedUrl(url);
      });
    } else {
      setExistingPhotoSignedUrl(null);
    }
    return () => {
      active = false;
    };
  }, [editingMedicine]);

  useEffect(() => {
    if (!iconTagManuallyPicked) {
      setIconTag(getDefaultMedicineIconTag(type));
    }
  }, [type, iconTagManuallyPicked]);

  useEffect(() => {
    if (expenseAmountEdited) return;
    const prefillCost = computePrefilledMedicineCost(pricePerUnit, Number(stock) || 0);
    setExpenseAmountInput(prefillCost !== null ? String(prefillCost) : '');
  }, [pricePerUnit, stock, expenseAmountEdited]);

  useEffect(() => {
    loadDoctors();
    if (editingMedicine) return;
    try {
      const libraryPrefillRaw = localStorage.getItem('shasthobondhu_pending_library_prefill');
      if (libraryPrefillRaw) {
        const parsedPrefill = JSON.parse(libraryPrefillRaw) as AddMedicineLibraryPrefill;
        localStorage.removeItem('shasthobondhu_pending_library_prefill');
        applyLibraryPrefill(parsedPrefill);
      }
      const saved = localStorage.getItem('shasthobondhu_pending_ai_med');
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.removeItem('shasthobondhu_pending_ai_med');
        handleApplyScanResult(parsed);
      }
      const rxScanRaw = localStorage.getItem('shasthobondhu_pending_rx_scan');
      if (rxScanRaw) {
        const parsedRx = JSON.parse(rxScanRaw) as InitialPrescriptionScanImage;
        localStorage.removeItem('shasthobondhu_pending_rx_scan');
        if (parsedRx?.imageDataUrl) {
          setInitialScanImage(parsedRx);
          setShowPrescriptionFlow(true);
        }
      }
    } catch {
      // ignore parsing error
    }
  }, []);

  const handleApplyPreset = (preset: typeof commonMedicinePresets[0]) => {
    setBrandName(preset.brandName);
    setGenericName(preset.genericName);
    setType(preset.type);
    setStrength(preset.strength);
    setMealTiming(preset.mealTiming);
    setPurpose(preset.purpose);
    setStock(preset.stock);
    setMinStockAlert(preset.minStockAlert);
    setUnit(preset.unit);
    setIsChronic(preset.isChronic);
    setDurationDays(preset.durationDays || 7);
    setSchedules(
      preset.defaultSchedules.map((s, idx) => ({
        id: String(idx + 1),
        timeSlot: s.timeSlot,
        time: s.time,
        dosage: s.dosage,
      }))
    );
    setFormError('');
  };

  const toggleTimeSlot = (slot: TimeSlot) => {
    setFormError('');
    const exists = schedules.some((s) => s.timeSlot === slot);
    if (exists) {
      if (schedules.length <= 1) {
        setFormError('কমপক্ষে একটি সময় বেছে নিন');
        return;
      }
      setSchedules((prev) => prev.filter((s) => s.timeSlot !== slot));
    } else {
      const next = [
        ...schedules,
        {
          id: `slot-${slot}-${Date.now()}`,
          timeSlot: slot,
          time: DEFAULT_SLOT_TIMES[slot],
          dosage: '১টি',
        },
      ];
      next.sort((a, b) => SLOT_ORDER.indexOf(a.timeSlot) - SLOT_ORDER.indexOf(b.timeSlot));
      setSchedules(next);
    }
  };

  const addScheduleSlot = () => {
    const currentSlots = schedules.map((s) => s.timeSlot);
    const availableSlot = SLOT_ORDER.find((s) => !currentSlots.includes(s)) || 'দুপুর';
    setSchedules([
      ...schedules,
      {
        id: Date.now().toString(),
        timeSlot: availableSlot,
        time: DEFAULT_SLOT_TIMES[availableSlot],
        dosage: '১টি',
      },
    ]);
  };

  const removeScheduleSlot = (id: string) => {
    if (schedules.length <= 1) {
      setFormError('কমপক্ষে একটি সময় থাকা প্রয়োজন');
      return;
    }
    setSchedules(schedules.filter((s) => s.id !== id));
  };

  const updateSchedule = (id: string, updates: Partial<DoseSchedule>) => {
    setSchedules(schedules.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleNextStep = () => {
    setFormError('');
    if (step === 1 && !brandName.trim()) {
      setFormError('দয়া করে ওষুধের নাম লিখুন');
      return;
    }
    if (step === 2 && schedules.length === 0) {
      setFormError('কমপক্ষে একটি সময় বেছে নিন');
      return;
    }
    setStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSelectMedicinePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setIsCompressingPhoto(true);
    try {
      const { blob } = await compressMedicinePhotoFile(file);
      const nextUrl = URL.createObjectURL(blob);
      setPendingPhotoBlob(blob);
      setPendingPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setPhotoRemoved(false);
    } catch (err: any) {
      setPhotoError(err?.message || 'ছবি প্রসেস করা যায়নি। অনুগ্রহ করে অন্য ছবি বেছে নিন।');
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleRemoveMedicinePhoto = () => {
    setPendingPhotoBlob(null);
    setPendingPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExistingPhotoSignedUrl(null);
    setPhotoRemoved(true);
    setPhotoError(null);
  };

  const handlePrevStep = () => {
    setFormError('');
    if (step === 1) {
      clearEditingMedicine();
      setCurrentPage('medicines');
      return;
    }
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSaveMedicine = async () => {
    if (isSavingMedicine) return;
    if (!brandName.trim()) {
      setFormError('দয়া করে ওষুধের নাম লিখুন');
      setStep(1);
      return;
    }
    if (schedules.length === 0) {
      setFormError('কমপক্ষে একটি সময় বেছে নিন');
      setStep(2);
      return;
    }

    let validatedExpenseAmount: number | null = null;
    const numericStock = Number(stock) || 0;
    if (!editingMedicine && numericStock > 0 && addStockAsExpense) {
      const parsedExpense = parseExpenseAmountInput(expenseAmountInput, { allowZero: false });
      if (!parsedExpense.valid || parsedExpense.amount === null) {
        setFormError(parsedExpense.error || 'সঠিক খরচের পরিমাণ লিখুন');
        return;
      }
      validatedExpenseAmount = parsedExpense.amount;
    }

    const d = new Date();
    const localTodayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    setIsSavingMedicine(true);
    try {
      if (editingMedicine) {
        let nextPhotoPath = photoRemoved ? undefined : existingPhotoPath;
        if (pendingPhotoBlob) {
          if (currentUser) {
            try {
              nextPhotoPath = await uploadMedicinePhotoToStorage(
                currentUser.uid,
                editingMedicine.id,
                pendingPhotoBlob
              );
            } catch {
              showToast('ছবি আপলোড করা যায়নি; ওষুধের অন্যান্য তথ্য সংরক্ষণ করা হয়েছে', 'alert');
            }
          } else {
            showToast('ছবি ক্লাউডে সেভ করতে লগইন করুন', 'info');
          }
        } else if (photoRemoved && (editingMedicine.photoPath || currentUser)) {
          await deleteMedicinePhotoFromStorage(
            editingMedicine.photoPath,
            currentUser ? { userId: currentUser.uid, medicineId: editingMedicine.id } : undefined
          );
          nextPhotoPath = undefined;
        }

        updateMedicine(editingMedicine.id, {
          brandName: brandName.trim(),
          genericName: genericName.trim() || 'সাধারণ ওষুধ',
          type,
          strength: strength.trim() || 'নির্দিষ্ট মাত্রা',
          mealTiming,
          assignedPatientId,
          schedules,
          stock: numericStock,
          minStockAlert: Number(minStockAlert) || 5,
          unit,
          isChronic,
          durationDays: isChronic ? undefined : Number(durationDays) || 7,
          purpose: purpose.trim(),
          doctorName: doctorName.trim(),
          instructions: instructions.trim(),
          expiryDate: expiryDate.trim() || undefined,
          ...(catalogMedicineId ? { catalogMedicineId } : {}),
          ...(packageDescription ? { packageDescription } : {}),
          ...(typeof pricePerUnit === 'number' ? { pricePerUnit } : {}),
          iconTag,
          colorTag,
          photoPath: nextPhotoPath,
        });
        clearEditingMedicine();
        setCurrentPage('medicines');
        return;
      }

      const newMedicineId = addMedicine({
        brandName: brandName.trim(),
        genericName: genericName.trim() || 'সাধারণ ওষুধ',
        type,
        strength: strength.trim() || 'নির্দিষ্ট মাত্রা',
        mealTiming,
        assignedPatientId,
        schedules,
        stock: numericStock,
        minStockAlert: Number(minStockAlert) || 5,
        unit,
        startDate: localTodayIso,
        isChronic,
        durationDays: isChronic ? undefined : Number(durationDays) || 7,
        purpose: purpose.trim(),
        doctorName: doctorName.trim(),
        instructions: instructions.trim(),
        expiryDate: expiryDate.trim() || undefined,
        ...(catalogMedicineId ? { catalogMedicineId } : {}),
        ...(packageDescription ? { packageDescription } : {}),
        ...(typeof pricePerUnit === 'number' ? { pricePerUnit } : {}),
        status: 'active',
        iconTag,
        colorTag,
      });

      if (pendingPhotoBlob) {
        if (currentUser) {
          try {
            const uploadedPath = await uploadMedicinePhotoToStorage(
              currentUser.uid,
              newMedicineId,
              pendingPhotoBlob
            );
            updateMedicine(newMedicineId, { photoPath: uploadedPath });
          } catch {
            showToast('ওষুধ যোগ হয়েছে, কিন্তু ছবি আপলোড ব্যর্থ হয়েছে', 'alert');
          }
        } else {
          showToast('ওষুধ যোগ হয়েছে; ছবি ক্লাউডে সেভ করতে লগইন করুন', 'info');
        }
      }

      if (numericStock > 0 && addStockAsExpense && validatedExpenseAmount !== null) {
        addExpense({
          expenseDate: localTodayIso,
          amount: validatedExpenseAmount,
          category: 'ওষুধ',
          patientId: assignedPatientId,
          title: `${brandName.trim()} ক্রয় (${toBengaliNumber(numericStock)} ${unit})`,
          medicineId: newMedicineId,
          notes: 'নতুন ওষুধ কেনার সময় যোগ করা হয়েছে',
        });
      }

      setCurrentPage('medicines');
    } finally {
      setIsSavingMedicine(false);
    }
  };

  const mainSlotCards: {
    slot: TimeSlot;
    label: string;
    timeHint: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { slot: 'সকাল', label: 'সকাল', timeHint: 'সকাল ৮টা', icon: Sunrise },
    { slot: 'দুপুর', label: 'দুপুর', timeHint: 'দুপুর ১:৩০টা', icon: Sun },
    { slot: 'রাত', label: 'রাত', timeHint: 'রাত ৯:৩০টা', icon: Moon },
    { slot: 'সন্ধ্যা', label: 'সন্ধ্যা', timeHint: 'সন্ধ্যা ৬টা', icon: Sunset },
  ];

  const durationOptions: { label: string; days?: number; chronic: boolean }[] = [
    { label: '৭ দিন', days: 7, chronic: false },
    { label: '১৫ দিন', days: 15, chronic: false },
    { label: '৩০ দিন', days: 30, chronic: false },
    { label: 'চলমান (নিয়মিত)', chronic: true },
  ];

  if (showPrescriptionFlow) {
    return (
      <PrescriptionReviewView
        initialScanImage={initialScanImage}
        onBackToManual={() => {
          setShowPrescriptionFlow(false);
          setInitialScanImage(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 sm:px-6 py-6">

      {/* Top Navigation & Progress Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handlePrevStep}
          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2 text-base font-bold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{step === 1 ? 'ফিরে যান' : 'আগের ধাপ'}</span>
        </button>

        <span className="text-base font-bold text-primary bg-primary-soft px-4 py-2 rounded-xl border border-primary/25">
          ধাপ {toBengaliNumber(step)} / {toBengaliNumber(4)}
        </span>
      </div>

      {/* 4-Step Progress Bar */}
      <div className="grid grid-cols-4 gap-2" aria-label="ওষুধ যোগ করার ধাপ">
        {[1, 2, 3, 4].map((num) => (
          <div
            key={num}
            className={`h-2.5 rounded-full transition-colors ${
              num <= step ? 'bg-primary' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>

      {/* AI Pre-fill Banner */}
      {aiSuccessBanner && (
        <div className="p-4 bg-success-soft border border-success/30 rounded-2xl text-base text-success-text flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Check className="w-5 h-5 text-success-text shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{aiSuccessBanner}</p>
              <p className="text-sm text-success-text/90 mt-0.5">
                সবকিছু ঠিক থাকলে "পরবর্তী" বা শেষ ধাপে গিয়ে সংরক্ষণ করুন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiSuccessBanner(null)}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-success-text font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-danger-soft border border-danger/30 rounded-2xl text-base font-bold text-danger-text flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* ==================================================
          STEP 1: ওষুধের নাম (লিখে বা ছবি তুলে)
         ================================================== */}
      {step === 1 && (
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              ওষুধের নাম কী?
            </h1>
            <p className="text-base text-text-muted mt-1">
              নাম লিখুন অথবা প্রেসক্রিপশনের ছবি তুলুন
            </p>
          </div>

          <div>
            <label htmlFor="med-brand-input" className="block text-base font-bold text-text mb-2">
              ওষুধের নাম *
            </label>
            <input
              id="med-brand-input"
              type="text"
              value={brandName}
              onChange={(e) => {
                setBrandName(e.target.value);
                setFormError('');
              }}
              placeholder="যেমন: নাপা এক্সট্রা, সেক্লো ২০, কনকর"
              className="min-h-[56px] w-full px-4 py-3 text-lg bg-surface-2 border-2 border-border rounded-2xl text-text focus:outline-hidden focus:border-primary"
            />
            {currentUser && genericName.trim() && (
              <button
                type="button"
                onClick={() => setGenericBrandsTarget(genericName.trim())}
                className="mt-2.5 min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-soft border border-primary/25 text-primary text-sm font-bold hover:bg-primary/15 cursor-pointer transition-colors"
              >
                <Pill className="w-4 h-4 shrink-0" />
                <span>একই জেনেরিকের সব ব্র্যান্ড ({genericName.trim()})</span>
              </button>
            )}
          </div>

          {/* Prominent Prescription Photo Entry & Library Shortcut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowPrescriptionFlow(true)}
              className="min-h-[56px] flex items-center justify-center gap-2.5 px-5 py-3.5 bg-primary hover:bg-primary-hover text-on-primary rounded-2xl text-base sm:text-lg font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Camera className="w-5 h-5 shrink-0" />
              <span>প্রেসক্রিপশনের ছবি তুলুন/বাছুন</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-soft border border-primary/25 text-primary rounded-2xl text-base font-bold hover:bg-primary-soft/80 transition-colors cursor-pointer"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>ওষুধ লাইব্রেরি থেকে খুঁজুন</span>
            </button>
          </div>

          {/* Visual Identification (Icon + Color) & Optional Medicine Photo */}
          <div className="pt-3 border-t border-border space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-text">
                  ওষুধের আইকন ও রঙ (সহজে চেনার জন্য)
                </span>
                <MedicineBadgeIcon
                  iconTag={iconTag}
                  type={type}
                  colorTag={colorTag}
                  size="sm"
                  showLabel
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {MEDICINE_ICON_OPTIONS.map((opt) => {
                  const selected = iconTag === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setIconTag(opt.id);
                        setIconTagManuallyPicked(true);
                      }}
                      className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-primary-soft border-primary text-primary'
                          : 'bg-surface-2 border-border text-text hover:border-primary/50'
                      }`}
                    >
                      <MedicineBadgeIcon iconTag={opt.id} colorTag={colorTag} size="xs" />
                      <span>{opt.labelBn}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {MEDICINE_COLOR_OPTIONS.map((col) => {
                  const selected = colorTag === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setColorTag(col.id)}
                      aria-label={`রঙ: ${col.labelBn}`}
                      aria-pressed={selected}
                      className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                        selected
                          ? `${col.badgeClass} ring-2 ${col.ringClass}`
                          : 'bg-surface-2 border-border text-text-muted hover:text-text'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${col.dotClass}`} />
                      <span>{col.labelBn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Medicine Photo Upload */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-bold text-text">
                  ওষুধের ছবি (ঐচ্ছিক — প্যাকেট বা পাতার ছবি)
                </span>
                {!currentUser && (
                  <span className="text-[11px] font-semibold text-warning-text">
                    ক্লাউডে সংরক্ষণের জন্য লগইন প্রয়োজন
                  </span>
                )}
              </div>

              <input
                ref={cameraPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleSelectMedicinePhoto}
              />
              <input
                ref={galleryPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectMedicinePhoto}
              />

              {(pendingPhotoPreviewUrl || (!photoRemoved && existingPhotoSignedUrl)) ? (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-2 border border-border">
                  <img
                    src={pendingPhotoPreviewUrl || existingPhotoSignedUrl || ''}
                    alt={brandName || 'ওষুধের ছবি'}
                    className="w-16 h-16 rounded-xl object-cover border border-border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text truncate">
                      {pendingPhotoBlob
                        ? `নতুন ছবি সংযুক্ত (${Math.max(1, Math.round(pendingPhotoBlob.size / 1024))} KB)`
                        : 'সংরক্ষিত ওষুধের ছবি'}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      শুধুমাত্র আপনার অ্যাকাউন্টের জন্য ব্যক্তিগতভাবে সংরক্ষিত
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveMedicinePhoto}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-danger-soft text-danger-text text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ছবি সরান</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isCompressingPhoto}
                    onClick={() => cameraPhotoInputRef.current?.click()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-2 border border-border hover:border-primary text-text text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCompressingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Camera className="w-4 h-4 text-primary" />
                    )}
                    <span>ছবি তুলুন (ক্যামেরা)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCompressingPhoto}
                    onClick={() => galleryPhotoInputRef.current?.click()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-2 border border-border hover:border-primary text-text text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4 text-primary" />
                    <span>গ্যালারি থেকে ছবি যোগ করুন</span>
                  </button>
                </div>
              )}

              {photoError && (
                <p className="text-xs font-bold text-danger-text">{photoError}</p>
              )}
            </div>
          </div>

          {/* Common Presets */}
          {!editingMedicine && (
            <div className="pt-2 border-t border-border space-y-2.5">
              <span className="block text-sm font-bold text-text-muted">
                বেশি ব্যবহৃত ওষুধ (এক ট্যাপে বেছে নিন):
              </span>
              <div className="flex flex-wrap gap-2">
                {commonMedicinePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="min-h-[48px] px-4 py-2 text-sm font-semibold bg-surface-2 border border-border text-text rounded-xl hover:border-primary hover:bg-primary-soft transition-colors cursor-pointer"
                  >
                    + {preset.brandName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleNextStep}
            className="min-h-[56px] w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary hover:bg-primary-hover text-on-primary font-bold text-lg rounded-2xl shadow-sm transition-colors cursor-pointer"
          >
            <span>পরবর্তী ধাপ</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </section>
      )}

      {/* ==================================================
          STEP 2: কখন খাবেন (সকাল / দুপুর / রাত / সন্ধ্যা)
         ================================================== */}
      {step === 2 && (
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              কখন খাবেন?
            </h1>
            <p className="text-base text-text-muted mt-1">
              এক বা একাধিক সময় বেছে নিন (ডিফল্ট: ১টি করে, {mealTiming})
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {mainSlotCards.map((item) => {
              const Icon = item.icon;
              const isSelected = schedules.some((s) => s.timeSlot === item.slot);
              return (
                <button
                  key={item.slot}
                  type="button"
                  onClick={() => toggleTimeSlot(item.slot)}
                  aria-pressed={isSelected}
                  className={`min-h-[76px] p-4 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-primary bg-primary-soft text-text shadow-xs'
                      : 'border-border bg-surface-2 text-text hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-text-muted'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{item.label}</div>
                      <div className="text-sm text-text-muted">
                        {item.timeHint}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
                      isSelected
                        ? 'bg-primary border-primary text-on-primary'
                        : 'border-border'
                    }`}
                  >
                    {isSelected && <Check className="w-5 h-5" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            className="min-h-[56px] w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary hover:bg-primary-hover text-on-primary font-bold text-lg rounded-2xl shadow-sm transition-colors cursor-pointer"
          >
            <span>পরবর্তী ধাপ</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </section>
      )}

      {/* ==================================================
          STEP 3: কত দিন খাবেন?
         ================================================== */}
      {step === 3 && (
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              কত দিন খাবেন?
            </h1>
            <p className="text-base text-text-muted mt-1">
              নিচের যেকোনো একটি সময়সীমা বেছে নিন
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {durationOptions.map((opt) => {
              const isSelected = opt.chronic
                ? isChronic
                : !isChronic && durationDays === opt.days;

              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    if (opt.chronic) {
                      setIsChronic(true);
                    } else {
                      setIsChronic(false);
                      setDurationDays(opt.days || 7);
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`min-h-[72px] p-4 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-primary bg-primary-soft text-text shadow-xs'
                      : 'border-border bg-surface-2 text-text hover:border-primary/60'
                  }`}
                >
                  <span className="text-xl font-bold">{opt.label}</span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
                      isSelected
                        ? 'bg-primary border-primary text-on-primary'
                        : 'border-border'
                    }`}
                  >
                    {isSelected && <Check className="w-5 h-5" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            className="min-h-[56px] w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary hover:bg-primary-hover text-on-primary font-bold text-lg rounded-2xl shadow-sm transition-colors cursor-pointer"
          >
            <span>পরবর্তী ধাপ</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </section>
      )}

      {/* ==================================================
          STEP 4: যাচাই করে সেভ + "আরও অপশন" ভাঁজ
         ================================================== */}
      {step === 4 && (
        <section className="space-y-5">
          <div className="bg-surface border-2 border-primary rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text">
                তথ্য যাচাই করে সেভ করুন
              </h1>
              <p className="text-base text-text-muted mt-1">
                সব ঠিক থাকলে নিচের সবুজ বোতামে চাপ দিন
              </p>
            </div>

            {/* Easy Summary Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border space-y-3 text-base">
              <div className="flex flex-wrap justify-between gap-2 pb-2 border-b border-border">
                <span className="text-text-muted">ওষুধের নাম:</span>
                <strong className="text-lg text-text">{brandName}</strong>
              </div>

              <div className="flex flex-wrap justify-between gap-2 pb-2 border-b border-border">
                <span className="text-text-muted">কখন খাবেন:</span>
                <strong className="text-text">
                  {schedules.map((s) => `${s.timeSlot} (${s.dosage})`).join(', ')}
                </strong>
              </div>

              <div className="flex flex-wrap justify-between gap-2 pb-2 border-b border-border">
                <span className="text-text-muted">খাবারের নিয়ম:</span>
                <strong className="text-text">{mealTiming}</strong>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-text-muted">মেয়াদ:</span>
                <strong className="text-text">
                  {isChronic ? 'চলমান (নিয়মিত)' : `${toBengaliNumber(durationDays)} দিন`}
                </strong>
              </div>
            </div>

            {/* Optional opt-in expense prompt when initial stock > 0 */}
            {!editingMedicine && (Number(stock) || 0) > 0 && (
              <div className="p-4 rounded-2xl bg-primary-soft/60 border border-primary/25 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addStockAsExpense}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAddStockAsExpense(checked);
                      setFormError('');
                      if (checked && !expenseAmountEdited) {
                        const prefillCost = computePrefilledMedicineCost(
                          pricePerUnit,
                          Number(stock) || 0
                        );
                        if (prefillCost !== null) setExpenseAmountInput(String(prefillCost));
                      }
                    }}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                  <span className="text-base font-bold text-text">
                    খরচ হিসেবে যোগ করবে? ({toBengaliNumber(Number(stock))} {unit} মজুত)
                  </span>
                </label>

                {addStockAsExpense && (
                  <div className="space-y-1.5 pl-7">
                    <label className="block text-sm font-semibold text-text">
                      খরচের পরিমাণ (৳) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={expenseAmountInput}
                      onChange={(e) => {
                        setExpenseAmountEdited(true);
                        setExpenseAmountInput(e.target.value);
                        setFormError('');
                      }}
                      placeholder="যেমন: ১৮০ বা 180"
                      className="min-h-[44px] w-full sm:w-64 px-3.5 py-2 text-base font-bold bg-surface border border-border rounded-xl text-text tabular-nums focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                    {pricePerUnit ? (
                      <p className="text-xs text-text-muted tabular-nums">
                        প্রতি একক মূল্য (৳{toBengaliNumber(pricePerUnit)}) × {toBengaliNumber(Number(stock))} {unit} থেকে পূরণকৃত — চাইলে বদলাতে পারেন।
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">
                        একক মূল্য দেওয়া নেই — মোট খরচ নিজে লিখুন।
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Big Semantic Green Save CTA matching step helper copy */}
            <button
              type="button"
              disabled={isSavingMedicine}
              onClick={() => void handleSaveMedicine()}
              className="min-h-[60px] w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-[#15803D] hover:bg-[#166534] active:bg-[#14532D] text-white font-bold text-xl rounded-2xl shadow-md transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSavingMedicine ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Check className="w-6 h-6" />
              )}
              <span>
                {isSavingMedicine
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingMedicine
                  ? 'পরিবর্তন সংরক্ষণ করুন'
                  : 'ওষুধ সংরক্ষণ করুন'}
              </span>
            </button>
          </div>

          {/* Collapsible "আরও অপশন" Section for Advanced Fields */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowMoreOptions((prev) => !prev)}
              aria-expanded={showMoreOptions}
              className="min-h-[56px] w-full px-5 py-4 flex items-center justify-between gap-3 text-left text-base font-bold text-text hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <span>আরও অপশন (খাবারের সময়, স্টক, ধরন, ডাক্তারের নাম ও AI যাচাই)</span>
              {showMoreOptions ? (
                <ChevronUp className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-primary shrink-0" />
              )}
            </button>

            {showMoreOptions && (
              <div className="p-5 sm:p-6 pt-2 border-t border-border space-y-6">
                {/* Meal Timing & Patient & Strength */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      খাবারের নিয়ম
                    </label>
                    <select
                      value={mealTiming}
                      onChange={(e) => setMealTiming(e.target.value as MealTiming)}
                      className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                    >
                      <option value="খাওয়ার পরে">খাওয়ার পরে</option>
                      <option value="খাওয়ার আগে">খাওয়ার আগে (৩০ মিনিট পূর্বে)</option>
                      <option value="খালি পেটে">খালি পেটে</option>
                      <option value="ঘুমানোর আগে">ঘুমানোর আগে</option>
                      <option value="প্রয়োজনমতো">প্রয়োজনমতো</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-base font-semibold text-text">
                        কার জন্য ওষুধ?
                      </label>
                      <button
                        type="button"
                        onClick={openCreateProfileModal}
                        className="text-sm font-bold text-primary hover:underline cursor-pointer"
                      >
                        + নতুন প্রোফাইল
                      </button>
                    </div>
                    <select
                      value={assignedPatientId || ''}
                      onChange={(e) => setAssignedPatientId(e.target.value || undefined)}
                      className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                    >
                      <option value="">নির্দিষ্ট প্রোফাইল নেই</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.relation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Generic, Type, Strength */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      জেনেরিক / উপাদান
                    </label>
                    <input
                      type="text"
                      value={genericName}
                      onChange={(e) => setGenericName(e.target.value)}
                      placeholder="যেমন: প্যারাসিটামল"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      ওষুধের ধরন
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as MedicineType)}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    >
                      <option value="ট্যাবলেট">ট্যাবলেট</option>
                      <option value="ক্যাপসুল">ক্যাপসুল</option>
                      <option value="সিরাপ">সিরাপ</option>
                      <option value="ইনসুলিন/ইনজেকশন">ইনসুলিন/ইনজেকশন</option>
                      <option value="চোখের ড্রপ">চোখের ড্রপ</option>
                      <option value="ইনহেলার">ইনহেলার</option>
                      <option value="মলম/জেল">মলম/জেল</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      মাত্রা (শক্তি)
                    </label>
                    <input
                      type="text"
                      value={strength}
                      onChange={(e) => setStrength(e.target.value)}
                      placeholder="যেমন: ৫০০ মি.গ্রা."
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>
                </div>

                {/* Custom Times & Dosage per Slot */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-text">
                      নির্ধারিত সময় ও পরিমাণ বদলান
                    </span>
                    <button
                      type="button"
                      onClick={addScheduleSlot}
                      className="min-h-[48px] px-3.5 py-2 text-sm font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:bg-primary-soft/80 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>সময় যোগ</span>
                    </button>
                  </div>

                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3 bg-surface-2 rounded-xl border border-border flex flex-wrap items-center gap-3"
                    >
                      <select
                        value={schedule.timeSlot}
                        onChange={(e) => updateSchedule(schedule.id, { timeSlot: e.target.value as TimeSlot })}
                        className="min-h-[48px] text-base bg-surface border border-border rounded-xl px-3 py-2 text-text"
                      >
                        <option value="সকাল">সকাল</option>
                        <option value="দুপুর">দুপুর</option>
                        <option value="সন্ধ্যা">সন্ধ্যা</option>
                        <option value="রাত">রাত</option>
                      </select>

                      <input
                        type="text"
                        value={schedule.time}
                        onChange={(e) => updateSchedule(schedule.id, { time: e.target.value })}
                        placeholder="08:00 AM"
                        aria-label="সময়"
                        className="min-h-[48px] w-32 px-3 py-2 text-base bg-surface border border-border rounded-xl text-text"
                      />

                      <input
                        type="text"
                        value={schedule.dosage}
                        onChange={(e) => updateSchedule(schedule.id, { dosage: e.target.value })}
                        placeholder="১টি"
                        aria-label="ডোজ"
                        className="min-h-[48px] w-28 px-3 py-2 text-base bg-surface border border-border rounded-xl text-text"
                      />

                      {schedules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleSlot(schedule.id)}
                          className="min-h-[48px] min-w-[48px] flex items-center justify-center text-danger-text hover:bg-danger-soft rounded-xl cursor-pointer"
                          title="স্লট সরান"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stock, Min Alert, Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      হাতে মজুত আছে
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      কম হলে সতর্ক সীমা
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      একক
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    >
                      <option value="টি">টি</option>
                      <option value="বোতল">বোতল</option>
                      <option value="পেন">পেন</option>
                      <option value="ড্রপ">ড্রপ</option>
                      <option value="পাফ">পাফ</option>
                    </select>
                  </div>
                </div>

                {/* Purpose, Doctor, Instructions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      কী কারণে খাচ্ছেন
                    </label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="যেমন: প্রেসার, সুগার, জ্বর"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      ডাক্তারের নাম
                    </label>
                    <input
                      type="text"
                      list="my-doctors-datalist"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="যেমন: ডা. করিম"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                    {doctors.length > 0 && (
                      <datalist id="my-doctors-datalist">
                        {doctors.map((d) => (
                          <option key={d.id} value={d.name} />
                        ))}
                      </datalist>
                    )}
                    {doctorName.trim().length >= 2 &&
                      !doctorExistsByName(doctors, doctorName) &&
                      addedDoctorKey !== doctorName.trim().toLowerCase() && (
                        <button
                          type="button"
                          disabled={isSavingQuickDoctor}
                          onClick={async () => {
                            const trimmed = doctorName.trim();
                            setIsSavingQuickDoctor(true);
                            try {
                              await addDoctor({
                                name: trimmed,
                                forConditions: purpose.trim() || undefined,
                                patientIds: assignedPatientId ? [assignedPatientId] : undefined,
                              });
                              setAddedDoctorKey(trimmed.toLowerCase());
                            } finally {
                              setIsSavingQuickDoctor(false);
                            }
                          }}
                          className="mt-2 min-h-[48px] w-full sm:w-auto px-3.5 py-2 rounded-xl bg-primary-soft border border-primary/25 text-primary text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 cursor-pointer disabled:opacity-50"
                        >
                          <Stethoscope className="w-4 h-4 shrink-0" />
                          <span>
                            {isSavingQuickDoctor
                              ? 'যোগ করা হচ্ছে...'
                              : `এই ডাক্তারকে ("${doctorName.trim()}") তালিকায় যোগ করবেন?`}
                          </span>
                        </button>
                      )}
                    {doctorName.trim().length >= 2 &&
                      addedDoctorKey === doctorName.trim().toLowerCase() && (
                        <p className="mt-1.5 text-xs font-semibold text-success-text flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>&quot;{doctorName.trim()}&quot; আমার ডাক্তার তালিকায় যোগ হয়েছে</span>
                        </p>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      বিশেষ নির্দেশনা
                    </label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="যেমন: বেশি করে পানি খাবেন"
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-text mb-1.5">
                      প্যাকেটের মেয়াদ শেষের তারিখ (ঐচ্ছিক)
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="min-h-[48px] w-full px-3.5 py-2 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                  </div>
                </div>

                {/* AI Info & Drug Interaction Check */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isCheckingInteractions}
                      onClick={handleCheckDrugInteractions}
                      className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isCheckingInteractions ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>যাচাই হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>অন্য ওষুধের সাথে মানাবে কিনা দেখুন</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInfoModalOpen(true)}
                      className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-border text-text rounded-xl text-sm font-bold cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>ওষুধ সম্পর্কে জানুন</span>
                    </button>
                  </div>

                  {interactionError && (
                    <div className="p-3.5 bg-warning-soft border border-warning/30 rounded-xl text-sm text-warning-text flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span>{interactionError}</span>
                        {isAdmin && interactionErrorCode && (
                          <p className="mt-1 text-xs font-mono text-text-muted">
                            কোড: {interactionErrorCode}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {interactionResult && (
                    <div className="space-y-3">
                      <div
                        className={`p-4 rounded-xl border flex items-start gap-3 ${
                          interactionResult.hasInteraction
                            ? 'bg-warning-soft border-warning/30 text-warning-text'
                            : 'bg-success-soft border-success/30 text-success-text'
                        }`}
                      >
                        {interactionResult.hasInteraction ? (
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                        )}
                        <div className="text-sm space-y-1">
                          <p className="font-bold text-base">
                            {interactionResult.hasInteraction
                              ? 'সতর্কতা: ডাক্তারের পরামর্শ নিয়ে খান'
                              : 'কোনো সমস্যা পাওয়া যায়নি'}
                          </p>
                          <p>{interactionResult.summary}</p>
                        </div>
                      </div>

                      {interactionResult.recommendation && (
                        <div className="p-3 rounded-xl bg-primary-soft border border-primary/25 text-sm text-primary flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{interactionResult.recommendation}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI Prescription OCR Scanner Modal */}
      <PrescriptionScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyData={handleApplyScanResult}
      />

      {/* AI Medicine Info Modal */}
      <MedicineInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        initialMedicineName={brandName || genericName}
      />

      {/* Generic Brands Bottom Sheet */}
      <GenericBrandsBottomSheet
        genericName={genericBrandsTarget}
        isLoggedIn={!!currentUser}
        onClose={() => setGenericBrandsTarget(null)}
        onOpenAuth={openAuthModal}
        onSelectBrand={(brand) => {
          applyLibraryPrefill(mapGlobalMedicineToAddFormPrefill(brand));
        }}
      />

    </div>
  );
};
