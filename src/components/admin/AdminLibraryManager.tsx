import React, { useState, useMemo, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine } from '../../types';
import {
  AdminLibraryFilters,
  DEFAULT_ADMIN_FILTERS,
  BulkMedicinePatch,
  computeLibraryQualityReport,
  filterAndSortAdminMedicines,
  findSuspectedDuplicateGroups,
  getActiveAdminFilterChips,
  pickDuplicateIdsKeepingOne,
  downloadMedicinesCsv,
  downloadPreDeleteBackupJson,
  isMissingGeneric,
  isMissingPrice,
} from '../../utils/libraryManagement';
import { isTestMedicine } from '../../utils/medicineImportParser';
import {
  ArrowLeft,
  Search,
  Trash2,
  Edit3,
  Download,
  Copy,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Lock,
  LogIn,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  Tag,
  Building,
  Pill,
  Check,
  SlidersHorizontal,
} from 'lucide-react';

const ADMIN_PAGE_SIZE = 50;
const UNDO_WINDOW_SECONDS = 30;

const DOSAGE_FORM_OPTIONS = [
  'ট্যাবলেট',
  'ক্যাপসুল',
  'সিরাপ',
  'সাসপেনশন',
  'ইনজেকশন/ইনসুলিন',
  'চোখের ড্রপ',
  'ইনহেলার',
  'মলম/জেল',
  'সাপোজিটরি',
];

const PRICE_UNIT_OPTIONS = ['পিস', 'পাতা', 'বোতল', 'টিউব', 'ভায়াল', 'প্যাক'];

export const AdminLibraryManager: React.FC = () => {
  const {
    globalMedicines,
    libraryVersion,
    isAdmin,
    currentUser,
    openAuthModal,
    setCurrentPage,
    openManualAddModal,
    openEditGlobalMedicineModal,
    bulkUpdateGlobalMedicinesAction,
    adminDeleteGlobalMedicinesAction,
    restoreDeletedGlobalMedicinesAction,
    showToast,
  } = useMedicine();

  // Filters, sorting, pagination & duplicate view
  const [filters, setFilters] = useState<AdminLibraryFilters>(DEFAULT_ADMIN_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'duplicates'>('list');
  const [page, setPage] = useState(1);

  // Marked selection state
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  // Delete Confirmation Modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    items: GlobalMedicine[];
    downloadBackup: boolean;
    typedConfirm: string;
    isDeleting: boolean;
    errorMessage: string | null;
  }>({
    isOpen: false,
    items: [],
    downloadBackup: true,
    typedConfirm: '',
    isDeleting: false,
    errorMessage: null,
  });

  // Bulk Edit Modal state
  const [bulkEditModal, setBulkEditModal] = useState<{
    isOpen: boolean;
    initialFocus: 'price' | 'company' | 'form';
    updateManufacturer: boolean;
    manufacturer: string;
    updateDosageForm: boolean;
    dosageForm: string;
    updatePrice: boolean;
    pricePerUnit: string;
    priceUnit: string;
    isSaving: boolean;
  }>({
    isOpen: false,
    initialFocus: 'price',
    updateManufacturer: false,
    manufacturer: '',
    updateDosageForm: false,
    dosageForm: 'ট্যাবলেট',
    updatePrice: false,
    pricePerUnit: '',
    priceUnit: '',
    isSaving: false,
  });

  // 30-second Undo banner state
  const [undoBanner, setUndoBanner] = useState<{
    items: GlobalMedicine[];
    secondsLeft: number;
    isRestoring: boolean;
  } | null>(null);

  // Clean up marked IDs if medicines are removed externally
  useEffect(() => {
    const validIds = new Set(globalMedicines.map((m) => m.id));
    setMarkedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [globalMedicines]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filters, viewMode]);

  // 30-second Undo countdown timer
  useEffect(() => {
    if (!undoBanner || undoBanner.isRestoring) return;
    if (undoBanner.secondsLeft <= 0) {
      setUndoBanner(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoBanner((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoBanner]);

  // Unique dropdown values
  const uniqueManufacturers = useMemo(() => {
    const set = new Set<string>();
    globalMedicines.forEach((m) => {
      if (m.manufacturer?.trim()) set.add(m.manufacturer.trim());
    });
    return Array.from(set).sort();
  }, [globalMedicines]);

  const uniqueDosageForms = useMemo(() => {
    const set = new Set<string>();
    globalMedicines.forEach((m) => {
      if (m.dosageForm?.trim()) set.add(m.dosageForm.trim());
    });
    return Array.from(set).sort();
  }, [globalMedicines]);

  const uniqueGenerics = useMemo(() => {
    const set = new Set<string>();
    globalMedicines.forEach((m) => {
      if (m.genericName?.trim() && m.genericName.trim() !== '-') {
        set.add(m.genericName.trim());
      }
    });
    return Array.from(set).sort().slice(0, 400);
  }, [globalMedicines]);

  // Quality report metrics (calculated locally from cached globalMedicines)
  const qualityReport = useMemo(
    () => computeLibraryQualityReport(globalMedicines),
    [globalMedicines]
  );

  // Suspected duplicate groups
  const duplicateGroups = useMemo(
    () => findSuspectedDuplicateGroups(globalMedicines),
    [globalMedicines]
  );

  // Filtered and sorted list
  const filteredMedicines = useMemo(
    () =>
      filterAndSortAdminMedicines(
        globalMedicines,
        filters,
        qualityReport.suspectedDuplicateIdSet
      ),
    [globalMedicines, filters, qualityReport.suspectedDuplicateIdSet]
  );

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedMedicines = useMemo(() => {
    const start = (safePage - 1) * ADMIN_PAGE_SIZE;
    return filteredMedicines.slice(start, start + ADMIN_PAGE_SIZE);
  }, [filteredMedicines, safePage]);

  const activeChips = useMemo(() => getActiveAdminFilterChips(filters), [filters]);

  const allOnPageMarked =
    paginatedMedicines.length > 0 &&
    paginatedMedicines.every((m) => markedIds.has(m.id));

  const allFilteredMarked =
    filteredMedicines.length > 0 &&
    filteredMedicines.every((m) => markedIds.has(m.id));

  // Security Lockout if non-admin
  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="bg-surface rounded-3xl p-8 border border-border shadow-xl text-center space-y-5 max-w-lg w-full">
          <div className="w-16 h-16 rounded-2xl bg-danger-soft text-danger-text flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text">
              অ্যাডমিন অনুমতি প্রয়োজন
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              ওষুধ ব্যবস্থাপনা পাতাটি শুধুমাত্র অনুমোদিত অ্যাডমিনের জন্য সংরক্ষিত।
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {!currentUser && (
              <button
                type="button"
                onClick={openAuthModal}
                className="min-h-[48px] flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>অ্যাডমিন হিসেবে লগইন করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="min-h-[48px] px-5 py-2.5 text-sm font-semibold text-text bg-surface-2 hover:bg-border/60 rounded-xl cursor-pointer"
            >
              ওষুধ লাইব্রেরিতে ফিরুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Selection Handlers
  const toggleRowMark = (id: string) => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMarkCurrentPage = () => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageMarked) {
        paginatedMedicines.forEach((m) => next.delete(m.id));
      } else {
        paginatedMedicines.forEach((m) => next.add(m.id));
      }
      return next;
    });
  };

  const markAllFiltered = () => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      filteredMedicines.forEach((m) => next.add(m.id));
      return next;
    });
    showToast(`ফিল্টারে মিলে যাওয়া সব ${filteredMedicines.length}টি ওষুধ মার্ক করা হয়েছে`, 'info');
  };

  const clearAllMarks = () => setMarkedIds(new Set());

  const handleMarkDuplicatesKeepingOne = (idsToMark?: string[]) => {
    const ids = idsToMark ?? pickDuplicateIdsKeepingOne(duplicateGroups);
    if (ids.length === 0) {
      showToast('মার্ক করার মতো অতিরিক্ত ডুপ্লিকেট নেই', 'info');
      return;
    }
    setMarkedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    showToast(`প্রতিটি দলে ১টি রেখে বাকি ${ids.length}টি ডুপ্লিকেট মার্ক করা হয়েছে`, 'info');
  };

  // Chip removal
  const removeFilterChip = (key: keyof AdminLibraryFilters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: DEFAULT_ADMIN_FILTERS[key],
    }));
  };

  // Delete Handlers
  const openDeleteConfirmation = (itemsToDelete: GlobalMedicine[]) => {
    if (itemsToDelete.length === 0) return;
    setDeleteModal({
      isOpen: true,
      items: itemsToDelete,
      downloadBackup: true,
      typedConfirm: '',
      isDeleting: false,
      errorMessage: null,
    });
  };

  const openBulkDeleteConfirmation = () => {
    const items = globalMedicines.filter((m) => markedIds.has(m.id));
    openDeleteConfirmation(items);
  };

  const requiresTypedConfirm = deleteModal.items.length > 10;
  const isTypedConfirmValid =
    !requiresTypedConfirm || deleteModal.typedConfirm.trim() === 'মুছুন';

  const handleConfirmDelete = async () => {
    if (!isTypedConfirmValid || deleteModal.items.length === 0) return;
    setDeleteModal((prev) => ({ ...prev, isDeleting: true, errorMessage: null }));

    const backupItems = [...deleteModal.items];
    if (deleteModal.downloadBackup) {
      downloadPreDeleteBackupJson(backupItems);
    }

    const res = await adminDeleteGlobalMedicinesAction(backupItems.map((m) => m.id));
    if (!res.success) {
      setDeleteModal((prev) => ({
        ...prev,
        isDeleting: false,
        errorMessage: res.errorMessage || 'মুছে ফেলা সম্ভব হয়নি, আগের তালিকা অপরিবর্তিত রয়েছে।',
      }));
      return;
    }

    // Clear deleted IDs from selection
    const deletedIdSet = new Set(res.deletedItems.map((m) => m.id));
    setMarkedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (!deletedIdSet.has(id)) next.add(id);
      });
      return next;
    });

    setDeleteModal({
      isOpen: false,
      items: [],
      downloadBackup: true,
      typedConfirm: '',
      isDeleting: false,
      errorMessage: null,
    });

    // Activate 30-second Undo banner
    setUndoBanner({
      items: res.deletedItems,
      secondsLeft: UNDO_WINDOW_SECONDS,
      isRestoring: false,
    });
  };

  const handleUndoDelete = async () => {
    if (!undoBanner || undoBanner.isRestoring) return;
    const itemsToRestore = [...undoBanner.items];
    setUndoBanner((prev) => (prev ? { ...prev, isRestoring: true } : null));
    const ok = await restoreDeletedGlobalMedicinesAction(itemsToRestore);
    if (ok) {
      setUndoBanner(null);
    } else {
      setUndoBanner((prev) => (prev ? { ...prev, isRestoring: false } : null));
    }
  };

  // Bulk Edit Handlers
  const openBulkEdit = (focus: 'price' | 'company' | 'form') => {
    if (markedIds.size === 0) return;
    setBulkEditModal({
      isOpen: true,
      initialFocus: focus,
      updateManufacturer: focus === 'company',
      manufacturer: '',
      updateDosageForm: focus === 'form',
      dosageForm: 'ট্যাবলেট',
      updatePrice: focus === 'price',
      pricePerUnit: '',
      priceUnit: '',
      isSaving: false,
    });
  };

  const handleSaveBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: BulkMedicinePatch = {};
    if (bulkEditModal.updateManufacturer && bulkEditModal.manufacturer.trim()) {
      patch.manufacturer = bulkEditModal.manufacturer.trim();
    }
    if (bulkEditModal.updateDosageForm && bulkEditModal.dosageForm.trim()) {
      patch.dosageForm = bulkEditModal.dosageForm.trim();
    }
    if (bulkEditModal.updatePrice) {
      if (bulkEditModal.pricePerUnit.trim() !== '') {
        const parsed = parseFloat(bulkEditModal.pricePerUnit);
        if (Number.isNaN(parsed) || parsed < 0) {
          showToast('সঠিক দাম লিখুন (০ বা তার বেশি সংখ্যা)', 'alert');
          return;
        }
        patch.pricePerUnit = parsed;
      }
      if (bulkEditModal.priceUnit.trim()) {
        patch.priceUnit = bulkEditModal.priceUnit.trim();
      }
    }

    if (
      patch.manufacturer === undefined &&
      patch.dosageForm === undefined &&
      patch.pricePerUnit === undefined &&
      patch.priceUnit === undefined
    ) {
      showToast('অন্তত একটি পরিবর্তনের তথ্য দিন', 'info');
      return;
    }

    setBulkEditModal((prev) => ({ ...prev, isSaving: true }));
    const updated = await bulkUpdateGlobalMedicinesAction(Array.from(markedIds), patch);
    setBulkEditModal((prev) => ({ ...prev, isSaving: false }));
    if (updated >= 0) {
      setBulkEditModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Export CSV Handler
  const handleExportCsv = (onlyMarked: boolean) => {
    const items = onlyMarked
      ? globalMedicines.filter((m) => markedIds.has(m.id))
      : filteredMedicines;

    if (items.length === 0) {
      showToast('রপ্তানি করার মতো কোনো ওষুধ নেই', 'info');
      return;
    }
    downloadMedicinesCsv(items);
    showToast(`${items.length}টি ওষুধের CSV ফাইল ডাউনলোড হচ্ছে`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage('admin-dashboard')}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary bg-primary-soft hover:bg-primary/15 rounded-xl cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ড্যাশবোর্ড</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2">
              <span>ওষুধ ব্যবস্থাপনা</span>
            </h1>
            {libraryVersion > 0 && (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-surface-2 text-text-muted">
                সংস্করণ {libraryVersion}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            ফোনে লোড করা তালিকা থেকেই তাৎক্ষণিক অনুসন্ধান, ডুপ্লিকেট বাছাই, সম্পাদনা ও নিরাপদ অপসারণ করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              setViewMode((prev) => (prev === 'list' ? 'duplicates' : 'list'))
            }
            className={`min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-colors cursor-pointer ${
              viewMode === 'duplicates'
                ? 'bg-warning text-white border-warning'
                : 'bg-warning-soft text-warning-text border-warning/35 hover:opacity-90'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>
              {viewMode === 'duplicates'
                ? 'সব ওষুধ তালিকায় ফিরুন'
                : `ডুপ্লিকেট খুঁজুন (${qualityReport.suspectedDuplicateGroupsCount})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCsv(false)}
            className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-surface-2 text-text border border-border hover:bg-border/50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV রপ্তানি ({filteredMedicines.length})</span>
          </button>

          <button
            type="button"
            onClick={openManualAddModal}
            className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-hover text-on-primary shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন ওষুধ যোগ</span>
          </button>
        </div>
      </div>

      {/* 30-Second Undo Banner */}
      {undoBanner && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-[#1E1B4B] dark:bg-surface-2 text-white border border-indigo-900/50 dark:border-border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {undoBanner.items.length}টি ওষুধ লাইব্রেরি থেকে মুছে ফেলা হয়েছে
              </p>
              <p className="text-xs text-indigo-200 tabular-nums">
                ভুল হলে {undoBanner.secondsLeft} সেকেন্ডের মধ্যে পূর্বাবস্থায় ফেরাতে পারবেন
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={undoBanner.isRestoring}
              onClick={handleUndoDelete}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-success hover:opacity-90 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {undoBanner.isRestoring ? 'ফেরানো হচ্ছে...' : 'পূর্বাবস্থায় ফেরান'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUndoBanner(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-indigo-200 hover:bg-white/10 cursor-pointer"
              aria-label="বার্তা বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Single Data Quality Report Card ("গুণমান রিপোর্ট") */}
      <section
        aria-label="গুণমান রিপোর্ট"
        className="bg-surface rounded-2xl border border-border p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">
              গুণমান রিপোর্ট
            </h2>
          </div>
          <span className="text-xs text-text-muted">
            যেকোনো সংখ্যায় ট্যাপ করলে সরাসরি সেই তালিকা ফিল্টার হবে
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* 1. Total */}
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setFilters((prev) => ({
                ...prev,
                priceStatus: 'all',
                qualityFilter: 'all',
              }));
            }}
            className={`min-h-[76px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              viewMode === 'list' &&
              filters.priceStatus === 'all' &&
              filters.qualityFilter === 'all'
                ? 'bg-primary-soft border-primary'
                : 'bg-surface-2 border-border hover:border-primary/60'
            }`}
          >
            <span className="text-xs font-semibold text-text-muted block">
              মোট ওষুধ
            </span>
            <span className="text-2xl font-extrabold text-text tabular-nums mt-1 block">
              {qualityReport.totalCount}
            </span>
          </button>

          {/* 2. Missing Price */}
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setFilters((prev) => ({
                ...prev,
                priceStatus: prev.priceStatus === 'no_price' ? 'all' : 'no_price',
              }));
            }}
            className={`min-h-[76px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              filters.priceStatus === 'no_price'
                ? 'bg-warning-soft border-warning'
                : 'bg-surface-2 border-border hover:border-warning/60'
            }`}
          >
            <span className="text-xs font-semibold text-text-muted block">
              দাম ছাড়া
            </span>
            <span className="text-2xl font-extrabold text-warning-text tabular-nums mt-1 block">
              {qualityReport.missingPriceCount}
            </span>
          </button>

          {/* 3. Missing Generic */}
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setFilters((prev) => ({
                ...prev,
                qualityFilter:
                  prev.qualityFilter === 'missing_generic' ? 'all' : 'missing_generic',
              }));
            }}
            className={`min-h-[76px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              filters.qualityFilter === 'missing_generic'
                ? 'bg-warning-soft border-warning'
                : 'bg-surface-2 border-border hover:border-warning/60'
            }`}
          >
            <span className="text-xs font-semibold text-text-muted block">
              জেনেরিক ছাড়া
            </span>
            <span className="text-2xl font-extrabold text-warning-text tabular-nums mt-1 block">
              {qualityReport.missingGenericCount}
            </span>
          </button>

          {/* 4. Suspected Duplicates */}
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setFilters((prev) => ({
                ...prev,
                qualityFilter:
                  prev.qualityFilter === 'duplicates' ? 'all' : 'duplicates',
              }));
            }}
            className={`min-h-[76px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              filters.qualityFilter === 'duplicates'
                ? 'bg-warning-soft border-warning'
                : 'bg-surface-2 border-border hover:border-warning/60'
            }`}
          >
            <span className="text-xs font-semibold text-text-muted block">
              সম্ভাব্য ডুপ্লিকেট
            </span>
            <span className="text-2xl font-extrabold text-warning-text tabular-nums mt-1 block">
              {qualityReport.suspectedDuplicateItemsCount}
            </span>
          </button>

          {/* 5. Test Data */}
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setFilters((prev) => ({
                ...prev,
                qualityFilter: prev.qualityFilter === 'test_data' ? 'all' : 'test_data',
              }));
            }}
            className={`min-h-[76px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              filters.qualityFilter === 'test_data'
                ? 'bg-danger-soft border-danger'
                : 'bg-surface-2 border-border hover:border-danger/60'
            }`}
          >
            <span className="text-xs font-semibold text-text-muted block">
              টেস্ট ডেটা
            </span>
            <span className="text-2xl font-extrabold text-danger-text tabular-nums mt-1 block">
              {qualityReport.testDataCount}
            </span>
          </button>
        </div>
      </section>

      {/* Duplicate Finder Mode */}
      {viewMode === 'duplicates' ? (
        <section className="bg-surface rounded-2xl border border-border p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-text">
                সম্ভাব্য ডুপ্লিকেট দল ({duplicateGroups.length}টি)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                একই ব্র্যান্ড নাম, মাত্রা ও কোম্পানির একাধিক রেকর্ড একসাথে দেখানো হচ্ছে।
              </p>
            </div>
            {duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={() => handleMarkDuplicatesKeepingOne()}
                className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 bg-warning hover:opacity-90 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer shrink-0"
              >
                <CheckSquare className="w-4 h-4" />
                <span>
                  একটি রেখে বাকিগুলো মার্ক করুন ({qualityReport.suspectedDuplicateExtraCount}টি)
                </span>
              </button>
            )}
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-text-muted">
              <ShieldCheck className="w-10 h-10 text-success-text mx-auto" />
              <p className="text-base font-bold text-text">
                কোনো ডুপ্লিকেট ওষুধ পাওয়া যায়নি
              </p>
              <p className="text-xs">আপনার লাইব্রেরি পরিষ্কার রয়েছে।</p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => {
                const extraIds = group.items
                  .filter((i) => i.id !== group.primaryId)
                  .map((i) => i.id);
                return (
                  <div
                    key={group.signature}
                    className="rounded-xl border border-border p-3.5 space-y-2.5 bg-surface-2/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-base font-bold text-text">
                          {group.brandName} ({group.strength})
                        </span>
                        <span className="text-xs text-text-muted block">
                          {group.manufacturer} · {group.items.length}টি রেকর্ড
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkDuplicatesKeepingOne(extraIds)}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-bold text-warning-text bg-warning-soft hover:opacity-90 rounded-lg cursor-pointer"
                      >
                        একটি রেখে বাকিগুলো মার্ক করুন
                      </button>
                    </div>

                    <div className="divide-y divide-border bg-surface rounded-lg border border-border">
                      {group.items.map((item) => {
                        const isPrimary = item.id === group.primaryId;
                        const isMarked = markedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className="p-3 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isMarked}
                                onChange={() => toggleRowMark(item.id)}
                                aria-label={`${item.brandName} মার্ক করুন`}
                                className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-sm text-text">
                                    {item.brandName}
                                  </span>
                                  {isPrimary && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-success-soft text-success-text">
                                      মূল (রাখার জন্য প্রস্তাবিত)
                                    </span>
                                  )}
                                  {item.status !== 'published' && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-warning-soft text-warning-text">
                                      খসড়া
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-muted">
                                  {item.genericName} · {item.dosageForm}
                                  {item.pricePerUnit !== undefined
                                    ? ` · ৳${item.pricePerUnit.toFixed(2)}`
                                    : ' · দাম নেই'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditGlobalMedicineModal(item)}
                                className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-text bg-surface-2 hover:bg-border/60 rounded-lg cursor-pointer"
                              >
                                সম্পাদনা
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteConfirmation([item])}
                                className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-danger-text bg-danger-soft hover:bg-danger/20 rounded-lg cursor-pointer"
                              >
                                মুছুন
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Search + Multi-Filter + Sort Panel */}
          <section className="bg-surface rounded-2xl border border-border p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="ব্র্যান্ড নাম, জেনেরিক বা কোম্পানি লিখুন..."
                  className="min-h-[48px] w-full pl-11 pr-20 py-2.5 rounded-xl bg-surface-2 border border-border text-base text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                    className="min-h-[44px] px-3 absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted hover:text-text cursor-pointer"
                  >
                    মুছুন
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: e.target.value as AdminLibraryFilters['sortBy'],
                    }))
                  }
                  aria-label="সাজানোর ক্রম"
                  className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-sm font-semibold text-text cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="name">সাজান: নাম অনুযায়ী</option>
                  <option value="company">সাজান: কোম্পানি অনুযায়ী</option>
                  <option value="recent">সাজান: সাম্প্রতিক যোগ করা</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                    showAdvancedFilters || activeChips.length > 0
                      ? 'bg-primary-soft border-primary text-primary'
                      : 'bg-surface-2 border-border text-text'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>ফিল্টার</span>
                </button>
              </div>
            </div>

            {/* Collapsible Multi-Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-border">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted block">
                    কোম্পানি
                  </label>
                  <select
                    value={filters.manufacturer}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, manufacturer: e.target.value }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="all">সকল কোম্পানি</option>
                    {uniqueManufacturers.map((mfg) => (
                      <option key={mfg} value={mfg}>
                        {mfg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted block">
                    ওষুধের ধরন
                  </label>
                  <select
                    value={filters.dosageForm}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dosageForm: e.target.value }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="all">সকল ধরন</option>
                    {uniqueDosageForms.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted block">
                    জেনেরিক নাম
                  </label>
                  <select
                    value={filters.genericName}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, genericName: e.target.value }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="all">সকল জেনেরিক</option>
                    {uniqueGenerics.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted block">
                    দামের অবস্থা
                  </label>
                  <select
                    value={filters.priceStatus}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        priceStatus: e.target.value as AdminLibraryFilters['priceStatus'],
                      }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="all">সবগুলো</option>
                    <option value="has_price">দাম আছে</option>
                    <option value="no_price">দাম নেই</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted block">
                    বিশেষ মান যাচাই
                  </label>
                  <select
                    value={filters.qualityFilter}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        qualityFilter: e.target.value as AdminLibraryFilters['qualityFilter'],
                      }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="all">সব ওষুধ</option>
                    <option value="missing_generic">জেনেরিক নাম নেই</option>
                    <option value="test_data">টেস্ট ডেটা</option>
                    <option value="duplicates">সম্ভাব্য ডুপ্লিকেট</option>
                    <option value="recent">সাম্প্রতিক যোগ করা (৭ দিন)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Active Removable Filter Chips */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <span className="text-xs font-semibold text-text-muted">
                  সক্রিয় ফিল্টার:
                </span>
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-soft border border-primary/25 text-xs font-semibold text-primary"
                  >
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={() => removeFilterChip(chip.key)}
                      className="px-1.5 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary font-bold cursor-pointer"
                    >
                      মুছুন
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_ADMIN_FILTERS)}
                  className="text-xs font-bold text-danger-text hover:underline px-2 py-1 cursor-pointer"
                >
                  সব মুছুন
                </button>
              </div>
            )}
          </section>

          {/* Selection & Result Count Bar */}
          <div className="bg-surface rounded-2xl border border-border p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleMarkCurrentPage}
                disabled={paginatedMedicines.length === 0}
                className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface-2 hover:bg-border/50 text-sm font-bold text-text cursor-pointer disabled:opacity-50"
              >
                {allOnPageMarked ? (
                  <CheckSquare className="w-5 h-5 text-primary" />
                ) : (
                  <Square className="w-5 h-5 text-text-muted" />
                )}
                <span>সব মার্ক করুন</span>
              </button>

              {filteredMedicines.length > paginatedMedicines.length && !allFilteredMarked && (
                <button
                  type="button"
                  onClick={markAllFiltered}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-primary-soft border border-primary/30 text-xs sm:text-sm font-bold text-primary hover:bg-primary/15 cursor-pointer"
                >
                  ফিল্টারে মিলে যাওয়া সব {filteredMedicines.length} টি ওষুধ মার্ক করুন
                </button>
              )}

              {markedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearAllMarks}
                  className="min-h-[44px] px-3 py-2 text-sm font-bold text-danger-text hover:underline cursor-pointer"
                >
                  মার্ক বাতিল ({markedIds.size})
                </button>
              )}
            </div>

            <div className="text-sm font-semibold text-text-muted tabular-nums">
              মোট {filteredMedicines.length}টি · পাতা {safePage}/{totalPages}
            </div>
          </div>

          {/* Medicine List: Table on Desktop, Touch Cards on Mobile */}
          {paginatedMedicines.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-3">
              <Pill className="w-10 h-10 text-text-muted mx-auto" />
              <h3 className="text-lg font-bold text-text">
                কোনো ওষুধ পাওয়া যায়নি
              </h3>
              <p className="text-sm text-text-muted">
                অনুসন্ধান বা ফিল্টার বদলে আবার চেষ্টা করুন।
              </p>
              {activeChips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_ADMIN_FILTERS)}
                  className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl cursor-pointer"
                >
                  সব ফিল্টার মুছুন
                </button>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-xs font-bold text-text-muted">
                      <th className="py-3 px-4 w-12">মার্ক</th>
                      <th className="py-3 px-4">ওষুধ ও মাত্রা</th>
                      <th className="py-3 px-4">জেনেরিক নাম</th>
                      <th className="py-3 px-4">ধরন</th>
                      <th className="py-3 px-4">কোম্পানি</th>
                      <th className="py-3 px-4 text-right">দাম</th>
                      <th className="py-3 px-4 text-right">কাজ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {paginatedMedicines.map((med) => {
                      const isMarked = markedIds.has(med.id);
                      const isTest = isTestMedicine(med);
                      const missingGen = isMissingGeneric(med);
                      return (
                        <tr
                          key={med.id}
                          className={`hover:bg-surface-2/60 transition-colors ${
                            isMarked ? 'bg-primary-soft/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isMarked}
                              onChange={() => toggleRowMark(med.id)}
                              aria-label={`${med.brandName} মার্ক করুন`}
                              className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-text flex flex-wrap items-center gap-1.5">
                              <span>{med.brandName}</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-soft text-primary">
                                {med.strength}
                              </span>
                              {med.status !== 'published' && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-warning-soft text-warning-text">
                                  খসড়া
                                </span>
                              )}
                              {isTest && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-danger-soft text-danger-text">
                                  টেস্ট
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-text-muted">
                            {missingGen ? (
                              <span className="text-xs font-bold text-warning-text">
                                জেনেরিক নেই
                              </span>
                            ) : (
                              med.genericName
                            )}
                          </td>
                          <td className="py-3 px-4 text-text-muted">
                            {med.dosageForm}
                          </td>
                          <td className="py-3 px-4 text-text-muted max-w-[200px] truncate">
                            {med.manufacturer}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums">
                            {isMissingPrice(med) ? (
                              <span className="text-xs text-text-muted">নেই</span>
                            ) : (
                              <span className="text-primary">
                                ৳{med.pricePerUnit!.toFixed(2)}
                                {med.priceUnit ? ` / ${med.priceUnit}` : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditGlobalMedicineModal(med)}
                                className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-text bg-surface-2 hover:bg-border/60 rounded-lg cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>সম্পাদনা</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteConfirmation([med])}
                                className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-danger-text bg-danger-soft hover:bg-danger/20 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>মুছুন</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border">
                {paginatedMedicines.map((med) => {
                  const isMarked = markedIds.has(med.id);
                  return (
                    <div
                      key={med.id}
                      className={`p-4 space-y-3 ${
                        isMarked ? 'bg-primary-soft/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isMarked}
                          onChange={() => toggleRowMark(med.id)}
                          aria-label={`${med.brandName} মার্ক করুন`}
                          className="mt-1 w-6 h-6 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-base font-bold text-text">
                              {med.brandName}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-soft text-primary">
                              {med.strength}
                            </span>
                            {isTestMedicine(med) && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-danger-soft text-danger-text">
                                টেস্ট
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-muted">
                            {isMissingGeneric(med) ? 'জেনেরিক নেই' : med.genericName} ·{' '}
                            {med.dosageForm}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                            <span className="truncate">{med.manufacturer}</span>
                            <span className="font-bold text-primary tabular-nums">
                              {isMissingPrice(med)
                                ? 'দাম নেই'
                                : `৳${med.pricePerUnit!.toFixed(2)}${
                                    med.priceUnit ? ` / ${med.priceUnit}` : ''
                                  }`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-9">
                        <button
                          type="button"
                          onClick={() => openEditGlobalMedicineModal(med)}
                          className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-bold text-text bg-surface-2 rounded-xl cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteConfirmation([med])}
                          className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-bold text-danger-text bg-danger-soft rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>মুছুন</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-surface-2/60">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-surface font-bold text-sm text-text cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>আগের পাতা</span>
                  </button>

                  <span className="text-sm font-bold text-text-muted tabular-nums">
                    পাতা {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-surface font-bold text-sm text-text cursor-pointer disabled:opacity-40"
                  >
                    <span>পরের পাতা</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky Bulk Action Bar when >= 1 item marked */}
      {markedIds.size > 0 && (
        <div className="fixed bottom-[76px] md:bottom-4 left-3 right-3 z-40 max-w-5xl mx-auto">
          <div className="bg-[#1E1B4B] dark:bg-surface-2 text-white rounded-2xl border border-indigo-900/50 dark:border-border shadow-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm sm:text-base font-bold tabular-nums">
                {markedIds.size} টি মার্ক করা আছে
              </span>
              <button
                type="button"
                onClick={clearAllMarks}
                className="text-xs font-bold text-indigo-200 hover:text-white underline cursor-pointer sm:hidden"
              >
                মার্ক বাতিল
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openBulkDeleteConfirmation}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-danger hover:opacity-90 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>মুছুন</span>
              </button>

              <button
                type="button"
                onClick={() => openBulkEdit('price')}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-xs sm:text-sm cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                <span>দাম বদলান</span>
              </button>

              <button
                type="button"
                onClick={() => openBulkEdit('company')}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                <Building className="w-4 h-4" />
                <span>কোম্পানি বদলান</span>
              </button>

              <button
                type="button"
                onClick={() => openBulkEdit('form')}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>ধরন বদলান</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCsv(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-success hover:opacity-90 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>CSV রপ্তানি</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-lg w-full border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-danger-soft text-danger-text shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">
                  ওষুধ মুছে ফেলার নিশ্চিতকরণ
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  আপনি কি নিশ্চিতভাবে{' '}
                  <strong className="text-danger-text tabular-nums">
                    {deleteModal.items.length}
                  </strong>{' '}
                  টি ওষুধ লাইব্রেরি থেকে মুছে ফেলতে চান?
                </p>
              </div>
            </div>

            {/* First 5 Medicine Names */}
            <div className="bg-surface-2 rounded-2xl p-3.5 border border-border space-y-1.5 text-sm">
              <span className="text-xs font-bold text-text-muted block">
                মুছে ফেলা হবে (প্রথম {Math.min(5, deleteModal.items.length)}টি):
              </span>
              {deleteModal.items.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0"
                >
                  <span className="font-semibold text-text truncate">
                    {m.brandName} ({m.strength})
                  </span>
                  <span className="text-xs text-text-muted truncate max-w-[140px]">
                    {m.manufacturer}
                  </span>
                </div>
              ))}
              {deleteModal.items.length > 5 && (
                <p className="text-xs font-bold text-danger-text pt-1">
                  এবং আরও {deleteModal.items.length - 5}টি ওষুধ
                </p>
              )}
            </div>

            {/* Automatic Pre-Delete JSON Backup Option */}
            <label className="flex items-center gap-3 p-3 rounded-xl bg-primary-soft border border-primary/25 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteModal.downloadBackup}
                onChange={(e) =>
                  setDeleteModal((prev) => ({
                    ...prev,
                    downloadBackup: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold text-primary">
                মোছার আগে JSON ব্যাকআপ ফাইল স্বয়ংক্রিয়ভাবে ডাউনলোড করুন (সুপারিশকৃত)
              </span>
            </label>

            {/* Typed Confirmation when > 10 items */}
            {requiresTypedConfirm && (
              <div className="space-y-1.5 p-3 rounded-xl bg-danger-soft border border-danger/30">
                <label className="text-xs sm:text-sm font-bold text-danger-text block">
                  ১০টির বেশি ওষুধ মোছার জন্য নিচের ঘরে &quot;মুছুন&quot; শব্দটি লিখুন:
                </label>
                <input
                  type="text"
                  value={deleteModal.typedConfirm}
                  onChange={(e) =>
                    setDeleteModal((prev) => ({
                      ...prev,
                      typedConfirm: e.target.value,
                    }))
                  }
                  placeholder="মুছুন"
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-surface border border-danger/40 text-base font-bold text-text focus:outline-hidden focus:ring-2 focus:ring-danger"
                />
              </div>
            )}

            <p className="text-xs text-success-text font-medium">
              নিরাপত্তা নিশ্চয়তা: ব্যবহারকারীদের ব্যক্তিগত &quot;আমার ওষুধ&quot; তালিকায় কোনো পরিবর্তন হবে না।
            </p>

            {deleteModal.errorMessage && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-xs font-semibold text-danger-text">
                {deleteModal.errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteModal.isDeleting}
                onClick={() =>
                  setDeleteModal({
                    isOpen: false,
                    items: [],
                    downloadBackup: true,
                    typedConfirm: '',
                    isDeleting: false,
                    errorMessage: null,
                  })
                }
                className="min-h-[48px] px-5 py-2.5 text-sm font-bold text-text-muted hover:bg-surface-2 rounded-xl cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deleteModal.isDeleting || !isTypedConfirmValid}
                onClick={handleConfirmDelete}
                className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-danger hover:opacity-90 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deleteModal.isDeleting
                    ? 'মুছে ফেলা হচ্ছে...'
                    : `নিশ্চিতভাবে মুছুন (${deleteModal.items.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkEditModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveBulkEdit}
            className="bg-surface rounded-3xl max-w-lg w-full border border-border shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-text">
                  একসাথে তথ্য পরিবর্তন ({markedIds.size}টি ওষুধ)
                </h3>
                <p className="text-xs text-text-muted">
                  যে তথ্যগুলো পরিবর্তন করতে চান সেগুলোতে টিক দিন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkEditModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-xl text-text-muted hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Company */}
            <div className="p-3.5 rounded-2xl border border-border space-y-2">
              <label className="flex items-center gap-2.5 text-sm font-bold text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkEditModal.updateManufacturer}
                  onChange={(e) =>
                    setBulkEditModal((prev) => ({
                      ...prev,
                      updateManufacturer: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-primary focus:ring-primary"
                />
                <span>কোম্পানি বদলান</span>
              </label>
              {bulkEditModal.updateManufacturer && (
                <input
                  type="text"
                  list="bulk-mfg-list"
                  value={bulkEditModal.manufacturer}
                  onChange={(e) =>
                    setBulkEditModal((prev) => ({ ...prev, manufacturer: e.target.value }))
                  }
                  placeholder="নতুন কোম্পানির নাম লিখুন..."
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                />
              )}
              <datalist id="bulk-mfg-list">
                {uniqueManufacturers.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {/* Dosage Form */}
            <div className="p-3.5 rounded-2xl border border-border space-y-2">
              <label className="flex items-center gap-2.5 text-sm font-bold text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkEditModal.updateDosageForm}
                  onChange={(e) =>
                    setBulkEditModal((prev) => ({
                      ...prev,
                      updateDosageForm: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-primary focus:ring-primary"
                />
                <span>ওষুধের ধরন বদলান</span>
              </label>
              {bulkEditModal.updateDosageForm && (
                <select
                  value={bulkEditModal.dosageForm}
                  onChange={(e) =>
                    setBulkEditModal((prev) => ({ ...prev, dosageForm: e.target.value }))
                  }
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                >
                  {DOSAGE_FORM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Price & Unit */}
            <div className="p-3.5 rounded-2xl border border-border space-y-2">
              <label className="flex items-center gap-2.5 text-sm font-bold text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkEditModal.updatePrice}
                  onChange={(e) =>
                    setBulkEditModal((prev) => ({
                      ...prev,
                      updatePrice: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-primary focus:ring-primary"
                />
                <span>দাম ও একক বদলান</span>
              </label>
              {bulkEditModal.updatePrice && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-text-muted">
                      ৳
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkEditModal.pricePerUnit}
                      onChange={(e) =>
                        setBulkEditModal((prev) => ({
                          ...prev,
                          pricePerUnit: e.target.value,
                        }))
                      }
                      placeholder="দাম (যেমন: 2.50)"
                      className="min-h-[44px] w-full pl-8 pr-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                    />
                  </div>
                  <select
                    value={bulkEditModal.priceUnit}
                    onChange={(e) =>
                      setBulkEditModal((prev) => ({ ...prev, priceUnit: e.target.value }))
                    }
                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text"
                  >
                    <option value="">একক অপরিবর্তিত রাখুন</option>
                    {PRICE_UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        প্রতি {u}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={bulkEditModal.isSaving}
                onClick={() => setBulkEditModal((prev) => ({ ...prev, isOpen: false }))}
                className="min-h-[48px] px-5 py-2.5 text-sm font-bold text-text-muted hover:bg-surface-2 rounded-xl cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={bulkEditModal.isSaving}
                className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{bulkEditModal.isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সবগুলোতে প্রয়োগ করুন'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
