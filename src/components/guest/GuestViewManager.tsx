import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GuestViewDoc, GuestViewExpiryHours } from '../../types';
import {
  GUEST_VIEW_EXPIRY_OPTIONS,
  GUEST_VIEW_SLOTS,
  buildGuestViewSnapshot,
  buildGuestViewUrl,
  buildGuestViewWhatsAppUrl,
  generateGuestViewToken,
  getGuestViewStatus,
} from '../../utils/guestViews';
import { formatSharedReportDateTime, toMillisSafe } from '../../utils/sharedReports';
import {
  createGuestViewInSupabase,
  deleteGuestViewInSupabase,
  fetchOwnerGuestViewsFromSupabase,
  revokeGuestViewInSupabase,
  updateGuestViewSnapshotInSupabase,
} from '../../supabase/sharingService';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Eye,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';

export const GuestViewManager: React.FC = () => {
  const {
    patients,
    activePatient,
    medicines,
    currentUser,
    openAuthModal,
    openCreateProfileModal,
    setCurrentPage,
    showToast,
  } = useMedicine();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    () => activePatient?.id || patients[0]?.id || ''
  );
  const [expiryHours, setExpiryHours] = useState<GuestViewExpiryHours>(168);
  const [guestViews, setGuestViews] = useState<GuestViewDoc[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [createdView, setCreatedView] = useState<GuestViewDoc | null>(null);
  const [manualCopyToken, setManualCopyToken] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPatientId && (activePatient?.id || patients[0]?.id)) {
      setSelectedPatientId(activePatient?.id || patients[0]?.id || '');
    }
  }, [selectedPatientId, activePatient, patients]);

  const selectedPatient = useMemo(
    () =>
      patients.find((p) => p.id === selectedPatientId) ||
      activePatient ||
      patients[0] ||
      null,
    [patients, selectedPatientId, activePatient]
  );

  const slotCounts = useMemo(() => {
    if (!selectedPatient) return { total: 0, bySlot: { সকাল: 0, দুপুর: 0, সন্ধ্যা: 0, রাত: 0 } };
    const snap = buildGuestViewSnapshot(selectedPatient, medicines);
    const bySlot = {
      সকাল: snap.slots['সকাল'].length,
      দুপুর: snap.slots['দুপুর'].length,
      সন্ধ্যা: snap.slots['সন্ধ্যা'].length,
      রাত: snap.slots['রাত'].length,
    };
    return {
      total: bySlot.সকাল + bySlot.দুপুর + bySlot.সন্ধ্যা + bySlot.রাত,
      bySlot,
    };
  }, [selectedPatient, medicines]);

  const loadGuestViews = useCallback(async () => {
    if (!currentUser) return;
    setLoadingList(true);
    setListError(null);
    try {
      const items = await fetchOwnerGuestViewsFromSupabase();
      setGuestViews(items);
    } catch (err: any) {
      setListError(err?.message || 'অতিথি লিংকের তালিকা লোড করা যায়নি।');
    } finally {
      setLoadingList(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      void loadGuestViews();
    } else {
      setGuestViews([]);
    }
  }, [currentUser, loadGuestViews]);

  const handleCopyUrl = async (token: string) => {
    const url = buildGuestViewUrl(token);
    setManualCopyToken(null);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        setCopiedToken(token);
        showToast('অতিথি দেখার লিংক কপি হয়েছে', 'success');
        setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 2500);
        return;
      }
      throw new Error('Clipboard unavailable');
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
          showToast('অতিথি দেখার লিংক কপি হয়েছে', 'success');
          setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 2500);
          return;
        }
      } catch {
        // ignore fallback
      }
      setManualCopyToken(token);
      showToast('নিচের লিংকটি চেপে ধরে কপি করুন', 'info');
    }
  };

  const handleCreate = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (!selectedPatient) {
      showToast('প্রথমে একটি রোগীর প্রোফাইল তৈরি বা নির্বাচন করুন।', 'alert');
      return;
    }

    setIsCreating(true);
    try {
      const token = generateGuestViewToken();
      const snapshot = buildGuestViewSnapshot(selectedPatient, medicines);
      const saved = await createGuestViewInSupabase({
        token,
        patientName: selectedPatient.name,
        snapshot,
        expiryHours,
      });
      setCreatedView(saved);
      setGuestViews((prev) => [saved, ...prev.filter((item) => item.token !== saved.token)]);
      showToast('অতিথি দেখার লিংক তৈরি হয়েছে', 'success');
    } catch (err: any) {
      showToast(err?.message || 'অতিথি লিংক তৈরি করা যায়নি।', 'alert');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefreshSnapshot = async (view: GuestViewDoc) => {
    const matchedPatient =
      patients.find((p) => p.name.trim() === view.patientName.trim()) ||
      selectedPatient ||
      patients[0];
    if (!matchedPatient) {
      showToast('হালনাগাদ করার জন্য কোনো রোগীর প্রোফাইল পাওয়া যায়নি।', 'alert');
      return;
    }

    setBusyToken(view.token);
    try {
      const freshSnapshot = buildGuestViewSnapshot(matchedPatient, medicines);
      const updated = await updateGuestViewSnapshotInSupabase(
        view.token,
        matchedPatient.name,
        freshSnapshot
      );
      setGuestViews((prev) =>
        prev.map((item) => (item.token === view.token ? updated : item))
      );
      if (createdView?.token === view.token) {
        setCreatedView(updated);
      }
      showToast('অতিথি দেখার তালিকা হালনাগাদ হয়েছে', 'success');
    } catch (err: any) {
      showToast(err?.message || 'হালনাগাদ করা যায়নি।', 'alert');
    } finally {
      setBusyToken(null);
    }
  };

  const handleRevoke = async (token: string) => {
    setBusyToken(token);
    try {
      await revokeGuestViewInSupabase(token);
      setGuestViews((prev) =>
        prev.map((item) => (item.token === token ? { ...item, active: false } : item))
      );
      if (createdView?.token === token) {
        setCreatedView((prev) => (prev ? { ...prev, active: false } : null));
      }
      showToast('অতিথি লিংকটি বাতিল করা হয়েছে', 'success');
    } catch (err: any) {
      showToast(err?.message || 'লিংকটি বাতিল করা যায়নি।', 'alert');
    } finally {
      setBusyToken(null);
    }
  };

  const handleDelete = async (token: string) => {
    setBusyToken(token);
    try {
      await deleteGuestViewInSupabase(token);
      setGuestViews((prev) => prev.filter((item) => item.token !== token));
      if (createdView?.token === token) {
        setCreatedView(null);
      }
      showToast('অতিথি লিংকটি মুছে ফেলা হয়েছে', 'success');
    } catch (err: any) {
      showToast(err?.message || 'লিংকটি মুছে ফেলা যায়নি।', 'alert');
    } finally {
      setBusyToken(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('me')}
            aria-label="ফিরে যান"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              <span>অতিথি দেখার লিংক</span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              মা-বাবা বা পরিবারের বয়স্ক সদস্যের ফোনে লগইন ছাড়াই শুধু দৈনিক ওষুধের রুটিন দেখার লিংক দিন
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 rounded-2xl bg-primary-soft border border-primary/25 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-text space-y-1">
          <p className="font-bold">শুধু দৈনিক ওষুধের তালিকা দেখা যাবে (গোপনীয়তা সুরক্ষিত)</p>
          <p className="text-text-muted leading-relaxed">
            এই লিংকে শুধু রোগীর নাম ও সকাল, দুপুর, সন্ধ্যা, রাতের ওষুধের নাম, মাত্রা ও খাবার নিয়ম দেখা যাবে। কোনো ফোন নম্বর, স্বাস্থ্য রেকর্ড বা প্রেসক্রিপশন ছবি থাকবে না এবং কেউ কোনো তথ্য বদলাতে পারবে না।
          </p>
        </div>
      </div>

      {/* Create New Guest Link */}
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        {!currentUser ? (
          <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-base text-text">অতিথি লিংক তৈরি করতে লগইন প্রয়োজন</p>
              <p className="text-sm text-text-muted">
                লগইন করলে লিংক তৈরি, হালনাগাদ ও যেকোনো সময় বাতিল করতে পারবেন।
              </p>
            </div>
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Lock className="w-4 h-4" />
              <span>লগইন করুন</span>
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface-2 text-center space-y-3">
            <p className="font-bold text-text">প্রথমে একজন রোগীর প্রোফাইল তৈরি করুন</p>
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>প্রোফাইল তৈরি করুন</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  কোন সদস্যের রুটিন দেখাবেন?
                </label>
                <select
                  value={selectedPatient?.id || ''}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base font-semibold text-text focus:outline-hidden focus:border-primary"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  লিংকের মেয়াদ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GUEST_VIEW_EXPIRY_OPTIONS.map((opt) => {
                    const active = expiryHours === opt.hours;
                    return (
                      <button
                        key={opt.hours}
                        type="button"
                        onClick={() => setExpiryHours(opt.hours)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-primary border-primary text-on-primary'
                            : 'bg-surface-2 border-border text-text hover:border-primary/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedPatient && (
              <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-bold text-text">
                    {selectedPatient.name}-এর সক্রিয় রুটিন:
                  </span>{' '}
                  <span className="text-text-muted">
                    মোট {toBengaliNumber(slotCounts.total)}টি ডোজ ({GUEST_VIEW_SLOTS.map((s) => `${s} ${toBengaliNumber(slotCounts.bySlot[s])}`).join(' · ')})
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreate}
                  className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-on-primary font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-5 h-5" />
                  <span>{isCreating ? 'তৈরি হচ্ছে...' : 'অতিথি দেখার লিংক তৈরি করুন'}</span>
                </button>
              </div>
            )}

            {createdView && (
              <div className="p-4 rounded-xl bg-success-soft border border-success/35 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-bold text-success-text">
                    নতুন অতিথি দেখার লিংক তৈরি হয়েছে ✓
                  </p>
                  <span className="text-xs font-semibold text-text-muted">
                    {createdView.patientName} · মেয়াদ: {formatSharedReportDateTime(createdView.expiresAtMs || toMillisSafe(createdView.expiresAt))}
                  </span>
                </div>

                <input
                  type="text"
                  readOnly
                  value={buildGuestViewUrl(createdView.token)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-xs font-mono text-text"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(createdView.token)}
                    className="min-h-[48px] px-4 py-2 rounded-xl bg-surface border border-border hover:border-primary text-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedToken === createdView.token ? (
                      <>
                        <Check className="w-4 h-4 text-success-text" />
                        <span>কপি হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-primary" />
                        <span>লিংক কপি করুন</span>
                      </>
                    )}
                  </button>

                  <a
                    href={buildGuestViewWhatsAppUrl(
                      buildGuestViewUrl(createdView.token),
                      createdView.patientName
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>হোয়াটসঅ্যাপে পাঠান</span>
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Owner's Guest Links List */}
      {currentUser && (
        <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text">আমার তৈরি করা অতিথি লিংক</h2>
              <p className="text-xs sm:text-sm text-text-muted">
                ওষুধ বদলালে "হালনাগাদ করো" চাপুন বা প্রয়োজনে লিংক বাতিল করুন
              </p>
            </div>
            <button
              type="button"
              onClick={loadGuestViews}
              disabled={loadingList}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-2 hover:bg-border/60 text-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          {listError ? (
            <div className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold">
              {listError}
            </div>
          ) : loadingList && guestViews.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">তালিকা লোড হচ্ছে...</p>
          ) : guestViews.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center bg-surface-2 rounded-xl">
              এখনো কোনো অতিথি দেখার লিংক তৈরি করা হয়নি।
            </p>
          ) : (
            <div className="space-y-3">
              {guestViews.map((view) => {
                const status = getGuestViewStatus(view);
                const updatedMs = view.updatedAtMs || toMillisSafe(view.updatedAt);
                const expiresMs = view.expiresAtMs || toMillisSafe(view.expiresAt);
                const url = buildGuestViewUrl(view.token);
                const isBusy = busyToken === view.token;

                return (
                  <div
                    key={view.token}
                    className="p-4 rounded-xl border border-border bg-surface-2/70 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-text truncate">
                          {view.patientName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                          <span
                            className={`font-bold ${
                              status === 'active'
                                ? 'text-success-text'
                                : status === 'revoked'
                                ? 'text-danger-text'
                                : 'text-text-muted'
                            }`}
                          >
                            {status === 'active'
                              ? 'সক্রিয়'
                              : status === 'revoked'
                              ? 'বাতিলকৃত'
                              : 'মেয়াদ শেষ'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>শেষ হালনাগাদ: {formatSharedReportDateTime(updatedMs)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>মেয়াদ: {formatSharedReportDateTime(expiresMs)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {manualCopyToken === view.token && (
                      <input
                        type="text"
                        readOnly
                        value={url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-warning/40 text-xs font-mono text-text"
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(view.token)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-primary text-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedToken === view.token ? (
                              <>
                                <Check className="w-4 h-4 text-success-text" />
                                <span>কপি হয়েছে</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 text-primary" />
                                <span>লিংক কপি</span>
                              </>
                            )}
                          </button>

                          <a
                            href={buildGuestViewWhatsAppUrl(url, view.patientName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm inline-flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>হোয়াটসঅ্যাপ</span>
                          </a>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRefreshSnapshot(view)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-primary-soft border border-primary/25 text-primary font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>হালনাগাদ করো</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRevoke(view.token)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-danger-soft border border-danger/30 text-danger-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>বাতিল করো</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(view.token)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface border border-border hover:bg-danger-soft text-text-muted hover:text-danger-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>মুছে ফেলো</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
