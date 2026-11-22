import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Activity,
  Wallet,
  Pill,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { DoctorAppointment, DoseLog, Expense, HealthRecord } from '../../types';
import {
  BENGALI_MONTHS_LONG,
  buildHealthCalendarGrid,
  formatIsoDateLocal,
  getHealthCalendarDayDetails,
  getMonthRangeIso,
  getOrderedWeekdayLabels,
} from '../../utils/healthCalendar';
import {
  fetchAppointmentsRangeFromSupabase,
  fetchDoseLogsRangeFromSupabase,
  fetchExpensesRangeFromSupabase,
  fetchHealthRecordsRangeFromSupabase,
} from '../../supabase/userDataService';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { formatCurrencyTk } from '../../utils/expenseUtils';
import { MedicineBadgeIcon } from '../medicines/MedicineBadgeIcon';

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of extra) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of primary) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export const HealthCalendarPage: React.FC = () => {
  const {
    currentUser,
    patients,
    activePatientId,
    medicines,
    doseLogs,
    appointments,
    healthRecords,
    expenses,
    settings,
  } = useMedicine();

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => formatIsoDateLocal(todayDate), [todayDate]);

  const [viewYear, setViewYear] = useState<number>(() => todayDate.getFullYear());
  const [viewMonth0, setViewMonth0] = useState<number>(() => todayDate.getMonth());
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(activePatientId || 'all');

  const [extraDoseLogs, setExtraDoseLogs] = useState<DoseLog[]>([]);
  const [extraAppointments, setExtraAppointments] = useState<DoctorAppointment[]>([]);
  const [extraHealthRecords, setExtraHealthRecords] = useState<HealthRecord[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<Expense[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  const fetchedMonthsRef = useRef<Set<string>>(new Set());

  const monthKey = `${viewYear}-${String(viewMonth0 + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    const cacheKey = `${uid}:${monthKey}`;
    if (fetchedMonthsRef.current.has(cacheKey)) return;

    // Current and immediately previous month are already covered by initial 90-day / 180-day fetches;
    // only fetch range if browsing outside recent window or ensure month backfill once cleanly.
    const { startDateIso, endDateIso } = getMonthRangeIso(viewYear, viewMonth0);
    let active = true;
    fetchedMonthsRef.current.add(cacheKey);
    setIsLoadingMonth(true);

    Promise.all([
      fetchDoseLogsRangeFromSupabase(uid, startDateIso, endDateIso),
      fetchAppointmentsRangeFromSupabase(uid, startDateIso, endDateIso),
      fetchHealthRecordsRangeFromSupabase(uid, startDateIso, endDateIso),
      fetchExpensesRangeFromSupabase(uid, startDateIso, endDateIso),
    ])
      .then(([logs, apts, records, exps]) => {
        if (!active) return;
        if (logs.length > 0) setExtraDoseLogs((prev) => mergeById(prev, logs));
        if (apts.length > 0) setExtraAppointments((prev) => mergeById(prev, apts));
        if (records.length > 0) setExtraHealthRecords((prev) => mergeById(prev, records));
        if (exps.length > 0) setExtraExpenses((prev) => mergeById(prev, exps));
      })
      .catch(() => {
        // Keep fetchedMonthsRef marked to prevent infinite retry loops; local live state still renders
      })
      .finally(() => {
        if (active) setIsLoadingMonth(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.uid, monthKey, viewYear, viewMonth0]);

  const combinedDoseLogs = useMemo(
    () => mergeById(doseLogs, extraDoseLogs),
    [doseLogs, extraDoseLogs]
  );
  const combinedAppointments = useMemo(
    () => mergeById(appointments, extraAppointments),
    [appointments, extraAppointments]
  );
  const combinedHealthRecords = useMemo(
    () => mergeById(healthRecords, extraHealthRecords),
    [healthRecords, extraHealthRecords]
  );
  const combinedExpenses = useMemo(
    () => mergeById(expenses, extraExpenses),
    [expenses, extraExpenses]
  );

  const patientFilter = selectedPatientId === 'all' ? null : selectedPatientId;

  const weekdayLabels = useMemo(
    () => getOrderedWeekdayLabels(settings.weekStartDay),
    [settings.weekStartDay]
  );

  const gridCells = useMemo(
    () =>
      buildHealthCalendarGrid({
        year: viewYear,
        monthIndex0: viewMonth0,
        weekStartDay: settings.weekStartDay,
        todayIso,
        patientId: patientFilter,
        doseLogs: combinedDoseLogs,
        appointments: combinedAppointments,
        healthRecords: combinedHealthRecords,
        expenses: combinedExpenses,
      }),
    [
      viewYear,
      viewMonth0,
      settings.weekStartDay,
      todayIso,
      patientFilter,
      combinedDoseLogs,
      combinedAppointments,
      combinedHealthRecords,
      combinedExpenses,
    ]
  );

  const selectedDayDetails = useMemo(
    () =>
      getHealthCalendarDayDetails({
        dateIso: selectedDateIso,
        patientId: patientFilter,
        doseLogs: combinedDoseLogs,
        appointments: combinedAppointments,
        healthRecords: combinedHealthRecords,
        expenses: combinedExpenses,
      }),
    [
      selectedDateIso,
      patientFilter,
      combinedDoseLogs,
      combinedAppointments,
      combinedHealthRecords,
      combinedExpenses,
    ]
  );

  const medicineById = useMemo(() => {
    const map = new Map<string, (typeof medicines)[number]>();
    medicines.forEach((m) => map.set(m.id, m));
    return map;
  }, [medicines]);

  const handleShiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth0 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth0(d.getMonth());
    setSelectedDateIso(formatIsoDateLocal(d));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth0(now.getMonth());
    setSelectedDateIso(formatIsoDateLocal(now));
  };

  const activePatients = patients.filter((p) => !p.isArchived);

  const formatSelectedDateTitle = (iso: string) => {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const y = parts[0];
    const mIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
    const d = Number(parts[2]);
    return `${toBengaliNumber(d)} ${BENGALI_MONTHS_LONG[mIdx]} ${toBengaliNumber(y)}`;
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              স্বাস্থ্য ক্যালেন্ডার
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ওষুধের ডোজ, অ্যাপয়েন্টমেন্ট, স্বাস্থ্য রেকর্ড ও খরচের মাসিক চিত্র
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activePatients.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                aria-label="সদস্য ফিল্টার"
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none min-h-[32px]"
              >
                <option value="all">সকল সদস্য</option>
                {activePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relation})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleJumpToday}
            className="min-h-[40px] px-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
          >
            আজ
          </button>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        {/* Month bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleShiftMonth(-1)}
            aria-label="পূর্ববর্তী মাস"
            className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {BENGALI_MONTHS_LONG[viewMonth0]} {toBengaliNumber(viewYear)}
            </h2>
            {isLoadingMonth && (
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" aria-label="লোড হচ্ছে" />
            )}
          </div>

          <button
            type="button"
            onClick={() => handleShiftMonth(1)}
            aria-label="পরবর্তী মাস"
            className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((lbl) => (
            <div
              key={lbl}
              className="py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {gridCells.map((cell) => {
            const isSelected = cell.dateIso === selectedDateIso;
            const doseDotClass =
              cell.doseTone === 'all_taken'
                ? 'bg-emerald-500'
                : cell.doseTone === 'partial'
                ? 'bg-amber-400'
                : cell.doseTone === 'many_missed'
                ? 'bg-rose-500'
                : null;

            const summaryParts: string[] = [formatSelectedDateTitle(cell.dateIso)];
            if (cell.doseStats.total > 0) {
              summaryParts.push(`ডোজ ${toBengaliNumber(cell.doseStats.taken)}/${toBengaliNumber(cell.doseStats.total)}`);
            }
            if (cell.appointmentsCount > 0) {
              summaryParts.push(`অ্যাপয়েন্টমেন্ট ${toBengaliNumber(cell.appointmentsCount)}`);
            }
            if (cell.healthRecordsCount > 0) {
              summaryParts.push(`স্বাস্থ্য রেকর্ড ${toBengaliNumber(cell.healthRecordsCount)}`);
            }
            if (cell.expensesCount > 0) {
              summaryParts.push(`খরচ ${toBengaliNumber(cell.expensesCount)}`);
            }

            return (
              <button
                key={cell.dateIso}
                type="button"
                onClick={() => setSelectedDateIso(cell.dateIso)}
                aria-label={summaryParts.join(', ')}
                aria-pressed={isSelected}
                className={`min-h-[52px] sm:min-h-[60px] rounded-2xl p-1.5 flex flex-col items-center justify-between border transition-all ${
                  isSelected
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/30'
                    : cell.isToday
                    ? 'bg-slate-50 dark:bg-slate-800/80 border-teal-300 dark:border-teal-700'
                    : cell.inCurrentMonth
                    ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent opacity-45'
                }`}
              >
                <span
                  className={`text-xs sm:text-sm font-bold tabular-nums ${
                    isSelected
                      ? 'text-teal-800 dark:text-teal-200'
                      : cell.isToday
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {toBengaliNumber(cell.dayOfMonth)}
                </span>

                <div className="flex items-center justify-center flex-wrap gap-1 min-h-[10px]">
                  {doseDotClass && (
                    <span
                      className={`w-2 h-2 rounded-full ${doseDotClass}`}
                      title="ওষুধের ডোজ"
                    />
                  )}
                  {cell.appointmentsCount > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-blue-500"
                      title="ডাক্তারের অ্যাপয়েন্টমেন্ট"
                    />
                  )}
                  {cell.healthRecordsCount > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-purple-500"
                      title="স্বাস্থ্য রেকর্ড"
                    />
                  )}
                  {cell.expensesCount > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"
                      title="খরচ"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            সব ডোজ নেওয়া
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            আংশিক ডোজ
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            ডোজ বাদ/মিস
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            অ্যাপয়েন্টমেন্ট
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            স্বাস্থ্য রেকর্ড
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            খরচ
          </span>
        </div>
      </div>

      {/* Selected Day Detail Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            {formatSelectedDateTitle(selectedDateIso)} — দিনের সারসংক্ষেপ
          </h3>
          {selectedDateIso === todayIso && (
            <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-bold">
              আজ
            </span>
          )}
        </div>

        {selectedDayDetails.doseLogs.length === 0 &&
        selectedDayDetails.appointments.length === 0 &&
        selectedDayDetails.healthRecords.length === 0 &&
        selectedDayDetails.expenses.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            এই তারিখে কোনো ডোজ, অ্যাপয়েন্টমেন্ট, স্বাস্থ্য রেকর্ড বা খরচ লিপিবদ্ধ নেই।
          </p>
        ) : (
          <div className="space-y-4">
            {/* Doses */}
            {selectedDayDetails.doseLogs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  ওষুধের ডোজ ({toBengaliNumber(selectedDayDetails.doseLogs.length)})
                </div>
                <div className="space-y-2">
                  {selectedDayDetails.doseLogs.map((log) => {
                    const med = medicineById.get(log.medicineId);
                    const isTaken = log.status === 'taken';
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MedicineBadgeIcon
                            iconTag={med?.iconTag}
                            type={med?.type}
                            colorTag={med?.colorTag}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {log.medicineName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {log.timeSlot} ({log.scheduledTime}) • {log.dosage}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                            isTaken
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {isTaken ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> নেওয়া হয়েছে
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />{' '}
                              {log.status === 'skipped' ? 'বাদ দেওয়া' : 'মিস হয়েছে'}
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Appointments */}
            {selectedDayDetails.appointments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  ডাক্তারের অ্যাপয়েন্টমেন্ট ({toBengaliNumber(selectedDayDetails.appointments.length)})
                </div>
                <div className="space-y-2">
                  {selectedDayDetails.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60"
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {apt.doctorName}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {apt.specialty} • {apt.appointmentTime} • {apt.location}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health Records */}
            {selectedDayDetails.healthRecords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <Activity className="w-4 h-4 text-purple-600" />
                  স্বাস্থ্য রেকর্ড ({toBengaliNumber(selectedDayDetails.healthRecords.length)})
                </div>
                <div className="space-y-2">
                  {selectedDayDetails.healthRecords.map((hr) => {
                    const metrics: string[] = [];
                    if (hr.systolic && hr.diastolic) {
                      metrics.push(
                        `রক্তচাপ ${toBengaliNumber(hr.systolic)}/${toBengaliNumber(hr.diastolic)}`
                      );
                    }
                    if (hr.bloodSugar !== undefined) {
                      metrics.push(
                        `ব্লাড সুগার ${toBengaliNumber(hr.bloodSugar)} mmol/L${
                          hr.sugarType ? ` (${hr.sugarType})` : ''
                        }`
                      );
                    }
                    if (hr.weight !== undefined) {
                      metrics.push(`ওজন ${toBengaliNumber(hr.weight)} কেজি`);
                    }
                    return (
                      <div
                        key={hr.id}
                        className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/60"
                      >
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {metrics.join(' • ') || 'স্বাস্থ্য পরিমাপ'}
                        </p>
                        {hr.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {hr.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expenses */}
            {selectedDayDetails.expenses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  চিকিৎসা খরচ ({toBengaliNumber(selectedDayDetails.expenses.length)})
                </div>
                <div className="space-y-2">
                  {selectedDayDetails.expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {exp.title || exp.category}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {exp.category}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 shrink-0 tabular-nums">
                        {formatCurrencyTk(exp.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
