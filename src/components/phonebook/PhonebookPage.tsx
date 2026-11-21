import React, { useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { PhonebookEntry } from '../../types';
import { validateBangladeshiPhone } from '../../utils/doctorsManager';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  Ambulance,
  ArrowLeft,
  Edit2,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';

const PHONEBOOK_CATEGORIES = [
  'সব',
  'পরিবার',
  'জরুরি',
  'অ্যাম্বুলেন্স',
  'হাসপাতাল',
  'ফার্মেসি',
  'অন্যান্য',
] as const;

export const PhonebookPage: React.FC = () => {
  const {
    phonebook,
    patients,
    activePatient,
    addPhonebookEntry,
    updatePhonebookEntry,
    deletePhonebookEntry,
    setCurrentPage,
    showToast,
  } = useMedicine();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('সব');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PhonebookEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('পরিবার');
  const [relation, setRelation] = useState('');
  const [patientId, setPatientId] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingEntry(null);
    setName('');
    setPhone('');
    setCategory('পরিবার');
    setRelation('');
    setPatientId(activePatient?.id || '');
    setIsEmergency(false);
    setNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (entry: PhonebookEntry) => {
    setEditingEntry(entry);
    setName(entry.name || '');
    setPhone(entry.phone || '');
    setCategory(entry.category || 'পরিবার');
    setRelation(entry.relation || '');
    setPatientId(entry.patientId || '');
    setIsEmergency(Boolean(entry.isEmergency));
    setNotes(entry.notes || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) {
      setFormError('নাম লিখুন।');
      return;
    }
    if (!cleanPhone) {
      setFormError('ফোন নম্বর লিখুন।');
      return;
    }

    const phoneValidation = validateBangladeshiPhone(cleanPhone);
    const normalizedPhone = phoneValidation.normalized || cleanPhone;

    if (editingEntry) {
      updatePhonebookEntry(editingEntry.id, {
        name: cleanName,
        phone: normalizedPhone,
        category,
        relation: relation.trim() || undefined,
        patientId: patientId || undefined,
        isEmergency,
        notes: notes.trim() || undefined,
      });
      showToast('ফোনবুক নম্বর হালনাগাদ হয়েছে', 'success');
    } else {
      addPhonebookEntry({
        name: cleanName,
        phone: normalizedPhone,
        category,
        relation: relation.trim() || undefined,
        patientId: patientId || undefined,
        isEmergency,
        notes: notes.trim() || undefined,
      });
      showToast('নতুন নম্বর ফোনবুকে যোগ হয়েছে', 'success');
    }
    setIsFormOpen(false);
  };

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...phonebook]
      .filter((entry) => {
        if (selectedCategory === 'জরুরি') {
          if (!entry.isEmergency && entry.category !== 'জরুরি') return false;
        } else if (selectedCategory !== 'সব' && entry.category !== selectedCategory) {
          return false;
        }
        if (!q) return true;
        return (
          entry.name.toLowerCase().includes(q) ||
          entry.phone.toLowerCase().includes(q) ||
          (entry.relation || '').toLowerCase().includes(q) ||
          (entry.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (Boolean(a.isEmergency) !== Boolean(b.isEmergency)) {
          return a.isEmergency ? -1 : 1;
        }
        return (a.name || '').localeCompare(b.name || '', 'bn');
      });
  }, [phonebook, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('me')}
            aria-label="ফিরে যান"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <PhoneCall className="w-6 h-6 text-primary" />
              <span>জরুরি ফোনবুক</span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              পরিবার, অ্যাম্বুলেন্স, হাসপাতাল ও ফার্মেসির দরকারি নম্বর ({toBengaliNumber(phonebook.length)}টি সংরক্ষিত)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm sm:text-base inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>নতুন নম্বর যোগ</span>
        </button>
      </div>

      {/* National Helplines Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="tel:16263"
          className="min-h-[56px] px-4 py-3 rounded-2xl bg-primary text-on-primary font-bold text-base flex items-center justify-between gap-3 shadow-xs"
        >
          <span className="flex items-center gap-2.5">
            <PhoneCall className="w-5 h-5 shrink-0" />
            <span>স্বাস্থ্য বাতায়ন (১৬২৬৩)</span>
          </span>
          <span className="text-sm opacity-90">২৪ ঘণ্টা কল</span>
        </a>
        <a
          href="tel:999"
          className="min-h-[56px] px-4 py-3 rounded-2xl bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-base flex items-center justify-between gap-3 shadow-xs"
        >
          <span className="flex items-center gap-2.5">
            <Ambulance className="w-5 h-5 shrink-0" />
            <span>জাতীয় জরুরি সেবা (৯৯৯)</span>
          </span>
          <span className="text-sm opacity-90">জরুরি কল</span>
        </a>
      </section>

      {/* Search & Category Filter */}
      <section className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, সম্পর্ক বা নম্বর দিয়ে খুঁজুন…"
            className="min-h-[48px] w-full pl-10 pr-4 py-2 rounded-xl bg-surface-2 border border-border text-sm sm:text-base text-text focus:outline-hidden focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PHONEBOOK_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-primary border-primary text-on-primary'
                    : 'bg-surface-2 border-border text-text hover:border-primary/40'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Contacts List */}
      {filteredEntries.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-3">
          <Phone className="w-10 h-10 text-primary mx-auto" />
          <p className="text-base font-bold text-text">
            {phonebook.length === 0
              ? 'ফোনবুকে এখনো কোনো নম্বর যোগ করা হয়নি'
              : 'আপনার খোঁজার সাথে মেলে এমন কোনো নম্বর নেই'}
          </p>
          {phonebook.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>প্রথম নম্বর যোগ করুন</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const phoneCheck = validateBangladeshiPhone(entry.phone);
            const linkedPatient = entry.patientId
              ? patients.find((p) => p.id === entry.patientId)
              : null;
            const isConfirmingDelete = confirmDeleteId === entry.id;

            return (
              <article
                key={entry.id}
                className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-text flex items-center gap-1.5">
                        {entry.isEmergency && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        {entry.category || 'পরিবার'}
                        {entry.relation ? ` · ${entry.relation}` : ''}
                        {linkedPatient ? ` · ${linkedPatient.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-lg font-extrabold font-mono text-primary tracking-wide pt-1">
                    {entry.phone}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-text-muted leading-relaxed">{entry.notes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  {phoneCheck.telHref && (
                    <a
                      href={phoneCheck.telHref}
                      className="min-h-[44px] flex-1 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span>কল</span>
                    </a>
                  )}
                  {phoneCheck.waUrl && (
                    <a
                      href={phoneCheck.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] flex-1 px-3.5 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>হোয়াটসঅ্যাপ</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(entry)}
                    aria-label={`${entry.name} সম্পাদনা`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 border border-border text-text hover:border-primary cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          deletePhonebookEntry(entry.id);
                          setConfirmDeleteId(null);
                          showToast('নম্বরটি মুছে ফেলা হয়েছে', 'info');
                        }}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#B91C1C] text-white font-bold text-xs cursor-pointer"
                      >
                        মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-text font-bold text-xs cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      aria-label={`${entry.name} মুছুন`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-danger-soft border border-danger/30 text-danger-text cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-text">
                {editingEntry ? 'নম্বর সম্পাদনা' : 'নতুন জরুরি নম্বর যোগ'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="বন্ধ করুন"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-surface-2 text-text cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-text mb-1">নাম *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মো. করিম / স্কয়ার অ্যাম্বুলেন্স"
                  className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-1">ফোন নম্বর *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX"
                  className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-text mb-1">ধরন</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text"
                  >
                    {PHONEBOOK_CATEGORIES.filter((c) => c !== 'সব').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text mb-1">সম্পর্ক / বিবরণ</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="যেমন: বড় ভাই / নিকটস্থ ফার্মেসি"
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text"
                  />
                </div>
              </div>

              {patients.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-text mb-1">
                    কোন সদস্যের জন্য (ঐচ্ছিক)
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text"
                  >
                    <option value="">সকল সদস্য</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.relation})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-text mb-1">নোট (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: ২৪ ঘণ্টা হোম ডেলিভারি"
                  className="min-h-[48px] w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-base text-text"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-sm font-bold text-text">
                  জরুরি তালিকায় উপরে রাখুন
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-surface-2 text-text font-bold text-sm cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
