import { describe, expect, it } from 'vitest';
import { assertGoogleTrendsRssUrl, googleTrendsRssUrl, parseTrendingRss, MAX_TRENDING_ENTRIES } from '@/services/trendingNow';
import { rssEntry, rssFeed } from './fixtures/trendingNow';

describe('Google Trending Now RSS', () => {
  it('defaults to PL, normalizes geo and restricts HTTPS host and endpoint', () => {
    expect(googleTrendsRssUrl()).toBe('https://trends.google.com/trending/rss?geo=PL');
    expect(googleTrendsRssUrl(' us ')).toBe('https://trends.google.com/trending/rss?geo=US');
    expect(() => assertGoogleTrendsRssUrl(googleTrendsRssUrl(), 'PL')).not.toThrow();
    expect(() => assertGoogleTrendsRssUrl('https://trends.google.com:443/trending/rss?geo=PL', 'PL')).not.toThrow();
  });

  it.each(['http://trends.google.com/trending/rss?geo=PL', 'https://trends.google.com.evil.test/trending/rss?geo=PL',
    'https://evil.test/trending/rss?geo=PL', 'https://trends.google.com:8443/trending/rss?geo=PL',
    'https://user@trends.google.com/trending/rss?geo=PL', 'https://:pass@trends.google.com/trending/rss?geo=PL',
    'https://trends.google.com/trending/rss?geo=PL#fragment', 'https://trends.google.com/other?geo=PL',
    'https://trends.google.com/trending/rss?geo=US', 'https://trends.google.com/trending/rss?geo=PL&geo=US', 'no url'])('rejects unsafe source URL %s',
    (url) => expect(() => assertGoogleTrendsRssUrl(url, 'PL')).toThrow());

  it('reads namespaced traffic, dates and XML entities as plain text', () => {
    expect(parseTrendingRss(rssFeed(rssEntry('kot &amp; pies', '20K+')))).toEqual([
      { keyword: 'kot & pies', trafficLabel: '20K+', startedAt: 'Tue, 6 Oct 2026 01:00:00 -0700' },
    ]);
    expect(parseTrendingRss(rssFeed('<item><title><![CDATA[<b>trend</b>]]></title></item>')))
      .toEqual([{ keyword: '<b>trend</b>', trafficLabel: null, startedAt: null }]);
    expect(parseTrendingRss(rssFeed().replaceAll('ht:', 'alias:').replace('xmlns:ht', 'xmlns:alias'))[0].trafficLabel).toBe('20K+');
  });

  it('does not read traffic in an unrelated namespace or article title as a trend', () => {
    const payload = rssFeed('<item><ht:news_item><title>article</title></ht:news_item><title>trend</title><approx_traffic>100</approx_traffic></item>');
    expect(parseTrendingRss(payload)).toEqual([{ keyword: 'trend', trafficLabel: null, startedAt: null }]);
    expect(parseTrendingRss(rssFeed())).toHaveLength(1);
    expect(parseTrendingRss(rssFeed(''))).toEqual([]);
  });

  it.each(['<rss>', '<html/>', '<rss/>', rssFeed('<item/>'), rssFeed(rssEntry('a', '10+', 'invalid')),
    '<!DOCTYPE rss SYSTEM "https://evil.test"><rss><channel/></rss>', '<!ENTITY x "abc"><rss><channel/></rss>'])('rejects invalid/unsafe RSS %s',
    (payload) => expect(() => parseTrendingRss(payload)).toThrow());

  it('enforces item limits', () => {
    expect(parseTrendingRss(rssFeed(rssEntry().repeat(MAX_TRENDING_ENTRIES)))).toHaveLength(MAX_TRENDING_ENTRIES);
    expect(() => parseTrendingRss(rssFeed(rssEntry().repeat(MAX_TRENDING_ENTRIES + 1)))).toThrow(/count/);
  });
});
