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
  Square,
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
import {
  buildDoseSpeechText,
  buildDoseTakenSpeechText,
  useBengaliSpeech,
} from '../../utils/speechUtils';
import { CaregiverAlertBanners, CaregiverFamilyCard } from '../caregiver/CaregiverHomeSection';
import { PatientSuggestionsSection } from '../caregiver/PatientSuggestionsSection';
import { TimeGroupedMedicinesSection } from './TimeGroupedMedicinesSection';
import { MedicineBadgeIcon } from '../medicines/MedicineBadgeIcon';
import { normalizeHomeLayout } from '../../utils/homeLayout';
import { HomeLayoutCardId } from '../../types';
import { Megaphone, LayoutGrid } from 'lucide-react';

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
  const [speakingDoseKey, setSpeakingDoseKey] = useState<string | null>(null);

  const { hasBengaliVoice, isSpeaking, voiceSettings, speak, stop } = useBengaliSpeech();
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
    pendingSyncCount,
    lastSyncedAt,
    isSyncing,
    openCreateProfileModal,
    openEditProfileModal,
    appointments,
    settings,
    showToast,
    realtimeStatus,
    activeAnnouncement,
    dismissActiveAnnouncement,
  } = useMedicine();

  const medicineById = useMemo(() => {
    const map = new Map<string, (typeof medicines)[number]>();
    medicines.forEach((m) => map.set(m.id, m));
    return map;
  }, [medicines]);

  const normalizedHomeLayout = useMemo(
    () => normalizeHomeLayout(settings.homeLayout),
    [settings.homeLayout]
  );

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
    if (hasBengaliVoice && voiceSettings.enabled && voiceSettings.confirmOnDoseTaken) {
      const confirmText = buildDoseTakenSpeechText({
        patientName: activePatient?.name,
        brandName: dose.brandName,
      });
      setSpeakingDoseKey(null);
      speak(confirmText);
    }
  };

  const canSpeakDose = hasBengaliVoice && voiceSettings.enabled;

  const handleSpeakDose = (dose: TodayDoseItem) => {
    if (isSpeaking && speakingDoseKey === dose.key) {
      stop();
      setSpeakingDoseKey(null);
      return;
    }
    const text = buildDoseSpeechText({
      patientName: activePatient?.name,
      timeSlot: dose.timeSlot,
      brandName: dose.brandName,
      dosage: dose.dosage,
      type: dose.type,
      mealTiming: dose.mealTiming,
    });
    setSpeakingDoseKey(dose.key);
    speak(text, {
      onEnd: () => setSpeakingDoseKey((curr) => (curr === dose.key ? null : curr)),
    });
  };

  if (settings.easyMode) {
    const emergencyPhone =
      (settings.emergencyContactPhone || activePatient?.emergencyContact || '').trim();
    const cleanEmergencyPhone = emergencyPhone.replace(/[^0-9+]/g, '');

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {currentUser && (
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-sm font-semibold text-text-muted">
              {activePatient ? `${activePatient.name} (${activePatient.relation})` : 'স্বাস্থ্যবন্ধু'}
            </span>
            <span
              role="status"
              aria-label={realtimeStatus === 'connected' ? 'লাইভ সংযুক্ত' : 'লাইভ সংযুক্ত নয়'}
              title={realtimeStatus === 'connected' ? 'তাৎক্ষণিক লাইভ সিঙ্ক চালু আছে' : 'লাইভ সিঙ্ক সংযুক্ত নয়'}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border border-border bg-surface text-text"
            >
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              <span>লাইভ</span>
            </span>
          </div>
        )}
        <CaregiverAlertBanners />
        <PatientSuggestionsSection />
        <div className="grid grid-cols-1 gap-5">
          {/* 1. আজকের ওষুধ */}
          <button
            type="button"
            onClick={() => setShowEasyDosesModal(true)}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-primary hover:bg-primary-hover text-on-primary shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Pill className="w-9 h-9" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  আজকের ওষুধ
                </span>
                <span className="block text-base sm:text-lg opacity-90 mt-1 font-medium">
                  {totalToday === 0
                    ? 'কোনো ওষুধ যোগ করা হয়নি'
                    : pendingDoses.length > 0
                    ? `${toBengaliNumber(pendingDoses.length)}টি ডোজ বাকি আছে`
                    : 'আজকের সব ওষুধ খাওয়া হয়েছে ✓'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 opacity-90 shrink-0" />
          </button>

          {/* 2. ওষুধ যোগ */}
          <button
            type="button"
            onClick={() => setCurrentPage('add-medicine')}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-[#15803D] hover:bg-[#166534] text-white shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Plus className="w-10 h-10 text-white" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  ওষুধ যোগ
                </span>
                <span className="block text-base sm:text-lg text-white/90 mt-1 font-medium">
                  নতুন ওষুধ বা ছবি থেকে যোগ করুন
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-white/90 shrink-0" />
          </button>

          {/* 3. জরুরি কল */}
          <button
            type="button"
            onClick={() => setShowEasyEmergencyModal(true)}
            className="min-h-[120px] w-full p-6 rounded-3xl bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-md flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <PhoneCall className="w-9 h-9 text-white" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-bold leading-tight">
                  জরুরি কল
                </span>
                <span className="block text-base sm:text-lg text-white/90 mt-1 font-medium">
                  পরিবার, ১৬২৬৩ বা ৯৯৯ নম্বরে কল করুন
                </span>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-white/90 shrink-0" />
          </button>
        </div>

        <CaregiverFamilyCard />

        {/* Easy Mode: আজকের ওষুধ Modal */}
        {showEasyDosesModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-text">
                  আজকের ওষুধ
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    stop();
                    setSpeakingDoseKey(null);
                    setShowEasyDosesModal(false);
                  }}
                  aria-label="বন্ধ করুন"
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-2 text-text cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {todayDoses.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-xl font-bold text-text">
                      আজকের কোনো ওষুধ নেই
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEasyDosesModal(false);
                        setCurrentPage('add-medicine');
                      }}
                      className="min-h-[56px] px-7 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-lg rounded-2xl cursor-pointer inline-flex items-center gap-2"
                    >
                      <Plus className="w-6 h-6" />
                      <span>ওষুধ যোগ করুন</span>
                    </button>
                  </div>
                ) : pendingDoses.length === 0 ? (
                  <div className="bg-success-soft border border-success/30 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-success-text mx-auto" />
                    <p className="text-2xl font-bold text-success-text">
                      আজকের সব ওষুধ খাওয়া হয়েছে ✓
                    </p>
                  </div>
                ) : (
                  pendingDoses.map((dose) => (
                    <div
                      key={dose.key}
                      className="p-5 rounded-2xl border-2 border-border bg-surface-2/70 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-bold text-primary">
                          {dose.timeSlot} · {formatBengaliTime(dose.time)}
                        </div>
                        {canSpeakDose && (
                          <button
                            type="button"
                            onClick={() => handleSpeakDose(dose)}
                            className="min-h-[48px] px-4 py-2 rounded-xl bg-primary-soft border border-primary/25 text-primary font-bold text-base inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {isSpeaking && speakingDoseKey === dose.key ? (
                              <>
                                <Square className="w-4 h-4 fill-current" />
                                <span>থামুন</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-5 h-5" />
                                <span>🔊 শুনুন</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-text">
                        {dose.brandName}
                      </div>
                      <div className="text-lg font-semibold text-text-muted">
                        ডোজ: {dose.dosage} · {dose.mealTiming}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTakeDose(dose)}
                        className="min-h-[56px] w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xl rounded-2xl cursor-pointer"
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
            <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-danger-text">
                  জরুরি কল
                </h2>
                <button
                  type="button"
                  onClick={() => setShowEasyEmergencyModal(false)}
                  aria-label="বন্ধ করুন"
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-2 text-text cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {cleanEmergencyPhone ? (
                  <a
                    href={`tel:${cleanEmergencyPhone}`}
                    className="min-h-[64px] w-full p-4 rounded-2xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xl flex items-center justify-between gap-3"
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
                    className="min-h-[56px] w-full p-4 rounded-2xl bg-warning-soft border border-warning/40 text-warning-text font-bold text-lg text-center cursor-pointer"
                  >
                    পরিবারের জরুরি নম্বর সেটিংস থেকে যোগ করুন
                  </button>
                )}

                <a
                  href="tel:16263"
                  className="min-h-[64px] w-full p-4 rounded-2xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-xl flex items-center gap-3"
                >
                  <PhoneCall className="w-6 h-6 shrink-0" />
                  <span>স্বাস্থ্য বাতায়ন (১৬২৬৩)</span>
                </a>

                <a
                  href="tel:999"
                  className="min-h-[64px] w-full p-4 rounded-2xl bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xl flex items-center gap-3"
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

      {/* Announcement Banner (Plain text only, dismissible per device) */}
      {activeAnnouncement && (
        <section
          role="region"
          aria-label="অ্যাডমিন ঘোষণা"
          className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
            activeAnnouncement.level === 'warning'
              ? 'bg-warning-soft border-warning/40 text-warning-text'
              : activeAnnouncement.level === 'success'
              ? 'bg-success-soft border-success/40 text-success-text'
              : 'bg-primary-soft border-primary/30 text-text'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <Megaphone className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-bold text-text">
                {activeAnnouncement.title}
              </h3>
              <p className="text-sm text-text-muted whitespace-pre-line">
                {activeAnnouncement.body}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissActiveAnnouncement(activeAnnouncement.id)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-surface border border-border text-text text-sm font-bold hover:bg-surface-2 transition-colors shrink-0 cursor-pointer"
          >
            বুঝেছি
          </button>
        </section>
      )}

      {/* Unseen Caregiver Alert Banner & Patient Offline Alert Fallback */}
      <CaregiverAlertBanners />
      {/* Pending Caregiver Medicine Suggestions (only visible when pending items exist) */}
      <PatientSuggestionsSection />

      {/* Compact Top Context Row: Date + Active Patient Switcher + Sync */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-text">
            {formatBengaliDate(todayStr)}
          </p>
          {activePatient && (
            <p className="text-sm text-text-muted mt-0.5">
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
              className="min-h-[48px] text-base font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl px-3.5 py-2 focus:outline-hidden cursor-pointer"
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
            <div className="flex items-center gap-2">
              <span
                role="status"
                aria-label={realtimeStatus === 'connected' ? 'লাইভ সংযুক্ত' : 'লাইভ সংযুক্ত নয়'}
                title={
                  realtimeStatus === 'connected'
                    ? 'তাৎক্ষণিক লাইভ সিঙ্ক চালু আছে'
                    : 'লাইভ সিঙ্ক সংযুক্ত নয়'
                }
                className="min-h-[48px] inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-surface text-text"
              >
                <span
                  aria-hidden="true"
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500'
                      : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                />
                <span>লাইভ</span>
              </span>

              <button
                type="button"
                onClick={triggerManualSync}
                disabled={syncStatus === 'syncing' || isSyncing}
                className={`min-h-[48px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  syncStatus === 'synced'
                    ? 'bg-success-soft text-success-text border-success/30'
                    : syncStatus === 'syncing' || isSyncing
                    ? 'bg-primary-soft text-primary border-primary/30'
                    : syncStatus === 'offline'
                    ? 'bg-warning-soft text-warning-text border-warning/30'
                    : 'bg-danger-soft text-danger-text border-danger/30'
                }`}
                title={
                  lastSyncedAt
                    ? `শেষ সিঙ্ক: ${lastSyncedAt}`
                    : 'সিঙ্ক অবস্থা'
                }
              >
                {syncStatus === 'synced' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success-text" />
                    <span>সিঙ্ক করা</span>
                  </>
                ) : syncStatus === 'syncing' || isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>সিঙ্ক হচ্ছে</span>
                  </>
                ) : syncStatus === 'offline' ? (
                  <>
                    <CloudOff className="w-4 h-4 text-warning-text" />
                    <span>অফলাইন</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-danger-text" />
                    <span>আবার চেষ্টা</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-surface text-text border border-border hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4 text-primary" />
              <span>লগইন করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Native Alarm Permission Alert Banner */}
      {hasMissingPermissions && (
        <section className="bg-warning-soft border border-warning/35 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-warning-text shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-text">
                ঠিক সময়ে অ্যালার্ম বাজতে এই অনুমতিগুলো দিন
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-text-muted font-medium">
                <span className={nativePerms.exactAlarm ? 'text-success-text font-semibold' : 'text-danger-text font-bold'}>
                  সঠিক সময়ে অ্যালার্ম {nativePerms.exactAlarm ? '✓' : '✕'}
                </span>
                <span>·</span>
                <span className={nativePerms.notifications ? 'text-success-text font-semibold' : 'text-danger-text font-bold'}>
                  নোটিফিকেশন {nativePerms.notifications ? '✓' : '✕'}
                </span>
                <span>·</span>
                <span className={nativePerms.batteryUnrestricted ? 'text-success-text font-semibold' : 'text-danger-text font-bold'}>
                  ব্যাটারি সেভার থেকে ছাড় {nativePerms.batteryUnrestricted ? '✓' : '✕'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="min-h-[48px] px-5 py-2.5 bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-base rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            অনুমতি ঠিক করুন
          </button>
        </section>
      )}

      {/* Dynamic User-Ordered Home Screen Layout */}
      {normalizedHomeLayout
        .filter((item) => item.id === 'today_doses' || item.visible)
        .map((item) => {
          const renderCard = (id: HomeLayoutCardId) => {
            switch (id) {
              case 'today_doses':
                return (
                  <React.Fragment key="today_doses">
                    {/* Upcoming Doctor Appointments Alert */}
                    {urgentAppointments.length > 0 && (
                      <section className="bg-primary-soft border border-primary/30 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-primary text-on-primary shrink-0">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-text">
                                ডাক্তারের সাথে দেখা ({toBengaliNumber(urgentAppointments.length)}টি)
                              </h3>
                              <div className="mt-1 space-y-1">
                                {urgentAppointments.map((app) => {
                                  const isToday = app.appointmentDate === realTodayStr;
                                  return (
                                    <p key={app.id} className="text-sm text-text-muted font-medium">
                                      <strong className="text-text">{app.doctorName}</strong> — {isToday ? 'আজ' : 'আগামীকাল'} {toBengaliNumber(app.appointmentTime)}
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
                            className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl transition-colors shrink-0 cursor-pointer"
                          >
                            দেখুন
                          </button>
                        </div>
                      </section>
                    )}

                    {/* Overdue Dose Family Alert */}
                    {overdueDoses.length > 0 && (
                      <section className="bg-danger-soft border-2 border-danger/35 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-[#B91C1C] text-white shrink-0">
                              <Bell className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-danger-text">
                                ওষুধ খাওয়ার সময় পার হয়েছে ({toBengaliNumber(overdueDoses.length)}টি)
                              </h3>
                              <p className="text-sm text-text mt-1">
                                <strong>{overdueDoses.map((d) => `${d.brandName} (${toBengaliNumber(d.time)})`).join(', ')}</strong> — নির্ধারিত সময়ের ৩০ মিনিট পার হয়েছে।
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleNotifyFamily(overdueDoses[0], 'whatsapp')}
                              className="min-h-[48px] px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Share2 className="w-4 h-4" />
                              <span>পরিবারকে জানান</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNotifyFamily(overdueDoses[0], 'sms')}
                              className="min-h-[48px] px-4 py-2 bg-surface hover:bg-surface-2 border border-border text-text font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <PhoneCall className="w-4 h-4" />
                              <span>মেসেজ পাঠান</span>
                            </button>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* STEP 1 MAIN FOCUS: "এখন খাবেন" / EMPTY / ALL DONE CARD */}
                    {patientMedicines.length === 0 ? (
                      <section className="bg-surface border-2 border-primary/25 rounded-2xl p-6 sm:p-10 text-center shadow-sm space-y-5">
                        <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
                          <Pill className="w-9 h-9" />
                        </div>

                        <div className="space-y-2 max-w-lg mx-auto">
                          <h1 className="text-2xl sm:text-3xl font-bold text-text">
                            {medicines.length === 0
                              ? 'আপনার প্রথম ওষুধ যোগ করুন'
                              : 'এই সদস্যের কোনো চলমান ওষুধ নেই'}
                          </h1>
                          <p className="text-base text-text-muted leading-relaxed">
                            সহজ ৪ ধাপে ওষুধের নাম ও খাওয়ার সময় যোগ করলে ঠিক সময়ে অ্যালার্ম পাবেন।
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setCurrentPage('add-medicine')}
                            className="min-h-[56px] inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-primary hover:bg-primary-hover text-on-primary font-bold text-lg rounded-2xl shadow-sm transition-colors cursor-pointer"
                          >
                            <Plus className="w-6 h-6" />
                            <span>ওষুধ যোগ করুন</span>
                          </button>

                          {patients.length === 0 && (
                            <button
                              type="button"
                              onClick={openCreateProfileModal}
                              className="min-h-[56px] inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-surface-2 hover:bg-border/60 text-text font-semibold text-base rounded-2xl transition-colors cursor-pointer"
                            >
                              <UserPlus className="w-5 h-5 text-primary" />
                              <span>সদস্য প্রোফাইল তৈরি করুন</span>
                            </button>
                          )}
                        </div>
                      </section>
                    ) : todayDoses.length === 0 ? (
                      <section className="bg-surface border border-border rounded-2xl p-8 text-center shadow-xs space-y-4">
                        <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
                        <h2 className="text-xl font-bold text-text">
                          আজকের কোনো ওষুধের সময়সূচি নেই
                        </h2>
                        <button
                          type="button"
                          onClick={() => setCurrentPage('add-medicine')}
                          className="min-h-[52px] inline-flex items-center justify-center gap-2 px-7 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-5 h-5" />
                          <span>ওষুধ যোগ করুন</span>
                        </button>
                      </section>
                    ) : !nextDueDose ? (
                      <section className="bg-success-soft border-2 border-success/40 rounded-2xl p-7 sm:p-9 text-center shadow-xs space-y-3">
                        <div className="w-16 h-16 rounded-full bg-[#15803D] text-white flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-success-text">
                          আজকের সব ওষুধ খাওয়া হয়েছে ✓
                        </h1>
                        <p className="text-base text-text-muted">
                          মোট {toBengaliNumber(totalToday)}টি ডোজের মধ্যে {toBengaliNumber(takenCount)}টি সম্পন্ন হয়েছে।
                        </p>
                      </section>
                    ) : (
                      (() => {
                        const dueMed = medicineById.get(nextDueDose.medicineId);
                        return (
                          <section className="bg-surface border-2 border-primary rounded-2xl p-5 sm:p-7 shadow-md space-y-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft text-accent-text border border-accent/25 text-sm font-bold">
                                <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                                <Clock className="w-4 h-4 text-accent-text" />
                                <span>এখন খাবেন</span>
                              </span>

                              <div className="flex items-center gap-2 flex-wrap">
                                {canSpeakDose && (
                                  <button
                                    type="button"
                                    onClick={() => handleSpeakDose(nextDueDose)}
                                    className="min-h-[48px] px-4 py-2 rounded-xl bg-primary-soft border border-primary/25 hover:bg-primary/15 text-primary font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {isSpeaking && speakingDoseKey === nextDueDose.key ? (
                                      <>
                                        <Square className="w-4 h-4 fill-current" />
                                        <span>থামুন</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-4 h-4" />
                                        <span>🔊 শুনুন</span>
                                      </>
                                    )}
                                  </button>
                                )}
                                <span className="text-sm font-bold text-text bg-surface-2 px-3 py-1.5 rounded-xl">
                                  {nextDueDose.timeSlot} · {formatBengaliTime(nextDueDose.time)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <MedicineBadgeIcon
                                  iconTag={dueMed?.iconTag}
                                  type={dueMed?.type || nextDueDose.type}
                                  colorTag={dueMed?.colorTag || nextDueDose.colorTag}
                                  size="lg"
                                />
                                <div className="min-w-0">
                                  <h1 className="text-2xl sm:text-3xl font-bold text-text leading-snug">
                                    {nextDueDose.brandName}
                                  </h1>
                                  <MedicineBadgeIcon
                                    iconTag={dueMed?.iconTag}
                                    type={dueMed?.type || nextDueDose.type}
                                    colorTag={dueMed?.colorTag || nextDueDose.colorTag}
                                    size="xs"
                                    showLabel
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-lg font-semibold text-text-muted">
                                <span>ডোজ: {nextDueDose.dosage}</span>
                                <span className="opacity-50">·</span>
                                <span>{nextDueDose.mealTiming}</span>
                              </div>
                              {deferredDoseKeys.includes(nextDueDose.key) && (
                                <p className="text-sm font-medium text-warning-text">
                                  পরে খাওয়ার জন্য রাখা হয়েছিল
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              <button
                                type="button"
                                onClick={() => handleTakeDose(nextDueDose)}
                                className="sm:col-span-2 min-h-[56px] w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xl rounded-2xl shadow-sm transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-6 h-6" />
                                <span>খেয়েছি</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeferDose(nextDueDose)}
                                className="min-h-[56px] w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-surface-2 hover:bg-border text-text font-bold text-lg rounded-2xl transition-colors cursor-pointer"
                              >
                                <Clock className="w-5 h-5" />
                                <span>পরে</span>
                              </button>
                            </div>
                          </section>
                        );
                      })()
                    )}

                    {/* TODAY'S REMAINING DOSES */}
                    {todayDoses.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-lg sm:text-xl font-bold text-text">
                            আজকের বাকি ডোজ ({toBengaliNumber(remainingListDoses.length)}টি)
                          </h2>
                          {takenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowTakenDoses((v) => !v)}
                              className="min-h-[48px] px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary-soft rounded-xl transition-colors cursor-pointer"
                            >
                              {showTakenDoses
                                ? 'খাওয়া শেষ ডোজ লুকান'
                                : `খাওয়া হয়েছে (${toBengaliNumber(takenCount)}টি)`}
                            </button>
                          )}
                        </div>

                        {remainingListDoses.length === 0 && !showTakenDoses ? (
                          <div className="bg-surface border border-border rounded-2xl p-5 text-center text-base text-text-muted">
                            {nextDueDose
                              ? 'এই মুহূর্তে উপরের ডোজটি ছাড়া আর কোনো বাকি ডোজ নেই।'
                              : 'আজকের সব ওষুধ খাওয়া শেষ হয়েছে।'}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {remainingListDoses.map((dose) => {
                              const isSkipped = dose.logStatus === 'skipped';
                              const isDeferred = deferredDoseKeys.includes(dose.key);
                              const med = medicineById.get(dose.medicineId);

                              return (
                                <div
                                  key={dose.key}
                                  className={`bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs ${
                                    isSkipped ? 'opacity-75' : ''
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-primary bg-primary-soft px-2.5 py-1 rounded-lg">
                                        {dose.timeSlot} · {formatBengaliTime(dose.time)}
                                      </span>
                                      {isDeferred && (
                                        <span className="text-sm font-semibold text-warning-text bg-warning-soft px-2.5 py-1 rounded-lg">
                                          পরে খাবেন
                                        </span>
                                      )}
                                      {isSkipped && (
                                        <span className="text-sm font-semibold text-text-muted bg-surface-2 px-2.5 py-1 rounded-lg">
                                          বাদ দেওয়া
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                      <MedicineBadgeIcon
                                        iconTag={med?.iconTag}
                                        type={med?.type || dose.type}
                                        colorTag={med?.colorTag || dose.colorTag}
                                        size="sm"
                                      />
                                      <h3 className="text-lg font-bold text-text">
                                        {dose.brandName}
                                      </h3>
                                    </div>

                                    <p className="text-base text-text-muted">
                                      ডোজ: <strong className="text-text">{dose.dosage}</strong> · {dose.mealTiming}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    {canSpeakDose && (
                                      <button
                                        type="button"
                                        onClick={() => handleSpeakDose(dose)}
                                        className="min-h-[48px] px-4 py-2.5 bg-primary-soft border border-primary/25 hover:bg-primary/15 text-primary font-bold text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                      >
                                        {isSpeaking && speakingDoseKey === dose.key ? (
                                          <>
                                            <Square className="w-4 h-4 fill-current" />
                                            <span>থামুন</span>
                                          </>
                                        ) : (
                                          <>
                                            <Volume2 className="w-4 h-4" />
                                            <span>🔊 শুনুন</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleTakeDose(dose)}
                                      className="min-h-[48px] px-6 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                                    >
                                      <CheckCircle2 className="w-5 h-5" />
                                      <span>খেয়েছি</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {showTakenDoses &&
                              takenDoses.map((dose) => {
                                const med = medicineById.get(dose.medicineId);
                                return (
                                  <div
                                    key={`taken-${dose.key}`}
                                    className="bg-success-soft/60 border border-success/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-success-text shrink-0" />
                                        <MedicineBadgeIcon
                                          iconTag={med?.iconTag}
                                          type={med?.type || dose.type}
                                          colorTag={med?.colorTag || dose.colorTag}
                                          size="xs"
                                        />
                                        <span className="text-lg font-bold text-text">
                                          {dose.brandName}
                                        </span>
                                      </div>
                                      <p className="text-base text-text-muted mt-1">
                                        {dose.timeSlot} ({formatBengaliTime(dose.time)}) · {dose.dosage} · খাওয়া হয়েছে
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => markDose(dose.medicineId, dose.timeSlot, dose.time, 'skipped', 'পূর্বাবস্থায় ফেরানো')}
                                      className="min-h-[48px] px-4 py-2 text-sm font-semibold text-text bg-surface border border-border rounded-xl hover:bg-surface-2 cursor-pointer shrink-0"
                                    >
                                      ফিরিয়ে আনুন
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </section>
                    )}

                    {/* Time-Grouped Medicines Summary + Printable Daily Slip */}
                    <TimeGroupedMedicinesSection todayStr={todayStr} />
                  </React.Fragment>
                );

              case 'caregiver_family':
                return <CaregiverFamilyCard key="caregiver_family" />;

              case 'patient_progress':
                return activePatient ? (
                  <div
                    key="patient_progress"
                    className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={activePatient.avatarUrl || '/src/assets/images/avatar_patient_bengali_1793655801544.jpg'}
                          alt={activePatient.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-full object-cover border-2 border-primary/30"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-text">
                              {activePatient.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => openEditProfileModal(activePatient)}
                              className="p-2 text-text-muted hover:text-primary rounded-lg hover:bg-surface-2 cursor-pointer"
                              title="প্রোফাইল সম্পাদনা"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-text-muted">
                            {activePatient.relation} · {toBengaliNumber(activePatient.age)} বছর · রক্ত: {activePatient.bloodGroup}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage('checklist')}
                          className="min-h-[48px] px-4 py-2 text-sm font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:bg-primary/15 flex items-center gap-1.5 cursor-pointer"
                        >
                          <ListChecks className="w-4 h-4" />
                          <span>দৈনিক চেকলিস্ট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage('reminders')}
                          className="min-h-[48px] px-4 py-2 text-sm font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:bg-primary/15 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Bell className="w-4 h-4" />
                          <span>সব রিমাইন্ডার</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <div className="flex justify-between items-center text-sm font-semibold text-text mb-2">
                        <span>আজকের ওষুধ খাওয়ার অগ্রগতি</span>
                        <span className="tabular-nums text-primary">
                          {toBengaliNumber(adherencePercent)}% ({toBengaliNumber(takenCount)}/{toBengaliNumber(totalToday)})
                        </span>
                      </div>
                      <div className="w-full bg-surface-2 h-3 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${adherencePercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-sm">
                      {currentUser ? (
                        <>
                          <div className="flex items-center gap-2 text-text-muted">
                            <Cloud className="w-4 h-4 text-success-text" />
                            <span>ক্লাউড ব্যাকআপ চালু ({currentUser.displayName || currentUser.email})</span>
                          </div>
                          <button
                            type="button"
                            onClick={syncLocalToCloud}
                            disabled={isSyncing}
                            className="min-h-[48px] px-4 py-2 text-sm font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:bg-primary/15 cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>এখনই সিঙ্ক করুন</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-text-muted">
                            তথ্য সুরক্ষিত রাখতে লগইন করুন
                          </span>
                          <button
                            type="button"
                            onClick={openAuthModal}
                            className="min-h-[48px] px-4 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl cursor-pointer flex items-center gap-1.5"
                          >
                            <Lock className="w-4 h-4" />
                            <span>লগইন বা রেজিস্টার</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null;

              case 'quick_actions':
                return (
                  <div
                    key="quick_actions"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentPage('calendar')}
                      className="min-h-[52px] px-4 py-3 bg-surface border border-border hover:border-primary rounded-2xl text-base font-semibold text-text flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Calendar className="w-5 h-5 text-primary" />
                      <span>স্বাস্থ্য ক্যালেন্ডার</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('doctors')}
                      className="min-h-[52px] px-4 py-3 bg-surface border border-border hover:border-primary rounded-2xl text-base font-semibold text-text flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Stethoscope className="w-5 h-5 text-primary" />
                      <span>আমার ডাক্তার</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('library')}
                      className="min-h-[52px] px-4 py-3 bg-surface border border-border hover:border-primary rounded-2xl text-base font-semibold text-text flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span>ওষুধ লাইব্রেরি</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('health-records')}
                      className="min-h-[52px] px-4 py-3 bg-surface border border-border hover:border-primary rounded-2xl text-base font-semibold text-text flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <HeartPulse className="w-5 h-5 text-accent" />
                      <span>স্বাস্থ্য রেকর্ড</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('history')}
                      className="min-h-[52px] px-4 py-3 bg-surface border border-border hover:border-primary rounded-2xl text-base font-semibold text-text flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5 text-primary" />
                      <span>ডাক্তারকে দেখানোর ইতিহাস</span>
                    </button>
                  </div>
                );

              case 'stock_summary':
                return (
                  <div key="stock_summary" className="space-y-6">
                    <FamilyCareSummary />
                    <ExpiringStockSection />
                    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-warning-text" />
                          <h3 className="text-base font-bold text-text">
                            ওষুধের মজুত সতর্কতা ({toBengaliNumber(lowStockMedicines.length)}টি কম)
                          </h3>
                        </div>
                      </div>

                      {lowStockMedicines.length === 0 ? (
                        <div className="p-4 bg-success-soft border border-success/30 rounded-xl flex items-center gap-2 text-sm font-semibold text-success-text">
                          <ShieldCheck className="w-5 h-5 text-success-text shrink-0" />
                          <span>সব ওষুধের পর্যাপ্ত মজুত আছে</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {lowStockMedicines.map((med) => (
                            <div
                              key={med.id}
                              className="p-3.5 rounded-xl bg-warning-soft/70 border border-warning/30 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <MedicineBadgeIcon
                                  iconTag={med.iconTag}
                                  type={med.type}
                                  colorTag={med.colorTag}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <div className="text-base font-bold text-text truncate">
                                    {med.brandName}
                                  </div>
                                  <div className="text-sm text-warning-text">
                                    বাকি: {toBengaliNumber(med.stock)} {med.unit}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openStockAdjustmentModal(med.id)}
                                className="min-h-[48px] px-4 py-2 text-sm font-bold text-warning-text bg-warning-soft hover:bg-warning/25 rounded-xl cursor-pointer shrink-0"
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
                          className="min-h-[48px] py-2.5 px-4 text-sm font-bold text-white bg-[#B45309] hover:bg-[#92400E] rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          <span>কিনতে হবে তালিকা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage('medicines')}
                          className="min-h-[48px] py-2.5 px-4 text-sm font-semibold text-text border border-border hover:bg-surface-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Package className="w-4 h-4" />
                          <span>সব ওষুধ দেখুন</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );

              case 'adherence_analytics':
                return <AdherenceAnalytics key="adherence_analytics" />;

              case 'emergency_card':
                return <EmergencyCard key="emergency_card" />;

              default:
                return null;
            }
          };

          return renderCard(item.id);
        })}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-surface border border-border hover:border-primary text-xs font-bold text-text-muted hover:text-primary inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-4 h-4" />
          <span>হোম স্ক্রিন সাজান</span>
        </button>
      </div>

      {/* Low Stock Shopping & Refill Modal */}
      <BuyListModal
        isOpen={isBuyListOpen}
        onClose={() => setIsBuyListOpen(false)}
      />

    </div>
  );
};
