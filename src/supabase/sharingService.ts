import { getCachedSupabaseUser, supabase } from './client';
import {
  EmergencyCardDataJson,
  emergencyCardFromRow,
  emergencyCardToRow,
  EmergencyCardRow,
  guestViewFromRow,
  GuestViewRow,
  guestViewToRow,
  sharedReportFromRow,
  SharedReportRow,
  sharedReportToRow,
} from './mappers';
import { getSupabaseDataErrorMessageBn, retryWithBackoff } from './userDataService';
import {
  EmergencyCardDoc,
  GuestViewDoc,
  GuestViewExpiryHours,
  GuestViewSnapshot,
  SharedReportDoc,
} from '../types';
import {
  BuiltSharedReportSnapshot,
  isValidShareTokenFormat,
  toMillisSafe,
} from '../utils/sharedReports';
import {
  BuiltEmergencyCardPayload,
  isValidEmergencyTokenFormat,
} from '../utils/emergencyQr';
import {
  isValidGuestViewTokenFormat,
  loadCachedGuestView,
  saveCachedGuestView,
} from '../utils/guestViews';
import {
  MAX_TRANSFER_CIPHERTEXT_CHARS,
  TRANSFER_TTL_MS,
} from '../utils/phoneTransfer';

const MAX_SHARE_TTL_MS = 31 * 24 * 60 * 60 * 1000;

function unwrapRpcSingle<T>(data: unknown): T | null {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.length > 0 ? (data[0] as T) : null;
  }
  return data as T;
}

function isNetworkOrOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const msg = String((error as { message?: unknown }).message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('offline')
  );
}

function clampExpiryMs(requestedMs: number, nowMs = Date.now()): number {
  const maxMs = nowMs + MAX_SHARE_TTL_MS;
  return Math.min(Math.max(requestedMs, nowMs + 60_000), maxMs);
}

// ============================================================================
// 1. রিপোর্ট শেয়ার লিংক (shared_reports)
// ============================================================================

export interface SharedReportDebugInfo {
  code: string;
  docExists: boolean | null;
}

export type SharedReportFetchResult =
  | { status: 'ok'; report: SharedReportDoc; debug: SharedReportDebugInfo }
  | { status: 'not_found'; debug: SharedReportDebugInfo }
  | { status: 'revoked'; debug: SharedReportDebugInfo }
  | { status: 'expired'; debug: SharedReportDebugInfo }
  | { status: 'denied'; debug: SharedReportDebugInfo }
  | { status: 'error'; message: string; debug: SharedReportDebugInfo };

export async function createSharedReportInSupabase(
  snapshot: BuiltSharedReportSnapshot
): Promise<SharedReportDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidShareTokenFormat(snapshot.token)) {
    throw new Error('নিরাপদ লিংক টোকেন সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  const nowIso = new Date(snapshot.createdAtMs || Date.now()).toISOString();
  const safeExpiresMs = clampExpiryMs(snapshot.expiresAtMs, snapshot.createdAtMs || Date.now());
  const row = sharedReportToRow({
    token: snapshot.token,
    createdAt: nowIso,
    expiresAt: new Date(safeExpiresMs).toISOString(),
    createdAtMs: snapshot.createdAtMs,
    expiresAtMs: safeExpiresMs,
    patientName: snapshot.patientName,
    age: snapshot.age,
    gender: snapshot.gender,
    relation: snapshot.relation,
    sections: snapshot.sections,
    revoked: false,
  });

  try {
    const saved = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('shared_reports')
        .insert([row])
        .select('*')
        .single();
      if (error) throw error;
      return data as SharedReportRow;
    });
    return sharedReportFromRow(saved);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'রিপোর্ট লিংক তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function fetchSharedReportByTokenFromSupabase(
  token: string
): Promise<SharedReportFetchResult> {
  const cleanToken = (token || '').trim();
  if (!isValidShareTokenFormat(cleanToken)) {
    return {
      status: 'not_found',
      debug: { code: 'invalid-token-format', docExists: false },
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_shared_report', { p_token: cleanToken });
    if (error) {
      return {
        status: 'error',
        message: getSupabaseDataErrorMessageBn(
          error,
          'ইন্টারনেট সংযোগের সমস্যার কারণে রিপোর্ট লোড করা যায়নি।'
        ),
        debug: { code: String(error.code || error.message || 'rpc-error'), docExists: null },
      };
    }

    const res = unwrapRpcSingle<{
      status?: string;
      report?: Partial<SharedReportRow> & {
        patientName?: string;
        createdAt?: string;
        expiresAt?: string;
      };
    }>(data);

    const status = res?.status || 'not_found';
    if (status === 'revoked') {
      return { status: 'revoked', debug: { code: 'revoked', docExists: true } };
    }
    if (status === 'expired') {
      return { status: 'expired', debug: { code: 'expired', docExists: true } };
    }
    if (status !== 'ok' || !res?.report) {
      return { status: 'not_found', debug: { code: status, docExists: false } };
    }

    const mapped = sharedReportFromRow({
      ...res.report,
      token: cleanToken,
      revoked: false,
    });

    if (!mapped.createdAtMs || mapped.createdAtMs <= 0) {
      mapped.createdAtMs = toMillisSafe(res.report.createdAt ?? res.report.created_at);
    }
    if (!mapped.expiresAtMs || mapped.expiresAtMs <= 0) {
      mapped.expiresAtMs = toMillisSafe(res.report.expiresAt ?? res.report.expires_at);
    }

    return {
      status: 'ok',
      report: mapped,
      debug: { code: 'ok', docExists: true },
    };
  } catch (err) {
    return {
      status: 'error',
      message: getSupabaseDataErrorMessageBn(
        err,
        'ইন্টারনেট সংযোগের সমস্যার কারণে রিপোর্ট লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      ),
      debug: { code: 'exception', docExists: null },
    };
  }
}

export async function fetchOwnerSharedReportsFromSupabase(
  _ownerUid?: string
): Promise<SharedReportDoc[]> {
  try {
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as SharedReportRow[]).map((r) => sharedReportFromRow(r))
      : [];
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'শেয়ার করা লিংকগুলো লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}

export async function revokeSharedReportInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('shared_reports')
        .update({ revoked: true })
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'লিংকটি বাতিল করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function deleteSharedReportInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('shared_reports')
        .delete()
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'লিংকটি মুছে ফেলা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

// ============================================================================
// 2. জরুরি QR কার্ড (emergency_cards)
// ============================================================================

export interface EmergencyCardDebugInfo {
  code: string;
  docExists: boolean | null;
}

export type EmergencyCardFetchResult =
  | { status: 'ok'; card: EmergencyCardDoc; debug: EmergencyCardDebugInfo }
  | { status: 'not_found'; debug: EmergencyCardDebugInfo }
  | { status: 'revoked'; debug: EmergencyCardDebugInfo }
  | { status: 'offline'; debug: EmergencyCardDebugInfo }
  | { status: 'error'; message: string; debug: EmergencyCardDebugInfo };

function buildEmergencyCardRowFromPayload(payload: BuiltEmergencyCardPayload) {
  return emergencyCardToRow({
    token: payload.token,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    patientName: payload.patientName,
    age: payload.age,
    bloodGroup: payload.bloodGroup,
    allergies: payload.allergies,
    conditions: payload.conditions,
    contactName: payload.contactName,
    contactPhone: payload.contactPhone,
    medicines: payload.medicines,
    doctorName: payload.doctorName,
    active: true,
  });
}

export async function createEmergencyCardInSupabase(
  payload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(payload.token)) {
    throw new Error('জরুরি কার্ড টোকেন সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  const row = buildEmergencyCardRowFromPayload(payload);
  try {
    const saved = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('emergency_cards')
        .insert([row])
        .select('*')
        .single();
      if (error) throw error;
      return data as EmergencyCardRow;
    });
    return emergencyCardFromRow(saved);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'জরুরি QR কার্ড তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function updateEmergencyCardInSupabase(
  token: string,
  payload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(token)) {
    throw new Error('জরুরি কার্ড টোকেন সঠিক নয়।');
  }

  const row = buildEmergencyCardRowFromPayload({ ...payload, token });
  try {
    const updated = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('emergency_cards')
        .update({
          patient_name: row.patient_name,
          data: row.data,
          active: true,
        })
        .eq('token', token)
        .select('*')
        .single();
      if (error) throw error;
      return data as EmergencyCardRow;
    });
    return emergencyCardFromRow(updated);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'জরুরি কার্ড হালনাগাদ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function rotateEmergencyCardInSupabase(
  oldToken: string,
  newPayload: BuiltEmergencyCardPayload
): Promise<EmergencyCardDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }
  if (!isValidEmergencyTokenFormat(newPayload.token)) {
    throw new Error('নতুন জরুরি কার্ড টোকেন সঠিক নয়।');
  }

  const newRow = buildEmergencyCardRowFromPayload(newPayload);
  try {
    await retryWithBackoff(async () => {
      const { error: revokeErr } = await supabase
        .from('emergency_cards')
        .update({ active: false })
        .eq('token', oldToken);
      if (revokeErr) throw revokeErr;
    });

    const created = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('emergency_cards')
        .insert([newRow])
        .select('*')
        .single();
      if (error) throw error;
      return data as EmergencyCardRow;
    });
    return emergencyCardFromRow(created);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'নতুন জরুরি QR কার্ড তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function revokeEmergencyCardInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('emergency_cards')
        .update({ active: false })
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'জরুরি কার্ডটি বাতিল করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function deleteEmergencyCardInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('emergency_cards')
        .delete()
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'জরুরি কার্ডটি মুছে ফেলা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      )
    );
  }
}

export async function fetchOwnerEmergencyCardsFromSupabase(
  _ownerUid?: string
): Promise<EmergencyCardDoc[]> {
  try {
    const { data, error } = await supabase
      .from('emergency_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as EmergencyCardRow[]).map((r) => emergencyCardFromRow(r))
      : [];
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'জরুরি কার্ডগুলো লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}

export async function fetchEmergencyCardByTokenFromSupabase(
  token: string
): Promise<EmergencyCardFetchResult> {
  const cleanToken = (token || '').trim();
  if (!isValidEmergencyTokenFormat(cleanToken)) {
    return {
      status: 'not_found',
      debug: { code: 'invalid-token-format', docExists: false },
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_emergency_card', { p_token: cleanToken });
    if (error) {
      if (isNetworkOrOfflineError(error)) {
        return {
          status: 'offline',
          debug: { code: String(error.message || 'offline'), docExists: null },
        };
      }
      return {
        status: 'error',
        message: getSupabaseDataErrorMessageBn(
          error,
          'তথ্য লোড করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
        ),
        debug: { code: String(error.code || error.message || 'rpc-error'), docExists: null },
      };
    }

    const res = unwrapRpcSingle<{
      status?: string;
      card?: {
        patientName?: string;
        patient_name?: string;
        data?: EmergencyCardDataJson;
        createdAt?: string;
        created_at?: string;
      };
    }>(data);

    const status = res?.status || 'not_found';
    if (status === 'revoked') {
      return { status: 'revoked', debug: { code: 'revoked', docExists: true } };
    }
    if (status !== 'ok' || !res?.card) {
      return { status: 'not_found', debug: { code: status, docExists: false } };
    }

    const mapped = emergencyCardFromRow({
      token: cleanToken,
      patient_name: res.card.patientName ?? res.card.patient_name ?? '',
      data: res.card.data ?? {},
      created_at: res.card.createdAt ?? res.card.created_at ?? new Date().toISOString(),
      active: true,
    });

    return {
      status: 'ok',
      card: mapped,
      debug: { code: 'ok', docExists: true },
    };
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      return {
        status: 'offline',
        debug: { code: 'offline', docExists: null },
      };
    }
    return {
      status: 'error',
      message: getSupabaseDataErrorMessageBn(
        err,
        'তথ্য লোড করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      ),
      debug: { code: 'exception', docExists: null },
    };
  }
}

// ============================================================================
// 3. অতিথি দেখার লিংক (guest_views)
// ============================================================================

export type GuestViewFetchResult =
  | { status: 'ok'; view: GuestViewDoc; fromOfflineCache: boolean }
  | { status: 'not_found' }
  | { status: 'revoked' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

export async function createGuestViewInSupabase(params: {
  token: string;
  patientName: string;
  snapshot: GuestViewSnapshot;
  expiryHours: GuestViewExpiryHours;
}): Promise<GuestViewDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করুন।');
  }
  if (!isValidGuestViewTokenFormat(params.token)) {
    throw new Error('অতিথি লিংক টোকেন সঠিক নয়।');
  }

  const nowMs = Date.now();
  const expiresMs = clampExpiryMs(nowMs + params.expiryHours * 60 * 60 * 1000, nowMs);
  const nowIso = new Date(nowMs).toISOString();
  const row = guestViewToRow({
    token: params.token,
    patientName: params.patientName,
    snapshot: params.snapshot,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: new Date(expiresMs).toISOString(),
    active: true,
  });

  try {
    const saved = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('guest_views')
        .insert([row])
        .select('*')
        .single();
      if (error) throw error;
      return data as GuestViewRow;
    });
    return guestViewFromRow(saved);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'অতিথি দেখার লিংক তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}

export async function updateGuestViewSnapshotInSupabase(
  token: string,
  patientName: string,
  snapshot: GuestViewSnapshot
): Promise<GuestViewDoc> {
  const nowIso = new Date().toISOString();
  try {
    const updated = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('guest_views')
        .update({
          patient_name: patientName,
          snapshot,
          updated_at: nowIso,
        })
        .eq('token', token)
        .select('*')
        .single();
      if (error) throw error;
      return data as GuestViewRow;
    });
    return guestViewFromRow(updated);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'অতিথি লিংকটি হালনাগাদ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}

export async function revokeGuestViewInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('guest_views')
        .update({ active: false })
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'অতিথি লিংকটি বাতিল করা যায়নি।')
    );
  }
}

export async function deleteGuestViewInSupabase(token: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('guest_views')
        .delete()
        .eq('token', token);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'অতিথি লিংকটি মুছে ফেলা যায়নি।')
    );
  }
}

export async function fetchOwnerGuestViewsFromSupabase(): Promise<GuestViewDoc[]> {
  try {
    const { data, error } = await supabase
      .from('guest_views')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as GuestViewRow[]).map((r) => guestViewFromRow(r))
      : [];
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'অতিথি লিংকের তালিকা লোড করা যায়নি।')
    );
  }
}

export async function fetchGuestViewByTokenFromSupabase(
  token: string
): Promise<GuestViewFetchResult> {
  const cleanToken = (token || '').trim();
  if (!isValidGuestViewTokenFormat(cleanToken)) {
    return { status: 'not_found' };
  }

  try {
    const { data, error } = await supabase.rpc('get_guest_view', { p_token: cleanToken });
    if (error) {
      if (isNetworkOrOfflineError(error)) {
        const cached = loadCachedGuestView(cleanToken);
        if (cached && (!cached.expiresAtMs || cached.expiresAtMs > Date.now())) {
          return { status: 'ok', view: cached, fromOfflineCache: true };
        }
      }
      return {
        status: 'error',
        message: getSupabaseDataErrorMessageBn(error, 'তথ্য লোড করা যায়নি।'),
      };
    }

    const res = unwrapRpcSingle<{
      status?: string;
      view?: Partial<GuestViewRow> & {
        patientName?: string;
        updatedAt?: string;
        expiresAt?: string;
      };
    }>(data);

    const status = res?.status || 'not_found';
    if (status === 'revoked') return { status: 'revoked' };
    if (status === 'expired') return { status: 'expired' };
    if (status !== 'ok' || !res?.view) return { status: 'not_found' };

    const mapped = guestViewFromRow({
      ...res.view,
      token: cleanToken,
      active: true,
    });
    saveCachedGuestView(cleanToken, mapped);
    return { status: 'ok', view: mapped, fromOfflineCache: false };
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      const cached = loadCachedGuestView(cleanToken);
      if (cached && (!cached.expiresAtMs || cached.expiresAtMs > Date.now())) {
        return { status: 'ok', view: cached, fromOfflineCache: true };
      }
    }
    return {
      status: 'error',
      message: getSupabaseDataErrorMessageBn(err, 'অফলাইন বা নেটওয়ার্ক ত্রুটির কারণে খোলা যায়নি।'),
    };
  }
}

// ============================================================================
// 4. ফোন-বদল এনক্রিপ্টেড ট্রান্সফার (transfers)
// ============================================================================

export async function createPhoneTransferInSupabase(ciphertext: string): Promise<{
  id: string;
  createdAt: string;
  expiresAt: string;
}> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('ফোন বদল ব্যবহার করতে অনুগ্রহ করে আগে লগইন করুন।');
  }
  if (!ciphertext || ciphertext.length > MAX_TRANSFER_CIPHERTEXT_CHARS) {
    throw new Error('ট্রান্সফার ডেটা নির্ধারিত সীমার চেয়ে বড়। অনুগ্রহ করে JSON ব্যাকআপ ব্যবহার করুন।');
  }

  const nowMs = Date.now();
  const expiresIso = new Date(nowMs + TRANSFER_TTL_MS).toISOString();

  try {
    const row = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('transfers')
        .insert([{ ciphertext, expires_at: expiresIso }])
        .select('id, created_at, expires_at')
        .single();
      if (error) throw error;
      return data as { id: string; created_at: string; expires_at: string };
    });
    return {
      id: String(row.id),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'ট্রান্সফার সেশন তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}

export async function consumePhoneTransferInSupabase(id: string): Promise<string | null> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('ট্রান্সফার গ্রহণ করতে অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করুন।');
  }
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new Error('সঠিক ট্রান্সফার আইডি পাওয়া যায়নি।');
  }

  try {
    const { data, error } = await supabase.rpc('consume_transfer', { p_id: cleanId });
    if (error) throw error;
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object' && typeof (data as { ciphertext?: unknown }).ciphertext === 'string') {
      return (data as { ciphertext: string }).ciphertext;
    }
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && typeof (first as { ciphertext?: unknown }).ciphertext === 'string') {
        return (first as { ciphertext: string }).ciphertext;
      }
    }
    return null;
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'ট্রান্সফার ডেটা গ্রহণ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
      )
    );
  }
}
