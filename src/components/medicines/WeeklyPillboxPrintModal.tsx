import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { WeeklyPillboxData } from '../../utils/weeklyPillbox';

interface WeeklyPillboxPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyPillboxData;
  patientName: string;
}

export const WeeklyPillboxPrintModal: React.FC<WeeklyPillboxPrintModalProps> = ({
  isOpen,
  onClose,
  data,
  patientName,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('pillbox-print-active');
    return () => {
      document.body.classList.remove('pillbox-print-active');
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pillbox-modal-overlay fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="সাপ্তাহিক পিলবক্স শিট প্রিভিউ"
      onClick={onClose}
    >
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>

      <div
        className="pillbox-modal-container bg-surface border border-border rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar (Hidden in Print) */}
        <div className="no-print border-b border-border bg-surface-2/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text">
              সাপ্তাহিক পিলবক্স শিট (A4 আড়াআড়ি)
            </h2>
            <p className="text-sm text-text-muted">
              প্রিন্ট বা PDF নামানোর আগে পাতাটি দেখে নিন — কাগজে টিক দেওয়ার জন্য প্রতিটি ওষুধের পাশে ঘর রয়েছে
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              <span>প্রিন্ট / PDF নামান</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-3 rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable White A4 Landscape Sheet */}
        <div className="overflow-auto p-3 sm:p-6 bg-slate-100/90 print:p-0 print:bg-white print:overflow-visible">
          <div className="pillbox-print-sheet bg-white text-slate-900 rounded-xl border border-slate-300 shadow-xs p-5 sm:p-6 mx-auto min-w-[820px] print:min-w-0 print:border-none print:rounded-none print:p-0">
            {/* Sheet Header */}
            <header className="flex flex-wrap items-end justify-between gap-4 pb-3 mb-3.5 border-b-2 border-slate-800">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  স্বাস্থ্যবন্ধু — সাপ্তাহিক পিলবক্স
                </h1>
                <p className="text-sm text-slate-700 mt-0.5">
                  রোগী: <strong className="font-bold text-slate-900">{patientName}</strong>
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-600">সপ্তাহের সময়কাল</div>
                <div className="text-base font-bold text-slate-900">{data.weekRangeBn}</div>
              </div>
            </header>

            {/* 7-Day Pillbox Print Table */}
            {data.visibleRows.length === 0 ? (
              <div className="py-8 text-center text-slate-700 border border-slate-300 rounded-lg text-base">
                এই সপ্তাহে কোনো নির্ধারিত ওষুধ নেই।
              </div>
            ) : (
              <table className="pillbox-print-table w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className="border border-slate-400 bg-slate-100 px-2.5 py-2 text-sm font-bold text-slate-900 w-[105px]">
                      সময়
                    </th>
                    {data.days.map((day) => (
                      <th
                        key={day.iso}
                        className="border border-slate-400 bg-slate-50 px-2 py-2 text-center align-top"
                      >
                        <div className="text-sm font-bold text-slate-900">
                          {day.weekdayShortBn}
                        </div>
                        <div className="text-xs font-medium text-slate-700">
                          {day.shortDateBn}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.visibleRows.map((row) => (
                    <tr key={row.key}>
                      <th
                        scope="row"
                        className="pillbox-row-header border border-slate-400 px-2.5 py-2.5 align-top text-left"
                        style={{ backgroundColor: row.headerBgPrint }}
                      >
                        <div className="text-sm font-bold text-slate-900 leading-snug">
                          {row.titleBn}
                        </div>
                        <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                          {row.rangeLabelBn}
                        </div>
                      </th>
                      {data.days.map((day) => {
                        const cellItems = row.cellsByDayIso[day.iso] || [];
                        return (
                          <td
                            key={day.iso}
                            className="border border-slate-400 px-2 py-2 align-top bg-white"
                          >
                            {cellItems.length === 0 ? (
                              <span className="text-slate-400 text-xs">—</span>
                            ) : (
                              <ul className="space-y-1.5">
                                {cellItems.map((item) => (
                                  <li
                                    key={item.key}
                                    className="flex items-start gap-1.5 text-[12px] leading-snug text-slate-900"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="inline-block w-3.5 h-3.5 mt-0.5 border-[1.5px] border-slate-700 rounded-[2px] shrink-0 bg-white"
                                    />
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-900">
                                        {item.brandName}
                                      </span>{' '}
                                      <span className="font-semibold text-slate-800">
                                        {item.dosage}
                                      </span>
                                      {item.shortMealTimingBn && (
                                        <span className="block text-[10.5px] text-slate-600">
                                          {item.shortMealTimingBn}
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* As-Needed Strip */}
            {data.asNeededItems.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-300 text-xs text-slate-800">
                <strong className="font-bold text-slate-900">প্রয়োজনে: </strong>
                {data.asNeededItems
                  .map((it) => `${it.brandName}${it.strength ? ` (${it.strength})` : ''}`)
                  .join(' · ')}
              </div>
            )}

            {/* Weekly Total Medicine Summary Footer */}
            {data.weeklyTotals.length > 0 && (
              <footer className="mt-3.5 pt-3 border-t-2 border-slate-700">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  এই সপ্তাহের মোট ওষুধের হিসাব
                </h2>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-900">
                  {data.weeklyTotals.map((tot) => (
                    <span key={tot.medicineId}>• {tot.summaryLabelBn}</span>
                  ))}
                </div>
              </footer>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
