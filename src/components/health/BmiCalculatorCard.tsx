import React, { useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  BMI_LIMITATION_NOTE,
  BMI_MANDATORY_DISCLAIMER,
  BMI_PEDIATRIC_MESSAGE,
  calculateBmi,
  calculateHealthyWeightRangeKg,
  classifyAsianAdultBmi,
  cmToFeetInches,
  feetInchesToCm,
  isPediatricAge,
  MAX_HEIGHT_CM,
  MIN_HEIGHT_CM,
  parseNumericField,
  validateHeightCmInput,
} from '../../utils/bmiCalculator';
import { Calculator, Info, AlertCircle, Check, Scale, User } from 'lucide-react';

interface BmiCalculatorCardProps {
  compact?: boolean;
}

export const BmiCalculatorCard: React.FC<BmiCalculatorCardProps> = ({ compact = false }) => {
  const { patients, activePatient, healthRecords, updatePatient } = useMedicine();

  const [mode, setMode] = useState<'member' | 'manual'>(() =>
    patients.length > 0 ? 'member' : 'manual'
  );
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    activePatient?.id || patients[0]?.id || ''
  );

  // Member inputs (editable in-place)
  const [memberHeightUnit, setMemberHeightUnit] = useState<'cm' | 'ft_in'>('cm');
  const [memberHeightCmInput, setMemberHeightCmInput] = useState('');
  const [memberFeetInput, setMemberFeetInput] = useState('');
  const [memberInchesInput, setMemberInchesInput] = useState('');
  const [memberWeightInput, setMemberWeightInput] = useState('');

  // Manual mode inputs (never saved)
  const [manualHeightUnit, setManualHeightUnit] = useState<'cm' | 'ft_in'>('cm');
  const [manualHeightCmInput, setManualHeightCmInput] = useState('');
  const [manualFeetInput, setManualFeetInput] = useState('');
  const [manualInchesInput, setManualInchesInput] = useState('');
  const [manualWeightInput, setManualWeightInput] = useState('');
  const [manualUnder18, setManualUnder18] = useState(false);

  useEffect(() => {
    if (activePatient?.id && (!selectedPatientId || !patients.some((p) => p.id === selectedPatientId))) {
      setSelectedPatientId(activePatient.id);
    } else if (!selectedPatientId && patients[0]?.id) {
      setSelectedPatientId(patients[0].id);
    }
  }, [activePatient?.id, patients, selectedPatientId]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || activePatient || null,
    [patients, selectedPatientId, activePatient]
  );

  const latestWeightForSelected = useMemo(() => {
    if (!selectedPatient) return null;
    const recordsWithWeight = healthRecords
      .filter((r) => r.patientId === selectedPatient.id && typeof r.weight === 'number' && r.weight > 0)
      .slice()
      .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
    return recordsWithWeight[0]?.weight ?? null;
  }, [healthRecords, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) return;
    if (typeof selectedPatient.heightCm === 'number') {
      setMemberHeightCmInput(String(selectedPatient.heightCm));
      const { feet, inches } = cmToFeetInches(selectedPatient.heightCm);
      setMemberFeetInput(String(feet));
      setMemberInchesInput(String(inches));
    } else {
      setMemberHeightCmInput('');
      setMemberFeetInput('');
      setMemberInchesInput('');
    }
    setMemberWeightInput(latestWeightForSelected !== null ? String(latestWeightForSelected) : '');
  }, [selectedPatient?.id, selectedPatient?.heightCm, latestWeightForSelected]);

  const resolveHeightCm = (
    unit: 'cm' | 'ft_in',
    cmStr: string,
    ftStr: string,
    inStr: string
  ): number | null => {
    if (unit === 'cm') {
      const res = validateHeightCmInput(cmStr);
      return res.valid && typeof res.heightCm === 'number' ? res.heightCm : null;
    }
    const ft = parseNumericField(ftStr) ?? 0;
    const inch = parseNumericField(inStr) ?? 0;
    if (ft <= 0 && inch <= 0) return null;
    const cm = feetInchesToCm(ft, inch);
    if (cm < MIN_HEIGHT_CM || cm > MAX_HEIGHT_CM) return null;
    return cm;
  };

  const effectiveHeightCm =
    mode === 'member'
      ? resolveHeightCm(memberHeightUnit, memberHeightCmInput, memberFeetInput, memberInchesInput)
      : resolveHeightCm(manualHeightUnit, manualHeightCmInput, manualFeetInput, manualInchesInput);

  const effectiveWeightKg =
    mode === 'member'
      ? parseNumericField(memberWeightInput)
      : parseNumericField(manualWeightInput);

  const pediatricMode =
    mode === 'member' ? isPediatricAge(selectedPatient?.age) : manualUnder18;

  const bmiValue =
    effectiveHeightCm !== null && effectiveWeightKg !== null
      ? calculateBmi(effectiveWeightKg, effectiveHeightCm)
      : null;

  const classification =
    !pediatricMode && bmiValue !== null ? classifyAsianAdultBmi(bmiValue) : null;

  const healthyRange =
    !pediatricMode && effectiveHeightCm !== null
      ? calculateHealthyWeightRangeKg(effectiveHeightCm)
      : null;

  const canSaveProfileHeight =
    mode === 'member' &&
    selectedPatient &&
    effectiveHeightCm !== null &&
    selectedPatient.heightCm !== effectiveHeightCm;

  const handleSaveHeightToProfile = () => {
    if (!selectedPatient || effectiveHeightCm === null) return;
    updatePatient(selectedPatient.id, { heightCm: effectiveHeightCm });
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold text-text`}>
              BMI ক্যালকুলেটর (এশীয় মানদণ্ড)
            </h2>
            <p className="text-xs text-text-muted">
              ওজন ও উচ্চতা অনুযায়ী স্বাস্থ্যকর BMI এবং সুস্থ ওজনের সীমা দেখুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('member')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'member'
                ? 'bg-surface text-primary shadow-2xs'
                : 'text-text-muted hover:text-text'
            }`}
          >
            সদস্য অনুযায়ী
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'manual'
                ? 'bg-surface text-primary shadow-2xs'
                : 'text-text-muted hover:text-text'
            }`}
          >
            হাতে হিসাব (সংরক্ষণ ছাড়া)
          </button>
        </div>
      </div>

      {/* Input Area */}
      {mode === 'member' ? (
        patients.length === 0 ? (
          <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs text-text-muted flex flex-wrap items-center justify-between gap-3">
            <span>এখনো কোনো সদস্য প্রোফাইল নেই — হাতে হিসাব মোডে এখনই পরীক্ষা করতে পারেন।</span>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-lg font-semibold cursor-pointer"
            >
              হাতে হিসাব করুন
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-text mb-1">
                  সদস্য নির্বাচন
                </label>
                <select
                  value={selectedPatient?.id || ''}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text cursor-pointer"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relation}, {toBengaliNumber(p.age)} বছর)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-text mb-1">
                  ওজন (কেজি)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={memberWeightInput}
                  onChange={(e) => setMemberWeightInput(e.target.value)}
                  placeholder="যেমন: ৬৪ বা 64"
                  className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold tabular-nums"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-text">উচ্চতা</label>
                  <button
                    type="button"
                    onClick={() =>
                      setMemberHeightUnit((u) => (u === 'cm' ? 'ft_in' : 'cm'))
                    }
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {memberHeightUnit === 'cm' ? 'ফুট/ইঞ্চিতে লিখুন' : 'সেমিতে লিখুন'}
                  </button>
                </div>

                {memberHeightUnit === 'cm' ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={memberHeightCmInput}
                    onChange={(e) => setMemberHeightCmInput(e.target.value)}
                    placeholder="সেমি (৩০-২৬০)"
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold tabular-nums"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={memberFeetInput}
                      onChange={(e) => setMemberFeetInput(e.target.value)}
                      placeholder="ফুট"
                      className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold text-center tabular-nums"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={memberInchesInput}
                      onChange={(e) => setMemberInchesInput(e.target.value)}
                      placeholder="ইঞ্চি"
                      className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold text-center tabular-nums"
                    />
                  </div>
                )}
              </div>
            </div>

            {canSaveProfileHeight && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-primary-soft/60 border border-primary/25 text-xs">
                <span className="text-text font-medium flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary" />
                  <span>
                    {selectedPatient.name}-এর প্রোফাইলে উচ্চতা ({toBengaliNumber(effectiveHeightCm!)} সেমি) সংরক্ষণ করবেন?
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleSaveHeightToProfile}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>প্রোফাইলে সংরক্ষণ করুন</span>
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-text mb-1">ওজন (কেজি)</label>
              <input
                type="text"
                inputMode="decimal"
                value={manualWeightInput}
                onChange={(e) => setManualWeightInput(e.target.value)}
                placeholder="যেমন: ৬৫ বা 65"
                className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold tabular-nums"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-text">উচ্চতা</label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setManualHeightUnit('cm')}
                    className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                      manualHeightUnit === 'cm'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    সেমি
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualHeightUnit('ft_in')}
                    className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                      manualHeightUnit === 'ft_in'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    ফুট + ইঞ্চি
                  </button>
                </div>
              </div>

              {manualHeightUnit === 'cm' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualHeightCmInput}
                  onChange={(e) => setManualHeightCmInput(e.target.value)}
                  placeholder="যেমন: ১৬৮ (৩০-২৬০ সেমি)"
                  className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold tabular-nums"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualFeetInput}
                    onChange={(e) => setManualFeetInput(e.target.value)}
                    placeholder="ফুট (যেমন: ৫)"
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold text-center tabular-nums"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={manualInchesInput}
                    onChange={(e) => setManualInchesInput(e.target.value)}
                    placeholder="ইঞ্চি (যেমন: ৬)"
                    className="w-full min-h-[44px] px-3 py-2 bg-surface-2 border border-border rounded-xl text-text font-semibold text-center tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-text-muted select-none">
            <input
              type="checkbox"
              checked={manualUnder18}
              onChange={(e) => setManualUnder18(e.target.checked)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
            <span>বয়স ১৮ বছরের কম হলে টিক দিন</span>
          </label>
        </div>
      )}

      {/* Result Area */}
      {pediatricMode ? (
        <div
          role="status"
          className="p-4 rounded-2xl bg-warning-soft border border-warning/35 text-warning-text flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-bold">{BMI_PEDIATRIC_MESSAGE}</p>
            {bmiValue !== null && (
              <p className="text-xs opacity-90 tabular-nums">
                প্রাপ্তবয়স্কের BMI শ্রেণি এখানে প্রযোজ্য নয় (গণনাকৃত মান: {toBengaliNumber(bmiValue.toFixed(1))})।
              </p>
            )}
          </div>
        </div>
      ) : bmiValue !== null && classification ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-text-muted block">আপনার BMI</span>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-bold text-text tabular-nums">
                  {toBengaliNumber(bmiValue.toFixed(1))}
                </span>
                <span className="text-xs text-text-muted">kg/m²</span>
              </div>
            </div>

            <span
              className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold ${classification.badgeClass}`}
            >
              {classification.labelBn}
            </span>
          </div>

          {/* 4-segment WHO Asian visual indicator scale */}
          <div className="space-y-1.5">
            <div className="relative pt-2 pb-1">
              <div className="grid grid-cols-4 h-3 rounded-full overflow-hidden">
                <div className="bg-sky-400 dark:bg-sky-600" />
                <div className="bg-emerald-500 dark:bg-emerald-600" />
                <div className="bg-amber-400 dark:bg-amber-500" />
                <div className="bg-rose-500 dark:bg-rose-600" />
              </div>
              <div
                className="absolute top-0.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                style={{ left: `${Math.max(2, Math.min(98, classification.markerPercent))}%` }}
              >
                <span className="w-4 h-4 rounded-full bg-surface border-2 border-text shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-4 text-[10px] sm:text-[11px] text-text-muted text-center font-medium tabular-nums">
              <span>কম ওজন (&lt;১৮.৫)</span>
              <span>স্বাভাবিক (১৮.৫–২২.৯)</span>
              <span>ঝুঁকি (২৩–২৪.৯)</span>
              <span>স্থূলতা (≥২৫)</span>
            </div>
          </div>

          {healthyRange && (
            <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-2.5 text-xs sm:text-sm">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <span className="text-text">
                এই উচ্চতার ({toBengaliNumber(effectiveHeightCm!)} সেমি) জন্য সুস্থ ওজনের সীমা:{' '}
                <strong className="text-primary tabular-nums">
                  {toBengaliNumber(healthyRange.minKg)} – {toBengaliNumber(healthyRange.maxKg)} কেজি
                </strong>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface-2 border border-dashed border-border text-xs text-text-muted text-center">
          BMI দেখতে সঠিক ওজন (কেজি) এবং উচ্চতা (৩০–২৬০ সেমি) লিখুন
        </div>
      )}

      {/* Limitation & Mandatory Disclaimer */}
      <div className="space-y-2 text-xs">
        <p className="text-text-muted leading-relaxed">{BMI_LIMITATION_NOTE}</p>
        <div className="p-3 rounded-xl bg-warning-soft/70 border border-warning/30 text-warning-text flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-semibold">{BMI_MANDATORY_DISCLAIMER}</p>
        </div>
      </div>
    </section>
  );
};
