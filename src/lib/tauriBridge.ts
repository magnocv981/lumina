import { invoke, isTauri } from '@tauri-apps/api/core';

export interface NativePlatformInfo {
  os: string;
  arch: string;
  runtime: string;
  appVersion: string;
}

export function isRunningInTauri(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export async function getNativePlatformInfo(): Promise<NativePlatformInfo | null> {
  if (!isRunningInTauri()) return null;
  try {
    return await invoke<NativePlatformInfo>('get_native_platform_info');
  } catch {
    return null;
  }
}

export async function saveNativeBackup(
  filename: string,
  payload: unknown
): Promise<{ savedPath?: string; downloaded?: boolean }> {
  const jsonContent = JSON.stringify(payload, null, 2);

  if (isRunningInTauri()) {
    const savedPath = await invoke<string>('save_library_backup', {
      filename,
      jsonContent,
    });
    return { savedPath };
  }

  // Fallback browser download in preview mode
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
  return { downloaded: true };
}
