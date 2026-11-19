import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bookmark as BookmarkIcon,
  CheckCircle2,
  Cloud,
  Download,
  HardDrive,
  LogOut,
  Monitor,
  Smartphone,
  Terminal,
} from 'lucide-react';
import {
  getNativePlatformInfo,
  isRunningInTauri,
  saveNativeBackup,
  type NativePlatformInfo,
} from '../lib/tauriBridge';
import type {
  Book,
  Bookmark,
  Category,
  DevicePlatform,
  WorkspaceMode,
} from '../types/library';

interface SyncDevicesViewProps {
  user: User | null;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: Date | null;
  detectedPlatform: DevicePlatform;
  workspaceMode: WorkspaceMode;
  onChangeWorkspaceMode: (mode: WorkspaceMode) => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  books: Book[];
  categories: Category[];
  bookmarks: Bookmark[];
  onOpenReader: (book: Book, chapterIndex?: number, scrollRatio?: number) => void;
}

export const SyncDevicesView: React.FC<SyncDevicesViewProps> = ({
  user,
  isSyncing,
  syncError,
  lastSyncedAt,
  detectedPlatform,
  workspaceMode,
  onChangeWorkspaceMode,
  onSignIn,
  onSignOut,
  books,
  categories,
  bookmarks,
  onOpenReader,
}) => {
  const [nativeInfo, setNativeInfo] = useState<NativePlatformInfo | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const inTauri = isRunningInTauri();

  useEffect(() => {
    getNativePlatformInfo().then(setNativeInfo);
  }, []);

  const recentBooks = [...books]
    .filter((b) => b.progressPercent > 0 || b.status === 'reading')
    .sort((a, b) => b.progressPercent - a.progressPercent)
    .slice(0, 6);

  const handleBackup = async () => {
    setBackupMessage(null);
    const result = await saveNativeBackup(
      `lumina_biblioteca_${new Date().toISOString().slice(0, 10)}.json`,
      {
        exportedAt: new Date().toISOString(),
        books,
        categories,
        bookmarks,
      }
    );
    if (result.savedPath) {
      setBackupMessage(`Backup salvo nativamente em: ${result.savedPath}`);
    } else {
      setBackupMessage('Backup da biblioteca baixado em formato JSON.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0E1320] dark:text-white font-display">
          Sincronização &amp; Aplicativos Nativos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Conecte sua conta para sincronizar biblioteca, categorias, favoritos e página atual entre o instalador Tauri no Windows e o APK nativo no Android.
        </p>
      </div>

      {/* Cloud Sync Account Card */}
      <section className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#3B5BDB]/10 text-[#3B5BDB] dark:text-[#829BFF] flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0E1320] dark:text-white font-display">
                {user ? user.displayName || 'Conta Conectada' : 'Sincronização em Tempo Real (Firebase)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user
                  ? `${user.email} · ${isSyncing ? 'Sincronizando...' : 'Conectado em tempo real'}`
                  : 'Entre com sua conta Google nos dois dispositivos para manter tudo sincronizado.'}
              </p>
            </div>
          </div>

          {user ? (
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130] transition-colors self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Desconectar
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-[#324EC9] text-white text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer"
            >
              Entrar com Google
            </button>
          )}
        </div>

        {syncError && (
          <p className="text-xs text-red-600 dark:text-red-400">{syncError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#1B2230]">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <HardDrive className="w-4 h-4 text-[#3B5BDB]" />
            <span>
              Ambiente ativo:{' '}
              <strong className="font-medium text-slate-900 dark:text-white">
                {nativeInfo
                  ? `${nativeInfo.runtime} (${nativeInfo.arch})`
                  : inTauri
                  ? 'Tauri Nativo'
                  : `Web Preview · ${detectedPlatform}`}
              </strong>
            </span>
          </div>

          {lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sincronizado às {lastSyncedAt.toLocaleTimeString('pt-BR')}</span>
            </div>
          )}
        </div>
      </section>

      {/* Native Tauri Windows + Android APK Installers */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Monitor className="w-5 h-5 text-[#3B5BDB]" />
              <h3 className="text-base font-semibold text-[#0E1320] dark:text-white font-display">
                Instalador Windows (Tauri)
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              .exe / .msi
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Projeto Tauri v2 configurado em <code className="font-mono text-[11px]">src-tauri/</code> com instalador NSIS/MSI para Windows e associação direta de arquivos <code className="font-mono text-[11px]">.epub</code>.
          </p>

          <div className="rounded-xl bg-[#F2F4F8] dark:bg-[#0B0F17] p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2 overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 shrink-0 text-[#3B5BDB]" />
            <span className="whitespace-nowrap">npm run tauri:build:win</span>
          </div>

          <button
            onClick={() => onChangeWorkspaceMode('windows')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              workspaceMode === 'windows'
                ? 'bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320]'
                : 'border border-[#E6E8EE] dark:border-[#242E42] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130]'
            }`}
          >
            {workspaceMode === 'windows' ? 'Estúdio Windows ativo' : 'Alternar para Estúdio Windows'}
          </button>
        </div>

        <div className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-[#3B5BDB]" />
              <h3 className="text-base font-semibold text-[#0E1320] dark:text-white font-display">
                Android Nativo (APK)
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              .apk
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Suporte nativo Tauri v2 Mobile (<code className="font-mono text-[11px]">com.lumina.epubreader</code>) e workflow GitHub Actions pronto para gerar o arquivo <code className="font-mono text-[11px]">.apk</code> instalável no Android.
          </p>

          <div className="rounded-xl bg-[#F2F4F8] dark:bg-[#0B0F17] p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2 overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 shrink-0 text-[#3B5BDB]" />
            <span className="whitespace-nowrap">npm run tauri:android:init &amp;&amp; npm run tauri:build:apk</span>
          </div>

          <button
            onClick={() => onChangeWorkspaceMode('android')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              workspaceMode === 'android'
                ? 'bg-[#0E1320] dark:bg-white text-white dark:text-[#0E1320]'
                : 'border border-[#E6E8EE] dark:border-[#242E42] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130]'
            }`}
          >
            {workspaceMode === 'android' ? 'Visualização Android ativa' : 'Pré-visualizar Modo Android'}
          </button>
        </div>
      </section>

      {/* Local Backup & Cross-Device Progress */}
      <section className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#0E1320] dark:text-white font-display">
              Progresso Recente &amp; Backup Local
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exporte sua organização de biblioteca, categorias e marcadores a qualquer momento.
            </p>
          </div>
          <button
            onClick={handleBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130] transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Backup (.json)
          </button>
        </div>

        {backupMessage && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{backupMessage}</p>
        )}

        {recentBooks.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comece a ler um livro para acompanhar o progresso sincronizado entre seus dispositivos.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1B2230]">
            {recentBooks.map((bk) => (
              <div
                key={bk.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {bk.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Última leitura em {bk.lastDevice} · Capítulo {bk.currentChapterIndex + 1} · {bk.progressPercent}%
                  </p>
                </div>
                <button
                  onClick={() => onOpenReader(bk)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1A2130] hover:bg-slate-200 dark:hover:bg-[#242E42] text-xs font-medium text-slate-900 dark:text-white transition-colors shrink-0 cursor-pointer"
                >
                  Retomar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bookmarks Overview */}
      <section className="rounded-3xl border border-[#E6E8EE] dark:border-[#1E2636] bg-white dark:bg-[#121722] p-6 space-y-4">
        <h3 className="text-base font-semibold text-[#0E1320] dark:text-white font-display">
          Marcadores Sincronizados ({bookmarks.length})
        </h3>
        {bookmarks.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum marcador salvo até o momento.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1B2230]">
            {bookmarks.slice(0, 8).map((bm) => {
              const parentBook = books.find((b) => b.id === bm.bookId);
              if (!parentBook) return null;
              return (
                <div
                  key={bm.id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-white">
                      <BookmarkIcon className="w-3.5 h-3.5 text-[#3B5BDB] shrink-0" />
                      <span className="truncate">{parentBook.title} · {bm.chapterTitle}</span>
                    </div>
                    {bm.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{bm.note}</p>
                    )}
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {bm.progressPercent}% · Marcado no {bm.deviceName}
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenReader(parentBook, bm.chapterIndex, bm.scrollRatio)}
                    className="px-3 py-1.5 rounded-xl border border-[#E6E8EE] dark:border-[#242E42] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2130] shrink-0 cursor-pointer"
                  >
                    Ir ao trecho
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
