import React, { useState, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import {
  APP_VERSION,
  deleteFeedbackFromSupabase,
  deleteLibraryMissFromSupabase,
  fetchAdminActivities,
  fetchAdminOverviewStatsFromSupabase,
  fetchFeedbackFromSupabase,
  fetchImportBatches,
  fetchLibraryMissesForAdmin,
  updateLibraryMissResolved,
} from '../../supabase/libraryService';
import {
  createAnnouncementInSupabase,
  deleteAnnouncementInSupabase,
  fetchAllAnnouncementsForAdmin,
  toggleAnnouncementActiveInSupabase,
} from '../../supabase/announcementsService';
import { getSupabaseDataErrorMessageBn } from '../../supabase/userDataService';
import {
  AdminActivity,
  AdminOverviewStats,
  Announcement,
  AnnouncementLevel,
  FeedbackEntry,
  LibraryMiss,
} from '../../types';
import { checkAiHealth, AiHealthResponse } from '../../services/aiService';
import { AdminImportView } from './AdminImportView';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  ShieldCheck,
  Users,
  HeartPulse,
  BookOpen,
  UploadCloud,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  LogIn,
  Layers,
  ArrowRight,
  Activity,
  FileText,
  Trash2,
  Check,
  Sparkles,
  Plus,
  SlidersHorizontal,
  Cpu,
  KeyRound,
  XCircle,
  MessageSquare,
  Megaphone,
  SearchX,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    adminEmail,
    libraryMutationVersion,
    importBatches,
    patients,
    setCurrentPage,
    openAuthModal,
    openManualAddModal,
    openManualAddFromMiss,
    showToast,
  } = useMedicine();

  // Sub-tab Navigation: 'overview' | 'announcements' | 'misses' | 'import'
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements' | 'misses' | 'import'>('overview');

  // Real Dashboard Stats from Supabase admin_overview_stats RPC
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Admin Announcements State ("ঘোষণা")
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annLevel, setAnnLevel] = useState<AnnouncementLevel>('info');
  const [annStartsAt, setAnnStartsAt] = useState('');
  const [annEndsAt, setAnnEndsAt] = useState('');
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [busyAnnouncementId, setBusyAnnouncementId] = useState<string | null>(null);

  // Admin Library Misses State ("না পাওয়া ওষুধ")
  const [libraryMisses, setLibraryMisses] = useState<LibraryMiss[]>([]);
  const [loadingMisses, setLoadingMisses] = useState(false);
  const [busyMissId, setBusyMissId] = useState<string | null>(null);

  // Admin AI Health Diagnostic State
  const [aiHealth, setAiHealth] = useState<AiHealthResponse | null>(null);
  const [checkingAiHealth, setCheckingAiHealth] = useState<boolean>(false);

  const handleCheckAiHealth = async () => {
    if (checkingAiHealth) return;
    setCheckingAiHealth(true);
    try {
      const res = await checkAiHealth(true);
      setAiHealth(res);
    } finally {
      setCheckingAiHealth(false);
    }
  };

  // Load Real Data from Supabase
  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [overviewStats, batches, acts, feedbacks] = await Promise.all([
        fetchAdminOverviewStatsFromSupabase(),
        fetchImportBatches(),
        fetchAdminActivities(),
        fetchFeedbackFromSupabase(100),
      ]);

      setStats(overviewStats);
      setFeedbackList(feedbacks);

      if (acts.length > 0) {
        setActivities(acts);
      } else {
        const sourceBatches = batches.length > 0 ? batches : importBatches;
        const initialActivities: AdminActivity[] = sourceBatches.map((b) => ({
          id: `act_${b.id}`,
          type: 'import',
          title: `ওষুধ ডাটা ইমপোর্ট (${b.source})`,
          description: `${b.totalRecordsInFile} টি রেকর্ড প্রক্রিয়াজাত (${b.publishedCount} টি প্রকাশিত, লাইসেন্স: ${b.licenseReference})`,
          adminEmail: b.importedByEmail,
          timestamp: b.importedAt,
        }));
        setActivities(initialActivities);
      }

      setLastRefreshedAt(
        new Date().toLocaleTimeString('bn-BD', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } catch (err: any) {
      console.error('Error fetching admin dashboard data:', err);
      setError(getSupabaseDataErrorMessageBn(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnnouncementsAdmin = async () => {
    if (!isAdmin) return;
    setLoadingAnnouncements(true);
    try {
      const items = await fetchAllAnnouncementsForAdmin();
      setAnnouncements(items);
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const loadLibraryMissesAdmin = async () => {
    if (!isAdmin) return;
    setLoadingMisses(true);
    try {
      const items = await fetchLibraryMissesForAdmin(100);
      setLibraryMisses(items);
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setLoadingMisses(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadDashboardData();
      if (activeTab === 'announcements') {
        void loadAnnouncementsAdmin();
      } else if (activeTab === 'misses') {
        void loadLibraryMissesAdmin();
      }
    }
  }, [isAdmin, libraryMutationVersion, activeTab]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingAnnouncement) return;
    const cleanTitle = annTitle.trim();
    const cleanBody = annBody.trim();
    if (!cleanTitle || !cleanBody) {
      showToast('শিরোনাম ও মূল বার্তা লিখুন।', 'alert');
      return;
    }
    if (cleanTitle.length > 120 || cleanBody.length > 1000) {
      showToast('শিরোনাম সর্বোচ্চ ১২০ অক্ষর এবং মূল বার্তা ১০০০ অক্ষরের মধ্যে রাখুন।', 'alert');
      return;
    }
    setCreatingAnnouncement(true);
    try {
      const created = await createAnnouncementInSupabase({
        title: cleanTitle,
        body: cleanBody,
        level: annLevel,
        active: true,
        startsAt: annStartsAt ? new Date(annStartsAt).toISOString() : null,
        endsAt: annEndsAt ? new Date(annEndsAt).toISOString() : null,
      });
      setAnnouncements((prev) => [created, ...prev]);
      setAnnTitle('');
      setAnnBody('');
      setAnnLevel('info');
      setAnnStartsAt('');
      setAnnEndsAt('');
      showToast('নতুন ঘোষণা প্রকাশিত হয়েছে।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const handleToggleAnnouncementActive = async (ann: Announcement) => {
    if (busyAnnouncementId) return;
    setBusyAnnouncementId(ann.id);
    try {
      const nextActive = !ann.active;
      await toggleAnnouncementActiveInSupabase(ann.id, nextActive);
      setAnnouncements((prev) =>
        prev.map((item) => (item.id === ann.id ? { ...item, active: nextActive } : item))
      );
      showToast(nextActive ? 'ঘোষণাটি চালু করা হয়েছে।' : 'ঘোষণাটি সাময়িক বন্ধ করা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setBusyAnnouncementId(null);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (busyAnnouncementId) return;
    setBusyAnnouncementId(id);
    try {
      await deleteAnnouncementInSupabase(id);
      setAnnouncements((prev) => prev.filter((item) => item.id !== id));
      showToast('ঘোষণাটি মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setBusyAnnouncementId(null);
    }
  };

  const handleToggleMissResolved = async (miss: LibraryMiss) => {
    if (busyMissId) return;
    setBusyMissId(miss.id);
    try {
      const nextResolved = !miss.resolved;
      await updateLibraryMissResolved(miss.id, nextResolved);
      setLibraryMisses((prev) =>
        prev.map((item) => (item.id === miss.id ? { ...item, resolved: nextResolved } : item))
      );
      showToast(nextResolved ? 'সমাধান হয়েছে হিসেবে চিহ্নিত।' : 'অপেক্ষমাণ হিসেবে চিহ্নিত।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setBusyMissId(null);
    }
  };

  const handleDeleteMiss = async (id: string) => {
    if (busyMissId) return;
    setBusyMissId(id);
    try {
      await deleteLibraryMissFromSupabase(id);
      setLibraryMisses((prev) => prev.filter((item) => item.id !== id));
      showToast('রেকর্ডটি মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setBusyMissId(null);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (deletingFeedbackId) return;
    setDeletingFeedbackId(feedbackId);
    try {
      await deleteFeedbackFromSupabase(feedbackId);
      setFeedbackList((prev) => prev.filter((item) => item.id !== feedbackId));
      setStats((prev) =>
        prev
          ? { ...prev, feedbackCount: Math.max(0, (prev.feedbackCount ?? 0) - 1) }
          : prev
      );
      showToast('মতামতটি মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(getSupabaseDataErrorMessageBn(err), 'alert');
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  // Non-admin Security Lockdown Screen
  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="bg-surface rounded-3xl p-8 border border-border shadow-xl text-center space-y-5 max-w-lg w-full">
          <div className="w-16 h-16 rounded-2xl bg-danger-soft text-danger-text flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text">
              অ্যাডমিন অনুমোদন আবশ্যক
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              স্বাস্থ্যবন্ধু অ্যাপের অ্যাডমিন প্যানেল ও গ্লোবাল ব্যবস্থাপনা শুধুমাত্র অনুমোদিত অ্যাডমিনের জন্য সংরক্ষিত।
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUser ? (
              <div className="text-xs text-text-muted">
                বর্তমান অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>অ্যাডমিন হিসেবে লগইন করুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentPage('dashboard')}
              className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
            >
              মূল পাতায় ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  const adminSubTabs = (
    <div className="flex flex-wrap items-center gap-2 bg-surface border border-border rounded-2xl p-1.5 shadow-2xs">
      {[
        { id: 'overview' as const, label: 'ওভারভিউ', icon: ShieldCheck },
        { id: 'announcements' as const, label: 'ঘোষণা', icon: Megaphone },
        { id: 'misses' as const, label: 'না পাওয়া ওষুধ', icon: SearchX },
        { id: 'import' as const, label: 'ওষুধ ইমপোর্ট', icon: UploadCloud },
      ].map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              isActive
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  // If user selected the Import tab, render AdminImportView
  if (activeTab === 'import') {
    return (
      <div className="space-y-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-3">
          {adminSubTabs}
        </div>
        <AdminImportView />
      </div>
    );
  }

  // If user selected the Announcements tab ("ঘোষণা")
  if (activeTab === 'announcements') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {adminSubTabs}

        <section className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-text">ঘোষণা ব্যবস্থাপনা</h2>
                <p className="text-xs text-text-muted">
                  ব্যবহারকারীদের হোম স্ক্রিনে শুধু প্লেইন-টেক্সট ঘোষণা দেখান (কোনো HTML কোড নয়)
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={loadingAnnouncements}
              onClick={() => void loadAnnouncementsAdmin()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-surface-2 hover:bg-border text-text text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnnouncements ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          <form onSubmit={handleCreateAnnouncement} className="space-y-4 bg-surface-2 rounded-2xl p-4 sm:p-5 border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-text mb-1">
                  শিরোনাম (সর্বোচ্চ ১২০ অক্ষর)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="যেমন: নতুন স্বাস্থ্য ক্যালেন্ডার চালু হয়েছে"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">ধরন (Level)</label>
                <select
                  value={annLevel}
                  onChange={(e) => setAnnLevel(e.target.value as AnnouncementLevel)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                >
                  <option value="info">সাধারণ তথ্য (Info)</option>
                  <option value="warning">সতর্কতা (Warning)</option>
                  <option value="success">সুখবর / আপডেট (Success)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">
                মূল বার্তা (সর্বোচ্চ ১০০০ অক্ষর)
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="ব্যবহারকারীদের জন্য স্পষ্ট বাংলায় ঘোষণাটি লিখুন..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  শুরুর সময় (ঐচ্ছিক)
                </label>
                <input
                  type="datetime-local"
                  value={annStartsAt}
                  onChange={(e) => setAnnStartsAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-xs text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  শেষের সময় (ঐচ্ছিক)
                </label>
                <input
                  type="datetime-local"
                  value={annEndsAt}
                  onChange={(e) => setAnnEndsAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-xs text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creatingAnnouncement}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingAnnouncement ? 'প্রকাশ হচ্ছে...' : 'ঘোষণা প্রকাশ করুন'}</span>
              </button>
            </div>
          </form>

          {loadingAnnouncements ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-surface-2 text-xs text-text-muted">
              কোনো ঘোষণা তৈরি করা হয়নি।
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-2xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-text">{ann.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ann.level === 'warning'
                            ? 'bg-warning-soft text-warning-text border-warning/30'
                            : ann.level === 'success'
                            ? 'bg-success-soft text-success-text border-success/30'
                            : 'bg-primary-soft text-primary border-primary/30'
                        }`}
                      >
                        {ann.level === 'warning' ? 'সতর্কতা' : ann.level === 'success' ? 'সুখবর' : 'তথ্য'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ann.active
                            ? 'bg-success-soft text-success-text'
                            : 'bg-surface text-text-muted border border-border'
                        }`}
                      >
                        {ann.active ? 'সক্রিয়' : 'বন্ধ'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted whitespace-pre-wrap break-words">
                      {ann.body}
                    </p>
                    {(ann.startsAt || ann.endsAt) && (
                      <p className="text-[11px] text-text-muted">
                        সময়সীমা:{' '}
                        {ann.startsAt ? new Date(ann.startsAt).toLocaleString('bn-BD') : 'এখনই'} —{' '}
                        {ann.endsAt ? new Date(ann.endsAt).toLocaleString('bn-BD') : 'চলমান'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyAnnouncementId === ann.id}
                      onClick={() => void handleToggleAnnouncementActive(ann)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-bold text-text flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {ann.active ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5 text-warning-text" />
                          <span>বন্ধ রাখুন</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 text-success-text" />
                          <span>চালু করুন</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busyAnnouncementId === ann.id}
                      onClick={() => void handleDeleteAnnouncement(ann.id)}
                      className="min-h-[38px] p-2 rounded-xl bg-danger-soft text-danger-text border border-danger/25 hover:opacity-90 cursor-pointer disabled:opacity-50"
                      title="ঘোষণা মুছুন"
                      aria-label="ঘোষণা মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // If user selected the Library Misses tab ("না পাওয়া ওষুধ")
  if (activeTab === 'misses') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {adminSubTabs}

        <section className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-warning-soft text-warning-text">
                <SearchX className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-text">না পাওয়া ওষুধের তালিকা</h2>
                <p className="text-xs text-text-muted">
                  ব্যবহারকারীরা লাইব্রেরিতে খুঁজে পাননি এমন ওষুধের নাম ও খোঁজার সংখ্যা (ব্যক্তিগত তথ্যবিহীন)
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={loadingMisses}
              onClick={() => void loadLibraryMissesAdmin()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-surface-2 hover:bg-border text-text text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingMisses ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          {loadingMisses ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : libraryMisses.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-surface-2 text-xs text-text-muted">
              এখনো কোনো না পাওয়া ওষুধের তালিকা জমা হয়নি।
            </div>
          ) : (
            <div className="space-y-2.5">
              {libraryMisses.map((miss) => (
                <div
                  key={miss.id}
                  className="p-4 rounded-2xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-text break-all">
                        {miss.queryNorm}
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-soft text-primary">
                        {toBengaliNumber(miss.hitCount)} বার খোঁজা হয়েছে
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          miss.resolved
                            ? 'bg-success-soft text-success-text'
                            : 'bg-warning-soft text-warning-text'
                        }`}
                      >
                        {miss.resolved ? 'সমাধান হয়েছে' : 'অপেক্ষমাণ'}
                      </span>
                    </div>
                    {miss.lastSeen && (
                      <p className="text-[11px] text-text-muted">
                        সর্বশেষ খোঁজা হয়েছে: {new Date(miss.lastSeen).toLocaleString('bn-BD')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openManualAddFromMiss(miss)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>লাইব্রেরিতে যোগ করুন</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyMissId === miss.id}
                      onClick={() => void handleToggleMissResolved(miss)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-bold text-text flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-success-text" />
                      <span>{miss.resolved ? 'অপেক্ষমাণ করুন' : 'সমাধান চিহ্নিত করুন'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyMissId === miss.id}
                      onClick={() => void handleDeleteMiss(miss.id)}
                      className="min-h-[38px] p-2 rounded-xl bg-danger-soft text-danger-text border border-danger/25 hover:opacity-90 cursor-pointer disabled:opacity-50"
                      title="রেকর্ড মুছুন"
                      aria-label="রেকর্ড মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const totalFeedbackCount = stats?.feedbackCount ?? feedbackList.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {adminSubTabs}
      {/* 1. Header Banner & Identity */}
      <div className="bg-gradient-to-r from-[#312E81] via-[#3730A3] to-[#1E1B4B] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-400/15 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 rounded-full bg-rose-400/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white/10 text-indigo-200 backdrop-blur-xs">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/15 text-indigo-100 border border-white/25 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                প্রধান স্বাস্থ্য তথ্য প্রশাসন
              </span>
              <span className="text-xs text-indigo-200/80 font-mono hidden sm:inline">
                {currentUser?.email || adminEmail || 'অ্যাডমিন'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              স্বাস্থ্যবন্ধু অ্যাডমিন ওভারভিউ ড্যাশবোর্ড
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/85 max-w-2xl leading-relaxed">
              সিস্টেমের ব্যবহারকারী, রোগীর প্রোফাইল, ওষুধ ক্যাটালগ ও ক্লাউড ডাটাবেজের সার্বিক পর্যবেক্ষণ কেন্দ্র।
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => void loadDashboardData(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-xs rounded-xl backdrop-blur-xs border border-white/15 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="ক্লাউড ডাটাবেজ থেকে সরাসরি নতুন তথ্য লোড করুন"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'লাইভ রিফ্রেশ'}</span>
            </button>

            <button
              type="button"
              onClick={openManualAddModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              title="ফরম পূরণ করে একটি নতুন ওষুধ সরাসরি ডাটাবেজে যুক্ত করুন"
            >
              <Plus className="w-4 h-4" />
              <span>ম্যানুয়ালি ওষুধ যোগ</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('admin-library')}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1E1B4B] hover:bg-indigo-50 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>ওষুধ ব্যবস্থাপনা</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
            >
              <UploadCloud className="w-4 h-4" />
              <span>ওষুধ ডাটা ইমপোর্ট করুন</span>
            </button>
          </div>
        </div>

        {/* Status bar inside banner */}
        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-100/90 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>সিস্টেম কার্যকর ও ক্লাউড ডাটাবেজে সংযুক্ত</span>
            {lastRefreshedAt && (
              <span className="text-indigo-200/80 text-[11px]">
                (সর্বশেষ আপডেট: {lastRefreshedAt})
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-[11px] text-indigo-200/85">
            <span>সংস্করণ: <strong>{APP_VERSION}</strong></span>
            <span>•</span>
            <span>ডাটাবেজ: <strong>Supabase Postgres</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Error State if fetch failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-danger-soft border border-danger/35 flex items-start justify-between gap-3 text-xs text-danger-text animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-danger-text shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{error}</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                ক্লাউড ডাটাবেজে সাময়িক ত্রুটি হতে পারে। নিশ্চিত করুন আপনার ইন্টারনেট সংযোগ সচল আছে।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboardData(true)}
            className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg font-bold cursor-pointer shrink-0"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* 3. Admin AI Status Diagnostic Card ("AI অবস্থা") */}
      <section
        aria-label="AI অবস্থা"
        className="bg-surface rounded-3xl p-5 border border-border shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-soft text-primary">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text flex items-center gap-2 flex-wrap">
                <span>AI অবস্থা</span>
                {aiHealth &&
                  (aiHealth.ok ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-soft text-success-text border border-success/30">
                      <CheckCircle2 className="w-3 h-3" />
                      AI সচল
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-soft text-danger-text border border-danger/30">
                      <XCircle className="w-3 h-3" />
                      সমস্যা পাওয়া গেছে
                    </span>
                  ))}
              </h2>
              <p className="text-[11px] text-text-muted">
                ওষুধের তথ্য, প্রেসক্রিপশন স্ক্যান ও ড্রাগ-ইন্টারঅ্যাকশন AI সেবার সরাসরি অবস্থা যাচাই
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={checkingAiHealth}
            onClick={() => void handleCheckAiHealth()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingAiHealth ? 'animate-spin' : ''}`} />
            <span>{checkingAiHealth ? 'পরীক্ষা হচ্ছে...' : 'পরীক্ষা করুন'}</span>
          </button>
        </div>

        {!aiHealth ? (
          <div className="p-4 rounded-2xl bg-surface-2 border border-border text-xs text-text-muted flex items-center justify-between gap-3">
            <span>
              Gemini API চাবি, উপলব্ধ মডেল তালিকা ও প্রকৃত সংযোগ পরীক্ষা করতে{' '}
              <strong className="text-text">&quot;পরীক্ষা করুন&quot;</strong> বোতামে চাপ দিন।
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Key + Primary + Fallback + Active Model grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  API চাবি (Key)
                </span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    aiHealth.keyPresent ? 'text-success-text' : 'text-danger-text'
                  }`}
                >
                  {aiHealth.keyPresent ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>যুক্ত আছে</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>চাবি নেই</span>
                    </>
                  )}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] text-text-muted font-medium block">
                  প্রাথমিক মডেল (GEMINI_MODEL)
                </span>
                <span className="font-mono font-bold text-text block break-all">
                  {aiHealth.model}
                </span>
                <span
                  className={`text-[10px] font-semibold block ${
                    aiHealth.modelInAvailableList ? 'text-success-text' : 'text-warning-text'
                  }`}
                >
                  {aiHealth.modelInAvailableList
                    ? '✓ উপলব্ধ তালিকায় আছে'
                    : '⚠ উপলব্ধ তালিকায় নেই'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] text-text-muted font-medium block">
                  বিকল্প ফ্ল্যাশ মডেল (Fallback)
                </span>
                <span className="font-mono font-bold text-text block break-all">
                  {aiHealth.fallbackModel || 'পাওয়া যায়নি'}
                </span>
                {aiHealth.fallbackModel && (
                  <span
                    className={`text-[10px] font-semibold block ${
                      aiHealth.fallbackInAvailableList ? 'text-success-text' : 'text-warning-text'
                    }`}
                  >
                    {aiHealth.fallbackInAvailableList
                      ? '✓ তালিকায় যাচাইকৃত'
                      : 'এনভায়রনমেন্ট থেকে নির্ধারিত'}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-1">
                <span className="text-[11px] text-text-muted font-medium block">
                  সক্রিয় ব্যবহৃত মডেল
                </span>
                <span className="font-mono font-bold text-primary block break-all">
                  {aiHealth.activeModelUsed || 'কোনোটিই নয়'}
                </span>
                {aiHealth.checkedAt && (
                  <span className="text-[10px] text-text-muted block">
                    সময়:{' '}
                    {new Date(aiHealth.checkedAt).toLocaleTimeString('bn-BD', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>

            {!aiHealth.ok ? (
              <div className="p-4 rounded-2xl bg-danger-soft border border-danger/35 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-danger-text flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>কারণ: {aiHealth.reasonBn || 'AI সংযোগ ব্যর্থ'}</span>
                  </span>
                  {aiHealth.errorCode && (
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface border border-danger/25 text-text-muted">
                      কোড: {aiHealth.errorCode}
                      {aiHealth.errorStatus ? ` (${aiHealth.errorStatus})` : ''}
                    </span>
                  )}
                </div>
                {aiHealth.errorMessage && (
                  <p className="text-[11px] font-mono text-text-muted break-words">
                    {aiHealth.errorMessage}
                  </p>
                )}
                {aiHealth.hintBn && (
                  <p className="text-xs font-semibold text-text pt-1">
                    সমাধান: {aiHealth.hintBn}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-success-soft border border-success/30 text-xs text-success-text flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">
                  {aiHealth.hintBn || 'AI সেবা সচল আছে এবং সব এন্ডপয়েন্ট কার্যকর।'}
                </span>
              </div>
            )}

            {aiHealth.endpointModels && Object.keys(aiHealth.endpointModels).length > 0 && (
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2 text-xs">
                <span className="text-[11px] font-bold text-text-muted block">
                  প্রতিটি AI এন্ডপয়েন্টের নির্ধারিত মডেল:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(aiHealth.endpointModels).map(([ep, modelName]) => (
                    <div
                      key={ep}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-surface border border-border font-mono text-[11px]"
                    >
                      <span className="text-text-muted truncate">{ep}</span>
                      <span className="font-bold text-text shrink-0">{modelName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiHealth.availableModels && aiHealth.availableModels.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2 text-xs">
                <span className="text-[11px] font-bold text-text-muted block">
                  এই API চাবিতে উপলব্ধ মডেল (flash/pro, প্রথম {toBengaliNumber(aiHealth.availableModels.length)}টি):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {aiHealth.availableModels.map((m) => {
                    const isConfigured = m.toLowerCase() === aiHealth.model.toLowerCase();
                    const isActive =
                      aiHealth.activeModelUsed &&
                      m.toLowerCase() === aiHealth.activeModelUsed.toLowerCase();
                    return (
                      <span
                        key={m}
                        className={`px-2 py-0.5 rounded-lg font-mono text-[11px] border ${
                          isActive
                            ? 'bg-success-soft text-success-text border-success/35 font-bold'
                            : isConfigured
                            ? 'bg-primary-soft text-primary border-primary/30 font-bold'
                            : 'bg-surface text-text border-border'
                        }`}
                      >
                        {m}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. Core Statistical Metrics Grid (from admin_overview_stats RPC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1: মোট নিবন্ধিত ব্যবহারকারী */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ১. মোট নিবন্ধিত ব্যবহারকারী
              </span>
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-text font-mono">
                    {stats?.totalUsers ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">জন ব্যবহারকারী</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                ক্লাউড ডাটাবেজে সংরক্ষিত প্রকৃত অ্যাকাউন্ট সংখ্যা
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-text-muted font-medium">প্রশাসক: {currentUser?.email || adminEmail}</span>
            <span className="text-[10px] text-text-muted">Supabase Auth</span>
          </div>
        </div>

        {/* Metric 2: মোট Patient Profile */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ২. মোট রোগীর প্রোফাইল
              </span>
              <div className="p-2.5 rounded-2xl bg-accent-soft text-accent-text group-hover:scale-105 transition-transform">
                <HeartPulse className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-text font-mono">
                    {stats?.totalPatientProfiles ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">টি প্রোফাইল</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                ব্যবহারকারীদের পরিবার ও ব্যক্তিগত স্বাস্থ্য প্রোফাইল
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-text-muted font-medium">
              সক্রিয় বর্তমান সেশনে: <strong className="text-primary">{patients.length}</strong> টি
            </span>
            <span className="text-[10px] text-text-muted">Postgres RPC</span>
          </div>
        </div>

        {/* Metric 3: Published Medicines */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ৩. প্রকাশিত ওষুধ (Published Medicines)
              </span>
              <div className="p-2.5 rounded-2xl bg-success-soft text-success-text group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-success-text font-mono">
                    {stats?.totalPublishedMedicines ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">টি ওষুধ</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                সার্বজনীন লাইব্রেরিতে উন্মুক্ত ও প্রশাসক কর্তৃক যাচাইকৃত
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>লাইব্রেরি ব্রাউজ করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-success-text font-bold">অনুমোদিত</span>
          </div>
        </div>

        {/* Metric 4: Unpublished/Draft Medicines */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ৪. অপ্রকাশিত খসড়া (Draft Medicines)
              </span>
              <div className="p-2.5 rounded-2xl bg-warning-soft text-warning-text group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-warning-text font-mono">
                    {stats?.totalUnpublishedMedicines ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">টি খসড়া</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                সাধারণ ব্যবহারকারীদের জন্য লুকানো ও পর্যালোচনার জন্য অপেক্ষমাণ
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-warning-text font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>খসড়া কিউতে যান</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-warning-text font-bold">অপেক্ষমাণ</span>
          </div>
        </div>

        {/* Metric 5: মোট Import Batches */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ৫. মোট Import Batches
              </span>
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                    {stats?.totalImportBatches ?? importBatches.length ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">টি ফাইল ব্যাচ</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                DGDA, প্রস্তুতকারক ও স্বাধীন লাইসেন্সপ্রাপ্ত অডিট ট্রেইল
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-purple-700 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>অডিট হিস্টোরি</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-text-muted">Audit Trail</span>
          </div>
        </div>

        {/* Metric 6: Pending Verification */}
        <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted">
                ৬. যাচাইকরণের অপেক্ষায় (Pending)
              </span>
              <div className="p-2.5 rounded-2xl bg-primary-soft text-primary group-hover:scale-105 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-surface-2 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-primary font-mono">
                    {stats?.pendingVerificationCount ?? 0}
                  </span>
                  <span className="text-xs text-text-muted font-medium">টি রেকর্ড</span>
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                আইনানুগ সনদ নিরীক্ষার পর চূড়ান্ত অনুমোদনের অপেক্ষমাণ
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>যাচাইকরণ পরিচালনা</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-primary font-bold">নিরীক্ষা প্রয়োজন</span>
          </div>
        </div>
      </div>

      {/* 5. Quick Actions Hub */}
      <div className="bg-surface-2 rounded-3xl p-6 border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>প্রশাসক দ্রুত অ্যাকশন হাব (Admin Quick Actions)</span>
            </h3>
            <p className="text-xs text-text-muted">
              অ্যাপের গুরুত্বপূর্ণ প্রশাসনিক মডিউলে সরাসরি প্রবেশের শর্টকাট
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={openManualAddModal}
            className="flex items-center gap-3 p-3.5 bg-surface hover:bg-success-soft/50 rounded-2xl border border-success/40 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-success-soft text-success-text group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-text block group-hover:text-success-text">
                ম্যানুয়ালি ওষুধ যোগ
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                ফরম পূরণ করে সরাসরি অন্তর্ভুক্তি
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className="flex items-center gap-3 p-3.5 bg-surface hover:bg-primary-soft/50 rounded-2xl border border-border transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-text block group-hover:text-primary">
                ওষুধ ইমপোর্ট প্যানেল
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                CSV/JSON ফাইল আপলোড
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className="flex items-center gap-3 p-3.5 bg-surface hover:bg-primary-soft/50 rounded-2xl border border-border transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-success-soft text-success-text group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-text block group-hover:text-primary">
                ওষুধ লাইব্রেরি ব্রাউজার
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                ক্যাটালগ ও সার্চ ফিল্টার
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('admin-library')}
            className="flex items-center gap-3 p-3.5 bg-surface hover:bg-primary-soft/50 rounded-2xl border border-primary/35 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-text block group-hover:text-primary">
                ওষুধ ব্যবস্থাপনা
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                সম্পাদনা, ডুপ্লিকেট ও নিরাপদ মুছা
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('admin-feedback-section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center gap-3 p-3.5 bg-surface hover:bg-primary-soft/50 rounded-2xl border border-border transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-text block group-hover:text-blue-600 dark:group-hover:text-blue-400">
                ব্যবহারকারীর মতামত
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                {toBengaliNumber(totalFeedbackCount)} টি মতামত ও পরামর্শ
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 6. Activities & Import History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: সাম্প্রতিক Admin Activities */}
        <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span>সাম্প্রতিক অ্যাডমিন কার্যক্রম (Admin Activities Log)</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-text-muted font-semibold">
              {activities.length} টি রেকর্ড
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {activities.map((act) => {
                const isImport = act.type === 'import';
                const isDelete = act.type === 'delete';
                const isPublish = act.type === 'publish';

                return (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-2xl bg-surface-2 border border-border flex items-start gap-3 text-xs"
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isImport
                          ? 'bg-primary-soft text-primary'
                          : isDelete
                          ? 'bg-danger-soft text-danger-text'
                          : isPublish
                          ? 'bg-success-soft text-success-text'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {isImport ? (
                        <UploadCloud className="w-4 h-4" />
                      ) : isDelete ? (
                        <Trash2 className="w-4 h-4" />
                      ) : isPublish ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-text">
                          {act.title}
                        </span>
                        <span className="text-[10px] text-text-muted font-medium shrink-0">
                          {new Date(act.timestamp).toLocaleString('bn-BD', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {act.description}
                      </p>
                      <div className="text-[10px] text-text-muted font-mono">
                        প্রশাসক: {act.adminEmail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-surface-2 text-xs text-text-muted space-y-1.5">
              <Activity className="w-6 h-6 text-text-muted mx-auto" />
              <p className="font-bold text-text">
                কোনো সাম্প্রতিক কার্যক্রম রেকর্ড নেই
              </p>
              <p className="text-[11px]">
                নতুন ওষুধ ইমপোর্ট বা খসড়া অনুমোদন করলে তা এখানে সরাসরি লিপিবদ্ধ হবে।
              </p>
            </div>
          )}
        </div>

        {/* Right Column: সাম্প্রতিক Import History */}
        <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>সাম্প্রতিক ইমপোর্ট হিস্টোরি (Import Batches)</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              পূর্ণাঙ্গ অডিট
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : importBatches.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {importBatches.slice(0, 6).map((batch) => (
                <div
                  key={batch.id}
                  className="p-3.5 rounded-2xl bg-surface-2 border border-border flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">
                        {batch.source}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                        {batch.sourceProfile}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted truncate max-w-xs" title={batch.licenseReference}>
                      লাইসেন্স: {batch.licenseReference}
                    </p>

                    <span className="text-[10px] text-text-muted block font-mono">
                      {new Date(batch.importedAt).toLocaleString('bn-BD')}
                    </span>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-xs font-bold text-success-text block">
                      {batch.publishedCount} / {batch.totalRecordsInFile} টি
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      প্রকাশিত
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-surface-2 text-xs text-text-muted space-y-1.5">
              <UploadCloud className="w-6 h-6 text-text-muted mx-auto" />
              <p className="font-bold text-text">
                এখনো কোনো ফাইল ইমপোর্ট করা হয়নি
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className="mt-2 text-primary font-bold hover:underline cursor-pointer inline-block"
              >
                প্রথম ওষুধ ফাইল ইমপোর্ট করুন →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7. User Feedback Moderation Section ("ব্যবহারকারীর মতামত") */}
      <section
        id="admin-feedback-section"
        aria-label="ব্যবহারকারীর মতামত"
        className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>ব্যবহারকারীর মতামত ও পরামর্শ (Feedback)</span>
          </h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-bold">
            মোট {toBengaliNumber(totalFeedbackCount)} টি
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-surface-2 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : feedbackList.length > 0 ? (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                className="p-4 rounded-2xl bg-surface-2 border border-border flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="text-sm text-text font-medium whitespace-pre-wrap break-words">
                    {fb.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                    {fb.appVersion && (
                      <span className="font-mono px-2 py-0.5 rounded bg-surface border border-border">
                        v{fb.appVersion}
                      </span>
                    )}
                    {fb.createdAt && (
                      <span>
                        {new Date(fb.createdAt).toLocaleString('bn-BD', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={deletingFeedbackId === fb.id}
                  onClick={() => void handleDeleteFeedback(fb.id)}
                  className="p-2 rounded-xl bg-danger-soft text-danger-text hover:bg-danger/20 border border-danger/25 cursor-pointer disabled:opacity-50 shrink-0"
                  title="মতামতটি মুছে ফেলুন"
                  aria-label="মতামতটি মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-surface-2 text-xs text-text-muted space-y-1.5">
            <MessageSquare className="w-6 h-6 text-text-muted mx-auto" />
            <p className="font-bold text-text">
              এখনো কোনো ব্যবহারকারীর মতামত জমা পড়েনি
            </p>
            <p className="text-[11px]">
              ব্যবহারকারীরা &quot;আমি ও পরিবার&quot; বা &quot;সেটিংস&quot; থেকে মতামত পাঠালে তা এখানে দেখা যাবে।
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
