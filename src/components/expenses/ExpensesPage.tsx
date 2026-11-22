import React, { useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { Expense, ExpenseCategory } from '../../types';
import { formatBengaliDate, toBengaliNumber } from '../../utils/bengaliUtils';
import {
  buildExpensesCsvWithBom,
  computeMonthlyExpenseAnalytics,
  downloadExpensesCsv,
  EXPENSE_CATEGORIES,
  formatCurrencyTk,
  formatMonthYearBn,
  getBudgetAlertState,
  getMonthKeyFromDate,
  loadMonthlyExpenseBudget,
  parseExpenseAmountInput,
  saveMonthlyExpenseBudget,
  shiftMonthKey,
} from '../../utils/expenseUtils';
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  PieChart,
  Users,
  Receipt,
  Calendar,
  Settings2,
} from 'lucide-react';

const CATEGORY_COLORS: Record<ExpenseCategory, { stroke: string; bar: string; dot: string }> = {
  'ওষুধ': {
    stroke: '#0F766E',
    bar: 'bg-teal-600 dark:bg-teal-500',
    dot: 'bg-teal-600 dark:bg-teal-400',
  },
  'ডাক্তারের ফি': {
    stroke: '#2563EB',
    bar: 'bg-blue-600 dark:bg-blue-500',
    dot: 'bg-blue-600 dark:bg-blue-400',
  },
  'পরীক্ষা (টেস্ট)': {
    stroke: '#7C3AED',
    bar: 'bg-violet-600 dark:bg-violet-500',
    dot: 'bg-violet-600 dark:bg-violet-400',
  },
  'হাসপাতাল': {
    stroke: '#D97706',
    bar: 'bg-amber-600 dark:bg-amber-500',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  'অন্যান্য': {
    stroke: '#64748B',
    bar: 'bg-slate-500 dark:bg-slate-400',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
};

const getLocalTodayIso = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ExpensesPage: React.FC = () => {
  const {
    expenses,
    isLoadingExpenses,
    loadExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    patients,
    activePatientId,
    currentUser,
    settings,
  } = useMedicine();

  const isEn = settings.language === 'en';
  const useBnDigits = !isEn;

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getMonthKeyFromDate());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<ExpenseCategory | 'all'>('all');

  // Budget state (local per-user storage)
  const [budgetLimit, setBudgetLimit] = useState<number | null>(() =>
    loadMonthlyExpenseBudget(currentUser?.uid)
  );
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetError, setBudgetError] = useState('');

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDate, setExpenseDate] = useState(getLocalTodayIso);
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('ওষুধ');
  const [patientId, setPatientId] = useState<string>(activePatientId || '');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // In-app delete confirmation state (no window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadExpenses();
  }, [currentUser?.uid]);

  useEffect(() => {
    setBudgetLimit(loadMonthlyExpenseBudget(currentUser?.uid));
  }, [currentUser?.uid]);

  const analytics = useMemo(
    () => computeMonthlyExpenseAnalytics(expenses, selectedMonth, patients),
    [expenses, selectedMonth, patients]
  );

  const budgetAlert = useMemo(
    () => getBudgetAlertState(analytics.totalAmount, budgetLimit),
    [analytics.totalAmount, budgetLimit]
  );

  const filteredMonthExpenses = useMemo(() => {
    if (selectedCategoryFilter === 'all') return analytics.monthExpenses;
    return analytics.monthExpenses.filter((exp) => exp.category === selectedCategoryFilter);
  }, [analytics.monthExpenses, selectedCategoryFilter]);

  const patientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      map.set(p.id, p.relation ? `${p.name} (${p.relation})` : p.name);
    }
    return map;
  }, [patients]);

  const openAddModal = () => {
    setEditingExpense(null);
    setExpenseDate(getLocalTodayIso());
    setAmountInput('');
    setCategory('ওষুধ');
    setPatientId(activePatientId || '');
    setTitle('');
    setNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseDate(exp.expenseDate || getLocalTodayIso());
    setAmountInput(String(exp.amount));
    setCategory(exp.category);
    setPatientId(exp.patientId || '');
    setTitle(exp.title);
    setNotes(exp.notes || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedAmount = parseExpenseAmountInput(amountInput, { allowZero: true });
    if (!parsedAmount.valid || parsedAmount.amount === null) {
      setFormError(parsedAmount.error || 'সঠিক পরিমাণ লিখুন');
      return;
    }

    if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      setFormError('সঠিক তারিখ নির্বাচন করুন');
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('খরচের শিরোনাম লিখুন');
      return;
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        expenseDate,
        amount: parsedAmount.amount,
        category,
        patientId: patientId || undefined,
        title: cleanTitle,
        notes: notes.trim() || undefined,
      });
    } else {
      addExpense({
        expenseDate,
        amount: parsedAmount.amount,
        category,
        patientId: patientId || undefined,
        title: cleanTitle,
        notes: notes.trim() || undefined,
      });
      setSelectedMonth(getMonthKeyFromDate(expenseDate));
    }

    setIsFormOpen(false);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetError('');
    const parsed = parseExpenseAmountInput(budgetInput, { allowZero: false });
    if (!parsed.valid || parsed.amount === null) {
      setBudgetError(parsed.error || 'সঠিক বাজেট পরিমাণ লিখুন');
      return;
    }
    saveMonthlyExpenseBudget(currentUser?.uid, parsed.amount);
    setBudgetLimit(parsed.amount);
    setIsEditingBudget(false);
  };

  const handleClearBudget = () => {
    saveMonthlyExpenseBudget(currentUser?.uid, null);
    setBudgetLimit(null);
    setBudgetInput('');
    setBudgetError('');
    setIsEditingBudget(false);
  };

  // Donut chart segments for SVG
  const donutSegments = useMemo(() => {
    if (analytics.totalAmount <= 0) return [];
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    let cumulativeOffset = 0;

    return analytics.categoryBreakdown
      .filter((item) => item.amount > 0)
      .map((item) => {
        const fraction = item.amount / analytics.totalAmount;
        const dashLength = fraction * circumference;
        const segment = {
          category: item.category,
          stroke: CATEGORY_COLORS[item.category].stroke,
          dashArray: `${dashLength} ${circumference - dashLength}`,
          dashOffset: -cumulativeOffset,
        };
        cumulativeOffset += dashLength;
        return segment;
      });
  }, [analytics]);

  const handleDownloadCsv = () => {
    if (analytics.monthExpenses.length === 0) return;
    void buildExpensesCsvWithBom;
    downloadExpensesCsv(analytics.monthExpenses, patients, selectedMonth, isEn);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header & Actions */}
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              পরিবারের খরচ হিসাব
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              ওষুধ, ডাক্তারের ফি, পরীক্ষা ও হাসপাতালের মাসিক চিকিৎসা খরচের হিসাব
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={analytics.monthExpenses.length === 0}
            className="min-h-[44px] px-4 py-2 bg-surface-2 hover:bg-border/60 disabled:opacity-45 border border-border text-text font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>CSV ডাউনলোড</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>খরচ যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Month Switcher + Budget Controls */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
            aria-label="আগের মাস"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 hover:bg-border/60 border border-border text-text cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-[165px] text-center px-3">
            <span className="text-base sm:text-lg font-bold text-text block">
              {formatMonthYearBn(selectedMonth, isEn)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth((m) => shiftMonthKey(m, 1))}
            aria-label="পরের মাস"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 hover:bg-border/60 border border-border text-text cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Optional Monthly Budget Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {budgetLimit !== null && !isEditingBudget && (
            <span className="text-xs sm:text-sm font-semibold text-text-muted tabular-nums">
              মাসিক বাজেট:{' '}
              <strong className="text-text">{formatCurrencyTk(budgetLimit, useBnDigits)}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setBudgetInput(budgetLimit ? String(budgetLimit) : '');
              setBudgetError('');
              setIsEditingBudget((prev) => !prev);
            }}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{budgetLimit ? 'বাজেট বদলান' : 'মাসিক বাজেট সেট করুন'}</span>
          </button>
        </div>
      </div>

      {/* Inline Budget Editor */}
      {isEditingBudget && (
        <form
          onSubmit={handleSaveBudget}
          className="bg-surface border border-primary/30 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-text">
              মাসিক সর্বোচ্চ বাজেট নির্ধারণ (ঐচ্ছিক)
            </span>
            <button
              type="button"
              onClick={() => setIsEditingBudget(false)}
              className="p-1 text-text-muted hover:text-text cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {budgetError && (
            <p className="text-xs text-danger-text font-medium">{budgetError}</p>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              inputMode="decimal"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="যেমন: ১০০০০ বা 10000"
              className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 text-sm bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap shrink-0"
            >
              সংরক্ষণ করুন
            </button>
            {budgetLimit !== null && (
              <button
                type="button"
                onClick={handleClearBudget}
                className="min-h-[44px] px-3.5 py-2 bg-danger-soft text-danger-text border border-danger/30 text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap shrink-0"
              >
                বাজেট মুছুন
              </button>
            )}
          </div>
        </form>
      )}

      {/* Budget Alert Banners (80% Warning / 100%+ Exceeded) */}
      {budgetAlert.status === 'exceeded_100' && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-danger-soft border border-danger/35 text-danger-text flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-0.5">
            <p className="font-bold">
              মাসিক বাজেট সীমা অতিক্রম করেছে ({toBengaliNumber(budgetAlert.percentUsed)}%)
            </p>
            <p>
              এই মাসের খরচ ({formatCurrencyTk(analytics.totalAmount, useBnDigits)}) আপনার নির্ধারিত বাজেট (
              {formatCurrencyTk(budgetAlert.limit, useBnDigits)}) ছাড়িয়ে গেছে।
            </p>
          </div>
        </div>
      )}

      {budgetAlert.status === 'warning_80' && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-warning-soft border border-warning/35 text-warning-text flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-0.5">
            <p className="font-bold">
              বাজেটের {toBengaliNumber(budgetAlert.percentUsed)}% খরচ হয়ে গেছে
            </p>
            <p>
              মাসিক বাজেট {formatCurrencyTk(budgetAlert.limit, useBnDigits)} এর মধ্যে{' '}
              {formatCurrencyTk(analytics.totalAmount, useBnDigits)} খরচ হয়েছে।
            </p>
          </div>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-1.5">
          <span className="text-xs font-medium text-text-muted block">
            মোট মাসিক খরচ
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-text tabular-nums">
            {formatCurrencyTk(analytics.totalAmount, useBnDigits)}
          </div>
          {budgetLimit !== null && (
            <div className="pt-1.5 space-y-1">
              <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetAlert.status === 'exceeded_100'
                      ? 'bg-danger'
                      : budgetAlert.status === 'warning_80'
                      ? 'bg-warning'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, budgetAlert.percentUsed)}%` }}
                />
              </div>
              <span className="text-[11px] text-text-muted tabular-nums block">
                বাজেটের {toBengaliNumber(budgetAlert.percentUsed)}% ব্যবহৃত
              </span>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-1.5">
          <span className="text-xs font-medium text-text-muted block">
            গত মাসের তুলনায় ({formatMonthYearBn(analytics.previousMonthKey, isEn)})
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            {analytics.changeDirection === 'up' && analytics.percentChange !== null && (
              <span className="inline-flex items-center gap-1 text-base sm:text-lg font-bold text-danger-text tabular-nums">
                <TrendingUp className="w-5 h-5" />
                <span>{toBengaliNumber(analytics.percentChange)}% বেশি</span>
              </span>
            )}
            {analytics.changeDirection === 'down' && analytics.percentChange !== null && (
              <span className="inline-flex items-center gap-1 text-base sm:text-lg font-bold text-success-text tabular-nums">
                <TrendingDown className="w-5 h-5" />
                <span>{toBengaliNumber(analytics.percentChange)}% কম</span>
              </span>
            )}
            {analytics.changeDirection === 'same' && (
              <span className="inline-flex items-center gap-1 text-base font-bold text-text tabular-nums">
                <Minus className="w-4 h-4" />
                <span>গত মাসের সমান</span>
              </span>
            )}
            {analytics.changeDirection === 'none' && (
              <span className="text-sm font-semibold text-text-muted">
                গত মাসের হিসাব নেই
              </span>
            )}
          </div>
          <span className="text-xs text-text-muted tabular-nums block">
            গত মাসে খরচ: {formatCurrencyTk(analytics.previousMonthTotal, useBnDigits)}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-1.5">
          <span className="text-xs font-medium text-text-muted block">
            এই মাসের লেনদেন
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-text tabular-nums">
            {toBengaliNumber(analytics.transactionCount)} <span className="text-sm font-medium text-text-muted">টি</span>
          </div>
          <span className="text-xs text-text-muted block">
            শুধু আপনার ব্যক্তিগত অ্যাকাউন্টে সংরক্ষিত
          </span>
        </div>
      </div>

      {/* Breakdowns Grid: Category Donut/Bars & Family Member Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Breakdown */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <PieChart className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">ক্যাটাগরি অনুযায়ী ভাগ</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Simple Clean SVG Donut */}
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  className="text-surface-2"
                  strokeWidth="16"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.category}
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke={seg.stroke}
                    strokeWidth="16"
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] text-text-muted">মোট</span>
                <span className="text-xs font-bold text-text tabular-nums">
                  {formatCurrencyTk(analytics.totalAmount, useBnDigits)}
                </span>
              </div>
            </div>

            {/* Category Bars */}
            <div className="flex-1 w-full space-y-2.5">
              {analytics.categoryBreakdown.map((item) => {
                const palette = CATEGORY_COLORS[item.category];
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-text">
                        <span className={`w-2.5 h-2.5 rounded-full ${palette.dot}`} />
                        <span>{item.category}</span>
                      </span>
                      <span className="text-text font-bold tabular-nums">
                        {formatCurrencyTk(item.amount, useBnDigits)}{' '}
                        <span className="text-text-muted font-normal">
                          ({toBengaliNumber(item.sharePercent)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${palette.bar}`}
                        style={{ width: `${Math.max(item.amount > 0 ? 3 : 0, item.sharePercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Member Breakdown */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">সদস্য অনুযায়ী ভাগ</h2>
          </div>

          {analytics.memberBreakdown.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted border border-dashed border-border rounded-xl">
              এই মাসে সদস্য অনুযায়ী কোনো খরচের তথ্য নেই
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.memberBreakdown.map((member) => (
                <div key={member.patientId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-text truncate">
                      {member.patientName}{' '}
                      <span className="text-text-muted font-normal">
                        ({toBengaliNumber(member.count)}টি)
                      </span>
                    </span>
                    <span className="font-bold text-text tabular-nums shrink-0">
                      {formatCurrencyTk(member.amount, useBnDigits)}{' '}
                      <span className="text-text-muted font-normal">
                        ({toBengaliNumber(member.sharePercent)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(member.amount > 0 ? 4 : 0, member.sharePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Expense List */}
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">
              খরচের তালিকা ({toBengaliNumber(filteredMonthExpenses.length)}টি)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              সব
            </button>
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-2 text-text-muted hover:text-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoadingExpenses && analytics.monthExpenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>খরচের হিসাব লোড হচ্ছে…</span>
          </div>
        ) : filteredMonthExpenses.length === 0 ? (
          <div className="p-8 text-center space-y-3 border border-dashed border-border rounded-2xl">
            <p className="text-sm font-medium text-text-muted">
              এই মাসে এখনো কোনো খরচ যোগ করা হয়নি
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-4 py-2 bg-primary-soft text-primary border border-primary/25 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>প্রথম খরচ যোগ করুন</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredMonthExpenses.map((exp) => {
              const memberLabel = exp.patientId
                ? patientNameMap.get(exp.patientId) || 'পরিবারের সদস্য'
                : 'পরিবার / সাধারণ';
              const isConfirming = confirmDeleteId === exp.id;
              return (
                <div
                  key={exp.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-surface-2/80 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-text">{exp.title}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                        {exp.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>{formatBengaliDate(exp.expenseDate)}</span>
                      </span>
                      <span>সদস্য: {memberLabel}</span>
                      {exp.notes && <span className="italic">"{exp.notes}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-base sm:text-lg font-bold text-text tabular-nums">
                      {formatCurrencyTk(exp.amount, useBnDigits)}
                    </span>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            deleteExpense(exp.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1.5 bg-danger text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          নিশ্চিত মুছুন
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 bg-surface border border-border text-text-muted text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          বাতিল
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-surface cursor-pointer"
                          aria-label={`${exp.title} সম্পাদনা`}
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(exp.id)}
                          className="p-2 rounded-lg text-text-muted hover:text-danger-text hover:bg-danger-soft cursor-pointer"
                          aria-label={`${exp.title} মুছুন`}
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add / Edit Expense Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
              <h2 className="text-lg font-bold text-text">
                {editingExpense ? 'খরচ সম্পাদনা করুন' : 'নতুন খরচ যোগ করুন'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-xs text-danger-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-text mb-1">তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-text mb-1">
                    পরিমাণ (৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="যেমন: ৩৫০ বা 350"
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-bold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-text mb-1">ক্যাটাগরি *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-text mb-1">সদস্য (ঐচ্ছিক)</label>
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    <option value="">পরিবার / সাধারণ</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.relation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text mb-1">শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: নাপা ৫০০ ও সেকলো ক্রয় / ডা. করিমের চেম্বার ফি"
                  className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-text mb-1">নোট (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="অতিরিক্ত বিবরণ যেমন ফার্মেসি বা হাসপাতালের নাম"
                  className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-text-muted hover:bg-surface-2 rounded-xl font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingExpense ? 'হালনাগাদ করুন' : 'খরচ সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
