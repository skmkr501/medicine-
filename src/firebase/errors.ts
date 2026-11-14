import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const QUOTA_EXCEEDED_BN_MSG =
  'আজকের ক্লাউড সীমা শেষ, ফোনে থাকা ডেটা দেখানো হচ্ছে। আগামীকাল আবার সিঙ্ক হবে';

let hasNotifiedQuotaExceededThisSession = false;

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error);
  const combined = `${code} ${msg}`.toLowerCase();
  return (
    combined.includes('resource-exhausted') ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota exceeded') ||
    combined.includes('quota_exceeded')
  );
}

/**
 * Returns true only once per browser session so the quota notice toast is never spammed.
 */
export function consumeQuotaExceededNoticeOnce(): boolean {
  if (hasNotifiedQuotaExceededThisSession) {
    return false;
  }
  hasNotifiedQuotaExceededThisSession = true;
  return true;
}

export function resetQuotaNoticeForTests(): void {
  hasNotifiedQuotaExceededThisSession = false;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Returns user-friendly Bengali error descriptions for Firestore & Auth errors
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return 'একটি অজানা ত্রুটি ঘটেছে।';

  if (isQuotaExceededError(error)) {
    return QUOTA_EXCEEDED_BN_MSG;
  }

  const msg = error instanceof Error ? error.message : String(error);

  if (
    msg.includes('permission-denied') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions')
  ) {
    return 'অনুমতি নেই: আপনার এই তথ্য দেখা বা পরিবর্তন করার অনুমতি নেই।';
  }

  if (
    msg.includes('unauthenticated') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('auth/user-not-found')
  ) {
    return 'লগইন আবশ্যক: অনুগ্রহ করে প্রথমে আপনার অ্যাকাউন্টে লগইন করুন।';
  }

  if (
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed-precondition') ||
    msg.includes('client is offline')
  ) {
    return 'নেটওয়ার্ক বা ক্লাউড সংযোগ সমস্যা। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন।';
  }

  return msg;
}
