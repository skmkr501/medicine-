import { Medicine, MedicineIconTag, MedicineType } from '../types';

export type MedicineColorTag = Medicine['colorTag'];

export interface MedicineIconOption {
  id: MedicineIconTag;
  labelBn: string;
  symbolText: string;
}

export const MEDICINE_ICON_OPTIONS: MedicineIconOption[] = [
  { id: 'ট্যাবলেট', labelBn: 'ট্যাবলেট', symbolText: '💊' },
  { id: 'ক্যাপসুল', labelBn: 'ক্যাপসুল', symbolText: '💊' },
  { id: 'সিরাপ', labelBn: 'সিরাপ', symbolText: '🧴' },
  { id: 'ইনজেকশন', labelBn: 'ইনজেকশন', symbolText: '💉' },
  { id: 'ড্রপ', labelBn: 'ড্রপ', symbolText: '💧' },
  { id: 'ইনহেলার', labelBn: 'ইনহেলার', symbolText: '🌬️' },
  { id: 'ক্রিম/মলম', labelBn: 'ক্রিম/মলম', symbolText: '🧴' },
  { id: 'সাপোজিটরি', labelBn: 'সাপোজিটরি', symbolText: '🔹' },
  { id: 'স্যাশে', labelBn: 'স্যাশে', symbolText: '📦' },
];

export interface MedicineColorOption {
  id: MedicineColorTag;
  labelBn: string;
  dotClass: string;
  badgeClass: string;
  ringClass: string;
}

export const MEDICINE_COLOR_OPTIONS: MedicineColorOption[] = [
  {
    id: 'teal',
    labelBn: 'টিল',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800',
    ringClass: 'ring-teal-500',
  },
  {
    id: 'emerald',
    labelBn: 'সবুজ',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    ringClass: 'ring-emerald-500',
  },
  {
    id: 'cyan',
    labelBn: 'আকাশি',
    dotClass: 'bg-cyan-600 dark:bg-cyan-400',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800',
    ringClass: 'ring-cyan-500',
  },
  {
    id: 'blue',
    labelBn: 'নীল',
    dotClass: 'bg-blue-600 dark:bg-blue-400',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
    ringClass: 'ring-blue-500',
  },
  {
    id: 'indigo',
    labelBn: 'গাঢ় নীল',
    dotClass: 'bg-indigo-600 dark:bg-indigo-400',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
    ringClass: 'ring-indigo-500',
  },
  {
    id: 'rose',
    labelBn: 'গোলাপি',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    ringClass: 'ring-rose-500',
  },
  {
    id: 'amber',
    labelBn: 'হলুদ',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    ringClass: 'ring-amber-500',
  },
];

const VALID_ICON_TAGS = new Set<MedicineIconTag>(MEDICINE_ICON_OPTIONS.map((o) => o.id));
const VALID_COLOR_TAGS = new Set<MedicineColorTag>(MEDICINE_COLOR_OPTIONS.map((o) => o.id));

export function isValidMedicineIconTag(val: unknown): val is MedicineIconTag {
  return typeof val === 'string' && VALID_ICON_TAGS.has(val as MedicineIconTag);
}

export function isValidMedicineColorTag(val: unknown): val is MedicineColorTag {
  return typeof val === 'string' && VALID_COLOR_TAGS.has(val as MedicineColorTag);
}

export function getDefaultMedicineIconTag(type?: MedicineType | string): MedicineIconTag {
  switch (type) {
    case 'ক্যাপসুল':
      return 'ক্যাপসুল';
    case 'সিরাপ':
      return 'সিরাপ';
    case 'ইনসুলিন/ইনজেকশন':
    case 'ইনজেকশন':
      return 'ইনজেকশন';
    case 'চোখের ড্রপ':
    case 'ড্রপ':
      return 'ড্রপ';
    case 'ইনহেলার':
      return 'ইনহেলার';
    case 'মলম/জেল':
    case 'ক্রিম/মলম':
      return 'ক্রিম/মলম';
    case 'সাপোজিটরি':
      return 'সাপোজিটরি';
    case 'স্যাশে':
      return 'স্যাশে';
    default:
      return 'ট্যাবলেট';
  }
}

export function resolveMedicineIconTag(
  iconTag?: MedicineIconTag | null,
  type?: MedicineType | string
): MedicineIconTag {
  if (iconTag && isValidMedicineIconTag(iconTag)) {
    return iconTag;
  }
  return getDefaultMedicineIconTag(type);
}

export function resolveMedicineColorStyle(colorTag?: string | null): MedicineColorOption {
  const found = MEDICINE_COLOR_OPTIONS.find((c) => c.id === colorTag);
  return found || MEDICINE_COLOR_OPTIONS[0];
}

export function resolveMedicineIconOption(
  iconTag?: MedicineIconTag | null,
  type?: MedicineType | string
): MedicineIconOption {
  const resolved = resolveMedicineIconTag(iconTag, type);
  return (
    MEDICINE_ICON_OPTIONS.find((o) => o.id === resolved) || MEDICINE_ICON_OPTIONS[0]
  );
}

export function formatMedicineNotificationTitle(med: {
  brandName: string;
  iconTag?: MedicineIconTag | null;
  type?: MedicineType | string;
}): string {
  const iconOpt = resolveMedicineIconOption(med.iconTag, med.type);
  return `${iconOpt.symbolText} ${med.brandName} (${iconOpt.labelBn})`;
}
