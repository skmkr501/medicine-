import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate, formatBengaliTime } from '../../utils/bengaliUtils';
import { DoctorReportModal } from './DoctorReportModal';
import { TimeSlot } from '../../types';
import {
  History,
  CheckCircle2,
  XCircle,
  Calendar,
  Printer,
  Plus,
  Filter,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';

export const MedicineHistory: React.FC = () => {
  const {
    medicines,
    doseLogs,
    activePatient,
    markDose,
    showToast,
  } = useMedicine();

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('7days');
  const [statusFilter, setStatusFilter] = useState<'all' | 'taken' | 'skipped'>('all');
  const [showDoctorReport, setShowDoctorReport] = useState(false);
  const [showManualLogModal, setShowManualLogModal] = useState(false);

  // Manual log state
  const [manualMedId, setManualMedId] = useState(medicines[0]?.id || '');
  const [manualSlot, setManualSlot] = useState<TimeSlot>('সকাল');
  const [manualTime, setManualTime] = useState('08:00 AM');
  const [manualStatus, setManualStatus] = useState<'taken' | 'skipped'>('taken');
  const [manualNotes, setManualNotes] = useState('');

  const patientMedicines = medicines.filter(
    (m) => !activePatient || m.assignedPatientId === activePatient.id
  );

  // Filter logs strictly for active patient + date + status (Requirement 3)
  const filteredLogs = useMemo(() => {
    return doseLogs.filter((log) => {
      if (activePatient && log.patientId !== activePatient.id) return false;

      if (statusFilter !== 'all' && log.status !== statusFilter) return false;

      if (dateFilter === 'today') {
        const todayStr = '2026-11-02';
        return log.scheduledDate === todayStr;
      }
      if (dateFilter === '7days') {
        // Mock dates are 2026-10-26 to 2026-11-02
        return log.scheduledDate >= '2026-10-26';
      }
      if (dateFilter === '30days') {
        return log.scheduledDate >= '2026-10-01';
      }

      return true;
    });
  }, [doseLogs, activePatient, dateFilter, statusFilter]);

  // Group filtered logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, typeof filteredLogs> = {};
    filteredLogs.forEach((log) => {
      if (!groups[log.scheduledDate]) {
        groups[log.scheduledDate] = [];
      }
      groups[log.scheduledDate].push(log);
    });
    return groups;
  }, [filteredLogs]);

  const datesSorted = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // Analytics Metrics
  const totalPatientLogs = activePatient
    ? doseLogs.filter((l) => l.patientId === activePatient.id)
    : doseLogs;
  const takenCount = totalPatientLogs.filter((l) => l.status === 'taken').length;
  const skippedCount = totalPatientLogs.filter((l) => l.status === 'skipped').length;
  const totalCount = totalPatientLogs.length;
  const adherenceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;

  const handleSaveManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMedId) return;
    markDose(manualMedId, manualSlot, manualTime, manualStatus, manualNotes || 'ম্যানুয়াল এন্ট্রি');
    setShowManualLogModal(false);
    setManualNotes('');
    showToast('ডোজ সফলভাবে রেকর্ডে যুক্ত হয়েছে', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ওষুধ সেবনের ইতিহাস ও লগ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activePatient ? `${activePatient.name} এর` : 'সকল রোগীর'} পূর্ববর্তী ডোজ রেকর্ড ও নিয়মানুবর্তিতা
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowManualLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>অতীতের ডোজ লগ করুন</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDoctorReport(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>ডাক্তার রিপোর্ট (প্রিন্ট)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">নিয়মানুবর্তিতা হার</span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {toBengaliNumber(adherenceRate)}%
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            উত্তম স্বাস্থ্য লক্ষ্যমাত্রা বজায় আছে
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">সম্পন্ন ডোজ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {toBengaliNumber(takenCount)}টি
          </div>
          <span className="text-[11px] text-slate-400">
            সময়মতো নিয়মিত গৃহীত
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">বাদ দেওয়া ডোজ</span>
            <XCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {toBengaliNumber(skippedCount)}টি
          </div>
          <span className="text-[11px] text-slate-400">
            শারীরিক সুস্থতা বা ভুলে বাদ
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">চলমান ওষুধ</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {toBengaliNumber(patientMedicines.length)}টি
          </div>
          <span className="text-[11px] text-slate-400">
            প্রেসক্রিপশন সক্রিয় ওষুধ
          </span>
        </div>

      </div>

      {/* Filter Segmented Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Date Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
          <span className="text-slate-400 mr-1 hidden sm:inline">সময়কাল:</span>
          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
              dateFilter === 'today'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            আজ
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('7days')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
              dateFilter === '7days'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            গত ৭ দিন
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('30days')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
              dateFilter === '30days'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            গত ৩০ দিন
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
              dateFilter === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            সবগুলো
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
          <span className="text-slate-400 mr-1">স্ট্যাটাস:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md cursor-pointer ${
              statusFilter === 'all' ? 'font-bold text-teal-800 dark:text-teal-300 underline' : 'text-slate-500'
            }`}
          >
            সব
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('taken')}
            className={`px-2.5 py-1 rounded-md cursor-pointer ${
              statusFilter === 'taken' ? 'font-bold text-emerald-700 dark:text-emerald-400 underline' : 'text-slate-500'
            }`}
          >
            গৃহীত
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('skipped')}
            className={`px-2.5 py-1 rounded-md cursor-pointer ${
              statusFilter === 'skipped' ? 'font-bold text-amber-700 dark:text-amber-400 underline' : 'text-slate-500'
            }`}
          >
            বাদ দেওয়া
          </button>
        </div>

      </div>

      {/* History Log List Grouped by Date */}
      {datesSorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            নির্বাচিত সময়কালে কোনো সেবনের রেকর্ড নেই
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            ফিল্টার পরিবর্তন করুন অথবা ম্যানুয়ালি একটি রেকর্ড যোগ করুন।
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {datesSorted.map((dateStr) => {
            const dateLogs = groupedLogs[dateStr] || [];

            return (
              <div
                key={dateStr}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Date header */}
                <div className="bg-slate-50 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span>{formatBengaliDate(dateStr)}</span>
                  </div>
                  <span className="text-slate-400">
                    মোট {toBengaliNumber(dateLogs.length)}টি ডোজ রেকর্ড
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dateLogs.map((log) => {
                    const isTaken = log.status === 'taken';

                    return (
                      <div
                        key={log.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isTaken
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isTaken ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {log.medicineName}
                              </span>
                              {log.genericName && (
                                <span className="text-slate-400 hidden sm:inline">
                                  ({log.genericName})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-1">
                              <span className="font-semibold text-teal-800 dark:text-teal-300">
                                {log.timeSlot} ({toBengaliNumber(log.scheduledTime)})
                              </span>
                              <span>·</span>
                              <span>ডোজ: {log.dosage}</span>
                              {log.notes && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-400 italic">নোট: {log.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Label */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span
                            className={`px-2.5 py-1 rounded-md font-semibold ${
                              isTaken
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isTaken ? '✓ গ্রহণ সম্পন্ন' : '✕ বাদ দেওয়া'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Dose Log Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              পূর্বে খাওয়া ওষুধ লগ করুন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ভুলে নির্ধারিত সময়ে অ্যাপে না জানালে এখন রেকর্ড করে রাখতে পারেন।
            </p>

            <form onSubmit={handleSaveManualLog} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ওষুধ নির্বাচন করুন
                </label>
                <select
                  value={manualMedId}
                  onChange={(e) => setManualMedId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                >
                  {patientMedicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brandName} ({m.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    সময় স্লট
                  </label>
                  <select
                    value={manualSlot}
                    onChange={(e) => setManualSlot(e.target.value as TimeSlot)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="সকাল">সকাল</option>
                    <option value="দুপুর">দুপুর</option>
                    <option value="সন্ধ্যা">সন্ধ্যা</option>
                    <option value="রাত">রাত</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as 'taken' | 'skipped')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="taken">গ্রহণ সম্পন্ন</option>
                    <option value="skipped">বাদ দেওয়া হয়েছিল</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  মন্তব্য / কারণ
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="যেমন: খাবারের ১০ মিনিট পর খাওয়া হয়েছিল"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManualLogModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg font-semibold bg-teal-700 text-white hover:bg-teal-800"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Report Modal */}
      {showDoctorReport && (
        <DoctorReportModal
          patient={activePatient}
          medicines={medicines}
          logs={doseLogs}
          onClose={() => setShowDoctorReport(false)}
        />
      )}

    </div>
  );
};
