import { buildSerpImport, assertSerpPayload } from '../serpImport/normalize';
import type { PublicFeedRequest, FreeSerpResult } from './contracts';
import { FREE_ENGINE_REASON, MAX_FREE_SERP_RESULTS, normalizeFreeRequest } from './contracts';
import { assertPublicFeedUrl, bingSerpFeedUrl } from './urls';

const text = (item: Element, name: string): string | null => Array.from(item.children).find((child) => child.localName.toLowerCase() === name)?.textContent?.trim() || null;

export const parseBingSerpRss = (
  payload: string, request: PublicFeedRequest, sourceUrl = bingSerpFeedUrl(request.keyword, request.geo, request.language), fetchedAt = new Date().toISOString(),
): FreeSerpResult => {
  const normalized = normalizeFreeRequest({ ...request, feed: 'bing-serp' });
  assertPublicFeedUrl(sourceUrl, normalized);
  assertSerpPayload(payload);
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(payload)) throw new Error('Public feed XML declarations are prohibited');
  const document = new DOMParser().parseFromString(payload, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.tagName.toLowerCase() !== 'rss') throw new Error('Invalid Bing RSS');
  const channel = Array.from(document.documentElement.children).find((node) => node.localName.toLowerCase() === 'channel');
  if (!channel) throw new Error('Bing RSS channel is missing');
  const records = Array.from(channel.children).filter((node) => node.localName.toLowerCase() === 'item').slice(0, MAX_FREE_SERP_RESULTS).map((item, index) => ({ keyword: normalized.keyword, rank: index + 1, url: text(item, 'link') }));
  const imported = buildSerpImport('bing-rss', records, { provider: 'Bing', sourceUrl, countryCode: normalized.geo, languageCode: normalized.language, retrievedAt: fetchedAt, availability: 'partial', reason: FREE_ENGINE_REASON });
  return { ...imported, feed: 'bing-serp', fetchedAt, sourceUrl, snapshot: imported.snapshots[0] || null };
};

export const parseBingSerpResponse = (response: { status: string; sourceUrl: string; fetchedAt: string; body: string | null; error: string | null }, request: PublicFeedRequest): FreeSerpResult => {
  if (response.status !== 'ok' || response.body === null) throw new Error(response.error || 'Bing RSS response is unavailable');
  return parseBingSerpRss(response.body, request, response.sourceUrl, response.fetchedAt);
};
