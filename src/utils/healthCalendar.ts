import {
  DoctorAppointment,
  DoseLog,
  Expense,
  HealthRecord,
  WeekStartDay,
} from '../types';

export type DoseDayTone = 'none' | 'all_taken' | 'partial' | 'many_missed';

export interface CalendarDayCell {
  dateIso: string; // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  doseTone: DoseDayTone;
  doseStats: {
    taken: number;
    skipped: number;
    missed: number;
    total: number;
  };
  appointmentsCount: number;
  healthRecordsCount: number;
  expensesCount: number;
  totalExpenseAmount: number;
}

export interface CalendarDayDetails {
  dateIso: string;
  doseLogs: DoseLog[];
  appointments: DoctorAppointment[];
  healthRecords: HealthRecord[];
  expenses: Expense[];
}

export const BENGALI_WEEKDAYS_SHORT = [
  'রবি',
  'সোম',
  'মঙ্গল',
  'বুধ',
  'বৃহঃ',
  'শুক্র',
  'শনি',
];

export const BENGALI_MONTHS_LONG = [
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

export function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthRangeIso(year: number, monthIndex0: number): {
  startDateIso: string;
  endDateIso: string;
} {
  const firstDay = new Date(year, monthIndex0, 1);
  const lastDay = new Date(year, monthIndex0 + 1, 0);
  return {
    startDateIso: formatIsoDateLocal(firstDay),
    endDateIso: formatIsoDateLocal(lastDay),
  };
}

export function getOrderedWeekdayLabels(weekStartDay: WeekStartDay = 'saturday'): string[] {
  const startIdx = weekStartDay === 'monday' ? 1 : weekStartDay === 'sunday' ? 0 : 6;
  const labels: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    labels.push(BENGALI_WEEKDAYS_SHORT[(startIdx + i) % 7]);
  }
  return labels;
}

export function classifyDoseDayTone(stats: {
  taken: number;
  skipped: number;
  missed: number;
}): DoseDayTone {
  const total = stats.taken + stats.skipped + stats.missed;
  if (total === 0) return 'none';
  if (stats.skipped === 0 && stats.missed === 0 && stats.taken > 0) {
    return 'all_taken';
  }
  const notTaken = stats.skipped + stats.missed;
  // Red when all missed/skipped OR majority (>50%) missed/skipped with at least 2 unfulfilled
  if (stats.taken === 0 || (notTaken >= 2 && notTaken > stats.taken)) {
    return 'many_missed';
  }
  return 'partial';
}

function matchesPatient(
  itemPatientId: string | undefined | null,
  selectedPatientId?: string | null
): boolean {
  if (!selectedPatientId) return true;
  return itemPatientId === selectedPatientId;
}

/**
 * Builds calendar month grid + per-day summary dots.
 * Privacy rule: NEVER reads or includes Women's Health cycleLogs.
 */
export function buildHealthCalendarGrid(params: {
  year: number;
  monthIndex0: number; // 0-11
  weekStartDay?: WeekStartDay;
  todayIso?: string;
  patientId?: string | null;
  doseLogs: DoseLog[];
  appointments: DoctorAppointment[];
  healthRecords: HealthRecord[];
  expenses: Expense[];
}): CalendarDayCell[] {
  const weekStartDay = params.weekStartDay || 'saturday';
  const startDowTarget = weekStartDay === 'monday' ? 1 : weekStartDay === 'sunday' ? 0 : 6;
  const todayIso = params.todayIso || formatIsoDateLocal(new Date());

  const firstOfMonth = new Date(params.year, params.monthIndex0, 1);
  const firstDow = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const leadingBlankDays = (firstDow - startDowTarget + 7) % 7;

  const daysInMonth = new Date(params.year, params.monthIndex0 + 1, 0).getDate();
  const totalCells = Math.ceil((leadingBlankDays + daysInMonth) / 7) * 7;

  const gridStartDate = new Date(params.year, params.monthIndex0, 1 - leadingBlankDays);

  // Aggregate by YYYY-MM-DD in single O(N) pass
  const doseByDate = new Map<string, { taken: number; skipped: number; missed: number }>();
  for (const log of params.doseLogs) {
    if (!log.scheduledDate || !matchesPatient(log.patientId, params.patientId)) continue;
    const cur = doseByDate.get(log.scheduledDate) || { taken: 0, skipped: 0, missed: 0 };
    if (log.status === 'taken') cur.taken += 1;
    else if (log.status === 'skipped') cur.skipped += 1;
    else if (log.status === 'missed') cur.missed += 1;
    doseByDate.set(log.scheduledDate, cur);
  }

  const aptsByDate = new Map<string, number>();
  for (const apt of params.appointments) {
    if (!apt.appointmentDate || apt.status === 'cancelled') continue;
    if (!matchesPatient(apt.patientId, params.patientId)) continue;
    aptsByDate.set(apt.appointmentDate, (aptsByDate.get(apt.appointmentDate) || 0) + 1);
  }

  const hrByDate = new Map<string, number>();
  for (const hr of params.healthRecords) {
    if (!hr.recordDate || !matchesPatient(hr.patientId, params.patientId)) continue;
    hrByDate.set(hr.recordDate, (hrByDate.get(hr.recordDate) || 0) + 1);
  }

  const expByDate = new Map<string, { count: number; total: number }>();
  for (const exp of params.expenses) {
    if (!exp.expenseDate || !matchesPatient(exp.patientId, params.patientId)) continue;
    const cur = expByDate.get(exp.expenseDate) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(exp.amount) || 0;
    expByDate.set(exp.expenseDate, cur);
  }

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(
      gridStartDate.getFullYear(),
      gridStartDate.getMonth(),
      gridStartDate.getDate() + i
    );
    const dateIso = formatIsoDateLocal(cellDate);
    const inCurrentMonth =
      cellDate.getFullYear() === params.year && cellDate.getMonth() === params.monthIndex0;

    const dStats = doseByDate.get(dateIso) || { taken: 0, skipped: 0, missed: 0 };
    const expStats = expByDate.get(dateIso) || { count: 0, total: 0 };

    cells.push({
      dateIso,
      dayOfMonth: cellDate.getDate(),
      inCurrentMonth,
      isToday: dateIso === todayIso,
      doseTone: classifyDoseDayTone(dStats),
      doseStats: {
        ...dStats,
        total: dStats.taken + dStats.skipped + dStats.missed,
      },
      appointmentsCount: aptsByDate.get(dateIso) || 0,
      healthRecordsCount: hrByDate.get(dateIso) || 0,
      expensesCount: expStats.count,
      totalExpenseAmount: expStats.total,
    });
  }

  return cells;
}

export function getHealthCalendarDayDetails(params: {
  dateIso: string;
  patientId?: string | null;
  doseLogs: DoseLog[];
  appointments: DoctorAppointment[];
  healthRecords: HealthRecord[];
  expenses: Expense[];
}): CalendarDayDetails {
  return {
    dateIso: params.dateIso,
    doseLogs: params.doseLogs.filter(
      (l) => l.scheduledDate === params.dateIso && matchesPatient(l.patientId, params.patientId)
    ),
    appointments: params.appointments.filter(
      (a) =>
        a.appointmentDate === params.dateIso &&
        a.status !== 'cancelled' &&
        matchesPatient(a.patientId, params.patientId)
    ),
    healthRecords: params.healthRecords.filter(
      (r) => r.recordDate === params.dateIso && matchesPatient(r.patientId, params.patientId)
    ),
    expenses: params.expenses.filter(
      (e) => e.expenseDate === params.dateIso && matchesPatient(e.patientId, params.patientId)
    ),
  };
}
