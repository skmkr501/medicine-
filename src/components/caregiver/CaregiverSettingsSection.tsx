import React, { useEffect, useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  MAX_CAREGIVERS,
  buildCaregiverInviteWhatsAppUrl,
  normalizeInviteCodeInput,
} from '../../utils/caregiverAlerts';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Share2,
  Copy,
  Check,
  Trash2,
  Clock,
  Phone,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  HeartHandshake,
  RefreshCw,
  FilePlus2,
  AlertTriangle,
  Home,
} from 'lucide-react';

export const CaregiverSettingsSection: React.FC = () => {
  const {
    currentUser,
    openAuthModal,
    setCurrentPage,
    settings,
    updateSettings,
    patients,
    activePatient,
    patientCaregiverLinks,
    caringForLinks,
    isCaregiverLoading,
    caregiverError,
    clearCaregiverError,
    refreshCaregiverLinks,
    createCaregiverInvite,
    redeemCaregiverInvite,
    removeCaregiverLink,
    toggleCaregiverFullView,
    toggleCaregiverSuggestions,
    showToast,
  } = useMedicine();

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);
  const [errorOrigin, setErrorOrigin] = useState<'invite' | 'redeem' | 'general'>('redeem');
  const [selfPhoneDraft, setSelfPhoneDraft] = useState(settings.patientSelfPhone || '');

  useEffect(() => {
    setSelfPhoneDraft(settings.patientSelfPhone || '');
  }, [settings.patientSelfPhone]);

  useEffect(() => {
    if (currentUser?.uid) {
      setErrorOrigin('general');
      refreshCaregiverLinks();
    }
  }, [currentUser?.uid]);

  const activeCaregivers = patientCaregiverLinks.filter((l) => l.status === 'active');
  const pendingInvites = patientCaregiverLinks.filter((l) => l.status === 'pending');
  const thresholdMinutes = settings.caregiverMissedDoseMinutes || 30;
  const patientDisplayName = (
    activePatient?.name?.trim() ||
    patients[0]?.name?.trim() ||
    currentUser?.displayName?.trim() ||
    'পরিবারের সদস্য'
  );

  const handleCreateInvite = async () => {
    clearCaregiverError();
    setErrorOrigin('invite');
    setIsGenerating(true);
    try {
      await createCaregiverInvite();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeInviteCodeInput(inviteCodeInput);
    if (!cleaned) return;
    clearCaregiverError();
    setErrorOrigin('redeem');
    setRedeemSuccessMsg(null);
    setIsRedeeming(true);
    try {
      const ok = await redeemCaregiverInvite(cleaned);
      if (ok) {
        setInviteCodeInput('');
        setRedeemSuccessMsg('যত্নকারী হিসেবে সফলভাবে যুক্ত হয়েছেন! হোমে "পরিবার" কার্ডে খোঁজখবর দেখতে পাবেন।');
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(code);
        setCopiedCode(code);
        showToast('আমন্ত্রণ কোড কপি হয়েছে', 'success');
        setTimeout(() => setCopiedCode(null), 2500);
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      try {
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (ok) {
          setCopiedCode(code);
          showToast('আমন্ত্রণ কোড কপি হয়েছে', 'success');
          setTimeout(() => setCopiedCode(null), 2500);
          return;
        }
      } catch {
        // ignore fallback failure
      }
      showToast(`কোড: ${code}`, 'info');
    }
  };

  const handleSaveSelfPhone = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ patientSelfPhone: selfPhoneDraft.trim() });
    showToast('আপনার ফোন নম্বর সংরক্ষিত হয়েছে', 'success');
  };

  const formatRemainingHours = (expiresAtMs: number): string => {
    const diffHours = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / (1000 * 60 * 60)));
    return `${toBengaliNumber(diffHours)} ঘণ্টা বাকি`;
  };

  return (
    <section
      id="caregiver-section"
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">
              পরিবারের যত্নকারী (সতর্কতা মোড)
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              ওষুধ খেতে দেরি হলে বা ওষুধ শেষ হয়ে এলে পরিবারের সদস্য সতর্কতা পাবেন
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            type="button"
            onClick={() => {
              setErrorOrigin('general');
              refreshCaregiverLinks();
            }}
            disabled={isCaregiverLoading}
            className="min-h-[48px] px-3.5 py-2 text-sm font-semibold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCaregiverLoading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        )}
      </div>

      {/* Clear Privacy Explanation */}
      <div className="p-4 rounded-xl bg-primary-soft border border-primary/25 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-primary">
          <ShieldCheck className="w-5 h-5 shrink-0 text-primary" />
          <span>কে কী দেখতে পাবেন (গোপনীয়তা সুরক্ষা)</span>
        </div>
        <ul className="text-xs sm:text-sm text-text space-y-1.5 list-disc list-inside leading-relaxed">
          <li>
            <strong>আপনার অনুমতি ছাড়া কেউ কোনো তথ্য দেখবে না।</strong> সর্বোচ্চ{' '}
            {toBengaliNumber(MAX_CAREGIVERS)} জন যত্নকারী যুক্ত করা যায়।
          </li>
          <li>
            সাধারণভাবে যত্নকারী শুধু <strong>আজকের ডোজ খাওয়া হয়েছে কি না</strong> এবং দেরি বা কম মজুদের{' '}
            <strong>সতর্কতা</strong> দেখবেন।
          </li>
          <li>
            আগের দিনের সম্পূর্ণ ওষুধ খাওয়ার ইতিহাস বা আপনার{' '}
            <strong>রক্তচাপ/ডায়াবেটিস/ওজনের স্বাস্থ্য রেকর্ড কখনোই যত্নকারী দেখবেন না।</strong>
          </li>
          <li>
            আপনি চাইলে আলাদাভাবে <strong>"সব দেখার অনুমতি"</strong> চালু করলে তবেই যত্নকারী সক্রিয় ওষুধ ও মজুদ দেখতে পারবেন এবং যেকোনো সময় সংযোগ সরিয়ে দিতে পারবেন।
          </li>
        </ul>
      </div>

      {!currentUser ? (
        <div className="p-5 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-base font-bold text-text">
              যত্নকারী যুক্ত করতে লগইন প্রয়োজন
            </p>
            <p className="text-sm text-text-muted">
              একটি নিরাপদ কোডের মাধ্যমে পরিবারের ফোনে সতর্কতা পাঠাতে অনুগ্রহ করে লগইন করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>লগইন করুন</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {caregiverError && errorOrigin === 'general' && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{caregiverError}</span>
            </div>
          )}

          {/* Alert Delay Settings & Patient Phone */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-text">
                <Clock className="w-4 h-4 text-primary" />
                <span>কতক্ষণ পর সতর্কতা যাবে?</span>
              </div>
              <p className="text-xs text-text-muted">
                নির্ধারিত সময়ের পর ওষুধ খাওয়া চিহ্নিত না করলে যত্নকারীর কাছে বার্তা যাবে:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([15, 30, 60] as const).map((min) => {
                  const active = thresholdMinutes === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => {
                        updateSettings({ caregiverMissedDoseMinutes: min });
                        showToast(
                          `নির্ধারিত সময়ের ${toBengaliNumber(min)} মিনিট পর সতর্কতা যাবে`,
                          'success'
                        );
                      }}
                      className={`min-h-[48px] px-3 py-2 rounded-xl font-bold text-sm border transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary border-primary text-on-primary shadow-xs'
                          : 'bg-surface border-border text-text hover:bg-primary-soft hover:border-primary/40'
                      }`}
                    >
                      {toBengaliNumber(min)} মিনিট
                    </button>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleSaveSelfPhone}
              className="p-4 rounded-xl bg-surface-2 border border-border space-y-3"
            >
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-text">
                <Phone className="w-4 h-4 text-primary" />
                <span>আপনার ফোন নম্বর (ঐচ্ছিক)</span>
              </div>
              <p className="text-xs text-text-muted">
                যেন সতর্কতা পেলে যত্নকারী এক চাপেই আপনাকে কল বা হোয়াটসঅ্যাপ করতে পারেন
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={selfPhoneDraft}
                  onChange={(e) => setSelfPhoneDraft(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX"
                  className="min-h-[48px] flex-1 px-3.5 py-2 rounded-xl bg-surface border border-border text-base text-text focus:outline-hidden focus:border-primary"
                />
                <button
                  type="submit"
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm cursor-pointer shrink-0"
                >
                  সংরক্ষণ
                </button>
              </div>
            </form>
          </div>

          {/* Role 1: Patient creates Invite Code & manages linked caregivers */}
          <div className="p-4 sm:p-5 rounded-xl border border-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-text flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span>আমার যত্নকারী যুক্ত করুন</span>
                </h3>
                <p className="text-xs sm:text-sm text-text-muted">
                  যুক্ত আছেন: {toBengaliNumber(activeCaregivers.length)}/{toBengaliNumber(MAX_CAREGIVERS)} জন
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateInvite}
                disabled={isGenerating || activeCaregivers.length >= MAX_CAREGIVERS}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isGenerating ? 'তৈরি হচ্ছে...' : 'আমন্ত্রণ কোড বানান'}
                </span>
              </button>
            </div>

            {caregiverError && errorOrigin === 'invite' && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{caregiverError}</span>
              </div>
            )}

            {/* Pending Invite Codes */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-warning-text">
                  সক্রিয় আমন্ত্রণ কোড (একবার ব্যবহারযোগ্য, ৪৮ ঘণ্টা মেয়াদ)
                </p>
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 rounded-xl bg-warning-soft border border-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-mono font-extrabold tracking-widest text-text bg-surface px-3 py-1 rounded-lg border border-warning/40">
                          {invite.inviteCode}
                        </span>
                        <span className="text-xs font-semibold text-warning-text">
                          {formatRemainingHours(invite.expiresAtMs)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(invite.inviteCode)}
                        className="min-h-[48px] px-3.5 py-2 rounded-xl bg-surface border border-border text-text font-bold text-sm flex items-center gap-1.5 cursor-pointer hover:bg-surface-2"
                      >
                        {copiedCode === invite.inviteCode ? (
                          <>
                            <Check className="w-4 h-4 text-success-text" />
                            <span>কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>কপি</span>
                          </>
                        )}
                      </button>

                      <a
                        href={buildCaregiverInviteWhatsAppUrl(invite.inviteCode, patientDisplayName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[48px] px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm flex items-center gap-1.5"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>হোয়াটসঅ্যাপে পাঠান</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => removeCaregiverLink(invite.id)}
                        aria-label="কোড বাতিল করুন"
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-danger-soft text-danger-text border border-danger/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Caregivers List */}
            {activeCaregivers.length === 0 ? (
              <p className="text-sm text-text-muted py-2">
                এখনো কোনো যত্নকারী যুক্ত হননি। কোড তৈরি করে সন্তান বা পরিবারের সদস্যকে পাঠাতে পারেন।
              </p>
            ) : (
              <div className="space-y-3">
                {activeCaregivers.map((link) => {
                  const isConfirming = confirmRemoveId === link.id;
                  return (
                    <div
                      key={link.id}
                      className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-bold text-text truncate">
                          {link.caregiverName || 'পরিবারের যত্নকারী'}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {link.allowFullView
                            ? 'অনুমতি: আজকের ডোজ, সতর্কতা ও সব ওষুধ/মজুদ'
                            : 'অনুমতি: শুধু আজকের ডোজ ও সতর্কতা'}
                          {link.allowSuggestions
                            ? ' · ওষুধের প্রস্তাব পাঠাতে পারবেন'
                            : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            toggleCaregiverSuggestions(link.id, !link.allowSuggestions)
                          }
                          className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-1.5 cursor-pointer ${
                            link.allowSuggestions
                              ? 'bg-primary border-primary text-on-primary'
                              : 'bg-surface border-border text-text hover:bg-primary-soft'
                          }`}
                        >
                          <FilePlus2 className="w-4 h-4 shrink-0" />
                          <span>
                            এই যত্নকারী ওষুধের প্রস্তাব পাঠাতে পারবেন:{' '}
                            {link.allowSuggestions ? 'চালু' : 'বন্ধ'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCaregiverFullView(link.id, !link.allowFullView)}
                          className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-1.5 cursor-pointer ${
                            link.allowFullView
                              ? 'bg-primary border-primary text-on-primary'
                              : 'bg-surface border-border text-text hover:bg-primary-soft'
                          }`}
                        >
                          {link.allowFullView ? (
                            <>
                              <Eye className="w-4 h-4" />
                              <span>সব দেখার অনুমতি: চালু</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4" />
                              <span>সব দেখার অনুমতি: বন্ধ</span>
                            </>
                          )}
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                removeCaregiverLink(link.id);
                                setConfirmRemoveId(null);
                              }}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs cursor-pointer"
                            >
                              নিশ্চিত সরান
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-surface border border-border text-text font-bold text-xs cursor-pointer"
                            >
                              না
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(link.id)}
                            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-danger-soft border border-danger/30 text-danger-text font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>সরিয়ে দিন</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Role 2: Caregiver enters invite code */}
          <div className="p-4 sm:p-5 rounded-xl border border-border space-y-4">
            <div>
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>কোড দিয়ে যুক্ত হোন (যত্নকারী হিসেবে)</span>
              </h3>
              <p className="text-xs sm:text-sm text-text-muted">
                মা-বাবা বা পরিবারের কারও কাছ থেকে পাওয়া ৮ অক্ষরের আমন্ত্রণ কোডটি এখানে লিখুন
              </p>
            </div>

            {caregiverError && errorOrigin === 'redeem' && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{caregiverError}</span>
              </div>
            )}

            <form onSubmit={handleRedeemCode} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={8}
                value={inviteCodeInput}
                onChange={(e) => {
                  clearCaregiverError();
                  setRedeemSuccessMsg(null);
                  setInviteCodeInput(normalizeInviteCodeInput(e.target.value));
                }}
                placeholder="৮ অক্ষরের কোড (যেমন: A7K9M2PQ)"
                className="min-h-[48px] flex-1 px-4 py-2 rounded-xl bg-surface-2 border border-border font-mono text-lg font-bold tracking-widest uppercase text-text focus:outline-hidden focus:border-primary"
              />
              <button
                type="submit"
                disabled={isRedeeming || normalizeInviteCodeInput(inviteCodeInput).length < 8}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-base cursor-pointer shrink-0"
              >
                {isRedeeming ? 'যুক্ত হচ্ছে...' : 'যুক্ত হোন'}
              </button>
            </form>

            {redeemSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-success-soft border border-success/35 flex flex-wrap items-center justify-between gap-2.5">
                <p className="text-sm font-bold text-success-text">{redeemSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => setCurrentPage('dashboard')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>হোমে দেখুন</span>
                </button>
              </div>
            )}

            {caringForLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-text-muted">
                    আপনি যাদের দেখাশোনা করছেন:
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('dashboard')}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>হোমে গিয়ে দেখুন</span>
                  </button>
                </div>
                {caringForLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 rounded-xl bg-success-soft border border-success/30 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-bold text-text">
                      {link.patientName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCaregiverLink(link.id)}
                      className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold text-danger-text bg-surface border border-danger/30 cursor-pointer"
                    >
                      সংযোগ বিচ্ছিন্ন করুন
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
