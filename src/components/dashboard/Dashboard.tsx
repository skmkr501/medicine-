import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { TimeSlot } from '../../types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  CalendarCheck,
  ChevronRight,
  HeartPulse,
  Cloud,
  RefreshCw,
  Lock,
  UserPlus,
  Edit2,
  ShoppingCart,
  Sparkles,
  Calendar,
  Bell,
  PhoneCall,
  Share2,
  Activity,
  Stethoscope,
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

export const Dashboard: React.FC = () => {
  const [isBuyListOpen, setIsBuyListOpen] = useState(false);
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
    adjustStock,
    openStockAdjustmentModal,
    setSelectedMedicineIdForDetail,
    currentUser,
    openAuthModal,
    syncLocalToCloud,
    isSyncing,
    isCloudConnected,
    openCreateProfileModal,
    openEditProfileModal,
    appointments,
    settings,
  } = useMedicine();

  const isBn = settings.language !== 'en';
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
    const patientName = activePatient?.name || (isBn ? 'সদস্য' : 'Member');
    const contactPhone = settings.emergencyContactPhone || '';

    const message = isBn
      ? `জরুরি স্বাস্থ্যবার্তা: ${patientName}-এর "${dose.brandName}" (${dose.dosage}) নির্ধারিত সময় (${dose.time})-এর ডোজ ৩০ মিনিটের বেশি পার হলেও এখনও গ্রহণ করা হয়নি। অনুগ্রহ করে খোঁজ নিন। - স্বাস্থ্যবন্ধু`
      : `Health Alert: ${patientName}'s dose of "${dose.brandName}" (${dose.dosage}) scheduled for ${dose.time} is over 30 minutes overdue. Please check in. - Shasthobondhu`;

    if (!contactPhone) {
      if (confirm(isBn
        ? 'সেটিংস-এ পরিবারের জরুরি যোগাযোগের ফোন নম্বর যোগ করা নেই। আপনি কি সেটিংস পৃষ্ঠায় যেতে চান?'
        : 'No family emergency contact number set in Settings. Would you like to go to Settings?')) {
        setCurrentPage('settings');
      }
      return;
    }

    const cleanPhone = contactPhone.replace(/[^0-9+]/g, '');
    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
    } else {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    }
  };

  // Filter medicines for current active patient strictly (Requirement 3 & 5)
  const patientMedicines = activePatient
    ? medicines.filter(
        (m) => m.assignedPatientId === activePatient.id && m.status === 'active'
      )
    : medicines.filter((m) => m.status === 'active');

  // Compile today's schedule items from patient medicines
  interface TodayDoseItem {
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

  const todayDoses: TodayDoseItem[] = [];

  patientMedicines.forEach((med) => {
    med.schedules.forEach((sch) => {
      const log = doseLogs.find(
        (l) =>
          l.medicineId === med.id &&
          l.scheduledDate === todayStr &&
          l.timeSlot === sch.timeSlot
      );
      const overdue = !log?.status && isDoseOverdueBy30Min(sch.time);

      todayDoses.push({
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

  // Sort today's doses by timeSlot order
  const slotOrder: Record<TimeSlot, number> = {
    'সকাল': 1,
    'দুপুর': 2,
    'সন্ধ্যা': 3,
    'রাত': 4,
  };
  todayDoses.sort((a, b) => slotOrder[a.timeSlot] - slotOrder[b.timeSlot]);

  const totalToday = todayDoses.length;
  const takenCount = todayDoses.filter((d) => d.logStatus === 'taken').length;
  const remainingCount = totalToday - takenCount;
  const adherencePercent = totalToday > 0 ? Math.round((takenCount / totalToday) * 100) : 0;
  const overdueDoses = todayDoses.filter((d) => d.logStatus !== 'taken' && d.isOverdue);

  // Low stock medicines
  const lowStockMedicines = patientMedicines.filter((m) => m.stock <= m.minStockAlert);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Doctor Appointment Reminder Alert (Step 2: আগের দিন ও দিনের শুরুতে ড্যাশবোর্ডে সতর্কতা) */}
      {urgentAppointments.length > 0 && (
        <section className="bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-teal-600 text-white shrink-0 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-teal-950 dark:text-teal-100">
                    {isBn ? 'আসন্ন ডাক্তারের অ্যাপয়েন্টমেন্ট সতর্কতা' : 'Upcoming Doctor Appointment Alert'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-200 dark:bg-teal-900 text-teal-900 dark:text-teal-200">
                    {urgentAppointments.length}টি সাক্ষাৎ
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {urgentAppointments.map((app) => {
                    const isToday = app.appointmentDate === realTodayStr;
                    return (
                      <p key={app.id} className="text-xs text-teal-800 dark:text-teal-200 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                        <span>
                          <strong>{app.doctorName}</strong> ({app.specialty || (isBn ? 'ডাক্তার' : 'Doctor')}) — {isToday ? (isBn ? 'আজ' : 'Today') : (isBn ? 'আগামীকাল' : 'Tomorrow')} {app.appointmentTime}
                          {app.location && ` [${app.location}]`}
                        </span>
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('appointments')}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 self-start sm:self-center cursor-pointer"
            >
              {isBn ? 'অ্যাপয়েন্টমেন্ট দেখুন' : 'View Appointments'}
            </button>
          </div>
        </section>
      )}

      {/* Missed Dose Family Notification Alert (Step 4: ৩০ মিনিট পার হলেও Taken না হলে পরিবারকে জানান) */}
      {overdueDoses.length > 0 && (
        <section className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 sm:p-5 shadow-xs animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 dark:text-rose-100 flex items-center gap-2">
                  <span>{isBn ? 'ওষুধ সেবনের সময় পার হয়ে গেছে (বিলম্বিত ডোজ)' : 'Overdue Dose Warning'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                    {toBengaliNumber(overdueDoses.length)}টি ডোজ বাকি
                  </span>
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-300 mt-1">
                  <strong>{overdueDoses.map((d) => `${d.brandName} (${d.time})`).join(', ')}</strong> {isBn ? 'নির্ধারিত সময় পেরিয়ে ৩০ মিনিটের বেশি হয়েছে কিন্তু এখনো খাওয়া হয়নি।' : 'scheduled time is past 30 minutes and not taken yet.'}
                </p>
                {settings.emergencyContactName && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                    {isBn ? 'জরুরি পারিবারিক যোগাযোগ:' : 'Emergency Family Contact:'} {settings.emergencyContactName} ({settings.emergencyContactPhone || 'নম্বর নেই'})
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => handleNotifyFamily(overdueDoses[0], 'whatsapp')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'পরিবারকে জানান (WhatsApp)' : 'Alert Family (WhatsApp)'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleNotifyFamily(overdueDoses[0], 'sms')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{isBn ? 'SMS পাঠান' : 'Send SMS'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Native Alarm Permission Alert Banner (Requirement 4: পারমিশন বন্ধ থাকলে ড্যাশবোর্ডে সতর্কতা) */}
      {hasMissingPermissions && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                ফোন অ্যালার্মের কিছু পারমিশন বন্ধ রয়েছে
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                অ্যান্ড্রয়েড ফোনে স্ক্রিন বন্ধ বা স্লিপ মোডেও সঠিক সময়ে ওষুধের অ্যালার্ম বাজার জন্য Exact Alarm, Notifications ও Battery পারমিশন নিশ্চিত করা প্রয়োজন।
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                <span className="text-slate-500 dark:text-slate-400">বর্তমান অবস্থা:</span>
                <span className={nativePerms.exactAlarm ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                  অ্যালার্ম {nativePerms.exactAlarm ? '✓ সক্রিয়' : '✕ বন্ধ'}
                </span>
                <span>·</span>
                <span className={nativePerms.notifications ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                  নোটিফিকেশন {nativePerms.notifications ? '✓ সক্রিয়' : '✕ বন্ধ'}
                </span>
                <span>·</span>
                <span className={nativePerms.batteryUnrestricted ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                  ব্যাটারি {nativePerms.batteryUnrestricted ? '✓ সক্রিয়' : '✕ সীমাবদ্ধ'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 self-start sm:self-center cursor-pointer"
          >
            অনুমতি ঠিক করুন
          </button>
        </section>
      )}
      {!activePatient ? (
        <section className="bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/70 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto mb-4 shadow-2xs">
            <UserPlus className="w-8 h-8" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            স্বাস্থ্যবন্ধুতে স্বাগতম! এখনও কোনো প্রোফাইল তৈরি করা হয়নি
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto mt-2 mb-6 leading-relaxed">
            আপনার নিজের বা পরিবারের সদস্যদের (যেমন: বাবা, মা, সন্তান) ওষুধ ও প্রেসক্রিপশন সুশৃঙ্খলভাবে ট্র্যাক করতে প্রথমে একটি রোগীর প্রোফাইল তৈরি করুন। আপনি প্রয়োজনমতো আনলিমিটেড প্রোফাইল তৈরি ও পরিচালনা করতে পারবেন।
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>নতুন প্রোফাইল তৈরি করুন</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('add-medicine')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ওষুধ যুক্ত করুন (প্রোফাইল ছাড়া)</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 transition-colors shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={activePatient.avatarUrl || '/src/assets/images/avatar_patient_bengali_1793655801544.jpg'}
                  alt={activePatient.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-teal-600/30 shadow-xs"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-teal-600 border-2 border-white dark:border-slate-900" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {activePatient.name}
                  </h1>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {activePatient.relation} · {toBengaliNumber(activePatient.age)} বছর · রক্ত: {activePatient.bloodGroup}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditProfileModal(activePatient)}
                    className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="প্রোফাইল সম্পাদনা করুন"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {formatBengaliDate(todayStr)} · আজ নির্ধারিত মোট {toBengaliNumber(totalToday)}টি ডোজ রয়েছে
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400">রোগী পরিবর্তন</div>
                <select
                  value={activePatient.id}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      openCreateProfileModal();
                    } else {
                      setActivePatientId(e.target.value);
                    }
                  }}
                  aria-label="রোগী নির্বাচন"
                  className="text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-md px-3 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relation})
                    </option>
                  ))}
                  <option value="__add_new__">+ নতুন প্রোফাইল তৈরি করুন</option>
                </select>
              </div>

              <button
                type="button"
                onClick={openCreateProfileModal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer"
                title="নতুন সদস্য যোগ করুন"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">নতুন প্রোফাইল</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('add-medicine')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন ওষুধ</span>
              </button>
            </div>
          </div>

        {/* Adherence Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          <div className="sm:col-span-3">
            <div className="flex justify-between items-center text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              <span>আজকের ওষুধ সেবনের অগ্রগতি</span>
              <span className="tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                {toBengaliNumber(adherencePercent)}% সম্পন্ন ({toBengaliNumber(takenCount)}/{toBengaliNumber(totalToday)})
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-teal-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${adherencePercent}%` }}
              />
            </div>
          </div>
          <div className="flex justify-around sm:justify-end gap-6 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="block text-slate-400 text-[11px]">বাকি ডোজ</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {toBengaliNumber(remainingCount)}টি
              </span>
            </div>
            <div>
              <span className="block text-slate-400 text-[11px]">চলমান ওষুধ</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {toBengaliNumber(patientMedicines.length)}টি
              </span>
            </div>
          </div>
        </div>

        {/* Cloud Sync Status Strip */}
        {currentUser ? (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                ক্লাউড ফায়ারবেস স্টোরেজ সক্রিয়:
              </span>
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-sm">
                {currentUser.displayName || currentUser.email} এর সমস্ত ডেটা ক্লাউডে সুরক্ষিত ও ব্যক্তিগত
              </span>
            </div>
            <button
              type="button"
              onClick={syncLocalToCloud}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-md hover:bg-teal-100 cursor-pointer self-start sm:self-auto disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই সিঙ্ক করুন'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-start sm:items-center gap-2.5">
              <Cloud className="w-4 h-4 text-teal-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block sm:inline mr-1">
                  ক্লাউড ফায়ারবেস স্টোরেজ:
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  আপনার প্রেসক্রিপশন ও ওষুধের ইতিহাস নিরাপদ ক্লাউডে সেভ রাখতে লগইন করুন (বর্তমান ডেটা সুরক্ষিত থাকবে)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md shadow-2xs cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>লগইন বা রেজিস্টার</span>
            </button>
          </div>
        )}
      </section>
      )}

      {/* Family Care Summary Section */}
      <FamilyCareSummary />

      {/* Smart Medicine Stock Predictor Section */}
      <ExpiringStockSection />

      {/* Adherence & Streak Analytics */}
      <AdherenceAnalytics />

      {/* Main Grid: Schedule on left (2 cols), Refill Alerts & Tips on right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Schedule Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                আজকের ওষুধের সময়সূচি
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                সময় অনুযায়ী আপনার প্রেসক্রিপশন ডোজ গ্রহণ বা আপডেট করুন
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage('reminders')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>সকল রিমাইন্ডার</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayDoses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
              <CalendarCheck className="w-10 h-10 text-teal-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                আজ কোনো ওষুধের শিডিউল নেই
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                নতুন প্রেসক্রিপশন যোগ করতে নিচে ক্লিক করুন।
              </p>
              <button
                type="button"
                onClick={() => setCurrentPage('add-medicine')}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-medium rounded-lg hover:bg-teal-800 cursor-pointer"
              >
                ওষুধ যোগ করুন
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayDoses.map((dose, idx) => {
                const isTaken = dose.logStatus === 'taken';
                const isSkipped = dose.logStatus === 'skipped';

                return (
                  <div
                    key={`${dose.medicineId}-${dose.timeSlot}-${idx}`}
                    className={`bg-white dark:bg-slate-900 border rounded-xl p-4 transition-all duration-200 ${
                      isTaken
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                        : isSkipped
                        ? 'border-slate-200 dark:border-slate-800 opacity-70'
                        : 'border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isTaken
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                          }`}
                        >
                          {isTaken ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-base">
                              {dose.brandName}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              · {dose.type}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {dose.genericName}
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                            <span className="font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded">
                              {dose.timeSlot} ({toBengaliNumber(dose.time)})
                            </span>
                            <span>ডোজ: {dose.dosage}</span>
                            <span className="text-slate-400">·</span>
                            <span>{dose.mealTiming}</span>
                            {dose.isOverdue && !isTaken && !isSkipped && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                {isBn ? '৩০+ মি. বিলম্বিত' : '30+m Overdue'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                        {dose.isOverdue && !isTaken && !isSkipped && (
                          <button
                            type="button"
                            onClick={() => handleNotifyFamily(dose, 'whatsapp')}
                            className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-1 cursor-pointer transition"
                            title={isBn ? 'পরিবারকে সতর্কবার্তা পাঠান' : 'Notify family contact'}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{isBn ? 'পরিবারকে জানান' : 'Alert Family'}</span>
                          </button>
                        )}
                        {isTaken ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              গৃহীত সম্পন্ন
                            </span>
                            <button
                              type="button"
                              onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'skipped', 'পূর্বাবস্থায় ফেরানো')}
                              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                            >
                              পরিবর্তন
                            </button>
                          </div>
                        ) : isSkipped ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                              বাদ দেওয়া হয়েছে
                            </span>
                            <button
                              type="button"
                              onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'taken')}
                              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                            >
                              গ্রহণ করেছি
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'taken')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              গ্রহণ করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'skipped', 'ব্যবহারকারী বাদ দিয়েছেন')}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              বাদ দিন
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Banner visual */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 mt-6 shadow-xs">
            <img
              src="/src/assets/images/shasthobondhu_hero_1793655800567.jpg"
              alt="স্বাস্থ্যবন্ধু ওষুধ ব্যবস্থাপনা"
              referrerPolicy="no-referrer"
              className="w-full h-44 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent flex flex-col justify-end p-5 text-white">
              <span className="text-[11px] font-semibold text-teal-300">নিয়মিত ওষুধ · সুস্থ জীবন</span>
              <h3 className="text-base sm:text-lg font-bold">সময়মতো সঠিক ওষুধ সেবনে রোগের জটিলতা ৭০% কমে</h3>
              <p className="text-xs text-slate-200 mt-0.5">স্বাস্থ্যবন্ধু অ্যাপে প্রতিদিনের ডোজ চেক করুন এবং প্রেসক্রিপশন আপডেট রাখুন।</p>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Low Stock Alerts & Wellness info */}
        <div className="space-y-6">
          
          {/* Low Stock Alerts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  মজুত ও রিফিল সতর্কতা
                </h3>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {toBengaliNumber(lowStockMedicines.length)}টি কম
              </span>
            </div>

            {lowStockMedicines.length === 0 ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                  সকল ওষুধের পর্যাপ্ত মজুত রয়েছে
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  কমপক্ষে ৭ দিনের ডোজ নিশ্চিত আছে
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockMedicines.map((med) => (
                  <div
                    key={med.id}
                    className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {med.brandName}
                      </div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        অবশিষ্ট: {toBengaliNumber(med.stock)} {med.unit} (সতর্কবার্তা সীমা: {toBengaliNumber(med.minStockAlert)})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openStockAdjustmentModal(med.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-md transition-colors cursor-pointer shrink-0"
                    >
                      আপডেট
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsBuyListOpen(true)}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>কিনতে হবে তালিকা</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('medicines')}
                className="w-full py-2 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-center border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-1"
              >
                <Package className="w-3.5 h-3.5" />
                <span>স্টক বিস্তারিত</span>
              </button>
            </div>
          </div>

          {/* Emergency Contact Card (Requirement 3: জরুরি যোগাযোগ কার্ড) */}
          <EmergencyCard />

          {/* Quick Doctor / Patient Notes Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                স্বাস্থ্য নির্দেশিকা
              </h3>
            </div>
            
            <div className="text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">গ্যাস্ট্রিকের ওষুধ সেবনের নিয়ম:</span>
                সেক্লো বা ওমেপ্রাজল জাতীয় ওষুধ সকালের নাস্তার অন্তত ৩০ মিনিট পূর্বে সেবন করুন।
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">ইনসুলিন সতর্কতা:</span>
                ইনসুলিন নেওয়ার আগে প্রতিবার স্থান পরিবর্তন (রোটেশন) করুন এবং হাইপোগ্লাইসেমিয়ার জন্য মিষ্টি সাথে রাখুন।
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">জরুরি হেল্পলাইন:</span>
              <a
                href="tel:16263"
                className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                ১৬২৬৩ (স্বাস্থ্য বাতায়ন)
              </a>
            </div>
          </div>

          {/* Quick Navigation to History / Doctor Report */}
          <div
            onClick={() => setCurrentPage('history')}
            className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-xl p-4 cursor-pointer hover:border-teal-400 transition-colors flex items-center justify-between"
          >
            <div>
              <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200">
                ডাক্তারকে দেখানোর সারাংশ
              </h4>
              <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-0.5">
                গত ৭ বা ৩০ দিনের ওষুধের সেবন রেকর্ড প্রিন্ট বা এক্সপোর্ট করুন
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
          </div>

        </div>

      </div>

      {/* Low Stock Shopping & Refill Modal */}
      <BuyListModal
        isOpen={isBuyListOpen}
        onClose={() => setIsBuyListOpen(false)}
      />

    </div>
  );
};
