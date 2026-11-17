import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Image as ImageIcon,
  Loader2,
  Lock,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  MedicalDocument,
  MedicalDocumentKind,
  MedicalDocumentPageMeta,
} from '../../types';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { toLocalIsoDate } from '../../utils/shoppingListCalculator';
import {
  DOCUMENT_PRIVACY_NOTICE,
  MAX_DOCUMENT_PAGES,
  MAX_DOC_NOTE_LENGTH,
  MAX_DOC_TITLE_LENGTH,
  MAX_USER_DOCUMENT_PAGES,
  REPORT_TYPES,
  buildDefaultDocumentTitle,
  canAddUserPages,
  compressDocumentImageAndThumbnail,
  movePageInList,
  removePageFromList,
  rotateDegreeClockwise,
} from '../../utils/medicalDocuments';

interface DocumentUploadModalProps {
  kind: MedicalDocumentKind;
  fixedDoctorId?: string;
  editingDocument?: MedicalDocument | null;
  onClose: () => void;
}

interface PendingPageEntry {
  meta: MedicalDocumentPageMeta;
  isNew: boolean;
  fullDataUrl?: string;
  fullBytes?: number;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  kind,
  fixedDoctorId,
  editingDocument,
  onClose,
}) => {
  const {
    patients,
    activePatient,
    doctors,
    medicalDocuments,
    saveMedicalDocument,
  } = useMedicine();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const defaultPatientId =
    editingDocument?.patientId ||
    activePatient?.id ||
    activePatients[0]?.id ||
    'default-patient';

  const initialDoctorId =
    kind === 'prescription'
      ? editingDocument?.doctorId ?? fixedDoctorId ?? doctors[0]?.id ?? ''
      : editingDocument?.doctorId ?? '';

  const initialDate = editingDocument?.date || toLocalIsoDate(new Date());
  const initialReportType =
    kind === 'report' ? editingDocument?.reportType || REPORT_TYPES[0] : '';

  const initialDoctorName = doctors.find((d) => d.id === initialDoctorId)?.name;

  const [patientId, setPatientId] = useState(defaultPatientId);
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [date, setDate] = useState(initialDate);
  const [reportType, setReportType] = useState(initialReportType);
  const [title, setTitle] = useState(
    editingDocument?.title ||
      buildDefaultDocumentTitle(kind, {
        doctorName: initialDoctorName,
        reportType: initialReportType,
        date: initialDate,
      })
  );
  const [hasCustomTitle, setHasCustomTitle] = useState(Boolean(editingDocument));
  const [note, setNote] = useState(editingDocument?.note || '');

  const [pages, setPages] = useState<PendingPageEntry[]>(() =>
    editingDocument
      ? editingDocument.pages.map((p) => ({ meta: { ...p }, isNew: false }))
      : []
  );

  const [isCompressing, setIsCompressing] = useState(false);
  const [compressStatus, setCompressStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const syncAutoTitle = (
    nextDoctorId: string,
    nextReportType: string,
    nextDate: string
  ) => {
    if (hasCustomTitle) return;
    const dName = doctors.find((d) => d.id === nextDoctorId)?.name;
    setTitle(
      buildDefaultDocumentTitle(kind, {
        doctorName: dName,
        reportType: nextReportType,
        date: nextDate,
      })
    );
  };

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setErrorMsg('');

    const availableInDoc = MAX_DOCUMENT_PAGES - pages.length;
    if (availableInDoc <= 0) {
      setErrorMsg(`একটি নথিতে সর্বোচ্চ ${toBengaliNumber(MAX_DOCUMENT_PAGES)} পাতা যোগ করা যায়।`);
      return;
    }

    const filesToProcess = files.slice(0, availableInDoc);
    if (files.length > availableInDoc) {
      setErrorMsg(
        `একবারে সর্বোচ্চ ${toBengaliNumber(MAX_DOCUMENT_PAGES)} পাতা রাখা যায় — প্রথম ${toBengaliNumber(availableInDoc)}টি ছবি নেওয়া হয়েছে।`
      );
    }

    const projectedCheck = canAddUserPages(
      medicalDocuments,
      pages.length + filesToProcess.length,
      editingDocument?.pages.length || 0
    );
    if (!projectedCheck.allowed) {
      setErrorMsg(
        projectedCheck.reasonBn ||
          `মোট ${toBengaliNumber(MAX_USER_DOCUMENT_PAGES)} পাতার সীমা পূর্ণ হয়েছে।`
      );
      return;
    }

    setIsCompressing(true);
    const added: PendingPageEntry[] = [];

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        if (!file.type.startsWith('image/')) continue;
        setCompressStatus(
          `ছবি সংকুচিত হচ্ছে (${toBengaliNumber(i + 1)}/${toBengaliNumber(filesToProcess.length)})...`
        );
        const compressed = await compressDocumentImageAndThumbnail(file);
        const fileId = `mfile-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        added.push({
          meta: {
            fileId,
            thumb: compressed.thumbDataUrl,
            width: compressed.width,
            height: compressed.height,
            rotation: 0,
          },
          isNew: true,
          fullDataUrl: compressed.fullDataUrl,
          fullBytes: compressed.fullBytes,
        });
      }

      if (added.length === 0) {
        setErrorMsg('দয়া করে বৈধ ছবি (JPG বা PNG) নির্বাচন করুন।');
      } else {
        setPages((prev) => [...prev, ...added]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setIsCompressing(false);
      setCompressStatus('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (pages.length === 0) {
      setErrorMsg('অন্তত একটি ছবি যোগ করুন।');
      return;
    }

    if (kind === 'prescription' && !fixedDoctorId && !editingDocument && !doctorId) {
      setErrorMsg('প্রেসক্রিপশনের জন্য ডাক্তার নির্বাচন করুন।');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('অনুগ্রহ করে শিরোনাম লিখুন।');
      return;
    }

    setIsSaving(true);
    try {
      const newFiles = pages
        .filter((p) => p.isNew && p.fullDataUrl && p.fullBytes)
        .map((p) => ({
          id: p.meta.fileId,
          data: p.fullDataUrl!,
          bytes: p.fullBytes!,
        }));

      const res = await saveMedicalDocument(
        {
          id: editingDocument?.id,
          kind,
          patientId,
          doctorId: doctorId || undefined,
          title: title.trim(),
          date,
          note: note.trim() || undefined,
          reportType: kind === 'report' ? reportType || undefined : undefined,
          pages: pages.map((p) => p.meta),
        },
        newFiles
      );

      if (!res.ok) {
        setErrorMsg(res.error || 'সংরক্ষণ করা যায়নি।');
        return;
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const headingLabel = editingDocument
    ? kind === 'prescription'
      ? 'প্রেসক্রিপশন তথ্য সম্পাদনা'
      : 'রিপোর্ট তথ্য সম্পাদনা'
    : kind === 'prescription'
    ? 'নতুন প্রেসক্রিপশন যোগ করুন'
    : 'নতুন পরীক্ষার রিপোর্ট যোগ করুন';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
          <h2 className="text-xl font-bold text-text">{headingLabel}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="p-3 rounded-xl bg-primary-soft/70 border border-primary/25 text-xs sm:text-sm text-primary font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>{DOCUMENT_PRIVACY_NOTICE}</span>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Photo Capture / Multi-Select Pickers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-text">
                ছবি ({toBengaliNumber(pages.length)}/{toBengaliNumber(MAX_DOCUMENT_PAGES)} পাতা) *
              </label>
              <span className="text-xs text-text-muted">
                স্বয়ংক্রিয়ভাবে ছোট ও পরিষ্কার করে সেভ হবে
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isCompressing || pages.length >= MAX_DOCUMENT_PAGES}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[52px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Camera className="w-5 h-5" />
                <span>ক্যামেরা দিয়ে ছবি তুলুন</span>
              </button>

              <button
                type="button"
                disabled={isCompressing || pages.length >= MAX_DOCUMENT_PAGES}
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[52px] px-4 py-3 rounded-xl bg-surface-2 hover:bg-border/60 disabled:opacity-50 border border-border text-text font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ImageIcon className="w-5 h-5 text-primary" />
                <span>গ্যালারি থেকে বাছাই (একাধিক)</span>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void handleFilesSelected(e)}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void handleFilesSelected(e)}
              className="hidden"
            />

            {isCompressing && (
              <div className="p-3 rounded-xl bg-surface-2 border border-border text-sm font-semibold text-primary flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{compressStatus || 'ছবি প্রস্তুত হচ্ছে...'}</span>
              </div>
            )}

            {/* Selected Pages Preview, Rotate & Reorder List */}
            {pages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {pages.map((entry, idx) => (
                  <div
                    key={entry.meta.fileId}
                    className="bg-surface-2 border border-border rounded-xl p-2 space-y-2"
                  >
                    <div className="relative h-32 bg-black/10 dark:bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={entry.meta.thumb}
                        alt={`পাতা ${idx + 1}`}
                        style={{
                          transform: `rotate(${entry.meta.rotation || 0}deg)`,
                        }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/75 text-white text-[11px] font-bold">
                        পাতা {toBengaliNumber(idx + 1)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPages((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    meta: {
                                      ...p.meta,
                                      rotation: rotateDegreeClockwise(p.meta.rotation),
                                    },
                                  }
                                : p
                            )
                          )
                        }
                        title="ঘোরান"
                        className="min-h-[38px] min-w-[38px] flex-1 flex items-center justify-center rounded-lg bg-surface border border-border text-text hover:border-primary cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setPages((prev) => movePageInList(prev, idx, 'up'))
                        }
                        title="আগে আনুন"
                        className="min-h-[38px] min-w-[38px] flex-1 flex items-center justify-center rounded-lg bg-surface border border-border text-text disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() =>
                          setPages((prev) => movePageInList(prev, idx, 'down'))
                        }
                        title="পরে নিন"
                        className="min-h-[38px] min-w-[38px] flex-1 flex items-center justify-center rounded-lg bg-surface border border-border text-text disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPages((prev) => removePageFromList(prev, idx))
                        }
                        title="বাদ দিন"
                        className="min-h-[38px] min-w-[38px] flex-1 flex items-center justify-center rounded-lg bg-danger-soft text-danger-text cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date & Patient Profile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-sm font-bold text-text mb-1.5">
                তারিখ *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  syncAutoTitle(doctorId, reportType, nextDate);
                }}
                className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-text mb-1.5">
                পরিবারের সদস্য *
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
              >
                {activePatients.length === 0 ? (
                  <option value={defaultPatientId}>মূল প্রোফাইল</option>
                ) : (
                  activePatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relation})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Doctor (fixed or selectable) & Report Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {!fixedDoctorId && (
              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  ডাক্তার {kind === 'prescription' ? '*' : '(ঐচ্ছিক)'}
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => {
                    const nextDoc = e.target.value;
                    setDoctorId(nextDoc);
                    syncAutoTitle(nextDoc, reportType, date);
                  }}
                  className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                >
                  <option value="">
                    {kind === 'prescription' ? '— ডাক্তার ছাড়া / বাছাই করুন —' : 'ডাক্তার যুক্ত নেই'}
                  </option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {kind === 'report' && (
              <div className={fixedDoctorId ? 'sm:col-span-2' : ''}>
                <label className="block text-sm font-bold text-text mb-1.5">
                  রিপোর্টের ধরন
                </label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setReportType(nextType);
                    syncAutoTitle(doctorId, nextType, date);
                  }}
                  className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                >
                  {REPORT_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-text mb-1.5">
              শিরোনাম *
            </label>
            <input
              type="text"
              required
              maxLength={MAX_DOC_TITLE_LENGTH}
              value={title}
              onChange={(e) => {
                setHasCustomTitle(true);
                setTitle(e.target.value);
              }}
              placeholder="সংক্ষিপ্ত শিরোনাম লিখুন"
              className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-bold text-text mb-1.5">
              নোট / মন্তব্য (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              maxLength={MAX_DOC_NOTE_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: ফলো-আপ পরীক্ষার ফলাফল বা ডাক্তারের বিশেষ পরামর্শ"
              className="w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              disabled={isSaving || isCompressing}
              onClick={onClose}
              className="min-h-[48px] flex-1 px-4 py-2.5 bg-surface-2 border border-border text-text font-bold text-base rounded-xl cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSaving || isCompressing}
              className="min-h-[48px] flex-1 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-base rounded-xl shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>{editingDocument ? 'পরিবর্তন সংরক্ষণ করুন' : 'সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
