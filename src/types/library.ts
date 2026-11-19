export type AppTheme = 'light' | 'dark';
export type ReaderTheme = 'light' | 'sepia' | 'night' | 'oled';
export type FontFamilyOption = 'source-serif' | 'lora' | 'jakarta' | 'dyslexic' | 'mono';
export type PageWidthOption = 'narrow' | 'medium' | 'wide';
export type TextAlignOption = 'left' | 'justify';
export type ReadingMode = 'paginated' | 'scroll';
export type BookFormat = 'epub' | 'pdf';
export type ReadingStatus = 'unread' | 'reading' | 'completed';
export type DevicePlatform = 'Windows Desktop' | 'Android' | 'Web';
export type WorkspaceMode = 'windows' | 'android';
export type ActiveNavSection = 'library' | 'reading' | 'favorites' | 'sync';

export interface ReaderPreferences {
  ownerId: string;
  appTheme: AppTheme;
  readerTheme: ReaderTheme;
  fontFamily: FontFamilyOption;
  fontSize: number;
  lineHeight: number;
  pageWidth: PageWidthOption;
  textAlign: TextAlignOption;
  readingMode?: ReadingMode;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  description?: string;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookChapter {
  id: string;
  ownerId: string;
  bookId: string;
  index: number;
  title: string;
  htmlContent: string;
  wordCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Book {
  id: string;
  ownerId: string;
  format?: BookFormat;
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  synopsis?: string;
  notes?: string;
  coverUrl?: string;
  categoryIds: string[];
  isFavorite: boolean;
  status: ReadingStatus;
  progressPercent: number;
  currentChapterIndex: number;
  scrollRatio: number;
  totalChapters: number;
  lastDevice: DevicePlatform;
  fileSizeBytes?: number;
  hasCloudChapters: boolean;
  isBuiltIn: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Bookmark {
  id: string;
  ownerId: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  scrollRatio: number;
  progressPercent: number;
  excerpt?: string;
  note?: string;
  deviceName: DevicePlatform;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  lastActiveDevice: DevicePlatform;
  createdAt?: unknown;
  updatedAt?: unknown;
}
