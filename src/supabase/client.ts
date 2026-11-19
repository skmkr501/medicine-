import { createClient, type Session, type User } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || 'https://fpseqtfzxwlceqjxkmke.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vVL1acuDgJgJeyweEEQndQ__dSrPqRC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let cachedSession: Session | null = null;
let cachedIsAdmin = false;

export function setCachedSupabaseSession(session: Session | null): void {
  cachedSession = session;
  if (!session) {
    cachedIsAdmin = false;
  }
}

export function getCachedSupabaseUser(): User | null {
  return cachedSession?.user ?? null;
}

export function setCachedSupabaseAdmin(isAdmin: boolean): void {
  cachedIsAdmin = Boolean(isAdmin);
}

export function getCachedSupabaseAdmin(): boolean {
  return cachedIsAdmin;
}

export function extractUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'ব্যবহারকারী';
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof meta?.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta?.name === 'string' && meta.name.trim()
      ? meta.name.trim()
      : '';
  if (fullName) return fullName;
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0];
  }
  return 'ব্যবহারকারী';
}

export function getSupabaseAuthErrorMessageBn(
  error: unknown,
  mode: 'login' | 'register' | 'reset' | 'oauth' = 'login'
): string {
  const anyErr = error as { message?: string; code?: string; status?: number } | null;
  const code = String(anyErr?.code || '').toLowerCase();
  const msg = String(anyErr?.message || error || '').toLowerCase();

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    msg.includes('wrong password') ||
    msg.includes('user not found')
  ) {
    return 'ইমেইল বা পাসওয়ার্ড সঠিক নয়';
  }

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed')
  ) {
    return 'আপনার ইমেইল এখনো যাচাই হয়নি। ইমেইলে পাঠানো লিংকে চাপ দিন।';
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('user already registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  ) {
    return 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে';
  }

  if (
    code === 'weak_password' ||
    msg.includes('password should be at least') ||
    msg.includes('weak password') ||
    msg.includes('at least 6 characters')
  ) {
    return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
  }

  if (
    code === 'validation_failed' ||
    code === 'invalid_email' ||
    msg.includes('unable to validate email address') ||
    msg.includes('invalid format') ||
    msg.includes('invalid email')
  ) {
    return 'ইমেইল ঠিকানাটি সঠিক নয়';
  }

  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    anyErr?.status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('for security purposes')
  ) {
    return 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন';
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('network')
  ) {
    return 'ইন্টারনেট সংযোগ পরীক্ষা করুন';
  }

  if (mode === 'oauth') {
    return 'গুগল লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
  }
  if (mode === 'reset') {
    return 'পাসওয়ার্ড রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।';
  }
  if (mode === 'register') {
    return 'অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
  }
  return 'লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}
