import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useDeferredValue,
  useTransition,
} from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine } from '../../types';
import { GlobalMedicineDetailModal } from './GlobalMedicineDetailModal';
import { AddToPersonalModal } from './AddToPersonalModal';
import { LibrarySearchInput } from './LibrarySearchInput';
import { LibraryMedicineCard } from './LibraryMedicineCard';
import { LIBRARY_PAGE_SIZE, paginateMedicines } from '../../utils/libraryRealtime';
import {
  Filter,
  Plus,
  BookOpen,
  UploadCloud,
  Info,
  Check,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  WifiOff,
  X,
  Star,
  History,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { isTestMedicine } from '../../utils/medicineImportParser';
import {
  ALPHABET_INDEX_LETTERS,
  findSameGenericAlternatives,
  loadLibraryFavoriteIds,
  loadRecentlyViewedIds,
  recordRecentlyViewedId,
  saveLibraryFavoriteIds,
} from '../../utils/libraryManagement';
import {
  computeLibraryMetadata,
  getOrBuildLibrarySearchIndex,
  LibrarySearchFilters,
  LibrarySearchIndex,
  quickBasicSearchMedicines,
  searchIndexedMedicines,
} from '../../utils/librarySearchIndex';

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
  const [isSearchTransitionPending, startSearchTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'has_price' | 'no_price'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'published' | 'pending' | 'all'>(
    'published'
  );
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(LIBRARY_PAGE_SIZE);

  // Module-cached search index (non-blocking 500-item idle batches on cold load, incremental updates on edit/import/delete)
  const [readyIndex, setReadyIndex] = useState<LibrarySearchIndex | null>(() =>
    getOrBuildLibrarySearchIndex(globalMedicines, (built) => {
      setReadyIndex(built);
    })
  );

  useEffect(() => {
    const syncOrCached = getOrBuildLibrarySearchIndex(globalMedicines, (built) => {
      setReadyIndex(built);
    });
    if (syncOrCached) {
      setReadyIndex(syncOrCached);
    }
  }, [globalMedicines]);

  // Cached metadata (uniqueManufacturers, uniqueForms, availableLetters, counts)
  const libraryMetadata = useMemo(
    () =>
      readyIndex && readyIndex.totalCount === globalMedicines.length
        ? readyIndex
        : computeLibraryMetadata(globalMedicines),
    [readyIndex, globalMedicines]
  );

  const { uniqueManufacturers, uniqueForms, publishedCount, pendingCount } = libraryMetadata;

  const availableLetters = useMemo(() => {
    if (!isAdmin) return libraryMetadata.availableLettersPublished;
    if (adminStatusFilter === 'published') return libraryMetadata.availableLettersPublished;
    if (adminStatusFilter === 'pending') return libraryMetadata.availableLettersPending;
    return libraryMetadata.availableLettersAll;
  }, [libraryMetadata, isAdmin, adminStatusFilter]);

  const roleScopedCount = !isAdmin
    ? publishedCount
    : adminStatusFilter === 'published'
    ? publishedCount
    : adminStatusFilter === 'pending'
    ? pendingCount
    : globalMedicines.length;

  // Local persisted Favorites & Recently Viewed (zero Firestore cost)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadLibraryFavoriteIds());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    loadRecentlyViewedIds()
  );

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = useCallback((e: React.MouseEvent | null, medId: string) => {
    if (e) e.stopPropagation();
    setFavoriteIds((prev) => {
      const exists = prev.includes(medId);
      const next = exists ? prev.filter((id) => id !== medId) : [medId, ...prev];
      saveLibraryFavoriteIds(next);
      return next;
    });
  }, []);

  const handleOpenMedicineDetail = useCallback(
    (med: GlobalMedicine) => {
      setSelectedGlobalMedForDetail(med);
      setRecentlyViewedIds((prev) => recordRecentlyViewedId(med.id, prev));
    },
    [setSelectedGlobalMedForDetail]
  );

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

  const recentlyViewedMedicines = useMemo(() => {
    if (recentlyViewedIds.length === 0) return [];
    const byId = new Map<string, GlobalMedicine>();
    for (let i = 0; i < globalMedicines.length; i++) {
      const m = globalMedicines[i];
      byId.set(m.id, m);
    }
    return recentlyViewedIds
      .map((id) => byId.get(id))
      .filter((m): m is GlobalMedicine => Boolean(m && (isAdmin || m.status === 'published')));
  }, [globalMedicines, recentlyViewedIds, isAdmin]);

  const handleDebouncedSearchChange = useCallback((nextValue: string) => {
    startSearchTransition(() => {
      setSearchQuery(nextValue);
    });
  }, []);

  // Multi-stage fast indexed search (falls back to lightweight basic search while cold index builds in background)
  const { filteredMedicines, matchedByGenericSample } = useMemo(() => {
    const query = deferredSearchQuery.trim();
    const filters: LibrarySearchFilters = {
      isAdmin,
      adminStatusFilter,
      favoritesOnly,
      favoriteIdSet,
      selectedLetter,
      selectedForm,
      selectedManufacturer,
      priceFilter,
      selectedSource,
    };

    const searchResult =
      readyIndex && readyIndex.totalCount === globalMedicines.length
        ? searchIndexedMedicines(readyIndex, filters, query)
        : quickBasicSearchMedicines(globalMedicines, filters, query);

    const sameGenericExtra =
      query && searchResult.firstGenericMatch
        ? findSameGenericAlternatives(
            globalMedicines,
            searchResult.firstGenericMatch.genericName,
            undefined,
            10
          )
        : [];

    return {
      filteredMedicines: searchResult.medicines,
      matchedByGenericSample: sameGenericExtra,
    };
  }, [
    readyIndex,
    globalMedicines,
    isAdmin,
    adminStatusFilter,
    favoritesOnly,
    favoriteIdSet,
    selectedLetter,
    selectedForm,
    selectedManufacturer,
    priceFilter,
    selectedSource,
    deferredSearchQuery,
  ]);

  useEffect(() => {
    setVisibleCount(LIBRARY_PAGE_SIZE);
  }, [
    deferredSearchQuery,
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
  const isSearchStale = isSearchTransitionPending || searchQuery !== deferredSearchQuery;

  // Quick verify & publish by admin
  const handleQuickPublish = useCallback(
    async (e: React.MouseEvent, medId: string) => {
      e.stopPropagation();
      setPublishingId(medId);
      const success = await publishGlobalMedicineAction(medId);
      if (success) {
        setAdminStatusFilter('published');
      }
      setPublishingId(null);
    },
    [publishGlobalMedicineAction]
  );

  // Safe Deletion Handlers for Draft TEST DATA
  const toggleDraftSelection = useCallback((id: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllTestDrafts = () => {
    const testDrafts = filteredMedicines.filter(
      (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
    );
    const testDraftIds = testDrafts.map((m) => m.id);
    const allSelected =
      testDraftIds.length > 0 && testDraftIds.every((id) => selectedDraftIds.has(id));
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

  const promptSingleDelete = useCallback((e: React.MouseEvent, med: GlobalMedicine) => {
    e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      medicines: [med],
      isDeleting: false,
    });
  }, []);

  const promptBulkDelete = () => {
    const selectedMeds = globalMedicines.filter(
      (m) =>
        selectedDraftIds.has(m.id) &&
        (m.status !== 'published' || !m.verifiedByAdmin || isTestMedicine(m))
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

  const handleCardToggleFavorite = useCallback(
    (e: React.MouseEvent, medId: string) => {
      toggleFavorite(e, medId);
    },
    [toggleFavorite]
  );

  const handleModalToggleFavorite = useCallback(
    (medId: string) => {
      toggleFavorite(null, medId);
    },
    [toggleFavorite]
  );

  const handleResetAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedForm('all');
    setSelectedManufacturer('all');
    setSelectedSource('all');
    setPriceFilter('all');
    setFavoritesOnly(false);
    setSelectedLetter('ALL');
  }, []);

  const hasActiveFilter =
    Boolean(searchQuery) ||
    selectedForm !== 'all' ||
    selectedManufacturer !== 'all' ||
    selectedSource !== 'all' ||
    priceFilter !== 'all' ||
    favoritesOnly ||
    selectedLetter !== 'ALL';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary-soft text-primary">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">ওষুধ লাইব্রেরি</h1>
            <span className="text-sm px-3 py-1 rounded-full font-semibold bg-success-soft text-success-text border border-success/30 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              যাচাইকৃত তালিকা
            </span>
          </div>
          <p className="text-base text-text-muted mt-1 max-w-2xl">
            সরকারি অনুমোদিত ওষুধের তালিকা। ওষুধের নাম বা কোম্পানির নাম দিয়ে খুঁজুন।
          </p>
        </div>

        {/* Live Sync Status & Quick Admin Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isOfflineMode ? (
            <div
              className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-warning-soft border border-warning/35 text-xs"
              role="status"
            >
              <span className="inline-flex items-center gap-1.5 font-semibold text-warning-text">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>অফলাইন, শেষ জানা তালিকা</span>
              </span>
              {lastSyncTime && (
                <span className="text-[11px] text-warning-text/90 border-l border-warning/35 pl-2">
                  শেষ সিঙ্ক: {lastSyncTime}
                </span>
              )}
            </div>
          ) : (
            <div
              className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-success-soft border border-success/30 text-xs"
              role="status"
            >
              <span className="inline-flex items-center gap-1.5 font-bold text-success-text">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span>লাইভ</span>
              </span>
              <span className="text-[11px] text-success-text/90 border-l border-success/30 pl-2">
                {lastSyncTime ? `শেষ সিঙ্ক: ${lastSyncTime}` : 'সিঙ্ক হচ্ছে...'}
              </span>
            </div>
          )}

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openManualAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#15803D] hover:bg-[#166534] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                title="ফরম পূরণ করে একটি নতুন ওষুধ সরাসরি লাইব্রেরিতে যোগ করুন"
              >
                <Plus className="w-4 h-4" />
                <span>+ হাতে ওষুধ যোগ</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('admin-library')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-surface-2 hover:bg-border text-text border border-border rounded-xl shadow-xs transition-colors cursor-pointer"
                title="ওষুধ সম্পাদনা, ডুপ্লিকেট যাচাই ও নিরাপদ অপসারণ"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>ওষুধ ব্যবস্থাপনা</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('admin-dashboard')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-on-primary rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>অ্যাডমিন ড্যাশবোর্ড</span>
              </button>
            </div>
          ) : (
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-text-muted block">অনুমোদিত ওষুধ সংখ্যা</span>
              <span className="text-lg font-bold text-primary">{publishedCount} টি</span>
            </div>
          )}
        </div>
      </div>

      {/* Live New Medicine Arrival Notice */}
      {latestLibraryNotice && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-success-soft border border-success/30 text-xs text-success-text shadow-xs"
          role="status"
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2 w-2 rounded-full bg-success shrink-0"></span>
            <span>{latestLibraryNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={dismissLibraryNotice}
            className="p-1 rounded-lg hover:bg-success/15 text-success-text cursor-pointer"
            aria-label="বার্তা বন্ধ করুন"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Publication Filter Bar */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl border border-border text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">প্রশাসক ফিল্টার:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
              <button
                type="button"
                onClick={() => setAdminStatusFilter('published')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'published'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                প্রকাশিত ওষুধ ({publishedCount})
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('pending')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'pending'
                    ? 'bg-[#B45309] text-white shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                অপেক্ষমাণ খসড়া ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  adminStatusFilter === 'all'
                    ? 'bg-surface-2 text-text font-bold border border-border shadow-xs'
                    : 'text-text-muted hover:text-text'
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
                  const pendingMeds = globalMedicines.filter(
                    (m) => m.status !== 'published' || !m.verifiedByAdmin
                  );
                  if (pendingMeds.length === 0) return;
                  setIsBulkPublishing(true);
                  const success = await bulkPublishGlobalMedicinesAction(
                    pendingMeds.map((m) => m.id)
                  );
                  if (success) {
                    setAdminStatusFilter('published');
                  }
                  setIsBulkPublishing(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
            <div className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">অপেক্ষমাণ খসড়া সাধারণ ব্যবহারকারীদের জন্য লুকানো থাকে।</span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Draft / Unpublished Queue TEST DATA Bulk Management Toolbar */}
      {isAdmin && (adminStatusFilter === 'pending' || selectedDraftIds.size > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-danger-soft rounded-2xl border border-danger/35 shadow-xs text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllTestDrafts}
              className="flex items-center gap-2 font-semibold text-text hover:text-danger-text cursor-pointer"
            >
              {(() => {
                const testDrafts = filteredMedicines.filter(
                  (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
                );
                const allSelected =
                  testDrafts.length > 0 && testDrafts.every((m) => selectedDraftIds.has(m.id));
                return allSelected ? (
                  <CheckSquare className="w-4 h-4 text-danger-text" />
                ) : (
                  <Square className="w-4 h-4 text-text-muted" />
                );
              })()}
              <span>
                সকল খসড়া টেস্ট তথ্য নির্বাচন (
                {
                  filteredMedicines.filter(
                    (m) => (m.status !== 'published' || !m.verifiedByAdmin) && isTestMedicine(m)
                  ).length
                }{' '}
                টি)
              </span>
            </button>

            {selectedDraftIds.size > 0 && (
              <span className="text-[11px] font-medium text-text-muted">
                নির্বাচিত:{' '}
                <strong className="text-danger-text font-bold">{selectedDraftIds.size}</strong> টি
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {selectedDraftIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDraftIds(new Set())}
                className="px-2.5 py-1 text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer"
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
                  ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                  : 'bg-surface-2 text-text-muted cursor-not-allowed'
              }`}
              title="নির্বাচিত টেস্ট রেকর্ড নিরাপদে মুছে ফেলুন"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {selectedDraftIds.size > 0
                  ? `নির্বাচিত ${selectedDraftIds.size} টি টেস্ট তথ্য মুছুন`
                  : 'একসাথে মুছুন'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Search and Collapsible Filters Bar */}
      <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Isolated Debounced Search Input */}
          <LibrarySearchInput
            value={searchQuery}
            onDebouncedChange={handleDebouncedSearchChange}
            isSearching={isSearchStale}
            debounceMs={200}
          />

          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-base font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
              favoritesOnly
                ? 'bg-warning-soft border-warning text-warning-text'
                : 'bg-surface-2 border-border text-text hover:bg-border/40'
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
                ? 'bg-primary-soft border-primary text-primary'
                : 'bg-surface-2 border-border text-text hover:bg-border/40'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>ফিল্টার</span>
          </button>
        </div>

        {/* Filter Selectors Fold */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border text-base">
            {/* Dosage Form Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-text block">ওষুধের ধরন</label>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="min-h-[48px] w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base text-text focus:outline-hidden"
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
              <label className="text-sm font-semibold text-text block">কোম্পানি</label>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className="min-h-[48px] w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base text-text focus:outline-hidden truncate"
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
              <label className="text-sm font-semibold text-text block">দামের অবস্থা</label>
              <select
                value={priceFilter}
                onChange={(e) =>
                  setPriceFilter(e.target.value as 'all' | 'has_price' | 'no_price')
                }
                className="min-h-[48px] w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base text-text focus:outline-hidden"
              >
                <option value="all">সব ওষুধ</option>
                <option value="has_price">দাম আছে</option>
                <option value="no_price">দাম উল্লেখ নেই</option>
              </select>
            </div>

            {/* Source Profile Filter */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-text block">উৎস</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="min-h-[48px] w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base text-text focus:outline-hidden"
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
        {roleScopedCount > 0 && (
          <div className="pt-2 border-t border-border flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-text-muted shrink-0 mr-1">বর্ণক্রম:</span>
            <button
              type="button"
              onClick={() => setSelectedLetter('ALL')}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                selectedLetter === 'ALL'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-2 text-text-muted hover:text-text hover:bg-border/50'
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
                      ? 'bg-primary text-on-primary cursor-pointer'
                      : hasItems
                      ? 'bg-surface-2 text-text hover:bg-primary-soft hover:text-primary cursor-pointer'
                      : 'text-text-muted/35 cursor-not-allowed'
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
      {recentlyViewedMedicines.length > 0 &&
        !deferredSearchQuery &&
        !favoritesOnly &&
        selectedLetter === 'ALL' && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-text px-1">
              <History className="w-4 h-4 text-primary" />
              <span>সম্প্রতি দেখা</span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {recentlyViewedMedicines.slice(0, 8).map((med) => (
                <button
                  key={`recent_${med.id}`}
                  type="button"
                  onClick={() => handleOpenMedicineDetail(med)}
                  className="min-w-[180px] max-w-[220px] p-3 rounded-xl bg-surface border border-border hover:border-primary text-left shrink-0 cursor-pointer transition-colors"
                >
                  <span className="text-sm font-bold text-text block truncate">
                    {med.brandName} ({med.strength})
                  </span>
                  <span className="text-xs text-text-muted block truncate">{med.genericName}</span>
                  {med.pricePerUnit !== undefined && (
                    <span className="text-xs font-bold text-primary mt-1 block tabular-nums">
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
      {deferredSearchQuery.trim() && matchedByGenericSample.length > 0 && (
        <section className="bg-primary-soft/60 rounded-2xl p-4 border border-primary/25 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-text">
              একই উপাদানের অন্যান্য ব্র্যান্ড ({matchedByGenericSample[0].genericName})
            </h2>
            <span className="text-xs text-primary font-semibold">দাম অনুযায়ী সাজানো</span>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {matchedByGenericSample.map((alt) => (
              <button
                key={`gen_alt_${alt.id}`}
                type="button"
                onClick={() => handleOpenMedicineDetail(alt)}
                className="min-w-[190px] max-w-[230px] p-3 rounded-xl bg-surface border border-primary/25 hover:border-primary text-left shrink-0 cursor-pointer transition-colors"
              >
                <span className="text-sm font-bold text-text block truncate">
                  {alt.brandName} ({alt.strength})
                </span>
                <span className="text-xs text-text-muted block truncate">{alt.manufacturer}</span>
                <span className="text-xs font-bold text-primary mt-1 block tabular-nums">
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-base text-text-muted px-1">
        <span>
          পাওয়া গেছে:{' '}
          <strong className="text-text font-bold tabular-nums">{filteredMedicines.length}</strong>{' '}
          টি ওষুধ
          {hasMore && (
            <span className="text-text-muted"> (দেখানো হচ্ছে {visibleMedicines.length} টি)</span>
          )}
          {isAdmin && adminStatusFilter === 'pending' && ' (অপেক্ষমাণ খসড়া)'}
        </span>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleResetAllFilters}
            className="min-h-[48px] px-3 text-primary hover:underline font-bold cursor-pointer"
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
                <LibraryMedicineCard
                  key={med.id}
                  med={med}
                  isAdmin={isAdmin}
                  isFavorite={favoriteIdSet.has(med.id)}
                  isUnpublished={isUnpublished}
                  isTest={isTest}
                  isDraftSelected={selectedDraftIds.has(med.id)}
                  isPublishing={publishingId === med.id}
                  onToggleFavorite={handleCardToggleFavorite}
                  onToggleDraftSelection={toggleDraftSelection}
                  onOpenDetail={handleOpenMedicineDetail}
                  onQuickPublish={handleQuickPublish}
                  onPromptDelete={promptSingleDelete}
                  onAddToPersonal={openAddToPersonalModal}
                />
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LIBRARY_PAGE_SIZE)}
                className="min-h-[48px] inline-flex items-center gap-2 px-7 py-3 text-base font-bold text-primary bg-primary-soft hover:bg-primary/15 border border-primary/30 rounded-2xl shadow-xs transition-colors cursor-pointer"
              >
                <span>আরও দেখান</span>
                <span className="text-sm font-semibold opacity-85">({remainingCount} টি বাকি)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State with friendly Bengali spelling suggestion */
        <div className="bg-surface rounded-2xl p-10 border border-border text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto shadow-xs">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-text">
              {globalMedicines.length === 0
                ? 'ওষুধ লাইব্রেরি বর্তমানে খালি রয়েছে'
                : isAdmin && adminStatusFilter === 'pending' && pendingCount === 0
                ? 'কোনো অপেক্ষমাণ খসড়া নেই'
                : 'কোনো ওষুধ খুঁজে পাওয়া যায়নি'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {globalMedicines.length === 0
                ? 'অনুমোদিত ওষুধ তালিকা যুক্ত করা হলে তালিকাটি এখানে প্রদর্শিত হবে।'
                : isAdmin && adminStatusFilter === 'pending' && pendingCount === 0
                ? 'আপনার সকল ওষুধ অনুমোদিত ও প্রকাশিত হয়েছে। আপনি "প্রকাশিত ওষুধ" অংশে সব দেখতে পাবেন।'
                : deferredSearchQuery.trim()
                ? `"${deferredSearchQuery.trim()}" নামে কোনো মিল পাওয়া যায়নি। অনুগ্রহ করে বানান একটু পরিবর্তন করে অথবা ওষুধের সংক্ষিপ্ত নাম (যেমন: নাপা, Paracetamol, Seclo) লিখে আবার খুঁজুন।`
                : 'আপনার বাছাই করা ফিল্টার শর্ত অনুযায়ী কোনো ওষুধ পাওয়া যায়নি। ফিল্টার বাতিল করে আবার চেষ্টা করুন।'}
            </p>
          </div>

          {hasActiveFilter && globalMedicines.length > 0 && (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="min-h-[44px] px-4 py-2 bg-primary-soft hover:bg-primary/15 text-primary font-bold text-xs rounded-xl border border-primary/25 cursor-pointer transition-colors"
              >
                সব ফিল্টার মুছে পুরো তালিকা দেখুন
              </button>
            </div>
          )}

          {isAdmin && adminStatusFilter === 'pending' && publishedCount > 0 && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setAdminStatusFilter('published')}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>অ্যাডমিন ইমপোর্টে যান</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <span>স্বাস্থ্য প্রশাসন কর্তৃক অনুমোদিত তালিকা শীঘ্রই প্রকাশিত হবে</span>
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
          selectedGlobalMedForDetail ? favoriteIdSet.has(selectedGlobalMedForDetail.id) : false
        }
        onToggleFavorite={handleModalToggleFavorite}
        onSelectMedicine={handleOpenMedicineDetail}
        onClose={() => setSelectedGlobalMedForDetail(null)}
        onAddToMyMedicines={openAddToPersonalModal}
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
          <div className="bg-surface rounded-3xl max-w-lg w-full border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-danger-soft text-danger-text shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">টেস্ট তথ্য মুছে ফেলার নিশ্চিতকরণ</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে খসড়া তালিকা থেকে নির্বাচিত{' '}
                  <strong className="text-danger-text font-bold">
                    {deleteConfirmModal.medicines.length}
                  </strong>{' '}
                  টি টেস্ট রেকর্ড মুছে ফেলতে চান?
                </p>
              </div>
            </div>

            {/* List of Medicines Targeted for Deletion */}
            <div className="bg-surface-2 rounded-2xl p-3.5 border border-border max-h-48 overflow-y-auto space-y-2 text-xs">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                নির্বাচিত রেকর্ডসমূহ ({deleteConfirmModal.medicines.length} টি):
              </span>
              {deleteConfirmModal.medicines.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-text block truncate">{m.brandName}</span>
                    <span className="text-[11px] text-text-muted truncate block">
                      {m.genericName} • {m.strength} • {m.dosageForm}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-danger-soft text-danger-text shrink-0 border border-danger/30">
                    TEST DATA
                  </span>
                </div>
              ))}
            </div>

            {/* Safety Guarantee Notice */}
            <div className="p-3.5 rounded-2xl bg-success-soft border border-success/30 text-[11px] text-success-text space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-success-text shrink-0" />
                <span>ডেটা সুরক্ষা ও নিরাপত্তা নিশ্চয়তা:</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                এই প্রক্রিয়াটি কোনো <strong>প্রকাশিত বাস্তব ওষুধ</strong>,{' '}
                <strong>ব্যক্তিগত আমার ওষুধ তালিকা</strong>, <strong>রোগীর প্রোফাইল</strong> কিংবা{' '}
                <strong>ডোজ লগ</strong> স্পর্শ করবে না। শুধুমাত্র নির্বাচিত খসড়া টেস্ট তথ্য স্থায়ীভাবে
                অপসারিত হবে।
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={() =>
                  setDeleteConfirmModal({ isOpen: false, medicines: [], isDeleting: false })
                }
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deleteConfirmModal.isDeleting
                    ? 'মুছে ফেলা হচ্ছে...'
                    : 'হ্যাঁ, নিশ্চিতভাবে মুছে ফেলুন'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineLibrary;
