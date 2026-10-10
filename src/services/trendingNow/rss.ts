import { assertTrendingPayload, trendingEntries, trendingGeo, type TrendingEntry } from './contracts';

const RSS_NAMESPACE = 'https://trends.google.com/trending/rss';

export function googleTrendsRssUrl(geo = 'PL'): string {
  return `https://trends.google.com/trending/rss?geo=${trendingGeo(geo)}`;
}

export function assertGoogleTrendsRssUrl(value: string, geo: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'trends.google.com' || url.port ||
      url.username || url.password || url.hash || url.pathname !== '/trending/rss' ||
      url.search !== `?geo=${trendingGeo(geo)}`) {
    throw new Error('Trending Now URL is outside the HTTPS host whitelist');
  }
}

export function parseTrendingRss(payload: string): TrendingEntry[] {
  assertTrendingPayload(payload);
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(payload)) throw new Error('Trending Now XML declarations are prohibited');
  const document = new DOMParser().parseFromString(payload, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.tagName !== 'rss') {
    throw new Error('Invalid Trending Now RSS');
  }
  const channel = Array.from(document.documentElement.children).find((node) => node.tagName === 'channel');
  if (!channel) throw new Error('Trending Now RSS channel is missing');
  return trendingEntries(Array.from(channel.children).filter((node) => node.tagName === 'item').map((item) => {
    const children = Array.from(item.children);
    const text = (name: string) => children.find((node) => node.tagName === name)?.textContent ?? null;
    return {
      keyword: text('title'), startedAt: text('pubDate'),
      trafficLabel: children.find((node) => node.localName === 'approx_traffic' && node.namespaceURI === RSS_NAMESPACE)?.textContent ?? null,
    };
  }));
}
