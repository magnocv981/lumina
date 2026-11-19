import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Star,
  Upload,
} from 'lucide-react';
import type {
  ActiveNavSection,
  Book,
  Bookmark,
  Category,
  WorkspaceMode,
} from '../types/library';

interface LibraryViewProps {
  books: Book[];
  categories: Category[];
  bookmarks: Bookmark[];
  activeSection: ActiveNavSection;
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string | null) => void;
  workspaceMode: WorkspaceMode;
  onOpenReader: (book: Book, chapterIndex?: number, scrollRatio?: number) => void;
  onOpenStudio: (book: Book) => void;
  onToggleFavorite: (bookId: string) => Promise<void>;
  onImportFiles: (files: FileList | File[]) => Promise<void>;
  importing: boolean;
  importError: string | null;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  categories,
  bookmarks,
  activeSection,
  selectedCategoryId,
  onSelectCategory,
  workspaceMode,
  onOpenReader,
  onOpenStudio,
  onToggleFavorite,
  onImportFiles,
  importing,
  importError,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'progress'>('recent');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = books.filter((b) => {
      if (activeSection === 'reading' && b.status !== 'reading') return false;
      if (activeSection === 'favorites' && !b.isFavorite) return false;
      if (selectedCategoryId && !b.categoryIds.includes(selectedCategoryId)) return false;
      if (q) {
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchAuthor = b.author.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sortBy === 'progress') return b.progressPercent - a.progressPercent;
      if (a.status === 'reading' && b.status !== 'reading') return -1;
      if (b.status === 'reading' && a.status !== 'reading') return 1;
      return b.progressPercent - a.progressPercent;
    });
  }, [books, activeSection, selectedCategoryId, searchQuery, sortBy]);

  const spotlightBook = useMemo(() => {
    if (activeSection !== 'library' || selectedCategoryId || searchQuery.trim()) return null;
    return (
      books.find((b) => b.status === 'reading' && b.progressPercent > 0) ||
      books[0] ||
      null
    );
  }, [books, activeSection, selectedCategoryId, searchQuery]);

  const activeCategory = selectedCategoryId ? categoryMap.get(selectedCategoryId) : null;

  const sectionHeading = activeCategory
    ? activeCategory.name
    : activeSection === 'reading'
    ? 'Lendo Agora'
    : activeSection === 'favorites'
    ? 'Livros Favoritos'
    : 'Biblioteca Pessoal';

  const statusLabel = (status: Book['status']) => {
    if (status === 'completed') return 'Concluído';
    if (status === 'reading') return 'Lendo';
    return 'Não iniciado';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onImportFiles(e.dataTransfer.files);
    }
  };

  const showTable = workspaceMode === 'windows' && viewLayout === 'table';

  return (
    <div
      className="space-y-7"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Modern Hero Spotlight for Active Reading */}
      {spotlightBook && (
        <section className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-5 sm:p-7 flex flex-col md:flex-row items-stretch gap-6 sm:gap-8">
          <button
            onClick={() => onOpenReader(spotlightBook)}
            className="w-32 sm:w-36 md:w-40 aspect-[3/4] rounded-xl overflow-hidden shrink-0 relative bg-slate-100 dark:bg-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-black/40 self-start cursor-pointer group"
            aria-label={`Continuar ${spotlightBook.title}`}
          >
            {spotlightBook.coverUrl ? (
              <img
                src={spotlightBook.coverUrl}
                alt={`Capa de ${spotlightBook.title}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-3 text-center">
                <span className="text-xs font-semibold font-display">{spotlightBook.title}</span>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none book-spine-sheen" />
          </button>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[#3B5BDB] dark:text-[#829BFF] tabular-nums">
                Continuar leitura · {spotlightBook.progressPercent}% concluído · {spotlightBook.lastDevice}
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0E1320] dark:text-white font-display text-balance">
                {spotlightBook.title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {spotlightBook.author}
                {spotlightBook.publisher ? ` · ${spotlightBook.publisher}` : ''}
              </p>
              {spotlightBook.synopsis && (
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 max-w-2xl leading-relaxed">
                  {spotlightBook.synopsis}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="w-full max-w-md h-1.5 rounded-full bg-slate-100 dark:bg-[#1E2636] overflow-hidden">
                <div
                  className="h-full bg-[#3B5BDB] dark:bg-[#637BFF] rounded-full transition-all duration-300"
                  style={{ width: `${spotlightBook.progressPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onOpenReader(spotlightBook)}
                  className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-[#324EC9] text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  Retomar capítulo {spotlightBook.currentChapterIndex + 1}
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                {workspaceMode === 'windows' && (
                  <button
                    onClick={() => onOpenStudio(spotlightBook)}
                    className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar no Estúdio
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0E1320] dark:text-white font-display">
            {sectionHeading}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'título' : 'títulos'}
            <span aria-hidden="true"> · </span>
            {bookmarks.length} {bookmarks.length === 1 ? 'marcador salvo' : 'marcadores salvos'}
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320] hover:opacity-90 disabled:opacity-60 text-sm font-medium transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          {importing ? 'Importando...' : 'Importar ePub / PDF'}
        </button>
      </div>

      {importError && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
          {importError}
        </div>
      )}

      {isDragging && (
        <div className="rounded-2xl border-2 border-dashed border-[#3B5BDB] bg-[#3B5BDB]/5 p-8 text-center">
          <p className="text-sm font-medium text-[#3B5BDB] dark:text-[#829BFF]">
            Solte seus arquivos .epub ou .pdf aqui para adicionar à biblioteca sincronizada
          </p>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              workspaceMode === 'windows'
                ? 'Buscar livro ou autor... (Ctrl+K)'
                : 'Buscar livro ou autor...'
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            aria-label="Ordenar livros"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'title' | 'progress')}
            className="min-h-[40px] rounded-xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
          >
            <option value="recent">Ordenar: Lendo recente</option>
            <option value="title">Ordenar: Título (A–Z)</option>
            <option value="progress">Ordenar: Progresso</option>
          </select>

          {workspaceMode === 'windows' && (
            <div className="flex items-center p-1 rounded-xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722]">
              <button
                onClick={() => setViewLayout('grid')}
                aria-label="Visualização em grade"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'grid'
                    ? 'bg-slate-100 dark:bg-[#1E2636] text-slate-900 dark:text-white'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('table')}
                aria-label="Visualização em tabela"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'table'
                    ? 'bg-slate-100 dark:bg-[#1E2636] text-slate-900 dark:text-white'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Row */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onSelectCategory(null)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategoryId === null
                ? 'bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320]'
                : 'bg-white dark:bg-[#121722] border border-[#E6E8EE] dark:border-[#1E2636] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(active ? null : cat.id)}
                className={`min-h-[36px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320]'
                    : 'bg-white dark:bg-[#121722] border border-[#E6E8EE] dark:border-[#1E2636] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredBooks.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-12 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white font-display">
            Nenhum livro encontrado
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Limpe os filtros atuais ou importe um novo arquivo .epub ou .pdf do seu computador ou celular.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-[#324EC9] text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importar ePub ou PDF
          </button>
        </div>
      ) : showTable ? (
        <div className="rounded-2xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8EE] dark:border-[#1E2636] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Título e Autor</th>
                  <th className="py-3.5 px-4">Categorias</th>
                  <th className="py-3.5 px-4">Dispositivo</th>
                  <th className="py-3.5 px-4 text-right">Progresso</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B2230] text-sm">
                {filteredBooks.map((book) => {
                  const catNames = book.categoryIds
                    .map((id) => categoryMap.get(id)?.name)
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <tr
                      key={book.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#171E2C]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onOpenReader(book)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-medium text-slate-900 dark:text-white group-hover:text-[#3B5BDB] dark:group-hover:text-[#829BFF] transition-colors">
                            {book.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {book.author}
                          </div>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {catNames || 'Sem categoria'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {book.lastDevice}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-xs font-medium text-slate-700 dark:text-slate-200">
                        {book.progressPercent}% · {statusLabel(book.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onToggleFavorite(book.id)}
                            aria-label="Alternar favorito"
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                book.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => onOpenStudio(book)}
                            aria-label={`Editar ${book.title}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onOpenReader(book)}
                            className="ml-1 px-3.5 py-1.5 rounded-lg bg-[#3B5BDB] text-white text-xs font-medium hover:bg-[#324EC9] transition-colors cursor-pointer"
                          >
                            Ler
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-5 ${
            workspaceMode === 'android'
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {filteredBooks.map((book) => {
            const firstCat = book.categoryIds
              .map((id) => categoryMap.get(id))
              .find(Boolean);
            const bookBookmarks = bookmarks.filter((bm) => bm.bookId === book.id).length;

            return (
              <article
                key={book.id}
                className="group rounded-2xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-[#2C374D]"
              >
                <div className="relative aspect-[3/4] bg-slate-100 dark:bg-[#0D1119] overflow-hidden">
                  <button
                    onClick={() => onOpenReader(book)}
                    className="w-full h-full block text-left cursor-pointer"
                    aria-label={`Abrir leitura de ${book.title}`}
                  >
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={`Capa de ${book.title}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#171E2C] dark:to-[#0D1119]">
                        <BookOpen className="w-8 h-8 text-slate-400 mb-3" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-2 font-display">
                          {book.title}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {book.author}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none book-spine-sheen" />
                  </button>

                  <button
                    onClick={() => onToggleFavorite(book.id)}
                    aria-label={book.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                    className="absolute top-3 right-3 min-w-[40px] min-h-[40px] rounded-full bg-white/90 dark:bg-[#0A0D14]/85 backdrop-blur-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        book.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                  </button>

                  <div className="absolute bottom-0 inset-x-0 h-1 bg-black/15 dark:bg-white/10">
                    <div
                      className="h-full bg-[#3B5BDB] dark:bg-[#637BFF] transition-all"
                      style={{ width: `${book.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <button
                      onClick={() => onOpenReader(book)}
                      className="text-left w-full cursor-pointer"
                    >
                      <h3 className="text-base font-semibold text-[#0E1320] dark:text-white font-display line-clamp-1 group-hover:text-[#3B5BDB] dark:group-hover:text-[#829BFF] transition-colors">
                        {book.title}
                      </h3>
                    </button>

                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span>{book.author}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{book.format === 'pdf' ? 'PDF' : 'ePub'}</span>
                      {firstCat && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{firstCat.name}</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 dark:text-slate-500 tabular-nums truncate">
                      <span>{book.progressPercent}% lido</span>
                      <span aria-hidden="true"> · </span>
                      <span>{book.lastDevice}</span>
                      {bookBookmarks > 0 && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{bookBookmarks} {bookBookmarks === 1 ? 'marcador' : 'marcadores'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-[#1B2230] flex items-center justify-between gap-2">
                    <button
                      onClick={() => onOpenReader(book)}
                      className="min-h-[40px] flex-1 rounded-xl bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320] text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      {book.progressPercent > 0 ? 'Continuar' : 'Ler agora'}
                    </button>
                    {workspaceMode === 'windows' && (
                      <button
                        onClick={() => onOpenStudio(book)}
                        title="Editar metadados e notas no Estúdio"
                        aria-label={`Editar ${book.title}`}
                        className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E6E8EE] dark:border-[#242E42] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
