import React from 'react';
import { NavigationPage } from '../../types';
import { Home, Pill, Sparkles, User } from 'lucide-react';

interface MobileNavProps {
  activePage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activePage, onNavigate }) => {
  const items: {
    id: NavigationPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    matchPages: NavigationPage[];
  }[] = [
    {
      id: 'dashboard',
      label: 'আজ',
      icon: Home,
      matchPages: ['dashboard', 'checklist', 'reminders'],
    },
    {
      id: 'medicines',
      label: 'ওষুধ',
      icon: Pill,
      matchPages: ['medicines', 'add-medicine', 'library'],
    },
    {
      id: 'ai-assistant',
      label: 'AI সহায়ক',
      icon: Sparkles,
      matchPages: ['ai-assistant'],
    },
    {
      id: 'me',
      label: 'আমি',
      icon: User,
      matchPages: ['me', 'settings', 'health-records', 'appointments', 'history'],
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors shadow-lg">
      <div className="grid grid-cols-4 h-[72px] max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPages.includes(activePage);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 text-sm transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-700 dark:text-teal-300 font-bold'
                  : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="truncate leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
