import React, { useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  findEmergencyDoctorForPatient,
  validateBangladeshiPhone,
} from '../../utils/doctorsManager';
import {
  PhoneCall,
  HeartPulse,
  AlertOctagon,
  ShieldAlert,
  Stethoscope,
  Ambulance,
  QrCode,
  Star,
} from 'lucide-react';

export const EmergencyCard: React.FC = () => {
  const {
    activePatient,
    doctors,
    loadDoctors,
    settings,
    updateSettings,
    setCurrentPage,
  } = useMedicine();

  useEffect(() => {
    void loadDoctors();
  }, []);

  if (!activePatient) return null;

  const showDoctor = Boolean(settings.showEmergencyDoctorOnCard);
  const emergencyDoctor = showDoctor
    ? findEmergencyDoctorForPatient(doctors, activePatient.id)
    : null;
  const docPhoneInfo = validateBangladeshiPhone(emergencyDoctor?.phone);

  return (
    <div className="bg-surface border border-accent/40 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center font-bold shadow-xs">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-text">
                জরুরি চিকিৎসা কার্ড
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              {activePatient.name} ({activePatient.relation}) · {toBengaliNumber(activePatient.age)} বছর
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage('emergency-qr')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span>QR বানান</span>
          </button>

          {/* Blood Group Badge */}
          <div className="bg-accent text-white px-3.5 py-1.5 rounded-xl text-center shadow-xs">
            <span className="text-xs block opacity-90">রক্তের গ্রুপ</span>
            <span className="text-lg font-extrabold">{activePatient.bloodGroup}</span>
          </div>
        </div>
      </div>

      {/* Medical Highlights: Chronic & Allergies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
        <div className="p-3.5 bg-surface-2 border border-border rounded-xl">
          <span className="font-bold text-text-muted flex items-center gap-1.5 mb-1 text-sm">
            <AlertOctagon className="w-4 h-4 text-accent" />
            পরিচিত অ্যালার্জি
          </span>
          <p className="font-semibold text-text">
            {activePatient.allergies && activePatient.allergies.length > 0
              ? activePatient.allergies.join(', ')
              : 'কোনো পরিচিত অ্যালার্জি নেই'}
          </p>
        </div>

        <div className="p-3.5 bg-surface-2 border border-border rounded-xl">
          <span className="font-bold text-text-muted flex items-center gap-1.5 mb-1 text-sm">
            <ShieldAlert className="w-4 h-4 text-warning" />
            দীর্ঘমেয়াদী রোগ
          </span>
          <p className="font-semibold text-text">
            {activePatient.chronicConditions && activePatient.chronicConditions.length > 0
              ? activePatient.chronicConditions.join(', ')
              : 'কোনো দীর্ঘমেয়াদী রোগ লেখা নেই'}
          </p>
        </div>
      </div>

      {/* Emergency Call Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {/* Family Emergency Contact */}
        {activePatient.emergencyContact ? (
          <a
            href={`tel:${activePatient.emergencyContact}`}
            className="min-h-[48px] flex items-center justify-center gap-2 py-2.5 px-3 bg-accent hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-xs transition-opacity"
          >
            <PhoneCall className="w-4 h-4" />
            <span>পরিবার: {activePatient.emergencyContact}</span>
          </a>
        ) : (
          <div className="min-h-[48px] flex items-center justify-center py-2 px-3 bg-surface-2 text-text-muted rounded-xl text-sm font-medium border border-border">
            জরুরি নম্বর সেট নেই
          </div>
        )}

        {/* National Health Helpline */}
        <a
          href="tel:16263"
          className="min-h-[48px] flex items-center justify-center gap-2 py-2.5 px-3 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-sm font-bold shadow-xs transition-colors"
        >
          <Ambulance className="w-4 h-4" />
          <span>স্বাস্থ্য বাতায়ন: ১৬২৬৩</span>
        </a>

        {/* National Emergency Police/Ambulance */}
        <a
          href="tel:999"
          className="min-h-[48px] flex items-center justify-center gap-2 py-2.5 px-3 bg-text hover:opacity-90 text-bg rounded-xl text-sm font-bold shadow-xs transition-opacity"
        >
          <ShieldAlert className="w-4 h-4 text-accent" />
          <span>জাতীয় জরুরি সেবা: ৯৯৯</span>
        </a>
      </div>

      {/* Optional Emergency Doctor Toggle & Box */}
      <div className="pt-3 border-t border-border space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span>জরুরি কার্ডে জরুরি ডাক্তার দেখান</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showDoctor}
            onClick={() => updateSettings({ showEmergencyDoctorOnCard: !showDoctor })}
            className={`w-12 h-7 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
              showDoctor ? 'bg-primary justify-end' : 'bg-border justify-start'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        {showDoctor && (
          emergencyDoctor ? (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/60 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-text">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
                  <span>{emergencyDoctor.name}</span>
                </div>
                {(emergencyDoctor.specialty || emergencyDoctor.hospital) && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {[emergencyDoctor.specialty, emergencyDoctor.hospital].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {docPhoneInfo.telHref ? (
                <a
                  href={docPhoneInfo.telHref}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold inline-flex items-center gap-1.5 shrink-0"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>কল: {emergencyDoctor.phone}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentPage('doctors')}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-primary cursor-pointer"
                >
                  নম্বর যোগ করুন
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
              <span>এখনো কোনো ডাক্তারকে &quot;জরুরি&quot; পিন করা হয়নি।</span>
              <button
                type="button"
                onClick={() => setCurrentPage('doctors')}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                আমার ডাক্তারে যান →
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};
