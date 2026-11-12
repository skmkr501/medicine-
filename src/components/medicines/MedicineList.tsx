import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { Medicine, MedicineType } from '../../types';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { MedicineDetailModal } from './MedicineDetailModal';
import { predictMedicineStock } from '../../utils/stockPredictor';
import {
  Search,
  Plus,
  Pill,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter,
  CheckCircle,
  BookOpen,
  Sparkles,
  Package,
} from 'lucide-react';


export const MedicineList: React.FC = () => {
  const {
    medicines,
    activePatient,
    patients,
    deleteMedicine,
    adjustStock,
    openStockAdjustmentModal,
    assignMedicineToPatient,
    setCurrentPage,
    setSelectedMedicineIdForDetail,
    selectedMedicineIdForDetail,
    openCreateProfileModal,
  } = useMedicine();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'chronic' | 'lowStock'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filter medicines for current active patient + search & status
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // If an active patient is selected, show strictly medicines belonging to this patient
      if (activePatient && m.assignedPatientId !== activePatient.id) {
        return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchBrand = m.brandName.toLowerCase().includes(query);
        const matchGeneric = m.genericName.toLowerCase().includes(query);
        const matchPurpose = (m.purpose || '').toLowerCase().includes(query);
        const matchDoctor = (m.doctorName || '').toLowerCase().includes(query);
        if (!matchBrand && !matchGeneric && !matchPurpose && !matchDoctor) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'active' && m.status !== 'active') return false;
      if (statusFilter === 'chronic' && !m.isChronic) return false;
      if (statusFilter === 'lowStock' && m.stock > m.minStockAlert) return false;

      // Type filter
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;

      return true;
    });
  }, [medicines, activePatient, searchQuery, statusFilter, typeFilter]);

  const activeDetailMedicine = medicines.find((m) => m.id === selectedMedicineIdForDetail) || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ওষুধের তালিকা {activePatient ? `(${activePatient.name})` : '(সকল ওষুধ)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            মোট {toBengaliNumber(filteredMedicines.length)}টি ওষুধ সংরক্ষিত আছে
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className="min-h-[48px] flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800/80 hover:bg-teal-100 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <span>ওষুধ লাইব্রেরি</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[48px] flex items-center gap-2 px-5 py-2.5 text-base font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>নতুন ওষুধ</span>
          </button>
        </div>

      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ওষুধের নাম বা রোগের নাম দিয়ে খুঁজুন..."
              className="min-h-[48px] w-full pl-11 pr-16 py-2.5 text-base bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="min-h-[48px] px-3 absolute right-1 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              >
                মুছুন
              </button>
            )}
          </div>

          {/* Form Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500 shrink-0 hidden sm:block" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="ওষুধের ধরন"
              className="min-h-[48px] text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden cursor-pointer"
            >
              <option value="all">সকল ধরন</option>
              <option value="ট্যাবলেট">ট্যাবলেট</option>
              <option value="ক্যাপসুল">ক্যাপসুল</option>
              <option value="সিরাপ">সিরাপ</option>
              <option value="ইনসুলিন/ইনজেকশন">ইনসুলিন/ইনজেকশন</option>
              <option value="চোখের ড্রপ">চোখের ড্রপ</option>
              <option value="ইনহেলার">ইনহেলার</option>
              <option value="মলম/জেল">মলম/জেল</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs (Button Segmented Control) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-base">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            সব ওষুধ
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'active'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            চলমান
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('chronic')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'chronic'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            নিয়মিত
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('lowStock')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'lowStock'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            মজুত কম
          </button>
        </div>
      </div>

      {/* Medicine Grid */}
      {medicines.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto mb-4 border border-teal-100 dark:border-teal-900/50">
            <Pill className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            এখনো কোনো ওষুধ যোগ করা হয়নি
          </h3>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto mt-2 mb-6 leading-relaxed">
            আপনার প্রতিদিনের ওষুধ ও খাওয়ার সময় রাখতে নিচের বোতামে চাপ দিন।
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="min-h-[52px] inline-flex items-center gap-2 px-6 py-3 text-base font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-2xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>ওষুধ যোগ করুন</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="min-h-[52px] inline-flex items-center gap-2 px-5 py-3 text-base font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-2xl hover:bg-teal-100 transition-colors cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>ওষুধ লাইব্রেরি দেখুন</span>
            </button>
          </div>
        </div>
      ) : filteredMedicines.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Pill className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            কোনো ওষুধ খুঁজে পাওয়া যায়নি
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            আপনার ফিল্টার পরিবর্তন করুন অথবা নতুন ওষুধ যুক্ত করুন।
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            className="px-3.5 py-1.5 text-xs text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedicines.map((med) => {
            const isLowStock = med.stock <= med.minStockAlert;

            return (
              <div
                key={med.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-teal-400 dark:hover:border-teal-600 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  
                  {/* Top Bar inside card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        {med.brandName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {med.genericName}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded shrink-0">
                      {med.type}
                    </span>
                  </div>

                  {/* Metadata Row (Unboxed with separators) */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2 mb-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{med.strength}</span>
                    <span aria-hidden="true">·</span>
                    <span>{med.mealTiming}</span>
                    {med.purpose && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[130px]">{med.purpose}</span>
                      </>
                    )}
                  </div>

                  {/* Patient Profile Tag or Unassigned Tag (Requirements 6 & 7) */}
                  <div className="flex items-center justify-between text-[11px] mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">রোগী প্রোফাইল:</span>
                    {med.assignedPatientId ? (
                      <span className="font-semibold text-teal-800 dark:text-teal-300">
                        {patients.find((p) => p.id === med.assignedPatientId)?.name || 'নির্দিষ্ট প্রোফাইল'}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        সাধারণ (পরে যুক্ত করুন)
                      </span>
                    )}
                  </div>

                  {/* Schedules badges */}
                  <div className="space-y-1 mb-4">
                    <span className="text-[11px] text-slate-400 block">সময়সূচি:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {med.schedules.map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-teal-600" />
                          <span>{s.timeSlot} ({toBengaliNumber(s.time)})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stock count & Smart Predictor */}
                  {(() => {
                    const pred = predictMedicineStock(med);
                    return (
                      <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        pred.status === 'out_of_stock'
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300'
                          : pred.status === 'urgent'
                          ? 'bg-rose-50 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-300'
                          : pred.status === 'low_stock'
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {pred.status === 'out_of_stock' || pred.status === 'urgent' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            ) : pred.status === 'low_stock' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : null}
                            <span>
                              মজুত: <strong className="tabular-nums font-semibold">{toBengaliNumber(med.stock)} {med.unit}</strong>
                            </span>
                          </div>
                          {pred.daysRemaining !== null && (
                            <span className="text-[10px] block font-semibold text-teal-800 dark:text-teal-300">
                              চলবে আনুমানিক {toBengaliNumber(pred.daysRemaining)} দিন
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openStockAdjustmentModal(med.id)}
                            title="স্টক সংশোধন"
                            className="min-h-[48px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Package className="w-4 h-4 text-teal-600" />
                            <span>আপডেট</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Footer Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {med.isChronic ? 'নিয়মিত ওষুধ' : `কোর্স: ${toBengaliNumber(med.durationDays)} দিন`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedMedicineIdForDetail(med.id)}
                    className="min-h-[48px] px-3 text-base font-bold text-teal-800 dark:text-teal-300 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>বিস্তারিত</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Medicine Detail Modal */}
      {selectedMedicineIdForDetail && (
        <MedicineDetailModal
          medicine={activeDetailMedicine}
          onClose={() => setSelectedMedicineIdForDetail(null)}
          onEdit={(med) => {
            // Edit navigates to AddMedicine with state
            setSelectedMedicineIdForDetail(null);
            setCurrentPage('add-medicine');
          }}
          onDelete={(id) => deleteMedicine(id)}
          onAdjustStock={(id, delta) => adjustStock(id, delta)}
        />
      )}

    </div>
  );
};
