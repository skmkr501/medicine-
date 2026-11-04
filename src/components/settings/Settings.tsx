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
} from 'lucide-react';

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

          {/* Android Native Exact Alarm Configuration Box */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span>🤖</span> Android নেটিভ ব্যাকগ্রাউন্ড শিডিউলার ও পারমিশন
              </span>
              <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                Kotlin + AlarmManager
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              অ্যাপ বন্ধ বা ডিভাইস ডিপ স্লিপে (Doze Mode) থাকলেও অ্যালার্ম বাজাতে অ্যান্ড্রয়েডের <code className="text-teal-700 dark:text-teal-400 font-mono">AlarmManager.setAlarmClock()</code> এবং <code className="text-teal-700 dark:text-teal-400 font-mono">MedicineAlarmForegroundService</code> প্রস্তুত করা হয়েছে।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <strong className="block text-slate-700 dark:text-slate-300">Exact Alarm:</strong>
                <span className="text-slate-500">Android 12+ এ সঠিক মিনিটে বাজার পারমিশন</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <strong className="block text-slate-700 dark:text-slate-300">Auto Reboot Reschedule:</strong>
                <span className="text-slate-500">ফোন রিস্টার্ট হলেও শিডিউল অক্ষত থাকে</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <strong className="block text-slate-700 dark:text-slate-300">Offline Storage:</strong>
                <span className="text-slate-500">ইন্টারনেট ছাড়া সম্পূর্ণ অফলাইনে কার্যকর</span>
              </div>
            </div>

            <div className="text-[11px] text-amber-700 dark:text-amber-400 italic">
              * নোট: অ্যান্ড্রয়েড ব্যাকগ্রাউন্ড রিমাইন্ডার বাস্তব ডিভাইসে (Real Android Device) APK রান করে পরীক্ষা করতে হবে।
            </div>
          </div>

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
              প্রাথমিক ডেমো ডেটা রিসেট
            </strong>
            <span className="text-slate-500 dark:text-slate-400">
              অ্যাপের সমস্ত কাস্টম ডেটা মুছে প্রাথমিক উদাহরণ ওষুধ ও হিস্ট্রি ফিরিয়ে আনবে
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('আপনি কি নিশ্চিত যে সমস্ত ডেটা প্রাথমিক অবস্থায় রিসেট করতে চান?')) {
                resetAllData();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>রিসেট করুন</span>
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
