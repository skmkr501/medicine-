import React, { useState } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { NavigationPage } from '../../types';
import { Plus, User, Cloud, CloudCheck, LogOut, RefreshCw, Sun, Moon, CheckSquare, Sparkles } from 'lucide-react';

import { AppLogo } from '../ui/AppLogo';

interface NavbarProps {
  activePage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activePage, onNavigate }) => {
  const {
    patients,
    activePatientId,
    setActivePatientId,
    openCreateProfileModal,
    currentUser,
    openAuthModal,
    signOutUser,
    syncLocalToCloud,
    isSyncing,
    isCloudConnected,
    isAdmin,
    settings,
    updateSettings,
  } = useMedicine();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const isDarkMode =
    settings.themeMode === 'dark' ||
    ((!settings.themeMode || settings.themeMode === 'system') &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    updateSettings({ themeMode: isDarkMode ? 'light' : 'dark' });
  };

  const isBn = settings.language !== 'en';

  const navLinks: { id: NavigationPage; label: string; badge?: string }[] = [
    { id: 'dashboard', label: isBn ? 'ড্যাশবোর্ড' : 'Dashboard' },
    { id: 'checklist', label: isBn ? 'চেকলিস্ট' : 'Checklist', badge: isBn ? 'আজ' : 'Today' },
    { id: 'medicines', label: isBn ? 'আমার ওষুধ' : 'Medicines' },
    { id: 'health-records', label: isBn ? 'স্বাস্থ্য রেকর্ড' : 'Health Records' },
    { id: 'appointments', label: isBn ? 'অ্যাপয়েন্টমেন্ট' : 'Appointments' },
    { id: 'ai-assistant', label: isBn ? 'AI সহায়ক' : 'AI Assistant', badge: 'Gemini' },
    { id: 'reminders', label: isBn ? 'রিমাইন্ডার' : 'Reminders' },
    { id: 'history', label: isBn ? 'ইতিহাস' : 'History' },
    { id: 'settings', label: isBn ? 'সেটিংস' : 'Settings' },
    ...(isAdmin ? [{ id: 'admin-import' as NavigationPage, label: isBn ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin', badge: 'Admin' }] : []),
  ];


  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        
        {/* Zone 1: Single Brand Wordmark with SVG Emblem */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <AppLogo size="md" showText={true} animate={true} />
        </button>

        {/* Zone 2: Clean single-line text links */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
          {navLinks.map((link) => {
            const isActive =
              activePage === link.id ||
              (link.id === 'admin-import' && activePage === 'admin-dashboard');
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400 font-semibold border-b-2 border-teal-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.badge && (
                  <span className="text-[10px] bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-1.5 py-0.5 rounded-full font-bold">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>


        {/* Zone 3: 1 Primary Action + Quick Patient Selector + Cloud Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Patient Selector */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mr-1">
            <span className="text-slate-400">রোগী:</span>
            {patients.length > 0 ? (
              <select
                value={activePatientId || ''}
                onChange={(e) => {
                  if (e.target.value === '__add__') {
                    openCreateProfileModal();
                  } else {
                    setActivePatientId(e.target.value || null);
                  }
                }}
                aria-label="রোগী নির্বাচন করুন"
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-md px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-medium cursor-pointer"
              >
                <option value="">সকল ওষুধ (সকল প্রোফাইল)</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relation})
                  </option>
                ))}
                <option value="__add__">+ নতুন প্রোফাইল তৈরি করুন</option>
              </select>
            ) : (
              <button
                type="button"
                onClick={openCreateProfileModal}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                + প্রোফাইল তৈরি করুন
              </button>
            )}
          </div>

          {/* Add Medicine Primary Action */}
          <button
            type="button"
            onClick={() => onNavigate('add-medicine')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">নতুন ওষুধ</span>
          </button>

          {/* Dark / Light Mode Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isDarkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            aria-label="থিম পরিবর্তন"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Firebase Authentication & Cloud Sync Widget */}
          {currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={`${currentUser.displayName || currentUser.email} (ক্লাউড সংযুক্ত)`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-teal-500"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center text-xs font-bold">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Firestore সুরক্ষিত" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2 text-xs z-50 animate-in fade-in duration-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block truncate">
                      {currentUser.displayName || 'ব্যবহারকারী'}
                    </span>
                    <span className="text-slate-400 block truncate text-[11px]">
                      {currentUser.email}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                      ✓ ক্লাউড স্টোরেজ সক্রিয়
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      syncLocalToCloud();
                    }}
                    disabled={isSyncing}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 cursor-pointer mt-1"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>ক্লাউডে সিঙ্ক করুন</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Sync</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserMenu(false);
                        onNavigate('admin-import');
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center gap-2 cursor-pointer mt-1 font-medium"
                    >
                      <span className="w-2 h-2 rounded-full bg-teal-600" />
                      <span>অ্যাডমিন ইমপোর্ট প্যানেল</span>
                    </button>
                  )}


                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      signOutUser();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>লগআউট করুন</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>লগইন</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
