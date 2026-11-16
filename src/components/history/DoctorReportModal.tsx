import React, { useEffect, useState } from 'react';
import { PatientProfile, Medicine, DoseLog } from '../../types';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { X, Printer, Download, FileText, CheckCircle2, ShieldCheck, Share2, Activity, Heart, Scale, Stethoscope } from 'lucide-react';
import { AppLogo } from '../ui/AppLogo';
import { useMedicine } from '../../context/MedicineContext';

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
  const { healthRecords, setCurrentPage, loadHealthRecords, loadOlderDoseLogs, doctors, loadDoctors } = useMedicine();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  useEffect(() => {
    loadHealthRecords();
    loadOlderDoseLogs();
    loadDoctors();
  }, []);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || null;

  const patientMedicines = patient
    ? medicines.filter((m) => !m.assignedPatientId || m.assignedPatientId === patient.id)
    : medicines;
  const patientLogs = patient ? logs.filter((l) => !l.patientId || l.patientId === patient.id) : logs;

  const targetPatientId = patient?.id;
  const memberRecords = targetPatientId ? healthRecords.filter((r) => r.patientId === targetPatientId) : healthRecords;

  const latestBP = memberRecords
    .filter((r) => r.systolic !== undefined && r.diastolic !== undefined)
    .sort((a, b) => `${b.recordDate} ${b.recordTime || ''}`.localeCompare(`${a.recordDate} ${a.recordTime || ''}`))[0];

  const latestSugar = memberRecords
    .filter((r) => r.bloodSugar !== undefined)
    .sort((a, b) => `${b.recordDate} ${b.recordTime || ''}`.localeCompare(`${a.recordDate} ${a.recordTime || ''}`))[0];

  const latestWeight = memberRecords
    .filter((r) => r.weight !== undefined)
    .sort((a, b) => `${b.recordDate} ${b.recordTime || ''}`.localeCompare(`${a.recordDate} ${a.recordTime || ''}`))[0];

  const takenCount = patientLogs.filter((l) => l.status === 'taken').length;
  const skippedCount = patientLogs.filter((l) => l.status === 'skipped').length;
  const totalCount = patientLogs.length;
  const complianceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    let text = `📋 *স্বাস্থ্যবন্ধু — ডাক্তার পরামর্শ রিপোর্ট*\n`;
    if (selectedDoctor) {
      text += `প্রাপক ডাক্তার: ${selectedDoctor.name}${selectedDoctor.specialty ? ` (${selectedDoctor.specialty})` : ''}${selectedDoctor.hospital ? ` — ${selectedDoctor.hospital}` : ''}\n`;
    }
    text += `রোগী: ${patient ? patient.name : 'সাধারণ রোগী'}\n`;
    if (patient) text += `বয়স: ${toBengaliNumber(patient.age)} বছর | রক্ত: ${patient.bloodGroup}\n`;
    text += `সেবনের নিয়মানুবর্তিতা: ${toBengaliNumber(complianceRate)}%\n`;

    if (latestBP || latestSugar || latestWeight) {
      text += `\n*সর্বশেষ স্বাস্থ্য রেকর্ড:*\n`;
      if (latestBP) text += `• রক্তচাপ: ${toBengaliNumber(latestBP.systolic || 0)}/${toBengaliNumber(latestBP.diastolic || 0)} mmHg (${latestBP.recordDate})\n`;
      if (latestSugar) text += `• ব্লাড সুগার: ${toBengaliNumber(latestSugar.bloodSugar || 0)} mmol/L (${latestSugar.sugarType || 'খালি পেটে'}, ${latestSugar.recordDate})\n`;
      if (latestWeight) text += `• ওজন: ${toBengaliNumber(latestWeight.weight || 0)} কেজি (${latestWeight.recordDate})\n`;
    }

    text += `\n*চলমান ওষুধসমূহ:*\n`;
    patientMedicines.forEach((m, i) => {
      text += `${toBengaliNumber(i + 1)}. ${m.brandName} (${m.genericName}) - ${m.schedules.map((s) => `${s.timeSlot} ${s.dosage}`).join(', ')} [${m.mealTiming}]\n`;
    });
    if (patient?.allergies?.length) {
      text += `\n⚠️ অ্যালার্জি: ${patient.allergies.join(', ')}`;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-text font-bold text-sm">
            <FileText className="w-5 h-5 text-primary" />
            <span>ডাক্তার পরামর্শের জন্য ওষুধ সেবনের আনুষ্ঠানিক রিপোর্ট</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentPage('share-report');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] text-xs font-semibold text-primary bg-primary-soft border border-primary/25 hover:bg-primary-soft/80 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>নিরাপদ শেয়ার লিংক</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp এ শেয়ার</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-1.5 text-text-muted hover:text-text rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Doctor Selector (Hidden in Print) */}
        {doctors.length > 0 && (
          <div className="no-print mb-5 p-3.5 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <label
              htmlFor="doctor-report-select"
              className="text-xs sm:text-sm font-bold text-text flex items-center gap-1.5"
            >
              <Stethoscope className="w-4 h-4 text-primary shrink-0" />
              <span>রিপোর্টে ডাক্তারের নাম যোগ করুন (ঐচ্ছিক):</span>
            </label>
            <select
              id="doctor-report-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="min-h-[48px] sm:min-w-[240px] px-3 py-2 text-sm bg-surface border border-border rounded-xl text-text"
            >
              <option value="">নির্বাচন করুন (ঐচ্ছিক)</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` — ${d.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Printable Prescription Report Body */}
        <div className="space-y-6 text-text font-sans">
          
          {/* Clinic / App Letterhead */}
          <div className="border-b-2 border-primary pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <AppLogo size="md" showText={false} />
                <span className="text-xl font-bold text-primary">
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

          {selectedDoctor && (
            <div className="p-3.5 rounded-xl bg-primary-soft/60 border border-primary/25 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-text-muted block">প্রাপক ডাক্তার:</span>
                <strong className="text-sm font-bold text-text">
                  {selectedDoctor.name}
                  {selectedDoctor.specialty ? ` · ${selectedDoctor.specialty}` : ''}
                </strong>
              </div>
              {selectedDoctor.hospital && (
                <div className="text-text-muted font-medium">
                  চেম্বার/হাসপাতাল: {selectedDoctor.hospital}
                </div>
              )}
            </div>
          )}

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

          {/* Latest Health Records (Vitals) */}
          {(latestBP || latestSugar || latestWeight) && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Activity className="w-4 h-4 text-primary" />
                <span>সর্বশেষ স্বাস্থ্য রেকর্ড (Vitals):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {latestBP && (
                  <div className="p-2.5 rounded-lg bg-surface border border-border">
                    <span className="text-[11px] text-text-muted block">রক্তচাপ (BP)</span>
                    <strong className="text-sm text-text">
                      {toBengaliNumber(latestBP.systolic || 0)}/{toBengaliNumber(latestBP.diastolic || 0)}{' '}
                      <span className="text-xs font-normal text-text-muted">mmHg</span>
                    </strong>
                    <span className="text-[10px] text-text-muted block mt-0.5">{latestBP.recordDate}</span>
                  </div>
                )}
                {latestSugar && (
                  <div className="p-2.5 rounded-lg bg-surface border border-border">
                    <span className="text-[11px] text-text-muted block">
                      ব্লাড সুগার ({latestSugar.sugarType || 'খালি পেটে'})
                    </span>
                    <strong className="text-sm text-text">
                      {toBengaliNumber(latestSugar.bloodSugar || 0)}{' '}
                      <span className="text-xs font-normal text-text-muted">mmol/L</span>
                    </strong>
                    <span className="text-[10px] text-text-muted block mt-0.5">{latestSugar.recordDate}</span>
                  </div>
                )}
                {latestWeight && (
                  <div className="p-2.5 rounded-lg bg-surface border border-border">
                    <span className="text-[11px] text-text-muted block">শারীরিক ওজন</span>
                    <strong className="text-sm text-text">
                      {toBengaliNumber(latestWeight.weight || 0)}{' '}
                      <span className="text-xs font-normal text-text-muted">কেজি</span>
                    </strong>
                    <span className="text-[10px] text-text-muted block mt-0.5">{latestWeight.recordDate}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Adherence Compliance Summary */}
          <div className="p-4 bg-primary-soft border border-primary/25 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-text block text-sm">
                ওষুধ সেবনের নিয়মানুবর্তিতা (Compliance Rate): {toBengaliNumber(complianceRate)}%
              </span>
              <span className="text-primary text-[11px] mt-0.5 block">
                মোট নির্ধারিত {toBengaliNumber(totalCount)}টি ডোজের মধ্যে {toBengaliNumber(takenCount)}টি সঠিক সময়ে সম্পন্ন হয়েছে
              </span>
            </div>
            <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
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
                    log.status === 'taken' ? 'text-success-text' : 'text-text-muted'
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
