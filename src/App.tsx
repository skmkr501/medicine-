/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { MedicineProvider, useMedicine } from './context/MedicineContext';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Toast } from './components/ui/Toast';
import { Dashboard } from './components/dashboard/Dashboard';
import { MedicineList } from './components/medicines/MedicineList';
import { WeeklyPillboxView } from './components/medicines/WeeklyPillboxView';
import { AddMedicine } from './components/medicines/AddMedicine';
import { ShoppingListPage } from './components/medicines/ShoppingListPage';
import { MedicineReminder } from './components/reminders/MedicineReminder';
import { MedicineHistory } from './components/history/MedicineHistory';
import { Settings } from './components/settings/Settings';
const MedicineLibrary = React.lazy(() =>
  import('./components/library/MedicineLibrary').then((m) => ({ default: m.MedicineLibrary }))
);
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLibraryManager } from './components/admin/AdminLibraryManager';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileModal } from './components/profiles/ProfileModal';
import { StockAdjustmentModal } from './components/medicines/StockAdjustmentModal';
import { AdminManualMedicineModal } from './components/admin/AdminManualMedicineModal';
import { AppLogo } from './components/ui/AppLogo';

import { DailyChecklist } from './components/checklist/DailyChecklist';
import { AiAssistantPage } from './components/ai/AiAssistantPage';
import { HealthRecordsPage } from './components/health/HealthRecordsPage';
import { BmiPage } from './components/health/BmiPage';
import { WomensHealthPage } from './components/health/WomensHealthPage';
import { ExpensesPage } from './components/expenses/ExpensesPage';
import { AppointmentsPage } from './components/appointments/AppointmentsPage';
import { DataConflictModal } from './components/auth/DataConflictModal';
import { ResetConfirmationModal } from './components/settings/ResetConfirmationModal';
import { MePage } from './components/me/MePage';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { markOnboardingDone, shouldShowOnboarding } from './utils/onboarding';
import { loadVoiceSettings, stopBengaliSpeech } from './utils/speechUtils';
import { setNativeAlarmVoiceEnabled } from './services/nativeReminders';
import { SharedReportViewer } from './components/reports/SharedReportViewer';
import { ShareReportPage } from './components/reports/ShareReportPage';
import { extractSharedReportTokenFromPath } from './utils/sharedReports';
import { EmergencyCardViewer } from './components/emergency/EmergencyCardViewer';
import { EmergencyQrPage } from './components/emergency/EmergencyQrPage';
import { extractEmergencyCardTokenFromPath } from './utils/emergencyQr';
import { DoctorsPage } from './components/doctors/DoctorsPage';
import { GuestViewViewer } from './components/guest/GuestViewViewer';
import { GuestViewManager } from './components/guest/GuestViewManager';
import { extractGuestViewTokenFromPath } from './utils/guestViews';
import { PhoneTransferPage } from './components/transfer/PhoneTransferPage';
import { parseTransferInput } from './utils/phoneTransfer';
import { PhonebookPage } from './components/phonebook/PhonebookPage';

const AppContent: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    isAuthModalOpen,
    closeAuthModal,
    isProfileModalOpen,
    closeProfileModal,
    editingPatient,
    isDataConflictModalOpen,
    conflictInfo,
    resolveDataConflict,
    downloadLocalBackup,
    isSyncing,
    isResetConfirmationModalOpen,
    closeResetConfirmationModal,
    confirmResetAllData,
    currentUser,
  } = useMedicine();

  const [showOnboarding, setShowOnboarding] = React.useState<boolean>(() =>
    shouldShowOnboarding()
  );
  const [initialTransferInput, setInitialTransferInput] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleHashTransfer = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash || '';
      if (hash.startsWith('#/transfer') && parseTransferInput(hash)) {
        setInitialTransferInput(hash);
        setCurrentPage('phone-transfer');
        try {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        } catch {
          // ignore history replace restrictions
        }
      }
    };
    handleHashTransfer();
    window.addEventListener('hashchange', handleHashTransfer);
    return () => window.removeEventListener('hashchange', handleHashTransfer);
  }, [setCurrentPage]);

  React.useEffect(() => {
    stopBengaliSpeech();
  }, [currentPage]);

  React.useEffect(() => {
    const saved = loadVoiceSettings();
    setNativeAlarmVoiceEnabled(saved.apkAlarmVoiceEnabled);
  }, []);

  const handleCloseOnboarding = () => {
    markOnboardingDone();
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text transition-colors print-root-white print:bg-white print:text-black print:min-h-0">
      
      {/* Top Bar following Top Bar Contract */}
      <Navbar activePage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Page Content */}
      <main className="flex-1 pb-24 md:pb-12 print:pb-0 print:bg-white print:text-black">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'me' && <MePage />}
        {currentPage === 'checklist' && <DailyChecklist />}
        {currentPage === 'medicines' && <MedicineList />}
        {currentPage === 'weekly-pillbox' && <WeeklyPillboxView />}
        {currentPage === 'shopping-list' && <ShoppingListPage />}
        {currentPage === 'health-records' && <HealthRecordsPage />}
        {currentPage === 'bmi' && <BmiPage />}
        {currentPage === 'expenses' && <ExpensesPage />}
        {currentPage === 'womens-health' && <WomensHealthPage />}
        {currentPage === 'appointments' && <AppointmentsPage />}
        {currentPage === 'doctors' && <DoctorsPage />}
        {currentPage === 'phonebook' && <PhonebookPage />}
        {currentPage === 'add-medicine' && <AddMedicine />}
        {currentPage === 'ai-assistant' && <AiAssistantPage />}
        {currentPage === 'reminders' && <MedicineReminder />}
        {currentPage === 'history' && <MedicineHistory />}
        {currentPage === 'share-report' && <ShareReportPage />}
        {currentPage === 'emergency-qr' && <EmergencyQrPage />}
        {currentPage === 'guest-views' && <GuestViewManager />}
        {currentPage === 'phone-transfer' && (
          <PhoneTransferPage
            initialTransferInput={initialTransferInput}
            onConsumeInitialInput={() => setInitialTransferInput(null)}
          />
        )}
        {currentPage === 'settings' && <Settings />}
        {currentPage === 'library' && (
          <React.Suspense
            fallback={
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-surface border border-border text-sm font-semibold text-text-muted shadow-xs">
                  <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>ওষুধ লাইব্রেরি খোলা হচ্ছে…</span>
                </div>
              </div>
            }
          >
            <MedicineLibrary />
          </React.Suspense>
        )}
        {currentPage === 'admin-library' && <AdminLibraryManager />}
        {(currentPage === 'admin-import' || currentPage === 'admin-dashboard') && <AdminDashboard />}
      </main>


      {/* Mobile Bottom Navigation Bar (Under 15% sticky cap) */}
      <MobileNav activePage={currentPage} onNavigate={setCurrentPage} />

      {/* Toast Feedback */}
      <Toast />

      {/* Supabase User Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={() => {}} />

      {/* Profile Management Modal (Create, Edit, Delete Unlimited Profiles) */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        editingPatient={editingPatient}
      />

      {/* Smart Medicine Stock Adjustment Modal */}
      <StockAdjustmentModal />

      {/* Admin Manual Medicine Entry Modal */}
      <AdminManualMedicineModal />

      {/* Login Data Conflict Resolution Modal (Requirement গ) */}
      <DataConflictModal
        isOpen={isDataConflictModalOpen}
        localMedicinesCount={conflictInfo?.localMedicinesCount || 0}
        localPatientsCount={conflictInfo?.localPatientsCount || 0}
        cloudMedicinesCount={conflictInfo?.cloudMedicinesCount || 0}
        cloudPatientsCount={conflictInfo?.cloudPatientsCount || 0}
        onResolve={resolveDataConflict}
        onDownloadBackup={downloadLocalBackup}
        isProcessing={isSyncing}
      />

      {/* 2-Step Reset Confirmation Modal (Requirement চ) */}
      <ResetConfirmationModal
        isOpen={isResetConfirmationModalOpen}
        onClose={closeResetConfirmationModal}
        onConfirmReset={confirmResetAllData}
        onDownloadBackup={downloadLocalBackup}
        isLoggedIn={!!currentUser}
        userEmail={currentUser?.email}
      />

      {/* First-launch 3-Slide Simple Onboarding */}
      <OnboardingModal isOpen={showOnboarding} onComplete={handleCloseOnboarding} />

      {/* Quiet Footer */}
      <footer className="no-print hidden md:block border-t border-border bg-surface py-6 text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" showText={false} />
            <span className="font-semibold text-text">
              স্বাস্থ্যবন্ধু
            </span>
            <span aria-hidden="true">·</span>
            <span>আধুনিক বাংলা ওষুধ ব্যবস্থাপনা</span>
          </div>

          <div className="flex items-center gap-6">
            <span>জাতীয় স্বাস্থ্য হেল্পলাইন: <strong className="text-primary">১৬২৬৩</strong></span>
            <span aria-hidden="true">·</span>
            <span>জাতীয় জরুরি সেবা: <strong className="text-primary">৯৯৯</strong></span>
            <span aria-hidden="true">·</span>
            <span>© ২০২৬ সর্বস্বত্ব সংরক্ষিত</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const shareToken = extractSharedReportTokenFromPath(pathname);
  const emergencyToken = extractEmergencyCardTokenFromPath(pathname);
  const guestToken = extractGuestViewTokenFromPath(pathname);

  if (shareToken) {
    return <SharedReportViewer token={shareToken} />;
  }

  if (emergencyToken) {
    return <EmergencyCardViewer token={emergencyToken} />;
  }

  if (guestToken) {
    return <GuestViewViewer token={guestToken} />;
  }

  return (
    <AuthProvider>
      <MedicineProvider>
        <AppContent />
      </MedicineProvider>
    </AuthProvider>
  );
}
