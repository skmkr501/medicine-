import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { MedicineType, MealTiming, TimeSlot, DoseSchedule } from '../../types';
import { commonMedicinePresets } from '../../data/mockData';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  Pill,
  Sparkles,
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const AddMedicine: React.FC = () => {
  const { addMedicine, patients, activePatientId, setCurrentPage, openCreateProfileModal } = useMedicine();

  // Form State
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [type, setType] = useState<MedicineType>('ট্যাবলেট');
  const [strength, setStrength] = useState('');
  const [mealTiming, setMealTiming] = useState<MealTiming>('খাওয়ার পরে');
  const [assignedPatientId, setAssignedPatientId] = useState<string | undefined>(
    activePatientId || undefined
  );
  const [purpose, setPurpose] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [stock, setStock] = useState<number>(30);
  const [minStockAlert, setMinStockAlert] = useState<number>(7);
  const [unit, setUnit] = useState('টি');
  const [isChronic, setIsChronic] = useState(true);
  const [durationDays, setDurationDays] = useState<number>(7);
  
  // Schedules state
  const [schedules, setSchedules] = useState<DoseSchedule[]>([
    { id: '1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
    { id: '2', timeSlot: 'রাত', time: '08:30 PM', dosage: '১টি' },
  ]);

  const [formError, setFormError] = useState('');

  // Handle Preset quick-fill
  const handleApplyPreset = (preset: typeof commonMedicinePresets[0]) => {
    setBrandName(preset.brandName);
    setGenericName(preset.genericName);
    setType(preset.type);
    setStrength(preset.strength);
    setMealTiming(preset.mealTiming);
    setPurpose(preset.purpose);
    setStock(preset.stock);
    setMinStockAlert(preset.minStockAlert);
    setUnit(preset.unit);
    setIsChronic(preset.isChronic);
    if (preset.durationDays) setDurationDays(preset.durationDays);
    setSchedules(
      preset.defaultSchedules.map((s, idx) => ({
        id: String(idx + 1),
        timeSlot: s.timeSlot,
        time: s.time,
        dosage: s.dosage,
      }))
    );
    setFormError('');
  };

  const addScheduleSlot = () => {
    const slots: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];
    const currentSlots = schedules.map((s) => s.timeSlot);
    const availableSlot = slots.find((s) => !currentSlots.includes(s)) || 'দুপুর';
    
    let defaultTime = '01:30 PM';
    if (availableSlot === 'সকাল') defaultTime = '08:00 AM';
    if (availableSlot === 'সন্ধ্যা') defaultTime = '06:00 PM';
    if (availableSlot === 'রাত') defaultTime = '09:00 PM';

    setSchedules([
      ...schedules,
      {
        id: Date.now().toString(),
        timeSlot: availableSlot,
        time: defaultTime,
        dosage: '১টি',
      },
    ]);
  };

  const removeScheduleSlot = (id: string) => {
    if (schedules.length <= 1) {
      setFormError('কমপক্ষে একটি সময়সূচি থাকা প্রয়োজন');
      return;
    }
    setSchedules(schedules.filter((s) => s.id !== id));
  };

  const updateSchedule = (id: string, updates: Partial<DoseSchedule>) => {
    setSchedules(
      schedules.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      setFormError('দয়া করে ওষুধের নাম লিখুন');
      return;
    }
    if (schedules.length === 0) {
      setFormError('কমপক্ষে একটি সেবনের সময়সূচি যোগ করুন');
      return;
    }

    addMedicine({
      brandName: brandName.trim(),
      genericName: genericName.trim() || 'সাধারণ ওষুধ',
      type,
      strength: strength.trim() || 'নির্দিষ্ট মাত্রা',
      mealTiming,
      assignedPatientId,
      schedules,
      stock: Number(stock) || 0,
      minStockAlert: Number(minStockAlert) || 5,
      unit,
      startDate: new Date().toISOString().split('T')[0],
      isChronic,
      durationDays: isChronic ? undefined : Number(durationDays),
      purpose: purpose.trim(),
      doctorName: doctorName.trim(),
      instructions: instructions.trim(),
      status: 'active',
      colorTag: 'teal',
    });

    setCurrentPage('medicines');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentPage('medicines')}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ওষুধের তালিকায় ফিরে যান</span>
        </button>

        <span className="text-xs text-slate-400">
          নতুন প্রেসক্রিপশন এন্ট্রি
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            নতুন ওষুধ যুক্ত করুন
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            প্রেসক্রিপশন অনুযায়ী সঠিক তথ্য ও ডোজ সময়সূচি নির্ধারণ করুন
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentPage('library')}
          className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700/60 text-teal-800 dark:text-teal-300 rounded-xl text-xs font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Pill className="w-3.5 h-3.5 text-teal-600" />
          <span>ওষুধ লাইব্রেরি থেকে খুঁজুন</span>
        </button>
      </div>


      {/* Quick Presets Bar */}
      <div className="bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-teal-900 dark:text-teal-200">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>সাধারণ ওষুধ প্রিসেট (এক ক্লিকে পূরণ করুন):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {commonMedicinePresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 rounded-md hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
            >
              + {preset.brandName}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {formError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            ১. ওষুধের মৌলিক বিবরণ
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ওষুধের নাম (ব্র্যান্ড) *
              </label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="যেমন: নাপা এক্সট্রা, সেক্লো ২০, কনকর"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                জেনেরিক নাম ও কোম্পানি
              </label>
              <input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="যেমন: Paracetamol 500mg, Square Pharma"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ওষুধের ধরন
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MedicineType)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="ট্যাবলেট">ট্যাবলেট</option>
                <option value="ক্যাপসুল">ক্যাপসুল</option>
                <option value="সিরাপ">সিরাপ</option>
                <option value="ইনসুলিন/ইনজেকশন">ইনসুলিন/ইনজেকশন</option>
                <option value="চোখের ড্রপ">চোখের ড্রপ</option>
                <option value="ইনহেলার">ইনহেলার</option>
                <option value="মলম/জেল">মলম/জেল</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                মাত্রা বা শক্তি (Strength)
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="যেমন: 500 mg, 20 mg, 100 IU"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  কার জন্য নির্ধারিত রোগী? (ঐচ্ছিক)
                </label>
                <button
                  type="button"
                  onClick={openCreateProfileModal}
                  className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                >
                  + নতুন প্রোফাইল
                </button>
              </div>
              <select
                value={assignedPatientId || ''}
                onChange={(e) => setAssignedPatientId(e.target.value || undefined)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="">কোনো নির্দিষ্ট প্রোফাইল নেই (পরে অ্যাসাইন করুন)</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relation})
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  বর্তমানে কোনো রোগী প্রোফাইল নেই। ওষুধটি সংরক্ষণ করুন এবং পরে প্রোফাইলে যুক্ত করুন।
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Schedules & Timings */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                ২. সেবনের নিয়ম ও দৈনিক সময়সূচি
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                প্রতিদিনের নির্ধারিত সময় ও ডোজ উল্লেখ করুন
              </p>
            </div>

            <button
              type="button"
              onClick={addScheduleSlot}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>সময় যোগ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                খাবারের সাথে সময়
              </label>
              <select
                value={mealTiming}
                onChange={(e) => setMealTiming(e.target.value as MealTiming)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="খাওয়ার আগে">খাওয়ার আগে (৩০ মিনিট পূর্বে)</option>
                <option value="খাওয়ার পরে">খাওয়ার পরে (ভরা পেটে)</option>
                <option value="খালি পেটে">খালি পেটে</option>
                <option value="ঘুমানোর আগে">ঘুমানোর আগে</option>
                <option value="প্রয়োজনমতো">প্রয়োজনমতো (ব্যথা বা জ্বর হলে)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                রোগ বা সেবনের কারণ
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="যেমন: ডায়াবেটিস, প্রেসার, গ্যাস্ট্রিক, জ্বর"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Schedule Slots Rows */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              নির্ধারিত দৈনিক স্লট সমূহ:
            </span>

            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                  <select
                    value={schedule.timeSlot}
                    onChange={(e) => updateSchedule(schedule.id, { timeSlot: e.target.value as TimeSlot })}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                  >
                    <option value="সকাল">সকাল</option>
                    <option value="দুপুর">দুপুর</option>
                    <option value="সন্ধ্যা">সন্ধ্যা</option>
                    <option value="রাত">রাত</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">সময়:</span>
                    <input
                      type="text"
                      value={schedule.time}
                      onChange={(e) => updateSchedule(schedule.id, { time: e.target.value })}
                      placeholder="08:00 AM"
                      className="w-24 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">ডোজ:</span>
                    <input
                      type="text"
                      value={schedule.dosage}
                      onChange={(e) => updateSchedule(schedule.id, { dosage: e.target.value })}
                      placeholder="১টি / ৫ মিলি"
                      className="w-24 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    />
                  </div>

                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeScheduleSlot(schedule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      title="স্লট সরান"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Stock & Course Duration */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            ৩. মজুত (Stock) ও কোর্সের মেয়াদ
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বর্তমান মজুত সংখ্যা
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                কম মজুত সতর্কবার্তা সীমা
              </label>
              <input
                type="number"
                min="1"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                একক (Unit)
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="টি">টি (Tablets/Capsules)</option>
                <option value="বোতল">বোতল (Bottle)</option>
                <option value="পেন">পেন (Insulin Pen)</option>
                <option value="ড্রপ">ড্রপ (Eye Drop)</option>
                <option value="পাফ">পাফ (Inhaler Puff)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isChronic}
                onChange={(e) => setIsChronic(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
              />
              <span>এটি নিয়মিত / দীর্ঘমেয়াদী ওষুধ (প্রেসার, সুগার ইত্যাদি)</span>
            </label>

            {!isChronic && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">কোর্সের মেয়াদ:</span>
                <input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 7)}
                  className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-xs"
                />
                <span className="text-slate-500">দিন</span>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Doctor & Instructions */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            ৪. প্রেসক্রিপশন ডাক্তার ও বিশেষ নির্দেশিকা
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ডাক্তারের নাম ও ডিগ্রি
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="যেমন: ডা. সুব্রত পাল (NICVD)"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বিশেষ সতর্কতা ও নির্দেশনা
              </label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="যেমন: পর্যাপ্ত পানি পান করবেন, ড্রপ দেওয়ার পর চোখ বন্ধ রাখুন"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </section>

        {/* Form Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setCurrentPage('medicines')}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            বাতিল
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>ওষুধ সংরক্ষণ করুন</span>
          </button>
        </div>

      </form>
    </div>
  );
};
