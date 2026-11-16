import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  Download,
  Cloud,
} from 'lucide-react';

interface ResetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (deleteFromCloud: boolean) => Promise<void>;
  onDownloadBackup: () => void;
  isLoggedIn: boolean;
  userEmail?: string | null;
}

export const ResetConfirmationModal: React.FC<ResetConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  onDownloadBackup,
  isLoggedIn,
  userEmail,
}) => {
  const [deleteFromCloud, setDeleteFromCloud] = useState<boolean>(true);
  const [understoodLoss, setUnderstoodLoss] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setUnderstoodLoss(false);
      setConfirmText('');
      setDeleteFromCloud(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = understoodLoss && confirmText.trim() === 'মুছুন';

  const handleExecute = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    await onConfirmReset(deleteFromCloud);
    setIsDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface rounded-3xl max-w-lg w-full border border-border shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-danger-soft text-danger shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-text">
                সব ডেটা মুছে ফেলার নিশ্চিতকরণ
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                দুই ধাপের নিরাপত্তা ভেরিফিকেশন (2-Step Verification)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Explanation */}
        <div className="p-3.5 rounded-2xl bg-danger-soft border border-danger/30 text-xs text-danger-text space-y-1.5">
          <p className="font-bold">সতর্কতা: এই প্রক্রিয়াটি সম্পূর্ণ অপরিবর্তনীয়!</p>
          <p className="text-[11px] leading-relaxed">
            এটি আপনার সংরক্ষিত সমস্ত <strong>ওষুধের তালিকা</strong>, <strong>ডোজ সেবন ইতিহাস</strong>, <strong>রোগীর পারিবারিক প্রোফাইল</strong>, <strong>স্বাস্থ্য রেকর্ড</strong> ও <strong>অ্যাপয়েন্টমেন্ট</strong> স্থায়ীভাবে মুছে ফেলবে।
          </p>
        </div>

        {/* Cloud Scope Confirmation */}
        {isLoggedIn ? (
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-border text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-text">
              <Cloud className="w-4 h-4 text-primary" />
              <span>ক্লাউড অ্যাকাউন্ট ডেটা:</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              আপনি বর্তমানে <span className="font-semibold text-text">{userEmail}</span> অ্যাকাউন্টে লগইন অবস্থায় আছেন। ক্লাউড থেকে মোছা হলে শুধুমাত্র আপনার ব্যক্তিগত অ্যাকাউন্টের ডেটা মুছে যাবে; সার্বজনীন ওষুধ লাইব্রেরি বা অন্য কারও ডেটা স্পর্শ করা হবে না।
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteFromCloud}
                onChange={(e) => setDeleteFromCloud(e.target.checked)}
                className="w-4 h-4 rounded text-danger focus:ring-danger cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-text">
                ক্লাউড অ্যাকাউন্ট থেকেও এই ডেটা মুছে ফেলুন
              </span>
            </label>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-border text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-text">
              <Cloud className="w-4 h-4 text-text-muted" />
              <span>ক্লাউড ডেটা প্রভাবিত হবে না</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              আপনি বর্তমানে লগইন করা অবস্থায় নেই। তাই শুধুমাত্র এই ফোনের স্থানীয় ডেটা মুছে যাবে; কোনো ক্লাউড অ্যাকাউন্টের ডেটা মুছে ফেলা হবে না।
            </p>
          </div>
        )}

        {/* Safety Backup Button */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary-soft border border-primary/25 text-xs">
          <div>
            <span className="font-bold text-text block">
              মুছে ফেলার আগে ব্যাকআপ নিতে চান?
            </span>
            <span className="text-[11px] text-primary">
              এক ক্লিকেই আপনার সমস্ত ডেটার ব্যাকআপ ডাউনলোড করে রাখুন
            </span>
          </div>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-primary border border-primary/30 rounded-xl font-bold text-[11px] hover:bg-surface-2 cursor-pointer shrink-0 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ডাউনলোড</span>
          </button>
        </div>

        {/* 2-Step Verification Controls */}
        <div className="space-y-3 pt-1 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={understoodLoss}
              onChange={(e) => setUnderstoodLoss(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-danger focus:ring-danger cursor-pointer shrink-0"
            />
            <span className="text-text text-[11px] leading-relaxed">
              আমি নিশ্চিতভাবে বুঝতে পারছি যে মুছে ফেলার পর এই ডেটা আর পুনরুদ্ধার করা যাবে না।
            </span>
          </label>

          <div className="space-y-1">
            <label className="font-semibold text-text block text-[11px]">
              নিশ্চিত করতে নিচে হুবহু <strong className="text-danger-text">"মুছুন"</strong> শব্দটি টাইপ করুন:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="মুছুন"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-danger font-bold"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-text-muted hover:text-text hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
          >
            বাতিল করুন
          </button>

          <button
            type="button"
            disabled={!isConfirmed || isDeleting}
            onClick={handleExecute}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-danger hover:opacity-90 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, স্থায়ীভাবে সব মুছে ফেলুন'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
