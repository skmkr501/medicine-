import React, { useState } from 'react';
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
} from 'lucide-react';

export const CaregiverSettingsSection: React.FC = () => {
  const {
    currentUser,
    openAuthModal,
    settings,
    updateSettings,
    patients,
    activePatient,
    patientCaregiverLinks,
    caringForLinks,
    isCaregiverLoading,
    refreshCaregiverLinks,
    createCaregiverInvite,
    redeemCaregiverInvite,
    removeCaregiverLink,
    toggleCaregiverFullView,
    showToast,
  } = useMedicine();

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [selfPhoneDraft, setSelfPhoneDraft] = useState(settings.patientSelfPhone || '');

  const activeCaregivers = patientCaregiverLinks.filter((l) => l.status === 'active');
  const pendingInvites = patientCaregiverLinks.filter((l) => l.status === 'pending');
  const thresholdMinutes = settings.caregiverMissedDoseMinutes || 30;
  const patientDisplayName = (
    activePatient?.name ||
    patients[0]?.name ||
    currentUser?.displayName ||
    'পরিবারের সদস্য'
  ).trim();

  const handleCreateInvite = async () => {
    setIsGenerating(true);
    try {
      await createCaregiverInvite();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setIsRedeeming(true);
    try {
      const ok = await redeemCaregiverInvite(inviteCodeInput);
      if (ok) {
        setInviteCodeInput('');
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast('আমন্ত্রণ কোড কপি হয়েছে', 'success');
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              পরিবারের যত্নকারী (সতর্কতা মোড)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              ওষুধ খেতে দেরি হলে বা ওষুধ শেষ হয়ে এলে পরিবারের সদস্য সতর্কতা পাবেন
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            type="button"
            onClick={refreshCaregiverLinks}
            disabled={isCaregiverLoading}
            className="min-h-[48px] px-3.5 py-2 text-sm font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCaregiverLoading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        )}
      </div>

      {/* Clear Privacy Explanation */}
      <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-teal-900 dark:text-teal-200">
          <ShieldCheck className="w-5 h-5 shrink-0 text-teal-700 dark:text-teal-400" />
          <span>কে কী দেখতে পাবেন (গোপনীয়তা সুরক্ষা)</span>
        </div>
        <ul className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
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
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-900 dark:text-white">
              যত্নকারী যুক্ত করতে লগইন প্রয়োজন
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              একটি নিরাপদ কোডের মাধ্যমে পরিবারের ফোনে সতর্কতা পাঠাতে অনুগ্রহ করে লগইন করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>লগইন করুন</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alert Delay Settings & Patient Phone */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>কতক্ষণ পর সতর্কতা যাবে?</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
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
                          ? 'bg-teal-700 border-teal-700 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/40'
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
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                <Phone className="w-4 h-4 text-teal-600" />
                <span>আপনার ফোন নম্বর (ঐচ্ছিক)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                যেন সতর্কতা পেলে যত্নকারী এক চাপেই আপনাকে কল বা হোয়াটসঅ্যাপ করতে পারেন
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={selfPhoneDraft}
                  onChange={(e) => setSelfPhoneDraft(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX"
                  className="min-h-[48px] flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-base text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-600"
                />
                <button
                  type="submit"
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm cursor-pointer shrink-0"
                >
                  সংরক্ষণ
                </button>
              </div>
            </form>
          </div>

          {/* Role 1: Patient creates Invite Code & manages linked caregivers */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-teal-600" />
                  <span>আমার যত্নকারী যুক্ত করুন</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  যুক্ত আছেন: {toBengaliNumber(activeCaregivers.length)}/{toBengaliNumber(MAX_CAREGIVERS)} জন
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateInvite}
                disabled={isGenerating || activeCaregivers.length >= MAX_CAREGIVERS}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isGenerating ? 'তৈরি হচ্ছে...' : 'আমন্ত্রণ কোড বানান'}
                </span>
              </button>
            </div>

            {/* Pending Invite Codes */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  সক্রিয় আমন্ত্রণ কোড (একবার ব্যবহারযোগ্য, ৪৮ ঘণ্টা মেয়াদ)
                </p>
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-mono font-extrabold tracking-widest text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-700">
                          {invite.inviteCode}
                        </span>
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {formatRemainingHours(invite.expiresAtMs)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(invite.inviteCode)}
                        className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedCode === invite.inviteCode ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
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
                        className="min-h-[48px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center gap-1.5"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>হোয়াটসঅ্যাপে পাঠান</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => removeCaregiverLink(invite.id)}
                        aria-label="কোড বাতিল করুন"
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer"
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
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                এখনো কোনো যত্নকারী যুক্ত হননি। কোড তৈরি করে সন্তান বা পরিবারের সদস্যকে পাঠাতে পারেন।
              </p>
            ) : (
              <div className="space-y-3">
                {activeCaregivers.map((link) => {
                  const isConfirming = confirmRemoveId === link.id;
                  return (
                    <div
                      key={link.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {link.caregiverName || 'পরিবারের যত্নকারী'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {link.allowFullView
                            ? 'অনুমতি: আজকের ডোজ, সতর্কতা ও সব ওষুধ/মজুদ'
                            : 'অনুমতি: শুধু আজকের ডোজ ও সতর্কতা'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCaregiverFullView(link.id, !link.allowFullView)}
                          className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-1.5 cursor-pointer ${
                            link.allowFullView
                              ? 'bg-teal-700 border-teal-700 text-white'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
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
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-rose-700 text-white font-bold text-xs cursor-pointer"
                            >
                              নিশ্চিত সরান
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs cursor-pointer"
                            >
                              না
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(link.id)}
                            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
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
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>কোড দিয়ে যুক্ত হোন (যত্নকারী হিসেবে)</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                মা-বাবা বা পরিবারের কারও কাছ থেকে পাওয়া ৬ অক্ষরের আমন্ত্রণ কোডটি এখানে লিখুন
              </p>
            </div>

            <form onSubmit={handleRedeemCode} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                maxLength={8}
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(normalizeInviteCodeInput(e.target.value))}
                placeholder="৬ অক্ষরের কোড (যেমন: A7K9M2)"
                className="min-h-[48px] flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-lg font-bold tracking-widest uppercase text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-600"
              />
              <button
                type="submit"
                disabled={isRedeeming || inviteCodeInput.trim().length < 6}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base cursor-pointer shrink-0"
              >
                {isRedeeming ? 'যুক্ত হচ্ছে...' : 'যুক্ত হোন'}
              </button>
            </form>

            {caringForLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  আপনি যাদের দেখাশোনা করছেন:
                </p>
                {caringForLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {link.patientName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCaregiverLink(link.id)}
                      className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 cursor-pointer"
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
