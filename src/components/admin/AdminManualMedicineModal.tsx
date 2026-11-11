import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { ImportDataSource, ImportSourceType } from '../../types';
import {
  X,
  Pill,
  Building,
  ShieldCheck,
  Check,
  Sparkles,
  AlertCircle,
  Landmark,
  FileBadge,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface FormState {
  brandName: string;
  brandNameBn: string;
  genericName: string;
  genericNameBn: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  pricePerUnit: string;
  packageDescription: string;
  darNumber: string;
  therapeuticClass: string;
  indication: string;
  source: ImportDataSource;
  sourceType: ImportSourceType;
  sourceName: string;
  licenseReference: string;
  publishOption: 'publish' | 'draft';
}

const COMMON_FORMS = [
  'ট্যাবলেট',
  'ক্যাপসুল',
  'সিরাপ',
  'ইনজেকশন/ইনসুলিন',
  'চোখের ড্রপ',
  'ইনহেলার',
  'মলম/জেল',
  'সাসপেনশন',
  'সাপোজিটরি',
];

const TOP_MANUFACTURERS = [
  'Square Pharmaceuticals PLC',
  'Beximco Pharmaceuticals Ltd.',
  'Incepta Pharmaceuticals Ltd.',
  'Opsonin Pharma Ltd.',
  'Renata PLC',
  'Eskayef Pharmaceuticals Ltd.',
  'ACI HealthCare Limited',
  'Aristopharma Ltd.',
  'Drug International Ltd.',
  'Healthcare Pharmaceuticals Ltd.',
  'Popular Pharmaceuticals Ltd.',
  'Radiant Pharmaceuticals Ltd.',
  'General Pharmaceuticals Ltd.',
];

const INITIAL_FORM: FormState = {
  brandName: '',
  brandNameBn: '',
  genericName: '',
  genericNameBn: '',
  strength: '',
  dosageForm: 'ট্যাবলেট',
  manufacturer: '',
  pricePerUnit: '',
  packageDescription: '',
  darNumber: '',
  therapeuticClass: '',
  indication: '',
  source: 'DGDA_GOV',
  sourceType: 'government',
  sourceName: 'DGDA সরকারি উন্মুক্ত গেজেট ও ফর্মুলারি',
  licenseReference: 'DGDA Public Gazette / National Formulary Open Data',
  publishOption: 'publish',
};

export const AdminManualMedicineModal: React.FC = () => {
  const {
    isManualAddModalOpen,
    closeManualAddModal,
    addSingleGlobalMedicineAction,
  } = useMedicine();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [customFormInput, setCustomFormInput] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isManualAddModalOpen) return null;

  const handleInputChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSourceChange = (sourceVal: ImportDataSource) => {
    let sType: ImportSourceType = 'government';
    let sName = 'DGDA সরকারি উন্মুক্ত গেজেট ও ফর্মুলারি';
    let lic = 'DGDA Public Gazette / National Formulary Open Data';

    if (sourceVal === 'MANUFACTURER') {
      sType = 'manufacturer';
      sName = 'প্রস্তুতকারকের অফিসিয়াল প্রোডাক্ট মনোগ্রাফ';
      lic = 'Manufacturer Official Approved Product Monograph';
    } else if (sourceVal === 'INDEPENDENT_VERIFIED') {
      sType = 'independent';
      sName = 'স্বাধীন ক্লিনিক্যাল যাচাইকৃত ড্রাগ রেকর্ড';
      lic = 'Independent Clinical Pharmacopoeia Reference';
    }

    setForm((prev) => ({
      ...prev,
      source: sourceVal,
      sourceType: sType,
      sourceName: sName,
      licenseReference: lic,
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.brandName.trim()) {
      errs.brandName = 'ব্র্যান্ড নাম প্রদান করা আবশ্যক';
    } else if (form.brandName.trim().length > 128) {
      errs.brandName = 'ব্র্যান্ড নাম সর্বোচ্চ ১২৮ অক্ষরের হতে পারে';
    }

    if (!form.genericName.trim()) {
      errs.genericName = 'জেনেরিক নাম প্রদান করা আবশ্যক';
    } else if (form.genericName.trim().length > 256) {
      errs.genericName = 'জেনেরিক নাম সর্বোচ্চ ২৫৬ অক্ষরের হতে পারে';
    }

    if (!form.strength.trim()) {
      errs.strength = 'শক্তি / মাত্রা প্রদান করা আবশ্যক (যেমন: 500 mg)';
    } else if (form.strength.trim().length > 64) {
      errs.strength = 'শক্তি সর্বোচ্চ ৬৪ অক্ষরের হতে পারে';
    }

    const currentDosageForm = showCustomForm ? customFormInput.trim() : form.dosageForm.trim();
    if (!currentDosageForm) {
      errs.dosageForm = 'ডোজের ধরন নির্বাচন বা লিখুন';
    } else if (currentDosageForm.length > 64) {
      errs.dosageForm = 'ডোজের ধরন সর্বোচ্চ ৬৪ অক্ষরের হতে পারে';
    }

    if (!form.manufacturer.trim()) {
      errs.manufacturer = 'প্রস্তুতকারক কোম্পানির নাম প্রদান করা আবশ্যক';
    } else if (form.manufacturer.trim().length > 128) {
      errs.manufacturer = 'প্রস্তুতকারক নাম সর্বোচ্চ ১২৮ অক্ষরের হতে পারে';
    }

    if (form.pricePerUnit) {
      const priceNum = parseFloat(form.pricePerUnit);
      if (isNaN(priceNum) || priceNum < 0) {
        errs.pricePerUnit = 'সঠিক সংখ্যা লিখুন (যেমন: 2.50)';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const currentDosageForm = showCustomForm && customFormInput.trim() ? customFormInput.trim() : form.dosageForm.trim();
    const priceNum = form.pricePerUnit ? parseFloat(form.pricePerUnit) : undefined;

    const payload = {
      brandName: form.brandName.trim(),
      brandNameBn: form.brandNameBn.trim() || undefined,
      genericName: form.genericName.trim(),
      genericNameBn: form.genericNameBn.trim() || undefined,
      strength: form.strength.trim(),
      dosageForm: currentDosageForm,
      manufacturer: form.manufacturer.trim(),
      pricePerUnit: priceNum,
      packageDescription: form.packageDescription.trim() || undefined,
      darNumber: form.darNumber.trim() || undefined,
      therapeuticClass: form.therapeuticClass.trim() || undefined,
      indication: form.indication.trim() || undefined,
      source: form.source,
      sourceType: form.sourceType,
      sourceName: form.sourceName,
      licenseReference: form.licenseReference.trim(),
      status: form.publishOption === 'publish' ? ('published' as const) : ('draft' as const),
      verifiedByAdmin: form.publishOption === 'publish',
    };

    const success = await addSingleGlobalMedicineAction(payload);
    setIsSubmitting(false);

    if (success) {
      setForm(INITIAL_FORM);
      setCustomFormInput('');
      setShowCustomForm(false);
      closeManualAddModal();
    }
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setCustomFormInput('');
    setShowCustomForm(false);
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl my-8 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>ম্যানুয়ালি নতুন ওষুধ যোগ করুন</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  অ্যাডমিন এন্ট্রি
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ফরম পূরণ করে সরাসরি ক্লাউড ফায়ারস্টোর ডাটাবেজে ওষুধ অন্তর্ভুক্ত ও সার্বজনীন প্রকাশ করুন।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeManualAddModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          
          {/* Section 1: মূল তথ্য (Primary Identification) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                ১. ওষুধের নাম ও প্রাথমিক পরিচিতি
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Brand Name (English) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>ব্র্যান্ড নাম (ইংরেজি)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.brandName}
                  onChange={(e) => handleInputChange('brandName', e.target.value)}
                  placeholder="যেমন: Napa Extra, Seclo, Maxpro"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 ${
                    errors.brandName
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                  }`}
                />
                {errors.brandName && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.brandName}</p>
                )}
              </div>

              {/* Brand Name (Bengali) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  ব্র্যান্ড নাম (বাংলায় - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={form.brandNameBn}
                  onChange={(e) => handleInputChange('brandNameBn', e.target.value)}
                  placeholder="যেমন: নাপা এক্সট্রা, সেক্লো"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Generic Name (English) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>জেনেরিক নাম (ইংরেজি)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.genericName}
                  onChange={(e) => handleInputChange('genericName', e.target.value)}
                  placeholder="যেমন: Paracetamol + Caffeine, Omeprazole"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 ${
                    errors.genericName
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                  }`}
                />
                {errors.genericName && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.genericName}</p>
                )}
              </div>

              {/* Generic Name (Bengali) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  জেনেরিক নাম (বাংলায় - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={form.genericNameBn}
                  onChange={(e) => handleInputChange('genericNameBn', e.target.value)}
                  placeholder="যেমন: প্যারাসিটামল + ক্যাফেইন"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Strength */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>শক্তি / মাত্রা (Strength)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.strength}
                  onChange={(e) => handleInputChange('strength', e.target.value)}
                  placeholder="যেমন: 500 mg, 20 mg, 10 mg/5ml"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 ${
                    errors.strength
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                  }`}
                />
                {errors.strength && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.strength}</p>
                )}
              </div>

              {/* Price Per Unit */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  খুচরা মূল্য / প্রতি ইউনিট (৳ - ঐচ্ছিক)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.pricePerUnit}
                    onChange={(e) => handleInputChange('pricePerUnit', e.target.value)}
                    placeholder="যেমন: 2.50 বা 7.00"
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 ${
                      errors.pricePerUnit
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                    }`}
                  />
                </div>
                {errors.pricePerUnit && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.pricePerUnit}</p>
                )}
              </div>

            </div>
          </div>

          {/* Section 2: ডোজের ধরন ও প্রস্তুতকারক কোম্পানি */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                ২. ডোজের ধরন ও প্রস্তুতকারক
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Dosage Form Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>ডোজের ধরন (Dosage Form)</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(!showCustomForm);
                      if (!showCustomForm) setCustomFormInput('');
                    }}
                    className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline cursor-pointer font-bold"
                  >
                    {showCustomForm ? 'তালিকা থেকে বাছুন' : 'অন্যান্য কাস্টম ধরন লিখুন'}
                  </button>
                </label>

                {showCustomForm ? (
                  <input
                    type="text"
                    value={customFormInput}
                    onChange={(e) => setCustomFormInput(e.target.value)}
                    placeholder="কাস্টম ধরন লিখুন (যেমন: ওরাল ড্রপ, নেবুলাইজার সল্যুশন)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                ) : (
                  <select
                    value={form.dosageForm}
                    onChange={(e) => handleInputChange('dosageForm', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
                  >
                    {COMMON_FORMS.map((formOption) => (
                      <option key={formOption} value={formOption}>
                        {formOption}
                      </option>
                    ))}
                  </select>
                )}
                {errors.dosageForm && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.dosageForm}</p>
                )}
              </div>

              {/* Manufacturer Company */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>প্রস্তুতকারক কোম্পানি</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="manufacturers-list"
                    value={form.manufacturer}
                    onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                    placeholder="কোম্পানির নাম লিখুন বা তালিকা থেকে বাছুন"
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 ${
                      errors.manufacturer
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                    }`}
                  />
                  <datalist id="manufacturers-list">
                    {TOP_MANUFACTURERS.map((mfg) => (
                      <option key={mfg} value={mfg} />
                    ))}
                  </datalist>
                </div>
                {errors.manufacturer && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.manufacturer}</p>
                )}
              </div>

              {/* Package Description */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  প্যাকেটের বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={form.packageDescription}
                  onChange={(e) => handleInputChange('packageDescription', e.target.value)}
                  placeholder="যেমন: ১০টি ট্যাবলেটের ব্লিস্টার স্ট্রিপ, ১০০ মিলি বোতল"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* DAR Number */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  DGDA রেজিস্ট্রেশন নম্বর (DAR - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={form.darNumber}
                  onChange={(e) => handleInputChange('darNumber', e.target.value)}
                  placeholder="যেমন: 028-023-011"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

            </div>
          </div>

          {/* Section 3: ক্লিনিক্যাল নির্দেশনা ও থেরাপিউটিক শ্রেণি */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                ৩. ক্লিনিক্যাল তথ্য ও ব্যবহার
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Therapeutic Class */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  থেরাপিউটিক শ্রেণি (Therapeutic Class)
                </label>
                <input
                  type="text"
                  value={form.therapeuticClass}
                  onChange={(e) => handleInputChange('therapeuticClass', e.target.value)}
                  placeholder="যেমন: ব্যথানাশক ও জ্বর (Analgesic), PPI, অ্যান্টিবায়োটিক"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Indication */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  কী কাজে লাগে / নির্দেশনা (Indication)
                </label>
                <input
                  type="text"
                  value={form.indication}
                  onChange={(e) => handleInputChange('indication', e.target.value)}
                  placeholder="যেমন: জ্বর, মাথাব্যথা, গ্যাস্ট্রিক আলসার"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

            </div>
          </div>

          {/* Section 4: আইনানুগ উৎস ও প্রকাশনা নিয়ন্ত্রণ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                ৪. ডাটা উৎস ও প্রকাশনা নিয়ন্ত্রণ
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Source Profile */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  আইনানুগ উৎস নির্বাচন
                </label>
                <select
                  value={form.source}
                  onChange={(e) => handleSourceChange(e.target.value as ImportDataSource)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="DGDA_GOV">DGDA সরকারি উন্মুক্ত গেজেট ও ন্যাশনাল ফর্মুলারি</option>
                  <option value="MANUFACTURER">প্রস্তুতকারকের অফিসিয়াল প্রোডাক্ট মনোগ্রাফ</option>
                  <option value="INDEPENDENT_VERIFIED">স্বাধীন ক্লিনিক্যাল যাচাইকৃত ড্রাগ রেকর্ড</option>
                </select>
              </div>

              {/* License Reference */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  আইনানুগ সনদ / রেফারেন্স
                </label>
                <input
                  type="text"
                  value={form.licenseReference}
                  onChange={(e) => handleInputChange('licenseReference', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>

            </div>

            {/* Publishing Option Selector */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                সংরক্ষণের পর কী করতে চান?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    form.publishOption === 'publish'
                      ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-950 dark:text-teal-200 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="publishOption"
                    value="publish"
                    checked={form.publishOption === 'publish'}
                    onChange={() => handleInputChange('publishOption', 'publish')}
                    className="mt-0.5 w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-bold flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      সরাসরি লাইব্রেরিতে প্রকাশ করুন
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      সব ফোনে ও সকল ব্যবহারকারীর ওষুধ লাইব্রেরিতে তৎক্ষণাৎ রিয়েল-টাইমে দৃশ্যমান হবে।
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    form.publishOption === 'draft'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-950 dark:text-amber-200 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="publishOption"
                    value="draft"
                    checked={form.publishOption === 'draft'}
                    onChange={() => handleInputChange('publishOption', 'draft')}
                    className="mt-0.5 w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold flex items-center gap-1.5 text-xs">
                      <Clock className="w-4 h-4 text-amber-600" />
                      অপেক্ষমাণ খসড়া (Draft) রাখুন
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      সাধারণ ব্যবহারকারীদের কাছে লুকানো থাকবে; অ্যাডমিন পরবর্তীতে অনুমোদন দিতে পারবেন।
                    </span>
                  </div>
                </label>
              </div>
            </div>

          </div>

          {/* Section 5: লাইভ কার্ড প্রিভিউ (Live Card Preview) */}
          {(form.brandName || form.genericName || form.manufacturer) && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider block">
                লাইব্রেরি কার্ড প্রিভিউ (ব্যবহারকারীরা যেমন দেখবে):
              </span>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-dashed border-teal-300 dark:border-teal-800/80">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {form.brandName || 'ওষুধের ব্র্যান্ড নাম'}
                        </h4>
                        {form.publishOption === 'draft' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            অপ্রকাশিত খসড়া
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        {form.genericName || 'জেনেরিক নাম'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                        {form.strength || 'ডোজ/শক্তি'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {showCustomForm && customFormInput ? customFormInput : form.dosageForm}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[200px]">{form.manufacturer || 'কোম্পানি'}</span>
                    </div>
                    {form.pricePerUnit && (
                      <span className="font-bold text-teal-700 dark:text-teal-400">
                        ৳ {parseFloat(form.pricePerUnit).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              ফর্ম ফাঁকা করুন (Reset)
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeManualAddModal}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                বাতিল করুন
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>ক্লাউডে সংরক্ষিত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {form.publishOption === 'publish'
                        ? 'সংরক্ষণ ও সরাসরি প্রকাশ করুন'
                        : 'খসড়া হিসেবে সংরক্ষণ করুন'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
