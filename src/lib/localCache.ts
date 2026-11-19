import type { BookChapter } from '../types/library';

const DB_NAME = 'lumina-epub-cache';
const DB_VERSION = 2;
const STORE_CHAPTERS = 'chapters';
const STORE_PDFS = 'pdfFiles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
        db.createObjectStore(STORE_CHAPTERS, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: 'bookId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChaptersLocally(
  bookId: string,
  chapters: BookChapter[]
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHAPTERS, 'readwrite');
      const store = tx.objectStore(STORE_CHAPTERS);
      store.put({ bookId, chapters, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Falha ao salvar capítulos no cache local:', err);
  }
}

export async function getChaptersLocally(
  bookId: string
): Promise<BookChapter[] | null> {
  try {
    const db = await openDb();
    return await new Promise<BookChapter[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_CHAPTERS, 'readonly');
      const store = tx.objectStore(STORE_CHAPTERS);
      const req = store.get(bookId);
      req.onsuccess = () => {
        const result = req.result as { bookId: string; chapters: BookChapter[] } | undefined;
        resolve(result ? result.chapters : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falha ao ler capítulos do cache local:', err);
    return null;
  }
}

export async function savePdfBinaryLocally(
  bookId: string,
  bytes: ArrayBuffer
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readwrite');
      const store = tx.objectStore(STORE_PDFS);
      store.put({ bookId, bytes, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Falha ao salvar PDF no cache local:', err);
  }
}

export async function getPdfBinaryLocally(
  bookId: string
): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readonly');
      const store = tx.objectStore(STORE_PDFS);
      const req = store.get(bookId);
      req.onsuccess = () => {
        const result = req.result as { bookId: string; bytes: ArrayBuffer } | undefined;
        resolve(result ? result.bytes : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falha ao ler PDF do cache local:', err);
    return null;
  }
}

export async function deleteChaptersLocally(bookId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CHAPTERS, STORE_PDFS], 'readwrite');
      tx.objectStore(STORE_CHAPTERS).delete(bookId);
      tx.objectStore(STORE_PDFS).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Falha ao remover dados do cache local:', err);
  }
}
