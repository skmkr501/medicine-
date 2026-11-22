import { getCachedSupabaseAdmin, getCachedSupabaseUser, supabase } from './client';
import {
  announcementFromRow,
  AnnouncementRow,
  announcementToInsertRow,
} from './mappers';
import { Announcement, AnnouncementLevel } from '../types';

export const ANNOUNCEMENTS_DISMISSED_KEY = 'shasthobondhu_dismissed_announcements_v1';

export function isAnnouncementCurrentlyInWindow(
  ann: Pick<Announcement, 'active' | 'startsAt' | 'endsAt'>,
  nowMs: number = Date.now()
): boolean {
  if (!ann.active) return false;
  if (ann.startsAt) {
    const startMs = Date.parse(ann.startsAt);
    if (!Number.isNaN(startMs) && nowMs < startMs) return false;
  }
  if (ann.endsAt) {
    const endMs = Date.parse(ann.endsAt);
    if (!Number.isNaN(endMs) && nowMs > endMs) return false;
  }
  return true;
}

export function loadDismissedAnnouncementIds(
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(ANNOUNCEMENTS_DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    }
  } catch {
    // ignore storage read error
  }
  return new Set();
}

export function markAnnouncementDismissedLocally(
  id: string,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): Set<string> {
  const next = loadDismissedAnnouncementIds(storage);
  if (id) next.add(id);
  if (storage) {
    try {
      const trimmed = Array.from(next).slice(-50);
      storage.setItem(ANNOUNCEMENTS_DISMISSED_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore storage write error
    }
  }
  return next;
}

export async function fetchActiveAnnouncementsFromSupabase(): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return [];
    }

    const nowMs = Date.now();
    const rows = Array.isArray(data) ? (data as AnnouncementRow[]) : [];
    return rows
      .filter((r) => r && typeof r.id === 'string')
      .map((r) => announcementFromRow(r))
      .filter((ann) => isAnnouncementCurrentlyInWindow(ann, nowMs));
  } catch {
    return [];
  }
}

function assertAdminSession(): void {
  if (!getCachedSupabaseUser() || !getCachedSupabaseAdmin()) {
    throw new Error('অ্যাডমিন অনুমোদন আবশ্যক।');
  }
}

export async function fetchAllAnnouncementsForAdmin(): Promise<Announcement[]> {
  assertAdminSession();
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('fetchAllAnnouncementsForAdmin notice:', error.message);
      return [];
    }
    const rows = Array.isArray(data) ? (data as AnnouncementRow[]) : [];
    return rows.filter((r) => r && typeof r.id === 'string').map((r) => announcementFromRow(r));
  } catch {
    return [];
  }
}

export async function createAnnouncementInSupabase(input: {
  title: string;
  body: string;
  level: AnnouncementLevel;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<Announcement> {
  assertAdminSession();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error('শিরোনাম ও বিস্তারিত বার্তা পূরণ করা আবশ্যক।');
  }
  if (title.length > 120) {
    throw new Error('শিরোনাম সর্বোচ্চ ১২০ অক্ষরের মধ্যে হতে হবে।');
  }
  if (body.length > 1000) {
    throw new Error('মূল বার্তা সর্বোচ্চ ১০০০ অক্ষরের মধ্যে হতে হবে।');
  }

  const payload = announcementToInsertRow({ ...input, title, body });
  const { data, error } = await supabase
    .from('announcements')
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    throw error || new Error('ঘোষণা তৈরি করা যায়নি।');
  }

  return announcementFromRow(data as AnnouncementRow);
}

export async function toggleAnnouncementActiveInSupabase(
  id: string,
  active: boolean
): Promise<void> {
  assertAdminSession();
  if (!id) return;
  const { error } = await supabase
    .from('announcements')
    .update({ active: Boolean(active) })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncementInSupabase(id: string): Promise<void> {
  assertAdminSession();
  if (!id) return;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
