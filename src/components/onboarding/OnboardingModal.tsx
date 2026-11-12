import React, { useState } from 'react';
import { Pill, BellRing, Users, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { toBengaliNumber } from '../../utils/bengaliUtils';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 'add-medicine',
    title: 'সহজে ওষুধ যোগ',
    description:
      'ওষুধের নাম লিখে বা প্রেসক্রিপশনের ছবি তুলে মাত্র কয়েক সেকেন্ডেই তালিকা তৈরি করুন।',
    icon: Pill,
    accentBg: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
  },
  {
    id: 'timely-alarm',
    title: 'সময়মতো অ্যালার্ম',
    description:
      'সকাল, দুপুর ও রাতের ডোজের নির্ধারিত সময়ে অ্যাপ আপনাকে অ্যালার্ম দিয়ে মনে করিয়ে দেবে।',
    icon: BellRing,
    accentBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'family-care',
    title: 'পরিবারের যত্ন',
    description:
      'নিজের পাশাপাশি বাবা-মা ও পরিবারের সবার ওষুধ ও জরুরি নম্বর একসাথে নিরাপদে রাখুন।',
    icon: Users,
    accentBg: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  },
] as const;

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentSlide = SLIDES[stepIndex];
  const Icon = currentSlide.icon;
  const isLastSlide = stepIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      setStepIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
    }
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-slide-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Top Row: Step count + বাদ দিন button */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between gap-3">
          <span className="text-base font-bold text-slate-600 dark:text-slate-300">
            ধাপ {toBengaliNumber(stepIndex + 1)} / {toBengaliNumber(SLIDES.length)}
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="min-h-[48px] px-4 py-2 rounded-xl text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            বাদ দিন
          </button>
        </div>

        {/* Main Slide Content */}
        <div className="px-6 py-6 text-center space-y-5">
          <div
            className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center ${currentSlide.accentBg}`}
          >
            <Icon className="w-12 h-12" />
          </div>

          <div className="space-y-3">
            <h2
              id="onboarding-slide-title"
              className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug"
            >
              {currentSlide.title}
            </h2>
            <p className="text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
              {currentSlide.description}
            </p>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="flex items-center justify-center gap-2.5 pb-5">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setStepIndex(idx)}
              aria-label={slide.title}
              className={`h-3 rounded-full transition-all cursor-pointer ${
                idx === stepIndex
                  ? 'w-8 bg-teal-700 dark:bg-teal-400'
                  : 'w-3 bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Bottom Navigation Buttons */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="min-h-[56px] px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>আগের</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="min-h-[56px] flex-1 px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xl inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            {isLastSlide ? (
              <>
                <Check className="w-6 h-6" />
                <span>শুরু করুন</span>
              </>
            ) : (
              <>
                <span>পরবর্তী</span>
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
