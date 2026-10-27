import { describe, expect, it, vi } from 'vitest';
import {
  CAUSAL_STORAGE_EVENT,
  dispatchCausalStorageEvent,
  installCausalStorageInterceptor,
} from '@/services/causalMarket/storageEvents';

describe('causal storage events interceptor', () => {
  it('dispatches custom event on local storage actions but ignores session storage', () => {
    let captured: string | null = null;
    let dispatchCount = 0;
    const listener = (event: Event) => {
      dispatchCount++;
      captured = (event as CustomEvent<{ key: string | null }>).detail?.key ?? null;
    };
    window.addEventListener(CAUSAL_STORAGE_EVENT, listener);

    localStorage.setItem('test-key', 'value');
    expect(captured).toBe('test-key');
    expect(dispatchCount).toBe(1);

    sessionStorage.setItem('session-key', 'value');
    sessionStorage.removeItem('session-key');
    expect(dispatchCount).toBe(1);

    sessionStorage.clear();
    expect(dispatchCount).toBe(1);

    localStorage.removeItem('test-key');
    expect(captured).toBe('test-key');
    expect(dispatchCount).toBe(2);

    localStorage.clear();
    expect(captured).toBeNull();
    expect(dispatchCount).toBe(3);

    window.removeEventListener(CAUSAL_STORAGE_EVENT, listener);
  });

  it('safely handles non-browser environments and frozen prototypes without throwing', () => {
    const originalWindow = globalThis.window;
    const originalStorage = globalThis.Storage;
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('Storage', undefined);
    expect(() => dispatchCausalStorageEvent('key')).not.toThrow();
    expect(() => installCausalStorageInterceptor()).not.toThrow();
    vi.stubGlobal('window', originalWindow);
    vi.stubGlobal('Storage', originalStorage);

    installCausalStorageInterceptor();
    installCausalStorageInterceptor();
  });
});
