import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EmergencyCardDoc } from '../../types';
import {
  EmergencyCardDebugInfo,
  EmergencyCardFetchResult,
  fetchEmergencyCardByTokenFromCloud,
} from '../../firebase/services';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { AppLogo } from '../ui/AppLogo';
import {
  AlertOctagon,
  Ambulance,
  Ban,
  Droplets,
  FileX2,
  HeartPulse,
  PhoneCall,
  Pill,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  WifiOff,
  ClockAlert,
} from 'lucide-react';

interface EmergencyCardViewerProps {
  token: string;
}

const ERROR_STATES: Record<
  'not_found' | 'revoked' | 'quota' | 'offline',
  { title: string; body: string; allowRetry: boolean }
> = {
  not_found: {
    title: 'পাওয়া যায়নি',
    body: 'এই জরুরি কার্ডটি পাওয়া যায়নি। QR বা লিংকটি অসম্পূর্ণ হতে পারে অথবা মুছে ফেলা হয়েছে।',
    allowRetry: false,
  },
  revoked: {
    title: 'বাতিল করা হয়েছে',
    body: 'এই জরুরি QR কার্ডটি রোগী বা পরিবারের সদস্য বাতিল করেছেন অথবা এটি আর সক্রিয় নেই।',
    allowRetry: false,
  },
  quota: {
    title: 'সীমা শেষ — পরে চেষ্টা করুন',
    body: 'এই মুহূর্তে সার্ভারে চাপ বেশি থাকায় কার্ডটি খোলা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
    allowRetry: true,
  },
  offline: {
    title: 'সংযোগ নেই',
    body: 'ইন্টারনেট সংযোগ না থাকায় জরুরি কার্ডটি লোড করা যায়নি। সংযোগ চালু করে আবার চেষ্টা করুন।',
    allowRetry: true,
  },
};

export const EmergencyCardViewer: React.FC<EmergencyCardViewerProps> = ({ token }) => {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; card: EmergencyCardDoc; debug: EmergencyCardDebugInfo }
    | { status: 'not_found' | 'revoked' | 'quota' | 'offline'; debug: EmergencyCardDebugInfo }
    | { status: 'error'; message: string; debug: EmergencyCardDebugInfo }
  >({ status: 'loading' });

  const isDebugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    let created = false;
    let target: HTMLMetaElement;
    const prevContent = existing?.getAttribute('content') || '';

    if (existing instanceof HTMLMetaElement) {
      target = existing;
    } else {
      target = document.createElement('meta');
      target.name = 'robots';
      document.head.appendChild(target);
      created = true;
    }
    target.content = 'noindex, nofollow';

    const prevTitle = document.title;
    document.title = 'জরুরি চিকিৎসা কার্ড — স্বাস্থ্যবন্ধু';

    return () => {
      document.title = prevTitle;
      if (created) {
        target.remove();
      } else if (prevContent) {
        target.content = prevContent;
      } else {
        target.removeAttribute('content');
      }
    };
  }, []);

  const loadCard = useCallback(async () => {
    setState({ status: 'loading' });
    const res: EmergencyCardFetchResult = await fetchEmergencyCardByTokenFromCloud(token);
    if (res.status === 'ok') {
      setState({ status: 'ok', card: res.card, debug: res.debug });
    } else if (res.status === 'error') {
      setState({ status: 'error', message: res.message, debug: res.debug });
    } else {
      setState({ status: res.status, debug: res.debug });
    }
  }, [token]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  const renderDebugLine = (debug?: EmergencyCardDebugInfo) => {
    if (!isDebugMode || !debug) return null;
    return (
      <p className="mt-4 text-center text-[11px] text-slate-400 font-mono">
        debug: code={debug.code}
        {debug.docExists !== null ? ` · exists=${String(debug.docExists)}` : ''}
      </p>
    );
  };

  // Fast loading skeleton
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 py-6 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="h-14 rounded-2xl bg-amber-100/80 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="w-24 h-24 rounded-2xl bg-rose-100 animate-pulse shrink-0" />
            </div>
            <div className="h-20 rounded-2xl bg-rose-50 animate-pulse" />
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-16 rounded-2xl bg-indigo-50 animate-pulse" />
          </div>
          <p className="text-center text-sm font-semibold text-slate-500">
            জরুরি তথ্য লোড হচ্ছে...
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full border-2 border-amber-200 rounded-2xl p-7 text-center space-y-4 bg-white shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">তথ্য খোলা যায়নি</h1>
          <p className="text-base text-slate-700 leading-relaxed">{state.message}</p>
          <button
            type="button"
            onClick={loadCard}
            className="min-h-[48px] px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            <span>আবার চেষ্টা করুন</span>
          </button>
        </div>
        {renderDebugLine(state.debug)}
      </div>
    );
  }

  if (state.status !== 'ok') {
    const info = ERROR_STATES[state.status];
    const Icon =
      state.status === 'not_found'
        ? FileX2
        : state.status === 'revoked'
        ? Ban
        : state.status === 'quota'
        ? ClockAlert
        : WifiOff;

    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full border-2 border-slate-200 rounded-2xl p-7 text-center space-y-4 bg-white shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
            <Icon className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{info.title}</h1>
          <p className="text-base text-slate-600 leading-relaxed">{info.body}</p>
          {info.allowRetry && (
            <button
              type="button"
              onClick={loadCard}
              className="min-h-[48px] px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
              <span>আবার চেষ্টা করুন</span>
            </button>
          )}
        </div>
        {renderDebugLine(state.debug)}
      </div>
    );
  }

  const { card } = state;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-5 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Mandatory Top Disclaimer Banners */}
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-1.5 text-amber-950">
          <div className="flex items-center gap-2 font-extrabold text-base sm:text-lg">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
            <span>জরুরি তথ্য, রোগীর দেওয়া</span>
          </div>
          <p className="text-sm sm:text-base font-semibold leading-snug">
            চিকিৎসার সিদ্ধান্তের আগে চিকিৎসকের পরামর্শ নিন।
          </p>
        </div>

        {/* Main Emergency Card */}
        <div className="bg-white border-2 border-rose-200 rounded-3xl shadow-sm overflow-hidden">
          {/* Emergency Red Header */}
          <div className="bg-[#DC2626] text-white px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <HeartPulse className="w-6 h-6 shrink-0" />
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold leading-tight">
                  জরুরি চিকিৎসা কার্ড
                </h1>
                <p className="text-xs sm:text-sm text-rose-100">স্বাস্থ্যবন্ধু জরুরি পরিচিতি</p>
              </div>
            </div>
            <AppLogo size="sm" showText={false} />
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Patient Name, Age & Large Red Blood Group Badge */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wide">
                  রোগীর নাম
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight break-words mt-0.5">
                  {card.patientName}
                </h2>
                {typeof card.age === 'number' && (
                  <p className="text-lg font-bold text-slate-700 mt-1">
                    বয়স: {toBengaliNumber(card.age)} বছর
                  </p>
                )}
              </div>

              {card.bloodGroup && (
                <div className="bg-[#DC2626] text-white px-5 py-3 rounded-2xl text-center shadow-sm shrink-0 min-w-[96px]">
                  <span className="text-xs font-bold text-rose-100 flex items-center justify-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>রক্তের গ্রুপ</span>
                  </span>
                  <span className="text-3xl sm:text-4xl font-black block mt-0.5 leading-none">
                    {card.bloodGroup}
                  </span>
                </div>
              )}
            </div>

            {/* Allergies */}
            {card.allergies !== undefined && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 space-y-1">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm sm:text-base">
                  <AlertOctagon className="w-5 h-5 shrink-0" />
                  <span>অ্যালার্জি</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug break-words">
                  {card.allergies}
                </p>
              </div>
            )}

            {/* Chronic Conditions */}
            {card.conditions !== undefined && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-700 font-extrabold text-sm sm:text-base">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>দীর্ঘমেয়াদি রোগ</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug break-words">
                  {card.conditions}
                </p>
              </div>
            )}

            {/* Emergency Contact with Direct Call Button */}
            {(card.contactPhone || card.contactName) && (
              <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200 space-y-3">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-indigo-800 block">
                    জরুরি যোগাযোগ
                  </span>
                  {card.contactName && (
                    <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {card.contactName}
                    </p>
                  )}
                  {card.contactPhone && (
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide mt-0.5">
                      {card.contactPhone}
                    </p>
                  )}
                </div>

                {card.contactPhone && (
                  <a
                    href={`tel:${card.contactPhone}`}
                    className="min-h-[54px] w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-[#DC2626] hover:bg-red-700 text-white font-extrabold text-lg rounded-2xl shadow-sm transition-colors"
                  >
                    <PhoneCall className="w-6 h-6" />
                    <span>📞 কল করুন</span>
                  </a>
                )}
              </div>
            )}

            {/* Optional Active Medicines (only if patient explicitly enabled) */}
            {card.medicines !== undefined && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm sm:text-base">
                  <Pill className="w-5 h-5 shrink-0" />
                  <span>চলমান ওষুধ</span>
                </div>
                <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed break-words">
                  {card.medicines}
                </p>
              </div>
            )}

            {/* Optional Doctor Name (only if patient explicitly enabled) */}
            {card.doctorName && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-700 font-extrabold text-sm sm:text-base">
                  <Stethoscope className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>চিকিৎসকের নাম</span>
                </div>
                <p className="text-lg font-bold text-slate-900">{card.doctorName}</p>
              </div>
            )}

            {/* Quick National Helplines */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <a
                href="tel:999"
                className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 text-white font-bold text-sm sm:text-base rounded-xl"
              >
                <Ambulance className="w-4 h-4 text-rose-400" />
                <span>জরুরি সেবা ৯৯৯</span>
              </a>
              <a
                href="tel:16263"
                className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-2.5 bg-[#4F46E5] text-white font-bold text-sm sm:text-base rounded-xl"
              >
                <PhoneCall className="w-4 h-4" />
                <span>স্বাস্থ্য বাতায়ন ১৬২৬৩</span>
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          স্বাস্থ্যবন্ধু · জরুরি চিকিৎসা তথ্য (লগইন ছাড়াই পঠনযোগ্য)
        </p>
        {renderDebugLine(state.debug)}
      </div>
    </div>
  );
};
