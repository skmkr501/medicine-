import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';
import {
  caregiverLinkFromRow,
  caregiverSuggestionFromRow,
  doseLogFromRow,
  expenseFromRow,
  familyAlertFromRow,
  medicineFromRow,
} from './mappers';
import {
  CaregiverLinkDoc,
  CaregiverSuggestionDoc,
  DoseLog,
  Expense,
  FamilyAlertDoc,
  Medicine,
  RealtimeSyncStatus,
} from '../types';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeRowChange<T> {
  eventType: RealtimeEventType;
  row: T | null;
  oldId: string | null;
}

/**
 * Tracks recent local writes per (table, id) so Supabase Realtime echoes
 * from the current client session are cleanly ignored.
 */
export class RecentWriteTracker {
  private writes = new Map<string, { timestampMs: number; expiresAtMs: number }>();

  mark(table: string, id: string, timestampMs: number = Date.now(), ttlMs: number = 15_000): void {
    if (!table || !id) return;
    const now = Date.now();
    this.prune(now);
    this.writes.set(`${table}:${id}`, {
      timestampMs,
      expiresAtMs: now + Math.max(1000, ttlMs),
    });
  }

  shouldIgnoreEcho(table: string, id: string, incomingUpdatedAtMs?: number): boolean {
    if (!table || !id) return false;
    const key = `${table}:${id}`;
    const entry = this.writes.get(key);
    if (!entry) return false;
    const now = Date.now();
    if (now > entry.expiresAtMs) {
      this.writes.delete(key);
      return false;
    }
    if (
      typeof incomingUpdatedAtMs === 'number' &&
      incomingUpdatedAtMs > 0 &&
      entry.timestampMs > 0
    ) {
      // If remote write is strictly newer by > 1.5s, accept remote edit; otherwise it's our own write echo
      return incomingUpdatedAtMs <= entry.timestampMs + 1500;
    }
    return true;
  }

  clear(): void {
    this.writes.clear();
  }

  private prune(now: number): void {
    for (const [k, v] of this.writes.entries()) {
      if (now > v.expiresAtMs) {
        this.writes.delete(k);
      }
    }
  }
}

function getDefaultUpdatedAtMs(item: { updatedAtMs?: number; updatedAt?: unknown; createdAtMs?: number }): number {
  if (typeof item.updatedAtMs === 'number' && Number.isFinite(item.updatedAtMs) && item.updatedAtMs > 0) {
    return item.updatedAtMs;
  }
  if (typeof item.updatedAt === 'string' && item.updatedAt.trim()) {
    const parsed = Date.parse(item.updatedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof item.createdAtMs === 'number' && Number.isFinite(item.createdAtMs) && item.createdAtMs > 0) {
    return item.createdAtMs;
  }
  return 0;
}

/**
 * Merges a single Realtime INSERT/UPDATE row into an existing state list
 * while deduplicating stale or identical writes using `id` + `updatedAtMs`.
 */
export function mergeRealtimeRow<
  T extends { id: string; updatedAtMs?: number; updatedAt?: unknown; createdAtMs?: number }
>(
  items: T[],
  incoming: T,
  getUpdatedMs: (item: T) => number = getDefaultUpdatedAtMs
): { items: T[]; applied: boolean } {
  if (!incoming || !incoming.id) return { items, applied: false };
  const idx = items.findIndex((item) => item.id === incoming.id);
  if (idx === -1) {
    return { items: [incoming, ...items], applied: true };
  }

  const existing = items[idx];
  const existingMs = getUpdatedMs(existing);
  const incomingMs = getUpdatedMs(incoming);

  // Deduplicate: ignore if incoming timestamp is older or equal when both have timestamps
  if (existingMs > 0 && incomingMs > 0 && incomingMs <= existingMs) {
    return { items, applied: false };
  }

  // Fallback equality check if timestamps missing
  try {
    if (JSON.stringify(existing) === JSON.stringify(incoming)) {
      return { items, applied: false };
    }
  } catch {
    // proceed with update
  }

  const next = items.slice();
  next[idx] = incoming;
  return { items: next, applied: true };
}

export function removeRealtimeRowById<T extends { id: string }>(
  items: T[],
  id: string | null | undefined
): { items: T[]; removed: boolean } {
  if (!id) return { items, removed: false };
  const exists = items.some((item) => item.id === id);
  if (!exists) return { items, removed: false };
  return { items: items.filter((item) => item.id !== id), removed: true };
}

export interface UserRealtimeCallbacks {
  onStatusChange: (status: RealtimeSyncStatus) => void;
  onDoseLogChange: (change: RealtimeRowChange<DoseLog>) => void;
  onMedicineChange: (change: RealtimeRowChange<Medicine>) => void;
  onFamilyAlertChange: (change: RealtimeRowChange<FamilyAlertDoc>) => void;
  onCaregiverSuggestionChange: (change: RealtimeRowChange<CaregiverSuggestionDoc>) => void;
  onCaregiverLinkChange: (change: RealtimeRowChange<CaregiverLinkDoc>) => void;
  onExpenseChange?: (change: RealtimeRowChange<Expense>) => void;
  onResumeFromBackground: () => void;
}

const RECONNECT_DELAY_MS = 5000;

function extractRowId(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const rawId = (record as { id?: unknown }).id;
  return typeof rawId === 'string' && rawId.trim() ? rawId.trim() : null;
}

function handlePayload<T>(
  payload: { eventType?: string; new?: unknown; old?: unknown },
  fromRow: (row: any) => T,
  cb: (change: RealtimeRowChange<T>) => void
): void {
  const evt = String(payload?.eventType || '').toUpperCase() as RealtimeEventType;
  if (evt === 'DELETE') {
    const oldId = extractRowId(payload.old);
    if (oldId) cb({ eventType: 'DELETE', row: null, oldId });
    return;
  }
  if (evt === 'INSERT' || evt === 'UPDATE') {
    const id = extractRowId(payload.new);
    if (!id) return;
    try {
      const mapped = fromRow(payload.new);
      cb({ eventType: evt, row: mapped, oldId: id });
    } catch (err) {
      console.warn('Realtime row map warning:', err);
    }
  }
}

/**
 * Opens `supabase.channel('user-sync')` for the signed-in user AND separate
 * `supabase.channel('patient-sync-<patientUid>')` channels for any active
 * caregiver-linked patients.
 * - Handles auto-reconnect every 5s when disconnected.
 * - Triggers single `onResumeFromBackground` refetch when returning from background.
 * - Returns an unsubscribe function that removes every channel via `supabase.removeChannel`.
 */
export function subscribeUserRealtimeSync(params: {
  userId: string;
  caregiverPatientUids?: string[];
  callbacks: UserRealtimeCallbacks;
}): () => void {
  const { userId, caregiverPatientUids = [], callbacks } = params;
  if (!userId) {
    callbacks.onStatusChange('disconnected');
    return () => {};
  }

  let disposed = false;
  let activeChannels: RealtimeChannel[] = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let wasHidden = false;

  const uniqueLinkedPatients = Array.from(
    new Set(
      caregiverPatientUids
        .map((uid) => uid.trim())
        .filter((uid) => uid.length > 0 && uid !== userId)
    )
  );

  const cleanupChannels = () => {
    if (activeChannels.length > 0) {
      const toRemove = activeChannels;
      activeChannels = [];
      for (const ch of toRemove) {
        try {
          void supabase.removeChannel(ch);
        } catch {
          // ignore cleanup failure
        }
      }
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!disposed) {
        connect();
      }
    }, RECONNECT_DELAY_MS);
  };

  const connect = () => {
    if (disposed) return;
    cleanupChannels();
    callbacks.onStatusChange('connecting');

    const userChannel = supabase
      .channel('user-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dose_logs', filter: `user_id=eq.${userId}` },
        (payload) => handlePayload(payload, doseLogFromRow, callbacks.onDoseLogChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicines', filter: `user_id=eq.${userId}` },
        (payload) => handlePayload(payload, medicineFromRow, callbacks.onMedicineChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_alerts', filter: `patient_uid=eq.${userId}` },
        (payload) => handlePayload(payload, familyAlertFromRow, callbacks.onFamilyAlertChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caregiver_suggestions', filter: `patient_uid=eq.${userId}` },
        (payload) =>
          handlePayload(payload, caregiverSuggestionFromRow, callbacks.onCaregiverSuggestionChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caregiver_suggestions', filter: `caregiver_uid=eq.${userId}` },
        (payload) =>
          handlePayload(payload, caregiverSuggestionFromRow, callbacks.onCaregiverSuggestionChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caregiver_links', filter: `patient_uid=eq.${userId}` },
        (payload) => handlePayload(payload, caregiverLinkFromRow, callbacks.onCaregiverLinkChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caregiver_links', filter: `caregiver_uid=eq.${userId}` },
        (payload) => handlePayload(payload, caregiverLinkFromRow, callbacks.onCaregiverLinkChange)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (callbacks.onExpenseChange) {
            handlePayload(payload, expenseFromRow, callbacks.onExpenseChange);
          }
        }
      );

    userChannel.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        callbacks.onStatusChange('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        callbacks.onStatusChange('disconnected');
        scheduleReconnect();
      }
    });

    activeChannels.push(userChannel);

    // Separate channel per linked patient when user is acting as caregiver
    for (const patientUid of uniqueLinkedPatients) {
      const patientChannel = supabase
        .channel(`patient-sync-${patientUid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dose_logs', filter: `user_id=eq.${patientUid}` },
          (payload) => handlePayload(payload, doseLogFromRow, callbacks.onDoseLogChange)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medicines', filter: `user_id=eq.${patientUid}` },
          (payload) => handlePayload(payload, medicineFromRow, callbacks.onMedicineChange)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_alerts', filter: `patient_uid=eq.${patientUid}` },
          (payload) => handlePayload(payload, familyAlertFromRow, callbacks.onFamilyAlertChange)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caregiver_suggestions', filter: `patient_uid=eq.${patientUid}` },
          (payload) =>
            handlePayload(payload, caregiverSuggestionFromRow, callbacks.onCaregiverSuggestionChange)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caregiver_links', filter: `patient_uid=eq.${patientUid}` },
          (payload) => handlePayload(payload, caregiverLinkFromRow, callbacks.onCaregiverLinkChange)
        );

      patientChannel.subscribe();
      activeChannels.push(patientChannel);
    }
  };

  const handleVisibilityChange = () => {
    if (typeof document === 'undefined' || disposed) return;
    if (document.visibilityState === 'hidden') {
      wasHidden = true;
    } else if (document.visibilityState === 'visible' && wasHidden) {
      wasHidden = false;
      callbacks.onResumeFromBackground();
      // If channel dropped while in background, reconnect immediately
      if (activeChannels.length === 0) {
        connect();
      }
    }
  };

  const handleOnline = () => {
    if (disposed) return;
    connect();
    callbacks.onResumeFromBackground();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
    cleanupChannels();
    callbacks.onStatusChange('disconnected');
  };
}
