import { describe, expect, it, vi } from 'vitest';
import { fetchFreeSerp, fetchPublicFeed } from '@/services/publicFeedTransport';
import { bingSerpFeedUrl } from '@/services/freeSerp';

const base = { sourceUrl: bingSerpFeedUrl('x', 'PL', 'pl'), fetchedAt: '2026-10-06T10:00:00Z' };
const invoke = (value: unknown) => vi.fn().mockResolvedValue(value);
const valid = (overrides: Record<string, unknown> = {}) => ({ status: 'ok', ...base, body: '<rss/>', httpStatus: 200, error: null, ...overrides });

describe('public feed transport safety contracts', () => {
  it('rejects malformed native responses and unsafe provenance', async () => {
    for (const value of [null, { ...valid(), status: 'unknown' }, { ...valid(), sourceUrl: undefined }, { ...valid(), fetchedAt: 'later' }, { ...valid(), httpStatus: 99 }, { ...valid(), body: 1 }, { ...valid(), error: 'unexpected' }]) {
      await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'pl' }, invoke(value))).rejects.toThrow();
    }
    await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'pl' }, invoke({ ...valid(), sourceUrl: 'https://evil.test/' }))).rejects.toThrow(/whitelist/);
  });

  it('requires complete success and explicit unavailable errors', async () => {
    const request = { feed: 'bing-serp' as const, geo: 'PL', keyword: 'x', language: 'pl' };
    for (const value of [valid({ body: null }), valid({ httpStatus: null }), valid({ httpStatus: 500 }), valid({ error: 'bad' }), { ...base, status: 'blocked', body: '<rss/>', httpStatus: 429, error: 'blocked' }, { ...base, status: 'error', body: null, httpStatus: 500, error: '' }]) {
      await expect(fetchPublicFeed(request, invoke(value))).rejects.toThrow();
    }
    await expect(fetchPublicFeed(request, invoke({ ...base, status: 'error', body: undefined, error: 'offline' }))).resolves.toMatchObject({ httpStatus: null, body: null });
  });

  it('enforces request validation before IPC and payload bounds after IPC', async () => {
    const spy = vi.fn();
    await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'POL', keyword: 'x', language: 'pl' }, spy)).rejects.toThrow(/country/);
    await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'p' }, spy)).rejects.toThrow(/language/);
    await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'PL', keyword: 'x'.repeat(501), language: 'pl' }, spy)).rejects.toThrow(/too long/);
    expect(spy).not.toHaveBeenCalled();
    await expect(fetchPublicFeed({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'pl' }, invoke(valid({ body: 'x'.repeat(1_048_577) })))).rejects.toThrow(/byte limit/);
  });

  it('classifies an invalid RSS document as an explicit parse error', async () => {
    const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'pl' }, invoke(valid({ body: '<html>no rss</html>' })));
    expect(outcome).toMatchObject({ status: 'error', result: null, response: { body: null, error: expect.stringMatching(/Bing RSS/) } });
  });

  it('formats non-Error native failures without leaking a body', async () => {
    const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: 'PL', keyword: 'x', language: 'pl' }, vi.fn().mockRejectedValue('offline'));
    expect(outcome.response.error).toBe('offline');
  });
});
