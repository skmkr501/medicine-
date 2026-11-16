import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { PatientProfile, TimeSlot } from '../../types';
import {
  Users,
  UserCheck,
  Archive,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  Pill,
  Heart,
  Plus,
} from 'lucide-react';

export const FamilyCareSummary: React.FC = () => {
  const {
    patients,
    activePatient,
    setActivePatientId,
    medicines,
    doseLogs,
    archivePatient,
    unarchivePatient,
    openCreateProfileModal,
    showToast,
  } = useMedicine();

  if (patients.length === 0 && medicines.length === 0) {
    return null;
  }

  const [showArchived, setShowArchived] = useState(false);

  const todayStr = '2026-11-02';

  // Separate active and archived profiles
  const activePatients = patients.filter((p) => !p.isArchived);
  const archivedPatients = patients.filter((p) => p.isArchived);

  // Calculate family-wide metrics across active members
  const familySummary = activePatients.map((patient) => {
    const memberMedicines = medicines.filter(
      (m) => m.assignedPatientId === patient.id && m.status === 'active'
    );

    // Calculate today's scheduled doses for this member
    let scheduledDosesCount = 0;
    let takenDosesCount = 0;

    memberMedicines.forEach((med) => {
      med.schedules.forEach((sch) => {
        scheduledDosesCount++;
        const log = doseLogs.find(
          (l) =>
            l.medicineId === med.id &&
            l.scheduledDate === todayStr &&
            l.timeSlot === sch.timeSlot &&
            l.patientId === patient.id
        );
        if (log && log.status === 'taken') {
          takenDosesCount++;
        }
      });
    });

    const lowStockCount = memberMedicines.filter((m) => m.stock <= m.minStockAlert).length;
    const adherencePercent =
      scheduledDosesCount > 0
        ? Math.round((takenDosesCount / scheduledDosesCount) * 100)
        : 100;

    return {
      patient,
      medicinesCount: memberMedicines.length,
      scheduledDosesCount,
      takenDosesCount,
      adherencePercent,
      lowStockCount,
      memberMedicines,
    };
  });

  const totalFamilyMeds = familySummary.reduce((acc, curr) => acc + curr.medicinesCount, 0);
  const totalFamilyDoses = familySummary.reduce((acc, curr) => acc + curr.scheduledDosesCount, 0);
  const totalFamilyTaken = familySummary.reduce((acc, curr) => acc + curr.takenDosesCount, 0);
  const totalFamilyLowStock = familySummary.reduce((acc, curr) => acc + curr.lowStockCount, 0);

  const handleArchive = (patient: PatientProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        `আপনি কি নিশ্চিত যে "${patient.name}" (${patient.relation}) এর প্রোফাইল আর্কাইভ করতে চান?\n\nআর্কাইভ করলেও রোগীর সকল ওষুধ, ডোজ ইতিহাস ও স্টক সম্পূর্ণ অক্ষত থাকবে। আপনি যেকোনো সময় এটি পুনরায় সক্রিয় করতে পারবেন।`
      )
    ) {
      archivePatient(patient.id);
    }
  };

  const handleUnarchive = (patient: PatientProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    unarchivePatient(patient.id);
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs transition-colors">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-text tracking-tight">
                পারিবারিক যত্ন ড্যাশবোর্ড (Family Care Summary)
              </h2>
              <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-primary-soft text-primary border border-primary/25">
                আইসোলেটেড প্রোফাইল
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              পরিবারের প্রত্যেক সদস্যের জন্য সম্পূর্ণ স্বতন্ত্র ওষুধ, ডোজ হিস্টোরি ও স্টক ব্যবস্থাপনা
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={openCreateProfileModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary-soft border border-primary/25 rounded-lg hover:bg-primary/15 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>সদস্য যোগ করুন</span>
          </button>

          {archivedPatients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-surface-2 hover:bg-border/60 rounded-lg transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-text-muted" />
              <span>
                আর্কাইভ ({toBengaliNumber(archivedPatients.length)}) {showArchived ? 'লুকান' : 'দেখুন'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Family Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-surface-2 border border-border rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            সক্রিয় সদস্য
          </div>
          <div className="text-xl sm:text-2xl font-bold text-text tabular-nums">
            {toBengaliNumber(activePatients.length)} <span className="text-xs font-normal text-text-muted">জন</span>
          </div>
        </div>

        <div className="bg-primary-soft/70 border border-primary/20 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-primary uppercase tracking-wider mb-1">
            মোট বরাদ্দকৃত ওষুধ
          </div>
          <div className="text-xl sm:text-2xl font-bold text-text tabular-nums">
            {toBengaliNumber(totalFamilyMeds)} <span className="text-xs font-normal text-primary">টি</span>
          </div>
        </div>

        <div className="bg-success-soft/70 border border-success/25 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-success-text uppercase tracking-wider mb-1">
            আজকের ডোজ অগ্রগতি
          </div>
          <div className="text-xl sm:text-2xl font-bold text-text tabular-nums">
            {toBengaliNumber(totalFamilyTaken)}/{toBengaliNumber(totalFamilyDoses)}{' '}
            <span className="text-xs font-normal text-success-text">সম্পন্ন</span>
          </div>
        </div>

        <div className="bg-warning-soft/70 border border-warning/25 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-warning-text uppercase tracking-wider mb-1">
            স্বল্প স্টক সতর্কতা
          </div>
          <div className="text-xl sm:text-2xl font-bold text-text tabular-nums">
            {toBengaliNumber(totalFamilyLowStock)} <span className="text-xs font-normal text-warning-text">টি ওষুধ</span>
          </div>
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {familySummary.map(({ patient, medicinesCount, scheduledDosesCount, takenDosesCount, adherencePercent, lowStockCount, memberMedicines }) => {
          const isActive = activePatient?.id === patient.id;

          return (
            <div
              key={patient.id}
              onClick={() => setActivePatientId(patient.id)}
              className={`relative rounded-xl border p-4 sm:p-5 transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-primary-soft/45 border-primary shadow-sm ring-1 ring-primary/30'
                  : 'bg-surface border-border hover:border-primary/50 hover:shadow-xs'
              }`}
            >
              <div>
                {/* Member Title Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow-2xs ${
                        isActive
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-2 text-text'
                      }`}
                    >
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text text-base">
                          {patient.name}
                        </h3>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-2xs font-bold rounded-sm bg-primary text-on-primary uppercase tracking-wider">
                            সক্রিয়
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {patient.relation} · {toBengaliNumber(patient.age)} বছর · রক্তের গ্রুপ: {patient.bloodGroup}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleArchive(patient, e)}
                    className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors"
                    title="প্রোফাইল আর্কাইভ করুন (ইতিহাস অক্ষত থাকবে)"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chronic Conditions */}
                {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {patient.chronicConditions.slice(0, 2).map((c, idx) => (
                      <span
                        key={idx}
                        className="text-2xs px-2 py-0.5 bg-surface-2 text-text-muted rounded-md font-medium"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Medicine List Preview */}
                <div className="bg-surface-2 rounded-lg p-2.5 mb-3 border border-border">
                  <div className="flex items-center justify-between text-2xs text-text-muted font-medium mb-1.5">
                    <span>বরাদ্দকৃত ওষুধ ({toBengaliNumber(medicinesCount)}টি)</span>
                    {lowStockCount > 0 && (
                      <span className="text-warning-text font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {toBengaliNumber(lowStockCount)}টি কম স্টক
                      </span>
                    )}
                  </div>
                  {memberMedicines.length > 0 ? (
                    <div className="space-y-1">
                      {memberMedicines.slice(0, 2).map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs text-text">
                          <span className="truncate max-w-[160px] font-medium">{m.brandName}</span>
                          <span className="text-2xs text-text-muted tabular-nums">
                            স্টক: {toBengaliNumber(m.stock)} {m.unit}
                          </span>
                        </div>
                      ))}
                      {memberMedicines.length > 2 && (
                        <div className="text-2xs text-text-muted pt-0.5">
                          + আরও {toBengaliNumber(memberMedicines.length - 2)}টি ওষুধ
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-2xs text-text-muted italic">এখনও কোনো ওষুধ বরাদ্দ নেই</div>
                  )}
                </div>
              </div>

              {/* Today's Progress Bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-text-muted mb-1">
                  <span>আজকের শিডিউল</span>
                  <span className="tabular-nums font-semibold text-primary">
                    {scheduledDosesCount > 0
                      ? `${toBengaliNumber(takenDosesCount)}/${toBengaliNumber(scheduledDosesCount)} ডোজ`
                      : 'আজ ডোজ নেই'}
                  </span>
                </div>
                <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden mb-3">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${adherencePercent}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setActivePatientId(patient.id)}
                  className={`w-full py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-on-primary hover:bg-primary-hover'
                      : 'bg-surface-2 text-text hover:bg-primary-soft hover:text-primary'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isActive ? 'বর্তমানে প্রদর্শিত প্রোফাইল' : 'এই সদস্যের ড্যাশবোর্ড দেখুন'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Profiles Drawer / Section */}
      {showArchived && archivedPatients.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-text-muted" />
            <h3 className="font-bold text-sm text-text">
              আর্কাইভকৃত পারিবারিক প্রোফাইল ({toBengaliNumber(archivedPatients.length)})
            </h3>
            <span className="text-2xs text-text-muted">
              (এদের সকল ইতিহাস, প্রেসক্রিপশন ও পূর্বের ডোজ রেকর্ড সম্পূর্ণ সংরক্ষিত আছে)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {archivedPatients.map((archived) => {
              const archivedMeds = medicines.filter((m) => m.assignedPatientId === archived.id);
              const archivedLogs = doseLogs.filter((l) => l.patientId === archived.id);

              return (
                <div
                  key={archived.id}
                  className="bg-surface-2/60 border border-dashed border-border rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-text">
                            {archived.name}
                          </span>
                          <span className="text-2xs px-1.5 py-0.5 rounded-sm bg-surface-2 text-text-muted">
                            {archived.relation}
                          </span>
                        </div>
                        <div className="text-2xs text-text-muted mt-0.5">
                          আর্কাইভের তারিখ: {archived.archivedAt ? new Date(archived.archivedAt).toLocaleDateString('bn-BD') : 'সংরক্ষিত'}
                        </div>
                      </div>
                      <span className="text-2xs bg-warning-soft text-warning-text border border-warning/30 px-2 py-0.5 rounded-full font-medium">
                        আর্কাইভড
                      </span>
                    </div>

                    <div className="text-2xs text-text-muted space-y-1 mb-3">
                      <div>সংরক্ষিত ওষুধ: {toBengaliNumber(archivedMeds.length)}টি</div>
                      <div>মোট সংরক্ষিত ডোজ হিস্টোরি: {toBengaliNumber(archivedLogs.length)}টি রেকর্ড</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleUnarchive(archived, e)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-primary-soft hover:bg-primary/15 text-primary text-xs font-semibold rounded-lg border border-primary/25 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>পুনরায় সক্রিয় করুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePatientId(archived.id)}
                      className="py-1.5 px-2.5 bg-surface-2 hover:bg-border/60 text-text text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      title="ইতিহাস ও ডেটা পরীক্ষা করুন"
                    >
                      হিস্টোরি দেখুন
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
