import React, { useState } from 'react';
import { GlobalMedicine, PatientProfile, MealTiming, TimeSlot, DoseSchedule } from '../../types';
import { X, Plus, Trash2, Check, Clock, User, Pill } from 'lucide-react';

interface AddToPersonalModalProps {
  medicine: GlobalMedicine | null;
  patients: PatientProfile[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    med: GlobalMedicine,
    config: {
      patientId?: string;
      mealTiming: MealTiming;
      schedules: DoseSchedule[];
      stock: number;
      unit: string;
      instructions?: string;
    }
  ) => void;
}

export const AddToPersonalModal: React.FC<AddToPersonalModalProps> = ({
  medicine,
  patients,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !medicine) return null;

  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [mealTiming, setMealTiming] = useState<MealTiming>('খাওয়ার পরে');
  const [stock, setStock] = useState<number>(10);
  const [unit, setUnit] = useState<string>('টি');
  const [instructions, setInstructions] = useState<string>('');

  const [schedules, setSchedules] = useState<DoseSchedule[]>([
    { id: '1', timeSlot: 'সকাল', time: '০৮:০০ AM', dosage: '১টি' },
    { id: '2', timeSlot: 'রাত', time: '০৮:০০ PM', dosage: '১টি' },
  ]);

  const addScheduleRow = () => {
    const slots: TimeSlot[] = ['দুপুর', 'সন্ধ্যা'];
    const availableSlot = slots.find((s) => !schedules.some((sch) => sch.timeSlot === s)) || 'দুপুর';
    setSchedules([
      ...schedules,
      {
        id: Date.now().toString(),
        timeSlot: availableSlot,
        time: availableSlot === 'দুপুর' ? '০১:৩০ PM' : '০৬:০০ PM',
        dosage: '১টি',
      },
    ]);
  };

  const removeScheduleRow = (id: string) => {
    if (schedules.length <= 1) return;
    setSchedules(schedules.filter((s) => s.id !== id));
  };

  const updateSchedule = (id: string, updates: Partial<DoseSchedule>) => {
    setSchedules(schedules.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(medicine, {
      patientId: selectedPatientId || undefined,
      mealTiming,
      schedules,
      stock,
      unit,
      instructions,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-teal-50/60 dark:bg-teal-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ব্যক্তিগত তালিকায় যোগ করুন
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {medicine.brandName} ({medicine.strength}) - {medicine.genericName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Patient Selector */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>কার জন্য এই ওষুধ? (প্রোফাইল নির্বাচন)</span>
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-medium"
            >
              <option value="">কোনো প্রোফাইল নির্ধারণ নয় (সাধারণ)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.relation})
                </option>
              ))}
            </select>
          </div>

          {/* Meal Timing */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              খাওয়ার নিয়ম (Meal Timing)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['খাওয়ার আগে', 'খাওয়ার পরে', 'খালি পেটে', 'ভরা পেটে', 'ঘুমানোর আগে', 'প্রয়োজনমতো'] as MealTiming[]).map(
                (timing) => (
                  <button
                    key={timing}
                    type="button"
                    onClick={() => setMealTiming(timing)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                      mealTiming === timing
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 text-teal-800 dark:text-teal-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {timing}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Schedules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>দৈনিক সেবনের সময় ও মাত্রা</span>
              </label>
              {schedules.length < 4 && (
                <button
                  type="button"
                  onClick={addScheduleRow}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>সময় যোগ</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {schedules.map((sch) => (
                <div
                  key={sch.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <select
                    value={sch.timeSlot}
                    onChange={(e) => updateSchedule(sch.id, { timeSlot: e.target.value as TimeSlot })}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                  >
                    <option value="সকাল">সকাল</option>
                    <option value="দুপুর">দুপুর</option>
                    <option value="সন্ধ্যা">সন্ধ্যা</option>
                    <option value="রাত">রাত</option>
                  </select>

                  <input
                    type="text"
                    value={sch.time}
                    onChange={(e) => updateSchedule(sch.id, { time: e.target.value })}
                    placeholder="০৮:০০ AM"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                  />

                  <input
                    type="text"
                    value={sch.dosage}
                    onChange={(e) => updateSchedule(sch.id, { dosage: e.target.value })}
                    placeholder="১টি"
                    className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                  />

                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeScheduleRow(sch.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stock & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বর্তমান মজুদ (Stock)
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                একক (Unit)
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="টি">টি (Tablets/Capsules)</option>
                <option value="মিলি">মিলি (ml Syrup)</option>
                <option value="চামচ">চামচ (Spoons)</option>
                <option value="ড্রপ">ড্রপ (Drops)</option>
                <option value="পাফ">পাফ (Inhaler Puffs)</option>
              </select>
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              বিশেষ নির্দেশনা / ডাক্তারের পরামর্শ (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="যেমন: কুসুম গরম পানি দিয়ে সেব্য"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>আমার ওষুধে সংরক্ষণ করুন</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
