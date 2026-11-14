import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { formatBengaliTime, toBengaliNumber } from '../../utils/bengaliUtils';
import { toLocalIsoDate } from '../../utils/shoppingListCalculator';
import {
  buildCaregiverAlertCheckInWhatsAppUrl,
  buildPatientManualAlertWhatsAppUrl,
  cleanPhoneForLinks,
  formatAlertRelativeTimeBn,
} from '../../utils/caregiverAlerts';
import {
  BellRing,
  Phone,
  MessageCircle,
  Check,
  Users,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Pill,
} from 'lucide-react';

export const CaregiverAlertBanners: React.FC = () => {
  const {
    currentUser,
    caregiverAlerts,
    caringForLinks,
    markFamilyAlertSeen,
    failedCaregiverAlerts,
    retryFailedCaregiverAlerts,
    dismissFailedCaregiverAlert,
    showToast,
  } = useMedicine();

  const [isRetrying, setIsRetrying] = useState(false);

  const unseenAlerts = currentUser
    ? caregiverAlerts.filter((a) => !Array.isArray(a.seenBy) || !a.seenBy.includes(currentUser.uid))
    : [];

  if (unseenAlerts.length === 0 && failedCaregiverAlerts.length === 0) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryFailedCaregiverAlerts();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Unseen incoming alerts for Caregiver */}
      {unseenAlerts.map((alert) => {
        const linkedPatient = caringForLinks.find((l) => l.patientUid === alert.patientUid);
        const rawPhone = alert.patientPhone || linkedPatient?.patientPhone || '';
        const cleanPhone = cleanPhoneForLinks(rawPhone);
        const whatsappUrl = buildCaregiverAlertCheckInWhatsAppUrl(
          cleanPhone,
          alert.patientName || linkedPatient?.patientName || 'পরিবারের সদস্য',
          alert.message
        );

        return (
          <div
            key={alert.id}
            role="alert"
            className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-700 shadow-sm space-y-3.5"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    পরিবারের জরুরি সতর্কতা
                  </span>
                  <span className="text-xs font-semibold text-rose-700/80 dark:text-rose-300/80">
                    {formatAlertRelativeTimeBn(alert.createdAt)}
                  </span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                  {alert.message}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {cleanPhone ? (
                <a
                  href={`tel:${cleanPhone}`}
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone className="w-5 h-5 shrink-0" />
                  <span>ফোন করুন</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    showToast('রোগীর ফোন নম্বর সেটিংসে সংরক্ষিত নেই, হোয়াটসঅ্যাপে লিখুন', 'info')
                  }
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-5 h-5 shrink-0" />
                  <span>ফোন করুন</span>
                </button>
              )}

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>হোয়াটসঅ্যাপে লিখুন</span>
              </a>

              <button
                type="button"
                onClick={() => markFamilyAlertSeen(alert.id)}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Check className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>দেখেছি</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Failed/offline alert warning for Patient with direct WhatsApp fallback */}
      {failedCaregiverAlerts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-amber-950 dark:text-amber-100">
                যত্নকারীকে এখনই জানানো যায়নি
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 mt-0.5">
                ইন্টারনেট বা ক্লাউড সীমার কারণে {toBengaliNumber(failedCaregiverAlerts.length)}টি সতর্কতা অপেক্ষায় আছে। চাইলে এখনই হোয়াটসঅ্যাপে পাঠাতে পারেন:
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1.5">
                “{failedCaregiverAlerts[0].message}”
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={buildPatientManualAlertWhatsAppUrl(
                failedCaregiverAlerts.map((a) => a.message).join('\n')
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => failedCaregiverAlerts.forEach((a) => dismissFailedCaregiverAlert(a.id))}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm sm:text-base flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span>হোয়াটসঅ্যাপে পাঠান</span>
            </a>

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>আবার চেষ্টা</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const CaregiverFamilyCard: React.FC = () => {
  const {
    currentUser,
    caringForLinks,
    caregiverAlerts,
    refreshCaregiverLinks,
    isCaregiverLoading,
    setCurrentPage,
  } = useMedicine();

  const [expandedPatientLinkId, setExpandedPatientLinkId] = useState<string | null>(null);

  if (!currentUser || caringForLinks.length === 0) {
    return null;
  }

  const todayIso = toLocalIsoDate(new Date());

  return (
    <section className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">পরিবার</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              যাদের ওষুধের খোঁজখবর আপনি রাখছেন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshCaregiverLinks}
            disabled={isCaregiverLoading}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCaregiverLoading ? 'animate-spin' : ''}`} />
            <span>হালনাগাদ</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 cursor-pointer"
          >
            পরিচালনা
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {caringForLinks.map((link) => {
          const isExpanded = expandedPatientLinkId === link.id;
          const summary = link.todaySummary;
          const isSummaryToday = summary?.date === todayIso;
          const takenCount = isSummaryToday ? summary?.takenDoses || 0 : 0;
          const remainingCount = isSummaryToday ? summary?.remainingDoses || 0 : 0;
          const totalCount = isSummaryToday ? summary?.totalDoses || 0 : 0;

          const latestAlert = caregiverAlerts.find((a) => a.patientUid === link.patientUid);
          const cleanPhone = cleanPhoneForLinks(link.patientPhone);

          return (
            <div
              key={link.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {link.patientName}
                  </h3>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                    {!summary ? (
                      'আজকের তথ্য এখনো আপডেট হয়নি'
                    ) : !isSummaryToday ? (
                      'আজকের ডোজের তথ্য এখনো আসেনি'
                    ) : totalCount === 0 ? (
                      'আজকের কোনো নির্ধারিত ওষুধ নেই'
                    ) : remainingCount === 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        আজকের সব {toBengaliNumber(takenCount)}টি ডোজ খাওয়া হয়েছে ✓
                      </span>
                    ) : (
                      <>
                        আজ খাওয়া হয়েছে:{' '}
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {toBengaliNumber(takenCount)}টি
                        </span>{' '}
                        · বাকি:{' '}
                        <span className="text-amber-700 dark:text-amber-400">
                          {toBengaliNumber(remainingCount)}টি
                        </span>
                      </>
                    )}
                  </p>
                  {latestAlert && (
                    <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 mt-1 font-medium">
                      শেষ সতর্কতা: {latestAlert.message} ({formatAlertRelativeTimeBn(latestAlert.createdAt)})
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cleanPhone && (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm flex items-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span>কল</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedPatientLinkId(isExpanded ? null : link.id)}
                    className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>বিস্তারিত</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  {/* Today's dose status list */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      আজকের ডোজের অবস্থা
                    </p>
                    {!isSummaryToday || !summary?.doses || summary.doses.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        আজকের কোনো ডোজ তালিকা পাওয়া যায়নি।
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {summary.doses.map((dose, idx) => (
                          <div
                            key={`${dose.medicineName}_${dose.timeSlot}_${idx}`}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {dose.medicineName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {dose.timeSlot} · {formatBengaliTime(dose.time)} · {dose.dosage}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 inline-flex items-center gap-1 ${
                                dose.status === 'taken'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : dose.status === 'skipped'
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {dose.status === 'taken' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>খেয়েছেন</span>
                                </>
                              ) : dose.status === 'skipped' ? (
                                <span>বাদ</span>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>বাকি</span>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Full medicines & stock ONLY if patient explicitly toggled allowFullView */}
                  {link.allowFullView && link.sharedMedicines && link.sharedMedicines.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-2 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5" />
                        <span>চলমান সব ওষুধ ও মজুদ (রোগীর অনুমতিতে)</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {link.sharedMedicines.map((med, idx) => (
                          <div
                            key={`${med.brandName}_${idx}`}
                            className="p-2.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {med.brandName} {med.strength || ''}
                              </span>
                              <span className="text-xs font-bold text-teal-800 dark:text-teal-300 shrink-0">
                                মজুদ: {toBengaliNumber(med.stock)} {med.unit}
                              </span>
                            </div>
                            {med.schedulesText && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {med.schedulesText} ({med.mealTiming})
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
