import { createCrawlRunFixture, createCrawlResultFixture, createCrawlPageFixture } from './fixtures/crawl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compactCrawlRunsForStorage, crawlQuotaRetryCounts, decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage, isStorageQuotaError, saveCrawlRuns } from '../src/services/crawlPersistence';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('crawl persistence quota recovery', () => {
  const validRun = (id = 'run-1') => ({
    id,
    completedAt: '2026-09-24T08:00:00.000Z',
    startUrl: 'https://example.test/',
    config: {},
    result: {
      start_url: 'https://example.test/',
      pages_crawled: 1,
      health_score: 90,
      critical_count: 0,
      warning_count: 1,
      notice_count: 0,
      duration_ms: 10,
      cancelled: false,
      robots_txt_status: 'not_checked',
      robots_blocked_count: 0,
      sitemap_status: 'not_checked',
      sitemap_urls_discovered: 0,
      sitemap_urls: [],
      pages: [{
        url: 'https://example.test/',
        final_url: 'https://example.test/',
        redirect_chain: [],
        depth: 0,
        http_status: 200,
        response_time_ms: 20,
        indexability_status: 'indexable',
        body_truncated: false,
        word_count: 20,
        h1_count: 1,
        internal_link_count: 60,
        external_link_count: 0,
        links: Array.from({ length: 60 }, (_, index) => ({ target_url: `https://example.test/${index}`, anchor_text: `Link ${index}`, is_internal: true })),
        images: Array.from({ length: 60 }, (_, index) => ({ src: `https://example.test/image-${index}.jpg`, alt: `Image ${index}`, lazy_loaded: false })),
        issues_count: 60,
        issues: Array.from({ length: 60 }, (_, index) => ({ severity: 'Warning', message: `Issue ${index}` })),
        semantic_excerpts: Array.from({ length: 20 }, (_, index) => `Excerpt ${index}`),
      }],
    },
  });

  it('creates a marked bounded snapshot without mutating the in-memory run', () => {
    const source = validRun();
    const compacted = compactCrawlRunsForStorage([source as never]);

    expect(compacted[0]).not.toBe(source);
    expect(compacted[0].storage_compacted).toBe(true);
    expect(compacted[0].result.pages[0].links).toHaveLength(40);
    expect(compacted[0].result.pages[0].images).toHaveLength(40);
    expect(compacted[0].result.pages[0].issues).toHaveLength(40);
    expect(compacted[0].result.pages[0].semantic_excerpts).toHaveLength(10);
    expect(source.result.pages[0].links).toHaveLength(60);
  });

  it('reduces retained history geometrically while always keeping the newest crawl', () => {
    expect(crawlQuotaRetryCounts(50)).toEqual([25, 12, 6, 3, 1]);
    expect(crawlQuotaRetryCounts(3)).toEqual([1]);
  });

  it('does not retry an empty history or a single oversized crawl', () => {
    expect(crawlQuotaRetryCounts(0)).toEqual([]);
    expect(crawlQuotaRetryCounts(1)).toEqual([]);
  });

  it('recognizes quota errors surfaced as either native strings or browser exceptions', () => {
    expect(isStorageQuotaError('The quota has been exceeded.')).toBe(true);
    expect(isStorageQuotaError('Saved crawl history exceeds the 512 MiB project storage limit.')).toBe(true);
    expect(isStorageQuotaError('Skrośna historia crawla nadal przekracza limit 512 MiB po kompresji.')).toBe(true);
    expect(isStorageQuotaError(new Error('Przekroczono limit miejsca na dane.'))).toBe(true);
    expect(isStorageQuotaError(new DOMException('Storage is full', 'QuotaExceededError'))).toBe(true);
    expect(isStorageQuotaError(new Error('network unavailable'))).toBe(false);
  });

  it('compresses crawl history for WebView persistence and reads legacy uncompressed records', async () => {
    const runs = [createCrawlRunFixture({ id: 'run-1', result: createCrawlResultFixture({ pages: Array.from({ length: 20 }, (_, index) => createCrawlPageFixture({ url: `https://example.test/${index}`, links: Array.from({ length: 25 }, () => ({ target_url: 'https://example.test/target', is_internal: true, anchor_text: 'Repeated navigation link' })) })) }) })];
    const stored = await encodeCrawlRunsForStorage(runs);

    if ('format' in stored) {
      expect(stored.bytes.byteLength).toBeLessThan(new TextEncoder().encode(JSON.stringify(runs)).byteLength);
    }
    expect(await decodeCrawlRunsFromStorage(stored)).toEqual(runs);
    expect(await decodeCrawlRunsFromStorage(runs)).toEqual(runs);
  });

  it('retries desktop history persistence while retaining the newest crawl', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce('The quota has been exceeded.').mockResolvedValueOnce(undefined);

    const runs = Array.from({ length: 3 }, (_, index) => ({ id: `run-${index}` })) as never;
    const result = await saveCrawlRuns('project-1', runs);

    expect(result).toEqual({ prunedRuns: 2 });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0]?.[1]).toMatchObject({ crawlRuns: [{ id: 'run-0' }, { id: 'run-1' }, { id: 'run-2' }] });
    expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({ crawlRuns: [{ id: 'run-0' }] });
    invokeMock.mockReset();
  });

  it('clears obsolete Web Storage mirrors after a successful native save', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockReset().mockResolvedValue(undefined);
    localStorage.setItem('seomi_project_project-mirror_crawl_result', JSON.stringify({ pages: 500 }));
    localStorage.setItem('seomi_project_project-mirror_crawl_runs', JSON.stringify([{ id: 'legacy' }]));

    const result = await saveCrawlRuns('project-mirror', [{ id: 'newest' }] as never);

    expect(result).toEqual({ prunedRuns: 0 });
    expect(localStorage.getItem('seomi_project_project-mirror_crawl_result')).toBeNull();
    expect(localStorage.getItem('seomi_project_project-mirror_crawl_runs')).toBeNull();
    invokeMock.mockReset();
  });

  it('serializes concurrent writes for one project so a stale snapshot cannot win', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockReset();
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
    invokeMock.mockImplementation(async (_command, args) => {
      const payload = args as { crawlRuns?: Array<{ id: string }> };
      if (payload.crawlRuns?.[0]?.id === 'old') {
        markFirstStarted();
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
      }
      return undefined;
    });

    const first = saveCrawlRuns('project-serialized', [{ id: 'old' }] as never);
    await firstStarted;
    const second = saveCrawlRuns('project-serialized', [{ id: 'new' }] as never);
    await Promise.resolve();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    releaseFirst();
    await Promise.all([first, second]);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({ crawlRuns: [{ id: 'new' }] });
    invokeMock.mockReset();
  });

  it('prunes old desktop runs when the native 512 MiB storage limit is returned in Polish', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce('Skrośna historia crawla nadal przekracza limit 512 MiB po kompresji.').mockResolvedValueOnce(undefined);

    const runs = [{ id: 'newest' }, { id: 'older-1' }, { id: 'older-2' }] as never;
    const result = await saveCrawlRuns('project-1', runs);

    expect(result).toEqual({ prunedRuns: 2 });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({ crawlRuns: [{ id: 'newest' }] });
    invokeMock.mockReset();
  });

  it('falls back to a level-two bounded snapshot when one oversized desktop run cannot fit', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockResolvedValueOnce(undefined);

    const result = await saveCrawlRuns('project-compaction', [validRun() as never]);

    expect(result).toEqual({ prunedRuns: 0, compactedRuns: 1 });
    expect(invokeMock).toHaveBeenCalledTimes(3);
    expect(invokeMock.mock.calls[2]?.[1]).toMatchObject({
      crawlRuns: [{ storage_compacted: true }],
    });
    const persisted = invokeMock.mock.calls[2]?.[1] as { crawlRuns: Array<{ result: { pages: Array<{ links: unknown[]; images: unknown[]; semantic_excerpts?: unknown[] }> } }> };
    expect(persisted.crawlRuns[0].result.pages[0].links).toHaveLength(10);
    expect(persisted.crawlRuns[0].result.pages[0].images).toHaveLength(10);
    expect(persisted.crawlRuns[0].result.pages[0].semantic_excerpts).toHaveLength(3);
    invokeMock.mockReset();
  });

  it('uses a minimal page index when every evidence snapshot exceeds the quota', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    const { invoke } = await import('@tauri-apps/api/core');
    const invokeMock = vi.mocked(invoke);
    invokeMock
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockRejectedValueOnce('The quota has been exceeded.')
      .mockResolvedValueOnce(undefined);

    const result = await saveCrawlRuns('project-page-index', [validRun() as never]);

    expect(result).toEqual({ prunedRuns: 0, compactedRuns: 1 });
    expect(invokeMock).toHaveBeenCalledTimes(5);
    const persisted = invokeMock.mock.calls[4]?.[1] as {
      crawlRuns: Array<{ result: { pages: Array<{ links: unknown[]; images: unknown[] }>; resources?: unknown; rejected_urls?: unknown } }>;
    };
    expect(persisted.crawlRuns[0].result.pages[0].links).toEqual([]);
    expect(persisted.crawlRuns[0].result.pages[0].images).toEqual([]);
    expect(persisted.crawlRuns[0].result.resources).toBeUndefined();
    expect(persisted.crawlRuns[0].result.rejected_urls).toBeUndefined();
    invokeMock.mockReset();
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    localStorage.clear();
    vi.unstubAllGlobals();
  });
});
