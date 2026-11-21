import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Edit2,
  Heart,
  Info,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { CycleFlow, CycleLog } from '../../types';
import { formatBengaliDate, toBengaliNumber } from '../../utils/bengaliUtils';
import {
  CYCLE_DISCLAIMER_BN,
  CYCLE_FLOW_OPTIONS,
  CYCLE_SYMPTOM_OPTIONS,
  analyzeCycles,
  buildCycleCalendarMonth,
  diffIsoDays,
  isCycleReminderDueToday,
} from '../../utils/cycleTracker';
import { toLocalIsoDate } from '../../utils/shoppingListCalculator';

const WEEKDAY_LABELS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

const BENGALI_MONTHS = [
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

export const WomensHealthPage: React.FC = () => {
  const {
    patients,
    activePatient,
    setActivePatientId,
    openCreateProfileModal,
    setCurrentPage,
    cycleLogs,
    addOrUpdateCycleLog,
    deleteCycleLog,
    isCycleTrackerEnabledForPatient,
    setCycleTrackerEnabledForPatient,
    showToast,
  } = useMedicine();

  const todayIso = toLocalIsoDate(new Date());
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth0, setCalMonth0] = useState(nowDate.getMonth());

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState('');
  const [flow, setFlow] = useState<CycleFlow | ''>('মাঝারি');
  const [painLevel, setPainLevel] = useState<number>(2);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const targetPatient = activePatient || patients[0] || null;
  const isEnabled = targetPatient ? isCycleTrackerEnabledForPatient(targetPatient.id) : false;

  const patientCycleLogs = useMemo(
    () =>
      targetPatient
        ? cycleLogs
            .filter((l) => l.patientId === targetPatient.id)
            .slice()
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
        : [],
    [cycleLogs, targetPatient]
  );

  const analysis = useMemo(() => {
    if (!targetPatient) return null;
    return analyzeCycles(cycleLogs, targetPatient.id, todayIso);
  }, [cycleLogs, targetPatient, todayIso]);

  const calendarCells = useMemo(() => {
    if (!targetPatient || !analysis) return [];
    return buildCycleCalendarMonth(
      calYear,
      calMonth0,
      cycleLogs,
      targetPatient.id,
      analysis,
      todayIso
    );
  }, [calYear, calMonth0, cycleLogs, targetPatient, analysis, todayIso]);

  const activeOngoingCycle = useMemo(
    () => patientCycleLogs.find((l) => !l.endDate && diffIsoDays(l.startDate, todayIso) >= 0 && diffIsoDays(l.startDate, todayIso) <= 14) || null,
    [patientCycleLogs, todayIso]
  );

  const isReminderDueToday = Boolean(
    analysis?.predictedNextStartDate &&
      isCycleReminderDueToday(analysis.predictedNextStartDate, todayIso)
  );

  const openNewForm = (presetStartDate = todayIso) => {
    setEditingLogId(null);
    setStartDate(presetStartDate);
    setEndDate('');
    setFlow('মাঝারি');
    setPainLevel(2);
    setSymptoms([]);
    setNotes('');
    setIsEditorOpen(true);
  };

  const openEditForm = (log: CycleLog) => {
    setEditingLogId(log.id);
    setStartDate(log.startDate);
    setEndDate(log.endDate || '');
    setFlow(log.flow || 'মাঝারি');
    setPainLevel(typeof log.painLevel === 'number' ? log.painLevel : 0);
    setSymptoms(Array.isArray(log.symptoms) ? log.symptoms : []);
    setNotes(log.notes || '');
    setIsEditorOpen(true);
  };

  const handleQuickStartPeriod = async () => {
    if (!targetPatient) return;
    const existingToday = patientCycleLogs.find((l) => l.startDate === todayIso);
    if (existingToday) {
      openEditForm(existingToday);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await addOrUpdateCycleLog({
        patientId: targetPatient.id,
        startDate: todayIso,
        flow: 'মাঝারি',
        painLevel: 2,
        symptoms: [],
      });
      if (saved) {
        openEditForm(saved);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickEndPeriod = async () => {
    if (!targetPatient) return;
    if (!activeOngoingCycle) {
      showToast('চলমান কোনো মাসিকের রেকর্ড নেই — প্রয়োজনে নতুন তারিখ যোগ করুন', 'info');
      openNewForm(todayIso);
      return;
    }
    if (todayIso < activeOngoingCycle.startDate) {
      showToast('শেষ হওয়ার তারিখ শুরুর তারিখের আগে হতে পারবে না', 'alert');
      return;
    }
    setIsSaving(true);
    try {
      await addOrUpdateCycleLog({
        ...activeOngoingCycle,
        endDate: todayIso,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSymptom = (sym: string) => {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPatient) return;
    if (!startDate) {
      showToast('অনুগ্রহ করে শুরুর তারিখ নির্বাচন করুন', 'alert');
      return;
    }
    if (endDate && endDate < startDate) {
      showToast('শেষ হওয়ার তারিখ শুরুর তারিখের আগে হতে পারবে না', 'alert');
      return;
    }

    setIsSaving(true);
    try {
      await addOrUpdateCycleLog({
        id: editingLogId || undefined,
        patientId: targetPatient.id,
        startDate,
        endDate: endDate.trim() || undefined,
        flow: flow || undefined,
        painLevel,
        symptoms,
        notes: notes.trim() || undefined,
      });
      setIsEditorOpen(false);
      setEditingLogId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevMonth = () => {
    if (calMonth0 === 0) {
      setCalYear((y) => y - 1);
      setCalMonth0(11);
    } else {
      setCalMonth0((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth0 === 11) {
      setCalYear((y) => y + 1);
      setCalMonth0(0);
    } else {
      setCalMonth0((m) => m + 1);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('me')}
            aria-label="ফিরে যান"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <Heart className="w-6 h-6 text-rose-500" />
              <span>নারীর স্বাস্থ্য (চক্র ট্র্যাকার)</span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              সম্পূর্ণ ব্যক্তিগত মাসিক চক্র, লক্ষণ ও পরবর্তী সম্ভাব্য তারিখের হিসাব
            </p>
          </div>
        </div>

        {patients.length > 1 && targetPatient && (
          <select
            value={targetPatient.id}
            onChange={(e) => setActivePatientId(e.target.value)}
            aria-label="প্রোফাইল পরিবর্তন"
            className="min-h-[48px] px-3.5 py-2 text-sm font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl cursor-pointer"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.relation})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mandatory Medical Disclaimer (Always visible) */}
      <div className="p-4 rounded-2xl bg-warning-soft border border-warning/35 text-warning-text flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold leading-relaxed">{CYCLE_DISCLAIMER_BN}</p>
      </div>

      {!targetPatient ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-4">
          <UserPlus className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-lg font-bold text-text">প্রথমে একটি প্রোফাইল তৈরি করুন</h2>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            চক্রের তথ্য প্রোফাইল অনুযায়ী সম্পূর্ণ ব্যক্তিগতভাবে সংরক্ষিত থাকে।
          </p>
          <button
            type="button"
            onClick={openCreateProfileModal}
            className="min-h-[48px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl cursor-pointer inline-flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>প্রোফাইল তৈরি করুন</span>
          </button>
        </div>
      ) : !isEnabled ? (
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-text">
              &quot;{targetPatient.name}&quot;-এর জন্য নারীর স্বাস্থ্য ট্র্যাকার বন্ধ আছে
            </h2>
            <p className="text-sm text-text-muted">
              এই ফিচারটি ঐচ্ছিক এবং প্রোফাইল অনুযায়ী আলাদাভাবে চালু বা বন্ধ রাখা যায়। এটি শুধু আপনার অ্যাকাউন্টেই সীমাবদ্ধ থাকে — অতিথি লিংক বা যত্নকারীর সাথে কখনো শেয়ার হয় না।
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCycleTrackerEnabledForPatient(targetPatient.id, true)}
              className="min-h-[48px] px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-xs"
            >
              <Heart className="w-4 h-4" />
              <span>এই প্রোফাইলের জন্য চালু করুন</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage('settings')}
              className="min-h-[48px] px-5 py-2.5 bg-surface-2 hover:bg-border/60 text-text font-bold rounded-xl border border-border cursor-pointer inline-flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>সেটিংসে যান</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1-Day-Before Reminder Alert */}
          {isReminderDueToday && analysis?.predictedNextStartDate && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 flex items-start gap-3">
              <Bell className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm sm:text-base">
                  আগামীকাল আনুমানিক পরবর্তী মাসিক শুরু হতে পারে
                </p>
                <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                  হিসাব অনুযায়ী সম্ভাব্য তারিখ: {formatBengaliDate(analysis.predictedNextStartDate)}। প্রয়োজনীয় প্রস্তুতি নিয়ে রাখুন।
                </p>
              </div>
            </div>
          )}

          {/* Irregularity Notice */}
          {analysis?.hasIrregularityAlert && (
            <div className="p-4 rounded-2xl bg-danger-soft border border-danger/30 text-danger-text flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold">ডাক্তারের পরামর্শ নেওয়ার পরামর্শযোগ্য লক্ষণ:</p>
                <p>{analysis.irregularityReasons.join(' · ')}</p>
              </div>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleQuickStartPeriod}
                className="min-h-[48px] px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-base rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
              >
                <Droplets className="w-5 h-5" />
                <span>মাসিক শুরু</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleQuickEndPeriod}
                className="min-h-[48px] px-5 py-2.5 bg-surface-2 hover:bg-border/60 border border-border text-text font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
              >
                <span>শেষ</span>
              </button>

              <button
                type="button"
                onClick={() => openNewForm(todayIso)}
                className="min-h-[48px] px-4 py-2.5 bg-primary-soft hover:bg-primary/15 border border-primary/25 text-primary font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>আগের তারিখ যোগ</span>
              </button>
            </div>

            {activeOngoingCycle && (
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-3 py-1.5 rounded-lg">
                চলমান: {formatBengaliDate(activeOngoingCycle.startDate)} থেকে
              </span>
            )}
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-text-muted block">
                গড় চক্রের দৈর্ঘ্য (শেষ ৬টি)
              </span>
              <strong className="text-xl font-bold text-text mt-1 block">
                {analysis?.hasEnoughData && analysis.averageCycleLength !== null
                  ? `${toBengaliNumber(analysis.averageCycleLength)} দিন`
                  : analysis?.insufficientDataMessage || 'পর্যাপ্ত তথ্য নেই'}
              </strong>
              {analysis?.averagePeriodDurationDays !== null && analysis?.averagePeriodDurationDays !== undefined && (
                <span className="text-xs text-text-muted mt-1 block">
                  গড় সময়কাল: {toBengaliNumber(analysis.averagePeriodDurationDays)} দিন
                </span>
              )}
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-text-muted block">
                পরবর্তী সম্ভাব্য শুরুর তারিখ
              </span>
              <strong className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                {analysis?.hasEnoughData && analysis.predictedNextStartDate
                  ? formatBengaliDate(analysis.predictedNextStartDate)
                  : analysis?.insufficientDataMessage || 'পর্যাপ্ত তথ্য নেই'}
              </strong>
              {analysis?.daysUntilNextCycle !== null && analysis?.daysUntilNextCycle !== undefined && (
                <span className="text-xs text-text-muted mt-1 block">
                  {analysis.daysUntilNextCycle === 0
                    ? 'আজ শুরু হতে পারে'
                    : analysis.daysUntilNextCycle > 0
                    ? `প্রায় ${toBengaliNumber(analysis.daysUntilNextCycle)} দিন বাকি`
                    : `${toBengaliNumber(Math.abs(analysis.daysUntilNextCycle))} দিন আগে সম্ভাব্য ছিল`}
                </span>
              )}
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-text-muted block">
                রেকর্ডকৃত চক্র
              </span>
              <strong className="text-xl font-bold text-text mt-1 block">
                {toBengaliNumber(analysis?.totalCycles || 0)} টি
              </strong>
              <span className="text-xs text-text-muted mt-1 block">
                সর্বোচ্চ ব্যক্তিগত গোপনীয়তায় সুরক্ষিত
              </span>
            </div>
          </div>

          {/* Editor Form Drawer/Card */}
          {isEditorOpen && (
            <form
              onSubmit={handleSaveForm}
              className="bg-surface border-2 border-primary/40 rounded-2xl p-5 sm:p-6 shadow-md space-y-5"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
                <h2 className="text-lg font-bold text-text">
                  {editingLogId ? 'চক্রের তথ্য সম্পাদনা' : 'নতুন চক্র যোগ করুন'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    setEditingLogId(null);
                  }}
                  className="text-sm font-bold text-text-muted hover:text-text cursor-pointer px-2 py-1"
                >
                  বন্ধ করুন
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cycle-start-date" className="block text-sm font-bold text-text mb-1.5">
                    শুরুর তারিখ *
                  </label>
                  <input
                    id="cycle-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="min-h-[48px] w-full px-3.5 py-2 bg-surface-2 border border-border rounded-xl text-base text-text"
                  />
                </div>
                <div>
                  <label htmlFor="cycle-end-date" className="block text-sm font-bold text-text mb-1.5">
                    শেষ হওয়ার তারিখ (ঐচ্ছিক)
                  </label>
                  <input
                    id="cycle-end-date"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="min-h-[48px] w-full px-3.5 py-2 bg-surface-2 border border-border rounded-xl text-base text-text"
                  />
                </div>
              </div>

              {/* Flow Selector */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-text">রক্তপ্রবাহের পরিমাণ</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {CYCLE_FLOW_OPTIONS.map((opt) => {
                    const active = flow === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFlow(opt)}
                        aria-pressed={active}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border-2 font-bold text-sm cursor-pointer transition-colors ${
                          active
                            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200'
                            : 'border-border bg-surface-2 text-text hover:border-rose-400'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pain Level Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="cycle-pain-slider" className="text-sm font-bold text-text">
                    ব্যথার মাত্রা (০ থেকে ১০)
                  </label>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {toBengaliNumber(painLevel)} / {toBengaliNumber(10)}
                  </span>
                </div>
                <input
                  id="cycle-pain-slider"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer h-2"
                />
              </div>

              {/* Symptom Toggles */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-text">লক্ষণসমূহ (ঐচ্ছিক)</span>
                <div className="flex flex-wrap gap-2">
                  {CYCLE_SYMPTOM_OPTIONS.map((sym) => {
                    const selected = symptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleToggleSymptom(sym)}
                        aria-pressed={selected}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors ${
                          selected
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-2 border-border text-text hover:border-primary/60'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="cycle-notes-input" className="block text-sm font-bold text-text mb-1.5">
                  নোট (ঐচ্ছিক)
                </label>
                <textarea
                  id="cycle-notes-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেকোনো বাড়তি তথ্য বা অনুভূতি লিখে রাখুন..."
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-text"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    setEditingLogId(null);
                  }}
                  className="min-h-[44px] px-4 py-2 text-sm font-bold text-text-muted hover:text-text rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[48px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          )}

          {/* Month Calendar View */}
          <section className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-500" />
                <h2 className="text-lg font-bold text-text">
                  {BENGALI_MONTHS[calMonth0]} {toBengaliNumber(calYear)}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="আগের মাস"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 border border-border text-text hover:bg-border/50 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalYear(nowDate.getFullYear());
                    setCalMonth0(nowDate.getMonth());
                  }}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-bold text-text hover:bg-border/50 cursor-pointer"
                >
                  আজ
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="পরের মাস"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 border border-border text-text hover:bg-border/50 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAY_LABELS_BN.map((wd) => (
                <div key={wd} className="text-xs font-bold text-text-muted py-1">
                  {wd}
                </div>
              ))}
              {calendarCells.map((cell) => (
                <button
                  key={cell.isoDate}
                  type="button"
                  onClick={() => openNewForm(cell.isoDate)}
                  className={`min-h-[44px] rounded-xl text-sm font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer relative ${
                    cell.isPeriodDay
                      ? 'bg-rose-600 text-white dark:bg-rose-500 font-bold shadow-xs'
                      : cell.isPredictedDay
                      ? 'bg-rose-100/90 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700/70'
                      : cell.inCurrentMonth
                      ? 'bg-surface-2/60 text-text hover:bg-surface-2'
                      : 'text-text-muted/45 hover:bg-surface-2/40'
                  } ${cell.isToday && !cell.isPeriodDay ? 'ring-2 ring-primary' : ''}`}
                  title={formatBengaliDate(cell.isoDate)}
                >
                  <span className="tabular-nums">{toBengaliNumber(cell.dayOfMonth)}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-rose-600 dark:bg-rose-500 inline-block" />
                <span>মাসিকের দিন</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 inline-block" />
                <span>সম্ভাব্য পরবর্তী চক্র</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm ring-2 ring-primary inline-block" />
                <span>আজ</span>
              </div>
            </div>
          </section>

          {/* Recorded Cycles History */}
          <section className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-text">
              চক্রের ইতিহাস ({toBengaliNumber(patientCycleLogs.length)}টি)
            </h2>

            {patientCycleLogs.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-2 text-center space-y-2">
                <p className="text-sm font-semibold text-text">
                  এখনো কোনো চক্রের তথ্য যোগ করা হয়নি
                </p>
                <p className="text-xs text-text-muted">
                  উপরের &quot;মাসিক শুরু&quot; বোতামে ট্যাপ করে অথবা ক্যালেন্ডারে তারিখ বেছে প্রথম রেকর্ড যোগ করুন।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {patientCycleLogs.map((log) => {
                  const enriched = analysis?.recentCycles.find((c) => c.id === log.id);
                  const periodLen =
                    log.endDate && log.endDate >= log.startDate
                      ? diffIsoDays(log.startDate, log.endDate) + 1
                      : null;

                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-xl bg-surface-2/70 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-text">
                            {formatBengaliDate(log.startDate)}
                            {log.endDate ? ` — ${formatBengaliDate(log.endDate)}` : ' (চলমান)'}
                          </span>
                          {periodLen !== null && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200">
                              {toBengaliNumber(periodLen)} দিন
                            </span>
                          )}
                          {enriched?.cycleLengthDays && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary-soft text-primary">
                              চক্র: {toBengaliNumber(enriched.cycleLengthDays)} দিন
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          {log.flow && <span>প্রবাহ: {log.flow}</span>}
                          {typeof log.painLevel === 'number' && (
                            <span>· ব্যথা: {toBengaliNumber(log.painLevel)}/১০</span>
                          )}
                          {log.symptoms && log.symptoms.length > 0 && (
                            <span>· লক্ষণ: {log.symptoms.join(', ')}</span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-xs text-text-muted pt-0.5">{log.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(log)}
                          aria-label="সম্পাদনা করুন"
                          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-surface border border-border text-text hover:border-primary inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>সম্পাদনা</span>
                        </button>

                        {confirmDeleteId === log.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteCycleLog(log.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-danger-soft border border-danger/40 text-danger-text text-xs font-bold cursor-pointer"
                          >
                            নিশ্চিত মুছুন
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(log.id)}
                            aria-label="মুছে ফেলুন"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface border border-border text-danger-text hover:bg-danger-soft cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default WomensHealthPage;
