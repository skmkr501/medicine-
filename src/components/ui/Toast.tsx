import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast } = useMedicine();

  if (!toast) return null;

  return (
    <aside
      aria-label="বিজ্ঞপ্তি"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs sm:text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />}
      {toast.type === 'alert' && <AlertCircle className="w-4 h-4 text-amber-400 dark:text-amber-600 shrink-0" />}
      {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 dark:text-sky-600 shrink-0" />}
      <span>{toast.message}</span>
    </aside>
  );
};
