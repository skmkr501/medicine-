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
  PlusCircle,
  History,
  X,
} from 'lucide-react';
import { CaregiverLinkDoc } from '../../types';
import { CaregiverSuggestModal } from './CaregiverSuggestModal';

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
            className="p-4 sm:p-5 rounded-2xl bg-danger-soft border-2 border-danger/40 shadow-sm space-y-3.5"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-danger text-white flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-danger-text">
                    পরিবারের জরুরি সতর্কতা
                  </span>
                  <span className="text-xs font-semibold text-danger-text/80">
                    {formatAlertRelativeTimeBn(alert.createdAt)}
                  </span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-text mt-1 leading-snug">
                  {alert.message}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {cleanPhone ? (
                <a
                  href={`tel:${cleanPhone}`}
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-base flex items-center justify-center gap-2 transition-colors"
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
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-surface-2 text-text-muted font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-5 h-5 shrink-0" />
                  <span>ফোন করুন</span>
                </button>
              )}

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-base flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>হোয়াটসঅ্যাপে লিখুন</span>
              </a>

              <button
                type="button"
                onClick={() => markFamilyAlertSeen(alert.id)}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border-2 border-border text-text font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Check className="w-5 h-5 shrink-0 text-success" />
                <span>দেখেছি</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Failed/offline alert warning for Patient with direct WhatsApp fallback */}
      {failedCaregiverAlerts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-warning-soft border-2 border-warning/40 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-warning shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-warning-text">
                যত্নকারীকে এখনই জানানো যায়নি
              </p>
              <p className="text-sm text-text mt-0.5">
                ইন্টারনেট বা সংযোগ সমস্যার কারণে {toBengaliNumber(failedCaregiverAlerts.length)}টি সতর্কতা অপেক্ষায় আছে। চাইলে এখনই হোয়াটসঅ্যাপে পাঠাতে পারেন:
              </p>
              <p className="text-sm font-semibold text-text mt-1.5">
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
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm sm:text-base flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span>হোয়াটসঅ্যাপে পাঠান</span>
            </a>

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-surface border border-warning/40 text-warning-text font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer"
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
    sentCaregiverSuggestions,
    isLoadingSentSuggestions,
    loadCaregiverSentSuggestions,
    cancelCaregiverSuggestion,
  } = useMedicine();

  const [expandedPatientLinkId, setExpandedPatientLinkId] = useState<string | null>(null);
  const [suggestModalLink, setSuggestModalLink] = useState<CaregiverLinkDoc | null>(null);
  const [showSentList, setShowSentList] = useState(false);

  const handleToggleSentList = () => {
    const next = !showSentList;
    setShowSentList(next);
    if (next) {
      loadCaregiverSentSuggestions();
    }
  };

  if (!currentUser || caringForLinks.length === 0) {
    return null;
  }

  const todayIso = toLocalIsoDate(new Date());

  return (
    <section className="bg-surface border border-primary/25 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">পরিবার</h2>
            <p className="text-xs text-text-muted">
              যাদের ওষুধের খোঁজখবর আপনি রাখছেন
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSentList}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
              showSentList
                ? 'bg-primary border-primary text-on-primary'
                : 'bg-surface-2 border-border text-text hover:border-primary/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>পাঠানো প্রস্তাব</span>
          </button>

          <button
            type="button"
            onClick={refreshCaregiverLinks}
            disabled={isCaregiverLoading}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary-soft border border-primary/25 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCaregiverLoading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-text bg-surface-2 cursor-pointer"
          >
            পরিচালনা
          </button>
        </div>
      </div>

      {/* One-time loaded Sent Suggestions History (max 20, no listener) */}
      {showSentList && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-surface-2 border border-border space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-text">
              আমার পাঠানো ওষুধের প্রস্তাব
            </p>
            <button
              type="button"
              onClick={loadCaregiverSentSuggestions}
              disabled={isLoadingSentSuggestions}
              className="text-xs font-bold text-primary cursor-pointer"
            >
              {isLoadingSentSuggestions ? 'লোড হচ্ছে...' : 'রিফ্রেশ'}
            </button>
          </div>

          {isLoadingSentSuggestions && sentCaregiverSuggestions.length === 0 ? (
            <p className="text-xs text-text-muted">তথ্য আনা হচ্ছে...</p>
          ) : sentCaregiverSuggestions.length === 0 ? (
            <p className="text-xs text-text-muted">
              এখনো কোনো ওষুধের প্রস্তাব পাঠানো হয়নি।
            </p>
          ) : (
            <div className="space-y-2">
              {sentCaregiverSuggestions.map((sug) => {
                const statusInfo =
                  sug.status === 'accepted'
                    ? { label: 'অনুমোদিত', cls: 'bg-success-soft text-success-text' }
                    : sug.status === 'rejected'
                    ? { label: 'বাতিল', cls: 'bg-danger-soft text-danger-text' }
                    : sug.status === 'cancelled'
                    ? { label: 'বাতিল (নিজে)', cls: 'bg-surface text-text-muted border border-border' }
                    : { label: 'অপেক্ষমাণ', cls: 'bg-warning-soft text-warning-text' };

                const kindLabel =
                  sug.kind === 'stop' ? 'বন্ধ' : sug.kind === 'edit' ? 'বদল' : 'নতুন';

                return (
                  <div
                    key={sug.id}
                    className="p-3 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text truncate">
                        {sug.medicine.brandName} {sug.medicine.strength || ''} ({kindLabel})
                      </p>
                      <p className="text-xs text-text-muted">
                        {sug.patientName || 'রোগী'} ·{' '}
                        {formatAlertRelativeTimeBn(new Date(sug.createdAtMs).toISOString())}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                      {sug.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => cancelCaregiverSuggestion(sug.id)}
                          title="প্রস্তাব প্রত্যাহার করুন"
                          className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-surface-2 hover:bg-danger-soft text-text-muted hover:text-danger-text text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>প্রত্যাহার</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
              className="p-4 rounded-xl bg-surface-2 border border-border space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-text truncate">
                    {link.patientName}
                  </h3>
                  <p className="text-sm font-semibold text-text-muted mt-0.5">
                    {!summary ? (
                      'আজকের তথ্য এখনো আপডেট হয়নি'
                    ) : !isSummaryToday ? (
                      'আজকের ডোজের তথ্য এখনো আসেনি'
                    ) : totalCount === 0 ? (
                      'আজকের কোনো নির্ধারিত ওষুধ নেই'
                    ) : remainingCount === 0 ? (
                      <span className="text-success-text">
                        আজকের সব {toBengaliNumber(takenCount)}টি ডোজ খাওয়া হয়েছে ✓
                      </span>
                    ) : (
                      <>
                        আজ খাওয়া হয়েছে:{' '}
                        <span className="text-success-text">
                          {toBengaliNumber(takenCount)}টি
                        </span>{' '}
                        · বাকি:{' '}
                        <span className="text-warning-text">
                          {toBengaliNumber(remainingCount)}টি
                        </span>
                      </>
                    )}
                  </p>
                  {latestAlert && (
                    <p className="text-xs sm:text-sm text-danger-text mt-1 font-medium">
                      শেষ সতর্কতা: {latestAlert.message} ({formatAlertRelativeTimeBn(latestAlert.createdAt)})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {cleanPhone && (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm flex items-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span>কল</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedPatientLinkId(isExpanded ? null : link.id)}
                    className="min-h-[48px] px-3.5 py-2 rounded-xl bg-surface border border-border text-text font-bold text-sm flex items-center gap-1.5 cursor-pointer"
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

              {link.allowSuggestions === true && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setSuggestModalLink(link)}
                    className="min-h-[48px] w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary-soft hover:bg-primary hover:text-on-primary text-primary border border-primary/30 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>ওষুধের প্রস্তাব দিন</span>
                  </button>
                </div>
              )}

              {isExpanded && (
                <div className="pt-3 border-t border-border space-y-3">
                  {/* Today's dose status list */}
                  <div>
                    <p className="text-xs font-bold text-text-muted mb-2">
                      আজকের ডোজের অবস্থা
                    </p>
                    {!isSummaryToday || !summary?.doses || summary.doses.length === 0 ? (
                      <p className="text-sm text-text-muted">
                        আজকের কোনো ডোজ তালিকা পাওয়া যায়নি।
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {summary.doses.map((dose, idx) => (
                          <div
                            key={`${dose.medicineName}_${dose.timeSlot}_${idx}`}
                            className="p-2.5 rounded-xl bg-surface border border-border flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-text truncate">
                                {dose.medicineName}
                              </p>
                              <p className="text-xs text-text-muted">
                                {dose.timeSlot} · {formatBengaliTime(dose.time)} · {dose.dosage}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 inline-flex items-center gap-1 ${
                                dose.status === 'taken'
                                  ? 'bg-success-soft text-success-text'
                                  : dose.status === 'skipped'
                                  ? 'bg-surface-2 text-text-muted'
                                  : 'bg-warning-soft text-warning-text'
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
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5" />
                        <span>চলমান সব ওষুধ ও মজুদ (রোগীর অনুমতিতে)</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {link.sharedMedicines.map((med, idx) => (
                          <div
                            key={`${med.brandName}_${idx}`}
                            className="p-2.5 rounded-xl bg-primary-soft/60 border border-primary/25"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-text truncate">
                                {med.brandName} {med.strength || ''}
                              </span>
                              <span className="text-xs font-bold text-primary shrink-0">
                                মজুদ: {toBengaliNumber(med.stock)} {med.unit}
                              </span>
                            </div>
                            {med.schedulesText && (
                              <p className="text-xs text-text-muted mt-0.5">
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

      {suggestModalLink && (
        <CaregiverSuggestModal
          link={suggestModalLink}
          onClose={() => setSuggestModalLink(null)}
        />
      )}
    </section>
  );
};
