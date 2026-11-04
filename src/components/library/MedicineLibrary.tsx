import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine } from '../../types';
import { GlobalMedicineDetailModal } from './GlobalMedicineDetailModal';
import { AddToPersonalModal } from './AddToPersonalModal';
import {
  Search,
  Filter,
  Pill,
  Building,
  ShieldCheck,
  ShieldAlert,
  Plus,
  BookOpen,
  UploadCloud,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Info,
  Landmark,
  FileBadge,
  Check,
  Clock,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { isTestMedicine } from '../../utils/medicineImportParser';

export const MedicineLibrary: React.FC = () => {
  const {
    globalMedicines,
    patients,
    isAdmin,
    setCurrentPage,
    selectedGlobalMedForDetail,
    setSelectedGlobalMedForDetail,
    isAddToPersonalModalOpen,
    catalogMedToAddToPersonal,
    openAddToPersonalModal,
    closeAddToPersonalModal,
    addCatalogMedToPersonal,
    publishGlobalMedicineAction,
    deleteGlobalMedicineAction,
    bulkDeleteGlobalMedicinesAction,
  } = useMedicine();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'published' | 'pending' | 'all'>('published');
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Safe Deletion & Selection States for Draft TEST DATA
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    medicines: GlobalMedicine[];
    isDeleting: boolean;
  }>({
    isOpen: false,
    medicines: [],
    isDeleting: false,
  });

  // Extract unique manufacturers and forms
  const uniqueManufacturers = useMemo(() => {
    const set = new Set<string>();
    globalMedicines.forEach((m) => {
      if (m.manufacturer) set.add(m.manufacturer);
    });
    return Array.from(set).sort();
  }, [globalMedicines]);

  const uniqueForms = useMemo(() => {
    const set = new Set<string>();
    globalMedicines.forEach((m) => {
      if (m.dosageForm) set.add(m.dosageForm);
    });
    return Array.from(set).sort();
  }, [globalMedicines]);

  // Filter medicines:
  // Non-admin users ONLY see published and verified records (Requirement 6)
  // Admin users can inspect pending/draft records and publish them
  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return globalMedicines.filter((med) => {
      // Role-based visibility enforcement
      if (!isAdmin) {
        // Strict legal compliance: unverified records remain unpublished
        if (med.status !== 'published') {
          return false;
        }
      } else {
        // Admin status filter: 'published' shows published, 'pending' shows draft/unverified, 'all' shows all
        if (adminStatusFilter === 'published' && med.status !== 'published') {
          return false;
        }
        if (adminStatusFilter === 'pending' && med.status === 'published') {
          return false;
        }
      }

      // Search matching across brand, generic, strength, manufacturer, therapeutic class
      if (query) {
        const matchesBrand =
          med.brandName.toLowerCase().includes(query) ||
          (med.brandNameBn && med.brandNameBn.toLowerCase().includes(query));
        const matchesGeneric =
          med.genericName.toLowerCase().includes(query) ||
          (med.genericNameBn && med.genericNameBn.toLowerCase().includes(query));
        const matchesStrength = med.strength.toLowerCase().includes(query);
        const matchesManufacturer = med.manufacturer.toLowerCase().includes(query);
        const matchesIndication = med.indication?.toLowerCase().includes(query);
        const matchesClass = med.therapeuticClass?.toLowerCase().includes(query);

        if (
          !matchesBrand &&
          !matchesGeneric &&
          !matchesStrength &&
          !matchesManufacturer &&
          !matchesIndication &&
          !matchesClass
        ) {
          return false;
        }
      }

      // Filter by dosage form
      if (selectedForm !== 'all' && med.dosageForm !== selectedForm) {
        return false;
      }

      // Filter by manufacturer
      if (selectedManufacturer !== 'all' && med.manufacturer !== selectedManufacturer) {
        return false;
      }

      // Filter by source
      if (selectedSource !== 'all') {
        if (selectedSource === 'DGDA' && med.source !== 'DGDA_GOV' && med.source !== 'DGDA_Official') return false;
        if (selectedSource === 'MANUFACTURER' && med.source !== 'MANUFACTURER') return false;
        if (selectedSource === 'INDEPENDENT' && med.source !== 'INDEPENDENT_VERIFIED') return false;
        if (selectedSource === 'MEDEX' && med.source !== 'MEDEX_LICENSED' && med.source !== 'MedEx') return false;
        if (selectedSource === 'DIMS' && med.source !== 'DIMS_LICENSED' && med.source !== 'DIMS') return false;
      }

      return true;
    });
  }, [
    globalMedicines,
    isAdmin,
    adminStatusFilter,
    searchQuery,
    selectedForm,
    selectedManufacturer,
    selectedSource,
  ]);

  // Quick verify & publish by admin
  const handleQuickPublish = async (e: React.MouseEvent, medId: string) => {
    e.stopPropagation();
    setPublishingId(medId);
    const success = await publishGlobalMedicineAction(medId);
    if (success) {
      // Auto-switch to published tab so the admin immediately sees the approved medicine
      setAdminStatusFilter('published');
    }
    setPublishingId(null);
  };

  // Safe Deletion Handlers for Draft TEST DATA
  const toggleDraftSelection = (id: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTestDrafts = () => {
    // Only select items that are unpublished drafts AND are test data
    const testDrafts = filteredMedicines.filter(
      (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
    );
    const testDraftIds = testDrafts.map((m) => m.id);
    const allSelected = testDraftIds.length > 0 && testDraftIds.every((id) => selectedDraftIds.has(id));
    if (allSelected) {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        testDraftIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        testDraftIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const promptSingleDelete = (e: React.MouseEvent, med: GlobalMedicine) => {
    e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      medicines: [med],
      isDeleting: false,
    });
  };

  const promptBulkDelete = () => {
    const selectedMeds = globalMedicines.filter(
      (m) => selectedDraftIds.has(m.id) && (m.status !== 'published' || !m.verifiedByAdmin || isTestMedicine(m))
    );
    if (selectedMeds.length === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      medicines: selectedMeds,
      isDeleting: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmModal.medicines.length === 0) return;
    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

    const idsToDelete = deleteConfirmModal.medicines.map((m) => m.id);
    if (idsToDelete.length === 1) {
      await deleteGlobalMedicineAction(idsToDelete[0]);
    } else {
      await bulkDeleteGlobalMedicinesAction(idsToDelete);
    }

    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });

    setDeleteConfirmModal({
      isOpen: false,
      medicines: [],
      isDeleting: false,
    });
  };

  // Helper for source badge UI
  const renderSourceBadge = (med: GlobalMedicine) => {
    if (med.source === 'DGDA_GOV' || med.source === 'DGDA_Official') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
          <Landmark className="w-3 h-3 text-emerald-600" />
          DGDA সরকারি গেজেট
        </span>
      );
    }
    if (med.source === 'MANUFACTURER') {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
          <Building className="w-3 h-3 text-blue-600" />
          প্রস্তুতকারক মনোগ্রাফ
        </span>
      );
    }
    if (med.source === 'INDEPENDENT_VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
          <FileBadge className="w-3 h-3 text-purple-600" />
          ক্লিনিক্যাল যাচাইকৃত
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
        <ShieldCheck className="w-3 h-3 text-teal-600" />
        লাইসেন্সপ্রাপ্ত পার্টনার ({med.source})
      </span>
    );
  };

  const publishedCount = globalMedicines.filter((m) => m.status === 'published').length;
  const pendingCount = globalMedicines.filter((m) => m.status !== 'published').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              ওষুধ লাইব্রেরি (Medicine Library)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              যাচাইকৃত ডাটাবেজ
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            DGDA সরকারি উন্মুক্ত ড্রাগ রেজিস্টার, প্রস্তুতকারকের মনোগ্রাফ ও অনুমোদিত ক্লিনিক্যাল নির্দেশিকা। ব্র্যান্ড নাম, জেনেরিক নাম, শক্তি ও কোম্পানি দিয়ে অনুসন্ধান করুন।
          </p>
        </div>

        {/* Quick Admin Import Link or Catalog Stats */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setCurrentPage('admin-dashboard')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>অ্যাডমিন ড্যাশবোর্ড</span>
            </button>
          ) : (
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-400 block">অনুমোদিত ওষুধ সংখ্যা</span>
              <span className="text-lg font-bold text-teal-800 dark:text-teal-400">
                {publishedCount} টি
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Admin Publication Filter Bar (Requirement 6) */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              প্রশাসক ফিল্টার:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setAdminStatusFilter('published')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'published'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                প্রকাশিত ওষুধ ({publishedCount})
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('pending')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                অপেক্ষমাণ খসড়া ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'all'
                    ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                সকল ({globalMedicines.length})
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-teal-600" />
            <span>অপেক্ষমাণ খসড়া সাধারণ ব্যবহারকারীদের জন্য স্বয়ংক্রিয়ভাবে লুকানো থাকে।</span>
          </div>
        </div>
      )}

      {/* Admin Draft / Unpublished Queue TEST DATA Bulk Management Toolbar */}
      {isAdmin && (adminStatusFilter === 'pending' || selectedDraftIds.size > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllTestDrafts}
              className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
            >
              {(() => {
                const testDrafts = filteredMedicines.filter(
                  (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
                );
                const allSelected =
                  testDrafts.length > 0 && testDrafts.every((m) => selectedDraftIds.has(m.id));
                return allSelected ? (
                  <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                );
              })()}
              <span>
                সকল খসড়া TEST DATA নির্বাচন (
                {
                  filteredMedicines.filter(
                    (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
                  ).length
                }{' '}
                টি)
              </span>
            </button>

            {selectedDraftIds.size > 0 && (
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                নির্বাচিত:{' '}
                <strong className="text-rose-600 dark:text-rose-400 font-bold">
                  {selectedDraftIds.size}
                </strong>{' '}
                টি
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {selectedDraftIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDraftIds(new Set())}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                নির্বাচন বাতিল
              </button>
            )}

            <button
              type="button"
              disabled={selectedDraftIds.size === 0}
              onClick={promptBulkDelete}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold shadow-xs transition-colors cursor-pointer ${
                selectedDraftIds.size > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
              title="নির্বাচিত TEST DATA রেকর্ড নিরাপদে মুছে ফেলুন"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {selectedDraftIds.size > 0
                  ? `নির্বাচিত ${selectedDraftIds.size} টি TEST DATA মুছুন`
                  : 'বাল্ক মুছুন (Bulk Delete)'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ব্র্যান্ড নাম, জেনেরিক নাম বা কোম্পানি দিয়ে খুঁজুন (যেমন: Napa, Paracetamol, স্কয়ার, 500mg)..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              মুছে ফেলুন
            </button>
          )}
        </div>

        {/* Filter Selectors Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          
          {/* Dosage Form Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 whitespace-nowrap text-[11px]">ডোজ ধরন:</span>
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">সকল ধরন (All Forms)</option>
              {uniqueForms.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </div>

          {/* Manufacturer Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 whitespace-nowrap text-[11px]">কোম্পানি:</span>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden truncate"
            >
              <option value="all">সকল প্রস্তুতকারক (All Companies)</option>
              {uniqueManufacturers.map((mfg) => (
                <option key={mfg} value={mfg}>
                  {mfg}
                </option>
              ))}
            </select>
          </div>

          {/* Source Profile Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 whitespace-nowrap text-[11px]">উৎস:</span>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">সকল আইনি উৎস (All Sources)</option>
              <option value="DGDA">DGDA সরকারি উন্মুক্ত গেজেট</option>
              <option value="MANUFACTURER">প্রস্তুতকারকের অফিশিয়াল মনোগ্রাফ</option>
              <option value="INDEPENDENT">স্বাধীন ক্লিনিক্যাল ডাটা</option>
              <option value="MEDEX">MedEx বাংলাদেশ (লাইসেন্সপ্রাপ্ত)</option>
              <option value="DIMS">DIMS বাংলাদেশ (লাইসেন্সপ্রাপ্ত)</option>
            </select>
          </div>

        </div>

      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          পাওয়া গেছে: <strong className="text-slate-900 dark:text-white font-bold">{filteredMedicines.length}</strong> টি ওষুধ
          {isAdmin && adminStatusFilter === 'pending' && ' (অপেক্ষমাণ খসড়া)'}
        </span>
        {(searchQuery || selectedForm !== 'all' || selectedManufacturer !== 'all' || selectedSource !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedForm('all');
              setSelectedManufacturer('all');
              setSelectedSource('all');
            }}
            className="text-teal-700 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
          >
            ফিল্টার রিসেট করুন
          </button>
        )}
      </div>

      {/* Medicines Grid */}
      {filteredMedicines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedicines.map((med) => {
            const isUnpublished = med.status !== 'published' || !med.verifiedByAdmin;
            const isTest = isTestMedicine(med);

            return (
              <div
                key={med.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all flex flex-col justify-between group shadow-xs ${
                  isUnpublished
                    ? isTest
                      ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/15 dark:bg-rose-950/10'
                      : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-teal-500/50 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top Row: Brand & Strength + Form badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {isAdmin && isUnpublished && isTest && (
                        <input
                          type="checkbox"
                          checked={selectedDraftIds.has(med.id)}
                          onChange={() => toggleDraftSelection(med.id)}
                          className="mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                          aria-label={`${med.brandName} নির্বাচন করুন`}
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                            {med.brandName}
                          </h3>
                          {isUnpublished && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              অপ্রকাশিত
                            </span>
                          )}
                          {isTest && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              TEST DATA
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {med.genericName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                        {med.strength}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {med.dosageForm}
                      </span>
                    </div>
                  </div>

                  {/* Company & Price */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate" title={med.manufacturer}>
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{med.manufacturer}</span>
                    </div>
                    
                    {med.pricePerUnit !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">খুচরা মূল্য:</span>
                        <span className="font-semibold text-teal-800 dark:text-teal-300">৳ {med.pricePerUnit.toFixed(2)}</span>
                      </div>
                    )}

                    {med.indication && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {med.indication}
                      </p>
                    )}
                  </div>

                  {/* Source and License Badge */}
                  <div className="mt-2.5 flex items-center justify-between gap-1 text-[10px] text-slate-400">
                    {renderSourceBadge(med)}
                    {med.darNumber && (
                      <span className="truncate max-w-[110px]" title={med.darNumber}>
                        DAR: {med.darNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGlobalMedForDetail(med)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-center"
                  >
                    বিস্তারিত
                  </button>

                  {/* If unpublished & user is Admin, allow one-click Verify & Publish */}
                  {isAdmin && isUnpublished ? (
                    <>
                      <button
                        type="button"
                        disabled={publishingId === med.id}
                        onClick={(e) => handleQuickPublish(e, med.id)}
                        className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                        title="যাচাই ও সার্বজনীন প্রকাশ করুন"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{publishingId === med.id ? 'প্রকাশ হচ্ছে...' : 'অনুমোদন'}</span>
                      </button>

                      {/* Safe Delete Option for Draft TEST DATA */}
                      <button
                        type="button"
                        onClick={(e) => promptSingleDelete(e, med)}
                        className="flex items-center justify-center p-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shrink-0"
                        title="এই টেস্ট রেকর্ডটি নিরাপদে মুছে ফেলুন"
                        aria-label={`${med.brandName} মুছে ফেলুন`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAddToPersonalModal(med)}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                      title="আমার ওষুধ তালিকায় যোগ করুন"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>যোগ করুন</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto shadow-xs">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {globalMedicines.length === 0
                ? 'ওষুধ লাইব্রেরি বর্তমানে খালি রয়েছে'
                : isAdmin && adminStatusFilter === 'pending' && pendingCount === 0
                ? 'কোনো অপেক্ষমাণ খসড়া নেই'
                : 'কোনো ওষুধ খুঁজে পাওয়া যায়নি'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {globalMedicines.length === 0
                ? 'আইনানুগ উন্মুক্ত সরকারি গেজেট (DGDA), প্রস্তুতকারকের মনোগ্রাফ অথবা অনুমোদিত পার্টনার ফাইল অ্যাডমিন প্যানেল থেকে আপলোড করা হলে যাচাইকৃত ওষুধ ক্যাটালগ এখানে প্রদর্শিত হবে।'
                : isAdmin && adminStatusFilter === 'pending' && pendingCount === 0
                ? 'আপনার সকল ওষুধ অনুমোদিত ও প্রকাশিত হয়েছে। আপনি "প্রকাশিত ওষুধ" ট্যাবে সব দেখতে পাবেন।'
                : 'আপনার সার্চ বা ফিল্টার শর্ত অনুযায়ী কোনো ওষুধ পাওয়া যায়নি। ফিল্টার রিসেট করে আবার চেষ্টা করুন।'}
            </p>
          </div>

          {isAdmin && adminStatusFilter === 'pending' && publishedCount > 0 && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setAdminStatusFilter('published')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <span>প্রকাশিত ওষুধ লাইব্রেরি দেখুন ({publishedCount}টি)</span>
              </button>
            </div>
          )}

          {globalMedicines.length === 0 && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setCurrentPage('admin-import')}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>অ্যাডমিন ইমপোর্টে যান</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  <span>স্বাস্থ্য প্রশাসন কর্তৃক অনুমোদিত ক্যাটালগ শীঘ্রই প্রকাশিত হবে</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Global Medicine Detail Modal */}
      <GlobalMedicineDetailModal
        medicine={selectedGlobalMedForDetail}
        onClose={() => setSelectedGlobalMedForDetail(null)}
        onAddToMyMedicines={(med) => openAddToPersonalModal(med)}
      />

      {/* Add To Personal Medicines Modal */}
      <AddToPersonalModal
        medicine={catalogMedToAddToPersonal}
        patients={patients}
        isOpen={isAddToPersonalModalOpen}
        onClose={closeAddToPersonalModal}
        onConfirm={addCatalogMedToPersonal}
      />

      {/* Confirmation Dialog for Safe TEST DATA Deletion */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  TEST DATA মুছে ফেলার নিশ্চিতকরণ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে খসড়া কিউ থেকে নির্বাচিত{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">
                    {deleteConfirmModal.medicines.length}
                  </strong>{' '}
                  টি টেস্ট রেকর্ড মুছে ফেলতে চান?
                </p>
              </div>
            </div>

            {/* List of Medicines Targeted for Deletion */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/80 max-h-48 overflow-y-auto space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                নির্বাচিত রেকর্ডসমূহ ({deleteConfirmModal.medicines.length} টি):
              </span>
              {deleteConfirmModal.medicines.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {m.brandName}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {m.genericName} • {m.strength} • {m.dosageForm}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 shrink-0 border border-rose-200 dark:border-rose-900/60">
                    TEST DATA
                  </span>
                </div>
              ))}
            </div>

            {/* Safety Guarantee Notice (Condition 5) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ডেটা সুরক্ষা ও নিরাপত্তা নিশ্চয়তা (Safety Guarantee):</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                এই অপারেশনটি কোনো <strong>প্রকাশিত বাস্তব ওষুধ</strong>, <strong>ব্যক্তিগত আমার ওষুধ তালিকা</strong>, <strong>রোগীর প্রোফাইল</strong> কিংবা <strong>ডোজ লগ</strong> স্পর্শ করবে না। শুধুমাত্র নির্বাচিত খসড়া টেস্ট ডাটা স্থায়ীভাবে অপসারিত হবে।
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={() => setDeleteConfirmModal({ isOpen: false, medicines: [], isDeleting: false })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteConfirmModal.isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, নিশ্চিতভাবে মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
