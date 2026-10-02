import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecureSaveQueue } from '@/stores/settings/secureSaveQueue';
import { DEFAULT_CONFIG, dataForSeoSecretNameFor, googleMetricsSecretNameFor, readStoredLanguage } from '@/stores/settings/defaults';
import { applyThemeToDOM } from '@/stores/settings/theme';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); document.documentElement.className = ''; });

describe('settings preferences', () => {
  it('reads only supported stored languages', () => {
    expect(readStoredLanguage()).toBe('en');
    localStorage.setItem('seomi_language', 'de');
    expect(readStoredLanguage()).toBe('de');
    expect(DEFAULT_CONFIG).toMatchObject({ theme: 'dark', request_timeout_secs: 15, max_redirects: 10, verify_ssl: true });
  });

  it('scopes secret names to a safe project ID', () => {
    expect(dataForSeoSecretNameFor('login', 'p-1')).toBe('dataforseo_login_p-1');
    expect(googleMetricsSecretNameFor('p-1')).toBe('google_metrics_api_key_p-1');
    for (const id of ['', 'a/b', 'x'.repeat(81), '../p']) {
      expect(() => dataForSeoSecretNameFor('password', id)).toThrow();
      expect(() => googleMetricsSecretNameFor(id)).toThrow();
    }
  });
});

describe('secure save queue', () => {
  it('runs writes for one key in order even when an earlier write fails', async () => {
    const queue = createSecureSaveQueue();
    const order: string[] = [];
    const failed = queue.enqueue('k', async () => { order.push('a'); throw new Error('a failed'); });
    const next = queue.enqueue('k', async () => { order.push('b'); });
    await expect(failed).rejects.toThrow('a failed');
    await next;
    expect(order).toEqual(['a', 'b']);
  });

  it('tracks the latest revision per key and pending queues', async () => {
    const queue = createSecureSaveQueue();
    const first = queue.begin('k');
    const second = queue.begin('k');
    expect([queue.isLatest('k', first), queue.isLatest('k', second), queue.isLatest('other', 1)]).toEqual([false, true, false]);
    const save = queue.enqueue('k', async () => undefined);
    expect(queue.pending).toBe(1);
    await save;
    queue.settle('k', Promise.resolve());
    expect(queue.pending).toBe(1);
    queue.settle('k', save);
    expect(queue.pending).toBe(0);
  });
});

describe('theme application', () => {
  it('sets exactly one theme class, following the OS for system', () => {
    applyThemeToDOM('light');
    expect(document.documentElement.className).toBe('light');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    applyThemeToDOM('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
