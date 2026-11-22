import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { BmiCalculatorCard } from './BmiCalculatorCard';
import { ArrowLeft, Activity } from 'lucide-react';

export const BmiPage: React.FC = () => {
  const { setCurrentPage } = useMedicine();

  return (
    <div className="space-y-5 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentPage('me')}
          className="min-h-[44px] px-3.5 py-2 bg-surface border border-border hover:bg-surface-2 rounded-xl text-xs sm:text-sm font-semibold text-text flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>আমি ও পরিবারে ফিরুন</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage('health-records')}
          className="min-h-[44px] px-3.5 py-2 bg-primary-soft text-primary border border-primary/25 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <Activity className="w-4 h-4" />
          <span>স্বাস্থ্য রেকর্ড ও চার্ট দেখুন</span>
        </button>
      </div>

      <BmiCalculatorCard />
    </div>
  );
};
