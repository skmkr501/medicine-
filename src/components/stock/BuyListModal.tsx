import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import {
  ShoppingCart,
  X,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  Plus,
  Send,
  Package,
} from 'lucide-react';

interface BuyListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuyListModal: React.FC<BuyListModalProps> = ({ isOpen, onClose }) => {
  const { medicines, activePatient, showToast, adjustStock } = useMedicine();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const todayStr = '2026-11-02';

  // Filter medicines needing refill for active patient (or all if none selected)
  const patientMedicines = activePatient
    ? medicines.filter((m) => m.assignedPatientId === activePatient.id && m.status === 'active')
    : medicines.filter((m) => m.status === 'active');

  // Low stock items: stock <= minStockAlert or stock <= 7
  const lowStockMedicines = patientMedicines.filter(
    (m) => m.stock <= m.minStockAlert || m.stock <= 7
  );

  // Generate WhatsApp / SMS text
  const patientName = activePatient ? `${activePatient.name} (${activePatient.relation})` : 'আমার পরিবার';
  
  const generateShareText = () => {
    let text = `📝 *স্বাস্থ্যবন্ধু — ওষুধ ক্রয়ের তালিকা*\n`;
    text += `রোগী: ${patientName}\n`;
    text += `তারিখ: ${formatBengaliDate(todayStr)}\n\n`;
    text += `ফার্মেসি থেকে জরুরি ভিত্তিতে কিনতে হবে:\n`;

    if (lowStockMedicines.length === 0) {
      text += `আলহামদুলিল্লাহ, বর্তমানে সকল ওষুধের পর্যাপ্ত স্টক আছে।\n`;
    } else {
      lowStockMedicines.forEach((m, idx) => {
        const needed = Math.max(10, (m.minStockAlert * 3) - m.stock);
        text += `${toBengaliNumber(idx + 1)}. *${m.brandName}* (${m.strength || m.type})\n`;
        text += `   বর্তমান স্টক: ${toBengaliNumber(m.stock)} ${m.unit} | প্রয়োজন: প্রায় ${toBengaliNumber(needed)} ${m.unit}\n`;
      });
    }

    text += `\n— প্রেরক: স্বাস্থ্যবন্ধু অ্যাপ`;
    return text;
  };

  const handleCopyMessage = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('ক্রয়ের তালিকা সফলভাবে কপি করা হয়েছে!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('কপি করতে সমস্যা হয়েছে। ম্যানুয়ালি সিলেক্ট করুন।', 'alert');
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateShareText());
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, '_blank');
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
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-2xs">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              ফার্মেসি থেকে "কিনতে হবে" তালিকা
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {patientName} এর যে ওষুধগুলোর স্টক প্রায় শেষ
            </p>
          </div>
        </div>

        {/* List of items */}
        {lowStockMedicines.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
            <Package className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              সকল ওষুধের পর্যাপ্ত স্টক রয়েছে
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              বর্তমানে কোনো ওষুধের জরুরি রিফিলের প্রয়োজন নেই।
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 mb-5">
            {lowStockMedicines.map((med) => {
              const isCritical = med.stock <= 2;
              return (
                <div
                  key={med.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {med.brandName}
                      </h4>
                      {isCritical && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          জরুরি স্টক
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {med.genericName} · {med.strength || med.type}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span className="text-2xs text-slate-400 block">বর্তমান স্টক</span>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                        {toBengaliNumber(med.stock)} {med.unit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustStock(med.id, 10)}
                      className="px-2.5 py-1.5 text-2xs font-semibold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-800 dark:text-teal-300 rounded-lg border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                      title="১০টি স্টক যোগ করুন"
                    >
                      +১০ রিফিল
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'কপি সম্পন্ন!' : 'মেসেজ হিসেবে কপি করুন'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>হোয়াটসঅ্যাপে পাঠান</span>
          </button>
        </div>
      </div>
    </div>
  );
};
