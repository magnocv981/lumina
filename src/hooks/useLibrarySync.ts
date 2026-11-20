import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  DEFAULT_PREFERENCES,
  SEED_BOOKMARKS,
  SEED_BOOKS,
  SEED_CATEGORIES,
  SEED_CHAPTERS,
} from '../data/seedLibrary';
import {
  deleteChaptersLocally,
  getChaptersLocally,
  getPdfBinaryLocally,
  saveChaptersLocally,
  savePdfBinaryLocally,
} from '../lib/localCache';
import { parseEpubFile } from '../lib/epubParser';
import { parsePdfFile } from '../lib/pdfParser';
import type {
  Book,
  BookChapter,
  Bookmark,
  Category,
  DevicePlatform,
  ReaderPreferences,
  WorkspaceMode,
} from '../types/library';

const LS_KEYS = {
  books: 'lumina_books_v1',
  categories: 'lumina_categories_v1',
  bookmarks: 'lumina_bookmarks_v1',
  prefs: 'lumina_prefs_v1',
};

function sanitizeId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  return clean || `id_${Date.now()}`;
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'Android';
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) return 'Windows Desktop';
  return 'Web';
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota warnings
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function useLibrarySync() {
  const detectedPlatform = detectDevicePlatform();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'android';
    return detectedPlatform === 'Android' ? 'android' : 'windows';
  });

  const activeDevice: DevicePlatform =
    workspaceMode === 'android' ? 'Android' : 'Windows Desktop';

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [preferences, setPreferences] = useState<ReaderPreferences>(() =>
    loadLocal(LS_KEYS.prefs, DEFAULT_PREFERENCES)
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    loadLocal(LS_KEYS.categories, SEED_CATEGORIES)
  );
  const [books, setBooks] = useState<Book[]>(() =>
    loadLocal(LS_KEYS.books, SEED_BOOKS)
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    loadLocal(LS_KEYS.bookmarks, SEED_BOOKMARKS)
  );

  const seededCloudForUid = useRef<string | null>(null);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.appTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveLocal(LS_KEYS.prefs, preferences);
  }, [preferences]);

  // Seed built-in chapters into IndexedDB on first boot
  useEffect(() => {
    (async () => {
      for (const [bookId, chaps] of Object.entries(SEED_CHAPTERS)) {
        const existing = await getChaptersLocally(bookId);
        if (!existing || existing.length === 0) {
          await saveChaptersLocally(bookId, chaps);
        }
      }
    })();
  }, []);

  // Save local snapshots whenever local state updates (offline cache)
  useEffect(() => {
    saveLocal(LS_KEYS.books, books);
  }, [books]);

  useEffect(() => {
    saveLocal(LS_KEYS.categories, categories);
  }, [categories]);

  useEffect(() => {
    saveLocal(LS_KEYS.bookmarks, bookmarks);
  }, [bookmarks]);

  // Auth listener + Firestore realtime sync
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        await testConnection();
      }
    });
    return () => unsubAuth();
  }, []);

  const ensureCloudInitialized = useCallback(
    async (uid: string, currentUser: User) => {
      if (seededCloudForUid.current === uid) return;
      seededCloudForUid.current = uid;
      setIsSyncing(true);

      const userPath = `users/${uid}`;
      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(
            userRef,
            stripUndefined({
              uid,
              displayName: (currentUser.displayName || 'Leitor Lumina').slice(0, 120),
              photoURL: currentUser.photoURL ? currentUser.photoURL.slice(0, 1500) : undefined,
              lastActiveDevice: activeDevice,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await updateDoc(userRef, {
            displayName: (currentUser.displayName || 'Leitor Lumina').slice(0, 120),
            lastActiveDevice: activeDevice,
            updatedAt: serverTimestamp(),
          });
        }

        const prefRef = doc(db, 'users', uid, 'preferences', 'reader');
        const prefSnap = await getDoc(prefRef);
        if (!prefSnap.exists()) {
          await setDoc(prefRef, {
            ownerId: uid,
            appTheme: preferences.appTheme,
            readerTheme: preferences.readerTheme,
            fontFamily: preferences.fontFamily,
            fontSize: preferences.fontSize,
            lineHeight: preferences.lineHeight,
            pageWidth: preferences.pageWidth,
            textAlign: preferences.textAlign,
            readingMode: preferences.readingMode || 'paginated',
            updatedAt: serverTimestamp(),
          });
        }

        // Seed starter library to cloud only if user has 0 books in Firestore
        const existingBooksSnap = await getDocs(
          query(collection(db, 'users', uid, 'books'), where('ownerId', '==', uid))
        );

        if (existingBooksSnap.empty) {
          const batch = writeBatch(db);
          const localCats = loadLocal<Category[]>(LS_KEYS.categories, SEED_CATEGORIES);
          for (const cat of localCats) {
            const catRef = doc(db, 'users', uid, 'categories', cat.id);
            batch.set(
              catRef,
              stripUndefined({
                id: cat.id,
                ownerId: uid,
                name: cat.name.slice(0, 60),
                color: cat.color.slice(0, 20),
                description: cat.description?.slice(0, 240),
                sortOrder: cat.sortOrder,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }

          const localBooks = loadLocal<Book[]>(LS_KEYS.books, SEED_BOOKS);
          for (const bk of localBooks) {
            const bkRef = doc(db, 'users', uid, 'books', bk.id);
            batch.set(
              bkRef,
              stripUndefined({
                id: bk.id,
                ownerId: uid,
                format: bk.format || 'epub',
                title: bk.title.slice(0, 200),
                author: bk.author.slice(0, 140),
                publisher: bk.publisher?.slice(0, 140),
                language: bk.language?.slice(0, 24),
                synopsis: bk.synopsis?.slice(0, 2000),
                notes: bk.notes?.slice(0, 4000),
                coverUrl: bk.coverUrl && bk.coverUrl.length <= 120000 ? bk.coverUrl : undefined,
                categoryIds: bk.categoryIds.slice(0, 10),
                isFavorite: bk.isFavorite,
                status: bk.status,
                progressPercent: bk.progressPercent,
                currentChapterIndex: bk.currentChapterIndex,
                scrollRatio: bk.scrollRatio,
                totalChapters: bk.totalChapters,
                lastDevice: bk.lastDevice,
                fileSizeBytes: bk.fileSizeBytes,
                hasCloudChapters: bk.hasCloudChapters,
                isBuiltIn: bk.isBuiltIn,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }

          await batch.commit();

          // Upload chapters for each seeded book (after parent book exists for Master Gate)
          for (const bk of localBooks) {
            const localChaps =
              (await getChaptersLocally(bk.id)) || SEED_CHAPTERS[bk.id] || [];
            if (localChaps.length > 0 && localChaps.length <= 80) {
              const chapBatch = writeBatch(db);
              for (const ch of localChaps) {
                if (ch.htmlContent.length > 440000) continue;
                const chId = `ch_${ch.index}`;
                const chRef = doc(db, 'users', uid, 'books', bk.id, 'chapters', chId);
                chapBatch.set(chRef, {
                  ownerId: uid,
                  bookId: bk.id,
                  index: ch.index,
                  title: ch.title.slice(0, 240),
                  htmlContent: ch.htmlContent,
                  wordCount: ch.wordCount,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              await chapBatch.commit();
            }
          }

          // Upload bookmarks after books exist
          const localBms = loadLocal<Bookmark[]>(LS_KEYS.bookmarks, SEED_BOOKMARKS);
          const bookIdSet = new Set(localBooks.map((b) => b.id));
          const bmBatch = writeBatch(db);
          let hasBm = false;
          for (const bm of localBms) {
            if (!bookIdSet.has(bm.bookId)) continue;
            hasBm = true;
            const bmRef = doc(db, 'users', uid, 'bookmarks', bm.id);
            bmBatch.set(
              bmRef,
              stripUndefined({
                id: bm.id,
                ownerId: uid,
                bookId: bm.bookId,
                chapterIndex: bm.chapterIndex,
                chapterTitle: bm.chapterTitle.slice(0, 240),
                scrollRatio: bm.scrollRatio,
                progressPercent: bm.progressPercent,
                excerpt: bm.excerpt?.slice(0, 600),
                note: bm.note?.slice(0, 1000),
                deviceName: bm.deviceName,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
          if (hasBm) {
            await bmBatch.commit();
          }
        }
        setLastSyncedAt(new Date());
        setSyncError(null);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Erro ao inicializar nuvem.');
        handleFirestoreError(err, OperationType.WRITE, userPath);
      } finally {
        setIsSyncing(false);
      }
    },
    [activeDevice, preferences]
  );

  // Attach realtime Firestore listeners when signed in
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    ensureCloudInitialized(uid, user).catch(() => {
      // handled by ErrorBoundary or syncError
    });

    const prefPath = `users/${uid}/preferences/reader`;
    const unsubPrefs = onSnapshot(
      doc(db, 'users', uid, 'preferences', 'reader'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ReaderPreferences;
          setPreferences({
            ownerId: uid,
            appTheme: data.appTheme,
            readerTheme: data.readerTheme,
            fontFamily: data.fontFamily,
            fontSize: data.fontSize,
            lineHeight: data.lineHeight,
            pageWidth: data.pageWidth,
            textAlign: data.textAlign,
            readingMode: data.readingMode || 'paginated',
          });
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, prefPath);
      }
    );

    const catsPath = `users/${uid}/categories`;
    const unsubCats = onSnapshot(
      query(collection(db, 'users', uid, 'categories'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Category)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setCategories(list);
        setLastSyncedAt(new Date());
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, catsPath);
      }
    );

    const booksPath = `users/${uid}/books`;
    const unsubBooks = onSnapshot(
      query(collection(db, 'users', uid, 'books'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Book);
        setBooks(list);
        setLastSyncedAt(new Date());
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, booksPath);
      }
    );

    const bmPath = `users/${uid}/bookmarks`;
    const unsubBms = onSnapshot(
      query(collection(db, 'users', uid, 'bookmarks'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Bookmark);
        setBookmarks(list);
        setLastSyncedAt(new Date());
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, bmPath);
      }
    );

    return () => {
      unsubPrefs();
      unsubCats();
      unsubBooks();
      unsubBms();
    };
  }, [authReady, user, ensureCloudInitialized]);

  const signInWithGoogle = async () => {
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-blocked')) {
        setSyncError(
          'O WebView nativo do Windows/Android bloqueia popups de navegador. Utilize a opção "Entrar com E-mail e Senha" logo abaixo para sincronizar de imediato.'
        );
      } else {
        setSyncError(msg || 'Falha ao autenticar com Google.');
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setSyncError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setSyncError('E-mail ou senha incorretos.');
      } else {
        setSyncError(msg || 'Erro ao autenticar com e-mail.');
      }
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    setSyncError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setSyncError('Este e-mail já está cadastrado. Alterne para a aba "Entrar".');
      } else if (msg.includes('weak-password')) {
        setSyncError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setSyncError(msg || 'Erro ao criar conta.');
      }
      throw err;
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    seededCloudForUid.current = null;
  };

  const updatePreferences = useCallback(
    async (partial: Partial<Omit<ReaderPreferences, 'ownerId' | 'updatedAt'>>) => {
      const next: ReaderPreferences = {
        ...preferences,
        ...partial,
        ownerId: user?.uid || 'local',
      };
      setPreferences(next);

      if (user) {
        const path = `users/${user.uid}/preferences/reader`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'preferences', 'reader'), {
            appTheme: next.appTheme,
            readerTheme: next.readerTheme,
            fontFamily: next.fontFamily,
            fontSize: next.fontSize,
            lineHeight: next.lineHeight,
            pageWidth: next.pageWidth,
            textAlign: next.textAlign,
            readingMode: next.readingMode || 'paginated',
            updatedAt: serverTimestamp(),
          });
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [preferences, user]
  );

  const loadBookChapters = useCallback(
    async (bookId: string): Promise<BookChapter[]> => {
      // 1. Check IndexedDB first for instant offline access
      const local = await getChaptersLocally(bookId);
      if (local && local.length > 0) {
        return [...local].sort((a, b) => a.index - b.index);
      }

      // 2. Built-in fallback
      if (SEED_CHAPTERS[bookId]) {
        await saveChaptersLocally(bookId, SEED_CHAPTERS[bookId]);
        return SEED_CHAPTERS[bookId];
      }

      // 3. Fetch from Firestore cloud chapters if signed in (cross-device Android <-> Windows)
      if (user) {
        const path = `users/${user.uid}/books/${bookId}/chapters`;
        try {
          const snap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'books', bookId, 'chapters'),
              where('ownerId', '==', user.uid)
            )
          );
          const cloudChapters = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<BookChapter, 'id'>) }))
            .sort((a, b) => a.index - b.index);
          if (cloudChapters.length > 0) {
            await saveChaptersLocally(bookId, cloudChapters);
            return cloudChapters;
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      }

      return [];
    },
    [user]
  );

  const loadPdfBinary = useCallback(async (bookId: string): Promise<ArrayBuffer | null> => {
    return getPdfBinaryLocally(bookId);
  }, []);

  const importBookFile = useCallback(
    async (file: File, initialCategoryIds: string[] = []): Promise<Book> => {
      const lowerName = file.name.toLowerCase();
      const isPdf = lowerName.endsWith('.pdf');
      const pdfParsed = isPdf ? await parsePdfFile(file) : null;
      const parsed = pdfParsed ?? (await parseEpubFile(file));
      const bookId = makeId('book');
      const uid = user?.uid || 'local';

      const chapters: BookChapter[] = parsed.chapters.map((ch) => ({
        id: `ch_${ch.index}`,
        ownerId: uid,
        bookId,
        index: ch.index,
        title: ch.title.slice(0, 240),
        htmlContent: ch.htmlContent.slice(0, 440000),
        wordCount: ch.wordCount,
      }));

      const canSyncChapters =
        chapters.length <= 200 &&
        chapters.every((c) => c.htmlContent.length <= 440000);

      const newBook: Book = {
        id: bookId,
        ownerId: uid,
        format: isPdf ? 'pdf' : 'epub',
        title: parsed.title.slice(0, 200),
        author: parsed.author.slice(0, 140),
        publisher: parsed.publisher?.slice(0, 140),
        language: parsed.language?.slice(0, 24) || 'pt-BR',
        synopsis: parsed.synopsis?.slice(0, 2000),
        notes: '',
        coverUrl: parsed.coverUrl && parsed.coverUrl.length <= 120000 ? parsed.coverUrl : undefined,
        categoryIds: initialCategoryIds.slice(0, 10),
        isFavorite: false,
        status: 'unread',
        progressPercent: 0,
        currentChapterIndex: 0,
        scrollRatio: 0,
        totalChapters: Math.max(1, chapters.length),
        lastDevice: activeDevice,
        fileSizeBytes: parsed.fileSizeBytes,
        hasCloudChapters: canSyncChapters,
        isBuiltIn: false,
      };

      if (pdfParsed) {
        await savePdfBinaryLocally(bookId, pdfParsed.rawBytes);
      }
      await saveChaptersLocally(bookId, chapters);
      setBooks((prev) => [newBook, ...prev]);

      if (user) {
        const bookPath = `users/${user.uid}/books/${bookId}`;
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'books', bookId),
            stripUndefined({
              ...newBook,
              ownerId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );

          if (canSyncChapters) {
            for (let i = 0; i < chapters.length; i += 40) {
              const slice = chapters.slice(i, i + 40);
              const batch = writeBatch(db);
              for (const ch of slice) {
                const chRef = doc(db, 'users', user.uid, 'books', bookId, 'chapters', ch.id);
                batch.set(chRef, {
                  ownerId: user.uid,
                  bookId,
                  index: ch.index,
                  title: ch.title,
                  htmlContent: ch.htmlContent,
                  wordCount: ch.wordCount,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              await batch.commit();
            }
          }
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, bookPath);
        }
      }

      return newBook;
    },
    [user, activeDevice]
  );

  const updateBookProgress = useCallback(
    async (
      bookId: string,
      currentChapterIndex: number,
      scrollRatio: number,
      progressPercent: number
    ) => {
      const clampedPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
      const clampedScroll = Math.max(0, Math.min(1, Number(scrollRatio.toFixed(3))));
      const nextStatus: Book['status'] =
        clampedPercent >= 98 ? 'completed' : clampedPercent > 0 || currentChapterIndex > 0 ? 'reading' : 'unread';

      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId
            ? {
                ...b,
                currentChapterIndex,
                scrollRatio: clampedScroll,
                progressPercent: clampedPercent,
                status: nextStatus,
                lastDevice: activeDevice,
              }
            : b
        )
      );

      if (user) {
        const path = `users/${user.uid}/books/${bookId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'books', bookId), {
            status: nextStatus,
            progressPercent: clampedPercent,
            currentChapterIndex,
            scrollRatio: clampedScroll,
            lastDevice: activeDevice,
            updatedAt: serverTimestamp(),
          });
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user, activeDevice]
  );

  const toggleBookFavorite = useCallback(
    async (bookId: string) => {
      const target = books.find((b) => b.id === bookId);
      if (!target) return;
      const nextFav = !target.isFavorite;

      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, isFavorite: nextFav } : b))
      );

      if (user) {
        const path = `users/${user.uid}/books/${bookId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'books', bookId), {
            isFavorite: nextFav,
            updatedAt: serverTimestamp(),
          });
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [books, user]
  );

  const updateBookMetadata = useCallback(
    async (
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
    ) => {
      const sanitized: Record<string, unknown> = {};
      if (updates.title !== undefined) sanitized.title = updates.title.trim().slice(0, 200) || 'Sem título';
      if (updates.author !== undefined) sanitized.author = updates.author.trim().slice(0, 140) || 'Autor desconhecido';
      if (updates.publisher !== undefined) sanitized.publisher = updates.publisher.trim().slice(0, 140);
      if (updates.language !== undefined) sanitized.language = updates.language.trim().slice(0, 24);
      if (updates.synopsis !== undefined) sanitized.synopsis = updates.synopsis.trim().slice(0, 2000);
      if (updates.notes !== undefined) sanitized.notes = updates.notes.trim().slice(0, 4000);
      if (updates.coverUrl !== undefined && updates.coverUrl.length <= 120000) sanitized.coverUrl = updates.coverUrl;
      if (updates.categoryIds !== undefined) sanitized.categoryIds = updates.categoryIds.slice(0, 10);
      if (updates.isFavorite !== undefined) sanitized.isFavorite = updates.isFavorite;
      if (updates.status !== undefined) sanitized.status = updates.status;

      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, ...sanitized } : b))
      );

      if (user) {
        const path = `users/${user.uid}/books/${bookId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'books', bookId), {
            ...sanitized,
            updatedAt: serverTimestamp(),
          });
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const deleteBook = useCallback(
    async (bookId: string) => {
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      setBookmarks((prev) => prev.filter((bm) => bm.bookId !== bookId));
      await deleteChaptersLocally(bookId);

      if (user) {
        const bookPath = `users/${user.uid}/books/${bookId}`;
        try {
          // Delete chapters & bookmarks linked to this book
          const chapsSnap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'books', bookId, 'chapters'),
              where('ownerId', '==', user.uid)
            )
          );
          const bmsSnap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'bookmarks'),
              where('ownerId', '==', user.uid)
            )
          );

          const batch = writeBatch(db);
          chapsSnap.docs.forEach((d) => batch.delete(d.ref));
          bmsSnap.docs
            .filter((d) => d.data().bookId === bookId)
            .forEach((d) => batch.delete(d.ref));
          batch.delete(doc(db, 'users', user.uid, 'books', bookId));
          await batch.commit();
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, bookPath);
        }
      }
    },
    [user]
  );

  const createCategory = useCallback(
    async (name: string, color: string, description?: string) => {
      const catId = makeId('cat');
      const newCat: Category = {
        id: catId,
        ownerId: user?.uid || 'local',
        name: name.trim().slice(0, 60) || 'Nova Categoria',
        color: color.slice(0, 20),
        description: description?.trim().slice(0, 240),
        sortOrder: categories.length + 1,
      };
      setCategories((prev) => [...prev, newCat]);

      if (user) {
        const path = `users/${user.uid}/categories/${catId}`;
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'categories', catId),
            stripUndefined({
              ...newCat,
              ownerId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      return newCat;
    },
    [categories.length, user]
  );

  const updateCategory = useCallback(
    async (categoryId: string, name: string, color: string, description?: string) => {
      const nextName = name.trim().slice(0, 60) || 'Categoria';
      const nextColor = color.slice(0, 20);
      const nextDesc = description?.trim().slice(0, 240);

      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, name: nextName, color: nextColor, description: nextDesc }
            : c
        )
      );

      if (user) {
        const path = `users/${user.uid}/categories/${categoryId}`;
        try {
          await updateDoc(
            doc(db, 'users', user.uid, 'categories', categoryId),
            stripUndefined({
              name: nextName,
              color: nextColor,
              description: nextDesc,
              updatedAt: serverTimestamp(),
            })
          );
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setBooks((prev) =>
        prev.map((b) => ({
          ...b,
          categoryIds: b.categoryIds.filter((id) => id !== categoryId),
        }))
      );

      if (user) {
        const path = `users/${user.uid}/categories/${categoryId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'categories', categoryId));
          const affectedBooks = books.filter((b) => b.categoryIds.includes(categoryId));
          for (const bk of affectedBooks) {
            await updateDoc(doc(db, 'users', user.uid, 'books', bk.id), {
              categoryIds: bk.categoryIds.filter((id) => id !== categoryId),
              updatedAt: serverTimestamp(),
            });
          }
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [books, user]
  );

  const addBookmark = useCallback(
    async (payload: {
      bookId: string;
      chapterIndex: number;
      chapterTitle: string;
      scrollRatio: number;
      progressPercent: number;
      excerpt?: string;
      note?: string;
    }) => {
      const bmId = makeId('bm');
      const newBm: Bookmark = {
        id: bmId,
        ownerId: user?.uid || 'local',
        bookId: payload.bookId,
        chapterIndex: payload.chapterIndex,
        chapterTitle: payload.chapterTitle.slice(0, 240) || 'Capítulo',
        scrollRatio: Math.max(0, Math.min(1, Number(payload.scrollRatio.toFixed(3)))),
        progressPercent: Math.max(0, Math.min(100, Math.round(payload.progressPercent))),
        excerpt: payload.excerpt?.trim().slice(0, 600),
        note: payload.note?.trim().slice(0, 1000),
        deviceName: activeDevice,
      };
      setBookmarks((prev) => [newBm, ...prev]);

      if (user) {
        const path = `users/${user.uid}/bookmarks/${bmId}`;
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'bookmarks', bmId),
            stripUndefined({
              ...newBm,
              ownerId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      return newBm;
    },
    [user, activeDevice]
  );

  const updateBookmarkNote = useCallback(
    async (bookmarkId: string, note: string) => {
      const cleanNote = note.trim().slice(0, 1000);
      setBookmarks((prev) =>
        prev.map((bm) => (bm.id === bookmarkId ? { ...bm, note: cleanNote } : bm))
      );

      if (user) {
        const path = `users/${user.uid}/bookmarks/${bookmarkId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'bookmarks', bookmarkId), {
            note: cleanNote,
            updatedAt: serverTimestamp(),
          });
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const deleteBookmark = useCallback(
    async (bookmarkId: string) => {
      setBookmarks((prev) => prev.filter((bm) => bm.id !== bookmarkId));
      if (user) {
        const path = `users/${user.uid}/bookmarks/${bookmarkId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', bookmarkId));
          setLastSyncedAt(new Date());
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [user]
  );

  return {
    user,
    authReady,
    isSyncing,
    syncError,
    lastSyncedAt,
    workspaceMode,
    setWorkspaceMode,
    activeDevice,
    detectedPlatform,
    preferences,
    updatePreferences,
    categories,
    books,
    bookmarks,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
    loadBookChapters,
    loadPdfBinary,
    importBookFile,
    updateBookProgress,
    toggleBookFavorite,
    updateBookMetadata,
    deleteBook,
    createCategory,
    updateCategory,
    deleteCategory,
    addBookmark,
    updateBookmarkNote,
    deleteBookmark,
  };
}
