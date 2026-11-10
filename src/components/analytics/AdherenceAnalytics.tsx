import React, { useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  Flame,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Award,
} from 'lucide-react';

export const AdherenceAnalytics: React.FC = () => {
  const { doseLogs, activePatient, medicines } = useMedicine();

  // Filter logs for active patient
  const patientLogs = useMemo(() => {
    return activePatient
      ? doseLogs.filter((l) => l.patientId === activePatient.id)
      : doseLogs;
  }, [doseLogs, activePatient]);

  // Generate 7-day adherence data (up to today: 2026-11-02)
  const last7DaysData = useMemo(() => {
    const dates = [
      { date: '2026-10-27', dayBn: 'মঙ্গল' },
      { date: '2026-10-28', dayBn: 'বুধ' },
      { date: '2026-10-29', dayBn: 'বৃহঃ' },
      { date: '2026-10-30', dayBn: 'শুক্র' },
      { date: '2026-10-31', dayBn: 'শনি' },
      { date: '2026-11-01', dayBn: 'রবি' },
      { date: '2026-11-02', dayBn: 'আজ' },
    ];

    return dates.map(({ date, dayBn }) => {
      const dayLogs = patientLogs.filter((l) => l.scheduledDate === date);
      const taken = dayLogs.filter((l) => l.status === 'taken').length;
      const total = dayLogs.length;
      // Default to 100% if mocked taken, or calculate
      const percent = total > 0 ? Math.round((taken / total) * 100) : 100;

      return {
        date,
        dayBn,
        taken,
        total,
        percent,
      };
    });
  }, [patientLogs]);

  // Calculate Streak (consecutive days with >= 80% adherence)
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = last7DaysData.length - 1; i >= 0; i--) {
      if (last7DaysData[i].percent >= 80) {
        streak++;
      } else {
        break;
      }
    }
    return Math.max(1, streak);
  }, [last7DaysData]);

  // Overall 30-day metrics
  const totalLogsCount = patientLogs.length;
  const totalTaken = patientLogs.filter((l) => l.status === 'taken').length;
  const totalSkipped = patientLogs.filter((l) => l.status === 'skipped').length;
  const averageAdherence = totalLogsCount > 0 ? Math.round((totalTaken / totalLogsCount) * 100) : 95;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      
      {/* Top Streak Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
            <Flame className="w-7 h-7 fill-amber-500 stroke-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                নিয়মিততার স্ট্রিক (Adherence Streak)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                সক্রিয়
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activePatient?.name || 'ব্যবহারকারী'} টানা{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {toBengaliNumber(currentStreak)} দিন
              </strong>{' '}
              সঠিক সময়ে ওষুধ গ্রহণ করছেন!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 self-start sm:self-auto">
          <div>
            <span className="text-2xs text-slate-400 block">গড় নিয়মিততা</span>
            <span className="text-lg font-extrabold text-teal-700 dark:text-teal-400 tabular-nums">
              {toBengaliNumber(averageAdherence)}%
            </span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="text-2xs text-slate-400 block">মোট ডোজ গ্রহণ</span>
            <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {toBengaliNumber(totalTaken)} বার
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Visual SVG Bar Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            গত ৭ দিনের দৈনিক গ্রহণের হার
          </span>
          <span className="text-2xs text-slate-400">১০০% লক্ষ্যমাত্রা</span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36 pt-4 pb-2 px-2 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
          {last7DaysData.map((d, idx) => {
            const isToday = idx === last7DaysData.length - 1;
            const barHeight = Math.max(15, d.percent);

            let barColor = 'bg-teal-600';
            if (d.percent === 100) barColor = 'bg-emerald-600';
            else if (d.percent < 70) barColor = 'bg-amber-500';

            return (
              <div key={d.date} className="flex flex-col items-center h-full justify-end gap-1.5">
                <span className="text-2xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  {toBengaliNumber(d.percent)}%
                </span>
                <div className="w-full max-w-[28px] bg-slate-200 dark:bg-slate-700 rounded-t-lg h-24 flex items-end overflow-hidden">
                  <div
                    className={`w-full ${barColor} rounded-t-lg transition-all duration-500 ease-out`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span
                  className={`text-2xs ${
                    isToday
                      ? 'font-bold text-teal-700 dark:text-teal-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {d.dayBn}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
