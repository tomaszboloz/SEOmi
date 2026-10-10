import { describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_SUGGESTIONS_REASON, fetchFreeSuggestions, googleSuggestionsFeedUrl, parseGoogleSuggestions,
} from '@/services/freeSuggestions';
import { fetchPublicFeed } from '@/services/publicFeedTransport';

const liveFixture = ['seo', ['seohost', 'seo', 'seo co to', 'seo', 'seoul'], [], { 'google:suggestsubtypes': [[[512]]] }];
const response = (body: string, request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'pl' }) => ({
  status: 'ok', sourceUrl: googleSuggestionsFeedUrl(request.keyword, request.geo, request.language), fetchedAt: '2026-10-06T10:00:00Z',
  body, httpStatus: 200, error: null,
});
const invokeWith = (value: unknown) => vi.fn().mockResolvedValue(value);

describe('Google Suggestions contracts', () => {
  it('parses the Firefox envelope, deduplicates suggestions and preserves provenance', () => {
    const result = parseGoogleSuggestions(JSON.stringify(liveFixture), { feed: 'google-suggestions', geo: 'pl', keyword: ' SEO ', language: 'PL' });
    expect(result.suggestions).toEqual(['seohost', 'seo', 'seo co to', 'seoul']);
    expect(result.source).toMatchObject({ kind: 'google-suggest-unofficial', provider: 'Google Suggest', requestedGeo: 'PL', requestedLanguage: 'pl', availability: 'best-effort', reason: GOOGLE_SUGGESTIONS_REASON });
    expect(result.sourceUrl).toBe(googleSuggestionsFeedUrl(' SEO ', 'PL', 'PL'));
  });

  it('compares the echoed query after trimming, collapsing whitespace and ignoring case', () => {
    const result = parseGoogleSuggestions(JSON.stringify(['  SEO   audit ', ['seo audit idea']]), { feed: 'google-suggestions', geo: 'PL', keyword: 'seo audit', language: 'en' });
    expect(result.query).toBe('seo audit');
    expect(() => parseGoogleSuggestions(JSON.stringify(['different', []]), { feed: 'google-suggestions', geo: 'PL', keyword: 'seo audit', language: 'en' })).toThrow(/echo/);
  });

  it('rejects malformed envelopes and unsafe suggestion items', () => {
    const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'en' };
    const payloads = ['{}', JSON.stringify(['seo']), JSON.stringify(['seo', [1]]), JSON.stringify(['seo', ['x'.repeat(501)]])];
    for (const payload of payloads) {
      expect(() => parseGoogleSuggestions(payload, request)).toThrow();
    }
  });

  it('limits the number of suggestions while retaining the first occurrence', () => {
    const values = Array.from({ length: 105 }, (_, index) => `idea ${index}`);
    values.splice(3, 0, 'IDEA 1');
    const result = parseGoogleSuggestions(JSON.stringify(['seo', values]), { feed: 'google-suggestions', geo: 'PL', keyword: 'seo', language: 'en' });
    expect(result.suggestions).toHaveLength(100);
    expect(result.suggestions[1]).toBe('IDEA 1');
  });
});

describe('Google Suggestions transport', () => {
  it('invokes native networking with normalized request and parses the response', async () => {
    const request = { feed: 'google-suggestions' as const, geo: ' pl ', keyword: ' SEO ', language: 'PL-pl' };
    const invoke = invokeWith(response(JSON.stringify(liveFixture), request));
    const outcome = await fetchFreeSuggestions(request, invoke);
    expect(invoke).toHaveBeenCalledWith('fetch_public_feed', { feed: 'google-suggestions', geo: 'PL', keyword: 'SEO', language: 'pl-pl' });
    expect(outcome).toMatchObject({ status: 'ok', result: { query: 'SEO', suggestions: ['seohost', 'seo', 'seo co to', 'seoul'] } });
  });

  it('keeps blocked and parse failures explicit without exposing a body', async () => {
    const blockedRequest = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'en' };
    const blocked = { ...response('', blockedRequest), status: 'blocked', body: null, httpStatus: 429, error: 'blocked' };
    await expect(fetchFreeSuggestions(blockedRequest, invokeWith(blocked))).resolves.toMatchObject({ status: 'blocked', result: null });
    const invalid = await fetchFreeSuggestions(blockedRequest, invokeWith(response(JSON.stringify(['other', []]), blockedRequest)));
    expect(invalid).toMatchObject({ status: 'error', result: null, response: { body: null } });
  });

  it('uses UTF-8 bytes for the shared native keyword limit', async () => {
    const invoke = vi.fn();
    await expect(fetchPublicFeed({ feed: 'google-suggestions', geo: 'PL', keyword: 'ą'.repeat(251), language: 'pl' }, invoke)).rejects.toThrow(/too long/);
    expect(invoke).not.toHaveBeenCalled();
    const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'ą'.repeat(250), language: 'pl' };
    await expect(fetchPublicFeed(request, invokeWith(response(JSON.stringify(['ą'.repeat(250), []]), request)))).resolves.toMatchObject({ status: 'ok' });
  });
});
