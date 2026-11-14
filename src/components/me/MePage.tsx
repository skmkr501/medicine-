import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { EmergencyCard } from '../emergency/EmergencyCard';
import {
  User,
  Users,
  Settings as SettingsIcon,
  HeartPulse,
  Calendar,
  History,
  BookOpen,
  PhoneCall,
  UserPlus,
  Edit2,
  Cloud,
  LogOut,
  Lock,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  HeartHandshake,
  Share2,
} from 'lucide-react';

export const MePage: React.FC = () => {
  const {
    patients,
    activePatient,
    setActivePatientId,
    openCreateProfileModal,
    openEditProfileModal,
    setCurrentPage,
    currentUser,
    openAuthModal,
    signOutUser,
    settings,
    isAdmin,
  } = useMedicine();

  const emergencyPhone = settings.emergencyContactPhone || activePatient?.emergencyContact || '';

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            আমি ও পরিবার
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
            প্রোফাইল, জরুরি তথ্য এবং অ্যাপের সেটিংস
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className="min-h-[48px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-2xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-5 h-5" />
          <span>সেটিংস</span>
        </button>
      </div>

      {/* Profiles Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              পরিবারের সদস্য প্রোফাইল
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateProfileModal}
            className="min-h-[48px] px-4 py-2 text-sm font-bold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>নতুন সদস্য যোগ</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center space-y-3">
            <User className="w-10 h-10 text-teal-700 dark:text-teal-400 mx-auto" />
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              এখনো কোনো প্রোফাইল তৈরি করা হয়নি
            </p>
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="min-h-[48px] px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl cursor-pointer inline-flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              <span>প্রোফাইল তৈরি করুন</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patients.map((p) => {
              const isSelected = activePatient?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setActivePatientId(p.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      {p.relation} · {toBengaliNumber(p.age)} বছর · রক্ত: {p.bloodGroup}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditProfileModal(p);
                    }}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                    title="প্রোফাইল সম্পাদনা"
                    aria-label={`${p.name} সম্পাদনা`}
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Emergency Quick Calls & Card */}
      <section className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              জরুরি সাহায্য ও কল
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="text-sm font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            নম্বর বদলান
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="tel:16263"
            className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-2xl transition-colors"
          >
            <PhoneCall className="w-5 h-5" />
            <span>স্বাস্থ্য বাতায়ন (১৬২৬৩)</span>
          </a>

          <a
            href="tel:999"
            className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-rose-700 hover:bg-rose-800 text-white font-bold text-base rounded-2xl transition-colors"
          >
            <PhoneCall className="w-5 h-5" />
            <span>জরুরি সেবা (৯৯৯)</span>
          </a>

          {emergencyPhone ? (
            <a
              href={`tel:${emergencyPhone}`}
              className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-base rounded-2xl transition-colors"
            >
              <PhoneCall className="w-5 h-5" />
              <span>পরিবার: {emergencyPhone}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentPage('settings')}
              className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-base rounded-2xl cursor-pointer"
            >
              <span>পরিবারের নম্বর যোগ করুন</span>
            </button>
          )}
        </div>

        {activePatient && <EmergencyCard />}
      </section>

      {/* Main Shortcuts Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            id: 'settings' as const,
            title: 'সেটিংস ও অ্যালার্ম',
            subtitle: 'সহজ মোড, অ্যালার্ম টোন, কথা বলা, ব্যাকআপ',
            icon: SettingsIcon,
            iconColor: 'text-teal-700 dark:text-teal-400',
            anchor: '',
          },
          {
            id: 'settings' as const,
            title: 'পরিবারের যত্নকারী',
            subtitle: 'আমন্ত্রণ কোড, সতর্কতা ও সংযোগ পরিচালনা',
            icon: HeartHandshake,
            iconColor: 'text-emerald-700 dark:text-emerald-400',
            anchor: 'caregiver-section',
          },
          {
            id: 'health-records' as const,
            title: 'স্বাস্থ্য রেকর্ড',
            subtitle: 'রক্তচাপ, ডায়াবেটিস ও ওজনের হিসাব',
            icon: HeartPulse,
            iconColor: 'text-rose-600',
            anchor: '',
          },
          {
            id: 'appointments' as const,
            title: 'ডাক্তারের অ্যাপয়েন্টমেন্ট',
            subtitle: 'ডাক্তারের সাক্ষাতের তারিখ ও সময়',
            icon: Calendar,
            iconColor: 'text-teal-700 dark:text-teal-400',
            anchor: '',
          },
          {
            id: 'share-report' as const,
            title: 'ডাক্তারের জন্য রিপোর্ট',
            subtitle: 'ডাক্তার বা পরিবারকে নিরাপদ, মেয়াদি শেয়ার লিংক ও PDF',
            icon: Share2,
            iconColor: 'text-teal-700 dark:text-teal-400',
            anchor: '',
          },
          {
            id: 'history' as const,
            title: 'ওষুধ খাওয়ার ইতিহাস',
            subtitle: 'আগের দিনগুলোর ডোজ ও ডাক্তারকে দেখানোর রিপোর্ট',
            icon: History,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            anchor: '',
          },
          {
            id: 'library' as const,
            title: 'ওষুধ লাইব্রেরি',
            subtitle: 'অনুমোদিত ওষুধের তালিকা খুঁজুন',
            icon: BookOpen,
            iconColor: 'text-emerald-700 dark:text-emerald-400',
            anchor: '',
          },
          ...(isAdmin
            ? [
                {
                  id: 'admin-dashboard' as const,
                  title: 'অ্যাডমিন প্যানেল',
                  subtitle: 'লাইব্রেরি ও ইমপোর্ট ব্যবস্থাপনা',
                  icon: ShieldCheck,
                  iconColor: 'text-teal-700 dark:text-teal-400',
                  anchor: '',
                },
              ]
            : []),
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={`${item.id}-${item.title}`}
              type="button"
              onClick={() => {
                setCurrentPage(item.id);
                if (item.anchor) {
                  setTimeout(() => {
                    document
                      .getElementById(item.anchor)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }
              }}
              className="min-h-[72px] p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </section>

      {/* Account Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {currentUser ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center font-bold text-lg shrink-0">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.displayName || 'ব্যবহারকারী'}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={signOutUser}
              className="min-h-[48px] px-5 py-2.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-base font-bold flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>লগআউট</span>
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                আপনার তথ্য নিরাপদ রাখুন
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                লগইন করলে ফোন বদলালেও সব ওষুধ ও প্রোফাইল ফিরে পাবেন
              </p>
            </div>

            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-base font-bold flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-5 h-5" />
              <span>লগইন করুন</span>
            </button>
          </>
        )}
      </section>
    </div>
  );
};
