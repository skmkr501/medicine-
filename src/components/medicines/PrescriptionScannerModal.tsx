import React, { useState, useRef } from 'react';
import { scanPrescriptionImage, PrescriptionScanResult } from '../../services/aiService';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  Pill,
  Clock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface PrescriptionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: PrescriptionScanResult) => void;
}

export const PrescriptionScannerModal: React.FC<PrescriptionScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<PrescriptionScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('অনুগ্রহ করে শুধুমাত্র ছবি (JPG বা PNG) আপলোড করুন।');
      return;
    }

    setMimeType(file.type);
    setError(null);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imagePreview) return;

    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await scanPrescriptionImage(imagePreview, mimeType);
      if (res.success && res.data) {
        setScanResult(res.data);
      } else {
        setError('ছবি থেকে স্পষ্ট তথ্য শনাক্ত করা যায়নি। আরও পরিষ্কার আলোতে ছবি তুলুন।');
      }
    } catch (err: any) {
      setError(err?.message || 'স্ক্যান করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setScanResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmAndApply = () => {
    if (!scanResult) return;
    onApplyData(scanResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-2xs">
            <Camera className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              প্রেসক্রিপশন বা ওষুধের পাতা স্ক্যানার (AI সহায়ক)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ছবি থেকে ওষুধের নাম, পাওয়ার ও শিডিউল পড়ে ফর্ম স্বয়ংক্রিয়ভাবে পূরণ হবে
            </p>
          </div>
        </div>

        {/* File / Camera Upload Area */}
        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/40"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              প্রেসক্রিপশন বা পাতার ছবি তুলুন অথবা আপলোড করুন
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              JPG বা PNG ফরম্যাট (পর্যাপ্ত আলোতে পরিষ্কার ছবি তুলুন)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-56 bg-slate-950 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="প্রেসক্রিপশন প্রিভিউ"
                className="max-h-56 w-auto object-contain"
              />
              {!scanResult && !loading && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 cursor-pointer"
                  title="ছবি পরিবর্তন করুন"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Scan Action */}
            {!scanResult && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  অন্য ছবি দিন
                </button>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI সহায়ক ছবি বিশ্লেষণ করছে...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AI দিয়ে তথ্য পড়ুন</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">স্ক্যান ব্যর্থ হয়েছে</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Extracted Details Preview Card */}
        {scanResult && (
          <div className="mt-4 space-y-3">
            <div className="p-4 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-teal-200/60 dark:border-teal-800/60">
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  শনাক্তকৃত ওষুধের তথ্য
                </span>
                <span className="text-2xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 font-semibold">
                  যাচাইযোগ্য
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-2xs block">ওষুধের নাম:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {scanResult.brandName || 'পাওয়া যায়নি'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-2xs block">মাত্রা / পাওয়ার:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {scanResult.strength || 'নির্দিষ্ট নেই'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-2xs block">জেনেরিক নাম:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {scanResult.genericName || 'উল্লেখ নেই'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-2xs block">ধরন ও খাবারের সময়:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {scanResult.type || 'ট্যাবলেট'} · {scanResult.mealTiming || 'খাওয়ার পরে'}
                  </span>
                </div>
              </div>

              {scanResult.schedules && scanResult.schedules.length > 0 && (
                <div className="pt-2 border-t border-teal-100 dark:border-teal-900/60 text-xs">
                  <span className="text-slate-400 text-2xs block mb-1">শনাক্তকৃত শিডিউল:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.schedules.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-2xs font-medium text-slate-700 dark:text-slate-200"
                      >
                        {s.timeSlot} ({s.time}) - {s.dosage}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Statutory Safety Note */}
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-2xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                এটি সাধারণ তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়। ছবি থেকে প্রাপ্ত তথ্যগুলো সংরক্ষণের পূর্বে নতুন ওষুধ ফর্মে মিলিয়ে দেখুন।
              </span>
            </div>

            {/* Apply & Reset Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                আবার স্ক্যান করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmAndApply}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>যাচাই করে ফর্মে বসান</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
