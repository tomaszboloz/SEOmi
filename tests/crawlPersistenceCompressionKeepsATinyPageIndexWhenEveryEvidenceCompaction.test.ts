import { createCrawlRunFixture, createCrawlResultFixture, createCrawlPageFixture } from './fixtures/crawl';
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCrawlRunsFromStorage, saveCrawlRuns } from '../src/services/crawlPersistence';
import { localStorageValues } from "./fixtures/crawlPersistenceCompressionContracts";
let localStorageQuotaFailures = 0;

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  clear: () => localStorageValues.clear(),
  getItem: (key: string) => localStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (localStorageQuotaFailures > 0) {
      localStorageQuotaFailures -= 1;
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    localStorageValues.set(key, value);
  },
  removeItem: (key: string) => localStorageValues.delete(key),
} });

describe('crawl history compression', () => {
afterEach(() => {
    localStorage.clear();
    localStorageQuotaFailures = 0;
    vi.unstubAllGlobals();
  });

it('keeps a tiny page index when every evidence compaction attempt hits quota', async () => {
    // Full + level 1 + level 2 + level 3 fail; the final page-index retry
    // must still keep the completed crawl available after a reload.
    localStorageQuotaFailures = 4;
    localStorage.clear();

    const runs = [{ ...createCrawlRunFixture(),
      id: 'page-index-run',
      result: { ...createCrawlResultFixture(),
        pages: Array.from({ length: 300 }, (_, index) => ({ ...createCrawlPageFixture(),
          url: `https://example.com/page-${index}`,
          final_url: `https://example.com/page-${index}`,
          depth: 1,
          http_status: 200,
          response_time_ms: 12,
          indexability_status: 'indexable',
          body_truncated: false,
          word_count: 100,
          internal_link_count: 2,
          external_link_count: 1,
          schema_types: [],
          schema_syntax_errors: 0,
          hreflangs: [],
          h1_count: 1,
          links: [],
          images: [],
          issues_count: 0,
          issues: [],
        })),
        sitemap_urls: [],
      },
    }] as never;

    const result = await saveCrawlRuns('page-index-project', runs);
    expect(result).toEqual({ prunedRuns: 0, compactedRuns: 1 });
    const stored = JSON.parse(localStorage.getItem('seomi_project_page-index-project_crawl_runs') || 'null');
    const restored = await decodeCrawlRunsFromStorage(stored);
    expect(restored[0]).toMatchObject({
      id: 'page-index-run',
      storage_compacted: true,
      result: { storage_pages_truncated: true, storage_pages_total: 300 },
    });
    expect(restored[0].result.pages).toHaveLength(250);
  });

it('compacts legacy snapshots with missing evidence arrays safely', async () => {
    localStorageQuotaFailures = 2;
    localStorage.clear();

    const runs = [{ ...createCrawlRunFixture(),
      id: 'legacy-run',
      result: { ...createCrawlResultFixture(),  pages: [{ ...createCrawlPageFixture(), links: undefined, images: undefined, issues: undefined }], sitemap_urls: [] },
    }] as never;

    const result = await saveCrawlRuns('legacy-quota-project', runs);
    expect(result).toEqual({ prunedRuns: 0, compactedRuns: 1 });
    const stored = JSON.parse(localStorage.getItem('seomi_project_legacy-quota-project_crawl_runs') || 'null');
    expect(await decodeCrawlRunsFromStorage(stored)).toHaveLength(1);
  });
});
