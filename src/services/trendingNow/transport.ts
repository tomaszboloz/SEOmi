import { assertTrendingProject, trendingSnapshot } from './contracts';
import { assertGoogleTrendsRssUrl, googleTrendsRssUrl, parseTrendingRss } from './rss';
import { MAX_FREE_FEED_BYTES, type PublicFeedRequest, type PublicFeedResponse } from '../freeSerp/contracts';
import { fetchPublicFeed as fetchNativePublicFeed } from '../publicFeedTransport';
import { isTauriEnvironment } from '../tauri';

const googleRequest = (geo: string): PublicFeedRequest => ({ feed: 'google-trends', geo, keyword: '', language: 'en' });

async function boundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_FREE_FEED_BYTES) {
    await response.body?.cancel();
    throw new Error('Public feed body exceeds the byte limit');
  }
  if (!response.body) {
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_FREE_FEED_BYTES) throw new Error('Public feed body exceeds the byte limit');
    return body;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_FREE_FEED_BYTES) throw new Error('Public feed body exceeds the byte limit');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

async function fetchPublicFeedForHost(request: PublicFeedRequest, fetcher: typeof fetch): Promise<PublicFeedResponse> {
  const sourceUrl = googleTrendsRssUrl(request.geo);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetcher(sourceUrl, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (response.redirected) throw new Error('Public feed redirects are prohibited');
    if (response.url) assertGoogleTrendsRssUrl(response.url, request.geo);
    const fetchedAt = new Date().toISOString();
    if (response.status === 403 || response.status === 429) {
      return { status: 'blocked', sourceUrl, fetchedAt, body: null, httpStatus: response.status, error: `Public feed blocked by upstream (HTTP ${response.status}).` };
    }
    if (!response.ok) {
      return { status: 'error', sourceUrl, fetchedAt, body: null, httpStatus: response.status, error: `Public feed request failed (HTTP ${response.status}).` };
    }
    return { status: 'ok', sourceUrl, fetchedAt, body: await boundedBody(response), httpStatus: response.status, error: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Use native networking in the desktop shell and a bounded preview transport in WebView/browser tests. */
export async function fetchTrendingNow(projectId: string, geo = 'PL', fetcher: typeof fetch = fetch) {
  assertTrendingProject(projectId);
  const url = googleTrendsRssUrl(geo);
  assertGoogleTrendsRssUrl(url, geo);
  const request = googleRequest(geo);
  const response = isTauriEnvironment()
    ? await fetchNativePublicFeed(request)
    : await fetchPublicFeedForHost(request, fetcher);
  if (response.status !== 'ok' || response.body === null) {
    throw new Error(`Trending Now RSS request ${response.status}: ${response.error}`);
  }
  assertGoogleTrendsRssUrl(response.sourceUrl, geo);
  const entries = parseTrendingRss(response.body);
  return trendingSnapshot(projectId, geo, { kind: 'google-trends-rss', url: response.sourceUrl }, entries, response.fetchedAt);
}
