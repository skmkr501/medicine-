import React, { useState, useRef } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { GlobalMedicine, ImportPreviewRecord, ImportDataSource, ImportSourceType } from '../../types';
import {
  parseCSV,
  processImportPayload,
  getSampleDGDACSV,
  getSampleManufacturerCSV,
  getSampleIndependentJSON,
  getSampleMedExCSV,
  getSampleDIMSCSV,
  isTestMedicine,
} from '../../utils/medicineImportParser';
import {
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  Trash2,
  RotateCcw,
  Check,
  Eye,
  Info,
  Lock,
  LogIn,
  Building,
  Landmark,
  FileBadge,
  Clock,
  CheckSquare,
  Square,
  RefreshCw,
  Plus,
} from 'lucide-react';

export const AdminImportView: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    adminEmail,
    globalMedicines,
    importBatches,
    executeAdminBatchImport,
    openAuthModal,
    openManualAddModal,
    setCurrentPage,
    deleteGlobalMedicineAction,
    bulkDeleteGlobalMedicinesAction,
    publishGlobalMedicineAction,
    bulkPublishGlobalMedicinesAction,
    lastSyncTime,
    cloudStats,
    refreshCloudCounts,
  } = useMedicine();

  // Import configuration states
  const [sourceProfile, setSourceProfile] = useState<
    'dgda_gov' | 'manufacturer' | 'independent' | 'medex_licensed' | 'dims_licensed'
  >('dgda_gov');

  const [licenseReference, setLicenseReference] = useState('DGDA Public Gazette / National Formulary Open Data');
  const [writtenPermissionRef, setWrittenPermissionRef] = useState('');
  const [targetStatus, setTargetStatus] = useState<'published' | 'pending_verification'>('published');
  const [attestationAccepted, setAttestationAccepted] = useState(false);

  // File parsing states
  const [rawFileName, setRawFileName] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ImportPreviewRecord[]>([]);
  const [totalParsedCount, setTotalParsedCount] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Preview filtering & view state
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft / Unpublished Queue Management States & Handlers
  const [draftTabFilter, setDraftTabFilter] = useState<'all' | 'test_only'>('all');
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    medicines: GlobalMedicine[];
    isDeleting: boolean;
  }>({
    isOpen: false,
    medicines: [],
    isDeleting: false,
  });
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const unpublishedMedicines = globalMedicines.filter(
    (m) => m.status !== 'published' || !m.verifiedByAdmin
  );
  const testUnpublishedMedicines = unpublishedMedicines.filter((m) => isTestMedicine(m));

  const displayedDrafts =
    draftTabFilter === 'test_only' ? testUnpublishedMedicines : unpublishedMedicines;

  const toggleSelectDraft = (id: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTestDrafts = () => {
    const testIds = testUnpublishedMedicines.map((m) => m.id);
    const allSelected = testIds.length > 0 && testIds.every((id) => selectedDraftIds.has(id));
    if (allSelected) {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        testIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        testIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const promptSingleDraftDelete = (med: GlobalMedicine) => {
    setDeleteConfirmModal({
      isOpen: true,
      medicines: [med],
      isDeleting: false,
    });
  };

  const promptBulkDraftDelete = () => {
    const selectedMeds = globalMedicines.filter(
      (m) =>
        selectedDraftIds.has(m.id) &&
        (m.status !== 'published' || !m.verifiedByAdmin || isTestMedicine(m))
    );
    if (selectedMeds.length === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      medicines: selectedMeds,
      isDeleting: false,
    });
  };

  const handleConfirmDraftDelete = async () => {
    if (deleteConfirmModal.medicines.length === 0) return;
    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

    const ids = deleteConfirmModal.medicines.map((m) => m.id);
    if (ids.length === 1) {
      await deleteGlobalMedicineAction(ids[0]);
    } else {
      await bulkDeleteGlobalMedicinesAction(ids);
    }

    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    setDeleteConfirmModal({
      isOpen: false,
      medicines: [],
      isDeleting: false,
    });
  };

  const handleApproveDraft = async (medId: string) => {
    setApprovingId(medId);
    await publishGlobalMedicineAction(medId);
    setApprovingId(null);
  };

  // Check if current profile is MedEx or DIMS (requiring written authorization)
  const isLicensedPartnerProfile = sourceProfile === 'medex_licensed' || sourceProfile === 'dims_licensed';

  // Can user upload a file?
  const isUploadAllowed =
    licenseReference.trim().length > 0 &&
    (!isLicensedPartnerProfile || writtenPermissionRef.trim().length >= 4);

  // Handle Download Sample Templates
  const handleDownloadSample = (
    type: 'dgda_csv' | 'manufacturer_csv' | 'independent_json' | 'medex_csv' | 'dims_csv'
  ) => {
    let content = '';
    let fileName = '';
    let mimeType = 'text/csv';

    if (type === 'dgda_csv') {
      content = getSampleDGDACSV();
      fileName = 'dgda_bangladesh_formulary_template.csv';
    } else if (type === 'manufacturer_csv') {
      content = getSampleManufacturerCSV();
      fileName = 'manufacturer_official_monograph_template.csv';
    } else if (type === 'independent_json') {
      content = getSampleIndependentJSON();
      fileName = 'independent_verified_records_template.json';
      mimeType = 'application/json';
    } else if (type === 'medex_csv') {
      content = getSampleMedExCSV();
      fileName = 'sample_medex_authorized_template.csv';
    } else {
      content = getSampleDIMSCSV();
      fileName = 'sample_dims_authorized_template.csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle File Upload & Processing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!licenseReference.trim()) {
      alert('দয়া করে প্রথমে উৎস বা আইনি লাইসেন্স রেফারেন্স (License Reference) প্রদান করুন।');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isLicensedPartnerProfile && (!writtenPermissionRef || writtenPermissionRef.trim().length < 4)) {
      alert('আইনি কমপ্লায়েন্স: MedEx অথবা DIMS থেকে ডাটা আমদানির জন্য লিখিত অনুমতিপত্র বা চুক্তি রেফারেন্স নম্বর প্রদান বাধ্যতামূলক। কোনো স্বয়ংক্রিয় স্ক্র্যাপিং গ্রহণযোগ্য নয়।');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRawFileName(file.name);
    setIsProcessingFile(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsedRows: any[] = [];

        if (file.name.endsWith('.json')) {
          parsedRows = JSON.parse(text);
          if (!Array.isArray(parsedRows)) {
            alert('JSON ফাইলটি একটি array of objects হতে হবে।');
            setIsProcessingFile(false);
            return;
          }
        } else {
          parsedRows = parseCSV(text);
        }

        if (parsedRows.length === 0) {
          alert('ফাইলটিতে কোনো ডাটা রেকর্ড পাওয়া যায়নি।');
          setIsProcessingFile(false);
          return;
        }

        const result = processImportPayload(
          parsedRows,
          sourceProfile,
          globalMedicines,
          licenseReference.trim(),
          writtenPermissionRef.trim() || undefined,
          targetStatus
        );

        setPreviewRecords(result.previewRecords);
        setTotalParsedCount(result.totalCount);
        setValidCount(result.validCount);
        setDuplicateCount(result.duplicateCount);
        setErrorCount(result.errorCount);
      } catch (err: any) {
        console.error('File parse error:', err);
        alert('ফাইল প্রসেস করতে সমস্যা হয়েছে: ' + err.message);
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.readAsText(file);
  };

  // Toggle Duplicate Resolution between skip & update
  const toggleDuplicateResolution = (tempId: string) => {
    setPreviewRecords((prev) =>
      prev.map((rec) => {
        if (rec.tempId === tempId) {
          const nextRes = rec.duplicateResolution === 'update' ? 'skip' : 'update';
          return { ...rec, duplicateResolution: nextRes };
        }
        return rec;
      })
    );
  };

  // Cancel / Reset Import
  const handleCancelImport = () => {
    setRawFileName('');
    setPreviewRecords([]);
    setTotalParsedCount(0);
    setValidCount(0);
    setDuplicateCount(0);
    setErrorCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm & Execute Batch Import
  const handleConfirmImport = async () => {
    if (!isAdmin) {
      alert('শুধুমাত্র অনুমোদিত অ্যাডমিন ডাটা ইমপোর্ট করতে পারবেন।');
      return;
    }
    if (!attestationAccepted) {
      alert('ইমপোর্ট করার পূর্বে আইনি সম্মতি ও নিশ্চিতকরণ চেকবক্স নির্বাচন করুন।');
      return;
    }

    // Filter records that will be imported (valid records + duplicates set to 'update')
    const recordsToImport: GlobalMedicine[] = [];

    previewRecords.forEach((item, index) => {
      if (item.validationStatus === 'valid') {
        recordsToImport.push(item.record as GlobalMedicine);
      } else if (item.validationStatus === 'duplicate' && item.duplicateResolution === 'update') {
        recordsToImport.push({
          ...(item.record as GlobalMedicine),
          id: item.existingId || `gmed_upd_${Date.now()}_${index}`,
        });
      }
    });

    if (recordsToImport.length === 0) {
      alert('ইমপোর্ট করার মতো কোনো বৈধ রেকর্ড নির্বাচিত নেই।');
      return;
    }

    let sourceVal: ImportDataSource = 'DGDA_GOV';
    let sourceTypeVal: ImportSourceType = 'government';

    if (sourceProfile === 'manufacturer') {
      sourceVal = 'MANUFACTURER';
      sourceTypeVal = 'manufacturer';
    } else if (sourceProfile === 'independent') {
      sourceVal = 'INDEPENDENT_VERIFIED';
      sourceTypeVal = 'independent';
    } else if (sourceProfile === 'medex_licensed') {
      sourceVal = 'MEDEX_LICENSED';
      sourceTypeVal = 'licensed_partner';
    } else if (sourceProfile === 'dims_licensed') {
      sourceVal = 'DIMS_LICENSED';
      sourceTypeVal = 'licensed_partner';
    }

    const publishedCount = targetStatus === 'published' ? recordsToImport.length : 0;
    const pendingVerificationCount = targetStatus === 'pending_verification' ? recordsToImport.length : 0;

    setIsSubmitting(true);
    const success = await executeAdminBatchImport(
      {
        source: sourceVal,
        sourceProfile: sourceProfile,
        sourceType: sourceTypeVal,
        licenseReference: licenseReference.trim(),
        writtenPermissionRef: writtenPermissionRef.trim() || undefined,
        attestationAccepted: true,
        totalRecordsInFile: totalParsedCount,
        validRecordsCount: validCount,
        duplicateRecordsCount: duplicateCount,
        errorRecordsCount: errorCount,
        publishedCount,
        pendingVerificationCount,
        status: 'completed',
        fileName: rawFileName,
      },
      recordsToImport
    );

    setIsSubmitting(false);
    if (success) {
      handleCancelImport();
      setCurrentPage('library');
    }
  };

  // Filtered Preview Records
  const filteredPreview = previewRecords.filter((rec) => {
    if (previewFilter === 'valid') return rec.validationStatus === 'valid';
    if (previewFilter === 'duplicate') return rec.validationStatus === 'duplicate';
    if (previewFilter === 'error') return rec.validationStatus === 'error';
    return true;
  });

  // Guard: If not admin, show locked view with login button
  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              অ্যাডমিন অনুমোদন প্রয়োজন
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              এই অংশে প্রবেশ ও পরিবর্তনের সুযোগ শুধুমাত্র অনুমোদিত অ্যাডমিনের জন্য সংরক্ষিত।
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUser ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                বর্তমান অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>অ্যাডমিন একাউন্টে লগইন করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrentPage('library')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              ওষুধ লাইব্রেরিতে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300">
              <UploadCloud className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              ওষুধ ক্যাটালগ অ্যাডমিন ইমপোর্ট
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              আইনি কমপ্লায়েন্স মোড
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            আইনানুগ উন্মুক্ত সরকারি গেজেট (DGDA), প্রস্তুতকারকের অফিশিয়াল মনোগ্রাফ, স্বাধীনভাবে যাচাইকৃত রেকর্ড অথবা লিখিত অনুমতিপ্রাপ্ত পার্টনার ফাইল বাল্ক ইমপোর্ট ও যাচাইকরণ ব্যবস্থা।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openManualAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="ফরম পূরণ করে একটি ওষুধ সরাসরি ক্লাউড লাইব্রেরিতে যুক্ত করুন"
          >
            <Plus className="w-4 h-4" />
            <span>ম্যানুয়ালি ওষুধ যোগ</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            লাইব্রেরি দেখুন ({globalMedicines.length})
          </button>
        </div>
      </div>

      {/* Compact Cloud Firestore Status Bar (Requirement 6) */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 rounded-2xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ক্লাউড স্ট্যাটাস:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 dark:bg-slate-700 text-slate-200 border border-slate-700">
              ক্লাউডে মোট <strong className="text-white font-bold">{cloudStats.total}</strong> টি
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60">
              প্রকাশিত <strong className="font-bold">{cloudStats.published}</strong> টি
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800/60">
              খসড়া <strong className="font-bold">{cloudStats.draft}</strong> টি
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          {lastSyncTime && (
            <span>শেষ সিঙ্ক: <strong className="text-slate-300">{lastSyncTime}</strong></span>
          )}
          <button
            type="button"
            onClick={refreshCloudCounts}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors cursor-pointer"
            title="ক্লাউড থেকে সরাসরি নিশ্চিত সংখ্যা যাচাই করুন"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Strict Legal Compliance Banner (Requirements 1, 2, 3, 4, 5, 6) */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 text-xs text-emerald-950 dark:text-emerald-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>আইনি কমপ্লায়েন্স ও মেধাস্বত্ব সুরক্ষা ফ্রেমওয়ার্ক (Legal Compliance Standards)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed pt-1">
          <div className="p-2.5 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <strong className="block text-emerald-900 dark:text-emerald-300 mb-0.5">১. স্ক্র্যাপিং সম্পূর্ণ নিষিদ্ধ</strong>
            MedEx বা DIMS থেকে কোনো অটোমেটেড স্ক্র্যাপিং সমর্থন করা হয় না। ডাটাবেজে কেবল অনুমোদিত উপায়ে সংরক্ষিত তথ্য আমদানি সম্ভব।
          </div>
          <div className="p-2.5 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <strong className="block text-emerald-900 dark:text-emerald-300 mb-0.5">২. উন্মুক্ত সরকারি ও কোম্পানি ডাটা</strong>
            ডিজিডিএ সরকারি ড্রাগ গেজেট এবং ওষুধ প্রস্তুতকারকদের পাবলিক প্রোডাক্ট মনোগ্রাফ আইনিভাবে সরাসরি পুনর্ব্যবহারযোগ্য।
          </div>
          <div className="p-2.5 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <strong className="block text-emerald-900 dark:text-emerald-300 mb-0.5">৩. যাচাই না হওয়া পর্যন্ত অপ্রকাশিত</strong>
            প্রতিটি রেকর্ডে উৎস ও লাইসেন্স আবশ্যক। খসড়া বা অপ্রকাশিত রেকর্ড সাধারণ ব্যবহারকারীদের লাইব্রেরিতে দৃশ্যমান হবে না।
          </div>
        </div>
      </div>

      {/* Step 1: Configuration & Profile Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Card: Import Setup */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
              ১
            </span>
            <span>উৎস নির্বাচন ও আইনি সনদ কনফিগারেশন</span>
          </h2>

          {/* Source Profile Switcher (5 Legally Compliant Categories) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              ডাটা উৎস প্রোফাইল নির্বাচন করুন (Compliant Source Profile)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Option 1: DGDA Government Open Data */}
              <button
                type="button"
                onClick={() => setSourceProfile('dgda_gov')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  sourceProfile === 'dgda_gov'
                    ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 ring-1 ring-teal-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-teal-600" />
                    DGDA সরকারি উন্মুক্ত গেজেট
                  </span>
                  {sourceProfile === 'dgda_gov' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  আইনানুগ মুক্ত পাবলিক ড্রাগ রেজিস্টার ও জাতীয় ফরমুলা ডাটাবেজ
                </p>
              </button>

              {/* Option 2: Manufacturer Official Monograph */}
              <button
                type="button"
                onClick={() => setSourceProfile('manufacturer')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  sourceProfile === 'manufacturer'
                    ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 ring-1 ring-teal-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-teal-600" />
                    প্রস্তুতকারকের মনোগ্রাফ / মূল্যতালিকা
                  </span>
                  {sourceProfile === 'manufacturer' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ফার্মাসিউটিক্যাল কোম্পানি কর্তৃক আনুষ্ঠানিকভাবে প্রকাশিত প্রোডাক্ট তালিকা
                </p>
              </button>

              {/* Option 3: Independent Verified Dataset */}
              <button
                type="button"
                onClick={() => setSourceProfile('independent')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  sourceProfile === 'independent'
                    ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 ring-1 ring-teal-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileBadge className="w-3.5 h-3.5 text-teal-600" />
                    স্বাধীন ও ক্লিনিক্যাল যাচাইকৃত রেকর্ড
                  </span>
                  {sourceProfile === 'independent' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ক্লিনিক্যাল টিম ও চিকিৎসকদের দ্বারা নিজস্বভাবে প্রস্তুতকৃত ও পর্যালোচিত তথ্য
                </p>
              </button>

              {/* Option 4: MedEx (Written Permission Required) */}
              <button
                type="button"
                onClick={() => setSourceProfile('medex_licensed')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  sourceProfile === 'medex_licensed'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    MedEx (লিখিত অনুমতি সাপেক্ষে)
                  </span>
                  {sourceProfile === 'medex_licensed' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  কেবলমাত্র নথিবদ্ধ লিখিত লাইসেন্স বা পার্টনার চুক্তি সাপেক্ষে অনুমোদিত
                </p>
              </button>

              {/* Option 5: DIMS (Written Permission Required) */}
              <button
                type="button"
                onClick={() => setSourceProfile('dims_licensed')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer sm:col-span-2 ${
                  sourceProfile === 'dims_licensed'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    DIMS Bangladesh (ITmedicus) (লিখিত চুক্তি সাপেক্ষে)
                  </span>
                  {sourceProfile === 'dims_licensed' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  আইটিমেডিকাস (ITmedicus) এর সাথে স্বাক্ষরিত পার্টনারশিপ বা লিখিত সম্মতি নম্বর বাধ্যতামূলক
                </p>
              </button>

            </div>
          </div>

          {/* Conditional Written Permission Ref Input for MedEx/DIMS (Requirement 2) */}
          {isLicensedPartnerProfile && (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <FileBadge className="w-4 h-4 text-amber-600" />
                <span>লিখিত অনুমতি / লাইসেন্স চুক্তি রেফারেন্স নম্বর (Documented Written Permission Ref) *</span>
              </label>
              <input
                type="text"
                value={writtenPermissionRef}
                onChange={(e) => setWrittenPermissionRef(e.target.value)}
                placeholder="যেমন: MEDEX-PARTNER-AGREEMENT-2026/05 অথবা DIMS-AUTH-LICENSE-771"
                className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                <span className="font-bold">আইনি বাধ্যবাধকতা:</span> লিখিত চুক্তি নম্বর ব্যতীত MedEx/DIMS ফাইল প্রসেস করা হবে না। স্ক্র্যাপিং বা কপি করা সম্পূর্ণ নিষিদ্ধ।
              </p>
            </div>
          )}

          {/* Mandatory Source & License Reference (Requirement 5) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>আইনি উৎস ও লাইসেন্স তথ্য (Source & License Information) *</span>
            </label>
            <input
              type="text"
              value={licenseReference}
              onChange={(e) => setLicenseReference(e.target.value)}
              placeholder={
                sourceProfile === 'dgda_gov'
                  ? 'যেমন: DGDA Public Gazette Vol 2026 / National Formulary Open Data'
                  : sourceProfile === 'manufacturer'
                  ? 'যেমন: Square Pharma Official Monograph 2026 / Beximco Product List'
                  : 'যেমন: Clinical Pharmacy Review Committee Batch #14'
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-teal-500"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              প্রতিটি ওষুধ রেকর্ডের সাথে এই লাইসেন্স ও উৎস রেফারেন্স সংরক্ষিত থাকবে।
            </span>
          </div>

          {/* Verification & Publication Workflow Control (Requirement 6) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              প্রকাশনা ও যাচাইকরণ স্থিতি (Publication & Verification Policy)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  targetStatus === 'published'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  checked={targetStatus === 'published'}
                  onChange={() => setTargetStatus('published')}
                  className="text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                />
                <span>যাচাইকৃত হিসেবে অবিলম্বে প্রকাশ করুন (Published)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  targetStatus === 'pending_verification'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  checked={targetStatus === 'pending_verification'}
                  onChange={() => setTargetStatus('pending_verification')}
                  className="text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                />
                <span>অপ্রকাশিত খসড়া রাখুন (Keep Unpublished / Pending)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {targetStatus === 'pending_verification'
                ? 'বিজ্ঞপ্তি: অপ্রকাশিত রেকর্ডগুলো সাধারণ রোগীদের সার্চে প্রদর্শিত হবে না যতক্ষণ না অ্যাডমিন প্যানেল থেকে চূড়ান্ত অনুমোদন দেওয়া হয়।'
                : 'বিজ্ঞপ্তি: প্রশাসক কর্তৃক অনুমোদিত হয়ে বৈধ রেকর্ডগুলো অবিলম্বে সার্বজনীন লাইব্রেরিতে উন্মুক্ত হবে।'}
            </p>
          </div>

          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CSV অথবা JSON ফাইল আপলোড করুন
            </label>
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                !isUploadAllowed
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 opacity-70 cursor-not-allowed'
                  : 'border-slate-300 dark:border-slate-700 hover:border-teal-500/80 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                disabled={!isUploadAllowed}
                onChange={handleFileUpload}
                className="hidden"
                id="medicine-file-input"
              />
              <label
                htmlFor={isUploadAllowed ? 'medicine-file-input' : undefined}
                className={`flex flex-col items-center justify-center gap-2 ${
                  !isUploadAllowed ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
                    !isUploadAllowed
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
                  }`}
                >
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span
                    className={`text-xs font-bold ${
                      !isUploadAllowed
                        ? 'text-slate-400'
                        : 'text-teal-700 dark:text-teal-400 hover:underline'
                    }`}
                  >
                    {!isUploadAllowed
                      ? 'প্রথমে উপরের আবশ্যক লাইসেন্স ও রেফারেন্স পূরণ করুন'
                      : 'ফাইল নির্বাচন করুন (Browse File)'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                    CSV অথবা JSON ফরম্যাট ফাইল নির্বাচন করুন
                  </span>
                </div>
                {rawFileName && (
                  <div className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                    <span>{rawFileName}</span>
                  </div>
                )}
              </label>
            </div>
          </div>

        </div>

        {/* Right Card: Sample Legal Templates */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-600" />
              <span>আইনসম্মত নমুনা টেমপ্লেট (Templates)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              আইনি ঝুঁকি এড়িয়ে সরকারি উন্মুক্ত গেজেট ও প্রস্তুতকারকের স্পেসিফিকেশন অনুযায়ী ফরম্যাটেড নমুনা ডাটা:
            </p>

            <div className="space-y-2 text-xs">
              {/* DGDA Govt Open Data CSV */}
              <button
                type="button"
                onClick={() => handleDownloadSample('dgda_csv')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-teal-600" />
                  <span>DGDA সরকারি উন্মুক্ত গেজেট CSV</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Manufacturer Official Monograph CSV */}
              <button
                type="button"
                onClick={() => handleDownloadSample('manufacturer_csv')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-600" />
                  <span>প্রস্তুতকারক মনোগ্রাফ CSV</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Independently Verified JSON */}
              <button
                type="button"
                onClick={() => handleDownloadSample('independent_json')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-teal-600" />
                  <span>স্বাধীন ক্লিনিক্যাল রেকর্ড JSON</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* MedEx Partner CSV */}
              <button
                type="button"
                onClick={() => handleDownloadSample('medex_csv')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>MedEx লাইসেন্স ফরম্যাট CSV</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* DIMS Partner CSV */}
              <button
                type="button"
                onClick={() => handleDownloadSample('dims_csv')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>DIMS বাংলাদেশ ফরম্যাট CSV</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

            </div>
          </div>

          {/* Duplicate Detection Formula Info */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              ডুপ্লিকেট শনাক্তকরণ সূচক:
            </span>
            <p>
              ব্র্যান্ড নাম + জেনেরিক নাম + শক্তি + ডোজের ধরন + প্রস্তুতকারক প্রতিষ্ঠান
            </p>
          </div>
        </div>

      </div>

      {/* Step 2: Import Preview and Validation Report */}
      {previewRecords.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
                  ২
                </span>
                <span>ইমপোর্ট প্রিভিউ ও কমপ্লায়েন্স রিপোর্ট</span>
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ফাইল: <strong>{rawFileName}</strong> (প্রোফাইল: {sourceProfile} | স্থিতি: {targetStatus === 'published' ? 'যাচাইকৃত প্রকাশিত' : 'অপ্রকাশিত খসড়া'})
              </span>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancelImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>বাতিল করুন</span>
            </button>
          </div>

          {/* Validation Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[11px] block">মোট রেকর্ড</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">
                {totalParsedCount}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/80">
              <span className="text-emerald-700 dark:text-emerald-400 text-[11px] block flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                বৈধ রেকর্ড
              </span>
              <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 block">
                {validCount}
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/80">
              <span className="text-amber-700 dark:text-amber-400 text-[11px] block flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                ডুপ্লিকেট রেকর্ড
              </span>
              <span className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">
                {duplicateCount}
              </span>
            </div>

            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/80">
              <span className="text-rose-700 dark:text-rose-400 text-[11px] block flex items-center gap-1 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                ত্রুটিযুক্ত রেকর্ড
              </span>
              <span className="text-xl font-bold text-rose-800 dark:text-rose-300 mt-0.5 block">
                {errorCount}
              </span>
            </div>
          </div>

          {/* Preview Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
            <button
              type="button"
              onClick={() => setPreviewFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              সকল ({previewRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setPreviewFilter('valid')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewFilter === 'valid'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
              }`}
            >
              বৈধ ({validCount})
            </button>
            <button
              type="button"
              onClick={() => setPreviewFilter('duplicate')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewFilter === 'duplicate'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
              }`}
            >
              ডুপ্লিকেট ({duplicateCount})
            </button>
            <button
              type="button"
              onClick={() => setPreviewFilter('error')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewFilter === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
              }`}
            >
              ত্রুটিযুক্ত ({errorCount})
            </button>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5 font-bold">স্থিতি</th>
                  <th className="px-3 py-2.5 font-bold">ব্র্যান্ড নাম</th>
                  <th className="px-3 py-2.5 font-bold">জেনেরিক নাম</th>
                  <th className="px-3 py-2.5 font-bold">শক্তি ও ধরন</th>
                  <th className="px-3 py-2.5 font-bold">কোম্পানি</th>
                  <th className="px-3 py-2.5 font-bold">উৎস ও লাইসেন্স</th>
                  <th className="px-3 py-2.5 font-bold">পদক্ষেপ / নোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPreview.map((item) => {
                  const rec = item.record;
                  return (
                    <tr
                      key={item.tempId}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                        item.validationStatus === 'error'
                          ? 'bg-rose-50/20 dark:bg-rose-950/10'
                          : item.validationStatus === 'duplicate'
                          ? 'bg-amber-50/20 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.validationStatus === 'valid' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            বৈধ
                          </span>
                        )}
                        {item.validationStatus === 'duplicate' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            ডুপ্লিকেট
                          </span>
                        )}
                        {item.validationStatus === 'error' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />
                            ত্রুটি
                          </span>
                        )}
                      </td>

                      {/* Brand Name */}
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {rec.brandName || <span className="text-rose-500 italic">অনুপস্থিত</span>}
                      </td>

                      {/* Generic Name */}
                      <td className="px-3 py-2.5">
                        {rec.genericName || <span className="text-rose-500 italic">অনুপস্থিত</span>}
                      </td>

                      {/* Strength & Dosage Form */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {rec.strength || '—'}
                        </span>
                        <span className="text-slate-400 block text-[11px]">
                          {rec.dosageForm || '—'}
                        </span>
                      </td>

                      {/* Manufacturer */}
                      <td className="px-3 py-2.5 truncate max-w-[150px]" title={rec.manufacturer}>
                        {rec.manufacturer || <span className="text-rose-500 italic">অনুপস্থিত</span>}
                      </td>

                      {/* Source & License */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                        <span className="font-semibold text-teal-800 dark:text-teal-300 block">
                          {rec.source}
                        </span>
                        <span className="text-slate-400 truncate max-w-[150px] block" title={rec.licenseReference}>
                          {rec.licenseReference}
                        </span>
                      </td>

                      {/* Actions / Duplicate Resolution */}
                      <td className="px-3 py-2.5 text-[11px]">
                        {item.validationStatus === 'duplicate' ? (
                          <button
                            type="button"
                            onClick={() => toggleDuplicateResolution(item.tempId)}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] cursor-pointer transition-colors ${
                              item.duplicateResolution === 'update'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.duplicateResolution === 'update'
                              ? 'হালনাগাদ হবে (Update)'
                              : 'বাদ যাবে (Skip)'}
                          </button>
                        ) : item.validationStatus === 'error' ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {item.validationErrors.join(', ')}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ইমপোর্টের জন্য প্রস্তুত
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legal Attestation & Final Confirmation (Requirements 1, 2, 5, 8, 9) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={attestationAccepted}
                onChange={(e) => setAttestationAccepted(e.target.checked)}
                className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 h-4 w-4 shrink-0"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                আমি স্বাস্থ্যবন্ধু অ্যাপ্লিকেশন প্রশাসক হিসেবে আনুষ্ঠানিকভাবে প্রত্যয়ন করছি যে:
                <br />
                ১. এই ফাইলের ওষুধ তথ্যাবলী কোনো অননুমোদিত অটোমেটেড স্ক্র্যাপিং ছাড়া আইনানুগ উৎস (DGDA উন্মুক্ত গেজেট, প্রস্তুতকারকের মনোগ্রাফ, ক্লিনিক্যাল যাচাইকৃত ডাটা বা স্বাক্ষরিত অনুমতিপত্র) থেকে সংগৃহীত।
                <br />
                ২. লাইসেন্স/অনুমতি রেফারেন্স নম্বর <strong>"{licenseReference || '...'}"</strong> সত্য ও প্রামাণিক।
                <br />
                ৩. {targetStatus === 'published' ? 'যাচাইকৃত রেকর্ডগুলো সার্বজনীন ক্যাটালগে অবিলম্বে প্রকাশিত হবে।' : 'অযাচাইকৃত রেকর্ডগুলো খসড়া হিসেবে অপ্রকাশিত রাখা হবে।'}
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ইমপোর্ট হতে যাচ্ছে: <strong className="text-slate-900 dark:text-white font-bold">{validCount + previewRecords.filter((r) => r.duplicateResolution === 'update').length}</strong> টি ওষুধ ({targetStatus === 'published' ? 'প্রকাশিত' : 'অপ্রকাশিত খসড়া'})
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  বাতিল
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isSubmitting || !attestationAccepted}
                  className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                    isSubmitting || !attestationAccepted
                      ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
                      : 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'ইমপোর্ট প্রক্রিয়াধীন...'
                      : targetStatus === 'published'
                      ? 'অনুমোদন ও ক্যাটালগে প্রকাশ করুন'
                      : 'খসড়া হিসেবে সংরক্ষণ করুন'}
                  </span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Step 3: Audit Trail of Past Import Batches */}
      {importBatches.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            <span>অ্যাডমিন ইমপোর্ট অডিট হিস্টোরি (Audit Trail)</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2 font-bold">তারিখ ও সময়</th>
                  <th className="px-3 py-2 font-bold">উৎস কাঠামো</th>
                  <th className="px-3 py-2 font-bold">লাইসেন্স রেফারেন্স</th>
                  <th className="px-3 py-2 font-bold">অনুমতি সনদ</th>
                  <th className="px-3 py-2 font-bold">মোট / প্রকাশিত</th>
                  <th className="px-3 py-2 font-bold">প্রশাসক ইমেইল</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {importBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      {new Date(batch.importedAt).toLocaleString('bn-BD')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-teal-700 dark:text-teal-400">
                      {batch.source} ({batch.sourceProfile})
                    </td>
                    <td className="px-3 py-2 truncate max-w-[200px]" title={batch.licenseReference}>
                      {batch.licenseReference}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      {batch.writtenPermissionRef || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <strong className="text-emerald-600">{batch.publishedCount}</strong> / {batch.totalRecordsInFile} টি
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      {batch.importedByEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Draft / Unpublished Queue Management & Safe TEST DATA Deletion */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                অপেক্ষমাণ খসড়া ও টেস্ট ডাটা কিউ (Draft / Unpublished Queue)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              যেসকল ওষুধ এখনো সাধারণ ব্যবহারকারীদের জন্য প্রকাশিত হয়নি। টেস্ট ডাটা রেকর্ড নির্বাচন করে নিরাপদে মুছে ফেলতে পারেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unpublishedMedicines.length > 0 && (
              <button
                type="button"
                onClick={() => bulkPublishGlobalMedicinesAction()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                title="সকল অপ্রকাশিত খসড়া ওষুধ সরাসরি ক্লাউডে সার্বজনীন প্রকাশ করুন"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>সব খসড়া সরাসরি প্রকাশ করুন ({unpublishedMedicines.length} টি)</span>
              </button>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDraftTabFilter('all')}
                className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  draftTabFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                সকল খসড়া ({unpublishedMedicines.length})
              </button>
              <button
                type="button"
                onClick={() => setDraftTabFilter('test_only')}
                className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  draftTabFilter === 'test_only'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400'
                }`}
              >
                শুধুমাত্র TEST DATA ({testUnpublishedMedicines.length})
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar for Selected Drafts */}
        {displayedDrafts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllTestDrafts}
                className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {testUnpublishedMedicines.length > 0 &&
                testUnpublishedMedicines.every((m) => selectedDraftIds.has(m.id)) ? (
                  <CheckSquare className="w-4 h-4 text-rose-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>সকল TEST DATA নির্বাচন করুন ({testUnpublishedMedicines.length} টি)</span>
              </button>

              {selectedDraftIds.size > 0 && (
                <span className="text-slate-500 font-medium">
                  (নির্বাচিত: <strong className="text-rose-600 font-bold">{selectedDraftIds.size}</strong> টি)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedDraftIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedDraftIds(new Set())}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                  >
                    নির্বাচন বাতিল
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkPublishGlobalMedicinesAction(Array.from(selectedDraftIds))}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                    title="নির্বাচিত খসড়া ওষুধগুলো সরাসরি ক্লাউডে প্রকাশ করুন"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>নির্বাচিত প্রকাশ ({selectedDraftIds.size} টি)</span>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={selectedDraftIds.size === 0}
                onClick={promptBulkDraftDelete}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-xl transition-colors shadow-xs ${
                  selectedDraftIds.size > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedDraftIds.size > 0
                    ? `নির্বাচিত ${selectedDraftIds.size} টি TEST DATA মুছুন`
                    : 'বাল্ক মুছুন (Bulk Delete)'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Draft List / Table */}
        {displayedDrafts.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">
                    <span className="sr-only">নির্বাচন</span>
                  </th>
                  <th className="px-3 py-2.5 font-bold">ব্র্যান্ড ও জেনেরিক নাম</th>
                  <th className="px-3 py-2.5 font-bold">ডোজ ও শক্তি</th>
                  <th className="px-3 py-2.5 font-bold">কোম্পানি</th>
                  <th className="px-3 py-2.5 font-bold">স্ট্যাটাস / ট্যাগ</th>
                  <th className="px-3 py-2.5 font-bold">উৎস ও DAR</th>
                  <th className="px-3 py-2.5 font-bold text-right">কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedDrafts.map((med) => {
                  const isTest = isTestMedicine(med);
                  const isSelected = selectedDraftIds.has(med.id);

                  return (
                    <tr
                      key={med.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        {isTest ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectDraft(med.id)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                            aria-label={`${med.brandName} নির্বাচন করুন`}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {med.brandName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {med.genericName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-slate-700 dark:text-slate-300 block">
                          {med.strength}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {med.dosageForm}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[160px]" title={med.manufacturer}>
                        {med.manufacturer}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            অপ্রকাশিত খসড়া
                          </span>
                          {isTest && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              TEST DATA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-500">
                        <span>{med.source}</span>
                        {med.darNumber && (
                          <span className="block text-[10px] text-slate-400">
                            {med.darNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={approvingId === med.id}
                            onClick={() => handleApproveDraft(med.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer transition-colors"
                            title="যাচাই ও সার্বজনীন প্রকাশ করুন"
                          >
                            <Check className="w-3 h-3 inline mr-1" />
                            <span>{approvingId === med.id ? 'প্রকাশ হচ্ছে...' : 'অনুমোদন'}</span>
                          </button>

                          {/* Safe Delete Draft / TEST DATA Option */}
                          <button
                            type="button"
                            onClick={() => promptSingleDraftDelete(med)}
                            className="p-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 rounded-lg border border-rose-200 dark:border-rose-900/50 cursor-pointer transition-colors"
                            title="এই খসড়া টেস্ট রেকর্ডটি নিরাপদে মুছে ফেলুন"
                            aria-label={`${med.brandName} মুছে ফেলুন`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              বর্তমানে কোনো অপ্রকাশিত খসড়া বা টেস্ট রেকর্ড অবশিষ্ট নেই
            </p>
            <p className="text-[11px]">
              নতুন ফাইল ইমপোর্ট করলে যাচাইকরণের জন্য তা এই কিউতে জমা হবে।
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Safe Draft Deletion in AdminImportView */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  TEST DATA মুছে ফেলার নিশ্চিতকরণ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে খসড়া কিউ থেকে নির্বাচিত{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">
                    {deleteConfirmModal.medicines.length}
                  </strong>{' '}
                  টি টেস্ট রেকর্ড মুছে ফেলতে চান?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/80 max-h-48 overflow-y-auto space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                মুছে ফেলার জন্য নির্বাচিত রেকর্ড ({deleteConfirmModal.medicines.length} টি):
              </span>
              {deleteConfirmModal.medicines.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {m.brandName}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {m.genericName} • {m.strength} • {m.dosageForm}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 shrink-0 border border-rose-200 dark:border-rose-900/60">
                    TEST DATA
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ডেটা সুরক্ষা ও নিরাপত্তা নিশ্চয়তা (Safety Guarantee):</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                এই অ্যাকশনটি কোনো <strong>প্রকাশিত বাস্তব ওষুধ</strong>, <strong>ব্যক্তিগত আমার ওষুধ তালিকা</strong>, <strong>রোগীর প্রোফাইল</strong> কিংবা <strong>ডোজ লগ</strong> স্পর্শ করবে না। শুধুমাত্র নির্বাচিত খসড়া টেস্ট ডাটা স্থায়ীভাবে মুছে যাবে।
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={() => setDeleteConfirmModal({ isOpen: false, medicines: [], isDeleting: false })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={handleConfirmDraftDelete}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteConfirmModal.isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, নিশ্চিতভাবে মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
