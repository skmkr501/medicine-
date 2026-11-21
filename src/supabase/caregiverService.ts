import { getCachedSupabaseUser, supabase } from './client';
import {
  caregiverLinkFromRow,
  CaregiverLinkRow,
  caregiverLinkToRow,
  caregiverSuggestionFromRow,
  CaregiverSuggestionRow,
  caregiverSuggestionToRow,
  familyAlertFromRow,
  FamilyAlertRow,
  familyAlertToRow,
} from './mappers';
import { getSupabaseDataErrorMessageBn, retryWithBackoff } from './userDataService';
import {
  CaregiverLinkDoc,
  CaregiverSuggestionDoc,
  CaregiverSuggestionStatus,
  FamilyAlertDoc,
} from '../types';
import { isValidInviteCode, normalizeInviteCodeInput } from '../utils/caregiverAlerts';

function unwrapRpcSingle<T>(data: unknown): T | null {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.length > 0 ? (data[0] as T) : null;
  }
  return data as T;
}

// ============================================================================
// 1. যত্নকারী সংযোগ (caregiver_links)
// ============================================================================

export async function createCaregiverInviteInSupabase(linkDoc: CaregiverLinkDoc): Promise<void> {
  const row = caregiverLinkToRow(linkDoc);
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('caregiver_links')
        .upsert([row], { onConflict: 'id' });
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'যত্নকারীর আমন্ত্রণ তৈরি করা যায়নি।')
    );
  }
}

export async function redeemCaregiverInviteInSupabase(
  inviteCode: string,
  _caregiverUid: string,
  caregiverName: string
): Promise<CaregiverLinkDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('কোড ব্যবহার করতে অনুগ্রহ করে আগে লগইন করুন');
  }

  const cleanCode = normalizeInviteCodeInput(inviteCode);
  if (!isValidInviteCode(cleanCode)) {
    throw new Error('অনুগ্রহ করে সঠিক ৮ অক্ষরের কোড লিখুন');
  }

  const safeCaregiverName = ((caregiverName || '').trim() || 'পরিবারের যত্নকারী').slice(0, 128);

  const { data, error } = await supabase.rpc('accept_caregiver_invite', {
    p_code: cleanCode,
    p_name: safeCaregiverName,
  });

  if (error) {
    throw new Error(
      getSupabaseDataErrorMessageBn(error, 'ইন্টারনেট সংযোগ চালু রেখে কোডটি যাচাই করুন')
    );
  }

  const res = unwrapRpcSingle<{
    status?: string;
    linkId?: string;
    link_id?: string;
    patientName?: string;
    patient_name?: string;
  }>(data);

  const status = res?.status || 'invalid';
  if (status === 'self') {
    throw new Error('আপনি নিজের আমন্ত্রণ কোডে নিজে যত্নকারী হতে পারবেন না');
  }
  if (status !== 'ok') {
    throw new Error('কোডটি সঠিক নয়, আগেই ব্যবহৃত হয়েছে অথবা ৪৮ ঘণ্টার মেয়াদ শেষ হয়েছে');
  }

  const linkId = String(res?.linkId ?? res?.link_id ?? '');
  if (linkId) {
    const { data: linkData } = await supabase
      .from('caregiver_links')
      .select('*')
      .eq('id', linkId)
      .maybeSingle();
    if (linkData) {
      return caregiverLinkFromRow(linkData as CaregiverLinkRow);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    id: linkId || cleanCode,
    inviteCode: cleanCode,
    patientUid: '',
    caregiverUid: sbUser.id,
    patientName: String(res?.patientName ?? res?.patient_name ?? 'পরিবারের সদস্য'),
    caregiverName: safeCaregiverName,
    status: 'active',
    allowFullView: false,
    allowSuggestions: true,
    createdAt: nowIso,
    expiresAtMs: Date.now() + 48 * 60 * 60 * 1000,
    linkedAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function fetchPatientCaregiverLinksFromSupabase(
  patientUid: string
): Promise<CaregiverLinkDoc[]> {
  try {
    const { data, error } = await supabase
      .from('caregiver_links')
      .select('*')
      .eq('patient_uid', patientUid)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as CaregiverLinkRow[]).map((r) => caregiverLinkFromRow(r))
      : [];
  } catch (err) {
    console.warn('fetchPatientCaregiverLinksFromSupabase warning:', err);
    return [];
  }
}

export async function fetchCaregiverPatientsLinksFromSupabase(
  caregiverUid: string
): Promise<CaregiverLinkDoc[]> {
  try {
    const { data, error } = await supabase
      .from('caregiver_links')
      .select('*')
      .eq('caregiver_uid', caregiverUid)
      .eq('status', 'active')
      .order('linked_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as CaregiverLinkRow[]).map((r) => caregiverLinkFromRow(r))
      : [];
  } catch (err) {
    console.warn('fetchCaregiverPatientsLinksFromSupabase warning:', err);
    return [];
  }
}

export async function updateCaregiverLinkInSupabase(
  linkId: string,
  updates: Partial<CaregiverLinkDoc>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.allowFullView !== undefined) patch.allow_full_view = Boolean(updates.allowFullView);
  if (updates.allowSuggestions !== undefined) {
    patch.allow_suggestions = Boolean(updates.allowSuggestions);
  }
  if (updates.patientName !== undefined) patch.patient_name = updates.patientName;
  if (updates.caregiverName !== undefined) patch.caregiver_name = updates.caregiverName;
  if (updates.patientPhone !== undefined) patch.patient_phone = updates.patientPhone || null;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.todaySummary !== undefined) patch.today_summary = updates.todaySummary ?? null;
  if (updates.sharedMedicines !== undefined) {
    patch.shared_medicines = updates.sharedMedicines ?? null;
  }
  patch.updated_at = updates.updatedAt || new Date().toISOString();

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('caregiver_links')
        .update(patch)
        .eq('id', linkId);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'যত্নকারীর তথ্য হালনাগাদ করা যায়নি।')
    );
  }
}

export async function deleteCaregiverLinkInSupabase(linkId: string): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('caregiver_links')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'যত্নকারীর সংযোগটি মুছে ফেলা যায়নি।')
    );
  }
}

// ============================================================================
// 2. পরিবারের সতর্কতা (family_alerts)
// ============================================================================

export async function createFamilyAlertInSupabase(alertDoc: FamilyAlertDoc): Promise<void> {
  const row = familyAlertToRow(alertDoc);
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('family_alerts')
        .upsert([row], { onConflict: 'id' });
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'পরিবারের সতর্কতা পাঠানো যায়নি।')
    );
  }
}

export async function fetchCaregiverAlertsFromSupabase(
  caregiverUid: string
): Promise<FamilyAlertDoc[]> {
  try {
    const { data, error } = await supabase
      .from('family_alerts')
      .select('*')
      .contains('caregiver_uids', [caregiverUid])
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as FamilyAlertRow[]).map((r) => familyAlertFromRow(r))
      : [];
  } catch (err) {
    console.warn('fetchCaregiverAlertsFromSupabase warning:', err);
    return [];
  }
}

export async function markFamilyAlertSeenInSupabase(
  alertId: string,
  caregiverUid: string,
  currentSeenBy: string[] = []
): Promise<void> {
  const nextSeenBy = Array.from(new Set([...currentSeenBy, caregiverUid].filter(Boolean)));
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('family_alerts')
        .update({ seen_by: nextSeenBy })
        .eq('id', alertId);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(err, 'সতর্কতাটি পঠিত হিসেবে চিহ্নিত করা যায়নি।')
    );
  }
}

export async function cleanupOldFamilyAlertsInSupabase(
  patientUid: string,
  retentionMs: number
): Promise<number> {
  try {
    const cutoffIso = new Date(Date.now() - retentionMs).toISOString();
    const { data, error } = await supabase
      .from('family_alerts')
      .delete()
      .eq('patient_uid', patientUid)
      .lte('created_at', cutoffIso)
      .select('id');
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
  } catch (err) {
    console.warn('cleanupOldFamilyAlertsInSupabase notice:', err);
    return 0;
  }
}

// ============================================================================
// 3. যত্নকারীর ওষুধের প্রস্তাব (caregiver_suggestions)
// ============================================================================

export async function createCaregiverSuggestionInSupabase(
  suggestion: CaregiverSuggestionDoc
): Promise<CaregiverSuggestionDoc> {
  const sbUser = getCachedSupabaseUser();
  if (!sbUser) {
    throw new Error('লগইন আবশ্যক: অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।');
  }

  const row = caregiverSuggestionToRow({
    ...suggestion,
    status: 'pending',
    createdAt: new Date(suggestion.createdAtMs || Date.now()).toISOString(),
  });

  try {
    const saved = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('caregiver_suggestions')
        .insert([row])
        .select('*')
        .single();
      if (error) throw error;
      return data as CaregiverSuggestionRow;
    });
    return caregiverSuggestionFromRow(saved);
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'রোগীর অনুমোদনের অপশন ("ওষুধের প্রস্তাব পাঠাতে পারবেন") বন্ধ আছে বা লিংক সক্রিয় নয়।'
      )
    );
  }
}

export async function fetchPatientPendingSuggestionsFromSupabase(
  patientUid: string
): Promise<CaregiverSuggestionDoc[]> {
  try {
    const { data, error } = await supabase
      .from('caregiver_suggestions')
      .select('*')
      .eq('patient_uid', patientUid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as CaregiverSuggestionRow[]).map((r) => caregiverSuggestionFromRow(r))
      : [];
  } catch (err) {
    console.warn('fetchPatientPendingSuggestionsFromSupabase warning:', err);
    return [];
  }
}

export async function fetchCaregiverSentSuggestionsFromSupabase(
  caregiverUid: string
): Promise<CaregiverSuggestionDoc[]> {
  try {
    const { data, error } = await supabase
      .from('caregiver_suggestions')
      .select('*')
      .eq('caregiver_uid', caregiverUid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return Array.isArray(data)
      ? (data as CaregiverSuggestionRow[]).map((r) => caregiverSuggestionFromRow(r))
      : [];
  } catch (err) {
    console.warn('fetchCaregiverSentSuggestionsFromSupabase warning:', err);
    return [];
  }
}

export async function updateCaregiverSuggestionStatusInSupabase(
  suggestionId: string,
  nextStatus: Exclude<CaregiverSuggestionStatus, 'pending'>
): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('caregiver_suggestions')
        .update({ status: nextStatus })
        .eq('id', suggestionId);
      if (error) throw error;
    });
  } catch (err) {
    throw new Error(
      getSupabaseDataErrorMessageBn(
        err,
        'এই প্রস্তাবটির অবস্থা পরিবর্তন করার অনুমতি নেই বা এটি ইতিমধ্যেই প্রক্রিয়াকৃত হয়েছে।'
      )
    );
  }
}
