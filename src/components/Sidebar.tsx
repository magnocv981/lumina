import React from 'react';
import {
  BookOpen,
  Cloud,
  FolderPlus,
  Library,
  Monitor,
  Moon,
  Pencil,
  Smartphone,
  Star,
  Sun,
} from 'lucide-react';
import type { ActiveNavSection, Book, Category, WorkspaceMode } from '../types/library';

interface SidebarProps {
  activeSection: ActiveNavSection;
  onSelectSection: (section: ActiveNavSection) => void;
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string | null) => void;
  categories: Category[];
  books: Book[];
  onOpenNewCategory: () => void;
  onEditCategory: (cat: Category) => void;
  isDark: boolean;
  onToggleDark: () => void;
  workspaceMode: WorkspaceMode;
  onChangeWorkspaceMode: (mode: WorkspaceMode) => void;
  isSignedIn: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  selectedCategoryId,
  onSelectCategory,
  categories,
  books,
  onOpenNewCategory,
  onEditCategory,
  isDark,
  onToggleDark,
  workspaceMode,
  onChangeWorkspaceMode,
  isSignedIn,
}) => {
  const readingCount = books.filter((b) => b.status === 'reading').length;
  const favCount = books.filter((b) => b.isFavorite).length;

  const navItems: Array<{
    id: ActiveNavSection;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { id: 'library', label: 'Biblioteca', icon: <Library className="w-4 h-4" />, count: books.length },
    { id: 'reading', label: 'Lendo Agora', icon: <BookOpen className="w-4 h-4" />, count: readingCount },
    { id: 'favorites', label: 'Favoritos', icon: <Star className="w-4 h-4" />, count: favCount },
    { id: 'sync', label: 'Sincronia & Apps', icon: <Cloud className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-[264px] shrink-0 border-r border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#0E131D] flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-[#E6E8EE] dark:border-[#1E2636]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#3B5BDB] flex items-center justify-center text-white font-display text-sm font-bold">
            L
          </div>
          <span className="text-base font-bold tracking-tight text-[#0E1320] dark:text-white font-display whitespace-nowrap">
            Lumina
          </span>
        </div>
        <button
          onClick={onToggleDark}
          title={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-7">
        <nav className="space-y-1" aria-label="Navegação principal">
          {navItems.map((item) => {
            const isActive = activeSection === item.id && selectedCategoryId === null;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectCategory(null);
                  onSelectSection(item.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#3B5BDB]/10 dark:bg-[#637BFF]/15 text-[#3B5BDB] dark:text-[#829BFF]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-[#171E2C] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  {item.icon}
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Custom Categories */}
        <div className="space-y-2.5">
          <div className="px-3.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
              Categorias
            </span>
            <button
              onClick={onOpenNewCategory}
              title="Nova categoria"
              aria-label="Criar nova categoria"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {categories.map((cat) => {
              const count = books.filter((b) => b.categoryIds.includes(cat.id)).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`group flex items-center justify-between rounded-xl px-3.5 py-2 text-[13px] transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-[#171E2C] text-slate-900 dark:text-white font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-[#171E2C]/60'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSection('library');
                      onSelectCategory(isSelected ? null : cat.id);
                    }}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => onEditCategory(cat)}
                      title={`Editar ${cat.name}`}
                      aria-label={`Editar categoria ${cat.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white transition-opacity cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="px-3.5 py-2 text-xs text-slate-400 dark:text-slate-500">
                Nenhuma categoria criada.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Platform Mode Switcher */}
      <div className="p-3.5 border-t border-[#E6E8EE] dark:border-[#1E2636] space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F2F4F8] dark:bg-[#161C28]">
          <button
            onClick={() => onChangeWorkspaceMode('windows')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              workspaceMode === 'windows'
                ? 'bg-white dark:bg-[#232C3E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Windows
          </button>
          <button
            onClick={() => onChangeWorkspaceMode('android')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              workspaceMode === 'android'
                ? 'bg-white dark:bg-[#232C3E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Android
          </button>
        </div>

        <button
          onClick={() => {
            onSelectCategory(null);
            onSelectSection('sync');
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-[#171E2C] transition-colors cursor-pointer"
        >
          <span>{isSignedIn ? 'Nuvem conectada' : 'Modo local'}</span>
          <span className="font-medium text-[#3B5BDB] dark:text-[#829BFF]">
            {isSignedIn ? 'Builds & Sync' : 'Conectar'}
          </span>
        </button>
      </div>
    </aside>
  );
};
