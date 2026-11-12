export const LIBRARY_PAGE_SIZE = 24;

export interface PublishedBaselineState {
  hasInitialServerLoad: boolean;
  prevPublishedCount: number | null;
  skipNextListenerBaseline: boolean;
}

export interface EvaluateGlobalCatalogParams {
  medicines: { status?: string }[];
  fromCache: boolean;
  empty: boolean;
  hasExistingCatalog: boolean;
  state: PublishedBaselineState;
}

export interface EvaluateGlobalCatalogResult {
  shouldApplyList: boolean;
  shouldUpdateSyncTime: boolean;
  newlyAddedPublishedCount: number;
  nextState: PublishedBaselineState;
}

export function formatLibrarySyncTime(date: Date = new Date()): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Evaluates a real-time global_medicines snapshot:
 * - Ignores empty cache snapshots when a local catalog already exists (prevents flashing empty offline)
 * - Establishes baseline on first server load without triggering a "new medicine" notification
 * - Prevents false notifications when admin role switches listeners
 * - Computes exact delta when published medicines increase in subsequent live snapshots
 */
export function evaluateGlobalCatalogSnapshot(
  params: EvaluateGlobalCatalogParams
): EvaluateGlobalCatalogResult {
  const { medicines, fromCache, empty, hasExistingCatalog, state } = params;
  const currentPublishedCount = medicines.filter((m) => m.status === 'published').length;

  // Never wipe an existing local/cached catalog with an unconfirmed empty cache snapshot
  if (fromCache && empty && hasExistingCatalog) {
    return {
      shouldApplyList: false,
      shouldUpdateSyncTime: false,
      newlyAddedPublishedCount: 0,
      nextState: state,
    };
  }

  // First load after app boot: establish baseline silently without alerting the user
  if (!state.hasInitialServerLoad) {
    if (fromCache) {
      return {
        shouldApplyList: true,
        shouldUpdateSyncTime: false,
        newlyAddedPublishedCount: 0,
        nextState: {
          ...state,
          prevPublishedCount: state.prevPublishedCount ?? currentPublishedCount,
        },
      };
    }

    return {
      shouldApplyList: true,
      shouldUpdateSyncTime: true,
      newlyAddedPublishedCount: 0,
      nextState: {
        hasInitialServerLoad: true,
        prevPublishedCount: currentPublishedCount,
        skipNextListenerBaseline: false,
      },
    };
  }

  // If listener re-subscribed (e.g. admin login/logout), reset baseline silently on first server response
  if (state.skipNextListenerBaseline) {
    if (fromCache) {
      return {
        shouldApplyList: true,
        shouldUpdateSyncTime: false,
        newlyAddedPublishedCount: 0,
        nextState: state,
      };
    }

    return {
      shouldApplyList: true,
      shouldUpdateSyncTime: true,
      newlyAddedPublishedCount: 0,
      nextState: {
        hasInitialServerLoad: true,
        prevPublishedCount: currentPublishedCount,
        skipNextListenerBaseline: false,
      },
    };
  }

  // Cached re-emissions while offline apply list cleanly without altering server sync time or alerting
  if (fromCache) {
    return {
      shouldApplyList: true,
      shouldUpdateSyncTime: false,
      newlyAddedPublishedCount: 0,
      nextState: state,
    };
  }

  // Live server-confirmed update after initial boot
  const prevCount = state.prevPublishedCount ?? currentPublishedCount;
  const delta = currentPublishedCount - prevCount;

  return {
    shouldApplyList: true,
    shouldUpdateSyncTime: true,
    newlyAddedPublishedCount: delta > 0 ? delta : 0,
    nextState: {
      hasInitialServerLoad: true,
      prevPublishedCount: currentPublishedCount,
      skipNextListenerBaseline: false,
    },
  };
}

export function paginateMedicines<T>(
  items: T[],
  visibleCount: number
): {
  visibleItems: T[];
  remainingCount: number;
  hasMore: boolean;
} {
  const safeLimit = Math.max(0, visibleCount);
  const visibleItems = items.slice(0, safeLimit);
  const remainingCount = Math.max(0, items.length - visibleItems.length);
  return {
    visibleItems,
    remainingCount,
    hasMore: remainingCount > 0,
  };
}
