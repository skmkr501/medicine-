import React from 'react';
import {
  AlertTriangle,
  Download,
  Cloud,
  Smartphone,
  Merge,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

interface DataConflictModalProps {
  isOpen: boolean;
  localMedicinesCount: number;
  localPatientsCount: number;
  cloudMedicinesCount: number;
  cloudPatientsCount: number;
  onResolve: (action: 'merge' | 'discard') => Promise<void>;
  onDownloadBackup: () => void;
  isProcessing: boolean;
}

export const DataConflictModal: React.FC<DataConflictModalProps> = ({
  isOpen,
  localMedicinesCount,
  localPatientsCount,
  cloudMedicinesCount,
  cloudPatientsCount,
  onResolve,
  onDownloadBackup,
  isProcessing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ফোনের স্থানীয় ডেটা ও ক্লাউড ডেটা সমন্বয়
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              লগইন করার পূর্বে আপনার এই ফোনে তৈরি করা প্রোফাইল বা ওষুধ পাওয়া গেছে। একই সাথে আপনার ক্লাউড অ্যাকাউন্টেও ইতিমধ্যে ডেটা সংরক্ষিত রয়েছে।
            </p>
          </div>
        </div>

        {/* Data Comparison Overview */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <Smartphone className="w-4 h-4 text-teal-600" />
              <span>ফোনের আগের ডেটা</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ওষুধ: <strong className="text-teal-700 dark:text-teal-400 font-bold">{localMedicinesCount}</strong> টি
              <br />
              প্রোফাইল: <strong className="text-teal-700 dark:text-teal-400 font-bold">{localPatientsCount}</strong> টি
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>ক্লাউড অ্যাকাউন্টে</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ওষুধ: <strong className="text-blue-700 dark:text-blue-400 font-bold">{cloudMedicinesCount}</strong> টি
              <br />
              প্রোফাইল: <strong className="text-blue-700 dark:text-blue-400 font-bold">{cloudPatientsCount}</strong> টি
            </p>
          </div>

        </div>

        {/* Question Prompt */}
        <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>ফোনের আগের ডেটা ক্লাউডে যোগ করবেন, নাকি বাদ দেবেন?</span>
          </p>
          <p className="text-[11px] text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
            ফোনের আগের ডেটা ক্লাউডে যোগ (Merge) করে একসাথে রাখতে পারেন, অথবা শুধুমাত্র ক্লাউডের ডেটা রেখে ফোনের স্থানীয় অস্থায়ী ডেটা বাদ দিতে পারেন।
          </p>
        </div>

        {/* Backup Option */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-[11px] text-slate-400">
            নিরাপত্তার স্বার্থে প্রথমে সংরক্ষণ করতে পারেন:
          </span>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ব্যাকআপ ডাউনলোড</span>
          </button>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onResolve('discard')}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center disabled:opacity-50"
          >
            বাদ দিন (ক্লাউডের ডেটা রাখুন)
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onResolve('merge')}
            className="flex-1 py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Merge className="w-4 h-4" />
            <span>{isProcessing ? 'সিঙ্ক হচ্ছে...' : 'ফোনের ডেটা ক্লাউডে যোগ করুন'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
