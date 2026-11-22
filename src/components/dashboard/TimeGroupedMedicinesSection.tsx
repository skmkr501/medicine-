import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  Plus,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { buildProfileTimeSummary } from '../../utils/dailyScheduleSummary';
import { MedicineSlipModal } from './MedicineSlipModal';
import { MedicineBadgeIcon } from '../medicines/MedicineBadgeIcon';

interface TimeGroupedMedicinesSectionProps {
  todayStr: string;
}

const COLLAPSE_THRESHOLD = 4;

export const TimeGroupedMedicinesSection: React.FC<TimeGroupedMedicinesSectionProps> = ({
  todayStr,
}) => {
  const {
    medicines,
    doseLogs,
    activePatient,
    setCurrentPage,
  } = useMedicine();

  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  const medicineById = useMemo(() => {
    const map = new Map<string, (typeof medicines)[number]>();
    medicines.forEach((m) => map.set(m.id, m));
    return map;
  }, [medicines]);

  const summary = useMemo(
    () =>
      buildProfileTimeSummary({
        medicines,
        doseLogs,
        patientId: activePatient?.id ?? null,
        todayStr,
      }),
    [medicines, doseLogs, activePatient?.id, todayStr]
  );

  const hasAnyActiveMedicineAcrossApp = useMemo(
    () => medicines.some((m) => m.status === 'active'),
    [medicines]
  );

  const toggleExpand = (key: string) => {
    setExpandedBuckets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const hasAnyForProfile =
    summary.buckets.length > 0 || summary.asNeededItems.length > 0;

  return (
    <section className="space-y-4" aria-label="সময় অনুযায়ী ওষুধ">
      {/* Section Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-text">
          সময় অনুযায়ী ওষুধ
        </h2>
        {activePatient && (
          <span className="text-sm sm:text-base font-medium text-text-muted">
            {activePatient.name}
          </span>
        )}
      </div>

      {!hasAnyForProfile ? (
        <div className="bg-surface border border-border rounded-2xl p-6 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-text">
              এই প্রোফাইলের কোনো চলমান ওষুধ নেই
            </p>
            <p className="text-base text-text-muted">
              ওষুধ যোগ করলে সকাল, দুপুর, সন্ধ্যা ও রাত অনুযায়ী এখানে সাজানো দেখতে পাবেন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>ওষুধ যোগ করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {summary.buckets.map((bucket) => {
            const isExpanded = Boolean(expandedBuckets[bucket.key]);
            const needsCollapse = bucket.items.length > COLLAPSE_THRESHOLD;
            const visibleItems =
              needsCollapse && !isExpanded
                ? bucket.items.slice(0, COLLAPSE_THRESHOLD)
                : bucket.items;
            const hiddenCount = bucket.items.length - COLLAPSE_THRESHOLD;

            return (
              <div
                key={bucket.key}
                className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3"
              >
                <div className="space-y-3">
                  {/* Bucket Box Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                    <div className="text-base sm:text-lg font-bold text-text flex items-center gap-1.5">
                      <span aria-hidden="true">{bucket.emoji}</span>
                      <span>
                        {bucket.titleBn}
                        {bucket.representativeClockBn
                          ? ` · ${bucket.representativeClockBn}`
                          : ''}
                      </span>
                    </div>

                    <div
                      className={`text-sm font-bold inline-flex items-center gap-1 shrink-0 ${
                        bucket.isAllTaken
                          ? 'text-success-text'
                          : 'text-text-muted'
                      }`}
                    >
                      {bucket.isAllTaken && (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {toBengaliNumber(bucket.takenCount)}/
                        {toBengaliNumber(bucket.totalCount)} খাওয়া হয়েছে
                      </span>
                    </div>
                  </div>

                  {/* Medicine Lines */}
                  <ul className="divide-y divide-border/70">
                    {visibleItems.map((item) => {
                      const med = medicineById.get(item.medicineId);
                      return (
                        <li
                          key={item.key}
                          className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-base sm:text-lg"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            {item.isTaken ? (
                              <CheckCircle2
                                className="w-4 h-4 text-success-text shrink-0"
                                aria-label="খাওয়া হয়েছে"
                              />
                            ) : (
                              <MedicineBadgeIcon
                                iconTag={med?.iconTag}
                                type={med?.type}
                                colorTag={med?.colorTag}
                                size="xs"
                              />
                            )}
                            <span
                              className={`font-bold truncate ${
                                item.isTaken
                                  ? 'text-text-muted line-through'
                                  : 'text-text'
                              }`}
                            >
                              {item.brandName}
                            </span>
                          </div>

                        <div className="shrink-0 flex items-center gap-1.5 text-sm sm:text-base text-text-muted font-semibold">
                          <span>{item.dosage}</span>
                          {item.shortMealTimingBn && (
                            <>
                              <span aria-hidden="true" className="opacity-60">
                                ·
                              </span>
                              <span className="text-primary">
                                {item.shortMealTimingBn}
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </div>

                {needsCollapse && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(bucket.key)}
                    className="min-h-[44px] w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-bold text-primary bg-primary-soft hover:bg-primary/15 rounded-xl transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <span>কম দেখান</span>
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>আরও {toBengaliNumber(hiddenCount)} টি</span>
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {/* Separate As-Needed ("প্রয়োজনে") Box */}
          {summary.asNeededItems.length > 0 && (() => {
            const isExpanded = Boolean(expandedBuckets['as_needed']);
            const needsCollapse = summary.asNeededItems.length > COLLAPSE_THRESHOLD;
            const visibleAsNeeded =
              needsCollapse && !isExpanded
                ? summary.asNeededItems.slice(0, COLLAPSE_THRESHOLD)
                : summary.asNeededItems;
            const hiddenCount = summary.asNeededItems.length - COLLAPSE_THRESHOLD;

            return (
              <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                    <span className="text-base sm:text-lg font-bold text-text">
                      প্রয়োজনে
                    </span>
                    <span className="text-sm font-semibold text-text-muted">
                      {toBengaliNumber(summary.asNeededItems.length)}টি ওষুধ
                    </span>
                  </div>

                  <ul className="divide-y divide-border/70">
                    {visibleAsNeeded.map((item) => {
                      const med = medicineById.get(item.medicineId);
                      return (
                        <li
                          key={item.medicineId}
                          className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-base sm:text-lg"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <MedicineBadgeIcon
                              iconTag={med?.iconTag}
                              type={med?.type}
                              colorTag={med?.colorTag}
                              size="xs"
                            />
                            <span className="font-bold text-text truncate">
                              {item.brandName}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm sm:text-base font-semibold text-text-muted">
                            {item.dosageHint}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {needsCollapse && (
                  <button
                    type="button"
                    onClick={() => toggleExpand('as_needed')}
                    className="min-h-[44px] w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-bold text-primary bg-primary-soft hover:bg-primary/15 rounded-xl transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <span>কম দেখান</span>
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>আরও {toBengaliNumber(hiddenCount)} টি</span>
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Slip Download / Print Button & Weekly Pillbox Link below Time Boxes */}
      {(hasAnyForProfile || hasAnyActiveMedicineAcrossApp) && (
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSlipModalOpen(true)}
            className="min-h-[52px] w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-surface border-2 border-primary text-primary hover:bg-primary-soft rounded-2xl text-base font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <span>📄 ওষুধের স্লিপ নামান</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('weekly-pillbox')}
            className="min-h-[52px] w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-primary-soft border border-primary/25 text-primary hover:bg-primary/15 rounded-2xl text-base font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <CalendarDays className="w-5 h-5 text-primary shrink-0" />
            <span>সাপ্তাহিক পিলবক্স দেখুন</span>
          </button>
        </div>
      )}

      <MedicineSlipModal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        todayStr={todayStr}
      />
    </section>
  );
};
