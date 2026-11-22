export const LIBRARY_MISS_MIN_LEN = 2;
export const LIBRARY_MISS_MAX_LEN = 80;
export const LIBRARY_MISS_DEBOUNCE_MS = 2000;

export function normalizeMissedQuery(raw: string): string | null {
  const collapsed = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (
    collapsed.length < LIBRARY_MISS_MIN_LEN ||
    collapsed.length > LIBRARY_MISS_MAX_LEN
  ) {
    return null;
  }
  return collapsed.toLowerCase();
}

export class SessionMissTracker {
  private loggedKeys = new Set<string>();

  shouldLog(rawQuery: string): string | null {
    const norm = normalizeMissedQuery(rawQuery);
    if (!norm) return null;
    if (this.loggedKeys.has(norm)) return null;
    this.loggedKeys.add(norm);
    return norm;
  }

  reset(): void {
    this.loggedKeys.clear();
  }
}
