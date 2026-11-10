import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, playAlertTone } from '../../utils/bengaliUtils';
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
  Code,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Type,
  AlertTriangle,
  Globe,
  Phone,
  Save,
} from 'lucide-react';
import {
  isNativeRemindersAvailable,
  getNativePermissionStatus,
  openExactAlarmSettings,
  openBatterySettings,
  requestNotificationPermission,
  scheduleTestAlarm,
  NativePermissionStatus,
} from '../../services/nativeReminders';

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
    medicines,
    doseLogs,
    showToast,
    currentUser,
    openAuthModal,
    signOutUser,
    syncLocalToCloud,
    isSyncing,
    isCloudConnected,
  } = useMedicine();

  const isNative = isNativeRemindersAvailable();
  const [permissionStatus, setPermissionStatus] = useState<NativePermissionStatus | null>(() =>
    getNativePermissionStatus()
  );

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

  const refreshPermissions = () => {
    if (isNativeRemindersAvailable()) {
      const status = getNativePermissionStatus();
      setPermissionStatus(status);
    }
  };

  React.useEffect(() => {
    if (!isNative) return;
    refreshPermissions();
    window.addEventListener('focus', refreshPermissions);
    return () => window.removeEventListener('focus', refreshPermissions);
  }, [isNative]);

  const handleTestAlarm = () => {
    const success = scheduleTestAlarm();
    if (success) {
      showToast('১ মিনিট পর টেস্ট অ্যালার্ম সফলভাবে শিডিউল করা হয়েছে (Android AlarmManager)', 'success');
    } else {
      showToast('টেস্ট অ্যালার্ম শিডিউল করা যায়নি। দয়া করে পারমিশন চেক করুন।', 'alert');
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          সেটিংস ও প্রোফাইল ব্যবস্থাপনা
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          পারিবারিক সদস্য, রিমাইন্ডার পছন্দ ও ব্যাকআপ সংক্রান্ত সেটিংস
        </p>
      </div>

      {/* Section 1: Family Member Profiles */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              পারিবারিক রোগী প্রোফাইল
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateProfileModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন সদস্য যোগ করুন</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-teal-300 dark:border-teal-700/60 rounded-xl text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              এখনও কোনো রোগী প্রোফাইল তৈরি করা হয়নি
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              পরিবারের যেকোনো সদস্যের (যেমন: নিজের, বাবা, মা, সন্তান) জন্য আনলিমিটেড প্রোফাইল তৈরি ও পরিচালনা করতে পারবেন।
            </p>
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
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
                      ? 'border-teal-600 bg-teal-50/40 dark:bg-teal-950/30 ring-1 ring-teal-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                        {p.relation}
                      </span>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="text-[11px] font-bold text-teal-700 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded">
                            সক্রিয়
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditProfileModal(p);
                          }}
                          className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </h3>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                      <div>বয়স: {toBengaliNumber(p.age)} বছর · রক্ত: {p.bloodGroup}</div>
                      <div>জরুরি: {p.emergencyContact}</div>
                    </div>

                    {p.chronicConditions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 block mb-0.5">দীর্ঘমেয়াদী রোগ:</span>
                        <span>{p.chronicConditions.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
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
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Sun className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            ডিসপ্লে ও থিম পছন্দ (Display & Accessibility)
          </h2>
        </div>

        <div className="space-y-4 text-xs sm:text-sm">
          {/* Dark Mode Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              কালার থিম (Theme Mode)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light' as const, label: 'লাইট মোড', icon: Sun },
                { id: 'dark' as const, label: 'ডার্ক মোড', icon: Moon },
                { id: 'system' as const, label: 'ডিভাইস অটো', icon: Monitor },
              ].map((theme) => {
                const Icon = theme.icon;
                const isSelected = (settings.themeMode || 'system') === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateSettings({ themeMode: theme.id })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 shadow-xs ring-1 ring-teal-500/40'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Elderly Large Font Mode */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block flex items-center gap-1.5">
                <Type className="w-4 h-4 text-teal-600" />
                বয়স্কদের জন্য সহজ পাঠ ও বড় ফন্ট মোড (Large Font Mode)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                অ্যাপের বাটন ও টেক্সট আকারে বড় হবে যাতে প্রবীণরা সহজে পড়তে পারেন
              </span>
            </div>

            <button
              type="button"
              onClick={() => updateSettings({ largeFontMode: !settings.largeFontMode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                settings.largeFontMode ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.largeFontMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Switcher (Step 5) */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-teal-600" />
                {isBn ? 'ভাষা নির্বাচন (Language)' : 'Application Language'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isBn ? 'বাংলা অথবা ইংরেজিতে অ্যাপ প্রদর্শন করুন' : 'Display the app interface in Bengali or English'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'bn' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  (settings.language || 'bn') === 'bn'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  settings.language === 'en'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Family Emergency Contact for Overdue Doses (Step 4) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Phone className="w-5 h-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isBn ? 'জরুরি পারিবারিক যোগাযোগ (ডোজ মিস সতর্কতা)' : 'Emergency Family Contact (Overdue Doses)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isBn
                ? 'কোনো ডোজ ৩০ মিনিটের বেশি পার হয়ে গেলে ড্যাশবোর্ডে "পরিবারকে জানান" বাটনে ক্লিক করে দ্রুত এই নম্বরে এসএমএস বা হোয়াটসঅ্যাপ পাঠানো যাবে।'
                : 'When a dose is over 30 minutes overdue, dashboard alert lets you send a quick SMS/WhatsApp to this family contact.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEmergencyContact} className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'পারিবারিক সদস্যের নাম' : 'Family Member / Caregiver Name'}
              </label>
              <input
                type="text"
                placeholder={isBn ? 'উদা: মো. তারেক (বড় ছেলে)' : 'e.g. John Doe (Son)'}
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'জরুরি মোবাইল নম্বর' : 'Emergency Mobile Phone Number'}
              </label>
              <input
                type="tel"
                placeholder={isBn ? 'উদা: 01711234567 বা +8801711234567' : 'e.g. +8801711234567'}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBn
                ? '* গোপনীয়তা সুরক্ষা: অ্যাপ কখনো নিজে থেকে সরাসরি এসএমএস পাঠায় না; ব্যবহারকারী ক্লিক করার পর ফোনের মেসেজিং অ্যাপ খোলে।'
                : '* Privacy: The app never sends messages automatically; it opens your phone messaging app for manual confirmation.'}
            </span>

            <button
              type="submit"
              disabled={isSavingContact}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Contact'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Section 2: Reminder Preferences */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Bell className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            রিমাইন্ডার ও নোটিফিকেশন পছন্দ
          </h2>
        </div>

        <div className="space-y-4 text-xs sm:text-sm">
          
          {/* Sound Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                অডিও সংকেত (Audio Tone)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ডোজ গ্রহণের নির্ধারিত সময়ে নরম বেল বা চাইম সংকেত বাজবে
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => playAlertTone(settings.selectedTone)}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>টেস্ট করুন</span>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  settings.soundEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
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

          {/* Tone Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              { id: 'soft-bell' as const, label: 'নরম সংকেত (Soft Bell)' },
              { id: 'chime' as const, label: 'সুমিষ্ট চাইম (Chime)' },
              { id: 'digital-beep' as const, label: 'ডিজিটাল বিপ (Gentle Beep)' },
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
                    ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-xs">{tone.label}</div>
              </button>
            ))}
          </div>

          {/* Advance Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                খাবারের কত মিনিট পূর্বে অগ্রিম স্মরণ করাবে?
              </label>
              <select
                value={settings.advanceMinutes}
                onChange={(e) => updateSettings({ advanceMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value={0}>নির্দিষ্ট সময়েই (০ মিনিট)</option>
                <option value={10}>১০ মিনিট পূর্বে</option>
                <option value={15}>১৫ মিনিট পূর্বে</option>
                <option value={30}>৩০ মিনিট পূর্বে (গ্যাস্ট্রিকের ওষুধের জন্য আদর্শ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                স্নুজ সময়কাল (Snooze Duration)
              </label>
              <select
                value={settings.snoozeDurationMinutes}
                onChange={(e) => updateSettings({ snoozeDurationMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value={5}>৫ মিনিট</option>
                <option value={10}>১০ মিনিট</option>
                <option value={15}>১৫ মিনিট</option>
              </select>
            </div>
          </div>

          {/* Phone Alarm Card (Requirement 4: শুধু Android APK WebView-তে দেখাবে) */}
          {isNative && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      ফোন অ্যালার্ম (Android APK নেটিভ রিমাইন্ডার)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      সরাসরি অ্যান্ড্রয়েড অ্যালার্ম ম্যানেজারের মাধ্যমে অ্যালার্ম ও শব্দ নিশ্চিত করার পারমিশন
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshPermissions}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer self-start sm:self-auto"
                >
                  অবস্থা রিফ্রেশ
                </button>
              </div>

              {/* 3 Permissions status with action buttons */}
              <div className="space-y-2.5 text-xs">
                {/* 1. Exact Alarm */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.exactAlarm
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {permissionStatus?.exactAlarm ? '✓ সক্রিয়' : '✕ বন্ধ'}
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        নির্ধারিত সময়ে অ্যালার্ম (Exact Alarm)
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        সঠিক মিনিট ও সেকেন্ডে অ্যালার্ম বাজার জন্য প্রয়োজন
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
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      অনুমতি ঠিক করুন
                    </button>
                  )}
                </div>

                {/* 2. Notifications */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.notifications
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {permissionStatus?.notifications ? '✓ সক্রিয়' : '✕ বন্ধ'}
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        সিস্টেম নোটিফিকেশন (Notifications)
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        নোটিফিকেশন প্যানেলে ওষুধের ডোজ ও সময় প্রদর্শনের জন্য
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
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      অনুমতি দিন
                    </button>
                  )}
                </div>

                {/* 3. Battery Unrestricted */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        permissionStatus?.batteryUnrestricted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {permissionStatus?.batteryUnrestricted ? '✓ সক্রিয়' : '✕ সীমাবদ্ধ'}
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        ব্যাটারি অপ্টিমাইজেশন ছাড় (Battery Unrestricted)
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        স্ক্রিন বন্ধ বা স্লিপ মোডে অ্যালার্ম মিস হওয়া ঠেকায়
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
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors self-end sm:self-auto"
                    >
                      সেটিংস খুলুন
                    </button>
                  )}
                </div>
              </div>

              {/* Test Alarm Action */}
              <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-teal-950 dark:text-teal-200 block">
                    অ্যালার্ম কার্যকারিতা পরীক্ষা
                  </span>
                  <span className="text-[11px] text-teal-800 dark:text-teal-300">
                    ফোনের সাউন্ড ও রিং পরীক্ষা করতে এখুনি টেস্ট শিডিউল করুন
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleTestAlarm}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-300" />
                  <span>১ মিনিট পর টেস্ট অ্যালার্ম</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Cloud Account & Firestore Storage Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ক্লাউড ফায়ারবেস স্টোরেজ ও অ্যাকাউন্ট
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ক্লাউড ফায়ারস্টোর ডাটাবেজে আপনার ওষুধ ও স্বাস্থ্য ইতিহাস সংরক্ষিত ও নিরাপদ থাকে
            </p>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
            ✓ ফায়ারবেস সংযুক্ত
          </span>
        </div>

        {currentUser ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-teal-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center font-bold text-lg">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentUser.displayName || 'ব্যবহারকারী'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentUser.email}
                  </p>
                  <p className="text-[11px] text-teal-700 dark:text-teal-400 font-mono mt-0.5">
                    UID: {currentUser.uid}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={syncLocalToCloud}
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'ক্লাউড সিঙ্ক করুন'}
                </button>
                <button
                  type="button"
                  onClick={signOutUser}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 cursor-pointer"
                >
                  লগআউট
                </button>
              </div>
            </div>

            <div className="p-3 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 rounded-lg text-xs text-teal-900 dark:text-teal-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                আপনার প্রতিটি ওষুধ, রিমাইন্ডার ও সেবনের হিস্ট্রি ফায়ারস্টোর সিকিউরিটি রুলস দ্বারা সুরক্ষিত এবং শুধুমাত্র আপনার একাউন্ট থেকেই অ্যাক্সেসযোগ্য।
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              আপনি বর্তমানে অতিথি (Guest) মোডে আছেন
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              যেকোনো ডিভাইসে আপনার ওষুধ ও হিস্ট্রি সুরক্ষিত রাখতে এবং রিয়েল-টাইম ক্লাউড সিঙ্ক চালু করতে গুগল বা ইমেইল দিয়ে লগইন করুন।
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs cursor-pointer"
            >
              লগইন বা নতুন অ্যাকাউন্ট তৈরি
            </button>
          </div>
        )}
      </section>

      {/* Section 3: Data Management */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
          ডাটা ব্যাকআপ ও নিয়ন্ত্রণ
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <strong className="block text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
              ডাটা ব্যাকআপ এক্সপোর্ট (JSON)
            </strong>
            <span className="text-slate-500 dark:text-slate-400">
              আপনার সমস্ত ওষুধের তালিকা, পরিবারের সদস্য ও সেবন ইতিহাস একটি ফাইলে ডাউনলোড করুন
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>JSON ব্যাকআপ ডাউনলোড</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <strong className="block text-sm font-semibold text-rose-600 dark:text-rose-400 mb-0.5">
              সব ডেটা মুছে নতুন করে শুরু করুন
            </strong>
            <span className="text-slate-500 dark:text-slate-400">
              অ্যাপের সংরক্ষিত সমস্ত ওষুধ, সেবন ইতিহাস, প্রোফাইল ও সেটিংস মুছে একদম নতুন করে শুরু করবে
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'আপনি কি নিশ্চিত যে সমস্ত ওষুধ, ইতিহাস, প্রোফাইল ও সেটিংস মুছে একদম নতুন করে শুরু করতে চান? এই কাজটি আর ফেরানো যাবে না।'
                )
              ) {
                resetAllData();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>সব মুছে নতুন শুরু করুন</span>
          </button>
        </div>
      </section>

      {/* Section 4: Android App & APK Installation Guide */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              মোবাইলে অ্যাপ ইনস্টলেশন ও APK গাইড
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded">
            PWA ও Android
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* Method 1: Direct PWA Install */}
          <div className="p-4 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-teal-950 dark:text-teal-200">
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">১</span>
              <span>পদ্ধতি ১: মোবাইলে সরাসরি "Install App" (সবচেয়ে সহজ ও তাৎক্ষণিক)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              আলাদা APK ডাউনলোড বা ফাইল ম্যানেজারের জটিলতা ছাড়াই আপনি সরাসরি আপনার অ্যান্ড্রয়েড বা আইফোনে অ্যাপটি ইনস্টল করতে পারবেন:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 pl-1">
              <li>ফোনের <strong>Chrome</strong> বা <strong>Safari</strong> ব্রাউজারে স্বাস্থ্যবন্ধু অ্যাপের লিংকটি ওপেন করুন।</li>
              <li>ব্রাউজারের ডানদিকের থ্রি-ডট মেনু (<strong>⋮</strong>) অথবা শেয়ার আইকনে চাপুন।</li>
              <li><strong>"Install app"</strong> অথবা <strong>"Add to Home Screen (হোম স্ক্রিনে যোগ করুন)"</strong> নির্বাচন করুন।</li>
              <li>কয়েক সেকেন্ডের মধ্যে এটি একটি পূর্ণাঙ্গ নেটিভ অ্যাপ হিসেবে আপনার ফোনের হোম স্ক্রিন ও অ্যাপ ড্রয়ারে চলে আসবে।</li>
            </ol>
          </div>

          {/* Method 2: Android Studio Native APK Build */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px]">২</span>
              <span>পদ্ধতি ২: সোর্স কোড থেকে অফিশিয়াল Android APK বিল্ড করা</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              স্বাস্থ্যবন্ধু প্রজেক্টের রুট ডিরেক্টরিতে ইতিমধ্যে একটি সম্পূর্ণ নেটিভ অ্যান্ড্রয়েড প্রকল্প (<strong>/android</strong> ফোল্ডার) অন্তর্ভুক্ত রয়েছে, যার প্যাকেজ নেম <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px]">com.shasthobondhu.app</code> এবং এতে সঠিক সময়ের অ্যালার্ম ও ব্যাকগ্রাউন্ড অ্যালার্টের জন্য <em>AlarmManager</em> ও <em>Foreground Service</em> কোড রয়েছে।
            </p>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono text-[11px]">
              <div className="text-slate-500 font-sans font-semibold mb-1">APK তৈরির সহজ ধাপসমূহ:</div>
              <div>১. প্রজেক্টের কোড ডাউনলোড করে কম্পিউটারে <strong>Android Studio</strong> ওপেন করুন।</div>
              <div>২. <strong>Open Project</strong> এ ক্লিক করে অ্যাপের <strong>/android</strong> ফোল্ডারটি নির্বাচন করুন।</div>
              <div>৩. উপরের মেনু থেকে <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong> নির্বাচন করুন।</div>
              <div className="text-teal-700 dark:text-teal-400 font-sans font-semibold pt-1">
                ➔ বিল্ড শেষে <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">android/app/build/outputs/apk/debug/app-debug.apk</code> ফাইলে সরাসরি ইনস্টলেবল APK পাওয়া যাবে।
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              * নোট: ক্লাউড ওয়েব কন্টেইনারে সরাসরি গিগাবাইট সাইজের Android SDK ও Gradle রানটাইম চলে না, তাই বাস্তব অ্যান্ড্রয়েড APK ফাইল পিসিতে Android Studio বা কমান্ড লাইনের মাধ্যমে তৈরি হয়।
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Healthcare Disclaimer & About */}
      <section className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-xs text-slate-600 dark:text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>দায়িত্ব অস্বীকার ও স্বাস্থ্য সতর্কতা</span>
        </div>
        <p className="leading-relaxed">
          "স্বাস্থ্যবন্ধু" আপনার ওষুধের সময়সূচি মনে রাখা এবং সেবনের ধারাবাহিকতা সংরক্ষণের একটি সহায়ক ডিজিটাল টুল। এটি কোনো নিবন্ধিত রেজিস্টার্ড চিকিৎসকের বিকল্প নয়। ওষুধের ডোজ বৃদ্ধি, হ্রাস বা বন্ধ করার পূর্বে সর্বদা আপনার ডাক্তারের পরামর্শ নিন।
        </p>
        <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>স্বাস্থ্যবন্ধু (Shasthobondhu) v১.০ · বাংলা হেলথকেয়ার প্ল্যাটফর্ম</span>
          <span>© ২০২৬ স্বাস্থ্যবন্ধু</span>
        </div>
      </section>

    </div>
  );
};
