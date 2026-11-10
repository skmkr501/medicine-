import React from 'react';
import { NavigationPage } from '../../types';
import { LayoutDashboard, CheckSquare, Pill, Sparkles, Bell } from 'lucide-react';

interface MobileNavProps {
  activePage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activePage, onNavigate }) => {
  const items = [
    { id: 'dashboard' as NavigationPage, label: 'হোম', icon: LayoutDashboard },
    { id: 'checklist' as NavigationPage, label: 'চেকলিস্ট', icon: CheckSquare },
    { id: 'medicines' as NavigationPage, label: 'ওষুধ', icon: Pill },
    { id: 'ai-assistant' as NavigationPage, label: 'AI সহায়ক', icon: Sparkles },
    { id: 'reminders' as NavigationPage, label: 'রিমাইন্ডার', icon: Bell },
  ];


  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors shadow-lg">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-1.5'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
