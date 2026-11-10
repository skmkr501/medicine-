import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { StockPrediction, StockPredictionStatus } from '../../types';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  Package,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Bell,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const ExpiringStockSection: React.FC = () => {
  const {
    stockPredictions,
    activePatient,
    patients,
    openStockAdjustmentModal,
    setSelectedMedicineIdForDetail,
    setCurrentPage,
  } = useMedicine();

  const [statusFilter, setStatusFilter] = useState<'all' | 'urgent' | 'low_stock' | 'out_of_stock'>('all');

  // Filter predictions based on active patient profile
  const patientPredictions = useMemo(() => {
    if (!activePatient) return stockPredictions;
    return stockPredictions.filter(
      (p) => p.medicine.assignedPatientId === activePatient.id
    );
  }, [stockPredictions, activePatient]);

  // Counts for each category
  const urgentCount = patientPredictions.filter((p) => p.status === 'urgent').length;
  const lowStockCount = patientPredictions.filter((p) => p.status === 'low_stock').length;
  const outOfStockCount = patientPredictions.filter((p) => p.status === 'out_of_stock').length;
  const attentionCount = urgentCount + lowStockCount + outOfStockCount;

  // Filtered by selected tab
  const displayedPredictions = useMemo(() => {
    if (statusFilter === 'all') {
      // Prioritize medicines needing attention first, then safe/incalculable
      return patientPredictions;
    }
    return patientPredictions.filter((p) => p.status === statusFilter);
  }, [patientPredictions, statusFilter]);

  if (patientPredictions.length === 0) {
    return null;
  }

  const renderStatusBadge = (status: StockPredictionStatus, daysRemaining: number | null) => {
    switch (status) {
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <XCircle className="w-3.5 h-3.5" />
            স্টক শেষ (০ টি)
          </span>
        );
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            জরুরি · আর {toBengaliNumber(daysRemaining ?? 0)} দিন
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            স্বল্প স্টক · আর {toBengaliNumber(daysRemaining ?? 0)} দিন
          </span>
        );
      case 'safe':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            পর্যাপ্ত · {toBengaliNumber(daysRemaining ?? 0)} দিন
          </span>
        );
      case 'incalculable':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <Info className="w-3.5 h-3.5" />
            অনির্ধারিত ডোজ
          </span>
        );
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              শিগগির শেষ হবে (Smart Stock Predictor)
            </h2>
            {attentionCount > 0 && (
              <span className="bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {toBengaliNumber(attentionCount)}টি নজরে রাখা দরকার
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            আপনার দৈনিক সেবনের মাত্রা বিশ্লেষণ করে সিস্টেম স্বয়ংক্রিয়ভাবে হিসাব করে কত দিন ওষুধ চলবে।
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            সকল ({toBengaliNumber(patientPredictions.length)})
          </button>
          {urgentCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('urgent')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'urgent'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              জরুরি ({toBengaliNumber(urgentCount)})
            </button>
          )}
          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              স্বল্প স্টক ({toBengaliNumber(lowStockCount)})
            </button>
          )}
          {outOfStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'out_of_stock'
                  ? 'bg-rose-700 text-white shadow-xs font-bold'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              স্টক শেষ ({toBengaliNumber(outOfStockCount)})
            </button>
          )}
        </div>
      </div>

      {/* Predictions Grid */}
      {displayedPredictions.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
          <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            এই ফিল্টারে কোনো ওষুধ নেই
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            আপনার সকল ওষুধের পর্যাপ্ত মজুত রয়েছে অথবা অন্য ফিল্টারে রয়েছে।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPredictions.map((pred) => {
            const med = pred.medicine;
            const assignedPatient = med.assignedPatientId
              ? patients.find((p) => p.id === med.assignedPatientId)
              : null;

            return (
              <div
                key={med.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 bg-white dark:bg-slate-900 ${
                  pred.status === 'out_of_stock'
                    ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/20'
                    : pred.status === 'urgent'
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/15 dark:bg-rose-950/10'
                    : pred.status === 'low_stock'
                    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/15 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top: Brand, strength, and status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {med.brandName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {med.genericName} · {med.strength}
                      </p>
                    </div>
                    {renderStatusBadge(pred.status, pred.daysRemaining)}
                  </div>

                  {/* Patient profile tag if assigned */}
                  {assignedPatient && (
                    <div className="mt-1.5">
                      <span className="inline-block text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                        {assignedPatient.name} ({assignedPatient.relation})
                      </span>
                    </div>
                  )}

                  {/* Stock and Consumption Metrics */}
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">বর্তমান মজুত:</span>
                      <strong className="text-slate-900 dark:text-white tabular-nums">
                        {toBengaliNumber(med.stock)} {med.unit}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">দৈনিক প্রয়োজন:</span>
                      <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                        {pred.dailyConsumptionRate > 0
                          ? `${toBengaliNumber(pred.dailyConsumptionRate)} ${med.unit} / দিন`
                          : 'অনির্ধারিত'}
                      </strong>
                    </div>

                    {pred.runoutDate && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-teal-600" />
                          সম্ভাব্য শেষ তারিখ:
                        </span>
                        <strong className="text-teal-700 dark:text-teal-400">
                          {formatBengaliDate(pred.runoutDate)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Neutral Logistics Advice Note */}
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {pred.status === 'out_of_stock' ? (
                      <span className="text-rose-700 dark:text-rose-400 font-semibold">
                        ⚠️ কোনো মজুত অবশিষ্ট নেই। অবিলম্বে ফার্মেসি থেকে রিফিল নিশ্চিত করুন।
                      </span>
                    ) : pred.status === 'urgent' ? (
                      <span className="text-rose-700 dark:text-rose-400 font-medium">
                        পরবর্তী ৩ দিনের মধ্যে শেষ হবে। ডোজ ব্যাহত হওয়া রোধে দ্রুত রিফিল সংগ্রহ করুন।
                      </span>
                    ) : pred.status === 'low_stock' ? (
                      <span className="text-amber-800 dark:text-amber-400 font-medium">
                        পরবর্তী ৭ দিনের স্টক অবশিষ্ট আছে। সুবিধাজনক সময়ে রিফিল ক্রয় করে রাখুন।
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        পর্যাপ্ত পরিমাণ স্টক রয়েছে। নিয়মিত ডোজ অনুসরণ করুন।
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMedicineIdForDetail(med.id)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                  >
                    বিস্তারিত দেখুন
                  </button>

                  <button
                    type="button"
                    onClick={() => openStockAdjustmentModal(med.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 dark:hover:bg-teal-900/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>স্টক আপডেট / রিফিল</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deduped 24-Hour Non-Intrusive Notification Footer */}
      <div className="p-3.5 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200">
          <Bell className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            <strong>স্মার্ট নোটিফিকেশন সুরক্ষা:</strong> ওষুধ শেষ হওয়ার সতর্কবার্তা দিনে সর্বোচ্চ একবার পাঠানো হয়, যা বিরক্তিহীন ও সুশৃঙ্খল রিমাইন্ডার নিশ্চিত করে।
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage('medicines')}
          className="text-teal-700 dark:text-teal-400 hover:underline font-semibold text-[11px] whitespace-nowrap cursor-pointer shrink-0"
        >
          সকল ওষুধ ব্যবস্থাপনা →
        </button>
      </div>
    </section>
  );
};
