import { Expense, ExpenseCategory, PatientProfile } from '../types';
import { toBengaliNumber } from './bengaliUtils';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'ওষুধ',
  'ডাক্তারের ফি',
  'পরীক্ষা (টেস্ট)',
  'হাসপাতাল',
  'অন্যান্য',
];

export const MAX_EXPENSE_AMOUNT = 100_000_000; // ১০ কোটি
export const EXPENSE_BUDGET_STORAGE_PREFIX = 'shasthobondhu_expense_budget_v1_';

const BN_TO_EN_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BENGALI_MONTH_NAMES = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const ENGLISH_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function normalizeExpenseDigits(input: string): string {
  return String(input || '').replace(/[০-৯]/g, (ch) => BN_TO_EN_DIGIT_MAP[ch] ?? ch);
}

export interface ParsedExpenseAmount {
  valid: boolean;
  amount: number | null;
  error?: string;
}

/**
 * Validates and parses numeric expense input (accepts Bengali ০-৯ and English 0-9).
 * Range: 0 to 100,000,000 (১০ কোটি). Rejects letters, symbols, negatives, and > 10 crore.
 */
export function parseExpenseAmountInput(
  raw: string,
  options: { allowZero?: boolean } = {}
): ParsedExpenseAmount {
  const allowZero = options.allowZero ?? true;
  const normalized = normalizeExpenseDigits(raw).trim().replace(/,/g, '');
  if (!normalized) {
    return { valid: false, amount: null, error: 'খরচের পরিমাণ লিখুন' };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return {
      valid: false,
      amount: null,
      error: 'শুধুমাত্র সঠিক সংখ্যা লিখুন (ইংরেজি বা বাংলা অঙ্ক)',
    };
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { valid: false, amount: null, error: 'সঠিক সংখ্যা লিখুন' };
  }
  if (num < 0 || (!allowZero && num === 0)) {
    return {
      valid: false,
      amount: null,
      error: allowZero
        ? 'পরিমাণ ০ বা তার বেশি হতে হবে'
        : 'পরিমাণ ০-এর বেশি হতে হবে',
    };
  }
  if (num > MAX_EXPENSE_AMOUNT) {
    return {
      valid: false,
      amount: null,
      error: 'পরিমাণ সর্বোচ্চ ১০ কোটি (১০০,০০০,০০০) টাকার মধ্যে হতে হবে',
    };
  }
  const rounded = Math.round(num * 100) / 100;
  return { valid: true, amount: rounded };
}

/**
 * Formats an expense amount with Taka symbol and South Asian comma grouping: e.g. ৳১,২৫০
 */
export function formatCurrencyTk(amount: number, useBengaliDigits = true): string {
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = Math.round(safe * 100) / 100;
  const isInt = Number.isInteger(rounded);
  const formattedEn = rounded.toLocaleString('en-IN', {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  });
  return useBengaliDigits ? `৳${toBengaliNumber(formattedEn)}` : `৳${formattedEn}`;
}

export function getMonthKeyFromDate(dateStr?: string): string {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}/.test(dateStr.trim())) {
    return dateStr.trim().slice(0, 7);
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  const baseDate = match
    ? new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  baseDate.setMonth(baseDate.getMonth() + deltaMonths);
  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthYearBn(monthKey: string, isEn = false): string {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  if (isEn) {
    return `${ENGLISH_MONTH_NAMES[monthIdx]} ${year}`;
  }
  return `${BENGALI_MONTH_NAMES[monthIdx]} ${toBengaliNumber(year)}`;
}

export interface CategoryExpenseBreakdownItem {
  category: ExpenseCategory;
  amount: number;
  count: number;
  sharePercent: number;
}

export interface MemberExpenseBreakdownItem {
  patientId: string; // patient.id or 'general'
  patientName: string;
  amount: number;
  count: number;
  sharePercent: number;
}

export interface MonthlyExpenseAnalytics {
  monthKey: string;
  previousMonthKey: string;
  totalAmount: number;
  previousMonthTotal: number;
  transactionCount: number;
  percentChange: number | null;
  changeDirection: 'up' | 'down' | 'same' | 'none';
  categoryBreakdown: CategoryExpenseBreakdownItem[];
  memberBreakdown: MemberExpenseBreakdownItem[];
  monthExpenses: Expense[];
}

export function computeMonthlyExpenseAnalytics(
  expenses: Expense[],
  monthKey: string,
  patients: PatientProfile[]
): MonthlyExpenseAnalytics {
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const patientMap = new Map<string, PatientProfile>();
  for (const p of patients) {
    patientMap.set(p.id, p);
  }

  const monthExpenses = expenses
    .filter((exp) => getMonthKeyFromDate(exp.expenseDate) === monthKey)
    .slice()
    .sort((a, b) => {
      const cmp = (b.expenseDate || '').localeCompare(a.expenseDate || '');
      if (cmp !== 0) return cmp;
      return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
    });

  const prevExpenses = expenses.filter(
    (exp) => getMonthKeyFromDate(exp.expenseDate) === previousMonthKey
  );

  let totalAmount = 0;
  for (const exp of monthExpenses) {
    totalAmount += Number(exp.amount) || 0;
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  let previousMonthTotal = 0;
  for (const exp of prevExpenses) {
    previousMonthTotal += Number(exp.amount) || 0;
  }
  previousMonthTotal = Math.round(previousMonthTotal * 100) / 100;

  let percentChange: number | null = null;
  let changeDirection: 'up' | 'down' | 'same' | 'none' = 'none';

  if (previousMonthTotal > 0) {
    const rawPct = ((totalAmount - previousMonthTotal) / previousMonthTotal) * 100;
    const roundedPct = Math.round(Math.abs(rawPct) * 10) / 10;
    percentChange = roundedPct;
    if (totalAmount > previousMonthTotal) {
      changeDirection = 'up';
    } else if (totalAmount < previousMonthTotal) {
      changeDirection = 'down';
    } else {
      changeDirection = 'same';
      percentChange = 0;
    }
  } else if (totalAmount > 0 && prevExpenses.length === 0) {
    changeDirection = 'none';
    percentChange = null;
  }

  // Category aggregation
  const catTotals = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const cat of EXPENSE_CATEGORIES) {
    catTotals.set(cat, { amount: 0, count: 0 });
  }
  for (const exp of monthExpenses) {
    const cat: ExpenseCategory = EXPENSE_CATEGORIES.includes(exp.category)
      ? exp.category
      : 'অন্যান্য';
    const curr = catTotals.get(cat)!;
    curr.amount += Number(exp.amount) || 0;
    curr.count += 1;
  }

  const categoryBreakdown: CategoryExpenseBreakdownItem[] = EXPENSE_CATEGORIES.map((cat) => {
    const entry = catTotals.get(cat)!;
    const roundedAmt = Math.round(entry.amount * 100) / 100;
    const sharePercent =
      totalAmount > 0 ? Math.round((roundedAmt / totalAmount) * 1000) / 10 : 0;
    return {
      category: cat,
      amount: roundedAmt,
      count: entry.count,
      sharePercent,
    };
  });

  // Member aggregation
  const memberTotals = new Map<string, { name: string; amount: number; count: number }>();
  for (const exp of monthExpenses) {
    const pid = exp.patientId && exp.patientId.trim() ? exp.patientId.trim() : 'general';
    const patient = pid !== 'general' ? patientMap.get(pid) : undefined;
    const displayName = patient
      ? `${patient.name}${patient.relation ? ` (${patient.relation})` : ''}`
      : 'পরিবার / সাধারণ';

    const curr = memberTotals.get(pid) || { name: displayName, amount: 0, count: 0 };
    curr.amount += Number(exp.amount) || 0;
    curr.count += 1;
    memberTotals.set(pid, curr);
  }

  const memberBreakdown: MemberExpenseBreakdownItem[] = Array.from(memberTotals.entries())
    .map(([pid, entry]) => {
      const roundedAmt = Math.round(entry.amount * 100) / 100;
      const sharePercent =
        totalAmount > 0 ? Math.round((roundedAmt / totalAmount) * 1000) / 10 : 0;
      return {
        patientId: pid,
        patientName: entry.name,
        amount: roundedAmt,
        count: entry.count,
        sharePercent,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    monthKey,
    previousMonthKey,
    totalAmount,
    previousMonthTotal,
    transactionCount: monthExpenses.length,
    percentChange,
    changeDirection,
    categoryBreakdown,
    memberBreakdown,
    monthExpenses,
  };
}

export type BudgetAlertStatus = 'none' | 'warning_80' | 'exceeded_100';

export interface BudgetAlertState {
  status: BudgetAlertStatus;
  percentUsed: number;
  limit: number;
}

export function getBudgetAlertState(totalAmount: number, budgetLimit: number | null): BudgetAlertState {
  if (!budgetLimit || !Number.isFinite(budgetLimit) || budgetLimit <= 0) {
    return { status: 'none', percentUsed: 0, limit: 0 };
  }
  const safeTotal = Math.max(0, Number(totalAmount) || 0);
  const percentUsed = Math.round((safeTotal / budgetLimit) * 1000) / 10;
  if (safeTotal >= budgetLimit) {
    return { status: 'exceeded_100', percentUsed, limit: budgetLimit };
  }
  if (safeTotal >= budgetLimit * 0.8) {
    return { status: 'warning_80', percentUsed, limit: budgetLimit };
  }
  return { status: 'none', percentUsed, limit: budgetLimit };
}

export function computePrefilledMedicineCost(
  pricePerUnit?: number | null,
  addedQuantity?: number | null
): number | null {
  if (
    typeof pricePerUnit !== 'number' ||
    !Number.isFinite(pricePerUnit) ||
    pricePerUnit <= 0 ||
    typeof addedQuantity !== 'number' ||
    !Number.isFinite(addedQuantity) ||
    addedQuantity <= 0
  ) {
    return null;
  }
  return Math.round(pricePerUnit * addedQuantity * 100) / 100;
}

export function sanitizeCsvCell(val: unknown): string {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // Prevent CSV formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildExpensesCsvWithBom(
  expenses: Expense[],
  patients: PatientProfile[],
  isEn = false
): string {
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const headers = isEn
    ? ['Date', 'Category', 'Title', 'Member', 'Amount (BDT)', 'Notes']
    : ['তারিখ', 'ক্যাটাগরি', 'শিরোনাম', 'সদস্য', 'পরিমাণ (টাকা)', 'নোট'];

  const rows = expenses.map((exp) => {
    const patient = exp.patientId ? patientMap.get(exp.patientId) : undefined;
    const memberLabel = patient
      ? `${patient.name}${patient.relation ? ` (${patient.relation})` : ''}`
      : isEn
      ? 'Family / General'
      : 'পরিবার / সাধারণ';
    return [
      exp.expenseDate,
      exp.category,
      exp.title,
      memberLabel,
      Number.isFinite(exp.amount) ? exp.amount.toFixed(2) : '0.00',
      exp.notes || '',
    ]
      .map(sanitizeCsvCell)
      .join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function downloadExpensesCsv(
  expenses: Expense[],
  patients: PatientProfile[],
  monthKey: string,
  isEn = false
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const csv = buildExpensesCsvWithBom(expenses, patients, isEn);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shasthobondhu-expenses-${monthKey}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function loadMonthlyExpenseBudget(
  uid?: string | null,
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): number | null {
  if (!storage) return null;
  try {
    const key = `${EXPENSE_BUDGET_STORAGE_PREFIX}${uid || 'local'}`;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > MAX_EXPENSE_AMOUNT) return null;
    return Math.round(num * 100) / 100;
  } catch {
    return null;
  }
}

export function saveMonthlyExpenseBudget(
  uid: string | null | undefined,
  limit: number | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null
): void {
  if (!storage) return;
  try {
    const key = `${EXPENSE_BUDGET_STORAGE_PREFIX}${uid || 'local'}`;
    if (!limit || !Number.isFinite(limit) || limit <= 0) {
      storage.removeItem(key);
      return;
    }
    const clamped = Math.min(MAX_EXPENSE_AMOUNT, Math.round(limit * 100) / 100);
    storage.setItem(key, String(clamped));
  } catch {
    // ignore storage errors
  }
}
