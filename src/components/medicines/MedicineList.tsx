import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { Medicine, MedicineType } from '../../types';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { MedicineDetailModal } from './MedicineDetailModal';
import { MedicineBadgeIcon } from './MedicineBadgeIcon';
import { MedicinePhotoThumbnail } from './MedicinePhotoThumbnail';
import { MedicinePhotoLightbox } from './MedicinePhotoLightbox';
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
  ShoppingBag,
  CalendarDays,
  Stethoscope,
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
    startEditMedicine,
  } = useMedicine();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'chronic' | 'lowStock'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [lightboxState, setLightboxState] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

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
          <h1 className="text-2xl font-bold tracking-tight text-text">
            ওষুধের তালিকা {activePatient ? `(${activePatient.name})` : '(সকল ওষুধ)'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            মোট {toBengaliNumber(filteredMedicines.length)}টি ওষুধ সংরক্ষিত আছে
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCurrentPage('weekly-pillbox')}
            className="min-h-[52px] flex items-center gap-2 px-4 py-2.5 text-base font-bold text-primary bg-primary-soft border border-primary/25 hover:bg-primary-soft/80 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <CalendarDays className="w-5 h-5" />
            <span>সাপ্তাহিক পিলবক্স</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('doctors')}
            className="min-h-[52px] flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-text bg-surface border border-border hover:bg-surface-2 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Stethoscope className="w-5 h-5 text-primary" />
            <span>আমার ডাক্তার</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('shopping-list')}
            className="min-h-[52px] flex items-center gap-2.5 px-5 py-3 text-base sm:text-lg font-bold text-primary bg-primary-soft border border-primary/25 hover:bg-primary-soft/80 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>কেনার তালিকা বানান</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className="min-h-[52px] flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-text bg-surface border border-border hover:bg-surface-2 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-primary" />
            <span>ওষুধ লাইব্রেরি</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[52px] flex items-center gap-2 px-5 py-2.5 text-base font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>নতুন ওষুধ</span>
          </button>
        </div>

      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ওষুধের নাম বা রোগের নাম দিয়ে খুঁজুন..."
              className="min-h-[48px] w-full pl-11 pr-16 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="min-h-[48px] px-3 absolute right-1 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted hover:text-text cursor-pointer"
              >
                মুছুন
              </button>
            )}
          </div>

          {/* Form Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-text-muted shrink-0 hidden sm:block" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="ওষুধের ধরন"
              className="min-h-[48px] text-base bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-text focus:outline-hidden cursor-pointer"
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
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-2 text-text hover:bg-border/60'
            }`}
          >
            সব ওষুধ
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'active'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-2 text-text hover:bg-border/60'
            }`}
          >
            চলমান
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('chronic')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'chronic'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-2 text-text hover:bg-border/60'
            }`}
          >
            নিয়মিত
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('lowStock')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'lowStock'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-2 text-text hover:bg-border/60'
            }`}
          >
            মজুত কম
          </button>
        </div>
      </div>

      {/* Medicine Grid */}
      {medicines.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20">
            <Pill className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-text">
            এখনো কোনো ওষুধ যোগ করা হয়নি
          </h3>
          <p className="text-base text-text-muted max-w-md mx-auto mt-2 mb-6 leading-relaxed">
            আপনার প্রতিদিনের ওষুধ ও খাওয়ার সময় রাখতে নিচের বোতামে চাপ দিন।
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="min-h-[52px] inline-flex items-center gap-2 px-6 py-3 text-base font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-2xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>ওষুধ যোগ করুন</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="min-h-[52px] inline-flex items-center gap-2 px-5 py-3 text-base font-semibold text-primary bg-primary-soft border border-primary/25 rounded-2xl hover:bg-primary-soft/80 transition-colors cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>ওষুধ লাইব্রেরি দেখুন</span>
            </button>
          </div>
        </div>
      ) : filteredMedicines.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Pill className="w-12 h-12 text-text-muted/50 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text">
            কোনো ওষুধ খুঁজে পাওয়া যায়নি
          </h3>
          <p className="text-xs text-text-muted mt-1 mb-4">
            আপনার ফিল্টার পরিবর্তন করুন অথবা নতুন ওষুধ যুক্ত করুন।
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            className="px-3.5 py-1.5 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary-soft cursor-pointer"
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
                className="bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  
                  {/* Top Bar inside card */}
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <MedicineBadgeIcon
                        iconTag={med.iconTag}
                        type={med.type}
                        colorTag={med.colorTag}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-text leading-tight truncate">
                          {med.brandName}
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          {med.genericName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MedicinePhotoThumbnail
                        photoPath={med.photoPath}
                        alt={med.brandName}
                        size="sm"
                        onOpenLightbox={(url) =>
                          setLightboxState({
                            url,
                            title: med.brandName,
                            subtitle: `${med.genericName} · ${med.strength}`,
                          })
                        }
                      />
                      <MedicineBadgeIcon
                        iconTag={med.iconTag}
                        type={med.type}
                        colorTag={med.colorTag}
                        size="xs"
                        showLabel
                      />
                    </div>
                  </div>

                  {/* Metadata Row (Unboxed with separators) */}
                  <div className="flex items-center gap-1.5 text-xs text-text-muted mt-2 mb-2">
                    <span className="font-semibold text-text">{med.strength}</span>
                    <span aria-hidden="true">·</span>
                    <span>{med.mealTiming}</span>
                    {med.purpose && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[130px]">{med.purpose}</span>
                      </>
                    )}
                  </div>

                  {/* Patient Profile Tag or Unassigned Tag */}
                  <div className="flex items-center justify-between text-[11px] mb-3 pb-2 border-b border-border">
                    <span className="text-text-muted">রোগী প্রোফাইল:</span>
                    {med.assignedPatientId ? (
                      <span className="font-semibold text-primary">
                        {patients.find((p) => p.id === med.assignedPatientId)?.name || 'নির্দিষ্ট প্রোফাইল'}
                      </span>
                    ) : (
                      <span className="text-warning-text font-medium">
                        সাধারণ (পরে যুক্ত করুন)
                      </span>
                    )}
                  </div>

                  {/* Schedules badges */}
                  <div className="space-y-1 mb-4">
                    <span className="text-[11px] text-text-muted block">সময়সূচি:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {med.schedules.map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium bg-surface-2 border border-border px-2 py-0.5 rounded text-text flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-primary" />
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
                          ? 'bg-danger-soft border-danger/30 text-danger-text'
                          : pred.status === 'urgent'
                          ? 'bg-danger-soft border-danger/25 text-danger-text'
                          : pred.status === 'low_stock'
                          ? 'bg-warning-soft border-warning/30 text-warning-text'
                          : 'bg-surface-2 border-border text-text-muted'
                      }`}>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {pred.status === 'out_of_stock' || pred.status === 'urgent' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-danger-text shrink-0" />
                            ) : pred.status === 'low_stock' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-warning-text shrink-0" />
                            ) : null}
                            <span>
                              মজুত: <strong className="tabular-nums font-semibold">{toBengaliNumber(med.stock)} {med.unit}</strong>
                            </span>
                          </div>
                          {pred.daysRemaining !== null && (
                            <span className="text-[10px] block font-semibold text-primary">
                              চলবে আনুমানিক {toBengaliNumber(pred.daysRemaining)} দিন
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openStockAdjustmentModal(med.id)}
                            title="স্টক সংশোধন"
                            className="min-h-[48px] px-3.5 py-2 bg-surface border border-border text-sm font-bold text-text rounded-xl hover:bg-surface-2 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Package className="w-4 h-4 text-primary" />
                            <span>আপডেট</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Footer Card Actions */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-text-muted">
                    {med.isChronic ? 'নিয়মিত ওষুধ' : `কোর্স: ${toBengaliNumber(med.durationDays)} দিন`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedMedicineIdForDetail(med.id)}
                    className="min-h-[48px] px-3 text-base font-bold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
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
            setSelectedMedicineIdForDetail(null);
            startEditMedicine(med);
          }}
          onDelete={(id) => deleteMedicine(id)}
          onAdjustStock={(id, delta) => adjustStock(id, delta)}
        />
      )}

      <MedicinePhotoLightbox
        imageUrl={lightboxState?.url || null}
        title={lightboxState?.title || ''}
        subtitle={lightboxState?.subtitle}
        onClose={() => setLightboxState(null)}
      />

    </div>
  );
};
