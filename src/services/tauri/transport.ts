import { handleBrowserFallback } from './browserFallback';

export const isTauriEnvironment = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function invokeTauriCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  return handleBrowserFallback<T>(cmd, args);
}

