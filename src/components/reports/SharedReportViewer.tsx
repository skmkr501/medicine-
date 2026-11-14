import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SharedReportDoc } from '../../types';
import {
  fetchSharedReportByTokenFromCloud,
  SharedReportFetchResult,
  SharedReportDebugInfo,
} from '../../firebase/services';
import {
  SHARED_REPORT_VIEWER_DISCLAIMER,
  formatSharedReportDateTime,
  toMillisSafe,
} from '../../utils/sharedReports';
import { toBengaliNumber, formatBengaliDate } from '../../utils/bengaliUtils';
import { AppLogo } from '../ui/AppLogo';
import {
  Printer,
  ShieldAlert,
  Pill,
  AlertOctagon,
  Activity,
  Calendar,
  Clock,
  RefreshCw,
  PhoneCall,
  FileX2,
  Ban,
  Lock,
} from 'lucide-react';

interface SharedReportViewerProps {
  token: string;
}

const FAILURE_MESSAGES: Record<
  'not_found' | 'revoked' | 'expired' | 'denied',
  { title: string; body: string }
> = {
  not_found: {
    title: 'রিপোর্টটি পাওয়া যায়নি',
    body: 'এই লিংকে কোনো রিপোর্ট পাওয়া যায়নি। লিংকটি অসম্পূর্ণ বা ভুল হতে পারে, অথবা মুছে ফেলা হয়েছে। প্রয়োজনে রোগীকে নতুন লিংক দিতে বলুন।',
  },
  revoked: {
    title: 'এই লিংকটি বাতিল করা হয়েছে',
    body: 'রোগী বা পরিবারের সদস্য নিরাপত্তার কারণে লিংকটি বাতিল করেছেন। প্রয়োজনে রোগীকে নতুন লিংক দিতে বলুন।',
  },
  expired: {
    title: 'এই লিংকের মেয়াদ শেষ হয়েছে',
    body: 'নির্ধারিত সময়সীমা পার হয়ে যাওয়ায় রিপোর্টটি আর দেখা যাচ্ছে না। প্রয়োজনে রোগীকে নতুন লিংক দিতে বলুন।',
  },
  denied: {
    title: 'রিপোর্টটি এখন দেখা যাচ্ছে না',
    body: 'লিংকটি বাতিল বা মেয়াদ শেষ হয়ে থাকতে পারে, অথবা প্রবেশের অনুমতি নেই। রোগীকে নতুন লিংক দিতে বলুন।',
  },
};

export const SharedReportViewer: React.FC<SharedReportViewerProps> = ({ token }) => {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; report: SharedReportDoc; debug: SharedReportDebugInfo }
    | {
        status: 'not_found' | 'revoked' | 'expired' | 'denied';
        debug: SharedReportDebugInfo;
      }
    | { status: 'error'; message: string; debug: SharedReportDebugInfo }
  >({ status: 'loading' });

  const isDebugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // Enforce <meta name="robots" content="noindex, nofollow" /> on viewer page
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
    document.title = 'রোগীর স্বাস্থ্য রিপোর্ট — স্বাস্থ্যবন্ধু';

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

  const loadReport = useCallback(async () => {
    setState({ status: 'loading' });
    const res: SharedReportFetchResult = await fetchSharedReportByTokenFromCloud(token);
    if (res.status === 'ok') {
      setState({ status: 'ok', report: res.report, debug: res.debug });
    } else if (res.status === 'error') {
      setState({ status: 'error', message: res.message, debug: res.debug });
    } else {
      setState({ status: res.status, debug: res.debug });
    }
  }, [token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const renderDebugLine = (debug?: SharedReportDebugInfo) => {
    if (!isDebugMode || !debug) return null;
    const docText =
      debug.docExists === true
        ? 'হ্যাঁ (পাওয়া গেছে)'
        : debug.docExists === false
        ? 'না (পাওয়া যায়নি)'
        : 'অজানা (অনুমতি/সংযোগ ত্রুটি)';
    return (
      <p className="mt-4 text-center text-[11px] text-slate-400 font-mono">
        debug: code={debug.code} · ডকুমেন্ট={docText}
      </p>
    );
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-700 animate-spin mx-auto" />
          <p className="text-lg font-bold text-slate-900">রিপোর্ট খোলা হচ্ছে...</p>
          <p className="text-sm text-slate-600">অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full border-2 border-amber-200 rounded-2xl p-8 text-center space-y-4 bg-white shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">রিপোর্ট লোড করা যায়নি</h1>
          <p className="text-base text-slate-700 leading-relaxed">{state.message}</p>
          <button
            type="button"
            onClick={loadReport}
            className="min-h-[48px] px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer"
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
    const info = FAILURE_MESSAGES[state.status];
    const Icon =
      state.status === 'not_found'
        ? FileX2
        : state.status === 'revoked'
        ? Ban
        : state.status === 'expired'
        ? Clock
        : Lock;

    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full border-2 border-slate-200 rounded-2xl p-8 text-center space-y-4 bg-white shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
            <Icon className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{info.title}</h1>
          <p className="text-base text-slate-600 leading-relaxed">{info.body}</p>
        </div>
        {renderDebugLine(state.debug)}
      </div>
    );
  }

  const { report } = state;
  const createdAtMs = report.createdAtMs || toMillisSafe(report.createdAt);
  const expiresAtMs = report.expiresAtMs || toMillisSafe(report.expiresAt);
  const { medicines, allergiesEmergency, recentReadings, appointments } = report.sections;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-6 px-4 sm:px-6 print-root-white">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-8 space-y-6 print-surface-white">
        {/* Mandatory Top Disclaimer Banner */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base font-bold leading-relaxed">
            {SHARED_REPORT_VIEWER_DISCLAIMER}
          </p>
        </div>

        {/* Report Header + Print Button */}
        <div className="border-b-2 border-teal-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="md" showText={false} />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                রোগীর স্বাস্থ্য ও ওষুধ রিপোর্ট
              </h1>
              <p className="text-sm text-slate-600">
                স্বাস্থ্যবন্ধু থেকে শেয়ার করা স্থির স্ন্যাপশট
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Printer className="w-5 h-5" />
            <span>PDF / প্রিন্ট করুন</span>
          </button>
        </div>

        {/* Patient Metadata Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
          <div>
            <span className="text-slate-500 block text-xs">রোগীর নাম</span>
            <strong className="text-base font-bold text-slate-900">{report.patientName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">বয়স ও পরিচয়</span>
            <strong className="text-base font-semibold text-slate-900">
              {typeof report.age === 'number'
                ? `${toBengaliNumber(report.age)} বছর`
                : 'উল্লেখ নেই'}
              {report.gender ? ` · ${report.gender}` : ''}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">তৈরির তারিখ</span>
            <strong className="text-sm font-semibold text-slate-900">
              {createdAtMs ? formatSharedReportDateTime(createdAtMs) : 'অজানা'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">লিংকের মেয়াদ</span>
            <strong className="text-sm font-semibold text-slate-900">
              {expiresAtMs ? formatSharedReportDateTime(expiresAtMs) : 'অজানা'}
            </strong>
          </div>
        </div>

        {/* Section 1: Active Medicines Table */}
        {medicines !== undefined && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-700" />
              <span>চলমান ওষুধসমূহ ({toBengaliNumber(medicines.length)}টি)</span>
            </h2>

            {medicines.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
                এই মুহূর্তে কোনো চলমান ওষুধ তালিকাভুক্ত নেই।
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-left border-collapse text-sm print-table">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                      <th className="p-3">ওষুধ ও জেনেরিক নাম</th>
                      <th className="p-3">সময় ও ডোজ</th>
                      <th className="p-3">খাওয়ার নিয়ম</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {medicines.map((med, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">
                            {med.brandName}
                            {med.strength ? ` (${med.strength})` : ''}
                          </div>
                          {med.genericName && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              {med.genericName}
                              {med.type ? ` · ${med.type}` : ''}
                            </div>
                          )}
                          {med.instructions && (
                            <div className="text-xs text-amber-900 mt-1">
                              নির্দেশনা: {med.instructions}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-800">
                          {med.schedulesText || 'নির্ধারিত নেই'}
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          {med.mealTiming || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Section 2: Allergies & Emergency Info */}
        {allergiesEmergency !== undefined && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-700" />
              <span>অ্যালার্জি ও জরুরি তথ্য</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-4 rounded-xl border border-slate-300 bg-white">
                <span className="text-xs text-slate-500 block font-medium">রক্তের গ্রুপ</span>
                <strong className="text-lg font-bold text-rose-800">
                  {allergiesEmergency.bloodGroup || 'অজানা'}
                </strong>
              </div>

              <div className="p-4 rounded-xl border border-slate-300 bg-white">
                <span className="text-xs text-slate-500 block font-medium">জরুরি যোগাযোগ</span>
                <strong className="text-base font-bold text-slate-900 inline-flex items-center gap-1.5 mt-0.5">
                  <PhoneCall className="w-4 h-4 text-teal-700" />
                  <span>{allergiesEmergency.emergencyContact || 'দেওয়া নেই'}</span>
                </strong>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
                <span className="text-xs text-slate-600 block font-semibold mb-1">
                  পরিচিত অ্যালার্জি
                </span>
                <p className="font-bold text-rose-900">
                  {allergiesEmergency.allergies.length > 0
                    ? allergiesEmergency.allergies.join(', ')
                    : 'কোনো পরিচিত অ্যালার্জি উল্লেখ নেই'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-300 bg-white">
                <span className="text-xs text-slate-600 block font-semibold mb-1">
                  দীর্ঘমেয়াদী রোগ
                </span>
                <p className="font-semibold text-slate-900">
                  {allergiesEmergency.chronicConditions.length > 0
                    ? allergiesEmergency.chronicConditions.join(', ')
                    : 'কোনো উল্লেখ নেই'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Recent Health Readings */}
        {recentReadings !== undefined && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-700" />
              <span>সাম্প্রতিক স্বাস্থ্য রিডিং</span>
            </h2>

            {recentReadings.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
                কোনো সাম্প্রতিক স্বাস্থ্য পরিমাপ সংরক্ষিত নেই।
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-left border-collapse text-sm print-table">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                      <th className="p-3">তারিখ ও সময়</th>
                      <th className="p-3">রক্তচাপ (mmHg)</th>
                      <th className="p-3">ব্লাড সুগার (mmol/L)</th>
                      <th className="p-3">ওজন (কেজি)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentReadings.map((r, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">
                            {formatBengaliDate(r.recordDate)}
                          </div>
                          {r.recordTime && (
                            <div className="text-xs text-slate-600">
                              {toBengaliNumber(r.recordTime)}
                            </div>
                          )}
                          {r.notes && (
                            <div className="text-xs text-slate-600 mt-0.5">{r.notes}</div>
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {r.systolic && r.diastolic
                            ? `${toBengaliNumber(r.systolic)}/${toBengaliNumber(r.diastolic)}`
                            : '—'}
                        </td>
                        <td className="p-3 font-medium">
                          {r.bloodSugar !== undefined
                            ? `${toBengaliNumber(r.bloodSugar)}${r.sugarType ? ` (${r.sugarType})` : ''}`
                            : '—'}
                        </td>
                        <td className="p-3 font-medium">
                          {r.weight !== undefined ? `${toBengaliNumber(r.weight)} কেজি` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Section 4: Doctor Appointments */}
        {appointments !== undefined && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              <span>ডাক্তারের অ্যাপয়েন্টমেন্ট</span>
            </h2>

            {appointments.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
                কোনো আসন্ন অ্যাপয়েন্টমেন্ট উল্লেখ নেই।
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-left border-collapse text-sm print-table">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                      <th className="p-3">ডাক্তার ও বিভাগ</th>
                      <th className="p-3">তারিখ ও সময়</th>
                      <th className="p-3">স্থান / চেম্বার</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {appointments.map((app, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{app.doctorName}</div>
                          {app.specialty && (
                            <div className="text-xs text-slate-600">{app.specialty}</div>
                          )}
                          {app.notes && (
                            <div className="text-xs text-slate-600 mt-0.5">{app.notes}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">
                            {formatBengaliDate(app.appointmentDate)}
                          </div>
                          <div className="text-xs text-slate-600">
                            {toBengaliNumber(app.appointmentTime)}
                          </div>
                        </td>
                        <td className="p-3 text-slate-800">{app.location || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Footer note */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>স্বাস্থ্যবন্ধু — নিরাপদ রিপোর্ট লিংক</span>
          <span>এটি রোগীর শেয়ার করা স্ন্যাপশট, লাইভ তথ্য নয়।</span>
        </div>
      </div>
      <div className="no-print">{renderDebugLine(state.debug)}</div>
    </div>
  );
};
