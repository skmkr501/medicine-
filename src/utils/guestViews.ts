import {
  GuestViewDoc,
  GuestViewExpiryHours,
  GuestViewMedicineItem,
  GuestViewSnapshot,
  Medicine,
  PatientProfile,
  TimeSlot,
} from '../types';
import { formatBengaliTime } from './bengaliUtils';
import { generateShareToken, isValidShareTokenFormat, toMillisSafe } from './sharedReports';

export const GUEST_VIEW_EXPIRY_OPTIONS: Array<{
  hours: GuestViewExpiryHours;
  label: string;
}> = [
  { hours: 24, label: '২৪ ঘণ্টা' },
  { hours: 168, label: '৭ দিন' },
  { hours: 720, label: '৩০ দিন' },
];

export const GUEST_VIEW_SLOTS: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];

export const GUEST_VIEW_BANNER_PREFIX = 'শুধু দেখার জন্য, শেষ হালনাগাদ:';
export const GUEST_VIEW_UNAVAILABLE_MSG = 'এই দেখার লিংকের মেয়াদ শেষ হয়েছে বা বাতিল করা হয়েছে';

const GUEST_CACHE_PREFIX = 'shasthobondhu_guest_view_cache_';

export function extractGuestViewTokenFromPath(pathname: string): string | null {
  if (!pathname || typeof pathname !== 'string') return null;
  const cleaned = pathname.split('?')[0].split('#')[0];
  const match = cleaned.match(/^\/guest\/([A-Za-z0-9_-]{1,128})\/?$/);
  if (!match) return null;
  return match[1];
}

export function buildGuestViewUrl(token: string, origin?: string): string {
  const cleanOrigin = (
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  ).replace(/\/+$/g, '');
  return `${cleanOrigin}/guest/${token}`;
}

export function generateGuestViewToken(): string {
  return generateShareToken(18);
}

export function isValidGuestViewTokenFormat(token: string): boolean {
  return isValidShareTokenFormat(token);
}

export function getGuestViewStatus(
  view: Pick<GuestViewDoc, 'active' | 'expiresAt' | 'expiresAtMs'>,
  nowMs = Date.now()
): 'active' | 'revoked' | 'expired' {
  if (view.active === false) return 'revoked';
  const expMs = view.expiresAtMs ?? toMillisSafe(view.expiresAt);
  if (!expMs || expMs <= nowMs) return 'expired';
  return 'active';
}

/**
 * Privacy-scoped snapshot for elderly/guest read-only medicine routine view.
 * Includes ONLY patient display name and morning/noon/evening/night medicine schedules
 * (brand name, strength, dosage, mealTiming, time). Excludes phone numbers, documents, notes, etc.
 */
export function buildGuestViewSnapshot(
  patient: Pick<PatientProfile, 'id' | 'name'>,
  medicines: Medicine[],
  now: Date = new Date()
): GuestViewSnapshot {
  const slots: Record<TimeSlot, GuestViewMedicineItem[]> = {
    'সকাল': [],
    'দুপুর': [],
    'সন্ধ্যা': [],
    'রাত': [],
  };

  const activeMeds = medicines.filter(
    (m) => m.status === 'active' && m.assignedPatientId === patient.id
  );

  for (const med of activeMeds) {
    const schedules = Array.isArray(med.schedules) ? med.schedules : [];
    for (const sch of schedules) {
      if (!GUEST_VIEW_SLOTS.includes(sch.timeSlot)) continue;
      const item: GuestViewMedicineItem = {
        brandName: (med.brandName || '').trim().slice(0, 120),
        dosage: (sch.dosage || '১টি').trim().slice(0, 48),
        mealTiming: (med.mealTiming || 'যেকোনো সময়').trim().slice(0, 64),
        time: formatBengaliTime(sch.time || '').slice(0, 32) || (sch.time || '').slice(0, 32),
      };
      if (med.strength && med.strength.trim()) {
        item.strength = med.strength.trim().slice(0, 48);
      }
      slots[sch.timeSlot].push(item);
    }
  }

  return {
    patientName: (patient.name || 'রোগী').trim().slice(0, 100),
    slots,
    generatedAt: now.toISOString(),
  };
}

export function buildGuestViewWhatsAppUrl(
  guestUrl: string,
  patientName: string
): string {
  const safeName = (patientName || 'পরিবারের সদস্য').trim();
  const msg =
    `💊 স্বাস্থ্যবন্ধু — ${safeName}-এর দৈনিক ওষুধের তালিকা\n\n` +
    `বড় হরফে ও সহজভাবে দেখতে নিচের লিংকে ট্যাপ করুন (কোনো লগইন বা এডিটের ঝামেলা নেই):\n${guestUrl}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

export interface GuestStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function saveCachedGuestView(
  token: string,
  view: GuestViewDoc,
  storage?: GuestStorageLike | null
): void {
  const store =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!store || !token) return;
  try {
    store.setItem(`${GUEST_CACHE_PREFIX}${token}`, JSON.stringify(view));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCachedGuestView(
  token: string,
  storage?: GuestStorageLike | null
): GuestViewDoc | null {
  const store =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!store || !token) return null;
  try {
    const raw = store.getItem(`${GUEST_CACHE_PREFIX}${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestViewDoc;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.snapshot) return null;
    return parsed;
  } catch {
    return null;
  }
}
