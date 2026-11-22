import React, { useState, useEffect, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { calculateDailyConsumption, predictMedicineStock } from '../../utils/stockPredictor';
import {
  computePrefilledMedicineCost,
  parseExpenseAmountInput,
} from '../../utils/expenseUtils';
import {
  X,
  Package,
  ArrowRight,
  History,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  Minus,
  Wallet,
} from 'lucide-react';

export const StockAdjustmentModal: React.FC = () => {
  const {
    stockAdjustmentModalMedId,
    closeStockAdjustmentModal,
    medicines,
    adjustMedicineStock,
    addExpense,
  } = useMedicine();

  const medicine = useMemo(() => {
    if (!stockAdjustmentModalMedId) return null;
    return medicines.find((m) => m.id === stockAdjustmentModalMedId) || null;
  }, [stockAdjustmentModalMedId, medicines]);

  const [newStock, setNewStock] = useState<number>(0);
  const [reason, setReason] = useState<string>('নতুন ওষুধ ক্রয় / রিফিল');
  const [notes, setNotes] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [addAsExpense, setAddAsExpense] = useState<boolean>(false);
  const [expenseAmountInput, setExpenseAmountInput] = useState<string>('');
  const [expenseAmountEdited, setExpenseAmountEdited] = useState<boolean>(false);
  const [expenseError, setExpenseError] = useState<string>('');

  useEffect(() => {
    if (medicine) {
      setNewStock(medicine.stock);
      setReason('নতুন ওষুধ ক্রয় / রিফিল');
      setNotes('');
      setShowHistory(false);
      setAddAsExpense(false);
      setExpenseAmountInput('');
      setExpenseAmountEdited(false);
      setExpenseError('');
    }
  }, [medicine]);

  const stockDiff = medicine ? newStock - medicine.stock : 0;

  useEffect(() => {
    if (!medicine || stockDiff <= 0) {
      setAddAsExpense(false);
      setExpenseError('');
      return;
    }
    if (!expenseAmountEdited) {
      const prefill = computePrefilledMedicineCost(medicine.pricePerUnit, stockDiff);
      setExpenseAmountInput(prefill !== null ? String(prefill) : '');
    }
  }, [medicine, stockDiff, expenseAmountEdited]);

  if (!stockAdjustmentModalMedId || !medicine) return null;

  const currentDailyRate = calculateDailyConsumption(medicine);
  
  // Simulated prediction with newStock
  const simulatedMed = { ...medicine, stock: Math.max(0, newStock) };
  const simulatedPrediction = predictMedicineStock(simulatedMed);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStock < 0) return;

    let validatedExpenseAmount: number | null = null;
    if (stockDiff > 0 && addAsExpense) {
      const parsed = parseExpenseAmountInput(expenseAmountInput, { allowZero: false });
      if (!parsed.valid || parsed.amount === null) {
        setExpenseError(parsed.error || 'সঠিক খরচের পরিমাণ লিখুন');
        return;
      }
      validatedExpenseAmount = parsed.amount;
    }

    adjustMedicineStock(medicine.id, newStock, reason, notes.trim() || undefined);

    if (stockDiff > 0 && addAsExpense && validatedExpenseAmount !== null) {
      const d = new Date();
      const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      addExpense({
        expenseDate: todayIso,
        amount: validatedExpenseAmount,
        category: 'ওষুধ',
        patientId: medicine.assignedPatientId,
        title: `${medicine.brandName} ক্রয় (${toBengaliNumber(stockDiff)} ${medicine.unit})`,
        medicineId: medicine.id,
        notes: notes.trim() || reason,
      });
    }

    closeStockAdjustmentModal();
  };

  const handleQuickAdd = (amount: number) => {
    setNewStock((prev) => Math.max(0, prev + amount));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeStockAdjustmentModal}
    >
      <div
        className="bg-surface rounded-3xl max-w-lg w-full border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">
                মজুত (Stock) সংশোধন ও আপডেট
              </h3>
              <p className="text-xs text-text-muted">
                {medicine.brandName} · {medicine.strength} ({medicine.type})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeStockAdjustmentModal}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Current vs New comparison card */}
          <div className="p-4 bg-primary-soft border border-primary/25 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-primary font-medium block">
                বর্তমান সিস্টেমে মজুত
              </span>
              <span className="text-xl font-bold text-text">
                {toBengaliNumber(medicine.stock)}{' '}
                <span className="text-xs font-normal text-text-muted">
                  {medicine.unit}
                </span>
              </span>
            </div>

            <ArrowRight className="w-5 h-5 text-primary" />

            <div className="text-right">
              <span className="text-[11px] text-primary font-medium block">
                নতুন সংশোধিত মজুত
              </span>
              <span className="text-xl font-bold text-primary">
                {toBengaliNumber(newStock)}{' '}
                <span className="text-xs font-normal text-text-muted">
                  {medicine.unit}
                </span>
              </span>
              {stockDiff !== 0 && (
                <span
                  className={`text-[10px] font-semibold block ${
                    stockDiff > 0 ? 'text-success-text' : 'text-danger-text'
                  }`}
                >
                  ({stockDiff > 0 ? `+${toBengaliNumber(stockDiff)}` : toBengaliNumber(stockDiff)})
                </span>
              )}
            </div>
          </div>

          {/* Quick stock adjustment buttons */}
          <div>
            <label className="block text-text font-semibold mb-1.5">
              নতুন স্টক সংখ্যা নির্ধারণ করুন:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickAdd(-5)}
                disabled={newStock <= 0}
                className="p-2 bg-surface-2 hover:bg-border/60 rounded-xl text-text disabled:opacity-40 cursor-pointer"
                title="৫ টি কমান"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="0"
                step="1"
                value={newStock}
                onChange={(e) => setNewStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm font-bold text-text text-center focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleQuickAdd(1)}
                className="p-2 bg-surface-2 hover:bg-border/60 rounded-xl text-text cursor-pointer"
                title="১ টি বাড়ান"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(10)}
                className="px-3 py-2 bg-primary-soft hover:opacity-90 border border-primary/25 text-primary font-bold rounded-xl cursor-pointer"
              >
                +১০
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(20)}
                className="px-3 py-2 bg-primary-soft hover:opacity-90 border border-primary/25 text-primary font-bold rounded-xl cursor-pointer"
              >
                +২০
              </button>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-text font-semibold mb-1.5">
              সংশোধন / আপডেটের কারণ:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              <option value="নতুন ওষুধ ক্রয় / রিফিল">নতুন ওষুধ ক্রয় / রিফিল (New Purchase / Refill)</option>
              <option value="প্যাকেট নষ্ট বা অপচয়">প্যাকেট নষ্ট বা অপচয় (Damaged / Spillage)</option>
              <option value="গণনায় ভুল সংশোধন">গণনায় ভুল সংশোধন (Inventory Recount Correction)</option>
              <option value="চিকিৎসক কর্তৃক ডোজ পরিবর্তন">চিকিৎসক কর্তৃক ডোজ পরিবর্তন (Dosage Changed)</option>
              <option value="অন্যান্য কারণ">অন্যান্য কারণ (Other Reason)</option>
            </select>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-text font-semibold mb-1.5">
              অতিরিক্ত নোট (ঐচ্ছিক):
            </label>
            <input
              type="text"
              placeholder="যেমন: ফার্মেসি থেকে নতুন পাতা আনা হয়েছে..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
          </div>

          {/* Optional Expense Prompt when adding stock (opt-in only) */}
          {stockDiff > 0 && (
            <div className="p-3.5 rounded-2xl bg-primary-soft/60 border border-primary/25 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addAsExpense}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAddAsExpense(checked);
                    setExpenseError('');
                    if (checked && !expenseAmountEdited) {
                      const prefill = computePrefilledMedicineCost(medicine.pricePerUnit, stockDiff);
                      if (prefill !== null) setExpenseAmountInput(String(prefill));
                    }
                  }}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <span className="font-bold text-text flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span>খরচ হিসেবে যোগ করবে?</span>
                </span>
              </label>

              {addAsExpense && (
                <div className="space-y-1.5 pl-6">
                  <label className="block text-[11px] font-semibold text-text">
                    খরচের পরিমাণ (৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={expenseAmountInput}
                    onChange={(e) => {
                      setExpenseAmountEdited(true);
                      setExpenseAmountInput(e.target.value);
                      setExpenseError('');
                    }}
                    placeholder="যেমন: ১২০ বা 120"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-text tabular-nums focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                  {medicine.pricePerUnit ? (
                    <p className="text-[11px] text-text-muted tabular-nums">
                      প্রতি একক মূল্য (৳{toBengaliNumber(medicine.pricePerUnit)}) × {toBengaliNumber(stockDiff)} {medicine.unit} থেকে পূরণকৃত — প্রয়োজনে বদলাতে পারবেন।
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-muted">
                      ওষুধের একক মূল্য দেওয়া নেই — মোট খরচ নিজে লিখুন।
                    </p>
                  )}
                  {expenseError && (
                    <p className="text-[11px] text-danger-text font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{expenseError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Smart Predictor Dynamic Impact Preview */}
          <div className="p-3.5 bg-surface-2 rounded-2xl border border-border space-y-2">
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Stock Predictor পূর্বাভাস</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-text-muted block">দৈনিক মোট সেবন:</span>
                <span className="font-semibold text-text">
                  {currentDailyRate > 0
                    ? `${toBengaliNumber(currentDailyRate)} ${medicine.unit} / দিন`
                    : 'প্রযোজ্য নয়'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">নতুন স্টকে চলবে আনুমানিক:</span>
                <span className="font-bold text-primary">
                  {simulatedPrediction.daysRemaining !== null
                    ? `${toBengaliNumber(simulatedPrediction.daysRemaining)} দিন`
                    : 'অনির্ধারিত'}
                </span>
              </div>
            </div>
            {simulatedPrediction.runoutDate && (
              <p className="text-[10px] text-text-muted flex items-center gap-1 pt-1 border-t border-border">
                <Calendar className="w-3 h-3 text-primary" />
                <span>
                  সম্ভাব্য মজুত সমাপ্তির তারিখ: <strong className="text-text">{formatBengaliDate(simulatedPrediction.runoutDate)}</strong>
                </span>
              </p>
            )}
          </div>

          {/* Audit History Accordion */}
          {medicine.stockAdjustments && medicine.stockAdjustments.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="flex items-center justify-between w-full text-text-muted hover:text-text font-semibold cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-primary" />
                  পূর্ববর্তী স্টক পরিবর্তনের ইতিহাস ({toBengaliNumber(medicine.stockAdjustments.length)}টি)
                </span>
                <span className="text-[11px] text-primary">
                  {showHistory ? 'লুকান' : 'দেখুন'}
                </span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {medicine.stockAdjustments.slice().reverse().map((adj) => (
                    <div
                      key={adj.id}
                      className="p-2.5 rounded-xl bg-surface border border-border text-[11px]"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-text">{adj.reason}</span>
                        <span className="text-primary">
                          {toBengaliNumber(adj.previousStock)} → {toBengaliNumber(adj.newStock)} {medicine.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted mt-1 text-[10px]">
                        <span>{formatBengaliDate(adj.timestamp)}</span>
                        {adj.notes && <span className="italic">"{adj.notes}"</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeStockAdjustmentModal}
              className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>স্টক সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
