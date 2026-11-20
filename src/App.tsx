import React, { useState } from 'react';
import { Monitor, Moon, Smartphone, Sun, WifiOff } from 'lucide-react';
import { BookStudioModal } from './components/BookStudioModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { EpubReader } from './components/EpubReader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LibraryView } from './components/LibraryView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Sidebar } from './components/Sidebar';
import { SyncDevicesView } from './components/SyncDevicesView';
import { useLibrarySync } from './hooks/useLibrarySync';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { isRunningInTauri } from './lib/tauriBridge';
import type { ActiveNavSection, Book, Category } from './types/library';

function LuminaWorkspace() {
  const sync = useLibrarySync();
  const isOnline = useOnlineStatus();
  const inTauri = isRunningInTauri();

  const [activeSection, setActiveSection] = useState<ActiveNavSection>('library');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [readingTarget, setReadingTarget] = useState<{
    book: Book;
    chapterIndex?: number;
    scrollRatio?: number;
  } | null>(null);
  const [studioBook, setStudioBook] = useState<Book | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const isDark = sync.preferences.appTheme === 'dark';

  const handleToggleDark = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    sync.updatePreferences({
      appTheme: nextTheme,
      readerTheme: nextTheme === 'dark' ? 'night' : 'light',
    });
  };

  const handleImportFiles = async (files: FileList | File[]) => {
    setImportError(null);
    setImporting(true);
    try {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith('.epub') && !lower.endsWith('.pdf')) {
          throw new Error(`O arquivo "${file.name}" deve estar no formato .epub ou .pdf.`);
        }
        const initialCats = selectedCategoryId ? [selectedCategoryId] : [];
        await sync.importBookFile(file, initialCats);
      }
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Não foi possível importar o arquivo.'
      );
    } finally {
      setImporting(false);
    }
  };

  const openReader = (book: Book, chapterIndex?: number, scrollRatio?: number) => {
    setReadingTarget({ book, chapterIndex, scrollRatio });
  };

  const liveReadingBook = readingTarget
    ? sync.books.find((b) => b.id === readingTarget.book.id) || readingTarget.book
    : null;

  const isAndroidLayout = sync.workspaceMode === 'android';

  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-[#0A0D14] text-[#0E1320] dark:text-[#E8EDF5] transition-colors">
      {isAndroidLayout ? (
        /* Android Native APK Layout */
        <div className="min-h-screen flex flex-col max-w-2xl mx-auto border-x border-[#E6E8EE] dark:border-[#1E2636] bg-[#F8F9FB] dark:bg-[#0A0D14]">
          <header className="sticky top-0 z-30 h-14 px-4 flex items-center justify-between gap-3 bg-white/90 dark:bg-[#0E131D]/90 backdrop-blur-md border-b border-[#E6E8EE] dark:border-[#1E2636]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#3B5BDB] flex items-center justify-center text-white font-display text-xs font-bold">
                L
              </div>
              <span className="text-base font-bold tracking-tight font-display whitespace-nowrap">
                Lumina
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => sync.setWorkspaceMode('windows')}
                title="Alternar para Estúdio Windows"
                aria-label="Alternar para Estúdio Windows"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleDark}
                aria-label={isDark ? 'Modo claro' : 'Modo noturno'}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2130] transition-colors cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 pt-5 pb-24">
            {activeSection === 'sync' ? (
              <SyncDevicesView
                user={sync.user}
                isSyncing={sync.isSyncing}
                syncError={sync.syncError}
                lastSyncedAt={sync.lastSyncedAt}
                detectedPlatform={sync.detectedPlatform}
                workspaceMode={sync.workspaceMode}
                onChangeWorkspaceMode={sync.setWorkspaceMode}
                onSignIn={sync.signInWithGoogle}
                onSignInWithEmail={sync.signInWithEmail}
                onSignUpWithEmail={sync.signUpWithEmail}
                onSignOut={sync.signOutUser}
                books={sync.books}
                categories={sync.categories}
                bookmarks={sync.bookmarks}
                onOpenReader={openReader}
              />
            ) : (
              <LibraryView
                books={sync.books}
                categories={sync.categories}
                bookmarks={sync.bookmarks}
                activeSection={activeSection}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                workspaceMode="android"
                onOpenReader={openReader}
                onOpenStudio={setStudioBook}
                onToggleFavorite={sync.toggleBookFavorite}
                onImportFiles={handleImportFiles}
                importing={importing}
                importError={importError}
              />
            )}
          </main>

          <MobileBottomNav
            activeSection={activeSection}
            onSelectSection={(sec) => {
              setSelectedCategoryId(null);
              setActiveSection(sec);
            }}
          />
        </div>
      ) : (
        /* Windows Desktop Tauri Studio Layout */
        <div className="min-h-screen flex">
          <div className="hidden lg:block h-screen sticky top-0">
            <Sidebar
              activeSection={activeSection}
              onSelectSection={setActiveSection}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              categories={sync.categories}
              books={sync.books}
              onOpenNewCategory={() => {
                setEditingCategory(null);
                setCategoryModalOpen(true);
              }}
              onEditCategory={(cat) => {
                setEditingCategory(cat);
                setCategoryModalOpen(true);
              }}
              isDark={isDark}
              onToggleDark={handleToggleDark}
              workspaceMode={sync.workspaceMode}
              onChangeWorkspaceMode={sync.setWorkspaceMode}
              isSignedIn={!!sync.user}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="h-16 px-6 lg:px-8 border-b border-[#E6E8EE] dark:border-[#1E2636] bg-white/85 dark:bg-[#0E131D]/85 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-8">
              <div className="flex items-center gap-3 min-w-0">
                <span className="lg:hidden text-lg font-bold font-display">Lumina</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {inTauri ? 'Lumina Desktop (Tauri)' : 'Estúdio Windows Desktop'}
                  <span aria-hidden="true"> · </span>
                  {sync.user ? `Sincronizado (${sync.user.displayName || 'Google'})` : 'Armazenamento local'}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => sync.setWorkspaceMode('android')}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] text-xs font-medium cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Android
                </button>
                <button
                  onClick={() => setActiveSection('sync')}
                  className="px-3.5 py-2 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] bg-white dark:bg-[#121722] hover:bg-slate-50 dark:hover:bg-[#1A2130] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Instaladores Tauri &amp; APK
                </button>
                {!sync.user && (
                  <button
                    onClick={sync.signInWithGoogle}
                    className="px-4 py-2 rounded-xl bg-[#3B5BDB] hover:bg-[#324EC9] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Conectar Google
                  </button>
                )}
              </div>
            </header>

            <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {activeSection === 'sync' ? (
                <SyncDevicesView
                  user={sync.user}
                  isSyncing={sync.isSyncing}
                  syncError={sync.syncError}
                  lastSyncedAt={sync.lastSyncedAt}
                  detectedPlatform={sync.detectedPlatform}
                  workspaceMode={sync.workspaceMode}
                  onChangeWorkspaceMode={sync.setWorkspaceMode}
                  onSignIn={sync.signInWithGoogle}
                  onSignInWithEmail={sync.signInWithEmail}
                  onSignUpWithEmail={sync.signUpWithEmail}
                  onSignOut={sync.signOutUser}
                  books={sync.books}
                  categories={sync.categories}
                  bookmarks={sync.bookmarks}
                  onOpenReader={openReader}
                />
              ) : (
                <LibraryView
                  books={sync.books}
                  categories={sync.categories}
                  bookmarks={sync.bookmarks}
                  activeSection={activeSection}
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                  workspaceMode="windows"
                  onOpenReader={openReader}
                  onOpenStudio={setStudioBook}
                  onToggleFavorite={sync.toggleBookFavorite}
                  onImportFiles={handleImportFiles}
                  importing={importing}
                  importError={importError}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="fixed bottom-20 lg:bottom-5 left-5 z-40 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          Modo Offline — Livros locais disponíveis para leitura
        </div>
      )}

      <CategoryManagerModal
        isOpen={categoryModalOpen}
        editingCategory={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={async (name, color, description) => {
          if (editingCategory) {
            await sync.updateCategory(editingCategory.id, name, color, description);
          } else {
            await sync.createCategory(name, color, description);
          }
        }}
        onDelete={async (catId) => {
          await sync.deleteCategory(catId);
          if (selectedCategoryId === catId) setSelectedCategoryId(null);
        }}
      />

      <BookStudioModal
        book={studioBook}
        categories={sync.categories}
        loadChapters={sync.loadBookChapters}
        onClose={() => setStudioBook(null)}
        onSave={sync.updateBookMetadata}
        onDelete={sync.deleteBook}
        onOpenReader={openReader}
      />

      {liveReadingBook && readingTarget && (
        <EpubReader
          book={liveReadingBook}
          initialChapterIndex={readingTarget.chapterIndex}
          initialScrollRatio={readingTarget.scrollRatio}
          preferences={sync.preferences}
          bookmarks={sync.bookmarks}
          loadChapters={sync.loadBookChapters}
          loadPdfBinary={sync.loadPdfBinary}
          onUpdatePreferences={sync.updatePreferences}
          onUpdateProgress={sync.updateBookProgress}
          onToggleFavorite={sync.toggleBookFavorite}
          onAddBookmark={sync.addBookmark}
          onUpdateBookmarkNote={sync.updateBookmarkNote}
          onDeleteBookmark={sync.deleteBookmark}
          onClose={() => setReadingTarget(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LuminaWorkspace />
    </ErrorBoundary>
  );
}
