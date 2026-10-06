import { describe, expect, it } from 'vitest';
import { parseBingSerpResponse, parseBingSerpRss } from '@/services/freeSerp/rss';
import { bingSerpFeedUrl } from '@/services/freeSerp/urls';

const request = { feed: 'bing-serp' as const, geo: 'PL', keyword: 'seo audit', language: 'pl' };
const sourceUrl = bingSerpFeedUrl(request.keyword, request.geo, request.language);
const payload = '<rss><channel><item><title>One</title><link>https://example.test/a?utm_source=x</link></item><item><title>Two</title><link>https://example.test/b</link></item></channel></rss>';
const response = (overrides: Record<string, unknown> = {}) => ({ status: 'ok', sourceUrl, fetchedAt: '2026-10-06T10:00:00Z', body: payload, error: null, ...overrides });

describe('free SERP RSS direct contracts', () => {
  it('parses records with explicit partial provenance and normalized URLs', () => {
    const result = parseBingSerpRss(payload, request, sourceUrl, '2026-10-06T10:00:00Z');
    expect(result.records).toEqual([
      { keyword: 'seo audit', rank: 1, url: 'https://example.test/a' },
      { keyword: 'seo audit', rank: 2, url: 'https://example.test/b' },
    ]);
    expect(result.source).toMatchObject({ kind: 'bing-rss', provider: 'Bing', availability: 'partial', countryCode: 'PL', languageCode: 'pl', retrievedAt: '2026-10-06T10:00:00Z' });
    expect(result.snapshot?.urls).toEqual(['https://example.test/a', 'https://example.test/b']);
  });

  it('keeps missing links as explicit rejected evidence', () => {
    const result = parseBingSerpRss('<rss><channel><item><title>Missing</title></item></channel></rss>', request, sourceUrl, '2026-10-06T10:00:00Z');
    expect(result.records).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/URL/);
    expect(result.source.availability).toBe('partial');
  });

  it('directly maps successful and unavailable responses', () => {
    expect(parseBingSerpResponse(response(), request).records).toHaveLength(2);
    for (const value of [response({ status: 'blocked', body: null, error: 'blocked' }), response({ status: 'error', body: null, error: 'offline' }), response({ status: 'ok', body: null, error: null })]) {
      expect(() => parseBingSerpResponse(value as never, request)).toThrow();
    }
  });

  it('rejects malformed or malicious XML and a mismatched source context', () => {
    for (const value of ['<html/>', '<rss><channel>', '<rss/>', '<!DOCTYPE rss [<!ENTITY x "evil">]><rss/>']) {
      expect(() => parseBingSerpRss(value, request, sourceUrl, '2026-10-06T10:00:00Z')).toThrow();
    }
    const other = bingSerpFeedUrl('different keyword', 'PL', 'pl');
    expect(() => parseBingSerpRss(payload, request, other, '2026-10-06T10:00:00Z')).toThrow(/whitelist/);
  });
});
