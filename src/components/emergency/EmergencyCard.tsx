import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  PhoneCall,
  HeartPulse,
  AlertOctagon,
  ShieldAlert,
  User,
  Stethoscope,
  Ambulance,
} from 'lucide-react';

export const EmergencyCard: React.FC = () => {
  const { activePatient, medicines } = useMedicine();

  if (!activePatient) return null;

  // Find assigned doctor from patient medicines if any
  const doctorWithPhone = medicines.find(
    (m) => m.assignedPatientId === activePatient.id && m.doctorName
  );

  return (
    <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50 dark:from-rose-950/40 dark:via-slate-900 dark:to-amber-950/20 border border-rose-200/90 dark:border-rose-900/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-rose-100 dark:border-rose-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                জরুরি চিকিৎসা কার্ড (Emergency Card)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                জরুরি সহায়ক
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activePatient.name} ({activePatient.relation}) · {toBengaliNumber(activePatient.age)} বছর
            </p>
          </div>
        </div>

        {/* Blood Group Badge */}
        <div className="bg-rose-600 text-white px-3 py-1 rounded-xl text-center shadow-xs">
          <span className="text-2xs block uppercase tracking-wider opacity-90">রক্তের গ্রুপ</span>
          <span className="text-base font-extrabold">{activePatient.bloodGroup}</span>
        </div>
      </div>

      {/* Medical Highlights: Chronic & Allergies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1 text-2xs uppercase tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
            পরিচিত অ্যালার্জি (Allergies)
          </span>
          <p className="font-medium text-slate-900 dark:text-white">
            {activePatient.allergies && activePatient.allergies.length > 0
              ? activePatient.allergies.join(', ')
              : 'কোনো পরিচিত ড্রাগ অ্যালার্জি নেই'}
          </p>
        </div>

        <div className="p-3 bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1 text-2xs uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            দীর্ঘমেয়াদী রোগ (Chronic Conditions)
          </span>
          <p className="font-medium text-slate-900 dark:text-white">
            {activePatient.chronicConditions && activePatient.chronicConditions.length > 0
              ? activePatient.chronicConditions.join(', ')
              : 'কোনো দীর্ঘমেয়াদী রোগ নথিভুক্ত নেই'}
          </p>
        </div>
      </div>

      {/* Emergency Call Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {/* Family Emergency Contact */}
        {activePatient.emergencyContact ? (
          <a
            href={`tel:${activePatient.emergencyContact}`}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <PhoneCall className="w-4 h-4" />
            <span>জরুরি অভিভাবক: {activePatient.emergencyContact}</span>
          </a>
        ) : (
          <div className="flex items-center justify-center py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-xs">
            জরুরি নম্বর সেট নেই
          </div>
        )}

        {/* National Health Helpline */}
        <a
          href="tel:16263"
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Ambulance className="w-4 h-4" />
          <span>স্বাস্থ্য বাতায়ন: ১৬২৬৩</span>
        </a>

        {/* National Emergency Police/Ambulance */}
        <a
          href="tel:999"
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>জাতীয় জরুরি সেবা: ৯৯৯</span>
        </a>
      </div>
    </div>
  );
};
