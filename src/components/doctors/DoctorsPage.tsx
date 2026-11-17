import React, { useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { DoctorProfile } from '../../types';
import { formatBengaliDate, toBengaliNumber } from '../../utils/bengaliUtils';
import {
  DoctorProfileInput,
  buildDoctorNextVisitAppointmentPayload,
  filterDoctors,
  formatVisitCountdownBn,
  sortDoctors,
  validateBangladeshiPhone,
} from '../../utils/doctorsManager';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CalendarPlus,
  Clock,
  Edit2,
  FileText,
  MapPin,
  MessageCircle,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Star,
  Stethoscope,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { DocumentsVaultTab } from './DocumentsVaultTab';

interface DoctorFormState {
  name: string;
  specialty: string;
  phone: string;
  whatsapp: string;
  sameAsPhoneForWa: boolean;
  hospital: string;
  address: string;
  visitingHours: string;
  forConditions: string;
  patientIds: string[];
  lastVisitDate: string;
  nextVisitDate: string;
  notes: string;
  isEmergency: boolean;
}

const EMPTY_FORM: DoctorFormState = {
  name: '',
  specialty: '',
  phone: '',
  whatsapp: '',
  sameAsPhoneForWa: false,
  hospital: '',
  address: '',
  visitingHours: '',
  forConditions: '',
  patientIds: [],
  lastVisitDate: '',
  nextVisitDate: '',
  notes: '',
  isEmergency: false,
};

export const DoctorsPage: React.FC = () => {
  const {
    doctors,
    isLoadingDoctors,
    loadDoctors,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    medicalDocuments,
    loadMedicalDocuments,
    unlinkOrDeleteDoctorPrescriptions,
    patients,
    activePatient,
    addAppointment,
    setCurrentPage,
    showToast,
  } = useMedicine();

  useEffect(() => {
    void loadDoctors();
    void loadMedicalDocuments();
  }, []);

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const [mainTab, setMainTab] = useState<'doctors' | 'reports'>('doctors');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [doctorDetailTab, setDoctorDetailTab] = useState<'info' | 'prescriptions'>('info');

  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorProfile | null>(null);
  const [form, setForm] = useState<DoctorFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DoctorProfile | null>(null);
  const [isHandlingCascadeDelete, setIsHandlingCascadeDelete] = useState(false);
  const [appointmentPromptDoc, setAppointmentPromptDoc] = useState<DoctorProfile | null>(null);

  const sortedDoctors = useMemo(() => sortDoctors(doctors), [doctors]);
  const visibleDoctors = useMemo(
    () => filterDoctors(sortedDoctors, searchQuery, patientFilter),
    [sortedDoctors, searchQuery, patientFilter]
  );

  const selectedDoctor = useMemo(
    () => (selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId) || null : null),
    [doctors, selectedDoctorId]
  );

  const prescriptionCountByDoctor = useMemo(() => {
    const counts = new Map<string, number>();
    medicalDocuments.forEach((docItem) => {
      if (docItem.kind === 'prescription' && docItem.doctorId) {
        counts.set(docItem.doctorId, (counts.get(docItem.doctorId) || 0) + 1);
      }
    });
    return counts;
  }, [medicalDocuments]);

  const totalReportsCount = useMemo(
    () => medicalDocuments.filter((d) => d.kind === 'report').length,
    [medicalDocuments]
  );

  const unlinkedPrescriptionsCount = useMemo(
    () =>
      medicalDocuments.filter(
        (d) => d.kind === 'prescription' && (!d.doctorId || !d.doctorId.trim())
      ).length,
    [medicalDocuments]
  );

  const emergencyCount = useMemo(
    () => doctors.filter((d) => d.isEmergency).length,
    [doctors]
  );

  const phoneValidation = useMemo(
    () => validateBangladeshiPhone(form.phone),
    [form.phone]
  );
  const waValidation = useMemo(
    () => validateBangladeshiPhone(form.sameAsPhoneForWa ? form.phone : form.whatsapp),
    [form.sameAsPhoneForWa, form.phone, form.whatsapp]
  );

  const openAddModal = () => {
    setEditingDoctor(null);
    setForm({
      ...EMPTY_FORM,
      patientIds: activePatient ? [activePatient.id] : [],
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (docItem: DoctorProfile) => {
    const sameWa =
      Boolean(docItem.phone) &&
      Boolean(docItem.whatsapp) &&
      docItem.phone === docItem.whatsapp;
    setEditingDoctor(docItem);
    setForm({
      name: docItem.name || '',
      specialty: docItem.specialty || '',
      phone: docItem.phone || '',
      whatsapp: docItem.whatsapp || '',
      sameAsPhoneForWa: sameWa,
      hospital: docItem.hospital || '',
      address: docItem.address || '',
      visitingHours: docItem.visitingHours || '',
      forConditions: docItem.forConditions || '',
      patientIds: Array.isArray(docItem.patientIds) ? docItem.patientIds : [],
      lastVisitDate: docItem.lastVisitDate || '',
      nextVisitDate: docItem.nextVisitDate || '',
      notes: docItem.notes || '',
      isEmergency: Boolean(docItem.isEmergency),
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    setEditingDoctor(null);
    setFormError('');
  };

  const togglePatientSelection = (patientId: string) => {
    setForm((prev) => ({
      ...prev,
      patientIds: prev.patientIds.includes(patientId)
        ? prev.patientIds.filter((id) => id !== patientId)
        : [...prev.patientIds, patientId],
    }));
  };

  const handleSaveDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('অনুগ্রহ করে ডাক্তারের নাম লিখুন।');
      return;
    }

    const payload: DoctorProfileInput = {
      name: trimmedName,
      specialty: form.specialty,
      phone: form.phone,
      whatsapp: form.sameAsPhoneForWa ? form.phone : form.whatsapp,
      hospital: form.hospital,
      address: form.address,
      visitingHours: form.visitingHours,
      forConditions: form.forConditions,
      patientIds: form.patientIds,
      lastVisitDate: form.lastVisitDate,
      nextVisitDate: form.nextVisitDate,
      notes: form.notes,
      isEmergency: form.isEmergency,
    };

    const previousNextDate = editingDoctor?.nextVisitDate || '';
    const newNextDate = form.nextVisitDate.trim();
    const shouldPromptAppointment =
      Boolean(newNextDate) && newNextDate !== previousNextDate;

    let savedDocSnapshot: DoctorProfile;
    if (editingDoctor) {
      updateDoctor(editingDoctor.id, payload);
      savedDocSnapshot = {
        ...editingDoctor,
        ...payload,
        name: trimmedName,
        isEmergency: Boolean(payload.isEmergency),
        nextVisitDate: newNextDate || undefined,
      };
    } else {
      savedDocSnapshot = addDoctor(payload);
    }

    closeFormModal();

    if (shouldPromptAppointment) {
      setAppointmentPromptDoc(savedDocSnapshot);
    }
  };

  const handleConfirmAddAppointment = () => {
    if (!appointmentPromptDoc) return;
    const aptPayload = buildDoctorNextVisitAppointmentPayload(
      appointmentPromptDoc,
      appointmentPromptDoc.patientIds?.[0] || activePatient?.id || ''
    );
    if (aptPayload) {
      addAppointment(aptPayload);
    }
    setAppointmentPromptDoc(null);
  };

  const handleToggleEmergencyPin = (docItem: DoctorProfile) => {
    updateDoctor(docItem.id, {
      name: docItem.name,
      specialty: docItem.specialty,
      phone: docItem.phone,
      whatsapp: docItem.whatsapp,
      hospital: docItem.hospital,
      address: docItem.address,
      visitingHours: docItem.visitingHours,
      forConditions: docItem.forConditions,
      patientIds: docItem.patientIds,
      lastVisitDate: docItem.lastVisitDate,
      nextVisitDate: docItem.nextVisitDate,
      notes: docItem.notes,
      isEmergency: !docItem.isEmergency,
    });
  };

  const deleteDocPrescriptionsCount = confirmDeleteDoc
    ? prescriptionCountByDoctor.get(confirmDeleteDoc.id) || 0
    : 0;

  const handleConfirmDeleteWithMode = async (mode: 'keep_unlinked' | 'delete_all') => {
    if (!confirmDeleteDoc) return;
    const targetId = confirmDeleteDoc.id;
    setIsHandlingCascadeDelete(true);
    try {
      if (deleteDocPrescriptionsCount > 0) {
        await unlinkOrDeleteDoctorPrescriptions(targetId, mode);
      }
      deleteDoctor(targetId);
      if (selectedDoctorId === targetId) {
        setSelectedDoctorId(null);
      }
      setConfirmDeleteDoc(null);
    } finally {
      setIsHandlingCascadeDelete(false);
    }
  };

  const resolvePatientLabel = (pid: string): string => {
    const found = patients.find((p) => p.id === pid);
    return found ? `${found.name} (${found.relation})` : 'সদস্য';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Main Tabs: [ডাক্তার] [রিপোর্ট] */}
      <div className="flex items-center gap-2 bg-surface border border-border rounded-2xl p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setMainTab('doctors')}
          className={`min-h-[48px] flex-1 px-4 py-2 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            mainTab === 'doctors'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-text hover:bg-surface-2'
          }`}
        >
          <Stethoscope className="w-5 h-5" />
          <span>ডাক্তার ({toBengaliNumber(doctors.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab('reports');
            void loadMedicalDocuments();
          }}
          className={`min-h-[48px] flex-1 px-4 py-2 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            mainTab === 'reports'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-text hover:bg-surface-2'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>রিপোর্ট ({toBengaliNumber(totalReportsCount)})</span>
        </button>
      </div>

      {mainTab === 'reports' ? (
        <DocumentsVaultTab kind="report" />
      ) : selectedDoctor ? (
        /* ==============================================================
           DOCTOR DETAIL VIEW ([তথ্য] | [প্রেসক্রিপশন])
           ============================================================== */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedDoctorId(null)}
              className="min-h-[48px] px-4 py-2 bg-surface border border-border hover:bg-surface-2 text-text font-bold text-sm sm:text-base rounded-2xl inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>সব ডাক্তার</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedDoctor)}
                className="min-h-[48px] px-3.5 py-2 bg-surface border border-border hover:border-primary text-text font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>সম্পাদনা</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(selectedDoctor)}
                className="min-h-[48px] px-3.5 py-2 bg-danger-soft border border-danger/25 text-danger-text font-bold text-sm rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>মুছুন</span>
              </button>
            </div>
          </div>

          <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {selectedDoctor.isEmergency && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-extrabold border border-amber-300/70 mb-2">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>জরুরি ডাক্তার</span>
                  </span>
                )}
                <h2 className="text-2xl font-bold text-text">{selectedDoctor.name}</h2>
                {selectedDoctor.specialty && (
                  <p className="text-base font-semibold text-primary mt-0.5">
                    {selectedDoctor.specialty}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggleEmergencyPin(selectedDoctor)}
                className={`min-h-[48px] px-3.5 py-2 rounded-xl border font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer ${
                  selectedDoctor.isEmergency
                    ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 text-amber-800 dark:text-amber-200'
                    : 'bg-surface-2 border-border text-text'
                }`}
              >
                <Star className={`w-4 h-4 ${selectedDoctor.isEmergency ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{selectedDoctor.isEmergency ? 'জরুরি পিনকৃত' : 'জরুরি পিন'}</span>
              </button>
            </div>

            {/* Detail Sub-Tabs: [তথ্য] [প্রেসক্রিপশন] */}
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl p-1">
              <button
                type="button"
                onClick={() => setDoctorDetailTab('info')}
                className={`min-h-[46px] flex-1 px-4 py-2 rounded-lg font-bold text-sm sm:text-base cursor-pointer transition-colors ${
                  doctorDetailTab === 'info'
                    ? 'bg-surface text-primary shadow-2xs border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                তথ্য
              </button>
              <button
                type="button"
                onClick={() => {
                  setDoctorDetailTab('prescriptions');
                  void loadMedicalDocuments();
                }}
                className={`min-h-[46px] flex-1 px-4 py-2 rounded-lg font-bold text-sm sm:text-base inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  doctorDetailTab === 'prescriptions'
                    ? 'bg-surface text-primary shadow-2xs border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>
                  প্রেসক্রিপশন ({toBengaliNumber(prescriptionCountByDoctor.get(selectedDoctor.id) || 0)})
                </span>
              </button>
            </div>
          </section>

          {doctorDetailTab === 'prescriptions' ? (
            <DocumentsVaultTab kind="prescription" fixedDoctor={selectedDoctor} />
          ) : (
            <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              {selectedDoctor.forConditions && (
                <p className="text-base text-text-muted">
                  কোন রোগের জন্য দেখান:{' '}
                  <strong className="text-text">{selectedDoctor.forConditions}</strong>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base text-text">
                {selectedDoctor.hospital && (
                  <div className="flex items-start gap-2.5 bg-surface-2/80 p-3.5 rounded-xl border border-border/70">
                    <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-text-muted block">চেম্বার / হাসপাতাল</span>
                      <span className="font-semibold">{selectedDoctor.hospital}</span>
                    </div>
                  </div>
                )}

                {selectedDoctor.visitingHours && (
                  <div className="flex items-start gap-2.5 bg-surface-2/80 p-3.5 rounded-xl border border-border/70">
                    <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-text-muted block">রোগী দেখার সময়</span>
                      <span className="font-semibold">{selectedDoctor.visitingHours}</span>
                    </div>
                  </div>
                )}

                {selectedDoctor.address && (
                  <div className="flex items-start gap-2.5 bg-surface-2/80 p-3.5 rounded-xl border border-border/70 sm:col-span-2">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-text-muted block">ঠিকানা</span>
                      <span>{selectedDoctor.address}</span>
                    </div>
                  </div>
                )}
              </div>

              {(selectedDoctor.lastVisitDate ||
                selectedDoctor.nextVisitDate ||
                selectedDoctor.patientIds?.length ||
                selectedDoctor.notes) && (
                <div className="space-y-2.5 text-sm text-text-muted">
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {selectedDoctor.lastVisitDate && (
                      <span>
                        শেষ ভিজিট:{' '}
                        <strong className="text-text">
                          {formatBengaliDate(selectedDoctor.lastVisitDate)}
                        </strong>
                      </span>
                    )}
                    {selectedDoctor.nextVisitDate && (
                      <span>
                        পরবর্তী ভিজিট:{' '}
                        <strong className="text-primary">
                          {formatBengaliDate(selectedDoctor.nextVisitDate)}
                        </strong>
                      </span>
                    )}
                  </div>

                  {selectedDoctor.patientIds && selectedDoctor.patientIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-primary shrink-0" />
                      <span>সদস্য:</span>
                      {selectedDoctor.patientIds.map((pid) => (
                        <span
                          key={pid}
                          className="px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary text-xs font-bold"
                        >
                          {resolvePatientLabel(pid)}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedDoctor.notes && (
                    <p className="p-3.5 rounded-xl bg-surface-2 border border-border text-text text-sm">
                      নোট: {selectedDoctor.notes}
                    </p>
                  )}
                </div>
              )}

              {(() => {
                const pInfo = validateBangladeshiPhone(selectedDoctor.phone);
                const wCandidate = selectedDoctor.whatsapp?.trim()
                  ? selectedDoctor.whatsapp
                  : pInfo.waUrl
                  ? selectedDoctor.phone
                  : '';
                const wInfo = validateBangladeshiPhone(wCandidate);
                if (!pInfo.telHref && !wInfo.waUrl) return null;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {pInfo.telHref && (
                      <a
                        href={pInfo.telHref}
                        className="min-h-[52px] px-5 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-xs"
                      >
                        <PhoneCall className="w-5 h-5" />
                        <span>কল করুন ({selectedDoctor.phone})</span>
                      </a>
                    )}
                    {wInfo.waUrl && (
                      <a
                        href={wInfo.waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[52px] px-5 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-xs"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>হোয়াটসঅ্যাপ</span>
                      </a>
                    )}
                  </div>
                );
              })()}
            </section>
          )}
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text flex items-center gap-2.5">
                <Stethoscope className="w-7 h-7 text-primary shrink-0" />
                <span>আমার ডাক্তার</span>
              </h1>
              <p className="text-sm sm:text-base text-text-muted mt-1">
                জরুরি কল, চেম্বারের ঠিকানা এবং ডাক্তারের প্রেসক্রিপশন এক জায়গায়
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void loadDoctors(true);
                  void loadMedicalDocuments(true);
                  showToast('ডাক্তার তালিকা রিফ্রেশ করা হচ্ছে...', 'info');
                }}
                disabled={isLoadingDoctors}
                className="min-h-[48px] px-4 py-2.5 bg-surface border border-border hover:bg-surface-2 text-text font-semibold text-sm sm:text-base rounded-2xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-primary ${isLoadingDoctors ? 'animate-spin' : ''}`} />
                <span>রিফ্রেশ</span>
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>নতুন ডাক্তার যোগ</span>
              </button>
            </div>
          </div>

          {/* Summary & Quick Shortcut Row */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base">
              <span className="font-bold text-text">
                মোট ডাক্তার: {toBengaliNumber(doctors.length)} জন
              </span>
              {emergencyCount > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 text-xs sm:text-sm font-bold">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>জরুরি ডাক্তার: {toBengaliNumber(emergencyCount)} জন</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('appointments')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-primary-soft text-primary border border-primary/20 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            >
              <Calendar className="w-4 h-4" />
              <span>সব অ্যাপয়েন্টমেন্ট দেখুন</span>
            </button>
          </div>

      {/* Search & Patient Filter */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ডাক্তারের নাম, বিশেষজ্ঞ, হাসপাতাল বা রোগের নাম লিখুন..."
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

        {activePatients.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold text-text-muted mr-1">
              সদস্য অনুযায়ী:
            </span>
            <button
              type="button"
              onClick={() => setPatientFilter('all')}
              className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
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
                className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
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
      </div>

      {/* Doctors List / Empty State */}
      {visibleDoctors.length === 0 ? (
        <section className="bg-surface border border-border rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-text">
              {doctors.length === 0
                ? 'এখনো কোনো ডাক্তারের তথ্য যোগ করা হয়নি'
                : 'খুঁজে পাওয়া যায়নি'}
            </h2>
            <p className="text-base text-text-muted leading-relaxed">
              {doctors.length === 0
                ? 'আপনার নিয়মিত বা জরুরি ডাক্তারদের ফোন নম্বর ও চেম্বারের ঠিকানা লিখে রাখলে এক ট্যাপেই কল করতে পারবেন।'
                : 'অন্য নাম বা সদস্য বেছে নিয়ে আবার চেষ্টা করুন।'}
            </p>
          </div>

          {doctors.length === 0 ? (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[52px] px-6 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-5 h-5" />
              <span>প্রথম ডাক্তার যোগ করুন</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPatientFilter('all');
              }}
              className="min-h-[48px] px-5 py-2.5 bg-surface-2 border border-border text-text font-bold text-sm rounded-xl cursor-pointer"
            >
              সব ডাক্তার দেখুন
            </button>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {visibleDoctors.map((docItem) => {
            const phoneInfo = validateBangladeshiPhone(docItem.phone);
            const waCandidate = docItem.whatsapp?.trim()
              ? docItem.whatsapp
              : phoneInfo.waUrl
              ? docItem.phone
              : '';
            const waInfo = validateBangladeshiPhone(waCandidate);
            const countdown = formatVisitCountdownBn(docItem.nextVisitDate);

            return (
              <article
                key={docItem.id}
                className={`bg-surface rounded-2xl border-2 p-5 sm:p-6 shadow-xs space-y-4 transition-colors ${
                  docItem.isEmergency
                    ? 'border-amber-400/70 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-border'
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {docItem.isEmergency && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-extrabold border border-amber-300/70">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>জরুরি ডাক্তার</span>
                        </span>
                      )}

                      {countdown.status !== 'none' && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            countdown.status === 'today' || countdown.status === 'tomorrow'
                              ? 'bg-accent text-white'
                              : countdown.status === 'upcoming'
                              ? 'bg-primary-soft text-primary border border-primary/25'
                              : 'bg-surface-2 text-text-muted border border-border'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{countdown.label}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-text pt-0.5">
                      {docItem.name}
                    </h2>

                    {docItem.specialty && (
                      <p className="text-base font-semibold text-primary">
                        {docItem.specialty}
                      </p>
                    )}

                    {docItem.forConditions && (
                      <p className="text-sm text-text-muted">
                        কোন রোগের জন্য: <strong className="text-text">{docItem.forConditions}</strong>
                      </p>
                    )}
                  </div>

                  {/* Top-Right Controls: Pin, Edit, Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleEmergencyPin(docItem)}
                      title={docItem.isEmergency ? 'জরুরি পিন সরান' : 'জরুরি ডাক্তার হিসেবে পিন করুন'}
                      aria-label={docItem.isEmergency ? 'জরুরি পিন সরান' : 'জরুরি পিন করুন'}
                      className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border cursor-pointer transition-colors ${
                        docItem.isEmergency
                          ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 text-amber-600'
                          : 'bg-surface-2 border-border text-text-muted hover:text-amber-600'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${docItem.isEmergency ? 'fill-amber-500' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(docItem)}
                      title="সম্পাদনা"
                      aria-label={`${docItem.name} সম্পাদনা করুন`}
                      className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-2 border border-border text-text hover:border-primary cursor-pointer"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDoc(docItem)}
                      title="মুছুন"
                      aria-label={`${docItem.name} মুছে ফেলুন`}
                      className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-danger-soft border border-danger/25 text-danger-text hover:opacity-85 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Chamber, Visiting Hours & Patient Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm sm:text-base text-text">
                  {docItem.hospital && (
                    <div className="flex items-start gap-2 bg-surface-2/80 p-3 rounded-xl border border-border/70">
                      <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-text-muted block">চেম্বার / হাসপাতাল</span>
                        <span className="font-semibold">{docItem.hospital}</span>
                      </div>
                    </div>
                  )}

                  {docItem.visitingHours && (
                    <div className="flex items-start gap-2 bg-surface-2/80 p-3 rounded-xl border border-border/70">
                      <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-text-muted block">রোগী দেখার সময়</span>
                        <span className="font-semibold">{docItem.visitingHours}</span>
                      </div>
                    </div>
                  )}

                  {docItem.address && (
                    <div className="flex items-start gap-2 bg-surface-2/80 p-3 rounded-xl border border-border/70 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-text-muted block">ঠিকানা</span>
                        <span>{docItem.address}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visit Dates & Notes */}
                {(docItem.lastVisitDate || docItem.nextVisitDate || docItem.patientIds?.length || docItem.notes) && (
                  <div className="space-y-2 pt-1 text-sm text-text-muted">
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {docItem.lastVisitDate && (
                        <span>
                          শেষ ভিজিট: <strong className="text-text">{formatBengaliDate(docItem.lastVisitDate)}</strong>
                        </span>
                      )}
                      {docItem.nextVisitDate && (
                        <span>
                          পরবর্তী ভিজিট: <strong className="text-primary">{formatBengaliDate(docItem.nextVisitDate)}</strong>
                        </span>
                      )}
                    </div>

                    {docItem.patientIds && docItem.patientIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-primary shrink-0" />
                        <span>সদস্য:</span>
                        {docItem.patientIds.map((pid) => (
                          <span
                            key={pid}
                            className="px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary text-xs font-bold"
                          >
                            {resolvePatientLabel(pid)}
                          </span>
                        ))}
                      </div>
                    )}

                    {docItem.notes && (
                      <p className="p-3 rounded-xl bg-surface-2 border border-border text-text text-sm">
                        নোট: {docItem.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Big 1-Tap Call & WhatsApp Buttons + Prescription Corner Button */}
                <div className="flex flex-wrap gap-3 pt-1">
                  {phoneInfo.telHref && (
                    <a
                      href={phoneInfo.telHref}
                      className="min-h-[52px] flex-1 min-w-[160px] px-5 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <PhoneCall className="w-5 h-5" />
                      <span>কল করুন ({docItem.phone})</span>
                    </a>
                  )}

                  {waInfo.waUrl && (
                    <a
                      href={waInfo.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[52px] flex-1 min-w-[140px] px-5 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>হোয়াটসঅ্যাপ</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoctorId(docItem.id);
                      setDoctorDetailTab('prescriptions');
                      void loadMedicalDocuments();
                    }}
                    className="min-h-[52px] flex-1 min-w-[180px] px-4 py-3 bg-primary-soft hover:opacity-90 text-primary border border-primary/25 font-bold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-5 h-5" />
                    <span>
                      প্রেসক্রিপশন ({toBengaliNumber(prescriptionCountByDoctor.get(docItem.id) || 0)})
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Unlinked Prescriptions kept when a Doctor was deleted */}
      {unlinkedPrescriptionsCount > 0 && (
        <section className="pt-4 border-t border-border space-y-3">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>
              ডাক্তারবিহীন সংরক্ষিত প্রেসক্রিপশন ({toBengaliNumber(unlinkedPrescriptionsCount)})
            </span>
          </h2>
          <DocumentsVaultTab kind="prescription" unlinkedOnly />
        </section>
      )}
        </>
      )}

      {/* Add / Edit Doctor Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={closeFormModal}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
              <h2 className="text-xl font-bold text-text flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-primary" />
                <span>{editingDoctor ? 'ডাক্তারের তথ্য বদলান' : 'নতুন ডাক্তার যোগ করুন'}</span>
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                aria-label="বন্ধ করুন"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  ডাক্তারের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }));
                    setFormError('');
                  }}
                  placeholder="যেমন: ডা. কামরুল হাসান"
                  className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    বিশেষজ্ঞ / বিভাগ
                  </label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, specialty: e.target.value }))
                    }
                    placeholder="যেমন: হৃদরোগ / মেডিসিন"
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    কোন রোগের জন্য দেখান
                  </label>
                  <input
                    type="text"
                    value={form.forConditions}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, forConditions: e.target.value }))
                    }
                    placeholder="যেমন: উচ্চ রক্তচাপ, ডায়াবেটিস"
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>
              </div>

              {/* Phone + Soft Warning */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-text">
                  ফোন নম্বর
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="যেমন: 017XXXXXXXX বা +88017XXXXXXXX"
                  className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                />
                {!phoneValidation.isEmpty && !phoneValidation.valid && phoneValidation.warningBn && (
                  <p className="text-xs font-semibold text-warning-text bg-warning-soft px-3 py-2 rounded-lg">
                    {phoneValidation.warningBn}
                  </p>
                )}
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-bold text-text">
                    হোয়াটসঅ্যাপ নম্বর (ঐচ্ছিক)
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sameAsPhoneForWa}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          sameAsPhoneForWa: e.target.checked,
                          whatsapp: e.target.checked ? prev.phone : prev.whatsapp,
                        }))
                      }
                      className="w-4 h-4 accent-primary"
                    />
                    <span>ফোন নম্বরের মতোই</span>
                  </label>
                </div>

                {!form.sameAsPhoneForWa && (
                  <>
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, whatsapp: e.target.value }))
                      }
                      placeholder="হোয়াটসঅ্যাপ নম্বর লিখুন"
                      className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                    />
                    {!waValidation.isEmpty && !waValidation.valid && waValidation.warningBn && (
                      <p className="text-xs font-semibold text-warning-text bg-warning-soft px-3 py-2 rounded-lg">
                        {waValidation.warningBn}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    চেম্বার / হাসপাতাল
                  </label>
                  <input
                    type="text"
                    value={form.hospital}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, hospital: e.target.value }))
                    }
                    placeholder="যেমন: ল্যাবএইড / ঢাকা মেডিকেল"
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    রোগী দেখার সময়
                  </label>
                  <input
                    type="text"
                    value={form.visitingHours}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, visitingHours: e.target.value }))
                    }
                    placeholder="যেমন: বিকাল ৫টা – রাত ৯টা"
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  চেম্বারের ঠিকানা
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="যেমন: রোড ৪, ধানমন্ডি, ঢাকা"
                  className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                />
              </div>

              {/* Assigned Patient Profiles */}
              {activePatients.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-text">
                    পরিবারের কোন সদস্যের ডাক্তার? (ঐচ্ছিক)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activePatients.map((p) => {
                      const checked = form.patientIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePatientSelection(p.id)}
                          aria-pressed={checked}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                            checked
                              ? 'bg-primary-soft border-primary text-primary'
                              : 'bg-surface-2 border-border text-text'
                          }`}
                        >
                          {p.name} ({p.relation})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visit Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    শেষ দেখার তারিখ
                  </label>
                  <input
                    type="date"
                    value={form.lastVisitDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lastVisitDate: e.target.value }))
                    }
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">
                    পরবর্তী ভিজিটের তারিখ
                  </label>
                  <input
                    type="date"
                    value={form.nextVisitDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nextVisitDate: e.target.value }))
                    }
                    className="min-h-[48px] w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-1.5">
                  বিশেষ নোট / মন্তব্য
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="যেমন: সিরিয়াল দিতে সকাল ১০টায় ফোন করতে হয়"
                  className="w-full px-3.5 py-2.5 text-base bg-surface-2 border border-border rounded-xl text-text"
                />
              </div>

              {/* Emergency Star Toggle */}
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isEmergency: !prev.isEmergency }))
                }
                aria-pressed={form.isEmergency}
                className={`min-h-[56px] w-full p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                  form.isEmergency
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star
                    className={`w-5 h-5 shrink-0 ${
                      form.isEmergency ? 'fill-amber-500 text-amber-500' : 'text-text-muted'
                    }`}
                  />
                  <div>
                    <div className="text-sm sm:text-base font-bold text-text">
                      জরুরি প্রিয় ডাক্তার হিসেবে পিন করুন
                    </div>
                    <div className="text-xs text-text-muted">
                      তালিকার সবার উপরে থাকবে এবং জরুরি কার্ডে দেখাতে পারবেন
                    </div>
                  </div>
                </div>
                <div
                  className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                    form.isEmergency ? 'bg-amber-500 justify-end' : 'bg-border justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-xs" />
                </div>
              </button>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="min-h-[48px] flex-1 px-4 py-2.5 bg-surface-2 border border-border text-text font-bold text-base rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="min-h-[48px] flex-1 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl shadow-xs cursor-pointer"
                >
                  {editingDoctor ? 'তথ্য সংরক্ষণ করুন' : 'ডাক্তার যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (with Prescription Cascade Options) */}
      {confirmDeleteDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => !isHandlingCascadeDelete && setConfirmDeleteDoc(null)}
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
                  ডাক্তারের তথ্য মুছে ফেলবেন?
                </h3>
                {deleteDocPrescriptionsCount > 0 ? (
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">
                    <strong className="text-text">{confirmDeleteDoc.name}</strong>-এর অধীনে{' '}
                    <strong className="text-primary">
                      {toBengaliNumber(deleteDocPrescriptionsCount)}টি প্রেসক্রিপশন
                    </strong>{' '}
                    আছে। সেগুলো কী করতে চান?
                  </p>
                ) : (
                  <p className="text-sm text-text-muted mt-1">
                    <strong className="text-text">{confirmDeleteDoc.name}</strong> তালিকা থেকে মুছে যাবে। আগে করা কোনো অ্যাপয়েন্টমেন্ট বা রিপোর্ট মুছবে না।
                  </p>
                )}
              </div>
            </div>

            {deleteDocPrescriptionsCount > 0 ? (
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isHandlingCascadeDelete}
                  onClick={() => void handleConfirmDeleteWithMode('keep_unlinked')}
                  className="min-h-[48px] w-full px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm sm:text-base rounded-xl cursor-pointer"
                >
                  ডাক্তার ছাড়া রাখুন (প্রেসক্রিপশন থাকবে)
                </button>
                <button
                  type="button"
                  disabled={isHandlingCascadeDelete}
                  onClick={() => void handleConfirmDeleteWithMode('delete_all')}
                  className="min-h-[48px] w-full px-4 py-2.5 bg-danger hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm sm:text-base rounded-xl cursor-pointer"
                >
                  সব মুছুন (ডাক্তার ও প্রেসক্রিপশন)
                </button>
                <button
                  type="button"
                  disabled={isHandlingCascadeDelete}
                  onClick={() => setConfirmDeleteDoc(null)}
                  className="min-h-[48px] w-full px-4 py-2.5 bg-surface-2 border border-border text-text font-bold text-sm sm:text-base rounded-xl cursor-pointer"
                >
                  থাক
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={isHandlingCascadeDelete}
                  onClick={() => setConfirmDeleteDoc(null)}
                  className="min-h-[48px] flex-1 px-4 py-2.5 bg-surface-2 border border-border text-text font-bold text-base rounded-xl cursor-pointer"
                >
                  থাক
                </button>
                <button
                  type="button"
                  disabled={isHandlingCascadeDelete}
                  onClick={() => void handleConfirmDeleteWithMode('keep_unlinked')}
                  className="min-h-[48px] flex-1 px-4 py-2.5 bg-danger text-white font-bold text-base rounded-xl cursor-pointer hover:opacity-90"
                >
                  হ্যাঁ, মুছে ফেলুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Visit -> Add to Appointments Prompt Modal */}
      {appointmentPromptDoc && appointmentPromptDoc.nextVisitDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setAppointmentPromptDoc(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">
                  অ্যাপয়েন্টমেন্টে যোগ করবেন?
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  আপনি <strong className="text-text">{appointmentPromptDoc.name}</strong>-এর পরবর্তী ভিজিটের তারিখ{' '}
                  <strong className="text-primary">
                    {formatBengaliDate(appointmentPromptDoc.nextVisitDate)}
                  </strong>{' '}
                  লিখেছেন। এটি অ্যাপয়েন্টমেন্ট রিমাইন্ডারেও যোগ করে রাখতে চান?
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAppointmentPromptDoc(null)}
                className="min-h-[48px] flex-1 px-4 py-2.5 bg-surface-2 border border-border text-text font-bold text-base rounded-xl cursor-pointer"
              >
                না, পরে করব
              </button>
              <button
                type="button"
                onClick={handleConfirmAddAppointment}
                className="min-h-[48px] flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>অ্যাপয়েন্টমেন্টে যোগ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
