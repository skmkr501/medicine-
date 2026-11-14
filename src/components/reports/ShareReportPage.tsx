import React, { useState, useMemo } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import {
  SharedReportDoc,
  SharedReportExpiryHours,
  SharedReportSectionSelection,
} from '../../types';
import {
  DEFAULT_SHARED_REPORT_SECTIONS,
  SHARED_REPORT_EXPIRY_OPTIONS,
  buildSharedReportSnapshot,
  buildSharedReportUrl,
  buildSharedReportWhatsAppUrl,
  formatSharedReportDateTime,
  generateShareToken,
  getIncludedSectionLabels,
  toMillisSafe,
} from '../../utils/sharedReports';
import { createSharedReportInCloud } from '../../firebase/services';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { MySharedLinksSection } from './MySharedLinksSection';
import {
  ArrowLeft,
  Share2,
  ShieldAlert,
  Copy,
  Check,
  Printer,
  Lock,
  UserPlus,
  Pill,
  AlertOctagon,
  Activity,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const ShareReportPage: React.FC = () => {
  const {
    patients,
    activePatient,
    medicines,
    healthRecords,
    appointments,
    currentUser,
    openAuthModal,
    openCreateProfileModal,
    setCurrentPage,
    showToast,
  } = useMedicine();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    () => activePatient?.id || patients[0]?.id || ''
  );
  const [sections, setSections] = useState<SharedReportSectionSelection>({
    ...DEFAULT_SHARED_REPORT_SECTIONS,
  });
  const [expiryHours, setExpiryHours] = useState<SharedReportExpiryHours>(168); // Default 7 days
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<SharedReportDoc | null>(null);
  const [copiedNow, setCopiedNow] = useState(false);
  const [showManualCopyHelp, setShowManualCopyHelp] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const selectedPatient = useMemo(
    () =>
      patients.find((p) => p.id === selectedPatientId) ||
      activePatient ||
      patients[0] ||
      null,
    [patients, selectedPatientId, activePatient]
  );

  // Live preview counts of what will enter the snapshot
  const snapshotCounts = useMemo(() => {
    if (!selectedPatient) {
      return { meds: 0, allergies: 0, readings: 0, appointments: 0 };
    }
    const meds = medicines.filter(
      (m) => m.status === 'active' && m.assignedPatientId === selectedPatient.id
    ).length;
    const allergies = (selectedPatient.allergies || []).length;
    const readings = healthRecords.filter((r) => r.patientId === selectedPatient.id).length;
    const apps = appointments.filter(
      (a) =>
        a.status !== 'cancelled' &&
        (!a.patientId || a.patientId === selectedPatient.id)
    ).length;
    return { meds, allergies, readings, appointments: apps };
  }, [selectedPatient, medicines, healthRecords, appointments]);

  const anySectionSelected =
    sections.medicines ||
    sections.allergiesEmergency ||
    sections.recentReadings ||
    sections.appointments;

  const toggleSection = (key: keyof SharedReportSectionSelection) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
    setCreateError(null);
  };

  const handleCreateLink = async () => {
    setCreateError(null);

    if (!currentUser) {
      openAuthModal();
      return;
    }

    if (!selectedPatient) {
      setCreateError('প্রথমে একজন রোগীর প্রোফাইল তৈরি বা নির্বাচন করুন।');
      return;
    }

    if (!anySectionSelected) {
      setCreateError('অন্তত একটি তথ্য বিভাগ (যেমন: চলমান ওষুধ বা অ্যালার্জি) চালু রাখুন।');
      return;
    }

    setIsCreating(true);
    try {
      const token = generateShareToken(18);
      const snapshot = buildSharedReportSnapshot({
        ownerUid: currentUser.uid,
        token,
        patient: selectedPatient,
        medicines,
        healthRecords,
        appointments,
        selection: sections,
        expiryHours,
      });

      const savedDoc = await createSharedReportInCloud(snapshot);
      setCreatedReport(savedDoc);
      setCopiedNow(false);
      setShowManualCopyHelp(false);
      setRefreshSignal((s) => s + 1);
      showToast('নিরাপদ রিপোর্ট লিংক তৈরি হয়েছে', 'success');
    } catch (err: any) {
      const msg =
        err?.message ||
        'লিংক তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
      setCreateError(msg);
      showToast(msg, 'alert');
    } finally {
      setIsCreating(false);
    }
  };

  const createdUrl = createdReport ? buildSharedReportUrl(createdReport.token) : '';
  const createdExpiresMs = createdReport
    ? createdReport.expiresAtMs || toMillisSafe(createdReport.expiresAt)
    : 0;

  const handleCopyCreatedUrl = async () => {
    if (!createdUrl) return;
    setShowManualCopyHelp(false);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(createdUrl);
        setCopiedNow(true);
        showToast('লিংক কপি হয়েছে', 'success');
        setTimeout(() => setCopiedNow(false), 3000);
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      try {
        const input = document.createElement('input');
        input.value = createdUrl;
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (ok) {
          setCopiedNow(true);
          showToast('লিংক কপি হয়েছে', 'success');
          setTimeout(() => setCopiedNow(false), 3000);
          return;
        }
      } catch {
        // Fallback to manual prompt
      }
      setShowManualCopyHelp(true);
      showToast('স্বয়ংক্রিয় কপি হয়নি — নিচের লিংকটিতে লম্বা চেপে কপি করুন', 'info');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header (Hidden when printing snapshot) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('history')}
            aria-label="ফিরে যান"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Share2 className="w-6 h-6 text-teal-700 dark:text-teal-400" />
              <span>ডাক্তারের জন্য রিপোর্ট ও শেয়ার লিংক</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              ডাক্তার বা পরিবারের সাথে মেয়াদি ও নিরাপদ রিপোর্ট লিংক শেয়ার করুন
            </p>
          </div>
        </div>
      </div>

      {/* Main Builder Card (Hidden on print if printing created snapshot) */}
      <section className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        {/* Login Gate Banner if not signed in */}
        {!currentUser && (
          <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-base text-teal-950 dark:text-teal-100">
                রিপোর্ট লিংক বানাতে লগইন প্রয়োজন
              </p>
              <p className="text-sm text-teal-800 dark:text-teal-300">
                যাতে শুধু আপনিই লিংক বানাতে, দেখতে বা প্রয়োজনে বাতিল করতে পারেন।
              </p>
            </div>
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Lock className="w-4 h-4" />
              <span>লগইন করুন</span>
            </button>
          </div>
        )}

        {/* Step 1: Patient Profile Selector */}
        <div className="space-y-2.5">
          <label className="block text-base font-bold text-slate-900 dark:text-white">
            ১. রোগী নির্বাচন করুন (পরিবারের প্রোফাইল)
          </label>
          {patients.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                রিপোর্ট বানানোর আগে অন্তত একটি রোগী প্রোফাইল তৈরি করুন।
              </p>
              <button
                type="button"
                onClick={openCreateProfileModal}
                className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>প্রোফাইল তৈরি করুন</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {patients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`min-h-[56px] p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-base text-slate-900 dark:text-white">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {p.relation} · {toBengaliNumber(p.age)} বছর · রক্ত: {p.bloodGroup}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2: Section Toggles */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ২. রিপোর্টে কী কী তথ্য থাকবে বেছে নিন
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              ডিফল্ট হিসেবে শুধু চলমান ওষুধ ও অ্যালার্জি/জরুরি তথ্য নির্বাচিত থাকে
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'medicines' as const,
                title: 'চলমান ওষুধ',
                desc: `নাম, জেনেরিক, ডোজ ও সময় (${toBengaliNumber(snapshotCounts.meds)}টি)`,
                icon: Pill,
              },
              {
                key: 'allergiesEmergency' as const,
                title: 'অ্যালার্জি ও জরুরি তথ্য',
                desc: `রক্তের গ্রুপ, অ্যালার্জি (${toBengaliNumber(snapshotCounts.allergies)}টি), জরুরি নম্বর`,
                icon: AlertOctagon,
              },
              {
                key: 'recentReadings' as const,
                title: 'সাম্প্রতিক রিডিং',
                desc: `রক্তচাপ, সুগার ও ওজন (${toBengaliNumber(snapshotCounts.readings)}টি)`,
                icon: Activity,
              },
              {
                key: 'appointments' as const,
                title: 'অ্যাপয়েন্টমেন্ট',
                desc: `ডাক্তার সাক্ষাতের সময়সূচি (${toBengaliNumber(snapshotCounts.appointments)}টি)`,
                icon: Calendar,
              },
            ].map((item) => {
              const Icon = item.icon;
              const checked = sections[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleSection(item.key)}
                  aria-pressed={checked}
                  className={`min-h-[72px] p-4 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    checked
                      ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/40'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        checked ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-base text-slate-900 dark:text-white">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                      checked ? 'bg-teal-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-white shadow-xs" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Expiry Duration Selector */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <span>৩. লিংকের মেয়াদ বেছে নিন</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {SHARED_REPORT_EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => setExpiryHours(opt.hours)}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold text-base transition-colors cursor-pointer ${
                  expiryHours === opt.hours
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: On-Screen Risk & Snapshot Notice */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-sm text-amber-950 dark:text-amber-100">
          <div className="flex items-center gap-2 font-bold text-base">
            <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>নিরাপত্তা ও ঝুঁকি সতর্কতা</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed">
            <li>
              <strong>লিংক পেলে যে কেউ দেখতে পারবেন:</strong> ডাক্তারের সুবিধার জন্য এই লিংক খুলতে লগইন লাগে না, তাই শুধু বিশ্বস্ত ডাক্তার বা পরিবারের সদস্যকে পাঠান।
            </li>
            <li>
              <strong>স্থির স্ন্যাপশট:</strong> এখন নির্বাচিত তথ্যগুলোর ({getIncludedSectionLabels({
                ...(sections.medicines ? { medicines: [] } : {}),
                ...(sections.allergiesEmergency
                  ? { allergiesEmergency: { bloodGroup: '', allergies: [], chronicConditions: [] } }
                  : {}),
                ...(sections.recentReadings ? { recentReadings: [] } : {}),
                ...(sections.appointments ? { appointments: [] } : {}),
              }).join(', ') || 'কোনোটিই নয়'}) একটি স্থির কপি তৈরি হবে — পরে ওষুধ বদলালে এই পুরনো লিংক বদলাবে না।
            </li>
            <li>
              প্রয়োজন শেষে নিচের <strong>&quot;আমার শেয়ার করা লিংক&quot;</strong> তালিকা থেকে যেকোনো সময় লিংকটি বাতিল করতে পারবেন।
            </li>
          </ul>
        </div>

        {createError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold">
            {createError}
          </div>
        )}

        {/* Generate Link CTA */}
        <button
          type="button"
          onClick={handleCreateLink}
          disabled={isCreating || !selectedPatient || !anySectionSelected}
          className="min-h-[54px] w-full px-6 py-3.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-50 text-white font-bold text-lg rounded-2xl shadow-sm flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>নিরাপদ লিংক তৈরি হচ্ছে...</span>
            </>
          ) : (
            <>
              <Share2 className="w-5 h-5" />
              <span>লিংক বানান</span>
            </>
          )}
        </button>

        {/* Created Shareable Link Card */}
        {createdReport && (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-700 space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span>নিরাপদ শেয়ার লিংক তৈরি হয়েছে</span>
                </h3>
                <p className="text-sm text-emerald-900 dark:text-emerald-200 mt-0.5">
                  মেয়াদ শেষ হবে: {formatSharedReportDateTime(createdExpiresMs)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                readOnly
                value={createdUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="তৈরি করা রিপোর্ট লিংক"
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 select-all"
              />
              {showManualCopyHelp && (
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  উপরের লিংকটিতে আঙুল দিয়ে লম্বা চেপে ধরে &quot;কপি&quot; বেছে নিন।
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleCopyCreatedUrl}
                className="min-h-[48px] px-4 py-2.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 text-slate-900 dark:text-white font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedNow ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>কপি হয়েছে ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span>লিংক কপি করুন</span>
                  </>
                )}
              </button>

              <a
                href={buildSharedReportWhatsAppUrl(
                  createdUrl,
                  createdReport.patientName,
                  createdExpiresMs
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>হোয়াটসঅ্যাপে পাঠান</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[48px] px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>PDF / প্রিন্ট</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Print-Only Snapshot Preview (prints cleanly whenever user taps PDF/প্রিন্ট on created link) */}
      {createdReport && (
        <section className="hidden print:block bg-white text-black p-6 space-y-4 print-surface-white">
          <div className="border-b-2 border-black pb-3">
            <h1 className="text-xl font-bold">
              স্বাস্থ্যবন্ধু — রোগীর রিপোর্ট ({createdReport.patientName})
            </h1>
            <p className="text-xs mt-1">
              বয়স: {toBengaliNumber(createdReport.age || 0)} বছর · তৈরি:{' '}
              {formatSharedReportDateTime(createdReport.createdAtMs || Date.now())} · মেয়াদ:{' '}
              {formatSharedReportDateTime(createdExpiresMs)}
            </p>
            <p className="text-xs font-bold mt-2">
              স্বাস্থ্যবন্ধু থেকে শেয়ার করা, তথ্য রোগীর দেওয়া, চিকিৎসার সিদ্ধান্তের আগে ডাক্তারের পরামর্শ নিন
            </p>
          </div>

          {createdReport.sections.medicines && (
            <div>
              <h2 className="font-bold text-base mb-1.5">চলমান ওষুধসমূহ:</h2>
              <table className="w-full text-xs border border-slate-400 print-table">
                <thead>
                  <tr className="border-b border-slate-400">
                    <th className="p-2 text-left">ওষুধ ও জেনেরিক</th>
                    <th className="p-2 text-left">সময় ও ডোজ</th>
                    <th className="p-2 text-left">খাওয়ার নিয়ম</th>
                  </tr>
                </thead>
                <tbody>
                  {createdReport.sections.medicines.map((m, i) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-2">
                        <strong>
                          {m.brandName} ({m.strength})
                        </strong>
                        <div>{m.genericName}</div>
                      </td>
                      <td className="p-2">{m.schedulesText}</td>
                      <td className="p-2">{m.mealTiming}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {createdReport.sections.allergiesEmergency && (
            <div className="text-xs space-y-1">
              <h2 className="font-bold text-base">অ্যালার্জি ও জরুরি তথ্য:</h2>
              <div>রক্তের গ্রুপ: {createdReport.sections.allergiesEmergency.bloodGroup}</div>
              <div>
                অ্যালার্জি:{' '}
                {createdReport.sections.allergiesEmergency.allergies.join(', ') || 'নেই'}
              </div>
              <div>
                দীর্ঘমেয়াদী রোগ:{' '}
                {createdReport.sections.allergiesEmergency.chronicConditions.join(', ') || 'নেই'}
              </div>
              {createdReport.sections.allergiesEmergency.emergencyContact && (
                <div>
                  জরুরি যোগাযোগ: {createdReport.sections.allergiesEmergency.emergencyContact}
                </div>
              )}
            </div>
          )}

          {createdReport.sections.recentReadings && createdReport.sections.recentReadings.length > 0 && (
            <div>
              <h2 className="font-bold text-base mb-1.5">সাম্প্রতিক স্বাস্থ্য রিডিং:</h2>
              <table className="w-full text-xs border border-slate-400 print-table">
                <thead>
                  <tr className="border-b border-slate-400">
                    <th className="p-2 text-left">তারিখ ও সময়</th>
                    <th className="p-2 text-left">রক্তচাপ</th>
                    <th className="p-2 text-left">ব্লাড সুগার</th>
                    <th className="p-2 text-left">ওজন</th>
                  </tr>
                </thead>
                <tbody>
                  {createdReport.sections.recentReadings.map((r, i) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-2">
                        {formatBengaliDate(r.recordDate)}
                        {r.recordTime ? ` (${toBengaliNumber(r.recordTime)})` : ''}
                      </td>
                      <td className="p-2">
                        {r.systolic && r.diastolic
                          ? `${toBengaliNumber(r.systolic)}/${toBengaliNumber(r.diastolic)} mmHg`
                          : '—'}
                      </td>
                      <td className="p-2">
                        {r.bloodSugar !== undefined ? `${toBengaliNumber(r.bloodSugar)} mmol/L` : '—'}
                      </td>
                      <td className="p-2">
                        {r.weight !== undefined ? `${toBengaliNumber(r.weight)} কেজি` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {createdReport.sections.appointments && createdReport.sections.appointments.length > 0 && (
            <div>
              <h2 className="font-bold text-base mb-1.5">ডাক্তারের অ্যাপয়েন্টমেন্ট:</h2>
              <table className="w-full text-xs border border-slate-400 print-table">
                <thead>
                  <tr className="border-b border-slate-400">
                    <th className="p-2 text-left">ডাক্তার ও বিভাগ</th>
                    <th className="p-2 text-left">তারিখ ও সময়</th>
                    <th className="p-2 text-left">স্থান</th>
                  </tr>
                </thead>
                <tbody>
                  {createdReport.sections.appointments.map((a, i) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-2">
                        <strong>{a.doctorName}</strong>
                        {a.specialty ? ` (${a.specialty})` : ''}
                      </td>
                      <td className="p-2">
                        {formatBengaliDate(a.appointmentDate)} · {toBengaliNumber(a.appointmentTime)}
                      </td>
                      <td className="p-2">{a.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Owner's Shared Links Management List */}
      <div className="no-print">
        <MySharedLinksSection autoLoadOnMount={true} refreshSignal={refreshSignal} />
      </div>
    </div>
  );
};
