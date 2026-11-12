import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate, formatBengaliTime } from '../../utils/bengaliUtils';
import { TimeSlot } from '../../types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Package,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Cloud,
  RefreshCw,
  Lock,
  UserPlus,
  Edit2,
  ShoppingCart,
  Calendar,
  Bell,
  PhoneCall,
  Share2,
  AlertCircle,
  CloudOff,
  Pill,
  BookOpen,
  ListChecks,
  X,
  Volume2,
} from 'lucide-react';

import { ExpiringStockSection } from './ExpiringStockSection';
import { FamilyCareSummary } from './FamilyCareSummary';
import { EmergencyCard } from '../emergency/EmergencyCard';
import { AdherenceAnalytics } from '../analytics/AdherenceAnalytics';
import { BuyListModal } from '../stock/BuyListModal';
import {
  isNativeRemindersAvailable,
  getNativePermissionStatus,
  NativePermissionStatus,
} from '../../services/nativeReminders';
import { buildDoseSpeechText, useBengaliSpeech } from '../../utils/speechUtils';

function parseScheduleMinutes(timeStr: string): number {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let normalized = (timeStr || '').trim();
  bengaliDigits.forEach((d, idx) => {
    normalized = normalized.split(d).join(String(idx));
  });
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export const Dashboard: React.FC = () => {
  const [isBuyListOpen, setIsBuyListOpen] = useState(false);
  const [showMoreWidgets, setShowMoreWidgets] = useState(false);
  const [showTakenDoses, setShowTakenDoses] = useState(false);
  const [deferredDoseKeys, setDeferredDoseKeys] = useState<string[]>([]);
  const [showEasyDosesModal, setShowEasyDosesModal] = useState(false);
  const [showEasyEmergencyModal, setShowEasyEmergencyModal] = useState(false);

  const { hasBengaliVoice, speak } = useBengaliSpeech();
  const isNative = isNativeRemindersAvailable();
  const [nativePerms, setNativePerms] = useState<NativePermissionStatus | null>(() =>
    getNativePermissionStatus()
  );

  React.useEffect(() => {
    if (!isNative) return;
    const check = () => setNativePerms(getNativePermissionStatus());
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [isNative]);

  const hasMissingPermissions =
    isNative &&
    nativePerms !== null &&
    (!nativePerms.exactAlarm || !nativePerms.notifications || !nativePerms.batteryUnrestricted);

  const {
    medicines,
    doseLogs,
    activePatient,
    patients,
    setActivePatientId,
    setCurrentPage,
    markDose,
    openStockAdjustmentModal,
    currentUser,
    openAuthModal,
    syncLocalToCloud,
    triggerManualSync,
    syncStatus,
    lastSyncedAt,
    isSyncing,
    openCreateProfileModal,
    openEditProfileModal,
    appointments,
    settings,
    showToast,
  } = useMedicine();

  const todayStr = '2026-11-02';

  // Urgent Appointments (Today or Tomorrow)
  const nowDate = new Date();
  const realTodayStr = nowDate.toISOString().split('T')[0];
  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const realTomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const urgentAppointments = appointments.filter((app) => {
    if (app.status === 'completed') return false;
    const isTargetPatient = activePatient ? app.patientId === activePatient.id : true;
    return isTargetPatient && (app.appointmentDate === realTodayStr || app.appointmentDate === realTomorrowStr);
  });

  // Dose overdue helper (>30 minutes past scheduled time)
  const isDoseOverdueBy30Min = (doseTime: string): boolean => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let normalized = doseTime.trim();
    bengaliDigits.forEach((d, idx) => {
      normalized = normalized.split(d).join(String(idx));
    });

    const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (!match) return false;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const now = new Date();
    const doseDate = new Date();
    doseDate.setHours(hours, minutes, 0, 0);

    const diffMinutes = (now.getTime() - doseDate.getTime()) / (1000 * 60);
    return diffMinutes > 30;
  };

  const handleNotifyFamily = (dose: { brandName: string; dosage: string; time: string }, method: 'whatsapp' | 'sms') => {
    const patientName = activePatient?.name || 'সদস্য';
    const contactPhone = settings.emergencyContactPhone || '';

    const message = `জরুরি স্বাস্থ্যবার্তা: ${patientName}-এর "${dose.brandName}" (${dose.dosage}) নির্ধারিত সময় (${dose.time})-এর ডোজ ৩০ মিনিটের বেশি পার হলেও এখনও গ্রহণ করা হয়নি। অনুগ্রহ করে খোঁজ নিন। - স্বাস্থ্যবন্ধু`;

    if (!contactPhone) {
      showToast('প্রথমে পরিবারের জরুরি নম্বর যোগ করুন — সেটিংসে যাওয়া হচ্ছে', 'info');
      setCurrentPage('settings');
      return;
    }

    const cleanPhone = contactPhone.replace(/[^0-9+]/g, '');
    if (method === 'whatsapp') {
      window.location.href = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    } else {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    }
  };

  // Filter medicines for current active patient strictly
  const patientMedicines = activePatient
    ? medicines.filter(
        (m) => m.assignedPatientId === activePatient.id && m.status === 'active'
      )
    : medicines.filter((m) => m.status === 'active');

  interface TodayDoseItem {
    key: string;
    medicineId: string;
    brandName: string;
    genericName: string;
    type: string;
    timeSlot: TimeSlot;
    time: string;
    dosage: string;
    mealTiming: string;
    colorTag: string;
    stock: number;
    logStatus?: 'taken' | 'skipped' | 'missed';
    loggedAt?: string;
    isOverdue?: boolean;
  }

  const todayDoses = useMemo(() => {
    const items: TodayDoseItem[] = [];

    patientMedicines.forEach((med) => {
      med.schedules.forEach((sch) => {
        const log = doseLogs.find(
          (l) =>
            l.medicineId === med.id &&
            l.scheduledDate === todayStr &&
            l.timeSlot === sch.timeSlot
        );
        const overdue = !log?.status && isDoseOverdueBy30Min(sch.time);

        items.push({
          key: `${med.id}-${sch.timeSlot}`,
          medicineId: med.id,
          brandName: med.brandName,
          genericName: med.genericName,
          type: med.type,
          timeSlot: sch.timeSlot,
          time: sch.time,
          dosage: sch.dosage,
          mealTiming: med.mealTiming,
          colorTag: med.colorTag,
          stock: med.stock,
          logStatus: log?.status,
          loggedAt: log?.loggedAt,
          isOverdue: overdue,
        });
      });
    });

    const slotOrder: Record<TimeSlot, number> = {
      'সকাল': 1,
      'দুপুর': 2,
      'সন্ধ্যা': 3,
      'রাত': 4,
    };

    items.sort((a, b) => {
      const slotDiff = slotOrder[a.timeSlot] - slotOrder[b.timeSlot];
      if (slotDiff !== 0) return slotDiff;
      return parseScheduleMinutes(a.time) - parseScheduleMinutes(b.time);
    });

    return items;
  }, [patientMedicines, doseLogs, todayStr]);

  const totalToday = todayDoses.length;
  const takenDoses = todayDoses.filter((d) => d.logStatus === 'taken');
  const pendingDoses = todayDoses.filter((d) => d.logStatus !== 'taken' && d.logStatus !== 'skipped');
  const remainingDoses = todayDoses.filter((d) => d.logStatus !== 'taken');
  const takenCount = takenDoses.length;
  const adherencePercent = totalToday > 0 ? Math.round((takenCount / totalToday) * 100) : 0;
  const overdueDoses = pendingDoses.filter((d) => d.isOverdue);
  const lowStockMedicines = patientMedicines.filter((m) => m.stock <= m.minStockAlert);

  // Next due dose spotlight: non-deferred pending first, or fall back to first pending if user deferred all
  const nonDeferredPending = pendingDoses.filter((d) => !deferredDoseKeys.includes(d.key));
  const nextDueDose = nonDeferredPending[0] || pendingDoses[0] || null;
  const remainingListDoses = remainingDoses.filter((d) => !nextDueDose || d.key !== nextDueDose.key);

  const handleDeferDose = (dose: TodayDoseItem) => {
    setDeferredDoseKeys((prev) => (prev.includes(dose.key) ? prev : [...prev, dose.key]));
    showToast(`"${dose.brandName}" পরের তালিকায় রাখা হয়েছে`, 'info');
  };

  const handleTakeDose = (dose: TodayDoseItem) => {
    setDeferredDoseKeys((prev) => prev.filter((k) => k !== dose.key));
    markDose(dose.medicineId, dose.timeSlot, dose.time, 'taken');
  };

  const canSpeakDose = hasBengaliVoice && settings.voiceReadoutEnabled !== false;

  const handleSpeakDose = (dose: TodayDoseItem) => {
    const text = buildDoseSpeechText({
      timeSlot: dose.timeSlot,
      brandName: dose.brandName,
      dosage: dose.dosage,
      mealTiming: dose.mealTiming,
    });
    speak(text);
  };

  if (settings.easyMode) {
    const emergencyPhone =
      (settings.emergencyContactPhone || activePatient?.emergencyContact || '').trim();
    const cleanEmergencyPhone = emergencyPhone.replace(/[^0-9+]/g, '');

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 gap-5">
          {/* 1. আজকের ওষুধ */}
          <button
            type="button"
            onClick={() => setShowEasyDosesModal(true)}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Pill className="w-9 h-9 text-white" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  আজকের ওষুধ
                </span>
                <span className="block text-base sm:text-lg text-teal-100 mt-1 font-medium">
                  {totalToday === 0
                    ? 'কোনো ওষুধ যোগ করা হয়নি'
                    : pendingDoses.length > 0
                    ? `${toBengaliNumber(pendingDoses.length)}টি ডোজ বাকি আছে`
                    : 'আজকের সব ওষুধ খাওয়া হয়েছে ✓'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-teal-100 shrink-0" />
          </button>

          {/* 2. ওষুধ যোগ */}
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Plus className="w-10 h-10 text-white" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  ওষুধ যোগ
                </span>
                <span className="block text-base sm:text-lg text-emerald-100 mt-1 font-medium">
                  নতুন ওষুধ বা ছবি থেকে যোগ করুন
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-emerald-100 shrink-0" />
          </button>

          {/* 3. জরুরি কল */}
          <button
            type="button"
            onClick={() => setShowEasyEmergencyModal(true)}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <PhoneCall className="w-9 h-9 text-white" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  জরুরি কল
                </span>
                <span className="block text-base sm:text-lg text-rose-100 mt-1 font-medium">
                  পরিবার, ১৬২৬৩ বা ৯৯৯ নম্বরে কল করুন
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-rose-100 shrink-0" />
          </button>
        </div>

        {/* Easy Mode: আজকের ওষুধ Modal */}
        {showEasyDosesModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  আজকের ওষুধ
                </h2>
                <button
                  type="button"
                  onClick={() => setShowEasyDosesModal(false)}
                  aria-label="বন্ধ করুন"
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {todayDoses.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      আজকের কোনো ওষুধ নেই
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEasyDosesModal(false);
                        setCurrentPage('add-medicine');
                      }}
                      className="min-h-[56px] px-7 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-lg rounded-2xl cursor-pointer inline-flex items-center gap-2"
                    >
                      <Plus className="w-6 h-6" />
                      <span>ওষুধ যোগ করুন</span>
                    </button>
                  </div>
                ) : pendingDoses.length === 0 ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-700 dark:text-emerald-400 mx-auto" />
                    <p className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                      আজকের সব ওষুধ খাওয়া হয়েছে ✓
                    </p>
                  </div>
                ) : (
                  pendingDoses.map((dose) => (
                    <div
                      key={dose.key}
                      className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-bold text-teal-800 dark:text-teal-300">
                          {dose.timeSlot} · {formatBengaliTime(dose.time)}
                        </div>
                        {canSpeakDose && (
                          <button
                            type="button"
                            onClick={() => handleSpeakDose(dose)}
                            className="min-h-[48px] px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 font-bold text-base inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Volume2 className="w-5 h-5" />
                            <span>শুনুন</span>
                          </button>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {dose.brandName}
                      </div>
                      <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                        ডোজ: {dose.dosage} · {dose.mealTiming}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTakeDose(dose)}
                        className="min-h-[56px] w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xl rounded-2xl cursor-pointer"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                        <span>খেয়েছি</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Easy Mode: জরুরি কল Modal */}
        {showEasyEmergencyModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  জরুরি কল
                </h2>
                <button
                  type="button"
                  onClick={() => setShowEasyEmergencyModal(false)}
                  aria-label="বন্ধ করুন"
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {cleanEmergencyPhone ? (
                  <a
                    href={`tel:${cleanEmergencyPhone}`}
                    className="min-h-[64px] w-full p-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xl flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-3">
                      <PhoneCall className="w-6 h-6 shrink-0" />
                      <span>
                        {settings.emergencyContactName || 'পরিবারের জরুরি নম্বর'} ({emergencyPhone})
                      </span>
                    </span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEasyEmergencyModal(false);
                      setCurrentPage('settings');
                    }}
                    className="min-h-[56px] w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 font-bold text-lg text-center cursor-pointer"
                  >
                    পরিবারের জরুরি নম্বর সেটিংস থেকে যোগ করুন
                  </button>
                )}

                <a
                  href="tel:16263"
                  className="min-h-[64px] w-full p-4 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xl flex items-center gap-3"
                >
                  <PhoneCall className="w-6 h-6 shrink-0" />
                  <span>স্বাস্থ্য বাতায়ন (১৬২৬৩)</span>
                </a>

                <a
                  href="tel:999"
                  className="min-h-[64px] w-full p-4 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xl flex items-center gap-3"
                >
                  <PhoneCall className="w-6 h-6 shrink-0" />
                  <span>জাতীয় জরুরি সেবা (৯৯৯)</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">

      {/* Compact Top Context Row: Date + Active Patient Switcher + Sync */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {formatBengaliDate(todayStr)}
          </p>
          {activePatient && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {activePatient.name} ({activePatient.relation})
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {patients.length > 1 && activePatient && (
            <select
              value={activePatient.id}
              onChange={(e) => {
                if (e.target.value === '__add_new__') {
                  openCreateProfileModal();
                } else {
                  setActivePatientId(e.target.value);
                }
              }}
              aria-label="সদস্য পরিবর্তন"
              className="min-h-[48px] text-base font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl px-3.5 py-2 focus:outline-hidden cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.relation})
                </option>
              ))}
              <option value="__add_new__">+ নতুন সদস্য</option>
            </select>
          )}

          {currentUser ? (
            <button
              type="button"
              onClick={triggerManualSync}
              disabled={syncStatus === 'syncing' || isSyncing}
              className={`min-h-[48px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                syncStatus === 'synced'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : syncStatus === 'syncing' || isSyncing
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/60'
                  : syncStatus === 'offline'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
              }`}
              title={lastSyncedAt ? `শেষ সিঙ্ক: ${lastSyncedAt}` : 'সিঙ্ক অবস্থা'}
            >
              {syncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>সিঙ্ক করা</span>
                </>
              ) : syncStatus === 'syncing' || isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-400" />
                  <span>সিঙ্ক হচ্ছে</span>
                </>
              ) : syncStatus === 'offline' ? (
                <>
                  <CloudOff className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>অফলাইন</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                  <span>আবার চেষ্টা</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>লগইন করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Native Alarm Permission Alert Banner */}
      {hasMissingPermissions && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">
                ঠিক সময়ে অ্যালার্ম বাজতে এই অনুমতিগুলো দিন
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-amber-900 dark:text-amber-200 font-medium">
                <span className={nativePerms.exactAlarm ? 'text-emerald-800 dark:text-emerald-300 font-semibold' : 'text-rose-700 dark:text-rose-300 font-bold'}>
                  সঠিক সময়ে অ্যালার্ম {nativePerms.exactAlarm ? '✓' : '✕'}
                </span>
                <span>·</span>
                <span className={nativePerms.notifications ? 'text-emerald-800 dark:text-emerald-300 font-semibold' : 'text-rose-700 dark:text-rose-300 font-bold'}>
                  নোটিফিকেশন {nativePerms.notifications ? '✓' : '✕'}
                </span>
                <span>·</span>
                <span className={nativePerms.batteryUnrestricted ? 'text-emerald-800 dark:text-emerald-300 font-semibold' : 'text-rose-700 dark:text-rose-300 font-bold'}>
                  ব্যাটারি সেভার থেকে ছাড় {nativePerms.batteryUnrestricted ? '✓' : '✕'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="min-h-[48px] px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-base rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            অনুমতি ঠিক করুন
          </button>
        </section>
      )}

      {/* Upcoming Doctor Appointments Alert */}
      {urgentAppointments.length > 0 && (
        <section className="bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-teal-700 text-white shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-teal-950 dark:text-teal-100">
                  ডাক্তারের সাথে দেখা ({toBengaliNumber(urgentAppointments.length)}টি)
                </h3>
                <div className="mt-1 space-y-1">
                  {urgentAppointments.map((app) => {
                    const isToday = app.appointmentDate === realTodayStr;
                    return (
                      <p key={app.id} className="text-sm text-teal-900 dark:text-teal-200 font-medium">
                        <strong>{app.doctorName}</strong> — {isToday ? 'আজ' : 'আগামীকাল'} {toBengaliNumber(app.appointmentTime)}
                        {app.location ? ` (${app.location})` : ''}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('appointments')}
              className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              দেখুন
            </button>
          </div>
        </section>
      )}

      {/* Overdue Dose Family Alert */}
      {overdueDoses.length > 0 && (
        <section className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-700 text-white shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-950 dark:text-rose-100">
                  ওষুধ খাওয়ার সময় পার হয়েছে ({toBengaliNumber(overdueDoses.length)}টি)
                </h3>
                <p className="text-sm text-rose-900 dark:text-rose-200 mt-1">
                  <strong>{overdueDoses.map((d) => `${d.brandName} (${toBengaliNumber(d.time)})`).join(', ')}</strong> — নির্ধারিত সময়ের ৩০ মিনিট পার হয়েছে।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => handleNotifyFamily(overdueDoses[0], 'whatsapp')}
                className="min-h-[48px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>পরিবারকে জানান</span>
              </button>
              <button
                type="button"
                onClick={() => handleNotifyFamily(overdueDoses[0], 'sms')}
                className="min-h-[48px] px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <PhoneCall className="w-4 h-4" />
                <span>মেসেজ পাঠান</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          STEP 1 MAIN FOCUS: "এখন খাবেন" / EMPTY / ALL DONE CARD
         ======================================================== */}
      {patientMedicines.length === 0 ? (
        <section className="bg-white dark:bg-slate-900 border-2 border-teal-200 dark:border-teal-800 rounded-2xl p-6 sm:p-10 text-center shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
            <Pill className="w-9 h-9" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {medicines.length === 0
                ? 'আপনার প্রথম ওষুধ যোগ করুন'
                : 'এই সদস্যের কোনো চলমান ওষুধ নেই'}
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              সহজ ৪ ধাপে ওষুধের নাম ও খাওয়ার সময় যোগ করলে ঠিক সময়ে অ্যালার্ম পাবেন।
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="min-h-[56px] inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-lg rounded-2xl shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-6 h-6" />
              <span>ওষুধ যোগ করুন</span>
            </button>

            {patients.length === 0 && (
              <button
                type="button"
                onClick={openCreateProfileModal}
                className="min-h-[56px] inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-base rounded-2xl transition-colors cursor-pointer"
              >
                <UserPlus className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span>সদস্য প্রোফাইল তৈরি করুন</span>
              </button>
            )}
          </div>
        </section>
      ) : todayDoses.length === 0 ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-4">
          <CheckCircle2 className="w-12 h-12 text-teal-700 dark:text-teal-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            আজকের কোনো ওষুধের সময়সূচি নেই
          </h2>
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[52px] inline-flex items-center justify-center gap-2 px-7 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-2xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>ওষুধ যোগ করুন</span>
          </button>
        </section>
      ) : !nextDueDose ? (
        <section className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl p-7 sm:p-9 text-center shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-700 text-white flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-emerald-950 dark:text-emerald-100">
            আজকের সব ওষুধ খাওয়া হয়েছে ✓
          </h1>
          <p className="text-base text-emerald-800 dark:text-emerald-200">
            মোট {toBengaliNumber(totalToday)}টি ডোজের মধ্যে {toBengaliNumber(takenCount)}টি সম্পন্ন হয়েছে।
          </p>
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 border-2 border-teal-500 dark:border-teal-600 rounded-2xl p-5 sm:p-7 shadow-md space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 text-base font-bold text-teal-800 dark:text-teal-300">
              <Clock className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>এখন খাবেন</span>
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {canSpeakDose && (
                <button
                  type="button"
                  onClick={() => handleSpeakDose(nextDueDose)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-teal-800 dark:text-teal-200 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>শুনুন</span>
                </button>
              )}
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                {nextDueDose.timeSlot} · {formatBengaliTime(nextDueDose.time)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug">
              {nextDueDose.brandName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-lg font-semibold text-slate-700 dark:text-slate-200">
              <span>ডোজ: {nextDueDose.dosage}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{nextDueDose.mealTiming}</span>
            </div>
            {deferredDoseKeys.includes(nextDueDose.key) && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                পরে খাওয়ার জন্য রাখা হয়েছিল
              </p>
            )}
          </div>

          {/* Big Primary Green "খেয়েছি" and Neutral Gray "পরে" Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleTakeDose(nextDueDose)}
              className="sm:col-span-2 min-h-[56px] w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xl rounded-2xl shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>খেয়েছি</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeferDose(nextDueDose)}
              className="min-h-[56px] w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-lg rounded-2xl transition-colors cursor-pointer"
            >
              <Clock className="w-5 h-5" />
              <span>পরে</span>
            </button>
          </div>
        </section>
      )}

      {/* ========================================================
          TODAY'S REMAINING DOSES IN CHRONOLOGICAL ORDER
         ======================================================== */}
      {todayDoses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              আজকের বাকি ডোজ ({toBengaliNumber(remainingListDoses.length)}টি)
            </h2>
            {takenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowTakenDoses((v) => !v)}
                className="min-h-[48px] px-3.5 py-2 text-sm font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl transition-colors cursor-pointer"
              >
                {showTakenDoses
                  ? 'খাওয়া শেষ ডোজ লুকান'
                  : `খাওয়া হয়েছে (${toBengaliNumber(takenCount)}টি)`}
              </button>
            )}
          </div>

          {remainingListDoses.length === 0 && !showTakenDoses ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center text-base text-slate-600 dark:text-slate-300">
              {nextDueDose
                ? 'এই মুহূর্তে উপরের ডোজটি ছাড়া আর কোনো বাকি ডোজ নেই।'
                : 'আজকের সব ওষুধ খাওয়া শেষ হয়েছে।'}
            </div>
          ) : (
            <div className="space-y-3">
              {remainingListDoses.map((dose) => {
                const isSkipped = dose.logStatus === 'skipped';
                const isDeferred = deferredDoseKeys.includes(dose.key);

                return (
                  <div
                    key={dose.key}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs ${
                      isSkipped ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg">
                          {dose.timeSlot} · {formatBengaliTime(dose.time)}
                        </span>
                        {isDeferred && (
                          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg">
                            পরে খাবেন
                          </span>
                        )}
                        {isSkipped && (
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                            বাদ দেওয়া
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                        {dose.brandName}
                      </h3>

                      <p className="text-base text-slate-600 dark:text-slate-300">
                        ডোজ: <strong className="text-slate-900 dark:text-white">{dose.dosage}</strong> · {dose.mealTiming}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {canSpeakDose && (
                        <button
                          type="button"
                          onClick={() => handleSpeakDose(dose)}
                          className="min-h-[48px] px-4 py-2.5 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-teal-800 dark:text-teal-200 font-bold text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>শুনুন</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTakeDose(dose)}
                        className="min-h-[48px] px-6 py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>খেয়েছি</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {showTakenDoses &&
                takenDoses.map((dose) => (
                  <div
                    key={`taken-${dose.key}`}
                    className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {dose.brandName}
                        </span>
                      </div>
                      <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
                        {dose.timeSlot} ({formatBengaliTime(dose.time)}) · {dose.dosage} · খাওয়া হয়েছে
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'skipped', 'পূর্বাবস্থায় ফেরানো')}
                      className="min-h-[48px] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                    >
                      ফিরিয়ে আনুন
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          COLLAPSIBLE "আরও দেখুন" FOLD FOR SECONDARY WIDGETS
         ======================================================== */}
      <section className="pt-2">
        <button
          type="button"
          onClick={() => setShowMoreWidgets((prev) => !prev)}
          aria-expanded={showMoreWidgets}
          className="min-h-[52px] w-full flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl text-base font-bold text-slate-900 dark:text-white shadow-2xs transition-colors cursor-pointer"
        >
          <span>{showMoreWidgets ? 'কম দেখুন' : 'আরও দেখুন (পরিবার, মজুত, চার্ট ও জরুরি তথ্য)'}</span>
          {showMoreWidgets ? (
            <ChevronUp className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          )}
        </button>

        {showMoreWidgets && (
          <div className="mt-5 space-y-6">
            {/* Active Patient Progress & Quick Tools */}
            {activePatient && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={activePatient.avatarUrl || '/src/assets/images/avatar_patient_bengali_1793655801544.jpg'}
                      alt={activePatient.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border-2 border-teal-600/30"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {activePatient.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => openEditProfileModal(activePatient)}
                          className="p-2 text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="প্রোফাইল সম্পাদনা"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {activePatient.relation} · {toBengaliNumber(activePatient.age)} বছর · রক্ত: {activePatient.bloodGroup}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage('checklist')}
                      className="min-h-[48px] px-4 py-2 text-sm font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ListChecks className="w-4 h-4" />
                      <span>দৈনিক চেকলিস্ট</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('reminders')}
                      className="min-h-[48px] px-4 py-2 text-sm font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                      <span>সব রিমাইন্ডার</span>
                    </button>
                  </div>
                </div>

                {/* Adherence Progress Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    <span>আজকের ওষুধ খাওয়ার অগ্রগতি</span>
                    <span className="tabular-nums text-teal-700 dark:text-teal-400">
                      {toBengaliNumber(adherencePercent)}% ({toBengaliNumber(takenCount)}/{toBengaliNumber(totalToday)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${adherencePercent}%` }}
                    />
                  </div>
                </div>

                {/* Cloud Backup Summary */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm">
                  {currentUser ? (
                    <>
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Cloud className="w-4 h-4 text-emerald-600" />
                        <span>ক্লাউড ব্যাকআপ চালু ({currentUser.displayName || currentUser.email})</span>
                      </div>
                      <button
                        type="button"
                        onClick={syncLocalToCloud}
                        disabled={isSyncing}
                        className="min-h-[48px] px-4 py-2 text-sm font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>এখনই সিঙ্ক করুন</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600 dark:text-slate-300">
                        তথ্য সুরক্ষিত রাখতে লগইন করুন
                      </span>
                      <button
                        type="button"
                        onClick={openAuthModal}
                        className="min-h-[48px] px-4 py-2 text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock className="w-4 h-4" />
                        <span>লগইন বা রেজিস্টার</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Action Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage('library')}
                className="min-h-[52px] px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl text-base font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span>ওষুধ লাইব্রেরি</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('health-records')}
                className="min-h-[52px] px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl text-base font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <HeartPulse className="w-5 h-5 text-rose-600" />
                <span>স্বাস্থ্য রেকর্ড</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('history')}
                className="min-h-[52px] px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl text-base font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span>ডাক্তারকে দেখানোর ইতিহাস</span>
              </button>
            </div>

            {/* Family Care Summary */}
            <FamilyCareSummary />

            {/* Stock Predictor & Low Stock Summary */}
            <ExpiringStockSection />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ওষুধের মজুত সতর্কতা ({toBengaliNumber(lowStockMedicines.length)}টি কম)
                  </h3>
                </div>
              </div>

              {lowStockMedicines.length === 0 ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>সব ওষুধের পর্যাপ্ত মজুত আছে</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lowStockMedicines.map((med) => (
                    <div
                      key={med.id}
                      className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {med.brandName}
                        </div>
                        <div className="text-sm text-amber-900 dark:text-amber-300">
                          বাকি: {toBengaliNumber(med.stock)} {med.unit}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openStockAdjustmentModal(med.id)}
                        className="min-h-[48px] px-4 py-2 text-sm font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 rounded-xl cursor-pointer shrink-0"
                      >
                        আপডেট
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsBuyListOpen(true)}
                  className="min-h-[48px] py-2.5 px-4 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>কিনতে হবে তালিকা</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage('medicines')}
                  className="min-h-[48px] py-2.5 px-4 text-sm font-semibold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>সব ওষুধ দেখুন</span>
                </button>
              </div>
            </div>

            {/* Adherence Analytics */}
            <AdherenceAnalytics />

            {/* Emergency Card */}
            <EmergencyCard />
          </div>
        )}
      </section>

      {/* Low Stock Shopping & Refill Modal */}
      <BuyListModal
        isOpen={isBuyListOpen}
        onClose={() => setIsBuyListOpen(false)}
      />

    </div>
  );
};
