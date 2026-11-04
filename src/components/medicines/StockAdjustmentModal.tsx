import React, { useState, useEffect, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { calculateDailyConsumption, predictMedicineStock } from '../../utils/stockPredictor';
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
} from 'lucide-react';

export const StockAdjustmentModal: React.FC = () => {
  const {
    stockAdjustmentModalMedId,
    closeStockAdjustmentModal,
    medicines,
    adjustMedicineStock,
  } = useMedicine();

  const medicine = useMemo(() => {
    if (!stockAdjustmentModalMedId) return null;
    return medicines.find((m) => m.id === stockAdjustmentModalMedId) || null;
  }, [stockAdjustmentModalMedId, medicines]);

  const [newStock, setNewStock] = useState<number>(0);
  const [reason, setReason] = useState<string>('নতুন ওষুধ ক্রয় / রিফিল');
  const [notes, setNotes] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    if (medicine) {
      setNewStock(medicine.stock);
      setReason('নতুন ওষুধ ক্রয় / রিফিল');
      setNotes('');
      setShowHistory(false);
    }
  }, [medicine]);

  if (!stockAdjustmentModalMedId || !medicine) return null;

  const currentDailyRate = calculateDailyConsumption(medicine);
  
  // Simulated prediction with newStock
  const simulatedMed = { ...medicine, stock: Math.max(0, newStock) };
  const simulatedPrediction = predictMedicineStock(simulatedMed);

  const stockDiff = newStock - medicine.stock;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStock < 0) return;
    adjustMedicineStock(medicine.id, newStock, reason, notes.trim() || undefined);
    closeStockAdjustmentModal();
  };

  const handleQuickAdd = (amount: number) => {
    setNewStock((prev) => Math.max(0, prev + amount));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeStockAdjustmentModal}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                মজুত (Stock) সংশোধন ও আপডেট
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {medicine.brandName} · {medicine.strength} ({medicine.type})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeStockAdjustmentModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Current vs New comparison card */}
          <div className="p-4 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-teal-800 dark:text-teal-300 font-medium block">
                বর্তমান সিস্টেমে মজুত
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {toBengaliNumber(medicine.stock)}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {medicine.unit}
                </span>
              </span>
            </div>

            <ArrowRight className="w-5 h-5 text-teal-600" />

            <div className="text-right">
              <span className="text-[11px] text-teal-800 dark:text-teal-300 font-medium block">
                নতুন সংশোধিত মজুত
              </span>
              <span className="text-xl font-bold text-teal-700 dark:text-teal-400">
                {toBengaliNumber(newStock)}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {medicine.unit}
                </span>
              </span>
              {stockDiff !== 0 && (
                <span
                  className={`text-[10px] font-semibold block ${
                    stockDiff > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  ({stockDiff > 0 ? `+${toBengaliNumber(stockDiff)}` : toBengaliNumber(stockDiff)})
                </span>
              )}
            </div>
          </div>

          {/* Quick stock adjustment buttons */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              নতুন স্টক সংখ্যা নির্ধারণ করুন:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickAdd(-5)}
                disabled={newStock <= 0}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
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
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleQuickAdd(1)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 cursor-pointer"
                title="১ টি বাড়ান"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(10)}
                className="px-3 py-2 bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold rounded-xl cursor-pointer"
              >
                +১০
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(20)}
                className="px-3 py-2 bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold rounded-xl cursor-pointer"
              >
                +২০
              </button>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              সংশোধন / আপডেটের কারণ:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
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
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              অতিরিক্ত নোট (ঐচ্ছিক):
            </label>
            <input
              type="text"
              placeholder="যেমন: ফার্মেসি থেকে নতুন পাতা আনা হয়েছে..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          {/* Smart Predictor Dynamic Impact Preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Stock Predictor পূর্বাভাস</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">দৈনিক মোট সেবন:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentDailyRate > 0
                    ? `${toBengaliNumber(currentDailyRate)} ${medicine.unit} / দিন`
                    : 'প্রযোজ্য নয়'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">নতুন স্টকে চলবে আনুমানিক:</span>
                <span className="font-bold text-teal-800 dark:text-teal-300">
                  {simulatedPrediction.daysRemaining !== null
                    ? `${toBengaliNumber(simulatedPrediction.daysRemaining)} দিন`
                    : 'অনির্ধারিত'}
                </span>
              </div>
            </div>
            {simulatedPrediction.runoutDate && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <Calendar className="w-3 h-3 text-teal-600" />
                <span>
                  সম্ভাব্য মজুত সমাপ্তির তারিখ: <strong>{formatBengaliDate(simulatedPrediction.runoutDate)}</strong>
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
                className="flex items-center justify-between w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-teal-600" />
                  পূর্ববর্তী স্টক পরিবর্তনের ইতিহাস ({toBengaliNumber(medicine.stockAdjustments.length)}টি)
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400">
                  {showHistory ? 'লুকান' : 'দেখুন'}
                </span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {medicine.stockAdjustments.slice().reverse().map((adj) => (
                    <div
                      key={adj.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200">{adj.reason}</span>
                        <span className="text-teal-700 dark:text-teal-400">
                          {toBengaliNumber(adj.previousStock)} → {toBengaliNumber(adj.newStock)} {medicine.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 mt-1 text-[10px]">
                        <span>{formatBengaliDate(adj.timestamp)}</span>
                        {adj.notes && <span className="italic text-slate-500">"{adj.notes}"</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeStockAdjustmentModal}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
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
