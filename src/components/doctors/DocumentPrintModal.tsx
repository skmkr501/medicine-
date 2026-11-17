import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import {
  DocumentPrintBundle,
  renderRotatedImageForPrint,
} from '../../utils/medicalDocuments';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { useMedicine } from '../../context/MedicineContext';

interface DocumentPrintModalProps {
  bundle: DocumentPrintBundle;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  bundle,
  onClose,
}) => {
  const { loadDocumentPageImage } = useMedicine();

  const [preparedImages, setPreparedImages] = useState<Record<string, string>>({});
  const [loadedCount, setLoadedCount] = useState(0);
  const [isPreparing, setIsPreparing] = useState(true);
  const [hasTriggeredAutoPrint, setHasTriggeredAutoPrint] = useState(false);

  const totalCount = bundle.pages.length;

  useEffect(() => {
    document.body.classList.add('doc-print-active');
    return () => {
      document.body.classList.remove('doc-print-active');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const preloadAll = async () => {
      setIsPreparing(true);
      setLoadedCount(0);
      const nextMap: Record<string, string> = {};

      for (let i = 0; i < bundle.pages.length; i++) {
        if (cancelled) return;
        const page = bundle.pages[i];
        try {
          const rawUrl = await loadDocumentPageImage(page.fileId);
          if (rawUrl) {
            nextMap[page.key] =
              page.rotation !== 0
                ? await renderRotatedImageForPrint(rawUrl, page.rotation)
                : rawUrl;
          }
        } catch {
          // continue loading remaining pages
        }
        if (cancelled) return;
        setLoadedCount(i + 1);
      }

      if (!cancelled) {
        setPreparedImages(nextMap);
        setIsPreparing(false);
      }
    };

    void preloadAll();

    return () => {
      cancelled = true;
    };
  }, [bundle]);

  useEffect(() => {
    if (!isPreparing && !hasTriggeredAutoPrint) {
      setHasTriggeredAutoPrint(true);
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch {
          // ignore print invocation errors on unsupported environments
        }
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isPreparing, hasTriggeredAutoPrint]);

  const handlePrintClick = () => {
    try {
      window.print();
    } catch {
      // ignore print errors
    }
  };

  return createPortal(
    <div
      className="doc-print-overlay fixed inset-0 z-50 bg-black/75 overflow-y-auto p-3 sm:p-6 flex justify-center items-start"
      onClick={onClose}
    >
      <div
        className="doc-print-container bg-white text-black rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Non-print Action Bar */}
        <div className="no-print sticky top-0 z-10 bg-slate-900 text-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold truncate">{bundle.headingTitle}</p>
            <p className="text-xs text-slate-300">
              {isPreparing
                ? `${toBengaliNumber(loadedCount)}/${toBengaliNumber(totalCount)} ছবি প্রস্তুত হচ্ছে...`
                : `মোট ${toBengaliNumber(totalCount)} পাতা প্রস্তুত — প্রিন্ট বা PDF সেভ করুন`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isPreparing}
              onClick={handlePrintClick}
              className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              {isPreparing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>PDF / প্রিন্ট করুন</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading Progress Overlay before Print */}
        {isPreparing ? (
          <div className="no-print p-12 text-center space-y-4 bg-white text-slate-900">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-lg font-bold">
                {toBengaliNumber(loadedCount)}/{toBengaliNumber(totalCount)} ছবি প্রস্তুত হচ্ছে...
              </p>
              <p className="text-sm text-slate-600">
                সব ছবি তৈরি হলে স্বয়ংক্রিয়ভাবে প্রিন্ট/PDF পর্দা খুলবে
              </p>
            </div>
            <div className="max-w-xs mx-auto h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-200"
                style={{
                  width: `${totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : (
          /* Printable A4 Sheet */
          <div className="doc-print-sheet bg-white text-black p-4 sm:p-6 space-y-6">
            {/* Cover Page */}
            <section className="doc-print-page doc-print-page-break border border-slate-200 rounded-xl p-5 sm:p-6 bg-white space-y-4">
              <div className="border-b-2 border-indigo-600 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    {bundle.headingTitle}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    ব্যক্তিগত চিকিৎসা নথি সংকলন
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>তৈরির তারিখ: {bundle.printedAtBn}</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    মোট পাতা: {toBengaliNumber(bundle.totalPages)}টি
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">রোগী / সদস্য</span>
                  <strong className="text-slate-900">{bundle.patientLabel}</strong>
                </div>
                {bundle.doctorLabel && (
                  <div>
                    <span className="text-xs text-slate-500 block">ডাক্তার</span>
                    <strong className="text-slate-900">{bundle.doctorLabel}</strong>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="print-table w-full border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-indigo-50 text-slate-900">
                      <th className="border border-slate-300 px-3 py-2 text-left font-bold w-14">
                        ক্রম
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-bold w-32">
                        তারিখ
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-bold">
                        শিরোনাম
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-bold w-24">
                        পাতা
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.rows.map((row) => (
                      <tr key={row.docId} className="bg-white">
                        <td className="print-serial-cell border border-slate-300 px-3 py-2 text-slate-900">
                          {row.serialBn}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          {row.dateBn}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          <span className="font-semibold">{row.title}</span>
                          {row.reportType && (
                            <span className="text-xs text-slate-600 ml-1.5">
                              ({row.reportType})
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">
                          {row.pageCountBn}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Individual A4 Image Pages */}
            {bundle.pages.map((page, index) => {
              const isLast = index === bundle.pages.length - 1;
              const imgUrl = preparedImages[page.key];

              return (
                <section
                  key={page.key}
                  className={`doc-print-page bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 ${
                    isLast ? '' : 'doc-print-page-break'
                  }`}
                >
                  {/* Top Page Caption */}
                  <div className="border-b border-slate-300 pb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-800">
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-slate-900">{page.docTitle}</p>
                      <p className="text-slate-700">
                        রোগী: <strong>{page.patientName}</strong>
                        {page.doctorName && (
                          <>
                            {' '}· ডাক্তার: <strong>{page.doctorName}</strong>
                          </>
                        )}
                        {page.reportType && (
                          <>
                            {' '}· ধরন: <strong>{page.reportType}</strong>
                          </>
                        )}
                        {' '}· তারিখ: <strong>{page.docDateBn}</strong>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-bold text-slate-900 shrink-0">
                      পাতা {toBengaliNumber(page.pageNumberInDoc)}/{toBengaliNumber(page.totalPagesInDoc)}
                    </span>
                  </div>

                  {/* Upright Full Image fitted for A4 */}
                  <div className="flex items-center justify-center bg-white min-h-[260px]">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={page.docTitle}
                        className="max-h-[228mm] max-w-full w-auto h-auto mx-auto object-contain"
                      />
                    ) : (
                      <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg">
                        ছবিটি লোড করা যায়নি
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
