import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  const msg = error instanceof Error ? error.message : String(error);

  if (
    msg.includes('permission-denied') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions')
  ) {
    return 'নিরাপত্তা অনুমতি নেই (Permission Denied): আপনার এই তথ্য দেখা বা পরিবর্তন করার অনুমতি নেই। শুধুমাত্র অনুমোদিত অ্যাডমিন এই ক্রিয়া সম্পাদন করতে পারেন।';
  }

  if (
    msg.includes('unauthenticated') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('auth/user-not-found')
  ) {
    return 'প্রমাণীকরণ আবশ্যক (Unauthenticated): অনুগ্রহ করে প্রথমে সাইন-ইন করুন।';
  }

  if (
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed-precondition') ||
    msg.includes('client is offline')
  ) {
    return 'নেটওয়ার্ক বা ফায়ারবেস সংযোগ সমস্যা। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন।';
  }

  return msg;
}
