import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Pill,
  Plus,
  Printer,
  User,
  X,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { toLocalIsoDate } from '../../utils/shoppingListCalculator';
import { DOSE_LOG_REALTIME_DAYS, getDoseLogsCutoffDate } from '../../utils/cloudReadOptimizer';
import {
  PillboxDoseItem,
  PillboxWeekDay,
  addWeeksToLocalDate,
  buildWeeklyPillbox,
  getWeekStartDate,
} from '../../utils/weeklyPillbox';
import { WeeklyPillboxPrintModal } from './WeeklyPillboxPrintModal';

interface SelectedCellDetail {
  day: PillboxWeekDay;
  rowTitleBn: string;
  rowEmoji: string;
  items: PillboxDoseItem[];
}

export const WeeklyPillboxView: React.FC = () => {
  const {
    medicines,
    doseLogs,
    patients,
    activePatient,
    activePatientId,
    setActivePatientId,
    settings,
    setCurrentPage,
    loadOlderDoseLogs,
  } = useMedicine();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCellDetail | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const weekStartDay = settings.weekStartDay || 'saturday';
  const todayStr = toLocalIsoDate(new Date());

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const currentWeekStart = useMemo(() => {
    const baseStart = getWeekStartDate(todayStr, weekStartDay);
    return addWeeksToLocalDate(baseStart, weekOffset);
  }, [todayStr, weekStartDay, weekOffset]);

  useEffect(() => {
    const cutoff45Days = getDoseLogsCutoffDate(DOSE_LOG_REALTIME_DAYS);
    if (toLocalIsoDate(currentWeekStart) < cutoff45Days) {
      loadOlderDoseLogs();
    }
  }, [currentWeekStart]);

  const pillboxData = useMemo(
    () =>
      buildWeeklyPillbox({
        medicines,
        doseLogs,
        patientId: activePatient?.id ?? null,
        weekStartDate: currentWeekStart,
        weekStartDay,
        todayStr,
      }),
    [medicines, doseLogs, activePatient?.id, currentWeekStart, weekStartDay, todayStr]
  );

  const profileDisplayName = activePatient ? activePatient.name : 'সকল প্রোফাইল';
  const hasAnyGridItems = pillboxData.visibleRows.length > 0;
  const hasAsNeeded = pillboxData.asNeededItems.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation & Title Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCurrentPage('medicines')}
            className="min-h-[48px] inline-flex items-center gap-2 px-3 -ml-3 rounded-xl text-base font-semibold text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ওষুধের তালিকায় ফিরুন</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text flex items-center gap-2.5">
              <CalendarDays className="w-7 h-7 text-primary shrink-0" />
              <span>সাপ্তাহিক পিলবক্স</span>
            </h1>
            <span className="text-base font-semibold text-primary">
              ({profileDisplayName})
            </span>
          </div>
        </div>

        {/* Actions: Profile Switcher (if multiple) + Print Sheet CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {activePatients.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-text-muted shrink-0" />
              <select
                value={activePatientId || ''}
                onChange={(e) => setActivePatientId(e.target.value || null)}
                aria-label="রোগী পরিবর্তন করুন"
                className="min-h-[48px] bg-surface border border-border rounded-xl px-3.5 py-2 text-base font-semibold text-text focus:outline-hidden focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="">সকল প্রোফাইল</option>
                {activePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relation})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(hasAnyGridItems || hasAsNeeded) && (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="min-h-[52px] inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              <span>পিলবক্স শিট নামান</span>
            </button>
          )}
        </div>
      </div>

      {/* Week Navigation Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-muted">
            {weekOffset === 0
              ? 'চলতি সপ্তাহ'
              : weekOffset < 0
              ? `${toBengaliNumber(Math.abs(weekOffset))} সপ্তাহ আগে`
              : `${toBengaliNumber(weekOffset)} সপ্তাহ পরে`}
          </p>
          <p className="text-lg sm:text-xl font-bold text-text mt-0.5">
            {pillboxData.weekRangeBn}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-2 hover:bg-border/60 border border-border rounded-xl text-base font-bold text-text transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>আগের</span>
          </button>

          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-base font-bold border transition-colors cursor-pointer ${
              weekOffset === 0
                ? 'bg-primary-soft text-primary border-primary/30 cursor-default'
                : 'bg-surface hover:bg-surface-2 text-text border-border'
            }`}
          >
            আজ
          </button>

          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-2 hover:bg-border/60 border border-border rounded-xl text-base font-bold text-text transition-colors cursor-pointer"
          >
            <span>পরের</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Weekly Grid or Empty State */}
      {!hasAnyGridItems && !hasAsNeeded ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <Pill className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-text">
              এই সপ্তাহে কোনো নির্ধারিত ওষুধ নেই
            </h2>
            <p className="text-base text-text-muted">
              নতুন ওষুধ যোগ করুন অথবা আগের বা পরের সপ্তাহে আপনার চলমান ওষুধ দেখুন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>নতুন ওষুধ যোগ করুন</span>
          </button>
        </div>
      ) : (
        <>
          {hasAnyGridItems && (
            <div className="space-y-2.5">
              <div className="bg-surface border border-border rounded-2xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/70">
                        <th className="sticky left-0 z-20 bg-surface-2 w-[124px] px-3 py-3.5 text-left text-base font-bold text-text border-r border-border">
                          সময়
                        </th>
                        {pillboxData.days.map((day) => (
                          <th
                            key={day.iso}
                            className={`px-2.5 py-3 text-center border-r last:border-r-0 border-border transition-colors ${
                              day.isToday
                                ? 'bg-primary-soft text-primary border-b-2 border-b-primary'
                                : 'text-text'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-base font-bold">
                                {day.weekdayShortBn}
                              </span>
                              {day.isToday && (
                                <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-primary text-on-primary">
                                  আজ
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-sm font-medium mt-0.5 ${
                                day.isToday ? 'text-primary font-bold' : 'text-text-muted'
                              }`}
                            >
                              {day.shortDateBn}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {pillboxData.visibleRows.map((row) => (
                        <tr key={row.key}>
                          {/* Sticky Time Bucket Row Header */}
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-surface px-3 py-3.5 text-left align-top border-r border-border"
                          >
                            <div className="flex items-center gap-1.5 text-base font-bold text-text">
                              <span aria-hidden="true">{row.emoji}</span>
                              <span>{row.titleBn}</span>
                            </div>
                            <div className="text-xs font-medium text-text-muted mt-1">
                              {row.rangeLabelBn}
                            </div>
                          </th>

                          {/* 7 Day Cells */}
                          {pillboxData.days.map((day) => {
                            const cellItems = row.cellsByDayIso[day.iso] || [];
                            const visibleChips = cellItems.slice(0, 3);
                            const remainingCount = cellItems.length - 3;

                            return (
                              <td
                                key={day.iso}
                                className={`p-1.5 align-top border-r last:border-r-0 border-border ${
                                  day.isToday ? 'bg-primary-soft/35' : ''
                                }`}
                              >
                                {cellItems.length === 0 ? (
                                  <div className="min-h-[80px] flex items-center justify-center text-text-muted/50 text-base select-none">
                                    —
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedCell({
                                        day,
                                        rowTitleBn: row.titleBn,
                                        rowEmoji: row.emoji,
                                        items: cellItems,
                                      })
                                    }
                                    aria-label={`${day.weekdayFullBn} ${day.shortDateBn} ${row.titleBn} — ${toBengaliNumber(cellItems.length)}টি ওষুধ`}
                                    className="w-full min-h-[80px] p-1.5 rounded-xl text-left flex flex-col gap-1.5 hover:bg-surface-2/90 focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors cursor-pointer"
                                  >
                                    {visibleChips.map((item) => (
                                      <span
                                        key={item.key}
                                        className={`w-full inline-flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-sm font-semibold border ${
                                          item.logStatus === 'taken'
                                            ? 'bg-success-soft text-success-text border-success/30'
                                            : item.logStatus === 'missed'
                                            ? 'bg-danger-soft text-danger-text border-danger/30'
                                            : 'bg-surface-2 text-text border-border'
                                        }`}
                                      >
                                        <span className="truncate">{item.chipLabel}</span>
                                        {item.logStatus === 'taken' && (
                                          <Check
                                            className="w-3.5 h-3.5 shrink-0 stroke-[2.5]"
                                            aria-label="খাওয়া হয়েছে"
                                          />
                                        )}
                                        {item.logStatus === 'missed' && (
                                          <X
                                            className="w-3.5 h-3.5 shrink-0 stroke-[2.5]"
                                            aria-label="বাদ পড়েছে"
                                          />
                                        )}
                                      </span>
                                    ))}

                                    {remainingCount > 0 && (
                                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-bold bg-primary-soft text-primary self-start">
                                        +{toBengaliNumber(remainingCount)} আরও
                                      </span>
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Concise Status Legend */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted px-1">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-success-text stroke-[2.5]" />
                  <span>খাওয়া রেকর্ড আছে</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <X className="w-4 h-4 text-danger-text stroke-[2.5]" />
                  <span>বাদ/মিস রেকর্ড আছে</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary" />
                  <span>ঘরে চাপ দিলে বিস্তারিত দেখা যাবে</span>
                </span>
              </div>
            </div>
          )}

          {/* Separate As-Needed ("প্রয়োজনে") List */}
          {hasAsNeeded && (
            <section
              className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-3"
              aria-label="প্রয়োজনে খাওয়ার ওষুধ"
            >
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                <h2 className="text-lg font-bold text-text">প্রয়োজনে</h2>
                <span className="text-sm font-semibold text-text-muted">
                  {toBengaliNumber(pillboxData.asNeededItems.length)}টি ওষুধ
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pillboxData.asNeededItems.map((item) => (
                  <div
                    key={item.medicineId}
                    className="p-3.5 rounded-xl bg-surface-2/70 border border-border flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-bold text-text truncate">
                        {item.brandName}
                      </p>
                      {(item.strength || item.genericName) && (
                        <p className="text-sm text-text-muted truncate">
                          {[item.strength, item.genericName].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {item.instructions && (
                        <p className="text-sm text-text-muted mt-1">{item.instructions}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {item.dosageHint}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Weekly Totals Summary Card */}
          {pillboxData.weeklyTotals.length > 0 && (
            <section
              className="bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-3"
              aria-label="এই সপ্তাহের মোট ওষুধের হিসাব"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
                <h2 className="text-lg font-bold text-text">
                  এই সপ্তাহের মোট ওষুধের হিসাব
                </h2>
                <span className="text-sm font-medium text-text-muted">
                  পিলবক্স সাজানোর জন্য
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {pillboxData.weeklyTotals.map((tot) => (
                  <div
                    key={tot.medicineId}
                    className="px-3.5 py-2.5 rounded-xl bg-surface-2/70 border border-border text-base font-semibold text-text"
                  >
                    {tot.summaryLabelBn}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Cell Detail Bottom Sheet / Modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="নির্ধারিত ওষুধের বিস্তারিত"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="bg-surface border border-border w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 bg-surface-2/60">
              <div>
                <div className="text-lg font-bold text-text flex items-center gap-2">
                  <span aria-hidden="true">{selectedCell.rowEmoji}</span>
                  <span>
                    {selectedCell.day.weekdayFullBn}, {selectedCell.day.shortDateBn}
                  </span>
                </div>
                <p className="text-sm font-medium text-text-muted mt-0.5">
                  {selectedCell.rowTitleBn} · মোট{' '}
                  {toBengaliNumber(selectedCell.items.length)}টি ডোজ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="বন্ধ করুন"
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Medicine List inside Cell */}
            <div className="p-5 overflow-y-auto space-y-3">
              {selectedCell.items.map((item) => (
                <div
                  key={item.key}
                  className="p-4 rounded-xl bg-surface-2/60 border border-border space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-text">
                        {item.brandName}
                        {item.strength ? ` (${item.strength})` : ''}
                      </h3>
                      {item.genericName && (
                        <p className="text-sm text-text-muted">{item.genericName}</p>
                      )}
                    </div>

                    {item.logStatus === 'taken' && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-success-soft text-success-text">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>খাওয়া হয়েছে</span>
                      </span>
                    )}
                    {item.logStatus === 'missed' && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-danger-soft text-danger-text">
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>বাদ পড়েছে</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-text">
                    <span className="font-bold text-primary">
                      ডোজ: {item.dosage}
                    </span>
                    <span className="text-text-muted font-medium">
                      {item.mealTiming}
                    </span>
                    {item.clockTimeBn && (
                      <span className="inline-flex items-center gap-1 text-sm text-text-muted">
                        <Clock className="w-4 h-4" />
                        <span>{item.clockTimeBn}</span>
                      </span>
                    )}
                  </div>

                  {item.instructions && (
                    <p className="text-sm text-text-muted pt-1 border-t border-border/60">
                      নির্দেশনা: {item.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border bg-surface">
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="min-h-[48px] w-full rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-base font-bold transition-colors cursor-pointer"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Landscape Print Preview Modal */}
      <WeeklyPillboxPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={pillboxData}
        patientName={profileDisplayName}
      />
    </div>
  );
};
