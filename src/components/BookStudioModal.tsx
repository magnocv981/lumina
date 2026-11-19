import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  ImagePlus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { exportBookAsEpub } from '../lib/epubParser';
import type { Book, BookChapter, Category, ReadingStatus } from '../types/library';

interface BookStudioModalProps {
  book: Book | null;
  categories: Category[];
  loadChapters: (bookId: string) => Promise<BookChapter[]>;
  onClose: () => void;
  onSave: (
    bookId: string,
    updates: Partial<
      Pick<
        Book,
        | 'title'
        | 'author'
        | 'publisher'
        | 'language'
        | 'synopsis'
        | 'notes'
        | 'coverUrl'
        | 'categoryIds'
        | 'isFavorite'
        | 'status'
      >
    >
  ) => Promise<void>;
  onDelete: (bookId: string) => Promise<void>;
  onOpenReader: (book: Book, chapterIndex?: number) => void;
}

export const BookStudioModal: React.FC<BookStudioModalProps> = ({
  book,
  categories,
  loadChapters,
  onClose,
  onSave,
  onDelete,
  onOpenReader,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [synopsis, setSynopsis] = useState('');
  const [notes, setNotes] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [status, setStatus] = useState<ReadingStatus>('unread');
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!book) return;
    setTitle(book.title);
    setAuthor(book.author);
    setPublisher(book.publisher || '');
    setLanguage(book.language || 'pt-BR');
    setSynopsis(book.synopsis || '');
    setNotes(book.notes || '');
    setCoverUrl(book.coverUrl);
    setCategoryIds(book.categoryIds || []);
    setIsFavorite(book.isFavorite);
    setStatus(book.status);
    setConfirmDelete(false);

    loadChapters(book.id).then(setChapters).catch(() => setChapters([]));
  }, [book, loadChapters]);

  if (!book) return null;

  const toggleCategory = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : prev.length < 10
        ? [...prev, catId]
        : prev
    );
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 360 / (img.width || 360));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        setCoverUrl(compressed);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(book.id, {
        title,
        author,
        publisher,
        language,
        synopsis,
        notes,
        coverUrl,
        categoryIds,
        isFavorite,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleExportEpub = async () => {
    setExporting(true);
    try {
      const chaps = chapters.length > 0 ? chapters : await loadChapters(book.id);
      const blob = await exportBookAsEpub(
        { ...book, title, author, publisher, language, synopsis },
        chaps
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'livro'}.epub`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141923] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-display truncate">
              Estúdio de Biblioteca · Edição Avançada
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {book.progressPercent}% lido · Último dispositivo: {book.lastDevice} · {book.totalChapters} capítulos
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportEpub}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exportando...' : 'Exportar ePub'}
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar editor"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left Column: Cover + Status + Chapters */}
            <div className="md:col-span-4 space-y-5">
              <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 relative group">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                    <BookOpen className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                      {title}
                    </span>
                  </div>
                )}

                <label className="absolute inset-x-3 bottom-3 py-2 px-3 rounded-xl bg-slate-900/85 text-white text-xs font-medium flex items-center justify-center gap-1.5 opacity-95 hover:bg-slate-900 transition-colors cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Alterar capa
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsFavorite((v) => !v)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    isFavorite
                      ? 'border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span>Livro favorito</span>
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Estado de leitura
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReadingStatus)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  >
                    <option value="unread">Não iniciado</option>
                    <option value="reading">Em leitura</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>
              </div>

              {/* Chapter outline preview */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Índice de capítulos ({chapters.length})
                </span>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {chapters.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReader(book, ch.index);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                        {ch.title}
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {ch.wordCount} p.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Metadata, Categories & Editorial Notes */}
            <div className="md:col-span-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Título do livro
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Autor(a)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Editora / Edição
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Idioma
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Categorias personalizadas
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#3B5BDB] bg-[#3B5BDB]/10 text-[#3B5BDB] dark:text-[#748FFC]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                  {categories.length === 0 && (
                    <span className="text-xs text-slate-400">
                      Crie categorias no painel lateral para classificar este livro.
                    </span>
                  )}
                </div>
              </div>

              {/* Synopsis */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sinopse
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Resumo da obra..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                />
              </div>

              {/* Personal Study Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Anotações pessoais da biblioteca (sincronizadas entre Windows e Android)
                </label>
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Registre observações, fichamentos ou comentários sobre a edição..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover livro
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(true);
                      await onDelete(book.id);
                      setSaving(false);
                      onClose();
                    }}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Confirmar exclusão
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#3B5BDB] hover:bg-[#364FC7] disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
