import React, { useState } from 'react';
import { MessageSquarePlus, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { APP_VERSION, submitFeedbackToSupabase } from '../../supabase/libraryService';
import { useMedicine } from '../../context/MedicineContext';

export const FeedbackCard: React.FC = () => {
  const { currentUser, showToast } = useMedicine();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = message.trim();
    if (clean.length < 3) {
      setErrorMsg('অনুগ্রহ করে অন্তত ৩ অক্ষরের মতামত বা সমস্যা লিখুন।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await submitFeedbackToSupabase(clean, APP_VERSION);
      setMessage('');
      setSubmitted(true);
      showToast('আপনার মতামত সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!', 'success');
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setErrorMsg('মতামত পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="feedback-section"
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <MessageSquarePlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text">
              মতামত পাঠান
            </h2>
            <p className="text-xs text-text-muted">
              অ্যাপের কোনো সমস্যা, ভুল তথ্য বা নতুন সুবিধার পরামর্শ আমাদের জানান
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border shrink-0">
          v{APP_VERSION}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errorMsg) setErrorMsg('');
            if (submitted) setSubmitted(false);
          }}
          placeholder="আপনার মতামত, সমস্যার বিবরণ বা পরামর্শ লিখুন..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-sm sm:text-base text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary resize-y"
        />

        {errorMsg && (
          <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-xs sm:text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {submitted && (
          <div className="p-3 rounded-xl bg-success-soft border border-success/30 text-success-text text-xs sm:text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>আপনার মূল্যবান মতামত আমাদের কাছে পৌঁছেছে!</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-text-muted">
            {currentUser?.email ? `প্রেরক: ${currentUser.email}` : 'বেনামেও মতামত পাঠানো যাবে'}
          </span>

          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'পাঠানো হচ্ছে...' : 'মতামত পাঠান'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
