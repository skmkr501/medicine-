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
      const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

      return {
        date,
        dayBn,
        taken,
        total,
        percent,
      };
    });
  }, [patientLogs]);

  // Calculate Streak (consecutive logged days with >= 80% adherence)
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = last7DaysData.length - 1; i >= 0; i--) {
      if (last7DaysData[i].total > 0 && last7DaysData[i].percent >= 80) {
        streak++;
      } else if (last7DaysData[i].total > 0 || streak > 0) {
        break;
      }
    }
    return streak;
  }, [last7DaysData]);

  // Overall metrics
  const totalLogsCount = patientLogs.length;
  const totalTaken = patientLogs.filter((l) => l.status === 'taken').length;
  const averageAdherence = totalLogsCount > 0 ? Math.round((totalTaken / totalLogsCount) * 100) : 0;

  if (medicines.length === 0 && patientLogs.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      
      {/* Top Streak Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-warning-soft text-warning-text flex items-center justify-center shadow-xs">
            <Flame className="w-7 h-7 fill-warning stroke-warning-text" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text">
                নিয়মিততার স্ট্রিক (Adherence Streak)
              </h2>
              {currentStreak > 0 && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-warning-soft text-warning-text">
                  সক্রিয়
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {totalLogsCount === 0 ? (
                'ওষুধ সেবন শুরু করলে এখানে আপনার নিয়মিততার হিসাব দেখা যাবে।'
              ) : (
                <>
                  {activePatient?.name || 'ব্যবহারকারী'} টানা{' '}
                  <strong className="text-warning-text">
                    {toBengaliNumber(currentStreak)} দিন
                  </strong>{' '}
                  সঠিক সময়ে ওষুধ গ্রহণ করছেন!
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-surface-2 p-3 rounded-xl border border-border self-start sm:self-auto">
          <div>
            <span className="text-2xs text-text-muted block">গড় নিয়মিততা</span>
            <span className="text-lg font-extrabold text-primary tabular-nums">
              {toBengaliNumber(averageAdherence)}%
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <span className="text-2xs text-text-muted block">মোট ডোজ গ্রহণ</span>
            <span className="text-lg font-extrabold text-success-text tabular-nums">
              {toBengaliNumber(totalTaken)} বার
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Visual SVG Bar Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-text flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            গত ৭ দিনের দৈনিক গ্রহণের হার
          </span>
          <span className="text-2xs text-text-muted">১০০% লক্ষ্যমাত্রা</span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36 pt-4 pb-2 px-2 bg-surface-2/60 rounded-xl border border-border">
          {last7DaysData.map((d, idx) => {
            const isToday = idx === last7DaysData.length - 1;
            const hasLogs = d.total > 0;
            const barHeight = hasLogs ? Math.max(15, d.percent) : 8;

            let barColor = 'bg-border';
            if (hasLogs) {
              if (d.percent === 100) barColor = 'bg-success';
              else if (d.percent < 70) barColor = 'bg-warning';
              else barColor = 'bg-primary';
            }

            return (
              <div key={d.date} className="flex flex-col items-center h-full justify-end gap-1.5">
                <span className="text-2xs font-bold text-text-muted tabular-nums">
                  {hasLogs ? `${toBengaliNumber(d.percent)}%` : '–'}
                </span>
                <div className="w-full max-w-[28px] bg-surface-2 rounded-t-lg h-24 flex items-end overflow-hidden">
                  <div
                    className={`w-full ${barColor} rounded-t-lg transition-all duration-500 ease-out`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span
                  className={`text-2xs ${
                    isToday
                      ? 'font-bold text-primary'
                      : 'text-text-muted'
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
