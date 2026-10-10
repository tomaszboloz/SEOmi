import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrendingNow, MAX_TRENDING_PAYLOAD_BYTES } from '@/services/trendingNow';
import { rssFeed } from './fixtures/trendingNow';

const fetchReturning = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response);

afterEach(() => vi.useRealTimers());

describe('Trending Now bounded RSS transport', () => {
  it('requests only the Google HTTPS endpoint with redirects and credentials disabled', async () => {
    const fetcher = fetchReturning(new Response(rssFeed()));
    const snapshot = await fetchTrendingNow('project-a', ' pl ', fetcher);
    expect(snapshot).toMatchObject({ projectId: 'project-a', geo: 'PL', source: { kind: 'google-trends-rss', url: 'https://trends.google.com/trending/rss?geo=PL' } });
    expect(snapshot.entries[0]).toMatchObject({ keyword: 'rower', trafficLabel: '20K+' });
    expect(fetcher).toHaveBeenCalledWith(snapshot.source.url, expect.objectContaining({ method: 'GET', redirect: 'error', credentials: 'omit', signal: expect.any(AbortSignal) }));
  });

  it('supports the default fetch and validates a response URL', async () => {
    const response = new Response(rssFeed());
    Object.defineProperty(response, 'url', { value: 'https://trends.google.com/trending/rss?geo=PL' });
    vi.stubGlobal('fetch', fetchReturning(response));
    try { expect((await fetchTrendingNow('a')).entries).toHaveLength(1); }
    finally { vi.unstubAllGlobals(); }
  });

  it('rejects scope before fetching and surfaces network errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('CORS blocked'));
    await expect(fetchTrendingNow('../a', 'PL', fetcher)).rejects.toThrow(/project/);
    await expect(fetchTrendingNow('a', 'POL', fetcher)).rejects.toThrow(/country/);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(fetchTrendingNow('a', 'PL', fetcher)).rejects.toThrow('CORS blocked');
  });

  it('rejects HTTP failures, redirects and a final URL outside the whitelist', async () => {
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response('', { status: 503 })))).rejects.toThrow(/503/);
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response('', { status: 403 })))).rejects.toThrow(/blocked.*403/);
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response('', { status: 429 })))).rejects.toThrow(/blocked.*429/);
    const redirected = new Response(rssFeed());
    Object.defineProperty(redirected, 'redirected', { value: true });
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(redirected))).rejects.toThrow(/redirect/);
    const hostile = new Response(rssFeed());
    Object.defineProperty(hostile, 'url', { value: 'https://evil.test/trending/rss?geo=PL' });
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(hostile))).rejects.toThrow(/whitelist/);
  });

  it('rejects oversized content-length before reading, including a bodyless response', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const headers = { 'content-length': String(MAX_TRENDING_PAYLOAD_BYTES + 1) };
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response(stream, { headers })))).rejects.toThrow(/byte/);
    expect(cancel).toHaveBeenCalled();
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response(null, { headers })))).rejects.toThrow(/byte/);
  });

  it('counts actual stream bytes and cancels when content-length is absent or dishonest', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(MAX_TRENDING_PAYLOAD_BYTES));
      controller.enqueue(new Uint8Array(1));
    }, cancel });
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response(stream, { headers: { 'content-length': '1' } })))).rejects.toThrow(/byte/);
    expect(cancel).toHaveBeenCalled();
    expect(stream.locked).toBe(false);
  });

  it('decodes UTF-8 across chunk boundaries and rejects malformed encoding', async () => {
    const bytes = new TextEncoder().encode(rssFeed().replace('rower', 'łódź'));
    const split = bytes.indexOf(197) + 1;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(bytes.slice(0, split)); controller.enqueue(bytes.slice(split)); controller.close();
    } });
    expect((await fetchTrendingNow('a', 'PL', fetchReturning(new Response(stream)))).entries[0].keyword).toBe('łódź');
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response(new Uint8Array([255]))))).rejects.toThrow();
  });

  it('validates the bodyless text transport fallback too', async () => {
    const response = new Response(null);
    vi.spyOn(response, 'text').mockResolvedValue(rssFeed());
    expect((await fetchTrendingNow('a', 'PL', fetchReturning(response))).entries).toHaveLength(1);
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(new Response(null)))).rejects.toThrow(/RSS/);
    vi.spyOn(response, 'text').mockResolvedValue('x'.repeat(MAX_TRENDING_PAYLOAD_BYTES + 1));
    await expect(fetchTrendingNow('a', 'PL', fetchReturning(response))).rejects.toThrow(/byte/);
  });

  it('aborts slow requests after fifteen seconds and clears the timeout on failure', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const result = expect(fetchTrendingNow('a', 'PL', fetcher)).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
