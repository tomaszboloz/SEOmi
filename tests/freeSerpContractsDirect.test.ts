import { describe, expect, it } from 'vitest';
import {
  assertFreeFeedRequest,
  normalizeFreeRequest,
  type PublicFeedRequest,
} from '@/services/freeSerp/contracts';
import { assertPublicFeedKind, assertPublicFeedUrl, bingSerpFeedUrl, googleTrendsFeedUrl, publicFeedUrl } from '@/services/freeSerp/urls';

const bing: PublicFeedRequest = { feed: 'bing-serp', geo: ' pl ', keyword: ' seo audit ', language: 'PL-pl' };

describe('free SERP request and URL contracts', () => {
  it('directly validates and normalizes supported request values', () => {
    expect(() => assertFreeFeedRequest({ feed: 'google-trends', geo: 'PL', keyword: '', language: 'en' })).not.toThrow();
    expect(() => assertFreeFeedRequest({ ...bing, feed: 'bing-serp' })).not.toThrow();
    expect(normalizeFreeRequest(bing)).toEqual({ feed: 'bing-serp', geo: 'PL', keyword: 'seo audit', language: 'pl-pl' });
  });

  it('rejects unsupported feeds, bad markets/languages and empty Bing keywords', () => {
    for (const request of [
      { ...bing, feed: 'other' },
      { ...bing, geo: 'POL' },
      { ...bing, language: 'p' },
      { ...bing, keyword: '   ' },
      { ...bing, keyword: 'x'.repeat(501) },
    ]) expect(() => assertFreeFeedRequest(request as PublicFeedRequest)).toThrow();
    expect(() => assertFreeFeedRequest(null as never)).toThrow(/malformed/);
    expect(() => assertFreeFeedRequest({ ...bing, geo: null } as never)).toThrow(/two-letter country/);
    expect(() => assertFreeFeedRequest({ ...bing, language: null } as never)).toThrow(/valid language/);
  });

  it('builds canonical Google and encoded Bing URLs', () => {
    expect(googleTrendsFeedUrl(' pl ')).toBe('https://trends.google.com/trending/rss?geo=PL');
    expect(publicFeedUrl({ feed: 'google-trends', geo: 'pl', keyword: '', language: 'en' })).toBe('https://trends.google.com/trending/rss?geo=PL');
    const url = publicFeedUrl({ feed: 'bing-serp', geo: 'pl', keyword: 'seo audit & test', language: 'PL-pl' });
    expect(url).toBe('https://www.bing.com/search?format=rss&q=seo+audit+%26+test&setlang=pl-pl&cc=PL');
    expect(assertPublicFeedKind('google-trends')).toBe(true);
    expect(assertPublicFeedKind('bing-serp')).toBe(true);
    expect(assertPublicFeedKind('other')).toBe(false);
  });

  it('accepts the exact source URL and rejects host, query and credential changes', () => {
    const request = { feed: 'bing-serp' as const, geo: 'PL', keyword: 'seo', language: 'pl' };
    const expected = bingSerpFeedUrl(request.keyword, request.geo, request.language);
    expect(() => assertPublicFeedUrl(expected, request)).not.toThrow();
    for (const value of [
      expected.replace('www.bing.com', 'evil.test'),
      `${expected}&extra=1`,
      expected.replace('https://', 'https://u:p@'),
      expected.replace('/search?', '/other?'),
      `${expected}#fragment`,
    ]) expect(() => assertPublicFeedUrl(value, request)).toThrow(/whitelist/);
  });
});
