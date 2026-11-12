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
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs transition-colors">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                পারিবারিক যত্ন ড্যাশবোর্ড (Family Care Summary)
              </h2>
              <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                আইসোলেটেড প্রোফাইল
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              পরিবারের প্রত্যেক সদস্যের জন্য সম্পূর্ণ স্বতন্ত্র ওষুধ, ডোজ হিস্টোরি ও স্টক ব্যবস্থাপনা
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={openCreateProfileModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>সদস্য যোগ করুন</span>
          </button>

          {archivedPatients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              <span>
                আর্কাইভ ({toBengaliNumber(archivedPatients.length)}) {showArchived ? 'লুকান' : 'দেখুন'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Family Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            সক্রিয় সদস্য
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {toBengaliNumber(activePatients.length)} <span className="text-xs font-normal text-slate-500">জন</span>
          </div>
        </div>

        <div className="bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-1">
            মোট বরাদ্দকৃত ওষুধ
          </div>
          <div className="text-xl sm:text-2xl font-bold text-teal-900 dark:text-teal-100 tabular-nums">
            {toBengaliNumber(totalFamilyMeds)} <span className="text-xs font-normal text-teal-600">টি</span>
          </div>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
            আজকের ডোজ অগ্রগতি
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
            {toBengaliNumber(totalFamilyTaken)}/{toBengaliNumber(totalFamilyDoses)}{' '}
            <span className="text-xs font-normal text-emerald-600">সম্পন্ন</span>
          </div>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl p-3 sm:p-4">
          <div className="text-2xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
            স্বল্প স্টক সতর্কতা
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
            {toBengaliNumber(totalFamilyLowStock)} <span className="text-xs font-normal text-amber-600">টি ওষুধ</span>
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
                  ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-500 dark:border-teal-600 shadow-sm ring-1 ring-teal-500/30'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs'
              }`}
            >
              <div>
                {/* Member Title Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow-2xs ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                          {patient.name}
                        </h3>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-2xs font-bold rounded-sm bg-teal-600 text-white uppercase tracking-wider">
                            সক্রিয়
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {patient.relation} · {toBengaliNumber(patient.age)} বছর · রক্তের গ্রুপ: {patient.bloodGroup}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleArchive(patient, e)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
                        className="text-2xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded-md font-medium"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Medicine List Preview */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-2.5 mb-3 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 font-medium mb-1.5">
                    <span>বরাদ্দকৃত ওষুধ ({toBengaliNumber(medicinesCount)}টি)</span>
                    {lowStockCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {toBengaliNumber(lowStockCount)}টি কম স্টক
                      </span>
                    )}
                  </div>
                  {memberMedicines.length > 0 ? (
                    <div className="space-y-1">
                      {memberMedicines.slice(0, 2).map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                          <span className="truncate max-w-[160px] font-medium">{m.brandName}</span>
                          <span className="text-2xs text-slate-500 tabular-nums">
                            স্টক: {toBengaliNumber(m.stock)} {m.unit}
                          </span>
                        </div>
                      ))}
                      {memberMedicines.length > 2 && (
                        <div className="text-2xs text-slate-400 pt-0.5">
                          + আরও {toBengaliNumber(memberMedicines.length - 2)}টি ওষুধ
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-2xs text-slate-400 italic">এখনও কোনো ওষুধ বরাদ্দ নেই</div>
                  )}
                </div>
              </div>

              {/* Today's Progress Bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  <span>আজকের শিডিউল</span>
                  <span className="tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                    {scheduledDosesCount > 0
                      ? `${toBengaliNumber(takenDosesCount)}/${toBengaliNumber(scheduledDosesCount)} ডোজ`
                      : 'আজ ডোজ নেই'}
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-3">
                  <div
                    className="bg-teal-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${adherencePercent}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setActivePatientId(patient.id)}
                  className={`w-full py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-teal-700 text-white hover:bg-teal-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-700 dark:hover:text-teal-300'
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
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              আর্কাইভকৃত পারিবারিক প্রোফাইল ({toBengaliNumber(archivedPatients.length)})
            </h3>
            <span className="text-2xs text-slate-500 dark:text-slate-400">
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
                  className="bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            {archived.name}
                          </span>
                          <span className="text-2xs px-1.5 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                            {archived.relation}
                          </span>
                        </div>
                        <div className="text-2xs text-slate-400 mt-0.5">
                          আর্কাইভের তারিখ: {archived.archivedAt ? new Date(archived.archivedAt).toLocaleDateString('bn-BD') : 'সংরক্ষিত'}
                        </div>
                      </div>
                      <span className="text-2xs bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded-full font-medium">
                        আর্কাইভড
                      </span>
                    </div>

                    <div className="text-2xs text-slate-500 dark:text-slate-400 space-y-1 mb-3">
                      <div>সংরক্ষিত ওষুধ: {toBengaliNumber(archivedMeds.length)}টি</div>
                      <div>মোট সংরক্ষিত ডোজ হিস্টোরি: {toBengaliNumber(archivedLogs.length)}টি রেকর্ড</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleUnarchive(archived, e)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-lg border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>পুনরায় সক্রিয় করুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePatientId(archived.id)}
                      className="py-1.5 px-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
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
