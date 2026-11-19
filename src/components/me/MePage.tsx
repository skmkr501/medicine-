import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import { EmergencyCard } from '../emergency/EmergencyCard';
import { FeedbackCard } from '../settings/FeedbackCard';
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
  QrCode,
  Stethoscope,
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
          <h1 className="text-2xl sm:text-3xl font-bold text-text">
            আমি ও পরিবার
          </h1>
          <p className="text-base text-text-muted mt-1">
            প্রোফাইল, জরুরি তথ্য এবং অ্যাপের সেটিংস
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-5 h-5" />
          <span>সেটিংস</span>
        </button>
      </div>

      {/* Profiles Section */}
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-bold text-text">
              পরিবারের সদস্য প্রোফাইল
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateProfileModal}
            className="min-h-[48px] px-4 py-2 text-sm font-bold text-primary bg-primary-soft border border-primary/25 rounded-xl hover:opacity-90 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>নতুন সদস্য যোগ</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="p-6 bg-surface-2 rounded-2xl text-center space-y-3">
            <User className="w-10 h-10 text-primary mx-auto" />
            <p className="text-base font-semibold text-text">
              এখনো কোনো প্রোফাইল তৈরি করা হয়নি
            </p>
            <button
              type="button"
              onClick={openCreateProfileModal}
              className="min-h-[48px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl cursor-pointer inline-flex items-center gap-2"
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
                      ? 'border-primary bg-primary-soft/60'
                      : 'border-border bg-surface-2/60 hover:border-primary/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-text truncate">
                        {p.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-text-muted mt-0.5">
                      {p.relation} · {toBengaliNumber(p.age)} বছর · রক্ত: {p.bloodGroup}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditProfileModal(p);
                    }}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-text-muted hover:bg-surface border border-border cursor-pointer shrink-0"
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
      <section className="bg-surface border border-accent/35 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-accent" />
            <h2 className="text-lg font-bold text-text">
              জরুরি সাহায্য ও কল
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('settings')}
            className="text-sm font-semibold text-primary hover:underline cursor-pointer"
          >
            নম্বর বদলান
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="tel:16263"
            className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-2xl transition-colors"
          >
            <PhoneCall className="w-5 h-5" />
            <span>স্বাস্থ্য বাতায়ন (১৬২৬৩)</span>
          </a>

          <a
            href="tel:999"
            className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:opacity-90 text-white font-bold text-base rounded-2xl transition-opacity"
          >
            <PhoneCall className="w-5 h-5" />
            <span>জরুরি সেবা (৯৯৯)</span>
          </a>

          {emergencyPhone ? (
            <a
              href={`tel:${emergencyPhone}`}
              className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-text hover:opacity-90 text-bg font-bold text-base rounded-2xl transition-opacity"
            >
              <PhoneCall className="w-5 h-5" />
              <span>পরিবার: {emergencyPhone}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentPage('settings')}
              className="min-h-[56px] flex items-center justify-center gap-2 px-4 py-3 bg-surface-2 hover:bg-border/60 text-text font-bold text-base rounded-2xl cursor-pointer border border-border"
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
            iconColor: 'text-primary',
            anchor: '',
          },
          {
            id: 'settings' as const,
            title: 'পরিবারের যত্নকারী',
            subtitle: 'আমন্ত্রণ কোড, সতর্কতা ও সংযোগ পরিচালনা',
            icon: HeartHandshake,
            iconColor: 'text-primary',
            anchor: 'caregiver-section',
          },
          {
            id: 'health-records' as const,
            title: 'স্বাস্থ্য রেকর্ড',
            subtitle: 'রক্তচাপ, ডায়াবেটিস ও ওজনের হিসাব',
            icon: HeartPulse,
            iconColor: 'text-accent',
            anchor: '',
          },
          {
            id: 'doctors' as const,
            title: 'আমার ডাক্তার',
            subtitle: 'ডাক্তারদের ফোন, চেম্বার, ভিজিট ও জরুরি কল',
            icon: Stethoscope,
            iconColor: 'text-primary',
            anchor: '',
          },
          {
            id: 'appointments' as const,
            title: 'ডাক্তারের অ্যাপয়েন্টমেন্ট',
            subtitle: 'ডাক্তারের সাক্ষাতের তারিখ ও সময়',
            icon: Calendar,
            iconColor: 'text-primary',
            anchor: '',
          },
          {
            id: 'share-report' as const,
            title: 'ডাক্তারের জন্য রিপোর্ট',
            subtitle: 'ডাক্তার বা পরিবারকে নিরাপদ, মেয়াদি শেয়ার লিংক ও PDF',
            icon: Share2,
            iconColor: 'text-primary',
            anchor: '',
          },
          {
            id: 'emergency-qr' as const,
            title: 'জরুরি কার্ড QR',
            subtitle: 'স্ক্যান করলে জরুরি তথ্য দেখা যাবে, ওয়ালেট কার্ড ও লক স্ক্রিন ছবি',
            icon: QrCode,
            iconColor: 'text-accent',
            anchor: '',
          },
          {
            id: 'history' as const,
            title: 'ওষুধ খাওয়ার ইতিহাস',
            subtitle: 'আগের দিনগুলোর ডোজ ও ডাক্তারকে দেখানোর রিপোর্ট',
            icon: History,
            iconColor: 'text-primary',
            anchor: '',
          },
          {
            id: 'library' as const,
            title: 'ওষুধ লাইব্রেরি',
            subtitle: 'অনুমোদিত ওষুধের তালিকা খুঁজুন',
            icon: BookOpen,
            iconColor: 'text-primary',
            anchor: '',
          },
          ...(isAdmin
            ? [
                {
                  id: 'admin-dashboard' as const,
                  title: 'অ্যাডমিন প্যানেল',
                  subtitle: 'লাইব্রেরি ও ইমপোর্ট ব্যবস্থাপনা',
                  icon: ShieldCheck,
                  iconColor: 'text-primary',
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
              className="min-h-[72px] p-4 sm:p-5 bg-surface border border-border hover:border-primary rounded-2xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                  <Icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-text">
                    {item.title}
                  </div>
                  <div className="text-sm text-text-muted truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted shrink-0" />
            </button>
          );
        })}
      </section>

      {/* Feedback Card */}
      <FeedbackCard />

      {/* Account Card */}
      <section className="bg-surface border border-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {currentUser ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-lg shrink-0">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-text truncate">
                  {currentUser.displayName || 'ব্যবহারকারী'}
                </p>
                <p className="text-sm text-text-muted truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={signOutUser}
              className="min-h-[48px] px-5 py-2.5 bg-danger-soft hover:opacity-90 text-danger-text border border-danger/30 rounded-xl text-base font-bold flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>লগআউট</span>
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-bold text-text">
                আপনার তথ্য নিরাপদ রাখুন
              </p>
              <p className="text-sm text-text-muted">
                লগইন করলে ফোন বদলালেও সব ওষুধ ও প্রোফাইল ফিরে পাবেন
              </p>
            </div>

            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[48px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-base font-bold flex items-center gap-2 cursor-pointer"
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
