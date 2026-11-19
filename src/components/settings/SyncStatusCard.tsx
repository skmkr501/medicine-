import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  CloudOff,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';

export const SyncStatusCard: React.FC = () => {
  const {
    currentUser,
    isSyncing,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    triggerManualSync,
    openAuthModal,
  } = useMedicine();

  if (!currentUser) {
    return (
      <div className="p-5 bg-surface-2 rounded-2xl border border-border space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-surface border border-border text-text-muted">
              <CloudOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-text">
                সিঙ্ক অবস্থা: অতিথি মোড (অফলাইন)
              </h3>
              <p className="text-[11px] text-text-muted">
                ক্লাউড ব্যাকআপ ও সিঙ্ক সুবিধা পেতে লগইন করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAuthModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            লগইন করুন
          </button>
        </div>
      </div>
    );
  }

  const isSyncInProgress = syncStatus === 'syncing' || isSyncing;
  const isSynced = syncStatus === 'synced' && !isSyncInProgress;
  const isOffline = syncStatus === 'offline' && !isSyncInProgress;

  return (
    <div className="p-5 bg-surface rounded-2xl border border-border shadow-xs space-y-4 text-xs">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-2xl shrink-0 ${
              isSynced
                ? 'bg-success-soft text-success-text'
                : isSyncInProgress
                ? 'bg-primary-soft text-primary'
                : isOffline
                ? 'bg-warning-soft text-warning-text'
                : 'bg-danger-soft text-danger-text'
            }`}
          >
            {isSynced ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : isSyncInProgress ? (
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            ) : isOffline ? (
              <CloudOff className="w-5 h-5 text-warning" />
            ) : (
              <AlertCircle className="w-5 h-5 text-danger" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-text">
                সিঙ্ক অবস্থা:
              </h3>
              {isSyncInProgress ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/25">
                  <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                  হচ্ছে
                </span>
              ) : isSynced ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-success-soft text-success-text border border-success/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  সিঙ্ক হয়েছে
                </span>
              ) : isOffline ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-warning-soft text-warning-text border border-warning/30">
                  অফলাইন (ইন্টারনেট এলে সিঙ্ক হবে)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-danger-soft text-danger-text border border-danger/30">
                  ব্যর্থ
                </span>
              )}
            </div>

            <p className="text-[11px] text-text-muted mt-0.5">
              {pendingSyncCount > 0
                ? `ফোনে ${toBengaliNumber(pendingSyncCount)}টি পরিবর্তন ক্লাউডে সিঙ্কের অপেক্ষায় আছে`
                : 'ফোন ও ক্লাউডের মধ্যে স্বয়ংক্রিয় অফলাইন সংরক্ষণ সক্রিয়'}
            </p>
          </div>
        </div>

        {/* Sync / Retry Action */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            disabled={isSyncInProgress}
            onClick={triggerManualSync}
            title="পরিবর্তিত ডেটা ক্লাউডে সিঙ্ক করুন"
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncInProgress ? 'animate-spin' : ''}`} />
            <span>{isSyncInProgress ? 'হচ্ছে...' : 'আবার চেষ্টা'}</span>
          </button>
        </div>
      </div>

      {/* Sync details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
          <span className="text-[11px] text-text-muted block font-medium">সংযুক্ত অ্যাকাউন্ট</span>
          <span className="font-bold text-text block truncate" title={currentUser.email || ''}>
            {currentUser.displayName || currentUser.email}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
          <span className="text-[11px] text-text-muted block font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>সর্বশেষ সিঙ্কের সময়</span>
          </span>
          <span className="font-bold text-primary block font-mono">
            {lastSyncedAt ? `${lastSyncedAt}` : 'এখনো সিঙ্ক হয়নি'}
          </span>
        </div>
      </div>

      {/* Offline resilience note */}
      <div className="p-3 bg-primary-soft border border-primary/20 rounded-xl text-[11px] text-text flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <span>
          অফলাইনে থাকা অবস্থায় যোগ করা বা পরিবর্তিত ডেটা ইন্টারনেট সংযুক্ত হলে স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হবে।
        </span>
      </div>
    </div>
  );
};
