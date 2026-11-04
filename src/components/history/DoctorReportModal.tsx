import React from 'react';
import { PatientProfile, Medicine, DoseLog } from '../../types';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { X, Printer, Download, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface DoctorReportModalProps {
  patient: PatientProfile | null;
  medicines: Medicine[];
  logs: DoseLog[];
  onClose: () => void;
}

export const DoctorReportModal: React.FC<DoctorReportModalProps> = ({
  patient,
  medicines,
  logs,
  onClose,
}) => {
  const patientMedicines = patient
    ? medicines.filter((m) => !m.assignedPatientId || m.assignedPatientId === patient.id)
    : medicines;
  const patientLogs = patient ? logs.filter((l) => !l.patientId || l.patientId === patient.id) : logs;

  const takenCount = patientLogs.filter((l) => l.status === 'taken').length;
  const skippedCount = patientLogs.filter((l) => l.status === 'skipped').length;
  const totalCount = patientLogs.length;
  const complianceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>ডাক্তার পরামর্শের জন্য ওষুধ সেবনের আনুষ্ঠানিক রিপোর্ট</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Prescription Report Body */}
        <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans">
          
          {/* Clinic / App Letterhead */}
          <div className="border-b-2 border-teal-700 pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-teal-700 text-white flex items-center justify-center text-sm font-bold">
                  স্বা
                </span>
                <span className="text-xl font-bold text-teal-900 dark:text-teal-400">
                  স্বাস্থ্যবন্ধু (Shasthobondhu)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ডিজিটাল ওষুধ ব্যবস্থাপনা ও রোগীর সেবন ধারাবাহিকতা সারসংক্ষেপ
              </p>
            </div>

            <div className="text-xs text-slate-500 sm:text-right">
              <div>তারিখ: {formatBengaliDate(new Date())}</div>
              <div>রিপোর্ট রেফারেন্স: SB-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          {/* Patient Details Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-400 block">রোগীর নাম:</span>
              <strong className="text-sm font-bold text-slate-900 dark:text-white">
                {patient ? patient.name : 'সকল ওষুধ সারাংশ (সাধারণ)'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">বয়স ও লিঙ্গ:</span>
              <span className="font-semibold">
                {patient ? `${toBengaliNumber(patient.age)} বছর · ${patient.gender}` : 'প্রযোজ্য নয়'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">রক্তের গ্রুপ:</span>
              <span className="font-semibold">{patient?.bloodGroup || 'অজানা'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">জরুরি যোগাযোগ:</span>
              <span className="font-semibold">{patient?.emergencyContact || '১৬২৬৩ (স্বাস্থ্য বাতায়ন)'}</span>
            </div>
          </div>

          {/* Chronic conditions & Allergies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
              <span className="text-slate-500 block mb-1 font-semibold">দীর্ঘমেয়াদী রোগ (Chronic Conditions):</span>
              <span className="text-slate-800 dark:text-slate-200">
                {patient ? (patient.chronicConditions.join(', ') || 'কোনো উল্লেখ নেই') : 'কোনো তথ্য নেই'}
              </span>
            </div>

            <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
              <span className="text-slate-500 block mb-1 font-semibold">পরিচিত ড্রাগ অ্যালার্জি:</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {patient ? (patient.allergies.join(', ') || 'কোনো অ্যালার্জি নেই') : 'কোনো তথ্য নেই'}
              </span>
            </div>
          </div>

          {/* Adherence Compliance Summary */}
          <div className="p-4 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-teal-950 dark:text-teal-200 block text-sm">
                ওষুধ সেবনের নিয়মানুবর্তিতা (Compliance Rate): {toBengaliNumber(complianceRate)}%
              </span>
              <span className="text-teal-800 dark:text-teal-300 text-[11px] mt-0.5 block">
                মোট নির্ধারিত {toBengaliNumber(totalCount)}টি ডোজের মধ্যে {toBengaliNumber(takenCount)}টি সঠিক সময়ে সম্পন্ন হয়েছে
              </span>
            </div>
            <ShieldCheck className="w-8 h-8 text-teal-600 shrink-0" />
          </div>

          {/* Active Prescription Medicines List */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              বর্তমানে চলমান ওষুধ সমূহের তালিকা:
            </h3>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">ওষুধের নাম ও শক্তি</th>
                    <th className="p-2.5">ধরনের ও ডোজ</th>
                    <th className="p-2.5">সময়সূচি</th>
                    <th className="p-2.5">সেবনের নিয়ম</th>
                    <th className="p-2.5 text-right">মজুত</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {patientMedicines.map((med, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {med.brandName}
                        <div className="text-[11px] font-normal text-slate-400">{med.genericName}</div>
                      </td>
                      <td className="p-2.5">{med.type} ({med.strength})</td>
                      <td className="p-2.5">
                        {med.schedules.map((s) => `${s.timeSlot} (${s.dosage})`).join(', ')}
                      </td>
                      <td className="p-2.5">{med.mealTiming}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums">{toBengaliNumber(med.stock)} {med.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Dose Log Audit */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              সাম্প্রতিক ডোজ গ্রহণ ও বাদ দেওয়ার অডিট রেকর্ড:
            </h3>

            <div className="space-y-1.5 text-xs">
              {patientLogs.slice(0, 8).map((log, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{log.medicineName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{log.timeSlot} ({toBengaliNumber(log.scheduledTime)})</span>
                    {log.notes && <span className="text-slate-400 text-[11px]">({log.notes})</span>}
                  </div>

                  <span className={`font-semibold ${
                    log.status === 'taken' ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {log.status === 'taken' ? '✓ গৃহীত' : '✕ বাদ দেওয়া'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor Signature / Clinical Notes Section */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs text-slate-500">
            <div>
              <span>ডাক্তারের মন্তব্য: ____________________________</span>
            </div>
            <div className="text-right">
              <div className="border-t border-slate-400 w-48 mb-1"></div>
              <span>ডাক্তারের স্বাক্ষর ও সীল</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
