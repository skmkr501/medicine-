import React, { useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine, Medicine } from '../../types';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  fetchLibraryMedicinesByIds,
  searchLibraryMedicines,
} from '../../supabase/libraryService';
import {
  QuickRangePresetKey,
  calculateMedicineShoppingList,
  calculateShoppingCostSummary,
  formatQuantityBn,
  formatTakaBn,
  getDateRangeForQuickPreset,
  loadSavedShoppingDateRange,
  normalizeDigitsInput,
  normalizeLocalDate,
  saveShoppingDateRange,
} from '../../utils/shoppingListCalculator';
import { buildShoppingListWhatsAppUrl } from '../../utils/shoppingListPdf';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  Package,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Send,
  ShoppingBag,
  User,
  Users,
  X,
} from 'lucide-react';

export const ShoppingListPage: React.FC = () => {
  const {
    medicines,
    patients,
    activePatientId,
    setCurrentPage,
    openStockAdjustmentModal,
    updateMedicine,
  } = useMedicine();

  const [catalogMedicines, setCatalogMedicines] = useState<GlobalMedicine[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadRelevantCatalog = async () => {
      if (!medicines || medicines.length === 0) {
        if (!cancelled) setCatalogMedicines([]);
        return;
      }

      const collected = new Map<string, GlobalMedicine>();
      const idsToFetch = Array.from(
        new Set(
          medicines
            .map((m) => m.catalogMedicineId?.trim())
            .filter((id): id is string => Boolean(id))
        )
      );

      try {
        if (idsToFetch.length > 0) {
          const byId = await fetchLibraryMedicinesByIds(idsToFetch);
          for (const gm of byId) {
            collected.set(gm.id, gm);
          }
        }

        // For medicines lacking catalogMedicineId or missing manual price, fetch top search matches
        const brandQueries = Array.from(
          new Set(
            medicines
              .filter(
                (m) =>
                  (!m.catalogMedicineId || !collected.has(m.catalogMedicineId)) &&
                  m.brandName.trim().length > 1
              )
              .map((m) => m.brandName.trim())
          )
        ).slice(0, 15);

        if (brandQueries.length > 0) {
          const searchLists = await Promise.all(
            brandQueries.map((q) =>
              searchLibraryMedicines(q, { limit: 10 }).catch(() => [] as GlobalMedicine[])
            )
          );
          for (const list of searchLists) {
            for (const gm of list) {
              collected.set(gm.id, gm);
            }
          }
        }

        if (!cancelled) {
          setCatalogMedicines(Array.from(collected.values()));
        }
      } catch {
        // Non-fatal: shopping list still computes quantities with personal medicine fields
      }
    };

    void loadRelevantCatalog();
    return () => {
      cancelled = true;
    };
  }, [medicines]);

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const today = useMemo(() => normalizeLocalDate(new Date()), []);

  const [selectedPatientId, setSelectedPatientId] = useState<string | 'all'>(() => {
    if (activePatientId && activePatients.some((p) => p.id === activePatientId)) {
      return activePatientId;
    }
    return 'all';
  });

  const [dateRangeState, setDateRangeState] = useState(() => {
    const initialPatient =
      activePatientId && patients.some((p) => !p.isArchived && p.id === activePatientId)
        ? activePatientId
        : 'all';
    return loadSavedShoppingDateRange(initialPatient, normalizeLocalDate(new Date()));
  });

  const { startDateIso, targetDateIso, preset } = dateRangeState;

  const [includeBuffer, setIncludeBuffer] = useState<boolean>(true);
  const [doctorName, setDoctorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [editingPriceMedId, setEditingPriceMedId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [priceError, setPriceError] = useState<string>('');

  const result = useMemo(
    () =>
      calculateMedicineShoppingList({
        medicines,
        patients: activePatients,
        globalMedicines: catalogMedicines,
        selectedPatientId,
        startDate: startDateIso,
        targetDate: targetDateIso,
        includeBuffer,
        referenceDate: today,
      }),
    [
      medicines,
      activePatients,
      catalogMedicines,
      selectedPatientId,
      startDateIso,
      targetDateIso,
      includeBuffer,
      today,
    ]
  );

  const activeToBuyItems = useMemo(
    () => result.toBuyItems.filter((item) => !excludedIds.has(item.medicine.id)),
    [result.toBuyItems, excludedIds]
  );

  const costSummary = useMemo(
    () => calculateShoppingCostSummary(result.toBuyItems, excludedIds),
    [result.toBuyItems, excludedIds]
  );

  const whatsappUrl = useMemo(
    () =>
      buildShoppingListWhatsAppUrl({
        result,
        doctorName,
        notes,
        excludedMedicineIds: excludedIds,
      }),
    [result, doctorName, notes, excludedIds]
  );

  const toggleExcludeMedicine = (medicineId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medicineId)) {
        next.delete(medicineId);
      } else {
        next.add(medicineId);
      }
      return next;
    });
  };

  const openPriceEditor = (med: Medicine, currentUnitPrice: number | null) => {
    setEditingPriceMedId(med.id);
    setPriceInput(
      currentUnitPrice !== null && !Number.isNaN(currentUnitPrice)
        ? String(currentUnitPrice)
        : ''
    );
    setPriceError('');
  };

  const cancelPriceEditor = () => {
    setEditingPriceMedId(null);
    setPriceInput('');
    setPriceError('');
  };

  const handleSavePrice = (medId: string) => {
    const cleaned = normalizeDigitsInput(priceInput).replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    if (!cleaned || Number.isNaN(parsed) || parsed <= 0) {
      setPriceError('সঠিক দাম লিখুন (যেমন: 2.50 বা ১০)');
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    updateMedicine(medId, { pricePerUnit: rounded });
    setEditingPriceMedId(null);
    setPriceInput('');
    setPriceError('');
  };

  const handleSelectPatient = (nextPatientId: string | 'all') => {
    setSelectedPatientId(nextPatientId);
    setDateRangeState(loadSavedShoppingDateRange(nextPatientId, today));
  };

  const updateAndPersistRange = (nextRange: {
    startDateIso: string;
    targetDateIso: string;
    preset: QuickRangePresetKey;
  }) => {
    setDateRangeState(nextRange);
    saveShoppingDateRange(selectedPatientId, nextRange);
  };

  const handleSelectPreset = (
    nextPreset: Exclude<QuickRangePresetKey, 'custom'>
  ) => {
    const range = getDateRangeForQuickPreset(nextPreset, today);
    updateAndPersistRange({
      startDateIso: range.startDateIso,
      targetDateIso: range.targetDateIso,
      preset: nextPreset,
    });
  };

  const handlePrintPdf = () => {
    if (!result.isValidDateRange) return;
    window.print();
  };

  const presetButtons: {
    key: Exclude<QuickRangePresetKey, 'custom'>;
    label: string;
  }[] = [
    { key: '7d', label: 'আজ থেকে ৭ দিন' },
    { key: '15d', label: 'আজ থেকে ১৫ দিন' },
    { key: '30d', label: 'আজ থেকে ৩০ দিন' },
    { key: 'this_month', label: 'এই মাস' },
  ];

  // Unified ordered rows for A4 print table: Active To-Buy -> As-needed -> Sufficient
  const printTableRows = useMemo(() => {
    const rows: {
      name: string;
      subName: string;
      dailyUsageText: string;
      currentStockText: string;
      toBuyText: string;
      unitPriceText: string;
      totalCostText: string;
      warningText?: string;
    }[] = [];

    for (const item of activeToBuyItems) {
      const med = item.medicine;
      const showPatient =
        selectedPatientId === 'all' && item.patientName !== 'সাধারণ';
      rows.push({
        name: `${med.brandName}${med.strength ? ` (${med.strength})` : ''}`,
        subName: `${med.genericName || med.type}${showPatient ? ` · ${item.patientName}` : ''}`,
        dailyUsageText: `${formatQuantityBn(item.dailyUsage)} ${item.unit}/দিন`,
        currentStockText: `${formatQuantityBn(item.currentStock)} ${item.unit} (${toBengaliNumber(item.daysRemaining)} দিন)`,
        toBuyText:
          item.toBuyUnits > 0
            ? `${toBengaliNumber(item.toBuyUnits)} ${item.unit}${
                item.packSummaryBn ? ` (${item.packSummaryBn})` : ''
              }`
            : 'নতুন প্যাকেট কিনুন',
        unitPriceText: item.unitPrice !== null ? formatTakaBn(item.unitPrice) : '—',
        totalCostText: item.estimatedCost !== null ? formatTakaBn(item.estimatedCost) : '—',
        warningText: item.expiryWarningBn,
      });
    }

    for (const item of result.asNeededItems) {
      const med = item.medicine;
      const showPatient =
        selectedPatientId === 'all' && item.patientName !== 'সাধারণ';
      rows.push({
        name: `${med.brandName}${med.strength ? ` (${med.strength})` : ''}`,
        subName: `${med.genericName || med.type}${showPatient ? ` · ${item.patientName}` : ''}`,
        dailyUsageText: 'প্রয়োজনমতো',
        currentStockText: `${formatQuantityBn(item.currentStock)} ${item.unit}`,
        toBuyText: 'নিজে হিসাব করুন',
        unitPriceText: '—',
        totalCostText: '—',
        warningText: item.expiryWarningBn,
      });
    }

    for (const item of result.sufficientItems) {
      const med = item.medicine;
      const showPatient =
        selectedPatientId === 'all' && item.patientName !== 'সাধারণ';
      rows.push({
        name: `${med.brandName}${med.strength ? ` (${med.strength})` : ''}`,
        subName: `${med.genericName || med.type}${showPatient ? ` · ${item.patientName}` : ''}`,
        dailyUsageText: `${formatQuantityBn(item.dailyUsage)} ${item.unit}/দিন`,
        currentStockText: `${formatQuantityBn(item.currentStock)} ${item.unit} (${toBengaliNumber(item.daysRemaining)} দিন)`,
        toBuyText: 'পর্যাপ্ত আছে ✓',
        unitPriceText: '—',
        totalCostText: '—',
      });
    }

    return rows;
  }, [activeToBuyItems, result.asNeededItems, result.sufficientItems, selectedPatientId]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ==================================================
          SCREEN UI (Hidden during A4 print)
         ================================================== */}
      <div className="no-print space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('medicines')}
            className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 text-base font-bold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ওষুধের তালিকায় ফিরে যান</span>
          </button>

          <div className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary-soft border border-primary/25 px-3.5 py-2 rounded-xl">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>আজ: {result.referenceDateBn}</span>
          </div>
        </div>

        {/* Page Heading */}
        <header className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
                ওষুধ কেনার তালিকা
              </h1>
              <p className="text-base text-text-muted">
                বর্তমান মজুদ ও দৈনিক ডোজ অনুযায়ী কতটি ওষুধ কিনতে হবে তা সহজেই হিসাব করুন
              </p>
            </div>
          </div>
        </header>

        {/* Inputs Card */}
        <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
          {/* 1. Patient Selector */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-lg font-bold text-text">
              <Users className="w-5 h-5 text-primary" />
              <span>কার জন্য তালিকা বানাবেন?</span>
            </label>

            {activePatients.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border text-base text-text">
                সবার জন্য (এখনো কোনো আলাদা ফ্যামিলি প্রোফাইল যোগ করা হয়নি)
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectPatient('all')}
                  aria-pressed={selectedPatientId === 'all'}
                  className={`min-h-[48px] px-4 py-2.5 rounded-xl border-2 text-base font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedPatientId === 'all'
                      ? 'border-primary bg-primary text-on-primary shadow-xs'
                      : 'border-border bg-surface-2 text-text hover:border-primary/60'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>সবার</span>
                </button>

                {activePatients.map((patient) => {
                  const isSelected = selectedPatientId === patient.id;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelectPatient(patient.id)}
                      aria-pressed={isSelected}
                      className={`min-h-[48px] px-4 py-2.5 rounded-xl border-2 text-base font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary text-on-primary shadow-xs'
                          : 'border-border bg-surface-2 text-text hover:border-primary/60'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>
                        {patient.name} ({patient.relation})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Target Date Range & Quick Presets */}
          <div className="space-y-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 text-lg font-bold text-text">
              <Calendar className="w-5 h-5 text-primary" />
              <span>কত দিনের ওষুধ লাগবে? (তারিখের পরিসর)</span>
            </label>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {presetButtons.map((btn) => {
                const isSelected = preset === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => handleSelectPreset(btn.key)}
                    aria-pressed={isSelected}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border-2 text-sm sm:text-base font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary text-on-primary shadow-xs'
                        : 'border-border bg-surface-2 text-text hover:border-primary/60'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* Separate Start Date & End Date fields side-by-side (stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="shopping-start-date"
                    className="block text-base font-bold text-text"
                  >
                    শুরুর তারিখ <span className="text-sm font-normal text-text-muted">(ঐচ্ছিক)</span>
                  </label>
                  {startDateIso ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateAndPersistRange({
                          startDateIso: '',
                          targetDateIso,
                          preset: 'custom',
                        })
                      }
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      খালি করুন
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const todayIso = getDateRangeForQuickPreset('7d', today).startDateIso;
                        updateAndPersistRange({
                          startDateIso: todayIso,
                          targetDateIso,
                          preset: 'custom',
                        });
                      }}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      আজকের তারিখ দিন
                    </button>
                  )}
                </div>
                <input
                  id="shopping-start-date"
                  type="date"
                  value={startDateIso}
                  onChange={(e) => {
                    updateAndPersistRange({
                      startDateIso: e.target.value,
                      targetDateIso,
                      preset: 'custom',
                    });
                  }}
                  className={`min-h-[48px] w-full px-4 py-2 text-base font-semibold bg-surface-2 border-2 rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary ${
                    !result.isValidDateRange && startDateIso
                      ? 'border-danger'
                      : 'border-border'
                  }`}
                />
                <p className="text-xs text-text-muted">
                  {startDateIso
                    ? 'শুরুর তারিখ থেকে শেষ তারিখ (দুই তারিখসহ) হিসাব হবে'
                    : 'খালি থাকলে আজ থেকে শেষ তারিখ পর্যন্ত হিসাব হবে'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="shopping-target-date"
                  className="block text-base font-bold text-text"
                >
                  শেষ তারিখ
                </label>
                <input
                  id="shopping-target-date"
                  type="date"
                  value={targetDateIso}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    updateAndPersistRange({
                      startDateIso,
                      targetDateIso: e.target.value,
                      preset: 'custom',
                    });
                  }}
                  className={`min-h-[48px] w-full px-4 py-2 text-base font-semibold bg-surface-2 border-2 rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary ${
                    !result.isValidDateRange ? 'border-danger' : 'border-border'
                  }`}
                />
                <p className="text-xs text-text-muted">
                  এই তারিখ পর্যন্ত প্রয়োজনীয় ওষুধ হিসাব করা হবে
                </p>
              </div>
            </div>

            {!result.isValidDateRange && result.dateErrorBn && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text flex items-center gap-2 text-base font-bold"
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{result.dateErrorBn}</span>
              </div>
            )}

            {result.isValidDateRange && (
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex flex-wrap items-center justify-between gap-2 text-base">
                <span className="font-semibold text-text">
                  {result.periodSummaryBn}
                </span>
                {result.bufferDays > 0 && (
                  <span className="font-bold text-primary tabular-nums text-sm sm:text-base">
                    + {toBengaliNumber(result.bufferDays)} দিন বাফার = মোট{' '}
                    {toBengaliNumber(result.effectiveDays)} দিন
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. Buffer Toggle */}
          <div className="pt-4 border-t border-border">
            <button
              type="button"
              role="switch"
              aria-checked={includeBuffer}
              onClick={() => setIncludeBuffer((prev) => !prev)}
              className={`w-full min-h-[56px] p-4 rounded-xl border-2 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                includeBuffer
                  ? 'border-primary bg-primary-soft/70'
                  : 'border-border bg-surface-2'
              }`}
            >
              <div>
                <span className="block text-base sm:text-lg font-bold text-text">
                  অতিরিক্ত ২ দিনের বাফার
                </span>
                <span className="block text-sm text-text-muted mt-0.5">
                  হঠাৎ ওষুধ ফুরিয়ে না যাওয়ার জন্য প্রয়োজনের সাথে ২ দিনের বাড়তি হিসাব যোগ রাখুন
                </span>
              </div>
              <div
                className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 flex items-center ${
                  includeBuffer ? 'bg-primary justify-end' : 'bg-border justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-surface shadow-xs" />
              </div>
            </button>
          </div>

          {/* 4. Optional Doctor Name & Notes */}
          <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="shopping-doctor-name"
                className="block text-base font-bold text-text mb-1.5"
              >
                ডাক্তারের নাম (ঐচ্ছিক)
              </label>
              <input
                id="shopping-doctor-name"
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="যেমন: ডা. করিম"
                className="min-h-[48px] w-full px-4 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="shopping-notes"
                className="block text-base font-bold text-text mb-1.5"
              >
                নোট (ঐচ্ছিক)
              </label>
              <input
                id="shopping-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: সকালের মধ্যে কিনে আনতে হবে"
                className="min-h-[48px] w-full px-4 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </section>

        {/* Invalid Date Range Guard */}
        {!result.isValidDateRange && result.hasExplicitStartDate ? (
          <section className="bg-danger-soft border border-danger/30 rounded-2xl p-6 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 text-danger-text mx-auto" />
            <h2 className="text-xl font-bold text-danger-text">
              {result.dateErrorBn || 'শুরুর তারিখ শেষ তারিখের আগে হতে হবে'}
            </h2>
            <p className="text-base text-danger-text/90">
              সঠিক তালিকা হিসাব করতে শুরুর তারিখটি শেষ তারিখের সমান বা আগে দিন।
            </p>
          </section>
        ) : result.totalActiveMedicinesConsidered === 0 ? (
          <section className="bg-surface border border-border rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
              <Pill className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-text">
              এখনো কোনো চলমান ওষুধ নেই
            </h2>
            <p className="text-base text-text-muted max-w-md mx-auto">
              কেনার তালিকা তৈরি করতে প্রথমে চলমান ওষুধ ও তার খাওয়ার সময় যোগ করুন।
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="min-h-[52px] inline-flex items-center gap-2 px-6 py-3 text-base font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-2xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>ওষুধ যোগ করুন</span>
            </button>
          </section>
        ) : (
          <>
            {/* Top Summary & Action Buttons */}
            <section className="bg-surface border-2 border-primary/30 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              {result.periodSummaryBn && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-primary-soft border border-primary/25 text-sm sm:text-base font-bold text-primary">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>{result.periodSummaryBn}</span>
                  </span>
                  {result.bufferDays > 0 && (
                    <span className="text-xs sm:text-sm font-semibold">
                      (+ {toBengaliNumber(result.bufferDays)} দিন বাফার)
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-text">
                    {toBengaliNumber(result.totalActiveMedicinesConsidered)}টি ওষুধের মধ্যে{' '}
                    <span className="text-primary">
                      {toBengaliNumber(activeToBuyItems.length)}টি কিনতে হবে
                    </span>
                  </h2>
                  <p className="text-base text-text-muted mt-0.5">
                    রোগী: {result.patientLabelBn}
                    {result.patientAge !== undefined
                      ? ` · বয়স: ${toBengaliNumber(result.patientAge)} বছর`
                      : ''}
                    {costSummary.excludedCount > 0
                      ? ` · ${toBengaliNumber(costSummary.excludedCount)}টি বাদ দেওয়া হয়েছে`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm font-bold tabular-nums">
                  <span className="px-3 py-1.5 rounded-lg bg-primary-soft text-primary border border-primary/25">
                    কিনতে হবে: {toBengaliNumber(activeToBuyItems.length)}টি
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-success-soft text-success-text border border-success/30">
                    পর্যাপ্ত আছে: {toBengaliNumber(result.sufficientItems.length)}টি
                  </span>
                  {result.asNeededItems.length > 0 && (
                    <span className="px-3 py-1.5 rounded-lg bg-surface-2 text-text border border-border">
                      নিজে হিসাব: {toBengaliNumber(result.asNeededItems.length)}টি
                    </span>
                  )}
                </div>
              </div>

              {/* Estimated Total Cost Box */}
              {result.toBuyItems.length > 0 && (
                <div className="p-4 sm:p-5 rounded-xl bg-primary-soft/80 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="block text-sm font-semibold text-primary">
                      দাম আনুমানিক, দোকানভেদে বদলাতে পারে
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-text tabular-nums mt-0.5">
                      আনুমানিক মোট খরচ {formatTakaBn(costSummary.totalEstimatedCost)}
                    </div>
                  </div>
                  {costSummary.missingPriceCount > 0 && (
                    <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-warning-soft border border-warning/30 text-sm font-bold text-warning-text shrink-0">
                      {toBengaliNumber(costSummary.missingPriceCount)} টির দাম নেই, মোটে ধরা হয়নি
                    </span>
                  )}
                </div>
              )}

              {/* Required Primary Actions: [PDF / প্রিন্ট] & [হোয়াটসঅ্যাপে পাঠান] */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="min-h-[56px] flex items-center justify-center gap-2.5 px-5 py-3.5 bg-primary hover:bg-primary-hover text-on-primary text-lg font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  <span>PDF / প্রিন্ট</span>
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[56px] flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#15803D] hover:bg-[#166534] active:bg-[#14532D] text-white text-lg font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                  <span>হোয়াটসঅ্যাপে পাঠান</span>
                </a>
              </div>
            </section>

            {/* Section 1: কিনতে হবে (Sorted by soonest run-out first) */}
            <section className="space-y-3.5">
              <h2 className="text-xl font-bold text-text flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-primary" />
                <span>কিনতে হবে ({toBengaliNumber(activeToBuyItems.length)}টি)</span>
              </h2>

              {result.toBuyItems.length === 0 ? (
                <div className="bg-success-soft border border-success/30 rounded-2xl p-6 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-success-text mx-auto" />
                  <h3 className="text-lg font-bold text-success-text">
                    সব নিয়মিত ওষুধ পর্যাপ্ত আছে ✓
                  </h3>
                  <p className="text-base text-success-text/90">
                    {result.targetDateBn} পর্যন্ত নতুন করে কোনো নিয়মিত ওষুধ কিনতে হবে না।
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {result.toBuyItems.map((item) => {
                    const med = item.medicine;
                    const showPatient =
                      selectedPatientId === 'all' && item.patientName !== 'সাধারণ';
                    const isExcluded = excludedIds.has(med.id);
                    const isEditingPrice = editingPriceMedId === med.id;

                    return (
                      <article
                        key={med.id}
                        className={`bg-surface rounded-2xl border-2 p-5 shadow-xs space-y-4 transition-opacity ${
                          isExcluded
                            ? 'opacity-65 border-dashed border-border'
                            : item.expiresBeforeTarget
                            ? 'border-danger'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-xl font-bold text-text ${
                                  isExcluded ? 'line-through' : ''
                                }`}
                              >
                                {med.brandName}
                              </h3>
                              {med.strength && (
                                <span className="text-base font-semibold text-text-muted">
                                  ({med.strength})
                                </span>
                              )}
                              {isExcluded && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-surface-2 text-text text-xs font-bold">
                                  কেনা বাদ
                                </span>
                              )}
                            </div>
                            <p className="text-base text-text-muted">
                              {med.genericName} · {med.type}
                              {showPatient ? ` · রোগী: ${item.patientName}` : ''}
                            </p>
                          </div>

                          {/* Highlighted Buy Amount */}
                          <div
                            className={`rounded-xl px-4 py-3 text-left sm:text-right shrink-0 ${
                              isExcluded
                                ? 'bg-text-muted text-surface'
                                : item.toBuyUnits > 0
                                ? 'bg-primary text-on-primary'
                                : 'bg-danger text-white'
                            }`}
                          >
                            {item.toBuyUnits > 0 ? (
                              <>
                                <span className="block text-sm font-medium opacity-85">
                                  কিনতে হবে
                                </span>
                                <strong className="text-2xl font-bold tabular-nums">
                                  {toBengaliNumber(item.toBuyUnits)} {item.unit}
                                </strong>
                                {item.packSummaryBn && (
                                  <span className="block text-sm font-semibold opacity-90 mt-0.5">
                                    ({item.packSummaryBn})
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="block text-sm font-medium text-rose-100">
                                  মেয়াদ সতর্কতা
                                </span>
                                <strong className="text-lg font-bold">নতুন প্যাকেট কিনুন</strong>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Stock & Daily Usage Breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-2 border border-border text-base">
                          <div>
                            <span className="block text-sm text-text-muted">
                              দৈনিক পরিমাণ
                            </span>
                            <strong className="text-text tabular-nums">
                              {formatQuantityBn(item.dailyUsage)} {item.unit} / দিন
                            </strong>
                          </div>

                          <div>
                            <span className="block text-sm text-text-muted">
                              বর্তমান মজুদ কত দিন চলবে
                            </span>
                            <strong className="text-text tabular-nums">
                              {formatQuantityBn(item.currentStock)} {item.unit} ({toBengaliNumber(item.daysRemaining)} দিন)
                            </strong>
                          </div>

                          <div>
                            <span className="block text-sm text-text-muted">
                              শেষ হবে প্রায়
                            </span>
                            <strong className="text-primary">
                              {item.estimatedRunOutDateStr}
                            </strong>
                          </div>
                        </div>

                        {/* Price & Cost Row */}
                        <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            {item.unitPrice !== null ? (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
                                <span className="text-text-muted tabular-nums">
                                  একক দাম:{' '}
                                  <strong className="text-text">
                                    {formatTakaBn(item.unitPrice)}
                                  </strong>{' '}
                                  / {item.unit}
                                </span>
                                {item.estimatedCost !== null && (
                                  <span className="px-3 py-1 rounded-lg bg-primary-soft border border-primary/25 font-bold text-primary tabular-nums">
                                    এতে খরচ {formatTakaBn(item.estimatedCost)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-base font-semibold text-warning-text">
                                দাম নেই
                              </span>
                            )}

                            {!isEditingPrice && (
                              <button
                                type="button"
                                onClick={() => openPriceEditor(med, item.unitPrice)}
                                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>
                                  {item.unitPrice !== null ? 'দাম বদলান' : 'দাম যোগ করুন'}
                                </span>
                              </button>
                            )}
                          </div>

                          {isEditingPrice && (
                            <div className="pt-2 border-t border-border space-y-2">
                              <label
                                htmlFor={`price-input-${med.id}`}
                                className="block text-sm font-bold text-text"
                              >
                                প্রতি {item.unit} এর দাম (৳)
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  id={`price-input-${med.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={priceInput}
                                  onChange={(e) => {
                                    setPriceInput(e.target.value);
                                    if (priceError) setPriceError('');
                                  }}
                                  placeholder="যেমন: 2.50"
                                  className="min-h-[44px] w-40 px-3.5 py-2 text-base font-semibold bg-surface border-2 border-primary rounded-xl text-text focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSavePrice(med.id)}
                                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl transition-colors cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>সংরক্ষণ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelPriceEditor}
                                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                  <span>বাতিল</span>
                                </button>
                              </div>
                              {priceError && (
                                <p className="text-sm font-bold text-danger-text">
                                  {priceError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Red Expiry Warning */}
                        {item.expiresBeforeTarget && item.expiryWarningBn && (
                          <div
                            role="alert"
                            className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text flex items-start gap-2.5 text-base font-bold"
                          >
                            <AlertTriangle className="w-5 h-5 text-danger-text shrink-0 mt-0.5" />
                            <div>
                              <span>{item.expiryWarningBn}</span>
                              {item.expiryDateFormattedBn && (
                                <span className="block text-sm font-semibold mt-0.5">
                                  বর্তমান প্যাকেটের মেয়াদ: {item.expiryDateFormattedBn}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Card Footer Actions: Exclude toggle + Stock Refill */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-sm text-text-muted tabular-nums">
                            মোট প্রয়োজন (
                            {item.activeDaysInPeriod !== result.effectiveDays
                              ? `কোর্সের ${toBengaliNumber(item.activeDaysInPeriod)} দিনে`
                              : `${toBengaliNumber(result.effectiveDays)} দিনে`}
                            ): {formatQuantityBn(item.requiredUnits)} {item.unit}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExcludeMedicine(med.id)}
                              aria-pressed={isExcluded}
                              className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-xl border transition-colors cursor-pointer ${
                                isExcluded
                                  ? 'text-primary bg-primary-soft border-primary/25 hover:bg-primary-soft/80'
                                  : 'text-text bg-surface-2 border-border hover:bg-border/60'
                              }`}
                            >
                              {isExcluded ? (
                                <>
                                  <RotateCcw className="w-4 h-4" />
                                  <span>তালিকায় ফিরিয়ে আনুন</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-4 h-4" />
                                  <span>এটা কিনব না</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => openStockAdjustmentModal(med.id)}
                              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:bg-primary-soft/80 transition-colors cursor-pointer"
                            >
                              <Package className="w-4 h-4" />
                              <span>মজুত আপডেট করুন</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 2: পর্যাপ্ত আছে ✓ */}
            {result.sufficientItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-success-text flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>
                    পর্যাপ্ত আছে ✓ ({toBengaliNumber(result.sufficientItems.length)}টি)
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {result.sufficientItems.map((item) => {
                    const med = item.medicine;
                    const showPatient =
                      selectedPatientId === 'all' && item.patientName !== 'সাধারণ';

                    return (
                      <article
                        key={med.id}
                        className="bg-surface border border-success/30 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-text">
                              {med.brandName}
                              {med.strength ? ` (${med.strength})` : ''}
                            </h3>
                            <p className="text-sm text-text-muted">
                              {med.genericName}
                              {showPatient ? ` · ${item.patientName}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-success-text bg-success-soft border border-success/30 px-3 py-1 rounded-lg shrink-0">
                            {item.statusLabelBn}
                          </span>
                        </div>

                        <div className="text-base text-text space-y-1 pt-2 border-t border-border">
                          <div className="tabular-nums">
                            দৈনিক পরিমাণ: <strong>{formatQuantityBn(item.dailyUsage)} {item.unit} / দিন</strong>
                          </div>
                          <div className="tabular-nums">
                            বর্তমান মজুদ:{' '}
                            <strong>
                              {formatQuantityBn(item.currentStock)} {item.unit}
                            </strong>{' '}
                            (চলবে {toBengaliNumber(item.daysRemaining)} দিন)
                          </div>
                          <div className="text-sm text-text-muted">
                            শেষ হবে প্রায়: <strong>{item.estimatedRunOutDateStr}</strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section 3: প্রয়োজনমতো / সময়সূচিহীন ওষুধ ("নিজে হিসাব করুন") */}
            {result.asNeededItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text flex items-center gap-2">
                  <FileText className="w-5 h-5 text-text-muted" />
                  <span>
                    প্রয়োজনমতো বা সময়সূচিহীন ওষুধ ({toBengaliNumber(result.asNeededItems.length)}টি)
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {result.asNeededItems.map((item) => {
                    const med = item.medicine;
                    const showPatient =
                      selectedPatientId === 'all' && item.patientName !== 'সাধারণ';

                    return (
                      <article
                        key={med.id}
                        className={`bg-surface border rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs ${
                          item.expiresBeforeTarget
                            ? 'border-danger'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-text">
                              {med.brandName}
                              {med.strength ? ` (${med.strength})` : ''}
                            </h3>
                            <p className="text-sm text-text-muted">
                              {med.genericName}
                              {showPatient ? ` · ${item.patientName}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-warning-text bg-warning-soft border border-warning/30 px-3 py-1 rounded-lg shrink-0">
                            {item.noteBn}
                          </span>
                        </div>

                        <div className="text-base text-text pt-2 border-t border-border space-y-1">
                          <div className="tabular-nums">
                            বর্তমান মজুদ:{' '}
                            <strong>
                              {formatQuantityBn(item.currentStock)} {item.unit}
                            </strong>
                          </div>
                        </div>

                        {item.expiresBeforeTarget && item.expiryWarningBn && (
                          <div
                            role="alert"
                            className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger-text flex items-start gap-2 text-sm font-bold"
                          >
                            <AlertTriangle className="w-4 h-4 text-danger-text shrink-0 mt-0.5" />
                            <span>{item.expiryWarningBn}</span>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ==================================================
          A4 PRINT / PDF SHEET (Only visible in @media print)
         ================================================== */}
      <section className="hidden print:block bg-white text-black p-0 space-y-5">
        {/* Title */}
        <div className="border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold text-black">
            স্বাস্থ্যবন্ধু — ওষুধ কেনার তালিকা
          </h1>
        </div>

        {/* Patient, Age, Doctor, Date Info */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-black p-3.5 text-sm text-black">
          <div>
            <strong>রোগীর নাম:</strong> {result.patientLabelBn}
          </div>
          {result.patientAge !== undefined && (
            <div>
              <strong>বয়স:</strong> {toBengaliNumber(result.patientAge)} বছর
            </div>
          )}
          {doctorName.trim() && (
            <div>
              <strong>ডাক্তারের নাম:</strong> {doctorName.trim()}
            </div>
          )}
          <div>
            <strong>তালিকা তৈরির তারিখ:</strong> {result.referenceDateBn}
          </div>
          <div className="col-span-2">
            <strong>{result.periodSummaryBn || `সময়কাল: ${result.startDateShortBn} থেকে ${result.targetDateShortBn} (${toBengaliNumber(result.daysCount)} দিন)`}</strong>
            {result.bufferDays > 0
              ? ` + অতিরিক্ত ${toBengaliNumber(result.bufferDays)} দিনের বাফার`
              : ''}
          </div>
        </div>

        {/* Print Table */}
        <table className="print-table text-sm text-black border border-black">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black text-left">
              <th className="p-2 border-r border-black w-12 text-center font-bold">ক্রম</th>
              <th className="p-2 border-r border-black font-bold">ওষুধের নাম</th>
              <th className="p-2 border-r border-black font-bold">দৈনিক ব্যবহার</th>
              <th className="p-2 border-r border-black font-bold">বর্তমান মজুদ</th>
              <th className="p-2 border-r border-black font-bold">কিনতে হবে</th>
              <th className="p-2 border-r border-black font-bold text-right">একক দাম</th>
              <th className="p-2 font-bold text-right">মোট দাম</th>
            </tr>
          </thead>
          <tbody>
            {printTableRows.map((row, index) => (
              <tr key={index} className="border-b border-black align-top">
                <td className="p-2 border-r border-black text-center font-normal print-serial-cell">
                  {toBengaliNumber(index + 1)}
                </td>
                <td className="p-2 border-r border-black">
                  <div className="font-bold">{row.name}</div>
                  {row.subName && <div className="text-xs">{row.subName}</div>}
                  {row.warningText && (
                    <div className="text-xs font-bold mt-1">
                      সতর্কতা: {row.warningText}
                    </div>
                  )}
                </td>
                <td className="p-2 border-r border-black tabular-nums">{row.dailyUsageText}</td>
                <td className="p-2 border-r border-black tabular-nums">{row.currentStockText}</td>
                <td className="p-2 border-r border-black font-bold tabular-nums">{row.toBuyText}</td>
                <td className="p-2 border-r border-black text-right tabular-nums">
                  {row.unitPriceText}
                </td>
                <td className="p-2 text-right font-bold tabular-nums">
                  {row.totalCostText}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary, Cost Footer, Optional Notes, and Disclaimer */}
        <div className="space-y-2 pt-3 border-t border-black text-black">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-base font-bold">
              সারসংক্ষেপ: {toBengaliNumber(result.totalActiveMedicinesConsidered)}টি ওষুধের মধ্যে{' '}
              {toBengaliNumber(activeToBuyItems.length)}টি কিনতে হবে (পর্যাপ্ত আছে:{' '}
              {toBengaliNumber(result.sufficientItems.length)}টি
              {result.asNeededItems.length > 0
                ? `, নিজে হিসাব করুন: ${toBengaliNumber(result.asNeededItems.length)}টি`
                : ''}
              {costSummary.excludedCount > 0
                ? `, বাদ দেওয়া: ${toBengaliNumber(costSummary.excludedCount)}টি`
                : ''}
              )
            </div>
            <div className="text-lg font-bold tabular-nums">
              আনুমানিক মোট খরচ {formatTakaBn(costSummary.totalEstimatedCost)}
            </div>
          </div>

          {costSummary.missingPriceCount > 0 && (
            <div className="text-xs font-semibold">
              {toBengaliNumber(costSummary.missingPriceCount)} টির দাম নেই, মোটে ধরা হয়নি
            </div>
          )}

          {notes.trim() && (
            <div className="text-sm border border-black p-2.5">
              <strong>নোট:</strong> {notes.trim()}
            </div>
          )}

          <p className="text-xs pt-1 font-semibold">
            দাম আনুমানিক, দোকানভেদে বদলাতে পারে।
          </p>
          <p className="text-xs">
            এটি অ্যাপের হিসাব; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।
          </p>
        </div>
      </section>
    </div>
  );
};
