import React, { useState, useMemo, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine } from '../../types';
import { GlobalMedicineDetailModal } from './GlobalMedicineDetailModal';
import { AddToPersonalModal } from './AddToPersonalModal';
import { LIBRARY_PAGE_SIZE, paginateMedicines } from '../../utils/libraryRealtime';
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
  WifiOff,
  X,
  Star,
  History,
  SlidersHorizontal,
} from 'lucide-react';
import { isTestMedicine } from '../../utils/medicineImportParser';
import {
  ALPHABET_INDEX_LETTERS,
  findSameGenericAlternatives,
  getMedicineAlphabetLetter,
  loadLibraryFavoriteIds,
  loadRecentlyViewedIds,
  matchMedicineBilingualFuzzy,
  recordRecentlyViewedId,
  saveLibraryFavoriteIds,
} from '../../utils/libraryManagement';

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
    bulkPublishGlobalMedicinesAction,
    deleteGlobalMedicineAction,
    bulkDeleteGlobalMedicinesAction,
    openManualAddModal,
    lastSyncTime,
    isOnline,
    isGlobalFromCache,
    isCloudConnected,
    latestLibraryNotice,
    dismissLibraryNotice,
  } = useMedicine();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'has_price' | 'no_price'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'published' | 'pending' | 'all'>('published');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(LIBRARY_PAGE_SIZE);

  // Local persisted Favorites & Recently Viewed (zero Firestore cost)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadLibraryFavoriteIds());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => loadRecentlyViewedIds());

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = (e: React.MouseEvent | null, medId: string) => {
    if (e) e.stopPropagation();
    setFavoriteIds((prev) => {
      const exists = prev.includes(medId);
      const next = exists ? prev.filter((id) => id !== medId) : [medId, ...prev];
      saveLibraryFavoriteIds(next);
      return next;
    });
  };

  const handleOpenMedicineDetail = (med: GlobalMedicine) => {
    setSelectedGlobalMedForDetail(med);
    setRecentlyViewedIds((prev) => recordRecentlyViewedId(med.id, prev));
  };

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

  const roleScopedMedicines = useMemo(() => {
    return globalMedicines.filter((med) => {
      if (!isAdmin) {
        return med.status === 'published';
      }
      if (adminStatusFilter === 'published' && med.status !== 'published') {
        return false;
      }
      if (adminStatusFilter === 'pending' && med.status === 'published') {
        return false;
      }
      return true;
    });
  }, [globalMedicines, isAdmin, adminStatusFilter]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    roleScopedMedicines.forEach((m) => {
      set.add(getMedicineAlphabetLetter(m.brandName));
    });
    return set;
  }, [roleScopedMedicines]);

  const recentlyViewedMedicines = useMemo(() => {
    if (recentlyViewedIds.length === 0) return [];
    const byId = new Map(globalMedicines.map((m) => [m.id, m]));
    return recentlyViewedIds
      .map((id) => byId.get(id))
      .filter((m): m is GlobalMedicine => Boolean(m && (isAdmin || m.status === 'published')));
  }, [globalMedicines, recentlyViewedIds, isAdmin]);

  // Filter medicines using bilingual fuzzy search, letter index, favorites & price filter
  const { filteredMedicines, matchedByGenericSample } = useMemo(() => {
    const query = searchQuery.trim();
    const genericSampleMeds: GlobalMedicine[] = [];

    const scored: Array<{ med: GlobalMedicine; score: number }> = [];

    for (const med of roleScopedMedicines) {
      if (favoritesOnly && !favoriteIdSet.has(med.id)) continue;

      if (selectedLetter !== 'ALL' && getMedicineAlphabetLetter(med.brandName) !== selectedLetter) {
        continue;
      }

      if (selectedForm !== 'all' && med.dosageForm !== selectedForm) continue;
      if (selectedManufacturer !== 'all' && med.manufacturer !== selectedManufacturer) continue;

      if (priceFilter === 'has_price' && (med.pricePerUnit === undefined || med.pricePerUnit <= 0)) {
        continue;
      }
      if (priceFilter === 'no_price' && med.pricePerUnit !== undefined && med.pricePerUnit > 0) {
        continue;
      }

      if (selectedSource !== 'all') {
        if (selectedSource === 'DGDA' && med.source !== 'DGDA_GOV' && med.source !== 'DGDA_Official') continue;
        if (selectedSource === 'MANUFACTURER' && med.source !== 'MANUFACTURER') continue;
        if (selectedSource === 'INDEPENDENT' && med.source !== 'INDEPENDENT_VERIFIED') continue;
        if (selectedSource === 'MEDEX' && med.source !== 'MEDEX_LICENSED' && med.source !== 'MedEx') continue;
        if (selectedSource === 'DIMS' && med.source !== 'DIMS_LICENSED' && med.source !== 'DIMS') continue;
      }

      if (query) {
        const res = matchMedicineBilingualFuzzy(med, query);
        if (!res.matched) continue;
        if (res.matchType === 'generic') {
          genericSampleMeds.push(med);
        }
        scored.push({ med, score: res.score });
      } else {
        scored.push({ med, score: 1 });
      }
    }

    if (query) {
      scored.sort((a, b) => b.score - a.score || a.med.brandName.localeCompare(b.med.brandName));
    } else {
      scored.sort((a, b) => a.med.brandName.localeCompare(b.med.brandName));
    }

    const list = scored.map((s) => s.med);
    const sameGenericExtra =
      query && genericSampleMeds.length > 0
        ? findSameGenericAlternatives(
            globalMedicines,
            genericSampleMeds[0].genericName,
            undefined,
            10
          )
        : [];

    return {
      filteredMedicines: list,
      matchedByGenericSample: sameGenericExtra,
    };
  }, [
    roleScopedMedicines,
    globalMedicines,
    favoritesOnly,
    favoriteIdSet,
    selectedLetter,
    selectedForm,
    selectedManufacturer,
    priceFilter,
    selectedSource,
    searchQuery,
  ]);

  useEffect(() => {
    setVisibleCount(LIBRARY_PAGE_SIZE);
  }, [
    searchQuery,
    selectedForm,
    selectedManufacturer,
    selectedSource,
    priceFilter,
    favoritesOnly,
    selectedLetter,
    adminStatusFilter,
    isAdmin,
  ]);

  useEffect(() => {
    if (!latestLibraryNotice) return;
    const timer = setTimeout(() => {
      dismissLibraryNotice();
    }, 10000);
    return () => clearTimeout(timer);
  }, [latestLibraryNotice, dismissLibraryNotice]);

  const { visibleItems: visibleMedicines, remainingCount, hasMore } = useMemo(
    () => paginateMedicines(filteredMedicines, visibleCount),
    [filteredMedicines, visibleCount]
  );

  const isOfflineMode = !isOnline || (!isCloudConnected && isGlobalFromCache);

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
          সরকারি অনুমোদিত তালিকা
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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              ওষুধ লাইব্রেরি
            </h1>
            <span className="text-sm px-3 py-1 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              যাচাইকৃত তালিকা
            </span>
          </div>
          <p className="text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            সরকারি অনুমোদিত ওষুধের তালিকা। ওষুধের নাম বা কোম্পানির নাম দিয়ে খুঁজুন।
          </p>
        </div>

        {/* Live Sync Status & Quick Admin Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Small Live / Offline Indicator with Last Sync Time */}
          {isOfflineMode ? (
            <div
              className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs"
              role="status"
            >
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>অফলাইন, শেষ জানা তালিকা</span>
              </span>
              {lastSyncTime && (
                <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 border-l border-amber-200 dark:border-amber-800 pl-2">
                  শেষ সিঙ্ক: {lastSyncTime}
                </span>
              )}
            </div>
          ) : (
            <div
              className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs"
              role="status"
            >
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>লাইভ</span>
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 border-l border-emerald-200 dark:border-emerald-800 pl-2">
                {lastSyncTime ? `শেষ সিঙ্ক: ${lastSyncTime}` : 'সিঙ্ক হচ্ছে...'}
              </span>
            </div>
          )}

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openManualAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                title="ফরম পূরণ করে একটি নতুন ওষুধ সরাসরি লাইব্রেরিতে যোগ করুন"
              >
                <Plus className="w-4 h-4" />
                <span>+ ম্যানুয়ালি ওষুধ যোগ</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('admin-library')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                title="ওষুধ সম্পাদনা, ডুপ্লিকেট যাচাই ও নিরাপদ অপসারণ"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>ওষুধ ব্যবস্থাপনা</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('admin-dashboard')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>অ্যাডমিন ড্যাশবোর্ড</span>
              </button>
            </div>
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

      {/* Live New Medicine Arrival Notice */}
      {latestLibraryNotice && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs"
          role="status"
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>{latestLibraryNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={dismissLibraryNotice}
            className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 cursor-pointer"
            aria-label="বার্তা বন্ধ করুন"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                type="button"
                disabled={isBulkPublishing}
                onClick={async () => {
                  const pendingMeds = globalMedicines.filter((m) => m.status !== 'published' || !m.verifiedByAdmin);
                  if (pendingMeds.length === 0) return;
                  setIsBulkPublishing(true);
                  const success = await bulkPublishGlobalMedicinesAction(pendingMeds.map((m) => m.id));
                  if (success) {
                    setAdminStatusFilter('published');
                  }
                  setIsBulkPublishing(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="সকল অপেক্ষমাণ খসড়া সরাসরি অনুমোদন দিয়ে লাইব্রেরিতে প্রকাশ করুন যাতে অন্য সব ফোনেও তাৎক্ষণিক দেখা যায়"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isBulkPublishing
                    ? 'প্রকাশ হচ্ছে...'
                    : `সকল খসড়া (${pendingCount} টি) লাইব্রেরিতে প্রকাশ করুন`}
                </span>
              </button>
            )}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="hidden sm:inline">অপেক্ষমাণ খসড়া সাধারণ ব্যবহারকারীদের জন্য লুকানো থাকে।</span>
            </div>
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

      {/* Search and Collapsible Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input (Bilingual Bangla + English Fuzzy) */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="বাংলা বা ইংরেজিতে ওষুধ, জেনেরিক বা কোম্পানি লিখুন (যেমন: নাপা, Paracetamol)..."
              className="min-h-[48px] w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-11 pr-20 py-2.5 text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="min-h-[48px] px-3 absolute right-1 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                মুছুন
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
              favoritesOnly
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100'
            }`}
          >
            <Star className={`w-5 h-5 ${favoritesOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>পছন্দের ({favoriteIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
            className={`min-h-[48px] px-5 py-2.5 rounded-xl border text-base font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
              showFilters ||
              selectedForm !== 'all' ||
              selectedManufacturer !== 'all' ||
              selectedSource !== 'all' ||
              priceFilter !== 'all'
                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-900 dark:text-teal-200'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>ফিল্টার</span>
          </button>
        </div>

        {/* Filter Selectors Fold */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-base">
            {/* Dosage Form Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                ওষুধের ধরন
              </label>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="min-h-[48px] w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-slate-100 focus:outline-hidden"
              >
                <option value="all">সকল ধরন</option>
                {uniqueForms.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
              </select>
            </div>

            {/* Manufacturer Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                কোম্পানি
              </label>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className="min-h-[48px] w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-slate-100 focus:outline-hidden truncate"
              >
                <option value="all">সকল কোম্পানি</option>
                {uniqueManufacturers.map((mfg) => (
                  <option key={mfg} value={mfg}>
                    {mfg}
                  </option>
                ))}
              </select>
            </div>

            {/* Has Price Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                দামের অবস্থা
              </label>
              <select
                value={priceFilter}
                onChange={(e) =>
                  setPriceFilter(e.target.value as 'all' | 'has_price' | 'no_price')
                }
                className="min-h-[48px] w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-slate-100 focus:outline-hidden"
              >
                <option value="all">সব ওষুধ</option>
                <option value="has_price">দাম আছে</option>
                <option value="no_price">দাম উল্লেখ নেই</option>
              </select>
            </div>

            {/* Source Profile Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                উৎস
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="min-h-[48px] w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-slate-100 focus:outline-hidden"
              >
                <option value="all">সকল উৎস</option>
                <option value="DGDA">সরকারি অনুমোদিত তালিকা</option>
                <option value="MANUFACTURER">প্রস্তুতকারকের তথ্য</option>
                <option value="INDEPENDENT">চিকিৎসা যাচাইকৃত</option>
                <option value="MEDEX">স্বীকৃত তালিকা (মেডেক্স)</option>
                <option value="DIMS">স্বীকৃত তালিকা (ডিমস)</option>
              </select>
            </div>
          </div>
        )}

        {/* A–Z Quick Jump Bar */}
        {roleScopedMedicines.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
              বর্ণক্রম:
            </span>
            <button
              type="button"
              onClick={() => setSelectedLetter('ALL')}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                selectedLetter === 'ALL'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              সব
            </button>
            {ALPHABET_INDEX_LETTERS.map((letter) => {
              const hasItems = availableLetters.has(letter);
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!hasItems && !isSelected}
                  onClick={() => setSelectedLetter((prev) => (prev === letter ? 'ALL' : letter))}
                  className={`min-h-[36px] min-w-[32px] px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-teal-700 text-white cursor-pointer'
                      : hasItems
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/60 cursor-pointer'
                      : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Viewed Strip ("সম্প্রতি দেখা") */}
      {recentlyViewedMedicines.length > 0 && !searchQuery && !favoritesOnly && selectedLetter === 'ALL' && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 px-1">
            <History className="w-4 h-4 text-teal-600" />
            <span>সম্প্রতি দেখা</span>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {recentlyViewedMedicines.slice(0, 8).map((med) => (
              <button
                key={`recent_${med.id}`}
                type="button"
                onClick={() => handleOpenMedicineDetail(med)}
                className="min-w-[180px] max-w-[220px] p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 text-left shrink-0 cursor-pointer transition-colors"
              >
                <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                  {med.brandName} ({med.strength})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                  {med.genericName}
                </span>
                {med.pricePerUnit !== undefined && (
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300 mt-1 block tabular-nums">
                    ৳{med.pricePerUnit.toFixed(2)}
                    {med.priceUnit ? ` / ${med.priceUnit}` : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Same Generic Alternatives Highlight when searching by generic name */}
      {searchQuery.trim() && matchedByGenericSample.length > 0 && (
        <section className="bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl p-4 border border-teal-200 dark:border-teal-900/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-teal-950 dark:text-teal-200">
              একই উপাদানের অন্যান্য ব্র্যান্ড ({matchedByGenericSample[0].genericName})
            </h2>
            <span className="text-xs text-teal-800 dark:text-teal-300">
              দাম অনুযায়ী সাজানো
            </span>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {matchedByGenericSample.map((alt) => (
              <button
                key={`gen_alt_${alt.id}`}
                type="button"
                onClick={() => handleOpenMedicineDetail(alt)}
                className="min-w-[190px] max-w-[230px] p-3 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 hover:border-teal-500 text-left shrink-0 cursor-pointer transition-colors"
              >
                <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                  {alt.brandName} ({alt.strength})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                  {alt.manufacturer}
                </span>
                <span className="text-xs font-bold text-teal-700 dark:text-teal-300 mt-1 block tabular-nums">
                  {alt.pricePerUnit !== undefined
                    ? `৳${alt.pricePerUnit.toFixed(2)}${alt.priceUnit ? ` / ${alt.priceUnit}` : ''}`
                    : alt.dosageForm}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-base text-slate-700 dark:text-slate-300 px-1">
        <span>
          পাওয়া গেছে: <strong className="text-slate-900 dark:text-white font-bold tabular-nums">{filteredMedicines.length}</strong> টি ওষুধ
          {hasMore && (
            <span className="text-slate-500 dark:text-slate-400"> (দেখানো হচ্ছে {visibleMedicines.length} টি)</span>
          )}
          {isAdmin && adminStatusFilter === 'pending' && ' (অপেক্ষমাণ খসড়া)'}
        </span>
        {(searchQuery ||
          selectedForm !== 'all' ||
          selectedManufacturer !== 'all' ||
          selectedSource !== 'all' ||
          priceFilter !== 'all' ||
          favoritesOnly ||
          selectedLetter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedForm('all');
              setSelectedManufacturer('all');
              setSelectedSource('all');
              setPriceFilter('all');
              setFavoritesOnly(false);
              setSelectedLetter('ALL');
            }}
            className="min-h-[48px] px-3 text-teal-800 dark:text-teal-300 hover:underline font-bold cursor-pointer"
          >
            সব দেখান
          </button>
        )}
      </div>

      {/* Medicines Grid */}
      {filteredMedicines.length > 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleMedicines.map((med) => {
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
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                          {med.strength}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(e, med.id)}
                          aria-label={favoriteIdSet.has(med.id) ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            favoriteIdSet.has(med.id)
                              ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${favoriteIdSet.has(med.id) ? 'fill-amber-500' : ''}`} />
                        </button>
                      </div>
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
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">খুচরা মূল্য:</span>
                        <span className="font-bold text-teal-800 dark:text-teal-300 tabular-nums">
                          ৳ {med.pricePerUnit.toFixed(2)}
                          {med.priceUnit ? ` / ${med.priceUnit}` : ''}
                        </span>
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
                      <span className="truncate max-w-[120px]" title={med.darNumber}>
                        নিবন্ধন: {med.darNumber}
                      </span>
                    )}
                  </div>
                </div>

                  {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMedicineDetail(med)}
                    className="min-h-[48px] flex-1 py-2.5 px-3 text-base font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-center"
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
                        className="min-h-[48px] flex items-center justify-center gap-1 py-2.5 px-4 text-base font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                        title="যাচাই ও সার্বজনীন প্রকাশ করুন"
                      >
                        <Check className="w-4 h-4" />
                        <span>{publishingId === med.id ? 'প্রকাশ হচ্ছে...' : 'অনুমোদন'}</span>
                      </button>

                      {/* Safe Delete Option for Draft TEST DATA */}
                      <button
                        type="button"
                        onClick={(e) => promptSingleDelete(e, med)}
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shrink-0"
                        title="এই রেকর্ডটি মুছে ফেলুন"
                        aria-label={`${med.brandName} মুছে ফেলুন`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAddToPersonalModal(med)}
                      className="min-h-[48px] flex items-center justify-center gap-1.5 py-2.5 px-4 text-base font-bold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                      title="আমার ওষুধ তালিকায় যোগ করুন"
                    >
                      <Plus className="w-5 h-5" />
                      <span>যোগ করুন</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LIBRARY_PAGE_SIZE)}
                className="min-h-[48px] inline-flex items-center gap-2 px-7 py-3 text-base font-bold text-teal-900 dark:text-teal-100 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/70 dark:hover:bg-teal-900/70 border border-teal-300 dark:border-teal-800 rounded-2xl shadow-xs transition-colors cursor-pointer"
              >
                <span>আরও দেখান</span>
                <span className="text-sm font-semibold opacity-85">
                  ({remainingCount} টি বাকি)
                </span>
              </button>
            </div>
          )}
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
                ? 'অনুমোদিত ওষুধ তালিকা যুক্ত করা হলে ক্যাটালগটি এখানে প্রদর্শিত হবে।'
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
        allMedicines={globalMedicines}
        isFavorite={
          selectedGlobalMedForDetail
            ? favoriteIdSet.has(selectedGlobalMedForDetail.id)
            : false
        }
        onToggleFavorite={(id) => toggleFavorite(null, id)}
        onSelectMedicine={(med) => handleOpenMedicineDetail(med)}
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
