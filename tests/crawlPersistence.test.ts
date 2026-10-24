import { createCrawlRunFixture, createCrawlResultFixture, createCrawlPageFixture } from './fixtures/crawl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compactCrawlRunsForStorage, crawlQuotaRetryCounts, decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage, isStorageQuotaError } from '../src/services/crawlPersistence';
import { validRun } from "./fixtures/crawlPersistenceContracts";
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('crawl persistence quota recovery', () => {
afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    localStorage.clear();
    vi.unstubAllGlobals();
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

});
