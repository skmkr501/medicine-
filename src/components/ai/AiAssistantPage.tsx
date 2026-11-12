import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { fetchMedicineInfo, MedicineInfoResponse } from '../../services/aiService';
import { PrescriptionScannerModal } from '../medicines/PrescriptionScannerModal';
import { PrescriptionScanResult } from '../../services/aiService';
import {
  Sparkles,
  Search,
  Camera,
  BookOpen,
  AlertTriangle,
  Loader2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  FileText,
} from 'lucide-react';

const COMMON_PRESETS = [
  'Napa Extra (নাপা এক্সট্রা)',
  'Seclo 20 (সেক্লো ২০)',
  'Concor 2.5 (কনকর ২.৫)',
  'Metfor 500 (মেটফোর ৫০০)',
  'Montene 10 (মন্টিন ১০)',
  'Ceevit 250 (সিভিট ২৫০)',
  'Fexo 120 (ফেক্সো ১২০)',
  'Maxpro 20 (ম্যাক্সপ্রো ২০)',
];

export const AiAssistantPage: React.FC = () => {
  const { setCurrentPage, showToast } = useMedicine();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MedicineInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleSearch = async (targetName?: string) => {
    const med = (targetName || query).trim();
    if (!med) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchMedicineInfo(med);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyScanResult = (data: PrescriptionScanResult) => {
    // Store in localStorage or session so AddMedicine can pre-fill
    try {
      localStorage.setItem('shasthobondhu_pending_ai_med', JSON.stringify(data));
      showToast('ছবি থেকে তথ্য শনাক্ত হয়েছে! নতুন ওষুধ ফর্মে বসানো হচ্ছে...', 'success');
      setCurrentPage('add-medicine');
    } catch {
      showToast('স্ক্যান ডেটা লোড করতে সমস্যা হয়েছে', 'alert');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              AI সহায়ক
            </h1>
            <span className="text-2xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold">
              স্বাস্থ্য ও ওষুধ সহায়ক
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ওষুধের সহজ ব্যবহার, পার্শ্বপ্রতিক্রিয়া জানুন এবং প্রেসক্রিপশনের ছবি স্ক্যান করুন
          </p>
        </div>

        {/* Quick Scan Action Button */}
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>প্রেসক্রিপশন / পাতার ছবি স্ক্যান করুন</span>
        </button>
      </div>

      {/* Main AI Info Search Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            ওষুধের নাম লিখে সহজ বাংলায় তথ্য জানুন
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ওষুধের নাম লিখুন (যেমন: নাপা এক্সট্রা, সেক্লো ২০, কনকর)..."
              className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-5 py-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>তথ্য খুঁজুন</span>
          </button>
        </form>

        {/* Quick Popular Medicine Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-2xs text-slate-400">জনপ্রিয় ওষুধ:</span>
          {COMMON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const clean = preset.split('(')[0].trim();
                setQuery(clean);
                handleSearch(clean);
              }}
              className="text-2xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950 hover:text-teal-700 dark:hover:text-teal-300 text-slate-600 dark:text-slate-300 rounded-full transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-pulse mt-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/4 mb-3" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-full" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-5/6" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-4/6" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">তথ্য আনতে সমস্যা হয়েছে</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Information Response Result Card */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="p-5 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/90 dark:border-teal-800/60 rounded-xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-teal-200/60 dark:border-teal-800/60">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  {result.medicineName} — বাংলা তথ্য সংক্ষেপ
                </h3>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {result.info}
              </div>
            </div>

            {/* Statutory Neutral Disclaimer Box */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{result.disclaimer}</p>
                <p className="mt-0.5 text-2xs text-amber-700/90 dark:text-amber-300">
                  AI কখনো ডোজ বদলানোর পরামর্শ দেয় না। কোনো ওষুধ সেবন, বন্ধ বা পরিবর্তন করার পূর্বে সর্বদা বিশেষজ্ঞ চিকিৎসকের সাথে পরামর্শ করুন।
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Auxiliary Feature Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Prescription Scanner Banner */}
        <div
          onClick={() => setIsScannerOpen(true)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 rounded-2xl p-5 cursor-pointer transition-all shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mb-3">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              প্রেসক্রিপশন ও পাতা স্ক্যানার
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              প্রেসক্রিপশন বা পাতার ছবি তুলে দিন, AI সহায়ক নিজে পড়ে নাম, মাত্রা ও সময়সূচি নতুন ওষুধ ফর্মে বসিয়ে দেবে।
            </p>
          </div>
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-4 flex items-center gap-1">
            <span>ক্যামেরা খুলুন</span>
            <span>→</span>
          </span>
        </div>

        {/* Medical Disclaimers Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              দায়িত্বশীল ও নিরপেক্ষ AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              স্বাস্থ্যবন্ধু শুধুমাত্র স্বীকৃত চিকিৎসা নির্দেশিকাভিত্তিক সাধারণ তথ্য সরবরাহ করে। কোনো বাণিজ্যিক ব্র্যান্ডিং পক্ষপাতিত্ব নেই।
            </p>
          </div>
          <span className="text-2xs text-slate-400 mt-4">
            নিরাপদ AI সহায়ক দ্বারা পরিচালিত
          </span>
        </div>
      </div>

      {/* Prescription Scanner Modal */}
      <PrescriptionScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyData={handleApplyScanResult}
      />
    </div>
  );
};
