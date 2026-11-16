import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, playAlertTone } from '../../utils/bengaliUtils';
import {
  useBengaliSpeech,
  buildDoseSpeechText,
  MISSING_BENGALI_VOICE_MESSAGE,
  VoiceSpeed,
} from '../../utils/speechUtils';
import {
  Settings as SettingsIcon,
  User,
  Users,
  Bell,
  Volume2,
  Download,
  RotateCcw,
  ShieldAlert,
  Heart,
  Plus,
  Edit2,
  Trash2,
  Check,
  Smartphone,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Type,
  AlertTriangle,
  Globe,
  Phone,
  Save,
  Music,
  FolderOpen,
  Play,
  Square,
  Share2,
  CalendarDays,
} from 'lucide-react';
import {
  isNativeRemindersAvailable,
  getNativePermissionStatus,
  openExactAlarmSettings,
  openBatterySettings,
  requestNotificationPermission,
  scheduleTestAlarm,
  getNativeAlarmTone,
  pickNativeAlarmTone,
  pickNativeAlarmToneFromFiles,
  previewNativeAlarmTone,
  stopNativeAlarmTonePreview,
  resetNativeAlarmTone,
  NativePermissionStatus,
  NativeAlarmToneInfo,
} from '../../services/nativeReminders';
import { SyncStatusCard } from './SyncStatusCard';
import { CaregiverSettingsSection } from '../caregiver/CaregiverSettingsSection';
import { MySharedLinksSection } from '../reports/MySharedLinksSection';

export const Settings: React.FC = () => {
  const {
    patients,
    activePatientId,
    setActivePatientId,
    openCreateProfileModal,
    openEditProfileModal,
    deletePatient,
    settings,
    updateSettings,
    resetAllData,
    openResetConfirmationModal,
    medicines,
    doseLogs,
    showToast,
    currentUser,
    openAuthModal,
    signOutUser,
    syncLocalToCloud,
    isSyncing,
    isCloudConnected,
    setCurrentPage,
  } = useMedicine();

  const {
    hasBengaliVoice,
    isSpeaking,
    voiceSettings,
    updateVoiceSettings,
    speak,
    stop,
  } = useBengaliSpeech();
  const isNative = isNativeRemindersAvailable();
  const isApkEnvironment =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { AndroidReminders?: unknown }).AndroidReminders !== 'undefined';
  const [permissionStatus, setPermissionStatus] = useState<NativePermissionStatus | null>(() =>
    getNativePermissionStatus()
  );
  const [alarmTone, setAlarmTone] = useState<NativeAlarmToneInfo>(
    () => getNativeAlarmTone() || { name: 'ডিফল্ট অ্যালার্ম টোন', isDefault: true }
  );
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPreviewPlayingRef = useRef(false);
  isPreviewPlayingRef.current = isPreviewPlaying;

  const isBn = settings.language !== 'en';
  const [emergencyName, setEmergencyName] = useState(settings.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(settings.emergencyContactPhone || '');
  const [isSavingContact, setIsSavingContact] = useState(false);

  const handleSaveEmergencyContact = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContact(true);
    updateSettings({
      emergencyContactName: emergencyName.trim(),
      emergencyContactPhone: emergencyPhone.trim(),
    });
    setIsSavingContact(false);
    showToast(
      isBn ? 'জরুরি পারিবারিক যোগাযোগের নম্বর সংরক্ষিত হয়েছে।' : 'Emergency family contact saved successfully.',
      'success'
    );
  };

  const refreshPermissions = useCallback(() => {
    if (isNativeRemindersAvailable()) {
      const status = getNativePermissionStatus();
      setPermissionStatus(status);
    }
  }, []);

  const refreshAlarmTone = useCallback(() => {
    if (isNativeRemindersAvailable()) {
      const tone = getNativeAlarmTone();
      if (tone) {
        setAlarmTone(tone);
      }
    }
  }, []);

  const stopPreviewPlayback = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    stopNativeAlarmTonePreview();
    setIsPreviewPlaying(false);
  }, []);

  useEffect(() => {
    if (!isNative) return;
    refreshPermissions();
    refreshAlarmTone();

    const handleFocus = () => {
      refreshPermissions();
      refreshAlarmTone();
    };
    const handleToneChanged = () => {
      refreshAlarmTone();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('alarmToneChanged', handleToneChanged);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('alarmToneChanged', handleToneChanged);
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (isPreviewPlayingRef.current) {
        stopNativeAlarmTonePreview();
      }
    };
  }, [isNative, refreshPermissions, refreshAlarmTone]);

  const handleTogglePreviewAlarmTone = () => {
    if (isPreviewPlaying) {
      stopPreviewPlayback();
      return;
    }
    const started = previewNativeAlarmTone();
    if (started) {
      setIsPreviewPlaying(true);
      previewTimerRef.current = setTimeout(() => {
        previewTimerRef.current = null;
        setIsPreviewPlaying(false);
      }, 6000);
    }
  };

  const handleResetAlarmTone = () => {
    if (isPreviewPlaying) {
      stopPreviewPlayback();
    }
    const ok = resetNativeAlarmTone();
    refreshAlarmTone();
    if (ok) {
      showToast('ডিফল্ট অ্যালার্ম টোনে ফেরানো হয়েছে', 'success');
    }
  };

  const handleCheckAlarm = () => {
    const success = scheduleTestAlarm();
    if (success) {
      showToast('১ মিনিট পর একটি অ্যালার্ম সেট করা হয়েছে — বাজলে বুঝতে পারবেন সব ঠিক আছে', 'success');
    } else {
      showToast('অ্যালার্ম সেট করা যায়নি। অনুগ্রহ করে অনুমতি পরীক্ষা করুন।', 'alert');
    }
  };

  const handleExportData = () => {
    const data = {
      patients,
      medicines,
      doseLogs,
      settings,
      exportDate: new Date().toISOString(),
      appName: 'স্বাস্থ্যবন্ধু (Shasthobondhu)',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shasthobondhu-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('সকল ওষুধ ও হিস্ট্রি ডাটা সফলভাবে ডাউনলোড হয়েছে', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">
          সেটিংস ও প্রোফাইল ব্যবস্থাপনা
        </h1>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          পারিবারিক সদস্য, রিমাইন্ডার পছন্দ ও ব্যাকআপ সংক্রান্ত সেটিংস
        </p>
      </div>

      {/* Section 1: Family Member Profiles */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">
              পারিবারিক রোগী প্রোফাইল
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateProfileModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary-soft border border-primary/25 rounded-lg hover:opacity-90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন সদস্য যোগ করুন</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="p-8 bg-surface-2 border border-dashed border-primary/40 rounded-xl text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text">
              এখনও কোনো রোগী প্রোফাইল তৈরি করা হয়নি
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              পরিবারের যেকোনো সদস্যের (যেমন: নিজের, বাবা, মা, সন্তান) জন্য আনলিমিটেড প্রোফাইল তৈরি ও পরিচালনা করতে পারবেন।
            </p>
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="px-4 py-2 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন প্রোফাইল তৈরি করুন</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {patients.map((p) => {
              const isSelected = p.id === activePatientId;

              return (
                <div
                  key={p.id}
                  onClick={() => setActivePatientId(p.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40 bg-surface-2/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary">
                        {p.relation}
                      </span>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="text-[11px] font-bold text-primary bg-primary-soft border border-primary/25 px-2 py-0.5 rounded">
                            সক্রিয়
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditProfileModal(p);
                          }}
                          className="p-1 text-text-muted hover:text-primary rounded-md hover:bg-surface cursor-pointer"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`আপনি কি নিশ্চিত যে "${p.name}" এর প্রোফাইল মুছে ফেলতে চান? (ওষুধগুলো সংরক্ষিত থাকবে)`)) {
                              deletePatient(p.id);
                            }
                          }}
                          className="p-1 text-text-muted hover:text-danger rounded-md hover:bg-surface cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-text">
                      {p.name}
                    </h3>

                    <div className="text-xs text-text-muted mt-1 space-y-0.5">
                      <div>বয়স: {toBengaliNumber(p.age)} বছর · রক্ত: {p.bloodGroup}</div>
                      <div>জরুরি: {p.emergencyContact}</div>
                    </div>

                    {p.chronicConditions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border text-[11px] text-text-muted">
                        <span className="opacity-80 block mb-0.5">দীর্ঘমেয়াদী রোগ:</span>
                        <span>{p.chronicConditions.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-text-muted">
                      {isSelected ? 'বর্তমানে নির্বাচিত' : 'নির্বাচন করতে ক্লিক করুন'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section: Theme & Accessibility Settings */}
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Sun className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-text">
            দেখার সুবিধা ও থিম
          </h2>
        </div>

        <div className="space-y-5 text-base">
          {/* Dark Mode Switcher */}
          <div>
            <label className="block text-base font-bold text-text mb-2">
              রঙ ও থিম
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light' as const, label: 'আলো (লাইট)', icon: Sun },
                { id: 'dark' as const, label: 'রাত (ডার্ক)', icon: Moon },
                { id: 'system' as const, label: 'ফোন অনুযায়ী', icon: Monitor },
              ].map((theme) => {
                const Icon = theme.icon;
                const isSelected = (settings.themeMode || 'system') === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateSettings({ themeMode: theme.id })}
                    className={`min-h-[48px] flex items-center justify-center gap-2 p-3 rounded-xl border text-sm sm:text-base font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary-soft text-primary shadow-xs ring-1 ring-primary/40'
                        : 'border-border hover:bg-surface-2 text-text'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-primary" />
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Easy Mode (সহজ মোড) */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text flex items-center gap-1.5">
                <Smartphone className="w-5 h-5 text-primary" />
                সহজ মোড
              </span>
              <span className="text-sm text-text-muted">
                খুব বড় লেখা ও হোম স্ক্রিনে শুধু ৩টি বড় বোতাম (আজকের ওষুধ, ওষুধ যোগ, জরুরি কল)
              </span>
            </div>

            <button
              type="button"
              onClick={() => updateSettings({ easyMode: !settings.easyMode })}
              aria-label="সহজ মোড"
              aria-pressed={!!settings.easyMode}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                settings.easyMode ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.easyMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Elderly Large Font Mode */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text flex items-center gap-1.5">
                <Type className="w-5 h-5 text-primary" />
                বড় লেখা মোড
              </span>
              <span className="text-sm text-text-muted">
                অ্যাপের লেখা ও বাটন আরও বড় দেখাবে যাতে পড়তে সহজ হয়
              </span>
            </div>

            <button
              type="button"
              onClick={() => updateSettings({ largeFontMode: !settings.largeFontMode })}
              aria-label="বড় লেখা মোড"
              aria-pressed={!!settings.largeFontMode}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                settings.largeFontMode ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.largeFontMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text flex items-center gap-1.5">
                <Globe className="w-5 h-5 text-primary" />
                ভাষা
              </span>
              <span className="text-sm text-text-muted">
                বাংলা অথবা ইংরেজিতে অ্যাপ দেখুন
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'bn' })}
                className={`min-h-[48px] px-4 py-2 rounded-xl text-base font-semibold transition cursor-pointer ${
                  (settings.language || 'bn') === 'bn'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-2 text-text hover:bg-border/60'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`min-h-[48px] px-4 py-2 rounded-xl text-base font-semibold transition cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-2 text-text hover:bg-border/60'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Weekly Pillbox Start Day */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text flex items-center gap-1.5">
                <CalendarDays className="w-5 h-5 text-primary" />
                সপ্তাহ শুরু
              </span>
              <span className="text-sm text-text-muted">
                সাপ্তাহিক পিলবক্স কোন দিন থেকে শুরু হবে তা বেছে নিন
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(
                [
                  { id: 'saturday' as const, label: 'শনি' },
                  { id: 'sunday' as const, label: 'রবি' },
                  { id: 'monday' as const, label: 'সোম' },
                ]
              ).map((opt) => {
                const isSelected = (settings.weekStartDay || 'saturday') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ weekStartDay: opt.id })}
                    className={`min-h-[48px] px-4 py-2 rounded-xl text-base font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-2 text-text hover:bg-border/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section: ভয়েস (Bengali Voice Reminder Settings) */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Volume2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-text">
              ভয়েস
            </h2>
            <p className="text-xs text-text-muted">
              ডোজের সময়, ওষুধের বিবরণ এবং সহায়ক উত্তর বাংলায় পড়ে শোনান
            </p>
          </div>
        </div>

        {/* Missing Bengali Voice Alert */}
        {!hasBengaliVoice && (
          <div className="p-4 rounded-xl bg-warning-soft border border-warning/30 text-warning-text flex items-start gap-2.5 text-sm">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{MISSING_BENGALI_VOICE_MESSAGE}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Voice On/Off */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-bold text-text block">
                ভয়েস রিমাইন্ডার চালু
              </span>
              <span className="text-sm text-text-muted">
                ডোজ কার্ড, ওষুধের বিবরণ ও সহকারী উত্তরে &quot;শুনুন&quot; বোতাম দেখাবে
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextEnabled = !voiceSettings.enabled;
                updateVoiceSettings({ enabled: nextEnabled });
                updateSettings({ voiceReadoutEnabled: nextEnabled });
              }}
              aria-label="ভয়েস রিমাইন্ডার চালু বা বন্ধ"
              aria-pressed={voiceSettings.enabled}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                voiceSettings.enabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  voiceSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Reading Speed: ধীরে / স্বাভাবিক / একটু দ্রুত */}
          <div className="pt-3 border-t border-border space-y-2.5">
            <div>
              <span className="font-bold text-text block">
                পড়ার গতি
              </span>
              <span className="text-sm text-text-muted">
                কথা কত ধীরে বা দ্রুত শোনাবে তা বেছে নিন
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'slow', label: 'ধীরে' },
                  { key: 'normal', label: 'স্বাভাবিক' },
                  { key: 'fast', label: 'একটু দ্রুত' },
                ] as Array<{ key: VoiceSpeed; label: string }>
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => updateVoiceSettings({ speed: opt.key })}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition cursor-pointer ${
                    voiceSettings.speed === opt.key
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-2 text-text hover:bg-border/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Dose-Taken Voice Confirmation */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text block">
                &quot;খেয়েছি&quot; চাপলে নিশ্চিতকরণ কথা
              </span>
              <span className="text-sm text-text-muted">
                ওষুধ খাওয়া চিহ্নিত করলে সংক্ষেপে নিশ্চিতকরণ শোনাবে
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateVoiceSettings({
                  confirmOnDoseTaken: !voiceSettings.confirmOnDoseTaken,
                })
              }
              aria-label="খেয়েছি চাপলে নিশ্চিতকরণ কথা"
              aria-pressed={voiceSettings.confirmOnDoseTaken}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                voiceSettings.confirmOnDoseTaken
                  ? 'bg-primary'
                  : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  voiceSettings.confirmOnDoseTaken ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Future APK Alarm Voice Setting */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <span className="font-bold text-text block">
                অ্যালার্মের সময় ফোনের ভয়েস রিমাইন্ডার
              </span>
              <span className="text-sm text-text-muted">
                অ্যাপ বাইরে থেকে অ্যালার্ম বাজালে ওষুধের নাম বলে ডাকবে (সমর্থিত ফোনে)
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateVoiceSettings({
                  apkAlarmVoiceEnabled: !voiceSettings.apkAlarmVoiceEnabled,
                })
              }
              aria-label="অ্যালার্মের সময় ফোনের ভয়েস রিমাইন্ডার"
              aria-pressed={voiceSettings.apkAlarmVoiceEnabled}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                voiceSettings.apkAlarmVoiceEnabled
                  ? 'bg-primary'
                  : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  voiceSettings.apkAlarmVoiceEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Test Voice Playback Button (only shown if Bengali voice exists & voice is enabled) */}
          {hasBengaliVoice && voiceSettings.enabled && (
            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) {
                    stop();
                    return;
                  }
                  const activeName = patients.find((p) => p.id === activePatientId)?.name || 'যমুনা আপা';
                  const sampleText = buildDoseSpeechText({
                    patientName: activeName,
                    brandName: 'নাপা এক্সটেন্ড',
                    dosage: '১টি',
                    type: 'ট্যাবলেট',
                    mealTiming: 'খাওয়ার পরে',
                  });
                  speak(sampleText);
                }}
                className="min-h-[48px] w-full sm:w-auto px-5 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>থামুন</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>পরীক্ষা করে শুনুন</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Section: Family Emergency Contact for Overdue Doses (Step 4) */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Phone className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-text">
              {isBn ? 'জরুরি পারিবারিক যোগাযোগ (ডোজ মিস সতর্কতা)' : 'Emergency Family Contact (Overdue Doses)'}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isBn
                ? 'কোনো ডোজ ৩০ মিনিটের বেশি পার হয়ে গেলে ড্যাশবোর্ডে "পরিবারকে জানান" বাটনে ক্লিক করে দ্রুত এই নম্বরে এসএমএস বা হোয়াটসঅ্যাপ পাঠানো যাবে।'
                : 'When a dose is over 30 minutes overdue, dashboard alert lets you send a quick SMS/WhatsApp to this family contact.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEmergencyContact} className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                {isBn ? 'পারিবারিক সদস্যের নাম' : 'Family Member / Caregiver Name'}
              </label>
              <input
                type="text"
                placeholder={isBn ? 'উদা: মো. তারেক (বড় ছেলে)' : 'e.g. John Doe (Son)'}
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface-2 text-text text-xs sm:text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                {isBn ? 'জরুরি মোবাইল নম্বর' : 'Emergency Mobile Phone Number'}
              </label>
              <input
                type="tel"
                placeholder={isBn ? 'উদা: 01711234567 বা +8801711234567' : 'e.g. +8801711234567'}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface-2 text-text text-xs sm:text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-text-muted">
              {isBn
                ? '* গোপনীয়তা সুরক্ষা: অ্যাপ কখনো নিজে থেকে সরাসরি এসএমএস পাঠায় না; ব্যবহারকারী ক্লিক করার পর ফোনের মেসেজিং অ্যাপ খোলে।'
                : '* Privacy: The app never sends messages automatically; it opens your phone messaging app for manual confirmation.'}
            </span>

            <button
              type="submit"
              disabled={isSavingContact}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Contact'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Section 2: Reminder Preferences */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-text">
            রিমাইন্ডার ও নোটিফিকেশন পছন্দ
          </h2>
        </div>

        <div className="space-y-4 text-xs sm:text-sm">
          
          {/* Sound Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <span className="font-semibold text-text block">
                অ্যালার্মের শব্দ
              </span>
              <span className="text-xs text-text-muted">
                {isApkEnvironment
                  ? 'ডোজের নির্ধারিত সময়ে ফোনের অ্যালার্ম শব্দ বাজবে'
                  : 'ডোজ গ্রহণের নির্ধারিত সময়ে অ্যালার্ম সংকেত বাজবে'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {!isApkEnvironment && (
                <button
                  type="button"
                  onClick={() => playAlertTone(settings.selectedTone)}
                  className="px-3.5 py-2 min-h-[48px] text-sm font-semibold bg-surface-2 hover:bg-border/60 rounded-xl text-text cursor-pointer flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>বাজিয়ে শুনুন</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  settings.soundEnabled ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Tone Selector (শুধু ওয়েব ব্রাউজারে দেখাবে; APK-তে লুকানো থাকবে) */}
          {!isApkEnvironment && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                { id: 'soft-bell' as const, label: 'নরম বেল' },
                { id: 'chime' as const, label: 'মিষ্টি সুর' },
                { id: 'digital-beep' as const, label: 'হালকা বিপ' },
              ].map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => {
                    updateSettings({ selectedTone: tone.id });
                    playAlertTone(tone.id);
                  }}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    settings.selectedTone === tone.id
                      ? 'border-primary bg-primary-soft text-primary font-bold'
                      : 'border-border hover:bg-surface-2 text-text'
                  }`}
                >
                  <div className="text-xs">{tone.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Advance Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-bold text-text mb-1.5">
                খাবারের কত মিনিট আগে মনে করাবে?
              </label>
              <select
                value={settings.advanceMinutes}
                onChange={(e) => updateSettings({ advanceMinutes: Number(e.target.value) })}
                className="min-h-[48px] w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-base text-text"
              >
                <option value={0}>নির্দিষ্ট সময়েই (০ মিনিট)</option>
                <option value={10}>১০ মিনিট আগে</option>
                <option value={15}>১৫ মিনিট আগে</option>
                <option value={30}>৩০ মিনিট আগে (গ্যাস্ট্রিকের ওষুধের জন্য ভালো)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-text mb-1.5">
                পরে মনে করানোর সময়
              </label>
              <select
                value={settings.snoozeDurationMinutes}
                onChange={(e) => updateSettings({ snoozeDurationMinutes: Number(e.target.value) })}
                className="min-h-[48px] w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-base text-text"
              >
                <option value={5}>৫ মিনিট</option>
                <option value={10}>১০ মিনিট</option>
                <option value={15}>১৫ মিনিট</option>
              </select>
            </div>
          </div>

          {/* Phone Alarm Card (Requirement 4: শুধু Android APK WebView-তে দেখাবে) */}
          {isNative && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-text text-sm">
                      ফোন অ্যালার্ম অনুমতি
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      ঠিক সময়ে অ্যালার্ম বাজতে এই অনুমতিগুলো দিন
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshPermissions}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer self-start sm:self-auto"
                >
                  অবস্থা রিফ্রেশ
                </button>
              </div>

              {/* 3 Permissions status with action buttons */}
              <div className="space-y-2.5 text-xs">
                {/* 1. Exact Alarm */}
                <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.exactAlarm
                          ? 'bg-success-soft text-success-text'
                          : 'bg-danger-soft text-danger-text'
                      }`}
                    >
                      {permissionStatus?.exactAlarm ? '✓ সক্রিয়' : '✕ বন্ধ'}
                    </span>
                    <div>
                      <strong className="block text-text font-semibold">
                        সঠিক সময়ে অ্যালার্ম
                      </strong>
                      <span className="text-[11px] text-text-muted">
                        সঠিক সময়ে ওষুধের অ্যালার্ম বাজার জন্য প্রয়োজন
                      </span>
                    </div>
                  </div>

                  {!permissionStatus?.exactAlarm && (
                    <button
                      type="button"
                      onClick={() => {
                        openExactAlarmSettings();
                        setTimeout(refreshPermissions, 1000);
                      }}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      অনুমতি ঠিক করুন
                    </button>
                  )}
                </div>

                {/* 2. Notifications */}
                <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.notifications
                          ? 'bg-success-soft text-success-text'
                          : 'bg-danger-soft text-danger-text'
                      }`}
                    >
                      {permissionStatus?.notifications ? '✓ সক্রিয়' : '✕ বন্ধ'}
                    </span>
                    <div>
                      <strong className="block text-text font-semibold">
                        নোটিফিকেশন
                      </strong>
                      <span className="text-[11px] text-text-muted">
                        নোটিফিকেশনে ওষুধের ডোজ ও সময় দেখানোর জন্য
                      </span>
                    </div>
                  </div>

                  {!permissionStatus?.notifications && (
                    <button
                      type="button"
                      onClick={() => {
                        requestNotificationPermission();
                        setTimeout(refreshPermissions, 1000);
                      }}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      অনুমতি দিন
                    </button>
                  )}
                </div>

                {/* 3. Battery Unrestricted */}
                <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.batteryUnrestricted
                          ? 'bg-success-soft text-success-text'
                          : 'bg-warning-soft text-warning-text'
                      }`}
                    >
                      {permissionStatus?.batteryUnrestricted ? '✓ সক্রিয়' : '✕ সীমাবদ্ধ'}
                    </span>
                    <div>
                      <strong className="block text-text font-semibold">
                        ব্যাটারি সেভার থেকে ছাড়
                      </strong>
                      <span className="text-[11px] text-text-muted">
                        ফোন বন্ধ বা ঘুমন্ত অবস্থায় অ্যালার্ম মিস হওয়া ঠেকায়
                      </span>
                    </div>
                  </div>

                  {!permissionStatus?.batteryUnrestricted && (
                    <button
                      type="button"
                      onClick={() => {
                        openBatterySettings();
                        setTimeout(refreshPermissions, 1000);
                      }}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      সেটিংস খুলুন
                    </button>
                  )}
                </div>
              </div>

              {/* APK Alarm Tone Card (শুধু APK-তে দেখাবে, ব্রাউজারে নয়) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-text">
                        অ্যালার্ম টোন
                      </h4>
                      <p className="text-xs text-text-muted">
                        ওষুধের সময় হলে ফোনে যে সুর বাজবে তা পছন্দ করুন
                      </p>
                    </div>
                  </div>
                  {alarmTone.isDefault && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/25 shrink-0">
                      ডিফল্ট
                    </span>
                  )}
                </div>

                {/* Current Tone Display */}
                <div className="p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] text-text-muted block">
                      বর্তমান অ্যালার্ম টোন
                    </span>
                    <strong className="text-sm font-bold text-text block truncate mt-0.5">
                      {alarmTone.name}
                    </strong>
                  </div>
                  <Volume2 className={`w-5 h-5 shrink-0 ${isPreviewPlaying ? 'text-primary animate-pulse' : 'text-text-muted'}`} />
                </div>

                {/* Picker & Playback Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewPlaying) stopPreviewPlayback();
                      pickNativeAlarmTone();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-surface hover:bg-primary-soft border border-border hover:border-primary/40 text-text text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Bell className="w-4 h-4 text-primary shrink-0" />
                    <span>ফোনের টোন থেকে বাছুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewPlaying) stopPreviewPlayback();
                      pickNativeAlarmToneFromFiles();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-surface hover:bg-primary-soft border border-border hover:border-primary/40 text-text text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                    <span>গান/ফাইল থেকে বাছুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePreviewAlarmTone}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs border ${
                      isPreviewPlaying
                        ? 'bg-warning border-warning text-white hover:opacity-90'
                        : 'bg-primary hover:bg-primary-hover border-primary text-on-primary'
                    }`}
                  >
                    {isPreviewPlaying ? (
                      <>
                        <Square className="w-4 h-4 shrink-0" />
                        <span>থামান</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 shrink-0" />
                        <span>শুনে দেখুন</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAlarmTone}
                    className="w-full py-3 px-4 rounded-xl bg-surface hover:bg-surface-2 border border-border text-text text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="w-4 h-4 text-text-muted shrink-0" />
                    <span>ডিফল্টে ফিরুন</span>
                  </button>
                </div>

                {/* 1-Minute Alarm Verification Button (no word "টেস্ট") */}
                <button
                  type="button"
                  onClick={handleCheckAlarm}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-soft hover:opacity-90 border border-primary/25 text-primary text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-primary shrink-0" />
                  <span>অ্যালার্ম ঠিকমতো বাজছে কিনা দেখুন</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Caregiver Mode Section ("পরিবারের যত্নকারী") */}
      <CaregiverSettingsSection />

      {/* Shared Medical Report Links Section ("আমার শেয়ার করা লিংক") */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              <span>রিপোর্ট শেয়ার লিংক (ডাক্তার/পরিবার)</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              মেয়াদি নিরাপদ লিংক তৈরি করুন ও আগে তৈরি করা লিংক পরিচালনা বা বাতিল করুন
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('share-report')}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>নতুন শেয়ার লিংক বানান</span>
          </button>
        </div>

        <MySharedLinksSection autoLoadOnMount={false} />
      </section>

      {/* Cloud Account & Sync Section */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text">
              ক্লাউড ব্যাকআপ ও সিঙ্ক
            </h2>
            <p className="text-xs text-text-muted">
              ক্লাউডে আপনার ওষুধ ও স্বাস্থ্য ইতিহাস নিরাপদে সংরক্ষিত ও সিঙ্ক থাকে
            </p>
          </div>
          <span className="text-xs text-success-text font-semibold bg-success-soft px-2.5 py-1 rounded-md border border-success/30">
            ✓ ক্লাউড সক্রিয়
          </span>
        </div>

        {/* Live Sync Status Card */}
        <SyncStatusCard />

        {currentUser && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={signOutUser}
              className="px-3.5 py-1.5 text-xs font-semibold text-danger-text bg-danger-soft border border-danger/30 rounded-lg hover:opacity-90 cursor-pointer transition-colors"
            >
              লগআউট
            </button>
          </div>
        )}
      </section>

      {/* Section 3: Data Management */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-text pb-3 border-b border-border">
          ডেটা ব্যাকআপ ও নিয়ন্ত্রণ
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <strong className="block text-sm font-semibold text-text mb-0.5">
              ব্যাকআপ ডাউনলোড
            </strong>
            <span className="text-text-muted">
              আপনার সমস্ত ওষুধের তালিকা, পরিবারের সদস্য ও সেবন ইতিহাস একটি ফাইলে ডাউনলোড করুন
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary bg-primary-soft border border-primary/25 rounded-lg hover:opacity-90 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>ব্যাকআপ ডাউনলোড</span>
          </button>
        </div>

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <strong className="block text-sm font-semibold text-danger-text mb-0.5">
              সব ডেটা মুছে নতুন করে শুরু করুন
            </strong>
            <span className="text-text-muted">
              অ্যাপের সংরক্ষিত সমস্ত ওষুধ, সেবন ইতিহাস, প্রোফাইল ও সেটিংস মুছে একদম নতুন করে শুরু করবে
            </span>
          </div>

          <button
            type="button"
            onClick={openResetConfirmationModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-danger-text bg-danger-soft border border-danger/30 rounded-lg hover:opacity-90 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>সব মুছে নতুন শুরু করুন</span>
          </button>
        </div>
      </section>

      {/* Section 4: Mobile App Install Guide */}
      <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">
              মোবাইলের হোম স্ক্রিনে অ্যাপ যুক্ত করুন
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-primary bg-primary-soft px-2 py-0.5 rounded">
            মোবাইল অ্যাপ
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-primary-soft/60 border border-primary/20 rounded-xl space-y-2">
            <p className="text-text-muted leading-relaxed">
              সহজে ব্যবহারের জন্য আপনি সরাসরি আপনার ফোনের হোম স্ক্রিনে অ্যাপটি যুক্ত করে নিতে পারেন:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-text pl-1 text-sm">
              <li>ফোনের ব্রাউজারে স্বাস্থ্যবন্ধু খুলুন।</li>
              <li>উপরের থ্রি-ডট মেনু (<strong>⋮</strong>) অথবা শেয়ার আইকনে চাপুন।</li>
              <li><strong>"অ্যাপ ইনস্টল করুন"</strong> অথবা <strong>"হোম স্ক্রিনে যোগ করুন"</strong> বেছে নিন।</li>
              <li>কয়েক সেকেন্ডেই অ্যাপটি আপনার ফোনের পর্দায় যুক্ত হয়ে যাবে।</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Section 5: Healthcare Disclaimer & About */}
      <section className="bg-surface-2 border border-border rounded-2xl p-5 text-sm text-text-muted space-y-2">
        <div className="flex items-center gap-2 font-bold text-text text-base">
          <ShieldAlert className="w-5 h-5 text-warning" />
          <span>স্বাস্থ্য সতর্কতা</span>
        </div>
        <p className="leading-relaxed">
          "স্বাস্থ্যবন্ধু" আপনার ওষুধের সময় মনে রাখা ও হিসাব রাখার সহায়ক অ্যাপ। এটি ডাক্তারের বিকল্প নয়। ওষুধ শুরু, বদলানো বা বন্ধ করার আগে অবশ্যই ডাক্তারের পরামর্শ নিন।
        </p>
        <div className="pt-2 text-xs text-text-muted flex items-center justify-between">
          <span>স্বাস্থ্যবন্ধু · বাংলা ওষুধ সহায়িকা</span>
          <span>© ২০২৬ স্বাস্থ্যবন্ধু</span>
        </div>
      </section>

    </div>
  );
};
