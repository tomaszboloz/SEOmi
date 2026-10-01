import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveCrawlRuns } from '../src/services/crawlPersistence';
import { validRun } from "./fixtures/crawlPersistenceContracts";
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('crawl persistence quota recovery', () => {
afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    localStorage.clear();
    vi.unstubAllGlobals();
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
});
