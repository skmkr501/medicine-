/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MedicineProvider, useMedicine } from './context/MedicineContext';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Toast } from './components/ui/Toast';
import { Dashboard } from './components/dashboard/Dashboard';
import { MedicineList } from './components/medicines/MedicineList';
import { AddMedicine } from './components/medicines/AddMedicine';
import { MedicineReminder } from './components/reminders/MedicineReminder';
import { MedicineHistory } from './components/history/MedicineHistory';
import { Settings } from './components/settings/Settings';
import { MedicineLibrary } from './components/library/MedicineLibrary';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileModal } from './components/profiles/ProfileModal';
import { StockAdjustmentModal } from './components/medicines/StockAdjustmentModal';
import { AppLogo } from './components/ui/AppLogo';

import { DailyChecklist } from './components/checklist/DailyChecklist';
import { AiAssistantPage } from './components/ai/AiAssistantPage';
import { HealthRecordsPage } from './components/health/HealthRecordsPage';
import { AppointmentsPage } from './components/appointments/AppointmentsPage';

const AppContent: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    isAuthModalOpen,
    closeAuthModal,
    isProfileModalOpen,
    closeProfileModal,
    editingPatient,
  } = useMedicine();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* Top Bar following Top Bar Contract */}
      <Navbar activePage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Page Content */}
      <main className="flex-1 pb-20 md:pb-12">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'checklist' && <DailyChecklist />}
        {currentPage === 'medicines' && <MedicineList />}
        {currentPage === 'health-records' && <HealthRecordsPage />}
        {currentPage === 'appointments' && <AppointmentsPage />}
        {currentPage === 'add-medicine' && <AddMedicine />}
        {currentPage === 'ai-assistant' && <AiAssistantPage />}
        {currentPage === 'reminders' && <MedicineReminder />}
        {currentPage === 'history' && <MedicineHistory />}
        {currentPage === 'settings' && <Settings />}
        {currentPage === 'library' && <MedicineLibrary />}
        {(currentPage === 'admin-import' || currentPage === 'admin-dashboard') && <AdminDashboard />}
      </main>


      {/* Mobile Bottom Navigation Bar (Under 15% sticky cap) */}
      <MobileNav activePage={currentPage} onNavigate={setCurrentPage} />

      {/* Toast Feedback */}
      <Toast />

      {/* Firebase User Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={() => {}} />

      {/* Profile Management Modal (Create, Edit, Delete Unlimited Profiles) */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        editingPatient={editingPatient}
      />

      {/* Smart Medicine Stock Adjustment Modal */}
      <StockAdjustmentModal />

      {/* Quiet Footer */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" showText={false} />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              স্বাস্থ্যবন্ধু (Shasthobondhu)
            </span>
            <span aria-hidden="true">·</span>
            <span>আধুনিক বাংলা ওষুধ ব্যবস্থাপনা</span>
          </div>

          <div className="flex items-center gap-6">
            <span>জাতীয় স্বাস্থ্য হেল্পলাইন: <strong className="text-teal-700 dark:text-teal-400">১৬২৬৩</strong></span>
            <span aria-hidden="true">·</span>
            <span>জাতীয় জরুরি সেবা: <strong className="text-teal-700 dark:text-teal-400">৯৯৯</strong></span>
            <span aria-hidden="true">·</span>
            <span>© ২০২৬ সর্বস্বত্ব সংরক্ষিত</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default function App() {
  return (
    <MedicineProvider>
      <AppContent />
    </MedicineProvider>
  );
}
