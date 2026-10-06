import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrendingNow } from '@/services/trendingNow';
import * as tauri from '@/services/tauri';
import { MAX_FREE_FEED_BYTES } from '@/services/freeSerp';
import { rssFeed } from './fixtures/trendingNow';

const nativeResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  sourceUrl: 'https://trends.google.com/trending/rss?geo=PL',
  fetchedAt: '2026-10-06T00:00:00Z',
  body: rssFeed(),
  httpStatus: 200,
  error: null,
  ...overrides,
});

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.restoreAllMocks();
});

describe('Trending Now native transport', () => {
  it('uses the bounded Rust feed command in a Tauri window', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(nativeResponse());
    const snapshot = await fetchTrendingNow('native-project', ' pl ');
    expect(snapshot).toMatchObject({
      projectId: 'native-project', geo: 'PL', capturedAt: '2026-10-06T00:00:00Z',
      source: { kind: 'google-trends-rss', url: nativeResponse().sourceUrl },
    });
    expect(invoke).toHaveBeenCalledWith('fetch_public_feed', {
      feed: 'google-trends', geo: 'PL', keyword: '', language: 'en',
    });
  });

  it('surfaces blocked native responses without parsing an invented body', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(nativeResponse({
      status: 'blocked', body: null, httpStatus: 429, error: 'Public feed blocked by upstream (HTTP 429).',
    }));
    await expect(fetchTrendingNow('native-project')).rejects.toThrow(/blocked.*429/);
  });

  it('preserves a native error status and its observed HTTP detail', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(nativeResponse({
      status: 'error', body: null, httpStatus: 503, error: 'Public feed request failed (HTTP 503).',
    }));
    await expect(fetchTrendingNow('native-project')).rejects.toThrow(/error.*503/);
  });

  it.each([
    ['unknown status', { status: 'unexpected', expected: 'invalid status' }],
    ['non-string body', { body: 42, expected: 'invalid body' }],
    ['oversized body', { body: 'x'.repeat(MAX_FREE_FEED_BYTES + 1), expected: 'byte limit' }],
    ['invalid HTTP status', { httpStatus: 99, expected: 'invalid HTTP status' }],
    ['invalid timestamp', { fetchedAt: 'unknown', expected: 'invalid timestamp' }],
    ['error with a body', { status: 'error', httpStatus: 503, body: rssFeed(), expected: 'cannot contain a body' }],
    ['successful response without a body', { body: null, expected: 'Successful public feed response is incomplete' }],
  ])('rejects malformed native response: %s', async (_label, overrides) => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(nativeResponse(overrides) as never);
    await expect(fetchTrendingNow('native-project')).rejects.toThrow(overrides.expected);
  });

  it('rejects a native response whose source provenance is outside the whitelist', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(nativeResponse({ sourceUrl: 'https://evil.test/feed' }));
    await expect(fetchTrendingNow('native-project')).rejects.toThrow(/whitelist/);
  });
});
