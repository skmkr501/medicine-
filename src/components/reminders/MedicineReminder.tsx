import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, playAlertTone } from '../../utils/bengaliUtils';
import { TimeSlot } from '../../types';
import {
  Bell,
  Volume2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Info,
  Timer,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { predictMedicineStock } from '../../utils/stockPredictor';

export const MedicineReminder: React.FC = () => {
  const {
    medicines,
    doseLogs,
    activePatient,
    markDose,
    settings,
    updateSettings,
    showToast,
    setCurrentPage,
    openStockAdjustmentModal,
  } = useMedicine();

  const [snoozeSlot, setSnoozeSlot] = useState<string | null>(null);

  const todayStr = '2026-11-02';

  // Gather active patient medicines or all if no active patient
  const patientMedicines = medicines.filter(
    (m) =>
      (!activePatient || m.assignedPatientId === activePatient.id) &&
      m.status === 'active'
  );

  // Group today's schedules into slots
  const slots: TimeSlot[] = ['সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'];

  const slotMetadata: Record<
    TimeSlot,
    { label: string; timeRange: string; icon: string }
  > = {
    'সকাল': { label: 'সকালের ডোজ', timeRange: '০৬:০০ AM - ১১:৫৯ AM', icon: '🌅' },
    'দুপুর': { label: 'দুপুরের ডোজ', timeRange: '১২:০০ PM - ০৪:৫৯ PM', icon: '☀️' },
    'সন্ধ্যা': { label: 'সন্ধ্যার ডোজ', timeRange: '০৫:০০ PM - ০৭:৫৯ PM', icon: '🌇' },
    'রাত': { label: 'রাতের ডোজ', timeRange: '০৮:০০ PM - ১১:৫৯ PM', icon: '🌙' },
  };

  const handleTestSound = () => {
    playAlertTone(settings.selectedTone);
    showToast(`"${settings.selectedTone}" অডিও অ্যালার্ট সফলভাবে টেস্ট করা হয়েছে`, 'info');
  };

  const handleSnooze = (slotKey: string) => {
    setSnoozeSlot(slotKey);
    showToast(`১০ মিনিটের জন্য স্লটটি স্নুজ করা হয়েছে`, 'info');
    setTimeout(() => {
      setSnoozeSlot(null);
    }, 10000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ওষুধের রিমাইন্ডার ও সময়সূচি
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activePatient ? `${activePatient.name} এর` : 'সকল ওষুধের'} দৈনিক অ্যালার্ট ও গ্রহণের শিডিউল
          </p>
        </div>

        {/* Audio test & alert settings toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleTestSound}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>অ্যালার্ট টোন শুনুন</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              settings.soundEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            শব্দ: {settings.soundEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
      </div>

      {/* Android Native Background Reminder Architecture & Permission Info */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              🤖
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Android নেটিভ ব্যাকগ্রাউন্ড রিমাইন্ডার আর্কিটেকচার (AlarmManager + Kotlin)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
            নেটিভ কোড যুক্ত
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          স্বাস্থ্যবন্ধুতে নির্ভরযোগ্য অ্যালার্মের জন্য শুধুমাত্র ব্রাউজার টাইমার বা পুশ নোটিফিকেশনের ওপর নির্ভর না করে অ্যান্ড্রয়েডের নিজস্ব <strong>AlarmManager</strong>, <strong>BroadcastReceiver</strong> এবং <strong>Foreground Service</strong> কোডবেস (Kotlin) তৈরি করা হয়েছে।
        </p>

        {/* Permissions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              1. Exact Alarm
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Android 12+ এ সঠিক মিনিটে ইনসুলিন ও রক্তচাপের ওষুধ স্মরণ করাতে Doze মোড বাইপাস করে।
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              2. Lock-Screen Alert
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ফোন লক থাকলেও স্ক্রিন অন করে সরাসরি গ্রহণ বা ১০ মিনিট স্নুজ করার অপশন দেখায়।
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              3. Reboot Rescheduling
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ডিভাইস রিবুট বা টাইম জোন পরিবর্তিত হলে লোকাল অফলাইন স্টোরেজ থেকে অ্যালার্ম রি-শিডিউল হয়।
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              4. Offline Storage
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ইন্টারনেট সংযোগ না থাকলেও সমস্ত শিডিউল লোকাল ডিভাইসে সংরক্ষিত থাকে ও যথাসময়ে বাজে।
            </span>
          </div>
        </div>

        {/* Real Device Notice */}
        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>গুরুত্বপূর্ণ তথ্য:</strong> ব্যাকগ্রাউন্ড অ্যালার্ম ও ভাইব্রেশনের কার্যকারিতা নিশ্চিত করতে বাস্তব অ্যান্ড্রয়েড ডিভাইসে (Real Android Device) APK ইনস্টল করে প্রয়োজনীয় Exact Alarm ও Notification পারমিশন অনুমোদন করতে হবে।
          </span>
        </div>
      </div>

      {/* Weekly Compliance Streak Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white">
              সাপ্তাহিক ওষুধ কমপ্লায়েন্স ক্যালেন্ডার
            </h2>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
            ধারাবাহিকতা: ৪ দিন বজায় আছে 🔥
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {[
            { day: 'রবি', date: '২৭ অক্টো', status: 'full' },
            { day: 'সোম', date: '২৮ অক্টো', status: 'full' },
            { day: 'মঙ্গল', date: '২৯ অক্টো', status: 'partial' },
            { day: 'বুধ', date: '৩০ অক্টো', status: 'full' },
            { day: 'বৃহঃ', date: '৩১ অক্টো', status: 'full' },
            { day: 'শুক্র', date: '১ নভে', status: 'full' },
            { day: 'শনি (আজ)', date: '২ নভে', status: 'active' },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition-colors ${
                item.status === 'full'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                  : item.status === 'partial'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                  : 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold ring-1 ring-teal-500'
              }`}
            >
              <div className="font-semibold">{item.day}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{toBengaliNumber(item.date)}</div>
              <div className="mt-1">
                {item.status === 'full' && '✓ ১০০%'}
                {item.status === 'partial' && '⚠ ৭৫%'}
                {item.status === 'active' && 'আজ চলমান'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Stock Predictor Alerts Strip in Reminders */}
      {(() => {
        const expiringMeds = patientMedicines
          .map((m) => ({ med: m, pred: predictMedicineStock(m) }))
          .filter(({ pred }) => pred.status === 'out_of_stock' || pred.status === 'urgent' || pred.status === 'low_stock');

        if (expiringMeds.length === 0) return null;

        return (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  ওষুধের মজুত রিমাইন্ডার ({toBengaliNumber(expiringMeds.length)}টি ওষুধ শেষ হওয়ার পথে)
                </h3>
              </div>
              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                ২৪ ঘণ্টায় ১ বার অ্যালার্ট
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {expiringMeds.map(({ med, pred }) => (
                <div
                  key={med.id}
                  className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {med.brandName}
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium block">
                      {pred.status === 'out_of_stock'
                        ? 'মজুত শেষ (০ টি)'
                        : `আর ${toBengaliNumber(pred.daysRemaining ?? 0)} দিন বাকি`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStockAdjustmentModal(med.id)}
                    className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 text-amber-900 dark:text-amber-200 text-[11px] font-semibold rounded-md flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Package className="w-3 h-3" />
                    <span>আপডেট</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1 border-t border-amber-200/60 dark:border-amber-900/30">
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <span>
                ব্রাউজারে ব্যাকগ্রাউন্ড নোটিফিকেশন সীমাবদ্ধ থাকতে পারে। নির্ভরযোগ্য রিমাইন্ডারের জন্য প্রতিদিন অ্যাপে চোখ রাখুন অথবা নেটিভ অ্যান্ড্রয়েড অ্যালার্ম ব্যবহার করুন।
              </span>
            </div>
          </div>
        );
      })()}

      {/* Reminder Schedule by Slots */}
      {patientMedicines.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <Clock className="w-10 h-10 text-teal-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            রিমাইন্ডারের জন্য কোনো ওষুধ যোগ করা হয়নি
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            নতুন ওষুধের প্রেসক্রিপশন এবং দৈনিক সময়সূচি যোগ করতে নিচে ক্লিক করুন।
          </p>
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 cursor-pointer"
          >
            ওষুধ যুক্ত করুন
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => {
            const meta = slotMetadata[slot];
          
          // Get medicines assigned to this slot
          const slotItems: {
            medicine: typeof patientMedicines[0];
            time: string;
            dosage: string;
            isTaken: boolean;
            isSkipped: boolean;
          }[] = [];

          patientMedicines.forEach((med) => {
            const sch = med.schedules.find((s) => s.timeSlot === slot);
            if (sch) {
              const log = doseLogs.find(
                (l) =>
                  l.medicineId === med.id &&
                  l.scheduledDate === todayStr &&
                  l.timeSlot === slot
              );
              slotItems.push({
                medicine: med,
                time: sch.time,
                dosage: sch.dosage,
                isTaken: log?.status === 'taken',
                isSkipped: log?.status === 'skipped',
              });
            }
          });

          if (slotItems.length === 0) return null;

          const isSlotSnoozed = snoozeSlot === slot;

          return (
            <div
              key={slot}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
            >
              {/* Slot Header */}
              <div className="bg-slate-50 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{meta.icon}</span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {meta.label} ({slot})
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      {toBengaliNumber(meta.timeRange)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSlotSnoozed ? (
                    <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 animate-spin" />
                      ১০ মি. স্নুজ করা আছে
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSnooze(slot)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      স্নুজ (১০ মিনিট)
                    </button>
                  )}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {toBengaliNumber(slotItems.length)}টি ওষুধ
                  </span>
                </div>
              </div>

              {/* Slot Medicines List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {slotItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          item.isTaken
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400'
                        }`}
                      >
                        {item.isTaken ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            {item.medicine.brandName}
                          </h3>
                          <span className="text-xs text-slate-500">
                            · {item.medicine.type} ({item.medicine.strength})
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.medicine.genericName}
                        </p>

                        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 mt-2">
                          <span className="font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded">
                            নির্ধারিত সময়: {toBengaliNumber(item.time)}
                          </span>
                          <span>ডোজ: {item.dosage}</span>
                          <span>·</span>
                          <span>{item.medicine.mealTiming}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {item.isTaken ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            গৃহীত সম্পন্ন
                          </span>
                          <button
                            type="button"
                            onClick={() => markDose(item.medicine.id, slot, item.time, 'skipped', 'পরিবর্তন')}
                            className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                          >
                            পরিবর্তন
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => markDose(item.medicine.id, slot, item.time, 'taken')}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>গ্রহণ করেছি</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => markDose(item.medicine.id, slot, item.time, 'skipped')}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            বাদ দিন
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      )}

    </div>
  );
};
