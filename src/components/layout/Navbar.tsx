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
    syncStatus,
    lastSyncedAt,
    triggerManualSync,
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

  const navLinks: { id: NavigationPage; label: string; matchPages: NavigationPage[] }[] = [
    { id: 'dashboard', label: isBn ? 'আজ' : 'Today', matchPages: ['dashboard', 'checklist', 'reminders'] },
    { id: 'medicines', label: isBn ? 'ওষুধ' : 'Medicines', matchPages: ['medicines', 'weekly-pillbox', 'add-medicine', 'library', 'shopping-list'] },
    { id: 'doctors', label: isBn ? 'ডাক্তার' : 'Doctors', matchPages: ['doctors', 'appointments'] },
    { id: 'ai-assistant', label: 'AI সহায়ক', matchPages: ['ai-assistant'] },
    { id: 'me', label: isBn ? 'আমি' : 'Me', matchPages: ['me', 'settings', 'health-records', 'bmi', 'expenses', 'calendar', 'history', 'share-report', 'emergency-qr', 'guest-views', 'phone-transfer', 'phonebook', 'womens-health'] },
    ...(isAdmin
      ? [{ id: 'admin-import' as NavigationPage, label: isBn ? 'অ্যাডমিন' : 'Admin', matchPages: ['admin-import', 'admin-dashboard', 'admin-library'] as NavigationPage[] }]
      : []),
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border transition-colors">
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
        <nav className="hidden md:flex items-center gap-6 text-base font-medium text-text-muted">
          {navLinks.map((link) => {
            const isActive = link.matchPages.includes(activePage);
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 min-h-[48px] cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'text-primary font-bold border-b-2 border-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>


        {/* Zone 3: 1 Primary Action + Quick Patient Selector + Cloud Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Patient Selector */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-text-muted mr-1">
            <span className="text-text-muted">রোগী:</span>
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
                className="bg-surface-2 text-text text-xs rounded-md px-2.5 py-1.5 border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-medium cursor-pointer"
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
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                + প্রোফাইল তৈরি করুন
              </button>
            )}
          </div>

          {/* Add Medicine Primary Action */}
          <button
            type="button"
            onClick={() => onNavigate('add-medicine')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">নতুন ওষুধ</span>
          </button>

          {/* Small Sync Status Icon (Requirement ঙ) */}
          {currentUser && (
            <button
              type="button"
              onClick={triggerManualSync}
              disabled={syncStatus === 'syncing' || isSyncing}
              className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                syncStatus === 'synced'
                  ? 'text-success-text hover:bg-success-soft'
                  : syncStatus === 'syncing' || isSyncing
                  ? 'text-primary bg-primary-soft'
                  : syncStatus === 'offline'
                  ? 'text-warning-text hover:bg-warning-soft'
                  : 'text-danger-text hover:bg-danger-soft'
              }`}
              title={
                syncStatus === 'synced'
                  ? `✓ ক্লাউড সিঙ্ক হয়েছে (${lastSyncedAt ? `শেষ সিঙ্ক: ${lastSyncedAt}` : 'সক্রিয়'})`
                  : syncStatus === 'syncing' || isSyncing
                  ? '⟳ চলছে...'
                  : syncStatus === 'offline'
                  ? 'অফলাইন — ইন্টারনেট এলে সিঙ্ক হবে'
                  : '✕ ব্যর্থ! ক্লিক করে আবার চেষ্টা করুন'
              }
              aria-label="ক্লাউড সিঙ্ক অবস্থা"
            >
              {syncStatus === 'synced' ? (
                <div className="relative">
                  <Cloud className="w-4 h-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success ring-1 ring-surface" />
                </div>
              ) : syncStatus === 'syncing' || isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              ) : syncStatus === 'offline' ? (
                <div className="relative">
                  <Cloud className="w-4 h-4 text-warning" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning ring-1 ring-surface" />
                </div>
              ) : (
                <div className="relative">
                  <Cloud className="w-4 h-4 text-danger" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-danger ring-1 ring-surface" />
                </div>
              )}
            </button>
          )}

          {/* Dark / Light Mode Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            title={isDarkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            aria-label="থিম পরিবর্তন"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-text-muted" />}
          </button>

          {/* Cloud Authentication & Sync Widget */}
          {currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-surface-2 cursor-pointer"
                title={`${currentUser.displayName || currentUser.email} (ক্লাউড সংযুক্ত)`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-primary"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="w-2 h-2 rounded-full bg-success" title="ক্লাউড সুরক্ষিত" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg p-2 text-xs z-50 animate-in fade-in duration-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-border">
                    <span className="font-bold text-text block truncate">
                      {currentUser.displayName || 'ব্যবহারকারী'}
                    </span>
                    <span className="text-text-muted block truncate text-[11px]">
                      {currentUser.email}
                    </span>
                    <span className="text-[10px] text-success-text font-semibold mt-1 block">
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
                    title="ক্লাউডে সিঙ্ক করুন"
                    className="w-full text-left px-3 py-2.5 min-h-[48px] rounded-lg hover:bg-surface-2 flex items-center justify-between text-text cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <RefreshCw className={`w-4 h-4 text-primary shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>ক্লাউডে সিঙ্ক করুন</span>
                    </span>
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserMenu(false);
                          onNavigate('admin-library');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-soft text-primary flex items-center gap-2 cursor-pointer mt-1 font-medium"
                      >
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>ওষুধ ব্যবস্থাপনা</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserMenu(false);
                          onNavigate('admin-import');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-soft text-primary flex items-center gap-2 cursor-pointer mt-1 font-medium"
                      >
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>অ্যাডমিন ইমপোর্ট প্যানেল</span>
                      </button>
                    </>
                  )}


                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      signOutUser();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-danger-soft text-danger-text flex items-center gap-2 cursor-pointer mt-1"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary-soft border border-primary/25 rounded-lg hover:bg-primary/15 cursor-pointer transition-colors"
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
