import React, { useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { Medicine } from '../../types';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  DurationPresetKey,
  addLocalDays,
  calculateMedicineShoppingList,
  calculateShoppingCostSummary,
  formatQuantityBn,
  formatTakaBn,
  getTargetDateForPreset,
  normalizeDigitsInput,
  normalizeLocalDate,
  toLocalIsoDate,
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
    globalMedicines,
    activePatientId,
    setCurrentPage,
    openStockAdjustmentModal,
    updateMedicine,
  } = useMedicine();

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const [selectedPatientId, setSelectedPatientId] = useState<string | 'all'>(() => {
    if (activePatientId && activePatients.some((p) => p.id === activePatientId)) {
      return activePatientId;
    }
    return 'all';
  });

  const [preset, setPreset] = useState<DurationPresetKey>('15d');
  const [customDateIso, setCustomDateIso] = useState<string>(() =>
    toLocalIsoDate(getTargetDateForPreset('15d'))
  );
  const [includeBuffer, setIncludeBuffer] = useState<boolean>(true);
  const [doctorName, setDoctorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [editingPriceMedId, setEditingPriceMedId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [priceError, setPriceError] = useState<string>('');

  const today = useMemo(() => normalizeLocalDate(new Date()), []);
  const minCustomDateIso = useMemo(
    () => toLocalIsoDate(addLocalDays(today, 1)),
    [today]
  );

  const effectiveTargetDateIso = useMemo(() => {
    if (preset === 'custom') {
      return customDateIso;
    }
    return toLocalIsoDate(getTargetDateForPreset(preset, today));
  }, [preset, customDateIso, today]);

  const result = useMemo(
    () =>
      calculateMedicineShoppingList({
        medicines,
        patients: activePatients,
        globalMedicines,
        selectedPatientId,
        targetDate: effectiveTargetDateIso,
        includeBuffer,
        referenceDate: today,
      }),
    [
      medicines,
      activePatients,
      globalMedicines,
      selectedPatientId,
      effectiveTargetDateIso,
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

  const handleSelectPreset = (nextPreset: Exclude<DurationPresetKey, 'custom'>) => {
    setPreset(nextPreset);
    setCustomDateIso(toLocalIsoDate(getTargetDateForPreset(nextPreset, today)));
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const presetButtons: { key: Exclude<DurationPresetKey, 'custom'>; label: string }[] = [
    { key: '7d', label: '৭ দিন' },
    { key: '15d', label: '১৫ দিন' },
    { key: '30d', label: '৩০ দিন' },
    { key: '3m', label: '৩ মাস' },
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
            className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 text-base font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ওষুধের তালিকায় ফিরে যান</span>
          </button>

          <div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-3.5 py-2 rounded-xl">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>আজ: {result.startDateBn}</span>
          </div>
        </div>

        {/* Page Heading */}
        <header className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                ওষুধ কেনার তালিকা
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300">
                বর্তমান মজুদ ও দৈনিক ডোজ অনুযায়ী কতটি ওষুধ কিনতে হবে তা সহজেই হিসাব করুন
              </p>
            </div>
          </div>
        </header>

        {/* Inputs Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
          {/* 1. Patient Selector */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Users className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>কার জন্য তালিকা বানাবেন?</span>
            </label>

            {activePatients.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base text-slate-700 dark:text-slate-200">
                সবার জন্য (এখনো কোনো আলাদা ফ্যামিলি প্রোফাইল যোগ করা হয়নি)
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPatientId('all')}
                  aria-pressed={selectedPatientId === 'all'}
                  className={`min-h-[48px] px-4 py-2.5 rounded-xl border-2 text-base font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedPatientId === 'all'
                      ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-teal-500'
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
                      onClick={() => setSelectedPatientId(patient.id)}
                      aria-pressed={isSelected}
                      className={`min-h-[48px] px-4 py-2.5 rounded-xl border-2 text-base font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-teal-500'
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

          {/* 2. Target Date / Duration Selector */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Calendar className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>কত দিনের ওষুধ লাগবে?</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {presetButtons.map((btn) => {
                const isSelected = preset === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => handleSelectPreset(btn.key)}
                    aria-pressed={isSelected}
                    className={`min-h-[52px] px-3 py-2.5 rounded-xl border-2 text-base font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:border-teal-500'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPreset('custom')}
                aria-pressed={preset === 'custom'}
                className={`min-h-[52px] col-span-2 sm:col-span-1 px-3 py-2.5 rounded-xl border-2 text-base font-bold transition-colors cursor-pointer ${
                  preset === 'custom'
                    ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:border-teal-500'
                }`}
              >
                নিজে তারিখ বাছুন
              </button>
            </div>

            {preset === 'custom' && (
              <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2">
                <label
                  htmlFor="shopping-custom-date"
                  className="block text-base font-bold text-slate-900 dark:text-white"
                >
                  কত তারিখ পর্যন্ত ওষুধ লাগবে?
                </label>
                <input
                  id="shopping-custom-date"
                  type="date"
                  min={minCustomDateIso}
                  value={customDateIso}
                  onChange={(e) => {
                    if (e.target.value) setCustomDateIso(e.target.value);
                  }}
                  className="min-h-[48px] w-full sm:w-72 px-4 py-2 text-lg font-semibold bg-white dark:bg-slate-900 border-2 border-teal-600 rounded-xl text-slate-900 dark:text-white"
                />
                {!result.isValidDateRange && (
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    দয়া করে আজকের পরের একটি তারিখ বেছে নিন (ন্যূনতম ১ দিন)।
                  </p>
                )}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="text-slate-700 dark:text-slate-200">
                হিসাবের শেষ তারিখ:{' '}
                <strong className="text-slate-900 dark:text-white">{result.targetDateBn}</strong>
              </span>
              <span className="font-bold text-teal-800 dark:text-teal-300 tabular-nums">
                {toBengaliNumber(result.daysCount)} দিন
                {result.bufferDays > 0
                  ? ` + ${toBengaliNumber(result.bufferDays)} দিন বাফার = মোট ${toBengaliNumber(result.effectiveDays)} দিন`
                  : ''}
              </span>
            </div>
          </div>

          {/* 3. Buffer Toggle */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              role="switch"
              aria-checked={includeBuffer}
              onClick={() => setIncludeBuffer((prev) => !prev)}
              className={`w-full min-h-[56px] p-4 rounded-xl border-2 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                includeBuffer
                  ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  অতিরিক্ত ২ দিনের বাফার
                </span>
                <span className="block text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  হঠাৎ ওষুধ ফুরিয়ে না যাওয়ার জন্য প্রয়োজনের সাথে ২ দিনের বাড়তি হিসাব যোগ রাখুন
                </span>
              </div>
              <div
                className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 flex items-center ${
                  includeBuffer ? 'bg-teal-700 justify-end' : 'bg-slate-400 dark:bg-slate-600 justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white shadow-xs" />
              </div>
            </button>
          </div>

          {/* 4. Optional Doctor Name & Notes */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="shopping-doctor-name"
                className="block text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                ডাক্তারের নাম (ঐচ্ছিক)
              </label>
              <input
                id="shopping-doctor-name"
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="যেমন: ডা. করিম"
                className="min-h-[48px] w-full px-4 py-2.5 text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="shopping-notes"
                className="block text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                নোট (ঐচ্ছিক)
              </label>
              <input
                id="shopping-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: সকালের মধ্যে কিনে আনতে হবে"
                className="min-h-[48px] w-full px-4 py-2.5 text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </section>

        {/* No Active Medicines State */}
        {result.totalActiveMedicinesConsidered === 0 ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
              <Pill className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              এখনো কোনো চলমান ওষুধ নেই
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              কেনার তালিকা তৈরি করতে প্রথমে চলমান ওষুধ ও তার খাওয়ার সময় যোগ করুন।
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="min-h-[52px] inline-flex items-center gap-2 px-6 py-3 text-base font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-2xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>ওষুধ যোগ করুন</span>
            </button>
          </section>
        ) : (
          <>
            {/* Top Summary & Action Buttons */}
            <section className="bg-white dark:bg-slate-900 border-2 border-teal-600/30 dark:border-teal-700/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {toBengaliNumber(result.totalActiveMedicinesConsidered)}টি ওষুধের মধ্যে{' '}
                    <span className="text-teal-700 dark:text-teal-300">
                      {toBengaliNumber(activeToBuyItems.length)}টি কিনতে হবে
                    </span>
                  </h2>
                  <p className="text-base text-slate-600 dark:text-slate-300 mt-0.5">
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
                  <span className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                    কিনতে হবে: {toBengaliNumber(activeToBuyItems.length)}টি
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                    পর্যাপ্ত আছে: {toBengaliNumber(result.sufficientItems.length)}টি
                  </span>
                  {result.asNeededItems.length > 0 && (
                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                      নিজে হিসাব: {toBengaliNumber(result.asNeededItems.length)}টি
                    </span>
                  )}
                </div>
              </div>

              {/* Estimated Total Cost Box */}
              {result.toBuyItems.length > 0 && (
                <div className="p-4 sm:p-5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="block text-sm font-semibold text-teal-800 dark:text-teal-300">
                      দাম আনুমানিক, দোকানভেদে বদলাতে পারে
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      আনুমানিক মোট খরচ {formatTakaBn(costSummary.totalEstimatedCost)}
                    </div>
                  </div>
                  {costSummary.missingPriceCount > 0 && (
                    <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-sm font-bold text-amber-900 dark:text-amber-200 shrink-0">
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
                  className="min-h-[56px] flex items-center justify-center gap-2.5 px-5 py-3.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-lg font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  <span>PDF / প্রিন্ট</span>
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[56px] flex items-center justify-center gap-2.5 px-5 py-3.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-lg font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                  <span>হোয়াটসঅ্যাপে পাঠান</span>
                </a>
              </div>
            </section>

            {/* Section 1: কিনতে হবে (Sorted by soonest run-out first) */}
            <section className="space-y-3.5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-teal-700 dark:text-teal-400" />
                <span>কিনতে হবে ({toBengaliNumber(activeToBuyItems.length)}টি)</span>
              </h2>

              {result.toBuyItems.length === 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-700 dark:text-emerald-400 mx-auto" />
                  <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-100">
                    সব নিয়মিত ওষুধ পর্যাপ্ত আছে ✓
                  </h3>
                  <p className="text-base text-emerald-800 dark:text-emerald-300">
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
                        className={`bg-white dark:bg-slate-900 rounded-2xl border-2 p-5 shadow-xs space-y-4 transition-opacity ${
                          isExcluded
                            ? 'opacity-65 border-dashed border-slate-300 dark:border-slate-700'
                            : item.expiresBeforeTarget
                            ? 'border-rose-400 dark:border-rose-700'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-xl font-bold text-slate-900 dark:text-white ${
                                  isExcluded ? 'line-through' : ''
                                }`}
                              >
                                {med.brandName}
                              </h3>
                              {med.strength && (
                                <span className="text-base font-semibold text-slate-700 dark:text-slate-300">
                                  ({med.strength})
                                </span>
                              )}
                              {isExcluded && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold">
                                  কেনা বাদ
                                </span>
                              )}
                            </div>
                            <p className="text-base text-slate-600 dark:text-slate-300">
                              {med.genericName} · {med.type}
                              {showPatient ? ` · রোগী: ${item.patientName}` : ''}
                            </p>
                          </div>

                          {/* Highlighted Buy Amount */}
                          <div
                            className={`rounded-xl px-4 py-3 text-left sm:text-right shrink-0 ${
                              isExcluded
                                ? 'bg-slate-600 text-white'
                                : item.toBuyUnits > 0
                                ? 'bg-teal-700 text-white'
                                : 'bg-rose-700 text-white'
                            }`}
                          >
                            {item.toBuyUnits > 0 ? (
                              <>
                                <span className="block text-sm font-medium text-teal-100">
                                  কিনতে হবে
                                </span>
                                <strong className="text-2xl font-bold tabular-nums">
                                  {toBengaliNumber(item.toBuyUnits)} {item.unit}
                                </strong>
                                {item.packSummaryBn && (
                                  <span className="block text-sm font-semibold text-teal-100 mt-0.5">
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base">
                          <div>
                            <span className="block text-sm text-slate-500 dark:text-slate-400">
                              দৈনিক পরিমাণ
                            </span>
                            <strong className="text-slate-900 dark:text-white tabular-nums">
                              {formatQuantityBn(item.dailyUsage)} {item.unit} / দিন
                            </strong>
                          </div>

                          <div>
                            <span className="block text-sm text-slate-500 dark:text-slate-400">
                              বর্তমান মজুদ কত দিন চলবে
                            </span>
                            <strong className="text-slate-900 dark:text-white tabular-nums">
                              {formatQuantityBn(item.currentStock)} {item.unit} ({toBengaliNumber(item.daysRemaining)} দিন)
                            </strong>
                          </div>

                          <div>
                            <span className="block text-sm text-slate-500 dark:text-slate-400">
                              শেষ হবে প্রায়
                            </span>
                            <strong className="text-teal-800 dark:text-teal-300">
                              {item.estimatedRunOutDateStr}
                            </strong>
                          </div>
                        </div>

                        {/* Price & Cost Row */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            {item.unitPrice !== null ? (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
                                <span className="text-slate-700 dark:text-slate-200 tabular-nums">
                                  একক দাম:{' '}
                                  <strong className="text-slate-900 dark:text-white">
                                    {formatTakaBn(item.unitPrice)}
                                  </strong>{' '}
                                  / {item.unit}
                                </span>
                                {item.estimatedCost !== null && (
                                  <span className="px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 font-bold text-teal-800 dark:text-teal-200 tabular-nums">
                                    এতে খরচ {formatTakaBn(item.estimatedCost)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-base font-semibold text-amber-800 dark:text-amber-300">
                                দাম নেই
                              </span>
                            )}

                            {!isEditingPrice && (
                              <button
                                type="button"
                                onClick={() => openPriceEditor(med, item.unitPrice)}
                                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>
                                  {item.unitPrice !== null ? 'দাম বদলান' : 'দাম যোগ করুন'}
                                </span>
                              </button>
                            )}
                          </div>

                          {isEditingPrice && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                              <label
                                htmlFor={`price-input-${med.id}`}
                                className="block text-sm font-bold text-slate-800 dark:text-slate-200"
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
                                  className="min-h-[44px] w-40 px-3.5 py-2 text-base font-semibold bg-white dark:bg-slate-900 border-2 border-teal-600 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSavePrice(med.id)}
                                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>সংরক্ষণ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelPriceEditor}
                                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                  <span>বাতিল</span>
                                </button>
                              </div>
                              {priceError && (
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
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
                            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-base font-bold"
                          >
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
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
                          <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                            মোট প্রয়োজন ({toBengaliNumber(result.effectiveDays)} দিনে):{' '}
                            {formatQuantityBn(item.requiredUnits)} {item.unit}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExcludeMedicine(med.id)}
                              aria-pressed={isExcluded}
                              className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-xl border transition-colors cursor-pointer ${
                                isExcluded
                                  ? 'text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 hover:bg-teal-100'
                                  : 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 transition-colors cursor-pointer"
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
                <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
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
                        className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                              {med.brandName}
                              {med.strength ? ` (${med.strength})` : ''}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {med.genericName}
                              {showPatient ? ` · ${item.patientName}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg shrink-0">
                            {item.statusLabelBn}
                          </span>
                        </div>

                        <div className="text-base text-slate-700 dark:text-slate-200 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                          <div className="text-sm text-slate-600 dark:text-slate-400">
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
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
                        className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs ${
                          item.expiresBeforeTarget
                            ? 'border-rose-400 dark:border-rose-700'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                              {med.brandName}
                              {med.strength ? ` (${med.strength})` : ''}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {med.genericName}
                              {showPatient ? ` · ${item.patientName}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-lg shrink-0">
                            {item.noteBn}
                          </span>
                        </div>

                        <div className="text-base text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
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
                            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2 text-sm font-bold"
                          >
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
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
            <strong>তালিকা তৈরির তারিখ:</strong> {result.startDateBn}
          </div>
          <div className="col-span-2">
            <strong>কত তারিখ পর্যন্ত:</strong> {result.targetDateBn} (
            {toBengaliNumber(result.daysCount)} দিনের জন্য
            {result.bufferDays > 0
              ? ` + অতিরিক্ত ${toBengaliNumber(result.bufferDays)} দিনের বাফার`
              : ''}
            )
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
