import { HomeLayoutCardId, HomeLayoutItem } from '../types';

export interface HomeLayoutCardMeta {
  id: HomeLayoutCardId;
  titleBn: string;
  descriptionBn: string;
  locked?: boolean;
}

export const HOME_LAYOUT_CARD_META: HomeLayoutCardMeta[] = [
  {
    id: 'today_doses',
    titleBn: 'আজকের ডোজ ও সময়সূচি',
    descriptionBn: 'এখন খাবেন কার্ড, বাকি ডোজ এবং সময় অনুযায়ী ওষুধ (সবসময় চালু থাকবে)',
    locked: true,
  },
  {
    id: 'caregiver_family',
    titleBn: 'পরিবারের যত্ন',
    descriptionBn: 'যাদের ওষুধের খোঁজখবর আপনি রাখছেন',
  },
  {
    id: 'patient_progress',
    titleBn: 'প্রোফাইল ও আজকের অগ্রগতি',
    descriptionBn: 'সদস্যের তথ্য, দৈনিক চেকলিস্ট, রিমাইন্ডার ও ক্লাউড সিঙ্ক',
  },
  {
    id: 'quick_actions',
    titleBn: 'দ্রুত শর্টকাট',
    descriptionBn: 'ডাক্তার, ওষুধ লাইব্রেরি, স্বাস্থ্য রেকর্ড, ক্যালেন্ডার ও ইতিহাস',
  },
  {
    id: 'stock_summary',
    titleBn: 'পরিবার ও মজুত সতর্কতা',
    descriptionBn: 'সদস্যদের সারসংক্ষেপ, মেয়াদ এবং কম স্টকের সতর্কতা',
  },
  {
    id: 'adherence_analytics',
    titleBn: 'ওষুধ গ্রহণের চার্ট',
    descriptionBn: 'সাপ্তাহিক ও নিয়মিত ডোজ পালনের হিসাব',
  },
  {
    id: 'emergency_card',
    titleBn: 'জরুরি কার্ড',
    descriptionBn: 'রক্তের গ্রুপ, অ্যালার্জি ও জরুরি যোগাযোগের তথ্য',
  },
];

export const DEFAULT_HOME_LAYOUT: HomeLayoutItem[] = HOME_LAYOUT_CARD_META.map((meta) => ({
  id: meta.id,
  visible: true,
}));

const VALID_IDS = new Set<HomeLayoutCardId>(HOME_LAYOUT_CARD_META.map((m) => m.id));

export function getHomeLayoutCardMeta(id: HomeLayoutCardId): HomeLayoutCardMeta {
  return (
    HOME_LAYOUT_CARD_META.find((m) => m.id === id) || {
      id,
      titleBn: id,
      descriptionBn: '',
    }
  );
}

/**
 * Normalizes a potentially missing, partial, duplicate, or legacy homeLayout array.
 * Ensures 'today_doses' is always present and visible: true.
 */
export function normalizeHomeLayout(raw?: unknown): HomeLayoutItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HOME_LAYOUT.map((item) => ({ ...item }));
  }

  const seen = new Set<HomeLayoutCardId>();
  const normalized: HomeLayoutItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as { id?: unknown; visible?: unknown };
    const id = rec.id as HomeLayoutCardId;
    if (!VALID_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      visible: id === 'today_doses' ? true : rec.visible !== false,
    });
  }

  for (const def of DEFAULT_HOME_LAYOUT) {
    if (!seen.has(def.id)) {
      normalized.push({ ...def });
    }
  }

  return normalized;
}

export function moveHomeLayoutItem(
  layout: HomeLayoutItem[] | undefined,
  index: number,
  direction: 'up' | 'down'
): HomeLayoutItem[] {
  const current = normalizeHomeLayout(layout);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= current.length || targetIndex < 0 || targetIndex >= current.length) {
    return current;
  }
  const next = current.map((item) => ({ ...item }));
  const temp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = temp;
  return next;
}

export function toggleHomeLayoutItem(
  layout: HomeLayoutItem[] | undefined,
  id: HomeLayoutCardId
): HomeLayoutItem[] {
  const current = normalizeHomeLayout(layout);
  if (id === 'today_doses') {
    return current.map((item) =>
      item.id === 'today_doses' ? { ...item, visible: true } : item
    );
  }
  return current.map((item) =>
    item.id === id ? { ...item, visible: !item.visible } : item
  );
}
