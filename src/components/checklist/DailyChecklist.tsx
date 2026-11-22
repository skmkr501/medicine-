import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { MedicineIconTag, TimeSlot } from '../../types';
import { MedicineBadgeIcon } from '../medicines/MedicineBadgeIcon';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  CalendarCheck,
  RotateCcw,
  Pill,
  Check,
  X,
  Filter,
  UserCheck,
} from 'lucide-react';

export const DailyChecklist: React.FC = () => {
  const {
    medicines,
    doseLogs,
    activePatient,
    patients,
    setActivePatientId,
    markDose,
    setCurrentPage,
  } = useMedicine();

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');

  const todayStr = '2026-11-02';

  // Gather active patient medicines or all active
  const patientMedicines = useMemo(() => {
    return activePatient
      ? medicines.filter(
          (m) => m.assignedPatientId === activePatient.id && m.status === 'active'
        )
      : medicines.filter((m) => m.status === 'active');
  }, [medicines, activePatient]);

  // Compile checklist items
  interface ChecklistItem {
    medicineId: string;
    brandName: string;
    genericName: string;
    type: string;
    strength: string;
    timeSlot: TimeSlot;
    time: string;
    dosage: string;
    mealTiming: string;
    stock: number;
    unit: string;
    colorTag: string;
    iconTag?: MedicineIconTag;
    status: 'taken' | 'skipped' | 'missed' | 'pending';
    logId?: string;
  }

  const checklistItems = useMemo(() => {
    const list: ChecklistItem[] = [];

    patientMedicines.forEach((med) => {
      med.schedules.forEach((sch) => {
        const log = doseLogs.find(
          (l) =>
            l.medicineId === med.id &&
            l.scheduledDate === todayStr &&
            l.timeSlot === sch.timeSlot &&
            (!activePatient || l.patientId === activePatient.id)
        );

        list.push({
          medicineId: med.id,
          brandName: med.brandName,
          genericName: med.genericName,
          type: med.type,
          strength: med.strength,
          timeSlot: sch.timeSlot,
          time: sch.time,
          dosage: sch.dosage,
          mealTiming: med.mealTiming,
          stock: med.stock,
          unit: med.unit,
          colorTag: med.colorTag,
          iconTag: med.iconTag,
          status: log?.status || 'pending',
          logId: log?.id,
        });
      });
    });

    const slotOrder: Record<TimeSlot, number> = {
      'সকাল': 1,
      'দুপুর': 2,
      'সন্ধ্যা': 3,
      'রাত': 4,
    };

    list.sort((a, b) => slotOrder[a.timeSlot] - slotOrder[b.timeSlot]);
    return list;
  }, [patientMedicines, doseLogs, todayStr, activePatient]);

  // Counts
  const totalCount = checklistItems.length;
  const takenCount = checklistItems.filter((item) => item.status === 'taken').length;
  const pendingCount = checklistItems.filter((item) => item.status === 'pending').length;
  const skippedCount = checklistItems.filter((item) => item.status === 'skipped').length;
  const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;

  // Filtered List
  const displayedItems = useMemo(() => {
    if (filterTab === 'pending') return checklistItems.filter((i) => i.status === 'pending');
    if (filterTab === 'completed') return checklistItems.filter((i) => i.status === 'taken');
    return checklistItems;
  }, [checklistItems, filterTab]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Page Title & Family Quick Switch Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              আজকের ওষুধের চেকলিস্ট
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-soft text-primary">
              {formatBengaliDate(todayStr)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            এক ট্যাপে ওষুধ খাওয়া নিশ্চিত করুন এবং দৈনিক সুস্থতার অগ্রগতি দেখুন
          </p>
        </div>

        {/* Quick Patient Switch Pills */}
        {patients.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {patients.filter((p) => !p.isArchived).map((p) => {
              const isActive = activePatient?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePatientId(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface text-text-muted border border-border hover:border-primary'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-2xs opacity-80">({p.relation})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress & Adherence Card */}
      <div className="bg-gradient-to-br from-primary-soft via-surface to-surface-2 border border-primary/25 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">
              {activePatient ? `${activePatient.name} এর দৈনিক অগ্রগতি` : 'সার্বিক অগ্রগতি'}
            </div>
            <div className="text-2xl font-bold text-text mt-1 tabular-nums">
              {toBengaliNumber(takenCount)} / {toBengaliNumber(totalCount)} টি ডোজ সম্পন্ন
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xs text-text-muted block">নিয়মিততার হার</span>
              <span className="text-xl font-extrabold text-primary tabular-nums">
                {toBengaliNumber(adherencePercent)}%
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center font-bold text-xs text-primary tabular-nums">
              {toBengaliNumber(adherencePercent)}%
            </div>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="w-full bg-surface-2 h-3 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${adherencePercent}%` }}
          />
        </div>

        {/* Congratulations Banner if 100% completed */}
        {totalCount > 0 && pendingCount === 0 && (
          <div className="mt-4 p-3 bg-success-soft border border-success/30 rounded-xl flex items-center gap-2 text-xs text-success-text font-medium animate-in fade-in">
            <Sparkles className="w-4 h-4 text-success-text shrink-0" />
            <span>অভিনন্দন! আজকের সমস্ত নির্ধারিত ওষুধ সঠিক সময়ে সেবন করা হয়েছে। সুস্থ থাকুন!</span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'all'
                ? 'bg-primary text-on-primary'
                : 'text-text-muted hover:bg-surface-2'
            }`}
          >
            সব ডোজ ({toBengaliNumber(totalCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-[#B45309] text-white'
                : 'text-text-muted hover:bg-surface-2'
            }`}
          >
            বাকি ডোজ ({toBengaliNumber(pendingCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'completed'
                ? 'bg-[#15803D] text-white'
                : 'text-text-muted hover:bg-surface-2'
            }`}
          >
            সম্পন্ন ({toBengaliNumber(takenCount)})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCurrentPage('add-medicine')}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>+ নতুন ওষুধ</span>
        </button>
      </div>

      {/* Checklist Cards List */}
      {displayedItems.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <CalendarCheck className="w-12 h-12 text-primary mx-auto mb-3" />
          <h3 className="text-base font-bold text-text">
            {filterTab === 'pending'
              ? 'আজ আর কোনো ডোজ বাকি নেই!'
              : 'কোনো ওষুধ খুঁজে পাওয়া যায়নি'}
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
            নতুন ওষুধ যুক্ত করতে নিচের বোতামে চাপুন।
          </p>
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            ওষুধ যুক্ত করুন
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item, idx) => {
            const isTaken = item.status === 'taken';
            const isSkipped = item.status === 'skipped';

            return (
              <div
                key={`${item.medicineId}-${item.timeSlot}-${idx}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isTaken
                    ? 'bg-success-soft/45 border-success/35 shadow-2xs'
                    : isSkipped
                    ? 'bg-surface-2 border-border opacity-75'
                    : 'bg-surface border-border hover:border-primary/50 shadow-xs'
                }`}
              >
                {/* Left Info Area */}
                <div className="flex items-start gap-3.5 flex-1">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                      isTaken
                        ? 'bg-[#15803D] text-white'
                        : isSkipped
                        ? 'bg-surface-2 text-text-muted'
                        : 'bg-primary-soft text-primary'
                    }`}
                  >
                    {isTaken ? <Check className="w-6 h-6 stroke-[3]" /> : <Pill className="w-5 h-5" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MedicineBadgeIcon
                        iconTag={item.iconTag}
                        type={item.type}
                        colorTag={item.colorTag}
                        size="sm"
                      />
                      <h3
                        className={`text-base font-bold ${
                          isTaken
                            ? 'line-through text-text-muted'
                            : 'text-text'
                        }`}
                      >
                        {item.brandName}
                      </h3>
                      {item.strength && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-text-muted">
                          {item.strength}
                        </span>
                      )}
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-primary-soft text-primary">
                        {item.timeSlot} · {item.time}
                      </span>
                    </div>

                    <div className="text-xs text-text-muted mt-1 flex items-center gap-3 flex-wrap">
                      <MedicineBadgeIcon
                        iconTag={item.iconTag}
                        type={item.type}
                        colorTag={item.colorTag}
                        size="xs"
                        showLabel
                      />
                      <span>·</span>
                      <span className="font-medium text-text">
                        মাত্রা: {item.dosage}
                      </span>
                      <span>·</span>
                      <span>{item.mealTiming}</span>
                      <span>·</span>
                      <span className={item.stock <= 5 ? 'text-warning-text font-bold' : ''}>
                        স্টক: {toBengaliNumber(item.stock)} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Big Action Area (Large Tap Target for Elderly) */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {isTaken ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-success-text flex items-center gap-1 bg-success-soft px-3 py-2 rounded-xl">
                        <CheckCircle2 className="w-4 h-4" />
                        খেয়েছি
                      </span>
                      <button
                        type="button"
                        onClick={() => markDose(item.medicineId, item.timeSlot, item.time, 'skipped')}
                        className="p-2 text-text-muted hover:text-text hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
                        title="রিসেট করুন"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => markDose(item.medicineId, item.timeSlot, item.time, 'skipped')}
                        className="px-3 py-2.5 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
                      >
                        বাদ দিন
                      </button>
                      <button
                        type="button"
                        onClick={() => markDose(item.medicineId, item.timeSlot, item.time, 'taken')}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer min-w-[120px]"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>খেয়েছি</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
