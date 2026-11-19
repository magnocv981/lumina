import React from 'react';
import { BookOpen, Cloud, Library, Star } from 'lucide-react';
import type { ActiveNavSection } from '../types/library';

interface MobileBottomNavProps {
  activeSection: ActiveNavSection;
  onSelectSection: (section: ActiveNavSection) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const tabs: Array<{
    id: ActiveNavSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'library', label: 'Biblioteca', icon: <Library className="w-5 h-5" /> },
    { id: 'reading', label: 'Lendo', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'favorites', label: 'Favoritos', icon: <Star className="w-5 h-5" /> },
    { id: 'sync', label: 'Sincronia', icon: <Cloud className="w-5 h-5" /> },
  ];

  return (
    <nav
      aria-label="Navegação Android"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111620]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectSection(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#3B5BDB] dark:text-[#748FFC]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="text-[11px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
