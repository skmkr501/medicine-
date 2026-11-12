import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Cloud,
  CloudOff,
  Clock,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';

export const SyncStatusCard: React.FC = () => {
  const {
    currentUser,
    isSyncing,
    syncStatus,
    lastSyncedAt,
    triggerManualSync,
    openAuthModal,
  } = useMedicine();

  if (!currentUser) {
    return (
      <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <CloudOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                সিঙ্ক অবস্থা: অতিথি মোড (অফলাইন)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ক্লাউড ব্যাকআপ ও রিয়েল-টাইম সিঙ্ক সুবিধা পেতে লগইন করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAuthModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            লগইন করুন
          </button>
        </div>
      </div>
    );
  }

  const isSynced = syncStatus === 'synced';
  const isSyncInProgress = syncStatus === 'syncing' || isSyncing;
  const isOffline = syncStatus === 'offline';

  return (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 text-xs">
      
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-2xl shrink-0 ${
              isSynced
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                : isSyncInProgress
                ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                : isOffline
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
            }`}
          >
            {isSynced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : isSyncInProgress ? (
              <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-spin" />
            ) : isOffline ? (
              <CloudOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                সিঙ্ক অবস্থা:
              </h3>
              {isSynced ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ✓ সিঙ্ক হয়েছে
                </span>
              ) : isSyncInProgress ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <RefreshCw className="w-3 h-3 animate-spin text-teal-600" />
                  ⟳ চলছে
                </span>
              ) : isOffline ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  অফলাইন (ইন্টারনেট এলে সিঙ্ক হবে)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  ✕ ব্যর্থ
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ক্লাউডের সাথে স্বয়ংক্রিয় অফলাইন সংরক্ষণ ও সমন্বয়
            </p>
          </div>
        </div>

        {/* Sync Action */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            disabled={isSyncInProgress}
            onClick={triggerManualSync}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncInProgress ? 'animate-spin' : ''}`} />
            <span>{isSyncInProgress ? 'সিঙ্ক হচ্ছে...' : 'এখনই সিঙ্ক করুন'}</span>
          </button>
        </div>
      </div>

      {/* Sync details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 block font-medium">সংযুক্ত অ্যাকাউন্ট</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={currentUser.email || ''}>
            {currentUser.displayName || currentUser.email}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 block font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>সর্বশেষ সিঙ্কের সময়</span>
          </span>
          <span className="font-bold text-teal-700 dark:text-teal-400 block font-mono">
            {lastSyncedAt ? `${lastSyncedAt}` : 'এখনো সিঙ্ক হয়নি'}
          </span>
        </div>
      </div>

      {/* Security note */}
      <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50 rounded-xl text-[11px] text-teal-900 dark:text-teal-200 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
        <span>
          অফলাইনে থাকা অবস্থায় যোগ করা ওষুধ ও ডোজ লগ ইন্টারনেট সংযুক্ত হলে স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হবে।
        </span>
      </div>

    </div>
  );
};
