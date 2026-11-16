import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import {
  EmergencyCardDoc,
  EmergencyCardSelection,
} from '../../types';
import {
  DEFAULT_EMERGENCY_CARD_SELECTION,
  buildEmergencyCardPayload,
  buildEmergencyCardUrl,
  buildEmergencyCardWhatsAppUrl,
  deriveSelectionFromEmergencyCard,
  formatEmergencyCardCreatedDate,
  generateEmergencyToken,
  generateQrMatrix,
  getEmergencyIncludedSummaryLabels,
  renderLockScreenPngDataUrl,
  triggerLockScreenPngDownload,
} from '../../utils/emergencyQr';
import {
  findDoctorForEmergencyQr,
  formatEmergencyDoctorLabelForQr,
} from '../../utils/doctorsManager';
import {
  createEmergencyCardInCloud,
  deleteEmergencyCardInCloud,
  fetchOwnerEmergencyCardsFromCloud,
  revokeEmergencyCardInCloud,
  rotateEmergencyCardInCloud,
  updateEmergencyCardInCloud,
} from '../../firebase/services';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  AlertOctagon,
  ArrowLeft,
  Ban,
  Check,
  Copy,
  Download,
  ExternalLink,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  PhoneCall,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

interface QrSvgProps {
  url: string;
  sizePx?: number;
  className?: string;
}

const QrSvg: React.FC<QrSvgProps> = ({ url, sizePx = 180, className = '' }) => {
  const matrix = useMemo(() => generateQrMatrix(url), [url]);
  const quiet = 2;
  const total = matrix.size + quiet * 2;

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="জরুরি কার্ড QR কোড"
      className={className}
    >
      <rect x="0" y="0" width={total} height={total} fill="#FFFFFF" />
      {matrix.modules.map((row, rIdx) =>
        row.map((isDark, cIdx) =>
          isDark ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + quiet}
              y={rIdx + quiet}
              width="1"
              height="1"
              fill="#0F172A"
            />
          ) : null
        )
      )}
    </svg>
  );
};

export const EmergencyQrPage: React.FC = () => {
  const {
    patients,
    activePatient,
    medicines,
    doctors,
    loadDoctors,
    settings,
    currentUser,
    openAuthModal,
    openCreateProfileModal,
    setCurrentPage,
    showToast,
  } = useMedicine();

  useEffect(() => {
    void loadDoctors();
  }, []);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    () => activePatient?.id || patients[0]?.id || ''
  );
  const [selection, setSelection] = useState<EmergencyCardSelection>({
    ...DEFAULT_EMERGENCY_CARD_SELECTION,
  });

  const [cards, setCards] = useState<EmergencyCardDoc[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [copiedNow, setCopiedNow] = useState(false);

  const [lockScreenPreviewUrl, setLockScreenPreviewUrl] = useState<string | null>(null);
  const [isWebViewSaveHint, setIsWebViewSaveHint] = useState(false);

  const selectedPatient = useMemo(
    () =>
      patients.find((p) => p.id === selectedPatientId) ||
      activePatient ||
      patients[0] ||
      null,
    [patients, selectedPatientId, activePatient]
  );

  // Sync selected patient if patient list loads lazily
  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(activePatient?.id || patients[0].id);
    }
  }, [patients, selectedPatientId, activePatient]);

  const loadOwnerCards = useCallback(async () => {
    if (!currentUser) {
      setCards([]);
      return;
    }
    setIsLoadingCards(true);
    setCardsError(null);
    try {
      const list = await fetchOwnerEmergencyCardsFromCloud(currentUser.uid);
      setCards(list);
    } catch (err: any) {
      setCardsError(err?.message || 'জরুরি QR তালিকা লোড করা যায়নি।');
    } finally {
      setIsLoadingCards(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadOwnerCards();
  }, [loadOwnerCards]);

  // Active card matching the currently selected patient name
  const activeCardForSelectedPatient = useMemo(() => {
    if (!selectedPatient) return null;
    const cleanName = (selectedPatient.name || '').trim();
    return (
      cards.find((c) => c.active && c.patientName.trim() === cleanName) || null
    );
  }, [cards, selectedPatient]);

  // Pre-fill toggles when switching to a patient who already has an active QR card
  useEffect(() => {
    if (activeCardForSelectedPatient) {
      setSelection(deriveSelectionFromEmergencyCard(activeCardForSelectedPatient));
    } else {
      setSelection({ ...DEFAULT_EMERGENCY_CARD_SELECTION });
    }
    setActionError(null);
    setCopiedNow(false);
  }, [selectedPatient?.id, activeCardForSelectedPatient?.token]);

  // Manage wallet print body isolation cleanly
  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('wallet-card-print-active');
    };
    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  const doctorNameCandidate = useMemo(() => {
    if (!selectedPatient) return '';
    const directoryDoctor = findDoctorForEmergencyQr(doctors, selectedPatient.id);
    if (directoryDoctor) {
      return formatEmergencyDoctorLabelForQr(directoryDoctor);
    }
    return (
      medicines.find(
        (m) => m.assignedPatientId === selectedPatient.id && m.doctorName?.trim()
      )?.doctorName?.trim() || ''
    );
  }, [selectedPatient, doctors, medicines]);

  const previewPayload = useMemo(() => {
    if (!selectedPatient) return null;
    return buildEmergencyCardPayload({
      ownerUid: currentUser?.uid || 'preview',
      token: activeCardForSelectedPatient?.token || 'preview_token_placeholder',
      patient: selectedPatient,
      medicines,
      selection,
      emergencyContactName: settings.emergencyContactName,
      emergencyContactPhone: settings.emergencyContactPhone,
      doctorNameOverride: doctorNameCandidate || undefined,
    });
  }, [
    selectedPatient,
    currentUser?.uid,
    activeCardForSelectedPatient?.token,
    medicines,
    selection,
    settings.emergencyContactName,
    settings.emergencyContactPhone,
    doctorNameCandidate,
  ]);

  const includedLabels = useMemo(
    () => getEmergencyIncludedSummaryLabels(selection, previewPayload || undefined),
    [selection, previewPayload]
  );

  const toggleField = (key: keyof EmergencyCardSelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    setActionError(null);
  };

  const handleCreateOrUpdateSameLink = async () => {
    setActionError(null);
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (!selectedPatient) {
      setActionError('প্রথমে একটি রোগীর প্রোফাইল তৈরি বা নির্বাচন করুন।');
      return;
    }

    setIsSaving(true);
    try {
      if (activeCardForSelectedPatient) {
        const payload = buildEmergencyCardPayload({
          ownerUid: currentUser.uid,
          token: activeCardForSelectedPatient.token,
          patient: selectedPatient,
          medicines,
          selection,
          emergencyContactName: settings.emergencyContactName,
          emergencyContactPhone: settings.emergencyContactPhone,
          doctorNameOverride: doctorNameCandidate || undefined,
        });
        const updated = await updateEmergencyCardInCloud(
          activeCardForSelectedPatient.token,
          payload
        );
        setCards((prev) =>
          prev.map((c) =>
            c.token === updated.token ? { ...c, ...updated, createdAt: c.createdAt, createdAtMs: c.createdAtMs } : c
          )
        );
        showToast('একই লিংকে জরুরি কার্ডের তথ্য হালনাগাদ হয়েছে।');
      } else {
        const token = generateEmergencyToken();
        const payload = buildEmergencyCardPayload({
          ownerUid: currentUser.uid,
          token,
          patient: selectedPatient,
          medicines,
          selection,
          emergencyContactName: settings.emergencyContactName,
          emergencyContactPhone: settings.emergencyContactPhone,
          doctorNameOverride: doctorNameCandidate || undefined,
        });
        const created = await createEmergencyCardInCloud(payload);
        setCards((prev) => [created, ...prev]);
        showToast('নতুন জরুরি QR কার্ড তৈরি হয়েছে।');
      }
    } catch (err: any) {
      setActionError(err?.message || 'জরুরি QR কার্ড সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateCard = async (oldToken: string, targetPatientName?: string) => {
    setActionError(null);
    if (!currentUser) {
      openAuthModal();
      return;
    }
    const patientObj =
      patients.find((p) => (p.name || '').trim() === (targetPatientName || '').trim()) ||
      selectedPatient;
    if (!patientObj) {
      setActionError('রোগীর প্রোফাইল খুঁজে পাওয়া যায়নি।');
      return;
    }

    setBusyToken(oldToken);
    try {
      const newToken = generateEmergencyToken();
      const payload = buildEmergencyCardPayload({
        ownerUid: currentUser.uid,
        token: newToken,
        patient: patientObj,
        medicines,
        selection,
        emergencyContactName: settings.emergencyContactName,
        emergencyContactPhone: settings.emergencyContactPhone,
        doctorNameOverride: doctorNameCandidate || undefined,
      });
      const created = await rotateEmergencyCardInCloud(oldToken, payload);
      setCards((prev) => [
        created,
        ...prev.map((c) => (c.token === oldToken ? { ...c, active: false } : c)),
      ]);
      showToast('পুরনো QR বাতিল করে নতুন QR তৈরি হয়েছে।');
    } catch (err: any) {
      setActionError(err?.message || 'নতুন QR তৈরি করা যায়নি।');
    } finally {
      setBusyToken(null);
    }
  };

  const handleRevokeCard = async (token: string) => {
    setBusyToken(token);
    setActionError(null);
    try {
      await revokeEmergencyCardInCloud(token);
      setCards((prev) =>
        prev.map((c) => (c.token === token ? { ...c, active: false } : c))
      );
      showToast('জরুরি QR বাতিল করা হয়েছে। এটি আর খোলা যাবে না।');
    } catch (err: any) {
      setActionError(err?.message || 'বাতিল করা যায়নি।');
    } finally {
      setBusyToken(null);
    }
  };

  const handleDeleteCard = async (token: string) => {
    setBusyToken(token);
    setActionError(null);
    try {
      await deleteEmergencyCardInCloud(token);
      setCards((prev) => prev.filter((c) => c.token !== token));
      showToast('তালিকা থেকে মুছে ফেলা হয়েছে।');
    } catch (err: any) {
      setActionError(err?.message || 'মুছে ফেলা যায়নি।');
    } finally {
      setBusyToken(null);
    }
  };

  const activeCardUrl = activeCardForSelectedPatient
    ? buildEmergencyCardUrl(activeCardForSelectedPatient.token)
    : '';

  const handleCopyUrl = async () => {
    if (!activeCardUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeCardUrl);
        setCopiedNow(true);
        showToast('জরুরি কার্ডের লিংক কপি হয়েছে।');
        setTimeout(() => setCopiedNow(false), 3000);
        return;
      }
    } catch {
      // ignore fallback
    }
    showToast('নিচের লিংকটি চেপে ধরে কপি করুন।', 'info');
  };

  const handlePrintWalletCard = () => {
    if (!activeCardForSelectedPatient) return;
    document.body.classList.add('wallet-card-print-active');
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleDownloadLockScreenPng = () => {
    if (!activeCardForSelectedPatient || !activeCardUrl) return;
    try {
      const dataUrl = renderLockScreenPngDataUrl({
        patientName: activeCardForSelectedPatient.patientName,
        age: activeCardForSelectedPatient.age,
        bloodGroup: activeCardForSelectedPatient.bloodGroup,
        allergies: activeCardForSelectedPatient.allergies,
        conditions: activeCardForSelectedPatient.conditions,
        contactName: activeCardForSelectedPatient.contactName,
        contactPhone: activeCardForSelectedPatient.contactPhone,
        qrUrl: activeCardUrl,
      });

      const safeFile = `emergency-lockscreen-${activeCardForSelectedPatient.patientName
        .replace(/[^a-zA-Z0-9\u0980-\u09FF]+/g, '-')
        .replace(/^-|-$/g, '') || 'card'}.png`;

      const result = triggerLockScreenPngDownload(dataUrl, safeFile);
      setLockScreenPreviewUrl(dataUrl);
      setIsWebViewSaveHint(result.isWebView || !result.triggeredDownload);

      if (result.triggeredDownload) {
        showToast('লক স্ক্রিন ছবি নামানো হয়েছে। ফোনের সেটিংসে ওয়ালপেপার হিসেবে বসান।');
      }
    } catch (err: any) {
      showToast(err?.message || 'ছবি তৈরি করতে সমস্যা হয়েছে।', 'alert');
    }
  };

  const toggleItems: Array<{
    key: keyof EmergencyCardSelection;
    title: string;
    detail: string;
  }> = [
    {
      key: 'bloodGroup',
      title: 'রক্তের গ্রুপ',
      detail: selectedPatient?.bloodGroup || 'প্রোফাইলে উল্লেখ নেই',
    },
    {
      key: 'allergies',
      title: 'অ্যালার্জি',
      detail:
        selectedPatient?.allergies && selectedPatient.allergies.length > 0
          ? selectedPatient.allergies.join(', ')
          : 'কোনো পরিচিত অ্যালার্জি নেই',
    },
    {
      key: 'conditions',
      title: 'দীর্ঘমেয়াদি রোগ',
      detail:
        selectedPatient?.chronicConditions && selectedPatient.chronicConditions.length > 0
          ? selectedPatient.chronicConditions.join(', ')
          : 'উল্লেখ নেই',
    },
    {
      key: 'contact',
      title: 'জরুরি যোগাযোগ (নাম ও নম্বর)',
      detail:
        selectedPatient?.emergencyContact || settings.emergencyContactPhone
          ? [settings.emergencyContactName, selectedPatient?.emergencyContact || settings.emergencyContactPhone]
              .filter(Boolean)
              .join(' · ')
          : 'জরুরি নম্বর যোগ করা নেই',
    },
    {
      key: 'medicines',
      title: 'চলমান ওষুধের তালিকা (ডিফল্ট বন্ধ)',
      detail: selectedPatient
        ? `${toBengaliNumber(
            medicines.filter((m) => m.status === 'active' && m.assignedPatientId === selectedPatient.id).length
          )}টি সক্রিয় ওষুধ`
        : '—',
    },
    {
      key: 'doctorName',
      title: 'ডাক্তারের নাম',
      detail: doctorNameCandidate || 'কোনো ওষুধে ডাক্তারের নাম লেখা নেই',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Navigation Header */}
      <div className="no-print flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentPage('me')}
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-primary cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ফিরে যান</span>
        </button>

        {!currentUser && (
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[40px] px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
          >
            লগইন করুন
          </button>
        )}
      </div>

      {/* Hero Title */}
      <div className="no-print bg-surface border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-text">
              জরুরি কার্ড QR বানান
            </h1>
            <p className="text-sm text-text-muted">
              ফোন লক থাকলেও বা লগইন ছাড়াই স্ক্যান করে জরুরি চিকিৎসা তথ্য ও পরিবারের নম্বর দেখা যাবে।
            </p>
          </div>
        </div>
      </div>

      {/* Login Gate Notice if signed out */}
      {!currentUser && (
        <div className="no-print bg-warning-soft border border-warning/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-text text-base">QR সংরক্ষণের জন্য লগইন প্রয়োজন</h2>
              <p className="text-sm text-text-muted mt-0.5">
                স্ক্যান করলে যাতে অন্যের ফোনে তথ্য খোলে, সেজন্য আপনার অ্যাকাউন্টে লগইন করে QR তৈরি করতে হবে।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm rounded-xl shrink-0 cursor-pointer"
          >
            এখনই লগইন করুন
          </button>
        </div>
      )}

      {/* Profile Selector */}
      <section className="no-print bg-surface border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-extrabold text-text">
            ১. প্রোফাইল বেছে নিন
          </h2>
          <button
            type="button"
            onClick={openCreateProfileModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>নতুন প্রোফাইল</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="p-4 rounded-2xl bg-surface-2 border border-border text-sm text-text-muted">
            কোনো রোগীর প্রোফাইল নেই। প্রথমে একটি প্রোফাইল যোগ করুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {patients.map((p) => {
              const isSelected = selectedPatient?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary-soft/60 ring-2 ring-primary/30'
                      : 'border-border bg-surface-2/60 hover:bg-surface-2'
                  }`}
                >
                  <div className="font-extrabold text-text text-base truncate">{p.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {p.relation} · {toBengaliNumber(p.age)} বছর · {p.bloodGroup || 'রক্তের গ্রুপ নেই'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Privacy Toggles & Explicit Privacy Warning */}
      {selectedPatient && (
        <section className="no-print bg-surface border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-text">
              ২. কোন কোন তথ্য দেখানো হবে (গোপনীয়তা নিয়ন্ত্রণ)
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              ঠিকানা, জাতীয় পরিচয়পত্র বা অন্যান্য ব্যক্তিগত নম্বর কখনোই এই কার্ডে যোগ করা হয় না।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {toggleItems.map((item) => {
              const enabled = selection[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleField(item.key)}
                  className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    enabled
                      ? 'border-primary/50 bg-primary-soft/40'
                      : 'border-border bg-surface-2/40 opacity-85'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm sm:text-base text-text">{item.title}</div>
                    <div className="text-xs text-text-muted mt-0.5 truncate">{item.detail}</div>
                  </div>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 flex items-center ${
                      enabled ? 'bg-primary justify-end' : 'bg-border justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mandatory Explicit Privacy Warning */}
          <div className="p-4 rounded-2xl bg-accent-soft border border-accent/40 space-y-2">
            <div className="flex items-start gap-2.5 text-accent-text font-extrabold text-sm sm:text-base">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>এই QR বা লিংক যার কাছে যাবে সে এই তথ্য দেখতে পাবে।</span>
            </div>
            <p className="text-xs sm:text-sm text-text-muted pl-7">
              অন্তর্ভুক্ত হচ্ছে:{' '}
              <strong className="text-text">{includedLabels.join(', ')}</strong>
            </p>
          </div>

          {actionError && (
            <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/40 text-danger-text text-sm font-semibold">
              {actionError}
            </div>
          )}

          {/* Save / Update / Rotate Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCreateOrUpdateSameLink}
              className="flex-1 min-h-[52px] px-5 py-3 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-on-primary font-extrabold text-base inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : activeCardForSelectedPatient ? (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>তথ্য হালনাগাদ করুন (একই লিংক)</span>
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  <span>QR বানান</span>
                </>
              )}
            </button>

            {activeCardForSelectedPatient && (
              <button
                type="button"
                disabled={busyToken === activeCardForSelectedPatient.token}
                onClick={() =>
                  handleRotateCard(
                    activeCardForSelectedPatient.token,
                    activeCardForSelectedPatient.patientName
                  )
                }
                className="min-h-[52px] px-5 py-3 rounded-2xl bg-surface-2 hover:bg-border/60 border border-border text-text font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {busyToken === activeCardForSelectedPatient.token ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-accent" />
                )}
                <span>নতুন QR বানান (পুরনো বাতিল)</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Active QR Code + Wallet Print + Lock Screen PNG + WhatsApp */}
      {activeCardForSelectedPatient && (
        <section className="space-y-5">
          <div className="no-print bg-surface border-2 border-primary/30 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Crisp QR preview */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs shrink-0">
                <QrSvg url={activeCardUrl} sizePx={188} />
              </div>

              <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-soft text-success-text text-xs font-bold">
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>সক্রিয় জরুরি QR</span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-text">
                    {activeCardForSelectedPatient.patientName}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted break-all mt-1 select-all">
                    {activeCardUrl}
                  </p>
                </div>

                {/* Primary Share & Quick Actions */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-2 hover:bg-border/60 border border-border text-text font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedNow ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedNow ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
                  </button>

                  <a
                    href={buildEmergencyCardWhatsAppUrl(
                      activeCardUrl,
                      activeCardForSelectedPatient.patientName
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#16A34A] hover:opacity-90 text-white font-bold text-sm inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp-এ পাঠান</span>
                  </a>

                  <a
                    href={`/e/${activeCardForSelectedPatient.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-primary-soft text-primary font-bold text-sm inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>স্ক্যান ভিউ দেখুন</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Download / Print Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handlePrintWalletCard}
                className="min-h-[52px] px-4 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>ওয়ালেট কার্ড (PDF/প্রিন্ট)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadLockScreenPng}
                className="min-h-[52px] px-4 py-3 rounded-2xl bg-accent hover:opacity-90 text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>লক স্ক্রিন ছবি (PNG)</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-text-muted text-center">
              লক স্ক্রিনের জন্য: <strong>ছবিটি নামিয়ে ফোনের সেটিংসে ওয়ালপেপার হিসেবে বসান।</strong>
            </p>
          </div>

          {/* Credit-Card Size Wallet Card Preview & Print Target (85.6mm x 53.98mm, White Background) */}
          <div className="wallet-print-wrapper">
            <div className="no-print mb-2 flex items-center justify-between text-xs font-bold text-text-muted px-1">
              <span>ওয়ালেট কার্ড প্রিভিউ (মানিব্যাগের ক্রেডিট কার্ড মাপ: ৮৫.৬ × ৫৪ মি.মি.)</span>
              <span>সাদা কাগজে প্রিন্ট</span>
            </div>

            <div className="wallet-card-sheet bg-white text-slate-900 border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs mx-auto">
              {/* Top red header strip */}
              <div className="bg-[#DC2626] text-white px-3 py-1 flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-wide">
                  জরুরি চিকিৎসা কার্ড · স্বাস্থ্যবন্ধু
                </span>
                {activeCardForSelectedPatient.bloodGroup && (
                  <span className="text-[11px] font-black bg-white text-[#DC2626] px-1.5 py-0.2 rounded">
                    {activeCardForSelectedPatient.bloodGroup}
                  </span>
                )}
              </div>

              {/* Front body: readable info on left + crisp QR on right */}
              <div className="p-2.5 flex items-center justify-between gap-2.5 h-[calc(100%-24px)]">
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <div>
                    <div className="text-[13px] font-extrabold text-slate-900 leading-tight truncate">
                      {activeCardForSelectedPatient.patientName}
                    </div>
                    {typeof activeCardForSelectedPatient.age === 'number' && (
                      <div className="text-[9.5px] font-semibold text-slate-600">
                        বয়স: {toBengaliNumber(activeCardForSelectedPatient.age)} বছর
                      </div>
                    )}
                  </div>

                  {activeCardForSelectedPatient.allergies !== undefined && (
                    <div className="text-[9.5px] leading-tight text-rose-900 font-bold line-clamp-2">
                      <span className="text-rose-700">অ্যালার্জি: </span>
                      {activeCardForSelectedPatient.allergies}
                    </div>
                  )}

                  {activeCardForSelectedPatient.contactPhone && (
                    <div className="pt-0.5">
                      <div className="text-[8.5px] font-bold text-slate-500">জরুরি ফোন</div>
                      <div className="text-[11.5px] font-black text-slate-900 leading-tight">
                        {activeCardForSelectedPatient.contactPhone}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scannable QR right side */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="border border-slate-300 p-0.5 rounded bg-white">
                    <QrSvg url={activeCardUrl} sizePx={86} />
                  </div>
                  <span className="text-[7.5px] font-bold text-slate-600 mt-0.5">
                    বিস্তারিত স্ক্যান করুন
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* "আমার জরুরি QR" Management List */}
      {currentUser && (
        <section className="no-print bg-surface border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-text">আমার জরুরি QR</h2>
              <p className="text-xs text-text-muted">
                মেয়াদ নেই — আপনি না বাতিল করা পর্যন্ত সক্রিয় থাকবে।
              </p>
            </div>
            <button
              type="button"
              onClick={loadOwnerCards}
              disabled={isLoadingCards}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-border/60 border border-border text-xs font-bold text-text inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCards ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          {cardsError && (
            <div className="p-3 rounded-xl bg-danger-soft text-danger-text text-sm font-medium">
              {cardsError}
            </div>
          )}

          {isLoadingCards && cards.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-muted">
              তালিকা লোড হচ্ছে...
            </div>
          ) : cards.length === 0 ? (
            <div className="p-4 rounded-2xl bg-surface-2 text-sm text-text-muted text-center">
              এখনো কোনো জরুরি QR তৈরি করা হয়নি। ওপর থেকে তথ্য নির্বাচন করে “QR বানান” চাপুন।
            </div>
          ) : (
            <div className="space-y-2.5">
              {cards.map((card) => {
                const isBusy = busyToken === card.token;
                return (
                  <div
                    key={card.token}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      card.active
                        ? 'border-border bg-surface-2/60'
                        : 'border-border/60 bg-surface-2/30 opacity-75'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-text text-base">
                          {card.patientName}
                        </span>
                        {card.bloodGroup && (
                          <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent-text text-xs font-extrabold">
                            {card.bloodGroup}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            card.active
                              ? 'bg-success-soft text-success-text'
                              : 'bg-danger-soft text-danger-text'
                          }`}
                        >
                          {card.active ? 'সক্রিয়' : 'বাতিল'}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        তৈরি: {formatEmergencyCardCreatedDate(card)}
                        {card.medicines ? ' · চলমান ওষুধ অন্তর্ভুক্ত' : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {card.active ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRotateCard(card.token, card.patientName)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-2 border border-border text-xs font-bold text-text inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>নতুন বানান</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRevokeCard(card.token)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-danger-soft hover:opacity-90 border border-danger/30 text-xs font-bold text-danger-text inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>বাতিল করুন</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteCard(card.token)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-2 border border-border text-xs font-bold text-text-muted inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছুন</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Lock Screen PNG Preview / Android APK WebView Fallback Modal */}
      {lockScreenPreviewUrl && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="লক স্ক্রিন ছবি প্রিভিউ"
        >
          <div className="bg-surface border border-border rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-extrabold text-text">
                <ImageIcon className="w-5 h-5 text-accent" />
                <span>লক স্ক্রিন ছবি</span>
              </div>
              <button
                type="button"
                onClick={() => setLockScreenPreviewUrl(null)}
                className="w-9 h-9 rounded-full bg-surface-2 hover:bg-border flex items-center justify-center text-text cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-primary-soft border border-primary/20 text-xs sm:text-sm font-bold text-text text-center">
              {isWebViewSaveHint
                ? 'ছবি চেপে ধরে সংরক্ষণ করুন — তারপর ফোনের সেটিংসে ওয়ালপেপার হিসেবে বসান।'
                : 'ছবিটি নামিয়ে ফোনের সেটিংসে ওয়ালপেপার হিসেবে বসান।'}
            </div>

            <div className="rounded-2xl overflow-hidden border border-border bg-slate-900">
              <img
                src={lockScreenPreviewUrl}
                alt="জরুরি লক স্ক্রিন ওয়ালপেপার"
                className="w-full h-auto block select-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href={lockScreenPreviewUrl}
                download="emergency-lockscreen.png"
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-sm inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>আবার নামান</span>
              </a>
              <button
                type="button"
                onClick={() => setLockScreenPreviewUrl(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-2 text-text font-bold text-sm cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
