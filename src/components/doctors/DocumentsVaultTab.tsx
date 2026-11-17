import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  CloudOff,
  Edit2,
  Eye,
  FileText,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import {
  DoctorProfile,
  MedicalDocument,
  MedicalDocumentKind,
} from '../../types';
import { useMedicine } from '../../context/MedicineContext';
import { formatBengaliDate, toBengaliNumber } from '../../utils/bengaliUtils';
import {
  DOCUMENT_PRIVACY_NOTICE,
  DocumentPrintBundle,
  MAX_PRINT_PAGES,
  REPORT_TYPES,
  buildDocumentPrintBundle,
  countTotalUserPages,
  filterAndSortMedicalDocuments,
  normalizeRotation,
  validatePrintSelectionPageCount,
} from '../../utils/medicalDocuments';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { DocumentPrintModal } from './DocumentPrintModal';

interface DocumentsVaultTabProps {
  kind: MedicalDocumentKind;
  fixedDoctor?: DoctorProfile;
  unlinkedOnly?: boolean;
  onAddNewClickOverride?: () => void;
}

export const DocumentsVaultTab: React.FC<DocumentsVaultTabProps> = ({
  kind,
  fixedDoctor,
  unlinkedOnly = false,
}) => {
  const {
    medicalDocuments,
    isLoadingMedicalDocuments,
    pendingDocIds,
    loadMedicalDocuments,
    deleteMedicalDocument,
    patients,
    doctors,
    setCurrentPage,
    showToast,
  } = useMedicine();

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const doctorsById = useMemo(
    () => new Map(doctors.map((d) => [d.id, d])),
    [doctors]
  );
  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState<string>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<MedicalDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<MedicalDocument | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<MedicalDocument | null>(null);
  const [printBundle, setPrintBundle] = useState<DocumentPrintBundle | null>(null);
  const [printLimitError, setPrintLimitError] = useState<string | null>(null);

  const visibleDocs = useMemo(
    () =>
      filterAndSortMedicalDocuments(
        medicalDocuments,
        {
          kind,
          doctorId: fixedDoctor?.id,
          unlinkedOnly,
          patientId: patientFilter,
          reportType: kind === 'report' ? reportTypeFilter : undefined,
          searchQuery,
        },
        doctorsById
      ),
    [
      medicalDocuments,
      kind,
      fixedDoctor?.id,
      unlinkedOnly,
      patientFilter,
      reportTypeFilter,
      searchQuery,
      doctorsById,
    ]
  );

  const pendingIdSet = useMemo(() => new Set(pendingDocIds), [pendingDocIds]);

  const selectedDocsList = useMemo(
    () => visibleDocs.filter((d) => selectedIds.includes(d.id)),
    [visibleDocs, selectedIds]
  );
  const selectedPageCount = useMemo(
    () => countTotalUserPages(selectedDocsList),
    [selectedDocsList]
  );

  const toggleSelectId = (id: string) => {
    setPrintLimitError(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePrintDocs = (targetDocs: MedicalDocument[]) => {
    setPrintLimitError(null);
    const check = validatePrintSelectionPageCount(targetDocs);
    if (!check.allowed) {
      setPrintLimitError(check.messageBn || `সর্বোচ্চ ${toBengaliNumber(MAX_PRINT_PAGES)} পাতা প্রিন্ট করা যায়।`);
      return;
    }
    const bundle = buildDocumentPrintBundle({
      kind,
      docs: targetDocs,
      patients,
      doctors,
      fixedDoctor,
      patientFilterId: patientFilter,
    });
    setPrintBundle(bundle);
  };

  const handleScanPrescriptionHandoff = (
    imageDataUrl: string,
    docItem: MedicalDocument
  ) => {
    const docDoctorName = docItem.doctorId
      ? doctorsById.get(docItem.doctorId)?.name
      : fixedDoctor?.name;
    try {
      localStorage.setItem(
        'shasthobondhu_pending_rx_scan',
        JSON.stringify({
          imageDataUrl,
          mimeType: 'image/jpeg',
          patientId: docItem.patientId,
          doctorName: docDoctorName,
        })
      );
    } catch {
      // ignore storage errors
    }
    setViewingDoc(null);
    setCurrentPage('add-medicine');
  };

  const openNewUpload = () => {
    setEditingDoc(null);
    setUploadModalOpen(true);
  };

  const openEditUpload = (doc: MedicalDocument) => {
    setViewingDoc(null);
    setEditingDoc(doc);
    setUploadModalOpen(true);
  };

  const isPrescription = kind === 'prescription';

  return (
    <div className="space-y-4">
      {/* Privacy Notice */}
      <div className="p-3 rounded-xl bg-primary-soft/60 border border-primary/20 text-xs sm:text-sm text-primary font-semibold flex items-center gap-2">
        <Lock className="w-4 h-4 shrink-0" />
        <span>{DOCUMENT_PRIVACY_NOTICE}</span>
      </div>

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {!unlinkedOnly && (
            <button
              type="button"
              onClick={openNewUpload}
              className="min-h-[48px] px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm sm:text-base rounded-2xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>
                {isPrescription ? 'প্রেসক্রিপশন যোগ করুন' : 'রিপোর্ট যোগ করুন'}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={isLoadingMedicalDocuments}
            onClick={() => {
              void loadMedicalDocuments(true);
              showToast('তালিকা রিফ্রেশ করা হচ্ছে...', 'info');
            }}
            className="min-h-[48px] px-3.5 py-2.5 bg-surface border border-border hover:bg-surface-2 text-text font-semibold text-sm rounded-2xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 text-primary ${isLoadingMedicalDocuments ? 'animate-spin' : ''}`}
            />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        {/* Selection / PDF Controls */}
        {visibleDocs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {!selectionMode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(true);
                    setSelectedIds([]);
                    setPrintLimitError(null);
                  }}
                  className="min-h-[48px] px-3.5 py-2 bg-surface border border-border hover:bg-surface-2 text-text font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span>নির্বাচন করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintDocs(visibleDocs)}
                  className="min-h-[48px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>সব PDF নামান</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIds(visibleDocs.map((d) => d.id))}
                  className="min-h-[48px] px-3.5 py-2 bg-primary-soft text-primary border border-primary/25 font-bold text-sm rounded-xl cursor-pointer"
                >
                  সব নির্বাচন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedIds([]);
                    setPrintLimitError(null);
                  }}
                  className="min-h-[48px] px-3.5 py-2 bg-surface-2 border border-border text-text font-bold text-sm rounded-xl cursor-pointer"
                >
                  নির্বাচন বাতিল
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {printLimitError && (
        <div className="p-3.5 rounded-xl bg-warning-soft border border-warning/40 text-warning-text text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{printLimitError}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isPrescription
                ? 'শিরোনাম, তারিখ বা নোট খুঁজুন...'
                : 'রিপোর্টের নাম, ধরন, তারিখ বা নোট খুঁজুন...'
            }
            className="min-h-[48px] w-full pl-11 pr-16 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-[48px] px-3 absolute right-1 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted hover:text-text cursor-pointer"
            >
              মুছুন
            </button>
          )}
        </div>

        {/* Patient Filter */}
        {activePatients.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-muted mr-1">
              সদস্য:
            </span>
            <button
              type="button"
              onClick={() => setPatientFilter('all')}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer ${
                patientFilter === 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-2 text-text hover:bg-border/60'
              }`}
            >
              সকল
            </button>
            {activePatients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPatientFilter(p.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer ${
                  patientFilter === p.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-2 text-text hover:bg-border/60'
                }`}
              >
                {p.name} ({p.relation})
              </button>
            ))}
          </div>
        )}

        {/* Report Type Filter */}
        {!isPrescription && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-muted mr-1">
              ধরন:
            </span>
            <button
              type="button"
              onClick={() => setReportTypeFilter('all')}
              className={`min-h-[38px] px-3 py-1 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
                reportTypeFilter === 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-2 text-text hover:bg-border/60'
              }`}
            >
              সব ধরন
            </button>
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setReportTypeFilter(rt)}
                className={`min-h-[38px] px-3 py-1 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
                  reportTypeFilter === rt
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-2 text-text hover:bg-border/60'
                }`}
              >
                {rt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State or Thumbnail Cards Grid */}
      {visibleDocs.length === 0 ? (
        <section className="bg-surface border border-border rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-text">
              {isPrescription
                ? 'এখনো কোনো প্রেসক্রিপশন জমা রাখা হয়নি'
                : 'এখনো কোনো পরীক্ষার রিপোর্ট জমা রাখা হয়নি'}
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              {isPrescription
                ? 'প্রেসক্রিপশনের ছবি তুলে রাখলে প্রয়োজনের সময় সহজে দেখতে ও PDF হিসেবে প্রিন্ট করতে পারবেন।'
                : 'রক্ত পরীক্ষা, এক্স-রে, ECG বা অন্যান্য রিপোর্টের ছবি সাজিয়ে রাখুন — প্রয়োজনে এক ক্লিকেই PDF পাবেন।'}
            </p>
          </div>
          {!unlinkedOnly && (
            <button
              type="button"
              onClick={openNewUpload}
              className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>
                {isPrescription ? 'প্রথম প্রেসক্রিপশন যোগ করুন' : 'প্রথম রিপোর্ট যোগ করুন'}
              </span>
            </button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleDocs.map((docItem) => {
            const firstPage = docItem.pages?.[0];
            const pageCount = docItem.pages?.length || 0;
            const isSelected = selectedIds.includes(docItem.id);
            const isPendingUpload = pendingIdSet.has(docItem.id);
            const patientName =
              patientsById.get(docItem.patientId)?.name || 'সদস্য';
            const docDoctorName = docItem.doctorId
              ? doctorsById.get(docItem.doctorId)?.name
              : undefined;

            return (
              <article
                key={docItem.id}
                onClick={() => {
                  if (selectionMode) {
                    toggleSelectId(docItem.id);
                  } else {
                    setViewingDoc(docItem);
                  }
                }}
                className={`bg-surface rounded-2xl border-2 p-4 shadow-xs space-y-3 cursor-pointer transition-colors ${
                  selectionMode && isSelected
                    ? 'border-primary bg-primary-soft/25'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="pt-1 shrink-0 text-primary">
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6" />
                      ) : (
                        <Square className="w-6 h-6 text-text-muted" />
                      )}
                    </div>
                  )}

                  {/* Thumbnail Preview */}
                  <div className="relative w-24 h-28 rounded-xl bg-surface-2 border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {firstPage?.thumb ? (
                      <img
                        src={firstPage.thumb}
                        alt={docItem.title}
                        style={{
                          transform: `rotate(${normalizeRotation(firstPage.rotation)}deg)`,
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-7 h-7 text-text-muted" />
                    )}

                    {pageCount > 1 && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[11px] font-bold">
                        {toBengaliNumber(pageCount)} পাতা
                      </span>
                    )}
                  </div>

                  {/* Metadata Summary */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-lg">
                        {formatBengaliDate(docItem.date)}
                      </span>
                      {docItem.reportType && (
                        <span className="text-xs font-semibold bg-surface-2 text-text px-2 py-0.5 rounded-lg border border-border">
                          {docItem.reportType}
                        </span>
                      )}
                      {isPendingUpload && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-warning-soft text-warning-text px-2 py-0.5 rounded-lg">
                          <CloudOff className="w-3 h-3" />
                          <span>আপলোড বাকি আছে</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-text line-clamp-2 leading-snug">
                      {docItem.title}
                    </h3>

                    <p className="text-xs text-text-muted">
                      সদস্য: <strong className="text-text">{patientName}</strong>
                      {docDoctorName && !fixedDoctor && (
                        <>
                          {' '}· <strong className="text-text">{docDoctorName}</strong>
                        </>
                      )}
                    </p>

                    {docItem.note && (
                      <p className="text-xs text-text-muted line-clamp-2">
                        {docItem.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                {!selectionMode && (
                  <div
                    className="flex items-center justify-end gap-2 pt-2 border-t border-border/70"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setViewingDoc(docItem)}
                      className="min-h-[42px] px-3 py-1.5 rounded-xl bg-primary-soft text-primary font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>দেখুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditUpload(docItem)}
                      className="min-h-[42px] px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-text font-bold text-xs sm:text-sm inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>সম্পাদনা</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDoc(docItem)}
                      aria-label="মুছুন"
                      className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-danger-soft text-danger-text cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Sticky Selection Bar for PDF Download */}
      {selectionMode && selectedIds.length > 0 && (
        <div className="sticky bottom-3 z-30 bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>
              {toBengaliNumber(selectedIds.length)} টি নির্বাচিত ({toBengaliNumber(selectedPageCount)} পাতা)
            </span>
          </div>

          <button
            type="button"
            onClick={() => handlePrintDocs(selectedDocsList)}
            className="min-h-[48px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span>PDF নামান</span>
          </button>
        </div>
      )}

      {/* Upload / Edit Modal */}
      {uploadModalOpen && (
        <DocumentUploadModal
          kind={kind}
          fixedDoctorId={fixedDoctor?.id}
          editingDocument={editingDoc}
          onClose={() => {
            setUploadModalOpen(false);
            setEditingDoc(null);
          }}
        />
      )}

      {/* Full-Screen Pinch-Zoom Viewer Modal */}
      {viewingDoc && (
        <DocumentViewerModal
          documentItem={viewingDoc}
          patients={patients}
          doctors={doctors}
          onClose={() => setViewingDoc(null)}
          onEdit={(d) => openEditUpload(d)}
          onScanPrescription={handleScanPrescriptionHandoff}
        />
      )}

      {/* Print / PDF Export Modal */}
      {printBundle && (
        <DocumentPrintModal
          bundle={printBundle}
          onClose={() => setPrintBundle(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setConfirmDeleteDoc(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-danger-soft text-danger-text flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">
                  ডকুমেন্টটি মুছে ফেলবেন?
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  <strong className="text-text">{confirmDeleteDoc.title}</strong> এবং এর{' '}
                  {toBengaliNumber(confirmDeleteDoc.pages?.length || 0)}টি ছবি স্থায়ীভাবে মুছে যাবে।
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                className="min-h-[48px] flex-1 px-4 py-2 bg-surface-2 border border-border text-text font-bold rounded-xl cursor-pointer"
              >
                থাক
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = confirmDeleteDoc.id;
                  setConfirmDeleteDoc(null);
                  void deleteMedicalDocument(targetId);
                }}
                className="min-h-[48px] flex-1 px-4 py-2 bg-danger text-white font-bold rounded-xl cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
