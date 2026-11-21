import React from 'react';
import { NavigationPage } from '../../types';
import { Home, Pill, Sparkles, Stethoscope, User } from 'lucide-react';

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
      matchPages: ['medicines', 'weekly-pillbox', 'add-medicine', 'library', 'shopping-list'],
    },
    {
      id: 'doctors',
      label: 'ডাক্তার',
      icon: Stethoscope,
      matchPages: ['doctors', 'appointments'],
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
      matchPages: ['me', 'settings', 'health-records', 'history', 'share-report', 'emergency-qr', 'guest-views', 'phone-transfer', 'phonebook', 'womens-health'],
    },
  ];

  return (
    <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border transition-colors shadow-lg">
      <div className="grid grid-cols-5 h-[72px] max-w-lg mx-auto">
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
                  ? 'text-primary font-bold'
                  : 'text-text-muted font-medium hover:text-text'
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
