import { describe, expect, it, vi } from 'vitest';
import {
  CAUSAL_STORAGE_EVENT,
  dispatchCausalStorageEvent,
  installCausalStorageInterceptor,
} from '@/services/causalMarket/storageEvents';

describe('causal storage events interceptor', () => {
  it('dispatches custom event on local storage actions', () => {
    let captured: string | null = null;
    const listener = (event: Event) => {
      captured = (event as CustomEvent<{ key: string | null }>).detail?.key ?? null;
    };
    window.addEventListener(CAUSAL_STORAGE_EVENT, listener);

    localStorage.setItem('test-key', 'value');
    expect(captured).toBe('test-key');

    localStorage.removeItem('test-key');
    expect(captured).toBe('test-key');

    localStorage.clear();
    expect(captured).toBeNull();

    window.removeEventListener(CAUSAL_STORAGE_EVENT, listener);
  });

  it('safely handles non-browser environments without throwing', () => {
    const originalWindow = globalThis.window;
    const originalStorage = globalThis.Storage;
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('Storage', undefined);
    expect(() => dispatchCausalStorageEvent('key')).not.toThrow();
    expect(() => installCausalStorageInterceptor()).not.toThrow();
    vi.stubGlobal('window', originalWindow);
    vi.stubGlobal('Storage', originalStorage);
  });
});
