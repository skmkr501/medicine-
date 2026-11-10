import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { HealthRecord } from '../../types';
import {
  Activity,
  Heart,
  Droplet,
  Scale,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  Info,
  CheckCircle2,
  Filter,
  UserCheck,
} from 'lucide-react';

export const HealthRecordsPage: React.FC = () => {
  const {
    healthRecords,
    addHealthRecord,
    deleteHealthRecord,
    activePatient,
    patients,
    setActivePatientId,
    openCreateProfileModal,
    settings,
  } = useMedicine();

  const isEn = settings.language === 'en';

  // Modal State for New Entry
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [sugarType, setSugarType] = useState<'খালি পেটে' | 'খাওয়ার পরে'>('খালি পেটে');
  const [weight, setWeight] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordTime, setRecordTime] = useState('08:30 AM');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Selected tab for chart view: 'bp' | 'sugar' | 'weight'
  const [chartType, setChartType] = useState<'bp' | 'sugar' | 'weight'>('bp');

  // Filter records for active patient
  const patientRecords = useMemo(() => {
    const list = activePatient
      ? healthRecords.filter((r) => r.patientId === activePatient.id)
      : healthRecords;
    // Sort chronological ascending for chart plotting
    return [...list].sort(
      (a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime()
    );
  }, [healthRecords, activePatient]);

  const latestRecord = patientRecords[patientRecords.length - 1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!systolic && !diastolic && !bloodSugar && !weight) {
      setFormError(
        isEn
          ? 'Please enter at least one measurement (BP, Sugar, or Weight)'
          : 'দয়া করে রক্তচাপ, সুগার বা ওজনের মধ্যে যেকোনো একটি মান প্রদান করুন'
      );
      return;
    }

    if (!activePatient) {
      setFormError(
        isEn ? 'Please select or create a patient profile first' : 'প্রথমে একজন রোগীর প্রোফাইল নির্বাচন বা তৈরি করুন'
      );
      return;
    }

    addHealthRecord({
      patientId: activePatient.id,
      recordDate,
      recordTime,
      systolic: systolic ? Number(systolic) : undefined,
      diastolic: diastolic ? Number(diastolic) : undefined,
      bloodSugar: bloodSugar ? Number(bloodSugar) : undefined,
      sugarType: bloodSugar ? sugarType : undefined,
      weight: weight ? Number(weight) : undefined,
      notes: notes.trim() || undefined,
    });

    // Reset & close
    setSystolic('');
    setDiastolic('');
    setBloodSugar('');
    setWeight('');
    setNotes('');
    setIsModalOpen(false);
  };

  // Helper for generating SVG coordinates for line chart
  const bpChartData = useMemo(() => {
    return patientRecords.filter((r) => r.systolic && r.diastolic);
  }, [patientRecords]);

  const sugarChartData = useMemo(() => {
    return patientRecords.filter((r) => r.bloodSugar !== undefined);
  }, [patientRecords]);

  const weightChartData = useMemo(() => {
    return patientRecords.filter((r) => r.weight !== undefined);
  }, [patientRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Header & Patient Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 shadow-2xs">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isEn ? 'Health Records' : 'স্বাস্থ্য রেকর্ড ও শারীরিক পরিমাপ'}
              </h1>
              {activePatient && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800">
                  {activePatient.name} ({activePatient.relation})
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isEn
                ? 'Track blood pressure, blood glucose, and body weight over time'
                : 'পরিবারের সদস্যদের রক্তচাপ, রক্তে সুগার ও ওজনের নিয়মিত রেকর্ড এবং অগ্রগতি চার্ট'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
          {/* Patient Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Member:' : 'সদস্য:'}
            </span>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  openCreateProfileModal();
                } else {
                  setActivePatientId(e.target.value || null);
                }
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.relation})
                </option>
              ))}
              <option value="__add__">+ {isEn ? 'New Profile' : 'নতুন সদস্য তৈরি'}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isEn ? 'Add Measurement' : 'নতুন পরিমাপ যোগ করুন'}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Blood Pressure Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>{isEn ? 'Blood Pressure' : 'সর্বশেষ রক্তচাপ'}</span>
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {latestRecord?.systolic && latestRecord?.diastolic ? (
                <span>
                  {toBengaliNumber(latestRecord.systolic)} / {toBengaliNumber(latestRecord.diastolic)}{' '}
                  <span className="text-xs text-slate-400 font-normal">mmHg</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-normal">{isEn ? 'No data' : 'কোনো তথ্য নেই'}</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block">
              {isEn ? 'Normal band: 90-120 / 60-80' : 'স্বাভাবিক সীমা: ৯০-১২০ / ৬০-৮০ mmHg'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
        </div>

        {/* Blood Sugar Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Droplet className="w-3.5 h-3.5 text-blue-500" />
              <span>{isEn ? 'Blood Glucose' : 'সর্বশেষ রক্তে সুগার'}</span>
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {latestRecord?.bloodSugar !== undefined ? (
                <span>
                  {toBengaliNumber(latestRecord.bloodSugar)}{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    mmol/L ({latestRecord.sugarType || 'খালি পেটে'})
                  </span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-normal">{isEn ? 'No data' : 'কোনো তথ্য নেই'}</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block">
              {isEn ? 'Fasting: 4.0-5.6 | After meal: 5.0-7.8' : 'খালি পেটে: ৪.০-৫.৬ | খাবার পর: ৫.০-৭.৮ mmol/L'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <Droplet className="w-5 h-5" />
          </div>
        </div>

        {/* Weight Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Scale className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isEn ? 'Body Weight' : 'সর্বশেষ শরীরের ওজন'}</span>
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {latestRecord?.weight !== undefined ? (
                <span>
                  {toBengaliNumber(latestRecord.weight)}{' '}
                  <span className="text-xs text-slate-400 font-normal">{isEn ? 'kg' : 'কেজি'}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-normal">{isEn ? 'No data' : 'কোনো তথ্য নেই'}</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block">
              {isEn ? 'Target healthy BMI range' : 'সুস্থ শারীরিক সুস্থতা নির্দেশক'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Chart with Normal Range Bands */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'Health Trends & Normal Bands' : 'তারিখ অনুযায়ী অগ্রগতি চার্ট ও স্বাভাবিক সীমা'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Visual representation with highlighted healthy ranges'
                  : 'স্বাভাবিক সীমার রঙিন ব্যান্ড সহ পরিমাপের দৃশ্যমান রূপ'}
              </p>
            </div>
          </div>

          {/* Chart View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setChartType('bp')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                chartType === 'bp'
                  ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Blood Pressure' : 'রক্তচাপ'}
            </button>
            <button
              type="button"
              onClick={() => setChartType('sugar')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                chartType === 'sugar'
                  ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Blood Sugar' : 'রক্তে সুগার'}
            </button>
            <button
              type="button"
              onClick={() => setChartType('weight')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                chartType === 'weight'
                  ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Weight' : 'ওজন'}
            </button>
          </div>
        </div>

        {/* Chart Canvas / SVG Container */}
        <div className="relative pt-2">
          {chartType === 'bp' && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                    <span>{isEn ? 'Systolic (Upper)' : 'সিস্টোলিক (উপরের)'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                    <span>{isEn ? 'Diastolic (Lower)' : 'ডায়াস্টোলিক (নিচের)'}</span>
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {isEn ? 'Green band: Healthy 90-120 / 60-80' : 'সবুজ ব্যান্ড: স্বাভাবিক সীমা ৯০-১২০ / ৬০-৮০'}
                </span>
              </div>

              {bpChartData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  {isEn ? 'No blood pressure entries found' : 'এখনও কোনো রক্তচাপ পরিমাপ এন্ট্রি করা হয়নি'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] h-56 relative bg-slate-50 dark:bg-slate-850 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    {/* Visual Bands */}
                    <div className="absolute inset-x-4 top-14 bottom-14 bg-emerald-500/10 border-y border-emerald-500/20 rounded pointer-events-none flex items-center justify-end pr-2 text-[10px] text-emerald-700 dark:text-emerald-400">
                      স্বাভাবিক পরিসর (Normal Healthy Zone)
                    </div>

                    {/* SVG Line Chart */}
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                      {/* Grid Lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="#94a3b8" strokeDasharray="3,3" strokeOpacity="0.2" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#94a3b8" strokeDasharray="3,3" strokeOpacity="0.2" />
                      <line x1="0" y1="140" x2="500" y2="140" stroke="#94a3b8" strokeDasharray="3,3" strokeOpacity="0.2" />

                      {/* Points & Lines for Systolic */}
                      {bpChartData.map((d, i) => {
                        const x = bpChartData.length === 1 ? 250 : (i / (bpChartData.length - 1)) * 460 + 20;
                        // Map systolic (90-180) to y (140-20)
                        const ySys = 140 - Math.min(130, Math.max(0, ((d.systolic! - 70) / 110) * 120));
                        const yDia = 140 - Math.min(130, Math.max(0, ((d.diastolic! - 40) / 100) * 120));

                        const prev = bpChartData[i - 1];
                        const prevX = (i - 1) / (bpChartData.length - 1) * 460 + 20;
                        const prevYSys = prev ? 140 - Math.min(130, Math.max(0, ((prev.systolic! - 70) / 110) * 120)) : 0;
                        const prevYDia = prev ? 140 - Math.min(130, Math.max(0, ((prev.diastolic! - 40) / 100) * 120)) : 0;

                        return (
                          <g key={d.id}>
                            {i > 0 && (
                              <>
                                <line x1={prevX} y1={prevYSys} x2={x} y2={ySys} stroke="#f43f5e" strokeWidth="2.5" />
                                <line x1={prevX} y1={prevYDia} x2={x} y2={yDia} stroke="#6366f1" strokeWidth="2.5" />
                              </>
                            )}
                            <circle cx={x} cy={ySys} r="4.5" fill="#f43f5e" />
                            <text x={x} y={ySys - 8} textAnchor="middle" fontSize="10" fill="#f43f5e" fontWeight="bold">
                              {toBengaliNumber(d.systolic!)}
                            </text>
                            <circle cx={x} cy={yDia} r="4.5" fill="#6366f1" />
                            <text x={x} y={yDia + 14} textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="bold">
                              {toBengaliNumber(d.diastolic!)}
                            </text>
                            <text x={x} y="156" textAnchor="middle" fontSize="9" fill="#94a3b8">
                              {d.recordDate.slice(5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          {chartType === 'sugar' && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  <span>{isEn ? 'Blood Sugar (mmol/L)' : 'রক্তে সুগার (mmol/L)'}</span>
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {isEn ? 'Normal band: 4.0 - 7.8 mmol/L' : 'স্বাভাবিক সীমা: ৪.০ - ৭.৮ mmol/L'}
                </span>
              </div>

              {sugarChartData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  {isEn ? 'No blood sugar entries found' : 'এখনও কোনো ব্লাড সুগার এন্ট্রি করা হয়নি'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] h-56 relative bg-slate-50 dark:bg-slate-850 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <div className="absolute inset-x-4 top-16 bottom-16 bg-blue-500/10 border-y border-blue-500/20 rounded pointer-events-none flex items-center justify-end pr-2 text-[10px] text-blue-700 dark:text-blue-400">
                      স্বাভাবিক সুগার সীমা (Healthy Glucose Range)
                    </div>

                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                      {sugarChartData.map((d, i) => {
                        const x = sugarChartData.length === 1 ? 250 : (i / (sugarChartData.length - 1)) * 460 + 20;
                        const y = 140 - Math.min(125, Math.max(0, ((d.bloodSugar! - 3) / 10) * 110));
                        const prev = sugarChartData[i - 1];
                        const prevX = (i - 1) / (sugarChartData.length - 1) * 460 + 20;
                        const prevY = prev ? 140 - Math.min(125, Math.max(0, ((prev.bloodSugar! - 3) / 10) * 110)) : 0;

                        return (
                          <g key={d.id}>
                            {i > 0 && <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="#3b82f6" strokeWidth="2.5" />}
                            <circle cx={x} cy={y} r="5" fill="#3b82f6" />
                            <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#3b82f6" fontWeight="bold">
                              {toBengaliNumber(d.bloodSugar!)}
                            </text>
                            <text x={x} y="156" textAnchor="middle" fontSize="9" fill="#94a3b8">
                              {d.recordDate.slice(5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          {chartType === 'weight' && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span>{isEn ? 'Weight Progression (kg)' : 'শারীরিক ওজন ধারা (কেজি)'}</span>
                </span>
              </div>

              {weightChartData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  {isEn ? 'No weight entries found' : 'এখনও কোনো ওজনের পরিমাপ এন্ট্রি করা হয়নি'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] h-56 relative bg-slate-50 dark:bg-slate-850 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                      {weightChartData.map((d, i) => {
                        const x = weightChartData.length === 1 ? 250 : (i / (weightChartData.length - 1)) * 460 + 20;
                        const y = 140 - Math.min(125, Math.max(0, ((d.weight! - 40) / 60) * 110));
                        const prev = weightChartData[i - 1];
                        const prevX = (i - 1) / (weightChartData.length - 1) * 460 + 20;
                        const prevY = prev ? 140 - Math.min(125, Math.max(0, ((prev.weight! - 40) / 60) * 110)) : 0;

                        return (
                          <g key={d.id}>
                            {i > 0 && <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="#10b981" strokeWidth="2.5" />}
                            <circle cx={x} cy={y} r="5" fill="#10b981" />
                            <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="bold">
                              {toBengaliNumber(d.weight!)} কেজি
                            </text>
                            <text x={x} y="156" textAnchor="middle" fontSize="9" fill="#94a3b8">
                              {d.recordDate.slice(5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mandatory Neutral Information Disclaimer (Requirement: শুধু তথ্য দেখাবে, রোগ নির্ণয় বা চিকিৎসার পরামর্শ দেবে না) */}
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{isEn ? 'Neutral Information Disclaimer:' : 'গুরুত্বপূর্ণ স্বাস্থ্য তথ্য সতর্কতা:'}</strong>{' '}
            {isEn
              ? 'This chart and history display logged values only for personal tracking. It does not provide medical diagnosis, treatment advice, or prescriptions. Always consult your qualified physician.'
              : 'এখানে প্রদর্শিত চার্ট ও তথ্যসমূহ শুধুমাত্র ব্যক্তিগত ট্র্যাকিং ও রেকর্ডের উদ্দেশ্যে সংরক্ষিত। এটি কোনো রোগ নির্ণয় বা চিকিৎসার বিকল্প নয়। যেকোনো অস্বাভাবিক পরিমাপে অবশ্যই আপনার চিকিৎসকের পরামর্শ নিন।'}
          </p>
        </div>
      </section>

      {/* Historical Logs Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? 'Measurement History' : 'বিগত পরিমাপসমূহের তালিকা'}
          </h2>
          <span className="text-xs text-slate-400">
            {toBengaliNumber(patientRecords.length)} {isEn ? 'entries' : 'টি রেকর্ড'}
          </span>
        </div>

        {patientRecords.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            {isEn ? 'No measurements logged yet' : 'এখনও কোনো পরিমাপ যোগ করা হয়নি'}
          </div>
        ) : (
          <div className="space-y-2">
            {[...patientRecords].reverse().map((record) => (
              <div
                key={record.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{formatBengaliDate(record.recordDate)}</span>
                  </div>
                  {record.recordTime && (
                    <span className="text-slate-400 text-[11px]">({record.recordTime})</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
                  {record.systolic && record.diastolic && (
                    <span className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                      BP: <strong>{toBengaliNumber(record.systolic)}/{toBengaliNumber(record.diastolic)}</strong> mmHg
                    </span>
                  )}
                  {record.bloodSugar !== undefined && (
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                      Sugar: <strong>{toBengaliNumber(record.bloodSugar)}</strong> mmol/L ({record.sugarType})
                    </span>
                  )}
                  {record.weight !== undefined && (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                      Weight: <strong>{toBengaliNumber(record.weight)}</strong> কেজি
                    </span>
                  )}
                  {record.notes && (
                    <span className="text-slate-400 text-[11px] italic">"{record.notes}"</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => deleteHealthRecord(record.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors self-end sm:self-auto"
                  title="রেকর্ড মুছুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New Measurement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              <span>{isEn ? 'Log Health Measurements' : 'নতুন শারীরিক পরিমাপ রেকর্ড করুন'}</span>
            </h2>

            {formError && (
              <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              {/* Patient Badge */}
              <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-medium flex items-center justify-between text-xs">
                <span>সদস্য: <strong>{activePatient?.name || 'নির্বাচিত নেই'}</strong></span>
                <span>{activePatient?.relation}</span>
              </div>

              {/* Blood Pressure Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>রক্তচাপ (Blood Pressure - mmHg)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    placeholder="সিস্টোলিক (যেমন: ১২০)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    placeholder="ডায়াস্টোলিক (যেমন: ৮০)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Blood Sugar Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-blue-500" />
                  <span>রক্তে সুগার (Blood Glucose - mmol/L)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={bloodSugar}
                    onChange={(e) => setBloodSugar(e.target.value)}
                    placeholder="সুগার মান (যেমন: ৫.৮)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <select
                    value={sugarType}
                    onChange={(e) => setSugarType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="খালি পেটে">খালি পেটে (Fasting)</option>
                    <option value="খাওয়ার পরে">খাওয়ার পরে (Postprandial)</option>
                  </select>
                </div>
              </div>

              {/* Weight Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-500" />
                  <span>শারীরিক ওজন (কেজি - kg)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="ওজন (যেমন: ৬৮.৫)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    সময়
                  </label>
                  <input
                    type="text"
                    value={recordTime}
                    onChange={(e) => setRecordTime(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  নোট বা মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: হাটার পর পরিমাপ, মাথা ঘোরা ছিল"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
