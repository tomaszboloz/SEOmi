import { normalizeFreeRequest, type PublicFeed, type PublicFeedRequest } from './contracts';

const GOOGLE_HOST = 'trends.google.com';
const BING_HOST = 'www.bing.com';
const GOOGLE_SUGGESTIONS_HOST = 'suggestqueries.google.com';

export const googleTrendsFeedUrl = (geo = 'PL'): string => {
  const request = normalizeFreeRequest({ feed: 'google-trends', geo, keyword: '', language: 'en' });
  return `https://${GOOGLE_HOST}/trending/rss?geo=${request.geo}`;
};

export const bingSerpFeedUrl = (keyword: string, geo = 'PL', language = 'en'): string => {
  const request = normalizeFreeRequest({ feed: 'bing-serp', geo, keyword, language });
  const query = new URLSearchParams({ format: 'rss', q: request.keyword, setlang: request.language, cc: request.geo });
  return `https://${BING_HOST}/search?${query.toString()}`;
};

export const googleSuggestionsFeedUrl = (keyword: string, geo = 'PL', language = 'en'): string => {
  const request = normalizeFreeRequest({ feed: 'google-suggestions', geo, keyword, language });
  const query = new URLSearchParams({ client: 'firefox', hl: request.language, gl: request.geo.toLowerCase(), q: request.keyword });
  return `https://${GOOGLE_SUGGESTIONS_HOST}/complete/search?${query.toString()}`;
};

export const publicFeedUrl = (request: PublicFeedRequest): string => {
  const normalized = normalizeFreeRequest(request);
  if (normalized.feed === 'google-trends') return googleTrendsFeedUrl(normalized.geo);
  if (normalized.feed === 'google-suggestions') return googleSuggestionsFeedUrl(normalized.keyword, normalized.geo, normalized.language);
  return bingSerpFeedUrl(normalized.keyword, normalized.geo, normalized.language);
};

export const assertPublicFeedUrl = (value: string, request: PublicFeedRequest): void => {
  const expected = new URL(publicFeedUrl(request));
  const actual = new URL(value);
  if (actual.protocol !== 'https:' || actual.username || actual.password || actual.port || actual.hash || actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.search !== expected.search) {
    throw new Error('Public feed URL is outside the HTTPS host whitelist');
  }
};

export const assertPublicFeedKind = (feed: string): feed is PublicFeed => ['google-trends', 'bing-serp', 'google-suggestions'].includes(feed);
