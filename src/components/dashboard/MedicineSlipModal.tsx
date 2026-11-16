import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Share2, Users, User, X } from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  buildMedicineSlipWhatsAppUrl,
  buildMedicineSlips,
} from '../../utils/dailyScheduleSummary';

interface MedicineSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayStr: string;
}

export const MedicineSlipModal: React.FC<MedicineSlipModalProps> = ({
  isOpen,
  onClose,
  todayStr,
}) => {
  const { patients, activePatient, medicines, doseLogs, settings } = useMedicine();

  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [paperSize, setPaperSize] = useState<'a4' | 'a5'>('a4');
  const [showCourseEndDates, setShowCourseEndDates] = useState(true);

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  // Add/remove body class so @media print isolates strictly to the slip overlay
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('slip-preview-open');
    return () => {
      document.body.classList.remove('slip-preview-open');
    };
  }, [isOpen]);

  // Reset scope to current if multi-patient list drops to <=1
  useEffect(() => {
    if (activePatients.length <= 1 && scope === 'all') {
      setScope('current');
    }
  }, [activePatients.length, scope]);

  const slips = useMemo(
    () =>
      buildMedicineSlips({
        scope,
        patients,
        activePatient,
        medicines,
        doseLogs,
        settings,
        todayStr,
      }),
    [scope, patients, activePatient, medicines, doseLogs, settings, todayStr]
  );

  const whatsappUrl = useMemo(() => buildMedicineSlipWhatsAppUrl(slips), [slips]);

  if (!isOpen || typeof document === 'undefined') return null;

  const pageCssRule =
    paperSize === 'a5'
      ? '@media print { @page { size: A5 portrait; margin: 10mm; } }'
      : '@media print { @page { size: A4 portrait; margin: 12mm; } }';

  return createPortal(
    <div
      className="slip-modal-overlay fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="দৈনিক ওষুধের স্লিপ প্রিভিউ"
      onClick={onClose}
    >
      <style>{pageCssRule}</style>

      <div
        className="slip-modal-container bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action & Filter Bar (Hidden during print) */}
        <div className="no-print border-b border-border bg-surface-2/80 p-4 sm:p-5 space-y-3.5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-text">
                দৈনিক ওষুধের স্লিপ
              </h2>
              <p className="text-sm text-text-muted">
                প্রিন্ট বা সংরক্ষণের আগে স্লিপটি দেখে নিন
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Scope & Options */}
            <div className="flex flex-wrap items-center gap-2.5">
              {activePatients.length > 1 && (
                <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-border">
                  <button
                    type="button"
                    onClick={() => setScope('current')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      scope === 'current'
                        ? 'bg-surface text-text shadow-2xs'
                        : 'text-text-muted'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>শুধু এই রোগী</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      scope === 'all'
                        ? 'bg-surface text-text shadow-2xs'
                        : 'text-text-muted'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>সব প্রোফাইল</span>
                  </button>
                </div>
              )}

              <div className="inline-flex items-center p-1 rounded-xl bg-surface-2 border border-border">
                <button
                  type="button"
                  onClick={() => setPaperSize('a4')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                    paperSize === 'a4'
                      ? 'bg-surface text-text shadow-2xs'
                      : 'text-text-muted'
                  }`}
                >
                  বড় পাতা (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a5')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                    paperSize === 'a5'
                      ? 'bg-surface text-text shadow-2xs'
                      : 'text-text-muted'
                  }`}
                >
                  ছোট পাতা (A5)
                </button>
              </div>

              <label className="min-h-[40px] inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCourseEndDates}
                  onChange={(e) => setShowCourseEndDates(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <span>কোর্স শেষের তারিখ দেখান</span>
              </label>
            </div>

            {/* Print & WhatsApp Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-5 h-5 shrink-0" />
                <span>PDF / প্রিন্ট</span>
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-base font-bold shadow-xs transition-colors"
              >
                <Share2 className="w-5 h-5 shrink-0" />
                <span>হোয়াটসঅ্যাপে লিখে পাঠান</span>
              </a>
            </div>
          </div>
        </div>

        {/* Scrollable Paper Preview Container */}
        <div className="flex-1 overflow-y-auto bg-slate-200/70 dark:bg-slate-950 p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
          <div
            className={`mx-auto space-y-6 print:space-y-0 ${
              paperSize === 'a5' ? 'max-w-[560px]' : 'max-w-[790px]'
            } print:max-w-none`}
          >
            {slips.map((slip, slipIdx) => {
              const isLastSlip = slipIdx === slips.length - 1;
              const hasAnyMedicine = slip.buckets.length > 0 || slip.asNeededItems.length > 0;

              return (
                <article
                  key={`${slip.patientId}-${slipIdx}`}
                  className={`slip-print-sheet bg-white text-black border border-slate-300 shadow-md rounded-xl p-5 sm:p-8 space-y-5 ${
                    !isLastSlip ? 'slip-page-break' : ''
                  }`}
                  style={{ fontSize: '14pt', color: '#000000', backgroundColor: '#ffffff' }}
                >
                  {/* Slip Header */}
                  <header className="border-b-2 border-black pb-3 space-y-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                      স্বাস্থ্যবন্ধু — দৈনিক ওষুধের স্লিপ
                    </h1>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-base text-black">
                      <div>
                        <span className="font-bold">রোগী:</span> {slip.patientName}
                        {slip.relation ? ` (${slip.relation})` : ''}
                        {slip.age !== undefined
                          ? ` · বয়স: ${toBengaliNumber(slip.age)} বছর`
                          : ''}
                      </div>
                      <div>
                        <span className="font-bold">তারিখ:</span> {slip.generatedDateBn}
                      </div>
                    </div>
                  </header>

                  {/* Empty state for this patient */}
                  {!hasAnyMedicine ? (
                    <div className="border border-slate-400 rounded-lg p-5 text-center text-base text-black">
                      এই রোগীর আজকের জন্য কোনো চলমান ওষুধ নেই।
                    </div>
                  ) : (
                    <>
                      {/* Time-grouped Sections */}
                      <div className="space-y-4">
                        {slip.buckets.map((bucket) => (
                          <section
                            key={bucket.key}
                            className="slip-section-block border border-slate-400 rounded-lg overflow-hidden"
                          >
                            <div
                              className="slip-bucket-header px-3.5 py-2 border-b border-slate-400 flex items-center justify-between gap-2 font-bold text-black"
                              style={{ backgroundColor: bucket.headerBgPrint }}
                            >
                              <span>
                                {bucket.emoji} {bucket.titleBn}
                                {bucket.representativeClockBn
                                  ? ` · ${bucket.representativeClockBn}`
                                  : ''}
                              </span>
                              <span className="text-sm font-semibold">
                                মোট {toBengaliNumber(bucket.items.length)}টি
                              </span>
                            </div>

                            <table className="print-table w-full border-collapse text-black text-[13pt] sm:text-[14pt]">
                              <thead>
                                <tr className="border-b border-slate-400 bg-white text-left text-sm font-bold text-black">
                                  <th className="py-1.5 px-2.5 border-r border-slate-300">ওষুধ</th>
                                  <th className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">শক্তি</th>
                                  <th className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">পরিমাণ</th>
                                  <th className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">কখন খাবেন</th>
                                  <th className="py-1.5 px-2 border-r border-slate-300">বিশেষ নোট</th>
                                  <th className="py-1.5 px-2 text-center w-12">টিক</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bucket.items.map((item) => (
                                  <tr key={item.key} className="border-b last:border-b-0 border-slate-300 align-top">
                                    <td className="py-2 px-2.5 border-r border-slate-300">
                                      <div className="font-bold text-black leading-snug">
                                        {item.brandName}
                                      </div>
                                      {item.genericName && (
                                        <div className="text-xs text-slate-700 leading-tight mt-0.5">
                                          {item.genericName}
                                        </div>
                                      )}
                                      {showCourseEndDates && item.courseEndDateBn && (
                                        <div className="text-xs text-slate-800 mt-0.5">
                                          কোর্স শেষ: {item.courseEndDateBn}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 border-r border-slate-300 whitespace-nowrap">
                                      {item.strength || '—'}
                                    </td>
                                    <td className="py-2 px-2 border-r border-slate-300 font-semibold whitespace-nowrap">
                                      {item.dosage}
                                    </td>
                                    <td className="py-2 px-2 border-r border-slate-300 whitespace-nowrap">
                                      {item.mealTiming}
                                    </td>
                                    <td className="py-2 px-2 border-r border-slate-300 text-sm">
                                      {item.instructions || '—'}
                                    </td>
                                    <td className="py-2 px-2 text-center text-xl leading-none font-normal">
                                      ☐
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </section>
                        ))}
                      </div>

                      {/* Separate As-Needed ("প্রয়োজনে") Section */}
                      {slip.asNeededItems.length > 0 && (
                        <section className="slip-section-block border border-slate-400 rounded-lg overflow-hidden">
                          <div
                            className="slip-bucket-header px-3.5 py-2 border-b border-slate-400 font-bold text-black"
                            style={{ backgroundColor: '#EEF2FF' }}
                          >
                            প্রয়োজনে ({toBengaliNumber(slip.asNeededItems.length)}টি)
                          </div>
                          <table className="print-table w-full border-collapse text-black text-[13pt] sm:text-[14pt]">
                            <tbody>
                              {slip.asNeededItems.map((item) => (
                                <tr
                                  key={item.medicineId}
                                  className="border-b last:border-b-0 border-slate-300 align-top"
                                >
                                  <td className="py-2 px-2.5 border-r border-slate-300">
                                    <div className="font-bold text-black">{item.brandName}</div>
                                    {item.genericName && (
                                      <div className="text-xs text-slate-700 mt-0.5">
                                        {item.genericName}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 border-r border-slate-300 whitespace-nowrap">
                                    {item.strength || '—'}
                                  </td>
                                  <td className="py-2 px-2 border-r border-slate-300 whitespace-nowrap">
                                    {item.dosageHint}
                                  </td>
                                  <td className="py-2 px-2 border-r border-slate-300 text-sm">
                                    {item.instructions || 'প্রয়োজন হলে সেবন'}
                                    {showCourseEndDates && item.courseEndDateBn
                                      ? ` · কোর্স শেষ: ${item.courseEndDateBn}`
                                      : ''}
                                  </td>
                                  <td className="py-2 px-2 text-center text-xl leading-none w-12">
                                    ☐
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      )}
                    </>
                  )}

                  {/* Allergies & Emergency Contact (ONLY if present on profile/settings) */}
                  {(slip.allergies.length > 0 || slip.emergencyContact) && (
                    <section className="slip-section-block border border-slate-400 rounded-lg p-3.5 space-y-1 text-sm sm:text-base text-black">
                      {slip.allergies.length > 0 && (
                        <div>
                          <span className="font-bold">অ্যালার্জি:</span> {slip.allergies.join(', ')}
                        </div>
                      )}
                      {slip.emergencyContact && (
                        <div>
                          <span className="font-bold">জরুরি যোগাযোগ:</span> {slip.emergencyContact}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Bottom Advisory Note */}
                  <footer className="pt-2 border-t border-slate-300 text-xs sm:text-sm text-slate-800">
                    এটি অ্যাপের তালিকা; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।
                  </footer>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
