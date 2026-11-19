import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  BookmarkPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileText,
  List,
  Moon,
  ScrollText,
  Star,
  Sun,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { loadPdfDocument } from '../lib/pdfParser';
import type {
  Book,
  BookChapter,
  Bookmark,
  FontFamilyOption,
  PageWidthOption,
  ReaderPreferences,
  ReaderTheme,
  ReadingMode,
  TextAlignOption,
} from '../types/library';

interface EpubReaderProps {
  book: Book;
  initialChapterIndex?: number;
  initialScrollRatio?: number;
  preferences: ReaderPreferences;
  bookmarks: Bookmark[];
  loadChapters: (bookId: string) => Promise<BookChapter[]>;
  loadPdfBinary: (bookId: string) => Promise<ArrayBuffer | null>;
  onUpdatePreferences: (
    partial: Partial<Omit<ReaderPreferences, 'ownerId' | 'updatedAt'>>
  ) => Promise<void>;
  onUpdateProgress: (
    bookId: string,
    chapterIndex: number,
    scrollRatio: number,
    progressPercent: number
  ) => Promise<void>;
  onToggleFavorite: (bookId: string) => Promise<void>;
  onAddBookmark: (payload: {
    bookId: string;
    chapterIndex: number;
    chapterTitle: string;
    scrollRatio: number;
    progressPercent: number;
    excerpt?: string;
    note?: string;
  }) => Promise<Bookmark>;
  onUpdateBookmarkNote: (bookmarkId: string, note: string) => Promise<void>;
  onDeleteBookmark: (bookmarkId: string) => Promise<void>;
  onClose: () => void;
}

const READER_THEMES: Record<
  ReaderTheme,
  { label: string; bg: string; surface: string; text: string; muted: string; border: string }
> = {
  light: {
    label: 'Claro',
    bg: '#FFFFFF',
    surface: '#F8F9FB',
    text: '#161B26',
    muted: '#64748B',
    border: '#E6E8EE',
  },
  sepia: {
    label: 'Sépia',
    bg: '#F7F1E5',
    surface: '#EFE6D5',
    text: '#382D20',
    muted: '#7A6855',
    border: '#DFD3BE',
  },
  night: {
    label: 'Noturno',
    bg: '#0E131D',
    surface: '#141B29',
    text: '#D4DCE8',
    muted: '#8D99AE',
    border: '#20293B',
  },
  oled: {
    label: 'OLED',
    bg: '#040609',
    surface: '#0B0F17',
    text: '#BAC4D1',
    muted: '#778291',
    border: '#18202E',
  },
};

const FONT_FAMILIES: Array<{ id: FontFamilyOption; label: string; css: string }> = [
  { id: 'source-serif', label: 'Source Serif', css: "'Source Serif 4', Georgia, serif" },
  { id: 'lora', label: 'Lora', css: "'Lora', Georgia, serif" },
  { id: 'jakarta', label: 'Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif" },
  { id: 'dyslexic', label: 'Hyperlegible', css: "'Atkinson Hyperlegible', sans-serif" },
  { id: 'mono', label: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
];

const PAGE_WIDTHS: Array<{ id: PageWidthOption; label: string; maxWidth: string }> = [
  { id: 'narrow', label: 'Estreito', maxWidth: '580px' },
  { id: 'medium', label: 'Confortável', maxWidth: '720px' },
  { id: 'wide', label: 'Amplo', maxWidth: '900px' },
];

export const EpubReader: React.FC<EpubReaderProps> = ({
  book,
  initialChapterIndex,
  initialScrollRatio,
  preferences,
  bookmarks,
  loadChapters,
  loadPdfBinary,
  onUpdatePreferences,
  onUpdateProgress,
  onToggleFavorite,
  onAddBookmark,
  onUpdateBookmarkNote,
  onDeleteBookmark,
  onClose,
}) => {
  const isPdfBook = book.format === 'pdf';
  const readingMode: ReadingMode = preferences.readingMode || 'paginated';

  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [chapterIndex, setChapterIndex] = useState(
    initialChapterIndex ?? book.currentChapterIndex ?? 0
  );
  const [scrollRatio, setScrollRatio] = useState(
    initialScrollRatio ?? book.scrollRatio ?? 0
  );
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'toc' | 'typography' | 'bookmarks'>('none');
  const [bookmarkNoteDraft, setBookmarkNoteDraft] = useState('');
  const [showAddBookmarkBox, setShowAddBookmarkBox] = useState(false);
  const [justBookmarked, setJustBookmarked] = useState(false);

  // PDF Canvas state
  const [pdfDoc, setPdfDoc] = useState<Awaited<ReturnType<typeof loadPdfDocument>>['doc'] | null>(null);
  const [pdfRenderMode, setPdfRenderMode] = useState<'canvas' | 'reflow'>('canvas');
  const [pdfZoom, setPdfZoom] = useState(1.1);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Horizontal paginated swipe state
  const [subPageIndex, setSubPageIndex] = useState(0);
  const [totalSubPages, setTotalSubPages] = useState(1);
  const [pageColumnWidth, setPageColumnWidth] = useState(640);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingSwipe, setIsDraggingSwipe] = useState(false);

  const swipeStartRef = useRef<{ x: number; y: number; time: number; lastDx: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const paginatedViewportRef = useRef<HTMLDivElement>(null);
  const paginatedFrameRef = useRef<HTMLDivElement>(null);
  const paginatedTrackRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pendingScrollRatioRef = useRef<number | null>(
    initialScrollRatio ?? book.scrollRatio ?? 0
  );

  const theme = READER_THEMES[preferences.readerTheme] || READER_THEMES.night;
  const fontCss =
    FONT_FAMILIES.find((f) => f.id === preferences.fontFamily)?.css ||
    FONT_FAMILIES[0].css;
  const maxWidthCss =
    PAGE_WIDTHS.find((w) => w.id === preferences.pageWidth)?.maxWidth || '720px';

  const bookBookmarks = useMemo(
    () => bookmarks.filter((bm) => bm.bookId === book.id),
    [bookmarks, book.id]
  );

  // Load chapters (both ePub and PDF reflow text) + raw PDF binary if PDF
  useEffect(() => {
    let active = true;
    let pdfHandle: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;
    setLoadingChapters(true);
    setPdfDoc(null);

    (async () => {
      const chaps = await loadChapters(book.id);
      if (!active) return;
      setChapters(chaps);
      setChapterIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, chaps.length - 1))));

      if (isPdfBook) {
        const bytes = await loadPdfBinary(book.id);
        if (bytes && active) {
          try {
            pdfHandle = await loadPdfDocument(bytes);
            if (active) {
              setPdfDoc(pdfHandle.doc);
              setPdfRenderMode('canvas');
            }
          } catch {
            if (active) setPdfRenderMode('reflow');
          }
        } else if (active) {
          setPdfRenderMode('reflow');
        }
      }
    })().finally(() => {
      if (active) setLoadingChapters(false);
    });

    return () => {
      active = false;
      if (pdfHandle) {
        pdfHandle.destroy().catch(() => {});
      }
    };
  }, [book.id, isPdfBook, loadChapters, loadPdfBinary]);

  const currentChapter = chapters[chapterIndex];
  const isCanvasPdfActive = isPdfBook && pdfRenderMode === 'canvas' && !!pdfDoc;

  // Render current PDF page onto high-DPI canvas
  useEffect(() => {
    if (!isCanvasPdfActive || !pdfDoc || !pdfCanvasRef.current) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      try {
        const pageNumber = Math.max(1, Math.min(pdfDoc.numPages, chapterIndex + 1));
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !pdfCanvasRef.current) return;

        const containerWidth = Math.max(280, Math.min(860, (paginatedViewportRef.current?.clientWidth || 680) - 32));
        const unscaled = page.getViewport({ scale: 1 });
        const fitScale = (containerWidth / Math.max(1, unscaled.width)) * pdfZoom;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: fitScale });

        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
      } catch {
        // Ignore cancelled renders on rapid swipe
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [isCanvasPdfActive, pdfDoc, chapterIndex, pdfZoom, pageColumnWidth]);

  // Measure horizontal pagination pages for ePub / Reflow text
  const recalculatePagination = useCallback(() => {
    if (readingMode !== 'paginated' || isCanvasPdfActive) return;
    const frameEl = paginatedFrameRef.current;
    const trackEl = paginatedTrackRef.current;
    if (!frameEl || !trackEl) return;

    const colWidth = Math.max(240, frameEl.clientWidth);
    setPageColumnWidth(colWidth);

    requestAnimationFrame(() => {
      if (!trackEl) return;
      const gap = 48;
      const totalWidth = trackEl.scrollWidth;
      const pages = Math.max(1, Math.round((totalWidth + gap) / (colWidth + gap)));
      setTotalSubPages(pages);

      if (pendingScrollRatioRef.current !== null) {
        const targetSub = Math.min(
          pages - 1,
          Math.max(0, Math.round(pendingScrollRatioRef.current * (pages - 1)))
        );
        pendingScrollRatioRef.current = null;
        setSubPageIndex(targetSub);
      } else {
        setSubPageIndex((prev) => Math.min(prev, pages - 1));
      }
    });
  }, [readingMode, isCanvasPdfActive]);

  useEffect(() => {
    recalculatePagination();
    window.addEventListener('resize', recalculatePagination);
    return () => window.removeEventListener('resize', recalculatePagination);
  }, [
    recalculatePagination,
    chapterIndex,
    loadingChapters,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.fontFamily,
    preferences.pageWidth,
    preferences.textAlign,
  ]);

  // Restore scroll position in scroll mode
  useEffect(() => {
    if (readingMode !== 'scroll' || loadingChapters || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const targetRatio = pendingScrollRatioRef.current ?? 0;
    pendingScrollRatioRef.current = null;

    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.round(maxScroll * targetRatio);
    });
  }, [readingMode, chapterIndex, loadingChapters, chapters.length]);

  const totalCount = isCanvasPdfActive && pdfDoc ? pdfDoc.numPages : chapters.length;

  const computeTotalProgress = useCallback(
    (chIdx: number, chScroll: number): number => {
      if (totalCount === 0) return book.progressPercent;
      if (isCanvasPdfActive) {
        return Math.min(100, Math.max(0, Math.round(((chIdx + 1) / totalCount) * 100)));
      }
      const slice = 1 / totalCount;
      const ratio = (chIdx + Math.max(0, Math.min(1, chScroll))) * slice;
      return Math.min(100, Math.max(0, Math.round(ratio * 100)));
    },
    [totalCount, isCanvasPdfActive, book.progressPercent]
  );

  const scheduleProgressSync = useCallback(
    (chIdx: number, chScroll: number) => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = window.setTimeout(() => {
        const totalPct = computeTotalProgress(chIdx, chScroll);
        onUpdateProgress(book.id, chIdx, chScroll, totalPct);
      }, 450);
    },
    [book.id, computeTotalProgress, onUpdateProgress]
  );

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const ratio = Math.max(0, Math.min(1, el.scrollTop / maxScroll));
    setScrollRatio(ratio);
    scheduleProgressSync(chapterIndex, ratio);
  };

  const goToChapter = useCallback(
    (nextIdx: number, targetScroll = 0) => {
      if (nextIdx < 0 || nextIdx >= totalCount) return;
      pendingScrollRatioRef.current = targetScroll;
      setChapterIndex(nextIdx);
      setScrollRatio(targetScroll);
      if (targetScroll === 0) setSubPageIndex(0);
      const totalPct = computeTotalProgress(nextIdx, targetScroll);
      onUpdateProgress(book.id, nextIdx, targetScroll, totalPct);
    },
    [totalCount, book.id, computeTotalProgress, onUpdateProgress]
  );

  const goNextPage = useCallback(() => {
    if (isCanvasPdfActive || readingMode === 'scroll') {
      goToChapter(chapterIndex + 1, 0);
      return;
    }
    if (subPageIndex < totalSubPages - 1) {
      const nextSub = subPageIndex + 1;
      const ratio = totalSubPages > 1 ? nextSub / (totalSubPages - 1) : 0;
      setSubPageIndex(nextSub);
      setScrollRatio(ratio);
      scheduleProgressSync(chapterIndex, ratio);
    } else if (chapterIndex < totalCount - 1) {
      goToChapter(chapterIndex + 1, 0);
    }
  }, [
    isCanvasPdfActive,
    readingMode,
    subPageIndex,
    totalSubPages,
    chapterIndex,
    totalCount,
    goToChapter,
    scheduleProgressSync,
  ]);

  const goPrevPage = useCallback(() => {
    if (isCanvasPdfActive || readingMode === 'scroll') {
      goToChapter(chapterIndex - 1, 0);
      return;
    }
    if (subPageIndex > 0) {
      const prevSub = subPageIndex - 1;
      const ratio = totalSubPages > 1 ? prevSub / (totalSubPages - 1) : 0;
      setSubPageIndex(prevSub);
      setScrollRatio(ratio);
      scheduleProgressSync(chapterIndex, ratio);
    } else if (chapterIndex > 0) {
      goToChapter(chapterIndex - 1, 1);
    }
  }, [
    isCanvasPdfActive,
    readingMode,
    subPageIndex,
    totalSubPages,
    chapterIndex,
    goToChapter,
    scheduleProgressSync,
  ]);

  // Touch & Pointer Horizontal Swipe Handlers ("Deslizar a página")
  const handleTouchStart = (e: React.TouchEvent) => {
    if (readingMode !== 'paginated' || e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now(), lastDx: 0 };
    setIsDraggingSwipe(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || readingMode !== 'paginated' || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
      swipeStartRef.current.lastDx = dx;
      setDragOffsetX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (!swipeStartRef.current || readingMode !== 'paginated') return;
    const dx = swipeStartRef.current.lastDx;
    swipeStartRef.current = null;
    setIsDraggingSwipe(false);
    setDragOffsetX(0);

    if (dx < -40) {
      goNextPage();
    } else if (dx > 40) {
      goPrevPage();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readingMode !== 'paginated' || e.pointerType === 'touch') return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now(), lastDx: 0 };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!swipeStartRef.current || readingMode !== 'paginated' || e.pointerType === 'touch') return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNextPage();
      else goPrevPage();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (activeDrawer !== 'none') setActiveDrawer('none');
        else onClose();
      } else if (e.key === 'ArrowRight') {
        goNextPage();
      } else if (e.key === 'ArrowLeft') {
        goPrevPage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDrawer, goNextPage, goPrevPage, onClose]);

  const extractVisibleExcerpt = (): string => {
    if (!currentChapter) return '';
    const temp = document.createElement('div');
    temp.innerHTML = currentChapter.htmlContent;
    const text = (temp.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const startIdx = Math.floor(text.length * Math.min(0.85, scrollRatio));
    return text.slice(startIdx, startIdx + 180).trim();
  };

  const handleCreateBookmark = async () => {
    const titleLabel =
      currentChapter?.title || (isPdfBook ? `Página ${chapterIndex + 1}` : 'Capítulo');
    const totalPct = computeTotalProgress(chapterIndex, scrollRatio);
    await onAddBookmark({
      bookId: book.id,
      chapterIndex,
      chapterTitle: titleLabel,
      scrollRatio,
      progressPercent: totalPct,
      excerpt: extractVisibleExcerpt(),
      note: bookmarkNoteDraft.trim() || undefined,
    });
    setBookmarkNoteDraft('');
    setShowAddBookmarkBox(false);
    setJustBookmarked(true);
    window.setTimeout(() => setJustBookmarked(false), 1800);
  };

  const isReaderNight =
    preferences.readerTheme === 'night' || preferences.readerTheme === 'oled';
  const totalProgressPercent = computeTotalProgress(chapterIndex, scrollRatio);

  // Adaptive CSS filter for PDF Canvas in Night/Sepia/OLED themes
  const pdfCanvasFilter =
    preferences.readerTheme === 'oled'
      ? 'invert(0.94) hue-rotate(180deg) contrast(1.05)'
      : preferences.readerTheme === 'night'
      ? 'invert(0.88) hue-rotate(180deg) brightness(0.95)'
      : preferences.readerTheme === 'sepia'
      ? 'sepia(0.32) brightness(0.97)'
      : 'none';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-200 select-none sm:select-text"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      {/* Top Reader Toolbar */}
      <header
        className="h-14 shrink-0 px-3 sm:px-6 flex items-center justify-between gap-2 border-b backdrop-blur-md"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            aria-label="Voltar para biblioteca"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate font-display">{book.title}</h1>
            <p className="text-[11px] truncate" style={{ color: theme.muted }}>
              {isPdfBook ? `PDF · Página ${chapterIndex + 1} de ${totalCount}` : currentChapter?.title || book.author}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Toggle: Paginado (Deslizar) vs Rolagem */}
          <button
            onClick={() =>
              onUpdatePreferences({
                readingMode: readingMode === 'paginated' ? 'scroll' : 'paginated',
              })
            }
            title={
              readingMode === 'paginated'
                ? 'Modo Deslizar Página ativo (toque para Rolagem)'
                : 'Modo Rolagem ativo (toque para Deslizar Página)'
            }
            aria-label="Alternar modo deslizar página ou rolagem"
            className="min-w-[40px] min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity cursor-pointer"
          >
            {readingMode === 'paginated' ? (
              <Columns2 className="w-4 h-4 text-[#3B5BDB]" />
            ) : (
              <ScrollText className="w-4 h-4" />
            )}
            <span className="hidden md:inline">
              {readingMode === 'paginated' ? 'Deslizar' : 'Rolagem'}
            </span>
          </button>

          {/* PDF Canvas vs Reflow Text switcher when PDF binary is cached */}
          {isPdfBook && pdfDoc && (
            <button
              onClick={() =>
                setPdfRenderMode((m) => (m === 'canvas' ? 'reflow' : 'canvas'))
              }
              title={
                pdfRenderMode === 'canvas'
                  ? 'Mudar para Texto Ajustável'
                  : 'Mudar para PDF Original'
              }
              className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium hover:opacity-80 cursor-pointer"
            >
              {pdfRenderMode === 'canvas' ? (
                <FileText className="w-4 h-4 text-[#3B5BDB]" />
              ) : (
                <BookOpen className="w-4 h-4 text-[#3B5BDB]" />
              )}
              <span className="hidden md:inline">
                {pdfRenderMode === 'canvas' ? 'Original' : 'Texto'}
              </span>
            </button>
          )}

          <button
            onClick={() => onToggleFavorite(book.id)}
            aria-label={book.isFavorite ? 'Remover favorito' : 'Favoritar livro'}
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          >
            <Star
              className={`w-4 h-4 ${
                book.isFavorite ? 'fill-amber-500 text-amber-500' : ''
              }`}
            />
          </button>

          <button
            onClick={() => setShowAddBookmarkBox((v) => !v)}
            aria-label="Marcar página atual"
            title="Marcar página atual"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
            style={{ color: justBookmarked ? '#3B5BDB' : undefined }}
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              setActiveDrawer((d) => (d === 'bookmarks' ? 'none' : 'bookmarks'))
            }
            aria-label="Abrir marcadores"
            title="Marcadores salvos"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer relative"
          >
            <BookmarkIcon className="w-4 h-4" />
            {bookBookmarks.length > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#3B5BDB]" />
            )}
          </button>

          <button
            onClick={() =>
              onUpdatePreferences({
                readerTheme: isReaderNight ? 'light' : 'night',
              })
            }
            aria-label={isReaderNight ? 'Modo claro de leitura' : 'Modo noturno de leitura'}
            title={isReaderNight ? 'Modo claro' : 'Modo noturno'}
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          >
            {isReaderNight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() =>
              setActiveDrawer((d) => (d === 'typography' ? 'none' : 'typography'))
            }
            aria-label="Ajustar fonte e aparência"
            title="Tipografia e Aparência"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveDrawer((d) => (d === 'toc' ? 'none' : 'toc'))}
            aria-label="Sumário"
            title="Sumário"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Quick Add Bookmark Bar */}
      {showAddBookmarkBox && (
        <div
          className="px-4 py-3 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <input
            type="text"
            maxLength={300}
            value={bookmarkNoteDraft}
            onChange={(e) => setBookmarkNoteDraft(e.target.value)}
            placeholder="Adicionar nota opcional ao marcador..."
            className="flex-1 rounded-xl px-3.5 py-2 text-sm bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setShowAddBookmarkBox(false)}
              className="px-3 py-2 rounded-xl text-xs font-medium opacity-75 hover:opacity-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateBookmark}
              className="px-4 py-2 rounded-xl bg-[#3B5BDB] text-white text-xs font-medium hover:bg-[#324EC9] transition-colors cursor-pointer"
            >
              Salvar marcador ({totalProgressPercent}%)
            </button>
          </div>
        </div>
      )}

      {/* Main Reading Viewport */}
      <div className="relative flex-1 overflow-hidden flex">
        {loadingChapters ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm font-medium">
              {isPdfBook ? 'Carregando páginas do PDF...' : 'Carregando capítulos do ePub...'}
            </p>
          </div>
        ) : isCanvasPdfActive ? (
          /* PDF Canvas Viewer with Touch Swipe & Zoom */
          <div
            ref={paginatedViewportRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="flex-1 overflow-auto flex flex-col items-center justify-start p-4 sm:p-6 relative touch-pan-y"
          >
            {/* Floating Zoom Controls for PDF */}
            <div
              className="sticky top-2 z-10 mb-3 inline-flex items-center gap-1 px-2 py-1 rounded-xl border backdrop-blur-md"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <button
                onClick={() => setPdfZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                aria-label="Diminuir zoom do PDF"
                className="p-1.5 rounded-lg hover:opacity-75 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium px-2 tabular-nums">
                {Math.round(pdfZoom * 100)}%
              </span>
              <button
                onClick={() => setPdfZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
                aria-label="Aumentar zoom do PDF"
                className="p-1.5 rounded-lg hover:opacity-75 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div
              className="rounded-xl overflow-hidden shadow-lg"
              style={{
                transform: `translateX(${dragOffsetX}px)`,
                transition: isDraggingSwipe ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <canvas
                ref={pdfCanvasRef}
                style={{ filter: pdfCanvasFilter }}
                className="block max-w-full"
              />
            </div>

            {/* Tap Edges on Mobile/Desktop */}
            <button
              onClick={goPrevPage}
              aria-label="Página anterior"
              className="hidden sm:block fixed left-0 top-14 bottom-14 w-12 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            />
            <button
              onClick={goNextPage}
              aria-label="Próxima página"
              className="hidden sm:block fixed right-0 top-14 bottom-14 w-12 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            />
          </div>
        ) : !currentChapter ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <p className="text-base font-semibold">Conteúdo não disponível neste dispositivo</p>
            <p className="text-sm max-w-md" style={{ color: theme.muted }}>
              Este livro excedeu o limite de sincronização na nuvem ou ainda não foi baixado localmente.
            </p>
          </div>
        ) : readingMode === 'paginated' ? (
          /* Paginated Horizontal Swipe Mode ("Deslizar a página") */
          <div
            ref={paginatedViewportRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="flex-1 overflow-hidden relative flex justify-center py-6 sm:py-10 touch-pan-y"
          >
            {/* Subtle left/right tap zones for instant page turn */}
            <button
              onClick={goPrevPage}
              aria-label="Página anterior"
              className="absolute left-0 inset-y-0 w-10 sm:w-16 z-10 cursor-pointer"
            />
            <button
              onClick={goNextPage}
              aria-label="Próxima página"
              className="absolute right-0 inset-y-0 w-10 sm:w-16 z-10 cursor-pointer"
            />

            <div className="w-full h-full px-5 sm:px-10 flex justify-center">
              <div
                ref={paginatedFrameRef}
                className="w-full h-full overflow-hidden"
                style={{ maxWidth: maxWidthCss }}
              >
                <div
                  ref={paginatedTrackRef}
                  className="h-full epub-prose"
                  style={{
                    columnWidth: `${pageColumnWidth}px`,
                    columnGap: '48px',
                    columnFill: 'auto',
                    fontFamily: fontCss,
                    fontSize: `${preferences.fontSize}px`,
                    lineHeight: preferences.lineHeight,
                    textAlign: preferences.textAlign as TextAlignOption,
                    transform: `translateX(calc(-${subPageIndex} * (${pageColumnWidth + 48}px) + ${dragOffsetX}px))`,
                    transition: isDraggingSwipe
                      ? 'none'
                      : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <header className="mb-6 pb-4 border-b" style={{ borderColor: theme.border }}>
                    <p className="text-xs font-medium mb-1 tabular-nums" style={{ color: theme.muted }}>
                      {isPdfBook ? 'Página' : 'Capítulo'} {chapterIndex + 1} de {chapters.length}
                    </p>
                    <h2 className="text-xl sm:text-2xl font-semibold !mt-0 !mb-0 font-display tracking-tight">
                      {currentChapter.title}
                    </h2>
                  </header>

                  <div
                    dangerouslySetInnerHTML={{ __html: currentChapter.htmlContent }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Continuous Vertical Scroll Mode */
          <main
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 sm:px-10 py-10 sm:py-14"
          >
            <article
              className="mx-auto epub-prose pb-16"
              style={{
                maxWidth: maxWidthCss,
                fontFamily: fontCss,
                fontSize: `${preferences.fontSize}px`,
                lineHeight: preferences.lineHeight,
                textAlign: preferences.textAlign as TextAlignOption,
              }}
            >
              <header className="mb-10 pb-5 border-b" style={{ borderColor: theme.border }}>
                <p className="text-xs font-medium mb-1.5 tabular-nums" style={{ color: theme.muted }}>
                  {isPdfBook ? 'Página' : 'Capítulo'} {chapterIndex + 1} de {chapters.length}
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold !mt-0 !mb-0 font-display tracking-tight">
                  {currentChapter.title}
                </h2>
              </header>

              <div
                dangerouslySetInnerHTML={{ __html: currentChapter.htmlContent }}
              />
            </article>
          </main>
        )}

        {/* Side Drawer */}
        {activeDrawer !== 'none' && (
          <aside
            className="w-full sm:w-88 shrink-0 border-l overflow-y-auto p-5 space-y-5 absolute sm:relative inset-y-0 right-0 z-20"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold font-display">
                {activeDrawer === 'typography'
                  ? 'Tipografia e Leitura'
                  : activeDrawer === 'toc'
                  ? isPdfBook
                    ? 'Páginas'
                    : 'Sumário'
                  : `Marcadores (${bookBookmarks.length})`}
              </h3>
              <button
                onClick={() => setActiveDrawer('none')}
                aria-label="Fechar painel"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDrawer === 'typography' && (
              <div className="space-y-6 text-sm">
                {/* Reading Mode: Paginated Swipe vs Scroll */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium" style={{ color: theme.muted }}>
                    Navegação da página
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdatePreferences({ readingMode: 'paginated' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                        readingMode === 'paginated' ? 'border-[#3B5BDB] bg-[#3B5BDB]/10' : ''
                      }`}
                      style={{ borderColor: readingMode === 'paginated' ? '#3B5BDB' : theme.border }}
                    >
                      <Columns2 className="w-3.5 h-3.5" />
                      Deslizar página
                    </button>
                    <button
                      onClick={() => onUpdatePreferences({ readingMode: 'scroll' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                        readingMode === 'scroll' ? 'border-[#3B5BDB] bg-[#3B5BDB]/10' : ''
                      }`}
                      style={{ borderColor: readingMode === 'scroll' ? '#3B5BDB' : theme.border }}
                    >
                      <ScrollText className="w-3.5 h-3.5" />
                      Rolagem
                    </button>
                  </div>
                </div>

                {/* Reading Theme */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium" style={{ color: theme.muted }}>
                    Tema da página
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(READER_THEMES) as ReaderTheme[]).map((tKey) => {
                      const t = READER_THEMES[tKey];
                      const active = preferences.readerTheme === tKey;
                      return (
                        <button
                          key={tKey}
                          onClick={() => onUpdatePreferences({ readerTheme: tKey })}
                          className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                            active ? 'ring-2 ring-[#3B5BDB]' : ''
                          }`}
                          style={{
                            backgroundColor: t.bg,
                            color: t.text,
                            borderColor: t.border,
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: t.bg, borderColor: t.muted }}
                          />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium" style={{ color: theme.muted }}>
                    Tipo de letra
                  </span>
                  <div className="space-y-1.5">
                    {FONT_FAMILIES.map((font) => {
                      const active = preferences.fontFamily === font.id;
                      return (
                        <button
                          key={font.id}
                          onClick={() => onUpdatePreferences({ fontFamily: font.id })}
                          className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            active ? 'border-[#3B5BDB] bg-[#3B5BDB]/10' : ''
                          }`}
                          style={{
                            borderColor: active ? '#3B5BDB' : theme.border,
                            fontFamily: font.css,
                          }}
                        >
                          <span>{font.label}</span>
                          <span className="text-[11px] opacity-60">Aa Bb</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: theme.muted }}>Tamanho da fonte</span>
                    <span className="font-medium tabular-nums">{preferences.fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        onUpdatePreferences({
                          fontSize: Math.max(14, preferences.fontSize - 1),
                        })
                      }
                      className="min-w-[42px] min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer"
                      style={{ borderColor: theme.border }}
                    >
                      A-
                    </button>
                    <input
                      type="range"
                      min={14}
                      max={28}
                      step={1}
                      value={preferences.fontSize}
                      onChange={(e) =>
                        onUpdatePreferences({ fontSize: Number(e.target.value) })
                      }
                      className="flex-1 accent-[#3B5BDB]"
                    />
                    <button
                      onClick={() =>
                        onUpdatePreferences({
                          fontSize: Math.min(28, preferences.fontSize + 1),
                        })
                      }
                      className="min-w-[42px] min-h-[40px] rounded-xl border text-sm font-semibold cursor-pointer"
                      style={{ borderColor: theme.border }}
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Line Height */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: theme.muted }}>Espaçamento entre linhas</span>
                    <span className="font-medium tabular-nums">{preferences.lineHeight.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.3}
                    max={2.2}
                    step={0.1}
                    value={preferences.lineHeight}
                    onChange={(e) =>
                      onUpdatePreferences({ lineHeight: Number(e.target.value) })
                    }
                    className="w-full accent-[#3B5BDB]"
                  />
                </div>

                {/* Page Width */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium" style={{ color: theme.muted }}>
                    Largura da coluna
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAGE_WIDTHS.map((w) => {
                      const active = preferences.pageWidth === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => onUpdatePreferences({ pageWidth: w.id })}
                          className={`py-2 px-2 rounded-xl border text-xs font-medium cursor-pointer ${
                            active ? 'border-[#3B5BDB] bg-[#3B5BDB]/10' : ''
                          }`}
                          style={{ borderColor: active ? '#3B5BDB' : theme.border }}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Text Align */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium" style={{ color: theme.muted }}>
                    Alinhamento
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['left', 'justify'] as TextAlignOption[]).map((align) => {
                      const active = preferences.textAlign === align;
                      return (
                        <button
                          key={align}
                          onClick={() => onUpdatePreferences({ textAlign: align })}
                          className={`py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                            active ? 'border-[#3B5BDB] bg-[#3B5BDB]/10' : ''
                          }`}
                          style={{ borderColor: active ? '#3B5BDB' : theme.border }}
                        >
                          {align === 'left' ? 'Esquerda' : 'Justificado'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeDrawer === 'toc' && (
              <div className="divide-y" style={{ borderColor: theme.border }}>
                {chapters.map((ch) => {
                  const active = ch.index === chapterIndex;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        goToChapter(ch.index, 0);
                        setActiveDrawer('none');
                      }}
                      className="w-full py-3 text-left flex items-center justify-between gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span
                        className={`text-xs ${active ? 'font-semibold text-[#3B5BDB]' : ''}`}
                      >
                        {ch.title}
                      </span>
                      <span className="text-[11px] tabular-nums shrink-0" style={{ color: theme.muted }}>
                        {ch.wordCount} p.
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeDrawer === 'bookmarks' && (
              <div className="space-y-3">
                <button
                  onClick={handleCreateBookmark}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#3B5BDB] text-white text-xs font-medium hover:bg-[#324EC9] transition-colors cursor-pointer"
                >
                  Marcar posição atual ({totalProgressPercent}%)
                </button>

                {bookBookmarks.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: theme.muted }}>
                    Nenhum marcador salvo neste livro ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bookBookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="p-3 rounded-xl border space-y-2"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => {
                              goToChapter(bm.chapterIndex, bm.scrollRatio);
                              setActiveDrawer('none');
                            }}
                            className="text-left flex-1 min-w-0 cursor-pointer"
                          >
                            <p className="text-xs font-semibold truncate hover:text-[#3B5BDB]">
                              {bm.chapterTitle}
                            </p>
                            <p className="text-[11px] tabular-nums" style={{ color: theme.muted }}>
                              {bm.progressPercent}% · {bm.deviceName}
                            </p>
                          </button>
                          <button
                            onClick={() => onDeleteBookmark(bm.id)}
                            aria-label="Excluir marcador"
                            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {bm.excerpt && (
                          <p className="text-xs italic opacity-80 line-clamp-2">
                            “{bm.excerpt}”
                          </p>
                        )}

                        <input
                          type="text"
                          defaultValue={bm.note || ''}
                          placeholder="Adicionar nota..."
                          onBlur={(e) => {
                            if (e.target.value !== (bm.note || '')) {
                              onUpdateBookmarkNote(bm.id, e.target.value);
                            }
                          }}
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-[#3B5BDB]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Reading Progress & Swipe Controls */}
      <footer
        className="h-14 shrink-0 px-3 sm:px-6 flex items-center justify-between gap-4 border-t"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <button
          onClick={goPrevPage}
          disabled={chapterIndex <= 0 && (isCanvasPdfActive || readingMode === 'scroll' || subPageIndex <= 0)}
          className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-35 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {readingMode === 'paginated' ? 'Página anterior' : 'Capítulo anterior'}
          </span>
          <span className="sm:hidden">Anterior</span>
        </button>

        <div className="flex-1 max-w-md flex flex-col items-center gap-1">
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
            <div
              className="h-full bg-[#3B5BDB] transition-all duration-200"
              style={{ width: `${totalProgressPercent}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: theme.muted }}>
            {totalProgressPercent}% ·{' '}
            {isCanvasPdfActive
              ? `Pág. ${chapterIndex + 1}/${Math.max(1, totalCount)}`
              : readingMode === 'paginated'
              ? `Pág. ${subPageIndex + 1}/${totalSubPages} (Cap. ${chapterIndex + 1}/${Math.max(1, totalCount)})`
              : `Cap. ${chapterIndex + 1}/${Math.max(1, totalCount)}`}
          </span>
        </div>

        <button
          onClick={goNextPage}
          disabled={
            chapterIndex >= totalCount - 1 &&
            (isCanvasPdfActive || readingMode === 'scroll' || subPageIndex >= totalSubPages - 1)
          }
          className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-35 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span className="hidden sm:inline">
            {readingMode === 'paginated' ? 'Próxima página' : 'Próximo capítulo'}
          </span>
          <span className="sm:hidden">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
