import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import type { Resolver } from './botVerify';

/** Reverse/forward DNS through the desktop app; the browser build has no resolver, so bots stay "claimed". */
export const desktopResolver = (): Resolver | undefined => isTauriEnvironment()
  ? {
    reverse: (ip) => invokeTauriCommand<string[]>('dns_reverse', { ip }),
    forward: (host) => invokeTauriCommand<string[]>('dns_forward', { host }),
  }
  : undefined;
