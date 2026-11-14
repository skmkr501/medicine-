import React, { useState, useCallback, useEffect } from 'react';
import { SharedReportDoc } from '../../types';
import { useMedicine } from '../../context/MedicineContext';
import {
  fetchOwnerSharedReportsFromCloud,
  revokeSharedReportInCloud,
  deleteSharedReportInCloud,
} from '../../firebase/services';
import {
  buildSharedReportUrl,
  canDeleteExpiredSharedReport,
  formatSharedReportDateTime,
  getIncludedSectionLabels,
  getSharedReportStatus,
  toMillisSafe,
} from '../../utils/sharedReports';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  Link2,
  Copy,
  Check,
  XCircle,
  Trash2,
  RefreshCw,
  Lock,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface MySharedLinksSectionProps {
  /** When false (e.g. inside Settings), waits until user expands/opens to fetch from Firestore */
  autoLoadOnMount?: boolean;
  /** Incrementing trigger from parent when a new report link is created */
  refreshSignal?: number;
}

export const MySharedLinksSection: React.FC<MySharedLinksSectionProps> = ({
  autoLoadOnMount = true,
  refreshSignal = 0,
}) => {
  const { currentUser, openAuthModal, showToast } = useMedicine();

  const [isOpen, setIsOpen] = useState(autoLoadOnMount);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reports, setReports] = useState<SharedReportDoc[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [manualCopyToken, setManualCopyToken] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const items = await fetchOwnerSharedReportsFromCloud(currentUser.uid);
      setReports(items);
      setHasLoadedOnce(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'শেয়ার করা লিংকগুলো লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen && currentUser && !hasLoadedOnce) {
      loadReports();
    }
  }, [isOpen, currentUser, hasLoadedOnce, loadReports]);

  useEffect(() => {
    if (refreshSignal > 0 && currentUser) {
      setIsOpen(true);
      loadReports();
    }
  }, [refreshSignal, currentUser, loadReports]);

  const handleCopy = async (token: string) => {
    const url = buildSharedReportUrl(token);
    setManualCopyToken(null);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        setCopiedToken(token);
        showToast('রিপোর্ট লিংক কপি হয়েছে', 'success');
        setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 2500);
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      try {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (ok) {
          setCopiedToken(token);
          showToast('রিপোর্ট লিংক কপি হয়েছে', 'success');
          setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 2500);
          return;
        }
      } catch {
        // Fall through to manual copy prompt
      }
      setManualCopyToken(token);
      showToast('নিচের লিংকটিতে লম্বা চেপে ধরে কপি করুন', 'info');
    }
  };

  const handleRevoke = async (token: string) => {
    setBusyToken(token);
    try {
      await revokeSharedReportInCloud(token);
      setReports((prev) =>
        prev.map((item) => (item.token === token ? { ...item, revoked: true } : item))
      );
      showToast('লিংকটি বাতিল করা হয়েছে — এখন থেকে কেউ আর দেখতে পারবে না', 'success');
    } catch (err: any) {
      showToast(err?.message || 'লিংক বাতিল করা যায়নি', 'alert');
    } finally {
      setBusyToken(null);
    }
  };

  const handleDeleteExpired = async (token: string) => {
    setBusyToken(token);
    try {
      await deleteSharedReportInCloud(token);
      setReports((prev) => prev.filter((item) => item.token !== token));
      showToast('পুরনো মেয়াদোত্তীর্ণ লিংকটি মুছে ফেলা হয়েছে', 'success');
    } catch (err: any) {
      showToast(err?.message || 'লিংকটি মুছে ফেলা যায়নি', 'alert');
    } finally {
      setBusyToken(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link2 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              আমার শেয়ার করা লিংক
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              তৈরি করা রিপোর্ট লিংক দেখুন বা প্রয়োজনে বাতিল করুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!autoLoadOnMount && !isOpen ? (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="min-h-[48px] px-4 py-2 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-bold text-sm rounded-xl hover:bg-teal-100 cursor-pointer"
            >
              তালিকা দেখুন
            </button>
          ) : (
            currentUser && (
              <button
                type="button"
                onClick={loadReports}
                disabled={loading}
                className="min-h-[48px] px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>রিফ্রেশ</span>
              </button>
            )
          )}
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {!currentUser ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                শেয়ার করা লিংকগুলো দেখতে আপনার অ্যাকাউন্টে লগইন করুন।
              </p>
              <button
                type="button"
                onClick={openAuthModal}
                className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>লগইন করুন</span>
              </button>
            </div>
          ) : loading && !hasLoadedOnce ? (
            <div className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
              শেয়ার করা লিংকগুলো আনা হচ্ছে...
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold">{errorMsg}</p>
                <button
                  type="button"
                  onClick={loadReports}
                  className="min-h-[44px] px-4 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-300">
              এখনো কোনো রিপোর্ট শেয়ার লিংক তৈরি করা হয়নি।
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const createdMs = report.createdAtMs || toMillisSafe(report.createdAt);
                const expiresMs = report.expiresAtMs || toMillisSafe(report.expiresAt);
                const status = getSharedReportStatus(report);
                const canDelete = canDeleteExpiredSharedReport(report);
                const sectionLabels = getIncludedSectionLabels(report.sections);
                const reportUrl = buildSharedReportUrl(report.token);

                return (
                  <div
                    key={report.token}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            {report.patientName}
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : status === 'revoked'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {status === 'active'
                              ? 'সক্রিয়'
                              : status === 'revoked'
                              ? 'বাতিলকৃত'
                              : 'মেয়াদ শেষ'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          অন্তর্ভুক্ত তথ্য: {sectionLabels.join(', ') || '—'}
                        </p>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 sm:text-right">
                        <div>তৈরি: {formatSharedReportDateTime(createdMs)}</div>
                        <div className="flex items-center gap-1 sm:justify-end">
                          <Clock className="w-3.5 h-3.5" />
                          <span>মেয়াদ: {formatSharedReportDateTime(expiresMs)}</span>
                        </div>
                      </div>
                    </div>

                    {manualCopyToken === report.token && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          নিচের লিংকটি লম্বা চেপে ধরে কপি করুন:
                        </p>
                        <input
                          type="text"
                          readOnly
                          value={reportUrl}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(report.token)}
                            className="min-h-[48px] px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-teal-500 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedToken === report.token ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span>কপি হয়েছে</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                                <span>লিংক কপি করুন</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={busyToken === report.token}
                            onClick={() => handleRevoke(report.token)}
                            className="min-h-[48px] px-4 py-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-rose-800 dark:text-rose-200 font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>বাতিল করুন</span>
                          </button>
                        </>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          disabled={busyToken === report.token}
                          onClick={() => handleDeleteExpired(report.token)}
                          className="min-h-[48px] px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-800 dark:text-slate-100 hover:text-rose-800 font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>
                            মুছে ফেলুন ({toBengaliNumber(30)}+ দিন মেয়াদোত্তীর্ণ)
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
