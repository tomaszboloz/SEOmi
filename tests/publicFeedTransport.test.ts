import { describe, expect, it, vi } from 'vitest';
import { fetchFreeSerp, fetchPublicFeed, FREE_SERP_PARTIAL_REASON } from '@/services/publicFeedTransport';
import { bingSerpFeedUrl } from '@/services/freeSerp';

const rss = '<rss><channel><item><title>Result</title><link>https://example.test/a?utm_source=x</link></item></channel></rss>';
const ok = (body = rss) => ({ status: 'ok', sourceUrl: bingSerpFeedUrl('seo audit', 'PL', 'pl'), fetchedAt: '2026-10-06T10:00:00Z', body, httpStatus: 200, error: null });
const invokeWith = (value: unknown) => vi.fn().mockResolvedValue(value);

describe('native public feed transport', () => {
  it('invokes the bounded Tauri command with normalized Bing arguments', async () => {
    const invoke = invokeWith({ ...ok(), sourceUrl: bingSerpFeedUrl('seo audit', 'PL', 'pl-pl') });
    const response = await fetchPublicFeed({ feed: 'bing-serp', geo: ' pl ', keyword: ' seo audit ', language: 'PL-pl' }, invoke);
    expect(invoke).toHaveBeenCalledWith('fetch_public_feed', { feed: 'bing-serp', geo: 'PL', keyword: 'seo audit', language: 'pl-pl' });
    expect(response).toMatchObject({ status: 'ok', httpStatus: 200, body: rss });
  });

  it('parses a successful Bing response and keeps partial provenance explicit', async () => {
    const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: 'PL', keyword: 'seo audit', language: 'pl' }, invokeWith(ok()));
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.result.records).toEqual([{ keyword: 'seo audit', rank: 1, url: 'https://example.test/a' }]);
    expect(outcome.result.source).toMatchObject({ kind: 'bing-rss', availability: 'partial', reason: FREE_SERP_PARTIAL_REASON, provider: 'Bing' });
  });

  it('returns blocked responses without exposing upstream bodies', async () => {
    const blocked = { ...ok(), status: 'blocked', body: null, httpStatus: 429, error: 'Public feed blocked by upstream (HTTP 429).' };
    const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: 'PL', keyword: 'seo audit', language: 'pl' }, invokeWith(blocked));
    expect(outcome).toMatchObject({ status: 'blocked', result: null, response: { body: null, httpStatus: 429 } });
  });

  it('turns native invocation failures into an explicit error outcome', async () => {
    const outcome = await fetchFreeSerp({ feed: 'bing-serp', geo: 'PL', keyword: 'seo audit', language: 'pl' }, vi.fn().mockRejectedValue(new Error('desktop unavailable')));
    expect(outcome).toMatchObject({ status: 'error', result: null, response: { status: 'error', body: null, httpStatus: null, error: 'desktop unavailable' } });
    expect(outcome.response.sourceUrl).toBe(bingSerpFeedUrl('seo audit', 'PL', 'pl'));
  });

  it('keeps Google Trends available through the generic native adapter', async () => {
    const response = { ...ok(), sourceUrl: 'https://trends.google.com/trending/rss?geo=PL', body: '<rss/>', httpStatus: 200 };
    const invoke = invokeWith(response);
    await expect(fetchPublicFeed({ feed: 'google-trends', geo: 'pl', keyword: '', language: 'en' }, invoke)).resolves.toMatchObject({ sourceUrl: response.sourceUrl });
    await expect(fetchFreeSerp({ feed: 'google-trends', geo: 'PL', keyword: 'x', language: 'pl' }, invoke)).rejects.toThrow(/Bing RSS/);
  });
});
