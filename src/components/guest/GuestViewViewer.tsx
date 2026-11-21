import React, { useCallback, useEffect, useState } from 'react';
import { GuestViewDoc, TimeSlot } from '../../types';
import {
  GUEST_VIEW_BANNER_PREFIX,
  GUEST_VIEW_SLOTS,
  GUEST_VIEW_UNAVAILABLE_MSG,
} from '../../utils/guestViews';
import { formatSharedReportDateTime, toMillisSafe } from '../../utils/sharedReports';
import { fetchGuestViewByTokenFromSupabase } from '../../supabase/sharingService';
import { AppLogo } from '../ui/AppLogo';
import {
  Ban,
  Clock,
  Eye,
  Moon,
  Pill,
  RefreshCw,
  ShieldAlert,
  Sun,
  Sunrise,
  Sunset,
  WifiOff,
} from 'lucide-react';

interface GuestViewViewerProps {
  token: string;
}

const SLOT_META: Record<
  TimeSlot,
  { icon: React.ComponentType<{ className?: string }>; accentBg: string; accentText: string }
> = {
  সকাল: { icon: Sunrise, accentBg: 'bg-amber-50 border-amber-200', accentText: 'text-amber-900' },
  দুপুর: { icon: Sun, accentBg: 'bg-sky-50 border-sky-200', accentText: 'text-sky-900' },
  সন্ধ্যা: { icon: Sunset, accentBg: 'bg-orange-50 border-orange-200', accentText: 'text-orange-900' },
  রাত: { icon: Moon, accentBg: 'bg-indigo-50 border-indigo-200', accentText: 'text-indigo-900' },
};

export const GuestViewViewer: React.FC<GuestViewViewerProps> = ({ token }) => {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; view: GuestViewDoc; fromOfflineCache: boolean }
    | { status: 'unavailable' }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

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
    document.title = 'দৈনিক ওষুধের তালিকা — স্বাস্থ্যবন্ধু';

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

  const loadView = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await fetchGuestViewByTokenFromSupabase(token);
    if (res.status === 'ok') {
      setState({ status: 'ok', view: res.view, fromOfflineCache: res.fromOfflineCache });
    } else if (res.status === 'not_found' || res.status === 'revoked' || res.status === 'expired') {
      setState({ status: 'unavailable' });
    } else {
      setState({ status: 'error', message: res.message });
    }
  }, [token]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-[#4F46E5] animate-spin mx-auto" />
          <p className="text-xl font-bold text-slate-900">ওষুধের তালিকা খোলা হচ্ছে...</p>
          <p className="text-base text-slate-600">অনুগ্রহ করে একটু অপেক্ষা করুন</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border-2 border-amber-200 rounded-3xl p-7 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">তথ্য লোড করা যায়নি</h1>
          <p className="text-base text-slate-700 leading-relaxed">{state.message}</p>
          <button
            type="button"
            onClick={loadView}
            className="min-h-[48px] px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            <span>আবার চেষ্টা করুন</span>
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border-2 border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
            <Ban className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">লিংকটি সক্রিয় নেই</h1>
          <p className="text-lg text-slate-700 font-medium leading-relaxed">
            {GUEST_VIEW_UNAVAILABLE_MSG}
          </p>
        </div>
      </div>
    );
  }

  const { view, fromOfflineCache } = state;
  const updatedMs = view.updatedAtMs || toMillisSafe(view.updatedAt) || toMillisSafe(view.snapshot?.generatedAt);
  const patientDisplayName = view.snapshot?.patientName || view.patientName || 'রোগী';
  const slots = view.snapshot?.slots || { সকাল: [], দুপুর: [], সন্ধ্যা: [], রাত: [] };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Read-only top banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Eye className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-base sm:text-lg font-extrabold leading-snug">
                {GUEST_VIEW_BANNER_PREFIX}{' '}
                {updatedMs ? formatSharedReportDateTime(updatedMs) : 'সদ্য হালনাগাদ'}
              </p>
              {fromOfflineCache && (
                <p className="text-sm font-bold text-amber-800 mt-1 inline-flex items-center gap-1.5">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>অফলাইন কপি থেকে দেখানো হচ্ছে</span>
                </p>
              )}
            </div>
          </div>
          <AppLogo size="sm" showText={false} />
        </div>

        {/* Patient Header */}
        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm font-bold text-slate-500 block">দৈনিক ওষুধের রুটিন</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1 leading-tight">
              {patientDisplayName}
            </h1>
          </div>
          <button
            type="button"
            onClick={loadView}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-5 h-5" />
            <span>রিফ্রেশ</span>
          </button>
        </header>

        {/* 4 Time-of-Day Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GUEST_VIEW_SLOTS.map((slotName) => {
            const meta = SLOT_META[slotName];
            const SlotIcon = meta.icon;
            const items = Array.isArray(slots[slotName]) ? slots[slotName] : [];

            return (
              <section
                key={slotName}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs flex flex-col"
              >
                <div className={`px-5 py-4 border-b flex items-center gap-3 ${meta.accentBg}`}>
                  <SlotIcon className={`w-7 h-7 shrink-0 ${meta.accentText}`} />
                  <h2 className={`text-2xl font-extrabold ${meta.accentText}`}>
                    {slotName}
                  </h2>
                </div>

                <div className="p-5 flex-1">
                  {items.length === 0 ? (
                    <p className="text-lg text-slate-500 font-medium py-4 text-center">
                      এই বেলায় কোনো ওষুধ নেই
                    </p>
                  ) : (
                    <ul className="space-y-3.5">
                      {items.map((med, idx) => (
                        <li
                          key={`${slotName}-${med.brandName}-${idx}`}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <Pill className="w-6 h-6 text-[#4F46E5] shrink-0 mt-1" />
                            <div className="min-w-0">
                              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug break-words">
                                {med.brandName}
                                {med.strength ? ` ${med.strength}` : ''}
                              </h3>
                            </div>
                          </div>
                          <div className="pl-8 text-base sm:text-lg font-bold text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>ডোজ: {med.dosage}</span>
                            <span aria-hidden="true">·</span>
                            <span>{med.mealTiming}</span>
                            {med.time && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-[#4F46E5]">
                                  <Clock className="w-4 h-4" />
                                  <span>{med.time}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <p className="text-center text-sm text-slate-500 pb-4">
          স্বাস্থ্যবন্ধু · শুধু দেখার পাতা (লগইন বা পরিবর্তনের প্রয়োজন নেই)
        </p>
      </div>
    </div>
  );
};
