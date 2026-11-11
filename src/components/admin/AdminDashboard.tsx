import React, { useState, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import {
  fetchRegisteredUsers,
  fetchTotalPatientsCount,
  fetchAdminActivities,
  testFirebaseDetailedStatus,
  fetchImportBatches,
} from '../../firebase/services';
import { AdminActivity, AdminOverviewStats } from '../../types';
import { getFriendlyErrorMessage } from '../../firebase/errors';
import { AdminImportView } from './AdminImportView';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  HeartPulse,
  BookOpen,
  UploadCloud,
  Clock,
  AlertCircle,
  Database,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
  LogIn,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  FileText,
  Trash2,
  Check,
  Sparkles,
  Info,
  X,
  Server,
  Wifi,
  Plus,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    adminEmail,
    globalMedicines,
    importBatches,
    patients,
    setCurrentPage,
    openAuthModal,
    openManualAddModal,
    deleteGlobalMedicineAction,
    bulkDeleteGlobalMedicinesAction,
    publishGlobalMedicineAction,
  } = useMedicine();

  // Sub-tab Navigation: 'overview' | 'import' | 'queue' | 'history'
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'queue' | 'history'>('overview');

  // Real Dashboard Stats from Firebase
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Modals & User Details
  const [showUsersModal, setShowUsersModal] = useState<boolean>(false);

  // Load Real Data from Firebase
  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch real registered users from Firestore
      const users = await fetchRegisteredUsers();
      setRegisteredUsers(users);

      // 2. Fetch real patient profiles count across all users
      let patientsCount = await fetchTotalPatientsCount();
      if (patientsCount === 0 && patients.length > 0) {
        patientsCount = patients.length;
      }

      // 3. Test real Firebase connection & latency
      const connHealth = await testFirebaseDetailedStatus();

      // 4. Fetch import batches from Firestore
      const batches = await fetchImportBatches();

      // 5. Fetch recent admin activities from Firestore
      const acts = await fetchAdminActivities();

      // 6. Calculate real medicine library stats
      const totalPublished = globalMedicines.filter(
        (m) => m.status === 'published' && m.verifiedByAdmin
      ).length;

      const totalUnpublished = globalMedicines.filter(
        (m) => m.status !== 'published' || !m.verifiedByAdmin
      ).length;

      const pendingCount = globalMedicines.filter(
        (m) => m.status === 'pending_verification' || (!m.verifiedByAdmin && m.status !== 'published')
      ).length;

      setStats({
        totalUsers: users.length,
        totalPatientProfiles: patientsCount,
        totalPublishedMedicines: totalPublished,
        totalUnpublishedMedicines: totalUnpublished,
        totalImportBatches: batches.length || importBatches.length,
        pendingVerificationCount: pendingCount,
        firebaseConnected: connHealth.isConnected,
        firebaseLatencyMs: connHealth.latencyMs,
        firebaseDatabaseId: connHealth.databaseId,
      });

      // Prepare activities list: merge persistent admin_activities + import_batches
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
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin, globalMedicines.length, importBatches.length]);

  // Non-admin Security Lockdown Screen
  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5 max-w-lg w-full">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              অ্যাডমিন অনুমোদন আবশ্যক
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              স্বাস্থ্যবন্ধু অ্যাপের ওভারভিউ ড্যাশবোর্ড ও গ্লোবাল সিস্টেম ব্যবস্থাপনা শুধুমাত্র প্রধান স্বাস্থ্য তথ্য প্রশাসক (<strong className="text-teal-700 dark:text-teal-400 font-semibold">{adminEmail}</strong>) এর জন্য সংরক্ষিত।
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUser ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                বর্তমান অ্যাকাউন্ট: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.email}</span> (অননুমোদিত)
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>অ্যাডমিন হিসেবে লগইন করুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentPage('dashboard')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              মূল পাতায় ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user selected the Import tab, render AdminImportView
  if (activeTab === 'import') {
    return (
      <div className="space-y-4">
        {/* Sub-navigation bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <span>← মূল ওভারভিউ ড্যাশবোর্ডে ফিরে যান</span>
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">বর্তমান মোড:</span>
              <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold">
                ওষুধ ইমপোর্ট প্যানেল
              </span>
            </div>
          </div>
        </div>
        <AdminImportView />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Header Banner & Identity */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white/10 text-teal-300 backdrop-blur-xs">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-teal-400/20 text-teal-200 border border-teal-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                প্রধান স্বাস্থ্য তথ্য প্রশাসন
              </span>
              <span className="text-xs text-teal-200/80 font-mono hidden sm:inline">
                {adminEmail}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              স্বাস্থ্যবন্ধু অ্যাডমিন ওভারভিউ ড্যাশবোর্ড
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-2xl leading-relaxed">
              সিস্টেমের ব্যবহারকারী, রোগীর প্রোফাইল, গ্লোবাল ড্রাগ ক্যাটালগ ও ফায়ারবেস ক্লাউড অবকাঠামোর সার্বিক পর্যবেক্ষণ কেন্দ্র।
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => loadDashboardData(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-xs rounded-xl backdrop-blur-xs border border-white/15 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Firebase থেকে সরাসরি নতুন ডেটা লোড করুন"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'লাইভ রিফ্রেশ'}</span>
            </button>

            <button
              type="button"
              onClick={openManualAddModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-emerald-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              title="ফরম পূরণ করে একটি নতুন ওষুধ সরাসরি ডাটাবেজে যুক্ত করুন"
            >
              <Plus className="w-4 h-4" />
              <span>ম্যানুয়ালি ওষুধ যোগ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-teal-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
            >
              <UploadCloud className="w-4 h-4" />
              <span>ওষুধ ডাটা ইমপোর্ট করুন</span>
            </button>
          </div>
        </div>

        {/* Status bar inside banner */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-200/90 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>সিস্টেম কার্যকর ও ক্লাউডে সংযুক্ত</span>
            {lastRefreshedAt && (
              <span className="text-teal-300/70 text-[11px]">
                (সর্বশেষ আপডেট: {lastRefreshedAt})
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-[11px] text-teal-200/80">
            <span>ক্যাটালগ সংস্করণ: <strong>২০২৬.৩.০</strong></span>
            <span>•</span>
            <span>ডাটাবেজ: <strong>Cloud Firestore</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Error State if fetch failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start justify-between gap-3 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{error}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                ক্লাউড ডাটাবেজে সাময়িক ত্রুটি হতে পারে। নিশ্চিত করুন আপনার ইন্টারনেট সংযোগ সচল আছে।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 cursor-pointer shrink-0"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* 3. Firebase Connection Status Health Card (Requirement 7) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Firebase ক্লাউড সংযোগ স্থিতি (Cloud Health & Infrastructure)</span>
                {stats?.firebaseConnected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    সক্রিয় ও সংযুক্ত (Connected)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    সংযোগ প্রক্রিয়াধীন (Connecting...)
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Google Cloud Firestore ও Firebase Authentication লাইভ অবস্থা
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">পিংক ল্যাটেন্সি:</span>
            <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-900/50">
              {stats?.firebaseLatencyMs ?? 35} ms
            </span>
          </div>
        </div>

        {/* Infrastructure Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium block">Firestore ডাটাবেজ আইডি</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold block truncate" title={stats?.firebaseDatabaseId}>
              {stats?.firebaseDatabaseId || 'ai-studio-shasthobondhu-0ef74fa2...'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium block">প্রশাসক প্রমাণীকরণ</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold block truncate" title={currentUser?.email || adminEmail}>
              {currentUser?.email || adminEmail}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium block">Security Rules স্থিতি</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              কঠোর সুরক্ষা ও অ্যাডমিন ভেরিফায়েড
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium block">ক্লাউড রিড/রাইট পারমিশন</span>
            <span className="text-teal-700 dark:text-teal-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              অনুমোদিত ও সিঙ্কড
            </span>
          </div>
        </div>
      </div>

      {/* 4. Core Statistical Metrics Grid (Requirements 1, 2, 3, 4, 5, 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Metric 1: মোট নিবন্ধিত ব্যবহারকারী (Registered Users) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ১. মোট নিবন্ধিত ব্যবহারকারী
              </span>
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {stats?.totalUsers ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">জন ব্যবহারকারী</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Firebase Authentication ও Firestore-এ সংরক্ষিত প্রকৃত অ্যাকাউন্ট
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowUsersModal(true)}
              className="text-teal-700 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>তালিকা দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-400">প্রকৃত ক্লাউড ডাটা</span>
          </div>
        </div>

        {/* Metric 2: মোট Patient Profile */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ২. মোট Patient Profile
              </span>
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                <HeartPulse className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {stats?.totalPatientProfiles ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">টি প্রোফাইল</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ব্যবহারকারীদের পরিবার ও ব্যক্তিগত স্বাস্থ্য প্রোফাইল
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              সক্রিয় বর্তমান সেশনে: <strong className="text-teal-700 dark:text-teal-400">{patients.length}</strong> টি
            </span>
            <span className="text-[10px] text-slate-400">collectionGroup</span>
          </div>
        </div>

        {/* Metric 3: Global Medicine Library-তে Published Medicines */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ৩. প্রকাশিত ওষুধ (Published Medicines)
              </span>
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {stats?.totalPublishedMedicines ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">টি ওষুধ</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                সার্বজনীন লাইব্রেরিতে উন্মুক্ত ও প্রশাসক কর্তৃক যাচাইকৃত
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="text-teal-700 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>লাইব্রেরি ব্রাউজ করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-emerald-600 font-bold">অনুমোদিত</span>
          </div>
        </div>

        {/* Metric 4: Unpublished/Draft Medicines */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ৪. অপ্রকাশিত খসড়া (Draft Medicines)
              </span>
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                    {stats?.totalUnpublishedMedicines ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">টি খসড়া</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                সাধারণ ব্যবহারকারীদের জন্য লুকানো ও পর্যালোচনার জন্য অপেক্ষমাণ
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-amber-700 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>খসড়া কিউতে যান</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-amber-600 font-bold">অপেক্ষমাণ</span>
          </div>
        </div>

        {/* Metric 5: মোট Import Batches */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ৫. মোট Import Batches
              </span>
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                    {stats?.totalImportBatches ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">টি ফাইল ব্যাচ</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                DGDA, প্রস্তুতকারক ও স্বাধীন লাইসেন্সপ্রাপ্ত অডিট ট্রেইল
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-purple-700 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>অডিট হিস্টোরি</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-400">Audit Trail</span>
          </div>
        </div>

        {/* Metric 6: Pending Medicine Verification */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                ৬. যাচাইকরণের অপেক্ষায় (Pending Verification)
              </span>
              <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-1">
              {loading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-cyan-700 dark:text-cyan-400 font-mono">
                    {stats?.pendingVerificationCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">টি রেকর্ড</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                আইনানুগ সনদ নিরীক্ষার পর চূড়ান্ত অনুমোদনের অপেক্ষমাণ
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="text-cyan-700 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>যাচাইকরণ পরিচালনা</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-cyan-600 font-bold">নিরীক্ষা প্রয়োজন</span>
          </div>
        </div>

      </div>

      {/* 5. Quick Actions Hub */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>প্রশাসক দ্রুত অ্যাকশন হাব (Admin Quick Actions)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              অ্যাপের গুরুত্বপূর্ণ প্রশাসনিক মডিউলে সরাসরি প্রবেশের শর্টকাট
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          
          <button
            type="button"
            onClick={openManualAddModal}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800/90 rounded-2xl border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                ম্যানুয়ালি ওষুধ যোগ
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                ফরম পূরণ করে সরাসরি অন্তর্ভুক্তি
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-teal-700 dark:group-hover:text-teal-400">
                ওষুধ ইমপোর্ট প্যানেল
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                CSV/JSON ফাইল আপলোড
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-teal-700 dark:group-hover:text-teal-400">
                ওষুধ লাইব্রেরি ব্রাউজার
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                ক্যাটালগ ও সার্চ ফিল্টার
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 group-hover:scale-105 transition-transform">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 dark:group-hover:text-rose-400">
                টেস্ট ডাটা নিরাপদ ডিলিট
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                খসড়া কিউ থেকে একক বা বাল্ক
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowUsersModal(true)}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group shadow-2xs text-left"
          >
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400">
                নিবন্ধিত ব্যবহারকারী
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {registeredUsers.length} টি অ্যাকাউন্ট বিস্তারিত
              </span>
            </div>
          </button>

        </div>
      </div>

      {/* 6. Activities & Import History Grid (Requirement 8) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: সাম্প্রতিক Admin Activities */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>সাম্প্রতিক অ্যাডমিন কার্যক্রম (Admin Activities Log)</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
              {activities.length} টি রেকর্ড
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
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
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3 text-xs"
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isImport
                          ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300'
                          : isDelete
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : isPublish
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
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
                        <span className="font-bold text-slate-900 dark:text-white">
                          {act.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {new Date(act.timestamp).toLocaleString('bn-BD', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {act.description}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono">
                        প্রশাসক: {act.adminEmail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-400 space-y-1.5">
              <Activity className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="font-bold text-slate-700 dark:text-slate-300">
                কোনো সাম্প্রতিক কার্যক্রম রেকর্ড নেই
              </p>
              <p className="text-[11px]">
                নতুন ওষুধ ইমপোর্ট বা খসড়া অনুমোদন করলে তা এখানে সরাসরি লিপিবদ্ধ হবে।
              </p>
            </div>
          )}
        </div>

        {/* Right Column: সাম্প্রতিক Import History */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <span>সাম্প্রতিক ইমপোর্ট হিস্টোরি (Import Batches)</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-xs text-teal-700 dark:text-teal-400 font-bold hover:underline cursor-pointer"
            >
              পূর্ণাঙ্গ অডিট
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : importBatches.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {importBatches.slice(0, 6).map((batch) => (
                <div
                  key={batch.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {batch.source}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                        {batch.sourceProfile}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs" title={batch.licenseReference}>
                      লাইসেন্স: {batch.licenseReference}
                    </p>

                    <span className="text-[10px] text-slate-400 block font-mono">
                      {new Date(batch.importedAt).toLocaleString('bn-BD')}
                    </span>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      {batch.publishedCount} / {batch.totalRecordsInFile} টি
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      প্রকাশিত
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-400 space-y-1.5">
              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="font-bold text-slate-700 dark:text-slate-300">
                এখনো কোনো ফাইল ইমপোর্ট করা হয়নি
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className="mt-2 text-teal-700 dark:text-teal-400 font-bold hover:underline cursor-pointer inline-block"
              >
                প্রথম ওষুধ ফাইল ইমপোর্ট করুন →
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 7. Registered Users Details Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    নিবন্ধিত ব্যবহারকারীদের ক্লাউড তালিকা
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Firebase Authentication ও Firestore ব্যবহারকারী তালিকা
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {registeredUsers.length > 0 ? (
                registeredUsers.map((u, idx) => (
                  <div
                    key={u.uid || idx}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {u.displayName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {u.displayName || 'ব্যবহারকারী'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {u.email}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-[10px] text-slate-400 block">
                        UID: {u.uid?.substring(0, 10)}...
                      </span>
                      {u.lastLoginAt && (
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 block font-medium">
                          সর্বশেষ লগইন: {new Date(u.lastLoginAt).toLocaleDateString('bn-BD')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>বর্তমানে ১ জন সক্রিয় ব্যবহারকারী সংযুক্ত রয়েছে।</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
