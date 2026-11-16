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
    accentBg: 'bg-primary-soft text-primary',
  },
  {
    id: 'timely-alarm',
    title: 'সময়মতো অ্যালার্ম',
    description:
      'সকাল, দুপুর ও রাতের ডোজের নির্ধারিত সময়ে অ্যাপ আপনাকে অ্যালার্ম দিয়ে মনে করিয়ে দেবে।',
    icon: BellRing,
    accentBg: 'bg-accent-soft text-accent-text',
  },
  {
    id: 'family-care',
    title: 'পরিবারের যত্ন',
    description:
      'নিজের পাশাপাশি বাবা-মা ও পরিবারের সবার ওষুধ ও জরুরি নম্বর একসাথে নিরাপদে রাখুন।',
    icon: Users,
    accentBg: 'bg-success-soft text-success-text',
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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-slide-title"
    >
      <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Top Row: Step count + বাদ দিন button */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between gap-3">
          <span className="text-base font-bold text-text-muted">
            ধাপ {toBengaliNumber(stepIndex + 1)} / {toBengaliNumber(SLIDES.length)}
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="min-h-[48px] px-4 py-2 rounded-xl text-base font-bold text-text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
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
              className="text-2xl sm:text-3xl font-bold text-text leading-snug"
            >
              {currentSlide.title}
            </h2>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed">
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
                  ? 'w-8 bg-primary'
                  : 'w-3 bg-border'
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
              className="min-h-[56px] px-5 py-3 rounded-2xl bg-surface-2 hover:bg-border/60 text-text font-bold text-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>আগের</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="min-h-[56px] flex-1 px-6 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-xl inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
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
